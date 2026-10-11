import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contributionGatePaths,contributionRequiredSteps,contributionPolicyVisibility,parseContributionPolicy,parseContributionEvidence,parseContributionJson,validateContributionEvidence} from '../scripts/contribution-evidence-core.mjs';

// Invented provider-shaped metadata only. No repository, credential, CI run,
// isolation approval or hosted acceptance is established by these fixtures.
const hash=value=>createHash('sha256').update(value).digest('hex');
const baseSha='a'.repeat(40),headSha='b'.repeat(40),testedSha='c'.repeat(40);
const authorityFlags=['researchQualified','independentResearch','mergeApproved','securityApproved','deploymentApproved','permissionChangeApproved','ordersEnabled','liveEnabled'];
function fixture(visibility='PRIVATE'){
 const repository={id:101,fullName:'fixture-owner/invented-opengrail'},fork={id:202,fullName:'fixture-agent/invented-fork'};
 const target={repository,issueNumber:7,pullRequestNumber:9,base:{ref:'main',sha:baseSha},head:{repository:fork,ref:'bounded-fix',sha:headSha},testedSha,runId:301};
 const trusted={workflowId:401,workflowPath:contributionGatePaths[0],files:contributionGatePaths.map(path=>({path,digest:hash('INVENTED trusted source '+path)}))};
 const policy=visibility==='PUBLIC'?{version:1,publicReadApproved:true,target,trusted}:{version:2,repositoryVisibility:'PRIVATE',privateReadApproved:true,credentialIsolationConfirmed:true,target,trusted};
 const pr={id:501,number:9,repositoryId:101,state:'open',draft:false,merged:false,base:{repository,ref:'main',sha:baseSha},head:target.head,mergeSha:testedSha};
 const run={id:301,repositoryId:101,workflowId:401,path:contributionGatePaths[0],attempt:2,event:'pull_request',status:'completed',conclusion:'success',headSha,headRepository:fork,pullRequests:[{number:9,base:pr.base,head:pr.head}],createdAt:'2026-10-11T01:00:00Z',updatedAt:'2026-10-11T01:02:00Z',startedAt:'2026-10-11T01:00:01Z'};
 const job={id:601,runId:301,runAttempt:2,headSha,name:'Contribution checks',status:'completed',conclusion:'success',startedAt:'2026-10-11T01:00:02Z',completedAt:'2026-10-11T01:01:59Z',steps:contributionRequiredSteps(testedSha).map((name,n)=>({number:n+1,name,status:'completed',conclusion:'success',startedAt:'2026-10-11T01:00:03Z',completedAt:'2026-10-11T01:01:58Z'}))};
 const observed={...repository,private:visibility==='PRIVATE'};
 const evidence={version:1,collectedAt:'2026-10-11T01:03:00.000Z',availability:'COMPLETE',repositoryBefore:{...observed},repositoryAfter:{...observed},issueBefore:{id:701,number:7,repositoryId:101,isPullRequest:false,state:'open'},issueAfter:{id:701,number:7,repositoryId:101,isPullRequest:false,state:'open'},pullRequestBefore:structuredClone(pr),pullRequestAfter:structuredClone(pr),workflowBefore:{id:401,path:contributionGatePaths[0],state:'active'},workflowAfter:{id:401,path:contributionGatePaths[0],state:'active'},runBefore:structuredClone(run),runAfter:structuredClone(run),jobs:{runId:301,attempt:2,totalCount:1,complete:true,items:[job]},testedCommit:{repositoryId:101,sha:testedSha,parents:[baseSha,headSha]},gateFiles:{complete:true,items:[testedSha,headSha].flatMap(ref=>trusted.files.map(file=>({...file,ref})))}};
 return {policy,evidence};
}
function assess(edit,visibility='PRIVATE'){
 const {policy,evidence}=fixture(visibility);edit?.(evidence,policy);return validateContributionEvidence(policy,evidence);
}
function assertCases(cases){
 for(const [name,edit,status,reason] of cases)for(const visibility of ['PRIVATE','PUBLIC']){
  const result=assess(edit,visibility);assert.equal(result.status,status,visibility+' '+name);if(reason)assert.equal(result.reason,reason,visibility+' '+name);for(const flag of authorityFlags)assert.equal(result[flag],false,visibility+' '+name+' '+flag);
 }
}

