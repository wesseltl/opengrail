import {networkAgentSchema,networkLimits} from './network-model';
import {researchDigest,researchPublicHumanId,researchAuthorReferenceSchema,type ResearchAuthorReference} from './research-model';
import * as C from './contribution-model';
import {ContributionRepository} from './contribution-store';
import * as M from './task-discussion-model';

type Row=Record<string,string|number|null> & {payload:string|null;digest:string;command_digest:string;author_key:string;sponsor_key:string;request_id:string;created_at:string};
type Values=(string|number)[];
type Context={actor:M.TaskDiscussionActor;author:ResearchAuthorReference;key:string;sponsor:string};
type Task={row:Row;rows:Row[];item:C.ContributionTaskItem};
type Message={row:Row;record:M.TaskDiscussionRecord;rows:Row[];events:M.TaskDiscussionEvent[]};
type Claim={row:Row;rows:Row[];dependencies?:{row:Row;rows:Row[]}[]};
const tables=['task_discussion_messages','task_discussion_events','task_discussion_reports'] as const;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const nowSql="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const key=(author:ResearchAuthorReference)=>author.kind+':'+author.id;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const future=(value:string,at:string)=>value>at&&Date.parse(value)>Date.now();
const add=(values:Values,value:string|number)=>{values.push(value);return '?'+values.length;};
const inconsistent=()=>new M.TaskDiscussionError('Retained discussion records are inconsistent.',503);
const conflict=()=>new M.TaskDiscussionError('Discussion identity, lifecycle or dependencies changed.',409);
const limited=(maximum:number)=>`CASE WHEN length(CAST(payload AS BLOB))<=${maximum} THEN payload ELSE NULL END AS payload`;
const base=['author_key','sponsor_key','request_id','command_digest','payload','digest','created_at'];
const columns:Record<string,string[]>={
 contribution_tasks:['id',...base],
 contribution_task_events:['task_id','sequence',...base,'state','reason'],
 contribution_claims:['id','task_id','task_digest','task_sequence',...base,'expires_at'],
 contribution_claim_events:['claim_id','sequence',...base,'state','reason'],
 task_discussion_messages:['id','task_id','task_digest','expected_task_sequence','claim_id','claim_digest','reply_id','reply_digest','kind',...base],
 task_discussion_events:['message_id','sequence','task_id','task_digest','message_digest',...base,'action','state','reason'],
 task_discussion_reports:['task_id','task_digest','message_id','message_digest','category',...base]
};
const bound=(table:string)=>table==='task_discussion_messages'?M.taskDiscussionLimits.recordBytes:table==='task_discussion_events'?M.taskDiscussionLimits.eventBytes:table==='task_discussion_reports'?M.taskDiscussionLimits.reportBytes:table.endsWith('_events')?4096:12288;
const select=(table:string)=>columns[table].map(column=>column==='payload'?limited(bound(table)):column).join(',');
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new M.TaskDiscussionError('Invalid discussion timestamp.',400);}
function identity(id:string){if(typeof id!=='string'||!uuid.test(id))throw new M.TaskDiscussionError('Invalid discussion identity.',400);}
function digest(value:string){if(typeof value!=='string'||!hash.test(value))throw new M.TaskDiscussionError('Invalid discussion digest.',400);}
function retryAfter(at:string){const d=new Date(at);return Math.max(1,Math.ceil((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)-Date.parse(at))/1000));}

/** Retained public prose and private reports only. This writer grants no execution
 * or contribution disposition and shares no legacy namespace or quota pool. */
