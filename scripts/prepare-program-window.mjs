import {openSync,closeSync,fstatSync,lstatSync,readSync,constants,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {pinProgramPrivatePath} from './program-session-files.mjs';
import {preparePrivateForwardOutput} from './forward-demo-files.mjs';
import {createWindowPhysicalGuard,windowPhysicalSource,assertWindowPhysicalSource} from './program-window-fingerprint-core.mjs';

/** File-only preparation. No guest, receiver, provider, model or public API runs. */
export const prepareProgramWindowLimits=Object.freeze({wholeBytes:8388608,setupBytes:8192,depth:44,leadMs:60000,diagnosticBytes:4096});
const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const statKeys=['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'];
const sameStat=(a,b)=>statKeys.every(key=>a[key]===b[key]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ensure=(value,code)=>{if(!value)throw Error(code);};
const reasonCodes=new Set(['PREPARATION_USAGE','DISTINCT_EXACT_PATHS_REQUIRED','PRIVATE_PARENT_REQUIRED','PRIVATE_WHOLE_INPUT_REQUIRED','INVALID_PRIVATE_PATH','PRIVATE_FORWARD_FILE_UNAVAILABLE','PRIVATE_FORWARD_OUTPUT_UNCERTAIN','ORIGINAL_INPUT_CHANGED','FIXED_PREPARATION_GRAPH_REQUIRED','PREPARATION_GRAPH_CHANGED','STRICT_UTF8_JSON_REQUIRED','STRICT_UNIQUE_JSON_REQUIRED','EXPLICIT_SETUP_FIELDS_REQUIRED','TERMINAL_DIRECTION_V2_SELECTION_REQUIRED','SOLE_TERMINAL_TEST_REQUIRED','COMPLETE_DIRECTION_V2_LEDGER_REQUIRED','COMPLETE_INPUT_EXCEEDS_8_MIB','PROSPECTIVE_DIRECTION_V2_INPUT_REQUIRED','PROSPECTIVE_LEAD_EXPIRED','PROSPECTIVE_CLOCK_OR_LEAD_INVALID_AFTER_PUBLICATION','PREPARATION_OUTPUT_UNCONFIRMED','DIAGNOSTIC_CAPACITY']);
const refusalCode=error=>reasonCodes.has(error?.message)?error.message:error?.status===413?'COMPLETE_INPUT_CAPACITY_REFUSED':'UNCONFIRMED';
function privateParent(pin){const parent=fstatSync(pin.directory,{bigint:true});ensure(parent.isDirectory()&&parent.uid===BigInt(process.getuid())&&(parent.mode&0o7777n)===0o700n,'PRIVATE_PARENT_REQUIRED');pin.assertFresh();}

function holdInput(path,maximum){
 const pin=pinProgramPrivatePath(path);let fd;
 try{
  privateParent(pin);
  fd=openSync(pin.target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const held=fstatSync(fd,{bigint:true});
  ensure(held.isFile()&&held.uid===BigInt(process.getuid())&&held.nlink===1n&&(held.mode&0o7777n)===0o600n&&held.size>0n&&held.size<=BigInt(maximum),'PRIVATE_WHOLE_INPUT_REQUIRED');
  const read=()=>{
   privateParent(pin);ensure(sameStat(held,fstatSync(fd,{bigint:true}))&&sameStat(held,lstatSync(path,{bigint:true}))&&realpathSync(path)===path,'ORIGINAL_INPUT_CHANGED');
   const bytes=Buffer.alloc(Number(held.size)+1);let size=0;
   for(;;){const count=readSync(fd,bytes,size,bytes.length-size,size);if(!count)break;size+=count;ensure(size<bytes.length,'ORIGINAL_INPUT_CHANGED');}
   pin.assertFresh();ensure(size===Number(held.size)&&sameStat(held,fstatSync(fd,{bigint:true}))&&sameStat(held,lstatSync(path,{bigint:true})),'ORIGINAL_INPUT_CHANGED');
   return Buffer.from(bytes.subarray(0,size));
  };
  const bytes=read(),digest=sha(bytes);
  return {bytes,digest,assertFresh(){ensure(sha(read())===digest,'ORIGINAL_INPUT_CHANGED');},close(){if(fd!==undefined){closeSync(fd);fd=undefined;}pin.close();}};
 }catch(error){if(fd!==undefined)closeSync(fd);pin.close();throw error;}
}

/** The second compilation uses a held, complete fixed import graph. */
export async function loadPrepareProgramWindowModules(){
 const direct=['scripts/prepare-program-window.mjs','scripts/program-session-files.mjs','scripts/forward-demo-files.mjs','scripts/program-window-fingerprint-core.mjs','scripts/program-fingerprint-core.mjs','scripts/program-direction-fingerprint-core.mjs','scripts/program-session-fingerprint-core.mjs','app/program-window-planner-model.ts','app/program-direction-forward-plan-model.ts','app/unique-json.ts','tsconfig.json'].map(windowPhysicalSource);
 const physical=await createWindowPhysicalGuard();
 const freshDirect=()=>{physical.assertFresh();for(const file of direct)assertWindowPhysicalSource(file);};
 const options={absWorkingDir:root,tsconfig:resolve(root,'tsconfig.json'),stdin:{contents:"export * from './app/program-window-planner-model';export {createLockedProgramDirectionSearchHandoff} from './app/program-direction-forward-plan-model';export {boundedProgramWindowValue,verifyProgramWindowInput,programWindowRightsDeclarationSchema} from './app/program-window-model';export {parseUniqueJson} from './app/unique-json';",resolveDir:root},bundle:true,write:false,metafile:true,platform:'browser',format:'esm',target:'es2022',logLevel:'silent'};
 freshDirect();const discovery=await build(options),paths=Object.keys(discovery.metafile.inputs).filter(path=>path!=='<stdin>').sort();
 ensure(paths.includes('app/program-window-planner-model.ts')&&paths.includes('app/program-direction-forward-plan-model.ts')&&paths.includes('app/unique-json.ts'),'FIXED_PREPARATION_GRAPH_REQUIRED');
 const graph=paths.map(windowPhysicalSource),assertFresh=()=>{freshDirect();for(const file of graph)assertWindowPhysicalSource(file);};
 assertFresh();const compiled=await build(options);
 ensure(same(paths,Object.keys(compiled.metafile.inputs).filter(path=>path!=='<stdin>').sort()),'PREPARATION_GRAPH_CHANGED');
 assertFresh();const model=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));assertFresh();
 const declaration={kind:'AUTHOR_DECLARED_IMPLEMENTATION',verification:'NOT_ESTABLISHED',components:Object.fromEntries(Object.entries(physical.graphs).map(([name,value])=>[name,{kind:'AUTHOR_DECLARED_SHA256',sha256:value.sha256}]))};
 physical.assertDeclaration(declaration);
 return {...model,physical,declaration,assertFresh};
}

function decoded(held){
 const bytes=held.bytes;ensure(!(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf),'STRICT_UTF8_JSON_REQUIRED');
 try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('STRICT_UTF8_JSON_REQUIRED');}
}
function parsed(m,held,maximum){try{return m.parseUniqueJson(decoded(held),maximum,prepareProgramWindowLimits.depth);}catch{throw Error('STRICT_UNIQUE_JSON_REQUIRED');}}
function preliminary(held){try{return JSON.parse(decoded(held));}catch{throw Error('STRICT_UNIQUE_JSON_REQUIRED');}}
const setupKeys='cycles,endsAt,pollMs,rights,sourceMode,startsAt,warmupBars';
function setupShape(raw){ensure(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).sort().join(',')===setupKeys,'EXPLICIT_SETUP_FIELDS_REQUIRED');}
function setupFields(m,raw){
 m.boundedProgramWindowValue(raw,prepareProgramWindowLimits.setupBytes);
 setupShape(raw);
 const rights=m.programWindowRightsDeclarationSchema.parse(raw.rights);
 return {startsAt:raw.startsAt,endsAt:raw.endsAt,pollMs:raw.pollMs,cycles:raw.cycles,warmupBars:raw.warmupBars,sourceMode:raw.sourceMode,rights};
}
function wholeBytes(value){const bytes=Buffer.from(JSON.stringify(value));ensure(bytes.length<=prepareProgramWindowLimits.wholeBytes,'COMPLETE_INPUT_EXCEEDS_8_MIB');return bytes;}
function directionInput(value){
 ensure(value.plan.version===2&&value.plan.kind==='LOCAL_PROGRAM_DIRECTION_FORWARD_PLAN'&&value.plan.mode==='PROSPECTIVE'&&value.plan.handoff.kind==='LOCKED_PROGRAM_DIRECTION_SEARCH_HANDOFF','PROSPECTIVE_DIRECTION_V2_INPUT_REQUIRED');
}
function diagnostic(input,kind,fileDigest){return {version:1,kind,inputDigest:input.inputDigest,protocolDigest:input.protocol.protocolDigest,ledgerDigest:input.plan.handoff.ledger.ledgerDigest,sessionId:input.protocol.sessionId,fileDigest,sourceMode:input.protocol.sourceMode,wholeByteLimit:prepareProgramWindowLimits.wholeBytes,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',sourceAuthentication:'OFFLINE_SNAPSHOT_UNVERIFIED',physicalDeclaration:'CURRENT_LOCAL_SOURCE_MATCH',backtestReplayed:false,guestExecuted:false,providerStarted:false,publicReferencesAuthenticated:false,registered:false,freshAdmission:false,ordersEnabled:false,liveEnabled:false};}

export async function prepareProgramWindowCli(args){
 const [command,...paths]=args;
 ensure(command==='prepare'&&paths.length===3||command==='verify'&&paths.length===1,'PREPARATION_USAGE');
 ensure(paths.every(path=>typeof path==='string'&&path.length>0&&path.length<=4096&&!/[\x00-\x1f\x7f]/.test(path))&&new Set(paths).size===paths.length,'DISTINCT_EXACT_PATHS_REQUIRED');
 const held=[];let output,outputPin;
 try{
  held.push(holdInput(paths[0],prepareProgramWindowLimits.wholeBytes));
  if(command==='prepare'){held.push(holdInput(paths[1],prepareProgramWindowLimits.setupBytes));outputPin=pinProgramPrivatePath(paths[2]);privateParent(outputPin);output=preparePrivateForwardOutput(paths[2],prepareProgramWindowLimits.wholeBytes);}
  // Cheap rejection only; the fixed unique-JSON parser and full models below
  // still decide acceptance and do not trust these preliminary projections.
  const preview=preliminary(held[0]);
  if(command==='prepare'){
   ensure(preview?.version===2&&preview.kind==='LOCAL_PROGRAM_DIRECTION_SEARCH_LEDGER'&&preview.selection?.decision==='SELECTED'&&Array.isArray(preview.attempts)&&preview.attempts.every(row=>row?.status!=='RUNNING'),'TERMINAL_DIRECTION_V2_SELECTION_REQUIRED');
   const test=preview.attempts.filter(row=>row?.phase==='TEST');ensure(test.length===1&&test[0].finishedAt!==null,'SOLE_TERMINAL_TEST_REQUIRED');setupShape(preliminary(held[1]));
  }else ensure(preview?.kind==='PROGRAM_FORWARD_WINDOW_INPUT'&&preview.plan?.version===2,'PROSPECTIVE_DIRECTION_V2_INPUT_REQUIRED');
  const m=await loadPrepareProgramWindowModules(),check=()=>{m.assertFresh();for(const file of held)file.assertFresh();if(outputPin)privateParent(outputPin);};check();
  if(command==='verify'){
   const input=await m.verifyProgramWindowInput(parsed(m,held[0],prepareProgramWindowLimits.wholeBytes));directionInput(input);wholeBytes(input);m.physical.assertDeclaration(input.protocol.newImplementation);check();
   return {...diagnostic(input,'LOCAL_PROGRAM_WINDOW_INPUT_VERIFIED',held[0].digest),verification:'HISTORICAL_INPUT_CONSISTENCY_AND_CURRENT_PHYSICAL_PINS'};
  }
  const ledger=parsed(m,held[0],prepareProgramWindowLimits.wholeBytes);
  ensure(ledger?.version===2&&ledger.kind==='LOCAL_PROGRAM_DIRECTION_SEARCH_LEDGER','COMPLETE_DIRECTION_V2_LEDGER_REQUIRED');
  const setup=setupFields(m,parsed(m,held[1],prepareProgramWindowLimits.setupBytes)),handoff=await m.createLockedProgramDirectionSearchHandoff(ledger);check();
  const preparedAt=new Date().toISOString(),input=await m.createProgramWindowPlannerInput(handoff,{sessionId:randomUUID(),preparedAt,startsAt:setup.startsAt,endsAt:setup.endsAt,pollMs:setup.pollMs,cycles:setup.cycles,warmupBars:setup.warmupBars,sourceMode:setup.sourceMode,rights:setup.rights,newImplementation:m.declaration});
  directionInput(input);m.physical.assertDeclaration(input.protocol.newImplementation);const bytes=wholeBytes(input);check();
  const publicationAt=Date.now();ensure(publicationAt>=Date.parse(preparedAt)&&Date.parse(input.protocol.startsAt)-publicationAt>=prepareProgramWindowLimits.leadMs,'PROSPECTIVE_LEAD_EXPIRED');output.assertFresh();
  output.writeBytes(bytes);check();
  const confirmed=holdInput(paths[2],prepareProgramWindowLimits.wholeBytes);held.push(confirmed);ensure(confirmed.bytes.equals(bytes),'PREPARATION_OUTPUT_UNCONFIRMED');check();
  const confirmedAt=Date.now();ensure(confirmedAt>=publicationAt&&confirmedAt>=Date.parse(preparedAt)&&Date.parse(input.protocol.startsAt)-confirmedAt>=prepareProgramWindowLimits.leadMs,'PROSPECTIVE_CLOCK_OR_LEAD_INVALID_AFTER_PUBLICATION');
  return {...diagnostic(input,'LOCAL_PROGRAM_WINDOW_INPUT_PREPARED',confirmed.digest),originalLedgerFileDigest:held[0].digest,originalSetupFileDigest:held[1].digest,preparedAt,startsAt:input.protocol.startsAt,endsAt:input.protocol.endsAt,retainedAttempts:ledger.attempts.length,wholeBytes:bytes.length};
 }finally{output?.close();outputPin?.close();for(const file of held.reverse())file.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await prepareProgramWindowCli(process.argv.slice(2)),text=JSON.stringify(result)+'\n';ensure(Buffer.byteLength(text)<=prepareProgramWindowLimits.diagnosticBytes,'DIAGNOSTIC_CAPACITY');process.stdout.write(text);}
 catch(error){process.stderr.write('Sampled Demo preparation or verification refused: '+refusalCode(error)+'. Preserve original inputs and any possible output; no provider, guest or public operation was started.\nUsage: prepare-program-window.mjs prepare LEDGER SETUP NEW_INPUT | verify INPUT\n');process.exitCode=1;}
}
