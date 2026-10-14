import {z} from 'zod';
import {researchAuthorReferenceSchema} from './research-model';
import {experimentClaimSchema,experimentFlagSchema,experimentReferenceSchema} from './experiment-model';
import {experimentReviewAuthorSchema,experimentReviewBlockingFlags,experimentReviewHeadSchema,experimentReviewPublicItemSchema,experimentReviewReasonSchema,experimentReviewSharedDependencies} from './experiment-review-model';
import {ventureCredentialLike} from './venture-model';

export const agentWorkProfileLimits={units:64,history:32,dependencyAuthors:5,responseBytes:262144,maximumDepth:16,maximumNodes:65536} as const;
export const agentWorkSubjectSchema=z.object({kind:z.literal('AGENT'),id:experimentReferenceSchema.shape.id,sponsorId:z.string().regex(/^human_[a-f0-9]{64}$/)}).strict();
export type AgentWorkSubject=z.infer<typeof agentWorkSubjectSchema>;
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,'Use a canonical UTC observation time.');
const decision=z.enum(['REPRODUCED','DISPUTED','HELD','REJECTED']);
export const agentWorkStatusSchema=z.enum(['ATTESTED','DISPUTED','HELD','REJECTED','SUPERSEDED']);
const sharedDependencies=z.array(z.enum(experimentReviewSharedDependencies)).max(experimentReviewSharedDependencies.length).refine(values=>new Set(values).size===values.length);
const reasons=z.array(experimentReviewReasonSchema).min(1).max(16).refine(values=>new Set(values).size===values.length);
const conflicts=z.string().max(1500).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value=>!ventureCredentialLike(value),'Credentials cannot appear in work profiles.');
const reference=experimentReferenceSchema;
const authoredReference=z.object({...reference.shape,author:researchAuthorReferenceSchema}).strict();
const reproductionReference=authoredReference.extend({claim:experimentClaimSchema});
const manifestReference=authoredReference.extend({version:z.union([z.literal(1),z.literal(3),z.literal(4)]),flags:z.array(experimentFlagSchema).max(14).refine(values=>new Set(values).size===values.length)});

/** These descriptors are data, not authentication or proof of database provenance.
 * The repository must validate full bindings and fresh membership/visibility first. */
export const agentWorkProfileUnitInputSchema=z.object({
 original:authoredReference,reproduction:reproductionReference,manifest:manifestReference,strategy:authoredReference,
 dependencyAuthors:z.array(researchAuthorReferenceSchema).min(1).max(agentWorkProfileLimits.dependencyAuthors),
 currentHead:experimentReviewHeadSchema,history:z.array(experimentReviewPublicItemSchema).min(1).max(agentWorkProfileLimits.history),
}).strict().superRefine((unit,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(unit.original.id===unit.reproduction.id)bad('Work requires distinct original and reproduction outcomes.');
 if(!unit.dependencyAuthors.some(author=>same(author,unit.strategy.author)))bad('Dependency authors must retain the selected strategy author.');
 if(!unit.history.some(review=>same(review.target.reproduction,ref(unit.reproduction))))bad('The selected reproduction must occur in retained history.');
 const ids=new Set<string>();unit.history.forEach((review,index)=>{
  if(ids.has(review.id))bad('Retained review identities must be unique.');ids.add(review.id);
  if(review.sequence!==index+1||review.sequence>unit.currentHead.sequence)bad('Work requires complete oldest-first retained history.');
  if(!same(review.target.original,ref(unit.original))||!same(review.target.manifest,ref(unit.manifest))||!same(review.target.strategy,ref(unit.strategy)))bad('Every review requires the exact original, manifest and strategy.');
  if(review.state==='VISIBLE'){
   const evidence=review.record!.content.evidence,method=evidence?('method'in evidence?evidence.method:'BATCH_DEMO'):null;
   if(method!==null&&method!==(unit.manifest.version===1?'BATCH_DEMO':unit.manifest.version===3?'PROGRAM_DEMO':'PROGRAM_FORWARD_DEMO'))bad('Review evidence must retain the supported manifest method.');
   if(unit.manifest.version===4?review.method!=='PROGRAM_FORWARD_DEMO':review.method!==undefined)bad('Visible review method tags must match the supported manifest.');
  }
  const previous=unit.history[index-1];
  if(!same(review.previous,previous?ref(previous):null)||previous&&review.createdAt<previous.createdAt)bad('Retained review links and clocks must agree.');
 });
 const head=unit.history.at(-1)!;
 if(!same(unit.currentHead,{...ref(head),sequence:head.sequence}))bad('The supplied head must be the complete retained current head.');
});
export type AgentWorkProfileUnitInput=z.infer<typeof agentWorkProfileUnitInputSchema>;

