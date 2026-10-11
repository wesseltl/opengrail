import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync,linkSync,openSync,closeSync,statSync,chmodSync,ftruncateSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
let directory,m,example;
const path=name=>join(directory,name),read=file=>JSON.parse(readFileSync(file,'utf8'));
const call=(...args)=>spawnSync(process.execPath,['scripts/search-strategies.mjs',...args],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:30000});
const rows=result=>result.stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const write=(file,value)=>writeFileSync(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value),{flag:'wx',mode:0o600});
function confirmed(result){assert.equal(result.status,0,result.stderr);return rows(result);}
function freeze(name,admission=example.admission){const input=path(name+'-admission.json'),ledger=path(name+'-ledger.json');write(input,admission);confirmed(call('freeze',input,ledger));return {input,ledger};}
function child(...args){return spawn(process.execPath,['scripts/search-strategies.mjs',...args],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});}
async function collect(process){let stdout='',stderr='';process.stdout.on('data',chunk=>stdout+=chunk);process.stderr.on('data',chunk=>stderr+=chunk);const ended=await new Promise((resolve,reject)=>{process.on('error',reject);process.on('close',(status,signal)=>resolve({status,signal}));});return {...ended,stdout,stderr};}
before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-search-cli-'));
 const bundle=await build({stdin:{contents:"export * from './app/search-protocol';export {syntheticSearchExample} from './app/search-example';export {boundedStrategyRecord,strategyDigest} from './app/strategy-model';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',target:'es2022',logLevel:'silent'}),module={exports:{}};
 new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);m=module.exports;example=await m.syntheticSearchExample();write(path('test.json'),example.testInput);
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('actual multi-candidate process workflow retains all TRAIN results and a locked winner that loses its sole TEST',async()=>{
 const admission=structuredClone(example.admission),source=admission.candidates[1].source;
 // An actual no-trade candidate must remain visible in the training history.
 source.record.content.definition.entry={type:'RSI',period:10,threshold:99,comparison:'BELOW'};
 const canonical=m.boundedStrategyRecord(source.record);source.record=canonical.record;source.digest=await m.strategyDigest(canonical.payload);
 const {ledger}=freeze('workflow',admission),frozen=read(ledger);assert.equal(frozen.attempts.length,0);assert.equal(frozen.selection,null);assert.equal(statSync(ledger).mode&0o777,0o600);
 const first=confirmed(call('train',ledger));assert.equal(first[0].type,'ADMITTED');assert.equal(first[1].type,'RETAINED');assert.equal(first[0].phase,'TRAIN');assert.equal(first[1].comparisonStatus,'MATCH');
 const second=call('train',ledger);assert([0,2].includes(second.status),second.stderr);assert.equal(rows(second)[1].artifactStatus,'NO_TRADES');
 const trained=read(ledger);assert.equal(trained.attempts.length,2);assert.deepEqual(trained.attempts.map(value=>value.candidateId),admission.candidates.map(value=>value.source.id));assert(trained.attempts.every(value=>value.status==='EVALUATED'));assert(trained.attempts[0].artifact.metrics.returnPct>0);assert.equal(trained.attempts[1].artifact.metrics.trades,0);assert.equal(trained.attempts[1].artifact.status,'NO_TRADES');
 const locked=confirmed(call('lock',ledger));assert.equal(locked[0].type,'SELECTION_LOCKED');assert.equal(locked[0].decision,'SELECTED');const selection=read(ledger).selection;assert.equal(selection.selectedCandidateId,admission.candidates[0].source.id);
 const training=read(ledger).attempts.map(value=>JSON.stringify(value));const tested=confirmed(call('test',path('test.json'),ledger));assert.equal(tested[0].phase,'TEST');assert.equal(tested[1].type,'RETAINED');
 const final=read(ledger);assert.deepEqual(final.selection,selection);assert.deepEqual(final.attempts.slice(0,2).map(value=>JSON.stringify(value)),training);assert.equal(final.attempts.length,3);assert(final.attempts[2].artifact.metrics.returnPct<0);assert.equal(final.attempts[2].comparison.status,'MATCH');assert.equal(final.attempts[2].candidateId,selection.selectedCandidateId);assert.equal(final.qualification,'NONE');assert.equal(final.unseen,'NOT_ESTABLISHED');
 const bytes=readFileSync(ledger);assert.equal(call('test',path('test.json'),ledger).status,1);assert.equal(call('admit-test',path('test.json'),ledger).status,1);assert.equal(call('execute',ledger,final.attempts[2].attemptId).status,1);assert.equal(call('train',ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const checked=confirmed(call('verify',ledger));assert.equal(checked[0].type,'IDENTITY_CHECKED');assert.equal(checked[0].executionReconstructed,false);assert.equal(checked[0].submitted,false);
 assert(!(first.concat(rows(second),locked,tested,checked).map(value=>JSON.stringify(value)).join('\n')).includes(directory));
});

test('early selection or TEST and changed TEST data are refused without mutation; frozen thresholds cannot be retuned',()=>{
 const {ledger}=freeze('gates'),before=readFileSync(ledger);assert.equal(call('lock',ledger).status,1);assert.equal(call('test',path('test.json'),ledger).status,1);assert.equal(call('admit-test',path('test.json'),ledger).status,1);assert.deepEqual(readFileSync(ledger),before);
 confirmed(call('train',ledger));const one=readFileSync(ledger);assert.equal(call('lock',ledger).status,1);assert.deepEqual(readFileSync(ledger),one);confirmed(call('train',ledger));confirmed(call('lock',ledger));
 const good=readFileSync(ledger),wrong=structuredClone(example.testInput);wrong.dataset.id=crypto.randomUUID();write(path('changed-test.json'),wrong);assert.equal(call('admit-test',path('changed-test.json'),ledger).status,1);assert.deepEqual(readFileSync(ledger),good);
 const drift=read(ledger);drift.plan.admission.selection.minReturnPct=-100;const altered=path('retuned-ledger.json');write(altered,drift);const bad=readFileSync(altered);assert.equal(call('verify',altered).status,1);assert.equal(call('train',altered).status,1);assert.deepEqual(readFileSync(altered),bad);
});

test('two-phase admission permits only the original pending ID and keeps terminal interruption rather than retrying it',()=>{
 const {ledger}=freeze('pending'),admitted=confirmed(call('admit-train',ledger)),pending=read(ledger);assert.equal(admitted[0].type,'ADMITTED');assert.equal(pending.attempts[0].status,'RUNNING');const id=pending.attempts[0].attemptId,bytes=readFileSync(ledger);
 assert.equal(call('train',ledger).status,1);assert.equal(call('admit-train',ledger).status,1);assert.equal(call('execute',ledger,crypto.randomUUID()).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const recovered=confirmed(call('recover',ledger));assert.equal(recovered[0].interruptedAttempts,1);const terminal=read(ledger);assert.equal(terminal.attempts[0].status,'INTERRUPTED');assert.equal(terminal.attempts[0].reason,'RECOVERY_INTERRUPTED');assert.deepEqual(terminal.attempts[0].input,pending.attempts[0].input);
 const after=readFileSync(ledger);assert.equal(call('execute',ledger,id).status,1);assert.equal(call('recover',ledger).status,0);assert.deepEqual(readFileSync(ledger),after);
 const next=confirmed(call('admit-train',ledger));assert.equal(next[0].candidateId,example.admission.candidates[1].source.id);const run=read(ledger).attempts[1],done=call('execute',ledger,run.attemptId);assert([0,2].includes(done.status),done.stderr);assert.equal(rows(done)[0].type,'EXECUTING');assert.equal(read(ledger).attempts[1].status,'EVALUATED');
});

test('TEST interruption consumes its only release and cannot replace the winner or dataset',()=>{
 const {ledger}=freeze('test-interruption');confirmed(call('train',ledger));confirmed(call('train',ledger));confirmed(call('lock',ledger));const choice=read(ledger).selection;
 confirmed(call('admit-test',path('test.json'),ledger));const admitted=read(ledger),id=admitted.attempts.at(-1).attemptId;assert.equal(admitted.attempts.at(-1).phase,'TEST');assert.equal(admitted.attempts.at(-1).status,'RUNNING');confirmed(call('recover',ledger));const ended=read(ledger);assert.equal(ended.attempts.at(-1).status,'INTERRUPTED');assert.deepEqual(ended.selection,choice);
 const bytes=readFileSync(ledger);for(const args of [['test',path('test.json'),ledger],['admit-test',path('test.json'),ledger],['execute',ledger,id],['lock',ledger]])assert.equal(call(...args).status,1);assert.deepEqual(readFileSync(ledger),bytes);
});

test('actual concurrent local processes admit only one TRAIN and new-file freeze never overwrites an existing ledger',async()=>{
 const {input,ledger}=freeze('concurrent'),results=await Promise.all([collect(child('admit-train',ledger)),collect(child('admit-train',ledger))]);assert.deepEqual(results.map(value=>value.status).sort(),[0,1]);assert.equal(read(ledger).attempts.length,1);assert.equal(read(ledger).attempts[0].status,'RUNNING');
 const bytes=readFileSync(ledger);assert.equal(call('freeze',input,ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const destination=path('concurrent-create.json'),creates=await Promise.all([collect(child('freeze',input,destination)),collect(child('freeze',input,destination))]);assert.deepEqual(creates.map(value=>value.status).sort(),[0,1]);assert.equal(read(destination).attempts.length,0);
});

test('actual process death after durable admission leaves an interrupted history for explicit recovery',async()=>{
 const {ledger}=freeze('crash'),process=child('train',ledger);let stdout='',stderr='',admitted=false;
 const ended=new Promise((resolve,reject)=>{process.on('error',reject);process.on('close',(code,signal)=>resolve({code,signal}));});process.stderr.on('data',chunk=>stderr+=chunk);process.stdout.on('data',chunk=>{stdout+=chunk;if(!admitted&&stdout.includes('"type":"ADMITTED"')){admitted=true;process.kill('SIGKILL');}});
 const timer=setTimeout(()=>process.kill('SIGKILL'),15000);const result=await ended;clearTimeout(timer);assert(admitted,stderr);assert.equal(result.signal,'SIGKILL');const pending=read(ledger);assert.equal(pending.attempts.length,1);assert.equal(pending.attempts[0].status,'RUNNING');
 confirmed(call('recover',ledger));assert.equal(read(ledger).attempts[0].status,'INTERRUPTED');assert.equal(read(ledger).attempts[0].reason,'RECOVERY_INTERRUPTED');assert.equal(read(ledger).attempts[0].attemptId,pending.attempts[0].attemptId);
});

test('an actual cooperative signal retains interruption with exit two and cannot retry its admitted TRAIN candidate',async()=>{
 const {ledger}=freeze('signal'),process=child('train',ledger);let stdout='',stderr='',admitted=false;
 const ended=new Promise((resolve,reject)=>{process.on('error',reject);process.on('close',(code,signal)=>resolve({code,signal}));});process.stderr.on('data',chunk=>stderr+=chunk);process.stdout.on('data',chunk=>{stdout+=chunk;if(!admitted&&stdout.includes('"type":"ADMITTED"')){admitted=true;process.kill('SIGTERM');}});
 const timer=setTimeout(()=>process.kill('SIGKILL'),15000),result=await ended;clearTimeout(timer);assert(admitted,stderr);assert.equal(result.code,2,stderr);assert.equal(result.signal,null);const retained=read(ledger),attempt=retained.attempts[0];assert.equal(attempt.status,'INTERRUPTED');assert.equal(attempt.reason,'USER_CANCELLED');assert.equal(rows({stdout}).at(-1).type,'RETAINED');
 const bytes=readFileSync(ledger);assert.equal(call('execute',ledger,attempt.attemptId).status,1);assert.deepEqual(readFileSync(ledger),bytes);const next=confirmed(call('admit-train',ledger));assert.equal(next[0].candidateId,example.admission.candidates[1].source.id);
});

test('a confirmed no-selection lock retains both ineligible results and permanently blocks TEST release',()=>{
 const admission=structuredClone(example.admission);admission.selection.minReturnPct=1000000;const {ledger}=freeze('no-selection',admission);confirmed(call('train',ledger));confirmed(call('train',ledger));const lock=confirmed(call('lock',ledger));assert.equal(lock[0].decision,'NO_SELECTION');assert.equal(lock[0].selectedCandidateId,null);const retained=read(ledger);assert.equal(retained.attempts.length,2);assert(retained.selection.ranking.every(value=>!value.eligible&&value.reasons.includes('RETURN_FLOOR')));
 const bytes=readFileSync(ledger);for(const args of [['test',path('test.json'),ledger],['admit-test',path('test.json'),ledger],['train',ledger],['lock',ledger]])assert.equal(call(...args).status,1);assert.deepEqual(readFileSync(ledger),bytes);confirmed(call('verify',ledger));
});

test('actual failed fixed computations retain uncapped adverse artifacts with exit two and cannot qualify a winner',async()=>{
 const admission=structuredClone(example.admission);
 for(const candidate of admission.candidates){const source=candidate.source;source.record.content.definition.market.direction='SHORT';source.record.content.definition.risk.positionPct=10;const canonical=m.boundedStrategyRecord(source.record);source.record=canonical.record;source.digest=await m.strategyDigest(canonical.payload);}
 admission.train.dataset.bars=admission.train.dataset.bars.map((bar,n)=>n<2?bar:{...bar,open:20000,high:20020,low:19980,close:20000});
 const {ledger}=freeze('failed-results',admission);for(let n=0;n<2;n++){const result=call('train',ledger);assert.equal(result.status,2,result.stderr);const output=rows(result);assert.equal(output[0].type,'ADMITTED');assert.equal(output[1].type,'RETAINED');assert.equal(output[1].artifactStatus,'FAILED');}
 const retained=read(ledger);assert(retained.attempts.every(value=>value.status==='EVALUATED'&&value.artifact.status==='FAILED'&&value.artifact.reason==='INSOLVENT'&&value.artifact.metrics.returnPct<0&&!value.artifact.metrics.comparable));const lock=confirmed(call('lock',ledger));assert.equal(lock[0].decision,'NO_SELECTION');const bytes=readFileSync(ledger);assert.equal(call('test',path('test.json'),ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);confirmed(call('verify',ledger));
});

test('unknown directory-sync acknowledgments retain exact freeze, admission and terminal files without automatic replacement',()=>{
 for(const phase of ['freeze','admission','terminal']){
  const hook=path(phase+'-sync-fault.mjs'),count=phase==='terminal'?4:2;
  write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let count=0;fs.fsyncSync=fd=>{if(++count==="+count+")throw Error('Synthetic local sync fault');return original(fd);};syncBuiltinESMExports();\n");
  const f=phase==='freeze'?{input:path('uncertain-freeze-admission.json'),ledger:path('uncertain-freeze-ledger.json')}:freeze('uncertain-'+phase);if(phase==='freeze')write(f.input,example.admission);
  const args=phase==='freeze'?['freeze',f.input,f.ledger]:['train',f.ledger],result=spawnSync(process.execPath,['--import',hook,'scripts/search-strategies.mjs',...args],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:30000});
  assert.equal(result.status,1);assert.match(result.stderr,/not confirmed/);assert(!result.stdout.includes('"type":"RETAINED"'));assert(!result.stdout.includes(directory));const saved=read(f.ledger);confirmed(call('verify',f.ledger));
  if(phase==='freeze'){assert(!result.stdout.includes('"type":"FROZEN"'));assert.equal(saved.attempts.length,0);const bytes=readFileSync(f.ledger);assert.equal(call('freeze',f.input,f.ledger).status,1);assert.deepEqual(readFileSync(f.ledger),bytes);}
  else if(phase==='admission'){assert(!result.stdout.includes('"type":"ADMITTED"'));assert.equal(saved.attempts[0].status,'RUNNING');const bytes=readFileSync(f.ledger);assert.equal(call('train',f.ledger).status,1);assert.deepEqual(readFileSync(f.ledger),bytes);confirmed(call('recover',f.ledger));}
  else{assert(result.stdout.includes('"type":"ADMITTED"'));assert.equal(saved.attempts[0].status,'EVALUATED');const bytes=readFileSync(f.ledger);assert.equal(call('execute',f.ledger,saved.attempts[0].attemptId).status,1);assert.deepEqual(readFileSync(f.ledger),bytes);}
 }
});

test('expected old-byte hash is rechecked after staging, preserving an independent writer rather than overwriting it',()=>{
 const {ledger}=freeze('outside-writer'),hook=path('outside-writer-hook.mjs');
 write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let count=0;fs.fsyncSync=fd=>{if(++count===1)fs.writeFileSync("+JSON.stringify(ledger)+",'synthetic independent retained evidence');return original(fd);};syncBuiltinESMExports();\n");
 const result=spawnSync(process.execPath,['--import',hook,'scripts/search-strategies.mjs','admit-train',ledger],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:30000});assert.equal(result.status,1);assert(!result.stdout.includes('"type":"ADMITTED"'));assert.equal(readFileSync(ledger,'utf8'),'synthetic independent retained evidence');assert(!result.stderr.includes(directory));
});

test('private regular single-link file policy rejects symlinks, hard links, broad permissions, FIFOs and unsafe locks',()=>{
 const input=path('safe-file-admission.json');write(input,example.admission);
 const symlink=path('symlink-admission.json');symlinkSync(input,symlink);assert.equal(call('freeze',symlink,path('symlink-input-ledger.json')).status,1);
 const hard=path('hard-admission.json');linkSync(input,hard);assert.equal(call('freeze',hard,path('hard-input-ledger.json')).status,1);
 const broad=path('broad-admission.json');write(broad,example.admission);chmodSync(broad,0o644);assert.equal(call('freeze',broad,path('broad-input-ledger.json')).status,1);
 const fifo=path('input-fifo');assert.equal(spawnSync('mkfifo',[fifo]).status,0);assert.equal(call('freeze',fifo,path('fifo-ledger.json')).status,1);
 const {input:good,ledger}=freeze('unsafe-dest'),saved=readFileSync(ledger),linked=path('linked-ledger.json');symlinkSync(ledger,linked);for(const command of ['verify','train','recover'])assert.equal(call(command,linked).status,1);assert.deepEqual(readFileSync(ledger),saved);
 const newLink=path('existing-output-link.json');symlinkSync(ledger,newLink);assert.equal(call('freeze',good,newLink).status,1);assert.deepEqual(readFileSync(ledger),saved);
 const blocked=path('blocked-lock-ledger.json');symlinkSync(ledger,blocked+'.lock');assert.equal(call('freeze',good,blocked).status,1);assert(!existsSync(blocked));assert.deepEqual(readFileSync(ledger),saved);
 const broadLock=path('broad-lock-ledger.json');write(broadLock+'.lock','');chmodSync(broadLock+'.lock',0o644);assert.equal(call('freeze',good,broadLock).status,1);assert(!existsSync(broadLock));
});

test('an actual external advisory lock and its surviving parent descriptor prevent mutation',async()=>{
 const {ledger}=freeze('external-lock'),bytes=readFileSync(ledger),fd=openSync(ledger+'.lock','r+'),helper=spawn('python3',['scripts/session-file-lock.py'],{stdio:['pipe','pipe','ignore',fd]});
 try{
  await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Synthetic lock timeout')),5000);helper.on('error',reject);helper.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n')){clearTimeout(timer);output==='LOCKED\n'?resolve():reject(Error('Synthetic lock unavailable'));}});});
  assert.equal(call('admit-train',ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);helper.kill('SIGKILL');await new Promise(resolve=>helper.on('close',resolve));assert.equal(call('admit-train',ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 }finally{helper.stdin.end();helper.kill();closeSync(fd);}
 confirmed(call('admit-train',ledger));assert.equal(read(ledger).attempts.length,1);
});

test('malformed UTF-8, duplicate or deep JSON, unsafe text and excessive byte capacity fail without credential or path diagnostics',()=>{
 const values=[['utf8',Buffer.from([123,34,255,34,125])],['duplicate','{"version":1,"version":1,"private":"never-echo-synthetic-private"}'],['deep','['.repeat(30)+'0'+']'.repeat(30)],['credential',JSON.stringify({...example.admission,hypothesis:'og_local_owner_synthetic_private'})],['large','never-echo-synthetic-private'+' '.repeat(m.searchLimits.admissionBytes)]];
 for(const [name,value]of values){const input=path(name+'-bad-admission.json'),ledger=path(name+'-bad-ledger.json');write(input,value);const result=call('freeze',input,ledger);assert.equal(result.status,1);assert(!existsSync(ledger));assert(!(result.stdout+result.stderr).includes('never-echo'));assert(!(result.stdout+result.stderr).includes('og_local_owner'));assert(!(result.stdout+result.stderr).includes(directory));}
 const oversized=path('oversized-ledger.json'),fd=openSync(oversized,'wx',0o600);try{ftruncateSync(fd,m.searchLimits.ledgerBytes+1);}finally{closeSync(fd);}const before=statSync(oversized).size;assert.equal(call('verify',oversized).status,1);assert.equal(call('train',oversized).status,1);assert.equal(statSync(oversized).size,before);
});

test('fixed source mismatch refuses before import; unsupported provider and executable options are never accepted',()=>{
 const input=path('source-check-admission.json'),ledger=path('source-check-ledger.json'),hook=path('source-check-hook.mjs');write(input,example.admission);
 write(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;fs.readFileSync=(file,...rest)=>String(file).endsWith('/app/demo-engine.ts')?Buffer.from('synthetic changed fixed source'):original(file,...rest);syncBuiltinESMExports();\n");
 const result=spawnSync(process.execPath,['--import',hook,'scripts/search-strategies.mjs','freeze',input,ledger],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:30000});assert.equal(result.status,1);assert(!existsSync(ledger));assert(!result.stderr.includes(directory));
 for(const args of [['trade','file'],['train','input','--provider=untrusted'],['freeze','input'],['execute','input','id','--evaluator=untrusted.mjs'],['verify','input','extra']]){const result=call(...args);assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);}
});
