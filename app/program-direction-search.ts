import {evaluateProgramSearchAttempt,createProgramSearchPlan,programSearchAttemptSchema,verifyProgramSearchAttempt} from './program-search-protocol';
import {interruptProgramRun} from './program-run';
import {referenceReplay} from './reference-engine';
import {strategyDigest} from './strategy-model';
import {compareComparisonPair} from './comparison-model';
import {ProgramDirectionSearchError,verifyProgramDirectionSearchAttempt,verifyProgramDirectionSearchLedger,pendingProgramDirectionSearchAttempt,sealProgramDirectionSearchAttempt,createProgramDirectionEconomicCertificate,finishProgramDirectionSearchAttempt,programDirectionSearchAdmissionBody,type ProgramDirectionSearchAttempt} from './program-direction-search-model';
export * from './program-direction-search-model';

/** An explicitly derived private V1 execution shell; it never becomes a selected V1 ledger. */
async function executionShell(attempt:ProgramDirectionSearchAttempt){
 const {method,...admission}=attempt.plan.admission;void method;
 const plan=await createProgramSearchPlan({...admission,version:1,kind:'LOCAL_PROGRAM_SEARCH_ADMISSION'});
 const {attemptDigest,certificate,method:outerMethod,...body}=attempt;void attemptDigest;void certificate;void outerMethod;
 const shell=programSearchAttemptSchema.parse({...body,version:1,kind:'LOCAL_PROGRAM_SEARCH_ATTEMPT',plan,attemptDigest:'0'.repeat(64)}),{attemptDigest:ignored,...shellBody}=shell;void ignored;
 return verifyProgramSearchAttempt({...shellBody,attemptDigest:await strategyDigest(JSON.stringify(shellBody))});
}
/** Executes only unchanged trusted interpreter/trading code, then retains an actual whole reference result. */
export async function evaluateProgramDirectionSearchAttempt(raw:unknown,options:{signal?:AbortSignal;finishedAt?:string}={}):Promise<ProgramDirectionSearchAttempt>{
 const attempt=await verifyProgramDirectionSearchAttempt(raw);if(attempt.status!=='RUNNING')throw new ProgramDirectionSearchError('Terminal direction attempts cannot be rerun.',409);
 const terminal=await evaluateProgramSearchAttempt(await executionShell(attempt),options),{attemptDigest:ignored,...body}=attempt;void ignored;
 let result={...body,finishedAt:terminal.finishedAt,status:terminal.status,reason:terminal.reason,outcome:terminal.outcome,reconstruction:terminal.reconstruction,generatorComparison:terminal.generatorComparison,certificate:null} as Omit<ProgramDirectionSearchAttempt,'attemptDigest'>;
 if(result.outcome){
  let reference:unknown=null,referenceFailure=false;
  try{if(result.outcome.demoRequest&&result.outcome.artifact){reference=referenceReplay(structuredClone(result.outcome.demoRequest));}}
  catch{referenceFailure=true;}
  result.certificate=await createProgramDirectionEconomicCertificate(result as ProgramDirectionSearchAttempt,reference,referenceFailure?'REFERENCE_FAILED':'MISSING_TRADING_INPUT');
 }
 if(options.signal?.aborted){result={...result,status:'INTERRUPTED',reason:'USER_CANCELLED'};}
 if(options.finishedAt===undefined)result.finishedAt=new Date().toISOString();
 const value=await sealProgramDirectionSearchAttempt(result);return verifyProgramDirectionSearchAttempt(value);
}
/** Recovery never runs a pending guest. Its original identity is retained as an interruption. */
export async function recoverProgramDirectionSearchLedger(raw:unknown,finishedAt:string){
 const ledger=await verifyProgramDirectionSearchLedger(raw),pending=pendingProgramDirectionSearchAttempt(ledger);if(!pending)return ledger;
 if(finishedAt<(ledger.events.at(-1)?.at??ledger.plan.createdAt))throw new ProgramDirectionSearchError('Recovery clock regressed.',409);
 const {attemptDigest,...body}=pending;void attemptDigest;
 const terminal=await sealProgramDirectionSearchAttempt({...body,finishedAt,status:'INTERRUPTED',reason:'RECOVERY_INTERRUPTED',outcome:await interruptProgramRun(pending.input,pending.attemptId,'INTERRUPTED'),reconstruction:null,generatorComparison:null,certificate:null});
 return finishProgramDirectionSearchAttempt(ledger,terminal);
}

