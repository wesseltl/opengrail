import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

let directory,input,artifact,example;
const command=(...args)=>spawnSync(process.execPath,['scripts/replay-demo.mjs',...args],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:30000});
const path=name=>join(directory,name);
before(()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-demo-cli-'));
 input=path('input.json');artifact=path('artifact.json');
 let result=command('example',input);assert.equal(result.status,0,result.stderr);example=JSON.parse(readFileSync(input,'utf8'));
 result=command('run',input,artifact);assert.equal(result.status,0,result.stderr);
});
after(()=>rmSync(directory,{recursive:true,force:true}));

test('CLI writes an explicit synthetic case and replays the same trusted engine without hosted compute',()=>{
 assert.equal(example.dataset.provenance,'SYNTHETIC');assert.equal(example.strategy.record.executionEnabled,false);
 const report=JSON.parse(readFileSync(artifact,'utf8'));
 assert.deepEqual(report.input,example);assert.equal(report.classification,'AUTHOR_REPORTED');
 const result=command('verify',artifact);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/same-implementation replay matched/);assert.match(result.stdout,/not independent qualification/);
});

test('verification rejects a changed result even when its retained input has not changed',()=>{
 const report=JSON.parse(readFileSync(artifact,'utf8'));report.status=report.status==='NO_TRADES'?'COMPLETED':'NO_TRADES';
 const file=path('changed-result.json');writeFileSync(file,JSON.stringify(report));
 const result=command('verify',file);assert.notEqual(result.status,0);assert(!result.stdout.includes('replay matched'));
});

test('verification rejects substituted cost assumptions and an extra self-qualification field',()=>{
 for(const [name,change] of [['costs',r=>{r.input.strategy.record.content.definition.costs.feeBps+=1;}],['qualification',r=>{r.independentlyVerified=true;}]]){
  const report=JSON.parse(readFileSync(artifact,'utf8'));change(report);const file=path(name+'.json');writeFileSync(file,JSON.stringify(report));
  const result=command('verify',file);assert.notEqual(result.status,0);assert(!result.stdout.includes('replay matched'));
 }
});

test('running another trial cannot overwrite a prior artifact',()=>{
 const previous=readFileSync(artifact,'utf8'),result=command('run',input,artifact);
 assert.equal(result.status,1);assert.equal(readFileSync(artifact,'utf8'),previous);assert.match(result.stderr,/new output filename/);
});

test('duplicate-key and malformed UTF-8 attempts retain safe rejections without copying arbitrary input',()=>{
 for(const [name,bytes] of [['duplicates',Buffer.from('{"version":1,"version":2,"secret":"never-echo-private-material"}')],['utf8',Buffer.from([0x7b,0x22,0xff,0x22,0x7d])]]){
  const file=path(name+'.json'),out=path(name+'-rejection.json');writeFileSync(file,bytes);
  const result=command('run',file,out);assert.equal(result.status,2,result.stderr);
  const text=readFileSync(out,'utf8'),rejection=JSON.parse(text);assert.equal(rejection.kind,'REPLAY_INPUT_REJECTION');assert.equal(rejection.status,'REJECTED');assert.equal(rejection.ordersEnabled,false);assert.match(rejection.inputDigest,/^[a-f0-9]{64}$/);
  for(const value of [text,result.stdout,result.stderr])assert(!value.includes('never-echo-private-material'));
  assert.notEqual(command('verify',out).status,0);
 }
});

test('unavailable and oversized inputs retain bounded rejections rather than reading arbitrary volumes',()=>{
 const large=path('large.json');writeFileSync(large,' '.repeat(512*1024+1));
 for(const [name,file] of [['large',large],['missing',path('missing.json')]]){
  const out=path(name+'-bounded-rejection.json'),result=command('run',file,out);
  assert.equal(result.status,2,result.stderr);const rejection=JSON.parse(readFileSync(out,'utf8'));assert.equal(rejection.status,'REJECTED');assert.equal(rejection.inputDigest,null);
 }
});

test('executable or Live fields remain rejected data and cannot create execution authority',()=>{
 const changed=structuredClone(example);const marker=path('submitted-code-executed.txt');changed.code='require("node:fs").writeFileSync('+JSON.stringify(marker)+',"executed")';changed.strategy.record.content.definition.execution.ordersEnabled=true;
 const file=path('executable.json'),out=path('executable-rejection.json');writeFileSync(file,JSON.stringify(changed));
 const result=command('run',file,out);assert.equal(result.status,2,result.stderr);
 const rejection=JSON.parse(readFileSync(out,'utf8'));assert.equal(rejection.status,'REJECTED');assert.equal(rejection.input,null);assert.equal(existsSync(marker),false);
 assert.notEqual(command('verify',out).status,0);
});

test('an uncapped short-gap failure is retained and can itself be reproduced',()=>{
 const request=structuredClone(example),definition=request.strategy.record.content.definition;
 definition.market.direction='SHORT';definition.entry={type:'DCA',intervalBars:1,maxEntries:1};
 definition.risk.positionPct=10;definition.risk.maxOpenPositions=1;
 request.strategy.digest=createHash('sha256').update(JSON.stringify(request.strategy.record)).digest('hex');
 request.signals=[];request.dataset.bars=request.dataset.bars.slice(0,4).map((bar,n)=>({...bar,open:n<2?100:200000,high:n<2?101:200001,low:n<2?99:199999,close:n<2?100:200000}));
 const file=path('short-gap.json'),out=path('short-gap-failure.json');writeFileSync(file,JSON.stringify(request));
 const result=command('run',file,out);assert.equal(result.status,2,result.stderr);
 const failure=JSON.parse(readFileSync(out,'utf8'));assert.equal(failure.status,'FAILED');assert.equal(failure.reason,'INSOLVENT');assert(failure.metrics.finalEquity<0);assert.equal(failure.metrics.comparable,false);assert.equal(failure.benchmark.comparable,false);
 assert(failure.trades[0].netPnl < -failure.trades[0].collateral);
 assert.equal(command('verify',out).status,0);
});

test('the documented supplied-signal case preserves fills and counterexamples and exactly reproduces its artifact',()=>{
 const report=JSON.parse(readFileSync('examples/demo/synthetic-signal-artifact.json','utf8'));
 const input=JSON.parse(readFileSync('examples/demo/synthetic-signal-input.json','utf8'));
 assert.deepEqual(report.input,input);assert.equal(report.input.dataset.provenance,'SYNTHETIC');assert.equal(report.trades.length,6);
 const reasons=new Set(report.audit.filter(event=>event.type==='REJECTION').map(event=>event.reason));
 for(const reason of ['PROVIDER_MISMATCH','EVENT_MISMATCH','STALE_SIGNAL'])assert(reasons.has(reason));
 assert.equal(command('verify','examples/demo/synthetic-signal-artifact.json').status,0);
});

test('unsupported commands and excess arguments do not run or overwrite artifacts',()=>{
 const previous=readFileSync(artifact,'utf8');
 for(const args of [['deploy',input],['run',input,artifact,'unexpected'],['verify',artifact,input],['example']]){
  const result=command(...args);assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);
 }
 assert.equal(readFileSync(artifact,'utf8'),previous);
});
