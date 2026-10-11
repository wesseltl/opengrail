import {networkAgentSchema} from './network-model';
import {researchDigest,researchPublicHumanId,researchAuthorReferenceSchema,type ResearchAuthorReference} from './research-model';
import type {NetworkPrincipal} from './network-store';
import * as M from './contribution-model';
import {contributionWorkLimits,validateContributionWorkPage,type ContributionWorkPage} from './contribution-work-model';

type TaskRow={id:string;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type ClaimRow=TaskRow&{task_id:string;task_digest:string;task_sequence:number;expires_at:string};
type EventRow={sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;state:string;reason:string;created_at:string;task_id?:string;claim_id?:string};
type Context={actor:M.ContributionActor;author:ResearchAuthorReference;key:string;sponsor:string};
type Task={row:TaskRow;record:M.ContributionTaskRecord};
type Claim={row:ClaimRow;record:M.ContributionClaimRecord};
type TaskHistory={rows:EventRow[];events:M.ContributionTaskEvent[];state:M.ContributionTaskItem['state']};
type ClaimHistory={rows:EventRow[];events:M.ContributionClaimEvent[];status:M.ContributionClaimStatus;handoff:string|null;reason:M.ContributionClaimItem['reason']};
type Values=(string|number)[];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const nowSql="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const limited=(maximum:number)=>`CASE WHEN length(CAST(payload AS BLOB))<=${maximum} THEN payload ELSE NULL END AS payload`;
const taskColumns=`id,author_key,sponsor_key,request_id,command_digest,${limited(12288)},digest,created_at`;
const claimColumns=taskColumns+',task_id,task_digest,task_sequence,expires_at';
const eventColumns=`sequence,author_key,sponsor_key,request_id,command_digest,${limited(4096)},digest,state,reason,created_at`;
const tables=['contribution_tasks','contribution_task_events','contribution_claims','contribution_claim_events'] as const;
const key=(author:ResearchAuthorReference)=>author.kind+':'+author.id;
const add=(values:Values,value:string|number)=>{values.push(value);return '?'+values.length;};
const inconsistent=()=>new M.ContributionError('Contribution records are inconsistent. Retained material was preserved.',503);
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new M.ContributionError('Invalid contribution timestamp.',400);}
function identity(id:string){if(typeof id!=='string'||!uuid.test(id))throw new M.ContributionError('Invalid contribution identity.',400);}
function digest(value:string){if(typeof value!=='string'||!hash.test(value))throw new M.ContributionError('Invalid contribution digest.',400);}
function retryAfter(at:string){const date=new Date(at);return Math.max(1,Math.ceil((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)-Date.parse(at))/1000));}

/** Immutable public coordination only: no GitHub credential, private handoff
 * content, submitted code, execution, merge or deployment authority. */
