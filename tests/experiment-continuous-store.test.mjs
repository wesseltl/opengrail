import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

// Real local D1 and frozen kernels; all strategies, observations and claims are invented.
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(module,module.exports,id=>id.startsWith('.')?load(resolve(dirname(file),/\.(?:ts|mjs)$/.test(id)?id:id+'.ts')):native(id));return module.exports;}
const model=load('app/experiment-model.ts'),{ExperimentRepository}=load('app/experiment-store.ts'),strategy=load('app/strategy-model.ts'),{StrategyRepository}=load('app/strategy-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts'),journal=load('app/session-journal.ts'),evidence=load('app/session-evidence-model.ts'),local=load('app/session-evidence.ts'),demo=load('app/demo-engine.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-10000).toISOString(),human=(moderator=false)=>({kind:'HUMAN',userId:uid(),moderator}),policyAccepted='public-experiment-v1';
const startedAt='2025-01-01T00:00:00.000Z',barAt='2025-01-01T01:00:00.000Z',later=n=>new Date(Date.parse(barAt)+n).toISOString();
const ref=item=>({id:item.id,digest:item.digest}),status=code=>error=>error instanceof model.ExperimentError&&error.status===code;
const moderate=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted});
const outcome=(parent,result,extra={})=>({action:'outcome',requestId:uid(),id:uid(),method:'CONTINUOUS_DEMO',name:'Invented retained continuous result',manifest:ref(parent),result,claim:{type:'ORIGINAL',relation:null,sharedDependencies:['Same first-party Session method'],conflicts:''},policyAccepted,...extra});
let mf,db;
before(async()=>{
 const source=`import {ExperimentRepository} from './app/experiment-store';import {NetworkRepository} from './app/network-store';export default{async fetch(request,env){const raw=await request.json();try{const actor=raw.token?{kind:'AGENT',principal:await new NetworkRepository(env.DB).authenticate(raw.token,raw.at)}:{kind:'HUMAN',userId:raw.user,moderator:false};return Response.json(await new ExperimentRepository(env.DB).write(actor,raw.command,raw.at));}catch(error){return Response.json({error:error.message},{status:error.status??503});}}};`;
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 assert(!Object.keys(bundled.metafile.inputs).some(file=>/(?:session-(?:engine|journal)|demo-engine|reference-engine)\.ts$/.test(file)),'Public write worker must never import local evaluators.');
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['experiment_reports','experiment_moderation','experiment_records','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>mf?.dispose());
const repo=()=>new ExperimentRepository(db);
async function source(actor=human(),direction='LONG'){
 const definition=strategy.strategyTemplate('DCA');definition.market.direction=direction;definition.entry={type:'DCA',intervalBars:1,maxEntries:4};definition.risk={positionPct:10,maxOpenPositions:2,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:5};
 return (await new StrategyRepository(db).write(actor,{action:'publish',requestId:uid(),id:uid(),name:'Invented continuous source',description:'A local synthetic published strategy fixture.',definition,assumptions:'Invented observations and friction; no authentic feed.',falsification:'Every exact retained transition must reconstruct.',sources:[],relation:null,policyAccepted:'public-strategy-v1'},at())).item;
}
async function fixture({selected,direction='LONG',open=true}={}){
 selected??=await source(human(),direction);
 const config={version:1,sessionId:uid(),methodVersion:'opengrail-session-v1',clockMode:'SYNTHETIC_PLAYBACK',origin:'PUBLIC_STRATEGY',strategy:{record:selected.record,digest:selected.digest},initialCapital:1000,provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented local source; public fixture permission.'},sourceLabel:'Invented retrospective observations',ordersEnabled:false,liveEnabled:false};
 let tape=await journal.createSessionJournal(config,startedAt);
 if(open){tape=await journal.appendSessionEvent(tape,{requestId:uid(),type:'CLOSED_BAR',bar:{closedAt:barAt,open:100,high:100,low:100,close:100,volume:1}},barAt);tape=await journal.appendSessionEvent(tape,{requestId:uid(),type:'QUOTE',observedAt:later(1),price:100},later(2));}
 return fromTape(tape,selected);
}
async function fromTape(tape,selected){const bundle=await local.snapshotSessionEvidence(tape,{hypothesis:'Retrospective invented continuous hypothesis.',falsification:'Reject an inconsistent reconstructed transition.'}),command={action:'register',requestId:uid(),id:uid(),...model.experimentContinuousRegisterDefaults(bundle.input,'Invented local fixed Session source'),policyAccepted};assert.equal(bundle.result.kind,'ARTIFACT');return {selected,tape,bundle,artifact:bundle.result.artifact,command};}
async function manifest(actor=human(),options={}){const f=await fixture(options);return {...f,actor,parent:(await repo().write(actor,f.command,at())).item};}
async function count(type){return (await db.prepare('SELECT COUNT(*) AS n FROM experiment_records'+(type?' WHERE type=?':'')).bind(...type?[type]:[]).first()).n;}
async function agent(sponsor,registeredAt=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name:'og_agent_researcher',tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,registeredAt);return {token:generated.token,command,actor:{kind:'AGENT',principal:await new NetworkRepository(db).authenticate(generated.token,registeredAt)}};}
function wrapper(beforeRun,afterRun){return {prepare(sql){const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const value=await statement.run();await afterRun?.(sql);return value;}});return wrap(db.prepare(sql));}};}
async function rehash(artifact){artifact.inputDigest=await model.experimentDigest(JSON.stringify(artifact.input));const {resultDigest,...body}=artifact;void resultDigest;artifact.resultDigest=await model.experimentDigest(JSON.stringify(body));return artifact;}

