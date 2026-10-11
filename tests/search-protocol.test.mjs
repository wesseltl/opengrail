import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {loadSearchModules,searchFixture} from './search-fixtures.mjs';

let m,fixture,trained,locked,completed,testAt;
const copy=structuredClone,id=n=>'b2300000-0000-4000-8000-'+String(n).padStart(12,'0');
const clock=(raw,n=0)=>new Date(Date.parse(raw)+n*1000).toISOString();
async function seal(raw,field,schema){const value=schema.parse({...copy(raw),[field]:'f'.repeat(64)}),{[field]:_,...body}=value;void _;return {...body,[field]:await m.strategyDigest(JSON.stringify(body))};}
async function resealSource(source){const canonical=m.boundedStrategyRecord(source.record);return {...source,record:canonical.record,digest:await m.strategyDigest(canonical.payload)};}
async function altered(admission,change){const next=copy(admission);await change(next);for(const candidate of next.candidates)candidate.source=await resealSource(candidate.source);return next;}
async function ledgerFor(admission=fixture.admission){return m.createSearchLedger(await m.createSearchPlan(admission));}
async function next(ledger,options={}){const candidate=ledger.plan.admission.candidates[ledger.attempts.filter(a=>a.phase==='TRAIN').length];ledger=await m.admitSearchTrain(ledger,candidate.source.id,ledger.events.at(-1).at);return m.finishSearchAttempt(ledger,await m.evaluateSearchAttempt(m.pendingSearchAttempt(ledger),{finishedAt:ledger.events.at(-1).at,...options}));}
async function all(admission=fixture.admission){let ledger=await ledgerFor(admission);for(const _ of admission.candidates){void _;ledger=await next(ledger);}return ledger;}
async function rewriteEvents(ledger){const next=copy(ledger);for(let n=0;n<next.events.length;n++){const e=next.events[n];e.previous=n?next.events[n-1].digest:null;const {digest:_,...body}=e;void _;e.digest=await m.strategyDigest(JSON.stringify(body));}return seal(next,'ledgerDigest',m.searchLedgerSchema);}

before(async()=>{
  m=await loadSearchModules();fixture=await searchFixture();testAt=fixture.testInput.dataset.bars.at(-1).closedAt;trained=await all();locked=await m.lockSearchSelection(trained,trained.events.at(-1).at);
  const pending=await m.admitSearchTest(locked,fixture.testInput,testAt);
  completed=await m.finishSearchAttempt(pending,await m.evaluateSearchAttempt(m.pendingSearchAttempt(pending),{finishedAt:pending.events.at(-1).at}));
});

test('freeze binds exact sources, common TRAIN, method, risk, costs and capital without TEST observations',async()=>{
  const supplied=copy(fixture.admission),original=JSON.stringify(supplied),plan=await m.createSearchPlan(supplied);
  assert.equal(JSON.stringify(supplied),original);assert.deepEqual(plan.admission,supplied);
  assert.deepEqual(Object.keys(plan.admission.test),['datasetId','firstClosedAt','barCount','gapBars','provenance','permission','attemptId','requestId']);
  for(const binding of plan.trainInputs){const candidate=plan.admission.candidates.find(c=>c.source.id===binding.candidateId);const canonical=m.boundedDemoRequest({version:1,requestId:candidate.requestId,evaluatorVersion:'opengrail-demo-v1',strategy:{record:candidate.source.record,digest:candidate.source.digest},dataset:plan.admission.train.dataset,signals:plan.admission.train.signals,initialCapital:plan.protocol.initialCapital,hypothesis:plan.admission.hypothesis,falsification:plan.admission.falsification,emergencyStopAt:null});assert.equal(binding.inputDigest,await m.strategyDigest(canonical.payload));}
  for(const value of [plan,...trained.attempts,completed]){assert.equal(value.classification,'AUTHOR_REPORTED');assert.equal(value.qualification,'NONE');assert.equal(value.independence,'NOT_ESTABLISHED');assert.equal(value.unseen,'NOT_ESTABLISHED');assert.equal(value.ordersEnabled,false);}
  supplied.train.dataset.bars[0].close=1;assert.notEqual(plan.admission.train.dataset.bars[0].close,1);assert.deepEqual(await m.verifySearchPlan(plan),plan);
});

