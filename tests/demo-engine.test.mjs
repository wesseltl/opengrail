import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const require=id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id);new Function('module','exports','require',code)(module,module.exports,require);return module.exports;}
const model=load('app/demo-model.ts'),{replayDemo,syntheticDemoInput}=load('app/demo-engine.ts'),strategy=load('app/strategy-model.ts');
const uid=()=>crypto.randomUUID(),near=(actual,expected)=>assert(Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),`${actual} differs from ${expected}`),step=3600000,start=Date.parse('2025-01-01T00:00:00.000Z');
const bar=(n,price,extra={})=>({closedAt:new Date(start+(n+1)*step).toISOString(),open:price,high:price,low:price,close:price,volume:100,...extra});
async function exact(input,definition){const {record,payload}=strategy.boundedStrategyRecord({...input.strategy.record,content:{...input.strategy.record.content,definition}});return {...input,strategy:{record,digest:await strategy.strategyDigest(payload)}};}
async function fixture(type='DCA',prices=[100,100,100],options={}){let input=await syntheticDemoInput(),definition=strategy.strategyTemplate(type);definition.risk={positionPct:10,maxOpenPositions:1,stopLossPct:20,takeProfitPct:100,maxDailyLossPct:5};definition.costs={feeBps:0,slippageBps:0};if(type==='DCA')definition.entry={type:'DCA',intervalBars:1,maxEntries:1};input=await exact(input,definition);input.dataset.bars=prices.map((price,n)=>bar(n,price));input.signals=[];return {...input,...options};}
async function configure(input,changes){return exact(input,{...input.strategy.record.content.definition,...changes});}
const signal=(input,n=0,extra={})=>({id:uid(),provider:'ALTFINS',event:'BULLISH',observedAt:input.dataset.bars[n].closedAt,availableAt:input.dataset.bars[n].closedAt,...extra});
const entryEquity=(artifact,trade)=>artifact.input.initialCapital+artifact.trades.filter(prior=>prior.entryAt<trade.entryAt).reduce((sum,prior)=>sum+(prior.exitAt<=trade.entryAt?prior.netPnl:(prior.direction==='LONG'?1:-1)*prior.quantity*(artifact.input.dataset.bars[trade.entryBar].open-prior.entryPrice)-prior.entryFee),0);

test('exact canonical input and deterministic artifact digests round-trip without fetching or source/registry qualification',async()=>{
 const input=await syntheticDemoInput(),originalFetch=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('Network forbidden.');};let one,two;try{one=await replayDemo(input);two=await replayDemo(JSON.parse(JSON.stringify(input)));}finally{globalThis.fetch=originalFetch;}
 assert.deepEqual(one,two);assert.equal(calls,0);assert.deepEqual(await model.verifyDemoArtifact(one),one);assert.equal(one.classification,'AUTHOR_REPORTED');assert.equal(one.mode,'SIMULATED');assert.equal(one.ordersEnabled,false);assert.equal(one.input.strategy.record.author.id,'human_'+'0'.repeat(64));
 assert.equal(one.digests.request,await strategy.strategyDigest(model.boundedDemoRequest(input).payload));assert.equal(one.digests.dataset,await strategy.strategyDigest(JSON.stringify(input.dataset)));assert.equal(one.digests.evaluator,await strategy.strategyDigest(JSON.stringify(model.demoEvaluatorMethod)));
 assert.equal(one.resultDigest,await model.demoArtifactDigest(one));assert.notEqual(one.resultDigest,one.digests.request);
});

