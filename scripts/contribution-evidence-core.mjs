import {createHash} from 'node:crypto';
import {z} from 'zod';

// Pure admission and correlation only: no HTTP, file access or contributed-code execution.
export const contributionEvidenceLimits=Object.freeze({policyBytes:32768,evidenceBytes:524288,jsonBytes:1048576,maximumDepth:16,nodes:40000,jobs:16,steps:64,files:6,pullRequests:4});
export const contributionGatePaths=Object.freeze(['.github/workflows/contribution.yml','scripts/check-contribution.mjs','package.json']);
export const contributionJobName='Contribution checks';
export function contributionRequiredSteps(testedSha){return ['Checkout exact PR merge','Verify checkout identity '+testedSha,'Set up Node 22','Set up Python','Install locked dependencies','Run fixed contribution checks '+testedSha];}
const sha=value=>createHash('sha256').update(value).digest('hex');
const positive=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),gitSha=z.string().regex(/^[a-f0-9]{40}$/),digest=z.string().regex(/^[a-f0-9]{64}$/);
const fullName=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/);
const ref=z.string().regex(/^[A-Za-z0-9_./-]{1,128}$/).refine(value=>!value.includes('..')&&!value.endsWith('/')&&!value.endsWith('.lock'));
const text=z.string().min(1).max(256).regex(/^[\x20-\x7e]+$/);
const clock=z.string().max(40).datetime({offset:true}).refine(value=>Number.isFinite(Date.parse(value)));
const repository=z.object({id:positive,fullName}).strict();
const branch=z.object({repository,ref,sha:gitSha}).strict();
const file=z.object({path:z.enum(contributionGatePaths),digest}).strict();
const contributionTarget=z.object({repository,issueNumber:positive,pullRequestNumber:positive,base:z.object({ref,sha:gitSha}).strict(),head:branch,testedSha:gitSha,runId:positive}).strict();
const contributionTrusted=z.object({workflowId:positive,workflowPath:z.literal(contributionGatePaths[0]),files:z.array(file).length(3)}).strict();
// Approval and isolation flags record local operator declarations. They do not
// authenticate the operator, prove isolation or grant repository/API authority.
export const contributionPolicySchema=z.discriminatedUnion('version',[
 z.object({version:z.literal(1),publicReadApproved:z.literal(true),target:contributionTarget,trusted:contributionTrusted}).strict(),
 z.object({version:z.literal(2),repositoryVisibility:z.literal('PRIVATE'),privateReadApproved:z.literal(true),credentialIsolationConfirmed:z.literal(true),target:contributionTarget,trusted:contributionTrusted}).strict(),
]).superRefine((value,context)=>{
 if(new Set(value.trusted.files.map(item=>item.path)).size!==3)context.addIssue({code:z.ZodIssueCode.custom,message:'Every fixed gate must have one independent trusted digest.'});
 if(value.target.base.sha===value.target.head.sha||[value.target.base.sha,value.target.head.sha].includes(value.target.testedSha))context.addIssue({code:z.ZodIssueCode.custom,message:'A distinct PR merge and two distinct parent commits are required.'});
});
const observedRepository=repository.extend({private:z.boolean()});
const issue=z.object({id:positive,number:positive,repositoryId:positive,isPullRequest:z.boolean(),state:z.enum(['open','closed'])}).strict();
const pullRequest=z.object({id:positive,number:positive,repositoryId:positive,state:z.enum(['open','closed']),draft:z.boolean(),merged:z.boolean(),base:branch,head:branch,mergeSha:gitSha.nullable()}).strict();
const workflow=z.object({id:positive,path:text,state:z.enum(['active','disabled_manually','disabled_inactivity','deleted'])}).strict();
const status=z.enum(['queued','in_progress','completed','waiting','requested','pending']);
const conclusion=z.enum(['success','failure','neutral','cancelled','timed_out','action_required','skipped','stale','startup_failure']).nullable();
const runPr=z.object({number:positive,base:branch,head:branch}).strict();
const run=z.object({id:positive,repositoryId:positive,workflowId:positive,path:text,attempt:positive,event:z.enum(['pull_request','pull_request_target','push','workflow_dispatch','workflow_run','merge_group','schedule','other']),status,conclusion,headSha:gitSha,headRepository:repository,pullRequests:z.array(runPr).max(contributionEvidenceLimits.pullRequests),createdAt:clock,updatedAt:clock,startedAt:clock.nullable()}).strict();
const step=z.object({number:positive,name:text,status,conclusion,startedAt:clock.nullable(),completedAt:clock.nullable()}).strict();
const job=z.object({id:positive,runId:positive,runAttempt:positive,headSha:gitSha,name:text,status,conclusion,startedAt:clock.nullable(),completedAt:clock.nullable(),steps:z.array(step).max(contributionEvidenceLimits.steps)}).strict();
export const contributionEvidenceSchema=z.object({version:z.literal(1),collectedAt:clock,availability:z.enum(['COMPLETE','UNAVAILABLE','TRUNCATED']),repositoryBefore:observedRepository.nullable(),repositoryAfter:observedRepository.nullable(),issueBefore:issue.nullable(),issueAfter:issue.nullable(),pullRequestBefore:pullRequest.nullable(),pullRequestAfter:pullRequest.nullable(),workflowBefore:workflow.nullable(),workflowAfter:workflow.nullable(),runBefore:run.nullable(),runAfter:run.nullable(),jobs:z.object({runId:positive,attempt:positive,totalCount:z.number().int().min(0).max(100000),complete:z.boolean(),items:z.array(job).max(contributionEvidenceLimits.jobs)}).strict().nullable(),testedCommit:z.object({repositoryId:positive,sha:gitSha,parents:z.array(gitSha).max(8)}).strict().nullable(),gateFiles:z.object({complete:z.boolean(),items:z.array(z.object({path:z.enum(contributionGatePaths),ref:gitSha,digest}).strict()).max(contributionEvidenceLimits.files)}).strict().nullable()}).strict();
export class ContributionEvidenceError extends Error{constructor(code){super(code);this.name='ContributionEvidenceError';this.code=code;}}
function rejectKnownCredential(raw){
 let value=raw;
 for(let n=0;n<4;n++){
  if(/og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}|og_local_(?:owner|producer)_[a-f0-9]{64}|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}/i.test(value))throw new ContributionEvidenceError('CREDENTIAL_SHAPED_EVIDENCE');
  try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}
 }
}
function bounded(raw,maximum){
 let nodes=0;
 function walk(value,depth){
  if(++nodes>contributionEvidenceLimits.nodes||depth>contributionEvidenceLimits.maximumDepth)throw new ContributionEvidenceError('EVIDENCE_STRUCTURE_LIMIT');
  if(typeof value==='string'){if(value.length>maximum)throw new ContributionEvidenceError('EVIDENCE_BYTE_LIMIT');rejectKnownCredential(value);return;}if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(!value||typeof value!=='object'||Object.getOwnPropertySymbols(value).length)throw new ContributionEvidenceError('INVALID_PLAIN_EVIDENCE');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new ContributionEvidenceError('INVALID_PLAIN_EVIDENCE');
  if(array&&Object.keys(descriptors).length!==value.length+1)throw new ContributionEvidenceError('INVALID_PLAIN_EVIDENCE');
  for(const [key,descriptor] of Object.entries(descriptors)){
   if(key.length>maximum)throw new ContributionEvidenceError('EVIDENCE_BYTE_LIMIT');
   rejectKnownCredential(key);
   if(array&&key==='length')continue;
   if(!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))throw new ContributionEvidenceError('INVALID_PLAIN_EVIDENCE');
   walk(descriptor.value,depth+1);
  }
 }
 walk(raw,0);if(Buffer.byteLength(JSON.stringify(raw))>maximum)throw new ContributionEvidenceError('EVIDENCE_BYTE_LIMIT');
}
function parsed(raw,schema,maximum,code){bounded(raw,maximum);const value=schema.safeParse(raw);if(!value.success)throw new ContributionEvidenceError(code);return value.data;}
export const parseContributionPolicy=raw=>parsed(raw,contributionPolicySchema,contributionEvidenceLimits.policyBytes,'INVALID_CONTRIBUTION_POLICY');
export const contributionPolicyVisibility=raw=>parseContributionPolicy(raw).version===1?'PUBLIC':'PRIVATE';
export const parseContributionEvidence=raw=>parsed(raw,contributionEvidenceSchema,contributionEvidenceLimits.evidenceBytes,'INVALID_CONTRIBUTION_EVIDENCE');

