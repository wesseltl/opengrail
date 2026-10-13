import {realpathSync,statfsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve,join,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {localCheckLimits,LocalCheckError,check,parseArguments,newPrivateDirectory,writeJson,reducedEnvironment,heldFile,assertHeld,inventoryTree,assertTree,cleanSource,assertSource,copyBuild,buildDescriptor,migrationPaths,verifyNativeBody,assertNoPrivateConfiguration,runLocalPhase} from './selfhost-local-check-core.mjs';

/** One fixed, trusted-source build + actual compiled local check. No install/deploy modes. */
export async function selfhostLocalCheck(args){
 const output=parseArguments(args),project=realpathSync(fileURLToPath(new URL('../',import.meta.url))),part=relative(project,output);
 check(process.platform==='linux'&&typeof process.getuid==='function','LINUX_RUNTIME_REQUIRED');
 // An output outside the project is required independently of caller cwd.
 check(part==='..'||part.startsWith('..'+sep)||part.startsWith(sep),'OUTPUT_INSIDE_CHECKOUT');
 const [major,minor]=process.versions.node.split('.').map(Number);check(major>22||major===22&&minor>=13,'NODE_RUNTIME_REQUIRED');
 const started=performance.now(),controller=new AbortController(),stop=()=>controller.abort(),timer=setTimeout(stop,localCheckLimits.overallMs);process.on('SIGINT',stop);process.on('SIGTERM',stop);
 let owned,source,dependencies,tools,originBuild,snapshot,admission,native,result,runtimePins,marker,gitOrdinal=0;const phases=[];
 const abort=()=>check(!controller.signal.aborted&&performance.now()-started<localCheckLimits.overallMs,'CHECK_INTERRUPTED_OR_DEADLINE');
 try{
  owned=newPrivateDirectory(output);for(const name of ['home','tmp','state','metadata']){const folder=newPrivateDirectory(join(output,name));folder.close();}const environment=reducedEnvironment(output);
  const git=realpathSync('/usr/bin/git'),node=realpathSync(process.execPath);tools=[heldFile(node,localCheckLimits.toolBytes,{tool:true}),heldFile(git,localCheckLimits.toolBytes,{tool:true})];
  const readGit=async args=>{abort();const label='git-'+String(gitOrdinal++).padStart(3,'0'),phase=await runLocalPhase({executable:git,args:['-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.hooksPath=/dev/null','-c','core.pager=cat',...args],cwd:project,env:environment,output:join(output,'metadata'),label,timeoutMs:15000,signal:controller.signal,logBytes:1048576});phases.push({label,...phase.receipt});check(phase.receipt.status==='PHASE_COMPLETE','GIT_IDENTITY_UNCONFIRMED');return phase.stdout;};
  source=await cleanSource(project,readGit,abort);for(const required of ['scripts/selfhost-local-check.mjs','scripts/selfhost-local-check-core.mjs','scripts/selfhost-local-check-worker.mjs','build/selfhost-local-target.ts','vite.selfhost.config.ts','wrangler.selfhost.jsonc','package.json','package-lock.json'])check(source.files.some(row=>row.path===required),'REQUIRED_SOURCE_MISSING');
  assertNoPrivateConfiguration(project);
  check(statfsSync(output,{bigint:true}).bavail*statfsSync(output,{bigint:true}).bsize>=1073741824n,'LOCAL_STORAGE_CAPACITY');dependencies=inventoryTree(join(project,'node_modules'),{kind:'dependency',abort});
  runtimePins=writeJson(join(output,'runtime-pins.json'),{schema:'OPENGRAIL_LOCAL_SELFHOST_RUNTIME_PINS_V1',tools,sourceFiles:source.held.map(({relative,bytes,sha256,identity})=>({path:relative,bytes,sha256,identity})),dependencyRoot:dependencies.root,dependencyFiles:dependencies.held.map(({path,bytes,sha256,identity})=>({path,bytes,sha256,identity})),excludedDirectories:['any .bin (not executed)','root .vite-temp (compiler temporary files)'],scope:'OBSERVED_LOCAL_BYTES_NOT_PACKAGE_AUTHENTICITY_OR_OS_CONTAINMENT'},localCheckLimits.runtimeBytes);
  marker=writeJson(join(output,'local-check-build.json'),{schema:'OPENGRAIL_LOCAL_SELFHOST_BUILD_TARGET_V1',sourceRoot:project,outputRoot:output,runId:randomUUID()});environment.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT=output;
  const build=await runLocalPhase({executable:node,args:[join(project,'node_modules/vite/bin/vite.js'),'build','--config','vite.selfhost.config.ts','--clearScreen','false'],cwd:project,env:environment,output,label:'build',timeoutMs:localCheckLimits.buildMs,signal:controller.signal});phases.push(build.receipt);check(build.receipt.status==='PHASE_COMPLETE','BUILD_UNCONFIRMED');abort();
  assertHeld(marker,localCheckLimits.receiptBytes,{privateFile:true});
  await assertSource(source,readGit,abort);assertTree(dependencies,abort);for(const tool of tools)assertHeld(tool,localCheckLimits.toolBytes,{tool:true});
  originBuild=inventoryTree(join(output,'compiled'),{abort});snapshot=copyBuild(originBuild,join(output,'build'));const descriptor=await buildDescriptor(snapshot,project);abort();
  admission={schema:'OPENGRAIL_LOCAL_SELFHOST_ADMISSION_V1',source:{root:source.root,gitHead:source.gitHead,files:source.files,digest:source.digest,packageLockSha256:source.packageLockSha256},build:descriptor,migrations:migrationPaths(source)};
  const manifest=writeJson(join(output,'admission.json'),admission,localCheckLimits.manifestBytes);assertTree(snapshot,abort);await assertSource(source,readGit,abort);
  const worker=await runLocalPhase({executable:node,args:[join(project,'scripts/selfhost-local-check-worker.mjs'),manifest.path,manifest.sha256,join(output,'native')],cwd:project,env:environment,output,label:'worker',timeoutMs:localCheckLimits.nativeMs,signal:controller.signal});phases.push(worker.receipt);check(worker.receipt.status==='PHASE_COMPLETE','NATIVE_PROCESS_UNCONFIRMED');native=verifyNativeBody(join(output,'native'),manifest.sha256);assertHeld(manifest,localCheckLimits.manifestBytes,{privateFile:true});
  await assertSource(source,readGit,abort);assertTree(dependencies,abort);assertTree(originBuild,abort);assertTree(snapshot,abort);for(const tool of tools)assertHeld(tool,localCheckLimits.toolBytes,{tool:true});assertHeld(runtimePins,localCheckLimits.runtimeBytes,{privateFile:true});assertHeld(marker,localCheckLimits.receiptBytes,{privateFile:true});abort();owned.check();
  result={schema:'OPENGRAIL_LOCAL_SELFHOST_RESULT_V1',status:'ACCEPTED_LOCAL_SELF_CHECK',classification:'LOCAL_SELF_CHECK',qualification:'NONE',independence:'NOT_ESTABLISHED',actualUsers:0,syntheticFixturesOnly:true,realProvider:false,deployed:false,ordersEnabled:false,liveEnabled:false,osIsolation:'NOT_ESTABLISHED',source:{gitHead:source.gitHead,digest:source.digest,files:source.files.length},admission:{path:'admission.json',bytes:manifest.bytes,sha256:manifest.sha256},runtimePins:{path:'runtime-pins.json',bytes:runtimePins.bytes,sha256:runtimePins.sha256},native,phases,sourceBuildRuntimeUnchanged:true,elapsedMs:Math.round(performance.now()-started)};
 }catch(error){result={schema:'OPENGRAIL_LOCAL_SELFHOST_RESULT_V1',status:'UNCONFIRMED',classification:'LOCAL_SELF_CHECK',qualification:'NONE',independence:'NOT_ESTABLISHED',reason:error instanceof LocalCheckError?error.code:'LOCAL_CHECK_UNCONFIRMED',actualUsers:0,syntheticFixturesOnly:true,realProvider:false,deployed:false,ordersEnabled:false,liveEnabled:false,osIsolation:'NOT_ESTABLISHED',phases,sourceBuildRuntimeUnchanged:false,elapsedMs:Math.round(performance.now()-started)};
  if(source){try{for(const item of source.held)assertHeld(item);assertNoPrivateConfiguration(project);result.sourceBytesStillMatch=true;}catch{result.sourceBytesStillMatch=false;}}
 }finally{clearTimeout(timer);process.off('SIGINT',stop);process.off('SIGTERM',stop);}
 if(owned){try{owned.check();writeJson(join(output,'result.json'),result,localCheckLimits.manifestBytes);owned.sync();}finally{owned.close();}}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await selfhostLocalCheck(process.argv.slice(2));process.stdout.write(JSON.stringify({schema:result.schema,status:result.status,reason:result.reason??null,classification:result.classification})+'\n');process.exitCode=result.status==='ACCEPTED_LOCAL_SELF_CHECK'?0:1;}
 catch(error){const reason=error instanceof LocalCheckError?error.code:'LOCAL_CHECK_UNCONFIRMED';process.stderr.write('Local self-host check refused or unconfirmed ('+reason+'); preserve possible private output.\nUsage: node scripts/selfhost-local-check.mjs --output /absolute/fresh/check\n');process.exitCode=1;}
}
