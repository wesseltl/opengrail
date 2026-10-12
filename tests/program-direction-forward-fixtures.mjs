import {build} from 'esbuild';
import {createRequire} from 'node:module';
let loading;
export function loadProgramDirectionForwardTestModule(){
 return loading??=(async()=>{const result=await build({stdin:{contents:"export * from './app/program-direction-forward-plan';export * from './app/program-direction-forward-storage';export * from './app/program-direction-forward-browser';export * from './app/program-direction-search';export * from './app/program-direction-search-example';export * from './app/program-session-model';export * from './app/program-session-journal';export * from './app/strategy-model';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022'}),require=createRequire(import.meta.url),module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);return module.exports;})();
}
export async function completedProgramDirectionSearch({interruptedTest=false,publicSources=false,timeframe='1h'}={}){
 const m=await loadProgramDirectionForwardTestModule(),example=await m.syntheticProgramDirectionSearchExample();
 if(timeframe!=='1h'){
  if(timeframe!=='5m')throw Error('Only the separately declared 5m collector fixture is supported.');
  const step=300000,first=Date.parse('2025-02-01T00:05:00.000Z');
  for(const candidate of example.admission.candidates){const record=structuredClone(candidate.source.record);record.content.definition.market.timeframe=timeframe;const bounded=m.boundedStrategyRecord(record);candidate.source={...candidate.source,record:bounded.record,digest:await m.strategyDigest(bounded.payload)};}
  for(const [dataset,test]of [[example.admission.train.dataset,false],[example.testInput.dataset,true]]){dataset.timeframe=timeframe;dataset.bars=dataset.bars.map((bar,n)=>({...bar,closedAt:new Date(first+(n+(test?6:0))*step).toISOString()}));}
  example.admission.createdAt=example.admission.train.dataset.bars.at(-1).closedAt;example.admission.test.firstClosedAt=example.testInput.dataset.bars[0].closedAt;
 }
 if(publicSources){example.admission.id=crypto.randomUUID();for(const candidate of example.admission.candidates){const source=candidate.source,id=crypto.randomUUID(),requestId=crypto.randomUUID(),bounded=m.boundedStrategyRecord({...source.record,id,rootId:id,requestId,content:{...source.record.content,name:source.record.content.name+' exact public test'}});candidate.source={...source,id,rootId:id,requestId,record:bounded.record,digest:await m.strategyDigest(bounded.payload)};}}
 let ledger=await m.createProgramDirectionSearchLedger(await m.createProgramDirectionSearchPlan(example.admission)),time=Date.parse('2026-02-01T00:00:00.000Z');
 for(const candidate of example.admission.candidates){ledger=await m.admitProgramDirectionSearchTrain(ledger,candidate.source.id,new Date(time++).toISOString());const terminal=await m.evaluateProgramDirectionSearchAttempt(m.pendingProgramDirectionSearchAttempt(ledger),{finishedAt:new Date(time++).toISOString()});ledger=await m.finishProgramDirectionSearchAttempt(ledger,terminal);}
 ledger=await m.lockProgramDirectionSearchSelection(ledger,new Date(time++).toISOString());ledger=await m.admitProgramDirectionSearchTest(ledger,example.testInput,new Date(time++).toISOString());
 if(interruptedTest)ledger=await m.recoverProgramDirectionSearchLedger(ledger,new Date(time++).toISOString());
 else ledger=await m.finishProgramDirectionSearchAttempt(ledger,await m.evaluateProgramDirectionSearchAttempt(m.pendingProgramDirectionSearchAttempt(ledger),{finishedAt:new Date(time++).toISOString()}));
 return {ledger,example};
}
export async function programDirectionForwardFixture(options={}){
 const m=await loadProgramDirectionForwardTestModule(),{ledger}=await completedProgramDirectionSearch(options),handoff=await m.createLockedProgramDirectionSearchHandoff(ledger),prospective=options.prospective??false,config=m.boundedProgramSessionConfig({version:1,kind:'LOCAL_PROGRAM_SESSION_CONFIG',sessionId:crypto.randomUUID(),methodVersion:m.programSessionVersion,clockMode:prospective?'SYSTEM_RECEIPT':'SYNTHETIC_PLAYBACK',origin:prospective?'PUBLIC_STRATEGY':'SYNTHETIC_FIXTURE',strategy:{record:handoff.winner.source.record,digest:handoff.winner.source.digest},initialCapital:handoff.initialCapital,provenance:prospective?'USER_SUPPLIED':'SYNTHETIC',rights:{permission:prospective?'AUTHORIZED_USE':'CREATED_SYNTHETIC',acknowledged:true,note:'Invented test rights declaration; no authentic provider result.'},sourceLabel:'Invented program forward test',ordersEnabled:false,liveEnabled:false}).config;
 const plan=await m.createProgramDirectionForwardPlan({mode:prospective?'PROSPECTIVE':'SYNTHETIC_EXERCISE',handoff,config,preparedAt:'2026-02-01T00:01:00.000Z',startsAt:'2026-02-02T00:00:00.000Z',endsAt:'2026-02-02T04:00:00.000Z',pollMs:15000,cycles:10});return{plan,handoff,config,ledger,history:await m.createProgramDirectionForwardHistory(plan)};
}