test('plain JSON inspection refuses hooks, prototypes, cycles, nonfinite and decorated containers',async()=>{
  let invoked=false;const accessor={};Object.defineProperty(accessor,'admission',{enumerable:true,get(){invoked=true;return fixture.admission;}});
  const cycle={};cycle.self=cycle;const sparse=[];sparse[2]=1;const decorated=[];decorated.extra=1;const symbol={};symbol[Symbol('extra')]=1;
  for(const value of [accessor,()=>{},new Date(),Object.create({inherited:1}),cycle,sparse,decorated,symbol,{value:Infinity},{value:undefined}])await assert.rejects(()=>m.createSearchPlan(value));
  assert.equal(invoked,false);let deep={};for(let n=0;n<27;n++)deep={deep};await assert.rejects(()=>m.createSearchPlan(deep),e=>e.status===413);
});

test('bounds and canonical lifecycle identities apply before computation',async()=>{
  await assert.rejects(()=>m.createSearchPlan({padding:'x'.repeat(m.searchLimits.admissionBytes)}),e=>e.status===413);
  await assert.rejects(()=>m.verifySearchAttempt({padding:'x'.repeat(m.searchLimits.attemptBytes)}),e=>e.status===413);
  for(const mutate of [a=>a.candidates.pop(),a=>a.candidates.push(...copy(a.candidates),copy(a.candidates[0])),a=>a.id=a.id.toUpperCase(),a=>a.createdAt='2025-01-03T00:00:00Z',a=>a.test.attemptId=a.candidates[0].attemptId,a=>a.candidates[0].requestId=a.candidates[0].source.id,a=>a.train.dataset.id=a.id,a=>a.candidates[1]=copy(a.candidates[0]),a=>a.selection.tieTolerancePct=.01,a=>a.hypothesis=' untrimmed ']){const raw=copy(fixture.admission);mutate(raw);await assert.rejects(()=>m.createSearchPlan(raw));}
});

test('credential shielding rejects raw, partial malformed and nested encoded prefixes without echoing secrets',async()=>{
  const encoded=s=>[...s].map(c=>'%'+c.charCodeAt(0).toString(16)).join('');
  for(const prefix of ['og_agent_','og_local_owner_','og_local_producer_'])for(const secret of [prefix+'synthetic',encoded(prefix)+'synthetic%ZZ',encoded(encoded(prefix))+'%FF%ZZ']){const raw=copy(fixture.admission);raw.hypothesis=secret;await assert.rejects(()=>m.createSearchPlan(raw),e=>!e.message.includes(secret));}
  let nested='og_agent_';for(let n=0;n<33;n++)nested=nested.replaceAll('%','%25').replaceAll('_','%5f');const raw=copy(fixture.admission);raw.hypothesis=nested;await assert.rejects(()=>m.createSearchPlan(raw));
  const legitimate=copy(fixture.admission);legitimate.hypothesis='Require 10% growth; quoted %ZZ and café remain ordinary noncredential text.';await m.createSearchPlan(legitimate);
});

test('source visibility, digest and exact common market, risk and costs are required without rewriting',async()=>{
  for(const mutate of [a=>a.candidates[0].source.digest='0'.repeat(64),a=>a.candidates[0].source.record.content.name='Changed cached name',a=>a.candidates[0].source.record=null,a=>a.createdAt=a.candidates[0].source.createdAt]){const raw=copy(fixture.admission);mutate(raw);await assert.rejects(()=>m.createSearchPlan(raw));}
  for(const mutate of [d=>d.market.symbol='ETH/USDT',d=>d.market.direction='SHORT',d=>d.risk.positionPct=9,d=>d.costs.feeBps+=1]){const raw=await altered(fixture.admission,a=>mutate(a.candidates[1].source.record.content.definition));await assert.rejects(()=>m.createSearchPlan(raw),/same market/);}
  const raw=copy(fixture.admission);raw.candidates[0].source.state='HIDDEN';raw.candidates[0].source.record=null;raw.candidates[0].source.reason='POLICY';raw.candidates[0].source.moderation=[{sequence:1,requestId:id(99),createdAt:raw.createdAt,actor:raw.candidates[0].source.author,state:'HIDDEN',reason:'POLICY'}];await assert.rejects(()=>m.createSearchPlan(raw));
});