export class TaskDiscussionRepository{
 constructor(private db:D1Database){}
 private async rows(table:string,where:string,args:Values,order:string,maximum:number){
  const rows=(await this.db.prepare(`SELECT ${select(table)} FROM ${table} WHERE ${where} ORDER BY ${order} LIMIT ${maximum+1}`).bind(...args).all<Row>()).results;
  if(rows.length>maximum)throw inconsistent();return rows;
 }
 private async canonical<T>(row:Row,builder:(raw:unknown)=>{record:T;payload:string},command:(record:T)=>unknown){
  try{if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const checked=builder(JSON.parse(row.payload));
   if(checked.payload!==row.payload||await researchDigest(row.payload)!==row.digest)throw Error();
   const record=checked.record as T&{author?:ResearchAuthorReference;actor?:ResearchAuthorReference;reporter?:ResearchAuthorReference;requestId:string;createdAt:string};
   const author=record.author??record.actor??record.reporter;
   if(!author||key(author)!==row.author_key||author.sponsorId!==row.sponsor_key||record.requestId!==row.request_id||record.createdAt!==row.created_at||await researchDigest(JSON.stringify(command(checked.record)))!==row.command_digest)throw Error();return checked.record;
  }catch{throw inconsistent();}
 }
 private async task(id:string,at:string):Promise<Task>{
  identity(id);const rows=await this.rows('contribution_tasks','id=?',[id],'id',1);if(!rows.length)throw new M.TaskDiscussionError('Exact contribution task not found.',404);const row=rows[0];
  const record=await this.canonical(row,C.boundedContributionTaskRecord,r=>C.boundedContributionCommand(C.contributionTaskCommandForRecord(r)).command);
  if(record.id!==id||future(record.createdAt,at))throw inconsistent();const history=await this.rows('contribution_task_events','task_id=?',[id],'sequence',C.contributionLimits.taskEvents),events:C.ContributionTaskEvent[]=[];
  for(const eventRow of history){const event=await this.canonical(eventRow,C.boundedContributionTaskEventRecord,r=>C.boundedContributionCommand(C.contributionEventCommandForRecord(r)).command);
   if(event.task.id!==id||event.task.digest!==row.digest||event.sequence!==eventRow.sequence||event.state!==eventRow.state||event.reason!==eventRow.reason||future(event.createdAt,at))throw inconsistent();events.push({...event,digest:eventRow.digest});}
  const state=events.at(-1)?.state??'OPEN';let item:C.ContributionTaskItem;
  try{item=await C.validateContributionTaskItem({id,digest:row.digest,requestId:record.requestId,createdAt:record.createdAt,author:record.author,state,sequence:events.length,reason:events.at(-1)?.reason??null,record:state==='HIDDEN'?null:record,events});}catch{throw inconsistent();}
  return {row,rows:history,item};
 }
 private async exactTask(reference:{id:string;digest:string},at:string){const task=await this.task(reference.id,at);if(task.row.digest!==reference.digest)throw new M.TaskDiscussionError('Exact contribution task not found.',404);return task;}
 private async retained<T>(operation:()=>Promise<T>){try{return await operation();}catch(error){if(error instanceof M.TaskDiscussionError&&error.status===404)throw inconsistent();throw error;}}
 private async claim(reference:{id:string;digest:string},task:Task,at:string){
  const rows=await this.rows('contribution_claims','id=?',[reference.id],'id',1);if(!rows.length)throw new M.TaskDiscussionError('Exact contribution claim not found.',404);const row=rows[0];
  const record=await this.canonical(row,C.boundedContributionClaimRecord,r=>C.boundedContributionCommand(C.contributionClaimCommandForRecord(r,Number(row.task_sequence))).command);
  if(record.id!==row.id||record.task.id!==row.task_id||record.task.digest!==row.task_digest||record.expiresAt!==row.expires_at||row.task_sequence!==0)throw inconsistent();
  if(row.digest!==reference.digest||row.task_id!==task.row.id||row.task_digest!==task.row.digest)throw new M.TaskDiscussionError('Exact same-task claim not found.',404);
  const history=await this.rows('contribution_claim_events','claim_id=?',[reference.id],'sequence',C.contributionLimits.claimEvents),events:C.ContributionClaimEvent[]=[];
  for(const e of history){const event=await this.canonical(e,C.boundedContributionClaimEventRecord,r=>C.boundedContributionCommand(C.contributionEventCommandForRecord(r)).command);
   if(!same(event.task,record.task)||event.claim.id!==row.id||event.claim.digest!==row.digest||event.sequence!==e.sequence||event.state!==e.state||(event.reason??'')!==e.reason||future(event.createdAt,at))throw inconsistent();events.push({...event,digest:e.digest});}
  const last=events.at(-1),base=last?.state??'ACTIVE',status=(base==='ACTIVE'||base==='SUBMITTED')&&at>=record.expiresAt?'EXPIRED':base;
  try{await C.validateContributionClaimItem({id:row.id,digest:row.digest,requestId:record.requestId,createdAt:record.createdAt,expiresAt:record.expiresAt,checkedAt:at,author:record.author,task:record.task,taskState:task.item.state==='HIDDEN'?'CLOSED':task.item.state,sequence:events.length,status,handoffDigest:events.find(e=>e.action==='submit')?.handoffDigest??null,reason:last?.reason??null,record,events});}catch{throw inconsistent();}
  if(record.createdAt<task.item.createdAt||future(record.createdAt,at)||task.rows.some(e=>String(e.created_at)<record.createdAt)||events.some(e=>e.action!=='release'&&task.rows.some(p=>String(p.created_at)<e.createdAt)))throw inconsistent();
  let dependencies:NonNullable<Claim['dependencies']>=[];if(record.version===2){try{dependencies=await new ContributionRepository(this.db).revisionDependencies(record,at);}catch{throw inconsistent();}}return {row,rows:history,dependencies};
 }
 private async messageRow(row:Row,at:string):Promise<Message>{
  const record=await this.canonical(row,M.boundedTaskDiscussionRecord,r=>M.boundedTaskDiscussionCommand(M.taskDiscussionCommandForRecord(r,Number(row.expected_task_sequence))).command);
  if(record.id!==row.id||!same(record.task,{id:row.task_id,digest:row.task_digest})||record.claim?.id!==(row.claim_id??undefined)||record.claim?.digest!==(row.claim_digest??undefined)||record.replyTo?.id!==(row.reply_id??undefined)||record.replyTo?.digest!==(row.reply_digest??undefined)||record.kind!==row.kind||future(record.createdAt,at)||row.expected_task_sequence!==0)throw inconsistent();
  const rows=await this.rows('task_discussion_events','message_id=?',[record.id],'sequence',M.taskDiscussionLimits.eventsPerMessage),events:M.TaskDiscussionEvent[]=[];
  for(const row of rows){const event=await this.canonical(row,M.boundedTaskDiscussionEvent,r=>M.boundedTaskDiscussionCommand({action:r.action,requestId:r.requestId,task:r.task,message:r.message,expectedSequence:r.expectedSequence,reason:r.reason,policyAccepted:r.policyAccepted}).command);
   if(!same(event.task,record.task)||!same(event.message,{id:record.id,digest:await researchDigest(M.boundedTaskDiscussionRecord(record).payload)})||row.message_id!==record.id||row.message_digest!==event.message.digest||row.task_id!==record.task.id||row.task_digest!==record.task.digest||event.sequence!==row.sequence||event.action!==row.action||event.state!==row.state||event.reason!==row.reason||future(event.createdAt,at))throw inconsistent();events.push({...event,digest:row.digest});}
  return {row,record,rows,events};
 }
 private async message(id:string,at:string){identity(id);const rows=await this.rows('task_discussion_messages','id=?',[id],'id',1);if(!rows.length)throw new M.TaskDiscussionError('Exact discussion message not found.',404);return this.messageRow(rows[0],at);}
 private async project(message:Message,task:Task){
  const own=message.events.at(-1)?.state??'VISIBLE';
  try{return await M.validateTaskDiscussionItem({id:message.record.id,digest:message.row.digest,requestId:message.record.requestId,createdAt:message.record.createdAt,author:message.record.author,task:message.record.task,taskState:task.item.state,sequence:message.events.length,state:own==='WITHDRAWN'?'WITHDRAWN':task.item.state==='HIDDEN'?'HIDDEN':own,reason:message.events.at(-1)?.reason??null,record:task.item.state==='HIDDEN'||message.events.length?null:message.record,events:message.events});}catch{throw inconsistent();}
 }
 private advance(before:Row[],after:Row[]){if(after.length<before.length||before.some((row,i)=>!same(row,after[i])))throw inconsistent();}
 private async stableTask(before:Task,at:string){const after=await this.task(String(before.row.id),at);if(!same(before.row,after.row))throw inconsistent();this.advance(before.rows,after.rows);return after;}
 private async stableMessage(before:Message,at:string){const after=await this.message(before.record.id,at);if(!same(before.row,after.row))throw inconsistent();this.advance(before.rows,after.rows);return after;}
 private async dependencies(message:Message,task:Task,at:string){
  if(!same(message.record.task,{id:task.row.id,digest:task.row.digest})||message.record.createdAt<task.item.createdAt||task.rows.some(e=>String(e.created_at)<message.record.createdAt))throw inconsistent();
  const claims:Claim[]=[],replies:Message[]=[];
  if(message.record.claim){const claim=await this.retained(()=>this.claim(message.record.claim!,task,at));if(String(claim.row.created_at)>message.record.createdAt)throw inconsistent();claims.push(claim);}
  if(message.record.replyTo){const reply=await this.retained(()=>this.message(message.record.replyTo!.id,at));if(reply.row.digest!==message.record.replyTo.digest||!same(reply.record.task,message.record.task)||reply.record.createdAt>message.record.createdAt||reply.record.id===message.record.id||reply.events.some(e=>e.createdAt<message.record.createdAt))throw inconsistent();await this.project(reply,task);replies.push(reply);}
  await this.project(message,task);return {claims,replies};
 }
 private headsPin(table:string,column:string,heads:{id:string;sequence:number}[],values:Values){if(!heads.length)return '1=1';return `NOT EXISTS(SELECT 1 FROM json_each(${add(values,JSON.stringify(heads))}) expected WHERE (SELECT COUNT(*) FROM ${table} WHERE ${column}=json_extract(expected.value,'$.id'))<>json_extract(expected.value,'$.sequence'))`;}
 private snapshotPins(task:Task,messages:Message[],claims:Claim[],values:Values){const closure=claims.flatMap(claim=>[claim,...(claim.dependencies??[])]);return [this.taskPin(task,values),this.pin(tables[0],messages.map(m=>m.row),values),this.pin(tables[1],messages.flatMap(m=>m.rows),values),this.headsPin(tables[1],'message_id',messages.map(m=>({id:m.record.id,sequence:m.rows.length})),values),this.pin('contribution_claims',closure.map(c=>c.row),values),this.pin('contribution_claim_events',closure.flatMap(c=>c.rows),values),this.headsPin('contribution_claim_events','claim_id',closure.map(c=>({id:String(c.row.id),sequence:c.rows.length})),values)];}
 private revisionClaimsPin(claims:Claim[],values:Values){const linked=claims.filter(claim=>claim.dependencies?.length),closure=linked.flatMap(claim=>[claim,...(claim.dependencies??[])]);return closure.length?[this.pin('contribution_claims',closure.map(c=>c.row),values),this.pin('contribution_claim_events',closure.flatMap(c=>c.rows),values),this.headsPin('contribution_claim_events','claim_id',closure.map(c=>({id:String(c.row.id),sequence:c.rows.length})),values)]:[];}
 private async publicSnapshot(before:Message[],parent:Task,at:string){
  // One final SELECT observes all visibility heads and immutable dependencies
  // together. Bounded read reconciliation never performs another write.
  for(let n=0;n<5;n++){
   const messages=await Promise.all(before.map(m=>this.stableMessage(m,at))),task=await this.stableTask(parent,at),claims:Claim[]=[],replies:Message[]=[];
   for(const message of messages){const dependencies=await this.dependencies(message,task,at);claims.push(...dependencies.claims);replies.push(...dependencies.replies);}
   const all=[...messages,...replies],uniqueClaims=[...new Map(claims.map(c=>[String(c.row.id),c])).values()],uniqueMessages=[...new Map(all.map(m=>[m.record.id,m])).values()];
   // If a shared dependency advanced between two validations, reconcile before
   // deduplicating it; neither older content nor a mixed history may escape.
   if(all.some(m=>!same(m.row,uniqueMessages.find(x=>x.record.id===m.record.id)!.row)||!same(m.rows,uniqueMessages.find(x=>x.record.id===m.record.id)!.rows))||claims.some(c=>!same(c.row,uniqueClaims.find(x=>x.row.id===c.row.id)!.row)||!same(c.rows,uniqueClaims.find(x=>x.row.id===c.row.id)!.rows))){before=messages;parent=task;continue;}
   const values:Values=[],clauses=this.snapshotPins(task,uniqueMessages,uniqueClaims,values);
   if(await this.db.prepare(`SELECT 1 AS discussion_stable WHERE ${clauses.join(' AND ')}`).bind(...values).first())return {messages,task,allMessages:uniqueMessages,claims:uniqueClaims};before=messages;parent=task;
  }throw inconsistent();
 }
 private async readMessage(id:string,at:string){
  clock(at);at=new Date(Math.max(Date.parse(at),Date.now())).toISOString();const message=await this.message(id,at),task=await this.retained(()=>this.exactTask(message.record.task,at));await this.dependencies(message,task,at);
  const snapshot=await this.publicSnapshot([message],task,at),read=M.taskDiscussionGetSchema.parse({version:1,task:snapshot.task.item,item:await this.project(snapshot.messages[0],snapshot.task),executionEnabled:false});return {snapshot,read};
 }
 async get(id:string,at=new Date().toISOString()){return (await this.readMessage(id,at)).read;}
 async list(taskId:string,taskDigest:string,cursor:string|null=null,at=new Date().toISOString()){
  clock(at);at=new Date(Math.max(Date.parse(at),Date.now())).toISOString();digest(taskDigest);if(cursor!==null)identity(cursor);const task=await this.exactTask({id:taskId,digest:taskDigest},at);
  // Each task has a small retained maximum. Validate the complete scope, including
  // off-page rows, before selecting a page so corruption cannot silently omit work.
  const rows=await this.rows('task_discussion_messages','task_id=?',[taskId],'created_at DESC,id DESC',M.taskDiscussionLimits.messagesPerTask),messages=await Promise.all(rows.map(row=>this.messageRow(row,at)));
  for(const message of messages)await this.dependencies(message,task,at);
  let start=0;if(cursor){const index=messages.findIndex(m=>m.record.id===cursor);if(index<0)throw new M.TaskDiscussionError('Exact discussion cursor not found.',404);start=index+1;}
  const snapshot=await this.publicSnapshot(messages,task,at),current=snapshot.messages,parent=snapshot.task,page=current.slice(start,start+M.taskDiscussionLimits.page),items=[];
  for(const message of page)items.push(await this.project(message,parent));return M.taskDiscussionListSchema.parse({version:1,task:parent.item,items,nextCursor:current.length>start+page.length?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 private async context(actor:M.TaskDiscussionActor,at:string):Promise<Context>{
  clock(at);let author:ResearchAuthorReference;
  if(actor?.kind==='HUMAN'){if(typeof actor.maintainer!=='boolean')throw new M.TaskDiscussionError('Invalid discussion authority.',403);const id=await researchPublicHumanId(actor.userId);author={kind:'HUMAN',id,sponsorId:id};}
  else if(actor?.kind==='AGENT'){try{const p=actor.principal;if(typeof p.payload!=='string'||new TextEncoder().encode(p.payload).byteLength>networkLimits.payloadBytes)throw Error();const agent=networkAgentSchema.parse(JSON.parse(p.payload)),sponsor=await researchPublicHumanId(p.ownerId);
   if(agent.id!==p.agentId||agent.credentialId!==p.credentialId||agent.name!==p.name||agent.expiresAt!==p.expiresAt||agent.revision!==1||agent.revokedAt!==null||!hash.test(p.registryDigest)||!hash.test(p.tokenDigest)||JSON.stringify(agent)!==p.payload||await researchDigest(p.payload)!==p.registryDigest||at<agent.createdAt||at>=agent.expiresAt)throw Error();author={kind:'AGENT',id:agent.id,sponsorId:sponsor};
  }catch{throw new M.TaskDiscussionError('Agent credential is invalid, expired or revoked.',401);}}
  else throw new M.TaskDiscussionError('Authentication required.',401);return {actor,author:researchAuthorReferenceSchema.parse(author),key:key(author),sponsor:author.sponsorId};
 }
 private credential(context:Context,at:string,values:Values){if(context.actor.kind!=='AGENT')return '1=1';const p=context.actor.principal;
  return `EXISTS(SELECT 1 FROM network_agents WHERE owner_id=${add(values,p.ownerId)} AND id=${add(values,p.agentId)} AND credential_id=${add(values,p.credentialId)} AND token_digest=${add(values,p.tokenDigest)} AND digest=${add(values,p.registryDigest)} AND payload=${add(values,p.payload)} AND revision=1 AND revoked_at IS NULL AND created_at<=${add(values,at)} AND created_at<=${nowSql} AND expires_at>${add(values,at)} AND expires_at>${nowSql})`;
 }
 private async requireCredential(context:Context,at:string){if(context.actor.kind==='AGENT'){const values:Values=[],clause=this.credential(context,at,values);if(!await this.db.prepare(`SELECT 1 AS active WHERE ${clause}`).bind(...values).first())throw new M.TaskDiscussionError('Agent credential is invalid, expired or revoked.',401);}}
 private namespace(context:Context,id:string,values:Values){const actor=add(values,context.key),request=add(values,id);return tables.map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE author_key=${actor} AND request_id=${request})`).join(' AND ');}
 private pin(table:string,rows:Row[],values:Values){if(!rows.length)return '1=1';return `NOT EXISTS(SELECT 1 FROM json_each(${add(values,JSON.stringify(rows))}) expected WHERE NOT EXISTS(SELECT 1 FROM ${table} retained WHERE ${columns[table].map(column=>`retained.${column} IS json_extract(expected.value,'$.${column}')`).join(' AND ')}))`;}
 private historyPin(table:string,column:string,id:string,rows:Row[],values:Values){return [this.pin(table,rows,values),`(SELECT COUNT(*) FROM ${table} WHERE ${column}=${add(values,id)})=${rows.length}`].join(' AND ');}
 private taskPin(task:Task,values:Values){return [this.pin('contribution_tasks',[task.row],values),this.historyPin('contribution_task_events','task_id',String(task.row.id),task.rows,values)].join(' AND ');}
 private messagePin(message:Message,values:Values){return [this.pin('task_discussion_messages',[message.row],values),this.historyPin('task_discussion_events','message_id',message.record.id,message.rows,values)].join(' AND ');}
 private quotaClauses(table:typeof tables[0]|typeof tables[2],context:Context,at:string,values:Values,taskId?:string){
  const maximum=table===tables[0]?M.taskDiscussionLimits.messagesStored:M.taskDiscussionLimits.reportsStored,daily=table===tables[0]?M.taskDiscussionLimits.messagesPerSponsorDay:M.taskDiscussionLimits.reportsPerSponsorDay;
  return [`(SELECT COUNT(*) FROM ${table})<${maximum}`,`(SELECT COUNT(*) FROM ${table} WHERE sponsor_key=${add(values,context.sponsor)} AND substr(created_at,1,10)=${add(values,at.slice(0,10))})<${daily}`,...taskId?[`(SELECT COUNT(*) FROM ${table} WHERE task_id=${add(values,taskId)})<${M.taskDiscussionLimits.messagesPerTask}`]:[]];
 }
 private async quota(table:typeof tables[0]|typeof tables[2],context:Context,at:string,taskId?:string){
  const counts=await this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN sponsor_key=? AND substr(created_at,1,10)=? THEN 1 ELSE 0 END),0) AS daily,COALESCE(SUM(CASE WHEN task_id=? THEN 1 ELSE 0 END),0) AS scoped FROM ${table}`).bind(context.sponsor,at.slice(0,10),taskId??'').first<{total:number;daily:number;scoped:number}>();if(!counts)throw inconsistent();
  if(counts.total>=(table===tables[0]?M.taskDiscussionLimits.messagesStored:M.taskDiscussionLimits.reportsStored)||taskId&&counts.scoped>=M.taskDiscussionLimits.messagesPerTask)throw new M.TaskDiscussionError('Retained discussion capacity reached.',429);
  if(counts.daily>=(table===tables[0]?M.taskDiscussionLimits.messagesPerSponsorDay:M.taskDiscussionLimits.reportsPerSponsorDay))throw new M.TaskDiscussionError('Sponsor UTC-day discussion quota reached.',429,retryAfter(at));
 }
 private async reportRow(row:Row){const record=await this.canonical(row,M.boundedTaskDiscussionReport,r=>M.boundedTaskDiscussionCommand({action:'report',requestId:r.requestId,task:r.task,message:r.message,category:r.category,details:r.details,policyAccepted:M.taskDiscussionPolicy}).command);
  if(!same(record.task,{id:row.task_id,digest:row.task_digest})||!same(record.message,{id:row.message_id,digest:row.message_digest})||record.category!==row.category)throw inconsistent();return record;
 }
 async reports(cursor:string|null=null,at=new Date().toISOString()){
  clock(at);at=new Date(Math.max(Date.parse(at),Date.now())).toISOString();if(cursor!==null)digest(cursor);let anchor:Row|null=null;if(cursor){const rows=await this.rows(tables[2],'digest=?',[cursor],'digest',1);if(!rows.length)throw new M.TaskDiscussionError('Exact report cursor not found.',404);anchor=rows[0];await this.reportRow(anchor);}
  const rows=(await this.db.prepare(`SELECT ${select(tables[2])} FROM ${tables[2]} WHERE ${anchor?'created_at<? OR (created_at=? AND (author_key<? OR (author_key=? AND request_id<?)))':'1=1'} ORDER BY created_at DESC,author_key DESC,request_id DESC LIMIT ${M.taskDiscussionLimits.page+1}`).bind(...anchor?[anchor.created_at,anchor.created_at,anchor.author_key,anchor.author_key,anchor.request_id]:[]).all<Row>()).results,reports=[];
  for(const row of rows){if(future(row.created_at,at))throw inconsistent();reports.push(await this.reportRow(row));}
  // Revalidate the exact immutable private rows before releasing details.
  for(const row of [...anchor?[anchor]:[],...rows]){const current=await this.rows(tables[2],'author_key=? AND request_id=?',[row.author_key,row.request_id],'request_id',1);if(current.length!==1||!same(current[0],row))throw inconsistent();}
  const values:Values=[],clause=this.pin(tables[2],[...anchor?[anchor]:[],...rows],values);if(!await this.db.prepare(`SELECT 1 AS discussion_reports_stable WHERE ${clause}`).bind(...values).first())throw inconsistent();
  return M.taskDiscussionReportsSchema.parse({version:1,reports:reports.slice(0,M.taskDiscussionLimits.page),nextCursor:rows.length>M.taskDiscussionLimits.page?rows[M.taskDiscussionLimits.page-1].digest:null,executionEnabled:false});
 }
 private async replay(context:Context,command:M.TaskDiscussionCommand,commandDigest:string,at:string){
  await this.requireCredential(context,at);const retained=await Promise.all(tables.map(table=>this.rows(table,'author_key=? AND request_id=?',[context.key,command.requestId],'request_id',1)));
  if(retained.flat().length>1)throw inconsistent();const index=retained.findIndex(rows=>rows.length);if(index<0)return null;const row=retained[index][0],readAt=new Date(Math.max(Date.parse(at),Date.now())).toISOString();if(future(row.created_at,readAt))throw inconsistent();
  // Validate the retained original before distinguishing a changed retry from
  // corrupted persistence; a damaged command hash must fail as corruption.
  if(index===0)await this.messageRow(row,readAt);
  else if(index===2)await this.reportRow(row);
  else{const event=await this.canonical(row,M.boundedTaskDiscussionEvent,r=>M.boundedTaskDiscussionCommand({action:r.action,requestId:r.requestId,task:r.task,message:r.message,expectedSequence:r.expectedSequence,reason:r.reason,policyAccepted:r.policyAccepted}).command);if(row.message_id!==event.message.id||row.message_digest!==event.message.digest||row.task_id!==event.task.id||row.task_digest!==event.task.digest||row.sequence!==event.sequence||row.action!==event.action||row.state!==event.state||row.reason!==event.reason)throw inconsistent();}
  if(row.command_digest!==commandDigest)throw conflict();
  for(let n=0;n<5;n++){
   let message:M.TaskDiscussionItem|null=null,report:unknown=null,task:Task,allMessages:Message[]=[],claims:Claim[]=[];
   if(index===2){if(command.action!=='report')throw inconsistent();const privateReport=await this.reportRow(row),result=await this.retained(()=>this.readMessage(privateReport.message.id,readAt));
    // An opaque report receipt still depends on the exact retained target and
    // its source, claim and reply history. Suppression does not erase identity.
    if(result.read.item.digest!==privateReport.message.digest||!same(result.read.item.task,privateReport.task)||result.read.item.createdAt>privateReport.createdAt)throw inconsistent();
    task=result.snapshot.task;allMessages=result.snapshot.allMessages;claims=result.snapshot.claims;const {details:_details,reporter:_reporter,...receipt}=privateReport;report=receipt;}
   else{if(index===0&&command.action!=='publish'||index===1&&command.action!=='withdraw'&&command.action!=='hide')throw inconsistent();const result=await this.retained(()=>this.readMessage(String(index===0?row.id:row.message_id),readAt));task=result.snapshot.task;allMessages=result.snapshot.allMessages;claims=result.snapshot.claims;message=result.read.item;
    if(index===1&&!message.events.some(e=>e.digest===row.digest&&e.requestId===command.requestId&&key(e.actor)===context.key))throw inconsistent();}
   const acknowledgement={actor:context.author,commandDigest,digest:row.digest,createdAt:row.created_at,sequence:index===1?row.sequence:0};
   const receipt=await M.validateTaskDiscussionWrite({version:1,action:command.action,requestId:command.requestId,acknowledgement,task:task.item,message,report,executionEnabled:false},command,context.author);
   // Finish after canonical correlation with one atomic read of current source,
   // retained original, visibility heads and the SQL-clock credential fence.
   const values:Values=[],clauses=[...this.snapshotPins(task,allMessages,claims,values),this.pin(tables[index],[row],values),this.credential(context,at,values)];
   if(await this.db.prepare(`SELECT 1 AS discussion_receipt_stable WHERE ${clauses.join(' AND ')}`).bind(...values).first())return receipt;
   await this.requireCredential(context,at);
  }throw inconsistent();
 }
 async write(actor:M.TaskDiscussionActor,raw:unknown,at:string){
  const context=await this.context(actor,at);await this.requireCredential(context,at);const {command,payload}=M.boundedTaskDiscussionCommand(raw),commandDigest=await researchDigest(payload);
  if(command.action==='hide'&&(actor.kind!=='HUMAN'||!actor.maintainer))throw new M.TaskDiscussionError('Explicit human maintainer authorization required.',403);
  const saved=await this.replay(context,command,commandDigest,at);if(saved)return saved;
  try{const task=await this.exactTask(command.task,at);if(at<(task.rows.at(-1)?.created_at??task.item.createdAt))throw conflict();
   if(command.action==='publish')await this.publish(context,command,commandDigest,at,task);
   else{const message=await this.message(command.message.id,at);if(message.row.digest!==command.message.digest||!same(message.record.task,command.task))throw new M.TaskDiscussionError('Exact same-task message not found.',404);const dependencies=await this.dependencies(message,task,at);
    if(command.action==='report')await this.report(context,command,commandDigest,at,task,message,dependencies.claims);else await this.event(context,command,commandDigest,at,task,message,dependencies.claims);}
  }catch(error){const retained=await this.replay(context,command,commandDigest,at);if(retained)return retained;throw error;}
  const receipt=await this.replay(context,command,commandDigest,at);if(receipt)return receipt;await this.requireCredential(context,at);
  if(command.action==='publish')await this.quota(tables[0],context,at,command.task.id);if(command.action==='report')await this.quota(tables[2],context,at);throw conflict();
 }
 private async insert(table:string,row:Row,clauses:string[],values:Values){const fields=columns[table],params=fields.map(column=>add(values,row[column] as string|number));await this.db.prepare(`INSERT INTO ${table}(${fields.join(',')}) SELECT ${params.join(',')} WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();}
 private async publish(context:Context,command:Extract<M.TaskDiscussionCommand,{action:'publish'}>,commandDigest:string,at:string,task:Task){
  if(task.item.state!=='OPEN'||task.item.sequence!==command.expectedTaskSequence)throw conflict();await this.quota(tables[0],context,at,command.task.id);
  const checked=M.boundedTaskDiscussionRecord(M.taskDiscussionRecordForCommand(command,context.author,at)),record=checked.record,values:Values=[],clauses=[this.namespace(context,command.requestId,values),this.credential(context,at,values),this.taskPin(task,values),...this.quotaClauses(tables[0],context,at,values,command.task.id),`${add(values,at)}<=${nowSql}`];
  if(command.claim){const claim=await this.claim(command.claim,task,at);if(String(claim.row.created_at)>at||claim.rows.some(e=>String(e.created_at)>at))throw conflict();clauses.push(this.pin('contribution_claims',[claim.row],values),this.historyPin('contribution_claim_events','claim_id',command.claim.id,claim.rows,values));if(claim.dependencies?.length)clauses.push(this.pin('contribution_claims',claim.dependencies.map(c=>c.row),values),this.pin('contribution_claim_events',claim.dependencies.flatMap(c=>c.rows),values),this.headsPin('contribution_claim_events','claim_id',claim.dependencies.map(c=>({id:String(c.row.id),sequence:c.rows.length})),values));}
  if(command.replyTo){const reply=await this.message(command.replyTo.id,at);if(reply.row.digest!==command.replyTo.digest||!same(reply.record.task,command.task))throw new M.TaskDiscussionError('Exact same-task reply not found.',404);const dependencies=await this.dependencies(reply,task,at);if(reply.events.length||reply.record.createdAt>at)throw conflict();clauses.push(this.messagePin(reply,values),...this.revisionClaimsPin(dependencies.claims,values));}
  await this.insert(tables[0],{id:record.id,task_id:record.task.id,task_digest:record.task.digest,expected_task_sequence:command.expectedTaskSequence,claim_id:record.claim?.id??null,claim_digest:record.claim?.digest??null,reply_id:record.replyTo?.id??null,reply_digest:record.replyTo?.digest??null,kind:record.kind,author_key:context.key,sponsor_key:context.sponsor,request_id:record.requestId,command_digest:commandDigest,payload:checked.payload,digest:await researchDigest(checked.payload),created_at:at},clauses,values);
 }
 private async event(context:Context,command:Extract<M.TaskDiscussionCommand,{action:'withdraw'|'hide'}>,commandDigest:string,at:string,task:Task,message:Message,claims:Claim[]){
  const state=message.events.at(-1)?.state??'VISIBLE';if(command.expectedSequence!==message.events.length||state==='WITHDRAWN'||command.action==='hide'&&state!=='VISIBLE'||at<(message.events.at(-1)?.createdAt??message.record.createdAt))throw conflict();
  if(command.action==='withdraw'&&context.key!==message.row.author_key)throw new M.TaskDiscussionError('Only the original author may withdraw this message.',403);
  const checked=M.boundedTaskDiscussionEvent(M.taskDiscussionEventRecordForCommand(command,context.author,at)),record=checked.record,values:Values=[],clauses=[this.namespace(context,command.requestId,values),this.credential(context,at,values),this.taskPin(task,values),this.messagePin(message,values),`${add(values,at)}<=${nowSql}`];
  clauses.push(...this.revisionClaimsPin(claims,values));
  await this.insert(tables[1],{message_id:message.record.id,sequence:record.sequence,task_id:record.task.id,task_digest:record.task.digest,message_digest:record.message.digest,author_key:context.key,sponsor_key:context.sponsor,request_id:record.requestId,command_digest:commandDigest,payload:checked.payload,digest:await researchDigest(checked.payload),action:record.action,state:record.state,reason:record.reason,created_at:at},clauses,values);
 }
 private async report(context:Context,command:Extract<M.TaskDiscussionCommand,{action:'report'}>,commandDigest:string,at:string,task:Task,message:Message,claims:Claim[]){
  if(at<message.record.createdAt)throw conflict();await this.quota(tables[2],context,at);const checked=M.boundedTaskDiscussionReport(M.taskDiscussionReportForCommand(command,context.author,at)),record=checked.record,values:Values=[],clauses=[this.namespace(context,command.requestId,values),this.credential(context,at,values),this.taskPin(task,values),this.messagePin(message,values),...this.quotaClauses(tables[2],context,at,values),`${add(values,at)}<=${nowSql}`];
  clauses.push(...this.revisionClaimsPin(claims,values));
  await this.insert(tables[2],{task_id:record.task.id,task_digest:record.task.digest,message_id:record.message.id,message_digest:record.message.digest,category:record.category,author_key:context.key,sponsor_key:context.sponsor,request_id:record.requestId,command_digest:commandDigest,payload:checked.payload,digest:await researchDigest(checked.payload),created_at:at},clauses,values);
 }
}
