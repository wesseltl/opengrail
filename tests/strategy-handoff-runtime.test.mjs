import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';

let directory,m;
const children=new Set(),id=n=>'b1000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sha=value=>createHash('sha256').update(value).digest('hex');
// Deterministic, dedicated local test roles. No operator credential command or
// real credential material is read, printed, exported or used by this fixture.
const roles={owner:'og_local_owner_'+sha('INVENTED strategy handoff runtime owner'),producer:'og_local_producer_'+sha('INVENTED strategy handoff runtime producer')};

function deadline(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
async function stop(runner){if(runner.child.exitCode===null&&runner.child.signalCode===null)runner.child.kill('SIGTERM');try{return await deadline(runner.closed,10000,'Local receiver did not stop.');}catch(error){runner.child.kill('SIGKILL');await deadline(runner.closed,5000,'Local receiver did not clean up.');throw error;}}
async function launch(args){
 const child=spawn(process.execPath,['scripts/session-receiver.mjs',...args],{cwd:process.cwd(),env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 const runner={child,closed:null,get stdout(){return stdout;},get stderr(){return stderr;}};children.add(runner);
 runner.closed=new Promise(resolve=>child.once('close',(code,signal)=>{children.delete(runner);resolve({code,signal});}));child.stdout.on('data',part=>{stdout+=part;});child.stderr.on('data',part=>{stderr+=part;});
 const ready=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(Error('Local receiver did not confirm readiness.')),20000);
  const inspect=()=>{if(stdout.length>16384)return finish(Error('Receiver diagnostic capacity exceeded.'));for(const line of stdout.split('\n').slice(0,-1)){let value;try{value=JSON.parse(line);}catch{continue;}if(value.type==='READY')return finish(null,value);}};
  const ended=()=>finish(Error('Receiver ended before readiness.')),failed=()=>finish(Error('Receiver could not start.'));
  function finish(error,value){clearTimeout(timer);child.stdout.off('data',inspect);child.off('exit',ended);child.off('error',failed);error?reject(error):resolve(value);}
  child.stdout.on('data',inspect);child.once('exit',ended);child.once('error',failed);inspect();
 });
 const url=new URL(ready.url);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');return {...runner,ready,url,get stdout(){return stdout;},get stderr(){return stderr;}};
}
async function api(receiver,path,{role='owner',event}={}){
 const response=await fetch(new URL(path,receiver.url),{method:event?'POST':'GET',headers:{Authorization:'Bearer '+roles[role],'X-Session-Id':receiver.ready.sessionId,'X-Session-Instance':receiver.ready.sessionInstance,...(event?{'Content-Type':'application/json'}:{})},body:event?JSON.stringify(event):undefined,signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200,'Actual local receiver request must be durably confirmed.');const body=await response.json();assert.equal(body.ordersEnabled,false);assert(!JSON.stringify(body).includes(roles.owner));assert(!JSON.stringify(body).includes(roles.producer));return body;
}
async function observedAfter(at){const end=Date.now()+1000;while(Date.now()<=Date.parse(at)){assert(Date.now()<end,'System clock must move past the prior receipt.');await delay(3);}return new Date().toISOString();}

before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-handoff-runtime-'));
 const compiled=await build({stdin:{contents:"export {prepareLocalReceiverConfig} from './app/strategy-handoff';export {strategyTemplate,boundedStrategyRecord,strategyDigest,strategyAuthorReference} from './app/strategy-model';export {createSessionJournal,reconstructSessionJournal} from './app/session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 const file=join(directory,'fixed-handoff.mjs');writeFileSync(file,compiled.outputFiles[0].text,{flag:'wx',mode:0o600});m=await import(pathToFileURL(file).href);
});
after(async()=>{for(const runner of [...children])await stop(runner);if(directory)rmSync(directory,{recursive:true,force:true});});

test('actual exported configuration starts empty, then an explicitly invented recovery history retains causal DCA entry and adverse emergency exit', {timeout:60000},async()=>{
 const definition=m.strategyTemplate('DCA');definition.entry.intervalBars=1;definition.entry.maxEntries=1;Object.assign(definition.risk,{positionPct:10,maxOpenPositions:1,stopLossPct:4,takeProfitPct:9,maxDailyLossPct:5});definition.costs={feeBps:23,slippageBps:37};
 const author={kind:'HUMAN',id:'human_'+'b'.repeat(64),sponsorId:'human_'+'b'.repeat(64)},createdAt='2025-01-01T00:00:00.000Z';
 const canonical=m.boundedStrategyRecord({version:1,id:id(1),rootId:id(1),revision:1,requestId:id(2),createdAt,author,content:{name:'INVENTED local handoff runtime fixture',description:'Invented public-shaped source and prices for local integration only; no authentic public registration or provider.',assumptions:'Costs are chosen synthetic assumptions, never measured exchange fees. Recovery start history is explicitly invented.',falsification:'Reject a changed strategy, premature quote fill, missing adverse exit or hidden cost.',sources:[],definition,relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false});
 const digest=await m.strategyDigest(canonical.payload),source={id:id(1),digest,rootId:id(1),revision:1,requestId:id(2),createdAt,author:m.strategyAuthorReference(author),state:'VISIBLE',reason:null,record:canonical.record,moderation:[]};
 const config=await m.prepareLocalReceiverConfig({source,sessionId:id(3),initialCapital:1234.5,sourceLabel:'INVENTED supplied local test events; source UNKNOWN',rightsNote:'Locally invented test data only, no vendor feed or public market evidence.',confirmRights:true});
 const configFile=join(directory,'reviewed-config.json'),hashes=join(directory,'test-role-hashes.json'),freshPath=join(directory,'fresh-start-journal.json'),recoveryPath=join(directory,'invented-recovery-journal.json');
 writeFileSync(configFile,JSON.stringify(config),{flag:'wx',mode:0o600});writeFileSync(hashes,JSON.stringify({version:1,ownerDigest:sha(roles.owner),producerDigest:sha(roles.producer)}),{flag:'wx',mode:0o600});
 assert.equal(statSync(configFile).mode&0o777,0o600);assert.equal(statSync(hashes).mode&0o777,0o600);assert(!existsSync(freshPath));assert(!existsSync(recoveryPath));assert.deepEqual(JSON.parse(readFileSync(configFile,'utf8')).strategy,{record:canonical.record,digest});
 for(const token of Object.values(roles)){assert(!readFileSync(configFile,'utf8').includes(token));assert(!readFileSync(hashes,'utf8').includes(token));}

 // Phase 1 is a real fresh start at its actual system receipt time. Export alone
 // created no journal; launch produces the unchanged exact empty configuration.
 const fresh=await launch(['start',configFile,freshPath,hashes]);let freshStartedAt;
 try{
  assert.equal(fresh.ready.ordersEnabled,false);assert.equal(fresh.ready.liveEnabled,false);assert.equal(fresh.ready.qualification,'NONE');assert.equal(fresh.ready.sourceAuthenticity,'UNKNOWN');assert.equal(fresh.ready.sequence,0);
  const state=await api(fresh,'/api/state');assert.deepEqual(state.strategy,config.strategy);assert.equal(state.sequence,0);assert.equal(state.openPositions.length,0);assert.equal(state.lastQuote,null);assert.equal(state.account.equity,1234.5);assert.equal(state.source.authenticity,'UNKNOWN');
  const publicJournal=await api(fresh,'/api/journal'),saved=await m.reconstructSessionJournal(JSON.parse(readFileSync(freshPath,'utf8')));assert.deepEqual(publicJournal,saved);assert.deepEqual(saved.config,config);assert.equal(saved.events.length,0);assert.equal(saved.state.openPositions.length,0);assert.equal(saved.state.trades.length,0);freshStartedAt=saved.startedAt;
 }finally{const result=await stop(fresh);assert.equal(result.code,0);}

 // Phase 2 uses a different, explicitly invented past-start history, constructed
 // by the real fixed journal constructor. No fresh-start historical entry is
 // claimed and no runtime clock or source pin is overridden to create a fill.
 const inventedStart=new Date(Date.now()-2*3600000).toISOString(),seed=await m.createSessionJournal(config,inventedStart);assert.notEqual(seed.startedAt,freshStartedAt);writeFileSync(recoveryPath,JSON.stringify(seed),{flag:'wx',mode:0o600});
 const recovered=await launch(['resume',recoveryPath,hashes]);
 try{
  assert.equal(recovered.ready.sessionId,fresh.ready.sessionId);assert.notEqual(recovered.ready.sessionInstance,fresh.ready.sessionInstance);assert.equal(recovered.ready.status,'PAUSED');assert.equal(recovered.ready.requiresExplicitResume,true);
  const resumed=await api(recovered,'/api/control',{event:{requestId:id(4),type:'RESUME'}});assert.equal(resumed.receipt.disposition,'ACCEPTED');
  const closedAt=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString(),bar={requestId:id(5),type:'CLOSED_BAR',bar:{closedAt,open:100,high:101,low:99,close:100,volume:1}};
  const decision=await api(recovered,'/api/events',{role:'producer',event:bar});assert.equal(decision.receipt.disposition,'ACCEPTED');let state=await api(recovered,'/api/state');assert(state.pending);assert.equal(state.openPositions.length,0);
  const early={requestId:id(6),type:'QUOTE',observedAt:decision.receipt.receivedAt,price:100};await api(recovered,'/api/events',{role:'producer',event:early});state=await api(recovered,'/api/state');assert.equal(state.openPositions.length,0);assert(state.pending);
  const observedAt=await observedAfter(state.lastReceipt.receivedAt),entry={requestId:id(7),type:'QUOTE',observedAt,price:100},filled=await api(recovered,'/api/events',{role:'producer',event:entry});state=await api(recovered,'/api/state');assert.equal(state.openPositions.length,1);assert.equal(state.openPositions[0].entryObservedAt,observedAt);assert(state.openPositions[0].entryAt>decision.receipt.receivedAt);assert(state.openPositions[0].entryObservedAt>decision.receipt.receivedAt);assert.equal(state.openPositions[0].entryPrice,100*1.0037);
  const original=await api(recovered,'/api/receipts/'+entry.requestId,{role:'producer'});assert.deepEqual(original.receipt,filled.receipt);const duplicate=await api(recovered,'/api/events',{role:'producer',event:entry});assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.receipt,filled.receipt);assert.equal((await api(recovered,'/api/state')).openPositions.length,1);
  const emergency=await api(recovered,'/api/control',{event:{requestId:id(8),type:'EMERGENCY'}});state=await api(recovered,'/api/state');assert.equal(state.status,'STOPPING');assert.equal(state.openPositions.length,1);assert.equal(state.pending,null);
  const exitAt=await observedAfter(emergency.receipt.receivedAt),exit=await api(recovered,'/api/events',{role:'producer',event:{requestId:id(9),type:'QUOTE',observedAt:exitAt,price:90}});state=await api(recovered,'/api/state');assert.equal(state.status,'STOPPED');assert.equal(state.openPositions.length,0);assert.equal(state.ordersEnabled,false);assert.equal(state.liveEnabled,false);assert.equal(state.qualification,'NONE');
  const disk=readFileSync(recoveryPath,'utf8'),saved=await m.reconstructSessionJournal(JSON.parse(disk)),publicJournal=await api(recovered,'/api/journal');assert.deepEqual(publicJournal,saved);assert.deepEqual(saved.config,config);assert.equal(saved.journalDigest,exit.journalDigest);assert.equal(saved.state.stateDigest,exit.stateDigest);assert.equal(saved.state.events.at(-1).receivedAt,exit.receipt.receivedAt);assert.equal(saved.classification,'AUTHOR_REPORTED');assert.equal(saved.qualification,'NONE');assert.equal(saved.state.trades.length,1);assert.equal(saved.state.trades[0].reason,'EMERGENCY_STOP');assert(saved.state.trades[0].netPnl<0);assert(saved.state.trades[0].entryFee>0);assert(saved.state.trades[0].exitFee>0);assert.equal(saved.state.trades[0].exitPrice,90*.9963);assert(saved.state.account.equity<1234.5);assert(saved.state.audit.some(row=>row.reason==='AWAITING_FRESH_QUOTE'));
  const trade=saved.state.trades[0];assert(Math.abs(trade.netPnl-(trade.grossPnl-trade.entryFee-trade.exitFee))<1e-10);assert.equal(new Set(saved.events.map(row=>row.event.requestId)).size,saved.events.length);
  for(const token of Object.values(roles)){assert(!disk.includes(token));assert(!fresh.stdout.includes(token));assert(!fresh.stderr.includes(token));assert(!recovered.stdout.includes(token));assert(!recovered.stderr.includes(token));}
 }finally{const result=await stop(recovered);assert.equal(result.code,0);}
});
