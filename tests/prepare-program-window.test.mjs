import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,lstatSync,chmodSync,symlinkSync,linkSync,existsSync,rmSync,cpSync,readdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {completedDirectionSearch} from './program-direction-search-fixtures.mjs';

// First-party synthetic local files only. No provider, public API or private app.
const project=process.cwd(),cli=resolve('scripts/prepare-program-window.mjs');
let directory,f,ledgerPath,setupPath,serial=0;
const next=name=>join(directory,String(++serial)+'-'+name);
const write=(path,value)=>writeFileSync(path,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value),{flag:'wx',mode:0o600});
const run=(args,preload)=>spawnSync(process.execPath,[...(preload?['--import',preload]:[]),cli,...args],{cwd:project,encoding:'utf8',timeout:60000,maxBuffer:16384});
function setup(){const start=Math.ceil((Date.now()+600000)/3600000)*3600000;return {startsAt:new Date(start).toISOString(),endsAt:new Date(start+7200000).toISOString(),pollMs:120000,cycles:62,warmupBars:2,sourceMode:'SYNTHETIC_RESPONSES',rights:{kind:'AUTHOR_DECLARED_RIGHTS',verification:'NOT_ESTABLISHED',marketDataUseApproved:true,rawRetentionApproved:true,sharedIpRateBudgetApproved:true,publicSharing:'NOT_CONSENTED',note:'Invented test observations only; no provider or public operation.'}};}
before(async()=>{f=await completedDirectionSearch();directory=mkdtempSync(join(tmpdir(),'opengrail-prepare-window-'));chmodSync(directory,0o700);ledgerPath=next('ledger.json');setupPath=next('setup.json');write(ledgerPath,f.ledger);write(setupPath,setup());assert(f.ledger.attempts.find(a=>a.phase==='TEST').outcome.artifact.metrics.netPnl<0);});
after(()=>rmSync(directory,{recursive:true,force:true}));

test('actual preparation and read-only verification preserve whole losing TEST, exact economics and local current source declarations',()=>{
 const output=next('input.json'),networkFence=next('no-provider.mjs');write(networkFence,"globalThis.fetch=()=>{throw Error('SYNTHETIC_TEST_PROHIBITS_NETWORK');};");
 const original=readFileSync(ledgerPath),before=Date.now(),result=run(['prepare',ledgerPath,setupPath,output],networkFence),finished=Date.now();assert.equal(result.status,0,result.stderr);
 const notice=JSON.parse(result.stdout),input=JSON.parse(readFileSync(output,'utf8'));assert.equal(notice.kind,'LOCAL_PROGRAM_WINDOW_INPUT_PREPARED');assert(Date.parse(input.protocol.preparedAt)>=before&&Date.parse(input.protocol.preparedAt)<=finished);assert.deepEqual(input.plan.handoff.ledger,f.ledger);assert.deepEqual(readFileSync(ledgerPath),original);assert(input.plan.handoff.ledger.attempts.at(-1).outcome.artifact.metrics.netPnl<0);assert.equal(input.plan.config.initialCapital,f.ledger.plan.admission.initialCapital);assert.deepEqual(input.protocol.risk,f.ledger.plan.protocol.risk);assert.deepEqual(input.protocol.costs,f.ledger.plan.protocol.costs);assert.equal(input.plan.config.strategy.digest,input.plan.handoff.winner.source.digest);assert.equal(Object.keys(input.protocol.newImplementation.components).length,6);assert.equal(lstatSync(output).mode&0o7777,0o600);assert.equal(lstatSync(output).nlink,1);assert(Buffer.byteLength(readFileSync(output))<=8388608);
 const checked=run(['verify',output],networkFence);assert.equal(checked.status,0,checked.stderr);const receipt=JSON.parse(checked.stdout);assert.equal(receipt.verification,'HISTORICAL_INPUT_CONSISTENCY_AND_CURRENT_PHYSICAL_PINS');for(const field of ['backtestReplayed','guestExecuted','providerStarted','publicReferencesAuthenticated','registered','freshAdmission','ordersEnabled','liveEnabled'])assert.equal(receipt[field],false,field);assert.equal(receipt.inputDigest,input.inputDigest);const retained=readFileSync(output);assert.equal(run(['prepare',ledgerPath,setupPath,output]).status,1);assert.deepEqual(readFileSync(output),retained);
 const pastClock=next('past-verification-clock.mjs');write(pastClock,"Date.now=()=>Date.parse('2090-01-01T00:00:00.000Z');globalThis.fetch=()=>{throw Error('NO_NETWORK');};");assert.equal(run(['verify',output],pastClock).status,0,'Historical verification grants no fresh run admission.');
});

