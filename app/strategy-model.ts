import {z} from 'zod';
import {researchSourceSchema,researchAuthorSchema,researchAuthorReferenceSchema,researchAuthorReference,researchDigest,researchPublicHumanId,type ResearchActor,type ResearchAuthor,type ResearchAuthorReference} from './research-model';
export {researchSourceSchema as strategySourceSchema,researchAuthorSchema as strategyAuthorSchema,researchAuthorReferenceSchema as strategyAuthorReferenceSchema,researchAuthorReference as strategyAuthorReference,researchDigest as strategyDigest,researchPublicHumanId as strategyPublicHumanId};
export type StrategyActor=ResearchActor;
export type StrategyAuthor=ResearchAuthor;
export type StrategyAuthorReference=ResearchAuthorReference;
const strategySourceSchema=researchSourceSchema,strategyAuthorSchema=researchAuthorSchema,strategyAuthorReferenceSchema=researchAuthorReferenceSchema,strategyAuthorReference=researchAuthorReference,strategyDigest=researchDigest;

export const strategyLimits={requestBytes:32768,payloadBytes:28672,publishPerSponsorDay:10,stored:1000,revisions:32,eventsPerRecord:16,reportsPerSponsorDay:10,reportsStored:1000,page:20} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/),humanId=z.string().regex(/^human_[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const text=(maximum:number,minimum=1)=>z.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>!tokenLike(value),'Agent credentials cannot be published.');
function tokenLike(value:string){for(let n=0;n<3;n++){if(/og_agent_/i.test(value))return true;try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}}return false;}
const policy=z.literal('public-strategy-v1');
const finite=(minimum:number,maximum:number)=>z.number().finite().min(minimum).max(maximum);
export const strategyEntrySchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('TREND'),fastPeriod:z.number().int().min(2).max(100),slowPeriod:z.number().int().min(3).max(300),confirmation:z.enum(['CROSS','ALIGNED'])}).strict(),
 z.object({type:z.literal('RSI'),period:z.number().int().min(2).max(100),threshold:finite(1,99),comparison:z.enum(['BELOW','ABOVE'])}).strict(),
 z.object({type:z.literal('BREAKOUT'),lookback:z.number().int().min(2).max(300)}).strict(),
 z.object({type:z.literal('DCA'),intervalBars:z.number().int().min(1).max(500),maxEntries:z.number().int().min(1).max(10)}).strict(),
 z.object({type:z.literal('GRID'),lowerPrice:z.number().finite().positive().max(1e9),upperPrice:z.number().finite().positive().max(1e9),levels:z.number().int().min(2).max(30)}).strict(),
 z.object({type:z.literal('SIGNAL'),provider:z.enum(['ALTFINS','TRADINGVIEW','CUSTOM']),event:z.enum(['BULLISH','BEARISH']),maxAgeBars:z.number().int().min(1).max(50)}).strict(),
 z.object({type:z.literal('RULES'),match:z.enum(['ALL','ANY']),conditions:z.array(z.object({indicator:z.enum(['PRICE_SMA','RSI','RETURN']),period:z.number().int().min(2).max(300),comparison:z.enum(['GT','LT','CROSSES_ABOVE','CROSSES_BELOW']),threshold:finite(-100,1000000)}).strict()).min(1).max(8)}).strict(),
]);
export const strategyDefinitionSchema=z.object({schemaVersion:z.literal(1),market:z.object({symbol:z.string().regex(/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/),timeframe:z.enum(['5m','15m','1h','4h','1d']),direction:z.enum(['LONG','SHORT'])}).strict(),entry:strategyEntrySchema,risk:z.object({positionPct:finite(.1,10),maxOpenPositions:z.number().int().min(1).max(5),stopLossPct:finite(.1,20),takeProfitPct:finite(.1,100),maxDailyLossPct:finite(.1,5)}).strict(),costs:z.object({feeBps:finite(0,100),slippageBps:finite(0,200)}).strict(),execution:z.object({mode:z.literal('DEMO'),leverage:z.literal(1),ordersEnabled:z.literal(false)}).strict()}).strict().superRefine((definition,ctx)=>{
 const entry=definition.entry;
 if(entry.type==='TREND'&&entry.fastPeriod>=entry.slowPeriod)ctx.addIssue({code:z.ZodIssueCode.custom,path:['entry','fastPeriod'],message:'The fast period must be less than the slow period.'});
 if(entry.type==='GRID'&&entry.lowerPrice>=entry.upperPrice)ctx.addIssue({code:z.ZodIssueCode.custom,path:['entry','lowerPrice'],message:'The grid lower price must be less than the upper price.'});
 if(entry.type==='SIGNAL'&&(entry.event==='BULLISH')!==(definition.market.direction==='LONG'))ctx.addIssue({code:z.ZodIssueCode.custom,path:['market','direction'],message:'The signal event must agree with the market direction.'});
});
export type StrategyDefinition=z.infer<typeof strategyDefinitionSchema>;
export type StrategyEntryType=StrategyDefinition['entry']['type'];
/** Conservative research examples, not executable or validated strategies. positionPct is the total allocation across DCA/grid entries. */
export function strategyTemplate(type:StrategyEntryType):StrategyDefinition{
 const entries:Record<StrategyEntryType,StrategyDefinition['entry']>={TREND:{type:'TREND',fastPeriod:20,slowPeriod:50,confirmation:'CROSS'},RSI:{type:'RSI',period:14,threshold:30,comparison:'BELOW'},BREAKOUT:{type:'BREAKOUT',lookback:20},DCA:{type:'DCA',intervalBars:24,maxEntries:4},GRID:{type:'GRID',lowerPrice:50000,upperPrice:70000,levels:6},SIGNAL:{type:'SIGNAL',provider:'ALTFINS',event:'BULLISH',maxAgeBars:3},RULES:{type:'RULES',match:'ALL',conditions:[{indicator:'PRICE_SMA',period:20,comparison:'GT',threshold:1}]}};
 return strategyDefinitionSchema.parse({schemaVersion:1,market:{symbol:'BTC/USDT',timeframe:'1h',direction:'LONG'},entry:entries[type],risk:{positionPct:1,maxOpenPositions:1,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:1},costs:{feeBps:10,slippageBps:10},execution:{mode:'DEMO',leverage:1,ordersEnabled:false}});
}
export const strategyRelationSchema=z.object({type:z.enum(['REVISION','FORK']),id:uuid,digest:hash}).strict();
const contentFields={name:text(120),description:text(3000),assumptions:text(1500),falsification:text(2000),sources:z.array(strategySourceSchema).max(8),definition:strategyDefinitionSchema,relation:strategyRelationSchema.nullable()};
export const strategyPublishSchema=z.object({action:z.literal('publish'),requestId:uuid,id:uuid,...contentFields,policyAccepted:policy}).strict().refine(command=>command.relation?.id!==command.id,'A strategy cannot reference itself.');
const common={requestId:uuid,id:uuid,digest:hash,policyAccepted:policy};
export const strategyWithdrawSchema=z.object({action:z.literal('withdraw'),...common,reason:z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE'])}).strict();
export const strategyReportSchema=z.object({action:z.literal('report'),...common,reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','OTHER']),details:text(1500)}).strict();
export const strategyModerateSchema=z.object({action:z.literal('moderate'),...common,state:z.enum(['VISIBLE','HIDDEN']),reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','POLICY','RESTORED'])}).strict().refine(command=>(command.state==='VISIBLE')===(command.reason==='RESTORED'),'Restoration uses RESTORED; hiding uses a policy reason.');
export const strategyCommandSchema=z.union([strategyPublishSchema,strategyWithdrawSchema,strategyReportSchema,strategyModerateSchema]);
export type StrategyCommand=z.infer<typeof strategyCommandSchema>;
export const strategyRecordSchema=z.object({version:z.literal(1),id:uuid,rootId:uuid,revision:z.number().int().min(1).max(strategyLimits.revisions),requestId:uuid,createdAt:clock,author:strategyAuthorSchema,content:z.object(contentFields).strict(),policyAccepted:policy,verification:z.literal('UNTESTED'),executionEnabled:z.literal(false)}).strict().superRefine((record,ctx)=>{
 if(record.author.kind==='HUMAN'&&record.author.id!==record.author.sponsorId)ctx.addIssue({code:z.ZodIssueCode.custom,path:['author'],message:'A human is their own sponsor.'});
 if((record.revision===1)!==(record.rootId===record.id))ctx.addIssue({code:z.ZodIssueCode.custom,path:['rootId'],message:'Only the first revision creates its own root.'});
 if((record.revision>1)!==(record.content.relation?.type==='REVISION'))ctx.addIssue({code:z.ZodIssueCode.custom,path:['revision'],message:'Revisions must reference a prior revision.'});
 const command=strategyPublishSchema.safeParse({action:'publish',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});if(!command.success)command.error.issues.forEach(issue=>ctx.addIssue({...issue,path:['content',...issue.path]}));
});
export type StrategyRecord=z.infer<typeof strategyRecordSchema>;
const state=z.enum(['VISIBLE','HIDDEN','WITHDRAWN']);
const safeReason=z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE','SPAM','ABUSE','MISLEADING','POLICY','RESTORED']);
export const strategyPublicEventSchema=z.object({sequence:z.number().int().min(1).max(strategyLimits.eventsPerRecord),requestId:uuid,createdAt:clock,actor:strategyAuthorReferenceSchema,state,reason:safeReason}).strict();
export type StrategyPublicEvent=z.infer<typeof strategyPublicEventSchema>;
export const strategyPublicItemSchema=z.object({id:uuid,digest:hash,rootId:uuid,revision:z.number().int().min(1).max(strategyLimits.revisions),requestId:uuid,createdAt:clock,author:strategyAuthorReferenceSchema,state,reason:safeReason.nullable(),record:strategyRecordSchema.nullable(),moderation:z.array(strategyPublicEventSchema).max(strategyLimits.eventsPerRecord)}).strict().superRefine((item,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if((item.state==='VISIBLE')!==(item.record!==null))bad('Non-visible strategy must be a content-free tombstone.');
 if(item.record&&(item.id!==item.record.id||item.rootId!==item.record.rootId||item.revision!==item.record.revision||item.requestId!==item.record.requestId||item.createdAt!==item.record.createdAt||JSON.stringify(item.author)!==JSON.stringify(strategyAuthorReference(item.record.author))))bad('Public identity must match the retained record.');
 let current='VISIBLE';let reason:string|null=null;
 item.moderation.forEach((event,index)=>{if(event.sequence!==index+1||current==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(index?item.moderation[index-1].createdAt:item.createdAt))bad('Moderation history is inconsistent.');current=event.state;reason=event.reason;});
 if(current!==item.state||reason!==item.reason)bad('Public state must match its retained events.');
});
export type StrategyPublicItem=z.infer<typeof strategyPublicItemSchema>;
export const strategyListSchema=z.object({version:z.literal(1),items:z.array(strategyPublicItemSchema).max(strategyLimits.page),nextCursor:uuid.nullable(),executionEnabled:z.literal(false)}).strict();
export const strategyGetSchema=z.object({version:z.literal(1),item:strategyPublicItemSchema,executionEnabled:z.literal(false)}).strict();
export const strategyHistorySchema=z.object({version:z.literal(1),items:z.array(strategyPublicItemSchema).max(strategyLimits.revisions),executionEnabled:z.literal(false)}).strict();
export const strategyPrivateReportSchema=z.object({requestId:uuid,id:uuid,digest:hash,reason:strategyReportSchema.shape.reason,details:text(1500),createdAt:clock,reporter:strategyAuthorReferenceSchema}).strict();
export const strategyReportReceiptSchema=strategyPrivateReportSchema.omit({details:true,reporter:true});
export const strategyReportsSchema=z.object({version:z.literal(1),reports:z.array(strategyPrivateReportSchema).max(strategyLimits.page),nextCursor:hash.nullable(),executionEnabled:z.literal(false)}).strict();
export const strategyWriteSchema=z.object({version:z.literal(1),action:z.enum(['publish','withdraw','report','moderate']),requestId:uuid,item:strategyPublicItemSchema.nullable(),report:strategyReportReceiptSchema.nullable(),executionEnabled:z.literal(false)}).strict().refine(value=>value.action==='report'?value.item===null&&value.report?.requestId===value.requestId:value.item!==null&&value.report===null,'Write receipts must match their action.');
export const strategyMeSchema=z.object({version:z.literal(1),authorId:humanId,sponsorId:humanId,moderator:z.boolean(),executionEnabled:z.literal(false)}).strict().refine(value=>value.authorId===value.sponsorId);
export class StrategyError extends Error{constructor(message:string,public status=409,public retryAfterSeconds?:number){super(message);}}
export function boundedStrategyCommand(raw:unknown){const command=strategyCommandSchema.parse(raw),payload=JSON.stringify(command);if(new TextEncoder().encode(payload).byteLength>strategyLimits.requestBytes)throw new StrategyError('Strategy command is too large.',413);return {command,payload};}
export function boundedStrategyRecord(raw:unknown){const record=strategyRecordSchema.parse(raw),payload=JSON.stringify(record);if(new TextEncoder().encode(payload).byteLength>strategyLimits.payloadBytes)throw new StrategyError('Strategy content is too large.',413);return {record,payload};}