export const programDirectionSearchComparisonLimits=Object.freeze({reconstructionBytes:346030080,displayedDifferences:50,maximumDepth:48,maximumNodes:20000000});
/** Historical terminal evidence is retained. Only an EVALUATED terminal receives a real fresh computation. */
export async function compareProgramDirectionSearchAttempt(raw:unknown,options:{signal?:AbortSignal}={}){
 const original=await verifyProgramDirectionSearchAttempt(raw);let reconstructed:ProgramDirectionSearchAttempt|null=null,comparison:import('./comparison-model').ComparisonPair|null=null;
 const base={version:1 as const,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_ATTEMPT_RECONSTRUCTION' as const,method:original.method,classification:'AUTHOR_REPORTED' as const,qualification:'NONE' as const,independence:'NOT_ESTABLISHED' as const,ordersEnabled:false as const,original};
 if(original.status!=='EVALUATED'||options.signal?.aborted)return {...base,status:options.signal?.aborted?'INTERRUPTED' as const:'NOT_REEXECUTED' as const,reason:options.signal?.aborted?'USER_CANCELLED':original.status==='RUNNING'?'PENDING_NOT_REEXECUTED':original.status==='INTERRUPTED'?'RETAINED_INTERRUPTION':'RETAINED_UNAVAILABLE',reconstructed,comparison};
 const {attemptDigest,...body}=programDirectionSearchAdmissionBody(original) as ProgramDirectionSearchAttempt;void attemptDigest;
 const admitted=await sealProgramDirectionSearchAttempt(body);
 reconstructed=await evaluateProgramDirectionSearchAttempt(admitted,{signal:options.signal,finishedAt:original.finishedAt!});
 comparison=compareComparisonPair('CLAIM_PRIMARY',original,reconstructed);
 return {...base,status:options.signal?.aborted?'INTERRUPTED' as const:comparison.matches?'MATCH' as const:'MISMATCH' as const,reason:null,reconstructed,comparison};
}
/** Whole retained Search context plus every actual fresh result; this does not replace a winner, TEST or pending history. */
export async function compareProgramDirectionSearchLedger(raw:unknown,options:{signal?:AbortSignal}={}){
 const original=await verifyProgramDirectionSearchLedger(raw),attempts:Array<Omit<Awaited<ReturnType<typeof compareProgramDirectionSearchAttempt>>,'original'>&{attemptId:string;originalAttemptDigest:string}>=[],differences:Array<{attemptId:string;path:string;kind:string;left:number|boolean|null;right:number|boolean|null}>=[];let differenceCount=0;
 for(const attempt of original.attempts){const result=await compareProgramDirectionSearchAttempt(attempt,options);const {original:retained,...summary}=result;attempts.push({...summary,attemptId:retained.attemptId,originalAttemptDigest:retained.attemptDigest});if(result.comparison){differenceCount+=result.comparison.differenceCount;for(const difference of result.comparison.differences)if(differences.length<programDirectionSearchComparisonLimits.displayedDifferences)differences.push({attemptId:attempt.attemptId,...difference});}}
 const status=options.signal?.aborted?'INTERRUPTED' as const:attempts.some(a=>a.status==='MISMATCH')?'MISMATCH' as const:attempts.length>0&&attempts.every(a=>a.status==='MATCH')?'MATCH' as const:'PARTIAL' as const;
 const body={version:1 as const,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_RECONSTRUCTION' as const,method:original.method,classification:'AUTHOR_REPORTED' as const,qualification:'NONE' as const,independence:'NOT_ESTABLISHED' as const,ordersEnabled:false as const,status,identity:{ledger:original.ledgerDigest,plan:original.plan.planDigest,policy:original.plan.selectionMethodDigest,implementations:original.plan.implementations},originalLedger:original,attempts,differenceCount,differences,pendingExecuted:false as const,selectionReplaced:false as const};
 const result={...body,reconstructionDigest:await strategyDigest(JSON.stringify(body))};if(new TextEncoder().encode(JSON.stringify(result)).byteLength>programDirectionSearchComparisonLimits.reconstructionBytes)throw new ProgramDirectionSearchError('Complete Search reconstruction exceeds its separate local byte budget.',413);return result;
}
