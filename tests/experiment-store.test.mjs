import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=id=>id.startsWith('.')?load(resolve(dirname(file),/\.(?:ts|mjs)$/.test(id)?id:id+'.ts')):native(id);new Function('module','exports','require',code)(m,m.exports,req);return m.exports;}
const model=load('app/experiment-model.ts'),{ExperimentRepository}=load('app/experiment-store.ts'),strategy=load('app/strategy-model.ts'),{StrategyRepository}=load('app/strategy-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts'),demo=load('app/demo-model.ts'),engine=load('app/demo-engine.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-10_000).toISOString(),human=(moderator=false)=>({kind:'HUMAN',userId:uid(),moderator}),policyAccepted='public-experiment-v1';
const ref=item=>({id:item.id,digest:item.digest});
const withdraw=(item,reason='AUTHOR_REQUEST')=>({action:'withdraw',requestId:uid(),...ref(item),reason,policyAccepted});
const moderate=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted});
const report=item=>({action:'report',requestId:uid(),...ref(item),reason:'MISLEADING',details:'Private registry report must never enter public output.',policyAccepted});
const status=code=>error=>error instanceof model.ExperimentError&&error.status===code;
let mf,db;
before(async()=>{
 const source=`import {ExperimentRepository} from './app/experiment-store.ts';import {NetworkRepository} from './app/network-store.ts';export default{async fetch(request,env){const input=await request.json();try{const repo=new ExperimentRepository(env.DB);if(input.read)return Response.json(await repo.get(input.read));const actor=input.token?{kind:'AGENT',principal:await new NetworkRepository(env.DB).authenticate(input.token,input.at)}:{kind:'HUMAN',userId:input.user,moderator:false};return Response.json(await repo.write(actor,input.command,input.at));}catch(error){return Response.json({error:error.message},{status:error.status??503});}}};`;
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 assert(!bundled.outputFiles[0].text.includes('async function replayDemo'));
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['experiment_reports','experiment_moderation','experiment_records','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const repo=()=>new ExperimentRepository(db);
async function source(actor=human(),type='DCA'){const definition=strategy.strategyTemplate(type);if(type==='DCA'){definition.entry.intervalBars=2;definition.entry.maxEntries=3;}const command={action:'publish',requestId:uid(),id:uid(),name:'Public synthetic strategy',description:'Falsifiable exact input source.',definition,assumptions:'Synthetic observations do not establish future returns.',falsification:'Reject if future cost-aware data fail.',sources:[],relation:null,policyAccepted:'public-strategy-v1'};return (await new StrategyRepository(db).write(actor,command,at())).item;}
async function registration(selected,extra={}){selected??=await source();const input=await engine.syntheticDemoInput({record:selected.record,digest:selected.digest});input.dataset.bars=input.dataset.bars.slice(0,36);input.signals=[];const defaults=model.experimentRegisterDefaults(input);return {action:'register',requestId:uid(),id:uid(),...defaults,policyAccepted,...extra};}
async function manifest(actor=human(),command){command??=await registration();return {command,item:(await repo().write(actor,command,at())).item,actor};}
const outcome=(parent,result={kind:'INTERRUPTED',reason:'The local run was interrupted; no metrics reported.'},extra={})=>({action:'outcome',requestId:uid(),id:uid(),name:'Retained trial outcome',manifest:ref(parent),result,claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},policyAccepted,...extra});
async function artifact(parent){return engine.replayDemo(parent.record.content.input);}
async function agent(sponsor,name='Registry agent',registeredAt=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name,tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,registeredAt);const principal=await new NetworkRepository(db).authenticate(generated.token,registeredAt);return {actor:{kind:'AGENT',principal},token:generated.token,command};}
async function count(type){return (await db.prepare('SELECT COUNT(*) AS n FROM experiment_records'+(type?' WHERE type=?':'')).bind(...type?[type]:[]).first()).n;}
function wrapper(beforeRun,afterRun){return {prepare(sql){const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const result=await statement.run();await afterRun?.(sql);return result;}});return wrap(db.prepare(sql));}};}

 test('strict manifests bind public consent, fixed method, full input and reject forged authority and credential text',async()=>{
 const actor=human(),command=await registration();model.boundedExperimentCommand(command);
 for(const extra of [{author:{id:'forged'}},{classification:'REPRODUCED'},{executionEnabled:true},{disclosures:{...command.disclosures,publication:{dataRights:true,publicData:false,publicArtifact:true}}},{name:'og_agent_secret'},{name:'%6fg_agent_secret'},{input:{...command.input,qualification:true}}])await assert.rejects(()=>repo().write(actor,{...command,...extra},at()),status(400));
 await assert.rejects(()=>repo().write(actor,{...command,evaluator:{...command.evaluator,methodDigest:'0'.repeat(64)}},at()),status(400));
 const forged=structuredClone(command);forged.input.strategy.record.content.name='Forged published bytes';forged.input.strategy.digest=await model.experimentDigest(JSON.stringify(forged.input.strategy.record));await assert.rejects(()=>repo().write(actor,forged,at()),status(400));
 const result=await repo().write(actor,command,at());assert.equal(result.item.reporting,'UNREPORTED');assert.equal(result.item.outcomeCount,0);assert.equal(result.item.record.classification,'AUTHOR_REPORTED');assert.equal(result.item.digest,await model.experimentDigest(JSON.stringify(result.item.record)));await model.validateExperimentItem(result.item);assert.equal(await count(),1);
 });

 test('human and sibling agents have distinct immutable authors and shared public sponsor with no private credential leakage',async()=>{
 const sponsor=human(),a=await agent(sponsor,'og_agent_researcher'),b=await agent(sponsor,'Second registry agent'),selected=await source(a.actor),command=await registration(selected),items=[];
 for(const actor of [sponsor,a.actor,b.actor])items.push((await repo().write(actor,{...command,id:uid(),requestId:uid()},at())).item);
 assert.equal(new Set(items.map(item=>item.author.id)).size,3);assert(items.every(item=>item.author.sponsorId===items[0].author.sponsorId));assert.equal(items[1].record.author.name,'og_agent_researcher');assert.equal(items[1].record.content.input.strategy.record.author.name,'og_agent_researcher');
 const serialized=JSON.stringify(await repo().list());for(const privateValue of [sponsor.userId,a.token,b.token,a.actor.principal.tokenDigest,'ownerId','credentialId'])assert(!serialized.includes(privateValue));assert(!serialized.includes('input'));assert(!serialized.includes('dataset'));assert(!serialized.includes('record'));
 });

 test('request races and retries are author-scoped across every action and preserve uncertain committed acknowledgments',async()=>{
 const owner=human(),command=await registration(),raced=await Promise.all([repo().write(owner,command,at()),repo().write(owner,command,at())]);assert.deepEqual(raced[0],raced[1]);assert.equal(await count(),1);
 await assert.rejects(()=>repo().write(owner,{...command,name:'Changed material'},at()),status(409));await assert.rejects(()=>repo().write(human(),command,at()),status(409));
 const first=raced[0].item;for(const raw of [outcome(first,undefined,{requestId:command.requestId}),withdraw(first),report(first)]){raw.requestId=command.requestId;await assert.rejects(()=>repo().write(owner,raw,at()),status(409));}
 const sameRequest=uid(),foreign=human();await repo().write(owner,outcome(first,undefined,{requestId:sameRequest}),at());await repo().write(foreign,outcome(first,undefined,{requestId:sameRequest}),at());assert.equal(await count('OUTCOME'),2);
 const pending=await registration();let lost=false;const uncertain=new ExperimentRepository(wrapper(null,async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!lost){lost=true;throw Error('synthetic lost acknowledgment');}}));const recovered=await uncertain.write(owner,pending,at());assert(lost);assert.equal(recovered.item.id,pending.id);assert.deepEqual(await repo().write(owner,pending,at()),recovered);
 });

 test('valid negative, failed, no-trade, halted and interrupted outcomes append without replacing earlier failures',async()=>{
 const owner=human(),parent=(await manifest(owner)).item,ordinary=await artifact(parent);assert.notEqual(ordinary.status,'REJECTED');
 const failed=structuredClone(ordinary);failed.status='FAILED';failed.reason='NUMERICAL_LIMIT';failed.metrics=null;failed.benchmark=null;failed.resultDigest=await demo.demoArtifactDigest(failed);
 const noTrades=structuredClone(ordinary);noTrades.status='NO_TRADES';noTrades.reason='NO_TRADES';noTrades.trades=[];noTrades.resultDigest=await demo.demoArtifactDigest(noTrades);
 const halted=structuredClone(ordinary);halted.status='HALTED';halted.reason='EMERGENCY_STOP';halted.resultDigest=await demo.demoArtifactDigest(halted);
 for(const result of [{kind:'ARTIFACT',artifact:ordinary},{kind:'ARTIFACT',artifact:failed},{kind:'ARTIFACT',artifact:noTrades},{kind:'ARTIFACT',artifact:halted},{kind:'INTERRUPTED',reason:'Stopped before a report existed.'},{kind:'ARTIFACT_UNAVAILABLE',reason:'The artifact was lost; no metrics claimed.'}])await repo().write(owner,outcome(parent,result),at());
 const updated=(await repo().get(parent.id)).item;assert.equal(updated.reporting,'AUTHOR_REPORTED');assert.equal(updated.outcomeCount,6);assert.equal(updated.digest,parent.digest);assert.deepEqual(updated.record,parent.record);
 const history=await repo().outcomes(parent.id);assert.equal(history.items.length,6);assert(history.items.some(item=>item.status==='FAILED'));assert(history.items.some(item=>item.status==='NO_TRADES'));assert(history.items.every(item=>!('record'in item)&&!('artifact'in item)));assert.equal(await count('OUTCOME'),6);
 // Hash-consistent metrics are author claims. This registry verifies bytes, never reruns the evaluator.
 const changed=structuredClone(ordinary);if(changed.metrics){changed.metrics.returnPct=-50;changed.resultDigest=await demo.demoArtifactDigest(changed);const retained=await repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:changed}),at());assert.equal(retained.item.record.classification,'AUTHOR_REPORTED');assert.equal(retained.item.record.content.result.artifact.metrics.returnPct,-50);}
 });

 test('artifact intake rejects altered digest, mismatched input, method and hidden credential free text without losing manifest',async()=>{
 const {item:parent}=await manifest(),valid=await artifact(parent);const invalid=structuredClone(valid);invalid.resultDigest='0'.repeat(64);await assert.rejects(()=>repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:invalid}),at()),status(400));
 const different=structuredClone(parent.record.content.input);different.initialCapital+=1;const other=await engine.replayDemo(different);await assert.rejects(()=>repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:other}),at()),status(400));
 const method=structuredClone(valid);method.digests.evaluator='f'.repeat(64);method.resultDigest=await demo.demoArtifactDigest(method);await assert.rejects(()=>repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:method}),at()),status(400));
 for(const text of ['og_agent_'+uid()+'.'+'a'.repeat(64),'%6fg_agent_'+uid()+'.'+'a'.repeat(64)]){const leaked=structuredClone(valid);leaked.audit[0].details=text;leaked.resultDigest=await demo.demoArtifactDigest(leaked);await demo.verifyDemoArtifact(leaked);await assert.rejects(()=>repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:leaked}),at()),status(400));}
 const rejected=await engine.replayDemo({});await assert.rejects(()=>repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:rejected}),at()),status(400));assert.equal((await repo().get(parent.id)).item.reporting,'UNREPORTED');assert.equal(await count('OUTCOME'),0);
 });

 test('source, cost, dataset, validation split declaration and seed each change immutable manifest identity',async()=>{
 const {item:first,command}=await manifest();const variants=[];let value=structuredClone(command);value.evaluator.sourceVersion='a different source declaration';variants.push(value);value=structuredClone(command);value.evaluator.sourceDigest='f'.repeat(64);variants.push(value);value=structuredClone(command);value.input.dataset.bars[0].volume+=1;variants.push(value);value=structuredClone(command);value.disclosures.validation.trainEvaluationOverlap='PRESENT';variants.push(value);value=structuredClone(command);value.disclosures.seeds=[99];variants.push(value);
 for(const altered of variants){altered.id=uid();altered.requestId=uid();const next=(await repo().write(human(),altered,at())).item;assert.notEqual(next.digest,first.digest);assert.notEqual(await model.experimentDigest(JSON.stringify(next.record.content)),await model.experimentDigest(JSON.stringify(first.record.content)));}
 const costOwner=human(),costSource=await source(costOwner),before=(await manifest(human(),await registration(costSource))).item,costCmd={action:'publish',requestId:uid(),id:uid(),...costSource.record.content,definition:structuredClone(costSource.record.content.definition),relation:{type:'REVISION',...ref(costSource)},policyAccepted:'public-strategy-v1'};costCmd.definition.costs.feeBps=20;const after=(await new StrategyRepository(db).write(costOwner,costCmd,at())).item,afterCost=(await manifest(human(),await registration(after))).item;assert.equal(before.record.content.input.strategy.record.content.definition.costs.feeBps,10);assert.equal(afterCost.record.content.input.strategy.record.content.definition.costs.feeBps,20);assert.notEqual(before.digest,afterCost.digest);assert.notEqual(await model.experimentDigest(JSON.stringify(before.record.content)),await model.experimentDigest(JSON.stringify(afterCost.record.content)));
 assert.deepEqual((await repo().get(first.id)).item.record,first.record);
 });

 test('declared selection, leakage, reused holdout and conflicts become caution flags without qualification or ranking',async()=>{
 const command=await registration();command.disclosures.search={trialCount:40,selection:'BEST_OBSERVED',logCompleteness:'PARTIAL',log:'Forty selected trials; some failures were not logged.'};command.disclosures.validation={trainEvaluationOverlap:'PRESENT',holdoutDeclared:true,holdoutPriorAccess:'SEEN',holdoutReuseCount:3,note:'Previously inspected sample.'};command.disclosures.conflicts.sharedDependencies=['Same replay implementation'];
 const item=(await repo().write(human(),command,at())).item;for(const flag of ['SOURCE_EXECUTION_UNVERIFIED','TIMING_UNVERIFIED','MULTIPLE_TRIALS','POST_SELECTED','INCOMPLETE_SEARCH_LOG','TRAIN_EVAL_OVERLAP','HOLDOUT_SEEN','HOLDOUT_REUSED','SHARED_DEPENDENCIES'])assert(item.record.flags.includes(flag));assert(!JSON.stringify(item).includes('QUALIFIED'));assert.equal(item.record.classification,'AUTHOR_REPORTED');
 });

 test('any participant may append attributable reproduction/conflict claims referencing exact visible outcomes only',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),parent=(await manifest(a.actor)).item,first=(await repo().write(a.actor,outcome(parent),at())).item;
 const originalForeign=(await repo().write(human(),outcome(parent),at())).item;assert.notEqual(originalForeign.author.id,parent.author.id);assert(!originalForeign.record.flags.includes('SAME_SPONSOR'));
 const own=(await repo().write(b.actor,outcome(parent,undefined,{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(first)},sharedDependencies:['Same evaluator'],conflicts:'Same sponsor'}}),at())).item;assert(own.record.flags.includes('SAME_SPONSOR'));assert(!own.record.flags.includes('SAME_AUTHOR'));assert.equal(own.record.classification,'AUTHOR_REPORTED');
 const conflict=(await repo().write(human(),outcome(parent,undefined,{claim:{type:'CONFLICTING',relation:{type:'CONFLICTS',...ref(first)},sharedDependencies:[],conflicts:'Different author supplied a contrary report.'}}),at())).item;assert.equal(conflict.record.content.claim.type,'CONFLICTING');
 await assert.rejects(()=>repo().write(human(),outcome(parent,undefined,{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',id:first.id,digest:'0'.repeat(64)},sharedDependencies:[],conflicts:''}}),at()),status(404));
 const foreignParent=(await manifest()).item,foreignOutcome=(await repo().write(human(),outcome(foreignParent),at())).item;await assert.rejects(()=>repo().write(human(),outcome(parent,undefined,{claim:{type:'CONFLICTING',relation:{type:'CONFLICTS',...ref(foreignOutcome)},sharedDependencies:[],conflicts:''}}),at()),status(404));
 await repo().write(human(true),moderate(first),at());await assert.rejects(()=>repo().write(human(),outcome(parent,undefined,{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(first)},sharedDependencies:[],conflicts:''}}),at()),status(409));
 });

 test('revocation between authentication and register/outcome/report/withdraw INSERT fences new writes and earlier receipts',async()=>{
 for(const action of ['register','outcome','report','withdraw']){
  const sponsor=human(),a=await agent(sponsor),parent=await manifest(a.actor),command=action==='register'?await registration():action==='outcome'?outcome(parent.item):action==='report'?report(parent.item):withdraw(parent.item);let reached=false;
  const racing=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_')&&!reached){reached=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());}}));
  await assert.rejects(()=>racing.write(a.actor,command,at()),status(401));assert(reached);assert.equal(await db.prepare('SELECT request_id FROM experiment_records WHERE request_id=?').bind(command.requestId).first(),null);await assert.rejects(()=>repo().write(a.actor,parent.command,at()),status(401));assert.equal((await repo().get(parent.item.id)).item.state,'VISIBLE');
 }
 });

 test('SQLite actual commit clock prevents an agent grant held past expiry from publishing',async()=>{
 const sponsor=human(),a=await agent(sponsor,'Expiring registry agent',new Date(Date.now()-86400000+1600).toISOString(),1),command=await registration();let reached=false;
 const delayed=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')){reached=true;const remaining=Date.parse(a.actor.principal.expiresAt)-Date.now()+70;if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}}));await assert.rejects(()=>delayed.write(a.actor,command,new Date().toISOString()),status(401));assert(reached);assert.equal(await count(),0);
 });

 test('source, parent and related-outcome visibility are atomically fenced against concurrent hides',async()=>{
 for(const targetKind of ['SOURCE','PARENT','RELATED']){
  const author=human(),selected=await source(),command=await registration(selected),parent=targetKind==='SOURCE'?null:(await repo().write(author,command,at())).item,related=targetKind==='RELATED'?(await repo().write(author,outcome(parent),at())).item:null,raw=targetKind==='SOURCE'?command:outcome(parent,undefined,related?{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(related)},sharedDependencies:[],conflicts:''}}:{});let reached=false;
  const racing=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!reached){reached=true;if(targetKind==='SOURCE')await new StrategyRepository(db).write(human(true),{...moderate(selected),policyAccepted:'public-strategy-v1'},at());else await repo().write(human(true),moderate(related??parent),at());}}));
  await assert.rejects(()=>racing.write(author,raw,at()),status(409));assert(reached);assert.equal(await db.prepare('SELECT id FROM experiment_records WHERE id=?').bind(raw.id).first(),null);
 }
 });

 test('current source and parent tombstones suppress nested input/artifact/name/status across detail, feeds and retries',async()=>{
 const author=human(),selected=await source(),registrationCommand=await registration(selected,{name:'Sensitive manifest label'}),parent=(await repo().write(author,registrationCommand,at())).item,outcomeCommand=outcome(parent,{kind:'ARTIFACT',artifact:await artifact(parent)},{name:'Sensitive artifact label'}),result=(await repo().write(author,outcomeCommand,at())).item,moderator=human(true);
 await repo().write(moderator,moderate(parent),at());const hidden=(await repo().get(result.id)).item;assert.equal(hidden.suppression,'PARENT_UNAVAILABLE');assert.equal(hidden.record,null);const reads=[await repo().get(parent.id),await repo().get(result.id),await repo().list(),await repo().outcomes(parent.id),await repo().write(author,registrationCommand,at()),await repo().write(author,outcomeCommand,at())];
 for(const value of reads){const json=JSON.stringify(value);for(const secret of ['Sensitive manifest label','Sensitive artifact label','dataset','trades','metrics','Synthetic observations'])assert(!json.includes(secret));}
 assert.equal((await repo().get(parent.id)).item.outcomeCount,1);await repo().write(moderator,moderate(parent,'VISIBLE'),at());assert((await repo().get(result.id)).item.record);
 await new StrategyRepository(db).write(moderator,{...moderate(selected),policyAccepted:'public-strategy-v1'},at());for(const recordId of [parent.id,result.id]){const item=(await repo().get(recordId)).item;assert.equal(item.suppression,'SOURCE_UNAVAILABLE');assert.equal(item.record,null);}assert.equal((await repo().write(author,outcomeCommand,at())).item.record,null);
 assert((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(result.id).first()).payload.includes('Sensitive artifact label'));
 });

 test('withdrawal only author/sponsoring human; terminal slot survives fifteen moderation events; current role required for replay',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),parent=(await manifest(a.actor)).item,moderator=human(true),hide=moderate(parent);await repo().write(moderator,hide,at());await assert.rejects(()=>repo().write({...moderator,moderator:false},hide,at()),status(403));
 for(const actor of [human(),b.actor])await assert.rejects(()=>repo().write(actor,withdraw(parent),at()),status(403));await assert.rejects(()=>repo().write(sponsor,withdraw(parent),at()),status(403));
 for(let n=1;n<15;n++)await repo().write(moderator,moderate(parent,n%2?'VISIBLE':'HIDDEN'),at());await assert.rejects(()=>repo().write(moderator,moderate(parent,'VISIBLE'),at()),status(409));const receipt=await repo().write(sponsor,withdraw(parent,'SPONSOR_REQUEST'),at());assert.equal(receipt.item.state,'WITHDRAWN');assert.equal(receipt.item.moderation.length,16);assert.equal(receipt.item.record,null);await assert.rejects(()=>repo().write(moderator,moderate(parent,'VISIBLE'),at()),status(409));await assert.rejects(()=>repo().write(a.actor,outcome(parent),at()),status(409));
 });

 test('sponsor-pooled registration/outcome daily quotas arbitrate racing final slots; retries do not charge quota',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),selected=await source(),commands=[],actors=[sponsor,a.actor,b.actor];
 for(let n=0;n<4;n++){const command=await registration(selected);commands.push(command);await repo().write(actors[n%3],command,at());}
 const results=await Promise.allSettled(actors.map(async actor=>repo().write(actor,await registration(selected),at())));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert(results.filter(x=>x.status==='rejected').every(x=>x.reason.status===429&&x.reason.retryAfterSeconds>0));assert.equal(await count('MANIFEST'),5);const parent=(await repo().write(sponsor,commands[0],at())).item;
 for(let n=0;n<9;n++)await repo().write(actors[n%3],outcome(parent),at());const outcomes=await Promise.allSettled(actors.map(actor=>repo().write(actor,outcome(parent),at())));assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert(outcomes.filter(x=>x.status==='rejected').every(x=>x.reason.status===429));assert.equal(await count('OUTCOME'),10);
 });

 test('outcome page is bounded, deterministic under equal timestamps and excludes foreign-parent cursors',async()=>{
 const {item:parent}=await manifest(),time=at(),ids=[];for(let n=0;n<25;n++){const command=outcome(parent);ids.push(command.id);await repo().write(human(),command,time);}const first=await repo().outcomes(parent.id);assert.equal(first.items.length,20);assert(first.nextCursor);const second=await repo().outcomes(parent.id,first.nextCursor);assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,25);assert.deepEqual([...first.items,...second.items].map(x=>x.id),ids.sort().reverse());
 const foreign=(await manifest()).item;await assert.rejects(()=>repo().outcomes(foreign.id,first.nextCursor),status(404));await assert.rejects(()=>repo().outcomes(parent.id,'bad'),status(400));await assert.rejects(()=>repo().get(uid()),status(404));
 });

 test('private report pagination retains older evidence without public leakage, arbitrary cursors or role bypass',async()=>{
 const {item:parent}=await manifest(),time=at();for(let n=0;n<25;n++)await repo().write(human(),report(parent),time);const moderator=human(true),first=await repo().reports(moderator,at());assert.equal(first.reports.length,20);assert(first.nextCursor);const second=await repo().reports(moderator,at(),first.nextCursor);assert.equal(second.reports.length,5);assert.equal(new Set([...first.reports,...second.reports].map(x=>x.requestId)).size,25);assert(!JSON.stringify(await repo().get(parent.id)).includes('Private registry report'));assert(!JSON.stringify(await repo().list()).includes('reporter'));
 await assert.rejects(()=>repo().reports(human(),at(),first.nextCursor),status(403));await assert.rejects(()=>repo().reports(moderator,at(),'bad'),status(400));await assert.rejects(()=>repo().reports(moderator,at(),'f'.repeat(64)),status(404));
 await db.prepare('UPDATE experiment_reports SET digest=? WHERE request_id=?').bind('a'.repeat(64),second.reports[0].requestId).run();await assert.rejects(()=>repo().reports(moderator,at(),first.nextCursor),status(503));
 });

 test('corruption or oversized retained rows fail closed without repair or embedded-source disclosure',async()=>{
 const {item:parent}=await manifest();await db.prepare('UPDATE experiment_records SET payload=? WHERE id=?').bind(' '+JSON.stringify(parent.record),parent.id).run();for(const run of [()=>repo().get(parent.id),()=>repo().list()])await assert.rejects(run,status(503));assert((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(parent.id).first()).payload.startsWith(' '));
 await db.prepare('UPDATE experiment_records SET payload=? WHERE id=?').bind(JSON.stringify(parent.record),parent.id).run();await db.prepare('UPDATE strategy_publications SET digest=? WHERE id=?').bind('0'.repeat(64),parent.strategy.id).run();await assert.rejects(()=>repo().get(parent.id),status(503));
 });

 test('registry byte caps are independent of local artifacts and nested RULES manifests remain allowed',async()=>{
 const selected=await source(human(),'RULES'),command=await registration(selected);assert(model.boundedExperimentCommand(command));const {item:parent}=await manifest(human(),command),valid=await artifact(parent),huge=structuredClone(valid);while(JSON.stringify(huge).length<model.experimentLimits.artifactBytes+5000&&huge.audit.length<demo.demoLimits.audit)huge.audit.push({...huge.audit[0],details:'x'.repeat(240)});huge.resultDigest=await demo.demoArtifactDigest(huge);await demo.verifyDemoArtifact(huge);await assert.rejects(()=>repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:huge}),at()),status(413));assert.equal((await repo().get(parent.id)).item.reporting,'UNREPORTED');
 const deep={};let cursor=deep;for(let n=0;n<20;n++)cursor=cursor.next={};assert.throws(()=>model.boundedExperimentCommand(deep),status(400));
 });

 test('actual Worker proves registered bearer attribution with verifier-only writes and revoked replay denied',async()=>{
 const sponsor=human(),a=await agent(sponsor),command=await registration();const response=await mf.dispatchFetch('https://fixture.test',{method:'POST',body:JSON.stringify({token:a.token,command,at:at()})});assert.equal(response.status,200);const accepted=await response.json();assert.equal(accepted.item.author.id,a.command.id);await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());const revoked=await mf.dispatchFetch('https://fixture.test',{method:'POST',body:JSON.stringify({token:a.token,command,at:at()})});assert.equal(revoked.status,401);assert(!JSON.stringify(await revoked.json()).includes(a.token));assert.equal(await count('MANIFEST'),1);
 });

 test('an actual adverse cost-inclusive replay remains an author-reported negative outcome',async()=>{
 const command=await registration();command.input.dataset.bars=command.input.dataset.bars.map((bar,n)=>{const price=100-n;return {...bar,open:price,high:price+.1,low:price-.5,close:price-.2};});const {item:parent}=await manifest(human(),command),result=await artifact(parent);assert(result.metrics&&result.metrics.returnPct<0);const retained=(await repo().write(human(),outcome(parent,{kind:'ARTIFACT',artifact:result}),at())).item;assert.equal(retained.record.content.result.artifact.metrics.returnPct,result.metrics.returnPct);assert.equal(retained.record.classification,'AUTHOR_REPORTED');assert.equal((await repo().get(parent.id)).item.outcomeCount,1);
 });

 test('the thirty-second retained outcome is atomic under races and withdrawal does not free parent capacity',async()=>{
 const {item:parent}=await manifest();for(let n=0;n<31;n++)await repo().write(human(),outcome(parent),at());const results=await Promise.allSettled(Array.from({length:4},()=>repo().write(human(),outcome(parent),at())));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,3);assert.equal((await repo().get(parent.id)).item.outcomeCount,32);const winner=results.find(x=>x.status==='fulfilled').value.item;await repo().write(human(true),moderate(winner),at());await assert.rejects(()=>repo().write(human(),outcome(parent),at()),status(429));assert.equal((await repo().get(parent.id)).item.outcomeCount,32);
 });

 test('retained global manifest capacity is atomic and supplies no fictional reset after hides',async()=>{
 const {item:seed}=await manifest(),template=(await db.prepare('SELECT * FROM experiment_records WHERE id=?').bind(seed.id).first()),statements=[];
 for(let n=0;n<248;n++){const record=structuredClone(seed.record);record.id=uid();record.requestId=uid();record.createdAt=new Date(Date.parse(record.createdAt)-(n+1)*86400000).toISOString();const payload=JSON.stringify(record),command=model.boundedExperimentCommand({action:'register',id:record.id,requestId:record.requestId,...record.content,policyAccepted}),digest=await model.experimentDigest(payload),commandDigest=await model.experimentDigest(command.payload);statements.push(db.prepare('INSERT INTO experiment_records(id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(record.id,'MANIFEST',null,null,template.strategy_id,template.strategy_digest,template.author_key,template.sponsor_key,record.requestId,commandDigest,payload,digest,record.createdAt));}
 for(let n=0;n<statements.length;n+=50)await db.batch(statements.slice(n,n+50));assert.equal(await count('MANIFEST'),249);const selected=(await new StrategyRepository(db).get(seed.strategy.id)).item,commands=await Promise.all(Array.from({length:3},()=>registration(selected))),results=await Promise.allSettled(commands.map(command=>repo().write(human(),command,at())));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const rejected=results.filter(x=>x.status==='rejected');assert.equal(rejected.length,2);assert(rejected.every(x=>x.reason.status===429&&x.reason.retryAfterSeconds===undefined));assert.equal(await count('MANIFEST'),250);await repo().write(human(true),moderate(seed),at());await assert.rejects(async()=>repo().write(human(),await registration(selected),at()),error=>error.status===429&&error.retryAfterSeconds===undefined);assert.equal(await count('MANIFEST'),250);
 });

 test('retained claim links detect parent/digest corruption without requiring a previously linked outcome to remain visible',async()=>{
 const {item:parent}=await manifest(),first=(await repo().write(human(),outcome(parent),at())).item,command=outcome(parent,undefined,{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(first)},sharedDependencies:[],conflicts:''}}),linked=(await repo().write(human(),command,at())).item;await repo().write(human(true),moderate(first),at());assert((await repo().get(linked.id)).item.record);assert((await repo().write(human(),outcome(parent),at())).item.record);
 await db.prepare('UPDATE experiment_records SET digest=? WHERE id=?').bind('f'.repeat(64),first.id).run();await assert.rejects(()=>repo().get(linked.id),status(503));assert.equal(await count('OUTCOME'),3);
 });

 test('self-consistently rehashed invalid related digests and foreign-manifest links remain integrity failures',async()=>{
 const {item:parent}=await manifest(),first=(await repo().write(human(),outcome(parent),at())).item,{item:foreign}=await manifest(),foreignOutcome=(await repo().write(human(),outcome(foreign),at())).item,command=outcome(parent,undefined,{claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(first)},sharedDependencies:[],conflicts:''}}),linked=(await repo().write(human(),command,at())).item;
 for(const relation of [{type:'SUPPORTS',id:first.id,digest:'f'.repeat(64)},{type:'SUPPORTS',...ref(foreignOutcome)}]){
  const record=structuredClone(linked.record);record.content.claim.relation=relation;const payload=JSON.stringify(record),retainedCommand=model.boundedExperimentCommand({action:'outcome',id:record.id,requestId:record.requestId,...record.content,policyAccepted});await db.prepare('UPDATE experiment_records SET payload=?,digest=?,command_digest=? WHERE id=?').bind(payload,await model.experimentDigest(payload),await model.experimentDigest(retainedCommand.payload),record.id).run();await assert.rejects(()=>repo().get(linked.id),status(503));assert.equal((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(linked.id).first()).payload,payload);
 }
 });

 test('unpublished offline or mismatched strategy selection is a definitive rejection; retained missing source stays503',async()=>{
 const offline=await engine.syntheticDemoInput();offline.dataset.bars=offline.dataset.bars.slice(0,36);offline.signals=[];const command={action:'register',requestId:uid(),id:uid(),...model.experimentRegisterDefaults(offline),policyAccepted};await assert.rejects(()=>repo().write(human(),command,at()),status(404));assert.equal(await count(),0);
 const published=await source(),foreign=await source(),valid=await registration(published),mismatched=structuredClone(valid);mismatched.input.strategy.record=foreign.record;await assert.rejects(()=>repo().write(human(),mismatched,at()),status(400));assert.equal(await count(),0);
 const selected=structuredClone(valid);selected.input.strategy.record.id=uid();selected.input.strategy.record.rootId=selected.input.strategy.record.id;selected.input.strategy.digest=await model.experimentDigest(JSON.stringify(selected.input.strategy.record));await assert.rejects(()=>repo().write(human(),selected,at()),status(404));assert.equal(await count(),0);
 const {item:retained}=await manifest(human(),valid);await db.prepare('DELETE FROM strategy_publications WHERE id=?').bind(retained.strategy.id).run();await assert.rejects(()=>repo().get(retained.id),status(503));await assert.rejects(()=>repo().list(),status(503));assert.equal(await count(),1);
 });

 test('retained missing manifest is corruption503 while new unknown-manifest selection remains404',async()=>{
 const actor=human(),{item:parent}=await manifest(),command=outcome(parent),retained=(await repo().write(actor,command,at())).item,unknown=outcome(parent,undefined,{manifest:{id:uid(),digest:parent.digest}});await assert.rejects(()=>repo().write(human(),unknown,at()),status(404));assert.equal(await count('OUTCOME'),1);
 const before=(await db.prepare('SELECT payload,digest FROM experiment_records WHERE id=?').bind(retained.id).first());await db.prepare('DELETE FROM experiment_records WHERE id=?').bind(parent.id).run();await assert.rejects(()=>repo().get(retained.id),status(503));await assert.rejects(()=>repo().write(actor,command,at()),status(503));assert.deepEqual((await db.prepare('SELECT payload,digest FROM experiment_records WHERE id=?').bind(retained.id).first()),before);assert.equal(await count('OUTCOME'),1);
 });
