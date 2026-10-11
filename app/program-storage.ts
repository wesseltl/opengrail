import {verifyProgramRunLedger,type ProgramRunLedger} from './program-run-ledger';
import {guardProgramData,programRunLimits} from './program-run-model';

/** Owner-scoped local evidence, never a production credential or execution grant. */
export type ProgramStorageOwner='ANONYMOUS'|`human_${string}`;
export type ProgramStorageErrorCode='UNAVAILABLE'|'CONFLICT'|'ABORTED'|'INVALID';
export class ProgramStorageError extends Error {
  readonly code:ProgramStorageErrorCode;
  constructor(code:ProgramStorageErrorCode){super(code==='CONFLICT'?'Local program history changed.':code==='ABORTED'?'Local program history operation aborted.':code==='INVALID'?'Local program history is invalid.':'Durable local program history is unavailable.');this.name='ProgramStorageError';this.code=code;}
}
const databaseName='opengrail-program-history-v1',storeName='history';
type Stored={version:1;owner:ProgramStorageOwner;ledger:ProgramRunLedger};
const error=(code:ProgramStorageErrorCode):never=>{throw new ProgramStorageError(code);};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function check(owner:ProgramStorageOwner,signal:AbortSignal){if(typeof owner!=='string'||owner!=='ANONYMOUS'&&!/^human_[a-f0-9]{64}$/.test(owner))error('INVALID');if(!(signal instanceof AbortSignal))error('INVALID');if(signal.aborted)error('ABORTED');}
async function verified(raw:unknown):Promise<ProgramRunLedger>{try{return await verifyProgramRunLedger(raw);}catch{return error('INVALID');}}
function stored(raw:unknown,owner:ProgramStorageOwner):Stored|null{
  if(raw===undefined)return null;
  try{guardProgramData(raw,programRunLimits.historyBytes+256,2_000_100);const value=raw as Stored;if(!value||Object.keys(value).sort().join(',')!=='ledger,owner,version'||value.version!==1||value.owner!==owner)error('INVALID');return value;}catch{return error('INVALID');}
}
function extension(previous:ProgramRunLedger,next:ProgramRunLedger){
  if(previous.ledgerId!==next.ledgerId||previous.createdAt!==next.createdAt||next.entries.length<previous.entries.length||next.events.length<previous.events.length||!equal(next.events.slice(0,previous.events.length),previous.events))error('CONFLICT');
  for(let n=0;n<previous.entries.length;n++){
    const prior=previous.entries[n],value=next.entries[n];
    if(prior.kind==='INPUT_REJECTION'||value.kind!=='RUN'||prior.kind!=='RUN'){if(!equal(prior,value))error('CONFLICT');continue;}
    const {outcome:priorOutcome,...priorAdmission}=prior,{outcome:nextOutcome,...nextAdmission}=value;
    if(!equal(priorAdmission,nextAdmission)||priorOutcome!==null&&!equal(priorOutcome,nextOutcome))error('CONFLICT');
  }
}

function open(signal:AbortSignal):Promise<IDBDatabase>{
  if(signal.aborted)return Promise.reject(new ProgramStorageError('ABORTED'));
  const factory=globalThis.indexedDB;if(!factory)return Promise.reject(new ProgramStorageError('UNAVAILABLE'));
  return new Promise((resolve,reject)=>{
    let settled=false,request:IDBOpenDBRequest;
    const stop=(code:ProgramStorageErrorCode)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);reject(new ProgramStorageError(code));};
    const aborted=()=>stop('ABORTED');signal.addEventListener('abort',aborted,{once:true});
    try{request=factory.open(databaseName,1);}catch{stop('UNAVAILABLE');return;}
    request.onblocked=()=>stop('UNAVAILABLE');request.onerror=()=>stop(signal.aborted?'ABORTED':'UNAVAILABLE');
    request.onupgradeneeded=event=>{if(settled||signal.aborted){try{request.transaction?.abort();}catch{/* The open already ended. */}return;}try{if(event.oldVersion!==0)throw Error();request.result.createObjectStore(storeName,{keyPath:'owner'});}catch{try{request.transaction?.abort();}catch{/* The upgrade already ended. */}stop('UNAVAILABLE');}};
    request.onsuccess=()=>{const db=request.result;if(settled||signal.aborted){db.close();stop('ABORTED');return;}if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(storeName)){db.close();stop('UNAVAILABLE');return;}settled=true;signal.removeEventListener('abort',aborted);db.onversionchange=()=>db.close();resolve(db);};
  });
}

