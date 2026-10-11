import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {receiverLimits,sha,parseReceiverHashes,receiverAuthorization,receiverOrigin,receiverSessionId,receiverInstance,receiverSessionInstance,receiverNoSecrets,receiverRoute,receiverEvent,receiverReceipt,receiverState,receiverReady,receiverAcknowledgment} from '../scripts/session-receiver-protocol.mjs';

let m,directory,empty,quoted,paused;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),T='2025-01-01T00:00:00.000Z',U='2025-01-01T00:00:01.000Z',V='2025-01-01T00:00:02.000Z';
const producer='og_local_producer_'+'a'.repeat(64),owner='og_local_owner_'+'b'.repeat(64),hashes={version:1,producerDigest:sha(producer),ownerDigest:sha(owner)};
const quote={requestId:id(1),type:'QUOTE',observedAt:U,price:100},pause={requestId:id(2),type:'PAUSE'};
function summary(journal,type='READY'){const s=journal.state;return {type,sessionId:journal.config.sessionId,sequence:s.sequence,status:s.status,openPositions:s.openPositions.length,pendingEntry:s.pending!==null,exitPending:s.status==='STOPPING',stateDigest:s.stateDigest,journalDigest:journal.journalDigest,ordersEnabled:false,clockMode:'SYSTEM_RECEIPT'};}
function acknowledgment(journal,event,duplicate=false){const receipt=journal.state.events.find(v=>v.requestId===event.requestId);return {...summary(journal,'RECEIPT'),requestId:event.requestId,duplicate,disposition:receipt.disposition,reason:receipt.reason};}

