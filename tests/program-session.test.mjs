import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadProgramSessionTestModule,loadInstrumentedProgramSessionTestModule,programSessionFixture,programSessionTestId as id} from './program-session-fixtures.mjs';
import {makeProgram,iconst,dconst,local,constantProgram,configureType,onBarType} from './helpers/program-fixtures.mjs';
let m;
before(async()=>{m=await loadProgramSessionTestModule();});
const copy=raw=>JSON.parse(JSON.stringify(raw)),later=(at,delta)=>new Date(Date.parse(at)+delta).toISOString();
async function step(journal,event,receivedAt,completedAt=receivedAt){const pending=await m.admitProgramSessionEvent(journal,event,receivedAt);return m.executeProgramSessionPending(pending,{clock:()=>completedAt});}
async function seed(options){const fixture=await programSessionFixture(options);return {...fixture,journal:await m.createProgramSessionJournal(fixture.config,fixture.startedAt)};}
async function barStep(journal,row){return step(journal,row.event,row.receivedAt,row.completedAt);}
async function quote(journal,n,at,price,observedAt=at){return step(journal,{requestId:id(n),type:'QUOTE',observedAt,price},at,at);}
async function reseal(raw){const {journalDigest,...body}=raw;void journalDigest;raw.journalDigest=await m.programSessionDigest(JSON.stringify(body));return raw;}

