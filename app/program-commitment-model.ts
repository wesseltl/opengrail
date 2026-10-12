import {z} from 'zod';
import {sharedProgramForwardPlanSchema,verifySharedProgramForwardPlan,type SharedProgramForwardPlan} from './program-forward-plan-dispatch-model';
import {boundedProgramForwardEvidenceValue,programForwardEvidenceCredentialLike,programForwardEvidenceSame,verifyProgramForwardEvidenceInput,verifyProgramForwardEvidenceArtifact,type ProgramForwardEvidenceInput,type ProgramForwardEvidenceArtifact} from './program-forward-evidence-model';
import type {StrategyRecordV2} from './strategy-model';

/** Additive inert declaration. A receipt is not an execution or independent witness. */
export const programCommitmentMethod=Object.freeze({version:5 as const,method:'PROGRAM_FORWARD_COMMITMENT' as const});
/** Public allowances are unchanged; the complete plan must fit before parsing. */
export const programCommitmentLimits=Object.freeze({inputBytes:196608,artifactBytes:524288,linkBytes:2048,maximumDepth:40,maximumNodes:262144,sourceDependencies:4});
export class ProgramCommitmentError extends Error{constructor(message:string,public status=400){super(message);}}
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const reference=z.object({id:uuid,digest:hash}).strict();
export const programCommitmentInputSchema=sharedProgramForwardPlanSchema.superRefine((plan,ctx)=>{
 if(plan.mode!=='PROSPECTIVE'||plan.config.clockMode!=='SYSTEM_RECEIPT'||plan.config.origin!=='PUBLIC_STRATEGY'||plan.config.provenance!=='USER_SUPPLIED'||plan.config.rights.permission!=='AUTHORIZED_USE')ctx.addIssue({code:z.ZodIssueCode.custom,message:'Only complete prospective real-receipt plans may be declared.'});
});
export type ProgramCommitmentInput=z.infer<typeof programCommitmentInputSchema>;
export const programCommitmentEvidenceLinkSchema=z.object({kind:z.literal('FORWARD_EVIDENCE_LINK'),manifest:reference,outcome:reference}).strict().refine(value=>value.manifest.id!==value.outcome.id,'A forward evidence link requires distinct manifest and outcome identities.');
export const programCommitmentLinkSchema=programCommitmentEvidenceLinkSchema;
export type ProgramCommitmentEvidenceLink=z.infer<typeof programCommitmentEvidenceLinkSchema>;