test('strict invalid and unsafe bounded attempts retain rejection audit and digest while discarding raw credentials and authority',async()=>{
 const input=await fixture();for(const changed of [{...input,ordersEnabled:true},{...input,evaluatorVersion:'unknown'},{...input,hypothesis:'og_agent_'+uid()+'.'+'a'.repeat(64)},{...input,initialCapital:1000001},{...input,dataset:{...input.dataset,rights:{...input.dataset.rights,acknowledged:false}}}]){
  const artifact=await replayDemo(changed);assert.equal(artifact.status,'REJECTED');assert.equal(artifact.reason,'INVALID_INPUT');assert.equal(artifact.input,null);assert.equal(artifact.metrics,null);assert.equal(artifact.audit[0].type,'REJECTION');assert(!JSON.stringify(artifact).includes('og_agent_'));await model.verifyDemoArtifact(artifact);
 }
 const mismatch=await replayDemo({...input,strategy:{...input.strategy,digest:'0'.repeat(64)}});assert.equal(mismatch.reason,'DIGEST_MISMATCH');assert.equal(mismatch.input,null);assert.equal(mismatch.requestId,input.requestId);
 let executed=0;const accessor={};Object.defineProperty(accessor,'hypothesis',{enumerable:true,get(){executed++;return input.hypothesis;}});await assert.rejects(()=>replayDemo(accessor),error=>error instanceof model.DemoError);assert.equal(executed,0);
 await assert.rejects(()=>replayDemo({...input,hypothesis:'x'.repeat(model.demoLimits.requestBytes+1)}),error=>error.status===413);
});

test('datasets reject holes, ordering, alignment, incoherent OHLC, market mismatch and undeclared rights',async()=>{
 const input=await fixture();const bad=[
  {...input.dataset,bars:[input.dataset.bars[0],input.dataset.bars[2]]},
  {...input.dataset,bars:[input.dataset.bars[1],input.dataset.bars[0]]},
  {...input.dataset,bars:input.dataset.bars.map((b,n)=>n===1?{...b,closedAt:new Date(Date.parse(b.closedAt)+1).toISOString()}:b)},
  {...input.dataset,bars:input.dataset.bars.map((b,n)=>n===1?{...b,low:101}:b)},
  {...input.dataset,symbol:'ETH/USDT'},{...input.dataset,timeframe:'15m'},{...input.dataset,provenance:'USER_SUPPLIED'},
  {...input.dataset,bars:Array.from({length:2001},(_,n)=>bar(n,100))}
 ];for(const dataset of bad)assert.equal((await replayDemo({...input,dataset})).status,'REJECTED');
 const user=await replayDemo({...input,dataset:{...input.dataset,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'Author claims authorized local input; not independently verified.'}}});assert.notEqual(user.status,'REJECTED');assert.equal(user.input.dataset.provenance,'USER_SUPPLIED');
});

test('closed-bar decisions enter at the next open, deduct both side costs and preserve flat-price losses',async()=>{
 let input=await fixture();input=await configure(input,{costs:{feeBps:10,slippageBps:10}});const artifact=await replayDemo(input),trade=artifact.trades[0];
 assert.equal(trade.entryBar,1);assert.equal(trade.entryAt,input.dataset.bars[0].closedAt);near(trade.entryPrice,100.1);near(trade.exitPrice,99.9);near(trade.collateral,100);near(trade.quantity,100/100.1);near(trade.entryFee,.1);near(trade.exitFee,(100/100.1)*99.9*.001);near(trade.netPnl,(100/100.1)*(99.9-100.1)-trade.entryFee-trade.exitFee);near(artifact.metrics.finalEquity,1000+trade.netPnl);assert(artifact.metrics.returnPct<0);
 const entryAudit=artifact.audit.find(event=>event.type==='ENTRY');assert.equal(entryAudit.at,trade.entryAt);assert.equal(artifact.audit.find(event=>event.type==='EXIT').at,trade.exitAt);assert(artifact.benchmark.totalFees>0);assert(artifact.benchmark.returnPct<0);
});

