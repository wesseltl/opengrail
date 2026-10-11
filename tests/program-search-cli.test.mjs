import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync,linkSync,openSync,closeSync,statSync,chmodSync,ftruncateSync,mkdirSync,cpSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {programFingerprintFiles} from '../scripts/program-fingerprint-core.mjs';
import {trapProgram,infiniteProgram,moduleHex} from './helpers/program-fixtures.mjs';

let directory,m,example,counter=0;
const root=process.cwd(),env={PATH:process.env.PATH,WRANGLER_SEND_METRICS:'false'};
const path=name=>join(directory,(++counter)+'-'+name);
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const write=(file,value)=>writeFileSync(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value),{flag:'wx',mode:0o600});
const call=(...args)=>spawnSync(process.execPath,['scripts/program-search.mjs',...args],{cwd:root,encoding:'utf8',maxBuffer:32768,timeout:30000,env});
const rows=result=>result.stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
function confirmed(result){assert.equal(result.status,0,result.stderr);return rows(result);}
function freeze(name,admission=example.admission){const input=path(name+'-admission.json'),ledger=path(name+'-ledger.json');write(input,admission);confirmed(call('freeze',input,ledger));return {input,ledger};}
function runHook(hook,args,cli=resolve(root,'scripts/program-search.mjs')){return spawnSync(process.execPath,['--import',hook,cli,...args],{cwd:root,encoding:'utf8',maxBuffer:32768,timeout:30000,env});}
function child(args,hook){return spawn(process.execPath,[...(hook?['--import',hook]:[]),resolve(root,'scripts/program-search.mjs'),...args],{cwd:root,env,stdio:['ignore','pipe','pipe']});}
async function collect(child){let stdout='',stderr='';child.stdout.on('data',bytes=>stdout+=bytes);child.stderr.on('data',bytes=>stderr+=bytes);const terminal=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(status,signal)=>resolve({status,signal}));});return {...terminal,stdout,stderr};}
function clonedCheckout(){
 const folder=path('fixed-checkout');mkdirSync(folder,{mode:0o700});cpSync(join(root,'app'),join(folder,'app'),{recursive:true});mkdirSync(join(folder,'scripts'));
 for(const file of ['scripts/program-search.mjs','scripts/program-fingerprint-core.mjs','scripts/session-file-lock.py','package.json','package-lock.json'])copyFileSync(join(root,file),join(folder,file));
 mkdirSync(join(folder,'node_modules'));cpSync(join(root,'node_modules/zod'),join(folder,'node_modules/zod'),{recursive:true});symlinkSync(join(root,'node_modules/esbuild'),join(folder,'node_modules/esbuild'),'dir');
 return folder;
}
before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-program-search-cli-'));
 const compiled=await build({stdin:{contents:"export * from './app/program-search-protocol';export {syntheticProgramSearchExample} from './app/program-search-example';export {boundedStrategyRecord,strategyDigest} from './app/strategy-model';export {programBinaryDigest} from './app/program-source-model';",resolveDir:root},absWorkingDir:root,bundle:true,write:false,platform:'node',format:'cjs',target:'es2022',logLevel:'silent'}),module={exports:{}};
 new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);m=module.exports;example=await m.syntheticProgramSearchExample();
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('actual PROGRAM workflow retains generated TRAIN, whole same-identity reconstructions and locked adverse sole TEST',()=>{
 const {ledger}=freeze('workflow');assert.equal(statSync(ledger).mode&0o7777,0o600);
 const outputs=[];for(let n=0;n<example.admission.candidates.length;n++){
  const result=call('train',ledger);assert([0,2].includes(result.status),result.stderr);const emitted=rows(result);assert.equal(emitted[0].type,'ADMITTED');assert.equal(emitted[1].type,'RETAINED');assert.equal(emitted[1].generatorComparisonStatus,'MATCH');outputs.push(...emitted);
 }
 const trained=read(ledger);assert.equal(trained.attempts.length,example.admission.candidates.length);
 for(const attempt of trained.attempts){assert.equal(attempt.status,'EVALUATED');assert(attempt.outcome);assert(attempt.reconstruction);assert.equal(attempt.outcome.attemptId,attempt.attemptId);assert.equal(attempt.reconstruction.attemptId,attempt.attemptId);assert.deepEqual(attempt.reconstruction,attempt.outcome);assert.equal(attempt.generatorComparison.status,'MATCH');assert.equal(attempt.outcome.input.strategy.record.version,2);assert(!Object.hasOwn(attempt.input,'signals'));}
 assert(trained.attempts.some(attempt=>attempt.outcome.artifact.metrics?.returnPct>0));
 const lock=confirmed(call('lock',ledger));assert.equal(lock[0].decision,'SELECTED');const selection=read(ledger).selection,prior=read(ledger).attempts.map(attempt=>JSON.stringify(attempt));
 const testInput=path('test.json');write(testInput,example.testInput);const tested=call('test',testInput,ledger);assert([0,2].includes(tested.status),tested.stderr);assert.equal(rows(tested)[0].phase,'TEST');
 const final=read(ledger),last=final.attempts.at(-1);assert.deepEqual(final.selection,selection);assert.deepEqual(final.attempts.slice(0,-1).map(attempt=>JSON.stringify(attempt)),prior);assert.equal(last.candidateId,selection.selectedCandidateId);assert.equal(last.generatorComparison.status,'MATCH');assert(last.outcome.artifact.metrics.returnPct<0);assert.deepEqual(last.reconstruction,last.outcome);assert.equal(final.qualification,'NONE');assert.equal(final.unseen,'NOT_ESTABLISHED');
 const bytes=readFileSync(ledger);for(const args of [['test',testInput,ledger],['admit-test',testInput,ledger],['execute',ledger,last.attemptId],['train',ledger],['lock',ledger]])assert.equal(call(...args).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const checked=confirmed(call('verify',ledger));assert.equal(checked[0].executionReconstructed,false);assert.equal(checked[0].submitted,false);assert(!JSON.stringify([...outputs,...lock,...rows(tested),...checked]).includes(directory));
});

test('original pending ID executes once; explicit recovery retains interruption and consumes its TRAIN identity',()=>{
 const {ledger}=freeze('pending');const admission=confirmed(call('admit-train',ledger)),pending=read(ledger),attempt=pending.attempts[0],bytes=readFileSync(ledger);assert.equal(admission[0].type,'ADMITTED');assert.equal(attempt.status,'RUNNING');assert.equal(attempt.outcome,null);
 for(const args of [['train',ledger],['admit-train',ledger],['execute',ledger,crypto.randomUUID()]])assert.equal(call(...args).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 confirmed(call('recover',ledger));const recovered=read(ledger).attempts[0];assert.equal(recovered.status,'INTERRUPTED');assert.equal(recovered.reason,'RECOVERY_INTERRUPTED');assert.equal(recovered.attemptId,attempt.attemptId);assert.deepEqual(recovered.input,attempt.input);assert.equal(recovered.outcome.status,'INTERRUPTED');assert.equal(recovered.outcome.attemptId,attempt.attemptId);assert.equal(recovered.reconstruction,null);
 const retained=readFileSync(ledger);assert.equal(call('execute',ledger,attempt.attemptId).status,1);confirmed(call('recover',ledger));assert.deepEqual(readFileSync(ledger),retained);
 confirmed(call('admit-train',ledger));const next=read(ledger).attempts[1],result=call('execute',ledger,next.attemptId);assert([0,2].includes(result.status),result.stderr);assert.equal(rows(result)[0].type,'EXECUTING');assert.equal(read(ledger).attempts[1].status,'EVALUATED');
});

test('TEST interruption consumes its sole admission; NO_SELECTION retains every failed eligibility',()=>{
 const {ledger}=freeze('test-interruption');for(let n=0;n<example.admission.candidates.length;n++)assert([0,2].includes(call('train',ledger).status));confirmed(call('lock',ledger));const choice=read(ledger).selection,testInput=path('test-interrupt.json');write(testInput,example.testInput);confirmed(call('admit-test',testInput,ledger));const id=read(ledger).attempts.at(-1).attemptId;confirmed(call('recover',ledger));assert.equal(read(ledger).attempts.at(-1).status,'INTERRUPTED');assert.deepEqual(read(ledger).selection,choice);
 const retained=readFileSync(ledger);for(const args of [['test',testInput,ledger],['admit-test',testInput,ledger],['execute',ledger,id],['lock',ledger]])assert.equal(call(...args).status,1);assert.deepEqual(readFileSync(ledger),retained);
 const admission=structuredClone(example.admission);admission.selection.minReturnPct=1000000;const none=freeze('no-selection',admission).ledger;for(let n=0;n<admission.candidates.length;n++)assert([0,2].includes(call('train',none).status));assert.equal(confirmed(call('lock',none))[0].decision,'NO_SELECTION');assert.equal(read(none).attempts.length,admission.candidates.length);assert(read(none).selection.ranking.every(row=>!row.eligible));const original=readFileSync(none);assert.equal(call('admit-test',testInput,none).status,1);assert.deepEqual(readFileSync(none),original);
});

test('actual concurrent processes cannot admit two trials or overwrite an existing freeze',async()=>{
 const {input,ledger}=freeze('concurrent'),results=await Promise.all([collect(child(['admit-train',ledger])),collect(child(['admit-train',ledger]))]);assert.deepEqual(results.map(result=>result.status).sort(),[0,1]);assert.equal(read(ledger).attempts.length,1);assert.equal(read(ledger).attempts[0].status,'RUNNING');const bytes=readFileSync(ledger);assert.equal(call('freeze',input,ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const destination=path('concurrent-create.json'),created=await Promise.all([collect(child(['freeze',input,destination])),collect(child(['freeze',input,destination]))]);assert.deepEqual(created.map(result=>result.status).sort(),[0,1]);assert.equal(read(destination).attempts.length,0);
});

test('SIGKILL after durable admission is recoverable without replay; cooperative cancellation retains original identity',async()=>{
 for(const signal of ['SIGKILL','SIGTERM']){
  const {ledger}=freeze('signal-'+signal),hook=path('controlled-admission-yield.mjs');write(hook,"const original=process.stdout.write.bind(process.stdout);process.stdout.write=(chunk,callback)=>{if(String(chunk).includes('\\\"type\\\":\\\"ADMITTED\\\"'))return original(chunk,error=>setTimeout(()=>callback?.(error),300));return original(chunk,callback);};\n");
  const processChild=child(['train',ledger],hook);let signalled=false;processChild.stdout.on('data',bytes=>{if(!signalled&&String(bytes).includes('"type":"ADMITTED"')){signalled=true;processChild.kill(signal);}});const timer=setTimeout(()=>processChild.kill('SIGKILL'),20000);const result=await collect(processChild);clearTimeout(timer);assert(signalled,result.stderr);const original=read(ledger).attempts[0];
  if(signal==='SIGKILL'){assert.equal(result.signal,'SIGKILL');assert.equal(original.status,'RUNNING');confirmed(call('recover',ledger));assert.equal(read(ledger).attempts[0].reason,'RECOVERY_INTERRUPTED');}
  else{assert.equal(result.status,2,result.stderr);assert.equal(original.status,'INTERRUPTED');assert.equal(original.reason,'USER_CANCELLED');assert.equal(rows(result).at(-1).type,'RETAINED');}
  assert.equal(read(ledger).attempts[0].attemptId,original.attemptId);const retained=readFileSync(ledger);assert.equal(call('execute',ledger,original.attemptId).status,1);assert.deepEqual(readFileSync(ledger),retained);
 }
});

test('unknown directory-sync acknowledgments preserve frozen, pending and completed original bytes without repeated computation',()=>{
 for(const phase of ['freeze','admission','terminal']){
  const hook=path('sync-'+phase+'.mjs'),count=phase==='terminal'?2:1;write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let count=0;fs.fsyncSync=fd=>{const directory=fs.fstatSync(fd).isDirectory();original(fd);if(directory&&++count==="+count+")throw Error('Reviewed synthetic directory acknowledgment fault');};syncBuiltinESMExports();\n");
  const f=phase==='freeze'?{input:path('uncertain-admission.json'),ledger:path('uncertain-ledger.json')}:freeze('uncertain-'+phase);if(phase==='freeze')write(f.input,example.admission);const result=runHook(hook,phase==='freeze'?['freeze',f.input,f.ledger]:['train',f.ledger]);assert.equal(result.status,1);assert.match(result.stderr,/not confirmed/);assert(!result.stdout.includes('"type":"RETAINED"'));assert(!result.stderr.includes(directory));assert(existsSync(f.ledger));confirmed(call('verify',f.ledger));
  const retained=readFileSync(f.ledger),saved=read(f.ledger);if(phase==='freeze'){assert.equal(saved.attempts.length,0);assert(!result.stdout.includes('"type":"FROZEN"'));assert.equal(call('freeze',f.input,f.ledger).status,1);}
  else if(phase==='admission'){assert.equal(saved.attempts[0].status,'RUNNING');assert(!result.stdout.includes('"type":"ADMITTED"'));assert.equal(call('train',f.ledger).status,1);}
  else{assert.equal(saved.attempts[0].status,'EVALUATED');assert(saved.attempts[0].outcome&&saved.attempts[0].reconstruction);assert.equal(call('execute',f.ledger,saved.attempts[0].attemptId).status,1);}
  assert.deepEqual(readFileSync(f.ledger),retained);
 }
});

test('failed admission readback leaves durable original pending evidence and no guest computation or acknowledgment',()=>{
 const {ledger}=freeze('readback'),hook=path('readback-fault.mjs');write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const originalSync=fs.fsyncSync,originalRead=fs.readSync;let published=false;fs.fsyncSync=fd=>{originalSync(fd);if(fs.fstatSync(fd).isDirectory())published=true;};fs.readSync=(fd,...args)=>{if(published&&fs.realpathSync('/proc/self/fd/'+fd)==="+JSON.stringify(ledger)+")throw Error('Reviewed synthetic readback fault');return originalRead(fd,...args);};syncBuiltinESMExports();\n");
 const result=runHook(hook,['train',ledger]);assert.equal(result.status,1);assert(!result.stdout.includes('"type":"ADMITTED"'));const saved=read(ledger);assert.equal(saved.attempts[0].status,'RUNNING');assert.equal(saved.attempts[0].outcome,null);confirmed(call('verify',ledger));confirmed(call('recover',ledger));assert.equal(read(ledger).attempts[0].status,'INTERRUPTED');
});

test('resumed execution syncs its original private inode and parent and requires exact readback before any execution',()=>{
 for(const phase of ['file-sync','directory-sync','readback']){
  const {ledger}=freeze('resume-'+phase);confirmed(call('admit-train',ledger));const original=readFileSync(ledger),attempt=read(ledger).attempts[0],hook=path('resume-'+phase+'.mjs');
  const fault=phase==='file-sync'?"if(fs.fstatSync(fd).isFile())throw Error('Reviewed resumed file-sync fault');":phase==='directory-sync'?"if(fs.fstatSync(fd).isDirectory())throw Error('Reviewed resumed directory-sync fault');":"if(fs.fstatSync(fd).isDirectory())published=true;";
  write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const originalSync=fs.fsyncSync,originalRead=fs.readSync;let published=false;fs.fsyncSync=fd=>{originalSync(fd);"+fault+"};fs.readSync=(fd,...args)=>{if(published&&fs.realpathSync('/proc/self/fd/'+fd)==="+JSON.stringify(ledger)+")throw Error('Reviewed resumed readback fault');return originalRead(fd,...args);};syncBuiltinESMExports();\n");
  const result=runHook(hook,['execute',ledger,attempt.attemptId]);assert.equal(result.status,1);assert(!result.stdout.includes('"type":"EXECUTING"'));assert(!result.stdout.includes('"type":"RETAINED"'));assert.deepEqual(readFileSync(ledger),original);assert.equal(read(ledger).attempts[0].status,'RUNNING');assert.equal(read(ledger).attempts[0].outcome,null);
  confirmed(call('verify',ledger));const resumed=call('execute',ledger,attempt.attemptId);assert.equal(resumed.status,0,resumed.stderr);assert.equal(rows(resumed)[0].type,'EXECUTING');assert.equal(read(ledger).attempts[0].status,'EVALUATED');
 }
});

test('external ledger replacement after staging is preserved rather than overwritten',()=>{
 const {ledger}=freeze('outside-writer'),hook=path('outside-writer.mjs');write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let first=true;fs.fsyncSync=fd=>{if(first&&fs.fstatSync(fd).isFile()){first=false;fs.writeFileSync("+JSON.stringify(ledger)+",'reviewed independent retained evidence');}return original(fd);};syncBuiltinESMExports();\n");
 const result=runHook(hook,['admit-train',ledger]);assert.equal(result.status,1);assert(!result.stdout.includes('"type":"ADMITTED"'));assert.equal(readFileSync(ledger,'utf8'),'reviewed independent retained evidence');
});

test('canonical private paths reject relative paths, checkout files, ancestor links, links, broad permissions, FIFOs and unsafe lock files',()=>{
 const input=path('safe.json');write(input,example.admission);const alias=path('input-link.json');symlinkSync(input,alias);assert.equal(call('freeze',alias,path('never.json')).status,1);
 const hard=path('input-hard.json');linkSync(input,hard);assert.equal(call('freeze',hard,path('never.json')).status,1);rmSync(hard);
 const broad=path('input-broad.json');write(broad,example.admission);chmodSync(broad,0o644);assert.equal(call('freeze',broad,path('never.json')).status,1);
 const fifo=path('input-fifo');assert.equal(spawnSync('mkfifo',[fifo]).status,0);assert.equal(call('freeze',fifo,path('never.json')).status,1);
 const parentLink=path('directory-link');symlinkSync(directory,parentLink,'dir');assert.equal(call('freeze',join(parentLink,input.slice(dirname(input).length+1)),path('never.json')).status,1);
 assert.equal(call('freeze',input,'relative-ledger.json').status,1);assert.equal(call('freeze',input,join(root,'never-program-search-ledger.json')).status,1);assert(!existsSync(join(root,'never-program-search-ledger.json')));
 const {ledger}=freeze('linked-ledger'),bytes=readFileSync(ledger),linked=path('ledger-link.json');symlinkSync(ledger,linked);for(const command of ['verify','train','recover'])assert.equal(call(command,linked).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const destination=path('unsafe-lock.json');symlinkSync(ledger,destination+'.lock');assert.equal(call('freeze',input,destination).status,1);assert(!existsSync(destination));const broadLock=path('broad-lock.json');write(broadLock+'.lock','');chmodSync(broadLock+'.lock',0o644);assert.equal(call('freeze',input,broadLock).status,1);assert(!existsSync(broadLock));
});

test('duplicate fields, BOM, malformed UTF8, oversized inputs and credential/authority fields refuse without disclosure',()=>{
 const badValues=[Buffer.from([239,187,191,...Buffer.from('{}')]),Buffer.from([123,34,255,34,125]),'{"version":1,"version":1,"secret":"never-echo-private-fixture"}',JSON.stringify({...example.admission,hypothesis:'og_local_owner_never_echo_private'}),JSON.stringify({...example.admission,providerUrl:'https://synthetic.invalid',command:'never-echo-private-fixture'}),' '.repeat(m.programSearchLimits.admissionBytes+1)];
 for(const value of badValues){const input=path('bad.json'),ledger=path('no-output.json');write(input,value);const result=call('freeze',input,ledger);assert.equal(result.status,1);assert(!existsSync(ledger));assert(!(result.stdout+result.stderr).includes('never-echo'));assert(!(result.stdout+result.stderr).includes(directory));}
 const oversized=path('oversized-ledger.json'),fd=openSync(oversized,'wx',0o600);try{ftruncateSync(fd,m.programSearchLimits.ledgerBytes+1);}finally{closeSync(fd);}assert.equal(call('verify',oversized).status,1);assert.equal(statSync(oversized).size,m.programSearchLimits.ledgerBytes+1);assert.equal(call('execute',oversized,'--eval').status,1);
});

test('each physical program pin and both trading pins refuse stale source before admission',()=>{
 const fixture=clonedCheckout(),cli=join(fixture,'scripts/program-search.mjs'),input=path('pins-input.json');write(input,example.admission);
 for(const file of [...Object.values(programFingerprintFiles),'app/demo-engine.ts','app/reference-engine.ts']){
  const source=join(fixture,file),original=readFileSync(source);writeFileSync(source,Buffer.concat([original,Buffer.from('\n// reviewed synthetic physical fingerprint change\n')]));const ledger=path('pin-refused.json'),result=runHook(pathForNoHook(),['freeze',input,ledger],cli);writeFileSync(source,original);assert.equal(result.status,1);assert(!existsSync(ledger));assert(!result.stdout.includes('"type":"FROZEN"'));
 }
 function pathForNoHook(){const hook=path('empty-hook.mjs');write(hook,'// Reviewed first-party empty test hook.\n');return hook;}
});

test('a changed compiled dependency outside the nine program pins blocks execution after original durable admission',()=>{
 const fixture=clonedCheckout(),input=path('graph-input.json'),ledger=path('graph-ledger.json');write(input,example.admission);
 const empty=path('empty.mjs');write(empty,'// Reviewed first-party test hook.\n');const cli=join(fixture,'scripts/program-search.mjs');assert.equal(runHook(empty,['freeze',input,ledger],cli).status,0);
 const hook=path('changed-graph.mjs');write(hook,"import fs from 'node:fs';const original=process.stdout.write.bind(process.stdout);process.stdout.write=(chunk,callback)=>{if(String(chunk).includes('\\\"type\\\":\\\"ADMITTED\\\"'))fs.appendFileSync("+JSON.stringify(join(fixture,'app/program-search-protocol.ts'))+",'\\n// Reviewed compiled graph mutation after durable admission.\\n');return original(chunk,callback);};\n");
 const result=runHook(hook,['train',ledger],cli);assert.equal(result.status,1);assert(result.stdout.includes('"type":"ADMITTED"'));assert(!result.stdout.includes('"type":"RETAINED"'));const pending=read(ledger).attempts[0];assert.equal(pending.status,'RUNNING');assert.equal(pending.outcome,null);
});

test('TEST file replacement during admitted operation cannot alter its frozen input or yield a terminal result',()=>{
 const {ledger}=freeze('test-file-drift');for(let n=0;n<example.admission.candidates.length;n++)assert([0,2].includes(call('train',ledger).status));confirmed(call('lock',ledger));const testInput=path('test-file.json');write(testInput,example.testInput);const hook=path('test-file-drift.mjs');write(hook,"import fs from 'node:fs';const original=process.stdout.write.bind(process.stdout);process.stdout.write=(chunk,callback)=>{if(String(chunk).includes('\\\"type\\\":\\\"ADMITTED\\\"'))fs.writeFileSync("+JSON.stringify(testInput)+",'reviewed changed TEST file');return original(chunk,callback);};\n");
 const result=runHook(hook,['test',testInput,ledger]);assert.equal(result.status,1);assert(!result.stdout.includes('"type":"RETAINED"'));const pending=read(ledger).attempts.at(-1);assert.equal(pending.phase,'TEST');assert.equal(pending.status,'RUNNING');assert.deepEqual(pending.input.dataset,example.testInput.dataset);confirmed(call('recover',ledger));assert.equal(read(ledger).attempts.at(-1).status,'INTERRUPTED');
});

test('actual trap and fuel exhaustion preserve whole failed outputs, true fuel and matching reconstruction without selection',async()=>{
 const admission=structuredClone(example.admission);
 for(const [n,bytes]of [trapProgram(),infiniteProgram()].entries()){
  const source=admission.candidates[n].source,bytesHex=moduleHex(bytes);source.record.content.program={...source.record.content.program,bytesHex,digest:await m.programBinaryDigest(bytesHex),parameters:[]};const canonical=m.boundedStrategyRecord(source.record);source.record=canonical.record;source.digest=await m.strategyDigest(canonical.payload);
 }
 const {ledger}=freeze('adverse-generator',admission);
 for(let n=0;n<admission.candidates.length;n++){const result=call('train',ledger);assert.equal(result.status,2,result.stderr);assert.equal(rows(result).at(-1).outcomeStatus,'FAILED');}
 const retained=read(ledger);assert.deepEqual(retained.attempts.map(attempt=>attempt.outcome.reason),['PROGRAM_TRAP','FUEL_LIMIT']);
 for(const attempt of retained.attempts){assert.equal(attempt.status,'EVALUATED');assert(attempt.outcome.totalFuel>0);assert.equal(attempt.outcome.trace.at(-1).status,'FAILED');assert.equal(attempt.outcome.artifact,null);assert.deepEqual(attempt.outcome,attempt.reconstruction);assert.equal(attempt.generatorComparison.status,'MATCH');assert.equal(attempt.outcome.qualification,'NONE');}
 assert.equal(confirmed(call('lock',ledger))[0].decision,'NO_SELECTION');assert(read(ledger).selection.ranking.every(row=>row.reasons.includes('PROGRAM_STATUS')));confirmed(call('verify',ledger));
});

test('actual advisory lock remains held by its parent descriptor after helper death',async()=>{
 const {ledger}=freeze('surviving-lock'),original=readFileSync(ledger),fd=openSync(ledger+'.lock','r+'),helper=spawn('python3',[resolve(root,'scripts/session-file-lock.py')],{env,stdio:['pipe','pipe','ignore',fd]});
 try{
  await new Promise((resolve,reject)=>{let message='';const timer=setTimeout(()=>reject(Error('Reviewed lock admission timeout')),5000);helper.once('error',error=>{clearTimeout(timer);reject(error);});helper.stdout.on('data',bytes=>{message+=bytes;if(message.includes('\n')){clearTimeout(timer);message==='LOCKED\n'?resolve():reject(Error('Reviewed lock unavailable'));}});});
  assert.equal(call('admit-train',ledger).status,1);assert.deepEqual(readFileSync(ledger),original);const closed=new Promise(resolve=>helper.once('close',resolve));helper.kill('SIGKILL');await closed;assert.equal(call('admit-train',ledger).status,1);assert.deepEqual(readFileSync(ledger),original);
 }finally{helper.stdin.end();helper.kill();closeSync(fd);}
 confirmed(call('admit-train',ledger));assert.equal(read(ledger).attempts.length,1);
});

test('relocated parent descriptors cannot redirect admission into a replacement directory',()=>{
 const {input}=freeze('parent-input'),parent=path('ledger-parent');mkdirSync(parent,{mode:0o700});const ledger=join(parent,'ledger.json');confirmed(call('freeze',input,ledger));const original=readFileSync(ledger),moved=parent+'-retained',hook=path('parent-relocation.mjs');
 write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let relocated=false;fs.fsyncSync=fd=>{original(fd);if(!relocated&&fs.fstatSync(fd).isFile()){relocated=true;fs.renameSync("+JSON.stringify(parent)+","+JSON.stringify(moved)+");fs.mkdirSync("+JSON.stringify(parent)+",{mode:0o700});fs.writeFileSync("+JSON.stringify(ledger)+",'reviewed replacement directory evidence',{mode:0o600});}};syncBuiltinESMExports();\n");
 const result=runHook(hook,['train',ledger]);assert.equal(result.status,1);assert(!result.stdout.includes('"type":"ADMITTED"'));assert.equal(readFileSync(ledger,'utf8'),'reviewed replacement directory evidence');assert.deepEqual(readFileSync(join(moved,'ledger.json')),original);
});

test('trusted dependency change after actual generator output prevents terminal publication and preserves original pending recovery',()=>{
 const fixture=clonedCheckout(),cli=join(fixture,'scripts/program-search.mjs'),input=path('post-run-input.json'),ledger=path('post-run-ledger.json'),empty=path('empty-post-run.mjs');write(input,example.admission);write(empty,'// Reviewed first-party test hook.\n');assert.equal(runHook(empty,['freeze',input,ledger],cli).status,0);
 const hook=path('post-generation-graph.mjs'),marker=path('generated-marker.txt');write(hook,"import fs from 'node:fs';const original=crypto.subtle.digest.bind(crypto.subtle);let changed=false;crypto.subtle.digest=async(name,bytes)=>{const result=await original(name,bytes),text=new TextDecoder().decode(bytes);if(!changed&&text.includes('\\\"kind\\\":\\\"LOCAL_PROGRAM_RUN_OUTCOME\\\"')&&text.includes('\\\"status\\\":\\\"COMPLETED\\\"')){changed=true;fs.appendFileSync("+JSON.stringify(join(fixture,'app/program-search-protocol.ts'))+",'\\n// Reviewed dependency change after actual generated outcome.\\n');fs.writeFileSync("+JSON.stringify(marker)+",'first-party generated outcome observed',{mode:0o600});}return result;};\n");
 const result=runHook(hook,['train',ledger],cli);assert.equal(result.status,1);assert(existsSync(marker));assert(result.stdout.includes('"type":"ADMITTED"'));assert(!result.stdout.includes('"type":"RETAINED"'));assert.equal(read(ledger).attempts[0].status,'RUNNING');assert.equal(read(ledger).attempts[0].outcome,null);
 // A new process may verify/recover the original pending identity with the now
 // reviewed fixed source; it never installs the vanished transient outcome.
 assert.equal(runHook(empty,['recover',ledger],cli).status,0);assert.equal(read(ledger).attempts[0].reason,'RECOVERY_INTERRUPTED');
});
