import {networkAgentSchema} from './network-model';
import {ResearchError,researchLimits,researchDigest,researchPublicHumanId,researchAuthorReference,boundedResearchCommand,boundedResearchRecord,researchPublicationContent,researchPublicationVersion,researchPublishCommandForRecord,researchAuthorReferenceSchema,researchPublicEventSchema,researchPrivateReportSchema,researchListSchema,researchVentureListSchema,researchGetSchema,researchHistorySchema,researchThreadSchema,researchWriteSchema,researchReportsSchema,type ResearchActor,type ResearchAuthor,type ResearchAuthorReference,type ResearchCommand,type ResearchRecord,type ResearchPublicItem,type ResearchPublicEvent} from './research-model';
import {validateVentureSources} from './venture-model';
type PublicationRow={id:string;root_id:string;revision:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type EventRow={record_id:string;sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;state:string;reason:string;created_at:string};
type ReportRow={author_key:string;request_id:string;sponsor_key:string;record_id:string;record_digest:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type Checked={row:PublicationRow;record:ResearchRecord};
type Context={actor:ResearchActor;author:ResearchAuthor;reference:ResearchAuthorReference;key:string;sponsor:string};
type Values=(string|number)[];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const nowSql="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const limitedPayload=(maximum:number)=>`CASE WHEN length(CAST(payload AS BLOB))<=${maximum} THEN payload ELSE NULL END AS payload`;
const publicationColumns=`id,root_id,revision,author_key,sponsor_key,request_id,command_digest,${limitedPayload(researchLimits.payloadBytes)},digest,created_at`;
const eventColumns=`record_id,sequence,author_key,sponsor_key,request_id,command_digest,${limitedPayload(4096)},digest,state,reason,created_at`;
const reportColumns=`author_key,request_id,sponsor_key,record_id,record_digest,command_digest,${limitedPayload(4096)},digest,created_at`;
const inconsistent=()=>new ResearchError('Research records are inconsistent. Retained material was preserved.',503);
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new ResearchError('Invalid research timestamp.',400);}
function id(value:string){if(typeof value!=='string'||!uuid.test(value))throw new ResearchError('Invalid research identity.',400);}
const authorKey=(author:ResearchAuthorReference)=>author.kind+':'+author.id;
const add=(values:Values,value:string|number)=>{values.push(value);return '?'+values.length;};
const recordDomain=(record:ResearchRecord)=>'domain' in record.content?record.content.domain:null;
function retryAfter(at:string){const date=new Date(at);return Math.max(1,Math.ceil((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)-Date.parse(at))/1000));}

/** All submission authority is server-derived. No sources are fetched or code executed. */
export class ResearchRepository{
 constructor(private db:D1Database){}

 private async context(actor:ResearchActor,at:string):Promise<Context>{
  clock(at);
  let author:ResearchAuthor;
  if(actor?.kind==='HUMAN'){
   if(typeof actor.moderator!=='boolean')throw new ResearchError('Invalid participation context.',403);
   const sponsor=await researchPublicHumanId(actor.userId);author={kind:'HUMAN',id:sponsor,sponsorId:sponsor};
  }else if(actor?.kind==='AGENT'){
   try{
    const principal=actor.principal,sponsor=await researchPublicHumanId(principal.ownerId),agent=networkAgentSchema.parse(JSON.parse(principal.payload));
    if(agent.id!==principal.agentId||agent.credentialId!==principal.credentialId||agent.name!==principal.name||agent.expiresAt!==principal.expiresAt||agent.revision!==1||agent.revokedAt!==null||!hash.test(principal.registryDigest)||!hash.test(principal.tokenDigest)||JSON.stringify(agent)!==principal.payload||await researchDigest(principal.payload)!==principal.registryDigest||Date.parse(at)<Date.parse(agent.createdAt)||Date.parse(at)>=Date.parse(agent.expiresAt))throw Error();
    author={kind:'AGENT',id:agent.id,sponsorId:sponsor,name:agent.name};
   }catch{throw new ResearchError('Agent credential is invalid, expired or revoked.',401);}
  }else throw new ResearchError('Authentication is required to submit research.',401);
  const reference=researchAuthorReference(author);return {actor,author,reference,key:authorKey(reference),sponsor:reference.sponsorId};
 }