test('protective opening gaps use adverse open, targets cap favorable gaps and dual-touch exits stop first',async()=>{
 for(const [last,reason,price] of [[90,'STOP_LOSS',90],[110,'TAKE_PROFIT',104]]){let input=await fixture('DCA',[100,100,last]);input=await configure(input,{risk:{...input.strategy.record.content.definition.risk,stopLossPct:2,takeProfitPct:4}});const result=await replayDemo(input),trade=result.trades[0];assert.equal(trade.reason,reason);near(trade.exitPrice,price);assert.equal(trade.exitAt,input.dataset.bars[1].closedAt);assert.equal(result.audit.find(event=>event.type==='EXIT').at,trade.exitAt);}
 let both=await fixture();both.dataset.bars[1]={...both.dataset.bars[1],high:105,low:97};both=await configure(both,{risk:{...both.strategy.record.content.definition.risk,stopLossPct:2,takeProfitPct:4}});const result=await replayDemo(both);assert.equal(result.trades[0].reason,'STOP_LOSS');near(result.trades[0].exitPrice,98);
});

test('entry slippage that immediately breaches a new stop cannot receive a favorable stale stop fill',async()=>{
 let input=await fixture();input=await configure(input,{risk:{...input.strategy.record.content.definition.risk,stopLossPct:.1},costs:{feeBps:0,slippageBps:200}});const result=await replayDemo(input),trade=result.trades[0];assert.equal(trade.reason,'STOP_LOSS');near(trade.entryPrice,102);near(trade.exitPrice,98);assert.equal(trade.exitAt,trade.entryAt);assert(trade.netPnl<0);
});

test('SHORT virtual collateral preserves uncapped losses and terminal opening insolvency without future-bar liquidation',async()=>{
 let profitable=await fixture('DCA',[100,100,90]);profitable=await configure(profitable,{market:{...profitable.strategy.record.content.definition.market,direction:'SHORT'}});const good=await replayDemo(profitable);near(good.trades[0].grossPnl,10);assert.equal(good.metrics.comparable,false);assert.equal(good.benchmark.comparable,false);assert(good.benchmark.returnPct<0);
 let bad=await fixture('DCA',[100,100,100,1000,1000]);bad=await configure(bad,{market:{...bad.strategy.record.content.definition.market,direction:'SHORT'},entry:{type:'DCA',intervalBars:1,maxEntries:3},risk:{...bad.strategy.record.content.definition.risk,maxOpenPositions:3}});bad.dataset.bars[3]={...bad.dataset.bars[3],high:2000};const failed=await replayDemo(bad);assert.equal(failed.status,'FAILED');assert.equal(failed.reason,'INSOLVENT');assert.equal(failed.trades.length,2);assert(failed.trades.every(trade=>trade.exitPrice===1000));assert(failed.trades.some(trade=>trade.netPnl<-trade.collateral));assert(failed.trades.every(trade=>trade.exitAt===bad.dataset.bars[2].closedAt));assert.equal(failed.metrics.comparable,false);assert.equal(failed.benchmark.comparable,false);assert(!failed.audit.some(event=>event.type==='ENTRY'&&event.barIndex>=3));await model.verifyDemoArtifact(failed);
});

test('SHORT flat-price replay charges adverse sell and buy slippage plus both side fees',async()=>{
 let input=await fixture();input=await configure(input,{market:{...input.strategy.record.content.definition.market,direction:'SHORT'},costs:{feeBps:10,slippageBps:10}});const result=await replayDemo(input),trade=result.trades[0];near(trade.entryPrice,99.9);near(trade.exitPrice,100.1);near(trade.quantity,100/99.9);near(trade.entryFee,.1);near(trade.exitFee,(100/99.9)*100.1*.001);near(trade.grossPnl,(100/99.9)*(99.9-100.1));near(trade.netPnl,trade.grossPnl-trade.entryFee-trade.exitFee);near(result.metrics.finalEquity,1000+trade.netPnl);assert.equal(result.metrics.comparable,false);
});

