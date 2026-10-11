import {z} from 'zod';
import {strategyDigest} from './strategy-model';
import {boundedProgramRunInput,guardProgramData,programRunInputSchema,programRunOutcomeSchema,programRunLimits,programHash,programUuid,programClock,type ProgramRunInput} from './program-run-model';
import {validateProgramRunOutcome,interruptProgramRun,verifyProgramRunInput} from './program-run';
import {parseUniqueJson} from './unique-json';
import {programSourceBytes} from './program-source-model';
import {parseProgramModule,ProgramWasmError} from './program-wasm';

const run=z.object({kind:z.literal('RUN'),attemptId:programUuid,at:programClock,input:programRunInputSchema,inputDigest:programHash,outcome:programRunOutcomeSchema.nullable()}).strict();
const rejectionReasons=['INVALID_INPUT','INVALID_JSON','DIGEST_MISMATCH','MODULE_REJECTED','UNSAFE_INPUT','INPUT_UNAVAILABLE'] as const;
const rejection=z.object({kind:z.literal('INPUT_REJECTION'),attemptId:programUuid,at:programClock,inputDigest:programHash.nullable(),reason:z.enum(rejectionReasons),code:z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/).nullable(),rejectedInput:z.string().max(programRunLimits.inputBytes).nullable(),snapshotUnavailable:z.enum(['NOT_PROVIDED','UNSAFE_OR_UNBOUNDED']).nullable()}).strict();
const event=z.object({sequence:z.number().int().min(1).max(programRunLimits.attempts*2),at:programClock,type:z.enum(['ADMITTED','FINISHED','INPUT_REJECTED']),attemptId:programUuid,recordDigest:programHash,previous:programHash.nullable(),digest:programHash}).strict();
const body=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_RUN_LEDGER'),ledgerId:programUuid,createdAt:programClock,classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),ordersEnabled:z.literal(false),entries:z.array(z.discriminatedUnion('kind',[run,rejection])).max(programRunLimits.attempts),events:z.array(event).max(programRunLimits.attempts*2)}).strict();
export const programRunLedgerSchema=body.extend({ledgerDigest:programHash});
export type ProgramRunLedger=z.infer<typeof programRunLedgerSchema>;
const bytes=(raw:unknown)=>new TextEncoder().encode(JSON.stringify(raw)).byteLength;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(raw:unknown)=>strategyDigest(JSON.stringify(raw));
function admissionBody(slot:Extract<ProgramRunLedger['entries'][number],{kind:'RUN'}>){const {outcome,...value}=slot;void outcome;return value;}
async function seal(raw:unknown){guardProgramData(raw,programRunLimits.historyBytes,2000000);const {ledgerDigest:_,...value}=raw as Record<string,unknown>;void _;const contents=body.parse(value),result={...contents,ledgerDigest:await digest(contents)};if(bytes(result)>programRunLimits.historyBytes)throw Error('Program history capacity reached.');return programRunLedgerSchema.parse(result);}
async function events(ledger:ProgramRunLedger,type:z.infer<typeof event>['type'],attemptId:string,at:string,recordDigest:string){programClock.parse(at);if(at<(ledger.events.at(-1)?.at??ledger.createdAt))throw Error('Program history clock regressed.');const row={sequence:ledger.events.length+1,at,type,attemptId,recordDigest,previous:ledger.events.at(-1)?.digest??null};return [...ledger.events,{...row,digest:await digest(row)}];}

