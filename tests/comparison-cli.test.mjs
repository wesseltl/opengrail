import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
let directory;
const path=name=>join(directory,name);
const command=(...args)=>spawnSync(process.execPath,['scripts/compare-evaluators.mjs',...args],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:10000});
before(()=>{directory=mkdtempSync(join(tmpdir(),'opengrail-comparison-cli-'));});
after(()=>rmSync(directory,{recursive:true,force:true}));

test('CLI compares negative and failed artifacts using both fixed implementations without research qualification',()=>{
 for(const name of ['signal-author-artifact','insolvency-artifact']){
  const output=path(name+'-report.json'),result=command('check','examples/experiments/'+name+'.json',output);assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(readFileSync(output,'utf8'));assert.equal(report.status,'MATCH');assert.equal(report.qualification,'NONE');assert.equal(report.independence,'NOT_ESTABLISHED');assert.equal(report.pairs.length,3);assert.equal(report.ordersEnabled,false);
 }
});

test('a supplied self-hashed conflicting claim is retained as an actual mismatch',()=>{
 const artifact=JSON.parse(readFileSync('examples/experiments/signal-conflicting-outcome.json','utf8')).item.record.content.result.artifact,file=path('conflicting.json'),output=path('conflicting-report.json');writeFileSync(file,JSON.stringify(artifact),{flag:'wx'});
 const result=command('check',file,output);assert.equal(result.status,2,result.stderr);const report=JSON.parse(readFileSync(output,'utf8'));assert.equal(report.status,'MISMATCH');assert(!report.pairs[0].matches);assert(!report.pairs[1].matches);assert(report.pairs[2].matches);
});

test('a new comparison cannot overwrite prior evidence',()=>{
 const output=path('preserved.json');writeFileSync(output,'prior evidence\n',{flag:'wx'});
 const result=command('check','examples/experiments/signal-author-artifact.json',output);assert.equal(result.status,1);assert.equal(readFileSync(output,'utf8'),'prior evidence\n');
});

test('malformed UTF-8 and duplicate JSON keys fail without echoing submitted text or creating a report',()=>{
 for(const [name,bytes] of [['utf8',Buffer.from([123,34,255,34,125])],['duplicates',Buffer.from('{"version":1,"version":2,"secret":"never-echo-comparison-private-text"}')]]){
  const file=path(name+'.json'),output=path(name+'-report.json');writeFileSync(file,bytes,{flag:'wx'});const result=command('check',file,output);assert.equal(result.status,1);assert(!existsSync(output));assert(!(result.stdout+result.stderr).includes('never-echo'));
 }
});

test('oversized files, symlinks and named pipes are rejected as data without blocking or producing a report',()=>{
 const large=path('large.json');writeFileSync(large,' '.repeat(8388609),{flag:'wx'});const link=path('linked.json');symlinkSync(join(process.cwd(),'examples/experiments/signal-author-artifact.json'),link);
 const fifo=path('stream');assert.equal(spawnSync('mkfifo',[fifo],{encoding:'utf8'}).status,0);
 for(const [n,file] of [large,link,fifo].entries()){
  const output=path('invalid-file-'+n+'.json'),result=command('check',file,output);assert.equal(result.status,1,result.stderr);assert(!existsSync(output));assert.equal(result.signal,null);
 }
});

test('unsupported commands and user-selected evaluators are refused rather than executed',()=>{
 for(const args of [['deploy','anything','output'],['check','input'],['check','input','output','--source=untrusted.js'],['verify','input','output']]){const result=command(...args);assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);}
});
