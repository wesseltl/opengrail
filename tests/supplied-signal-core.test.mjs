import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {receiverInstance} from '../scripts/session-receiver-protocol.mjs';
import {loadProducerModules,cleanupProducerModules} from '../scripts/kraken-market-data.mjs';
import {suppliedSignalLimits,SuppliedSignalError,validateSignalAuthorization,validateSignalContext,parseSuppliedSignal,createSignalState,previewSignalAdmission,appendSignal,signalStateDigest,observeSignalClock,validateSignalConfirmation,validateSignalState} from '../scripts/supplied-signal-core.mjs';

// All identities, source claims, clocks and receipts here are invented local fixtures.
// Receipt consistency is not upstream authenticity, execution attestation or qualification.
const sha=value=>createHash('sha256').update(value).digest('hex'),startedAt='2026-10-11T04:00:00.000Z',at='2026-10-11T05:00:30.000Z';
const producerToken='og_local_producer_'+sha('INVENTED supplied-signal test producer');let m,config,authorization,context;
before(async()=>{
 m=await loadProducerModules();const id=randomUUID(),record={version:1,id,rootId:id,revision:1,requestId:randomUUID(),createdAt:'2026-10-11T00:00:00.000Z',author:{kind:'HUMAN',id:'human_'+'a'.repeat(64),sponsorId:'human_'+'a'.repeat(64)},content:{name:'INVENTED supplied-signal fixture',description:'Invented fixture without public registration or authenticated provider.',assumptions:'Only retained supplied-event consistency is checked.',falsification:'An internally consistent fixture does not establish performance.',sources:[],definition:{schemaVersion:1,market:{symbol:'BTC/USD',timeframe:'5m',direction:'LONG'},entry:{type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:3},risk:{positionPct:1,maxOpenPositions:1,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:1},costs:{feeBps:23,slippageBps:37},execution:{mode:'DEMO',leverage:1,ordersEnabled:false}},relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false};
 config=m.boundedSessionConfig({version:1,sessionId:randomUUID(),methodVersion:'opengrail-session-v1',clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record,digest:sha(JSON.stringify(record))},initialCapital:1000,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'INVENTED permission declaration for synthetic local fixtures.'},sourceLabel:'INVENTED supplied signal fixture',ordersEnabled:false,liveEnabled:false}).config;
 authorization={receiverOrigin:'http://127.0.0.1:23456',sessionInstance:'0'.repeat(64),receiverStartedAt:startedAt,receiverImplementation:{version:'opengrail-session-v1',...m.sessionSourceFingerprints},producerToken,suppliedSignalUseApproved:true};authorization.sessionInstance=receiverInstance({config,startedAt,implementation:authorization.receiverImplementation});context=validateSignalContext(config,authorization,m);
});
after(()=>cleanupProducerModules());
const input=overrides=>({version:1,kind:'SUPPLIED_SIGNAL',requestId:randomUUID(),symbol:'BTC/USD',timeframe:'5m',signal:{id:randomUUID(),provider:'CUSTOM',event:'BULLISH',observedAt:'2026-10-11T05:00:00.000Z',availableAt:'2026-10-11T05:00:20.000Z'},source:{kind:'AGENT_SUPPLIED',label:'INVENTED agent supplied example',note:'Invented source declaration; no provider is contacted.'},rights:{acknowledged:true,note:'Synthetic local test fixture only.'},...overrides});
const prepare=value=>parseSuppliedSignal(JSON.stringify(value),context,m);
const seal=state=>{state.stateDigest=signalStateDigest(state);return state;};
function pending(value=input()){const state=createSignalState(context,at),prepared=prepare(value),{entry}=appendSignal(state,prepared,at);return {state:seal(state),prepared,entry};}
function receipt(entry,overrides={}){return {version:1,sessionId:config.sessionId,sessionInstance:context.sessionInstance,receipt:{requestId:entry.event.requestId,eventDigest:entry.eventDigest,receivedAt:at,sequence:1,disposition:'ACCEPTED',reason:'SIGNAL_RECEIVED',...overrides},duplicate:false,stateDigest:sha('INVENTED receiver state'),journalDigest:sha('INVENTED receiver journal'),ordersEnabled:false};}
function confirmed(value=input()){const result=pending(value);result.entry.attempts.push({startedAt:at,status:'CONFIRMED',reason:null});result.entry.status='CONFIRMED';result.entry.confirmation=receipt(result.entry);seal(result.state);return result;}
const rejects=(fn,code)=>assert.throws(fn,error=>error instanceof SuppliedSignalError&&(!code||error.code===code));