test('daily equity loss latches through recovery, resets on UTC open day and partitions lifetime DCA allocation',async()=>{
 let input=await fixture('DCA',[100,100,100,100,100]);input=await configure(input,{entry:{type:'DCA',intervalBars:1,maxEntries:3},risk:{...input.strategy.record.content.definition.risk,maxOpenPositions:3,maxDailyLossPct:.1}});input.dataset.bars[1]={...input.dataset.bars[1],low:89};const halted=await replayDemo(input);assert.equal(halted.status,'HALTED');assert.equal(halted.reason,'DAILY_LOSS');assert.equal(halted.trades.length,1);assert.equal(halted.trades[0].reason,'DAILY_LOSS');assert(halted.equity.slice(1).every(point=>point.dailyHalted));assert(!halted.audit.some(event=>event.type==='ENTRY'&&event.barIndex>1));
 input.dataset.bars=input.dataset.bars.map((b,n)=>({...b,closedAt:new Date(Date.parse('2025-01-01T23:00:00.000Z')+n*step).toISOString()}));const reset=await replayDemo(input);const marker=reset.audit.find(event=>event.type==='RESET');assert.equal(marker.barIndex,2);assert.equal(marker.at,'2025-01-02T00:00:00.000Z');assert(reset.trades.some(trade=>trade.entryBar===3));assert(reset.trades.length<=3);assert(reset.equity.every(point=>point.reservedCollateral<=point.equity*.1+1e-8||point.dailyHalted));
});

test('emergency controls cancel queued entries or defer mid-bar stop to an observable close without backdating',async()=>{
 const input=await fixture();const boundary=await replayDemo({...input,emergencyStopAt:input.dataset.bars[0].closedAt});assert.equal(boundary.status,'HALTED');assert.equal(boundary.trades.length,0);assert.equal(boundary.audit.find(event=>event.reason==='EMERGENCY_STOP').at,input.dataset.bars[0].closedAt);
 const middle=await replayDemo({...input,emergencyStopAt:'2025-01-01T01:30:00.000Z'});assert.equal(middle.status,'HALTED');assert.equal(middle.trades[0].reason,'EMERGENCY_STOP');assert.equal(middle.trades[0].entryAt,'2025-01-01T01:00:00.000Z');assert.equal(middle.trades[0].exitAt,'2025-01-01T02:00:00.000Z');assert.equal(middle.benchmark.comparable,false);
});

test('signals gate on observation and availability, fill next open and are consumed exactly once',async()=>{
 let input=await fixture('SIGNAL',[100,100,100,100,100,100]);input=await configure(input,{entry:{type:'SIGNAL',provider:'ALTFINS',event:'BULLISH',maxAgeBars:3}});input.signals=[signal(input,0,{availableAt:input.dataset.bars[2].closedAt})];const result=await replayDemo(input);assert.equal(result.trades.length,1);assert.equal(result.trades[0].entryBar,3);assert.equal(result.trades[0].signalId,input.signals[0].id);assert.equal(result.audit.filter(event=>event.reason==='SIGNAL_CONSUMED').length,1);assert(!result.audit.some(event=>event.type==='ENTRY'&&event.barIndex<3));
 const final=await replayDemo({...input,signals:[signal(input,5)]});assert.equal(final.status,'NO_TRADES');assert(final.audit.some(event=>event.reason==='END_OF_DATA'));assert.equal(final.metrics.returnPct,0);
});

test('a queued signal blocked by existing inventory stays consumed rather than retrying at a later favorable bar',async()=>{
 let input=await fixture('SIGNAL',[100,100,100,100,100,100]);input=await configure(input,{entry:{type:'SIGNAL',provider:'ALTFINS',event:'BULLISH',maxAgeBars:3}});input.signals=[signal(input,0),signal(input,1)];const result=await replayDemo(input);assert.equal(result.trades.length,1);assert.equal(result.audit.filter(event=>event.reason==='SIGNAL_CONSUMED').length,2);assert(result.audit.some(event=>event.reason==='POSITION_LIMIT'&&event.signalId===input.signals[1].id));assert(!result.audit.some(event=>event.type==='ENTRY'&&event.barIndex>1));
});