test('v2 retains the exact retrospective tape and open inventory without a baseline or fabricated liquidation',async()=>{
 const {parent,artifact,bundle}=await manifest();assert.equal(parent.record.version,2);assert.equal(parent.record.content.method,'CONTINUOUS_DEMO');assert(!('baseline'in parent.record.content));assert.equal(parent.reporting,'UNREPORTED');assert.deepEqual(parent.record.content.input,bundle.input);await model.validateExperimentItem(parent);
 const accepted=(await repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact}),at())).item;await model.validateExperimentItem(accepted);const retained=accepted.record.content.result.artifact;
 assert.equal(retained.projection.openPositions.length,1);assert.equal(retained.projection.trades.length,0);assert.equal(retained.projection.status,'ACTIVE');assert.equal(retained.qualification,'NONE');assert.equal(retained.ordersEnabled,false);assert.equal(retained.liveEnabled,false);
 const summaries=(await repo().outcomes(parent.id)).items;assert.equal(summaries[0].method,'CONTINUOUS_DEMO');assert.equal(summaries[0].status,'ACTIVE');assert(!JSON.stringify(summaries).includes('events'));assert(!JSON.stringify(summaries).includes('artifact'));assert.equal((await repo().get(parent.id)).item.outcomeCount,1);
});

test('PAUSED, awaiting-emergency, adverse exits and interrupted reports append without replacing the manifest',async()=>{
 const first=await fixture(),snapshots=[first];let tape=await journal.appendSessionEvent(first.tape,{requestId:uid(),type:'PAUSE'},later(3));snapshots.push(await fromTape(tape,first.selected));tape=await journal.appendSessionEvent(tape,{requestId:uid(),type:'EMERGENCY'},later(4));snapshots.push(await fromTape(tape,first.selected));tape=await journal.appendSessionEvent(tape,{requestId:uid(),type:'QUOTE',observedAt:later(5),price:90},later(6));snapshots.push(await fromTape(tape,first.selected));
 const seen=[];for(const f of snapshots){const parent=(await repo().write(human(),f.command,at())).item;const accepted=(await repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:f.artifact}),at())).item;seen.push(accepted.record.content.result.artifact.projection.status);assert.deepEqual((await repo().get(parent.id)).item.record,parent.record);}
 assert.deepEqual(seen,['ACTIVE','PAUSED','STOPPING','STOPPED']);const last=snapshots.at(-1).artifact;assert(last.projection.trades[0].netPnl<0);assert(last.projection.account.totalFees>0);
 const parent=(await repo().get(snapshots[0].command.id)).item;for(const result of [{kind:'INTERRUPTED',reason:'Local attempt stopped before reporting.'},{kind:'ARTIFACT_UNAVAILABLE',reason:'Full retained artifact unavailable; no metrics.'}])await repo().write(human(),outcome(parent,result),at());assert.equal((await repo().get(parent.id)).item.outcomeCount,3);
});

