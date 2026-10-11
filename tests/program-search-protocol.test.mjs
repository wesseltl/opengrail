import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {loadProgramSearchModules,programSearchFixture} from './program-search-fixtures.mjs';
import {firstOnlyProgram,constantProgram,trendProgram,trapProgram,infiniteProgram,makeProgram,onBarType,iconst,local,moduleHex} from './helpers/program-fixtures.mjs';

let m,fixture,trained,locked,completed,testAt;
const copy=structuredClone,id=n=>'b3200000-0000-4000-8000-'+String(n).padStart(12,'0'),clock=(at,n=0)=>new Date(Date.parse(at)+n*1000).toISOString();
async function seal(raw,field,schema){const value=schema.parse({...copy(raw),[field]:'f'.repeat(64)}),{[field]:_,...body}=value;void _;return {...body,[field]:await m.strategyDigest(JSON.stringify(body))};}
async function resealSource(source){const canonical=m.boundedStrategyRecord(source.record);return {...source,record:canonical.record,digest:await m.strategyDigest(canonical.payload)};}
async function altered(admission,change){const next=copy(admission);await change(next);for(const candidate of next.candidates)candidate.source=await resealSource(candidate.source);return next;}
async function setProgram(source,binary,parameters=[]){const bytesHex=moduleHex(binary);source.record.content.program={...source.record.content.program,bytesHex,digest:await m.programBinaryDigest(bytesHex),parameters};}
async function ledgerFor(admission=fixture.admission){return m.createProgramSearchLedger(await m.createProgramSearchPlan(admission));}
async function next(ledger,options={}){const candidate=ledger.plan.admission.candidates[ledger.attempts.filter(attempt=>attempt.phase==='TRAIN').length];ledger=await m.admitProgramSearchTrain(ledger,candidate.source.id,ledger.events.at(-1).at);return m.finishProgramSearchAttempt(ledger,await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(ledger),{finishedAt:ledger.events.at(-1).at,...options}));}
async function all(admission=fixture.admission){let ledger=await ledgerFor(admission);for(const _ of admission.candidates){void _;ledger=await next(ledger);}return ledger;}
async function rewriteEvents(ledger){const next=copy(ledger);for(let n=0;n<next.events.length;n++){const event=next.events[n];event.previous=n?next.events[n-1].digest:null;const {digest:_,...body}=event;void _;event.digest=await m.strategyDigest(JSON.stringify(body));}return seal(next,'ledgerDigest',m.programSearchLedgerSchema);}
async function resealOutcome(raw){const {outcomeDigest,...body}=raw;void outcomeDigest;return m.sealProgramRunOutcome(body);}
async function falseGenerator(claim){const forged=copy(claim);forged.trace.forEach(row=>row.output=0);forged.signals=[];forged.demoRequest=await m.programDemoProjection(forged.input,forged.inputDigest,[]);forged.artifact=await m.replayDemo(forged.demoRequest);forged.comparison=await m.compareDemoArtifact(forged.artifact);forged.status=forged.artifact.status;forged.reason='NONE';return m.validateProgramRunOutcome(await resealOutcome(forged));}

before(async()=>{
 m=await loadProgramSearchModules();fixture=await programSearchFixture();testAt=fixture.testInput.dataset.bars.at(-1).closedAt;trained=await all();locked=await m.lockProgramSearchSelection(trained,trained.events.at(-1).at);
 const admitted=await m.admitProgramSearchTest(locked,fixture.testInput,testAt);completed=await m.finishProgramSearchAttempt(admitted,await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(admitted),{finishedAt:testAt}));
});

