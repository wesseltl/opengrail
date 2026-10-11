// Fixed, read-only Spot response normalization. This module performs no I/O,
// authentication, strategy evaluation, delivery or source-attestation work.
export const krakenFeedLimits=Object.freeze({responseBytes:262144,warmupBars:300,cycles:120,minPollMs:15000,maxAgeMs:60000,ohlcRows:720,tradeRows:1000,maxPrice:1e12,maxVolume:1e18,decimalCharacters:64});
const intervals=Object.freeze({'5m':5,'15m':15,'1h':60,'4h':240,'1d':1440});
const symbols=/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/;
const uuids=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hashes=/^[a-f0-9]{64}$/;

export class KrakenFeedError extends Error{
 constructor(code,status=400){const safe=typeof code==='string'&&/^[A-Z_]{1,64}$/.test(code)?code:'INVALID_FEED';super(safe);this.name='KrakenFeedError';this.code=safe;this.status=status;}
}
const fail=(code,status=400)=>{throw new KrakenFeedError(code,status);};
/** Inspect plain descriptors before serializing; getters/toJSON are never read. */
function plain(raw,bytes=krakenFeedLimits.responseBytes){
 let nodes=0;
 function visit(value,depth){
  if(++nodes>16000||depth>16)fail('RESPONSE_LIMIT',413);
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('INVALID_RESPONSE');return;}
  if(typeof value!=='object'||Object.getOwnPropertySymbols(value).length)fail('INVALID_RESPONSE');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('INVALID_RESPONSE');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(array&&Object.keys(descriptors).length!==value.length+1)fail('INVALID_RESPONSE');
  for(const [key,descriptor]of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   if(!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))fail('INVALID_RESPONSE');
   visit(descriptor.value,depth+1);
  }
 }
 visit(raw,0);
 if(new TextEncoder().encode(JSON.stringify(raw)).byteLength>bytes)fail('RESPONSE_LIMIT',413);
 return raw;
}
function object(value,keys,code='INVALID_RESPONSE'){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(code);
 return value;
}
function market(symbol,timeframe){
 if(typeof symbol!=='string'||!symbols.test(symbol))fail('INVALID_SYMBOL');
 if(typeof timeframe!=='string'||!Object.hasOwn(intervals,timeframe))fail('INVALID_TIMEFRAME');
 return {symbol,timeframe,intervalMinutes:intervals[timeframe]};
}
function clock(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))fail('INVALID_CLOCK');
 const ms=Date.parse(value);if(!Number.isSafeInteger(ms)||new Date(ms).toISOString()!==value)fail('INVALID_CLOCK');return ms;
}
function decimal(value,maximum,positive=true,code='INVALID_RESPONSE'){
 if(typeof value!=='string'||value.length>krakenFeedLimits.decimalCharacters||!/^\d+(?:\.\d+)?$/.test(value))fail(code);
 // Compare the declared upper bound before binary floating-point conversion:
 // e.g. maxVolume + 1 must not round down to maxVolume and pass admission.
 const [whole,fraction='']=value.split('.'),limit=BigInt(maximum),integral=BigInt(whole);
 if(integral>limit||integral===limit&&/[1-9]/.test(fraction))fail(code);
 const number=Number(value);if(!Number.isFinite(number)||number<0||positive&&number===0||number>maximum)fail(code);return number;
}
function integer(value,code){if(!Number.isSafeInteger(value)||value<0)fail(code);return value;}
function envelope(raw,symbol){
 plain(raw);object(raw,['error','result']);
 if(!Array.isArray(raw.error)||raw.error.length>16||raw.error.some(error=>typeof error!=='string'||error.length>512))fail('INVALID_RESPONSE');
 if(raw.error.length)fail('PROVIDER_ERROR',502);
 object(raw.result,[symbol,'last']);return raw.result;
}

/** The caller must first parse the complete existing SessionConfig schema and
 * verify its strategy digest. These additional fences select the read-only feed;
 * they do not replace canonical configuration validation or grant data rights. */
export function validateFeedConfig(raw){
 plain(raw,32768);
 const expected=['version','sessionId','methodVersion','clockMode','origin','strategy','initialCapital','provenance','rights','sourceLabel','ordersEnabled','liveEnabled'];
 object(raw,expected,'INVALID_CONFIG');
 object(raw.rights,['permission','acknowledged','note'],'INVALID_CONFIG');object(raw.strategy,['record','digest'],'INVALID_CONFIG');
 const record=raw.strategy.record,definition=record?.content?.definition;
 if(raw.version!==1||typeof raw.sessionId!=='string'||!uuids.test(raw.sessionId)||raw.methodVersion!=='opengrail-session-v1'||raw.clockMode!=='SYSTEM_RECEIPT'||raw.origin!=='PUBLIC_STRATEGY'||raw.provenance!=='USER_SUPPLIED'||raw.rights.permission!=='AUTHORIZED_USE'||raw.rights.acknowledged!==true||raw.ordersEnabled!==false||raw.liveEnabled!==false||typeof raw.strategy.digest!=='string'||!hashes.test(raw.strategy.digest)||record?.executionEnabled!==false||record?.verification!=='UNTESTED'||definition?.execution?.mode!=='DEMO'||definition?.execution?.leverage!==1||definition?.execution?.ordersEnabled!==false||!Number.isFinite(raw.initialCapital)||raw.initialCapital<.01||raw.initialCapital>1e6||typeof raw.sourceLabel!=='string'||!raw.sourceLabel.trim()||raw.sourceLabel.length>80||typeof raw.rights.note!=='string'||!raw.rights.note.trim()||raw.rights.note.length>1000)fail('INVALID_CONFIG');
 // SIGNAL remains a declaration needing its own authorized provider. Kraken
 // trades and candles are never translated into bullish/bearish signal labels.
 return market(definition?.market?.symbol,definition?.market?.timeframe);
}

