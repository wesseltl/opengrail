import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
let m,bundle,directory;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),T='2026-10-11T10:00:00.000Z',U='2026-10-11T10:01:00.000Z';
before(async()=>{
 const compiled=await build({stdin:{contents:"export * from './app/experiment-run-ledger';export * from './app/experiment-runner';export {strategyAuthorReference,strategyDigest} from './app/strategy-model';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-run-ledger-test-'));const fixed=join(directory,'fixed.mjs');writeFileSync(fixed,compiled.outputFiles[0].text);m=await import(pathToFileURL(fixed).href);
 const manifest=JSON.parse(readFileSync('examples/experiments/signal-current-manifest.json','utf8')).item,record=manifest.record.content.input.strategy.record;
 bundle={manifest,source:{id:record.id,digest:manifest.strategy.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:m.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]}};
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});
const admission=n=>m.createExperimentRun({...bundle,attemptId:id(n),outcomeRequestId:id(n+100),outcomeId:id(n+200),startedAt:T});
async function reseal(ledger){const {ledgerDigest,...body}=ledger;return {...body,ledgerDigest:await m.strategyDigest(JSON.stringify(body))};}

test('admission is retained before work; adverse artifact and real comparison finish the same attempt without qualification',async()=>{
 let ledger=await m.createExperimentRunLedger(id(999),T);const run=await admission(1);ledger=await m.admitExperimentRun(ledger,run);
 assert.equal(m.pendingExperimentRun(ledger).attemptId,run.attemptId);assert.equal(ledger.events[0].type,'ADMITTED');assert.equal(ledger.entries[0].outcome,null);
 const result=await m.evaluateExperimentRun(run,{finishedAt:U});ledger=await m.finishExperimentRun(ledger,result);
 const verified=await m.verifyExperimentRunLedger(JSON.parse(JSON.stringify(ledger)));assert.equal(verified.entries[0].outcome.artifact.metrics.netPnl<0,true);assert.equal(verified.entries[0].outcome.comparison.status,'MATCH');assert.equal(verified.qualification,'NONE');assert.equal(verified.ordersEnabled,false);assert.equal(verified.events[1].previous,verified.events[0].digest);assert.equal(m.pendingExperimentRun(verified),null);
 assert.deepEqual(await m.finishExperimentRun(verified,result),verified);
});
test('recovery retains interruption and old admission, is idempotent, and new attempts do not replace losses',async()=>{
 let ledger=await m.admitExperimentRun(await m.createExperimentRunLedger(id(998),T),await admission(2));
 const another=await admission(3);await assert.rejects(()=>m.admitExperimentRun(ledger,another));
 const original=ledger.entries[0].admission;ledger=await m.recoverExperimentRunLedger(ledger,U);
 assert.equal(ledger.entries[0].outcome.status,'INTERRUPTED');assert.equal(ledger.entries[0].outcome.reason,'RECOVERY_INTERRUPTED');assert.deepEqual(ledger.entries[0].admission,original);assert.equal(ledger.events.length,2);
 assert.deepEqual(await m.recoverExperimentRunLedger(ledger,U),ledger);
 const next=await m.createExperimentRun({...bundle,attemptId:id(3),outcomeRequestId:id(103),outcomeId:id(203),startedAt:U});ledger=await m.admitExperimentRun(ledger,next);
 assert.equal(ledger.entries.length,2);assert.equal(ledger.entries[0].outcome.reason,'RECOVERY_INTERRUPTED');
});
test('terminal results cannot change captured input, request IDs, or earlier outcomes even with a recomputed outer hash',async()=>{
 const run=await admission(4);let ledger=await m.admitExperimentRun(await m.createExperimentRunLedger(id(997),T),run);
 const terminal=await m.interruptExperimentRun(run,U,'USER_CANCELLED');ledger=await m.finishExperimentRun(ledger,terminal);
 const changed=await m.interruptExperimentRun(run,U,'RECOVERY_INTERRUPTED');await assert.rejects(()=>m.finishExperimentRun(ledger,changed));
 const forged=structuredClone(ledger);forged.entries[0].outcome.outcomeId=id(555);const {runDigest,...body}=forged.entries[0].outcome;forged.entries[0].outcome.runDigest=await m.strategyDigest(JSON.stringify(body));await assert.rejects(async()=>m.verifyExperimentRunLedger(await reseal(forged)));
});
test('missing, re-ordered and self-hashed substituted event receipts fail correlation checks',async()=>{
 const run=await admission(5);let ledger=await m.admitExperimentRun(await m.createExperimentRunLedger(id(996),T),run);ledger=await m.finishExperimentRun(ledger,await m.interruptExperimentRun(run,U,'USER_CANCELLED'));
 for(const mutate of [v=>v.events.pop(),v=>v.events.reverse(),v=>v.events[0].recordDigest='a'.repeat(64),v=>v.entries[0].outcome=null]){
  const changed=structuredClone(ledger);mutate(changed);await assert.rejects(async()=>m.verifyExperimentRunLedger(await reseal(changed)));
 }
});
test('a fully rehashed overlapping attempt timeline is rejected even when both results are terminal',async()=>{
 const a=await admission(20),b=await admission(21);let ledger=await m.admitExperimentRun(await m.createExperimentRunLedger(id(990),T),a);
 ledger=await m.finishExperimentRun(ledger,await m.interruptExperimentRun(a,T,'USER_CANCELLED'));ledger=await m.admitExperimentRun(ledger,b);ledger=await m.finishExperimentRun(ledger,await m.interruptExperimentRun(b,T,'USER_CANCELLED'));
 const forged=structuredClone(ledger),rows=[forged.events[0],forged.events[2],forged.events[1],forged.events[3]];let previous=null;
 for(let n=0;n<rows.length;n++){const {digest,...contents}=rows[n];contents.sequence=n+1;contents.previous=previous;rows[n]={...contents,digest:await m.strategyDigest(JSON.stringify(contents))};previous=rows[n].digest;}
 forged.events=rows;await assert.rejects(async()=>m.verifyExperimentRunLedger(await reseal(forged)),/Admission/);
});
test('safe input rejections retain no supplied body and the finite capacity never silently removes previous evidence',async()=>{
 let ledger=await m.createExperimentRunLedger(id(995),T);
 for(let n=1;n<=16;n++)ledger=await m.retainExperimentInputRejection(ledger,id(600+n),T,'a'.repeat(64));
 const before=JSON.stringify(ledger);assert.equal(ledger.entries.length,16);assert(ledger.entries.every(slot=>slot.kind==='INPUT_REJECTION'));assert.equal(ledger.events.length,16);
 await assert.rejects(()=>m.retainExperimentInputRejection(ledger,id(700),U,null));assert.equal(JSON.stringify(ledger),before);await m.verifyExperimentRunLedger(ledger);
});
test('clock regression and reused identities cannot replace an earlier admission or rejection',async()=>{
 let ledger=await m.createExperimentRunLedger(id(994),U);
 const old=await admission(6);await assert.rejects(()=>m.admitExperimentRun(ledger,old));
 ledger=await m.retainExperimentInputRejection(ledger,id(6),U,null);await assert.rejects(()=>m.retainExperimentInputRejection(ledger,id(6),U,null));
});
test('distinct trials cannot reuse a prior publication request or outcome identity',async()=>{
 const first=await admission(30);let ledger=await m.admitExperimentRun(await m.createExperimentRunLedger(id(989),T),first);ledger=await m.finishExperimentRun(ledger,await m.interruptExperimentRun(first,T,'USER_CANCELLED'));
 for(const reused of [{outcomeRequestId:first.outcomeRequestId},{outcomeId:first.outcomeId}]){
  const second=await m.createExperimentRun({...bundle,attemptId:id(31),outcomeRequestId:id(131),outcomeId:id(231),startedAt:T,...reused});await assert.rejects(()=>m.admitExperimentRun(ledger,second),/publication ID/);
 }
});