test('stale, mismatched, duplicate and future signal attempts are rejected and retained without inventing a provider connection',async()=>{
 let input=await fixture('SIGNAL',[100,100,100,100,100]);input=await configure(input,{entry:{type:'SIGNAL',provider:'ALTFINS',event:'BULLISH',maxAgeBars:1}});
 for(const [event,reason] of [[signal(input,0,{availableAt:input.dataset.bars[3].closedAt}),'STALE_SIGNAL'],[signal(input,0,{provider:'TRADINGVIEW'}),'PROVIDER_MISMATCH'],[signal(input,0,{event:'BEARISH'}),'EVENT_MISMATCH']]){const result=await replayDemo({...input,signals:[event]});assert.equal(result.status,'NO_TRADES');assert(result.audit.some(item=>item.reason===reason));assert.equal(result.trades.length,0);}
 const first=signal(input);for(const signals of [[first,first],[first,{...first,id:uid()}],[{...first,availableAt:'2026-01-01T00:00:00.000Z'}],[{...first,availableAt:'2024-01-01T00:00:00.000Z'}]])assert.equal((await replayDemo({...input,signals})).status,'REJECTED');
 const missing=await replayDemo(input);assert.equal(missing.status,'NO_TRADES');assert(missing.audit.some(event=>event.reason==='MISSING_SIGNAL'));
});

test('TREND, Wilder RSI and prior-window BREAKOUT enter only after their actual closed-bar warmup',async()=>{
 let trend=await fixture('TREND',[100,101,102,103,104]);trend=await configure(trend,{entry:{type:'TREND',fastPeriod:2,slowPeriod:3,confirmation:'ALIGNED'}});const aligned=await replayDemo(trend);assert.equal(aligned.trades[0].entryBar,3);
 let cross=await fixture('TREND',[100,100,100,99,100,102,103,104]);cross=await configure(cross,{entry:{type:'TREND',fastPeriod:2,slowPeriod:3,confirmation:'CROSS'}});assert.equal((await replayDemo(cross)).trades[0].entryBar,6);
 let rsi=await fixture('RSI',[100,102,101,100]);rsi=await configure(rsi,{entry:{type:'RSI',period:2,threshold:65,comparison:'ABOVE'}});assert.equal((await replayDemo(rsi)).trades[0].entryBar,3);
 let breakout=await fixture('BREAKOUT',[100,101,102,103,104]);breakout=await configure(breakout,{entry:{type:'BREAKOUT',lookback:2}});assert.equal((await replayDemo(breakout)).trades[0].entryBar,3);
 const insufficient=await replayDemo(await fixture('TREND',[100,101,102]));assert.equal(insufficient.status,'NO_TRADES');assert(insufficient.audit.some(event=>event.reason==='WARMUP'));assert.equal(insufficient.metrics.returnPct,0);
});

test('bounded RULES use declared price/SMA ratio, percent return and crossings with ALL and ANY predicates',async()=>{
 let input=await fixture('RULES',[100,100,101,102,103]);input=await configure(input,{entry:{type:'RULES',match:'ALL',conditions:[{indicator:'PRICE_SMA',period:2,comparison:'CROSSES_ABOVE',threshold:1},{indicator:'RETURN',period:2,comparison:'GT',threshold:0}]}});assert.equal((await replayDemo(input)).trades[0].entryBar,3);
 input=await configure(input,{entry:{type:'RULES',match:'ANY',conditions:[{indicator:'RSI',period:2,comparison:'LT',threshold:10},{indicator:'RETURN',period:2,comparison:'GT',threshold:0}]}});assert.equal((await replayDemo(input)).trades[0].entryBar,3);
});

test('GRID executes only closed crossings at next open with one active inventory leg per level and total allocation partitions',async()=>{
 let input=await fixture('GRID',[120,110,100,90,100]);input=await configure(input,{entry:{type:'GRID',lowerPrice:90,upperPrice:110,levels:3},risk:{...input.strategy.record.content.definition.risk,maxOpenPositions:3}});const result=await replayDemo(input);assert.deepEqual(result.trades.map(trade=>trade.entryBar),[2,3,4]);assert.deepEqual(result.trades.map(trade=>trade.gridLevel),[2,1,0]);assert(result.trades.every(trade=>trade.collateral<=entryEquity(result,trade)*.1/3+1e-8));
 let occupied=await fixture('GRID',[120,110,100,120,110,100]);occupied=await configure(occupied,{entry:{type:'GRID',lowerPrice:90,upperPrice:110,levels:3},risk:{...occupied.strategy.record.content.definition.risk,maxOpenPositions:3}});const held=await replayDemo(occupied);assert(held.audit.some(event=>event.reason==='GRID_LEVEL_ACTIVE'));assert.equal(new Set(held.trades.map(trade=>trade.gridLevel)).size,held.trades.length);
});

