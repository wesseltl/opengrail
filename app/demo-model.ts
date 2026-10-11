import {z} from 'zod';
import {strategyRecordSchema,boundedStrategyRecord,strategyDigest,type StrategyRecord} from './strategy-model';

export const demoEvaluatorVersion='opengrail-demo-v1' as const;
// This binds the declared method, not source code or independent verification.
export const demoEvaluatorMethod=Object.freeze({version:demoEvaluatorVersion,decisions:'closed-bar;next-open;single-entry-per-bar',indicators:'SMA-close;Wilder-RSI;preceding-window-breakout;PRICE_SMA-ratio;RETURN-percent',fills:'adverse-per-side-slippage;gap-stop-open;gap-target-at-target;dual-touch-stop-first',allocation:'total-equity-percent;DCA-lifetime-filled-entry-partitions;GRID-close-crossing-active-level-partitions',risk:'virtual-linear-LONG-SHORT;uncapped-loss;collateral-deficit-terminal;UTC-open-day-latched-loss;emergency-next-observable-boundary',baseline:'cost-inclusive-LONG-first-next-open-to-final-close;same-initial-allocation;SHORT-not-comparable'});
export const demoLimits={requestBytes:524288,artifactBytes:8388608,bars:2000,signals:500,trades:2000,audit:12000} as const;
export const demoTimeframes={'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const finite=z.number().finite(),positive=finite.positive(),index=z.number().int().min(0).max(demoLimits.bars-1);
const text=(max:number)=>z.string().trim().min(1).max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>{for(let n=0;n<3;n++){if(/og_agent_/i.test(value))return false;try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}}return true;},'Credentials cannot be retained in Demo artifacts.');
export const demoBarSchema=z.object({closedAt:clock,open:positive,high:positive,low:positive,close:positive,volume:finite.min(0)}).strict().refine(bar=>bar.high>=Math.max(bar.open,bar.close)&&bar.low<=Math.min(bar.open,bar.close)&&bar.low<=bar.high,'OHLC prices must be coherent.');
export type DemoBar=z.infer<typeof demoBarSchema>;
export const demoSignalSchema=z.object({id:uuid,provider:z.enum(['ALTFINS','TRADINGVIEW','CUSTOM']),event:z.enum(['BULLISH','BEARISH']),observedAt:clock,availableAt:clock}).strict();
export type DemoSignal=z.infer<typeof demoSignalSchema>;
export const demoDatasetSchema=z.object({version:z.literal(1),id:uuid,provenance:z.enum(['SYNTHETIC','USER_SUPPLIED']),rights:z.object({permission:z.enum(['CREATED_SYNTHETIC','AUTHORIZED_USE']),acknowledged:z.literal(true),note:text(1000)}).strict(),symbol:z.string().regex(/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/),timeframe:z.enum(['5m','15m','1h','4h','1d']),bars:z.array(demoBarSchema).min(2).max(demoLimits.bars)}).strict().superRefine((dataset,ctx)=>{
 const step=demoTimeframes[dataset.timeframe];
 if((dataset.provenance==='SYNTHETIC')!==(dataset.rights.permission==='CREATED_SYNTHETIC'))ctx.addIssue({code:z.ZodIssueCode.custom,path:['rights'],message:'Data permission must agree with the claimed provenance.'});
 dataset.bars.forEach((bar,n)=>{const time=Date.parse(bar.closedAt);if(time%step!==0||n>0&&time-Date.parse(dataset.bars[n-1].closedAt)!==step)ctx.addIssue({code:z.ZodIssueCode.custom,path:['bars',n,'closedAt'],message:'Bars must be increasing, epoch-aligned and contiguous closed intervals.'});});
});
export type DemoDataset=z.infer<typeof demoDatasetSchema>;
export const demoRequestSchema=z.object({version:z.literal(1),requestId:uuid,evaluatorVersion:z.literal(demoEvaluatorVersion),strategy:z.object({record:strategyRecordSchema,digest:hash}).strict(),dataset:demoDatasetSchema,signals:z.array(demoSignalSchema).max(demoLimits.signals),initialCapital:finite.min(.01).max(1000000),hypothesis:text(2000),falsification:text(2000),emergencyStopAt:clock.nullable()}).strict().superRefine((request,ctx)=>{
 const market=request.strategy.record.content.definition.market,dataset=request.dataset;
 if(market.symbol!==dataset.symbol||market.timeframe!==dataset.timeframe)ctx.addIssue({code:z.ZodIssueCode.custom,path:['dataset'],message:'The dataset must match the exact strategy market and timeframe.'});
 const times=new Set(dataset.bars.map(bar=>bar.closedAt)),first=Date.parse(dataset.bars[0].closedAt),last=Date.parse(dataset.bars.at(-1)!.closedAt),ids=new Set<string>(),events=new Set<string>();
 request.signals.forEach((signal,n)=>{
  const key=signal.provider+':'+signal.event+':'+signal.observedAt;
  if(ids.has(signal.id)||events.has(key))ctx.addIssue({code:z.ZodIssueCode.custom,path:['signals',n],message:'Signal IDs and provider/event/observation tuples must be unique.'});ids.add(signal.id);events.add(key);
  if(!times.has(signal.observedAt)||Date.parse(signal.availableAt)<Date.parse(signal.observedAt)||Date.parse(signal.availableAt)>last)ctx.addIssue({code:z.ZodIssueCode.custom,path:['signals',n],message:'Signals must name an included closed bar and become available after observation, within the dataset.'});
 });
 if(request.emergencyStopAt!==null&&(Date.parse(request.emergencyStopAt)<first-demoTimeframes[dataset.timeframe]||Date.parse(request.emergencyStopAt)>last))ctx.addIssue({code:z.ZodIssueCode.custom,path:['emergencyStopAt'],message:'Emergency stop must occur within the supplied intervals.'});
});
export type DemoRequest=z.infer<typeof demoRequestSchema>;
export const demoReasons=['INVALID_INPUT','DIGEST_MISMATCH','NO_TRADES','WARMUP','MISSING_SIGNAL','PROVIDER_MISMATCH','EVENT_MISMATCH','STALE_SIGNAL','SIGNAL_CONSUMED','SIGNAL_UNUSED','ALLOCATION_LIMIT','POSITION_LIMIT','CASH_LIMIT','GRID_LEVEL_ACTIVE','DCA_EXHAUSTED','ENTRY_RULE','GRID_CROSS','DCA_INTERVAL','STOP_LOSS','TAKE_PROFIT','END_OF_DATA','DAILY_LOSS','DAILY_RESET','EMERGENCY_STOP','INSOLVENT','NUMERICAL_LIMIT','RESULT_LIMIT'] as const;
const reason=z.enum(demoReasons);
export const demoAuditSchema=z.object({barIndex:index.nullable(),at:clock.nullable(),type:z.enum(['DECISION','REJECTION','ENTRY','EXIT','HALT','RESET','FAILURE','WARMUP','SIGNAL']),reason,positionId:z.string().max(48).nullable(),signalId:uuid.nullable(),details:z.string().max(240)}).strict();
export type DemoAudit=z.infer<typeof demoAuditSchema>;
export const demoTradeSchema=z.object({id:z.string().min(1).max(48),direction:z.enum(['LONG','SHORT']),entryBar:index,exitBar:index,entryAt:clock,exitAt:clock,quantity:positive,entryPrice:positive,exitPrice:positive,collateral:positive,entryFee:finite.min(0),exitFee:finite.min(0),grossPnl:finite,netPnl:finite,reason:z.enum(['STOP_LOSS','TAKE_PROFIT','END_OF_DATA','DAILY_LOSS','EMERGENCY_STOP','INSOLVENT']),gridLevel:z.number().int().min(0).max(29).nullable(),signalId:uuid.nullable()}).strict();
export type DemoTrade=z.infer<typeof demoTradeSchema>;
export const demoEquitySchema=z.object({barIndex:index,closedAt:clock,equity:finite,cash:finite,reservedCollateral:finite.min(0),openPositions:z.number().int().min(0).max(5),dailyHalted:z.boolean()}).strict();
export type DemoEquity=z.infer<typeof demoEquitySchema>;
export const demoMetricsSchema=z.object({initialCapital:positive,finalEquity:finite,netPnl:finite,returnPct:finite,maxDrawdownPct:finite.min(0),trades:z.number().int().min(0).max(demoLimits.trades),wins:z.number().int().min(0),losses:z.number().int().min(0),totalFees:finite.min(0),turnover:finite.min(0),comparable:z.boolean()}).strict();
export const demoBenchmarkSchema=z.object({status:z.enum(['COMPLETED','FAILED']),reason:reason.nullable(),allocationPct:positive,direction:z.literal('LONG'),initialCapital:positive,finalEquity:finite,netPnl:finite,returnPct:finite,totalFees:finite.min(0),comparable:z.boolean()}).strict();
export const demoArtifactSchema=z.object({version:z.literal(1),requestId:uuid.nullable(),evaluatorVersion:z.literal(demoEvaluatorVersion),classification:z.literal('AUTHOR_REPORTED'),mode:z.literal('SIMULATED'),ordersEnabled:z.literal(false),status:z.enum(['COMPLETED','NO_TRADES','HALTED','REJECTED','FAILED']),reason:reason.nullable(),input:demoRequestSchema.nullable(),digests:z.object({request:hash.nullable(),strategy:hash.nullable(),dataset:hash.nullable(),signals:hash.nullable(),evaluator:hash}).strict(),audit:z.array(demoAuditSchema).max(demoLimits.audit),trades:z.array(demoTradeSchema).max(demoLimits.trades),equity:z.array(demoEquitySchema).max(demoLimits.bars),metrics:demoMetricsSchema.nullable(),benchmark:demoBenchmarkSchema.nullable(),resultDigest:hash}).strict().superRefine((artifact,ctx)=>{
 if(artifact.status==='REJECTED'&&(artifact.input!==null||artifact.metrics!==null||artifact.benchmark!==null||artifact.trades.length||artifact.equity.length))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Rejected unknown input cannot be retained as evaluated data.'});
 if(artifact.input&&(artifact.input.requestId!==artifact.requestId||artifact.digests.strategy!==artifact.input.strategy.digest))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Artifact identity must match the retained input.'});
 if(artifact.status==='FAILED'&&artifact.metrics?.comparable)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Failed replay cannot claim comparable performance.'});
});
export type DemoArtifact=z.infer<typeof demoArtifactSchema>;
export class DemoError extends Error{constructor(message:string,public status=400){super(message);}}
export function boundedDemoRequest(raw:unknown){const input=demoRequestSchema.parse(raw),payload=JSON.stringify(input);if(new TextEncoder().encode(payload).byteLength>demoLimits.requestBytes)throw new DemoError('Demo input exceeds the local byte budget.',413);boundedStrategyRecord(input.strategy.record);return {input,payload};}
export async function demoArtifactDigest(artifact:DemoArtifact){const {resultDigest:_,...body}=demoArtifactSchema.parse(artifact);return strategyDigest(JSON.stringify(body));}
/** Digest checks establish byte identity, never correctness or independent reproduction. */
export async function verifyDemoArtifact(raw:unknown){let artifact:DemoArtifact;try{artifact=demoArtifactSchema.parse(raw);}catch{throw new DemoError('Invalid Demo artifact.');}if(new TextEncoder().encode(JSON.stringify(artifact)).byteLength>demoLimits.artifactBytes||await demoArtifactDigest(artifact)!==artifact.resultDigest||artifact.digests.evaluator!==await strategyDigest(JSON.stringify(demoEvaluatorMethod)))throw new DemoError('Demo artifact digest, declared evaluator or byte budget is invalid.');if(artifact.input){const {input,payload}=boundedDemoRequest(artifact.input);if(await strategyDigest(payload)!==artifact.digests.request||await strategyDigest(boundedStrategyRecord(input.strategy.record).payload)!==artifact.digests.strategy||await strategyDigest(JSON.stringify(input.dataset))!==artifact.digests.dataset||await strategyDigest(JSON.stringify(input.signals))!==artifact.digests.signals)throw new DemoError('Demo input digests do not match.');}return artifact;}
export type DemoStrategy={record:StrategyRecord;digest:string};
