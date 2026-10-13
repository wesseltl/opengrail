import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {firstOnlyProgram,constantProgram,trapProgram,infiniteProgram,moduleHex,makeProgram,local,iconst} from './helpers/program-fixtures.mjs';

// Actual local D1 and HTTP boundaries; all sources and prices are invented first-party fixtures.
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(m,m.exports,id=>id.startsWith('.')?load(resolve(dirname(file),/\.(?:ts|mjs)$/.test(id)?id:id+'.ts')):native(id));return m.exports;}
const model=load('app/experiment-model.ts'),{ExperimentRepository}=load('app/experiment-store.ts'),{StrategyRepository}=load('app/strategy-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts'),strategy=load('app/strategy-model.ts'),programSource=load('app/program-source-model.ts'),programModel=load('app/program-run-model.ts'),pure=load('app/program-evidence.ts'),run=load('app/program-run.ts'),wasm=load('app/program-wasm.ts'),demo=load('app/demo-engine.ts'),comparisons=load('app/evaluator-comparison.ts'),sourceEvidence=load('app/strategy-evidence-model.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-10000).toISOString(),human=(moderator=false)=>({kind:'HUMAN',userId:uid(),moderator}),policyAccepted='public-experiment-v1',origin='https://program.test';
const ref=item=>({id:item.id,digest:item.digest}),status=code=>error=>error instanceof model.ExperimentError&&error.status===code;
const moderate=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted});
const outcome=(parent,artifact,patch={})=>({action:'outcome',requestId:uid(),id:uid(),method:'PROGRAM_DEMO',name:'Invented retained program result',manifest:ref(parent),result:{kind:'ARTIFACT',artifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:['Same reviewed first-party interpreter'],conflicts:''},policyAccepted,...patch});
let mf,db,bundle;
before(async()=>{
 const source=`import * as h from './app/experiment-http';import {ExperimentRepository} from './app/experiment-store';import {NetworkRepository} from './app/network-store';export default{async fetch(request,env){const repo=()=>new ExperimentRepository(env.DB),identity=()=>new NetworkRepository(env.DB),actor=request.headers.get('X-Fixture-Actor'),url=new URL(request.url);if(url.pathname==='/agent')return h.experimentAgentRequest(request,repo,identity);if(request.method==='POST')return h.experimentHumanRequest(request,actor?{userId:actor}:null,repo,()=>false);return h.experimentPublicRequest(request,repo);}};`;
 const built=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});bundle=built;
 assert(!Object.keys(built.metafile.inputs).some(file=>/(?:program-run|session-(?:engine|journal)|demo-engine|reference-engine|evaluator-comparison)\.ts$/.test(file)),'Public handlers cannot import local execution engines.');
 assert(!/function (?:invokeProgram|createProgramInstance)\(/.test(built.outputFiles[0].text),'Tree-shaken public bundle must not retain guest invocation functions.');
 mf=new Miniflare({modules:true,script:built.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['experiment_reports','experiment_moderation','experiment_records','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>mf?.dispose());
const repo=()=>new ExperimentRepository(db);
async function source(actor=human(),binary=firstOnlyProgram()){
 const definition=strategy.strategyTemplate('SIGNAL');definition.entry={type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:1};const bytesHex=moduleHex(binary);
 return (await new StrategyRepository(db).write(actor,{action:'publish',version:2,requestId:uid(),id:uid(),name:'Invented exact program source',description:'Reviewed fixture bytes and invented observations.',definition,program:{profile:programSource.programProfile,abi:programSource.programAbi,bytesHex,digest:await programSource.programBinaryDigest(bytesHex),parameters:[]},assumptions:'No authentic market feed or unseen data custody.',falsification:'Reject a differing causal trace or omitted adverse attempt.',sources:[],relation:null,policyAccepted:'public-strategy-v1'},at())).item;
}
async function fixture({selected,binary=firstOnlyProgram(),bars=4}={}){
 selected??=await source(human(),binary);const original=await run.syntheticProgramRunInput({record:selected.record,digest:selected.digest});
 const input=await run.prepareProgramRunInput(original.strategy,{...original.dataset,bars:Array.from({length:bars},(_,n)=>({closedAt:new Date(Date.parse(original.dataset.bars[0].closedAt)+n*3600000).toISOString(),open:100,high:100,low:100,close:100,volume:100}))},{...original,requestId:uid()});
 const command={action:'register',requestId:uid(),id:uid(),...model.experimentProgramRegisterDefaults(input,'Invented reviewed local source'),policyAccepted};
 const artifact=await run.runProgramReplay(input,uid());return {selected,input,command,artifact};
}
async function batchFixture(actor=human()){
 const selected=(await new StrategyRepository(db).write(actor,{action:'publish',requestId:uid(),id:uid(),name:'Invented legacy batch source',description:'Legacy no-code fixture.',definition:strategy.strategyTemplate('DCA'),assumptions:'Invented observations only.',falsification:'Reject invalid method binding.',sources:[],relation:null,policyAccepted:'public-strategy-v1'},at())).item;
 const input=await demo.syntheticDemoInput({record:selected.record,digest:selected.digest});input.dataset.bars=input.dataset.bars.slice(0,4);input.signals=[];
 return {selected,input,command:{action:'register',requestId:uid(),id:uid(),...model.experimentRegisterDefaults(input),policyAccepted}};
}
async function manifest(actor=human(),options={}){const f=await fixture(options);return {...f,actor,parent:(await repo().write(actor,f.command,at())).item};}
async function count(type){return (await db.prepare('SELECT COUNT(*) AS n FROM experiment_records'+(type?' WHERE type=?':'')).bind(...type?[type]:[]).first()).n;}
async function agent(sponsor,registeredAt=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name:'Program fixture agent',tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,registeredAt);return {token:generated.token,command,actor:{kind:'AGENT',principal:await new NetworkRepository(db).authenticate(generated.token,registeredAt)}};}
function wrapper(beforeRun,afterRun){return {prepare(sql){const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const value=await statement.run();await afterRun?.(sql);return value;}});return wrap(db.prepare(sql));}};}
async function post(actor,command,headers={}){return mf.dispatchFetch(origin+'/api/experiments',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin,'X-Experiment-Intent':'submit','X-Fixture-Actor':actor.userId,...headers},body:JSON.stringify(command)});}
async function reseal(artifact){const {outcomeDigest,...body}=artifact;void outcomeDigest;return programModel.sealProgramRunOutcome(body);}

