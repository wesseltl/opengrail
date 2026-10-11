import {networkAgentSchema} from './network-model';
import {boundedStrategyRecord,boundedStrategyCommand,strategyPublishCommandForRecord,verifyStrategyProgram,strategyAuthorReference,type StrategyPublicItem} from './strategy-model';
import {boundedExperimentRecord,boundedExperimentCommand,experimentDigest,experimentPublicHumanId,experimentAuthorReference,experimentPublicEventSchema,experimentPrivateReportSchema,type ExperimentActor,type ExperimentAuthorReference,type ExperimentPublicItem} from './experiment-model';
import {experimentReviewLimits,ExperimentReviewError,boundedExperimentReviewCommand,boundedExperimentReviewRecord,experimentReviewContent,experimentReviewCommandForRecord,experimentReviewPublicItemSchema,experimentReviewSummarySchema,experimentReviewListSchema,experimentReviewGetSchema,experimentReviewWriteSchema,experimentReviewReportsSchema,validateExperimentReviewBindings,type ExperimentReviewCommand,type ExperimentReviewRecord,type ExperimentReviewActor,type ExperimentReviewPublicItem,type ExperimentReviewVerificationMemo,createExperimentReviewVerificationMemo} from './experiment-review-model';

type Actor=ExperimentReviewActor|Extract<ExperimentActor,{kind:'AGENT'}>;
type Row={id:string;original_id:string;original_digest:string;sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type EventRow={record_id:string;sequence:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;state:string;reason:string;created_at:string};
type ReportRow={author_key:string;request_id:string;sponsor_key:string;record_id:string;record_digest:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type Checked={row:Row;record:ExperimentReviewRecord};
type Context={actor:Actor;reference:ExperimentAuthorReference;key:string;sponsor:string};
type Values=(string|number)[];
type Reference={id:string;digest:string};
type ExperimentRow={id:string;type:string;manifest_id:string|null;manifest_digest:string|null;strategy_id:string;strategy_digest:string;author_key:string;sponsor_key:string;request_id:string;command_digest:string;payload:string|null;digest:string;created_at:string};
type StrategyRow={id:string;root_id:string;revision:number;author_key:string;sponsor_key:string;request_id:string;command_digest:string;created_at:string;digest:string;payload:string|null};
type Scope={canonical:Map<string,Promise<unknown>>;canonicalBytes:number;verificationMemo:ExperimentReviewVerificationMemo;experimentRows?:Map<string,ExperimentRow>;strategyRows?:Map<string,StrategyRow>};
const readScope=():Scope=>({canonical:new Map(),canonicalBytes:0,verificationMemo:createExperimentReviewVerificationMemo()});
async function canonical<T>(scope:Scope,material:string,verify:()=>Promise<T>):Promise<T>{const key=await experimentDigest(material),retained=scope.canonical.get(key);if(retained)return retained as Promise<T>;const size=new TextEncoder().encode(material).byteLength,pending=verify();if(scope.canonical.size<128&&scope.canonicalBytes+size<=16_777_216){scope.canonical.set(key,pending);scope.canonicalBytes+=size;}return pending;}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
const nowSql="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const namespace=['experiment_records','experiment_moderation','experiment_reports','experiment_reviews','experiment_review_moderation','experiment_review_reports'];
const limitedPayload=(maximum:number)=>`CASE WHEN length(CAST(payload AS BLOB))<=${maximum} THEN payload ELSE NULL END AS payload`;
const experimentColumns=`id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,${limitedPayload(589824)},digest,created_at`;
const strategyColumns=`id,root_id,revision,author_key,sponsor_key,request_id,command_digest,created_at,digest,${limitedPayload(28672)}`;
const columns=`id,original_id,original_digest,sequence,author_key,sponsor_key,request_id,command_digest,${limitedPayload(experimentReviewLimits.recordBytes)},digest,created_at`;
const eventColumns=`record_id,sequence,author_key,sponsor_key,request_id,command_digest,${limitedPayload(4096)},digest,state,reason,created_at`;
const reportColumns=`author_key,request_id,sponsor_key,record_id,record_digest,command_digest,${limitedPayload(4096)},digest,created_at`;
const inconsistent=()=>new ExperimentReviewError('Experiment review records are inconsistent. Retained evidence was preserved.',503);
const authorKey=(reference:ExperimentAuthorReference)=>reference.kind+':'+reference.id;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const add=(values:Values,value:string|number)=>{values.push(value);return '?'+values.length;};
const policy='public-experiment-review-v1' as const;
function identity(id:string,digest?:string){if(typeof id!=='string'||!uuid.test(id)||digest!==undefined&&(typeof digest!=='string'||!hash.test(digest)))throw new ExperimentReviewError('Invalid review identity or digest.',400);}
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new ExperimentReviewError('Invalid review timestamp.',400);}
function retryAfter(at:string){const d=new Date(at);return Math.max(1,Math.ceil((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)-Date.parse(at))/1000));}

