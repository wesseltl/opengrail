import {openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ProducerStore,loadProducerModules,cleanupProducerModules} from './kraken-market-data.mjs';
export {loadProducerModules,cleanupProducerModules} from './kraken-market-data.mjs';
import {receiverNoSecrets} from './session-receiver-protocol.mjs';
import {suppliedSignalLimits,SuppliedSignalError,validateSignalAuthorization,validateSignalContext,parseSuppliedSignal,createSignalState,validateSignalState,previewSignalAdmission,appendSignal,signalStateDigest,observeSignalClock,validateSignalConfirmation} from './supplied-signal-core.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const bytesOf=value=>Buffer.isBuffer(value)?value:typeof value==='string'?Buffer.from(value,'utf8'):value instanceof Uint8Array?Buffer.from(value):null;
export const safeSignalCode=error=>error instanceof SuppliedSignalError&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'UNCONFIRMED_OPERATION';
function assertPrivateStateFile(path){const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o777)!==0o600||process.getuid&&stat.uid!==process.getuid())throw new SuppliedSignalError('INVALID_LOCAL_FILE');}finally{closeSync(fd);}}

/** Existing private atomic store; every supplied-signal read/save uses its smaller bound. */
export class SuppliedSignalStore extends ProducerStore{
 read(){assertPrivateStateFile(this.path);const text=super.read();if(Buffer.byteLength(text,'utf8')>suppliedSignalLimits.stateBytes)throw new SuppliedSignalError('SIGNAL_STATE_BYTE_CAPACITY');return text;}
 check(){assertPrivateStateFile(this.path);super.check();}
 save(state){state.stateDigest=signalStateDigest(state);if(Buffer.byteLength(JSON.stringify(state),'utf8')>suppliedSignalLimits.stateBytes)throw new SuppliedSignalError('SIGNAL_STATE_BYTE_CAPACITY');receiverNoSecrets(state);if(this.digest!==null)assertPrivateStateFile(this.path);super.save(state);}
}
function readBytes(path,maximum){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum)throw new SuppliedSignalError('INVALID_LOCAL_FILE');const bytes=Buffer.alloc(stat.size+1);let count=0;for(;;){const n=readSync(fd,bytes,count,bytes.length-count,null);if(!n)break;count+=n;if(count===bytes.length)throw new SuppliedSignalError('CHANGED_LOCAL_FILE');}if(count!==stat.size)throw new SuppliedSignalError('CHANGED_LOCAL_FILE');return bytes.subarray(0,count);}finally{closeSync(fd);}
}
export async function readSuppliedSignalConfig(path){const m=await loadProducerModules();let config;try{config=m.boundedSessionConfig(m.parseUniqueJson(decode(readBytes(path,32768)),32768,24)).config;}catch{throw new SuppliedSignalError('INVALID_SIGNAL_CONFIG');}receiverNoSecrets(config);return config;}
export function verifySuppliedSignalFingerprints(m){for(const [key,path]of Object.entries({engine:'app/session-engine.ts',model:'app/session-model.ts',journal:'app/session-journal.ts'})){const actual=createHash('sha256').update(readBytes(join(project,path),262144)).digest('hex');if(actual!==m.sessionSourceFingerprints[key])throw new SuppliedSignalError('FIXED_SESSION_SOURCE_MISMATCH');}}
async function jsonResponse(response,m){
 if(!response||!/^(?:application\/json)(?:\s*;.*)?$/i.test(response.headers.get('content-type')??''))throw new SuppliedSignalError('INVALID_RESPONSE_TYPE');
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>suppliedSignalLimits.responseBytes))throw new SuppliedSignalError('RESPONSE_BYTE_CAPACITY');
 const reader=response.body?.getReader();if(!reader)throw new SuppliedSignalError('INVALID_RESPONSE_BODY');let size=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>suppliedSignalLimits.responseBytes)throw new SuppliedSignalError('RESPONSE_BYTE_CAPACITY');parts.push(Buffer.from(value));}return m.parseUniqueJson(decode(Buffer.concat(parts)),suppliedSignalLimits.responseBytes,16);}catch(error){try{await reader.cancel();}catch{}throw error;}finally{reader.releaseLock();}
}

