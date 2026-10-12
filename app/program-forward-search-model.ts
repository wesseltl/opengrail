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

/** Inert copied identity contract: no execution imports. Separate method and limits: historical Search V1 stays byte-identical. */
export const programSearchLimits=Object.freeze({candidates:4,admissionBytes:1048576,planBytes:1048576,attemptBytes:23068672,ledgerBytes:134217728,testInputBytes:524288,events:16,maximumDepth:32,maximumNodes:6000000});
export class ProgramSearchError extends Error{constructor(message:string,public status=400){super(message);}}
const uuid=z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),hash=z.string().length(64).regex(/^[a-f0-9]{64}$/),clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value),finite=z.number().finite();
const labels={classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),unseen:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false)};
const flags={classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',unseen:'NOT_ESTABLISHED',ordersEnabled:false} as const;
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right),bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength,digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
function assertProgramSearch(ok:boolean,message:string,status=409):asserts ok{if(!ok)throw new ProgramSearchError(message,status);}
function credential(value:string){for(let n=0;n<32;n++){if(/og_(?:agent|local_(?:producer|owner))_/i.test(value))return true;const next=value.replace(/(?:%[a-f0-9]{2})+/gi,run=>{try{return decodeURIComponent(run);}catch{return run.replace(/%([a-f0-9]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16)));}});if(next===value)return false;value=next;}return true;}
const text=(maximum:number)=>z.string().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>value===value.trim()&&!credential(value));
/** Descriptor inspection precedes parsing or serialization; no supplied hooks run. */
function plain(raw:unknown,maximum:number){
 let count=0;const path=new Set<object>();
 function walk(value:unknown,depth:number):void{
  if(++count>programSearchLimits.maximumNodes||depth>programSearchLimits.maximumDepth)throw new ProgramSearchError('Program search structure exceeds its fixed budget.',413);
  if(typeof value==='string'){if(credential(value))throw new ProgramSearchError('Credentials cannot enter program search evidence.');return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(!value||typeof value!=='object'||path.has(value)||Object.getOwnPropertySymbols(value).length)throw new ProgramSearchError('Program search requires plain finite canonical JSON.');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new ProgramSearchError('Program search requires plain JSON containers.');
  if(array&&Object.keys(descriptors).length!==(value as unknown[]).length+1)throw new ProgramSearchError('Program search arrays must be complete.');
  path.add(value);
  for(const [key,descriptor]of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   if(credential(key)||!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=(value as unknown[]).length))throw new ProgramSearchError('Program search hooks, credentials and hidden fields are refused.');
   walk(descriptor.value,depth+1);
  }
  path.delete(value);
 }
 walk(raw,0);if(bytes(raw)>maximum)throw new ProgramSearchError('Program search material exceeds its byte budget.',413);
}
function unchanged(left:unknown,right:unknown):boolean{if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&unchanged(a[key],b[key]));}
function parsed<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T{plain(raw,maximum);try{const value=schema.parse(raw);assertProgramSearch(unchanged(raw,value),'Program search requires canonical unchanged material.',400);plain(value,maximum);return value;}catch(error){if(error instanceof ProgramSearchError)throw error;throw new ProgramSearchError('Program search material does not match its strict contract.');}}
const definitions=strategyDefinitionSchema.innerType().shape;
const protocolSchema=z.object({market:definitions.market,risk:definitions.risk,costs:definitions.costs,initialCapital:finite.min(.01).max(1000000)}).strict();
const selectionRuleSchema=z.object({objective:z.literal('MAX_RETURN_PCT'),minTrades:z.number().int().min(0).max(demoLimits.trades),maxDrawdownPct:finite.min(0).max(1000000),minReturnPct:finite.min(-1000000).max(1000000),tieTolerancePct:z.literal(.00000001),tieBreak:z.literal('CANDIDATE_ORDER')}).strict();
export const programSearchTestInputSchema=z.object({dataset:demoDatasetSchema}).strict();
export type ProgramSearchTestInput=z.infer<typeof programSearchTestInputSchema>;
export const programSearchAdmissionSchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_SEARCH_ADMISSION'),id:uuid,createdAt:clock,candidates:z.array(z.object({source:strategyPublicItemSchema,attemptId:uuid,requestId:uuid}).strict()).min(2).max(4),train:programSearchTestInputSchema,test:z.object({datasetId:uuid,firstClosedAt:clock,barCount:z.number().int().min(2).max(demoLimits.bars),gapBars:z.number().int().min(0).max(demoLimits.bars),provenance:z.enum(['SYNTHETIC','USER_SUPPLIED']),permission:z.enum(['CREATED_SYNTHETIC','AUTHORIZED_USE']),attemptId:uuid,requestId:uuid}).strict(),initialCapital:finite.min(.01).max(1000000),hypothesis:text(2000),falsification:text(2000),selection:selectionRuleSchema}).strict();
export type ProgramSearchPlanAdmission=z.infer<typeof programSearchAdmissionSchema>;
const implementationsSchema=z.object({primary:z.object({version:z.literal(demoEvaluatorVersion),sourceSha256:hash}).strict(),reference:z.object({version:z.literal('opengrail-reference-v1'),sourceSha256:hash}).strict(),program:programImplementationSchema}).strict();
const implementations=()=>({primary:{version:demoEvaluatorVersion,sourceSha256:evaluatorSourceFingerprints.primary},reference:{version:'opengrail-reference-v1' as const,sourceSha256:evaluatorSourceFingerprints.reference},program:programSourceFingerprints});
const planBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_SEARCH_PLAN'),id:uuid,createdAt:clock,...labels,admission:programSearchAdmissionSchema,protocol:protocolSchema,implementations:implementationsSchema,methodDigest:hash,tradingMethodDigest:hash,trainInputs:z.array(z.object({candidateId:uuid,attemptId:uuid,requestId:uuid,inputDigest:hash}).strict()).min(2).max(4)}).strict();
export const programSearchPlanSchema=planBody.extend({planDigest:hash});
export type ProgramSearchPlan=z.infer<typeof programSearchPlanSchema>;
const attemptBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_SEARCH_ATTEMPT'),...labels,plan:programSearchPlanSchema,phase:z.enum(['TRAIN','TEST']),candidateId:uuid,attemptId:uuid,requestId:uuid,input:programRunInputSchema,inputDigest:hash,startedAt:clock,finishedAt:clock.nullable(),status:z.enum(['RUNNING','EVALUATED','INTERRUPTED','UNAVAILABLE']),reason:z.enum(['USER_CANCELLED','RECOVERY_INTERRUPTED','EVALUATOR_FAILURE','RESULT_LIMIT']).nullable(),outcome:programRunOutcomeSchema.nullable(),reconstruction:programRunOutcomeSchema.nullable(),generatorComparison:programComparisonReportSchema.nullable()}).strict();
export const programSearchAttemptSchema=attemptBody.extend({attemptDigest:hash});
export type ProgramSearchAttempt=z.infer<typeof programSearchAttemptSchema>;
const eligibilityReasons=['ATTEMPT_INTERRUPTED','ATTEMPT_UNAVAILABLE','PROGRAM_STATUS','GENERATOR_COMPARISON_UNAVAILABLE','GENERATOR_COMPARISON_MISMATCH','ARTIFACT_STATUS','COMPARISON_UNAVAILABLE','COMPARISON_MISMATCH','METRICS_UNAVAILABLE','NONCOMPARABLE','TRADE_FLOOR','RETURN_FLOOR','DRAWDOWN_LIMIT'] as const;
const selectionBody=z.object({planDigest:hash,decision:z.enum(['SELECTED','NO_SELECTION']),selectedCandidateId:uuid.nullable(),lockedAt:clock,trainingResultSetDigest:hash,ranking:z.array(z.object({candidateId:uuid,attemptDigest:hash,eligible:z.boolean(),reasons:z.array(z.enum(eligibilityReasons)).max(13),returnPct:finite.nullable()}).strict()).min(2).max(4),eligibleOrder:z.array(uuid).max(4)}).strict();
const selectionSchema=selectionBody.extend({selectionDigest:hash});
export type ProgramSearchSelection=z.infer<typeof selectionSchema>;
const eventBody=z.object({sequence:z.number().int().min(1).max(programSearchLimits.events),at:clock,type:z.enum(['PLAN_FROZEN','TRAIN_ADMITTED','TEST_ADMITTED','ATTEMPT_FINISHED','SELECTION_LOCKED']),attemptId:uuid.nullable(),recordDigest:hash,previous:hash.nullable()}).strict();
const eventSchema=eventBody.extend({digest:hash});
const ledgerBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_SEARCH_LEDGER'),id:uuid,...labels,plan:programSearchPlanSchema,attempts:z.array(programSearchAttemptSchema).max(5),selection:selectionSchema.nullable(),events:z.array(eventSchema).max(programSearchLimits.events)}).strict();
export const programSearchLedgerSchema=ledgerBody.extend({ledgerDigest:hash});
export type ProgramSearchLedger=z.infer<typeof programSearchLedgerSchema>;