test('legacy schema trimming cannot silently rewrite an exact candidate or supplied data',async()=>{
  for(const mutate of [a=>a.candidates[0].source.record.content.name=' '+a.candidates[0].source.record.content.name+' ',a=>a.candidates[0].source.record.content.assumptions+=' ',a=>a.train.dataset.rights.note=' '+a.train.dataset.rights.note]){const admission=copy(fixture.admission);mutate(admission);await assert.rejects(()=>m.createSearchPlan(admission),/canonical unchanged/);}
  const testInput=copy(fixture.testInput);testInput.dataset.rights.note+=' ';await assert.rejects(()=>m.verifySearchTestInput(locked,testInput),/canonical unchanged/);
  const reordered=JSON.parse(JSON.stringify(fixture.admission));reordered.selection=Object.fromEntries(Object.entries(reordered.selection).reverse());assert.deepEqual(await m.createSearchPlan(reordered),locked.plan);
});

test('strict UUID version and variant cover every TRAIN dataset/signal and supplied TEST signal boundary',async()=>{
  for(const bad of ['b2300000-0000-0000-8000-000000000001','b2300000-0000-4000-0000-000000000001']){
    const dataset=copy(fixture.admission);dataset.train.dataset.id=bad;await assert.rejects(()=>m.createSearchPlan(dataset));
    const signals=copy(fixture.admission);signals.train.signals=[{id:bad,provider:'CUSTOM',event:'BULLISH',observedAt:signals.train.dataset.bars[0].closedAt,availableAt:signals.train.dataset.bars[0].closedAt}];await assert.rejects(()=>m.createSearchPlan(signals));
    const testInput=copy(fixture.testInput);testInput.signals=[{id:bad,provider:'CUSTOM',event:'BULLISH',observedAt:testInput.dataset.bars[0].closedAt,availableAt:testInput.dataset.bars[0].closedAt}];await assert.rejects(()=>m.verifySearchTestInput(locked,testInput));
  }
});

test('prefrozen TEST chronology, bounds and rights are enforced before release',async()=>{
  for(const mutate of [a=>a.test.firstClosedAt=a.train.dataset.bars.at(-1).closedAt,a=>a.test.gapBars+=1,a=>a.test.barCount=1,a=>a.test.barCount=2001,a=>a.test.permission='AUTHORIZED_USE',a=>a.test.dataset=copy(fixture.testInput.dataset),a=>a.test.signals=[]]){const raw=copy(fixture.admission);mutate(raw);await assert.rejects(()=>m.createSearchPlan(raw));}
});

test('TRAIN admissions advance once in frozen order with one pending and no early lock or TEST',async()=>{
  const initial=await ledgerFor(),[first,second]=initial.plan.admission.candidates;
  await assert.rejects(()=>m.admitSearchTrain(initial,second.source.id,initial.plan.createdAt));await assert.rejects(()=>m.lockSearchSelection(initial,initial.plan.createdAt));await assert.rejects(()=>m.admitSearchTest(initial,fixture.testInput,initial.plan.createdAt));
  const pending=await m.admitSearchTrain(initial,first.source.id,initial.plan.createdAt);assert.equal(pending.attempts[0].status,'RUNNING');assert.equal(pending.events[1].type,'TRAIN_ADMITTED');assert.equal(pending.events[1].recordDigest,pending.attempts[0].attemptDigest);
  await assert.rejects(()=>m.admitSearchTrain(pending,second.source.id,initial.plan.createdAt));await assert.rejects(()=>m.lockSearchSelection(pending,initial.plan.createdAt));
  const one=await next(initial);await assert.rejects(()=>m.admitSearchTrain(one,first.source.id,initial.plan.createdAt));await assert.rejects(()=>m.lockSearchSelection(one,initial.plan.createdAt));
  assert.deepEqual(await m.verifySearchLedger(one),one);
});

