import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let m,directory,bundle;
const copy=structuredClone,T='2026-10-11T12:00:00.000Z',id=n=>'90000000-0000-4000-8000-'+String(n).padStart(12,'0');
function sourceFor(parent){const record=parent.record.content.input.strategy.record;return {id:record.id,digest:parent.strategy.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:m.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]};}
function admission(raw=bundle,changes={}){return copy({planId:id(1),createdAt:T,parent:raw.parent,source:raw.source,trainingBars:180,excludedGapBars:0,children:{TRAIN:{requestId:id(2),id:id(3),inputRequestId:id(4),datasetId:id(5)},TEST:{requestId:id(6),id:id(7),inputRequestId:id(8),datasetId:id(9)}},...changes});}
async function resealParent(raw){const parent=copy(raw),canonical=m.boundedExperimentRecord(parent.record);parent.record=canonical.record;parent.digest=await m.experimentDigest(canonical.payload);return parent;}
async function withInput(input,disclosures){input=copy(input);input.strategy.digest=await m.experimentDigest(m.boundedStrategyRecord(input.strategy.record).payload);const parent=copy(bundle.parent);parent.record.content.input=m.boundedDemoRequest(input).input;parent.strategy={id:input.strategy.record.id,digest:input.strategy.digest};if(disclosures)parent.record.content.disclosures=copy(disclosures);parent.record.flags=m.experimentManifestFlags(parent.record.content.disclosures);const canonical=await resealParent(parent);return {parent:canonical,source:sourceFor(canonical)};}
async function rehashPlan(raw){const {planDigest,...body}=copy(raw);return {...body,planDigest:await m.experimentDigest(JSON.stringify(body))};}
async function childFor(plan,partition){const command=plan.children[partition].command,{action,requestId,id:recordId,policyAccepted,...content}=command;assert.equal(action,'register');const record={version:1,id:recordId,requestId,createdAt:'2026-10-11T13:00:00.000Z',author:copy(plan.captured.parent.record.author),type:'MANIFEST',content,flags:m.experimentManifestFlags(content.disclosures),policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false};const canonical=m.boundedExperimentRecord(record);return {id:recordId,digest:await m.experimentDigest(canonical.payload),type:'MANIFEST',requestId,createdAt:record.createdAt,author:m.experimentAuthorReference(record.author),strategy:copy(plan.captured.parent.strategy),manifest:null,state:'VISIBLE',reason:null,suppression:null,reporting:'UNREPORTED',outcomeCount:0,record:canonical.record,moderation:[]};}

