import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,chmodSync,symlinkSync,linkSync,unlinkSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import childProcess,{spawnSync,execFileSync} from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {localCheckLimits,parseArguments,parseLocalJson,reducedEnvironment,writePrivate,privateFile,assertHeld,inventoryTree,assertTree,buildDescriptor,cleanSource,assertSource,runLocalPhase,verifyNativeBody} from '../scripts/selfhost-local-check-core.mjs';

// Actual local files and owned children only. No fixture pretends to pass the UI matrix.
const project=resolve('.'),cli=join(project,'scripts/selfhost-local-check.mjs'),working=mkdtempSync(join(tmpdir(),'opengrail-selfhost-check-tests-'));
chmodSync(working,0o700);let ordinal=0;
const fresh=name=>join(working,String(ordinal++).padStart(3,'0')+'-'+name);
function folder(name){const path=fresh(name);mkdirSync(path,{mode:0o700});return path;}
const write=(path,value)=>{writeFileSync(path,typeof value==='string'?value:JSON.stringify(value),{mode:0o600});chmodSync(path,0o600);};
after(()=>rmSync(working,{recursive:true,force:true}));

test('actual CLI refuses selectable commands, unsafe paths and an existing output without changing its evidence',()=>{
 const retained=folder('retained'),original=join(retained,'original.json');write(original,{status:'original failure'});const before=readFileSync(original);
 for(const args of [[],['--command','build'],['--output','relative'],['--output',fresh('bad')+'\x7f'],['--output',retained,'--provider','https://fixture.invalid'],['--output',retained]]){
  const result=spawnSync(process.execPath,[cli,...args],{cwd:project,encoding:'utf8',timeout:10000,env:{PATH:'/usr/local/bin:/usr/bin:/bin'}});assert.equal(result.status,1,result.stderr);assert(!result.stdout.includes('ACCEPTED_LOCAL_SELF_CHECK'));assert.deepEqual(readFileSync(original),before);assert.deepEqual(readdirSync(retained),['original.json']);
 }
 assert.throws(()=>parseArguments(['--output','/tmp/a','--mode','demo']));const env=reducedEnvironment(working);assert.equal(env.CLOUDFLARE_CF_FETCH_ENABLED,'false');assert.equal(env.WRANGLER_SEND_METRICS,'false');assert.equal(env.HOME,join(working,'home'));assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.CLOUDFLARE_API_TOKEN,undefined);
});

test('private publication and complete JSON reject overwrite, links, changed originals and ambiguous bytes',()=>{
 const path=fresh('receipt.json'),original=Buffer.from('{"status":"retained"}\n');const held=writePrivate(path,original);assert.equal(privateFile(path).identity.nlink,'1');assert.throws(()=>writePrivate(path,Buffer.from('{}')));assert.deepEqual(readFileSync(path),original);
 const alias=fresh('alias.json');linkSync(path,alias);assert.throws(()=>privateFile(path));unlinkSync(alias);write(path,'{"status":"tampered"}');assert.throws(()=>assertHeld(held));
 for(const bytes of [Buffer.from('{"a":1,"a":2}'),Buffer.from([239,187,191,123,125]),Buffer.from([123,34,120,34,58,34,255,34,125])])assert.throws(()=>parseLocalJson(bytes));
 const symlink=fresh('link.json');symlinkSync(path,symlink);assert.throws(()=>privateFile(symlink));
});

test('installed dependency aliases must all stay inside the observed tree; source/build links remain refused',()=>{
 const dep=folder('dependencies'),a=join(dep,'a.js'),b=join(dep,'b.js');write(a,'export const v=1;');linkSync(a,b);const before=inventoryTree(dep,{kind:'dependency'});assert.equal(before.held.length,2);assertTree(before);
 const external=fresh('external-alias');linkSync(a,external);assert.throws(()=>inventoryTree(dep,{kind:'dependency'}));unlinkSync(external);assert.throws(()=>inventoryTree(dep));write(a,'export const v=2;');assert.throws(()=>assertTree(before));
 const unsafe=folder('unsafe-tree');write(join(unsafe,'.env'),'SYNTHETIC_FIXTURE_ONLY');assert.throws(()=>inventoryTree(unsafe));
});

