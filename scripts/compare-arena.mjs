import {openSync,closeSync,fstatSync,readSync,writeSync,fsyncSync,constants,readFileSync,lstatSync,realpathSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {assertProgramExecutionFingerprints} from './program-fingerprint-core.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=stat=>[stat.dev,stat.ino,stat.mode,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');
function source(root,path){const file=resolve(root,path),rel=relative(root,file);if(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||realpathSync(file)!==file||!lstatSync(file).isFile())throw Error('Invalid fixed source.');const before=statSync(file),bytes=readFileSync(file),after=statSync(file);if(identity(before)!==identity(after)||bytes.length!==after.size)throw Error('Unstable fixed source.');return {path:file,identity:identity(after),digest:digest(bytes)};}
function unchanged(graph){for(const held of graph){const now=source(dirname(held.path),held.path);if(now.identity!==held.identity||now.digest!==held.digest)throw Error('Changed fixed source.');}}
function readInput(path,maximum){const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum)throw Error('Invalid data file.');const inputIdentity=identity(stat),buffer=Buffer.alloc(Math.min(stat.size+1,maximum+1));let size=0;for(;;){const n=readSync(fd,buffer,size,buffer.length-size,null);if(!n)break;size+=n;if(size===buffer.length||size>maximum)throw Error('Changed or oversized input.');}if(size!==stat.size||identity(fstatSync(fd))!==inputIdentity)throw Error('Changed input.');const bytes=buffer.subarray(0,size);return {bytes,inputIdentity,inputDigest:digest(bytes)};}finally{closeSync(fd);}}
async function main(){
 const [command,input,output,...extra]=process.argv.slice(2);
 if(command!=='compare'||!input||!output||extra.length){process.stderr.write('Usage: node scripts/compare-arena.mjs compare MEMBERS.json NEW_REPORT.json\n');return 1;}
 const root=fileURLToPath(new URL('../',import.meta.url)),physicalRoot=realpathSync(root);
 assertProgramExecutionFingerprints();
 const pins=[source(physicalRoot,'app/demo-engine.ts'),source(physicalRoot,'app/reference-engine.ts')];
 const buildOptions={stdin:{contents:"export {evaluateArena} from './app/arena-evaluator';export {verifyArenaReport,arenaLimits,arenaForwardTransportDepth} from './app/arena-model';export {parseUniqueJson} from './app/unique-json';export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';",resolveDir:physicalRoot},absWorkingDir:physicalRoot,bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022'};
 const discovery=await build(buildOptions),paths=Object.keys(discovery.metafile.inputs).filter(path=>path!=='<stdin>').sort(),graph=paths.map(path=>source(physicalRoot,path));unchanged(pins);
 // Discover without executing, then guard every physical dependency around the
 // actual compilation that will be imported. Submitted data chooses no module.
 const compiled=await build(buildOptions);if(JSON.stringify(Object.keys(compiled.metafile.inputs).filter(path=>path!=='<stdin>').sort())!==JSON.stringify(paths))throw Error('Fixed module graph changed.');unchanged(graph);unchanged(pins);
 const fixed=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 for(const [n,key]of ['primary','reference'].entries())if(pins[n].digest!==fixed.evaluatorSourceFingerprints[key])throw Error('Stale evaluator identity.');
 const {bytes,inputIdentity,inputDigest}=readInput(input,fixed.arenaLimits.admissionBytes),raw=fixed.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),fixed.arenaLimits.admissionBytes,fixed.arenaForwardTransportDepth);
 unchanged(graph);const report=await fixed.verifyArenaReport(await fixed.evaluateArena(raw));unchanged(graph);assertProgramExecutionFingerprints();
 // File paths and source text never become report labels. Supplied review heads
 // and public records are assertions, not current authenticated HTTP responses.
 const wrapper={version:1,kind:'SUPPLIED_SNAPSHOT_ARENA_REPORT',visibility:'SUPPLIED_SNAPSHOTS_NOT_CURRENTLY_VERIFIED',reviewHeads:'SUPPLIED_NOT_AUTHENTICATED_OR_CURRENT',classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false,liveEnabled:false,inputDigest,report};
 const payload=JSON.stringify(wrapper)+'\n';if(Buffer.byteLength(payload)>fixed.arenaLimits.exportBytes)throw Error('Report exceeds its bound.');
 const current=readInput(input,fixed.arenaLimits.admissionBytes);if(current.inputIdentity!==inputIdentity||current.inputDigest!==inputDigest)throw Error('Input changed.');
 unchanged(graph);const out=openSync(output,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600);
 try{const bytes=Buffer.from(payload);let offset=0;while(offset<bytes.length){const written=writeSync(out,bytes,offset,bytes.length-offset);if(written<=0)throw Error('Output publication uncertain.');offset+=written;}fsyncSync(out);}finally{closeSync(out);}
 const parent=openSync(dirname(resolve(output)),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(parent);}finally{closeSync(parent);}
 const retained=readInput(output,fixed.arenaLimits.exportBytes);if(retained.inputDigest!==digest(Buffer.from(payload)))throw Error('Output publication uncertain.');unchanged(graph);const finalInput=readInput(input,fixed.arenaLimits.admissionBytes);if(finalInput.inputIdentity!==inputIdentity||finalInput.inputDigest!==inputDigest)throw Error('Input changed after publication.');
 process.stdout.write(report.status+': complete supplied-snapshot cohort retained; AUTHOR_REPORTED, no current-source or independent assurance.\n');
 return report.ranking.eligible?0:2;
}
try{process.exitCode=await main();}catch{process.stderr.write('Arena comparison was not confirmed. Preserve any possible output; check bounded input, fixed source identities and a new output filename.\n');process.exitCode=1;}