async function source(raw:StrategyPublicItem,createdAt:string){
 const item=strategyPublicItemSchema.parse(raw);assertProgramSearch(item.state==='VISIBLE'&&!!item.record,'Every program candidate requires an exact visible source.');
 assertProgramSearch(item.record.version===2,'Mixed rule/program cohorts are unsupported; every candidate must be an exact V2 program source.',400);
 uuid.parse(item.id);uuid.parse(item.rootId);uuid.parse(item.requestId);clock.parse(item.createdAt);clock.parse(item.record.createdAt);if(item.author.kind==='AGENT')uuid.parse(item.author.id);
 assertProgramSearch(item.author.sponsorId.length===70&&item.author.id.length===(item.author.kind==='HUMAN'?70:36),'Candidate author identity is invalid.');
 assertProgramSearch(createdAt>=(item.moderation.at(-1)?.createdAt??item.createdAt),'Plan time precedes its captured source.');
 const bounded=boundedStrategyRecord(item.record);assertProgramSearch(await strategyDigest(bounded.payload)===item.digest&&same(bounded.record,item.record),'Candidate source content does not match its exact digest.');return item;
}
function freshIdentities(admission:ProgramSearchPlanAdmission){
 const previous=new Set(admission.candidates.flatMap(candidate=>[candidate.source.id,candidate.source.rootId,candidate.source.requestId])),fresh=[admission.id,admission.train.dataset.id,admission.test.datasetId,admission.test.attemptId,admission.test.requestId,...admission.candidates.flatMap(candidate=>[candidate.attemptId,candidate.requestId])];
 for(const identity of fresh)assertProgramSearch(uuid.safeParse(identity).success,'Program search identities require canonical UUIDs.',400);
 assertProgramSearch(new Set(fresh).size===fresh.length&&fresh.every(id=>!previous.has(id)),'Plan, dataset and operation identities must be distinct and fresh.');
}
/** Exact cold-run input construction without importing the executable runner. */
async function prepareProgramRunInput(source:{record:StrategyRecordV2;digest:string},dataset:DemoDataset,fields:Pick<ProgramRunInput,'requestId'|'initialCapital'|'hypothesis'|'falsification'|'emergencyStopAt'>):Promise<ProgramRunInput>{
 guardProgramData(source,524288);guardProgramData(dataset,524288);guardProgramData(fields,524288);
 const {input}=boundedProgramRunInput({version:1,kind:'LOCAL_PROGRAM_RUN_INPUT',...fields,strategy:source,dataset,methodDigest:await digest(programRunMethod)});await verifyProgramRunInput(input);return input;
}
async function input(plan:ProgramSearchPlan,candidateId:string,phase:'TRAIN'|'TEST',data?:ProgramSearchTestInput):Promise<ProgramRunInput>{
 const candidate=plan.admission.candidates.find(candidate=>candidate.source.id===candidateId);assertProgramSearch(!!candidate?.source.record&&candidate.source.record.version===2,'The exact frozen program candidate is required.');
 const supplied=phase==='TRAIN'?plan.admission.train:data;assertProgramSearch(!!supplied,'The exact phase dataset is required.');
 return prepareProgramRunInput({record:candidate.source.record,digest:candidate.source.digest},supplied.dataset,{requestId:phase==='TRAIN'?candidate.requestId:plan.admission.test.requestId,initialCapital:plan.admission.initialCapital,hypothesis:plan.admission.hypothesis,falsification:plan.admission.falsification,emergencyStopAt:null});
}
/** Freeze only TRAIN observations; the later TEST header contains no prices/signals. */
export async function createProgramSearchPlan(raw:unknown):Promise<ProgramSearchPlan>{
 const admission=parsed(raw,programSearchAdmissionSchema,programSearchLimits.admissionBytes);freshIdentities(admission);
 assertProgramSearch(new Set(admission.candidates.map(candidate=>candidate.source.id)).size===admission.candidates.length&&new Set(admission.candidates.map(candidate=>candidate.source.digest)).size===admission.candidates.length,'Candidate versions must be distinct.');
 for(const candidate of admission.candidates)candidate.source=await source(candidate.source,admission.createdAt);
 const definition=admission.candidates[0].source.record!.content.definition,protocol=protocolSchema.parse({market:definition.market,risk:definition.risk,costs:definition.costs,initialCapital:admission.initialCapital});
 for(const candidate of admission.candidates){const d=candidate.source.record!.content.definition;assertProgramSearch(same(d.market,protocol.market)&&same(d.risk,protocol.risk)&&same(d.costs,protocol.costs),'All candidates must retain the same market, costs and risk protocol.');}
 const last=admission.train.dataset.bars.at(-1)!.closedAt,step=demoTimeframes[protocol.market.timeframe];
 assertProgramSearch(admission.createdAt>=last,'Plan time precedes supplied TRAIN observations.');
 assertProgramSearch(Date.parse(admission.test.firstClosedAt)===Date.parse(last)+(admission.test.gapBars+1)*step,'The TEST interval must follow TRAIN and the declared gap.');
 assertProgramSearch((admission.test.provenance==='SYNTHETIC')===(admission.test.permission==='CREATED_SYNTHETIC'),'TEST provenance and permission must agree.');
 assertProgramSearch(Number.isFinite(new Date(Date.parse(admission.test.firstClosedAt)+(admission.test.barCount-1)*step).getTime()),'TEST interval exceeds its clock bounds.');
 const base={version:1 as const,kind:'LOCAL_PROGRAM_SEARCH_PLAN' as const,id:admission.id,createdAt:admission.createdAt,...flags,admission,protocol,implementations:implementations(),methodDigest:await digest(programRunMethod),tradingMethodDigest:await digest(demoEvaluatorMethod),trainInputs:[] as ProgramSearchPlan['trainInputs']};
 for(const candidate of admission.candidates){const admitted=await input(base as ProgramSearchPlan,candidate.source.id,'TRAIN');base.trainInputs.push({candidateId:candidate.source.id,attemptId:candidate.attemptId,requestId:candidate.requestId,inputDigest:await digest(admitted)});}
 const body=planBody.parse(base),plan=programSearchPlanSchema.parse({...body,planDigest:await digest(body)});plain(plan,programSearchLimits.planBytes);return plan;
}
/** Declared correlations and current method identity, never authentic/unseen custody. */
export async function verifyProgramSearchPlan(raw:unknown):Promise<ProgramSearchPlan>{const plan=parsed(raw,programSearchPlanSchema,programSearchLimits.planBytes),derived=await createProgramSearchPlan(plan.admission);assertProgramSearch(same(plan,derived),'The frozen program plan, protocol or TRAIN identities changed.');return plan;}
function stateValid(attempt:ProgramSearchAttempt){
 assertProgramSearch(attempt.status==='RUNNING'?attempt.finishedAt===null&&attempt.reason===null&&attempt.outcome===null&&attempt.reconstruction===null&&attempt.generatorComparison===null:attempt.finishedAt!==null&&attempt.finishedAt>=attempt.startedAt,'Attempt disposition and clocks are inconsistent.');
 if(attempt.status==='EVALUATED')assertProgramSearch(attempt.reason===null&&!!attempt.outcome&&!!attempt.generatorComparison,'An evaluated attempt requires complete retained program results.');
 if(attempt.status==='INTERRUPTED')assertProgramSearch(attempt.reason==='USER_CANCELLED'||attempt.reason==='RECOVERY_INTERRUPTED','Interruption requires its explicit disposition.');
 if(attempt.status==='UNAVAILABLE')assertProgramSearch(attempt.reason==='EVALUATOR_FAILURE'||attempt.reason==='RESULT_LIMIT','Unavailable computation requires an explicit disposition.');
 assertProgramSearch(!attempt.generatorComparison||!!attempt.outcome,'Generator comparison requires its retained original outcome.');
 assertProgramSearch(!attempt.reconstruction||!!attempt.generatorComparison,'A fresh outcome requires its retained generator comparison.');
}
async function sealAttempt(raw:z.infer<typeof attemptBody>):Promise<ProgramSearchAttempt>{const body=attemptBody.parse(raw),attempt=programSearchAttemptSchema.parse({...body,attemptDigest:await digest(body)});stateValid(attempt);plain(attempt,programSearchLimits.attemptBytes);return attempt;}
function testData(plan:ProgramSearchPlan,raw:unknown):ProgramSearchTestInput{
 const supplied=parsed(raw,programSearchTestInputSchema,programSearchLimits.testInputBytes),expected=plan.admission.test,dataset=supplied.dataset;
 assertProgramSearch(dataset.id===expected.datasetId&&dataset.provenance===expected.provenance&&dataset.rights.permission===expected.permission&&dataset.bars.length===expected.barCount&&dataset.bars[0].closedAt===expected.firstClosedAt,'TEST must retain its exact prefrozen dataset interval and rights.');
 assertProgramSearch(dataset.symbol===plan.protocol.market.symbol&&dataset.timeframe===plan.protocol.market.timeframe,'TEST must retain the common market.');return supplied;
}
type CheckedSearchPlan={plan:ProgramSearchPlan;payload:string};
/** A proof is scoped to one ledger call and exact canonical bytes; never caller supplied. */
async function verifySearchAttempt(raw:unknown,checked?:CheckedSearchPlan):Promise<ProgramSearchAttempt>{
 const attempt=parsed(raw,programSearchAttemptSchema,programSearchLimits.attemptBytes),{attemptDigest,...body}=attempt;assertProgramSearch(await digest(body)===attemptDigest,'Attempt digest is inconsistent.');
 if(checked)assertProgramSearch(JSON.stringify(attempt.plan)===checked.payload,'Attempt belongs to another frozen plan.');
 const plan=checked?.plan??await verifyProgramSearchPlan(attempt.plan),candidate=plan.admission.candidates.find(candidate=>candidate.source.id===attempt.candidateId);assertProgramSearch(!!candidate,'Attempt candidate is outside the frozen set.');
 const ids=attempt.phase==='TRAIN'?candidate:plan.admission.test;
 assertProgramSearch(attempt.attemptId===ids.attemptId&&attempt.requestId===ids.requestId&&attempt.startedAt>=plan.createdAt,'Attempt identity or admission time changed.');stateValid(attempt);
 assertProgramSearch(attempt.startedAt>=attempt.input.dataset.bars.at(-1)!.closedAt,'Attempt admission precedes its claimed observations.');
 const supplied=attempt.phase==='TEST'?testData(plan,{dataset:attempt.input.dataset}):undefined,expected=await input(plan,attempt.candidateId,attempt.phase,supplied);
 await verifyProgramRunInput(attempt.input);assertProgramSearch(same(expected,attempt.input)&&await digest(expected)===attempt.inputDigest,'Program attempt input changed from the frozen protocol.');
 if(attempt.phase==='TRAIN')assertProgramSearch(plan.trainInputs.find(binding=>binding.candidateId===attempt.candidateId)?.inputDigest===attempt.inputDigest,'TRAIN binding changed.');
 if(attempt.outcome){const outcome=await validateProgramRunOutcome(attempt.outcome,attempt.input);assertProgramSearch(outcome.attemptId===attempt.attemptId&&outcome.inputDigest===attempt.inputDigest&&outcome.digests.source===candidate.source.digest&&same(outcome.implementations,plan.implementations.program),'Program outcome is not bound to its exact admitted source and input.');}
 if(attempt.generatorComparison){
  const report=await bindProgramComparisonReport(attempt.generatorComparison,attempt.outcome!);
  if(attempt.reconstruction){
   const reconstructed=await validateProgramRunOutcome(attempt.reconstruction,attempt.input);
   assertProgramSearch(reconstructed.attemptId===attempt.attemptId&&reconstructed.inputDigest===attempt.inputDigest&&reconstructed.outcomeDigest===report.reconstructedOutcomeDigest&&same(programOutcomeComparisonSummary(reconstructed),report.reconstructed),'Fresh reconstruction changed its exact original attempt or comparison identity.');
   if(report.comparison)assertProgramSearch(same(await compareProgramOutcomeValues(attempt.outcome!,reconstructed),report.comparison),'Generator comparison contradicts the complete retained original and fresh outcomes.');
  }else assertProgramSearch(report.reconstructed===null&&report.reconstructedOutcomeDigest===null,'A complete fresh program outcome cannot be omitted.');
 }
 return attempt;
}
export async function verifyProgramSearchAttempt(raw:unknown):Promise<ProgramSearchAttempt>{return verifySearchAttempt(raw);}
async function initialAttempt(plan:ProgramSearchPlan,phase:'TRAIN'|'TEST',candidateId:string,startedAt:string,data?:ProgramSearchTestInput){
 clock.parse(startedAt);assertProgramSearch(startedAt>=plan.createdAt,'Attempt clock precedes the frozen plan.');const candidate=plan.admission.candidates.find(candidate=>candidate.source.id===candidateId);assertProgramSearch(!!candidate,'Exact frozen candidate required.');
 const ids=phase==='TRAIN'?candidate:plan.admission.test,admitted=await input(plan,candidateId,phase,data);assertProgramSearch(startedAt>=admitted.dataset.bars.at(-1)!.closedAt,'Attempt admission precedes its claimed observations.');
 return sealAttempt({version:1,kind:'LOCAL_PROGRAM_SEARCH_ATTEMPT',...flags,plan,phase,candidateId,attemptId:ids.attemptId,requestId:ids.requestId,input:admitted,inputDigest:await digest(admitted),startedAt,finishedAt:null,status:'RUNNING',reason:null,outcome:null,reconstruction:null,generatorComparison:null});
}
const admissionBody=(attempt:ProgramSearchAttempt)=>{const {attemptDigest:_,...body}=attempt;void _;return {...body,finishedAt:null,status:'RUNNING' as const,reason:null,outcome:null,reconstruction:null,generatorComparison:null};};
async function admissionDigest(attempt:ProgramSearchAttempt){return digest(attemptBody.parse(admissionBody(attempt)));}
async function event(previous:ProgramSearchLedger['events'],type:ProgramSearchLedger['events'][number]['type'],at:string,attemptId:string|null,recordDigest:string){const body=eventBody.parse({sequence:previous.length+1,at,type,attemptId,recordDigest,previous:previous.at(-1)?.digest??null});assertProgramSearch(!previous.length||at>=previous.at(-1)!.at,'Program search event clock regressed.');return eventSchema.parse({...body,digest:await digest(body)});}
async function sealLedger(raw:z.infer<typeof ledgerBody>|ProgramSearchLedger):Promise<ProgramSearchLedger>{const {ledgerDigest:_,...candidate}=raw as ProgramSearchLedger;void _;const body=ledgerBody.parse(candidate),ledger=programSearchLedgerSchema.parse({...body,ledgerDigest:await digest(body)});plain(ledger,programSearchLimits.ledgerBytes);return ledger;}
function ranking(attempt:ProgramSearchAttempt,rule:ProgramSearchPlanAdmission['selection']){
 const reasons:(typeof eligibilityReasons[number])[]=[];
 if(attempt.status==='INTERRUPTED')reasons.push('ATTEMPT_INTERRUPTED');if(attempt.status==='UNAVAILABLE')reasons.push('ATTEMPT_UNAVAILABLE');
 if(attempt.outcome?.status!=='COMPLETED')reasons.push('PROGRAM_STATUS');
 if(!attempt.generatorComparison)reasons.push('GENERATOR_COMPARISON_UNAVAILABLE');else if(attempt.generatorComparison.status!=='MATCH')reasons.push('GENERATOR_COMPARISON_MISMATCH');
 const artifact=attempt.outcome?.artifact,comparison=attempt.outcome?.comparison;
 if(artifact?.status!=='COMPLETED')reasons.push('ARTIFACT_STATUS');if(!comparison)reasons.push('COMPARISON_UNAVAILABLE');else if(comparison.status!=='MATCH')reasons.push('COMPARISON_MISMATCH');
 const metrics=artifact?.metrics;if(!metrics)reasons.push('METRICS_UNAVAILABLE');else{if(!metrics.comparable)reasons.push('NONCOMPARABLE');if(metrics.trades<rule.minTrades)reasons.push('TRADE_FLOOR');if(metrics.returnPct<rule.minReturnPct)reasons.push('RETURN_FLOOR');if(metrics.maxDrawdownPct>rule.maxDrawdownPct)reasons.push('DRAWDOWN_LIMIT');}
 return {candidateId:attempt.candidateId,attemptDigest:attempt.attemptDigest,eligible:reasons.length===0,reasons,returnPct:metrics?.returnPct??null};
}
async function selection(plan:ProgramSearchPlan,attempts:ProgramSearchAttempt[],lockedAt:string):Promise<ProgramSearchSelection>{
 clock.parse(lockedAt);assertProgramSearch(attempts.length===plan.admission.candidates.length&&attempts.every(attempt=>attempt.phase==='TRAIN'&&attempt.status!=='RUNNING'&&attempt.finishedAt!==null&&attempt.finishedAt<=lockedAt),'Every frozen TRAIN candidate must have a terminal disposition before selection.');
 const ranks=attempts.map(attempt=>ranking(attempt,plan.admission.selection)),remaining=ranks.map((rank,ordinal)=>({...rank,ordinal})).filter(rank=>rank.eligible),eligibleOrder:string[]=[];
 while(remaining.length){const maximum=Math.max(...remaining.map(rank=>rank.returnPct!)),band=remaining.filter(rank=>maximum-rank.returnPct!<=plan.admission.selection.tieTolerancePct).sort((left,right)=>left.ordinal-right.ordinal);for(const rank of band){eligibleOrder.push(rank.candidateId);remaining.splice(remaining.findIndex(value=>value.candidateId===rank.candidateId),1);}}
 const body=selectionBody.parse({planDigest:plan.planDigest,decision:eligibleOrder.length?'SELECTED':'NO_SELECTION',selectedCandidateId:eligibleOrder[0]??null,lockedAt,trainingResultSetDigest:await digest(attempts.map(attempt=>({candidateId:attempt.candidateId,attemptId:attempt.attemptId,attemptDigest:attempt.attemptDigest}))),ranking:ranks,eligibleOrder});return selectionSchema.parse({...body,selectionDigest:await digest(body)});
}
/** Checks complete chronological correlations, not execution/authenticated custody. */
export async function verifyProgramSearchLedger(raw:unknown):Promise<ProgramSearchLedger>{
 const ledger=parsed(raw,programSearchLedgerSchema,programSearchLimits.ledgerBytes),{ledgerDigest,...body}=ledger;assertProgramSearch(await digest(body)===ledgerDigest,'Ledger digest is inconsistent.');const plan=await verifyProgramSearchPlan(ledger.plan);assertProgramSearch(ledger.id===plan.id,'Ledger identity changed.');
 const train:ProgramSearchAttempt[]=[],test:ProgramSearchAttempt[]=[],checked={plan,payload:JSON.stringify(plan)};
 for(const rawAttempt of ledger.attempts){const attempt=await verifySearchAttempt(rawAttempt,checked);if(attempt.phase==='TRAIN'){assertProgramSearch(test.length===0&&train.length<plan.admission.candidates.length&&attempt.candidateId===plan.admission.candidates[train.length].source.id,'TRAIN must follow frozen candidate order exactly once.');train.push(attempt);}else test.push(attempt);}
 assertProgramSearch(test.length<=1&&ledger.attempts.filter(attempt=>attempt.status==='RUNNING').length<=1&&ledger.attempts.every((attempt,n)=>attempt.status!=='RUNNING'||n===ledger.attempts.length-1),'Only the final admitted attempt may be pending.');
 if(ledger.selection)assertProgramSearch(same(await selection(plan,train,ledger.selection.lockedAt),ledger.selection),'Selection changed from the complete TRAIN result set.');
 assertProgramSearch(!test.length||ledger.selection?.decision==='SELECTED'&&test[0].candidateId===ledger.selection.selectedCandidateId&&test[0].startedAt>=ledger.selection.lockedAt,'A sole TEST must follow its selected frozen winner.');
 const expectedEvents:ProgramSearchLedger['events']=[];expectedEvents.push(await event(expectedEvents,'PLAN_FROZEN',plan.createdAt,null,plan.planDigest));
 for(const attempt of train){expectedEvents.push(await event(expectedEvents,'TRAIN_ADMITTED',attempt.startedAt,attempt.attemptId,await admissionDigest(attempt)));if(attempt.status!=='RUNNING')expectedEvents.push(await event(expectedEvents,'ATTEMPT_FINISHED',attempt.finishedAt!,attempt.attemptId,attempt.attemptDigest));}
 if(ledger.selection)expectedEvents.push(await event(expectedEvents,'SELECTION_LOCKED',ledger.selection.lockedAt,null,ledger.selection.selectionDigest));
 for(const attempt of test){expectedEvents.push(await event(expectedEvents,'TEST_ADMITTED',attempt.startedAt,attempt.attemptId,await admissionDigest(attempt)));if(attempt.status!=='RUNNING')expectedEvents.push(await event(expectedEvents,'ATTEMPT_FINISHED',attempt.finishedAt!,attempt.attemptId,attempt.attemptDigest));}
 assertProgramSearch(same(ledger.events,expectedEvents),'Ledger events do not retain the complete ordered history.');reserve(ledger);return ledger;
}
function reserve(ledger:ProgramSearchLedger){
 const total=ledger.plan.admission.candidates.length+1,base=bytes({...ledger,attempts:[],ledgerDigest:'f'.repeat(64)}),retained=ledger.attempts.reduce((sum,attempt)=>sum+Math.max(programSearchLimits.attemptBytes,bytes(attempt)),0),remaining=(total-ledger.attempts.length)*programSearchLimits.attemptBytes;
 assertProgramSearch(base+retained+remaining+65536<=programSearchLimits.ledgerBytes,'Capacity cannot retain every whole program candidate and sole TEST.',413);
}
export async function createProgramSearchLedger(rawPlan:unknown):Promise<ProgramSearchLedger>{const plan=await verifyProgramSearchPlan(rawPlan),ledger=await sealLedger({version:1,kind:'LOCAL_PROGRAM_SEARCH_LEDGER',id:plan.id,...flags,plan,attempts:[],selection:null,events:[await event([],'PLAN_FROZEN',plan.createdAt,null,plan.planDigest)]});reserve(ledger);return ledger;}
export function pendingProgramSearchAttempt(ledger:ProgramSearchLedger):ProgramSearchAttempt|null{return ledger.attempts.find(attempt=>attempt.status==='RUNNING')??null;}
function nextClock(ledger:ProgramSearchLedger,at:string){clock.parse(at);assertProgramSearch(at>=(ledger.events.at(-1)?.at??ledger.plan.createdAt),'Program search operation clock regressed.');}
export async function admitProgramSearchTrain(raw:unknown,candidateId:string,startedAt:string):Promise<ProgramSearchLedger>{const ledger=await verifyProgramSearchLedger(raw);nextClock(ledger,startedAt);assertProgramSearch(!ledger.selection&&!pendingProgramSearchAttempt(ledger),'Finish the pending TRAIN or preserve its interruption before advancing.');const next=ledger.plan.admission.candidates[ledger.attempts.length];assertProgramSearch(!!next&&next.source.id===candidateId,'Admit exactly the next frozen TRAIN candidate once.');reserve(ledger);const attempt=await initialAttempt(ledger.plan,'TRAIN',candidateId,startedAt);return sealLedger({...ledger,attempts:[...ledger.attempts,attempt],events:[...ledger.events,await event(ledger.events,'TRAIN_ADMITTED',startedAt,attempt.attemptId,attempt.attemptDigest)]});}
export async function verifyProgramSearchTestInput(rawLedger:unknown,raw:unknown):Promise<ProgramSearchTestInput>{const ledger=await verifyProgramSearchLedger(rawLedger);assertProgramSearch(ledger.selection?.decision==='SELECTED'&&!!ledger.selection.selectedCandidateId&&!pendingProgramSearchAttempt(ledger)&&!ledger.attempts.some(attempt=>attempt.phase==='TEST'),'A locked winner and unused sole TEST admission are required.');const supplied=testData(ledger.plan,raw);await input(ledger.plan,ledger.selection.selectedCandidateId,'TEST',supplied);return supplied;}
export async function admitProgramSearchTest(raw:unknown,rawInput:unknown,startedAt:string):Promise<ProgramSearchLedger>{const ledger=await verifyProgramSearchLedger(raw);nextClock(ledger,startedAt);const supplied=await verifyProgramSearchTestInput(ledger,rawInput);reserve(ledger);const attempt=await initialAttempt(ledger.plan,'TEST',ledger.selection!.selectedCandidateId!,startedAt,supplied);return sealLedger({...ledger,attempts:[...ledger.attempts,attempt],events:[...ledger.events,await event(ledger.events,'TEST_ADMITTED',startedAt,attempt.attemptId,attempt.attemptDigest)]});}
export async function lockProgramSearchSelection(raw:unknown,lockedAt:string):Promise<ProgramSearchLedger>{const ledger=await verifyProgramSearchLedger(raw);nextClock(ledger,lockedAt);assertProgramSearch(!ledger.selection&&!pendingProgramSearchAttempt(ledger),'A selection cannot replace an existing lock or pending attempt.');const locked=await selection(ledger.plan,ledger.attempts,lockedAt);return sealLedger({...ledger,selection:locked,events:[...ledger.events,await event(ledger.events,'SELECTION_LOCKED',lockedAt,null,locked.selectionDigest)]});}