 private credentialClause(context:Context,at:string,values:Values){
  if(context.actor.kind!=='AGENT')return '1=1';
  const p=context.actor.principal,user=add(values,p.ownerId),agent=add(values,p.agentId),credential=add(values,p.credentialId),token=add(values,p.tokenDigest),digest=add(values,p.registryDigest),payload=add(values,p.payload),time=add(values,at);
  return `EXISTS(SELECT 1 FROM network_agents WHERE owner_id=${user} AND id=${agent} AND credential_id=${credential} AND token_digest=${token} AND digest=${digest} AND payload=${payload} AND revision=1 AND revoked_at IS NULL AND created_at<=${time} AND created_at<=${nowSql} AND expires_at>${time} AND expires_at>${nowSql})`;
 }
 private async requireCredential(context:Context,at:string){
  if(context.actor.kind==='AGENT'){
   const values:Values=[],clause=this.credentialClause(context,at,values),row=await this.db.prepare(`SELECT 1 AS active WHERE ${clause}`).bind(...values).first<{active:number}>();
   if(!row)throw new ResearchError('Agent credential is invalid, expired or revoked.',401);
  }
 }
 private requestClause(context:Context,requestId:string,values:Values){
  const author=add(values,context.key),request=add(values,requestId);
  return ['research_publications','research_moderation','research_reports'].map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE author_key=${author} AND request_id=${request})`).join(' AND ');
 }

 private async checkPublication(row:PublicationRow):Promise<Checked>{
  try{
   if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const checked=boundedResearchRecord(JSON.parse(row.payload)),record=checked.record;
   if(checked.payload!==row.payload||await researchDigest(row.payload)!==row.digest||record.id!==row.id||record.rootId!==row.root_id||record.revision!==row.revision||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(researchAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedResearchCommand(researchPublishCommandForRecord(record));
   if(await researchDigest(command.payload)!==row.command_digest)throw Error();
   return {row,record};
  }catch{throw inconsistent();}
 }
 private async publication(recordId:string):Promise<Checked>{
  id(recordId);const row=await this.db.prepare(`SELECT ${publicationColumns} FROM research_publications WHERE id=?`).bind(recordId).first<PublicationRow>();
  if(!row)throw new ResearchError('Research publication not found.',404);return this.checkPublication(row);
 }
 private async events(publication:Checked){
  const rows=(await this.db.prepare(`SELECT ${eventColumns} FROM research_moderation WHERE record_id=? ORDER BY sequence LIMIT ${researchLimits.eventsPerRecord+1}`).bind(publication.record.id).all<EventRow>()).results;
  if(rows.length>researchLimits.eventsPerRecord)throw inconsistent();
  const events:ResearchPublicEvent[]=[];let state='VISIBLE',time=publication.record.createdAt;
  for(const row of rows){
   try{
    if(!row.payload||new TextEncoder().encode(row.payload).byteLength>4096||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
    const event=researchPublicEventSchema.parse(JSON.parse(row.payload));
    if(JSON.stringify(event)!==row.payload||await researchDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==publication.record.id||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||event.reason!==row.reason||authorKey(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||state==='WITHDRAWN'||Date.parse(event.createdAt)<Date.parse(time))throw Error();
    const command=boundedResearchCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,reason:event.reason,policyAccepted:'public-research-v1'}:{action:'moderate',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:'public-research-v1'});
    if(await researchDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=researchLimits.eventsPerRecord))throw Error();
    events.push(event);state=event.state;time=event.createdAt;
   }catch{throw inconsistent();}
  }
  return {rows,events,state:state as ResearchPublicItem['state'],reason:events.at(-1)?.reason??null};
 }
 private async project(publication:Checked):Promise<ResearchPublicItem>{
  const {events,state,reason}=await this.events(publication),record=publication.record;
  return {id:record.id,digest:publication.row.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:researchAuthorReference(record.author),state,reason,record:state==='VISIBLE'?record:null,moderation:events};
 }
 private async checkReport(row:ReportRow){
  try{
   if(!row.payload||new TextEncoder().encode(row.payload).byteLength>4096||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const report=researchPrivateReportSchema.parse(JSON.parse(row.payload));
   if(JSON.stringify(report)!==row.payload||await researchDigest(row.payload)!==row.digest||report.requestId!==row.request_id||report.id!==row.record_id||report.digest!==row.record_digest||report.createdAt!==row.created_at||authorKey(report.reporter)!==row.author_key||report.reporter.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedResearchCommand({action:'report',requestId:report.requestId,id:report.id,digest:report.digest,reason:report.reason,details:report.details,policyAccepted:'public-research-v1'});
   if(await researchDigest(command.payload)!==row.command_digest)throw Error();return report;
  }catch{throw inconsistent();}
 }

 private async replay(context:Context,command:ResearchCommand,commandDigest:string,at:string){
  await this.requireCredential(context,at);
  const [publications,events,reports]=await Promise.all([
   this.db.prepare(`SELECT ${publicationColumns} FROM research_publications WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<PublicationRow>(),
   this.db.prepare(`SELECT ${eventColumns} FROM research_moderation WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<EventRow>(),
   this.db.prepare(`SELECT ${reportColumns} FROM research_reports WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<ReportRow>(),
  ]);
  if(publications.results.length+events.results.length+reports.results.length>1)throw inconsistent();
  const row=publications.results[0]??events.results[0]??reports.results[0];if(!row)return null;
  if(row.command_digest!==commandDigest)throw new ResearchError('Request ID already used for different research material.');
  let item:ResearchPublicItem|null=null,report:null|{requestId:string;id:string;digest:string;reason:string;createdAt:string}=null;
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
  return researchWriteSchema.parse({version:1,action:command.action,requestId:command.requestId,item,report,executionEnabled:false});
 }

 async list(cursor?:string|null){
  const anchor=cursor?await this.publication(cursor):null;
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM research_publications ${anchor?'WHERE created_at<? OR (created_at=? AND id<?)':''} ORDER BY created_at DESC,id DESC LIMIT ${researchLimits.page+1}`).bind(...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  const page=rows.slice(0,researchLimits.page),items=await Promise.all(page.map(async row=>this.project(await this.checkPublication(row))));
  return researchListSchema.parse({version:1,items,nextCursor:rows.length>researchLimits.page?page.at(-1)!.id:null,executionEnabled:false});
 }
 async ventures(cursor?:string|null){
  if(cursor!==undefined&&cursor!==null)id(cursor);
  const anchor=cursor?await this.publication(cursor):null;
  if(anchor&&(anchor.record.version!==2||recordDomain(anchor.record)!=='VENTURE'))throw new ResearchError('Venture research cursor not found.',404);
  let rows:PublicationRow[];
  try{rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM research_publications WHERE json_extract(payload,'$.version')=2 AND json_extract(payload,'$.content.domain')='VENTURE' ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${researchLimits.page+1}`).bind(...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;}catch{throw inconsistent();}
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row)));
  if(checked.some(item=>item.record.version!==2||recordDomain(item.record)!=='VENTURE')||new Set(checked.map(item=>item.record.id)).size!==checked.length||new Set(checked.map(item=>`${item.record.rootId}:${item.record.revision}`)).size!==checked.length)throw inconsistent();
  for(let n=0;n<checked.length;n++){
   const previous=n?checked[n-1]:anchor,current=checked[n];
   if(previous&&(current.record.createdAt>previous.record.createdAt||(current.record.createdAt===previous.record.createdAt&&current.record.id>=previous.record.id)))throw inconsistent();
  }
  const page=checked.slice(0,researchLimits.page),items=await Promise.all(page.map(item=>this.project(item)));
  return researchVentureListSchema.parse({version:1,domain:'VENTURE',items,nextCursor:checked.length>researchLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 async get(recordId:string){return researchGetSchema.parse({version:1,item:await this.project(await this.publication(recordId)),executionEnabled:false});}
 async thread(targetId:string,digest:string,cursor?:string|null){
  id(targetId);if(typeof digest!=='string'||!hash.test(digest))throw new ResearchError('Invalid research target digest.',400);
  if(cursor!==undefined&&cursor!==null)id(cursor);
  const publication=await this.publication(targetId);
  if(publication.row.digest!==digest)throw new ResearchError('Exact research target not found.',404);
  const isChild=(child:Checked)=>{
   const relation=child.record.content.relation;
   if(child.record.id===targetId||relation?.id!==targetId||relation.digest!==digest)return false;
   if(Date.parse(child.record.createdAt)<Date.parse(publication.record.createdAt)||relation.type==='REVISION'&&(child.record.rootId!==publication.record.rootId||child.record.revision!==publication.record.revision+1||JSON.stringify(researchAuthorReference(child.record.author))!==JSON.stringify(researchAuthorReference(publication.record.author))||child.record.content.kind!==publication.record.content.kind||child.record.version!==publication.record.version||recordDomain(child.record)!==recordDomain(publication.record)))throw inconsistent();
   return true;
  };
  const anchor=cursor?await this.publication(cursor):null;
  if(anchor&&!isChild(anchor))throw new ResearchError('Exact research thread cursor not found.',404);
  let target=await this.project(publication);
  if(target.state!=='VISIBLE')return researchThreadSchema.parse({version:1,target,items:[],nextCursor:null,executionEnabled:false});
  const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM research_publications WHERE json_extract(payload,'$.content.relation.id')=? AND json_extract(payload,'$.content.relation.digest')=? AND json_extract(payload,'$.content.relation.type') IN ('REVISION','FORK','CHALLENGE') ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${researchLimits.page+1}`).bind(targetId,digest,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<PublicationRow>()).results;
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row)));
  if(checked.some(child=>!isChild(child))||new Set(checked.map(child=>child.record.id)).size!==checked.length||new Set(checked.map(child=>`${child.record.rootId}:${child.record.revision}`)).size!==checked.length)throw inconsistent();
  for(let n=0;n<checked.length;n++){
   const previous=n?checked[n-1]:anchor,current=checked[n];
   if(previous&&(current.record.createdAt>previous.record.createdAt||(current.record.createdAt===previous.record.createdAt&&current.record.id>=previous.record.id)))throw inconsistent();
  }
  const page=checked.slice(0,researchLimits.page),items=await Promise.all(page.map(child=>this.project(child)));
  // A disposition observed after child projection takes precedence over the earlier visible body.
  target=await this.project(await this.publication(targetId));
  if(target.digest!==digest)throw inconsistent();
  if(target.state!=='VISIBLE')return researchThreadSchema.parse({version:1,target,items:[],nextCursor:null,executionEnabled:false});
  return researchThreadSchema.parse({version:1,target,items,nextCursor:checked.length>researchLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 async history(rootId:string){
  id(rootId);const rows=(await this.db.prepare(`SELECT ${publicationColumns} FROM research_publications WHERE root_id=? ORDER BY revision LIMIT ${researchLimits.revisions+1}`).bind(rootId).all<PublicationRow>()).results;
  if(!rows.length)throw new ResearchError('Research history not found.',404);if(rows.length>researchLimits.revisions)throw inconsistent();
  const checked=await Promise.all(rows.map(row=>this.checkPublication(row)));const first=checked[0];
  for(let n=0;n<checked.length;n++){const item=checked[n];if(item.record.revision!==n+1||item.record.rootId!==rootId||JSON.stringify(researchAuthorReference(item.record.author))!==JSON.stringify(researchAuthorReference(first.record.author))||item.record.content.kind!==first.record.content.kind||item.record.version!==first.record.version||recordDomain(item.record)!==recordDomain(first.record)||n>0&&(item.record.content.relation?.id!==checked[n-1].record.id||item.record.content.relation?.digest!==checked[n-1].row.digest||Date.parse(item.record.createdAt)<Date.parse(checked[n-1].record.createdAt)))throw inconsistent();}
  return researchHistorySchema.parse({version:1,items:await Promise.all(checked.reverse().map(item=>this.project(item))),executionEnabled:false});
 }
 async reports(actor:ResearchActor,at:string,cursor?:string|null){
  const context=await this.context(actor,at);if(context.actor.kind!=='HUMAN'||!context.actor.moderator)throw new ResearchError('Explicit moderator authorization is required.',403);
  if(cursor!==undefined&&cursor!==null&&(typeof cursor!=='string'||!hash.test(cursor)))throw new ResearchError('Invalid private report cursor.',400);
  let anchor:ReportRow|null=null;
  if(cursor){
   const anchors=(await this.db.prepare(`SELECT ${reportColumns} FROM research_reports WHERE digest=? LIMIT 2`).bind(cursor).all<ReportRow>()).results;
   if(!anchors.length)throw new ResearchError('Private report cursor not found.',404);if(anchors.length!==1)throw inconsistent();
   await this.checkReport(anchors[0]);anchor=anchors[0];
  }
  const rows=(await this.db.prepare(`SELECT ${reportColumns} FROM research_reports ${anchor?'WHERE created_at<? OR (created_at=? AND author_key<?) OR (created_at=? AND author_key=? AND request_id<?)':''} ORDER BY created_at DESC,author_key DESC,request_id DESC LIMIT ${researchLimits.page+1}`).bind(...anchor?[anchor.created_at,anchor.created_at,anchor.author_key,anchor.created_at,anchor.author_key,anchor.request_id]:[]).all<ReportRow>()).results;
  if(new Set(rows.map(row=>row.digest)).size!==rows.length)throw inconsistent();
  const checked=await Promise.all(rows.map(row=>this.checkReport(row))),page=checked.slice(0,researchLimits.page);
  return researchReportsSchema.parse({version:1,reports:page,nextCursor:rows.length>researchLimits.page?rows[researchLimits.page-1].digest:null,executionEnabled:false});
 }

 private targetClause(target:Checked,values:Values){const record=add(values,target.record.id),digest=add(values,target.row.digest),payload=add(values,target.row.payload!);return `EXISTS(SELECT 1 FROM research_publications WHERE id=${record} AND digest=${digest} AND payload=${payload})`;}
 private visibleClause(recordId:string,values:Values){const record=add(values,recordId);return `COALESCE((SELECT state FROM research_moderation WHERE record_id=${record} ORDER BY sequence DESC LIMIT 1),'VISIBLE')='VISIBLE'`;}
 private async quota(context:Context,at:string,table:'research_publications'|'research_reports',daily:number,total:number){
  const result=await this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN sponsor_key=? AND substr(created_at,1,10)=? THEN 1 ELSE 0 END),0) AS daily FROM ${table}`).bind(context.sponsor,at.slice(0,10)).first<{total:number;daily:number}>();
  if(!result)throw inconsistent();if(result.total>=total)throw new ResearchError('The retained beta research capacity has been reached. No automatic reset is promised.',429);
  if(result.daily>=daily)throw new ResearchError('The sponsor’s shared UTC-day submission limit has been reached.',429,retryAfter(at));
 }
 private quotaClauses(context:Context,at:string,table:'research_publications'|'research_reports',daily:number,total:number,values:Values){
  const sponsor=add(values,context.sponsor),date=add(values,at.slice(0,10));
  return [`(SELECT COUNT(*) FROM ${table})<${total}`,`(SELECT COUNT(*) FROM ${table} WHERE sponsor_key=${sponsor} AND substr(created_at,1,10)=${date})<${daily}`];
 }

 async write(actor:ResearchActor,raw:unknown,at:string){
  const context=await this.context(actor,at);await this.requireCredential(context,at);
  let parsed:ReturnType<typeof boundedResearchCommand>;try{parsed=boundedResearchCommand(raw);}catch(error){if(error instanceof ResearchError)throw error;throw new ResearchError('Invalid research command.',400);}
  const {command,payload:commandPayload}=parsed;
  if(command.action==='moderate'&&(context.actor.kind!=='HUMAN'||!context.actor.moderator))throw new ResearchError('Explicit moderator authorization is required.',403);
  const commandDigest=await researchDigest(commandPayload),saved=await this.replay(context,command,commandDigest,at);if(saved)return saved;
  if(command.action==='publish'&&researchPublicationVersion(command)===2){try{const publication=researchPublicationContent(command);if('venture' in publication)validateVentureSources(publication.venture,publication.sources,at);}catch{throw new ResearchError('Invalid venture source references or observation dates.',400);}}
  let target:Checked|undefined;
  if(command.action==='publish'&&command.relation)target=await this.publication(command.relation.id);
  if(command.action!=='publish')target=await this.publication(command.id);
  if(target){const expected=command.action==='publish'?command.relation!.digest:command.digest;if(target.row.digest!==expected)throw new ResearchError('Exact research target not found.',404);if(Date.parse(at)<Date.parse(target.record.createdAt))throw new ResearchError('Submission time precedes its target.');}
  try{
   if(command.action==='publish')await this.publish(context,command,commandDigest,at,target);
   else if(command.action==='report')await this.report(context,command,commandDigest,at,target!);
   else await this.moderate(context,command,commandDigest,at,target!);
  }catch(error){const replay=await this.replay(context,command,commandDigest,at);if(replay)return replay;throw error;}
  const receipt=await this.replay(context,command,commandDigest,at);if(receipt)return receipt;
  await this.requireCredential(context,at);
  if(command.action==='publish')await this.quota(context,at,'research_publications',researchLimits.publishPerSponsorDay,researchLimits.stored);
  if(command.action==='report')await this.quota(context,at,'research_reports',researchLimits.reportsPerSponsorDay,researchLimits.reportsStored);
  throw new ResearchError('Research identity, target, moderation state or quota changed. Refresh before retrying; no submission was confirmed.');
 }

 private async publish(context:Context,command:Extract<ResearchCommand,{action:'publish'}>,commandDigest:string,at:string,parent?:Checked){
  await this.quota(context,at,'research_publications',researchLimits.publishPerSponsorDay,researchLimits.stored);
  let rootId=command.id,revision=1;
  if(parent){
   const projected=await this.project(parent);if(projected.state!=='VISIBLE')throw new ResearchError('Referenced research is not visible.');
   if(command.relation!.type==='REVISION'){
    if(parent.row.author_key!==context.key)throw new ResearchError('Only the original author can revise this research.',403);
    if(parent.record.content.kind!==command.kind)throw new ResearchError('A revision must preserve its original research kind.');
    const nextContent=researchPublicationContent(command);
    if(parent.record.version!==researchPublicationVersion(command)||recordDomain(parent.record)!==('domain' in nextContent?nextContent.domain:null))throw new ResearchError('A revision must preserve its original research version and domain.');
    rootId=parent.record.rootId;revision=parent.record.revision+1;if(revision>researchLimits.revisions)throw new ResearchError('Research revision limit reached.');
    const current=await this.db.prepare('SELECT MAX(revision) AS head FROM research_publications WHERE root_id=?').bind(rootId).first<{head:number}>();if(current?.head!==parent.record.revision)throw new ResearchError('Research has a newer revision. Refresh its history.');
   }
  }
  const {record,payload}=boundedResearchRecord({version:researchPublicationVersion(command),id:command.id,rootId,revision,requestId:command.requestId,createdAt:at,author:context.author,content:researchPublicationContent(command),policyAccepted:command.policyAccepted,verification:'UNVERIFIED',executionEnabled:false}),digest=await researchDigest(payload);
  const values:Values=[record.id,rootId,revision,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),...this.quotaClauses(context,at,'research_publications',researchLimits.publishPerSponsorDay,researchLimits.stored,values)];
  if(parent){clauses.push(this.targetClause(parent,values),this.visibleClause(parent.record.id,values));if(command.relation!.type==='REVISION')clauses.push(`(SELECT MAX(revision) FROM research_publications WHERE root_id=?2)=${add(values,parent.record.revision)}`);}
  await this.db.prepare(`INSERT INTO research_publications(id,root_id,revision,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async report(context:Context,command:Extract<ResearchCommand,{action:'report'}>,commandDigest:string,at:string,target:Checked){
  await this.quota(context,at,'research_reports',researchLimits.reportsPerSponsorDay,researchLimits.reportsStored);
  const report=researchPrivateReportSchema.parse({requestId:command.requestId,id:target.record.id,digest:target.row.digest,reason:command.reason,details:command.details,createdAt:at,reporter:context.reference}),payload=JSON.stringify(report);if(new TextEncoder().encode(payload).byteLength>4096)throw new ResearchError('Private report is too large. Shorten its details.',413);const digest=await researchDigest(payload);
  const values:Values=[context.key,command.requestId,context.sponsor,target.record.id,target.row.digest,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause(target,values),...this.quotaClauses(context,at,'research_reports',researchLimits.reportsPerSponsorDay,researchLimits.reportsStored,values)];
  await this.db.prepare(`INSERT INTO research_reports(author_key,request_id,sponsor_key,record_id,record_digest,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async moderate(context:Context,command:Extract<ResearchCommand,{action:'withdraw'|'moderate'}>,commandDigest:string,at:string,target:Checked){
  const history=await this.events(target);if(history.state==='WITHDRAWN')throw new ResearchError('Withdrawn research cannot be restored or moderated.');
  if(command.action==='withdraw'){
   if(target.row.author_key!==context.key&&(context.actor.kind!=='HUMAN'||target.row.sponsor_key!==context.sponsor))throw new ResearchError('Only the original author or sponsoring human may withdraw this research.',403);
   if(command.reason==='AUTHOR_REQUEST'&&target.row.author_key!==context.key||command.reason==='SPONSOR_REQUEST'&&(context.actor.kind!=='HUMAN'||target.row.sponsor_key!==context.sponsor))throw new ResearchError('Withdrawal reason does not match the participant’s authority.',403);
  }
  const maximum=command.action==='withdraw'?researchLimits.eventsPerRecord:researchLimits.eventsPerRecord-1;
  if(history.events.length>=maximum)throw new ResearchError(command.action==='withdraw'?'Research event history is full.':'Moderation history is full; its final slot is reserved for withdrawal.');
  if(Date.parse(at)<Date.parse(history.events.at(-1)?.createdAt??target.record.createdAt))throw new ResearchError('Moderation time precedes retained history.');
  const event=researchPublicEventSchema.parse({sequence:history.events.length+1,requestId:command.requestId,createdAt:at,actor:context.reference,state:command.action==='withdraw'?'WITHDRAWN':command.state,reason:command.reason}),payload=JSON.stringify(event),digest=await researchDigest(payload);
  const values:Values=[target.record.id,event.sequence,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,event.state,event.reason,at];
  const record=add(values,target.record.id),expected=add(values,history.events.length);
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause(target,values),`COALESCE((SELECT MAX(sequence) FROM research_moderation WHERE record_id=${record}),0)=${expected}`,`NOT EXISTS(SELECT 1 FROM research_moderation WHERE record_id=${record} AND state='WITHDRAWN')`];
  if(history.rows.length){const previous=history.rows.at(-1)!;clauses.push(`EXISTS(SELECT 1 FROM research_moderation WHERE record_id=${record} AND sequence=${add(values,previous.sequence)} AND digest=${add(values,previous.digest)} AND payload=${add(values,previous.payload!)})`);}
  await this.db.prepare(`INSERT INTO research_moderation(record_id,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
}
