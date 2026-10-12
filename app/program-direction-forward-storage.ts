import {verifyProgramDirectionForwardHistory,boundedProgramDirectionForwardValue,programDirectionForwardLimits,type ProgramDirectionForwardHistory} from './program-direction-forward-plan';

/** Owner-scoped local evidence, never a production credential or execution grant. */
export type ProgramDirectionForwardStorageOwner='ANONYMOUS'|`human_${string}`;
export type ProgramDirectionForwardStorageErrorCode='UNAVAILABLE'|'CONFLICT'|'ABORTED'|'INVALID';
export class ProgramDirectionForwardStorageError extends Error {
  readonly code:ProgramDirectionForwardStorageErrorCode;
  constructor(code:ProgramDirectionForwardStorageErrorCode){super(code==='CONFLICT'?'Local program forward history changed.':code==='ABORTED'?'Local program forward history operation aborted.':code==='INVALID'?'Local program forward history is invalid.':'Durable local program forward history is unavailable.');this.name='ProgramDirectionForwardStorageError';this.code=code;}
}
const databaseName='opengrail-program-direction-forward-history-v2',storeName='history';
type Stored={version:2;owner:ProgramDirectionForwardStorageOwner;history:ProgramDirectionForwardHistory};
const error=(code:ProgramDirectionForwardStorageErrorCode):never=>{throw new ProgramDirectionForwardStorageError(code);};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function check(owner:ProgramDirectionForwardStorageOwner,signal:AbortSignal){if(typeof owner!=='string'||owner!=='ANONYMOUS'&&!/^human_[a-f0-9]{64}$/.test(owner))error('INVALID');if(!(signal instanceof AbortSignal))error('INVALID');if(signal.aborted)error('ABORTED');}
async function verified(raw:unknown):Promise<ProgramDirectionForwardHistory>{try{return await verifyProgramDirectionForwardHistory(raw);}catch{return error('INVALID');}}
function stored(raw:unknown,owner:ProgramDirectionForwardStorageOwner):Stored|null{
  if(raw===undefined)return null;
  try{boundedProgramDirectionForwardValue(raw,programDirectionForwardLimits.historyBytes+256);const value=raw as Stored;if(!value||Object.keys(value).sort().join(',')!=='history,owner,version'||value.version!==2||value.owner!==owner)error('INVALID');return value;}catch{return error('INVALID');}
}
function extension(previous:ProgramDirectionForwardHistory,next:ProgramDirectionForwardHistory){
  if(!equal(previous.plan,next.plan))error('CONFLICT');
  const prior=previous.journal,value=next.journal;
  if(!prior){if(value&&(value.events.length||value.pending))error('CONFLICT');return;}
  if(!value)throw new ProgramDirectionForwardStorageError('CONFLICT');
  if(!equal(prior.config,value.config)||prior.startedAt!==value.startedAt||value.events.length<prior.events.length||value.events.length>prior.events.length+1||!equal(value.events.slice(0,prior.events.length),prior.events))error('CONFLICT');
  if(!prior.pending){
    if(value.events.length!==prior.events.length||!equal(prior.guest,value.guest)||!equal(prior.trading,value.trading))error('CONFLICT');
  }else if(value.events.length===prior.events.length){if(!equal(prior.pending,value.pending)||!equal(prior.guest,value.guest)||!equal(prior.trading,value.trading))error('CONFLICT');}
  else{const terminal=value.events.at(-1)!;if(value.pending||terminal.sequence!==prior.pending.sequence||!equal(terminal.event,prior.pending.event)||terminal.receivedAt!==prior.pending.receivedAt)error('CONFLICT');}
}

