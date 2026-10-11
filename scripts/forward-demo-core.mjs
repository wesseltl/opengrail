import {readFileSync,lstatSync,realpathSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {readPrivateForwardFile} from './forward-demo-files.mjs';

const project=fileURLToPath(new URL('../',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let pending,temporary;
function identity(path){const before=lstatSync(path,{bigint:true});if(!before.isFile()||realpathSync(path)!==path)throw Error('FORWARD_DEMO_SOURCE_UNCONFIRMED');const digest=sha(readFileSync(path)),after=lstatSync(path,{bigint:true});for(const key of ['dev','ino','mode','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('FORWARD_DEMO_SOURCE_UNCONFIRMED');return {digest,stat:after};}
const identical=(a,b)=>a.digest===b.digest&&['dev','ino','mode','size','mtimeNs','ctimeNs'].every(key=>a.stat[key]===b.stat[key]);
/** Fixed first-party bundle only. Inputs cannot select code, imports, commands or endpoints. */
export async function loadForwardDemoModules(){
 if(!pending)pending=(async()=>{
  const fixed=['package.json','package-lock.json','scripts/forward-demo-core.mjs','scripts/forward-demo-files.mjs','scripts/forward-demo.mjs'],guarded=new Map(fixed.map(file=>{const path=resolve(project,file);return [path,identity(path)];}));
  const settings={absWorkingDir:project,stdin:{contents:"export * from './app/forward-demo-model';export {boundedSessionConfig,sessionLimits,sessionVersion} from './app/session-model';export {createSessionJournal,appendSessionEvent,verifySessionJournal,reconstructSessionJournal,sessionJournalLimits} from './app/session-journal';export {sessionSourceFingerprints} from './app/session-fingerprints';export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';export {strategyDigest} from './app/strategy-model';export {parseUniqueJson} from './app/unique-json';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true};
  const discovery=await build(settings),inputs=Object.keys(discovery.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name));
  if(!inputs.includes(resolve(project,'app/forward-demo-model.ts'))||inputs.some(path=>{const part=relative(project,path);return part===''||part==='..'||part.startsWith('..'+sep)||part.startsWith(sep);}))throw Error('FORWARD_DEMO_SOURCE_UNCONFIRMED');
  const sources=new Map([...guarded,...inputs.map(path=>[path,identity(path)])]),output=await build(settings),next=Object.keys(output.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name));
  if(JSON.stringify(inputs)!==JSON.stringify(next))throw Error('FORWARD_DEMO_SOURCE_UNCONFIRMED');
  const assertFresh=async()=>{for(const [path,source] of sources)if(!identical(source,identity(path)))throw Error('FORWARD_DEMO_SOURCE_UNCONFIRMED');};
  await assertFresh();temporary=mkdtempSync(join(tmpdir(),'opengrail-forward-demo-'));const path=join(temporary,'fixed-forward-demo.mjs');writeFileSync(path,output.outputFiles[0].text,{flag:'wx',mode:0o600});
  const model=await import(pathToFileURL(path).href);
  for(const [file,pin] of [['app/session-engine.ts',model.sessionSourceFingerprints.engine],['app/session-model.ts',model.sessionSourceFingerprints.model],['app/session-journal.ts',model.sessionSourceFingerprints.journal],['app/demo-engine.ts',model.evaluatorSourceFingerprints.primary],['app/reference-engine.ts',model.evaluatorSourceFingerprints.reference]])if(sources.get(resolve(project,file))?.digest!==pin)throw Error('FORWARD_DEMO_DECLARED_SOURCE_MISMATCH');
  await assertFresh();return Object.freeze({...model,assertFresh});
 })().catch(error=>{if(temporary)rmSync(temporary,{recursive:true,force:true});temporary=undefined;pending=undefined;throw error;});
 return pending;
}
export async function cleanupForwardDemoModules(){try{await pending;}catch{}if(temporary)rmSync(temporary,{recursive:true,force:true});temporary=undefined;pending=undefined;}
/** Private complete plan snapshot, verified historically; no fresh run admission is implied. */
export async function readForwardDemoPlan(path){const model=await loadForwardDemoModules();await model.assertFresh();const text=readPrivateForwardFile(path,model.forwardDemoLimits.planBytes),digest=sha(Buffer.from(text)),raw=model.parseUniqueJson(text,model.forwardDemoLimits.planBytes,model.forwardDemoLimits.maximumDepth),plan=await model.verifyForwardDemoPlan(raw);await model.assertFresh();if(sha(Buffer.from(readPrivateForwardFile(path,model.forwardDemoLimits.planBytes)))!==digest)throw Error('FORWARD_DEMO_INPUT_CHANGED');return plan;}
