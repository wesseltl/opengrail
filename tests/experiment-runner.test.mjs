import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let m,directory,signalBundle,insolvencyBundle,negativeRun;
const T='2026-10-11T10:00:00.000Z',U='2026-10-11T10:01:00.000Z';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const copy=structuredClone,bytes=v=>Buffer.byteLength(JSON.stringify(v));
function sourceFor(manifest){const record=manifest.record.content.input.strategy.record;return {id:record.id,digest:manifest.strategy.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:m.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]};}
function readBundle(name){const manifest=JSON.parse(readFileSync('examples/experiments/'+name+'-current-manifest.json','utf8')).item;return {manifest,source:sourceFor(manifest)};}
async function resealRun(raw){const {runDigest,...body}=copy(raw);return {...body,runDigest:await m.strategyDigest(JSON.stringify(body))};}
async function resealManifest(raw){const manifest=copy(raw),canonical=m.boundedExperimentRecord(manifest.record);manifest.record=canonical.record;manifest.digest=await m.strategyDigest(canonical.payload);return manifest;}
async function withInput(raw){const manifest=copy(signalBundle.manifest),input=copy(raw);input.strategy.digest=await m.strategyDigest(m.boundedStrategyRecord(input.strategy.record).payload);manifest.record.content.input=m.boundedDemoRequest(input).input;manifest.strategy={id:input.strategy.record.id,digest:input.strategy.digest};return {manifest:await resealManifest(manifest),source:sourceFor(manifest)};}
const admission=(bundle=signalBundle,n=1)=>m.createExperimentRun({...bundle,attemptId:id(n),outcomeRequestId:id(n+1000),outcomeId:id(n+2000),startedAt:T});

before(async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/experiment-runner';export {boundedExperimentRecord,validateExperimentItem,experimentLimits} from './app/experiment-model';export {strategyAuthorReference,strategyDigest,strategyTemplate,boundedStrategyRecord} from './app/strategy-model';export {boundedDemoRequest,demoArtifactDigest,verifyDemoArtifact,demoLimits} from './app/demo-model';export {replayDemo,syntheticDemoInput} from './app/demo-engine';export {verifyComparisonReport} from './app/evaluator-comparison';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-experiment-runner-'));const path=join(directory,'fixed-runner.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx'});m=await import(pathToFileURL(path).href);
 signalBundle=readBundle('signal');insolvencyBundle=readBundle('insolvency');negativeRun=await m.evaluateExperimentRun(await admission(signalBundle,90),{finishedAt:U});
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('exact visible admission freezes inputs, sources and future publication IDs before any evaluation',async()=>{
 const supplied=copy(signalBundle),before=JSON.stringify(supplied),run=await admission(supplied);
 assert.equal(JSON.stringify(supplied),before);assert.equal(run.status,'RUNNING');assert.equal(run.finishedAt,null);assert.equal(run.artifact,null);assert.equal(run.comparison,null);
 assert.equal(run.inputDigest,await m.strategyDigest(m.boundedDemoRequest(run.captured.manifest.record.content.input).payload));assert.deepEqual(run.captured,supplied);
 assert.equal(run.classification,'AUTHOR_REPORTED');assert.equal(run.qualification,'NONE');assert.equal(run.independence,'NOT_ESTABLISHED');assert.equal(run.ordersEnabled,false);
 assert.deepEqual(await m.verifyExperimentRun(JSON.parse(JSON.stringify(run))),run);
 supplied.manifest.record.content.input.initialCapital=1;assert.notEqual(run.captured.manifest.record.content.input.initialCapital,1);
});

test('plain JSON admission rejects getters without invoking them and cannot execute submitted objects',async()=>{
 let invoked=false;const raw={attemptId:id(2)};Object.defineProperty(raw,'manifest',{enumerable:true,get(){invoked=true;return signalBundle.manifest;}});
 await assert.rejects(()=>m.createExperimentRun(raw));assert.equal(invoked,false);
 for(const bad of [()=>{},new Date(),{fn:()=>{}},{value:Infinity},{value:undefined},Object.create({secret:'inherited'})])await assert.rejects(()=>m.createExperimentRun(bad));
 let nested={};for(let n=0;n<27;n++)nested={nested};await assert.rejects(()=>m.createExperimentRun(nested),e=>e.status===413);
});

