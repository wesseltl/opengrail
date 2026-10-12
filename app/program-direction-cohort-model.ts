import {z} from 'zod';
import {strategyPublicItemSchema,type StrategyPublicItem} from './strategy-model';
import {programDirectionSearchLimits,programDirectionSearchMethod,boundedProgramDirectionSearchValue,programDirectionSearchTestInputSchema,createProgramDirectionSearchPlan,verifyProgramDirectionSearchPlan,type ProgramDirectionSearchPlan,type ProgramDirectionSearchPlanAdmission,type ProgramDirectionSearchTestInput} from './program-direction-search-model';

/** Declared before implementation; existing execution/admission limits are unchanged. */
export const programDirectionCohortLimits=Object.freeze({page:20,pages:8,retainedSources:40,selectedSources:4,sourceBytes:65536,pageBytes:1314816,trainBytes:524288,admissionBytes:1048576,planBytes:1048576,bars:2000,textCharacters:2000,maximumDepth:40});
const uuid=z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value),finite=z.number().finite();
const text=z.string().min(1).max(2000).refine(value=>value===value.trim());
const selectionSchema=z.object({minTrades:z.number().int().min(0).max(2000),maxDrawdownPct:finite.min(0).max(1000000),minReturnPct:finite.min(-1000000).max(1000000)}).strict();
const draftSchema=z.object({sources:z.array(strategyPublicItemSchema).min(2).max(4),train:programDirectionSearchTestInputSchema,initialCapital:finite.min(.01).max(1000000),hypothesis:text,falsification:text,selection:selectionSchema,test:z.object({firstClosedAt:clock,barCount:z.number().int().min(2).max(2000),gapBars:z.number().int().min(0).max(2000),provenance:z.enum(['SYNTHETIC','USER_SUPPLIED']),permission:z.enum(['CREATED_SYNTHETIC','AUTHORIZED_USE'])}).strict(),rightsConfirmed:z.literal(true)}).strict();
const identitiesSchema=z.object({id:uuid,createdAt:clock,testDatasetId:uuid,testAttemptId:uuid,testRequestId:uuid,candidates:z.array(z.object({attemptId:uuid,requestId:uuid}).strict()).min(2).max(4)}).strict();
export type ProgramDirectionCohortDraft=z.infer<typeof draftSchema>;
export type ProgramDirectionCohortIdentities=z.infer<typeof identitiesSchema>;
export class ProgramDirectionCohortError extends Error{}
function unchanged(left:unknown,right:unknown):boolean{
 if(left===right)return true;
 if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
 const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);
 return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&unchanged(a[key],b[key]));
}
function parse<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T{
 boundedProgramDirectionSearchValue(raw,maximum);
 const parsed=schema.safeParse(raw);if(!parsed.success||!unchanged(raw,parsed.data))throw new ProgramDirectionCohortError('The complete cohort input must match its unchanged bounded contract.');return parsed.data;
}
export function validateProgramDirectionCohortTrain(raw:unknown):ProgramDirectionSearchTestInput{return parse(raw,programDirectionSearchTestInputSchema,programDirectionCohortLimits.trainBytes);}
export function validateProgramDirectionCohortDraft(raw:unknown):ProgramDirectionCohortDraft{return parse(raw,draftSchema,programDirectionCohortLimits.admissionBytes);}
export type ProgramDirectionCohortIssue={index:number;field:'COUNT'|'SOURCE'|'DUPLICATE'|'DIRECTION'|'MARKET'|'RISK'|'COSTS';message:string};
/** Snapshot compatibility only; current public/ancestor availability is checked separately. */
export function programDirectionCohortCompatibility(raw:unknown):{compatible:boolean;issues:ProgramDirectionCohortIssue[]}{
 boundedProgramDirectionSearchValue(raw,programDirectionCohortLimits.sourceBytes*4);
 if(!Array.isArray(raw)||raw.length>4)throw new ProgramDirectionCohortError('Retain at most four complete candidate snapshots.');
 const issues:ProgramDirectionCohortIssue[]=[],sources:StrategyPublicItem[]=[];
 if(raw.length<2)issues.push({index:0,field:'COUNT',message:'Select two to four exact programs.'});
 for(let index=0;index<raw.length;index++){
  const item=parse(raw[index],strategyPublicItemSchema,programDirectionCohortLimits.sourceBytes);sources.push(item);
  if(item.state!=='VISIBLE'||!item.record||item.record.version!==2)issues.push({index,field:'SOURCE',message:'A visible complete V2 program is required.'});
  if(sources.slice(0,-1).some(previous=>previous.id===item.id||previous.digest===item.digest))issues.push({index,field:'DUPLICATE',message:'Candidate IDs and source digests must be distinct.'});
 }
 const first=sources[0]?.record?.content.definition;
 if(first)for(let index=1;index<sources.length;index++){
  const definition=sources[index].record?.content.definition;if(!definition)continue;
  if(definition.market.direction!==first.market.direction)issues.push({index,field:'DIRECTION',message:'Directions differ; LONG and SHORT cannot share this cohort.'});
  if(definition.market.symbol!==first.market.symbol||definition.market.timeframe!==first.market.timeframe)issues.push({index,field:'MARKET',message:'Symbol and timeframe must match exactly.'});
  if(!unchanged(definition.risk,first.risk))issues.push({index,field:'RISK',message:'Position, stop, target and loss limits must match exactly.'});
  if(!unchanged(definition.costs,first.costs))issues.push({index,field:'COSTS',message:'Fee and slippage assumptions must match exactly.'});
 }
 return {compatible:issues.length===0,issues};
}
/** Pure admission construction. IDs/clocks are supplied only by an explicit caller action. */
export async function prepareProgramDirectionCohort(raw:unknown,rawIdentities:unknown):Promise<ProgramDirectionSearchPlan>{
 const draft=validateProgramDirectionCohortDraft(raw),identities=parse(rawIdentities,identitiesSchema,4096),compatibility=programDirectionCohortCompatibility(draft.sources);
 if(!compatibility.compatible)throw new ProgramDirectionCohortError(compatibility.issues.map(issue=>issue.message).join(' '));
 if(identities.candidates.length!==draft.sources.length)throw new ProgramDirectionCohortError('Every candidate needs its own fresh operation identities.');
 if(draft.train.dataset.bars.at(-1)!.closedAt>identities.createdAt)throw new ProgramDirectionCohortError('Future TRAIN observations are refused.');
 const admission:ProgramDirectionSearchPlanAdmission={version:2,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_ADMISSION',method:programDirectionSearchMethod,id:identities.id,createdAt:identities.createdAt,candidates:draft.sources.map((source,index)=>({source,attemptId:identities.candidates[index].attemptId,requestId:identities.candidates[index].requestId})),train:draft.train,test:{...draft.test,datasetId:identities.testDatasetId,attemptId:identities.testAttemptId,requestId:identities.testRequestId},initialCapital:draft.initialCapital,hypothesis:draft.hypothesis,falsification:draft.falsification,selection:{objective:'MAX_RETURN_PCT',...draft.selection,tieTolerancePct:.00000001,tieBreak:'CANDIDATE_ORDER'}};
 boundedProgramDirectionSearchValue(admission,programDirectionSearchLimits.admissionBytes);
 const plan=await createProgramDirectionSearchPlan(admission);return verifyProgramDirectionSearchPlan(plan);
}
