import {z} from 'zod';
import {verifyDemoArtifact,type DemoArtifact} from './demo-model';
import {replayDemo} from './demo-engine';
import {referenceReplay,referenceEvaluatorVersion} from './reference-engine';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';
import {referenceResultSchema,evaluatorComparisonPolicy,compareComparisonPair,sealComparisonReport,type ComparisonReport} from './comparison-model';
export {comparisonLimits,evaluatorComparisonPolicy,referenceResultSchema,comparisonReportSchema,verifyComparisonReport,type ComparisonReport} from './comparison-model';

function projection(artifact:DemoArtifact){return referenceResultSchema.parse({status:artifact.status,reason:artifact.reason,audit:artifact.audit.map(({details,...row})=>{void details;return row;}),trades:artifact.trades,equity:artifact.equity,metrics:artifact.metrics,benchmark:artifact.benchmark});}
function brief(result:z.infer<typeof referenceResultSchema>){return {status:result.status,reason:result.reason,metrics:result.metrics,benchmark:result.benchmark};}
/** Fixed local first-party computations only. Agreement never qualifies research. */
export async function compareDemoArtifact(raw:unknown):Promise<ComparisonReport>{
 const artifact=await verifyDemoArtifact(raw),claim=projection(artifact);
 if(Object.values(evaluatorSourceFingerprints).some(hash=>/^0+$/.test(hash)))throw Error('Evaluator source identities are not prepared.');
 const common={version:1 as const,kind:'LOCAL_EVALUATOR_COMPARISON' as const,classification:'AUTHOR_REPORTED' as const,qualification:'NONE' as const,independence:'NOT_ESTABLISHED' as const,ordersEnabled:false as const,identity:{requestId:artifact.requestId,claimedArtifact:artifact.resultDigest,request:artifact.digests.request,strategy:artifact.digests.strategy,dataset:artifact.digests.dataset,signals:artifact.digests.signals,declaredMethod:artifact.digests.evaluator},implementations:{primary:{version:artifact.evaluatorVersion,sourceSha256:evaluatorSourceFingerprints.primary},reference:{version:referenceEvaluatorVersion,sourceSha256:evaluatorSourceFingerprints.reference}},policy:evaluatorComparisonPolicy,sharedDependencies:['METHOD_SPECIFICATION','JAVASCRIPT_NUMBER_RUNTIME','INPUT_SCHEMAS_AND_HASHING','INPUT_DATA_AND_OPERATOR','REVIEW_OF_PRIMARY_SOURCE'] as const};
 if(!artifact.input)return sealComparisonReport({...common,status:'UNRECONSTRUCTIBLE',reason:'MISSING_ACCEPTED_INPUT',summaries:{claimed:brief(claim),primary:null,reference:null},pairs:[]});
 let primary:z.infer<typeof referenceResultSchema>|null=null,reference:z.infer<typeof referenceResultSchema>|null=null;
 try{
  primary=projection(await verifyDemoArtifact(await replayDemo(structuredClone(artifact.input))));
  reference=referenceResultSchema.parse(referenceReplay(structuredClone(artifact.input)));
  const pairs=[compareComparisonPair('CLAIM_PRIMARY',claim,primary),compareComparisonPair('CLAIM_REFERENCE',claim,reference),compareComparisonPair('PRIMARY_REFERENCE',primary,reference)];
  return sealComparisonReport({...common,status:pairs.every(p=>p.matches)?'MATCH':'MISMATCH',reason:null,summaries:{claimed:brief(claim),primary:brief(primary),reference:brief(reference)},pairs});
 }catch{return sealComparisonReport({...common,status:'FAILED',reason:'EVALUATOR_FAILURE',summaries:{claimed:brief(claim),primary:primary?brief(primary):null,reference:reference?brief(reference):null},pairs:[]});}
}