test('freeze exact V2 binary sources, per-candidate input IDs, common protocol and all implementation identities without TEST observations',async()=>{
 const supplied=copy(fixture.admission),snapshot=JSON.stringify(supplied),plan=await m.createProgramSearchPlan(supplied);assert.equal(JSON.stringify(supplied),snapshot);assert.deepEqual(plan.admission,supplied);
 assert.deepEqual(Object.keys(plan.admission.train),['dataset']);assert.deepEqual(Object.keys(plan.admission.test),['datasetId','firstClosedAt','barCount','gapBars','provenance','permission','attemptId','requestId']);assert.equal(Object.keys(plan.implementations.program).length,9);assert.equal(plan.methodDigest,await m.strategyDigest(JSON.stringify(m.programRunMethod)));assert.notEqual(plan.methodDigest,plan.tradingMethodDigest);
 for(const binding of plan.trainInputs){const candidate=plan.admission.candidates.find(item=>item.source.id===binding.candidateId),input=await m.prepareProgramRunInput({record:candidate.source.record,digest:candidate.source.digest},plan.admission.train.dataset,{requestId:candidate.requestId,initialCapital:plan.admission.initialCapital,hypothesis:plan.admission.hypothesis,falsification:plan.admission.falsification,emergencyStopAt:null});assert.equal(binding.inputDigest,await m.strategyDigest(JSON.stringify(input)));assert.equal(input.strategy.record.version,2);assert(!Object.hasOwn(input,'signals'));}
 supplied.candidates[0].source.record.content.program.parameters.push(100);assert.notDeepEqual(plan.admission,supplied);assert.deepEqual(await m.verifyProgramSearchPlan(plan),plan);
 for(const value of [plan,...completed.attempts,completed]){assert.equal(value.classification,'AUTHOR_REPORTED');assert.equal(value.qualification,'NONE');assert.equal(value.independence,'NOT_ESTABLISHED');assert.equal(value.unseen,'NOT_ESTABLISHED');assert.equal(value.ordersEnabled,false);}
});

test('strict plain JSON refuses hooks, prototypes, cycles, sparse arrays, symbols and nonfinite values before invoking hooks',async()=>{
 let invoked=false;const accessor={};Object.defineProperty(accessor,'admission',{enumerable:true,get(){invoked=true;return fixture.admission;}});const cycle={};cycle.self=cycle;const sparse=[];sparse[2]=1;const decorated=[];decorated.extra=1;const symbol={};symbol[Symbol('hidden')]=1;
 for(const value of [accessor,()=>{},new Date(),Object.create({inherited:1}),cycle,sparse,decorated,symbol,{value:Infinity},{value:undefined}])await assert.rejects(()=>m.createProgramSearchPlan(value));assert.equal(invoked,false);
 let deep={};for(let n=0;n<35;n++)deep={deep};await assert.rejects(()=>m.createProgramSearchPlan(deep),error=>error.status===413);
});

test('credentials and caller-supplied TRAIN/TEST signals never enter the programmable method',async()=>{
 const encoded=value=>[...value].map(character=>'%'+character.charCodeAt(0).toString(16)).join('');
 for(const prefix of ['og_agent_','og_local_owner_','og_local_producer_'])for(const secret of [prefix+'invented',encoded(prefix)+'%ZZ',encoded(encoded(prefix))+'%FF']){const admission=copy(fixture.admission);admission.hypothesis=secret;await assert.rejects(()=>m.createProgramSearchPlan(admission),error=>!error.message.includes(secret));}
 for(const change of [raw=>raw.train.signals=[],raw=>raw.test.signals=[],raw=>raw.test.dataset=copy(fixture.testInput.dataset)]){const admission=copy(fixture.admission);change(admission);await assert.rejects(()=>m.createProgramSearchPlan(admission));}
 await assert.rejects(()=>m.verifyProgramSearchTestInput(locked,{...fixture.testInput,signals:[]}));
});

test('mixed rule/program cohorts and legacy execution paths reject explicit incompatible source methods',async()=>{
 const legacy=await m.syntheticSearchExample(),mixed=copy(fixture.admission);mixed.candidates[1].source=legacy.admission.candidates[1].source;await assert.rejects(()=>m.createProgramSearchPlan(mixed),/Mixed rule\/program/);
 const old=copy(legacy.admission);old.candidates[0].source=fixture.admission.candidates[0].source;await assert.rejects(()=>m.createSearchPlan(old),/genuine per-trial/);
 await assert.rejects(()=>m.verifyProgramSearchLedger({version:1,kind:'LOCAL_SEARCH_LEDGER'}));await assert.rejects(()=>m.verifySearchLedger(completed));
});

test('source digests, binary/parameter identity, visibility, canonical text and common market/risk/costs cannot change',async()=>{
 for(const change of [raw=>raw.candidates[0].source.digest='0'.repeat(64),raw=>raw.candidates[0].source.record.content.name='Changed cached name',raw=>raw.candidates[0].source.record.content.program.digest='0'.repeat(64),raw=>raw.candidates[0].source.record.content.name=' '+raw.candidates[0].source.record.content.name,raw=>raw.train.dataset.rights.note+=' ']){const admission=copy(fixture.admission);change(admission);await assert.rejects(()=>m.createProgramSearchPlan(admission));}
 for(const change of [d=>d.market.symbol='ETH/USDT',d=>{d.market.direction='SHORT';d.entry.event='BEARISH';},d=>d.risk.positionPct=9,d=>d.costs.feeBps+=1]){const admission=await altered(fixture.admission,raw=>change(raw.candidates[1].source.record.content.definition));await assert.rejects(()=>m.createProgramSearchPlan(admission));}
 const hidden=copy(fixture.admission);hidden.candidates[0].source.state='HIDDEN';hidden.candidates[0].source.record=null;hidden.candidates[0].source.reason='POLICY';hidden.candidates[0].source.moderation=[{sequence:1,requestId:id(90),createdAt:hidden.createdAt,actor:hidden.candidates[0].source.author,state:'HIDDEN',reason:'POLICY'}];await assert.rejects(()=>m.createProgramSearchPlan(hidden));
});