test('whole admission and retained-attempt byte limits reject before schema execution',async()=>{
 await assert.rejects(()=>m.createExperimentRun({padding:'x'.repeat(m.experimentRunLimits.admissionBytes)}),e=>e.status===413);
 await assert.rejects(()=>m.verifyExperimentRun({padding:'x'.repeat(m.experimentRunLimits.attemptBytes)}),e=>e.status===413);
 assert.equal(m.experimentRunLimits.attempts,16);assert.equal(m.experimentRunLimits.historyBytes,33554432);assert.equal(m.experimentRunLimits.reservedAttemptBytes,m.experimentRunLimits.attemptBytes);
});

test('suppressed manifest or strategy never admits a run or makes cached material current',async()=>{
 const hidden=copy(signalBundle);hidden.manifest.state='HIDDEN';hidden.manifest.suppression='SOURCE_UNAVAILABLE';hidden.manifest.record=null;
 await assert.rejects(()=>admission(hidden,3),e=>e.status===409);
 const source=copy(signalBundle);source.source.state='HIDDEN';source.source.reason='POLICY';source.source.record=null;
 await assert.rejects(()=>admission(source,3));
 const run=await admission(signalBundle,3);await assert.rejects(()=>m.assertExperimentRunSources(run,hidden.manifest,hidden.source));await assert.rejects(()=>m.assertExperimentRunSources(run,source.manifest,source.source));
});

test('a self-consistent manifest declaring another code source is rejected before admission',async()=>{
 const bundle=copy(signalBundle);bundle.manifest.record.content.evaluator.sourceDigest='a'.repeat(64);bundle.manifest=await resealManifest(bundle.manifest);
 await m.validateExperimentItem(bundle.manifest);await assert.rejects(()=>admission(bundle,4),e=>e.status===409&&/different evaluator/.test(e.message));
});

test('wrong method, caution flags or canonical input/source mismatch cannot gain an admission by rehashing',async()=>{
 for(const alter of [v=>v.record.content.evaluator.methodDigest='b'.repeat(64),v=>v.record.flags=[],v=>v.record.content.input.strategy.record.content.name='Different strategy']){
  const bundle=copy(signalBundle);alter(bundle.manifest);const {payload}=m.boundedExperimentRecord(bundle.manifest.record);bundle.manifest.digest=await m.strategyDigest(payload);await assert.rejects(()=>admission(bundle,5));
 }
 const bundle=copy(signalBundle);bundle.source.record.content.description='Foreign source';bundle.source.digest=await m.strategyDigest(m.boundedStrategyRecord(bundle.source.record).payload);await assert.rejects(()=>admission(bundle,5));
});

test('admission and rehashed verification apply the same distinct lifecycle identity constraints',async()=>{
 const run=await admission(signalBundle,6);
 for(const changes of [{outcomeRequestId:run.attemptId},{outcomeId:run.attemptId},{outcomeId:run.outcomeRequestId},{outcomeId:run.captured.manifest.id},{outcomeRequestId:run.captured.manifest.requestId}]){
  await assert.rejects(()=>m.createExperimentRun({...signalBundle,attemptId:run.attemptId,startedAt:T,outcomeRequestId:run.outcomeRequestId,outcomeId:run.outcomeId,...changes}),/distinct and fresh/);
  await assert.rejects(async()=>m.verifyExperimentRun(await resealRun({...run,...changes})),/distinct and fresh/);
 }
});

test('a real adverse result completes the attempt without changing its loss or inventing qualification',async()=>{
 assert.equal(negativeRun.status,'EVALUATED');assert.equal(negativeRun.artifact.status,'COMPLETED');assert(negativeRun.artifact.metrics.netPnl<0);assert.equal(negativeRun.comparison.status,'MATCH');
 assert.equal(negativeRun.comparison.qualification,'NONE');assert.equal(negativeRun.comparison.independence,'NOT_ESTABLISHED');assert.equal(negativeRun.comparison.identity.claimedArtifact,negativeRun.artifact.resultDigest);
 assert.deepEqual(await m.verifyExperimentRun(negativeRun),negativeRun);await m.verifyDemoArtifact(negativeRun.artifact);await m.verifyComparisonReport(negativeRun.comparison);
});

