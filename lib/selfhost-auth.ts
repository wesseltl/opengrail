import * as oauth from './vendor/oauth4webapi/index.js';
import {parseUniqueJson} from '../app/unique-json';
import type {HumanAuthIdentity} from './human-auth-context';

/** The parser is called only with trusted operator bindings by the standalone entry. */
export type SelfHostedAuthConfig=Readonly<{origin:string;callbackUri:string}>;
type PrivateConfig={origin:string;callbackUri:string;clientId:string;clientSecret:string;sessionEpoch:string;
 metadata:oauth.AuthorizationServer;bindingMaterial:string};
const configured=new WeakMap<SelfHostedAuthConfig,PrivateConfig>();
const SESSION_COOKIE='__Host-og_session',FLOW_COOKIE='__Host-og_flow';
const FLOW_MS=600_000,SESSION_MS=3_600_000,CALLBACK_MS=10_000,MAX_BODY=65_536;
const textEncoder=new TextEncoder(),opaque=/^[A-Za-z0-9_-]{43}$/;
const authPaths=new Set(['/auth/signin','/auth/callback','/auth/logout','/signin-with-chatgpt','/signout-with-chatgpt','/callback']);
class AuthFailure extends Error{constructor(readonly status=400){super('SELF_HOSTED_AUTH_FAILED');}}
function fail(status=400):never{throw new AuthFailure(status);}
function bounded(value:unknown,maximum:number):value is string{
 return typeof value==='string'&&value.length>0&&value.length<=maximum&&textEncoder.encode(value).byteLength<=maximum&&!/[\u0000-\u001f\u007f]/.test(value);
}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function exactHttps(value:unknown,issuer=false):string{
 if(!bounded(value,2048)||/[\\\s]/.test(value))fail();
 let url:URL;try{url=new URL(value);}catch{return fail();}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||issuer&&url.search||
   url.hostname==='localhost'||/\.(?:localhost|local|internal)$/.test(url.hostname)||
   url.hostname.includes(':')||/^\d+(?:\.\d+){3}$/.test(url.hostname))fail();
 // Preserve issuer identifiers exactly; the root slash is optional in the identifier.
 if(url.href!==value&&!(url.pathname==='/'&&!url.search&&url.href===value+'/'))fail();
 return value;
}
export function parseSelfHostedAuthConfig(input:{origin:string;metadataJson:string;clientId:string;clientSecret:string;sessionEpoch:string}):SelfHostedAuthConfig{
 try{
  const origin=exactHttps(input.origin);if(new URL(origin).origin!==origin)fail();
  if(!bounded(input.clientId,256)||!bounded(input.clientSecret,4096)||!bounded(input.sessionEpoch,128))fail();
  const raw=parseUniqueJson(input.metadataJson,16_384,8);if(!record(raw))fail();
  const issuer=exactHttps(raw.issuer,true),authorization=exactHttps(raw.authorization_endpoint),token=exactHttps(raw.token_endpoint),jwks=exactHttps(raw.jwks_uri);
  if(new URL(authorization).search||[authorization,token,jwks].some(endpoint=>new URL(endpoint).href!==endpoint)||token===jwks)fail();
  const supported=(key:string,required:string,optional=false)=>{
   const value=raw[key];if(optional&&value===undefined)return;
   if(!Array.isArray(value)||value.length<1||value.length>16||value.some(item=>!bounded(item,80))||new Set(value).size!==value.length||!value.includes(required))fail();
  };
  supported('id_token_signing_alg_values_supported','RS256');supported('code_challenge_methods_supported','S256');
  supported('token_endpoint_auth_methods_supported','client_secret_basic',true);supported('response_types_supported','code',true);
  if(raw.authorization_response_iss_parameter_supported!==undefined&&typeof raw.authorization_response_iss_parameter_supported!=='boolean')fail();
  const metadata:oauth.AuthorizationServer=Object.freeze({issuer,authorization_endpoint:authorization,token_endpoint:token,jwks_uri:jwks,
   id_token_signing_alg_values_supported:Object.freeze(['RS256']) as unknown as string[],
   ...(raw.authorization_response_iss_parameter_supported===true?{authorization_response_iss_parameter_supported:true}:{})});
  const callbackUri=origin+'/auth/callback';
  const config=Object.freeze({origin,callbackUri});
  configured.set(config,{origin,callbackUri,clientId:input.clientId,clientSecret:input.clientSecret,sessionEpoch:input.sessionEpoch,metadata,
   bindingMaterial:JSON.stringify([origin,callbackUri,issuer,authorization,token,jwks,input.clientId,input.clientSecret,input.sessionEpoch,raw.authorization_response_iss_parameter_supported===true,'RS256','S256','client_secret_basic',SESSION_MS])});
  return config;
 }catch{throw new Error('INVALID_SELF_HOSTED_AUTH_CONFIGURATION');}
}
function trusted(config:SelfHostedAuthConfig):PrivateConfig{const value=configured.get(config);if(!value)fail(503);return value;}
async function digest(value:string):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',textEncoder.encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function randomOpaque():string{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function requestUrl(request:Request,config:PrivateConfig):URL{
 if(request.url.length>8192||textEncoder.encode(request.url).byteLength>8192)fail();
 let url:URL;try{url=new URL(request.url);}catch{return fail();}
 if(url.origin!==config.origin||url.username||url.password||url.hash)fail(403);
 return url;
}
function uniqueParameters(raw:string,allowed:readonly string[],maximum=4096):URLSearchParams{
 if(textEncoder.encode(raw).byteLength>maximum||/%(?![a-fA-F0-9]{2})/.test(raw))fail();
 const params=new URLSearchParams(raw),seen=new Set<string>();let count=0;
 for(const [key,value] of params){if(++count>16||seen.has(key)||!allowed.includes(key)||!bounded(key,80)||value.length>2048||textEncoder.encode(value).byteLength>2048||/[\u0000-\u001f\u007f\ufffd]/.test(value))fail();seen.add(key);}
 return params;
}
function cookies(request:Request):Map<string,string>{
 const raw=request.headers.get('Cookie')??'';if(textEncoder.encode(raw).byteLength>4096||/[\u0000-\u001f\u007f]/.test(raw))fail();
 const result=new Map<string,string>();if(!raw)return result;
 const parts=raw.split(';');if(parts.length>32)fail();
 for(const part of parts){const at=part.indexOf('='),name=part.slice(0,at).trim(),value=part.slice(at+1).trim();
  if(at<1||!name||!/^[-!#$%&'*+.\^_`|~0-9a-zA-Z]+$/.test(name)||result.has(name)||value.length>512)fail();
  result.set(name,value);
 }
 for(const name of [SESSION_COOKIE,FLOW_COOKIE]){const value=result.get(name);if(value!==undefined&&!opaque.test(value))fail();}
 return result;
}
function returnPath(value:string|null,origin:string):string{
 if(value===null||value==='')return '/';
 if(!bounded(value,1024)||!value.startsWith('/')||value.startsWith('//')||/[\\]/.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value))fail();
 let url:URL;try{url=new URL(value,origin);}catch{return fail();}
 if(url.origin!==origin||url.pathname.startsWith('//')||authPaths.has(url.pathname)||url.pathname.startsWith('/auth/'))fail();
 return url.pathname+url.search+url.hash;
}
function cookie(name:string,value:string,seconds:number):string{return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;}
function headers():Headers{return new Headers({'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});}
function redirect(target:string,status=302,setCookies:string[]=[]):Response{const h=headers();h.set('Location',target);for(const item of setCookies)h.append('Set-Cookie',item);return new Response(null,{status,headers:h});}
function errorResponse(status:number):Response{const h=headers();h.set('Content-Type','text/plain; charset=utf-8');return new Response(status===503?'Sign-in is temporarily unavailable. Please try again.':status===429?'Sign-in capacity reached. Please try again later.':'Unable to complete this authentication request.',{status,headers:h});}
function method(request:Request,allowed:readonly string[]):void{if(!allowed.includes(request.method))fail(400);}
function escapeHtml(value:string):string{return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}

class Deadline{
 readonly controller=new AbortController();private timer!:ReturnType<typeof setTimeout>;private ended=false;
 readonly stopped:Promise<never>;
 constructor(milliseconds:number){this.stopped=new Promise((_,reject)=>{this.timer=setTimeout(()=>{this.ended=true;this.controller.abort();reject(new AuthFailure(503));},milliseconds);});}
 check():void{if(this.ended)fail(503);}
 async wait<T>(operation:Promise<T>):Promise<T>{this.check();const value=await Promise.race([operation,this.stopped]);this.check();return value;}
 close():void{clearTimeout(this.timer);this.controller.abort();}
}
async function readBounded(body:ReadableStream<Uint8Array>|null,maximum:number,deadline:Deadline):Promise<Uint8Array<ArrayBuffer>>{
 if(!body)return new Uint8Array();const reader=body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await deadline.wait(reader.read());if(next.done)break;size+=next.value.byteLength;if(size>maximum)fail();parts.push(next.value);}}
 catch(error){const cancelled=reader.cancel().then(()=>undefined,()=>undefined);try{await deadline.wait(cancelled);}catch{/* cancellation is observed only within the same remaining deadline */}throw error;}
 finally{try{reader.releaseLock();}catch{/* an already timed-out read has no authority to extend the deadline */}}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.byteLength;}return result;
}
function strictJwtSyntax(value:unknown):void{
 if(!bounded(value,49_152))fail();const parts=value.split('.');if(parts.length!==3)fail();
 const decode=(part:string,maximum:number):Uint8Array=>{
  if(!/^[A-Za-z0-9_-]+$/.test(part)||part.length>maximum*2||part.length%4===1)fail();
  let decoded:string;try{decoded=atob(part.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-part.length%4)%4));}catch{return fail();}
  if(decoded.length>maximum||btoa(decoded).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==part)fail();
  return Uint8Array.from(decoded,char=>char.charCodeAt(0));
 };
 // This is syntax/policy rejection only. These decoded values never establish identity.
 const header=parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0],2048)),2048,8);
 const payload=parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[1],32_768)),32_768,12);
 if(!record(header)||header.alg!=='RS256'||!record(payload))fail();decode(parts[2],2048);
}
async function cancelResponse(response:Response,deadline:Deadline):Promise<void>{
 if(!response.body)return;const cancelled=response.body.cancel().then(()=>undefined,()=>undefined);
 try{await deadline.wait(cancelled);}catch{/* cancellation cannot extend the callback deadline */}
}
function exactProviderFetch(config:PrivateConfig,providerFetch:typeof fetch,deadline:Deadline):typeof fetch{
 let calls=0;
 return (async(input:RequestInfo|URL,init?:RequestInit)=>{
  deadline.check();const url=input instanceof Request?input.url:String(input),httpMethod=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  if(++calls>4||!(url===config.metadata.token_endpoint&&httpMethod==='POST'||url===config.metadata.jwks_uri&&httpMethod==='GET'))fail(503);
  const response=await deadline.wait(providerFetch(url,{...init,method:httpMethod,redirect:'manual',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:deadline.controller.signal}));
  if(response.redirected||response.status>=300&&response.status<400||response.url&&response.url!==url){await cancelResponse(response,deadline);fail(503);}
  const length=response.headers.get('Content-Length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY)){await cancelResponse(response,deadline);fail(503);}
  const body=await readBounded(response.body,MAX_BODY,deadline);
  // Also reject duplicate JSON keys and non-UTF8 before either token/JWKS parser.
  try{const parsed=parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(body),MAX_BODY,12);
   if(url===config.metadata.token_endpoint&&record(parsed)&&parsed.id_token!==undefined)strictJwtSyntax(parsed.id_token);
  }catch{return fail(503);}
  return new Response(body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')??'application/json'}});
 }) as typeof fetch;
}
type FlowRow={flow_digest:string;config_digest:string;state:string;nonce:string;verifier:string;return_to:string;created_at:number;expires_at:number;consumed_at:number|null;completed_at:number|null};
function validFlow(row:FlowRow,configDigest:string,now:number):void{
 if(!/^[a-f0-9]{64}$/.test(row.flow_digest)||row.config_digest!==configDigest||![row.state,row.nonce,row.verifier].every(value=>opaque.test(value))||
  !Number.isSafeInteger(row.created_at)||!Number.isSafeInteger(row.expires_at)||row.created_at>now||row.expires_at!==row.created_at+FLOW_MS||row.expires_at<=now)fail();
}
async function signIn(request:Request,url:URL,config:PrivateConfig,db:D1Database):Promise<Response>{
 method(request,['GET']);cookies(request);
 const params=uniqueParameters(url.search,['return_to']);const target=returnPath(params.get('return_to'),config.origin);
 const rawKey=randomOpaque(),flowDigest=await digest(rawKey),configDigest=await digest(config.bindingMaterial);
 const state=oauth.generateRandomState(),nonce=oauth.generateRandomNonce(),verifier=oauth.generateRandomCodeVerifier();
 const challenge=await oauth.calculatePKCECodeChallenge(verifier),now=Date.now();
 const inserted=await db.prepare(`INSERT INTO og_auth_flows(flow_digest,config_digest,state,nonce,verifier,return_to,created_at,expires_at)
  SELECT ?,?,?,?,?,?,?,? WHERE
  (SELECT COUNT(*) FROM og_auth_flows)<20000 AND
  (SELECT COUNT(*) FROM og_auth_flows WHERE consumed_at IS NULL AND expires_at>?)<100 AND
  (SELECT COUNT(*) FROM og_auth_flows WHERE created_at>=?)<30 RETURNING flow_digest`)
  .bind(flowDigest,configDigest,state,nonce,verifier,target,now,now+FLOW_MS,now,now-60_000).first<{flow_digest:string}>();
 if(!inserted||inserted.flow_digest!==flowDigest)fail(429);
 const authorization=new URL(config.metadata.authorization_endpoint!);
 for(const [key,value] of Object.entries({client_id:config.clientId,response_type:'code',response_mode:'query',scope:'openid email profile',redirect_uri:config.callbackUri,state,nonce,code_challenge:challenge,code_challenge_method:'S256'}))authorization.searchParams.set(key,value);
 return redirect(authorization.href,302,[cookie(FLOW_COOKIE,rawKey,FLOW_MS/1000)]);
}
function claimIdentity(claims:oauth.IDToken|undefined,config:PrivateConfig,nowSeconds:number):{sub:string;email:string;fullName:string|null}{
 if(!claims||claims.iss!==config.metadata.issuer||!bounded(claims.sub,256)||
  claims.azp!==undefined&&(!bounded(claims.azp,256)||claims.azp!==config.clientId)||
  !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat!>nowSeconds||claims.exp!<=nowSeconds||
  claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>nowSeconds)||
  claims.email_verified!==true||!bounded(claims.email,254)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email))fail();
 const fullName=claims.name===undefined||claims.name===null?null:bounded(claims.name,512)?claims.name:fail();
 return {sub:claims.sub,email:claims.email,fullName};
}
async function callback(request:Request,url:URL,config:PrivateConfig,db:D1Database,providerFetch:typeof fetch):Promise<Response>{
 const deadline=new Deadline(CALLBACK_MS);
 try{
  method(request,['GET']);const params=uniqueParameters(url.search,['code','state','iss','session_state','error','error_description','error_uri']);
  const values=cookies(request),rawKey=values.get(FLOW_COOKIE),state=params.get('state');
  if(!rawKey||!state||!opaque.test(state)||!bounded(params.get('code'),2048)||params.has('error'))fail();
  const flowDigest=await deadline.wait(digest(rawKey)),configDigest=await deadline.wait(digest(config.bindingMaterial)),claimedAt=Date.now();
  // Consume once at the primary before contacting the provider; every valid retry stays consumed.
  const flow=await deadline.wait(db.prepare(`UPDATE og_auth_flows SET consumed_at=?
   WHERE flow_digest=? AND config_digest=? AND state=? AND consumed_at IS NULL AND completed_at IS NULL
   AND created_at<=? AND expires_at>? RETURNING *`).bind(claimedAt,flowDigest,configDigest,state,claimedAt,claimedAt).first<FlowRow>());
  if(!flow)fail();validFlow(flow,configDigest,Date.now());const target=returnPath(flow.return_to,config.origin);
  const as:oauth.AuthorizationServer={...config.metadata};
  const client:oauth.Client={client_id:config.clientId,id_token_signed_response_alg:'RS256',[oauth.clockTolerance]:0};
  const parameters=oauth.validateAuthResponse(as,client,params,flow.state),limitedFetch=exactProviderFetch(config,providerFetch,deadline);
  const tokenResponse=await deadline.wait(oauth.authorizationCodeGrantRequest(as,client,oauth.ClientSecretBasic(config.clientSecret),parameters,config.callbackUri,flow.verifier,{[oauth.customFetch]:limitedFetch,signal:deadline.controller.signal}));
  const tokens=await deadline.wait(oauth.processAuthorizationCodeResponse(as,client,tokenResponse,{expectedNonce:flow.nonce,requireIdToken:true}));
  // This exact original Response was processed above. No identity is trusted before this call.
  await deadline.wait(oauth.validateApplicationLevelSignature(as,tokenResponse,{[oauth.customFetch]:limitedFetch,signal:deadline.controller.signal}));
  const now=Date.now(),identity=claimIdentity(oauth.getValidatedIdTokenClaims(tokens),config,Math.floor(now/1000));
  const userId='oidc_'+await deadline.wait(digest(JSON.stringify([config.metadata.issuer,identity.sub]))),rawSession=randomOpaque(),sessionDigest=await deadline.wait(digest(rawSession));
  deadline.check();
  const inserted=await deadline.wait(db.prepare(`INSERT INTO og_auth_sessions(session_digest,flow_digest,config_digest,user_id,email,full_name,created_at,expires_at)
   SELECT ?,?,?,?,?,?,?,? WHERE
   (SELECT COUNT(*) FROM og_auth_sessions)<10000 AND
   (SELECT COUNT(*) FROM og_auth_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>?)<4 AND
   EXISTS(SELECT 1 FROM og_auth_flows WHERE flow_digest=? AND config_digest=? AND consumed_at=? AND completed_at IS NULL AND expires_at>?)
   RETURNING session_digest`).bind(sessionDigest,flowDigest,configDigest,userId,identity.email,identity.fullName,now,now+SESSION_MS,userId,now,flowDigest,configDigest,claimedAt,now).first<{session_digest:string}>());
  if(!inserted||inserted.session_digest!==sessionDigest)fail(429);
  return redirect(target,302,[cookie(SESSION_COOKIE,rawSession,SESSION_MS/1000),cookie(FLOW_COOKIE,'',0)]);
 }finally{deadline.close();}
}
async function logout(request:Request,url:URL,config:PrivateConfig,db:D1Database):Promise<Response>{
 method(request,['GET','POST']);const query=uniqueParameters(url.search,['return_to']),values=cookies(request);
 if(request.method==='GET'){
  const target=returnPath(query.get('return_to'),config.origin),h=headers();h.set('Content-Type','text/html; charset=utf-8');
  h.set('Content-Security-Policy',"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign out</title><main><h1>Sign out of OpenGrail?</h1><form method="post" action="/auth/logout"><input type="hidden" name="return_to" value="${escapeHtml(target)}"><button type="submit">Sign out</button></form><p><a href="${escapeHtml(target)}">Cancel</a></p></main></html>`,{headers:h});
 }
 if(request.headers.get('Origin')!==config.origin)fail(403);
 if(url.search||!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type')??''))fail();
 const deadline=new Deadline(2000);let form:URLSearchParams;
 try{const length=request.headers.get('Content-Length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))fail();
  const body=await readBounded(request.body,2048,deadline);form=uniqueParameters(new TextDecoder('utf-8',{fatal:true}).decode(body),['return_to'],2048);
 }finally{deadline.close();}
 const target=returnPath(form.get('return_to'),config.origin),key=values.get(SESSION_COOKIE);
 if(key){const sessionDigest=await digest(key),configDigest=await digest(config.bindingMaterial),now=Date.now();
  await db.prepare('UPDATE og_auth_sessions SET revoked_at=? WHERE session_digest=? AND config_digest=? AND revoked_at IS NULL').bind(now,sessionDigest,configDigest).run();
 }
 // Database revocation has resolved before cookies are cleared. Provider sessions are untouched.
 return redirect(target,303,[cookie(SESSION_COOKIE,'',0),cookie(FLOW_COOKIE,'',0)]);
}

/** Standalone-only routes. Sites production never calls this adapter. */
export async function handleSelfHostedAuth(request:Request,config:SelfHostedAuthConfig,authDb:D1Database,providerFetch:typeof fetch=fetch):Promise<Response|null>{
 try{
  const settings=trusted(config),url=requestUrl(request,settings);if(!authPaths.has(url.pathname))return null;
  if(url.pathname==='/callback')fail();
  if(url.pathname==='/signin-with-chatgpt'||url.pathname==='/signout-with-chatgpt'){
   method(request,['GET']);cookies(request);const params=uniqueParameters(url.search,['return_to']),target=returnPath(params.get('return_to'),settings.origin);
   return redirect((url.pathname==='/signin-with-chatgpt'?'/auth/signin':'/auth/logout')+'?return_to='+encodeURIComponent(target));
  }
  if(url.pathname==='/auth/signin')return await signIn(request,url,settings,authDb);
  if(url.pathname==='/auth/callback')return await callback(request,url,settings,authDb,providerFetch);
  return await logout(request,url,settings,authDb);
 }catch(error){return errorResponse(error instanceof AuthFailure?error.status:503);}
}

/** Each call re-reads primary D1. No cached identity or identity-header fallback. */
export function createSelfHostedCurrentUser(request:Request,config:SelfHostedAuthConfig,authDb:D1Database):()=>Promise<HumanAuthIdentity|null>{
 return async()=>{
  let settings:PrivateConfig,sessionKey:string|undefined;
  try{settings=trusted(config);requestUrl(request,settings);sessionKey=cookies(request).get(SESSION_COOKIE);}catch{return null;}
  if(!sessionKey)return null;
  try{
   const sessionDigest=await digest(sessionKey),configDigest=await digest(settings.bindingMaterial),now=Date.now();
   const row=await authDb.prepare(`SELECT user_id,email,full_name,created_at,expires_at FROM og_auth_sessions
    WHERE session_digest=? AND config_digest=? AND revoked_at IS NULL AND created_at<=? AND expires_at>?`)
    .bind(sessionDigest,configDigest,now,now).first<{user_id:string;email:string;full_name:string|null;created_at:number;expires_at:number}>();
   if(!row||row.created_at>Date.now()||row.expires_at<=Date.now())return null;
   if(!/^oidc_[a-f0-9]{64}$/.test(row.user_id)||!bounded(row.email,254)||!Number.isSafeInteger(row.created_at)||!Number.isSafeInteger(row.expires_at)||row.expires_at!==row.created_at+SESSION_MS||row.full_name!==null&&!bounded(row.full_name,512))throw new Error('INVALID_AUTH_RECORD');
   return Object.freeze({userId:row.user_id,email:row.email,fullName:row.full_name,displayName:row.full_name??row.email});
  }catch{throw new Error('SELF_HOSTED_AUTH_UNAVAILABLE');}
 };
}