export const agentWorkVisibleReviewSchema=z.object({
 review:reference,sequence:experimentReviewHeadSchema.shape.sequence,createdAt:clock,reviewer:experimentReviewAuthorSchema,
 reproduction:reference,decision,reasons,sharedDependencies,otherConflicts:conflicts,
}).strict();
export type AgentWorkVisibleReview=z.infer<typeof agentWorkVisibleReviewSchema>;
export const agentWorkUnitSchema=z.object({
 original:reference,reproduction:reference,manifest:reference,strategy:reference,currentHead:experimentReviewHeadSchema,
 status:agentWorkStatusSchema,sponsorSeparation:z.object({outcomes:z.boolean(),reviewer:z.boolean()}).strict(),
 history:z.array(agentWorkVisibleReviewSchema).min(1).max(agentWorkProfileLimits.history),
}).strict().superRefine((unit,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 const head=unit.history.at(-1)!;
 if(!same(unit.currentHead,{...head.review,sequence:head.sequence}))bad('Public work requires its visible current head.');
 if(!unit.history.some(review=>same(review.reproduction,unit.reproduction)))bad('Public work must retain a visible selected reproduction.');
 const expected=same(head.reproduction,unit.reproduction)?status(head.decision):'SUPERSEDED';
 if(unit.status!==expected)bad('Current support follows the head and its exact reproduction.');
 if(unit.status==='ATTESTED'&&(!unit.sponsorSeparation.outcomes||!unit.sponsorSeparation.reviewer))bad('Attested work requires sponsor separation.');
 let previous:AgentWorkVisibleReview|undefined;
 const ids=new Set<string>();
 for(const review of unit.history){
  if(ids.has(review.review.id)||review.sequence>unit.currentHead.sequence||previous&&(review.sequence<=previous.sequence||review.createdAt<previous.createdAt))bad('Visible review history identities, sequences and clocks must be ordered.');
  ids.add(review.review.id);previous=review;
 }
});
export type AgentWorkUnit=z.infer<typeof agentWorkUnitSchema>;
const counts=z.object({total:z.number().int().min(0).max(agentWorkProfileLimits.units),attested:z.number().int().min(0).max(agentWorkProfileLimits.units),disputed:z.number().int().min(0).max(agentWorkProfileLimits.units),held:z.number().int().min(0).max(agentWorkProfileLimits.units),rejected:z.number().int().min(0).max(agentWorkProfileLimits.units),superseded:z.number().int().min(0).max(agentWorkProfileLimits.units)}).strict();
export const agentWorkProfileSchema=z.object({
 version:z.literal(1),subject:agentWorkSubjectSchema,observedAt:clock,method:z.literal('COMPUTATIONAL_REPRODUCTION'),
 classification:z.literal('EVIDENCE_LINKED_WORK_PROFILE'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),
 executionEnabled:z.literal(false),ordersEnabled:z.literal(false),coverage:z.literal('CURRENT_VISIBLE_SUPPORTED_COMPUTATIONAL_WORK'),
 supportedMethods:z.tuple([z.literal('BATCH_DEMO'),z.literal('PROGRAM_DEMO'),z.literal('PROGRAM_FORWARD_DEMO')]),
 counts,units:z.array(agentWorkUnitSchema).max(agentWorkProfileLimits.units),
}).strict().superRefine((profile,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 const keys=new Set<string>();let previous='';
 for(const unit of profile.units){
  const key=unit.original.id+':'+unit.original.digest;
  if(keys.has(key)||previous&&key<=previous)bad('Work units must be unique and ordered for the exact subject and original.');
  keys.add(key);previous=key;
  if(unit.history.some(review=>review.createdAt>profile.observedAt))bad('Observed work cannot precede its retained reviews.');
 }
 if(!same(profile.counts,countUnits(profile.units)))bad('Counts must describe exactly the returned visible work units.');
});
export type AgentWorkProfile=z.infer<typeof agentWorkProfileSchema>;
export class AgentWorkProfileError extends Error{constructor(message:string,public status=400){super(message);}}
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
function ref(value:{id:string;digest:string}){return {id:value.id,digest:value.digest};}
function status(value:z.infer<typeof decision>):z.infer<typeof agentWorkStatusSchema>{return value==='REPRODUCED'?'ATTESTED':value;}
function countUnits(units:AgentWorkUnit[]){return {total:units.length,attested:units.filter(unit=>unit.status==='ATTESTED').length,disputed:units.filter(unit=>unit.status==='DISPUTED').length,held:units.filter(unit=>unit.status==='HELD').length,rejected:units.filter(unit=>unit.status==='REJECTED').length,superseded:units.filter(unit=>unit.status==='SUPERSEDED').length};}
function visibleReview(item:AgentWorkProfileUnitInput['history'][number]):AgentWorkVisibleReview{
 const record=item.record!;return {review:ref(item),sequence:item.sequence,createdAt:item.createdAt,reviewer:item.author,reproduction:item.target.reproduction,decision:record.content.decision,reasons:record.content.reasons,sharedDependencies:record.content.sharedDependencies,otherConflicts:record.content.otherConflicts};
}

