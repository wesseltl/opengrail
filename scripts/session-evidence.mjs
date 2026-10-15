#!/usr/bin/env node
import {openSync,closeSync,fstatSync,readSync,constants,readFileSync,mkdtempSync,writeFileSync,fsyncSync,linkSync,unlinkSync,rmSync,realpathSync} from 'node:fs';
import {dirname,basename,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {assertSessionLegacyFingerprints} from './session-legacy-fingerprint-core.mjs';

const project=fileURLToPath(new URL('../',import.meta.url)),journalCap=8388608,bundleCap=786432;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let temporary;
const controller=new AbortController();
process.on('SIGINT',()=>controller.abort());
process.on('SIGTERM',()=>controller.abort());
function readBounded(path,cap){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>cap)throw Error('Invalid bounded regular file.');
  const bytes=Buffer.alloc(Math.min(stat.size+1,cap+1));let length=0;
  for(;;){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;if(length===bytes.length)throw Error('Changed or oversized input.');}
  return bytes.subarray(0,length);
 }finally{closeSync(fd);}
}
function writeNew(path,value){
 if(controller.signal.aborted)throw Error('Interrupted.');
 const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>bundleCap+1)throw Error('Output exceeds its bound.');
 const directory=realpathSync(dirname(resolve(path))),target=join(directory,basename(path)),stage=join(directory,'.opengrail-evidence-'+randomUUID()+'.tmp');
 let fd;
 try{
  fd=openSync(stage,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;
  if(controller.signal.aborted)throw Error('Interrupted.');
  linkSync(stage,target);unlinkSync(stage);
  const directoryFd=openSync(directory,constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(directoryFd);}finally{closeSync(directoryFd);}
 }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(stage);}catch{}}
}
async function modules(){
 assertSessionLegacyFingerprints();
 const entry="export * from './app/session-evidence';export * from './app/session-evidence-model';export {sessionSourceFingerprints} from './app/session-fingerprints';export {parseUniqueJson} from './app/unique-json';";
 const settings={stdin:{contents:entry,resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true};
 const discovery=await build(settings);
 const sourceFiles=Object.keys(discovery.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name));
 const sources=new Map([...sourceFiles,join(project,'scripts/session-legacy-fingerprint-core.mjs')].map(path=>[path,sha(readFileSync(path))]));
 const output=await build(settings);
 const checkedInputs=Object.keys(output.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name));
 if(JSON.stringify(checkedInputs)!==JSON.stringify(sourceFiles))throw Error('Local dependency graph changed.');
 temporary=mkdtempSync(join(tmpdir(),'opengrail-session-evidence-'));const modulePath=join(temporary,'fixed-evidence.mjs');writeFileSync(modulePath,output.outputFiles[0].text,{flag:'wx',mode:0o600});
 const m=await import(pathToFileURL(modulePath).href);
 function fresh(){if(controller.signal.aborted)throw Error('Interrupted.');assertSessionLegacyFingerprints();for(const [path,digest] of sources)if(sha(readFileSync(path))!==digest)throw Error('Local source changed.');}
 for(const [key,path]of Object.entries({engine:'app/session-engine.ts',model:'app/session-model.ts',journal:'app/session-journal.ts'}))if(sha(readFileSync(join(project,path)))!==m.sessionSourceFingerprints[key])throw Error('Fixed Session identity does not match.');
 fresh();return {m,fresh};
}
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function main(){
 const [command,input,output,...extra]=process.argv.slice(2);
 if(!['prepare','verify'].includes(command)||!input||extra.length||command==='prepare'&&!output||command==='verify'&&output){process.stderr.write('Usage: node scripts/session-evidence.mjs prepare JOURNAL.json NEW_REVIEW.json | verify ARTIFACT_OR_REVIEW.json\n');return 1;}
 const {m,fresh}=await modules(),bytes=readBounded(input,command==='prepare'?journalCap:bundleCap);
 const raw=m.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),command==='prepare'?journalCap:bundleCap,24);
 if(command==='prepare'){
  let bundle;
  try{bundle=await m.snapshotSessionEvidence(raw,{signal:controller.signal});}
  catch(error){
   fresh();
   const rejected={version:1,kind:'LOCAL_CONTINUOUS_DEMO_PREPARATION_REJECTED',classification:'AUTHOR_REPORTED',qualification:'NONE',journalFileSha256:sha(bytes),reason:error?.status===413?'COMPLETE_INPUT_OR_RESULT_EXCEEDS_PUBLIC_BUDGET':'JOURNAL_RECONSTRUCTION_NOT_CONFIRMED',originalJournalPreserved:true,publicInputPrepared:false,published:false,ordersEnabled:false,liveEnabled:false};
   writeNew(output,rejected);emit({kind:rejected.kind,reason:rejected.reason,originalJournalPreserved:true,published:false});return 2;
  }
  fresh();writeNew(output,bundle);emit({kind:'LOCAL_CONTINUOUS_DEMO_REVIEW_PREPARED',result:bundle.result.kind,journalDigest:bundle.input.journalDigest,published:false,qualification:'NONE',ordersEnabled:false});return 0;
 }
 let artifact;
 if(raw?.kind==='LOCAL_CONTINUOUS_DEMO_REVIEW'){
  const bundle=await m.verifySessionEvidenceBundle(raw);
  if(bundle.result.kind!=='ARTIFACT'){fresh();emit({kind:'CONTINUOUS_DEMO_REVIEW',status:'ARTIFACT_UNAVAILABLE',qualification:'NONE',semanticReconstruction:false,published:false});return 2;}
  artifact=bundle.result.artifact;
 }else artifact=await m.verifySessionEvidenceArtifact(raw);
 const review=await m.reviewSessionEvidence(artifact,{signal:controller.signal});fresh();
 emit({kind:'CONTINUOUS_DEMO_REVIEW',status:review.status,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',sourceAuthentication:'UNKNOWN',published:false,ordersEnabled:false});
 return review.status==='MATCH'?0:2;
}
try{process.exitCode=await main();}
catch{process.stderr.write('Continuous Demo evidence was not confirmed. Preserve the original journal and inspect the bounded local files.\n');process.exitCode=controller.signal.aborted?130:1;}
finally{if(temporary)rmSync(temporary,{recursive:true,force:true});}
