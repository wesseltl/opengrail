import {boundedStrategyRecord,strategyRecordV1Schema} from './strategy-model';
import {programSourceBytes} from './program-source-model';
import {parseProgramModule,programModuleInfo,createProgramInstance,invokeProgram,programState,ProgramWasmError,type ProgramInstance} from './program-wasm';
import {sessionConfigSchema,sessionVersion,SessionError,type SessionConfig,type SessionEvent} from './session-model';
import {createSessionJournal,appendSessionEvent,type SessionJournal} from './session-journal';
import {programSessionClock,programSessionDigest,programSessionLimits,type ProgramSessionConfig,type ProgramSessionJournal,type ProgramSessionGuest,type ProgramSessionReceipt} from './program-session-model';

export type ProgramSessionRuntime={instance:ProgramInstance|null};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export async function programSessionDerivedUuid(material:unknown){const hex=await programSessionDigest(JSON.stringify(material));return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);}
/** Explicitly private projection. It cannot impersonate or replace the public V2 source. */
export async function programSessionTradingProjection(config:ProgramSessionConfig):Promise<SessionConfig>{
 const original=config.strategy.record,{program,...content}=original.content;void program;
 const seed=await programSessionDigest(JSON.stringify(config)),id=await programSessionDerivedUuid(['program-forward-private-source',seed,original.id]);
 const record=strategyRecordV1Schema.parse({...original,version:1,id,rootId:id,revision:1,requestId:await programSessionDerivedUuid(['program-forward-private-source-request',seed]),content:{...content,relation:null}});
 if(record.id===original.id||record.requestId===original.requestId)throw new SessionError('Private projection identity collided.');
 const {kind:_,planDigest:__,...fields}=config;void _;void __;
 return sessionConfigSchema.parse({...fields,methodVersion:sessionVersion,strategy:{record,digest:await programSessionDigest(boundedStrategyRecord(record).payload)}});
}
export async function createProgramSessionTrading(config:ProgramSessionConfig,startedAt:string){return createSessionJournal(await programSessionTradingProjection(config),startedAt);}
const errorCode=(error:unknown)=>error instanceof ProgramWasmError?error.code:'PROGRAM_ERROR';
const usedFuel=(error:unknown,budget:number)=>error instanceof ProgramWasmError&&typeof error.fuelUsed==='number'&&Number.isInteger(error.fuelUsed)&&error.fuelUsed>=0&&error.fuelUsed<=budget?error.fuelUsed:0;
const digest=(value:unknown)=>programSessionDigest(JSON.stringify(value));
const failureReason=(code:string,budget:number)=>code==='FUEL'?(budget<programSessionLimits.perInvocationFuel?'TOTAL_FUEL_LIMIT':'FUEL_LIMIT'):'PROGRAM_TRAP';
async function capture(guest:ProgramSessionGuest,runtime:ProgramSessionRuntime){if(runtime.instance){guest.state=programState(runtime.instance);guest.stateDigest=await digest(guest.state);}}
async function kernelEvent(journal:ProgramSessionJournal,event:SessionEvent,tag:string){return {...event,requestId:await programSessionDerivedUuid(['program-forward-inner',journal.config.sessionId,event.requestId,tag])} as SessionEvent;}

