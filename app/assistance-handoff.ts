import {z} from 'zod';
import {assistancePublicItemSchema,boundedAssistanceRecord,boundedAssistanceCommand,assistanceWriteSchema,type AssistancePublicItem,type AssistanceCommand} from './assistance-model';
import {strategyPublicItemSchema,boundedStrategyRecord,boundedStrategyCommand,strategyDigest,verifyStrategyProgram,strategyMeSchema,strategyWriteSchema,type StrategyPublicItem,type StrategyCommand} from './strategy-model';

export const assistanceHandoffLimits={queryBytes:512,sourceBytes:65536,bundleBytes:262144,maximumChanges:128} as const;
const id=z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),digest=z.string().length(64).regex(/^[a-f0-9]{64}$/);
const referenceSchema=z.object({id,digest}).strict();
export type AssistanceReference=z.infer<typeof referenceSchema>;
export type AssistanceSelection={kind:'BASE'|'REQUEST';reference:AssistanceReference};
type Me=z.infer<typeof strategyMeSchema>;
type RequestCommand=Extract<AssistanceCommand,{action:'request'}>;
type PublishCommand=Extract<StrategyCommand,{action:'publish'}>;
type SharedPending={body:string;principal:Me;base:StrategyPublicItem;request:AssistancePublicItem|null;response:AssistancePublicItem|null;proposal:StrategyPublicItem|null};
export type AssistancePending=SharedPending&({kind:'REQUEST';command:RequestCommand}|{kind:'ADOPTION';command:PublishCommand});
export type AssistanceBundle={base:StrategyPublicItem;request:AssistancePublicItem;response:AssistancePublicItem;proposal:StrategyPublicItem};
export class AssistanceHandoffError extends Error{constructor(message:string){super(message);}}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),bytes=(value:string)=>new TextEncoder().encode(value).byteLength;
const issued=new WeakSet<object>();
function plain(raw:unknown,maximum:number){let count=0;const ancestors=new Set<object>();function inspect(value:unknown,depth:number):void{
 if(++count>16384||depth>16)throw new AssistanceHandoffError('Assistance input exceeds structural bounds.');
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object'||Object.getOwnPropertySymbols(value).length||ancestors.has(value))throw new AssistanceHandoffError('Only plain finite JSON is accepted.');
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)throw new AssistanceHandoffError('Only plain JSON containers are accepted.');
 const descriptors=Object.getOwnPropertyDescriptors(value);if(array){const keys=Object.keys(descriptors).filter(key=>key!=='length');if(keys.length!==(value as unknown[]).length||keys.some((key,n)=>key!==String(n)))throw new AssistanceHandoffError('Only complete ordinary arrays are accepted.');}
 ancestors.add(value);for(const [key,descriptor]of Object.entries(descriptors)){if(array&&key==='length')continue;if(!('value'in descriptor)||!descriptor.enumerable)throw new AssistanceHandoffError('Input hooks and hidden fields are refused.');inspect(descriptor.value,depth+1);}ancestors.delete(value);
 }inspect(raw,0);if(bytes(JSON.stringify(raw))>maximum)throw new AssistanceHandoffError('Assistance input exceeds its byte budget.');}