test('canonical UUIDs, fresh operation identities, chronological TEST header and permissions are frozen',async()=>{
 for(const change of [raw=>raw.id=raw.id.toUpperCase(),raw=>raw.train.dataset.id='b3200000-0000-0000-8000-000000000001',raw=>raw.test.attemptId=raw.candidates[0].attemptId,raw=>raw.candidates[0].requestId=raw.candidates[0].source.id,raw=>raw.test.datasetId=raw.train.dataset.id,raw=>raw.candidates[1]=copy(raw.candidates[0]),raw=>raw.createdAt='2025-01-03T00:00:00Z',raw=>raw.test.firstClosedAt=raw.train.dataset.bars.at(-1).closedAt,raw=>raw.test.gapBars++,raw=>raw.test.permission='AUTHORIZED_USE',raw=>raw.selection.tieTolerancePct=.1]){const admission=copy(fixture.admission);change(admission);await assert.rejects(()=>m.createProgramSearchPlan(admission));}
});

test('admit every TRAIN exactly once in frozen order and block selection/TEST while an original attempt is pending',async()=>{
 const initial=await ledgerFor(),[first,second]=initial.plan.admission.candidates;await assert.rejects(()=>m.admitProgramSearchTrain(initial,second.source.id,initial.plan.createdAt));await assert.rejects(()=>m.lockProgramSearchSelection(initial,initial.plan.createdAt));await assert.rejects(()=>m.admitProgramSearchTest(initial,fixture.testInput,testAt));
 const pending=await m.admitProgramSearchTrain(initial,first.source.id,initial.plan.createdAt);assert.equal(pending.attempts[0].status,'RUNNING');assert.equal(pending.events[1].recordDigest,pending.attempts[0].attemptDigest);await assert.rejects(()=>m.admitProgramSearchTrain(pending,second.source.id,initial.plan.createdAt));await assert.rejects(()=>m.lockProgramSearchSelection(pending,initial.plan.createdAt));
 const one=await next(initial);await assert.rejects(()=>m.admitProgramSearchTrain(one,first.source.id,initial.plan.createdAt));assert.deepEqual(await m.verifyProgramSearchLedger(one),one);
});

test('real restricted generation produces different per-candidate streams and retains full same-implementation reconstruction and no-trade member',async()=>{
 const [first,second]=trained.attempts;assert.equal(first.outcome.status,'COMPLETED');assert.equal(first.outcome.trace[0].output,1);assert.equal(first.outcome.signals.length,1);assert(first.outcome.artifact.metrics.returnPct>0);assert(first.outcome.artifact.metrics.totalFees>0);assert(first.outcome.artifact.trades.length>0);
 assert.equal(second.outcome.status,'NO_TRADES');assert(second.outcome.trace.every(row=>row.output===0));assert.equal(second.outcome.signals.length,0);assert.equal(second.outcome.artifact.trades.length,0);
 for(const attempt of trained.attempts){assert.equal(attempt.status,'EVALUATED');assert.equal(attempt.generatorComparison.status,'MATCH');assert.equal(attempt.generatorComparison.generator,'SAME_IMPLEMENTATION_RECONSTRUCTION');assert.deepEqual(attempt.reconstruction,attempt.outcome);assert.equal(attempt.outcome.comparison.status,'MATCH');assert.equal(attempt.outcome.input.strategy.digest,attempt.plan.admission.candidates.find(candidate=>candidate.source.id===attempt.candidateId).source.digest);assert.notEqual(attempt.outcome.demoRequest.strategy.digest,attempt.outcome.input.strategy.digest);await m.verifyProgramSearchAttempt(attempt);}
 assert.equal(locked.selection.decision,'SELECTED');assert.equal(locked.selection.selectedCandidateId,first.candidateId);assert(locked.selection.ranking[1].reasons.includes('PROGRAM_STATUS'));assert(locked.selection.ranking[1].reasons.includes('TRADE_FLOOR'));assert.equal(locked.selection.trainingResultSetDigest,await m.strategyDigest(JSON.stringify(trained.attempts.map(attempt=>({candidateId:attempt.candidateId,attemptId:attempt.attemptId,attemptDigest:attempt.attemptDigest})))));
});

