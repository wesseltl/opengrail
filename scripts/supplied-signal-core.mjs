import {createHash} from 'node:crypto';
import {z} from 'zod';
import {receiverInstance,receiverNoSecrets} from './session-receiver-protocol.mjs';

// Pure, fixed validation and retained-state rules. No file, network or executable input.
export const suppliedSignalLimits=Object.freeze({inputBytes:4096,authorizationBytes:2048,stateBytes:1048576,signals:120,deliveryAttempts:8,responseBytes:131072,requestMs:8000});
export class SuppliedSignalError extends Error{constructor(code){super(code);this.code=code;}}
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=z.string().length(64).regex(/^[a-f0-9]{64}$/),uuid=z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
const clock=z.string().datetime().refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);
const code=z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/).refine(v=>v===v.trim()),symbol=z.string().regex(/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/).max(25).refine(v=>v===v.trim());
const timeframe=z.enum(['5m','15m','1h','4h','1d']),provider=z.enum(['ALTFINS','TRADINGVIEW','CUSTOM']),eventSide=z.enum(['BULLISH','BEARISH']);
const steps=Object.freeze({'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000});
const text=maximum=>z.string().trim().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/);
const implementationSchema=z.object({version:z.literal('opengrail-session-v1'),engine:hash,model:hash,journal:hash}).strict();
const authorizationSchema=z.object({receiverOrigin:z.string().min(1).max(80),sessionInstance:hash,receiverStartedAt:clock,receiverImplementation:implementationSchema,producerToken:z.string().length(82).regex(/^og_local_producer_[a-f0-9]{64}$/),suppliedSignalUseApproved:z.literal(true)}).strict();
const signalSchema=z.object({id:uuid,provider,event:eventSide,observedAt:clock,availableAt:clock}).strict();
const inputSchema=z.object({version:z.literal(1),kind:z.literal('SUPPLIED_SIGNAL'),requestId:uuid,symbol,timeframe,signal:signalSchema,source:z.object({kind:z.enum(['OPERATOR_SUPPLIED','AGENT_SUPPLIED']),label:text(80),note:text(1000)}).strict(),rights:z.object({acknowledged:z.literal(true),note:text(1000)}).strict()}).strict();
const normalizedEventSchema=z.object({requestId:uuid,type:z.literal('SIGNAL'),signal:signalSchema}).strict();
const preparedSchema=z.object({input:inputSchema,inputDigest:hash,event:normalizedEventSchema,eventDigest:hash,inputByteDigest:hash,inputBytes:z.number().int().min(1).max(suppliedSignalLimits.inputBytes)}).strict();
const receiptSchema=z.object({requestId:uuid,eventDigest:hash,receivedAt:clock,sequence:z.number().int().min(1).max(2032),disposition:z.enum(['ACCEPTED','REJECTED']),reason:code}).strict();
const confirmationSchema=z.object({version:z.literal(1),sessionId:uuid,sessionInstance:hash,receipt:receiptSchema,duplicate:z.boolean(),stateDigest:hash,journalDigest:hash,ordersEnabled:z.literal(false)}).strict();
const attemptSchema=z.object({startedAt:clock,status:z.enum(['PENDING','CONFIRMED','UNCONFIRMED']),reason:code.nullable()}).strict();
const entrySchema=z.object({input:inputSchema,inputDigest:hash,inputByteDigest:hash,inputBytes:z.number().int().min(1).max(suppliedSignalLimits.inputBytes),event:normalizedEventSchema,eventDigest:hash,admittedAt:clock,status:z.enum(['PENDING','CONFIRMED']),attempts:z.array(attemptSchema).max(suppliedSignalLimits.deliveryAttempts),confirmation:confirmationSchema.nullable()}).strict();
const stateSchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_SUPPLIED_SIGNALS'),method:z.literal('supplied-signal-v1'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),sourceAuthentication:z.literal('UNKNOWN'),ordersEnabled:z.literal(false),liveEnabled:z.literal(false),configDigest:hash,sessionId:uuid,sessionInstance:hash,receiverOrigin:z.string().min(1).max(80),producerCredentialDigest:hash,receiverStartedAt:clock,receiverImplementation:implementationSchema,symbol,timeframe,provider,event:eventSide,startedAt:clock,lastOperationAt:clock,status:z.enum(['ACTIVE','UNCERTAIN','FAILED']),reason:code.nullable(),clockFault:z.object({at:clock,previousAt:clock}).strict().nullable(),entries:z.array(entrySchema).max(suppliedSignalLimits.signals),stateDigest:hash}).strict();

function plain(raw,maximum,error='INVALID_BOUNDED_INPUT'){
 let count=0;const ancestors=new Set();
 function inspect(value,depth){
  if(++count>32768||depth>16)throw new SuppliedSignalError(error);
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value!=='object'||Object.getOwnPropertySymbols(value).length||ancestors.has(value))throw new SuppliedSignalError(error);
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new SuppliedSignalError(error);
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(array){const keys=Object.keys(descriptors).filter(key=>key!=='length');if(keys.length!==value.length||keys.some((key,n)=>key!==String(n)))throw new SuppliedSignalError(error);}
  ancestors.add(value);
  for(const [key,descriptor]of Object.entries(descriptors)){if(array&&key==='length')continue;if(!('value'in descriptor)||!descriptor.enumerable)throw new SuppliedSignalError(error);inspect(descriptor.value,depth+1);}
  ancestors.delete(value);
 }
 inspect(raw,0);let payload;try{payload=JSON.stringify(raw);}catch{throw new SuppliedSignalError(error);}if(typeof payload!=='string'||Buffer.byteLength(payload)>maximum)throw new SuppliedSignalError(error);return payload;
}
function noSecrets(raw){
 try{receiverNoSecrets(raw);}catch{throw new SuppliedSignalError('CREDENTIAL_MATERIAL');}
 function inspect(value){if(typeof value==='string'){let current=value;for(let n=0;n<4;n++){if(/og_(?:agent|local_(?:producer|owner))_/i.test(current))throw new SuppliedSignalError('CREDENTIAL_MATERIAL');try{const next=decodeURIComponent(current);if(next===current)break;current=next;}catch{break;}}}else if(value&&typeof value==='object')for(const child of Object.values(value))inspect(child);}
 inspect(raw);
}
function parsed(schema,raw,error){try{return schema.parse(raw);}catch{throw new SuppliedSignalError(error);}}
function requireModule(m){if(!m||typeof m.parseUniqueJson!=='function'||typeof m.boundedSessionConfig!=='function'||typeof m.boundedSessionEvent!=='function'||!Array.isArray(m.sessionReasons)||!m.sessionSourceFingerprints)throw new SuppliedSignalError('INVALID_FIXED_VALIDATION');}
function canonicalClock(at){return parsed(clock,at,'INVALID_LOCAL_CLOCK');}

