import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {KrakenFeedError,krakenFeedLimits,validateFeedConfig,makeKrakenUrl,parseKrakenOhlc,parseKrakenTrades} from '../scripts/kraken-market-data-core.mjs';

// Entirely invented responses, prices and public-shaped authorship. These tests
// do not fetch Kraken, authenticate a provider or establish publication rights.
const symbol='BTC/USD',start=Date.parse('2026-01-01T00:00:00.000Z'),id=n=>'c1000000-0000-4000-8000-'+String(n).padStart(12,'0'),iso=ms=>new Date(ms).toISOString(),copy=v=>structuredClone(v);
const row=(ms=start,price='100')=>[ms/1000,price,'102','99',price,'100','1.25',2];
const ohlc=(rows=[row(),row(start+300000)])=>({error:[],result:{[symbol]:rows,last:(start+300000)/1000}});
const trade=(ms=start+300000,price='100',tradeId=1)=>[price,'0.25',ms/1000,'b','m','',tradeId];
const trades=(rows=[trade()],last='9999999999999999999')=>({error:[],result:{[symbol]:rows,last}});
const reject=(fn,code)=>assert.throws(fn,error=>error instanceof KrakenFeedError&&error.code===code&&error.message===code);
let methods;
before(async()=>{
 const compiled=await build({stdin:{contents:"export {strategyTemplate,boundedStrategyRecord,strategyDigest} from './app/strategy-model';export {boundedSessionConfig} from './app/session-model';export {createSession,advanceSession} from './app/session-engine';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 methods=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
});
async function config(kind='DCA',direction='LONG',timeframe='5m'){
 const definition=methods.strategyTemplate(kind);definition.market.symbol=symbol;definition.market.direction=direction;definition.market.timeframe=timeframe;definition.costs={feeBps:23,slippageBps:37};if(kind==='SIGNAL')definition.entry.event=direction==='LONG'?'BULLISH':'BEARISH';
 const human='human_'+'c'.repeat(64),canonical=methods.boundedStrategyRecord({version:1,id:id(1),rootId:id(1),revision:1,requestId:id(2),createdAt:iso(start-86400000),author:{kind:'HUMAN',id:human,sponsorId:human},content:{name:'INVENTED parser integration fixture',description:'Local invented records and prices; no authentic provider or registration.',assumptions:'Source prices and costs are explicitly invented for bounded parsing.',falsification:'Reject repaired times or a prefetched price filling a later decision.',sources:[],definition,relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false});
 return methods.boundedSessionConfig({version:1,sessionId:id(3),methodVersion:'opengrail-session-v1',clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record:canonical.record,digest:await methods.strategyDigest(canonical.payload)},initialCapital:1000,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'Invented local test data only; no Kraken rights established.'},sourceLabel:'INVENTED fixture with no real Kraken observations',ordersEnabled:false,liveEnabled:false}).config;
}

test('fixed URLs keep exact display pairs and supported interval mapping without private endpoints or aliases',()=>{
 for(const [timeframe,interval]of Object.entries({'5m':5,'15m':15,'1h':60,'4h':240,'1d':1440})){
  const url=makeKrakenUrl('OHLC','ETH/EUR',timeframe);assert.equal(url.origin,'https://api.kraken.com');assert.equal(url.pathname,'/0/public/OHLC');assert.deepEqual([...url.searchParams],[['pair','ETH/EUR'],['assetVersion','1'],['interval',String(interval)]]);
 }
 const url=makeKrakenUrl('Trades',symbol,'5m');assert.equal(url.pathname,'/0/public/Trades');assert.equal(url.searchParams.get('count'),'1000');assert.equal(url.searchParams.get('assetVersion'),'1');assert.equal(url.searchParams.get('pair'),symbol);assert.equal(url.username,'');assert.equal(url.password,'');
 for(const bad of ['XBTUSD','btc/USD','BTC/USD?pair=ETH/EUR','https://example.test','BTC/USD#x',' BTC/USD','BTC/U'])reject(()=>makeKrakenUrl('OHLC',bad,'5m'),'INVALID_SYMBOL');
 reject(()=>makeKrakenUrl('Balance',symbol,'5m'),'INVALID_ENDPOINT');reject(()=>makeKrakenUrl('Trades',symbol,'1m'),'INVALID_TIMEFRAME');
});
test('every declared family and direction can supply bars/quotes while exact friction is preserved and SIGNAL is not synthesized',async()=>{
 for(const family of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES'])for(const direction of ['LONG','SHORT']){
  const supplied=await config(family,direction),before=JSON.stringify(supplied);assert.deepEqual(validateFeedConfig(supplied),{symbol,timeframe:'5m',intervalMinutes:5});assert.equal(JSON.stringify(supplied),before);assert.deepEqual(supplied.strategy.record.content.definition.costs,{feeBps:23,slippageBps:37});
 }
});
test('feed-specific fences require existing system receipt, public source and explicit supplied-data rights with disabled orders',async()=>{
 const accepted=await config();
 const changes=[v=>v.clockMode='SYNTHETIC_PLAYBACK',v=>v.origin='SYNTHETIC_FIXTURE',v=>v.provenance='SYNTHETIC',v=>v.rights.permission='CREATED_SYNTHETIC',v=>v.rights.acknowledged=false,v=>v.ordersEnabled=true,v=>v.liveEnabled=true,v=>v.methodVersion='other',v=>v.strategy.record.executionEnabled=true,v=>v.strategy.record.verification='TESTED',v=>v.strategy.record.content.definition.execution.ordersEnabled=true,v=>v.strategy.record.content.definition.execution.leverage=2,v=>v.initialCapital=0,v=>v.initialCapital=1000001,v=>v.sourceLabel='',v=>v.rights.note='',v=>v.ownerToken='unexpected',v=>v.rights.extra=true];
 for(const change of changes){const value=copy(accepted);change(value);reject(()=>validateFeedConfig(value),'INVALID_CONFIG');}
 const alias=copy(accepted);alias.strategy.record.content.definition.market.symbol='XBTUSD';reject(()=>validateFeedConfig(alias),'INVALID_SYMBOL');
 const unsupported=copy(accepted);unsupported.strategy.record.content.definition.market.timeframe='1m';reject(()=>validateFeedConfig(unsupported),'INVALID_TIMEFRAME');
});
test('OHLC actual interval starts become exact close boundaries and final current candle is unconditionally omitted',()=>{
 const response=ohlc([row(),row(start+300000),row(start+600000)]),before=JSON.stringify(response),parsed=parseKrakenOhlc(response,symbol,'5m',iso(start+600100));
 assert.deepEqual(parsed,{bars:[{closedAt:iso(start+300000),open:100,high:102,low:99,close:100,volume:1.25},{closedAt:iso(start+600000),open:100,high:102,low:99,close:100,volume:1.25}],currentOmitted:true,last:String((start+300000)/1000)});assert.equal(JSON.stringify(response),before);
});
test('a final stale-looking frame is still omitted and a current-only response cannot invent closed history',()=>{
 const stale=parseKrakenOhlc(ohlc(),symbol,'5m',iso(start+3600000));assert.equal(stale.bars.length,1);assert.equal(stale.bars[0].closedAt,iso(start+300000));
 assert.deepEqual(parseKrakenOhlc(ohlc([row()]),symbol,'5m',iso(start+1)),{bars:[],currentOmitted:true,last:String((start+300000)/1000)});
});
test('OHLC normalization supports exact UTC alignment for all five existing timeframes',()=>{
 for(const [timeframe,minutes]of Object.entries({'5m':5,'15m':15,'1h':60,'4h':240,'1d':1440})){
  const step=minutes*60000,parsed=parseKrakenOhlc(ohlc([row(),row(start+step),row(start+2*step)]),symbol,timeframe,iso(start+2*step+1));assert.deepEqual(parsed.bars.map(v=>v.closedAt),[iso(start+step),iso(start+2*step)]);
 }
});
test('OHLC rejects holes, duplicates, reversals and misaligned starts without fabricating candles',()=>{
 for(const rows of [[row(),row(start+600000)],[row(),row()],[row(start+300000),row()]])reject(()=>parseKrakenOhlc(ohlc(rows),symbol,'5m',iso(start+1000000)),'OHLC_GAP');
 const misaligned=row(start+1000);reject(()=>parseKrakenOhlc(ohlc([misaligned]),symbol,'5m',iso(start+1000000)),'INVALID_OHLC');
});
test('future committed close and future current start fail instead of being relabeled by poll time',()=>{
 reject(()=>parseKrakenOhlc(ohlc(),symbol,'5m',iso(start+299999)),'FUTURE_DATA');reject(()=>parseKrakenOhlc(ohlc([row(start+300000)]),symbol,'5m',iso(start+1)),'FUTURE_DATA');
});
test('OHLC strict tuple shape, typed decimal fields and price coherence reject malformed ancillary or emitted data',()=>{
 const mutations=[v=>v.pop(),v=>v.push('unknown'),v=>v[0]+=0.1,v=>v[1]=100,v=>v[1]='0',v=>v[1]='NaN',v=>v[2]='99',v=>v[3]='101',v=>v[4]='103',v=>v[5]='-1',v=>v[6]='-1',v=>v[7]=1.5,v=>v[7]=Number.MAX_SAFE_INTEGER+1];
 for(const mutate of mutations){const value=row();mutate(value);reject(()=>parseKrakenOhlc(ohlc([value]),symbol,'5m',iso(start+1)),'INVALID_OHLC');}
 const emptyVolume=row();emptyVolume[5]='0';emptyVolume[6]='0';emptyVolume[7]=0;assert.equal(parseKrakenOhlc(ohlc([emptyVolume]),symbol,'5m',iso(start+1)).bars.length,0);
});
test('finite provider numeric bounds and exact decimal syntax exclude exponent, whitespace, overflow and unsupported values',()=>{
 for(const bad of ['1e2',' 100','100 ','+100','0x64','Infinity','1000000000001','1000000000000.00001','1'.repeat(65)]){const value=row();value[1]=bad;reject(()=>parseKrakenOhlc(ohlc([value]),symbol,'5m',iso(start+1)),'INVALID_OHLC');}
 const extreme=row();extreme[6]='1000000000000000001';reject(()=>parseKrakenOhlc(ohlc([extreme]),symbol,'5m',iso(start+1)),'INVALID_OHLC');
});
test('OHLC provider limit is 720 total rows, including unfinished final frame; warmup truncation belongs to the operator protocol',()=>{
 const rows=Array.from({length:720},(_,n)=>row(start+n*300000));assert.equal(parseKrakenOhlc(ohlc(rows),symbol,'5m',iso(start+720*300000)).bars.length,719);
 reject(()=>parseKrakenOhlc(ohlc([...rows,row(start+720*300000)]),symbol,'5m',iso(start+721*300000)),'INVALID_OHLC');reject(()=>parseKrakenOhlc(ohlc([]),symbol,'5m',iso(start+1)),'INVALID_OHLC');
});
test('exact response pair and envelope prevent alias, foreign pair, metadata and provider-error fallback',()=>{
 const alias={error:[],result:{XXBTZUSD:[row()],last:1}};reject(()=>parseKrakenOhlc(alias,symbol,'5m',iso(start+1)),'INVALID_RESPONSE');
 const foreign=ohlc();foreign.result['ETH/USD']=[row()];reject(()=>parseKrakenOhlc(foreign,symbol,'5m',iso(start+600000)),'INVALID_RESPONSE');
 const extra=ohlc();extra.auth='untrusted';reject(()=>parseKrakenOhlc(extra,symbol,'5m',iso(start+600000)),'INVALID_RESPONSE');
 const error={error:['EGeneral:invented failure text'],result:{}};reject(()=>parseKrakenOhlc(error,symbol,'5m',iso(start+600000)),'PROVIDER_ERROR');
});
test('cursor identity is bounded and opaque; it is not interpreted as a quote or repaired response timestamp',()=>{
 for(const last of [-1,1.1,'1',Number.MAX_SAFE_INTEGER+1]){const response=ohlc();response.result.last=last;reject(()=>parseKrakenOhlc(response,symbol,'5m',iso(start+600000)),'INVALID_CURSOR');}
 for(const last of [1,'x','-1','1.1','1'.repeat(33)])reject(()=>parseKrakenTrades(trades([],last),symbol,iso(start+600000)),'INVALID_CURSOR');
 assert.equal(parseKrakenTrades(trades([],'99999999999999999999999999999999'),symbol,iso(start)).last,'99999999999999999999999999999999');
});
test('bounded plain-data admission never executes accessors or toJSON and rejects nonfinite or ambiguous containers',async()=>{
 let calls=0;const getter={error:[],get result(){calls++;return {};}};reject(()=>parseKrakenOhlc(getter,symbol,'5m',iso(start)),'INVALID_RESPONSE');assert.equal(calls,0);
 const supplied=await config();Object.defineProperty(supplied,'sourceLabel',{enumerable:true,get(){calls++;return 'unexpected';}});reject(()=>validateFeedConfig(supplied),'INVALID_RESPONSE');assert.equal(calls,0);
 const withFunction=ohlc();withFunction.toJSON=()=>{calls++;return {};};reject(()=>parseKrakenOhlc(withFunction,symbol,'5m',iso(start)),'INVALID_RESPONSE');assert.equal(calls,0);
 for(const bad of [new Date(),NaN,Infinity,undefined])reject(()=>parseKrakenTrades(bad,symbol,iso(start)),'INVALID_RESPONSE');
 const sparse=trades();sparse.result[symbol][0]=new Array(7);reject(()=>parseKrakenTrades(sparse,symbol,iso(start+600000)),'INVALID_RESPONSE');
 const extra=trades();extra.result[symbol].extra=true;reject(()=>parseKrakenTrades(extra,symbol,iso(start+600000)),'INVALID_RESPONSE');
});
test('oversized and excessively deep provider input fail before ordinary parsing and keep sanitized errors',()=>{
 const enormous=ohlc();enormous.padding='x'.repeat(krakenFeedLimits.responseBytes);reject(()=>parseKrakenOhlc(enormous,symbol,'5m',iso(start)),'RESPONSE_LIMIT');
 let nested={};for(let n=0;n<20;n++)nested={nested};reject(()=>parseKrakenTrades(nested,symbol,iso(start)),'RESPONSE_LIMIT');
 const secret='og_local_owner_'+'a'.repeat(64),response={error:[secret],result:{}};assert.throws(()=>parseKrakenTrades(response,symbol,iso(start)),error=>error.code==='PROVIDER_ERROR'&&!JSON.stringify(error).includes(secret)&&!error.message.includes(secret));
});
test('trade source timestamp is floored to milliseconds without adopting response time or the opaque cursor',()=>{
 const actual=start+300000.875,parsed=parseKrakenTrades(trades([trade(actual,'101.5')]),symbol,iso(start+301000));assert.deepEqual(parsed,{quote:{observedAt:iso(start+300000),price:101.5},last:'9999999999999999999',stale:false});
});
test('greatest genuine trade time is selected from unordered input and final tuple resolves only exact raw-time ties',()=>{
 const selected=parseKrakenTrades(trades([trade(start+300002,'101',1),trade(start+300001,'99',2),trade(start+300002,'102',3)]),symbol,iso(start+301000));assert.deepEqual(selected.quote,{observedAt:iso(start+300002),price:102});
 const collapsed=parseKrakenTrades(trades([trade(start+300000.125,'100',1),trade(start+300000.875,'101',2)]),symbol,iso(start+301000));assert.deepEqual(collapsed.quote,{observedAt:iso(start+300000),price:101});
});
test('stale and empty observations return explicit no-quote dispositions without timestamp repair',()=>{
 const old=parseKrakenTrades(trades([trade(start)]),symbol,iso(start+60001));assert.equal(old.quote,null);assert.equal(old.stale,true);
 const boundary=parseKrakenTrades(trades([trade(start)]),symbol,iso(start+60000));assert.equal(boundary.quote.observedAt,iso(start));assert.equal(boundary.stale,false);
 assert.deepEqual(parseKrakenTrades(trades([]),symbol,iso(start+1)),{quote:null,last:'9999999999999999999',stale:false});
});
test('a raw future fractional timestamp is rejected even if flooring would hide its future age',()=>{
 reject(()=>parseKrakenTrades(trades([trade(start+.125)]),symbol,iso(start)),'FUTURE_DATA');
 reject(()=>parseKrakenTrades(trades([trade(start+1000,'100',1),trade(start+5000,'101',2)]),symbol,iso(start+2000)),'FUTURE_DATA');
});
test('trade tuples reject invalid fields, unsafe IDs and duplicate identity instead of silently merging conflicting observations',()=>{
 const mutations=[v=>v.pop(),v=>v.push('extra'),v=>v[0]=100,v=>v[0]='0',v=>v[0]='1000000000001',v=>v[1]='-1',v=>v[2]='1767225600',v=>v[2]=-1,v=>v[3]='buy',v=>v[4]='market',v=>v[5]='x'.repeat(33),v=>v[5]='\n',v=>v[6]='1',v=>v[6]=1.1,v=>v[6]=Number.MAX_SAFE_INTEGER+1];
 for(const mutate of mutations){const value=trade();mutate(value);reject(()=>parseKrakenTrades(trades([value]),symbol,iso(start+301000)),'INVALID_TRADES');}
 reject(()=>parseKrakenTrades(trades([trade(start+300000,'100',1),trade(start+300001,'101',1)]),symbol,iso(start+301000)),'INVALID_TRADES');
});
test('nonfinite provider numbers and invalid poll clocks fail with stable sanitized classifications',()=>{
 const infinite=trade();infinite[2]=Infinity;reject(()=>parseKrakenTrades(trades([infinite]),symbol,iso(start+301000)),'INVALID_RESPONSE');
 for(const clock of ['2026-01-01','2026-01-01T00:00:00Z','2026-02-30T00:00:00.000Z',iso(start).replace('Z','+00:00'),1,null])reject(()=>parseKrakenTrades(trades(),symbol,clock),'INVALID_CLOCK');
});
test('trade-row bounds and repeated polls preserve the same actual source identity, with no hidden event-ID generation',()=>{
 const rows=Array.from({length:1000},(_,n)=>trade(start+n*1000,'100',n+1)),received=iso(start+1000000),parsed=parseKrakenTrades(trades(rows),symbol,received);assert.equal(parsed.quote.observedAt,iso(start+999000));assert.deepEqual(parseKrakenTrades(trades(rows),symbol,received),parsed);assert.deepEqual(Object.keys(parsed.quote),['observedAt','price']);
 reject(()=>parseKrakenTrades(trades([...rows,trade(start+1000000,'100',1001)]),symbol,iso(start+1000001)),'INVALID_TRADES');
});
test('actual Session reducer keeps a prefetched trade from filling a later candle decision, then admits only a genuinely later observed quote',async()=>{
 const supplied=await config(),bars=parseKrakenOhlc(ohlc(),symbol,'5m',iso(start+302000)).bars;let state=await methods.createSession(supplied,iso(start));
 state=await methods.advanceSession(state,{requestId:id(10),type:'CLOSED_BAR',bar:bars[0]},iso(start+302000));assert(state.pending);assert.equal(state.openPositions.length,0);
 const prefetched=parseKrakenTrades(trades([trade(start+301000,'100',1)]),symbol,iso(start+303000)).quote;state=await methods.advanceSession(state,{requestId:id(11),type:'QUOTE',...prefetched},iso(start+303000));assert(state.pending);assert.equal(state.openPositions.length,0);assert(state.audit.some(row=>row.reason==='AWAITING_FRESH_QUOTE'));
 const fresh=parseKrakenTrades(trades([trade(start+304000,'100',2)]),symbol,iso(start+305000)).quote;state=await methods.advanceSession(state,{requestId:id(12),type:'QUOTE',...fresh},iso(start+305000));assert.equal(state.openPositions.length,1);assert.equal(state.openPositions[0].entryObservedAt,iso(start+304000));assert.equal(state.openPositions[0].entryAt,iso(start+305000));assert.equal(state.ordersEnabled,false);assert.equal(state.liveEnabled,false);assert.equal(state.classification,'AUTHOR_REPORTED');assert.equal(state.qualification,'NONE');
});