function reference(raw:unknown):AssistanceReference{plain(raw,256);try{return referenceSchema.parse(raw);}catch{throw new AssistanceHandoffError('An exact canonical ID and digest are required.');}}
function noCredentials(raw:unknown,inAuthor=false):void{if(typeof raw==='string'){let value=raw;for(let n=0;n<32;n++){if(/og_local_(?:producer|owner)_/i.test(value)||!inAuthor&&/og_agent_/i.test(value))throw new AssistanceHandoffError('Credentials cannot enter assistance.');const next=value.replace(/%[a-f0-9]{2}/gi,escape=>String.fromCharCode(Number.parseInt(escape.slice(1),16)));if(next===value)return;value=next;}throw new AssistanceHandoffError('Assistance text exceeds encoded inspection bounds.');}else if(raw&&typeof raw==='object')for(const [key,value]of Object.entries(raw))noCredentials(value,inAuthor||key==='author');}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function principal(raw:unknown):Me{plain(raw,4096);try{const value=strategyMeSchema.parse(raw);if(value.authorId.length!==70||!/^human_[a-f0-9]{64}$/.test(value.authorId)||value.authorId!==value.authorId.trim())throw Error();return value;}catch{throw new AssistanceHandoffError('A current human account is required.');}}
export function parseAssistanceHandoff(query:URLSearchParams|string):AssistanceSelection|null{
 if(typeof query==='string'){if(bytes(query)>assistanceHandoffLimits.queryBytes||query!==''&&!query.startsWith('?')||query.includes('#')||/[\u0000-\u0020\u007f]/.test(query)||query.startsWith('?')&&query.slice(1).split('&').some(part=>part===''))throw new AssistanceHandoffError('Invalid assistance link.');try{decodeURIComponent(query);}catch{throw new AssistanceHandoffError('Invalid assistance link encoding.');}}
 const params=typeof query==='string'?new URLSearchParams(query):query;if(!(params instanceof URLSearchParams)||bytes(params.toString())>assistanceHandoffLimits.queryBytes)throw new AssistanceHandoffError('Invalid assistance selection.');
 const pairs=[...params];if(!pairs.length)return null;
 if(pairs.length!==2||pairs.filter(([name])=>name==='digest').length!==1||pairs.filter(([name])=>name==='base'||name==='request').length!==1)throw new AssistanceHandoffError('Select one exact base or request and its digest.');
 const kind=params.has('base')?'BASE':'REQUEST';return {kind,reference:reference({id:params.get(kind==='BASE'?'base':'request'),digest:params.get('digest')})};
}
export function assistanceHref(kind:'BASE'|'REQUEST',raw:AssistanceReference){if(kind!=='BASE'&&kind!=='REQUEST')throw new AssistanceHandoffError('Invalid assistance destination.');const value=reference(raw);return '/assistance?'+(kind==='BASE'?'base':'request')+'='+value.id+'&digest='+value.digest;}

export async function verifyAssistanceStrategy(raw:unknown,expected?:AssistanceReference,visible=false):Promise<StrategyPublicItem>{
 plain(raw,assistanceHandoffLimits.sourceBytes);noCredentials(raw);const item=strategyPublicItemSchema.parse(raw);reference({id:item.id,digest:item.digest});id.parse(item.rootId);id.parse(item.requestId);if(item.author.kind==='AGENT')id.parse(item.author.id);
 if(expected&&!same(reference(expected),{id:item.id,digest:item.digest}))throw new AssistanceHandoffError('The exact strategy changed.');
 if(item.record){await verifyStrategyProgram(item.record);if(await strategyDigest(boundedStrategyRecord(item.record).payload)!==item.digest)throw new AssistanceHandoffError('The strategy digest does not match its content.');if(item.record.content.relation)reference({id:item.record.content.relation.id,digest:item.record.content.relation.digest});}
 if(visible&&(item.state!=='VISIBLE'||!item.record))throw new AssistanceHandoffError('The exact strategy is unavailable.');
 return item;
}

export async function verifyAssistanceItem(raw:unknown,expected?:AssistanceReference,kind?:'REQUEST'|'RESPONSE',visible=false):Promise<AssistancePublicItem>{
 plain(raw,assistanceHandoffLimits.sourceBytes);noCredentials(raw);const item=assistancePublicItemSchema.parse(raw);if('domain' in item)throw new AssistanceHandoffError('Research assistance requires its separate exact research workflow.');reference({id:item.id,digest:item.digest});
 if(expected&&!same(reference(expected),{id:item.id,digest:item.digest})||kind&&item.kind!==kind)throw new AssistanceHandoffError('The exact assistance reference changed.');
 if(item.record&&await strategyDigest(boundedAssistanceRecord(item.record).payload)!==item.digest)throw new AssistanceHandoffError('The assistance digest does not match its content.');
 if(visible&&(item.state!=='VISIBLE'||item.availability!=='AVAILABLE'||!item.record))throw new AssistanceHandoffError('This assistance record or dependency is unavailable.');return item;
}