test('uncapped SHORT insolvency and terminal negative equity remain retained author claims',async()=>{
 const first=await fixture({direction:'SHORT'}),tape=await journal.appendSessionEvent(first.tape,{requestId:uid(),type:'QUOTE',observedAt:later(3),price:1e8},later(4)),f=await fromTape(tape,first.selected),parent=(await repo().write(human(),f.command,at())).item;
 const accepted=(await repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:f.artifact}),at())).item;assert.equal(accepted.record.content.result.artifact.projection.status,'FAILED');assert.equal(accepted.record.content.result.artifact.projection.failure,'INSOLVENT');assert(accepted.record.content.result.artifact.projection.account.equity<0);assert.equal((await repo().outcomes(parent.id)).items[0].status,'FAILED');
});

test('regressed receipt clocks preserve exact tape order and a later checkpoint requires another immutable manifest',async()=>{
 const first=await manifest(),tape=await journal.appendSessionEvent(first.tape,{requestId:uid(),type:'PAUSE'},barAt),f=await fromTape(tape,first.selected);assert.equal(tape.state.events.at(-1).reason,'OUT_OF_ORDER');assert.equal(f.command.input.events.at(-1).receivedAt,barAt);
 const second=(await repo().write(human(),f.command,at())).item;assert.notEqual(second.digest,first.parent.digest);assert.notEqual(second.record.content.input.journalDigest,first.parent.record.content.input.journalDigest);await assert.rejects(()=>repo().write(human(),outcome(first.parent,{kind:'ARTIFACT',artifact:f.artifact}),at()),status(400));assert.deepEqual((await repo().get(first.parent.id)).item.record,first.parent.record);
});

test('v1 batch and v2 continuous records coexist while cross-method outcomes are definitive rejections',async()=>{
 const f=await manifest(),input=await demo.syntheticDemoInput({record:f.selected.record,digest:f.selected.digest});input.dataset.bars=input.dataset.bars.slice(0,4);input.signals=[];const cmd={action:'register',requestId:uid(),id:uid(),...model.experimentRegisterDefaults(input),policyAccepted},batch=(await repo().write(human(),cmd,at())).item;
 assert.equal(batch.record.version,1);assert(!('method'in batch.record.content));assert(model.experimentIsBatchManifest(batch.record));assert(model.experimentIsContinuousManifest(f.parent.record));
 const continuous=outcome(batch,{kind:'INTERRUPTED',reason:'Wrong method.'});await assert.rejects(()=>repo().write(human(),continuous,at()),status(400));const wrong=outcome(f.parent,{kind:'INTERRUPTED',reason:'Wrong method.'});delete wrong.method;await assert.rejects(()=>repo().write(human(),wrong,at()),status(400));
 const feed=(await repo().list()).items;assert.equal(feed.find(item=>item.id===batch.id).method,undefined);assert.equal(feed.find(item=>item.id===f.parent.id).method,'CONTINUOUS_DEMO');assert.equal(await count('OUTCOME'),0);
});

test('current exact strategy, PUBLIC_STRATEGY origin, pinned method and all source digests are mandatory',async()=>{
 const f=await fixture();for(const mutate of [v=>v.input.methodDigest='0'.repeat(64),v=>v.input.implementation.engine='0'.repeat(64),v=>v.evaluator.sourceDigests.journal='0'.repeat(64),v=>v.input.config.origin='SYNTHETIC_FIXTURE',v=>v.input.config.strategy.digest='0'.repeat(64),v=>v.baseline='COST_AWARE_LONG_SAME_ALLOCATION_V1',v=>v.author={id:'forged'},v=>v.disclosures.publication.publicArtifact=false]){const command=structuredClone(f.command);mutate(command);await assert.rejects(()=>repo().write(human(),command,at()),status(400));}
 const foreign=await source(),changed=structuredClone(f.command);changed.input.config.strategy={record:foreign.record,digest:f.selected.digest};await assert.rejects(()=>repo().write(human(),changed,at()),status(400));
 const offline=structuredClone(f.command);offline.input.config.strategy.record.id=uid();offline.input.config.strategy.record.rootId=offline.input.config.strategy.record.id;offline.input.config.strategy.digest=await model.experimentDigest(JSON.stringify(offline.input.config.strategy.record));await assert.rejects(()=>repo().write(human(),offline,at()),status(404));assert.equal(await count(),0);
});