/** Runs only a durably admitted outer input; caller owns pending and terminal durability. */
export async function executeProgramSessionTransition(journal:ProgramSessionJournal,runtime:ProgramSessionRuntime,clock:()=>string):Promise<{trading:SessionJournal;guest:ProgramSessionGuest;receipt:ProgramSessionReceipt;runtime:ProgramSessionRuntime}>{
 const admission=journal.pending;if(!admission)throw new SessionError('No durable pending program event.',409);
 const {event,receivedAt}=admission,guest=structuredClone(journal.guest),innerStart=journal.trading.state.sequence;
 let trading=journal.trading,reason:ProgramSessionReceipt['reason']='APPLIED',failed=false,trace:ProgramSessionGuest['trace'][number]|null=null;
 // A failed guest has no authority to resume its paused trading kernel.
 if(event.type==='RESUME'&&guest.status==='FAILED'||event.type==='CLOSED_BAR'&&(guest.status==='FAILED'||guest.status==='INTERRUPTED'))reason='GENERATOR_BLOCKED';
 else{
  trading=await appendSessionEvent(trading,await kernelEvent(journal,event,'original'),receivedAt);
  const kernelReceipt=trading.state.events.at(-1)!;
  if(kernelReceipt.disposition==='REJECTED')reason='REJECTED';
  if(event.type==='RESUME'&&guest.status==='INTERRUPTED'&&kernelReceipt.disposition==='ACCEPTED'&&trading.state.status==='ACTIVE'){guest.status=guest.state?'READY':'UNCONFIGURED';guest.failure=null;}
  if(event.type==='CLOSED_BAR'&&kernelReceipt.disposition==='ACCEPTED'){
   if(guest.status==='FAILED'||guest.status==='INTERRUPTED')reason='GENERATOR_BLOCKED';
   else{
    const source=journal.config.strategy.record.content.program;
    if(guest.status==='UNCONFIGURED'){
     const module=parseProgramModule(programSourceBytes(source.bytesHex));runtime.instance=createProgramInstance(module);
     guest.initialState=programState(runtime.instance);guest.initialStateDigest=await digest(guest.initialState);
     if(source.parameters.length&&!programModuleInfo(module).exports.includes('configure')){guest.failure='MODULE_ERROR';failed=true;}
     else for(let n=0;n<source.parameters.length;n++){
      const budget=Math.min(programSessionLimits.perInvocationFuel,programSessionLimits.totalFuel-guest.totalFuel);
      let fuelUsed=0,status:'APPLIED'|'FAILED'='APPLIED',code:string|null=null;
      try{if(budget<=0)throw new ProgramWasmError('FUEL','Total fuel exhausted.',0);fuelUsed=invokeProgram(runtime.instance,'configure',[n,source.parameters[n]],budget).fuelUsed;}
      catch(error){fuelUsed=usedFuel(error,budget);status='FAILED';code=errorCode(error);guest.failure=failureReason(code,budget);failed=true;}
      guest.totalFuel+=fuelUsed;await capture(guest,runtime);guest.configure.push({parameterIndex:n,value:source.parameters[n],fuelUsed,status,code,stateDigest:guest.stateDigest!});
      if(failed)break;
     }
     await capture(guest,runtime);guest.status=failed?'FAILED':'READY';
    }
    if(!failed){
     if(!runtime.instance)throw new SessionError('Retained guest must be reconstructed before continuation.',409);
     const barIndex=trading.state.bars.length-1,bar=event.bar,budget=Math.min(programSessionLimits.perInvocationFuel,programSessionLimits.totalFuel-guest.totalFuel);
     let output:number|null=null,fuelUsed=0,status:'OUTPUT'|'FAILED'='OUTPUT',code:string|null=null;
     try{if(budget<=0)throw new ProgramWasmError('FUEL','Total fuel exhausted.',0);const invocation=invokeProgram(runtime.instance,'on_bar',[barIndex,Date.parse(bar.closedAt),bar.open,bar.high,bar.low,bar.close,bar.volume],budget);output=invocation.value as number;fuelUsed=invocation.fuelUsed;}
     catch(error){fuelUsed=usedFuel(error,budget);status='FAILED';code=errorCode(error);guest.failure=failureReason(code,budget);failed=true;}
     guest.totalFuel+=fuelUsed;
     if(!failed&&output!==0&&output!==1&&output!==2){status='FAILED';code='INVALID_OUTPUT';guest.failure=code;failed=true;}
     if(!failed&&output&&trading.state.signals.length>=500){status='FAILED';code='SIGNAL_LIMIT';guest.failure=code;failed=true;}
     await capture(guest,runtime);
     trace={sourceRequestId:event.requestId,barIndex,closedAt:bar.closedAt,output,fuelUsed,status,code,stateDigest:guest.stateDigest!,generatedAt:null,signalId:null,signalRequestId:null,signalDisposition:failed?'FAILED':'NONE'};
     guest.trace.push(trace);if(failed)guest.status='FAILED';
    }
   }
  }
 }
 // Read a genuine completion clock only after the guest invocation and state capture.
 const completedAt=programSessionClock(clock());
 if(completedAt<receivedAt||completedAt<trading.state.lastReceivedAt||journal.events.length&&completedAt<journal.events.at(-1)!.completedAt)throw new SessionError('Post-guest completion clock regressed.');
 if(trace&&trace.status==='OUTPUT'&&trace.output){
  trace.generatedAt=completedAt;
  if(trading.state.status!=='ACTIVE'||trading.state.emergencyAt!==null){trace.signalDisposition='SUPPRESSED_PAUSED';}
  else{
   trace.signalId=await programSessionDerivedUuid(['program-forward-signal',journal.config.sessionId,event.requestId,trace.barIndex,trace.output]);
   trace.signalRequestId=await programSessionDerivedUuid(['program-forward-signal-request',journal.config.sessionId,event.requestId,trace.barIndex,trace.output]);trace.signalDisposition='EMITTED';
   trading=await appendSessionEvent(trading,{requestId:trace.signalRequestId,type:'SIGNAL',signal:{id:trace.signalId,provider:'CUSTOM',event:trace.output===1?'BULLISH':'BEARISH',observedAt:trace.closedAt,availableAt:completedAt}},completedAt);
  }
 }
 if(failed){reason='GENERATOR_FAILED';guest.status='FAILED';await capture(guest,runtime);trading=await appendSessionEvent(trading,{requestId:await programSessionDerivedUuid(['program-forward-failure-pause',journal.config.sessionId,event.requestId]),type:'PAUSE'},completedAt);}
 return {trading,guest,runtime,receipt:{...admission,status:'COMPLETED',completedAt,reason,innerStart,innerEnd:trading.state.sequence,guestStateDigest:guest.stateDigest,guestTraceLength:guest.trace.length,tradingDigest:trading.journalDigest}};
}
/** An uncertain admitted event is retained as interrupted, never replayed as completed. */
export async function interruptProgramSessionTransition(journal:ProgramSessionJournal,runtime:ProgramSessionRuntime,recoveredAt:string){
 const admission=journal.pending;if(!admission)throw new SessionError('No pending input to interrupt.',409);
 const at=programSessionClock(recoveredAt);if(at<admission.receivedAt||at<journal.trading.state.lastReceivedAt||journal.events.length&&at<journal.events.at(-1)!.completedAt)throw new SessionError('Recovery clock regressed.');
 const guest=structuredClone(journal.guest);if(guest.status!=='FAILED'){guest.status='INTERRUPTED';guest.failure='INTERRUPTED';}
 const trading=await appendSessionEvent(journal.trading,{requestId:await programSessionDerivedUuid(['program-forward-interruption-pause',journal.config.sessionId,admission.event.requestId]),type:'PAUSE'},at);
 const receipt:ProgramSessionReceipt={...admission,status:'INTERRUPTED',completedAt:at,reason:'INTERRUPTED',innerStart:journal.trading.state.sequence,innerEnd:trading.state.sequence,guestStateDigest:guest.stateDigest,guestTraceLength:guest.trace.length,tradingDigest:trading.journalDigest};
 return {guest,trading,receipt,runtime};
}
export const sameProgramSessionValue=same;
