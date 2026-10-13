import {z} from 'zod';
import {boundedExperimentCommand,boundedExperimentTransport,experimentWindowRegisterSchema,experimentWindowOutcomeSchema,experimentMeSchema,type ExperimentCommand} from './experiment-model';
import {verifyProgramWindowInput} from './program-window-model';
import {boundedProgramWindowValue} from './program-window-model';
import {readProgramWindowLocalValue,compareAndSetProgramWindowLocalValue,ProgramWindowLocalStoreError} from './program-window-local-store';

export type ProgramWindowPublicationCommand=Extract<ExperimentCommand,{method:'PROGRAM_FORWARD_WINDOW'}>;
export type ProgramWindowPublicationIdentity=ReturnType<typeof experimentMeSchema.parse>;
export const programWindowPublicationLimits=Object.freeze({pendingBytes:1589248,retainedCommands:1,ledgerBytes:8388608,retiredCommands:8,allMaximaFit:'NOT_ESTABLISHED'});
const pendingSchema=z.object({version:z.literal(1),owner:z.string().regex(/^human_[a-f0-9]{64}$/),author:experimentMeSchema,command:z.union([experimentWindowRegisterSchema,experimentWindowOutcomeSchema]),body:z.string().min(1).max(786432),submitted:z.boolean()}).strict();
export type ProgramWindowPublicationPending=z.infer<typeof pendingSchema>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const retiredSchema=z.object({kind:z.literal('LOCAL_UNSUBMITTED_INTENT_RETIRED'),retiredAt:z.string().datetime().refine(value=>Number.isSafeInteger(Date.parse(value))&&new Date(value).toISOString()===value),reason:z.literal('AUTHOR_ABANDONED_BEFORE_APP_DISPATCH'),original:pendingSchema.refine(value=>value.submitted===false)}).strict();
const ledgerSchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_WINDOW_PUBLICATION_LEDGER'),owner:z.string().regex(/^human_[a-f0-9]{64}$/),current:pendingSchema.nullable(),retired:z.array(retiredSchema).max(programWindowPublicationLimits.retiredCommands)}).strict();
export type ProgramWindowPublicationLedger=z.infer<typeof ledgerSchema>;
async function ledger(raw:unknown|null,owner:string):Promise<ProgramWindowPublicationLedger>{
 if(raw===null)return{version:1,kind:'LOCAL_WINDOW_PUBLICATION_LEDGER',owner,current:null,retired:[]};
 boundedProgramWindowValue(raw,programWindowPublicationLimits.ledgerBytes,44,1250000);
 // Source-only earlier pending rows remain readable; verified migration is
 // performed by an exact complete-row CAS, never by overwriting uncertainty.
 if((raw as {kind?:unknown}).kind!=='LOCAL_WINDOW_PUBLICATION_LEDGER')return {version:1,kind:'LOCAL_WINDOW_PUBLICATION_LEDGER',owner,current:await verifyProgramWindowPublicationPending(raw,owner),retired:[]};
 let value:ProgramWindowPublicationLedger;try{value=ledgerSchema.parse(raw);}catch{throw new ProgramWindowLocalStoreError('INVALID');}
 if(value.owner!==owner||!same(raw,value))throw new ProgramWindowLocalStoreError('INVALID');
 if(value.current)await verifyProgramWindowPublicationPending(value.current,owner);for(const retired of value.retired)await verifyProgramWindowPublicationPending(retired.original,owner);
 const ids=[...value.retired.map(value=>value.original.command.requestId),...value.current?[value.current.command.requestId]:[]];if(new Set(ids).size!==ids.length)throw new ProgramWindowLocalStoreError('INVALID');return value;
}
export async function verifyProgramWindowPublicationPending(raw:unknown,owner:string):Promise<ProgramWindowPublicationPending>{
 try{boundedExperimentTransport(raw,programWindowPublicationLimits.pendingBytes);const value=pendingSchema.parse(raw);if(value.owner!==owner||value.author.authorId!==owner||!same(value,raw)||boundedExperimentCommand(value.command).payload!==value.body)throw Error();if(value.command.action==='register')await verifyProgramWindowInput(value.command.input);return value;}catch{throw new ProgramWindowLocalStoreError('INVALID');}
}
export function createProgramWindowPublicationPending(command:ProgramWindowPublicationCommand,author:ProgramWindowPublicationIdentity):ProgramWindowPublicationPending{
 const checked=boundedExperimentCommand(command);if(!('method'in checked.command)||checked.command.method!=='PROGRAM_FORWARD_WINDOW')throw new ProgramWindowLocalStoreError('INVALID');
 const value=pendingSchema.parse({version:1,owner:author.authorId,author,command:checked.command,body:checked.payload,submitted:false});boundedExperimentTransport(value,programWindowPublicationLimits.pendingBytes);return value;
}
export async function readProgramWindowPublicationLedger(owner:string,signal:AbortSignal):Promise<ProgramWindowPublicationLedger>{const raw=await readProgramWindowLocalValue('PUBLICATION',owner,signal),value=await ledger(raw,owner);signal.throwIfAborted();return value;}
export async function readProgramWindowPublicationPending(owner:string,signal:AbortSignal):Promise<ProgramWindowPublicationPending|null>{return (await readProgramWindowPublicationLedger(owner,signal)).current;}
export async function saveProgramWindowPublicationPending(nextRaw:ProgramWindowPublicationPending,expectedRaw:ProgramWindowPublicationPending|null,signal:AbortSignal):Promise<void>{
 boundedExperimentTransport(nextRaw,programWindowPublicationLimits.pendingBytes);
 const next=await verifyProgramWindowPublicationPending(nextRaw,nextRaw.owner),expected=expectedRaw?await verifyProgramWindowPublicationPending(expectedRaw,next.owner):null;
 if(expected&&(!same(next.command,expected.command)||!same(next.author,expected.author)||next.body!==expected.body||expected.submitted&&!next.submitted))throw new ProgramWindowLocalStoreError('CONFLICT');
 const raw=await readProgramWindowLocalValue('PUBLICATION',next.owner,signal),before=await ledger(raw,next.owner);if(!same(before.current,expected))throw new ProgramWindowLocalStoreError('CONFLICT');
 const after=await ledger({...before,current:next},next.owner);signal.throwIfAborted();await compareAndSetProgramWindowLocalValue('PUBLICATION',next.owner,after,raw,signal);
}
/** Only the caller's fully correlated acknowledgment permits clearing; the
 * exact stored original is compared again at strict transaction completion. */
