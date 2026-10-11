import {z} from 'zod';
import {strategyDefinitionSchema,strategyPublicItemSchema,strategyDigest} from './strategy-model';
import {searchLedgerSchema,verifySearchLedger,pendingSearchAttempt,type SearchLedger} from './search-protocol';
import {boundedSessionConfig,sessionConfigSchema,sessionVersion,type SessionConfig} from './session-model';
import {sessionSourceFingerprints} from './session-fingerprints';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';

/** Wrapper capacity includes the complete 64 MiB ledger, source/config and fixed metadata. */
export const forwardDemoLimits={handoffBytes:68157440,planBytes:69206016,maximumDepth:32,maximumNodes:1800000,pollMsMin:15000,pollMsMax:3600000,cycles:120} as const;
export class ForwardDemoError extends Error{constructor(message:string,public status=400){super(message);}}
const hash=z.string().regex(/^[a-f0-9]{64}$/),uuid=z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const labels={classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),providerAuthenticity:z.literal('NOT_ESTABLISHED'),clockEvidence:z.literal('AUTHOR_DECLARED'),ordersEnabled:z.literal(false),liveEnabled:z.literal(false)};
const flags={classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',providerAuthenticity:'NOT_ESTABLISHED',clockEvidence:'AUTHOR_DECLARED',ordersEnabled:false,liveEnabled:false} as const;
const definitions=strategyDefinitionSchema.innerType().shape;
const handoffBody=z.object({version:z.literal(1),kind:z.literal('LOCKED_SEARCH_HANDOFF'),...labels,ledger:searchLedgerSchema,winner:z.object({candidateId:uuid,source:strategyPublicItemSchema}).strict(),initialCapital:z.number().finite().min(.01).max(1000000),hypothesis:z.string(),falsification:z.string(),costs:definitions.costs,risk:definitions.risk}).strict();
export const lockedSearchHandoffSchema=handoffBody.extend({handoffDigest:hash});
export type LockedSearchHandoff=z.infer<typeof lockedSearchHandoffSchema>;
const implementationSchema=z.object({session:z.object({version:z.literal(sessionVersion),engine:hash,model:hash,journal:hash}).strict(),evaluators:z.object({primary:hash,reference:hash}).strict()}).strict();
const currentImplementations=()=>({session:{version:sessionVersion,...sessionSourceFingerprints},evaluators:{...evaluatorSourceFingerprints}});
const planBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_FORWARD_DEMO_PLAN'),...labels,handoff:lockedSearchHandoffSchema,config:sessionConfigSchema,configDigest:hash,implementations:implementationSchema,preparedAt:clock,startsAt:clock,endsAt:clock,pollMs:z.number().int().min(forwardDemoLimits.pollMsMin).max(forwardDemoLimits.pollMsMax),cycles:z.number().int().min(1).max(forwardDemoLimits.cycles)}).strict();
export const forwardDemoPlanSchema=planBody.extend({planDigest:hash});
export type ForwardDemoPlan=z.infer<typeof forwardDemoPlanSchema>;
export type ForwardDemoPlanInput={handoff:unknown,config:unknown,preparedAt:string,startsAt:string,endsAt:string,pollMs:number,cycles:number};
const inputSchema=planBody.pick({handoff:true,config:true,preparedAt:true,startsAt:true,endsAt:true,pollMs:true,cycles:true});
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
function assert(ok:boolean,message:string,status=409):asserts ok{if(!ok)throw new ForwardDemoError(message,status);}
function credential(value:string){
 for(let n=0;n<=32;n++){
  if(/og_(?:agent|local_(?:producer|owner))_|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-|svcacct-|ant-)[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|Bearer\s+[^\s"'<>]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value))return true;
  const decoded=value.replace(/(?:%[a-f0-9]{2})+/gi,part=>{try{return decodeURIComponent(part);}catch{return part.replace(/%([a-f0-9]{2})/gi,(_,pair:string)=>String.fromCharCode(parseInt(pair,16)));}});
  if(decoded===value)return false;if(n===32)return true;value=decoded;
 }
 return true;
}
/** Descriptors are inspected before schemas or serialization can touch supplied hooks. */
export function boundedForwardDemoValue(raw:unknown,maximum:number=forwardDemoLimits.planBytes){
 let nodes=0;const ancestors=new Set<object>();
 function walk(value:unknown,depth:number):void{
  assert(++nodes<=forwardDemoLimits.maximumNodes&&depth<=forwardDemoLimits.maximumDepth,'Forward Demo structure exceeds its fixed budget.',413);
  if(typeof value==='string'){assert(!credential(value),'Credentials cannot enter forward Demo evidence.',400);return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  assert(!!value&&typeof value==='object'&&!ancestors.has(value)&&!Object.getOwnPropertySymbols(value).length,'Forward Demo requires plain finite JSON.',400);
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  assert(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'Forward Demo requires plain JSON containers.',400);
  if(array)assert(Object.keys(descriptors).length===(value as unknown[]).length+1,'Forward Demo arrays must be complete.',400);
  ancestors.add(value);
  for(const [key,descriptor] of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   assert(!credential(key)&&'value'in descriptor&&descriptor.enumerable===true&&(!array||/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<(value as unknown[]).length),'Forward Demo hooks, credentials and hidden fields are refused.',400);
   walk(descriptor.value,depth+1);
  }
  ancestors.delete(value);
 }
 walk(raw,0);assert(bytes(raw)<=maximum,'Forward Demo material exceeds its byte budget.',413);return raw;
}
function unchanged(left:unknown,right:unknown):boolean{if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&unchanged(a[key],b[key]));}
function parsed<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T{boundedForwardDemoValue(raw,maximum);try{const value=schema.parse(raw);assert(unchanged(raw,value),'Forward Demo requires canonical unchanged material.',400);return value;}catch(error){if(error instanceof ForwardDemoError)throw error;throw new ForwardDemoError('Forward Demo material does not match its strict contract.');}}
/** Frozen local evidence only; complete verification does not attest external execution. */
export async function createLockedSearchHandoff(raw:unknown):Promise<LockedSearchHandoff>{
 boundedForwardDemoValue(raw,forwardDemoLimits.handoffBytes);const ledger=await verifySearchLedger(raw);
 assert(ledger.selection?.decision==='SELECTED'&&!!ledger.selection.selectedCandidateId&&!pendingSearchAttempt(ledger),'A locked SELECTED result with no pending attempt is required.');
 const source=ledger.plan.admission.candidates.find(candidate=>candidate.source.id===ledger.selection!.selectedCandidateId)!.source;
 assert(source.state==='VISIBLE'&&!!source.record,'The exact visible winning source snapshot is required.');
 const definition=source.record.content.definition,body=handoffBody.parse({version:1,kind:'LOCKED_SEARCH_HANDOFF',...flags,ledger,winner:{candidateId:source.id,source},initialCapital:ledger.plan.admission.initialCapital,hypothesis:ledger.plan.admission.hypothesis,falsification:ledger.plan.admission.falsification,costs:definition.costs,risk:definition.risk});
 const value=lockedSearchHandoffSchema.parse({...body,handoffDigest:await strategyDigest(JSON.stringify(body))});boundedForwardDemoValue(value,forwardDemoLimits.handoffBytes);return value;
}
export async function verifyLockedSearchHandoff(raw:unknown):Promise<LockedSearchHandoff>{const value=parsed(raw,lockedSearchHandoffSchema,forwardDemoLimits.handoffBytes),expected=await createLockedSearchHandoff(value.ledger);assert(unchanged(value,expected),'Locked handoff differs from its complete original ledger.');return expected;}
/** All actually retained selection/admission/completion and observation clocks remain unchanged. */
function retainedClock(ledger:SearchLedger){
 const clocks=[ledger.plan.createdAt,ledger.plan.admission.createdAt,ledger.selection!.lockedAt,...ledger.events.map(event=>event.at)];
 for(const candidate of ledger.plan.admission.candidates){clocks.push(candidate.source.createdAt,candidate.source.record!.createdAt,...candidate.source.moderation.map(event=>event.createdAt));}
 for(const attempt of ledger.attempts){clocks.push(attempt.startedAt);if(attempt.finishedAt)clocks.push(attempt.finishedAt);clocks.push(...attempt.input.dataset.bars.map(bar=>bar.closedAt),...attempt.input.signals.flatMap(signal=>[signal.observedAt,signal.availableAt]));}
 return Math.max(...clocks.map(value=>Date.parse(value)));
}
function exactConfig(handoff:LockedSearchHandoff,raw:unknown):SessionConfig{
 const {config}=boundedSessionConfig(raw);assert(unchanged(raw,config),'Receiver configuration must remain canonical and unchanged.',400);
 assert(config.clockMode==='SYSTEM_RECEIPT'&&config.origin==='PUBLIC_STRATEGY'&&config.provenance==='USER_SUPPLIED'&&config.rights.permission==='AUTHORIZED_USE','Forward Demo requires a public SYSTEM_RECEIPT config with newly acknowledged authorized data rights.');
 assert(unchanged(config.strategy.record,handoff.winner.source.record)&&config.strategy.digest===handoff.winner.source.digest&&config.initialCapital===handoff.initialCapital,'Forward Demo must retain the exact selected strategy, costs, risk and capital.');return config;
}
/** Future local declaration, not independent precommit/custody or an execution request. */
export async function createForwardDemoPlan(raw:ForwardDemoPlanInput):Promise<ForwardDemoPlan>{
 const input=parsed(raw,inputSchema,forwardDemoLimits.planBytes),handoff=await verifyLockedSearchHandoff(input.handoff),config=exactConfig(handoff,input.config);
 assert(Date.parse(input.startsAt)>Date.parse(input.preparedAt)&&Date.parse(input.startsAt)>retainedClock(handoff.ledger),'The nominal interval must start strictly after preparation and all retained search clocks.');
 assert(Date.parse(input.endsAt)>Date.parse(input.startsAt),'The nominal interval must end after it starts.');
 const body=planBody.parse({version:1,kind:'LOCAL_FORWARD_DEMO_PLAN',...flags,handoff,config,configDigest:await strategyDigest(JSON.stringify(config)),implementations:currentImplementations(),preparedAt:input.preparedAt,startsAt:input.startsAt,endsAt:input.endsAt,pollMs:input.pollMs,cycles:input.cycles});
 const value=forwardDemoPlanSchema.parse({...body,planDigest:await strategyDigest(JSON.stringify(body))});boundedForwardDemoValue(value,forwardDemoLimits.planBytes);return value;
}
/** Historical consistency verification never grants fresh process admission. */
export async function verifyForwardDemoPlan(raw:unknown):Promise<ForwardDemoPlan>{const value=parsed(raw,forwardDemoPlanSchema,forwardDemoLimits.planBytes),expected=await createForwardDemoPlan({handoff:value.handoff,config:value.config,preparedAt:value.preparedAt,startsAt:value.startsAt,endsAt:value.endsAt,pollMs:value.pollMs,cycles:value.cycles});assert(unchanged(value,expected),'Forward plan digest, implementation or retained bindings are inconsistent.');return expected;}