test('artifact hash and exact input correlation reject altered capital, tape and method without losing unreported parents',async()=>{
 const f=await manifest();for(const mutate of [v=>v.resultDigest='0'.repeat(64),v=>v.inputDigest='0'.repeat(64),v=>v.input.config.initialCapital++,v=>v.input.events[0].receivedAt=later(1),v=>v.input.implementation.model='0'.repeat(64)]){const artifact=structuredClone(f.artifact);mutate(artifact);if(artifact.resultDigest!=='0'.repeat(64)&&artifact.inputDigest!=='0'.repeat(64))await rehash(artifact);await assert.rejects(()=>repo().write(human(),outcome(f.parent,{kind:'ARTIFACT',artifact}),at()),status(400));}
 assert.equal(await count('OUTCOME'),0);assert.equal((await repo().get(f.parent.id)).item.reporting,'UNREPORTED');
});

test('identity-only server retains a self-hashed false projection; fixed local reconstruction exposes disagreement',async()=>{
 const f=await manifest(),artifact=structuredClone(f.artifact);artifact.projection.account.equity+=50000;artifact.projection.account.realizedPnl+=50000;await rehash(artifact);await evidence.verifySessionEvidenceArtifact(artifact);
 const accepted=(await repo().write(human(),outcome(f.parent,{kind:'ARTIFACT',artifact}),at())).item;assert.equal(accepted.record.classification,'AUTHOR_REPORTED');assert.equal(accepted.record.content.result.artifact.projection.account.equity,artifact.projection.account.equity);const report=await local.reviewSessionEvidence(artifact);assert.equal(report.status,'MISMATCH');assert.equal(report.reason,'PROJECTION_MISMATCH');assert.equal(report.qualification,'NONE');
});

test('known encoded local credentials and accessor objects cannot enter retained continuous evidence',async()=>{
 const sponsor=human(),a=await agent(sponsor),selected=await source(a.actor),f=await fixture({selected});assert.equal(f.command.input.config.strategy.record.author.name,'og_agent_researcher');await repo().write(a.actor,f.command,at());
 for(const label of ['og_local_owner_'+'a'.repeat(64),'%6fg_local_producer_'+'b'.repeat(64),'og_agent_'+uid()+'.'+'c'.repeat(64)]){const cmd=structuredClone(f.command);cmd.id=uid();cmd.requestId=uid();cmd.input.config.sourceLabel=label;await assert.rejects(()=>repo().write(human(),cmd,at()),status(400));}
 let invoked=false;const raw={...f.command};Object.defineProperty(raw,'name',{enumerable:true,get(){invoked=true;return 'getter';}});assert.throws(()=>model.boundedExperimentCommand(raw),status(400));assert.equal(invoked,false);assert.equal(await count(),1);
});

test('source and parent suppression redact tape, inventory, projection and method across reads and idempotent receipts',async()=>{
 const actor=human(),f=await manifest(actor),command=outcome(f.parent,{kind:'ARTIFACT',artifact:f.artifact}),child=(await repo().write(actor,command,at())).item,moderator=human(true);
 await repo().write(moderator,moderate(f.parent),at());for(const value of [await repo().get(f.parent.id),await repo().get(child.id),await repo().list(),await repo().outcomes(f.parent.id),await repo().write(actor,f.command,at()),await repo().write(actor,command,at())]){const serialized=JSON.stringify(value);for(const sensitive of ['CONTINUOUS_DEMO','Invented retrospective observations','openPositions','finalStateDigest','projection','initialCapital'])assert(!serialized.includes(sensitive),sensitive);}
 assert.equal((await repo().get(child.id)).item.suppression,'PARENT_UNAVAILABLE');await repo().write(moderator,moderate(f.parent,'VISIBLE'),at());await new StrategyRepository(db).write(moderator,{...moderate(f.selected),policyAccepted:'public-strategy-v1'},at());assert.equal((await repo().get(child.id)).item.suppression,'SOURCE_UNAVAILABLE');assert.equal((await repo().write(actor,command,at())).item.record,null);
 assert((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(child.id).first()).payload.includes('openPositions'));
});