export function validateSignalAuthorization(raw){
 plain(raw,suppliedSignalLimits.authorizationBytes,'INVALID_OPERATOR_AUTHORIZATION');const value=parsed(authorizationSchema,raw,'INVALID_OPERATOR_AUTHORIZATION');
 let url;try{url=new URL(value.receiverOrigin);}catch{throw new SuppliedSignalError('INVALID_RECEIVER_ORIGIN');}
 if(url.origin!==value.receiverOrigin||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new SuppliedSignalError('INVALID_RECEIVER_ORIGIN');return value;
}

export function validateSignalContext(rawConfig,rawAuthorization,m){
 requireModule(m);plain(rawConfig,32768,'INVALID_SIGNAL_CONFIG');noSecrets(rawConfig);
 let config;try{config=m.boundedSessionConfig(rawConfig).config;}catch{throw new SuppliedSignalError('INVALID_SIGNAL_CONFIG');}
 const authorization=validateSignalAuthorization(rawAuthorization),definition=config.strategy.record.content.definition;
 if(config.clockMode!=='SYSTEM_RECEIPT'||config.ordersEnabled!==false||config.liveEnabled!==false||definition.entry.type!=='SIGNAL')throw new SuppliedSignalError('SIGNAL_STRATEGY_REQUIRED');
 if(config.strategy.digest!==sha(JSON.stringify(config.strategy.record)))throw new SuppliedSignalError('STRATEGY_DIGEST_MISMATCH');
 if(!symbol.safeParse(definition.market.symbol).success||!timeframe.safeParse(definition.market.timeframe).success)throw new SuppliedSignalError('INVALID_SIGNAL_MARKET');
 const implementation={version:'opengrail-session-v1',...m.sessionSourceFingerprints};
 if(JSON.stringify(authorization.receiverImplementation)!==JSON.stringify(implementation)||receiverInstance({config,startedAt:authorization.receiverStartedAt,implementation})!==authorization.sessionInstance)throw new SuppliedSignalError('RECEIVER_CONFIG_MISMATCH');
 return {config,authorization,configDigest:sha(JSON.stringify(config)),sessionId:config.sessionId,sessionInstance:authorization.sessionInstance,receiverOrigin:authorization.receiverOrigin,producerCredentialDigest:sha(authorization.producerToken),receiverStartedAt:authorization.receiverStartedAt,receiverImplementation:implementation,symbol:definition.market.symbol,timeframe:definition.market.timeframe,provider:definition.entry.provider,event:definition.entry.event};
}

function validateInput(raw,context,m){
 plain(raw,suppliedSignalLimits.inputBytes,'INVALID_SUPPLIED_SIGNAL');noSecrets(raw);const input=parsed(inputSchema,raw,'INVALID_SUPPLIED_SIGNAL');
 if(input.symbol!==context.symbol||input.timeframe!==context.timeframe||input.signal.provider!==context.provider||input.signal.event!==context.event)throw new SuppliedSignalError('SIGNAL_CONTEXT_MISMATCH');
 if(Date.parse(input.signal.observedAt)%steps[input.timeframe]!==0)throw new SuppliedSignalError('SIGNAL_BAR_ALIGNMENT');
 if(input.signal.availableAt<input.signal.observedAt)throw new SuppliedSignalError('SIGNAL_AVAILABILITY');
 let event;try{event=m.boundedSessionEvent({requestId:input.requestId,type:'SIGNAL',signal:input.signal}).event;}catch{throw new SuppliedSignalError('INVALID_SUPPLIED_SIGNAL');}
 return {input,inputDigest:sha(JSON.stringify(input)),event,eventDigest:sha(JSON.stringify(event))};
}

export function parseSuppliedSignal(rawBytes,context,m){
 requireModule(m);let bytes,text;
 try{if(typeof rawBytes==='string'){bytes=Buffer.from(rawBytes,'utf8');text=rawBytes;if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==rawBytes)throw Error();}else if(rawBytes instanceof Uint8Array){bytes=Buffer.from(rawBytes);text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}else throw Error();}catch{throw new SuppliedSignalError('INVALID_SIGNAL_UTF8');}
 if(bytes.length<1||bytes.length>suppliedSignalLimits.inputBytes)throw new SuppliedSignalError('SIGNAL_INPUT_BYTE_CAPACITY');
 let raw;try{raw=m.parseUniqueJson(text,suppliedSignalLimits.inputBytes,16);}catch{throw new SuppliedSignalError('INVALID_SUPPLIED_SIGNAL');}
 return {...validateInput(raw,context,m),inputByteDigest:sha(bytes),inputBytes:bytes.length};
}

