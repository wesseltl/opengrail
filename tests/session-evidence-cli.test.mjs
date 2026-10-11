import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let directory,prepared;
const script='scripts/session-evidence.mjs',run=(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:30000,maxBuffer:65536});
before(()=>{directory=mkdtempSync(join(tmpdir(),'opengrail-evidence-cli-'));const path=join(directory,'open-review.json'),result=run('prepare','examples/sessions/20261011/signal-open.json',path);assert.equal(result.status,0,result.stderr);prepared=JSON.parse(readFileSync(path,'utf8'));});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('fixed CLI prepares a full open checkpoint and reconstructs it without changing its source journal',()=>{
 const input='examples/sessions/20261011/signal-open.json',hash=sha(readFileSync(input)),path=join(directory,'second-open-review.json'),result=run('prepare',input,path);assert.equal(result.status,0,result.stderr);
 const bundle=JSON.parse(readFileSync(path,'utf8')),journal=JSON.parse(readFileSync(input,'utf8'));
 assert.equal(bundle.kind,'LOCAL_CONTINUOUS_DEMO_REVIEW');assert.equal(bundle.input.journalDigest,journal.journalDigest);assert.deepEqual(bundle.input.events,journal.events);assert.equal(bundle.result.artifact.projection.openPositions.length,1);assert.equal(bundle.result.artifact.projection.trades.length,0);assert.equal(bundle.qualification,'NONE');assert.equal(sha(readFileSync(input)),hash);assert.equal(statSync(path).mode&0o777,0o600);
 const verified=run('verify',path);assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).status,'MATCH');assert.equal(JSON.parse(verified.stdout).sourceAuthentication,'UNKNOWN');assert.equal(JSON.parse(verified.stdout).published,false);
});
test('CLI preparation preserves pending protective exits and actual adverse completion instead of tail liquidation',()=>{
 for(const [name,status,open]of [['emergency-awaiting-quote.json','STOPPING',1],['emergency-adverse-exit.json','STOPPED',0]]){
  const path=join(directory,name),result=run('prepare','examples/sessions/20261011/'+name,path);assert.equal(result.status,0,result.stderr);const artifact=JSON.parse(readFileSync(path,'utf8')).result.artifact;
  assert.equal(artifact.projection.status,status);assert.equal(artifact.projection.openPositions.length,open);assert.equal(artifact.ordersEnabled,false);
  if(status==='STOPPED'){assert.equal(artifact.projection.trades[0].reason,'EMERGENCY_STOP');assert(artifact.projection.trades[0].netPnl<0);}
 }
});
test('current fixture generation preserves source-bound historical bytes and preparation retains their refusal',()=>{
 const historical=[
  ['signal-open','ee994a2973aeaa7c5c2c4a54426b72569bb2e3da0d1261b0651e30d690861576'],
  ['emergency-awaiting-quote','5b0e1bfc596df96f8c14c4a08cef479985993c8715437734133c43a7808b754c'],
  ['emergency-adverse-exit','98144bdf7c6ff2cee8c77f05574f48878ec7fb80df1177b8230a8569d2888997'],
 ];
 const current=historical.map(([name])=>['examples/sessions/20261011/'+name+'.json',sha(readFileSync('examples/sessions/20261011/'+name+'.json'))]);
 for(const [name,hash]of historical)assert.equal(sha(readFileSync('examples/sessions/'+name+'.json')),hash);
 const generated=spawnSync(process.execPath,['scripts/example-sessions.mjs'],{encoding:'utf8',timeout:30000,maxBuffer:65536});
 assert.equal(generated.status,0,generated.stderr);assert(generated.stdout.includes('examples/sessions/20261011/'));
 for(const [path,hash]of current)assert.equal(sha(readFileSync(path)),hash);
 for(const [name,hash]of historical){
  const input='examples/sessions/'+name+'.json',output=join(directory,'historical-'+name+'-refusal.json'),result=run('prepare',input,output);
  assert.equal(result.status,2,result.stderr);const receipt=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(receipt.kind,'LOCAL_CONTINUOUS_DEMO_PREPARATION_REJECTED');assert.equal(receipt.reason,'JOURNAL_RECONSTRUCTION_NOT_CONFIRMED');
  assert.equal(receipt.journalFileSha256,hash);assert.equal(receipt.originalJournalPreserved,true);assert.equal(receipt.publicInputPrepared,false);
  assert.equal(receipt.published,false);assert.equal(receipt.ordersEnabled,false);assert.equal(receipt.liveEnabled,false);
  assert.equal(sha(readFileSync(input)),hash);assert(!JSON.stringify(receipt).includes('"events"'));assert(!result.stdout.includes('MATCH'));
 }
});
test('a self-hashed false reported account fails semantic CLI review despite consistent artifact bytes',()=>{
 const artifact=structuredClone(prepared.result.artifact);artifact.projection.account.cash+=100;
 const {resultDigest,...body}=artifact;void resultDigest;artifact.resultDigest=sha(JSON.stringify(body));
 const path=join(directory,'false-account.json');writeFileSync(path,JSON.stringify(artifact));const result=run('verify',path);assert.equal(result.status,2,result.stderr);const review=JSON.parse(result.stdout);assert.equal(review.status,'MISMATCH');assert.equal(review.qualification,'NONE');assert(!result.stdout.includes('"cash"'));
});
test('failed preparation retains a bounded new refusal while preserving the complete original file',()=>{
 const journal=JSON.parse(readFileSync('examples/sessions/20261011/signal-open.json','utf8'));journal.events[0].stateDigest='1'.repeat(64);
 const input=join(directory,'corrupt-journal.json'),output=join(directory,'corrupt-refusal.json');writeFileSync(input,JSON.stringify(journal));const hash=sha(readFileSync(input)),result=run('prepare',input,output);assert.equal(result.status,2,result.stderr);
 const receipt=JSON.parse(readFileSync(output,'utf8'));assert.equal(receipt.kind,'LOCAL_CONTINUOUS_DEMO_PREPARATION_REJECTED');assert.equal(receipt.journalFileSha256,hash);assert.equal(receipt.publicInputPrepared,false);assert.equal(receipt.published,false);assert.equal(receipt.originalJournalPreserved,true);assert.equal(sha(readFileSync(input)),hash);assert(!JSON.stringify(receipt).includes('"events"'));
});
test('known local credentials in journal material cannot enter a prepared public bundle or diagnostic output',()=>{
 const token='og_local_owner_'+'a'.repeat(64),journal=JSON.parse(readFileSync('examples/sessions/20261011/signal-open.json','utf8'));journal.config.rights.note=token;
 const input=join(directory,'credential-journal.json'),output=join(directory,'credential-refusal.json');writeFileSync(input,JSON.stringify(journal));const result=run('prepare',input,output);assert.equal(result.status,2,result.stderr);assert(!(result.stdout+result.stderr+readFileSync(output,'utf8')).includes(token));assert.equal(JSON.parse(readFileSync(output,'utf8')).publicInputPrepared,false);
});
test('new-output semantics refuse both an existing result and a symlink without overwriting either target',()=>{
 const input='examples/sessions/20261011/signal-open.json',path=join(directory,'existing.json');writeFileSync(path,'retained prior evidence');const result=run('prepare',input,path);assert.equal(result.status,1);assert.equal(readFileSync(path,'utf8'),'retained prior evidence');
 const target=join(directory,'target.json'),link=join(directory,'link.json');writeFileSync(target,'private retained file');assert.equal(spawnSync('ln',['-s',target,link]).status,0);const linked=run('prepare',input,link);assert.equal(linked.status,1);assert.equal(readFileSync(target,'utf8'),'private retained file');
});
test('bounded regular-file intake rejects FIFOs and directories without waiting for a producer',()=>{
 const fifo=join(directory,'input.fifo');assert.equal(spawnSync('mkfifo',[fifo]).status,0);const result=run('verify',fifo);assert.equal(result.signal,null);assert.equal(result.status,1);
 const sub=join(directory,'not-a-file');mkdirSync(sub);assert.equal(run('verify',sub).status,1);
});
test('strict JSON and argument admission reject duplicate keys, invalid UTF8, oversized files and extra paths',()=>{
 for(const [name,bytes]of [['duplicates.json',Buffer.from('{"version":1,"version":2}')],['bad-utf8.json',Buffer.from([123,34,120,34,58,34,255,34,125])],['oversized.json',Buffer.alloc(786433,32)]]){
  const path=join(directory,name);writeFileSync(path,bytes);const result=run('verify',path);assert.equal(result.status,1);assert.equal(result.signal,null);assert(!result.stdout.includes('MATCH'));
 }
 const output=join(directory,'not-written.json');assert.equal(run('verify','examples/sessions/20261011/signal-open.json',output).status,1);assert(!existsSync(output));
});