/** Requests succeeding is insufficient: only the transaction complete event confirms storage. */
function transaction<T>(db:IDBDatabase,mode:'readonly'|'readwrite',signal:AbortSignal,work:(store:IDBObjectStore,done:(value:T)=>void,refuse:(code:ProgramStorageErrorCode)=>void)=>void):Promise<T>{
  if(signal.aborted)return Promise.reject(new ProgramStorageError('ABORTED'));
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction|undefined,settled=false,value:T,hasValue=false,failure:ProgramStorageErrorCode|null=null;
    const end=(code:ProgramStorageErrorCode|null)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);if(code)reject(new ProgramStorageError(code));else if(!hasValue)reject(new ProgramStorageError('UNAVAILABLE'));else resolve(value);};
    const refuse=(code:ProgramStorageErrorCode)=>{failure=code;try{if(!tx){end(code);return;}tx.abort();}catch{end(code);}};
    const aborted=()=>refuse('ABORTED');
    try{
      tx=mode==='readwrite'?db.transaction(storeName,mode,{durability:'strict'}):db.transaction(storeName,mode);
      tx.oncomplete=()=>end(signal.aborted?'ABORTED':null);tx.onabort=()=>end(failure??(signal.aborted?'ABORTED':'UNAVAILABLE'));tx.onerror=()=>{failure??='UNAVAILABLE';};
      signal.addEventListener('abort',aborted,{once:true});
      const store=tx.objectStore(storeName);if(store.keyPath!=='owner'||store.autoIncrement||store.indexNames.length){refuse('UNAVAILABLE');return;}
      work(store,result=>{value=result;hasValue=true;},refuse);
    }catch{refuse(signal.aborted?'ABORTED':'UNAVAILABLE');}
  });
}
const readStored=(db:IDBDatabase,owner:ProgramStorageOwner,signal:AbortSignal)=>transaction<unknown>(db,'readonly',signal,(store,done)=>{const request=store.get(owner);request.onsuccess=()=>done(request.result);});

export async function readProgramHistory(owner:ProgramStorageOwner,signal:AbortSignal):Promise<ProgramRunLedger|null>{
  check(owner,signal);const db=await open(signal);try{const value=stored(await readStored(db,owner,signal),owner);if(!value)return null;const ledger=await verified(value.ledger);check(owner,signal);return ledger;}finally{db.close();}
}

/** Full verification precedes mutation; a second atomic read fences concurrent changes. */
export async function saveProgramHistory(owner:ProgramStorageOwner,nextRaw:unknown,expectedDigest:string|null,signal:AbortSignal):Promise<void>{
  check(owner,signal);if(expectedDigest!==null&&(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest)))error('INVALID');const next=await verified(nextRaw);check(owner,signal);
  const db=await open(signal);
  try{
    const previousRaw=await readStored(db,owner,signal),previousStored=stored(previousRaw,owner),previous=previousStored?await verified(previousStored.ledger):null;
    check(owner,signal);if((previous?.ledgerDigest??null)!==expectedDigest)error('CONFLICT');if(previous)extension(previous,next);
    const retained:Stored={version:1,owner,ledger:next};
    await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{
      const request=store.get(owner);request.onsuccess=()=>{try{const current=stored(request.result,owner);if(!equal(current,previousStored)){refuse('CONFLICT');return;}const write=store.put(retained);write.onsuccess=()=>done();}catch{refuse('INVALID');}};
    });
  }finally{db.close();}
}

/** Call only for an explicit held-payload purge of this already-known owner. */
export async function removeProgramHistory(owner:ProgramStorageOwner,signal:AbortSignal,expectedDigest:string|null):Promise<void>{
  check(owner,signal);if(expectedDigest!==null&&(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest)))error('INVALID');
  const db=await open(signal);try{await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{
    const request=store.get(owner);request.onsuccess=()=>{try{const current=stored(request.result,owner);if((current?.ledger?.ledgerDigest??null)!==expectedDigest){refuse('CONFLICT');return;}const removed=store.delete(owner);removed.onsuccess=()=>done();}catch{refuse('INVALID');}};
  });}finally{db.close();}
}
