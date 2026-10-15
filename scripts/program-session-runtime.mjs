import {openSync,closeSync,fstatSync,lstatSync,readSync,readFileSync,writeFileSync,fsyncSync,renameSync,linkSync,unlinkSync,realpathSync,constants,mkdtempSync,rmSync} from 'node:fs';
import {dirname,basename,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {receiverNoSecrets} from './session-receiver-protocol.mjs';
import {pinProgramPrivatePath} from './program-session-files.mjs';
import {readPrivateForwardBytes} from './forward-demo-files.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
export const programRuntimeHash=value=>createHash('sha256').update(value).digest('hex');
export class ProgramRuntimeError extends Error {constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new ProgramRuntimeError(code);};
const sameStat=(a,b)=>['dev','ino','mode','uid','gid','nlink'].every(key=>a[key]===b[key]);
// Child directory creation changes a parent's link count without replacing its identity.
const sameDirectory=(a,b)=>['dev','ino','mode','uid','gid'].every(key=>a[key]===b[key]);
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
export function readProgramLocalFile(path,maximum,{privateFile=true,allowEmpty=false}={}){
 if(!Number.isSafeInteger(maximum)||maximum<1||maximum>174063616||typeof privateFile!=='boolean'||typeof allowEmpty!=='boolean')fail('INVALID_LOCAL_FILE_LIMIT');
 if(maximum<=83886080){const bytes=readPrivateForwardBytes(path,maximum,{allowEmpty});if(privateFile&&(lstatSync(path).mode&0o7777)!==0o600)fail('INVALID_LOCAL_FILE');return bytes;}
 const pin=pinProgramPrivatePath(path);let fd;
 try{fd=openSync(pin.target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const before=fstatSync(fd);if(!before.isFile()||before.nlink!==1||before.size>(maximum)||!allowEmpty&&before.size<1||privateFile&&((before.mode&0o7777)!==0o600||before.uid!==process.getuid()))fail('INVALID_LOCAL_FILE');
  const bytes=Buffer.alloc(before.size+1);let size=0;for(;;){const n=readSync(fd,bytes,size,bytes.length-size,null);if(!n)break;size+=n;if(size===bytes.length)fail('CHANGED_LOCAL_FILE');}
  const after=fstatSync(fd);pin.assertFresh();if(!sameStat(before,after)||!sameStat(after,lstatSync(path))||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)fail('CHANGED_LOCAL_FILE');return bytes.subarray(0,size);
 }finally{if(fd!==undefined)closeSync(fd);pin.close();}
}
/** The advisory lock is held by an OS process, never inferred from a stale file. */
export async function acquireProgramFileLock(path){
 let fd,child,pin,alive=false;
 try{pin=pinProgramPrivatePath(path);fd=openSync(pin.target,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o7777)!==0o600||stat.uid!==process.getuid())fail('INVALID_WRITER_LOCK');
  const intact=()=>{try{pin.assertFresh();return sameStat(stat,lstatSync(path));}catch{return false;}};
  child=spawn('python3',[join(project,'scripts/session-file-lock.py')],{env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['pipe','pipe','ignore',fd]});child.stdin.on('error',()=>{});
  await new Promise((resolve,reject)=>{let text='',settled=false;const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);if(ok&&intact()){alive=true;resolve();}else reject(new ProgramRuntimeError('WRITER_LOCK_UNAVAILABLE'));};const timer=setTimeout(()=>done(false),5000);child.once('error',()=>done(false));child.once('exit',()=>{alive=false;done(false);});child.stdout.on('data',bytes=>{text+=bytes.toString('utf8');if(text.length>32||text.includes('\n'))done(text==='LOCKED\n');});});
  return {alive:()=>alive&&intact()&&child.exitCode===null&&child.signalCode===null,close(){alive=false;if(fd===undefined)return;child.stdin.end();child.kill();closeSync(fd);fd=undefined;pin.close();}};
 }catch(error){child?.kill();if(fd!==undefined)closeSync(fd);pin?.close();throw error;}
}
let loading,temporary;
export function programPhysicalSource(path){const before=lstatSync(path,{bigint:true});if(!before.isFile()||before.nlink!==1n||realpathSync(path)!==path||before.size>4194304n)fail('INVALID_FIXED_SOURCE');const digest=programRuntimeHash(readFileSync(path)),after=lstatSync(path,{bigint:true});if(!['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'].every(key=>before[key]===after[key]))fail('CHANGED_FIXED_SOURCE');return {digest,stat:before};}
export function assertProgramPhysicalSource(path,pinned){const current=programPhysicalSource(path);if(current.digest!==pinned.digest||!['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'].every(key=>current.stat[key]===pinned.stat[key]))fail('CHANGED_FIXED_SOURCE');}
export async function loadProgramSessionModules(){
 return loading??=(async()=>{
  const {assertProgramSessionExecutionFingerprints}=await import('./program-session-fingerprint-core.mjs');assertProgramSessionExecutionFingerprints();
  const options={stdin:{contents:"export * from './app/program-session-model';export * from './app/program-session-journal';export {sessionPositionMark} from './app/session-engine';export {parseUniqueJson} from './app/unique-json';",resolveDir:project},bundle:true,write:false,metafile:true,format:'esm',platform:'node',target:'es2022'},probe=await build(options),sources=[...Object.keys(probe.metafile.inputs).filter(path=>path!=='<stdin>').map(path=>resolve(project,path)),...['scripts/program-session-runtime.mjs','scripts/program-session-files.mjs','scripts/forward-demo-files.mjs','scripts/program-session-fingerprint-core.mjs','scripts/session-legacy-fingerprint-core.mjs','scripts/session-receiver-protocol.mjs','scripts/session-file-lock.py','package.json','package-lock.json'].map(path=>join(project,path))],fixed=new Map(sources.map(path=>[path,programPhysicalSource(path)]));
  const assertFresh=()=>{assertProgramSessionExecutionFingerprints();for(const [path,pinned]of fixed)assertProgramPhysicalSource(path,pinned);};assertFresh();const result=await build(options);assertFresh();if(JSON.stringify(Object.keys(probe.metafile.inputs))!==JSON.stringify(Object.keys(result.metafile.inputs)))fail('CHANGED_FIXED_GRAPH');
  temporary=mkdtempSync(join(tmpdir(),'opengrail-program-session-'));const output=join(temporary,'fixed-program-session.mjs');writeFileSync(output,result.outputFiles[0].text,{flag:'wx',mode:0o600});
  const m=await import(pathToFileURL(output).href);assertFresh();return {...m,assertFresh};
 })();
}
export function cleanupProgramSessionModules(){if(temporary){rmSync(temporary,{recursive:true,force:true});temporary=undefined;}loading=undefined;}

