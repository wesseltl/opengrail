import {z} from 'zod';
import {strategyAuthorSchema,strategyAuthorReferenceSchema,strategyAuthorReference,strategyDigest,strategyPublicHumanId,strategyPublicEventSchema,strategyPrivateReportSchema,strategyReportReceiptSchema,strategyMeSchema,type StrategyActor,type StrategyAuthor,type StrategyAuthorReference} from './strategy-model';
import {demoRequestSchema,demoArtifactSchema,demoEvaluatorVersion,demoEvaluatorMethod,boundedDemoRequest,verifyDemoArtifact,type DemoRequest} from './demo-model';
import {sessionEvidenceInputSchema,sessionEvidenceArtifactSchema,sessionEvidenceEvaluatorSchema,boundedSessionEvidenceInput,boundedSessionEvidenceArtifact,verifySessionEvidenceInput,verifySessionEvidenceArtifact,type SessionEvidenceInput,type SessionEvidenceEvaluator} from './session-evidence-model';
export {strategyAuthorReference as experimentAuthorReference,strategyDigest as experimentDigest,strategyPublicHumanId as experimentPublicHumanId};
export type ExperimentActor=StrategyActor;
export type ExperimentAuthor=StrategyAuthor;
export type ExperimentAuthorReference=StrategyAuthorReference;
export const experimentLimits={requestBytes:786432,maximumDepth:16,inputBytes:196608,manifestBytes:262144,artifactBytes:524288,outcomeBytes:589824,registerPerSponsorDay:5,manifestStored:250,outcomePerSponsorDay:10,outcomeStored:500,outcomesPerManifest:32,eventsPerRecord:16,reportsPerSponsorDay:10,reportsStored:500,page:20} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
export function experimentCredentialLike(value:string){for(let n=0;n<4;n++){if(/og_agent_/i.test(value))return true;try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}}return false;}
const text=(maximum:number,minimum=1)=>z.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>!experimentCredentialLike(value),'Agent credentials cannot be published.');
const strings=(maximum:number)=>z.array(text(maximum)).max(8);
const policy=z.literal('public-experiment-v1');
export const experimentReferenceSchema=z.object({id:uuid,digest:hash}).strict();
export const experimentEvaluatorSchema=z.object({version:z.literal(demoEvaluatorVersion),sourceVersion:text(80),sourceDigest:hash,methodDigest:hash}).strict();
export const experimentDisclosuresSchema=z.object({search:z.object({trialCount:z.number().int().min(1).max(100000),selection:z.enum(['FIRST_DECLARED','BEST_OBSERVED','OTHER']),logCompleteness:z.enum(['COMPLETE','PARTIAL','UNAVAILABLE']),log:text(4000,0)}).strict(),validation:z.object({trainEvaluationOverlap:z.enum(['NONE','PRESENT','UNKNOWN']),holdoutDeclared:z.boolean(),holdoutPriorAccess:z.enum(['UNSEEN','SEEN','UNKNOWN']),holdoutReuseCount:z.number().int().min(0).max(100000),note:text(1500,0)}).strict(),transformations:strings(500),seeds:z.array(z.number().int().min(0).max(4294967295)).max(8),conflicts:z.object({sharedDependencies:strings(200),other:text(1500,0)}).strict(),publication:z.object({dataRights:z.literal(true),publicData:z.literal(true),publicArtifact:z.literal(true)}).strict()}).strict().refine(value=>value.search.logCompleteness!=='COMPLETE'||value.search.log.length>0,'A declared complete log must include its contents.');
const manifestFields={name:text(120),input:demoRequestSchema,evaluator:experimentEvaluatorSchema,baseline:z.literal('COST_AWARE_LONG_SAME_ALLOCATION_V1'),disclosures:experimentDisclosuresSchema};
export const experimentRegisterSchema=z.object({action:z.literal('register'),requestId:uuid,id:uuid,...manifestFields,policyAccepted:policy}).strict();
export const experimentResultSchema=z.discriminatedUnion('kind',[z.object({kind:z.literal('ARTIFACT'),artifact:demoArtifactSchema}).strict(),z.object({kind:z.literal('INTERRUPTED'),reason:text(2000)}).strict(),z.object({kind:z.literal('ARTIFACT_UNAVAILABLE'),reason:text(2000)}).strict()]);
export const experimentClaimSchema=z.object({type:z.enum(['ORIGINAL','REPRODUCTION','CONFLICTING']),relation:z.object({type:z.enum(['SUPPORTS','CONFLICTS']),id:uuid,digest:hash}).strict().nullable(),sharedDependencies:strings(200),conflicts:text(1500,0)}).strict().refine(value=>value.type==='ORIGINAL'?value.relation===null:value.type==='REPRODUCTION'?value.relation?.type==='SUPPORTS':value.relation?.type==='CONFLICTS','Claims require an exact matching relation.');
const outcomeFields={name:text(120),manifest:experimentReferenceSchema,result:experimentResultSchema,claim:experimentClaimSchema};
export const experimentOutcomeSchema=z.object({action:z.literal('outcome'),requestId:uuid,id:uuid,...outcomeFields,policyAccepted:policy}).strict().refine(value=>value.id!==value.manifest.id&&value.id!==value.claim.relation?.id,'An outcome cannot reference itself.');
const continuousManifestFields={method:z.literal('CONTINUOUS_DEMO'),name:text(120),input:sessionEvidenceInputSchema,evaluator:sessionEvidenceEvaluatorSchema,disclosures:experimentDisclosuresSchema};
export const experimentContinuousRegisterSchema=z.object({action:z.literal('register'),requestId:uuid,id:uuid,...continuousManifestFields,policyAccepted:policy}).strict();
export const experimentContinuousResultSchema=z.discriminatedUnion('kind',[z.object({kind:z.literal('ARTIFACT'),artifact:sessionEvidenceArtifactSchema}).strict(),z.object({kind:z.literal('INTERRUPTED'),reason:text(2000)}).strict(),z.object({kind:z.literal('ARTIFACT_UNAVAILABLE'),reason:text(2000)}).strict()]);
const continuousOutcomeFields={method:z.literal('CONTINUOUS_DEMO'),name:text(120),manifest:experimentReferenceSchema,result:experimentContinuousResultSchema,claim:experimentClaimSchema};
export const experimentContinuousOutcomeSchema=z.object({action:z.literal('outcome'),requestId:uuid,id:uuid,...continuousOutcomeFields,policyAccepted:policy}).strict().refine(value=>value.id!==value.manifest.id&&value.id!==value.claim.relation?.id,'An outcome cannot reference itself.');
const common={requestId:uuid,id:uuid,digest:hash,policyAccepted:policy};
export const experimentWithdrawSchema=z.object({action:z.literal('withdraw'),...common,reason:z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE'])}).strict();
export const experimentReportSchema=z.object({action:z.literal('report'),...common,reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','OTHER']),details:text(1500)}).strict();
export const experimentModerateSchema=z.object({action:z.literal('moderate'),...common,state:z.enum(['VISIBLE','HIDDEN']),reason:z.enum(['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','POLICY','RESTORED'])}).strict().refine(value=>(value.state==='VISIBLE')===(value.reason==='RESTORED'),'Restoration requires RESTORED.');
export const experimentCommandSchema=z.union([experimentRegisterSchema,experimentOutcomeSchema,experimentWithdrawSchema,experimentReportSchema,experimentModerateSchema,experimentContinuousRegisterSchema,experimentContinuousOutcomeSchema]);
export type ExperimentCommand=z.infer<typeof experimentCommandSchema>;
export const experimentFlagSchema=z.enum(['SOURCE_EXECUTION_UNVERIFIED','TIMING_UNVERIFIED','MULTIPLE_TRIALS','POST_SELECTED','INCOMPLETE_SEARCH_LOG','TRAIN_EVAL_OVERLAP','OVERLAP_UNKNOWN','NO_HOLDOUT','HOLDOUT_SEEN','HOLDOUT_ACCESS_UNKNOWN','HOLDOUT_REUSED','SHARED_DEPENDENCIES','SAME_AUTHOR','SAME_SPONSOR']);
export type ExperimentFlag=z.infer<typeof experimentFlagSchema>;
const flags=z.array(experimentFlagSchema).max(14).refine(value=>new Set(value).size===value.length);
const base={version:z.literal(1),id:uuid,requestId:uuid,createdAt:clock,author:strategyAuthorSchema};
const suffix={flags,policyAccepted:policy,classification:z.literal('AUTHOR_REPORTED'),executionEnabled:z.literal(false)};
export const experimentManifestSchema=z.object({...base,type:z.literal('MANIFEST'),content:z.object(manifestFields).strict(),...suffix}).strict();
export const experimentOutcomeRecordSchema=z.object({...base,type:z.literal('OUTCOME'),content:z.object(outcomeFields).strict(),...suffix}).strict();
export const experimentContinuousManifestSchema=z.object({...base,version:z.literal(2),type:z.literal('MANIFEST'),content:z.object(continuousManifestFields).strict(),...suffix}).strict();
export const experimentContinuousOutcomeRecordSchema=z.object({...base,version:z.literal(2),type:z.literal('OUTCOME'),content:z.object(continuousOutcomeFields).strict(),...suffix}).strict();
export const experimentBatchRecordSchema=z.discriminatedUnion('type',[experimentManifestSchema,experimentOutcomeRecordSchema]);
export const experimentContinuousRecordSchema=z.discriminatedUnion('type',[experimentContinuousManifestSchema,experimentContinuousOutcomeRecordSchema]);
export const experimentRecordSchema=z.union([experimentBatchRecordSchema,experimentContinuousRecordSchema]);
export type ExperimentRecord=z.infer<typeof experimentRecordSchema>;
export type ExperimentManifest=z.infer<typeof experimentManifestSchema>;
export type ExperimentOutcomeRecord=z.infer<typeof experimentOutcomeRecordSchema>;
export type ExperimentContinuousManifest=z.infer<typeof experimentContinuousManifestSchema>;
export type ExperimentContinuousOutcomeRecord=z.infer<typeof experimentContinuousOutcomeRecordSchema>;
/** Frozen v1 batch callers must narrow before dereferencing dataset or invoking A/B. */
export function experimentIsBatchManifest(record:ExperimentRecord):record is ExperimentManifest{return record.version===1&&record.type==='MANIFEST';}
export function experimentIsContinuousManifest(record:ExperimentRecord):record is ExperimentContinuousManifest{return record.version===2&&record.type==='MANIFEST';}
export function experimentInputStrategy(input:DemoRequest|SessionEvidenceInput){return 'kind'in input?input.config.strategy:input.strategy;}
export const experimentPublicEventSchema=strategyPublicEventSchema;
export type ExperimentPublicEvent=z.infer<typeof experimentPublicEventSchema>;
const state=z.enum(['VISIBLE','HIDDEN','WITHDRAWN']);
const safeReason=z.enum(['AUTHOR_REQUEST','SPONSOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE','SPAM','ABUSE','MISLEADING','POLICY','RESTORED']);
const publicFields={id:uuid,digest:hash,type:z.enum(['MANIFEST','OUTCOME']),requestId:uuid,createdAt:clock,author:strategyAuthorReferenceSchema,strategy:experimentReferenceSchema,manifest:experimentReferenceSchema.nullable(),state,reason:safeReason.nullable(),suppression:z.enum(['SOURCE_UNAVAILABLE','PARENT_UNAVAILABLE']).nullable(),reporting:z.enum(['UNREPORTED','AUTHOR_REPORTED']),outcomeCount:z.number().int().min(0).max(experimentLimits.outcomesPerManifest)};
function outerValid(item:{type:string;manifest:unknown;state:string;suppression:unknown;reporting:string;outcomeCount:number}){return (item.type==='OUTCOME')===(item.manifest!==null)&&(!item.suppression||item.state!=='VISIBLE')&&(item.type==='MANIFEST'?item.reporting===(item.outcomeCount?'AUTHOR_REPORTED':'UNREPORTED'):item.reporting==='AUTHOR_REPORTED'&&item.outcomeCount===0);}
export const experimentPublicItemSchema=z.object({...publicFields,record:experimentRecordSchema.nullable(),moderation:z.array(experimentPublicEventSchema).max(experimentLimits.eventsPerRecord)}).strict().superRefine((item,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(!outerValid(item)||(item.state==='VISIBLE')!==(item.record!==null))bad('Experiment projection is inconsistent.');
 if(item.record&&(item.id!==item.record.id||item.type!==item.record.type||item.requestId!==item.record.requestId||item.createdAt!==item.record.createdAt||JSON.stringify(item.author)!==JSON.stringify(strategyAuthorReference(item.record.author))))bad('Experiment identity does not match its record.');
 let own='VISIBLE',reason:string|null=null,time=item.createdAt;
 for(let n=0;n<item.moderation.length;n++){const event=item.moderation[n];if(event.sequence!==n+1||own==='WITHDRAWN'||event.createdAt<time)bad('Experiment moderation is inconsistent.');own=event.state;reason=event.reason;time=event.createdAt;}
 if(reason!==item.reason||item.state!==(own==='WITHDRAWN'?'WITHDRAWN':own==='HIDDEN'||item.suppression?'HIDDEN':'VISIBLE'))bad('Experiment state does not match current suppression and events.');
});
export type ExperimentPublicItem=z.infer<typeof experimentPublicItemSchema>;
export const experimentSummarySchema=z.object({...publicFields,method:z.literal('CONTINUOUS_DEMO').optional(),name:text(120).nullable(),status:z.enum(['COMPLETED','NO_TRADES','HALTED','REJECTED','FAILED','INTERRUPTED','ARTIFACT_UNAVAILABLE','ACTIVE','PAUSED','STOPPING','STOPPED']).nullable(),flags}).strict().refine(value=>outerValid(value)&&(value.state==='VISIBLE'?value.name!==null:value.name===null&&value.status===null&&value.flags.length===0&&value.method===undefined)&&(value.type!=='MANIFEST'||value.status===null),'Summary content must follow current visibility.');
export type ExperimentSummary=z.infer<typeof experimentSummarySchema>;
export const experimentListSchema=z.object({version:z.literal(1),items:z.array(experimentSummarySchema).max(experimentLimits.page),nextCursor:uuid.nullable(),executionEnabled:z.literal(false)}).strict();
export const experimentOutcomesSchema=experimentListSchema;
export const experimentGetSchema=z.object({version:z.literal(1),item:experimentPublicItemSchema,executionEnabled:z.literal(false)}).strict();
export const experimentPrivateReportSchema=strategyPrivateReportSchema;
export const experimentReportReceiptSchema=strategyReportReceiptSchema;
export const experimentReportsSchema=z.object({version:z.literal(1),reports:z.array(experimentPrivateReportSchema).max(experimentLimits.page),nextCursor:hash.nullable(),executionEnabled:z.literal(false)}).strict();
export const experimentWriteSchema=z.object({version:z.literal(1),action:z.enum(['register','outcome','withdraw','report','moderate']),requestId:uuid,item:experimentPublicItemSchema.nullable(),report:experimentReportReceiptSchema.nullable(),executionEnabled:z.literal(false)}).strict().refine(value=>value.action==='report'?value.item===null&&value.report?.requestId===value.requestId:value.item!==null&&value.report===null,'Receipt must match its action.');
export const experimentMeSchema=strategyMeSchema;
export class ExperimentError extends Error{constructor(message:string,public status=409,public retryAfterSeconds?:number){super(message);}}
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;
/** Depth is bounded before schema processing. Server-derived author labels are not authored material. */
function depth(value:unknown,n=0){if(n>experimentLimits.maximumDepth)throw new ExperimentError('Experiment nesting is too deep.',400);if(value&&typeof value==='object'){const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null&&prototype!==Array.prototype)throw new ExperimentError('Experiment material must be plain data.',400);for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){if(!('value'in descriptor))throw new ExperimentError('Experiment material must be plain data.',400);depth(descriptor.value,n+1);}}}
function secrets(value:unknown){if(typeof value==='string'&&experimentCredentialLike(value))throw new ExperimentError('Agent credentials cannot be published.',400);if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){if(key==='author')continue;secrets(item);}}
function continuousSecrets(value:unknown){if(typeof value==='string'){let string=value;for(let n=0;n<4;n++){if(/og_(?:agent|local_owner|local_producer)_/i.test(string))throw new ExperimentError('Credentials cannot be published.',400);try{const decoded=decodeURIComponent(string);if(decoded===string)break;string=decoded;}catch{break;}}}else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(key==='author')continue;continuousSecrets(item);}}
function evidenceError(error:unknown):never{throw new ExperimentError('Continuous evidence is invalid or exceeds its registry allowance.',error&&typeof error==='object'&&'status'in error&&error.status===413?413:400);}
function continuousInput(raw:unknown){try{return boundedSessionEvidenceInput(raw);}catch(error){return evidenceError(error);}}
function continuousArtifact(raw:unknown){try{return boundedSessionEvidenceArtifact(raw);}catch(error){return evidenceError(error);}}
export function boundedExperimentCommand(raw:unknown){depth(raw);const command=experimentCommandSchema.parse(raw),payload=JSON.stringify(command);if(bytes(payload)>experimentLimits.requestBytes)throw new ExperimentError('Experiment command is too large.',413);if(command.action==='register'){const input='method'in command?continuousInput(command.input):boundedDemoRequest(command.input);if(bytes(input.payload)>experimentLimits.inputBytes)throw new ExperimentError('Registry input is too large.',413);secrets(command.input);}if(command.action==='outcome'&&command.result.kind==='ARTIFACT'){if('method'in command)continuousArtifact(command.result.artifact);if(bytes(JSON.stringify(command.result.artifact))>experimentLimits.artifactBytes)throw new ExperimentError('Registry artifact is too large.',413);secrets(command.result.artifact);}if('method'in command)continuousSecrets(command);return {command,payload};}
export function boundedExperimentRecord(raw:unknown){depth(raw);const record=experimentRecordSchema.parse(raw),payload=JSON.stringify(record);if(bytes(payload)>(record.type==='MANIFEST'?experimentLimits.manifestBytes:experimentLimits.outcomeBytes))throw new ExperimentError('Experiment record is too large.',413);boundedExperimentCommand({action:record.type==='MANIFEST'?'register':'outcome',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});return {record,payload};}
export function experimentManifestFlags(disclosures:z.infer<typeof experimentDisclosuresSchema>):ExperimentFlag[]{const result:ExperimentFlag[]=['SOURCE_EXECUTION_UNVERIFIED','TIMING_UNVERIFIED'];const s=disclosures.search,v=disclosures.validation;if(s.trialCount>1)result.push('MULTIPLE_TRIALS');if(s.selection!=='FIRST_DECLARED')result.push('POST_SELECTED');if(s.logCompleteness!=='COMPLETE')result.push('INCOMPLETE_SEARCH_LOG');if(v.trainEvaluationOverlap==='PRESENT')result.push('TRAIN_EVAL_OVERLAP');if(v.trainEvaluationOverlap==='UNKNOWN')result.push('OVERLAP_UNKNOWN');if(!v.holdoutDeclared)result.push('NO_HOLDOUT');if(v.holdoutPriorAccess==='SEEN')result.push('HOLDOUT_SEEN');if(v.holdoutPriorAccess==='UNKNOWN')result.push('HOLDOUT_ACCESS_UNKNOWN');if(v.holdoutReuseCount>0)result.push('HOLDOUT_REUSED');if(disclosures.conflicts.sharedDependencies.length)result.push('SHARED_DEPENDENCIES');return result;}
export function experimentOutcomeFlags(author:ExperimentAuthorReference,parent:ExperimentAuthorReference,claim:z.infer<typeof experimentClaimSchema>):ExperimentFlag[]{const result:ExperimentFlag[]=['SOURCE_EXECUTION_UNVERIFIED','TIMING_UNVERIFIED'];if(author.kind===parent.kind&&author.id===parent.id)result.push('SAME_AUTHOR');if(author.sponsorId===parent.sponsorId)result.push('SAME_SPONSOR');if(claim.sharedDependencies.length)result.push('SHARED_DEPENDENCIES');return result;}
/** Public server identity checks only: no Session or Demo evaluator is executed. */
export async function verifyExperimentManifestInput(input:DemoRequest|SessionEvidenceInput,evaluator:z.infer<typeof experimentEvaluatorSchema>|SessionEvidenceEvaluator){
 if('kind'in input){
  try{await verifySessionEvidenceInput(input);}catch(error){evidenceError(error);}
  if(input.config.origin!=='PUBLIC_STRATEGY')throw new ExperimentError('Continuous public evidence requires an exact published Strategy Hub source.',400);
  if(evaluator.version!==input.implementation.version||evaluator.methodDigest!==input.methodDigest||!('sourceDigests'in evaluator)||JSON.stringify(evaluator.sourceDigests)!==JSON.stringify({engine:input.implementation.engine,model:input.implementation.model,journal:input.implementation.journal}))throw new ExperimentError('The declared Session evaluator does not match the exact snapshot.',400);
 }else if(evaluator.version!==demoEvaluatorVersion||evaluator.methodDigest!==await strategyDigest(JSON.stringify(demoEvaluatorMethod)))throw new ExperimentError('The declared method digest does not match the trusted Demo method.',400);
 return input;
}
export async function verifyExperimentArtifact(artifact:z.infer<typeof demoArtifactSchema>|z.infer<typeof sessionEvidenceArtifactSchema>,input:DemoRequest|SessionEvidenceInput){
 let checked;try{checked='kind'in input?await verifySessionEvidenceArtifact(artifact):await verifyDemoArtifact(artifact);}catch(error){if('kind'in input)evidenceError(error);throw new ExperimentError('The Demo artifact identity is invalid.',400);}
 if(!checked.input||JSON.stringify(checked.input)!==JSON.stringify(input))throw new ExperimentError('Artifact input must exactly match the registered manifest.',400);
 return checked;
}
export async function validateExperimentItem(raw:unknown){
 const item=experimentPublicItemSchema.parse(raw);if(!item.record)return item;
 const {record,payload}=boundedExperimentRecord(item.record);if(await strategyDigest(payload)!==item.digest)throw new ExperimentError('Experiment digest does not match.',400);
 if(record.type==='MANIFEST'){
  const source=experimentInputStrategy(record.content.input);await verifyExperimentManifestInput(record.content.input,record.content.evaluator);
  if(item.strategy.id!==source.record.id||item.strategy.digest!==source.digest||await strategyDigest(JSON.stringify(source.record))!==item.strategy.digest||JSON.stringify(record.flags)!==JSON.stringify(experimentManifestFlags(record.content.disclosures)))throw new ExperimentError('Manifest bindings do not match.',400);
 }else{
  if(JSON.stringify(item.manifest)!==JSON.stringify(record.content.manifest))throw new ExperimentError('Outcome parent does not match.',400);
  if(record.content.result.kind==='ARTIFACT'){
   const artifact=record.version===2?await verifySessionEvidenceArtifact(record.content.result.artifact):await verifyDemoArtifact(record.content.result.artifact);
   if(!artifact.input)throw new ExperimentError('Outcome artifact has no retained input.',400);const source=experimentInputStrategy(artifact.input);
   if(source.record.id!==item.strategy.id||source.digest!==item.strategy.digest)throw new ExperimentError('Outcome artifact has no matching retained input.',400);
  }
 }
 return item;
}
/** Convenience source declaration, never proof that this code executed. Caller must replace disclosures truthfully. */
export function experimentRegisterDefaults(input:DemoRequest){return {name:'Declared Demo experiment',input,evaluator:{version:demoEvaluatorVersion,sourceVersion:'84a1a668ef160bc3c9c4e0596a514b5d15e6dd49',sourceDigest:'cbc31d441c12a8c3652ddbb1873e9160b574316968889805cdc57aed04597e51',methodDigest:'a3e031a6d223ffd7d73095f7ea48827d4386e886813dd9d4a9e0e625acd15572'},baseline:'COST_AWARE_LONG_SAME_ALLOCATION_V1' as const,disclosures:{search:{trialCount:1,selection:'FIRST_DECLARED' as const,logCompleteness:'UNAVAILABLE' as const,log:''},validation:{trainEvaluationOverlap:'UNKNOWN' as const,holdoutDeclared:false,holdoutPriorAccess:'UNKNOWN' as const,holdoutReuseCount:0,note:''},transformations:[] as string[],seeds:[] as number[],conflicts:{sharedDependencies:[] as string[],other:''},publication:{dataRights:true as const,publicData:true as const,publicArtifact:true as const}}};}
/** Retrospective defaults are author declarations; publication still needs explicit new consent. */
export function experimentContinuousRegisterDefaults(input:SessionEvidenceInput,sourceVersion:string){return {method:'CONTINUOUS_DEMO' as const,name:'Retrospective continuous Demo snapshot',input,evaluator:{version:input.implementation.version,sourceVersion,sourceDigests:{engine:input.implementation.engine,model:input.implementation.model,journal:input.implementation.journal},methodDigest:input.methodDigest},disclosures:{search:{trialCount:1,selection:'FIRST_DECLARED' as const,logCompleteness:'UNAVAILABLE' as const,log:''},validation:{trainEvaluationOverlap:'UNKNOWN' as const,holdoutDeclared:false,holdoutPriorAccess:'UNKNOWN' as const,holdoutReuseCount:0,note:'Retrospective supplied snapshot; receipt clocks and source history are unverified.'},transformations:[] as string[],seeds:[] as number[],conflicts:{sharedDependencies:['Same first-party Session method and pinned implementation'],other:''},publication:{dataRights:true as const,publicData:true as const,publicArtifact:true as const}}};}