before(async()=>{
 const bundle=await build({stdin:{contents:"export {parseUniqueJson} from './app/unique-json';export {boundedSessionEvent,sessionLimits} from './app/session-model';export {createSessionJournal,appendSessionEvent,verifySessionJournal,reconstructSessionJournal,sessionJournalLimits} from './app/session-journal';export {sessionPositionMark} from './app/session-engine';export {syntheticSessionExample} from './app/session-example';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-receiver-protocol-'));const path=join(directory,'fixed-session.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx'});m=await import(pathToFileURL(path).href);
 const config=(await m.syntheticSessionExample()).config;config.clockMode='SYSTEM_RECEIPT';empty=await m.createSessionJournal(config,T);quoted=await m.appendSessionEvent(empty,quote,U);paused=await m.appendSessionEvent(quoted,pause,V);
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('local credentials authenticate only their exact domain-separated role and digest',()=>{
 assert.equal(receiverAuthorization('Bearer '+producer,hashes),'producer');assert.equal(receiverAuthorization('Bearer '+owner,hashes),'owner');
 for(const token of ['og_agent_'+id(4)+'.'+'a'.repeat(64),'og_local_owner_'+'a'.repeat(64),'og_local_producer_'+'A'.repeat(64),producer+' ',producer+'.suffix','og_local_producer_'+ 'a'.repeat(63)])assert.throws(()=>receiverAuthorization('Bearer '+token,hashes),e=>e.status===401&&e.code==='UNAUTHORIZED');
 for(const value of [undefined,'bearer '+owner,owner,['Bearer '+owner], 'Bearer '+owner+', Bearer '+producer])assert.throws(()=>receiverAuthorization(value,hashes),e=>e.status===401);
});

test('credential admission rejects duplicate keys, plaintext, unknown fields and ambiguous role hashes',()=>{
 assert.deepEqual(parseReceiverHashes(JSON.stringify(hashes),m.parseUniqueJson),hashes);
 for(const value of [{...hashes,ownerToken:owner},{...hashes,producerDigest:hashes.ownerDigest},{...hashes,version:2},{...hashes,ownerDigest:'A'.repeat(64)}, {version:1,producerDigest:hashes.producerDigest}])assert.throws(()=>parseReceiverHashes(JSON.stringify(value),m.parseUniqueJson),e=>e.code==='INVALID_CREDENTIAL_FILE');
 assert.throws(()=>parseReceiverHashes('{"version":1,"version":1,"producerDigest":"'+hashes.producerDigest+'","ownerDigest":"'+hashes.ownerDigest+'"}',m.parseUniqueJson));
 assert.throws(()=>parseReceiverHashes(' '.repeat(receiverLimits.hashBytes+1),m.parseUniqueJson));
});

test('exact loopback Host and same-origin checks exclude rebinding and foreign browser requests',()=>{
 receiverOrigin('127.0.0.1:32123',undefined,32123);receiverOrigin('127.0.0.1:32123','http://127.0.0.1:32123',32123);
 for(const host of ['localhost:32123','127.0.0.1','127.0.0.1:32124','foreign.invalid:32123','127.0.0.1:32123,foreign.invalid'])assert.throws(()=>receiverOrigin(host,undefined,32123),e=>e.status===403);
 for(const origin of ['null','https://127.0.0.1:32123','http://127.0.0.1:32124','http://foreign.invalid','http://127.0.0.1:32123/'])assert.throws(()=>receiverOrigin('127.0.0.1:32123',origin,32123),e=>e.status===403);
});

test('HTTP route admission is exact and never takes paths, credentials or query commands',()=>{
 assert.deepEqual(receiverRoute('POST','/api/events'),{route:'EVENTS'});assert.deepEqual(receiverRoute('GET','/api/receipts/'+id(1)),{route:'RECEIPT',id:id(1)});
 for(const [method,target]of [['POST','/api/state'],['GET','/api/control'],['PUT','/api/events'],['POST','/api/receipts/'+id(1)]])assert.throws(()=>receiverRoute(method,target),e=>e.status===405);
 for(const target of ['/api/state?token='+owner,'/api/events#control','/api/receipts/not-a-uuid','/api/receipts/'+id(1)+'/more','http://127.0.0.1:32123/api/state','/../monitor.js','/api/receipts/ABCDEFAB-0000-4000-8000-000000000001'])assert.throws(()=>receiverRoute('GET',target));
});

test('market producer and owner control schemas do not inherit each other’s authority',()=>{
 assert.deepEqual(receiverEvent(JSON.stringify(quote),'EVENTS','producer',m),quote);assert.deepEqual(receiverEvent(JSON.stringify(pause),'CONTROL','owner',m),pause);
 for(const [event,route,role]of [[pause,'CONTROL','producer'],[quote,'EVENTS','owner'],[pause,'EVENTS','producer'],[quote,'CONTROL','owner']])assert.throws(()=>receiverEvent(JSON.stringify(event),route,role,m),e=>e.status===403);
 for(const extra of [{receivedAt:U},{credentials:owner},{ordersEnabled:true},{code:'return 1'},{strategy:{id:id(5)}}])assert.throws(()=>receiverEvent(JSON.stringify({...quote,...extra}),'EVENTS','producer',m),e=>e.code==='INVALID_EVENT');
 assert.throws(()=>receiverEvent('{"requestId":"'+id(1)+'","type":"QUOTE","observedAt":"'+U+'","price":100,"price":101}','EVENTS','producer',m));
});

test('producer receipt lookup cannot disclose a known owner control or its body/hash',()=>{
 const ownerReceipt=receiverReceipt(paused,pause.requestId,'owner');assert.equal(ownerReceipt.receipt.receivedAt,V);
 let hidden,missing;try{receiverReceipt(paused,pause.requestId,'producer');}catch(e){hidden=e;}try{receiverReceipt(paused,id(999),'producer');}catch(e){missing=e;}
 assert.equal(hidden.status,404);assert.equal(hidden.code,missing.code);assert.equal(hidden.message,missing.message);assert.equal('receipt'in hidden,false);assert.equal('eventDigest'in hidden,false);assert(!JSON.stringify(hidden).includes(pause.requestId));
});

test('receipt reconciliation preserves the original event receipt even after later state transitions',()=>{
 const receipt=receiverReceipt(paused,quote.requestId,'producer');assert.equal(receipt.sessionId,paused.config.sessionId);assert.equal(receipt.receipt.sequence,1);assert.equal(receipt.receipt.receivedAt,U);assert.equal(receipt.duplicate,true);assert.equal(receipt.stateDigest,paused.state.stateDigest);assert.equal(receipt.journalDigest,paused.journalDigest);assert.equal(receipt.ordersEnabled,false);
 assert.equal(receipt.receipt.eventDigest,sha(JSON.stringify(quote)));assert.equal('event'in receipt,false);
});

test('state projection presents actual confirmed marks, source uncertainty and finite retained capacity',async()=>{
 await m.verifySessionJournal(paused);const projection=receiverState(paused,m);assert.equal(projection.kind,'LOCAL_DEMO_RECEIVER_STATE');assert.equal(projection.classification,'AUTHOR_REPORTED');assert.equal(projection.qualification,'NONE');assert.equal(projection.source.authenticity,'UNKNOWN');assert.equal(projection.clockMode,'SYSTEM_RECEIPT');assert.equal(projection.liveEnabled,false);assert.equal(projection.ordersEnabled,false);
 assert.deepEqual(projection.account,paused.state.account);assert.deepEqual(projection.lastQuote,paused.state.quotes.at(-1));assert.equal(projection.lastReceipt.receivedAt,V);assert.equal(projection.status,'PAUSED');assert.equal(projection.capacity.eventsRetained,2);assert.equal(projection.capacity.remainingNormal,1998);assert.equal(projection.capacity.remainingTotal,2030);assert.equal(projection.capacity.journalBytes,Buffer.byteLength(JSON.stringify(paused)));assert.equal(projection.stateDigest,paused.state.stateDigest);assert.equal('credentials'in projection,false);assert(Buffer.byteLength(JSON.stringify(projection))<=receiverLimits.stateBytes);
});

test('projection retains only bounded recent audit and computes reserved capacity without evicting history',()=>{
 const fixture=structuredClone(paused);fixture.state.audit=Array.from({length:64},(_,sequence)=>({...fixture.state.audit[0],sequence}));fixture.events=Array(2001).fill(fixture.events[0]);
 const projection=receiverState(fixture,m);assert.equal(projection.recentAudit.length,32);assert.equal(projection.recentAudit[0].sequence,32);assert.equal(projection.capacity.remainingNormal,0);assert.equal(projection.capacity.remainingTotal,31);assert.equal(fixture.state.audit.length,64);assert.equal(fixture.events.length,2001);
});

test('receiver READY cannot claim a synthetic clock or a journal differing from the durable child',()=>{
 receiverReady(summary(empty),empty);for(const changes of [{stateDigest:'0'.repeat(64)},{journalDigest:'0'.repeat(64)},{sequence:1},{ordersEnabled:true},{clockMode:'SYNTHETIC_PLAYBACK'},{sessionId:id(88)},{status:'STOPPED'}])assert.throws(()=>receiverReady({...summary(empty),...changes},empty),e=>e.status===503);
 const synthetic=structuredClone(empty);synthetic.config.clockMode='SYNTHETIC_PLAYBACK';assert.throws(()=>receiverReady(summary(synthetic),synthetic));
});

test('a real appended journal correlates child acknowledgment to the exact event and retained state',async()=>{
 await m.verifySessionJournal(quoted);const raw=acknowledgment(quoted,quote),receipt=receiverAcknowledgment(raw,quote,empty,quoted,m);assert.equal(receipt.duplicate,false);assert.equal(receipt.receipt.sequence,1);assert.equal(receipt.receipt.eventDigest,sha(JSON.stringify(quote)));assert.equal(receipt.receipt.receivedAt,U);assert.equal(receipt.stateDigest,quoted.state.stateDigest);
 for(const changes of [{type:'NOT_CONFIRMED'},{requestId:id(10)},{duplicate:true},{sequence:2},{journalDigest:'0'.repeat(64)},{stateDigest:'1'.repeat(64)},{disposition:'REJECTED'},{reason:'EMERGENCY_STOP'},{ordersEnabled:true}])assert.throws(()=>receiverAcknowledgment({...raw,...changes},quote,empty,quoted,m),e=>e.status===503);
});

test('duplicate child acknowledgments reconcile original time without admitting another event',()=>{
 const receipt=receiverAcknowledgment(acknowledgment(paused,quote,true),quote,paused,paused,m);assert.equal(receipt.duplicate,true);assert.equal(receipt.receipt.sequence,1);assert.equal(receipt.receipt.receivedAt,U);assert.equal(paused.events.length,2);
 assert.throws(()=>receiverAcknowledgment(acknowledgment(paused,quote,true),{...quote,price:101},paused,paused,m),e=>e.status===409);
});

test('acknowledgments refuse replacement configuration, lost prefixes and mismatching received times',()=>{
 for(const alter of [v=>v.config.initialCapital+=1,v=>v.startedAt=U,v=>v.events[0].event.price=101,v=>v.events[0].receivedAt=V,v=>v.events[0].stateDigest='0'.repeat(64)]){
  const wrong=structuredClone(quoted);alter(wrong);assert.throws(()=>receiverAcknowledgment(acknowledgment(wrong,quote),quote,empty,wrong,m),e=>e.status===503);
 }
 const lost=structuredClone(paused);lost.events.shift();assert.throws(()=>receiverAcknowledgment(acknowledgment(lost,pause),pause,quoted,lost,m),e=>e.status===503);
});

test('structurally admitted future inputs retain their rejected receipt instead of disappearing at transport',async()=>{
 const event=receiverEvent(JSON.stringify({...quote,requestId:id(3),observedAt:'2025-01-02T00:00:00.000Z'}),'EVENTS','producer',m),rejected=await m.appendSessionEvent(empty,event,U);
 await m.verifySessionJournal(rejected);const raw=acknowledgment(rejected,event),receipt=receiverAcknowledgment(raw,event,empty,rejected,m);
 assert.equal(receipt.receipt.disposition,'REJECTED');assert.equal(receipt.receipt.reason,'FUTURE_INPUT');assert.equal(rejected.events.length,1);assert.equal(rejected.state.quotes.length,0);assert.equal(rejected.state.openPositions.length,0);assert.equal(receipt.receipt.sequence,1);assert.equal(receiverReceipt(rejected,event.requestId,'producer').receipt.reason,'FUTURE_INPUT');
});

test('pending producer and owner operations remain bound to the original session across same-port restarts',()=>{
 receiverSessionId(empty.config.sessionId,empty.config.sessionId);assert.throws(()=>receiverSessionId(id(99),empty.config.sessionId),e=>e.status===409&&e.code==='SESSION_MISMATCH');
 for(const value of [undefined,'not-a-uuid',empty.config.sessionId+', '+id(99)])assert.throws(()=>receiverSessionId(value,empty.config.sessionId),e=>e.status===400);
 const receipt=receiverReceipt(paused,quote.requestId,'owner');assert.equal(receipt.sessionId,empty.config.sessionId);assert.notEqual(receipt.sessionId,id(99));
});

test('local secret material is excluded from all configuration and journal strings, including encoded forms',()=>{
 for(const text of [owner,producer,encodeURIComponent(owner).replaceAll('_','%5f'),'%6f%67%5f%6c%6f%63%61%6c%5f%6f%77%6e%65%72%5f'+'b'.repeat(64), '%256f%2567%255f%256c%256f%2563%2561%256c%255f%2570%2572%256f%2564%2575%2563%2565%2572%255f'+'a'.repeat(64)]){
  assert.throws(()=>receiverNoSecrets({config:{rights:{note:text}},nested:[{author:{name:text}}]}),e=>e.code==='CREDENTIAL_MATERIAL'&&!e.message.includes(text));
 }
 const escaped=JSON.parse('{"sourceLabel":"\\u006f\\u0067_local_owner_'+'b'.repeat(64)+'"}');assert.throws(()=>receiverNoSecrets(escaped));receiverNoSecrets({sourceLabel:'My supplied observations',strategy:empty.config.strategy});
});

test('run instance binds canonical initial history and stays stable through append and reconstruction',async()=>{
 const first=receiverInstance(empty),fresh=await m.createSessionJournal(empty.config,V);assert.match(first,/^[a-f0-9]{64}$/);assert.equal(first,sha(JSON.stringify({kind:'LOCAL_SESSION_INSTANCE_V1',config:empty.config,startedAt:empty.startedAt,implementation:empty.implementation})));
 assert.equal(receiverInstance(quoted),first);assert.equal(receiverInstance(paused),first);assert.equal(receiverInstance(await m.reconstructSessionJournal(JSON.parse(JSON.stringify(paused)))),first);
 assert.equal(fresh.config.sessionId,empty.config.sessionId);assert.notEqual(receiverInstance(fresh),first);assert.equal(receiverState(paused,m).sessionInstance,first);assert.equal(receiverReceipt(paused,quote.requestId,'owner').sessionInstance,first);
 receiverSessionInstance(first,first);assert.throws(()=>receiverSessionInstance(first,receiverInstance(fresh)),e=>e.status===409&&e.code==='SESSION_MISMATCH');
 for(const value of [undefined,'not-a-hash',first.toUpperCase(),first+', '+first])assert.throws(()=>receiverSessionInstance(value,first),e=>e.status===400);
});
