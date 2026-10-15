import {z} from 'zod';
import {strategyPublicItemSchema,strategyDigest} from './strategy-model';
import {programSearchLedgerSchema,verifyProgramSearchLedger,pendingProgramSearchAttempt,type ProgramSearchLedger} from './program-search-protocol';
import {boundedProgramSessionConfig,programSessionConfigSchema,programSessionVersion,programSessionJournalBodySchema,programSessionImplementation,type ProgramSessionConfig} from './program-session-model';
import {verifyProgramSessionJournal,type ProgramSessionJournal} from './program-session-journal';
import {demoTimeframes} from './demo-model';

/** Distinct whole-ledger budgets; never put 128 MiB program evidence in V1 wrappers. */
export const programForwardLimits=Object.freeze({handoffBytes:138412032,planBytes:139460608,historyBytes:174063616,reconstructionBytes:68157440,depth:40,nodes:8500000,pollMsMin:15000,pollMsMax:3600000,cycles:120});
export class ProgramForwardError extends Error{constructor(message:string,public status=400){super(message);}}
const hash=z.string().regex(/^[a-f0-9]{64}$/),uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const labels={classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),providerAuthenticity:z.literal('NOT_ESTABLISHED'),clockEvidence:z.literal('AUTHOR_DECLARED'),ordersEnabled:z.literal(false),liveEnabled:z.literal(false)};
const flags={classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',providerAuthenticity:'NOT_ESTABLISHED',clockEvidence:'AUTHOR_DECLARED',ordersEnabled:false,liveEnabled:false} as const;
const body=z.object({version:z.literal(1),kind:z.literal('LOCKED_PROGRAM_SEARCH_HANDOFF'),...labels,ledger:programSearchLedgerSchema,winner:z.object({candidateId:uuid,source:strategyPublicItemSchema}).strict(),initialCapital:z.number().finite().min(.01).max(1000000),hypothesis:z.string(),falsification:z.string()}).strict();
export const lockedProgramSearchHandoffSchema=body.extend({handoffDigest:hash});
export type LockedProgramSearchHandoff=z.infer<typeof lockedProgramSearchHandoffSchema>;
const planBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_FORWARD_PLAN'),...labels,mode:z.enum(['PROSPECTIVE','SYNTHETIC_EXERCISE']),handoff:lockedProgramSearchHandoffSchema,config:programSessionConfigSchema,configDigest:hash,implementation:programSessionJournalBodySchema.shape.implementation,preparedAt:clock,startsAt:clock,endsAt:clock,pollMs:z.number().int().min(programForwardLimits.pollMsMin).max(programForwardLimits.pollMsMax),cycles:z.number().int().min(1).max(programForwardLimits.cycles)}).strict();
export const programForwardPlanSchema=planBody.extend({planDigest:hash});
export type ProgramForwardPlan=z.infer<typeof programForwardPlanSchema>;
export type ProgramForwardPlanInput={mode:'PROSPECTIVE'|'SYNTHETIC_EXERCISE';handoff:unknown;config:unknown;preparedAt:string;startsAt:string;endsAt:string;pollMs:number;cycles:number};
const inputSchema=planBody.pick({mode:true,handoff:true,config:true,preparedAt:true,startsAt:true,endsAt:true,pollMs:true,cycles:true});
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
function unchanged(left:unknown,right:unknown):boolean{if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&unchanged(a[key],b[key]));}
function assert(ok:boolean,message:string,status=409):asserts ok{if(!ok)throw new ProgramForwardError(message,status);}
function credential(value:string){for(let n=0;n<33;n++){if(/og_(?:agent|local_(?:producer|owner))_|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-|svcacct-|ant-)[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|Bearer\s+[^\s"'<>]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value))return true;const next=value.replace(/(?:%[a-f0-9]{2})+/gi,part=>{try{return decodeURIComponent(part);}catch{return part.replace(/%([a-f0-9]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16)));}});if(next===value)return false;value=next;}return true;}
/** Inspect descriptors before schemas/serialization; supplied getters never run. */
export function boundedProgramForwardValue(raw:unknown,maximum:number=programForwardLimits.historyBytes){
 let nodes=0;const path=new Set<object>();
 function walk(value:unknown,depth:number):void{
  assert(++nodes<=programForwardLimits.nodes&&depth<=programForwardLimits.depth,'Program forward structure exceeds its fixed budget.',413);
  if(typeof value==='string'){assert(!credential(value),'Credentials cannot enter program forward evidence.',400);return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  assert(!!value&&typeof value==='object'&&!path.has(value)&&Object.getOwnPropertySymbols(value).length===0,'Program forward evidence requires plain finite JSON.',400);
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  assert(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'Program forward evidence requires plain JSON containers.',400);
  if(array)assert(Object.keys(descriptors).length===(value as unknown[]).length+1,'Dense JSON arrays are required.',400);
  path.add(value);for(const[key,descriptor]of Object.entries(descriptors)){if(array&&key==='length')continue;assert(!credential(key)&&'value'in descriptor&&descriptor.enumerable===true&&(!array||/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<(value as unknown[]).length),'Hooks, hidden fields and credentials are refused.',400);walk(descriptor.value,depth+1);}path.delete(value);
 }
 walk(raw,0);assert(new TextEncoder().encode(JSON.stringify(raw)).byteLength<=maximum,'Program forward evidence exceeds its complete byte budget.',413);return raw;
}
function parse<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T{boundedProgramForwardValue(raw,maximum);try{const value=schema.parse(raw);assert(unchanged(raw,value),'Canonical unchanged program forward material is required.',400);return value;}catch(error){if(error instanceof ProgramForwardError)throw error;throw new ProgramForwardError('Program forward material does not match its strict contract.');}}
export async function createLockedProgramSearchHandoff(raw:unknown):Promise<LockedProgramSearchHandoff>{
 boundedProgramForwardValue(raw,programForwardLimits.handoffBytes);const ledger=await verifyProgramSearchLedger(raw),test=ledger.attempts.filter(attempt=>attempt.phase==='TEST');
 assert(ledger.selection?.decision==='SELECTED'&&!!ledger.selection.selectedCandidateId&&!pendingProgramSearchAttempt(ledger),'A locked SELECTED program search with every attempt terminal is required.');
 assert(test.length===1&&test[0].status!=='RUNNING'&&test[0].finishedAt!==null,'The sole TEST must be consumed and terminal, including failure or interruption.');
 assert(ledger.attempts.filter(attempt=>attempt.phase==='TRAIN').length===ledger.plan.admission.candidates.length,'Every frozen TRAIN must remain retained.');
 const source=ledger.plan.admission.candidates.find(candidate=>candidate.source.id===ledger.selection!.selectedCandidateId)!.source;assert(source.state==='VISIBLE'&&source.record?.version===2,'The exact visible original V2 winner is required.');
 const value=body.parse({version:1,kind:'LOCKED_PROGRAM_SEARCH_HANDOFF',...flags,ledger,winner:{candidateId:source.id,source},initialCapital:ledger.plan.admission.initialCapital,hypothesis:ledger.plan.admission.hypothesis,falsification:ledger.plan.admission.falsification});
 const sealed=lockedProgramSearchHandoffSchema.parse({...value,handoffDigest:await digest(value)});boundedProgramForwardValue(sealed,programForwardLimits.handoffBytes);return sealed;
}
export async function verifyLockedProgramSearchHandoff(raw:unknown){const value=parse(raw,lockedProgramSearchHandoffSchema,programForwardLimits.handoffBytes),expected=await createLockedProgramSearchHandoff(value.ledger);assert(same(value,expected),'The handoff must retain the complete unchanged search ledger.');return expected;}
export function retainedProgramSearchClock(ledger:ProgramSearchLedger){
 const test=ledger.plan.admission.test,clocks=[ledger.plan.createdAt,ledger.plan.admission.createdAt,ledger.selection!.lockedAt,...ledger.events.map(event=>event.at),test.firstClosedAt,new Date(Date.parse(test.firstClosedAt)+(test.barCount-1)*demoTimeframes[ledger.plan.protocol.market.timeframe]).toISOString()];
 for(const candidate of ledger.plan.admission.candidates)clocks.push(candidate.source.createdAt,candidate.source.record!.createdAt,...candidate.source.moderation.map(event=>event.createdAt));
 for(const attempt of ledger.attempts){clocks.push(attempt.startedAt,...attempt.input.dataset.bars.map(bar=>bar.closedAt));if(attempt.finishedAt)clocks.push(attempt.finishedAt);if(attempt.outcome)clocks.push(...attempt.outcome.signals.flatMap(signal=>[signal.observedAt,signal.availableAt]));}
 return Math.max(...clocks.map(value=>Date.parse(value)));
}
export async function createProgramForwardPlan(raw:ProgramForwardPlanInput):Promise<ProgramForwardPlan>{
 const input=parse(raw,inputSchema,programForwardLimits.planBytes),handoff=await verifyLockedProgramSearchHandoff(input.handoff),parsedConfig=boundedProgramSessionConfig(input.config),config=('config'in parsedConfig?parsedConfig.config:parsedConfig) as ProgramSessionConfig;
 assert(unchanged(config,input.config)&&!('planDigest'in config),'Plan config must stay canonical; the plan binds its digest without a circular config reference.');
 assert(same(config.strategy.record,handoff.winner.source.record)&&config.strategy.digest===handoff.winner.source.digest&&config.initialCapital===handoff.initialCapital&&config.methodVersion===programSessionVersion,'Exact winner, market, costs, risk and capital must remain unchanged.');
 if(input.mode==='PROSPECTIVE')assert(config.clockMode==='SYSTEM_RECEIPT'&&config.origin==='PUBLIC_STRATEGY'&&config.provenance==='USER_SUPPLIED'&&config.rights.permission==='AUTHORIZED_USE','Prospective forward data require newly confirmed authorized-use rights and the real receipt clock.');
 else assert(config.clockMode==='SYNTHETIC_PLAYBACK'&&config.origin==='SYNTHETIC_FIXTURE'&&config.provenance==='SYNTHETIC'&&config.rights.permission==='CREATED_SYNTHETIC','Synthetic exercises require an explicit virtual clock and invented-data rights.');
 assert(Date.parse(input.startsAt)>Date.parse(input.preparedAt)&&Date.parse(input.startsAt)>retainedProgramSearchClock(handoff.ledger),'Forward start must follow preparation and every retained search clock.');assert(Date.parse(input.endsAt)>Date.parse(input.startsAt),'Forward end must follow its start.');
 const value=planBody.parse({version:1,kind:'LOCAL_PROGRAM_FORWARD_PLAN',...flags,...input,handoff,config,configDigest:await digest(config),implementation:programSessionImplementation()}),sealed=programForwardPlanSchema.parse({...value,planDigest:await digest(value)});boundedProgramForwardValue(sealed,programForwardLimits.planBytes);return sealed;
}
export async function verifyProgramForwardPlan(raw:unknown){const value=parse(raw,programForwardPlanSchema,programForwardLimits.planBytes),expected=await createProgramForwardPlan({mode:value.mode,handoff:value.handoff,config:value.config,preparedAt:value.preparedAt,startsAt:value.startsAt,endsAt:value.endsAt,pollMs:value.pollMs,cycles:value.cycles});assert(same(value,expected),'Program forward plan identity or complete bindings changed.');return expected;}
export type ProgramForwardHistory={version:1;kind:'LOCAL_PROGRAM_FORWARD_HISTORY';plan:ProgramForwardPlan;journal:ProgramSessionJournal|null;historyDigest:string};
export async function createProgramForwardHistory(planRaw:unknown,journalRaw:unknown=null):Promise<ProgramForwardHistory>{
 const plan=await verifyProgramForwardPlan(planRaw),journal=journalRaw===null?null:await verifyProgramSessionJournal(journalRaw);assert(journal===null||same(journal.config,plan.config),'The journal must use the exact frozen plan configuration.');
 assert(journal===null||same(journal.implementation,plan.implementation),'The journal must retain the frozen forward, interpreter and kernel source identities.');
 assert(journal===null||Date.parse(journal.startedAt)>=Date.parse(plan.startsAt)&&Date.parse(journal.startedAt)<Date.parse(plan.endsAt),'Session admission must start inside its frozen nominal interval; later retained protective events are never discarded.');
 const value={version:1 as const,kind:'LOCAL_PROGRAM_FORWARD_HISTORY' as const,plan,journal},sealed={...value,historyDigest:await digest(value)};boundedProgramForwardValue(sealed);return sealed;
}
export async function verifyProgramForwardHistory(raw:unknown):Promise<ProgramForwardHistory>{boundedProgramForwardValue(raw);assert(!!raw&&typeof raw==='object'&&Object.keys(raw).sort().join(',')==='historyDigest,journal,kind,plan,version','Whole program forward history is required.',400);const value=raw as ProgramForwardHistory;assert(value.version===1&&value.kind==='LOCAL_PROGRAM_FORWARD_HISTORY','Unknown program forward history.',400);const expected=await createProgramForwardHistory(value.plan,value.journal);assert(same(value,expected),'Program forward history digest or original bindings changed.');return expected;}
/** A retained local reconstruction declaration; only the explicit Worker caller supplies an actual replay. */
export async function createProgramSessionReconstruction(originalRaw:unknown,reconstructedRaw:unknown,reconstructedAt:string){
 const originalJournal=await verifyProgramSessionJournal(originalRaw),reconstructedJournal=await verifyProgramSessionJournal(reconstructedRaw);clock.parse(reconstructedAt);assert(!originalJournal.pending&&same(originalJournal,reconstructedJournal),'The entire original program/trading journal must reconstruct unchanged.');
 const value={version:1 as const,kind:'LOCAL_PROGRAM_SESSION_RECONSTRUCTION' as const,...flags,generatorIndependence:'NOT_ESTABLISHED' as const,reconstructedAt,originalJournal,reconstructedJournal},sealed={...value,reconstructionDigest:await digest(value)};boundedProgramForwardValue(sealed,programForwardLimits.reconstructionBytes);return sealed;
}
