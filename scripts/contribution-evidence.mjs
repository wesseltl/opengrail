import {createHash,randomUUID} from 'node:crypto';
import {openSync,closeSync,fstatSync,readSync,writeFileSync,fsyncSync,linkSync,unlinkSync,constants,realpathSync} from 'node:fs';
import {dirname,basename,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseContributionPolicy,parseContributionEvidence,parseContributionJson,validateContributionEvidence,contributionEvidenceLimits,contributionPolicyVisibility} from './contribution-evidence-core.mjs';
import {makeGithubReader,makePrivateGithubReader,ContributionReadError} from './contribution-github-read.mjs';
import {preparePrivateEvidenceOutput,PrivateEvidenceOutputError} from './contribution-private-credential.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalClock=value=>new Date(value).toISOString();
const code=error=>error instanceof PrivateEvidenceOutputError?error.code:error instanceof ContributionReadError?error.code:'INVALID_OR_UNAVAILABLE_EVIDENCE';
const privateCodes=new Set(['PRIVATE_POLICY_REQUIRED','PUBLIC_POLICY_REQUIRED','PRIVATE_CREDENTIAL_UNAVAILABLE','PRIVATE_GITHUB_PATH_NOT_APPROVED','PRIVATE_GITHUB_RESPONSE_CONTEXT_MISMATCH','CLOCK_UNAVAILABLE','CLOCK_REGRESSION','INTERRUPTED','READ_TIME_LIMIT','READ_REQUEST_LIMIT','GITHUB_REQUEST_TIME_LIMIT','GITHUB_RESPONSE_UNAVAILABLE','GITHUB_BODY_UNAVAILABLE','GITHUB_RATE_OR_ACCESS_LIMIT','GITHUB_RESOURCE_UNAVAILABLE','INVALID_GITHUB_CONTENT_TYPE','GITHUB_RESPONSE_BYTE_LIMIT','INVALID_GITHUB_BODY','INVALID_GITHUB_JSON','INVALID_REPOSITORY_IDENTITY','ISSUE_IDENTITY_MISMATCH','PR_IDENTITY_MISMATCH','INVALID_RUN_PR_REFERENCES','INVALID_JOB_STEPS','JOB_ATTEMPT_MISMATCH','GATE_FILE_UNAVAILABLE','INVALID_GATE_FILE_ENCODING','PRIVATE_REPOSITORY_IDENTITY_MISMATCH','INVALID_RUN_ATTEMPT','JOB_COLLECTION_TRUNCATED','JOB_COLLECTION_CHANGED','INVALID_TESTED_COMMIT','INVALID_OR_UNAVAILABLE_EVIDENCE']);
const privateCode=error=>error instanceof ContributionReadError&&privateCodes.has(error.code)?error.code:'INVALID_OR_UNAVAILABLE_EVIDENCE';
const identity=raw=>{
 if(!raw||typeof raw!=='object')throw new ContributionReadError('INVALID_REPOSITORY_IDENTITY');
 let fullName=raw.full_name;
 if(fullName===undefined){const match=typeof raw.url==='string'&&/^https:\/\/api\.github\.com\/repos\/([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100})$/.exec(raw.url);if(!match)throw new ContributionReadError('INVALID_REPOSITORY_IDENTITY');fullName=match[1];}
 return {id:raw.id,fullName};
};
const repository=raw=>({...identity(raw),private:raw.private});
const branch=raw=>({repository:identity(raw.repo),ref:raw.ref,sha:raw.sha});
function issue(raw,repo,number){
 if(raw.html_url!==`https://github.com/${repo.fullName}/issues/${number}`)throw new ContributionReadError('ISSUE_IDENTITY_MISMATCH');
 return {id:raw.id,number:raw.number,repositoryId:repo.id,isPullRequest:raw.pull_request!==undefined,state:raw.state};
}
function pullRequest(raw,repo,number){
 if(raw.html_url!==`https://github.com/${repo.fullName}/pull/${number}`)throw new ContributionReadError('PR_IDENTITY_MISMATCH');
 return {id:raw.id,number:raw.number,repositoryId:repo.id,state:raw.state,draft:raw.draft,merged:raw.merged,base:branch(raw.base),head:branch(raw.head),mergeSha:raw.merge_commit_sha};
}
const workflow=raw=>({id:raw.id,path:raw.path,state:raw.state});
function run(raw){
 if(!Array.isArray(raw.pull_requests)||raw.pull_requests.length>4)throw new ContributionReadError('INVALID_RUN_PR_REFERENCES');
 return {id:raw.id,repositoryId:raw.repository?.id,workflowId:raw.workflow_id,path:raw.path,attempt:raw.run_attempt,event:raw.event,status:raw.status,conclusion:raw.conclusion,headSha:raw.head_sha,headRepository:identity(raw.head_repository),pullRequests:raw.pull_requests.map(p=>({number:p.number,base:branch(p.base),head:branch(p.head)})),createdAt:raw.created_at,updatedAt:raw.updated_at,startedAt:raw.run_started_at??null};
}
function job(raw,attempt){
 if(!Array.isArray(raw.steps)||raw.steps.length>64)throw new ContributionReadError('INVALID_JOB_STEPS');
 if(raw.run_attempt!==undefined&&raw.run_attempt!==attempt)throw new ContributionReadError('JOB_ATTEMPT_MISMATCH');
 return {id:raw.id,runId:raw.run_id,runAttempt:attempt,headSha:raw.head_sha,name:raw.name,status:raw.status,conclusion:raw.conclusion,startedAt:raw.started_at??null,completedAt:raw.completed_at??null,steps:raw.steps.map(s=>({number:s.number,name:s.name,status:s.status,conclusion:s.conclusion,startedAt:s.started_at??null,completedAt:s.completed_at??null}))};
}
function contentDigest(raw,path){
 if(raw?.type!=='file'||raw.path!==path||raw.encoding!=='base64'||typeof raw.content!=='string'||!Number.isSafeInteger(raw.size)||raw.size<1||raw.size>131072)throw new ContributionReadError('GATE_FILE_UNAVAILABLE');
 const text=raw.content.replace(/\n/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw new ContributionReadError('INVALID_GATE_FILE_ENCODING');
 const bytes=Buffer.from(text,'base64');if(bytes.length!==raw.size||bytes.toString('base64')!==text)throw new ContributionReadError('INVALID_GATE_FILE_ENCODING');return hash(bytes);
}

// Only actual read-only GET responses enter this online path. Tests explicitly inject invented responses.
export async function collectContributionEvidence(rawPolicy,options={}){
 const policy=parseContributionPolicy(rawPolicy),now=options.now??Date.now;
 if(contributionPolicyVisibility(policy)!=='PUBLIC')throw new ContributionReadError('PUBLIC_POLICY_REQUIRED');
 const reader=makeGithubReader({...options,now}),base='/repos/'+policy.target.repository.fullName;
 return collect(policy,reader,base,now,false);
}
export async function collectPrivateContributionEvidence(rawPolicy,credentialFile,options={}){
 try{
  const policy=parseContributionPolicy(rawPolicy),now=options.now??Date.now;
  if(contributionPolicyVisibility(policy)!=='PRIVATE')throw new ContributionReadError('PRIVATE_POLICY_REQUIRED');
  const reader=makePrivateGithubReader(policy,credentialFile,{...options,now});
  return await collect(policy,reader,'/repos/'+policy.target.repository.fullName,now,true);
 }catch(error){throw new ContributionReadError(privateCode(error));}
}
async function collect(policy,reader,base,now,isPrivate){
 const evidence={version:1,collectedAt:canonicalClock(now()),availability:'UNAVAILABLE',repositoryBefore:null,repositoryAfter:null,issueBefore:null,issueAfter:null,pullRequestBefore:null,pullRequestAfter:null,workflowBefore:null,workflowAfter:null,runBefore:null,runAfter:null,jobs:null,testedCommit:null,gateFiles:null};
 let reason=null;
 try{
  evidence.repositoryBefore=repository(await reader.get(base));
  if(evidence.repositoryBefore.id!==policy.target.repository.id||evidence.repositoryBefore.fullName!==policy.target.repository.fullName||evidence.repositoryBefore.private!==isPrivate)throw new ContributionReadError(isPrivate?'PRIVATE_REPOSITORY_IDENTITY_MISMATCH':'PUBLIC_REPOSITORY_IDENTITY_MISMATCH');
  evidence.issueBefore=issue(await reader.get(`${base}/issues/${policy.target.issueNumber}`),policy.target.repository,policy.target.issueNumber);
  evidence.pullRequestBefore=pullRequest(await reader.get(`${base}/pulls/${policy.target.pullRequestNumber}`),policy.target.repository,policy.target.pullRequestNumber);
  evidence.workflowBefore=workflow(await reader.get(`${base}/actions/workflows/${policy.trusted.workflowId}`));
  evidence.runBefore=run(await reader.get(`${base}/actions/runs/${policy.target.runId}`));
  const attempt=evidence.runBefore.attempt;
  if(!Number.isSafeInteger(attempt)||attempt<1||attempt>1000)throw new ContributionReadError('INVALID_RUN_ATTEMPT');
  const jobs={runId:policy.target.runId,attempt,totalCount:0,complete:false,items:[]};evidence.jobs=jobs;
  // Use small fixed pages so complete-pagination logic is exercised even with a modest bounded job set.
  for(let page=1;page<=2;page++){
   const response=await reader.get(`${base}/actions/runs/${policy.target.runId}/attempts/${attempt}/jobs?per_page=8&page=${page}`);
   if(!Number.isSafeInteger(response.total_count)||response.total_count<0||response.total_count>16||!Array.isArray(response.jobs)||response.jobs.length>8)throw new ContributionReadError('JOB_COLLECTION_TRUNCATED');
   if(page!==1&&response.total_count!==jobs.totalCount)throw new ContributionReadError('JOB_COLLECTION_CHANGED');
   jobs.totalCount=response.total_count;jobs.items.push(...response.jobs.map(raw=>job(raw,attempt)));
   if(new Set(jobs.items.map(item=>item.id)).size!==jobs.items.length||jobs.items.length>jobs.totalCount)throw new ContributionReadError('JOB_COLLECTION_CHANGED');
   if(jobs.items.length===jobs.totalCount){jobs.complete=true;break;}
   if(response.jobs.length!==8)throw new ContributionReadError('JOB_COLLECTION_TRUNCATED');
  }
  if(!jobs.complete)throw new ContributionReadError('JOB_COLLECTION_TRUNCATED');
  const commit=await reader.get(`${base}/git/commits/${policy.target.testedSha}`);
  if(!Array.isArray(commit.parents)||commit.parents.length>4)throw new ContributionReadError('INVALID_TESTED_COMMIT');
  evidence.testedCommit={repositoryId:policy.target.repository.id,sha:commit.sha,parents:commit.parents.map(p=>p.sha)};
  evidence.gateFiles={complete:false,items:[]};
  for(const ref of [policy.target.testedSha,policy.target.head.sha])for(const expected of policy.trusted.files){
   const content=await reader.get(`${base}/contents/${expected.path}?ref=${ref}`);evidence.gateFiles.items.push({path:expected.path,ref,digest:contentDigest(content,expected.path)});
  }
  evidence.gateFiles.complete=true;
  evidence.runAfter=run(await reader.get(`${base}/actions/runs/${policy.target.runId}`));
  evidence.workflowAfter=workflow(await reader.get(`${base}/actions/workflows/${policy.trusted.workflowId}`));
  evidence.pullRequestAfter=pullRequest(await reader.get(`${base}/pulls/${policy.target.pullRequestNumber}`),policy.target.repository,policy.target.pullRequestNumber);
  evidence.issueAfter=issue(await reader.get(`${base}/issues/${policy.target.issueNumber}`),policy.target.repository,policy.target.issueNumber);
  evidence.repositoryAfter=repository(await reader.get(base));
  reader.check();evidence.collectedAt=canonicalClock(now());evidence.availability='COMPLETE';
 }catch(error){reason=isPrivate?privateCode(error):code(error);evidence.availability=reason==='JOB_COLLECTION_TRUNCATED'?'TRUNCATED':'UNAVAILABLE';}
 let parsed;
 try{parsed=parseContributionEvidence(evidence);}catch{parsed=parseContributionEvidence({...evidence,availability:'UNAVAILABLE',repositoryBefore:null,repositoryAfter:null,issueBefore:null,issueAfter:null,pullRequestBefore:null,pullRequestAfter:null,workflowBefore:null,workflowAfter:null,runBefore:null,runAfter:null,jobs:null,testedCommit:null,gateFiles:null});reason='INVALID_OR_UNAVAILABLE_EVIDENCE';}
 return {version:1,kind:isPrivate?'PRIVATE_GITHUB_CI_EVIDENCE':'PUBLIC_GITHUB_CI_EVIDENCE',collection:isPrivate?'PRIVATE_GITHUB_API_READ':'PUBLIC_GITHUB_API_READ',cryptographicAttestation:false,policyDigest:hash(JSON.stringify(policy)),evidence:parsed,result:validateContributionEvidence(policy,parsed),readStatistics:reader.statistics(),reason};
}

function readJson(path,maximum){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum)throw new ContributionReadError('INVALID_LOCAL_INPUT');const bytes=Buffer.alloc(stat.size+1);let count=0;for(;;){const n=readSync(fd,bytes,count,bytes.length-count,null);if(!n)break;count+=n;if(count===bytes.length)throw new ContributionReadError('LOCAL_INPUT_CHANGED');}return parseContributionJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)),maximum);}finally{closeSync(fd);}
}
export function writeNewEvidence(path,value){
 const parent=realpathSync(dirname(resolve(path))),target=join(parent,basename(path)),temporary=join(parent,'.opengrail-ci-'+randomUUID()+'.tmp');const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');if(bytes.length>1048576)throw new ContributionReadError('LOCAL_EVIDENCE_BYTE_LIMIT');let fd;
 try{fd=openSync(temporary,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;linkSync(temporary,target);unlinkSync(temporary);const dir=openSync(parent,constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(dir);}finally{closeSync(dir);}}finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temporary);}catch{}}
}
function privateSummary(result){
 const {version,kind,status,reason,policyDigest,evidenceDigest,scope,currentness,researchQualified,independentResearch,mergeApproved,securityApproved,deploymentApproved,permissionChangeApproved,ordersEnabled,liveEnabled}=result;
 return {version,kind,status,reason,policyDigest,evidenceDigest,scope,currentness,researchQualified,independentResearch,mergeApproved,securityApproved,deploymentApproved,permissionChangeApproved,ordersEnabled,liveEnabled};
}
export async function main(args=process.argv.slice(2)){
 const operation=args[0];
 if(!(args.length===3&&['collect','verify'].includes(operation)||args.length===4&&operation==='collect-private'))throw new ContributionReadError('USAGE_COLLECT_POLICY_NEW_EVIDENCE_OR_COLLECT_PRIVATE_POLICY_NEW_EVIDENCE_CREDENTIAL_FILE_OR_VERIFY_POLICY_EVIDENCE');
 const policy=parseContributionPolicy(readJson(args[1],contributionEvidenceLimits.policyBytes));
 const isPrivate=contributionPolicyVisibility(policy)==='PRIVATE';
 if(operation==='verify'){
  const raw=readJson(args[2],1048576);if(raw?.kind!==(isPrivate?'PRIVATE_GITHUB_CI_EVIDENCE':'PUBLIC_GITHUB_CI_EVIDENCE')||raw.policyDigest!==hash(JSON.stringify(policy))||isPrivate&&(raw.version!==1||raw.collection!=='PRIVATE_GITHUB_API_READ'))throw new ContributionReadError('POLICY_EVIDENCE_MISMATCH');const evidence=parseContributionEvidence(raw.evidence),result=validateContributionEvidence(policy,evidence);
  process.stdout.write(JSON.stringify({version:1,collection:'OFFLINE_UNAUTHENTICATED_SNAPSHOT',freshness:'NOT_RECHECKED',cryptographicAttestation:false,result:isPrivate?privateSummary(result):result})+'\n');return result.status==='CI_VERIFIED'?0:1;
 }
 if(operation==='collect'&&isPrivate)throw new ContributionReadError('PUBLIC_POLICY_REQUIRED');
 if(operation==='collect-private'&&!isPrivate)throw new ContributionReadError('PRIVATE_POLICY_REQUIRED');
 const output=isPrivate?preparePrivateEvidenceOutput(args[2]):null;
 const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{const receipt=isPrivate?await collectPrivateContributionEvidence(policy,args[3],{signal:controller.signal}):await collectContributionEvidence(policy,{signal:controller.signal});if(output)output.write(receipt);else writeNewEvidence(args[2],receipt);process.stdout.write(JSON.stringify({version:1,collection:receipt.collection,cryptographicAttestation:false,result:isPrivate?privateSummary(receipt.result):receipt.result,readStatistics:receipt.readStatistics,reason:receipt.reason})+'\n');return receipt.result.status==='CI_VERIFIED'?0:1;}finally{output?.close();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch(error){process.stderr.write('Contribution evidence unavailable: '+code(error)+'. No repository or workflow was modified.\n');process.exitCode=1;}}
