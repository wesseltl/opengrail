import {networkAgentSchema} from './network-model';
import {strategyLineageLimits,strategyLineageReferenceSchema,validateStrategyLineagePage,verifyStrategyLineageRelation,type StrategyLineagePage,type StrategyLineageNode} from './strategy-lineage-model';
import {StrategyError,strategyLimits,strategyDigest,strategyPublicHumanId,strategyAuthorReference,boundedStrategyCommand,boundedStrategyRecord,verifyStrategyProgram,strategyPublishCommandForRecord,strategyAuthorReferenceSchema,strategyPublicEventSchema,strategyPrivateReportSchema,strategyListSchema,strategyGetSchema,strategyHistorySchema,strategyWriteSchema,strategyReportsSchema,type StrategyActor,type StrategyAuthor,type StrategyAuthorReference,type StrategyCommand,type StrategyRecord,type StrategyPublicItem,type StrategyPublicEvent} from './strategy-model';
type PublicationRow={id:string;root_id:string;revision:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type EventRow={record_id:string;sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;state:string;reason:string;created_at:string};
type ReportRow={author_key:string;request_id:string;sponsor_key:string;record_id:string;record_digest:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type Checked={row:PublicationRow;record:StrategyRecord};
type Context={actor:StrategyActor;author:StrategyAuthor;reference:StrategyAuthorReference;key:string;sponsor:string};
type Values=(string|number)[];
type LineageSnapshot={page:StrategyLineagePage;payload:string;publications:PublicationRow[];events:EventRow[];incoming:PublicationRow[];target:Checked;cursor:Checked|null};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const nowSql="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const limitedPayload=(maximum:number)=>`CASE WHEN length(CAST(payload AS BLOB))<=${maximum} THEN payload ELSE NULL END AS payload`;
const publicationColumns=`id,root_id,revision,author_key,sponsor_key,request_id,command_digest,${limitedPayload(strategyLimits.payloadBytes)},digest,created_at`;
const eventColumns=`record_id,sequence,author_key,sponsor_key,request_id,command_digest,${limitedPayload(4096)},digest,state,reason,created_at`;
const reportColumns=`author_key,request_id,sponsor_key,record_id,record_digest,command_digest,${limitedPayload(4096)},digest,created_at`;
const inconsistent=()=>new StrategyError('Strategy records are inconsistent. Retained material was preserved.',503);
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new StrategyError('Invalid strategy timestamp.',400);}
function id(value:string){if(typeof value!=='string'||!uuid.test(value))throw new StrategyError('Invalid strategy identity.',400);}
const authorKey=(author:StrategyAuthorReference)=>author.kind+':'+author.id;
const add=(values:Values,value:string|number)=>{values.push(value);return '?'+values.length;};
const content=(command:Extract<StrategyCommand,{action:'publish'}>)=>({name:command.name,description:command.description,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,definition:command.definition,relation:command.relation,...('version' in command?{program:command.program}:{})});
function retryAfter(at:string){const date=new Date(at);return Math.max(1,Math.ceil((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)-Date.parse(at))/1000));}

/** All submission authority is server-derived. No sources are fetched or code executed. */
export class StrategyRepository{
 constructor(private db:D1Database){}
 private readonly lineageConfirmations=new WeakMap<object,LineageSnapshot>();

 private async context(actor:StrategyActor,at:string):Promise<Context>{
  clock(at);
  let author:StrategyAuthor;
  if(actor?.kind==='HUMAN'){
   if(typeof actor.moderator!=='boolean')throw new StrategyError('Invalid participation context.',403);
   const sponsor=await strategyPublicHumanId(actor.userId);author={kind:'HUMAN',id:sponsor,sponsorId:sponsor};
  }else if(actor?.kind==='AGENT'){
   try{
    const principal=actor.principal,sponsor=await strategyPublicHumanId(principal.ownerId),agent=networkAgentSchema.parse(JSON.parse(principal.payload));
    if(agent.id!==principal.agentId||agent.credentialId!==principal.credentialId||agent.name!==principal.name||agent.expiresAt!==principal.expiresAt||agent.revision!==1||agent.revokedAt!==null||!hash.test(principal.registryDigest)||!hash.test(principal.tokenDigest)||JSON.stringify(agent)!==principal.payload||await strategyDigest(principal.payload)!==principal.registryDigest||Date.parse(at)<Date.parse(agent.createdAt)||Date.parse(at)>=Date.parse(agent.expiresAt))throw Error();
    author={kind:'AGENT',id:agent.id,sponsorId:sponsor,name:agent.name};
   }catch{throw new StrategyError('Agent credential is invalid, expired or revoked.',401);}
  }else throw new StrategyError('Authentication is required to submit strategy.',401);
  const reference=strategyAuthorReference(author);return {actor,author,reference,key:authorKey(reference),sponsor:reference.sponsorId};
 }