test('real uncapped SHORT insolvency remains failed with negative equity and a retained comparison',async()=>{
 const run=await m.evaluateExperimentRun(await admission(insolvencyBundle,7),{finishedAt:U});assert.equal(run.status,'EVALUATED');assert.equal(run.artifact.status,'FAILED');assert.equal(run.artifact.reason,'INSOLVENT');
 assert(run.artifact.equity.at(-1).equity<0);assert(run.artifact.trades.some(t=>t.netPnl< -t.collateral));assert(run.artifact.metrics.finalEquity<0);assert.equal(run.artifact.metrics.comparable,false);assert(run.comparison);await m.verifyExperimentRun(run);
 const command=await m.prepareExperimentRunOutcome(run,{confirmPublicSharing:true});assert.equal(command.result.kind,'ARTIFACT');assert.equal(command.result.artifact.status,'FAILED');assert.equal(command.result.artifact.reason,'INSOLVENT');
});

test('real no-trade results remain available rather than becoming failed or silently disappearing',async()=>{
 const input=copy(signalBundle.manifest.record.content.input);input.signals=[];const run=await m.evaluateExperimentRun(await admission(await withInput(input),8),{finishedAt:U});
 assert.equal(run.status,'EVALUATED');assert.equal(run.artifact.status,'NO_TRADES');assert.equal(run.artifact.trades.length,0);assert.equal(run.comparison.status,'MATCH');assert(run.artifact.audit.some(v=>v.reason==='MISSING_SIGNAL'));await m.verifyExperimentRun(run);
});

test('actual emergency-halted evaluation preserves halt, costs and comparison',async()=>{
 const input=copy(signalBundle.manifest.record.content.input);input.emergencyStopAt=input.dataset.bars[20].closedAt;
 const run=await m.evaluateExperimentRun(await admission(await withInput(input),9),{finishedAt:U});assert.equal(run.status,'EVALUATED');assert.equal(run.artifact.status,'HALTED');assert.equal(run.artifact.reason,'EMERGENCY_STOP');assert(run.artifact.audit.some(v=>v.reason==='EMERGENCY_STOP'));assert.equal(run.comparison.status,'MATCH');await m.verifyExperimentRun(run);
});

test('a genuine SMA numerical disagreement retains both outcomes without fallback or tolerance changes',async()=>{
 const input=await m.syntheticDemoInput(),definition=m.strategyTemplate('RULES');definition.entry={type:'RULES',match:'ALL',conditions:[{indicator:'PRICE_SMA',period:2,comparison:'GT',threshold:.5}]};definition.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:20,maxDailyLossPct:1};definition.costs={feeBps:10,slippageBps:10};input.strategy.record.content.definition=definition;input.signals=[];input.emergencyStopAt=null;
 input.dataset.bars=Array.from({length:18},(_,n)=>{const price=n>=3&&n<=6?1e308:100;return {closedAt:new Date(Date.parse('2025-01-01T11:00:00.000Z')+n*3600000).toISOString(),open:price,high:n===2?101:price,low:n===2?79:price,close:price,volume:1};});
 const run=await m.evaluateExperimentRun(await admission(await withInput(input),10),{finishedAt:U});
 assert.equal(run.status,'EVALUATED');assert.equal(run.artifact.status,'FAILED');assert.equal(run.artifact.reason,'NUMERICAL_LIMIT');assert.equal(run.comparison.status,'MISMATCH');assert.equal(run.comparison.summaries.primary.status,'FAILED');assert.equal(run.comparison.summaries.reference.status,'COMPLETED');assert(run.comparison.pairs.find(p=>p.pair==='PRIMARY_REFERENCE').differenceCount>0);assert.equal(run.comparison.qualification,'NONE');await m.verifyExperimentRun(run);
 const command=await m.prepareExperimentRunOutcome(run,{confirmPublicSharing:true}),disclosure=m.experimentRunDisclosure(run);assert.match(command.claim.conflicts,/Comparison disposition MISMATCH/);assert(command.claim.conflicts.includes(run.comparison.reportDigest));for(const pair of run.comparison.pairs)assert(command.claim.conflicts.includes(pair.pair+':'+pair.differenceCount));assert.deepEqual({...command.claim,type:undefined,relation:undefined},{...disclosure,type:undefined,relation:undefined});assert.equal(command.result.artifact.reason,'NUMERICAL_LIMIT');
});

