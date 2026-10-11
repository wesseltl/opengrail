import {readFileSync,openSync,closeSync,fstatSync,readSync,constants,mkdtempSync,writeFileSync,rmSync,fsyncSync,renameSync,linkSync,unlinkSync,realpathSync} from 'node:fs';
import {dirname,basename,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

const root=new URL('../',import.meta.url),project=fileURLToPath(root),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let temporary,lock,lockFd,lockAlive=false,interrupted=false;
process.on('SIGINT',()=>{interrupted=true;process.stdin.destroy();});
process.on('SIGTERM',()=>{interrupted=true;process.stdin.destroy();});

function readBounded(path,cap){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>cap)throw Error('Invalid regular file.');
  const bytes=Buffer.alloc(Math.min(stat.size+1,cap+1));let count=0;
  for(;;){const length=readSync(fd,bytes,count,bytes.length-count,null);if(!length)break;count+=length;if(count===bytes.length)throw Error('Changed input.');}
  return bytes.subarray(0,count);
 }finally{closeSync(fd);}
}
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
async function modules(){
 const result=await build({stdin:{contents:"export * from './app/session-journal';export * from './app/session-model';export {sessionSourceFingerprints} from './app/session-fingerprints';export {parseUniqueJson} from './app/unique-json';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 temporary=mkdtempSync(join(tmpdir(),'opengrail-session-runtime-'));const path=join(temporary,'fixed-runtime.mjs');writeFileSync(path,result.outputFiles[0].text,{flag:'wx',mode:0o600});
 const m=await import(pathToFileURL(path).href);
 for(const [key,path] of Object.entries({engine:'app/session-engine.ts',model:'app/session-model.ts',journal:'app/session-journal.ts'}))if(sha(readFileSync(new URL(path,root)))!==m.sessionSourceFingerprints[key])throw Error('Stale fixed source identity.');
 return m;
}
async function acquire(path){
 lockFd=openSync(path,constants.O_RDWR|constants.O_CREAT|(constants.O_NOFOLLOW??0),0o600);
 if(!fstatSync(lockFd).isFile())throw Error('Invalid lock file.');
 lock=spawn('python3',[fileURLToPath(new URL('scripts/session-file-lock.py',root))],{stdio:['pipe','pipe','ignore',lockFd]});
 lock.stdin.on('error',()=>{});
 const granted=await new Promise((resolve,reject)=>{
  let text='',settled=false;const done=(ok)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(ok);};
  const timer=setTimeout(()=>done(false),5000);
  lock.on('error',()=>done(false));lock.on('exit',()=>{lockAlive=false;done(false);});
  lock.stdout.on('data',chunk=>{text+=chunk.toString('utf8');if(text.length>32||text.includes('\n'))done(text==='LOCKED\n');});
 });
 if(!granted||lock.exitCode!==null||lock.signalCode!==null)throw Error('Session writer unavailable.');lockAlive=true;
}
async function emit(value){const text=JSON.stringify(value)+'\n';if(Buffer.byteLength(text)>4096)throw Error('Diagnostic bound.');await new Promise((resolve,reject)=>process.stdout.write(text,error=>error?reject(error):resolve()));}
function atomic(path,journal,expected){
 if(!lockAlive)throw Error('Lost writer lock.');
 const bytes=Buffer.from(JSON.stringify(journal));
 if(bytes.length>8388608)throw Error('Journal byte capacity.');
 if(expected!==null&&sha(readBounded(path,8388608))!==expected)throw Error('Journal changed outside this writer.');
 const temp=join(dirname(path),'.opengrail-session-'+randomUUID()+'.tmp');let fd;
 try{
  fd=openSync(temp,'wx',0o600);
  writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;
  if(!lockAlive)throw Error('Lost writer lock.');
  if(expected===null){linkSync(temp,path);unlinkSync(temp);}else renameSync(temp,path);
  const directory=openSync(dirname(path),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(directory);}finally{closeSync(directory);}
  return sha(bytes);
 }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch{}}
}
/** Bounded frames; the first overflow terminates intake without retaining raw contents. */
async function* lines(maximum){
 let parts=[],length=0;
 for await(const chunk of process.stdin){
  let start=0;
  while(start<chunk.length){
   const newline=chunk.indexOf(10,start),end=newline<0?chunk.length:newline,part=chunk.subarray(start,end);
   length+=part.length;if(length>maximum)throw Error('Transport frame byte capacity.');parts.push(part);
   if(newline>=0){yield Buffer.concat(parts);parts=[];length=0;start=end+1;}else start=end;
  }
 }
 if(length)yield Buffer.concat(parts);
}
function summary(journal){const state=journal.state;return {sessionId:journal.config.sessionId,sequence:state.sequence,status:state.status,openPositions:state.openPositions.length,pendingEntry:state.pending!==null,exitPending:state.status==='STOPPING',stateDigest:state.stateDigest,journalDigest:journal.journalDigest,ordersEnabled:false};}
async function main(){
 const [command,input,output,...extra]=process.argv.slice(2);
 if(!['start','resume','verify'].includes(command)||!input||extra.length||command==='start'&&!output||command!=='start'&&output){process.stderr.write('Usage: node scripts/session-runtime.mjs start CONFIG.json NEW_JOURNAL.json | resume JOURNAL.json | verify JOURNAL.json\n');return 1;}
 const m=await modules(),maximum=m.sessionJournalLimits.bytes;
 if(command==='verify'){
  const journal=await m.reconstructSessionJournal(m.parseUniqueJson(decode(readBounded(input,maximum)),maximum,24));
  await emit({type:'RECONSTRUCTED',...summary(journal),classification:'AUTHOR_REPORTED',qualification:'NONE',clockMode:journal.config.clockMode});return 0;
 }
 const requested=command==='start'?output:input,path=join(realpathSync(dirname(requested)),basename(requested));
 await acquire(path+'.lock');let journal,fileDigest;
 if(command==='start'){
  const config=m.boundedSessionConfig(m.parseUniqueJson(decode(readBounded(input,m.sessionLimits.configBytes)),m.sessionLimits.configBytes,24)).config;
  if(config.clockMode!=='SYSTEM_RECEIPT')throw Error('Connected intake requires system receipt clock.');
  journal=await m.createSessionJournal(config,new Date().toISOString());fileDigest=atomic(path,journal,null);
 }else{
  const bytes=readBounded(path,maximum);fileDigest=sha(bytes);journal=await m.reconstructSessionJournal(m.parseUniqueJson(decode(bytes),maximum,24));
  if(journal.config.clockMode!=='SYSTEM_RECEIPT')throw Error('Synthetic playback is not a connected session.');
  if(['ACTIVE','PAUSED'].includes(journal.state.status)){
   const requestId=randomUUID(),next=await m.appendSessionEvent(journal,{requestId,type:'PAUSE'},new Date().toISOString());fileDigest=atomic(path,next,fileDigest);journal=next;
   if(journal.state.status!=='PAUSED'||journal.state.events.at(-1)?.requestId!==requestId||journal.state.events.at(-1)?.disposition!=='ACCEPTED')throw Error('Recovery pause was not confirmed.');
  }
 }
 await emit({type:'READY',...summary(journal),clockMode:'SYSTEM_RECEIPT',sourceAuthentication:'UNKNOWN',transport:'STDIN_NDJSON',requiresExplicitResume:command==='resume'&&journal.state.status==='PAUSED'});
 let rejected=0;
 for await(const frame of lines(m.sessionLimits.eventBytes)){
  if(interrupted||!lockAlive)break;
  let event;
  try{if(!frame)throw Error('Bounded line rejected.');event=m.boundedSessionEvent(m.parseUniqueJson(decode(frame),m.sessionLimits.eventBytes,16)).event;}
  catch{await emit({type:'TRANSPORT_REJECTED',confirmed:false,retainedInJournal:false,reason:'INVALID_BOUNDED_EVENT'});if(++rejected>=128)throw Error('Transport rejection capacity.');continue;}
  let next;
  try{next=await m.appendSessionEvent(journal,event,new Date().toISOString());}
  catch{await emit({type:'NOT_CONFIRMED',requestId:event.requestId,confirmed:false,reason:'RECONCILE_OR_RETAINED_CAPACITY'});if(++rejected>=128)throw Error('Transport rejection capacity.');continue;}
  const duplicate=next.state.sequence===journal.state.sequence;
  if(!duplicate)fileDigest=atomic(path,next,fileDigest);
  journal=next;const receipt=journal.state.events.find(value=>value.requestId===event.requestId);
  await emit({type:'RECEIPT',requestId:event.requestId,duplicate,disposition:receipt?.disposition??'UNKNOWN',reason:receipt?.reason??'UNKNOWN',...summary(journal)});
 }
 if(!lockAlive)throw Error('Writer lock was lost.');
 await emit({type:'DISCONNECTED',...summary(journal),sessionLiquidated:false});return interrupted?130:0;
}
try{process.exitCode=await main();}
catch{process.stderr.write('Session transport stopped without a confirmed acknowledgment. Preserve the journal and reconcile before retrying.\n');process.exitCode=1;}
finally{if(lock){lock.stdin.end();lock.kill();}if(lockFd!==undefined)closeSync(lockFd);if(temporary)rmSync(temporary,{recursive:true,force:true});}
