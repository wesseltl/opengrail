import {z} from 'zod';
import type {NetworkPrincipal} from './network-store';
import {researchAuthorReferenceSchema,researchDigest,researchPublicHumanId,type ResearchAuthorReference} from './research-model';
import {ventureCredentialLike} from './venture-model';

/** Source-prepared coordination limits; these install no production grant. */
export const contributionLimits={requestBytes:16384,recordBytes:12288,responseBytes:524288,maximumDepth:12,maximumNodes:4096,page:20,tasksStored:500,claimsStored:2000,claimsPerTask:32,taskEvents:2,claimEvents:8,registerPerMaintainerDay:10,claimsPerSponsorDay:10,activePerSponsor:2,leaseHours:72} as const;
export const contributionPolicy='public-contributions-v1' as const;
export const contributionCloseReasons=['MAINTAINER_CLOSED','SUPERSEDED','OUT_OF_SCOPE','POLICY'] as const;
export const contributionHideReasons=['POLICY','PERSONAL_DATA','CREDENTIAL_EXPOSURE','ABUSE'] as const;
export const contributionReleaseReasons=['AUTHOR_RELEASE','SPONSOR_RELEASE'] as const;
export const contributionReviewReasons=['ACCEPTANCE_MET','NEEDS_CHANGES','FAILED_ACCEPTANCE','INCOMPLETE_EVIDENCE','STALE_EVIDENCE','OUT_OF_SCOPE','INVALID_HANDOFF','CONFLICT_OF_INTEREST','POLICY'] as const;
export const contributionDecisions=['ACCEPTED','CHANGES_REQUESTED','REJECTED'] as const;
export type ContributionActor={kind:'HUMAN';userId:string;maintainer:boolean}|{kind:'AGENT';principal:NetworkPrincipal};
export type ContributionAuthor=ResearchAuthorReference;
export const contributionAuthorSchema=researchAuthorReferenceSchema;
export const contributionAuthorReferenceSchema=researchAuthorReferenceSchema;
export {researchDigest as contributionDigest,researchPublicHumanId as contributionPublicHumanId};
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase());
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const humanId=z.string().regex(/^human_[a-f0-9]{64}$/);
const human=z.object({kind:z.literal('HUMAN'),id:humanId,sponsorId:humanId}).strict().refine(value=>value.id===value.sponsorId);
const text=(maximum:number)=>z.string().trim().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>!ventureCredentialLike(value));
const criterion=z.array(text(300)).min(1).max(8).refine(value=>new Set(value).size===value.length);
const policy=z.literal(contributionPolicy),taskState=z.enum(['OPEN','CLOSED','HIDDEN']);
const taskSequence=z.number().int().min(0).max(contributionLimits.taskEvents),claimSequence=z.number().int().min(0).max(contributionLimits.claimEvents);
export const contributionReferenceSchema=z.object({id:uuid,digest:hash}).strict();
export type ContributionReference=z.infer<typeof contributionReferenceSchema>;
const taskFields={title:text(120),summary:text(2000),kind:z.enum(['CODE','DOCS','TESTS']),acceptance:criterion,rejection:criterion};
const common={requestId:uuid,policyAccepted:policy};
export const contributionRegisterSchema=z.object({action:z.literal('register'),...common,id:uuid,...taskFields}).strict();
export const contributionClaimSchema=z.object({action:z.literal('claim'),...common,id:uuid,task:contributionReferenceSchema,expectedTaskSequence:taskSequence}).strict().refine(value=>value.id!==value.task.id);
export const contributionCloseSchema=z.object({action:z.literal('close'),...common,task:contributionReferenceSchema,expectedSequence:taskSequence,reason:z.enum(contributionCloseReasons)}).strict();
export const contributionHideSchema=z.object({action:z.literal('hide'),...common,task:contributionReferenceSchema,expectedSequence:taskSequence,reason:z.enum(contributionHideReasons)}).strict();
const claimOperation={...common,task:contributionReferenceSchema,claim:contributionReferenceSchema,expectedSequence:claimSequence};
export const contributionReleaseSchema=z.object({action:z.literal('release'),...claimOperation,reason:z.enum(contributionReleaseReasons)}).strict();
export const contributionSubmitSchema=z.object({action:z.literal('submit'),...claimOperation,handoffDigest:hash}).strict();
export const contributionReviewSchema=z.object({action:z.literal('review'),...claimOperation,decision:z.enum(contributionDecisions),reason:z.enum(contributionReviewReasons)}).strict().refine(value=>value.decision==='ACCEPTED'?value.reason==='ACCEPTANCE_MET':value.reason!=='ACCEPTANCE_MET'&&(value.decision!=='REJECTED'||value.reason!=='NEEDS_CHANGES'));
export const contributionCommandSchema=z.union([contributionRegisterSchema,contributionClaimSchema,contributionCloseSchema,contributionHideSchema,contributionReleaseSchema,contributionSubmitSchema,contributionReviewSchema]);
export type ContributionCommand=z.infer<typeof contributionCommandSchema>;
export type ContributionRegisterCommand=z.infer<typeof contributionRegisterSchema>;
export type ContributionClaimCommand=z.infer<typeof contributionClaimSchema>;
export function contributionTaskContent(command:ContributionRegisterCommand){return {title:command.title,summary:command.summary,kind:command.kind,acceptance:command.acceptance,rejection:command.rejection};}
export const contributionTaskRecordSchema=z.object({version:z.literal(1),id:uuid,requestId:uuid,createdAt:clock,author:human,content:z.object(taskFields).strict(),policyAccepted:policy,executionEnabled:z.literal(false)}).strict();
export type ContributionTaskRecord=z.infer<typeof contributionTaskRecordSchema>;
export const contributionClaimRecordSchema=z.object({version:z.literal(1),id:uuid,requestId:uuid,createdAt:clock,expiresAt:clock,author:contributionAuthorSchema,task:contributionReferenceSchema,policyAccepted:policy,executionEnabled:z.literal(false)}).strict().refine(value=>value.id!==value.task.id&&Date.parse(value.expiresAt)-Date.parse(value.createdAt)===contributionLimits.leaseHours*3600000);
export type ContributionClaimRecord=z.infer<typeof contributionClaimRecordSchema>;
export function contributionTaskCommandForRecord(record:ContributionTaskRecord){return contributionRegisterSchema.parse({action:'register',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});}
export function contributionClaimCommandForRecord(record:ContributionClaimRecord,expectedTaskSequence=0){return contributionClaimSchema.parse({action:'claim',requestId:record.requestId,id:record.id,task:record.task,expectedTaskSequence,policyAccepted:record.policyAccepted});}
const eventFields={version:z.literal(1),requestId:uuid,createdAt:clock,actor:contributionAuthorReferenceSchema,task:contributionReferenceSchema,expectedSequence:taskSequence,sequence:z.number().int().min(1).max(contributionLimits.taskEvents),policyAccepted:policy,executionEnabled:z.literal(false)};
export const contributionTaskEventRecordSchema=z.object({...eventFields,actor:human,action:z.enum(['close','hide']),state:z.enum(['CLOSED','HIDDEN']),reason:z.enum([...contributionCloseReasons,...contributionHideReasons])}).strict().superRefine((value,ctx)=>{
 if(value.sequence!==value.expectedSequence+1||value.state!==(value.action==='close'?'CLOSED':'HIDDEN'))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Task event sequence and action must agree.'});
 if(!contributionCommandSchema.safeParse(contributionEventCommand(value)).success)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Task event command must be valid.'});
});
export type ContributionTaskEventRecord=z.infer<typeof contributionTaskEventRecordSchema>;
const eventState=z.enum(['SUBMITTED','RELEASED','ACCEPTED','CHANGES_REQUESTED','REJECTED']);
export const contributionClaimEventRecordSchema=z.object({...eventFields,expectedSequence:claimSequence,sequence:z.number().int().min(1).max(contributionLimits.claimEvents),claim:contributionReferenceSchema,action:z.enum(['release','submit','review']),state:eventState,reason:z.enum([...contributionReleaseReasons,...contributionReviewReasons]).nullable(),decision:z.enum(contributionDecisions).nullable(),handoffDigest:hash.nullable()}).strict().superRefine((value,ctx)=>{
 if(value.sequence!==value.expectedSequence+1||value.claim.id===value.task.id)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Claim event identities and sequence must agree.'});
 if(value.action==='submit'?(value.state!=='SUBMITTED'||value.reason!==null||value.decision!==null||value.handoffDigest===null):value.action==='release'?(value.state!=='RELEASED'||value.decision!==null||value.handoffDigest!==null||value.reason===null):(value.actor.kind!=='HUMAN'||value.state!==value.decision||value.handoffDigest!==null||value.reason===null))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Claim event fields must match their action.'});
 if(!contributionCommandSchema.safeParse(contributionEventCommand(value)).success)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Claim event command must be valid.'});
});
export type ContributionClaimEventRecord=z.infer<typeof contributionClaimEventRecordSchema>;
function contributionEventCommand(value:{action:string;requestId:string;task:ContributionReference;expectedSequence:number;policyAccepted:typeof contributionPolicy;reason?:string|null;claim?:ContributionReference;handoffDigest?:string|null;decision?:string|null}){
 const common={action:value.action,requestId:value.requestId,task:value.task,expectedSequence:value.expectedSequence,policyAccepted:value.policyAccepted};
 return value.action==='close'||value.action==='hide'?{...common,reason:value.reason}:value.action==='submit'?{...common,claim:value.claim,handoffDigest:value.handoffDigest}:value.action==='release'?{...common,claim:value.claim,reason:value.reason}:{...common,claim:value.claim,decision:value.decision,reason:value.reason};
}
export function contributionEventCommandForRecord(raw:unknown){plain(raw);const record=z.union([contributionTaskEventRecordSchema,contributionClaimEventRecordSchema]).parse(raw);return contributionCommandSchema.parse(contributionEventCommand(record));}
export const contributionTaskEventSchema=z.object({...eventFields,actor:human,action:z.enum(['close','hide']),state:z.enum(['CLOSED','HIDDEN']),reason:z.enum([...contributionCloseReasons,...contributionHideReasons]),digest:hash}).strict().refine(value=>contributionTaskEventRecordSchema.safeParse(withoutDigest(value)).success);
export const contributionClaimEventSchema=z.object({...eventFields,expectedSequence:claimSequence,sequence:z.number().int().min(1).max(contributionLimits.claimEvents),claim:contributionReferenceSchema,action:z.enum(['release','submit','review']),state:eventState,reason:z.enum([...contributionReleaseReasons,...contributionReviewReasons]).nullable(),decision:z.enum(contributionDecisions).nullable(),handoffDigest:hash.nullable(),digest:hash}).strict().refine(value=>contributionClaimEventRecordSchema.safeParse(withoutDigest(value)).success);
export type ContributionTaskEvent=z.infer<typeof contributionTaskEventSchema>;
export type ContributionClaimEvent=z.infer<typeof contributionClaimEventSchema>;
function withoutDigest<T extends {digest:string}>(value:T){const {digest,...body}=value;void digest;return body;}
const identityFields={id:uuid,digest:hash,requestId:uuid,createdAt:clock};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const requestKey=(actor:ContributionAuthor,requestId:string)=>actor.kind+':'+actor.id+':'+requestId;
export const contributionTaskItemSchema=z.object({...identityFields,author:human,state:taskState,sequence:taskSequence,reason:z.enum([...contributionCloseReasons,...contributionHideReasons]).nullable(),record:contributionTaskRecordSchema.nullable(),events:z.array(contributionTaskEventSchema).max(contributionLimits.taskEvents)}).strict().superRefine((item,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Task identity and lifecycle must agree.'});
 if((item.state==='HIDDEN')!==(item.record===null)||item.sequence!==item.events.length)bad();
 if(item.record&&(item.id!==item.record.id||item.requestId!==item.record.requestId||item.createdAt!==item.record.createdAt||!same(item.author,item.record.author)))bad();
 let current:'OPEN'|'CLOSED'|'HIDDEN'='OPEN',reason:string|null=null,at=item.createdAt;const requests=new Set([requestKey(item.author,item.requestId)]);
 for(let n=0;n<item.events.length;n++){const event=item.events[n],key=requestKey(event.actor,event.requestId);if(event.sequence!==n+1||event.createdAt<at||current==='HIDDEN'||event.action==='close'&&current!=='OPEN'||!same(event.task,{id:item.id,digest:item.digest})||requests.has(key))bad();current=event.state;reason=event.reason;at=event.createdAt;requests.add(key);}
 if(current!==item.state||reason!==item.reason)bad();
});
export type ContributionTaskItem=z.infer<typeof contributionTaskItemSchema>;
export const contributionClaimStatusSchema=z.enum(['ACTIVE','SUBMITTED','RELEASED','EXPIRED','ACCEPTED','CHANGES_REQUESTED','REJECTED']);
export type ContributionClaimStatus=z.infer<typeof contributionClaimStatusSchema>;
export const contributionClaimItemSchema=z.object({...identityFields,expiresAt:clock,checkedAt:clock,author:contributionAuthorSchema,task:contributionReferenceSchema,taskState,sequence:claimSequence,status:contributionClaimStatusSchema,handoffDigest:hash.nullable(),reason:z.enum([...contributionReleaseReasons,...contributionReviewReasons]).nullable(),record:contributionClaimRecordSchema.nullable(),events:z.array(contributionClaimEventSchema).max(contributionLimits.claimEvents)}).strict().superRefine((item,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Claim identity and lifecycle must agree.'});
 if(item.id===item.task.id||Date.parse(item.expiresAt)-Date.parse(item.createdAt)!==contributionLimits.leaseHours*3600000||item.checkedAt<item.createdAt)bad();
 if((item.status==='ACTIVE'||item.status==='SUBMITTED')&&item.checkedAt>=item.expiresAt||item.status==='EXPIRED'&&item.checkedAt<item.expiresAt)bad();
 if(item.taskState==='HIDDEN'){if(item.record!==null||item.handoffDigest!==null||item.reason!==null||item.events.length!==0)bad();return;}
 if(item.record===null||item.sequence!==item.events.length)bad();
 if(item.record&&(item.id!==item.record.id||item.requestId!==item.record.requestId||item.createdAt!==item.record.createdAt||item.expiresAt!==item.record.expiresAt||!same(item.author,item.record.author)||!same(item.task,item.record.task)))bad();
 let current:ContributionClaimStatus='ACTIVE',handoff:string|null=null,reason:string|null=null,at=item.createdAt;const requests=new Set([requestKey(item.author,item.requestId)]);
 for(let n=0;n<item.events.length;n++){
  const event=item.events[n],key=requestKey(event.actor,event.requestId);if(event.sequence!==n+1||event.createdAt<at||event.createdAt>=item.expiresAt||!same(event.task,item.task)||!same(event.claim,{id:item.id,digest:item.digest})||requests.has(key)||current!=='ACTIVE'&&current!=='SUBMITTED')bad();
  if(event.action==='submit'){if(current!=='ACTIVE'||!same(event.actor,item.author))bad();handoff=event.handoffDigest;}
  if(event.action==='release'){if(event.reason==='AUTHOR_RELEASE'?!same(event.actor,item.author):item.author.kind!=='AGENT'||event.actor.kind!=='HUMAN'||event.actor.id!==item.author.sponsorId)bad();}
  if(event.action==='review'&&(current!=='SUBMITTED'||handoff===null||event.actor.kind!=='HUMAN'))bad();
  current=event.state;reason=event.reason;at=event.createdAt;requests.add(key);
 }
 if(at>item.checkedAt)bad();if((current==='ACTIVE'||current==='SUBMITTED')&&item.checkedAt>=item.expiresAt)current='EXPIRED';
 if(item.status!==current||item.handoffDigest!==handoff||item.reason!==reason)bad();
});
export type ContributionClaimItem=z.infer<typeof contributionClaimItemSchema>;
const envelope={version:z.literal(1),executionEnabled:z.literal(false)};
function pageRules(items:{id:string;createdAt:string}[],nextCursor:string|null){return new Set(items.map(item=>item.id)).size===items.length&&items.every((item,n)=>!n||item.createdAt<items[n-1].createdAt||item.createdAt===items[n-1].createdAt&&item.id<items[n-1].id)&&(nextCursor===null||items.length===contributionLimits.page&&nextCursor===items.at(-1)?.id);}
export const contributionListSchema=z.object({...envelope,items:z.array(contributionTaskItemSchema).max(contributionLimits.page),nextCursor:uuid.nullable()}).strict().refine(value=>pageRules(value.items,value.nextCursor));
export const contributionGetSchema=z.object({...envelope,item:contributionTaskItemSchema}).strict();
export const contributionClaimsSchema=z.object({...envelope,task:contributionTaskItemSchema,items:z.array(contributionClaimItemSchema).max(contributionLimits.page),nextCursor:uuid.nullable()}).strict().refine(value=>pageRules(value.items,value.nextCursor)&&value.items.every(item=>same(item.task,{id:value.task.id,digest:value.task.digest})&&item.taskState===value.task.state));
export const contributionClaimGetSchema=z.object({...envelope,task:contributionTaskItemSchema,item:contributionClaimItemSchema}).strict().refine(value=>same(value.item.task,{id:value.task.id,digest:value.task.digest})&&value.item.taskState===value.task.state);
export const contributionMeSchema=z.object({...envelope,authorId:humanId,sponsorId:humanId,maintainer:z.boolean()}).strict().refine(value=>value.authorId===value.sponsorId);
const action=z.enum(['register','claim','close','hide','release','submit','review']);
export const contributionAcknowledgementSchema=z.object({action,requestId:uuid,actor:contributionAuthorReferenceSchema,task:contributionReferenceSchema,claim:contributionReferenceSchema.nullable(),sequence:claimSequence,createdAt:clock,commandDigest:hash,digest:hash}).strict().refine(value=>value.action==='register'||value.action==='claim'?value.sequence===0:value.sequence>0).refine(value=>['register','close','hide'].includes(value.action)?value.claim===null:value.claim!==null).refine(value=>!['register','close','hide','review'].includes(value.action)||value.actor.kind==='HUMAN');
export const contributionWriteSchema=z.object({...envelope,action,requestId:uuid,task:contributionTaskItemSchema,claim:contributionClaimItemSchema.nullable(),acknowledgement:contributionAcknowledgementSchema}).strict().superRefine((value,ctx)=>{
 const ack=value.acknowledgement,bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Contribution acknowledgement must match its receipt.'});
 if(value.action!==ack.action||value.requestId!==ack.requestId||!same(ack.task,{id:value.task.id,digest:value.task.digest})||(['register','close','hide'].includes(value.action)?value.claim!==null:value.claim===null))bad();
 if(value.claim&&(!same(value.claim.task,ack.task)||value.claim.taskState!==value.task.state||!same(ack.claim,{id:value.claim.id,digest:value.claim.digest})))bad();
 if(ack.sequence>(value.claim?value.claim.sequence:value.task.sequence))bad();
});
export type ContributionWrite=z.infer<typeof contributionWriteSchema>;
export class ContributionError extends Error{constructor(message:string,public status=409,public retryAfterSeconds?:number){super(message);}}
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;
function plain(raw:unknown){let nodes=0;const seen=new Set<object>();function walk(value:unknown,depth:number){
 if(++nodes>contributionLimits.maximumNodes||depth>contributionLimits.maximumDepth)throw new ContributionError('Contribution structure exceeds its bound.',400);
 if(typeof value==='string'){if(ventureCredentialLike(value))throw new ContributionError('Credentials cannot be published.',400);return;}
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(!value||typeof value!=='object'||seen.has(value))throw new ContributionError('Contribution material must be plain JSON data.',400);
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.getOwnPropertySymbols(value).length||(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)||array&&Object.keys(descriptors).length!==(value as unknown[]).length+1)throw new ContributionError('Contribution material must be plain JSON data.',400);
 seen.add(value);for(const [key,descriptor] of Object.entries(descriptors)){if(array&&key==='length')continue;if(ventureCredentialLike(key)||!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=(value as unknown[]).length))throw new ContributionError('Contribution material must be plain JSON data.',400);walk(descriptor.value,depth+1);}seen.delete(value);
 }walk(raw,0);}
