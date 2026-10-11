import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {runProducer,ProducerStore,cleanupProducerModules} from '../scripts/kraken-market-data.mjs';

// All credentials, source claims, bars, prices and recovery histories below are
// invented local fixtures. The sourceFetch seam never contacts a provider.
let directory,m,signals;
const children=new Set(),sha=value=>createHash('sha256').update(value).digest('hex');
const roles={owner:'og_local_owner_'+sha('INVENTED supplied signal pipeline owner'),producer:'og_local_producer_'+sha('INVENTED supplied signal pipeline producer')};
function deadline(promise,ms,message='Local pipeline timeout.'){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
async function stop(r){if(r.child.exitCode===null&&r.child.signalCode===null)r.child.kill('SIGTERM');try{return await deadline(r.closed,10000);}catch(error){r.child.kill('SIGKILL');await deadline(r.closed,5000);throw error;}}
async function launch(journalPath,hashesPath,port){
 const child=spawn(process.execPath,['scripts/session-receiver.mjs','resume',journalPath,hashesPath,...(port?[String(port)]:[])],{cwd:process.cwd(),env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 const r={child,closed:null,get stdout(){return stdout;},get stderr(){return stderr;}};children.add(r);r.closed=new Promise(resolve=>child.once('close',(code,signal)=>{children.delete(r);resolve({code,signal});}));child.stdout.on('data',part=>{stdout+=part;});child.stderr.on('data',part=>{stderr+=part;});
 const ready=await deadline(new Promise((resolve,reject)=>{const inspect=()=>{if(stdout.length>16384)return finish(Error('Receiver diagnostics exceeded their bound.'));for(const line of stdout.split('\n').slice(0,-1)){let value;try{value=JSON.parse(line);}catch{continue;}if(value.type==='READY')return finish(null,value);}};const ended=()=>finish(Error('Receiver ended before readiness.'));function finish(error,value){child.stdout.off('data',inspect);child.off('exit',ended);child.off('error',ended);error?reject(error):resolve(value);}child.stdout.on('data',inspect);child.once('exit',ended);child.once('error',ended);inspect();}),25000);
 const origin=new URL(ready.url).origin;assert.equal(new URL(origin).hostname,'127.0.0.1');assert.equal(new URL(origin).protocol,'http:');return {...r,ready,origin,get stdout(){return stdout;},get stderr(){return stderr;}};
}
async function api(f,path,{event,role='owner'}={}){
 const response=await fetch(new URL(path,f.r.origin),{method:event?'POST':'GET',headers:{Authorization:'Bearer '+roles[role],'X-Session-Id':f.config.sessionId,'X-Session-Instance':f.r.ready.sessionInstance,...(event?{'Content-Type':'application/json'}:{})},body:event?JSON.stringify(event):undefined,signal:AbortSignal.timeout(10000),redirect:'error'});
 assert.equal(response.status,200,'The actual durable receiver must confirm this fixture operation.');const body=await response.json();assert.equal(body.ordersEnabled,false);return body;
}
async function observedAfter(at){const end=Date.now()+1500;while(Date.now()<=Date.parse(at)){assert(Date.now()<end,'Actual system clock failed to advance.');await delay(3);}return new Date().toISOString();}
async function fixture(direction='LONG'){
 const home=join(directory,randomUUID());const {mkdirSync}=await import('node:fs');mkdirSync(home);
 const config=structuredClone((await m.syntheticSessionExample()).config),definition=m.strategyTemplate('SIGNAL');
 Object.assign(definition.market,{symbol:'BTC/USD',timeframe:'5m',direction});definition.entry={type:'SIGNAL',provider:'CUSTOM',event:direction==='LONG'?'BULLISH':'BEARISH',maxAgeBars:3};definition.risk={positionPct:10,maxOpenPositions:1,stopLossPct:4,takeProfitPct:9,maxDailyLossPct:5};definition.costs={feeBps:23,slippageBps:37};
 Object.assign(config,{sessionId:randomUUID(),clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',provenance:'USER_SUPPLIED',initialCapital:1000,sourceLabel:'INVENTED local supplied-signal pipeline',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'INVENTED fixture data only; no provider or real forward evidence.'}});config.strategy.record.content.definition=definition;config.strategy.digest=await m.strategyDigest(JSON.stringify(config.strategy.record));
 const barAt=new Date(Math.floor(Date.now()/300000)*300000).toISOString(),startedAt=new Date(Date.parse(barAt)-600000).toISOString(),journalPath=join(home,'journal.json'),hashesPath=join(home,'role-hashes.json'),configPath=join(home,'config.json');
 writeFileSync(journalPath,JSON.stringify(await m.createSessionJournal(config,startedAt)),{flag:'wx',mode:0o600});writeFileSync(hashesPath,JSON.stringify({version:1,ownerDigest:sha(roles.owner),producerDigest:sha(roles.producer)}),{flag:'wx',mode:0o600});writeFileSync(configPath,JSON.stringify(config),{flag:'wx',mode:0o600});
 const r=await launch(journalPath,hashesPath),authorization={receiverOrigin:r.origin,sessionInstance:r.ready.sessionInstance,receiverStartedAt:r.ready.startedAt,receiverImplementation:r.ready.implementation,producerToken:roles.producer,suppliedSignalUseApproved:true};
 return {home,config,configPath,journalPath,hashesPath,barAt,startedAt,r,authorization};
}
const inputFor=(f,extra={})=>({version:1,kind:'SUPPLIED_SIGNAL',requestId:randomUUID(),symbol:'BTC/USD',timeframe:'5m',signal:{id:randomUUID(),provider:'CUSTOM',event:f.config.strategy.record.content.definition.market.direction==='LONG'?'BULLISH':'BEARISH',observedAt:f.barAt,availableAt:f.barAt},source:{kind:'AGENT_SUPPLIED',label:'INVENTED independent pipeline fixture',note:'A supplied declaration, never authenticated upstream execution.'},rights:{acknowledged:true,note:'INVENTED data used only in this local test.'},...extra});
const disk=path=>JSON.parse(readFileSync(path,'utf8'));
const journal=f=>m.reconstructSessionJournal(disk(f.journalPath));
const store=path=>new signals.SuppliedSignalStore(path);
async function supplied(f,command,path,input,receiverFetch){return signals.runSuppliedSignal({command,config:f.config,authorization:f.authorization,store:store(path),...(input?{signalText:typeof input==='string'?input:JSON.stringify(input)}:{}),...(receiverFetch?{receiverFetch}:{})});}
async function seedBar(f){await api(f,'/api/control',{event:{requestId:randomUUID(),type:'RESUME'}});return api(f,'/api/events',{role:'producer',event:{requestId:randomUUID(),type:'CLOSED_BAR',bar:{closedAt:f.barAt,open:100,high:101,low:99,close:100,volume:1}}});}
async function fixtureFeed(f,{price=100,bar=false,tag=randomUUID()}={}){
 const calls=[];const sourceFetch=async(url,options)=>{calls.push(url.pathname);assert.equal(url.origin,'https://api.kraken.com');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);const now=Date.now(),start=Date.parse(f.barAt)/1000;
  const row=at=>[at,'100','101','99','100','100','1',1];const raw=url.pathname.endsWith('/OHLC')?{error:[],result:{'BTC/USD':bar?[row(start-300),row(start)]:[row(start)],last:start}}:{error:[],result:{'BTC/USD':[[String(price),'1',(now-1)/1000,'b','m','',1]],last:String(now)+'000000'}};
  return new Response(JSON.stringify(raw),{headers:{'Content-Type':'application/json'}});
 };
 const authorization={...f.authorization,publicDataUseApproved:true,sharedIpRateBudgetApproved:true,pollMs:15000,cycles:1};delete authorization.suppliedSignalUseApproved;
 const state=await runProducer({command:'start',config:f.config,authorization,store:new ProducerStore(join(f.home,'market-'+tag+'.json')),sourceFetch});assert.deepEqual(calls,['/0/public/OHLC','/0/public/Trades']);assert.equal(state.sourceAuthentication,'UNKNOWN');return state;
}
async function cli(f,command,path,input,{authorization=f.authorization}={}){
 const args=['scripts/supplied-signal.mjs',command,f.configPath,path];if(input){const inputPath=join(f.home,'input-'+randomUUID()+'.json');writeFileSync(inputPath,typeof input==='string'?input:JSON.stringify(input),{flag:'wx',mode:0o600});args.push(inputPath);}
 const child=spawn(process.execPath,args,{cwd:process.cwd(),env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',value=>{stdout+=value;});child.stderr.on('data',value=>{stderr+=value;});child.stdin.end(JSON.stringify(authorization));const result=await deadline(new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal}))),20000);assert(!stdout.includes(roles.producer));assert(!stderr.includes(roles.producer));assert(!stdout.includes(roles.owner));return {...result,stdout,stderr};
}

before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-supplied-signal-pipeline-'));const compiled=await build({stdin:{contents:"export {syntheticSessionExample} from './app/session-example';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {createSessionJournal,appendSessionEvent,reconstructSessionJournal} from './app/session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});const file=join(directory,'fixed-fixtures.mjs');writeFileSync(file,compiled.outputFiles[0].text,{flag:'wx',mode:0o600});m=await import(pathToFileURL(file).href);signals=await import('../scripts/supplied-signal.mjs');
});
after(async()=>{for(const r of [...children])await stop(r);signals?.cleanupSuppliedSignalModules?.();cleanupProducerModules();if(directory)rmSync(directory,{recursive:true,force:true});});

for(const direction of ['LONG','SHORT'])test('actual '+direction+' supplied signal and synthetic Kraken bars/quotes retain causal entry, adverse stop and costs',{timeout:60000},async()=>{
 const f=await fixture(direction);try{
  assert.equal(f.r.ready.status,'PAUSED');await api(f,'/api/control',{event:{requestId:randomUUID(),type:'RESUME'}});await fixtureFeed(f,{bar:true,tag:'initial'});
  let saved=await journal(f);assert.equal(saved.state.bars.length,1);assert.equal(saved.state.pending,null);assert.equal(saved.state.openPositions.length,0);
  const input=inputFor(f),path=join(f.home,'signals.json'),state=await supplied(f,'start',path,input);assert.equal(state.entries.length,1);assert.equal(state.entries[0].confirmation.receipt.disposition,'ACCEPTED');assert.equal(state.entries[0].confirmation.receipt.reason,'SIGNAL_RECEIVED');
  saved=await journal(f);const decision=saved.state.events.find(event=>event.requestId===input.requestId);assert(saved.state.pending);assert.equal(saved.state.pending.signalId,input.signal.id);assert.equal(saved.state.openPositions.length,0);
  await api(f,'/api/events',{role:'producer',event:{requestId:randomUUID(),type:'QUOTE',observedAt:decision.receivedAt,price:100}});saved=await journal(f);assert.equal(saved.state.openPositions.length,0);assert(saved.state.pending);assert(saved.state.audit.some(row=>row.reason==='AWAITING_FRESH_QUOTE'));
  await observedAfter(decision.receivedAt);await fixtureFeed(f,{price:100,tag:'entry'});saved=await journal(f);assert.equal(saved.state.openPositions.length,1);assert.equal(saved.state.trades.length,0,'A finite supplied/market invocation does not liquidate.');const position=saved.state.openPositions[0];assert.equal(position.direction,direction);assert.equal(position.signalId,input.signal.id);assert(position.entryAt>decision.receivedAt);assert(position.entryObservedAt>decision.receivedAt);assert.equal(position.entryPrice,direction==='LONG'?100*1.0037:100*.9963);assert(position.entryFee>0);
  await observedAfter(saved.state.lastReceivedAt);await fixtureFeed(f,{price:direction==='LONG'?90:110,tag:'adverse'});saved=await journal(f);assert.equal(saved.state.openPositions.length,0);assert.equal(saved.state.trades.length,1);const trade=saved.state.trades[0];assert.equal(trade.reason,'STOP_LOSS');assert.equal(trade.direction,direction);assert(trade.netPnl<0);assert(trade.entryFee>0);assert(trade.exitFee>0);assert.equal(trade.exitPrice,direction==='LONG'?90*.9963:110*1.0037);assert.equal(trade.netPnl,trade.grossPnl-trade.entryFee-trade.exitFee);assert(saved.state.account.equity<1000);assert.equal(saved.state.qualification,'NONE');assert.equal(saved.ordersEnabled,false);assert.equal(saved.config.liveEnabled,false);
  assert.equal(saved.events.filter(row=>row.event.requestId===input.requestId).length,1);assert.deepEqual(await api(f,'/api/journal'),saved);assert.equal(statSync(path).mode&0o777,0o600);for(const token of Object.values(roles)){assert(!readFileSync(path,'utf8').includes(token));assert(!f.r.stdout.includes(token));assert(!f.r.stderr.includes(token));}
 }finally{assert.equal((await stop(f.r)).code,0);}
});

for(const committed of [false,true])test('unknown '+(committed?'committed':'uncommitted')+' signal acknowledgment blocks new input and resumes only the original event',{timeout:45000},async()=>{
 const f=await fixture();try{
  await seedBar(f);const input=inputFor(f),path=join(f.home,'uncertain.json'),calls=[];
  const receiverFetch=async(url,options)=>{assert.equal(url.origin,f.r.origin);calls.push({path:url.pathname,method:options.method??'GET',body:options.body??null});if(options.method==='POST'){if(committed){const response=await fetch(url,options);assert.equal(response.status,200);await response.body.cancel();}throw Error('INVENTED acknowledgment loss');}return fetch(url,options);};
  await assert.rejects(supplied(f,'start',path,input,receiverFetch));let retained=disk(path),saved=await journal(f);assert.equal(retained.status,'UNCERTAIN');assert.equal(retained.entries.length,1);const original=structuredClone(retained.entries[0]);assert.equal(original.status,'PENDING');assert.equal(saved.events.filter(row=>row.event.requestId===input.requestId).length,committed?1:0);
  const before=readFileSync(path),callCount=calls.length;await assert.rejects(supplied(f,'submit',path,inputFor(f),receiverFetch));assert.equal(calls.length,callCount);assert.deepEqual(readFileSync(path),before);
  const recoverCalls=[];const recovering=async(url,options)=>{assert.equal(url.origin,f.r.origin);recoverCalls.push({path:url.pathname,method:options.method??'GET',body:options.body??null});return fetch(url,options);};
  retained=await supplied(f,'resume',path,null,recovering);assert.equal(retained.entries.length,1);assert.equal(retained.entries[0].status,'CONFIRMED');assert.deepEqual(retained.entries[0].event,original.event);assert.equal(retained.entries[0].inputByteDigest,original.inputByteDigest);assert.equal(retained.entries[0].inputBytes,original.inputBytes);assert.equal(retained.entries[0].attempts.length,2);assert.equal(recoverCalls[0].path,'/api/receipts/'+input.requestId);assert.deepEqual(recoverCalls.map(call=>call.method),committed?['GET']:['GET','POST']);if(!committed)assert.equal(recoverCalls[1].body,JSON.stringify(original.event));
  saved=await journal(f);assert.equal(saved.events.filter(row=>row.event.requestId===input.requestId).length,1);assert.equal(saved.state.openPositions.length,0);assert(saved.state.pending);assert.equal(saved.state.status,'ACTIVE');
 }finally{assert.equal((await stop(f.r)).code,0);}
});

test('bad supplied context refuses before delivery, while future and missing-bar rejection receipts remain durable',{timeout:60000},async()=>{
 const f=await fixture();try{
  await seedBar(f);const original=inputFor(f);let requests=0;const counted=async(url,options)=>{requests++;return fetch(url,options);};
  const cases=[value=>{value.symbol='ETH/USD';},value=>{value.timeframe='1h';},value=>{value.signal.provider='ALTFINS';},value=>{value.signal.event='BEARISH';},value=>{value.source.kind='REMOTE_WEBHOOK';},value=>{value.source.url='https://example.com/untrusted';},value=>{value.signal.observedAt=new Date(Date.parse(f.barAt)+1).toISOString();value.signal.availableAt=value.signal.observedAt;},value=>{value.signal.availableAt=new Date(Date.parse(f.barAt)-1).toISOString();},value=>{value.signal.observedAt=f.barAt.replace('.000Z','Z');}];
  for(const mutate of cases){const value=structuredClone(original);mutate(value);const before=readFileSync(f.journalPath);await assert.rejects(supplied(f,'start',join(f.home,randomUUID()+'.json'),value,counted));assert.equal(requests,0);assert.deepEqual(readFileSync(f.journalPath),before);}
  for(const failure of ['UNKNOWN_SIGNAL_BAR','FUTURE_INPUT']){const value=inputFor(f);if(failure==='UNKNOWN_SIGNAL_BAR'){value.signal.observedAt=new Date(Date.parse(f.barAt)-300000).toISOString();value.signal.availableAt=value.signal.observedAt;}else value.signal.availableAt=new Date(Date.now()+60000).toISOString();const path=join(f.home,failure+'.json');await assert.rejects(supplied(f,'start',path,value,counted));const retained=disk(path);assert.equal(retained.status,'FAILED');assert.equal(retained.entries[0].status,'CONFIRMED');assert.equal(retained.entries[0].confirmation.receipt.disposition,'REJECTED');assert.equal(retained.entries[0].confirmation.receipt.reason,failure);const before=readFileSync(path),count=requests;await assert.rejects(supplied(f,'submit',path,inputFor(f),counted));assert.equal(requests,count);assert.deepEqual(readFileSync(path),before);const saved=await journal(f);assert.equal(saved.events.filter(row=>row.event.requestId===value.requestId).length,1);assert(saved.state.audit.some(row=>row.reason===failure));assert.equal(saved.state.openPositions.length,0);}
 }finally{assert.equal((await stop(f.r)).code,0);}
});

test('real CLI stays paused, keeps exact duplicate evidence, and concurrent starts cannot replace its audit',{timeout:60000},async()=>{
 const f=await fixture();try{
  // A supplied signal may be retained while the owner has paused admissions.
  await api(f,'/api/events',{role:'producer',event:{requestId:randomUUID(),type:'CLOSED_BAR',bar:{closedAt:f.barAt,open:100,high:101,low:99,close:100,volume:1}}});const input=inputFor(f),path=join(f.home,'cli.json');const first=await cli(f,'start',path,input);assert.equal(first.code,0,first.stderr);const bytes=readFileSync(path),retained=disk(path);assert.equal(retained.entries[0].confirmation.receipt.disposition,'ACCEPTED');let saved=await journal(f);assert.equal(saved.state.status,'PAUSED');assert.equal(saved.state.pending,null);assert.equal(saved.state.openPositions.length,0);assert(saved.state.audit.every(row=>row.reason!=='RESUMED'));
  const duplicate=await cli(f,'submit',path,JSON.stringify(input,null,2));assert.equal(duplicate.code,0,duplicate.stderr);assert.deepEqual(readFileSync(path),bytes);assert.equal((await journal(f)).events.filter(row=>row.event.requestId===input.requestId).length,1);
  const changed=structuredClone(input);changed.source.note='Changed declaration cannot adopt the earlier receipt.';const conflict=await cli(f,'submit',path,changed);assert.notEqual(conflict.code,0);assert.deepEqual(readFileSync(path),bytes);
  const malformed=await cli(f,'submit',path,'{"version":1,"version":1,"kind":"SUPPLIED_SIGNAL"}');assert.notEqual(malformed.code,0);assert.deepEqual(readFileSync(path),bytes);assert(!malformed.stderr.includes('"version"'));
  const simultaneous=join(f.home,'concurrent.json'),another=inputFor(f);another.signal.observedAt=new Date(Date.parse(f.barAt)-300000).toISOString();another.signal.availableAt=another.signal.observedAt;const results=await Promise.all([cli(f,'start',simultaneous,another),cli(f,'start',simultaneous,another)]);assert(results.some(result=>result.code!==0));const final=disk(simultaneous);assert.equal(final.entries.length,1);assert.equal(final.entries[0].event.requestId,another.requestId);saved=await journal(f);assert.equal(saved.events.filter(row=>row.event.requestId===another.requestId).length,1);assert.equal(saved.state.status,'PAUSED');assert.equal(statSync(simultaneous).mode&0o777,0o600);
 }finally{assert.equal((await stop(f.r)).code,0);}
});

test('owner emergency and original recovery preserve open inventory; producer never sends a control',{timeout:60000},async()=>{
 const f=await fixture();try{
  await seedBar(f);const input=inputFor(f),path=join(f.home,'owner-lifecycle.json');await supplied(f,'start',path,input);let saved=await journal(f);await observedAfter(saved.state.lastReceivedAt);await api(f,'/api/events',{role:'producer',event:{requestId:randomUUID(),type:'QUOTE',observedAt:new Date().toISOString(),price:100}});saved=await journal(f);assert.equal(saved.state.openPositions.length,1);
  const halt=await api(f,'/api/control',{event:{requestId:randomUUID(),type:'EMERGENCY'}});saved=await journal(f);assert.equal(saved.state.status,'STOPPING');assert.equal(saved.state.openPositions.length,1);const port=new URL(f.r.origin).port,instance=f.r.ready.sessionInstance;assert.equal((await stop(f.r)).code,0);f.r=await launch(f.journalPath,f.hashesPath,port);assert.equal(f.r.ready.sessionInstance,instance);assert.equal(f.r.ready.status,'STOPPING');assert.equal(f.r.origin,f.authorization.receiverOrigin);
  const calls=[];const counted=async(url,options)=>{calls.push({path:url.pathname,method:options.method??'GET'});return fetch(url,options);};await supplied(f,'resume',path,null,counted);assert(calls.every(call=>call.method==='GET'&&call.path.startsWith('/api/receipts/')));saved=await journal(f);assert.equal(saved.state.status,'STOPPING');assert.equal(saved.state.openPositions.length,1);assert.equal(saved.state.trades.length,0);
  const at=await observedAfter(halt.receipt.receivedAt);await api(f,'/api/events',{role:'producer',event:{requestId:randomUUID(),type:'QUOTE',observedAt:at,price:90}});saved=await journal(f);assert.equal(saved.state.status,'STOPPED');assert.equal(saved.state.openPositions.length,0);assert.equal(saved.state.trades[0].reason,'EMERGENCY_STOP');assert(saved.state.trades[0].netPnl<0);assert(saved.state.trades[0].entryFee>0&&saved.state.trades[0].exitFee>0);assert.equal(saved.state.qualification,'NONE');
 }finally{assert.equal((await stop(f.r)).code,0);}
});

test('a replaced same-ID receiver history cannot adopt an original uncertain signal',{timeout:60000},async()=>{
 const f=await fixture();try{
  await seedBar(f);const input=inputFor(f),path=join(f.home,'original-outbox.json');await assert.rejects(supplied(f,'start',path,input,async()=>{throw Error('INVENTED pre-delivery disconnect');}));const before=readFileSync(path),originalJournal=readFileSync(f.journalPath),port=new URL(f.r.origin).port,instance=f.r.ready.sessionInstance;assert.equal((await stop(f.r)).code,0);
  const replacementPath=join(f.home,'replacement-history.json');writeFileSync(replacementPath,JSON.stringify(await m.createSessionJournal(f.config,new Date(Date.parse(f.startedAt)+1).toISOString())),{flag:'wx',mode:0o600});f.r=await launch(replacementPath,f.hashesPath,port);assert.equal(f.r.ready.sessionId,f.config.sessionId);assert.notEqual(f.r.ready.sessionInstance,instance);assert.equal(f.r.origin,f.authorization.receiverOrigin);
  const calls=[];const counted=async(url,options)=>{calls.push({path:url.pathname,method:options.method??'GET'});return fetch(url,options);};await assert.rejects(supplied(f,'resume',path,null,counted));assert(calls.every(call=>call.method==='GET'));const retained=disk(path);assert.deepEqual(retained.entries[0].event,diskBuffer(before).entries[0].event);assert.equal(retained.entries[0].status,'PENDING');assert.equal(disk(replacementPath).events.filter(row=>row.event.requestId===input.requestId).length,0);assert.deepEqual(readFileSync(f.journalPath),originalJournal);
  const replacementAuthorization={...f.authorization,sessionInstance:f.r.ready.sessionInstance,receiverStartedAt:f.r.ready.startedAt};let requested=0;await assert.rejects(signals.runSuppliedSignal({command:'resume',config:f.config,authorization:replacementAuthorization,store:store(path),receiverFetch:async()=>{requested++;throw Error('Must not contact replacement.');}}));assert.equal(requested,0);assert.equal(retained.entries[0].inputByteDigest,disk(path).entries[0].inputByteDigest);
 }finally{assert.equal((await stop(f.r)).code,0);}
});

test('previously confirmed receipt loss under the same history preimage never authorizes reinsertion',{timeout:60000},async()=>{
 const f=await fixture();try{
  await seedBar(f);const input=inputFor(f),path=join(f.home,'confirmed-outbox.json');await supplied(f,'start',path,input);const retained=disk(path),originalBytes=readFileSync(f.journalPath),original=JSON.parse(originalBytes),instance=f.r.ready.sessionInstance,port=new URL(f.r.origin).port;assert.equal(retained.entries[0].status,'CONFIRMED');assert.equal((await stop(f.r)).code,0);
  // An explicitly fabricated local replacement has the same instance preimage
  // but omits the confirmed signal. The original journal remains untouched.
  let replacement=await m.createSessionJournal(f.config,f.startedAt);for(const row of original.events.filter(row=>row.event.requestId!==input.requestId))replacement=await m.appendSessionEvent(replacement,row.event,row.receivedAt);
  const replacementPath=join(f.home,'missing-confirmed-receipt.json');writeFileSync(replacementPath,JSON.stringify(replacement),{flag:'wx',mode:0o600});f.r=await launch(replacementPath,f.hashesPath,port);assert.equal(f.r.ready.sessionInstance,instance);const calls=[];const counted=async(url,options)=>{calls.push({path:url.pathname,method:options.method??'GET'});return fetch(url,options);};
  await assert.rejects(supplied(f,'resume',path,null,counted));assert.deepEqual(calls.map(call=>call.method),['GET']);const failed=disk(path);assert.equal(failed.status,'FAILED');assert.equal(failed.reason,'CONFIRMED_RECEIPT_MISSING');assert.deepEqual(failed.entries,retained.entries);assert.equal(disk(replacementPath).events.filter(row=>row.event.requestId===input.requestId).length,0);assert.deepEqual(readFileSync(f.journalPath),originalBytes);
 }finally{assert.equal((await stop(f.r)).code,0);}
});
const diskBuffer=bytes=>JSON.parse(bytes.toString('utf8'));
