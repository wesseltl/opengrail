import {networkAgentSchema} from './network-model';
import {StrategyRepository} from './strategy-store';
import {boundedStrategyRecord,boundedStrategyCommand,strategyPublishCommandForRecord,strategyAuthorReference,type StrategyPublicItem} from './strategy-model';
import {strategyEvidenceLimits,strategyEvidenceEntryForItem,validateStrategyEvidencePage} from './strategy-evidence-model';
import {ExperimentError,experimentLimits,experimentDigest,experimentPublicHumanId,experimentAuthorReference,boundedExperimentCommand,boundedExperimentRecord,experimentPublicEventSchema,experimentPrivateReportSchema,experimentListSchema,experimentGetSchema,experimentWriteSchema,experimentReportsSchema,experimentManifestFlags,experimentOutcomeFlags,experimentSummarySchema,experimentOutcomesSchema,experimentInputStrategy,experimentInputDependencies,experimentMethodVersion,experimentRecordMethod,experimentRecordStatus,verifyExperimentRecordArtifact,verifyExperimentManifestInput,verifyExperimentArtifact,type ExperimentInput,type ExperimentActor,type ExperimentAuthor,type ExperimentAuthorReference,type ExperimentCommand,type ExperimentRecord,type ExperimentPublicItem,type ExperimentPublicEvent} from './experiment-model';
type PublicationRow={id:string;type:string;manifest_id:string|null;manifest_digest:string|null;strategy_id:string;strategy_digest:string;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type EventRow={record_id:string;sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;state:string;reason:string;created_at:string};
type ReportRow={author_key:string;request_id:string;sponsor_key:string;record_id:string;record_digest:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type Checked={row:PublicationRow;record:ExperimentRecord};
type Context={actor:ExperimentActor;author:ExperimentAuthor;reference:ExperimentAuthorReference;key:string;sponsor:string};
type Values=(string|number)[];
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
function retryAfter(at:string){const date=new Date(at);return Math.max(1,Math.ceil((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)-Date.parse(at))/1000));}

/** All submission authority is server-derived. No sources are fetched or code executed. */
export class ExperimentRepository{
 constructor(private db:D1Database){}

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
 private async events(publication:Checked){
  const rows=(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_moderation WHERE record_id=? ORDER BY sequence LIMIT ${experimentLimits.eventsPerRecord+1}`).bind(publication.record.id).all<EventRow>()).results;
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
  return {source,parent,dependencies:await this.dependencies(input,false,source)};
 }
 private async project(publication:Checked):Promise<ExperimentPublicItem>{
  const {events,state:own,reason}=await this.events(publication),record=publication.record,{source,parent,dependencies}=await this.bindings(publication);
  const parentState=parent?(await this.events(parent)).state:'VISIBLE';
  const outcomeCount=record.type==='MANIFEST'?(await this.db.prepare("SELECT COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?").bind(record.id).first<{n:number}>())?.n??0:0;
  let finalSources=true;if(record.version===4){const values:Values=[],clauses=dependencies.map(value=>this.sourceClause(value,values));const observed=await this.db.prepare(`SELECT CASE WHEN ${clauses.join(' AND ')} THEN 1 ELSE 0 END AS visible`).bind(...values).first<{visible:number}>();if(!observed||observed.visible!==0&&observed.visible!==1)throw inconsistent();finalSources=observed.visible===1;}
  const suppression=dependencies.some(value=>!value.visible)||!finalSources?'SOURCE_UNAVAILABLE':parentState!=='VISIBLE'?'PARENT_UNAVAILABLE':null;
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
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row))),page=checked.slice(0,experimentLimits.page),items=await Promise.all(page.map(async item=>this.summary(await this.project(item))));
  return experimentListSchema.parse({version:1,items,nextCursor:rows.length>experimentLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 async get(recordId:string){return experimentGetSchema.parse({version:1,item:await this.project(await this.publication(recordId)),executionEnabled:false});}
 async outcomes(manifestId:string,cursor?:string|null){
  const manifest=await this.publication(manifestId);if(manifest.record.type!=='MANIFEST')throw new ExperimentError('Manifest not found.',404);
  await this.bindings(manifest);const anchor=cursor?await this.publication(cursor):null;if(anchor&&(anchor.record.type!=='OUTCOME'||anchor.row.manifest_id!==manifestId))throw new ExperimentError('Outcome cursor not found.',404);
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM experiment_records WHERE type='OUTCOME' AND manifest_id=? ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${experimentLimits.page+1}`).bind(manifestId,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row))),page=checked.slice(0,experimentLimits.page),items=await Promise.all(page.map(async item=>this.summary(await this.project(item))));
  return experimentOutcomesSchema.parse({version:1,items,nextCursor:rows.length>experimentLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
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
   const result=new Map<string,{events:ExperimentPublicEvent[];state:ExperimentPublicItem['state'];reason:ExperimentPublicItem['reason']}>();
   for(const [recordId,publication]of closure){const events:ExperimentPublicEvent[]=[];let state:ExperimentPublicItem['state']='VISIBLE',time=publication.record.createdAt;
    for(const row of grouped.get(recordId)??[]){try{
     if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const event=experimentPublicEventSchema.parse(JSON.parse(row.payload));
     if(JSON.stringify(event)!==row.payload||await experimentDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==recordId||row.sequence!==event.sequence||row.request_id!==event.requestId||row.created_at!==event.createdAt||row.state!==event.state||row.reason!==event.reason||row.author_key!==authorKey(event.actor)||row.sponsor_key!==event.actor.sponsorId||state==='WITHDRAWN'||event.createdAt<time)throw Error();
     if(event.state==='WITHDRAWN'){const author=experimentAuthorReference(publication.record.author),own=JSON.stringify(event.actor)===JSON.stringify(author),sponsor=event.actor.kind==='HUMAN'&&event.actor.id===author.sponsorId&&event.actor.sponsorId===author.sponsorId;if(!own&&!sponsor)throw Error();}
     const command=boundedExperimentCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:recordId,digest:publication.row.digest,reason:event.reason,policyAccepted:'public-experiment-v1'}:{action:'moderate',requestId:event.requestId,id:recordId,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:'public-experiment-v1'});
     if(await experimentDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=experimentLimits.eventsPerRecord))throw Error();events.push(event);state=event.state;time=event.createdAt;
    }catch{throw inconsistent();}}
    result.set(recordId,{events,state,reason:events.at(-1)?.reason??null});
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
  const items=selected.slice(0,retainedPage).map(publication=>{
   const record=publication.record,own=secondEvents.get(record.id)!;
   const dependencies=forwardManifestDependencies.get(record.type==='MANIFEST'?record.id:record.content.manifest.id)??[],dependencyHidden=dependencies.some(value=>value.id!==strategyId&&lastDependencies.get(value.id)?.state!=='VISIBLE');
   const parentState=record.type==='OUTCOME'?secondEvents.get(record.content.manifest.id)!.state:'VISIBLE',suppression=source.state!=='VISIBLE'||dependencyHidden?'SOURCE_UNAVAILABLE' as const:parentState!=='VISIBLE'?'PARENT_UNAVAILABLE' as const:null,state=own.state==='WITHDRAWN'?'WITHDRAWN' as const:own.state==='HIDDEN'||suppression?'HIDDEN' as const:'VISIBLE' as const,outcomeCount=record.type==='MANIFEST'?counts.get(record.id)??0:0;
   const item:ExperimentPublicItem={id:record.id,digest:publication.row.digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:experimentAuthorReference(record.author),strategy:{id:strategyId,digest},manifest:record.type==='OUTCOME'?record.content.manifest:null,state,reason:own.reason,suppression,reporting:record.type==='OUTCOME'||outcomeCount>0?'AUTHOR_REPORTED':'UNREPORTED',outcomeCount,record:state==='VISIBLE'?record:null,moderation:own.events};
   return strategyEvidenceEntryForItem(item);
  });
  return validateStrategyEvidencePage({version:1,strategy:source,items,nextCursor:selected.length>retainedPage?selected[retainedPage-1].record.id:null,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false});
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
 async write(actor:ExperimentActor,raw:unknown,at:string){
  const context=await this.context(actor,at);await this.requireCredential(context,at);
  let parsed:ReturnType<typeof boundedExperimentCommand>;try{parsed=boundedExperimentCommand(raw);}catch(error){if(error instanceof ExperimentError)throw error;throw new ExperimentError('Invalid experiment command.',400);}
  const {command,payload}=parsed;if(command.action==='moderate'&&(context.actor.kind!=='HUMAN'||!context.actor.moderator))throw new ExperimentError('Explicit moderator authorization is required.',403);
  const commandDigest=await experimentDigest(payload),saved=await this.replay(context,command,commandDigest,at);if(saved)return saved;
  let target:Checked|undefined;
  if(command.action==='outcome')target=await this.publication(command.manifest.id);
  if(command.action!=='register'&&command.action!=='outcome')target=await this.publication(command.id);
  if(target){const expected=command.action==='outcome'?command.manifest.digest:command.action==='register'?'':command.digest;if(target.row.digest!==expected)throw new ExperimentError('Exact experiment target not found.',404);if(at<target.record.createdAt)throw new ExperimentError('Submission time precedes its target.');}
  try{if(command.action==='register'||command.action==='outcome')await this.publish(context,command,commandDigest,at,target);else if(command.action==='report')await this.report(context,command,commandDigest,at,target!);else await this.moderate(context,command,commandDigest,at,target!);}catch(error){const replay=await this.replay(context,command,commandDigest,at);if(replay)return replay;throw error;}
  const receipt=await this.replay(context,command,commandDigest,at);if(receipt)return receipt;
  await this.requireCredential(context,at);if(command.action==='register'||command.action==='outcome'||command.action==='report')await this.quota(context,at,command.action==='register'?'MANIFEST':command.action==='outcome'?'OUTCOME':'REPORT');
  if(command.action==='outcome'){
   const retained=await this.db.prepare("SELECT COUNT(*) AS n FROM experiment_records WHERE type='OUTCOME' AND manifest_id=?").bind(command.manifest.id).first<{n:number}>();
   if(!retained||!Number.isInteger(retained.n)||retained.n<0||retained.n>experimentLimits.outcomesPerManifest)throw inconsistent();
   if(retained.n===experimentLimits.outcomesPerManifest)throw new ExperimentError('This manifest’s retained outcome capacity has been reached.',429);
  }
  throw new ExperimentError('Experiment identity, source, target, moderation state or quota changed. Refresh before retrying; no submission was confirmed.');
 }
 private async publish(context:Context,command:Extract<ExperimentCommand,{action:'register'|'outcome'}>,commandDigest:string,at:string,parent?:Checked){
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