test('actual fixed TRAIN computation retains every artifact, comparison, cost and benchmark before deterministic lock',async()=>{
  assert.equal(trained.attempts.length,2);for(const attempt of trained.attempts){assert.equal(attempt.status,'EVALUATED');assert.equal(attempt.artifact.status,'COMPLETED');assert.equal(attempt.comparison.status,'MATCH');assert(attempt.artifact.metrics.returnPct>0);assert(attempt.artifact.trades.length>0);assert(attempt.artifact.equity.length===48);assert(attempt.artifact.metrics.totalFees>0);assert(attempt.artifact.benchmark);await m.verifySearchAttempt(attempt);}
  const best=trained.attempts.reduce((a,b)=>a.artifact.metrics.returnPct>b.artifact.metrics.returnPct?a:b);assert.equal(locked.selection.selectedCandidateId,best.candidateId);assert.equal(locked.selection.ranking.length,trained.plan.admission.candidates.length);assert.equal(locked.selection.trainingResultSetDigest,await m.strategyDigest(JSON.stringify(trained.attempts.map(a=>({candidateId:a.candidateId,attemptId:a.attemptId,attemptDigest:a.attemptDigest})))));await assert.rejects(()=>m.lockSearchSelection(locked,locked.selection.lockedAt));
});

test('actual TRAIN winner loses TEST and stays selected with full adverse history and cold starting capital',async()=>{
  const result=completed.attempts.at(-1);assert.equal(result.phase,'TEST');assert.equal(result.candidateId,locked.selection.selectedCandidateId);assert.equal(result.artifact.status,'COMPLETED');assert.equal(result.comparison.status,'MATCH');assert(result.artifact.metrics.netPnl<0);assert(result.artifact.metrics.returnPct<0);assert(result.artifact.trades.some(t=>t.netPnl<0));assert.equal(result.artifact.metrics.initialCapital,completed.plan.protocol.initialCapital);
  assert.deepEqual(completed.selection,locked.selection);assert.deepEqual(completed.attempts.slice(0,2),trained.attempts);assert.equal(completed.events.length,8);assert.deepEqual(await m.verifySearchLedger(completed),completed);
});

test('TEST data is separately supplied after lock and cannot affect any frozen TRAIN identity or selection',async()=>{
  const changed=copy(fixture.testInput);for(const bar of changed.dataset.bars){bar.open*=2;bar.high*=2;bar.low*=2;bar.close*=2;}
  const normal=await m.admitSearchTest(locked,fixture.testInput,testAt),other=await m.admitSearchTest(locked,changed,testAt);
  assert.notEqual(normal.attempts.at(-1).inputDigest,other.attempts.at(-1).inputDigest);assert.deepEqual(normal.plan,other.plan);assert.deepEqual(normal.selection,other.selection);assert.deepEqual(normal.attempts.slice(0,2),other.attempts.slice(0,2));
  assert.deepEqual(await m.verifySearchTestInput(locked,changed),changed);assert.equal(locked.attempts.length,2);
});

test('TEST exact ID, interval, rights, market and unique signal history reject substitutions',async()=>{
  for(const mutate of [d=>d.dataset.id=id(100),d=>d.dataset.timeframe='4h',d=>d.dataset.symbol='ETH/USDT',d=>d.dataset.bars.pop(),d=>d.dataset.rights.permission='AUTHORIZED_USE',d=>{for(const bar of d.dataset.bars)bar.closedAt=clock(bar.closedAt,3600);},d=>d.signals=[{id:locked.plan.id,provider:'CUSTOM',event:'BULLISH',observedAt:d.dataset.bars[0].closedAt,availableAt:d.dataset.bars[0].closedAt}]]){const raw=copy(fixture.testInput);mutate(raw);await assert.rejects(()=>m.admitSearchTest(locked,raw,locked.selection.lockedAt));}
});

test('TEST admission waits for the claimed final close and rehashed future-observation attempts are refused',async()=>{
  await assert.rejects(()=>m.admitSearchTest(locked,fixture.testInput,locked.selection.lockedAt),/claimed observations/);
  const pending=await m.admitSearchTest(locked,fixture.testInput,testAt),changed=copy(m.pendingSearchAttempt(pending));changed.startedAt=clock(testAt,-1);await assert.rejects(async()=>m.verifySearchAttempt(await seal(changed,'attemptDigest',m.searchAttemptSchema)),/claimed observations/);
  assert.equal(m.pendingSearchAttempt(pending).startedAt,testAt);assert.equal(pending.selection.selectedCandidateId,locked.selection.selectedCandidateId);
});

