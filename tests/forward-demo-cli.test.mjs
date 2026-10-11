import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,lstatSync,chmodSync,symlinkSync,linkSync,mkdirSync,renameSync,existsSync,readdirSync,copyFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {forwardDemoFixture} from './forward-demo-fixtures.mjs';
import {loadForwardDemoModules,cleanupForwardDemoModules,readForwardDemoPlan} from '../scripts/forward-demo-core.mjs';
import {readPrivateForwardFile,readPrivateForwardBytes,preparePrivateForwardOutput} from '../scripts/forward-demo-files.mjs';

const project=process.cwd(),cli=resolve('scripts/forward-demo.mjs');let f,directory,handoffPath,configPath;
const write=(path,value)=>writeFileSync(path,typeof value==='string'?value:JSON.stringify(value),{flag:'wx',mode:0o600});
const run=args=>spawnSync(process.execPath,[cli,...args],{cwd:project,encoding:'utf8',timeout:30000,maxBuffer:65536});
const args=(output,changes={})=>{const base={'--handoff':handoffPath,'--config':configPath,'--starts-at':new Date(Date.now()+600000).toISOString(),'--ends-at':new Date(Date.now()+3600000).toISOString(),'--poll-ms':'15000','--cycles':'2','--output':output,...changes};return ['prepare',...Object.entries(base).flat()];};
before(async()=>{f=await forwardDemoFixture();directory=mkdtempSync(join(tmpdir(),'opengrail-forward-cli-test-'));handoffPath=join(directory,'handoff.json');configPath=join(directory,'config.json');write(handoffPath,f.handoff);write(configPath,f.config);});
after(async()=>{await cleanupForwardDemoModules();rmSync(directory,{recursive:true,force:true});});

