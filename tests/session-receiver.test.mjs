import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,statSync,symlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {request} from 'node:http';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';

let directory,m,config,credentialFile,tokens,serial=0;
const children=new Set();
before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-receiver-http-'));
 const bundle=await build({stdin:{contents:"export {syntheticSessionExample} from './app/session-example';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {createSessionJournal,reconstructSessionJournal} from './app/session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 const path=join(directory,'trusted-fixture.mjs');writeFileSync(path,bundle.outputFiles[0].text);m=await import(pathToFileURL(path).href);
 config=(await m.syntheticSessionExample()).config;config.clockMode='SYSTEM_RECEIPT';config.strategy.record.content.definition=m.strategyTemplate('SIGNAL');config.strategy.record.content.definition.entry={type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:3};config.strategy.digest=await m.strategyDigest(JSON.stringify(config.strategy.record));
 credentialFile=join(directory,'local-hashes.json');const result=call(['credentials',credentialFile]);assert.equal(result.status,0,'Explicit local credential generation must succeed.');tokens=JSON.parse(result.stdout.trim());
});
after(()=>{for(const child of children)child.kill('SIGKILL');rmSync(directory,{recursive:true,force:true});});
const call=args=>spawnSync(process.execPath,['scripts/session-receiver.mjs',...args],{cwd:process.cwd(),encoding:'utf8',timeout:20000,maxBuffer:32768});
function files(){const prefix=join(directory,'case-'+(++serial)),cfg=prefix+'-config.json',journal=prefix+'-journal.json';writeFileSync(cfg,JSON.stringify({...config,sessionId:randomUUID()}));return {cfg,journal};}
async function receiver(args,imports=[]){
 const child=spawn(process.execPath,[...imports.flatMap(path=>['--import',path]),'scripts/session-receiver.mjs',...args],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});children.add(child);let stdout='',stderr='';
 child.stdout.on('data',part=>stdout+=part);child.stderr.on('data',part=>stderr+=part);
 const closed=new Promise(resolve=>child.on('close',(code,signal)=>{children.delete(child);resolve({code,signal,stdout,stderr});}));
 const ready=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(Error('Loopback receiver did not become ready.')),15000);
  const inspect=()=>{for(const line of stdout.split('\n').slice(0,-1)){let value;try{value=JSON.parse(line);}catch{continue;}if(value.type==='READY')return finish(null,value);}};
  const ended=()=>finish(Error('Receiver ended before a confirmed READY.'));
  const finish=(error,value)=>{clearTimeout(timer);child.stdout.off('data',inspect);child.off('exit',ended);error?reject(error):resolve(value);};
  child.stdout.on('data',inspect);child.on('exit',ended);inspect();
 });
 const url=new URL(ready.url??ready.localUrl??('http://127.0.0.1:'+ready.port));assert.equal(url.hostname,'127.0.0.1');
 return {child,closed,ready,url,get stdout(){return stdout;},get stderr(){return stderr;},async stop(){child.kill('SIGTERM');return Promise.race([closed,delay(10000).then(()=>{throw Error('Receiver did not stop.');})]);}};
}
async function api(r,path,{token=tokens.ownerToken,method='GET',body,raw,headers={}}={}){
 const response=await fetch(new URL(path,r.url),{method,headers:{'X-Session-Id':r.ready.sessionId,'X-Session-Instance':r.ready.sessionInstance,...(token?{Authorization:'Bearer '+token}:{}),...(body||raw?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body?JSON.stringify(body):undefined)});
 let value=null;try{value=await response.json();}catch{}return {status:response.status,value,headers:response.headers};
}
const event=(type,data={})=>({requestId:randomUUID(),type,...data});
async function seeded(){
 const f=files(),cfg=JSON.parse(readFileSync(f.cfg,'utf8')),startedAt=new Date(Date.now()-2*3600000).toISOString();
 const journal=await m.createSessionJournal(cfg,startedAt);writeFileSync(f.journal,JSON.stringify(journal),{mode:0o600});
 const r=await receiver(['resume',f.journal,credentialFile]);return {...f,r};
}
async function enter(r){
 let result=await api(r,'/api/control',{method:'POST',body:event('RESUME')});assert.equal(result.status,200);
 const step=3600000,closedAt=new Date(Math.floor(Date.now()/step)*step).toISOString();
 result=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:event('CLOSED_BAR',{bar:{closedAt,open:100,high:101,low:99,close:100,volume:1}})});assert.equal(result.status,200);
 const signal=event('SIGNAL',{signal:{id:randomUUID(),provider:'CUSTOM',event:'BULLISH',observedAt:closedAt,availableAt:new Date().toISOString()}});
 result=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:signal});assert.equal(result.status,200);const decisionAt=result.value.receipt.receivedAt;
 const early=event('QUOTE',{observedAt:decisionAt,price:100});result=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:early});assert.equal(result.status,200);
 await delay(3);const quote=event('QUOTE',{observedAt:new Date().toISOString(),price:100});
 result=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:quote});assert.equal(result.status,200);return {signal,quote,early,decisionAt};
}

