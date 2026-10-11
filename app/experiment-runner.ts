import {z} from 'zod';
import {experimentPublicItemSchema,validateExperimentItem,boundedExperimentRecord,boundedExperimentCommand,experimentLimits,experimentOutcomeSchema,experimentDigest,type ExperimentPublicItem} from './experiment-model';
import {strategyPublicItemSchema,boundedStrategyRecord,type StrategyPublicItem} from './strategy-model';
import {demoArtifactSchema,boundedDemoRequest,verifyDemoArtifact,demoEvaluatorVersion,demoEvaluatorMethod,demoLimits} from './demo-model';
import {comparisonReportSchema,verifyComparisonReport,compareDemoArtifact,comparisonLimits} from './evaluator-comparison';
import {replayDemo} from './demo-engine';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';
import {boundedSessionValue,SessionError} from './session-model';

export const experimentRunLimits={attempts:16,admissionBytes:524288,attemptBytes:10485760,historyBytes:33554432,reservedAttemptBytes:10485760} as const;
const uuid=z.string().uuid().refine(v=>v===v.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/),clock=z.string().datetime().refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);
const implementationsSchema=z.object({primary:z.object({version:z.literal('opengrail-demo-v1'),sourceSha256:hash}).strict(),reference:z.object({version:z.literal('opengrail-reference-v1'),sourceSha256:hash}).strict()}).strict();
export const experimentRunAdmissionSchema=z.object({attemptId:uuid,startedAt:clock,outcomeRequestId:uuid,outcomeId:uuid,manifest:experimentPublicItemSchema,source:strategyPublicItemSchema}).strict();
export type ExperimentRunAdmission=z.infer<typeof experimentRunAdmissionSchema>;
const runBodySchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_EXPERIMENT_ATTEMPT'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false),attemptId:uuid,startedAt:clock,finishedAt:clock.nullable(),outcomeRequestId:uuid,outcomeId:uuid,captured:z.object({manifest:experimentPublicItemSchema,source:strategyPublicItemSchema}).strict(),inputDigest:hash,implementations:implementationsSchema,status:z.enum(['RUNNING','EVALUATED','INTERRUPTED','UNAVAILABLE']),reason:z.enum(['USER_CANCELLED','RECOVERY_INTERRUPTED','EVALUATOR_FAILURE','RESULT_LIMIT']).nullable(),artifact:demoArtifactSchema.nullable(),comparison:comparisonReportSchema.nullable()}).strict();
export const experimentRunSchema=runBodySchema.extend({runDigest:hash}).superRefine((r,c)=>{
 if(r.status==='RUNNING'&&(r.finishedAt!==null||r.reason!==null||r.artifact!==null||r.comparison!==null)||r.status!=='RUNNING'&&(r.finishedAt===null||r.finishedAt<r.startedAt)||r.status==='EVALUATED'&&(r.reason!==null||!r.artifact||!r.comparison)||r.status==='INTERRUPTED'&&!['USER_CANCELLED','RECOVERY_INTERRUPTED'].includes(r.reason??'')||r.status==='UNAVAILABLE'&&!['EVALUATOR_FAILURE','RESULT_LIMIT'].includes(r.reason??'')||r.comparison!==null&&r.artifact===null)c.addIssue({code:z.ZodIssueCode.custom,message:'Attempt disposition and retained results disagree.'});
});
export type ExperimentRun=z.infer<typeof experimentRunSchema>;
export class ExperimentRunError extends Error{constructor(message:string,public status=400){super(message);}}
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const implementation=()=>({primary:{version:demoEvaluatorVersion,sourceSha256:evaluatorSourceFingerprints.primary},reference:{version:'opengrail-reference-v1' as const,sourceSha256:evaluatorSourceFingerprints.reference}});
function plain(raw:unknown,bound:number){try{boundedSessionValue(raw,bound);}catch(error){throw new ExperimentRunError('Only bounded plain finite JSON data is accepted.',error instanceof SessionError?error.status:400);}}
function credentials(raw:unknown){if(typeof raw==='string'){let text=raw;for(let n=0;n<4;n++){if(/og_agent_/i.test(text))throw new ExperimentRunError('Credentials cannot be retained in local results.');try{const next=decodeURIComponent(text);if(next===text)break;text=next;}catch{break;}}}else if(raw&&typeof raw==='object')for(const [key,value]of Object.entries(raw)){if(key!=='author')credentials(value);}}
async function sources(rawManifest:unknown,rawSource:unknown){
 plain({manifest:rawManifest,source:rawSource},experimentRunLimits.admissionBytes);
 let manifest:ExperimentPublicItem,source:StrategyPublicItem;
 try{manifest=await validateExperimentItem(rawManifest);source=strategyPublicItemSchema.parse(rawSource);}catch{throw new ExperimentRunError('The captured public records are invalid.');}
 if(manifest.type!=='MANIFEST'||manifest.state!=='VISIBLE'||manifest.record?.type!=='MANIFEST'||source.state!=='VISIBLE'||!source.record)throw new ExperimentRunError('A visible exact manifest and source are required.',409);
 const mr=boundedExperimentRecord(manifest.record).record;if(mr.type!=='MANIFEST')throw new ExperimentRunError('A manifest is required.');
 const sr=boundedStrategyRecord(source.record),input=boundedDemoRequest(mr.content.input);
 if(await experimentDigest(sr.payload)!==source.digest||manifest.strategy.id!==source.id||manifest.strategy.digest!==source.digest||!same(input.input.strategy.record,sr.record)||input.input.strategy.digest!==source.digest)throw new ExperimentRunError('The manifest input must match the exact source record.');
 if(mr.content.evaluator.version!==demoEvaluatorVersion||mr.content.evaluator.methodDigest!==await experimentDigest(JSON.stringify(demoEvaluatorMethod))||mr.content.evaluator.sourceDigest!==evaluatorSourceFingerprints.primary)throw new ExperimentRunError('This manifest declares a different evaluator source or method.',409);
 if(Object.values(evaluatorSourceFingerprints).some(v=>/^0+$/.test(v)))throw new ExperimentRunError('Trusted evaluator identities are not prepared.',503);
 return {manifest,source,inputDigest:await experimentDigest(input.payload)};
}
function lifecycle(a:{attemptId:string;outcomeRequestId:string;outcomeId:string},manifest:ExperimentPublicItem){if(new Set([a.attemptId,a.outcomeRequestId,a.outcomeId]).size!==3||a.outcomeId===manifest.id||a.outcomeRequestId===manifest.requestId)throw new ExperimentRunError('Attempt and publication identities must be distinct and fresh.');}
async function boundArtifact(raw:unknown,run:ExperimentRun){
 credentials(raw);const artifact=await verifyDemoArtifact(raw),manifest=run.captured.manifest.record;
 if(!manifest||manifest.type!=='MANIFEST'||!artifact.input||artifact.digests.request!==run.inputDigest||!same(artifact.input,manifest.content.input)||artifact.digests.strategy!==run.captured.source.digest)throw new ExperimentRunError('Result is not bound to the captured manifest input.');return artifact;
}
async function boundComparison(raw:unknown,run:ExperimentRun,artifact:NonNullable<ExperimentRun['artifact']>){
 const report=await verifyComparisonReport(raw);
 if(report.identity.claimedArtifact!==artifact.resultDigest||report.identity.requestId!==artifact.requestId||report.identity.request!==artifact.digests.request||report.identity.strategy!==artifact.digests.strategy||report.identity.dataset!==artifact.digests.dataset||report.identity.signals!==artifact.digests.signals||report.identity.declaredMethod!==artifact.digests.evaluator||!same(report.implementations,run.implementations)||!same(report.summaries.claimed,{status:artifact.status,reason:artifact.reason,metrics:artifact.metrics,benchmark:artifact.benchmark}))throw new ExperimentRunError('Comparison is not bound to the actual retained result.');return report;
}
async function seal(raw:z.infer<typeof runBodySchema>):Promise<ExperimentRun>{
 const body=runBodySchema.parse(raw),run=experimentRunSchema.parse({...body,runDigest:await experimentDigest(JSON.stringify(body))});
 if(bytes(run)>experimentRunLimits.attemptBytes)throw new ExperimentRunError('Attempt exceeds its retained byte reservation.',413);return run;
}
/** Capture supplied visible snapshots. HTTP callers must recheck actual source visibility. */
export async function createExperimentRun(raw:unknown):Promise<ExperimentRun>{
 plain(raw,experimentRunLimits.admissionBytes);let a:ExperimentRunAdmission;try{a=experimentRunAdmissionSchema.parse(raw);}catch{throw new ExperimentRunError('Invalid attempt admission.');}
 const captured=await sources(a.manifest,a.source);
 lifecycle(a,captured.manifest);
 return seal({version:1,kind:'LOCAL_EXPERIMENT_ATTEMPT',classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false,attemptId:a.attemptId,startedAt:a.startedAt,finishedAt:null,outcomeRequestId:a.outcomeRequestId,outcomeId:a.outcomeId,captured:{manifest:captured.manifest,source:captured.source},inputDigest:captured.inputDigest,implementations:implementation(),status:'RUNNING',reason:null,artifact:null,comparison:null});
}
/** Content/source identity and correlation only; this does not attest actual execution. */
export async function verifyExperimentRun(raw:unknown):Promise<ExperimentRun>{
 plain(raw,experimentRunLimits.attemptBytes);let run:ExperimentRun;try{run=experimentRunSchema.parse(raw);}catch{throw new ExperimentRunError('Invalid local attempt.');}
 const {runDigest,...body}=run;if(await experimentDigest(JSON.stringify(body))!==runDigest||!same(run.implementations,implementation()))throw new ExperimentRunError('Attempt or implementation identity is inconsistent.');
 const captured=await sources(run.captured.manifest,run.captured.source);
 lifecycle(run,captured.manifest);if(captured.inputDigest!==run.inputDigest)throw new ExperimentRunError('Captured input identity is inconsistent.');
 if(run.artifact)await boundArtifact(run.artifact,run);
 if(run.comparison)await boundComparison(run.comparison,run,run.artifact!);
 return run;
}
export async function assertExperimentRunSources(raw:unknown,manifest:unknown,source:unknown){const run=await verifyExperimentRun(raw),current=await sources(manifest,source);if(current.manifest.id!==run.captured.manifest.id||current.manifest.digest!==run.captured.manifest.digest||current.source.id!==run.captured.source.id||current.source.digest!==run.captured.source.digest||current.inputDigest!==run.inputDigest)throw new ExperimentRunError('The captured source or parent changed.',409);return run;}
function finishTime(run:ExperimentRun,raw?:string){const value=raw??new Date().toISOString();try{clock.parse(value);}catch{throw new ExperimentRunError('A canonical completion timestamp is required.');}if(value<run.startedAt)throw new ExperimentRunError('Completion cannot precede admission.');return value;}
export async function interruptExperimentRun(raw:unknown,finishedAt:string,reason:'USER_CANCELLED'|'RECOVERY_INTERRUPTED'='RECOVERY_INTERRUPTED'){
 const run=await verifyExperimentRun(raw);if(run.status!=='RUNNING')throw new ExperimentRunError('A completed attempt cannot be overwritten.',409);if(!['USER_CANCELLED','RECOVERY_INTERRUPTED'].includes(reason))throw new ExperimentRunError('Invalid interruption disposition.');const {runDigest:_,...body}=run;void _;return seal({...body,finishedAt:finishTime(run,finishedAt),status:'INTERRUPTED',reason});
}
/** Trusted local A evaluation, then fresh A/B comparison. No network, publication or Session conversion. */
export async function evaluateExperimentRun(raw:unknown,options:{signal?:AbortSignal;finishedAt?:string}={}):Promise<ExperimentRun>{
 const run=await verifyExperimentRun(raw);if(run.status!=='RUNNING')throw new ExperimentRunError('A completed attempt cannot be overwritten.',409);
 if(options.finishedAt!==undefined)finishTime(run,options.finishedAt);const {runDigest:_,...body}=run;void _;let artifact:ExperimentRun['artifact']=null,comparison:ExperimentRun['comparison']=null;
 const stop=()=>options.signal?.aborted===true;
 const terminal=(status:ExperimentRun['status'],reason:ExperimentRun['reason'])=>seal({...body,finishedAt:finishTime(run,options.finishedAt),status,reason,artifact,comparison});
 try{
  await new Promise<void>(resolve=>setTimeout(resolve,0));if(stop())return terminal('INTERRUPTED','USER_CANCELLED');
  const manifest=run.captured.manifest.record!;if(manifest.type!=='MANIFEST')throw new ExperimentRunError('Manifest is unavailable.');
  artifact=await boundArtifact(await replayDemo(structuredClone(manifest.content.input)),run);
  if(bytes(artifact)>demoLimits.artifactBytes){artifact=null;return terminal('UNAVAILABLE','RESULT_LIMIT');}
  await new Promise<void>(resolve=>setTimeout(resolve,0));if(stop())return terminal('INTERRUPTED','USER_CANCELLED');
  comparison=await boundComparison(await compareDemoArtifact(artifact),run,artifact);
  if(bytes(comparison)>comparisonLimits.reportBytes){comparison=null;return terminal('UNAVAILABLE','RESULT_LIMIT');}
  await new Promise<void>(resolve=>setTimeout(resolve,0));if(stop())return terminal('INTERRUPTED','USER_CANCELLED');
  const result=await terminal('EVALUATED',null);return verifyExperimentRun(result);
 }catch{if(stop())return terminal('INTERRUPTED','USER_CANCELLED');try{return await terminal('UNAVAILABLE','EVALUATOR_FAILURE');}catch{artifact=null;comparison=null;return terminal('UNAVAILABLE','RESULT_LIMIT');}}
}
/** Safe declared sidecar disposition; no execution attestation or publication consent. */
export function experimentRunDisclosure(raw:ExperimentRun){
 const run=experimentRunSchema.parse(raw),comparison=run.comparison;
 const disclosure=comparison?' Comparison disposition '+comparison.status+'; report SHA256 '+comparison.reportDigest+'; pair difference counts '+comparison.pairs.map(pair=>pair.pair+':'+pair.differenceCount).join(', ')+'. The sidecar is exported separately and is not attached to this public artifact.':'';
 return {sharedDependencies:['Fixed method specification','JavaScript runtime and shared input schemas','Same supplied data and local operator','Reference source reviewed against primary implementation'],conflicts:'Local fixed evaluators share method, runtime, schemas and supplied data. This AUTHOR_REPORTED attempt has qualification NONE and independence NOT_ESTABLISHED; it does not establish independent research, untouched holdouts or complete external search history.'+disclosure};
}
/** Explicit consent prepares an existing research command; caller reviews/posts and rechecks visibility. */
export async function prepareExperimentRunOutcome(raw:unknown,options:{confirmPublicSharing:true}){
 if(options?.confirmPublicSharing!==true)throw new ExperimentRunError('Explicit public-sharing confirmation is required.',403);
 const run=await verifyExperimentRun(raw);if(run.status==='RUNNING')throw new ExperimentRunError('Wait for a retained terminal attempt.',409);
 const manifest=run.captured.manifest.record!;if(manifest.type!=='MANIFEST')throw new ExperimentRunError('A manifest is required.');
 const result=run.status==='INTERRUPTED'?{kind:'INTERRUPTED' as const,reason:run.reason==='RECOVERY_INTERRUPTED'?'The admitted local attempt was interrupted by recovery; no completed evaluation is claimed.':'The admitted local attempt was cancelled; any partial local evidence remains retained.'}:run.artifact&&bytes(run.artifact)<=experimentLimits.artifactBytes?{kind:'ARTIFACT' as const,artifact:run.artifact}:{kind:'ARTIFACT_UNAVAILABLE' as const,reason:run.artifact?'The complete local artifact exceeds the public registry byte allowance. It remains retained locally without truncation.':'The admitted local attempt produced no available complete artifact; its unavailable disposition remains retained locally.'};
 const command=experimentOutcomeSchema.parse({action:'outcome',requestId:run.outcomeRequestId,id:run.outcomeId,name:(manifest.content.name+' · local run').slice(0,120),manifest:{id:run.captured.manifest.id,digest:run.captured.manifest.digest},result,claim:{type:'ORIGINAL',relation:null,...experimentRunDisclosure(run)},policyAccepted:'public-experiment-v1'});
 return experimentOutcomeSchema.parse(boundedExperimentCommand(command).command);
}
