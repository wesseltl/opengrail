import {z} from 'zod';
import {strategyRecordV2Schema,strategyDigest} from './strategy-model';
import {demoDatasetSchema,demoSignalSchema,demoRequestSchema,demoArtifactSchema,demoLimits} from './demo-model';
import {comparisonReportSchema} from './comparison-model';
import {programAbi,programProfile} from './program-source-model';
import {programSourceFingerprints} from './program-fingerprints';

export const programRunLimits=Object.freeze({inputBytes:524288,outcomeBytes:10485760,historyBytes:33554432,attempts:3,perInvocationFuel:20000,totalFuel:2000000});
export const programInterpreterVersion='opengrail-restricted-interpreter-v1' as const;
export const programRunMethod=Object.freeze({version:'opengrail-program-replay-v1',interpreter:programInterpreterVersion,implementations:programSourceFingerprints,profile:programProfile,abi:programAbi,perInvocationFuel:programRunLimits.perInvocationFuel,totalFuel:programRunLimits.totalFuel,signals:demoLimits.signals,hostInputs:'current-closed-bar-and-frozen-numeric-parameters',output:'0=NONE;1=BULLISH;2=BEARISH',projection:'distinct-internal-V1-only',generatorIndependence:'NOT_ESTABLISHED'} as const);
export const programUuid=z.string().uuid().refine(value=>value===value.toLowerCase());
export const programHash=z.string().regex(/^[a-f0-9]{64}$/);
export const programClock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const text=z.string().trim().min(1).max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>{for(let n=0;n<3;n++){if(/og_agent_/i.test(value))return false;try{const next=decodeURIComponent(value);if(next===value)break;value=next;}catch{break;}}return true;});
export const programRunInputSchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_RUN_INPUT'),methodDigest:programHash,requestId:programUuid,strategy:z.object({record:strategyRecordV2Schema,digest:programHash}).strict(),dataset:demoDatasetSchema,initialCapital:z.number().finite().min(.01).max(1000000),hypothesis:text,falsification:text,emergencyStopAt:programClock.nullable()}).strict().superRefine((input,ctx)=>{
 const market=input.strategy.record.content.definition.market;
 if(market.symbol!==input.dataset.symbol||market.timeframe!==input.dataset.timeframe)ctx.addIssue({code:z.ZodIssueCode.custom,path:['dataset'],message:'The dataset must match the exact program market and timeframe.'});
 const first=Date.parse(input.dataset.bars[0].closedAt),last=Date.parse(input.dataset.bars.at(-1)!.closedAt),step=last-Date.parse(input.dataset.bars.at(-2)!.closedAt);
 if(input.dataset.bars.some(bar=>Object.is(bar.volume,-0)))ctx.addIssue({code:z.ZodIssueCode.custom,path:['dataset'],message:'Negative-zero volume cannot be bound by a canonical JSON input.'});
 if(input.emergencyStopAt!==null&&(Date.parse(input.emergencyStopAt)<first-step||Date.parse(input.emergencyStopAt)>last))ctx.addIssue({code:z.ZodIssueCode.custom,path:['emergencyStopAt'],message:'The emergency boundary must lie in the dataset.'});
});
export type ProgramRunInput=z.infer<typeof programRunInputSchema>;
const code=z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/).nullable();
const fuel=z.number().int().min(0).max(programRunLimits.perInvocationFuel);
const configure=z.object({parameterIndex:z.number().int().min(0).max(15),value:z.number().finite(),fuelUsed:fuel,status:z.enum(['APPLIED','FAILED']),code}).strict();
const trace=z.object({barIndex:z.number().int().min(0).max(demoLimits.bars-1),closedAt:programClock,output:z.number().int().min(-2147483648).max(2147483647).nullable(),fuelUsed:fuel,status:z.enum(['OUTPUT','FAILED']),code}).strict();
export const programRunStatuses=['COMPLETED','NO_TRADES','HALTED','REJECTED','FAILED','CANCELLED','INTERRUPTED'] as const;
export const programRunReasons=['NONE','INVALID_INPUT','DIGEST_MISMATCH','MODULE_ERROR','PROGRAM_TRAP','FUEL_LIMIT','TOTAL_FUEL_LIMIT','INVALID_OUTPUT','SIGNAL_LIMIT','EVALUATOR_FAILED','CANCELLED','INTERRUPTED'] as const;
export const programImplementationSchema=z.object({interpreter:programHash,runner:programHash,inputModel:programHash,evidenceModel:programHash,sourceModel:programHash,strategyModel:programHash,demoModel:programHash,serialization:programHash,lockfile:programHash}).strict();
const outcomeBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_RUN_OUTCOME'),attemptId:programUuid,classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),generatorIndependence:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false),status:z.enum(programRunStatuses),reason:z.enum(programRunReasons),input:programRunInputSchema.nullable(),inputDigest:programHash.nullable(),implementations:programImplementationSchema,digests:z.object({method:programHash,source:programHash.nullable(),module:programHash.nullable(),dataset:programHash.nullable()}).strict(),configure:z.array(configure).max(16),trace:z.array(trace).max(demoLimits.bars),signals:z.array(demoSignalSchema).max(demoLimits.signals),totalFuel:z.number().int().min(0).max(programRunLimits.totalFuel),state:z.object({globals:z.array(z.number().finite()).max(64),globalBits:z.array(z.string().regex(/^(?:[a-f0-9]{8}|[a-f0-9]{16})$/)).max(64),memory:z.array(z.number().int().min(0).max(255)).max(65536)}).strict().nullable(),stateDigest:programHash.nullable(),demoRequest:demoRequestSchema.nullable(),artifact:demoArtifactSchema.nullable(),comparison:comparisonReportSchema.nullable()}).strict();
export const programRunOutcomeSchema=outcomeBody.extend({outcomeDigest:programHash});
export type ProgramRunOutcome=z.infer<typeof programRunOutcomeSchema>;