export function signalStateDigest(state){const {stateDigest:_,...body}=state;return sha(JSON.stringify(body));}
export function createSignalState(context,at){
 at=canonicalClock(at);const state={version:1,kind:'LOCAL_SUPPLIED_SIGNALS',method:'supplied-signal-v1',classification:'AUTHOR_REPORTED',qualification:'NONE',sourceAuthentication:'UNKNOWN',ordersEnabled:false,liveEnabled:false,configDigest:context.configDigest,sessionId:context.sessionId,sessionInstance:context.sessionInstance,receiverOrigin:context.receiverOrigin,producerCredentialDigest:context.producerCredentialDigest,receiverStartedAt:context.receiverStartedAt,receiverImplementation:context.receiverImplementation,symbol:context.symbol,timeframe:context.timeframe,provider:context.provider,event:context.event,startedAt:at,lastOperationAt:at,status:'ACTIVE',reason:null,clockFault:null,entries:[],stateDigest:'0'.repeat(64)};state.stateDigest=signalStateDigest(state);return state;
}

export function observeSignalClock(state,rawAt){
 const at=canonicalClock(rawAt);if(at<state.lastOperationAt){const previousAt=state.lastOperationAt;state.status='FAILED';state.reason='CLOCK_REGRESSION';state.clockFault={at,previousAt};for(const entry of state.entries){const attempt=entry.attempts.at(-1);if(attempt?.status==='PENDING'){attempt.status='UNCONFIRMED';attempt.reason='CLOCK_REGRESSION';}}throw new SuppliedSignalError('CLOCK_REGRESSION');}state.lastOperationAt=at;return at;
}

