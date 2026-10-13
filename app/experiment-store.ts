import {networkAgentSchema} from './network-model';
import {StrategyRepository} from './strategy-store';
import {boundedStrategyRecord,boundedStrategyCommand,strategyPublishCommandForRecord,strategyAuthorReference,type StrategyPublicItem} from './strategy-model';
import {strategyEvidenceLimits,strategyEvidenceEntryForItem,validateStrategyEvidencePage} from './strategy-evidence-model';
import {verifyProgramCommitmentEvidenceInput,verifyProgramCommitmentEvidenceArtifact,verifyProgramCommitmentEvidenceLink,boundedProgramCommitmentValue,type ProgramCommitmentInput} from './program-commitment-model';
import {readCommitmentSourceClosure,confirmCommitmentSourceClosure,commitmentSourceFenceClause,commitmentSourceFenceJson,experimentCommitmentStoreLimits,type CommitmentSourceSnapshot} from './experiment-commitment-store';
import {verifyProgramWindowDeclarationBinding,type ProgramWindowInput} from './program-window-model';
import {verifyProgramWindowEvidenceBinding,verifyProgramWindowEvidenceReferences,ProgramWindowEvidenceVerificationScope} from './program-window-evidence-model';
import {ExperimentError,experimentLimits,experimentDigest,experimentPublicHumanId,experimentAuthorReference,boundedExperimentCommand,boundedExperimentRecord,boundedExperimentTransport,experimentPublicEventSchema,experimentPrivateReportSchema,experimentListSchema,experimentGetSchema,experimentWriteSchema,experimentReportsSchema,experimentManifestFlags,experimentOutcomeFlags,experimentSummarySchema,experimentOutcomesSchema,experimentInputStrategy,experimentInputDependencies,experimentMethodVersion,experimentRecordMethod,experimentRecordStatus,verifyExperimentRecordArtifact,verifyExperimentManifestInput,verifyExperimentArtifact,type ExperimentInput,type ExperimentActor,type ExperimentAuthor,type ExperimentAuthorReference,type ExperimentCommand,type ExperimentRecord,type ExperimentPublicItem,type ExperimentPublicEvent} from './experiment-model';
type PublicationRow={id:string;type:string;manifest_id:string|null;manifest_digest:string|null;strategy_id:string;strategy_digest:string;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type EventRow={record_id:string;sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;state:string;reason:string;created_at:string};
type ReportRow={author_key:string;request_id:string;sponsor_key:string;record_id:string;record_digest:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type Checked={row:PublicationRow;record:ExperimentRecord};
type Context={actor:ExperimentActor;author:ExperimentAuthor;reference:ExperimentAuthorReference;key:string;sponsor:string};
type Values=(string|number)[];
type CommitmentFence={closure:CommitmentSourceSnapshot[];publications:PublicationRow[];events:EventRow[]};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const nowSql="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const limitedPayload=(maximum:number)=>`CASE WHEN length(CAST(payload AS BLOB))<=${maximum} THEN payload ELSE NULL END AS payload`;
const publicationColumns=`id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,${limitedPayload(experimentLimits.outcomeBytes)},digest,created_at`;
const eventColumns=`record_id,sequence,author_key,sponsor_key,request_id,command_digest,${limitedPayload(4096)},digest,state,reason,created_at`;
const reportColumns=`author_key,request_id,sponsor_key,record_id,record_digest,command_digest,${limitedPayload(4096)},digest,created_at`;
const inconsistent=()=>new ExperimentError('Experiment records are inconsistent. Retained material was preserved.',503);
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new ExperimentError('Invalid experiment timestamp.',400);}
function id(value:string){if(typeof value!=='string'||!uuid.test(value))throw new ExperimentError('Invalid experiment identity.',400);}
const authorKey=(author:ExperimentAuthorReference)=>author.kind+':'+author.id;
const add=(values:Values,value:string|number)=>{values.push(value);return '?'+values.length;};
const content=(command:Extract<ExperimentCommand,{action:'register'|'outcome'}>)=>command.action==='register'?('method'in command?{method:command.method,name:command.name,input:command.input,evaluator:command.evaluator,disclosures:command.disclosures}:{name:command.name,input:command.input,evaluator:command.evaluator,baseline:command.baseline,disclosures:command.disclosures}):('method'in command?{method:command.method,name:command.name,manifest:command.manifest,result:command.result,claim:command.claim}:{name:command.name,manifest:command.manifest,result:command.result,claim:command.claim});
const publicationSource=(plan:Extract<ExperimentRecord,{version:5,type:'MANIFEST'}>)=>plan.content.input.config.strategy.record.id;
function retryAfter(at:string){const date=new Date(at);return Math.max(1,Math.ceil((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)-Date.parse(at))/1000));}

/** All submission authority is server-derived. No sources are fetched or code executed. */
export class ExperimentRepository{
 constructor(private db:D1Database){}
 private commitmentConfirmations=new WeakMap<object,{payload:string;closure:CommitmentSourceSnapshot[];publications:PublicationRow[];events:EventRow[]}>();
 private commitmentEvidenceConfirmations=new WeakMap<object,{payload:string;fences:CommitmentFence[]}>();
 private commitmentAgentReceipts=new WeakMap<object,{payload:string;fence:CommitmentFence}>();
 /** Server-local capability probe. This reveals no method or data to callers
  * and never accepts a reconstructed/client-supplied receipt object. */
 hasExactForwardAgentReceipt(result:Awaited<ReturnType<ExperimentRepository['get']>>){return this.commitmentAgentReceipts.has(result);}

 private async context(actor:ExperimentActor,at:string):Promise<Context>{
  clock(at);
  let author:ExperimentAuthor;
  if(actor?.kind==='HUMAN'){
   if(typeof actor.moderator!=='boolean')throw new ExperimentError('Invalid participation context.',403);
   const sponsor=await experimentPublicHumanId(actor.userId);author={kind:'HUMAN',id:sponsor,sponsorId:sponsor};
  }else if(actor?.kind==='AGENT'){
   try{
    const principal=actor.principal,sponsor=await experimentPublicHumanId(principal.ownerId),agent=networkAgentSchema.parse(JSON.parse(principal.payload));
    if(agent.id!==principal.agentId||agent.credentialId!==principal.credentialId||agent.name!==principal.name||agent.expiresAt!==principal.expiresAt||agent.revision!==1||agent.revokedAt!==null||!hash.test(principal.registryDigest)||!hash.test(principal.tokenDigest)||JSON.stringify(agent)!==principal.payload||await experimentDigest(principal.payload)!==principal.registryDigest||Date.parse(at)<Date.parse(agent.createdAt)||Date.parse(at)>=Date.parse(agent.expiresAt))throw Error();
    author={kind:'AGENT',id:agent.id,sponsorId:sponsor,name:agent.name};
   }catch{throw new ExperimentError('Agent credential is invalid, expired or revoked.',401);}
  }else throw new ExperimentError('Authentication is required to submit experiment.',401);
  const reference=experimentAuthorReference(author);return {actor,author,reference,key:authorKey(reference),sponsor:reference.sponsorId};
 }

