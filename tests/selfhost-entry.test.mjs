import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Actual production standalone entry + resolver + registry routes and D1.
// Only the framework presentation and external provider are first-party fixtures.
// RSA keys, authorization codes and cookies are synthetic and memory-only.
const origin = 'https://selfhost.test', issuer = 'https://identity.opengrail.invalid';
const clientId = 'synthetic-opengrail-client', clientSecret = 'synthetic-local-provider-secret';
const tokenEndpoint = issuer + '/token', jwksEndpoint = issuer + '/keys';
const metadata = { issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: tokenEndpoint,
  jwks_uri: jwksEndpoint, authorization_response_iss_parameter_supported: true,
  code_challenge_methods_supported: ['S256'], id_token_signing_alg_values_supported: ['RS256'] };
let mf, authDb, registryDb, signingKey, jwk, workerScript;
const grants = new Map(); let outbound = [], failProvider = false;
const dispatch=(url,init={})=>mf.dispatchFetch(url,{...init,redirect:'manual'});
const base64 = value => Buffer.from(typeof value === 'string' ? value : new Uint8Array(value)).toString('base64url');
async function sign(claims, corrupt = false) {
  const encoded = base64(JSON.stringify({ alg: 'RS256', kid: 'synthetic-key', typ: 'JWT' })) + '.' + base64(JSON.stringify(claims));
  const bytes = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(encoded)));
  if (corrupt) bytes[0] ^= 1;
  return encoded + '.' + base64(bytes);
}
async function provider(request) {
  const url = new URL(request.url); outbound.push({url: url.href, method: request.method});
  if (failProvider) return new Response(null, {status: 503});
  if (url.href === jwksEndpoint && request.method === 'GET') return Response.json({ keys: [jwk] });
  if (url.href !== tokenEndpoint || request.method !== 'POST') throw Error('Unexpected fixture provider request.');
  const authorization = request.headers.get('Authorization');
  assert(authorization?.startsWith('Basic '), 'OAuth client credentials must use Basic authentication.');
  const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const separator = credentials.indexOf(':');
  assert(separator > 0, 'Basic authentication must contain both encoded credentials.');
  const decodeCredential = value => decodeURIComponent(value.replace(/\+/g, ' '));
  assert.equal(decodeCredential(credentials.slice(0, separator)), clientId);
  assert.equal(decodeCredential(credentials.slice(separator + 1)), clientSecret);
  const form = new URLSearchParams(await request.text()), grant = grants.get(form.get('code'));
  assert(grant, 'Actual authorization code is required.');
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('redirect_uri'), origin + '/auth/callback');
  const challenge = base64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.get('code_verifier'))));
  assert.equal(challenge, grant.challenge, 'Actual token exchange must prove the original S256 verifier.');
  grants.delete(form.get('code'));
  const now = Math.floor(Date.now()/1000);
  const claims = { iss: issuer, aud: clientId, sub: grant.subject, iat: now, exp: now + 300,
    nonce: grant.nonce, email: 'same-signed-email@fixture.invalid', email_verified: true, name: 'Synthetic human', ...grant.patch };
  return Response.json({ access_token: 'unused-synthetic-access-token', token_type: 'Bearer', expires_in: 300,
    id_token: await sign(claims, grant.corrupt) });
}
const framework = `
import { getChatGPTUser } from './app/chatgpt-auth';
import { getHumanAuthContext } from './lib/human-auth-context';
import * as enrollment from './app/api/network/agents/route';
import * as machine from './app/api/network/agent/route';
export default {async fetch(request,env) {
 const url=new URL(request.url);
 if(url.pathname==='/fixture/reject') throw Error('Synthetic presentation failure.');
 if(url.pathname==='/api/network/agents') return (request.method==='POST'?enrollment.POST:enrollment.GET)(request);
 if(url.pathname==='/api/network/agent') return machine.GET(request);
 const first=await getChatGPTUser();
 if(url.pathname==='/fixture/recheck') {
  const barrier=url.searchParams.get('barrier');
  if(barrier) {
   await env.AUTH_DB.prepare('INSERT INTO fixture_barriers(id,released) VALUES(?,0)').bind(barrier).run();
   const deadline=Date.now()+5000;
   while(!(await env.AUTH_DB.prepare('SELECT released FROM fixture_barriers WHERE id=?').bind(barrier).first()).released) {
    if(Date.now()>=deadline)throw Error('Synthetic recheck barrier deadline.');
    await new Promise(resolve=>setTimeout(resolve,20));
   }
  } else await new Promise(resolve=>setTimeout(resolve,150));
 }
 const second=await getChatGPTUser();
 return Response.json({first:first?.userId??null,second:second?.userId??null,kind:getHumanAuthContext()?.kind??null,
  callerIdentityHeaders:[...request.headers.keys()].filter(name=>name.startsWith('oai-authenticated-user-'))});
}};`;