test('actual emitted configuration selects its whole module graph and missing literal imports refuse',async()=>{
 const build=folder('emitted');mkdirSync(join(build,'server'),{mode:0o700});mkdirSync(join(build,'server','chunks'),{mode:0o700});mkdirSync(join(build,'client'),{mode:0o700});
 write(join(build,'server','entry.mjs'),"import './chunks/first.js';export const lazy=()=>import('./chunks/later.mjs');");write(join(build,'server','chunks','first.js'),'export const first=1;');write(join(build,'server','chunks','later.mjs'),'export const later=2;');write(join(build,'client','asset.txt'),'original asset');
 write(join(build,'server','wrangler.json'),{main:'entry.mjs',assets:{directory:'../client',binding:'ASSETS',run_worker_first:false},rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]});
 const snapshot=inventoryTree(build),descriptor=await buildDescriptor(snapshot,project);assert.equal(descriptor.main,'server/entry.mjs');assert.equal(descriptor.modules[0].path,descriptor.main);assert.equal(descriptor.modules.length,3);assert.equal(descriptor.assets.directory,'client');assert.equal(descriptor.files.length,5);assertTree(snapshot);
 unlinkSync(join(build,'server','chunks','later.mjs'));await assert.rejects(buildDescriptor(inventoryTree(build),project),/INCOMPLETE_MODULE_GRAPH/);
});

test('actual clean Git source admission binds the lockfile and refuses dirty bytes or dotenv without reading it',async()=>{
 const repo=folder('repository');write(join(repo,'package-lock.json'),'{}');write(join(repo,'trusted.mjs'),'// synthetic source only');const env={PATH:'/usr/local/bin:/usr/bin:/bin',HOME:working,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_AUTHOR_NAME:'Local synthetic fixture',GIT_AUTHOR_EMAIL:'fixture@invalid.test',GIT_COMMITTER_NAME:'Local synthetic fixture',GIT_COMMITTER_EMAIL:'fixture@invalid.test'};
 const git=args=>execFileSync('/usr/bin/git',args,{cwd:repo,env,timeout:10000,maxBuffer:1048576});git(['init','-q']);git(['add','.']);git(['commit','-qm','Synthetic trusted fixture']);const source=await cleanSource(repo,async args=>git(args));assert.equal(source.files.length,2);await assertSource(source,async args=>git(args));write(join(repo,'trusted.mjs'),'// changed source');await assert.rejects(assertSource(source,async args=>git(args)),/CHECKOUT_NOT_CLEAN/);
 git(['checkout','--','trusted.mjs']);symlinkSync(fresh('missing-private-body'),join(repo,'.env'));await assert.rejects(cleanSource(repo,async args=>git(args)),/PRIVATE_CONFIGURATION_PRESENT/);
});

