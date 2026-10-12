import {z} from 'zod';
import {boundedExperimentCommand,boundedExperimentTransport,experimentCommitmentRegisterSchema,experimentCommitmentOutcomeSchema,experimentMeSchema,experimentLimits} from './experiment-model';
import {verifyProgramCommitmentPlan} from './program-commitment-model';
import {programCommitmentBrowserLimits,programCommitmentSame,type ProgramCommitmentCommand,type ProgramCommitmentMe} from './program-commitment-browser';

/** One owner-bound original public command. This store never alters a Session. */
const databaseName='opengrail-program-commitment-commands-v1',storeName='commands';
const pendingSchema=z.object({version:z.literal(1),owner:z.string().regex(/^human_[a-f0-9]{64}$/),author:experimentMeSchema,command:z.union([experimentCommitmentRegisterSchema,experimentCommitmentOutcomeSchema]),body:z.string().min(1).max(experimentLimits.requestBytes),submitted:z.boolean()}).strict();
export type ProgramCommitmentPending=z.infer<typeof pendingSchema>;
export class ProgramCommitmentStorageError extends Error{constructor(readonly code:'INVALID'|'UNAVAILABLE'|'CONFLICT'|'ABORTED'){super('Original publication storage '+code.toLowerCase()+'.');}}
function fail(code:ProgramCommitmentStorageError['code']):never{throw new ProgramCommitmentStorageError(code);}
function check(owner:string,signal:AbortSignal){if(!/^human_[a-f0-9]{64}$/.test(owner))fail('INVALID');if(signal.aborted)fail('ABORTED');}
export async function verifyProgramCommitmentPending(raw:unknown,owner:string){
 try{boundedExperimentTransport(raw,programCommitmentBrowserLimits.pendingStoreBytes);const value=pendingSchema.parse(raw);if(value.owner!==owner||value.author.authorId!==owner||JSON.stringify(value)!==JSON.stringify(raw))fail('INVALID');const bounded=boundedExperimentCommand(value.command);if(bounded.payload!==value.body)fail('INVALID');if(value.command.action==='register')await verifyProgramCommitmentPlan(value.command.input);return value;}catch(error){if(error instanceof ProgramCommitmentStorageError)throw error;return fail('INVALID');}
}
export function createProgramCommitmentPending(command:ProgramCommitmentCommand,author:ProgramCommitmentMe):ProgramCommitmentPending{const checked=boundedExperimentCommand(command);return{version:1,owner:author.authorId,author,command:checked.command as ProgramCommitmentCommand,body:checked.payload,submitted:false};}
function open(signal:AbortSignal):Promise<IDBDatabase>{
 if(signal.aborted)return Promise.reject(new ProgramCommitmentStorageError('ABORTED'));if(!globalThis.indexedDB)return Promise.reject(new ProgramCommitmentStorageError('UNAVAILABLE'));
 return new Promise((resolve,reject)=>{let ended=false,request:IDBOpenDBRequest;const stop=(code:ProgramCommitmentStorageError['code'])=>{if(ended)return;ended=true;signal.removeEventListener('abort',aborted);reject(new ProgramCommitmentStorageError(code));},aborted=()=>stop('ABORTED');signal.addEventListener('abort',aborted,{once:true});
  try{request=indexedDB.open(databaseName,1);}catch{stop('UNAVAILABLE');return;}request.onerror=()=>stop(signal.aborted?'ABORTED':'UNAVAILABLE');request.onblocked=()=>stop('UNAVAILABLE');request.onupgradeneeded=event=>{try{if(ended||signal.aborted||event.oldVersion!==0)throw Error();request.result.createObjectStore(storeName,{keyPath:'owner'});}catch{try{request.transaction?.abort();}catch{}stop('UNAVAILABLE');}};
  request.onsuccess=()=>{const db=request.result;if(ended||signal.aborted){db.close();stop('ABORTED');return;}if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(storeName)){db.close();stop('UNAVAILABLE');return;}ended=true;signal.removeEventListener('abort',aborted);db.onversionchange=()=>db.close();resolve(db);};
 });
}
function transaction<T>(db:IDBDatabase,mode:'readonly'|'readwrite',signal:AbortSignal,work:(store:IDBObjectStore,done:(value:T)=>void,refuse:(code:ProgramCommitmentStorageError['code'])=>void)=>void):Promise<T>{
 return new Promise((resolve,reject)=>{let tx:IDBTransaction,ended=false,hasValue=false,value:T,failure:ProgramCommitmentStorageError['code']|null=null;
  const end=(code:ProgramCommitmentStorageError['code']|null)=>{if(ended)return;ended=true;signal.removeEventListener('abort',aborted);if(code||!hasValue)reject(new ProgramCommitmentStorageError(code??'UNAVAILABLE'));else resolve(value);},refuse=(code:ProgramCommitmentStorageError['code'])=>{failure=code;try{tx.abort();}catch{end(code);}},aborted=()=>refuse('ABORTED');
  try{if(signal.aborted){end('ABORTED');return;}tx=mode==='readwrite'?db.transaction(storeName,mode,{durability:'strict'}):db.transaction(storeName,mode);tx.oncomplete=()=>end(signal.aborted?'ABORTED':null);tx.onabort=()=>end(failure??(signal.aborted?'ABORTED':'UNAVAILABLE'));tx.onerror=()=>{failure??='UNAVAILABLE';};signal.addEventListener('abort',aborted,{once:true});const store=tx.objectStore(storeName);if(store.keyPath!=='owner'||store.autoIncrement||store.indexNames.length){refuse('UNAVAILABLE');return;}work(store,result=>{value=result;hasValue=true;},refuse);}catch{end(signal.aborted?'ABORTED':'UNAVAILABLE');}
 });
}
async function readRaw(db:IDBDatabase,owner:string,signal:AbortSignal){return transaction<unknown>(db,'readonly',signal,(store,done)=>{const request=store.get(owner);request.onsuccess=()=>done(request.result);});}
export async function readProgramCommitmentPending(owner:string,signal:AbortSignal):Promise<ProgramCommitmentPending|null>{check(owner,signal);const db=await open(signal);try{const raw=await readRaw(db,owner,signal);if(raw===undefined)return null;const value=await verifyProgramCommitmentPending(raw,owner);check(owner,signal);return value;}finally{db.close();}}
/** Exact compare-and-set and transaction completion precede any public POST. */
export async function saveProgramCommitmentPending(nextRaw:ProgramCommitmentPending,expected:ProgramCommitmentPending|null,signal:AbortSignal){
 const owner=nextRaw.owner;check(owner,signal);const next=await verifyProgramCommitmentPending(nextRaw,owner);if(expected){await verifyProgramCommitmentPending(expected,owner);if(!programCommitmentSame(next.command,expected.command)||!programCommitmentSame(next.author,expected.author)||next.body!==expected.body||expected.submitted&&!next.submitted)fail('CONFLICT');}const db=await open(signal);
 try{check(owner,signal);await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{const read=store.get(owner);read.onsuccess=()=>{if(!programCommitmentSame(read.result??null,expected)){refuse('CONFLICT');return;}const put=store.put(next);put.onsuccess=()=>done();};});}finally{db.close();}
}
/** Only a reconciled exact original acknowledgment may clear this command. */
export async function clearProgramCommitmentPending(expected:ProgramCommitmentPending,signal:AbortSignal){check(expected.owner,signal);await verifyProgramCommitmentPending(expected,expected.owner);const db=await open(signal);try{await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{const read=store.get(expected.owner);read.onsuccess=()=>{if(!programCommitmentSame(read.result,expected)){refuse('CONFLICT');return;}const remove=store.delete(expected.owner);remove.onsuccess=()=>done();};});}finally{db.close();}}
