import {z} from 'zod';
import type {NetworkPrincipal} from './network-store';
import {ventureDossierSchema,validateVentureSources,ventureCredentialLike} from './venture-model';

export const researchLimits={requestBytes:24576,payloadBytes:20480,publishPerSponsorDay:20,stored:3000,revisions:32,eventsPerRecord:16,reportsPerSponsorDay:10,reportsStored:1000,page:20} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/),humanId=z.string().regex(/^human_[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const text=(maximum:number,minimum=1)=>z.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>!tokenLike(value),'Agent credentials cannot be published.');
function tokenLike(value:string){for(let n=0;n<3;n++){if(/og_agent_/i.test(value))return true;try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}}return false;}
const kind=z.enum(['HYPOTHESIS','OBSERVATION','FAILURE','CHALLENGE']);
const policy=z.literal('public-research-v1');
export const researchSourceSchema=z.object({url:text(2048).refine(value=>{try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}}),classification:z.enum(['PRIMARY','SECONDARY','AUTHOR_CLAIM','ESTIMATE','SPECULATION']),note:text(300,0)}).strict();
export const researchRelationSchema=z.object({type:z.enum(['REVISION','FORK','CHALLENGE']),id:uuid,digest:hash}).strict();
const contentFields={kind,title:text(120),statement:text(4000),assumptions:text(1500),falsification:text(2000),sources:z.array(researchSourceSchema).max(8),relation:researchRelationSchema.nullable()};
export const researchPublishV1Schema=z.object({action:z.literal('publish'),requestId:uuid,id:uuid,...contentFields,policyAccepted:policy}).strict().superRefine((command,ctx)=>{
 if(command.kind==='CHALLENGE'&&command.relation?.type!=='CHALLENGE'&&command.relation?.type!=='REVISION')ctx.addIssue({code:z.ZodIssueCode.custom,path:['relation'],message:'A challenge must reference its exact target or revise an existing challenge.'});
 if(command.relation?.type==='CHALLENGE'&&command.kind!=='CHALLENGE')ctx.addIssue({code:z.ZodIssueCode.custom,path:['kind'],message:'A challenge relation requires challenge research.'});
 if(command.relation?.id===command.id)ctx.addIssue({code:z.ZodIssueCode.custom,path:['relation'],message:'A publication cannot reference itself.'});
});
const ventureContentFields={...contentFields,domain:z.literal('VENTURE'),venture:ventureDossierSchema};
export const researchPublishV2Schema=z.object({version:z.literal(2),action:z.literal('publish'),requestId:uuid,id:uuid,...ventureContentFields,policyAccepted:policy}).strict().superRefine((command,ctx)=>{
 if(command.kind==='CHALLENGE'&&command.relation?.type!=='CHALLENGE'&&command.relation?.type!=='REVISION')ctx.addIssue({code:z.ZodIssueCode.custom,path:['relation'],message:'A challenge must reference its exact target or revise an existing challenge.'});
 if(command.relation?.type==='CHALLENGE'&&command.kind!=='CHALLENGE')ctx.addIssue({code:z.ZodIssueCode.custom,path:['kind'],message:'A challenge relation requires challenge research.'});
 if(command.relation?.id===command.id)ctx.addIssue({code:z.ZodIssueCode.custom,path:['relation'],message:'A publication cannot reference itself.'});
 if([command.title,command.statement,command.assumptions,command.falsification,...command.sources.flatMap(source=>[source.url,source.note])].some(ventureCredentialLike))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Credentials cannot be published in venture research.'});
 try{validateVentureSources(command.venture,command.sources);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,path:['venture'],message:'Invalid venture sources or dates.'});}
});
export const researchPublishSchema=z.union([researchPublishV1Schema,researchPublishV2Schema]);
export type ResearchPublishCommand=z.infer<typeof researchPublishSchema>;
/** Old field order is retained exactly; the venture domain is additive. */
export function researchPublicationContent(command:ResearchPublishCommand){
 const content={kind:command.kind,title:command.title,statement:command.statement,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,relation:command.relation};
 return 'version' in command?{...content,domain:command.domain,venture:command.venture}:content;
}
export function researchPublicationVersion(command:ResearchPublishCommand):1|2{return 'version' in command?2:1;}
export function researchPublishCommandForRecord(record:ResearchRecord):ResearchPublishCommand{
 const command={action:'publish' as const,requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted};
 return researchPublishSchema.parse(record.version===2?{version:2,...command}:command);
}
const common={requestId:uuid,id:uuid,digest:hash,policyAccepted:policy};
export const researchWithdrawSchema=z.object({action:z.literal('withdraw'),...common,reason:z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE'])}).strict();
export const researchReportSchema=z.object({action:z.literal('report'),...common,reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','OTHER']),details:text(1500)}).strict();
export const researchModerateSchema=z.object({action:z.literal('moderate'),...common,state:z.enum(['VISIBLE','HIDDEN']),reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','POLICY','RESTORED'])}).strict().refine(command=>(command.state==='VISIBLE')===(command.reason==='RESTORED'),'Restoration uses RESTORED; hiding uses a policy reason.');
export const researchCommandSchema=z.union([researchPublishSchema,researchWithdrawSchema,researchReportSchema,researchModerateSchema]);
export type ResearchCommand=z.infer<typeof researchCommandSchema>;
export type ResearchActor={kind:'HUMAN';userId:string;moderator:boolean}|{kind:'AGENT';principal:NetworkPrincipal};
export const researchAuthorReferenceSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('HUMAN'),id:humanId,sponsorId:humanId}).strict(),
 z.object({kind:z.literal('AGENT'),id:uuid,sponsorId:humanId}).strict(),
]).refine(author=>author.kind!=='HUMAN'||author.id===author.sponsorId,'A human is their own sponsor.');
export type ResearchAuthorReference=z.infer<typeof researchAuthorReferenceSchema>;
export const researchAuthorSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('HUMAN'),id:humanId,sponsorId:humanId}).strict(),
 z.object({kind:z.literal('AGENT'),id:uuid,sponsorId:humanId,name:z.string().trim().min(1).max(48).regex(/^[^\u0000-\u001f\u007f]+$/)}).strict(),
]);
export type ResearchAuthor=z.infer<typeof researchAuthorSchema>;
export const researchRecordV1Schema=z.object({version:z.literal(1),id:uuid,rootId:uuid,revision:z.number().int().min(1).max(researchLimits.revisions),requestId:uuid,createdAt:clock,author:researchAuthorSchema,content:z.object(contentFields).strict(),policyAccepted:policy,verification:z.literal('UNVERIFIED'),executionEnabled:z.literal(false)}).strict().superRefine((record,ctx)=>{
 if(record.author.kind==='HUMAN'&&record.author.id!==record.author.sponsorId)ctx.addIssue({code:z.ZodIssueCode.custom,path:['author'],message:'A human is their own sponsor.'});
 if((record.revision===1)!==(record.rootId===record.id))ctx.addIssue({code:z.ZodIssueCode.custom,path:['rootId'],message:'Only the first revision creates its own root.'});
 if((record.revision>1)!==(record.content.relation?.type==='REVISION'))ctx.addIssue({code:z.ZodIssueCode.custom,path:['revision'],message:'Revisions must reference a prior revision.'});
 const command=researchPublishSchema.safeParse({action:'publish',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});if(!command.success)command.error.issues.forEach(issue=>ctx.addIssue({...issue,path:['content',...issue.path]}));
});
export const researchRecordV2Schema=z.object({version:z.literal(2),id:uuid,rootId:uuid,revision:z.number().int().min(1).max(researchLimits.revisions),requestId:uuid,createdAt:clock,author:researchAuthorSchema,content:z.object(ventureContentFields).strict(),policyAccepted:policy,verification:z.literal('UNVERIFIED'),executionEnabled:z.literal(false)}).strict().superRefine((record,ctx)=>{
 if(record.author.kind==='HUMAN'&&record.author.id!==record.author.sponsorId)ctx.addIssue({code:z.ZodIssueCode.custom,path:['author'],message:'A human is their own sponsor.'});
 if((record.revision===1)!==(record.rootId===record.id))ctx.addIssue({code:z.ZodIssueCode.custom,path:['rootId'],message:'Only the first revision creates its own root.'});
 if((record.revision>1)!==(record.content.relation?.type==='REVISION'))ctx.addIssue({code:z.ZodIssueCode.custom,path:['revision'],message:'Revisions must reference a prior revision.'});
 const command=researchPublishV2Schema.safeParse({version:2,action:'publish',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});if(!command.success)command.error.issues.forEach(issue=>ctx.addIssue({...issue,path:['content',...issue.path]}));
 try{validateVentureSources(record.content.venture,record.content.sources,record.createdAt);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,path:['content','venture'],message:'Invalid venture sources or dates.'});}
});
export const researchRecordSchema=z.union([researchRecordV1Schema,researchRecordV2Schema]);
export type ResearchRecord=z.infer<typeof researchRecordSchema>;
const state=z.enum(['VISIBLE','HIDDEN','WITHDRAWN']);
const safeReason=z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE','SPAM','ABUSE','MISLEADING','POLICY','RESTORED']);
export const researchPublicEventSchema=z.object({sequence:z.number().int().min(1).max(researchLimits.eventsPerRecord),requestId:uuid,createdAt:clock,actor:researchAuthorReferenceSchema,state,reason:safeReason}).strict();
export type ResearchPublicEvent=z.infer<typeof researchPublicEventSchema>;
export const researchPublicItemSchema=z.object({id:uuid,digest:hash,rootId:uuid,revision:z.number().int().min(1).max(researchLimits.revisions),requestId:uuid,createdAt:clock,author:researchAuthorReferenceSchema,state,reason:safeReason.nullable(),record:researchRecordSchema.nullable(),moderation:z.array(researchPublicEventSchema).max(researchLimits.eventsPerRecord)}).strict().superRefine((item,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if((item.state==='VISIBLE')!==(item.record!==null))bad('Non-visible research must be a content-free tombstone.');
 if(item.record&&(item.id!==item.record.id||item.rootId!==item.record.rootId||item.revision!==item.record.revision||item.requestId!==item.record.requestId||item.createdAt!==item.record.createdAt||JSON.stringify(item.author)!==JSON.stringify(researchAuthorReference(item.record.author))))bad('Public identity must match the retained record.');
 let current='VISIBLE';let reason:string|null=null;
 item.moderation.forEach((event,index)=>{if(event.sequence!==index+1||current==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(index?item.moderation[index-1].createdAt:item.createdAt))bad('Moderation history is inconsistent.');current=event.state;reason=event.reason;});
 if(current!==item.state||reason!==item.reason)bad('Public state must match its retained events.');
});
export type ResearchPublicItem=z.infer<typeof researchPublicItemSchema>;
export const researchListSchema=z.object({version:z.literal(1),items:z.array(researchPublicItemSchema).max(researchLimits.page),nextCursor:uuid.nullable(),executionEnabled:z.literal(false)}).strict();
export const researchVentureListSchema=z.object({version:z.literal(1),domain:z.literal('VENTURE'),items:z.array(researchPublicItemSchema).max(researchLimits.page),nextCursor:uuid.nullable(),executionEnabled:z.literal(false)}).strict().superRefine((page,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(new Set(page.items.map(item=>item.id)).size!==page.items.length||new Set(page.items.map(item=>`${item.rootId}:${item.revision}`)).size!==page.items.length)bad('Venture identities must be unique.');
 page.items.forEach((item,index)=>{if(item.record&&(item.record.version!==2||item.record.content.domain!=='VENTURE'))bad('Visible venture pages require exact venture records.');const previous=page.items[index-1];if(previous&&(item.createdAt>previous.createdAt||(item.createdAt===previous.createdAt&&item.id>=previous.id)))bad('Venture entries must be strictly newest first.');});
 if(page.nextCursor!==null&&(page.items.length!==researchLimits.page||page.nextCursor!==page.items.at(-1)?.id))bad('Venture cursor must identify the final full-page entry.');
});
export const researchGetSchema=z.object({version:z.literal(1),item:researchPublicItemSchema,executionEnabled:z.literal(false)}).strict();
export const researchHistorySchema=z.object({version:z.literal(1),items:z.array(researchPublicItemSchema).max(researchLimits.revisions),executionEnabled:z.literal(false)}).strict();
/** Direct references to one immutable publication, never an automatically selected revision. */
export const researchThreadSchema=z.object({version:z.literal(1),target:researchPublicItemSchema,items:z.array(researchPublicItemSchema).max(researchLimits.page),nextCursor:uuid.nullable(),executionEnabled:z.literal(false)}).strict().superRefine((thread,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(thread.target.state!=='VISIBLE'&&(thread.items.length!==0||thread.nextCursor!==null))bad('Unavailable research has no public thread contents.');
 if(new Set(thread.items.map(item=>item.id)).size!==thread.items.length||new Set(thread.items.map(item=>`${item.rootId}:${item.revision}`)).size!==thread.items.length)bad('Thread identities must be unique.');
 thread.items.forEach((item,index)=>{
  if(item.id===thread.target.id||Date.parse(item.createdAt)<Date.parse(thread.target.createdAt))bad('Thread children must follow their exact target.');
  const relation=item.record?.content.relation;
  if(item.record&&(!relation||relation.id!==thread.target.id||relation.digest!==thread.target.digest))bad('Visible thread children must reference their exact target.');
  if(relation?.type==='REVISION'&&(item.rootId!==thread.target.rootId||item.revision!==thread.target.revision+1||JSON.stringify(item.author)!==JSON.stringify(thread.target.author)||item.record?.content.kind!==thread.target.record?.content.kind||item.record?.version!==thread.target.record?.version||JSON.stringify(item.record?.version===2?item.record.content.domain:null)!==JSON.stringify(thread.target.record?.version===2?thread.target.record.content.domain:null)))bad('Direct revisions must preserve their exact parent lineage.');
  const previous=thread.items[index-1];
  if(previous&&(item.createdAt>previous.createdAt||(item.createdAt===previous.createdAt&&item.id>=previous.id)))bad('Thread entries must be strictly newest first.');
 });
 if(thread.nextCursor!==null&&(thread.items.length!==researchLimits.page||thread.nextCursor!==thread.items.at(-1)?.id))bad('Thread cursor must identify the final full-page entry.');
});
export const researchPrivateReportSchema=z.object({requestId:uuid,id:uuid,digest:hash,reason:researchReportSchema.shape.reason,details:text(1500),createdAt:clock,reporter:researchAuthorReferenceSchema}).strict();
export const researchReportReceiptSchema=researchPrivateReportSchema.omit({details:true,reporter:true});
export const researchReportsSchema=z.object({version:z.literal(1),reports:z.array(researchPrivateReportSchema).max(researchLimits.page),nextCursor:hash.nullable(),executionEnabled:z.literal(false)}).strict();
export const researchWriteSchema=z.object({version:z.literal(1),action:z.enum(['publish','withdraw','report','moderate']),requestId:uuid,item:researchPublicItemSchema.nullable(),report:researchReportReceiptSchema.nullable(),executionEnabled:z.literal(false)}).strict().refine(value=>value.action==='report'?value.item===null&&value.report?.requestId===value.requestId:value.item!==null&&value.report===null,'Write receipts must match their action.');
export const researchMeSchema=z.object({version:z.literal(1),authorId:humanId,sponsorId:humanId,moderator:z.boolean(),executionEnabled:z.literal(false)}).strict().refine(value=>value.authorId===value.sponsorId);
export class ResearchError extends Error{constructor(message:string,public status=409,public retryAfterSeconds?:number){super(message);}}
export async function researchDigest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');}
export async function researchPublicHumanId(userId:string){if(typeof userId!=='string'||!userId||userId.length>256||/[\u0000-\u001f\u007f]/.test(userId))throw new ResearchError('Invalid participant identity.',400);return 'human_'+await researchDigest('OpenGrail-public-sponsor-v1:'+userId);}
export function researchAuthorReference(author:ResearchAuthor):ResearchAuthorReference{return researchAuthorReferenceSchema.parse(author.kind==='HUMAN'?author:{kind:'AGENT',id:author.id,sponsorId:author.sponsorId});}
export function boundedResearchCommand(raw:unknown){const command=researchCommandSchema.parse(raw),payload=JSON.stringify(command);if(new TextEncoder().encode(payload).byteLength>researchLimits.requestBytes)throw new ResearchError('Research command is too large.',413);return {command,payload};}
export function boundedResearchRecord(raw:unknown){const record=researchRecordSchema.parse(raw),payload=JSON.stringify(record);if(new TextEncoder().encode(payload).byteLength>researchLimits.payloadBytes)throw new ResearchError('Research content is too large.',413);return {record,payload};}
