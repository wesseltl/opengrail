import {experimentGetSchema,experimentListSchema,experimentMeSchema,experimentWriteSchema,boundedExperimentRecord,experimentDigest,experimentManifestFlags,experimentOutcomeFlags,validateExperimentItem,type ExperimentPublicItem,type ExperimentCommitmentManifest,type ExperimentCommitmentOutcomeRecord,type ExperimentCommand} from './experiment-model';
import {programCommitmentDependencies,verifyProgramCommitmentPlan,ProgramCommitmentVerificationScope,checkedProgramCommitmentVerificationScope,verifyProgramCommitmentEvidenceInput,verifyProgramCommitmentEvidenceArtifact,verifyProgramCommitmentEvidenceLink} from './program-commitment-model';
import {readCurrentProgramDirectionCohortSources,ProgramDirectionCohortSourceUnavailable} from './program-direction-cohort-browser';
import {readProgramForwardPublicJson,readPublicProgramForwardContext,assertForwardPublicMemberContinuation,assertPublicProgramForwardContinuation,PublicProgramForwardUnavailable,type PublicProgramForwardContext} from './program-forward-public';
import type {SharedProgramForwardPlan} from './program-forward-plan-dispatch-model';
import type {StrategyPublicItem} from './strategy-model';
import {programCommitmentHref,type ProgramCommitmentReference} from './program-commitment-link';
export {programCommitmentHref,programCommitmentSelectionFromQuery,type ProgramCommitmentReference} from './program-commitment-link';

