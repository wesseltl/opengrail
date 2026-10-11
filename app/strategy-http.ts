import {z} from 'zod';
import {NetworkError} from './network-model';
import type {NetworkRepository} from './network-store';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {strategyCommandSchema,strategyLimits,strategyListSchema,strategyGetSchema,strategyHistorySchema,strategyWriteSchema,strategyMeSchema,strategyReportsSchema,StrategyError,strategyPublicHumanId,strategyDigest,type StrategyAuthorReference} from './strategy-model';
import type {StrategyRepository} from './strategy-store';
import type {StrategyPublicItem} from './strategy-model';

export const strategyHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Human={userId:string}|null;
type Repository=Pick<StrategyRepository,'list'|'get'|'history'|'write'|'reports'>;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase());
const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{...strategyHeaders,...headers}});
const method=(allowed:string)=>new Response(null,{status:405,headers:{...strategyHeaders,Allow:allowed}});
async function publicItems(items:StrategyPublicItem[]){
 if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Duplicate strategy identities.');
 for(const item of items)if(item.record&&await strategyDigest(JSON.stringify(item.record))!==item.digest)throw Error('Strategy public digest mismatch.');
}
function failure(error:unknown,machine=false){
 if((error instanceof StrategyError||error instanceof NetworkError)&&error.status<500){
  const wait='retryAfterSeconds' in error?error.retryAfterSeconds:null;
  const headers:Record<string,string>={};
  if(error.status===429&&typeof wait==='number'&&Number.isInteger(wait)&&wait>0&&wait<=86400)headers['Retry-After']=String(wait);
  if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  return reply({error:error.status===401&&machine?'Agent credential is invalid, expired or revoked.':error.message},error.status,headers);
 }
 console.error(JSON.stringify({event:'strategy_request_failed'}));
 return reply({error:'Strategy unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Use application/json.',415);
 let raw:unknown;
 try{raw=await readNetworkJson(request,strategyLimits.requestBytes);}
 catch(error){throw new NetworkError(error instanceof NetworkBodyLimit?'Request too large.':'Invalid JSON request.',error instanceof NetworkBodyLimit?413:400);}
 const parsed=strategyCommandSchema.safeParse(raw);
 if(!parsed.success)throw new NetworkError('Invalid public strategy command.',400);
 return parsed.data;
}
async function correlate(raw:unknown,sent:ReturnType<typeof strategyCommandSchema.parse>,author:StrategyAuthorReference,agentName?:string){
 const result=strategyWriteSchema.parse(raw);
 if(result.action!==sent.action||result.requestId!==sent.requestId)throw Error('Strategy receipt command mismatch.');
 if(sent.action==='report'){
  if(!result.report||result.report.requestId!==sent.requestId||result.report.id!==sent.id||result.report.digest!==sent.digest||result.report.reason!==sent.reason)throw Error('Strategy report receipt mismatch.');
 }else{
  if(!result.item||result.item.id!==sent.id)throw Error('Strategy receipt target mismatch.');
  if(sent.action!=='publish'&&result.item.digest!==sent.digest)throw Error('Strategy receipt digest mismatch.');
  if(sent.action==='withdraw'||sent.action==='moderate'){
   const event=result.item.moderation.find(value=>value.requestId===sent.requestId),state=sent.action==='withdraw'?'WITHDRAWN':sent.state;
   if(!event||event.state!==state||event.reason!==sent.reason||JSON.stringify(event.actor)!==JSON.stringify(author))throw Error('Strategy moderation receipt mismatch.');
  }
  if(sent.action==='publish'){
   const item=result.item;
   if(item.requestId!==sent.requestId||JSON.stringify(item.author)!==JSON.stringify(author))throw Error('Strategy publication authorship mismatch.');
   const revision=sent.relation?.type==='REVISION';
   if(revision?(item.rootId===item.id||item.revision<2):(item.rootId!==item.id||item.revision!==1))throw Error('Strategy lineage receipt mismatch.');
   if(item.record){
    const record=item.record,content={name:sent.name,description:sent.description,assumptions:sent.assumptions,falsification:sent.falsification,sources:sent.sources,definition:sent.definition,relation:sent.relation};
    if(JSON.stringify(record.content)!==JSON.stringify(content)||await strategyDigest(JSON.stringify(record))!==item.digest)throw Error('Strategy content receipt mismatch.');
    if(record.author.kind==='AGENT'&&record.author.name!==agentName)throw Error('Strategy agent attribution mismatch.');
   }
  }
 }
 return result;
}
export async function strategyPublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return method('GET');
 try{
  const params=new URL(request.url).searchParams;
  const pairs=[...params];
  if(pairs.length>1||pairs.some(([key])=>!['cursor','id','root'].includes(key)))throw new NetworkError('Use one supported strategy query parameter.',400);
  const selection=pairs[0];
  if(selection?.[0]==='id'){
   const id=uuid.safeParse(selection[1]);if(!id.success)throw new NetworkError('Invalid strategy identity.',400);
   const result=strategyGetSchema.parse(await factory().get(id.data));
   if(result.item.id!==id.data)throw Error('Strategy identity response mismatch.');
   await publicItems([result.item]);
   return reply(result);
  }
  if(selection?.[0]==='root'){
   const id=uuid.safeParse(selection[1]);if(!id.success)throw new NetworkError('Invalid strategy root identity.',400);
   const result=strategyHistorySchema.parse(await factory().history(id.data));
   if(result.items.some(item=>item.rootId!==id.data))throw Error('Strategy history response mismatch.');
   await publicItems(result.items);
   return reply(result);
  }
  const cursor=selection?.[1]??null;
  if(cursor!==null&&(!cursor||cursor.length>512))throw new NetworkError('Invalid strategy cursor.',400);
  const result=strategyListSchema.parse(await factory().list(cursor));
  await publicItems(result.items);
  return reply(result);
 }catch(error){return failure(error);}
}
export async function strategyHumanRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to contribute strategy.'},401);
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.search)throw new NetworkError('Strategy commands take no query parameters.',400);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Strategy-Intent')!=='submit')throw new NetworkError('Invalid request origin or intent.',403);
  const sent=await command(request);
  const principal={kind:'HUMAN' as const,userId:actor.userId,moderator:moderator(actor.userId)};
  const sponsorId=await strategyPublicHumanId(actor.userId);
  const expectedAuthor=request.headers.get('X-Strategy-Author');
  if(expectedAuthor!==null&&(expectedAuthor.length!==70||!/^human_[a-f0-9]{64}$/.test(expectedAuthor)||expectedAuthor!==sponsorId))throw new NetworkError('Strategy account changed. Preserve the original operation.',403);
  return reply(await correlate(await factory().write(principal,sent,now()),sent,{kind:'HUMAN',id:sponsorId,sponsorId}));
 }catch(error){return failure(error);}
}
export async function strategyAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:')throw new NetworkError('Agent credentials require HTTPS.',403);
  if(url.search)throw new NetworkError('Credentials belong only in the Authorization header.',400);
  const origin=request.headers.get('Origin');
  if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid request origin.',403);
  const authorization=request.headers.get('Authorization');
  if(!authorization||!/^Bearer og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(authorization))throw new NetworkError('A valid agent credential is required.',401);
  const sent=await command(request);
  const principal=await identities().authenticate(authorization.slice(7),now());
  if(principal.credentialId!==authorization.slice(16,52))throw Error('Strategy credential identity mismatch.');
  const sponsorId=await strategyPublicHumanId(principal.ownerId);
  return reply(await correlate(await factory().write({kind:'AGENT',principal},sent,now()),sent,{kind:'AGENT',id:principal.agentId,sponsorId},principal.name));
 }catch(error){return failure(error,true);}
}
export async function strategyMeRequest(request:Request,actor:Human,moderator:(userId:string)=>boolean){
 if(!actor)return reply({error:'Sign in to view your strategy identity.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(new URL(request.url).search)throw new NetworkError('Strategy identity takes no query parameters.',400);
  const id=await strategyPublicHumanId(actor.userId);
  return reply(strategyMeSchema.parse({version:1,authorId:id,sponsorId:id,moderator:moderator(actor.userId),executionEnabled:false}));
 }catch(error){return failure(error);}
}
export async function strategyReportsRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to view the moderation queue.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(!moderator(actor.userId))throw new NetworkError('Explicit maintainer authorization is required.',403);
  const pairs=[...new URL(request.url).searchParams];
  if(pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!/^[a-f0-9]{64}$/.test(value)))throw new NetworkError('Use one valid moderation cursor.',400);
  return reply(strategyReportsSchema.parse(await factory().reports({kind:'HUMAN',userId:actor.userId,moderator:true},now(),pairs[0]?.[1]??null)));
 }catch(error){return failure(error);}
}
