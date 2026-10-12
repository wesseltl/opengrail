import {StrategyError} from './strategy-model';
import {strategyLineageLimits,strategyLineageQueryFromSearch,validateStrategyLineagePage} from './strategy-lineage-model';
import type {StrategyRepository} from './strategy-store';

export const strategyLineageHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type Repository=Pick<StrategyRepository,'lineage'|'confirmLineage'>;
function reply(body:unknown,status=200){const payload=JSON.stringify(body);if(new TextEncoder().encode(payload).byteLength>strategyLineageLimits.responseBytes)throw Error('Complete lineage response exceeds its bound.');return new Response(payload,{status,headers:{...strategyLineageHeaders,'Content-Type':'application/json'}});}
/** Anonymous discovery only. Reading never creates an identity or executes a source. */
export async function strategyLineagePublicRequest(request:Request,factory:()=>Repository){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...strategyLineageHeaders,Allow:'GET'}});
 try{
  let query:ReturnType<typeof strategyLineageQueryFromSearch>;try{query=strategyLineageQueryFromSearch(new URL(request.url).searchParams);}catch{throw new StrategyError('Invalid exact lineage query.',400);}
  request.signal.throwIfAborted();
  const repo=factory(),raw=await repo.lineage(query.reference.id,query.reference.digest,query.cursor),page=await validateStrategyLineagePage(raw,query.reference);
  request.signal.throwIfAborted();
  if(query.cursor&&(page.nextCursor===query.cursor||page.items.some(edge=>edge.item.id===query.cursor)))throw Error('Repeated exact lineage cursor.');
  if(JSON.stringify(page)!==JSON.stringify(raw))throw Error('Lineage response normalization changed retained material.');
  await repo.confirmLineage(raw);
  request.signal.throwIfAborted();
  return reply(page);
 }catch(error){
  if(error instanceof StrategyError&&(error.status===400||error.status===404))return reply({error:error.status===400?'Use one exact strategy identity and digest with an optional cursor.':'Exact strategy version or lineage cursor not found.'},error.status);
  console.error(JSON.stringify({event:'strategy_lineage_request_failed'}));return reply({error:'Strategy lineage unavailable. Retained records were preserved.'},503);
 }
}
