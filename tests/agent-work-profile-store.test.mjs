import {firstOnlyProgram,moduleHex} from './helpers/program-fixtures.mjs';
import {programSessionFixture} from './program-session-fixtures.mjs';
import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(m,m.exports,id=>id.startsWith('.')?load(resolve(dirname(file),/\.(?:ts|mjs)$/.test(id)?id:id+'.ts')):native(id));return m.exports;}

const rm=load('app/experiment-review-model.ts'),em=load('app/experiment-model.ts'),sm=load('app/strategy-model.ts'),demo=load('app/demo-model.ts'),engine=load('app/demo-engine.ts'),comparison=load('app/evaluator-comparison.ts');
const {ExperimentReviewRepository}=load('app/experiment-review-store.ts'),{ExperimentRepository}=load('app/experiment-store.ts'),{StrategyRepository}=load('app/strategy-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const programRun=load('app/program-run.ts'),programSource=load('app/program-source-model.ts'),programModel=load('app/program-run-model.ts'),programComparison=load('app/program-comparison.ts');
const journalModel=load('app/program-session-journal.ts'),forwardEvidence=load('app/program-forward-evidence-model.ts'),forwardLocal=load('app/program-forward-evidence.ts');
const uid=()=>crypto.randomUUID(),at=new Date(Date.now()-10000).toISOString(),origin='https://work.test',ep='public-experiment-v1',rp='public-experiment-review-v1';
const human=(id=uid(),reviewer=false,moderator=false)=>({kind:'HUMAN',userId:id,reviewer,moderator}),ref=item=>({id:item.id,digest:item.digest});
const reviewer=()=>human('fixture-reviewer',true),moderator=()=>human('fixture-moderator',false,true);
const worker=`import {agentWorkProfileRequest} from './app/agent-work-profile-http';import {ExperimentReviewRepository} from './app/experiment-review-store';export default{fetch(request,env){return agentWorkProfileRequest(request,()=>new ExperimentReviewRepository(env.DB));}};`;
let mf,db;
before(async()=>{const bundle=await build({stdin:{contents:worker,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});for(const forbidden of ['async function replayDemo','function referenceReplay','function compareDemoArtifact'])assert(!bundle.outputFiles[0].text.includes(forbidden));mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
beforeEach(async()=>{for(const table of ['experiment_review_reports','experiment_review_moderation','experiment_reviews','experiment_reports','experiment_moderation','experiment_records','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf?.dispose());
const repo=database=>new ExperimentReviewRepository(database??db),old=()=>new ExperimentRepository(db);
const command=(f,extra={})=>({action:'review',requestId:uid(),id:uid(),target:{original:ref(f.original),reproduction:ref(f.reproduction),manifest:ref(f.manifest),strategy:ref(f.strategy)},previous:null,decision:'REPRODUCED',reasons:['COMPUTATION_MATCH'],evidence:f.evidence,attestations:{fixedCode:true,exactInputs:true,inspectedDifferences:true,separateOriginalAndReproductionProcesses:true},sharedDependencies:[...rm.experimentReviewSharedDependencies],otherConflicts:'Synthetic participants share this test operator; no actual independence.',note:'Synthetic human computational attestation.',policyAccepted:rp,...extra});
const hide=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted:rp});
const withdraw=item=>({action:'withdraw',requestId:uid(),...ref(item),reason:'AUTHOR_REQUEST',policyAccepted:rp});
const get=id=>mf.dispatchFetch(origin+'/api/reputation/agents?id='+id);
async function agent(owner=uid()){const key=await createNetworkToken();const cmd={action:'register',requestId:uid(),id:uid(),credentialId:key.credentialId,name:'Synthetic work agent',tokenDigest:key.tokenDigest,days:7};await new NetworkRepository(db).write(owner,cmd,at);return {...key,owner,registered:cmd,actor:{kind:'AGENT',principal:await new NetworkRepository(db).authenticate(key.token,at)}};}
function instrument({beforeFirst,beforeAll,afterAll}={}){const calls=[];return {calls,prepare(sql){const statement=db.prepare(sql);function bound(values=[]){return {bind(...args){return bound(args)},async first(...args){calls.push({sql,values});if(beforeFirst)await beforeFirst(sql,values);return statement.bind(...values).first(...args)},async all(...args){calls.push({sql,values});if(beforeAll)await beforeAll(sql,values);const result=await statement.bind(...values).all(...args);if(afterAll)await afterAll(sql,values);return result},async run(){throw Error('Profile reads must not write.')}}}return bound()}};}
async function fixture(options={}){
 const owner=human(),definition=sm.strategyTemplate('DCA');definition.entry.intervalBars=2;definition.entry.maxEntries=3;
 const strategy=(await new StrategyRepository(db).write(owner,{action:'publish',requestId:uid(),id:uid(),name:'Synthetic review source',description:'Invented observations only.',definition,assumptions:'No authentic prices or future return evidence.',falsification:'Reject economic interpretation of synthetic tests.',sources:[],relation:null,policyAccepted:'public-strategy-v1'},at)).item;
 const input=await engine.syntheticDemoInput({record:strategy.record,digest:strategy.digest});input.dataset.bars=input.dataset.bars.slice(0,36);input.signals=[];if(options.flat)input.dataset.bars=input.dataset.bars.map(bar=>({...bar,open:100,high:100,low:100,close:100}));
 const defaults=em.experimentRegisterDefaults(input);defaults.disclosures.search={trialCount:1,selection:'FIRST_DECLARED',logCompleteness:'COMPLETE',log:'Only the declared invented fixture was evaluated.'};defaults.disclosures.validation={trainEvaluationOverlap:'NONE',holdoutDeclared:true,holdoutPriorAccess:'UNSEEN',holdoutReuseCount:0,note:'Synthetic declaration; not actual unseen data.'};if(options.biased){defaults.disclosures.search.selection='BEST_OBSERVED';defaults.disclosures.validation.holdoutReuseCount=2;}
 const manifestOwner=human(),registration={action:'register',requestId:uid(),id:uid(),...defaults,policyAccepted:ep},manifest=(await old().write(manifestOwner,registration,at)).item,originalOwner=human(),reproductionOwner=options.agent??(options.sameSponsor?originalOwner:human());
 const artifact=await engine.replayDemo(input),second=await engine.replayDemo(input);if(options.falseClaim){second.metrics.returnPct+=99;second.resultDigest=await demo.demoArtifactDigest(second);}
 const originalCommand={action:'outcome',requestId:uid(),id:uid(),name:'Synthetic original result',manifest:ref(manifest),result:{kind:'ARTIFACT',artifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},policyAccepted:ep},original=(await old().write(originalOwner,originalCommand,at)).item;
 const reproductionCommand={...originalCommand,requestId:uid(),id:uid(),name:'Synthetic second result',result:{kind:'ARTIFACT',artifact:second},claim:{type:options.falseClaim?'CONFLICTING':'REPRODUCTION',relation:{type:options.falseClaim?'CONFLICTS':'SUPPORTS',...ref(original)},sharedDependencies:[],conflicts:''}},reproduction=(await old().write(reproductionOwner,reproductionCommand,at)).item;
 const evidence={original:await comparison.compareDemoArtifact(artifact),reproduction:await comparison.compareDemoArtifact(second)};
 return {strategy,manifest,original,reproduction,evidence,artifact,second,owner,manifestOwner,originalOwner,reproductionOwner,registration,originalCommand,reproductionCommand};
}

async function programFixture({falseFuel=false,falseReproduction=false,cloneOriginal=false,agentActor}={}){
 const owner=human(),definition=sm.strategyTemplate('SIGNAL'),bytesHex=moduleHex(firstOnlyProgram());definition.entry={type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:1};
 const strategy=(await new StrategyRepository(db).write(owner,{action:'publish',version:2,requestId:uid(),id:uid(),name:'Invented public program review source',description:'Reviewed first-party binary and invented prices.',definition,program:{profile:programSource.programProfile,abi:programSource.programAbi,bytesHex,digest:await programSource.programBinaryDigest(bytesHex),parameters:[]},assumptions:'No authentic feed or unseen custody.',falsification:'Reject differing generator evidence.',sources:[],relation:null,policyAccepted:'public-strategy-v1'},at)).item;
 const base=await programRun.syntheticProgramRunInput({record:strategy.record,digest:strategy.digest}),input=await programRun.prepareProgramRunInput(base.strategy,{...base.dataset,bars:base.dataset.bars.slice(0,4).map(bar=>({...bar,open:100,high:100,low:100,close:100}))},{...base,requestId:uid()}),defaults=em.experimentProgramRegisterDefaults(input,'Reviewed first-party generator');
 defaults.disclosures.search={trialCount:1,selection:'FIRST_DECLARED',logCompleteness:'COMPLETE',log:'One invented admitted test; actual search completeness is unestablished.'};defaults.disclosures.validation={trainEvaluationOverlap:'NONE',holdoutDeclared:true,holdoutPriorAccess:'UNSEEN',holdoutReuseCount:0,note:'Synthetic declaration; actual unseen custody unproved.'};
 const manifestOwner=human(),registration={action:'register',requestId:uid(),id:uid(),...defaults,policyAccepted:ep},manifest=(await old().write(manifestOwner,registration,at)).item,originalOwner=human(),reproductionOwner=agentActor??human(),artifact=await programRun.runProgramReplay(input,uid());let second=await programRun.runProgramReplay(input,uid());
 if(cloneOriginal)second=structuredClone(artifact);
 if(falseFuel){second.trace[0].fuelUsed++;second.totalFuel++;const {outcomeDigest,...body}=second;void outcomeDigest;second=await programModel.sealProgramRunOutcome(body);}
 const originalCommand={action:'outcome',method:'PROGRAM_DEMO',requestId:uid(),id:uid(),name:'Invented program original',manifest:ref(manifest),result:{kind:'ARTIFACT',artifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},policyAccepted:ep},original=(await old().write(originalOwner,originalCommand,at)).item;
 const conflicting=falseFuel&&!falseReproduction,reproductionCommand={...originalCommand,requestId:uid(),id:uid(),name:'Invented separate program reproduction',result:{kind:'ARTIFACT',artifact:second},claim:{type:conflicting?'CONFLICTING':'REPRODUCTION',relation:{type:conflicting?'CONFLICTS':'SUPPORTS',...ref(original)},sharedDependencies:[],conflicts:''}},reproduction=(await old().write(reproductionOwner,reproductionCommand,at)).item,evidence={method:'PROGRAM_DEMO',original:(await programComparison.compareProgramOutcome(artifact)).report,reproduction:(await programComparison.compareProgramOutcome(second)).report};
 return {strategy,manifest,original,reproduction,evidence,artifact,second,owner,manifestOwner,originalOwner,reproductionOwner,registration,originalCommand,reproductionCommand};
}
async function source(record,actor=human()){const original=sm.strategyPublishCommandForRecord(record);return (await new StrategyRepository(db).write(actor,{...original,id:uid(),requestId:uid()},'2025-01-01T00:00:00.000Z')).item;}
async function unplanned(){const f=await programSessionFixture(),selected=await source(f.config.strategy.record),config={...f.config,sessionId:uid(),strategy:{record:selected.record,digest:selected.digest}};let journal=await journalModel.createProgramSessionJournal(config,f.startedAt);const step=async(event,receivedAt,completedAt=receivedAt)=>journal=await journalModel.executeProgramSessionPending(await journalModel.admitProgramSessionEvent(journal,event,receivedAt),{clock:()=>completedAt});for(const row of f.events.slice(0,2))await step({...row.event,requestId:uid()},row.receivedAt,row.completedAt);let quoteAt=new Date(Date.parse(f.events[1].completedAt)+1000).toISOString();await step({requestId:uid(),type:'QUOTE',observedAt:quoteAt,price:99},quoteAt);quoteAt=new Date(Date.parse(quoteAt)+1000).toISOString();await step({requestId:uid(),type:'QUOTE',observedAt:quoteAt,price:103},quoteAt);assert(journal.trading.state.trades[0].netPnl<0);return {f,selected,config,journal,artifact:await forwardEvidence.snapshotProgramForwardEvidence(journal),sources:[selected]};}
// Native synthetic canonical rows let capacity and invalid-binding cases avoid
// publication quotas. They are never public write-authority or execution proof.
async function retainedReviews(f,count,{previous=null,author,createdAt=at,extra={},heldHead=false}={}){
 const items=[],statements=[];let head=previous;
 for(let n=0;n<count;n++){
  const id=await em.experimentPublicHumanId(uid()),reviewAuthor=author??{kind:'HUMAN',id,sponsorId:id},sequence=(head?.sequence??head?.record?.sequence??0)+1;
  const sent=rm.boundedExperimentReviewCommand(command(f,{previous:head?ref(head):null,...heldHead&&n===count-1?{decision:'HELD',reasons:['INCOMPLETE_EVIDENCE'],evidence:null}:{},...extra})).command;
  const {record,payload}=rm.boundedExperimentReviewRecord({version:1,id:sent.id,requestId:sent.requestId,createdAt,author:reviewAuthor,sequence,content:rm.experimentReviewContent(sent),policyAccepted:rp,classification:'REVIEW_ATTESTATION',executionAssurance:'TRUSTED_HUMAN_ATTESTATION',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false});
  head={id:record.id,digest:await em.experimentDigest(payload),sequence,record};items.push(head);
  statements.push(db.prepare('INSERT INTO experiment_reviews(id,original_id,original_digest,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(record.id,f.original.id,f.original.digest,sequence,'HUMAN:'+record.author.id,record.author.sponsorId,record.requestId,await em.experimentDigest(rm.boundedExperimentReviewCommand(sent).payload),payload,head.digest,createdAt));
 }
 for(let offset=0;offset<statements.length;offset+=50)await db.batch(statements.slice(offset,offset+50));return items;
}
async function rewriteRetainedReview(item,mutate){
 const row=await db.prepare('SELECT payload FROM experiment_reviews WHERE id=?').bind(item.id).first(),raw=JSON.parse(row.payload);await mutate(raw);
 const {record,payload}=rm.boundedExperimentReviewRecord(raw),digest=await em.experimentDigest(payload),commandDigest=await em.experimentDigest(rm.boundedExperimentReviewCommand(rm.experimentReviewCommandForRecord(record)).payload);
 await db.prepare('UPDATE experiment_reviews SET payload=?,digest=?,command_digest=?,author_key=?,sponsor_key=?,created_at=? WHERE id=?').bind(payload,digest,commandDigest,'HUMAN:'+record.author.id,record.author.sponsorId,record.createdAt,record.id).run();return {id:record.id,digest,sequence:record.sequence,record};
}
function assertOwnedGraph(value,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert(Object.isFrozen(value));
 for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){assert('value'in descriptor);assertOwnedGraph(descriptor.value,seen);}
}
test('actual public Worker returns one exact synthetic human-attested reproduction, including a fee-bearing loss',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor,flat:true});assert(f.artifact.metrics.returnPct<0);
 const review=(await repo().write(reviewer(),command(f),at)).item;
 const response=await get(a.registered.id);assert.equal(response.status,200,await response.clone().text());assert.match(response.headers.get('Cache-Control'),/no-store/);
 const profile=await response.json();assert.equal(profile.subject.id,a.registered.id);assert.equal(profile.counts.attested,1);assert.equal(profile.units[0].status,'ATTESTED');assert.deepEqual(profile.units[0].currentHead,{...ref(review),sequence:1});
 assert.equal(profile.qualification,'NONE');assert.equal(profile.independence,'NOT_ESTABLISHED');assert.equal(profile.ordersEnabled,false);assert.equal(profile.executionEnabled,false);assert(!JSON.stringify(profile).includes('returnPct'));assert(!JSON.stringify(profile).includes(a.owner));assert(!JSON.stringify(profile).includes(a.token));
 assert.equal((await old().get(f.reproduction.id)).item.record.classification,'AUTHOR_REPORTED');
});
test('publication, profitable self reports and private registry enrollment do not manufacture a public work profile',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});const unknown=await get(uid()),privateOnly=await get(a.registered.id);assert.equal(unknown.status,404);assert.equal(privateOnly.status,404);assert.deepEqual(await unknown.json(),await privateOnly.json());
 const shared=await fixture({agent:a.actor});await assert.rejects(()=>repo().write(human(a.owner,true),command(shared),at),error=>error.status===400);
 assert.equal((await get(a.registered.id)).status,404);assert.equal((await old().get(f.reproduction.id)).item.state,'VISIBLE');
});
test('identical retry and additional favorable reviews count the exact original only once',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),sent=command(f),first=(await repo().write(reviewer(),sent,at)).item;
 await repo().write(reviewer(),sent,at);const second=(await repo().write(reviewer(),command(f,{previous:ref(first)}),at)).item;
 const profile=await repo().workProfile(a.registered.id);assert.equal(profile.counts.total,1);assert.equal(profile.counts.attested,1);assert.equal(profile.units[0].history.length,2);assert.equal(profile.units[0].currentHead.id,second.id);
});
test('profile binding reuse owns complete graphs before validation and refuses mutations through shared aliases',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item,repository=repo(),initial=repository.bindings,experiment=repository.experiment,seen=new WeakSet();let reused=false,sourceChecked=false;
 repository.experiment=async function(reference,scope){const result=await experiment.call(this,reference,scope);assertOwnedGraph(result);assert.equal(result.full.record,result.record);assert.equal(Reflect.set(result.row,'author_key','HUMAN:forged'),false);assert.equal(Reflect.set(result.full.author,'sponsorId','human_'+'f'.repeat(64)),false);sourceChecked=true;return result;};
 repository.bindings=async function(record,scope){
  const checked=scope.profileBindings.checked.get(record);assert(checked);assertOwnedGraph(record);assertOwnedGraph(checked);assert.equal(Reflect.set(record.author,'sponsorId',f.original.author.sponsorId),false);assert.equal(Reflect.set(record.content.target.original,'digest','f'.repeat(64)),false);
  const repeat=seen.has(record);seen.add(record);const result=await initial.call(this,record,scope);assertOwnedGraph(result);assert.equal(result.reproduction.record,result.reproduction.full.record);assert.equal(result.dependencies[0],result.strategy);
  assert.equal(Reflect.set(result.reproduction.full.record.content.claim.relation,'digest','f'.repeat(64)),false);assert.equal(Reflect.set(result.manifest.record.content.input.strategy.record.author,'sponsorId','human_'+'f'.repeat(64)),false);assert.equal(Reflect.set(result.dependencies,'0',null),false);assert.equal(Reflect.set(result.strategy.full.record.content,'name','forged'),false);
  if(repeat){assert.equal(scope.profileBindings.results.get(record).result,result);const unowned=structuredClone(record);unowned.author={...f.original.author};await assert.rejects(()=>initial.call(this,unowned,scope),error=>error.status===400);reused=true;}return result;
 };
 const profile=await repository.workProfile(a.registered.id);assert(sourceChecked);assert(reused);assert.equal(profile.counts.attested,1);assert.equal(profile.units[0].currentHead.id,review.id);assert.deepEqual(profile.units[0].history.map(entry=>entry.review.id),[review.id]);
});
for(const source of ['original','reproduction','manifest','strategy','dependency'])for(const operation of ['remove','replace'])test(`profile memo hit rejects retained ${source} row ${operation} without source SQL fallback`,async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});await repo().write(reviewer(),command(f),at);assert.equal((await repo().workProfile(a.registered.id)).counts.attested,1);
 const traced=instrument(),repository=repo(traced),initial=repository.bindings,seen=new WeakSet();let changed=false;
 repository.bindings=async function(record,scope){
  if(seen.has(record)&&!changed){const cached=scope.profileBindings.results.get(record);assert(cached);const result=cached.result,selected=source==='dependency'?result.dependencies[0]:result[source],map=source==='strategy'||source==='dependency'?scope.strategyRows:scope.experimentRows;
   assert.equal(map.get(selected.row.id),selected.row);if(operation==='remove')map.delete(selected.row.id);else map.set(selected.row.id,{...selected.row});changed=true;
  }
  seen.add(record);return initial.call(this,record,scope);
 };
 await assert.rejects(()=>repository.workProfile(a.registered.id),error=>error.status===503);assert(changed);assert.equal(traced.calls.length,12);assert(!traced.calls.some(call=>/^SELECT .* FROM (?:experiment_records|strategy_publications) WHERE id=\?/.test(call.sql)));assert(!traced.calls.some(call=>call.sql.startsWith('WITH expected_0')));
});
for(const variant of ['reviewer','time','decision'])test(`reviews sharing targets still validate a distinct ${variant}`,async()=>{
 const a=await agent(),f=await fixture({agent:a.actor,biased:variant==='decision'}),first=(await repo().write(reviewer(),command(f,{id:'00000000-0000-4000-8000-000000000001',...variant==='decision'?{decision:'HELD',reasons:['INCOMPLETE_EVIDENCE'],evidence:null}:{}}),at)).item;
 const positive=await repo().workProfile(a.registered.id);assert.equal(positive.counts.total,1);assert.equal(positive.units[0].status,variant==='decision'?'HELD':'ATTESTED');
 const [bad]=await retainedReviews(f,1,{previous:first,extra:{id:'ffffffff-ffff-4fff-bfff-ffffffffffff'},...variant==='reviewer'?{author:f.original.author}:variant==='time'?{createdAt:new Date(Date.parse(at)-1000).toISOString()}:{} });
 const repository=repo(),initial=repository.bindings;let rejectedBinding=false;
 repository.bindings=async function(record,scope){if(record.id===bad.id)assert([...scope.profileBindings.results.keys()].some(key=>key.id===first.id));try{return await initial.call(this,record,scope);}catch(error){if(record.id===bad.id)rejectedBinding=true;throw error;}};
 await assert.rejects(()=>repository.workProfile(a.registered.id),error=>error.status===503);assert(rejectedBinding);
});
test('unrelated adverse history with rehashed contradictory reports still rejects the whole profile',async()=>{
 const a=await agent(),selected=await fixture({agent:a.actor}),background=await fixture();await repo().write(reviewer(),command(selected),at);
 const adverse=(await repo().write(reviewer(),command(background,{decision:'HELD',reasons:['INCOMPLETE_EVIDENCE']}),at)).item;
 assert.equal((await repo().workProfile(a.registered.id)).counts.attested,1);
 await rewriteRetainedReview(adverse,async record=>{const report=record.content.evidence.original;report.summaries.claimed.metrics.returnPct++;const {reportDigest,...body}=report;void reportDigest;report.reportDigest=await em.experimentDigest(JSON.stringify(body));});
 await assert.rejects(()=>repo().workProfile(a.registered.id),error=>error.status===503);
});
test('a second profile call on the same repository freshly detects changed database bytes',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item,repository=repo();assert.equal((await repository.workProfile(a.registered.id)).counts.attested,1);
 const row=await db.prepare('SELECT payload FROM experiment_reviews WHERE id=?').bind(review.id).first(),changed=row.payload.replace('Synthetic human computational attestation.','Synthetic false computational attestation.');assert.equal(changed.length,row.payload.length);assert.notEqual(changed,row.payload);
 await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind(changed,review.id).run();await assert.rejects(()=>repository.workProfile(a.registered.id),error=>error.status===503);
});
test('profile result memo capacity keeps complete histories and fully validates uncached projections',async()=>{
 const a=await agent(),histories=[];
 for(let n=0;n<5;n++){const f=await fixture({agent:a.actor}),items=await retainedReviews(f,29,{heldHead:n%2===0});histories.push({f,items});}
 const positive=repo(),positiveBindings=positive.bindings;let retained=0;
 positive.bindings=async function(record,scope){const result=await positiveBindings.call(this,record,scope);retained=Math.max(retained,scope.profileBindings.results.size);return result;};
 const profile=await positive.workProfile(a.registered.id);assert.equal(retained,rm.experimentReviewLimits.verificationMemoEntries);assert.equal(profile.counts.total,5);assert.equal(profile.counts.attested,2);assert.equal(profile.counts.held,3);
 for(const {f,items}of histories){const unit=profile.units.find(unit=>unit.original.id===f.original.id);assert(unit);assert.deepEqual(unit.history.map(entry=>entry.review.id),items.map(item=>item.id));assert.equal(unit.currentHead.id,items.at(-1).id);}
 const traced=instrument(),repository=repo(traced),initial=repository.bindings,experiment=repository.experiment,seen=new WeakSet();let fallback=null,changed=false;
 repository.bindings=async function(record,scope){const repeat=seen.has(record);seen.add(record);if(repeat&&!scope.profileBindings.results.has(record)&&!changed)fallback=record;try{return await initial.call(this,record,scope);}finally{fallback=null;}};
 repository.experiment=async function(reference,scope){const result=await experiment.call(this,reference,scope);if(fallback&&reference.id===fallback.content.target.reproduction.id&&!changed){assert.equal(scope.profileBindings.results.size,rm.experimentReviewLimits.verificationMemoEntries);const corrupt=structuredClone(result);assert.equal(corrupt.record,corrupt.full.record);corrupt.record.content.claim.relation.digest='f'.repeat(64);changed=true;return corrupt;}return result;};
 // The existing full validators reject the injected derived graph directly;
 // check() translates their failures when reading native canonical rows.
 await assert.rejects(()=>repository.workProfile(a.registered.id),error=>[400,503].includes(error.status));assert(changed);assert.equal(traced.calls.length,12);assert(!traced.calls.some(call=>call.sql.startsWith('WITH expected_0')));
});
test('ownership traversal exhaustion disables memo admission and keeps full validation without refusing valid work',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});await repo().write(reviewer(),command(f),at);const expected=await repo().workProfile(a.registered.id,at);
 const bounded=corruptProjection=>{
  const repository=repo(),initial=repository.bindings,strategy=repository.strategy,experiment=repository.experiment,seen=new WeakSet();let framed=false,projecting=false,disabled=false,changed=false;
  repository.strategy=async function(reference,scope){const result=await strategy.call(this,reference,scope);if(!framed){let framing={};for(let n=0;n<70;n++)framing={child:framing};framed=true;return {...result,ownedTestFraming:framing};}return result;};
  repository.bindings=async function(record,scope){projecting=seen.has(record);seen.add(record);try{const result=await initial.call(this,record,scope);assert.equal(scope.profileBindings.enabled,false);assert.equal(scope.profileBindings.results.size,0);disabled=true;return result;}finally{projecting=false;}};
  repository.experiment=async function(reference,scope){const result=await experiment.call(this,reference,scope);if(corruptProjection&&projecting&&reference.id===f.reproduction.id){const corrupt=structuredClone(result);corrupt.record.content.claim.relation.digest='f'.repeat(64);changed=true;return corrupt;}return result;};
  return {repository,observed:()=>({disabled,changed})};
 };
 const positive=bounded(false);assert.deepEqual(await positive.repository.workProfile(a.registered.id,at),expected);assert(positive.observed().disabled);
 const negative=bounded(true);await assert.rejects(()=>negative.repository.workProfile(a.registered.id,at),error=>[400,503].includes(error.status));assert(negative.observed().disabled);assert(negative.observed().changed);
});
test('later adverse heads remove current endorsement, retained history stays visible and hidden heads never fall back',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),first=(await repo().write(reviewer(),command(f),at)).item;
 const held=(await repo().write(reviewer(),command(f,{previous:ref(first),decision:'HELD',reasons:['INCOMPLETE_EVIDENCE'],evidence:null}),at)).item;
 let profile=await repo().workProfile(a.registered.id);assert.equal(profile.counts.attested,0);assert.equal(profile.units[0].status,'HELD');assert.equal(profile.units[0].history[0].decision,'REPRODUCED');
 await repo().write(moderator(),hide(held),at);profile=await repo().workProfile(a.registered.id);assert.equal(profile.counts.total,0);assert.deepEqual(profile.units,[]);assert(!JSON.stringify(profile).includes(held.id));
 await repo().write(moderator(),hide(held,'VISIBLE'),at);profile=await repo().workProfile(a.registered.id);assert.equal(profile.units[0].status,'HELD');assert.equal(profile.counts.attested,0);
 const rejected=(await repo().write(reviewer(),command(f,{previous:ref(held),decision:'REJECTED',reasons:['METHOD_OR_INPUT_MISMATCH'],evidence:null}),at)).item;
 profile=await repo().workProfile(a.registered.id);assert.equal(profile.units[0].status,'REJECTED');assert.equal(profile.counts.rejected,1);
 await repo().write(reviewer(),withdraw(rejected),at);profile=await repo().workProfile(a.registered.id);assert.equal(profile.counts.total,0);
});
test('a different agent reproduction supersedes the original work without transferring credit by name',async()=>{
 const a=await agent(),b=await agent(),f=await fixture({agent:a.actor}),first=(await repo().write(reviewer(),command(f),at)).item;
 const other=(await old().write(b.actor,{...f.reproductionCommand,id:uid(),requestId:uid()},at)).item;
 const second=(await repo().write(reviewer(),command({...f,reproduction:other},{previous:ref(first)}),at)).item;
 const oldProfile=await repo().workProfile(a.registered.id),newProfile=await repo().workProfile(b.registered.id);
 assert.equal(oldProfile.counts.attested,0);assert.equal(oldProfile.units[0].status,'SUPERSEDED');assert.equal(newProfile.counts.attested,1);assert.equal(newProfile.units[0].reproduction.id,other.id);assert.equal(newProfile.units[0].currentHead.id,second.id);
});
test('current source suppression hides all work and private review reports never affect a public count',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item;
 await repo().write(a.actor,{action:'report',requestId:uid(),...ref(review),reason:'MISLEADING',details:'PRIVATE report must never become a public reputation finding.',policyAccepted:rp},at);
 assert.equal((await repo().workProfile(a.registered.id)).counts.attested,1);
 await new StrategyRepository(db).write(moderator(),{...hide(f.strategy),policyAccepted:'public-strategy-v1'},at);
 const hidden=await get(a.registered.id);assert.equal(hidden.status,404);assert(!JSON.stringify(await hidden.json()).includes('PRIVATE'));
 await new StrategyRepository(db).write(moderator(),{...hide(f.strategy,'VISIBLE'),policyAccepted:'public-strategy-v1'},at);
 assert.equal((await repo().workProfile(a.registered.id)).counts.attested,1);
});
test('expired or revoked credentials cannot publish but valid historical work is not silently erased',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});await repo().write(reviewer(),command(f),at);
 await new NetworkRepository(db).write(a.owner,{action:'revoke',requestId:uid(),id:a.registered.id,revision:1},at);
 await assert.rejects(()=>old().write(a.actor,{...f.reproductionCommand,id:uid(),requestId:uid()},at),error=>error.status===401);
 assert.equal((await get(a.registered.id)).status,200);assert.equal((await repo().workProfile(a.registered.id)).counts.attested,1);
});
test('a late source moderation is observed by the exact whole-profile final SQL fence',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});await repo().write(reviewer(),command(f),at);let changed=false;
 const hooked=instrument({beforeFirst:async sql=>{if(!changed&&sql.startsWith('WITH expected_0')){changed=true;await new StrategyRepository(db).write(moderator(),{...hide(f.strategy),policyAccepted:'public-strategy-v1'},at)}}});
 await assert.rejects(()=>repo(hooked).workProfile(a.registered.id),error=>error.status===503);assert(changed);
});
test('same-length payload corruption with unchanged digest labels cannot survive the closing fence',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});const review=(await repo().write(reviewer(),command(f),at)).item;let changed=false;
 const hooked=instrument({beforeFirst:async sql=>{if(!changed&&sql.startsWith('WITH expected_0')){changed=true;const row=await db.prepare('SELECT payload FROM experiment_reviews WHERE id=?').bind(review.id).first();const altered=row.payload.replace('Synthetic human computational attestation.','Synthetic false computational attestation.');assert.equal(altered.length,row.payload.length);assert.notEqual(altered,row.payload);await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind(altered,review.id).run()}}});
 await assert.rejects(()=>repo(hooked).workProfile(a.registered.id),error=>error.status===503);assert(changed);
});
test('new review membership appearing before confirmation cannot leave an earlier favorable profile',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),first=(await repo().write(reviewer(),command(f),at)).item;let changed=false;
 const hooked=instrument({beforeFirst:async sql=>{if(!changed&&sql.startsWith('WITH expected_0')){changed=true;await repo().write(reviewer(),command(f,{previous:ref(first),decision:'HELD',reasons:['INCOMPLETE_EVIDENCE'],evidence:null}),at)}}});
 await assert.rejects(()=>repo(hooked).workProfile(a.registered.id),error=>error.status===503);assert(changed);
});
test('actual snapshot stays within Free D1 statement and parameter limits, with no writes',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor});await repo().write(reviewer(),command(f),at);const traced=instrument();const result=await repo(traced).workProfile(a.registered.id);assert.equal(result.counts.attested,1);
 assert.equal(traced.calls.length,13);for(const {sql,values} of traced.calls){assert(Buffer.byteLength(sql)<=100000);assert(values.length<=100);for(const value of values)if(typeof value==='string')assert(Buffer.byteLength(value)<=1500000)}
});
test('oversized catalog refuses before payload retrieval rather than returning a partial zero profile',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item;
 const large='x'.repeat(1_100_000);await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind(large,review.id).run();
 for(let n=0;n<7;n++)await db.prepare('INSERT INTO experiment_reviews SELECT ?,original_id,original_digest,?,author_key,sponsor_key,?,command_digest,payload,digest,created_at FROM experiment_reviews WHERE id=?').bind(uid(),n+2,uid(),review.id).run();
 const traced=instrument();await assert.rejects(()=>repo(traced).workProfile(a.registered.id),error=>error.status===503);assert.equal(traced.calls.length,1);assert(!traced.calls.some(call=>call.sql.includes('AS material')));
});
test('the actual Worker rejects unknown, duplicate and authority query fields and every write verb',async()=>{
 for(const query of ['', '?id=bad','?id='+uid()+'&id='+uid(),'?id='+uid()+'&score=100','?token=secret'])assert.equal((await mf.dispatchFetch(origin+'/api/reputation/agents'+query)).status,400);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS','HEAD']){const response=await mf.dispatchFetch(origin+'/api/reputation/agents?id='+uid(),{method});assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET')}
});