test('strict origin, fixed role, explicit approval and exact authorization structure are required',()=>{
 assert.equal(validateSignalAuthorization(authorization).producerToken,producerToken);
 for(const override of [{suppliedSignalUseApproved:false},{suppliedSignalUseApproved:undefined},{receiverOrigin:'http://localhost:23456'},{receiverOrigin:'https://127.0.0.1:23456'},{receiverOrigin:'http://127.0.0.1:23456/'},{receiverOrigin:'http://127.0.0.1:23456?token=x'},{receiverOrigin:'http://user:secret@127.0.0.1:23456'},{receiverOrigin:'http://127.0.0.1:23456/api/events'},{producerToken:'og_local_owner_'+sha('INVENTED owner')},{producerToken:producerToken+'\n'},{ownerToken:'not a permitted field'}])rejects(()=>validateSignalAuthorization({...authorization,...override}));
});
test('raw authority input cannot run accessors, hidden fields or JSON hooks',()=>{
 let calls=0;const getter={...authorization};Object.defineProperty(getter,'producerToken',{enumerable:true,get(){calls++;return producerToken;}});rejects(()=>validateSignalAuthorization(getter),'INVALID_OPERATOR_AUTHORIZATION');assert.equal(calls,0);
 for(const raw of [Object.assign(Object.create({hidden:true}),authorization),{...authorization,toJSON:()=>authorization},{...authorization,[Symbol('hidden')]:true}])rejects(()=>validateSignalAuthorization(raw));
});
test('current exact strategy and declared history preimage cannot be replaced or used with a non-signal rule',()=>{
 for(const field of ['capital','fee','symbol','timeframe','start','implementation']){const c=structuredClone(config),auth=structuredClone(authorization);if(field==='capital')c.initialCapital++;if(field==='fee')c.strategy.record.content.definition.costs.feeBps++;if(field==='symbol')c.strategy.record.content.definition.market.symbol='ETH/USD';if(field==='timeframe')c.strategy.record.content.definition.market.timeframe='1h';if(field==='start')auth.receiverStartedAt='2026-10-11T03:00:00.000Z';if(field==='implementation')auth.receiverImplementation.engine='a'.repeat(64);c.strategy.digest=sha(JSON.stringify(c.strategy.record));rejects(()=>validateSignalContext(c,auth,m),'RECEIVER_CONFIG_MISMATCH');}
 const c=structuredClone(config);c.strategy.record.content.definition.entry={type:'DCA',intervalBars:1,maxEntries:1};c.strategy.digest=sha(JSON.stringify(c.strategy.record));rejects(()=>validateSignalContext(c,authorization,m),'SIGNAL_STRATEGY_REQUIRED');
});
test('full strict input preserves source clocks and separates raw bytes from canonical identity',()=>{
 const value=input(),compact=JSON.stringify(value),pretty=JSON.stringify(value,null,2),a=parseSuppliedSignal(compact,context,m),b=parseSuppliedSignal(Buffer.from(pretty),context,m);
 assert.deepEqual(a.input,value);assert.equal(a.event.signal.observedAt,value.signal.observedAt);assert.equal(a.event.signal.availableAt,value.signal.availableAt);assert.equal(a.event.requestId,value.requestId);assert.equal(a.event.signal.id,value.signal.id);assert.equal(a.inputDigest,b.inputDigest);assert.equal(a.eventDigest,b.eventDigest);assert.notEqual(a.inputByteDigest,b.inputByteDigest);assert.equal(a.inputBytes,Buffer.byteLength(compact));assert.equal(b.inputBytes,Buffer.byteLength(pretty));assert.deepEqual(Object.keys(a.event),['requestId','type','signal']);assert.equal(a.event.price,undefined);
});
test('duplicate fields, malformed UTF-8, empty and oversized raw inputs refuse before normalization',()=>{
 const value=input(),body=JSON.stringify(value);rejects(()=>parseSuppliedSignal(body.replace('"version":1','"version":1,"version":1'),context,m),'INVALID_SUPPLIED_SIGNAL');
 for(const raw of [Buffer.from([0xc3,0x28]),'\ud800'])rejects(()=>parseSuppliedSignal(raw,context,m),'INVALID_SIGNAL_UTF8');
 rejects(()=>parseSuppliedSignal('',context,m),'SIGNAL_INPUT_BYTE_CAPACITY');rejects(()=>parseSuppliedSignal(' '.repeat(4097)+body,context,m),'SIGNAL_INPUT_BYTE_CAPACITY');
});
test('source, rights and fixed event fields are required and cannot choose code, URLs, prices or authority',()=>{
 for(const mutate of [v=>{v.source.kind='PROVIDER_AUTHENTICATED';},v=>{v.rights.acknowledged=false;},v=>{delete v.rights;},v=>{v.receivedAt=at;},v=>{v.signal.price=100;},v=>{v.source.url='https://foreign.invalid';},v=>{v.code='return 100';},v=>{v.ordersEnabled=true;},v=>{v.source.label='';},v=>{v.source.note='x'.repeat(1001);},v=>{v.rights.note='x'.repeat(1001);}]){const value=input();mutate(value);rejects(()=>prepare(value));}
});
test('market, timeframe, provider and side must match the selected signal strategy',()=>{
 for(const mutate of [v=>{v.symbol='ETH/USD';},v=>{v.timeframe='1h';},v=>{v.signal.provider='ALTFINS';},v=>{v.signal.event='BEARISH';}]){const value=input();mutate(value);rejects(()=>prepare(value),'SIGNAL_CONTEXT_MISMATCH');}
});
test('freshly rehashed malicious config and input cannot exploit trailing newline market anchors',()=>{
 const c=structuredClone(config);c.strategy.record.content.definition.market.symbol='BTC/USD\n';c.strategy.digest=sha(JSON.stringify(c.strategy.record));const auth=structuredClone(authorization);auth.sessionInstance=receiverInstance({config:c,startedAt,implementation:auth.receiverImplementation});rejects(()=>validateSignalContext(c,auth,m));
 rejects(()=>prepare(input({symbol:'BTC/USD\n'})),'INVALID_SUPPLIED_SIGNAL');
});
test('RFC UUID versions and variants are exact lowercase identifiers rather than permissive placeholders',()=>{
 for(const id of ['00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-9aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-7aaa-aaaaaaaaaaaa',randomUUID().toUpperCase(),randomUUID()+'\n']){rejects(()=>prepare(input({requestId:id})),'INVALID_SUPPLIED_SIGNAL');const value=input();value.signal.id=id;rejects(()=>prepare(value),'INVALID_SUPPLIED_SIGNAL');}
});
test('aligned old or future source timestamps stay unchanged for the authoritative receiver decision',()=>{
 for(const observedAt of ['2026-10-11T03:00:00.000Z','2026-10-11T06:00:00.000Z']){const value=input();value.signal.observedAt=observedAt;value.signal.availableAt=observedAt;const prepared=prepare(value);assert.equal(prepared.event.signal.observedAt,observedAt);assert.equal(prepared.event.signal.availableAt,observedAt);}
 const wrong=input();wrong.signal.observedAt='2026-10-11T05:00:01.000Z';rejects(()=>prepare(wrong),'SIGNAL_BAR_ALIGNMENT');const reversed=input();reversed.signal.availableAt='2026-10-11T04:59:59.000Z';rejects(()=>prepare(reversed),'SIGNAL_AVAILABILITY');
});
test('encoded producer, owner and public-agent credential material is refused rather than retained as a source declaration',()=>{
 for(const secret of [producerToken,'og_local_owner_'+sha('INVENTED owner'),'og_agent_'+sha('INVENTED network agent'),encodeURIComponent(producerToken).replaceAll('_','%5f'),'%256f%2567%255f%256c%256f%2563%2561%256c%255f%2570%2572%256f%2564%2575%2563%2565%2572%255f'+'a'.repeat(64)]){const value=input();value.source.note=secret;rejects(()=>prepare(value),'CREDENTIAL_MATERIAL');}
});
test('initial pending snapshot is strict and stores only hashed credential identity',()=>{
 const {state,prepared,entry}=pending();assert.equal(validateSignalState(state,context,m).stateDigest,state.stateDigest);assert.equal(state.ordersEnabled,false);assert.equal(state.liveEnabled,false);assert.equal(state.qualification,'NONE');assert.equal(state.sourceAuthentication,'UNKNOWN');assert.equal(entry.inputByteDigest,prepared.inputByteDigest);assert.equal(entry.inputDigest,prepared.inputDigest);assert.equal(entry.confirmation,null);assert.equal(entry.attempts.length,0);assert(!JSON.stringify(state).includes(producerToken));assert.equal(state.producerCredentialDigest,sha(producerToken));
});
test('altered token, origin or receiver preimage cannot resume the original retained authority',()=>{
 const {state}=pending();for(const auth of [{...authorization,producerToken:'og_local_producer_'+sha('INVENTED other producer')},{...authorization,receiverOrigin:'http://127.0.0.1:23457'}]){const changed=validateSignalContext(config,auth,m);rejects(()=>validateSignalState(state,changed,m),'SIGNAL_CONTEXT_MISMATCH');}
 const c=structuredClone(config);c.initialCapital++;const auth={...authorization,sessionInstance:receiverInstance({config:c,startedAt,implementation:authorization.receiverImplementation})},changed=validateSignalContext(c,auth,m);rejects(()=>validateSignalState(state,changed,m),'SIGNAL_CONTEXT_MISMATCH');
});
test('confirmed formatting-only duplicate returns original raw-byte evidence without changing the ledger',()=>{
 const {state,entry}=confirmed(),before=JSON.stringify(state),differentFormatting=parseSuppliedSignal(JSON.stringify(entry.input,null,2),context,m),result=appendSignal(state,differentFormatting,'2026-10-11T05:01:00.000Z');assert.equal(result.duplicate,true);assert.equal(result.entry,entry);assert.equal(JSON.stringify(state),before);assert.notEqual(differentFormatting.inputByteDigest,entry.inputByteDigest);assert.equal(state.entries.length,1);
});
test('changed source metadata, IDs or source observation cannot repurpose an existing confirmed operation',()=>{
 const {state,entry}=confirmed(),before=JSON.stringify(state);const changed=structuredClone(entry.input);changed.source.note+=' Altered claim.';rejects(()=>previewSignalAdmission(state,prepare(changed)),'SIGNAL_BODY_CONFLICT');
 const idCollision=structuredClone(entry.input);idCollision.requestId=randomUUID();rejects(()=>previewSignalAdmission(state,prepare(idCollision)),'SIGNAL_ID_CONFLICT');
 const observationCollision=structuredClone(entry.input);observationCollision.requestId=randomUUID();observationCollision.signal.id=randomUUID();rejects(()=>previewSignalAdmission(state,prepare(observationCollision)),'SIGNAL_OBSERVATION_CONFLICT');assert.equal(JSON.stringify(state),before);
});
test('an unresolved original operation blocks both identical and new submit admission',()=>{
 const {state,prepared}=pending(),before=JSON.stringify(state);rejects(()=>appendSignal(state,prepared,at),'PENDING_SIGNAL_REQUIRES_RESUME');rejects(()=>previewSignalAdmission(state,prepare(input())),'PENDING_SIGNAL_REQUIRES_RESUME');assert.equal(JSON.stringify(state),before);
});
test('prepared-value drift and hooks cannot bypass admission or mutate the detached retained input',()=>{
 const state=createSignalState(context,at),prepared=prepare(input()),changed=structuredClone(prepared);changed.event.signal.availableAt='2026-10-11T05:00:21.000Z';rejects(()=>previewSignalAdmission(state,changed),'INVALID_PREPARED_SIGNAL');assert.equal(state.entries.length,0);
 let calls=0;const getter={...prepared};Object.defineProperty(getter,'input',{enumerable:true,get(){calls++;return prepared.input;}});rejects(()=>previewSignalAdmission(state,getter),'INVALID_PREPARED_SIGNAL');assert.equal(calls,0);
 const {entry}=appendSignal(state,prepared,at);prepared.input.source.note='INVENTED later caller mutation';prepared.event.signal.availableAt='2026-10-11T05:00:21.000Z';assert.notEqual(entry.input.source.note,prepared.input.source.note);assert.notEqual(entry.event.signal.availableAt,prepared.event.signal.availableAt);seal(state);assert.equal(validateSignalState(state,context,m).entries.length,1);
});
test('receipt correlation rejects substituted history, body, clocks, unknown reasons and financial authority',()=>{
 const {entry}=pending(),good=receipt(entry);assert.equal(validateSignalConfirmation(good,context,entry,m).receipt.disposition,'ACCEPTED');
 for(const mutate of [v=>{v.sessionInstance=sha('INVENTED other history');},v=>{v.sessionId=randomUUID();},v=>{v.receipt.requestId=randomUUID();},v=>{v.receipt.eventDigest=sha('INVENTED changed body');},v=>{v.receipt.receivedAt='2026-10-11T05:00:29.000Z';},v=>{v.receipt.reason='PROFITABLE';},v=>{v.ordersEnabled=true;},v=>{v.confirmed=true;}]){const value=structuredClone(good);mutate(value);rejects(()=>validateSignalConfirmation(value,context,entry,m),'UNCONFIRMED_RECEIVER_RESPONSE');}
});
test('actual future-input rejection may precede claimed availability and is retained as terminal adverse evidence',()=>{
 const value=input();value.signal.observedAt='2026-10-11T06:00:00.000Z';value.signal.availableAt=value.signal.observedAt;const {state,entry}=pending(value),rejected=receipt(entry,{disposition:'REJECTED',reason:'FUTURE_INPUT'});assert.equal(validateSignalConfirmation(rejected,context,entry,m).receipt.reason,'FUTURE_INPUT');
 entry.attempts.push({startedAt:at,status:'CONFIRMED',reason:null});entry.status='CONFIRMED';entry.confirmation=rejected;state.status='FAILED';state.reason='CONFIRMED_REJECTION';seal(state);assert.equal(validateSignalState(state,context,m).entries[0].confirmation.receipt.disposition,'REJECTED');rejects(()=>appendSignal(state,prepare(input()),at),'TERMINAL_SIGNAL_STATE');
});
test('unknown acknowledgement and interrupted pre-delivery snapshots remain valid recoverable evidence',()=>{
 const {state,entry}=pending();state.status='UNCERTAIN';state.reason='OPERATOR_INTERRUPTED';seal(state);assert.equal(validateSignalState(state,context,m).entries[0].attempts.length,0);
 entry.attempts.push({startedAt:at,status:'UNCONFIRMED',reason:'UNCONFIRMED_OPERATION'});state.reason='UNCONFIRMED_OPERATION';seal(state);assert.equal(validateSignalState(state,context,m).status,'UNCERTAIN');entry.attempts[0].status='PENDING';entry.attempts[0].reason=null;seal(state);rejects(()=>validateSignalState(state,context,m),'INVALID_SIGNAL_HISTORY');
});
test('known missing confirmed receipt can fail without removing or reposting its historical confirmation',()=>{
 const {state,entry}=confirmed();state.status='FAILED';state.reason='CONFIRMED_RECEIPT_MISSING';seal(state);const validated=validateSignalState(state,context,m);assert.deepEqual(validated.entries[0].confirmation,entry.confirmation);assert.equal(validated.entries[0].status,'CONFIRMED');
});
test('clock regression preserves the actual regressed time and original outbox without repairing chronology',()=>{
 const {state,entry}=pending();entry.attempts.push({startedAt:at,status:'PENDING',reason:null});const earlier='2026-10-11T05:00:29.000Z';rejects(()=>observeSignalClock(state,earlier),'CLOCK_REGRESSION');seal(state);assert.equal(state.lastOperationAt,at);assert.deepEqual(state.clockFault,{at:earlier,previousAt:at});assert.equal(entry.attempts[0].status,'UNCONFIRMED');assert.equal(entry.attempts[0].reason,'CLOCK_REGRESSION');assert.equal(validateSignalState(state,context,m).status,'FAILED');assert.equal(entry.event.signal.observedAt,'2026-10-11T05:00:00.000Z');
});
test('rehashed tampering cannot break exact input/event, pending order or causal attempt consistency',()=>{
 const {state}=confirmed();for(const mutate of [v=>{v.entries[0].event.signal.id=randomUUID();},v=>{v.entries[0].input.source.note+=' Changed';},v=>{v.entries[0].attempts[0].reason='UNCONFIRMED_OPERATION';},v=>{v.entries[0].attempts[0].startedAt='2026-10-11T05:00:29.000Z';},v=>{v.entries[0].confirmation.receipt.receivedAt='2026-10-11T05:01:00.000Z';},v=>{v.clockFault={at:'2026-10-11T05:00:29.000Z',previousAt:at};}]){const changed=structuredClone(state);mutate(changed);seal(changed);rejects(()=>validateSignalState(changed,context,m));}
});
test('sparse arrays, accessors, symbol properties and oversized state do not run hooks or pass a hash-only check',()=>{
 const {state}=pending();let calls=0;const getter=structuredClone(state);Object.defineProperty(getter,'entries',{enumerable:true,get(){calls++;return [];}});rejects(()=>validateSignalState(getter,context,m),'INVALID_SIGNAL_STATE');assert.equal(calls,0);
 const sparse=structuredClone(state);sparse.entries=new Array(1);rejects(()=>validateSignalState(sparse,context,m),'INVALID_SIGNAL_STATE');const decorated=structuredClone(state);decorated.entries.extra=true;rejects(()=>validateSignalState(decorated,context,m),'INVALID_SIGNAL_STATE');const hidden=structuredClone(state);hidden[Symbol('secret')]=true;rejects(()=>validateSignalState(hidden,context,m),'INVALID_SIGNAL_STATE');const oversized=structuredClone(state);oversized.extra='x'.repeat(suppliedSignalLimits.stateBytes);rejects(()=>validateSignalState(oversized,context,m),'INVALID_SIGNAL_STATE');
});
test('eight retained delivery attempts survive recovery and cannot be reset by a status change',()=>{
 const {state,entry}=pending();entry.attempts=Array.from({length:8},()=>({startedAt:at,status:'UNCONFIRMED',reason:'UNCONFIRMED_OPERATION'}));state.status='FAILED';state.reason='DELIVERY_ATTEMPT_CAPACITY';seal(state);assert.equal(validateSignalState(state,context,m).entries[0].attempts.length,8);const changed=structuredClone(state);changed.entries[0].attempts.push({startedAt:at,status:'UNCONFIRMED',reason:'UNCONFIRMED_OPERATION'});seal(changed);rejects(()=>validateSignalState(changed,context,m),'INVALID_SIGNAL_STATE');
});
test('120 lifetime signals are retained with increasing receipts and capacity refusal preserves existing evidence',()=>{
 const state=createSignalState(context,at);for(let n=0;n<120;n++){const value=input();value.signal.observedAt=new Date(Date.parse('2026-01-01T00:00:00.000Z')+n*300000).toISOString();value.signal.availableAt=value.signal.observedAt;const {entry}=appendSignal(state,prepare(value),at);entry.attempts.push({startedAt:at,status:'CONFIRMED',reason:null});entry.status='CONFIRMED';entry.confirmation=receipt(entry,{sequence:n*2+1});}seal(state);assert.equal(validateSignalState(state,context,m).entries.length,120);const before=JSON.stringify(state);rejects(()=>previewSignalAdmission(state,prepare(input())),'SIGNAL_CAPACITY');assert.equal(JSON.stringify(state),before);assert(Buffer.byteLength(before)<suppliedSignalLimits.stateBytes);
});