export async function validateAssistanceHandoff(raw:unknown):Promise<AssistanceBundle>{
 plain(raw,assistanceHandoffLimits.bundleBytes);const shape=z.object({base:strategyPublicItemSchema,request:assistancePublicItemSchema,response:assistancePublicItemSchema,proposal:strategyPublicItemSchema}).strict().parse(raw);
 const request=await verifyAssistanceItem(shape.request,undefined,'REQUEST',true),response=await verifyAssistanceItem(shape.response,undefined,'RESPONSE',true);
 if(request.record?.kind!=='REQUEST'||response.record?.kind!=='RESPONSE')throw new AssistanceHandoffError('A complete exact request and response are required.');
 const base=await verifyAssistanceStrategy(shape.base,request.record.base,true),proposal=await verifyAssistanceStrategy(shape.proposal,response.record.proposal,true);
 if(request.createdAt<base.createdAt||!same(response.record.request,{id:request.id,digest:request.digest})||response.author.kind!=='AGENT'||proposal.author.kind!=='AGENT'||!same(response.record.author,proposal.record?.author)||proposal.revision!==1||proposal.rootId!==proposal.id||!same(proposal.record?.content.relation,{type:'FORK',...request.record.base})||proposal.createdAt<request.createdAt||response.createdAt<proposal.createdAt||response.createdAt<request.createdAt)throw new AssistanceHandoffError('The response must link its own later agent fork of this exact base.');
 return {base,request,response,proposal};
}

export async function prepareAssistanceRequest(raw:unknown):Promise<AssistancePending>{
 plain(raw,assistanceHandoffLimits.sourceBytes+8192);noCredentials(raw);const value=z.object({base:strategyPublicItemSchema,principal:strategyMeSchema,requestId:id,id,intent:z.string(),constraints:z.string(),falsification:z.string(),confirmPublicSharing:z.literal(true)}).strict().parse(raw),base=await verifyAssistanceStrategy(value.base,undefined,true),author=principal(value.principal);
 const {command,payload}=boundedAssistanceCommand({action:'request',requestId:value.requestId,id:value.id,base:{id:base.id,digest:base.digest},intent:value.intent,constraints:value.constraints,falsification:value.falsification,policyAccepted:'public-assistance-v1'});
 if(command.action!=='request'||command.id===base.id)throw new AssistanceHandoffError('A new human request must reference its exact base.');
 const pending=freeze({kind:'REQUEST' as const,command,body:payload,principal:author,base,request:null,response:null,proposal:null});issued.add(pending);return pending;
}

export async function prepareAssistanceAdoption(raw:unknown):Promise<AssistancePending>{
 plain(raw,assistanceHandoffLimits.bundleBytes+8192);noCredentials(raw);const value=z.object({base:strategyPublicItemSchema,request:assistancePublicItemSchema,response:assistancePublicItemSchema,proposal:strategyPublicItemSchema,principal:strategyMeSchema,requestId:id,id,name:z.string().trim().min(1).max(120),confirmAdoption:z.literal(true)}).strict().parse(raw),bundle=await validateAssistanceHandoff({base:value.base,request:value.request,response:value.response,proposal:value.proposal}),author=principal(value.principal);
 if(!bundle.proposal.record)throw new AssistanceHandoffError('The proposed strategy is unavailable.');
 const content=bundle.proposal.record.content,{command,payload}=boundedStrategyCommand({action:'publish',...(bundle.proposal.record.version===2?{version:2,program:bundle.proposal.record.content.program}:{}),requestId:value.requestId,id:value.id,name:value.name,description:content.description,assumptions:content.assumptions,falsification:content.falsification,sources:content.sources,definition:content.definition,relation:{type:'FORK',id:bundle.proposal.id,digest:bundle.proposal.digest},policyAccepted:'public-strategy-v1'});
 if(command.action!=='publish'||command.id===bundle.base.id||command.id===bundle.request.id||command.id===bundle.response.id||command.id===bundle.proposal.id)throw new AssistanceHandoffError('Adoption requires a distinct human fork.');
 const pending=freeze({kind:'ADOPTION' as const,command,body:payload,principal:author,...bundle});issued.add(pending);return pending;
}

function verifyPending(raw:AssistancePending){
 if(!raw||typeof raw!=='object'||!issued.has(raw))throw new AssistanceHandoffError('Only this original prepared operation may be reconciled.');
 plain(raw,assistanceHandoffLimits.bundleBytes+32768);const expected=principal(raw.principal);if(raw.kind!=='REQUEST'&&raw.kind!=='ADOPTION')throw new AssistanceHandoffError('Invalid pending operation.');
 const canonical=raw.kind==='REQUEST'?boundedAssistanceCommand(raw.command):boundedStrategyCommand(raw.command);if(canonical.payload!==raw.body)throw new AssistanceHandoffError('The original serialized operation changed.');return expected;
}
export function validateAssistancePrincipal(raw:unknown,pending:AssistancePending){const expected=verifyPending(pending),current=principal(raw);if(!same(current,expected))throw new AssistanceHandoffError('The human account changed.');return current;}

