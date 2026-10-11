import {z} from 'zod';
import {comparisonReportSchema,comparisonLimits,verifyComparisonReport,compareComparisonPair,type ComparisonReport} from './comparison-model';
import {boundedStrategyRecord,strategyDigest,strategyPublicItemSchema,type StrategyPublicItem} from './strategy-model';
import {experimentReferenceSchema,experimentPublicItemSchema,experimentPublicEventSchema,experimentPrivateReportSchema,experimentReportReceiptSchema,experimentPublicHumanId,validateExperimentItem,verifyExperimentArtifact,experimentManifestFlags,experimentOutcomeFlags,type ExperimentPublicItem,type ExperimentAuthorReference} from './experiment-model';
import {ventureCredentialLike} from './venture-model';

export {experimentPublicHumanId as experimentReviewPublicHumanId,strategyDigest as experimentReviewDigest,experimentPublicEventSchema as experimentReviewPublicEventSchema,experimentPrivateReportSchema as experimentReviewPrivateReportSchema,experimentReportReceiptSchema as experimentReviewReportReceiptSchema};
export const experimentReviewLimits={requestBytes:393216,recordBytes:327680,maximumDepth:16,page:20,reviewsPerOutcome:32,retained:250,perSponsorDay:10,eventsPerRecord:16,reportsPerSponsorDay:10,reportsStored:250,verificationMemoEntries:128} as const;
export const experimentReviewReasons=['COMPUTATION_MATCH','COMPUTATION_MISMATCH','INCOMPLETE_EVIDENCE','UNSUPPORTED_METHOD','SELF_REVIEW','SHARED_SPONSOR','SHARED_PROCESS','POST_SELECTED','INCOMPLETE_SEARCH_LOG','TRAIN_EVAL_OVERLAP','OVERLAP_UNKNOWN','NO_HOLDOUT','HOLDOUT_SEEN','HOLDOUT_ACCESS_UNKNOWN','HOLDOUT_REUSED','CONFLICT_OF_INTEREST','METHOD_OR_INPUT_MISMATCH','OTHER'] as const;
export const experimentReviewSharedDependencies=['METHOD_SPECIFICATION','JAVASCRIPT_NUMBER_RUNTIME','INPUT_SCHEMAS_AND_HASHING','INPUT_DATA_AND_OPERATOR','REVIEW_OF_PRIMARY_SOURCE'] as const;
export const experimentReviewBlockingFlags=['POST_SELECTED','INCOMPLETE_SEARCH_LOG','TRAIN_EVAL_OVERLAP','OVERLAP_UNKNOWN','NO_HOLDOUT','HOLDOUT_SEEN','HOLDOUT_ACCESS_UNKNOWN','HOLDOUT_REUSED'] as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/),humanId=z.string().regex(/^human_[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const text=(max:number,min=1)=>z.string().trim().min(min).max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>!ventureCredentialLike(value),'Credentials cannot be published.');
const policy=z.literal('public-experiment-review-v1');
export const experimentReviewAuthorSchema=z.object({kind:z.literal('HUMAN'),id:humanId,sponsorId:humanId}).strict().refine(value=>value.id===value.sponsorId,'A reviewer is their own human sponsor.');
export type ExperimentReviewAuthor=z.infer<typeof experimentReviewAuthorSchema>;
/** A role supplied only by authenticated server context; it is not a publication field. */
export type ExperimentReviewActor={kind:'HUMAN';userId:string;moderator:boolean;reviewer:boolean};
export const experimentReviewReasonSchema=z.enum(experimentReviewReasons);
const reasons=z.array(experimentReviewReasonSchema).min(1).max(16).refine(value=>new Set(value).size===value.length,'Review reasons must be unique.');
export const experimentReviewTargetSchema=z.object({original:experimentReferenceSchema,reproduction:experimentReferenceSchema,manifest:experimentReferenceSchema,strategy:experimentReferenceSchema}).strict().refine(value=>value.original.id!==value.reproduction.id,'Original and reproduction must be distinct outcomes.');
export const experimentReviewEvidenceSchema=z.object({original:comparisonReportSchema,reproduction:comparisonReportSchema}).strict();
export const experimentReviewAttestationsSchema=z.object({fixedCode:z.boolean(),exactInputs:z.boolean(),inspectedDifferences:z.boolean(),separateOriginalAndReproductionProcesses:z.boolean()}).strict();
const sharedDependencies=z.tuple([z.literal('METHOD_SPECIFICATION'),z.literal('JAVASCRIPT_NUMBER_RUNTIME'),z.literal('INPUT_SCHEMAS_AND_HASHING'),z.literal('INPUT_DATA_AND_OPERATOR'),z.literal('REVIEW_OF_PRIMARY_SOURCE')]);
const decision=z.enum(['REPRODUCED','DISPUTED','HELD','REJECTED']);
const contentFields={target:experimentReviewTargetSchema,previous:experimentReferenceSchema.nullable(),decision,reasons,evidence:experimentReviewEvidenceSchema.nullable(),attestations:experimentReviewAttestationsSchema,sharedDependencies,otherConflicts:text(1500,0),note:text(2000)};
function contentRules(value:z.infer<typeof contentShape>,ctx:z.RefinementCtx){
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(value.decision==='REPRODUCED'){
  if(!value.evidence||value.evidence.original.status!=='MATCH'||value.evidence.reproduction.status!=='MATCH'||Object.values(value.attestations).some(item=>!item))bad('Reproduction requires two matches and every process attestation.');
  if(!value.reasons.includes('COMPUTATION_MATCH')||value.reasons.some(item=>item!=='COMPUTATION_MATCH'))bad('A positive computational review cannot carry adverse reasons.');
 }
 if(value.decision==='DISPUTED'&&(!value.evidence||![value.evidence.original.status,value.evidence.reproduction.status].includes('MISMATCH')||!value.reasons.includes('COMPUTATION_MISMATCH')))bad('A dispute requires retained mismatching computation evidence.');
 if((value.decision==='REPRODUCED'||value.decision==='DISPUTED')&&(!value.attestations.fixedCode||!value.attestations.exactInputs||!value.attestations.inspectedDifferences))bad('A computational decision requires explicit fixed-code, input and difference attestations.');
 if(value.decision!=='REPRODUCED'&&value.reasons.includes('COMPUTATION_MATCH'))bad('Only a positive computational review can use its matching reason.');
 if(value.reasons.includes('UNSUPPORTED_METHOD')&&(value.decision!=='HELD'||value.evidence!==null))bad('Unsupported methods require an evidence-free hold.');
}
const contentShape=z.object(contentFields).strict();
export const experimentReviewContentSchema=contentShape.superRefine(contentRules);
export const experimentReviewPublishSchema=z.object({action:z.literal('review'),requestId:uuid,id:uuid,...contentFields,policyAccepted:policy}).strict().superRefine((value,ctx)=>{
 contentRules(value,ctx);
 if(Object.values(value.target).some(reference=>reference.id===value.id)||value.previous?.id===value.id)ctx.addIssue({code:z.ZodIssueCode.custom,message:'A review cannot reference itself.'});
});
export type ExperimentReviewPublishCommand=z.infer<typeof experimentReviewPublishSchema>;
const common={requestId:uuid,id:uuid,digest:hash,policyAccepted:policy};
export const experimentReviewWithdrawSchema=z.object({action:z.literal('withdraw'),...common,reason:z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE'])}).strict();
export const experimentReviewReportSchema=z.object({action:z.literal('report'),...common,reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','OTHER']),details:text(1500)}).strict();
export const experimentReviewModerateSchema=z.object({action:z.literal('moderate'),...common,state:z.enum(['VISIBLE','HIDDEN']),reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','POLICY','RESTORED'])}).strict().refine(value=>(value.state==='VISIBLE')===(value.reason==='RESTORED'),'Restoration requires RESTORED.');
export const experimentReviewCommandSchema=z.union([experimentReviewPublishSchema,experimentReviewWithdrawSchema,experimentReviewReportSchema,experimentReviewModerateSchema]);
export type ExperimentReviewCommand=z.infer<typeof experimentReviewCommandSchema>;
export function experimentReviewContent(command:ExperimentReviewPublishCommand){return {target:command.target,previous:command.previous,decision:command.decision,reasons:command.reasons,evidence:command.evidence,attestations:command.attestations,sharedDependencies:command.sharedDependencies,otherConflicts:command.otherConflicts,note:command.note};}
const labels={classification:z.literal('REVIEW_ATTESTATION'),executionAssurance:z.literal('TRUSTED_HUMAN_ATTESTATION'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false)};
export const experimentReviewRecordSchema=z.object({version:z.literal(1),id:uuid,requestId:uuid,createdAt:clock,author:experimentReviewAuthorSchema,sequence:z.number().int().min(1).max(experimentReviewLimits.reviewsPerOutcome),content:experimentReviewContentSchema,policyAccepted:policy,...labels}).strict().superRefine((record,ctx)=>{
 if((record.sequence===1)!==(record.content.previous===null))ctx.addIssue({code:z.ZodIssueCode.custom,message:'The first review has no prior head; subsequent reviews require one.'});
 const command=experimentReviewPublishSchema.safeParse({action:'review',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});
 if(!command.success)command.error.issues.forEach(issue=>ctx.addIssue({...issue,path:['content',...issue.path]}));
});
export type ExperimentReviewRecord=z.infer<typeof experimentReviewRecordSchema>;
export function experimentReviewCommandForRecord(record:ExperimentReviewRecord):ExperimentReviewPublishCommand{return experimentReviewPublishSchema.parse({action:'review',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});}
const state=z.enum(['VISIBLE','HIDDEN','WITHDRAWN']),safeReason=z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE','SPAM','ABUSE','MISLEADING','POLICY','RESTORED']);
const publicFields={id:uuid,digest:hash,requestId:uuid,createdAt:clock,author:experimentReviewAuthorSchema,sequence:z.number().int().min(1).max(experimentReviewLimits.reviewsPerOutcome),target:experimentReviewTargetSchema,previous:experimentReferenceSchema.nullable(),state,reason:safeReason.nullable(),suppression:z.enum(['SOURCE_UNAVAILABLE','PARENT_UNAVAILABLE','OUTCOME_UNAVAILABLE']).nullable(),decision:decision.nullable()};
function outerRules(item:z.infer<typeof publicShape>){return (item.sequence===1)===(item.previous===null)&&(!item.suppression||item.state!=='VISIBLE')&&((item.state==='VISIBLE')===(item.decision!==null));}
const publicShape=z.object(publicFields).strict();
export const experimentReviewPublicItemSchema=z.object({...publicFields,record:experimentReviewRecordSchema.nullable(),moderation:z.array(experimentPublicEventSchema).max(experimentReviewLimits.eventsPerRecord)}).strict().superRefine((item,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(!outerRules(item)||(item.state==='VISIBLE')!==(item.record!==null))bad('Review projection must suppress its authored content.');
 const record=item.record;
 if(record&&(item.id!==record.id||item.requestId!==record.requestId||item.createdAt!==record.createdAt||item.sequence!==record.sequence||JSON.stringify(item.author)!==JSON.stringify(record.author)||JSON.stringify(item.target)!==JSON.stringify(record.content.target)||JSON.stringify(item.previous)!==JSON.stringify(record.content.previous)||item.decision!==record.content.decision))bad('Review public identity must match its record.');
 let own='VISIBLE',reason:string|null=null,time=item.createdAt;
 for(let n=0;n<item.moderation.length;n++){const event=item.moderation[n];if(event.sequence!==n+1||own==='WITHDRAWN'||event.createdAt<time)bad('Review moderation history is inconsistent.');own=event.state;reason=event.reason;time=event.createdAt;}
 if(item.reason!==reason||item.state!==(own==='WITHDRAWN'?'WITHDRAWN':own==='HIDDEN'||item.suppression?'HIDDEN':'VISIBLE'))bad('Review projection must follow current suppression and events.');
});
export type ExperimentReviewPublicItem=z.infer<typeof experimentReviewPublicItemSchema>;
export const experimentReviewSummarySchema=z.object({...publicFields,reasons:z.array(experimentReviewReasonSchema).max(16).refine(value=>new Set(value).size===value.length)}).strict().refine(item=>outerRules(item)&&(item.state==='VISIBLE'?item.reasons.length>0:item.reasons.length===0),'Review summary must suppress authored reasons.');
export type ExperimentReviewSummary=z.infer<typeof experimentReviewSummarySchema>;
export const experimentReviewHeadSchema=z.object({id:uuid,digest:hash,sequence:z.number().int().min(1).max(experimentReviewLimits.reviewsPerOutcome)}).strict();
export const experimentReviewListSchema=z.object({version:z.literal(1),target:experimentReferenceSchema,currentHead:experimentReviewHeadSchema.nullable(),items:z.array(experimentReviewSummarySchema).max(experimentReviewLimits.page),nextCursor:uuid.nullable(),executionEnabled:z.literal(false)}).strict().superRefine((page,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(new Set(page.items.map(item=>item.id)).size!==page.items.length||new Set(page.items.map(item=>item.sequence)).size!==page.items.length)bad('Review page identities and sequences must be unique.');
 if(page.currentHead===null&&page.items.length)bad('A review page with retained history requires its current head.');
 if(page.currentHead)for(const item of page.items){if(item.sequence>page.currentHead.sequence)bad('Review page sequence exceeds the current head.');if(item.id===page.currentHead.id||item.sequence===page.currentHead.sequence){if(item.id!==page.currentHead.id||item.digest!==page.currentHead.digest||item.sequence!==page.currentHead.sequence)bad('Review page must agree with its current head.');}}
 page.items.forEach((item,index)=>{if(JSON.stringify(item.target.original)!==JSON.stringify(page.target))bad('Review pages require one exact original outcome.');const previous=page.items[index-1];if(previous&&(item.createdAt>previous.createdAt||item.createdAt===previous.createdAt&&item.id>=previous.id))bad('Reviews must be strictly newest first.');});
 if(page.nextCursor!==null&&(page.items.length!==experimentReviewLimits.page||page.nextCursor!==page.items.at(-1)?.id))bad('Review cursor must identify the final full-page entry.');
});
export const experimentReviewGetSchema=z.object({version:z.literal(1),item:experimentReviewPublicItemSchema,executionEnabled:z.literal(false)}).strict();
export const experimentReviewWriteSchema=z.object({version:z.literal(1),action:z.enum(['review','withdraw','report','moderate']),requestId:uuid,item:experimentReviewPublicItemSchema.nullable(),report:experimentReportReceiptSchema.nullable(),executionEnabled:z.literal(false)}).strict().refine(value=>value.action==='report'?value.item===null&&value.report?.requestId===value.requestId:value.item!==null&&value.report===null,'Review receipt must match its action.');
export const experimentReviewMeSchema=z.object({version:z.literal(1),authorId:humanId,sponsorId:humanId,moderator:z.boolean(),reviewer:z.boolean(),executionEnabled:z.literal(false)}).strict().refine(value=>value.authorId===value.sponsorId);
export const experimentReviewReportsSchema=z.object({version:z.literal(1),reports:z.array(experimentPrivateReportSchema).max(experimentReviewLimits.page),nextCursor:hash.nullable(),executionEnabled:z.literal(false)}).strict();
export class ExperimentReviewError extends Error{constructor(message:string,public status=409,public retryAfterSeconds?:number){super(message);}}
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;
function plain(value:unknown,n=0){
 if(n>experimentReviewLimits.maximumDepth)throw new ExperimentReviewError('Review nesting is too deep.',400);
 if(value&&typeof value==='object'){
  const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null&&prototype!==Array.prototype)throw new ExperimentReviewError('Review material must be plain data.',400);
  if(Object.getOwnPropertySymbols(value).length)throw new ExperimentReviewError('Review material must be plain data.',400);
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){if(!('value'in descriptor))throw new ExperimentReviewError('Review material must be plain data.',400);plain(descriptor.value,n+1);}
 }else if(typeof value==='string'){
  if(ventureCredentialLike(value))throw new ExperimentReviewError('Credentials cannot be published.',400);
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new ExperimentReviewError('Review strings contain invalid controls.',400);
 }else if(value!==null&&typeof value!=='boolean'&&(typeof value!=='number'||!Number.isFinite(value)))throw new ExperimentReviewError('Review material must be plain JSON data.',400);
}
function reportBounds(evidence:z.infer<typeof experimentReviewEvidenceSchema>|null){if(evidence)for(const report of Object.values(evidence))if(bytes(JSON.stringify(report))>comparisonLimits.reportBytes)throw new ExperimentReviewError('Comparison evidence exceeds its bound.',413);}
export function boundedExperimentReviewCommand(raw:unknown){plain(raw);if(bytes(JSON.stringify(raw))>experimentReviewLimits.requestBytes)throw new ExperimentReviewError('Review command exceeds its bound.',413);const command=experimentReviewCommandSchema.parse(raw),payload=JSON.stringify(command);if(bytes(payload)>experimentReviewLimits.requestBytes)throw new ExperimentReviewError('Review command exceeds its bound.',413);if(command.action==='review')reportBounds(command.evidence);return {command,payload};}
export function boundedExperimentReviewRecord(raw:unknown){plain(raw);if(bytes(JSON.stringify(raw))>experimentReviewLimits.recordBytes)throw new ExperimentReviewError('Review record exceeds its bound.',413);const record=experimentReviewRecordSchema.parse(raw),payload=JSON.stringify(record);if(bytes(payload)>experimentReviewLimits.recordBytes)throw new ExperimentReviewError('Review record exceeds its bound.',413);boundedExperimentReviewCommand(experimentReviewCommandForRecord(record));return {record,payload};}
export async function validateExperimentReviewItem(raw:unknown){
 plain(raw);const item=experimentReviewPublicItemSchema.parse(raw);
 if(item.record){const checked=boundedExperimentReviewRecord(item.record);if(await strategyDigest(checked.payload)!==item.digest)throw new ExperimentReviewError('Review record digest does not match.',400);if(checked.record.content.evidence)for(const report of Object.values(checked.record.content.evidence))await verifyComparisonReport(report);}
 return item;
}
const draftBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_EXPERIMENT_REVIEW_DRAFT'),preparedAt:clock,target:experimentReviewTargetSchema,evidence:experimentReviewEvidenceSchema,classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false)}).strict();
export const experimentReviewDraftSchema=draftBody.extend({draftDigest:hash});
export type LocalExperimentReviewDraft=z.infer<typeof experimentReviewDraftSchema>;
export async function sealExperimentReviewDraft(raw:unknown):Promise<LocalExperimentReviewDraft>{plain(raw);if(bytes(JSON.stringify(raw))>experimentReviewLimits.requestBytes)throw new ExperimentReviewError('Review draft exceeds its bound.',413);const body=draftBody.parse(raw);reportBounds(body.evidence);for(const report of Object.values(body.evidence))await verifyComparisonReport(report);const result=experimentReviewDraftSchema.parse({...body,draftDigest:await strategyDigest(JSON.stringify(body))});if(bytes(JSON.stringify(result))>experimentReviewLimits.requestBytes)throw new ExperimentReviewError('Review draft exceeds its bound.',413);return result;}
export async function verifyExperimentReviewDraft(raw:unknown):Promise<LocalExperimentReviewDraft>{plain(raw);const draft=experimentReviewDraftSchema.parse(raw),{draftDigest,...body}=draft;const checked=await sealExperimentReviewDraft(body);if(checked.draftDigest!==draftDigest)throw new ExperimentReviewError('Review draft identity does not match.',400);return checked;}
export type ExperimentReviewReferences={original:ExperimentPublicItem;reproduction:ExperimentPublicItem;manifest:ExperimentPublicItem;strategy:StrategyPublicItem};
/** Allocate once per repository operation. Never retain across requests, populate
 * from caller input, or use this for permissions/current visibility. Keys include
 * exact immutable bytes, so a reused digest cannot conceal changed material. */
export type ExperimentReviewVerificationMemo=Map<string,Promise<void>>;
export function createExperimentReviewVerificationMemo():ExperimentReviewVerificationMemo{return new Map();}
async function verified(memo:ExperimentReviewVerificationMemo|undefined,currentMaterial:string,check:()=>Promise<unknown>):Promise<void>{
 if(!memo){await check();return;}
 const key=await strategyDigest(currentMaterial),existing=memo.get(key);if(existing){await existing;return;}
 // Hash freshly normalized bytes, rather than trusting a retained digest. Only
 // bounded hash/void markers survive verification; no payload copy is retained.
 const pending=Promise.resolve().then(check).then(()=>undefined);
 if(memo.size<experimentReviewLimits.verificationMemoEntries)memo.set(key,pending);
 try{await pending;}catch(error){if(memo.get(key)===pending)memo.delete(key);throw error;}
}
function requireBinding(ok:boolean,message:string){if(!ok)throw new ExperimentReviewError(message,400);}
async function immutableExperiment(item:ExperimentPublicItem,memo?:ExperimentReviewVerificationMemo){
 requireBinding(item.record!==null,'Review evidence requires a retained experiment record.');
 // Current visibility is enforced by the repository. Full canonical history may be
 // checked after suppression without exposing its authored content publicly.
 const immutable=experimentPublicItemSchema.parse({...item,state:'VISIBLE',reason:null,suppression:null,moderation:[]});
 await verified(memo,'experiment:'+JSON.stringify(immutable),()=>validateExperimentItem(immutable));
 return immutable;
}
function same(left:unknown,right:unknown){return JSON.stringify(left)===JSON.stringify(right);}
function summary(artifact:{status:unknown;reason:unknown;metrics:unknown;benchmark:unknown}){return {status:artifact.status,reason:artifact.reason,metrics:artifact.metrics,benchmark:artifact.benchmark};}
function operand(root:unknown,path:string){
 const parts=path.match(/^[A-Za-z][A-Za-z0-9]*|\.[A-Za-z][A-Za-z0-9]*|\[(?:0|[1-9]\d*)\]/g);
 requireBinding(parts!==null&&parts.join('')===path&&/^(?:status|reason|audit|trades|equity|metrics|benchmark)(?:[.\[]|$)/.test(path),'Comparison difference paths must name semantic result fields.');
 let value=root;
 for(const part of parts??[]){
  const key=part.startsWith('.')?part.slice(1):part.startsWith('[')?part.slice(1,-1):part;
  if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))return {present:false,value:undefined};
  value=(value as Record<string,unknown>)[key];
 }
 return {present:true,value};
}
const displayed=(value:unknown)=>typeof value==='number'||typeof value==='boolean'?value:null;
async function bindReport(raw:ComparisonReport,artifact:Parameters<typeof verifyExperimentArtifact>[0]){
 requireBinding(!('kind'in artifact),'Batch A/B evidence cannot bind a continuous artifact.');
 if('kind'in artifact)throw new ExperimentReviewError('Unsupported method.',400);
 const report=await verifyComparisonReport(raw),identity=report.identity;
 requireBinding(identity.claimedArtifact===artifact.resultDigest&&identity.requestId===artifact.requestId&&identity.request===artifact.digests.request&&identity.strategy===artifact.digests.strategy&&identity.dataset===artifact.digests.dataset&&identity.signals===artifact.digests.signals&&identity.declaredMethod===artifact.digests.evaluator,'Comparison evidence must bind every exact artifact identity.');
 requireBinding(same(report.summaries.claimed,summary(artifact)),'Comparison claimed summary must match the exact retained artifact.');
 if(report.status==='MATCH'||report.status==='MISMATCH'){
  const summaries=report.summaries;
  const trace={...summary(artifact),audit:artifact.audit.map(({details,...row})=>{void details;return row;}),trades:artifact.trades,equity:artifact.equity};
  for(const [n,left,right] of [[0,summaries.claimed,summaries.primary],[1,summaries.claimed,summaries.reference],[2,summaries.primary,summaries.reference]] as const){
   const subset=compareComparisonPair(report.pairs[n].pair,left,right),pair=report.pairs[n];
   requireBinding(!pair.matches||subset.matches,'Matched pairs cannot contradict their retained summaries.');
   requireBinding(pair.differenceCount>=subset.differenceCount,'Comparison pairs cannot omit declared summary differences.');
   requireBinding(new Set(pair.differences.map(difference=>difference.path)).size===pair.differences.length,'A bounded comparison cannot duplicate difference paths.');
   for(const difference of pair.differences){
    // Complete fresh traces remain a human execution attestation. Retained claim
    // operands and any available summary operands can still be checked purely.
    operand(trace,difference.path);
    if(n<2){const claim=operand(trace,difference.path);requireBinding(claim.present&&difference.left===displayed(claim.value),'Comparison claim operands must bind the retained semantic trace.');}
    if(/^(?:status|reason|metrics|benchmark)(?:\.|$)/.test(difference.path)){
     const a=operand(left,difference.path),b=operand(right,difference.path);
     requireBinding(difference.left===displayed(a.value)&&difference.right===displayed(b.value)&&subset.differences.some(item=>same(item,difference)),'Comparison summary differences must bind their exact retained operands.');
    }
   }
  }
 }
 return report;
}
/** Pure immutable-evidence binding only. This never grants reviewer authority or
 * executes an evaluator. The repository separately enforces current permissions,
 * visibility, exact previous head, atomic capacity and replay identity. */
export async function validateExperimentReviewBindings(raw:ExperimentReviewPublishCommand,references:ExperimentReviewReferences,reviewer:ExperimentAuthorReference,at?:string,verificationMemo?:ExperimentReviewVerificationMemo):Promise<void>{
 const {command}=boundedExperimentReviewCommand(raw);requireBinding(command.action==='review','A publication command is required.');if(command.action!=='review')return;
 const author=experimentReviewAuthorSchema.parse(reviewer);
 const [original,reproduction,manifest]=await Promise.all([immutableExperiment(references.original,verificationMemo),immutableExperiment(references.reproduction,verificationMemo),immutableExperiment(references.manifest,verificationMemo)]);
 const strategy=references.strategy;requireBinding(strategy.record!==null,'Review source requires retained strategy bytes.');
 const source=boundedStrategyRecord(strategy.record).record;
 const projected=strategyPublicItemSchema.parse({...strategy,state:'VISIBLE',reason:null,moderation:[]});
 await verified(verificationMemo,'strategy:'+JSON.stringify({record:source,id:projected.id,digest:projected.digest}),async()=>{requireBinding(await strategyDigest(JSON.stringify(source))===projected.digest,'Review strategy digest must match its canonical bytes.');});
 const target=command.target;
 for(const [name,item] of Object.entries({original,reproduction,manifest,strategy:projected}))requireBinding(same(target[name as keyof typeof target],{id:item.id,digest:item.digest}),'Review targets must match exact retained references.');
 requireBinding(original.type==='OUTCOME'&&reproduction.type==='OUTCOME'&&manifest.type==='MANIFEST','Review references require two outcomes and one manifest.');
 requireBinding(original.record?.type==='OUTCOME'&&reproduction.record?.type==='OUTCOME'&&manifest.record?.type==='MANIFEST','Review reference types must match their retained records.');
 if(original.record?.type!=='OUTCOME'||reproduction.record?.type!=='OUTCOME'||manifest.record?.type!=='MANIFEST')return;
 const first=original.record,second=reproduction.record,parent=manifest.record;
 requireBinding(first.content.claim.type==='ORIGINAL'&&first.content.claim.relation===null,'A review target must be an original outcome.');
 requireBinding(first.version===parent.version&&second.version===parent.version,'Review method versions must match their manifest.');
 requireBinding(same(first.content.manifest,target.manifest)&&same(second.content.manifest,target.manifest)&&[original,reproduction,manifest].every(item=>same(item.strategy,target.strategy)),'Review outcomes require the same exact manifest and strategy.');
 requireBinding(same(parent.flags,experimentManifestFlags(parent.content.disclosures))&&same(first.flags,experimentOutcomeFlags(original.author,manifest.author,first.content.claim))&&same(second.flags,experimentOutcomeFlags(reproduction.author,manifest.author,second.content.claim)),'Review concern flags must retain their exact declarations.');
 requireBinding(second.content.claim.relation!==null&&second.content.claim.relation.id===original.id&&second.content.claim.relation.digest===original.digest,'The reproduction must reference the exact original outcome.');
 requireBinding(original.createdAt>=manifest.createdAt&&reproduction.createdAt>=original.createdAt&&manifest.createdAt>=projected.createdAt,'Review evidence clocks must retain source, manifest and outcome order.');
 const inputSource='kind'in parent.content.input?parent.content.input.config.strategy:parent.content.input.strategy;
 requireBinding(same(inputSource.record,source)&&inputSource.digest===projected.digest,'Review source bytes must match the retained manifest input.');
 for(const result of [first.content.result,second.content.result])if(result.kind==='ARTIFACT')await verified(verificationMemo,'artifact:'+JSON.stringify({artifact:result.artifact,input:parent.content.input}),()=>verifyExperimentArtifact(result.artifact,parent.content.input));
 if(at!==undefined){clock.parse(at);requireBinding([original.createdAt,reproduction.createdAt,manifest.createdAt,projected.createdAt].every(value=>value<=at),'Review time cannot precede its exact evidence.');}
 if(parent.version===2){requireBinding(command.decision==='HELD'&&command.evidence===null&&command.reasons.includes('UNSUPPORTED_METHOD'),'Continuous evidence requires an explicit unsupported-method hold.');return;}
 requireBinding(first.version===1&&second.version===1,'Batch evidence requires batch outcomes.');
 if(first.version!==1||second.version!==1)return;
 const results=[first.content.result,second.content.result];
 if(command.evidence){
  requireBinding(results.every(result=>result.kind==='ARTIFACT'),'Comparison reports require two retained artifacts.');
  if(first.content.result.kind!=='ARTIFACT'||second.content.result.kind!=='ARTIFACT')return;
  const a=first.content.result.artifact,b=second.content.result.artifact;
  requireBinding(same(a.input,b.input)&&a.digests.evaluator===b.digests.evaluator,'Both comparison reports require the exact same accepted input and method.');
  await Promise.all([verified(verificationMemo,'comparison:'+JSON.stringify({report:command.evidence.original,artifact:a}),()=>bindReport(command.evidence!.original,a)),verified(verificationMemo,'comparison:'+JSON.stringify({report:command.evidence.reproduction,artifact:b}),()=>bindReport(command.evidence!.reproduction,b))]);
  requireBinding(command.evidence.original.implementations.primary.sourceSha256===parent.content.evaluator.sourceDigest&&command.evidence.reproduction.implementations.primary.sourceSha256===parent.content.evaluator.sourceDigest,'Comparison implementation pins must match the retained manifest declaration.');
 }
 if(command.decision==='REPRODUCED'){
  requireBinding(second.content.claim.type==='REPRODUCTION'&&second.content.claim.relation?.type==='SUPPORTS','Positive review requires a supported reproduction lineage.');
  const sponsors=[original.author.sponsorId,reproduction.author.sponsorId,manifest.author.sponsorId,projected.author.sponsorId];
  requireBinding(sponsors.every(sponsor=>sponsor!==author.sponsorId)&&original.author.sponsorId!==reproduction.author.sponsorId,'Positive review requires separate reviewer and outcome sponsors.');
  requireBinding(!parent.flags.some(flag=>(experimentReviewBlockingFlags as readonly string[]).includes(flag)),'Selected, incomplete or leaked validation cannot receive a positive review.');
 }
}
export const validateExperimentReviewBinding=validateExperimentReviewBindings;