test('v3 exact source, full generated evidence and compact program observations survive real D1 and HTTP',async()=>{
 const actor=human(),f=await fixture(),response=await post(actor,f.command);assert.equal(response.status,200,await response.clone().text());const parent=(await response.json()).item;
 assert.equal(parent.record.version,3);assert(model.experimentIsProgramManifest(parent.record));assert.equal(parent.record.content.method,'PROGRAM_DEMO');assert.deepEqual(parent.record.content.input,f.input);assert.equal(parent.strategy.id,f.selected.id);assert.equal(parent.record.content.input.strategy.record.version,2);
 const childResponse=await post(actor,outcome(parent,f.artifact));assert.equal(childResponse.status,200,await childResponse.clone().text());const child=(await childResponse.json()).item;await model.validateExperimentItem(child);assert.deepEqual(child.record.content.result.artifact,f.artifact);assert.notEqual(f.artifact.demoRequest.strategy.record.id,parent.strategy.id);assert(f.artifact.artifact.metrics.netPnl<0);
 const detail=await mf.dispatchFetch(origin+'/api/experiments?id='+child.id);assert.equal(detail.status,200);assert.deepEqual((await detail.json()).item,child);
 const page=await repo().forStrategy(f.selected.id,f.selected.digest),entry=page.items.find(item=>item.summary.id===child.id);assert.equal(entry.summary.method,'PROGRAM_DEMO');assert.equal(entry.observation.kind,'PROGRAM');assert.equal(entry.observation.outcomeDigest,f.artifact.outcomeDigest);assert.equal(entry.observation.generatedSignals,1);assert.equal(entry.observation.qualification,'NONE');assert.equal(entry.observation.generatorIndependence,'NOT_ESTABLISHED');assert(!JSON.stringify(page.items).includes('"trace":'));await sourceEvidence.validateStrategyEvidencePage(page);
 assert.equal((await repo().get(parent.id)).item.reporting,'AUTHOR_REPORTED');assert.equal((await repo().outcomes(parent.id)).items[0].method,'PROGRAM_DEMO');
});

