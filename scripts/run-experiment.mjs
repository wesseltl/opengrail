import {readFileSync,openSync,closeSync,fstatSync,readSync,constants,mkdtempSync,writeFileSync,rmSync,fsyncSync,renameSync,linkSync,unlinkSync,realpathSync} from 'node:fs';
import {dirname,basename,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

// First-party fixed computations only. Bundle files are data, never executable
// paths; this tool makes no network, account, provider or publication requests.
const root=new URL('../',import.meta.url),project=fileURLToPath(root),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),bundleBytes=393216;
let temporary,lock,lockFd,lockAlive=false;
const abort=new AbortController();
process.on('SIGINT',()=>abort.abort());process.on('SIGTERM',()=>abort.abort());
function readBounded(path,cap,singleLink=false){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>cap||singleLink&&stat.nlink!==1)throw Error('Invalid regular file.');
  const bytes=Buffer.alloc(Math.min(stat.size+1,cap+1));let length=0;
  for(;;){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;if(length===bytes.length)throw Error('Changed input.');}
  return bytes.subarray(0,length);
 }finally{closeSync(fd);}
}
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
async function modules(){
 const result=await build({stdin:{contents:"export * from './app/experiment-runner';export * from './app/experiment-run-ledger';export {parseUniqueJson} from './app/unique-json';export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 temporary=mkdtempSync(join(tmpdir(),'opengrail-experiment-runner-'));const path=join(temporary,'fixed-runner.mjs');writeFileSync(path,result.outputFiles[0].text,{flag:'wx',mode:0o600});
 const m=await import(pathToFileURL(path).href);
 for(const [key,path] of [['primary','app/demo-engine.ts'],['reference','app/reference-engine.ts']])if(sha(readFileSync(new URL(path,root)))!==m.evaluatorSourceFingerprints[key])throw Error('Stale fixed evaluator source identity.');
 return m;
}
async function acquire(path){
 lockFd=openSync(path,constants.O_RDWR|constants.O_CREAT|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0),0o600);
 if(!fstatSync(lockFd).isFile())throw Error('Invalid lock file.');
 lock=spawn('python3',[fileURLToPath(new URL('scripts/session-file-lock.py',root))],{stdio:['pipe','pipe','ignore',lockFd]});lock.stdin.on('error',()=>{});
 const granted=await new Promise(resolve=>{let message='',settled=false;const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);resolve(ok);};const timer=setTimeout(()=>done(false),5000);
  lock.on('error',()=>done(false));lock.on('exit',()=>{lockAlive=false;done(false);});lock.stdout.on('data',chunk=>{message+=chunk.toString('utf8');if(message.length>32||message.includes('\n'))done(message==='LOCKED\n');});
 });
 if(!granted||lock.exitCode!==null||lock.signalCode!==null)throw Error('Local ledger writer unavailable.');lockAlive=true;
}
function atomic(path,value,expected,maximum){
 if(!lockAlive)throw Error('Local ledger lock unavailable.');const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>maximum)throw Error('Local ledger byte capacity.');
 if(expected!==null&&sha(readBounded(path,maximum,true))!==expected)throw Error('Local ledger changed outside this writer.');
 const temp=join(dirname(path),'.opengrail-run-'+randomUUID()+'.tmp');let fd;
 try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;
  if(!lockAlive)throw Error('Local ledger lock unavailable.');
  if(expected===null){linkSync(temp,path);unlinkSync(temp);}else renameSync(temp,path);
  const directory=openSync(dirname(path),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(directory);}finally{closeSync(directory);}return sha(bytes);
 }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch{}}
}
async function emit(value){const text=JSON.stringify(value)+'\n';if(Buffer.byteLength(text)>4096)throw Error('Diagnostic capacity.');await new Promise((resolve,reject)=>process.stdout.write(text,error=>error?reject(error):resolve()));}
const summary=ledger=>({ledgerId:ledger.ledgerId,entries:ledger.entries.length,sequence:ledger.events.length,ledgerDigest:ledger.ledgerDigest,classification:'AUTHOR_REPORTED',qualification:'NONE',ordersEnabled:false});
function parse(m,bytes,maximum){return m.parseUniqueJson(decode(bytes),maximum,24);}
async function main(){
 const [command,first,second,third,fourth,...extra]=process.argv.slice(2);
 const simple=['recover','verify'].includes(command)&&first&&!second;
 const pair=['run','admit','execute'].includes(command)&&first&&second&&!third;
 const prepare=command==='prepare'&&first&&second&&third&&fourth==='--confirm-public-sharing'&&!extra.length;
 if(extra.length||!simple&&!pair&&!prepare){process.stderr.write('Usage: node scripts/run-experiment.mjs run BUNDLE.json LEDGER.json | admit BUNDLE.json LEDGER.json | execute LEDGER.json ATTEMPT_ID | recover LEDGER.json | verify LEDGER.json | prepare LEDGER.json ATTEMPT_ID NEW_COMMAND.json --confirm-public-sharing\n');return 1;}
 const m=await modules(),cap=m.experimentRunLimits.historyBytes;
 if(command==='verify'||prepare){
  const ledger=await m.verifyExperimentRunLedger(parse(m,readBounded(first,cap,true),cap));
  if(command==='verify'){await emit({type:'IDENTITY_CHECKED',...summary(ledger),executionReconstructed:false});return 0;}
  const slot=ledger.entries.find(slot=>slot.kind==='RUN'&&slot.admission.attemptId===second);if(!slot?.outcome)throw Error('Retained terminal result required.');
  const outcome=await m.prepareExperimentRunOutcome(slot.outcome,{confirmPublicSharing:true}),text=JSON.stringify(outcome);
  if(Buffer.byteLength(text)>786432)throw Error('Public command capacity.');
  // New-file, fsynced export. No HTTP request; the explicit flag confirms a
  // draft's full public sharing scope, not source availability or investment.
  const fd=openSync(third,'wx',0o600);try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}
  const directory=openSync(dirname(third),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(directory);}finally{closeSync(directory);}
  await emit({type:'PUBLIC_DRAFT_EXPORTED',attemptId:second,requestId:outcome.requestId,outcomeId:outcome.id,submitted:false,resultKind:outcome.result.kind,ordersEnabled:false});return 0;
 }
 const requested=['run','admit'].includes(command)?second:first,path=join(realpathSync(dirname(requested)),basename(requested));await acquire(path+'.lock');
 let ledger,fileDigest=null;
 try{const bytes=readBounded(path,cap,true);fileDigest=sha(bytes);ledger=await m.verifyExperimentRunLedger(parse(m,bytes,cap));}
 catch(error){if(error?.code!=='ENOENT'||!['run','admit'].includes(command))throw error;ledger=await m.createExperimentRunLedger(randomUUID(),new Date().toISOString());}
 if(command==='recover'){
  const pending=m.pendingExperimentRun(ledger);if(pending){ledger=await m.recoverExperimentRunLedger(ledger,new Date().toISOString());fileDigest=atomic(path,ledger,fileDigest,cap);}
  await emit({type:'RECOVERED',interruptedAttempts:pending?1:0,...summary(ledger)});return 0;
 }
 let run;
 if(['run','admit'].includes(command)){
  if(m.pendingExperimentRun(ledger))throw Error('Recover or execute the existing pending attempt before admitting another.');
  let bytes=null;
  try{bytes=readBounded(first,bundleBytes);const bundle=parse(m,bytes,bundleBytes);
   if(!bundle||Object.keys(bundle).sort().join(',')!=='manifest,source,version'||bundle.version!==1)throw Error('Invalid bundle.');
   run=await m.createExperimentRun({attemptId:randomUUID(),startedAt:new Date().toISOString(),outcomeRequestId:randomUUID(),outcomeId:randomUUID(),manifest:bundle.manifest,source:bundle.source});
  }catch{
   ledger=await m.retainExperimentInputRejection(ledger,randomUUID(),new Date().toISOString(),bytes?sha(bytes):null);fileDigest=atomic(path,ledger,fileDigest,cap);
   await emit({type:'INPUT_REJECTED',admitted:false,reason:'INVALID_BOUNDED_BUNDLE',...summary(ledger)});return 2;
  }
  ledger=await m.admitExperimentRun(ledger,run);fileDigest=atomic(path,ledger,fileDigest,cap);
  await emit({type:'ADMITTED',attemptId:run.attemptId,...summary(ledger),publicationSubmitted:false,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});
  if(command==='admit')return 0;
 }else{
  run=m.pendingExperimentRun(ledger);if(!run||run.attemptId!==second)throw Error('Exact pending attempt required.');
  await emit({type:'EXECUTING',attemptId:run.attemptId,...summary(ledger)});
 }
 // Give a termination signal an opportunity after durable admission. The
 // evaluator itself is bounded synchronous work; interruption is cooperative.
 await new Promise(resolve=>setImmediate(resolve));
 const outcome=await m.evaluateExperimentRun(run,{signal:abort.signal});
 ledger=await m.finishExperimentRun(ledger,outcome);fileDigest=atomic(path,ledger,fileDigest,cap);
 await emit({type:'RETAINED',attemptId:run.attemptId,status:outcome.status,artifactStatus:outcome.artifact?.status??null,comparisonStatus:outcome.comparison?.status??null,...summary(ledger),publicationSubmitted:false});
 return outcome.status==='EVALUATED'&&outcome.comparison?.status==='MATCH'&&!['REJECTED','FAILED'].includes(outcome.artifact?.status)?0:2;
}
try{process.exitCode=await main();}
catch{process.stderr.write('Experiment command was not confirmed. Preserve the ledger; check integrity, bounded inputs, capacity and pending recovery before retrying.\n');process.exitCode=1;}
finally{if(lock){lock.stdin.end();lock.kill();}if(lockFd!==undefined)closeSync(lockFd);if(temporary)rmSync(temporary,{recursive:true,force:true});}