test('TEST admission consumes its sole release before evaluation including after interrupted recovery',async()=>{
  const pending=await m.admitSearchTest(locked,fixture.testInput,testAt);await assert.rejects(()=>m.admitSearchTest(pending,fixture.testInput,locked.selection.lockedAt));
  const recovered=await m.recoverSearchLedger(pending,clock(pending.events.at(-1).at,1));assert.equal(recovered.attempts.at(-1).status,'INTERRUPTED');assert.equal(recovered.attempts.at(-1).reason,'RECOVERY_INTERRUPTED');assert.deepEqual(recovered.selection,locked.selection);
  for(const ledger of [recovered,completed]){await assert.rejects(()=>m.admitSearchTest(ledger,fixture.testInput,ledger.events.at(-1).at));await assert.rejects(()=>m.admitSearchTrain(ledger,ledger.plan.admission.candidates[0].source.id,ledger.events.at(-1).at));await assert.rejects(()=>m.evaluateSearchAttempt(ledger.attempts.at(-1)));}
});

test('cancelled and recovered TRAIN attempts remain retained and cannot be silently rerun or omitted',async()=>{
  let ledger=await ledgerFor();ledger=await m.admitSearchTrain(ledger,ledger.plan.admission.candidates[0].source.id,ledger.plan.createdAt);const pending=m.pendingSearchAttempt(ledger),abort=new AbortController();abort.abort();
  const cancelled=await m.evaluateSearchAttempt(pending,{signal:abort.signal,finishedAt:pending.startedAt});assert.equal(cancelled.status,'INTERRUPTED');assert.equal(cancelled.reason,'USER_CANCELLED');assert.equal(cancelled.artifact,null);ledger=await m.finishSearchAttempt(ledger,cancelled);ledger=await next(ledger);ledger=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);assert(ledger.selection.ranking[0].reasons.includes('ATTEMPT_INTERRUPTED'));assert.equal(ledger.attempts.length,2);
  const initial=await ledgerFor(),admitted=await m.admitSearchTrain(initial,initial.plan.admission.candidates[0].source.id,initial.plan.createdAt),recovered=await m.recoverSearchLedger(admitted,clock(initial.plan.createdAt,1));assert.equal(recovered.attempts[0].reason,'RECOVERY_INTERRUPTED');await assert.rejects(()=>m.admitSearchTrain(recovered,initial.plan.admission.candidates[0].source.id,clock(initial.plan.createdAt,2)));assert.deepEqual(await m.recoverSearchLedger(recovered,clock(initial.plan.createdAt,2)),recovered);
});

test('actual no-trade artifacts and rejected eligibility are retained with NO_SELECTION blocking TEST',async()=>{
  const admission=await altered(fixture.admission,a=>{for(const [n,c] of a.candidates.entries()){const d=m.strategyTemplate('SIGNAL');d.entry.maxAgeBars=n+1;c.source.record.content.definition=d;} });
  const ledger=await all(admission),result=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);for(const attempt of ledger.attempts){assert.equal(attempt.artifact.status,'NO_TRADES');assert.equal(attempt.comparison.status,'MATCH');assert.equal(attempt.artifact.trades.length,0);assert(attempt.artifact.audit.some(e=>e.reason==='MISSING_SIGNAL'));}
  assert.equal(result.selection.decision,'NO_SELECTION');assert(result.selection.ranking.every(r=>r.reasons.includes('ARTIFACT_STATUS')&&r.reasons.includes('TRADE_FLOOR')));await assert.rejects(()=>m.admitSearchTest(result,fixture.testInput,result.events.at(-1).at));
});

test('real losing TRAIN is retained and does not gain eligibility from a completed comparison',async()=>{
  const admission=copy(fixture.admission);admission.train.dataset.bars=copy(fixture.testInput.dataset.bars);admission.createdAt=admission.train.dataset.bars.at(-1).closedAt;admission.test.firstClosedAt=new Date(Date.parse(admission.createdAt)+3*3600000).toISOString();
  const ledger=await all(admission),result=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);assert(ledger.attempts.every(a=>a.artifact.metrics.returnPct<0));assert(result.selection.ranking.every(r=>r.reasons.includes('RETURN_FLOOR')));assert.equal(result.selection.decision,'NO_SELECTION');
});