test('pure public verifier neither invokes guest code nor imports executable engines',async()=>{
 const f=await fixture(),invoke=wasm.invokeProgram,replay=demo.replayDemo,compare=comparisons.compareDemoArtifact;let calls=0;const forbidden=()=>{calls++;throw Error('Forbidden execution');};wasm.invokeProgram=forbidden;demo.replayDemo=forbidden;comparisons.compareDemoArtifact=forbidden;
 try{await pure.verifyProgramRunInput(f.input);await pure.validateProgramRunOutcome(f.artifact,f.input);const parent=(await repo().write(human(),f.command,at())).item;await repo().write(human(),outcome(parent,f.artifact),at());}finally{wasm.invokeProgram=invoke;demo.replayDemo=replay;comparisons.compareDemoArtifact=compare;}
 assert.equal(calls,0);assert(!Object.keys(bundle.metafile.inputs).includes('app/program-run.ts'));
});

test('batch, continuous and program command protocols remain distinct and legacy program paths refuse original V2 sources',async()=>{
 const f=await manifest();for(const method of [undefined,'CONTINUOUS_DEMO']){const cmd=outcome(f.parent,null,{result:{kind:'INTERRUPTED',reason:'Wrong declared method.'}});if(method===undefined)delete cmd.method;else cmd.method=method;await assert.rejects(()=>repo().write(human(),cmd,at()),status(400));}
 const legacy={...f.command};delete legacy.method;legacy.baseline='COST_AWARE_LONG_SAME_ALLOCATION_V1';await assert.rejects(()=>repo().write(human(),legacy,at()),status(400));assert.equal(await count('OUTCOME'),0);
 assert.equal(model.experimentMethodVersion({}),1);assert.equal(model.experimentMethodVersion({method:'CONTINUOUS_DEMO'}),2);assert.equal(model.experimentMethodVersion({method:'PROGRAM_DEMO'}),3);assert.throws(()=>model.experimentMethodVersion({method:'invented'}),status(400));
});

test('complete no-trade, trap, fuel, invalid output, cancellation and interruption remain retained adverse author claims',async()=>{
 for(const [binary,expected,reason] of [[constantProgram(0),'NO_TRADES','NONE'],[trapProgram(),'FAILED','PROGRAM_TRAP'],[infiniteProgram(),'FAILED','FUEL_LIMIT'],[constantProgram(3),'FAILED','INVALID_OUTPUT']]){const f=await manifest(human(),{binary});assert.equal(f.artifact.status,expected);assert.equal(f.artifact.reason,reason);const child=(await repo().write(human(),outcome(f.parent,f.artifact),at())).item;assert.deepEqual(child.record.content.result.artifact,f.artifact);assert.equal(child.record.classification,'AUTHOR_REPORTED');}
 const f=await manifest();for(const disposition of ['CANCELLED','INTERRUPTED']){const artifact=await run.interruptProgramRun(f.input,uid(),disposition),child=(await repo().write(human(),outcome(f.parent,artifact),at())).item;assert.equal((await repo().outcomes(f.parent.id)).items.find(item=>item.id===child.id).status,disposition);assert.equal(child.record.content.result.artifact.artifact,null);}
 for(const kind of ['INTERRUPTED','ARTIFACT_UNAVAILABLE'])await repo().write(human(),outcome(f.parent,null,{result:{kind,reason:'Explicit missing complete computation.'}}),at());assert.equal((await repo().get(f.parent.id)).item.outcomeCount,4);
});

