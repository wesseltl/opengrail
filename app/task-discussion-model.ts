import {z} from 'zod';
import {contributionDigest,contributionPublicHumanId,contributionTaskItemSchema,validateContributionTaskItem,type ContributionActor} from './contribution-model';
import {ventureCredentialLike} from './venture-model';

export {contributionDigest as taskDiscussionDigest,contributionPublicHumanId as taskDiscussionPublicHumanId};
export type TaskDiscussionActor=ContributionActor;
export const taskDiscussionPolicy='public-task-discussion-v1' as const;
export const taskDiscussionLimits={requestBytes:8192,recordBytes:6144,eventBytes:4096,reportBytes:2048,responseBytes:262144,maximumDepth:12,maximumNodes:4096,page:16,bodyCharacters:4000,detailsCharacters:1000,messagesStored:2000,messagesPerTask:64,messagesPerSponsorDay:20,eventsPerMessage:2,reportsStored:2000,reportsPerSponsorDay:10} as const;
export const taskDiscussionKinds=['QUESTION','PROPOSAL','COUNTEREXAMPLE','PEER_REVIEW'] as const;
export const taskDiscussionWithdrawReasons=['AUTHOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE'] as const;
export const taskDiscussionHideReasons=['POLICY','PERSONAL_DATA','CREDENTIAL_EXPOSURE','ABUSE'] as const;
export const taskDiscussionReportCategories=['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','PRIVATE_MATERIAL','MISLEADING','OTHER'] as const;
export class TaskDiscussionError extends Error{constructor(message:string,public status=409,public retryAfterSeconds?:number){super(message);}}
const uuid=z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
const digest=z.string().length(64).regex(/^[a-f0-9]{64}$/),humanId=z.string().length(70).regex(/^human_[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
/** Decode valid escape runs independently; malformed unrelated suffixes cannot conceal credentials. */
export function taskDiscussionCredentialLike(value:string){for(let n=0;n<32;n++){if(ventureCredentialLike(value)||/(?:sk-(?:(?:proj|svcacct)-|ant-api\d+-)[a-z0-9_-]{20,}|sk-[a-z0-9]{20,}|xox[baprs]-[a-z0-9-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|authorization\s*:\s*bearer\s+[a-z0-9._~-]{20,})/i.test(value))return true;const decoded=value.replace(/(?:%[a-f0-9]{2})+/gi,run=>{try{return decodeURIComponent(run);}catch{return run.replace(/%([a-f0-9]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16)));}});if(decoded===value)return false;value=decoded;}return true;}
const text=(maximum:number)=>z.string().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>value===value.trim()&&!taskDiscussionCredentialLike(value));
const human=z.object({kind:z.literal('HUMAN'),id:humanId,sponsorId:humanId}).strict().refine(author=>author.id===author.sponsorId);
const agent=z.object({kind:z.literal('AGENT'),id:uuid,sponsorId:humanId}).strict();
export const taskDiscussionAuthorSchema=z.union([human,agent]);
export type TaskDiscussionAuthor=z.infer<typeof taskDiscussionAuthorSchema>;
export const taskDiscussionReferenceSchema=z.object({id:uuid,digest}).strict();
export type TaskDiscussionReference=z.infer<typeof taskDiscussionReferenceSchema>;
const policy=z.literal(taskDiscussionPolicy),taskSequence=z.number().int().min(0).max(2),expectedSequence=z.number().int().min(0).max(1),eventSequence=z.number().int().min(1).max(2);
const common={requestId:uuid,task:taskDiscussionReferenceSchema,policyAccepted:policy};
export const taskDiscussionPublishSchema=z.object({action:z.literal('publish'),id:uuid,...common,expectedTaskSequence:taskSequence,claim:taskDiscussionReferenceSchema.nullable(),replyTo:taskDiscussionReferenceSchema.nullable(),kind:z.enum(taskDiscussionKinds),body:text(taskDiscussionLimits.bodyCharacters)}).strict().refine(value=>value.id!==value.task.id&&value.id!==value.claim?.id&&value.id!==value.replyTo?.id&&value.claim?.id!==value.task.id&&value.replyTo?.id!==value.task.id,'Message and related identities must be distinct.');
const operation={...common,message:taskDiscussionReferenceSchema,expectedSequence};
export const taskDiscussionWithdrawSchema=z.object({action:z.literal('withdraw'),...operation,reason:z.enum(taskDiscussionWithdrawReasons)}).strict().refine(value=>value.task.id!==value.message.id);
export const taskDiscussionHideSchema=z.object({action:z.literal('hide'),...operation,reason:z.enum(taskDiscussionHideReasons)}).strict().refine(value=>value.task.id!==value.message.id&&value.expectedSequence===0,'Hide uses the first terminal event slot only.');
export const taskDiscussionReportSchema=z.object({action:z.literal('report'),...common,message:taskDiscussionReferenceSchema,category:z.enum(taskDiscussionReportCategories),details:text(taskDiscussionLimits.detailsCharacters)}).strict().refine(value=>value.task.id!==value.message.id);
export const taskDiscussionCommandSchema=z.union([taskDiscussionPublishSchema,taskDiscussionWithdrawSchema,taskDiscussionHideSchema,taskDiscussionReportSchema]);
export type TaskDiscussionCommand=z.infer<typeof taskDiscussionCommandSchema>;
export type TaskDiscussionPublishCommand=z.infer<typeof taskDiscussionPublishSchema>;
export const taskDiscussionRecordSchema=z.object({version:z.literal(1),id:uuid,requestId:uuid,createdAt:clock,author:taskDiscussionAuthorSchema,task:taskDiscussionReferenceSchema,claim:taskDiscussionReferenceSchema.nullable(),replyTo:taskDiscussionReferenceSchema.nullable(),kind:z.enum(taskDiscussionKinds),body:text(taskDiscussionLimits.bodyCharacters),policyAccepted:policy,executionEnabled:z.literal(false)}).strict().refine(record=>record.id!==record.task.id&&record.id!==record.claim?.id&&record.id!==record.replyTo?.id&&record.claim?.id!==record.task.id&&record.replyTo?.id!==record.task.id);
export type TaskDiscussionRecord=z.infer<typeof taskDiscussionRecordSchema>;
const eventFields={version:z.literal(1),task:taskDiscussionReferenceSchema,message:taskDiscussionReferenceSchema,actor:taskDiscussionAuthorSchema,requestId:uuid,createdAt:clock,action:z.enum(['withdraw','hide']),expectedSequence,sequence:eventSequence,state:z.enum(['HIDDEN','WITHDRAWN']),reason:z.enum([...taskDiscussionWithdrawReasons,...taskDiscussionHideReasons]),policyAccepted:policy,executionEnabled:z.literal(false)};
const eventBody=z.object(eventFields).strict();
function eventRules(value:z.infer<typeof eventBody>){return value.task.id!==value.message.id&&value.sequence===value.expectedSequence+1&&(value.action==='hide'?value.expectedSequence===0&&value.sequence===1&&value.state==='HIDDEN'&&value.actor.kind==='HUMAN'&&(taskDiscussionHideReasons as readonly string[]).includes(value.reason):value.state==='WITHDRAWN'&&(taskDiscussionWithdrawReasons as readonly string[]).includes(value.reason));}
export const taskDiscussionEventRecordSchema=eventBody.refine(eventRules);
export type TaskDiscussionEventRecord=z.infer<typeof taskDiscussionEventRecordSchema>;
export const taskDiscussionEventSchema=eventBody.extend({digest}).refine(eventRules);
export type TaskDiscussionEvent=z.infer<typeof taskDiscussionEventSchema>;
export const taskDiscussionPrivateReportSchema=z.object({requestId:uuid,task:taskDiscussionReferenceSchema,message:taskDiscussionReferenceSchema,category:z.enum(taskDiscussionReportCategories),details:text(taskDiscussionLimits.detailsCharacters),createdAt:clock,reporter:taskDiscussionAuthorSchema}).strict().refine(report=>report.task.id!==report.message.id);
export type TaskDiscussionPrivateReport=z.infer<typeof taskDiscussionPrivateReportSchema>;
export const taskDiscussionReportReceiptSchema=z.object({requestId:uuid,task:taskDiscussionReferenceSchema,message:taskDiscussionReferenceSchema,category:z.enum(taskDiscussionReportCategories),createdAt:clock}).strict().refine(report=>report.task.id!==report.message.id);
const itemShape=z.object({id:uuid,digest,requestId:uuid,createdAt:clock,author:taskDiscussionAuthorSchema,task:taskDiscussionReferenceSchema,taskState:z.enum(['OPEN','CLOSED','HIDDEN']),sequence:z.number().int().min(0).max(2),state:z.enum(['VISIBLE','HIDDEN','WITHDRAWN']),reason:z.enum([...taskDiscussionWithdrawReasons,...taskDiscussionHideReasons]).nullable(),record:taskDiscussionRecordSchema.nullable(),events:z.array(taskDiscussionEventSchema).max(2)}).strict();
export const taskDiscussionItemSchema=itemShape.superRefine((item,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Discussion identity, state and retained history must agree.'});
 if(item.id===item.task.id||item.sequence!==item.events.length||(item.state==='VISIBLE')!==(item.record!==null))bad();
 if(item.record){const record=item.record;if(record.id!==item.id||record.requestId!==item.requestId||record.createdAt!==item.createdAt||!same(record.author,item.author)||!same(record.task,item.task))bad();}
 let own='VISIBLE',at=item.createdAt;const requests=new Set([item.author.kind+':'+item.author.id+':'+item.requestId]);
 for(let n=0;n<item.events.length;n++){
  const event=item.events[n],key=event.actor.kind+':'+event.actor.id+':'+event.requestId;
  if(event.sequence!==n+1||event.expectedSequence!==n||event.createdAt<at||!same(event.task,item.task)||!same(event.message,{id:item.id,digest:item.digest})||requests.has(key)||own==='WITHDRAWN'||event.action==='hide'&&own!=='VISIBLE'||event.action==='withdraw'&&!same(event.actor,item.author))bad();
  requests.add(key);own=event.state;at=event.createdAt;
 }
 const state=own==='WITHDRAWN'?'WITHDRAWN':own==='HIDDEN'||item.taskState==='HIDDEN'?'HIDDEN':'VISIBLE';
 if(item.state!==state||item.reason!==(item.events.at(-1)?.reason??null))bad();
});
export const taskDiscussionPublicItemSchema=taskDiscussionItemSchema;
export type TaskDiscussionItem=z.infer<typeof taskDiscussionItemSchema>;
const envelope={version:z.literal(1),executionEnabled:z.literal(false)};
const itemMatchesTask=(item:TaskDiscussionItem,task:{id:string;digest:string;state:string;createdAt:string})=>same(item.task,{id:task.id,digest:task.digest})&&item.taskState===task.state&&item.createdAt>=task.createdAt;
export const taskDiscussionListSchema=z.object({...envelope,task:contributionTaskItemSchema,items:z.array(taskDiscussionItemSchema).max(taskDiscussionLimits.page),nextCursor:uuid.nullable()}).strict().superRefine((value,ctx)=>{
 if(new Set(value.items.map(item=>item.id)).size!==value.items.length||value.items.some((item,n)=>!itemMatchesTask(item,value.task)||n>0&&(item.createdAt>value.items[n-1].createdAt||item.createdAt===value.items[n-1].createdAt&&item.id>=value.items[n-1].id))||value.nextCursor!==null&&(value.items.length!==taskDiscussionLimits.page||value.nextCursor!==value.items.at(-1)?.id))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Discussion page scope, identity, order and cursor must agree.'});
});
export const taskDiscussionGetSchema=z.object({...envelope,task:contributionTaskItemSchema,item:taskDiscussionItemSchema}).strict().refine(value=>itemMatchesTask(value.item,value.task));
export const taskDiscussionAcknowledgementSchema=z.object({actor:taskDiscussionAuthorSchema,commandDigest:digest,digest,createdAt:clock,sequence:z.number().int().min(0).max(2)}).strict();
export const taskDiscussionWriteSchema=z.object({...envelope,action:z.enum(['publish','withdraw','hide','report']),requestId:uuid,acknowledgement:taskDiscussionAcknowledgementSchema,task:contributionTaskItemSchema,message:taskDiscussionItemSchema.nullable(),report:taskDiscussionReportReceiptSchema.nullable()}).strict().superRefine((value,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Discussion acknowledgement must match its current projection.'}),ack=value.acknowledgement;
 if(ack.createdAt<value.task.createdAt)bad();
 if(value.action==='report'){
  if(value.message!==null||!value.report||ack.sequence!==0||value.report.requestId!==value.requestId||value.report.createdAt!==ack.createdAt||!same(value.report.task,{id:value.task.id,digest:value.task.digest}))bad();
 }else{
  if(!value.message||value.report!==null)bad();
  if(value.message){const item=value.message;if(!itemMatchesTask(item,value.task)||ack.createdAt<item.createdAt)bad();
   if(value.action==='publish'){if(ack.sequence!==0||ack.createdAt!==item.createdAt||value.requestId!==item.requestId||ack.digest!==item.digest||!same(ack.actor,item.author))bad();}
   else{const event=item.events.find(event=>event.requestId===value.requestId&&same(event.actor,ack.actor));if(!event||event.action!==value.action||event.createdAt!==ack.createdAt||event.digest!==ack.digest||event.sequence!==ack.sequence||ack.sequence>item.sequence)bad();}
  }
 }
});
export type TaskDiscussionWrite=z.infer<typeof taskDiscussionWriteSchema>;
const reportKey=(report:TaskDiscussionPrivateReport)=>report.reporter.kind+':'+report.reporter.id;
export const taskDiscussionReportsSchema=z.object({...envelope,reports:z.array(taskDiscussionPrivateReportSchema).max(taskDiscussionLimits.page),nextCursor:digest.nullable()}).strict().superRefine((value,ctx)=>{
 if(new Set(value.reports.map(report=>reportKey(report)+':'+report.requestId)).size!==value.reports.length||value.reports.some((report,n)=>n>0&&(report.createdAt>value.reports[n-1].createdAt||report.createdAt===value.reports[n-1].createdAt&&(reportKey(report)>reportKey(value.reports[n-1])||reportKey(report)===reportKey(value.reports[n-1])&&report.requestId>=value.reports[n-1].requestId)))||value.nextCursor!==null&&value.reports.length!==taskDiscussionLimits.page)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Private report identities, order and cursor must agree.'});
});
export const taskDiscussionReportListSchema=taskDiscussionReportsSchema;
export const taskDiscussionMeSchema=z.object({...envelope,authorId:humanId,sponsorId:humanId,maintainer:z.boolean()}).strict().refine(value=>value.authorId===value.sponsorId);

function inspect(raw:unknown){let count=0;const active=new Set<object>();function visit(value:unknown,depth:number){
 if(++count>taskDiscussionLimits.maximumNodes||depth>taskDiscussionLimits.maximumDepth)throw new TaskDiscussionError('Discussion structure exceeds its bound.',400);
 if(typeof value==='string'){if(taskDiscussionCredentialLike(value))throw new TaskDiscussionError('Credentials cannot enter discussion material.',400);return;}
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(!value||typeof value!=='object'||active.has(value)||Object.getOwnPropertySymbols(value).length)throw new TaskDiscussionError('Discussion material must be plain finite JSON.',400);
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new TaskDiscussionError('Discussion material must be plain JSON.',400);
 if(array&&Object.keys(descriptors).length!==(value as unknown[]).length+1)throw new TaskDiscussionError('Discussion arrays must be complete.',400);
 active.add(value);for(const [key,descriptor]of Object.entries(descriptors)){if(array&&key==='length')continue;if(taskDiscussionCredentialLike(key)||!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=(value as unknown[]).length))throw new TaskDiscussionError('Discussion hooks and hidden fields are refused.',400);visit(descriptor.value,depth+1);}active.delete(value);
 }visit(raw,0);}
