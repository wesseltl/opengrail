import {compareDemoArtifact} from './evaluator-comparison';
import {replayDemo} from './demo-engine';
import {verifyDemoArtifact} from './demo-model';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';
import {compareProgramOutcome} from './program-comparison';
import {validateArenaMembers,arenaProtocols,initialArenaRows,arenaRiskDiagnostics,arenaRanking,sealArenaReport,verifyArenaReport,type ArenaMember,type ArenaRow,type ArenaReport} from './arena-model';

/** Only fixed application evaluators run. Every selected competitor is retained,
 * including missing artifacts, incompatible methods and interrupted work. */
export async function evaluateArena(rawMembers:ArenaMember[],options:{signal?:AbortSignal;onProgress?:(rows:ArenaRow[])=>void}={}):Promise<ArenaReport>{
 const startedAt=new Date().toISOString(),members=await validateArenaMembers(rawMembers),protocols=await arenaProtocols(members),rows=initialArenaRows(members);
 const cancelled=()=>options.signal?.aborted===true;
 const progress=()=>{try{options.onProgress?.(structuredClone(rows));}catch{/* Observers cannot alter evaluator admission or discard evidence. */}};
 for(const [i,member]of members.entries()){
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  const row=rows[i],o=member.outcome,m=member.manifest,s=member.strategy;
  if(cancelled()){row.status='INTERRUPTED';row.reason='USER_CANCELLED';progress();continue;}
  if(o.state!=='VISIBLE'||m.state!=='VISIBLE'||s.state!=='VISIBLE'||!o.record||!m.record||!s.record){row.reason='PUBLIC_CONTENT_UNAVAILABLE';progress();continue;}
  if(o.record.type!=='OUTCOME'||m.record.type!=='MANIFEST'){row.reason='EVIDENCE_BINDING_UNAVAILABLE';progress();continue;}
  if(o.record.version===3&&m.record.version===3){
   if(o.record.content.result.kind!=='ARTIFACT'){row.reason=o.record.content.result.kind;progress();continue;}
   try{
    const fresh=await compareProgramOutcome(o.record.content.result.artifact,{signal:options.signal});row.programComparison=fresh.report;row.programReconstructed=fresh.reconstructed;
    if(fresh.reconstructed){row.reconstructed=fresh.reconstructed.artifact;row.comparison=fresh.reconstructed.comparison;if(row.reconstructed)row.diagnostics=arenaRiskDiagnostics(row.reconstructed);}
    if(cancelled()){row.status='INTERRUPTED';row.reason='USER_CANCELLED';}
    else if(fresh.reconstructed&&['MATCH','MISMATCH'].includes(fresh.report.status)){row.status='CHECKED';row.reason=null;}
    else{row.status='HELD';row.reason=fresh.report.status==='INTERRUPTED'?'CLAIM_INTERRUPTED':'PROGRAM_RECONSTRUCTION_UNAVAILABLE';}
   }catch{row.status=cancelled()?'INTERRUPTED':'HELD';row.reason=cancelled()?'USER_CANCELLED':'PROGRAM_RECONSTRUCTION_FAILED';}
   progress();continue;
  }
  if(o.record.version!==1||m.record.version!==1){row.reason='CONTINUOUS_METHOD_UNSUPPORTED';progress();continue;}
  if(o.record.content.result.kind!=='ARTIFACT'){row.reason=o.record.content.result.kind;progress();continue;}
  if(m.record.content.evaluator.sourceDigest!==evaluatorSourceFingerprints.primary){row.reason='UNSUPPORTED_EVALUATOR';progress();continue;}
  try{
   row.comparison=await compareDemoArtifact(o.record.content.result.artifact);
   if(cancelled()){row.status='INTERRUPTED';row.reason='USER_CANCELLED';progress();continue;}
   row.reconstructed=await verifyDemoArtifact(await replayDemo(structuredClone(m.record.content.input)));
   row.diagnostics=arenaRiskDiagnostics(row.reconstructed);
   if(cancelled()){row.status='INTERRUPTED';row.reason='USER_CANCELLED';}else if(row.comparison.status==='FAILED'||row.comparison.status==='UNRECONSTRUCTIBLE'){row.status='HELD';row.reason='RECONSTRUCTION_FAILED';}else{row.status='CHECKED';row.reason=null;}
  }catch{row.status=cancelled()?'INTERRUPTED':'HELD';row.reason=cancelled()?'USER_CANCELLED':'RECONSTRUCTION_FAILED';}
  progress();
 }
 const ranking=arenaRanking(members,rows,protocols.protocolDifferences),finishedAt=new Date().toISOString();
 const report=await sealArenaReport({version:1,kind:'LOCAL_PUBLIC_OUTCOME_ARENA',startedAt,finishedAt,members,rows,...protocols,ranking,status:rows.some(r=>r.status==='INTERRUPTED')?'INTERRUPTED':rows.every(r=>r.status==='CHECKED')?'COMPLETE':'HELD',selectionScope:'USER_SELECTED_PUBLIC_COHORT',completeSearchHistory:false,independentData:false,custodyEstablished:false,riskMethod:'INITIAL_CAPITAL_THEN_CLOSED_BAR_SIMPLE_RETURNS_SAMPLE_SD_ZERO_REFERENCE_NO_ANNUALIZATION',classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',unseen:'NOT_ESTABLISHED',ordersEnabled:false,executionEnabled:false});
 return verifyArenaReport(report);
}
