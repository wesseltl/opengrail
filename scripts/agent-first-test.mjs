/** One fixed synthetic experiment, using the existing local CLIs unchanged. */
import {constants, openSync, closeSync, fstatSync, lstatSync, readSync, writeFileSync, mkdirSync, fsyncSync, realpathSync} from 'node:fs';
import {dirname, join, isAbsolute, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url)),project=resolve(root);
const limits={bundle:393216,ledger:33554432,artifact:8388608,comparison:8388608,diagnostic:16384,summary:16384};
const labels={provenance:'SYNTHETIC',classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false,publicationSubmitted:false};
let directory=null,directoryFd=null,directoryIdentity=null,phase='ARGUMENTS';
const steps=[];
const filenames=['input-bundle.json','ledger.json','artifact.json','comparison.json','summary.json'];
const paths=()=>Object.fromEntries(filenames.map(name=>[name,join(directory,name)]));

function assertDirectory(){
 const current=lstatSync(directory);
 if(!current.isDirectory()||current.isSymbolicLink()||current.dev!==directoryIdentity.dev||current.ino!==directoryIdentity.ino||(current.mode&0o777)!==0o700)throw Error('DESTINATION_CHANGED');
}
function read(path,maximum){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const before=fstatSync(fd);if(!before.isFile()||before.nlink!==1||before.size<1||before.size>maximum)throw Error('FILE_REFUSED');
  const buffer=Buffer.alloc(Math.min(before.size+1,maximum+1));let length=0;
  for(;;){const count=readSync(fd,buffer,length,buffer.length-length,null);if(!count)break;length+=count;if(length===buffer.length)throw Error('FILE_CHANGED');}
  const bytes=buffer.subarray(0,length),after=fstatSync(fd);
  if(bytes.length!==before.size||bytes.length>maximum||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw Error('FILE_CHANGED');
  return bytes;
 }finally{closeSync(fd);}
}
function save(name,value,maximum){
 assertDirectory();const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)+'\n');
 if(bytes.length>maximum)throw Error('OUTPUT_LIMIT');
 const fd=openSync(join(directory,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
 fsyncSync(directoryFd);
}
function run(name,script,args){
 assertDirectory();phase=name;
 const stdoutName=name+'.stdout.log',stderrName=name+'.stderr.log',fds=[];
 try{
  for(const file of [stdoutName,stderrName])fds.push(openSync(join(directory,file),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600));
  // Log full child output to new private files; print only bounded summary metadata.
  const result=spawnSync(process.execPath,[join(project,'scripts',script),...args],{
   cwd:project,shell:false,stdio:['ignore',...fds],timeout:60000,
   env:{PATH:dirname(process.execPath)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C',TZ:'UTC'},
  });
  for(const fd of fds)fsyncSync(fd);
  assertDirectory();
  const step={step:name,exitCode:result.status,signal:result.signal,completed:result.error===undefined&&result.signal===null,stdout:join(directory,stdoutName),stderr:join(directory,stderrName)};
  steps.push(step);fsyncSync(directoryFd);return step;
 }finally{for(const fd of fds)closeSync(fd);}
}
const succeeded=step=>step.completed&&step.exitCode===0;
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
function summary(value){
 const report={version:1,kind:'LOCAL_FIRST_AGENT_TEST_SUMMARY',...labels,...value,steps,files:paths()};
 const bytes=Buffer.from(JSON.stringify(report)+'\n');
 save('summary.json',bytes,limits.summary);process.stdout.write(bytes);return report;
}

function main(){
 const args=process.argv.slice(2),candidate=args[0];
 if(args.length!==1||!isAbsolute(candidate??'')||candidate.length>1024||/[\u0000-\u001f\u007f]/.test(candidate)||resolve(candidate)!==candidate||candidate===project||candidate.startsWith(project+sep)){
  process.stderr.write('Usage: node scripts/agent-first-test.mjs /absolute/NEW/output-directory (outside the checkout)\n');return 1;
 }
 // No output file or subprocess exists before this exclusive directory admission.
 if(realpathSync(dirname(candidate))!==dirname(candidate))throw Error('CANONICAL_PARENT_REQUIRED');
 mkdirSync(candidate,{mode:0o700});directory=candidate;
 directoryFd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);directoryIdentity=fstatSync(directoryFd);assertDirectory();
 phase='INPUT';
 save('input-bundle.json',read(join(project,'examples/runs/synthetic-negative-bundle.json'),limits.bundle),limits.bundle);
 const files=paths(),execution=run('run','run-experiment.mjs',['run',files['input-bundle.json'],files['ledger.json']]);
 // Even a failed run may have a durable admission or adverse terminal evidence.
 phase='LEDGER';const ledgerBytes=read(files['ledger.json'],limits.ledger);
 const identity=run('ledger-verify','run-experiment.mjs',['verify',files['ledger.json']]);
 if(!succeeded(identity)||!read(files['ledger.json'],limits.ledger).equals(ledgerBytes))throw Error('LEDGER_UNCONFIRMED');
 const ledger=parse(ledgerBytes),checked=parse(read(join(directory,'ledger-verify.stdout.log'),limits.diagnostic));
 if(checked.type!=='IDENTITY_CHECKED'||checked.executionReconstructed!==false||checked.ledgerDigest!==ledger.ledgerDigest||ledger.entries.length!==1||ledger.entries[0].kind!=='RUN')throw Error('LEDGER_UNCONFIRMED');
 const outcome=ledger.entries[0].outcome;
 if(!outcome)throw Error('RUN_INCOMPLETE');
 phase='EXPORT';
 if(outcome.artifact)save('artifact.json',outcome.artifact,limits.artifact);
 if(outcome.comparison)save('comparison.json',outcome.comparison,limits.comparison);
 if(!outcome.artifact||!outcome.comparison)throw Error('RESULT_INCOMPLETE');
 const artifactBytes=read(files['artifact.json'],limits.artifact),comparisonBytes=read(files['comparison.json'],limits.comparison);
 const replay=run('replay-verify','replay-demo.mjs',['verify',files['artifact.json']]);
 if(!succeeded(replay)||!read(files['artifact.json'],limits.artifact).equals(artifactBytes)||!read(files['comparison.json'],limits.comparison).equals(comparisonBytes)||!read(files['ledger.json'],limits.ledger).equals(ledgerBytes))throw Error('REPLAY_UNCONFIRMED');
 if(read(join(directory,'replay-verify.stdout.log'),limits.diagnostic).toString('utf8')!=='Exact same-implementation replay matched. This is not independent qualification.\n')throw Error('REPLAY_UNCONFIRMED');
 phase='EXPERIMENT_RESULT';const artifact=outcome.artifact,comparison=outcome.comparison;
 if(!succeeded(execution)||outcome.status!=='EVALUATED'||comparison.status!=='MATCH'||['REJECTED','FAILED'].includes(artifact.status)||!artifact.metrics)throw Error('EXPERIMENT_FAILED');
 phase='SUMMARY';
 summary({status:'VERIFIED',verification:{ledgerIdentity:'CHECKED',ledgerExecutionReconstructed:false,sameImplementationReplay:'MATCH',primaryReferenceComparison:comparison.status},
  strategy:{id:outcome.captured.source.id,digest:outcome.captured.source.digest,name:outcome.captured.source.record.content.name},attemptId:outcome.attemptId,
  artifact:{status:artifact.status,reason:artifact.reason},metrics:artifact.metrics,
  digests:{ledger:ledger.ledgerDigest,artifact:artifact.resultDigest,comparison:comparison.reportDigest,...artifact.digests},implementations:outcome.implementations});
 return 0;
}

try{process.exitCode=main();}
catch{
 // Never echo arbitrary exception text, input, environment or child diagnostics.
 if(directory&&phase!=='SUMMARY')try{summary({status:'FAILED',failedStep:phase,nextStep:'Keep this directory and its complete ledger and logs. Inspect the failed step; use a new directory for another trial.'});}catch{}
 process.stderr.write(directory?'First test was not confirmed. Preserve the output directory and inspect its ledger and step logs.\n':'Output directory was refused. Use one new absolute directory under an existing canonical parent.\n');
 process.exitCode=1;
}finally{if(directoryFd!==null)closeSync(directoryFd);}