test('only locked winner receives later dataset-only TEST and a genuine loss cannot change choice or erase TRAIN evidence',async()=>{
 const result=completed.attempts.at(-1);assert.equal(result.phase,'TEST');assert.equal(result.candidateId,locked.selection.selectedCandidateId);assert.equal(result.outcome.status,'COMPLETED');assert.equal(result.generatorComparison.status,'MATCH');assert(result.outcome.artifact.metrics.netPnl<0);assert(result.outcome.artifact.trades.some(trade=>trade.netPnl<0));assert.equal(result.outcome.artifact.metrics.initialCapital,completed.plan.protocol.initialCapital);
 assert.deepEqual(completed.selection,locked.selection);assert.deepEqual(completed.attempts.slice(0,2),trained.attempts);assert.deepEqual(await m.verifyProgramSearchLedger(completed),completed);
 await assert.rejects(()=>m.lockProgramSearchSelection(completed,testAt));await assert.rejects(()=>m.admitProgramSearchTest(completed,fixture.testInput,testAt));await assert.rejects(()=>m.admitProgramSearchTrain(completed,trained.attempts[0].candidateId,testAt));
});

test('configured stateful generators cold-start independently on TRAIN and TEST with no inherited globals, memory or index',async()=>{
 const admission=await altered(fixture.admission,async raw=>{await setProgram(raw.candidates[0].source,trendProgram(),[.5]);await setProgram(raw.candidates[1].source,trendProgram(),[1000000]);}),allTrain=await all(admission),choice=await m.lockProgramSearchSelection(allTrain,allTrain.events.at(-1).at),pending=await m.admitProgramSearchTest(choice,fixture.testInput,testAt),terminal=await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(pending),{finishedAt:testAt});
 const train=allTrain.attempts[0].outcome,test=terminal.outcome;assert.equal(train.configure[0].value,.5);assert.equal(test.configure[0].value,.5);assert.equal(train.trace[0].output,0);assert.equal(test.trace[0].output,0);assert(train.signals.some(signal=>signal.event==='BULLISH'));assert(test.signals.every(signal=>signal.event==='BEARISH'));assert.equal(test.status,'NO_TRADES');assert.notEqual(train.stateDigest,test.stateDigest);assert.deepEqual(terminal.reconstruction,test);assert.equal(test.trace[0].barIndex,0);
});

test('causal program outputs and fuel prefix do not depend on future prices although full input-bound signal IDs change',async()=>{
 const admission=await altered(fixture.admission,async raw=>{await setProgram(raw.candidates[0].source,trendProgram(),[.5]);}),plan=await m.createProgramSearchPlan(admission),pending=await m.admitProgramSearchTrain(await m.createProgramSearchLedger(plan),plan.admission.candidates[0].source.id,plan.createdAt),input=copy(pending.attempts[0].input),changed=copy(input);
 for(const bar of changed.dataset.bars.slice(10)){bar.open*=3;bar.high*=3;bar.low*=3;bar.close*=3;}
 const first=await m.runProgramReplay(input,pending.attempts[0].attemptId),second=await m.runProgramReplay(changed,pending.attempts[0].attemptId);assert.deepEqual(first.trace.slice(0,10),second.trace.slice(0,10));assert.deepEqual(first.configure,second.configure);assert.notEqual(first.inputDigest,second.inputDigest);assert.notEqual(first.signals[0].id,second.signals[0].id);
});

test('TEST interval, dataset identity, provenance, rights, count, common market and final observation clock reject substitution',async()=>{
 for(const change of [raw=>raw.dataset.id=id(100),raw=>raw.dataset.symbol='ETH/USDT',raw=>raw.dataset.timeframe='4h',raw=>raw.dataset.bars.pop(),raw=>raw.dataset.rights.permission='AUTHORIZED_USE',raw=>raw.dataset.rights.note+=' ',raw=>raw.dataset.bars.forEach(bar=>bar.closedAt=clock(bar.closedAt,3600))]){const input=copy(fixture.testInput);change(input);await assert.rejects(()=>m.admitProgramSearchTest(locked,input,testAt));}
 await assert.rejects(()=>m.admitProgramSearchTest(locked,fixture.testInput,locked.selection.lockedAt),/claimed observations/);
 const pending=await m.admitProgramSearchTest(locked,fixture.testInput,testAt),changed=copy(m.pendingProgramSearchAttempt(pending));changed.startedAt=clock(testAt,-1);await assert.rejects(async()=>m.verifyProgramSearchAttempt(await seal(changed,'attemptDigest',m.programSearchAttemptSchema)),/claimed observations/);
});