test('cancellation and recovery interrupt an admitted run with stable IDs and no fictitious metrics',async()=>{
 const run=await admission(signalBundle,11),controller=new AbortController();controller.abort();const cancelled=await m.evaluateExperimentRun(run,{signal:controller.signal,finishedAt:U});
 assert.equal(cancelled.status,'INTERRUPTED');assert.equal(cancelled.reason,'USER_CANCELLED');assert.equal(cancelled.artifact,null);assert.equal(cancelled.comparison,null);assert.equal(cancelled.outcomeRequestId,run.outcomeRequestId);await m.verifyExperimentRun(cancelled);
 const recovered=await m.interruptExperimentRun(run,U);assert.equal(recovered.reason,'RECOVERY_INTERRUPTED');assert.deepEqual(recovered.captured,run.captured);await m.verifyExperimentRun(recovered);
 for(const terminal of [cancelled,recovered]){const command=await m.prepareExperimentRunOutcome(terminal,{confirmPublicSharing:true});assert.equal(command.result.kind,'INTERRUPTED');assert.equal(command.id,run.outcomeId);assert.equal(command.requestId,run.outcomeRequestId);}
});

test('terminal attempts are immutable and clock-invalid completion leaves the original admission recoverable',async()=>{
 await assert.rejects(()=>m.evaluateExperimentRun(negativeRun,{finishedAt:U}),e=>e.status===409);await assert.rejects(()=>m.interruptExperimentRun(negativeRun,U),e=>e.status===409);
 const run=await admission(signalBundle,12);for(const value of ['invalid','2026-10-11T09:59:59.000Z','2026-10-11T10:00:00Z'])await assert.rejects(()=>m.evaluateExperimentRun(run,{finishedAt:value}));assert.equal(run.status,'RUNNING');await m.verifyExperimentRun(run);
});

test('run hashes, evaluator pins and claimed authority cannot be changed or self-rehashed into trust',async()=>{
 for(const changes of [{runDigest:'0'.repeat(64)},{ordersEnabled:true},{qualification:'QUALIFIED'},{kind:'LOCAL_DEMO_SESSION'}])await assert.rejects(()=>m.verifyExperimentRun({...negativeRun,...changes}));
 const changed=copy(negativeRun);changed.implementations.primary.sourceSha256='c'.repeat(64);await assert.rejects(async()=>m.verifyExperimentRun(await resealRun(changed)));
 const wrongInput=copy(negativeRun);wrongInput.inputDigest='d'.repeat(64);await assert.rejects(async()=>m.verifyExperimentRun(await resealRun(wrongInput)));
});

test('a valid artifact from different capital cannot replace the captured request after self-consistent rehashing',async()=>{
 const input=copy(negativeRun.artifact.input);input.initialCapital+=100;const artifact=await m.replayDemo(input);await m.verifyDemoArtifact(artifact);
 const forged=await resealRun({...negativeRun,artifact,comparison:null,status:'UNAVAILABLE',reason:'EVALUATOR_FAILURE'});await assert.rejects(()=>m.verifyExperimentRun(forged),/captured manifest/);
});

test('a valid comparison from another claimed artifact cannot be relabelled to the retained result',async()=>{
 const forged=copy(negativeRun);forged.comparison.identity.claimedArtifact='e'.repeat(64);const {reportDigest,...body}=forged.comparison;forged.comparison.reportDigest=await m.strategyDigest(JSON.stringify(body));await m.verifyComparisonReport(forged.comparison);
 await assert.rejects(async()=>m.verifyExperimentRun(await resealRun(forged)),/actual retained result/);
});

test('known raw and percent-encoded agent credentials in self-hashed audit output cannot be retained',async()=>{
 for(const secret of ['og_agent_'+id(99)+'.'+'a'.repeat(64),'%6f%67%5f%61%67%65%6e%74%5f'+id(99)+'.'+'a'.repeat(64)]){
  const forged=copy(negativeRun);forged.artifact.audit[0].details=secret;forged.artifact.resultDigest=await m.demoArtifactDigest(forged.artifact);forged.comparison=null;forged.status='UNAVAILABLE';forged.reason='EVALUATOR_FAILURE';await m.verifyDemoArtifact(forged.artifact);
  await assert.rejects(async()=>m.verifyExperimentRun(await resealRun(forged)),/Credentials/);
 }
});

test('public-source rechecks reject changed parent/input instead of silently evaluating the replacement',async()=>{
 const changed=copy(signalBundle);changed.manifest.record.content.input.initialCapital+=10;changed.manifest=await resealManifest(changed.manifest);
 await assert.rejects(()=>m.assertExperimentRunSources(negativeRun,changed.manifest,changed.source),e=>e.status===409);assert.deepEqual(await m.assertExperimentRunSources(negativeRun,signalBundle.manifest,signalBundle.source),negativeRun);
});