export function previewSignalAdmission(state,prepared){
 prepared=validatePrepared(prepared,state);
 if(state.status!=='ACTIVE'||state.entries.some(entry=>entry.status==='PENDING'))throw new SuppliedSignalError(state.status==='FAILED'?'TERMINAL_SIGNAL_STATE':'PENDING_SIGNAL_REQUIRES_RESUME');
 const existing=state.entries.find(entry=>entry.event.requestId===prepared.event.requestId);
 if(existing){if(existing.inputDigest!==prepared.inputDigest||existing.eventDigest!==prepared.eventDigest||JSON.stringify(existing.input)!==JSON.stringify(prepared.input)||JSON.stringify(existing.event)!==JSON.stringify(prepared.event))throw new SuppliedSignalError('SIGNAL_BODY_CONFLICT');return {entry:existing,duplicate:true};}
 if(state.entries.some(entry=>entry.event.signal.id===prepared.event.signal.id))throw new SuppliedSignalError('SIGNAL_ID_CONFLICT');
 if(state.entries.some(entry=>entry.event.signal.provider===prepared.event.signal.provider&&entry.event.signal.event===prepared.event.signal.event&&entry.event.signal.observedAt===prepared.event.signal.observedAt))throw new SuppliedSignalError('SIGNAL_OBSERVATION_CONFLICT');
 if(state.entries.length>=suppliedSignalLimits.signals)throw new SuppliedSignalError('SIGNAL_CAPACITY');
 return {entry:null,duplicate:false};
}
export function appendSignal(state,prepared,rawAt){
 prepared=validatePrepared(prepared,state);
 const admission=previewSignalAdmission(state,prepared);if(admission.duplicate)return admission;
 const at=observeSignalClock(state,rawAt),entry={input:prepared.input,inputDigest:prepared.inputDigest,inputByteDigest:prepared.inputByteDigest,inputBytes:prepared.inputBytes,event:prepared.event,eventDigest:prepared.eventDigest,admittedAt:at,status:'PENDING',attempts:[],confirmation:null};state.entries.push(entry);return {entry,duplicate:false};
}

function validatePrepared(raw,state){
 plain(raw,8192,'INVALID_PREPARED_SIGNAL');noSecrets(raw);const prepared=parsed(preparedSchema,raw,'INVALID_PREPARED_SIGNAL'),input=prepared.input;
 if(prepared.inputDigest!==sha(JSON.stringify(input))||prepared.eventDigest!==sha(JSON.stringify(prepared.event))||JSON.stringify(prepared.event)!==JSON.stringify({requestId:input.requestId,type:'SIGNAL',signal:input.signal})||input.symbol!==state.symbol||input.timeframe!==state.timeframe||input.signal.provider!==state.provider||input.signal.event!==state.event||Date.parse(input.signal.observedAt)%steps[input.timeframe]!==0||input.signal.availableAt<input.signal.observedAt)throw new SuppliedSignalError('INVALID_PREPARED_SIGNAL');return prepared;
}

export function validateSignalConfirmation(raw,context,entry,m){
 requireModule(m);plain(raw,suppliedSignalLimits.responseBytes,'UNCONFIRMED_RECEIVER_RESPONSE');const value=parsed(confirmationSchema,raw,'UNCONFIRMED_RECEIVER_RESPONSE'),receipt=value.receipt;
 if(value.sessionId!==context.sessionId||value.sessionInstance!==context.sessionInstance||receipt.requestId!==entry.event.requestId||receipt.eventDigest!==entry.eventDigest||!m.sessionReasons.includes(receipt.reason)||receipt.receivedAt<entry.admittedAt||receipt.receivedAt<context.receiverStartedAt||receipt.disposition==='ACCEPTED'&&receipt.receivedAt<entry.event.signal.availableAt)throw new SuppliedSignalError('UNCONFIRMED_RECEIVER_RESPONSE');return value;
}

