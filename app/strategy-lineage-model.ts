import {z} from 'zod';
import {boundedStrategyRecord,strategyAuthorReference,strategyDigest,strategyPublicItemSchema,strategyRelationSchema,verifyStrategyProgram,type StrategyRecord} from './strategy-model';

/** Additive read limits. No publication, execution or financial quota changes. */
export const strategyLineageLimits={page:5,responseBytes:524288,maximumDepth:24,maximumNodes:65536,ancestors:32,closure:40,sqlStatements:50,bindParameters:96} as const;
const uuid=z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const strategyLineageReferenceSchema=z.object({id:uuid,digest:hash}).strict();
export type StrategyLineageReference=z.infer<typeof strategyLineageReferenceSchema>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** A dependency may suppress a visible record without inventing a moderation state. */
export const strategyLineageNodeSchema=strategyPublicItemSchema.innerType().extend({id:uuid,rootId:uuid,requestId:uuid,suppression:z.literal('ANCESTOR_UNAVAILABLE').nullable()}).strict().superRefine((node,ctx)=>{
 const {suppression,...item}=node;
 if(suppression===null){const checked=strategyPublicItemSchema.safeParse(item);if(!checked.success)checked.error.issues.forEach(issue=>ctx.addIssue(issue));return;}
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Suppressed lineage bodies must retain truthful own moderation and safe metadata.'});
 if(node.state!=='VISIBLE'||node.record!==null)bad();
 let state='VISIBLE',reason:string|null=null;
 node.moderation.forEach((event,index)=>{if(event.sequence!==index+1||state==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(index?node.moderation[index-1].createdAt:node.createdAt))bad();state=event.state;reason=event.reason;});
 if(state!==node.state||reason!==node.reason)bad();
});
export type StrategyLineageNode=z.infer<typeof strategyLineageNodeSchema>;
export const strategyLineageEdgeSchema=z.object({relation:strategyRelationSchema,item:strategyLineageNodeSchema}).strict();
export type StrategyLineageEdge=z.infer<typeof strategyLineageEdgeSchema>;
export const strategyLineagePageSchema=z.object({version:z.literal(1),kind:z.literal('STRATEGY_LINEAGE_PAGE'),reference:strategyLineageReferenceSchema,anchor:strategyLineageNodeSchema,parent:strategyLineageEdgeSchema.nullable(),items:z.array(strategyLineageEdgeSchema).max(strategyLineageLimits.page),nextCursor:uuid.nullable(),scope:z.literal('DIRECT_RELATIONS_ONLY'),classification:z.literal('AUTHOR_REPORTED'),verification:z.literal('UNTESTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),executionEnabled:z.literal(false),ordersEnabled:z.literal(false)}).strict().superRefine((page,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Lineage must bind one exact source and ordered direct incoming relations.'});
 const relationMetadata=(child:StrategyLineageNode,parent:StrategyLineageNode,type:'FORK'|'REVISION')=>{if(Date.parse(child.createdAt)<Date.parse(parent.createdAt)||type==='REVISION'&&(child.rootId!==parent.rootId||child.revision!==parent.revision+1||!same(child.author,parent.author))||type==='FORK'&&(child.rootId!==child.id||child.revision!==1))bad();};
 if(!same(page.reference,{id:page.anchor.id,digest:page.anchor.digest}))bad();
 if(page.parent&&(page.parent.item.id===page.anchor.id||!same({id:page.parent.relation.id,digest:page.parent.relation.digest},{id:page.parent.item.id,digest:page.parent.item.digest})))bad();
 if(page.anchor.record&&!same(page.anchor.record.content.relation,page.parent?.relation??null))bad();
 if(page.parent){relationMetadata(page.anchor,page.parent.item,page.parent.relation.type);if((page.parent.item.state!=='VISIBLE'||page.parent.item.suppression!==null)&&page.anchor.record!==null)bad();}
 if(new Set(page.items.map(edge=>edge.item.id)).size!==page.items.length)bad();
 for(let i=0;i<page.items.length;i++){
  const edge=page.items[i],previous=page.items[i-1]?.item;
  if(edge.item.id===page.anchor.id||!same({id:edge.relation.id,digest:edge.relation.digest},page.reference)||edge.item.record&&!same(edge.item.record.content.relation,edge.relation)||previous&&(edge.item.createdAt>previous.createdAt||edge.item.createdAt===previous.createdAt&&edge.item.id>=previous.id))bad();
  relationMetadata(edge.item,page.anchor,edge.relation.type);
  if((page.anchor.state!=='VISIBLE'||page.anchor.suppression!==null)&&edge.item.record!==null)bad();
 }
 if(page.nextCursor!==null&&(page.items.length!==strategyLineageLimits.page||page.nextCursor!==page.items.at(-1)?.item.id))bad();
});
export type StrategyLineagePage=z.infer<typeof strategyLineagePageSchema>;

