import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
let m,directory;
before(async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/evaluator-comparison';export * from './app/demo-model';export * from './app/demo-engine';export * from './app/reference-engine';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-comparison-'));const target=join(directory,'trusted-fixture.mjs');writeFileSync(target,bundle.outputFiles[0].text,{flag:'wx'});m=await import(pathToFileURL(target).href);
});
after(()=>rmSync(directory,{recursive:true,force:true}));
async function input(family='DCA',direction='LONG'){
 const value=await m.syntheticDemoInput(),definition=m.strategyTemplate(family);
 definition.market.direction=direction;definition.risk={positionPct:8,maxOpenPositions:3,stopLossPct:3,takeProfitPct:7,maxDailyLossPct:5};definition.costs={feeBps:17,slippageBps:23};
 if(family==='TREND')definition.entry={type:family,fastPeriod:3,slowPeriod:8,confirmation:'CROSS'};
 if(family==='RSI')definition.entry={type:family,period:5,threshold:direction==='LONG'?45:55,comparison:direction==='LONG'?'BELOW':'ABOVE'};
 if(family==='BREAKOUT')definition.entry={type:family,lookback:4};
 if(family==='DCA')definition.entry={type:family,intervalBars:3,maxEntries:5};
 if(family==='GRID')definition.entry={type:family,lowerPrice:84,upperPrice:120,levels:4};
 if(family==='SIGNAL')definition.entry={type:family,provider:'CUSTOM',event:direction==='LONG'?'BULLISH':'BEARISH',maxAgeBars:2};
 if(family==='RULES')definition.entry={type:family,match:'ANY',conditions:[{indicator:'RETURN',period:3,comparison:'GT',threshold:2},{indicator:'PRICE_SMA',period:6,comparison:'CROSSES_ABOVE',threshold:1.01},{indicator:'RSI',period:7,comparison:'LT',threshold:35}]};
 value.strategy.record.content.definition=definition;
 let state=1939,previous=100;
 value.dataset.bars=Array.from({length:96},(_,n)=>{state=(state*1664525+1013904223)>>>0;const center=90+((n*7+Math.floor(n/9)*11)%34),close=center+(state%9-4),open=previous;previous=close;return {closedAt:new Date(Date.parse('2025-01-01T01:00:00.000Z')+n*3600000).toISOString(),open,high:Math.max(open,close)+2,low:Math.min(open,close)-2,close,volume:100};});
 value.signals=family==='SIGNAL'?Array.from({length:8},(_,n)=>({id:'00000000-0000-4000-8000-'+String(100+n).padStart(12,'0'),provider:n%3===0?'ALTFINS':'CUSTOM',event:n%4===0?(direction==='LONG'?'BEARISH':'BULLISH'):definition.entry.event,observedAt:value.dataset.bars[5+n*9].closedAt,availableAt:value.dataset.bars[6+n*9].closedAt})):[];
 return reseal(value);
}
async function reseal(value){value.strategy.digest=await m.strategyDigest(JSON.stringify(value.strategy.record));return m.boundedDemoRequest(value).input;}
async function matched(value){const artifact=await m.replayDemo(value),report=await m.compareDemoArtifact(artifact);assert.equal(report.status,'MATCH',JSON.stringify(report.pairs));assert(report.pairs.every(p=>p.differenceCount===0));return {artifact,report};}
function candles(value,prices){value.dataset.bars=prices.map((bar,n)=>({closedAt:new Date(Date.parse('2025-01-01T01:00:00.000Z')+n*3600000).toISOString(),volume:1,...(typeof bar==='number'?{open:bar,high:bar,low:bar,close:bar}:bar)}));value.signals=[];return value;}