test('private policy admits only version two with explicit read and isolation declarations',()=>{
 const {policy}=fixture();assert.equal(contributionPolicyVisibility(policy),'PRIVATE');assert.deepEqual(parseContributionPolicy(policy),policy);
 for(const field of ['privateReadApproved','credentialIsolationConfirmed'])for(const value of [undefined,false,0,1,'true',null]){
  const invalid=structuredClone(policy);if(value===undefined)delete invalid[field];else invalid[field]=value;assert.throws(()=>parseContributionPolicy(invalid),{code:'INVALID_CONTRIBUTION_POLICY'});assert.throws(()=>contributionPolicyVisibility(invalid),{code:'INVALID_CONTRIBUTION_POLICY'});
 }
 for(const patch of [{version:1},{version:'2'},{version:3},{repositoryVisibility:'PUBLIC'},{repositoryVisibility:'private'},{repositoryVisibility:null},{publicReadApproved:true},{token:'not-an-accepted-field'},{mergeApproved:true}])assert.throws(()=>parseContributionPolicy({...policy,...patch}),{code:'INVALID_CONTRIBUTION_POLICY'});
 for(const field of ['version','repositoryVisibility','target','trusted']){const invalid=structuredClone(policy);delete invalid[field];assert.throws(()=>parseContributionPolicy(invalid),{code:'INVALID_CONTRIBUTION_POLICY'});}
});

test('legacy public policy retains its exact keys, canonical order and public-only admission',()=>{
 const {policy,evidence}=fixture('PUBLIC');const parsed=parseContributionPolicy(policy);
 assert.equal(contributionPolicyVisibility(parsed),'PUBLIC');assert.deepEqual(parsed,policy);assert.deepEqual(Object.keys(parsed),['version','publicReadApproved','target','trusted']);
 for(const patch of [{publicReadApproved:false},{privateReadApproved:true},{credentialIsolationConfirmed:true},{repositoryVisibility:'PRIVATE'},{version:2}])assert.throws(()=>parseContributionPolicy({...policy,...patch}),{code:'INVALID_CONTRIBUTION_POLICY'});
 const result=validateContributionEvidence(parsed,evidence);assert.equal(result.status,'CI_VERIFIED');assert.equal(result.policyDigest,hash(JSON.stringify(policy)));
 assert.deepEqual(Object.keys(result),['version','kind','status','reason','checkedAt','policyDigest','evidenceDigest','target','run','scope','currentness',...authorityFlags]);
});

test('both policy versions retain strict target, source-parent and trusted-gate constraints',()=>{
 const edits=[p=>delete p.target.repository.id,p=>p.target.repository.id=0,p=>p.target.repository.fullName='https://example.invalid/repo',p=>p.target.issueNumber=0,p=>p.target.pullRequestNumber=0,p=>p.target.base.sha=headSha,p=>p.target.testedSha=headSha,p=>p.target.testedSha=baseSha,p=>p.target.head.ref='../main',p=>p.target.head.sha=headSha.toUpperCase(),p=>p.target.extra='untrusted',p=>p.trusted.extra='untrusted',p=>p.trusted.workflowId=0,p=>p.trusted.workflowPath='.github/workflows/replacement.yml',p=>p.trusted.files.pop(),p=>p.trusted.files.push({...p.trusted.files[0]}),p=>p.trusted.files[1]={...p.trusted.files[0]},p=>p.trusted.files[0].digest='invalid'];
 for(const visibility of ['PRIVATE','PUBLIC'])for(const edit of edits){const {policy}=fixture(visibility);edit(policy);assert.throws(()=>parseContributionPolicy(policy),{code:'INVALID_CONTRIBUTION_POLICY'});}
});

