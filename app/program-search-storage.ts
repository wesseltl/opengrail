import {verifyProgramSearchLedger,type ProgramSearchLedger,programSearchLimits} from './program-search-protocol';
import {guardProgramData} from './program-run-model';

/** Owner-scoped local evidence, never a production credential or execution grant. */
export type ProgramSearchStorageOwner='ANONYMOUS'|`human_${string}`;
export type ProgramSearchStorageErrorCode='UNAVAILABLE'|'CONFLICT'|'ABORTED'|'INVALID';
export class ProgramSearchStorageError extends Error {
  readonly code:ProgramSearchStorageErrorCode;
  constructor(code:ProgramSearchStorageErrorCode){super(code==='CONFLICT'?'Local program history changed.':code==='ABORTED'?'Local program history operation aborted.':code==='INVALID'?'Local program history is invalid.':'Durable local program history is unavailable.');this.name='ProgramSearchStorageError';this.code=code;}
}
const databaseName='opengrail-program-search-history-v1',storeName='history';
type Stored={version:1;owner:ProgramSearchStorageOwner;ledger:ProgramSearchLedger};
const error=(code:ProgramSearchStorageErrorCode):never=>{throw new ProgramSearchStorageError(code);};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function check(owner:ProgramSearchStorageOwner,signal:AbortSignal){if(typeof owner!=='string'||owner!=='ANONYMOUS'&&!/^human_[a-f0-9]{64}$/.test(owner))error('INVALID');if(!(signal instanceof AbortSignal))error('INVALID');if(signal.aborted)error('ABORTED');}
async function verified(raw:unknown):Promise<ProgramSearchLedger>{try{return await verifyProgramSearchLedger(raw);}catch{return error('INVALID');}}
function stored(raw:unknown,owner:ProgramSearchStorageOwner):Stored|null{
  if(raw===undefined)return null;
  try{guardProgramData(raw,programSearchLimits.ledgerBytes+256,10_000_100);const value=raw as Stored;if(!value||Object.keys(value).sort().join(',')!=='ledger,owner,version'||value.version!==1||value.owner!==owner)error('INVALID');return value;}catch{return error('INVALID');}
}
function extension(previous:ProgramSearchLedger,next:ProgramSearchLedger){
  if(previous.id!==next.id||!equal(previous.plan,next.plan)||next.attempts.length<previous.attempts.length||next.events.length<previous.events.length||!equal(next.events.slice(0,previous.events.length),previous.events)||previous.selection!==null&&!equal(previous.selection,next.selection))error('CONFLICT');
  for(let n=0;n<previous.attempts.length;n++){
    const prior=previous.attempts[n],value=next.attempts[n];
    if(prior.status!=='RUNNING'){if(!equal(prior,value))error('CONFLICT');continue;}
    const admission=(attempt:ProgramSearchLedger['attempts'][number])=>{
      const {attemptDigest,finishedAt,status,reason,outcome,reconstruction,generatorComparison,...identity}=attempt;
      void attemptDigest;void finishedAt;void status;void reason;void outcome;void reconstruction;void generatorComparison;return identity;
    };
    if(!equal(admission(prior),admission(value)))error('CONFLICT');
  }
}

function open(signal:AbortSignal):Promise<IDBDatabase>{
  if(signal.aborted)return Promise.reject(new ProgramSearchStorageError('ABORTED'));
  const factory=globalThis.indexedDB;if(!factory)return Promise.reject(new ProgramSearchStorageError('UNAVAILABLE'));
  return new Promise((resolve,reject)=>{
    let settled=false,request:IDBOpenDBRequest;
    const stop=(code:ProgramSearchStorageErrorCode)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);reject(new ProgramSearchStorageError(code));};
    const aborted=()=>stop('ABORTED');signal.addEventListener('abort',aborted,{once:true});
    try{request=factory.open(databaseName,1);}catch{stop('UNAVAILABLE');return;}
    request.onblocked=()=>stop('UNAVAILABLE');request.onerror=()=>stop(signal.aborted?'ABORTED':'UNAVAILABLE');
    request.onupgradeneeded=event=>{if(settled||signal.aborted){try{request.transaction?.abort();}catch{/* The open already ended. */}return;}try{if(event.oldVersion!==0)throw Error();request.result.createObjectStore(storeName,{keyPath:'owner'});}catch{try{request.transaction?.abort();}catch{/* The upgrade already ended. */}stop('UNAVAILABLE');}};
    request.onsuccess=()=>{const db=request.result;if(settled||signal.aborted){db.close();stop('ABORTED');return;}if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(storeName)){db.close();stop('UNAVAILABLE');return;}settled=true;signal.removeEventListener('abort',aborted);db.onversionchange=()=>db.close();resolve(db);};
  });
}

/** Requests succeeding is insufficient: only the transaction complete event confirms storage. */
function transaction<T>(db:IDBDatabase,mode:'readonly'|'readwrite',signal:AbortSignal,work:(store:IDBObjectStore,done:(value:T)=>void,refuse:(code:ProgramSearchStorageErrorCode)=>void)=>void):Promise<T>{
  if(signal.aborted)return Promise.reject(new ProgramSearchStorageError('ABORTED'));
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction|undefined,settled=false,value:T,hasValue=false,failure:ProgramSearchStorageErrorCode|null=null;
    const end=(code:ProgramSearchStorageErrorCode|null)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);if(code)reject(new ProgramSearchStorageError(code));else if(!hasValue)reject(new ProgramSearchStorageError('UNAVAILABLE'));else resolve(value);};
    const refuse=(code:ProgramSearchStorageErrorCode)=>{failure=code;try{if(!tx){end(code);return;}tx.abort();}catch{end(code);}};
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
const readStored=(db:IDBDatabase,owner:ProgramSearchStorageOwner,signal:AbortSignal)=>transaction<unknown>(db,'readonly',signal,(store,done)=>{const request=store.get(owner);request.onsuccess=()=>done(request.result);});

export async function readProgramSearchHistory(owner:ProgramSearchStorageOwner,signal:AbortSignal):Promise<ProgramSearchLedger|null>{
  check(owner,signal);const db=await open(signal);try{const value=stored(await readStored(db,owner,signal),owner);if(!value)return null;const ledger=await verified(value.ledger);check(owner,signal);return ledger;}finally{db.close();}
}

/** Full verification precedes mutation; a second atomic read fences concurrent changes. */
export async function saveProgramSearchHistory(owner:ProgramSearchStorageOwner,nextRaw:unknown,expectedDigest:string|null,signal:AbortSignal):Promise<void>{
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
export async function removeProgramSearchHistory(owner:ProgramSearchStorageOwner,signal:AbortSignal,expectedDigest:string|null):Promise<void>{
  check(owner,signal);if(expectedDigest!==null&&(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest)))error('INVALID');
  const db=await open(signal);try{await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{
    const request=store.get(owner);request.onsuccess=()=>{try{const current=stored(request.result,owner);if((current?.ledger?.ledgerDigest??null)!==expectedDigest){refuse('CONFLICT');return;}const removed=store.delete(owner);removed.onsuccess=()=>done();}catch{refuse('INVALID');}};
  });}finally{db.close();}
}
