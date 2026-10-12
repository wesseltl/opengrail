import {boundedStrategyRecord,boundedStrategyCommand,strategyPublishCommandForRecord,strategyAuthorReference,strategyPublicEventSchema,type StrategyRecord} from './strategy-model';
import {strategyLineageLimits,verifyStrategyLineageRelation} from './strategy-lineage-model';
import {programCommitmentDependencies,type ProgramCommitmentInput} from './program-commitment-model';
import {ExperimentError,experimentDigest} from './experiment-model';

/** Existing write budgets are not enlarged. These are additional read/fence bounds. */
export const experimentCommitmentStoreLimits=Object.freeze({minimumLeadMs:60000,ancestors:32,closure:40,recursiveRows:132,sourceBytes:28672,events:16,snapshotBytes:1048576,contextWriteFenceBytes:2097152,readFenceBytes:8388608,readFenceChunkBytes:2097152,fenceSnapshots:20,fenceRecords:96,recordReadChunk:4,maximumBindParameters:96,maximumClosureQueries:2});
type SourceRow={id:string;digest:string;payload:string|null;root_id:string;revision:number;request_id:string;command_digest:string;created_at:string;author_key:string;sponsor_key:string;events:string};
export type CommitmentSourceSnapshot=Omit<SourceRow,'events'|'payload'>&{payload:string;visible:boolean;events:Array<{sequence:number;payload:string;digest:string;command_digest:string;author_key:string;sponsor_key:string;request_id:string;state:string;reason:string;created_at:string}>;record:StrategyRecord};
const bad=()=>new ExperimentError('Commitment source closure is unavailable or inconsistent. Retained material was preserved.',503);
const key=(value:{kind:string;id:string})=>value.kind+':'+value.id;
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;