test('publication preparation requires explicit consent and preserves the exact adverse artifact and retry IDs',async()=>{
 for(const consent of [undefined,{}, {confirmPublicSharing:false}])await assert.rejects(()=>m.prepareExperimentRunOutcome(negativeRun,consent),e=>e.status===403);
 await assert.rejects(async()=>m.prepareExperimentRunOutcome(await admission(signalBundle,13),{confirmPublicSharing:true}),e=>e.status===409);
 const command=await m.prepareExperimentRunOutcome(negativeRun,{confirmPublicSharing:true});assert.equal(command.action,'outcome');assert.equal(command.requestId,negativeRun.outcomeRequestId);assert.equal(command.id,negativeRun.outcomeId);assert.deepEqual(command.manifest,{id:negativeRun.captured.manifest.id,digest:negativeRun.captured.manifest.digest});
 assert.equal(command.result.kind,'ARTIFACT');assert.deepEqual(command.result.artifact,negativeRun.artifact);assert.equal(command.claim.type,'ORIGINAL');assert.equal(command.claim.relation,null);assert(command.claim.sharedDependencies.length>0);assert(/does not establish independent/.test(command.claim.conflicts));assert.equal('comparison'in command,false);assert.deepEqual(await m.prepareExperimentRunOutcome(negativeRun,{confirmPublicSharing:true}),command);
});

test('complete local artifacts above the registry limit remain unchanged and prepare an honest unavailable report',async()=>{
 const input=copy(signalBundle.manifest.record.content.input);input.signals=[];input.emergencyStopAt=null;const step=3600000,start=Date.parse('2025-01-01T01:00:00.000Z');input.dataset.bars=Array.from({length:1500},(_,n)=>({closedAt:new Date(start+n*step).toISOString(),open:100,high:100,low:100,close:100,volume:1}));
 const bundle=await withInput(input);assert(bytes(bundle.manifest.record.content.input)<m.experimentLimits.inputBytes);
 const run=await m.evaluateExperimentRun(await admission(bundle,14),{finishedAt:U});assert.equal(run.status,'EVALUATED');assert.equal(run.artifact.status,'NO_TRADES');assert(bytes(run.artifact)>m.experimentLimits.artifactBytes);assert(bytes(run.artifact)<m.demoLimits.artifactBytes);const unchanged=JSON.stringify(run);
 const command=await m.prepareExperimentRunOutcome(run,{confirmPublicSharing:true});assert.equal(command.result.kind,'ARTIFACT_UNAVAILABLE');assert(/without truncation/.test(command.result.reason));assert.equal('metrics'in command.result,false);assert.equal(JSON.stringify(run),unchanged);assert.equal(run.artifact.equity.length,1500);await m.verifyExperimentRun(run);
});

test('explicit unavailable terminal evidence has no fabricated artifact and remains a safe existing-schema report',async()=>{
 const run=await admission(signalBundle,15),unavailable=await resealRun({...run,status:'UNAVAILABLE',reason:'EVALUATOR_FAILURE',finishedAt:U});await m.verifyExperimentRun(unavailable);
 const command=await m.prepareExperimentRunOutcome(unavailable,{confirmPublicSharing:true});assert.equal(command.result.kind,'ARTIFACT_UNAVAILABLE');assert.equal('artifact'in command.result,false);assert.equal(command.requestId,run.outcomeRequestId);
});

test('partial cancellation retains a valid primary artifact, while input-null rejected artifacts cannot be substituted',async()=>{
 const interrupted=await resealRun({...negativeRun,status:'INTERRUPTED',reason:'USER_CANCELLED',comparison:null});await m.verifyExperimentRun(interrupted);const command=await m.prepareExperimentRunOutcome(interrupted,{confirmPublicSharing:true});assert.equal(command.result.kind,'INTERRUPTED');assert.deepEqual(interrupted.artifact,negativeRun.artifact);
 const rejected=await m.replayDemo({});assert.equal(rejected.status,'REJECTED');assert.equal(rejected.input,null);const unavailable=await resealRun({...negativeRun,status:'UNAVAILABLE',reason:'EVALUATOR_FAILURE',artifact:rejected,comparison:null});await assert.rejects(()=>m.verifyExperimentRun(unavailable),/captured manifest/);
});