test('v2 request identities stay author-scoped across races, changed methods and lost committed acknowledgments',async()=>{
 const owner=human(),f=await fixture(),raced=await Promise.all([repo().write(owner,f.command,at()),repo().write(owner,f.command,at())]);assert.deepEqual(raced[0],raced[1]);assert.equal(await count(),1);await assert.rejects(()=>repo().write(human(),f.command,at()),status(409));await assert.rejects(()=>repo().write(owner,{...f.command,name:'Different bytes'},at()),status(409));const parent=raced[0].item;await assert.rejects(()=>repo().write(owner,outcome(parent,{kind:'INTERRUPTED',reason:'Separate action.'},{requestId:f.command.requestId}),at()),status(409));
 const next={...f.command,id:uid(),requestId:uid()};let lost=false;const uncertain=new ExperimentRepository(wrapper(null,async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!lost){lost=true;throw Error('Invented lost acknowledgment');}}));const receipt=await uncertain.write(owner,next,at());assert(lost);assert.deepEqual(await repo().write(owner,next,at()),receipt);assert.equal(await count(),2);
});

test('revocation at the actual v2 INSERT fences registration, outcomes and previously committed receipts',async()=>{
 for(const action of ['register','outcome']){const sponsor=human(),a=await agent(sponsor),f=await manifest(a.actor),command=action==='register'?{...f.command,id:uid(),requestId:uid()}:outcome(f.parent,{kind:'ARTIFACT',artifact:f.artifact});let reached=false;
 const racing=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!reached){reached=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());}}));await assert.rejects(()=>racing.write(a.actor,command,at()),status(401));assert(reached);assert.equal(await db.prepare('SELECT id FROM experiment_records WHERE id=?').bind(command.id).first(),null);await assert.rejects(()=>repo().write(a.actor,f.command,at()),status(401));}
});

test('actual SQLite commit time denies a Session publication after a previously authenticated grant expires',async()=>{
 const f=await fixture(),sponsor=human(),a=await agent(sponsor,new Date(Date.now()-86400000+1400).toISOString(),1);let reached=false;
 const delayed=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')){reached=true;const remaining=Date.parse(a.actor.principal.expiresAt)-Date.now()+80;if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}}));await assert.rejects(()=>delayed.write(a.actor,f.command,new Date().toISOString()),status(401));assert(reached);assert.equal(await count(),0);
});

test('batch and continuous submissions race for the same sponsor-pooled final daily registration slot',async()=>{
 const sponsor=human(),a=await agent(sponsor),f=await fixture();for(let n=0;n<4;n++)await repo().write(sponsor,{...f.command,id:uid(),requestId:uid()},at());const input=await demo.syntheticDemoInput({record:f.selected.record,digest:f.selected.digest});input.dataset.bars=input.dataset.bars.slice(0,4);input.signals=[];const batch={action:'register',requestId:uid(),id:uid(),...model.experimentRegisterDefaults(input),policyAccepted};
 const results=await Promise.allSettled([repo().write(a.actor,{...f.command,id:uid(),requestId:uid()},at()),repo().write(sponsor,batch,at())]);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.filter(item=>item.status==='rejected').length,1);assert(results.filter(item=>item.status==='rejected').every(item=>item.reason.status===429&&item.reason.retryAfterSeconds>0));assert.equal(await count('MANIFEST'),5);
});

test('hiding the exact source or parent between validation and INSERT atomically denies v2 material',async()=>{
 const f=await fixture(),moderator=human(true);let hidden=false;const registerRace=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!hidden){hidden=true;await new StrategyRepository(db).write(moderator,{...moderate(f.selected),policyAccepted:'public-strategy-v1'},at());}}));await assert.rejects(()=>registerRace.write(human(),f.command,at()),status(409));assert.equal(await count(),0);
 await new StrategyRepository(db).write(moderator,{...moderate(f.selected,'VISIBLE'),policyAccepted:'public-strategy-v1'},at());const parent=(await repo().write(human(),f.command,at())).item;let suppressed=false;const outcomeRace=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!suppressed){suppressed=true;await repo().write(moderator,moderate(parent),at());}}));await assert.rejects(()=>outcomeRace.write(human(),outcome(parent,{kind:'ARTIFACT',artifact:f.artifact}),at()),status(409));assert.equal(await count('OUTCOME'),0);
});