/** Client bounds are declared independently of unchanged public registry limits. */
export const programCommitmentBrowserLimits=Object.freeze({referenceBytes:512,responseBytes:1048576,identityBytes:4096,metadataPage:20,metadataPages:16,retainedFullReports:1,sourceDependencies:4,retainedCommands:1,pendingStoreBytes:1589248,exportBytes:2097152,minimumLeadMs:60000,maximumRequestsPerChain:96,maximumRequestsPerOperation:195});
export type ProgramCommitmentManifestItem=ExperimentPublicItem&{record:ExperimentCommitmentManifest};
export type ProgramCommitmentReportItem=ExperimentPublicItem&{record:ExperimentCommitmentOutcomeRecord};
export type ProgramCommitmentContext={manifest:ExperimentPublicItem;sources:StrategyPublicItem[];report:ExperimentPublicItem|null;forward:PublicProgramForwardContext|null;relation:{report:ExperimentPublicItem;outcome:ExperimentPublicItem}|null;unsupportedChain:string|null};
export type ProgramCommitmentMe=ReturnType<typeof experimentMeSchema.parse>;
export type ProgramCommitmentCommand=Extract<ExperimentCommand,{method:'PROGRAM_FORWARD_COMMITMENT'}>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const programCommitmentSame=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
export class ProgramCommitmentOwnerChanged extends Error{}
export class ProgramCommitmentUnavailable extends Error{constructor(readonly id:string){super('Current complete declaration or dependency unavailable.');}}
function continuation(before:ExperimentPublicItem|StrategyPublicItem,after:ExperimentPublicItem|StrategyPublicItem){try{return assertForwardPublicMemberContinuation(before,after);}catch{throw new ProgramCommitmentUnavailable(after.id);}}
const options=(signal:AbortSignal)=>({cache:'no-store' as const,credentials:'same-origin' as const,redirect:'error' as const,signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
export async function readProgramCommitmentIdentity(signal:AbortSignal,previous?:ProgramCommitmentMe|null){
 const response=await fetch('/api/experiments/me',options(signal));if(response.status===401||response.status===403)throw new ProgramCommitmentOwnerChanged();if(!response.ok)throw Error('Owner confirmation unavailable.');
 const me=experimentMeSchema.parse(await readProgramForwardPublicJson(response,signal,programCommitmentBrowserLimits.identityBytes));signal.throwIfAborted();if(previous&&!programCommitmentSame(me,previous))throw new ProgramCommitmentOwnerChanged();return me;
}
export async function readProgramCommitmentSources(plan:SharedProgramForwardPlan,signal:AbortSignal,previous:StrategyPublicItem[]=[],verificationScope?:ProgramCommitmentVerificationScope){
 const scope=checkedProgramCommitmentVerificationScope(verificationScope);plan=await(scope?scope.verifyPlan(plan):verifyProgramCommitmentPlan(plan));signal.throwIfAborted();const dependencies=programCommitmentDependencies(plan),historical=plan.handoff.ledger.plan.admission.candidates.map(candidate=>candidate.source);
 if(historical.length!==dependencies.length)throw Error('Complete retained candidate closure required.');
 return readProgramCommitmentCandidateSources(historical,signal,previous);
}
/** Local planners retain their existing whole-plan bounds; only source reads use these small caps. */
export async function readProgramCommitmentCandidateSources(historical:StrategyPublicItem[],signal:AbortSignal,previous:StrategyPublicItem[]=[]){
 try{const first=await readCurrentProgramDirectionCohortSources(historical,signal),last=await readCurrentProgramDirectionCohortSources(first,signal);for(const source of last)for(const before of previous.filter(item=>item.id===source.id))continuation(before,source);signal.throwIfAborted();return last;}catch(error){if(error instanceof ProgramDirectionCohortSourceUnavailable)throw new ProgramCommitmentUnavailable(historical[0]?.id??'UNKNOWN');throw error;}
}
export async function readProgramCommitmentItem(reference:ProgramCommitmentReference,signal:AbortSignal,verificationScope?:ProgramCommitmentVerificationScope){
 const scope=checkedProgramCommitmentVerificationScope(verificationScope);programCommitmentHref(reference);const response=await fetch('/api/experiments?id='+reference.id,options(signal));if(response.status===404)throw new ProgramCommitmentUnavailable(reference.id);if(!response.ok)throw Error('Declaration read unconfirmed.');
 const item=await validateExperimentItem(experimentGetSchema.parse(await readProgramForwardPublicJson(response,signal)).item,scope);signal.throwIfAborted();if(item.id!==reference.id||item.digest!==reference.digest)throw new ProgramCommitmentUnavailable(reference.id);return item;
}
/** A whole exact plan and, optionally, one selected linked V4 context. No program executes. */
export async function readProgramCommitmentContext(reference:ProgramCommitmentReference,signal:AbortSignal,reportReference:ProgramCommitmentReference|null=null,previous?:ProgramCommitmentContext,verificationScope=new ProgramCommitmentVerificationScope()):Promise<ProgramCommitmentContext>{
 const scope=checkedProgramCommitmentVerificationScope(verificationScope)!;const manifest=await readProgramCommitmentItem(reference,signal,scope);if(manifest.type!=='MANIFEST')throw Error('A declaration manifest is required.');
 if(!manifest.record||manifest.state!=='VISIBLE'||manifest.suppression)return{manifest,sources:[],report:null,forward:null,relation:null,unsupportedChain:null};
 if(manifest.record.version!==5||manifest.record.type!=='MANIFEST')throw Error('Prospective program declaration required.');
 const plan=await scope.verifyPlan(manifest.record.content.input),sources=await readProgramCommitmentSources(plan,signal,previous?.sources,scope),report=reportReference?await readProgramCommitmentItem(reportReference,signal,scope):null;
 let forward:PublicProgramForwardContext|null=null,relation:ProgramCommitmentContext['relation']=null,unsupportedChain:string|null=null;
 if(report){if(!programCommitmentSame(report.manifest,reference)||!programCommitmentSame(report.strategy,manifest.strategy)||report.type!=='OUTCOME')throw Error('Exact attributable declaration report required.');if(!report.record||report.state!=='VISIBLE'||report.suppression)throw new ProgramCommitmentUnavailable(report.id);
  if(report.record.version!==5||report.record.type!=='OUTCOME'||!programCommitmentSame(report.record.flags,experimentOutcomeFlags(report.author,manifest.author,report.record.content.claim)))throw Error('Wrong declaration report method or attribution.');
  const link=report.record.content.result;try{forward=await readPublicProgramForwardContext({kind:'OUTCOME',...link.outcome},signal,scope);}catch(error){if(error instanceof PublicProgramForwardUnavailable)throw new ProgramCommitmentUnavailable(error.sourceId);throw error;}
  verifyProgramCommitmentEvidenceLink(link,{id:forward.manifest.id,digest:forward.manifest.digest},forward.outcome?{id:forward.outcome.id,digest:forward.outcome.digest}:null,forward.outcome?.manifest);
  await verifyProgramCommitmentEvidenceInput(plan,forward.manifest.record.content.input,manifest.createdAt,scope);
  const outcome=forward.outcome;if(outcome?.record?.version!==4||outcome.record.type!=='OUTCOME')throw Error('Existing V4 outcome required.');
  const claim=report.record.content.claim,underlying=outcome.record.content.claim;
  if(!programCommitmentSame(report.author,outcome.author)||claim.type!==underlying.type||Date.parse(report.createdAt)<Date.parse(outcome.createdAt))throw Error('Linked outcome and reporter attribution differ.');
  if(outcome.record.content.result.kind==='ARTIFACT')await verifyProgramCommitmentEvidenceArtifact(plan,outcome.record.content.result.artifact,manifest.createdAt,scope);
  if(claim.relation){
   if(!underlying.relation||underlying.relation.type!==claim.relation.type)throw Error('Different linked claim relation.');
   const relatedReport=await readProgramCommitmentItem({id:claim.relation.id,digest:claim.relation.digest},signal,scope),relatedOutcome=await readProgramCommitmentItem({id:underlying.relation.id,digest:underlying.relation.digest},signal,scope);
   if(!relatedReport.record||relatedReport.state!=='VISIBLE'||relatedReport.suppression)throw new ProgramCommitmentUnavailable(relatedReport.id);
   if(!relatedOutcome.record||relatedOutcome.state!=='VISIBLE'||relatedOutcome.suppression)throw new ProgramCommitmentUnavailable(relatedOutcome.id);
   if(relatedReport.record.version!==5||relatedReport.record.type!=='OUTCOME'||relatedOutcome.record.version!==4||relatedOutcome.record.type!=='OUTCOME'||!programCommitmentSame(relatedReport.manifest,reference)||!programCommitmentSame(relatedReport.strategy,manifest.strategy)||!programCommitmentSame(relatedOutcome.manifest,{id:forward.manifest.id,digest:forward.manifest.digest})||!programCommitmentSame(relatedOutcome.strategy,manifest.strategy)||!programCommitmentSame(relatedReport.author,relatedOutcome.author)||relatedReport.record.content.claim.type!==relatedOutcome.record.content.claim.type||!programCommitmentSame(relatedReport.record.flags,experimentOutcomeFlags(relatedReport.author,manifest.author,relatedReport.record.content.claim))||!programCommitmentSame(relatedOutcome.record.flags,experimentOutcomeFlags(relatedOutcome.author,forward.manifest.author,relatedOutcome.record.content.claim))||Date.parse(relatedReport.createdAt)>Date.parse(report.createdAt)||Date.parse(relatedReport.createdAt)<Date.parse(relatedOutcome.createdAt)||Date.parse(relatedOutcome.createdAt)>Date.parse(outcome.createdAt)||Date.parse(relatedOutcome.createdAt)<Date.parse(forward.manifest.createdAt))throw Error('Different exact attributable relation dependency.');
   verifyProgramCommitmentEvidenceLink(relatedReport.record.content.result,{id:forward.manifest.id,digest:forward.manifest.digest},{id:relatedOutcome.id,digest:relatedOutcome.digest},relatedOutcome.manifest);
   if(relatedOutcome.record.content.result.kind==='ARTIFACT'){if(!programCommitmentSame(relatedOutcome.record.content.result.artifact.input,forward.manifest.record.content.input))throw Error('Different related forward input.');await verifyProgramCommitmentEvidenceArtifact(plan,relatedOutcome.record.content.result.artifact,manifest.createdAt,scope);}
   const freshRelatedReport=await readProgramCommitmentItem({id:relatedReport.id,digest:relatedReport.digest},signal,scope),freshRelatedOutcome=await readProgramCommitmentItem({id:relatedOutcome.id,digest:relatedOutcome.digest},signal,scope);continuation(relatedReport,freshRelatedReport);continuation(relatedOutcome,freshRelatedOutcome);
   if(relatedReport.record.content.claim.type==='ORIGINAL'&&relatedReport.record.content.claim.relation===null&&relatedOutcome.record.content.claim.type==='ORIGINAL'&&relatedOutcome.record.content.claim.relation===null){relation={report:freshRelatedReport,outcome:freshRelatedOutcome};if(previous?.relation&&previous.relation.report.id===relatedReport.id){continuation(previous.relation.report,freshRelatedReport);continuation(previous.relation.outcome,freshRelatedOutcome);}}
   else unsupportedChain='This report relates to another reproduction or conflict. This bounded declaration view supports a direct relation to an ORIGINAL report only. Open the exact existing V4 record for its deeper history; partial declaration-chain export and reconstruction are withheld.';
  }else if(claim.type!=='ORIGINAL'||underlying.type!=='ORIGINAL'||underlying.relation!==null)throw Error('Original link requires original forward evidence.');
  if(previous?.forward&&programCommitmentSame(previous.forward.reference,forward.reference))try{assertPublicProgramForwardContinuation(previous.forward,forward);}catch{throw new ProgramCommitmentUnavailable(forward.manifest.id);}
 }
 const last=await readProgramCommitmentItem(reference,signal,scope);if(last.state!=='VISIBLE'||!last.record||last.suppression)throw new ProgramCommitmentUnavailable(last.id);continuation(manifest,last);
 const freshSources=await readProgramCommitmentSources(plan,signal,sources,scope),freshReport=report?await readProgramCommitmentItem({id:report.id,digest:report.digest},signal,scope):null;if(report&&freshReport)continuation(report,freshReport);
 if(previous){continuation(previous.manifest,last);if(previous.report&&freshReport&&previous.report.id===freshReport.id&&previous.report.digest===freshReport.digest)continuation(previous.report,freshReport);}
 signal.throwIfAborted();return{manifest:last,sources:freshSources,report:freshReport,forward,relation,unsupportedChain};
}
export async function readProgramCommitmentOriginalForward(manifest:ProgramCommitmentManifestItem,reference:ProgramCommitmentReference,signal:AbortSignal,author:ProgramCommitmentMe){
 const scope=new ProgramCommitmentVerificationScope(),current=await readProgramCommitmentContext({id:manifest.id,digest:manifest.digest},signal,null,undefined,scope);if(current.manifest.record?.version!==5||current.manifest.record.type!=='MANIFEST'||!programCommitmentSame(current.manifest.record,manifest.record))throw new ProgramCommitmentUnavailable(manifest.id);
 let forward:PublicProgramForwardContext;try{forward=await readPublicProgramForwardContext({kind:'OUTCOME',...reference},signal,scope);}catch(error){if(error instanceof PublicProgramForwardUnavailable)throw new ProgramCommitmentUnavailable(error.sourceId);throw error;}const outcome=forward.outcome;
 if(outcome?.record?.version!==4||outcome.record.type!=='OUTCOME'||outcome.record.content.claim.type!=='ORIGINAL'||outcome.record.content.claim.relation!==null||outcome.author.kind!=='HUMAN'||outcome.author.id!==author.authorId||outcome.author.sponsorId!==author.sponsorId)throw Error('Link your own ORIGINAL V4 evidence; report reproductions separately.');
 await verifyProgramCommitmentEvidenceInput(manifest.record.content.input,forward.manifest.record.content.input,manifest.createdAt,scope);if(outcome.record.content.result.kind==='ARTIFACT')await verifyProgramCommitmentEvidenceArtifact(manifest.record.content.input,outcome.record.content.result.artifact,manifest.createdAt,scope);
 await readProgramCommitmentContext({id:manifest.id,digest:manifest.digest},signal,null,current,scope);signal.throwIfAborted();return forward;
}
export async function readProgramCommitmentReports(manifest:ExperimentPublicItem,signal:AbortSignal,cursor:string|null=null){
 if(cursor!==null&&!uuid.test(cursor))throw Error('Invalid report cursor.');const response=await fetch('/api/experiments?outcomes='+manifest.id+(cursor?'&cursor='+cursor:''),options(signal));if(!response.ok)throw Error('Report history unavailable.');
 const page=experimentListSchema.parse(await readProgramForwardPublicJson(response,signal));if(new Set(page.items.map(item=>item.id)).size!==page.items.length||page.items.some(item=>item.type!=='OUTCOME'||!programCommitmentSame(item.manifest,{id:manifest.id,digest:manifest.digest})||!programCommitmentSame(item.strategy,manifest.strategy)))throw Error('Different declaration report page.');signal.throwIfAborted();return page;
}
/** Validate the original command's exact content/author, including a hidden acknowledgment. */
export async function matchProgramCommitmentReceipt(command:ProgramCommitmentCommand,author:ProgramCommitmentMe,raw:unknown,parent:ExperimentPublicItem|null=null){
 const receipt=experimentWriteSchema.parse(raw),item=receipt.item;if(receipt.action!==command.action||receipt.requestId!==command.requestId||!item||item.id!==command.id||item.requestId!==command.requestId||item.type!==(command.action==='register'?'MANIFEST':'OUTCOME')||item.author.kind!=='HUMAN'||item.author.id!==author.authorId||item.author.sponsorId!==author.sponsorId)throw Error('Acknowledgment differs from original command.');
 if(command.action==='outcome'&&(!parent||!programCommitmentSame(item.manifest,command.manifest)||!programCommitmentSame(item.strategy,parent.strategy)))throw Error('Different original report parent.');
 const content=command.action==='register'?{method:command.method,name:command.name,input:command.input,evaluator:command.evaluator,disclosures:command.disclosures}:{method:command.method,name:command.name,manifest:command.manifest,result:command.result,claim:command.claim};
 const flags=command.action==='register'?experimentManifestFlags(command.disclosures):experimentOutcomeFlags(item.author,parent!.author,command.claim),expected=boundedExperimentRecord({version:5,type:item.type,id:command.id,requestId:command.requestId,createdAt:item.createdAt,author:{kind:'HUMAN',id:author.authorId,sponsorId:author.sponsorId},content,flags,policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false});
 if(await experimentDigest(expected.payload)!==item.digest||item.record&&!programCommitmentSame(item.record,expected.record)||!item.record&&item.state==='VISIBLE'&&!item.suppression)throw Error('Original acknowledgment bytes unavailable or inconsistent.');return receipt;
}
