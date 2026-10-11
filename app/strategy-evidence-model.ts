import {z} from 'zod';
import {boundedStrategyRecord,strategyDigest,strategyPublicItemSchema} from './strategy-model';
import {experimentSummarySchema,type ExperimentPublicItem} from './experiment-model';
import {demoMetricsSchema,demoBenchmarkSchema} from './demo-model';
import {sessionStateSchema} from './session-model';

/** Compact source-prepared reads only. Existing write/storage quotas are unchanged. */
export const strategyEvidenceLimits={responseBytes:131072,maximumDepth:16,maximumNodes:8192,page:20,preferredPage:10,canonicalRows:36,sqlStatements:50,bindParameters:96} as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash=/^[0-9a-f]{64}$/;
const canonicalId=z.string().length(36).regex(uuid),canonicalHash=z.string().length(64).regex(hash);
const finite=z.number().finite();
const clock=z.string().datetime().refine(value=>new Date(value).toISOString()===value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export type StrategyEvidenceSelection={id:string;digest:string|null};
export function strategyEvidenceSelectionFromQuery(query:URLSearchParams|string):StrategyEvidenceSelection|null{
 const params=typeof query==='string'?new URLSearchParams(query):query,pairs=[...params];
 if(!pairs.length)return null;
 if(pairs.some(([name])=>!['id','digest'].includes(name))||new Set(pairs.map(([name])=>name)).size!==pairs.length)throw Error('Invalid exact strategy link.');
 const id=params.get('id'),digest=params.get('digest');
 if(!id||!canonicalId.safeParse(id).success||digest!==null&&!canonicalHash.safeParse(digest).success)throw Error('Invalid exact strategy link.');
 return {id,digest};
}
export function strategyEvidenceHref(reference:{id:string;digest:string}){
 if(!canonicalId.safeParse(reference.id).success||!canonicalHash.safeParse(reference.digest).success)throw Error('Invalid strategy reference.');
 return '/strategies?id='+reference.id+'&digest='+reference.digest;
}

const claim=z.object({type:z.enum(['ORIGINAL','REPRODUCTION','CONFLICTING']),relation:z.object({type:z.enum(['SUPPORTS','CONFLICTS']),id:canonicalId,digest:canonicalHash}).strict().nullable()}).strict().refine(value=>value.type==='ORIGINAL'?value.relation===null:value.type==='REPRODUCTION'?value.relation?.type==='SUPPORTS':value.relation?.type==='CONFLICTS');
export const strategyEvidenceObservationSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('BATCH'),status:z.enum(['COMPLETED','NO_TRADES','HALTED','REJECTED','FAILED']),artifactDigest:canonicalHash,metrics:demoMetricsSchema.nullable(),benchmark:demoBenchmarkSchema.nullable()}).strict(),
 z.object({kind:z.literal('CONTINUOUS'),status:z.enum(['ACTIVE','PAUSED','STOPPING','STOPPED','FAILED']),artifactDigest:canonicalHash,initialCapital:finite.min(.01).max(1000000),account:sessionStateSchema.shape.account,openPositions:z.number().int().min(0).max(5),closedTrades:z.number().int().min(0).max(2000),pending:z.boolean(),capacityHalted:z.boolean(),dataGap:z.boolean(),emergencyAt:clock.nullable()}).strict(),
 z.object({kind:z.literal('INTERRUPTED')}).strict(),
 z.object({kind:z.literal('ARTIFACT_UNAVAILABLE')}).strict(),
]);
export const strategyEvidenceEntrySchema=z.object({summary:experimentSummarySchema,claim:claim.nullable(),observation:strategyEvidenceObservationSchema.nullable()}).strict().superRefine((entry,ctx)=>{
 const {summary:s,claim:c,observation:o}=entry,bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Evidence projection must follow its retained record.'});
 if(!canonicalId.safeParse(s.requestId).success||[{id:s.id,digest:s.digest},s.strategy,...s.manifest?[s.manifest]:[]].some(reference=>!canonicalId.safeParse(reference.id).success||!canonicalHash.safeParse(reference.digest).success))bad();
 if(s.state!=='VISIBLE'||s.type==='MANIFEST'){if(c!==null||o!==null)bad();return;}
 if(!c||!o){bad();return;}
 if(c.relation?.id===s.id)bad();
 if(o.kind==='BATCH'||o.kind==='CONTINUOUS'){
  if(s.status!==o.status||(s.method==='CONTINUOUS_DEMO')!==(o.kind==='CONTINUOUS'))bad();
  if(o.kind==='BATCH'&&(o.status==='REJECTED'&&(o.metrics!==null||o.benchmark!==null)||o.status==='FAILED'&&o.metrics?.comparable))bad();
 }else if(s.status!==o.kind)bad();
});
export type StrategyEvidenceEntry=z.infer<typeof strategyEvidenceEntrySchema>;
export const strategyEvidencePageSchema=z.object({version:z.literal(1),strategy:strategyPublicItemSchema,items:z.array(strategyEvidenceEntrySchema).max(strategyEvidenceLimits.page),nextCursor:canonicalId.nullable(),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),executionEnabled:z.literal(false),ordersEnabled:z.literal(false)}).strict().superRefine((page,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Evidence page must match one exact strategy and retained ordering.'});
 if(!canonicalId.safeParse(page.strategy.id).success||!canonicalHash.safeParse(page.strategy.digest).success)bad();
 if(new Set(page.items.map(entry=>entry.summary.id)).size!==page.items.length)bad();
 for(let n=0;n<page.items.length;n++){
  const item=page.items[n].summary,previous=page.items[n-1]?.summary;
  if(!same(item.strategy,{id:page.strategy.id,digest:page.strategy.digest})||page.strategy.state!=='VISIBLE'&&item.state==='VISIBLE'||previous&&(item.createdAt>previous.createdAt||item.createdAt===previous.createdAt&&item.id>=previous.id))bad();
 }
 if(page.nextCursor!==null&&(!page.items.length||page.nextCursor!==page.items.at(-1)!.summary.id))bad();
});
export type StrategyEvidencePage=z.infer<typeof strategyEvidencePageSchema>;