test('DCA filled entries have a lifetime cap even when take-profit releases collateral repeatedly',async()=>{
 let input=await fixture('DCA',Array(9).fill(100));input=await configure(input,{entry:{type:'DCA',intervalBars:1,maxEntries:3},risk:{...input.strategy.record.content.definition.risk,takeProfitPct:.1}});input.dataset.bars=input.dataset.bars.map(b=>({...b,high:101}));const result=await replayDemo(input);assert.equal(result.trades.length,3);assert(result.trades.every(trade=>trade.collateral<=entryEquity(result,trade)*.1/3+1e-8));assert(result.audit.some(event=>event.reason==='DCA_EXHAUSTED'));assert(!result.audit.some(event=>event.type==='ENTRY'&&event.barIndex>3));
});

test('future normal or overflowing observations never change earlier fills, decisions or equity',async()=>{
 let ordinary=await fixture('TREND',Array.from({length:24},(_,n)=>100+n));ordinary=await configure(ordinary,{entry:{type:'TREND',fastPeriod:2,slowPeriod:3,confirmation:'ALIGNED'}});const normal=await replayDemo(ordinary),extreme=JSON.parse(JSON.stringify(ordinary));extreme.dataset.bars=extreme.dataset.bars.map((b,n)=>n<10?b:bar(n,1e308));const failed=await replayDemo(extreme);assert.equal(failed.status,'FAILED');assert.equal(failed.reason,'NUMERICAL_LIMIT');assert(failed.audit.find(event=>event.type==='FAILURE').barIndex>=10);
 assert.deepEqual(failed.audit.filter(event=>event.barIndex!==null&&event.barIndex<10),normal.audit.filter(event=>event.barIndex!==null&&event.barIndex<10));assert.deepEqual(failed.equity.filter(point=>point.barIndex<10),normal.equity.filter(point=>point.barIndex<10));assert(failed.audit.some(event=>event.type==='ENTRY'&&event.barIndex===3));
 const changed=JSON.parse(JSON.stringify(ordinary));changed.dataset.bars=changed.dataset.bars.map((b,n)=>n<10?b:bar(n,200-n));const other=await replayDemo(changed);assert.deepEqual(other.audit.filter(event=>event.barIndex!==null&&event.barIndex<10),normal.audit.filter(event=>event.barIndex!==null&&event.barIndex<10));
 const tiny=await fixture('DCA',[5e-324,5e-324,5e-324]);const numeric=await replayDemo(tiny);assert.equal(numeric.status,'FAILED');assert.equal(numeric.reason,'NUMERICAL_LIMIT');assert.equal(numeric.metrics,null);assert(numeric.audit.some(event=>event.type==='FAILURE'));await model.verifyDemoArtifact(numeric);
});

test('maximum bounded replay remains within artifact budgets and forged method or result digests fail verification',async()=>{
 let input=await fixture('DCA',Array(2000).fill(100));const artifact=await replayDemo(input);assert.equal(artifact.equity.length,2000);assert(artifact.audit.length<=model.demoLimits.audit);assert(artifact.trades.length<=model.demoLimits.trades);assert(new TextEncoder().encode(JSON.stringify(artifact)).byteLength<=model.demoLimits.artifactBytes);await model.verifyDemoArtifact(artifact);
 const changed={...artifact,digests:{...artifact.digests,evaluator:'f'.repeat(64)}};changed.resultDigest=await model.demoArtifactDigest(changed);await assert.rejects(()=>model.verifyDemoArtifact(changed),/declared evaluator/);await assert.rejects(()=>model.verifyDemoArtifact({...artifact,resultDigest:'f'.repeat(64)}),/digest/);
});
