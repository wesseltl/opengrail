import {networkCommandSchema,networkListSchema,networkWriteSchema,networkLimits,NetworkError} from './network-model';
import {z} from 'zod';
import type {NetworkRepository} from './network-store';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
export const networkHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Repository=Pick<NetworkRepository,'list'|'write'|'authenticate'>;
export const networkIdentitySchema=z.object({version:z.literal(1),agent:z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(48),credentialId:z.string().uuid(),expiresAt:z.string().datetime(),scope:z.literal('PUBLIC_RESEARCH_SUBMIT')}).strict(),executionEnabled:z.literal(false)}).strict();
export async function networkOwnerRequest(request:Request,actor:{userId:string}|null,factory:()=>Repository,now:()=>string=()=>new Date().toISOString()){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:networkHeaders});
 if(!actor)return reply({error:'Sign in to manage your agents.'},401);
 if(request.method!=='GET'&&request.method!=='POST')return new Response(null,{status:405,headers:{...networkHeaders,Allow:'GET, POST'}});
 try{
  const url=new URL(request.url);if(url.search)return reply({error:'This endpoint takes no query parameters.'},400);
  if(request.method==='GET')return reply(networkListSchema.parse(await factory().list(actor.userId,now())));
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Network-Intent')!=='onboard')return reply({error:'Invalid request origin or intent.'},403);
  if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return reply({error:'Use application/json.'},415);
  let raw:unknown;
  try{raw=await readNetworkJson(request,networkLimits.requestBytes);}catch(error){return reply({error:error instanceof NetworkBodyLimit?'Request too large.':'Invalid JSON request.'},error instanceof NetworkBodyLimit?413:400);}
  const parsed=networkCommandSchema.safeParse(raw);if(!parsed.success)return reply({error:'Invalid agent enrollment command.'},400);
  const command=parsed.data,result=networkWriteSchema.parse(await factory().write(actor.userId,command,now())),agent=result.agent;
  if(agent.id!==command.id)throw Error('Enrollment receipt identity mismatch.');
  if(command.action==='register'){
   if(agent.registrationRequestId!==command.requestId||agent.credentialId!==command.credentialId||agent.name!==command.name||agent.revision!==1||agent.revokedAt!==null||Date.parse(agent.expiresAt)-Date.parse(agent.createdAt)!==command.days*86400000)throw Error('Enrollment receipt material mismatch.');
  }else if(agent.revocationRequestId!==command.requestId||agent.revision!==2||agent.revokedAt===null)throw Error('Revocation receipt mismatch.');
  return reply(result);
 }catch(error){
  if(error instanceof NetworkError&&error.status<500)return reply({error:error.message},error.status);
  console.error(JSON.stringify({event:'network_enrollment_failed'}));
  return reply({error:'Agent enrollment unavailable. Retry the identical request to reconcile.'},503);
 }
}
export async function networkAgentRequest(request:Request,factory:()=>Repository,now:()=>string=()=>new Date().toISOString()){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{...networkHeaders,...(status===401?{'WWW-Authenticate':'Bearer'}:{})}});
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...networkHeaders,Allow:'GET'}});
 const url=new URL(request.url);if(url.protocol!=='https:')return reply({error:'Agent credentials require HTTPS.'},403);if(url.search)return reply({error:'Credentials are accepted only in the Authorization header.'},400);
 const origin=request.headers.get('Origin');if(origin!==null&&origin!==url.origin)return reply({error:'Invalid request origin.'},403);
 const auth=request.headers.get('Authorization');
 if(!auth||!/^Bearer og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(auth))return reply({error:'A valid agent credential is required.'},401);
 try{
  const principal=await factory().authenticate(auth.slice(7),now());
  const result=networkIdentitySchema.parse({version:1,agent:{id:principal.agentId,name:principal.name,credentialId:principal.credentialId,expiresAt:principal.expiresAt,scope:'PUBLIC_RESEARCH_SUBMIT'},executionEnabled:false});
  if(result.agent.credentialId!==auth.slice(16,52)||Date.parse(result.agent.expiresAt)<=Date.parse(now()))throw Error('Agent identity response mismatch.');
  return reply(result);
 }catch(error){
  if(error instanceof NetworkError&&error.status<500)return reply({error:error.status===401?'Agent credential is invalid, expired or revoked.':error.message},error.status);
  console.error(JSON.stringify({event:'network_agent_authentication_failed'}));return reply({error:'Agent authentication unavailable.'},503);
 }
}
