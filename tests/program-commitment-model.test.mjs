import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {loadProgramForwardTestModule,programForwardFixture} from './program-forward-fixtures.mjs';
import {programDirectionForwardFixture,loadProgramDirectionForwardTestModule} from './program-direction-forward-fixtures.mjs';
import {loadProgramForwardEvidenceModules} from './program-forward-evidence-fixtures.mjs';

const result=await build({stdin:{contents:"export * from './app/program-commitment-model';export * from './app/program-commitment-link';",resolveDir:process.cwd()},bundle:true,write:false,metafile:true,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const m=module.exports,clone=structuredClone,bytes=value=>Buffer.byteLength(JSON.stringify(value));
const registeredAt='2026-02-01T00:02:00.000Z';
let legacyPromise,directionPromise,evidencePromise;
function legacyFixture(){return legacyPromise??=(async()=>{
 const p=await loadProgramForwardTestModule(),example=await p.syntheticProgramSearchExample(),origin=Date.parse('2025-01-01T00:00:00.000Z'),hour=3600000;
 // Declare this entire new four-bar TRAIN/TEST trial before any plan admission.
 const bars=(prices,offset)=>prices.map((price,n)=>({closedAt:new Date(origin+(n+offset)*hour).toISOString(),open:price,close:price,high:price*1.001,low:price*.999,volume:1000}));
 example.admission.train.dataset.bars=bars([100,102,104,108],1);example.testInput.dataset.bars=bars([100,99,95,93],7);example.admission.createdAt=example.admission.train.dataset.bars.at(-1).closedAt;example.admission.test.firstClosedAt=example.testInput.dataset.bars[0].closedAt;example.admission.test.barCount=4;
 let ledger=await p.createProgramSearchLedger(await p.createProgramSearchPlan(example.admission)),clock=Date.parse('2026-02-01T00:00:00.000Z');
 for(const candidate of example.admission.candidates){ledger=await p.admitProgramSearchTrain(ledger,candidate.source.id,new Date(clock++).toISOString());ledger=await p.finishProgramSearchAttempt(ledger,await p.evaluateProgramSearchAttempt(p.pendingProgramSearchAttempt(ledger),{finishedAt:new Date(clock++).toISOString()}));}
 ledger=await p.lockProgramSearchSelection(ledger,new Date(clock++).toISOString());assert.equal(ledger.selection.decision,'SELECTED');ledger=await p.admitProgramSearchTest(ledger,example.testInput,new Date(clock++).toISOString());ledger=await p.finishProgramSearchAttempt(ledger,await p.evaluateProgramSearchAttempt(p.pendingProgramSearchAttempt(ledger),{finishedAt:new Date(clock++).toISOString()}));
 const handoff=await p.createLockedProgramSearchHandoff(ledger),config=p.boundedProgramSessionConfig({version:1,kind:'LOCAL_PROGRAM_SESSION_CONFIG',sessionId:crypto.randomUUID(),methodVersion:p.programSessionVersion,clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record:handoff.winner.source.record,digest:handoff.winner.source.digest},initialCapital:handoff.initialCapital,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'Known invented prices and actor snapshots; local computational fixture only.'},sourceLabel:'Invented prospective declaration',ordersEnabled:false,liveEnabled:false}).config;
 const plan=await p.createProgramForwardPlan({mode:'PROSPECTIVE',handoff,config,preparedAt:'2026-02-01T00:01:00.000Z',startsAt:'2026-02-02T00:00:00.000Z',endsAt:'2026-02-02T04:00:00.000Z',pollMs:15000,cycles:10});return {plan,p,ledger};
})();}
function directionFixture(){return directionPromise??=programDirectionForwardFixture({prospective:true});}
function evidenceFixture(){return evidencePromise??=(async()=>{
 const f=await directionFixture(),e=await loadProgramForwardEvidenceModules();let journal=await e.createProgramSessionJournal(f.config,f.plan.startsAt);
 const eventAt=new Date(Date.parse(f.plan.startsAt)+3600000).toISOString();journal=await e.executeProgramSessionPending(await e.admitProgramSessionEvent(journal,{requestId:crypto.randomUUID(),type:'CLOSED_BAR',bar:{closedAt:eventAt,open:100,high:100,low:100,close:100,volume:10}},eventAt),{clock:()=>new Date(Date.parse(eventAt)+10).toISOString()});
 const next=new Date(Date.parse(eventAt)+1000).toISOString();journal=await e.admitProgramSessionEvent(journal,{requestId:crypto.randomUUID(),type:'PAUSE'},next);journal=await e.recoverProgramSessionJournal(journal,next);
 return {f,e,journal,artifact:await e.snapshotProgramForwardEvidence(journal,f.plan)};
})();}
function sealInput(e,input){const {inputDigest,...body}=input;void inputDigest;return e.sealProgramForwardEvidenceInput(body);}

