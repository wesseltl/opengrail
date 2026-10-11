import {z} from 'zod';
import {experimentPublicItemSchema,experimentRegisterSchema,validateExperimentItem,boundedExperimentRecord,boundedExperimentCommand,experimentDigest,type ExperimentPublicItem} from './experiment-model';
import {strategyPublicItemSchema,boundedStrategyRecord,type StrategyPublicItem} from './strategy-model';
import {boundedDemoRequest,demoEvaluatorMethod,demoEvaluatorVersion,demoTimeframes,type DemoRequest} from './demo-model';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';
import {boundedSessionValue,SessionError} from './session-model';

export const chronologicalPlanLimits={admissionBytes:524288,planBytes:1048576,plans:4} as const;
export type ChronologicalPartition='TRAIN'|'TEST';
const uuid=z.string().uuid().refine(v=>v===v.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/),clock=z.string().datetime().refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);
const childIdsSchema=z.object({requestId:uuid,id:uuid,inputRequestId:uuid,datasetId:uuid}).strict();
export const chronologicalPlanAdmissionSchema=z.object({planId:uuid,createdAt:clock,parent:experimentPublicItemSchema,source:strategyPublicItemSchema,trainingBars:z.number().int().min(2).max(1998),excludedGapBars:z.number().int().min(0).max(1996),children:z.object({TRAIN:childIdsSchema,TEST:childIdsSchema}).strict()}).strict();
export type ChronologicalPlanAdmission=z.infer<typeof chronologicalPlanAdmissionSchema>;
const rangeSchema=z.object({firstOpenAt:clock,firstClosedAt:clock,lastClosedAt:clock,barCount:z.number().int().min(2).max(1998),signalCount:z.number().int().min(0).max(500)}).strict();
const childSchema=z.object({range:rangeSchema,emergency:z.object({originalAt:clock.nullable(),mappedAt:clock.nullable(),reason:z.enum(['ABSENT','PRESERVED','AFTER_PARTITION'])}).strict(),inputDigest:hash,command:experimentRegisterSchema}).strict();
const planBodySchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_CHRONOLOGICAL_PLAN'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),unseen:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false),planId:uuid,createdAt:clock,captured:z.object({parent:experimentPublicItemSchema,source:strategyPublicItemSchema}).strict(),split:z.object({trainingBars:z.number().int().min(2).max(1998),excludedGapBars:z.number().int().min(0).max(1996)}).strict(),excluded:z.object({bars:z.array(z.object({closedAt:clock}).strict()).max(1996),signals:z.array(z.object({id:uuid,reason:z.enum(['GAP_OBSERVATION','CROSS_BOUNDARY_AVAILABILITY','OUTSIDE_PARTITION'])}).strict()).max(500)}).strict(),children:z.object({TRAIN:childSchema,TEST:childSchema}).strict()}).strict();
export const chronologicalPlanSchema=planBodySchema.extend({planDigest:hash});
export type ChronologicalPlan=z.infer<typeof chronologicalPlanSchema>;
export class ChronologicalPlanError extends Error{constructor(message:string,public status=400){super(message);}}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function plain(raw:unknown,bound:number){try{boundedSessionValue(raw,bound);}catch(error){throw new ChronologicalPlanError('Only bounded plain finite JSON data is accepted.',error instanceof SessionError?error.status:400);}}
function credentials(raw:unknown,inAuthor=false):void{
 if(typeof raw==='string'){let value=raw;for(let n=0;n<4;n++){if(/og_local_(producer|owner)_/i.test(value)||!inAuthor&&/og_agent_/i.test(value))throw new ChronologicalPlanError('Credentials cannot be retained in a chronological plan.');try{const next=decodeURIComponent(value);if(next===value)break;value=next;}catch{break;}}}
 else if(raw&&typeof raw==='object')for(const [key,value]of Object.entries(raw))credentials(value,inAuthor||key==='author');
}
async function sources(rawParent:unknown,rawSource:unknown){
 let parent:ExperimentPublicItem,source:StrategyPublicItem;
 try{parent=await validateExperimentItem(rawParent);source=strategyPublicItemSchema.parse(rawSource);}catch{throw new ChronologicalPlanError('The captured public records are invalid.');}
 if(parent.type!=='MANIFEST'||parent.state!=='VISIBLE'||parent.record?.type!=='MANIFEST'||source.state!=='VISIBLE'||!source.record)throw new ChronologicalPlanError('A visible exact manifest and strategy source are required.',409);
 const record=boundedExperimentRecord(parent.record).record;if(record.type!=='MANIFEST')throw new ChronologicalPlanError('A manifest is required.');
 const strategy=boundedStrategyRecord(source.record),input=boundedDemoRequest(record.content.input);
 if(await experimentDigest(strategy.payload)!==source.digest||parent.strategy.id!==source.id||parent.strategy.digest!==source.digest||input.input.strategy.digest!==source.digest||!same(input.input.strategy.record,strategy.record))throw new ChronologicalPlanError('The manifest must match the exact strategy source.');
 if(record.content.evaluator.version!==demoEvaluatorVersion||record.content.evaluator.methodDigest!==await experimentDigest(JSON.stringify(demoEvaluatorMethod))||record.content.evaluator.sourceDigest!==evaluatorSourceFingerprints.primary)throw new ChronologicalPlanError('This manifest declares a different evaluator source or method.',409);
 return {parent,source,record,input:input.input};
}
function identities(a:ChronologicalPlanAdmission,input:DemoRequest){
 const ids=[a.planId,...Object.values(a.children.TRAIN),...Object.values(a.children.TEST)];
 const prior=new Set([a.parent.id,a.parent.requestId,a.source.id,a.source.requestId,input.requestId,input.dataset.id,...input.signals.map(s=>s.id)]);
 if(new Set(ids).size!==ids.length||ids.some(id=>prior.has(id)))throw new ChronologicalPlanError('Plan, child and input identities must be distinct and fresh.');
}
/** Freeze supplied snapshots and two exact independent cold-start inputs. No public writes or evaluation. */
export async function createChronologicalPlan(raw:unknown):Promise<ChronologicalPlan>{
 plain(raw,chronologicalPlanLimits.admissionBytes);credentials(raw);let a:ChronologicalPlanAdmission;try{a=chronologicalPlanAdmissionSchema.parse(raw);}catch{throw new ChronologicalPlanError('Invalid chronological plan admission.');}
 const captured=await sources(a.parent,a.source),{input,record}=captured;identities(a,input);
 const testStart=a.trainingBars+a.excludedGapBars,bars=input.dataset.bars;
 if(testStart>bars.length-2)throw new ChronologicalPlanError('Training and test each require at least two retained bars.');
 const interval=demoTimeframes[input.dataset.timeframe],trainBars=bars.slice(0,a.trainingBars),testBars=bars.slice(testStart);
 const testOpen=new Date(Date.parse(testBars[0].closedAt)-interval).toISOString();
 if(input.emergencyStopAt!==null&&input.emergencyStopAt<testOpen)throw new ChronologicalPlanError('The original emergency stop precedes the test interval and cannot be erased.');
 const included:{TRAIN:DemoRequest['signals'];TEST:DemoRequest['signals']}={TRAIN:[],TEST:[]},excluded:ChronologicalPlan['excluded']={bars:bars.slice(a.trainingBars,testStart).map(bar=>({closedAt:bar.closedAt})),signals:[]};
 const within=(at:string,partition:typeof trainBars)=>at>=partition[0].closedAt&&at<=partition.at(-1)!.closedAt;
 for(const signal of input.signals){
  const partition=within(signal.observedAt,trainBars)?'TRAIN':within(signal.observedAt,testBars)?'TEST':null;
  if(partition&&within(signal.availableAt,partition==='TRAIN'?trainBars:testBars))included[partition].push(signal);
  else excluded.signals.push({id:signal.id,reason:partition?'CROSS_BOUNDARY_AVAILABILITY':excluded.bars.some(bar=>bar.closedAt===signal.observedAt)?'GAP_OBSERVATION':'OUTSIDE_PARTITION'});
 }
 const child=async(partition:ChronologicalPartition,part:typeof trainBars)=>{
  const ids=a.children[partition],last=part.at(-1)!.closedAt,firstOpenAt=new Date(Date.parse(part[0].closedAt)-interval).toISOString(),originalAt=input.emergencyStopAt;
  const mappedAt=originalAt!==null&&originalAt<=last?originalAt:null;
  // A stop before the test interval is rejected above; training starts at the original first open.
  const emergency={originalAt,mappedAt,reason:originalAt===null?'ABSENT' as const:mappedAt===null?'AFTER_PARTITION' as const:'PRESERVED' as const};
  const derived=boundedDemoRequest({...input,requestId:ids.inputRequestId,dataset:{...input.dataset,id:ids.datasetId,bars:part},signals:included[partition],emergencyStopAt:mappedAt});
  const disclosures=structuredClone(record.content.disclosures);
  // Historical declarations remain captured unchanged. New planned trials are not a complete prior search log.
  if(disclosures.search.logCompleteness==='COMPLETE')disclosures.search.logCompleteness='PARTIAL';
  if(disclosures.validation.holdoutPriorAccess==='UNSEEN')disclosures.validation.holdoutPriorAccess='UNKNOWN';
  const command=experimentRegisterSchema.parse(boundedExperimentCommand({action:'register',requestId:ids.requestId,id:ids.id,...record.content,name:'Chronological '+partition+' · '+a.planId,input:derived.input,disclosures,policyAccepted:record.policyAccepted}).command);
  return {range:{firstOpenAt,firstClosedAt:part[0].closedAt,lastClosedAt:last,barCount:part.length,signalCount:included[partition].length},emergency,inputDigest:await experimentDigest(derived.payload),command};
 };
 const body=planBodySchema.parse({version:1,kind:'LOCAL_CHRONOLOGICAL_PLAN',classification:'AUTHOR_REPORTED',qualification:'NONE',unseen:'NOT_ESTABLISHED',ordersEnabled:false,planId:a.planId,createdAt:a.createdAt,captured:{parent:captured.parent,source:captured.source},split:{trainingBars:a.trainingBars,excludedGapBars:a.excludedGapBars},excluded,children:{TRAIN:await child('TRAIN',trainBars),TEST:await child('TEST',testBars)}});
 const plan=chronologicalPlanSchema.parse({...body,planDigest:await experimentDigest(JSON.stringify(body))});plain(plan,chronologicalPlanLimits.planBytes);return plan;
}
/** Canonical declaration/binding checks only, never proof of execution or genuinely unseen data. */
export async function verifyChronologicalPlan(raw:unknown):Promise<ChronologicalPlan>{
 plain(raw,chronologicalPlanLimits.planBytes);credentials(raw);let plan:ChronologicalPlan;try{plan=chronologicalPlanSchema.parse(raw);}catch{throw new ChronologicalPlanError('Invalid chronological plan.');}
 const {planDigest,...body}=plan;if(await experimentDigest(JSON.stringify(body))!==planDigest)throw new ChronologicalPlanError('Plan identity is inconsistent.');
 const ids=(partition:ChronologicalPartition)=>{const command=plan.children[partition].command;return {requestId:command.requestId,id:command.id,inputRequestId:command.input.requestId,datasetId:command.input.dataset.id};};
 const derived=await createChronologicalPlan({planId:plan.planId,createdAt:plan.createdAt,parent:plan.captured.parent,source:plan.captured.source,...plan.split,children:{TRAIN:ids('TRAIN'),TEST:ids('TEST')}});
 if(!same(plan,derived))throw new ChronologicalPlanError('The frozen partitions or retained declarations are inconsistent.');return plan;
}
/** Caller supplies freshly fetched projections; this is not an atomic server ancestor-visibility guarantee. */
export async function assertChronologicalPlanSources(raw:unknown,rawParent:unknown,rawSource:unknown):Promise<ChronologicalPlan>{
 const plan=await verifyChronologicalPlan(raw);plain({parent:rawParent,source:rawSource},chronologicalPlanLimits.admissionBytes);credentials({parent:rawParent,source:rawSource});
 const current=await sources(rawParent,rawSource);
 if(current.parent.id!==plan.captured.parent.id||current.parent.digest!==plan.captured.parent.digest||current.source.id!==plan.captured.source.id||current.source.digest!==plan.captured.source.digest||!same(current.record.content,plan.captured.parent.record?.content))throw new ChronologicalPlanError('The captured parent or source changed.',409);return plan;
}
function partitionKey(raw:unknown):ChronologicalPartition{if(raw!=='TRAIN'&&raw!=='TEST')throw new ChronologicalPlanError('A training or test partition is required.');return raw;}
/** Explicit confirmation returns the already frozen registration draft. Caller reviews and posts separately. */
export async function prepareChronologicalManifest(raw:unknown,partition:ChronologicalPartition,options:{confirmPublicSharing:true}){
 if(options?.confirmPublicSharing!==true)throw new ChronologicalPlanError('Explicit public-sharing confirmation is required.',403);
 const plan=await verifyChronologicalPlan(raw);return structuredClone(plan.children[partitionKey(partition)].command);
}
/** Require a real exact visible child receipt. No author, public timestamp or record is manufactured locally. */
export async function correlateChronologicalManifest(raw:unknown,partition:ChronologicalPartition,rawChild:unknown):Promise<ExperimentPublicItem>{
 const plan=await verifyChronologicalPlan(raw),expected=plan.children[partitionKey(partition)].command;plain(rawChild,chronologicalPlanLimits.admissionBytes);credentials(rawChild);
 const child=await validateExperimentItem(rawChild);
 if(child.state!=='VISIBLE'||child.record?.type!=='MANIFEST')throw new ChronologicalPlanError('An exact visible registered child is required.',409);
 const record=boundedExperimentRecord(child.record).record;if(record.type!=='MANIFEST')throw new ChronologicalPlanError('A child manifest is required.');
 const {action:_,requestId,id,policyAccepted,...content}=expected;void _;
 if(child.id!==id||child.requestId!==requestId||record.policyAccepted!==policyAccepted||!same(record.content,content)||!same(child.strategy,{id:plan.captured.source.id,digest:plan.captured.source.digest}))throw new ChronologicalPlanError('The registered child does not match its exact frozen draft.',409);
 return child;
}
