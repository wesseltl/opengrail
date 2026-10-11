import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {forwardDemoFixture} from './forward-demo-fixtures.mjs';
import {cleanupForwardDemoModules} from '../scripts/forward-demo-core.mjs';

let m,f,plan;const copy=structuredClone;
const input=(changes={})=>({handoff:f.handoff,config:f.config,preparedAt:'2026-01-01T00:00:00.000Z',startsAt:'2026-01-02T00:00:00.000Z',endsAt:'2026-02-02T00:00:00.000Z',pollMs:15000,cycles:2,...changes});
const reseal=async(value,field)=>{const {[field]:_,...body}=copy(value);void _;return {...body,[field]:await m.strategyDigest(JSON.stringify(body))};};
before(async()=>{f=await forwardDemoFixture();m=f.model;plan=await m.createForwardDemoPlan(input());});
after(async()=>cleanupForwardDemoModules());

test('complete handoff freezes winning source/capital/risk and every TRAIN plus adverse TEST without mutation',async()=>{
 const original=JSON.stringify(f.ledger),h=await m.createLockedSearchHandoff(f.ledger);assert.equal(JSON.stringify(f.ledger),original);assert.deepEqual(h.ledger,f.ledger);assert.equal(h.ledger.attempts.length,3);const adverse=h.ledger.attempts.find(a=>a.phase==='TEST');assert(adverse.artifact.metrics.returnPct<0);assert.deepEqual(h.winner.source,f.ledger.plan.admission.candidates.find(c=>c.source.id===f.ledger.selection.selectedCandidateId).source);assert.deepEqual(h.costs,h.winner.source.record.content.definition.costs);assert.deepEqual(h.risk,h.winner.source.record.content.definition.risk);assert.equal(h.initialCapital,1000);assert.deepEqual(await m.verifyLockedSearchHandoff(h),h);assert.equal(h.handoffDigest,f.handoff.handoffDigest);
 const interrupted=await forwardDemoFixture({interruptedTest:true});assert.equal(interrupted.handoff.ledger.attempts.at(-1).status,'INTERRUPTED');assert.equal(interrupted.handoff.ledger.attempts.at(-1).reason,'RECOVERY_INTERRUPTED');await m.verifyLockedSearchHandoff(interrupted.handoff);
 let partial=await f.search.createSearchLedger(await f.search.createSearchPlan(f.fixture.admission));const [first,second]=f.fixture.admission.candidates;partial=await f.search.admitSearchTrain(partial,first.source.id,partial.events.at(-1).at);partial=await f.search.finishSearchAttempt(partial,await f.search.evaluateSearchAttempt(f.search.pendingSearchAttempt(partial),{finishedAt:partial.events.at(-1).at}));partial=await f.search.admitSearchTrain(partial,second.source.id,partial.events.at(-1).at);partial=await f.search.recoverSearchLedger(partial,partial.events.at(-1).at);partial=await f.search.lockSearchSelection(partial,partial.events.at(-1).at);const retained=await m.createLockedSearchHandoff(partial);assert.equal(retained.ledger.attempts[1].status,'INTERRUPTED');assert.equal(retained.ledger.selection.ranking[1].eligible,false);assert.equal(retained.winner.candidateId,first.source.id);
});
test('selected lock and all terminal attempts required; neither pending nor no selection is transferable',async()=>{
 await assert.rejects(()=>m.createLockedSearchHandoff(f.pending),/no pending/);await assert.rejects(()=>m.createLockedSearchHandoff(awaitless(f.ledger)),/Ledger digest|ordered history|complete TRAIN/);
 let initial=await f.search.createSearchLedger(await f.search.createSearchPlan(f.fixture.admission));await assert.rejects(()=>m.createLockedSearchHandoff(initial),/locked SELECTED/);
 for(const candidate of f.fixture.admission.candidates){initial=await f.search.admitSearchTrain(initial,candidate.source.id,initial.events.at(-1).at);initial=await f.search.recoverSearchLedger(initial,initial.events.at(-1).at);}const none=await f.search.lockSearchSelection(initial,initial.events.at(-1).at);assert.equal(none.selection.decision,'NO_SELECTION');await assert.rejects(()=>m.createLockedSearchHandoff(none),/locked SELECTED/);
});
function awaitless(ledger){const value=copy(ledger);value.attempts.pop();return value;}
test('self-rehashed winner, digest, capital, costs, risk, thesis and hidden history cannot alter handoff',async()=>{
 for(const change of [h=>h.winner.candidateId=h.ledger.plan.admission.candidates.find(c=>c.source.id!==h.winner.candidateId).source.id,h=>h.winner.source=copy(h.ledger.plan.admission.candidates.find(c=>c.source.id!==h.winner.candidateId).source),h=>h.initialCapital+=1,h=>h.costs.feeBps+=1,h=>h.risk.positionPct+=1,h=>h.hypothesis+=' changed',h=>h.falsification+=' changed',h=>h.ledger.attempts.pop()]){const value=copy(f.handoff);change(value);await assert.rejects(()=>reseal(value,'handoffDigest').then(v=>m.verifyLockedSearchHandoff(v)));}
});
test('ordinary receiver config stays exact; canonical digest and fixed source identities do not attest execution',async()=>{
 assert.deepEqual(plan.config,f.config);assert.equal(plan.configDigest,await m.strategyDigest(JSON.stringify(f.config)));assert.deepEqual(plan.implementations.session,{version:'opengrail-session-v1',...m.sessionSourceFingerprints});assert.deepEqual(plan.implementations.evaluators,m.evaluatorSourceFingerprints);for(const [file,pin] of [['app/session-engine.ts',plan.implementations.session.engine],['app/session-model.ts',plan.implementations.session.model],['app/session-journal.ts',plan.implementations.session.journal]])assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),pin);
 assert.deepEqual(await m.verifyForwardDemoPlan(plan),plan);assert.deepEqual(await m.createForwardDemoPlan(input()),plan);assert.equal(plan.classification,'AUTHOR_REPORTED');assert.equal(plan.qualification,'NONE');assert.equal(plan.independence,'NOT_ESTABLISHED');assert.equal(plan.providerAuthenticity,'NOT_ESTABLISHED');assert.equal(plan.clockEvidence,'AUTHOR_DECLARED');assert.equal(plan.ordersEnabled,false);assert.equal(plan.liveEnabled,false);assert(!Object.hasOwn(plan,'horizonCompleted'));assert(!Object.hasOwn(plan,'performance'));
});
test('config winner, capital, clock, source, provenance, data rights and arbitrary authority fields are rejected unchanged',async()=>{
 for(const change of [c=>c.initialCapital+=1,c=>c.strategy.record.content.definition.costs.feeBps+=1,c=>c.strategy.digest='0'.repeat(64),c=>c.clockMode='SYNTHETIC_PLAYBACK',c=>c.origin='SYNTHETIC_FIXTURE',c=>c.provenance='SYNTHETIC',c=>c.rights.permission='CREATED_SYNTHETIC',c=>c.rights.acknowledged=false,c=>c.rights.note=' '+c.rights.note,c=>c.ordersEnabled=true,c=>c.liveEnabled=true,c=>c.apiKey='fake']){const config=copy(f.config);change(config);await assert.rejects(()=>m.createForwardDemoPlan(input({config})));}
 for(const change of [p=>p.configDigest='0'.repeat(64),p=>p.implementations.session.engine='0'.repeat(64),p=>p.implementations.evaluators.reference='0'.repeat(64),p=>p.qualification='QUALIFIED',p=>p.independence='ESTABLISHED',p=>p.extraAuthority=true]){const value=copy(plan);change(value);await assert.rejects(()=>reseal(value,'planDigest').then(v=>m.verifyForwardDemoPlan(v)));}
});
test('strictly future nominal interval follows preparation and all retained TEST clocks without changing originals',async()=>{
 const latest=f.ledger.attempts.at(-1).finishedAt;
 for(const changes of [{startsAt:input().preparedAt},{startsAt:latest,preparedAt:'2024-01-01T00:00:00.000Z'},{endsAt:input().startsAt},{startsAt:'2026-01-02T00:00:00Z'},{preparedAt:'bad'},{pollMs:14999},{pollMs:3600001},{cycles:121},{cycles:0}])await assert.rejects(()=>m.createForwardDemoPlan(input(changes)));
 const old=JSON.stringify(f.ledger),after=await m.createForwardDemoPlan(input({startsAt:new Date(Date.parse(latest)+1).toISOString(),endsAt:new Date(Date.parse(latest)+2).toISOString(),preparedAt:latest}));assert.equal(JSON.stringify(after.handoff.ledger),old);assert.equal(after.cycles,2);assert(Date.parse(after.endsAt)-Date.parse(after.startsAt)<after.pollMs*after.cycles);await m.verifyForwardDemoPlan(after);
});
test('descriptor inspection refuses getters/toJSON, prototypes, cycles, sparse/hidden arrays and nonfinite values before invocation',async()=>{
 let invoked=false;const getter={};Object.defineProperty(getter,'handoff',{enumerable:true,get(){invoked=true;return f.handoff;}});const hook={toJSON(){invoked=true;return f.handoff;}},cycle={};cycle.self=cycle;const sparse=[];sparse[2]=1;const hidden={};Object.defineProperty(hidden,'x',{value:1});const symbol={};symbol[Symbol('secret')]=1;
 for(const value of [getter,hook,cycle,sparse,hidden,symbol,Object.create({x:1}),new Date(),{bad:Infinity},{bad:undefined}])await assert.rejects(()=>m.verifyForwardDemoPlan(value));assert.equal(invoked,false);
});
test('all fields and keys shield raw, malformed and nested encoded credentials without leaking them',async()=>{
 const encode=value=>[...value].map(c=>'%'+c.charCodeAt(0).toString(16)).join('');
 for(const prefix of ['og_agent_','og_local_owner_','og_local_producer_','github_pat_'+ 'a'.repeat(30),'Bearer '+ 's'.repeat(20),'sk-proj-'+ 'x'.repeat(20)])for(const secret of [prefix,encode(prefix)+'%ZZ',encode(encode(prefix))+'%FF%ZZ']){const config=copy(f.config);config.rights.note=secret;await assert.rejects(()=>m.createForwardDemoPlan(input({config})),e=>!e.message.includes(secret));await assert.rejects(()=>m.verifyLockedSearchHandoff({[secret]:1}),e=>!e.message.includes(secret));}
 let nested='og_local_owner_';for(let n=0;n<34;n++)nested=nested.replaceAll('%','%25').replaceAll('_','%5f');await assert.rejects(()=>m.verifyForwardDemoPlan({nested}));const config=copy(f.config);config.rights.note='Ordinary 10% and %ZZ text, café.';await m.createForwardDemoPlan(input({config}));
});
test('wrapper budgets allow complete ledger overhead and inherited structure without Session-sized truncation',()=>{
 assert(m.forwardDemoLimits.handoffBytes>=f.search.searchLimits.ledgerBytes+1048576);assert(m.forwardDemoLimits.planBytes>=m.forwardDemoLimits.handoffBytes+1048576);assert(m.forwardDemoLimits.maximumDepth>=f.search.searchLimits.maximumDepth+2);assert(m.forwardDemoLimits.maximumNodes>f.search.searchLimits.maximumNodes);
 const raw={ledger:{retained:'x'.repeat(f.search.searchLimits.ledgerBytes-128)}};assert.equal(m.boundedForwardDemoValue(raw,m.forwardDemoLimits.handoffBytes),raw);assert.throws(()=>m.boundedForwardDemoValue(raw,32768),e=>e.status===413);let deep={};for(let n=0;n<33;n++)deep={deep};assert.throws(()=>m.boundedForwardDemoValue(deep),e=>e.status===413);
});