/** Pure record/report correlation only. No evaluator or contributed code executes here. */
export class ExperimentReviewRepository{
 constructor(private db:D1Database){}
 private async context(actor:Actor,at:string):Promise<Context>{
  clock(at);let reference:ExperimentAuthorReference;
  if(actor?.kind==='HUMAN'){
   if(typeof actor.moderator!=='boolean'||typeof actor.reviewer!=='boolean')throw new ExperimentReviewError('Invalid review participant context.',403);
   const id=await experimentPublicHumanId(actor.userId);reference={kind:'HUMAN',id,sponsorId:id};
  }else if(actor?.kind==='AGENT'){
   try{
    const p=actor.principal,a=networkAgentSchema.parse(JSON.parse(p.payload));
    if(a.id!==p.agentId||a.credentialId!==p.credentialId||a.name!==p.name||a.expiresAt!==p.expiresAt||a.revision!==1||a.revokedAt!==null||!hash.test(p.registryDigest)||!hash.test(p.tokenDigest)||JSON.stringify(a)!==p.payload||await experimentDigest(p.payload)!==p.registryDigest||at<a.createdAt||at>=a.expiresAt)throw Error();
    reference={kind:'AGENT',id:a.id,sponsorId:await experimentPublicHumanId(p.ownerId)};
   }catch{throw new ExperimentReviewError('Agent credential is invalid, expired or revoked.',401);}
  }else throw new ExperimentReviewError('Authentication is required.',401);
  return {actor,reference,key:authorKey(reference),sponsor:reference.sponsorId};
 }
 private credentialClause(context:Context,at:string,values:Values){
  if(context.actor.kind!=='AGENT')return '1=1';const p=context.actor.principal;
  const owner=add(values,p.ownerId),agent=add(values,p.agentId),credential=add(values,p.credentialId),token=add(values,p.tokenDigest),digest=add(values,p.registryDigest),payload=add(values,p.payload),time=add(values,at);
  return `EXISTS(SELECT 1 FROM network_agents WHERE owner_id=${owner} AND id=${agent} AND credential_id=${credential} AND token_digest=${token} AND digest=${digest} AND payload=${payload} AND revision=1 AND revoked_at IS NULL AND created_at<=${time} AND created_at<=${nowSql} AND expires_at>${time} AND expires_at>${nowSql})`;
 }
 private async requireCredential(context:Context,at:string){if(context.actor.kind==='AGENT'){const values:Values=[];if(!await this.db.prepare('SELECT 1 AS active WHERE '+this.credentialClause(context,at,values)).bind(...values).first())throw new ExperimentReviewError('Agent credential is invalid, expired or revoked.',401);}}
 private requestClause(context:Context,requestId:string,values:Values){const author=add(values,context.key),request=add(values,requestId);return namespace.map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE author_key=${author} AND request_id=${request})`).join(' AND ');}
 private async check(row:Row,scope:Scope):Promise<Checked>{
  const checked=await canonical(scope,'R:'+JSON.stringify(row),async()=>{try{
   if(!row.payload||!hash.test(row.digest)||!hash.test(row.command_digest))throw Error();
   const {record,payload}=boundedExperimentReviewRecord(JSON.parse(row.payload));
   if(payload!==row.payload||await experimentDigest(payload)!==row.digest||record.id!==row.id||record.content.target.original.id!==row.original_id||record.content.target.original.digest!==row.original_digest||record.sequence!==row.sequence||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(record.author)!==row.author_key||record.author.sponsorId!==row.sponsor_key)throw Error();
   const command=boundedExperimentReviewCommand(experimentReviewCommandForRecord(record));if(await experimentDigest(command.payload)!==row.command_digest)throw Error();
   return {row,record};
  }catch{throw inconsistent();}});
  try{await this.bindings(checked.record,scope);return checked;}catch{throw inconsistent();}
 }
 private async experiment(reference:Reference,scope:Scope){
  identity(reference.id,reference.digest);
  const row=scope.experimentRows?.get(reference.id)??await this.db.prepare(`SELECT ${experimentColumns} FROM experiment_records WHERE id=?`).bind(reference.id).first<ExperimentRow>();
  if(!row||row.digest!==reference.digest)throw new ExperimentReviewError('Exact experiment reference not found.',404);
  return canonical(scope,'E:'+JSON.stringify(row),async()=>{try{
   if(!row.payload)throw Error();const checked=boundedExperimentRecord(JSON.parse(row.payload)),record=checked.record;
   if(checked.payload!==row.payload||await experimentDigest(row.payload)!==row.digest||record.id!==row.id||record.type!==row.type||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(experimentAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key||await experimentDigest(boundedExperimentCommand({action:record.type==='MANIFEST'?'register':'outcome',requestId:record.requestId,id:record.id,...record.content,policyAccepted:record.policyAccepted}).payload)!==row.command_digest)throw Error();
   if(record.type==='MANIFEST'?(row.manifest_id!==null||row.manifest_digest!==null):(row.manifest_id!==record.content.manifest.id||row.manifest_digest!==record.content.manifest.digest))throw Error();
   const full:ExperimentPublicItem={id:record.id,digest:row.digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:experimentAuthorReference(record.author),strategy:{id:row.strategy_id,digest:row.strategy_digest},manifest:record.type==='OUTCOME'?record.content.manifest:null,state:'VISIBLE',reason:null,suppression:null,reporting:record.type==='OUTCOME'?'AUTHOR_REPORTED':'UNREPORTED',outcomeCount:0,record,moderation:[]};
   return {row,record,full};
  }catch{throw inconsistent();}});
 }
 private async strategy(reference:Reference,scope:Scope){
  identity(reference.id,reference.digest);
  const row=scope.strategyRows?.get(reference.id)??await this.db.prepare(`SELECT ${strategyColumns} FROM strategy_publications WHERE id=?`).bind(reference.id).first<StrategyRow>();
  if(!row||row.digest!==reference.digest)throw new ExperimentReviewError('Exact strategy reference not found.',404);
  return canonical(scope,'S:'+JSON.stringify(row),async()=>{try{
   if(!row.payload)throw Error();const checked=boundedStrategyRecord(JSON.parse(row.payload));const record=checked.record;await verifyStrategyProgram(record);if(checked.payload!==row.payload||record.id!==row.id||record.rootId!==row.root_id||record.revision!==row.revision||record.requestId!==row.request_id||record.createdAt!==row.created_at||authorKey(strategyAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key||await experimentDigest(row.payload)!==row.digest||await experimentDigest(boundedStrategyCommand(strategyPublishCommandForRecord(record)).payload)!==row.command_digest)throw Error();
   const full:StrategyPublicItem={id:record.id,digest:row.digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]};
   return {row,full};
  }catch{throw inconsistent();}});
 }
 private async bindings(record:ExperimentReviewRecord,scope:Scope){
  const target=record.content.target;
  const [original,reproduction,manifest,strategy]=await Promise.all([this.experiment(target.original,scope),this.experiment(target.reproduction,scope),this.experiment(target.manifest,scope),this.strategy(target.strategy,scope)]);
  await validateExperimentReviewBindings(experimentReviewCommandForRecord(record),{original:original.full,reproduction:reproduction.full,manifest:manifest.full,strategy:strategy.full},record.author,record.createdAt,scope.verificationMemo);
  return {original,reproduction,manifest,strategy};
 }
 private async hydrate(records:ExperimentReviewRecord[],scope:Scope){
  const experiments=[...new Set(records.flatMap(record=>[record.content.target.original.id,record.content.target.reproduction.id,record.content.target.manifest.id]))],strategies=[...new Set(records.map(record=>record.content.target.strategy.id))];
  if(experiments.length>96||strategies.length>32)throw inconsistent();
  const [e,s]=await Promise.all([experiments.length?this.db.prepare(`SELECT ${experimentColumns} FROM experiment_records WHERE id IN (${experiments.map(()=>'?').join(',')}) LIMIT 97`).bind(...experiments).all<ExperimentRow>():Promise.resolve({results:[] as ExperimentRow[]}),strategies.length?this.db.prepare(`SELECT ${strategyColumns} FROM strategy_publications WHERE id IN (${strategies.map(()=>'?').join(',')}) LIMIT 33`).bind(...strategies).all<StrategyRow>():Promise.resolve({results:[] as StrategyRow[]})]);
  if(e.results.length!==experiments.length||s.results.length!==strategies.length||e.results.some(row=>!experiments.includes(row.id))||s.results.some(row=>!strategies.includes(row.id))||new Set(e.results.map(row=>row.id)).size!==e.results.length||new Set(s.results.map(row=>row.id)).size!==s.results.length)throw inconsistent();
  scope.experimentRows=new Map(e.results.map(row=>[row.id,row]));scope.strategyRows=new Map(s.results.map(row=>[row.id,row]));
 }
 private async history(original:Reference,scope:Scope){
  const rows=(await this.db.prepare(`SELECT ${columns} FROM experiment_reviews WHERE original_id=? ORDER BY sequence LIMIT ${experimentReviewLimits.reviewsPerOutcome+1}`).bind(original.id).all<Row>()).results;
  if(rows.length>experimentReviewLimits.reviewsPerOutcome)throw inconsistent();
  let records:ExperimentReviewRecord[];try{records=rows.map(row=>{if(!row.payload)throw Error();return boundedExperimentReviewRecord(JSON.parse(row.payload)).record;});}catch{throw inconsistent();}
  await this.hydrate(records,scope);const checked=await Promise.all(rows.map(row=>this.check(row,scope)));let previous:Checked|null=null;
  for(const item of checked){
   if(item.record.sequence!==(previous?.record.sequence??0)+1||!same(item.record.content.target.original,original)||!same(item.record.content.previous,previous?{id:previous.record.id,digest:previous.row.digest}:null)||previous&&item.record.createdAt<previous.record.createdAt)throw inconsistent();previous=item;
  }
  return checked;
 }
 private async publication(recordId:string,digest:string|undefined,scope:Scope){
  identity(recordId,digest);const row=await this.db.prepare(`SELECT ${columns} FROM experiment_reviews WHERE id=?`).bind(recordId).first<Row>();
  if(!row||digest!==undefined&&row.digest!==digest)throw new ExperimentReviewError('Exact experiment review not found.',404);
  const checked=await this.check(row,scope),history=await this.history(checked.record.content.target.original,scope),retained=history.find(item=>item.record.id===recordId);
  if(!retained||!same(retained.row,row))throw inconsistent();return checked;
 }
 private async events(publication:Checked,provided?:EventRow[]){
  const rows=provided??(await this.db.prepare(`SELECT ${eventColumns} FROM experiment_review_moderation WHERE record_id=? ORDER BY sequence LIMIT ${experimentReviewLimits.eventsPerRecord+1}`).bind(publication.record.id).all<EventRow>()).results;
  if(rows.length>experimentReviewLimits.eventsPerRecord)throw inconsistent();const events:ReturnType<typeof experimentPublicEventSchema.parse>[]=[];let state='VISIBLE',time=publication.record.createdAt;
  for(const row of rows){try{
   if(!row.payload)throw Error();const event=experimentPublicEventSchema.parse(JSON.parse(row.payload));
   if(JSON.stringify(event)!==row.payload||await experimentDigest(row.payload)!==row.digest||event.sequence!==events.length+1||row.record_id!==publication.record.id||event.sequence!==row.sequence||event.requestId!==row.request_id||event.createdAt!==row.created_at||event.state!==row.state||event.reason!==row.reason||authorKey(event.actor)!==row.author_key||event.actor.sponsorId!==row.sponsor_key||state==='WITHDRAWN'||event.createdAt<time||event.actor.kind!=='HUMAN')throw Error();
   const command=boundedExperimentReviewCommand(event.state==='WITHDRAWN'?{action:'withdraw',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,reason:event.reason,policyAccepted:policy}:{action:'moderate',requestId:event.requestId,id:publication.record.id,digest:publication.row.digest,state:event.state,reason:event.reason,policyAccepted:policy});
   if(await experimentDigest(command.payload)!==row.command_digest||event.state!=='WITHDRAWN'&&event.sequence>=experimentReviewLimits.eventsPerRecord||event.state==='WITHDRAWN'&&!same(event.actor,publication.record.author))throw Error();events.push(event);state=event.state;time=event.createdAt;
  }catch{throw inconsistent();}}
  return {rows,events,state:state as ExperimentReviewPublicItem['state'],reason:events.at(-1)?.reason??null};
 }
 private async currentState(table:string,item:{id:string;digest:string;createdAt:string},provided?:EventRow[]){
  const rows=provided??(await this.db.prepare(`SELECT ${eventColumns} FROM ${table} WHERE record_id=? ORDER BY sequence LIMIT 17`).bind(item.id).all<EventRow>()).results;
  if(rows.length>16)throw inconsistent();let state='VISIBLE',time=item.createdAt;
  for(let n=0;n<rows.length;n++){const row=rows[n];try{
   if(!row.payload)throw Error();const event=experimentPublicEventSchema.parse(JSON.parse(row.payload));
   if(JSON.stringify(event)!==row.payload||await experimentDigest(row.payload)!==row.digest||row.record_id!==item.id||event.sequence!==n+1||row.sequence!==event.sequence||row.state!==event.state||row.reason!==event.reason||row.created_at!==event.createdAt||row.request_id!==event.requestId||row.author_key!==authorKey(event.actor)||row.sponsor_key!==event.actor.sponsorId||state==='WITHDRAWN'||event.createdAt<time||event.state!=='WITHDRAWN'&&(event.actor.kind!=='HUMAN'||event.sequence>=16))throw Error();
   const acceptedPolicy=table==='strategy_moderation'?'public-strategy-v1':'public-experiment-v1',command={action:event.state==='WITHDRAWN'?'withdraw':'moderate',requestId:event.requestId,id:item.id,digest:item.digest,...event.state==='WITHDRAWN'?{}:{state:event.state},reason:event.reason,policyAccepted:acceptedPolicy};
   if(await experimentDigest((table==='strategy_moderation'?boundedStrategyCommand(command):boundedExperimentCommand(command)).payload)!==row.command_digest)throw Error();state=event.state;time=event.createdAt;
  }catch{throw inconsistent();}}
  return state;
 }
 private async availability(publication:{record:ExperimentReviewRecord},scope:Scope){
  const {original,reproduction,manifest,strategy}=await this.bindings(publication.record,scope);
  const [sourceState,parentState,originalState,reproductionState]=await Promise.all([this.currentState('strategy_moderation',strategy.full),this.currentState('experiment_moderation',manifest.full),this.currentState('experiment_moderation',original.full),this.currentState('experiment_moderation',reproduction.full)]);
  return sourceState!=='VISIBLE'?'SOURCE_UNAVAILABLE' as const:parentState!=='VISIBLE'?'PARENT_UNAVAILABLE' as const:originalState!=='VISIBLE'||reproductionState!=='VISIBLE'?'OUTCOME_UNAVAILABLE' as const:null;
 }
 private async projectionPass(publications:Checked[],scope:Scope){
  const bound=await Promise.all(publications.map(publication=>this.bindings(publication.record,scope))),experimentItems=new Map<string,ExperimentPublicItem>(),strategyItems=new Map<string,StrategyPublicItem>();
  for(const refs of bound){for(const item of [refs.original.full,refs.reproduction.full,refs.manifest.full])experimentItems.set(item.id,item);strategyItems.set(refs.strategy.full.id,refs.strategy.full);}
  const read=async(table:string,ids:string[])=>ids.length?(await this.db.prepare(`SELECT ${eventColumns} FROM ${table} WHERE record_id IN (${ids.map(()=>'?').join(',')}) ORDER BY record_id,sequence LIMIT ${ids.length*17+1}`).bind(...ids).all<EventRow>()).results:[];
  const [ownRows,experimentRows,strategyRows]=await Promise.all([read('experiment_review_moderation',publications.map(item=>item.record.id)),read('experiment_moderation',[...experimentItems.keys()]),read('strategy_moderation',[...strategyItems.keys()])]);
  const group=(rows:EventRow[],ids:Set<string>)=>{const result=new Map<string,EventRow[]>();for(const row of rows){if(!ids.has(row.record_id))throw inconsistent();const prior=result.get(row.record_id)??[];prior.push(row);if(prior.length>16)throw inconsistent();result.set(row.record_id,prior);}return result;};
  const own=group(ownRows,new Set(publications.map(item=>item.record.id))),e=group(experimentRows,new Set(experimentItems.keys())),s=group(strategyRows,new Set(strategyItems.keys())),states=new Map<string,string>();
  await Promise.all([...experimentItems.values()].map(async item=>states.set(item.id,await this.currentState('experiment_moderation',item,e.get(item.id)??[]))));await Promise.all([...strategyItems.values()].map(async item=>states.set(item.id,await this.currentState('strategy_moderation',item,s.get(item.id)??[]))));
  return Promise.all(publications.map(async(publication,index)=>{
   const history=await this.events(publication,own.get(publication.record.id)??[]),refs=bound[index],suppression=states.get(refs.strategy.full.id)!=='VISIBLE'?'SOURCE_UNAVAILABLE' as const:states.get(refs.manifest.full.id)!=='VISIBLE'?'PARENT_UNAVAILABLE' as const:states.get(refs.original.full.id)!=='VISIBLE'||states.get(refs.reproduction.full.id)!=='VISIBLE'?'OUTCOME_UNAVAILABLE' as const:null,state=history.state==='WITHDRAWN'?'WITHDRAWN':history.state==='HIDDEN'||suppression?'HIDDEN':'VISIBLE',record=publication.record;
   return experimentReviewPublicItemSchema.parse({id:record.id,digest:publication.row.digest,requestId:record.requestId,createdAt:record.createdAt,author:record.author,sequence:record.sequence,target:record.content.target,previous:record.content.previous,state,reason:history.reason,suppression,decision:state==='VISIBLE'?record.content.decision:null,record:state==='VISIBLE'?record:null,moderation:history.events});
  }));
 }
 private async project(publication:Checked,scope:Scope):Promise<ExperimentReviewPublicItem>{
  const first=(await this.projectionPass([publication],scope))[0];
  await this.history(publication.record.content.target.original,scope);
  const second=(await this.projectionPass([publication],scope))[0];return first.state!=='VISIBLE'&&second.state==='VISIBLE'?first:second;
 }
 private summary(item:ExperimentReviewPublicItem){const {record,moderation,...metadata}=item;void moderation;return experimentReviewSummarySchema.parse({...metadata,reasons:record?.content.reasons??[]});}
 async get(recordId:string,digest?:string){const scope=readScope();return experimentReviewGetSchema.parse({version:1,item:await this.project(await this.publication(recordId,digest,scope),scope),executionEnabled:false});}
 async list(originalId:string,digest:string,cursor?:string|null){
  const scope=readScope();identity(originalId,digest);if(cursor)identity(cursor);const reference={id:originalId,digest},target=await this.experiment(reference,scope);if(target.record.type!=='OUTCOME'||target.record.content.claim.type!=='ORIGINAL')throw new ExperimentReviewError('Exact original outcome not found.',404);
  const history=await this.history(reference,scope),anchor=cursor?history.find(item=>item.record.id===cursor):null;if(cursor&&!anchor)throw new ExperimentReviewError('Review cursor does not belong to this exact outcome.',404);
  const ordered=history.toSorted((a,b)=>b.record.createdAt.localeCompare(a.record.createdAt)||b.record.id.localeCompare(a.record.id)),selected=ordered.filter(item=>!anchor||item.record.createdAt<anchor.record.createdAt||item.record.createdAt===anchor.record.createdAt&&item.record.id<anchor.record.id),page=selected.slice(0,experimentReviewLimits.page);
  const first=await this.projectionPass(page,scope);
  // A late source/parent/outcome suppression must not release an earlier page projection.
  const currentHistory=await this.history(reference,scope),head=currentHistory.at(-1)??null;
  const second=await this.projectionPass(page,scope),projected=second.map((fresh,index)=>first[index].state!=='VISIBLE'&&fresh.state==='VISIBLE'?first[index]:fresh);
  return experimentReviewListSchema.parse({version:1,target:reference,currentHead:head?{id:head.record.id,digest:head.row.digest,sequence:head.record.sequence}:null,items:projected.map(item=>this.summary(item)),nextCursor:selected.length>experimentReviewLimits.page?page.at(-1)!.record.id:null,executionEnabled:false});
 }
 private async checkReport(row:ReportRow){try{
  if(!row.payload)throw Error();const report=experimentPrivateReportSchema.parse(JSON.parse(row.payload));
  if(JSON.stringify(report)!==row.payload||await experimentDigest(row.payload)!==row.digest||report.requestId!==row.request_id||report.id!==row.record_id||report.digest!==row.record_digest||report.createdAt!==row.created_at||authorKey(report.reporter)!==row.author_key||report.reporter.sponsorId!==row.sponsor_key||await experimentDigest(boundedExperimentReviewCommand({action:'report',requestId:report.requestId,id:report.id,digest:report.digest,reason:report.reason,details:report.details,policyAccepted:policy}).payload)!==row.command_digest)throw Error();return report;
 }catch{throw inconsistent();}}
 async reports(actor:Actor,at:string,cursor?:string|null){
  const context=await this.context(actor,at);if(context.actor.kind!=='HUMAN'||!context.actor.moderator)throw new ExperimentReviewError('Explicit moderator authorization is required.',403);
  if(cursor&&!hash.test(cursor))throw new ExperimentReviewError('Invalid private report cursor.',400);let anchor:ReportRow|null=null;
  if(cursor){const rows=(await this.db.prepare(`SELECT ${reportColumns} FROM experiment_review_reports WHERE digest=? LIMIT 2`).bind(cursor).all<ReportRow>()).results;if(!rows.length)throw new ExperimentReviewError('Report cursor not found.',404);if(rows.length!==1)throw inconsistent();anchor=rows[0];await this.checkReport(anchor);}
  const rows=(await this.db.prepare(`SELECT ${reportColumns} FROM experiment_review_reports ${anchor?'WHERE created_at<? OR (created_at=? AND author_key<?) OR (created_at=? AND author_key=? AND request_id<?)':''} ORDER BY created_at DESC,author_key DESC,request_id DESC LIMIT ${experimentReviewLimits.page+1}`).bind(...anchor?[anchor.created_at,anchor.created_at,anchor.author_key,anchor.created_at,anchor.author_key,anchor.request_id]:[]).all<ReportRow>()).results;
  const checked=await Promise.all(rows.map(row=>this.checkReport(row))),page=checked.slice(0,experimentReviewLimits.page);
  return experimentReviewReportsSchema.parse({version:1,reports:page,nextCursor:rows.length>experimentReviewLimits.page?rows[experimentReviewLimits.page-1].digest:null,executionEnabled:false});
 }
 private async replay(context:Context,command:ExperimentReviewCommand,commandDigest:string,at:string,scope:Scope){
  await this.requireCredential(context,at);
  const [reviews,events,reports,old]=await Promise.all([
   this.db.prepare(`SELECT ${columns} FROM experiment_reviews WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<Row>(),
   this.db.prepare(`SELECT ${eventColumns} FROM experiment_review_moderation WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<EventRow>(),
   this.db.prepare(`SELECT ${reportColumns} FROM experiment_review_reports WHERE author_key=? AND request_id=? LIMIT 2`).bind(context.key,command.requestId).all<ReportRow>(),
   this.db.prepare('SELECT 1 AS retained FROM experiment_records WHERE author_key=? AND request_id=? UNION ALL SELECT 1 FROM experiment_moderation WHERE author_key=? AND request_id=? UNION ALL SELECT 1 FROM experiment_reports WHERE author_key=? AND request_id=? LIMIT 2').bind(context.key,command.requestId,context.key,command.requestId,context.key,command.requestId).all<{retained:number}>(),
  ]);
  const total=reviews.results.length+events.results.length+reports.results.length;if(total>1||old.results.length&&total)throw inconsistent();if(old.results.length)throw new ExperimentReviewError('Request ID already used for different experiment material.');const row=reviews.results[0]??events.results[0]??reports.results[0];if(!row)return null;if(row.command_digest!==commandDigest)throw new ExperimentReviewError('Request ID already used for different review material.');
  let item:ExperimentReviewPublicItem|null=null,report:null|{requestId:string;id:string;digest:string;reason:string;createdAt:string}=null;
  if(reviews.results.length){if(command.action!=='review')throw inconsistent();item=await this.project(await this.publication(reviews.results[0].id,undefined,scope),scope);}
  else if(events.results.length){if(command.action!=='withdraw'&&command.action!=='moderate')throw inconsistent();item=await this.project(await this.publication(events.results[0].record_id,undefined,scope),scope);if(!item.moderation.some(event=>event.requestId===command.requestId&&same(event.actor,context.reference)))throw inconsistent();}
  else{if(command.action!=='report')throw inconsistent();const saved=await this.checkReport(reports.results[0]);report={requestId:saved.requestId,id:saved.id,digest:saved.digest,reason:saved.reason,createdAt:saved.createdAt};}
  await this.requireCredential(context,at);return experimentReviewWriteSchema.parse({version:1,action:command.action,requestId:command.requestId,item,report,executionEnabled:false});
 }
 private targetClause(table:string,target:{row:{id:string;digest:string;payload:string|null}},values:Values){return `EXISTS(SELECT 1 FROM ${table} WHERE id=${add(values,target.row.id)} AND digest=${add(values,target.row.digest)} AND payload=${add(values,target.row.payload!)})`;}
 private visibleClause(table:string,recordId:string,values:Values){return `COALESCE((SELECT state FROM ${table} WHERE record_id=${add(values,recordId)} ORDER BY sequence DESC LIMIT 1),'VISIBLE')='VISIBLE'`;}
 private quotaClauses(context:Context,at:string,report:boolean,values:Values){const table=report?'experiment_review_reports':'experiment_reviews',total=report?experimentReviewLimits.reportsStored:experimentReviewLimits.retained,daily=report?experimentReviewLimits.reportsPerSponsorDay:experimentReviewLimits.perSponsorDay;return [`(SELECT COUNT(*) FROM ${table})<${total}`,`(SELECT COUNT(*) FROM ${table} WHERE sponsor_key=${add(values,context.sponsor)} AND substr(created_at,1,10)=${add(values,at.slice(0,10))})<${daily}`];}
 private async quota(context:Context,at:string,report:boolean){const table=report?'experiment_review_reports':'experiment_reviews',total=report?experimentReviewLimits.reportsStored:experimentReviewLimits.retained,daily=report?experimentReviewLimits.reportsPerSponsorDay:experimentReviewLimits.perSponsorDay,row=await this.db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN sponsor_key=? AND substr(created_at,1,10)=? THEN 1 ELSE 0 END),0) AS daily FROM ${table}`).bind(context.sponsor,at.slice(0,10)).first<{total:number;daily:number}>();if(!row)throw inconsistent();if(row.total>=total)throw new ExperimentReviewError('Retained review capacity reached. No automatic reset is promised.',429);if(row.daily>=daily)throw new ExperimentReviewError('The sponsor’s UTC-day review limit has been reached.',429,retryAfter(at));}
 async write(actor:Actor,raw:unknown,at:string){
  const scope=readScope(),context=await this.context(actor,at);await this.requireCredential(context,at);let parsed:ReturnType<typeof boundedExperimentReviewCommand>;
  try{parsed=boundedExperimentReviewCommand(raw);}catch(error){if(error instanceof ExperimentReviewError)throw error;throw new ExperimentReviewError('Invalid experiment review command.',400);}
  const {command,payload}=parsed;
  if(command.action==='review'&&(context.actor.kind!=='HUMAN'||!context.actor.reviewer))throw new ExperimentReviewError('Explicit human reviewer authorization is required.',403);
  if(command.action==='moderate'&&(context.actor.kind!=='HUMAN'||!context.actor.moderator))throw new ExperimentReviewError('Explicit moderator authorization is required.',403);
  if(context.actor.kind==='AGENT'&&command.action!=='report')throw new ExperimentReviewError('Agents may only report reviews privately.',403);
  const digest=await experimentDigest(payload),saved=await this.replay(context,command,digest,at,scope);if(saved)return saved;
  try{
   if(command.action==='review')await this.publish(context,command,digest,at,scope);else{const target=await this.publication(command.id,command.digest,scope);if(at<target.record.createdAt)throw new ExperimentReviewError('Submission precedes the review.');if(command.action==='report')await this.report(context,command,digest,at,target);else await this.moderate(context,command,digest,at,target);}
  }catch(error){const retry=await this.replay(context,command,digest,at,scope);if(retry)return retry;throw error;}
  const receipt=await this.replay(context,command,digest,at,scope);if(receipt)return receipt;await this.requireCredential(context,at);if(command.action==='review'||command.action==='report')await this.quota(context,at,command.action==='report');throw new ExperimentReviewError('Review identity, exact evidence, visibility, history or capacity changed. Refresh before retrying; no write was confirmed.');
 }
 private async publish(context:Context,command:Extract<ExperimentReviewCommand,{action:'review'}>,commandDigest:string,at:string,scope:Scope){
  if(context.reference.kind!=='HUMAN')throw new ExperimentReviewError('Human reviewer required.',403);await this.quota(context,at,false);
  const history=await this.history(command.target.original,scope),head=history.at(-1)??null;
  if(!same(command.previous,head?{id:head.record.id,digest:head.row.digest}:null))throw new ExperimentReviewError('The exact previous review has changed.');if(history.length>=experimentReviewLimits.reviewsPerOutcome)throw new ExperimentReviewError('This outcome’s retained review capacity has been reached.',429);if(head&&at<head.record.createdAt)throw new ExperimentReviewError('Review time precedes its retained history.');
  const {record,payload}=boundedExperimentReviewRecord({version:1,id:command.id,requestId:command.requestId,createdAt:at,author:context.reference,sequence:history.length+1,content:experimentReviewContent(command),policyAccepted:command.policyAccepted,classification:'REVIEW_ATTESTATION',executionAssurance:'TRUSTED_HUMAN_ATTESTATION',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false});
  let bindings:Awaited<ReturnType<ExperimentReviewRepository['bindings']>>;
  try{bindings=await this.bindings(record,scope);}catch(error){if(error instanceof ExperimentReviewError)throw error;throw new ExperimentReviewError('Review evidence does not match its exact retained references.',400);}
  if(await this.availability({record},scope))throw new ExperimentReviewError('Review evidence is not currently visible.');
  const digest=await experimentDigest(payload),values:Values=[record.id,command.target.original.id,command.target.original.digest,record.sequence,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),...this.quotaClauses(context,at,false,values),`(SELECT COUNT(*) FROM experiment_reviews WHERE original_id=?2)<${experimentReviewLimits.reviewsPerOutcome}`,`COALESCE((SELECT MAX(sequence) FROM experiment_reviews WHERE original_id=?2),0)=${history.length}`];
  for(const bound of [bindings.original,bindings.reproduction,bindings.manifest])clauses.push(this.targetClause('experiment_records',bound,values),this.visibleClause('experiment_moderation',bound.row.id,values));clauses.push(this.targetClause('strategy_publications',bindings.strategy,values),this.visibleClause('strategy_moderation',bindings.strategy.row.id,values));
  if(head)clauses.push(this.targetClause('experiment_reviews',head,values));
  await this.db.prepare(`INSERT INTO experiment_reviews(id,original_id,original_digest,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async report(context:Context,command:Extract<ExperimentReviewCommand,{action:'report'}>,commandDigest:string,at:string,target:Checked){
  await this.quota(context,at,true);const report=experimentPrivateReportSchema.parse({requestId:command.requestId,id:target.record.id,digest:target.row.digest,reason:command.reason,details:command.details,createdAt:at,reporter:context.reference}),payload=JSON.stringify(report);if(new TextEncoder().encode(payload).byteLength>4096)throw new ExperimentReviewError('Private report is too large.',413);const digest=await experimentDigest(payload),values:Values=[context.key,command.requestId,context.sponsor,target.record.id,target.row.digest,commandDigest,payload,digest,at];
  const clauses=[this.requestClause(context,command.requestId,values),this.credentialClause(context,at,values),this.targetClause('experiment_reviews',target,values),...this.quotaClauses(context,at,true,values)];await this.db.prepare(`INSERT INTO experiment_review_reports(author_key,request_id,sponsor_key,record_id,record_digest,command_digest,payload,digest,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
 private async moderate(context:Context,command:Extract<ExperimentReviewCommand,{action:'withdraw'|'moderate'}>,commandDigest:string,at:string,target:Checked){
  const history=await this.events(target);if(history.state==='WITHDRAWN')throw new ExperimentReviewError('Withdrawn reviews cannot be restored.');
  if(command.action==='withdraw'&&(context.reference.kind!=='HUMAN'||!same(context.reference,target.record.author)))throw new ExperimentReviewError('Only the original human author may withdraw this review.',403);
  const maximum=command.action==='withdraw'?experimentReviewLimits.eventsPerRecord:experimentReviewLimits.eventsPerRecord-1;if(history.events.length>=maximum)throw new ExperimentReviewError('Review event history is full; its final slot is reserved for withdrawal.');if(at<(history.events.at(-1)?.createdAt??target.record.createdAt))throw new ExperimentReviewError('Disposition time precedes retained history.');
  const event=experimentPublicEventSchema.parse({sequence:history.events.length+1,requestId:command.requestId,createdAt:at,actor:context.reference,state:command.action==='withdraw'?'WITHDRAWN':command.state,reason:command.reason}),payload=JSON.stringify(event),digest=await experimentDigest(payload),values:Values=[target.record.id,event.sequence,context.key,context.sponsor,command.requestId,commandDigest,payload,digest,event.state,event.reason,at],record=add(values,target.record.id);
  const clauses=[this.requestClause(context,command.requestId,values),this.targetClause('experiment_reviews',target,values),`COALESCE((SELECT MAX(sequence) FROM experiment_review_moderation WHERE record_id=${record}),0)=${history.events.length}`,`NOT EXISTS(SELECT 1 FROM experiment_review_moderation WHERE record_id=${record} AND state='WITHDRAWN')`];
  if(history.rows.length){const previous=history.rows.at(-1)!;clauses.push(`EXISTS(SELECT 1 FROM experiment_review_moderation WHERE record_id=${record} AND sequence=${add(values,previous.sequence)} AND digest=${add(values,previous.digest)} AND payload=${add(values,previous.payload!)})`);}
  await this.db.prepare(`INSERT INTO experiment_review_moderation(record_id,sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE ${clauses.join(' AND ')} ON CONFLICT DO NOTHING`).bind(...values).run();
 }
}