test('different separately supplied TEST prices preserve exact frozen TRAIN history and irreversible selection',async()=>{
 const changed=copy(fixture.testInput);for(const bar of changed.dataset.bars){bar.open*=2;bar.high*=2;bar.low*=2;bar.close*=2;}
 const first=await m.admitProgramSearchTest(locked,fixture.testInput,testAt),second=await m.admitProgramSearchTest(locked,changed,testAt);assert.notEqual(first.attempts.at(-1).inputDigest,second.attempts.at(-1).inputDigest);assert.deepEqual(first.plan,second.plan);assert.deepEqual(first.selection,second.selection);assert.deepEqual(first.attempts.slice(0,2),second.attempts.slice(0,2));
});

test('pre-execution cancellation retains complete CANCELLED outcome and consumes the exact TRAIN without rerunning',async()=>{
 const initial=await ledgerFor(),admitted=await m.admitProgramSearchTrain(initial,initial.plan.admission.candidates[0].source.id,initial.plan.createdAt),abort=new AbortController();abort.abort();
 const cancelled=await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(admitted),{signal:abort.signal,finishedAt:initial.plan.createdAt});assert.equal(cancelled.status,'INTERRUPTED');assert.equal(cancelled.reason,'USER_CANCELLED');assert.equal(cancelled.outcome.status,'CANCELLED');assert.equal(cancelled.outcome.trace.length,0);assert.equal(cancelled.reconstruction,null);const finished=await m.finishProgramSearchAttempt(admitted,cancelled);await assert.rejects(()=>m.evaluateProgramSearchAttempt(cancelled));await assert.rejects(()=>m.admitProgramSearchTrain(finished,cancelled.candidateId,initial.plan.createdAt));
});

test('pending recovery retains original INTERRUPTED program input/identity and consumes the only TEST before computation',async()=>{
 const pending=await m.admitProgramSearchTest(locked,fixture.testInput,testAt),original=m.pendingProgramSearchAttempt(pending),recovered=await m.recoverProgramSearchLedger(pending,clock(testAt,1)),terminal=recovered.attempts.at(-1);assert.equal(terminal.status,'INTERRUPTED');assert.equal(terminal.reason,'RECOVERY_INTERRUPTED');assert.equal(terminal.outcome.status,'INTERRUPTED');assert.equal(terminal.attemptId,original.attemptId);assert.equal(terminal.outcome.inputDigest,original.inputDigest);assert.deepEqual(terminal.outcome.input,original.input);assert.deepEqual(recovered.selection,locked.selection);assert.deepEqual(await m.recoverProgramSearchLedger(recovered,clock(testAt,2)),recovered);await assert.rejects(()=>m.admitProgramSearchTest(recovered,fixture.testInput,clock(testAt,2)));assert.deepEqual(await m.verifyProgramSearchLedger(recovered),recovered);
});

for(const [name,binary,reason]of [['trap',trapProgram(),'PROGRAM_TRAP'],['fuel exhaustion',infiniteProgram(),'FUEL_LIMIT'],['invalid output',constantProgram(3),'INVALID_OUTPUT']])test('actual '+name+' retains full matching failure and cannot qualify a winner',async()=>{
 const admission=await altered(fixture.admission,async raw=>{await setProgram(raw.candidates[0].source,binary);}),ledger=await all(admission),decision=await m.lockProgramSearchSelection(ledger,ledger.events.at(-1).at),failure=ledger.attempts[0];assert.equal(failure.outcome.status,'FAILED');assert.equal(failure.outcome.reason,reason);assert.equal(failure.generatorComparison.status,'MATCH');assert.deepEqual(failure.reconstruction,failure.outcome);assert(failure.outcome.trace.some(row=>row.status==='FAILED'));assert.equal(decision.selection.decision,'NO_SELECTION');assert(decision.selection.ranking[0].reasons.includes('PROGRAM_STATUS'));await assert.rejects(()=>m.admitProgramSearchTest(decision,fixture.testInput,testAt));
});