test('source, module, method, nine implementation pins and complete input correlations fail without modifying retained manifest',async()=>{
 const f=await manifest();for(const mutate of [v=>v.input.methodDigest='0'.repeat(64),v=>v.evaluator.methodDigest='0'.repeat(64),v=>v.evaluator.implementations.evidenceModel='0'.repeat(64),v=>v.input.strategy.digest='0'.repeat(64),v=>v.input.strategy.record.content.program.digest='0'.repeat(64),v=>v.input.signals=[],v=>v.author={id:'forged'}]){const command=structuredClone(f.command);command.id=uid();command.requestId=uid();mutate(command);await assert.rejects(()=>repo().write(human(),command,at()),status(400));}
 for(const mutate of [v=>v.outcomeDigest='0'.repeat(64),v=>v.implementations.evidenceModel='0'.repeat(64),v=>v.input.initialCapital++,v=>v.trace[0].output=0,v=>v.totalFuel++,v=>{v.demoRequest.strategy.record.id=f.selected.id;v.demoRequest.strategy.record.rootId=f.selected.id;}]){let artifact=structuredClone(f.artifact);mutate(artifact);if(artifact.outcomeDigest!=='0'.repeat(64))artifact=await reseal(artifact);await assert.rejects(()=>repo().write(human(),outcome(f.parent,artifact),at()),status(400));}
 assert.equal(await count(),1);assert.deepEqual((await repo().get(f.parent.id)).item.record,f.parent.record);
});

test('program raw structures reject accessors, symbols and sparse/decorated arrays before schema normalization',async()=>{
 const f=await fixture();let invoked=0;const accessor={...f.command};Object.defineProperty(accessor,'name',{enumerable:true,get(){invoked++;return 'Must not invoke';}});assert.throws(()=>model.boundedExperimentCommand(accessor),status(400));assert.equal(invoked,0);
 for(const mutate of [v=>v[Symbol('authority')]=true,v=>v.input.dataset.bars=[,v.input.dataset.bars[0]],v=>v.input.dataset.bars.extra='hidden',v=>v.input.dataset.bars[0].volume=-0]){const command=structuredClone(f.command);mutate(command);assert.throws(()=>model.boundedExperimentCommand(command));}
 const actor=human(),parent=(await repo().write(actor,f.command,at())).item,record=structuredClone(parent.record);record[Symbol('authority')]=true;assert.throws(()=>model.boundedExperimentRecord(record),status(400));assert.equal(await count(),1);
});

test('a coherently self-hashed false generator claim is retained as author reported and actual re-execution exposes it',async()=>{
 const f=await manifest(),falseClaim=structuredClone(f.artifact);falseClaim.trace[1].output=1;falseClaim.signals.push(await pure.generatedProgramSignal(falseClaim.inputDigest,1,falseClaim.trace[1].closedAt,1));falseClaim.demoRequest=await pure.programDemoProjection(f.input,falseClaim.inputDigest,falseClaim.signals);falseClaim.artifact=await demo.replayDemo(falseClaim.demoRequest);falseClaim.comparison=await comparisons.compareDemoArtifact(falseClaim.artifact);falseClaim.status=falseClaim.artifact.status;const forged=await reseal(falseClaim);await pure.validateProgramRunOutcome(forged,f.input);
 const child=(await repo().write(human(),outcome(f.parent,forged),at())).item;assert.equal(child.record.classification,'AUTHOR_REPORTED');assert.equal(child.record.content.result.artifact.qualification,'NONE');const reproduced=await run.runProgramReplay(f.input,forged.attemptId);assert.notEqual(reproduced.outcomeDigest,forged.outcomeDigest);assert.notDeepEqual(reproduced.trace,forged.trace);assert.notDeepEqual(reproduced.signals,forged.signals);assert.equal(forged.comparison.status,'MATCH');assert.equal(forged.signals.length,2);assert.equal(reproduced.signals.length,1);
});