test('complete prospective legacy and direction plans retain every losing/no-trade trial without converting either method',async()=>{
 const [legacy,direction]=await Promise.all([legacyFixture(),directionFixture()]);
 for(const f of [legacy,direction]){
  assert(bytes(f.plan)<=m.programCommitmentLimits.inputBytes,bytes(f.plan));assert.equal(f.plan.handoff.ledger.attempts.length,3);assert.equal(f.plan.handoff.ledger.attempts.at(-1).phase,'TEST');assert(f.plan.handoff.ledger.attempts.at(-1).outcome.artifact.metrics.netPnl<0);assert(f.plan.handoff.ledger.attempts.some(attempt=>attempt.phase==='TRAIN'&&attempt.outcome.artifact?.status==='NO_TRADES'));
  assert.deepEqual(await m.verifyProgramCommitmentPlan(f.plan),f.plan);assert.equal(m.boundedProgramCommitmentInput(f.plan).payload,JSON.stringify(f.plan));assert.deepEqual(m.programCommitmentDependencies(f.plan).map(item=>item.id).sort(),f.plan.handoff.ledger.plan.admission.candidates.map(item=>item.source.id).sort());assert.equal(f.plan.qualification,'NONE');assert.equal(f.plan.clockEvidence,'AUTHOR_DECLARED');
 }
 assert.equal(legacy.plan.version,1);assert.equal(direction.plan.version,2);assert.equal(direction.plan.handoff.method,'DIRECTION_MATCHED_TRAIN_RETURN_V1');
});

test('prospective commitment rejects playback, omitted losing trials, corrupt pins and already observed input wrappers',async()=>{
 const {plan}=await directionFixture(),playback=await programDirectionForwardFixture();await assert.rejects(m.verifyProgramCommitmentPlan(playback.plan));
 for(const edit of [p=>p.handoff.ledger.attempts.splice(1,1),p=>p.implementation.forward.model='f'.repeat(64),p=>p.config.initialCapital++,p=>p.config.strategy.record.content.program.parameters[0]++,p=>p.endsAt=p.startsAt,p=>p.events=[]]){const changed=clone(plan);edit(changed);await assert.rejects(m.verifyProgramCommitmentPlan(changed));}
 await assert.rejects(m.verifyProgramCommitmentPlan({kind:'PROGRAM_FORWARD_DEMO_INPUT',plan}));await assert.rejects(m.verifyProgramCommitmentPlan({planDigest:plan.planDigest}));
});

test('descriptor guards refuse hooks, sparse arrays, nonfinite values, credentials and nested overflow before executing supplied accessors',()=>{
 let touched=0;for(const raw of [{get plan(){touched++;return{};}},{toJSON(){touched++;return{};}},Object.defineProperty({},'hidden',{value:'concealed'}),{array:[,1]},{array:NaN},{array:Infinity},{value:-0},{value:'Bearer invented-private-secret'}, {value:'og_local_producer_invented-secret'}, {value:'%6f%67%5f%61%67%65%6e%74%5fsecret'}, {[Symbol('hidden')]:'value'}])assert.throws(()=>m.boundedProgramCommitmentValue(raw));
 assert.equal(touched,0);let deep={};for(let n=0;n<=m.programCommitmentLimits.maximumDepth;n++)deep={next:deep};assert.throws(()=>m.boundedProgramCommitmentValue(deep),error=>error.status===413);
 const cyclic={};cyclic.self=cyclic;assert.throws(()=>m.boundedProgramCommitmentValue(cyclic));
});

test('complete public input bound refuses a genuinely oversized valid plan intact, never replacing it with its digest',async()=>{
 const p=await loadProgramForwardTestModule(),large=await programForwardFixture({prospective:true});assert(bytes(large.plan)>m.programCommitmentLimits.inputBytes);assert.deepEqual(await p.verifyProgramForwardPlan(large.plan),large.plan);const before=JSON.stringify(large.plan);await assert.rejects(m.verifyProgramCommitmentPlan(large.plan),error=>error.status===413);assert.equal(JSON.stringify(large.plan),before);
 const {plan}=await directionFixture(),changed=clone(plan);changed.config.rights.note='x'.repeat(m.programCommitmentLimits.inputBytes);await assert.rejects(m.verifyProgramCommitmentPlan(changed),error=>error.status===413);
 assert.throws(()=>m.boundedProgramCommitmentValue({text:'é'.repeat(m.programCommitmentLimits.inputBytes/2)}),error=>error.status===413);
});