function bounded<T>(raw:unknown,schema:z.ZodType<T>,maximum:number){plain(raw);if(bytes(JSON.stringify(raw))>maximum)throw new ContributionError('Contribution material exceeds its byte bound.',413);const record=schema.parse(raw),payload=JSON.stringify(record);if(bytes(payload)>maximum)throw new ContributionError('Contribution material exceeds its byte bound.',413);return {record,payload};}
export function boundedContributionCommand(raw:unknown){const {record:command,payload}=bounded(raw,contributionCommandSchema,contributionLimits.requestBytes);return {command,payload};}
export function boundedContributionTaskRecord(raw:unknown){return bounded(raw,contributionTaskRecordSchema,contributionLimits.recordBytes);}
export function boundedContributionClaimRecord(raw:unknown){return bounded(raw,contributionClaimRecordSchema,contributionLimits.recordBytes);}
export function boundedContributionTaskEventRecord(raw:unknown){return bounded(raw,contributionTaskEventRecordSchema,contributionLimits.recordBytes);}
export function boundedContributionClaimEventRecord(raw:unknown){return bounded(raw,contributionClaimEventRecordSchema,contributionLimits.recordBytes);}
export const contributionRecordSchema=z.union([contributionTaskRecordSchema,contributionClaimRecordSchema,contributionTaskEventRecordSchema,contributionClaimEventRecordSchema]);
export function boundedContributionRecord(raw:unknown){return bounded(raw,contributionRecordSchema,contributionLimits.recordBytes);}
/** Canonical builders accept already authorized context. They grant no role. */
export function contributionTaskRecordForCommand(command:ContributionRegisterCommand,author:ContributionAuthor,createdAt:string){return boundedContributionTaskRecord({version:1,id:command.id,requestId:command.requestId,createdAt,author,content:contributionTaskContent(command),policyAccepted:command.policyAccepted,executionEnabled:false}).record;}
export function contributionClaimRecordForCommand(command:ContributionClaimCommand,author:ContributionAuthor,createdAt:string){clock.parse(createdAt);return boundedContributionClaimRecord({version:1,id:command.id,requestId:command.requestId,createdAt,expiresAt:new Date(Date.parse(createdAt)+contributionLimits.leaseHours*3600000).toISOString(),author,task:command.task,policyAccepted:command.policyAccepted,executionEnabled:false}).record;}
export function contributionEventRecordForCommand(command:ContributionCommand,actor:ContributionAuthor,createdAt:string){
 if(command.action==='register'||command.action==='claim')throw new ContributionError('This command does not create a lifecycle event.',400);
 const common={version:1,requestId:command.requestId,createdAt,actor,task:command.task,expectedSequence:command.expectedSequence,sequence:command.expectedSequence+1,policyAccepted:command.policyAccepted,executionEnabled:false};
 if(command.action==='close'||command.action==='hide')return boundedContributionTaskEventRecord({...common,action:command.action,state:command.action==='close'?'CLOSED':'HIDDEN',reason:command.reason}).record;
 return boundedContributionClaimEventRecord({...common,claim:command.claim,action:command.action,state:command.action==='submit'?'SUBMITTED':command.action==='release'?'RELEASED':command.decision,reason:command.action==='submit'?null:command.reason,decision:command.action==='review'?command.decision:null,handoffDigest:command.action==='submit'?command.handoffDigest:null}).record;
}
async function checkEvent(value:ContributionTaskEvent|ContributionClaimEvent){const body=withoutDigest(value),checked=boundedContributionRecord(body);if(await researchDigest(checked.payload)!==value.digest)throw new ContributionError('Contribution event digest does not match.',400);}
export async function validateContributionTaskItem(raw:unknown){plain(raw);const item=contributionTaskItemSchema.parse(raw);if(item.record&&await researchDigest(boundedContributionTaskRecord(item.record).payload)!==item.digest)throw new ContributionError('Contribution task digest does not match.',400);for(const event of item.events)await checkEvent(event);return item;}
export async function validateContributionClaimItem(raw:unknown){plain(raw);const item=contributionClaimItemSchema.parse(raw);if(item.record&&await researchDigest(boundedContributionClaimRecord(item.record).payload)!==item.digest)throw new ContributionError('Contribution claim digest does not match.',400);for(const event of item.events)await checkEvent(event);return item;}
export async function validateContributionWrite(raw:unknown,rawCommand:unknown,rawActor:unknown){
 plain(raw);plain(rawActor);const receipt=contributionWriteSchema.parse(raw),{command,payload}=boundedContributionCommand(rawCommand),actor=contributionAuthorReferenceSchema.parse(rawActor),ack=receipt.acknowledgement;
 const fail=()=>{throw new ContributionError('Contribution acknowledgement does not match the accepted command.',400);};
 if(receipt.action!==command.action||receipt.requestId!==command.requestId||!same(ack.actor,actor)||ack.commandDigest!==await researchDigest(payload))fail();
 const task={id:receipt.task.id,digest:receipt.task.digest},claim=receipt.claim?{id:receipt.claim.id,digest:receipt.claim.digest}:null;
 if(command.action==='register'){if(task.id!==command.id||ack.digest!==task.digest||!same(receipt.task.author,actor)||actor.kind!=='HUMAN'||await researchDigest(boundedContributionTaskRecord(contributionTaskRecordForCommand(command,actor,ack.createdAt)).payload)!==task.digest)fail();if(receipt.task.record&&!same(contributionTaskCommandForRecord(receipt.task.record),command))fail();}
 else if(!same(task,command.task))fail();
 if(command.action==='claim'){if(claim?.id!==command.id||ack.digest!==claim?.digest||!same(receipt.claim?.author,actor)||await researchDigest(boundedContributionClaimRecord(contributionClaimRecordForCommand(command,actor,ack.createdAt)).payload)!==claim?.digest)fail();if(receipt.claim?.record&&!same(contributionClaimCommandForRecord(receipt.claim.record,command.expectedTaskSequence),command))fail();}
 else if('claim'in command&&!same(claim,command.claim))fail();
 if('expectedSequence'in command&&ack.sequence!==command.expectedSequence+1)fail();
 if(command.action!=='register'&&command.action!=='claim'&&await researchDigest(boundedContributionRecord(contributionEventRecordForCommand(command,actor,ack.createdAt)).payload)!==ack.digest)fail();
 await validateContributionTaskItem(receipt.task);if(receipt.claim)await validateContributionClaimItem(receipt.claim);
 if(command.action==='register'||command.action==='claim'){if(ack.createdAt!==(receipt.claim??receipt.task).createdAt)fail();}
 else if(receipt.task.state!=='HIDDEN'){
  const event=(receipt.claim?receipt.claim.events:receipt.task.events).find(item=>item.requestId===command.requestId&&same(item.actor,actor));if(!event||event.digest!==ack.digest||event.createdAt!==ack.createdAt||event.sequence!==ack.sequence||!same(contributionEventCommandForRecord(withoutDigest(event)),command))fail();
 }
 return receipt;
}
export const validateContributionReceipt=validateContributionWrite;