test('canonical private policy and evidence remain deterministic across input key orders',()=>{
 const {policy,evidence}=fixture();const reordered={trusted:structuredClone(policy.trusted),target:structuredClone(policy.target),credentialIsolationConfirmed:true,privateReadApproved:true,repositoryVisibility:'PRIVATE',version:2};
 reordered.target={runId:301,testedSha,head:structuredClone(policy.target.head),base:structuredClone(policy.target.base),pullRequestNumber:9,issueNumber:7,repository:structuredClone(policy.target.repository)};
 reordered.trusted={files:structuredClone(policy.trusted.files),workflowPath:contributionGatePaths[0],workflowId:401};
 assert.equal(JSON.stringify(parseContributionPolicy(reordered)),JSON.stringify(policy));
 const reorderedEvidence=Object.fromEntries(Object.entries(evidence).reverse());
 for(const side of ['Before','After'])reorderedEvidence['repository'+side]={private:true,fullName:policy.target.repository.fullName,id:policy.target.repository.id};
 const first=validateContributionEvidence(policy,evidence),second=validateContributionEvidence(parseContributionJson(JSON.stringify(reordered)),parseContributionJson(JSON.stringify(reorderedEvidence)));
 assert.deepEqual(first,second);assert.equal(first.policyDigest,hash(JSON.stringify(policy)));assert.equal(first.evidenceDigest,hash(JSON.stringify(parseContributionEvidence(evidence))));
 const publicFixture=fixture('PUBLIC'),publicResult=validateContributionEvidence(publicFixture.policy,publicFixture.evidence);assert.notEqual(first.policyDigest,publicResult.policyDigest);assert.notEqual(first.evidenceDigest,publicResult.evidenceDigest);
});

test('private visibility is mandatory in both snapshots and cannot be inherited across modes',()=>{
 for(const visibility of ['PRIVATE','PUBLIC'])for(const changed of [['repositoryBefore'],['repositoryAfter'],['repositoryBefore','repositoryAfter']]){
  const {policy,evidence}=fixture(visibility);for(const field of changed)evidence[field].private=visibility!=='PRIVATE';const result=validateContributionEvidence(policy,evidence);assert.equal(result.status,'UNAVAILABLE');assert.equal(result.reason,'REPOSITORY_CONTEXT_MISMATCH');
 }
 for(const field of ['repositoryBefore','repositoryAfter']){
  const {policy,evidence}=fixture();for(const malformed of [undefined,null,'true',1]){const invalid=structuredClone(evidence);if(malformed===undefined)delete invalid[field].private;else invalid[field].private=malformed;assert.throws(()=>validateContributionEvidence(policy,invalid),{code:'INVALID_CONTRIBUTION_EVIDENCE'});}
 }
});

test('private declarations grant no authority and cannot upgrade missing or truncated snapshots',()=>{
 const {policy,evidence}=fixture(),result=validateContributionEvidence(policy,evidence);assert.equal(result.status,'CI_VERIFIED');assert.equal(result.kind,'CONTRIBUTION_CI_EVIDENCE');assert.equal(result.scope,'REQUIRED_CI_GATES_ONLY');assert.equal(result.currentness,'COLLECTED_SNAPSHOT_ONLY');
 for(const flag of authorityFlags)assert.equal(result[flag],false);
 for(const availability of ['UNAVAILABLE','TRUNCATED']){const incomplete=structuredClone(evidence);incomplete.availability=availability;assert.equal(validateContributionEvidence(policy,incomplete).status,'UNAVAILABLE');}
 for(const pair of ['repository','issue','pullRequest','workflow','run'])for(const side of ['Before','After']){const missing=structuredClone(evidence);missing[pair+side]=null;assert.equal(validateContributionEvidence(policy,missing).status,'UNAVAILABLE');}
 for(const key of ['authenticated','isolationVerified','mergeApproved','ordersEnabled'])assert.throws(()=>parseContributionPolicy({...policy,[key]:true}),{code:'INVALID_CONTRIBUTION_POLICY'});
});

test('private collection correlation still binds exact repository and issue identities',()=>assertCases([
 ['repository renamed',(e)=>{e.repositoryAfter.fullName='fixture-owner/other';},'UNAVAILABLE','REPOSITORY_CONTEXT_MISMATCH'],
 ['repository id substituted',(e)=>{e.repositoryBefore.id++;},'UNAVAILABLE','REPOSITORY_CONTEXT_MISMATCH'],
 ['issue is a PR',(e)=>{e.issueBefore.isPullRequest=true;},'UNAVAILABLE','ISSUE_CONTEXT_MISMATCH'],
 ['issue belongs elsewhere',(e)=>{e.issueAfter.repositoryId++;},'UNAVAILABLE','ISSUE_CONTEXT_MISMATCH'],
 ['issue id replaced',(e)=>{e.issueAfter.id++;},'UNAVAILABLE','ISSUE_CONTEXT_MISMATCH'],
 ['issue changed during reads',(e)=>{e.issueAfter.state='closed';},'STALE','ISSUE_CHANGED_DURING_COLLECTION'],
]));