test('source and parent suppression redact program source, trace, state, method and metrics across reads and identical retry receipts',async()=>{
 const actor=human(),f=await manifest(actor),cmd=outcome(f.parent,f.artifact),child=(await repo().write(actor,cmd,at())).item,moderator=human(true);
 await repo().write(moderator,moderate(f.parent),at());for(const value of [await repo().get(f.parent.id),await repo().get(child.id),await repo().list(),await repo().outcomes(f.parent.id),await repo().write(actor,f.command,at()),await repo().write(actor,cmd,at())]){const text=JSON.stringify(value);for(const sensitive of ['PROGRAM_DEMO','LOCAL_PROGRAM_RUN','bytesHex','trace','globalBits','netPnl'])assert(!text.includes(sensitive),sensitive);}
 const sourcePage=await repo().forStrategy(f.selected.id,f.selected.digest);assert(sourcePage.strategy.record);assert(!JSON.stringify(sourcePage.items).includes('bytesHex'));assert(!JSON.stringify(sourcePage.items).includes('PROGRAM_DEMO'));assert.equal((await repo().get(child.id)).item.suppression,'PARENT_UNAVAILABLE');await repo().write(moderator,moderate(f.parent,'VISIBLE'),at());await new StrategyRepository(db).write(moderator,{...moderate(f.selected),policyAccepted:'public-strategy-v1'},at());assert.equal((await repo().get(child.id)).item.suppression,'SOURCE_UNAVAILABLE');assert.equal((await repo().write(actor,cmd,at())).item.record,null);assert((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(child.id).first()).payload.includes('trace'));
});

test('program uncertain acknowledgments and identical concurrent retries reconcile one immutable author-scoped record',async()=>{
 const actor=human(),f=await fixture(),receipts=await Promise.all([repo().write(actor,f.command,at()),repo().write(actor,f.command,at())]);assert.deepEqual(receipts[0],receipts[1]);assert.equal(await count(),1);await assert.rejects(()=>repo().write(actor,{...f.command,name:'Changed body'},at()),status(409));await assert.rejects(()=>repo().write(human(),f.command,at()),status(409));
 const next={...f.command,id:uid(),requestId:uid()};let lost=false;const uncertain=new ExperimentRepository(wrapper(null,async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!lost){lost=true;throw Error('Invented lost committed acknowledgment');}}));const receipt=await uncertain.write(actor,next,at());assert(lost);assert.deepEqual(await repo().write(actor,next,at()),receipt);assert.equal(await count(),2);
});

test('revocation at actual program INSERT and committed receipt reconstruction denies credential replay',async()=>{
 for(const action of ['register','outcome']){const sponsor=human(),a=await agent(sponsor),f=await fixture(),parent=action==='outcome'?(await repo().write(human(),f.command,at())).item:null,command=parent?outcome(parent,f.artifact):f.command;let revoked=false;const raced=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!revoked){revoked=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());}}));await assert.rejects(()=>raced.write(a.actor,command,at()),status(401));assert.equal(await count(action==='register'?'MANIFEST':'OUTCOME'),action==='register'?0:0);}
 const sponsor=human(),a=await agent(sponsor),f=await fixture(),headers={Authorization:'Bearer '+a.token,'Content-Type':'application/json'},request=()=>mf.dispatchFetch(origin+'/agent',{method:'POST',headers,body:JSON.stringify(f.command)});const response=await request();assert.equal(response.status,200,await response.clone().text());const receipt=await response.json();assert.equal(receipt.item.author.id,a.command.id);await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());const denied=await request();assert.equal(denied.status,401);assert.equal(denied.headers.get('WWW-Authenticate'),'Bearer');const text=await denied.text();assert(!text.includes(a.token));assert(!text.includes(sponsor.userId));
});