test('the reference implementation has no runtime import, primary helper or fallback, and source pins match both files',()=>{
 const source=readFileSync('app/reference-engine.ts','utf8');
 const imports=[...source.matchAll(/^import .*$/gm)].map(v=>v[0]);assert(imports.every(v=>v.startsWith('import type ')));
 assert(!/\breplayDemo\b|\bsyntheticDemoInput\b|\bverifyDemoArtifact\b|\beval\s*\(|\bfetch\s*\(/.test(source));
 for(const [key,path] of [['primary','app/demo-engine.ts'],['reference','app/reference-engine.ts']])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),m.evaluatorSourceFingerprints[key]);
});
for(const family of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES'])for(const direction of ['LONG','SHORT'])test('different implementation reconstructs '+family+' '+direction+' complete semantic traces',async()=>{
 const {report}=await matched(await input(family,direction));assert.equal(report.classification,'AUTHOR_REPORTED');assert.equal(report.qualification,'NONE');assert.equal(report.independence,'NOT_ESTABLISHED');assert.equal(report.ordersEnabled,false);
});

test('a hand-calculated fixed-path trade charges both adverse fills and both fees',async()=>{
 const value=candles(await input(),[100,100,110]),d=value.strategy.record.content.definition;
 d.entry={type:'DCA',intervalBars:1,maxEntries:1};d.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:100,maxDailyLossPct:5};d.costs={feeBps:10,slippageBps:100};
 const {artifact}=await matched(await reseal(value));assert.equal(artifact.trades.length,1);
 const expectedQuantity=100/101,expectedGross=expectedQuantity*(108.9-101),expectedExitFee=expectedQuantity*108.9*.001;
 assert(Math.abs(artifact.trades[0].quantity-expectedQuantity)<1e-12);assert(Math.abs(artifact.trades[0].netPnl-(expectedGross-.1-expectedExitFee))<1e-12);
 assert.equal(artifact.trades[0].entryBar,1);assert.equal(artifact.trades[0].exitPrice,108.9);
});

test('a hand-calculated SHORT reserves only its collateral and covers at an adverse price with both fees',async()=>{
 const value=candles(await input('DCA','SHORT'),[100,100,90]),d=value.strategy.record.content.definition;
 d.entry={type:'DCA',intervalBars:1,maxEntries:1};d.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:100,maxDailyLossPct:5};d.costs={feeBps:10,slippageBps:100};
 const {artifact}=await matched(await reseal(value)),trade=artifact.trades[0],quantity=100/99;
 assert.equal(artifact.trades.length,1);assert.equal(trade.entryPrice,99);assert.equal(trade.exitPrice,90.9);assert(Math.abs(trade.netPnl-(quantity*(99-90.9)-.1-quantity*90.9*.001))<1e-12);
 assert.equal(artifact.metrics.comparable,false);assert.equal(artifact.benchmark.comparable,false);assert(artifact.equity[1].cash<1000);
});

test('a daily loss stays latched until the next UTC opening day and does not erase prior losses',async()=>{
 const value=candles(await input(),Array.from({length:29},(_,n)=>n===1?{open:100,high:100,low:60,close:100}:100)),d=value.strategy.record.content.definition;
 d.entry={type:'DCA',intervalBars:1,maxEntries:10};d.risk={positionPct:10,maxOpenPositions:3,stopLossPct:20,takeProfitPct:100,maxDailyLossPct:.1};d.costs={feeBps:0,slippageBps:0};
 const {artifact}=await matched(await reseal(value));assert(artifact.equity.slice(1,24).every(v=>v.dailyHalted));assert.equal(artifact.equity[24].dailyHalted,false);
 assert(artifact.audit.some(v=>v.reason==='DAILY_RESET'&&v.barIndex===24));assert(!artifact.audit.some(v=>v.type==='ENTRY'&&v.barIndex>1&&v.barIndex<25));assert(artifact.trades[0].netPnl<0);
});

test('changing later prices cannot alter reference decisions, fills or equity before those prices become observable',async()=>{
 for(const family of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']){
  const original=await input(family),future=structuredClone(original);future.dataset.bars=future.dataset.bars.map((bar,n)=>n<60?bar:{...bar,open:1e308,high:1e308,low:1e308,close:1e308});
  const before=m.referenceReplay(original),after=m.referenceReplay(await reseal(future));
  assert.deepEqual(after.equity.filter(v=>v.barIndex<60),before.equity.filter(v=>v.barIndex<60),family);
  assert.deepEqual(after.audit.filter(v=>v.barIndex!==null&&v.barIndex<60),before.audit.filter(v=>v.barIndex!==null&&v.barIndex<60),family);
  assert.deepEqual(after.trades.filter(v=>v.exitBar<60),before.trades.filter(v=>v.exitBar<60),family);
 }
});

