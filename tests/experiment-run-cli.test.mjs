import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync,openSync,closeSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
let directory;const path=name=>join(directory,name);
const call=(...args)=>spawnSync(process.execPath,['scripts/run-experiment.mjs',...args],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:20000});
const rows=result=>result.stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
function bundle(name){const manifest=JSON.parse(readFileSync('examples/experiments/'+name+'-current-manifest.json','utf8')).item,record=manifest.record.content.input.strategy.record;
 return {version:1,manifest,source:{id:record.id,digest:manifest.strategy.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:{kind:record.author.kind,id:record.author.id,sponsorId:record.author.sponsorId},state:'VISIBLE',reason:null,record,moderation:[]}};
}
before(()=>{directory=mkdtempSync(join(tmpdir(),'opengrail-experiment-cli-'));for(const name of ['signal','insolvency'])writeFileSync(path(name+'-bundle.json'),JSON.stringify(bundle(name)),{flag:'wx'});});
after(()=>rmSync(directory,{recursive:true,force:true}));

test('actual CLI records admission before an adverse run, keeps both fixed evaluations and stable unsubmitted public drafts',()=>{
 const ledger=path('negative-ledger.json'),result=call('run',path('signal-bundle.json'),ledger);assert.equal(result.status,0,result.stderr);
 const output=rows(result);assert.equal(output[0].type,'ADMITTED');assert.equal(output[0].sourceAuthentication,'OFFLINE_SNAPSHOT_UNVERIFIED');assert.equal(output[1].type,'RETAINED');assert.equal(output[1].publicationSubmitted,false);
 const saved=JSON.parse(readFileSync(ledger,'utf8'));assert.equal(saved.events[0].type,'ADMITTED');assert.equal(saved.events[1].type,'FINISHED');assert.equal(saved.entries[0].admission.status,'RUNNING');assert(saved.entries[0].outcome.artifact.metrics.netPnl<0);assert.equal(saved.entries[0].outcome.comparison.status,'MATCH');assert.equal(saved.qualification,'NONE');
 const id=saved.entries[0].admission.attemptId,one=path('draft-one.json'),two=path('draft-two.json');
 assert.equal(call('prepare',ledger,id,one).status,1);assert(!existsSync(one));
 for(const file of [one,two]){const prepared=call('prepare',ledger,id,file,'--confirm-public-sharing');assert.equal(prepared.status,0,prepared.stderr);assert.equal(rows(prepared)[0].submitted,false);}
 assert.equal(readFileSync(one,'utf8'),readFileSync(two,'utf8'));const command=JSON.parse(readFileSync(one,'utf8'));assert.equal(command.claim.type,'ORIGINAL');assert.equal(command.claim.relation,null);assert.equal(command.requestId,saved.entries[0].admission.outcomeRequestId);
 const prior=readFileSync(one);assert.equal(call('prepare',ledger,id,one,'--confirm-public-sharing').status,1);assert.deepEqual(readFileSync(one),prior);
 const checked=call('verify',ledger);assert.equal(checked.status,0,checked.stderr);assert.equal(rows(checked)[0].executionReconstructed,false);
});
test('insolvency is retained without clipping loss or promoting a matching failed result into qualification',()=>{
 const ledger=path('insolvency-ledger.json'),result=call('run',path('insolvency-bundle.json'),ledger);assert.equal(result.status,2,result.stderr);
 const run=JSON.parse(readFileSync(ledger,'utf8')).entries[0].outcome;assert.equal(run.artifact.status,'FAILED');assert.equal(run.artifact.reason,'INSOLVENT');assert(run.artifact.metrics.netPnl<0);assert.equal(run.comparison.status,'MATCH');assert.equal(run.qualification,'NONE');
});
test('two-phase agent admission durably preserves pending work; explicit recovery keeps interruption rather than rerunning it',()=>{
 const ledger=path('recover-ledger.json'),result=call('admit',path('signal-bundle.json'),ledger);assert.equal(result.status,0,result.stderr);const saved=JSON.parse(readFileSync(ledger,'utf8')),id=saved.entries[0].admission.attemptId,bytes=readFileSync(ledger);
 assert.equal(saved.entries[0].outcome,null);assert.equal(call('run',path('signal-bundle.json'),ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const recovered=call('recover',ledger);assert.equal(recovered.status,0,recovered.stderr);assert.equal(rows(recovered)[0].interruptedAttempts,1);
 const history=JSON.parse(readFileSync(ledger,'utf8'));assert.equal(history.entries[0].outcome.status,'INTERRUPTED');assert.equal(history.entries[0].outcome.reason,'RECOVERY_INTERRUPTED');assert.deepEqual(history.entries[0].admission,saved.entries[0].admission);
 const after=readFileSync(ledger);assert.equal(call('execute',ledger,id).status,1);assert.deepEqual(readFileSync(ledger),after);assert.equal(call('recover',ledger).status,0);assert.deepEqual(readFileSync(ledger),after);
});
test('an agent can explicitly execute only the exact retained pending ID, leaving the original admission intact',()=>{
 const ledger=path('execute-ledger.json');assert.equal(call('admit',path('signal-bundle.json'),ledger).status,0);const admitted=JSON.parse(readFileSync(ledger,'utf8')),id=admitted.entries[0].admission.attemptId,bytes=readFileSync(ledger);
 assert.equal(call('execute',ledger,'00000000-0000-4000-8000-000000000001').status,1);assert.deepEqual(readFileSync(ledger),bytes);
 const result=call('execute',ledger,id);assert.equal(result.status,0,result.stderr);const finished=JSON.parse(readFileSync(ledger,'utf8'));assert.deepEqual(finished.entries[0].admission,admitted.entries[0].admission);assert.equal(finished.entries[0].outcome.status,'EVALUATED');
 assert.equal(call('execute',ledger,id).status,1);
});
test('an actual process crash after confirmed admission preserves a recoverable pending trial',async()=>{
 const ledger=path('crash-ledger.json'),child=spawn(process.execPath,['scripts/run-experiment.mjs','run',path('signal-bundle.json'),ledger],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',admitted=false;
 const ended=new Promise(resolve=>child.on('close',(code,signal)=>resolve({code,signal})));
 child.stderr.on('data',chunk=>stderr+=chunk);
 child.stdout.on('data',chunk=>{stdout+=chunk;if(!admitted&&stdout.includes('"type":"ADMITTED"')){admitted=true;child.kill('SIGKILL');}});
 const timer=setTimeout(()=>child.kill('SIGKILL'),10000);const result=await ended;clearTimeout(timer);
 assert(admitted,stderr);assert.equal(result.signal,'SIGKILL');const saved=JSON.parse(readFileSync(ledger,'utf8'));assert.equal(saved.entries.length,1);assert.equal(saved.entries[0].outcome,null);assert.equal(saved.events[0].type,'ADMITTED');
 const recovered=call('recover',ledger);assert.equal(recovered.status,0,recovered.stderr);assert.equal(JSON.parse(readFileSync(ledger,'utf8')).entries[0].outcome.reason,'RECOVERY_INTERRUPTED');
});
test('faults after atomic persistence report no confirmation and leave evidence available for reconciliation',()=>{
 for(const [phase,count] of [['admission',2],['terminal',4]]){
  const injection=path(phase+'-fsync-fault.mjs'),ledger=path(phase+'-fault-ledger.json');
  writeFileSync(injection,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let calls=0;fs.fsyncSync=(fd)=>{if(++calls==="+count+")throw Object.assign(Error('Synthetic local durability fault'),{code:'EIO'});return original(fd);};syncBuiltinESMExports();\n");
  const result=spawnSync(process.execPath,['--import',injection,'scripts/run-experiment.mjs','run',path('signal-bundle.json'),ledger],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:20000});
  assert.equal(result.status,1);assert.match(result.stderr,/not confirmed/);assert(!result.stdout.includes('"type":"RETAINED"'));
  const saved=JSON.parse(readFileSync(ledger,'utf8'));assert.equal(saved.entries.length,1);assert.equal(call('verify',ledger).status,0);
  if(phase==='admission'){assert(!result.stdout.includes('"type":"ADMITTED"'));assert.equal(saved.entries[0].outcome,null);assert.equal(call('recover',ledger).status,0);assert.equal(JSON.parse(readFileSync(ledger,'utf8')).entries[0].outcome.reason,'RECOVERY_INTERRUPTED');}
  else{assert(result.stdout.includes('"type":"ADMITTED"'));assert.equal(saved.entries[0].outcome.status,'EVALUATED');const bytes=readFileSync(ledger);assert.equal(call('execute',ledger,saved.entries[0].admission.attemptId).status,1);assert.deepEqual(readFileSync(ledger),bytes);}
 }
});
test('malformed UTF-8, duplicate keys, false source declarations and oversized bodies produce safe retained rejection entries',()=>{
 const changed=bundle('signal');changed.manifest.record.content.evaluator.sourceDigest='a'.repeat(64);
 const candidates=[['utf8',Buffer.from([123,34,255,34,125])],['duplicate',Buffer.from('{"version":1,"version":1,"secret":"never-retain-private-runner-text"}')],['source',Buffer.from(JSON.stringify(changed))],['large',Buffer.from('never-retain-private-runner-text'+' '.repeat(393216))]];
 const ledger=path('rejections.json');
 for(const [name,bytes] of candidates){const input=path(name+'.json');writeFileSync(input,bytes);const result=call('run',input,ledger);assert.equal(result.status,2,result.stderr);assert.equal(rows(result)[0].type,'INPUT_REJECTED');assert(!(result.stdout+result.stderr).includes('never-retain'));}
 const retained=readFileSync(ledger,'utf8');assert(!retained.includes('never-retain'));const value=JSON.parse(retained);assert.equal(value.entries.length,4);assert(value.entries.every(v=>v.kind==='INPUT_REJECTION'));assert.equal(call('verify',ledger).status,0);
});
test('unsafe files and invalid ledgers fail promptly without overwriting existing evidence',()=>{
 const input=path('symlink-bundle');symlinkSync(path('signal-bundle.json'),input);const ledger=path('unsafe-input-ledger.json');assert.equal(call('run',input,ledger).status,2);assert.equal(JSON.parse(readFileSync(ledger,'utf8')).entries[0].bundleDigest,null);
 const retained=path('unchanged.json');writeFileSync(retained,'prior evidence');const symlink=path('linked-ledger.json');symlinkSync(retained,symlink);const hardlink=path('hardlinked-ledger.json');linkSync(retained,hardlink);
 for(const file of [retained,symlink,hardlink])assert.equal(call('run',path('signal-bundle.json'),file).status,1);assert.equal(readFileSync(retained,'utf8'),'prior evidence');
 const fifo=path('fifo');assert.equal(spawnSync('mkfifo',[fifo]).status,0);assert.equal(call('run',fifo,path('fifo-ledger.json')).status,2);
});
test('an actual external writer lock prevents ledger mutation; killing its helper does not release the parent descriptor',async()=>{
 const ledger=path('locked-ledger.json');assert.equal(call('admit',path('signal-bundle.json'),ledger).status,0);const bytes=readFileSync(ledger),fd=openSync(ledger+'.lock','r+');
 const helper=spawn('python3',['scripts/session-file-lock.py'],{stdio:['pipe','pipe','ignore',fd]});
 try{await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Lock timeout')),5000);helper.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n')){clearTimeout(timer);output==='LOCKED\n'?resolve():reject(Error('No lock'));}});helper.on('error',reject);});
  assert.equal(call('recover',ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
  helper.kill('SIGKILL');await new Promise(resolve=>helper.on('close',resolve));assert.equal(call('recover',ledger).status,1);assert.deepEqual(readFileSync(ledger),bytes);
 }finally{helper.stdin.end();helper.kill();closeSync(fd);}
 const result=call('recover',ledger);assert.equal(result.status,0,result.stderr);
});
test('unsupported commands, provider options and user-selected executables are never run',()=>{
 for(const args of [['trade','file'],['run','input'],['run','input','ledger','--evaluator=untrusted.js'],['deploy','file'],['verify','file','extra']]){const result=call(...args);assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);}
});
