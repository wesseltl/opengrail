import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,statSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectContributionEvidence,writeNewEvidence} from '../scripts/contribution-evidence.mjs';
import {contributionRequiredSteps} from '../scripts/contribution-evidence-core.mjs';

// Every remote response, repository, issue, PR, run and source hash here is invented.
// These exercise the actual collector and file boundary; they are not hosted GitHub acceptance.
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const repository={id:101,full_name:'example/opengrail',private:false},fork={id:202,full_name:'contributor/opengrail',private:false};
 const baseSha='a'.repeat(40),headSha='b'.repeat(40),testedSha='c'.repeat(40),clock='2026-10-10T00:00:00Z';
 const gateContent={'.github/workflows/contribution.yml':'invented workflow fixture','scripts/check-contribution.mjs':'invented checker fixture','package.json':'invented package fixture'};
 const policy={version:1,publicReadApproved:true,target:{repository:{id:101,fullName:repository.full_name},issueNumber:5,pullRequestNumber:7,base:{ref:'main',sha:baseSha},head:{repository:{id:202,fullName:fork.full_name},ref:'fix',sha:headSha},testedSha,runId:303},trusted:{workflowId:404,workflowPath:'.github/workflows/contribution.yml',files:Object.entries(gateContent).map(([path,content])=>({path,digest:digest(content)}))}};
 const base={repo:repository,ref:'main',sha:baseSha},head={repo:fork,ref:'fix',sha:headSha};
 const issue={id:505,number:5,state:'open',html_url:'https://github.com/example/opengrail/issues/5'};
 const pr={id:707,number:7,state:'open',draft:false,merged:false,base,head,merge_commit_sha:testedSha,html_url:'https://github.com/example/opengrail/pull/7'};
 const workflow={id:404,path:'.github/workflows/contribution.yml',state:'active'};
 const run={id:303,repository,workflow_id:404,path:'.github/workflows/contribution.yml@refs/pull/7/merge',run_attempt:1,event:'pull_request',status:'completed',conclusion:'success',head_sha:headSha,head_repository:fork,pull_requests:[{number:7,base,head}],created_at:clock,updated_at:clock,run_started_at:clock};
 const job={id:909,run_id:303,head_sha:headSha,name:'Contribution checks',status:'completed',conclusion:'success',started_at:clock,completed_at:clock,steps:contributionRequiredSteps(testedSha).map((name,index)=>({number:index+1,name,status:'completed',conclusion:'success',started_at:clock,completed_at:clock}))};
 const calls=[],counts={};let hook;
 async function fetch(url,options){
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert(!('Authorization'in options.headers));calls.push(url);
  const u=new URL(url);assert.equal(u.origin,'https://api.github.com');const path=u.pathname;counts[path]=(counts[path]??0)+1;
  let value;
  if(path==='/repos/example/opengrail')value=repository;
  else if(path.endsWith('/issues/5'))value=issue;
  else if(path.endsWith('/pulls/7'))value=pr;
  else if(path.endsWith('/actions/workflows/404'))value=workflow;
  else if(path.endsWith('/actions/runs/303'))value=run;
  else if(path.endsWith('/actions/runs/303/attempts/1/jobs'))value={total_count:1,jobs:[job]};
  else if(path.endsWith('/git/commits/'+testedSha))value={sha:testedSha,parents:[{sha:baseSha},{sha:headSha}]};
  else if(path.includes('/contents/')){const file=path.split('/contents/')[1],content=gateContent[file];assert(content);assert([headSha,testedSha].includes(u.searchParams.get('ref')));value={type:'file',path:file,encoding:'base64',size:Buffer.byteLength(content),content:Buffer.from(content).toString('base64')+'\n'};}
  else assert.fail('Unplanned API read '+url);
  value=structuredClone(value);if(hook){const replacement=hook({url:u,path,count:counts[path],value});if(replacement instanceof Response)return replacement;if(replacement!==undefined)value=replacement;}
  return Response.json(value);
 }
 return {policy,repository,pr,issue,run,workflow,job,gateContent,calls,counts,fetch,now:()=>Date.parse('2026-10-11T00:00:00Z'),setHook(value){hook=value;}};
}
const collect=f=>collectContributionEvidence(f.policy,{fetch:f.fetch,now:f.now});