test('actual CLI rejects unsafe files, malformed input and unsupported authorities without output or private text',()=>{
 const shared=next('shared.json');write(shared,f.ledger);chmodSync(shared,0o644);
 const readOnly=next('read-only.json');write(readOnly,f.ledger);chmodSync(readOnly,0o400);
 const symbolic=next('symbolic.json');symlinkSync(ledgerPath,symbolic);
 const hardOriginal=next('hard-original.json'),hard=next('hard.json');write(hardOriginal,f.ledger);linkSync(hardOriginal,hard);
 const fifo=next('fifo');assert.equal(spawnSync('mkfifo',[fifo],{timeout:2000}).status,0);
 const bom=next('bom.json');write(bom,'\uFEFF{}');const invalid=next('invalid.json');write(invalid,Buffer.from([0xff]));const oversized=next('oversize.json');write(oversized,Buffer.alloc(8388609,32));
 const publicParent=next('public-parent');mkdirSync(publicParent,{mode:0o755});chmodSync(publicParent,0o755);const publicInput=join(publicParent,'input.json');write(publicInput,f.ledger);
 for(const input of [shared,readOnly,symbolic,hard,fifo,bom,invalid,oversized,publicInput,resolve('package.json'),ledgerPath+'\x7f']){const out=next('refused.json'),result=run(['prepare',input,setupPath,out]);assert.equal(result.status,1,result.stdout);assert.equal(existsSync(out),false);assert.equal(result.stdout,'');}
 for(const extra of [{preparedAt:'2020-01-01T00:00:00.000Z'},{sessionId:'caller-selected'},{newImplementation:{}},{providerUrl:'https://example.invalid'},{token:'og_local_owner_synthetic_not_secret'}]){const path=next('authority.json'),out=next('authority-output.json');write(path,{...setup(),...extra});const result=run(['prepare',ledgerPath,path,out]);assert.equal(result.status,1);assert.equal(existsSync(out),false);assert(!result.stderr.includes('og_local_owner_synthetic_not_secret'));}
 const noTest=next('no-test.json');write(noTest,{...f.ledger,attempts:f.ledger.attempts.filter(a=>a.phase!=='TEST')});assert.equal(run(['prepare',noTest,setupPath,next('no-test-output.json')]).status,1);
 const v1=next('v1.json');write(v1,{...f.ledger,version:1});assert.equal(run(['prepare',v1,setupPath,next('v1-output.json')]).status,1);
 const duplicate=next('duplicate.json'),out=next('duplicate-output.json');write(duplicate,JSON.stringify(f.ledger).replace('"version":2','"version":2,"version":2'));assert.equal(run(['prepare',duplicate,setupPath,out]).status,1);assert.equal(existsSync(out),false);
});