test('closing a gap target cannot change the raw opening boundary for another queued entry',async()=>{
 const value=candles(await input(),[{open:100,high:100,low:100,close:100},{open:100,high:101,low:100,close:101},{open:110,high:111,low:109,close:110}]),d=value.strategy.record.content.definition;
 d.entry={type:'DCA',intervalBars:1,maxEntries:3};d.risk={positionPct:10,maxOpenPositions:3,stopLossPct:20,takeProfitPct:2,maxDailyLossPct:5};d.costs={feeBps:0,slippageBps:0};
 const {artifact}=await matched(await reseal(value));assert.equal(artifact.trades[0].exitPrice,102);assert.equal(artifact.trades.find(t=>t.entryBar===2).entryPrice,110);
});

test('simultaneous stop and target chooses the stop and a mid-bar emergency uses observable close',async()=>{
 for(const emergency of [false,true]){
  const value=candles(await input(),[100,{open:100,high:emergency?104:120,low:emergency?99:80,close:103},103]),d=value.strategy.record.content.definition;
  d.entry={type:'DCA',intervalBars:1,maxEntries:1};d.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:20,maxDailyLossPct:5};d.costs={feeBps:0,slippageBps:0};
  if(emergency)value.emergencyStopAt='2025-01-01T01:30:00.000Z';
  const {artifact}=await matched(await reseal(value));assert.equal(artifact.trades[0].reason,emergency?'EMERGENCY_STOP':'STOP_LOSS');assert.equal(artifact.trades[0].exitPrice,emergency?103:80);
 }
});

test('negative signals and full uncapped short insolvency remain reconstructable adverse outcomes',async()=>{
 for(const name of ['signal-author-artifact','insolvency-artifact']){
  const artifact=JSON.parse(readFileSync('examples/experiments/'+name+'.json','utf8')),report=await m.compareDemoArtifact(artifact);assert.equal(report.status,'MATCH',JSON.stringify(report.pairs));assert(report.summaries.claimed.metrics.netPnl<0);
 }
});

test('self-hashed false performance, discrete trade edits and audit deletion fail actual comparisons',async()=>{
 const original=JSON.parse(readFileSync('examples/experiments/signal-author-artifact.json','utf8'));
 for(const change of [r=>{r.metrics.netPnl+=1;},r=>{r.trades[0].entryBar+=1;},r=>{r.audit.pop();},r=>{r.metrics.comparable=!r.metrics.comparable;}]){
  const report=structuredClone(original);change(report);report.resultDigest=await m.demoArtifactDigest(report);await m.verifyDemoArtifact(report);
  const result=await m.compareDemoArtifact(report);assert.equal(result.status,'MISMATCH');assert(!result.pairs[0].matches);assert(!result.pairs[1].matches);assert(result.pairs[2].matches);
 }
});

test('audit prose is excluded explicitly and never copied to reports, while semantic reasons remain exact',async()=>{
 const artifact=JSON.parse(readFileSync('examples/experiments/signal-author-artifact.json','utf8'));artifact.audit[0].details='do-not-export-untrusted-private-prose';artifact.resultDigest=await m.demoArtifactDigest(artifact);
 const report=await m.compareDemoArtifact(artifact);assert.equal(report.status,'MATCH');assert(!JSON.stringify(report).includes('do-not-export'));assert.deepEqual(report.policy.ignoredFields,['audit[].details']);
});

test('numeric tolerance cannot excuse count differences and only bounded first discrepancies are exported',async()=>{
 const original=JSON.parse(readFileSync('examples/experiments/signal-author-artifact.json','utf8'));
 const tiny=structuredClone(original);tiny.metrics.netPnl+=1e-10;tiny.resultDigest=await m.demoArtifactDigest(tiny);assert.equal((await m.compareDemoArtifact(tiny)).status,'MATCH');
 const changed=structuredClone(original);for(const row of changed.equity)row.equity+=10;changed.resultDigest=await m.demoArtifactDigest(changed);
 const result=await m.compareDemoArtifact(changed);assert.equal(result.status,'MISMATCH');assert(result.pairs[0].differenceCount>50);assert.equal(result.pairs[0].differences.length,50);
});