export function makeKrakenUrl(endpoint,symbol,timeframe){
 const selected=market(symbol,timeframe);if(endpoint!=='OHLC'&&endpoint!=='Trades')fail('INVALID_ENDPOINT');
 const url=new URL('https://api.kraken.com/0/public/'+endpoint);
 url.searchParams.set('pair',selected.symbol);url.searchParams.set('assetVersion','1');
 if(endpoint==='OHLC')url.searchParams.set('interval',String(selected.intervalMinutes));else url.searchParams.set('count',String(krakenFeedLimits.tradeRows));
 return url;
}

export function parseKrakenOhlc(raw,symbol,timeframe,pollReceivedAt){
 const {intervalMinutes}=market(symbol,timeframe),received=clock(pollReceivedAt),step=intervalMinutes*60000,result=envelope(raw,symbol),rows=result[symbol];
 if(!Array.isArray(rows)||rows.length<1||rows.length>krakenFeedLimits.ohlcRows)fail('INVALID_OHLC');
 const last=integer(result.last,'INVALID_CURSOR'),bars=[];let previous=null;
 for(let n=0;n<rows.length;n++){
  const row=rows[n];if(!Array.isArray(row)||row.length!==8)fail('INVALID_OHLC');
  const start=integer(row[0],'INVALID_OHLC')*1000,end=start+step;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start%step!==0)fail('INVALID_OHLC');
  if(start>received||n<rows.length-1&&end>received)fail('FUTURE_DATA');
  if(previous!==null&&start-previous!==step)fail('OHLC_GAP');previous=start;
  const open=decimal(row[1],krakenFeedLimits.maxPrice,true,'INVALID_OHLC'),high=decimal(row[2],krakenFeedLimits.maxPrice,true,'INVALID_OHLC'),low=decimal(row[3],krakenFeedLimits.maxPrice,true,'INVALID_OHLC'),close=decimal(row[4],krakenFeedLimits.maxPrice,true,'INVALID_OHLC');
  decimal(row[5],krakenFeedLimits.maxPrice,false,'INVALID_OHLC');const volume=decimal(row[6],krakenFeedLimits.maxVolume,false,'INVALID_OHLC');integer(row[7],'INVALID_OHLC');
  if(low>Math.min(open,close)||high<Math.max(open,close)||low>high)fail('INVALID_OHLC');
  // The provider explicitly says the final entry is unfinished regardless of
  // `since`. Even an old-looking final frame is never promoted to a closed bar.
  if(n<rows.length-1)bars.push({closedAt:new Date(end).toISOString(),open,high,low,close,volume});
 }
 return {bars,currentOmitted:true,last:String(last)};
}

export function parseKrakenTrades(raw,symbol,pollReceivedAt){
 if(typeof symbol!=='string'||!symbols.test(symbol))fail('INVALID_SYMBOL');
 const received=clock(pollReceivedAt),result=envelope(raw,symbol),rows=result[symbol];
 if(!Array.isArray(rows)||rows.length>krakenFeedLimits.tradeRows)fail('INVALID_TRADES');
 if(typeof result.last!=='string'||!/^\d{1,32}$/.test(result.last))fail('INVALID_CURSOR');
 let latest=null;const ids=new Set();
 for(const row of rows){
  if(!Array.isArray(row)||row.length!==7)fail('INVALID_TRADES');
  const price=decimal(row[0],krakenFeedLimits.maxPrice,true,'INVALID_TRADES');decimal(row[1],krakenFeedLimits.maxVolume,false,'INVALID_TRADES');
  const time=row[2],ms=time*1000;
  if(typeof time!=='number'||!Number.isFinite(time)||time<0||!Number.isSafeInteger(Math.floor(ms)))fail('INVALID_TRADES');
  if(ms>received)fail('FUTURE_DATA');
  if(!['b','s'].includes(row[3])||!['m','l'].includes(row[4])||typeof row[5]!=='string'||row[5].length>32||/[^\x20-\x7e]/.test(row[5]))fail('INVALID_TRADES');
  const tradeId=integer(row[6],'INVALID_TRADES');if(ids.has(tradeId))fail('INVALID_TRADES');ids.add(tradeId);
  // Final tuple wins only when the genuine raw source time is exactly equal.
  // Flooring to milliseconds is never repaired or advanced to imply freshness.
  if(latest===null||time>=latest.time)latest={time,ms:Math.floor(ms),price};
 }
 const stale=latest!==null&&received-latest.ms>krakenFeedLimits.maxAgeMs;
 return {quote:latest===null||stale?null:{observedAt:new Date(latest.ms).toISOString(),price:latest.price},last:result.last,stale};
}
