import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let modules,directory;
before(async()=>{
 const bundle=await build({stdin:{contents:"export {replayDemo,syntheticDemoInput} from './app/demo-engine';export {referenceReplay} from './app/reference-engine';export {boundedDemoRequest,verifyDemoArtifact} from './app/demo-model';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {compareDemoArtifact,verifyComparisonReport,comparisonReportSchema} from './app/evaluator-comparison';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-reference-disagreement-'));
 const path=join(directory,'reviewed-engines.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx'});modules=await import(pathToFileURL(path).href);
});
after(()=>rmSync(directory,{recursive:true,force:true}));

test('a past SMA overflow skipped during a daily halt remains a genuine two-engine disagreement',async()=>{
 const raw=await modules.syntheticDemoInput(),definition=modules.strategyTemplate('RULES');
 definition.entry={type:'RULES',match:'ALL',conditions:[{indicator:'PRICE_SMA',period:2,comparison:'GT',threshold:.5}]};
 definition.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:20,maxDailyLossPct:1};
 definition.costs={feeBps:10,slippageBps:10};raw.strategy.record.content.definition=definition;
 raw.strategy.digest=await modules.strategyDigest(JSON.stringify(raw.strategy.record));
 raw.signals=[];raw.emergencyStopAt=null;
 // The first open is 10:00 UTC. Index 14 opens on the next UTC day.
 // Index 1 schedules a fill; index 2 stops it and latches daily loss.
 // Two adjacent finite 1e308 closes overflow a historical period-two sum.
 // Normal closes resume well before index 14, whose current SMA window is finite.
 raw.dataset.bars=Array.from({length:18},(_,index)=>{
  const extreme=index>=3&&index<=6,price=extreme?1e308:100;
  return {closedAt:new Date(Date.parse('2025-01-01T11:00:00.000Z')+index*3600000).toISOString(),open:price,high:index===2?101:price,low:index===2?79:price,close:price,volume:1};
 });
 const input=modules.boundedDemoRequest(raw).input;
 assert(Number.isFinite(input.dataset.bars[4].close));
 assert.equal(input.dataset.bars[3].close+input.dataset.bars[4].close,Infinity);
 assert.equal((input.dataset.bars[13].close+input.dataset.bars[14].close)/2,100);

 const primary=await modules.replayDemo(input),reference=modules.referenceReplay(structuredClone(input));
 await modules.verifyDemoArtifact(primary);
 for(const result of [primary,reference]){
  assert.equal(result.trades[0].entryBar,2);
  assert.equal(result.trades[0].reason,'STOP_LOSS');
  assert(result.trades[0].netPnl<0);
  assert(result.audit.some(event=>event.type==='HALT'&&event.reason==='DAILY_LOSS'&&event.barIndex===2));
  assert(result.equity.filter(point=>point.barIndex>=2&&point.barIndex<14).every(point=>point.dailyHalted));
  assert(result.audit.some(event=>event.type==='RESET'&&event.reason==='DAILY_RESET'&&event.barIndex===14&&event.at==='2025-01-02T00:00:00.000Z'));
 }
 assert.deepEqual(reference.audit.filter(event=>event.barIndex!==null&&event.barIndex<14),primary.audit.filter(event=>event.barIndex!==null&&event.barIndex<14).map(({details,...event})=>event));
 assert.deepEqual(reference.trades[0],primary.trades[0]);
 assert.equal(primary.status,'FAILED');assert.equal(primary.reason,'NUMERICAL_LIMIT');
 assert.equal(primary.metrics,null);
 assert(primary.audit.some(event=>event.type==='FAILURE'&&event.reason==='NUMERICAL_LIMIT'&&event.barIndex===14));
 assert(!primary.audit.some(event=>event.type==='ENTRY'&&event.barIndex>2));
 assert.equal(reference.status,'COMPLETED');assert.equal(reference.reason,null);
 assert(reference.audit.some(event=>event.type==='ENTRY'&&event.barIndex===15));
 assert(reference.metrics!==null);

 const report=await modules.compareDemoArtifact(primary);
 assert.equal(report.status,'MISMATCH');
 assert.equal(report.classification,'AUTHOR_REPORTED');assert.equal(report.qualification,'NONE');
 assert.equal(report.independence,'NOT_ESTABLISHED');assert.equal(report.ordersEnabled,false);
 const originalPair=report.pairs.find(pair=>pair.pair==='CLAIM_PRIMARY');
 const independentPair=report.pairs.find(pair=>pair.pair==='PRIMARY_REFERENCE');
 assert.equal(originalPair.matches,true);assert.equal(originalPair.differenceCount,0);
 assert.equal(independentPair.matches,false);assert(independentPair.differenceCount>0);
 assert(independentPair.differences.some(difference=>difference.path==='status'));
 // The comparator preserves both actual outcomes rather than replacing B with A.
 assert.equal(report.summaries.primary.status,'FAILED');assert.equal(report.summaries.reference.status,'COMPLETED');
 assert.equal(report.identity.claimedArtifact,primary.resultDigest);
 assert.equal(report.identity.request,primary.digests.request);
 assert.deepEqual(await modules.verifyComparisonReport(report),report);
 assert.deepEqual(await modules.verifyComparisonReport(JSON.parse(JSON.stringify(report))),report);
 assert(!modules.comparisonReportSchema.safeParse({...report,status:'MATCH'}).success);
 assert(!modules.comparisonReportSchema.safeParse({...report,qualification:'REPRODUCED'}).success);
 await assert.rejects(()=>modules.verifyComparisonReport({...report,reportDigest:'0'.repeat(64)}));
});
