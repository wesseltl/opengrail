import {openSync,closeSync,fstatSync,lstatSync,readSync,readFileSync,writeFileSync,fsyncSync,linkSync,unlinkSync,renameSync,realpathSync,constants} from 'node:fs';
import {resolve,dirname,relative,sep,parse as parsePath} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {assertProgramExecutionFingerprints,programFingerprintFiles} from './program-fingerprint-core.mjs';

// Sponsor-local fixed application code. Caller files are plain bounded JSON;
// binary strategy bytes never select imports, commands or native Wasm execution.
const project=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceKeys=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];
const fileKeys=[...sourceKeys,'uid','gid'];
const directoryKeys=['dev','ino','mode','uid','gid'];
const identical=(a,b,keys)=>keys.every(key=>a[key]===b[key]);
const within=(path,root)=>{const part=relative(root,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!part.startsWith(sep);};
const controller=new AbortController();process.on('SIGINT',()=>controller.abort());process.on('SIGTERM',()=>controller.abort());
let writer,graph;
const inputs=[];

function source(path){
 const file=resolve(project,path);if(!within(file,project)||realpathSync(file)!==file)throw Error('Invalid fixed source.');
 const before=lstatSync(file,{bigint:true});if(!before.isFile()||before.size>2097152n)throw Error('Invalid fixed source.');
 const bytes=readFileSync(file),after=lstatSync(file,{bigint:true});
 if(bytes.length!==Number(after.size)||!identical(before,after,sourceKeys))throw Error('Unstable fixed source.');
 return {path:file,stat:after,digest:digest(bytes)};
}
function assertSources(){
 for(const held of graph){const current=source(held.path);if(current.digest!==held.digest||!identical(current.stat,held.stat,sourceKeys))throw Error('Fixed source graph changed.');}
 assertProgramExecutionFingerprints();
}
async function modules(){
 assertProgramExecutionFingerprints();
 const guards=['scripts/program-search.mjs','scripts/session-file-lock.py','scripts/program-fingerprint-core.mjs','app/program-fingerprints.ts','app/evaluator-fingerprints.ts','app/demo-engine.ts','app/reference-engine.ts','package.json',...Object.values(programFingerprintFiles)];
 const held=guards.map(source);
 const options={absWorkingDir:project,stdin:{contents:"export * from './app/program-search-protocol';export {parseUniqueJson} from './app/unique-json';",resolveDir:project},bundle:true,write:false,metafile:true,platform:'browser',format:'esm',target:'es2022',logLevel:'silent'};
 const discovery=await build(options),paths=Object.keys(discovery.metafile.inputs).filter(path=>path!=='<stdin>').sort();
 if(!paths.includes('app/program-search-protocol.ts'))throw Error('Missing fixed protocol.');
 graph=[...held,...paths.map(source)];assertSources();
 const result=await build(options);
 if(JSON.stringify(Object.keys(result.metafile.inputs).filter(path=>path!=='<stdin>').sort())!==JSON.stringify(paths))throw Error('Fixed source graph changed.');
 assertSources();
 const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 assertSources();return m;
}

/** Parent descriptors and each ancestor identity prevent path redirection. */
function pin(path){
 const descriptors=[];
 try{
  if(process.platform!=='linux'||typeof path!=='string'||path.length>4096||/[\x00-\x1f\x7f]/.test(path)||resolve(path)!==path||within(path,project)||within(path,realpathSync(process.cwd())))throw Error('Invalid private path.');
  const root=parsePath(path).root,parts=path.slice(root.length).split(sep);if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'))throw Error('Invalid private path.');
  const flags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK;
  let directory=openSync(root,flags);descriptors.push(directory);const chain=[{path:root,stat:fstatSync(directory,{bigint:true})}];let traversed=root;
  for(const part of parts.slice(0,-1)){
   directory=openSync(`/proc/self/fd/${directory}/${part}`,flags);descriptors.push(directory);traversed=resolve(traversed,part);
   const stat=fstatSync(directory,{bigint:true});if(!stat.isDirectory()||!identical(stat,lstatSync(traversed,{bigint:true}),directoryKeys))throw Error('Invalid private path.');chain.push({path:traversed,stat});
  }
  let closed=false;
  const assertFresh=()=>{if(closed||chain.some(item=>!identical(item.stat,lstatSync(item.path,{bigint:true}),directoryKeys))||realpathSync(dirname(path))!==dirname(path))throw Error('Private parent changed.');};
  const close=()=>{if(closed)return;closed=true;for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}};
  assertFresh();return {path,directory,target:`/proc/self/fd/${directory}/${parts.at(-1)}`,chain,assertFresh,close};
 }catch(error){for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}throw error;}
}
function privateFile(stat,allowEmpty=false,lock=false){
 const uid=process.getuid?.();return uid!==undefined&&stat.isFile()&&stat.uid===BigInt(uid)&&stat.nlink===1n&&(lock?(stat.mode&0o7777n)===0o600n:[0o400n,0o600n].includes(stat.mode&0o7777n))&&stat.size>=BigInt(allowEmpty?0:1);
}
function read(path,maximum){
 const p=pin(path);let fd,buffer;
 try{
  fd=openSync(p.target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const before=fstatSync(fd,{bigint:true});
  if(!privateFile(before)||before.size>BigInt(maximum)||!identical(before,lstatSync(path,{bigint:true}),fileKeys)||realpathSync(path)!==path)throw Error('Invalid private regular file.');
  buffer=Buffer.alloc(Number(before.size)+1);let size=0;
  for(;;){const count=readSync(fd,buffer,size,buffer.length-size,null);if(!count)break;size+=count;if(size===buffer.length)throw Error('Input changed.');}
  const after=fstatSync(fd,{bigint:true});p.assertFresh();
  if(size!==Number(before.size)||!identical(before,after,fileKeys)||!identical(after,lstatSync(path,{bigint:true}),fileKeys))throw Error('Input changed.');
  const bytes=Buffer.from(buffer.subarray(0,size));return {path,maximum,bytes,stat:after,digest:digest(bytes),chain:p.chain};
 }finally{buffer?.fill(0);if(fd!==undefined)closeSync(fd);p.close();}
}
function unchangedInput(held){
 if(held.chain.some(item=>!identical(item.stat,lstatSync(item.path,{bigint:true}),directoryKeys)))throw Error('Original input parent changed.');
 const current=read(held.path,held.maximum);
 if(current.digest!==held.digest||!identical(current.stat,held.stat,fileKeys))throw Error('Original input changed.');return current;
}
function stableInputs(){for(const input of inputs)unchangedInput(input);}
function parsed(m,held){
 const bytes=held.bytes;if(bytes.length>=3&&bytes[0]===239&&bytes[1]===187&&bytes[2]===191)throw Error('Invalid UTF-8 JSON.');
 return m.parseUniqueJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),held.maximum,m.programSearchLimits.maximumDepth);
}
function input(m,path,maximum){const held=read(path,maximum);inputs.push(held);return parsed(m,held);}
function assertWriter(){
 writer.pin.assertFresh();if(!writer.alive||writer.fd===undefined)throw Error('Exclusive writer unavailable.');
 const held=fstatSync(writer.fd,{bigint:true}),current=lstatSync(writer.lockTarget,{bigint:true});
 if(!privateFile(held,true,true)||!identical(held,current,fileKeys)||!identical(held,writer.stat,fileKeys))throw Error('Exclusive writer changed.');
}
async function acquire(path){
 const p=pin(path);writer={pin:p,alive:false};
 const target=p.target+'.lock';writer.lockTarget=target;
 writer.fd=openSync(target,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);writer.stat=fstatSync(writer.fd,{bigint:true});
 if(!privateFile(writer.stat,true,true)||writer.stat.size>4096n||!identical(writer.stat,lstatSync(target,{bigint:true}),fileKeys))throw Error('Invalid private lock.');
 const child=spawn('python3',[resolve(project,'scripts/session-file-lock.py')],{env:{PATH:process.env.PATH??'/usr/bin:/bin'},stdio:['pipe','pipe','ignore',writer.fd]});writer.child=child;child.stdin.on('error',()=>{});
 const granted=await new Promise(resolve=>{
  let message='',settled=false;const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);resolve(ok);},timer=setTimeout(()=>finish(false),5000);
  child.on('error',()=>finish(false));child.on('exit',()=>{writer.alive=false;finish(false);});child.stdout.on('data',chunk=>{message+=chunk.toString('utf8');if(message.length>32||message.includes('\n'))finish(message==='LOCKED\n');});
 });
 if(!granted||child.exitCode!==null||child.signalCode!==null)throw Error('Exclusive writer unavailable.');writer.alive=true;assertWriter();assertSources();
}
function absent(){assertWriter();try{lstatSync(writer.pin.target);throw Error('Output exists.');}catch(error){if(error?.code!=='ENOENT')throw error;}}
/** File and parent fsync plus exact readback precede admission acknowledgment. */
function atomic(value,expected,maximum){
 assertSources();stableInputs();assertWriter();const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>maximum)throw Error('Complete ledger capacity.');
 const confirm=()=>{assertWriter();if(expected)unchangedInput(expected);else absent();};
 confirm();let temporary,fd,staged;
 try{
  temporary=`/proc/self/fd/${writer.pin.directory}/.opengrail-program-search-${randomUUID()}.tmp`;
  fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);writeFileSync(fd,bytes);fsyncSync(fd);staged=fstatSync(fd,{bigint:true});closeSync(fd);fd=undefined;
  assertSources();stableInputs();confirm();
  if(expected)renameSync(temporary,writer.pin.target);else{linkSync(temporary,writer.pin.target);unlinkSync(temporary);}temporary=undefined;
  fsyncSync(writer.pin.directory);assertWriter();const retained=read(writer.pin.path,maximum);
  if(!retained.bytes.equals(bytes)||retained.stat.dev!==staged.dev||retained.stat.ino!==staged.ino)throw Error('Publication readback differs.');
  assertSources();stableInputs();assertWriter();return retained;
 }finally{if(fd!==undefined)try{closeSync(fd);}catch{}if(temporary)try{unlinkSync(temporary);}catch{}}
}
/** An imported/copied pending file may be readable before durable publication.
 * Resumed execution confirms this exact original inode and parent itself. */
