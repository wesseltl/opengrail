import {ExperimentError,experimentGetSchema,validateExperimentItem} from './experiment-model';
import {StrategyError} from './strategy-model';
import {strategyEvidenceLimits,validateStrategyEvidencePage} from './strategy-evidence-model';
import type {ExperimentRepository} from './experiment-store';

export const strategyEvidenceHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Repository=Pick<ExperimentRepository,'forStrategy'|'get'>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
function reply(body:unknown,status=200){const payload=JSON.stringify(body);if(new TextEncoder().encode(payload).byteLength>strategyEvidenceLimits.responseBytes)throw Error('Evidence response exceeds its bound.');return new Response(payload,{status,headers:{...strategyEvidenceHeaders,'Content-Type':'application/json'}});}
function failure(error:unknown){
 if((error instanceof ExperimentError||error instanceof StrategyError)&&(error.status===400||error.status===404))return reply({error:error.status===400?'Use one exact strategy identity and digest with an optional cursor.':'Exact strategy version or cursor not found.'},error.status);
 console.error(JSON.stringify({event:'strategy_evidence_request_failed'}));return reply({error:'Strategy evidence unavailable. Retained records were preserved.'},503);
}
/** Anonymous, bounded read only. Compact observations remain author reports. */
export async function strategyEvidencePublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...strategyEvidenceHeaders,Allow:'GET'}});
 try{
  const pairs=[...new URL(request.url).searchParams],params=new Map(pairs),strategy=params.get('strategy'),digest=params.get('digest'),cursor=params.get('cursor');
  if(params.size!==pairs.length||pairs.some(([key])=>!['strategy','digest','cursor'].includes(key))||!strategy||strategy.length!==36||!uuid.test(strategy)||!digest||digest.length!==64||!hash.test(digest)||cursor!==undefined&&(cursor.length!==36||!uuid.test(cursor))||pairs.length!==(cursor===undefined?2:3))throw new ExperimentError('Invalid exact evidence query.',400);
  const repo=factory();
  let anchor:null|Awaited<ReturnType<typeof validateExperimentItem>>=null;
  if(cursor){const raw=await repo.get(cursor);try{anchor=await validateExperimentItem(experimentGetSchema.parse(raw).item);}catch{throw Error('Evidence cursor integrity failure.');}if(anchor.id!==cursor||anchor.strategy.id!==strategy||anchor.strategy.digest!==digest)throw new ExperimentError('Foreign exact evidence cursor.',404);}
  let page:Awaited<ReturnType<typeof validateStrategyEvidencePage>>;
  const raw=await repo.forStrategy(strategy,digest,cursor??null);
  try{page=await validateStrategyEvidencePage(raw);}catch{throw Error('Evidence response integrity failure.');}
  if(page.strategy.id!==strategy||page.strategy.digest!==digest||anchor&&(page.nextCursor===cursor||page.items.some(({summary:item})=>item.id===cursor||item.createdAt>anchor!.createdAt||item.createdAt===anchor!.createdAt&&item.id>=anchor!.id)))throw Error('Evidence response exact query or anchor mismatch.');
  if(anchor?.suppression==='SOURCE_UNAVAILABLE'&&page.strategy.state==='VISIBLE'||anchor?.suppression==='PARENT_UNAVAILABLE'&&page.items.some(({summary:item})=>item.state==='VISIBLE'&&(item.id===anchor!.manifest?.id||item.manifest?.id===anchor!.manifest?.id&&item.manifest?.digest===anchor!.manifest?.digest)))throw Error('Evidence dependencies changed after observed cursor suppression.');
  return reply(page);
 }catch(error){return failure(error);}
}
