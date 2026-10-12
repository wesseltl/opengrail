import {z} from 'zod';
import {strategyPublicItemSchema,strategyDefinitionSchema,boundedStrategyRecord,strategyDigest,type StrategyPublicItem} from './strategy-model';
import {demoDatasetSchema,demoEvaluatorVersion,demoEvaluatorMethod,demoTimeframes,demoLimits} from './demo-model';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';
import {programImplementationSchema,programRunInputSchema,programRunOutcomeSchema,programRunMethod,programRunLimits,type ProgramRunInput,type ProgramRunOutcome} from './program-run-model';
import {programSourceFingerprints} from './program-fingerprints';
import {boundedProgramRunInput,guardProgramData} from './program-run-model';
import type {StrategyRecordV2} from './strategy-model';
import type {DemoDataset} from './demo-model';
import {verifyProgramRunInput,validateProgramRunOutcome} from './program-evidence';
import {programComparisonReportSchema,bindProgramComparisonReport,compareProgramOutcomeValues,programOutcomeComparisonSummary,type ProgramComparisonReport} from './program-comparison-model';

import {referenceResultSchema,compareComparisonPair,type ComparisonPair} from './comparison-model';
import {programDirectionSourceFingerprints} from './program-direction-fingerprints';
export const programDirectionSearchMethod='DIRECTION_MATCHED_TRAIN_RETURN_V1' as const;
export const programDirectionSearchPolicy=Object.freeze({version:programDirectionSearchMethod,objective:'MAX_RETURN_PCT' as const,cohort:'EXACT_SHARED_DIRECTION_MARKET_COSTS_RISK_CAPITAL' as const,eligibility:'COMPLETE_PROGRAM_AND_GENERATOR_AND_TRADING_AND_ECONOMIC_MATCH' as const,benchmarkRanking:'NONE' as const,legacyComparability:'UNCHANGED' as const,borrowFunding:'UNMODELED_VIRTUAL_LINEAR_EXPOSURE' as const,qualification:'NONE' as const});
const programDirectionSearchPolicySchema=z.object({version:z.literal(programDirectionSearchMethod),objective:z.literal('MAX_RETURN_PCT'),cohort:z.literal('EXACT_SHARED_DIRECTION_MARKET_COSTS_RISK_CAPITAL'),eligibility:z.literal('COMPLETE_PROGRAM_AND_GENERATOR_AND_TRADING_AND_ECONOMIC_MATCH'),benchmarkRanking:z.literal('NONE'),legacyComparability:z.literal('UNCHANGED'),borrowFunding:z.literal('UNMODELED_VIRTUAL_LINEAR_EXPOSURE'),qualification:z.literal('NONE')}).strict();

