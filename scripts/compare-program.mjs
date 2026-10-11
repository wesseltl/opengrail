import {openSync,closeSync,fstatSync,readSync,writeSync,fsyncSync,constants,readFileSync,lstatSync,realpathSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {build} from 'esbuild';
import {assertProgramExecutionFingerprints} from './program-fingerprint-core.mjs';

// Caller paths contain bounded JSON only. The bundle consists of fixed repository
// modules; submitted binary data never becomes native code or a module path.
const project=realpathSync(fileURLToPath(new URL('../',import.meta.url))),exportBytes=25165824;
const rawDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=stat=>[stat.dev,stat.ino,stat.mode,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');
function source(root,path){const file=resolve(root,path),rel=relative(root,file);if(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||realpathSync(file)!==file||!lstatSync(file).isFile())throw Error('Invalid fixed source.');const before=statSync(file),bytes=readFileSync(file),after=statSync(file);if(identity(before)!==identity(after)||bytes.length!==after.size)throw Error('Unstable fixed source.');return {path:file,identity:identity(after),digest:rawDigest(bytes)};}
function unchanged(graph){for(const held of graph){const now=source(dirname(held.path),held.path);if(now.identity!==held.identity||now.digest!==held.digest)throw Error('Fixed source graph changed.');}}
function read(path,maximum){const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum)throw Error('Invalid bounded file.');const inputIdentity=identity(stat),buffer=Buffer.alloc(stat.size+1);let size=0;for(;;){const count=readSync(fd,buffer,size,buffer.length-size,null);if(!count)break;size+=count;if(size>=buffer.length||size>maximum)throw Error('File changed or exceeds its bound.');}if(size!==stat.size||identity(fstatSync(fd))!==inputIdentity)throw Error('Input changed while reading.');const bytes=buffer.subarray(0,size);return {bytes,inputIdentity,inputDigest:rawDigest(bytes)};}finally{closeSync(fd);}}
function save(path,value,maximum){
 const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>maximum)throw Error('Output exceeds its bound.');
 const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600);
 try{let offset=0;while(offset<bytes.length){const written=writeSync(fd,bytes,offset,bytes.length-offset);if(written<=0)throw Error('Publication uncertain.');offset+=written;}fsyncSync(fd);}finally{closeSync(fd);}
 const parent=openSync(dirname(resolve(path)),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(parent);}finally{closeSync(parent);}
 if(read(path,maximum).inputDigest!==rawDigest(bytes))throw Error('Retained output readback differs.');
}
function requireNew(path){try{lstatSync(path);throw Error('Output must be a new file.');}catch(error){if(error?.code!=='ENOENT')throw error;}}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(!['check','verify','recover'].includes(command)||command==='check'&&args.length!==3||command==='verify'&&args.length!==1||command==='recover'&&args.length!==2){process.stderr.write('Usage: compare-program.mjs check OUTCOME NEW_ADMISSION NEW_RESULT | verify RESULT | recover ADMISSION NEW_RESULT\n');return 1;}
 assertProgramExecutionFingerprints();
 const options={stdin:{contents:"export * from './app/program-comparison.ts';export * from './app/program-comparison-model.ts';export {validateProgramRunOutcome} from './app/program-evidence.ts';export {guardProgramData,programRunLimits,programUuid,programClock} from './app/program-run-model.ts';export {strategyDigest} from './app/strategy-model.ts';export {parseUniqueJson} from './app/unique-json.ts';",resolveDir:project},absWorkingDir:project,bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true};
 const discovery=await build(options),paths=Object.keys(discovery.metafile.inputs).filter(path=>path!=='<stdin>').sort(),graph=paths.map(path=>source(project,path));
 const compiled=await build(options);if(JSON.stringify(Object.keys(compiled.metafile.inputs).filter(path=>path!=='<stdin>').sort())!==JSON.stringify(paths))throw Error('Fixed dependency graph changed.');unchanged(graph);
 assertProgramExecutionFingerprints();
 const trusted=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const digest=value=>trusted.strategyDigest(JSON.stringify(value));
 const inputs=[];
 const parse=(path,bound)=>{const held=read(path,bound);inputs.push({path,bound,...held});return trusted.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(held.bytes),bound,24);};
 function stableInputs(){for(const held of inputs){const current=read(held.path,held.bound);if(current.inputIdentity!==held.inputIdentity||current.inputDigest!==held.inputDigest)throw Error('Original input changed.');}}
 async function admission(raw){trusted.guardProgramData(raw,exportBytes);if(!raw||raw.version!==1||raw.kind!=='LOCAL_PROGRAM_COMPARISON_ADMISSION'||Object.keys(raw).join(',')!=='version,kind,id,createdAt,claim,claimDigest,classification,qualification,ordersEnabled,admissionDigest')throw Error('Invalid original admission.');trusted.programUuid.parse(raw.id);trusted.programClock.parse(raw.createdAt);const claim=await trusted.validateProgramRunOutcome(raw.claim),{admissionDigest,...body}=raw;if(raw.claimDigest!==claim.outcomeDigest||raw.classification!=='AUTHOR_REPORTED'||raw.qualification!=='NONE'||raw.ordersEnabled!==false||await digest(body)!==admissionDigest)throw Error('Admission correlation differs.');return {...raw,claim};}
 async function result(raw){trusted.guardProgramData(raw,exportBytes);if(!raw||raw.version!==1||raw.kind!=='LOCAL_PROGRAM_COMPARISON_RESULT'||Object.keys(raw).join(',')!=='version,kind,admission,finishedAt,report,reconstructed,resultDigest')throw Error('Invalid retained result.');const held=await admission(raw.admission),report=await trusted.bindProgramComparisonReport(raw.report,held.claim);trusted.programClock.parse(raw.finishedAt);if(raw.finishedAt<held.createdAt)throw Error('Result clock regressed.');if(raw.reconstructed!==null){const reconstructed=await trusted.validateProgramRunOutcome(raw.reconstructed,held.claim.input);if(reconstructed.attemptId!==held.claim.attemptId||reconstructed.outcomeDigest!==report.reconstructedOutcomeDigest||JSON.stringify(trusted.programOutcomeComparisonSummary(reconstructed))!==JSON.stringify(report.reconstructed))throw Error('Reconstructed result differs.');if(report.comparison&&JSON.stringify(await trusted.compareProgramOutcomeValues(held.claim,reconstructed))!==JSON.stringify(report.comparison))throw Error('Full retained computational difference differs.');}else if(report.reconstructed!==null)throw Error('A fresh outcome cannot be omitted.');const {resultDigest,...body}=raw;if(await digest(body)!==resultDigest)throw Error('Result identity differs.');return raw;}
 if(command==='verify'){await result(parse(args[0],exportBytes));stableInputs();unchanged(graph);assertProgramExecutionFingerprints();process.stdout.write('Complete retained claims and reconstruction correlations verified; execution and operator independence are not established.\n');return 0;}
 if(new Set(args.map(path=>resolve(path))).size!==args.length)throw Error('Input and new output files must be distinct.');for(const output of args.slice(1))requireNew(output);
 let held;
 if(command==='check'){
  const claim=await trusted.validateProgramRunOutcome(parse(args[0],trusted.programRunLimits.outcomeBytes));
  const body={version:1,kind:'LOCAL_PROGRAM_COMPARISON_ADMISSION',id:randomUUID(),createdAt:new Date().toISOString(),claim,claimDigest:claim.outcomeDigest,classification:'AUTHOR_REPORTED',qualification:'NONE',ordersEnabled:false};
  held=await admission({...body,admissionDigest:await digest(body)});
  stableInputs();unchanged(graph);assertProgramExecutionFingerprints();
  // File and parent fsync plus exact readback acknowledge the original retained
  // claim before actual local generator execution. Uncertain outputs are kept.
  save(args[1],held,exportBytes);
  inputs.push({path:args[1],bound:exportBytes,...read(args[1],exportBytes)});stableInputs();unchanged(graph);
 }else held=await admission(parse(args[0],exportBytes));
 const controller=new AbortController();if(command==='recover')controller.abort();
 stableInputs();unchanged(graph);assertProgramExecutionFingerprints();
 const evaluated=await trusted.compareProgramOutcome(held.claim,{signal:controller.signal});
 stableInputs();unchanged(graph);assertProgramExecutionFingerprints();
 const body={version:1,kind:'LOCAL_PROGRAM_COMPARISON_RESULT',admission:held,finishedAt:new Date().toISOString(),report:evaluated.report,reconstructed:evaluated.reconstructed};
 const retained=await result({...body,resultDigest:await digest(body)});
 stableInputs();unchanged(graph);
 save(command==='check'?args[2]:args[1],retained,exportBytes);
 stableInputs();unchanged(graph);assertProgramExecutionFingerprints();
 process.stdout.write(evaluated.report.status+': complete submitted and fresh outcomes retained; same-implementation reconstruction, qualification NONE.\n');
 return evaluated.report.status==='MATCH'?0:2;
}
try{process.exitCode=await main();}catch{process.stderr.write('Program comparison failed. Check bounded exact evidence, current source fingerprints and new output filenames. An existing admission remains recoverable; nothing was overwritten.\n');process.exitCode=1;}