test('later whole V4 input/artifact links retain the exact committed plan and interrupted evidence without independent qualification',async()=>{
 const {f,artifact}=await evidenceFixture();assert.equal(artifact.journal.events.at(-1).status,'INTERRUPTED');assert.deepEqual(await m.verifyProgramCommitmentEvidenceInput(f.plan,artifact.input,registeredAt),artifact.input);assert.deepEqual(await m.verifyProgramCommitmentEvidenceArtifact(f.plan,artifact,registeredAt),artifact);assert.equal(artifact.qualification,'NONE');assert.equal(artifact.generatorIndependence,'NOT_ESTABLISHED');
});

test('matching plan copies and repaired outer digests cannot admit corrupt pins or omitted retained trials',async()=>{
 const {f,e,artifact}=await evidenceFixture();
 for(const edit of [plan=>plan.implementation.forward.model='f'.repeat(64),plan=>plan.handoff.ledger.attempts.splice(1,1)]){
  const plan=clone(f.plan);edit(plan);const {planDigest,...planBody}=plan;void planDigest;plan.planDigest=await e.programForwardEvidenceDigest(planBody);
  const forged=clone(artifact);forged.input.plan=clone(plan);const {inputDigest,...inputBody}=forged.input;void inputDigest;forged.input.inputDigest=await e.programForwardEvidenceDigest(inputBody);forged.inputDigest=forged.input.inputDigest;
  const {resultDigest,...artifactBody}=forged;void resultDigest;forged.resultDigest=await e.programForwardEvidenceDigest(artifactBody);
  await assert.rejects(m.verifyProgramCommitmentEvidenceInput(plan,forged.input,registeredAt));
  await assert.rejects(m.verifyProgramCommitmentEvidenceArtifact(plan,forged,registeredAt));
 }
});

test('evidence checks detach registration before awaiting and refuse supplied plan accessors',async()=>{
 const {f,artifact}=await evidenceFixture();
 for(const [verify,evidence]of [[m.verifyProgramCommitmentEvidenceInput,artifact.input],[m.verifyProgramCommitmentEvidenceArtifact,artifact]]){
  const plan=clone(f.plan),pending=verify(plan,evidence,registeredAt);plan.config.initialCapital++;plan.handoff.ledger.attempts.length=0;
  assert.deepEqual(await pending,evidence);assert.deepEqual(artifact.input.plan,f.plan);
  const hooked=clone(f.plan);let touched=0;Object.defineProperty(hooked,'config',{enumerable:true,get(){touched++;throw Error('Supplied accessor executed');}});
  await assert.rejects(verify(hooked,evidence,registeredAt));assert.equal(touched,0);
 }
});

test('evidence binding rejects late registration, changed complete plan/config/session, earlier admission and original pre-admission receipts',async()=>{
 const {f,e,artifact}=await evidenceFixture();
 for(const at of [f.plan.startsAt,new Date(Date.parse(f.plan.startsAt)+1).toISOString(),'not a timestamp'])await assert.rejects(m.verifyProgramCommitmentEvidenceInput(f.plan,artifact.input,at));
 const modifiedPlan=clone(f.plan);modifiedPlan.config.sourceLabel='Another exact declaration';const dp=await loadProgramDirectionForwardTestModule(),otherPlan=await dp.createProgramDirectionForwardPlan({mode:modifiedPlan.mode,handoff:modifiedPlan.handoff,config:modifiedPlan.config,preparedAt:modifiedPlan.preparedAt,startsAt:modifiedPlan.startsAt,endsAt:modifiedPlan.endsAt,pollMs:modifiedPlan.pollMs,cycles:modifiedPlan.cycles});
 await assert.rejects(m.verifyProgramCommitmentEvidenceInput(otherPlan,artifact.input,registeredAt),/registered plan/);
 const absent=clone(artifact.input);absent.plan=null;await assert.rejects(m.verifyProgramCommitmentEvidenceInput(f.plan,await sealInput(e,absent),registeredAt),/registered plan/);
 const changed=clone(artifact.input);changed.events[0].receivedAt=new Date(Date.parse(changed.startedAt)-1).toISOString();await assert.rejects(m.verifyProgramCommitmentEvidenceInput(f.plan,await sealInput(e,changed),registeredAt),/session admission/);
 const pending=clone(artifact.input);pending.pending={sequence:pending.events.length+1,event:{requestId:crypto.randomUUID(),type:'PAUSE'},receivedAt:new Date(Date.parse(pending.startedAt)-1).toISOString()};await assert.rejects(m.verifyProgramCommitmentEvidenceInput(f.plan,await sealInput(e,pending),registeredAt),/session admission/);
 const warmup=clone(artifact.input);warmup.events[0].event.bar.closedAt=new Date(Date.parse(warmup.startedAt)-3600000).toISOString();const warmupInput=await sealInput(e,warmup);assert.deepEqual(await m.verifyProgramCommitmentEvidenceInput(f.plan,warmupInput,registeredAt),warmupInput);
 const modified=clone(artifact.input);modified.startedAt=new Date(Date.parse(f.plan.startsAt)-1).toISOString();await assert.rejects(m.verifyProgramCommitmentEvidenceInput(f.plan,modified,registeredAt));
 const foreign=clone(artifact);foreign.input.config.sessionId=crypto.randomUUID();await assert.rejects(m.verifyProgramCommitmentEvidenceArtifact(f.plan,foreign,registeredAt));
});