test('actual persistent nonpreset guest configures once, sees causal prior state and trades through unchanged quote kernel',async()=>{
 const f=await seed();let journal=f.journal;assert.equal(journal.guest.status,'UNCONFIGURED');assert.equal(journal.guest.configure.length,0);assert.equal(journal.guest.initialState,null);
 journal=await barStep(journal,f.events[0]);assert.equal(journal.guest.configure.length,1);assert.equal(journal.guest.trace[0].output,0);
 journal=await barStep(journal,f.events[1]);assert.deepEqual(journal.guest.trace.map(r=>r.output),[0,2]);assert.deepEqual(journal.guest.trace.map(r=>r.barIndex),[0,1]);assert.deepEqual(journal.guest.state.globals,[99,0]);assert.equal(journal.guest.configure.length,1);
 assert.equal(journal.config.strategy.record.version,2);assert.equal(journal.trading.config.strategy.record.version,1);assert.notEqual(journal.config.strategy.record.id,journal.trading.config.strategy.record.id);assert.equal(journal.trading.config.strategy.record.content.program,undefined);
 assert.deepEqual(journal.config.strategy.record.content.definition,journal.trading.config.strategy.record.content.definition);assert.equal(journal.trading.state.pending.decisionKnownAt,f.events[1].completedAt);
 journal=await quote(journal,900,later(f.bars[1].closedAt,12),99);assert.equal(journal.trading.state.openPositions.length,1);assert.equal(journal.trading.state.trades.length,0);assert.equal(journal.events.length,3);assert.equal(journal.trading.state.sequence,4);
 journal=await quote(journal,901,later(f.bars[1].closedAt,14),103);assert.equal(journal.trading.state.openPositions.length,0);assert.equal(journal.trading.state.trades[0].direction,'SHORT');assert.equal(journal.trading.state.trades[0].reason,'STOP_LOSS');assert(journal.trading.state.trades[0].netPnl<0);assert(journal.trading.state.account.totalFees>0);
 const recovered=await m.reconstructProgramSessionJournal(copy(journal));assert.deepEqual(recovered,journal);assert.equal(recovered.ordersEnabled,false);assert.equal(recovered.qualification,'NONE');assert(Object.isFrozen(recovered.guest.state.globals));
});
test('a quote observed before real guest completion cannot fill a later generated decision',async()=>{
 const f=await seed();let journal=await barStep(f.journal,f.events[0]);journal=await barStep(journal,f.events[1]);
 const signal=journal.trading.state.signals[0].signal;assert.equal(signal.availableAt,f.events[1].completedAt);assert.notEqual(signal.availableAt,f.events[1].receivedAt);
 journal=await quote(journal,910,later(f.bars[1].closedAt,11),99,later(f.bars[1].closedAt,5));assert.equal(journal.trading.state.openPositions.length,0);assert(journal.trading.state.audit.some(row=>row.reason==='AWAITING_FRESH_QUOTE'));
 journal=await quote(journal,911,later(f.bars[1].closedAt,13),99,later(f.bars[1].closedAt,12));assert.equal(journal.trading.state.openPositions.length,1);await m.reconstructProgramSessionJournal(copy(journal));
});
test('original retries and duplicate pending execution cannot advance the retained guest twice',async()=>{
 const f=await seed();let journal=await barStep(f.journal,f.events[0]),pending=await m.admitProgramSessionEvent(journal,f.events[1].event,f.events[1].receivedAt);
 assert.equal(await m.admitProgramSessionEvent(pending,f.events[1].event,later(f.events[1].receivedAt,1)),pending);
 const first=await m.executeProgramSessionPending(pending,{clock:()=>f.events[1].completedAt}),second=await m.executeProgramSessionPending(pending,{clock:()=>f.events[1].completedAt});assert.deepEqual(second,first);assert.equal(first.guest.trace.length,2);
 assert.equal(await m.admitProgramSessionEvent(first,f.events[1].event,later(f.events[1].receivedAt,100)),first);
 await assert.rejects(()=>m.admitProgramSessionEvent(first,{...f.events[1].event,bar:{...f.events[1].event.bar,volume:5}},f.events[1].receivedAt),e=>e.status===409);
});
test('kernel-rejected future, duplicate-time and gapped bars retain receipts without advancing causal indices',async()=>{
 const f=await seed({prices:[100,99,98,97]});let journal=f.journal;
 journal=await step(journal,f.events[0].event,f.startedAt,f.startedAt);assert.equal(journal.events[0].reason,'REJECTED');assert.equal(journal.guest.trace.length,0);assert.equal(journal.guest.configure.length,0);
 journal=await barStep(journal,{...f.events[0],event:{...f.events[0].event,requestId:id(920)}});assert.equal(journal.guest.trace.length,1);
 journal=await barStep(journal,{...f.events[0],event:{...f.events[0].event,requestId:id(921)},receivedAt:f.events[1].receivedAt,completedAt:f.events[1].completedAt});assert.equal(journal.guest.trace.length,1);
 journal=await barStep(journal,f.events[2]);assert.equal(journal.events.at(-1).reason,'REJECTED');assert.equal(journal.guest.trace.length,1);
 journal=await barStep(journal,{...f.events[1],receivedAt:f.events[2].receivedAt,completedAt:f.events[2].completedAt});assert.deepEqual(journal.guest.trace.map(row=>row.barIndex),[0,1]);await m.reconstructProgramSessionJournal(copy(journal));
});
test('ordinary pause advances accepted guest state but suppresses signals that could leak into resume',async()=>{
 const f=await seed({binary:constantProgram(2),parameters:[]});let journal=await step(f.journal,{requestId:id(930),type:'PAUSE'},f.startedAt);
 journal=await barStep(journal,f.events[0]);assert.equal(journal.guest.trace[0].output,2);assert.equal(journal.guest.trace[0].signalDisposition,'SUPPRESSED_PAUSED');assert.equal(journal.trading.state.signals.length,0);
 journal=await step(journal,{requestId:id(931),type:'RESUME'},later(f.bars[0].closedAt,11));journal=await quote(journal,932,later(f.bars[0].closedAt,12),100);assert.equal(journal.trading.state.openPositions.length,0);assert.equal(journal.trading.state.pending,null);await m.reconstructProgramSessionJournal(copy(journal));
});
for(const mode of ['trap','fuel'])test(`${mode} retains partial mutation and consumed fuel while later quote protects existing exposure`,async()=>{
 const adverse=mode==='trap'?[...iconst(1),...iconst(0),0x6d]:[0x03,0x40,0x0c,0,0x0b,...iconst(0)],binary=makeProgram({globals:[{type:'f64',mutable:true,value:0}],functions:[{type:0,body:[...local(0),0x45,0x04,0x7f,...iconst(2),0x05,...dconst(7),0x24,0,...adverse,0x0b]}]});
 const f=await seed({binary,parameters:[]});let journal=await barStep(f.journal,f.events[0]);journal=await quote(journal,940,later(f.bars[0].closedAt,12),100);assert.equal(journal.trading.state.openPositions.length,1);
 journal=await barStep(journal,f.events[1]);assert.equal(journal.guest.status,'FAILED');assert.equal(journal.guest.failure,mode==='trap'?'PROGRAM_TRAP':'FUEL_LIMIT');assert.equal(journal.guest.state.globals[0],7);assert(journal.guest.trace.at(-1).fuelUsed>0);if(mode==='fuel')assert.equal(journal.guest.trace.at(-1).fuelUsed,20000);
 assert.equal(journal.trading.state.status,'PAUSED');assert.equal(journal.trading.state.openPositions.length,1);assert.equal(journal.trading.state.trades.length,0);
 journal=await step(journal,{requestId:id(941),type:'RESUME'},later(f.bars[1].closedAt,11));assert.equal(journal.events.at(-1).reason,'GENERATOR_BLOCKED');assert.equal(journal.trading.state.status,'PAUSED');
 journal=await quote(journal,942,later(f.bars[1].closedAt,12),104);assert.equal(journal.trading.state.openPositions.length,0);assert(journal.trading.state.trades[0].netPnl<0);await m.reconstructProgramSessionJournal(copy(journal));
});
test('configure trap remains complete before on_bar and cannot falsely claim readiness',async()=>{
 const binary=makeProgram({types:[onBarType,configureType],globals:[{type:'f64',mutable:true,value:0}],functions:[{type:0,body:iconst(0)},{type:1,body:[...dconst(9),0x24,0,0x00]}],exports:[{name:'on_bar',kind:0,index:0},{name:'configure',kind:0,index:1}]});
 const f=await seed({binary,parameters:[3]});const journal=await barStep(f.journal,f.events[0]);assert.equal(journal.guest.status,'FAILED');assert.equal(journal.guest.configure[0].status,'FAILED');assert.equal(journal.guest.trace.length,0);assert.equal(journal.guest.state.globals[0],9);assert(journal.guest.totalFuel>0);assert.equal(journal.trading.state.status,'PAUSED');await m.reconstructProgramSessionJournal(copy(journal));
});
test('exact initial and failed bounded memory are retained and rebuilt after a partial guest trap',async()=>{
 const binary=makeProgram({memory:{initial:1,maximum:1},globals:[{type:'f64',mutable:true,value:-0}],functions:[{type:0,body:[...iconst(0),...iconst(255),0x3a,0,0,...iconst(1),...iconst(0),0x6d]}]}),f=await seed({binary,parameters:[]}),journal=await barStep(f.journal,f.events[0]);
 assert.equal(journal.guest.status,'FAILED');assert.equal(journal.guest.initialState.memory.length,65536);assert.equal(journal.guest.initialState.memory[0],0);assert.equal(journal.guest.state.memory[0],255);assert.equal(journal.guest.state.globalBits[0],'0000000000000080');assert.equal(journal.guest.initialState.globalBits[0],'0000000000000080');
 const rebuilt=await m.reconstructProgramSessionJournal(copy(journal));assert.deepEqual(rebuilt.guest.state.memory,journal.guest.state.memory);assert.equal(rebuilt.guest.stateDigest,journal.guest.stateDigest);const forged=copy(journal);forged.guest.state.memory[0]=1;forged.guest.stateDigest=await m.programSessionDigest(JSON.stringify(forged.guest.state));forged.events.at(-1).guestStateDigest=forged.guest.stateDigest;await reseal(forged);await m.verifyProgramSessionJournal(forged);await assert.rejects(()=>m.reconstructProgramSessionJournal(forged));
});
test('raw signed-zero globals survive canonical JSON and fabricated hash-consistent snapshots fail fresh replay',async()=>{
 const binary=makeProgram({globals:[{type:'f64',mutable:true,value:-0}],functions:[{type:0,body:iconst(0)}]}),f=await seed({binary,parameters:[]}),journal=await barStep(f.journal,f.events[0]);assert.equal(journal.guest.state.globalBits[0],'0000000000000080');assert.equal(copy(journal).guest.state.globals[0],0);assert.equal((await m.reconstructProgramSessionJournal(copy(journal))).guest.state.globalBits[0],'0000000000000080');
 const fraud=copy(journal);fraud.guest.state.globals[0]=500;const bits=new Uint8Array(8);new DataView(bits.buffer).setFloat64(0,500,true);fraud.guest.state.globalBits[0]=Buffer.from(bits).toString('hex');fraud.guest.stateDigest=await m.programSessionDigest(JSON.stringify(fraud.guest.state));fraud.events.at(-1).guestStateDigest=fraud.guest.stateDigest;await reseal(fraud);await m.verifyProgramSessionJournal(fraud);await assert.rejects(()=>m.reconstructProgramSessionJournal(fraud));
});
test('crash pending retains original INTERRUPTED identity, pauses without execution, and explicit resume preserves completed prefix',async()=>{
 const f=await seed();let journal=await barStep(f.journal,f.events[0]);const pending=await m.admitProgramSessionEvent(journal,f.events[1].event,f.events[1].receivedAt);
 journal=await m.recoverProgramSessionJournal(copy(pending),later(f.bars[1].closedAt,20));assert.equal(journal.events.at(-1).event.requestId,f.events[1].event.requestId);assert.equal(journal.events.at(-1).status,'INTERRUPTED');assert.equal(journal.guest.trace.length,1);assert.equal(journal.guest.status,'INTERRUPTED');assert.equal(journal.trading.state.status,'PAUSED');assert.equal(await m.admitProgramSessionEvent(journal,f.events[1].event,later(f.bars[1].closedAt,21)),journal);
 journal=await step(journal,{requestId:id(950),type:'RESUME'},later(f.bars[1].closedAt,22));journal=await barStep(journal,{...f.events[1],event:{...f.events[1].event,requestId:id(951)},receivedAt:later(f.bars[1].closedAt,23),completedAt:later(f.bars[1].closedAt,24)});assert.deepEqual(journal.guest.trace.map(row=>row.barIndex),[0,1]);assert.equal(journal.guest.configure.length,1);await m.reconstructProgramSessionJournal(copy(journal));
});
test('inert browser pending preparation does not execute guest, and untrusted claimed prefix is reconstructed before actual execution',async()=>{
 const f=await seed(),journal=await barStep(f.journal,f.events[0]),pending=await m.prepareProgramSessionAdmission(copy(journal),f.events[1].event,f.events[1].receivedAt);assert.equal(pending.guest.trace.length,1);assert.deepEqual(pending.guest,journal.guest);const terminal=await m.executeProgramSessionPending(pending,{clock:()=>f.events[1].completedAt});assert.equal(terminal.guest.trace.length,2);
 const fraud=copy(journal);fraud.guest.totalFuel++;fraud.guest.trace[0].fuelUsed++;await reseal(fraud);const admitted=await m.prepareProgramSessionAdmission(fraud,f.events[1].event,f.events[1].receivedAt);await assert.rejects(()=>m.executeProgramSessionPending(admitted,{clock:()=>f.events[1].completedAt}));
});
test('external SIGNAL, executable objects, noncanonical bar zero and regressing completion clocks are rejected',async()=>{
 const f=await seed();await assert.rejects(()=>m.admitProgramSessionEvent(f.journal,{requestId:id(960),type:'SIGNAL',signal:{id:id(961),provider:'CUSTOM',event:'BEARISH',observedAt:f.bars[0].closedAt,availableAt:f.bars[0].closedAt}},f.bars[0].closedAt));
 let called=false;const accessor={};Object.defineProperty(accessor,'pending',{enumerable:true,get(){called=true;return {};}});await assert.rejects(()=>m.verifyProgramSessionJournal(accessor));assert.equal(called,false);
 await assert.rejects(()=>m.admitProgramSessionEvent(f.journal,{...f.events[0].event,bar:{...f.events[0].event.bar,volume:-0}},f.events[0].receivedAt));
 const pending=await m.admitProgramSessionEvent(f.journal,f.events[0].event,f.events[0].receivedAt);await assert.rejects(()=>m.executeProgramSessionPending(pending,{clock:()=>f.startedAt}));const interrupted=await m.recoverProgramSessionJournal(copy(pending),f.events[0].completedAt);assert.equal(interrupted.guest.trace.length,0);
 assert.throws(()=>m.boundedProgramSessionConfig({...f.config,rights:{...f.config.rights,note:'og_local_producer_secret'}}));assert.throws(()=>m.boundedProgramSessionConfig({...f.config,sourceLabel:'%6f%67%5f%6c%6f%63%61%6c%5f%6f%77%6e%65%72%5fsecret'}));
 const abort=new AbortController();abort.abort();await assert.rejects(()=>m.reconstructProgramSessionJournal(null,{signal:abort.signal}));
});
test('new physical source pins and complete original risk remain explicit without altering legacy pins',async()=>{
 const {assertProgramSessionExecutionFingerprints,currentProgramSessionFingerprints}=await import('../scripts/program-session-fingerprint-core.mjs');assertProgramSessionExecutionFingerprints();const pins=currentProgramSessionFingerprints();for(const [key,path]of Object.entries({engine:'app/program-session-engine.ts',model:'app/program-session-model.ts',journal:'app/program-session-journal.ts'}))assert.equal(pins[key],createHash('sha256').update(readFileSync(path)).digest('hex'));
 const f=await seed();assert.equal(f.journal.config.initialCapital,f.journal.trading.config.initialCapital);assert.deepEqual(f.journal.config.strategy.record.content.definition.risk,f.journal.trading.config.strategy.record.content.definition.risk);assert.equal(f.journal.liveEnabled,false);
});
test('live append preserves the trusted kernel identity while an imported prefix cold-reconstructs the guest',async()=>{
 const observed=await loadInstrumentedProgramSessionTestModule(),n=observed.m,f=await programSessionFixture();try{let journal=await n.createProgramSessionJournal(f.config,f.startedAt);
  for(const row of f.events.slice(0,2)){const pending=await n.admitProgramSessionEvent(journal,row.event,row.receivedAt);assert.equal(pending.trading,journal.trading);journal=await n.executeProgramSessionPending(pending,{clock:()=>row.completedAt});}
  for(let k=0;k<8;k++){const at=later(f.events[1].completedAt,k+1),pending=await n.admitProgramSessionEvent(journal,{requestId:id(17000+k),type:'PAUSE'},at);assert.equal(pending.trading,journal.trading);journal=await n.executeProgramSessionPending(pending,{clock:()=>at});}
  assert.deepEqual(observed.counters,{kernel:0,program:0});const at=later(f.events[1].completedAt,20),pending=await n.admitProgramSessionEvent(copy(journal),{requestId:id(17020),type:'RESUME'},at);assert.deepEqual(observed.counters,{kernel:0,program:1});const terminal=await n.executeProgramSessionPending(pending,{clock:()=>at});assert.equal(terminal.guest.configure.length,1);assert.deepEqual(terminal.guest.trace,journal.guest.trace);assert.equal(terminal.trading.state.sequence,journal.trading.state.sequence+1);
 }finally{observed.close();}
});
test('actual long retained history reserves full bar failure slots and protective quotes still close exposure',async()=>{
 const f=await seed({binary:constantProgram(2),parameters:[],prices:[100]}),bar=f.events[0];let journal=await barStep(f.journal,bar);journal=await quote(journal,10000,later(bar.receivedAt,12),100);assert.equal(journal.trading.state.sequence,3);assert.equal(journal.trading.state.openPositions.length,1);
 for(let n=0;n<1995;n++)journal=await step(journal,{requestId:id(11000+n),type:'PAUSE'},later(bar.receivedAt,20+n));
 assert.equal(journal.trading.state.sequence,1998);const unchanged=journal.journalDigest;
 await assert.rejects(()=>m.admitProgramSessionEvent(journal,{requestId:id(14000),type:'CLOSED_BAR',bar:{...bar.event.bar,closedAt:later(bar.receivedAt,3600000)}},later(bar.receivedAt,3600000)),error=>error.status===429);assert.equal(journal.journalDigest,unchanged);
 journal=await quote(journal,14001,later(bar.receivedAt,3000),104);assert.equal(journal.trading.state.openPositions.length,0);assert(journal.trading.state.trades[0].netPnl<0);
 journal=await step(journal,{requestId:id(14002),type:'EMERGENCY'},later(bar.receivedAt,3001));
 for(let n=0;n<32;n++)journal=await quote(journal,14100+n,later(bar.receivedAt,3010+n),104);
 assert.equal(journal.trading.state.sequence,2032);const final=journal.journalDigest;await assert.rejects(()=>m.admitProgramSessionEvent(journal,{requestId:id(15000),type:'QUOTE',observedAt:later(bar.receivedAt,3100),price:104},later(bar.receivedAt,3100)),error=>error.status===429);assert.equal(journal.journalDigest,final);
 assert.equal(journal.guest.trace.length,1);assert.equal(journal.guest.configure.length,0);
});
