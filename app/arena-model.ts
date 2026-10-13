import {z} from 'zod';
import {experimentPublicItemSchema,experimentFlagSchema,experimentOutcomeFlags,validateExperimentItem,experimentDigest,experimentInputStrategy,experimentInputDependencies} from './experiment-model';
import {strategyPublicItemSchema,boundedStrategyRecord,strategyDefinitionSchema} from './strategy-model';
import {demoArtifactSchema,verifyDemoArtifact,demoEvaluatorMethod,type DemoArtifact} from './demo-model';
import {comparisonReportSchema,verifyComparisonReport} from './comparison-model';
import {experimentReviewBlockingFlags} from './experiment-review-model';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';
import {programRunOutcomeSchema,programRunMethod,programImplementationSchema} from './program-run-model';
import {validateProgramRunOutcome} from './program-evidence';
import {programComparisonReportSchema,bindProgramComparisonReport,compareProgramOutcomeValues,programOutcomeComparisonSummary} from './program-comparison-model';

export const arenaLimits={members:4,attempts:4,admissionBytes:8388608,reportBytes:50331648,exportBytes:67108864,maximumDepth:24,maximumNodes:2000000} as const;
export const arenaForwardTransportDepth=48;
const uuid=z.string().uuid().refine(v=>v===v.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/),finite=z.number().finite();
const clock=z.string().datetime().refine(v=>new Date(v).toISOString()===v),reference=z.object({id:uuid,digest:hash}).strict();
const reason=z.string().regex(/^[A-Z0-9_:.-]{1,160}$/);
export const arenaReviewContextSchema=z.object({original:reference,currentHead:z.object({id:uuid,digest:hash,sequence:z.number().int().min(1).max(32),decision:z.enum(['REPRODUCED','DISPUTED','HELD','REJECTED']).nullable(),state:z.enum(['VISIBLE','HIDDEN','WITHDRAWN'])}).strict().nullable()}).strict();
export const arenaMemberSchema=z.object({outcome:experimentPublicItemSchema,manifest:experimentPublicItemSchema,strategy:strategyPublicItemSchema,sourceDependencies:z.array(strategyPublicItemSchema).min(1).max(4).optional(),reviewContext:arenaReviewContextSchema.optional()}).strict();
export type ArenaMember=z.infer<typeof arenaMemberSchema>;
const definitionShape=strategyDefinitionSchema.innerType().shape;
export const arenaBatchProtocolSchema=z.object({datasetDigest:hash,signalsDigest:hash,market:definitionShape.market,risk:definitionShape.risk,costs:definitionShape.costs,initialCapital:finite.positive(),emergencyStopAt:clock.nullable(),methodDigest:hash,evaluatorVersion:z.literal('opengrail-demo-v1'),sourceDigest:hash,sourceVersion:z.string().min(1).max(80),baseline:z.literal('COST_AWARE_LONG_SAME_ALLOCATION_V1')}).strict();
export const arenaProgramProtocolSchema=z.object({method:z.literal('PROGRAM_DEMO'),datasetDigest:hash,market:definitionShape.market,risk:definitionShape.risk,costs:definitionShape.costs,initialCapital:finite.positive(),emergencyStopAt:clock.nullable(),methodDigest:hash,evaluatorVersion:z.literal('opengrail-program-replay-v1'),implementations:programImplementationSchema,sourceVersion:z.string().min(1).max(80),baseline:z.literal('COST_AWARE_LONG_SAME_ALLOCATION_V1')}).strict();
export const arenaProtocolSchema=z.union([arenaBatchProtocolSchema,arenaProgramProtocolSchema]);
export type ArenaProtocol=z.infer<typeof arenaProtocolSchema>;
export const arenaDiagnosticsSchema=z.object({sampleCount:z.number().int().min(0).max(2000),expectedSamples:z.number().int().min(2).max(2000),fullHorizon:z.boolean(),meanReturnPct:finite.nullable(),dispersionPct:finite.min(0).nullable(),downsideDeviationPct:finite.min(0).nullable(),periodSharpe:finite.nullable(),reasons:z.array(reason).max(8)}).strict();
export type ArenaDiagnostics=z.infer<typeof arenaDiagnosticsSchema>;
export const arenaRowSchema=z.object({index:z.number().int().min(0).max(3),outcome:reference,manifest:reference,strategy:reference,name:z.string().max(120).nullable(),status:z.enum(['CHECKED','HELD','INTERRUPTED']),reason:reason.nullable(),claimedStatus:z.enum(['COMPLETED','NO_TRADES','HALTED','REJECTED','FAILED','CANCELLED','INTERRUPTED','ARTIFACT_UNAVAILABLE','CONTINUOUS_DEMO','PROGRAM_FORWARD_DEMO','PROGRAM_FORWARD_COMMITMENT']).nullable(),comparison:comparisonReportSchema.nullable(),reconstructed:demoArtifactSchema.nullable(),programComparison:programComparisonReportSchema.nullable().optional(),programReconstructed:programRunOutcomeSchema.nullable().optional(),diagnostics:arenaDiagnosticsSchema.nullable(),cautions:z.array(experimentFlagSchema).max(28),rank:z.number().int().min(1).max(4).nullable()}).strict();
export type ArenaRow=z.infer<typeof arenaRowSchema>;
const labels={classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),unseen:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false),executionEnabled:z.literal(false)};
const reportBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_PUBLIC_OUTCOME_ARENA'),startedAt:clock,finishedAt:clock,members:z.array(arenaMemberSchema).min(2).max(arenaLimits.members),rows:z.array(arenaRowSchema).min(2).max(arenaLimits.members),commonProtocol:arenaProtocolSchema.nullable(),protocolDifferences:z.array(reason).max(64),ranking:z.object({eligible:z.boolean(),metric:z.literal('NONANNUALIZED_PERIOD_SHARPE'),reasons:z.array(reason).max(64)}).strict(),status:z.enum(['COMPLETE','HELD','INTERRUPTED']),selectionScope:z.literal('USER_SELECTED_PUBLIC_COHORT'),completeSearchHistory:z.literal(false),independentData:z.literal(false),custodyEstablished:z.literal(false),riskMethod:z.literal('INITIAL_CAPITAL_THEN_CLOSED_BAR_SIMPLE_RETURNS_SAMPLE_SD_ZERO_REFERENCE_NO_ANNUALIZATION'),...labels}).strict();
export const arenaReportSchema=reportBody.extend({reportDigest:hash});
export type ArenaReport=z.infer<typeof arenaReportSchema>;
export class ArenaError extends Error{constructor(message:string,public status=400){super(message);}}
export const arenaSame=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const ref=(item:{id:string;digest:string})=>({id:item.id,digest:item.digest});
function plain(raw:unknown,bound:number,maximum=arenaForwardTransportDepth){let count=0;const active=new Set<object>();function walk(v:unknown,depth:number){if(++count>arenaLimits.maximumNodes||depth>maximum)throw new ArenaError('Arena structure exceeds its bound.',413);if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'&&Number.isFinite(v))return;if(typeof v!=='object')throw new ArenaError('Arena accepts plain finite JSON only.');const p=Object.getPrototypeOf(v),descriptors=Object.getOwnPropertyDescriptors(v);if(!Array.isArray(v)&&p!==Object.prototype&&p!==null||Array.isArray(v)&&p!==Array.prototype||Object.getOwnPropertySymbols(v).length||active.has(v)||Array.isArray(v)&&Object.keys(descriptors).length!==v.length+1)throw new ArenaError('Arena accepts complete plain JSON containers only.');active.add(v);for(const [key,d]of Object.entries(descriptors)){if(Array.isArray(v)&&key==='length')continue;if(!('value'in d)||!d.enumerable)throw new ArenaError('Arena does not accept accessors or hidden fields.');walk(d.value,depth+1);}active.delete(v);}walk(raw,0);if(new TextEncoder().encode(JSON.stringify(raw)).byteLength>bound)throw new ArenaError('Arena JSON exceeds its byte bound.',413);}
function memberDepth(raw:unknown,members:ArenaMember[],maximum:number){if(!members.some(member=>member.manifest.record?.version===4||member.outcome.record?.version===4||member.manifest.record?.version===5||member.outcome.record?.version===5))plain(raw,maximum,arenaLimits.maximumDepth);}
function credentials(raw:unknown,inAuthor=false):void{if(typeof raw==='string'){let value=raw;for(let i=0;i<4;i++){if(/og_local_(owner|producer)_/i.test(value)||!inAuthor&&/og_agent_/i.test(value))throw new ArenaError('Credentials cannot enter an arena.');try{const next=decodeURIComponent(value);if(next===value)break;value=next;}catch{break;}}}else if(raw&&typeof raw==='object')for(const [key,value]of Object.entries(raw))credentials(value,inAuthor||key==='author');}
/** Supplied projections are coherent data, not proof of current HTTP visibility. */
export async function validateArenaMembers(raw:unknown):Promise<ArenaMember[]>{
 plain(raw,arenaLimits.admissionBytes);credentials(raw);const members=z.array(arenaMemberSchema).min(2).max(arenaLimits.members).parse(raw);
 if(members.some(member=>member.manifest.record?.version===6||member.outcome.record?.version===6))throw new ArenaError('Sampled windows require their separate complete-cohort comparison workflow; this Arena does not support that method.');
 memberDepth(raw,members,arenaLimits.admissionBytes);
 if(new Set(members.map(m=>m.outcome.id)).size!==members.length||new Set(members.map(m=>m.strategy.id+':'+m.strategy.digest)).size!==members.length)throw new ArenaError('Each competitor requires a distinct exact outcome and strategy version.');
 for(const member of members){
  const {outcome,manifest,strategy}=member;
  await validateExperimentItem(outcome);await validateExperimentItem(manifest);
  if(outcome.type!=='OUTCOME'||manifest.type!=='MANIFEST'||!outcome.manifest||!arenaSame(outcome.manifest,ref(manifest))||!arenaSame(outcome.strategy,ref(strategy))||!arenaSame(manifest.strategy,ref(strategy)))throw new ArenaError('Arena source references disagree.');
  if(strategy.record&&await experimentDigest(boundedStrategyRecord(strategy.record).payload)!==strategy.digest)throw new ArenaError('Arena strategy digest disagrees.');
  if(outcome.record&&manifest.record){
   if(outcome.record.type!=='OUTCOME'||manifest.record.type!=='MANIFEST'||outcome.record.version!==manifest.record.version)throw new ArenaError('Arena evidence methods disagree.');
   const input=manifest.record.content.input,source=experimentInputStrategy(input);
   if(!strategy.record||!arenaSame(source.record,strategy.record)||source.digest!==strategy.digest)throw new ArenaError('Arena input is not the exact strategy.');
   if(manifest.record.version===4||manifest.record.version===5){const expected=experimentInputDependencies(input),retained=member.sourceDependencies;if(!retained||retained.length!==expected.length||new Set(retained.map(value=>value.id)).size!==retained.length)throw new ArenaError('Forward members require their entire exact public source context.');for(const dependency of expected){const current=retained.find(value=>value.id===dependency.id);if(!current||current.digest!==dependency.digest||current.state!=='VISIBLE'||!current.record||!arenaSame(current.record,dependency.record)||await experimentDigest(boundedStrategyRecord(current.record).payload)!==current.digest)throw new ArenaError('Forward source context is unavailable or inconsistent.');}if(!arenaSame(retained.find(value=>value.id===strategy.id),strategy))throw new ArenaError('Selected forward source differs from its complete source context.');}
   else if(member.sourceDependencies!==undefined)throw new ArenaError('Forward source context cannot alter a legacy member.');
   if(!arenaSame(outcome.record.flags,experimentOutcomeFlags(outcome.author,manifest.author,outcome.record.content.claim)))throw new ArenaError('Arena outcome caution flags disagree.');
   if(outcome.record.content.result.kind==='ARTIFACT'&&!arenaSame(outcome.record.content.result.artifact.input,input))throw new ArenaError('Arena artifact does not match its manifest input.');
   if(member.reviewContext){const claim=outcome.record.content.claim,expected=claim.type==='ORIGINAL'?ref(outcome):claim.relation?{id:claim.relation.id,digest:claim.relation.digest}:null;if(!arenaSame(member.reviewContext.original,expected))throw new ArenaError('Arena review context names a different original.');}
  }
  if(member.reviewContext?.currentHead){const h=member.reviewContext.currentHead;if((h.state==='VISIBLE')!==(h.decision!==null))throw new ArenaError('Arena review head visibility disagrees.');}
 }
 return structuredClone(members);
}
export async function arenaMemberProtocol(member:ArenaMember):Promise<ArenaProtocol|null>{
 const r=member.manifest.record;if(!r||r.type!=='MANIFEST'||r.version===2||r.version===4||r.version===5||r.version===6)return null;
 if(r.version===3){const input=r.content.input,d=input.strategy.record.content.definition;return arenaProgramProtocolSchema.parse({method:'PROGRAM_DEMO',datasetDigest:await experimentDigest(JSON.stringify(input.dataset)),market:d.market,risk:d.risk,costs:d.costs,initialCapital:input.initialCapital,emergencyStopAt:input.emergencyStopAt,methodDigest:r.content.evaluator.methodDigest,evaluatorVersion:r.content.evaluator.version,implementations:r.content.evaluator.implementations,sourceVersion:r.content.evaluator.sourceVersion,baseline:'COST_AWARE_LONG_SAME_ALLOCATION_V1'});}
 const input=r.content.input,d=input.strategy.record.content.definition;
 return arenaProtocolSchema.parse({datasetDigest:await experimentDigest(JSON.stringify(input.dataset)),signalsDigest:await experimentDigest(JSON.stringify(input.signals)),market:d.market,risk:d.risk,costs:d.costs,initialCapital:input.initialCapital,emergencyStopAt:input.emergencyStopAt,methodDigest:r.content.evaluator.methodDigest,evaluatorVersion:r.content.evaluator.version,sourceDigest:r.content.evaluator.sourceDigest,sourceVersion:r.content.evaluator.sourceVersion,baseline:r.content.baseline});
}
export async function arenaProtocols(members:ArenaMember[]){const protocols=await Promise.all(members.map(arenaMemberProtocol)),commonProtocol=protocols[0],protocolDifferences:string[]=[];
 for(const [i,p]of protocols.entries()){
  if(!p){protocolDifferences.push('MEMBER_'+i+':UNSUPPORTED_OR_UNAVAILABLE_PROTOCOL');continue;}
  if(commonProtocol)for(const key of new Set([...Object.keys(commonProtocol),...Object.keys(p)])){const a=Object.getOwnPropertyDescriptor(commonProtocol,key)?.value,b=Object.getOwnPropertyDescriptor(p,key)?.value;if(!arenaSame(a,b))protocolDifferences.push('MEMBER_'+i+':'+key.replace(/[A-Z]/g,v=>'_'+v).toUpperCase());}
  if('method'in p){if(!arenaSame(p.implementations,programRunMethod.implementations)||p.methodDigest!==await experimentDigest(JSON.stringify(programRunMethod)))protocolDifferences.push('MEMBER_'+i+':UNSUPPORTED_EVALUATOR');}
  else if(p.sourceDigest!==evaluatorSourceFingerprints.primary||p.methodDigest!==await experimentDigest(JSON.stringify(demoEvaluatorMethod)))protocolDifferences.push('MEMBER_'+i+':UNSUPPORTED_EVALUATOR');
 }
 return {commonProtocol,protocolDifferences};}
export function initialArenaRows(members:ArenaMember[]):ArenaRow[]{return members.map((m,index)=>{const r=m.outcome.record;if(r?.version===6||m.manifest.record?.version===6)throw new ArenaError('Sampled windows require their separate complete-cohort comparison workflow.');let claimedStatus:ArenaRow['claimedStatus']=null;if(r?.version===5)claimedStatus='PROGRAM_FORWARD_COMMITMENT';else if(r?.version===4)claimedStatus='PROGRAM_FORWARD_DEMO';else if(r?.version===2)claimedStatus='CONTINUOUS_DEMO';else if(r?.type==='OUTCOME')claimedStatus=r.content.result.kind==='ARTIFACT'?r.content.result.artifact.status:r.content.result.kind;return arenaRowSchema.parse({index,outcome:ref(m.outcome),manifest:ref(m.manifest),strategy:ref(m.strategy),name:r?.content.name??null,status:'HELD',reason:'NOT_YET_RECONSTRUCTED',claimedStatus,comparison:null,reconstructed:null,...r?.version===3?{programComparison:null,programReconstructed:null}:{},diagnostics:null,cautions:[...new Set([...(m.manifest.record?.flags??[]),...(r?.flags??[])])],rank:null});});}
/** Fresh evaluator equity only. Periods include initial-capital -> first close;
 * sample SD uses n-1; downside is sqrt(sum(min(r,0)^2)/n). No annualization. */
export function arenaRiskDiagnostics(artifact:DemoArtifact):ArenaDiagnostics{
 if(!artifact.input)throw new ArenaError('Risk diagnostics require accepted input.');
 const input=artifact.input,expectedSamples=input.dataset.bars.length,equity=artifact.equity,reasons:string[]=[];
 const fullHorizon=equity.length===expectedSamples&&equity.every((p,i)=>p.barIndex===i&&p.closedAt===input.dataset.bars[i].closedAt);
 if(!fullHorizon)reasons.push('PARTIAL_OR_INCONSISTENT_HORIZON');
 const empty=()=>arenaDiagnosticsSchema.parse({sampleCount:equity.length,expectedSamples,fullHorizon,meanReturnPct:null,dispersionPct:null,downsideDeviationPct:null,periodSharpe:null,reasons});
 if(!fullHorizon)return empty();if(equity.length<3){reasons.push('INSUFFICIENT_OBSERVATIONS');return empty();}
 let previous=input.initialCapital,mean=0,m2=0,downside=0,count=0;
 for(const point of equity){if(previous<=0||point.equity<=0){reasons.push('NONPOSITIVE_EQUITY');return empty();}const r=(point.equity-previous)/previous;previous=point.equity;count++;const delta=r-mean;mean+=delta/count;m2+=delta*(r-mean);downside+=Math.min(r,0)**2;if(![r,mean,m2,downside].every(Number.isFinite)){reasons.push('NUMERIC_OVERFLOW');return empty();}}
 const dispersion=Math.sqrt(Math.max(0,m2)/(count-1)),lower=Math.sqrt(downside/count),sharpe=dispersion===0?null:mean/dispersion;
 if(dispersion===0)reasons.push('ZERO_VARIANCE');if(![mean*100,dispersion*100,lower*100,...sharpe===null?[]:[sharpe]].every(Number.isFinite)){reasons.push('NUMERIC_OVERFLOW');return empty();}
 return arenaDiagnosticsSchema.parse({sampleCount:count,expectedSamples,fullHorizon,meanReturnPct:mean*100,dispersionPct:dispersion*100,downsideDeviationPct:lower*100,periodSharpe:sharpe,reasons});
}
export function arenaRanking(members:ArenaMember[],rows:ArenaRow[],protocolDifferences:string[]){const reasons:string[]=[];
 if(protocolDifferences.length)reasons.push('INCOMPATIBLE_PROTOCOLS');
 for(const [i,row]of rows.entries()){
  const prefix='MEMBER_'+i+':',member=members[i];
  if(member.outcome.record?.version===5||member.manifest.record?.version===5)reasons.push(prefix+'COMMITMENT_NOT_AN_OBSERVED_OUTCOME');
  if(member.outcome.record?.version===4||member.manifest.record?.version===4)reasons.push(prefix+'FORWARD_PROTOCOL_UNSUPPORTED');
  if(row.status!=='CHECKED'||row.comparison?.status!=='MATCH'||member.outcome.record?.version===3&&(row.programComparison?.status!=='MATCH'||row.programReconstructed?.status!=='COMPLETED'))reasons.push(prefix+'RECONSTRUCTION_UNCONFIRMED');
  if(row.reconstructed?.status!=='COMPLETED'||!row.reconstructed.metrics?.comparable||!row.reconstructed.benchmark?.comparable||row.reconstructed.input?.strategy.record.content.definition.market.direction!=='LONG')reasons.push(prefix+'NONCOMPARABLE_RESULT');
  if(!row.diagnostics?.fullHorizon||row.diagnostics.periodSharpe===null)reasons.push(prefix+'RISK_DIAGNOSTIC_UNAVAILABLE');
  if(row.cautions.some(flag=>(experimentReviewBlockingFlags as readonly string[]).includes(flag)))reasons.push(prefix+'BLOCKING_SEARCH_OR_HOLDOUT_DISCLOSURE');
  const context=member.reviewContext;if(!context)reasons.push(prefix+'REVIEW_CONTEXT_UNAVAILABLE');else if(context.currentHead&&(context.currentHead.state!=='VISIBLE'||context.currentHead.decision!=='REPRODUCED'))reasons.push(prefix+'ADVERSE_OR_UNAVAILABLE_REVIEW_HEAD');
 }
 const eligible=reasons.length===0;if(eligible){const ordered=[...rows].sort((a,b)=>b.diagnostics!.periodSharpe!-a.diagnostics!.periodSharpe!||a.index-b.index);let rank=1;for(const [n,row]of ordered.entries()){if(n>0&&row.diagnostics!.periodSharpe!==ordered[n-1].diagnostics!.periodSharpe)rank=n+1;row.rank=rank;}}else for(const row of rows)row.rank=null;
 return {eligible,metric:'NONANNUALIZED_PERIOD_SHARPE' as const,reasons};
}
export async function sealArenaReport(raw:unknown):Promise<ArenaReport>{plain(raw,arenaLimits.reportBytes);credentials(raw);const body=reportBody.parse(raw);memberDepth(raw,body.members,arenaLimits.reportBytes);const report=arenaReportSchema.parse({...body,reportDigest:await experimentDigest(JSON.stringify(body))});plain(report,arenaLimits.reportBytes);return report;}
/** Structural/source/correlation verification, not proof that computation ran. */
export async function verifyArenaReport(raw:unknown):Promise<ArenaReport>{
 plain(raw,arenaLimits.reportBytes);credentials(raw);const report=arenaReportSchema.parse(raw),{reportDigest,...body}=report;
 memberDepth(raw,report.members,arenaLimits.reportBytes);
 if(await experimentDigest(JSON.stringify(body))!==reportDigest||report.finishedAt<report.startedAt)throw new ArenaError('Arena report identity or timing disagrees.');
 const members=await validateArenaMembers(report.members),expected=await arenaProtocols(members),initial=initialArenaRows(members);
 if(report.rows.length!==members.length||!arenaSame(report.commonProtocol,expected.commonProtocol)||!arenaSame(report.protocolDifferences,expected.protocolDifferences))throw new ArenaError('Arena cohort or protocol changed.');
 for(const [i,row]of report.rows.entries()){
  for(const key of ['index','outcome','manifest','strategy','name','claimedStatus','cautions']as const)if(!arenaSame(row[key],initial[i][key]))throw new ArenaError('Arena row changed its selected member.');
  const selected=members[i],outcome=selected.outcome.record,parent=selected.manifest.record;
  if(outcome?.version===5){if(outcome.type!=='OUTCOME'||parent?.version!==5||parent.type!=='MANIFEST'||row.status!=='HELD'||row.reason!=='COMMITMENT_NOT_AN_OBSERVED_OUTCOME'||row.comparison!==null||row.reconstructed!==null||row.diagnostics!==null||row.rank!==null||row.programComparison!==undefined||row.programReconstructed!==undefined)throw new ArenaError('Commitments remain attributable declarations and links without financial diagnostics or ranking.');continue;}
  if(outcome?.version===4){if(outcome.type!=='OUTCOME'||parent?.version!==4||parent.type!=='MANIFEST'||row.status!=='HELD'||row.reason!=='FORWARD_PROTOCOL_UNSUPPORTED'||row.comparison!==null||row.reconstructed!==null||row.diagnostics!==null||row.rank!==null||row.programComparison!==undefined||row.programReconstructed!==undefined)throw new ArenaError('Forward members remain complete unsupported evidence without financial ranking.');continue;}
  if(outcome?.version===3){
   if(outcome.type!=='OUTCOME'||!parent||parent.type!=='MANIFEST'||parent.version!==3)throw new ArenaError('Program arena evidence has no matching manifest.');
   if(row.programComparison){if(outcome.content.result.kind!=='ARTIFACT')throw new ArenaError('Program comparison has no retained original outcome.');await bindProgramComparisonReport(row.programComparison,outcome.content.result.artifact);}
   if(Boolean(row.programComparison?.reconstructed)!==Boolean(row.programReconstructed)||Boolean(row.programComparison?.reconstructedOutcomeDigest)!==Boolean(row.programReconstructed))throw new ArenaError('Whole program reconstruction must accompany its retained summary and digest.');
   if(row.programReconstructed){
    const fresh=await validateProgramRunOutcome(row.programReconstructed,parent.content.input);
    if(outcome.content.result.kind!=='ARTIFACT'||fresh.attemptId!==outcome.content.result.artifact.attemptId||!row.programComparison||row.programComparison.reconstructedOutcomeDigest!==fresh.outcomeDigest||!arenaSame(row.comparison,fresh.comparison)||!arenaSame(row.reconstructed,fresh.artifact))throw new ArenaError('Arena generator reconstruction correlation changed.');
    if(!arenaSame(row.programComparison.reconstructed,programOutcomeComparisonSummary(fresh))||['MATCH','MISMATCH'].includes(row.programComparison.status)&&!arenaSame(row.programComparison.comparison,await compareProgramOutcomeValues(outcome.content.result.artifact,fresh)))throw new ArenaError('Arena generator differences changed from their retained operands.');
    if(row.reconstructed){await verifyDemoArtifact(row.reconstructed);if(!arenaSame(row.diagnostics,arenaRiskDiagnostics(row.reconstructed)))throw new ArenaError('Program arena risk diagnostics changed.');}
    else if(row.diagnostics!==null)throw new ArenaError('Program diagnostics require a fresh trading artifact.');
   }else if(row.comparison!==null||row.reconstructed!==null||row.diagnostics!==null)throw new ArenaError('Program trading evidence requires full regenerated provenance.');
   if(row.status==='CHECKED'&&(!row.programReconstructed||!row.programComparison||!['MATCH','MISMATCH'].includes(row.programComparison.status)||row.reason!==null)||row.status==='INTERRUPTED'&&row.reason!=='USER_CANCELLED'||row.status==='HELD'&&row.reason===null)throw new ArenaError('Program arena row disposition is inconsistent.');
   continue;
  }
  if(row.programComparison!==undefined||row.programReconstructed!==undefined)throw new ArenaError('Program evidence cannot be attached to a different method.');
  if(row.comparison){const comparison=await verifyComparisonReport(row.comparison),r=members[i].outcome.record;
   if(!r||r.type!=='OUTCOME'||r.version!==1||r.content.result.kind!=='ARTIFACT')throw new ArenaError('Arena comparison has no original batch artifact.');const a=r.content.result.artifact;
   if(comparison.identity.claimedArtifact!==a.resultDigest||comparison.identity.request!==a.digests.request||comparison.identity.strategy!==a.digests.strategy||comparison.identity.dataset!==a.digests.dataset||comparison.identity.signals!==a.digests.signals||!arenaSame(comparison.summaries.claimed,{status:a.status,reason:a.reason,metrics:a.metrics,benchmark:a.benchmark}))throw new ArenaError('Arena comparison correlation changed.');}
  if(row.reconstructed){const artifact=await verifyDemoArtifact(row.reconstructed),m=members[i].manifest.record;
   if(!m||m.type!=='MANIFEST'||m.version!==1||!arenaSame(artifact.input,m.content.input)||artifact.digests.strategy!==members[i].strategy.digest||!row.comparison||!arenaSame(row.comparison.summaries.primary,{status:artifact.status,reason:artifact.reason,metrics:artifact.metrics,benchmark:artifact.benchmark})||!arenaSame(row.diagnostics,arenaRiskDiagnostics(artifact)))throw new ArenaError('Arena fresh replay or diagnostics correlation changed.');}
  else if(row.diagnostics!==null)throw new ArenaError('Arena diagnostics require retained fresh replay.');
  if(row.status==='CHECKED'&&(!row.reconstructed||!row.comparison||!['MATCH','MISMATCH'].includes(row.comparison.status)||row.reason!==null)||row.status==='INTERRUPTED'&&row.reason!=='USER_CANCELLED'||row.status==='HELD'&&row.reason===null)throw new ArenaError('Arena row disposition is inconsistent.');
 }
 const ranked=structuredClone(report.rows),ranking=arenaRanking(members,ranked,expected.protocolDifferences),status=report.rows.some(r=>r.status==='INTERRUPTED')?'INTERRUPTED':report.rows.every(r=>r.status==='CHECKED')?'COMPLETE':'HELD';
 if(!arenaSame(ranking,report.ranking)||!arenaSame(ranked.map(r=>r.rank),report.rows.map(r=>r.rank))||report.status!==status)throw new ArenaError('Arena ranking or disposition changed.');return report;
}
