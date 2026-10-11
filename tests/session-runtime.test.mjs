import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {build} from 'esbuild';
let m,directory,cfg,early,late;const children=new Set();
before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-session-transport-'));
 const bundle=await build({stdin:{contents:"export {syntheticSessionExample} from './app/session-example';export {strategyTemplate,strategyDigest} from './app/strategy-model';export {createSessionJournal,reconstructSessionJournal} from './app/session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 const path=join(directory,'trusted.mjs');writeFileSync(path,bundle.outputFiles[0].text);m=await import(pathToFileURL(path).href);
 const example=await m.syntheticSessionExample(),config=example.config;config.clockMode='SYSTEM_RECEIPT';config.strategy.record.content.definition=m.strategyTemplate('DCA');config.strategy.record.content.definition.entry={type:'DCA',intervalBars:1,maxEntries:4};config.strategy.digest=await m.strategyDigest(JSON.stringify(config.strategy.record));
 cfg=join(directory,'config.json');writeFileSync(cfg,JSON.stringify(config));
 function clock(name,start){const path=join(directory,name);writeFileSync(path,"const OriginalDate=globalThis.Date;let now="+Date.parse(start)+";globalThis.Date=class extends OriginalDate{constructor(...args){if(args.length)super(...args);else{super(now);now+=1000;}}static now(){return now;}};\n");return path;}
 early=clock('first-party-clock.mjs','2025-01-01T00:59:59.000Z');late=clock('first-party-later-clock.mjs','2025-01-01T01:00:02.000Z');
});
after(()=>{for(const child of children)child.kill('SIGKILL');rmSync(directory,{recursive:true,force:true});});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const inputEvents=[{requestId:id(1),type:'CLOSED_BAR',bar:{closedAt:'2025-01-01T01:00:00.000Z',open:100,high:150,low:50,close:100,volume:1}},{requestId:id(2),type:'QUOTE',observedAt:'2025-01-01T01:00:00.500Z',price:100}];
const frames=events=>events.map(e=>JSON.stringify(e)).join('\n')+'\n';
function call(args,input='',clock=early){return spawnSync(process.execPath,[...(clock?['--import',clock]:[]),'scripts/session-runtime.mjs',...args],{cwd:process.cwd(),input,encoding:'utf8',timeout:20000,maxBuffer:32768});}
const output=result=>result.stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
async function running(args,clock=early){
 const child=spawn(process.execPath,['--import',clock,'scripts/session-runtime.mjs',...args],{cwd:process.cwd(),stdio:['pipe','pipe','pipe']});children.add(child);
 let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
 const closed=new Promise(resolve=>child.on('close',(code,signal)=>{children.delete(child);resolve({code,signal,stdout,stderr});}));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Actual CLI ready timeout.')),10000);const listener=()=>{if(stdout.includes('"type":"READY"')){clearTimeout(timer);child.stdout.off('data',listener);resolve();}};child.stdout.on('data',listener);child.on('exit',()=>{if(!stdout.includes('"type":"READY"')){clearTimeout(timer);reject(Error('Actual CLI was not ready.'));}});listener();});
 return {child,closed,get stdout(){return stdout;}};
}
function helperPid(child){return readFileSync('/proc/'+child.pid+'/task/'+child.pid+'/children','utf8').trim().split(/\s+/).map(Number).find(pid=>{try{return readFileSync('/proc/'+pid+'/cmdline','utf8').includes('session-file-lock.py');}catch{return false;}});}

test('actual connected stdio processing durably retains open positions and reconstructs without stream-tail liquidation',async()=>{
 const path=join(directory,'open.json'),result=call(['start',cfg,path],frames(inputEvents));assert.equal(result.status,0,result.stderr);
 const responses=output(result);assert.equal(responses[0].type,'READY');assert.equal(responses[0].transport,'STDIN_NDJSON');assert.equal(responses[0].sourceAuthentication,'UNKNOWN');
 assert.equal(responses.filter(v=>v.type==='RECEIPT').length,2);assert.equal(responses.at(-1).openPositions,1);assert.equal(responses.at(-1).sessionLiquidated,false);
 const journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(path,'utf8')));assert.equal(journal.state.trades.length,0);assert.equal(journal.state.openPositions.length,1);
 const verified=call(['verify',path],'',null);assert.equal(verified.status,0,verified.stderr);assert.equal(output(verified)[0].type,'RECONSTRUCTED');
});
test('an open external stream confirms each durable transition before the next event and before EOF',async()=>{
 const path=join(directory,'still-connected.json'),process=await running(['start',cfg,path]);
 async function confirmed(sequence){
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('Incremental receipt timeout.'));},5000);
   const cleanup=()=>{clearTimeout(timer);process.child.stdout.off('data',inspect);process.child.off('exit',ended);};
   const ended=()=>{cleanup();reject(Error('Stream ended before incremental confirmation.'));};
   const inspect=()=>{const lines=process.stdout.split('\n').slice(0,-1).map(line=>JSON.parse(line));if(lines.some(value=>value.type==='RECEIPT'&&value.sequence===sequence)){cleanup();resolve();}};
   process.child.stdout.on('data',inspect);process.child.on('exit',ended);inspect();
  });
 }
 try{
  assert.equal(process.child.exitCode,null);assert.equal(process.child.stdin.writableEnded,false);
  process.child.stdin.write(frames([inputEvents[0]]));await confirmed(1);
  let journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(path,'utf8')));assert.equal(journal.events.length,1);assert(journal.state.pending);assert.equal(journal.state.openPositions.length,0);assert.equal(process.child.stdin.writableEnded,false);
  process.child.stdin.write(frames([inputEvents[1]]));await confirmed(2);
  journal=await m.reconstructSessionJournal(JSON.parse(readFileSync(path,'utf8')));assert.equal(journal.events.length,2);assert.equal(journal.state.openPositions.length,1);assert.equal(journal.state.trades.length,0);assert.equal(process.child.exitCode,null);assert.equal(process.child.stdin.writableEnded,false);
 }finally{process.child.stdin.end();}
 const closed=await process.closed;assert.equal(closed.code,0);assert.equal(output(closed).at(-1).type,'DISCONNECTED');assert.equal(output(closed).at(-1).sessionLiquidated,false);
});
test('duplicate retries keep one durable receipt and cannot revise the stored event',()=>{
 const path=join(directory,'duplicate.json'),result=call(['start',cfg,path],frames([inputEvents[0],inputEvents[0],{...inputEvents[0],bar:{...inputEvents[0].bar,volume:2}}]));assert.equal(result.status,0,result.stderr);
 const responses=output(result);assert(responses.some(v=>v.type==='RECEIPT'&&v.duplicate));assert(responses.some(v=>v.type==='NOT_CONFIRMED'));
 const journal=JSON.parse(readFileSync(path,'utf8'));assert.equal(journal.events.length,1);assert.equal(journal.events[0].event.bar.volume,1);
});
test('resume reconstructs first and confirms paused admissions before accepting explicit resume',()=>{
 const path=join(directory,'resume.json');assert.equal(call(['start',cfg,path],frames(inputEvents)).status,0);
 const result=call(['resume',path],frames([{requestId:id(3),type:'RESUME'},{requestId:id(4),type:'QUOTE',observedAt:'2025-01-01T01:00:03.500Z',price:101}]),late);assert.equal(result.status,0,result.stderr);
 const ready=output(result)[0];assert.equal(ready.type,'READY');assert.equal(ready.status,'PAUSED');assert.equal(ready.requiresExplicitResume,true);
 const journal=JSON.parse(readFileSync(path,'utf8'));assert.equal(journal.events[2].event.type,'PAUSE');assert.equal(journal.state.events[2].disposition,'ACCEPTED');assert.equal(journal.events[3].event.type,'RESUME');assert.equal(journal.state.openPositions.length,1);
});
test('regressed system clock cannot claim ready recovery when the automatic pause was rejected',()=>{
 const path=join(directory,'regression.json');assert.equal(call(['start',cfg,path],frames(inputEvents)).status,0);
 const result=call(['resume',path],'',early);assert.equal(result.status,1);assert(!result.stdout.includes('"type":"READY"'));
 const journal=JSON.parse(readFileSync(path,'utf8'));assert.equal(journal.state.status,'ACTIVE');assert.equal(journal.state.events.at(-1).disposition,'REJECTED');assert.equal(journal.state.events.at(-1).reason,'OUT_OF_ORDER');assert.equal(journal.state.openPositions.length,1);
});
test('new sessions refuse existing output and symlink targets without overwriting prior evidence',()=>{
 const path=join(directory,'retained.json');writeFileSync(path,'retained-before-start');assert.equal(call(['start',cfg,path]).status,1);assert.equal(readFileSync(path,'utf8'),'retained-before-start');
 const link=join(directory,'link.json');symlinkSync(path,link);assert.equal(call(['start',cfg,link]).status,1);assert.equal(readFileSync(path,'utf8'),'retained-before-start');
});
test('malformed and caller-supplied receipt fields are rejected generically without private text in diagnostics or journal',()=>{
 const marker='never-retain-private-transport-material',path=join(directory,'malformed.json');
 const result=call(['start',cfg,path],marker+'\n'+JSON.stringify({requestId:id(9),type:'PAUSE',receivedAt:'2025-01-01T01:00:00.000Z'})+'\n');assert.equal(result.status,0);
 assert.equal(output(result).filter(v=>v.type==='TRANSPORT_REJECTED').length,2);assert(!result.stdout.includes(marker));assert(!result.stderr.includes(marker));assert(!readFileSync(path,'utf8').includes(marker));assert.equal(JSON.parse(readFileSync(path,'utf8')).events.length,0);
});
test('a newline-free oversized frame terminates instead of unbounded draining or executing supplied contents',()=>{
 const path=join(directory,'overflow.json'),result=call(['start',cfg,path],'never-echo-oversized-private-'+ 'x'.repeat(8192));assert.equal(result.status,1);assert(!result.stdout.includes('never-echo'));assert(!result.stderr.includes('never-echo'));assert.equal(JSON.parse(readFileSync(path,'utf8')).events.length,0);
});
test('synthetic playback can be verified but cannot claim connected system-receipt intake',async()=>{
 const example=await m.syntheticSessionExample(),configPath=join(directory,'synthetic-config.json');writeFileSync(configPath,JSON.stringify(example.config));const outputPath=join(directory,'not-created.json');assert.equal(call(['start',configPath,outputPath]).status,1);assert(!existsSync(outputPath));
 const journal=await m.createSessionJournal(example.config,example.startedAt),path=join(directory,'synthetic.json');writeFileSync(path,JSON.stringify(journal));assert.equal(call(['verify',path],'',null).status,0);assert.equal(call(['resume',path]).status,1);
});
test('two actual writers and a killed lock helper cannot release the parent-held file-description lock',async()=>{
 const path=join(directory,'writers.json'),first=await running(['start',cfg,path]);const bytes=readFileSync(path);
 const concurrent=call(['resume',path]);assert.equal(concurrent.status,1);assert.deepEqual(readFileSync(path),bytes);
 const pid=helperPid(first.child);assert(pid,'Actual POSIX lock helper must be live.');process.kill(pid,'SIGKILL');
 const afterHelperDeath=call(['resume',path]);assert.equal(afterHelperDeath.status,1);assert.deepEqual(readFileSync(path),bytes);
 first.child.stdin.end();const closed=await first.closed;assert.equal(closed.code,1);
 const next=call(['resume',path],'',late);assert.equal(next.status,0,next.stderr);
});
test('process crash releases the actual lock and restart reconciles retained history without deleting stale lock files',async()=>{
 const path=join(directory,'crash.json'),first=await running(['start',cfg,path]);const before=readFileSync(path);
 first.child.kill('SIGKILL');await first.closed;
 const restarted=call(['resume',path],'',late);assert.equal(restarted.status,0,restarted.stderr);assert(existsSync(path+'.lock'));assert.equal(output(restarted)[0].status,'PAUSED');
 const old=JSON.parse(before),journal=JSON.parse(readFileSync(path,'utf8'));assert.equal(old.events.length,0);assert.equal(journal.events.length,1);assert.equal(journal.events[0].event.type,'PAUSE');
});
