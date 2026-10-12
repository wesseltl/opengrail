import {boundedProgramForwardEvidenceValue,programForwardEvidenceLimits,verifyProgramForwardEvidenceArtifact,verifyProgramForwardReconstructionAttempt} from './program-forward-evidence-model';
import {bindProgramForwardComparisonReport,compareProgramForwardArtifactValues,programForwardJournalComparisonSummary,verifyProgramForwardComparisonReport} from './program-forward-comparison-model';
import type {compareProgramForwardEvidence} from './program-forward-evidence';
import programForwardEvidenceWorkerUrl from './program-forward-evidence.worker.ts?worker&url';

export type ProgramForwardWorkerResult = Awaited<ReturnType<typeof compareProgramForwardEvidence>>;

/** A Worker is created only by an explicit local reconstruction action. Imports stay inert. */
export async function compareProgramForwardInWorker(raw: unknown, options: {signal?: AbortSignal} = {}): Promise<ProgramForwardWorkerResult> {
 const artifact=await verifyProgramForwardEvidenceArtifact(raw); options.signal?.throwIfAborted();
 const operationId=crypto.randomUUID(),worker=new Worker(programForwardEvidenceWorkerUrl,{type:'module',name:'opengrail-program-forward-evidence'});
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error?:Error,result?:ProgramForwardWorkerResult)=>{if(settled)return;settled=true;options.signal?.removeEventListener('abort',cancel);worker.terminate();error?reject(error):resolve(result!);};
  // The trusted Worker yields between bounded receipts and returns its actual
  // partial attempt on cancellation. Do not destroy that evidence on a timer.
  const cancel=()=>{try{worker.postMessage({operationId,type:'CANCEL'});}catch{finish(Error('Worker cancellation unavailable.'));}};
  options.signal?.addEventListener('abort',cancel,{once:true});
  worker.onerror=()=>finish(Error('Local forward Worker unavailable.'));
  worker.onmessage=async event=>{try{
   const message=event.data;if(!message||message.operationId!==operationId)throw Error('Uncorrelated forward Worker response.');
   if(message.type==='ERROR')throw Error('Local forward evidence refused.');
   if(message.type!=='RESULT'||Object.keys(message).sort().join(',')!=='operationId,result,type')throw Error('Invalid forward Worker response.');
   boundedProgramForwardEvidenceValue(message.result,programForwardEvidenceLimits.reconstructionBytes,42);
   if(!message.result||Array.isArray(message.result)||Object.keys(message.result).sort().join(',')!=='attempt,reconstructed,report')throw Error('A complete exact forward Worker result is required.');
   const result=message.result as ProgramForwardWorkerResult,report=await verifyProgramForwardComparisonReport(result.report);await bindProgramForwardComparisonReport(report,artifact);
   const attempt=await verifyProgramForwardReconstructionAttempt(result.attempt);
   const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),complete=attempt.status==='COMPLETED';
   if(!same(attempt.input,artifact.input)||attempt.attemptId!==report.reconstructedAttemptId||attempt.journal.journalDigest!==report.reconstructedJournalDigest||!same(report.reconstructed,programForwardJournalComparisonSummary(attempt.journal)))throw Error('Changed original forward input or actual reconstruction identity.');
   if(complete!==Boolean(result.reconstructed)||complete!==(report.status==='MATCH'||report.status==='MISMATCH')||attempt.reason!==report.reason||attempt.status==='FAILED'&&report.status!=='UNSUPPORTED'||attempt.status==='CANCELLED'&&report.status!=='INTERRUPTED')throw Error('Forward reconstruction disposition differs.');
   let reconstructed:ProgramForwardWorkerResult['reconstructed']=null;
   if(complete){reconstructed=await verifyProgramForwardEvidenceArtifact(result.reconstructed,artifact.input);if(reconstructed.attemptId!==attempt.attemptId||reconstructed.resultDigest!==report.reconstructedArtifactDigest||!same(reconstructed.journal,attempt.journal)||!same(report.comparison,await compareProgramForwardArtifactValues(artifact,reconstructed)))throw Error('Complete fresh forward evidence or comparison operands differ.');}
   else if(result.reconstructed!==null||report.reconstructedArtifactDigest!==null||report.comparison!==null)throw Error('Incomplete forward execution cannot claim a full artifact.');
   finish(undefined,{reconstructed,report,attempt});
  }catch(error){finish(error instanceof Error?error:Error('Invalid forward Worker result.'));}};
  try{worker.postMessage({operationId,type:'COMPARE',artifact});}catch{finish(Error('Local forward Worker delivery failed.'));}
 });
}
