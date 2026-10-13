import {boundedProgramWindowValue} from './program-window-model';

/** Browser originals only. No credential, execution, publication or migration. */
const settings={PLAN:{database:'opengrail-program-window-plans-v1',maximum:8388608},PUBLICATION:{database:'opengrail-program-window-publications-v1',maximum:8388608}} as const;
export type ProgramWindowLocalStoreKind=keyof typeof settings;
export class ProgramWindowLocalStoreError extends Error{constructor(readonly code:'INVALID'|'UNAVAILABLE'|'CONFLICT'|'ABORTED'){super('Original window storage '+code.toLowerCase()+'.');}}
function fail(code:ProgramWindowLocalStoreError['code']):never{throw new ProgramWindowLocalStoreError(code);}
function check(kind:ProgramWindowLocalStoreKind,owner:string,signal:AbortSignal){if(typeof kind!=='string'||!Object.hasOwn(settings,kind)||typeof owner!=='string'||owner!=='ANONYMOUS'&&!/^human_[a-f0-9]{64}$/.test(owner)||!(signal instanceof AbortSignal))fail('INVALID');if(signal.aborted)fail('ABORTED');}
function snapshot(kind:ProgramWindowLocalStoreKind,raw:unknown){try{const body=boundedProgramWindowValue(raw,settings[kind].maximum,44,1250000);return{body,value:JSON.parse(body) as unknown};}catch{fail('INVALID');}}
function open(kind:ProgramWindowLocalStoreKind,signal:AbortSignal):Promise<IDBDatabase>{
 if(signal.aborted)return Promise.reject(new ProgramWindowLocalStoreError('ABORTED'));if(!globalThis.indexedDB)return Promise.reject(new ProgramWindowLocalStoreError('UNAVAILABLE'));
 return new Promise((resolve,reject)=>{let ended=false,request:IDBOpenDBRequest;const stop=(code:ProgramWindowLocalStoreError['code'])=>{if(ended)return;ended=true;signal.removeEventListener('abort',aborted);reject(new ProgramWindowLocalStoreError(code));},aborted=()=>stop('ABORTED');signal.addEventListener('abort',aborted,{once:true});
  try{request=indexedDB.open(settings[kind].database,1);}catch{stop('UNAVAILABLE');return;}
  request.onerror=()=>stop(signal.aborted?'ABORTED':'UNAVAILABLE');request.onblocked=()=>stop('UNAVAILABLE');request.onupgradeneeded=event=>{try{if(ended||signal.aborted||event.oldVersion!==0)throw Error();request.result.createObjectStore('records',{keyPath:'owner'});}catch{try{request.transaction?.abort();}catch{}stop('UNAVAILABLE');}};
  request.onsuccess=()=>{const db=request.result;if(ended||signal.aborted){db.close();stop('ABORTED');return;}if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains('records')){db.close();stop('UNAVAILABLE');return;}ended=true;signal.removeEventListener('abort',aborted);db.onversionchange=()=>db.close();resolve(db);};
 });
}
function transaction<T>(db:IDBDatabase,mode:'readonly'|'readwrite',signal:AbortSignal,work:(store:IDBObjectStore,done:(value:T)=>void,refuse:(code:ProgramWindowLocalStoreError['code'])=>void)=>void):Promise<T>{
 return new Promise((resolve,reject)=>{let tx:IDBTransaction,ended=false,hasValue=false,value:T,failure:ProgramWindowLocalStoreError['code']|null=null;
  const end=(code:ProgramWindowLocalStoreError['code']|null)=>{if(ended)return;ended=true;signal.removeEventListener('abort',aborted);if(code||!hasValue)reject(new ProgramWindowLocalStoreError(code??'UNAVAILABLE'));else resolve(value);},refuse=(code:ProgramWindowLocalStoreError['code'])=>{failure=code;try{tx.abort();}catch{end(code);}},aborted=()=>refuse('ABORTED');
  try{if(signal.aborted){end('ABORTED');return;}tx=mode==='readwrite'?db.transaction('records',mode,{durability:'strict'}):db.transaction('records',mode);tx.oncomplete=()=>end(signal.aborted?'ABORTED':null);tx.onabort=()=>end(failure??(signal.aborted?'ABORTED':'UNAVAILABLE'));tx.onerror=()=>{failure??='UNAVAILABLE';};signal.addEventListener('abort',aborted,{once:true});const store=tx.objectStore('records');if(store.keyPath!=='owner'||store.autoIncrement||store.indexNames.length){refuse('UNAVAILABLE');return;}work(store,result=>{value=result;hasValue=true;},refuse);}catch{end(signal.aborted?'ABORTED':'UNAVAILABLE');}
 });
}
export async function readProgramWindowLocalValue(kind:ProgramWindowLocalStoreKind,owner:string,signal:AbortSignal):Promise<unknown|null>{
 check(kind,owner,signal);const db=await open(kind,signal);try{const raw=await transaction<unknown>(db,'readonly',signal,(store,done)=>{const request=store.get(owner);request.onsuccess=()=>done(request.result);});check(kind,owner,signal);return raw===undefined?null:snapshot(kind,raw).value;}finally{db.close();}
}
/** The exact stored complete row must match before any mutation; strict
 * transaction completion is observed before returning confirmed storage. */
export async function compareAndSetProgramWindowLocalValue(kind:ProgramWindowLocalStoreKind,owner:string,nextRaw:unknown|null,expectedRaw:unknown|null,signal:AbortSignal):Promise<void>{
 check(kind,owner,signal);const next=nextRaw===null?null:snapshot(kind,nextRaw),expected=snapshot(kind,expectedRaw);
 if(next&&(next.value===null||typeof next.value!=='object'||!('owner'in next.value)||next.value.owner!==owner))fail('INVALID');
 const db=await open(kind,signal);try{check(kind,owner,signal);await transaction<void>(db,'readwrite',signal,(store,done,refuse)=>{const read=store.get(owner);read.onsuccess=()=>{try{if(snapshot(kind,read.result??null).body!==expected.body){refuse('CONFLICT');return;}if(next){const put=store.put(next.value);put.onsuccess=()=>done();}else{const remove=store.delete(owner);remove.onsuccess=()=>done();}}catch{refuse('INVALID');}};});}finally{db.close();}
}
