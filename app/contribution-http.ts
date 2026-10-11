import {NetworkError} from './network-model';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {ContributionError,contributionLimits,boundedContributionCommand,contributionListSchema,contributionGetSchema,contributionClaimsSchema,contributionClaimGetSchema,contributionMeSchema,contributionPublicHumanId,validateContributionTaskItem,validateContributionClaimItem,validateContributionWrite} from './contribution-model';
import type {ContributionRepository} from './contribution-store';
import type {NetworkRepository} from './network-store';

export const contributionHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Human={userId:string}|null;
type Repository=Pick<ContributionRepository,'list'|'get'|'claims'|'getClaim'|'write'>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const method=(allow:string)=>new Response(null,{status:405,headers:{...contributionHeaders,Allow:allow}});
function reply(body:unknown,status=200,headers:Record<string,string>={}){
 const payload=JSON.stringify(body);
 if(new TextEncoder().encode(payload).byteLength>contributionLimits.responseBytes)throw Error('Contribution response exceeds its bound.');
 return new Response(payload,{status,headers:{...contributionHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});
}
async function trusted<T>(operation:()=>Promise<T>){try{return await operation();}catch{throw Error('Contribution response integrity unavailable.');}}
const taskItem=(value:unknown)=>trusted(()=>validateContributionTaskItem(value));
const claimItem=(value:unknown)=>trusted(()=>validateContributionClaimItem(value));
function failure(error:unknown,machine=false){
 if((error instanceof ContributionError||error instanceof NetworkError)&&error.status<500){
  const headers:Record<string,string>={};
  if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  if(error.status===429&&'retryAfterSeconds'in error&&typeof error.retryAfterSeconds==='number'&&Number.isInteger(error.retryAfterSeconds)&&error.retryAfterSeconds>0&&error.retryAfterSeconds<=86400)headers['Retry-After']=String(error.retryAfterSeconds);
  return reply({error:machine&&error.status===401?'Agent credential is invalid, expired or revoked.':error.message},error.status,headers);
 }
 console.error(JSON.stringify({event:'contribution_request_failed'}));
 return reply({error:'Contributions unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Use application/json.',415);
 let raw:unknown;
 try{raw=await readNetworkJson(request,contributionLimits.requestBytes,contributionLimits.maximumDepth);}
 catch(error){throw new NetworkError(error instanceof NetworkBodyLimit?'Contribution request too large.':'Invalid contribution JSON.',error instanceof NetworkBodyLimit?413:400);}
 try{return boundedContributionCommand(raw).command;}
 catch(error){throw new NetworkError(error instanceof ContributionError&&error.status===413?'Contribution request too large.':'Invalid contribution command.',error instanceof ContributionError&&error.status===413?413:400);}
}
export async function contributionPublicRequest(request:Request,factory:()=>Repository,now=()=>new Date().toISOString()){
 if(request.method!=='GET')return method('GET');
 try{
  const pairs=[...new URL(request.url).searchParams],params=new Map(pairs),at=now();
  if(params.size!==pairs.length||pairs.some(([key])=>!['id','claim','task','digest','cursor'].includes(key)))throw new NetworkError('Use supported contribution query parameters once.',400);
  const id=params.get('id'),claim=params.get('claim'),task=params.get('task'),digest=params.get('digest'),cursor=params.get('cursor');
  if(id!==undefined||claim!==undefined){
   const selected=id??claim;
   if(pairs.length!==1||!selected||!uuid.test(selected))throw new NetworkError('Use one exact task or claim identity.',400);
   const repo=factory();
   if(id!==undefined){const result=contributionGetSchema.parse(await repo.get(id,at));if(result.item.id!==id)throw Error('Task identity response mismatch.');await taskItem(result.item);return reply(result);}
   const result=contributionClaimGetSchema.parse(await repo.getClaim(claim!,at));
   if(result.item.id!==claim||result.item.checkedAt!==at)throw Error('Claim identity response mismatch.');
   await taskItem(result.task);await claimItem(result.item);return reply(result);
  }
  if(task!==undefined||digest!==undefined){
   if(!task||!uuid.test(task)||!digest||!hash.test(digest)||pairs.length!==(cursor===undefined?2:3)||cursor!==undefined&&!uuid.test(cursor))throw new NetworkError('Use an exact task, digest and optional claim cursor.',400);
   const repo=factory(),anchor=cursor?contributionClaimGetSchema.parse(await repo.getClaim(cursor,at)):null;
   if(anchor){await taskItem(anchor.task);await claimItem(anchor.item);if(anchor.item.id!==cursor||anchor.item.checkedAt!==at||!same(anchor.item.task,{id:task,digest}))throw new NetworkError('Claim cursor does not belong to this exact task.',404);}
   const result=contributionClaimsSchema.parse(await repo.claims(task,digest,cursor??null,at));
   if(result.task.id!==task||result.task.digest!==digest||result.items.some(item=>item.checkedAt!==at)||anchor&&(result.nextCursor===cursor||result.items.some(item=>item.id===cursor||item.createdAt>anchor.item.createdAt||item.createdAt===anchor.item.createdAt&&item.id>=anchor.item.id)))throw Error('Claim page response mismatch.');
   await taskItem(result.task);for(const item of result.items)await claimItem(item);return reply(result);
  }
  if(pairs.length>(cursor===undefined?0:1)||cursor!==undefined&&!uuid.test(cursor))throw new NetworkError('Use one valid task cursor.',400);
  const repo=factory(),anchor=cursor?contributionGetSchema.parse(await repo.get(cursor,at)):null;
  if(anchor){if(anchor.item.id!==cursor)throw Error('Task cursor response mismatch.');await taskItem(anchor.item);}
  const result=contributionListSchema.parse(await repo.list(cursor??null,at));
  if(anchor&&(result.nextCursor===cursor||result.items.some(item=>item.id===cursor||item.createdAt>anchor.item.createdAt||item.createdAt===anchor.item.createdAt&&item.id>=anchor.item.id)))throw Error('Task page precedes its cursor.');
  for(const item of result.items)await taskItem(item);return reply(result);
 }catch(error){return failure(error);}
}
export async function contributionHumanRequest(request:Request,actor:Human,factory:()=>Repository,maintainer:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to coordinate a contribution.'},401);
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.search)throw new NetworkError('Contribution commands take no query parameters.',400);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Contribution-Intent')!=='submit')throw new NetworkError('Invalid contribution origin or intent.',403);
  const authorId=await contributionPublicHumanId(actor.userId);
  if(request.headers.get('X-Contribution-Author')!==authorId)throw new NetworkError('Contribution participant changed. Reconcile with the original account.',403);
  const sent=await command(request),privileged=['register','close','hide','review'].includes(sent.action),allowed=maintainer(actor.userId);
  if(privileged&&!allowed)throw new NetworkError('Explicit human contribution maintainer authorization is required.',403);
  const raw=await factory().write({kind:'HUMAN',userId:actor.userId,maintainer:allowed},sent,now());
  const value=await trusted(()=>validateContributionWrite(raw,sent,{kind:'HUMAN',id:authorId,sponsorId:authorId}));
  if(privileged&&!maintainer(actor.userId))throw new NetworkError('Current contribution maintainer authorization is required.',403);
  return reply(value);
 }catch(error){return failure(error);}
}
export async function contributionAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:')throw new NetworkError('Agent credentials require HTTPS.',403);
  if(url.search)throw new NetworkError('Credentials belong only in the Authorization header.',400);
  const origin=request.headers.get('Origin');if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid contribution origin.',403);
  const authorization=request.headers.get('Authorization');
  if(!authorization||!/^Bearer og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(authorization))throw new NetworkError('A valid agent credential is required.',401);
  const sent=await command(request);
  if(!['claim','release','submit'].includes(sent.action))throw new NetworkError('Agents may only claim, release and submit coordination records.',403);
  const principal=await identities().authenticate(authorization.slice(7),now());
  if(principal.credentialId!==authorization.slice(16,52))throw Error('Contribution credential identity mismatch.');
  const sponsorId=await contributionPublicHumanId(principal.ownerId);
  const raw=await factory().write({kind:'AGENT',principal},sent,now());
  return reply(await trusted(()=>validateContributionWrite(raw,sent,{kind:'AGENT',id:principal.agentId,sponsorId})));
 }catch(error){return failure(error,true);}
}
export async function contributionMeRequest(request:Request,actor:Human,maintainer:(userId:string)=>boolean){
 if(!actor)return reply({error:'Sign in to view your contribution identity.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(new URL(request.url).search)throw new NetworkError('Contribution identity takes no query parameters.',400);
  const id=await contributionPublicHumanId(actor.userId);
  return reply(contributionMeSchema.parse({version:1,authorId:id,sponsorId:id,maintainer:maintainer(actor.userId),executionEnabled:false}));
 }catch(error){return failure(error);}
}