test('link references require exact separate manifest/outcome identities and the outcome’s real parent',()=>{
 const manifest={id:crypto.randomUUID(),digest:'1'.repeat(64)},outcome={id:crypto.randomUUID(),digest:'2'.repeat(64)},link={kind:'FORWARD_EVIDENCE_LINK',manifest,outcome};assert.deepEqual(m.verifyProgramCommitmentEvidenceLink(link,manifest,outcome,manifest),link);
 for(const args of [[link,{...manifest,digest:'f'.repeat(64)},outcome,manifest],[link,manifest,{...outcome,id:crypto.randomUUID()},manifest],[link,manifest,outcome,outcome],[{...link,artifact:{}},manifest,outcome,manifest],[{...link,outcome:manifest},manifest,manifest,manifest]])assert.throws(()=>m.verifyProgramCommitmentEvidenceLink(...args));
});

test('commitment navigation accepts only exact bounded canonical manifest queries and never invokes supplied href hooks',()=>{
 const reference={id:'12345678-1234-4123-8123-123456789abc',digest:'a'.repeat(64)},href=m.programCommitmentHref(reference);assert.equal(href,'/commitments?manifest='+reference.id+'&digest='+reference.digest);assert.deepEqual(m.programCommitmentSelectionFromQuery(href.split('?')[1]),reference);assert.deepEqual(m.programCommitmentSelectionFromQuery(new URLSearchParams({manifest:reference.id,digest:reference.digest})),reference);assert.equal(m.programCommitmentSelectionFromQuery(''),null);
 for(const query of ['manifest='+reference.id,'digest='+reference.digest,'manifest='+reference.id+'&digest='+reference.digest+'&digest='+reference.digest,'id='+reference.id+'&digest='+reference.digest,'manifest='+reference.id+'&digest='+reference.digest+'&review=extra','manifest='+reference.id.toUpperCase()+'&digest='+reference.digest,'manifest='+reference.id+'&digest='+reference.digest.toUpperCase(),'manifest='+reference.id+'&digest='+reference.digest+'&x='+('x'.repeat(512))])assert.throws(()=>m.programCommitmentSelectionFromQuery(query));
 let touched=0;assert.throws(()=>m.programCommitmentHref({get id(){touched++;return reference.id;},digest:reference.digest}));assert.equal(touched,0);assert.throws(()=>m.programCommitmentHref({...reference,source:'extra'}));assert.throws(()=>m.programCommitmentSelectionFromQuery({toString(){touched++;return '';} }));assert.equal(touched,0);
});

test('actual commitment compilation contains pure verification only and cannot import runners, HTTP, storage or guest invocation',()=>{
 const paths=Object.keys(result.metafile.inputs);for(const forbidden of ['app/experiment-model.ts','app/experiment-store.ts','app/experiment-http.ts','app/program-run.ts','app/program-direction-search.ts','app/program-search-protocol.ts','app/program-session-engine.ts','app/program-session-journal.ts','app/session-engine.ts','app/session-journal.ts','app/program-forward-plan.ts','app/program-direction-forward-plan.ts','app/program-forward-evidence.ts','app/demo-engine.ts','app/reference-engine.ts'])assert(!paths.includes(forbidden),forbidden);
 for(const invocation of ['function invokeProgram(','function createProgramInstance(','function replayDemo(','function executeProgramSessionTransition('])assert(!result.outputFiles[0].text.includes(invocation),invocation);
 assert(paths.includes('app/program-forward-plan-dispatch-model.ts'));assert(paths.includes('app/program-forward-evidence-model.ts'));
});