function assert(ok:boolean,message:string,status=400):asserts ok{if(!ok)throw new ProgramCommitmentError(message,status);}
/** Own descriptors are inspected before schema traversal or JSON serialization. */
export function boundedProgramCommitmentValue(raw:unknown,maximum:number=programCommitmentLimits.inputBytes){
 let nodes=0,characters=0;const active=new Set<object>();
 function walk(value:unknown,depth:number):void{
  assert(++nodes<=programCommitmentLimits.maximumNodes&&depth<=programCommitmentLimits.maximumDepth,'Commitment structure exceeds its fixed budget.',413);
  if(typeof value==='string'){characters+=value.length;assert(characters<=maximum,'Complete commitment exceeds its byte budget.',413);assert(!programForwardEvidenceCredentialLike(value),'Credentials cannot enter commitments.');return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0))return;
  assert(!!value&&typeof value==='object'&&!active.has(value)&&Object.getOwnPropertySymbols(value).length===0,'Commitments require plain finite canonical JSON.');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  assert(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'Commitments require ordinary JSON containers.');
  if(array)assert((value as unknown[]).length<=programCommitmentLimits.maximumNodes,'Commitment array exceeds its fixed budget.',413);
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(array)assert(Object.keys(descriptors).length===(value as unknown[]).length+1,'Commitment arrays must be dense.');
  active.add(value);
  for(const[key,descriptor]of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   assert('value'in descriptor&&descriptor.enumerable===true&&(!array||/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<(value as unknown[]).length),'Commitment hooks and hidden fields are refused.');
   characters+=key.length;assert(characters<=maximum,'Complete commitment exceeds its byte budget.',413);assert(!programForwardEvidenceCredentialLike(key),'Credential keys cannot enter commitments.');walk(descriptor.value,depth+1);
  }
  active.delete(value);
 }
 walk(raw,0);const payload=JSON.stringify(raw);assert(new TextEncoder().encode(payload).byteLength<=maximum,'Complete commitment exceeds its byte budget.',413);return payload;
}
function parse<T>(raw:unknown,schema:z.ZodType<T>,maximum:number):T{
 const original=boundedProgramCommitmentValue(raw,maximum);let value:T;
 try{value=schema.parse(raw);}catch{throw new ProgramCommitmentError('Commitment does not match its strict contract.');}
 assert(JSON.stringify(value)===original,'Canonical unchanged commitment material is required.');return value;
}
/** Synchronous boundary checks; hash/source verification is separate below. */
export function boundedProgramCommitmentInput(raw:unknown){const input=parse(raw,programCommitmentInputSchema,programCommitmentLimits.inputBytes);return {input,payload:JSON.stringify(input)};}
export async function verifyProgramCommitmentPlan(raw:unknown):Promise<SharedProgramForwardPlan>{
 const {input}=boundedProgramCommitmentInput(raw);
 try{const plan=await verifySharedProgramForwardPlan(input);assert(programForwardEvidenceSame(plan,input),'The complete original frozen plan must remain unchanged.');programCommitmentDependencies(plan);return plan;}catch(error){if(error instanceof ProgramCommitmentError)throw error;throw new ProgramCommitmentError('Complete commitment plan, retained Search or source identities are invalid.',error&&typeof error==='object'&&'status'in error&&error.status===413?413:400);}
}
/** Call after full plan verification. These snapshots do not establish current visibility. */
export function programCommitmentDependencies(plan:SharedProgramForwardPlan):Array<{id:string;digest:string;record:StrategyRecordV2}>{
 const seen=new Map<string,{id:string;digest:string;record:StrategyRecordV2}>(),sources=[{record:plan.config.strategy.record,digest:plan.config.strategy.digest},...plan.handoff.ledger.plan.admission.candidates.map(candidate=>({record:candidate.source.record,digest:candidate.source.digest}))];
 for(const source of sources){assert(source.record?.version===2,'Every retained commitment candidate requires its full V2 source.');const entry={id:source.record.id,digest:source.digest,record:source.record},previous=seen.get(entry.id);assert(!previous||previous.digest===entry.digest&&programForwardEvidenceSame(previous.record,entry.record),'Commitment source dependencies conflict.');seen.set(entry.id,entry);}
 assert(seen.size>=2&&seen.size<=programCommitmentLimits.sourceDependencies,'The complete commitment source closure exceeds its fixed candidate bound.');return [...seen.values()];
}
function registeredClock(raw:unknown){try{return clock.parse(raw);}catch{throw new ProgramCommitmentError('A canonical retained registry timestamp is required.');}}
function bindInput(plan:SharedProgramForwardPlan,input:ProgramForwardEvidenceInput,registeredAt:string){
 const accepted=registeredClock(registeredAt);
 assert(accepted<plan.startsAt&&plan.startsAt<=input.startedAt&&input.startedAt<plan.endsAt,'Retained registration must precede the declared interval and original session admission.');
 assert(input.plan!==null&&programForwardEvidenceSame(input.plan,plan),'Forward evidence must retain the complete exact registered plan.');
 assert(programForwardEvidenceSame(input.config,plan.config)&&programForwardEvidenceSame(input.implementation,plan.implementation)&&input.config.sessionId===plan.config.sessionId,'Forward evidence changed the registered config, session or implementation.');
 assert(input.events.every(row=>row.receivedAt>=input.startedAt)&&(!input.pending||input.pending.receivedAt>=input.startedAt),'Original forward receipts cannot precede session admission.');
}
/** Pure structural/identity linkage. Registered time is supplied by the trusted repository. */
export async function verifyProgramCommitmentEvidenceInput(planRaw:unknown,inputRaw:unknown,registeredAt:string):Promise<ProgramForwardEvidenceInput>{
 const plan=await verifyProgramCommitmentPlan(planRaw);boundedProgramForwardEvidenceValue(inputRaw,programCommitmentLimits.inputBytes,programCommitmentLimits.maximumDepth,programCommitmentLimits.maximumNodes);
 const input=await verifyProgramForwardEvidenceInput(inputRaw);bindInput(plan,input,registeredAt);return input;
}
export async function verifyProgramCommitmentEvidenceArtifact(planRaw:unknown,artifactRaw:unknown,registeredAt:string):Promise<ProgramForwardEvidenceArtifact>{
 const plan=await verifyProgramCommitmentPlan(planRaw);boundedProgramForwardEvidenceValue(artifactRaw,programCommitmentLimits.artifactBytes,programCommitmentLimits.maximumDepth,programCommitmentLimits.maximumNodes);
 const artifact=await verifyProgramForwardEvidenceArtifact(artifactRaw);boundedProgramForwardEvidenceValue(artifact.input,programCommitmentLimits.inputBytes,programCommitmentLimits.maximumDepth,programCommitmentLimits.maximumNodes);bindInput(plan,artifact.input,registeredAt);return artifact;
}
/** Exact public record references are correlated separately from body/source checks. */
export function verifyProgramCommitmentEvidenceLink(raw:unknown,manifestRaw:unknown,outcomeRaw:unknown,outcomeManifestRaw:unknown):ProgramCommitmentEvidenceLink{
 const link=parse(raw,programCommitmentEvidenceLinkSchema,programCommitmentLimits.linkBytes),manifest=parse(manifestRaw,reference,programCommitmentLimits.linkBytes),outcome=parse(outcomeRaw,reference,programCommitmentLimits.linkBytes),parent=parse(outcomeManifestRaw,reference,programCommitmentLimits.linkBytes);
 assert(programForwardEvidenceSame(link.manifest,manifest)&&programForwardEvidenceSame(link.outcome,outcome)&&programForwardEvidenceSame(parent,manifest),'Forward link record identities or parent differ.');return link;
}