test('private source correlation still rejects changed PR refs, source, identity and review state',()=>assertCases([
 ['foreign PR',(e)=>{e.pullRequestBefore.repositoryId++;},'UNAVAILABLE','PULL_REQUEST_CONTEXT_MISMATCH'],
 ['changed head',(e)=>{e.pullRequestAfter.head.sha='d'.repeat(40);},'STALE','PULL_REQUEST_CHANGED'],
 ['changed base',(e)=>{e.pullRequestAfter.base.sha='d'.repeat(40);},'STALE','PULL_REQUEST_CHANGED'],
 ['changed head repository',(e)=>{e.pullRequestAfter.head.repository.id++;},'STALE','PULL_REQUEST_CHANGED'],
 ['changed merge',(e)=>{e.pullRequestAfter.mergeSha=null;},'STALE','PULL_REQUEST_CHANGED'],
 ['closed PR',(e)=>{e.pullRequestBefore.state=e.pullRequestAfter.state='closed';},'STALE','PULL_REQUEST_NOT_REVIEWABLE'],
 ['draft PR',(e)=>{e.pullRequestBefore.draft=e.pullRequestAfter.draft=true;},'STALE','PULL_REQUEST_NOT_REVIEWABLE'],
 ['merged PR',(e)=>{e.pullRequestBefore.merged=e.pullRequestAfter.merged=true;},'STALE','PULL_REQUEST_NOT_REVIEWABLE'],
]));

test('private run evidence still binds the intended workflow, event, exact attempt and PR',()=>assertCases([
 ['different workflow',(e)=>{e.workflowBefore.id++;},'UNAVAILABLE','WORKFLOW_CONTEXT_MISMATCH'],
 ['disabled workflow',(e)=>{e.workflowBefore.state=e.workflowAfter.state='disabled_manually';},'UNAVAILABLE','WORKFLOW_DISABLED'],
 ['privileged event',(e)=>{e.runBefore.event=e.runAfter.event='pull_request_target';},'UNAVAILABLE','RUN_CONTEXT_MISMATCH'],
 ['foreign run repository',(e)=>{e.runBefore.repositoryId=e.runAfter.repositoryId=901;},'UNAVAILABLE','RUN_CONTEXT_MISMATCH'],
 ['rerun while collecting',(e)=>{e.runAfter.attempt++;},'STALE','RUN_CHANGED_DURING_COLLECTION'],
 ['missing PR association',(e)=>{e.runBefore.pullRequests=e.runAfter.pullRequests=[];},'STALE','RUN_COMMIT_BINDING_CHANGED'],
 ['old successful jobs',(e)=>{e.jobs.attempt--;},'UNAVAILABLE','JOB_PAGE_OR_ATTEMPT_INCOMPLETE'],
 ['job from another attempt',(e)=>{e.jobs.items[0].runAttempt--;},'STALE','JOB_COMMIT_OR_ATTEMPT_CHANGED'],
 ['pending run',(e)=>{e.runBefore.status=e.runAfter.status='in_progress';e.runBefore.conclusion=e.runAfter.conclusion=null;},'PENDING','WORKFLOW_ATTEMPT_PENDING'],
 ['failed run',(e)=>{e.runBefore.conclusion=e.runAfter.conclusion='failure';},'FAILED','WORKFLOW_ATTEMPT_NOT_SUCCESSFUL'],
]));

test('private checks still require an exact two-parent test merge and independent gate pins',()=>{
 assertCases([
  ['parent order reversed',(e)=>{e.testedCommit.parents=[headSha,baseSha];},'STALE','TESTED_MERGE_PARENTS_CHANGED'],
  ['one parent',(e)=>{e.testedCommit.parents=[baseSha];},'STALE','TESTED_MERGE_PARENTS_CHANGED'],
  ['extra parent',(e)=>{e.testedCommit.parents.push('d'.repeat(40));},'STALE','TESTED_MERGE_PARENTS_CHANGED'],
  ['foreign tested commit',(e)=>{e.testedCommit.repositoryId++;},'STALE','TESTED_MERGE_PARENTS_CHANGED'],
  ['missing gate file',(e)=>{e.gateFiles.items.pop();},'UNAVAILABLE','TRUSTED_FILES_INCOMPLETE'],
  ['duplicate gate file',(e)=>{e.gateFiles.items[5]={...e.gateFiles.items[0]};},'UNAVAILABLE','TRUSTED_FILES_INCOMPLETE'],
 ]);
 for(const visibility of ['PRIVATE','PUBLIC'])for(const path of contributionGatePaths)for(const ref of [headSha,testedSha]){
  const result=assess(e=>{e.gateFiles.items.find(item=>item.path===path&&item.ref===ref).digest='d'.repeat(64);},visibility);assert.equal(result.status,'FAILED');assert.equal(result.reason,'TRUSTED_GATE_CHANGED');
 }
});