/** Structural projection only: caller data cannot establish a principal, authentic
 * execution, actual operator separation or current database visibility. */
export function createAgentWorkProfile(rawSubject:unknown,rawObservedAt:unknown,rawUnits:unknown):AgentWorkProfile{
 const subject=agentWorkSubjectSchema.parse(rawSubject),observedAt=clock.parse(rawObservedAt);
 const inputs=z.array(agentWorkProfileUnitInputSchema).max(agentWorkProfileLimits.units).parse(rawUnits),seen=new Set<string>(),units:AgentWorkUnit[]=[];
 for(const input of inputs){
  if(!same(input.reproduction.author,subject))throw new AgentWorkProfileError('The selected reproduction does not belong to this subject.');
  const key=input.original.id+':'+input.original.digest;
  if(seen.has(key))throw new AgentWorkProfileError('Duplicate work unit for this subject and original.');seen.add(key);
  if(input.history.some(review=>review.createdAt>observedAt||review.moderation.some(event=>event.createdAt>observedAt)))throw new AgentWorkProfileError('Observation precedes retained review evidence.');
  const head=input.history.at(-1)!,own=input.history.filter(review=>same(review.target.reproduction,ref(input.reproduction))).at(-1)!;
  if(head.state!=='VISIBLE'||!head.record||own.state!=='VISIBLE'||!own.record)continue;
  const sponsors=[input.original.author.sponsorId,input.reproduction.author.sponsorId,input.manifest.author.sponsorId,input.strategy.author.sponsorId,...input.dependencyAuthors.map(author=>author.sponsorId)];
  const separation={outcomes:input.original.author.sponsorId!==subject.sponsorId,reviewer:sponsors.every(sponsor=>sponsor!==head.author.sponsorId)};
  const current=same(head.target.reproduction,ref(input.reproduction));
  if(current&&head.decision==='REPRODUCED'){
   if(head.method==='PROGRAM_FORWARD_COMMITMENT'||head.method==='PROGRAM_FORWARD_WINDOW'||input.reproduction.claim.type!=='REPRODUCTION'||input.reproduction.claim.relation?.type!=='SUPPORTS'||!same(ref(input.reproduction.claim.relation),ref(input.original))||!separation.outcomes||!separation.reviewer||input.manifest.flags.some(flag=>(experimentReviewBlockingFlags as readonly string[]).includes(flag)))throw new AgentWorkProfileError('Attested work does not retain separated, unblocked reproduction lineage.');
  }
  units.push(agentWorkUnitSchema.parse({original:ref(input.original),reproduction:ref(input.reproduction),manifest:ref(input.manifest),strategy:ref(input.strategy),currentHead:input.currentHead,status:current?status(head.record.content.decision):'SUPERSEDED',sponsorSeparation:separation,history:input.history.filter(review=>review.state==='VISIBLE'&&review.record!==null).map(visibleReview)}));
 }
 units.sort((a,b)=>{const left=a.original.id+':'+a.original.digest,right=b.original.id+':'+b.original.digest;return left<right?-1:left>right?1:0;});
 return boundedAgentWorkProfile({version:1,subject,observedAt,method:'COMPUTATIONAL_REPRODUCTION',classification:'EVIDENCE_LINKED_WORK_PROFILE',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false,coverage:'CURRENT_VISIBLE_SUPPORTED_COMPUTATIONAL_WORK',supportedMethods:['BATCH_DEMO','PROGRAM_DEMO','PROGRAM_FORWARD_DEMO'],counts:countUnits(units),units}).profile;
}

