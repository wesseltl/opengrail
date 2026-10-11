import {NetworkError} from './network-model';
import type {NetworkRepository} from './network-store';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {AssistanceError,assistanceLimits,boundedAssistanceCommand,boundedAssistanceRecord,assistanceListSchema,assistanceGetSchema,assistanceWriteSchema,assistanceReportsSchema,type AssistanceCommand,type AssistancePublicItem} from './assistance-model';
import {StrategyError,strategyMeSchema,strategyPublicHumanId,strategyDigest,type StrategyAuthorReference} from './strategy-model';
import type {AssistanceRepository} from './assistance-store';

export const assistanceHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
/** Includes bounded retained lifecycle metadata as well as twelve complete records. */
export const assistanceResponseBytes=assistanceLimits.responseBytes;
export const assistanceQueryBytes=512;
type Human={userId:string}|null;
type Repository=Pick<AssistanceRepository,'list'|'get'|'write'|'reports'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const equal=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
function reply(body:unknown,status=200,headers:Record<string,string>={}){
 const payload=JSON.stringify(body);
 if(new TextEncoder().encode(payload).byteLength>assistanceResponseBytes)throw Error('Assistance response exceeds its bound.');
 return new Response(payload,{status,headers:{...assistanceHeaders,'Content-Type':'application/json',...headers}});
}
const method=(allow:string)=>new Response(null,{status:405,headers:{...assistanceHeaders,Allow:allow}});
function failure(error:unknown,machine=false){
 if((error instanceof AssistanceError||error instanceof NetworkError||error instanceof StrategyError)&&error.status<500){
  const messages:Record<number,string>={400:'Invalid assistance request.',401:machine?'Agent credential is invalid, expired or revoked.':'Sign in to use this assistance operation.',403:'Assistance identity, origin or permission is not authorized.',404:'Exact available assistance reference not found.',409:'Assistance operation conflicts with retained identity, content or current dependencies.',413:'Assistance request is too large.',415:'Use application/json.',429:'Assistance capacity or sponsor daily limit reached.'};
  const headers:Record<string,string>={};
  const wait='retryAfterSeconds' in error?error.retryAfterSeconds:null;
  if(error.status===429&&typeof wait==='number'&&Number.isInteger(wait)&&wait>0&&wait<=86400)headers['Retry-After']=String(wait);
  if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  return reply({error:messages[error.status]??'Assistance operation refused.'},error.status,headers);
 }
 console.error(JSON.stringify({event:'assistance_request_failed'}));
 return reply({error:'Assistance unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Unsupported JSON media type.',415);
 let raw:unknown;
 try{raw=await readNetworkJson(request,assistanceLimits.requestBytes);}
 catch(error){throw new NetworkError('Invalid bounded JSON.',error instanceof NetworkBodyLimit?413:400);}
 try{return boundedAssistanceCommand(raw).command;}
 catch(error){if(error instanceof AssistanceError)throw error;throw new NetworkError('Invalid assistance command.',400);}
}
export async function validateAssistancePublicItems(items:AssistancePublicItem[]){
 if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Duplicate assistance identity.');
 for(const item of items)if(item.record){
  const canonical=boundedAssistanceRecord(item.record);
  if(await strategyDigest(canonical.payload)!==item.digest)throw Error('Assistance digest mismatch.');
 }
}
/** Checks the complete frozen command, server-derived actor and immutable content. */
export async function correlateAssistanceWrite(raw:unknown,sent:AssistanceCommand,author:StrategyAuthorReference,agentName?:string){
 const result=assistanceWriteSchema.parse(raw);
 if(result.action!==sent.action||result.requestId!==sent.requestId)throw Error('Assistance command receipt mismatch.');
 if(sent.action==='report'){
  if(!result.report||result.report.requestId!==sent.requestId||result.report.id!==sent.id||result.report.digest!==sent.digest||result.report.reason!==sent.reason)throw Error('Assistance report receipt mismatch.');
  return result;
 }
 const item=result.item;
 if(!item||item.id!==sent.id)throw Error('Assistance target receipt mismatch.');
 await validateAssistancePublicItems([item]);
 if(sent.action==='request'||sent.action==='respond'){
  if(item.requestId!==sent.requestId||item.kind!==(sent.action==='request'?'REQUEST':'RESPONSE')||!equal(item.author,author))throw Error('Assistance publication actor mismatch.');
  {
   const fullAuthor=author.kind==='AGENT'?{...author,name:agentName}:author;
   const expected=sent.action==='request'
    ?{version:1,kind:'REQUEST',id:sent.id,requestId:sent.requestId,createdAt:item.createdAt,author:fullAuthor,base:sent.base,intent:sent.intent,constraints:sent.constraints,falsification:sent.falsification,policyAccepted:sent.policyAccepted,executionEnabled:false}
    :{version:1,kind:'RESPONSE',id:sent.id,requestId:sent.requestId,createdAt:item.createdAt,author:fullAuthor,request:sent.request,proposal:sent.proposal,rationale:sent.rationale,questions:sent.questions,policyAccepted:sent.policyAccepted,executionEnabled:false};
   const canonical=boundedAssistanceRecord(expected);
   if(await strategyDigest(canonical.payload)!==item.digest||item.record&&!equal(item.record,canonical.record))throw Error('Assistance full content receipt mismatch.');
  }
 }else{
  if(item.digest!==sent.digest)throw Error('Assistance lifecycle digest mismatch.');
  const event=item.moderation.find(value=>value.requestId===sent.requestId&&equal(value.actor,author)),state=sent.action==='withdraw'?'WITHDRAWN':sent.state;
  if(!event||event.state!==state||event.reason!==sent.reason||!equal(event.actor,author))throw Error('Assistance lifecycle actor receipt mismatch.');
 }
 return result;
}
export async function assistancePublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return method('GET');
 try{
  const url=new URL(request.url);
  if(new TextEncoder().encode(url.search).byteLength>assistanceQueryBytes)throw new NetworkError('Assistance query exceeds its bound.',400);
  const pairs=[...url.searchParams];
  if(pairs.length>1||pairs.some(([key,value])=>!['cursor','id','request'].includes(key)||!uuid.test(value)))throw new NetworkError('Invalid assistance selector.',400);
  const selection=pairs[0],repo=factory();
  if(selection?.[0]==='id'){
   const result=assistanceGetSchema.parse(await repo.get(selection[1]));
   if(result.item.id!==selection[1])throw Error('Assistance exact identity mismatch.');
   await validateAssistancePublicItems([result.item]);return reply(result);
  }
  const filter=selection?.[0]==='request'?selection[1]:null,cursor=selection?.[0]==='cursor'?selection[1]:null;
  const result=assistanceListSchema.parse(await repo.list(cursor,filter));
  if(filter&&result.request?.id!==filter||!filter&&!cursor&&result.request!==null)throw Error('Assistance feed scope mismatch.');
  if(result.items.some(item=>item.kind!==(result.request?'RESPONSE':'REQUEST')||result.request&&item.record?.kind==='RESPONSE'&&!equal(item.record.request,result.request)))throw Error('Assistance feed selection mismatch.');
  for(let index=1;index<result.items.length;index++){
   const previous=result.items[index-1],item=result.items[index];
   if(item.createdAt>previous.createdAt||item.createdAt===previous.createdAt&&item.id>=previous.id)throw Error('Assistance feed order mismatch.');
  }
  if(result.nextCursor!==null&&(result.items.length!==assistanceLimits.page||result.nextCursor!==result.items.at(-1)?.id))throw Error('Assistance feed cursor mismatch.');
  if(cursor&&(result.nextCursor===cursor||result.items.some(item=>item.id===cursor)))throw Error('Assistance feed repeated cursor.');
  await validateAssistancePublicItems(result.items);return reply(result);
 }catch(error){return failure(error);}
}
export async function assistanceHumanRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');
 if(!actor)return reply({error:'Sign in to publish an assistance request.'},401);
 try{
  const url=new URL(request.url);
  if(url.search)throw new NetworkError('Assistance commands have no query.',400);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Assistance-Intent')!=='submit')throw new NetworkError('Invalid human origin or intent.',403);
  const id=await strategyPublicHumanId(actor.userId),expected=request.headers.get('X-Assistance-Author');
  if(expected===null||expected.length!==70||!/^human_[a-f0-9]{64}$/.test(expected)||expected!==id)throw new NetworkError('Frozen human identity mismatch.',403);
  const sent=await command(request);
  if(sent.action==='respond')throw new NetworkError('A registered external agent must respond.',403);
  const principal={kind:'HUMAN' as const,userId:actor.userId,moderator:moderator(actor.userId)};
  return reply(await correlateAssistanceWrite(await factory().write(principal,sent,now()),sent,{kind:'HUMAN',id,sponsorId:id}));
 }catch(error){return failure(error);}
}
export async function assistanceAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:')throw new NetworkError('Machine transport requires HTTPS.',403);
  if(url.search)throw new NetworkError('Credentials belong in Authorization only.',400);
  const origin=request.headers.get('Origin');if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid origin.',403);
  const authorization=request.headers.get('Authorization');
  if(!authorization||!/^Bearer og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(authorization))throw new NetworkError('Agent credential required.',401);
  const sent=await command(request);
  const principal=await identities().authenticate(authorization.slice(7),now());
  if(principal.credentialId!==authorization.slice(16,52))throw Error('Agent credential principal mismatch.');
  if(sent.action==='request'||sent.action==='moderate')throw new NetworkError('Agent cannot use human authority.',403);
  const sponsorId=await strategyPublicHumanId(principal.ownerId);
  return reply(await correlateAssistanceWrite(await factory().write({kind:'AGENT',principal},sent,now()),sent,{kind:'AGENT',id:principal.agentId,sponsorId},principal.name));
 }catch(error){return failure(error,true);}
}
export async function assistanceMeRequest(request:Request,actor:Human,moderator:(userId:string)=>boolean){
 if(request.method!=='GET')return method('GET');
 if(!actor)return reply({error:'Sign in to view your assistance identity.'},401);
 try{
  if(new URL(request.url).search)throw new NetworkError('Identity takes no query.',400);
  const id=await strategyPublicHumanId(actor.userId);
  return reply(strategyMeSchema.parse({version:1,authorId:id,sponsorId:id,moderator:moderator(actor.userId),executionEnabled:false}));
 }catch(error){return failure(error);}
}
export async function assistanceReportsRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(request.method!=='GET')return method('GET');
 if(!actor)return reply({error:'Sign in to view the assistance moderation queue.'},401);
 try{
  if(!moderator(actor.userId))throw new NetworkError('Explicit maintainer authorization required.',403);
  const url=new URL(request.url);
  if(new TextEncoder().encode(url.search).byteLength>assistanceQueryBytes)throw new NetworkError('Assistance query exceeds its bound.',400);
  const pairs=[...url.searchParams];
  if(pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!/^[a-f0-9]{64}$/.test(value)))throw new NetworkError('Invalid private report cursor.',400);
  return reply(assistanceReportsSchema.parse(await factory().reports({kind:'HUMAN',userId:actor.userId,moderator:true},now(),pairs[0]?.[1]??null)));
 }catch(error){return failure(error);}
}