export class ContributionRepository{
 constructor(private db:D1Database){}
 private async context(actor:M.ContributionActor,at:string):Promise<Context>{
  clock(at);let author:ResearchAuthorReference;
  if(actor?.kind==='HUMAN'){
   if(typeof actor.maintainer!=='boolean')throw new M.ContributionError('Invalid participation context.',403);
   const sponsor=await researchPublicHumanId(actor.userId);author={kind:'HUMAN',id:sponsor,sponsorId:sponsor};
  }else if(actor?.kind==='AGENT'){
   try{
    const p=actor.principal,agent=networkAgentSchema.parse(JSON.parse(p.payload)),sponsor=await researchPublicHumanId(p.ownerId);
    if(agent.id!==p.agentId||agent.credentialId!==p.credentialId||agent.name!==p.name||agent.expiresAt!==p.expiresAt||agent.revision!==1||agent.revokedAt!==null||!hash.test(p.registryDigest)||!hash.test(p.tokenDigest)||JSON.stringify(agent)!==p.payload||await researchDigest(p.payload)!==p.registryDigest||Date.parse(at)<Date.parse(agent.createdAt)||Date.parse(at)>=Date.parse(agent.expiresAt))throw Error();
    author={kind:'AGENT',id:agent.id,sponsorId:sponsor};
   }catch{throw new M.ContributionError('Agent credential is invalid, expired or revoked.',401);}
  }else throw new M.ContributionError('Authentication is required for contribution commands.',401);
  return {actor,author:researchAuthorReferenceSchema.parse(author),key:key(author),sponsor:author.sponsorId};
 }
 private credentialClause(context:Context,at:string,values:Values){
  if(context.actor.kind!=='AGENT')return '1=1';
  const p:NetworkPrincipal=context.actor.principal,user=add(values,p.ownerId),agent=add(values,p.agentId),credential=add(values,p.credentialId),token=add(values,p.tokenDigest),registry=add(values,p.registryDigest),payload=add(values,p.payload),time=add(values,at);
  return `EXISTS(SELECT 1 FROM network_agents WHERE owner_id=${user} AND id=${agent} AND credential_id=${credential} AND token_digest=${token} AND digest=${registry} AND payload=${payload} AND revision=1 AND revoked_at IS NULL AND created_at<=${time} AND created_at<=${nowSql} AND expires_at>${time} AND expires_at>${nowSql})`;
 }
 private async requireCredential(context:Context,at:string){
  if(context.actor.kind==='AGENT'){const values:Values=[],clause=this.credentialClause(context,at,values);if(!await this.db.prepare(`SELECT 1 AS active WHERE ${clause}`).bind(...values).first())throw new M.ContributionError('Agent credential is invalid, expired or revoked.',401);}
 }
 private namespace(context:Context,requestId:string,values:Values){const actor=add(values,context.key),request=add(values,requestId);return tables.map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE author_key=${actor} AND request_id=${request})`).join(' AND ');}
 private async quota(table:'contribution_tasks'|'contribution_claims',context:Context,at:string){
  const daily=table==='contribution_tasks'?M.contributionLimits.registerPerMaintainerDay:M.contributionLimits.claimsPerSponsorDay,maximum=table==='contribution_tasks'?M.contributionLimits.tasksStored:M.contributionLimits.claimsStored;
  const counts=await this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN sponsor_key=? AND substr(created_at,1,10)=? THEN 1 ELSE 0 END),0) AS daily FROM ${table}`).bind(context.sponsor,at.slice(0,10)).first<{total:number;daily:number}>();
  if(!counts)throw inconsistent();if(counts.total>=maximum)throw new M.ContributionError('Retained contribution capacity has been reached. No automatic reset is promised.',429);if(counts.daily>=daily)throw new M.ContributionError('The shared sponsor UTC-day contribution limit has been reached.',429,retryAfter(at));
 }
 private quotaClauses(table:'contribution_tasks'|'contribution_claims',context:Context,at:string,values:Values){
  const daily=table==='contribution_tasks'?M.contributionLimits.registerPerMaintainerDay:M.contributionLimits.claimsPerSponsorDay,maximum=table==='contribution_tasks'?M.contributionLimits.tasksStored:M.contributionLimits.claimsStored;
  return [`(SELECT COUNT(*) FROM ${table})<${maximum}`,`(SELECT COUNT(*) FROM ${table} WHERE sponsor_key=${add(values,context.sponsor)} AND substr(created_at,1,10)=${add(values,at.slice(0,10))})<${daily}`];
 }
 private async checkTask(row:TaskRow):Promise<Task>{
  try{if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const checked=M.boundedContributionTaskRecord(JSON.parse(row.payload)),record=checked.record;
   if(checked.payload!==row.payload||await researchDigest(row.payload)!==row.digest||record.id!==row.id||record.requestId!==row.request_id||record.createdAt!==row.created_at||key(record.author)!==row.author_key||record.author.sponsorId!==row.sponsor_key||await researchDigest(M.boundedContributionCommand(M.contributionTaskCommandForRecord(record)).payload)!==row.command_digest)throw Error();return {row,record};
  }catch{throw inconsistent();}
 }
 private async checkClaim(row:ClaimRow):Promise<Claim>{
  try{if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const checked=M.boundedContributionClaimRecord(JSON.parse(row.payload)),record=checked.record;
   if(checked.payload!==row.payload||await researchDigest(row.payload)!==row.digest||record.id!==row.id||record.requestId!==row.request_id||record.createdAt!==row.created_at||record.expiresAt!==row.expires_at||record.task.id!==row.task_id||record.task.digest!==row.task_digest||key(record.author)!==row.author_key||record.author.sponsorId!==row.sponsor_key||row.task_sequence!==0||await researchDigest(M.boundedContributionCommand(M.contributionClaimCommandForRecord(record,row.task_sequence)).payload)!==row.command_digest)throw Error();return {row,record};
  }catch{throw inconsistent();}
 }
 private async task(id:string){identity(id);const row=await this.db.prepare(`SELECT ${taskColumns} FROM contribution_tasks WHERE id=?`).bind(id).first<TaskRow>();if(!row)throw new M.ContributionError('Contribution task not found.',404);return this.checkTask(row);}
 private async claim(id:string){identity(id);const row=await this.db.prepare(`SELECT ${claimColumns} FROM contribution_claims WHERE id=?`).bind(id).first<ClaimRow>();if(!row)throw new M.ContributionError('Contribution claim not found.',404);return this.checkClaim(row);}
 private async taskHistories(tasks:Task[]){
  const result=new Map<string,TaskHistory>();if(!tasks.length)return result;const ids=tasks.map(task=>task.row.id),rows=(await this.db.prepare(`SELECT task_id,${eventColumns} FROM contribution_task_events WHERE task_id IN (${ids.map(()=>'?').join(',')}) ORDER BY task_id,sequence LIMIT ${tasks.length*(M.contributionLimits.taskEvents+1)+1}`).bind(...ids).all<EventRow>()).results;
  for(const task of tasks){const relevant=rows.filter(row=>row.task_id===task.row.id);if(relevant.length>M.contributionLimits.taskEvents)throw inconsistent();const events:M.ContributionTaskEvent[]=[];
   for(const row of relevant){try{if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const checked=M.boundedContributionTaskEventRecord(JSON.parse(row.payload)),event=checked.record;
    if(checked.payload!==row.payload||await researchDigest(row.payload)!==row.digest||event.task.id!==task.row.id||event.task.digest!==task.row.digest||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||event.reason!==row.reason||key(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||await researchDigest(M.boundedContributionCommand(M.contributionEventCommandForRecord(event)).payload)!==row.command_digest)throw Error();events.push({...event,digest:row.digest});
   }catch{throw inconsistent();}}
   const history:TaskHistory={rows:relevant,events,state:events.at(-1)?.state??'OPEN'};this.projectTask(task,history);result.set(task.row.id,history);
  }if(rows.some(row=>!ids.includes(row.task_id!)))throw inconsistent();return result;
 }
 private async claimHistories(claims:Claim[],tasks:Map<string,Task>,parents:Map<string,TaskHistory>,at:string){
  const result=new Map<string,ClaimHistory>();if(!claims.length)return result;const ids=claims.map(claim=>claim.row.id),rows=(await this.db.prepare(`SELECT claim_id,${eventColumns} FROM contribution_claim_events WHERE claim_id IN (${ids.map(()=>'?').join(',')}) ORDER BY claim_id,sequence LIMIT ${claims.length*(M.contributionLimits.claimEvents+1)+1}`).bind(...ids).all<EventRow>()).results;
  for(const claim of claims){const task=tasks.get(claim.row.task_id),parent=parents.get(claim.row.task_id);if(!task||!parent||claim.row.task_digest!==task.row.digest||claim.record.createdAt<task.record.createdAt||claim.record.createdAt>at||parent.events.some(event=>event.createdAt<claim.record.createdAt))throw inconsistent();
   const relevant=rows.filter(row=>row.claim_id===claim.row.id);if(relevant.length>M.contributionLimits.claimEvents)throw inconsistent();const events:M.ContributionClaimEvent[]=[];
   for(const row of relevant){try{if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();const checked=M.boundedContributionClaimEventRecord(JSON.parse(row.payload)),event=checked.record;
    if(checked.payload!==row.payload||await researchDigest(row.payload)!==row.digest||event.task.id!==task.row.id||event.task.digest!==task.row.digest||event.claim.id!==claim.row.id||event.claim.digest!==claim.row.digest||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||(event.reason??'')!==row.reason||key(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||await researchDigest(M.boundedContributionCommand(M.contributionEventCommandForRecord(event)).payload)!==row.command_digest||event.action!=='release'&&parent.events.some(parentEvent=>parentEvent.createdAt<event.createdAt))throw Error();events.push({...event,digest:row.digest});
   }catch{throw inconsistent();}}
   const current=events.at(-1),base=current?.state??'ACTIVE',status=(base==='ACTIVE'||base==='SUBMITTED')&&at>=claim.record.expiresAt?'EXPIRED':base;
   const history:ClaimHistory={rows:relevant,events,status,handoff:events.find(event=>event.action==='submit')?.handoffDigest??null,reason:current?.reason??null};
   // Validate the full retained history before suppressing any authored payload.
   this.projectClaim(claim,history,{...parent,state:parent.state==='HIDDEN'?'CLOSED':parent.state},at);result.set(claim.row.id,history);
  }if(rows.some(row=>!ids.includes(row.claim_id!)))throw inconsistent();return result;
 }
 private projectTask(task:Task,history:TaskHistory):M.ContributionTaskItem{
  try{return M.contributionTaskItemSchema.parse({id:task.row.id,digest:task.row.digest,requestId:task.record.requestId,createdAt:task.record.createdAt,author:task.record.author,state:history.state,sequence:history.events.length,reason:history.events.at(-1)?.reason??null,record:history.state==='HIDDEN'?null:task.record,events:history.events});}catch{throw inconsistent();}
 }
 private projectClaim(claim:Claim,history:ClaimHistory,parent:TaskHistory,at:string):M.ContributionClaimItem{
  try{const hidden=parent.state==='HIDDEN';return M.contributionClaimItemSchema.parse({id:claim.row.id,digest:claim.row.digest,requestId:claim.record.requestId,createdAt:claim.record.createdAt,expiresAt:claim.record.expiresAt,checkedAt:at,author:claim.record.author,task:claim.record.task,taskState:parent.state,sequence:history.events.length,status:history.status,handoffDigest:hidden?null:history.handoff,reason:hidden?null:history.reason,record:hidden?null:claim.record,events:hidden?[]:history.events});}catch{throw inconsistent();}
 }
 private advance(before:{rows:EventRow[]},after:{rows:EventRow[]}){if(after.rows.length<before.rows.length||before.rows.some((row,n)=>JSON.stringify(row)!==JSON.stringify(after.rows[n])))throw inconsistent();}
 private async stableTask(task:Task,before:TaskHistory){const fresh=await this.task(task.row.id);if(JSON.stringify(fresh.row)!==JSON.stringify(task.row))throw inconsistent();const history=(await this.taskHistories([fresh])).get(task.row.id)!;this.advance(before,history);return {task:fresh,history};}
 private async taskClaims(task:Task){const rows=(await this.db.prepare(`SELECT ${claimColumns} FROM contribution_claims WHERE task_id=? ORDER BY created_at DESC,id DESC LIMIT ${M.contributionLimits.claimsPerTask+1}`).bind(task.row.id).all<ClaimRow>()).results;if(rows.length>M.contributionLimits.claimsPerTask)throw inconsistent();const claims=await Promise.all(rows.map(row=>this.checkClaim(row)));if(new Set(claims.map(claim=>claim.row.id)).size!==claims.length||claims.some(claim=>claim.row.task_id!==task.row.id||claim.row.task_digest!==task.row.digest))throw inconsistent();return claims;}
 private async freshClaims(claims:Claim[]){if(!claims.length)return claims;const ids=claims.map(claim=>claim.row.id),rows=(await this.db.prepare(`SELECT ${claimColumns} FROM contribution_claims WHERE id IN (${ids.map(()=>'?').join(',')}) LIMIT ${ids.length+1}`).bind(...ids).all<ClaimRow>()).results;if(rows.length!==claims.length||new Set(rows.map(row=>row.id)).size!==claims.length)throw inconsistent();const fresh=await Promise.all(rows.map(row=>this.checkClaim(row))),byId=new Map(fresh.map(claim=>[claim.row.id,claim]));for(const claim of claims)if(JSON.stringify(claim.row)!==JSON.stringify(byId.get(claim.row.id)?.row))throw inconsistent();return claims.map(claim=>byId.get(claim.row.id)!);}
 async get(taskId:string,at=new Date().toISOString()){
  clock(at);const task=await this.task(taskId),before=(await this.taskHistories([task])).get(taskId)!;const fresh=await this.stableTask(task,before);return M.contributionGetSchema.parse({version:1,item:this.projectTask(fresh.task,fresh.history),executionEnabled:false});
 }
 async list(cursor?:string|null,at=new Date().toISOString()){
  clock(at);const anchor=cursor?await this.task(cursor):null,rows=(await this.db.prepare(`SELECT ${taskColumns} FROM contribution_tasks ${anchor?'WHERE created_at<? OR (created_at=? AND id<?)':''} ORDER BY created_at DESC,id DESC LIMIT ${M.contributionLimits.page+1}`).bind(...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<TaskRow>()).results;
  const tasks=await Promise.all(rows.map(row=>this.checkTask(row))),before=await this.taskHistories(tasks),ids=tasks.map(task=>task.row.id);
  const freshRows=ids.length?(await this.db.prepare(`SELECT ${taskColumns} FROM contribution_tasks WHERE id IN (${ids.map(()=>'?').join(',')}) LIMIT ${ids.length+1}`).bind(...ids).all<TaskRow>()).results:[];
  if(freshRows.length!==tasks.length||new Set(freshRows.map(row=>row.id)).size!==tasks.length)throw inconsistent();const fresh=await Promise.all(freshRows.map(row=>this.checkTask(row))),byId=new Map(fresh.map(task=>[task.row.id,task])),after=await this.taskHistories(fresh);
  for(const task of tasks){if(JSON.stringify(task.row)!==JSON.stringify(byId.get(task.row.id)?.row))throw inconsistent();this.advance(before.get(task.row.id)!,after.get(task.row.id)!);}
  const page=tasks.slice(0,M.contributionLimits.page),items=page.map(task=>this.projectTask(byId.get(task.row.id)!,after.get(task.row.id)!));return M.contributionListSchema.parse({version:1,items,nextCursor:tasks.length>M.contributionLimits.page?page.at(-1)!.row.id:null,executionEnabled:false});
 }
 async claims(taskId:string,taskDigest:string,cursor?:string|null,at=new Date().toISOString()){
  clock(at);digest(taskDigest);if(cursor!==undefined&&cursor!==null)identity(cursor);const task=await this.task(taskId);if(task.row.digest!==taskDigest)throw new M.ContributionError('Exact contribution task not found.',404);
  const before=(await this.taskHistories([task])).get(taskId)!,claims=await this.taskClaims(task),tasks=new Map([[taskId,task]]),parents=new Map([[taskId,before]]),histories=await this.claimHistories(claims,tasks,parents,at);
  let start=0;if(cursor){const index=claims.findIndex(claim=>claim.row.id===cursor);if(index<0)throw new M.ContributionError('Exact contribution claim cursor not found.',404);start=index+1;}
  const fresh=await this.stableTask(task,before),current=await this.freshClaims(claims),latest=await this.claimHistories(current,new Map([[taskId,fresh.task]]),new Map([[taskId,fresh.history]]),at);for(const claim of claims)this.advance(histories.get(claim.row.id)!,latest.get(claim.row.id)!);const final=await this.stableTask(fresh.task,fresh.history);
  const page=current.slice(start,start+M.contributionLimits.page);return M.contributionClaimsSchema.parse({version:1,task:this.projectTask(final.task,final.history),items:page.map(claim=>this.projectClaim(claim,latest.get(claim.row.id)!,final.history,at)),nextCursor:claims.length>start+M.contributionLimits.page?page.at(-1)!.row.id:null,executionEnabled:false});
 }
 private async readClaim(claimId:string,at:string){
  clock(at);const claim=await this.claim(claimId),task=await this.task(claim.row.task_id),before=(await this.taskHistories([task])).get(task.row.id)!,histories=await this.claimHistories([claim],new Map([[task.row.id,task]]),new Map([[task.row.id,before]]),at),fresh=await this.stableTask(task,before),after=await this.claimHistories([claim],new Map([[task.row.id,fresh.task]]),new Map([[task.row.id,fresh.history]]),at);this.advance(histories.get(claimId)!,after.get(claimId)!);
  const current=(await this.freshClaims([claim]))[0],final=await this.stableTask(fresh.task,fresh.history),read=M.contributionClaimGetSchema.parse({version:1,task:this.projectTask(final.task,final.history),item:this.projectClaim(current,after.get(claimId)!,final.history,at),executionEnabled:false});return {read,history:after.get(claimId)!};
 }
 async getClaim(claimId:string,at=new Date().toISOString()){return (await this.readClaim(claimId,at)).read;}
 /** Authenticated bounded work discovery. Existing coordination writers are
  * unchanged; the final SELECT observes retained rows, heads and authority. */
 async work(actor:M.ContributionActor,cursor:string|null=null,at=new Date().toISOString()):Promise<ContributionWorkPage>{
  clock(at);if(cursor!==null)identity(cursor);
  const context=await this.context(actor,at),scope=context.author.kind==='HUMAN'?'SPONSOR':'AGENT',column=scope==='SPONSOR'?'sponsor_key':'author_key',selected=scope==='SPONSOR'?context.sponsor:context.key;
  await this.requireCredential(context,at);
  const observedClaims=new Map<string,Claim>(),observedTasks=new Map<string,Task>(),observedParents=new Map<string,TaskHistory>(),observedHistories=new Map<string,ClaimHistory>();
  for(let attempt=0;attempt<contributionWorkLimits.reconciliationAttempts;attempt++){
   const anchorRow=cursor?await this.db.prepare(`SELECT ${claimColumns} FROM contribution_claims WHERE id=? AND ${column}=?`).bind(cursor,selected).first<ClaimRow>():null;
   if(cursor&&!anchorRow){await this.requireCredential(context,at);throw new M.ContributionError('Contribution work cursor not found in this participant scope.',404);}
   const anchor=anchorRow?await this.checkClaim(anchorRow):null;
   const rows=(await this.db.prepare(`SELECT ${claimColumns} FROM contribution_claims WHERE ${column}=? ${anchor?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ${contributionWorkLimits.page+1}`).bind(selected,...anchor?[anchor.record.createdAt,anchor.record.createdAt,anchor.record.id]:[]).all<ClaimRow>()).results;
   if(rows.length>contributionWorkLimits.page+1||new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>row[column]!==selected))throw inconsistent();
   const claims=await Promise.all(rows.map(row=>this.checkClaim(row))),allClaims=[...claims,...anchor?[anchor]:[]];
   if(new Set(allClaims.map(claim=>claim.row.id)).size!==allClaims.length)throw inconsistent();
   const ids=[...new Set(allClaims.map(claim=>claim.row.task_id))],taskRows=ids.length?(await this.db.prepare(`SELECT ${taskColumns} FROM contribution_tasks WHERE id IN (${ids.map(()=>'?').join(',')}) LIMIT ${ids.length+1}`).bind(...ids).all<TaskRow>()).results:[];
   if(taskRows.length!==ids.length||new Set(taskRows.map(row=>row.id)).size!==ids.length||taskRows.some(row=>!ids.includes(row.id)))throw inconsistent();
   const tasks=await Promise.all(taskRows.map(row=>this.checkTask(row))),byId=new Map(tasks.map(task=>[task.row.id,task])),parents=await this.taskHistories(tasks),histories=await this.claimHistories(allClaims,byId,parents,at);
   for(const claim of allClaims){const old=observedClaims.get(claim.row.id),history=histories.get(claim.row.id)!;if(old&&JSON.stringify(old.row)!==JSON.stringify(claim.row))throw inconsistent();const previous=observedHistories.get(claim.row.id);if(previous)this.advance(previous,history);observedClaims.set(claim.row.id,claim);observedHistories.set(claim.row.id,history);}
   for(const task of tasks){const old=observedTasks.get(task.row.id),parent=parents.get(task.row.id)!;if(old&&JSON.stringify(old.row)!==JSON.stringify(task.row))throw inconsistent();const previous=observedParents.get(task.row.id);if(previous)this.advance(previous,parent);observedTasks.set(task.row.id,task);observedParents.set(task.row.id,parent);}
   const page=claims.slice(0,contributionWorkLimits.page),items=page.map(claim=>{const task=byId.get(claim.row.task_id)!;return {task:this.projectTask(task,parents.get(task.row.id)!),claim:this.projectClaim(claim,histories.get(claim.row.id)!,parents.get(task.row.id)!,at)};});
   const result=await validateContributionWorkPage({version:1,scope,participant:context.author,checkedAt:at,items,nextCursor:claims.length>contributionWorkLimits.page?page.at(-1)!.row.id:null,executionEnabled:false});
   const values:Values=[],clauses=[this.credentialClause(context,at,values),this.pinRows('contribution_tasks',tasks.map(task=>task.row),values),this.pinRows('contribution_task_events',[...parents.values()].flatMap(history=>history.rows),values),this.headsClause('contribution_task_events',tasks.map(task=>({id:task.row.id,sequence:parents.get(task.row.id)!.events.length})),values),this.pinRows('contribution_claims',allClaims.map(claim=>claim.row),values),this.pinRows('contribution_claim_events',[...histories.values()].flatMap(history=>history.rows),values),this.headsClause('contribution_claim_events',allClaims.map(claim=>({id:claim.row.id,sequence:histories.get(claim.row.id)!.events.length})),values)];
   if(await this.db.prepare(`SELECT 1 AS contribution_work_stable WHERE ${clauses.join(' AND ')}`).bind(...values).first())return result;
   await this.requireCredential(context,at);
  }
  throw new M.ContributionError('Contribution work changed during the bounded read. Refresh to inspect current records.',503);
 }
 private pinRows(table:typeof tables[number],rows:(TaskRow|ClaimRow|EventRow)[],values:Values){
  if(!rows.length)return '1=1';const columns=table==='contribution_tasks'?['id','author_key','sponsor_key','request_id','command_digest','payload','digest','created_at']:table==='contribution_claims'?['id','task_id','task_digest','task_sequence','author_key','sponsor_key','request_id','command_digest','payload','digest','created_at','expires_at']:[table==='contribution_task_events'?'task_id':'claim_id','sequence','author_key','sponsor_key','request_id','command_digest','payload','digest','state','reason','created_at'];
  return `NOT EXISTS(SELECT 1 FROM json_each(${add(values,JSON.stringify(rows))}) expected WHERE NOT EXISTS(SELECT 1 FROM ${table} retained WHERE ${columns.map(column=>`retained.${column}=json_extract(expected.value,'$.${column}')`).join(' AND ')}))`;
 }
 private parentClause(task:Task,history:TaskHistory,values:Values){return [this.pinRows('contribution_tasks',[task.row],values),this.pinRows('contribution_task_events',history.rows,values),`COALESCE((SELECT MAX(sequence) FROM contribution_task_events WHERE task_id=${add(values,task.row.id)}),0)=${add(values,history.events.length)}`].join(' AND ');}
 private headsClause(table:'contribution_task_events'|'contribution_claim_events',heads:{id:string;sequence:number}[],values:Values){if(!heads.length)return '1=1';const column=table==='contribution_task_events'?'task_id':'claim_id';return `NOT EXISTS(SELECT 1 FROM json_each(${add(values,JSON.stringify(heads))}) expected WHERE COALESCE((SELECT MAX(sequence) FROM ${table} WHERE ${column}=json_extract(expected.value,'$.id')),0)<>json_extract(expected.value,'$.sequence'))`;}
 private claimClause(claim:Claim,history:ClaimHistory,at:string,values:Values){return [this.pinRows('contribution_claims',[claim.row],values),this.pinRows('contribution_claim_events',history.rows,values),`COALESCE((SELECT MAX(sequence) FROM contribution_claim_events WHERE claim_id=${add(values,claim.row.id)}),0)=${add(values,history.events.length)}`,`${add(values,claim.record.expiresAt)}>${add(values,at)}`,`${add(values,claim.record.expiresAt)}>${nowSql}`].join(' AND ');}
 private async sponsorLeases(context:Context,at:string){
  const maximum=M.contributionLimits.claimsPerSponsorDay*(Math.ceil(M.contributionLimits.leaseHours/24)+1),rows=(await this.db.prepare(`SELECT ${claimColumns} FROM contribution_claims WHERE sponsor_key=? AND expires_at>? AND expires_at>${nowSql} ORDER BY created_at,id LIMIT ${maximum+1}`).bind(context.sponsor,at).all<ClaimRow>()).results;if(rows.length>maximum)throw inconsistent();
  const claims=await Promise.all(rows.map(row=>this.checkClaim(row))),ids=[...new Set(claims.map(claim=>claim.row.task_id))],taskRows=ids.length?(await this.db.prepare(`SELECT ${taskColumns} FROM contribution_tasks WHERE id IN (${ids.map(()=>'?').join(',')}) LIMIT ${ids.length+1}`).bind(...ids).all<TaskRow>()).results:[];
  if(taskRows.length!==ids.length||new Set(taskRows.map(row=>row.id)).size!==ids.length)throw inconsistent();const tasks=await Promise.all(taskRows.map(row=>this.checkTask(row))),byId=new Map(tasks.map(task=>[task.row.id,task])),parents=await this.taskHistories(tasks),histories=await this.claimHistories(claims,byId,parents,at);return {claims,tasks,parents,histories,active:claims.filter(claim=>parents.get(claim.row.task_id)!.state==='OPEN'&&['ACTIVE','SUBMITTED'].includes(histories.get(claim.row.id)!.status))};
 }
 private async replay(context:Context,command:M.ContributionCommand,commandDigest:string,at:string){
  await this.requireCredential(context,at);const retained=await Promise.all(tables.map(table=>this.db.prepare(`SELECT ${table==='contribution_tasks'?taskColumns:table==='contribution_claims'?claimColumns:(table==='contribution_task_events'?'task_id,':'claim_id,')+eventColumns} FROM ${table} WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<TaskRow|ClaimRow|EventRow>()));
  if(retained.reduce((count,result)=>count+result.results.length,0)>1)throw inconsistent();const index=retained.findIndex(result=>result.results.length);if(index<0)return null;const row=retained[index].results[0];if(row.command_digest!==commandDigest)throw new M.ContributionError('Request ID already used for different contribution material.');
  let taskId:string,claimId:string|null=null,sequence=0,acceptedDigest=row.digest;
  if(index===0){if(command.action!=='register')throw inconsistent();taskId=(await this.checkTask(row as TaskRow)).row.id;}
  else if(index===2){if(command.action!=='claim')throw inconsistent();const checked=await this.checkClaim(row as ClaimRow);taskId=checked.row.task_id;claimId=checked.row.id;}
  else{const event=row as EventRow;if(index===1){if(command.action!=='close'&&command.action!=='hide')throw inconsistent();taskId=event.task_id!;}else{if(!('claim'in command))throw inconsistent();const checked=await this.claim(event.claim_id!);taskId=checked.row.task_id;claimId=checked.row.id;}sequence=event.sequence;}
  const snapshot=claimId?await this.readClaim(claimId,at):null,task=snapshot?snapshot.read.task:(await this.get(taskId,at)).item,claim=snapshot?snapshot.read.item:null;
  if(index===1&&!task.events.some(event=>event.sequence===sequence&&event.digest===acceptedDigest&&event.requestId===command.requestId&&key(event.actor)===context.key))throw inconsistent();
  if(index===3&&!snapshot!.history.events.some(event=>event.sequence===sequence&&event.digest===acceptedDigest&&event.requestId===command.requestId&&key(event.actor)===context.key))throw inconsistent();
  const acknowledgement=M.contributionAcknowledgementSchema.parse({action:command.action,requestId:command.requestId,actor:context.author,task:{id:task.id,digest:task.digest},claim:claim?{id:claim.id,digest:claim.digest}:null,sequence,createdAt:row.created_at,commandDigest,digest:acceptedDigest});
  const receipt=await M.validateContributionWrite({version:1,action:command.action,requestId:command.requestId,task,claim,acknowledgement,executionEnabled:false},command,context.author);
  await this.requireCredential(context,at);return receipt;
 }
 async write(actor:M.ContributionActor,raw:unknown,at:string){
  const context=await this.context(actor,at);await this.requireCredential(context,at);let parsed:ReturnType<typeof M.boundedContributionCommand>;
  try{parsed=M.boundedContributionCommand(raw);}catch(error){if(error instanceof M.ContributionError)throw error;throw new M.ContributionError('Invalid contribution command.',400);}
  const {command,payload}=parsed;if(['register','close','hide','review'].includes(command.action)&&(actor.kind!=='HUMAN'||!actor.maintainer))throw new M.ContributionError('Explicit human maintainer authorization is required.',403);
  const commandDigest=await researchDigest(payload),saved=await this.replay(context,command,commandDigest,at);if(saved)return saved;
  try{
   if(command.action==='register')await this.register(context,command,commandDigest,at);
   else{const task=await this.task(command.task.id);if(task.row.digest!==command.task.digest)throw new M.ContributionError('Exact contribution task not found.',404);const parent=(await this.taskHistories([task])).get(task.row.id)!;
    if(at<task.record.createdAt)throw new M.ContributionError('Contribution time precedes its task.');
    if(command.action==='claim')await this.admitClaim(context,command,commandDigest,at,task,parent);
    else if(command.action==='close'||command.action==='hide')await this.taskEvent(context,command,commandDigest,at,task,parent);
    else{const claim=await this.claim(command.claim.id);if(claim.row.digest!==command.claim.digest||claim.row.task_id!==task.row.id||claim.row.task_digest!==task.row.digest)throw new M.ContributionError('Exact contribution claim not found.',404);const history=(await this.claimHistories([claim],new Map([[task.row.id,task]]),new Map([[task.row.id,parent]]),at)).get(claim.row.id)!;await this.claimEvent(context,command,commandDigest,at,task,parent,claim,history);}
   }
  }catch(error){const replay=await this.replay(context,command,commandDigest,at);if(replay)return replay;throw error;}
  const receipt=await this.replay(context,command,commandDigest,at);if(receipt)return receipt;await this.requireCredential(context,at);
  if(command.action==='register')await this.quota('contribution_tasks',context,at);if(command.action==='claim')await this.quota('contribution_claims',context,at);
  throw new M.ContributionError('Contribution identity, current lease, lifecycle, quota or permission changed. Refresh before retrying; no command was confirmed.');
 }
 private async register(context:Context,command:M.ContributionRegisterCommand,commandDigest:string,at:string){
  await this.quota('contribution_tasks',context,at);const checked=M.boundedContributionTaskRecord(M.contributionTaskRecordForCommand(command,context.author,at)),row=checked.record,values:Values=[row.id,context.key,context.sponsor,row.requestId,commandDigest,checked.payload,await researchDigest(checked.payload),at];
  const clauses=[this.namespace(context,command.requestId,values),...this.quotaClauses('contribution_tasks',context,at,values),`${add(values,at)}<=${nowSql}`];await this.db.prepare(`INSERT INTO contribution_tasks(id,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async admitClaim(context:Context,command:M.ContributionClaimCommand,commandDigest:string,at:string,task:Task,parent:TaskHistory){
  if(parent.state!=='OPEN'||parent.events.length!==command.expectedTaskSequence)throw new M.ContributionError('Task lifecycle changed or is not open.');await this.quota('contribution_claims',context,at);
  const claims=await this.taskClaims(task),histories=await this.claimHistories(claims,new Map([[task.row.id,task]]),new Map([[task.row.id,parent]]),at),sponsor=await this.sponsorLeases(context,at);
  if(claims.length>=M.contributionLimits.claimsPerTask)throw new M.ContributionError('Retained claim capacity for this task has been reached.',429);
  if(claims.some(claim=>['ACTIVE','SUBMITTED'].includes(histories.get(claim.row.id)!.status)))throw new M.ContributionError('This task already has a current claim lease.');
  if(sponsor.active.length>=M.contributionLimits.activePerSponsor)throw new M.ContributionError('The sponsor’s current contribution lease limit has been reached.',429);
  const checked=M.boundedContributionClaimRecord(M.contributionClaimRecordForCommand(command,context.author,at)),row=checked.record,values:Values=[row.id,task.row.id,task.row.digest,command.expectedTaskSequence,context.key,context.sponsor,row.requestId,commandDigest,checked.payload,await researchDigest(checked.payload),at,row.expiresAt];
  const targetId=add(values,task.row.id),sponsorId=add(values,context.sponsor),time=add(values,at),active=`c.expires_at>${time} AND c.expires_at>${nowSql} AND COALESCE((SELECT state FROM contribution_claim_events WHERE claim_id=c.id ORDER BY sequence DESC LIMIT 1),'ACTIVE') IN ('ACTIVE','SUBMITTED')`;
  const clauses=[this.namespace(context,command.requestId,values),this.credentialClause(context,at,values),...this.quotaClauses('contribution_claims',context,at,values),this.parentClause(task,parent,values),this.pinRows('contribution_claims',claims.map(claim=>claim.row),values),this.pinRows('contribution_claim_events',[...histories.values()].flatMap(history=>history.rows),values),`(SELECT COUNT(*) FROM contribution_claims WHERE task_id=${targetId})=${claims.length}`,`NOT EXISTS(SELECT 1 FROM contribution_claims c WHERE c.task_id=${targetId} AND ${active})`,`(SELECT COUNT(*) FROM contribution_claims c WHERE c.sponsor_key=${sponsorId} AND ${active} AND COALESCE((SELECT state FROM contribution_task_events WHERE task_id=c.task_id ORDER BY sequence DESC LIMIT 1),'OPEN')='OPEN')<${M.contributionLimits.activePerSponsor}`,`${time}<=${nowSql}`];
  clauses.push(this.pinRows('contribution_tasks',sponsor.tasks.map(task=>task.row),values),this.pinRows('contribution_task_events',[...sponsor.parents.values()].flatMap(history=>history.rows),values),this.headsClause('contribution_task_events',sponsor.tasks.map(task=>({id:task.row.id,sequence:sponsor.parents.get(task.row.id)!.events.length})),values),this.pinRows('contribution_claims',sponsor.claims.map(claim=>claim.row),values),this.pinRows('contribution_claim_events',[...sponsor.histories.values()].flatMap(history=>history.rows),values));
  clauses.push(this.headsClause('contribution_claim_events',[...new Map([...claims,...sponsor.claims].map(other=>[other.row.id,{id:other.row.id,sequence:(histories.get(other.row.id)??sponsor.histories.get(other.row.id))!.events.length}])).values()],values));
  await this.db.prepare(`INSERT INTO contribution_claims(id,task_id,task_digest,task_sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at,expires_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async taskEvent(context:Context,command:Extract<M.ContributionCommand,{action:'close'|'hide'}>,commandDigest:string,at:string,task:Task,parent:TaskHistory){
  if(parent.events.length!==command.expectedSequence||parent.state==='HIDDEN'||command.action==='close'&&parent.state!=='OPEN'||at<(parent.events.at(-1)?.createdAt??task.record.createdAt))throw new M.ContributionError('Task lifecycle changed or is terminal.');
  const checked=M.boundedContributionTaskEventRecord(M.contributionEventRecordForCommand(command,context.author,at)),event=checked.record,values:Values=[task.row.id,event.sequence,context.key,context.sponsor,event.requestId,commandDigest,checked.payload,await researchDigest(checked.payload),event.state,event.reason,at],clauses=[this.namespace(context,command.requestId,values),this.parentClause(task,parent,values),`${add(values,at)}<=${nowSql}`];
  await this.db.prepare(`INSERT INTO contribution_task_events(task_id,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async claimEvent(context:Context,command:Extract<M.ContributionCommand,{action:'release'|'submit'|'review'}>,commandDigest:string,at:string,task:Task,parent:TaskHistory,claim:Claim,history:ClaimHistory){
  if(history.events.length!==command.expectedSequence||!['ACTIVE','SUBMITTED'].includes(history.status)||Date.parse(claim.record.expiresAt)<=Math.max(Date.parse(at),Date.now())||at<(history.events.at(-1)?.createdAt??claim.record.createdAt))throw new M.ContributionError('Claim lease expired, changed or is terminal.');
  if(command.action!=='release'&&parent.state!=='OPEN')throw new M.ContributionError('Task is closed or hidden.');
  if(command.action==='release'){if(command.reason==='AUTHOR_RELEASE'?context.key!==claim.row.author_key:context.actor.kind!=='HUMAN'||claim.record.author.kind!=='AGENT'||context.author.id!==claim.record.author.sponsorId)throw new M.ContributionError('Only the claimant or its human sponsor may release this claim.',403);}
  if(command.action==='submit'&&(history.status!=='ACTIVE'||context.key!==claim.row.author_key))throw new M.ContributionError('Only the current claimant may submit its handoff digest.',403);
  if(command.action==='review'&&(history.status!=='SUBMITTED'||history.handoff===null))throw new M.ContributionError('Only a current submitted claim can receive a coordination disposition.');
  const checked=M.boundedContributionClaimEventRecord(M.contributionEventRecordForCommand(command,context.author,at)),event=checked.record,values:Values=[claim.row.id,event.sequence,context.key,context.sponsor,event.requestId,commandDigest,checked.payload,await researchDigest(checked.payload),event.state,event.reason??'',at],clauses=[this.namespace(context,command.requestId,values),this.credentialClause(context,at,values),this.parentClause(task,parent,values),this.claimClause(claim,history,at,values),`${add(values,at)}<=${nowSql}`];
  await this.db.prepare(`INSERT INTO contribution_claim_events(claim_id,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
}