test('actual separately attempted PROGRAM_DEMO reproduction receives a linked computational work unit',async()=>{
 const a=await agent(),f=await programFixture({agentActor:a.actor});assert.notEqual(f.artifact.attemptId,f.second.attemptId);
 const review=(await repo().write(reviewer(),command(f),at)).item;
 const response=await get(a.registered.id);assert.equal(response.status,200,await response.clone().text());const profile=await response.json();
 assert.equal(profile.counts.attested,1);assert.equal(profile.units[0].currentHead.id,review.id);assert.equal(profile.independence,'NOT_ESTABLISHED');assert.equal(profile.units[0].history[0].decision,'REPRODUCED');
});
test('actual PROGRAM_FORWARD_DEMO review holds remain visible work context without a fabricated positive claim',async()=>{
 const a=await agent(),f=await unplanned();
 const manifest=(await old().write(human(),{action:'register',id:uid(),requestId:uid(),...em.experimentForwardRegisterDefaults(f.artifact.input,'Synthetic forward profile source'),policyAccepted:ep},at)).item;
 const originalCommand={action:'outcome',id:uid(),requestId:uid(),method:'PROGRAM_FORWARD_DEMO',name:'Synthetic forward original',manifest:ref(manifest),result:{kind:'ARTIFACT',artifact:f.artifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},policyAccepted:ep};
 const original=(await old().write(human(),originalCommand,at)).item,fresh=await forwardLocal.compareProgramForwardEvidence(f.artifact),reproduction=(await old().write(a.actor,{...originalCommand,id:uid(),requestId:uid(),result:{kind:'ARTIFACT',artifact:fresh.reconstructed},claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(original)},sharedDependencies:['Same trusted code and invented input'],conflicts:''}},at)).item;
 const evidence={method:'PROGRAM_FORWARD_DEMO',original:fresh.report,reproduction:(await forwardLocal.compareProgramForwardEvidence(fresh.reconstructed)).report};
 const review=(await repo().write(reviewer(),command({original,reproduction,manifest,strategy:f.selected,evidence},{decision:'HELD',reasons:['INCOMPLETE_EVIDENCE']}),at)).item;
 const response=await get(a.registered.id);assert.equal(response.status,200,await response.clone().text());const profile=await response.json();assert.equal(profile.counts.attested,0);assert.equal(profile.counts.held,1);assert.equal(profile.units[0].currentHead.id,review.id);assert.equal(profile.units[0].status,'HELD');assert.equal(profile.ordersEnabled,false);
});