/** Only bounded plain JSON data enters schemas; never invoke accessors or caller serialization. */
export function guardProgramData(raw:unknown,maximumBytes:number,maximumNodes=500000){
 let nodes=0,characters=0;const seen=new Set<object>();
 function visit(value:unknown,depth:number):void{
  if(++nodes>maximumNodes||depth>24)throw Error('Program data exceeds structural limits.');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Program numbers must be finite.');return;}
  if(typeof value==='string'){characters+=value.length;if(characters>maximumBytes)throw Error('Program data exceeds its byte limit.');return;}
  if(typeof value!=='object')throw Error('Program data must be plain JSON.');
  const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null&&!(Array.isArray(value)&&prototype===Array.prototype)||seen.has(value))throw Error('Program data must be acyclic plain JSON.');
  if(Array.isArray(value)&&value.length>maximumNodes)throw Error('Program array exceeds its structural bound.');
  seen.add(value);const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Array.isArray(value)){if(value.length>maximumNodes||Object.keys(descriptors).length!==value.length+1)throw Error('Program arrays must be dense ordinary JSON arrays.');for(let n=0;n<value.length;n++)if(!Object.hasOwn(descriptors,String(n)))throw Error('Program arrays must be dense ordinary JSON arrays.');}
  for(const [key,descriptor] of Object.entries(descriptors)){if(Array.isArray(value)&&key==='length')continue;if(!descriptor.enumerable||!('value' in descriptor))throw Error('Program data cannot contain accessors.');characters+=key.length;visit(descriptor.value,depth+1);}
  if(Object.getOwnPropertySymbols(value).length)throw Error('Program data cannot contain symbols.');seen.delete(value);
 }
 visit(raw,0);const payload=JSON.stringify(raw);if(new TextEncoder().encode(payload).byteLength>maximumBytes)throw Error('Program data exceeds its byte limit.');return payload;
}
export function boundedProgramRunInput(raw:unknown){guardProgramData(raw,programRunLimits.inputBytes);const input=programRunInputSchema.parse(raw),payload=JSON.stringify(input);if(new TextEncoder().encode(payload).byteLength>programRunLimits.inputBytes)throw Error('Program input exceeds its byte limit.');return {input,payload};}
export async function sealProgramRunOutcome(raw:unknown):Promise<ProgramRunOutcome>{guardProgramData(raw,programRunLimits.outcomeBytes);const body=outcomeBody.parse(raw);const result=programRunOutcomeSchema.parse({...body,outcomeDigest:await strategyDigest(JSON.stringify(body))});if(new TextEncoder().encode(JSON.stringify(result)).byteLength>programRunLimits.outcomeBytes)throw Error('Program outcome exceeds its reserved byte limit.');return result;}