test('real losing TRAIN and return/trade/drawdown thresholds retain all adverse candidates without late retuning',async()=>{
 const admission=copy(fixture.admission);admission.train.dataset.bars=copy(fixture.testInput.dataset.bars);admission.createdAt=admission.train.dataset.bars.at(-1).closedAt;admission.test.firstClosedAt=clock(admission.createdAt,3*3600);const ledger=await all(admission),decision=await m.lockProgramSearchSelection(ledger,ledger.events.at(-1).at);assert(ledger.attempts[0].outcome.artifact.metrics.returnPct<0);assert(decision.selection.ranking[0].reasons.includes('RETURN_FLOOR'));assert.equal(decision.selection.decision,'NO_SELECTION');
 for(const [field,value,reason]of [['minTrades',100,'TRADE_FLOOR'],['minReturnPct',100,'RETURN_FLOOR'],['maxDrawdownPct',0,'DRAWDOWN_LIMIT']]){const nextAdmission=copy(fixture.admission);nextAdmission.selection[field]=value;if(field==='maxDrawdownPct'){nextAdmission.train.dataset.bars[2].close=101;nextAdmission.train.dataset.bars[2].low=101;}const allTrain=await all(nextAdmission),result=await m.lockProgramSearchSelection(allTrain,allTrain.events.at(-1).at);assert(result.selection.ranking[0].reasons.includes(reason));assert.equal(result.selection.decision,'NO_SELECTION');}
});

test('SHORT noncomparability remains visible even with real generator and trading reconstruction MATCH',async()=>{
 const admission=await altered(fixture.admission,async raw=>{for(const candidate of raw.candidates){candidate.source.record.content.definition.market.direction='SHORT';candidate.source.record.content.definition.entry.event='BEARISH';}await setProgram(raw.candidates[0].source,constantProgram(2));}),ledger=await all(admission),decision=await m.lockProgramSearchSelection(ledger,ledger.events.at(-1).at);assert.equal(ledger.attempts[0].generatorComparison.status,'MATCH');assert.equal(ledger.attempts[0].outcome.comparison.status,'MATCH');assert.equal(ledger.attempts[0].outcome.artifact.metrics.comparable,false);assert(decision.selection.ranking[0].reasons.includes('NONCOMPARABLE'));assert.equal(decision.selection.decision,'NO_SELECTION');
});

test('equal economic outcomes use frozen ordinal order rather than source ID, while preserving differing fuel traces',async()=>{
 const sameEconomic=makeProgram({types:[onBarType],functions:[{type:0,body:[...iconst(0),0x1a,...local(0),0x45,0x04,0x7f,...iconst(1),0x05,...iconst(0),0x0b]}]}),admission=await altered(fixture.admission,async raw=>{await setProgram(raw.candidates[1].source,sameEconomic);}),ledger=await all(admission),decision=await m.lockProgramSearchSelection(ledger,ledger.events.at(-1).at);assert.equal(ledger.attempts[0].outcome.artifact.metrics.returnPct,ledger.attempts[1].outcome.artifact.metrics.returnPct);assert.notEqual(ledger.attempts[0].outcome.totalFuel,ledger.attempts[1].outcome.totalFuel);assert.equal(decision.selection.selectedCandidateId,admission.candidates[0].source.id);assert.deepEqual(decision.selection.eligibleOrder,admission.candidates.map(candidate=>candidate.source.id));
});

test('coherent self-hashed false generator is disproved by actual guest reconstruction and retained as ineligible disagreement',async()=>{
 const admission=await m.admitProgramSearchTrain(await ledgerFor(),fixture.admission.candidates[0].source.id,fixture.admission.createdAt),original=m.pendingProgramSearchAttempt(admission),claim=await falseGenerator(trained.attempts[0].outcome),checked=await m.compareProgramOutcome(claim),terminal=await seal({...original,status:'EVALUATED',finishedAt:original.startedAt,outcome:claim,reconstruction:checked.reconstructed,generatorComparison:checked.report},'attemptDigest',m.programSearchAttemptSchema);assert.equal(checked.report.status,'MISMATCH');assert(checked.report.comparison.differences.some(row=>row.path==='trace[0].output'));await m.verifyProgramSearchAttempt(terminal);
 let ledger=await m.finishProgramSearchAttempt(admission,terminal);ledger=await next(ledger);const decision=await m.lockProgramSearchSelection(ledger,ledger.events.at(-1).at);assert(decision.selection.ranking[0].reasons.includes('GENERATOR_COMPARISON_MISMATCH'));assert.equal(decision.selection.decision,'NO_SELECTION');assert.equal(ledger.attempts[0].outcome.comparison.status,'MATCH');assert.notEqual(ledger.attempts[0].outcome.outcomeDigest,ledger.attempts[0].reconstruction.outcomeDigest);
});