test('single row admission refuses malformed oversized material before retrieval',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item;
 await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind('x'.repeat(1600000),review.id).run();
 const traced=instrument();await assert.rejects(()=>repo(traced).workProfile(a.registered.id),error=>error.status===503);assert.equal(traced.calls.length,1);assert(!traced.calls[0].sql.includes('AS material'));
});
test('growth after preflight is denied inside the material SELECT, before a larger body crosses into the Worker',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item;let changed=false;
 const traced=instrument({beforeAll:async sql=>{if(!changed&&sql.includes('AS material')){changed=true;await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind('x'.repeat(1600000),review.id).run()}}});
 await assert.rejects(()=>repo(traced).workProfile(a.registered.id),error=>error.status===503);assert(changed);assert.equal(traced.calls.length,2);
});
test('multi-binding snapshot proof preserves whole raw rows beneath D1 string caps without awarding work credit',async()=>{
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item;
 const material='x'.repeat(400000);await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind(material,review.id).run();
 for(let n=0;n<4;n++)await db.prepare('INSERT INTO experiment_reviews SELECT ?,original_id,original_digest,?,author_key,sponsor_key,?,command_digest,payload,digest,created_at FROM experiment_reviews WHERE id=?').bind(uid(),n+2,uid(),review.id).run();
 const traced=instrument(),{AgentWorkProfileSnapshot}=load('app/agent-work-profile-snapshot.ts'),snapshot=new AgentWorkProfileSnapshot(traced);
 const fields=['id','original_id','original_digest','sequence','author_key','sponsor_key','request_id','command_digest','payload','digest','created_at'];
 const rows=await snapshot.read('experiment_reviews',fields,250);assert.equal(rows.length,5);assert(rows.every(row=>row.payload===material));await snapshot.confirm();
 const closing=traced.calls.at(-1);assert(closing.sql.startsWith('WITH expected_0'));assert(closing.values.length>=2);for(const value of closing.values)assert(Buffer.byteLength(value)<=1500000);
 // These deliberately malformed payloads pass only a byte snapshot, never a profile.
 await assert.rejects(()=>repo().workProfile(a.registered.id),error=>error.status===503);
});