function confirmDurableAdmission(expected){
 assertSources();stableInputs();assertWriter();unchangedInput(expected);let fd;
 try{
  fd=openSync(writer.pin.target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const before=fstatSync(fd,{bigint:true});
  if(!privateFile(before)||!identical(before,expected.stat,fileKeys)||!identical(before,lstatSync(writer.pin.target,{bigint:true}),fileKeys))throw Error('Original pending inode changed.');
  fsyncSync(fd);if(!identical(before,fstatSync(fd,{bigint:true}),fileKeys))throw Error('Original pending inode changed.');
  assertWriter();fsyncSync(writer.pin.directory);unchangedInput(expected);assertSources();stableInputs();assertWriter();
 }finally{if(fd!==undefined)closeSync(fd);}
}
const summary=ledger=>({ledgerId:ledger.id,planDigest:ledger.plan.planDigest,attempts:ledger.attempts.length,sequence:ledger.events.length,ledgerDigest:ledger.ledgerDigest,decision:ledger.selection?.decision??null,selectedCandidateId:ledger.selection?.selectedCandidateId??null,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',unseen:'NOT_ESTABLISHED',ordersEnabled:false,liveEnabled:false,submitted:false});
async function emit(value){const output=JSON.stringify(value)+'\n';if(Buffer.byteLength(output)>4096)throw Error('Diagnostic capacity.');await new Promise((resolve,reject)=>process.stdout.write(output,error=>error?reject(error):resolve()));}
function disposition(attempt){return attempt.status==='EVALUATED'&&attempt.outcome&&attempt.generatorComparison?.status==='MATCH'&&!['FAILED','REJECTED','CANCELLED','INTERRUPTED'].includes(attempt.outcome.status)&&attempt.outcome.comparison?.status==='MATCH'?0:2;}
async function main(){
 const [command,...args]=process.argv.slice(2),single=['train','admit-train','lock','recover','verify'].includes(command)&&args.length===1,pair=['freeze','test','admit-test','execute'].includes(command)&&args.length===2;
 if(!single&&!pair||args.some(value=>!value)){process.stderr.write('Usage: program-search.mjs freeze ADMISSION NEW_LEDGER | train LEDGER | admit-train LEDGER | execute LEDGER ORIGINAL_ATTEMPT_ID | lock LEDGER | test TEST_INPUT LEDGER | admit-test TEST_INPUT LEDGER | recover LEDGER | verify LEDGER\n');return 1;}
 const m=await modules(),cap=m.programSearchLimits.ledgerBytes;
 if(command==='verify'){
  const held=read(args[0],cap),ledger=await m.verifyProgramSearchLedger(parsed(m,held));unchangedInput(held);assertSources();
  await emit({type:'IDENTITY_CHECKED',...summary(ledger),fileDigest:held.digest,executionReconstructed:false,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});return 0;
 }
 const path=['freeze','test','admit-test'].includes(command)?args[1]:args[0];await acquire(path);
 if(command==='freeze'){
  absent();const plan=await m.createProgramSearchPlan(input(m,args[0],m.programSearchLimits.admissionBytes)),ledger=await m.createProgramSearchLedger(plan),retained=atomic(ledger,null,cap);
  await emit({type:'FROZEN',...summary(ledger),fileDigest:retained.digest,evaluated:false,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});return 0;
 }
 let retained=read(path,cap),ledger=await m.verifyProgramSearchLedger(parsed(m,retained));assertSources();stableInputs();unchangedInput(retained);
 if(command==='recover'){
  const pending=m.pendingProgramSearchAttempt(ledger);if(pending){ledger=await m.recoverProgramSearchLedger(ledger,new Date().toISOString());retained=atomic(ledger,retained,cap);}
  unchangedInput(retained);assertSources();await emit({type:'RECOVERED',interruptedAttempts:pending?1:0,...summary(ledger),fileDigest:retained.digest});return 0;
 }
 if(command==='lock'){
  ledger=await m.lockProgramSearchSelection(ledger,new Date().toISOString());retained=atomic(ledger,retained,cap);await emit({type:'SELECTION_LOCKED',...summary(ledger),fileDigest:retained.digest});return 0;
 }
 let attempt;
 if(command==='execute'){
  attempt=m.pendingProgramSearchAttempt(ledger);if(!attempt||attempt.attemptId!==args[1])throw Error('Original pending identity required.');
  confirmDurableAdmission(retained);
  await emit({type:'EXECUTING',attemptId:attempt.attemptId,candidateId:attempt.candidateId,phase:attempt.phase,...summary(ledger),fileDigest:retained.digest});
 }else{
  if(m.pendingProgramSearchAttempt(ledger))throw Error('Original pending identity must be executed or recovered.');
  if(command==='train'||command==='admit-train'){
   const next=ledger.plan.admission.candidates[ledger.attempts.filter(attempt=>attempt.phase==='TRAIN').length];if(!next)throw Error('All TRAIN candidates admitted.');
   ledger=await m.admitProgramSearchTrain(ledger,next.source.id,new Date().toISOString());
  }else ledger=await m.admitProgramSearchTest(ledger,input(m,args[0],m.programSearchLimits.testInputBytes),new Date().toISOString());
  attempt=m.pendingProgramSearchAttempt(ledger);if(!attempt)throw Error('Missing original admission.');retained=atomic(ledger,retained,cap);
  await emit({type:'ADMITTED',attemptId:attempt.attemptId,candidateId:attempt.candidateId,phase:attempt.phase,...summary(ledger),fileDigest:retained.digest,sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED'});
  if(command==='admit-train'||command==='admit-test')return 0;
 }
 // Yield after durable admission so cancellation cannot create a second trial.
 await new Promise(resolve=>setImmediate(resolve));assertSources();stableInputs();assertWriter();unchangedInput(retained);
 const terminal=await m.evaluateProgramSearchAttempt(attempt,{signal:controller.signal});
 assertSources();stableInputs();assertWriter();unchangedInput(retained);
 ledger=await m.finishProgramSearchAttempt(ledger,terminal);retained=atomic(ledger,retained,cap);
 await emit({type:'RETAINED',attemptId:terminal.attemptId,candidateId:terminal.candidateId,phase:terminal.phase,status:terminal.status,outcomeStatus:terminal.outcome?.status??null,artifactStatus:terminal.outcome?.artifact?.status??null,generatorComparisonStatus:terminal.generatorComparison?.status??null,tradingComparisonStatus:terminal.outcome?.comparison?.status??null,...summary(ledger),fileDigest:retained.digest});return disposition(terminal);
}
try{process.exitCode=await main();}
catch{process.stderr.write('Program search command was not confirmed. Preserve the original ledger; verify its exact identity and pending state before reconciliation or explicit recovery.\n');process.exitCode=1;}
finally{if(writer?.child){writer.child.stdin.end();writer.child.kill();}if(writer?.fd!==undefined)try{closeSync(writer.fd);}catch{}writer?.pin.close();}
