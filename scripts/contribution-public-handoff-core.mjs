import {createHash} from 'node:crypto';
import {z} from 'zod';
import {contributionCheckLimits,contributionScriptPins} from './check-contribution.mjs';
import {parseContributionJson,parseContributionPolicy,parseContributionEvidence,validateContributionEvidence} from './contribution-evidence-core.mjs';

export const publicHandoffLimits=Object.freeze({artifactBytes:1048576,contextBytes:16384,reportBytes:contributionCheckLimits.reportBytes,maximumDepth:16,nodes:40000});
export const publicHandoffHash=value=>createHash('sha256').update(value).digest('hex');
const hash=z.string().regex(/^[a-f0-9]{64}$/),gitSha=z.string().regex(/^[a-f0-9]{40}$/),positive=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const fullName=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/);
const ref=z.string().regex(/^[A-Za-z0-9_./-]{1,128}$/).refine(value=>!value.includes('..')&&!value.startsWith('/')&&!value.endsWith('/')&&!value.endsWith('.')&&value.split('/').every(part=>part&&!part.startsWith('.')&&!part.endsWith('.lock')));
const repository=z.object({id:positive,fullName}).strict(),branch=z.object({repository,ref,sha:gitSha}).strict();
export const publicContributionContextSchema=z.object({version:z.literal(1),repository,issueNumber:positive,pullRequestNumber:positive.nullable(),base:z.object({ref,sha:gitSha}).strict(),head:branch,testedSha:gitSha}).strict().refine(value=>new Set([value.base.sha,value.head.sha,value.testedSha]).size===3);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=()=>{throw Error('PUBLIC_HANDOFF_NOT_CONFIRMED');};

function credential(value){
 for(let n=0;n<=5;n++){
  if(/og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}|og_local_(?:owner|producer)_[a-f0-9]{64}|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-|svcacct-|ant-)[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|Bearer\s+[^\s"'<>]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value))fail();
  const decoded=value.replace(/(?:%[a-f0-9]{2})+/gi,part=>{try{return decodeURIComponent(part);}catch{return part.replace(/%([a-f0-9]{2})/gi,(_,pair)=>String.fromCharCode(parseInt(pair,16)));}});
  if(decoded===value)return;if(n===5)fail();value=decoded;
 }
}
/** Inspect descriptors before touching values: no input hooks, getters or execution. */
export function publicHandoffPlain(raw,maximum=publicHandoffLimits.artifactBytes){
 let nodes=0;const ancestors=new Set();
 function walk(value,depth){
  if(++nodes>publicHandoffLimits.nodes||depth>publicHandoffLimits.maximumDepth)fail();
  if(typeof value==='string'){if(value.length>maximum)fail();credential(value);return;}
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))fail();return;}
  if(!value||typeof value!=='object'||ancestors.has(value)||Object.getOwnPropertySymbols(value).length)fail();
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail();
  if(array&&Object.keys(descriptors).length!==value.length+1)fail();
  ancestors.add(value);
  for(const [key,descriptor] of Object.entries(descriptors)){
   credential(key);if(array&&key==='length')continue;
   if(!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))fail();
   walk(descriptor.value,depth+1);
  }
  ancestors.delete(value);
 }
 walk(raw,0);if(Buffer.byteLength(JSON.stringify(raw))>maximum)fail();return raw;
}
export function parsePublicHandoffJson(source,maximum=publicHandoffLimits.artifactBytes){return publicHandoffPlain(parseContributionJson(source,maximum),maximum);}
export function parsePublicContributionContext(raw){publicHandoffPlain(raw,publicHandoffLimits.contextBytes);return publicContributionContextSchema.parse(raw);}