test('actual supervisor collects the original zero wait but refuses deadlines, truncation and interrupted descendant work',async()=>{
 const plain=folder('zero-wait'),simple=await runLocalPhase({executable:process.execPath,args:['-e',"process.stdout.write('original observed stdout\\n')"],cwd:project,env:reducedEnvironment(working),output:plain,label:'zero',timeoutMs:10000});assert.equal(simple.receipt.status,'PHASE_COMPLETE');assert.equal(simple.receipt.originalWaitCollected,true);assert.equal(simple.receipt.exitCode,0);assert.equal(simple.receipt.ownedGroupAbsent,true);assert.equal(simple.receipt.observedDescendantsAbsent,true);assert.equal(readFileSync(join(plain,'zero.stdout'),'utf8'),'original observed stdout\n');
 const noisy=folder('bounded-output'),overflow=await runLocalPhase({executable:process.execPath,args:['-e',"process.stdout.write('x'.repeat(1024));setInterval(()=>{},1000)"],cwd:project,env:reducedEnvironment(working),output:noisy,label:'overflow',timeoutMs:10000,logBytes:64});assert.equal(overflow.receipt.status,'UNCONFIRMED');assert.equal(overflow.receipt.outputTruncated,true);assert.equal(readFileSync(join(noisy,'overflow.stdout')).length,64);assert.equal(overflow.receipt.originalWaitCollected,true);
 const timeout=folder('deadline'),late=await runLocalPhase({executable:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:project,env:reducedEnvironment(working),output:timeout,label:'deadline',timeoutMs:500});assert.equal(late.receipt.status,'UNCONFIRMED');assert.equal(late.receipt.timedOut,true);assert.equal(late.receipt.originalWaitCollected,true);
 const output=folder('descendants'),controller=new AbortController(),child="const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',\"process.stdout.write('child-ready\\\\n');setInterval(()=>{},1000)\"],{stdio:['ignore','pipe','ignore']});child.stdout.on('data',b=>process.stdout.write(b));process.on('SIGTERM',()=>{child.kill('SIGTERM');child.once('close',()=>process.exit(0));});setInterval(()=>{},1000);";
 const pending=runLocalPhase({executable:process.execPath,args:['-e',child],cwd:project,env:reducedEnvironment(working),output,label:'descendant',timeoutMs:15000,signal:controller.signal});const start=Date.now();let interrupted;
 try{while(!existsSync(join(output,'descendant.stdout'))||!readFileSync(join(output,'descendant.stdout'),'utf8').includes('child-ready')){assert(Date.now()-start<10000,'Synthetic child readiness deadline');await new Promise(resolve=>setTimeout(resolve,50));}}finally{controller.abort();interrupted=await pending;}
 assert.equal(interrupted.receipt.status,'UNCONFIRMED');assert.equal(interrupted.receipt.interrupted,true);assert.equal(interrupted.receipt.originalWaitCollected,true);assert(interrupted.receipt.observedDescendants.length>0);assert.equal(interrupted.receipt.ownedGroupAbsent,true);assert.equal(interrupted.receipt.observedDescendantsAbsent,true);
});

test('actual child stream errors enter bounded original wait and process closeout',async()=>{
 for(const stream of ['stdout','stderr']){
  const output=folder('stream-'+stream),original=childProcess.spawn;let timer;
  childProcess.spawn=(...args)=>{const child=original(...args);timer=setTimeout(()=>child[stream].destroy(new Error('Synthetic local pipe failure')),100);return child;};
  syncBuiltinESMExports();
  try{
   const result=await runLocalPhase({executable:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:project,env:reducedEnvironment(working),output,label:'stream-error',timeoutMs:10000});
   assert.equal(result.receipt.status,'UNCONFIRMED');assert.equal(result.receipt.reason,'PHASE_STREAM_UNCONFIRMED');assert.equal(result.receipt.originalWaitCollected,true);assert.equal(result.receipt.ownedGroupAbsent,true);assert.equal(result.receipt.observedDescendantsAbsent,true);
  }finally{clearTimeout(timer);childProcess.spawn=original;syncBuiltinESMExports();}
 }
});

test('a stale or partial native receipt never substitutes for the real twenty-page matrix or outer closure',()=>{
 const native=folder('partial-native');write(join(native,'receipt.json'),{schema:'OPENGRAIL_LOCAL_SELFHOST_BODY_V1',status:'BODY_COMPLETE',executionClosure:'OUTER_EXECUTION_CLOSURE_PENDING',checks:[],manifestSha256:'0'.repeat(64)});const original=readFileSync(join(native,'receipt.json'));assert.throws(()=>verifyNativeBody(native,'1'.repeat(64)),/NATIVE_BODY_UNCONFIRMED/);assert.deepEqual(readFileSync(join(native,'receipt.json')),original);assert.equal(localCheckLimits.buildMs,600000);assert.equal(localCheckLimits.nativeMs,900000);assert.equal(localCheckLimits.overallMs,1600000);
});