before(async () => {
  const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  signingKey = pair.privateKey; jwk = {...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic-key',alg:'RS256',use:'sig'};
  const bundled = await build({entryPoints:['build/selfhost-worker.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',
    external:['node:async_hooks','node:crypto','cloudflare:workers'],write:false,
    plugins:[{name:'first-party-presentation-fixture',setup(b){
      b.onResolve({filter:/^vinext\/server\/fetch-handler$/},()=>({path:'framework-fixture',namespace:'first-party'}));
      b.onLoad({filter:/.*/,namespace:'first-party'},()=>({contents:framework,resolveDir:process.cwd(),loader:'ts'}));
      b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation-fixture',namespace:'first-party-navigation'}));
      b.onLoad({filter:/.*/,namespace:'first-party-navigation'},()=>({contents:'export function redirect(){throw Error("Unexpected fixture redirect.");}',loader:'js'}));
    }}]});
  workerScript=bundled.outputFiles[0].text;
  mf = new Miniflare({cf:false,modules:true,script:workerScript,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
    d1Databases:['DB','AUTH_DB'],outboundService:provider,bindings:{OPENGRAIL_EXTERNAL_ORIGIN:origin,
      OPENGRAIL_OIDC_CLIENT_ID:clientId,OPENGRAIL_OIDC_CLIENT_SECRET:clientSecret,OPENGRAIL_OIDC_METADATA:JSON.stringify(metadata),
      OPENGRAIL_AUTH_EPOCH:'a'.repeat(64)}});
  authDb = await mf.getD1Database('AUTH_DB'); registryDb = await mf.getD1Database('DB');
  for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()) {
    for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint')) if(sql.trim())await registryDb.prepare(sql).run();
  }
  for(const sql of readFileSync('selfhost/migrations/0001_identity.sql','utf8').split('--> statement-breakpoint')) if(sql.trim())await authDb.prepare(sql).run();
  await authDb.prepare('CREATE TABLE fixture_barriers(id TEXT PRIMARY KEY,released INTEGER NOT NULL)').run();
});
beforeEach(async () => {
  grants.clear(); outbound = []; failProvider = false;
  const tables = (await authDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results;
  tables.sort((a,b)=>(a.name==='og_auth_sessions'?-1:a.name==='og_auth_flows'?1:0)-(b.name==='og_auth_sessions'?-1:b.name==='og_auth_flows'?1:0));
  for(const {name} of tables){assert.match(name,/^[a-zA-Z_][a-zA-Z0-9_]*$/);await authDb.prepare('DELETE FROM '+name).run();}
  await registryDb.prepare('DELETE FROM network_agents').run();
});
after(async () => { if(mf)await mf.dispose(); signingKey=undefined; grants.clear(); });
function cookies(response) {
  return response.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>!value.endsWith('='));
}
const spoof = {'OAI-Authenticated-User-Id':'forged-owner','oai-authenticated-user-email':'forged@fixture.invalid',
  'oai-authenticated-user-full-name':'forged-name','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};
async function start(subject='human-alpha', patch={}, corrupt=false) {
  const response=await dispatch(origin+'/auth/signin?return_to=%2Fapi%2Fnetwork%2Fagents',{headers:{'Sec-Fetch-Site':'same-origin'}});
  assert.equal(response.status,302); const target=new URL(response.headers.get('Location'));
  assert.equal(target.origin,issuer);assert.equal(target.searchParams.get('client_id'),clientId);
  assert.equal(target.searchParams.get('redirect_uri'),origin+'/auth/callback');assert.equal(target.searchParams.get('code_challenge_method'),'S256');
  assert(target.searchParams.get('nonce'));assert(target.searchParams.get('state'));assert(target.searchParams.get('code_challenge'));
  const code=crypto.randomUUID();grants.set(code,{subject,patch,corrupt,nonce:target.searchParams.get('nonce'),challenge:target.searchParams.get('code_challenge')});
  const callback=origin+'/auth/callback?'+new URLSearchParams({code,state:target.searchParams.get('state'),iss:issuer});
  return {callback,cookie:cookies(response).join('; '),state:target.searchParams.get('state')};
}
async function finish(flow, extra={}) { return dispatch(flow.callback,{headers:{Cookie:flow.cookie,...extra}}); }
async function login(subject='human-alpha',patch={}) {
  const response=await finish(await start(subject,patch));assert.equal(response.status,302);
  const cookie=cookies(response).join('; ');assert(cookie.includes('__Host-'));return cookie;
}
const identify = cookie=>dispatch(origin+'/',{headers:{...spoof,...(cookie?{Cookie:cookie}:{})}});
const registration=()=>({action:'register',requestId:crypto.randomUUID(),id:crypto.randomUUID(),credentialId:crypto.randomUUID(),
  name:'Synthetic research agent',tokenDigest:'b'.repeat(64),days:1});
const post = (cookie,command,extra={})=>dispatch(origin+'/api/network/agents',{method:'POST',headers:{Cookie:cookie,
  Origin:origin,'Content-Type':'application/json','X-Network-Intent':'onboard',...spoof,...extra},body:JSON.stringify(command)});

test('direct entry strips all complete, partial and duplicate caller identity headers and remains anonymous',async()=>{
  for(const headers of [spoof,{'Oai-Authenticated-User-Id':'forged-owner'},{...spoof,'oai-authenticated-user-id':'first, second'},{Cookie:'__sites_local_auth=1',...spoof}]){
    const result=await(await dispatch(origin+'/',{headers})).json();assert.equal(result.first,null);assert.equal(result.second,null);assert.equal(result.kind,'SELF_HOSTED');assert.deepEqual(result.callerIdentityHeaders,[]);
    assert.equal((await dispatch(origin+'/api/network/agents',{method:'POST',headers,body:'{}'})).status,401);
  }
  assert.equal((await registryDb.prepare('SELECT COUNT(*) AS n FROM network_agents').first()).n,0);assert.equal(outbound.length,0);
});
test('real S256 code exchange and RS256/JWKS verification establish the actor used by the actual sponsor route',async()=>{
  const cookie=await login(),identity=await(await identify(cookie)).json();assert(identity.first);assert.equal(identity.first,identity.second);assert.notEqual(identity.first,'forged-owner');assert.deepEqual(identity.callerIdentityHeaders,[]);
  assert(outbound.some(r=>r.url===tokenEndpoint));assert(outbound.some(r=>r.url===jwksEndpoint));
  const command=registration(),response=await post(cookie,command);assert.equal(response.status,200);const body=await response.json();assert.equal(body.agent.scope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(body.executionEnabled,false);
  const row=await registryDb.prepare('SELECT owner_id FROM network_agents WHERE id=?').bind(command.id).first();assert.equal(row.owner_id,identity.first);
  assert.deepEqual(await(await post(cookie,command)).json(),body);assert.equal((await post(cookie,registration(),{Origin:'https://forged.invalid'})).status,403);
  assert.equal((await post(cookie,{...registration(),ownerId:'forged-owner',scope:'TRADE'})).status,400);
});
test('forged signature, wrong issuer/audience/nonce, expired token and unverified email never create a human session',async()=>{
  for(const [patch,corrupt] of [[{},true],[{iss:'https://foreign.invalid'},false],[{aud:'foreign-client'},false],[{nonce:'wrong-nonce'},false],[{exp:1},false],[{email_verified:false},false]]){
    const flow=await start('human-alpha',patch,corrupt),response=await finish(flow);assert.notEqual(response.status,302);assert.equal((await(await identify(cookies(response).join('; '))).json()).first,null);
    assert.equal((await authDb.prepare('SELECT COUNT(*) AS n FROM og_auth_sessions').first()).n,0);
    assert.notEqual((await finish(flow)).status,302,'A failed consumed login cannot be replayed.');
  }
  assert.equal((await registryDb.prepare('SELECT COUNT(*) AS n FROM network_agents').first()).n,0);
});
test('state mismatch, duplicate callback state, absent browser flow and provider outage fail closed without Sites fallback',async()=>{
  const wrong=await start();wrong.callback=wrong.callback.replace(encodeURIComponent(wrong.state),'wrong-state');assert.notEqual((await finish(wrong,spoof)).status,302);
  const duplicate=await start();duplicate.callback+='&state='+encodeURIComponent(duplicate.state);assert.notEqual((await finish(duplicate,spoof)).status,302);
  const absent=await start();assert.notEqual((await dispatch(absent.callback,{headers:spoof})).status,302);
  const unavailable=await start();failProvider=true;assert.notEqual((await finish(unavailable,spoof)).status,302);failProvider=false;
  assert.equal((await(await identify()).json()).first,null);
});
test('issuer/sub IDs distinguish humans sharing an email and remain isolated across overlapping handler awaits',async()=>{
  const alpha=await login('alpha'),beta=await login('beta'),a=await(await identify(alpha)).json(),b=await(await identify(beta)).json();assert.notEqual(a.first,b.first);
  const results=await Promise.all([alpha,beta,''].map(cookie=>dispatch(origin+'/fixture/recheck',{headers:{...spoof,...(cookie?{Cookie:cookie}:{})}}).then(r=>r.json())));
  assert.deepEqual(results.map(v=>[v.first,v.second]),[[a.first,a.first],[b.first,b.first],[null,null]]);
  const repeat=await(await identify(await login('alpha'))).json();assert.equal(repeat.first,a.first);
});
test('logout confirmation is inert, same-origin POST revokes, and an in-flight resolver observes the revocation',async()=>{
  const cookie=await login();const before=await(await identify(cookie)).json();
  const confirmation=await dispatch(origin+'/auth/logout',{headers:{Cookie:cookie}});assert.equal(confirmation.status,200);assert((await confirmation.text()).includes('<form'));
  assert.equal((await(await identify(cookie)).json()).first,before.first);
  const foreign=await dispatch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://foreign.invalid','Content-Type':'application/x-www-form-urlencoded'},body:'return_to=%2F'});assert.equal(foreign.status,403);
  const barrier=crypto.randomUUID(),inFlight=dispatch(origin+'/fixture/recheck?barrier='+barrier,{headers:{Cookie:cookie}});
  const deadline=Date.now()+5000;let ready;
  do {ready=await authDb.prepare('SELECT released FROM fixture_barriers WHERE id=?').bind(barrier).first();if(!ready)await new Promise(resolve=>setTimeout(resolve,20));}while(!ready&&Date.now()<deadline);
  assert(ready,'The actual first resolver must finish before logout.');
  const logout=await dispatch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'return_to=%2F'});assert([302,303].includes(logout.status));
  await authDb.prepare('UPDATE fixture_barriers SET released=1 WHERE id=?').bind(barrier).run();
  const result=await(await inFlight).json();assert.equal(result.first,before.first);assert.equal(result.second,null);
  assert.equal((await(await identify(cookie)).json()).first,null);assert.equal((await post(cookie,registration())).status,401);
  assert.equal((await(await identify(await login())).json()).first,before.first);
});
test('real enrollment retains the eight-agent sponsor limit and denies a ninth without resetting revoked records',async()=>{
  const cookie=await login(),first=registration();assert.equal((await post(cookie,first)).status,200);
  for(let i=1;i<8;i++)assert.equal((await post(cookie,registration())).status,200);
  assert.equal((await post(cookie,{action:'revoke',requestId:crypto.randomUUID(),id:first.id,revision:1})).status,200);
  assert.notEqual((await post(cookie,registration())).status,200);assert.equal((await registryDb.prepare('SELECT COUNT(*) AS n FROM network_agents').first()).n,8);
});
test('duplicate/oversized session cookies, caller origin changes and machine keys cannot produce another human',async()=>{
  const cookie=await login();for(const bad of [cookie+'; '+cookie,'__Host-forged-session='+'a'.repeat(9000),'__sites_local_auth=1']){
    const response=await identify(bad);if(response.status===200)assert.equal((await response.json()).first,null);else assert([400,401,503].includes(response.status));
  }
  assert.equal((await dispatch('https://forged.invalid/',{headers:{Cookie:cookie,...spoof}})).status,403);
  assert.equal((await dispatch(origin+'/api/network/agents',{headers:{Authorization:'Bearer og_agent_'+crypto.randomUUID()+'.'+'a'.repeat(64),...spoof}})).status,401);
  assert.equal((await dispatch(origin+'/api/network/agent',{headers:{Cookie:cookie}})).status,401);
});
test('missing provider configuration allows anonymous browsing, rejects sign-in, and catches a downstream rejection without identity fallback',async()=>{
  const unconfigured=new Miniflare({cf:false,modules:true,script:workerScript,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
    d1Databases:['DB','AUTH_DB'],outboundService:()=>{throw Error('Unconfigured authentication must never call a provider.');},
    bindings:{OPENGRAIL_EXTERNAL_ORIGIN:origin,OPENGRAIL_OIDC_CLIENT_ID:clientId,OPENGRAIL_OIDC_METADATA:'',
      OPENGRAIL_OIDC_CLIENT_SECRET:clientSecret,OPENGRAIL_AUTH_EPOCH:'a'.repeat(64)}});
  const dispatchUnconfigured=(url,init={})=>unconfigured.dispatchFetch(url,{...init,redirect:'manual'});
  try {
    const anonymous=await(await dispatchUnconfigured(origin+'/',{headers:spoof})).json();assert.equal(anonymous.first,null);assert.deepEqual(anonymous.callerIdentityHeaders,[]);
    assert.equal((await dispatchUnconfigured(origin+'/auth/signin',{headers:spoof})).status,503);
    assert.equal((await dispatchUnconfigured(origin+'/api/network/agents',{headers:spoof})).status,401);
    const rejected=await dispatchUnconfigured(origin+'/fixture/reject',{headers:spoof});assert.equal(rejected.status,503);
    assert.equal((await rejected.json()).error,'Sign-in is unavailable.');
  } finally { await unconfigured.dispose(); }
});
