import {z} from 'zod';
import {
 ProgramWindowError, boundedProgramWindowValue, boundedPublicProgramWindowInput,
 programWindowDigest, programWindowMethod, programWindowPolicy,
 programWindowReferenceSchema, programWindowImplementationDeclarationSchema,
 verifyProgramWindowInput, type ProgramWindowInput,
} from './program-window-model';
import {
 programWindowRawArchiveSchema, boundedProgramWindowRawArchive, boundedPublicProgramWindowRawArchive,
 verifyProgramWindowRawArchive, verifyProgramWindowObservations, normalizeProgramWindowRequest,
 decodeProgramWindowRawBody, parseProgramWindowSourceDocument, type ProgramWindowRawArchive, type ProgramWindowObservationReport,
 programWindowObservationReportSchema,
} from './program-window-observation-model';
import {
 verifyProgramCommitmentEvidenceInput, verifyProgramCommitmentEvidenceArtifact,
 programCommitmentDependencies,
} from './program-commitment-model';
import {programSessionJournalBodySchema} from './program-session-model';
import type {ProgramForwardEvidenceInput, ProgramForwardEvidenceArtifact} from './program-forward-evidence-model';

/** Admission retains complete author evidence. It does not execute a guest or
 * turn a declared result into reconstructed or independent financial evidence. */
export const programWindowEvidenceLimits=Object.freeze({
 publicBytes:524288, localBytes:86048768, evaluatorBytes:8192,
 minimumRegistrationLeadMs:60000, maximumDepth:44, maximumNodes:262144,
});
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const text=(maximum:number)=>z.string().min(1).max(maximum);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function assert(value:boolean,message:string,status=400):asserts value {
 if(!value)throw new ProgramWindowError(message,status);
}
/** Pure identity work can be reused within one complete request. This scope has
 * no visibility, credentials, database observations, execution or authority.
 * Every key retains the whole original canonical input, never only its digest.
 * A full cache performs uncached verification; it never drops evidence. */