/** Supplied input only. The only transport is the pinned loopback receiver. */
export async function runSuppliedSignal({command,config,authorization,store,signalText,receiverFetch=fetch,now=()=>new Date().toISOString(),interrupted=()=>false,emit=()=>{}}){
 const m=await loadProducerModules();verifySuppliedSignalFingerprints(m);const auth=validateSignalAuthorization(authorization),context=validateSignalContext(config,auth,m);
 if(!['start','submit','resume'].includes(command)||command==='resume'&&signalText!==undefined||command!=='resume'&&signalText===undefined)throw new SuppliedSignalError('INVALID_COMMAND');
 const raw=command==='resume'?null:bytesOf(signalText);if(command!=='resume'&&!raw)throw new SuppliedSignalError('INVALID_SIGNAL_INPUT');
 const prepared=raw===null?null:parseSuppliedSignal(raw,context,m);
 const save=()=>{state.stateDigest=signalStateDigest(state);if(Buffer.byteLength(JSON.stringify(state),'utf8')>suppliedSignalLimits.stateBytes)throw new SuppliedSignalError('SIGNAL_STATE_BYTE_CAPACITY');store.save(state);};
 let state;
 if(command==='start'){state=createSignalState(context,now());const admitted=appendSignal(state,prepared,now());if(admitted.duplicate)throw new SuppliedSignalError('INVALID_SIGNAL_HISTORY');save();}
 else{state=validateSignalState(m.parseUniqueJson(store.read(),suppliedSignalLimits.stateBytes,24),context,m);}
 if(state.status==='FAILED')throw new SuppliedSignalError('TERMINAL_SIGNAL_STATE');
 if(command==='submit'&&(state.status==='UNCERTAIN'||state.entries.some(entry=>entry.status!=='CONFIRMED')))throw new SuppliedSignalError('PENDING_SIGNAL_REQUIRES_RESUME');
 const admission=command==='submit'?previewSignalAdmission(state,prepared):null,originalState=command==='start'?null:structuredClone(state);
 const clock=()=>{try{return observeSignalClock(state,now());}catch(error){if(state.reason==='CLOCK_REGRESSION')save();throw error;}};
 const headers={'Authorization':'Bearer '+auth.producerToken,'X-Session-Id':context.sessionId,'X-Session-Instance':context.sessionInstance};
 function guard(){store.check();clock();if(interrupted())throw new SuppliedSignalError('OPERATOR_INTERRUPTED');}
 async function lookup(entry){guard();const response=await receiverFetch(new URL('/api/receipts/'+entry.event.requestId,auth.receiverOrigin),{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(suppliedSignalLimits.requestMs)});store.check();clock();if(response.status===200)return validateSignalConfirmation(await jsonResponse(response,m),context,entry,m);if(response.status!==404)throw new SuppliedSignalError('RECEIPT_LOOKUP_UNCONFIRMED');const value=await jsonResponse(response,m);if(!value||JSON.stringify(Object.keys(value).sort())!==JSON.stringify(['version','error','confirmed','ordersEnabled'].sort())||value.version!==1||value.error!=='NOT_FOUND'||value.confirmed!==false||value.ordersEnabled!==false)throw new SuppliedSignalError('RECEIPT_LOOKUP_UNCONFIRMED');return null;}
 async function deliver(entry,reconcile){
  if(reconcile){const found=await lookup(entry);if(found)return found;}
  guard();const response=await receiverFetch(new URL('/api/events',auth.receiverOrigin),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(entry.event),redirect:'error',signal:AbortSignal.timeout(suppliedSignalLimits.requestMs)});store.check();clock();if(response.status!==200)throw new SuppliedSignalError('RECEIVER_WRITE_UNCONFIRMED');return validateSignalConfirmation(await jsonResponse(response,m),context,entry,m);
 }
 async function reconcileConfirmed(){
  // A confirmed receipt disappearing is not authority to repeat its event.
  for(const entry of state.entries){if(entry.status!=='CONFIRMED')break;const receipt=await lookup(entry);if(!receipt)throw new SuppliedSignalError('CONFIRMED_RECEIPT_MISSING');if(JSON.stringify(receipt.receipt)!==JSON.stringify(entry.confirmation.receipt))throw new SuppliedSignalError('CONFIRMED_RECEIPT_CHANGED');}
 }
 try{
  if(command==='submit'){
   guard();await reconcileConfirmed();guard();if(admission.duplicate){emit({type:'SIGNAL_DUPLICATE',requestId:admission.entry.event.requestId,ordersEnabled:false,qualification:'NONE'});return originalState;}appendSignal(state,prepared,clock());state.status='ACTIVE';state.reason=null;save();
  }else if(command==='resume'){
   guard();await reconcileConfirmed();guard();if(!state.entries.some(entry=>entry.status==='PENDING')){emit({type:'SIGNAL_READY',retainedSignals:state.entries.length,signalsMaximum:suppliedSignalLimits.signals,sessionLiquidated:false,sourceAuthentication:'UNKNOWN',qualification:'NONE',ordersEnabled:false,liveEnabled:false});return originalState;}for(const entry of state.entries){const attempt=entry.attempts.at(-1);if(attempt?.status==='PENDING'){attempt.status='UNCONFIRMED';attempt.reason='DELIVERY_INTERRUPTED';}}
   state.status='ACTIVE';state.reason=null;save();
  }
  for(const entry of state.entries){
   if(entry.status==='CONFIRMED')continue;guard();if(entry.attempts.length>=suppliedSignalLimits.deliveryAttempts){state.status='FAILED';state.reason='DELIVERY_ATTEMPT_CAPACITY';save();throw new SuppliedSignalError(state.reason);}
   const attempt={startedAt:clock(),status:'PENDING',reason:null};entry.attempts.push(attempt);save();let result;
   try{result=await deliver(entry,command==='resume');store.check();const observed=clock();if(result.receipt.receivedAt>observed)throw new SuppliedSignalError('UNCONFIRMED_RECEIVER_RESPONSE');}catch(error){attempt.status='UNCONFIRMED';attempt.reason=safeSignalCode(error);if(state.status!=='FAILED'){state.status='UNCERTAIN';state.reason=attempt.reason;}save();throw error;}
   attempt.status='CONFIRMED';entry.status='CONFIRMED';entry.confirmation=result;
   if(result.receipt.disposition==='REJECTED'){state.status='FAILED';state.reason='CONFIRMED_REJECTION';save();emit({type:'SIGNAL_REJECTED',requestId:entry.event.requestId,reason:result.receipt.reason,ordersEnabled:false,qualification:'NONE'});throw new SuppliedSignalError('CONFIRMED_REJECTION');}
   save();emit({type:'SIGNAL_RECEIPT',requestId:entry.event.requestId,sequence:result.receipt.sequence,disposition:result.receipt.disposition,reason:result.receipt.reason,ordersEnabled:false,qualification:'NONE'});
  }
  state.status='ACTIVE';state.reason=null;save();emit({type:'SIGNAL_READY',retainedSignals:state.entries.length,signalsMaximum:suppliedSignalLimits.signals,sessionLiquidated:false,sourceAuthentication:'UNKNOWN',qualification:'NONE',ordersEnabled:false,liveEnabled:false});return state;
 }catch(error){const code=safeSignalCode(error);if(state.status==='ACTIVE'&&state.entries.some(entry=>entry.status==='PENDING')){const attempt=state.entries.at(-1)?.attempts.at(-1);if(attempt?.status==='PENDING'){attempt.status='UNCONFIRMED';attempt.reason=code;}state.status='UNCERTAIN';state.reason=code;save();}else if(['CONFIRMED_RECEIPT_MISSING','CONFIRMED_RECEIPT_CHANGED'].includes(code)&&state.status!=='FAILED'){state.status='FAILED';state.reason=code;save();}throw error;}
}