test('corrupt retained v2 source pins and missing internal parent fail closed as503 without repair',async()=>{
 const f=await manifest(),child=(await repo().write(human(),outcome(f.parent,{kind:'ARTIFACT',artifact:f.artifact}),at())).item,linked=(await repo().write(human(),outcome(f.parent,{kind:'ARTIFACT_UNAVAILABLE',reason:'A linked reconstruction report has no retained artifact.'},{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(child)},sharedDependencies:[],conflicts:''}}),at())).item;
 // Self-consistently rehash both rows so this exercises method integrity, not an old reference digest.
 const foreignMethod=structuredClone(child.record);foreignMethod.version=1;delete foreignMethod.content.method;foreignMethod.content.result={kind:'INTERRUPTED',reason:'A forged batch method under a continuous parent.'};const changed=model.boundedExperimentRecord(foreignMethod),changedDigest=await model.experimentDigest(changed.payload),changedCommand=model.boundedExperimentCommand({action:'outcome',id:changed.record.id,requestId:changed.record.requestId,...changed.record.content,policyAccepted});await db.prepare('UPDATE experiment_records SET payload=?,digest=?,command_digest=? WHERE id=?').bind(changed.payload,changedDigest,await model.experimentDigest(changedCommand.payload),child.id).run();const linkedRecord=structuredClone(linked.record);linkedRecord.content.claim.relation.digest=changedDigest;const linkedPayload=JSON.stringify(linkedRecord),linkedCommand=model.boundedExperimentCommand({action:'outcome',id:linkedRecord.id,requestId:linkedRecord.requestId,...linkedRecord.content,policyAccepted});await db.prepare('UPDATE experiment_records SET payload=?,digest=?,command_digest=? WHERE id=?').bind(linkedPayload,await model.experimentDigest(linkedPayload),await model.experimentDigest(linkedCommand.payload),linked.id).run();await assert.rejects(()=>repo().get(linked.id),status(503));
 const record=structuredClone(f.parent.record);record.content.input.implementation.engine='a'.repeat(64);const payload=JSON.stringify(record),command=model.boundedExperimentCommand({action:'register',id:record.id,requestId:record.requestId,...record.content,policyAccepted});await db.prepare('UPDATE experiment_records SET payload=?,digest=?,command_digest=? WHERE id=?').bind(payload,await model.experimentDigest(payload),await model.experimentDigest(command.payload),record.id).run();await assert.rejects(()=>repo().get(f.parent.id),status(503));assert.equal((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(record.id).first()).payload,payload);
 await db.prepare('DELETE FROM experiment_records WHERE id=?').bind(record.id).run();await assert.rejects(()=>repo().get(child.id),status(503));assert.equal(await count('OUTCOME'),2);
});

test('public byte budgets reject full oversized tape and artifact without truncating or changing an unreported parent',async()=>{
 const f=await manifest(),oversize=structuredClone(f.command);oversize.id=uid();oversize.requestId=uid();const seed=oversize.input.events[0];while(JSON.stringify(oversize.input).length<model.experimentLimits.inputBytes+5000){oversize.input.events.push({...seed,event:{...seed.event,requestId:uid()}});}oversize.input.events.at(-1).stateDigest=oversize.input.finalStateDigest;assert(oversize.input.events.length<2032);await assert.rejects(()=>repo().write(human(),oversize,at()),status(413));
 const artifact=structuredClone(f.artifact),closed=await journal.appendSessionEvent(f.tape,{requestId:uid(),type:'QUOTE',observedAt:later(3),price:90},later(4));assert(closed.state.trades.length);while(JSON.stringify(artifact).length<model.experimentLimits.artifactBytes+5000&&artifact.projection.trades.length<2000)artifact.projection.trades.push({...closed.state.trades[0]});await rehash(artifact);assert(JSON.stringify(artifact).length>model.experimentLimits.artifactBytes);await assert.rejects(()=>repo().write(human(),outcome(f.parent,{kind:'ARTIFACT',artifact}),at()),status(413));assert.equal((await repo().get(f.parent.id)).item.reporting,'UNREPORTED');assert.equal(await count(),1);
});

test('actual Worker accepts digest-only verifier evidence with registered attribution and denies revoked replay',async()=>{
 const sponsor=human(),a=await agent(sponsor),selected=await source(a.actor),f=await fixture({selected});const request=()=>mf.dispatchFetch('https://fixture.test',{method:'POST',body:JSON.stringify({token:a.token,command:f.command,at:at()})});const response=await request();assert.equal(response.status,200);const accepted=await response.json();assert.equal(accepted.item.record.version,2);assert.equal(accepted.item.author.id,a.command.id);assert.equal(accepted.item.record.content.input.config.strategy.record.author.name,'og_agent_researcher');
 await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());const denied=await request();assert.equal(denied.status,401);const body=JSON.stringify(await denied.json());for(const privateValue of [a.token,sponsor.userId,a.actor.principal.tokenDigest])assert(!body.includes(privateValue));assert.equal(await count(),1);
});
