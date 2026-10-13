import {constants,openSync,closeSync,readSync,writeSync,fstatSync,lstatSync,realpathSync,readdirSync,mkdirSync,fsyncSync,statfsSync} from 'node:fs';
import {resolve,join,dirname,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {pinProgramPrivatePath} from './program-session-files.mjs';

// Fixed sponsor-local tooling for reviewed source; neither an OS sandbox nor an installer.
export const localCheckLimits=Object.freeze({sourceFiles:20000,sourceBytes:536870912,buildFiles:20000,buildBytes:536870912,fileBytes:33554432,dependencyFiles:100000,dependencyBytes:2147483648,dependencyFileBytes:134217728,toolBytes:268435456,manifestBytes:2097152,runtimeBytes:33554432,logBytes:8388608,receiptBytes:2097152,responseBytes:16777216,totalResponseBytes:134217728,buildMs:600000,nativeMs:900000,overallMs:1600000,termMs:2000,killMs:2000,drainMs:2000});
export class LocalCheckError extends Error{constructor(code){super(code);this.code=code;}}
export function check(value,code){if(!value)throw new LocalCheckError(code);}
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identityKeys=['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'];
const dirKeys=['dev','ino','mode','uid','gid'];
const identity=stat=>Object.fromEntries(identityKeys.map(key=>[key,String(stat[key])]));
const identical=(a,b,keys=identityKeys)=>keys.every(key=>a[key]===b[key]);
const inside=(path,root)=>{const part=relative(root,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!part.startsWith(sep);};
const privateName=name=>name.startsWith('.env')||name.startsWith('.dev.vars')||['.git','.wrangler','.sites-runtime','.agents','.codex'].includes(name)||/\.(?:pem|key|p12|pfx)$/i.test(name);
export function localPath(value){check(typeof value==='string'&&value.length>0&&value.length<=4096&&!value.startsWith('/')&&!/[\x00-\x1f\x7f\\]/.test(value)&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!privateName(part)),'UNSAFE_LOCAL_PATH');return value;}
export function absolutePath(value){check(typeof value==='string'&&value.length<=4096&&!/[\x00-\x1f\x7f]/.test(value)&&resolve(value)===value,'UNSAFE_ABSOLUTE_PATH');return value;}
export function parseArguments(args){check(args.length===2&&args[0]==='--output','USAGE');return absolutePath(args[1]);}
export function canonicalRows(rows){return rows.map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
export const rowsDigest=rows=>sha(Buffer.from(JSON.stringify(canonicalRows(rows))));

/** Complete strict UTF-8 JSON, including duplicate names; never evaluates a value. */
export function parseLocalJson(bytes,maximum=localCheckLimits.manifestBytes){
 check(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=maximum&&!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'JSON_CAPACITY_OR_ENCODING');
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new LocalCheckError('JSON_CAPACITY_OR_ENCODING');}let at=0;
 const space=()=>{while(/[\t\r\n ]/.test(text[at]??'x'))at++;};
 const string=()=>{const start=at;check(text[at++]==='"','INVALID_JSON');while(at<text.length){const char=text[at++];if(char==='\\'){at++;continue;}if(char==='"'){try{return JSON.parse(text.slice(start,at));}catch{throw new LocalCheckError('INVALID_JSON');}}}throw new LocalCheckError('INVALID_JSON');};
 function value(depth){check(depth<=64,'JSON_DEPTH');space();const char=text[at];
  if(char==='{'){at++;space();if(text[at]==='}'){at++;return;}const names=new Set();for(;;){space();const name=string();check(!names.has(name),'DUPLICATE_JSON');names.add(name);space();check(text[at++]===':','INVALID_JSON');value(depth+1);space();if(text[at]==='}'){at++;return;}check(text[at++]===',','INVALID_JSON');}}
  if(char==='['){at++;space();if(text[at]===']'){at++;return;}for(;;){value(depth+1);space();if(text[at]===']'){at++;return;}check(text[at++]===',','INVALID_JSON');}}
  if(char==='"'){string();return;}const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));check(!!token,'INVALID_JSON');at+=token[0].length;
 }value(0);space();check(at===text.length,'INVALID_JSON');try{return JSON.parse(text);}catch{throw new LocalCheckError('INVALID_JSON');}
}