test('actual numerical failure and fixed-engine disagreement stay in the TRAIN result set',async()=>{
  const admission=await altered(fixture.admission,a=>{for(const [n,c] of a.candidates.entries()){const d=m.strategyTemplate('RULES');d.entry={type:'RULES',match:'ALL',conditions:[{indicator:'PRICE_SMA',period:2,comparison:'GT',threshold:n?.6:.5}]};d.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:20,maxDailyLossPct:1};d.costs={feeBps:10,slippageBps:10};c.source.record.content.definition=d;}a.train.dataset.bars=Array.from({length:18},(_,n)=>{const price=n>=3&&n<=6?1e308:100;return {closedAt:new Date(Date.parse('2025-01-01T11:00:00.000Z')+n*3600000).toISOString(),open:price,high:n===2?101:price,low:n===2?79:price,close:price,volume:1};});a.createdAt=a.train.dataset.bars.at(-1).closedAt;a.test.firstClosedAt=new Date(Date.parse(a.createdAt)+3*3600000).toISOString();});
  const ledger=await all(admission),result=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);for(const attempt of ledger.attempts){assert.equal(attempt.artifact.status,'FAILED');assert.equal(attempt.artifact.reason,'NUMERICAL_LIMIT');assert.equal(attempt.comparison.status,'MISMATCH');assert.equal(attempt.comparison.summaries.reference.status,'COMPLETED');assert(attempt.comparison.pairs[2].differenceCount>0);}
  assert.equal(result.selection.decision,'NO_SELECTION');assert(result.selection.ranking.every(r=>r.reasons.includes('ARTIFACT_STATUS')&&r.reasons.includes('COMPARISON_MISMATCH')));await m.verifySearchLedger(result);
});

test('SHORT noncomparability is preserved even when actual primary/reference results agree',async()=>{
  const admission=await altered(fixture.admission,a=>{for(const c of a.candidates)c.source.record.content.definition.market.direction='SHORT';});
  const ledger=await all(admission),result=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);assert(ledger.attempts.every(a=>a.artifact.metrics.comparable===false));assert(result.selection.ranking.every(r=>r.reasons.includes('NONCOMPARABLE')));assert.equal(result.selection.decision,'NO_SELECTION');
});

test('frozen return, trade and drawdown filters retain ineligible candidates without late retuning',async()=>{
  for(const change of [s=>s.minReturnPct=100,s=>s.minTrades=2000]){const admission=copy(fixture.admission);change(admission.selection);const ledger=await all(admission),result=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);assert.equal(result.selection.decision,'NO_SELECTION');assert.equal(result.attempts.length,2);}
  const adverse=copy(fixture.admission);adverse.train.dataset.bars=copy(fixture.testInput.dataset.bars);adverse.createdAt=adverse.train.dataset.bars.at(-1).closedAt;adverse.test.firstClosedAt=new Date(Date.parse(adverse.createdAt)+3*3600000).toISOString();adverse.selection.minReturnPct=-100;adverse.selection.maxDrawdownPct=0;const adverseLedger=await all(adverse),adverseLock=await m.lockSearchSelection(adverseLedger,adverseLedger.events.at(-1).at);assert.equal(adverseLock.selection.decision,'NO_SELECTION');assert(adverseLock.selection.ranking.every(r=>r.reasons.includes('DRAWDOWN_LIMIT')));
  const changed=copy(locked);changed.plan.admission.selection.minReturnPct=-100;changed.plan=await seal(changed.plan,'planDigest',m.searchPlanSchema);await assert.rejects(async()=>m.verifySearchLedger(await seal(changed,'ledgerDigest',m.searchLedgerSchema)));
});

test('equal actual outcomes use frozen ordinal rather than source identity or caller choice',async()=>{
  const admission=await altered(fixture.admission,a=>{a.candidates[1].source.record.content.definition=copy(a.candidates[0].source.record.content.definition);});
  const ledger=await all(admission),result=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);assert.equal(ledger.attempts[0].artifact.metrics.returnPct,ledger.attempts[1].artifact.metrics.returnPct);assert.equal(result.selection.selectedCandidateId,admission.candidates[0].source.id);assert.deepEqual(result.selection.eligibleOrder,admission.candidates.map(c=>c.source.id));
});

test('four candidates plus sole TEST remain bounded and complete with all disposition events',async()=>{
  const admission=copy(fixture.admission);for(let n=2;n<4;n++){const candidate=copy(admission.candidates[0]);candidate.source.id=candidate.source.rootId=candidate.source.record.id=candidate.source.record.rootId=id(100+n);candidate.source.requestId=candidate.source.record.requestId=id(200+n);candidate.source.record.content.name+=' '+n;candidate.attemptId=id(300+n);candidate.requestId=id(400+n);candidate.source=await resealSource(candidate.source);admission.candidates.push(candidate);}
  let ledger=await all(admission);ledger=await m.lockSearchSelection(ledger,ledger.events.at(-1).at);ledger=await m.admitSearchTest(ledger,fixture.testInput,testAt);ledger=await m.finishSearchAttempt(ledger,await m.evaluateSearchAttempt(m.pendingSearchAttempt(ledger),{finishedAt:ledger.events.at(-1).at}));assert.equal(ledger.attempts.length,5);assert.equal(ledger.events.length,12);await m.verifySearchLedger(ledger);
});

