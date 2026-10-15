import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {fittingProgramForwardEvidenceFixture} from './program-forward-evidence-fixtures.mjs';
import {forwardDemoFixture} from './forward-demo-fixtures.mjs';
import {cleanupForwardDemoModules} from '../scripts/forward-demo-core.mjs';
import {programDirectionForwardFixture,loadProgramDirectionForwardTestModule} from './program-direction-forward-fixtures.mjs';
import {programForwardFixture} from './program-forward-fixtures.mjs';
import {programReceiverInstance} from '../scripts/program-session-receiver-protocol.mjs';
import {receiverInstance} from '../scripts/session-receiver-protocol.mjs';
import {runRecordedProgramCollector,cleanupRecordedProgramModules} from '../scripts/recorded-program-kraken-core.mjs';
import {runRecordedDirectionProgramCollector,cleanupRecordedDirectionProgramModules} from '../scripts/recorded-direction-program-kraken-core.mjs';
import {runRecordedProducer} from '../scripts/recorded-kraken-market-data-core.mjs';
import {programWindowObservationFixture} from './program-window-observation-fixtures.mjs';

let m;
before(async()=>{
 const result=await build({stdin:{contents:"export * from './app/session-model';export * from './app/session-engine';export * from './app/session-journal';export * from './app/session-evidence';export * from './app/session-evidence-model';export * from './app/session-implementation-registry';export * from './app/program-forward-evidence';export * from './app/program-forward-evidence-model';export * from './app/program-forward-comparison-model';export {verifyProgramForwardPlan,createProgramForwardHistory} from './app/program-forward-plan';export {programSessionImplementation} from './app/program-session-model';export {verifyProgramSessionJournal,createProgramSessionJournalForImplementation,admitProgramSessionEvent,executeProgramSessionPending,recoverProgramSessionJournal} from './app/program-session-journal';export * as legacySession from './app/compat/session-20261011/session-journal';export * as legacyProgram from './app/compat/session-20261011/program-session-journal';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',target:'es2022'}),module={exports:{}};
 new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);m=module.exports;
});
after(cleanupForwardDemoModules);
after(()=>{cleanupRecordedProgramModules();cleanupRecordedDirectionProgramModules();});
const retained=()=>JSON.parse(readFileSync('examples/sessions/20261011/signal-open.json','utf8'));
async function reseal(value,field,digest=m.programForwardEvidenceDigest){const {[field]:_,...body}=value;value[field]=await digest(body);return value;}

test('retained 20261011 journals replay their actual archived implementation and preserve all original bytes',async()=>{
 for(const name of ['signal-open','emergency-awaiting-quote','emergency-adverse-exit']){
  const path='examples/sessions/20261011/'+name+'.json',bytes=readFileSync(path),journal=JSON.parse(bytes);
  assert.equal(m.sessionImplementationKind(journal.implementation),'LEGACY_20261011');
  assert.deepEqual(await m.reconstructSessionJournal(journal),journal);
  const bundle=await m.snapshotSessionEvidence(journal),report=await m.reviewSessionEvidence(bundle.result.artifact);
  assert.equal(report.status,'MATCH');assert.deepEqual(report.implementation,journal.implementation);
  assert.equal(bundle.input.journalDigest,journal.journalDigest);assert.deepEqual(readFileSync(path),bytes);
 }
 const old=retained(),fresh=await m.createSessionJournal(old.config,old.startedAt);
 assert.equal(m.sessionImplementationKind(fresh.implementation),'CURRENT');assert.notDeepEqual(fresh.implementation,old.implementation);
 for(const key of ['engine','model','journal'])assert.equal(fresh.implementation[key],createHash('sha256').update(readFileSync('app/session-'+key+'.ts')).digest('hex'));
 const continued=await m.appendSessionEvent(old,{requestId:crypto.randomUUID(),type:'PAUSE'},old.state.lastReceivedAt);
 assert.deepEqual(continued.implementation,old.implementation);assert.deepEqual(await m.reconstructSessionJournal(continued),continued);
 for(const name of ['signal-open','emergency-awaiting-quote','emergency-adverse-exit'])await assert.rejects(m.reconstructSessionJournal(JSON.parse(readFileSync('examples/sessions/'+name+'.json','utf8'))),/source version/);
});

test('canonical state hashing retains strict schema, hook rejection and detached snapshots',async()=>{
 const fixture=retained();let state=await m.createSession(fixture.config,fixture.startedAt);
 for(const row of fixture.events)state=await m.advanceSession(state,row.event,row.receivedAt);
 const before=structuredClone(state),reverse=value=>Object.fromEntries(Object.entries(value).reverse()),reordered={...reverse(state),config:reverse(state.config),events:state.events.map(reverse)};
 assert.deepEqual(await m.verifySessionState(reordered),state);assert.equal(await m.sessionStateDigest(reordered),state.stateDigest);
 const next=await m.advanceSession(state,{requestId:crypto.randomUUID(),type:'PAUSE'},state.lastReceivedAt);
 assert.deepEqual(state,before);assert.notEqual(next.events,state.events);assert.notEqual(next.events[0],state.events[0]);assert.equal(next.stateDigest,await m.sessionStateDigest(next));
 await assert.rejects(m.sessionStateDigest({...next,extra:true}));await assert.rejects(m.advanceSession({...next,extra:true},{requestId:crypto.randomUUID(),type:'RESUME'},next.lastReceivedAt));
 let invoked=0;const hostile=structuredClone(next);Object.defineProperty(hostile.events[0],'reason',{enumerable:true,get(){invoked++;throw Error('Hook ran');}});
 await assert.rejects(m.verifySessionState(hostile));assert.equal(invoked,0);
});

test('unknown and mixed Session tuples fail; self-hashed false legacy state cannot become a successful replay',async()=>{
 const original=retained(),fresh=await m.createSessionJournal(original.config,original.startedAt);
 for(const implementation of [{...original.implementation,engine:'f'.repeat(64)},{...original.implementation,model:fresh.implementation.model}]){
  const changed=await reseal({...structuredClone(original),implementation},'journalDigest');
  assert.equal(m.sessionImplementationKind(implementation),null);await assert.rejects(m.verifySessionJournal(changed),/source version/);
 }
 const falseState=structuredClone(original);falseState.state.account.equity++;
 falseState.state.stateDigest=await m.sessionStateDigest(falseState.state);falseState.events.at(-1).stateDigest=falseState.state.stateDigest;await reseal(falseState,'journalDigest');
 await m.verifySessionJournal(falseState);await assert.rejects(m.reconstructSessionJournal(falseState),/reconstruct/);
});

test('historical ordinary and direction-matched forward plans keep their exact digests and refuse mixed startup',async()=>{
 const ordinary=await forwardDemoFixture(),current=await ordinary.model.createForwardDemoPlan({handoff:ordinary.handoff,config:ordinary.config,preparedAt:'2026-01-01T00:00:00.000Z',startsAt:'2026-01-02T00:00:00.000Z',endsAt:'2026-02-02T00:00:00.000Z',pollMs:15000,cycles:2});
 const historical=await reseal({...current,implementations:{...current.implementations,session:m.legacySessionImplementation()}},'planDigest');
 assert.deepEqual(await ordinary.model.verifyForwardDemoPlan(historical),historical);assert.notEqual(historical.planDigest,current.planDigest);
 const unknown=await reseal({...historical,implementations:{...historical.implementations,session:{...historical.implementations.session,engine:'f'.repeat(64)}}},'planDigest');await assert.rejects(ordinary.model.verifyForwardDemoPlan(unknown),/identity/);
 const d=await loadProgramDirectionForwardTestModule(),direction=await programDirectionForwardFixture(),plan=await reseal({...direction.plan,implementation:m.legacyProgramSessionImplementation()},'planDigest');
 assert.deepEqual(await d.verifyProgramDirectionForwardPlan(plan),plan);
 const journal=await m.createProgramSessionJournalForImplementation(plan.config,plan.startsAt,plan.implementation);
 assert.deepEqual((await d.createProgramDirectionForwardHistory(plan,journal)).journal.implementation,plan.implementation);
 await assert.rejects(d.createProgramDirectionForwardHistory(plan,await d.createProgramSessionJournal(plan.config,plan.startsAt)),/source identities/);
 await assert.rejects(m.createProgramSessionJournalForImplementation(plan.config,plan.startsAt,{...plan.implementation,kernel:{...plan.implementation.kernel,model:'f'.repeat(64)}}),/Unknown/);
});

test('complete legacy planned V4 evidence keeps its original graph and exact journal through same-implementation replay',async()=>{
 // A fresh synthetic compatibility exercise through the exact archived code;
 // this creates no replacement for any retained historical fixture.
 const fixture=await fittingProgramForwardEvidenceFixture(),plan=await reseal({...fixture.plan,implementation:m.legacyProgramSessionImplementation()},'planDigest');
 assert.deepEqual(await m.verifyProgramForwardPlan(plan),plan);
 let journal=await m.createProgramSessionJournalForImplementation(plan.config,plan.startsAt,plan.implementation);
 for(const row of fixture.journal.events){journal=await m.admitProgramSessionEvent(journal,row.event,row.receivedAt);journal=row.status==='INTERRUPTED'?await m.recoverProgramSessionJournal(journal,row.completedAt):await m.executeProgramSessionPending(journal,{clock:()=>row.completedAt});}
 const history=await m.createProgramForwardHistory(plan,journal);assert.deepEqual(history.journal.implementation,plan.implementation);
 await assert.rejects(m.createProgramForwardHistory(fixture.plan,journal),/source identities/);
 const artifact=await m.snapshotProgramForwardEvidence(journal,plan),before=JSON.stringify(artifact),result=await m.compareProgramForwardEvidence(artifact);
 assert.equal(result.report.status,'MATCH');assert.equal(result.report.generator,'SAME_IMPLEMENTATION_RECONSTRUCTION');
 assert.deepEqual(result.report.implementations,plan.implementation);assert.deepEqual(result.reconstructed.journal,journal);assert.equal(result.reconstructed.inputDigest,artifact.inputDigest);assert.equal(JSON.stringify(artifact),before);
 assert.equal(m.programSessionImplementationKind(fixture.journal.implementation),'CURRENT');assert.notDeepEqual(fixture.journal.implementation,plan.implementation);
 for(const implementation of [{...plan.implementation,kernel:{...plan.implementation.kernel,model:fixture.journal.implementation.kernel.model}},{...plan.implementation,forward:fixture.journal.implementation.forward}]){
  assert.equal(m.programSessionImplementationKind(implementation),null);const changed=await reseal({...artifact.input,implementation},'inputDigest');await assert.rejects(m.verifyProgramForwardEvidenceInput(changed),/identity/);
 }
 const mixed=structuredClone(fixture.journal);mixed.trading.implementation=journal.trading.implementation;await reseal(mixed.trading,'journalDigest');await reseal(mixed,'journalDigest');
 await assert.rejects(m.verifyProgramSessionJournal(mixed),/implementation/);await assert.rejects(m.verifyProgramForwardJournal(mixed),/source identity/);
 const falseJournal=structuredClone(journal);falseJournal.guest.state.globals[0]=777;falseJournal.guest.state.globalBits[0]='09030000';falseJournal.guest.stateDigest=await m.programForwardEvidenceDigest(falseJournal.guest.state);falseJournal.guest.trace.at(-1).stateDigest=falseJournal.guest.stateDigest;
 for(const row of falseJournal.events)if(row.guestTraceLength===falseJournal.guest.trace.length)row.guestStateDigest=falseJournal.guest.stateDigest;
 await reseal(falseJournal,'journalDigest');const falseArtifact=await m.sealProgramForwardEvidenceArtifact(artifact.input,falseJournal,crypto.randomUUID());
 assert.equal((await m.compareProgramForwardEvidence(falseArtifact)).report.status,'MISMATCH');
});

test('current raw collectors reject historical plans before source, receiver or archive operations',async()=>{
 let operations=0;const touched=()=>{operations++;throw Error('Unexpected external operation');};
 for(const [fixture,run]of [[await programForwardFixture({prospective:true}),runRecordedProgramCollector],[await programDirectionForwardFixture({prospective:true}),runRecordedDirectionProgramCollector]]){
  const plan=await reseal({...fixture.plan,implementation:m.legacyProgramSessionImplementation()},'planDigest'),authorization={receiverOrigin:'http://127.0.0.1:23456',receiverStartedAt:plan.startsAt,receiverImplementation:m.programSessionImplementation(),producerToken:'og_local_producer_'+'a'.repeat(64),publicDataUseApproved:true,sharedIpRateBudgetApproved:true,pollMs:plan.pollMs,cycles:plan.cycles};
  authorization.sessionInstance=programReceiverInstance({config:fixture.config,startedAt:authorization.receiverStartedAt,implementation:authorization.receiverImplementation});
  await assert.rejects(run({command:'start',plan,config:fixture.config,authorization,archive:{check:touched},journalPath:'/unused',dataRetentionApproved:true,responseMode:'SYNTHETIC_RESPONSES',sourceFetch:touched,receiverFetch:touched}),/FORWARD_CONTEXT_MISMATCH/);
 }
 const ordinary=await forwardDemoFixture(),current=await ordinary.model.createForwardDemoPlan({handoff:ordinary.handoff,config:ordinary.config,preparedAt:'2026-01-01T00:00:00.000Z',startsAt:'2026-01-02T00:00:00.000Z',endsAt:'2026-02-02T00:00:00.000Z',pollMs:15000,cycles:2}),plan=await reseal({...current,implementations:{...current.implementations,session:m.legacySessionImplementation()}},'planDigest');
 const authorization={receiverOrigin:'http://127.0.0.1:23456',receiverStartedAt:plan.startsAt,receiverImplementation:plan.implementations.session,producerToken:'og_local_producer_'+'b'.repeat(64),publicDataUseApproved:true,sharedIpRateBudgetApproved:true,pollMs:plan.pollMs,cycles:plan.cycles};
 authorization.sessionInstance=receiverInstance({config:ordinary.config,startedAt:authorization.receiverStartedAt,implementation:authorization.receiverImplementation});
 await assert.rejects(runRecordedProducer({command:'start',plan,config:ordinary.config,authorization,archive:{check:touched},store:{},journalPath:'/unused',dataRetentionApproved:true,sourceFetch:touched,receiverFetch:touched}),/FORWARD_CONTEXT_MISMATCH/);
 assert.equal(operations,0);
});

test('window observations and complete packages bind the journal to the exact planned implementation',async()=>{
 const f=await programWindowObservationFixture();let journal=await m.createProgramSessionJournalForImplementation(f.input.plan.config,f.journal.startedAt,m.legacyProgramSessionImplementation());
 for(const row of f.journal.events){journal=await m.admitProgramSessionEvent(journal,row.event,row.receivedAt);journal=await m.executeProgramSessionPending(journal,{clock:()=>row.completedAt});}
 await assert.rejects(f.m.verifyProgramWindowObservations(f.input,f.archive,{journal,inspectedAt:f.inspectedAt}),/plan/);
 await assert.rejects(f.m.createProgramWindowObservationPackage(f.input,f.archive,journal),/plan/);
});
