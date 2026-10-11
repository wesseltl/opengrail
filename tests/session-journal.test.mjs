import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
let m,directory;
before(async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/session-journal';export * from './app/session-model';export {syntheticSessionExample} from './app/session-example';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {sessionSourceFingerprints} from './app/session-fingerprints';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-session-journal-'));const path=join(directory,'trusted.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx'});m=await import(pathToFileURL(path).href);
});
after(()=>rmSync(directory,{recursive:true,force:true}));
const at='2025-01-01T01:00:00.000Z',later=milliseconds=>new Date(Date.parse(at)+milliseconds).toISOString(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function seed(){
 const example=await m.syntheticSessionExample(),config=structuredClone(example.config),record=config.strategy.record;
 record.content.definition=m.strategyTemplate('DCA');record.content.definition.entry={type:'DCA',intervalBars:1,maxEntries:4};record.content.definition.risk={positionPct:10,maxOpenPositions:2,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:5};
 config.strategy.digest=await m.strategyDigest(JSON.stringify(record));
 return m.createSessionJournal(config,'2025-01-01T00:00:00.000Z');
}
const bar={requestId:id(1),type:'CLOSED_BAR',bar:{closedAt:at,open:100,high:150,low:50,close:100,volume:1}};
async function open(){let journal=await seed();journal=await m.appendSessionEvent(journal,bar,at);return m.appendSessionEvent(journal,{requestId:id(2),type:'QUOTE',observedAt:later(1),price:100},later(2));}
async function rehash(journal){const {journalDigest,...body}=journal;void journalDigest;journal.journalDigest=await m.sessionDigest(JSON.stringify(body));return journal;}

test('continuous positions remain open across the journal tail and reconstruct every input and intermediate checkpoint',async()=>{
 let journal=await open();assert.equal(journal.state.openPositions.length,1);assert.equal(journal.state.trades.length,0);
 journal=await m.appendSessionEvent(journal,{requestId:id(3),type:'QUOTE',observedAt:later(3),price:101},later(4));
 assert.equal(journal.state.openPositions.length,1);assert.equal(journal.events.length,3);assert.equal(journal.state.sequence,3);
 const rebuilt=await m.reconstructSessionJournal(JSON.parse(JSON.stringify(journal)));assert.deepEqual(rebuilt,journal);
 assert.equal(rebuilt.state.ordersEnabled,false);assert.equal(rebuilt.qualification,'NONE');assert(Object.isFrozen(rebuilt.state.openPositions[0]));
});
test('pause blocks entries while fresh quotes still exit existing positions with actual quote prices and costs',async()=>{
 let journal=await open();journal=await m.appendSessionEvent(journal,{requestId:id(3),type:'PAUSE'},later(3));
 assert.equal(journal.state.openPositions.length,1);assert.equal(journal.state.status,'PAUSED');
 journal=await m.appendSessionEvent(journal,{requestId:id(4),type:'QUOTE',observedAt:later(4),price:110},later(5));
 assert.equal(journal.state.openPositions.length,0);assert.equal(journal.state.trades[0].reason,'TAKE_PROFIT');assert.equal(journal.state.trades[0].exitPrice,109.89);
 assert(journal.state.trades[0].exitFee>0);await m.reconstructSessionJournal(journal);
});
test('emergency preserves an awaiting-exit position until a later fresh quote, with no fabricated flat checkpoint',async()=>{
 let journal=await open();journal=await m.appendSessionEvent(journal,{requestId:id(3),type:'EMERGENCY'},later(3));
 assert.equal(journal.state.status,'STOPPING');assert.equal(journal.state.openPositions.length,1);assert.equal(journal.state.trades.length,0);
 journal=await m.appendSessionEvent(journal,{requestId:id(4),type:'QUOTE',observedAt:later(4),price:90},later(5));
 assert.equal(journal.state.status,'STOPPED');assert.equal(journal.state.openPositions.length,0);assert.equal(journal.state.trades[0].reason,'EMERGENCY_STOP');await m.reconstructSessionJournal(journal);
});
test('admissible future quote rejection remains in the replayable journal rather than silently dropping a failed input',async()=>{
 let journal=await seed();journal=await m.appendSessionEvent(journal,{requestId:id(1),type:'QUOTE',observedAt:later(100),price:100},later(1));
 assert.equal(journal.events.length,1);assert.equal(journal.state.events[0].disposition,'REJECTED');assert.equal(journal.state.events[0].reason,'FUTURE_INPUT');assert.equal(journal.state.quotes.length,0);await m.reconstructSessionJournal(journal);
});
test('exact duplicate retry retains one event while changed request material cannot overwrite its receipt',async()=>{
 const journal=await open(),retry=await m.appendSessionEvent(journal,bar,later(99));assert.equal(retry,journal);assert.equal(retry.events.length,2);
 await assert.rejects(()=>m.appendSessionEvent(journal,{...bar,bar:{...bar.bar,volume:2}},later(99)),error=>error.status===409);assert.equal(journal.events[0].event.bar.volume,1);
});
test('self-hashed account fraud passes identity-only checks but fails recovery and cannot become a trusted append origin',async()=>{
 const raw=JSON.parse(JSON.stringify(await open()));raw.state.account.cash+=100;raw.state.account.equity+=100;
 raw.state.stateDigest=await m.sessionStateDigest(raw.state);raw.events.at(-1).stateDigest=raw.state.stateDigest;await rehash(raw);
 await m.verifySessionJournal(raw);
 await assert.rejects(()=>m.reconstructSessionJournal(raw));
 await assert.rejects(()=>m.appendSessionEvent(raw,{requestId:id(8),type:'QUOTE',observedAt:later(8),price:101},later(9)));
});
test('an intermediate checkpoint cannot be replaced even when the final state and journal hash are self-consistent',async()=>{
 const raw=JSON.parse(JSON.stringify(await open()));raw.events[0].stateDigest='1'.repeat(64);await rehash(raw);await m.verifySessionJournal(raw);await assert.rejects(()=>m.reconstructSessionJournal(raw));
});
test('source substitutions, omitted history and request-body edits fail before recovered positions can be shown',async()=>{
 const original=await open();
 for(const edit of [r=>{r.implementation.engine='1'.repeat(64);},r=>{r.events.shift();},r=>{r.events[0].event.bar.volume=99;}]){
  const raw=JSON.parse(JSON.stringify(original));edit(raw);await rehash(raw);await assert.rejects(()=>m.reconstructSessionJournal(raw));
 }
});
test('sealed journals are deeply frozen while cloned supplied material always goes through real reconstruction',async()=>{
 const original=await open();assert(Object.isFrozen(original));assert(Object.isFrozen(original.config.strategy.record.content.definition));assert.throws(()=>{original.state.account.cash+=1;});
 const clone=JSON.parse(JSON.stringify(original));const next=await m.appendSessionEvent(clone,{requestId:id(3),type:'PAUSE'},later(3));assert.equal(next.state.status,'PAUSED');assert(Object.isFrozen(next));
});
test('oversized and executable objects are rejected without invoking accessors, and reconstruction supports cancellation',async()=>{
 let called=false;const value={};Object.defineProperty(value,'config',{enumerable:true,get(){called=true;return {};}});
 await assert.rejects(()=>m.reconstructSessionJournal(value));assert.equal(called,false);
 await assert.rejects(()=>m.reconstructSessionJournal({padding:'x'.repeat(m.sessionJournalLimits.bytes+1)}));
 const controller=new AbortController();controller.abort();await assert.rejects(()=>m.reconstructSessionJournal(awaitable,{signal:controller.signal}));
});
// No raw journal is required when the already-aborted call is rejected.
const awaitable=null;
test('declared runtime fingerprints match the actual fixed local engine/model/journal source files',()=>{
 for(const [key,path]of Object.entries({engine:'app/session-engine.ts',model:'app/session-model.ts',journal:'app/session-journal.ts'}))assert.equal(m.sessionSourceFingerprints[key],createHash('sha256').update(readFileSync(path)).digest('hex'));
});
test('retained signal, pending emergency and adverse exit examples freshly reconstruct their full shared history',async()=>{
 const journals=[];
 for(const name of ['signal-open.json','emergency-awaiting-quote.json','emergency-adverse-exit.json']){
  const raw=JSON.parse(readFileSync('examples/sessions/'+name,'utf8'));journals.push(await m.reconstructSessionJournal(raw));
 }
 const [open,pending,exit]=journals;
 assert.equal(open.state.openPositions.length,1);assert.equal(open.state.trades.length,0);assert.equal(open.config.clockMode,'SYNTHETIC_PLAYBACK');assert.equal(open.config.provenance,'SYNTHETIC');assert(open.state.consumed.length>0);
 assert.equal(pending.state.status,'STOPPING');assert.equal(pending.state.openPositions.length,1);assert.equal(pending.state.trades.length,0);assert.deepEqual(pending.events.slice(0,-1),open.events);
 assert.equal(exit.state.status,'STOPPED');assert.equal(exit.state.openPositions.length,0);assert.equal(exit.state.trades[0].reason,'EMERGENCY_STOP');assert(exit.state.trades[0].netPnl<0);assert(exit.state.account.totalFees>0);assert.deepEqual(exit.events.slice(0,-1),pending.events);
 for(const journal of journals){assert.equal(journal.classification,'AUTHOR_REPORTED');assert.equal(journal.qualification,'NONE');assert.equal(journal.ordersEnabled,false);assert(Object.isFrozen(journal));}
});
