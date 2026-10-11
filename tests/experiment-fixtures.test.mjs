import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const directory='examples/experiments';
const fixture=name=>JSON.parse(readFileSync(join(directory,name),'utf8'));
const command=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:process.cwd(),encoding:'utf8',maxBuffer:32768,timeout:30000});
let m,temporary;
before(async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/experiment-model';export * from './app/demo-model';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 temporary=mkdtempSync(join(tmpdir(),'opengrail-registry-fixture-'));
});
after(()=>rmSync(temporary,{recursive:true,force:true}));

test('retained negative signal replay and full short insolvency reproduce without qualifying either result',()=>{
 const signal=fixture('signal-author-artifact.json'),insolvent=fixture('insolvency-artifact.json');
 assert.deepEqual(signal.input,fixture('signal-input.json'));assert.equal(signal.status,'COMPLETED');assert.equal(signal.trades.length,6);assert(signal.metrics.netPnl<0);
 assert.deepEqual(insolvent.input,fixture('insolvency-input.json'));assert.equal(insolvent.status,'FAILED');assert.equal(insolvent.reason,'INSOLVENT');assert(insolvent.metrics.finalEquity<0);assert.equal(insolvent.metrics.comparable,false);assert.equal(insolvent.benchmark.comparable,false);
 for(const name of ['signal-author-artifact.json','insolvency-artifact.json']){
  const result=command('scripts/replay-demo.mjs','verify',join(directory,name));assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/same-implementation replay matched/);assert.match(result.stdout,/not independent qualification/);
 }
});

test('self-consistent conflicting performance claims pass identity checks but fail actual same-engine reconstruction',async()=>{
 const original=fixture('signal-author-outcome.json').item,conflict=fixture('signal-conflicting-outcome.json').item;
 await m.validateExperimentItem(original);await m.validateExperimentItem(conflict);
 const declared=conflict.record.content.result.artifact;
 await m.verifyDemoArtifact(declared);
 assert.deepEqual(declared.input,original.record.content.result.artifact.input);
 assert.notEqual(declared.metrics.netPnl,original.record.content.result.artifact.metrics.netPnl);
 assert.equal(conflict.record.classification,'AUTHOR_REPORTED');assert.equal(conflict.record.executionEnabled,false);
 assert.deepEqual(conflict.record.content.claim.relation,{type:'CONFLICTS',id:original.id,digest:original.digest});
 assert.match(conflict.record.content.claim.conflicts,/not an independent evaluator/);
 const target=join(temporary,'contradictory-author-artifact.json');writeFileSync(target,JSON.stringify(declared),{flag:'wx'});
 const result=command('scripts/replay-demo.mjs','verify',target);assert.notEqual(result.status,0);assert(!result.stdout.includes('replay matched'));
});

test('append-only fixture history keeps manifests immutable and retains interruption without fabricating metrics',async()=>{
 const registered=fixture('signal-registration-receipt.json').item,current=fixture('signal-current-manifest.json').item;
 await m.validateExperimentItem(registered);await m.validateExperimentItem(current);
 assert.deepEqual(current.record,registered.record);assert.equal(current.digest,registered.digest);assert.equal(registered.outcomeCount,0);assert.equal(current.outcomeCount,3);
 const interrupted=fixture('signal-interrupted-outcome.json').item;
 await m.validateExperimentItem(interrupted);assert.equal(interrupted.record.content.result.kind,'INTERRUPTED');assert(!('artifact' in interrupted.record.content.result));
 const history=fixture('signal-outcome-page.json');assert.equal(history.items.length,3);
 assert(history.items.some(item=>item.status==='INTERRUPTED'));assert(history.items.every(item=>!('record' in item)&&!('metrics' in item)));
 assert.equal(fixture('case-index.json').independentQualification,false);
});

test('fresh local registry reconstruction preserves every checked-in fixture byte and accepted failure',()=>{
 const names=readdirSync(directory).filter(name=>name.endsWith('.json')).sort(),before=new Map(names.map(name=>[name,readFileSync(join(directory,name))]));
 const result=command('scripts/example-experiment-registry.mjs');assert.equal(result.status,0,result.stderr);
 const summary=JSON.parse(result.stdout.trim());assert.equal(summary.manifests,2);assert.equal(summary.outcomes,4);assert.equal(summary.connectedSources,false);assert.equal(summary.qualification,false);
 assert.deepEqual(readdirSync(directory).filter(name=>name.endsWith('.json')).sort(),names);
 for(const [name,bytes] of before)assert.deepEqual(readFileSync(join(directory,name)),bytes,name);
});
