import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contributionEvidenceLimits,contributionGatePaths,contributionRequiredSteps,parseContributionPolicy,parseContributionEvidence,parseContributionJson,validateContributionEvidence} from '../scripts/contribution-evidence-core.mjs';

// Invented provider-shaped metadata, not a published repository or real CI run.
const hash=value=>createHash('sha256').update(value).digest('hex');
const baseSha='a'.repeat(40),headSha='b'.repeat(40),testedSha='c'.repeat(40);
function fixture(){
 const repository={id:101,fullName:'fixture-owner/invented-opengrail'},fork={id:202,fullName:'fixture-agent/invented-fork'};
 const policy={version:1,publicReadApproved:true,target:{repository,issueNumber:7,pullRequestNumber:9,base:{ref:'main',sha:baseSha},head:{repository:fork,ref:'bounded-fix',sha:headSha},testedSha,runId:301},trusted:{workflowId:401,workflowPath:contributionGatePaths[0],files:contributionGatePaths.map(path=>({path,digest:hash('INVENTED trusted source '+path)}))}};
 const pr={id:501,number:9,repositoryId:101,state:'open',draft:false,merged:false,base:{repository,ref:'main',sha:baseSha},head:policy.target.head,mergeSha:testedSha};
 const run={id:301,repositoryId:101,workflowId:401,path:contributionGatePaths[0],attempt:2,event:'pull_request',status:'completed',conclusion:'success',headSha,headRepository:fork,pullRequests:[{number:9,base:pr.base,head:pr.head}],createdAt:'2026-10-11T01:00:00Z',updatedAt:'2026-10-11T01:02:00Z',startedAt:'2026-10-11T01:00:01Z'};
 const job={id:601,runId:301,runAttempt:2,headSha,name:'Contribution checks',status:'completed',conclusion:'success',startedAt:'2026-10-11T01:00:02Z',completedAt:'2026-10-11T01:01:59Z',steps:contributionRequiredSteps(testedSha).map((name,n)=>({number:n+1,name,status:'completed',conclusion:'success',startedAt:'2026-10-11T01:00:03Z',completedAt:'2026-10-11T01:01:58Z'}))};
 const evidence={version:1,collectedAt:'2026-10-11T01:03:00.000Z',availability:'COMPLETE',repositoryBefore:{...repository,private:false},repositoryAfter:{...repository,private:false},issueBefore:{id:701,number:7,repositoryId:101,isPullRequest:false,state:'open'},issueAfter:{id:701,number:7,repositoryId:101,isPullRequest:false,state:'open'},pullRequestBefore:structuredClone(pr),pullRequestAfter:structuredClone(pr),workflowBefore:{id:401,path:contributionGatePaths[0],state:'active'},workflowAfter:{id:401,path:contributionGatePaths[0],state:'active'},runBefore:structuredClone(run),runAfter:structuredClone(run),jobs:{runId:301,attempt:2,totalCount:1,complete:true,items:[job]},testedCommit:{repositoryId:101,sha:testedSha,parents:[baseSha,headSha]},gateFiles:{complete:true,items:[testedSha,headSha].flatMap(ref=>policy.trusted.files.map(file=>({...file,ref})))}};
 return {policy,evidence};
}
function status(change){const {policy,evidence}=fixture();change?.(evidence,policy);return validateContributionEvidence(policy,evidence);}

