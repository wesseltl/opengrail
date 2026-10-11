import {build} from 'esbuild';
import {createRequire} from 'node:module';
let loading;
export function loadProgramForwardTestModule(){
 return loading??=(async()=>{const result=await build({stdin:{contents:"export * from './app/program-forward-plan';export * from './app/program-forward-storage';export * from './app/program-forward-browser';export * from './app/program-search-protocol';export * from './app/program-search-example';export * from './app/program-session-model';export * from './app/program-session-journal';export * from './app/strategy-model';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022'}),require=createRequire(import.meta.url),module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);return module.exports;})();
}
export async function completedProgramSearch({interruptedTest=false,publicSources=false}={}){
 const m=await loadProgramForwardTestModule(),example=await m.syntheticProgramSearchExample();
 if(publicSources){example.admission.id=crypto.randomUUID();for(const candidate of example.admission.candidates){const source=candidate.source,id=crypto.randomUUID(),requestId=crypto.randomUUID(),bounded=m.boundedStrategyRecord({...source.record,id,rootId:id,requestId,content:{...source.record.content,name:source.record.content.name+' exact public test'}});candidate.source={...source,id,rootId:id,requestId,record:bounded.record,digest:await m.strategyDigest(bounded.payload)};}}
 let ledger=await m.createProgramSearchLedger(await m.createProgramSearchPlan(example.admission)),time=Date.parse('2026-02-01T00:00:00.000Z');
 for(const candidate of example.admission.candidates){ledger=await m.admitProgramSearchTrain(ledger,candidate.source.id,new Date(time++).toISOString());const terminal=await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(ledger),{finishedAt:new Date(time++).toISOString()});ledger=await m.finishProgramSearchAttempt(ledger,terminal);}
 ledger=await m.lockProgramSearchSelection(ledger,new Date(time++).toISOString());ledger=await m.admitProgramSearchTest(ledger,example.testInput,new Date(time++).toISOString());
 if(interruptedTest)ledger=await m.recoverProgramSearchLedger(ledger,new Date(time++).toISOString());
 else ledger=await m.finishProgramSearchAttempt(ledger,await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(ledger),{finishedAt:new Date(time++).toISOString()}));
 return {ledger,example};
}
export async function programForwardFixture(options={}){
 const m=await loadProgramForwardTestModule(),{ledger}=await completedProgramSearch(options),handoff=await m.createLockedProgramSearchHandoff(ledger),prospective=options.prospective??false,config=m.boundedProgramSessionConfig({version:1,kind:'LOCAL_PROGRAM_SESSION_CONFIG',sessionId:crypto.randomUUID(),methodVersion:m.programSessionVersion,clockMode:prospective?'SYSTEM_RECEIPT':'SYNTHETIC_PLAYBACK',origin:prospective?'PUBLIC_STRATEGY':'SYNTHETIC_FIXTURE',strategy:{record:handoff.winner.source.record,digest:handoff.winner.source.digest},initialCapital:handoff.initialCapital,provenance:prospective?'USER_SUPPLIED':'SYNTHETIC',rights:{permission:prospective?'AUTHORIZED_USE':'CREATED_SYNTHETIC',acknowledged:true,note:'Invented test rights declaration; no authentic provider result.'},sourceLabel:'Invented program forward test',ordersEnabled:false,liveEnabled:false}).config;
 const plan=await m.createProgramForwardPlan({mode:prospective?'PROSPECTIVE':'SYNTHETIC_EXERCISE',handoff,config,preparedAt:'2026-02-01T00:01:00.000Z',startsAt:'2026-02-02T00:00:00.000Z',endsAt:'2026-02-02T04:00:00.000Z',pollMs:15000,cycles:10});return{plan,handoff,config,ledger,history:await m.createProgramForwardHistory(plan)};
}
