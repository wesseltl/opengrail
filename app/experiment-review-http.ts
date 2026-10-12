import {NetworkError} from './network-model';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {experimentDigest,experimentPublicHumanId,type ExperimentAuthorReference} from './experiment-model';
import {experimentReviewLimits,ExperimentReviewError,experimentReviewCommandSchema,experimentReviewContent,experimentReviewSummarySchema,experimentReviewListSchema,experimentReviewGetSchema,experimentReviewWriteSchema,experimentReviewMeSchema,experimentReviewReportsSchema,validateExperimentReviewItem,type ExperimentReviewCommand} from './experiment-review-model';
import type {ExperimentReviewRepository} from './experiment-review-store';
import type {NetworkRepository} from './network-store';
export const experimentReviewHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Human={userId:string}|null;
type Repository=Pick<ExperimentReviewRepository,'list'|'get'|'write'|'reports'> & Partial<Pick<ExperimentReviewRepository,'confirmForward'|'confirmCommitment'|'confirmCommitmentPage'>>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function reply(body:unknown,status=200,headers:Record<string,string>={}){const payload=JSON.stringify(body);if(new TextEncoder().encode(payload).byteLength>experimentReviewLimits.requestBytes)throw Error('Review response exceeds its bound.');return new Response(payload,{status,headers:{...experimentReviewHeaders,'Content-Type':'application/json',...headers}});}
const method=(allow:string)=>new Response(null,{status:405,headers:{...experimentReviewHeaders,Allow:allow}});
function failure(error:unknown,machine=false){
 if((error instanceof ExperimentReviewError||error instanceof NetworkError)&&error.status<500){const headers:Record<string,string>={};if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';if(error.status===429&&'retryAfterSeconds'in error&&typeof error.retryAfterSeconds==='number'&&Number.isInteger(error.retryAfterSeconds)&&error.retryAfterSeconds>0&&error.retryAfterSeconds<=86400)headers['Retry-After']=String(error.retryAfterSeconds);return reply({error:machine&&error.status===401?'Agent credential is invalid, expired or revoked.':error.message},error.status,headers);}
 console.error(JSON.stringify({event:'experiment_review_request_failed'}));return reply({error:'Experiment reviews unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Use application/json.',415);let raw:unknown;
 try{raw=await readNetworkJson(request,experimentReviewLimits.requestBytes,experimentReviewLimits.maximumDepth);}catch(error){throw new NetworkError(error instanceof NetworkBodyLimit?'Review request too large.':'Invalid review JSON.',error instanceof NetworkBodyLimit?413:400);}
 const parsed=experimentReviewCommandSchema.safeParse(raw);if(!parsed.success)throw new NetworkError('Invalid experiment review command.',400);return parsed.data;
}
async function correlate(raw:unknown,sent:ExperimentReviewCommand,author:ExperimentAuthorReference){
 const receipt=experimentReviewWriteSchema.parse(raw);if(receipt.action!==sent.action||receipt.requestId!==sent.requestId)throw Error('Review receipt action mismatch.');
 if(sent.action==='report'){
  if(!receipt.report||receipt.report.requestId!==sent.requestId||receipt.report.id!==sent.id||receipt.report.digest!==sent.digest||receipt.report.reason!==sent.reason)throw Error('Private review report receipt mismatch.');return receipt;
 }
 const item=receipt.item;if(!item||item.id!==sent.id)throw Error('Review receipt identity mismatch.');await validateExperimentReviewItem(item);
 if(sent.action==='review'){
  if(item.requestId!==sent.requestId||!same(item.author,author)||!same(item.target,sent.target)||!same(item.previous,sent.previous))throw Error('Review receipt exact target or author mismatch.');
  if(item.record&&(!same(item.record.content,experimentReviewContent(sent))||item.record.policyAccepted!==sent.policyAccepted||await experimentDigest(JSON.stringify(item.record))!==item.digest))throw Error('Review receipt content mismatch.');
 }else{
  if(item.digest!==sent.digest)throw Error('Review receipt digest mismatch.');const event=item.moderation.find(event=>event.requestId===sent.requestId);if(!event||!same(event.actor,author)||event.reason!==sent.reason||event.state!==(sent.action==='withdraw'?'WITHDRAWN':sent.state))throw Error('Review receipt disposition mismatch.');
 }
 return receipt;
}
async function finalForwardReview(factory:()=>Repository,item:ReturnType<typeof experimentReviewGetSchema.parse>['item'],expectedHead?:{id:string;digest:string;sequence:number},forwardPage=false,requestRepo?:Repository){if(requestRepo?.confirmCommitment){const current=await requestRepo.confirmCommitment(item);if(current)return current;}if(item.method==='PROGRAM_FORWARD_COMMITMENT')throw Error('An exact request-local commitment review fence is required.');if(item.method!=='PROGRAM_FORWARD_DEMO'&&!forwardPage)return item;const repo=factory(),current=repo.confirmForward?await repo.confirmForward(item,expectedHead):experimentReviewGetSchema.parse(await repo.get(item.id,item.digest)).item;if(current.id!==item.id||current.digest!==item.digest||current.requestId!==item.requestId||!same(current.author,item.author)||!same(current.target,item.target)||item.record&&current.record&&!same(item.record,current.record))throw Error('Forward review identity changed at final observation.');return current;}
export async function experimentReviewPublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return method('GET');try{
  const pairs=[...new URL(request.url).searchParams],params=new Map(pairs);if(pairs.some(([key])=>!['id','outcome','digest','cursor'].includes(key))||params.size!==pairs.length)throw new NetworkError('Use supported review parameters once.',400);
  const id=params.get('id'),outcome=params.get('outcome'),digest=params.get('digest'),cursor=params.get('cursor');
  if(!digest||!hash.test(digest)||Boolean(id)===Boolean(outcome)||id&&(!uuid.test(id)||pairs.length!==2)||outcome&&(!uuid.test(outcome)||pairs.length!==(cursor===undefined?2:3))||cursor!==undefined&&!uuid.test(cursor))throw new NetworkError('Use an exact review or original outcome identity and digest.',400);
  const repo=factory();if(id){const value=experimentReviewGetSchema.parse(await repo.get(id,digest));if(value.item.id!==id||value.item.digest!==digest)throw Error('Exact review response mismatch.');await validateExperimentReviewItem(value.item);return reply({...value,item:await finalForwardReview(factory,value.item,undefined,false,repo)});}
  const preparedPage=repo.confirmCommitmentPage?experimentReviewListSchema.parse(await repo.list(outcome!,digest,cursor??null)):null;
  if(preparedPage&&repo.confirmCommitmentPage){const current=await repo.confirmCommitmentPage(preparedPage);if(current){if(!same(current.target,{id:outcome,digest})||cursor&&(current.nextCursor===cursor||current.items.some(item=>item.id===cursor)))throw Error('Commitment review page query mismatch.');return reply(current);}}
  const anchor=cursor?experimentReviewGetSchema.parse(await repo.get(cursor)).item:null;if(anchor){await validateExperimentReviewItem(anchor);if(!same(anchor.target.original,{id:outcome,digest}))throw new ExperimentReviewError('Cursor does not belong to this exact original outcome.',404);}
  const page=preparedPage??experimentReviewListSchema.parse(await repo.list(outcome!,digest,cursor??null));
  if(page.currentHead){
   let head=experimentReviewGetSchema.parse(await repo.get(page.currentHead.id,page.currentHead.digest)).item;await validateExperimentReviewItem(head);head=await finalForwardReview(factory,head,page.currentHead,page.items.some(item=>item.method==='PROGRAM_FORWARD_DEMO'));if(head.id!==page.currentHead.id||head.digest!==page.currentHead.digest||head.sequence!==page.currentHead.sequence||!same(head.target.original,page.target))throw Error('Review current head mismatch.');
   const {record,moderation,...metadata}=head;void moderation;const summary=experimentReviewSummarySchema.parse({...metadata,reasons:record?.content.reasons??[]}),listedHead=page.items.find(item=>item.id===head.id);
   if(listedHead&&!same(listedHead,summary))throw Error('Review page current head projection mismatch.');
   // OUTCOME_UNAVAILABLE does not distinguish the shared original from one reproduction.
   // Withhold this response rather than release a page predating observed suppression.
   if(head.suppression&&page.items.some(item=>item.state==='VISIBLE'))throw Error('Review page dependencies changed during projection.');
  }
  if(!same(page.target,{id:outcome,digest})||anchor&&(page.nextCursor===cursor||page.items.some(item=>item.id===cursor||item.createdAt>anchor.createdAt||item.createdAt===anchor.createdAt&&item.id>=anchor.id)))throw Error('Review page exact query or cursor mismatch.');return reply(page);
 }catch(error){return failure(error);}
}
export async function experimentReviewHumanRequest(request:Request,actor:Human,factory:()=>Repository,reviewer:(userId:string)=>boolean,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to contribute an experiment review.'},401);if(request.method!=='POST')return method('POST');try{
  const url=new URL(request.url);if(url.search)throw new NetworkError('Review commands take no query parameters.',400);if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Experiment-Review-Intent')!=='submit')throw new NetworkError('Invalid review request origin or intent.',403);
  const authorId=await experimentPublicHumanId(actor.userId);if(request.headers.get('X-Experiment-Review-Author')!==authorId)throw new NetworkError('Review author does not match the signed-in participant.',403);
  const sent=await command(request),isReviewer=reviewer(actor.userId),isModerator=moderator(actor.userId);if(sent.action==='review'&&!isReviewer)throw new NetworkError('Explicit human reviewer authorization is required.',403);if(sent.action==='moderate'&&!isModerator)throw new NetworkError('Explicit moderator authorization is required.',403);
  const repo=factory();let value=await correlate(await repo.write({kind:'HUMAN',userId:actor.userId,reviewer:isReviewer,moderator:isModerator},sent,now()),sent,{kind:'HUMAN',id:authorId,sponsorId:authorId});if(value.item)value={...value,item:await finalForwardReview(factory,value.item,undefined,false,repo)};
  if(sent.action==='review'&&!reviewer(actor.userId)||sent.action==='moderate'&&!moderator(actor.userId))throw new NetworkError('Current review authorization is required.',403);return reply(value);
 }catch(error){return failure(error);}
}
export async function experimentReviewAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');try{
  const url=new URL(request.url);if(url.protocol!=='https:'||url.search)throw new NetworkError('Review agent credentials require HTTPS and no query parameters.',403);const origin=request.headers.get('Origin');if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid request origin.',403);
  const authorization=request.headers.get('Authorization');if(!authorization||!/^Bearer og_agent_[a-f0-9-]{36}[.][a-f0-9]{64}$/.test(authorization))throw new NetworkError('A valid agent credential is required.',401);const sent=await command(request);if(sent.action!=='report')throw new NetworkError('Agents may only report reviews privately.',403);
  const principal=await identities().authenticate(authorization.slice(7),now());if(principal.credentialId!==authorization.slice(16,52))throw Error('Review credential mismatch.');const sponsorId=await experimentPublicHumanId(principal.ownerId);
  return reply(await correlate(await factory().write({kind:'AGENT',principal},sent,now()),sent,{kind:'AGENT',id:principal.agentId,sponsorId}));
 }catch(error){return failure(error,true);}
}
export async function experimentReviewMeRequest(request:Request,actor:Human,reviewer:(userId:string)=>boolean,moderator:(userId:string)=>boolean){
 if(!actor)return reply({error:'Sign in to view your review identity.'},401);if(request.method!=='GET')return method('GET');try{if(new URL(request.url).search)throw new NetworkError('Review identity takes no parameters.',400);const id=await experimentPublicHumanId(actor.userId);return reply(experimentReviewMeSchema.parse({version:1,authorId:id,sponsorId:id,reviewer:reviewer(actor.userId),moderator:moderator(actor.userId),executionEnabled:false}));}catch(error){return failure(error);}
}
export async function experimentReviewReportsRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to view review reports.'},401);if(request.method!=='GET')return method('GET');try{if(!moderator(actor.userId))throw new NetworkError('Explicit moderator authorization is required.',403);const pairs=[...new URL(request.url).searchParams];if(pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!hash.test(value)))throw new NetworkError('Use one valid private report cursor.',400);const result=experimentReviewReportsSchema.parse(await factory().reports({kind:'HUMAN',userId:actor.userId,moderator:true,reviewer:false},now(),pairs[0]?.[1]??null));if(!moderator(actor.userId))throw new NetworkError('Current moderator authorization is required.',403);return reply(result);}catch(error){return failure(error);}
}
