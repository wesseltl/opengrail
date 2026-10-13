import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id);new Function('module','exports','require',code)(m,m.exports,req);return m.exports;}
const {createNetworkToken,networkDigest}=load('app/network-model.ts'),{NetworkRepository}=load('app/network-store.ts'),{networkOwnerRequest,networkAgentRequest}=load('app/network-http.ts');
const at='2026-10-11T16:00:00.000Z';
// Real handlers, D1 and Web Crypto; X-Fixture-Actor is not production SIWC authentication.
const source=`import {networkOwnerRequest,networkAgentRequest} from './app/network-http';
import {NetworkRepository} from './app/network-store';
export default {fetch(request,env){
 const factory=()=>new NetworkRepository(env.DB);
 if(new URL(request.url).pathname==='/api/network/agent')return networkAgentRequest(request,factory,()=>env.FIXTURE_AT);
 const user=request.headers.get('X-Fixture-Actor');return networkOwnerRequest(request,user?{userId:user}:null,factory,()=>env.FIXTURE_AT);
}};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at}});let db;
before(async()=>{db=await mf.getD1Database('DB');for(const name of readdirSync('drizzle').filter(v=>v.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
after(async()=>await mf.dispose());
const user=()=>crypto.randomUUID();
const command=async()=>{const key=await createNetworkToken();return {token:key.token,command:{action:'register',requestId:crypto.randomUUID(),id:crypto.randomUUID(),credentialId:key.credentialId,name:'Independent research agent',tokenDigest:key.tokenDigest,days:7}};};
const headers=u=>({'X-Fixture-Actor':u,Origin:'https://network.test','Content-Type':'application/json','X-Network-Intent':'onboard'});
const get=u=>mf.dispatchFetch('https://network.test/api/network/agents',{headers:headers(u)});
const post=(u,raw,extra={})=>mf.dispatchFetch('https://network.test/api/network/agents',{method:'POST',headers:{...headers(u),...extra},body:typeof raw==='string'?raw:JSON.stringify(raw)});
const identity=(token,extra={})=>mf.dispatchFetch('https://network.test/api/network/agent',{headers:{Authorization:'Bearer '+token,...extra}});
const repository=()=>new NetworkRepository(db);

test('any signed-in sponsor can enroll an agent; anonymous registration has no storage access',async()=>{
 const u=user(),key=await command(),response=await post(u,key.command);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.match(response.headers.get('Vary'),/Authorization/);const first=await response.json();
 assert.equal(first.agent.id,key.command.id);assert.equal(first.agent.scope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(first.executionEnabled,false);assert.deepEqual(await (await post(u,key.command)).json(),first);
 assert.deepEqual((await (await get(u)).json()).agents,[first.agent]);assert.deepEqual((await (await get(user())).json()).agents,[]);
 assert.equal((await post('',key.command)).status,401);let calls=0;assert.equal((await networkOwnerRequest(new Request('https://network.test/api/network/agents'),null,()=>{calls++;throw Error();})).status,401);assert.equal(calls,0);
});

test('Bearer authentication returns only registered agent identity, never sponsor/hash/secret',async()=>{
 const u=user(),key=await command();await post(u,key.command);const response=await identity(key.token);assert.equal(response.status,200);const body=await response.json();
 assert.deepEqual(body,{version:1,agent:{id:key.command.id,name:key.command.name,credentialId:key.command.credentialId,expiresAt:'2026-10-18T16:00:00.000Z',scope:'PUBLIC_RESEARCH_SUBMIT'},executionEnabled:false});
 const payload=JSON.stringify(body);for(const value of [u,key.token,key.command.tokenDigest,'ownerId','registryDigest','tokenDigest'])assert(!payload.includes(value));
 const row=await db.prepare('SELECT * FROM network_agents WHERE owner_id=? AND id=?').bind(u,key.command.id).first();assert(!JSON.stringify(row).includes(key.token));assert(!JSON.stringify(row).includes(key.token.split('.')[1]));assert.equal(row.token_digest,await networkDigest(key.token));
});

test('agent credentials do not grant sponsor administration or permission changes',async()=>{
 const u=user(),key=await command();await post(u,key.command);
 assert.equal((await mf.dispatchFetch('https://network.test/api/network/agents',{headers:{Authorization:'Bearer '+key.token}})).status,401);
 assert.equal((await mf.dispatchFetch('https://network.test/api/network/agents',{method:'POST',headers:{...headers(''),Authorization:'Bearer '+key.token},body:JSON.stringify({action:'revoke',requestId:crypto.randomUUID(),id:key.command.id,revision:1})})).status,401);
 for(const patch of [{ownerId:u},{scope:'TRADE'},{permissions:['ADMIN']},{apiKey:'secret'},{privateWorkspaceId:'foreign'},{token:key.token},{executionEnabled:true}])assert.equal((await post(u,{...key.command,requestId:crypto.randomUUID(),...patch})).status,400);
 assert.equal((await identity(key.token)).status,200);
});

test('revocation is scoped, idempotent and prevents further credential authentication',async()=>{
 const u=user(),key=await command();await post(u,key.command);const cmd={action:'revoke',requestId:crypto.randomUUID(),id:key.command.id,revision:1};
 assert.equal((await post(user(),cmd)).status,404);assert.equal((await identity(key.token)).status,200);
 const response=await post(u,cmd);assert.equal(response.status,200);const revoked=await response.json();assert.equal(revoked.agent.revision,2);assert.equal(revoked.agent.revokedAt,at);assert.deepEqual(await (await post(u,cmd)).json(),revoked);assert.equal((await identity(key.token)).status,401);
 assert.equal((await (await get(u)).json()).agents[0].revision,2);assert.equal((await (await post(u,key.command)).json()).agent.revision,1);assert.equal((await identity(key.token)).status,401);
});

test('origin/intent/content-type/method/query boundaries reject invalid writes before registration',async()=>{
 const u=user(),key=await command();
 for(const patch of [{Origin:'https://foreign.test'},{Origin:''},{'X-Network-Intent':''}])assert.equal((await post(u,key.command,patch)).status,403);
 assert.equal((await post(u,key.command,{'Content-Type':'text/plain'})).status,415);
 const deletion=await mf.dispatchFetch('https://network.test/api/network/agents',{method:'DELETE',headers:headers(u)});assert.equal(deletion.status,405);assert.equal(deletion.headers.get('Allow'),'GET, POST');
 for(const query of ['?ownerId='+u,'?token=hidden','?id='+key.command.id])assert.equal((await mf.dispatchFetch('https://network.test/api/network/agents'+query,{headers:headers(u)})).status,400);
 assert.equal((await (await get(u)).json()).agents.length,0);
});

test('bounded duplicate-safe JSON rejects malformed, oversized and invalid UTF8 bodies',async()=>{
 const u=user(),key=await command();
 for(const [raw,status] of [['{',400],[' '.repeat(8193),413],[JSON.stringify(key.command).replace('"days":7','"days":7,"days":1'),400]])assert.equal((await post(u,raw)).status,status);
 const bytes=new Uint8Array([123,34,110,97,109,101,34,58,34,255,34,125]);const response=await networkOwnerRequest(new Request('https://network.test/api/network/agents',{method:'POST',headers:headers(u),body:bytes}),{userId:u},repository,()=>at);assert.equal(response.status,400);assert.equal((await (await get(u)).json()).agents.length,0);
});

test('identity endpoint rejects missing/malformed/foreign/expired credentials and token-bearing URLs',async()=>{
 const u=user(),key=await command();await post(u,key.command);
 for(const token of ['',key.token.slice(0,-1),key.token.slice(0,-1)+(key.token.endsWith('a')?'b':'a'),(await command()).token])assert.equal((await identity(token)).status,401);
 const response=await identity(key.token,{Origin:'https://foreign.test'});assert.equal(response.status,403);
 assert.equal((await mf.dispatchFetch('https://network.test/api/network/agent?token='+encodeURIComponent(key.token))).status,400);
 const expired=await networkAgentRequest(new Request('https://network.test/api/network/agent',{headers:{Authorization:'Bearer '+key.token}}),repository,()=>'2026-10-18T16:00:00.000Z');assert.equal(expired.status,401);assert.equal(expired.headers.get('WWW-Authenticate'),'Bearer');
 assert.equal((await mf.dispatchFetch('https://network.test/api/network/agent',{method:'POST',headers:{Authorization:'Bearer '+key.token}})).status,405);
});

test('transport holds schema-valid registration and revocation receipts for different commands',async()=>{
 const u=user(),key=await command(),r=repository(),good=await r.write(u,key.command,at),request=raw=>new Request('https://network.test/api/network/agents',{method:'POST',headers:headers(u),body:JSON.stringify(raw)});
 for(const patch of [{id:crypto.randomUUID()},{credentialId:crypto.randomUUID()},{name:'Foreign name'},{registrationRequestId:crypto.randomUUID()},{expiresAt:'2026-11-10T16:00:00.000Z'}]){
  const fake=()=>({write:async()=>({...good,agent:{...good.agent,...patch}})});assert.equal((await networkOwnerRequest(request(key.command),{userId:u},fake,()=>at)).status,503);
 }
 const revoke={action:'revoke',requestId:crypto.randomUUID(),id:key.command.id,revision:1},revoked=await r.write(u,revoke,at),fake=()=>({write:async()=>({...revoked,agent:{...revoked.agent,revocationRequestId:crypto.randomUUID()}})});assert.equal((await networkOwnerRequest(request(revoke),{userId:u},fake,()=>at)).status,503);
});

test('identity transport holds mismatched credential or malformed principal data',async()=>{
 const u=user(),key=await command(),r=repository();await r.write(u,key.command,at);const good=await r.authenticate(key.token,at),request=()=>new Request('https://network.test/api/network/agent',{headers:{Authorization:'Bearer '+key.token}});
 for(const patch of [{credentialId:crypto.randomUUID()},{name:undefined},{expiresAt:'2026-10-10T16:00:00.000Z'}])assert.equal((await networkAgentRequest(request(),()=>({authenticate:async()=>({...good,...patch})}),()=>at)).status,503);
});

test('corrupted stored data is held without deletion and errors reveal no credentials',async()=>{
 const u=user(),key=await command();await post(u,key.command);await db.prepare('UPDATE network_agents SET payload=? WHERE owner_id=? AND id=?').bind('{}',u,key.command.id).run();
 const read=await get(u);assert.equal(read.status,503);const auth=await identity(key.token);assert.equal(auth.status,503);for(const response of [read,auth]){const body=await response.text();assert(!body.includes(key.token));assert(!body.includes(key.command.tokenDigest));}
 assert.equal((await db.prepare('SELECT payload FROM network_agents WHERE owner_id=? AND id=?').bind(u,key.command.id).first()).payload,'{}');
});


test('identity requires HTTPS before repository lookup even for an otherwise valid registered credential',async()=>{
 const u=user(),key=await command();await post(u,key.command);
 const plain=await mf.dispatchFetch('http://network.test/api/network/agent',{headers:{Authorization:'Bearer '+key.token}});
 assert.equal(plain.status,403);assert.equal(plain.headers.get('Cache-Control'),'private, no-store');
 const refused=await plain.json();assert.deepEqual(refused,{error:'Agent credentials require HTTPS.'});
 assert(!JSON.stringify(refused).includes(key.token));assert(!JSON.stringify(refused).includes(key.command.tokenDigest));
 let factoryCalls=0,authenticationCalls=0;
 const factory=()=>{factoryCalls++;return {authenticate:async()=>{authenticationCalls++;throw Error('Unexpected credential lookup.');}};};
 for(const scheme of ['http:','ftp:']){
  const response=await networkAgentRequest(new Request(scheme+'//network.test/api/network/agent',{headers:{Authorization:'Bearer '+key.token}}),factory,()=>at);
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Agent credentials require HTTPS.'});
 }
 assert.equal(factoryCalls,0);assert.equal(authenticationCalls,0);
 const secure=await identity(key.token);assert.equal(secure.status,200);
 const confirmed=await secure.json();assert.equal(confirmed.agent.id,key.command.id);assert.equal(confirmed.agent.credentialId,key.command.credentialId);
 assert.equal(confirmed.agent.scope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(confirmed.executionEnabled,false);
});