test('actual collector correlates current invented metadata, exact merge, gates and API-attempt job context',async()=>{
 const f=fixture(),receipt=await collect(f);assert.equal(receipt.result.status,'CI_VERIFIED');assert.equal(receipt.collection,'PUBLIC_GITHUB_API_READ');assert.equal(receipt.cryptographicAttestation,false);assert.equal(receipt.readStatistics.requests,18);assert.equal(f.calls.length,18);assert.equal(receipt.evidence.jobs.items[0].runAttempt,1);assert.equal(receipt.evidence.gateFiles.items.length,6);
 for(const field of ['researchQualified','independentResearch','mergeApproved','securityApproved','deploymentApproved','permissionChangeApproved','ordersEnabled','liveEnabled'])assert.equal(receipt.result[field],false);
});
test('raw run relation repositories with canonical API URLs need no invented full_name fallback',async()=>{
 const f=fixture();f.setHook(({path,value})=>{if(path.endsWith('/actions/runs/303'))for(const p of value.pull_requests)for(const branch of [p.base,p.head]){branch.repo.url='https://api.github.com/repos/'+branch.repo.full_name;delete branch.repo.full_name;}return value;});assert.equal((await collect(f)).result.status,'CI_VERIFIED');
});
test('a changed PR head after collection invalidates otherwise successful checks',async()=>{
 const f=fixture();f.setHook(({path,count,value})=>{if(path.endsWith('/pulls/7')&&count===2)value.head.sha='d'.repeat(40);return value;});assert.equal((await collect(f)).result.status,'STALE');
});
test('a rerun while collecting evidence cannot borrow jobs from a prior attempt',async()=>{
 const f=fixture();f.setHook(({path,count,value})=>{if(path.endsWith('/actions/runs/303')&&count===2)value.run_attempt=2;return value;});assert.equal((await collect(f)).result.status,'STALE');
});
test('an explicitly conflicting job attempt is unavailable even at the exact attempt endpoint',async()=>{
 const f=fixture();f.job.run_attempt=2;const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(receipt.reason,'JOB_ATTEMPT_MISMATCH');
});
test('required skipped step and changed gate source cannot become CI verified',async()=>{
 const f=fixture();f.job.steps[3].conclusion='skipped';assert.equal((await collect(f)).result.status,'FAILED');
 const changed=fixture();changed.gateContent['package.json']='changed gate';assert.equal((await collect(changed)).result.status,'FAILED');
});
test('the GitHub read rate/access rejection is retained without any retry or invented success',async()=>{
 const f=fixture();f.setHook(()=>new Response('{}',{status:403,headers:{'Content-Type':'application/json'}}));const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(receipt.reason,'GITHUB_RATE_OR_ACCESS_LIMIT');assert.equal(f.calls.length,1);
});
test('private or renamed repository mismatches stop before issue, PR or source reads',async()=>{
 for(const mutate of [r=>r.private=true,r=>r.full_name='example/other']){const f=fixture();mutate(f.repository);const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(f.calls.length,1);}
});
test('pending actual provider status is kept pending rather than inferred from successful step names',async()=>{
 const f=fixture();f.run.status='in_progress';f.run.conclusion=null;assert.equal((await collect(f)).result.status,'PENDING');
});
test('complete bounded job pagination is retained but extra jobs do not satisfy the fixed gate',async()=>{
 const f=fixture();f.setHook(({path,url,value})=>{if(path.endsWith('/attempts/1/jobs')){const page=Number(url.searchParams.get('page'));value.total_count=9;value.jobs=Array.from({length:page===1?8:1},(_,i)=>({...structuredClone(f.job),id:1000+(page-1)*8+i}));}return value;});const receipt=await collect(f);assert.equal(receipt.evidence.jobs.complete,true);assert.equal(receipt.evidence.jobs.items.length,9);assert.equal(receipt.result.status,'FAILED');assert.equal(f.calls.filter(url=>url.includes('/jobs?')).length,2);
});
test('short/truncated pages and changing page totals never become complete evidence',async()=>{
 for(const kind of ['short','changed']){const f=fixture();f.setHook(({path,url,value})=>{if(path.endsWith('/attempts/1/jobs')){const page=Number(url.searchParams.get('page'));value.total_count=kind==='changed'&&page===2?10:9;value.jobs=kind==='short'?[f.job]:Array.from({length:page===1?8:1},(_,i)=>({...structuredClone(f.job),id:1000+(page-1)*8+i}));}return value;});assert.equal((await collect(f)).result.status,'UNAVAILABLE');}
});
test('content body size/encoding mismatch cannot authenticate trusted source bytes',async()=>{
 const f=fixture();f.setHook(({path,value})=>{if(path.includes('/contents/'))value.size++;return value;});assert.equal((await collect(f)).result.status,'UNAVAILABLE');
});
test('invalid public policy or interruption never causes an unauthorized GET',async()=>{
 const f=fixture();f.policy.publicReadApproved=false;await assert.rejects(collect(f));assert.equal(f.calls.length,0);
 const valid=fixture(),controller=new AbortController();controller.abort();assert.equal((await collectContributionEvidence(valid.policy,{fetch:valid.fetch,now:valid.now,signal:controller.signal})).result.status,'UNAVAILABLE');assert.equal(valid.calls.length,0);
});
test('known full credential-shaped repository names are rejected before any GET or raw diagnostic',async()=>{
 const f=fixture();f.policy.target.repository.fullName='example/og_local_producer_'+'0'.repeat(64);await assert.rejects(collect(f),error=>!error.message.includes('0'.repeat(64)));assert.equal(f.calls.length,0);
});
test('atomic evidence write is a new 0600 file and never overwrites existing data or symlink targets',()=>{
 const directory=mkdtempSync(join(tmpdir(),'opengrail-ci-write-'));
 try{const path=join(directory,'receipt.json');writeNewEvidence(path,{version:1});assert.equal(statSync(path).mode&0o777,0o600);const first=readFileSync(path,'utf8');assert.throws(()=>writeNewEvidence(path,{version:2}));assert.equal(readFileSync(path,'utf8'),first);const link=join(directory,'link');symlinkSync(path,link);assert.throws(()=>writeNewEvidence(link,{version:3}));assert.equal(readFileSync(path,'utf8'),first);}finally{rmSync(directory,{recursive:true,force:true});}
});
test('offline CLI returns success only for the recomputed narrow assessment of a valid saved fixture',async()=>{
 const f=fixture(),receipt=await collect(f),directory=mkdtempSync(join(tmpdir(),'opengrail-ci-offline-pass-'));
 try{const policy=join(directory,'policy.json'),evidence=join(directory,'evidence.json');writeFileSync(policy,JSON.stringify(f.policy));writeFileSync(evidence,JSON.stringify(receipt));const result=spawnSync(process.execPath,['scripts/contribution-evidence.mjs','verify',policy,evidence],{cwd:process.cwd(),encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);assert.equal(parsed.collection,'OFFLINE_UNAUTHENTICATED_SNAPSHOT');assert.equal(parsed.result.status,'CI_VERIFIED');assert.equal(parsed.cryptographicAttestation,false);assert.equal(parsed.result.mergeApproved,false);}finally{rmSync(directory,{recursive:true,force:true});}
});
test('offline command ignores forged receipt success and clearly labels saved snapshots unauthenticated',async()=>{
 const f=fixture(),receipt=await collect(f),directory=mkdtempSync(join(tmpdir(),'opengrail-ci-offline-'));
 try{const policy=join(directory,'policy.json'),evidence=join(directory,'evidence.json');writeFileSync(policy,JSON.stringify(f.policy));receipt.result={status:'CI_VERIFIED',mergeApproved:true};receipt.evidence.pullRequestAfter.head.sha='d'.repeat(40);writeFileSync(evidence,JSON.stringify(receipt));const result=spawnSync(process.execPath,['scripts/contribution-evidence.mjs','verify',policy,evidence],{cwd:process.cwd(),encoding:'utf8',timeout:10000});assert.equal(result.status,1);const parsed=JSON.parse(result.stdout);assert.equal(parsed.collection,'OFFLINE_UNAUTHENTICATED_SNAPSHOT');assert.equal(parsed.freshness,'NOT_RECHECKED');assert.equal(parsed.result.status,'STALE');assert.equal(parsed.result.mergeApproved,false);}finally{rmSync(directory,{recursive:true,force:true});}
});
