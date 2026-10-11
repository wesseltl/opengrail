import {NetworkError} from './network-model';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {ContributionError,contributionMeSchema,contributionPublicHumanId} from './contribution-model';
import * as M from './task-discussion-model';
import type {TaskDiscussionRepository} from './task-discussion-store';
import type {NetworkRepository} from './network-store';

export const taskDiscussionHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
export const taskDiscussionQueryBytes=512;
type Human={userId:string}|null;
type Repository=Pick<TaskDiscussionRepository,'list'|'get'|'write'|'reports'>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const method=(allow:string)=>new Response(null,{status:405,headers:{...taskDiscussionHeaders,Allow:allow}});
function reply(body:unknown,status=200,headers:Record<string,string>={}){
 const payload=JSON.stringify(body);if(new TextEncoder().encode(payload).byteLength>M.taskDiscussionLimits.responseBytes)throw Error('Discussion response exceeds its bound.');
 return new Response(payload,{status,headers:{...taskDiscussionHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});
}
async function trusted<T>(operation:()=>Promise<T>){try{return await operation();}catch{throw Error('Discussion response integrity unavailable.');}}
function failure(error:unknown,machine=false){
 if((error instanceof M.TaskDiscussionError||error instanceof NetworkError||error instanceof ContributionError)&&error.status<500){
  const messages:Record<number,string>={400:'Invalid discussion request.',401:machine?'Agent credential is invalid, expired or revoked.':'Sign in to use this discussion operation.',403:'Discussion identity, origin or permission is not authorized.',404:'Exact discussion reference not found.',409:'Discussion operation conflicts with retained identity, content or current dependencies.',413:'Discussion request is too large.',415:'Use application/json.',429:'Discussion capacity or sponsor UTC-day limit reached.'},headers:Record<string,string>={};
  const wait='retryAfterSeconds'in error?error.retryAfterSeconds:null;
  if(error.status===429&&typeof wait==='number'&&Number.isInteger(wait)&&wait>0&&wait<=86400)headers['Retry-After']=String(wait);if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  return reply({error:messages[error.status]??'Discussion operation refused.'},error.status,headers);
 }
 console.error(JSON.stringify({event:'task_discussion_request_failed'}));return reply({error:'Task discussions unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Unsupported JSON media type.',415);let raw:unknown;
 try{raw=await readNetworkJson(request,M.taskDiscussionLimits.requestBytes,M.taskDiscussionLimits.maximumDepth);}catch(error){throw new NetworkError('Invalid bounded JSON.',error instanceof NetworkBodyLimit?413:400);}
 return M.boundedTaskDiscussionCommand(raw).command;
}
function query(request:Request){const url=new URL(request.url);if(url.username||url.password||new TextEncoder().encode(url.search).byteLength>taskDiscussionQueryBytes)throw new NetworkError('Invalid bounded discussion URL.',400);const pairs=[...url.searchParams];if(new Set(pairs.map(([key])=>key)).size!==pairs.length)throw new NetworkError('Repeated discussion selector.',400);return pairs;}
export async function taskDiscussionPublicRequest(request:Request,factory:()=>Repository,now=()=>new Date().toISOString()){
 if(request.method!=='GET')return method('GET');try{
  const pairs=query(request),params=new Map(pairs),id=params.get('id'),at=now();
  if(id!==undefined){if(pairs.length!==1||!uuid.test(id))throw new NetworkError('Use one exact discussion identity.',400);const raw=await factory().get(id,at),value=await trusted(()=>M.validateTaskDiscussionGet(raw));if(value.item.id!==id)throw Error('Discussion exact identity mismatch.');return reply(value);}
  const task=params.get('task'),digest=params.get('digest'),cursor=params.get('cursor');
  if(!task||!uuid.test(task)||!digest||!hash.test(digest)||cursor!==undefined&&!uuid.test(cursor)||pairs.length!==(cursor===undefined?2:3)||pairs.some(([key])=>!['task','digest','cursor'].includes(key)))throw new NetworkError('Use an exact task and digest with one optional cursor.',400);
  const repo=factory(),rawAnchor=cursor?await repo.get(cursor,at):null,anchor=rawAnchor?await trusted(()=>M.validateTaskDiscussionGet(rawAnchor)):null;
  if(anchor&&!same(anchor.item.task,{id:task,digest}))throw new NetworkError('Discussion cursor belongs to another task.',404);
  const raw=await repo.list(task,digest,cursor??null,at),value=await trusted(()=>M.validateTaskDiscussionList(raw));
  if(value.task.id!==task||value.task.digest!==digest||anchor&&(value.nextCursor===cursor||value.items.some(item=>item.id===cursor||item.createdAt>anchor.item.createdAt||item.createdAt===anchor.item.createdAt&&item.id>=anchor.item.id)))throw Error('Discussion page correlation mismatch.');return reply(value);
 }catch(error){return failure(error);}
}
export async function taskDiscussionHumanRequest(request:Request,actor:Human,factory:()=>Repository,maintainer:(id:string)=>boolean,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');if(!actor)return reply({error:'Sign in to participate in this discussion.'},401);try{
  const url=new URL(request.url);query(request);if(url.search)throw new NetworkError('Discussion commands take no query.',400);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Task-Discussion-Intent')!=='submit')throw new NetworkError('Invalid discussion origin or intent.',403);
  const id=await contributionPublicHumanId(actor.userId),expected=request.headers.get('X-Task-Discussion-Author');if(expected===null||expected.length!==70||!/^human_[a-f0-9]{64}$/.test(expected)||expected!==id)throw new NetworkError('Frozen human identity changed.',403);
  const sent=await command(request),allowed=maintainer(actor.userId);if(sent.action==='hide'&&!allowed)throw new NetworkError('Explicit human maintainer authorization required.',403);
  const raw=await factory().write({kind:'HUMAN',userId:actor.userId,maintainer:allowed},sent,now()),value=await trusted(()=>M.validateTaskDiscussionWrite(raw,sent,{kind:'HUMAN',id,sponsorId:id}));
  if(sent.action==='hide'&&!maintainer(actor.userId))throw new NetworkError('Current human maintainer authorization required.',403);return reply(value);
 }catch(error){return failure(error);}
}
export async function taskDiscussionAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');try{
  const url=new URL(request.url);query(request);if(url.protocol!=='https:')throw new NetworkError('Agent credentials require HTTPS.',403);if(url.search)throw new NetworkError('Credentials belong in Authorization only.',400);
  const origin=request.headers.get('Origin');if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid discussion origin.',403);const authorization=request.headers.get('Authorization');if(!authorization||!/^Bearer og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(authorization))throw new NetworkError('Valid agent credential required.',401);
  const sent=await command(request);if(sent.action==='hide')throw new NetworkError('Agents have no maintainer authority.',403);const principal=await identities().authenticate(authorization.slice(7),now());if(principal.credentialId!==authorization.slice(16,52))throw Error('Credential principal mismatch.');
  const sponsorId=await contributionPublicHumanId(principal.ownerId),raw=await factory().write({kind:'AGENT',principal},sent,now());return reply(await trusted(()=>M.validateTaskDiscussionWrite(raw,sent,{kind:'AGENT',id:principal.agentId,sponsorId})));
 }catch(error){return failure(error,true);}
}
export async function taskDiscussionMeRequest(request:Request,actor:Human,maintainer:(id:string)=>boolean){
 if(request.method!=='GET')return method('GET');if(!actor)return reply({error:'Sign in to view your discussion identity.'},401);try{if(query(request).length)throw new NetworkError('Identity takes no query.',400);const id=await contributionPublicHumanId(actor.userId);return reply(contributionMeSchema.parse({version:1,authorId:id,sponsorId:id,maintainer:maintainer(actor.userId),executionEnabled:false}));}catch(error){return failure(error);}
}
export async function taskDiscussionReportsRequest(request:Request,actor:Human,factory:()=>Repository,maintainer:(id:string)=>boolean,now=()=>new Date().toISOString()){
 if(request.method!=='GET')return method('GET');if(!actor)return reply({error:'Sign in to view the discussion report queue.'},401);try{
  if(!maintainer(actor.userId))throw new NetworkError('Explicit human maintainer authorization required.',403);const pairs=query(request);if(pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!hash.test(value)))throw new NetworkError('Use one canonical private report cursor.',400);
  const raw=await factory().reports(pairs[0]?.[1]??null,now()),value=await trusted(()=>M.validateTaskDiscussionReports(raw));if(!maintainer(actor.userId))throw new NetworkError('Current human maintainer authorization required.',403);
  if(pairs.length&&value.nextCursor===pairs[0][1])throw Error('Repeated report cursor.');return reply(value);
 }catch(error){return failure(error);}
}