test('source and parent hiding between verification and INSERT deny new program material atomically',async()=>{
 const f=await fixture(),moderator=human(true);let changed=false;const raced=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!changed){changed=true;await new StrategyRepository(db).write(moderator,{...moderate(f.selected),policyAccepted:'public-strategy-v1'},at());}}));await assert.rejects(()=>raced.write(human(),f.command,at()),status(409));assert.equal(await count(),0);
 const g=await manifest();changed=false;const parentRace=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')&&!changed){changed=true;await repo().write(moderator,moderate(g.parent),at());}}));await assert.rejects(()=>parentRace.write(human(),outcome(g.parent,g.artifact),at()),status(409));assert.equal(await count('OUTCOME'),0);
});

test('program and batch sources compete for the same sponsor-pooled final daily registration slot',async()=>{
 const sponsor=human(),a=await agent(sponsor),f=await fixture(),batch=await batchFixture();for(let n=0;n<4;n++)await repo().write(sponsor,{...f.command,id:uid(),requestId:uid()},at());const results=await Promise.allSettled([repo().write(sponsor,batch.command,at()),repo().write(a.actor,{...f.command,id:uid(),requestId:uid()},at())]);assert.equal(results.filter(value=>value.status==='fulfilled').length,1);assert(results.filter(value=>value.status==='rejected').every(value=>value.reason.status===429&&value.reason.retryAfterSeconds>0));assert.equal(await count('MANIFEST'),5);
});

test('actual SQLite commit time denies program publication when the previously authenticated grant expires',async()=>{
 const f=await fixture(),sponsor=human(),a=await agent(sponsor,new Date(Date.now()-86400000+1500).toISOString(),1);let reached=false;
 const delayed=new ExperimentRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO experiment_records')){reached=true;const remaining=Date.parse(a.actor.principal.expiresAt)-Date.now()+80;if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}}));await assert.rejects(()=>delayed.write(a.actor,f.command,new Date().toISOString()),status(401));assert(reached);assert.equal(await count(),0);
});

test('the final program outcome capacity is atomic and suppression does not reclaim retained failures',async()=>{
 const f=await manifest(),missing=()=>outcome(f.parent,null,{result:{kind:'ARTIFACT_UNAVAILABLE',reason:'Complete local evidence was unavailable.'}});for(let n=0;n<31;n++)await repo().write(human(),missing(),at());const results=await Promise.allSettled(Array.from({length:3},()=>repo().write(human(),missing(),at())));assert.equal(results.filter(value=>value.status==='fulfilled').length,1);assert(results.filter(value=>value.status==='rejected').every(value=>value.reason.status===429));assert.equal((await repo().get(f.parent.id)).item.outcomeCount,32);const retained=results.find(value=>value.status==='fulfilled').value.item;await repo().write(human(true),moderate(retained),at());await assert.rejects(()=>repo().write(human(),missing(),at()),status(429));assert.equal((await repo().get(f.parent.id)).item.outcomeCount,32);
});

