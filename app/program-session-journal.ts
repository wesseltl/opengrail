import {SessionError,sessionLimits} from './session-model';
import {verifySessionJournal,sessionJournalLimits} from './session-journal';
import {parseProgramModule,programModuleInfo} from './program-wasm';
import {programSourceBytes} from './program-source-model';
import {boundedProgramSessionValue,boundedProgramSessionEvent,verifyProgramSessionConfig,programSessionJournalSchema,programSessionJournalBodySchema,programSessionDigest,programSessionClock,programSessionLimits,programSessionMethod,programSessionImplementation,emptyProgramSessionGuest,type ProgramSessionJournal} from './program-session-model';
import {createProgramSessionTrading,programSessionTradingProjection,executeProgramSessionTransition,interruptProgramSessionTransition,sameProgramSessionValue,type ProgramSessionRuntime} from './program-session-engine';
export type {ProgramSessionJournal} from './program-session-model';
const trusted=new WeakSet<object>(),runtimes=new WeakMap<object,ProgramSessionRuntime>();
const digest=(value:unknown)=>programSessionDigest(JSON.stringify(value));
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function prepared(){if(Object.values(programSessionImplementation().forward).some(hash=>/^0+$/.test(hash)))throw new SessionError('Program session physical source identities are not prepared.',503);}
async function seal(raw:unknown,runtime?:ProgramSessionRuntime):Promise<ProgramSessionJournal>{
 boundedProgramSessionValue(raw);const body=programSessionJournalBodySchema.parse(raw);
 // Keep the exact immutable kernel journal returned by its own checked engine.
 // Re-parsing it loses the kernel's private trusted identity and would cold-replay
 // the entire prefix on every live quote. Untrusted imports have no runtime handle
 // and still pass mandatory fresh reconstruction before any guest continuation.
 const originalTrading=(raw as typeof body).trading;if(!sameProgramSessionValue(body.trading,originalTrading))throw new SessionError('Canonical trading journal changed during sealing.');body.trading=originalTrading;
 const parsed=programSessionJournalSchema.parse({...body,journalDigest:await digest(body)}),journal={...parsed,trading:originalTrading};
 boundedProgramSessionValue(journal);freeze(journal);trusted.add(journal);if(runtime)runtimes.set(journal,runtime);return journal;
}
const body=(journal:ProgramSessionJournal)=>{const {journalDigest,...rest}=journal;void journalDigest;return rest;};
export function discardProgramSessionRuntime(journal:unknown){if(journal&&typeof journal==='object')runtimes.delete(journal);}
/** Structural identities only. No guest code is invoked by this function. */
export async function verifyProgramSessionJournal(raw:unknown):Promise<ProgramSessionJournal>{
 prepared();boundedProgramSessionValue(raw);let journal:ProgramSessionJournal;try{journal=programSessionJournalSchema.parse(raw);}catch{throw new SessionError('Invalid bounded program session journal.');}
 if(journal.journalDigest!==await digest(body(journal))||!sameProgramSessionValue(journal.implementation,programSessionImplementation())||journal.methodDigest!==await digest(programSessionMethod))throw new SessionError('Program session source or method identity differs.');
 await verifyProgramSessionConfig(journal.config);await verifySessionJournal(journal.trading);
 if(!sameProgramSessionValue(journal.trading.config,await programSessionTradingProjection(journal.config))||journal.startedAt!==journal.trading.startedAt)throw new SessionError('Original V2/private V1 projection binding differs.');
 let inner=0,previous=journal.startedAt;const ids=new Set<string>();
 for(let n=0;n<journal.events.length;n++){
  const entry=journal.events[n];if(entry.sequence!==n+1||ids.has(entry.event.requestId)||entry.innerStart!==inner||entry.innerEnd<inner||entry.completedAt<entry.receivedAt||entry.completedAt<previous||entry.status==='INTERRUPTED'!== (entry.reason==='INTERRUPTED'))throw new SessionError('Outer input receipt chain is inconsistent.');
  if(entry.innerEnd>journal.trading.events.length)throw new SessionError('Outer receipt exceeds its retained inner history.');
  if(entry.guestTraceLength>journal.guest.trace.length)throw new SessionError('Outer receipt trace linkage differs.');
  ids.add(entry.event.requestId);inner=entry.innerEnd;previous=entry.completedAt;
 }
 if(inner!==journal.trading.state.sequence)throw new SessionError('Outer and inner final sequence disagree.');
 if(journal.events.length&&(journal.events.at(-1)!.tradingDigest!==journal.trading.journalDigest||journal.events.at(-1)!.guestStateDigest!==journal.guest.stateDigest||journal.events.at(-1)!.guestTraceLength!==journal.guest.trace.length))throw new SessionError('Final outer checkpoint binding differs.');
 if(journal.pending&&(journal.pending.sequence!==journal.events.length+1||ids.has(journal.pending.event.requestId)))throw new SessionError('Pending original identity differs.');
 const guest=journal.guest;
 if(Boolean(guest.state)!==Boolean(guest.stateDigest)||Boolean(guest.initialState)!==Boolean(guest.initialStateDigest)||guest.state&&await digest(guest.state)!==guest.stateDigest||guest.initialState&&await digest(guest.initialState)!==guest.initialStateDigest)throw new SessionError('Guest snapshot digest differs.');
 if(guest.totalFuel!==guest.configure.reduce((n,row)=>n+row.fuelUsed,0)+guest.trace.reduce((n,row)=>n+row.fuelUsed,0)||guest.configure.some((row,n)=>row.parameterIndex!==n||row.value!==journal.config.strategy.record.content.program.parameters[n]))throw new SessionError('Configure history or cumulative fuel differs.');
 if(guest.status==='UNCONFIGURED'&&(guest.configure.length||guest.trace.length||guest.state||guest.initialState)||guest.status==='FAILED'&&!guest.failure||guest.status==='INTERRUPTED'&&guest.failure!=='INTERRUPTED')throw new SessionError('Guest disposition differs from retained state.');
 const info=programModuleInfo(parseProgramModule(programSourceBytes(journal.config.strategy.record.content.program.bytesHex)));
 for(const state of [guest.initialState,guest.state])if(state){
  if(state.globals.length!==info.globalTypes.length||state.globalBits.length!==info.globalTypes.length||state.memory.length%65536||state.memory.length<info.memoryPages*65536||state.memory.length>info.memoryMaximumPages*65536)throw new SessionError('Guest state dimensions differ.');
  for(let n=0;n<state.globals.length;n++){const type=info.globalTypes[n],bits=state.globalBits[n];if(bits.length!==(type==='i32'?8:16))throw new SessionError('Raw global state width differs.');const bytes=Uint8Array.from(bits.match(/../g)!,pair=>parseInt(pair,16)),view=new DataView(bytes.buffer),value=type==='i32'?view.getInt32(0,true):view.getFloat64(0,true);if(!Number.isFinite(value)||value!==state.globals[n])throw new SessionError('Raw global state bits differ.');}
 }
 return freeze(journal);
}
export async function createProgramSessionJournal(rawConfig:unknown,startedAt:string):Promise<ProgramSessionJournal>{
 prepared();const config=await verifyProgramSessionConfig(rawConfig),at=programSessionClock(startedAt);
 return seal({version:1,kind:'LOCAL_PROGRAM_DEMO_SESSION',classification:'AUTHOR_REPORTED',qualification:'NONE',generatorIndependence:'NOT_ESTABLISHED',ordersEnabled:false,liveEnabled:false,implementation:programSessionImplementation(),methodDigest:await digest(programSessionMethod),config,startedAt:at,events:[],pending:null,guest:emptyProgramSessionGuest(),trading:await createProgramSessionTrading(config,at)},{instance:null});
}
async function origin(raw:unknown){return raw&&typeof raw==='object'&&trusted.has(raw)?raw as ProgramSessionJournal:reconstructProgramSessionJournal(raw);}
/** Durable caller must commit the returned complete pending journal before execute. */
export async function admitProgramSessionEvent(rawJournal:unknown,rawEvent:unknown,receivedAt:string):Promise<ProgramSessionJournal>{
 return prepareAdmission(await origin(rawJournal),rawEvent,receivedAt,true);
}
/** Inert parent/browser admission. Execution must reconstruct this untrusted claimed prefix. */
export async function prepareProgramSessionAdmission(rawJournal:unknown,rawEvent:unknown,receivedAt:string):Promise<ProgramSessionJournal>{
 return prepareAdmission(await verifyProgramSessionJournal(rawJournal),rawEvent,receivedAt,false);
}
async function prepareAdmission(journal:ProgramSessionJournal,rawEvent:unknown,receivedAt:string,retainRuntime:boolean):Promise<ProgramSessionJournal>{
 const {event}=boundedProgramSessionEvent(rawEvent),at=programSessionClock(receivedAt),prior=journal.events.find(row=>row.event.requestId===event.requestId);
 if(prior){if(!sameProgramSessionValue(prior.event,event))throw new SessionError('Original request ID cannot change its payload.',409);return journal;}
 if(journal.pending){if(journal.pending.event.requestId===event.requestId&&sameProgramSessionValue(journal.pending.event,event))return journal;throw new SessionError('The previous original input is still durably pending.',409);}
 const reserved=event.type==='QUOTE'||event.type==='EMERGENCY',need=event.type==='CLOSED_BAR'?3:1;
 if(journal.events.length>=programSessionLimits.events||!reserved&&journal.events.length>=programSessionLimits.normalEvents||journal.trading.state.sequence+need> (reserved?sessionLimits.events+sessionLimits.emergencyReserve:sessionLimits.events))throw new SessionError('Complete terminal and emergency sequence headroom is retained.',429);
 const size=new TextEncoder().encode(JSON.stringify(journal)).byteLength,kernelSize=new TextEncoder().encode(JSON.stringify(journal.trading)).byteLength;
 if(size+programSessionLimits.terminalReserveBytes>programSessionLimits.journalBytes-(reserved?0:programSessionLimits.reservedBytes)||kernelSize+programSessionLimits.kernelTerminalReserveBytes>sessionJournalLimits.bytes-(reserved?0:sessionJournalLimits.reservedBytes))throw new SessionError('Complete terminal byte evidence and protective headroom are retained.',429);
 const runtime=retainRuntime?runtimes.get(journal):undefined;if(retainRuntime)runtimes.delete(journal);
 return seal({...body(journal),pending:{sequence:journal.events.length+1,event,receivedAt:at}},runtime);
}
/** Caller confirms the whole returned terminal before ACK, new input or UI adoption. */
export async function executeProgramSessionPending(raw:unknown,options:{clock:()=>string}):Promise<ProgramSessionJournal>{
 let journal=await origin(raw);if(!journal.pending)throw new SessionError('A pending original event is required.',409);
 let runtime=runtimes.get(journal);runtimes.delete(journal);
 if(!runtime){journal=await reconstructProgramSessionJournal(journal);runtime=runtimes.get(journal);runtimes.delete(journal);}
 if(!runtime)throw new SessionError('Reconstructed program runtime unavailable.',503);
 const result=await executeProgramSessionTransition(journal,runtime,options.clock);
 return seal({...body(journal),pending:null,guest:result.guest,trading:result.trading,events:[...journal.events,result.receipt]},result.runtime);
}
export async function recoverProgramSessionJournal(raw:unknown,recoveredAt:string):Promise<ProgramSessionJournal>{
 const journal=await reconstructProgramSessionJournal(raw);if(!journal.pending)return journal;
 const runtime=runtimes.get(journal)!;runtimes.delete(journal);const result=await interruptProgramSessionTransition(journal,runtime,recoveredAt);
 return seal({...body(journal),pending:null,guest:result.guest,trading:result.trading,events:[...journal.events,result.receipt]},runtime);
}
/** Fresh configure/on_bar and unchanged kernel replay; hash-consistent snapshots are insufficient. */
export async function reconstructProgramSessionJournal(raw:unknown,options:{signal?:AbortSignal;onCheckpoint?:(journal:ProgramSessionJournal)=>void}={}):Promise<ProgramSessionJournal>{
 options.signal?.throwIfAborted();const claimed=await verifyProgramSessionJournal(raw);let reconstructed=await createProgramSessionJournal(claimed.config,claimed.startedAt),runtime:ProgramSessionRuntime={instance:null};
 options.onCheckpoint?.(reconstructed);
 for(const receipt of claimed.events){
  options.signal?.throwIfAborted();const pending=await seal({...body(reconstructed),pending:{sequence:receipt.sequence,event:receipt.event,receivedAt:receipt.receivedAt}});
  const result=receipt.status==='INTERRUPTED'?await interruptProgramSessionTransition(pending,runtime,receipt.completedAt):await executeProgramSessionTransition(pending,runtime,()=>receipt.completedAt);
  if(!sameProgramSessionValue(result.receipt,receipt))throw new SessionError('Original input, generated decision or intermediate checkpoint does not reconstruct.');
  reconstructed=await seal({...body(reconstructed),pending:null,guest:result.guest,trading:result.trading,events:[...reconstructed.events,result.receipt]});runtime=result.runtime;options.onCheckpoint?.(reconstructed);
 }
 options.signal?.throwIfAborted();reconstructed=await seal({...body(reconstructed),pending:claimed.pending},runtime);
 if(!sameProgramSessionValue(reconstructed,claimed)){runtimes.delete(reconstructed);throw new SessionError('Whole program and trading journal do not reconstruct from exact inputs.');}
 return reconstructed;
}