const snapshotReviewFields=['id','original_id','original_digest','sequence','author_key','sponsor_key','request_id','command_digest','payload','digest','created_at'];
async function sixChunkSnapshotFixture(){
 const a=await agent(),f=await fixture({agent:a.actor}),review=(await repo().write(reviewer(),command(f),at)).item;
 // Each raw row fits the existing row/binding caps, but no two fit one proof
 // chunk. These payloads deliberately do not claim valid computational work.
 const material='x'.repeat(900000),ids=[review.id];
 await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind(material,review.id).run();
 for(let n=0;n<5;n++){const id=uid();ids.push(id);await db.prepare('INSERT INTO experiment_reviews SELECT ?,original_id,original_digest,?,author_key,sponsor_key,?,command_digest,payload,digest,created_at FROM experiment_reviews WHERE id=?').bind(id,n+2,uid(),review.id).run();}
 return {material,ids,profileId:a.registered.id};
}
function assertSixChunkProof(traced,ids,selector=false,closings=1){
 const closing=traced.calls.at(-1);assert(closing.sql.startsWith('WITH expected_0'));
 assert.equal(traced.calls.filter(call=>call.sql.startsWith('WITH expected_0')).length,closings);
 assert.equal(closing.values.length,selector?7:6);assert(Buffer.byteLength(closing.sql)<=100000);
 const chunks=closing.values.slice(0,6).map(value=>{assert(Buffer.byteLength(value)<=1500000);return JSON.parse(value)});
 assert(chunks.every(chunk=>chunk.length===1));assert.deepEqual(chunks.flat().map(row=>row.id).sort(),[...ids].sort());
 assert(closing.values.reduce((total,value)=>total+Buffer.byteLength(value),0)<=16777216);
 if(selector)assert.deepEqual(JSON.parse(closing.values[6]),ids);
}
test('native closing proof accepts six bounded exact chunks with and without a selector',async()=>{
 const {material,ids,profileId}=await sixChunkSnapshotFixture(),{AgentWorkProfileSnapshot,agentWorkReadLimits}=load('app/agent-work-profile-snapshot.ts');
 for(const selected of [false,true]){
  const traced=instrument(),snapshot=new AgentWorkProfileSnapshot(traced),rows=await snapshot.read('experiment_reviews',snapshotReviewFields,250,selected?{column:'id',ids}:undefined);
  assert.equal(rows.length,6);assert(rows.every(row=>row.payload===material));
  assert(rows.reduce((total,row)=>total+Buffer.byteLength(JSON.stringify(row)),0)<=agentWorkReadLimits.canonicalWireBytes);
  assert(rows.every(row=>Buffer.byteLength(JSON.stringify(row))<=agentWorkReadLimits.rowWireBytes));
  await snapshot.confirm();assertSixChunkProof(traced,ids,selected);
 }
 // A successful exact byte snapshot is not a valid full-profile projection.
 await assert.rejects(()=>repo().workProfile(profileId),error=>error.status===503);
});
test('six-chunk native closing proof rejects same-length payload corruption despite unchanged digest labels',async()=>{
 const {material,ids}=await sixChunkSnapshotFixture(),traced=instrument(),{AgentWorkProfileSnapshot}=load('app/agent-work-profile-snapshot.ts'),snapshot=new AgentWorkProfileSnapshot(traced);
 await snapshot.read('experiment_reviews',snapshotReviewFields,250);await snapshot.confirm();assertSixChunkProof(traced,ids);
 const changed=material.slice(0,-1)+'y';assert.equal(Buffer.byteLength(changed),Buffer.byteLength(material));assert.notEqual(changed,material);
 const prior=await db.prepare('SELECT digest,command_digest FROM experiment_reviews WHERE id=?').bind(ids[0]).first();
 await db.prepare('UPDATE experiment_reviews SET payload=? WHERE id=?').bind(changed,ids[0]).run();
 assert.deepEqual(await db.prepare('SELECT digest,command_digest FROM experiment_reviews WHERE id=?').bind(ids[0]).first(),prior);
 await assert.rejects(()=>snapshot.confirm(),error=>error.status===503);assertSixChunkProof(traced,ids,false,2);
});
test('six-chunk native closing proof rejects removed membership after the complete read',async()=>{
 const {ids}=await sixChunkSnapshotFixture(),traced=instrument(),{AgentWorkProfileSnapshot}=load('app/agent-work-profile-snapshot.ts'),snapshot=new AgentWorkProfileSnapshot(traced);
 await snapshot.read('experiment_reviews',snapshotReviewFields,250);await snapshot.confirm();assertSixChunkProof(traced,ids);
 await db.prepare('DELETE FROM experiment_reviews WHERE id=?').bind(ids[0]).run();
 await assert.rejects(()=>snapshot.confirm(),error=>error.status===503);assertSixChunkProof(traced,ids,false,2);
});
test('six-chunk native closing proof rejects replaced membership even when the row count is unchanged',async()=>{
 const {ids}=await sixChunkSnapshotFixture(),traced=instrument(),{AgentWorkProfileSnapshot}=load('app/agent-work-profile-snapshot.ts'),snapshot=new AgentWorkProfileSnapshot(traced);
 await snapshot.read('experiment_reviews',snapshotReviewFields,250);await snapshot.confirm();assertSixChunkProof(traced,ids);
 await db.prepare('UPDATE experiment_reviews SET id=? WHERE id=?').bind(uid(),ids[0]).run();
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM experiment_reviews').first()).count,6);
 await assert.rejects(()=>snapshot.confirm(),error=>error.status===503);assertSixChunkProof(traced,ids,false,2);
});
test('native closing proof preserves empty frames and an empty selector over populated source rows',async()=>{
 const {AgentWorkProfileSnapshot}=load('app/agent-work-profile-snapshot.ts'),empty=instrument(),first=new AgentWorkProfileSnapshot(empty);
 assert.deepEqual(await first.read('experiment_reviews',snapshotReviewFields,250),[]);await first.confirm();assert.deepEqual(empty.calls.at(-1).values,['[]']);
 await sixChunkSnapshotFixture();
 const selected=instrument(),second=new AgentWorkProfileSnapshot(selected);
 assert.deepEqual(await second.read('experiment_reviews',snapshotReviewFields,250,{column:'id',ids:[]}),[]);
 assert.deepEqual(await second.read('experiment_review_moderation',['record_id','sequence','payload'],0,{column:'record_id',ids:[]}),[]);
 await second.confirm();assert.deepEqual(selected.calls.at(-1).values,['[]','[]','[]','[]']);
});
test('native closing proof rejects new membership after an empty unselected frame was read',async()=>{
 const {AgentWorkProfileSnapshot}=load('app/agent-work-profile-snapshot.ts'),snapshot=new AgentWorkProfileSnapshot(instrument());
 assert.deepEqual(await snapshot.read('experiment_reviews',snapshotReviewFields,250),[]);await snapshot.confirm();
 await sixChunkSnapshotFixture();await assert.rejects(()=>snapshot.confirm(),error=>error.status===503);
});