export function strategyLineageSelectionFromQuery(query:URLSearchParams|string):StrategyLineageReference|null{
 const params=typeof query==='string'?new URLSearchParams(query):query,pairs=[...params];if(!pairs.length)return null;
 if(pairs.length!==2||new Set(pairs.map(([key])=>key)).size!==2||pairs.some(([key])=>!['strategy','digest'].includes(key)))throw Error('Use one exact strategy identity and digest.');
 return strategyLineageReferenceSchema.parse({id:params.get('strategy'),digest:params.get('digest')});
}
export function strategyLineageQueryFromSearch(query:URLSearchParams|string){
 const params=typeof query==='string'?new URLSearchParams(query):query,pairs=[...params];
 if(new Set(pairs.map(([key])=>key)).size!==pairs.length||pairs.some(([key])=>!['strategy','digest','cursor'].includes(key))||pairs.length!==(params.has('cursor')?3:2))throw Error('Use one exact strategy identity and digest with an optional cursor.');
 return {reference:strategyLineageReferenceSchema.parse({id:params.get('strategy'),digest:params.get('digest')}),cursor:params.has('cursor')?uuid.parse(params.get('cursor')):null};
}
export function strategyLineageHref(reference:StrategyLineageReference){const checked=strategyLineageReferenceSchema.parse(reference);return '/strategies/lineage?strategy='+checked.id+'&digest='+checked.digest;}
export function strategyLineageApiHref(reference:StrategyLineageReference,cursor:string|null=null){const checked=strategyLineageReferenceSchema.parse(reference);return '/api/strategies/lineage?strategy='+checked.id+'&digest='+checked.digest+(cursor!==null?'&cursor='+uuid.parse(cursor):'');}

/** Parse/hash only. A fork may change source version; a revision may not. */
export function verifyStrategyLineageRelation(child:StrategyRecord,parent:StrategyRecord,parentDigest:string){
 const relation=child.content.relation;if(!relation||relation.id!==parent.id||relation.digest!==parentDigest||child.id===parent.id||Date.parse(child.createdAt)<Date.parse(parent.createdAt))throw Error('Different exact lineage parent.');
 if(relation.type==='REVISION'){
  if(child.version!==parent.version||child.rootId!==parent.rootId||child.revision!==parent.revision+1||!same(strategyAuthorReference(child.author),strategyAuthorReference(parent.author)))throw Error('Different revision root, version or author.');
 }else if(child.rootId!==child.id||child.revision!==1)throw Error('A fork must create its own attributable root.');
}
function credential(value:string){for(let i=0;i<3;i++){if(/og_agent_/i.test(value))return true;try{const next=decodeURIComponent(value);if(next===value)break;value=next;}catch{break;}}return false;}
/** Descriptor inspection precedes schema traversal and serialization. */
export function boundedStrategyLineageValue(raw:unknown){
 let nodes=0;const seen=new Set<object>();
 function visit(value:unknown,depth:number){
  if(depth>strategyLineageLimits.maximumDepth||++nodes>strategyLineageLimits.maximumNodes)throw Error('Lineage exceeds its complete structural bound.');
  if(value===null||typeof value==='boolean')return;if(typeof value==='string'){if(credential(value))throw Error('Credentials cannot enter lineage.');return;}if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Nonfinite lineage.');return;}
  if(typeof value!=='object'||seen.has(value))throw Error('Lineage requires acyclic plain JSON.');seen.add(value);
  const array=Array.isArray(value);if(array&&value.length>strategyLineageLimits.maximumNodes)throw Error('Lineage arrays exceed their complete bound.');if(Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype))throw Error('Lineage requires plain data.');
  const descriptors=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(value).some(key=>typeof key!=='string'))throw Error('Unsupported lineage key.');
  if(array&&(Object.keys(descriptors).length!==(value as unknown[]).length+1||Array.from({length:(value as unknown[]).length},(_,i)=>String(i)).some(key=>!Object.hasOwn(descriptors,key))))throw Error('Lineage arrays must be dense.');
  for(const [key,descriptor] of Object.entries(descriptors)){if(array&&key==='length')continue;if(!descriptor.enumerable||!('value'in descriptor)||credential(key)||['__proto__','prototype','constructor','toJSON'].includes(key))throw Error('Unsupported lineage descriptor.');visit(descriptor.value,depth+1);}
  seen.delete(value);
 }
 visit(raw,0);if(new TextEncoder().encode(JSON.stringify(raw)).byteLength>strategyLineageLimits.responseBytes)throw Error('Complete lineage exceeds its byte bound.');return raw;
}
export async function validateStrategyLineagePage(raw:unknown,reference?:StrategyLineageReference):Promise<StrategyLineagePage>{
 const page=strategyLineagePageSchema.parse(boundedStrategyLineageValue(raw));if(reference&&!same(page.reference,strategyLineageReferenceSchema.parse(reference)))throw Error('Different exact lineage anchor.');
 for(const node of [page.anchor,...page.parent?[page.parent.item]:[],...page.items.map(edge=>edge.item)])if(node.record){const checked=boundedStrategyRecord(node.record);await verifyStrategyProgram(checked.record);if(await strategyDigest(checked.payload)!==node.digest)throw Error('Lineage source digest differs.');}
 if(page.anchor.record&&page.parent?.item.record)verifyStrategyLineageRelation(page.anchor.record,page.parent.item.record,page.parent.item.digest);
 for(const edge of page.items)if(edge.item.record&&page.anchor.record)verifyStrategyLineageRelation(edge.item.record,page.anchor.record,page.anchor.digest);
 return page;
}