function plain(value:unknown,depth=0,state={nodes:0,characters:0},active=new Set<object>()):void{
 if(++state.nodes>agentWorkProfileLimits.maximumNodes||depth>agentWorkProfileLimits.maximumDepth)throw new AgentWorkProfileError('Work profile exceeds its structural bound.',413);
 if(typeof value==='string'){state.characters+=value.length;if(state.characters>agentWorkProfileLimits.responseBytes)throw new AgentWorkProfileError('Work profile exceeds its response bound.',413);return;}
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){if(Number.isFinite(value))return;throw new AgentWorkProfileError('Work profile requires finite JSON values.');}
 if(typeof value!=='object'||active.has(value))throw new AgentWorkProfileError('Work profile requires acyclic JSON values.');
 const prototype=Object.getPrototypeOf(value);if(prototype!==(Array.isArray(value)?Array.prototype:Object.prototype)&&prototype!==null)throw new AgentWorkProfileError('Work profile requires plain JSON data.');
 active.add(value);const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Array.isArray(value)&&(value.length>agentWorkProfileLimits.maximumNodes||Reflect.ownKeys(descriptors).length!==value.length+1))throw new AgentWorkProfileError('Work profile requires bounded dense JSON arrays.');
 for(const key of Reflect.ownKeys(descriptors)){
  if(typeof key!=='string')throw new AgentWorkProfileError('Work profile JSON keys must be strings.');
  if(Array.isArray(value)&&key==='length')continue;
  if(Array.isArray(value)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))throw new AgentWorkProfileError('Work profile arrays require JSON indices only.');
  state.characters+=key.length;if(state.characters>agentWorkProfileLimits.responseBytes)throw new AgentWorkProfileError('Work profile exceeds its response bound.',413);
  const descriptor=descriptors[key];if(!descriptor.enumerable||!('value'in descriptor))throw new AgentWorkProfileError('Work profile requires enumerable data properties.');
  plain(descriptor.value,depth+1,state,active);
 }
 active.delete(value);
}
export function boundedAgentWorkProfile(raw:unknown){
 plain(raw);const before=JSON.stringify(raw);if(new TextEncoder().encode(before).byteLength>agentWorkProfileLimits.responseBytes)throw new AgentWorkProfileError('Work profile exceeds its response byte bound.',413);
 const profile=agentWorkProfileSchema.parse(raw),payload=JSON.stringify(profile);
 if(new TextEncoder().encode(payload).byteLength>agentWorkProfileLimits.responseBytes)throw new AgentWorkProfileError('Work profile exceeds its response byte bound.',413);
 return {profile,payload};
}