/** Append correlations, not proof against an operator editing an entire local history. */
export async function verifyProgramRunLedger(raw:unknown):Promise<ProgramRunLedger>{
 guardProgramData(raw,programRunLimits.historyBytes,2000000);const ledger=programRunLedgerSchema.parse(raw),{ledgerDigest,...value}=ledger;
 if(await digest(value)!==ledgerDigest)throw Error('Program history identity differs.');
 const slots=new Map<string,ProgramRunLedger['entries'][number]>();
 for(const slot of ledger.entries){
  if(slot.attemptId===ledger.ledgerId||slots.has(slot.attemptId))throw Error('Duplicate program history identity.');slots.set(slot.attemptId,slot);
  if(slot.kind==='INPUT_REJECTION'){
   if(slot.rejectedInput!==null){const snapshot=parseUniqueJson(slot.rejectedInput,programRunLimits.inputBytes,24);if(safeProgramRejectionSnapshot(snapshot)!==slot.rejectedInput||slot.snapshotUnavailable!==null||slot.inputDigest!==await strategyDigest(slot.rejectedInput))throw Error('Retained rejected program input differs.');}
   else if(slot.snapshotUnavailable===null)throw Error('Missing rejected input requires an explicit disposition.');
  }else{
   const {input,payload}=boundedProgramRunInput(slot.input);await verifyProgramRunInput(input);
   if(slot.inputDigest!==await strategyDigest(payload))throw Error('Program admission differs from its frozen input.');
   if(slot.outcome){const outcome=await validateProgramRunOutcome(slot.outcome,slot.input);if(outcome.attemptId!==slot.attemptId)throw Error('Program outcome differs from its original attempt.');}
  }
 }
 let previous:string|null=null,time=ledger.createdAt,active:string|null=null,position=0;const admitted=new Set<string>(),finished=new Set<string>();
 for(let n=0;n<ledger.events.length;n++){
  const row=ledger.events[n],{digest:identity,...contents}=row,slot=slots.get(row.attemptId);
  if(row.sequence!==n+1||row.previous!==previous||row.at<time||!slot||await digest(contents)!==identity)throw Error('Program event chain differs.');
  if(row.type==='ADMITTED'||row.type==='INPUT_REJECTED'){
   if(active||admitted.has(slot.attemptId)||ledger.entries[position]?.attemptId!==slot.attemptId||row.at!==slot.at)throw Error('Program admission chronology differs.');
   if(row.type==='ADMITTED'){if(slot.kind!=='RUN'||row.recordDigest!==await digest(admissionBody(slot)))throw Error('Program admission event differs.');active=slot.attemptId;}
   else if(slot.kind!=='INPUT_REJECTION'||row.recordDigest!==await digest(slot))throw Error('Program rejection event differs.');
   admitted.add(slot.attemptId);position++;
  }else{
   if(slot.kind!=='RUN'||!slot.outcome||active!==slot.attemptId||finished.has(slot.attemptId)||row.recordDigest!==slot.outcome.outcomeDigest)throw Error('Program terminal event differs.');finished.add(slot.attemptId);active=null;
  }
  previous=identity;time=row.at;
 }
 if(admitted.size!==slots.size||ledger.entries.some(slot=>slot.kind==='RUN'&&Boolean(slot.outcome)!==finished.has(slot.attemptId)))throw Error('Program history is incomplete.');
 if(ledger.entries.filter(slot=>slot.kind==='RUN'&&!slot.outcome).length>1)throw Error('Only one program attempt can remain pending.');
 // Reserve a complete worst-case outcome for any still pending attempt.
 if(active&&bytes(ledger)+programRunLimits.outcomeBytes+2048>programRunLimits.historyBytes)throw Error('Pending program attempt lacks retained capacity.');
 return ledger;
}
export async function createProgramRunLedger(ledgerId:string,createdAt:string){return seal({version:1,kind:'LOCAL_PROGRAM_RUN_LEDGER',ledgerId:programUuid.parse(ledgerId),createdAt:programClock.parse(createdAt),classification:'AUTHOR_REPORTED',qualification:'NONE',ordersEnabled:false,entries:[],events:[]});}
function capacity(ledger:ProgramRunLedger,reserve:number){if(ledger.entries.length>=programRunLimits.attempts||bytes(ledger)+reserve>programRunLimits.historyBytes)throw Error('Complete retained program history capacity reached.');if(ledger.entries.some(slot=>slot.kind==='RUN'&&!slot.outcome))throw Error('Execute or recover the original pending attempt first.');}
export async function admitProgramRun(raw:unknown,inputRaw:unknown,attemptId:string,at:string){
 const ledger=await verifyProgramRunLedger(raw),{input,payload}=boundedProgramRunInput(inputRaw);await verifyProgramRunInput(input);
 programUuid.parse(attemptId);programClock.parse(at);if(attemptId===ledger.ledgerId||ledger.entries.some(slot=>slot.attemptId===attemptId))throw Error('Program attempt identity already retained.');
 capacity(ledger,programRunLimits.outcomeBytes+bytes(input)+4096);
 const slot={kind:'RUN' as const,attemptId,at,input,inputDigest:await strategyDigest(payload),outcome:null};
 return seal({...ledger,entries:[...ledger.entries,slot],events:await events(ledger,'ADMITTED',attemptId,at,await digest(admissionBody(slot)))});
}
export async function finishProgramRun(raw:unknown,outcomeRaw:unknown,at:string){
 const ledger=await verifyProgramRunLedger(raw),outcome=await validateProgramRunOutcome(outcomeRaw),index=ledger.entries.findIndex(slot=>slot.attemptId===outcome.attemptId),slot=ledger.entries[index];
 if(!slot||slot.kind!=='RUN')throw Error('Original program admission is required.');
 if(slot.outcome){if(equal(slot.outcome,outcome))return ledger;throw Error('Program terminal result is immutable.');}
 await validateProgramRunOutcome(outcome,slot.input);if(outcome.inputDigest!==slot.inputDigest)throw Error('Program outcome input differs.');
 const entries=[...ledger.entries];entries[index]={...slot,outcome};return seal({...ledger,entries,events:await events(ledger,'FINISHED',slot.attemptId,at,outcome.outcomeDigest)});
}
/** Retain safe bounded rejected code/data for inspection; never retain embedded credentials. */
export function safeProgramRejectionSnapshot(raw:unknown):string|null{
 try{const payload=guardProgramData(raw,programRunLimits.inputBytes);function visit(value:unknown):void{if(typeof value==='number'&&Object.is(value,-0))throw Error('Negative zero cannot retain exact canonical JSON.');if(typeof value==='string'){let text=value;for(let n=0;n<32;n++){if(/og_(?:agent|local_owner|local_producer)_/i.test(text))throw Error('Credential.');const next=text.replace(/%[a-f0-9]{2}/gi,escape=>String.fromCharCode(Number.parseInt(escape.slice(1),16)));if(next===text)break;if(n===31)throw Error('Credential inspection bound.');text=next;}}else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if(/(?:token|secret|authorization|password|cookie|credential|api.?key)/i.test(key))throw Error('Credential field.');if(key==='bytesHex'&&typeof child==='string'&&/^(?:[a-f0-9]{2})+$/i.test(child))visit(new TextDecoder().decode(Uint8Array.from(child.match(/../g)!,pair=>Number.parseInt(pair,16))));visit(child);}}visit(raw);return payload;}catch{return null;}
}
export async function programInputRejectionDisposition(raw:unknown):Promise<{reason:typeof rejectionReasons[number];code:string|null}>{
 const snapshot=safeProgramRejectionSnapshot(raw);if(snapshot===null)return {reason:'UNSAFE_INPUT',code:null};
 const value=JSON.parse(snapshot) as {strategy?:{record?:{content?:{program?:{bytesHex?:unknown}}}}};const hex=value?.strategy?.record?.content?.program?.bytesHex;
 if(hex!==undefined){try{if(typeof hex!=='string')throw Error('Invalid binary.');parseProgramModule(programSourceBytes(hex));}catch(error){return {reason:'MODULE_REJECTED',code:error instanceof ProgramWasmError?error.code:'BINARY'};}}
 try{const {input}=boundedProgramRunInput(raw);try{await verifyProgramRunInput(input);}catch{return {reason:'DIGEST_MISMATCH',code:null};}}catch{return {reason:'INVALID_INPUT',code:null};}
 return {reason:'INVALID_INPUT',code:null};
}
export async function rejectProgramRun(raw:unknown,attemptId:string,at:string,inputDigest:string|null,options?:{rejectedInput?:unknown;reason?:typeof rejectionReasons[number];code?:string|null}){
 const ledger=await verifyProgramRunLedger(raw);programUuid.parse(attemptId);programClock.parse(at);if(inputDigest!==null)programHash.parse(inputDigest);
 const supplied=options!==undefined&&Object.hasOwn(options,'rejectedInput'),rejectedInput=supplied?safeProgramRejectionSnapshot(options?.rejectedInput):null;
 if(rejectedInput!==null)inputDigest=await strategyDigest(rejectedInput);
 if(attemptId===ledger.ledgerId||ledger.entries.some(slot=>slot.attemptId===attemptId))throw Error('Program attempt identity already retained.');capacity(ledger,(rejectedInput?bytes(rejectedInput):0)+4096);
 const slot=rejection.parse({kind:'INPUT_REJECTION',attemptId,at,inputDigest,reason:options?.reason??'INVALID_INPUT',code:options?.code??null,rejectedInput,snapshotUnavailable:rejectedInput===null?(supplied?'UNSAFE_OR_UNBOUNDED':'NOT_PROVIDED'):null});return seal({...ledger,entries:[...ledger.entries,slot],events:await events(ledger,'INPUT_REJECTED',attemptId,at,await digest(slot))});
}
export async function recoverProgramRunLedger(raw:unknown,at:string){let ledger=await verifyProgramRunLedger(raw);const pending=ledger.entries.find(slot=>slot.kind==='RUN'&&!slot.outcome);if(pending?.kind==='RUN')ledger=await finishProgramRun(ledger,await interruptProgramRun(pending.input,pending.attemptId,'INTERRUPTED','RECOVERY_INTERRUPTED'),at);return ledger;}
export function pendingProgramRun(ledger:ProgramRunLedger):{input:ProgramRunInput;attemptId:string}|null{const slot=ledger.entries.find(value=>value.kind==='RUN'&&!value.outcome);return slot?.kind==='RUN'?{input:slot.input,attemptId:slot.attemptId}:null;}