function unchanged(left:unknown,right:unknown):boolean{if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&unchanged(a[key],b[key]));}
function bounded<T>(raw:unknown,schema:z.ZodType<T>,maximum:number){inspect(raw);if(bytes(raw)>maximum)throw new TaskDiscussionError('Discussion material exceeds its byte bound.',413);let record:T;try{record=schema.parse(raw);}catch{throw new TaskDiscussionError('Invalid discussion material.',400);}if(!unchanged(raw,record))throw new TaskDiscussionError('Discussion material must already be canonical.',400);const payload=JSON.stringify(record);if(bytes(record)>maximum)throw new TaskDiscussionError('Discussion material exceeds its byte bound.',413);return {record,payload};}
export function boundedTaskDiscussionCommand(raw:unknown){const {record:command,payload}=bounded(raw,taskDiscussionCommandSchema,taskDiscussionLimits.requestBytes);return {command,payload};}
export function boundedTaskDiscussionRecord(raw:unknown){return bounded(raw,taskDiscussionRecordSchema,taskDiscussionLimits.recordBytes);}
export function boundedTaskDiscussionEvent(raw:unknown){return bounded(raw,taskDiscussionEventRecordSchema,taskDiscussionLimits.eventBytes);}
export const boundedTaskDiscussionEventRecord=boundedTaskDiscussionEvent;
export function boundedTaskDiscussionReport(raw:unknown){return bounded(raw,taskDiscussionPrivateReportSchema,taskDiscussionLimits.reportBytes);}
export function taskDiscussionRecordForCommand(rawCommand:unknown,rawAuthor:unknown,createdAt:string):TaskDiscussionRecord{
 const command=boundedTaskDiscussionCommand(rawCommand).command,author=bounded(rawAuthor,taskDiscussionAuthorSchema,512).record;if(command.action!=='publish')throw new TaskDiscussionError('This action creates no discussion message.',400);
 return boundedTaskDiscussionRecord({version:1,id:command.id,requestId:command.requestId,createdAt,author,task:command.task,claim:command.claim,replyTo:command.replyTo,kind:command.kind,body:command.body,policyAccepted:command.policyAccepted,executionEnabled:false}).record;
}
export function taskDiscussionCommandForRecord(raw:unknown,expectedTaskSequence=0):TaskDiscussionPublishCommand{
 const record=boundedTaskDiscussionRecord(raw).record;return boundedTaskDiscussionCommand({action:'publish',id:record.id,requestId:record.requestId,task:record.task,expectedTaskSequence,claim:record.claim,replyTo:record.replyTo,kind:record.kind,body:record.body,policyAccepted:record.policyAccepted}).command as TaskDiscussionPublishCommand;
}
export function taskDiscussionEventRecordForCommand(rawCommand:unknown,rawActor:unknown,createdAt:string):TaskDiscussionEventRecord{
 const command=boundedTaskDiscussionCommand(rawCommand).command,actor=bounded(rawActor,taskDiscussionAuthorSchema,512).record;if(command.action!=='withdraw'&&command.action!=='hide')throw new TaskDiscussionError('This action creates no discussion event.',400);
 return boundedTaskDiscussionEvent({version:1,task:command.task,message:command.message,actor,requestId:command.requestId,createdAt,action:command.action,expectedSequence:command.expectedSequence,sequence:command.expectedSequence+1,state:command.action==='hide'?'HIDDEN':'WITHDRAWN',reason:command.reason,policyAccepted:command.policyAccepted,executionEnabled:false}).record;
}
export const taskDiscussionEventForCommand=taskDiscussionEventRecordForCommand;
export function taskDiscussionReportForCommand(rawCommand:unknown,rawReporter:unknown,createdAt:string):TaskDiscussionPrivateReport{
 const command=boundedTaskDiscussionCommand(rawCommand).command,reporter=bounded(rawReporter,taskDiscussionAuthorSchema,512).record;if(command.action!=='report')throw new TaskDiscussionError('This action creates no private report.',400);
 return boundedTaskDiscussionReport({requestId:command.requestId,task:command.task,message:command.message,category:command.category,details:command.details,createdAt,reporter}).record;
}
/** Canonical correlation; configured maintainer authority remains the repository/HTTP responsibility. */
export async function validateTaskDiscussionItem(raw:unknown):Promise<TaskDiscussionItem>{
 const item=bounded(raw,taskDiscussionItemSchema,taskDiscussionLimits.responseBytes).record;
 if(item.record&&await contributionDigest(boundedTaskDiscussionRecord(item.record).payload)!==item.digest)throw new TaskDiscussionError('Discussion content digest does not match.',400);
 for(const event of item.events){const {digest,...record}=event;if(await contributionDigest(boundedTaskDiscussionEvent(record).payload)!==digest)throw new TaskDiscussionError('Discussion event digest does not match.',400);}
 return item;
}
export async function validateTaskDiscussionList(raw:unknown){const value=bounded(raw,taskDiscussionListSchema,taskDiscussionLimits.responseBytes).record;await validateContributionTaskItem(value.task);for(const item of value.items)await validateTaskDiscussionItem(item);return value;}
export async function validateTaskDiscussionGet(raw:unknown){const value=bounded(raw,taskDiscussionGetSchema,taskDiscussionLimits.responseBytes).record;await validateContributionTaskItem(value.task);await validateTaskDiscussionItem(value.item);return value;}
export async function validateTaskDiscussionReports(raw:unknown){const value=bounded(raw,taskDiscussionReportsSchema,taskDiscussionLimits.responseBytes).record;for(const report of value.reports)boundedTaskDiscussionReport(report);if(value.nextCursor!==null&&await contributionDigest(boundedTaskDiscussionReport(value.reports.at(-1)!).payload)!==value.nextCursor)throw new TaskDiscussionError('Private report cursor does not match its last record.',400);return value;}
export async function validateTaskDiscussionWrite(raw:unknown,rawCommand:unknown,rawPublicAuthor:unknown):Promise<TaskDiscussionWrite>{
 const receipt=bounded(raw,taskDiscussionWriteSchema,taskDiscussionLimits.responseBytes).record,{command,payload}=boundedTaskDiscussionCommand(rawCommand),author=bounded(rawPublicAuthor,taskDiscussionAuthorSchema,512).record,ack=receipt.acknowledgement;
 const fail=()=>{throw new TaskDiscussionError('Discussion receipt does not match the original command.',400);};
 if(receipt.action!==command.action||receipt.requestId!==command.requestId||!same(ack.actor,author)||ack.commandDigest!==await contributionDigest(payload)||!same(command.task,{id:receipt.task.id,digest:receipt.task.digest}))fail();
 await validateContributionTaskItem(receipt.task);
 if(command.action==='report'){
  const report=taskDiscussionReportForCommand(command,author,ack.createdAt),expected={requestId:report.requestId,task:report.task,message:report.message,category:report.category,createdAt:report.createdAt};
  if(!same(receipt.report,expected)||ack.digest!==await contributionDigest(boundedTaskDiscussionReport(report).payload))fail();return receipt;
 }
 const item=await validateTaskDiscussionItem(receipt.message);
 if(command.action==='publish'){
  const record=taskDiscussionRecordForCommand(command,author,ack.createdAt);if(item.id!==command.id||item.requestId!==command.requestId||!same(item.author,author)||receipt.task.sequence<command.expectedTaskSequence||item.digest!==await contributionDigest(boundedTaskDiscussionRecord(record).payload)||item.record&&!same(item.record,record))fail();
 }else{
  const record=taskDiscussionEventRecordForCommand(command,author,ack.createdAt),event=item.events.find(event=>event.requestId===command.requestId&&same(event.actor,author));
  if(item.id!==command.message.id||item.digest!==command.message.digest||ack.sequence!==record.sequence||!event)fail();
  if(event){const {digest,...retained}=event;if(!same(retained,record)||digest!==await contributionDigest(boundedTaskDiscussionEvent(record).payload))fail();}
 }
 return receipt;
}