export class ProgramWindowEvidenceVerificationScope {
 #entries=new Map<string,Promise<unknown>>();
 #bytes=0;
 #hits=0;
 constructor(){Object.freeze(this);}
 stats(){return Object.freeze({entries:this.#entries.size,bytes:this.#bytes,hits:this.#hits});}
 #snapshot<T>(material:T):{payload:string;value:T}{
  const payload=boundedProgramWindowValue(material,2097152,44,262144);
  // The original plain-data guard runs before JSON parsing or any await.
  // Work must read this detached canonical value, never the caller's object.
  return {payload,value:JSON.parse(payload) as T};
 }
 #freeze<T>(value:T):T{
  const seen=new Set<object>();
  function freeze(raw:unknown):void{if(raw===null||typeof raw!=='object'||seen.has(raw))return;seen.add(raw);for(const value of Object.values(raw))freeze(value);Object.freeze(raw);}
  freeze(value);return value;
 }
 async #verify<M,T>(kind:string,material:M,work:(value:M)=>Promise<T>):Promise<T>{
  const {payload,value}=this.#snapshot(material),key=kind+'\n'+payload,previous=this.#entries.get(key);
  if(previous){this.#hits++;return previous as Promise<T>;}
  const size=new TextEncoder().encode(key).byteLength;
  const promise=Promise.resolve().then(()=>work(value)).then(result=>this.#freeze(result));
  if(this.#entries.size>=96||this.#bytes+size>8388608)return promise;
  this.#entries.set(key,promise);this.#bytes+=size;return promise;
 }
 verifyInput(raw:unknown){boundedPublicProgramWindowInput(raw);return this.#verify('WINDOW_INPUT',raw,value=>verifyProgramWindowInput(value));}
 verifyArchive(raw:unknown,input:ProgramWindowInput){boundedPublicProgramWindowRawArchive(raw);return this.#verify('RAW_ARCHIVE',{input,archive:raw},value=>verifyProgramWindowRawArchive(value.archive,value.input,'PUBLIC'));}
 verifyForwardInput(plan:ProgramWindowInput['plan'],raw:unknown,at:string){return this.#verify('FORWARD_INPUT',{plan,input:raw,at},value=>verifyProgramCommitmentEvidenceInput(value.plan,value.input,value.at));}
 verifyForwardArtifact(plan:ProgramWindowInput['plan'],raw:unknown,at:string){return this.#verify('FORWARD_ARTIFACT',{plan,artifact:raw,at},value=>verifyProgramCommitmentEvidenceArtifact(value.plan,value.artifact,value.at));}
 async verifyObservations(input:ProgramWindowInput,archive:ProgramWindowRawArchive,journal:ProgramForwardEvidenceArtifact['journal']|null,inspectedAt:string){
  // Snapshot before reading contributed clocks; neither accessors nor later
  // caller mutations can affect clock selection or a cached identity.
  ({input,archive,journal,inspectedAt}=this.#snapshot({input,archive,journal,inspectedAt}).value);
  clock.parse(inspectedAt);
  const clocks=[archive.startedAt,archive.closedAt,archive.clockFault?.at,archive.clockFault?.previousAt,
   ...archive.requests.flatMap(request=>[request.startedAt,request.finishedAt,request.normalizationAt]),
   ...archive.outbox.flatMap(entry=>[entry.createdAt,...entry.attempts.flatMap(attempt=>[attempt.startedAt,attempt.finishedAt,attempt.acknowledgedAt])]),
   journal?.startedAt,journal?.pending?.receivedAt,...journal?.events.flatMap(receipt=>[receipt.receivedAt,receipt.completedAt])??[],
  ].filter((value):value is string=>typeof value==='string');
  const maximumClock=clocks.reduce((maximum,value)=>value>maximum?value:maximum,archive.startedAt);
  if(inspectedAt<maximumClock)return this.#freeze(await verifyProgramWindowObservations(input,archive,{journal,inspectedAt}));
  // Once the proposed inspection follows every original retained clock, the
  // pure raw/journal correlation is identical. Only the newly declared report
  // inspection fields and digest change. Original observation clocks never do.
  // This does not establish an actual inspection clock, guest execution,
  // current visibility or credentials; those are separate request boundaries.
  const original=await this.#verify('OBSERVATION_CORRELATION',{input,archive,journal,maximumClock},value=>verifyProgramWindowObservations(value.input,value.archive,{journal:value.journal,inspectedAt:value.maximumClock}));
  const {reportDigest,...body}=original;void reportDigest;
  const updated={...body,inspectedAt,terminalMark:body.terminalMark?{...body.terminalMark,inspectedAt}:null};
  return this.#freeze(programWindowObservationReportSchema.parse({...updated,reportDigest:await programWindowDigest(updated)}));
 }
}
Object.freeze(ProgramWindowEvidenceVerificationScope.prototype);
function checkedScope(scope:ProgramWindowEvidenceVerificationScope|undefined){
 if(scope!==undefined)assert(Object.getPrototypeOf(scope)===ProgramWindowEvidenceVerificationScope.prototype,'Only the fixed request-local identity verification scope is supported.');
 return scope;
}
export const programWindowEvaluatorSchema=z.object({
 version:z.literal('opengrail-sampled-program-window-v1'),
 sourceVersion:text(80),
 legacyImplementation:programSessionJournalBodySchema.shape.implementation,
 newImplementation:programWindowImplementationDeclarationSchema,
 methodDigest:hash,
}).strict();
export type ProgramWindowEvaluator=z.infer<typeof programWindowEvaluatorSchema>;

/** These dispositions are attributed claims, not compact verified metrics. */
export const programWindowClosureDeclarationSchema=z.object({
 kind:z.literal('AUTHOR_DECLARED_WINDOW_CLOSURE'),
 verification:z.literal('NOT_ESTABLISHED'),
 observationStatus:z.enum(['COMPLETE_DECLARED_SAMPLE_PROTOCOL','INCOMPLETE','FAILED','INTERRUPTED','UNKNOWN']),
 computationStatus:z.enum(['RECONSTRUCTED_MATCH','RECONSTRUCTED_MISMATCH','FAILED','INTERRUPTED','UNAVAILABLE']),
 boundaryStatus:z.enum(['RECEIPT_AND_GUEST_COMPLETION_WITHIN_WINDOW','LATE_OR_UNBOUND_INPUT','UNRESOLVED_PENDING','NOT_ESTABLISHED']),
 settlementStatus:z.enum(['SETTLED','OPEN_EXPOSURE','PENDING_ENTRY','AWAITING_PROTECTIVE_EXIT','UNKNOWN']),
 terminalValuation:z.enum(['AVAILABLE','UNAVAILABLE','UNKNOWN']),
 observationReportDigest:hash.nullable(),
 reconstructionAttemptDigest:hash.nullable(),
 accountingReportDigest:hash.nullable(),
 reason:text(2000),
}).strict();
export type ProgramWindowClosureDeclaration=z.infer<typeof programWindowClosureDeclarationSchema>;
const evidenceBody=z.object({
 version:z.literal(1), kind:z.literal('WINDOW_EVIDENCE_LINK'),
 method:z.literal(programWindowMethod.localMethod),
 inputDigest:hash, protocolDigest:hash,
 manifest:programWindowReferenceSchema, outcome:programWindowReferenceSchema,
 rawArchive:programWindowRawArchiveSchema,
 closure:programWindowClosureDeclarationSchema,
 classification:z.literal('AUTHOR_REPORTED'), qualification:z.literal('NONE'),
 independence:z.literal('NOT_ESTABLISHED'),
 performanceInterpretation:z.literal('SAMPLED_DEMO_WITH_TERMINAL_MARK'),
 continuousMarketCoverage:z.literal(false), independentQualification:z.literal(false),
 executionEnabled:z.literal(false), ordersEnabled:z.literal(false), liveEnabled:z.literal(false),
}).strict();
export const programWindowEvidenceSchema=evidenceBody.extend({evidenceDigest:hash})
 .refine(value=>value.manifest.id!==value.outcome.id,'Original manifest and outcome must be distinct.');
export type ProgramWindowEvidence=z.infer<typeof programWindowEvidenceSchema>;

function parse<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T {
 const payload=boundedProgramWindowValue(raw,maximum,programWindowEvidenceLimits.maximumDepth,programWindowEvidenceLimits.maximumNodes);
 let value:T;
 try{value=schema.parse(raw);}catch{throw new ProgramWindowError('Window evidence does not match its strict inert contract.');}
 assert(JSON.stringify(value)===payload,'Complete original canonical window evidence is required.');
 return value;
}
export function boundedProgramWindowEvaluator(raw:unknown):ProgramWindowEvaluator {
 return parse(raw,programWindowEvaluatorSchema,programWindowEvidenceLimits.evaluatorBytes);
}
export async function programWindowMethodDigest():Promise<string> {
 return programWindowDigest({method:programWindowMethod,policy:programWindowPolicy});
}
export async function createProgramWindowEvaluator(rawInput:unknown,sourceVersion:string):Promise<ProgramWindowEvaluator> {
 const input=await verifyProgramWindowInput(rawInput);
 return boundedProgramWindowEvaluator({
  version:'opengrail-sampled-program-window-v1',sourceVersion,
  legacyImplementation:input.protocol.legacyImplementation,
  newImplementation:input.protocol.newImplementation,
  methodDigest:await programWindowMethodDigest(),
 });
}
export async function verifyProgramWindowEvaluator(rawInput:unknown,rawEvaluator:unknown):Promise<ProgramWindowInput> {
 const {input:bounded}=boundedPublicProgramWindowInput(rawInput),input=await verifyProgramWindowInput(bounded);
 const evaluator=boundedProgramWindowEvaluator(rawEvaluator);
 assert(evaluator.methodDigest===await programWindowMethodDigest()
  &&same(evaluator.legacyImplementation,input.protocol.legacyImplementation)
  &&same(evaluator.newImplementation,input.protocol.newImplementation),
 'Window evaluator must retain the exact separately declared old and new source identities.');
 programCommitmentDependencies(input.plan);
 return input;
}
export function boundedProgramWindowEvidence(raw:unknown,scope:'LOCAL'|'PUBLIC'='LOCAL') {
 const evidence=parse(raw,programWindowEvidenceSchema,scope==='PUBLIC'?programWindowEvidenceLimits.publicBytes:programWindowEvidenceLimits.localBytes);
 if(scope==='PUBLIC')boundedPublicProgramWindowRawArchive(evidence.rawArchive,programWindowEvidenceLimits.publicBytes);
 else boundedProgramWindowRawArchive(evidence.rawArchive,scope);
 return {evidence,payload:JSON.stringify(evidence)};
}
export async function createProgramWindowEvidence(raw:Omit<ProgramWindowEvidence,'evidenceDigest'>):Promise<ProgramWindowEvidence> {
 const body=parse(raw,evidenceBody,programWindowEvidenceLimits.localBytes);
 return boundedProgramWindowEvidence({...body,evidenceDigest:await programWindowDigest(body)}).evidence;
}
export async function verifyProgramWindowEvidence(raw:unknown,rawInput:unknown,scope:'LOCAL'|'PUBLIC'='LOCAL',verificationScope?:ProgramWindowEvidenceVerificationScope):Promise<ProgramWindowEvidence> {
 const {evidence}=boundedProgramWindowEvidence(raw,scope);
 if(scope==='PUBLIC')boundedPublicProgramWindowInput(rawInput);
 const memo=checkedScope(verificationScope);assert(!memo||scope==='PUBLIC','The bounded identity scope only serves complete public evidence.');
 const input=await (memo?memo.verifyInput(rawInput):verifyProgramWindowInput(rawInput)),{evidenceDigest,...body}=evidence;
 assert(evidenceDigest===await programWindowDigest(body),'Full window evidence digest differs.');
 assert(evidence.inputDigest===input.inputDigest&&evidence.protocolDigest===input.protocol.protocolDigest,
  'Window evidence must retain the exact whole declared window identity.');
 await (memo?memo.verifyArchive(evidence.rawArchive,input):verifyProgramWindowRawArchive(evidence.rawArchive,input,scope));
 if(scope==='PUBLIC')assert(input.protocol.rights.publicSharing==='AUTHOR_CONSENTED',
  'Complete raw window evidence requires explicit author consent before public sharing.');
 return evidence;
}
function registeredAt(raw:unknown,input:ProgramWindowInput):string {
 const at=clock.parse(raw);
 assert(at>=input.protocol.preparedAt
  &&Date.parse(input.protocol.startsAt)-Date.parse(at)>=programWindowEvidenceLimits.minimumRegistrationLeadMs,
 'The new window receipt must follow preparation and precede its start by at least 60 seconds.');
 return at;
}
/** Full unchanged V4 context is retrieved separately; no artifact copy, filtered
 * prefix, remote URL, executable code or digest-only replacement is accepted. */
export async function verifyProgramWindowEvidenceBinding(
 rawEvidence:unknown,rawInput:unknown,rawForwardInput:unknown,
 rawForwardArtifact:unknown|null,registrationClock:string,publicationClock:string,
 verificationScope?:ProgramWindowEvidenceVerificationScope,
):Promise<{input:ProgramWindowInput;evidence:ProgramWindowEvidence;forwardInput:ProgramForwardEvidenceInput;artifact:ProgramForwardEvidenceArtifact|null;archive:ProgramWindowRawArchive;observationReport:ProgramWindowObservationReport}> {
 const memo=checkedScope(verificationScope),{input:bounded}=boundedPublicProgramWindowInput(rawInput),input=await (memo?memo.verifyInput(bounded):verifyProgramWindowInput(bounded));
 const at=registeredAt(registrationClock,input),publishedAt=clock.parse(publicationClock);
 const evidence=await verifyProgramWindowEvidence(rawEvidence,input,'PUBLIC',memo);
 assert(publishedAt>=at,'Window link publication precedes its declaration.');
 const forwardInput=await (memo?memo.verifyForwardInput(input.plan,rawForwardInput,at):verifyProgramCommitmentEvidenceInput(input.plan,rawForwardInput,at));
 let artifact:ProgramForwardEvidenceArtifact|null=null;
 if(rawForwardArtifact!==null){
  artifact=await (memo?memo.verifyForwardArtifact(input.plan,rawForwardArtifact,at):verifyProgramCommitmentEvidenceArtifact(input.plan,rawForwardArtifact,at));
  assert(same(artifact.input,forwardInput),'The linked original artifact and manifest input differ.');
 }
 const archive=evidence.rawArchive;
 assert(archive.startedAt===forwardInput.startedAt,'Raw window archive must preserve the original session admission.');
 assert(archive.startedAt<=publishedAt&&(!archive.closedAt||archive.closedAt<=publishedAt)
  &&archive.requests.every(request=>request.startedAt<=publishedAt
   &&(!request.finishedAt||request.finishedAt<=publishedAt)
   &&(!request.normalizationAt||request.normalizationAt<=publishedAt))
  &&archive.outbox.every(row=>row.createdAt<=publishedAt&&row.attempts.every(attempt=>attempt.startedAt<=publishedAt
   &&(!attempt.finishedAt||attempt.finishedAt<=publishedAt)&&(!attempt.acknowledgedAt||attempt.acknowledgedAt<=publishedAt))),
 'Original authored observation clocks cannot follow their window publication.');
 // Raw projections must describe their complete original bytes even when an
 // actual late request is retained and cannot count toward a completed slot.
 for(const request of archive.requests)if(request.normalized!==null){
  assert(request.body!==null&&request.normalizationAt!==null,'A normalized source requires its whole original response and clock.');
  const normalized=normalizeProgramWindowRequest(decodeProgramWindowRawBody(request.body),request.endpoint,input.protocol.market.symbol,input.protocol.market.timeframe,request.normalizationAt);
  assert(same(normalized,request.normalized),'Original raw normalization does not match its declared complete projection.');
 }
 for(const entry of archive.outbox){
  assert(entry.eventDigest===await programWindowDigest(entry.event),'Original outbox event digest differs.');
  const retained=forwardInput.events.find(receipt=>receipt.event.requestId===entry.event.requestId)?.event
   ??(forwardInput.pending?.event.requestId===entry.event.requestId?forwardInput.pending.event:null);
  if(retained)assert(same(retained,entry.event),'Original outbox event differs from its full retained forward input.');
  if(entry.origin!=='RAW_OBSERVATION')continue;
  const source=archive.requests.find(request=>request.ordinal===entry.sourceRequestOrdinal);
  assert(source!==undefined&&source.slotOrdinal===entry.slotOrdinal&&source.normalized!==null&&source.body!==null&&entry.sourceTuplePosition!==null,
   'Every raw delivery requires its complete exact original source tuple.');
  if(entry.event.type==='CLOSED_BAR')assert(source.normalized.kind==='OHLC'&&same(source.normalized.bars[entry.sourceTuplePosition],entry.event.bar),
   'Original raw bar tuple differs from its declared delivery.');
  else if(entry.event.type==='QUOTE'){
   assert(source.normalized.kind==='Trades'&&same(source.normalized.quote,{observedAt:entry.event.observedAt,price:entry.event.price}),
    'Original normalized quote differs from its declared delivery.');
   const document=parseProgramWindowSourceDocument(decodeProgramWindowRawBody(source.body)),rows=(document.raw as {result:Record<string,unknown>}).result[input.protocol.market.symbol];
   assert(Array.isArray(rows)&&rows.length>0,'The complete original raw trade rows are unavailable.');
   let selected=0;
   for(let n=1;n<rows.length;n++)if(Number(rows[n][2])>=Number(rows[selected][2]))selected=n;
   assert(selected===entry.sourceTuplePosition,'Original raw trade tuple differs from the unchanged active normalizer selection.');
  }else throw new ProgramWindowError('A raw source observation cannot declare an owner control.');
 }
 const observationReport=await (memo?memo.verifyObservations(input,archive,artifact?.journal??null,publishedAt):verifyProgramWindowObservations(input,archive,{journal:artifact?.journal??null,inspectedAt:publishedAt}));
 const mismatchReasons=new Set([
  'OUTBOX_EVENT_DIGEST_MISMATCH','OUTBOX_ORDER_OR_DUPLICATE','OUTBOX_CANONICAL_ORDER_MISMATCH',
  'CANONICAL_EVENT_BODY_MISMATCH','ACK_CANONICAL_RECEIPT_MISMATCH','INCOMPLETE_ACK_EVIDENCE',
  'OUTBOX_CONFIRMATION_DISPOSITION_MISMATCH','INVALID_PENDING_DELIVERY','INVALID_UNCONFIRMED_DELIVERY',
  'RAW_NORMALIZATION_MISMATCH','UNBOUND_ACTIVE_QUOTE','ACTIVE_QUOTE_RAW_TUPLE_MISMATCH',
  'RAW_OBSERVATION_CANNOT_BE_OWNER_CONTROL','UNBOUND_OWNER_CONTROL',
 ]);
 assert(!observationReport.reasons.some(reason=>mismatchReasons.has(reason)),
  'Raw deliveries or original acknowledgment evidence do not bind the complete original forward context.');
 if(artifact===null)assert(archive.outbox.every(entry=>entry.status!=='CONFIRMED'&&entry.attempts.every(attempt=>attempt.status!=='CONFIRMED'&&attempt.envelope===null&&attempt.acknowledgedAt===null)),
  'Confirmed original acknowledgments require their complete retained V4 journal.');
 if(evidence.closure.observationStatus==='COMPLETE_DECLARED_SAMPLE_PROTOCOL')assert(observationReport.observationStatus==='COMPLETE_DECLARED_SAMPLE_PROTOCOL',
  'A declared complete sampling protocol cannot contradict its original retained observations.');
 if(evidence.closure.boundaryStatus==='RECEIPT_AND_GUEST_COMPLETION_WITHIN_WINDOW')assert(observationReport.boundaryStatus==='RECEIPT_AND_GUEST_COMPLETION_WITHIN_WINDOW',
  'A declared timely receipt boundary cannot contradict its original raw and journal context.');
 return {input,evidence,forwardInput,artifact,archive,observationReport};
}
export function verifyProgramWindowEvidenceReferences(raw:unknown,manifest:unknown,outcome:unknown,outcomeParent:unknown) {
 const {evidence}=boundedProgramWindowEvidence(raw,'PUBLIC');
 const checkedManifest=parse(manifest,programWindowReferenceSchema,256),checkedOutcome=parse(outcome,programWindowReferenceSchema,256),parent=parse(outcomeParent,programWindowReferenceSchema,256);
 assert(same(evidence.manifest,checkedManifest)&&same(evidence.outcome,checkedOutcome)&&same(parent,checkedManifest),
 'Original forward references and parent do not match the complete window evidence.');
 return evidence;
}
