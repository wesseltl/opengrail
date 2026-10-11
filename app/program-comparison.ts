import {programSourceFingerprints} from './program-fingerprints';
import {validateProgramRunOutcome} from './program-evidence';
import {runProgramReplay} from './program-run';
import {compareProgramOutcomeValues,sealProgramComparisonReport,bindProgramComparisonReport,programOutcomeComparisonSummary,programOutcomeComparisonIdentity,type ProgramComparisonReport} from './program-comparison-model';
import type {ProgramRunOutcome} from './program-run-model';

/** Actual sponsor-local reconstruction. Reusing the claimed attempt ID makes the
 * deterministic full result exactly comparable, without inventing a new process. */
export async function compareProgramOutcome(raw:unknown,options:{signal?:AbortSignal}={}):Promise<{report:ProgramComparisonReport;reconstructed:ProgramRunOutcome|null}>{
 const claim=await validateProgramRunOutcome(raw),common={version:1,kind:'LOCAL_PROGRAM_COMPARISON',classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',generator:'SAME_IMPLEMENTATION_RECONSTRUCTION',ordersEnabled:false,identity:programOutcomeComparisonIdentity(claim),implementations:programSourceFingerprints,claimed:programOutcomeComparisonSummary(claim)};
 let reconstructed:ProgramRunOutcome|null=null;
 const finish=async(status:ProgramComparisonReport['status'],reason:ProgramComparisonReport['reason'],comparison:ProgramComparisonReport['comparison']=null)=>({report:await bindProgramComparisonReport(await sealProgramComparisonReport({...common,status,reason,reconstructed:reconstructed?programOutcomeComparisonSummary(reconstructed):null,reconstructedOutcomeDigest:reconstructed?.outcomeDigest??null,comparison}),claim),reconstructed});
 if(!claim.input)return finish('UNSUPPORTED','MISSING_ACCEPTED_INPUT');
 if(claim.status==='CANCELLED'||claim.status==='INTERRUPTED')return finish('INTERRUPTED','RETAINED_INTERRUPTION');
 if(options.signal?.aborted)return finish('INTERRUPTED','USER_CANCELLED');
 // Yield before admission and after bounded execution so UI cancellation is
 // observable. The restricted interpreter remains the computation/resource bound.
 await new Promise<void>(resolve=>setTimeout(resolve,0));
 if(options.signal?.aborted)return finish('INTERRUPTED','USER_CANCELLED');
 try{reconstructed=await validateProgramRunOutcome(await runProgramReplay(structuredClone(claim.input),claim.attemptId),claim.input);}catch{return finish('UNSUPPORTED','RECONSTRUCTION_FAILED');}
 await new Promise<void>(resolve=>setTimeout(resolve,0));
 if(options.signal?.aborted)return finish('INTERRUPTED','USER_CANCELLED');
 const comparison=await compareProgramOutcomeValues(claim,reconstructed);
 return finish(comparison.matches?'MATCH':'MISMATCH',null,comparison);
}
