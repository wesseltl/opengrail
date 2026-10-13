import {
 boundedExperimentCommand,boundedExperimentRecord,experimentDigest,experimentManifestFlags,experimentOutcomeFlags,experimentWriteSchema,
 type ExperimentPublicItem,
} from './experiment-model';
import {readProgramCommitmentIdentity,readProgramCommitmentItem,readProgramCommitmentSources,ProgramCommitmentOwnerChanged,ProgramCommitmentUnavailable} from './program-commitment-browser';
import {readPublicProgramForwardContext,readProgramForwardPublicJson,PublicProgramForwardUnavailable,type PublicProgramForwardContext} from './program-forward-public';
import {readProgramWindowPublicContext,ProgramWindowPublicUnavailable,type ProgramWindowManifestItem} from './program-window-public';
import {verifyProgramWindowInput,programWindowMethod,type ProgramWindowInput} from './program-window-model';
import {boundedPublicProgramWindowRawArchive,verifyProgramWindowRawArchive,verifyProgramWindowObservations,type ProgramWindowRawArchive} from './program-window-observation-model';
import {createProgramWindowEvidence,verifyProgramWindowEvidenceBinding,type ProgramWindowEvidence} from './program-window-evidence-model';
import {verifyProgramCommitmentEvidenceInput,verifyProgramCommitmentEvidenceArtifact} from './program-commitment-model';
import type {ProgramWindowPublicationCommand,ProgramWindowPublicationIdentity} from './program-window-publication-storage';

export const programWindowPublisherLimits=Object.freeze({minimumLeadMs:60000,responseBytes:2097152,rawArchiveBytes:524288,identityBytes:4096});
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
const reference=(value:ExperimentPublicItem)=>({id:value.id,digest:value.digest});
export {readProgramCommitmentIdentity as readProgramWindowPublicationIdentity,ProgramCommitmentOwnerChanged,readProgramForwardPublicJson};
async function sources(input:ProgramWindowInput,signal:AbortSignal){try{await readProgramCommitmentSources(input.plan,signal);}catch(error){if(error instanceof ProgramCommitmentUnavailable)throw new ProgramWindowPublicUnavailable(error.id);throw error;}}

export async function confirmProgramWindowRegistrationSources(rawInput:unknown,signal:AbortSignal){
 const input=await verifyProgramWindowInput(rawInput);await sources(input,signal);
 if(input.declaration){const item=await readProgramCommitmentItem(input.declaration,signal);if(item.state!=='VISIBLE'||item.suppression||item.record?.version!==5||item.record.type!=='MANIFEST'||!same(item.record.content.input,input.plan))throw new ProgramWindowPublicUnavailable(input.declaration.id);}
 await sources(input,signal);signal.throwIfAborted();return input;
}
/** Inspect this human's exact ORIGINAL V4 record. Nothing is fetched from a
 * source URL or reconstructed; the current server fences remain independent. */
export async function readProgramWindowOriginalForPublication(manifest:ProgramWindowManifestItem,outcome:{id:string;digest:string},signal:AbortSignal,author:ProgramWindowPublicationIdentity):Promise<PublicProgramForwardContext>{
 const current=await readProgramWindowPublicContext({kind:'MANIFEST',...reference(manifest)},signal);
 if(!same(current.manifest.record,manifest.record))throw new ProgramWindowPublicUnavailable(manifest.id);
 let forward:PublicProgramForwardContext;try{forward=await readPublicProgramForwardContext({kind:'OUTCOME',...outcome},signal);}catch(error){if(error instanceof PublicProgramForwardUnavailable)throw new ProgramWindowPublicUnavailable(error.sourceId);throw error;}const item=forward.outcome;
 if(item?.record?.version!==4||item.record.type!=='OUTCOME'||item.record.content.claim.type!=='ORIGINAL'||item.record.content.claim.relation!==null||item.author.kind!=='HUMAN'||item.author.id!==author.authorId||item.author.sponsorId!==author.sponsorId)throw Error('Use your own exact ORIGINAL V4 outcome for this complete window.');
 const input=current.manifest.record.content.input;await verifyProgramCommitmentEvidenceInput(input.plan,forward.manifest.record.content.input,current.manifest.createdAt);
 if(item.record.content.result.kind==='ARTIFACT')await verifyProgramCommitmentEvidenceArtifact(input.plan,item.record.content.result.artifact,current.manifest.createdAt);
 await readProgramWindowPublicContext(current.reference,signal,current);signal.throwIfAborted();return forward;
}
/** The report links full captured bytes with a separate AUTHOR_DECLARED
 * closure. No compact financial metric or reconstructed qualification. */