/** One bounded recursive observation; no descendant enumeration or submitted code. */
export async function readCommitmentSourceClosure(db:D1Database,plan:ProgramCommitmentInput):Promise<CommitmentSourceSnapshot[]>{
 const dependencies=programCommitmentDependencies(plan),safe="CASE WHEN length(CAST(p.payload AS BLOB))<=28672 AND json_valid(p.payload) THEN p.payload ELSE '{}' END",parent=`json_extract(${safe},'$.content.relation.id')`;
 const sql=`WITH RECURSIVE closure(id,depth,path) AS (SELECT id,0,','||id||',' FROM strategy_publications WHERE id IN (${dependencies.map(()=>'?').join(',')}) UNION ALL SELECT ${parent},c.depth+1,c.path||${parent}||',' FROM closure c JOIN strategy_publications p ON p.id=c.id WHERE c.depth<32 AND ${parent} IS NOT NULL AND instr(c.path,','||${parent}||',')=0) SELECT p.id,p.digest,p.root_id,p.revision,p.request_id,p.command_digest,p.created_at,p.author_key,p.sponsor_key,CASE WHEN length(CAST(p.payload AS BLOB))<=28672 THEN p.payload ELSE NULL END AS payload,(SELECT json_group_array(json_object('sequence',sequence,'payload',payload,'digest',digest,'command_digest',command_digest,'author_key',author_key,'sponsor_key',sponsor_key,'request_id',request_id,'state',state,'reason',reason,'created_at',created_at)) FROM (SELECT sequence,CASE WHEN length(CAST(payload AS BLOB))<=4096 THEN payload ELSE NULL END AS payload,digest,command_digest,author_key,sponsor_key,request_id,state,reason,created_at FROM strategy_moderation WHERE record_id=p.id ORDER BY sequence LIMIT 17)) AS events FROM strategy_publications p WHERE p.id IN (SELECT id FROM closure) ORDER BY p.id LIMIT 41`;
 const rows=(await db.prepare(sql).bind(...dependencies.map(value=>value.id)).all<SourceRow>()).results;
 if(!rows.length||rows.length>experimentCommitmentStoreLimits.closure||new Set(rows.map(row=>row.id)).size!==rows.length)throw bad();
 const sources:CommitmentSourceSnapshot[]=[];
 for(const row of rows){try{
  if(!row.payload||bytes(row.payload)>experimentCommitmentStoreLimits.sourceBytes)throw Error();
  const checked=boundedStrategyRecord(JSON.parse(row.payload)),record=checked.record;
  if(checked.payload!==row.payload||await experimentDigest(row.payload)!==row.digest||record.id!==row.id||record.rootId!==row.root_id||record.revision!==row.revision||record.requestId!==row.request_id||record.createdAt!==row.created_at||key(strategyAuthorReference(record.author))!==row.author_key||record.author.sponsorId!==row.sponsor_key||await experimentDigest(boundedStrategyCommand(strategyPublishCommandForRecord(record)).payload)!==row.command_digest)throw Error();
  const events:CommitmentSourceSnapshot['events']=JSON.parse(row.events);if(!Array.isArray(events)||events.length>experimentCommitmentStoreLimits.events)throw Error();
  let state='VISIBLE',at=record.createdAt;const requests=new Set([row.author_key+':'+row.request_id]);
  for(const event of events){if(typeof event.payload!=='string'||bytes(event.payload)>4096)throw Error();const parsed=strategyPublicEventSchema.parse(JSON.parse(event.payload)),request=key(parsed.actor)+':'+parsed.requestId;
   if(JSON.stringify(parsed)!==event.payload||await experimentDigest(event.payload)!==event.digest||parsed.sequence!==events.indexOf(event)+1||event.sequence!==parsed.sequence||key(parsed.actor)!==event.author_key||parsed.actor.sponsorId!==event.sponsor_key||parsed.requestId!==event.request_id||parsed.state!==event.state||parsed.reason!==event.reason||parsed.createdAt!==event.created_at||parsed.createdAt<at||state==='WITHDRAWN'||requests.has(request)||parsed.state!=='WITHDRAWN'&&(parsed.actor.kind!=='HUMAN'||parsed.sequence>=16))throw Error();
   if(parsed.state==='WITHDRAWN'){const own=key(parsed.actor)===row.author_key,sponsor=parsed.actor.kind==='HUMAN'&&parsed.actor.id===row.sponsor_key&&parsed.actor.sponsorId===row.sponsor_key;if(!own&&!sponsor||parsed.reason==='AUTHOR_REQUEST'&&!own||parsed.reason==='SPONSOR_REQUEST'&&!sponsor)throw Error();}
   const command=parsed.state==='WITHDRAWN'?{action:'withdraw',requestId:parsed.requestId,id:row.id,digest:row.digest,reason:parsed.reason,policyAccepted:'public-strategy-v1'}:{action:'moderate',requestId:parsed.requestId,id:row.id,digest:row.digest,state:parsed.state,reason:parsed.reason,policyAccepted:'public-strategy-v1'};
   if(await experimentDigest(boundedStrategyCommand(command).payload)!==event.command_digest)throw Error();state=parsed.state;at=parsed.createdAt;requests.add(request);
  }
  sources.push({...row,payload:row.payload,record,visible:state==='VISIBLE',events});
 }catch{throw bad();}}
 const found=new Map(sources.map(source=>[source.id,source]));
 for(const dependency of dependencies){const source=found.get(dependency.id);if(!source||source.digest!==dependency.digest||source.payload!==JSON.stringify(dependency.record))throw bad();const seen=new Set<string>();let current=source,depth=0;
  while(current.record.content.relation){if(depth++>=strategyLineageLimits.ancestors||seen.has(current.id))throw bad();seen.add(current.id);const parent=found.get(current.record.content.relation.id);if(!parent)throw bad();try{verifyStrategyLineageRelation(current.record,parent.record,parent.digest);}catch{throw bad();}current=parent;}
 }
 commitmentSourceFenceJson(sources);return sources;
}
export function commitmentSourceFenceJson(sources:CommitmentSourceSnapshot[]){
 if(sources.length>experimentCommitmentStoreLimits.closure)throw bad();const value=JSON.stringify(sources.map(({record:_record,visible:_visible,...source})=>source));if(bytes(value)>experimentCommitmentStoreLimits.snapshotBytes)throw new ExperimentError('Whole commitment source closure exceeds its fixed fence budget.',413);return value;
}
/** One JSON bind covers complete immutable source and moderation snapshots. */
export function commitmentSourceFenceClause(placeholder:string,requireVisible=true){return `NOT EXISTS(SELECT 1 FROM json_each(${placeholder}) d LEFT JOIN strategy_publications p ON p.id=json_extract(d.value,'$.id') WHERE p.id IS NULL OR p.digest IS NOT json_extract(d.value,'$.digest') OR p.payload IS NOT json_extract(d.value,'$.payload') OR p.root_id IS NOT json_extract(d.value,'$.root_id') OR p.revision IS NOT json_extract(d.value,'$.revision') OR p.request_id IS NOT json_extract(d.value,'$.request_id') OR p.command_digest IS NOT json_extract(d.value,'$.command_digest') OR p.created_at IS NOT json_extract(d.value,'$.created_at') OR p.author_key IS NOT json_extract(d.value,'$.author_key') OR p.sponsor_key IS NOT json_extract(d.value,'$.sponsor_key') OR (SELECT COUNT(*) FROM strategy_moderation WHERE record_id=p.id)<>json_array_length(json_extract(d.value,'$.events')) ${requireVisible?"OR COALESCE((SELECT state FROM strategy_moderation WHERE record_id=p.id ORDER BY sequence DESC LIMIT 1),'VISIBLE')<>'VISIBLE'":''} OR EXISTS(SELECT 1 FROM json_each(json_extract(d.value,'$.events')) e LEFT JOIN strategy_moderation m ON m.record_id=p.id AND m.sequence=json_extract(e.value,'$.sequence') WHERE m.record_id IS NULL OR m.payload IS NOT json_extract(e.value,'$.payload') OR m.digest IS NOT json_extract(e.value,'$.digest') OR m.command_digest IS NOT json_extract(e.value,'$.command_digest') OR m.author_key IS NOT json_extract(e.value,'$.author_key') OR m.sponsor_key IS NOT json_extract(e.value,'$.sponsor_key') OR m.request_id IS NOT json_extract(e.value,'$.request_id') OR m.state IS NOT json_extract(e.value,'$.state') OR m.reason IS NOT json_extract(e.value,'$.reason') OR m.created_at IS NOT json_extract(e.value,'$.created_at'))) `;}
export async function confirmCommitmentSourceClosure(db:D1Database,sources:CommitmentSourceSnapshot[]){
 const allVisible=sources.every(source=>source.visible);if(!allVisible)return false;
 const row=await db.prepare(`SELECT CASE WHEN ${commitmentSourceFenceClause('?')} THEN 1 ELSE 0 END AS visible`).bind(commitmentSourceFenceJson(sources)).first<{visible:number}>();if(!row||![0,1].includes(row.visible))throw bad();return row.visible===1;
}