 private credentialClause(context:Context,at:string,values:Values){
  if(context.actor.kind!=='AGENT')return '1=1';
  const p=context.actor.principal,user=add(values,p.ownerId),agent=add(values,p.agentId),credential=add(values,p.credentialId),token=add(values,p.tokenDigest),digest=add(values,p.registryDigest),payload=add(values,p.payload),time=add(values,at);
  return `EXISTS(SELECT 1 FROM network_agents WHERE owner_id=${user} AND id=${agent} AND credential_id=${credential} AND token_digest=${token} AND digest=${digest} AND payload=${payload} AND revision=1 AND revoked_at IS NULL AND created_at<=${time} AND created_at<=${nowSql} AND expires_at>${time} AND expires_at>${nowSql})`;
 }
 private async requireCredential(context:Context,at:string){
  if(context.actor.kind==='AGENT'){
   const values:Values=[],clause=this.credentialClause(context,at,values),row=await this.db.prepare(`SELECT 1 AS active WHERE ${clause}`).bind(...values).first<{active:number}>();
   if(!row)throw new ExperimentError('Agent credential is invalid, expired or revoked.',401);
  }
 }
 private requestClause(context:Context,requestId:string,values:Values){
  const author=add(values,context.key),request=add(values,requestId);
  return ['experiment_records','experiment_moderation','experiment_reports','experiment_reviews','experiment_review_moderation','experiment_review_reports'].map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE author_key=${author} AND request_id=${request})`).join(' AND ');
 }

 private async checkPublication(row:PublicationRow):Promise<Checked>{
  try{
   if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const checked=boundedExperimentRecord(JSON.parse(row.payload)),record=checked.record;
   if(checked.payload!==row.payload||await experimentDigest(row.payload)!==row.digest||record.id!==row.id||record.type!==row.type||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(experimentAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedExperimentCommand({action:record.type==='MANIFEST'?'register':'outcome',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted});
   if(await experimentDigest(command.payload)!==row.command_digest)throw Error();
   if(record.type==='MANIFEST'){
    const selected=experimentInputStrategy(record.content.input);await verifyExperimentManifestInput(record.content.input,record.content.evaluator);
    if(row.manifest_id!==null||row.manifest_digest!==null||row.strategy_id!==selected.record.id||row.strategy_digest!==selected.digest||await experimentDigest(JSON.stringify(selected.record))!==row.strategy_digest||JSON.stringify(record.flags)!==JSON.stringify(experimentManifestFlags(record.content.disclosures)))throw Error();
    if(record.version===5&&(record.content.input.preparedAt>record.createdAt||Date.parse(record.content.input.startsAt)-Date.parse(record.createdAt)<experimentCommitmentStoreLimits.minimumLeadMs))throw Error();
    if(record.version===6&&(record.content.input.protocol.preparedAt>record.createdAt||Date.parse(record.content.input.protocol.startsAt)-Date.parse(record.createdAt)<experimentCommitmentStoreLimits.minimumLeadMs))throw Error();
   }else{
    if(row.manifest_id!==record.content.manifest.id||row.manifest_digest!==record.content.manifest.digest)throw Error();
    if(record.content.result.kind==='ARTIFACT')await verifyExperimentRecordArtifact(record);
   }
   return {row,record};
  }catch{throw inconsistent();}
 }
 private async publication(recordId:string):Promise<Checked>{
  id(recordId);const row=await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE id=?`).bind(recordId).first<PublicationRow>();
  if(!row)throw new ExperimentError('Experiment publication not found.',404);return this.checkPublication(row);
 }
 private async events(publication:Checked,observedRows?:EventRow[]){
  const rows=observedRows??(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id=? ORDER BY sequence LIMIT ${experimentLimits.eventsPerRecord+1}`).bind(publication.record.id).all<EventRow>()).results;
  if(rows.length>experimentLimits.eventsPerRecord)throw inconsistent();
  const events:ExperimentPublicEvent[]=[];let state='VISIBLE',time=publication.record.createdAt;
  for(const row of rows){
   try{
    if(!row.payload||new TextEncoder().encode(row.payload).byteLength>4096||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
    const event=experimentPublicEventSchema.parse(JSON.parse(row.payload));
    if(JSON.stringify(event)!==row.payload||await experimentDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==publication.record.id||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||event.reason!==row.reason||authorKey(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||state==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(time))throw Error();
    const command=boundedExperimentCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,reason:event.reason,policyAccepted:'public-experiment-v1'}:{action:'moderate',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:'public-experiment-v1'});
    if(await experimentDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=experimentLimits.eventsPerRecord))throw Error();
    events.push(event);state=event.state;time=event.createdAt;
   }catch{throw inconsistent();}
  }
  return {rows,events,state:state as ExperimentPublicItem['state'],reason:events.at(-1)?.reason??null};
 }
 private async source(recordId:string,selection=false,expectedVersion:1|2=1){
  id(recordId);
  try{
   const row=await this.db.prepare('SELECT id,digest,CASE WHEN length(CAST(payload AS BLOB))<=28672 THEN payload ELSE NULL END AS payload FROM strategy_publications WHERE id=?').bind(recordId).first<{id:string;digest:string;payload:string|null}>();
   if(!row){if(selection)throw new ExperimentError('Published strategy source not found. Select a currently visible Strategy Hub record.',404);throw Error();}if(!row.payload)throw Error();const checked=boundedStrategyRecord(JSON.parse(row.payload));
   if(checked.record.version!==expectedVersion)throw new ExperimentError('The selected strategy source version does not match the declared experiment method. Program sources require a program experiment method.',400);
   if(checked.payload!==row.payload||checked.record.id!==row.id||await experimentDigest(row.payload)!==row.digest)throw Error();
   const projected=(await new StrategyRepository(this.db).get(recordId)).item;
   if(projected.digest!==row.digest||projected.record&&JSON.stringify(projected.record)!==row.payload)throw Error();
   return {id:row.id,digest:row.digest,payload:row.payload,visible:projected.state==='VISIBLE'};
  }catch(error){if(selection&&error instanceof ExperimentError&&(error.status===404||error.status===400))throw error;throw inconsistent();}
 }
 private async dependencies(input:ExperimentInput,selection=false,selected?:Awaited<ReturnType<ExperimentRepository['source']>>){
  const retained=experimentInputDependencies(input);if(retained.length<1||retained.length>4||new Set(retained.map(value=>value.id)).size!==retained.length)throw inconsistent();
  return Promise.all(retained.map(async dependency=>{const current=selected?.id===dependency.id?selected:await this.source(dependency.id,selection,dependency.record.version);if(current.digest!==dependency.digest||current.payload!==JSON.stringify(dependency.record)){if(selection)throw new ExperimentError('An exact retained Search source does not match its public publication.',400);throw inconsistent();}return current;}));
 }
 private async bindings(publication:Checked){
  if(publication.record.version===5)return this.commitmentBindings(publication);
  if(publication.record.version===6)return this.windowBindings(publication);
  const source=await this.source(publication.row.strategy_id,false,publication.record.version>=3?2:1);if(source.digest!==publication.row.strategy_digest)throw inconsistent();
  let parent:Checked|null=null;
  if(publication.record.type==='MANIFEST'){
   if(JSON.stringify(experimentInputStrategy(publication.record.content.input).record)!==source.payload)throw inconsistent();
  }else{
   try{parent=await this.publication(publication.record.content.manifest.id);}catch{throw inconsistent();}
   if(parent.record.type!=='MANIFEST'||parent.record.version!==publication.record.version||parent.row.digest!==publication.record.content.manifest.digest||parent.row.strategy_id!==publication.row.strategy_id||parent.row.strategy_digest!==publication.row.strategy_digest)throw inconsistent();
   const input=parent.record.content.input,result=publication.record.content.result;
   if(result.kind==='ARTIFACT'){try{await verifyExperimentArtifact(result.artifact,input);}catch{throw inconsistent();}}
   if(JSON.stringify(publication.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(publication.record.author),experimentAuthorReference(parent.record.author),publication.record.content.claim)))throw inconsistent();
   const relation=publication.record.content.claim.relation;
   if(relation){
    let related:Checked;try{related=await this.publication(relation.id);}catch{throw inconsistent();}
    if(related.record.type!=='OUTCOME'||related.record.version!==parent.record.version||related.row.digest!==relation.digest||related.row.manifest_id!==parent.record.id||related.row.manifest_digest!==parent.row.digest||related.record.createdAt>publication.record.createdAt)throw inconsistent();
   }
  }
  const input=publication.record.type==='MANIFEST'?publication.record.content.input:parent!.record.type==='MANIFEST'?parent!.record.content.input:null;if(!input)throw inconsistent();
  return {source,parent,dependencies:await this.dependencies(input,false,source),closure:undefined as CommitmentSourceSnapshot[]|undefined,linked:[] as Checked[]};
 }
 private async commitmentLink(plan:Extract<ExperimentRecord,{version:5,type:'MANIFEST'}>,report:Extract<ExperimentRecord,{version:5,type:'OUTCOME'}>,load:(id:string)=>Promise<Checked>=id=>this.publication(id)){
  const link=report.content.result,[manifest,outcome]=await Promise.all([load(link.manifest.id),load(link.outcome.id)]);
  if(manifest.record.version!==4||manifest.record.type!=='MANIFEST'||outcome.record.version!==4||outcome.record.type!=='OUTCOME')throw inconsistent();
  try{verifyProgramCommitmentEvidenceLink(link,{id:manifest.record.id,digest:manifest.row.digest},{id:outcome.record.id,digest:outcome.row.digest},outcome.record.content.manifest);await verifyProgramCommitmentEvidenceInput(plan.content.input,manifest.record.content.input,plan.createdAt);if(outcome.record.content.result.kind==='ARTIFACT'){await verifyProgramCommitmentEvidenceArtifact(plan.content.input,outcome.record.content.result.artifact,plan.createdAt);await verifyExperimentArtifact(outcome.record.content.result.artifact,manifest.record.content.input);}}catch{throw inconsistent();}
  const input=manifest.record.content.input;if(input.startedAt>manifest.record.createdAt||input.events.some(event=>event.receivedAt>manifest.record.createdAt||event.completedAt>manifest.record.createdAt)||input.pending&&input.pending.receivedAt>manifest.record.createdAt)throw inconsistent();
  if(outcome.row.strategy_id!==publicationSource(plan)||manifest.row.strategy_id!==publicationSource(plan)||manifest.row.strategy_digest!==plan.content.input.config.strategy.digest||outcome.row.strategy_digest!==manifest.row.strategy_digest||manifest.record.createdAt<plan.createdAt||outcome.record.createdAt<manifest.record.createdAt||report.createdAt<outcome.record.createdAt||JSON.stringify(experimentAuthorReference(report.author))!==JSON.stringify(experimentAuthorReference(outcome.record.author))||report.content.claim.type!==outcome.record.content.claim.type)throw inconsistent();
  const relation=report.content.claim.relation,underlying=outcome.record.content.claim.relation;let relatedReport:Checked|null=null;
  if(relation){const related=await load(relation.id);relatedReport=related;if(related.record.version!==5||related.record.type!=='OUTCOME'||related.row.digest!==relation.digest||related.row.manifest_id!==plan.id||!underlying||underlying.id!==related.record.content.result.outcome.id||underlying.digest!==related.record.content.result.outcome.digest||underlying.type!==relation.type||related.record.createdAt>report.createdAt||related.record.content.result.manifest.id!==manifest.record.id||related.record.content.result.manifest.digest!==manifest.row.digest||JSON.stringify(related.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(related.record.author),experimentAuthorReference(plan.author),related.record.content.claim)))throw inconsistent();}
  else if(underlying)throw inconsistent();
  const original=underlying?await load(underlying.id):null;if(original&&(original.record.version!==4||original.record.type!=='OUTCOME'||original.row.digest!==underlying!.digest||original.row.manifest_id!==manifest.record.id))throw inconsistent();
  return [manifest,outcome,...original?[original]:[],...relatedReport?[relatedReport]:[]];
 }
 private async commitmentBindings(publication:Checked,observedClosure?:CommitmentSourceSnapshot[]){
  const record=publication.record;if(record.version!==5)throw inconsistent();let parent:Checked|null=null,plan:Extract<ExperimentRecord,{version:5,type:'MANIFEST'}>,linked:Checked[]=[];
  if(record.type==='MANIFEST')plan=record;
  else{parent=await this.publication(record.content.manifest.id);if(parent.record.version!==5||parent.record.type!=='MANIFEST'||parent.row.digest!==record.content.manifest.digest||parent.row.strategy_id!==publication.row.strategy_id||parent.row.strategy_digest!==publication.row.strategy_digest)throw inconsistent();plan=parent.record;if(JSON.stringify(record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(record.author),experimentAuthorReference(plan.author),record.content.claim)))throw inconsistent();linked=await this.commitmentLink(plan,record);}
  const closure=observedClosure??await readCommitmentSourceClosure(this.db,plan.content.input),selected=closure.find(value=>value.id===publication.row.strategy_id);if(!selected||selected.digest!==publication.row.strategy_digest||selected.payload!==JSON.stringify(plan.content.input.config.strategy.record))throw inconsistent();
  return {source:selected,parent,dependencies:closure,closure,linked};
 }
 /** A sampled-window link has its own complete raw envelope. An existing V4
  * artifact is observed in place, never copied or treated as a V6 input. */
 private async windowLink(plan:Extract<ExperimentRecord,{version:6,type:'MANIFEST'}>,report:Extract<ExperimentRecord,{version:6,type:'OUTCOME'}>,load:(id:string)=>Promise<Checked>=id=>this.publication(id),verificationScope?:ProgramWindowEvidenceVerificationScope){
  const link=report.content.result,[manifest,outcome]=await Promise.all([load(link.manifest.id),load(link.outcome.id)]);
  if(manifest.record.version!==4||manifest.record.type!=='MANIFEST'||outcome.record.version!==4||outcome.record.type!=='OUTCOME')throw inconsistent();
  try{
   verifyProgramWindowEvidenceReferences(link,{id:manifest.record.id,digest:manifest.row.digest},{id:outcome.record.id,digest:outcome.row.digest},outcome.record.content.manifest);
   await verifyProgramWindowEvidenceBinding(link,plan.content.input,manifest.record.content.input,outcome.record.content.result.kind==='ARTIFACT'?outcome.record.content.result.artifact:null,plan.createdAt,report.createdAt,verificationScope);

  }catch{throw inconsistent();}
  const source=plan.content.input.plan.config.strategy,input=manifest.record.content.input;
  if(manifest.row.strategy_id!==source.record.id||manifest.row.strategy_digest!==source.digest||outcome.row.strategy_id!==source.record.id||outcome.row.strategy_digest!==source.digest
   ||manifest.record.createdAt<plan.createdAt||outcome.record.createdAt<manifest.record.createdAt||report.createdAt<outcome.record.createdAt
   ||input.startedAt>manifest.record.createdAt||input.events.some(event=>event.receivedAt>manifest.record.createdAt||event.completedAt>manifest.record.createdAt)||input.pending&&input.pending.receivedAt>manifest.record.createdAt
   ||JSON.stringify(experimentAuthorReference(report.author))!==JSON.stringify(experimentAuthorReference(outcome.record.author))||report.content.claim.type!==outcome.record.content.claim.type
   ||JSON.stringify(outcome.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(outcome.record.author),experimentAuthorReference(manifest.record.author),outcome.record.content.claim)))throw inconsistent();
  const relation=report.content.claim.relation,underlying=outcome.record.content.claim.relation;
  if(!relation){if(underlying)throw inconsistent();return [manifest,outcome];}
  const related=await load(relation.id);
  if(related.record.version!==6||related.record.type!=='OUTCOME'||related.row.digest!==relation.digest||related.row.manifest_id!==plan.id||related.row.manifest_digest!==report.content.manifest.digest
   ||related.record.createdAt>report.createdAt||related.record.content.claim.type!=='ORIGINAL'||related.record.content.claim.relation!==null
   ||related.row.strategy_id!==source.record.id||related.row.strategy_digest!==source.digest
   ||!underlying||underlying.type!==relation.type||underlying.id!==related.record.content.result.outcome.id||underlying.digest!==related.record.content.result.outcome.digest
   ||related.record.content.result.manifest.id!==manifest.record.id||related.record.content.result.manifest.digest!==manifest.row.digest
   ||JSON.stringify(related.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(related.record.author),experimentAuthorReference(plan.author),related.record.content.claim)))throw inconsistent();
  const original=await load(underlying.id);
  if(original.record.version!==4||original.record.type!=='OUTCOME'||original.row.digest!==underlying.digest||original.row.manifest_id!==manifest.record.id||original.row.manifest_digest!==manifest.row.digest
   ||original.row.strategy_id!==source.record.id||original.row.strategy_digest!==source.digest
   ||original.record.content.claim.type!=='ORIGINAL'||original.record.content.claim.relation!==null
   ||JSON.stringify(original.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(original.record.author),experimentAuthorReference(manifest.record.author),original.record.content.claim))
   ||JSON.stringify(experimentAuthorReference(related.record.author))!==JSON.stringify(experimentAuthorReference(original.record.author))||related.record.createdAt<original.record.createdAt)throw inconsistent();
  try{await verifyProgramWindowEvidenceBinding(related.record.content.result,plan.content.input,manifest.record.content.input,original.record.content.result.kind==='ARTIFACT'?original.record.content.result.artifact:null,plan.createdAt,related.record.createdAt,verificationScope);}catch{throw inconsistent();}
  return [manifest,outcome,original,related];
 }
 private async windowDeclaration(input:ProgramWindowInput){
  if(!input.declaration)return [] as Checked[];
  const declaration=await this.publication(input.declaration.id);
  if(declaration.record.version!==5||declaration.record.type!=='MANIFEST'||declaration.row.digest!==input.declaration.digest)throw inconsistent();
  try{await verifyProgramWindowDeclarationBinding(input,input.declaration,declaration.record.content.input,declaration.record.createdAt);}catch{throw inconsistent();}
  return [declaration];
 }
 private async windowBindings(publication:Checked,verificationScope?:ProgramWindowEvidenceVerificationScope){
  const record=publication.record;if(record.version!==6)throw inconsistent();
  let parent:Checked|null=null,plan:Extract<ExperimentRecord,{version:6,type:'MANIFEST'}>,linked:Checked[]=[];
  if(record.type==='MANIFEST')plan=record;
  else{
   parent=await this.publication(record.content.manifest.id);
   if(parent.record.version!==6||parent.record.type!=='MANIFEST'||parent.row.digest!==record.content.manifest.digest||parent.row.strategy_id!==publication.row.strategy_id||parent.row.strategy_digest!==publication.row.strategy_digest)throw inconsistent();
   plan=parent.record;
   if(JSON.stringify(record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(record.author),experimentAuthorReference(plan.author),record.content.claim)))throw inconsistent();
   linked=await this.windowLink(plan,record,undefined,verificationScope);
  }
  linked.push(...await this.windowDeclaration(plan.content.input));
  const closure=await readCommitmentSourceClosure(this.db,plan.content.input.plan),selected=closure.find(value=>value.id===publication.row.strategy_id);
  if(!selected||selected.digest!==publication.row.strategy_digest||selected.payload!==JSON.stringify(plan.content.input.plan.config.strategy.record))throw inconsistent();
  return {source:selected,parent,dependencies:closure,closure,linked};
 }
 private async project(publication:Checked,observation?:{events:EventRow[];outcomeCount:number},deferredFences?:CommitmentFence[]):Promise<ExperimentPublicItem>{
  const ownHistory=await this.events(publication,observation?.events),{events,state:own,reason}=ownHistory,record=publication.record,{source,parent,dependencies,closure,linked}=await this.bindings(publication);
  const parentHistory=parent?await this.events(parent):null,parentState=parentHistory?.state??'VISIBLE';
  const outcomeCount=observation?.outcomeCount??(record.type==='MANIFEST'?(await this.db.prepare("SELECT COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?").bind(record.id).first<{n:number}>())?.n??0:0);
  let finalSources=true;if(record.version===4){const values:Values=[],clauses=dependencies.map(value=>this.sourceClause(value,values));const observed=await this.db.prepare(`SELECT CASE WHEN ${clauses.join(' AND ')} THEN 1 ELSE 0 END AS visible`).bind(...values).first<{visible:number}>();if(!observed||observed.visible!==0&&observed.visible!==1)throw inconsistent();finalSources=observed.visible===1;}
  if(closure)finalSources=await confirmCommitmentSourceClosure(this.db,closure);
  const linkedHistories=await Promise.all(linked.map(async value=>({publication:value,...await this.events(value)}))),linkedVisible=linkedHistories.map(value=>value.state==='VISIBLE');
  if(closure){const snapshot={closure,publications:[publication,...parent?[parent]:[],...linked].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:[...ownHistory.rows,...parentHistory?.rows??[],...linkedHistories.flatMap(value=>value.rows)].sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.sequence-b.sequence)};if(deferredFences)deferredFences.push(snapshot);else await this.assertCommitmentContextFence(snapshot);}
  const suppression=dependencies.some(value=>!value.visible)||!finalSources?'SOURCE_UNAVAILABLE':parentState!=='VISIBLE'||linkedVisible.some(value=>!value)?'PARENT_UNAVAILABLE':null;
  const state=own==='WITHDRAWN'?'WITHDRAWN':own==='HIDDEN'||suppression?'HIDDEN':'VISIBLE';
  return {id:record.id,digest:publication.row.digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:experimentAuthorReference(record.author),strategy:{id:source.id,digest:source.digest},manifest:record.type==='OUTCOME'?record.content.manifest:null,state,reason,suppression,reporting:record.type==='OUTCOME'||outcomeCount>0?'AUTHOR_REPORTED':'UNREPORTED',outcomeCount,record:state==='VISIBLE'?record:null,moderation:events};
 }
 private summary(item:ExperimentPublicItem){const {record,moderation,...metadata}=item;void moderation;const method=record?experimentRecordMethod(record):undefined;return experimentSummarySchema.parse({...metadata,...method?{method}:{},name:record?.content.name??null,status:record?experimentRecordStatus(record):null,flags:record?.flags??[]});}
 private async checkReport(row:ReportRow){
  try{
   if(!row.payload||new TextEncoder().encode(row.payload).byteLength>4096||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const report=experimentPrivateReportSchema.parse(JSON.parse(row.payload));
   if(JSON.stringify(report)!==row.payload||await experimentDigest(row.payload)!==row.digest||report.requestId!==row.request_id||report.id!==row.record_id||report.digest!==row.record_digest||report.createdAt!==row.created_at||authorKey(report.reporter)!==row.author_key||report.reporter.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedExperimentCommand({action:'report',requestId:report.requestId,id:report.id,digest:report.digest,reason:report.reason,details:report.details,policyAccepted:'public-experiment-v1'});
   if(await experimentDigest(command.payload)!==row.command_digest)throw Error();return report;
  }catch{throw inconsistent();}
 }

 private async replay(context:Context,command:ExperimentCommand,commandDigest:string,at:string){
  await this.requireCredential(context,at);
  const [publications,events,reports,reviews]=await Promise.all([
   this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<PublicationRow>(),
   this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<EventRow>(),
   this.db.prepare(`SELECT ${reportColumns} FROM experiment_reports WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<ReportRow>(),
   this.db.prepare('SELECT 1 AS retained FROM experiment_reviews WHERE author_key=? AND request_id=? UNION ALL SELECT 1 FROM experiment_review_moderation WHERE author_key=? AND request_id=? UNION ALL SELECT 1 FROM experiment_review_reports WHERE author_key=? AND request_id=? LIMIT 2').bind(context.key,command.requestId,context.key,command.requestId,context.key,command.requestId).all<{retained:number}>(),
  ]);
  if(reviews.results.length){if(publications.results.length+events.results.length+reports.results.length)throw inconsistent();throw new ExperimentError('Request ID already used for different experiment material.');}
  if(publications.results.length+events.results.length+reports.results.length>1)throw inconsistent();
  const row=publications.results[0]??events.results[0]??reports.results[0];if(!row)return null;
  if(row.command_digest!==commandDigest)throw new ExperimentError('Request ID already used for different experiment material.');
  let item:ExperimentPublicItem|null=null,report:null|{requestId:string;id:string;digest:string;reason:string;createdAt:string}=null;
  if(publications.results[0]){
   if(command.action!=='register'&&command.action!=='outcome')throw inconsistent();item=await this.project(await this.checkPublication(publications.results[0]));
  }else if(events.results[0]){
   if(command.action!=='withdraw'&&command.action!=='moderate')throw inconsistent();item=await this.project(await this.publication(events.results[0].record_id));
   if(!item.moderation.some(event=>event.requestId===command.requestId&&authorKey(event.actor)===context.key))throw inconsistent();
  }else{
   if(command.action!=='report')throw inconsistent();const retained=await this.checkReport(reports.results[0]);report={requestId:retained.requestId,id:retained.id,digest:retained.digest,reason:retained.reason,createdAt:retained.createdAt};
  }
  // Reconciliation is still a credential-authorized read; a stale earlier check
  // cannot reveal a receipt after revocation while material was being validated.
  await this.requireCredential(context,at);
  return experimentWriteSchema.parse({version:1,action:command.action,requestId:command.requestId,item,report,executionEnabled:false});
 }

 async list(cursor?:string|null){
  const anchor=cursor?await this.publication(cursor):null;if(anchor&&anchor.record.type!=='MANIFEST')throw new ExperimentError('Manifest cursor not found.',404);
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE type='MANIFEST' ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${experimentLimits.page+1}`).bind(...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row))),page=checked.slice(0,experimentLimits.page),commitments=page.filter(item=>[5,6].includes(item.record.version)),ids=commitments.map(item=>item.record.id);
  const histories=ids.length?(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT 341`).bind(...ids).all<EventRow>()).results:[],counts=ids.length?(await this.db.prepare(`SELECT manifest_id,COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id IN (${ids.map(()=>'?').join(',')}) GROUP BY manifest_id LIMIT 21`).bind(...ids).all<{manifest_id:string;n:number}>()).results:[];
  if(histories.length>ids.length*experimentLimits.eventsPerRecord||histories.some(row=>!ids.includes(row.record_id))||counts.length>ids.length)throw inconsistent();
  const fences:CommitmentFence[]=[],items=await Promise.all(page.map(async item=>this.summary(await this.project(item,[5,6].includes(item.record.version)?{events:histories.filter(row=>row.record_id===item.record.id),outcomeCount:counts.find(row=>row.manifest_id===item.record.id)?.n??0}:undefined,fences))));
  if(fences.length)await this.assertCommitmentContextFences(fences);
  return experimentListSchema.parse({version:1,items,nextCursor:rows.length>experimentLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 async get(recordId:string){
  const publication=await this.publication(recordId);
  if(![5,6].includes(publication.record.version))return experimentGetSchema.parse({version:1,item:await this.project(publication),executionEnabled:false});
  const fences:CommitmentFence[]=[],item=await this.project(publication,undefined,fences);
  if(fences.length!==1)throw inconsistent();await this.assertCommitmentContextFences(fences);
  const result=experimentGetSchema.parse({version:1,item,executionEnabled:false});boundedExperimentTransport(result);
  this.commitmentAgentReceipts.set(result,{payload:JSON.stringify(result),fence:fences[0]});return result;
 }
 /** Complete a V5 agent acknowledgment after its last authentication await.
  * The exact raw get envelope is a same-instance, one-use read capability;
  * the final SQL observes credentials and all retained dependencies together. */
 async confirmCommitmentAgentReceipt(result:Awaited<ReturnType<ExperimentRepository['get']>>,principal:Extract<ExperimentActor,{kind:'AGENT'}>['principal'],at:string){
  const snapshot=this.commitmentAgentReceipts.get(result);this.commitmentAgentReceipts.delete(result);
  if(!snapshot)throw inconsistent();try{boundedExperimentTransport(result);}catch{throw inconsistent();}if(JSON.stringify(result)!==snapshot.payload)throw inconsistent();
  const context=await this.context({kind:'AGENT',principal},at);if(authorKey(result.item.author)!==context.key||result.item.author.sponsorId!==context.sponsor)throw inconsistent();
  const fence=this.commitmentSnapshotFence(snapshot.fence,'?1',false),values:Values=[fence.payload],credential=this.credentialClause(context,at,values);
  const current=await this.db.prepare(`SELECT CASE WHEN ${fence.clause} THEN 1 ELSE 0 END AS matches,CASE WHEN ${credential} THEN 1 ELSE 0 END AS credential`).bind(...values).first<{matches:number;credential:number}>();
  if(!current||![0,1].includes(current.matches)||![0,1].includes(current.credential))throw inconsistent();if(current.credential!==1)throw new ExperimentError('Agent credential is invalid, expired or revoked.',401);if(current.matches!==1)throw inconsistent();
 }
 async confirmAgentPrivateReportReceipt(raw:ReturnType<typeof experimentWriteSchema.parse>,principal:Extract<ExperimentActor,{kind:'AGENT'}>['principal'],at:string){
  const receipt=experimentWriteSchema.parse(raw);if(receipt.action!=='report'||!receipt.report)throw inconsistent();
  const context=await this.context({kind:'AGENT',principal},at),row=await this.db.prepare(`SELECT ${reportColumns} FROM experiment_reports WHERE author_key=? AND request_id=?`).bind(context.key,receipt.requestId).first<ReportRow>();
  if(!row)throw inconsistent();const report=await this.checkReport(row);
  if(report.id!==receipt.report.id||report.digest!==receipt.report.digest||report.reason!==receipt.report.reason||report.createdAt!==receipt.report.createdAt||report.requestId!==receipt.requestId)throw inconsistent();
  const values:Values=[context.key,receipt.requestId,row.payload!,row.digest,row.command_digest,row.sponsor_key,row.record_id,row.record_digest,row.created_at],credential=this.credentialClause(context,at,values);
  const current=await this.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM experiment_reports WHERE author_key=?1 AND request_id=?2 AND payload=?3 AND digest=?4 AND command_digest=?5 AND sponsor_key=?6 AND record_id=?7 AND record_digest=?8 AND created_at=?9) THEN 1 ELSE 0 END AS matches,CASE WHEN ${credential} THEN 1 ELSE 0 END AS credential`).bind(...values).first<{matches:number;credential:number}>();
  if(!current||![0,1].includes(current.matches)||![0,1].includes(current.credential))throw inconsistent();if(current.credential!==1)throw new ExperimentError('Agent credential is invalid, expired or revoked.',401);if(current.matches!==1)throw inconsistent();
 }
 /** Review-only current availability. Three exact records share one commitment
  * parent and one closure; no large authored body enters this projection. */
 async commitmentContexts(references:Array<{id:string;digest:string}>){
  if(!Array.isArray(references)||references.length<1||references.length>3||references.some(value=>!value||Object.keys(value).length!==2||!uuid.test(value.id)||!hash.test(value.digest))||new Set(references.map(value=>value.id)).size!==references.length)throw new ExperimentError('Use one to three distinct exact commitment records.',400);
  const records=await Promise.all(references.map(value=>this.publication(value.id)));if(records.some((value,index)=>value.row.digest!==references[index].digest))throw new ExperimentError('Exact commitment context not found.',404);if(records.some(value=>value.record.version!==5))throw new ExperimentError('Commitment contexts require version-five records.',400);
  const parents=[...new Set(records.map(value=>value.record.type==='MANIFEST'?value.record.id:value.record.content.manifest.id))];if(parents.length!==1)throw new ExperimentError('Commitment contexts must share one exact declaration.',400);
  const parent=records.find(value=>value.record.id===parents[0])??await this.publication(parents[0]);if(parent.record.version!==5||parent.record.type!=='MANIFEST')throw inconsistent();
  const closure=await readCommitmentSourceClosure(this.db,parent.record.content.input),sourceVisible=await confirmCommitmentSourceClosure(this.db,closure),bound=await Promise.all(records.map(value=>this.commitmentBindings(value,closure))),dependencies=new Map<string,Checked>([[parent.record.id,parent],...records.map(value=>[value.record.id,value] as [string,Checked]),...bound.flatMap(value=>value.linked.map(item=>[item.record.id,item] as [string,Checked]))]);
  if(dependencies.size>10)throw inconsistent();const histories=await Promise.all([...dependencies.values()].map(async value=>({id:value.record.id,...await this.events(value)}))),states=new Map(histories.map(value=>[value.id,value.state]));
  const values:Values=[],clauses=[commitmentSourceFenceClause(add(values,commitmentSourceFenceJson(closure))),...[...dependencies.values()].map(value=>this.targetClause(value,values))];if(values.length>experimentCommitmentStoreLimits.maximumBindParameters)throw inconsistent();
  const fence=await this.db.prepare(`SELECT CASE WHEN ${clauses.join(' AND ')} THEN 1 ELSE 0 END AS visible`).bind(...values).first<{visible:number}>();if(!fence||![0,1].includes(fence.visible))throw inconsistent();
  const result=records.map((value,index)=>{const ownState=states.get(value.record.id)!,parentUnavailable=states.get(parent.record.id)!=='VISIBLE'||bound[index].linked.some(item=>states.get(item.record.id)!=='VISIBLE'),sourceUnavailable=!sourceVisible||closure.some(item=>!item.visible);return {reference:{id:value.record.id,digest:value.row.digest},ownState,sourceUnavailable,parentUnavailable,visible:ownState==='VISIBLE'&&!sourceUnavailable&&!parentUnavailable&&fence.visible===1};});
  const snapshot={payload:JSON.stringify(result),closure,publications:[...dependencies.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:histories.flatMap(value=>value.rows).sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.sequence-b.sequence)};await this.assertCommitmentContextFence(snapshot);this.commitmentConfirmations.set(result,snapshot);return result;
 }
 /** V6 has a separate full-context read; V5 declaration semantics are unchanged.
  * The existing one-use completion/fence capability supplies no review authority. */
 async windowContexts(references:Array<{id:string;digest:string}>){
  if(!Array.isArray(references)||references.length<1||references.length>3||references.some(value=>!value||Object.keys(value).length!==2||!uuid.test(value.id)||!hash.test(value.digest))||new Set(references.map(value=>value.id)).size!==references.length)throw new ExperimentError('Use one to three distinct exact sampled-window records.',400);
  const records=await Promise.all(references.map(value=>this.publication(value.id)));
  if(records.some((value,index)=>value.row.digest!==references[index].digest))throw new ExperimentError('Exact sampled-window context not found.',404);
  if(records.some(value=>value.record.version!==6))throw new ExperimentError('Sampled-window contexts require version-six records.',400);
  const parents=[...new Set(records.map(value=>value.record.type==='MANIFEST'?value.record.id:value.record.content.manifest.id))];
  if(parents.length!==1)throw new ExperimentError('Sampled-window contexts must share one exact protocol declaration.',400);
  const verificationScope=new ProgramWindowEvidenceVerificationScope(),bound=await Promise.all(records.map(value=>this.windowBindings(value,verificationScope))),closure=bound[0].closure;
  if(bound.some(value=>JSON.stringify(value.closure)!==JSON.stringify(closure)))throw inconsistent();
  const dependencies=new Map<string,Checked>(records.map(value=>[value.record.id,value]));
  for(const value of bound)for(const dependency of [...value.parent?[value.parent]:[],...value.linked]){
   const previous=dependencies.get(dependency.record.id);if(previous&&JSON.stringify(previous.row)!==JSON.stringify(dependency.row))throw inconsistent();dependencies.set(dependency.record.id,dependency);
  }
  if(dependencies.size>10)throw inconsistent();
  const histories=await Promise.all([...dependencies.values()].map(async value=>({id:value.record.id,...await this.events(value)}))),states=new Map(histories.map(value=>[value.id,value.state]));
  const result=records.map((value,index)=>{
   const ownState=states.get(value.record.id)!,sourceUnavailable=closure.some(source=>!source.visible),parentUnavailable=!!bound[index].parent&&states.get(bound[index].parent!.record.id)!=='VISIBLE'||bound[index].linked.some(item=>states.get(item.record.id)!=='VISIBLE');
   return {reference:{id:value.record.id,digest:value.row.digest},ownState,sourceUnavailable,parentUnavailable,visible:ownState==='VISIBLE'&&!sourceUnavailable&&!parentUnavailable};
  });
  const snapshot={payload:JSON.stringify(result),closure,publications:[...dependencies.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:histories.flatMap(value=>value.rows).sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.sequence-b.sequence)};
  await this.assertCommitmentContextFence(snapshot);this.commitmentConfirmations.set(result,snapshot);return result;
 }
 private async assertCommitmentContextFence(snapshot:CommitmentFence){return this.assertCommitmentContextFences([snapshot]);}
 private async assertCommitmentContextFences(snapshots:CommitmentFence[]){
  const fence=this.commitmentReadFence(snapshots),current=await this.db.prepare(`SELECT CASE WHEN ${fence.clause} THEN 1 ELSE 0 END AS matches`).bind(...fence.values).first<{matches:number}>();
  if(current?.matches!==1)throw inconsistent();
 }
 /** Complete canonical bytes and moderation prefixes close in one observation.
  * Deduplicate shared rows before bounded chunking; an oversized whole snapshot
  * is refused rather than truncated or replaced by digest-only comparisons. */
 private commitmentReadFence(snapshots:CommitmentFence[]){
  const limits=experimentCommitmentStoreLimits;if(!snapshots.length||snapshots.length>limits.fenceSnapshots)throw inconsistent();
  const publications=new Map<string,PublicationRow>(),eventsByKey=new Map<string,EventRow>(),sources=new Map<string,Omit<CommitmentSourceSnapshot,'record'|'visible'>>();
  for(const snapshot of snapshots){
   commitmentSourceFenceJson(snapshot.closure);
   for(const {record:_record,visible:_visible,...source} of snapshot.closure){const previous=sources.get(source.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(source))throw inconsistent();sources.set(source.id,source);}
   for(const row of snapshot.publications){const previous=publications.get(row.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(row))throw inconsistent();publications.set(row.id,row);}
   for(const row of snapshot.events){const key=row.record_id+':'+row.sequence,previous=eventsByKey.get(key);if(previous&&JSON.stringify(previous)!==JSON.stringify(row))throw inconsistent();eventsByKey.set(key,row);}
  }
  if(!publications.size||publications.size>limits.fenceRecords||eventsByKey.size>publications.size*limits.events||[...eventsByKey.values()].some(row=>!publications.has(row.record_id)))throw inconsistent();
  const values:Values=[],clauses:string[]=[];let sealedBytes=0;
  const tooLarge=()=>new ExperimentError('Complete commitment read fence exceeds its fixed database budget. Retained material was preserved.',413);
  const chunks=(rows:unknown[],clause:(placeholder:string)=>string)=>{
   let parts:string[]=[],chunkBytes=2;
   const seal=()=>{if(!parts.length)return;if(sealedBytes+chunkBytes>limits.readFenceBytes)throw tooLarge();sealedBytes+=chunkBytes;clauses.push(clause(add(values,'['+parts.join(',')+']')));parts=[];chunkBytes=2;if(values.length>limits.maximumBindParameters)throw inconsistent();};
   for(const row of rows){const serialized=JSON.stringify(row),size=new TextEncoder().encode(serialized).byteLength;if(size+2>limits.readFenceChunkBytes)throw tooLarge();if(chunkBytes+size+(parts.length?1:0)>limits.readFenceChunkBytes)seal();const nextBytes=chunkBytes+size+(parts.length?1:0);if(sealedBytes+nextBytes>limits.readFenceBytes)throw tooLarge();parts.push(serialized);chunkBytes=nextBytes;}seal();
  };
  chunks([...sources.values()].sort((a,b)=>a.id.localeCompare(b.id)),placeholder=>commitmentSourceFenceClause(placeholder,false));
  const fields=['type','manifest_id','manifest_digest','strategy_id','strategy_digest','author_key','sponsor_key','request_id','command_digest','payload','digest','created_at'],eventFields=['author_key','sponsor_key','request_id','command_digest','payload','digest','state','reason','created_at'];
  const events=[...eventsByKey.values()].sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.sequence-b.sequence);
  chunks([...publications.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>({...row,events:events.filter(event=>event.record_id===row.id)})),placeholder=>`NOT EXISTS(SELECT 1 FROM json_each(${placeholder}) d LEFT JOIN experiment_records p ON p.id=json_extract(d.value,'$.id') WHERE p.id IS NULL OR ${fields.map(field=>`p.${field} IS NOT json_extract(d.value,'$.${field}')`).join(' OR ')} OR (SELECT COUNT(*) FROM experiment_moderation WHERE record_id=p.id)<>json_array_length(json_extract(d.value,'$.events')) OR EXISTS(SELECT 1 FROM json_each(json_extract(d.value,'$.events')) e LEFT JOIN experiment_moderation m ON m.record_id=p.id AND m.sequence=json_extract(e.value,'$.sequence') WHERE m.record_id IS NULL OR ${eventFields.map(field=>`m.${field} IS NOT json_extract(e.value,'$.${field}')`).join(' OR ')}))`);
  return {values,clause:clauses.join(' AND '),bytes:sealedBytes};
 }
 /** One-use request-local completion after the caller's asynchronous validation. */
 async confirmCommitmentContexts(result:Awaited<ReturnType<ExperimentRepository['commitmentContexts']>>){try{boundedProgramCommitmentValue(result,4096);}catch{throw inconsistent();}const snapshot=this.commitmentConfirmations.get(result);this.commitmentConfirmations.delete(result);if(!snapshot||JSON.stringify(result)!==snapshot.payload)throw inconsistent();await this.assertCommitmentContextFence(snapshot);}
 /** Server-only atomic write fence. A retained capability supplies no authority;
  * trusted reviewers still pass every existing permission/quota/target check. */
 commitmentContextWriteFence(result:Awaited<ReturnType<ExperimentRepository['commitmentContexts']>>,placeholder:string,requireVisible=true){
  if(typeof placeholder!=='string'||!/^\?[1-9][0-9]*$/.test(placeholder)||typeof requireVisible!=='boolean')throw inconsistent();try{boundedProgramCommitmentValue(result,4096);}catch{throw inconsistent();}const snapshot=this.commitmentConfirmations.get(result);if(!snapshot||JSON.stringify(result)!==snapshot.payload||snapshot.publications.length>10)throw inconsistent();
  return this.commitmentSnapshotFence(snapshot,placeholder,requireVisible);
 }
 private commitmentSnapshotFence(snapshot:CommitmentFence,placeholder:string,requireVisible:boolean){
  if(snapshot.publications.length>10)throw inconsistent();
  const payload=JSON.stringify({sources:JSON.parse(commitmentSourceFenceJson(snapshot.closure)),publications:snapshot.publications,events:snapshot.events});if(new TextEncoder().encode(payload).byteLength>experimentCommitmentStoreLimits.contextWriteFenceBytes)throw new ExperimentError('Complete commitment write fence exceeds its fixed database budget.',413);
  const publications=`json_extract(${placeholder},'$.publications')`,events=`json_extract(${placeholder},'$.events')`,fields=['type','manifest_id','manifest_digest','strategy_id','strategy_digest','author_key','sponsor_key','request_id','command_digest','payload','digest','created_at'],eventFields=['author_key','sponsor_key','request_id','command_digest','payload','digest','state','reason','created_at'];
  const clause=`${commitmentSourceFenceClause(`json_extract(${placeholder},'$.sources')`,requireVisible)} AND NOT EXISTS(SELECT 1 FROM json_each(${publications}) d LEFT JOIN experiment_records p ON p.id=json_extract(d.value,'$.id') WHERE p.id IS NULL OR ${fields.map(field=>`p.${field} IS NOT json_extract(d.value,'$.${field}')`).join(' OR ')} OR (SELECT COUNT(*) FROM experiment_moderation WHERE record_id=p.id)<>(SELECT COUNT(*) FROM json_each(${events}) e WHERE json_extract(e.value,'$.record_id')=p.id) ${requireVisible?"OR COALESCE((SELECT state FROM experiment_moderation WHERE record_id=p.id ORDER BY sequence DESC LIMIT 1),'VISIBLE')<>'VISIBLE'":''}) AND NOT EXISTS(SELECT 1 FROM json_each(${events}) e LEFT JOIN experiment_moderation m ON m.record_id=json_extract(e.value,'$.record_id') AND m.sequence=json_extract(e.value,'$.sequence') WHERE m.record_id IS NULL OR ${eventFields.map(field=>`m.${field} IS NOT json_extract(e.value,'$.${field}')`).join(' OR ')})`;
  return {payload,clause};
 }
 async outcomes(manifestId:string,cursor?:string|null){
  const manifest=await this.publication(manifestId);if(manifest.record.type!=='MANIFEST')throw new ExperimentError('Manifest not found.',404);
  if(manifest.record.version===5)return this.commitmentOutcomePage(manifest,cursor??null);
  if(manifest.record.version===6)return this.windowOutcomePage(manifest,cursor??null);
  await this.bindings(manifest);const anchor=cursor?await this.publication(cursor):null;if(anchor&&(anchor.record.type!=='OUTCOME'||anchor.row.manifest_id!==manifestId))throw new ExperimentError('Outcome cursor not found.',404);
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE type='OUTCOME' AND manifest_id=? ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${experimentLimits.page+1}`).bind(manifestId,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row))),page=checked.slice(0,experimentLimits.page),items=await Promise.all(page.map(async item=>this.summary(await this.project(item))));
  return experimentOutcomesSchema.parse({version:1,items,nextCursor:rows.length>experimentLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 private async windowOutcomePage(parent:Checked,cursor:string|null){
  if(parent.record.version!==6||parent.record.type!=='MANIFEST')throw inconsistent();const verificationScope=new ProgramWindowEvidenceVerificationScope(),plan=parent.record,cache=new Map<string,Checked>([[plan.id,parent]]);
  const anchor=cursor?await this.publication(cursor):null;if(anchor&&(anchor.record.type!=='OUTCOME'||anchor.record.version!==6||anchor.row.manifest_id!==plan.id))throw new ExperimentError('Outcome cursor not found.',404);if(anchor)cache.set(anchor.record.id,anchor);
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE type='OUTCOME' AND manifest_id=? ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT 21`).bind(plan.id,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results,checked=await Promise.all(rows.map(row=>this.checkPublication(row))),page=checked.slice(0,experimentLimits.page);
  for(const value of checked){if(value.record.version!==6||value.record.type!=='OUTCOME'||value.row.manifest_digest!==parent.row.digest||value.row.strategy_id!==parent.row.strategy_id||value.row.strategy_digest!==parent.row.strategy_digest||value.record.createdAt<plan.createdAt||JSON.stringify(value.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(value.record.author),experimentAuthorReference(plan.author),value.record.content.claim)))throw inconsistent();cache.set(value.record.id,value);}
  const loadMany=async(rawIds:string[])=>{const ids=[...new Set(rawIds)].filter(value=>!cache.has(value));if(cache.size+ids.length>experimentCommitmentStoreLimits.fenceRecords)throw inconsistent();for(let index=0;index<ids.length;index+=experimentCommitmentStoreLimits.recordReadChunk){const chunk=ids.slice(index,index+experimentCommitmentStoreLimits.recordReadChunk),found=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE id IN (${chunk.map(()=>'?').join(',')}) LIMIT 5`).bind(...chunk).all<PublicationRow>()).results;if(found.length!==chunk.length||new Set(found.map(value=>value.id)).size!==found.length||found.some(value=>!chunk.includes(value.id)))throw inconsistent();for(const value of await Promise.all(found.map(value=>this.checkPublication(value))))cache.set(value.record.id,value);}};
  await loadMany(page.flatMap(value=>value.record.version===6&&value.record.type==='OUTCOME'?[value.record.content.result.manifest.id,value.record.content.result.outcome.id,...value.record.content.claim.relation?[value.record.content.claim.relation.id]:[]]:[]));
  await loadMany(page.flatMap(value=>{if(value.record.version!==6||value.record.type!=='OUTCOME')throw inconsistent();const outcome=cache.get(value.record.content.result.outcome.id);if(!outcome||outcome.record.version!==4||outcome.record.type!=='OUTCOME')throw inconsistent();return outcome.record.content.claim.relation?[outcome.record.content.claim.relation.id]:[];}));
  await loadMany(plan.content.input.declaration?[plan.content.input.declaration.id]:[]);
  const declaration=plan.content.input.declaration?cache.get(plan.content.input.declaration.id):null;
  if(plan.content.input.declaration){if(!declaration||declaration.record.version!==5||declaration.record.type!=='MANIFEST'||declaration.row.digest!==plan.content.input.declaration.digest)throw inconsistent();try{await verifyProgramWindowDeclarationBinding(plan.content.input,plan.content.input.declaration,declaration.record.content.input,declaration.record.createdAt);}catch{throw inconsistent();}}
  const load=async(value:string)=>{const record=cache.get(value);if(!record)throw inconsistent();return record;},links=await Promise.all(page.map(value=>{if(value.record.version!==6||value.record.type!=='OUTCOME')throw inconsistent();return this.windowLink(plan,value.record,load,verificationScope).then(values=>[...values,...declaration?[declaration]:[]]);})),closure=await readCommitmentSourceClosure(this.db,plan.content.input.plan),sourceVisible=await confirmCommitmentSourceClosure(this.db,closure),retained=new Map<string,Checked>([[parent.record.id,parent],...page.map(value=>[value.record.id,value] as [string,Checked]),...links.flatMap(values=>values.map(value=>[value.record.id,value] as [string,Checked]))]);
  const ids=[...retained.keys()],eventRows=(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${ids.length*17+1}`).bind(...ids).all<EventRow>()).results;if(eventRows.length>ids.length*experimentLimits.eventsPerRecord||eventRows.some(row=>!retained.has(row.record_id)))throw inconsistent();const histories=new Map(await Promise.all([...retained.values()].map(async value=>[value.record.id,await this.events(value,eventRows.filter(row=>row.record_id===value.record.id))] as const))),parentHistory=histories.get(plan.id)!;
  const items=page.map((value,index)=>{const own=histories.get(value.record.id)!,suppression=!sourceVisible?'SOURCE_UNAVAILABLE':parentHistory.state!=='VISIBLE'||links[index].some(link=>histories.get(link.record.id)!.state!=='VISIBLE')?'PARENT_UNAVAILABLE':null,state=own.state==='WITHDRAWN'?'WITHDRAWN':own.state==='HIDDEN'||suppression?'HIDDEN':'VISIBLE';return this.summary({id:value.record.id,digest:value.row.digest,type:'OUTCOME',requestId:value.record.requestId,createdAt:value.record.createdAt,author:experimentAuthorReference(value.record.author),strategy:{id:parent.row.strategy_id,digest:parent.row.strategy_digest},manifest:{id:plan.id,digest:parent.row.digest},state,reason:own.reason,suppression,reporting:'AUTHOR_REPORTED',outcomeCount:0,record:state==='VISIBLE'?value.record:null,moderation:own.events});});
  await this.assertCommitmentContextFence({closure,publications:[...retained.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:eventRows});return experimentOutcomesSchema.parse({version:1,items,nextCursor:rows.length>experimentLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 /** The complete link page shares one source closure and batches linked records.
  * It returns metadata only; a separate exact read is needed for authored bodies. */
 private async commitmentOutcomePage(parent:Checked,cursor:string|null){
  if(parent.record.version!==5||parent.record.type!=='MANIFEST')throw inconsistent();const plan=parent.record,cache=new Map<string,Checked>([[plan.id,parent]]);
  const anchor=cursor?await this.publication(cursor):null;if(anchor&&(anchor.record.type!=='OUTCOME'||anchor.record.version!==5||anchor.row.manifest_id!==plan.id))throw new ExperimentError('Outcome cursor not found.',404);if(anchor)cache.set(anchor.record.id,anchor);
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE type='OUTCOME' AND manifest_id=? ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT 21`).bind(plan.id,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results,checked=await Promise.all(rows.map(row=>this.checkPublication(row))),page=checked.slice(0,experimentLimits.page);
  for(const value of checked){if(value.record.version!==5||value.record.type!=='OUTCOME'||value.row.manifest_digest!==parent.row.digest||value.row.strategy_id!==parent.row.strategy_id||value.row.strategy_digest!==parent.row.strategy_digest||value.record.createdAt<plan.createdAt||JSON.stringify(value.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(value.record.author),experimentAuthorReference(plan.author),value.record.content.claim)))throw inconsistent();cache.set(value.record.id,value);}
  const loadMany=async(rawIds:string[])=>{const ids=[...new Set(rawIds)].filter(value=>!cache.has(value));if(cache.size+ids.length>experimentCommitmentStoreLimits.fenceRecords)throw inconsistent();for(let index=0;index<ids.length;index+=experimentCommitmentStoreLimits.recordReadChunk){const chunk=ids.slice(index,index+experimentCommitmentStoreLimits.recordReadChunk),found=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE id IN (${chunk.map(()=>'?').join(',')}) LIMIT 5`).bind(...chunk).all<PublicationRow>()).results;if(found.length!==chunk.length||new Set(found.map(value=>value.id)).size!==found.length||found.some(value=>!chunk.includes(value.id)))throw inconsistent();for(const value of await Promise.all(found.map(value=>this.checkPublication(value))))cache.set(value.record.id,value);}};
  await loadMany(page.flatMap(value=>value.record.version===5&&value.record.type==='OUTCOME'?[value.record.content.result.manifest.id,value.record.content.result.outcome.id,...value.record.content.claim.relation?[value.record.content.claim.relation.id]:[]]:[]));
  await loadMany(page.flatMap(value=>{if(value.record.version!==5||value.record.type!=='OUTCOME')throw inconsistent();const outcome=cache.get(value.record.content.result.outcome.id);if(!outcome||outcome.record.version!==4||outcome.record.type!=='OUTCOME')throw inconsistent();return outcome.record.content.claim.relation?[outcome.record.content.claim.relation.id]:[];}));
  const load=async(value:string)=>{const record=cache.get(value);if(!record)throw inconsistent();return record;},links=await Promise.all(page.map(value=>{if(value.record.version!==5||value.record.type!=='OUTCOME')throw inconsistent();return this.commitmentLink(plan,value.record,load);})),closure=await readCommitmentSourceClosure(this.db,plan.content.input),sourceVisible=await confirmCommitmentSourceClosure(this.db,closure),retained=new Map<string,Checked>([[parent.record.id,parent],...page.map(value=>[value.record.id,value] as [string,Checked]),...links.flatMap(values=>values.map(value=>[value.record.id,value] as [string,Checked]))]);
  const ids=[...retained.keys()],eventRows=(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${ids.length*17+1}`).bind(...ids).all<EventRow>()).results;if(eventRows.length>ids.length*experimentLimits.eventsPerRecord||eventRows.some(row=>!retained.has(row.record_id)))throw inconsistent();const histories=new Map(await Promise.all([...retained.values()].map(async value=>[value.record.id,await this.events(value,eventRows.filter(row=>row.record_id===value.record.id))] as const))),parentHistory=histories.get(plan.id)!;
  const items=page.map((value,index)=>{const own=histories.get(value.record.id)!,suppression=!sourceVisible?'SOURCE_UNAVAILABLE':parentHistory.state!=='VISIBLE'||links[index].some(link=>histories.get(link.record.id)!.state!=='VISIBLE')?'PARENT_UNAVAILABLE':null,state=own.state==='WITHDRAWN'?'WITHDRAWN':own.state==='HIDDEN'||suppression?'HIDDEN':'VISIBLE';return this.summary({id:value.record.id,digest:value.row.digest,type:'OUTCOME',requestId:value.record.requestId,createdAt:value.record.createdAt,author:experimentAuthorReference(value.record.author),strategy:{id:parent.row.strategy_id,digest:parent.row.strategy_digest},manifest:{id:plan.id,digest:parent.row.digest},state,reason:own.reason,suppression,reporting:'AUTHOR_REPORTED',outcomeCount:0,record:state==='VISIBLE'?value.record:null,moderation:own.events});});
  await this.assertCommitmentContextFence({closure,publications:[...retained.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:eventRows});return experimentOutcomesSchema.parse({version:1,items,nextCursor:rows.length>experimentLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 /** Batch V5 entries within the existing exact-strategy evidence page. Loaded
  * canonical parents are reused; no local cache survives this request. */
 private async commitmentEvidenceEntries(records:Checked[],known:Map<string,Checked>,counts:Map<string,number>,fences:CommitmentFence[]){
  if(records.length>strategyEvidenceLimits.preferredPage)throw inconsistent();if(!records.length)return new Map<string,ReturnType<typeof strategyEvidenceEntryForItem>>();const cache=new Map(known),loadMany=async(rawIds:string[])=>{const ids=[...new Set(rawIds)].filter(value=>!cache.has(value));if(cache.size+ids.length>experimentCommitmentStoreLimits.fenceRecords)throw inconsistent();for(let index=0;index<ids.length;index+=4){const chunk=ids.slice(index,index+4),rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE id IN (${chunk.map(()=>'?').join(',')}) LIMIT 5`).bind(...chunk).all<PublicationRow>()).results;if(rows.length!==chunk.length||new Set(rows.map(value=>value.id)).size!==rows.length||rows.some(value=>!chunk.includes(value.id)))throw inconsistent();for(const value of await Promise.all(rows.map(row=>this.checkPublication(row))))cache.set(value.record.id,value);}};
  await loadMany(records.flatMap(value=>value.record.type==='OUTCOME'?[value.record.content.manifest.id]:[]));
  const plans=new Map<string,Checked>();for(const value of records){if(value.record.version!==5)throw inconsistent();const parent=value.record.type==='MANIFEST'?value:cache.get(value.record.content.manifest.id);if(!parent||parent.record.version!==5||parent.record.type!=='MANIFEST'||value.record.type==='OUTCOME'&&(parent.row.digest!==value.record.content.manifest.digest||parent.row.strategy_id!==value.row.strategy_id||parent.row.strategy_digest!==value.row.strategy_digest||parent.record.createdAt>value.record.createdAt||JSON.stringify(value.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(value.record.author),experimentAuthorReference(parent.record.author),value.record.content.claim))))throw inconsistent();plans.set(parent.record.id,parent);}
  await loadMany(records.flatMap(value=>value.record.version===5&&value.record.type==='OUTCOME'?[value.record.content.result.manifest.id,value.record.content.result.outcome.id,...value.record.content.claim.relation?[value.record.content.claim.relation.id]:[]]:[]));
  await loadMany(records.flatMap(value=>{if(value.record.version!==5||value.record.type!=='OUTCOME')return [];const outcome=cache.get(value.record.content.result.outcome.id);if(!outcome||outcome.record.version!==4||outcome.record.type!=='OUTCOME')throw inconsistent();return outcome.record.content.claim.relation?[outcome.record.content.claim.relation.id]:[];}));
  const load=async(id:string)=>{const value=cache.get(id);if(!value)throw inconsistent();return value;},links=new Map<string,Checked[]>();
  for(const value of records)if(value.record.version===5&&value.record.type==='OUTCOME'){const parent=plans.get(value.record.content.manifest.id)!;if(parent.record.version!==5||parent.record.type!=='MANIFEST')throw inconsistent();links.set(value.record.id,await this.commitmentLink(parent.record,value.record,load));}
  const closures=new Map(await Promise.all([...plans.values()].map(async value=>{if(value.record.version!==5||value.record.type!=='MANIFEST')throw inconsistent();return [value.record.id,await readCommitmentSourceClosure(this.db,value.record.content.input)] as const;}))),retained=new Map<string,Checked>([...plans.values(),...records,...[...links.values()].flat()].map(value=>[value.record.id,value]));
  if(retained.size>experimentCommitmentStoreLimits.fenceRecords)throw inconsistent();const ids=[...retained.keys()],eventRows=(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${ids.length*17+1}`).bind(...ids).all<EventRow>()).results;if(eventRows.length>ids.length*experimentLimits.eventsPerRecord||eventRows.some(row=>!retained.has(row.record_id)))throw inconsistent();
  const histories=new Map(await Promise.all([...retained.values()].map(async value=>[value.record.id,await this.events(value,eventRows.filter(row=>row.record_id===value.record.id))] as const))),items=new Map<string,ReturnType<typeof strategyEvidenceEntryForItem>>();
  for(const value of records){const record=value.record;if(record.version!==5)throw inconsistent();const parent=record.type==='MANIFEST'?value:plans.get(record.content.manifest.id)!,closure=closures.get(parent.record.id)!,linked=links.get(record.id)??[],own=histories.get(record.id)!,suppression=closure.some(source=>!source.visible)?'SOURCE_UNAVAILABLE':histories.get(parent.record.id)!.state!=='VISIBLE'||linked.some(dependency=>histories.get(dependency.record.id)!.state!=='VISIBLE')?'PARENT_UNAVAILABLE':null,state=own.state==='WITHDRAWN'?'WITHDRAWN':own.state==='HIDDEN'||suppression?'HIDDEN':'VISIBLE',outcomeCount=record.type==='MANIFEST'?counts.get(record.id)??0:0;
   const item:ExperimentPublicItem={id:record.id,digest:value.row.digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:experimentAuthorReference(record.author),strategy:{id:value.row.strategy_id,digest:value.row.strategy_digest},manifest:record.type==='OUTCOME'?record.content.manifest:null,state,reason:own.reason,suppression,reporting:record.type==='OUTCOME'||outcomeCount?'AUTHOR_REPORTED':'UNREPORTED',outcomeCount,record:state==='VISIBLE'?record:null,moderation:own.events};items.set(record.id,strategyEvidenceEntryForItem(item));
  }
  // Each plan's dependency set is retained separately; all fences finish together
  // after compact page validation, then again at the actual HTTP boundary.
  for(const closure of closures.values())fences.push({closure,publications:[...retained.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:eventRows});return items;
 }
 private async windowEvidenceEntries(records:Checked[],known:Map<string,Checked>,counts:Map<string,number>,fences:CommitmentFence[]){
  if(records.length>strategyEvidenceLimits.preferredPage)throw inconsistent();if(!records.length)return new Map<string,ReturnType<typeof strategyEvidenceEntryForItem>>();const verificationScope=new ProgramWindowEvidenceVerificationScope(),cache=new Map(known),loadMany=async(rawIds:string[])=>{const ids=[...new Set(rawIds)].filter(value=>!cache.has(value));if(cache.size+ids.length>experimentCommitmentStoreLimits.fenceRecords)throw inconsistent();for(let index=0;index<ids.length;index+=4){const chunk=ids.slice(index,index+4),rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE id IN (${chunk.map(()=>'?').join(',')}) LIMIT 5`).bind(...chunk).all<PublicationRow>()).results;if(rows.length!==chunk.length||new Set(rows.map(value=>value.id)).size!==rows.length||rows.some(value=>!chunk.includes(value.id)))throw inconsistent();for(const value of await Promise.all(rows.map(row=>this.checkPublication(row))))cache.set(value.record.id,value);}};
  await loadMany(records.flatMap(value=>value.record.type==='OUTCOME'?[value.record.content.manifest.id]:[]));
  const plans=new Map<string,Checked>();for(const value of records){if(value.record.version!==6)throw inconsistent();const parent=value.record.type==='MANIFEST'?value:cache.get(value.record.content.manifest.id);if(!parent||parent.record.version!==6||parent.record.type!=='MANIFEST'||value.record.type==='OUTCOME'&&(parent.row.digest!==value.record.content.manifest.digest||parent.row.strategy_id!==value.row.strategy_id||parent.row.strategy_digest!==value.row.strategy_digest||parent.record.createdAt>value.record.createdAt||JSON.stringify(value.record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(value.record.author),experimentAuthorReference(parent.record.author),value.record.content.claim))))throw inconsistent();plans.set(parent.record.id,parent);}
  await loadMany(records.flatMap(value=>value.record.version===6&&value.record.type==='OUTCOME'?[value.record.content.result.manifest.id,value.record.content.result.outcome.id,...value.record.content.claim.relation?[value.record.content.claim.relation.id]:[]]:[]));
  await loadMany(records.flatMap(value=>{if(value.record.version!==6||value.record.type!=='OUTCOME')return [];const outcome=cache.get(value.record.content.result.outcome.id);if(!outcome||outcome.record.version!==4||outcome.record.type!=='OUTCOME')throw inconsistent();return outcome.record.content.claim.relation?[outcome.record.content.claim.relation.id]:[];}));
  await loadMany([...plans.values()].flatMap(value=>value.record.version===6&&value.record.type==='MANIFEST'&&value.record.content.input.declaration?[value.record.content.input.declaration.id]:[]));
  const declarations=new Map<string,Checked[]>();
  for(const value of plans.values()){if(value.record.version!==6||value.record.type!=='MANIFEST')throw inconsistent();const input=value.record.content.input;if(input.declaration){const declaration=cache.get(input.declaration.id);if(!declaration||declaration.record.version!==5||declaration.record.type!=='MANIFEST'||declaration.row.digest!==input.declaration.digest)throw inconsistent();try{await verifyProgramWindowDeclarationBinding(input,input.declaration,declaration.record.content.input,declaration.record.createdAt);}catch{throw inconsistent();}declarations.set(value.record.id,[declaration]);}else declarations.set(value.record.id,[]);}
  const load=async(id:string)=>{const value=cache.get(id);if(!value)throw inconsistent();return value;},links=new Map<string,Checked[]>();
  for(const value of records)if(value.record.version===6&&value.record.type==='OUTCOME'){const parent=plans.get(value.record.content.manifest.id)!;if(parent.record.version!==6||parent.record.type!=='MANIFEST')throw inconsistent();links.set(value.record.id,await this.windowLink(parent.record,value.record,load,verificationScope));}
  const closures=new Map(await Promise.all([...plans.values()].map(async value=>{if(value.record.version!==6||value.record.type!=='MANIFEST')throw inconsistent();return [value.record.id,await readCommitmentSourceClosure(this.db,value.record.content.input.plan)] as const;}))),retained=new Map<string,Checked>([...plans.values(),...records,...[...links.values()].flat(),...[...declarations.values()].flat()].map(value=>[value.record.id,value]));
  if(retained.size>experimentCommitmentStoreLimits.fenceRecords)throw inconsistent();const ids=[...retained.keys()],eventRows=(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${ids.length*17+1}`).bind(...ids).all<EventRow>()).results;if(eventRows.length>ids.length*experimentLimits.eventsPerRecord||eventRows.some(row=>!retained.has(row.record_id)))throw inconsistent();
  const histories=new Map(await Promise.all([...retained.values()].map(async value=>[value.record.id,await this.events(value,eventRows.filter(row=>row.record_id===value.record.id))] as const))),items=new Map<string,ReturnType<typeof strategyEvidenceEntryForItem>>();
  for(const value of records){const record=value.record;if(record.version!==6)throw inconsistent();const parent=record.type==='MANIFEST'?value:plans.get(record.content.manifest.id)!,closure=closures.get(parent.record.id)!,linked=[...links.get(record.id)??[],...declarations.get(parent.record.id)??[]],own=histories.get(record.id)!,suppression=closure.some(source=>!source.visible)?'SOURCE_UNAVAILABLE':histories.get(parent.record.id)!.state!=='VISIBLE'||linked.some(dependency=>histories.get(dependency.record.id)!.state!=='VISIBLE')?'PARENT_UNAVAILABLE':null,state=own.state==='WITHDRAWN'?'WITHDRAWN':own.state==='HIDDEN'||suppression?'HIDDEN':'VISIBLE',outcomeCount=record.type==='MANIFEST'?counts.get(record.id)??0:0;
   const item:ExperimentPublicItem={id:record.id,digest:value.row.digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:experimentAuthorReference(record.author),strategy:{id:value.row.strategy_id,digest:value.row.strategy_digest},manifest:record.type==='OUTCOME'?record.content.manifest:null,state,reason:own.reason,suppression,reporting:record.type==='OUTCOME'||outcomeCount?'AUTHOR_REPORTED':'UNREPORTED',outcomeCount,record:state==='VISIBLE'?record:null,moderation:own.events};items.set(record.id,strategyEvidenceEntryForItem(item));
  }
  // Each plan's dependency set is retained separately; all fences finish together
  // after compact page validation, then again at the actual HTTP boundary.
  for(const closure of closures.values())fences.push({closure,publications:[...retained.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:eventRows});return items;
 }
 /** One-use same-instance completion after the HTTP schema/hash awaits. */
 async confirmCommitmentEvidencePage(page:Awaited<ReturnType<ExperimentRepository['forStrategy']>>){const snapshot=this.commitmentEvidenceConfirmations.get(page);this.commitmentEvidenceConfirmations.delete(page);if(!snapshot||JSON.stringify(page)!==snapshot.payload)throw inconsistent();if(snapshot.fences.length)await this.assertCommitmentContextFences(snapshot.fences);}
 /** Two bounded batched observations cover the extra V4 source closure without
  * multiplying per-record discovery reads or exposing nested source payloads. */
 private async observeForwardDependencies(dependencies:ReturnType<typeof experimentInputDependencies>){
  if(dependencies.length>48||new Set(dependencies.map(value=>value.id)).size!==dependencies.length)throw inconsistent();
  if(!dependencies.length)return new Map<string,{payload:string;digest:string;state:string;events:ExperimentPublicEvent[]}>();
  const columns=['id','digest','root_id','revision','request_id','command_digest','created_at','author_key','sponsor_key'].map(name=>'p.'+name).join(',');
  const rows=(await this.db.prepare(`SELECT ${columns},CASE WHEN length(CAST(p.payload AS BLOB))<=28672 THEN p.payload ELSE NULL END AS payload,(SELECT json_group_array(json_object('record_id',record_id,'sequence',sequence,'author_key',author_key,'sponsor_key',sponsor_key,'request_id',request_id,'command_digest',command_digest,'payload',payload,'digest',digest,'state',state,'reason',reason,'created_at',created_at)) FROM (SELECT ${eventColumns} FROM strategy_moderation WHERE record_id=p.id ORDER BY sequence LIMIT 17)) AS events FROM strategy_publications p WHERE p.id IN (${dependencies.map(()=>'?').join(',')}) LIMIT 49`).bind(...dependencies.map(value=>value.id)).all<{id:string;digest:string;root_id:string;revision:number;request_id:string;command_digest:string;created_at:string;author_key:string;sponsor_key:string;payload:string|null;events:string}>()).results;
  if(rows.length!==dependencies.length||new Set(rows.map(row=>row.id)).size!==rows.length)throw inconsistent();
  const observed=new Map<string,{payload:string;digest:string;state:string;events:ExperimentPublicEvent[]}>();
  for(const row of rows){try{
   const dependency=dependencies.find(value=>value.id===row.id);if(!dependency||!row.payload||row.payload!==JSON.stringify(dependency.record)||row.digest!==dependency.digest)throw Error();
   const record=boundedStrategyRecord(JSON.parse(row.payload)).record;if(await experimentDigest(row.payload)!==row.digest||record.id!==row.id||record.rootId!==row.root_id||record.revision!==row.revision||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(strategyAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key||await experimentDigest(boundedStrategyCommand(strategyPublishCommandForRecord(record)).payload)!==row.command_digest)throw Error();
   const history:EventRow[]=JSON.parse(row.events);if(!Array.isArray(history)||history.length>16)throw Error();let state='VISIBLE',time=record.createdAt;const events:ExperimentPublicEvent[]=[];
   for(const eventRow of history){if(!eventRow.payload||!hash.test(eventRow.digest)||!hash.test(eventRow.command_digest))throw Error();const event=experimentPublicEventSchema.parse(JSON.parse(eventRow.payload));if(JSON.stringify(event)!==eventRow.payload||await experimentDigest(eventRow.payload)!==eventRow.digest||eventRow.record_id!==record.id||event.sequence!==events.length+1||eventRow.sequence!==event.sequence||eventRow.author_key!==authorKey(event.actor)||eventRow.sponsor_key!==event.actor.sponsorId||event.requestId!==eventRow.request_id||event.createdAt!==eventRow.created_at||event.state!==eventRow.state||event.reason!==eventRow.reason||state==='WITHDRAWN'||event.createdAt<time||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=16))throw Error();const command={action:event.state==='WITHDRAWN'?'withdraw':'moderate',requestId:event.requestId,id:record.id,digest:row.digest,...event.state==='WITHDRAWN'?{}:{state:event.state},reason:event.reason,policyAccepted:'public-strategy-v1'};if(await experimentDigest(boundedStrategyCommand(command).payload)!==eventRow.command_digest)throw Error();events.push(event);state=event.state;time=event.createdAt;}
   observed.set(row.id,{payload:row.payload,digest:row.digest,state,events});
  }catch{throw inconsistent();}}
  return observed;
 }
 /** Exact-version discovery only. Canonical closure and current lifecycle are
  * bounded independently from the small public projection; no evaluator runs. */
 async forStrategy(strategyId:string,digest:string,cursor?:string|null){
  id(strategyId);if(strategyId.length!==36||typeof digest!=='string'||digest.length!==64||!hash.test(digest))throw new ExperimentError('Invalid exact strategy reference.',400);if(cursor!==undefined&&cursor!==null){id(cursor);if(cursor.length!==36)throw new ExperimentError('Invalid evidence cursor.',400);}
  const retainedPage=strategyEvidenceLimits.preferredPage;
  const sourceRepository=new StrategyRepository(this.db),firstSource=(await sourceRepository.get(strategyId)).item;
  if(firstSource.digest!==digest)throw new ExperimentError('Exact strategy version not found.',404);
  const anchor=cursor?await this.publication(cursor):null;
  if(anchor&&(anchor.row.strategy_id!==strategyId||anchor.row.strategy_digest!==digest))throw new ExperimentError('Cursor does not belong to this exact strategy version.',404);
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE strategy_id=? AND strategy_digest=? ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${retainedPage+1}`).bind(strategyId,digest,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  if(rows.length>retainedPage+1||new Set(rows.map(row=>row.id)).size!==rows.length)throw inconsistent();
  const selected=await Promise.all(rows.map(row=>this.checkPublication(row))),seeds=[...selected,...anchor&&!selected.some(item=>item.record.id===anchor.record.id)?[anchor]:[]],closure=new Map(seeds.map(item=>[item.record.id,item]));
  for(let n=0;n<selected.length;n++){const item=selected[n],prior=selected[n-1];if(item.row.strategy_id!==strategyId||item.row.strategy_digest!==digest||prior&&(item.record.createdAt>prior.record.createdAt||item.record.createdAt===prior.record.createdAt&&item.record.id>=prior.record.id)||anchor&&(item.record.createdAt>anchor.record.createdAt||item.record.createdAt===anchor.record.createdAt&&item.record.id>=anchor.record.id))throw inconsistent();}
  const references=[...new Set(seeds.flatMap(item=>item.record.type==='OUTCOME'?[item.record.content.manifest.id,...item.record.content.claim.relation?[item.record.content.claim.relation.id]:[]]:[]))].filter(value=>!closure.has(value));
  if(seeds.length>12||references.length>24)throw inconsistent();
  if(references.length){
   const related=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE id IN (${references.map(()=>'?').join(',')}) LIMIT 25`).bind(...references).all<PublicationRow>()).results;
   if(related.length!==references.length||new Set(related.map(row=>row.id)).size!==related.length||related.some(row=>!references.includes(row.id)))throw inconsistent();
   for(const item of await Promise.all(related.map(row=>this.checkPublication(row))))closure.set(item.record.id,item);
  }
  if(closure.size>strategyEvidenceLimits.canonicalRows)throw inconsistent();
  // Source canonical bytes are fetched even when the public projection is a
  // tombstone; they validate retained bindings but never enter the response.
  const sourceRow=await this.db.prepare('SELECT id,digest,CASE WHEN length(CAST(payload AS BLOB))<=28672 THEN payload ELSE NULL END AS payload FROM strategy_publications WHERE id=?').bind(strategyId).first<{id:string;digest:string;payload:string|null}>();
  if(!sourceRow||!sourceRow.payload||sourceRow.id!==strategyId||sourceRow.digest!==digest)throw inconsistent();
  let sourcePayload:string;try{sourcePayload=boundedStrategyRecord(JSON.parse(sourceRow.payload)).payload;if(sourcePayload!==sourceRow.payload||await experimentDigest(sourcePayload)!==digest||firstSource.record&&JSON.stringify(firstSource.record)!==sourcePayload)throw Error();}catch{throw inconsistent();}
  const bindings=async(publication:Checked,verifyRelation:boolean)=>{
   const record=publication.record,row=publication.row;
   if(row.strategy_id!==strategyId||row.strategy_digest!==digest||record.createdAt<firstSource.createdAt)throw inconsistent();
   if(record.type==='MANIFEST'){if(JSON.stringify(experimentInputStrategy(record.content.input).record)!==sourcePayload)throw inconsistent();return;}
   const parent=closure.get(record.content.manifest.id);
   if(!parent||parent.record.type!=='MANIFEST'||parent.record.version!==record.version||parent.row.digest!==record.content.manifest.digest||parent.row.strategy_id!==strategyId||parent.row.strategy_digest!==digest||parent.record.createdAt>record.createdAt)throw inconsistent();
   if(record.content.result.kind==='ARTIFACT'){try{await verifyExperimentArtifact(record.content.result.artifact,parent.record.content.input);}catch{throw inconsistent();}}
   if(JSON.stringify(record.flags)!==JSON.stringify(experimentOutcomeFlags(experimentAuthorReference(record.author),experimentAuthorReference(parent.record.author),record.content.claim)))throw inconsistent();
   const relation=record.content.claim.relation;
   if(relation&&verifyRelation){const related=closure.get(relation.id);if(!related||related.record.type!=='OUTCOME'||related.record.version!==parent.record.version||related.row.digest!==relation.digest||related.row.manifest_id!==parent.record.id||related.row.manifest_digest!==parent.row.digest||related.row.strategy_id!==strategyId||related.row.strategy_digest!==digest||related.record.createdAt>record.createdAt)throw inconsistent();}
  };
  await Promise.all([...closure.values()].map(item=>bindings(item,seeds.some(seed=>seed.record.id===item.record.id))));
  const identities=[...closure.keys()];
  const readEvents=async()=>{
   const retained=identities.length?(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id IN (${identities.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${identities.length*(experimentLimits.eventsPerRecord+1)+1}`).bind(...identities).all<EventRow>()).results:[];
   const grouped=new Map<string,EventRow[]>();for(const row of retained){if(!closure.has(row.record_id))throw inconsistent();const own=grouped.get(row.record_id)??[];own.push(row);if(own.length>experimentLimits.eventsPerRecord)throw inconsistent();grouped.set(row.record_id,own);}
   const result=new Map<string,{events:ExperimentPublicEvent[];rows:EventRow[];state:ExperimentPublicItem['state'];reason:ExperimentPublicItem['reason']}>();
   for(const [recordId,publication]of closure){const events:ExperimentPublicEvent[]=[];let state:ExperimentPublicItem['state']='VISIBLE',time=publication.record.createdAt;
    for(const row of grouped.get(recordId)??[]){try{
     if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const event=experimentPublicEventSchema.parse(JSON.parse(row.payload));
     if(JSON.stringify(event)!==row.payload||await experimentDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==recordId||row.sequence!==event.sequence||row.request_id!==event.requestId||row.created_at!==event.createdAt||row.state!==event.state||row.reason!==event.reason||row.author_key!==authorKey(event.actor)||row.sponsor_key!==event.actor.sponsorId||state==='WITHDRAWN'||event.createdAt<time)throw Error();
     if(event.state==='WITHDRAWN'){const author=experimentAuthorReference(publication.record.author),own=JSON.stringify(event.actor)===JSON.stringify(author),sponsor=event.actor.kind==='HUMAN'&&event.actor.id===author.sponsorId&&event.actor.sponsorId===author.sponsorId;if(!own&&!sponsor)throw Error();}
     const command=boundedExperimentCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:recordId,digest:publication.row.digest,reason:event.reason,policyAccepted:'public-experiment-v1'}:{action:'moderate',requestId:event.requestId,id:recordId,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:'public-experiment-v1'});
     if(await experimentDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=experimentLimits.eventsPerRecord))throw Error();events.push(event);state=event.state;time=event.createdAt;
    }catch{throw inconsistent();}}
    result.set(recordId,{events,rows:grouped.get(recordId)??[],state,reason:events.at(-1)?.reason??null});
   }return result;
  };
  const forwardManifestDependencies=new Map<string,ReturnType<typeof experimentInputDependencies>>(),forwardDependencies=new Map<string,ReturnType<typeof experimentInputDependencies>[number]>();
  for(const publication of closure.values())if(publication.record.version===4&&publication.record.type==='MANIFEST'){const dependencies=experimentInputDependencies(publication.record.content.input);forwardManifestDependencies.set(publication.record.id,dependencies);for(const dependency of dependencies){if(dependency.id===strategyId)continue;const previous=forwardDependencies.get(dependency.id);if(previous&&(previous.digest!==dependency.digest||JSON.stringify(previous.record)!==JSON.stringify(dependency.record)))throw inconsistent();forwardDependencies.set(dependency.id,dependency);}}
  const firstDependencies=await this.observeForwardDependencies([...forwardDependencies.values()]);
  const firstEvents=await readEvents(),manifestIds=[...closure.values()].filter(item=>item.record.type==='MANIFEST').map(item=>item.record.id),counts=new Map<string,number>();
  if(manifestIds.length){const found=(await this.db.prepare(`SELECT manifest_id,COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id IN (${manifestIds.map(()=>'?').join(',')}) GROUP BY manifest_id LIMIT 37`).bind(...manifestIds).all<{manifest_id:string;n:number}>()).results;for(const row of found){if(!manifestIds.includes(row.manifest_id)||counts.has(row.manifest_id)||!Number.isInteger(row.n)||row.n<1||row.n>experimentLimits.outcomesPerManifest)throw inconsistent();counts.set(row.manifest_id,row.n);}}
  const secondEvents=await readEvents();
  // Publications are immutable. Recheck every selected, cursor, lookahead and
  // dependency row as exact bytes without returning a second artifact copy.
  // Two binds per bounded row keep this one batched fence below 96 parameters.
  if(closure.size){
   const expected=[...closure.values()],parameters=expected.flatMap(item=>[item.record.id,item.row.payload!]);
   if(parameters.length>strategyEvidenceLimits.bindParameters)throw inconsistent();
   const metadata=['id','type','manifest_id','manifest_digest','strategy_id','strategy_digest','author_key','sponsor_key','request_id','command_digest','digest','created_at'] as const;
   const fresh=(await this.db.prepare(`WITH expected(id,expected_payload) AS (VALUES ${expected.map(()=>'(?,?)').join(',')}) SELECT ${metadata.map(name=>'p.'+name).join(',')},CASE WHEN p.payload=e.expected_payload THEN 1 ELSE 0 END AS payload_matches FROM expected e JOIN experiment_records p ON p.id=e.id LIMIT ${strategyEvidenceLimits.canonicalRows+1}`).bind(...parameters).all<Omit<PublicationRow,'payload'>&{payload_matches:number}>()).results;
   if(fresh.length!==expected.length||new Set(fresh.map(row=>row.id)).size!==fresh.length)throw inconsistent();
   for(const row of fresh){const original=closure.get(row.id);if(!original||row.payload_matches!==1||metadata.some(name=>row[name]!==original.row[name]))throw inconsistent();}
  }
  const lastSource=(await sourceRepository.get(strategyId)).item;
  const sourceIdentity=(item:StrategyPublicItem)=>({id:item.id,digest:item.digest,rootId:item.rootId,revision:item.revision,requestId:item.requestId,createdAt:item.createdAt,author:item.author});
  if(JSON.stringify(sourceIdentity(firstSource))!==JSON.stringify(sourceIdentity(lastSource))||lastSource.moderation.length<firstSource.moderation.length||JSON.stringify(lastSource.moderation.slice(0,firstSource.moderation.length))!==JSON.stringify(firstSource.moderation)||lastSource.record&&JSON.stringify(lastSource.record)!==sourcePayload)throw inconsistent();
  const source=firstSource.state!=='VISIBLE'&&lastSource.state==='VISIBLE'?firstSource:lastSource;
  const lastDependencies=await this.observeForwardDependencies([...forwardDependencies.values()]);
  for(const [dependencyId,first]of firstDependencies){const last=lastDependencies.get(dependencyId);if(!last||last.payload!==first.payload||last.digest!==first.digest||last.events.length<first.events.length||JSON.stringify(last.events.slice(0,first.events.length))!==JSON.stringify(first.events))throw inconsistent();if(first.state!=='VISIBLE'&&last.state==='VISIBLE')lastDependencies.set(dependencyId,first);}
  for(const [recordId,first]of firstEvents){const second=secondEvents.get(recordId);if(!second||second.events.length<first.events.length||JSON.stringify(second.events.slice(0,first.events.length))!==JSON.stringify(first.events))throw inconsistent();if(first.state!=='VISIBLE'&&second.state==='VISIBLE')secondEvents.set(recordId,first);}
  const fences:CommitmentFence[]=[],commitmentItems=await this.commitmentEvidenceEntries(selected.slice(0,retainedPage).filter(value=>value.record.version===5),closure,counts,fences);
  const windowItems=await this.windowEvidenceEntries(selected.slice(0,retainedPage).filter(value=>value.record.version===6),closure,counts,fences);
  const items=await Promise.all(selected.slice(0,retainedPage).map(async publication=>{
   if(publication.record.version===5){const item=commitmentItems.get(publication.record.id);if(!item)throw inconsistent();return item;}
   if(publication.record.version===6){const item=windowItems.get(publication.record.id);if(!item)throw inconsistent();return item;}
   const record=publication.record,own=secondEvents.get(record.id)!;
   const dependencies=forwardManifestDependencies.get(record.type==='MANIFEST'?record.id:record.content.manifest.id)??[],dependencyHidden=dependencies.some(value=>value.id!==strategyId&&lastDependencies.get(value.id)?.state!=='VISIBLE');
   const parentState=record.type==='OUTCOME'?secondEvents.get(record.content.manifest.id)!.state:'VISIBLE',suppression=source.state!=='VISIBLE'||dependencyHidden?'SOURCE_UNAVAILABLE' as const:parentState!=='VISIBLE'?'PARENT_UNAVAILABLE' as const:null,state=own.state==='WITHDRAWN'?'WITHDRAWN' as const:own.state==='HIDDEN'||suppression?'HIDDEN' as const:'VISIBLE' as const,outcomeCount=record.type==='MANIFEST'?counts.get(record.id)??0:0;
   const item:ExperimentPublicItem={id:record.id,digest:publication.row.digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:experimentAuthorReference(record.author),strategy:{id:strategyId,digest},manifest:record.type==='OUTCOME'?record.content.manifest:null,state,reason:own.reason,suppression,reporting:record.type==='OUTCOME'||outcomeCount>0?'AUTHOR_REPORTED':'UNREPORTED',outcomeCount,record:state==='VISIBLE'?record:null,moderation:own.events};
   return strategyEvidenceEntryForItem(item);
  }));
  if(fences.length){for(const fence of fences){const retainedSource=fence.closure.find(value=>value.id===strategyId);if(!retainedSource||retainedSource.digest!==source.digest||source.record&&retainedSource.payload!==JSON.stringify(source.record)||JSON.stringify(retainedSource.events.map(row=>JSON.parse(row.payload)))!==JSON.stringify(source.moderation))throw inconsistent();for(const publication of fence.publications){const earlier=secondEvents.get(publication.id);if(earlier&&JSON.stringify(earlier.rows)!==JSON.stringify(fence.events.filter(row=>row.record_id===publication.id)))throw inconsistent();}const combined=new Map([...fence.publications.map(row=>[row.id,row] as const),...[...closure.values()].map(value=>[value.record.id,value.row] as const)]);fence.publications=[...combined.values()].sort((a,b)=>a.id.localeCompare(b.id));const eventMap=new Map([...fence.events,...[...secondEvents.values()].flatMap(value=>value.rows)].map(row=>[row.record_id+':'+row.sequence,row]));fence.events=[...eventMap.values()].sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.sequence-b.sequence);}}
  const page=await validateStrategyEvidencePage({version:1,strategy:source,items,nextCursor:selected.length>retainedPage?selected[retainedPage-1].record.id:null,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false});if(fences.length)await this.assertCommitmentContextFences(fences);this.commitmentEvidenceConfirmations.set(page,{payload:JSON.stringify(page),fences});return page;
 }
 async reports(actor:ExperimentActor,at:string,cursor?:string|null){
  const context=await this.context(actor,at);if(context.actor.kind!=='HUMAN'||!context.actor.moderator)throw new ExperimentError('Explicit moderator authorization is required.',403);
  if(cursor!==undefined&&cursor!==null&&(typeof cursor!=='string'||!hash.test(cursor)))throw new ExperimentError('Invalid private report cursor.',400);
  let anchor:ReportRow|null=null;
  if(cursor){
   const anchors=(await this.db.prepare(`SELECT ${reportColumns} FROM experiment_reports WHERE digest=? LIMIT 2`).bind(cursor).all<ReportRow>()).results;
   if(!anchors.length)throw new ExperimentError('Private report cursor not found.',404);if(anchors.length!==1)throw inconsistent();
   await this.checkReport(anchors[0]);anchor=anchors[0];
  }
  const rows=(await this.db.prepare(`SELECT ${reportColumns} FROM experiment_reports ${anchor?'WHERE created_at<? OR (created_at=? AND author_key<?) OR (created_at=? AND author_key=? AND request_id<?)':''} ORDER BY created_at DESC,author_key DESC,request_id DESC LIMIT ${experimentLimits.page+1}`).bind(...anchor?[anchor.created_at,anchor.created_at,anchor.author_key,anchor.created_at,anchor.author_key,anchor.request_id]:[]).all<ReportRow>()).results;
  if(new Set(rows.map(row=>row.digest)).size!==rows.length)throw inconsistent();
  const checked=await Promise.all(rows.map(row=>this.checkReport(row))),page=checked.slice(0,experimentLimits.page);
  return experimentReportsSchema.parse({version:1,reports:page,nextCursor:rows.length>experimentLimits.page?rows[experimentLimits.page-1].digest:null,executionEnabled:false});
 }

 private targetClause(target:Checked,values:Values){const record=add(values,target.record.id),digest=add(values,target.row.digest),payload=add(values,target.row.payload!);return `EXISTS(SELECT 1 FROM experiment_records WHERE id=${record} AND digest=${digest} AND payload=${payload})`;}
 private visibleClause(recordId:string,values:Values){const record=add(values,recordId);return `COALESCE((SELECT state FROM experiment_moderation WHERE record_id=${record} ORDER BY sequence DESC LIMIT 1),'VISIBLE')='VISIBLE'`;}
 private async quota(context:Context,at:string,type:'MANIFEST'|'OUTCOME'|'REPORT'){
  const table=type==='REPORT'?'experiment_reports':'experiment_records',where=type==='REPORT'?'':`WHERE type='${type}'`,daily=type==='REPORT'?experimentLimits.reportsPerSponsorDay:type==='MANIFEST'?experimentLimits.registerPerSponsorDay:experimentLimits.outcomePerSponsorDay,total=type==='REPORT'?experimentLimits.reportsStored:type==='MANIFEST'?experimentLimits.manifestStored:experimentLimits.outcomeStored;
  const result=await this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN sponsor_key=? AND substr(created_at,1,10)=? THEN 1 ELSE 0 END),0) AS daily FROM ${table} ${where}`).bind(context.sponsor,at.slice(0,10)).first<{total:number;daily:number}>();
  if(!result)throw inconsistent();if(result.total>=total)throw new ExperimentError('Retained beta experiment capacity reached. No automatic reset is promised.',429);
  if(result.daily>=daily)throw new ExperimentError('The sponsor’s shared UTC-day submission limit has been reached.',429,retryAfter(at));
 }
 private quotaClauses(context:Context,at:string,type:'MANIFEST'|'OUTCOME'|'REPORT',values:Values){
  const table=type==='REPORT'?'experiment_reports':'experiment_records',filter=type==='REPORT'?'1=1':`type='${type}'`,daily=type==='REPORT'?experimentLimits.reportsPerSponsorDay:type==='MANIFEST'?experimentLimits.registerPerSponsorDay:experimentLimits.outcomePerSponsorDay,total=type==='REPORT'?experimentLimits.reportsStored:type==='MANIFEST'?experimentLimits.manifestStored:experimentLimits.outcomeStored,sponsor=add(values,context.sponsor),date=add(values,at.slice(0,10));
  return [`(SELECT COUNT(*) FROM ${table} WHERE ${filter})<${total}`,`(SELECT COUNT(*) FROM ${table} WHERE ${filter} AND sponsor_key=${sponsor} AND substr(created_at,1,10)=${date})<${daily}`];
 }
 private sourceClause(source:{id:string;digest:string;payload:string},values:Values){const record=add(values,source.id),digest=add(values,source.digest),payload=add(values,source.payload);return `EXISTS(SELECT 1 FROM strategy_publications WHERE id=${record} AND digest=${digest} AND payload=${payload}) AND COALESCE((SELECT state FROM strategy_moderation WHERE record_id=${record} ORDER BY sequence DESC LIMIT 1),'VISIBLE')='VISIBLE'`;}
 async write(actor:ExperimentActor,raw:unknown,at:string,freshNow=()=>new Date().toISOString()){
  const context=await this.context(actor,at);await this.requireCredential(context,at);
  let parsed:ReturnType<typeof boundedExperimentCommand>;try{parsed=boundedExperimentCommand(raw);}catch(error){if(error instanceof ExperimentError)throw error;throw new ExperimentError('Invalid experiment command.',400);}
  const {command,payload}=parsed;if(command.action==='moderate'&&(context.actor.kind!=='HUMAN'||!context.actor.moderator))throw new ExperimentError('Explicit moderator authorization is required.',403);
  const commandDigest=await experimentDigest(payload),saved=await this.replay(context,command,commandDigest,at);if(saved)return saved;
  let target:Checked|undefined;
  if(command.action==='outcome')target=await this.publication(command.manifest.id);
  if(command.action!=='register'&&command.action!=='outcome')target=await this.publication(command.id);
  if(target){const expected=command.action==='outcome'?command.manifest.digest:command.action==='register'?'':command.digest;if(target.row.digest!==expected)throw new ExperimentError('Exact experiment target not found.',404);if(at<target.record.createdAt)throw new ExperimentError('Submission time precedes its target.');}
  try{if(command.action==='register'||command.action==='outcome')await this.publish(context,command,commandDigest,at,target,freshNow);else if(command.action==='report')await this.report(context,command,commandDigest,at,target!);else await this.moderate(context,command,commandDigest,at,target!);}catch(error){const replay=await this.replay(context,command,commandDigest,at);if(replay)return replay;throw error;}
  const receipt=await this.replay(context,command,commandDigest,at);if(receipt)return receipt;
  await this.requireCredential(context,at);if(command.action==='register'||command.action==='outcome'||command.action==='report')await this.quota(context,at,command.action==='register'?'MANIFEST':command.action==='outcome'?'OUTCOME':'REPORT');
  if(command.action==='outcome'){
   const retained=await this.db.prepare("SELECT COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?").bind(command.manifest.id).first<{n:number}>();
   if(!retained||!Number.isInteger(retained.n)||retained.n<0||retained.n>experimentLimits.outcomesPerManifest)throw inconsistent();
   if(retained.n===experimentLimits.outcomesPerManifest)throw new ExperimentError('This manifest’s retained outcome capacity has been reached.',429);
  }
  throw new ExperimentError('Experiment identity, source, target, moderation state or quota changed. Refresh before retrying; no submission was confirmed.');
 }
 private async publish(context:Context,command:Extract<ExperimentCommand,{action:'register'|'outcome'}>,commandDigest:string,at:string,parent?:Checked,freshNow=()=>new Date().toISOString()){
  if('method'in command&&command.method==='PROGRAM_FORWARD_COMMITMENT')return this.publishCommitment(context,command,commandDigest,parent,freshNow);
  if('method'in command&&command.method==='PROGRAM_FORWARD_WINDOW')return this.publishWindow(context,command,commandDigest,parent,freshNow);
  const type=command.action==='register'?'MANIFEST':'OUTCOME';await this.quota(context,at,type);
  let source,dependencies:Awaited<ReturnType<ExperimentRepository['dependencies']>>,related:Checked|undefined;
  if(command.action==='register'){
   const selected=experimentInputStrategy(command.input);source=await this.source(selected.record.id,true,experimentMethodVersion(command)>=3?2:1);
   if(source.digest!==selected.digest||source.payload!==JSON.stringify(selected.record))throw new ExperimentError('The exact published strategy does not match this input.',400);
   if('method'in command&&command.method==='CONTINUOUS_DEMO'&&command.input.config.origin!=='PUBLIC_STRATEGY')throw new ExperimentError('Continuous public evidence requires an exact published Strategy Hub source.',400);
   await verifyExperimentManifestInput(command.input,command.evaluator);
   dependencies=await this.dependencies(command.input,true,source);
  }else{
   if(!parent||parent.record.type!=='MANIFEST')throw new ExperimentError('Exact manifest not found.',404);
   if(parent.record.version!==experimentMethodVersion(command))throw new ExperimentError('Outcome method must match the exact registered manifest.',400);
   const projected=await this.project(parent);if(projected.state!=='VISIBLE')throw new ExperimentError('The parent manifest is not visible.');const bound=await this.bindings(parent);source=bound.source;dependencies=bound.dependencies;
   if(command.result.kind==='ARTIFACT'){
    await verifyExperimentArtifact(command.result.artifact,parent.record.content.input);
   }
   if(command.claim.relation){related=await this.publication(command.claim.relation.id);if(related.record.type!=='OUTCOME'||related.row.manifest_id!==parent.record.id||related.row.digest!==command.claim.relation.digest)throw new ExperimentError('Exact related outcome not found.',404);if((await this.project(related)).state!=='VISIBLE')throw new ExperimentError('Related outcome is not visible.');if(at<related.record.createdAt)throw new ExperimentError('Outcome time precedes its related report.');}
   const count=await this.db.prepare("SELECT COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?").bind(parent.record.id).first<{n:number}>();if(!count||count.n>=experimentLimits.outcomesPerManifest)throw new ExperimentError('This manifest’s retained outcome capacity has been reached.',429);
  }
  if(dependencies.some(value=>!value.visible))throw new ExperimentError('A retained strategy dependency is not visible.');
  const raw={version:experimentMethodVersion(command),id:command.id,requestId:command.requestId,createdAt:at,author:context.author,type,content:content(command),flags:command.action==='register'?experimentManifestFlags(command.disclosures):experimentOutcomeFlags(context.reference,experimentAuthorReference(parent!.record.author),command.claim),policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false};
  const {record,payload}=boundedExperimentRecord(raw),digest=await experimentDigest(payload),values:Values=[record.id,type,parent?.record.id??'',parent?.row.digest??'',source.id,source.digest,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),...dependencies.map(value=>this.sourceClause(value,values)),...this.quotaClauses(context,at,type,values)];
  if(parent)clauses.push(this.targetClause(parent,values),this.visibleClause(parent.record.id,values),`(SELECT COUNT(*) FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?3)<${experimentLimits.outcomesPerManifest}`);
  if(related)clauses.push(this.targetClause(related,values),this.visibleClause(related.record.id,values));
  await this.db.prepare(`INSERT INTO experiment_records(id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,NULLIF(?3,''),NULLIF(?4,''),?5,?6,?7,?8,?9,?10,?11,?12,?13 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async publishCommitment(context:Context,command:Extract<ExperimentCommand,{method:'PROGRAM_FORWARD_COMMITMENT'}>,commandDigest:string,parent:Checked|undefined,freshNow:()=>string){
  let plan:ProgramCommitmentInput,linked:Checked[]=[];
  if(command.action==='register'){await verifyExperimentManifestInput(command.input,command.evaluator);plan=command.input;}
  else{if(!parent||parent.record.version!==5||parent.record.type!=='MANIFEST'||parent.row.digest!==command.manifest.digest)throw new ExperimentError('Exact commitment manifest not found.',404);plan=parent.record.content.input;
   const provisional=boundedExperimentRecord({version:5,id:command.id,requestId:command.requestId,createdAt:freshNow(),author:context.author,type:'OUTCOME',content:content(command),flags:experimentOutcomeFlags(context.reference,experimentAuthorReference(parent.record.author),command.claim),policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false}).record;
   if(provisional.version!==5||provisional.type!=='OUTCOME')throw inconsistent();linked=await this.commitmentLink(parent.record,provisional);
   for(const dependency of [parent,...linked])if((await this.events(dependency)).state!=='VISIBLE')throw new ExperimentError('A linked public parent is not visible.');
  }
  const closure=await readCommitmentSourceClosure(this.db,plan);if(closure.some(value=>!value.visible))throw new ExperimentError('A retained source or ancestor is unavailable.');
  await this.requireCredential(context,freshNow());
  await this.quota(context,freshNow(),command.action==='register'?'MANIFEST':'OUTCOME');
  const at=freshNow();clock(at);if(command.action==='register'&&(plan.preparedAt>at||Date.parse(plan.startsAt)-Date.parse(at)<experimentCommitmentStoreLimits.minimumLeadMs))throw new ExperimentError('Application declaration and database admission must both precede the declared start by at least 60 seconds.');
  if(parent&&parent.record.createdAt>at)throw new ExperimentError('Link time precedes its declared plan.');
  const selected=closure.find(value=>value.id===plan.config.strategy.record.id);if(!selected)throw inconsistent();
  const raw={version:5,id:command.id,requestId:command.requestId,createdAt:at,author:context.author,type:command.action==='register'?'MANIFEST':'OUTCOME',content:content(command),flags:command.action==='register'?experimentManifestFlags(command.disclosures):experimentOutcomeFlags(context.reference,experimentAuthorReference(parent!.record.author),command.claim),policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false};
  const {record,payload}=boundedExperimentRecord(raw),digest=await experimentDigest(payload),values:Values=[record.id,record.type,parent?.record.id??'',parent?.row.digest??'',selected.id,selected.digest,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),commitmentSourceFenceClause(add(values,commitmentSourceFenceJson(closure))),...this.quotaClauses(context,at,command.action==='register'?'MANIFEST':'OUTCOME',values)];
  if(command.action==='register'){const current=freshNow();clock(current);if(Date.parse(plan.startsAt)-Date.parse(current)<experimentCommitmentStoreLimits.minimumLeadMs||current<at)throw new ExperimentError('The registration deadline passed during validation.');clauses.push(`${nowSql}>=?13`,`${nowSql}<=${add(values,new Date(Date.parse(plan.startsAt)-experimentCommitmentStoreLimits.minimumLeadMs).toISOString())}`);}
  if(parent)clauses.push(this.targetClause(parent,values),this.visibleClause(parent.record.id,values),`(SELECT COUNT(*) FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?3)<${experimentLimits.outcomesPerManifest}`);
  for(const dependency of linked)clauses.push(this.targetClause(dependency,values),this.visibleClause(dependency.record.id,values));
  if(values.length>experimentCommitmentStoreLimits.maximumBindParameters)throw inconsistent();
  await this.db.prepare(`INSERT INTO experiment_records(id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,NULLIF(?3,''),NULLIF(?4,''),?5,?6,?7,?8,?9,?10,?11,?12,?13 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async publishWindow(context:Context,command:Extract<ExperimentCommand,{method:'PROGRAM_FORWARD_WINDOW'}>,commandDigest:string,parent:Checked|undefined,freshNow:()=>string){
  let input:ProgramWindowInput,linked:Checked[]=[];
  if(command.action==='register'){
   await verifyExperimentManifestInput(command.input,command.evaluator);input=command.input;
  }else{
   if(!parent||parent.record.version!==6||parent.record.type!=='MANIFEST'||parent.row.digest!==command.manifest.digest)throw new ExperimentError('Exact sampled-window manifest not found.',404);
   input=parent.record.content.input;
   const provisional=boundedExperimentRecord({version:6,id:command.id,requestId:command.requestId,createdAt:freshNow(),author:context.author,type:'OUTCOME',content:content(command),flags:experimentOutcomeFlags(context.reference,experimentAuthorReference(parent.record.author),command.claim),policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false}).record;
   if(provisional.version!==6||provisional.type!=='OUTCOME')throw inconsistent();
   try{linked=await this.windowLink(parent.record,provisional);}catch(error){throw new ExperimentError('The complete sampled-window link, original V4 evidence or supported direct claim binding is invalid.',error&&typeof error==='object'&&'status'in error&&error.status===413?413:400);}
  }
  try{linked.push(...await this.windowDeclaration(input));}catch{throw new ExperimentError('Optional declaration must name the exact current original V5 plan.',400);}
  const closure=await readCommitmentSourceClosure(this.db,input.plan);
  if(closure.some(value=>!value.visible))throw new ExperimentError('A retained source or ancestor is unavailable.');
  const publications=[...new Map([...parent?[parent]:[],...linked].map(value=>[value.record.id,value])).values()];
  const histories=await Promise.all(publications.map(async value=>({publication:value,...await this.events(value)})));
  if(histories.some(value=>value.state!=='VISIBLE'))throw new ExperimentError('A linked sampled-window dependency is not visible.');
  const snapshot:CommitmentFence={closure,publications:publications.map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),events:histories.flatMap(value=>value.rows).sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.sequence-b.sequence)};
  await this.requireCredential(context,freshNow());
  const type=command.action==='register'?'MANIFEST':'OUTCOME';await this.quota(context,freshNow(),type);
  const at=freshNow();clock(at);
  if(command.action==='register'&&(input.protocol.preparedAt>at||Date.parse(input.protocol.startsAt)-Date.parse(at)<experimentCommitmentStoreLimits.minimumLeadMs))throw new ExperimentError('Application declaration and database admission must both precede the sampled-window start by at least 60 seconds.');
  if(parent&&parent.record.createdAt>at||linked.some(value=>value.record.createdAt>at))throw new ExperimentError('Window publication time precedes a linked dependency.');
  const selected=closure.find(value=>value.id===input.plan.config.strategy.record.id);if(!selected)throw inconsistent();
  const {record,payload}=boundedExperimentRecord({version:6,id:command.id,requestId:command.requestId,createdAt:at,author:context.author,type,content:content(command),flags:command.action==='register'?experimentManifestFlags(command.disclosures):experimentOutcomeFlags(context.reference,experimentAuthorReference(parent!.record.author),command.claim),policyAccepted:command.policyAccepted,classification:'AUTHOR_REPORTED',executionEnabled:false});
  const digest=await experimentDigest(payload),values:Values=[record.id,type,parent?.record.id??'',parent?.row.digest??'',selected.id,selected.digest,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),...this.quotaClauses(context,at,type,values)];
  if(publications.length){const fence=this.commitmentSnapshotFence(snapshot,'?'+(values.length+1),true);values.push(fence.payload);clauses.push(fence.clause);}
  else clauses.push(commitmentSourceFenceClause(add(values,commitmentSourceFenceJson(closure))));
  if(parent)clauses.push(`(SELECT COUNT(*) FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?3)<${experimentLimits.outcomesPerManifest}`);
  if(command.action==='register'){
   const current=freshNow();clock(current);
   if(current<at||Date.parse(input.protocol.startsAt)-Date.parse(current)<experimentCommitmentStoreLimits.minimumLeadMs)throw new ExperimentError('The sampled-window registration deadline passed during validation.');
   clauses.push(`${nowSql}>=?13`,`${nowSql}<=${add(values,new Date(Date.parse(input.protocol.startsAt)-experimentCommitmentStoreLimits.minimumLeadMs).toISOString())}`);
  }
  if(values.length>experimentCommitmentStoreLimits.maximumBindParameters)throw inconsistent();
  await this.db.prepare(`INSERT INTO experiment_records(id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,NULLIF(?3,''),NULLIF(?4,''),?5,?6,?7,?8,?9,?10,?11,?12,?13 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async report(context:Context,command:Extract<ExperimentCommand,{action:'report'}>,commandDigest:string,at:string,target:Checked){
  await this.quota(context,at,'REPORT');
  const report=experimentPrivateReportSchema.parse({requestId:command.requestId,id:target.record.id,digest:target.row.digest,reason:command.reason,details:command.details,createdAt:at,reporter:context.reference}),payload=JSON.stringify(report);if(new TextEncoder().encode(payload).byteLength>4096)throw new ExperimentError('Private report is too large. Shorten its details.',413);const digest=await experimentDigest(payload);
  const values:Values=[context.key,command.requestId,context.sponsor,target.record.id,target.row.digest,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause(target,values),...this.quotaClauses(context,at,'REPORT',values)];
  await this.db.prepare(`INSERT INTO experiment_reports(author_key,request_id,sponsor_key,record_id,record_digest,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async moderate(context:Context,command:Extract<ExperimentCommand,{action:'withdraw'|'moderate'}>,commandDigest:string,at:string,target:Checked){
  const history=await this.events(target);if(history.state==='WITHDRAWN')throw new ExperimentError('Withdrawn experiment cannot be restored or moderated.');
  if(command.action==='withdraw'){
   if(target.row.author_key!==context.key&&(context.actor.kind!=='HUMAN'||target.row.sponsor_key!==context.sponsor))throw new ExperimentError('Only the original author or sponsoring human may withdraw this experiment.',403);
   if(command.reason==='AUTHOR_REQUEST'&&target.row.author_key!==context.key||command.reason==='SPONSOR_REQUEST'&&(context.actor.kind!=='HUMAN'||target.row.sponsor_key!==context.sponsor))throw new ExperimentError('Withdrawal reason does not match the participant’s authority.',403);
  }
  const maximum=command.action==='withdraw'?experimentLimits.eventsPerRecord:experimentLimits.eventsPerRecord-1;
  if(history.events.length>=maximum)throw new ExperimentError(command.action==='withdraw'?'Experiment event history is full.':'Moderation history is full; its final slot is reserved for withdrawal.');
  if(Date.parse(at)<Date.parse(history.events.at(-1)?.createdAt??target.record.createdAt))throw new ExperimentError('Moderation time precedes retained history.');
  const event=experimentPublicEventSchema.parse({sequence:history.events.length+1,requestId:command.requestId,createdAt:at,actor:context.reference,state:command.action==='withdraw'?'WITHDRAWN':command.state,reason:command.reason}),payload=JSON.stringify(event),digest=await experimentDigest(payload);
  const values:Values=[target.record.id,event.sequence,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,event.state,event.reason,at];
  const record=add(values,target.record.id),expected=add(values,history.events.length);
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause(target,values),`COALESCE((SELECT MAX(sequence) FROM experiment_moderation WHERE record_id=${record}),0)=${expected}`,`NOT EXISTS(SELECT 1 FROM experiment_moderation WHERE record_id=${record} AND state='WITHDRAWN')`];
  if(history.rows.length){const previous=history.rows.at(-1)!;clauses.push(`EXISTS(SELECT 1 FROM experiment_moderation WHERE record_id=${record} AND sequence=${add(values,previous.sequence)} AND digest=${add(values,previous.digest)} AND payload=${add(values,previous.payload!)})`);}
  await this.db.prepare(`INSERT INTO experiment_moderation(record_id,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
}
