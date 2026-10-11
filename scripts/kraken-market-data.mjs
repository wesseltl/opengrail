import {createHash,randomUUID} from 'node:crypto';
import {openSync,closeSync,fstatSync,readSync,writeFileSync,fsyncSync,renameSync,linkSync,unlinkSync,realpathSync,constants,mkdtempSync,rmSync} from 'node:fs';
import {dirname,basename,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {z} from 'zod';
import {receiverNoSecrets,receiverInstance} from './session-receiver-protocol.mjs';
import {krakenFeedLimits,KrakenFeedError,validateFeedConfig,makeKrakenUrl,parseKrakenOhlc,parseKrakenTrades} from './kraken-market-data-core.mjs';

export const producerLimits=Object.freeze({stateBytes:4194304,events:1800,deliveryAttempts:8,authorizationBytes:2048,responseBytes:131072,requestMs:8000});
const project=fileURLToPath(new URL('../',import.meta.url)),sha=v=>createHash('sha256').update(v).digest('hex');
const hash=z.string().regex(/^[a-f0-9]{64}$/),uuid=z.string().uuid().refine(v=>v===v.toLowerCase()),clock=z.string().datetime().refine(v=>new Date(v).toISOString()===v);
const implementationSchema=z.object({version:z.literal('opengrail-session-v1'),engine:hash,model:hash,journal:hash}).strict();
const authorizationSchema=z.object({receiverOrigin:z.string().max(80),sessionInstance:hash,receiverStartedAt:clock,receiverImplementation:implementationSchema,producerToken:z.string().regex(/^og_local_producer_[a-f0-9]{64}$/),publicDataUseApproved:z.literal(true),sharedIpRateBudgetApproved:z.literal(true),pollMs:z.number().int().min(krakenFeedLimits.minPollMs).max(3600000),cycles:z.number().int().min(1).max(krakenFeedLimits.cycles)}).strict();
export function validateProducerAuthorization(raw){
 let value;try{value=authorizationSchema.parse(raw);}catch{throw new KrakenFeedError('INVALID_OPERATOR_AUTHORIZATION');}
 let url;try{url=new URL(value.receiverOrigin);}catch{throw new KrakenFeedError('INVALID_RECEIVER_ORIGIN');}
 if(url.origin!==value.receiverOrigin||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new KrakenFeedError('INVALID_RECEIVER_ORIGIN');
 return value;
}
let modulePromise,temporary;
export function loadProducerModules(){
 return modulePromise??=(async()=>{
  const result=await build({stdin:{contents:"export {parseUniqueJson} from './app/unique-json';export {boundedSessionConfig,boundedSessionEvent,sessionReasons} from './app/session-model';export {strategyDigest} from './app/strategy-model';export {sessionSourceFingerprints} from './app/session-fingerprints';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
  temporary=mkdtempSync(join(tmpdir(),'opengrail-read-only-feed-'));const path=join(temporary,'fixed-validation.mjs');writeFileSync(path,result.outputFiles[0].text,{flag:'wx',mode:0o600});return import(pathToFileURL(path).href);
 })();
}
export function cleanupProducerModules(){if(temporary){rmSync(temporary,{recursive:true,force:true});temporary=undefined;}}
function readBytes(path,maximum,privateFile=false){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum||privateFile&&((stat.mode&0o777)!==0o600||process.getuid&&stat.uid!==process.getuid()))throw new KrakenFeedError('INVALID_LOCAL_FILE');
  const bytes=Buffer.alloc(stat.size+1);let count=0;for(;;){const n=readSync(fd,bytes,count,bytes.length-count,null);if(!n)break;count+=n;if(count===bytes.length)throw new KrakenFeedError('CHANGED_LOCAL_FILE');}return bytes.subarray(0,count);
 }finally{closeSync(fd);}
}
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
export async function readProducerConfig(path){const m=await loadProducerModules(),config=m.boundedSessionConfig(m.parseUniqueJson(decode(readBytes(path,32768)),32768,24)).config;receiverNoSecrets(config);validateFeedConfig(config);if(sha(JSON.stringify(config.strategy.record))!==config.strategy.digest)throw new KrakenFeedError('STRATEGY_DIGEST_MISMATCH');return config;}
const receiptSchema=z.object({requestId:uuid,eventDigest:hash,receivedAt:clock,sequence:z.number().int().min(1).max(2032),disposition:z.enum(['ACCEPTED','REJECTED']),reason:z.string().max(64)}).strict();
const envelopeSchema=z.object({version:z.literal(1),sessionId:uuid,sessionInstance:hash,receipt:receiptSchema,duplicate:z.boolean(),stateDigest:hash,journalDigest:hash,ordersEnabled:z.literal(false)}).strict();
const attemptSchema=z.object({startedAt:clock,status:z.enum(['PENDING','CONFIRMED','UNCONFIRMED']),reason:z.string().regex(/^[A-Z0-9_]{1,64}$/).nullable()}).strict();
const entrySchema=z.object({poll:z.number().int().min(1).max(120),event:z.unknown(),eventDigest:hash,status:z.enum(['PENDING','CONFIRMED']),attempts:z.array(attemptSchema).max(producerLimits.deliveryAttempts),confirmation:envelopeSchema.nullable()}).strict();
const pollSchema=z.object({index:z.number().int().min(1).max(120),startedAt:clock,finishedAt:clock.nullable(),status:z.enum(['PENDING','READY','FAILED','INTERRUPTED']),reason:z.string().regex(/^[A-Z0-9_]{1,64}$/).nullable(),ohlcDigest:hash.nullable(),tradesDigest:hash.nullable(),ohlcCursor:z.string().regex(/^\d{1,32}$/).nullable(),tradesCursor:z.string().regex(/^\d{1,32}$/).nullable(),closedBarsSeen:z.number().int().min(0).max(719),warmupBarsOmitted:z.number().int().min(0).max(719),currentBarOmitted:z.boolean(),staleQuote:z.boolean(),repeatedQuote:z.boolean()}).strict();
const stateSchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_KRAKEN_MARKET_DATA'),method:z.literal('sampled-kraken-rest-v1'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),sourceAuthentication:z.literal('UNKNOWN'),ordersEnabled:z.literal(false),liveEnabled:z.literal(false),configDigest:hash,sessionId:uuid,sessionInstance:hash,symbol:z.string().regex(/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/),timeframe:z.enum(['5m','15m','1h','4h','1d']),startedAt:clock,pollMs:z.number().int().min(15000).max(3600000),cyclesMaximum:z.number().int().min(1).max(120),status:z.enum(['ACTIVE','INTERRUPTED','UNCERTAIN','COMPLETED','FAILED']),reason:z.string().regex(/^[A-Z0-9_]{1,64}$/).nullable(),clockFault:z.object({at:clock,previousAt:clock}).strict().nullable(),polls:z.array(pollSchema).max(120),entries:z.array(entrySchema).max(producerLimits.events),lastBar:clock.nullable(),lastQuote:clock.nullable(),stateDigest:hash}).strict();
function digestState(state){const {stateDigest:_,...body}=state;return sha(JSON.stringify(body));}
export async function validateProducerState(raw,config,authorization){
 const m=await loadProducerModules();let state;try{state=stateSchema.parse(raw);}catch{throw new KrakenFeedError('INVALID_PRODUCER_STATE');}receiverNoSecrets(state);
 if(state.stateDigest!==digestState(state)||state.configDigest!==sha(JSON.stringify(config))||state.sessionId!==config.sessionId||state.sessionInstance!==authorization.sessionInstance||state.symbol!==config.strategy.record.content.definition.market.symbol||state.timeframe!==config.strategy.record.content.definition.market.timeframe||state.pollMs!==authorization.pollMs||state.cyclesMaximum!==authorization.cycles||state.polls.length>state.cyclesMaximum)throw new KrakenFeedError('PRODUCER_CONTEXT_MISMATCH');
 const ids=new Set();let pending=false,lastBar=null,lastQuote=null,lastPoll=0,lastSequence=0,rejected=false;
 if(state.clockFault&&(state.status!=='FAILED'||state.reason!=='CLOCK_REGRESSION'||state.clockFault.at>=state.clockFault.previousAt))throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');
 for(let n=0;n<state.polls.length;n++){const p=state.polls[n];if(p.index!==n+1||n&&p.startedAt<state.polls[n-1].startedAt||p.finishedAt&&p.finishedAt<p.startedAt&&!(p.reason==='CLOCK_REGRESSION'&&state.clockFault?.at===p.finishedAt)||p.status==='PENDING'&&(n!==state.polls.length-1||p.finishedAt!==null)||p.status==='READY'&&(!p.finishedAt||!p.ohlcDigest||!p.tradesDigest||!p.currentBarOmitted||p.reason)||['FAILED','INTERRUPTED'].includes(p.status)&&(!p.finishedAt||!p.reason))throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');}
 const step={ '5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000}[state.timeframe];
 for(const entry of state.entries){const e=m.boundedSessionEvent(entry.event).event;if(!['QUOTE','CLOSED_BAR'].includes(e.type)||ids.has(e.requestId)||entry.poll<lastPoll||state.polls[entry.poll-1]?.status!=='READY'||JSON.stringify(e)!==JSON.stringify(entry.event)||sha(JSON.stringify(e))!==entry.eventDigest)throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');ids.add(e.requestId);lastPoll=entry.poll;
  for(let n=0;n<entry.attempts.length;n++){const a=entry.attempts[n];if(n&&a.startedAt<entry.attempts[n-1].startedAt||a.status==='PENDING'&&(n!==entry.attempts.length-1||a.reason)||a.status==='CONFIRMED'&&(n!==entry.attempts.length-1||a.reason)||a.status==='UNCONFIRMED'&&!a.reason)throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');}
  if(entry.status==='PENDING'){pending=true;if(entry.confirmation!==null)throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');continue;}
  if(pending||rejected||!entry.confirmation||entry.attempts.at(-1)?.status!=='CONFIRMED')throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');const result=validateConfirmation(entry.confirmation,state,e,m);if(result.receipt.sequence<=lastSequence)throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');lastSequence=result.receipt.sequence;
  if(result.receipt.disposition==='REJECTED'){rejected=true;continue;}
  if(e.type==='CLOSED_BAR'){if(lastBar&&Date.parse(e.bar.closedAt)-Date.parse(lastBar)!==step)throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');lastBar=e.bar.closedAt;}else{if(lastQuote&&e.observedAt<=lastQuote)throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');lastQuote=e.observedAt;}
 }
 if(lastBar!==state.lastBar||lastQuote!==state.lastQuote||rejected&&state.status!=='FAILED'||state.status==='COMPLETED'&&(pending||state.polls.length!==state.cyclesMaximum||state.polls.some(p=>p.status==='PENDING')))throw new KrakenFeedError('INVALID_PRODUCER_HISTORY');return state;
}
export class ProducerStore{
 constructor(path){this.path=join(realpathSync(dirname(path)),basename(path));this.digest=null;this.alive=()=>true;}
 read(){const bytes=readBytes(this.path,producerLimits.stateBytes,true);this.digest=sha(bytes);return decode(bytes);}
 check(){if(!this.alive())throw new KrakenFeedError('LOST_WRITER_LOCK');if(this.digest===null||sha(readBytes(this.path,producerLimits.stateBytes,true))!==this.digest)throw new KrakenFeedError('EXTERNAL_PRODUCER_CHANGE');}
 save(state){
  if(!this.alive())throw new KrakenFeedError('LOST_WRITER_LOCK');state.stateDigest=digestState(state);const bytes=Buffer.from(JSON.stringify(state));if(bytes.length>producerLimits.stateBytes)throw new KrakenFeedError('PRODUCER_BYTE_CAPACITY');receiverNoSecrets(state);
  if(this.digest!==null&&sha(readBytes(this.path,producerLimits.stateBytes,true))!==this.digest)throw new KrakenFeedError('EXTERNAL_PRODUCER_CHANGE');
  const temporaryPath=join(dirname(this.path),'.opengrail-feed-'+randomUUID()+'.tmp');let fd;
  try{fd=openSync(temporaryPath,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;if(!this.alive())throw new KrakenFeedError('LOST_WRITER_LOCK');if(this.digest===null){linkSync(temporaryPath,this.path);unlinkSync(temporaryPath);}else renameSync(temporaryPath,this.path);const parent=openSync(dirname(this.path),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(parent);}finally{closeSync(parent);}this.digest=sha(bytes);}
  finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temporaryPath);}catch{}}
 }
}
export function validateConfirmation(raw,state,event,m){
 let value;try{value=envelopeSchema.parse(raw);}catch{throw new KrakenFeedError('UNCONFIRMED_RECEIVER_RESPONSE');}
 if(value.sessionId!==state.sessionId||value.sessionInstance!==state.sessionInstance||value.receipt.requestId!==event.requestId||value.receipt.eventDigest!==sha(JSON.stringify(event))||!m.sessionReasons.includes(value.receipt.reason))throw new KrakenFeedError('UNCONFIRMED_RECEIVER_RESPONSE');return value;
}
async function jsonResponse(response,maximum,m){
 if(!response||!/^(?:application\/json)(?:\s*;.*)?$/i.test(response.headers.get('content-type')??''))throw new KrakenFeedError('INVALID_RESPONSE_TYPE');const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maximum))throw new KrakenFeedError('RESPONSE_BYTE_CAPACITY');
 const reader=response.body?.getReader();if(!reader)throw new KrakenFeedError('INVALID_RESPONSE_BODY');let parts=[],size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum)throw new KrakenFeedError('RESPONSE_BYTE_CAPACITY');parts.push(value);}const bytes=Buffer.concat(parts.map(v=>Buffer.from(v)));return {raw:m.parseUniqueJson(decode(bytes),maximum,16),digest:sha(bytes)};}catch(error){try{await reader.cancel();}catch{}throw error;}
}
const safeCode=error=>error instanceof KrakenFeedError&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'UNCONFIRMED_OPERATION';
function guardedClock(state,now,store){
 const at=now();if(!clock.safeParse(at).success)throw new KrakenFeedError('INVALID_LOCAL_CLOCK');let previousAt=state.startedAt;
 for(const p of state.polls)for(const time of [p.startedAt,p.finishedAt])if(time&&time>previousAt)previousAt=time;
 for(const entry of state.entries){for(const attempt of entry.attempts)if(attempt.startedAt>previousAt)previousAt=attempt.startedAt;const receivedAt=entry.confirmation?.receipt.receivedAt;if(receivedAt&&receivedAt>previousAt)previousAt=receivedAt;}
 if(at<previousAt){state.status='FAILED';state.reason='CLOCK_REGRESSION';state.clockFault={at,previousAt};for(const p of state.polls)if(p.status==='PENDING'){p.status='FAILED';p.finishedAt=at;p.reason='CLOCK_REGRESSION';}for(const entry of state.entries){const a=entry.attempts.at(-1);if(a?.status==='PENDING'){a.status='UNCONFIRMED';a.reason='CLOCK_REGRESSION';}}store.save(state);throw new KrakenFeedError('CLOCK_REGRESSION');}return at;
}
/** Fixed public GETs and loopback-only producer writes. Injection is for local synthetic tests, never CLI options. */
export async function runProducer({command,config,authorization,store,sourceFetch=fetch,receiverFetch=fetch,sleep=delay,now=()=>new Date().toISOString(),interrupted=()=>false,emit=()=>{}}){
 const m=await loadProducerModules(),auth=validateProducerAuthorization(authorization),market=validateFeedConfig(config);receiverNoSecrets(config);if(sha(JSON.stringify(config.strategy.record))!==config.strategy.digest)throw new KrakenFeedError('STRATEGY_DIGEST_MISMATCH');
 if(JSON.stringify(auth.receiverImplementation)!==JSON.stringify({version:'opengrail-session-v1',...m.sessionSourceFingerprints})||receiverInstance({config,startedAt:auth.receiverStartedAt,implementation:auth.receiverImplementation})!==auth.sessionInstance)throw new KrakenFeedError('RECEIVER_CONFIG_MISMATCH');
 let state;
 if(command==='start'){const startedAt=now();if(!clock.safeParse(startedAt).success)throw new KrakenFeedError('INVALID_LOCAL_CLOCK');state={version:1,kind:'LOCAL_KRAKEN_MARKET_DATA',method:'sampled-kraken-rest-v1',classification:'AUTHOR_REPORTED',qualification:'NONE',sourceAuthentication:'UNKNOWN',ordersEnabled:false,liveEnabled:false,configDigest:sha(JSON.stringify(config)),sessionId:config.sessionId,sessionInstance:auth.sessionInstance,symbol:market.symbol,timeframe:market.timeframe,startedAt,pollMs:auth.pollMs,cyclesMaximum:auth.cycles,status:'ACTIVE',reason:null,clockFault:null,polls:[],entries:[],lastBar:null,lastQuote:null,stateDigest:'0'.repeat(64)};store.save(state);}
 else if(command==='resume'){state=await validateProducerState(m.parseUniqueJson(store.read(),producerLimits.stateBytes,24),config,auth);if(['FAILED','COMPLETED'].includes(state.status))throw new KrakenFeedError('TERMINAL_PRODUCER_STATE');const resumedAt=guardedClock(state,now,store);for(const p of state.polls)if(p.status==='PENDING'){p.status='INTERRUPTED';p.finishedAt=resumedAt;p.reason='FETCH_INTERRUPTED';}for(const entry of state.entries){const attempt=entry.attempts.at(-1);if(attempt?.status==='PENDING'){attempt.status='UNCONFIRMED';attempt.reason='DELIVERY_INTERRUPTED';}}state.status='ACTIVE';state.reason=null;store.save(state);}
 else throw new KrakenFeedError('INVALID_COMMAND');
 const headers={'Authorization':'Bearer '+auth.producerToken,'X-Session-Id':state.sessionId,'X-Session-Instance':state.sessionInstance};
 const currentTime=()=>Date.parse(guardedClock(state,now,store));
 async function pause(milliseconds){if(milliseconds<0||milliseconds>state.pollMs)throw new KrakenFeedError('CLOCK_REGRESSION');for(let left=milliseconds;left>0;){if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');const part=Math.min(left,1000);await sleep(part);left-=part;}if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');}
 async function delivery(entry,reconcile){
  const event=entry.event,options={headers,redirect:'error',signal:AbortSignal.timeout(producerLimits.requestMs)};let response;
  store.check();currentTime();if(reconcile){response=await receiverFetch(new URL('/api/receipts/'+event.requestId,auth.receiverOrigin),options);if(response.status===200){const parsed=await jsonResponse(response,producerLimits.responseBytes,m);return validateConfirmation(parsed.raw,state,event,m);}if(response.status!==404)throw new KrakenFeedError('RECEIPT_LOOKUP_UNCONFIRMED');const parsed=await jsonResponse(response,producerLimits.responseBytes,m);if(parsed.raw?.version!==1||parsed.raw.error!=='NOT_FOUND'||parsed.raw.confirmed!==false||parsed.raw.ordersEnabled!==false)throw new KrakenFeedError('RECEIPT_LOOKUP_UNCONFIRMED');}
  store.check();currentTime();if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');response=await receiverFetch(new URL('/api/events',auth.receiverOrigin),{...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(event)});if(response.status!==200)throw new KrakenFeedError('RECEIVER_WRITE_UNCONFIRMED');const parsed=await jsonResponse(response,producerLimits.responseBytes,m);return validateConfirmation(parsed.raw,state,event,m);
 }
 async function drain(reconcile){
  for(const entry of state.entries){if(entry.status==='CONFIRMED')continue;if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');
   if(entry.attempts.length>=producerLimits.deliveryAttempts){state.status='FAILED';state.reason='DELIVERY_ATTEMPT_CAPACITY';store.save(state);throw new KrakenFeedError(state.reason);}const attempt={startedAt:guardedClock(state,now,store),status:'PENDING',reason:null};entry.attempts.push(attempt);store.save(state);
   let result;try{result=await delivery(entry,reconcile);currentTime();}catch(error){attempt.status='UNCONFIRMED';attempt.reason=safeCode(error);if(state.status!=='FAILED'){state.status='UNCERTAIN';state.reason=attempt.reason;}store.save(state);throw new KrakenFeedError(state.reason);}
   attempt.status='CONFIRMED';entry.confirmation=result;entry.status='CONFIRMED';if(result.receipt.disposition==='REJECTED'){state.status='FAILED';state.reason='CONFIRMED_REJECTION';store.save(state);emit({type:'FEED_REJECTED',requestId:entry.event.requestId,reason:result.receipt.reason,ordersEnabled:false});throw new KrakenFeedError('CONFIRMED_REJECTION');}
   if(entry.event.type==='CLOSED_BAR')state.lastBar=entry.event.bar.closedAt;else state.lastQuote=entry.event.observedAt;store.save(state);emit({type:'FEED_RECEIPT',requestId:entry.event.requestId,sequence:result.receipt.sequence,disposition:result.receipt.disposition,reason:result.receipt.reason,ordersEnabled:false});
  }
 }
 try{
  await drain(command==='resume');
  while(state.polls.length<state.cyclesMaximum){
   if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');const previous=state.polls.at(-1);if(previous){let time=currentTime();if(time<Date.parse(previous.startedAt))throw new KrakenFeedError('CLOCK_REGRESSION');const wait=Date.parse(previous.startedAt)+state.pollMs-time;if(wait>0){await pause(wait);time=currentTime();if(time<Date.parse(previous.startedAt))throw new KrakenFeedError('CLOCK_REGRESSION');}}if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');
   const p={index:state.polls.length+1,startedAt:guardedClock(state,now,store),finishedAt:null,status:'PENDING',reason:null,ohlcDigest:null,tradesDigest:null,ohlcCursor:null,tradesCursor:null,closedBarsSeen:0,warmupBarsOmitted:0,currentBarOmitted:false,staleQuote:false,repeatedQuote:false};if(previous&&p.startedAt<previous.startedAt)throw new KrakenFeedError('CLOCK_REGRESSION');state.polls.push(p);store.save(state);
   try{
    const start=currentTime();store.check();let response=await sourceFetch(makeKrakenUrl('OHLC',state.symbol,state.timeframe),{method:'GET',redirect:'error',signal:AbortSignal.timeout(producerLimits.requestMs)});if(response.status!==200)throw new KrakenFeedError('PROVIDER_HTTP_FAILURE');const o=await jsonResponse(response,krakenFeedLimits.responseBytes,m);const bars=parseKrakenOhlc(o.raw,state.symbol,state.timeframe,guardedClock(state,now,store));p.ohlcDigest=o.digest;p.ohlcCursor=bars.last;p.currentBarOmitted=true;p.closedBarsSeen=bars.bars.length;
    let time=currentTime();if(time<start)throw new KrakenFeedError('CLOCK_REGRESSION');const wait=1000-(time-start);if(wait>0)await pause(wait);time=currentTime();if(time<start)throw new KrakenFeedError('CLOCK_REGRESSION');if(interrupted())throw new KrakenFeedError('OPERATOR_INTERRUPTED');store.check();response=await sourceFetch(makeKrakenUrl('Trades',state.symbol,state.timeframe),{method:'GET',redirect:'error',signal:AbortSignal.timeout(producerLimits.requestMs)});if(response.status!==200)throw new KrakenFeedError('PROVIDER_HTTP_FAILURE');const t=await jsonResponse(response,krakenFeedLimits.responseBytes,m),trades=parseKrakenTrades(t.raw,state.symbol,guardedClock(state,now,store));p.tradesDigest=t.digest;p.tradesCursor=trades.last;p.staleQuote=trades.stale;
    if(state.lastBar&&(!bars.bars.length||bars.bars.at(-1).closedAt<state.lastBar))throw new KrakenFeedError('PROVIDER_BAR_REGRESSION');let nextBars=state.lastBar?bars.bars.filter(b=>b.closedAt>state.lastBar):bars.bars.slice(-krakenFeedLimits.warmupBars);if(!state.lastBar)p.warmupBarsOmitted=bars.bars.length-nextBars.length;
    const step=market.intervalMinutes*60000;if(state.lastBar&&nextBars.length&&Date.parse(nextBars[0].closedAt)-Date.parse(state.lastBar)!==step)throw new KrakenFeedError('PROVIDER_BAR_GAP');
    const quote=trades.quote&&(!state.lastQuote||trades.quote.observedAt>state.lastQuote)?trades.quote:null;p.repeatedQuote=!!trades.quote&&!quote;
    const events=[...nextBars.map(bar=>({requestId:randomUUID(),type:'CLOSED_BAR',bar})),...(quote?[{requestId:randomUUID(),type:'QUOTE',...quote}]:[])].map(raw=>m.boundedSessionEvent(raw).event);if(state.entries.length+events.length>producerLimits.events)throw new KrakenFeedError('PRODUCER_EVENT_CAPACITY');
    p.finishedAt=guardedClock(state,now,store);p.status='READY';state.entries.push(...events.map(event=>({poll:p.index,event,eventDigest:sha(JSON.stringify(event)),status:'PENDING',attempts:[],confirmation:null})));store.save(state);
   }catch(error){if(p.status==='PENDING'){const failedAt=guardedClock(state,now,store);p.status='FAILED';p.finishedAt=failedAt;p.reason=safeCode(error);state.status=['PROVIDER_BAR_GAP','PROVIDER_BAR_REGRESSION','OHLC_GAP','PRODUCER_EVENT_CAPACITY'].includes(p.reason)?'FAILED':'INTERRUPTED';state.reason=p.reason;store.save(state);}throw error;}
   await drain(false);emit({type:'FEED_POLL',poll:p.index,pollsMaximum:state.cyclesMaximum,localEvents:state.entries.length,localEventsMaximum:producerLimits.events,sampledQuotes:true,currentBarOmitted:true,staleQuote:p.staleQuote,repeatedQuote:p.repeatedQuote,receiverRemainingCapacity:'UNKNOWN',sourceAuthentication:'UNKNOWN',qualification:'NONE',ordersEnabled:false});
  }
  state.status='COMPLETED';state.reason='FINITE_POLL_BUDGET';store.save(state);emit({type:'FEED_STOPPED',status:state.status,reason:state.reason,sessionLiquidated:false,ordersEnabled:false});return state;
 }catch(error){if(state.status==='ACTIVE'){state.status='INTERRUPTED';state.reason=safeCode(error);store.save(state);}throw error;}
}
async function stdinAuthorization(m){let size=0,parts=[];for await(const chunk of process.stdin){size+=chunk.length;if(size>producerLimits.authorizationBytes)throw new KrakenFeedError('AUTHORIZATION_BYTE_CAPACITY');parts.push(chunk);}return validateProducerAuthorization(m.parseUniqueJson(decode(Buffer.concat(parts)),producerLimits.authorizationBytes,4));}
async function main(){
 const [command,configPath,statePath,...extra]=process.argv.slice(2);if(!['start','resume'].includes(command)||!configPath||!statePath||extra.length){process.stderr.write('Usage: node scripts/kraken-market-data.mjs start CONFIG.json NEW_FEED_STATE.json | resume CONFIG.json FEED_STATE.json; explicit authorization JSON on stdin.\n');return 1;}
 const m=await loadProducerModules(),authorization=await stdinAuthorization(m),config=await readProducerConfig(configPath),store=new ProducerStore(statePath);let lock,fd,alive=false;
 try{fd=openSync(store.path+'.lock',constants.O_RDWR|constants.O_CREAT|(constants.O_NOFOLLOW??0),0o600);const stat=fstatSync(fd);if(!stat.isFile()||(stat.mode&0o777)!==0o600||process.getuid&&stat.uid!==process.getuid())throw new KrakenFeedError('INVALID_WRITER_LOCK');lock=spawn('python3',[join(project,'scripts/session-file-lock.py')],{env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['pipe','pipe','ignore',fd]});lock.stdin.on('error',()=>{});
  await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new KrakenFeedError('WRITER_LOCK_UNAVAILABLE')),5000);const finish=ok=>{clearTimeout(timer);if(ok){alive=true;resolve();}else reject(new KrakenFeedError('WRITER_LOCK_UNAVAILABLE'));};lock.once('error',()=>finish(false));lock.once('exit',()=>{alive=false;finish(false);});lock.stdout.on('data',chunk=>{text+=chunk.toString('utf8');if(text.length>32||text.includes('\n'))finish(text==='LOCKED\n');});});store.alive=()=>alive;
  let interrupted=false;const stop=()=>{interrupted=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{await runProducer({command,config,authorization,store,interrupted:()=>interrupted,emit:value=>process.stdout.write(JSON.stringify(value)+'\n')});return 0;}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);}
 }finally{alive=false;if(lock){lock.stdin.end();lock.kill();}if(fd!==undefined)closeSync(fd);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch(error){process.stderr.write('Read-only producer stopped: '+safeCode(error)+'. Preserve its state and receiver journal; no liquidation or Live order is implied.\n');process.exitCode=1;}finally{cleanupProducerModules();}}
