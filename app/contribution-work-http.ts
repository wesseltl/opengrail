import {NetworkError} from './network-model';
import {ContributionError,contributionPublicHumanId,type ContributionActor} from './contribution-model';
import {contributionHeaders} from './contribution-http';
import {contributionWorkLimits,contributionWorkPageSchema,parseContributionWorkPage,validateContributionWorkPage,type ContributionWorkPage} from './contribution-work-model';
import type {ContributionRepository} from './contribution-store';
import type {NetworkRepository,NetworkPrincipal} from './network-store';

export const contributionWorkHeaders=contributionHeaders;
type Human={userId:string}|null;
type Repository=Pick<ContributionRepository,'work'>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const bearer=/^Bearer og_agent_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.[a-f0-9]{64}$/;
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
const method=()=>new Response(null,{status:405,headers:{...contributionWorkHeaders,Allow:'GET'}});
function reply(body:unknown,status=200,headers:Record<string,string>={}){
 const payload=JSON.stringify(body);
 if(new TextEncoder().encode(payload).byteLength>contributionWorkLimits.responseBytes)throw Error('Contribution work response exceeds its bound.');
 return new Response(payload,{status,headers:{...contributionWorkHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});
}
export function contributionWorkUnavailable(){return reply({error:'Contribution work unavailable. Refresh your identity and try again.'},503);}
function failure(error:unknown,machine=false){
 if((error instanceof ContributionError||error instanceof NetworkError)&&error.status>=400&&error.status<500){
  const headers:Record<string,string>={};
  if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  return reply({error:machine&&error.status===401?'Agent credential is invalid, expired or revoked.':error.message},error.status,headers);
 }
 console.error(JSON.stringify({event:'contribution_work_request_failed'}));
 return contributionWorkUnavailable();
}
function query(request:Request){
 const url=new URL(request.url),pairs=[...url.searchParams];
 if(url.username||url.password||url.hash||pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!uuid.test(value)))throw new NetworkError('Use one valid contribution work cursor. Credentials belong only in the Authorization header.',400);
 const origin=request.headers.get('Origin');
 if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid contribution work origin.',403);
 return {url,cursor:pairs[0]?.[1]??null};
}
function clock(at:string){
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw Error('Contribution work clock unavailable.');
 return at;
}
async function page(raw:unknown,scope:'SPONSOR'|'AGENT',participant:ContributionWorkPage['participant'],at:string,cursor:string|null){
 let value:ContributionWorkPage;
 try{value=await validateContributionWorkPage(raw);}catch{throw Error('Contribution work response integrity unavailable.');}
 if(value.scope!==scope||!same(value.participant,participant)||value.checkedAt!==at)throw Error('Contribution work participant or clock mismatch.');
 if(cursor!==null&&(value.nextCursor===cursor||value.items.some(item=>item.claim.id===cursor)))throw Error('Contribution work cursor repeated.');
 return value;
}
/** Only projection time changes after the bounded repository read. Immutable
 * task/claim/event bytes and their already checked digests are never rewritten.
 * This is not a second source read or a frozen network snapshot. */
function atPublication(value:ContributionWorkPage,at:string){
 clock(at);if(at<value.checkedAt)throw Error('Contribution work clock regressed.');
 return contributionWorkPageSchema.parse({...value,checkedAt:at,items:value.items.map(({task,claim})=>({task,claim:{...claim,checkedAt:at,status:(claim.status==='ACTIVE'||claim.status==='SUBMITTED')&&at>=claim.expiresAt?'EXPIRED':claim.status}}))});
}
/** Repository.work checks canonical bytes, heads and (for agents) credentials
 * before its final SQL fence. Comparing a synchronous checked projection here
 * adds no awaited digest work after that fence. A changed retained view requires
 * a fresh request; it cannot release the earlier unsuppressed payload. */
function finalPage(raw:unknown,previous:ContributionWorkPage,at:string){
 let value:ContributionWorkPage;
 try{value=parseContributionWorkPage(raw);}catch{throw Error('Contribution work final response integrity unavailable.');}
 if(value.checkedAt!==at||!same(value,atPublication(previous,at)))throw Error('Contribution work changed before publication.');
 return value;
}
function finalClock(value:ContributionWorkPage,at:string){clock(at);if(at<value.checkedAt)throw Error('Contribution work clock regressed.');return at;}
export async function contributionWorkHumanRequest(request:Request,actor:Human,factory:()=>Repository,currentHuman:()=>Promise<Human>,now=()=>new Date().toISOString()){
 if(request.method!=='GET')return method();
 if(!actor)return reply({error:'Sign in to view your contribution work.'},401);
 try{
  const {cursor}=query(request),id=await contributionPublicHumanId(actor.userId);
  if(request.headers.get('X-Contribution-Author')!==id)throw new NetworkError('Contribution participant changed. Refresh your identity.',403);
  const at=clock(now()),participant={kind:'HUMAN' as const,id,sponsorId:id},repository=factory();
  const context:ContributionActor={kind:'HUMAN',userId:actor.userId,maintainer:false};
  const value=await page(await repository.work(context,cursor,at),'SPONSOR',participant,at,cursor);
  const current=await currentHuman();
  if(!current||current.userId!==actor.userId)throw new NetworkError('Contribution participant changed. Refresh your identity.',403);
  const finalAt=finalClock(value,now()),final=finalPage(await repository.work(context,cursor,finalAt),value,finalAt);
  return reply(atPublication(final,clock(now())));
 }catch(error){return failure(error);}
}
export async function contributionWorkAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='GET')return method();
 try{
  const {url,cursor}=query(request);
  if(url.protocol!=='https:')throw new NetworkError('Agent credentials require HTTPS.',403);
  const authorization=request.headers.get('Authorization'),match=authorization?bearer.exec(authorization):null;
  if(!authorization||!match)throw new NetworkError('A valid agent credential is required.',401);
  const token=authorization.slice(7),at=clock(now()),identity=identities();
  const principal=await identity.authenticate(token,at);
  if(principal.credentialId!==match[1])throw Error('Contribution work credential identity mismatch.');
  const sponsorId=await contributionPublicHumanId(principal.ownerId),participant={kind:'AGENT' as const,id:principal.agentId,sponsorId};
  const repository=factory(),context:ContributionActor={kind:'AGENT',principal};
  const value=await page(await repository.work(context,cursor,at),'AGENT',participant,at,cursor);
  const current:NetworkPrincipal=await identity.authenticate(token,clock(now()));
  if(!same(current,principal)||current.credentialId!==match[1])throw new NetworkError('Agent credential is invalid, expired or revoked.',401);
  const finalAt=finalClock(value,now());
  if(finalAt>=current.expiresAt)throw new NetworkError('Agent credential is invalid, expired or revoked.',401);
  const final=finalPage(await repository.work(context,cursor,finalAt),value,finalAt),publicationAt=clock(now());
  if(publicationAt>=current.expiresAt)throw new NetworkError('Agent credential is invalid, expired or revoked.',401);
  return reply(atPublication(final,publicationAt));
 }catch(error){return failure(error,true);}
}
