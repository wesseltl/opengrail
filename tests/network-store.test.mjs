import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id);new Function('module','exports','require',code)(m,m.exports,req);return m.exports;}
const model=load('app/network-model.ts'),{NetworkRepository}=load('app/network-store.ts');
const at='2026-10-11T06:00:00.000Z',later='2026-10-11T06:00:01.000Z',older='2026-10-11T05:59:59.000Z',uid=()=>crypto.randomUUID();
let db,mf;
before(async()=>{
 const worker=await build({stdin:{contents:`import {NetworkRepository} from './app/network-store.ts';export default {async fetch(request,env){const input=await request.json();try{const repo=new NetworkRepository(env.DB);const value=input.action==='authenticate'?await repo.authenticate(input.token,input.at):input.action==='list'?await repo.list(input.user,input.at):await repo.write(input.user,input.command,input.at);return Response.json(value);}catch(error){return Response.json({error:error.message},{status:error.status??503});}}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:worker.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{await db.prepare('DELETE FROM network_agents').run();});
after(async()=>await mf.dispose());
const repo=()=>new NetworkRepository(db),status=code=>error=>error instanceof model.NetworkError&&error.status===code;
async function register(days=7){const generated=await model.createNetworkToken();return {token:generated.token,command:{action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name:'Liquidity researcher',tokenDigest:generated.tokenDigest,days}};}
const revoke=agent=>({action:'revoke',requestId:uid(),id:agent.id,revision:1});
async function count(user){return (await db.prepare(user?'SELECT COUNT(*) AS n FROM network_agents WHERE owner_id=?':'SELECT COUNT(*) AS n FROM network_agents').bind(...user?[user]:[]).first()).n;}
async function row(user,id){return db.prepare('SELECT * FROM network_agents WHERE owner_id=? AND id=?').bind(user,id).first();}
function wrapper(beforeRun,afterRun,sqls=[]){return {prepare(sql){sqls.push(sql);const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const result=await statement.run();await afterRun?.(sql);return result;}});return wrap(db.prepare(sql));}};}

test('token generation has a random 256-bit secret and strict commands cannot claim extra permissions or include plaintext',async()=>{
 const tokens=await Promise.all(Array.from({length:20},()=>model.createNetworkToken()));assert.equal(new Set(tokens.map(value=>value.token)).size,20);assert.equal(new Set(tokens.map(value=>value.credentialId)).size,20);
 for(const value of tokens){assert.match(value.token,new RegExp('^og_agent_'+value.credentialId+'\\.[a-f0-9]{64}$'));assert.equal(value.tokenDigest,await model.networkDigest(value.token));}
 const {command,token}=await register();model.networkCommandSchema.parse(command);
 for(const extra of [{token},{ownerId:'another human'},{scope:'EXECUTE'},{permissions:['ALL']},{expiresAt:later},{verified:true}])assert.equal(model.networkCommandSchema.safeParse({...command,...extra}).success,false);
 for(const days of [0,2,31,1000,'7'])assert.equal(model.networkCommandSchema.safeParse({...command,days}).success,false);
 for(const name of ['', 'x'.repeat(49),'bad\nname'])assert.equal(model.networkCommandSchema.safeParse({...command,name}).success,false);
 assert.throws(()=>model.boundedNetworkAgent({}),/./);await assert.rejects(()=>model.createNetworkToken('not-a-uuid'),/./);
});

test('a signed-in sponsor registration retains bounded canonical identity with only safe listing and write receipts',async()=>{
 const user=uid(),r=repo();assert.deepEqual((await r.list(user,at)).agents,[]);
 for(const days of [1,7,30]){
  const {command,token}=await register(days),written=await r.write(user,command,at),agent=written.agent,stored=await row(user,agent.id);
  model.networkWriteSchema.parse(written);assert.equal(written.executionEnabled,false);assert.equal(agent.scope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(agent.revision,1);assert.equal(agent.revokedAt,null);assert.equal(agent.revocationRequestId,null);assert.equal(agent.registrationRequestId,command.requestId);assert.equal(agent.createdAt,at);assert.equal(Date.parse(agent.expiresAt)-Date.parse(at),days*86400000);
  assert.equal(stored.payload,JSON.stringify(agent));assert.equal(stored.digest,await model.networkDigest(stored.payload));assert.equal(stored.registration_digest,await model.networkDigest(JSON.stringify(command)));assert.equal(stored.token_digest,command.tokenDigest);
  assert(!JSON.stringify(stored).includes(token));assert(!JSON.stringify(written).includes(command.tokenDigest));assert(!JSON.stringify(written).includes(user));
 }
 const listed=await r.list(user,at);model.networkListSchema.parse(listed);assert.equal(listed.agents.length,3);assert.equal(listed.maximumPerUser,8);assert.equal(listed.maximumNetwork,1000);assert(!JSON.stringify(listed).includes('owner_id'));assert(!JSON.stringify(listed).includes('token_digest'));
});

test('registration retries preserve original receipts, changed bodies conflict and concurrent same-command delivery creates one row',async()=>{
 const user=uid(),r=repo(),{command}=await register(),first=await r.write(user,command,at);
 assert.deepEqual(await r.write(user,command,later),first);assert.equal(await count(user),1);
 for(const extra of [{name:'Another agent'},{days:30},{tokenDigest:'f'.repeat(64)},{id:uid()},{credentialId:uid()}])await assert.rejects(()=>r.write(user,{...command,...extra},later),status(409));
 const next=await register(),writes=await Promise.all([r.write(user,next.command,at),r.write(user,next.command,later)]);assert.deepEqual(writes[0],writes[1]);assert.equal(await count(user),2);
 const rev=await r.write(user,revoke(first.agent),later);assert.equal(rev.agent.revision,2);assert.deepEqual(await r.write(user,command,later),first);assert.equal((await r.list(user,later)).agents.find(a=>a.id===first.agent.id).revision,2);
});

test('sponsor isolation and globally unique agent and credential IDs do not expose foreign registrations',async()=>{
 const alice=uid(),bob=uid(),r=repo(),{command}=await register(),first=await r.write(alice,command,at);
 assert.deepEqual((await r.list(bob,at)).agents,[]);
 for(const id of [first.agent.id,uid()])await assert.rejects(()=>r.write(bob,{action:'revoke',requestId:uid(),id,revision:1},later),status(404));
 await assert.rejects(()=>r.write(bob,command,at),status(409));assert.equal(await count(bob),0);
 const duplicate=await register();duplicate.command.id=first.agent.id;await assert.rejects(()=>r.write(bob,duplicate.command,at),error=>error.status===409&&!error.message.includes(alice)&&!error.message.includes(first.agent.credentialId));assert.equal(await count(bob),0);
 const own=await register(),receipt=await r.write(bob,own.command,at);assert.notEqual(receipt.agent.id,first.agent.id);assert(!JSON.stringify(receipt).includes(alice));assert(!JSON.stringify(receipt).includes(bob));assert.equal(await count(bob),1);assert.equal(await count(alice),1);
});

test('revocation is irreversible, expected-revision fenced and exactly idempotent after a lost or repeated request',async()=>{
 const user=uid(),r=repo(),{command,token}=await register(),first=await r.write(user,command,at),request=revoke(first.agent);
 await assert.rejects(()=>r.write(user,request,older),status(409));
 const revoked=await r.write(user,request,later);assert.equal(revoked.agent.revision,2);assert.equal(revoked.agent.revokedAt,later);assert.equal(revoked.agent.revocationRequestId,request.requestId);assert.equal(revoked.agent.registrationRequestId,first.agent.registrationRequestId);
 assert.deepEqual(await r.write(user,request,'2026-10-12T06:00:00.000Z'),revoked);await assert.rejects(()=>r.write(user,revoke(first.agent),later),status(409));await assert.rejects(()=>r.authenticate(token,later),status(401));
 const next=await register(),second=await r.write(user,next.command,at),race=await Promise.allSettled([r.write(user,revoke(second.agent),later),r.write(user,revoke(second.agent),later)]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal(race.filter(x=>x.status==='rejected').length,1);
});

test('request UUIDs are exclusive across register and revoke, including racing different actions',async()=>{
 const user=uid(),r=repo(),a=await register(),first=await r.write(user,a.command,at);
 await assert.rejects(()=>r.write(user,{action:'revoke',requestId:a.command.requestId,id:first.agent.id,revision:1},later),status(409));
 const revokedCommand=revoke(first.agent);await r.write(user,revokedCommand,later);const b=await register();b.command.requestId=revokedCommand.requestId;await assert.rejects(()=>r.write(user,b.command,later),status(409));
 const c=await register(),third=await r.write(user,c.command,at),d=await register(),shared=uid();d.command.requestId=shared;const results=await Promise.allSettled([r.write(user,d.command,later),r.write(user,{action:'revoke',requestId:shared,id:third.agent.id,revision:1},later)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
 const rows=(await db.prepare('SELECT registration_request_id,revocation_request_id FROM network_agents WHERE owner_id=?').bind(user).all()).results;assert.equal(rows.filter(row=>row.registration_request_id===shared||row.revocation_request_id===shared).length,1);
});

test('authentication requires the whole credential and rejects expiry, pre-registration time and malformed tokens',async()=>{
 const user=uid(),r=repo(),{command,token}=await register(1),first=await r.write(user,command,at),principal=await r.authenticate(token,at),stored=await row(user,first.agent.id);
 assert.deepEqual(principal,{ownerId:user,agentId:first.agent.id,credentialId:first.agent.credentialId,name:first.agent.name,registryDigest:stored.digest,tokenDigest:stored.token_digest,payload:stored.payload,expiresAt:first.agent.expiresAt});
 assert.equal((await r.authenticate(token,'2026-10-12T05:59:59.999Z')).agentId,first.agent.id);
 for(const stamp of [older,first.agent.expiresAt,'2026-10-13T06:00:00.000Z'])await assert.rejects(()=>r.authenticate(token,stamp),status(401));
 const changed=token.slice(0,-1)+(token.endsWith('0')?'1':'0');
 for(const bad of ['',changed,'Bearer '+token,token.toUpperCase(),token.replace(command.credentialId,uid()),'a'.repeat(200),null])await assert.rejects(()=>r.authenticate(bad,at),status(401));
 for(const stamp of ['2026-10-11','bad',null])await assert.rejects(()=>r.authenticate(token,stamp),status(400));
});

test('eight retained registrations are enforced atomically and revocation never frees quota',async()=>{
 const user=uid(),r=repo();for(let n=0;n<7;n++)await r.write(user,(await register()).command,at);
 const requests=await Promise.all(Array.from({length:4},()=>register())),results=await Promise.allSettled(requests.map(value=>r.write(user,value.command,at)));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(await count(user),8);
 const saved=results.find(x=>x.status==='fulfilled').value;await r.write(user,revoke(saved.agent),later);await assert.rejects(()=>r.write(user,(requests.find((_,i)=>results[i].status==='rejected')).command,later),status(409));assert.equal(await count(user),8);
});

test('committed register and revoke writes reconcile lost acknowledgements; before-commit failures do not invent receipts',async()=>{
 const user=uid(),{command}=await register();let loseRegister=true;
 const lost=new NetworkRepository(wrapper(null,sql=>{if(sql.startsWith('INSERT')&&loseRegister){loseRegister=false;throw Error('lost registration acknowledgement');}}));const first=await lost.write(user,command,at);assert.equal(await count(user),1);assert.deepEqual(await repo().write(user,command,at),first);
 let loseRevoke=true;const request=revoke(first.agent),lostRev=new NetworkRepository(wrapper(null,sql=>{if(sql.startsWith('UPDATE')&&loseRevoke){loseRevoke=false;throw Error('lost revocation acknowledgement');}}));const second=await lostRev.write(user,request,later);assert.equal(second.agent.revision,2);assert.deepEqual(await repo().write(user,request,later),second);
 const missing=await register(),failed=new NetworkRepository(wrapper(sql=>{if(sql.startsWith('INSERT'))throw Error('before commit');}));await assert.rejects(()=>failed.write(user,missing.command,at),/before commit/);assert.equal(await count(user),1);await repo().write(user,missing.command,at);assert.equal(await count(user),2);
});

test('corrupt hashes, duplicated metadata, authority, canonical bytes and oversized retained material are held without repair',async()=>{
 const user=uid(),r=repo(),{command,token}=await register(),first=await r.write(user,command,at),stored=await row(user,first.agent.id);
 const changes=[{digest:'0'.repeat(64)},{registration_digest:'0'.repeat(64)},{created_at:later},{expires_at:later},{revision:2},{credential_id:uid()},{registration_request_id:uid()},{payload:' '+stored.payload},{payload:'{"id":"duplicate",'+stored.payload.slice(1)},{payload:stored.payload.replace('PUBLIC_RESEARCH_SUBMIT','EXECUTE')},{payload:'x'.repeat(4097)},{payload:'é'.repeat(2049)}];
 for(const changed of changes){
  const column=Object.keys(changed)[0];await db.prepare(`UPDATE network_agents SET ${column}=? WHERE owner_id=? AND id=?`).bind(changed[column],user,first.agent.id).run();
  await assert.rejects(()=>r.list(user,at),status(503));await assert.rejects(()=>r.write(user,revoke(first.agent),later),status(503));await assert.rejects(()=>r.authenticate(token,at),error=>error.status===503||error.status===401);
  assert.equal((await row(user,first.agent.id))[column],changed[column]);await db.prepare(`UPDATE network_agents SET ${column}=? WHERE owner_id=? AND id=?`).bind(stored[column],user,first.agent.id).run();
 }
 assert.equal((await r.list(user,at)).agents.length,1);
});

test('revocation fences the exact checked record rather than overwriting concurrent registry corruption',async()=>{
 const user=uid(),r=repo(),{command}=await register(),first=await r.write(user,command,at);let changed=false;
 const racing=new NetworkRepository(wrapper(async sql=>{if(sql.startsWith('UPDATE')&&!changed){changed=true;await db.prepare('UPDATE network_agents SET digest=? WHERE owner_id=? AND id=?').bind('f'.repeat(64),user,first.agent.id).run();}}));
 await assert.rejects(()=>racing.write(user,revoke(first.agent),later),status(503));const stored=await row(user,first.agent.id);assert.equal(stored.revision,1);assert.equal(stored.revoked_at,null);assert.equal(stored.digest,'f'.repeat(64));
});

test('Worker runtime uses the real D1 store and secure comparison with no owner identity header assumption',async()=>{
 const user=uid(),{command,token}=await register();const write=await mf.dispatchFetch('http://fixture.test/',{method:'POST',body:JSON.stringify({user,command,at})});assert.equal(write.status,200);const receipt=await write.json();assert.equal(receipt.agent.id,command.id);
 const authenticated=await mf.dispatchFetch('http://fixture.test/',{method:'POST',body:JSON.stringify({action:'authenticate',token,at})});assert.equal(authenticated.status,200);assert.equal((await authenticated.json()).agentId,command.id);
 await repo().write(user,revoke(receipt.agent),later);const denied=await mf.dispatchFetch('http://fixture.test/',{method:'POST',body:JSON.stringify({action:'authenticate',token,at:later})});assert.equal(denied.status,401);
 assert.equal((await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results.some(value=>/financial|capital|execution|account/.test(value.name)),false);
});

test('global retained-registration cap arbitrates the final slot across different sponsors',async()=>{
 const baseUser=uid(),r=repo(),base=await register(),first=await r.write(baseUser,base.command,at),stored=await row(baseUser,first.agent.id);
 const inserts=[];
 for(let n=0;n<998;n++){
  const user=uid(),id=uid(),credentialId=uid(),requestId=uid(),agent={...first.agent,id,credentialId,registrationRequestId:requestId},payload=JSON.stringify(agent),command={...base.command,id,credentialId,requestId};
  inserts.push(db.prepare('INSERT INTO network_agents(owner_id,id,credential_id,registration_request_id,registration_digest,token_digest,payload,digest,revision,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)').bind(user,id,credentialId,requestId,await model.networkDigest(JSON.stringify(command)),stored.token_digest,payload,await model.networkDigest(payload),at,agent.expiresAt));
 }
 for(let n=0;n<inserts.length;n+=50)await db.batch(inserts.slice(n,n+50));assert.equal(await count(),999);
 const a=await register(),b=await register(),results=await Promise.allSettled([r.write(uid(),a.command,at),r.write(uid(),b.command,at)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(await count(),1000);assert.deepEqual(await r.write(baseUser,base.command,later),first);
});