test('rehashed winner, omitted adverse result and early TEST cannot pass exact event/selection reconciliation',async()=>{
  const wrong=copy(completed);wrong.selection.selectedCandidateId=wrong.selection.ranking.find(r=>r.candidateId!==wrong.selection.selectedCandidateId).candidateId;wrong.selection=await seal(wrong.selection,'selectionDigest',m.searchLedgerSchema.shape.selection.unwrap());wrong.events.find(e=>e.type==='SELECTION_LOCKED').recordDigest=wrong.selection.selectionDigest;await assert.rejects(async()=>m.verifySearchLedger(await rewriteEvents(wrong)),/Selection changed/);
  const omitted=copy(completed);omitted.attempts.splice(0,1);await assert.rejects(async()=>m.verifySearchLedger(await seal(omitted,'ledgerDigest',m.searchLedgerSchema)));
  const early=copy(completed);early.selection=null;early.attempts=early.attempts.filter(a=>a.phase==='TEST');await assert.rejects(async()=>m.verifySearchLedger(await seal(early,'ledgerDigest',m.searchLedgerSchema)));
  const history=copy(completed);history.events.splice(2,1);for(const [n,e] of history.events.entries())e.sequence=n+1;await assert.rejects(async()=>m.verifySearchLedger(await rewriteEvents(history)),/complete ordered history/);
});

test('self-rehashed plan, input, method, labels and evaluator fingerprints cannot change admission',async()=>{
  for(const mutate of [p=>p.protocol.initialCapital+=1,p=>p.protocol.costs.feeBps+=1,p=>p.implementations.primary.sourceSha256='0'.repeat(64),p=>p.methodDigest='0'.repeat(64),p=>p.trainInputs[0].inputDigest='0'.repeat(64)]){const raw=copy(locked.plan);mutate(raw);await assert.rejects(async()=>m.verifySearchPlan(await seal(raw,'planDigest',m.searchPlanSchema)));}
  for(const mutate of [a=>a.input.initialCapital+=1,a=>a.input.strategy.record.content.definition.costs.feeBps+=1,a=>a.inputDigest='0'.repeat(64),a=>a.candidateId=id(333),a=>a.attemptId=id(334)]){const raw=copy(trained.attempts[0]);mutate(raw);await assert.rejects(async()=>m.verifySearchAttempt(await seal(raw,'attemptDigest',m.searchAttemptSchema)));}
  for(const changes of [{ordersEnabled:true},{qualification:'QUALIFIED'},{unseen:'ESTABLISHED'},{classification:'VERIFIED'}])await assert.rejects(()=>m.verifySearchLedger({...completed,...changes}));
});

test('foreign valid artifact and self-rehashed comparison cannot substitute exact retained evidence',async()=>{
  const raw=copy(trained.attempts[0]),input=copy(raw.input);input.initialCapital+=100;const foreign=await m.replayDemo(input);raw.artifact=foreign;raw.comparison=null;raw.status='UNAVAILABLE';raw.reason='EVALUATOR_FAILURE';await assert.rejects(async()=>m.verifySearchAttempt(await seal(raw,'attemptDigest',m.searchAttemptSchema)),/exact admitted input/);
  const changed=copy(trained.attempts[0]);changed.comparison.identity.claimedArtifact='e'.repeat(64);const {reportDigest:_,...body}=changed.comparison;void _;changed.comparison.reportDigest=await m.strategyDigest(JSON.stringify(body));await m.verifyComparisonReport(changed.comparison);await assert.rejects(async()=>m.verifySearchAttempt(await seal(changed,'attemptDigest',m.searchAttemptSchema)),/complete retained artifact/);
});