test('self-hashed compact MATCH cannot hide contradictory whole fresh outcome or omit reconstruction',async()=>{
 const good=copy(trained.attempts[0]);for(const change of [raw=>raw.reconstruction=null,raw=>raw.reconstruction=trained.attempts[1].outcome,raw=>raw.outcome=trained.attempts[1].outcome,raw=>raw.generatorComparison=trained.attempts[1].generatorComparison]){const changed=copy(good);change(changed);await assert.rejects(async()=>m.verifyProgramSearchAttempt(await seal(changed,'attemptDigest',m.programSearchAttemptSchema)));}
 const forged=await falseGenerator(good.outcome),checked=await m.compareProgramOutcome(forged),{reportDigest,...reportBody}=checked.report;void reportDigest;const falseReport=await m.sealProgramComparisonReport({...reportBody,status:'MATCH',reconstructed:reportBody.claimed,reconstructedOutcomeDigest:forged.outcomeDigest,comparison:{matches:true,differenceCount:0,differences:[]}});await assert.rejects(async()=>m.verifyProgramSearchAttempt(await seal({...good,outcome:forged,reconstruction:checked.reconstructed,generatorComparison:falseReport},'attemptDigest',m.programSearchAttemptSchema)));
});

test('rehashed false fuel and state bits are exposed by whole generator reconstruction even when trading artifact is unchanged',async()=>{
 const admission=await altered(fixture.admission,async raw=>{await setProgram(raw.candidates[0].source,trendProgram(),[.5]);}),ledger=await next(await ledgerFor(admission)),original=ledger.attempts[0].outcome;
 for(const change of [async raw=>{raw.trace[1].fuelUsed++;raw.totalFuel++;},async raw=>{raw.state.globals[0]=500;const bytes=new Uint8Array(8);new DataView(bytes.buffer).setFloat64(0,500,true);raw.state.globalBits[0]=Buffer.from(bytes).toString('hex');raw.stateDigest=await m.strategyDigest(JSON.stringify(raw.state));}]){const changed=copy(original);await change(changed);const claim=await m.validateProgramRunOutcome(await resealOutcome(changed)),checked=await m.compareProgramOutcome(claim);assert.equal(checked.report.status,'MISMATCH');assert.equal(claim.artifact.resultDigest,original.artifact.resultDigest);assert.deepEqual(checked.reconstructed,original);}
});

test('guest-generated signed zero retains its exact global bits instead of becoming an unretained parser failure',async()=>{
 const binary=makeProgram({globals:[{type:'f64',mutable:true,value:-0}],functions:[{type:0,body:[...local(0),0x45,0x04,0x7f,...iconst(1),0x05,...iconst(0),0x0b]}]}),admission=await altered(fixture.admission,async raw=>{await setProgram(raw.candidates[0].source,binary);}),ledger=await next(await ledgerFor(admission)),outcome=ledger.attempts[0].outcome;assert.equal(outcome.state.globalBits[0],'0000000000000080');assert.equal(ledger.attempts[0].generatorComparison.status,'MATCH');assert.deepEqual(await m.verifyProgramSearchLedger(JSON.parse(JSON.stringify(ledger))),JSON.parse(JSON.stringify(ledger)));
});

test('full four-candidate search reserves all five outcomes and keeps every terminal plus sole TEST',async()=>{
 const admission=await altered(fixture.admission,async raw=>{for(let n=2;n<4;n++){const candidate=copy(raw.candidates[0]);candidate.source.record.id=id(10+n);candidate.source.record.rootId=id(10+n);candidate.source.record.requestId=id(20+n);candidate.source.id=id(10+n);candidate.source.rootId=id(10+n);candidate.source.requestId=id(20+n);candidate.source.record.content.name='Invented retained program '+n;candidate.attemptId=id(40+n);candidate.requestId=id(50+n);raw.candidates.push(candidate);}}),ledger=await all(admission),choice=await m.lockProgramSearchSelection(ledger,ledger.events.at(-1).at),pending=await m.admitProgramSearchTest(choice,fixture.testInput,testAt),full=await m.finishProgramSearchAttempt(pending,await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(pending),{finishedAt:testAt}));assert.equal(full.attempts.length,5);assert.equal(full.events.length,12);assert(full.attempts.every(attempt=>attempt.status==='EVALUATED'));assert(full.attempts.at(-1).outcome.artifact.metrics.returnPct<0);assert.deepEqual(await m.verifyProgramSearchLedger(full),full);
});

