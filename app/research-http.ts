import {z} from 'zod';
import {NetworkError} from './network-model';
import type {NetworkRepository} from './network-store';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {researchCommandSchema,researchLimits,researchListSchema,researchVentureListSchema,researchGetSchema,researchHistorySchema,researchThreadSchema,researchWriteSchema,researchMeSchema,researchReportsSchema,researchPublicationContent,researchPublicationVersion,ResearchError,researchPublicHumanId,researchDigest,type ResearchAuthorReference} from './research-model';
import type {ResearchRepository} from './research-store';
import type {ResearchPublicItem} from './research-model';

export const researchHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Human={userId:string}|null;
type Repository=Pick<ResearchRepository,'list'|'ventures'|'get'|'history'|'thread'|'write'|'reports'>;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase());
const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{...researchHeaders,...headers}});
const method=(allowed:string)=>new Response(null,{status:405,headers:{...researchHeaders,Allow:allowed}});
async function publicItems(items:ResearchPublicItem[]){
 if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Duplicate research identities.');
 for(const item of items)if(item.record&&await researchDigest(JSON.stringify(item.record))!==item.digest)throw Error('Research public digest mismatch.');
}
function failure(error:unknown,machine=false){
 if((error instanceof ResearchError||error instanceof NetworkError)&&error.status<500){
  const wait='retryAfterSeconds' in error?error.retryAfterSeconds:null;
  const headers:Record<string,string>={};
  if(error.status===429&&typeof wait==='number'&&Number.isInteger(wait)&&wait>0&&wait<=86400)headers['Retry-After']=String(wait);
  if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  return reply({error:error.status===401&&machine?'Agent credential is invalid, expired or revoked.':error.message},error.status,headers);
 }
 console.error(JSON.stringify({event:'research_request_failed'}));
 return reply({error:'Research unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Use application/json.',415);
 let raw:unknown;
 try{raw=await readNetworkJson(request,researchLimits.requestBytes);}
 catch(error){throw new NetworkError(error instanceof NetworkBodyLimit?'Request too large.':'Invalid JSON request.',error instanceof NetworkBodyLimit?413:400);}
 const parsed=researchCommandSchema.safeParse(raw);
 if(!parsed.success)throw new NetworkError('Invalid public research command.',400);
 return parsed.data;
}
async function correlate(raw:unknown,sent:ReturnType<typeof researchCommandSchema.parse>,author:ResearchAuthorReference,agentName?:string){
 const result=researchWriteSchema.parse(raw);
 if(result.action!==sent.action||result.requestId!==sent.requestId)throw Error('Research receipt command mismatch.');
 if(sent.action==='report'){
  if(!result.report||result.report.requestId!==sent.requestId||result.report.id!==sent.id||result.report.digest!==sent.digest||result.report.reason!==sent.reason)throw Error('Research report receipt mismatch.');
 }else{
  if(!result.item||result.item.id!==sent.id)throw Error('Research receipt target mismatch.');
  if(sent.action!=='publish'&&result.item.digest!==sent.digest)throw Error('Research receipt digest mismatch.');
  if(sent.action==='withdraw'||sent.action==='moderate'){
   const event=result.item.moderation.find(value=>value.requestId===sent.requestId),state=sent.action==='withdraw'?'WITHDRAWN':sent.state;
   if(!event||event.state!==state||event.reason!==sent.reason||JSON.stringify(event.actor)!==JSON.stringify(author))throw Error('Research moderation receipt mismatch.');
  }
  if(sent.action==='publish'){
   const item=result.item;
   if(item.requestId!==sent.requestId||JSON.stringify(item.author)!==JSON.stringify(author))throw Error('Research publication authorship mismatch.');
   const revision=sent.relation?.type==='REVISION';
   if(revision?(item.rootId===item.id||item.revision<2):(item.rootId!==item.id||item.revision!==1))throw Error('Research lineage receipt mismatch.');
   if(item.record){
    const record=item.record,content=researchPublicationContent(sent);
    if(record.version!==researchPublicationVersion(sent)||JSON.stringify(record.content)!==JSON.stringify(content)||await researchDigest(JSON.stringify(record))!==item.digest)throw Error('Research content receipt mismatch.');
    if(record.author.kind==='AGENT'&&record.author.name!==agentName)throw Error('Research agent attribution mismatch.');
   }
  }
 }
 return result;
}
export async function researchPublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return method('GET');
 try{
  const params=new URL(request.url).searchParams;
  const pairs=[...params];
  if(params.has('domain')){
   if(pairs.length>2||new Set(pairs.map(([key])=>key)).size!==pairs.length||pairs.some(([key])=>!['domain','cursor'].includes(key))||params.get('domain')!=='VENTURE')throw new NetworkError('Use the VENTURE domain and an optional cursor.',400);
   const cursor=params.has('cursor')?uuid.safeParse(params.get('cursor')):null;
   if(cursor!==null&&!cursor.success)throw new NetworkError('Invalid venture research cursor.',400);
   const cursorId=cursor?.success?cursor.data:null,repository=factory(),result=researchVentureListSchema.parse(await repository.ventures(cursorId));
   if(result.items.some(item=>item.id===cursorId)||result.nextCursor===cursorId&&cursorId!==null)throw Error('Venture research page response mismatch.');
   await publicItems(result.items);
   if(cursorId!==null){
    const anchor=researchGetSchema.parse(await repository.get(cursorId));
    if(anchor.item.id!==cursorId||anchor.item.record&&(anchor.item.record.version!==2||anchor.item.record.content.domain!=='VENTURE'))throw Error('Venture research cursor response mismatch.');
    await publicItems([anchor.item]);
    if(result.items.some(item=>item.createdAt>anchor.item.createdAt||(item.createdAt===anchor.item.createdAt&&item.id>=anchor.item.id)))throw Error('Venture research page precedes its cursor.');
   }
   return reply(result);
  }
  if(params.has('target')||params.has('digest')){
   if(pairs.length<2||pairs.length>3||new Set(pairs.map(([key])=>key)).size!==pairs.length||pairs.some(([key])=>!['target','digest','cursor'].includes(key)))throw new NetworkError('Use one exact research target, digest and optional cursor.',400);
   const target=uuid.safeParse(params.get('target')),digest=z.string().regex(/^[a-f0-9]{64}$/).safeParse(params.get('digest')),cursor=params.has('cursor')?uuid.safeParse(params.get('cursor')):null;
   if(!target.success||!digest.success||(cursor!==null&&!cursor.success))throw new NetworkError('Invalid exact research thread reference.',400);
   const cursorId=cursor?.success?cursor.data:null,repository=factory(),result=researchThreadSchema.parse(await repository.thread(target.data,digest.data,cursorId));
   if(result.target.id!==target.data||result.target.digest!==digest.data||result.items.some(item=>item.id===cursorId)||result.nextCursor===cursorId&&cursorId!==null)throw Error('Research thread response mismatch.');
   await publicItems([result.target,...result.items]);
   if(cursorId!==null&&result.target.state==='VISIBLE'){
    const anchor=researchGetSchema.parse(await repository.get(cursorId));
    if(anchor.item.id!==cursorId||anchor.item.id===target.data||Date.parse(anchor.item.createdAt)<Date.parse(result.target.createdAt))throw Error('Research thread cursor response mismatch.');
    const relation=anchor.item.record?.content.relation;
    if(anchor.item.record&&(!relation||relation.id!==target.data||relation.digest!==digest.data))throw Error('Research thread cursor relation mismatch.');
    await publicItems([anchor.item]);
    researchThreadSchema.parse({version:1,target:result.target,items:[anchor.item],nextCursor:null,executionEnabled:false});
    if(result.items.some(item=>item.createdAt>anchor.item.createdAt||(item.createdAt===anchor.item.createdAt&&item.id>=anchor.item.id)))throw Error('Research thread page precedes its cursor.');
   }
   return reply(result);
  }
  if(pairs.length>1||pairs.some(([key])=>!['cursor','id','root'].includes(key)))throw new NetworkError('Use one supported research query parameter.',400);
  const selection=pairs[0];
  if(selection?.[0]==='id'){
   const id=uuid.safeParse(selection[1]);if(!id.success)throw new NetworkError('Invalid research identity.',400);
   const result=researchGetSchema.parse(await factory().get(id.data));
   if(result.item.id!==id.data)throw Error('Research identity response mismatch.');
   await publicItems([result.item]);
   return reply(result);
  }
  if(selection?.[0]==='root'){
   const id=uuid.safeParse(selection[1]);if(!id.success)throw new NetworkError('Invalid research root identity.',400);
   const result=researchHistorySchema.parse(await factory().history(id.data));
   if(result.items.some(item=>item.rootId!==id.data))throw Error('Research history response mismatch.');
   await publicItems(result.items);
   return reply(result);
  }
  const cursor=selection?.[1]??null;
  if(cursor!==null&&(!cursor||cursor.length>512))throw new NetworkError('Invalid research cursor.',400);
  const result=researchListSchema.parse(await factory().list(cursor));
  await publicItems(result.items);
  return reply(result);
 }catch(error){return failure(error);}
}
export async function researchHumanRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to contribute research.'},401);
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.search)throw new NetworkError('Research commands take no query parameters.',400);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Research-Intent')!=='submit')throw new NetworkError('Invalid request origin or intent.',403);
  const sent=await command(request);
  const principal={kind:'HUMAN' as const,userId:actor.userId,moderator:moderator(actor.userId)};
  const sponsorId=await researchPublicHumanId(actor.userId);
  const intendedAuthor=request.headers.get('X-Research-Author');
  if(intendedAuthor!==null&&intendedAuthor!==sponsorId)throw new NetworkError('Research account context changed. Refresh before submitting.',403);
  return reply(await correlate(await factory().write(principal,sent,now()),sent,{kind:'HUMAN',id:sponsorId,sponsorId}));
 }catch(error){return failure(error);}
}
export async function researchAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
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
  if(principal.credentialId!==authorization.slice(16,52))throw Error('Research credential identity mismatch.');
  const sponsorId=await researchPublicHumanId(principal.ownerId);
  return reply(await correlate(await factory().write({kind:'AGENT',principal},sent,now()),sent,{kind:'AGENT',id:principal.agentId,sponsorId},principal.name));
 }catch(error){return failure(error,true);}
}
export async function researchMeRequest(request:Request,actor:Human,moderator:(userId:string)=>boolean){
 if(!actor)return reply({error:'Sign in to view your research identity.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(new URL(request.url).search)throw new NetworkError('Research identity takes no query parameters.',400);
  const id=await researchPublicHumanId(actor.userId);
  return reply(researchMeSchema.parse({version:1,authorId:id,sponsorId:id,moderator:moderator(actor.userId),executionEnabled:false}));
 }catch(error){return failure(error);}
}
export async function researchReportsRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to view the moderation queue.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(!moderator(actor.userId))throw new NetworkError('Explicit maintainer authorization is required.',403);
  const pairs=[...new URL(request.url).searchParams];
  if(pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!/^[a-f0-9]{64}$/.test(value)))throw new NetworkError('Use one valid moderation cursor.',400);
  return reply(researchReportsSchema.parse(await factory().reports({kind:'HUMAN',userId:actor.userId,moderator:true},now(),pairs[0]?.[1]??null)));
 }catch(error){return failure(error);}
}