test('terminal writes are idempotent only for the identical original disposition and cannot overwrite history',async()=>{
  const terminal=trained.attempts[0];assert.deepEqual(await m.finishSearchAttempt(trained,terminal),trained);const changed=copy(terminal);changed.finishedAt=clock(terminal.finishedAt,1);await assert.rejects(async()=>m.finishSearchAttempt(trained,await seal(changed,'attemptDigest',m.searchAttemptSchema)),/cannot be replaced/);
  const pending=await m.admitSearchTrain(await ledgerFor(),terminal.candidateId,terminal.startedAt);const stale=copy(terminal);stale.startedAt=clock(terminal.startedAt,1);stale.finishedAt=stale.startedAt;await assert.rejects(async()=>m.finishSearchAttempt(pending,await seal(stale,'attemptDigest',m.searchAttemptSchema)),/original admission/);
});

test('operation and completion clock regression leave original pending ledger recoverable',async()=>{
  const initial=await ledgerFor(),pending=await m.admitSearchTrain(initial,initial.plan.admission.candidates[0].source.id,initial.plan.createdAt);
  for(const bad of ['bad',initial.plan.createdAt.replace('.000Z','Z'),clock(initial.plan.createdAt,-1)]){await assert.rejects(()=>m.evaluateSearchAttempt(m.pendingSearchAttempt(pending),{finishedAt:bad}));await assert.rejects(()=>m.recoverSearchLedger(pending,bad));}
  assert.equal(m.pendingSearchAttempt(pending).status,'RUNNING');assert.deepEqual(await m.verifySearchLedger(pending),pending);await assert.rejects(()=>m.lockSearchSelection(trained,clock(trained.events.at(-1).at,-1)));
  const future=await m.admitSearchTrain(initial,initial.plan.admission.candidates[0].source.id,'2090-01-01T00:00:00.000Z');await assert.rejects(()=>m.evaluateSearchAttempt(m.pendingSearchAttempt(future)),/Completion precedes admission/);assert.equal(m.pendingSearchAttempt(future).status,'RUNNING');
});

test('real local evaluator fault becomes bounded unavailable evidence without leaking raw exceptions',async()=>{
  const bundle=await build({stdin:{contents:"export * from './app/search-protocol';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',plugins:[{name:'synthetic-local-fault',setup(build){build.onLoad({filter:/\/demo-engine\.ts$/},()=>({contents:"export function replayDemo(){throw Error('og_agent_synthetic_private_fault');}",loader:'ts'}));}}]});
  const injected=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')),initial=await ledgerFor(),pending=await m.admitSearchTrain(initial,initial.plan.admission.candidates[0].source.id,initial.plan.createdAt),unavailable=await injected.evaluateSearchAttempt(m.pendingSearchAttempt(pending),{finishedAt:initial.plan.createdAt});
  assert.equal(unavailable.status,'UNAVAILABLE');assert.equal(unavailable.reason,'EVALUATOR_FAILURE');assert.equal(unavailable.artifact,null);assert.equal(unavailable.comparison,null);assert(!JSON.stringify(unavailable).includes('private_fault'));const ledger=await m.finishSearchAttempt(pending,unavailable);assert.equal(ledger.attempts[0].reason,'EVALUATOR_FAILURE');await m.verifySearchLedger(ledger);
});

test('an over-budget evaluator result yields a retained RESULT_LIMIT rather than truncation or a stuck admission',async()=>{
  const bundle=await build({stdin:{contents:"export * from './app/search-protocol';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',plugins:[{name:'synthetic-local-capacity-fault',setup(build){build.onLoad({filter:/\/demo-engine\.ts$/},()=>({contents:"export function replayDemo(){return {padding:'x'.repeat(8388608)};}",loader:'ts'}));}}]});
  const injected=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')),initial=await ledgerFor(),pending=await m.admitSearchTrain(initial,initial.plan.admission.candidates[0].source.id,initial.plan.createdAt),limited=await injected.evaluateSearchAttempt(m.pendingSearchAttempt(pending),{finishedAt:initial.plan.createdAt});
  assert.equal(limited.status,'UNAVAILABLE');assert.equal(limited.reason,'RESULT_LIMIT');assert.equal(limited.artifact,null);assert.equal(limited.comparison,null);const ledger=await m.finishSearchAttempt(pending,limited);assert.equal(ledger.attempts[0].reason,'RESULT_LIMIT');assert.equal(m.pendingSearchAttempt(ledger),null);await m.verifySearchLedger(ledger);
});