test('exact stable current-attempt metadata verifies only required CI gates',()=>{
 const {policy,evidence}=fixture(),report=validateContributionEvidence(policy,evidence);assert.equal(report.status,'CI_VERIFIED');assert.equal(report.scope,'REQUIRED_CI_GATES_ONLY');assert.equal(report.currentness,'COLLECTED_SNAPSHOT_ONLY');assert.equal(report.run.testedSha,testedSha);assert.equal(report.run.attempt,2);assert.match(report.policyDigest,/^[a-f0-9]{64}$/);assert.match(report.evidenceDigest,/^[a-f0-9]{64}$/);
 for(const key of ['researchQualified','independentResearch','mergeApproved','securityApproved','deploymentApproved','permissionChangeApproved','ordersEnabled','liveEnabled'])assert.equal(report[key],false);
 assert.deepEqual(validateContributionEvidence(parseContributionJson(JSON.stringify(policy)),parseContributionJson(JSON.stringify(evidence))),report);
});
test('explicit reviewed public-read policy and all three independent gate pins are mandatory',()=>{
 for(const edit of [p=>{p.publicReadApproved=false;},p=>{delete p.target.repository.id;},p=>{p.trusted.files.pop();},p=>{p.trusted.files[1]={...p.trusted.files[0]};},p=>{p.trusted.workflowPath='.github/workflows/untrusted.yml';},p=>{p.target.testedSha=p.target.head.sha;},p=>{p.target.base.sha=p.target.head.sha;},p=>{p.authorAssociation='OWNER';}]){const {policy}=fixture();edit(policy);assert.throws(()=>parseContributionPolicy(policy));}
});
test('repository identity, rename and private transitions cannot inherit a verification',()=>{
 for(const edit of [e=>{e.repositoryAfter.id++;},e=>{e.repositoryAfter.fullName='other/project';},e=>{e.repositoryAfter.private=true;}])assert.equal(status(edit).status,'UNAVAILABLE');
});
test('exact issue identity is separate from a PR and changed issue state is stale',()=>{
 for(const edit of [e=>{e.issueBefore.number=8;},e=>{e.issueAfter.id++;},e=>{e.issueBefore.isPullRequest=true;},e=>{e.issueAfter.repositoryId++;}])assert.equal(status(edit).status,'UNAVAILABLE');
 assert.equal(status(e=>{e.issueAfter.state='closed';}).status,'STALE');
});
test('base/head refs, fork identity and tested merge remain bound across PR snapshots',()=>{
 for(const edit of [e=>{e.pullRequestAfter.head.sha='d'.repeat(40);},e=>{e.pullRequestBefore.base.sha='d'.repeat(40);},e=>{e.pullRequestAfter.head.repository.id++;},e=>{e.pullRequestBefore.head.repository.fullName='other/fork';},e=>{e.pullRequestAfter.base.ref='replacement';},e=>{e.pullRequestAfter.mergeSha='d'.repeat(40);},e=>{e.pullRequestBefore.mergeSha=null;}])assert.equal(status(edit).status,'STALE');
 for(const edit of [e=>{e.pullRequestAfter.number++;},e=>{e.pullRequestBefore.repositoryId++;},e=>{e.pullRequestAfter.id++;}])assert.equal(status(edit).status,'UNAVAILABLE');
});
test('closed, merged or draft PRs are not current reviewable contributions',()=>{
 for(const field of ['state','merged','draft'])assert.equal(status(e=>{for(const name of ['pullRequestBefore','pullRequestAfter'])e[name][field]=field==='state'?'closed':true;}).status,'STALE');
});
test('only the independently configured workflow, event and exact bounded run path can verify',()=>{
 assert.equal(status(e=>{e.runBefore.path=e.runAfter.path=contributionGatePaths[0]+'@refs/pull/9/merge';}).status,'CI_VERIFIED');
 for(const edit of [e=>{e.workflowAfter.id++;},e=>{e.workflowBefore.path='.github/workflows/fake.yml';},e=>{e.workflowBefore.state=e.workflowAfter.state='disabled_manually';},e=>{e.runBefore.event=e.runAfter.event='pull_request_target';},e=>{e.runBefore.path=e.runAfter.path=contributionGatePaths[0]+'@main';},e=>{e.runBefore.repositoryId=e.runAfter.repositoryId=909;},e=>{e.runBefore.headRepository.id=e.runAfter.headRepository.id=909;}])assert.equal(status(edit).status,'UNAVAILABLE');
});
test('rerun attempts and changed run snapshots cannot reuse older successful jobs',()=>{
 assert.equal(status(e=>{e.runAfter.attempt++;}).status,'STALE');assert.equal(status(e=>{e.runAfter.updatedAt='2026-10-11T01:02:01Z';}).status,'STALE');
 assert.equal(status(e=>{e.jobs.attempt--;}).status,'UNAVAILABLE');assert.equal(status(e=>{e.jobs.items[0].runAttempt--;}).status,'STALE');
});
test('run PR linkage and head context reject unrelated or ambiguous run claims',()=>{
 for(const edit of [e=>{e.runBefore.pullRequests=e.runAfter.pullRequests=[];},e=>{e.runBefore.pullRequests=e.runAfter.pullRequests=[...e.runBefore.pullRequests,...e.runBefore.pullRequests];},e=>{e.runBefore.pullRequests[0].number=e.runAfter.pullRequests[0].number=11;},e=>{e.runBefore.headSha=e.runAfter.headSha='d'.repeat(40);},e=>{e.runBefore.pullRequests[0].base.sha=e.runAfter.pullRequests[0].base.sha='d'.repeat(40);}])assert.equal(status(edit).status,'STALE');
});
test('pending workflow attempts retain pending disposition and never imply passing gates',()=>{
 for(const pending of ['queued','in_progress','waiting','requested','pending'])assert.equal(status(e=>{for(const name of ['runBefore','runAfter']){e[name].status=pending;e[name].conclusion=null;}e.jobs=null;e.gateFiles=null;}).status,'PENDING');
});
test('completed failed, skipped, neutral and unavailable workflow evidence fails closed',()=>{
 for(const conclusion of ['failure','skipped','neutral','cancelled','timed_out','action_required',null])assert.equal(status(e=>{e.runBefore.conclusion=e.runAfter.conclusion=conclusion;}).status,'FAILED');
 for(const availability of ['UNAVAILABLE','TRUNCATED'])assert.equal(status(e=>{e.availability=availability;}).status,'UNAVAILABLE');assert.equal(status(e=>{e.runAfter=null;}).status,'UNAVAILABLE');
});
test('tested commit is an exact two-parent merge in the verified base repository',()=>{
 for(const parents of [[headSha,baseSha],[baseSha],[baseSha,headSha,'d'.repeat(40)],['d'.repeat(40),headSha]])assert.equal(status(e=>{e.testedCommit.parents=parents;}).status,'STALE');
 assert.equal(status(e=>{e.testedCommit.repositoryId++;}).status,'STALE');assert.equal(status(e=>{e.testedCommit.sha='d'.repeat(40);}).status,'STALE');
});
test('trusted workflow, checker and package must match at both head and tested merge',()=>{
 for(const path of contributionGatePaths)for(const ref of [headSha,testedSha])assert.equal(status(e=>{e.gateFiles.items.find(item=>item.path===path&&item.ref===ref).digest='d'.repeat(64);}).status,'FAILED');
 for(const edit of [e=>{e.gateFiles.complete=false;},e=>{e.gateFiles.items.pop();},e=>{e.gateFiles.items[5]={...e.gateFiles.items[0]};},e=>{e.gateFiles.items[5].ref='d'.repeat(40);}])assert.equal(status(edit).status,'UNAVAILABLE');
});
test('a complete job page and exact attempt are required, with no truncation promotion',()=>{
 for(const edit of [e=>{e.jobs.complete=false;},e=>{e.jobs.totalCount=2;},e=>{e.jobs.runId++;},e=>{e.jobs=null;}])assert.equal(status(edit).status,'UNAVAILABLE');
 assert.equal(status(e=>{e.jobs.items=[];e.jobs.totalCount=0;}).status,'FAILED');assert.equal(status(e=>{e.jobs.items[0].name='Fake green job';}).status,'FAILED');
 assert.equal(status(e=>{e.jobs.items.push({...e.jobs.items[0],id:602});e.jobs.totalCount=2;}).status,'FAILED');
});
test('required jobs that are failed, skipped or pending preserve their real disposition',()=>{
 for(const conclusion of ['failure','skipped','neutral',null])assert.equal(status(e=>{e.jobs.items[0].conclusion=conclusion;}).status,'FAILED');
 assert.equal(status(e=>{e.jobs.items[0].status='in_progress';e.jobs.items[0].conclusion=null;}).status,'PENDING');assert.equal(status(e=>{e.jobs.items[0].headSha='d'.repeat(40);}).status,'STALE');
});
test('missing, reordered, failed and skipped required steps cannot masquerade as job success',()=>{
 for(const conclusion of ['failure','skipped','neutral',null])assert.equal(status(e=>{e.jobs.items[0].steps[3].conclusion=conclusion;}).status,'FAILED');
 assert.equal(status(e=>{e.jobs.items[0].steps.pop();}).status,'FAILED');assert.equal(status(e=>{const steps=e.jobs.items[0].steps;[steps[1].name,steps[2].name]=[steps[2].name,steps[1].name];}).status,'FAILED');
 assert.equal(status(e=>{e.jobs.items[0].steps[3].status='in_progress';e.jobs.items[0].steps[3].conclusion=null;}).status,'PENDING');
});
test('initial checkout and final fixed-check steps must name the actual tested merge SHA',()=>{
 for(const n of [1,5])assert.equal(status(e=>{e.jobs.items[0].steps[n].name=e.jobs.items[0].steps[n].name.replace(testedSha,headSha);}).status,'FAILED');
 assert.equal(status(e=>{e.jobs.items[0].steps[1].name='Verify checkout identity';}).status,'FAILED');
});
test('ambiguous step numbering/names and inconsistent provider times are unavailable',()=>{
 for(const edit of [e=>{e.jobs.items[0].steps[1].number=1;},e=>{e.jobs.items[0].steps[1].name=e.jobs.items[0].steps[0].name;},e=>{e.jobs.items[0].steps[2].completedAt='2026-10-11T01:00:00Z';},e=>{e.jobs.items[0].completedAt='2026-10-11T01:04:00Z';},e=>{e.runBefore.startedAt=e.runAfter.startedAt='2026-10-11T00:59:59Z';}])assert.equal(status(edit).status,'UNAVAILABLE');
});
test('provider timestamp offsets/millisecond precision are compared as actual instants',()=>{
 assert.equal(status(e=>{e.runBefore.createdAt=e.runAfter.createdAt='2026-10-11T01:00:00.000Z';e.jobs.items[0].steps[0].startedAt='2026-10-11T02:00:03+01:00';}).status,'CI_VERIFIED');
 assert.equal(status(e=>{e.collectedAt='2026-10-11T01:00:00Z';}).status,'UNAVAILABLE');
});
test('untrusted result artifacts, author associations and privilege assertions are not admitted evidence',()=>{
 const {policy,evidence}=fixture();for(const field of ['authorAssociation','resultArtifact','mergeApproved','status'])assert.throws(()=>parseContributionEvidence({...evidence,[field]:field==='resultArtifact'?{tests:9000,passed:true}:'OWNER'}));
 const report=validateContributionEvidence(policy,evidence);assert(!JSON.stringify(report).includes('authorAssociation'));assert(!JSON.stringify(report).includes('tests'));
});
test('plain bounded admission never invokes getters, toJSON or hidden/sparse data',()=>{
 let calls=0;const getter={get version(){calls++;return 1;}};assert.throws(()=>parseContributionEvidence(getter));assert.equal(calls,0);
 assert.throws(()=>parseContributionEvidence({toJSON(){calls++;return {};}}));assert.equal(calls,0);
 const hidden={};Object.defineProperty(hidden,'version',{value:1,enumerable:false});assert.throws(()=>parseContributionEvidence(hidden));assert.throws(()=>parseContributionEvidence({array:new Array(3)}));assert.throws(()=>parseContributionEvidence({number:Infinity}));
});
test('strict JSON detects escaped duplicate keys, malformed input, depth and nonfinite numbers',()=>{
 for(const input of ['{"headSha":1,"\\u0068eadSha":2}','{"outer":{"x":1,"x":2}}','{"x":1,}','{"x":1} trailing','{"x":1e309}','{"x":"unterminated}'])assert.throws(()=>parseContributionJson(input));
 assert.throws(()=>parseContributionJson('['.repeat(18)+'0'+']'.repeat(18)));assert.throws(()=>parseContributionJson(' '.repeat(contributionEvidenceLimits.jsonBytes+1),contributionEvidenceLimits.jsonBytes));
});
test('generic reader/envelope JSON bound is distinct from strict public evidence admission',()=>{
 const raw=JSON.stringify({padding:'x'.repeat(contributionEvidenceLimits.evidenceBytes+1)});assert.equal(parseContributionJson(raw,contributionEvidenceLimits.jsonBytes).padding.length,contributionEvidenceLimits.evidenceBytes+1);assert.throws(()=>parseContributionEvidence(parseContributionJson(raw,contributionEvidenceLimits.jsonBytes)));assert.throws(()=>parseContributionJson(raw,contributionEvidenceLimits.policyBytes));
});
test('repeated offline validation is deterministic but does not recheck current external state',()=>{
 const {policy,evidence}=fixture(),first=validateContributionEvidence(policy,evidence);assert.deepEqual(validateContributionEvidence(policy,evidence),first);evidence.pullRequestAfter.head.sha='d'.repeat(40);const changed=validateContributionEvidence(policy,evidence);assert.equal(changed.status,'STALE');assert.notEqual(changed.evidenceDigest,first.evidenceDigest);assert.equal(first.currentness,'COLLECTED_SNAPSHOT_ONLY');
});
test('known complete credentials cannot enter policy URLs, decoded JSON or output metadata',()=>{
 const tokens=['og_local_owner_'+'a'.repeat(64),'og_local_producer_'+'b'.repeat(64),'og_agent_12345678-1234-4123-8123-123456789012.'+'c'.repeat(64),'ghp_'+'A'.repeat(36),'github_pat_'+'B'.repeat(64)];
 for(const token of tokens){const {policy,evidence}=fixture();policy.target.repository.fullName='fixture-owner/'+token;assert.throws(()=>parseContributionPolicy(policy),error=>error.code==='CREDENTIAL_SHAPED_EVIDENCE'&&!error.message.includes(token));evidence.jobs.items[0].steps[0].name=token;assert.throws(()=>parseContributionEvidence(evidence),error=>error.code==='CREDENTIAL_SHAPED_EVIDENCE');assert.throws(()=>parseContributionJson(JSON.stringify({value:encodeURIComponent(encodeURIComponent(token))})));assert.throws(()=>parseContributionJson(JSON.stringify({value:token}).replace('og_','og\\u005f')));}
 const {policy}=fixture();policy.target.head.repository.fullName='fixture-agent/og_agent_researcher';assert.equal(parseContributionPolicy(policy).target.head.repository.fullName,'fixture-agent/og_agent_researcher');
});