test('invalid artifacts and forged execution/qualification fields fail admission without confirmed reports',async()=>{
 const original=JSON.parse(readFileSync('examples/experiments/signal-author-artifact.json','utf8'));
 for(const change of [r=>{r.resultDigest='0'.repeat(64);},r=>{r.qualification='QUALIFIED';},r=>{r.input.strategy.record.executionEnabled=true;},r=>{r.input.initialCapital=NaN;}]){const raw=structuredClone(original);change(raw);await assert.rejects(()=>m.compareDemoArtifact(raw));}
});

test('valid unknown-input rejection is unreconstructible and comparison receipts cannot self-qualify or substitute source identities',async()=>{
 const artifact=await m.replayDemo({invalid:true}),report=await m.compareDemoArtifact(artifact);assert.equal(report.status,'UNRECONSTRUCTIBLE');assert.equal(report.reason,'MISSING_ACCEPTED_INPUT');assert.equal(report.pairs.length,0);await m.verifyComparisonReport(report);
 for(const changed of [{...report,qualification:'QUALIFIED'},{...report,reportDigest:'0'.repeat(64)},{...report,status:'MATCH'},{...report,implementations:{...report.implementations,reference:{...report.implementations.reference,sourceSha256:'0'.repeat(64)}}}])await assert.rejects(()=>m.verifyComparisonReport(changed));
 const good=(await matched(await input())).report;
 for(const changed of [{...report,summaries:{...report.summaries,primary:good.summaries.primary}},{...report,identity:{...good.identity,claimedArtifact:report.identity.claimedArtifact}},{...report,identity:{...report.identity,declaredMethod:'0'.repeat(64)}},{...good,identity:{...good.identity,dataset:null}}]){
  const {reportDigest,...body}=changed;void reportDigest;changed.reportDigest=await m.strategyDigest(JSON.stringify(body));await assert.rejects(()=>m.verifyComparisonReport(changed));
 }
});

test('a trusted evaluator error retains an incomplete failed comparison without leaking exception contents or inventing agreement',async()=>{
 const bundle=await build({stdin:{contents:"export {compareDemoArtifact,verifyComparisonReport} from './app/evaluator-comparison';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',plugins:[{name:'fixed-reference-failure-fixture',setup(b){b.onResolve({filter:/^\.\/reference-engine$/},args=>args.importer.endsWith('/app/evaluator-comparison.ts')?{path:'fixed-reference-failure',namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const referenceEvaluatorVersion='opengrail-reference-v1';export function referenceReplay(){throw Error('never-echo-private-failure-material');}",loader:'js'}));}}]});
 const target=join(directory,'fixed-failure.mjs');writeFileSync(target,bundle.outputFiles[0].text,{flag:'wx'});const failed=await import(pathToFileURL(target).href);
 const artifact=JSON.parse(readFileSync('examples/experiments/signal-author-artifact.json','utf8')),report=await failed.compareDemoArtifact(artifact);await failed.verifyComparisonReport(report);
 assert.equal(report.status,'FAILED');assert.equal(report.reason,'EVALUATOR_FAILURE');assert.equal(report.pairs.length,0);assert.equal(report.summaries.reference,null);assert(report.summaries.primary);assert(!JSON.stringify(report).includes('never-echo'));
});

test('checked-in negative, insolvent and contradictory sidecars exactly reconstruct without replacing their prior evidence',async()=>{
 for(const [artifactName,reportName] of [['signal-author-artifact','negative-reconstructed'],['insolvency-artifact','insolvency-reconstructed'],['signal-conflicting-outcome','false-claim-disagreement']]){
  const source=JSON.parse(readFileSync('examples/experiments/'+artifactName+'.json','utf8'));
  const artifact=artifactName==='signal-conflicting-outcome'?source.item.record.content.result.artifact:source;
  const retained=JSON.parse(readFileSync('examples/comparisons/'+reportName+'.json','utf8'));
  await m.verifyComparisonReport(retained);
  assert.deepEqual(await m.compareDemoArtifact(artifact),retained);
 }
});