export async function createProgramWindowPublicArchiveLink(manifest:ProgramWindowManifestItem,forward:PublicProgramForwardContext,rawArchive:unknown,inspectedAt:string):Promise<{evidence:ProgramWindowEvidence;archive:ProgramWindowRawArchive}>{
 const input:ProgramWindowInput=await verifyProgramWindowInput(manifest.record.content.input),outcome=forward.outcome;
 if(outcome?.record?.version!==4||outcome.record.type!=='OUTCOME')throw Error('The whole exact V4 outcome is required.');
 boundedPublicProgramWindowRawArchive(rawArchive,programWindowPublisherLimits.rawArchiveBytes);const archive=await verifyProgramWindowRawArchive(rawArchive,input,'PUBLIC');
 const artifact=outcome.record.content.result.kind==='ARTIFACT'?outcome.record.content.result.artifact:null,journal=artifact?.journal??null;
 const observations=await verifyProgramWindowObservations(input,archive,{journal,inspectedAt});
 const state=journal?.trading.state,settlementStatus=!state||journal?.pending?'UNKNOWN' as const:state.openPositions.length>0&&(state.status==='STOPPING'||state.emergencyAt!==null)?'AWAITING_PROTECTIVE_EXIT' as const:state.pending?'PENDING_ENTRY' as const:state.openPositions.length?'OPEN_EXPOSURE' as const:'SETTLED' as const;
 const evidence=await createProgramWindowEvidence({version:1,kind:'WINDOW_EVIDENCE_LINK',method:programWindowMethod.localMethod,inputDigest:input.inputDigest,protocolDigest:input.protocol.protocolDigest,
  manifest:reference(forward.manifest),outcome:reference(outcome),rawArchive:archive,
  closure:{kind:'AUTHOR_DECLARED_WINDOW_CLOSURE',verification:'NOT_ESTABLISHED',observationStatus:observations.observationStatus,computationStatus:'UNAVAILABLE',boundaryStatus:observations.boundaryStatus,settlementStatus,terminalValuation:'UNKNOWN',observationReportDigest:observations.reportDigest,reconstructionAttemptDigest:null,accountingReportDigest:null,
   reason:'Complete captured archive retained, including failures and uncertainty. Fresh local guest reconstruction and terminal account valuation are separate actions; no full sampling coverage or independent qualification is implied.'},
  classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',performanceInterpretation:'SAMPLED_DEMO_WITH_TERMINAL_MARK',continuousMarketCoverage:false,independentQualification:false,executionEnabled:false,ordersEnabled:false,liveEnabled:false});
 await verifyProgramWindowEvidenceBinding(evidence,input,forward.manifest.record.content.input,artifact,manifest.createdAt,inspectedAt);
 return {evidence,archive};
}
/** A successful response confirms only the original canonical operation. A
 * content-free tombstone never restores a held body. */
export async function matchProgramWindowPublicationReceipt(command:ProgramWindowPublicationCommand,author:ProgramWindowPublicationIdentity,raw:unknown,parent:ExperimentPublicItem|null=null){
 boundedExperimentCommand(command);const receipt=experimentWriteSchema.parse(raw),item=receipt.item;
 if(receipt.action!==command.action||receipt.requestId!==command.requestId||!item||item.id!==command.id||item.requestId!==command.requestId||item.type!==(command.action==='register'?'MANIFEST':'OUTCOME')||item.author.kind!=='HUMAN'||item.author.id!==author.authorId||item.author.sponsorId!==author.sponsorId)throw Error('The acknowledgment differs from the original exact window operation.');
 const source=command.action==='register'?{id:command.input.plan.config.strategy.record.id,digest:command.input.plan.config.strategy.digest}:parent?.strategy;
 if(!source||!same(item.strategy,source)||command.action==='register'&&item.manifest!==null||command.action==='outcome'&&(!parent||!same(item.manifest,command.manifest)||!same(reference(parent),command.manifest)))throw Error('The original window source or parent binding differs.');
 const content=command.action==='register'?{method:command.method,name:command.name,input:command.input,evaluator:command.evaluator,disclosures:command.disclosures}:{method:command.method,name:command.name,manifest:command.manifest,result:command.result,claim:command.claim};
 const flags=command.action==='register'?experimentManifestFlags(command.disclosures):experimentOutcomeFlags(item.author,parent!.author,command.claim);
 const expected=boundedExperimentRecord({version:6,type:item.type,id:command.id,requestId:command.requestId,createdAt:item.createdAt,author:{kind:'HUMAN',id:author.authorId,sponsorId:author.sponsorId},content,flags,policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false});
 if(await experimentDigest(expected.payload)!==item.digest||item.record&&!same(item.record,expected.record)||!item.record&&item.state==='VISIBLE'&&!item.suppression)throw Error('The original acknowledgment content/digest is unavailable or changed.');return receipt;
}