/** Correlate exact immutable original intent even when current content is redacted.
 * Reconstructed content is used only for hashing and is never returned for a tombstone. */
export async function validateAssistancePendingReceipt(raw:unknown,pending:AssistancePending,status:number):Promise<z.infer<typeof assistanceWriteSchema>|z.infer<typeof strategyWriteSchema>>{
 const author=verifyPending(pending);plain(raw,assistanceHandoffLimits.sourceBytes);if(status!==200)throw new AssistanceHandoffError('The original operation has no confirmed receipt.');
 if(pending.kind==='REQUEST'){
  const value=assistanceWriteSchema.parse(raw),command=pending.command,item=value.item;
  if(value.action!=='request'||item&&item.createdAt<pending.base.createdAt||value.requestId!==command.requestId||value.report!==null||!item||item.kind!=='REQUEST'||item.id!==command.id||item.requestId!==command.requestId||!same(item.author,{kind:'HUMAN',id:author.authorId,sponsorId:author.sponsorId}))throw new AssistanceHandoffError('The request receipt does not match its human operation.');
  const reconstructed={version:1,kind:'REQUEST',id:command.id,requestId:command.requestId,createdAt:item.createdAt,author:{kind:'HUMAN',id:author.authorId,sponsorId:author.sponsorId},base:command.base,intent:command.intent,constraints:command.constraints,falsification:command.falsification,policyAccepted:command.policyAccepted,executionEnabled:false},canonical=boundedAssistanceRecord(reconstructed);
  if(await strategyDigest(canonical.payload)!==item.digest||item.record&&!same(item.record,canonical.record))throw new AssistanceHandoffError('The request receipt changed the original intent.');await verifyAssistanceItem(item);return value;
 }
 const value=strategyWriteSchema.parse(raw),command=pending.command,item=value.item;
 if(value.action!=='publish'||!pending.proposal||!pending.response||!pending.request||item&&(item.createdAt<pending.proposal.createdAt||item.createdAt<pending.response.createdAt||item.createdAt<pending.request.createdAt||item.createdAt<pending.base.createdAt)||value.requestId!==command.requestId||value.report!==null||!item||item.id!==command.id||item.rootId!==command.id||item.revision!==1||item.requestId!==command.requestId||!same(item.author,{kind:'HUMAN',id:author.authorId,sponsorId:author.sponsorId}))throw new AssistanceHandoffError('The adoption receipt does not match its human fork.');
 const reconstructed={version:'version' in command?command.version:1,id:command.id,rootId:command.id,revision:1,requestId:command.requestId,createdAt:item.createdAt,author:{kind:'HUMAN',id:author.authorId,sponsorId:author.sponsorId},content:{name:command.name,description:command.description,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,definition:command.definition,relation:command.relation,...('version' in command?{program:command.program}:{})},policyAccepted:command.policyAccepted,verification:'UNTESTED',executionEnabled:false},canonical=boundedStrategyRecord(reconstructed);
 if(await strategyDigest(canonical.payload)!==item.digest||item.record&&!same(item.record,canonical.record))throw new AssistanceHandoffError('The adoption receipt changed the reviewed proposal.');await verifyAssistanceStrategy(item);return value;
}

export function assistanceDefinitionChanges(base:StrategyPublicItem,proposal:StrategyPublicItem):{path:string;before:string;after:string}[]{
 if(!base.record||!proposal.record)throw new AssistanceHandoffError('Visible definitions are required for comparison.');
 const left=base.record.content.definition,right=proposal.record.content.definition,changes:{path:string;before:string;after:string}[]=[];
 function compare(a:unknown,b:unknown,path:string){if(same(a,b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];for(const key of keys)compare((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],path?path+'.'+key:key);}else{if(changes.length>=assistanceHandoffLimits.maximumChanges)throw new AssistanceHandoffError('Definition comparison exceeds its bound.');changes.push({path,before:a===undefined?'Absent':JSON.stringify(a),after:b===undefined?'Absent':JSON.stringify(b)});}}
 compare(left,right,'');return changes;
}