/** Additive inert V2 identity and selection contract. Historical Search and all execution bytes stay unchanged. */
export const programDirectionSearchLimits=Object.freeze({candidates:4,admissionBytes:1048576,planBytes:1048576,attemptBytes:33554432,ledgerBytes:171966464,testInputBytes:524288,events:16,maximumDepth:40,maximumNodes:10000000,referenceBytes:8388608,certificateBytes:8519680});
export class ProgramDirectionSearchError extends Error{constructor(message:string,public status=400){super(message);}}
const uuid=z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),hash=z.string().length(64).regex(/^[a-f0-9]{64}$/),clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value),finite=z.number().finite();
const labels={method:z.literal(programDirectionSearchMethod),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),unseen:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false)};
const flags={method:programDirectionSearchMethod,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',unseen:'NOT_ESTABLISHED',ordersEnabled:false} as const;
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right),bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength,digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
function assertProgramDirectionSearch(ok:boolean,message:string,status=409):asserts ok{if(!ok)throw new ProgramDirectionSearchError(message,status);}
function credential(value:string){for(let n=0;n<32;n++){if(/og_(?:agent|local_(?:producer|owner))_|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-|svcacct-|ant-)[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|Bearer\s+[^\s"'<>]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value))return true;const next=value.replace(/(?:%[a-f0-9]{2})+/gi,run=>{try{return decodeURIComponent(run);}catch{return run.replace(/%([a-f0-9]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16)));}});if(next===value)return false;value=next;}return true;}
const text=(maximum:number)=>z.string().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>value===value.trim()&&!credential(value));
/** Descriptor inspection precedes parsing or serialization; no supplied hooks run. */
export function boundedProgramDirectionSearchValue(raw:unknown,maximum:number){
 let count=0;const path=new Set<object>();
 function walk(value:unknown,depth:number):void{
  if(++count>programDirectionSearchLimits.maximumNodes||depth>programDirectionSearchLimits.maximumDepth)throw new ProgramDirectionSearchError('Program search structure exceeds its fixed budget.',413);
  if(typeof value==='string'){if(credential(value))throw new ProgramDirectionSearchError('Credentials cannot enter program search evidence.');return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(!value||typeof value!=='object'||path.has(value)||Object.getOwnPropertySymbols(value).length)throw new ProgramDirectionSearchError('Program search requires plain finite canonical JSON.');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new ProgramDirectionSearchError('Program search requires plain JSON containers.');
  if(array&&Object.keys(descriptors).length!==(value as unknown[]).length+1)throw new ProgramDirectionSearchError('Program search arrays must be complete.');
  path.add(value);
  for(const [key,descriptor]of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   if(credential(key)||!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=(value as unknown[]).length))throw new ProgramDirectionSearchError('Program search hooks, credentials and hidden fields are refused.');
   walk(descriptor.value,depth+1);
  }
  path.delete(value);
 }
 walk(raw,0);if(bytes(raw)>maximum)throw new ProgramDirectionSearchError('Program search material exceeds its byte budget.',413);
}
function unchanged(left:unknown,right:unknown):boolean{if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&unchanged(a[key],b[key]));}
function parsed<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T{boundedProgramDirectionSearchValue(raw,maximum);try{const value=schema.parse(raw);assertProgramDirectionSearch(unchanged(raw,value),'Program search requires canonical unchanged material.',400);boundedProgramDirectionSearchValue(value,maximum);return value;}catch(error){if(error instanceof ProgramDirectionSearchError)throw error;throw new ProgramDirectionSearchError('Program search material does not match its strict contract.');}}
const definitions=strategyDefinitionSchema.innerType().shape;
const protocolSchema=z.object({market:definitions.market,risk:definitions.risk,costs:definitions.costs,initialCapital:finite.min(.01).max(1000000)}).strict();
const selectionRuleSchema=z.object({objective:z.literal('MAX_RETURN_PCT'),minTrades:z.number().int().min(0).max(demoLimits.trades),maxDrawdownPct:finite.min(0).max(1000000),minReturnPct:finite.min(-1000000).max(1000000),tieTolerancePct:z.literal(.00000001),tieBreak:z.literal('CANDIDATE_ORDER')}).strict();
export const programDirectionSearchTestInputSchema=z.object({dataset:demoDatasetSchema}).strict();
export type ProgramDirectionSearchTestInput=z.infer<typeof programDirectionSearchTestInputSchema>;
export const programDirectionSearchAdmissionSchema=z.object({version:z.literal(2),kind:z.literal('LOCAL_PROGRAM_DIRECTION_SEARCH_ADMISSION'),method:z.literal(programDirectionSearchMethod),id:uuid,createdAt:clock,candidates:z.array(z.object({source:strategyPublicItemSchema,attemptId:uuid,requestId:uuid}).strict()).min(2).max(4),train:programDirectionSearchTestInputSchema,test:z.object({datasetId:uuid,firstClosedAt:clock,barCount:z.number().int().min(2).max(demoLimits.bars),gapBars:z.number().int().min(0).max(demoLimits.bars),provenance:z.enum(['SYNTHETIC','USER_SUPPLIED']),permission:z.enum(['CREATED_SYNTHETIC','AUTHORIZED_USE']),attemptId:uuid,requestId:uuid}).strict(),initialCapital:finite.min(.01).max(1000000),hypothesis:text(2000),falsification:text(2000),selection:selectionRuleSchema}).strict();
export type ProgramDirectionSearchPlanAdmission=z.infer<typeof programDirectionSearchAdmissionSchema>;
const implementationsSchema=z.object({primary:z.object({version:z.literal(demoEvaluatorVersion),sourceSha256:hash}).strict(),reference:z.object({version:z.literal('opengrail-reference-v1'),sourceSha256:hash}).strict(),program:programImplementationSchema,direction:z.object({model:hash,runner:hash,cli:hash}).strict()}).strict();
const implementations=()=>({primary:{version:demoEvaluatorVersion,sourceSha256:evaluatorSourceFingerprints.primary},reference:{version:'opengrail-reference-v1' as const,sourceSha256:evaluatorSourceFingerprints.reference},program:programSourceFingerprints,direction:programDirectionSourceFingerprints});
const planBody=z.object({version:z.literal(2),kind:z.literal('LOCAL_PROGRAM_DIRECTION_SEARCH_PLAN'),id:uuid,createdAt:clock,...labels,admission:programDirectionSearchAdmissionSchema,protocol:protocolSchema,implementations:implementationsSchema,selectionPolicy:programDirectionSearchPolicySchema,selectionMethodDigest:hash,methodDigest:hash,tradingMethodDigest:hash,trainInputs:z.array(z.object({candidateId:uuid,attemptId:uuid,requestId:uuid,inputDigest:hash}).strict()).min(2).max(4)}).strict();
export const programDirectionSearchPlanSchema=planBody.extend({planDigest:hash});
export type ProgramDirectionSearchPlan=z.infer<typeof programDirectionSearchPlanSchema>;
const certificateIdentity=z.object({attemptId:uuid,input:hash,outcome:hash,reconstruction:hash.nullable(),generatorComparison:hash.nullable(),tradingArtifact:hash.nullable(),tradingComparison:hash.nullable(),tradingRequest:hash.nullable(),source:hash,module:hash,dataset:hash,signals:hash.nullable(),policy:hash}).strict();
const economicCheckSchema=z.object({status:z.enum(['VALID','INVALID','UNAVAILABLE']),reasons:z.array(z.enum(['DIRECTION','TRADE_ACCOUNTING','TRADE_COSTS','TRADE_IDENTITIES','EQUITY_ACCOUNTING','METRIC_ACCOUNTING','HISTORY_COMPLETENESS','NUMERICAL_LIMIT','METRICS_UNAVAILABLE'])).max(9)}).strict();
const directionPairSchema=z.object({pair:z.literal('CLAIM_REFERENCE'),matches:z.boolean(),differenceCount:z.number().int().min(0).max(2000000),differences:z.array(z.object({path:z.string().min(1).max(200),kind:z.enum(['VALUE','TYPE','LENGTH','MISSING']),left:z.union([finite,z.boolean(),z.null()]),right:z.union([finite,z.boolean(),z.null()])}).strict()).max(50)}).strict();
const certificateBody=z.object({version:z.literal(1),kind:z.literal('PROGRAM_DIRECTION_ECONOMIC_CERTIFICATE'),...labels,status:z.enum(['MATCH','MISMATCH','UNAVAILABLE']),reason:z.enum(['MISSING_TRADING_INPUT','REFERENCE_FAILED']).nullable(),identity:certificateIdentity,reference:referenceResultSchema.nullable(),referenceDigest:hash.nullable(),comparison:directionPairSchema.nullable(),economics:z.object({primary:economicCheckSchema,reference:economicCheckSchema}).strict()}).strict();
export const programDirectionEconomicCertificateSchema=certificateBody.extend({certificateDigest:hash});
export type ProgramDirectionEconomicCertificate=z.infer<typeof programDirectionEconomicCertificateSchema>;

const attemptBody=z.object({version:z.literal(2),kind:z.literal('LOCAL_PROGRAM_DIRECTION_SEARCH_ATTEMPT'),...labels,plan:programDirectionSearchPlanSchema,phase:z.enum(['TRAIN','TEST']),candidateId:uuid,attemptId:uuid,requestId:uuid,input:programRunInputSchema,inputDigest:hash,startedAt:clock,finishedAt:clock.nullable(),status:z.enum(['RUNNING','EVALUATED','INTERRUPTED','UNAVAILABLE']),reason:z.enum(['USER_CANCELLED','RECOVERY_INTERRUPTED','EVALUATOR_FAILURE','RESULT_LIMIT']).nullable(),outcome:programRunOutcomeSchema.nullable(),reconstruction:programRunOutcomeSchema.nullable(),generatorComparison:programComparisonReportSchema.nullable(),certificate:programDirectionEconomicCertificateSchema.nullable()}).strict();
export const programDirectionSearchAttemptSchema=attemptBody.extend({attemptDigest:hash});
export type ProgramDirectionSearchAttempt=z.infer<typeof programDirectionSearchAttemptSchema>;
const eligibilityReasons=['ATTEMPT_INTERRUPTED','ATTEMPT_UNAVAILABLE','PROGRAM_STATUS','GENERATOR_COMPARISON_UNAVAILABLE','GENERATOR_COMPARISON_MISMATCH','ARTIFACT_STATUS','COMPARISON_UNAVAILABLE','COMPARISON_MISMATCH','METRICS_UNAVAILABLE','CERTIFICATE_UNAVAILABLE','CERTIFICATE_MISMATCH','TRADE_FLOOR','RETURN_FLOOR','DRAWDOWN_LIMIT'] as const;
const selectionBody=z.object({planDigest:hash,decision:z.enum(['SELECTED','NO_SELECTION']),selectedCandidateId:uuid.nullable(),lockedAt:clock,trainingResultSetDigest:hash,ranking:z.array(z.object({candidateId:uuid,attemptDigest:hash,eligible:z.boolean(),reasons:z.array(z.enum(eligibilityReasons)).max(14),returnPct:finite.nullable()}).strict()).min(2).max(4),eligibleOrder:z.array(uuid).max(4)}).strict();
const selectionSchema=selectionBody.extend({selectionDigest:hash});
export type ProgramDirectionSearchSelection=z.infer<typeof selectionSchema>;
const eventBody=z.object({sequence:z.number().int().min(1).max(programDirectionSearchLimits.events),at:clock,type:z.enum(['PLAN_FROZEN','TRAIN_ADMITTED','TEST_ADMITTED','ATTEMPT_FINISHED','SELECTION_LOCKED']),attemptId:uuid.nullable(),recordDigest:hash,previous:hash.nullable()}).strict();
const eventSchema=eventBody.extend({digest:hash});
const ledgerBody=z.object({version:z.literal(2),kind:z.literal('LOCAL_PROGRAM_DIRECTION_SEARCH_LEDGER'),id:uuid,...labels,plan:programDirectionSearchPlanSchema,attempts:z.array(programDirectionSearchAttemptSchema).max(5),selection:selectionSchema.nullable(),events:z.array(eventSchema).max(programDirectionSearchLimits.events)}).strict();
export const programDirectionSearchLedgerSchema=ledgerBody.extend({ledgerDigest:hash});
export type ProgramDirectionSearchLedger=z.infer<typeof programDirectionSearchLedgerSchema>;

async function source(raw:StrategyPublicItem,createdAt:string){
 const item=strategyPublicItemSchema.parse(raw);assertProgramDirectionSearch(item.state==='VISIBLE'&&!!item.record,'Every program candidate requires an exact visible source.');
 assertProgramDirectionSearch(item.record.version===2,'Mixed rule/program cohorts are unsupported; every candidate must be an exact V2 program source.',400);
 uuid.parse(item.id);uuid.parse(item.rootId);uuid.parse(item.requestId);clock.parse(item.createdAt);clock.parse(item.record.createdAt);if(item.author.kind==='AGENT')uuid.parse(item.author.id);
 assertProgramDirectionSearch(item.author.sponsorId.length===70&&item.author.id.length===(item.author.kind==='HUMAN'?70:36),'Candidate author identity is invalid.');
 assertProgramDirectionSearch(createdAt>=(item.moderation.at(-1)?.createdAt??item.createdAt),'Plan time precedes its captured source.');
 const bounded=boundedStrategyRecord(item.record);assertProgramDirectionSearch(await strategyDigest(bounded.payload)===item.digest&&same(bounded.record,item.record),'Candidate source content does not match its exact digest.');return item;
}
function freshIdentities(admission:ProgramDirectionSearchPlanAdmission){
 const previous=new Set(admission.candidates.flatMap(candidate=>[candidate.source.id,candidate.source.rootId,candidate.source.requestId])),fresh=[admission.id,admission.train.dataset.id,admission.test.datasetId,admission.test.attemptId,admission.test.requestId,...admission.candidates.flatMap(candidate=>[candidate.attemptId,candidate.requestId])];
 for(const identity of fresh)assertProgramDirectionSearch(uuid.safeParse(identity).success,'Program search identities require canonical UUIDs.',400);
 assertProgramDirectionSearch(new Set(fresh).size===fresh.length&&fresh.every(id=>!previous.has(id)),'Plan, dataset and operation identities must be distinct and fresh.');
}
/** Exact cold-run input construction without importing the executable runner. */
async function prepareProgramRunInput(source:{record:StrategyRecordV2;digest:string},dataset:DemoDataset,fields:Pick<ProgramRunInput,'requestId'|'initialCapital'|'hypothesis'|'falsification'|'emergencyStopAt'>):Promise<ProgramRunInput>{
 guardProgramData(source,524288);guardProgramData(dataset,524288);guardProgramData(fields,524288);
 const {input}=boundedProgramRunInput({version:1,kind:'LOCAL_PROGRAM_RUN_INPUT',...fields,strategy:source,dataset,methodDigest:await digest(programRunMethod)});await verifyProgramRunInput(input);return input;
}
async function input(plan:ProgramDirectionSearchPlan,candidateId:string,phase:'TRAIN'|'TEST',data?:ProgramDirectionSearchTestInput):Promise<ProgramRunInput>{
 const candidate=plan.admission.candidates.find(candidate=>candidate.source.id===candidateId);assertProgramDirectionSearch(!!candidate?.source.record&&candidate.source.record.version===2,'The exact frozen program candidate is required.');
 const supplied=phase==='TRAIN'?plan.admission.train:data;assertProgramDirectionSearch(!!supplied,'The exact phase dataset is required.');
 return prepareProgramRunInput({record:candidate.source.record,digest:candidate.source.digest},supplied.dataset,{requestId:phase==='TRAIN'?candidate.requestId:plan.admission.test.requestId,initialCapital:plan.admission.initialCapital,hypothesis:plan.admission.hypothesis,falsification:plan.admission.falsification,emergencyStopAt:null});
}
/** Freeze only TRAIN observations; the later TEST header contains no prices/signals. */
export async function createProgramDirectionSearchPlan(raw:unknown):Promise<ProgramDirectionSearchPlan>{
 assertProgramDirectionSearch(Object.values(programDirectionSourceFingerprints).every(value=>/^[a-f0-9]{64}$/.test(value)&&!/^0+$/.test(value)),'Direction selection physical identities are unprepared.');
 const admission=parsed(raw,programDirectionSearchAdmissionSchema,programDirectionSearchLimits.admissionBytes);freshIdentities(admission);
 assertProgramDirectionSearch(new Set(admission.candidates.map(candidate=>candidate.source.id)).size===admission.candidates.length&&new Set(admission.candidates.map(candidate=>candidate.source.digest)).size===admission.candidates.length,'Candidate versions must be distinct.');
 for(const candidate of admission.candidates)candidate.source=await source(candidate.source,admission.createdAt);
 const definition=admission.candidates[0].source.record!.content.definition,protocol=protocolSchema.parse({market:definition.market,risk:definition.risk,costs:definition.costs,initialCapital:admission.initialCapital});
 for(const candidate of admission.candidates){const d=candidate.source.record!.content.definition;assertProgramDirectionSearch(same(d.market,protocol.market)&&same(d.risk,protocol.risk)&&same(d.costs,protocol.costs),'All candidates must retain the same market, costs and risk protocol.');}
 const last=admission.train.dataset.bars.at(-1)!.closedAt,step=demoTimeframes[protocol.market.timeframe];
 assertProgramDirectionSearch(admission.createdAt>=last,'Plan time precedes supplied TRAIN observations.');
 assertProgramDirectionSearch(Date.parse(admission.test.firstClosedAt)===Date.parse(last)+(admission.test.gapBars+1)*step,'The TEST interval must follow TRAIN and the declared gap.');
 assertProgramDirectionSearch((admission.test.provenance==='SYNTHETIC')===(admission.test.permission==='CREATED_SYNTHETIC'),'TEST provenance and permission must agree.');
 assertProgramDirectionSearch(Number.isFinite(new Date(Date.parse(admission.test.firstClosedAt)+(admission.test.barCount-1)*step).getTime()),'TEST interval exceeds its clock bounds.');
 const base={version:2 as const,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_PLAN' as const,id:admission.id,createdAt:admission.createdAt,...flags,admission,protocol,implementations:implementations(),selectionPolicy:programDirectionSearchPolicy,selectionMethodDigest:await digest(programDirectionSearchPolicy),methodDigest:await digest(programRunMethod),tradingMethodDigest:await digest(demoEvaluatorMethod),trainInputs:[] as ProgramDirectionSearchPlan['trainInputs']};
 for(const candidate of admission.candidates){const admitted=await input(base as ProgramDirectionSearchPlan,candidate.source.id,'TRAIN');base.trainInputs.push({candidateId:candidate.source.id,attemptId:candidate.attemptId,requestId:candidate.requestId,inputDigest:await digest(admitted)});}
 const body=planBody.parse(base),plan=programDirectionSearchPlanSchema.parse({...body,planDigest:await digest(body)});boundedProgramDirectionSearchValue(plan,programDirectionSearchLimits.planBytes);return plan;
}
/** Declared correlations and current method identity, never authentic/unseen custody. */
export async function verifyProgramDirectionSearchPlan(raw:unknown):Promise<ProgramDirectionSearchPlan>{const plan=parsed(raw,programDirectionSearchPlanSchema,programDirectionSearchLimits.planBytes),derived=await createProgramDirectionSearchPlan(plan.admission);assertProgramDirectionSearch(same(plan,derived),'The frozen program plan, protocol or TRAIN identities changed.');return plan;}
function stateValid(attempt:ProgramDirectionSearchAttempt){
 assertProgramDirectionSearch(attempt.status==='RUNNING'?attempt.finishedAt===null&&attempt.reason===null&&attempt.outcome===null&&attempt.reconstruction===null&&attempt.generatorComparison===null&&attempt.certificate===null:attempt.finishedAt!==null&&attempt.finishedAt>=attempt.startedAt,'Attempt disposition and clocks are inconsistent.');
 if(attempt.status==='EVALUATED')assertProgramDirectionSearch(attempt.reason===null&&!!attempt.outcome&&!!attempt.generatorComparison&&!!attempt.certificate,'An evaluated attempt requires complete retained program results.');
 if(attempt.status==='INTERRUPTED')assertProgramDirectionSearch(attempt.reason==='USER_CANCELLED'||attempt.reason==='RECOVERY_INTERRUPTED','Interruption requires its explicit disposition.');
 if(attempt.status==='UNAVAILABLE')assertProgramDirectionSearch(attempt.reason==='EVALUATOR_FAILURE'||attempt.reason==='RESULT_LIMIT','Unavailable computation requires an explicit disposition.');
 assertProgramDirectionSearch(!attempt.generatorComparison||!!attempt.outcome,'Generator comparison requires its retained original outcome.');
 assertProgramDirectionSearch(!attempt.reconstruction||!!attempt.generatorComparison,'A fresh outcome requires its retained generator comparison.');
}
export async function sealProgramDirectionSearchAttempt(raw:z.infer<typeof attemptBody>):Promise<ProgramDirectionSearchAttempt>{const body=attemptBody.parse(raw),attempt=programDirectionSearchAttemptSchema.parse({...body,attemptDigest:await digest(body)});stateValid(attempt);boundedProgramDirectionSearchValue(attempt,programDirectionSearchLimits.attemptBytes);return attempt;}
function testData(plan:ProgramDirectionSearchPlan,raw:unknown):ProgramDirectionSearchTestInput{
 const supplied=parsed(raw,programDirectionSearchTestInputSchema,programDirectionSearchLimits.testInputBytes),expected=plan.admission.test,dataset=supplied.dataset;
 assertProgramDirectionSearch(dataset.id===expected.datasetId&&dataset.provenance===expected.provenance&&dataset.rights.permission===expected.permission&&dataset.bars.length===expected.barCount&&dataset.bars[0].closedAt===expected.firstClosedAt,'TEST must retain its exact prefrozen dataset interval and rights.');
 assertProgramDirectionSearch(dataset.symbol===plan.protocol.market.symbol&&dataset.timeframe===plan.protocol.market.timeframe,'TEST must retain the common market.');return supplied;
}
type CheckedSearchPlan={plan:ProgramDirectionSearchPlan;payload:string};
/** A proof is scoped to one ledger call and exact canonical bytes; never caller supplied. */
async function verifySearchAttempt(raw:unknown,checked?:CheckedSearchPlan):Promise<ProgramDirectionSearchAttempt>{
 const attempt=parsed(raw,programDirectionSearchAttemptSchema,programDirectionSearchLimits.attemptBytes),{attemptDigest,...body}=attempt;assertProgramDirectionSearch(await digest(body)===attemptDigest,'Attempt digest is inconsistent.');
 if(checked)assertProgramDirectionSearch(JSON.stringify(attempt.plan)===checked.payload,'Attempt belongs to another frozen plan.');
 const plan=checked?.plan??await verifyProgramDirectionSearchPlan(attempt.plan),candidate=plan.admission.candidates.find(candidate=>candidate.source.id===attempt.candidateId);assertProgramDirectionSearch(!!candidate,'Attempt candidate is outside the frozen set.');
 const ids=attempt.phase==='TRAIN'?candidate:plan.admission.test;
 assertProgramDirectionSearch(attempt.attemptId===ids.attemptId&&attempt.requestId===ids.requestId&&attempt.startedAt>=plan.createdAt,'Attempt identity or admission time changed.');stateValid(attempt);
 assertProgramDirectionSearch(attempt.startedAt>=attempt.input.dataset.bars.at(-1)!.closedAt,'Attempt admission precedes its claimed observations.');
 const supplied=attempt.phase==='TEST'?testData(plan,{dataset:attempt.input.dataset}):undefined,expected=await input(plan,attempt.candidateId,attempt.phase,supplied);
 await verifyProgramRunInput(attempt.input);assertProgramDirectionSearch(same(expected,attempt.input)&&await digest(expected)===attempt.inputDigest,'Program attempt input changed from the frozen protocol.');
 if(attempt.phase==='TRAIN')assertProgramDirectionSearch(plan.trainInputs.find(binding=>binding.candidateId===attempt.candidateId)?.inputDigest===attempt.inputDigest,'TRAIN binding changed.');
 if(attempt.outcome){const outcome=await validateProgramRunOutcome(attempt.outcome,attempt.input);assertProgramDirectionSearch(outcome.attemptId===attempt.attemptId&&outcome.inputDigest===attempt.inputDigest&&outcome.digests.source===candidate.source.digest&&same(outcome.implementations,plan.implementations.program),'Program outcome is not bound to its exact admitted source and input.');}
 if(attempt.generatorComparison){
  const report=await bindProgramComparisonReport(attempt.generatorComparison,attempt.outcome!);
  if(attempt.reconstruction){
   const reconstructed=await validateProgramRunOutcome(attempt.reconstruction,attempt.input);
   assertProgramDirectionSearch(reconstructed.attemptId===attempt.attemptId&&reconstructed.inputDigest===attempt.inputDigest&&reconstructed.outcomeDigest===report.reconstructedOutcomeDigest&&same(programOutcomeComparisonSummary(reconstructed),report.reconstructed),'Fresh reconstruction changed its exact original attempt or comparison identity.');
   if(report.comparison)assertProgramDirectionSearch(same(await compareProgramOutcomeValues(attempt.outcome!,reconstructed),report.comparison),'Generator comparison contradicts the complete retained original and fresh outcomes.');
  }else assertProgramDirectionSearch(report.reconstructed===null&&report.reconstructedOutcomeDigest===null,'A complete fresh program outcome cannot be omitted.');
 }
 if(attempt.certificate)await verifyProgramDirectionEconomicCertificate(attempt.certificate,attempt);
 return attempt;
}
export async function verifyProgramDirectionSearchAttempt(raw:unknown):Promise<ProgramDirectionSearchAttempt>{return verifySearchAttempt(raw);}
async function initialAttempt(plan:ProgramDirectionSearchPlan,phase:'TRAIN'|'TEST',candidateId:string,startedAt:string,data?:ProgramDirectionSearchTestInput){
 clock.parse(startedAt);assertProgramDirectionSearch(startedAt>=plan.createdAt,'Attempt clock precedes the frozen plan.');const candidate=plan.admission.candidates.find(candidate=>candidate.source.id===candidateId);assertProgramDirectionSearch(!!candidate,'Exact frozen candidate required.');
 const ids=phase==='TRAIN'?candidate:plan.admission.test,admitted=await input(plan,candidateId,phase,data);assertProgramDirectionSearch(startedAt>=admitted.dataset.bars.at(-1)!.closedAt,'Attempt admission precedes its claimed observations.');
 return sealProgramDirectionSearchAttempt({version:2,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_ATTEMPT',...flags,plan,phase,candidateId,attemptId:ids.attemptId,requestId:ids.requestId,input:admitted,inputDigest:await digest(admitted),startedAt,finishedAt:null,status:'RUNNING',reason:null,outcome:null,reconstruction:null,generatorComparison:null,certificate:null});
}
export const programDirectionSearchAdmissionBody=(attempt:ProgramDirectionSearchAttempt)=>{const {attemptDigest:_,...body}=attempt;void _;return {...body,finishedAt:null,status:'RUNNING' as const,reason:null,outcome:null,reconstruction:null,generatorComparison:null,certificate:null};};
async function admissionDigest(attempt:ProgramDirectionSearchAttempt){return digest(attemptBody.parse(programDirectionSearchAdmissionBody(attempt)));}
async function event(previous:ProgramDirectionSearchLedger['events'],type:ProgramDirectionSearchLedger['events'][number]['type'],at:string,attemptId:string|null,recordDigest:string){const body=eventBody.parse({sequence:previous.length+1,at,type,attemptId,recordDigest,previous:previous.at(-1)?.digest??null});assertProgramDirectionSearch(!previous.length||at>=previous.at(-1)!.at,'Program search event clock regressed.');return eventSchema.parse({...body,digest:await digest(body)});}
async function sealLedger(raw:z.infer<typeof ledgerBody>|ProgramDirectionSearchLedger):Promise<ProgramDirectionSearchLedger>{const {ledgerDigest:_,...candidate}=raw as ProgramDirectionSearchLedger;void _;const body=ledgerBody.parse(candidate),ledger=programDirectionSearchLedgerSchema.parse({...body,ledgerDigest:await digest(body)});boundedProgramDirectionSearchValue(ledger,programDirectionSearchLimits.ledgerBytes);return ledger;}
function ranking(attempt:ProgramDirectionSearchAttempt,rule:ProgramDirectionSearchPlanAdmission['selection']){
 const reasons:(typeof eligibilityReasons[number])[]=[];
 if(attempt.status==='INTERRUPTED')reasons.push('ATTEMPT_INTERRUPTED');if(attempt.status==='UNAVAILABLE')reasons.push('ATTEMPT_UNAVAILABLE');
 if(attempt.outcome?.status!=='COMPLETED')reasons.push('PROGRAM_STATUS');
 if(!attempt.generatorComparison)reasons.push('GENERATOR_COMPARISON_UNAVAILABLE');else if(attempt.generatorComparison.status!=='MATCH')reasons.push('GENERATOR_COMPARISON_MISMATCH');
 const artifact=attempt.outcome?.artifact,comparison=attempt.outcome?.comparison;
 if(artifact?.status!=='COMPLETED')reasons.push('ARTIFACT_STATUS');if(!comparison)reasons.push('COMPARISON_UNAVAILABLE');else if(comparison.status!=='MATCH')reasons.push('COMPARISON_MISMATCH');
 if(!attempt.certificate)reasons.push('CERTIFICATE_UNAVAILABLE');else if(attempt.certificate.status!=='MATCH')reasons.push('CERTIFICATE_MISMATCH');
 const metrics=artifact?.metrics;if(!metrics)reasons.push('METRICS_UNAVAILABLE');else{if(metrics.trades<rule.minTrades)reasons.push('TRADE_FLOOR');if(metrics.returnPct<rule.minReturnPct)reasons.push('RETURN_FLOOR');if(metrics.maxDrawdownPct>rule.maxDrawdownPct)reasons.push('DRAWDOWN_LIMIT');}
 return {candidateId:attempt.candidateId,attemptDigest:attempt.attemptDigest,eligible:reasons.length===0,reasons,returnPct:metrics?.returnPct??null};
}
async function selection(plan:ProgramDirectionSearchPlan,attempts:ProgramDirectionSearchAttempt[],lockedAt:string):Promise<ProgramDirectionSearchSelection>{
 clock.parse(lockedAt);assertProgramDirectionSearch(attempts.length===plan.admission.candidates.length&&attempts.every(attempt=>attempt.phase==='TRAIN'&&attempt.status!=='RUNNING'&&attempt.finishedAt!==null&&attempt.finishedAt<=lockedAt),'Every frozen TRAIN candidate must have a terminal disposition before selection.');
 const ranks=attempts.map(attempt=>ranking(attempt,plan.admission.selection)),remaining=ranks.map((rank,ordinal)=>({...rank,ordinal})).filter(rank=>rank.eligible),eligibleOrder:string[]=[];
 while(remaining.length){const maximum=Math.max(...remaining.map(rank=>rank.returnPct!)),band=remaining.filter(rank=>maximum-rank.returnPct!<=plan.admission.selection.tieTolerancePct).sort((left,right)=>left.ordinal-right.ordinal);for(const rank of band){eligibleOrder.push(rank.candidateId);remaining.splice(remaining.findIndex(value=>value.candidateId===rank.candidateId),1);}}
 const body=selectionBody.parse({planDigest:plan.planDigest,decision:eligibleOrder.length?'SELECTED':'NO_SELECTION',selectedCandidateId:eligibleOrder[0]??null,lockedAt,trainingResultSetDigest:await digest(attempts.map(attempt=>({candidateId:attempt.candidateId,attemptId:attempt.attemptId,attemptDigest:attempt.attemptDigest}))),ranking:ranks,eligibleOrder});return selectionSchema.parse({...body,selectionDigest:await digest(body)});
}
/** Checks complete chronological correlations, not execution/authenticated custody. */
export async function verifyProgramDirectionSearchLedger(raw:unknown):Promise<ProgramDirectionSearchLedger>{
 const ledger=parsed(raw,programDirectionSearchLedgerSchema,programDirectionSearchLimits.ledgerBytes),{ledgerDigest,...body}=ledger;assertProgramDirectionSearch(await digest(body)===ledgerDigest,'Ledger digest is inconsistent.');const plan=await verifyProgramDirectionSearchPlan(ledger.plan);assertProgramDirectionSearch(ledger.id===plan.id,'Ledger identity changed.');
 const train:ProgramDirectionSearchAttempt[]=[],test:ProgramDirectionSearchAttempt[]=[],checked={plan,payload:JSON.stringify(plan)};
 for(const rawAttempt of ledger.attempts){const attempt=await verifySearchAttempt(rawAttempt,checked);if(attempt.phase==='TRAIN'){assertProgramDirectionSearch(test.length===0&&train.length<plan.admission.candidates.length&&attempt.candidateId===plan.admission.candidates[train.length].source.id,'TRAIN must follow frozen candidate order exactly once.');train.push(attempt);}else test.push(attempt);}
 assertProgramDirectionSearch(test.length<=1&&ledger.attempts.filter(attempt=>attempt.status==='RUNNING').length<=1&&ledger.attempts.every((attempt,n)=>attempt.status!=='RUNNING'||n===ledger.attempts.length-1),'Only the final admitted attempt may be pending.');
 if(ledger.selection)assertProgramDirectionSearch(same(await selection(plan,train,ledger.selection.lockedAt),ledger.selection),'Selection changed from the complete TRAIN result set.');
 assertProgramDirectionSearch(!test.length||ledger.selection?.decision==='SELECTED'&&test[0].candidateId===ledger.selection.selectedCandidateId&&test[0].startedAt>=ledger.selection.lockedAt,'A sole TEST must follow its selected frozen winner.');
 const expectedEvents:ProgramDirectionSearchLedger['events']=[];expectedEvents.push(await event(expectedEvents,'PLAN_FROZEN',plan.createdAt,null,plan.planDigest));
 for(const attempt of train){expectedEvents.push(await event(expectedEvents,'TRAIN_ADMITTED',attempt.startedAt,attempt.attemptId,await admissionDigest(attempt)));if(attempt.status!=='RUNNING')expectedEvents.push(await event(expectedEvents,'ATTEMPT_FINISHED',attempt.finishedAt!,attempt.attemptId,attempt.attemptDigest));}
 if(ledger.selection)expectedEvents.push(await event(expectedEvents,'SELECTION_LOCKED',ledger.selection.lockedAt,null,ledger.selection.selectionDigest));
 for(const attempt of test){expectedEvents.push(await event(expectedEvents,'TEST_ADMITTED',attempt.startedAt,attempt.attemptId,await admissionDigest(attempt)));if(attempt.status!=='RUNNING')expectedEvents.push(await event(expectedEvents,'ATTEMPT_FINISHED',attempt.finishedAt!,attempt.attemptId,attempt.attemptDigest));}
 assertProgramDirectionSearch(same(ledger.events,expectedEvents),'Ledger events do not retain the complete ordered history.');reserve(ledger);return ledger;
}
function reserve(ledger:ProgramDirectionSearchLedger){
 const total=ledger.plan.admission.candidates.length+1,base=bytes({...ledger,attempts:[],ledgerDigest:'f'.repeat(64)}),retained=ledger.attempts.reduce((sum,attempt)=>sum+Math.max(programDirectionSearchLimits.attemptBytes,bytes(attempt)),0),remaining=(total-ledger.attempts.length)*programDirectionSearchLimits.attemptBytes;
 assertProgramDirectionSearch(base+retained+remaining+65536<=programDirectionSearchLimits.ledgerBytes,'Capacity cannot retain every whole program candidate and sole TEST.',413);
}
export async function createProgramDirectionSearchLedger(rawPlan:unknown):Promise<ProgramDirectionSearchLedger>{const plan=await verifyProgramDirectionSearchPlan(rawPlan),ledger=await sealLedger({version:2,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_LEDGER',id:plan.id,...flags,plan,attempts:[],selection:null,events:[await event([],'PLAN_FROZEN',plan.createdAt,null,plan.planDigest)]});reserve(ledger);return ledger;}
export function pendingProgramDirectionSearchAttempt(ledger:ProgramDirectionSearchLedger):ProgramDirectionSearchAttempt|null{return ledger.attempts.find(attempt=>attempt.status==='RUNNING')??null;}
function nextClock(ledger:ProgramDirectionSearchLedger,at:string){clock.parse(at);assertProgramDirectionSearch(at>=(ledger.events.at(-1)?.at??ledger.plan.createdAt),'Program search operation clock regressed.');}
export async function admitProgramDirectionSearchTrain(raw:unknown,candidateId:string,startedAt:string):Promise<ProgramDirectionSearchLedger>{const ledger=await verifyProgramDirectionSearchLedger(raw);nextClock(ledger,startedAt);assertProgramDirectionSearch(!ledger.selection&&!pendingProgramDirectionSearchAttempt(ledger),'Finish the pending TRAIN or preserve its interruption before advancing.');const next=ledger.plan.admission.candidates[ledger.attempts.length];assertProgramDirectionSearch(!!next&&next.source.id===candidateId,'Admit exactly the next frozen TRAIN candidate once.');reserve(ledger);const attempt=await initialAttempt(ledger.plan,'TRAIN',candidateId,startedAt);return sealLedger({...ledger,attempts:[...ledger.attempts,attempt],events:[...ledger.events,await event(ledger.events,'TRAIN_ADMITTED',startedAt,attempt.attemptId,attempt.attemptDigest)]});}
export async function verifyProgramDirectionSearchTestInput(rawLedger:unknown,raw:unknown):Promise<ProgramDirectionSearchTestInput>{const ledger=await verifyProgramDirectionSearchLedger(rawLedger);assertProgramDirectionSearch(ledger.selection?.decision==='SELECTED'&&!!ledger.selection.selectedCandidateId&&!pendingProgramDirectionSearchAttempt(ledger)&&!ledger.attempts.some(attempt=>attempt.phase==='TEST'),'A locked winner and unused sole TEST admission are required.');const supplied=testData(ledger.plan,raw);await input(ledger.plan,ledger.selection.selectedCandidateId,'TEST',supplied);return supplied;}
export async function admitProgramDirectionSearchTest(raw:unknown,rawInput:unknown,startedAt:string):Promise<ProgramDirectionSearchLedger>{const ledger=await verifyProgramDirectionSearchLedger(raw);nextClock(ledger,startedAt);const supplied=await verifyProgramDirectionSearchTestInput(ledger,rawInput);reserve(ledger);const attempt=await initialAttempt(ledger.plan,'TEST',ledger.selection!.selectedCandidateId!,startedAt,supplied);return sealLedger({...ledger,attempts:[...ledger.attempts,attempt],events:[...ledger.events,await event(ledger.events,'TEST_ADMITTED',startedAt,attempt.attemptId,attempt.attemptDigest)]});}
export async function lockProgramDirectionSearchSelection(raw:unknown,lockedAt:string):Promise<ProgramDirectionSearchLedger>{const ledger=await verifyProgramDirectionSearchLedger(raw);nextClock(ledger,lockedAt);assertProgramDirectionSearch(!ledger.selection&&!pendingProgramDirectionSearchAttempt(ledger),'A selection cannot replace an existing lock or pending attempt.');const locked=await selection(ledger.plan,ledger.attempts,lockedAt);return sealLedger({...ledger,selection:locked,events:[...ledger.events,await event(ledger.events,'SELECTION_LOCKED',lockedAt,null,locked.selectionDigest)]});}
/** Pure complete-history arithmetic check. It does not run a strategy or establish market validity. */
export function programDirectionEconomicConsistency(result:z.infer<typeof referenceResultSchema>|null,input:ProgramRunInput):z.infer<typeof economicCheckSchema>{
 if(!result?.metrics)return {status:'UNAVAILABLE',reasons:['METRICS_UNAVAILABLE']};
 const reasons=new Set<z.infer<typeof economicCheckSchema>['reasons'][number]>(),near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8+1e-9*Math.max(Math.abs(a),Math.abs(b)),add=(reason:z.infer<typeof economicCheckSchema>['reasons'][number],ok:boolean)=>{if(!ok)reasons.add(reason);};
 const definition=input.strategy.record.content.definition,sign=definition.market.direction==='LONG'?1:-1,fee=definition.costs.feeBps/10000,slip=definition.costs.slippageBps/10000,bars=input.dataset.bars,metrics=result.metrics;
 try{
  const ids=new Set<string>();for(const trade of result.trades){
   add('DIRECTION',trade.direction===definition.market.direction);add('TRADE_IDENTITIES',!ids.has(trade.id)&&trade.entryBar<=trade.exitBar&&trade.entryBar<bars.length&&trade.exitBar<bars.length&&trade.entryAt<=trade.exitAt);ids.add(trade.id);
   add('TRADE_ACCOUNTING',near(trade.collateral,trade.quantity*trade.entryPrice)&&near(trade.grossPnl,sign*trade.quantity*(trade.exitPrice-trade.entryPrice))&&near(trade.netPnl,trade.grossPnl-trade.entryFee-trade.exitFee));
   add('TRADE_COSTS',near(trade.entryFee,trade.collateral*fee)&&near(trade.exitFee,trade.quantity*trade.exitPrice*fee));
  }
  const final=result.equity.at(-1)?.equity??input.initialCapital;let peak=input.initialCapital,drawdown=0;for(const point of result.equity){peak=Math.max(peak,point.equity);drawdown=Math.max(drawdown,100*(peak-point.equity)/peak);add('HISTORY_COMPLETENESS',point.barIndex<bars.length&&point.closedAt===bars[point.barIndex]?.closedAt);}
  add('METRIC_ACCOUNTING',near(metrics.initialCapital,input.initialCapital)&&near(metrics.finalEquity,final)&&near(metrics.netPnl,final-input.initialCapital)&&near(metrics.returnPct,100*(final/input.initialCapital-1))&&near(metrics.maxDrawdownPct,drawdown)&&metrics.trades===result.trades.length&&metrics.wins===result.trades.filter(t=>t.netPnl>0).length&&metrics.losses===result.trades.filter(t=>t.netPnl<0).length);
  // Successful cold executions liquidate only at the declared end; every intermediate open obligation is recovered from the complete final trade history.
  if(result.status==='COMPLETED'||result.status==='NO_TRADES'){
   add('HISTORY_COMPLETENESS',result.equity.length===bars.length&&result.equity.every((p,n)=>p.barIndex===n)&&result.equity.at(-1)?.openPositions===0);
   add('METRIC_ACCOUNTING',near(final,input.initialCapital+result.trades.reduce((n,t)=>n+t.netPnl,0))&&near(metrics.totalFees,result.trades.reduce((n,t)=>n+t.entryFee+t.exitFee,0))&&near(metrics.turnover,result.trades.reduce((n,t)=>n+t.quantity*(t.entryPrice+t.exitPrice),0)));
   for(const point of result.equity){const active=result.trades.filter(t=>t.entryBar<=point.barIndex&&t.exitBar>point.barIndex),closed=result.trades.filter(t=>t.exitBar<=point.barIndex),reserved=active.reduce((n,t)=>n+t.collateral,0),cash=input.initialCapital+closed.reduce((n,t)=>n+t.netPnl,0)-active.reduce((n,t)=>n+t.collateral+t.entryFee,0),price=bars[point.barIndex]?.close*(1-slip*sign),equity=cash+reserved+active.reduce((n,t)=>n+sign*t.quantity*(price-t.entryPrice)-t.quantity*price*fee,0);add('EQUITY_ACCOUNTING',point.openPositions===active.length&&near(point.reservedCollateral,reserved)&&near(point.cash,cash)&&near(point.equity,equity));}
  }
 }catch{reasons.add('NUMERICAL_LIMIT');}
 return {status:reasons.size?'INVALID':'VALID',reasons:[...reasons]};
}
export function programDirectionPrimaryProjection(attempt:ProgramDirectionSearchAttempt){const artifact=attempt.outcome?.artifact;if(!artifact)return null;return referenceResultSchema.parse({status:artifact.status,reason:artifact.reason,audit:artifact.audit.map(({details,...row})=>{void details;return row;}),trades:artifact.trades,equity:artifact.equity,metrics:artifact.metrics,benchmark:artifact.benchmark});}
async function certificateIdentityFor(attempt:ProgramDirectionSearchAttempt):Promise<z.infer<typeof certificateIdentity>>{const outcome=attempt.outcome;assertProgramDirectionSearch(!!outcome,'A retained original outcome is required for a direction certificate.');return {attemptId:attempt.attemptId,input:attempt.inputDigest,outcome:outcome.outcomeDigest,reconstruction:attempt.reconstruction?.outcomeDigest??null,generatorComparison:attempt.generatorComparison?.reportDigest??null,tradingArtifact:outcome.artifact?.resultDigest??null,tradingComparison:outcome.comparison?.reportDigest??null,tradingRequest:outcome.artifact?.digests.request??null,source:attempt.input.strategy.digest,module:attempt.input.strategy.record.content.program.digest,dataset:await digest(attempt.input.dataset),signals:outcome.demoRequest?await digest(outcome.demoRequest.signals):null,policy:attempt.plan.selectionMethodDigest};}
/** The local runner supplies an actual whole fixed-code reference result. This pure constructor is never an execution attestation. */
export async function createProgramDirectionEconomicCertificate(attempt:ProgramDirectionSearchAttempt,referenceRaw:unknown=null,unavailableReason:'MISSING_TRADING_INPUT'|'REFERENCE_FAILED'='MISSING_TRADING_INPUT'):Promise<ProgramDirectionEconomicCertificate>{
 const primary=programDirectionPrimaryProjection(attempt);let reference:z.infer<typeof referenceResultSchema>|null=null;
 if(referenceRaw!==null){boundedProgramDirectionSearchValue(referenceRaw,programDirectionSearchLimits.referenceBytes);reference=referenceResultSchema.parse(referenceRaw);assertProgramDirectionSearch(unchanged(referenceRaw,reference),'Reference result must retain exact canonical whole data.');}
 const comparison=primary&&reference?compareComparisonPair('CLAIM_REFERENCE',primary,reference) as ComparisonPair&{pair:'CLAIM_REFERENCE'}:null,economics={primary:programDirectionEconomicConsistency(primary,attempt.input),reference:programDirectionEconomicConsistency(reference,attempt.input)},complete=!!primary&&!!reference&&!!comparison;
 const body=certificateBody.parse({version:1,kind:'PROGRAM_DIRECTION_ECONOMIC_CERTIFICATE',...flags,status:complete?(comparison.matches&&economics.primary.status==='VALID'&&economics.reference.status==='VALID'?'MATCH':'MISMATCH'):'UNAVAILABLE',reason:complete?null:unavailableReason,identity:await certificateIdentityFor(attempt),reference,referenceDigest:reference?await digest(reference):null,comparison,economics});
 const value=programDirectionEconomicCertificateSchema.parse({...body,certificateDigest:await digest(body)});boundedProgramDirectionSearchValue(value,programDirectionSearchLimits.certificateBytes);return value;
}
export async function verifyProgramDirectionEconomicCertificate(raw:unknown,attempt:ProgramDirectionSearchAttempt){const value=parsed(raw,programDirectionEconomicCertificateSchema,programDirectionSearchLimits.certificateBytes),expected=await createProgramDirectionEconomicCertificate(attempt,value.reference,value.reason??'MISSING_TRADING_INPUT');assertProgramDirectionSearch(same(value,expected),'Direction certificate does not bind the complete retained trading history.');return value;}

export async function finishProgramDirectionSearchAttempt(raw:unknown,rawTerminal:unknown):Promise<ProgramDirectionSearchLedger>{const ledger=await verifyProgramDirectionSearchLedger(raw),terminal=await verifyProgramDirectionSearchAttempt(rawTerminal),index=ledger.attempts.findIndex(attempt=>attempt.attemptId===terminal.attemptId);assertProgramDirectionSearch(index>=0&&terminal.status!=='RUNNING','A retained admission and terminal disposition are required.');const original=ledger.attempts[index];if(original.status!=='RUNNING'){assertProgramDirectionSearch(same(original,terminal),'A retained terminal result cannot be replaced.');return ledger;}assertProgramDirectionSearch(index===ledger.attempts.length-1&&same(programDirectionSearchAdmissionBody(original),programDirectionSearchAdmissionBody(terminal)),'Terminal result changed its exact original admission.');nextClock(ledger,terminal.finishedAt!);const attempts=[...ledger.attempts];attempts[index]=terminal;return sealLedger({...ledger,attempts,events:[...ledger.events,await event(ledger.events,'ATTEMPT_FINISHED',terminal.finishedAt!,terminal.attemptId,terminal.attemptDigest)]});}