before(async()=>{
 const compiled=await build({stdin:{contents:"export * from './app/experiment-plan';export {boundedExperimentRecord,experimentManifestFlags,experimentDigest,experimentAuthorReference,validateExperimentItem} from './app/experiment-model';export {strategyAuthorReference,strategyTemplate,boundedStrategyRecord} from './app/strategy-model';export {boundedDemoRequest,verifyDemoArtifact,demoTimeframes} from './app/demo-model';export {replayDemo} from './app/demo-engine';export {createExperimentRun,evaluateExperimentRun,verifyExperimentRun,prepareExperimentRunOutcome} from './app/experiment-runner';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-chronological-plan-'));const path=join(directory,'plan.mjs');writeFileSync(path,compiled.outputFiles[0].text,{flag:'wx'});m=await import(pathToFileURL(path).href);
 const parent=JSON.parse(readFileSync('examples/experiments/signal-current-manifest.json','utf8')).item;bundle={parent,source:sourceFor(parent)};
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('freeze retains exact snapshots and cold-start child drafts without evaluating or publishing',async()=>{
 const supplied=admission(),snapshot=copy(supplied),plan=await m.createChronologicalPlan(supplied);assert.deepEqual(supplied,snapshot);assert.deepEqual(plan.captured,{parent:bundle.parent,source:bundle.source});assert.equal(plan.unseen,'NOT_ESTABLISHED');assert.equal(plan.qualification,'NONE');assert.equal(plan.ordersEnabled,false);assert.equal(plan.classification,'AUTHOR_REPORTED');
 for(const key of ['TRAIN','TEST']){const child=plan.children[key],input=child.command.input;assert.equal(input.initialCapital,bundle.parent.record.content.input.initialCapital);assert.deepEqual(input.strategy,bundle.parent.record.content.input.strategy);assert.equal(input.dataset.provenance,bundle.parent.record.content.input.dataset.provenance);assert.deepEqual(input.dataset.rights,bundle.parent.record.content.input.dataset.rights);assert.equal(input.hypothesis,bundle.parent.record.content.input.hypothesis);assert.equal(child.inputDigest,await m.experimentDigest(m.boundedDemoRequest(input).payload));assert.equal(input.dataset.bars.length,180);assert.equal(child.range.barCount,180);}
 assert.deepEqual(await m.verifyChronologicalPlan(JSON.parse(JSON.stringify(plan))),plan);supplied.parent.record.content.input.initialCapital=1;assert.notEqual(plan.captured.parent.record.content.input.initialCapital,1);
});

test('cuts use exact physical contiguous intervals and retain an actual excluded gap',async()=>{
 const plan=await m.createChronologicalPlan(admission(bundle,{trainingBars:100,excludedGapBars:5})),bars=bundle.parent.record.content.input.dataset.bars;
 assert.deepEqual(plan.children.TRAIN.command.input.dataset.bars,bars.slice(0,100));assert.deepEqual(plan.excluded.bars,bars.slice(100,105).map(b=>({closedAt:b.closedAt})));assert.deepEqual(plan.children.TEST.command.input.dataset.bars,bars.slice(105));
 assert.equal(plan.children.TRAIN.range.lastClosedAt,bars[99].closedAt);assert.equal(plan.children.TEST.range.firstClosedAt,bars[105].closedAt);assert.equal(plan.children.TEST.range.firstOpenAt,bars[104].closedAt);assert(plan.children.TRAIN.range.lastClosedAt<plan.children.TEST.range.firstOpenAt);
});

test('optional zero gap and minimum two-bar partitions remain honest, including no-trade cold warmup',async()=>{
 const input=copy(bundle.parent.record.content.input);input.dataset.bars=input.dataset.bars.slice(0,4);input.signals=[];const b=await withInput(input),plan=await m.createChronologicalPlan(admission(b,{trainingBars:2,excludedGapBars:0}));assert.equal(plan.excluded.bars.length,0);assert.equal(plan.children.TRAIN.range.lastClosedAt,plan.children.TEST.range.firstOpenAt);
 for(const key of ['TRAIN','TEST']){const artifact=await m.replayDemo(plan.children[key].command.input);assert.equal(artifact.status,'NO_TRADES');assert.equal(artifact.trades.length,0);await m.verifyDemoArtifact(artifact);}
});

test('invalid noninteger boundaries, negative gaps and undersized retained partitions reject',async()=>{
 for(const changes of [{trainingBars:1},{trainingBars:2.5},{excludedGapBars:-1},{excludedGapBars:0.5},{trainingBars:359},{trainingBars:180,excludedGapBars:179},{trainingBars:4000}])await assert.rejects(()=>m.createChronologicalPlan(admission(bundle,changes)));
});

test('all providers and directions retain original signals only when observation AND availability belong to a child',async()=>{
 const input=copy(bundle.parent.record.content.input);input.dataset.bars=input.dataset.bars.slice(0,12);const at=n=>input.dataset.bars[n].closedAt;input.signals=[
  {id:id(40),provider:'ALTFINS',event:'BULLISH',observedAt:at(0),availableAt:at(0)},
  {id:id(41),provider:'TRADINGVIEW',event:'BEARISH',observedAt:at(4),availableAt:at(5)},
  {id:id(42),provider:'CUSTOM',event:'BULLISH',observedAt:at(5),availableAt:at(7)},
  {id:id(43),provider:'ALTFINS',event:'BEARISH',observedAt:at(6),availableAt:at(6)},
  {id:id(44),provider:'TRADINGVIEW',event:'BULLISH',observedAt:at(8),availableAt:at(8)},
  {id:id(45),provider:'CUSTOM',event:'BEARISH',observedAt:at(11),availableAt:at(11)}];
 const b=await withInput(input),plan=await m.createChronologicalPlan(admission(b,{trainingBars:6,excludedGapBars:2}));
 assert.deepEqual(plan.children.TRAIN.command.input.signals,input.signals.slice(0,2));assert.deepEqual(plan.children.TEST.command.input.signals,input.signals.slice(4));assert.deepEqual(plan.excluded.signals,[{id:id(42),reason:'CROSS_BOUNDARY_AVAILABILITY'},{id:id(43),reason:'GAP_OBSERVATION'}]);
 const every=[...plan.children.TRAIN.command.input.signals,...plan.children.TEST.command.input.signals,...plan.excluded.signals];assert.equal(every.length,input.signals.length);assert.equal(new Set(every.map(s=>s.id)).size,input.signals.length);assert.equal(plan.children.TEST.command.input.signals.at(-1).availableAt,at(11));
});

test('delayed observation cannot be shifted into test and signal times are never clamped',async()=>{
 const input=copy(bundle.parent.record.content.input);input.dataset.bars=input.dataset.bars.slice(0,8);input.signals=[{id:id(50),provider:'ALTFINS',event:'BULLISH',observedAt:input.dataset.bars[3].closedAt,availableAt:input.dataset.bars[4].closedAt}];
 const plan=await m.createChronologicalPlan(admission(await withInput(input),{trainingBars:4,excludedGapBars:0}));assert.equal(plan.children.TRAIN.command.input.signals.length,0);assert.equal(plan.children.TEST.command.input.signals.length,0);assert.deepEqual(plan.excluded.signals,[{id:id(50),reason:'CROSS_BOUNDARY_AVAILABILITY'}]);assert.deepEqual(plan.captured.parent.record.content.input.signals,input.signals);
});

test('historical search, reuse, transformations, seeds and conflicts survive without manufacturing complete or unseen history',async()=>{
 const disclosures=copy(bundle.parent.record.content.disclosures);Object.assign(disclosures.search,{trialCount:19,selection:'BEST_OBSERVED',logCompleteness:'COMPLETE',log:'Historical trials 1–19; failures retained.'});Object.assign(disclosures.validation,{holdoutDeclared:true,holdoutPriorAccess:'UNSEEN',holdoutReuseCount:3,note:'Prior untouched claim, unverified.'});disclosures.transformations=['Raw close-only selection'];disclosures.seeds=[17,29];disclosures.conflicts={sharedDependencies:['Same author'],other:'Shared supplied input'};
 const plan=await m.createChronologicalPlan(admission(await withInput(bundle.parent.record.content.input,disclosures)));assert.deepEqual(plan.captured.parent.record.content.disclosures,disclosures);
 for(const key of ['TRAIN','TEST']){const d=plan.children[key].command.disclosures;assert.deepEqual(d.search,{...disclosures.search,logCompleteness:'PARTIAL'});assert.deepEqual(d.validation,{...disclosures.validation,holdoutPriorAccess:'UNKNOWN'});assert.deepEqual(d.conflicts,disclosures.conflicts);assert.deepEqual(d.transformations,disclosures.transformations);assert.deepEqual(d.seeds,disclosures.seeds);assert.deepEqual(d.publication,disclosures.publication);}
});

test('maximal inherited disclosures are preserved exactly without truncation',async()=>{
 const disclosures=copy(bundle.parent.record.content.disclosures);disclosures.search.log='L'.repeat(4000);disclosures.validation.note='N'.repeat(1500);disclosures.conflicts.other='C'.repeat(1500);disclosures.transformations=Array.from({length:8},(_,n)=>String(n)+'T'.repeat(499));disclosures.conflicts.sharedDependencies=Array.from({length:8},(_,n)=>String(n)+'D'.repeat(199));disclosures.seeds=Array.from({length:8},(_,n)=>n);
 const plan=await m.createChronologicalPlan(admission(await withInput(bundle.parent.record.content.input,disclosures)));for(const key of ['TRAIN','TEST']){assert.equal(plan.children[key].command.disclosures.search.log.length,4000);assert.equal(plan.children[key].command.disclosures.validation.note.length,1500);assert.deepEqual(plan.children[key].command.disclosures.transformations,disclosures.transformations);assert.deepEqual(plan.children[key].command.disclosures.conflicts,disclosures.conflicts);}
});

test('an absolute emergency before test cannot be silently removed, including an excluded-gap stop',async()=>{
 for(const index of [0,178,179,180]){const input=copy(bundle.parent.record.content.input);input.emergencyStopAt=input.dataset.bars[index].closedAt;const b=await withInput(input);await assert.rejects(()=>m.createChronologicalPlan(admission(b,{trainingBars:180,excludedGapBars:2})),/emergency stop precedes/);}
});

test('emergency on or after test first open keeps its exact time and explicit train mapping',async()=>{
 const input=copy(bundle.parent.record.content.input);input.emergencyStopAt=input.dataset.bars[185].closedAt;const plan=await m.createChronologicalPlan(admission(await withInput(input)));assert.deepEqual(plan.children.TRAIN.emergency,{originalAt:input.emergencyStopAt,mappedAt:null,reason:'AFTER_PARTITION'});assert.equal(plan.children.TRAIN.command.input.emergencyStopAt,null);assert.deepEqual(plan.children.TEST.emergency,{originalAt:input.emergencyStopAt,mappedAt:input.emergencyStopAt,reason:'PRESERVED'});
 input.emergencyStopAt=input.dataset.bars[179].closedAt;const boundary=await m.createChronologicalPlan(admission(await withInput(input)));assert.equal(boundary.children.TRAIN.emergency.reason,'PRESERVED');assert.equal(boundary.children.TEST.emergency.reason,'PRESERVED');assert.equal(boundary.children.TEST.command.input.emergencyStopAt,boundary.children.TEST.range.firstOpenAt);
});

test('distinct stable identities are checked equally on admission and rehashed verification',async()=>{
 const plan=await m.createChronologicalPlan(admission());for(const value of [plan.planId,bundle.parent.id,bundle.parent.requestId,bundle.parent.record.content.input.requestId,bundle.parent.record.content.input.dataset.id,plan.children.TRAIN.command.id]){const a=admission();a.children.TEST.id=value;await assert.rejects(()=>m.createChronologicalPlan(a),/identities/);const altered=copy(plan);altered.children.TEST.command.id=value;await assert.rejects(async()=>m.verifyChronologicalPlan(await rehashPlan(altered)));}
});

test('schema, getter, nonfinite, prototype and whole-byte limits reject before executing raw objects',async()=>{
 let called=false;const getter=admission();Object.defineProperty(getter,'parent',{enumerable:true,get(){called=true;return bundle.parent;}});await assert.rejects(()=>m.createChronologicalPlan(getter));assert.equal(called,false);
 for(const raw of [()=>{},new Date(),{v:Infinity},{v:undefined},Object.create({inherited:true})])await assert.rejects(()=>m.createChronologicalPlan(raw));
 await assert.rejects(()=>m.createChronologicalPlan({padding:'x'.repeat(m.chronologicalPlanLimits.admissionBytes)}),e=>e.status===413);await assert.rejects(()=>m.verifyChronologicalPlan({padding:'x'.repeat(m.chronologicalPlanLimits.planBytes)}),e=>e.status===413);const extra=admission();extra.execute=true;await assert.rejects(()=>m.createChronologicalPlan(extra));
});

test('known public and local credential patterns including encoded variants never enter frozen content',async()=>{
 for(const value of ['og_local_owner_'+ 'a'.repeat(64),'%6f%67%5flocal_producer_'+ 'b'.repeat(64),'%256f%2567%255fagent_'+ 'c'.repeat(64)]){const a=admission();a.parent.record.content.disclosures.conflicts.other=value;await assert.rejects(()=>m.createChronologicalPlan(a),/Credentials/);}
 const a=admission();a.parent.record.author.name='og_local_owner_'+ 'd'.repeat(64);await assert.rejects(()=>m.createChronologicalPlan(a),/Credentials/);
});

test('a valid registered-agent author name is preserved without being mistaken for an authored credential',async()=>{
 const b=copy(bundle),author={kind:'AGENT',id:id(60),sponsorId:b.parent.author.sponsorId,name:'og_agent_researcher'};b.parent.record.author=author;b.parent.author=m.experimentAuthorReference(author);b.parent=await resealParent(b.parent);
 const plan=await m.createChronologicalPlan(admission(b));assert.deepEqual(plan.captured.parent.record.author,author);assert.deepEqual(await m.verifyChronologicalPlan(plan),plan);
});

test('source identity, hidden projections, flags and different declared methods cannot admit a plan',async()=>{
 const hidden=copy(bundle);hidden.parent.state='HIDDEN';hidden.parent.suppression='SOURCE_UNAVAILABLE';hidden.parent.record=null;await assert.rejects(()=>m.createChronologicalPlan(admission(hidden)),e=>e.status===409);
 const hiddenSource=copy(bundle);hiddenSource.source.state='HIDDEN';hiddenSource.source.reason='POLICY';hiddenSource.source.record=null;await assert.rejects(()=>m.createChronologicalPlan(admission(hiddenSource)));
 for(const alter of [p=>p.record.content.evaluator.sourceDigest='a'.repeat(64),p=>p.record.content.evaluator.methodDigest='b'.repeat(64),p=>p.record.flags=[]]){const b=copy(bundle);alter(b.parent);b.parent=await resealParent(b.parent);await assert.rejects(()=>m.createChronologicalPlan(admission(b)));}
 const b=copy(bundle);b.source.record.content.description='Another source';b.source.digest=await m.experimentDigest(m.boundedStrategyRecord(b.source.record).payload);await assert.rejects(()=>m.createChronologicalPlan(admission(b)));
});

test('a self-consistently rehashed plan cannot change bars, prices, costs, capital, disclosures or exclusion metadata',async()=>{
 const plan=await m.createChronologicalPlan(admission());for(const alter of [p=>p.children.TRAIN.command.input.dataset.bars[0].close+=.1,p=>p.children.TEST.command.input.initialCapital+=1,p=>p.children.TRAIN.command.input.strategy.record.content.definition.costs.feeBps+=1,p=>p.children.TEST.command.disclosures.search.trialCount+=1,p=>p.children.TEST.range.firstOpenAt=p.children.TEST.range.firstClosedAt,p=>p.children.TRAIN.inputDigest='a'.repeat(64),p=>p.children.TRAIN.emergency.reason='AFTER_PARTITION']){const raw=copy(plan);alter(raw);await assert.rejects(async()=>m.verifyChronologicalPlan(await rehashPlan(raw)));}
 const broken=copy(plan);broken.planDigest='b'.repeat(64);await assert.rejects(()=>m.verifyChronologicalPlan(broken),/identity/);
});

test('public-sharing preparation requires an explicit confirmation and returns stable unchanged independent commands',async()=>{
 const plan=await m.createChronologicalPlan(admission());for(const key of ['TRAIN','TEST']){await assert.rejects(()=>m.prepareChronologicalManifest(plan,key,{confirmPublicSharing:false}),e=>e.status===403);const command=await m.prepareChronologicalManifest(plan,key,{confirmPublicSharing:true});assert.deepEqual(command,plan.children[key].command);command.name='Edited returned copy';assert.notEqual(command.name,plan.children[key].command.name);}
 await assert.rejects(()=>m.prepareChronologicalManifest(plan,'OTHER',{confirmPublicSharing:true}));
});

test('real registered children must match full exact content, stable request IDs and current visibility',async()=>{
 const plan=await m.createChronologicalPlan(admission()),child=await childFor(plan,'TRAIN');assert.deepEqual(await m.correlateChronologicalManifest(plan,'TRAIN',child),child);
 await assert.rejects(()=>m.correlateChronologicalManifest(plan,'TEST',child),e=>e.status===409);await assert.rejects(()=>m.correlateChronologicalManifest(plan,'TRAIN',bundle.parent),e=>e.status===409);
 for(const alter of [p=>{p.requestId=id(99);p.record.requestId=id(99);},p=>p.record.content.input.initialCapital+=1,p=>p.record.content.disclosures.validation.holdoutPriorAccess='UNSEEN']){const changed=copy(child);alter(changed);changed.record.flags=m.experimentManifestFlags(changed.record.content.disclosures);changed.digest=await m.experimentDigest(m.boundedExperimentRecord(changed.record).payload);await assert.rejects(()=>m.correlateChronologicalManifest(plan,'TRAIN',changed),e=>e.status===409);}
 const hidden=copy(child);hidden.state='HIDDEN';hidden.suppression='SOURCE_UNAVAILABLE';hidden.record=null;await assert.rejects(()=>m.correlateChronologicalManifest(plan,'TRAIN',hidden),e=>e.status===409);
});

test('fresh original visibility checks fail on suppression or changed source and do not promise server lineage',async()=>{
 const plan=await m.createChronologicalPlan(admission());assert.deepEqual(await m.assertChronologicalPlanSources(plan,bundle.parent,bundle.source),plan);
 const hidden=copy(bundle.parent);hidden.state='HIDDEN';hidden.suppression='SOURCE_UNAVAILABLE';hidden.record=null;await assert.rejects(()=>m.assertChronologicalPlanSources(plan,hidden,bundle.source));
 const input=copy(bundle.parent.record.content.input);input.initialCapital+=1;const changed=await withInput(input);await assert.rejects(()=>m.assertChronologicalPlanSources(plan,changed.parent,changed.source),e=>e.status===409);
 const child=await childFor(plan,'TRAIN');assert.deepEqual(await m.correlateChronologicalManifest(plan,'TRAIN',child),child);assert.equal('parent' in child.record.content,false);assert.equal(child.manifest,null);
});

test('future test prices cannot alter the training replay and later losses remain separate from training gains',async()=>{
 const input=copy(bundle.parent.record.content.input),start=Date.parse(input.dataset.bars[0].closedAt);input.strategy.record.content.definition=m.strategyTemplate('DCA');input.strategy.record.content.definition.market={symbol:input.dataset.symbol,timeframe:input.dataset.timeframe,direction:'LONG'};Object.assign(input.strategy.record.content.definition.entry,{intervalBars:1,maxEntries:1});Object.assign(input.strategy.record.content.definition.risk,{positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:100,maxDailyLossPct:5});input.strategy.record.content.definition.costs={feeBps:0,slippageBps:0};input.signals=[];input.dataset.bars=Array.from({length:12},(_,n)=>{const price=n<6?100+n*5:100-(n-6)*8;return {closedAt:new Date(start+n*m.demoTimeframes[input.dataset.timeframe]).toISOString(),open:price,high:price+1,low:price-1,close:price,volume:10};});
 const b=await withInput(input),plan=await m.createChronologicalPlan(admission(b,{trainingBars:6})),train=await m.replayDemo(plan.children.TRAIN.command.input),testResult=await m.replayDemo(plan.children.TEST.command.input);assert(train.metrics.netPnl>0);assert(testResult.metrics.netPnl<0);assert.notEqual(train.requestId,testResult.requestId);assert.equal(train.input.initialCapital,testResult.input.initialCapital);assert.equal(train.trades[0].id,testResult.trades[0].id);assert.equal(train.trades[0].entryBar,1);assert.equal(testResult.trades[0].entryBar,1);
 const future=copy(input);for(let n=6;n<12;n++){const price=50+(n-6)*50;Object.assign(future.dataset.bars[n],{open:price,high:price+1,low:price-1,close:price});}const changedPlan=await m.createChronologicalPlan(admission(await withInput(future),{trainingBars:6}));assert.deepEqual(await m.replayDemo(changedPlan.children.TRAIN.command.input),train);assert.notEqual(changedPlan.planDigest,plan.planDigest);
});

test('existing exact runner accepts each genuine child and its artifact cannot bind to the original full input',async()=>{
 const plan=await m.createChronologicalPlan(admission()),child=await childFor(plan,'TEST'),accepted=await m.correlateChronologicalManifest(plan,'TEST',child),run=await m.createExperimentRun({attemptId:id(200),outcomeRequestId:id(201),outcomeId:id(202),startedAt:'2026-10-11T14:00:00.000Z',manifest:accepted,source:plan.captured.source}),completed=await m.evaluateExperimentRun(run,{finishedAt:'2026-10-11T14:01:00.000Z'});assert.equal(completed.status,'EVALUATED');assert.deepEqual(completed.artifact.input,plan.children.TEST.command.input);assert.notDeepEqual(completed.artifact.input,plan.captured.parent.record.content.input);assert.equal(completed.artifact.digests.request,plan.children.TEST.inputDigest);const command=await m.prepareExperimentRunOutcome(completed,{confirmPublicSharing:true});assert.deepEqual(command.manifest,{id:child.id,digest:child.digest});assert.equal(completed.comparison.qualification,'NONE');
 const {runDigest,...rebound}=copy(completed);void runDigest;rebound.captured.manifest=plan.captured.parent;rebound.inputDigest=await m.experimentDigest(m.boundedDemoRequest(plan.captured.parent.record.content.input).payload);
 const reboundRun={...rebound,runDigest:await m.experimentDigest(JSON.stringify(rebound))};await assert.rejects(()=>m.verifyExperimentRun(reboundRun),/not bound to the captured manifest input/);
});