/** Atomic local output with file+parent fsync and exact confirmation, under the live lock. */
export class ProgramSessionFileStore {
 constructor(path,maximum,{beforeDirectorySync}={}){const pin=pinProgramPrivatePath(path);pin.close();this.path=path;this.parent=dirname(this.path);this.parentStat=lstatSync(this.parent);this.maximum=maximum;this.digest=null;this.alive=()=>false;this.beforeDirectorySync=beforeDirectorySync;}
 check(){const pin=pinProgramPrivatePath(this.path);try{pin.assertFresh();if(!this.alive()||!sameDirectory(this.parentStat,lstatSync(this.parent)))fail('LOST_WRITER_LOCK');if(this.digest!==null&&programRuntimeHash(readProgramLocalFile(this.path,this.maximum))!==this.digest)fail('EXTERNAL_JOURNAL_CHANGE');}finally{pin.close();}}
 read(){this.check();const bytes=readProgramLocalFile(this.path,this.maximum);this.digest=programRuntimeHash(bytes);return bytes;}
 save(value){this.check();receiverNoSecrets(value);const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>this.maximum)fail('JOURNAL_BYTE_CAPACITY');
  const directory=openSync(this.parent,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),name='.program-session-'+randomUUID()+'.tmp',temp='/proc/self/fd/'+directory+'/'+name,target='/proc/self/fd/'+directory+'/'+basename(this.path);let fd;
  try{if(!sameDirectory(this.parentStat,fstatSync(directory)))fail('LOST_WRITER_LOCK');fd=openSync(temp,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;this.check();if(this.digest===null){linkSync(temp,target);unlinkSync(temp);}else renameSync(temp,target);this.beforeDirectorySync?.();fsyncSync(directory);
   if(!this.alive()||realpathSync(this.parent)!==this.parent||!sameDirectory(this.parentStat,lstatSync(this.parent)))fail('LOST_WRITER_LOCK');const readback=readProgramLocalFile(this.path,this.maximum);if(!readback.equals(bytes))fail('JOURNAL_PUBLICATION_UNCERTAIN');this.digest=programRuntimeHash(bytes);return this.digest;
  }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch{}closeSync(directory);}
 }
}
export function programRuntimeSummary(journal){const s=journal.trading.state;return {sessionId:journal.config.sessionId,outerSequence:journal.events.length,innerSequence:s.sequence,status:s.status,guestStatus:journal.guest.status,totalFuel:journal.guest.totalFuel,openPositions:s.openPositions.length,pendingEntry:s.pending!==null,pendingInput:journal.pending!==null,journalDigest:journal.journalDigest,tradingDigest:journal.trading.journalDigest,ordersEnabled:false,liveEnabled:false};}
/** Test observers are local API injection only. No CLI switch can bypass durability. */
export async function createProgramSessionWriter({command,config,path,m,clock=()=>new Date().toISOString(),onDurablePending,store:providedStore}){
 m??=await loadProgramSessionModules();m.assertFresh?.();const store=providedStore??new ProgramSessionFileStore(path,m.programSessionLimits.journalBytes);const lock=await acquireProgramFileLock(store.path+'.lock');store.alive=lock.alive;let confirmed,stopped=false,busy=false;
 try{
  if(command==='start'){const c=m.boundedProgramSessionConfig(config).config;receiverNoSecrets(c);if(c.clockMode!=='SYSTEM_RECEIPT')fail('CONNECTED_CLOCK_REQUIRED');confirmed=await m.createProgramSessionJournal(c,clock());store.save(confirmed);}
  else if(command==='resume'){const text=decode(store.read()),raw=m.parseUniqueJson(text,m.programSessionLimits.journalBytes,40);receiverNoSecrets(raw);confirmed=await m.recoverProgramSessionJournal(raw,clock());if(confirmed.config.clockMode!=='SYSTEM_RECEIPT')fail('CONNECTED_CLOCK_REQUIRED');if(JSON.stringify(confirmed)!==text)store.save(confirmed);
   if(confirmed.trading.state.status==='ACTIVE'){const admitted=await m.admitProgramSessionEvent(confirmed,{requestId:randomUUID(),type:'PAUSE'},clock());store.save(admitted);const paused=await m.executeProgramSessionPending(admitted,{clock});store.save(paused);confirmed=paused;}
  }
  else fail('INVALID_COMMAND');
 }catch(error){lock.close();if(confirmed)m.discardProgramSessionRuntime(confirmed);throw error;}
 const healthy=()=>{if(stopped)fail('WRITER_STOPPED');m.assertFresh?.();store.check();};
 return {m,store,get stopped(){return stopped;},get journal(){return confirmed;},
  async current(){healthy();const text=decode(store.read()),value=await m.verifyProgramSessionJournal(m.parseUniqueJson(text,m.programSessionLimits.journalBytes,40));healthy();if(JSON.stringify(value)!==text||value.journalDigest!==confirmed.journalDigest)fail('UNCONFIRMED_JOURNAL');return value;},
  async submit(raw){if(busy)fail('CONCURRENT_WRITER_OPERATION');busy=true;let admitted,next;
   try{healthy();const event=m.boundedProgramSessionEvent(raw).event;receiverNoSecrets(event);const prior=confirmed.events.find(value=>value.event.requestId===event.requestId);if(prior){if(JSON.stringify(prior.event)!==JSON.stringify(event))fail('CONFLICT');return {journal:confirmed,duplicate:true,entry:prior};}
    admitted=await m.admitProgramSessionEvent(confirmed,event,clock());healthy();store.save(admitted);confirmed=admitted;await onDurablePending?.(admitted);healthy();next=await m.executeProgramSessionPending(admitted,{clock});healthy();store.save(next);confirmed=next;m.assertFresh?.();return {journal:confirmed,duplicate:false,entry:confirmed.events.at(-1)};
   }catch(error){if(admitted){stopped=true;m.discardProgramSessionRuntime(admitted);if(next)m.discardProgramSessionRuntime(next);}throw error;}finally{busy=false;}
  },close(){if(stopped&&!lock.alive())return;stopped=true;if(confirmed)m.discardProgramSessionRuntime(confirmed);lock.close();}
 };
}
async function* frames(maximum){let chunks=[],size=0;for await(const chunk of process.stdin){let start=0;while(start<chunk.length){const end=chunk.indexOf(10,start),finish=end<0?chunk.length:end,part=chunk.subarray(start,finish);size+=part.length;if(size>maximum)fail('TRANSPORT_BYTE_CAPACITY');chunks.push(part);if(end<0)break;yield Buffer.concat(chunks);chunks=[];size=0;start=end+1;}}if(size)yield Buffer.concat(chunks);}
async function cli(){const [command,input,output,...rest]=process.argv.slice(2);if(rest.length||!input||!['start','resume','verify'].includes(command)||command==='start'&&!output||command!=='start'&&output)fail('INVALID_USAGE');const m=await loadProgramSessionModules(),emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
 if(command==='verify'){const value=await m.reconstructProgramSessionJournal(m.parseUniqueJson(decode(readProgramLocalFile(input,m.programSessionLimits.journalBytes)),m.programSessionLimits.journalBytes,40));emit({type:'RECONSTRUCTED',...programRuntimeSummary(value),classification:'AUTHOR_REPORTED',qualification:'NONE'});return;}
 const config=command==='start'?m.parseUniqueJson(decode(readProgramLocalFile(input,m.programSessionLimits.configBytes)),m.programSessionLimits.configBytes,32):undefined;let writer,interrupted=false;const stop=()=>{interrupted=true;process.stdin.destroy();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{writer=await createProgramSessionWriter({command,config,path:command==='start'?output:input,m});emit({type:'READY',...programRuntimeSummary(writer.journal),clockMode:'SYSTEM_RECEIPT',requiresExplicitResume:command==='resume',transport:'STDIN_NDJSON'});let rejected=0;
  for await(const bytes of frames(m.programSessionLimits.eventBytes)){if(interrupted)break;let event;try{event=m.boundedProgramSessionEvent(m.parseUniqueJson(decode(bytes),m.programSessionLimits.eventBytes,16)).event;}catch{emit({type:'TRANSPORT_REJECTED',confirmed:false,retainedInJournal:false,reason:'INVALID_BOUNDED_EVENT'});if(++rejected>=128)fail('REJECTION_CAPACITY');continue;}
   try{const result=await writer.submit(event);emit({type:'RECEIPT',requestId:event.requestId,duplicate:result.duplicate,reason:result.entry.reason,...programRuntimeSummary(result.journal)});}catch(error){if(writer.stopped||![400,409,413,429].includes(error?.status)&&error?.code!=='CONFLICT')throw error;emit({type:'NOT_CONFIRMED',requestId:event.requestId,confirmed:false,reason:error?.status===429?'CAPACITY_LIMIT':'REQUEST_REJECTED'});if(++rejected>=128)fail('REJECTION_CAPACITY');}
  }emit({type:'DISCONNECTED',...programRuntimeSummary(writer.journal),sessionLiquidated:false});if(interrupted)process.exitCode=130;
 }finally{writer?.close();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{await cli();}catch{process.stderr.write('Program Demo transport stopped without a confirmed acknowledgment. Preserve the original journal and reconcile before retrying.\n');process.exitCode=1;}finally{cleanupProgramSessionModules();}}
