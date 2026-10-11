import {z} from 'zod';
import {NetworkError} from './network-model';
import type {NetworkRepository} from './network-store';
import {readNetworkJson,NetworkBodyLimit} from './network-json';
import {ExperimentError,experimentLimits,experimentDigest,experimentPublicHumanId,experimentCommandSchema,experimentListSchema,experimentGetSchema,experimentOutcomesSchema,experimentWriteSchema,experimentMeSchema,experimentReportsSchema,validateExperimentItem,experimentInputStrategy,type ExperimentCommand,type ExperimentAuthorReference} from './experiment-model';
import type {ExperimentRepository} from './experiment-store';

export const experimentHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Human={userId:string}|null;
type Repository=Pick<ExperimentRepository,'list'|'get'|'outcomes'|'write'|'reports'>;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase());
function reply(body:unknown,status=200,headers:Record<string,string>={}){
 const payload=JSON.stringify(body);
 if(new TextEncoder().encode(payload).byteLength>experimentLimits.requestBytes)throw Error('Experiment response exceeds its bound.');
 return new Response(payload,{status,headers:{...experimentHeaders,'Content-Type':'application/json',...headers}});
}
const method=(allowed:string)=>new Response(null,{status:405,headers:{...experimentHeaders,Allow:allowed}});
async function integrity(raw:unknown){
 try{return await validateExperimentItem(raw);}
 catch{throw Error('Experiment response integrity failure.');}
}
function failure(error:unknown,machine=false){
 if((error instanceof ExperimentError||error instanceof NetworkError)&&error.status<500){
  const wait='retryAfterSeconds' in error?error.retryAfterSeconds:null,headers:Record<string,string>={};
  if(error.status===429&&typeof wait==='number'&&Number.isInteger(wait)&&wait>0&&wait<=86400)headers['Retry-After']=String(wait);
  if(machine&&error.status===401)headers['WWW-Authenticate']='Bearer';
  return reply({error:error.status===401&&machine?'Agent credential is invalid, expired or revoked.':error.message},error.status,headers);
 }
 console.error(JSON.stringify({event:'experiment_request_failed'}));
 return reply({error:'Experiments unavailable. Reconcile an uncertain write with the identical command.'},503);
}
async function command(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new NetworkError('Use application/json.',415);
 let raw:unknown;
 try{raw=await readNetworkJson(request,experimentLimits.requestBytes,16);}
 catch(error){throw new NetworkError(error instanceof NetworkBodyLimit?'Request too large.':'Invalid JSON request.',error instanceof NetworkBodyLimit?413:400);}
 const parsed=experimentCommandSchema.safeParse(raw);
 if(!parsed.success)throw new NetworkError('Invalid public experiment command.',400);
 return parsed.data;
}
async function correlate(raw:unknown,sent:ExperimentCommand,author:ExperimentAuthorReference,agentName?:string){
 const result=experimentWriteSchema.parse(raw);
 if(result.action!==sent.action||result.requestId!==sent.requestId)throw Error('Experiment receipt command mismatch.');
 if(sent.action==='report'){
  if(!result.report||result.report.requestId!==sent.requestId||result.report.id!==sent.id||result.report.digest!==sent.digest||result.report.reason!==sent.reason)throw Error('Experiment report receipt mismatch.');
 }else{
  const item=result.item;
  if(!item||item.id!==sent.id)throw Error('Experiment receipt target mismatch.');
  await integrity(item);
  if(sent.action==='register'||sent.action==='outcome'){
   if(item.type!==(sent.action==='register'?'MANIFEST':'OUTCOME')||item.requestId!==sent.requestId||JSON.stringify(item.author)!==JSON.stringify(author))throw Error('Experiment authorship mismatch.');
   if(sent.action==='register'){
    const source=experimentInputStrategy(sent.input);
    if(item.strategy.id!==source.record.id||item.strategy.digest!==source.digest)throw Error('Experiment strategy mismatch.');
   }
   if(sent.action==='outcome'&&JSON.stringify(item.manifest)!==JSON.stringify(sent.manifest))throw Error('Experiment manifest mismatch.');
   if(item.record){
    const {action,requestId,id,policyAccepted,...content}=sent;
    void action;void requestId;void id;
    if(JSON.stringify(item.record.content)!==JSON.stringify(content)||item.record.policyAccepted!==policyAccepted||await experimentDigest(JSON.stringify(item.record))!==item.digest)throw Error('Experiment receipt content mismatch.');
    if(item.record.author.kind==='AGENT'&&item.record.author.name!==agentName)throw Error('Experiment agent attribution mismatch.');
   }
  }else{
   if(item.digest!==sent.digest)throw Error('Experiment receipt digest mismatch.');
   const event=item.moderation.find(value=>value.requestId===sent.requestId),state=sent.action==='withdraw'?'WITHDRAWN':sent.state;
   if(!event||event.state!==state||event.reason!==sent.reason||JSON.stringify(event.actor)!==JSON.stringify(author))throw Error('Experiment disposition receipt mismatch.');
  }
 }
 return result;
}
export async function experimentPublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return method('GET');
 try{
  const pairs=[...new URL(request.url).searchParams];
  if(pairs.some(([key])=>!['cursor','id','outcomes'].includes(key))||new Set(pairs.map(([key])=>key)).size!==pairs.length)throw new NetworkError('Use supported experiment query parameters once.',400);
  const params=new Map(pairs),id=params.get('id'),manifest=params.get('outcomes'),cursor=params.get('cursor');
  for(const value of params.values())if(!uuid.safeParse(value).success)throw new NetworkError('Invalid experiment identity or cursor.',400);
  if(id){
   if(pairs.length!==1)throw new NetworkError('An experiment detail takes only its identity.',400);
   const result=experimentGetSchema.parse(await factory().get(id));
   if(result.item.id!==id)throw Error('Experiment identity response mismatch.');
   await integrity(result.item);
   return reply(result);
  }
  if(manifest){
   if(pairs.length>2)throw new NetworkError('An outcome page takes its manifest and optional cursor.',400);
   const result=experimentOutcomesSchema.parse(await factory().outcomes(manifest,cursor??null));
   if(new Set(result.items.map(item=>item.id)).size!==result.items.length||result.items.some(item=>item.type!=='OUTCOME'||item.manifest?.id!==manifest))throw Error('Experiment outcome page mismatch.');
   return reply(result);
  }
  if(pairs.length>1)throw new NetworkError('Use one experiment cursor.',400);
  const result=experimentListSchema.parse(await factory().list(cursor??null));
  if(new Set(result.items.map(item=>item.id)).size!==result.items.length||result.items.some(item=>item.type!=='MANIFEST'))throw Error('Experiment feed mismatch.');
  return reply(result);
 }catch(error){return failure(error);}
}
export async function experimentHumanRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to contribute an experiment.'},401);
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.search)throw new NetworkError('Experiment commands take no query parameters.',400);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Experiment-Intent')!=='submit')throw new NetworkError('Invalid request origin or intent.',403);
  const sent=await command(request),sponsorId=await experimentPublicHumanId(actor.userId);
  const expectedAuthor=request.headers.get('X-Experiment-Author');
  if(expectedAuthor!==null&&expectedAuthor!==sponsorId)throw new NetworkError('Experiment author does not match the signed-in participant.',403);
  return reply(await correlate(await factory().write({kind:'HUMAN',userId:actor.userId,moderator:moderator(actor.userId)},sent,now()),sent,{kind:'HUMAN',id:sponsorId,sponsorId}));
 }catch(error){return failure(error);}
}
export async function experimentAgentRequest(request:Request,factory:()=>Repository,identities:()=>Pick<NetworkRepository,'authenticate'>,now=()=>new Date().toISOString()){
 if(request.method!=='POST')return method('POST');
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:')throw new NetworkError('Agent credentials require HTTPS.',403);
  if(url.search)throw new NetworkError('Credentials belong only in the Authorization header.',400);
  const origin=request.headers.get('Origin');
  if(origin!==null&&origin!==url.origin)throw new NetworkError('Invalid request origin.',403);
  const authorization=request.headers.get('Authorization');
  if(!authorization||!/^Bearer og_agent_[a-f0-9-]{36}[.][a-f0-9]{64}$/.test(authorization))throw new NetworkError('A valid agent credential is required.',401);
  const sent=await command(request),principal=await identities().authenticate(authorization.slice(7),now());
  if(principal.credentialId!==authorization.slice(16,52))throw Error('Experiment credential identity mismatch.');
  const sponsorId=await experimentPublicHumanId(principal.ownerId);
  return reply(await correlate(await factory().write({kind:'AGENT',principal},sent,now()),sent,{kind:'AGENT',id:principal.agentId,sponsorId},principal.name));
 }catch(error){return failure(error,true);}
}
export async function experimentMeRequest(request:Request,actor:Human,moderator:(userId:string)=>boolean){
 if(!actor)return reply({error:'Sign in to view your experiment identity.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(new URL(request.url).search)throw new NetworkError('Experiment identity takes no query parameters.',400);
  const id=await experimentPublicHumanId(actor.userId);
  return reply(experimentMeSchema.parse({version:1,authorId:id,sponsorId:id,moderator:moderator(actor.userId),executionEnabled:false}));
 }catch(error){return failure(error);}
}
export async function experimentReportsRequest(request:Request,actor:Human,factory:()=>Repository,moderator:(userId:string)=>boolean,now=()=>new Date().toISOString()){
 if(!actor)return reply({error:'Sign in to view the moderation queue.'},401);
 if(request.method!=='GET')return method('GET');
 try{
  if(!moderator(actor.userId))throw new NetworkError('Explicit maintainer authorization is required.',403);
  const pairs=[...new URL(request.url).searchParams];
  if(pairs.length>1||pairs.some(([key,value])=>key!=='cursor'||!/^[a-f0-9]{64}$/.test(value)))throw new NetworkError('Use one valid moderation cursor.',400);
  return reply(experimentReportsSchema.parse(await factory().reports({kind:'HUMAN',userId:actor.userId,moderator:true},now(),pairs[0]?.[1]??null)));
 }catch(error){return failure(error);}
}