function file(path,maximum,{singleLink=true,privateFile=false,tool=false,body=false}={}){
 absolutePath(path);check(realpathSync(path)===path&&realpathSync(dirname(path))===dirname(path),'NONCANONICAL_FILE');const before=lstatSync(path,{bigint:true});
 check(before.isFile()&&before.size>=0n&&before.size<=BigInt(maximum)&&(!singleLink||before.nlink===1n)&&(!privateFile||(before.uid===BigInt(process.getuid())&&(before.mode&0o7777n)===0o600n))&&(tool||(before.uid===BigInt(process.getuid())))&&(before.mode&0o022n)===0n,'UNSAFE_FILE');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{check(identical(before,fstatSync(fd,{bigint:true})),'FILE_CHANGED');const hash=createHash('sha256'),buffer=Buffer.alloc(65536),parts=[];let bytes=0;
  for(;;){const n=readSync(fd,buffer,0,buffer.length,null);if(!n)break;bytes+=n;check(bytes<=maximum&&bytes<=Number(before.size),'FILE_CHANGED');hash.update(buffer.subarray(0,n));if(body)parts.push(Buffer.from(buffer.subarray(0,n)));}
  check(bytes===Number(before.size)&&identical(before,fstatSync(fd,{bigint:true}))&&identical(before,lstatSync(path,{bigint:true}))&&realpathSync(path)===path,'FILE_CHANGED');return {path,bytes,sha256:hash.digest('hex'),identity:identity(before),...(body?{body:Buffer.concat(parts)}:{})};
 }finally{closeSync(fd);}
}
export function privateFile(path,maximum=localCheckLimits.receiptBytes){return file(path,maximum,{privateFile:true,body:true});}
export function heldFile(path,maximum=localCheckLimits.fileBytes,options){return file(path,maximum,options);}
export function assertHeld(held,maximum=localCheckLimits.fileBytes,options){const current=file(held.path,maximum,options);check(current.sha256===held.sha256&&JSON.stringify(current.identity)===JSON.stringify(held.identity),'HELD_FILE_CHANGED');}
function directory(path,owned=true){absolutePath(path);check(realpathSync(path)===path,'NONCANONICAL_DIRECTORY');const stat=lstatSync(path,{bigint:true});check(stat.isDirectory()&&(!owned||stat.uid===BigInt(process.getuid())),'UNSAFE_DIRECTORY');return stat;}
function unchangedDirectory(path,stat){check(identical(stat,directory(path,false),dirKeys),'DIRECTORY_CHANGED');}
export function privateDirectory(path){const stat=directory(path);check((stat.mode&0o7777n)===0o700n,'PRIVATE_DIRECTORY_REQUIRED');const pin=pinProgramPrivatePath(join(path,'.local-check-pin'));return {path,check(){pin.assertFresh();unchangedDirectory(path,stat);},sync(){this.check();fsyncSync(pin.directory);this.check();},close:pin.close};}
export function newPrivateDirectory(path){absolutePath(path);const parent=privateDirectory(dirname(path));try{parent.check();mkdirSync(path,{mode:0o700});parent.sync();return privateDirectory(path);}finally{parent.close();}}
export function writePrivate(path,bytes,maximum=localCheckLimits.receiptBytes){
 check(Buffer.isBuffer(bytes)&&bytes.length<=maximum,'OUTPUT_CAPACITY');absolutePath(path);const pin=pinProgramPrivatePath(path);let fd;
 try{pin.assertFresh();check((fstatSync(pin.directory).mode&0o7777)===0o700&&fstatSync(pin.directory).uid===process.getuid(),'PRIVATE_PARENT_REQUIRED');fd=openSync(pin.target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
  let written=0;while(written<bytes.length){const n=writeSync(fd,bytes,written,bytes.length-written);check(n>0,'OUTPUT_UNCONFIRMED');written+=n;}fsyncSync(fd);closeSync(fd);fd=undefined;fsyncSync(pin.directory);pin.assertFresh();const held=privateFile(path,maximum);check(held.body.equals(bytes),'OUTPUT_UNCONFIRMED');return held;
 }finally{if(fd!==undefined)closeSync(fd);pin.close();}
}
export const writeJson=(path,value,maximum)=>writePrivate(path,Buffer.from(JSON.stringify(value,null,2)+'\n'),maximum);
export function assertNoPrivateConfiguration(project){for(const name of readdirSync(project))check(!name.startsWith('.env')&&!name.startsWith('.dev.vars'),'PRIVATE_CONFIGURATION_PRESENT');}
export function reducedEnvironment(output){return {PATH:'/usr/local/bin:/usr/bin:/bin',HOME:join(output,'home'),TMPDIR:join(output,'tmp'),XDG_CONFIG_HOME:join(output,'home'),XDG_CACHE_HOME:join(output,'home'),LANG:'C.UTF-8',LC_ALL:'C.UTF-8',NODE_ENV:'production',CI:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:join(output,'state','logs'),WRANGLER_REGISTRY_PATH:join(output,'state','dev-registry'),MINIFLARE_REGISTRY_PATH:join(output,'state','registry'),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'};}

export function inventoryTree(root,{kind='build',abort=()=>{}}={}){
 directory(root);const dependency=kind==='dependency',maximum=dependency?localCheckLimits.dependencyFileBytes:localCheckLimits.fileBytes,count=dependency?localCheckLimits.dependencyFiles:localCheckLimits.buildFiles,totalLimit=dependency?localCheckLimits.dependencyBytes:localCheckLimits.buildBytes;
 const held=[],directories=[],aliases=new Map();let total=0;
 function walk(path,prefix){abort();const stat=directory(path);directories.push({path,stat});for(const name of readdirSync(path).sort()){
  if(dependency&&(name==='.bin'||!prefix&&name==='.vite-temp'))continue;const rel=prefix?prefix+'/'+name:name;localPath(rel);const target=join(path,name),s=lstatSync(target,{bigint:true});check(!s.isSymbolicLink(),'TREE_LINK');
  if(s.isDirectory())walk(target,rel);else{check(s.isFile(),'TREE_SPECIAL_FILE');const item=file(target,maximum,{singleLink:!dependency});total+=item.bytes;check(total<=totalLimit&&held.length<count,'TREE_CAPACITY');held.push({...item,relative:rel});if(dependency){const key=item.identity.dev+':'+item.identity.ino;const group=aliases.get(key)??[];group.push(item);aliases.set(key,group);}}
 }unchangedDirectory(path,stat);}
 walk(root,'');if(dependency)for(const group of aliases.values())check(group.length===Number(group[0].identity.nlink)&&group.every(item=>item.identity.nlink===group[0].identity.nlink&&item.sha256===group[0].sha256),'DEPENDENCY_ALIAS_OUTSIDE_TREE');
 return {root,kind,held,directories,rows:canonicalRows(held.map(item=>({path:item.relative,bytes:item.bytes,sha256:item.sha256}))),total};
}
export function assertTree(snapshot,abort=()=>{}){const now=inventoryTree(snapshot.root,{kind:snapshot.kind,abort});check(rowsDigest(now.rows)===rowsDigest(snapshot.rows)&&JSON.stringify(now.held.map(item=>item.identity))===JSON.stringify(snapshot.held.map(item=>item.identity)),'TREE_CHANGED');for(const item of snapshot.directories)unchangedDirectory(item.path,item.stat);}
export function copyBuild(snapshot,destination){const out=newPrivateDirectory(destination);try{
 for(const item of snapshot.directories.slice(1)){const rel=relative(snapshot.root,item.path),child=newPrivateDirectory(join(destination,rel));child.close();}
 for(const item of snapshot.held){const current=file(item.path,localCheckLimits.fileBytes,{body:true});check(current.sha256===item.sha256&&JSON.stringify(current.identity)===JSON.stringify(item.identity),'BUILD_CHANGED');writePrivate(join(destination,item.relative),current.body,localCheckLimits.fileBytes);}out.sync();assertTree(snapshot);return inventoryTree(destination);
 }finally{out.close();}}

/** Linux identities supplement original wait/owned process-group closure; no hostile escape claim. */
// procfs virtual files report size0; read them independently under a finite byte cap.
function procRow(pid){try{const fd=openSync('/proc/'+pid+'/stat',constants.O_RDONLY|constants.O_NOFOLLOW);let text='';try{const bytes=Buffer.alloc(16384);const n=readSync(fd,bytes,0,bytes.length,null);check(n<bytes.length,'PROCESS_ROW_CAPACITY');text=bytes.subarray(0,n).toString();}finally{closeSync(fd);}const end=text.lastIndexOf(')'),parts=text.slice(end+2).trim().split(/\s+/);check(end>0&&/^\d+$/.test(parts[19]??''),'PROCESS_ROW_INVALID');return {pid:Number(pid),parent:Number(parts[1]),group:Number(parts[2]),session:Number(parts[3]),birth:parts[19]};}catch(error){if(['ENOENT','ESRCH'].includes(error?.code))return null;throw error;}}
function processRows(){const names=readdirSync('/proc').filter(name=>/^\d+$/.test(name));check(names.length<=32768,'PROCESS_INVENTORY_CAPACITY');return names.map(procRow).filter(Boolean);}
const processKey=row=>row.pid+':'+row.birth;
function signalOwned(row,signal){const current=procRow(row.pid);if(current&&current.birth===row.birth)try{process.kill(row.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}}
export async function runLocalPhase({executable,args,cwd,env,output,label,timeoutMs,signal,logBytes=localCheckLimits.logBytes}){
 check(process.platform==='linux'&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=localCheckLimits.nativeMs&&Number.isInteger(logBytes)&&logBytes>0&&logBytes<=localCheckLimits.logBytes&&/^[a-z][a-z0-9-]{0,47}$/.test(label),'INVALID_PHASE');
 const owned=privateDirectory(output),logs={},seen=new Map(),started=performance.now(),receipt={schema:'OPENGRAIL_LOCAL_SELFHOST_PHASE_V1',label,status:'UNCONFIRMED',pid:null,birth:null,group:null,originalWaitCollected:false,exitCode:null,signal:null,closed:false,timedOut:false,interrupted:false,outputTruncated:false,unexpectedDescendants:false,processInventoryConfirmed:true,observedDescendants:[],ownedGroupAbsent:false,observedDescendantsAbsent:false};let child,exit=false,closed=false,spawnFailure=false,stopAt=null,reason=null,groupRoot=null;
 const stop=code=>{reason??=code;stopAt??=performance.now();};
 const groupAuthority=rows=>rows.some(row=>seen.has(processKey(row))&&row.group===child.pid&&row.session===child.pid);
 const discover=rows=>{const root=rows.find(row=>row.pid===child.pid);if(!groupRoot&&root&&!exit&&!spawnFailure&&child.exitCode===null&&child.signalCode===null){groupRoot=root;receipt.birth=root.birth;seen.set(processKey(root),root);}const parents=new Set(rows.filter(row=>seen.has(processKey(row))).map(row=>row.pid)),knownGroup=groupAuthority(rows);let more=true;while(more){more=false;for(const row of rows)if(!seen.has(processKey(row))&&(parents.has(row.parent)||knownGroup&&row.group===child.pid&&row.session===child.pid)){seen.set(processKey(row),row);parents.add(row.pid);more=true;}}};
 try{
  for(const name of ['stdout','stderr']){const path=join(output,label+'.'+name),pin=pinProgramPrivatePath(path);owned.check();const fd=openSync(pin.target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);logs[name]={path,pin,fd,bytes:0,chunks:[]};}
  child=spawn(executable,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});receipt.pid=child.pid??null;receipt.group=child.pid??null;
  child.once('error',()=>{spawnFailure=true;stop('PHASE_SPAWN_FAILED');});child.once('exit',(code,sig)=>{exit=true;receipt.originalWaitCollected=true;receipt.exitCode=code;receipt.signal=sig;});child.once('close',()=>{closed=true;receipt.closed=true;});
  for(const name of ['stdout','stderr']){
   child[name].on('error',()=>stop('PHASE_STREAM_UNCONFIRMED'));
   child[name].on('data',bytes=>{const log=logs[name];try{owned.check();log.pin.assertFresh();const remaining=logBytes-log.bytes,part=bytes.subarray(0,Math.max(0,remaining));let offset=0;while(offset<part.length){const n=writeSync(log.fd,part,offset,part.length-offset);check(n>0,'LOG_WRITE_UNCONFIRMED');offset+=n;}log.bytes+=part.length;if(logBytes<=1048576)log.chunks.push(Buffer.from(part));if(part.length!==bytes.length){receipt.outputTruncated=true;stop('PHASE_OUTPUT_CAPACITY');}}catch{stop('PHASE_LOG_UNCONFIRMED');}});
  }
  while(!closed||!exit&&!spawnFailure){
   const now=performance.now();if(signal?.aborted){receipt.interrupted=true;stop('PHASE_INTERRUPTED');}if(now-started>=timeoutMs){receipt.timedOut=true;stop('PHASE_DEADLINE');}
   let rows=[];try{rows=processRows();discover(rows);}catch{receipt.processInventoryConfirmed=false;stop('PROCESS_INVENTORY_UNCONFIRMED');}
   const live=rows.filter(row=>seen.has(processKey(row))),remaining=live.filter(row=>row.pid!==child.pid);if(exit&&remaining.length){receipt.unexpectedDescendants=true;stop('PHASE_RETAINED_DESCENDANTS');}
   if(stopAt!==null||exit&&closed&&live.length===0)break;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
 }catch{stop('PHASE_UNCONFIRMED');
 }finally{
  if(child){
   // Every post-spawn failure enters the same bounded closeout. Always signal the
   // original ChildProcess too, even when /proc inventory has become unavailable.
   const closeStarted=performance.now(),closeLimit=localCheckLimits.termMs+localCheckLimits.killMs+localCheckLimits.drainMs;
   for(;;){let rows=[],live=[];try{rows=processRows();discover(rows);live=rows.filter(row=>seen.has(processKey(row)));}catch{receipt.processInventoryConfirmed=false;stop('PROCESS_INVENTORY_UNCONFIRMED');}
    if(closed&&(exit||spawnFailure)&&live.length===0&&receipt.processInventoryConfirmed)break;
    stop('PROCESS_CLOSEOUT_REQUIRED');const elapsed=performance.now()-closeStarted,kill=elapsed>=localCheckLimits.termMs?'SIGKILL':'SIGTERM';
    try{if(!exit&&!spawnFailure&&child.exitCode===null&&child.signalCode===null)child.kill(kill);if(groupAuthority(rows))process.kill(-child.pid,kill);}catch(error){if(error.code!=='ESRCH'){receipt.processInventoryConfirmed=false;stop('PROCESS_TERMINATION_UNCONFIRMED');}}
    for(const row of seen.values())try{signalOwned(row,kill);}catch{receipt.processInventoryConfirmed=false;stop('PROCESS_TERMINATION_UNCONFIRMED');}
    if(elapsed>=localCheckLimits.termMs+localCheckLimits.killMs){child.stdout?.destroy();child.stderr?.destroy();}
    if(elapsed>=closeLimit){stop('PROCESS_CLOSURE_UNCONFIRMED');break;}await new Promise(resolve=>setTimeout(resolve,50));
   }
   try{const rows=processRows();receipt.ownedGroupAbsent=!rows.some(row=>row.group===child.pid);receipt.observedDescendantsAbsent=!rows.some(row=>seen.has(processKey(row)));if(!receipt.ownedGroupAbsent||!receipt.observedDescendantsAbsent)stop('PROCESS_ABSENCE_UNCONFIRMED');}catch{receipt.processInventoryConfirmed=false;stop('PROCESS_INVENTORY_UNCONFIRMED');}
  }
  for(const log of Object.values(logs)){try{if(log.fd!==undefined){try{fsyncSync(log.fd);}finally{closeSync(log.fd);log.fd=undefined;}}log.pin.assertFresh();}catch{stop('PHASE_LOG_CLOSURE_UNCONFIRMED');}finally{log.pin.close();}}
  try{owned.sync();}catch{stop('PHASE_OUTPUT_CLOSURE_UNCONFIRMED');}finally{owned.close();}
 }
 receipt.observedDescendants=[...seen.values()].filter(row=>row.pid!==child?.pid);receipt.elapsedMs=Math.round(performance.now()-started);receipt.reason=reason;
 receipt.status=receipt.originalWaitCollected&&receipt.birth!==null&&receipt.exitCode===0&&receipt.signal===null&&closed&&!reason&&!receipt.outputTruncated&&!receipt.unexpectedDescendants&&receipt.processInventoryConfirmed&&receipt.ownedGroupAbsent&&receipt.observedDescendantsAbsent?'PHASE_COMPLETE':'UNCONFIRMED';
 receipt.logs={};for(const [name,log]of Object.entries(logs)){try{const held=privateFile(log.path,logBytes);receipt.logs[name]={bytes:held.bytes,sha256:held.sha256};}catch{receipt.status='UNCONFIRMED';receipt.reason='PHASE_LOG_READBACK_UNCONFIRMED';}}
 try{writeJson(join(output,label+'-phase.json'),receipt);}catch{receipt.status='UNCONFIRMED';receipt.reason='PHASE_RECEIPT_UNCONFIRMED';}
 return {receipt,stdout:Buffer.concat(logs.stdout?.chunks??[]),stderr:Buffer.concat(logs.stderr?.chunks??[])};
}

export async function cleanSource(project,readGit,abort=()=>{}){
 directory(project);assertNoPrivateConfiguration(project);const top=(await readGit(['rev-parse','--show-toplevel'])).toString().trim();check(top===project,'WRONG_CHECKOUT');const head=(await readGit(['rev-parse','HEAD'])).toString().trim();check(/^[a-f0-9]{40}$/.test(head),'INVALID_GIT_HEAD');check((await readGit(['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'])).length===0,'CHECKOUT_NOT_CLEAN');
 const paths=(await readGit(['ls-files','-z'])).toString('utf8').split('\0').filter(Boolean);check(paths.length>0&&paths.length<=localCheckLimits.sourceFiles&&new Set(paths).size===paths.length,'SOURCE_FILE_CAPACITY');const held=[],directories=new Map();let total=0;
 for(const path of paths.sort()){abort();localPath(path);let parent=dirname(join(project,path));for(;;){if(!directories.has(parent))directories.set(parent,directory(parent,false));const next=dirname(parent);if(next===parent)break;parent=next;}const current=file(join(project,path),localCheckLimits.fileBytes);total+=current.bytes;check(total<=localCheckLimits.sourceBytes,'SOURCE_BYTE_CAPACITY');held.push({...current,relative:path});}
 for(const [path,stat]of directories)unchangedDirectory(path,stat);const rows=canonicalRows(held.map(item=>({path:item.relative,bytes:item.bytes,sha256:item.sha256}))),lock=rows.find(row=>row.path==='package-lock.json');check(lock,'LOCKFILE_REQUIRED');return {root:project,gitHead:head,files:rows,digest:rowsDigest(rows),packageLockSha256:lock.sha256,held,directories};
}
export async function assertSource(source,readGit,abort){for(const [path,stat]of source.directories)unchangedDirectory(path,stat);const current=await cleanSource(source.root,readGit,abort);check(current.gitHead===source.gitHead&&current.digest===source.digest&&JSON.stringify(current.held.map(item=>item.identity))===JSON.stringify(source.held.map(item=>item.identity)),'SOURCE_CHANGED');}
function moduleRuleType(path,rules){const matches=new Set();for(const rule of rules){check(rule&&['ESModule','CommonJS','Text','Data','CompiledWasm'].includes(rule.type)&&Array.isArray(rule.globs)&&(rule.fallthrough===undefined||typeof rule.fallthrough==='boolean'),'UNSUPPORTED_MODULE_RULE');for(const glob of rule.globs){check(typeof glob==='string'&&/^\*\*\/\*\.[a-z0-9]+$/.test(glob),'UNSUPPORTED_MODULE_GLOB');if(path.endsWith(glob.slice(4)))matches.add(rule.type);}}check(matches.size<=1,'AMBIGUOUS_MODULE_RULE');return [...matches][0];}
export async function buildDescriptor(snapshot,project){
 const configs=snapshot.rows.filter(row=>row.path.endsWith('/wrangler.json')||row.path==='wrangler.json');check(configs.length===1,'GENERATED_CONFIGURATION_AMBIGUOUS');const configuration=configs[0].path,cfg=parseLocalJson(file(join(snapshot.root,configuration),localCheckLimits.manifestBytes,{body:true}).body);
 const resolved=part=>{check(typeof part==='string'&&!/[\x00-\x1f\x7f\\]/.test(part),'GENERATED_PATH_INVALID');const path=resolve(snapshot.root,dirname(configuration),part);check(inside(path,snapshot.root),'GENERATED_PATH_OUTSIDE_BUILD');return localPath(relative(snapshot.root,path));};
 const main=resolved(cfg.main),assetDirectory=resolved(cfg.assets?.directory),mainPin=snapshot.rows.find(row=>row.path===main);check(mainPin&&cfg.assets?.binding==='ASSETS'&&typeof cfg.assets.run_worker_first==='boolean','GENERATED_ENTRY_OR_ASSETS');directory(join(snapshot.root,assetDirectory));
 check(Array.isArray(cfg.rules)&&cfg.rules.length>0&&cfg.rules.length<=32,'GENERATED_MODULE_RULES');const server=dirname(main),modules=[];
 for(const row of snapshot.rows){if(!inside(join(snapshot.root,row.path),join(snapshot.root,server)))continue;const type=moduleRuleType(row.path,cfg.rules);if(type)modules.push({path:row.path,type});else check(!/\.(?:js|mjs|cjs)$/.test(row.path),'UNDECLARED_SCRIPT_MODULE');}
 check(modules.length>0&&modules.length<=4096&&modules.some(row=>row.path===main&&row.type==='ESModule'),'GENERATED_MAIN_NOT_ESMODULE');modules.sort((a,b)=>a.path===main?-1:b.path===main?1:a.path<b.path?-1:1);
 const lexer=await import(pathToFileURL(join(project,'node_modules/es-module-lexer/dist/lexer.asm.js')));await lexer.init;
 const moduleNames=new Set(modules.map(row=>row.path));for(const mod of modules){if(mod.type!=='ESModule')continue;const source=new TextDecoder('utf-8',{fatal:true}).decode(file(join(snapshot.root,mod.path),localCheckLimits.fileBytes,{body:true}).body);const [imports]=lexer.parse(source);
  for(const entry of imports){if(entry.n===undefined||entry.d===-2)continue;const name=entry.n;if(name.startsWith('node:')||name==='cloudflare:workers')continue;check(name.startsWith('./')||name.startsWith('../'),'UNEXPECTED_MODULE_IMPORT');const target=resolve(snapshot.root,dirname(mod.path),name);check(inside(target,snapshot.root)&&moduleNames.has(relative(snapshot.root,target)),'INCOMPLETE_MODULE_GRAPH');}}
 return {root:snapshot.root,configuration,main,modules,files:snapshot.rows,assets:{directory:assetDirectory,binding:cfg.assets.binding,runWorkerFirst:cfg.assets.run_worker_first}};
}
export function migrationPaths(source){const registry=source.files.filter(row=>/^drizzle\/[^/]+\.sql$/.test(row.path)).map(row=>row.path),auth=source.files.filter(row=>/^selfhost\/migrations\/[^/]+\.sql$/.test(row.path)).map(row=>row.path);check(registry.length>0&&registry.length<=100&&auth.length>0&&auth.length<=100,'MIGRATIONS_REQUIRED');return {registry,auth};}
export const nativeChecks=Object.freeze(['clean_local_startup_and_separate_migrations','real_compiled_anonymous_first','real_rs256_pkce_callback_and_compiled_route_singleton_positive','concurrent_scoped_owners_and_machine_grant_separation','twenty_real_pages_html_and_full_rsc_warm_orders_overlap_private','actual_closed_runtime_restart_preserves_sessions_and_registry','restore_epoch_invalidates_old_cookies_without_email_owner_linking','real_compiled_retained_eight_and_atomic_thousand_boundary','actual_built_signed_callback_refuses_corruption','source_and_complete_built_bytes_unchanged']);
export function verifyNativeBody(native,manifestSha256){
 const held=privateFile(join(native,'receipt.json')),body=parseLocalJson(held.body,localCheckLimits.receiptBytes);
 check(body.schema==='OPENGRAIL_LOCAL_SELFHOST_BODY_V1'&&body.status==='BODY_COMPLETE'&&body.executionClosure==='OUTER_EXECUTION_CLOSURE_PENDING'&&body.manifestSha256===manifestSha256&&body.qualification==='NONE'&&body.independence==='NOT_ESTABLISHED'&&body.actualUsers===0&&body.syntheticFixturesOnly===true&&body.actualProviderOrDeployment===false&&body.finalByteGuards==='CONFIRMED'&&!body.disposalUnconfirmed&&!body.receiptPublicationUnconfirmed&&JSON.stringify(body.checks)===JSON.stringify(nativeChecks),'NATIVE_BODY_UNCONFIRMED');
 check(JSON.stringify(body.disposals)===JSON.stringify(['before_closed_backup','after_actual_logout','same-epoch-restore-demonstration','final'].map(label=>({label,completed:true}))),'NATIVE_DISPOSAL_UNCONFIRMED');
 check(body.pageMatrix?.pages===20&&body.pageMatrix.HTML===140&&body.pageMatrix.RSC===140&&body.pageMatrix.warmRequestsPerPage===4&&body.pageMatrix.overlappingRequestsPerPage===3,'NATIVE_PAGE_MATRIX_UNCONFIRMED');
 check(Array.isArray(body.responses)&&body.responses.length>0&&body.responses.length<=2000,'NATIVE_RESPONSES_REQUIRED');const names=[],responses=[];let total=0;
 for(let n=0;n<body.responses.length;n++){const row=body.responses[n],path='responses/'+String(n).padStart(4,'0')+'.body';check(row.path===path&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=localCheckLimits.responseBytes&&/^[a-f0-9]{64}$/.test(row.sha256),'NATIVE_RESPONSE_BINDING');const current=privateFile(join(native,path),localCheckLimits.responseBytes);check(current.bytes===row.bytes&&current.sha256===row.sha256,'NATIVE_RESPONSE_CHANGED');names.push(path.split('/')[1]);responses.push({path,bytes:current.bytes,sha256:current.sha256});total+=current.bytes;check(total<=localCheckLimits.totalResponseBytes,'NATIVE_RESPONSE_CAPACITY');}
 check(JSON.stringify(readdirSync(join(native,'responses')).sort())===JSON.stringify(names.sort())&&body.responseBytes===total,'NATIVE_RESPONSE_FILE_SET');assertHeld(held,localCheckLimits.receiptBytes,{privateFile:true});return {receipt:{path:'native/receipt.json',bytes:held.bytes,sha256:held.sha256},checks:body.checks,responses:responses.length,responseBytes:total,disposals:body.disposals};
}
