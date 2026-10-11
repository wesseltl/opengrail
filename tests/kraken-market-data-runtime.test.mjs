import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {runProducer,ProducerStore,validateProducerState,cleanupProducerModules} from '../scripts/kraken-market-data.mjs';

let directory,m,runner;
const sha=v=>createHash('sha256').update(v).digest('hex');
const roles={owner:'og_local_owner_'+sha('INVENTED read-only-feed runtime owner'),producer:'og_local_producer_'+sha('INVENTED read-only-feed runtime producer')};
before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-feed-runtime-'));const bundle=await build({stdin:{contents:"export {syntheticSessionExample} from './app/session-example';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {createSessionJournal,reconstructSessionJournal} from './app/session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});const path=join(directory,'fixed-fixture.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx',mode:0o600});m=await import(pathToFileURL(path).href);
});
after(async()=>{if(runner?.child.exitCode===null){runner.child.kill('SIGKILL');await runner.closed;}cleanupProducerModules();rmSync(directory,{recursive:true,force:true});});
function deadline(promise,milliseconds){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Local runtime timeout.')),milliseconds);})]).finally(()=>clearTimeout(timer));}
async function launch(journal,hashes){
 const child=spawn(process.execPath,['scripts/session-receiver.mjs','resume',journal,hashes],{cwd:process.cwd(),env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));child.stdout.on('data',v=>{stdout+=v;});child.stderr.on('data',v=>{stderr+=v;});
 runner={child,closed,get stdout(){return stdout;},get stderr(){return stderr;}};
 const ready=await deadline(new Promise((resolve,reject)=>{const inspect=()=>{if(stdout.length>8192)return reject(Error('Bounded receiver diagnostics exceeded.'));for(const line of stdout.split('\n').slice(0,-1)){let value;try{value=JSON.parse(line);}catch{continue;}if(value.type==='READY'){child.stdout.off('data',inspect);return resolve(value);}}};child.stdout.on('data',inspect);child.once('error',()=>reject(Error('Receiver could not launch.')));child.once('exit',()=>reject(Error('Receiver ended before readiness.')));inspect();}),20000);
 return {ready,origin:new URL(ready.url).origin};
}
test('sampled synthetic provider input reaches the actual receiver causally, reconciles a lost ACK and preserves a negative exit',async()=>{
 // Invented provider envelopes and an explicitly invented past-start history;
 // this is a local transport check, not authentic forward trading evidence.
 const config=structuredClone((await m.syntheticSessionExample()).config);config.sessionId=randomUUID();config.clockMode='SYSTEM_RECEIPT';config.origin='PUBLIC_STRATEGY';config.provenance='USER_SUPPLIED';config.rights={permission:'AUTHORIZED_USE',acknowledged:true,note:'INVENTED synthetic provider envelopes; no real Kraken endpoint or license established.'};config.sourceLabel='INVENTED Kraken-shaped feed';config.strategy.record.content.definition=m.strategyTemplate('DCA');Object.assign(config.strategy.record.content.definition.market,{symbol:'BTC/USD',timeframe:'5m'});config.strategy.record.content.definition.entry={type:'DCA',intervalBars:1,maxEntries:1};Object.assign(config.strategy.record.content.definition.costs,{feeBps:23,slippageBps:37});config.strategy.digest=await m.strategyDigest(JSON.stringify(config.strategy.record));
 const journalPath=join(directory,'session.json'),hashesPath=join(directory,'hashes.json'),feedPath=join(directory,'feed.json'),startedAt=new Date(Math.floor(Date.now()/300000)*300000-600000).toISOString();writeFileSync(journalPath,JSON.stringify(await m.createSessionJournal(config,startedAt)),{flag:'wx',mode:0o600});writeFileSync(hashesPath,JSON.stringify({version:1,producerDigest:sha(roles.producer),ownerDigest:sha(roles.owner)}),{flag:'wx',mode:0o600});
 const local=await launch(journalPath,hashesPath),headers={'Authorization':'Bearer '+roles.owner,'X-Session-Id':local.ready.sessionId,'X-Session-Instance':local.ready.sessionInstance,'Content-Type':'application/json'};
 async function owner(event){const response=await fetch(new URL('/api/control',local.origin),{method:'POST',headers,body:JSON.stringify(event)});assert.equal(response.status,200);return response.json();}
 assert.equal(local.ready.startedAt,startedAt);assert.deepEqual(local.ready.implementation,JSON.parse(readFileSync(journalPath,'utf8')).implementation);assert.equal(local.ready.status,'PAUSED');await owner({requestId:randomUUID(),type:'RESUME'});
 const authorization={receiverOrigin:local.origin,sessionInstance:local.ready.sessionInstance,receiverStartedAt:local.ready.startedAt,receiverImplementation:local.ready.implementation,producerToken:roles.producer,publicDataUseApproved:true,sharedIpRateBudgetApproved:true,pollMs:15000,cycles:2};let sourceCalls=0,lost=false;
 const sourceFetch=async(url,options)=>{sourceCalls++;assert.equal(url.origin,'https://api.kraken.com');assert.equal(options.headers,undefined);assert.equal(options.redirect,'error');const now=Date.now(),start=Math.floor(now/300000)*300;const raw=url.pathname.endsWith('/OHLC')?{error:[],result:{'BTC/USD':[[start-300,'100','101','99','100','100','1',1],[start,'100','101','99','100','100','1',1]],last:start}}:{error:[],result:{'BTC/USD':[['100','1',(now-1)/1000,'b','m','',sourceCalls]],last:String(now)+'000000'}};return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});};
 const receiverFetch=async(url,options)=>{assert.equal(url.origin,local.origin);const response=await fetch(url,options);if(options.method==='POST'&&!lost&&JSON.parse(options.body).type==='QUOTE'){lost=true;await response.body.cancel();throw Error('INVENTED committed acknowledgment loss');}return response;};
 const argumentsFor=command=>({command,config,authorization,store:new ProducerStore(feedPath),sourceFetch,receiverFetch});
 try{
  await assert.rejects(runProducer(argumentsFor('start')));let feed=JSON.parse(readFileSync(feedPath,'utf8')),journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(journalPath,'utf8')));const original=feed.entries.find(v=>v.event.type==='QUOTE');assert(original);assert.equal(feed.status,'UNCERTAIN');assert.equal(journal.state.openPositions.length,0);assert(journal.state.pending);assert.equal(journal.events.filter(v=>v.event.requestId===original.event.requestId).length,1);
  feed=await runProducer(argumentsFor('resume'));assert.equal(sourceCalls,4);assert.equal(feed.status,'COMPLETED');assert.equal(feed.entries.find(v=>v.event.requestId===original.event.requestId).attempts.length,2);await validateProducerState(feed,config,authorization);
  journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(journalPath,'utf8')));assert.equal(journal.events.filter(v=>v.event.requestId===original.event.requestId).length,1);assert.equal(journal.state.openPositions.length,1,'Only a later genuinely timestamped fixture quote can fill.');assert.equal(journal.state.trades.length,0,'Finite producer completion does not liquidate.');const position=journal.state.openPositions[0],barReceipt=journal.state.events.find(v=>v.requestId===feed.entries.find(e=>e.event.type==='CLOSED_BAR').event.requestId);assert(position.entryAt>barReceipt.receivedAt);assert(position.entryObservedAt>barReceipt.receivedAt);
  const emergency=await owner({requestId:randomUUID(),type:'EMERGENCY'});journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(journalPath,'utf8')));assert.equal(journal.state.status,'STOPPING');assert.equal(journal.state.openPositions.length,1);
  await delay(5);const quote={requestId:randomUUID(),type:'QUOTE',observedAt:new Date().toISOString(),price:90},response=await fetch(new URL('/api/events',local.origin),{method:'POST',headers:{...headers,Authorization:'Bearer '+roles.producer},body:JSON.stringify(quote)});assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.receipt.disposition,'ACCEPTED');assert(quote.observedAt>emergency.receipt.receivedAt);
  journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(journalPath,'utf8')));assert.equal(journal.state.openPositions.length,0);assert.equal(journal.state.trades.length,1);assert(journal.state.trades[0].netPnl<0);assert.equal(journal.state.trades[0].reason,'EMERGENCY_STOP');assert(journal.state.account.totalFees>0);assert.equal(journal.state.qualification,'NONE');assert.equal(journal.ordersEnabled,false);assert(!readFileSync(feedPath,'utf8').includes(roles.producer));assert(!runner.stdout.includes(roles.owner));assert(!runner.stderr.includes(roles.producer));
 }finally{runner.child.kill('SIGTERM');const stopped=await deadline(runner.closed,10000);assert.equal(stopped.code,0);}
});