export async function clearProgramWindowPublicationPending(expectedRaw:ProgramWindowPublicationPending,signal:AbortSignal):Promise<void>{boundedExperimentTransport(expectedRaw,programWindowPublicationLimits.pendingBytes);const expected=await verifyProgramWindowPublicationPending(expectedRaw,expectedRaw.owner),raw=await readProgramWindowLocalValue('PUBLICATION',expected.owner,signal),before=await ledger(raw,expected.owner);if(!same(before.current,expected))throw new ProgramWindowLocalStoreError('CONFLICT');const after=await ledger({...before,current:null},expected.owner);signal.throwIfAborted();await compareAndSetProgramWindowLocalValue('PUBLICATION',expected.owner,after,raw,signal);}

/** Explicit retirement is available only before this app marked dispatch.
 * Preserve the whole original in an append-only local log. It neither cancels
 * an external record nor proves the sponsor used no other transport. A
 * dispatched/unconfirmed original cannot be retired through this operation. */
export async function retireProgramWindowPreparedIntent(expectedRaw:ProgramWindowPublicationPending,retiredAt:string,signal:AbortSignal):Promise<void>{
 boundedExperimentTransport(expectedRaw,programWindowPublicationLimits.pendingBytes);const expected=await verifyProgramWindowPublicationPending(expectedRaw,expectedRaw.owner);if(expected.submitted)throw new ProgramWindowLocalStoreError('CONFLICT');
 const raw=await readProgramWindowLocalValue('PUBLICATION',expected.owner,signal),before=await ledger(raw,expected.owner);if(!same(before.current,expected))throw new ProgramWindowLocalStoreError('CONFLICT');
 const after=await ledger({...before,current:null,retired:[...before.retired,{kind:'LOCAL_UNSUBMITTED_INTENT_RETIRED',retiredAt,reason:'AUTHOR_ABANDONED_BEFORE_APP_DISPATCH',original:expected}]},expected.owner);
 signal.throwIfAborted();await compareAndSetProgramWindowLocalValue('PUBLICATION',expected.owner,after,raw,signal);
}
