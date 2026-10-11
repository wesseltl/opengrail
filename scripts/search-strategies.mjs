import {readFileSync,openSync,closeSync,fstatSync,lstatSync,readSync,constants,mkdtempSync,writeFileSync,rmSync,fsyncSync,renameSync,linkSync,unlinkSync,realpathSync} from 'node:fs';
import {dirname,basename,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

// Sponsor-local, fixed first-party computations. Supplied files are bounded
// JSON data; no provider, runtime data import, publication or account operation.
const root=new URL('../',import.meta.url),project=fileURLToPath(root),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixedSources={primary:'cbc31d441c12a8c3652ddbb1873e9160b574316968889805cdc57aed04597e51',reference:'de2e301a527db0bc7aa79fd65bfba2e6fbe1b63ab5d666c7947459c3d353ddd0'};
const sourceFiles={primary:'app/demo-engine.ts',reference:'app/reference-engine.ts'};
let temporary,lock,lockFd,lockPath,lockIdentity,lockAlive=false;
const abort=new AbortController();
process.on('SIGINT',()=>abort.abort());process.on('SIGTERM',()=>abort.abort());
function privateRegular(stat){
 return stat.isFile()&&stat.nlink===1&&(stat.mode&0o077)===0&&typeof process.getuid==='function'&&stat.uid===process.getuid();
}
function readBounded(path,maximum){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const stat=fstatSync(fd);if(!privateRegular(stat)||stat.size<1||stat.size>maximum)throw Error('Invalid private regular data.');
  const bytes=Buffer.alloc(Math.min(stat.size+1,maximum+1));let length=0;
  for(;;){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;if(length===bytes.length)throw Error('Data changed while reading.');}
  const current=fstatSync(fd);
  if(length!==stat.size||!privateRegular(current)||current.size!==stat.size||current.mtimeMs!==stat.mtimeMs||current.ctimeMs!==stat.ctimeMs)throw Error('Data changed while reading.');
  return bytes.subarray(0,length);
 }finally{closeSync(fd);}
}
function sources(){for(const [name,path]of Object.entries(sourceFiles))if(sha(readFileSync(new URL(path,root)))!==fixedSources[name])throw Error('Fixed source identity changed.');}
async function modules(){
 // Check before importing the bundle, so changed evaluator source never runs.
 sources();
 const result=await build({stdin:{contents:"export * from './app/search-protocol';export {parseUniqueJson} from './app/unique-json';export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',logLevel:'silent'});
 sources();
 temporary=mkdtempSync(join(tmpdir(),'opengrail-search-'));const path=join(temporary,'fixed-search.mjs');writeFileSync(path,result.outputFiles[0].text,{flag:'wx',mode:0o600});
 const m=await import(pathToFileURL(path).href);
 for(const name of Object.keys(fixedSources))if(m.evaluatorSourceFingerprints[name]!==fixedSources[name])throw Error('Fixed fingerprint declaration changed.');
 return m;
}
function assertLock(){
 if(!lockAlive||lockFd===undefined)throw Error('Exclusive writer unavailable.');
 const retained=fstatSync(lockFd),current=lstatSync(lockPath);
 if(!privateRegular(retained)||!privateRegular(current)||current.dev!==lockIdentity.dev||current.ino!==lockIdentity.ino||retained.dev!==current.dev||retained.ino!==current.ino)throw Error('Exclusive writer identity changed.');
}
async function acquire(path){
 lockPath=path;
 lockFd=openSync(path,constants.O_RDWR|constants.O_CREAT|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0),0o600);
 lockIdentity=fstatSync(lockFd);if(!privateRegular(lockIdentity))throw Error('Invalid private lock file.');
 lock=spawn('python3',[fileURLToPath(new URL('scripts/session-file-lock.py',root))],{stdio:['pipe','pipe','ignore',lockFd]});lock.stdin.on('error',()=>{});
 const granted=await new Promise(resolve=>{let message='',settled=false;const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);resolve(ok);},timer=setTimeout(()=>done(false),5000);
  lock.on('error',()=>done(false));lock.on('exit',()=>{lockAlive=false;done(false);});lock.stdout.on('data',chunk=>{message+=chunk.toString('utf8');if(message.length>32||message.includes('\n'))done(message==='LOCKED\n');});
 });
 if(!granted||lock.exitCode!==null||lock.signalCode!==null)throw Error('Exclusive writer unavailable.');lockAlive=true;assertLock();
}
function atomic(path,value,expected,maximum){
 assertLock();const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>maximum)throw Error('Retained ledger capacity.');
 if(expected!==null&&sha(readBounded(path,maximum))!==expected)throw Error('Ledger changed outside this writer.');
 const temp=join(dirname(path),'.opengrail-search-'+randomUUID()+'.tmp');let fd;
 try{
  fd=openSync(temp,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;
  assertLock();
  // Recheck immediately before replacement after flushing the staged bytes.
  if(expected!==null&&sha(readBounded(path,maximum))!==expected)throw Error('Ledger changed outside this writer.');
  if(expected===null){linkSync(temp,path);unlinkSync(temp);}else renameSync(temp,path);
  const directory=openSync(dirname(path),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(directory);}finally{closeSync(directory);}
  return sha(bytes);
 }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch{}}
}
const parse=(m,bytes,maximum)=>m.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,m.searchLimits.maximumDepth);
const readJson=(m,path,maximum)=>parse(m,readBounded(path,maximum),maximum);
const summary=ledger=>({ledgerId:ledger.id,planDigest:ledger.plan.planDigest,attempts:ledger.attempts.length,sequence:ledger.events.length,ledgerDigest:ledger.ledgerDigest,decision:ledger.selection?.decision??null,selectedCandidateId:ledger.selection?.selectedCandidateId??null,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',unseen:'NOT_ESTABLISHED',ordersEnabled:false,submitted:false});
async function emit(value){const output=JSON.stringify(value)+'\n';if(Buffer.byteLength(output)>4096)throw Error('Diagnostic capacity.');await new Promise((resolve,reject)=>process.stdout.write(output,error=>error?reject(error):resolve()));}
function disposition(attempt){return attempt.status==='EVALUATED'&&attempt.comparison?.status==='MATCH'&&attempt.artifact&&!['REJECTED','FAILED'].includes(attempt.artifact.status)?0:2;}
async function main(){
 const [command,...args]=process.argv.slice(2),single=['train','admit-train','lock','recover','verify'].includes(command)&&args.length===1,pair=['freeze','test','admit-test','execute'].includes(command)&&args.length===2;
 if(!single&&!pair||args.some(value=>!value)){
  process.stderr.write('Usage: node scripts/search-strategies.mjs freeze ADMISSION.json NEW_LEDGER.json | train LEDGER.json | admit-train LEDGER.json | execute LEDGER.json ATTEMPT_ID | lock LEDGER.json | test TEST_INPUT.json LEDGER.json | admit-test TEST_INPUT.json LEDGER.json | recover LEDGER.json | verify LEDGER.json\n');return 1;
 }
 const m=await modules(),cap=m.searchLimits.ledgerBytes;
 if(command==='verify'){
  const bytes=readBounded(args[0],cap),ledger=await m.verifySearchLedger(parse(m,bytes,cap));await emit({type:'IDENTITY_CHECKED',...summary(ledger),fileDigest:sha(bytes),executionReconstructed:false,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});return 0;
 }
 const requested=['freeze','test','admit-test'].includes(command)?args[1]:args[0],path=join(realpathSync(dirname(requested)),basename(requested));await acquire(path+'.lock');
 if(command==='freeze'){
  const plan=await m.createSearchPlan(readJson(m,args[0],m.searchLimits.admissionBytes)),ledger=await m.createSearchLedger(plan),fileDigest=atomic(path,ledger,null,cap);
  await emit({type:'FROZEN',...summary(ledger),fileDigest,evaluated:false,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});return 0;
 }
 const bytes=readBounded(path,cap);let fileDigest=sha(bytes),ledger=await m.verifySearchLedger(parse(m,bytes,cap));
 if(command==='recover'){
  const pending=m.pendingSearchAttempt(ledger);if(pending){ledger=await m.recoverSearchLedger(ledger,new Date().toISOString());fileDigest=atomic(path,ledger,fileDigest,cap);}
  await emit({type:'RECOVERED',interruptedAttempts:pending?1:0,...summary(ledger),fileDigest});return 0;
 }
 if(command==='lock'){
  ledger=await m.lockSearchSelection(ledger,new Date().toISOString());fileDigest=atomic(path,ledger,fileDigest,cap);await emit({type:'SELECTION_LOCKED',...summary(ledger),fileDigest});return 0;
 }
 let attempt;
 if(command==='execute'){
  attempt=m.pendingSearchAttempt(ledger);if(!attempt||attempt.attemptId!==args[1])throw Error('Exact original pending attempt required.');
  await emit({type:'EXECUTING',attemptId:attempt.attemptId,candidateId:attempt.candidateId,phase:attempt.phase,...summary(ledger),fileDigest});
 }else{
  if(m.pendingSearchAttempt(ledger))throw Error('Execute or recover the original pending attempt first.');
  if(command==='train'||command==='admit-train'){
   const next=ledger.plan.admission.candidates[ledger.attempts.filter(attempt=>attempt.phase==='TRAIN').length];if(!next)throw Error('All frozen TRAIN candidates already admitted.');
   ledger=await m.admitSearchTrain(ledger,next.source.id,new Date().toISOString());
  }else ledger=await m.admitSearchTest(ledger,readJson(m,args[0],m.searchLimits.testInputBytes),new Date().toISOString());
  attempt=m.pendingSearchAttempt(ledger);if(!attempt)throw Error('Original pending admission required.');
  fileDigest=atomic(path,ledger,fileDigest,cap);
  await emit({type:'ADMITTED',attemptId:attempt.attemptId,candidateId:attempt.candidateId,phase:attempt.phase,...summary(ledger),fileDigest,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});
  if(command==='admit-train'||command==='admit-test')return 0;
 }
 // A signal/crash after this durable admission cannot silently start another
 // computation. execute/recover require the original retained pending identity.
 await new Promise(resolve=>setImmediate(resolve));
 const terminal=await m.evaluateSearchAttempt(attempt,{signal:abort.signal});ledger=await m.finishSearchAttempt(ledger,terminal);fileDigest=atomic(path,ledger,fileDigest,cap);
 await emit({type:'RETAINED',attemptId:terminal.attemptId,candidateId:terminal.candidateId,phase:terminal.phase,status:terminal.status,artifactStatus:terminal.artifact?.status??null,comparisonStatus:terminal.comparison?.status??null,...summary(ledger),fileDigest});return disposition(terminal);
}
try{process.exitCode=await main();}
catch{process.stderr.write('Search command was not confirmed. Preserve the original ledger; verify its identity and pending state before identical reconciliation or explicit recovery.\n');process.exitCode=1;}
finally{if(lock){lock.stdin.end();lock.kill();}if(lockFd!==undefined)closeSync(lockFd);if(temporary)rmSync(temporary,{recursive:true,force:true});}
