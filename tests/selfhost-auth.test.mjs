import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

// First-party synthetic Worker/provider fixtures. The auth core, vendored OIDC
// processing/signature code, WebCrypto and AUTH_DB are real workerd/D1 paths.
const origin='https://auth-core.test',issuer='https://oidc-core.invalid';
const clientId='core-fixture-client',clientSecret='core-fixture-secret';
const metadata={issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/keys',
 authorization_response_iss_parameter_supported:true,id_token_signing_alg_values_supported:['RS256'],code_challenge_methods_supported:['S256']};
const bindings={FIXTURE_ORIGIN:origin,FIXTURE_METADATA:JSON.stringify(metadata),FIXTURE_CLIENT:clientId,FIXTURE_SECRET:clientSecret,FIXTURE_EPOCH:'e'.repeat(64)};
let mf,db,key,jwk,foreignKey;const grants=new Map();let outbound=[],providerMode='normal';
// Inspect auth redirects in this fixture; never navigate the synthetic issuer.
const dispatch=(url,init={})=>mf.dispatchFetch(url,{...init,redirect:'manual'});
const base64=value=>Buffer.from(typeof value==='string'?value:new Uint8Array(value)).toString('base64url');
const sha=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
async function sign(claims,{header={},corrupt=false,foreign=false,rawPayload}={}){
 const bytes=base64(JSON.stringify({alg:'RS256',kid:'fixture-rsa',typ:'JWT',...header}))+'.'+base64(rawPayload??JSON.stringify(claims));
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',foreign?foreignKey:key,new TextEncoder().encode(bytes)));
 if(corrupt)signature[0]^=1;return bytes+'.'+base64(signature);
}
async function provider(request){
 const url=new URL(request.url);outbound.push({url:url.href,method:request.method});
 if(providerMode==='outage')return Response.json({error:'temporarily_unavailable'},{status:503});
 if(providerMode==='redirect')return new Response(null,{status:302,headers:{Location:'https://unapproved.invalid/steal'}});
 if(providerMode==='oversize')return new Response(JSON.stringify({huge:'x'.repeat(65536)}),{headers:{'Content-Type':'application/json'}});
 if(providerMode==='stream-oversize')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(65537)));controller.close();}}),{headers:{'Content-Type':'application/json'}});
 if(providerMode==='hang-body')return new Response(new ReadableStream({start(){},cancel(){}}),{headers:{'Content-Type':'application/json'}});
 if(providerMode==='duplicate-json')return new Response('{"keys":[],"keys":[]}',{headers:{'Content-Type':'application/json'}});
 if(url.href===metadata.jwks_uri&&request.method==='GET')return Response.json({keys:[jwk]});
 assert.equal(url.href,metadata.token_endpoint);assert.equal(request.method,'POST');
 const authorization=request.headers.get('Authorization')??'';assert(authorization.length<=8192);
 const basic=/^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(authorization);assert(basic,'The provider requires client_secret_basic.');
 const encodedBytes=Buffer.from(basic[1],'base64');assert(encodedBytes.length<=4096&&encodedBytes.every(byte=>byte<128));
 assert.equal(encodedBytes.toString('base64'),basic[1],'The Basic payload must be canonical base64 ASCII.');
 const encodedCredentials=encodedBytes.toString('ascii'),separator=encodedCredentials.indexOf(':');assert(separator>0);
 // RFC6749: independently form-decode BOTH Basic credential components.
 const formDecode=value=>decodeURIComponent(value.replace(/\+/g,' '));
 assert.equal(formDecode(encodedCredentials.slice(0,separator)),clientId);
 assert.equal(formDecode(encodedCredentials.slice(separator+1)),clientSecret);
 const form=new URLSearchParams(await request.text()),code=form.get('code'),grant=grants.get(code);
 assert(grant,'Authorization code must exist in the synthetic provider.');
 assert.equal(form.get('redirect_uri'),origin+'/auth/callback');assert.equal(form.get('grant_type'),'authorization_code');
 const challenge=base64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(form.get('code_verifier')??'')));
 grants.delete(code);
 if(challenge!==grant.challenge)return Response.json({error:'invalid_grant'},{status:400});
 const now=Math.floor(Date.now()/1000),claims={iss:issuer,aud:clientId,sub:grant.subject,iat:now,exp:now+300,nonce:grant.nonce,email:'same@fixture.invalid',email_verified:true,name:'Synthetic human',...grant.patch};
 const rawPayload=grant.infinity?JSON.stringify(claims).replace(/"exp":\d+/, '"exp":1e400'):
  grant.duplicateClaim?' {"sub":"forged-subject",'+JSON.stringify(claims).slice(1):
  grant.invalidUtf8?new Uint8Array([...new TextEncoder().encode('{"invalid":"'),0xc3,0x28,...new TextEncoder().encode('",'+JSON.stringify(claims).slice(1))]):undefined;
 return Response.json({access_token:'never-retained-synthetic-access',refresh_token:'never-retained-synthetic-refresh',token_type:'Bearer',expires_in:300,
  id_token:await sign(claims,{...grant.options,rawPayload})});
}
const worker=`
import {parseSelfHostedAuthConfig,handleSelfHostedAuth,createSelfHostedCurrentUser} from './lib/selfhost-auth';
export default{async fetch(request,env){
 const input={origin:env.FIXTURE_ORIGIN,metadataJson:env.FIXTURE_METADATA,clientId:env.FIXTURE_CLIENT,clientSecret:env.FIXTURE_SECRET,sessionEpoch:env.FIXTURE_EPOCH};
 const url=new URL(request.url);
 if(url.pathname==='/fixture/parse'){try{parseSelfHostedAuthConfig(await request.json());return Response.json({valid:true});}catch{return Response.json({valid:false},{status:400});}}
 const config=parseSelfHostedAuthConfig(input),reader=createSelfHostedCurrentUser(request,config,env.AUTH_DB);
 const auth=await handleSelfHostedAuth(request,config,env.AUTH_DB);if(auth)return auth;
 try{
  if(url.pathname==='/fixture/config-change')return Response.json(await createSelfHostedCurrentUser(request,parseSelfHostedAuthConfig({...input,sessionEpoch:'changed-epoch'}),env.AUTH_DB)());
  if(url.pathname==='/fixture/db-outage')return Response.json(await createSelfHostedCurrentUser(request,config,{prepare(){throw Error('PRIVATE_DB_DETAIL');}})());
  const first=await reader();
  if(url.pathname==='/fixture/fresh'){await env.AUTH_DB.prepare('UPDATE og_auth_sessions SET revoked_at=? WHERE revoked_at IS NULL').bind(Date.now()).run();return Response.json({first,second:await reader()});}
  return Response.json(first);
 }catch{return new Response('Authentication unavailable',{status:503});}
}};`;
before(async()=>{
 const algorithm={name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'};
 const pair=await crypto.subtle.generateKey(algorithm,true,['sign','verify']);key=pair.privateKey;jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'fixture-rsa',alg:'RS256',use:'sig'};
 foreignKey=(await crypto.subtle.generateKey(algorithm,true,['sign','verify'])).privateKey;
 const compiled=await build({stdin:{contents:worker,resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',external:['node:crypto','node:async_hooks']});
 mf=new Miniflare({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['AUTH_DB'],bindings,outboundService:provider,cf:false});
 db=await mf.getD1Database('AUTH_DB');for(const sql of readFileSync('selfhost/migrations/0001_identity.sql','utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{grants.clear();outbound=[];providerMode='normal';await db.prepare('DELETE FROM og_auth_sessions').run();await db.prepare('DELETE FROM og_auth_flows').run();});
after(async()=>{if(mf)await mf.dispose();grants.clear();key=foreignKey=undefined;});
function rawCookies(response){return response.headers.getSetCookie();}
function cookieHeader(response){return rawCookies(response).map(value=>value.split(';')[0]).filter(value=>!value.endsWith('=')).join('; ');}
async function start(subject='same-subject',patch={},options={}){
 const response=await dispatch(origin+'/auth/signin?return_to=%2Fstrategies');assert.equal(response.status,302);
 const target=new URL(response.headers.get('Location')),code=crypto.randomUUID();
 grants.set(code,{subject,patch,options,nonce:target.searchParams.get('nonce'),challenge:target.searchParams.get('code_challenge')});
 return {response,target,code,cookie:cookieHeader(response),callback:origin+'/auth/callback?'+new URLSearchParams({code,state:target.searchParams.get('state'),iss:issuer})};
}
const finish=flow=>dispatch(flow.callback,{headers:{Cookie:flow.cookie}});
async function login(subject='same-subject',patch={}){const response=await finish(await start(subject,patch));assert.equal(response.status,302);return cookieHeader(response);}
const current=(cookie,path='/')=>dispatch(origin+path,{headers:{Cookie:cookie??'','oai-authenticated-user-id':'forged-human','oai-authenticated-user-email':'forged@fixture.invalid'}});
const count=async table=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
const logout=cookie=>dispatch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'return_to=%2F'});

test('strict trusted config accepts the fixed provider and rejects incomplete/duplicate/non-HTTPS authority',async()=>{
 const input={origin,metadataJson:JSON.stringify(metadata),clientId,clientSecret,sessionEpoch:'e'.repeat(64)};
 const parse=body=>dispatch(origin+'/fixture/parse',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await parse(input)).status,200);
 const variants=[{origin:'http://auth-core.test'},{origin:origin+'/path'},{origin:'https://localhost'},{clientId:''},{clientSecret:''},{sessionEpoch:''},
  {metadataJson:'{"issuer":"'+issuer+'","issuer":"'+issuer+'"}'},
  ...[{issuer:'http://identity.invalid'},{token_endpoint:'https://user:pass@identity.invalid/token'},{jwks_uri:issuer+'/keys#fragment'},
   {id_token_signing_alg_values_supported:['HS256']},{code_challenge_methods_supported:['plain']},{token_endpoint_auth_methods_supported:['none']}].map(patch=>({metadataJson:JSON.stringify({...metadata,...patch})}))];
 for(const patch of variants){const response=await parse({...input,...patch});assert.equal(response.status,400);assert(!(await response.text()).includes(clientSecret));}
});
test('real PKCE exchange and mandatory RS256 signature establish an opaque one-hour application session',async()=>{
 const flow=await start();assert.equal(flow.target.origin,issuer);assert.equal(flow.target.searchParams.get('redirect_uri'),origin+'/auth/callback');
 assert.equal(flow.target.searchParams.get('code_challenge_method'),'S256');assert.equal(flow.target.searchParams.get('response_type'),'code');
 assert.equal(flow.target.searchParams.get('response_mode'),'query');assert.match(flow.target.searchParams.get('state'),/^[\w-]{43}$/);
 const response=await finish(flow);assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'/strategies');
 for(const value of [...rawCookies(flow.response),...rawCookies(response)]){assert(value.includes('Path=/'));assert(value.includes('Secure'));assert(value.includes('HttpOnly'));assert(value.includes('SameSite=Lax'));assert(!value.includes('Domain='));}
 const cookie=cookieHeader(response),identity=await(await current(cookie)).json();assert.match(identity.userId,/^oidc_[a-f0-9]{64}$/);assert.equal(identity.displayName,'Synthetic human');assert.equal(identity.email,'same@fixture.invalid');
 assert.deepEqual(Object.keys(identity).sort(),['displayName','email','fullName','userId']);
 const row=await db.prepare('SELECT * FROM og_auth_sessions').first();assert.equal(row.expires_at-row.created_at,3600000,'Five-minute assertion expiry does not shorten the fixed one-hour app session.');
 assert.equal(row.session_digest,await sha(cookie.split('=')[1]));assert.equal(await count('og_auth_flows'),1);
 const durable=JSON.stringify([row,...(await db.prepare('SELECT * FROM og_auth_flows').all()).results]);
 for(const raw of [cookie.split('=')[1],flow.cookie.split('=')[1],'never-retained-synthetic-access','never-retained-synthetic-refresh'])assert(!durable.includes(raw));
 assert.deepEqual(outbound.map(row=>row.url),[metadata.token_endpoint,metadata.jwks_uri]);
 assert.equal((await finish(flow)).status,400);assert.equal(await count('og_auth_sessions'),1);
});
test('a foreign signing key, altered signature and forbidden JWT algorithm cannot create a session',async()=>{
 for(const options of [{foreign:true},{corrupt:true},{header:{alg:'HS256'}},{header:{alg:'none'}}]){
  const flow=await start('signature-sub',{},options);const response=await finish(flow);assert.notEqual(response.status,302);assert.equal(await count('og_auth_sessions'),0);
  assert.notEqual((await finish(flow)).status,302);const row=await db.prepare('SELECT consumed_at FROM og_auth_flows WHERE state=?').bind(flow.target.searchParams.get('state')).first();assert(row.consumed_at);
 }
});
test('actual signed duplicate claims and invalid UTF8 are rejected before any identity admission',async()=>{
 for(const field of ['duplicateClaim','invalidUtf8']){
  const flow=await start('syntax-subject');grants.get(flow.code)[field]=true;const response=await finish(flow);assert.notEqual(response.status,302);assert.equal(await count('og_auth_sessions'),0);
  assert.notEqual((await finish(flow)).status,302);assert(!outbound.some(row=>row.url===metadata.jwks_uri));
 }
 const standard=await start('session-state-compatible');standard.callback+='&session_state=standard-provider-session';assert.equal((await finish(standard)).status,302);
});
test('validly signed wrong issuer/audience/authorized-party/nonce and invalid current dates fail closed',async()=>{
 const now=Math.floor(Date.now()/1000),patches=[{iss:'https://foreign.invalid'},{aud:'foreign-client'},{aud:[clientId,'other-client']},{aud:[clientId,'other-client'],azp:'other-client'},
  {aud:clientId,azp:'other-client'},{aud:[clientId],azp:'other-client'},{aud:clientId,azp:123},{aud:[clientId],azp:{client:clientId}},{aud:[clientId,'other-client'],azp:123},
  {nonce:'wrong-nonce'},{exp:now},{iat:now+3600},{nbf:now+3600},{iat:1.5},{exp:now+300.5}];
 for(const patch of patches){const response=await finish(await start('invalid-claims',patch));assert.notEqual(response.status,302);assert.equal(await count('og_auth_sessions'),0);}
 const infinite=await start('infinite');grants.get(infinite.code).infinity=true;assert.notEqual((await finish(infinite)).status,302);assert.equal(await count('og_auth_sessions'),0);
});
test('a signed present authorized party must exactly match the client for every supported audience shape',async()=>{
 for(const aud of [clientId,[clientId],[clientId,'other-audience']]){
  const cookie=await login('authorized-party',{aud,azp:clientId});assert((await(await current(cookie)).json()).userId);
 }
 assert.equal(await count('og_auth_sessions'),3);
});
test('verified bounded email is required and signed display metadata does not link human accounts',async()=>{
 for(const patch of [{email_verified:false},{email_verified:'true'},{email:'bad address'},{email:'x'.repeat(255)},{name:'bad\nname'},{name:'x'.repeat(513)}]){
  assert.notEqual((await finish(await start('invalid-profile',patch))).status,302);assert.equal(await count('og_auth_sessions'),0);
 }
 const alpha=await(await current(await login('alpha'))).json(),beta=await(await current(await login('beta'))).json();assert.notEqual(alpha.userId,beta.userId);assert.equal(alpha.email,beta.email);
 const repeated=await(await current(await login('alpha',{name:null}))).json();assert.equal(repeated.userId,alpha.userId);assert.equal(repeated.fullName,null);assert.equal(repeated.displayName,repeated.email);
});
test('state/cookie/duplicate callback bounds reject before provider access without identity-header fallback',async()=>{
 const flow=await start(),url=new URL(flow.callback),state=url.searchParams.get('state');
 for(const callback of [flow.callback.replace(encodeURIComponent(state),'wrong-state'),flow.callback+'&state='+state,flow.callback+'&unknown=1',origin+'/auth/callback?code=x&state=%GG']){
  assert.notEqual((await dispatch(callback,{headers:{Cookie:flow.cookie,'oai-authenticated-user-id':'forged'}})).status,302);
 }
 for(const cookie of ['',flow.cookie+'; '+flow.cookie,'__Host-og_flow=invalid',flow.cookie+'; unknown='+'x'.repeat(4096)])assert.notEqual((await dispatch(flow.callback,{headers:{Cookie:cookie}})).status,302);
 assert.equal(outbound.length,0);assert.equal(await count('og_auth_sessions'),0);assert.equal(await(await current()).json(),null);
 assert.equal((await finish(flow)).status,302,'Malformed foreign callbacks cannot burn the valid browser transaction.');
});
test('provider independently rejects a wrong S256 verifier and the consumed transaction cannot be retried',async()=>{
 const flow=await start();grants.get(flow.code).challenge='not-the-original-challenge';assert.notEqual((await finish(flow)).status,302);
 assert.equal(await count('og_auth_sessions'),0);assert.equal(outbound.length,1);assert.notEqual((await finish(flow)).status,302);assert.equal(outbound.length,1);
});
test('provider outages, redirects, streamed oversize and duplicate JSON return bounded generic failures',async()=>{
 for(const mode of ['outage','redirect','oversize','stream-oversize','duplicate-json']){
  const flow=await start();providerMode=mode;const response=await finish(flow);assert.notEqual(response.status,302);const body=await response.text();assert(body.length<200);assert(!body.includes(clientSecret));assert(!body.includes('never-retained'));
  providerMode='normal';assert.notEqual((await finish(flow)).status,302);assert.equal(await count('og_auth_sessions'),0);
 }
 assert(outbound.every(row=>[metadata.token_endpoint,metadata.jwks_uri].includes(row.url)));
});
test('a provider body that never completes cannot exceed the finite callback budget',{timeout:30000},async()=>{
 const flow=await start();providerMode='hang-body';const before=Date.now(),response=await finish(flow),elapsed=Date.now()-before;
 assert.equal(response.status,503);assert(elapsed<20000);assert.equal(await count('og_auth_sessions'),0);providerMode='normal';assert.notEqual((await finish(flow)).status,302);
});
test('JWT-supplied remote key URLs cannot extend the exact configured outbound authority',async()=>{
 const flow=await start('url-header',{}, {header:{jku:'https://unapproved.invalid/keys',x5u:'https://unapproved.invalid/cert'}});
 assert.equal((await finish(flow)).status,302);assert(outbound.every(row=>[metadata.token_endpoint,metadata.jwks_uri].includes(row.url)));
});
test('concurrent delivery of one callback consumes one flow and creates at most one session',async()=>{
 const flow=await start();const results=await Promise.all(Array.from({length:4},()=>finish(flow).then(async response=>{await response.text();return response.status;})));
 assert.equal(results.filter(status=>status===302).length,1);assert.equal(await count('og_auth_sessions'),1);assert.equal(outbound.filter(row=>row.url===metadata.token_endpoint).length,1);
 const row=await db.prepare('SELECT consumed_at,completed_at FROM og_auth_flows').first();assert(row.consumed_at&&row.completed_at);
 await assert.rejects(()=>db.prepare('UPDATE og_auth_flows SET consumed_at=NULL').run());
});
test('GET logout and legacy aliases never revoke; exact-Origin bounded POST revokes before cookie clearing',async()=>{
 const cookie=await login(),before=await(await current(cookie)).json();
 for(const path of ['/auth/logout','/signout-with-chatgpt?return_to=%2Fstrategies']){const response=await dispatch(origin+path,{headers:{Cookie:cookie}});assert([200,302].includes(response.status));assert.equal((await(await current(cookie)).json()).userId,before.userId);}
 const wrongOrigin=await dispatch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://foreign.invalid','Content-Type':'application/x-www-form-urlencoded'},body:'return_to=%2F'});assert.equal(wrongOrigin.status,403);
 for(const body of ['return_to=%2F&return_to=%2F','return_to=https%3A%2F%2Fforeign.invalid','return_to=%2F%2Fforeign.invalid','return_to=%2Fauth%2Fsignin','x='+'a'.repeat(3000)]){
  assert.notEqual((await dispatch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body})).status,303);
 }
 assert.equal((await(await current(cookie)).json()).userId,before.userId);
 const response=await logout(cookie);assert.equal(response.status,303);assert(rawCookies(response).every(value=>value.includes('Max-Age=0')));assert.equal(await(await current(cookie)).json(),null);
 assert((await db.prepare('SELECT revoked_at FROM og_auth_sessions').first()).revoked_at);assert.equal(await count('og_auth_sessions'),1);
 await assert.rejects(()=>db.prepare('UPDATE og_auth_sessions SET revoked_at=NULL').run());assert.equal((await(await current(await login())).json()).userId,before.userId);
});
test('each invocation of the same currentUser closure rechecks primary D1 and database outages fail closed',async()=>{
 const cookie=await login(),result=await(await current(cookie,'/fixture/fresh')).json();assert(result.first);assert.equal(result.second,null);
 const fresh=await login();const response=await current(fresh,'/fixture/db-outage');assert.equal(response.status,503);assert(!(await response.text()).includes('PRIVATE_DB_DETAIL'));
});
test('current configuration changes, duplicate cookies, expiry and foreign origins cannot authenticate',async()=>{
 const cookie=await login(),identity=await(await current(cookie)).json();assert.equal(await(await current(cookie,'/fixture/config-change')).json(),null);
 for(const bad of [cookie+'; '+cookie,'__Host-og_session=wrong','__sites_local_auth=1','unknown='+'x'.repeat(4097)]){const response=await current(bad);assert.equal(await response.json(),null);}
 assert.equal((await dispatch('https://foreign.invalid/auth/signin',{headers:{Cookie:cookie}})).status,403);
 const raw='z'.repeat(43),flowDigest=await sha('expired-flow'),sessionDigest=await sha(raw),saved=await db.prepare('SELECT config_digest FROM og_auth_sessions').first(),now=Date.now()-7200000;
 await db.prepare('INSERT INTO og_auth_flows(flow_digest,config_digest,state,nonce,verifier,return_to,created_at,expires_at,consumed_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(flowDigest,saved.config_digest,'a'.repeat(43),'b'.repeat(43),'c'.repeat(43),'/',now,now+600000,now).run();
 await db.prepare('INSERT INTO og_auth_sessions(session_digest,flow_digest,config_digest,user_id,email,full_name,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(sessionDigest,flowDigest,saved.config_digest,identity.userId,identity.email,null,now,now+3600000).run();
 assert.equal(await(await current('__Host-og_session='+raw)).json(),null);assert.equal(await count('og_auth_sessions'),2);
});
test('legacy sign-in preserves safe return targets and old callback is refused',async()=>{
 const response=await dispatch(origin+'/signin-with-chatgpt?return_to=%2Fstrategies');assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'/auth/signin?return_to=%2Fstrategies');
 assert.equal((await dispatch(origin+'/callback?code=old&state=old')).status,400);
 for(const returnTo of ['//foreign.invalid','https://foreign.invalid','/auth/logout','/\\foreign.invalid'])assert.equal((await dispatch(origin+'/auth/signin?return_to='+encodeURIComponent(returnTo))).status,400);
});
test('global thirty-per-minute admission is atomic and consuming retained rows never resets it',async()=>{
 const results=await Promise.all(Array.from({length:35},()=>dispatch(origin+'/auth/signin').then(async response=>{await response.text();return response.status;})));
 assert.equal(results.filter(status=>status===302).length,30);assert.equal(results.filter(status=>status===429).length,5);assert.equal(await count('og_auth_flows'),30);
 await db.prepare('UPDATE og_auth_flows SET consumed_at=? WHERE consumed_at IS NULL').bind(Date.now()).run();
 assert.equal((await dispatch(origin+'/auth/signin')).status,429);assert.equal(await count('og_auth_flows'),30);
});
async function seedFlows(number,{pending=false,consumed=false,offset=0,configDigest='f'.repeat(64)}={}){
 const now=Date.now()-(pending?120000:7200000),statement=`WITH RECURSIVE sequence(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM sequence WHERE i<?)
  INSERT INTO og_auth_flows(flow_digest,config_digest,state,nonce,verifier,return_to,created_at,expires_at,consumed_at)
  SELECT printf('%064x',i+?),?, ?,?,?,'/',?,?,? FROM sequence`;
 await db.prepare(statement).bind(number,offset,configDigest,'a'.repeat(43),'b'.repeat(43),'c'.repeat(43),now,now+600000,consumed?now:null).run();
 return now;
}
test('global pending hundred remains bounded and retained twenty-thousand capacity never resets automatically',async()=>{
 await seedFlows(100,{pending:true});assert.equal((await dispatch(origin+'/auth/signin')).status,429);
 await db.prepare('UPDATE og_auth_flows SET consumed_at=? WHERE flow_digest=?').bind(Date.now(),'1'.padStart(64,'0')).run();
 const response=await dispatch(origin+'/auth/signin');assert.equal(response.status,302);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM og_auth_flows WHERE consumed_at IS NULL AND expires_at>?').bind(Date.now()).first()).n,100);
 await seedFlows(19899,{offset:1000});assert.equal(await count('og_auth_flows'),20000);assert.equal((await dispatch(origin+'/auth/signin')).status,429);
});
test('four active sessions arbitrate the final slot and revocation permits a fresh retained session',async()=>{
 const cookies=[];for(let i=0;i<3;i++)cookies.push(await login());const flows=await Promise.all(Array.from({length:3},()=>start()));
 const responses=await Promise.all(flows.map(finish));assert.equal(responses.filter(response=>response.status===302).length,1);assert.equal(responses.filter(response=>response.status===429).length,2);
 for(const response of responses)await response.text();assert.equal(await count('og_auth_sessions'),4);
 assert.equal((await logout(cookies[0])).status,303);await login();assert.equal(await count('og_auth_sessions'),5);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM og_auth_sessions WHERE revoked_at IS NULL AND expires_at>?').bind(Date.now()).first()).n,4);
});
test('ten-thousand retained sessions block new admission despite all old sessions being expired',async()=>{
 const flow=await start('new-global-user'),configDigest=(await db.prepare('SELECT config_digest FROM og_auth_flows').first()).config_digest;
 const old=await seedFlows(10000,{consumed:true,offset:50000,configDigest});
 await db.prepare(`INSERT INTO og_auth_sessions(session_digest,flow_digest,config_digest,user_id,email,created_at,expires_at)
  SELECT flow_digest,flow_digest,config_digest,'oidc_'||flow_digest,'retained@fixture.invalid',?,? FROM og_auth_flows WHERE consumed_at IS NOT NULL`)
  .bind(old,old+3600000).run();
 assert.equal(await count('og_auth_sessions'),10000);const response=await finish(flow);assert.equal(response.status,429);assert.equal(await count('og_auth_sessions'),10000);assert.equal(cookieHeader(response),'');
});