const output=z.object({text:z.string().refine(value=>Buffer.byteLength(JSON.stringify(value))<=contributionCheckLimits.retainedBytesPerStream),bytes:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),sha256:hash,truncated:z.boolean()}).strict().superRefine((value,ctx)=>{if(value.bytes===0&&(value.text!==''||value.sha256!==publicHandoffHash('')||value.truncated))ctx.addIssue({code:'custom',message:'Empty output must match the checker.'});});
const scripts=z.object(Object.fromEntries(Object.entries(contributionScriptPins).map(([key,value])=>[key,z.literal(value)]))).strict();
const source=z.object({commitSha:gitSha,treeSha:gitSha,parents:z.array(gitSha).max(8),dirty:z.boolean(),files:z.object({checker:hash,workflow:hash,packageJson:hash}).strict(),scripts}).strict();
const decimal=z.string().regex(/^[1-9][0-9]{0,15}$/).refine(value=>Number.isSafeInteger(Number(value)));
const providerRepository=z.object({id:decimal,fullName}).strict();
const provider=z.object({event:z.literal('pull_request'),repository:providerRepository,headRepository:providerRepository,pullRequest:decimal,runId:decimal,runAttempt:decimal,ref:z.string().max(128)}).strict();
const check=z.object({id:z.enum(['test','typecheck','build','diffcheck']),command:z.array(z.string().max(256)).max(9),status:z.enum(['NOT_RUN','RUNNING','PASSED','FAILED','TIMED_OUT','OUTPUT_LIMIT','INTERRUPTED']),exitCode:z.number().int().min(-2147483648).max(2147483647).nullable(),signal:z.string().regex(/^SIG[A-Z0-9]{1,16}$/).nullable(),durationMs:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),stdout:output,stderr:output}).strict();
export const localContributionReportSchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_CHECK_REPORT'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),status:z.enum(['PASSED','FAILED','INTERRUPTED']),startedAt:clock,finishedAt:clock,declared:z.object({baseSha:gitSha,headSha:gitSha,testedSha:gitSha}).strict(),providerContext:provider.nullable(),runtime:z.object({node:z.string().regex(/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/),platform:z.string().regex(/^[a-z0-9_]{1,32}$/),architecture:z.string().regex(/^[a-z0-9_]{1,32}$/)}).strict(),source:source.nullable(),afterSource:source.nullable(),checks:z.array(check).length(4),failureReasons:z.array(z.string().regex(/^[A-Z0-9_]{1,80}$/)).max(32),reportDigest:hash}).strict();
export function validateLocalContributionReport(raw,rawContext,preparedAt){
 clock.parse(preparedAt);publicHandoffPlain(raw,publicHandoffLimits.reportBytes);const context=parsePublicContributionContext(rawContext),report=localContributionReportSchema.parse(raw),{reportDigest,...body}=report;
 if(reportDigest!==publicHandoffHash(JSON.stringify(body))||Date.parse(report.startedAt)>Date.parse(report.finishedAt)||report.finishedAt>preparedAt||!same(report.declared,{baseSha:context.base.sha,headSha:context.head.sha,testedSha:context.testedSha}))fail();
 for(const observed of [report.source,report.afterSource])if(observed&&(observed.commitSha!==context.testedSha||!same(observed.parents,[context.base.sha,context.head.sha])))fail();
 const expected=[['test',['npm','test']],['typecheck',['npm','run','typecheck']],['build',['npm','run','build']],['diffcheck',['git','-c','core.hooksPath=/dev/null','diff','--check',context.base.sha,context.testedSha]]];
 let stopped=false;
 report.checks.forEach((item,n)=>{
  if(item.id!==expected[n][0]||!same(item.command,expected[n][1])||stopped&&item.status!=='NOT_RUN')fail();
  if(['NOT_RUN','RUNNING'].includes(item.status)){if(item.exitCode!==null||item.signal!==null||item.durationMs!==0||item.stdout.bytes||item.stderr.bytes)fail();stopped=true;}
  if(item.status==='INTERRUPTED')stopped=true;
  if(item.status==='PASSED'&&(item.exitCode!==0||item.signal!==null))fail();
 });
 if(report.providerContext){const p=report.providerContext;if(context.pullRequestNumber===null||Number(p.repository.id)!==context.repository.id||p.repository.fullName!==context.repository.fullName||Number(p.headRepository.id)!==context.head.repository.id||p.headRepository.fullName!==context.head.repository.fullName||Number(p.pullRequest)!==context.pullRequestNumber||p.ref!==`refs/pull/${context.pullRequestNumber}/merge`)fail();}
 const allPassed=report.checks.every(item=>item.status==='PASSED'),interrupted=report.failureReasons.includes('INTERRUPTED')||report.checks.some(item=>item.status==='INTERRUPTED');
 if(report.status==='PASSED'&&(!allPassed||report.failureReasons.length||!report.source||!report.afterSource||report.source.dirty||!same(report.source,report.afterSource)))fail();
 if(report.status==='FAILED'&&(interrupted||allPassed&&report.failureReasons.length===0))fail();
 if(report.status!=='INTERRUPTED'&&interrupted)fail();
 if(!report.source&&report.checks.some(item=>!['NOT_RUN','RUNNING'].includes(item.status)))fail();
 return report;
}
const inputFileDigests=z.object({taskSnapshot:hash,claimSnapshot:hash,context:hash,localReport:hash,publicPolicy:hash.nullable(),publicCiReceipt:hash.nullable()}).strict();
const ciReceiptSchema=z.object({version:z.literal(1),kind:z.literal('PUBLIC_GITHUB_CI_EVIDENCE'),collection:z.literal('PUBLIC_GITHUB_API_READ'),cryptographicAttestation:z.literal(false),policyDigest:hash,evidence:z.unknown(),result:z.unknown(),readStatistics:z.object({requests:z.number().int().min(0).max(32),bytes:z.number().int().min(0).max(4194304)}).strict(),reason:z.string().regex(/^[A-Z0-9_]{1,80}$/).nullable()}).strict();
const localAssessment=z.object({status:z.enum(['PASSED','FAILED','INTERRUPTED']),source:z.enum(['MATCHED_DECLARED_MERGE','NOT_OBSERVED']),afterSource:z.enum(['MATCHED_DECLARED_MERGE','NOT_OBSERVED']),ciGateFiles:z.enum(['NOT_COLLECTED','NOT_CHECKABLE','MATCHED','MISMATCH']),checks:z.array(z.object({id:check.shape.id,status:check.shape.status}).strict()).length(4),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE')}).strict();
const ciAssessment=z.object({status:z.enum(['CI_VERIFIED','PENDING','FAILED','STALE','UNAVAILABLE']),reason:z.string().regex(/^[A-Z0-9_]{1,80}$/),correlation:z.unknown().nullable(),collection:z.enum(['NOT_COLLECTED','OFFLINE_UNAUTHENTICATED_SNAPSHOT']),currentness:z.literal('NOT_RECHECKED'),cryptographicAttestation:z.literal(false)}).strict();
const noAuthority={repositoryAccessGranted:z.literal(false),taskCompletionVerified:z.literal(false),merged:z.literal(false),reputationAwarded:z.literal(false),published:z.literal(false),researchQualified:z.literal(false),independentResearch:z.literal(false),mergeApproved:z.literal(false),securityApproved:z.literal(false),deploymentApproved:z.literal(false),permissionChangeApproved:z.literal(false),executionEnabled:z.literal(false),ordersEnabled:z.literal(false),liveEnabled:z.literal(false)};
export const publicContributionHandoffSchema=z.object({version:z.literal(1),kind:z.literal('PUBLIC_CONTRIBUTION_HANDOFF'),preparedAt:clock,task:z.unknown(),claim:z.unknown(),context:publicContributionContextSchema,localReport:localContributionReportSchema,inputFileDigests,ci:z.object({policy:z.unknown(),receipt:ciReceiptSchema}).strict().nullable(),localAssessment,ciAssessment,classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),publicSnapshots:z.literal('LOCAL_UNAUTHENTICATED_SNAPSHOTS'),reviewContext:z.literal('OPERATOR_DECLARED_NOT_VERIFIED'),issueMapping:z.literal('OPERATOR_DECLARED_NOT_VERIFIED'),...noAuthority}).strict();
export const publicHandoffAuthority=Object.freeze(Object.fromEntries(Object.keys(noAuthority).map(key=>[key,false])));

export function assessLocalContributionReport(report,ciPolicy=null){
 const pins={checker:'scripts/check-contribution.mjs',workflow:'.github/workflows/contribution.yml',packageJson:'package.json'},observed=[report.source,report.afterSource].filter(Boolean);
 const ciGateFiles=!ciPolicy?'NOT_COLLECTED':!observed.length?'NOT_CHECKABLE':observed.every(source=>Object.entries(pins).every(([key,path])=>source.files[key]===ciPolicy.trusted.files.find(file=>file.path===path)?.digest))?'MATCHED':'MISMATCH';
 return {status:report.status,source:report.source?'MATCHED_DECLARED_MERGE':'NOT_OBSERVED',afterSource:report.afterSource?'MATCHED_DECLARED_MERGE':'NOT_OBSERVED',ciGateFiles,checks:report.checks.map(({id,status})=>({id,status})),classification:'AUTHOR_REPORTED',qualification:'NONE'};
}

/** Pure offline normalization; the supplied model is fixed first-party tooling. */
export async function normalizePublicContributionHandoff(model,raw){
 publicHandoffPlain(raw);const original=publicContributionHandoffSchema.parse(raw),context=parsePublicContributionContext(original.context),task=await model.validateContributionTaskItem(original.task),claim=await model.validateContributionClaimItem(original.claim),preparedAt=original.preparedAt;
 if(task.state!=='OPEN'||claim.taskState!=='OPEN'||claim.status!=='ACTIVE'||claim.sequence!==0||!task.record||!claim.record||!same(claim.task,{id:task.id,digest:task.digest})||task.createdAt>claim.createdAt||task.createdAt>preparedAt||claim.createdAt>preparedAt||claim.checkedAt>preparedAt||preparedAt>=claim.expiresAt)fail();
 const report=validateLocalContributionReport(original.localReport,context,preparedAt);
 let ci=null,assessment={status:'UNAVAILABLE',reason:'NOT_COLLECTED',correlation:null,collection:'NOT_COLLECTED',currentness:'NOT_RECHECKED',cryptographicAttestation:false};
 if(original.ci){
  const policy=parseContributionPolicy(original.ci.policy),receipt=ciReceiptSchema.parse(original.ci.receipt),evidence=parseContributionEvidence(receipt.evidence);
  if(policy.version!==1||context.pullRequestNumber===null||receipt.policyDigest!==publicHandoffHash(JSON.stringify(policy))||!same(policy.target.repository,context.repository)||policy.target.issueNumber!==context.issueNumber||policy.target.pullRequestNumber!==context.pullRequestNumber||!same(policy.target.base,context.base)||!same(policy.target.head,context.head)||policy.target.testedSha!==context.testedSha||Date.parse(evidence.collectedAt)>Date.parse(preparedAt)||original.inputFileDigests.publicPolicy===null||original.inputFileDigests.publicCiReceipt===null)fail();
  const correlation=validateContributionEvidence(policy,evidence);
  if(!same(receipt.result,correlation))fail();
  if(report.providerContext&&(Number(report.providerContext.runId)!==policy.target.runId||evidence.runAfter&&Number(report.providerContext.runAttempt)!==evidence.runAfter.attempt||Date.parse(report.finishedAt)>Date.parse(evidence.collectedAt)||evidence.runAfter?.startedAt&&Date.parse(report.startedAt)<Date.parse(evidence.runAfter.startedAt)||evidence.runAfter&&Date.parse(report.finishedAt)>Date.parse(evidence.runAfter.updatedAt)))fail();
  ci={policy,receipt:{...receipt,evidence,result:correlation}};assessment={status:correlation.status,reason:correlation.reason,correlation,collection:'OFFLINE_UNAUTHENTICATED_SNAPSHOT',currentness:'NOT_RECHECKED',cryptographicAttestation:false};
 }else if(original.inputFileDigests.publicPolicy!==null||original.inputFileDigests.publicCiReceipt!==null)fail();
 const local=assessLocalContributionReport(report,ci?.policy);if(local.status==='PASSED'&&assessment.status==='CI_VERIFIED'&&local.ciGateFiles!=='MATCHED')fail();
 if(!same(original.localAssessment,local)||!same(original.ciAssessment,assessment))fail();
 return publicContributionHandoffSchema.parse({...original,task,claim,context,localReport:report,ci,localAssessment:local,ciAssessment:assessment});
}
