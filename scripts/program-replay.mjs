import {openSync,closeSync,fstatSync,readSync,writeFileSync,constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {build} from 'esbuild';
import {assertProgramExecutionFingerprints} from './program-fingerprint-core.mjs';

// Only fixed repository modules are imported. Caller files remain bounded JSON data.
// Guest binary bytes never reach native WebAssembly or caller-selected module imports.
const project=fileURLToPath(new URL('../',import.meta.url));
try{assertProgramExecutionFingerprints();}catch{process.stderr.write('Declared program/trading source fingerprints are stale. Review source before regenerating; no execution started.\n');process.exit(1);}
const compiled=await build({stdin:{contents:"export * from './app/program-run.ts';export * from './app/program-run-model.ts';export * from './app/program-run-ledger.ts';export {parseUniqueJson} from './app/unique-json.ts';",resolveDir:project},bundle:true,platform:'browser',format:'esm',target:'es2022',write:false});
const trusted=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
function read(path,maximum){const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum)throw Error('Invalid bounded file.');const bytes=Buffer.alloc(stat.size+1);let size=0;for(;;){const count=readSync(fd,bytes,size,bytes.length-size,null);if(!count)break;size+=count;if(size>=bytes.length||size>maximum)throw Error('File size changed.');}return bytes.subarray(0,size);}finally{closeSync(fd);}}
const parse=(bytes,maximum)=>trusted.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,24);
function save(path,value,maximum){const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>maximum)throw Error('Output exceeds its bound.');writeFileSync(path,bytes,{flag:'wx',mode:0o600});}
const now=()=>new Date().toISOString();
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(!['example','run','verify','recover'].includes(command)||command==='example'&&args.length!==1||command==='verify'&&args.length!==1||command==='recover'&&args.length!==2||command==='run'&&(args.length<3||args.length>4)){
  process.stderr.write('Usage: program-replay.mjs example INPUT | run INPUT ADMISSION FINAL [PRIOR_HISTORY] | verify HISTORY | recover HISTORY NEW_HISTORY\n');return 1;
 }
 if(command==='example'){save(args[0],await trusted.syntheticProgramRunInput(),trusted.programRunLimits.inputBytes);process.stdout.write('Reviewed first-party program and invented dataset saved. No market profitability evidence.\n');return 0;}
 if(command==='recover'){const history=await trusted.recoverProgramRunLedger(parse(read(args[0],trusted.programRunLimits.historyBytes),trusted.programRunLimits.historyBytes),now());save(args[1],history,trusted.programRunLimits.historyBytes);process.stdout.write('Original pending attempt retained as INTERRUPTED; completed outcomes unchanged.\n');return 0;}
 if(command==='verify'){
  const history=await trusted.verifyProgramRunLedger(parse(read(args[0],trusted.programRunLimits.historyBytes),trusted.programRunLimits.historyBytes));let reproduced=0,interrupted=0,rejected=0;
  for(const slot of history.entries){if(slot.kind==='INPUT_REJECTION'){rejected++;continue;}if(!slot.outcome)throw Error('Pending original admission requires recovery.');if(['CANCELLED','INTERRUPTED'].includes(slot.outcome.status)){interrupted++;continue;}const replay=await trusted.runProgramReplay(slot.input,slot.attemptId);if(JSON.stringify(replay)!==JSON.stringify(slot.outcome))throw Error('Exact program reproduction differs.');reproduced++;}
  process.stdout.write('Same-implementation reproductions: '+reproduced+'; retained interruptions: '+interrupted+'; input rejections: '+rejected+'. Independent generator qualification remains NONE.\n');return 0;
 }
 const [inputPath,admissionPath,finalPath,priorPath]=args;
 if(new Set([inputPath,admissionPath,finalPath,...(priorPath?[priorPath]:[])]).size!==args.length)throw Error('Input and output files must be distinct.');
 let history=priorPath?await trusted.verifyProgramRunLedger(parse(read(priorPath,trusted.programRunLimits.historyBytes),trusted.programRunLimits.historyBytes)):await trusted.createProgramRunLedger(randomUUID(),now());
 const attemptId=randomUUID();let input=null,inputDigest=null,rejectedInput,disposition={reason:'INPUT_UNAVAILABLE',code:null};
 try{const bytes=read(inputPath,trusted.programRunLimits.inputBytes);inputDigest=createHash('sha256').update(bytes).digest('hex');disposition={reason:'INVALID_JSON',code:null};rejectedInput=parse(bytes,trusted.programRunLimits.inputBytes);disposition=await trusted.programInputRejectionDisposition(rejectedInput);const bounded=trusted.boundedProgramRunInput(rejectedInput);input=await trusted.prepareProgramRunInput(bounded.input.strategy,bounded.input.dataset,bounded.input);}catch{
  const options={...disposition,...(rejectedInput===undefined?{}:{rejectedInput})};history=await trusted.rejectProgramRun(history,attemptId,now(),inputDigest,options);save(admissionPath,history,trusted.programRunLimits.historyBytes);process.stdout.write('REJECTED: bounded safe source snapshot or explicit unavailable disposition retained; no guest execution.\n');return 2;
 }
 history=await trusted.admitProgramRun(history,input,attemptId,now());
 // Durable original admission precedes execution. A crash leaves a recoverable file.
 save(admissionPath,history,trusted.programRunLimits.historyBytes);
 const outcome=await trusted.runProgramReplay(input,attemptId);history=await trusted.finishProgramRun(history,outcome,now());save(finalPath,history,trusted.programRunLimits.historyBytes);
 process.stdout.write('Program attempt retained: '+outcome.status+'; generated signals: '+outcome.signals.length+'. Orders disabled.\n');return ['FAILED','REJECTED'].includes(outcome.status)?2:0;
}
try{process.exitCode=await main();}catch{process.stderr.write('Program command failed. Check bounded JSON, original history and new output filenames. Retained admissions require explicit recovery.\n');process.exitCode=1;}