async function stdinAuthorization(m){let size=0;const parts=[];for await(const chunk of process.stdin){size+=chunk.length;if(size>suppliedSignalLimits.authorizationBytes)throw new SuppliedSignalError('AUTHORIZATION_BYTE_CAPACITY');parts.push(chunk);}try{return validateSignalAuthorization(m.parseUniqueJson(decode(Buffer.concat(parts)),suppliedSignalLimits.authorizationBytes,4));}catch(error){if(error instanceof SuppliedSignalError)throw error;throw new SuppliedSignalError('INVALID_OPERATOR_AUTHORIZATION');}}
async function acquireLock(store){
 const fd=openSync(store.path+'.lock',constants.O_RDWR|constants.O_CREAT|(constants.O_NOFOLLOW??0),0o600);let child,alive=false;
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o777)!==0o600||process.getuid&&stat.uid!==process.getuid())throw new SuppliedSignalError('INVALID_WRITER_LOCK');child=spawn('python3',[join(project,'scripts/session-file-lock.py')],{env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['pipe','pipe','ignore',fd]});child.stdin.on('error',()=>{});child.once('exit',()=>{alive=false;});await new Promise((accept,reject)=>{let text='',settled=false;const timer=setTimeout(()=>finish(false),5000);function finish(ok){if(settled)return;settled=true;clearTimeout(timer);if(ok){alive=true;accept();}else reject(new SuppliedSignalError('WRITER_LOCK_UNAVAILABLE'));}child.once('error',()=>finish(false));child.once('exit',()=>finish(false));child.stdout.on('data',chunk=>{text+=chunk.toString('utf8');if(text.length>32||text.includes('\n'))finish(text==='LOCKED\n');});});store.alive=()=>alive;return ()=>{alive=false;child.stdin.end();child.kill();closeSync(fd);};}catch(error){alive=false;if(child){child.stdin.end();child.kill();}closeSync(fd);throw error;}
}
async function main(){
 const [command,configPath,statePath,signalPath,...extra]=process.argv.slice(2);if(!['start','submit','resume'].includes(command)||!configPath||!statePath||extra.length||(command==='resume'?signalPath!==undefined:!signalPath)){process.stderr.write('Usage: node scripts/supplied-signal.mjs start CONFIG.json NEW_STATE.json SIGNAL.json | submit CONFIG.json STATE.json SIGNAL.json | resume CONFIG.json STATE.json; explicit authorization JSON on stdin followed by EOF.\n');return 1;}
 const m=await loadProducerModules();verifySuppliedSignalFingerprints(m);const authorization=await stdinAuthorization(m),config=await readSuppliedSignalConfig(configPath),store=new SuppliedSignalStore(statePath);
 // Context and input validation precede lock/file creation and all delivery.
 const context=validateSignalContext(config,authorization,m),signalText=command==='resume'?undefined:readBytes(signalPath,suppliedSignalLimits.inputBytes);if(signalText!==undefined)parseSuppliedSignal(signalText,context,m);
 const release=await acquireLock(store);let stopped=false;const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{await runSuppliedSignal({command,config,authorization,store,signalText,interrupted:()=>stopped,emit:value=>process.stdout.write(JSON.stringify(value)+'\n')});return 0;}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);release();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch(error){process.stderr.write('Supplied signal producer stopped: '+safeSignalCode(error)+'. Preserve the original state and receiver journal; no liquidation or Live order is implied.\n');process.exitCode=1;}finally{cleanupProducerModules();}}