/** Canonical full items must already be checked by the repository. This projection
 * deliberately omits inputs/artifacts; it cannot independently authenticate metrics. */
export function strategyEvidenceEntryForItem(item:ExperimentPublicItem):StrategyEvidenceEntry{
 const {record,moderation,...metadata}=item;void moderation;
 const summary=experimentSummarySchema.parse({...metadata,...record?.version===2?{method:'CONTINUOUS_DEMO'}:{},name:record?.content.name??null,status:record?.type==='OUTCOME'?(record.content.result.kind==='ARTIFACT'?(record.version===2?record.content.result.artifact.projection.status:record.content.result.artifact.status):record.content.result.kind):null,flags:record?.flags??[]});
 let projectedClaim:StrategyEvidenceEntry['claim']=null,observation:StrategyEvidenceEntry['observation']=null;
 if(record?.type==='OUTCOME'){
  projectedClaim={type:record.content.claim.type,relation:record.content.claim.relation};
  const result=record.content.result;
  if(result.kind!=='ARTIFACT')observation={kind:result.kind};
  else if(record.version===2){
   const artifact=record.content.result.kind==='ARTIFACT'?record.content.result.artifact:null;
   if(!artifact)throw Error('Missing continuous artifact.');
   const p=artifact.projection;
   observation={kind:'CONTINUOUS',status:p.status,artifactDigest:artifact.resultDigest,initialCapital:artifact.input.config.initialCapital,account:p.account,openPositions:p.openPositions.length,closedTrades:p.trades.length,pending:p.pending!==null,capacityHalted:p.capacityHalted,dataGap:p.dataGap,emergencyAt:p.emergencyAt};
  }else{
   const artifact=record.content.result.kind==='ARTIFACT'?record.content.result.artifact:null;
   if(!artifact)throw Error('Missing batch artifact.');
   observation={kind:'BATCH',status:artifact.status,artifactDigest:artifact.resultDigest,metrics:artifact.metrics,benchmark:artifact.benchmark};
  }
 }
 return strategyEvidenceEntrySchema.parse({summary,claim:projectedClaim,observation});
}

function bound(raw:unknown){
 let nodes=0;const ancestry=new Set<object>();
 function visit(value:unknown,depth:number){
  if(++nodes>strategyEvidenceLimits.maximumNodes||depth>strategyEvidenceLimits.maximumDepth)throw Error('Evidence response exceeds structural bounds.');
  if(value&&typeof value==='object'){
   const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null&&prototype!==Array.prototype||ancestry.has(value))throw Error('Evidence response must be plain JSON.');
   ancestry.add(value);const descriptors=Object.getOwnPropertyDescriptors(value);for(const property of Reflect.ownKeys(descriptors)){if(typeof property!=='string')throw Error('Evidence response must use string property names.');const descriptor=descriptors[property];if(!('value'in descriptor))throw Error('Evidence response must contain data properties.');visit(descriptor.value,depth+1);}ancestry.delete(value);
  }else if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))throw Error('Evidence response must be JSON.');
 }
 visit(raw,0);if(new TextEncoder().encode(JSON.stringify(raw)).byteLength>strategyEvidenceLimits.responseBytes)throw Error('Evidence response exceeds byte bounds.');
}
export async function validateStrategyEvidencePage(raw:unknown):Promise<StrategyEvidencePage>{
 bound(raw);const page=strategyEvidencePageSchema.parse(raw);
 if(page.strategy.record&&await strategyDigest(boundedStrategyRecord(page.strategy.record).payload)!==page.strategy.digest)throw Error('Strategy source digest mismatch.');
 return page;
}
