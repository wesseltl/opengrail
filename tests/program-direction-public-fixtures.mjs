import {build} from 'esbuild';
import {createRequire} from 'node:module';
let loaded;
export function loadProgramDirectionPublicModules(){return loaded??=(async()=>{const result=await build({stdin:{contents:"export * from './app/program-direction-search';export * from './app/program-direction-search-example';export * from './app/program-direction-forward-plan';export * from './app/program-forward-evidence';export * from './app/program-forward-evidence-model';export * from './app/program-forward-comparison-model';export * from './app/program-session-journal';export * from './app/program-session-model';export * from './app/experiment-model';export * from './app/experiment-review-model';export * from './app/strategy-model';export * from './app/arena-model';export * from './app/arena-evaluator';export * from './app/arena-public';export * from './app/program-forward-public';export {StrategyRepository} from './app/strategy-store';export {ExperimentRepository} from './app/experiment-store';export {ExperimentReviewRepository} from './app/experiment-review-store';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;})();}

/** Fresh complete four-bar trial; registered sources replace drafts before freezing. */
export async function fittingProgramDirectionPublicFixture({registerSource,sourceClock=Date.now(),timeframe='1h'}={}){
 const m=await loadProgramDirectionPublicModules(),example=await m.syntheticProgramDirectionSearchExample();
 const uuid=()=>crypto.randomUUID(),step=timeframe==='5m'?300000:3600000;
 example.admission.id=uuid();example.admission.train.dataset.id=uuid();example.admission.test.datasetId=uuid();example.testInput.dataset.id=example.admission.test.datasetId;example.admission.test.attemptId=uuid();example.admission.test.requestId=uuid();
 for(const candidate of example.admission.candidates){
  const id=uuid(),requestId=uuid(),record=structuredClone(candidate.source.record);
  record.id=id;record.rootId=id;record.requestId=requestId;record.content.definition.market.timeframe=timeframe;
  const bounded=m.boundedStrategyRecord(record);let source={...candidate.source,id,rootId:id,requestId,record:bounded.record,digest:await m.strategyDigest(bounded.payload)};
  if(registerSource)source=await registerSource(source);
  candidate.source=source;candidate.attemptId=uuid();candidate.requestId=uuid();
 }
 // All new prices, intervals and IDs are declared before any plan/admission.
 const before=Math.floor((sourceClock-24*step)/step)*step;
 for(const [dataset,offset]of [[example.admission.train.dataset,1],[example.testInput.dataset,7]]){
  dataset.timeframe=timeframe;dataset.bars=dataset.bars.map((bar,n)=>({...bar,closedAt:new Date(before+(offset+n)*step).toISOString()}));
 }
 example.admission.test.firstClosedAt=example.testInput.dataset.bars[0].closedAt;
 const frozenAt=Math.max(sourceClock,...example.admission.candidates.flatMap(c=>[Date.parse(c.source.createdAt),...c.source.moderation.map(row=>Date.parse(row.createdAt))]))+1;
 example.admission.createdAt=new Date(frozenAt).toISOString();
 let ledger=await m.createProgramDirectionSearchLedger(await m.createProgramDirectionSearchPlan(example.admission)),clock=frozenAt;
 for(const candidate of example.admission.candidates){ledger=await m.admitProgramDirectionSearchTrain(ledger,candidate.source.id,new Date(clock++).toISOString());ledger=await m.finishProgramDirectionSearchAttempt(ledger,await m.evaluateProgramDirectionSearchAttempt(m.pendingProgramDirectionSearchAttempt(ledger),{finishedAt:new Date(clock++).toISOString()}));}
 ledger=await m.lockProgramDirectionSearchSelection(ledger,new Date(clock++).toISOString());ledger=await m.admitProgramDirectionSearchTest(ledger,example.testInput,new Date(clock++).toISOString());ledger=await m.finishProgramDirectionSearchAttempt(ledger,await m.evaluateProgramDirectionSearchAttempt(m.pendingProgramDirectionSearchAttempt(ledger),{finishedAt:new Date(clock++).toISOString()}));
 const handoff=await m.createLockedProgramDirectionSearchHandoff(ledger),preparedAt=new Date(clock+1000).toISOString(),startsAt=new Date(Math.ceil((clock+60000)/step)*step).toISOString();
 const config={version:1,kind:'LOCAL_PROGRAM_SESSION_CONFIG',sessionId:uuid(),methodVersion:'opengrail-program-session-v1',clockMode:'SYNTHETIC_PLAYBACK',origin:'SYNTHETIC_FIXTURE',strategy:{record:handoff.winner.source.record,digest:handoff.winner.source.digest},initialCapital:handoff.initialCapital,provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented local prices and clocks; provider authenticity and custody are not established.'},sourceLabel:'Invented SHORT forward stream',ordersEnabled:false,liveEnabled:false};
 const plan=await m.createProgramDirectionForwardPlan({mode:'SYNTHETIC_EXERCISE',handoff,config,preparedAt,startsAt,endsAt:new Date(Date.parse(startsAt)+12*step).toISOString(),pollMs:15000,cycles:4});
 let journal=await m.createProgramSessionJournal(config,startsAt);
 const apply=async(event,receivedAt,completedAt=receivedAt)=>journal=await m.executeProgramSessionPending(await m.admitProgramSessionEvent(journal,event,receivedAt),{clock:()=>completedAt});
 for(let n=0;n<2;n++){const closedAt=new Date(Date.parse(startsAt)+(n+1)*step).toISOString(),price=100-n;await apply({requestId:uuid(),type:'CLOSED_BAR',bar:{closedAt,open:price,high:price,low:price,close:price,volume:100}},closedAt,new Date(Date.parse(closedAt)+10).toISOString());}
 const fillAt=new Date(Date.parse(startsAt)+2*step+1000).toISOString();await apply({requestId:uuid(),type:'QUOTE',observedAt:fillAt,price:99},fillAt);
 const lossAt=new Date(Date.parse(fillAt)+1000).toISOString();await apply({requestId:uuid(),type:'QUOTE',observedAt:lossAt,price:103},lossAt);
 const recoveryAt=new Date(Date.parse(lossAt)+1000).toISOString();journal=await m.recoverProgramSessionJournal(await m.admitProgramSessionEvent(journal,{requestId:uuid(),type:'PAUSE'},recoveryAt),recoveryAt);
 return {m,example,ledger,handoff,config,plan,journal,artifact:await m.snapshotProgramForwardEvidence(journal,plan),sources:example.admission.candidates.map(c=>c.source)};
}
