import {runProgramReplay} from './program-run';

/** Only reviewed runtime code runs here; guest bytes are numeric interpreter data. */
let admitted=false;
self.onmessage=async(event:MessageEvent)=>{
 const command=event.data;
 if(admitted||!command||command.version!==1||command.kind!=='RUN'||typeof command.attemptId!=='string'||Object.keys(command).sort().join(',')!=='attemptId,input,kind,version'){
  self.postMessage({version:1,kind:'ERROR',attemptId:null,error:'Invalid local worker command.'});return;
 }
 admitted=true;
 try{
  const outcome=await runProgramReplay(command.input,command.attemptId);
  self.postMessage({version:1,kind:'RESULT',attemptId:command.attemptId,outcome});
 }catch{
  self.postMessage({version:1,kind:'ERROR',attemptId:command.attemptId,error:'The local runtime failed before a correlated outcome was produced.'});
 }
};
