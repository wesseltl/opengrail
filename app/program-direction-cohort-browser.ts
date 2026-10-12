import {parseUniqueJson} from './unique-json';
import {strategyGetSchema,type StrategyPublicItem} from './strategy-model';
import {verifyProgramSource} from './program-link';
import {boundedProgramDirectionSearchValue} from './program-direction-search-model';
import {strategyLineageApiHref,strategyLineageLimits,validateStrategyLineagePage} from './strategy-lineage-model';
import {programDirectionCohortLimits} from './program-direction-cohort-model';
import {programDirectionCohortHref,type ProgramDirectionCohortReference} from './program-direction-cohort-link';

export class ProgramDirectionCohortSourceUnavailable extends Error{}
export async function readProgramDirectionCohortJson(response:Response,maximum:number,signal:AbortSignal):Promise<unknown>{
 const reader=response.body?.getReader();if(!reader)throw Error('The complete response is unavailable.');let total=0;const chunks:Uint8Array[]=[];
 try{for(;;){signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();if(part.done)break;total+=part.value.byteLength;if(total>maximum){await reader.cancel();throw Error('Whole input exceeds its declared byte bound.');}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const value=parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,programDirectionCohortLimits.maximumDepth);boundedProgramDirectionSearchValue(value,maximum);return value;
}
const options=(signal:AbortSignal)=>({cache:'no-store' as const,credentials:'same-origin' as const,redirect:'error' as const,signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
function same(left:unknown,right:unknown){return JSON.stringify(left)===JSON.stringify(right);}
export function programDirectionCohortSourceContinues(previous:StrategyPublicItem,current:StrategyPublicItem):boolean{
 const identity=({record:_record,moderation:_moderation,state:_state,reason:_reason,...value}:StrategyPublicItem)=>{void _record;void _moderation;void _state;void _reason;return value;};
 return same(identity(previous),identity(current))&&same(previous.record,current.record)&&current.moderation.length>=previous.moderation.length&&same(current.moderation.slice(0,previous.moderation.length),previous.moderation);
}
/** Same-origin, read-only and whole-closure checked. No guest, write or financial authority. */
export async function readCurrentProgramDirectionCohortSource(reference:ProgramDirectionCohortReference,signal:AbortSignal,previous?:StrategyPublicItem):Promise<StrategyPublicItem>{
 programDirectionCohortHref(reference);signal.throwIfAborted();
 const exact=await fetch('/api/strategies?id='+reference.id,options(signal));
 if(exact.status===404)throw new ProgramDirectionCohortSourceUnavailable('Exact source unavailable.');if(!exact.ok)throw Error('Current source read unconfirmed.');
 let item:StrategyPublicItem;try{item=strategyGetSchema.parse(await readProgramDirectionCohortJson(exact,programDirectionCohortLimits.sourceBytes,signal)).item;}catch{signal.throwIfAborted();throw new ProgramDirectionCohortSourceUnavailable('Exact source consistency is unavailable.');}
 if(item.id!==reference.id||item.digest!==reference.digest||item.state!=='VISIBLE'||!item.record)throw new ProgramDirectionCohortSourceUnavailable('Exact source unavailable.');
 let source:StrategyPublicItem;try{source=await verifyProgramSource(reference,item);}catch{signal.throwIfAborted();throw new ProgramDirectionCohortSourceUnavailable('Exact source consistency is unavailable.');}signal.throwIfAborted();
 const response=await fetch(strategyLineageApiHref(reference),options(signal));
 if(response.status===404||response.status===409)throw new ProgramDirectionCohortSourceUnavailable('Source lineage unavailable.');if(!response.ok)throw Error('Current lineage read unconfirmed.');
 let page:Awaited<ReturnType<typeof validateStrategyLineagePage>>;try{page=await validateStrategyLineagePage(await readProgramDirectionCohortJson(response,strategyLineageLimits.responseBytes,signal),reference);}catch{signal.throwIfAborted();throw new ProgramDirectionCohortSourceUnavailable('Exact lineage consistency is unavailable.');}signal.throwIfAborted();
 const {suppression,...anchor}=page.anchor;
 if(suppression!==null||anchor.state!=='VISIBLE'||!anchor.record)throw new ProgramDirectionCohortSourceUnavailable('Source or an ancestor is unavailable.');
 const visible=await verifyProgramSource(reference,anchor);signal.throwIfAborted();
 if(!programDirectionCohortSourceContinues(source,visible)||previous&&!programDirectionCohortSourceContinues(previous,visible))throw new ProgramDirectionCohortSourceUnavailable('Source identity or retained moderation changed.');
 return visible;
}
/** Each pass closes over every source; callers repeat at their own final acknowledgement. */
export async function readCurrentProgramDirectionCohortSources(sources:StrategyPublicItem[],signal:AbortSignal):Promise<StrategyPublicItem[]>{
 boundedProgramDirectionSearchValue(sources,programDirectionCohortLimits.sourceBytes*4);
 if(sources.length<2||sources.length>4)throw Error('An exact two-to-four program cohort is required.');
 const current:StrategyPublicItem[]=[];for(const source of sources)current.push(await readCurrentProgramDirectionCohortSource({id:source.id,digest:source.digest},signal,source));return current;
}