/** Bounded strict JSON admission, including duplicate object keys before JSON.parse. */
export function parseContributionJson(source,maximum=contributionEvidenceLimits.evidenceBytes){
 if(typeof source!=='string'||!Number.isSafeInteger(maximum)||maximum<1||maximum>contributionEvidenceLimits.jsonBytes||Buffer.byteLength(source)>maximum)throw new ContributionEvidenceError('EVIDENCE_BYTE_LIMIT');
 let index=0,nodes=0;const whitespace=()=>{while(/[\x20\t\r\n]/.test(source[index]??'!'))index++;};
 function string(){const start=index++;for(;;){const char=source[index++];if(char===undefined)throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');if(char==='"'){const value=JSON.parse(source.slice(start,index));rejectKnownCredential(value);return value;}if(char==='\\'){if(source[index]===undefined)throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');index++;}}}
 function value(depth){
  if(++nodes>contributionEvidenceLimits.nodes||depth>contributionEvidenceLimits.maximumDepth)throw new ContributionEvidenceError('EVIDENCE_STRUCTURE_LIMIT');whitespace();const char=source[index];
  if(char==='"'){string();return;}
  if(char==='{'||char==='['){index++;whitespace();const object=char==='{',end=object?'}':']',keys=new Set();if(source[index]===end){index++;return;}
   for(;;){if(object){if(source[index]!=='"')throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');const key=string();if(keys.has(key))throw new ContributionEvidenceError('DUPLICATE_EVIDENCE_KEY');keys.add(key);whitespace();if(source[index++]!==':')throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');}value(depth+1);whitespace();if(source[index]===end){index++;return;}if(source[index++]!==',')throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');whitespace();}
  }
  const match=/^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(index));if(!match)throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');index+=match[0].length;
 }
 try{value(0);whitespace();if(index!==source.length)throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');const result=JSON.parse(source);bounded(result,maximum);return result;}catch(error){if(error instanceof ContributionEvidenceError)throw error;throw new ContributionEvidenceError('INVALID_EVIDENCE_JSON');}
}
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const time=value=>Date.parse(value);
const repoMatches=(seen,expected)=>seen.id===expected.id&&seen.fullName===expected.fullName;
function branchMatches(seen,expected,baseRepository){return seen.sha===expected.sha&&seen.ref===expected.ref&&repoMatches(seen.repository,expected.repository??baseRepository);}
const narrow={researchQualified:false,independentResearch:false,mergeApproved:false,securityApproved:false,deploymentApproved:false,permissionChangeApproved:false,ordersEnabled:false,liveEnabled:false};

/** CI_VERIFIED is only correlation of configured provider metadata and required gates.
 * A caller-supplied snapshot or offline rerun is not provider authentication. */
export function validateContributionEvidence(rawPolicy,rawEvidence){
 const policy=parseContributionPolicy(rawPolicy),evidence=parseContributionEvidence(rawEvidence),target=policy.target;
 const result=(status,reason)=>({version:1,kind:'CONTRIBUTION_CI_EVIDENCE',status,reason,checkedAt:evidence.collectedAt,policyDigest:sha(JSON.stringify(policy)),evidenceDigest:sha(JSON.stringify(evidence)),target,run:evidence.runAfter?{id:evidence.runAfter.id,attempt:evidence.runAfter.attempt,workflowId:evidence.runAfter.workflowId,testedSha:target.testedSha}:null,scope:'REQUIRED_CI_GATES_ONLY',currentness:'COLLECTED_SNAPSHOT_ONLY',...narrow});
 if(evidence.availability!=='COMPLETE')return result('UNAVAILABLE',evidence.availability==='TRUNCATED'?'TRUNCATED_PROVIDER_EVIDENCE':'PROVIDER_EVIDENCE_UNAVAILABLE');
 const pairs=['repository','issue','pullRequest','workflow','run'];if(pairs.some(name=>!evidence[name+'Before']||!evidence[name+'After']))return result('UNAVAILABLE','MISSING_PROVIDER_SNAPSHOT');
 const expectedPrivate=contributionPolicyVisibility(policy)==='PRIVATE';
 const repositories=[evidence.repositoryBefore,evidence.repositoryAfter];if(repositories.some(item=>item.private!==expectedPrivate||!repoMatches(item,target.repository)))return result('UNAVAILABLE','REPOSITORY_CONTEXT_MISMATCH');
 const issues=[evidence.issueBefore,evidence.issueAfter];if(issues.some(item=>item.repositoryId!==target.repository.id||item.number!==target.issueNumber||item.isPullRequest)||issues[0].id!==issues[1].id)return result('UNAVAILABLE','ISSUE_CONTEXT_MISMATCH');
 if(!same(issues[0],issues[1]))return result('STALE','ISSUE_CHANGED_DURING_COLLECTION');
 const prs=[evidence.pullRequestBefore,evidence.pullRequestAfter];if(prs.some(item=>item.repositoryId!==target.repository.id||item.number!==target.pullRequestNumber)||prs[0].id!==prs[1].id)return result('UNAVAILABLE','PULL_REQUEST_CONTEXT_MISMATCH');
 if(prs.some(item=>!branchMatches(item.base,target.base,target.repository)||!branchMatches(item.head,target.head)||item.mergeSha!==target.testedSha)||!same(prs[0],prs[1]))return result('STALE','PULL_REQUEST_CHANGED');
 if(prs[1].state!=='open'||prs[1].merged||prs[1].draft)return result('STALE','PULL_REQUEST_NOT_REVIEWABLE');
 const workflows=[evidence.workflowBefore,evidence.workflowAfter];if(workflows.some(item=>item.id!==policy.trusted.workflowId||item.path!==policy.trusted.workflowPath)||!same(workflows[0],workflows[1]))return result('UNAVAILABLE','WORKFLOW_CONTEXT_MISMATCH');
 if(workflows[1].state!=='active')return result('UNAVAILABLE','WORKFLOW_DISABLED');
 const runs=[evidence.runBefore,evidence.runAfter],allowedPaths=[policy.trusted.workflowPath,policy.trusted.workflowPath+'@refs/pull/'+target.pullRequestNumber+'/merge'];
 if(runs.some(item=>item.id!==target.runId||item.repositoryId!==target.repository.id||item.workflowId!==policy.trusted.workflowId||!allowedPaths.includes(item.path)||item.event!=='pull_request'||!repoMatches(item.headRepository,target.head.repository)))return result('UNAVAILABLE','RUN_CONTEXT_MISMATCH');
 if(!same(runs[0],runs[1]))return result('STALE','RUN_CHANGED_DURING_COLLECTION');
 const current=runs[1],linked=current.pullRequests;
 if(linked.length!==1||linked[0].number!==target.pullRequestNumber||!branchMatches(linked[0].base,target.base,target.repository)||!branchMatches(linked[0].head,target.head)||![target.head.sha,target.testedSha].includes(current.headSha))return result('STALE','RUN_COMMIT_BINDING_CHANGED');
 if(current.status!=='completed')return result('PENDING','WORKFLOW_ATTEMPT_PENDING');
 if(current.conclusion!=='success')return result('FAILED','WORKFLOW_ATTEMPT_NOT_SUCCESSFUL');
 if(!current.startedAt||time(current.createdAt)>time(current.startedAt)||time(current.startedAt)>time(current.updatedAt)||time(current.updatedAt)>time(evidence.collectedAt))return result('UNAVAILABLE','RUN_TIMESTAMPS_INCONSISTENT');
 const commit=evidence.testedCommit;if(!commit||commit.repositoryId!==target.repository.id||commit.sha!==target.testedSha||!same(commit.parents,[target.base.sha,target.head.sha]))return result('STALE','TESTED_MERGE_PARENTS_CHANGED');
 const gates=evidence.gateFiles;if(!gates?.complete||gates.items.length!==6||new Set(gates.items.map(item=>item.path+'@'+item.ref)).size!==6)return result('UNAVAILABLE','TRUSTED_FILES_INCOMPLETE');
 for(const trusted of policy.trusted.files)for(const ref of [target.testedSha,target.head.sha]){const found=gates.items.find(item=>item.path===trusted.path&&item.ref===ref);if(!found)return result('UNAVAILABLE','TRUSTED_FILES_INCOMPLETE');if(found.digest!==trusted.digest)return result('FAILED','TRUSTED_GATE_CHANGED');}
 const jobs=evidence.jobs;if(!jobs?.complete||jobs.runId!==current.id||jobs.attempt!==current.attempt||jobs.items.length!==jobs.totalCount)return result('UNAVAILABLE','JOB_PAGE_OR_ATTEMPT_INCOMPLETE');
 if(jobs.items.length!==1||new Set(jobs.items.map(item=>item.id)).size!==jobs.items.length||jobs.items[0].name!==contributionJobName)return result('FAILED','REQUIRED_JOB_MISSING_OR_AMBIGUOUS');
 for(const job of jobs.items){
  if(job.runId!==current.id||job.runAttempt!==current.attempt||job.headSha!==current.headSha)return result('STALE','JOB_COMMIT_OR_ATTEMPT_CHANGED');
  if(job.status!=='completed')return result('PENDING','REQUIRED_JOB_PENDING');
  if(job.conclusion!=='success')return result('FAILED','REQUIRED_JOB_NOT_SUCCESSFUL');
  if(!job.startedAt||!job.completedAt||time(job.startedAt)<time(current.startedAt)||time(job.startedAt)>time(job.completedAt)||time(job.completedAt)>time(evidence.collectedAt))return result('UNAVAILABLE','JOB_TIMESTAMPS_INCONSISTENT');
  let prior=0;const names=new Set();for(const step of job.steps){if(step.number<=prior||names.has(step.name))return result('UNAVAILABLE','STEP_IDENTITY_AMBIGUOUS');prior=step.number;names.add(step.name);if(step.status!=='completed')return result('PENDING','REQUIRED_STEP_PENDING');if(step.conclusion!=='success')return result('FAILED','REQUIRED_STEP_NOT_SUCCESSFUL');if(!step.startedAt||!step.completedAt||time(step.startedAt)<time(job.startedAt)||time(step.startedAt)>time(step.completedAt)||time(step.completedAt)>time(job.completedAt))return result('UNAVAILABLE','STEP_TIMESTAMPS_INCONSISTENT');}
  let previousNumber=0;for(const name of contributionRequiredSteps(target.testedSha)){const matched=job.steps.filter(step=>step.name===name);if(matched.length!==1||matched[0].number<=previousNumber)return result('FAILED','REQUIRED_STEP_MISSING_OR_REORDERED');previousNumber=matched[0].number;}
 }
 return result('CI_VERIFIED','EXACT_CURRENT_ATTEMPT_REQUIRED_GATES_SUCCEEDED');
}
