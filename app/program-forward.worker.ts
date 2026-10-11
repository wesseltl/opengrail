import {programClock,programUuid} from './program-run-model';
import {verifyProgramSessionJournal,reconstructProgramSessionJournal,admitProgramSessionEvent,executeProgramSessionPending,recoverProgramSessionJournal,discardProgramSessionRuntime,type ProgramSessionJournal} from './program-session-journal';

/** Resident first-party Worker; one interpreter persists across committed inputs. */
let retained:ProgramSessionJournal|null=null,lastAdmission:string|null=null,busy=false;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
self.onmessage=async(event:MessageEvent)=>{
 const command=event.data;let operationId:string|null=null,ownsOperation=false;
 if(busy){self.postMessage({version:1,kind:'ERROR',operationId:null});return;}
 try{
  if(!command||Object.keys(command).sort().join(',')!=='completionAt,journal,kind,operationId,version'||command.version!==1||!['RUN','RECOVER','RECONSTRUCT'].includes(command.kind))throw Error();operationId=programUuid.parse(command.operationId);busy=true;ownsOperation=true;
  const checked=await verifyProgramSessionJournal(command.journal);
  if(command.kind==='RUN'){
   if(!checked.pending)throw Error('Original durable pending input required.');
   if(checked.config.clockMode==='SYSTEM_RECEIPT'&&command.completionAt!==null)throw Error('Actual completion clock required.');
   const completion=checked.config.clockMode==='SYNTHETIC_PLAYBACK'?programClock.parse(command.completionAt):null;
   if(retained&&lastAdmission===checked.journalDigest){self.postMessage({version:1,kind:'RESULT',operationId,admissionDigest:checked.journalDigest,journal:retained});return;}
   let admitted:ProgramSessionJournal;
   if(retained){admitted=await admitProgramSessionEvent(retained,checked.pending.event,checked.pending.receivedAt);if(!same(admitted,checked))throw Error('Durable admission does not extend the retained interpreter.');}
   else admitted=await reconstructProgramSessionJournal(checked);
   retained=await executeProgramSessionPending(admitted,{clock:()=>completion??new Date().toISOString()});lastAdmission=checked.journalDigest;
  }else{
   if(command.kind==='RECOVER')retained=await recoverProgramSessionJournal(checked,programClock.parse(command.completionAt));
   else{if(command.completionAt!==null)throw Error();retained=await reconstructProgramSessionJournal(checked);}
   lastAdmission=null;
  }
  self.postMessage({version:1,kind:'RESULT',operationId,admissionDigest:checked.journalDigest,journal:retained});
 }catch{if(ownsOperation){if(retained)discardProgramSessionRuntime(retained);retained=null;lastAdmission=null;}self.postMessage({version:1,kind:'ERROR',operationId});}
 finally{if(ownsOperation)busy=false;}
};
