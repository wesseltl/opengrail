import {evaluateProgramSearchAttempt,verifyProgramSearchAttempt} from './program-search-protocol';

/** Fixed first-party execution; contributed WASM remains bounded interpreter data. */
let admitted=false;
self.onmessage=async(event:MessageEvent)=>{
 const command=event.data;
 if(admitted||!command||command.version!==1||command.kind!=='RUN'||typeof command.attemptId!=='string'||Object.keys(command).sort().join(',')!=='attempt,attemptId,kind,version'){
  self.postMessage({version:1,kind:'ERROR',attemptId:null});return;
 }
 admitted=true;
 try{
  const attempt=await verifyProgramSearchAttempt(command.attempt);
  if(attempt.status!=='RUNNING'||attempt.attemptId!==command.attemptId)throw Error('Original admission required.');
  const terminal=await evaluateProgramSearchAttempt(attempt);
  self.postMessage({version:1,kind:'RESULT',attemptId:attempt.attemptId,terminal});
 }catch{self.postMessage({version:1,kind:'ERROR',attemptId:command.attemptId});}
};