export function validateSignalState(raw,context,m){
 requireModule(m);plain(raw,suppliedSignalLimits.stateBytes,'INVALID_SIGNAL_STATE');noSecrets(raw);const state=parsed(stateSchema,raw,'INVALID_SIGNAL_STATE');
 if(state.stateDigest!==signalStateDigest(state))throw new SuppliedSignalError('INVALID_SIGNAL_STATE_DIGEST');
 for(const key of ['configDigest','sessionId','sessionInstance','receiverOrigin','producerCredentialDigest','receiverStartedAt','receiverImplementation','symbol','timeframe','provider','event'])if(JSON.stringify(state[key])!==JSON.stringify(context[key]))throw new SuppliedSignalError('SIGNAL_CONTEXT_MISMATCH');
 const fail=()=>{throw new SuppliedSignalError('INVALID_SIGNAL_HISTORY');};
 if(state.lastOperationAt<state.startedAt||state.status==='ACTIVE'&&state.reason!==null||state.status!=='ACTIVE'&&state.reason===null||state.reason==='CLOCK_REGRESSION'&&(!state.clockFault||state.clockFault.at>=state.clockFault.previousAt||state.clockFault.previousAt!==state.lastOperationAt)||state.clockFault&&(state.status!=='FAILED'||state.reason!=='CLOCK_REGRESSION'))fail();
 const requests=new Set(),signalIds=new Set(),observations=new Set();let pending=false,rejected=false,previousSequence=0,previousAdmission=state.startedAt;
 for(let n=0;n<state.entries.length;n++){
  const entry=state.entries[n],prepared=validateInput(entry.input,context,m),key=[entry.event.signal.provider,entry.event.signal.event,entry.event.signal.observedAt].join('|');
  if(entry.inputDigest!==prepared.inputDigest||entry.eventDigest!==prepared.eventDigest||JSON.stringify(entry.event)!==JSON.stringify(prepared.event)||requests.has(entry.event.requestId)||signalIds.has(entry.event.signal.id)||observations.has(key)||entry.admittedAt<previousAdmission||entry.admittedAt>state.lastOperationAt||pending||rejected)fail();
  requests.add(entry.event.requestId);signalIds.add(entry.event.signal.id);observations.add(key);previousAdmission=entry.admittedAt;
  let previousAt=entry.admittedAt;
  for(let a=0;a<entry.attempts.length;a++){const attempt=entry.attempts[a];if(attempt.startedAt<previousAt||attempt.startedAt>state.lastOperationAt||attempt.status==='UNCONFIRMED'&&!attempt.reason||attempt.status!=='UNCONFIRMED'&&attempt.reason!==null||attempt.status!=='UNCONFIRMED'&&a!==entry.attempts.length-1)fail();previousAt=attempt.startedAt;}
  if(entry.status==='PENDING'){pending=true;if(n!==state.entries.length-1||entry.confirmation!==null||entry.attempts.some(attempt=>attempt.status==='CONFIRMED'))fail();continue;}
  if(!entry.confirmation||entry.attempts.at(-1)?.status!=='CONFIRMED')fail();const confirmation=validateSignalConfirmation(entry.confirmation,context,entry,m);
  if(confirmation.receipt.sequence<=previousSequence||confirmation.receipt.receivedAt>state.lastOperationAt)fail();previousSequence=confirmation.receipt.sequence;
  if(confirmation.receipt.disposition==='REJECTED')rejected=true;
 }
 if(state.status==='UNCERTAIN'&&(!pending||state.entries.at(-1)?.attempts.length>0&&state.entries.at(-1)?.attempts.at(-1)?.status!=='UNCONFIRMED')||rejected&&(state.status!=='FAILED'||state.reason!=='CONFIRMED_REJECTION')||state.reason==='CONFIRMED_REJECTION'&&!rejected||state.reason==='DELIVERY_ATTEMPT_CAPACITY'&&(!pending||state.entries.at(-1)?.attempts.length!==suppliedSignalLimits.deliveryAttempts)||state.reason==='CLOCK_REGRESSION'&&state.entries.some(entry=>entry.attempts.at(-1)?.status==='PENDING'))fail();return state;
}