function open(signal:AbortSignal):Promise<IDBDatabase>{
  if(signal.aborted)return Promise.reject(new ProgramDirectionForwardStorageError('ABORTED'));
  const factory=globalThis.indexedDB;if(!factory)return Promise.reject(new ProgramDirectionForwardStorageError('UNAVAILABLE'));
  return new Promise((resolve,reject)=>{
    let settled=false,request:IDBOpenDBRequest;
    const stop=(code:ProgramDirectionForwardStorageErrorCode)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);reject(new ProgramDirectionForwardStorageError(code));};
    const aborted=()=>stop('ABORTED');signal.addEventListener('abort',aborted,{once:true});
    try{request=factory.open(databaseName,1);}catch{stop('UNAVAILABLE');return;}
    request.onblocked=()=>stop('UNAVAILABLE');request.onerror=()=>stop(signal.aborted?'ABORTED':'UNAVAILABLE');
    request.onupgradeneeded=event=>{if(settled||signal.aborted){try{request.transaction?.abort();}catch{/* The open already ended. */}return;}try{if(event.oldVersion!==0)throw Error();request.result.createObjectStore(storeName,{keyPath:'owner'});}catch{try{request.transaction?.abort();}catch{/* The upgrade already ended. */}stop('UNAVAILABLE');}};
    request.onsuccess=()=>{const db=request.result;if(settled||signal.aborted){db.close();stop('ABORTED');return;}if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(storeName)){db.close();stop('UNAVAILABLE');return;}settled=true;signal.removeEventListener('abort',aborted);db.onversionchange=()=>db.close();resolve(db);};
  });
}

/** Requests succeeding is insufficient: only the transaction complete event confirms storage. */
function transaction<T>(db:IDBDatabase,mode:'readonly'|'readwrite',signal:AbortSignal,work:(store:IDBObjectStore,done:(value:T)=>void,refuse:(code:ProgramDirectionForwardStorageErrorCode)=>void)=>void):Promise<T>{
  if(signal.aborted)return Promise.reject(new ProgramDirectionForwardStorageError('ABORTED'));
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction|undefined,settled=false,value:T,hasValue=false,failure:ProgramDirectionForwardStorageErrorCode|null=null;
    const end=(code:ProgramDirectionForwardStorageErrorCode|null)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);if(code)reject(new ProgramDirectionForwardStorageError(code));else if(!hasValue)reject(new ProgramDirectionForwardStorageError('UNAVAILABLE'));else resolve(value);};
    const refuse=(code:ProgramDirectionForwardStorageErrorCode)=>{failure=code;try{if(!tx){end(code);return;}tx.abort();}catch{end(code);}};
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
const readStored=(db:IDBDatabase,owner:ProgramDirectionForwardStorageOwner,signal:AbortSignal)=>transaction<unknown>(db,'readonly',signal,(store,done)=>{const request=store.get(owner);request.onsuccess=()=>done(request.result);});

export async function readProgramDirectionForwardHistory(owner:ProgramDirectionForwardStorageOwner,signal:AbortSignal):Promise<ProgramDirectionForwardHistory|null>{
  check(owner,signal);const db=await open(signal);try{const value=stored(await readStored(db,owner,signal),owner);if(!value)return null;const ledger=await verified(value.history);check(owner,signal);return ledger;}finally{db.close();}
}

/** Full verification precedes mutation; a second atomic read fences concurrent changes. */
export async function saveProgramDirectionForwardHistory(owner:ProgramDirectionForwardStorageOwner,nextRaw:unknown,expectedDigest:string|null,signal:AbortSignal):Promise<void>{
  check(owner,signal);if(expectedDigest!==null&&(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest)))error('INVALID');const next=await verified(nextRaw);check(owner,signal);
  const db=await open(signal);
  try{
    const previousRaw=await readStored(db,owner,signal),previousStored=stored(previousRaw,owner),previous=previousStored?await verified(previousStored.history):null;
    check(owner,signal);if((previous?.historyDigest??null)!==expectedDigest)error('CONFLICT');if(previous)extension(previous,next);
    const retained:Stored={version:2,owner,history:next};
    await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{
      const request=store.get(owner);request.onsuccess=()=>{try{const current=stored(request.result,owner);if(!equal(current,previousStored)){refuse('CONFLICT');return;}const write=store.put(retained);write.onsuccess=()=>done();}catch{refuse('INVALID');}};
    });
  }finally{db.close();}
}

/** Call only for an explicit held-payload purge of this already-known owner. */
export async function removeProgramDirectionForwardHistory(owner:ProgramDirectionForwardStorageOwner,signal:AbortSignal,expectedDigest:string|null):Promise<void>{
  check(owner,signal);if(expectedDigest!==null&&(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest)))error('INVALID');
  const db=await open(signal);try{await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{
    const request=store.get(owner);request.onsuccess=()=>{try{const current=stored(request.result,owner);if((current?.history?.historyDigest??null)!==expectedDigest){refuse('CONFLICT');return;}const removed=store.delete(owner);removed.onsuccess=()=>done();}catch{refuse('INVALID');}};
  });}finally{db.close();}
}