test('private complete-job evidence preserves failed, skipped, interrupted and malformed gates',()=>assertCases([
 ['truncated jobs',(e)=>{e.jobs.complete=false;},'UNAVAILABLE','JOB_PAGE_OR_ATTEMPT_INCOMPLETE'],
 ['missing job',(e)=>{e.jobs.items=[];e.jobs.totalCount=0;},'FAILED','REQUIRED_JOB_MISSING_OR_AMBIGUOUS'],
 ['missing required step',(e)=>{e.jobs.items[0].steps.pop();},'FAILED','REQUIRED_STEP_MISSING_OR_REORDERED'],
 ['skipped required step',(e)=>{e.jobs.items[0].steps[3].conclusion='skipped';},'FAILED','REQUIRED_STEP_NOT_SUCCESSFUL'],
 ['failed job',(e)=>{e.jobs.items[0].conclusion='failure';},'FAILED','REQUIRED_JOB_NOT_SUCCESSFUL'],
 ['interrupted job',(e)=>{e.jobs.items[0].conclusion='cancelled';},'FAILED','REQUIRED_JOB_NOT_SUCCESSFUL'],
 ['pending step',(e)=>{e.jobs.items[0].steps[3].status='in_progress';},'PENDING','REQUIRED_STEP_PENDING'],
 ['wrong checkout step SHA',(e)=>{e.jobs.items[0].steps[1].name=e.jobs.items[0].steps[1].name.replace(testedSha,headSha);},'FAILED','REQUIRED_STEP_MISSING_OR_REORDERED'],
 ['duplicated step number',(e)=>{e.jobs.items[0].steps[1].number=1;},'UNAVAILABLE','STEP_IDENTITY_AMBIGUOUS'],
 ['future run timestamp',(e)=>{e.runBefore.updatedAt=e.runAfter.updatedAt='2026-10-11T02:00:00Z';},'UNAVAILABLE','RUN_TIMESTAMPS_INCONSISTENT'],
]));

test('private policy supports an exact contribution branch inside the same private repository',()=>{
 const {policy,evidence}=fixture();policy.target.head.repository=structuredClone(policy.target.repository);
 for(const side of ['Before','After']){evidence['pullRequest'+side].head.repository=structuredClone(policy.target.repository);evidence['run'+side].headRepository=structuredClone(policy.target.repository);evidence['run'+side].pullRequests[0].head.repository=structuredClone(policy.target.repository);}
 assert.equal(validateContributionEvidence(policy,evidence).status,'CI_VERIFIED');
});

test('private flags retain safe plain-data admission and cannot carry hidden credentials',()=>{
 const {policy}=fixture();let calls=0;
 const getter={...policy};Object.defineProperty(getter,'credentialIsolationConfirmed',{get(){calls++;return true;},enumerable:true});assert.throws(()=>contributionPolicyVisibility(getter),{code:'INVALID_PLAIN_EVIDENCE'});assert.equal(calls,0);
 const hidden={...policy};Object.defineProperty(hidden,'privateReadApproved',{value:true,enumerable:false});assert.throws(()=>parseContributionPolicy(hidden),{code:'INVALID_PLAIN_EVIDENCE'});
 for(const token of ['github_pat_'+'X'.repeat(64),'ghp_'+'Y'.repeat(36)]){const invalid=structuredClone(policy);invalid.target.repository.fullName='fixture-owner/'+token;assert.throws(()=>parseContributionPolicy(invalid),error=>error.code==='CREDENTIAL_SHAPED_EVIDENCE'&&!error.message.includes(token));}
 for(const source of ['{"version":2,"privateReadApproved":true,"privateReadApproved":false}','{"version":2,"credentialIsolationConfirmed":true,"credential\\u0049solationConfirmed":false}'])assert.throws(()=>parseContributionJson(source),{code:'DUPLICATE_EVIDENCE_KEY'});
});
