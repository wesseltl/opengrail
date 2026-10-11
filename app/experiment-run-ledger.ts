import {z} from 'zod';
import {strategyDigest} from './strategy-model';
import {experimentRunSchema,experimentRunLimits,verifyExperimentRun,interruptExperimentRun,type ExperimentRun} from './experiment-runner';

const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const runSlot=z.object({kind:z.literal('RUN'),admission:experimentRunSchema,outcome:experimentRunSchema.nullable()}).strict();
const rejectionSlot=z.object({kind:z.literal('INPUT_REJECTION'),attemptId:uuid,at:clock,bundleDigest:hash.nullable(),reason:z.literal('INVALID_BOUNDED_BUNDLE')}).strict();
const event=z.object({sequence:z.number().int().min(1).max(32),at:clock,type:z.enum(['ADMITTED','FINISHED','INPUT_REJECTED']),attemptId:uuid,recordDigest:hash,previous:hash.nullable(),digest:hash}).strict();
const body=z.object({version:z.literal(1),kind:z.literal('LOCAL_EXPERIMENT_RUN_LEDGER'),ledgerId:uuid,createdAt:clock,classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false),entries:z.array(z.discriminatedUnion('kind',[runSlot,rejectionSlot])).max(experimentRunLimits.attempts),events:z.array(event).max(32)}).strict();
export const experimentRunLedgerSchema=body.extend({ledgerDigest:hash});
export type ExperimentRunLedger=z.infer<typeof experimentRunLedgerSchema>;
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const attemptId=(slot:ExperimentRunLedger['entries'][number])=>slot.kind==='RUN'?slot.admission.attemptId:slot.attemptId;
const identities=(slot:ExperimentRunLedger['entries'][number])=>slot.kind==='RUN'?[slot.admission.attemptId,slot.admission.outcomeRequestId,slot.admission.outcomeId]:[slot.attemptId];
async function seal(raw:unknown){const {ledgerDigest:ignored,...contents}=raw as Record<string,unknown>;void ignored;const value=body.parse(contents);if(bytes(value)+96>experimentRunLimits.historyBytes)throw Error('Local ledger capacity reached.');return experimentRunLedgerSchema.parse({...value,ledgerDigest:await strategyDigest(JSON.stringify(value))});}
async function appendEvent(ledger:ExperimentRunLedger,type:z.infer<typeof event>['type'],id:string,at:string,recordDigest:string){
 clock.parse(at);if(at<(ledger.events.at(-1)?.at??ledger.createdAt))throw Error('Local ledger clock regressed.');
 const row={sequence:ledger.events.length+1,at,type,attemptId:id,recordDigest,previous:ledger.events.at(-1)?.digest??null};
 return [...ledger.events,{...row,digest:await strategyDigest(JSON.stringify(row))}];
}

/** Checks identity, correlations and append order; never proves honest execution or an untouched file. */
export async function verifyExperimentRunLedger(raw:unknown):Promise<ExperimentRunLedger>{
 const ledger=experimentRunLedgerSchema.parse(raw),{ledgerDigest,...value}=ledger;
 if(bytes(ledger)>experimentRunLimits.historyBytes||await strategyDigest(JSON.stringify(value))!==ledgerDigest)throw Error('Local ledger identity failed.');
 const slots=new Map<string,ExperimentRunLedger['entries'][number]>(),finished=new Set<string>(),usedIdentities=new Set<string>();
 for(const slot of ledger.entries){
  const id=attemptId(slot);if(slots.has(id))throw Error('Duplicate local attempt.');slots.set(id,slot);
  for(const identity of identities(slot)){if(usedIdentities.has(identity))throw Error('Local attempt and publication identities must be distinct.');usedIdentities.add(identity);}
  if(slot.kind==='RUN'){
   const admission=await verifyExperimentRun(slot.admission);if(admission.status!=='RUNNING')throw Error('Admission cannot be a terminal result.');
   if(slot.outcome){const result=await verifyExperimentRun(slot.outcome);const {status,reason,artifact,comparison,finishedAt,runDigest,...fixed}=result;void status;void reason;void artifact;void comparison;void runDigest;
    const {status:_,reason:__,artifact:___,comparison:____,finishedAt:_____,runDigest:______,...original}=admission;void _;void __;void ___;void ____;void _____;void ______;
    if(result.status==='RUNNING'||!finishedAt||finishedAt<admission.startedAt||!equal(fixed,original))throw Error('A terminal result cannot change its admission.');
   }
  }
 }
 const admitted=new Set<string>();let previous:string|null=null,time=ledger.createdAt,active:string|null=null;
 for(let n=0;n<ledger.events.length;n++){
  const row=ledger.events[n],{digest,...contents}=row,slot=slots.get(row.attemptId);
  if(row.sequence!==n+1||row.previous!==previous||row.at<time||!slot||await strategyDigest(JSON.stringify(contents))!==digest)throw Error('Local ledger event chain failed.');
  if(row.type==='ADMITTED'){
   if(active||slot.kind!=='RUN'||admitted.has(row.attemptId)||attemptId(ledger.entries[admitted.size])!==row.attemptId||row.recordDigest!==slot.admission.runDigest||row.at!==slot.admission.startedAt)throw Error('Admission event differs.');admitted.add(row.attemptId);active=row.attemptId;
  }else if(row.type==='FINISHED'){
   if(active!==row.attemptId||slot.kind!=='RUN'||!admitted.has(row.attemptId)||finished.has(row.attemptId)||!slot.outcome||row.recordDigest!==slot.outcome.runDigest||row.at!==slot.outcome.finishedAt)throw Error('Terminal event differs.');finished.add(row.attemptId);active=null;
  }else{
   if(active||slot.kind!=='INPUT_REJECTION'||admitted.has(row.attemptId)||attemptId(ledger.entries[admitted.size])!==row.attemptId||row.at!==slot.at||row.recordDigest!==await strategyDigest(JSON.stringify(slot)))throw Error('Rejection event differs.');admitted.add(row.attemptId);
  }
  previous=digest;time=row.at;
 }
 if(admitted.size!==slots.size||ledger.entries.some(slot=>slot.kind==='RUN'&&Boolean(slot.outcome)!==finished.has(slot.admission.attemptId)))throw Error('Local ledger is incomplete.');
 if(ledger.entries.filter(slot=>slot.kind==='RUN'&&!slot.outcome).length>1)throw Error('Only one admitted run may remain pending.');
 return ledger;
}