test('concurrent real CLI preparations cannot replace the first complete exclusive output',async()=>{
 const output=next('concurrent-input.json');function child(){const p=spawn(process.execPath,[cli,'prepare',ledgerPath,setupPath,output],{cwd:project,env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',part=>stdout+=part);p.stderr.on('data',part=>stderr+=part);return new Promise((yes,no)=>{const timer=setTimeout(()=>{p.kill('SIGKILL');no(Error('Bounded local preparation timeout'));},60000);p.on('error',error=>{clearTimeout(timer);no(error);});p.on('close',(code,signal)=>{clearTimeout(timer);yes({code,signal,stdout,stderr});});});}
 const results=await Promise.all([child(),child()]);assert.equal(results.filter(r=>r.code===0).length,1,JSON.stringify(results));assert.equal(results.filter(r=>r.code===1).length,1,JSON.stringify(results));const input=JSON.parse(readFileSync(output,'utf8'));assert.deepEqual(input.plan.handoff.ledger,f.ledger);assert.equal(lstatSync(output).nlink,1);assert.equal(run(['verify',output]).status,0);
});

test('input replacement is detected and late clock failure preserves a possibly committed whole original',()=>{
 const mutable=next('mutable-ledger.json'),output=next('changed-input-output.json'),fault=next('input-fault.mjs');write(mutable,f.ledger);
 write(fault,"import {writeFileSync,renameSync} from 'node:fs';const iso=Date.prototype.toISOString;let once=false;Date.prototype.toISOString=function(){const value=iso.call(this);if(!once){once=true;writeFileSync("+JSON.stringify(mutable+'.replacement')+",'{}',{mode:0o600});renameSync("+JSON.stringify(mutable+'.replacement')+","+JSON.stringify(mutable)+");}return value;};");
 const replaced=run(['prepare',mutable,setupPath,output],fault);assert.equal(replaced.status,1);assert.equal(existsSync(output),false);assert.equal(replaced.stdout,'');
 const late=next('late-output.json'),lateFault=next('late-clock.mjs');write(lateFault,"import {existsSync} from 'node:fs';const now=Date.now;Date.now=()=>existsSync("+JSON.stringify(late)+")?Date.parse('2090-01-01T00:00:00.000Z'):now();");
 const unconfirmed=run(['prepare',ledgerPath,setupPath,late],lateFault);assert.equal(unconfirmed.status,1);assert.equal(unconfirmed.stdout,'');assert(existsSync(late),'Possibly committed evidence must survive failed final lead confirmation.');assert.deepEqual(JSON.parse(readFileSync(late,'utf8')).plan.handoff.ledger,f.ledger);
});

test('an isolated first-party planner mutation cannot pass the preparation source guard',()=>{
 const isolated=next('isolated-source');mkdirSync(isolated,{mode:0o700});mkdirSync(join(isolated,'app'));mkdirSync(join(isolated,'node_modules'));
 for(const name of readdirSync(resolve('app')))if(name.endsWith('.ts'))copyFileSync(resolve('app',name),join(isolated,'app',name));cpSync(resolve('scripts'),join(isolated,'scripts'),{recursive:true});for(const name of ['package.json','package-lock.json','tsconfig.json'])copyFileSync(resolve(name),join(isolated,name));cpSync(resolve('node_modules/zod'),join(isolated,'node_modules/zod'),{recursive:true});symlinkSync(resolve('node_modules/esbuild'),join(isolated,'node_modules/esbuild'));
 const source=join(isolated,'app/program-window-planner-model.ts'),fault=next('isolated-source-fault.mjs'),out=next('isolated-source-output.json');write(fault,"import {appendFileSync} from 'node:fs';const iso=Date.prototype.toISOString;let once=false;Date.prototype.toISOString=function(){const value=iso.call(this);if(!once){once=true;appendFileSync("+JSON.stringify(source)+",'\\n// isolated synthetic source mutation\\n');}return value;};");
 const result=spawnSync(process.execPath,['--import',fault,join(isolated,'scripts/prepare-program-window.mjs'),'prepare',ledgerPath,setupPath,out],{cwd:project,encoding:'utf8',timeout:60000,maxBuffer:16384});assert.equal(result.status,1,result.stderr);assert.equal(result.stdout,'');assert.equal(existsSync(out),false);assert(readFileSync(source,'utf8').includes('isolated synthetic source mutation'));assert(!readFileSync(resolve('app/program-window-planner-model.ts'),'utf8').includes('isolated synthetic source mutation'));
});