test('bounds refuse whole excess intact and reserve worst-case terminal capacity before starting computation',async()=>{
 assert(Object.isFrozen(m.programSearchLimits));await assert.rejects(()=>m.createProgramSearchPlan({padding:'x'.repeat(m.programSearchLimits.admissionBytes)}),error=>error.status===413);await assert.rejects(()=>m.verifyProgramSearchAttempt({padding:'x'.repeat(m.programSearchLimits.attemptBytes)}),error=>error.status===413);
 const source=readFileSync('app/program-search-protocol.ts','utf8').replace('ledgerBytes:134217728','ledgerBytes:65000000'),result=await build({stdin:{contents:"export * from './app/program-search-protocol';export * from './app/program-search-example';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',plugins:[{name:'fixed-first-party-capacity-fault',setup(builder){builder.onLoad({filter:/program-search-protocol\.ts$/},()=>({contents:source,loader:'ts'}));}}]}),small=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64')),fixture=await small.syntheticProgramSearchExample(),plan=await small.createProgramSearchPlan(fixture.admission);await assert.rejects(()=>small.createProgramSearchLedger(plan),error=>error.status===413&&/every whole program/.test(error.message));
});

test('rewritten selection, omitted adverse result, changed event chain and early TEST cannot pass self-hashed correlation checks',async()=>{
 const winner=copy(completed);winner.selection.selectedCandidateId=completed.plan.admission.candidates[1].source.id;await assert.rejects(async()=>m.verifyProgramSearchLedger(await seal(winner,'ledgerDigest',m.programSearchLedgerSchema)));
 const omitted=copy(trained);omitted.attempts.pop();await assert.rejects(async()=>m.verifyProgramSearchLedger(await seal(omitted,'ledgerDigest',m.programSearchLedgerSchema)));
 const reordered=copy(trained);reordered.attempts.reverse();await assert.rejects(async()=>m.verifyProgramSearchLedger(await seal(reordered,'ledgerDigest',m.programSearchLedgerSchema)));
 const early=copy(completed);early.attempts.at(-1).startedAt=clock(early.selection.lockedAt,-1);early.attempts[2]=await seal(early.attempts[2],'attemptDigest',m.programSearchAttemptSchema);await assert.rejects(async()=>m.verifyProgramSearchLedger(await rewriteEvents(early)));
});

test('rehashed plan method, all nine pins, risk/capital, exact input and immutable terminal cannot be substituted',async()=>{
 for(const change of [raw=>raw.methodDigest='0'.repeat(64),raw=>raw.tradingMethodDigest='0'.repeat(64),raw=>raw.implementations.program.interpreter='0'.repeat(64),raw=>raw.protocol.initialCapital++,raw=>raw.admission.candidates[0].source.record.content.program.parameters.push(1)]){const plan=copy(locked.plan);change(plan);await assert.rejects(async()=>m.verifyProgramSearchPlan(await seal(plan,'planDigest',m.programSearchPlanSchema)));}
 const alteredAttempt=copy(trained.attempts[0]);alteredAttempt.input.initialCapital++;await assert.rejects(async()=>m.verifyProgramSearchAttempt(await seal(alteredAttempt,'attemptDigest',m.programSearchAttemptSchema)));
 assert.deepEqual(await m.finishProgramSearchAttempt(trained,trained.attempts[0]),trained);const changed=copy(trained.attempts[0]);changed.finishedAt=clock(changed.finishedAt,1);await assert.rejects(async()=>m.finishProgramSearchAttempt(trained,await seal(changed,'attemptDigest',m.programSearchAttemptSchema)));
});

test('operation/completion clock regression refuses without replacing pending original identity',async()=>{
 const initial=await ledgerFor(),pending=await m.admitProgramSearchTrain(initial,initial.plan.admission.candidates[0].source.id,initial.plan.createdAt);await assert.rejects(()=>m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(pending),{finishedAt:clock(initial.plan.createdAt,-1)}));await assert.rejects(()=>m.recoverProgramSearchLedger(pending,clock(initial.plan.createdAt,-1)));assert.equal(m.pendingProgramSearchAttempt(pending).attemptId,initial.plan.admission.candidates[0].attemptId);assert.deepEqual(await m.verifyProgramSearchLedger(pending),pending);
});