test('actual CLI freezes process preparation clock, exact complete ledger/config and verifies historical consistency only',async()=>{
 const output=join(directory,'plan.json'),before=Date.now(),result=run(args(output)),after=Date.now();assert.equal(result.status,0,result.stderr);const notice=JSON.parse(result.stdout),plan=await readForwardDemoPlan(output);assert.equal(notice.kind,'LOCAL_FORWARD_DEMO_PLAN_PREPARED');assert(Date.parse(plan.preparedAt)>=before&&Date.parse(plan.preparedAt)<=after);assert.deepEqual(plan.handoff.ledger,f.ledger);assert.deepEqual(plan.config,f.config);assert.equal(lstatSync(output).mode&0o7777,0o600);const checked=run(['verify','--plan',output]);assert.equal(checked.status,0,checked.stderr);const summary=JSON.parse(checked.stdout);assert.equal(summary.verification,'HISTORICAL_CONSISTENCY_ONLY');assert.equal(summary.freshAdmission,false);assert.equal(summary.ordersEnabled,false);assert.equal(summary.liveEnabled,false);assert.equal(summary.planDigest,plan.planDigest);
 const existing=readFileSync(output);const retry=run(args(output));assert.equal(retry.status,1);assert.deepEqual(readFileSync(output),existing);
});
test('past window, changed capital, authority fields, duplicate JSON and credentials refuse output without echoing inputs',()=>{
 const config=structuredClone(f.config);config.initialCapital+=1;const wrong=join(directory,'changed.json');write(wrong,config);
 const duplicate=join(directory,'duplicate.json');write(duplicate,JSON.stringify(f.config).replace('"version":1','"version":1,"version":1'));
 const secret=join(directory,'secret.json'),credential='og_local_owner_synthetic_not_a_secret';write(secret,{...f.config,rights:{...f.config.rights,note:credential}});
 for(const [n,changes] of [{'--starts-at':'2020-01-01T00:00:00.000Z'},{'--config':wrong},{'--config':duplicate},{'--config':secret},{'--cycles':'121'}].entries()){const output=join(directory,`rejected-${n}.json`),result=run(args(output,changes));assert.equal(result.status,1);assert.equal(existsSync(output),false);assert(!result.stderr.includes(credential));assert.equal(result.stdout,'');}
 const authority=run([...args(join(directory,'authority.json')),'--prepared-at','2020-01-01T00:00:00.000Z']);assert.equal(authority.status,1);assert.equal(existsSync(join(directory,'authority.json')),false);
});
test('private file rules refuse public permissions, symlinks, hardlinks, FIFO, checkout input, BOM and invalid UTF8',()=>{
 const publicPath=join(directory,'public.json');write(publicPath,{});chmodSync(publicPath,0o644);
 const symbolic=join(directory,'symbolic.json');symlinkSync(configPath,symbolic);
 const original=join(directory,'hard-original.json'),hard=join(directory,'hard.json');write(original,{});linkSync(original,hard);
 const fifo=join(directory,'fifo');assert.equal(spawnSync('mkfifo',[fifo],{timeout:2000}).status,0);
 const bom=join(directory,'bom.json');write(bom,'\uFEFF{}');const invalid=join(directory,'invalid.json');writeFileSync(invalid,Buffer.from([0xff]),{flag:'wx',mode:0o600});
 for(const path of [publicPath,symbolic,hard,fifo,resolve('package.json'),bom,invalid])assert.throws(()=>readPrivateForwardFile(path,69206016),/PRIVATE_FORWARD_FILE_UNAVAILABLE/);
 const empty=join(directory,'empty.body');write(empty,'');assert.throws(()=>readPrivateForwardBytes(empty,1024));assert.equal(readPrivateForwardBytes(empty,1024,{allowEmpty:true}).length,0);
});
test('exclusive publication allows empty raw body and complete >1MiB evidence without overwriting or following links',()=>{
 const path=join(directory,'large.json'),value={retained:'x'.repeat(2097152)},output=preparePrivateForwardOutput(path,68157440);try{output.write(value);}finally{output.close();}assert.deepEqual(JSON.parse(readPrivateForwardFile(path,68157440)),value);assert.throws(()=>preparePrivateForwardOutput(path,68157440));
 const empty=join(directory,'written-empty.body'),body=preparePrivateForwardOutput(empty,262144);try{body.writeBytes(Buffer.alloc(0));}finally{body.close();}assert.equal(readPrivateForwardBytes(empty,262144,{allowEmpty:true}).length,0);assert.equal(lstatSync(empty).mode&0o7777,0o600);
 const unsafe=join(directory,'output-link.json');symlinkSync(path,unsafe);assert.throws(()=>preparePrivateForwardOutput(unsafe,68157440));
 let invoked=false;const hook={toJSON(){invoked=true;return {};}};const guarded=preparePrivateForwardOutput(join(directory,'hook-output.json'),1024);try{assert.throws(()=>guarded.write(hook));assert.equal(invoked,false);}finally{guarded.close();}
});
test('pinned directory relocation refuses publication and preserves evidence rather than redirecting it',()=>{
 const parent=join(directory,'parent');mkdirSync(parent,{mode:0o700});const target=join(parent,'record.json'),output=preparePrivateForwardOutput(target,1024);renameSync(parent,parent+'-held');mkdirSync(parent,{mode:0o700});try{assert.throws(()=>output.write({retained:true}),/PRIVATE_FORWARD_FILE_UNAVAILABLE/);assert.equal(existsSync(target),false);assert.equal(existsSync(join(parent+'-held','record.json')),false);}finally{output.close();}
});
test('compiled fixed first-party module exposes reconstruction and freshness guard; arbitrary commands have no CLI route',async()=>{
 const model=await loadForwardDemoModules();await model.assertFresh();for(const name of ['createSessionJournal','appendSessionEvent','verifySessionJournal','reconstructSessionJournal','verifyForwardDemoPlan','verifyLockedSearchHandoff','parseUniqueJson'])assert.equal(typeof model[name],'function');
 const result=run(['execute','https://example.invalid','rm -rf anything']);assert.equal(result.status,1);assert.equal(result.stdout,'');assert(result.stderr.includes('Usage:'));
});
test('actual CLI detects input replacement after admission and guarded first-party mutation in an isolated copy',()=>{
 const privateConfig=join(directory,'mutable-config.json');write(privateConfig,f.config);const preload=join(directory,'input-fault.mjs');
 write(preload,"import {writeFileSync} from 'node:fs';const iso=Date.prototype.toISOString;let done=false;Date.prototype.toISOString=function(){const value=iso.call(this);if(!done){done=true;writeFileSync("+JSON.stringify(privateConfig)+","+JSON.stringify(JSON.stringify({...f.config,initialCapital:f.config.initialCapital+1}))+",{mode:0o600});}return value;};");
 const output=join(directory,'mutable-output.json'),changed=spawnSync(process.execPath,['--import',preload,cli,...args(output,{'--config':privateConfig})],{cwd:project,encoding:'utf8',timeout:30000,maxBuffer:65536});assert.equal(changed.status,1);assert.equal(changed.stdout,'');assert.equal(existsSync(output),false);
 const lateConfig=join(directory,'late-mutable-config.json'),lateOutput=join(directory,'late-mutable-output.json'),lateFault=join(directory,'late-input-fault.mjs');write(lateConfig,f.config);
 write(lateFault,"import {existsSync,writeFileSync} from 'node:fs';const iso=Date.prototype.toISOString;let done=false;Date.prototype.toISOString=function(){const value=iso.call(this);if(!done&&existsSync("+JSON.stringify(lateOutput)+")){done=true;writeFileSync("+JSON.stringify(lateConfig)+","+JSON.stringify(JSON.stringify({...f.config,initialCapital:f.config.initialCapital+1}))+",{mode:0o600});}return value;};");
 const late=spawnSync(process.execPath,['--import',lateFault,cli,...args(lateOutput,{'--config':lateConfig})],{cwd:project,encoding:'utf8',timeout:30000,maxBuffer:65536});assert.equal(late.status,1);assert.equal(late.stdout,'');assert(late.stderr.includes('PRIVATE_FORWARD_OUTPUT_UNCERTAIN'));assert.equal(existsSync(lateOutput),true,'A possibly committed original plan survives late input replacement.');assert.deepEqual(JSON.parse(readFileSync(lateOutput,'utf8')).config,f.config);assert.notDeepEqual(JSON.parse(readFileSync(lateConfig,'utf8')),f.config);
 const isolated=join(directory,'isolated');mkdirSync(isolated,{mode:0o700});mkdirSync(join(isolated,'app'));mkdirSync(join(isolated,'scripts'));mkdirSync(join(isolated,'node_modules'));
 for(const name of readdirSync(resolve('app')))if(name.endsWith('.ts'))copyFileSync(resolve('app',name),join(isolated,'app',name));
 for(const name of ['forward-demo-core.mjs','forward-demo-files.mjs','forward-demo.mjs'])copyFileSync(resolve('scripts',name),join(isolated,'scripts',name));
 for(const name of ['package.json','package-lock.json'])copyFileSync(resolve(name),join(isolated,name));cpSync(resolve('node_modules/zod'),join(isolated,'node_modules/zod'),{recursive:true});symlinkSync(resolve('node_modules/esbuild'),join(isolated,'node_modules/esbuild'));
 const source=join(isolated,'app/forward-demo-model.ts'),sourceFault=join(directory,'source-fault.mjs');write(sourceFault,"import {appendFileSync} from 'node:fs';const iso=Date.prototype.toISOString;let done=false;Date.prototype.toISOString=function(){const value=iso.call(this);if(!done){done=true;appendFileSync("+JSON.stringify(source)+",'\\n// injected isolated acceptance mutation\\n');}return value;};");
 const target=join(directory,'source-output.json'),result=spawnSync(process.execPath,['--import',sourceFault,join(isolated,'scripts/forward-demo.mjs'),...args(target)],{cwd:project,encoding:'utf8',timeout:30000,maxBuffer:65536});assert.equal(result.status,1,result.stderr);assert.equal(result.stdout,'');assert.equal(existsSync(target),false);assert(readFileSync(source,'utf8').includes('injected isolated acceptance mutation'),result.stderr);
});