test('operator generation prints each role once and persists only distinct hashes; existing output is never replaced',()=>{
 const disk=readFileSync(credentialFile,'utf8');assert(!disk.includes(tokens.ownerToken));assert(!disk.includes(tokens.producerToken));assert.match(tokens.ownerToken,/^og_local_owner_[a-f0-9]{64}$/);assert.match(tokens.producerToken,/^og_local_producer_[a-f0-9]{64}$/);
 assert.equal(statSync(credentialFile).mode&0o777,0o600);const parsed=JSON.parse(disk);assert.notEqual(parsed.ownerDigest,parsed.producerDigest);assert.deepEqual(Object.keys(parsed).sort(),['ownerDigest','producerDigest','version']);
 const repeat=call(['credentials',credentialFile]);assert.equal(repeat.status,1);assert.equal(repeat.stdout,'');assert.equal(readFileSync(credentialFile,'utf8'),disk);
});
test('actual loopback start serves fixed monitor assets but withholds state without owner authentication',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  assert(existsSync(f.journal));assert.equal(r.ready.ordersEnabled,false);
  assert.equal((await api(r,'/api/state',{token:null})).status,401);assert.equal((await api(r,'/api/state',{token:tokens.producerToken})).status,403);
  const response=await fetch(r.url);assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);assert.equal(response.headers.get('cache-control'),'no-store');
  const html=await response.text();assert(!html.includes(tokens.ownerToken));assert(!html.includes(tokens.producerToken));assert.match(html,/monitor\.js/);
  assert.equal((await fetch(new URL('/monitor.js',r.url))).status,200);assert.equal((await fetch(new URL('/monitor.css',r.url))).status,200);
  const state=await api(r,'/api/state');assert.equal(state.status,200);assert(!JSON.stringify(state.value).includes(tokens.ownerToken));
 }finally{await r.stop();}
});
test('actual HTTP signal, later quote and stop loss are durable, causal and fully reconstructible',async()=>{
 const {r,journal}=await seeded();try{
  const {decisionAt,early}=await enter(r);let saved=await m.reconstructSessionJournal(JSON.parse(readFileSync(journal,'utf8')));assert.equal(saved.state.openPositions.length,1);assert.equal(saved.state.trades.length,0);
  assert(saved.state.openPositions[0].entryObservedAt>decisionAt);assert(saved.state.openPositions[0].entryAt>decisionAt);
  const earlyIndex=saved.events.findIndex(v=>v.event.requestId===early.requestId);assert(earlyIndex>=0);assert(saved.state.audit.some(v=>v.sequence===earlyIndex+1&&v.reason==='AWAITING_FRESH_QUOTE'));
  const ownerState=await api(r,'/api/state');assert.equal(ownerState.status,200);
  await delay(3);const close=event('QUOTE',{observedAt:new Date().toISOString(),price:90});const exit=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:close});assert.equal(exit.status,200);
  saved=await m.reconstructSessionJournal(JSON.parse(readFileSync(journal,'utf8')));assert.equal(saved.state.openPositions.length,0);assert.equal(saved.state.trades.length,1);assert.equal(saved.state.trades[0].reason,'STOP_LOSS');assert(saved.state.trades[0].netPnl<0);
  assert.equal(exit.value.journalDigest,saved.journalDigest);assert.equal(exit.value.stateDigest,saved.state.stateDigest);assert.equal(exit.value.receipt.receivedAt,saved.state.events.at(-1).receivedAt);assert.equal(exit.value.ordersEnabled,false);
 }finally{await r.stop();}
});
test('original receipts reconcile identical retries, while changed UUID bodies conflict and control authority stays separate',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  const e=event('QUOTE',{observedAt:new Date().toISOString(),price:100}),first=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:e});assert.equal(first.status,200);
  await delay(3);const retry=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:e});assert.equal(retry.status,200);assert.equal(retry.value.duplicate,true);assert.deepEqual(retry.value.receipt,first.value.receipt);
  const lookup=await api(r,'/api/receipts/'+e.requestId,{token:tokens.producerToken});assert.equal(lookup.status,200);assert.deepEqual(lookup.value.receipt,first.value.receipt);
  assert.equal((await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:{...e,price:101}})).status,409);
  assert.equal((await api(r,'/api/control',{token:tokens.producerToken,method:'POST',body:event('EMERGENCY')})).status,403);
  assert.equal((await api(r,'/api/events',{token:tokens.ownerToken,method:'POST',body:event('QUOTE',{observedAt:new Date().toISOString(),price:100})})).status,403);
  const pause=event('PAUSE');assert.equal((await api(r,'/api/control',{method:'POST',body:pause})).status,200);
  assert.equal((await api(r,'/api/receipts/'+pause.requestId,{token:tokens.producerToken})).status,404);assert.equal((await api(r,'/api/receipts/'+pause.requestId)).status,200);
  assert.equal(JSON.parse(readFileSync(f.journal,'utf8')).events.length,2);
 }finally{await r.stop();}
});
test('foreign origin, rebinding Host, public credentials, repeated JSON keys and oversized bodies never enter the journal',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  assert.equal((await api(r,'/api/state',{headers:{Origin:'https://foreign.invalid'}})).status,403);
  const foreignHost=await new Promise((resolve,reject)=>{const req=request(new URL('/api/state',r.url),{headers:{Host:'foreign.invalid',Authorization:'Bearer '+tokens.ownerToken}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});assert.equal(foreignHost,403);
  assert.equal((await api(r,'/api/state',{token:'og_agent_'+'a'.repeat(64)})).status,401);
  const id=randomUUID();assert.equal((await api(r,'/api/events',{token:tokens.producerToken,method:'POST',raw:'{"requestId":"'+id+'","type":"QUOTE","price":100,"price":101,"observedAt":"'+new Date().toISOString()+'"}'})).status,400);
  assert.equal((await api(r,'/api/events',{token:tokens.producerToken,method:'POST',raw:'x'.repeat(4097)})).status,413);
  assert.equal((await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:{...event('QUOTE',{observedAt:new Date().toISOString(),price:100}),receivedAt:new Date().toISOString()}})).status,400);
  assert.equal(JSON.parse(readFileSync(f.journal,'utf8')).events.length,0);
  assert(!r.stdout.includes(tokens.ownerToken));assert(!r.stderr.includes(tokens.producerToken));
 }finally{await r.stop();}
});
test('concurrent actual producers serialize admitted events without a forked receipt or duplicate fill',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  const quotes=Array.from({length:5},()=>event('QUOTE',{observedAt:new Date().toISOString(),price:100}));
  const responses=await Promise.all(quotes.map(body=>api(r,'/api/events',{token:tokens.producerToken,method:'POST',body})));assert(responses.every(x=>x.status===200));
  const sequences=responses.map(x=>x.value.receipt.sequence).sort((a,b)=>a-b);assert.deepEqual(sequences,[1,2,3,4,5]);
  const saved=await m.reconstructSessionJournal(JSON.parse(readFileSync(f.journal,'utf8')));assert.equal(saved.events.length,5);assert.equal(new Set(saved.events.map(v=>v.event.requestId)).size,5);
 }finally{await r.stop();}
});
test('emergency remains pending without a fresh quote; restart retains positions and confirms paused admissions',async()=>{
 const f=await seeded();let r=f.r;try{
  await enter(r);assert.equal((await api(r,'/api/control',{method:'POST',body:event('EMERGENCY')})).status,200);
  let saved=JSON.parse(readFileSync(f.journal,'utf8'));assert.equal(saved.state.status,'STOPPING');assert.equal(saved.state.openPositions.length,1);
  await r.stop();r=await receiver(['resume',f.journal,credentialFile]);saved=JSON.parse(readFileSync(f.journal,'utf8'));assert.equal(saved.state.status,'STOPPING');assert.equal(saved.state.openPositions.length,1);
  await delay(3);assert.equal((await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:event('QUOTE',{observedAt:new Date().toISOString(),price:100})})).status,200);
  saved=await m.reconstructSessionJournal(JSON.parse(readFileSync(f.journal,'utf8')));assert.equal(saved.state.status,'STOPPED');assert.equal(saved.state.openPositions.length,0);assert.equal(saved.state.trades[0].reason,'EMERGENCY_STOP');
 }finally{await r.stop();}
 const other=await seeded();try{assert.equal(other.r.ready.status,'PAUSED');assert.equal(other.r.ready.requiresExplicitResume,true);}finally{await other.r.stop();}
});
test('an abandoned response can be reconciled by exact authenticated receipt without admitting a second event',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  const e=event('QUOTE',{observedAt:new Date().toISOString(),price:100});
  await new Promise((resolve,reject)=>{const req=request(new URL('/api/events',r.url),{method:'POST',headers:{Authorization:'Bearer '+tokens.producerToken,'Content-Type':'application/json','X-Session-Id':r.ready.sessionId,'X-Session-Instance':r.ready.sessionInstance}},response=>{response.destroy();resolve();});req.on('error',reject);req.end(JSON.stringify(e));});
  const found=await api(r,'/api/receipts/'+e.requestId,{token:tokens.producerToken});assert.equal(found.status,200);assert.equal(found.value.receipt.requestId,e.requestId);
  const retry=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:e});assert.equal(retry.status,200);assert.equal(retry.value.duplicate,true);assert.equal(JSON.parse(readFileSync(f.journal,'utf8')).events.length,1);
 }finally{await r.stop();}
});
test('external journal changes cannot produce a confirmed acknowledgment or a silently overwritten history',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  writeFileSync(f.journal,'retained-external-change');let response;
  try{response=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:event('QUOTE',{observedAt:new Date().toISOString(),price:100})});}catch{}
  assert(!response||response.status===503);assert.equal(readFileSync(f.journal,'utf8'),'retained-external-change');
 }finally{await r.stop();}
});
test('unsafe credential files fail before a receiver is exposed or a new journal is created',()=>{
 const f=files(),link=join(directory,'unsafe-hash-link.json');symlinkSync(credentialFile,link);let result=call(['start',f.cfg,f.journal,link]);assert.equal(result.status,1);assert(!existsSync(f.journal));assert(!result.stdout.includes('READY'));
 const broad=join(directory,'broad-hashes.json');writeFileSync(broad,readFileSync(credentialFile));chmodSync(broad,0o644);result=call(['start',f.cfg,f.journal,broad]);assert.equal(result.status,1);assert(!existsSync(f.journal));
 const duplicate=join(directory,'duplicate-hashes.json'),disk=JSON.parse(readFileSync(credentialFile,'utf8'));writeFileSync(duplicate,'{"version":1,"version":1,"producerDigest":"'+disk.producerDigest+'","ownerDigest":"'+disk.ownerDigest+'"}',{mode:0o600});result=call(['start',f.cfg,f.journal,duplicate]);assert.equal(result.status,1);assert(!existsSync(f.journal));
});
test('actual duplicate security headers are refused before event admission',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  const body=JSON.stringify(event('QUOTE',{observedAt:new Date().toISOString(),price:100}));
  for(const name of ['Host','Origin','Authorization','Content-Type','X-Session-Id','X-Session-Instance']){
   const values={'Host':r.url.host,'Origin':r.url.origin,'Authorization':'Bearer '+tokens.producerToken,'Content-Type':'application/json','X-Session-Id':r.ready.sessionId,'X-Session-Instance':r.ready.sessionInstance},headers=[];
   for(const [key,value]of Object.entries(values)){headers.push(key,value);if(key===name)headers.push(key,value);}
   const status=await new Promise((resolve,reject)=>{const req=request(new URL('/api/events',r.url),{method:'POST',headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(body);});assert(status>=400&&status<500,name+' must be rejected.');
  }
  assert.equal(JSON.parse(readFileSync(f.journal,'utf8')).events.length,0);
 }finally{await r.stop();}
});
test('a second actual receiver cannot take over the durable writer or silently replace the first confirmed state',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  const before=readFileSync(f.journal);const other=call(['resume',f.journal,credentialFile]);assert.equal(other.status,1);assert(!other.stdout.includes('READY'));assert.deepEqual(readFileSync(f.journal),before);
  assert.equal((await api(r,'/api/state')).status,200);
 }finally{await r.stop();}
});
test('failure of the actual durable child disconnects intake while retaining unliquidated inventory',async()=>{
 const f=await seeded();try{
  await enter(f.r);const before=readFileSync(f.journal);
  const ids=readFileSync('/proc/'+f.r.child.pid+'/task/'+f.r.child.pid+'/children','utf8').trim().split(/\s+/).map(Number);
  const pid=ids.find(id=>{try{return readFileSync('/proc/'+id+'/cmdline','utf8').includes('session-runtime.mjs');}catch{return false;}});assert(pid,'The actual fixed durable child must be live.');process.kill(pid,'SIGKILL');
  const closed=await Promise.race([f.r.closed,delay(10000).then(()=>{throw Error('Failed child did not stop receiver.');})]);assert.notEqual(closed.code,0);assert.deepEqual(readFileSync(f.journal),before);
  const retained=await m.reconstructSessionJournal(JSON.parse(before));assert.equal(retained.state.openPositions.length,1);assert.equal(retained.state.trades.length,0);
 }finally{if(f.r.child.exitCode===null&&f.r.child.signalCode===null)await f.r.stop();}
});
test('a first-party injected parent-directory sync failure after replacement never confirms the HTTP event',async()=>{
 const f=files(),fault=join(directory,'first-party-child-fsync-fault.mjs'),hook=join(directory,'first-party-child-spawn-hook.mjs');
 writeFileSync(fault,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let calls=0;fs.fsyncSync=function(...args){if(++calls===4)throw Error('Invented local storage fault.');return original(...args);};syncBuiltinESMExports();\n");
 writeFileSync(hook,"import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';const original=cp.spawn;cp.spawn=function(command,args,options){if(args?.some(value=>String(value).endsWith('/scripts/session-runtime.mjs')))args=['--import',"+JSON.stringify(fault)+",...args];return original.call(this,command,args,options);};syncBuiltinESMExports();\n");
 const r=await receiver(['start',f.cfg,f.journal,credentialFile],[hook]);try{
  const e=event('QUOTE',{observedAt:new Date().toISOString(),price:100});let response;try{response=await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:e});}catch{}
  assert(!response||response.status===503);assert(!response||response.value.confirmed===false);
  const retained=await m.reconstructSessionJournal(JSON.parse(readFileSync(f.journal,'utf8')));assert.equal(retained.events.length,1);assert.equal(retained.events[0].event.requestId,e.requestId);assert.equal(retained.state.sequence,1);
 }finally{await r.stop();}
});
test('a stale session identity cannot send controls, market events or receipt lookup into another session',async()=>{
 const f=files(),r=await receiver(['start',f.cfg,f.journal,credentialFile]);try{
  const headers={'X-Session-Id':randomUUID()};assert.equal((await api(r,'/api/control',{method:'POST',body:event('EMERGENCY'),headers})).status,409);
  assert.equal((await api(r,'/api/events',{token:tokens.producerToken,method:'POST',body:event('QUOTE',{observedAt:new Date().toISOString(),price:100}),headers})).status,409);
  assert.equal((await api(r,'/api/receipts/'+randomUUID(),{token:tokens.producerToken,headers})).status,409);assert.equal(JSON.parse(readFileSync(f.journal,'utf8')).events.length,0);
 }finally{await r.stop();}
});
test('local tokens in percent-encoded or JSON-escaped configuration text are refused before journal persistence',()=>{
 for(const secret of [tokens.ownerToken,encodeURIComponent(tokens.producerToken).replace('og_','%6fg_')]){
  const f=files(),cfg=JSON.parse(readFileSync(f.cfg,'utf8'));cfg.sourceLabel=secret.slice(0,80);writeFileSync(f.cfg,JSON.stringify(cfg).replace(/og_local_/g,'\\u006fg_local_'));const result=call(['start',f.cfg,f.journal,credentialFile]);assert.equal(result.status,1);assert(!existsSync(f.journal));assert(!result.stdout.includes(secret));assert(!result.stderr.includes(secret));
 }
});
test('a new history reusing the exact configuration and local port rejects old commands, while actual resume preserves its instance',async()=>{
 const f=files();let r=await receiver(['start',f.cfg,f.journal,credentialFile]);const first=r.ready,port=String(first.port),pause=event('PAUSE'),old=await api(r,'/api/control',{method:'POST',body:pause});assert.equal(old.status,200);
 try{
  await r.stop();r=await receiver(['start',f.cfg,f.journal+'.new',credentialFile,port]);assert.equal(r.ready.sessionId,first.sessionId);assert.notEqual(r.ready.sessionInstance,first.sessionInstance);
  const headers={'X-Session-Id':first.sessionId,'X-Session-Instance':first.sessionInstance};assert.equal((await api(r,'/api/control',{method:'POST',body:pause,headers})).status,409);assert.equal((await api(r,'/api/receipts/'+pause.requestId,{headers})).status,409);
  const fresh=JSON.parse(readFileSync(f.journal+'.new','utf8'));assert.equal(fresh.events.length,0);assert.equal(fresh.state.status,'ACTIVE');
  await r.stop();r=await receiver(['resume',f.journal,credentialFile,port]);assert.equal(r.ready.sessionId,first.sessionId);assert.equal(r.ready.sessionInstance,first.sessionInstance);
  const recovered=await api(r,'/api/receipts/'+pause.requestId,{headers});assert.equal(recovered.status,200);assert.deepEqual(recovered.value.receipt,old.value.receipt);assert.equal(recovered.value.sessionInstance,first.sessionInstance);
 }finally{await r.stop();}
});