export async function createExperimentRunLedger(ledgerId:string,createdAt:string){return seal({version:1,kind:'LOCAL_EXPERIMENT_RUN_LEDGER',ledgerId:uuid.parse(ledgerId),createdAt:clock.parse(createdAt),classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false,entries:[],events:[]});}
function capacity(ledger:ExperimentRunLedger,reserve:number){
 if(ledger.entries.length>=experimentRunLimits.attempts||bytes(ledger)+reserve>experimentRunLimits.historyBytes)throw Error('Retained attempt capacity reached.');
 if(ledger.entries.some(slot=>slot.kind==='RUN'&&!slot.outcome))throw Error('Recover or execute the pending attempt first.');
}
export async function admitExperimentRun(raw:unknown,run:unknown){
 const ledger=await verifyExperimentRunLedger(raw),admission=await verifyExperimentRun(run);if(admission.status!=='RUNNING')throw Error('Only a new pending run can be admitted.');
 capacity(ledger,experimentRunLimits.reservedAttemptBytes+bytes(admission)+4096);
 if(ledger.entries.some(slot=>identities(slot).some(identity=>[admission.attemptId,admission.outcomeRequestId,admission.outcomeId].includes(identity))))throw Error('Attempt or publication ID already retained.');
 return seal({...ledger,entries:[...ledger.entries,{kind:'RUN',admission,outcome:null}],events:await appendEvent(ledger,'ADMITTED',admission.attemptId,admission.startedAt,admission.runDigest)});
}
export async function finishExperimentRun(raw:unknown,run:unknown){
 const ledger=await verifyExperimentRunLedger(raw),outcome=await verifyExperimentRun(run);
 const index=ledger.entries.findIndex(slot=>attemptId(slot)===outcome.attemptId),slot=ledger.entries[index];
 if(!slot||slot.kind!=='RUN'||outcome.status==='RUNNING')throw Error('A retained admission is required.');
 if(slot.outcome){if(equal(slot.outcome,outcome))return ledger;throw Error('A retained terminal result cannot be replaced.');}
 const entries=[...ledger.entries];entries[index]={...slot,outcome};
 const next=await seal({...ledger,entries,events:await appendEvent(ledger,'FINISHED',outcome.attemptId,outcome.finishedAt!,outcome.runDigest)});
 return verifyExperimentRunLedger(next);
}
export async function retainExperimentInputRejection(raw:unknown,id:string,at:string,bundleDigest:string|null){
 const ledger=await verifyExperimentRunLedger(raw);capacity(ledger,4096);if(ledger.entries.some(slot=>identities(slot).includes(id)))throw Error('Attempt ID already retained.');
 const slot=rejectionSlot.parse({kind:'INPUT_REJECTION',attemptId:id,at,bundleDigest,reason:'INVALID_BOUNDED_BUNDLE'});
 return seal({...ledger,entries:[...ledger.entries,slot],events:await appendEvent(ledger,'INPUT_REJECTED',id,at,await strategyDigest(JSON.stringify(slot)))});
}
export async function recoverExperimentRunLedger(raw:unknown,at:string){
 let ledger=await verifyExperimentRunLedger(raw);
 for(const slot of ledger.entries)if(slot.kind==='RUN'&&!slot.outcome)ledger=await finishExperimentRun(ledger,await interruptExperimentRun(slot.admission,at,'RECOVERY_INTERRUPTED'));
 return ledger;
}
export function pendingExperimentRun(ledger:ExperimentRunLedger):ExperimentRun|null{const slot=ledger.entries.find(slot=>slot.kind==='RUN'&&!slot.outcome);return slot?.kind==='RUN'?slot.admission:null;}