test('the final retained global manifest slot is atomic across PROGRAM and batch protocols without fictional reset',async()=>{
 const f=await manifest(),seed=f.parent,template=await db.prepare('SELECT * FROM experiment_records WHERE id=?').bind(seed.id).first(),statements=[];
 for(let n=0;n<248;n++){const record=structuredClone(seed.record);record.id=uid();record.requestId=uid();record.createdAt=new Date(Date.parse(record.createdAt)-(n+1)*86400000).toISOString();const payload=JSON.stringify(record),command=model.boundedExperimentCommand({action:'register',id:record.id,requestId:record.requestId,...record.content,policyAccepted});statements.push(db.prepare('INSERT INTO experiment_records(id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(record.id,'MANIFEST',null,null,template.strategy_id,template.strategy_digest,template.author_key,template.sponsor_key,record.requestId,await model.experimentDigest(command.payload),payload,await model.experimentDigest(payload),record.createdAt));}
 for(let n=0;n<statements.length;n+=50)await db.batch(statements.slice(n,n+50));const batch=await batchFixture(),commands=[{...f.command,id:uid(),requestId:uid()},batch.command],results=await Promise.allSettled(commands.map(command=>repo().write(human(),command,at())));assert.equal(results.filter(value=>value.status==='fulfilled').length,1);assert(results.filter(value=>value.status==='rejected').every(value=>value.reason.status===429&&value.reason.retryAfterSeconds===undefined));assert.equal(await count('MANIFEST'),250);await repo().write(human(true),moderate(seed),at());await assert.rejects(()=>repo().write(human(),{...f.command,id:uid(),requestId:uid()},at()),error=>error.status===429&&error.retryAfterSeconds===undefined);assert.equal(await count('MANIFEST'),250);
});

test('larger valid local program evidence remains intact after explicit public 413 and no retained outcome is fabricated',async()=>{
 const binary=makeProgram({memory:{initial:1,maximum:1},functions:[{type:0,body:[...local(0),0x45,0x04,0x7f,...iconst(1),0x05,...iconst(0),0x0b]}]}),f=await manifest(human(),{binary,bars:900});const original=JSON.stringify(f.artifact);assert(new TextEncoder().encode(JSON.stringify(f.input)).byteLength<model.experimentLimits.inputBytes);assert(new TextEncoder().encode(original).byteLength>model.experimentLimits.artifactBytes);await pure.validateProgramRunOutcome(f.artifact,f.input);await assert.rejects(()=>repo().write(human(),outcome(f.parent,f.artifact),at()),status(413));const response=await post(human(),outcome(f.parent,f.artifact));assert.equal(response.status,413);assert(!JSON.stringify(await response.json()).includes('trace'));assert.equal(JSON.stringify(f.artifact),original);assert.equal((await repo().get(f.parent.id)).item.reporting,'UNREPORTED');assert.equal(await count('OUTCOME'),0);
});

test('private program reports, corruption and missing parents retain evidence without public leakage or repair',async()=>{
 const f=await manifest(),child=(await repo().write(human(),outcome(f.parent,f.artifact),at())).item;await repo().write(human(),{action:'report',requestId:uid(),...ref(child),reason:'MISLEADING',details:'Private program evidence review note.',policyAccepted},at());assert(!JSON.stringify(await repo().get(child.id)).includes('Private program evidence'));assert(!JSON.stringify(await repo().list()).includes('reporter'));
 await db.prepare('UPDATE experiment_records SET payload=? WHERE id=?').bind(' '+JSON.stringify(child.record),child.id).run();await assert.rejects(()=>repo().get(child.id),status(503));assert((await db.prepare('SELECT payload FROM experiment_records WHERE id=?').bind(child.id).first()).payload.startsWith(' '));await db.prepare('UPDATE experiment_records SET payload=? WHERE id=?').bind(JSON.stringify(child.record),child.id).run();await db.prepare('DELETE FROM experiment_records WHERE id=?').bind(f.parent.id).run();await assert.rejects(()=>repo().get(child.id),status(503));assert.equal(await count('OUTCOME'),1);
});

test('actual HTTP refuses authored authority, wrong human binding and malformed commands without echoing credentials',async()=>{
 const actor=human(),f=await fixture();for(const command of [{...f.command,author:{id:'forged'}},{...f.command,input:{...f.input,signals:[]}},{...f.command,evaluator:{...f.command.evaluator,version:'invented'}}]){const response=await post(actor,command);assert.equal(response.status,400);assert(!JSON.stringify(await response.json()).includes('bytesHex'));}
 const response=await post(actor,f.command,{'X-Experiment-Author':'human_'+'0'.repeat(64)});assert.equal(response.status,403);assert.equal(await count(),0);
});