 private credentialClause(context:Context,at:string,values:Values){
  if(context.actor.kind!=='AGENT')return '1=1';
  const p=context.actor.principal,user=add(values,p.ownerId),agent=add(values,p.agentId),credential=add(values,p.credentialId),token=add(values,p.tokenDigest),digest=add(values,p.registryDigest),payload=add(values,p.payload),time=add(values,at);
  return `EXISTS(SELECT 1 FROM network_agents WHERE owner_id=${user} AND id=${agent} AND credential_id=${credential} AND token_digest=${token} AND digest=${digest} AND payload=${payload} AND revision=1 AND revoked_at IS NULL AND created_at<=${time} AND created_at<=${nowSql} AND expires_at>${time} AND expires_at>${nowSql})`;
 }
 private async requireCredential(context:Context,at:string){
  if(context.actor.kind==='AGENT'){
   const values:Values=[],clause=this.credentialClause(context,at,values),row=await this.db.prepare(`SELECT 1 AS active WHERE ${clause}`).bind(...values).first<{active:number}>();
   if(!row)throw new StrategyError('Agent credential is invalid, expired or revoked.',401);
  }
 }
 private requestClause(context:Context,requestId:string,values:Values){
  const author=add(values,context.key),request=add(values,requestId);
  return ['strategy_publications','strategy_moderation','strategy_reports'].map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE author_key=${author} AND request_id=${request})`).join(' AND ');
 }

 private async checkPublication(row:PublicationRow):Promise<Checked>{
  try{
   if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const checked=boundedStrategyRecord(JSON.parse(row.payload)),record=checked.record;await verifyStrategyProgram(record);
   if(checked.payload!==row.payload||await strategyDigest(row.payload)!==row.digest||record.id!==row.id||record.rootId!==row.root_id||record.revision!==row.revision||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(strategyAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedStrategyCommand(strategyPublishCommandForRecord(record));
   if(await strategyDigest(command.payload)!==row.command_digest)throw Error();
   return {row,record};
  }catch{throw inconsistent();}
 }
 private async publication(recordId:string):Promise<Checked>{
  id(recordId);const row=await this.db.prepare(`SELECT ${publicationColumns} FROM strategy_publications WHERE id=?`).bind(recordId).first<PublicationRow>();
  if(!row)throw new StrategyError('Strategy publication not found.',404);return this.checkPublication(row);
 }
 private async events(publication:Checked){
  const rows=(await this.db.prepare(`SELECT ${eventColumns} FROM strategy_moderation WHERE record_id=? ORDER BY sequence LIMIT ${strategyLimits.eventsPerRecord+1}`).bind(publication.record.id).all<EventRow>()).results;
  if(rows.length>strategyLimits.eventsPerRecord)throw inconsistent();
  const events:StrategyPublicEvent[]=[];let state='VISIBLE',time=publication.record.createdAt;
  for(const row of rows){
   try{
    if(!row.payload||new TextEncoder().encode(row.payload).byteLength>4096||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
    const event=strategyPublicEventSchema.parse(JSON.parse(row.payload));
    if(JSON.stringify(event)!==row.payload||await strategyDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==publication.record.id||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||event.reason!==row.reason||authorKey(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||state==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(time))throw Error();
    const command=boundedStrategyCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,reason:event.reason,policyAccepted:'public-strategy-v1'}:{action:'moderate',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:'public-strategy-v1'});
    if(await strategyDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=strategyLimits.eventsPerRecord))throw Error();
    events.push(event);state=event.state;time=event.createdAt;
   }catch{throw inconsistent();}
  }
  return {rows,events,state:state as StrategyPublicItem['state'],reason:events.at(-1)?.reason??null};
 }
 private async project(publication:Checked):Promise<StrategyPublicItem>{
  const {events,state,reason}=await this.events(publication),record=publication.record;
  return {id:record.id,digest:publication.row.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:strategyAuthorReference(record.author),state,reason,record:state==='VISIBLE'?record:null,moderation:events};
 }
 private async checkReport(row:ReportRow){
  try{
   if(!row.payload||new TextEncoder().encode(row.payload).byteLength>4096||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const report=strategyPrivateReportSchema.parse(JSON.parse(row.payload));
   if(JSON.stringify(report)!==row.payload||await strategyDigest(row.payload)!==row.digest||report.requestId!==row.request_id||report.id!==row.record_id||report.digest!==row.record_digest||report.createdAt!==row.created_at||authorKey(report.reporter)!==row.author_key||report.reporter.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedStrategyCommand({action:'report',requestId:report.requestId,id:report.id,digest:report.digest,reason:report.reason,details:report.details,policyAccepted:'public-strategy-v1'});
   if(await strategyDigest(command.payload)!==row.command_digest)throw Error();return report;
  }catch{throw inconsistent();}
 }

 private async replay(context:Context,command:StrategyCommand,commandDigest:string,at:string){
  await this.requireCredential(context,at);
  const [publications,events,reports]=await Promise.all([
   this.db.prepare(`SELECT ${publicationColumns} FROM strategy_publications WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<PublicationRow>(),
   this.db.prepare(`SELECT ${eventColumns} FROM strategy_moderation WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<EventRow>(),
   this.db.prepare(`SELECT ${reportColumns} FROM strategy_reports WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<ReportRow>(),
  ]);
  if(publications.results.length+events.results.length+reports.results.length>1)throw inconsistent();
  const row=publications.results[0]??events.results[0]??reports.results[0];if(!row)return null;
  if(row.command_digest!==commandDigest)throw new StrategyError('Request ID already used for different strategy material.');
  let item:StrategyPublicItem|null=null,report:null|{requestId:string;id:string;digest:string;reason:string;createdAt:string}=null;
  if(publications.results[0]){
   if(command.action!=='publish')throw inconsistent();item=await this.project(await this.checkPublication(publications.results[0]));
  }else if(events.results[0]){
   if(command.action!=='withdraw'&&command.action!=='moderate')throw inconsistent();item=await this.project(await this.publication(events.results[0].record_id));
   if(!item.moderation.some(event=>event.requestId===command.requestId&&authorKey(event.actor)===context.key))throw inconsistent();
  }else{
   if(command.action!=='report')throw inconsistent();const retained=await this.checkReport(reports.results[0]);report={requestId:retained.requestId,id:retained.id,digest:retained.digest,reason:retained.reason,createdAt:retained.createdAt};
  }
  // Reconciliation is still a credential-authorized read; a stale earlier check
  // cannot reveal a receipt after revocation while material was being validated.
  await this.requireCredential(context,at);
  return strategyWriteSchema.parse({version:1,action:command.action,requestId:command.requestId,item,report,executionEnabled:false});
 }

 async list(cursor?:string|null){
  const anchor=cursor?await this.publication(cursor):null;
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM strategy_publications ${anchor?'WHERE created_at<? OR (created_at=? AND id<?)':''} ORDER BY created_at DESC,id DESC LIMIT ${strategyLimits.page+1}`).bind(...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  const page=rows.slice(0,strategyLimits.page),items=await Promise.all(page.map(async row=>this.project(await this.checkPublication(row))));
  return strategyListSchema.parse({version:1,items,nextCursor:rows.length>strategyLimits.page?page.at(-1)!.id:null,executionEnabled:false});
 }
 async get(recordId:string){return strategyGetSchema.parse({version:1,item:await this.project(await this.publication(recordId)),executionEnabled:false});}
 async history(rootId:string){
  id(rootId);const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM strategy_publications WHERE root_id=? ORDER BY revision LIMIT ${strategyLimits.revisions+1}`).bind(rootId).all<PublicationRow>()).results;
  if(!rows.length)throw new StrategyError('Strategy history not found.',404);if(rows.length>strategyLimits.revisions)throw inconsistent();
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row)));const first=checked[0];
  for(let n=0;n<checked.length;n++){const item=checked[n];if(item.record.revision!==n+1||item.record.rootId!==rootId||item.row.author_key!==first.row.author_key||item.record.version!==first.record.version||n>0&&(item.record.content.relation?.id!==checked[n-1].record.id||item.record.content.relation?.digest!==checked[n-1].row.digest||Date.parse(item.record.createdAt)<Date.parse(checked[n-1].record.createdAt)))throw inconsistent();}
  return strategyHistorySchema.parse({version:1,items:await Promise.all(checked.reverse().map(item=>this.project(item))),executionEnabled:false});
 }

 private lineageIncoming(target:Checked,cursor:Checked|null){
  return this.db.prepare(`SELECT ${publicationColumns} FROM strategy_publications WHERE json_valid(payload) AND json_extract(payload,'$.content.relation.id')=? ${cursor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${strategyLineageLimits.page+1}`).bind(target.record.id,...cursor?[cursor.record.createdAt,cursor.record.createdAt,cursor.record.id]:[]);
 }
 private lineageShape(){return this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN payload IS NULL OR length(CAST(payload AS BLOB))>${strategyLimits.payloadBytes} OR NOT json_valid(payload) THEN 1 ELSE 0 END),0) AS invalid FROM strategy_publications`);}
 private async lineageEvents(publication:Checked,rows:EventRow[]){
  if(rows.length>strategyLimits.eventsPerRecord)throw inconsistent();
  const events:StrategyPublicEvent[]=[];let state='VISIBLE',time=publication.record.createdAt;
  for(const row of rows)try{
   if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const event=strategyPublicEventSchema.parse(JSON.parse(row.payload));
   if(JSON.stringify(event)!==row.payload||await strategyDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==publication.record.id||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||event.reason!==row.reason||authorKey(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||state==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(time))throw Error();
   const command=boundedStrategyCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,reason:event.reason,policyAccepted:'public-strategy-v1'}:{action:'moderate',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:'public-strategy-v1'});
   if(await strategyDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=strategyLimits.eventsPerRecord))throw Error();
   if(event.state==='WITHDRAWN'){
    const own=authorKey(event.actor)===publication.row.author_key,sponsor=event.actor.kind==='HUMAN'&&event.actor.id===publication.record.author.sponsorId&&event.actor.sponsorId===publication.record.author.sponsorId;
    if(!own&&!sponsor||event.reason==='AUTHOR_REQUEST'&&!own||event.reason==='SPONSOR_REQUEST'&&!sponsor)throw Error();
   }
   events.push(event);state=event.state;time=event.createdAt;
  }catch{throw inconsistent();}
  const record=publication.record;
  return {id:record.id,digest:publication.row.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:strategyAuthorReference(record.author),state:state as StrategyPublicItem['state'],reason:events.at(-1)?.reason??null,record:state==='VISIBLE'?record:null,moderation:events};
 }
 private async lineageFence(snapshot:LineageSnapshot){
  const ids=snapshot.publications.map(row=>row.id),placeholders=ids.map(()=>'?').join(',');
  const [publications,events,incoming,shape]=await this.db.batch([
   this.db.prepare(`SELECT ${publicationColumns} FROM strategy_publications WHERE id IN (${placeholders}) ORDER BY id`).bind(...ids),
   this.db.prepare(`SELECT ${eventColumns} FROM strategy_moderation WHERE record_id IN (${placeholders}) ORDER BY record_id,sequence LIMIT ${strategyLineageLimits.closure*strategyLimits.eventsPerRecord+1}`).bind(...ids),
   this.lineageIncoming(snapshot.target,snapshot.cursor),this.lineageShape(),
  ]);
  const size=shape.results[0] as {total:number;invalid:number}|undefined;
  if(!size||size.total>strategyLimits.stored||size.invalid!==0||JSON.stringify(publications.results)!==JSON.stringify(snapshot.publications)||JSON.stringify(events.results)!==JSON.stringify(snapshot.events)||JSON.stringify(incoming.results)!==JSON.stringify(snapshot.incoming))throw inconsistent();
 }
 /** Direct incoming relations across roots. Complete ancestors are read only to
  * check identity and visibility; no descendant graph, evaluator or guest runs. */
 async lineage(recordId:string,expectedDigest:string,cursorId:string|null=null):Promise<StrategyLineagePage>{
  try{strategyLineageReferenceSchema.parse({id:recordId,digest:expectedDigest});if(cursorId!==null)strategyLineageReferenceSchema.shape.id.parse(cursorId);}catch{throw new StrategyError('Invalid exact lineage query.',400);}
  const target=await this.publication(recordId);if(target.row.digest!==expectedDigest)throw new StrategyError('Exact strategy version not found.',404);
  const checked=new Map<string,Checked>([[target.record.id,target]]);
  const load=async(recordId:string)=>{const existing=checked.get(recordId);if(existing)return existing;if(checked.size>=strategyLineageLimits.closure)throw inconsistent();const value=await this.publication(recordId);checked.set(recordId,value);return value;};
  const cursor=cursorId?await load(cursorId):null;
  if(cursor){if(cursor.record.content.relation?.id!==target.record.id||cursor.record.content.relation.digest!==target.row.digest)throw new StrategyError('Foreign exact lineage cursor.',404);try{verifyStrategyLineageRelation(cursor.record,target.record,target.row.digest);}catch{throw inconsistent();}}
  const shape=await this.lineageShape().first<{total:number;invalid:number}>();if(!shape||shape.total>strategyLimits.stored||shape.invalid!==0)throw inconsistent();
  const incoming=(await this.lineageIncoming(target,cursor).all<PublicationRow>()).results;
  const children:Checked[]=[];
  for(const row of incoming){const value=await this.checkPublication(row);if(checked.has(value.record.id)&&checked.get(value.record.id)!.row.payload!==row.payload)throw inconsistent();checked.set(value.record.id,value);if(checked.size>strategyLineageLimits.closure)throw inconsistent();try{verifyStrategyLineageRelation(value.record,target.record,target.row.digest);}catch{throw inconsistent();}children.push(value);}
  const ancestors:Checked[]=[],seen=new Set([target.record.id]);let child=target;
  while(child.record.content.relation){
   if(ancestors.length>=strategyLineageLimits.ancestors||seen.has(child.record.content.relation.id))throw inconsistent();
   let parent:Checked;try{parent=await load(child.record.content.relation.id);}catch{throw inconsistent();}
   try{verifyStrategyLineageRelation(child.record,parent.record,parent.row.digest);}catch{throw inconsistent();}
   ancestors.push(parent);seen.add(parent.record.id);child=parent;
  }
  const rows=[...checked.values()].map(value=>value.row).sort((a,b)=>a.id.localeCompare(b.id)),ids=rows.map(row=>row.id);
  const events=(await this.db.prepare(`SELECT ${eventColumns} FROM strategy_moderation WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${strategyLineageLimits.closure*strategyLimits.eventsPerRecord+1}`).bind(...ids).all<EventRow>()).results;
  if(events.length>strategyLineageLimits.closure*strategyLimits.eventsPerRecord)throw inconsistent();
  const projected=new Map<string,StrategyPublicItem>();for(const value of checked.values())projected.set(value.record.id,await this.lineageEvents(value,events.filter(row=>row.record_id===value.record.id)));
  const node=(value:Checked,dependencies:Checked[]):StrategyLineageNode=>{const item=projected.get(value.record.id)!,unavailable=dependencies.some(source=>projected.get(source.record.id)!.state!=='VISIBLE');return {...item,record:unavailable?null:item.record,suppression:item.state==='VISIBLE'&&unavailable?'ANCESTOR_UNAVAILABLE':null};};
  const page=await validateStrategyLineagePage({version:1,kind:'STRATEGY_LINEAGE_PAGE',reference:{id:recordId,digest:expectedDigest},anchor:node(target,ancestors),parent:ancestors.length?{relation:target.record.content.relation,item:node(ancestors[0],ancestors.slice(1))}:null,items:children.slice(0,strategyLineageLimits.page).map(value=>({relation:value.record.content.relation,item:node(value,[target,...ancestors])})),nextCursor:children.length>strategyLineageLimits.page?children[strategyLineageLimits.page-1].record.id:null,scope:'DIRECT_RELATIONS_ONLY',classification:'AUTHOR_REPORTED',verification:'UNTESTED',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false},{id:recordId,digest:expectedDigest});
  const snapshot={page,payload:JSON.stringify(page),publications:rows,events,incoming,target,cursor};await this.lineageFence(snapshot);this.lineageConfirmations.set(page,snapshot);return page;
 }
 /** Finish this request's exact snapshot after asynchronous HTTP validation.
  * This capability is request-local, one-use, read-only, and never cached globally. */
 async confirmLineage(page:StrategyLineagePage):Promise<void>{
  const snapshot=this.lineageConfirmations.get(page);this.lineageConfirmations.delete(page);
  if(!snapshot||JSON.stringify(page)!==snapshot.payload)throw inconsistent();await this.lineageFence(snapshot);
 }
 async reports(actor:StrategyActor,at:string,cursor?:string|null){
  const context=await this.context(actor,at);if(context.actor.kind!=='HUMAN'||!context.actor.moderator)throw new StrategyError('Explicit moderator authorization is required.',403);
  if(cursor!==undefined&&cursor!==null&&(typeof cursor!=='string'||!hash.test(cursor)))throw new StrategyError('Invalid private report cursor.',400);
  let anchor:ReportRow|null=null;
  if(cursor){
   const anchors=(await this.db.prepare(`SELECT ${reportColumns} FROM strategy_reports WHERE digest=? LIMIT 2`).bind(cursor).all<ReportRow>()).results;
   if(!anchors.length)throw new StrategyError('Private report cursor not found.',404);if(anchors.length!==1)throw inconsistent();
   await this.checkReport(anchors[0]);anchor=anchors[0];
  }
  const rows=(await this.db.prepare(`SELECT ${reportColumns} FROM strategy_reports ${anchor?'WHERE created_at<? OR (created_at=? AND author_key<?) OR (created_at=? AND author_key=? AND request_id<?)':''} ORDER BY created_at DESC,author_key DESC,request_id DESC LIMIT ${strategyLimits.page+1}`).bind(...anchor?[anchor.created_at,anchor.created_at,anchor.author_key,anchor.created_at,anchor.author_key,anchor.request_id]:[]).all<ReportRow>()).results;
  if(new Set(rows.map(row=>row.digest)).size!==rows.length)throw inconsistent();
  const checked=await Promise.all(rows.map(row=>this.checkReport(row))),page=checked.slice(0,strategyLimits.page);
  return strategyReportsSchema.parse({version:1,reports:page,nextCursor:rows.length>strategyLimits.page?rows[strategyLimits.page-1].digest:null,executionEnabled:false});
 }

 private targetClause(target:Checked,values:Values){const record=add(values,target.record.id),digest=add(values,target.row.digest),payload=add(values,target.row.payload!);return `EXISTS(SELECT 1 FROM strategy_publications WHERE id=${record} AND digest=${digest} AND payload=${payload})`;}
 private visibleClause(recordId:string,values:Values){const record=add(values,recordId);return `COALESCE((SELECT state FROM strategy_moderation WHERE record_id=${record} ORDER BY sequence DESC LIMIT 1),'VISIBLE')='VISIBLE'`;}
 private async quota(context:Context,at:string,table:'strategy_publications'|'strategy_reports',daily:number,total:number){
  const result=await this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN sponsor_key=? AND substr(created_at,1,10)=? THEN 1 ELSE 0 END),0) AS daily FROM ${table}`).bind(context.sponsor,at.slice(0,10)).first<{total:number;daily:number}>();
  if(!result)throw inconsistent();if(result.total>=total)throw new StrategyError('The retained beta strategy capacity has been reached. No automatic reset is promised.',429);
  if(result.daily>=daily)throw new StrategyError('The sponsor’s shared UTC-day submission limit has been reached.',429,retryAfter(at));
 }
 private quotaClauses(context:Context,at:string,table:'strategy_publications'|'strategy_reports',daily:number,total:number,values:Values){
  const sponsor=add(values,context.sponsor),date=add(values,at.slice(0,10));
  return [`(SELECT COUNT(*) FROM ${table})<${total}`,`(SELECT COUNT(*) FROM ${table} WHERE sponsor_key=${sponsor} AND substr(created_at,1,10)=${date})<${daily}`];
 }

 async write(actor:StrategyActor,raw:unknown,at:string){
  const context=await this.context(actor,at);await this.requireCredential(context,at);
  let parsed:ReturnType<typeof boundedStrategyCommand>;try{parsed=boundedStrategyCommand(raw);}catch(error){if(error instanceof StrategyError)throw error;throw new StrategyError('Invalid strategy command.',400);}
  const {command,payload:commandPayload}=parsed;
  if(command.action==='publish')try{await verifyStrategyProgram(command);}catch{throw new StrategyError('Invalid program binary identity.',400);}
  if(command.action==='moderate'&&(context.actor.kind!=='HUMAN'||!context.actor.moderator))throw new StrategyError('Explicit moderator authorization is required.',403);
  const commandDigest=await strategyDigest(commandPayload),saved=await this.replay(context,command,commandDigest,at);if(saved)return saved;
  let target:Checked|undefined;
  if(command.action==='publish'&&command.relation)target=await this.publication(command.relation.id);
  if(command.action!=='publish')target=await this.publication(command.id);
  if(target){const expected=command.action==='publish'?command.relation!.digest:command.digest;if(target.row.digest!==expected)throw new StrategyError('Exact strategy target not found.',404);if(Date.parse(at)<Date.parse(target.record.createdAt))throw new StrategyError('Submission time precedes its target.');}
  try{
   if(command.action==='publish')await this.publish(context,command,commandDigest,at,target);
   else if(command.action==='report')await this.report(context,command,commandDigest,at,target!);
   else await this.moderate(context,command,commandDigest,at,target!);
  }catch(error){const replay=await this.replay(context,command,commandDigest,at);if(replay)return replay;throw error;}
  const receipt=await this.replay(context,command,commandDigest,at);if(receipt)return receipt;
  await this.requireCredential(context,at);
  if(command.action==='publish')await this.quota(context,at,'strategy_publications',strategyLimits.publishPerSponsorDay,strategyLimits.stored);
  if(command.action==='report')await this.quota(context,at,'strategy_reports',strategyLimits.reportsPerSponsorDay,strategyLimits.reportsStored);
  throw new StrategyError('Strategy identity, target, moderation state or quota changed. Refresh before retrying; no submission was confirmed.');
 }

 private async publish(context:Context,command:Extract<StrategyCommand,{action:'publish'}>,commandDigest:string,at:string,parent?:Checked){
  await this.quota(context,at,'strategy_publications',strategyLimits.publishPerSponsorDay,strategyLimits.stored);
  let rootId=command.id,revision=1;
  if(parent){
   const projected=await this.project(parent);if(projected.state!=='VISIBLE')throw new StrategyError('Referenced strategy is not visible.');
   if(command.relation!.type==='REVISION'){
    if(parent.record.version!==('version' in command?command.version:1))throw new StrategyError('A revision must preserve its source version. Use an explicit fork to change it.');
    if(parent.row.author_key!==context.key)throw new StrategyError('Only the original author can revise this strategy.',403);
    rootId=parent.record.rootId;revision=parent.record.revision+1;if(revision>strategyLimits.revisions)throw new StrategyError('Strategy revision limit reached.');
    const current=await this.db.prepare('SELECT MAX(revision) AS head FROM strategy_publications WHERE root_id=?').bind(rootId).first<{head:number}>();if(current?.head!==parent.record.revision)throw new StrategyError('Strategy has a newer revision. Refresh its history.');
   }
  }
  const {record,payload}=boundedStrategyRecord({version:'version' in command?command.version:1,id:command.id,rootId,revision,requestId:command.requestId,createdAt:at,author:context.author,content:content(command),policyAccepted:command.policyAccepted,verification:'UNTESTED',executionEnabled:false}),digest=await strategyDigest(payload);
  const values:Values=[record.id,rootId,revision,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),...this.quotaClauses(context,at,'strategy_publications',strategyLimits.publishPerSponsorDay,strategyLimits.stored,values)];
  if(parent){clauses.push(this.targetClause(parent,values),this.visibleClause(parent.record.id,values));if(command.relation!.type==='REVISION')clauses.push(`(SELECT MAX(revision) FROM strategy_publications WHERE root_id=?2)=${add(values,parent.record.revision)}`);}
  await this.db.prepare(`INSERT INTO strategy_publications(id,root_id,revision,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async report(context:Context,command:Extract<StrategyCommand,{action:'report'}>,commandDigest:string,at:string,target:Checked){
  await this.quota(context,at,'strategy_reports',strategyLimits.reportsPerSponsorDay,strategyLimits.reportsStored);
  const report=strategyPrivateReportSchema.parse({requestId:command.requestId,id:target.record.id,digest:target.row.digest,reason:command.reason,details:command.details,createdAt:at,reporter:context.reference}),payload=JSON.stringify(report);if(new TextEncoder().encode(payload).byteLength>4096)throw new StrategyError('Private report is too large. Shorten its details.',413);const digest=await strategyDigest(payload);
  const values:Values=[context.key,command.requestId,context.sponsor,target.record.id,target.row.digest,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause(target,values),...this.quotaClauses(context,at,'strategy_reports',strategyLimits.reportsPerSponsorDay,strategyLimits.reportsStored,values)];
  await this.db.prepare(`INSERT INTO strategy_reports(author_key,request_id,sponsor_key,record_id,record_digest,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async moderate(context:Context,command:Extract<StrategyCommand,{action:'withdraw'|'moderate'}>,commandDigest:string,at:string,target:Checked){
  const history=await this.events(target);if(history.state==='WITHDRAWN')throw new StrategyError('Withdrawn strategy cannot be restored or moderated.');
  if(command.action==='withdraw'){
   if(target.row.author_key!==context.key&&(context.actor.kind!=='HUMAN'||target.row.sponsor_key!==context.sponsor))throw new StrategyError('Only the original author or sponsoring human may withdraw this strategy.',403);
   if(command.reason==='AUTHOR_REQUEST'&&target.row.author_key!==context.key||command.reason==='SPONSOR_REQUEST'&&(context.actor.kind!=='HUMAN'||target.row.sponsor_key!==context.sponsor))throw new StrategyError('Withdrawal reason does not match the participant’s authority.',403);
  }
  const maximum=command.action==='withdraw'?strategyLimits.eventsPerRecord:strategyLimits.eventsPerRecord-1;
  if(history.events.length>=maximum)throw new StrategyError(command.action==='withdraw'?'Strategy event history is full.':'Moderation history is full; its final slot is reserved for withdrawal.');
  if(Date.parse(at)<Date.parse(history.events.at(-1)?.createdAt??target.record.createdAt))throw new StrategyError('Moderation time precedes retained history.');
  const event=strategyPublicEventSchema.parse({sequence:history.events.length+1,requestId:command.requestId,createdAt:at,actor:context.reference,state:command.action==='withdraw'?'WITHDRAWN':command.state,reason:command.reason}),payload=JSON.stringify(event),digest=await strategyDigest(payload);
  const values:Values=[target.record.id,event.sequence,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,event.state,event.reason,at];
  const record=add(values,target.record.id),expected=add(values,history.events.length);
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause(target,values),`COALESCE((SELECT MAX(sequence) FROM strategy_moderation WHERE record_id=${record}),0)=${expected}`,`NOT EXISTS(SELECT 1 FROM strategy_moderation WHERE record_id=${record} AND state='WITHDRAWN')`];
  if(history.rows.length){const previous=history.rows.at(-1)!;clauses.push(`EXISTS(SELECT 1 FROM strategy_moderation WHERE record_id=${record} AND sequence=${add(values,previous.sequence)} AND digest=${add(values,previous.digest)} AND payload=${add(values,previous.payload!)})`);}
  await this.db.prepare(`INSERT INTO strategy_moderation(record_id,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
}
