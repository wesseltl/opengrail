import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,chmodSync,symlinkSync,linkSync,mkdirSync,chownSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectContributionEvidence,collectPrivateContributionEvidence} from '../scripts/contribution-evidence.mjs';
import {makePrivateGithubReader,githubReadLimits,ContributionReadError} from '../scripts/contribution-github-read.mjs';
import {contributionRequiredSteps} from '../scripts/contribution-evidence-core.mjs';

// All repositories, histories, source bytes, API responses and PAT-looking
// strings below are invented. No fetch here contacts GitHub or another service.
const sentinel='github_pat_InventedPrivateCollectorSentinel_'+('A'.repeat(64));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'opengrail-private-reader-')),credential=join(directory,'credential');writeFileSync(credential,sentinel+'\n',{mode:0o600});
 const repository={id:101,full_name:'example/private-opengrail',private:true},fork={id:202,full_name:'contributor/private-opengrail',private:true};
 const baseSha='a'.repeat(40),headSha='b'.repeat(40),testedSha='c'.repeat(40),clock='2026-10-10T00:00:00Z';
 const gateContent={'.github/workflows/contribution.yml':'invented workflow','scripts/check-contribution.mjs':'invented checker','package.json':'invented manifest'};
 const policy={version:2,repositoryVisibility:'PRIVATE',privateReadApproved:true,credentialIsolationConfirmed:true,target:{repository:{id:101,fullName:repository.full_name},issueNumber:5,pullRequestNumber:7,base:{ref:'main',sha:baseSha},head:{repository:{id:202,fullName:fork.full_name},ref:'review',sha:headSha},testedSha,runId:303},trusted:{workflowId:404,workflowPath:'.github/workflows/contribution.yml',files:Object.entries(gateContent).map(([path,content])=>({path,digest:digest(content)}))}};
 const base={repo:repository,ref:'main',sha:baseSha},head={repo:fork,ref:'review',sha:headSha};
 const issue={id:505,number:5,state:'open',html_url:'https://github.com/example/private-opengrail/issues/5'};
 const pr={id:707,number:7,state:'open',draft:false,merged:false,base,head,merge_commit_sha:testedSha,html_url:'https://github.com/example/private-opengrail/pull/7'};
 const workflow={id:404,path:'.github/workflows/contribution.yml',state:'active'};
 const run={id:303,repository,workflow_id:404,path:'.github/workflows/contribution.yml@refs/pull/7/merge',run_attempt:1,event:'pull_request',status:'completed',conclusion:'success',head_sha:headSha,head_repository:fork,pull_requests:[{number:7,base,head}],created_at:clock,updated_at:clock,run_started_at:clock};
 const job={id:909,run_id:303,head_sha:headSha,name:'Contribution checks',status:'completed',conclusion:'success',started_at:clock,completed_at:clock,steps:contributionRequiredSteps(testedSha).map((name,index)=>({number:index+1,name,status:'completed',conclusion:'success',started_at:clock,completed_at:clock}))};
 const calls=[],counts={};let hook;
 async function fetch(url,options){
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.headers.Authorization,'Bearer '+sentinel);assert(options.signal instanceof AbortSignal);calls.push(url);
  const u=new URL(url);assert.equal(u.origin,'https://api.github.com');const path=u.pathname;counts[path]=(counts[path]??0)+1;let value;
  if(path==='/repos/example/private-opengrail')value=repository;
  else if(path.endsWith('/issues/5'))value=issue;
  else if(path.endsWith('/pulls/7'))value=pr;
  else if(path.endsWith('/actions/workflows/404'))value=workflow;
  else if(path.endsWith('/actions/runs/303'))value=run;
  else if(path.endsWith('/actions/runs/303/attempts/1/jobs'))value={total_count:1,jobs:[job]};
  else if(path.endsWith('/git/commits/'+testedSha))value={sha:testedSha,parents:[{sha:baseSha},{sha:headSha}]};
  else if(path.includes('/contents/')){const file=path.split('/contents/')[1],content=gateContent[file];assert(content);assert([headSha,testedSha].includes(u.searchParams.get('ref')));value={type:'file',path:file,encoding:'base64',size:Buffer.byteLength(content),content:Buffer.from(content).toString('base64')};}
  else assert.fail('Unexpected fixture API resource');
  value=structuredClone(value);if(hook){const replacement=hook({url:u,path,count:counts[path],value,options});if(replacement instanceof Response)return replacement;if(replacement!==undefined)value=replacement;}
  return Response.json(value);
 }
 return {directory,credential,policy,repository,pr,issue,run,job,workflow,gateContent,calls,fetch,now:()=>Date.parse('2026-10-11T00:00:00Z'),setHook(value){hook=value;},close(){rmSync(directory,{recursive:true,force:true});}};
}
const collect=f=>collectPrivateContributionEvidence(f.policy,f.credential,{fetch:f.fetch,now:f.now});
const reader=(f,options={})=>makePrivateGithubReader(f.policy,f.credential,{fetch:f.fetch,now:f.now,...options});

test('private collector binds exact invented current-attempt metadata, gates and narrow authority with no credential in receipts',async()=>{
 const f=fixture();try{const receipt=await collect(f);assert.equal(receipt.result.status,'CI_VERIFIED');assert.equal(receipt.kind,'PRIVATE_GITHUB_CI_EVIDENCE');assert.equal(receipt.collection,'PRIVATE_GITHUB_API_READ');assert.equal(receipt.evidence.version,1);assert.equal(receipt.readStatistics.requests,18);assert.equal(receipt.evidence.repositoryBefore.private,true);assert.equal(receipt.evidence.repositoryAfter.private,true);assert.equal(receipt.evidence.gateFiles.items.length,6);assert.equal(receipt.policyDigest,digest(JSON.stringify(f.policy)));assert(!JSON.stringify(receipt).includes(sentinel));for(const name of ['researchQualified','independentResearch','mergeApproved','securityApproved','deploymentApproved','permissionChangeApproved','ordersEnabled','liveEnabled'])assert.equal(receipt.result[name],false);}finally{f.close();}
});
test('strict approval, visibility and credential-isolation declarations precede every private read',async()=>{
 for(const field of ['privateReadApproved','credentialIsolationConfirmed','repositoryVisibility']){const f=fixture();try{f.policy[field]=false;await assert.rejects(collect(f),error=>!error.message.includes(sentinel));assert.equal(f.calls.length,0);}finally{f.close();}}
 const f=fixture();try{const publicPolicy={version:1,publicReadApproved:true,target:f.policy.target,trusted:f.policy.trusted};await assert.rejects(collectPrivateContributionEvidence(publicPolicy,f.credential,{fetch:f.fetch}),/PRIVATE_POLICY_REQUIRED/);await assert.rejects(collectContributionEvidence(f.policy,{fetch:f.fetch}),/PUBLIC_POLICY_REQUIRED/);assert.equal(f.calls.length,0);}finally{f.close();}
});
test('dot-segment repository names fail private URL preflight before credential loading or Authorization',async()=>{
 for(const fullName of ['example/.','example/..']){const f=fixture();try{f.policy.target.repository.fullName=fullName;rmSync(f.credential);await assert.rejects(collect(f),/PRIVATE_GITHUB_PATH_NOT_APPROVED/);assert.equal(f.calls.length,0);}finally{f.close();}}
});
test('only the approved repo and fixed collection resources may receive Authorization',async()=>{
 const f=fixture();try{const r=reader(f),base='/repos/example/private-opengrail';for(const path of ['/repos/example/other',base+'/pulls/8',base+'/issues/6',base+'/actions/workflows/405',base+'/actions/runs/304',base+'/actions/runs/303/attempts/1/jobs?per_page=8&page=1',base+'/contents/AGENTS.md?ref='+f.policy.target.head.sha,base+'/contents/package.json?ref='+'d'.repeat(40),base+'/git/commits/'+f.policy.target.head.sha,base+'?x=1',base+'/../secret',base+'%2fsecret','https://api.github.com'+base])await assert.rejects(r.get(path),/PRIVATE_GITHUB_PATH_NOT_APPROVED/);assert.equal(f.calls.length,0);await r.get(base+'/actions/runs/303');for(const path of [base+'/actions/runs/303/attempts/2/jobs?per_page=8&page=1',base+'/actions/runs/303/attempts/1/jobs?per_page=8&page=3',base+'/actions/runs/303/attempts/1/jobs?page=1&per_page=8'])await assert.rejects(r.get(path),/PRIVATE_GITHUB_PATH_NOT_APPROVED/);assert.equal(f.calls.length,1);await r.get(base+'/actions/runs/303/attempts/1/jobs?per_page=8&page=1');assert.equal(f.calls.length,2);}finally{f.close();}
});
test('private identity and visibility mismatches stop before deeper private resource collection',async()=>{
 for(const mutate of [value=>value.private=false,value=>value.id=999,value=>value.full_name='example/other']){const f=fixture();try{mutate(f.repository);const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(receipt.reason,'PRIVATE_REPOSITORY_IDENTITY_MISMATCH');assert.equal(f.calls.length,1);}finally{f.close();}}
});
test('changed private visibility in the final snapshot cannot satisfy the private policy',async()=>{
 const f=fixture();try{f.setHook(({path,count,value})=>{if(path==='/repos/example/private-opengrail'&&count===2)value.private=false;return value;});const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(receipt.result.reason,'REPOSITORY_CONTEXT_MISMATCH');}finally{f.close();}
});
test('private PR, issue and attempt changes preserve stale decisions instead of borrowing successful gates',async()=>{
 for(const kind of ['pr','issue','attempt']){const f=fixture();try{f.setHook(({path,count,value})=>{if(count===2){if(kind==='pr'&&path.endsWith('/pulls/7'))value.head.sha='d'.repeat(40);if(kind==='issue'&&path.endsWith('/issues/5'))value.state='closed';if(kind==='attempt'&&path.endsWith('/actions/runs/303'))value.run_attempt=2;}return value;});assert.equal((await collect(f)).result.status,'STALE');}finally{f.close();}}
});
test('private gate changes and unsuccessful/skipped mandatory job steps remain failed',async()=>{
 for(const kind of ['gate','step','job']){const f=fixture();try{if(kind==='gate')f.gateContent['package.json']='different bytes';if(kind==='step')f.job.steps[4].conclusion='skipped';if(kind==='job')f.job.conclusion='failure';assert.equal((await collect(f)).result.status,'FAILED');}finally{f.close();}}
});
test('wrong private job attempt, head or binding cannot be accepted as current checks',async()=>{
 for(const kind of ['attempt','head','event','refs']){const f=fixture();try{if(kind==='attempt')f.job.run_attempt=2;if(kind==='head')f.job.head_sha='d'.repeat(40);if(kind==='event')f.run.event='pull_request_target';if(kind==='refs')f.run.pull_requests[0].number=8;assert.notEqual((await collect(f)).result.status,'CI_VERIFIED');}finally{f.close();}}
});
test('private job pagination has a finite complete attempt boundary and retains truncation',async()=>{
 for(const kind of ['extra','short','changed']){const f=fixture();try{f.setHook(({path,url,value})=>{if(path.endsWith('/attempts/1/jobs')){const page=Number(url.searchParams.get('page'));value.total_count=kind==='changed'&&page===2?10:9;value.jobs=kind==='short'?[f.job]:Array.from({length:page===1?8:1},(_,i)=>({...structuredClone(f.job),id:1000+(page-1)*8+i}));}return value;});const receipt=await collect(f);assert.equal(receipt.result.status,kind==='extra'?'FAILED':'UNAVAILABLE');assert.equal(f.calls.filter(value=>value.includes('/jobs?')).length,kind==='short'?1:2);}finally{f.close();}}
});
test('private response redirects and changed final origin/path/query are refused without following them',async()=>{
 for(const kind of ['status','redirected','origin','path','query']){const f=fixture();try{f.setHook(({value})=>{const response=kind==='status'?new Response('untrusted detail '+sentinel,{status:302}):Response.json(value);if(kind==='redirected')Object.defineProperty(response,'redirected',{value:true});if(kind==='origin')Object.defineProperty(response,'url',{value:'https://elsewhere.invalid/repos/example/private-opengrail'});if(kind==='path')Object.defineProperty(response,'url',{value:'https://api.github.com/repos/example/other'});if(kind==='query')Object.defineProperty(response,'url',{value:'https://api.github.com/repos/example/private-opengrail?private=1'});return response;});const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(f.calls.length,1);assert(!JSON.stringify(receipt).includes(sentinel));}finally{f.close();}}
});
test('untrusted private response property failures cannot propagate credential-shaped errors',async()=>{
 const f=fixture();try{const r=reader(f,{fetch:async()=>{const response=Response.json({id:101});Object.defineProperty(response,'url',{get(){throw new ContributionReadError(sentinel);}});return response;}});await assert.rejects(r.get('/repos/example/private-opengrail'),error=>error.message==='GITHUB_RESPONSE_UNAVAILABLE'&&!error.message.includes(sentinel));}finally{f.close();}
});
test('a matching explicit private final response URL is accepted',async()=>{
 const f=fixture();try{f.setHook(({value,url})=>{const response=Response.json(value);Object.defineProperty(response,'url',{value:url.href});return response;});assert.equal((await collect(f)).result.status,'CI_VERIFIED');}finally{f.close();}
});
test('provider error/body reflection never enters a private receipt or propagated diagnostic',async()=>{
 for(const kind of ['throw','class','body','denied']){const f=fixture();try{f.setHook(()=>{if(kind==='throw')throw new Error(sentinel);if(kind==='class')throw new ContributionReadError(sentinel);if(kind==='denied')return new Response(sentinel,{status:403});return Response.json({full_name:sentinel,private:true,id:101});});const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(f.calls.length,1);assert(!JSON.stringify(receipt).includes(sentinel));assert(['GITHUB_RESPONSE_UNAVAILABLE','GITHUB_RATE_OR_ACCESS_LIMIT','INVALID_GITHUB_JSON'].includes(receipt.reason));}finally{f.close();}}
});
test('private bodies retain strict JSON, content type, UTF-8 and declared byte bounds',async()=>{
 const builders=[()=>new Response('html',{headers:{'Content-Type':'text/html'}}),()=>new Response(new Uint8Array([255]),{headers:{'Content-Type':'application/json'}}),()=>new Response('{"id":1,"id":2}',{headers:{'Content-Type':'application/json'}}),()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(githubReadLimits.responseBytes+1)}})];
 for(const build of builders){const f=fixture();try{f.setHook(build);const receipt=await collect(f);assert.equal(receipt.result.status,'UNAVAILABLE');assert.equal(f.calls.length,1);}finally{f.close();}}
});
test('private streamed and aggregate response capacity cancels safely and cannot reset between reads',async()=>{
 const f=fixture();try{let cancelled=false;const r=reader(f,{fetch:async()=>new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(githubReadLimits.responseBytes+1));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}})});await assert.rejects(r.get('/repos/example/private-opengrail'),/GITHUB_RESPONSE_BYTE_LIMIT/);assert(cancelled);
 const response=JSON.stringify({value:'x'.repeat(githubReadLimits.responseBytes-20)}),aggregate=reader(f,{fetch:async()=>new Response(response,{headers:{'Content-Type':'application/json'}})});for(let i=0;i<4;i++)await aggregate.get('/repos/example/private-opengrail');await assert.rejects(aggregate.get('/repos/example/private-opengrail'),/GITHUB_RESPONSE_BYTE_LIMIT/);assert.equal(aggregate.statistics().requests,5);
 }finally{f.close();}
});
test('private request count, elapsed time and regressing clock retain fixed budgets',async()=>{
 const f=fixture();try{const r=reader(f);for(let i=0;i<githubReadLimits.requests;i++)await r.get('/repos/example/private-opengrail');await assert.rejects(r.get('/repos/example/private-opengrail'),/READ_REQUEST_LIMIT/);assert.equal(f.calls.length,32);
 let at=100;const timed=reader(f,{now:()=>at});at+=githubReadLimits.totalMs+1;await assert.rejects(timed.get('/repos/example/private-opengrail'),/READ_TIME_LIMIT/);const regressed=reader(f,{now:()=>at});at--;await assert.rejects(regressed.get('/repos/example/private-opengrail'),/CLOCK_REGRESSION/);assert.equal(f.calls.length,32);
 }finally{f.close();}
});
test('private pending reads use the remaining total deadline instead of another full request timeout',async()=>{
 const f=fixture();let keepAlive;
 try{let at=100,signalSeen;const r=reader(f,{now:()=>at,fetch:async(_url,options)=>{signalSeen=options.signal;return new Promise(()=>{});}});at+=githubReadLimits.totalMs-10;keepAlive=setTimeout(()=>{},1000);await assert.rejects(r.get('/repos/example/private-opengrail'),/GITHUB_REQUEST_TIME_LIMIT/);assert(signalSeen.aborted);assert.equal(r.statistics().requests,1);}
 finally{clearTimeout(keepAlive);f.close();}
});
test('private interruption before fetch and during a pending fetch/body is bounded without retry',async()=>{
 for(const kind of ['before','fetch','body']){const f=fixture(),controller=new AbortController();try{let calls=0,cancelled=false;if(kind==='before')controller.abort();const fetch=async()=>{calls++;if(kind==='fetch'){queueMicrotask(()=>controller.abort());return new Promise(()=>{});}return new Response(new ReadableStream({start(){setImmediate(()=>controller.abort());},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}});};const receipt=await collectPrivateContributionEvidence(f.policy,f.credential,{fetch,signal:controller.signal,now:f.now});assert.equal(receipt.reason,'INTERRUPTED');assert.equal(calls,kind==='before'?0:1);if(kind==='body')assert(cancelled);}finally{f.close();}}
});
test('private credential is freshly read per collector call rather than accepted from argv/options/environment',async()=>{
 const f=fixture();try{await collect(f);writeFileSync(f.credential,'ghp_'+('X'.repeat(64)),{mode:0o600});await assert.rejects(collectPrivateContributionEvidence(f.policy,f.credential,{fetch:f.fetch,token:sentinel,headers:{Authorization:'Bearer '+sentinel}}),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,18);await assert.rejects(collectPrivateContributionEvidence(f.policy,sentinel,{fetch:f.fetch}),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,18);}finally{f.close();}
});
test('private credentials require bounded ASCII fine-grained PAT syntax and exact secure modes',async()=>{
 for(const token of ['',sentinel+'\n\n',sentinel+'\r\n','ghp_'+('X'.repeat(64)),'github_pat_short','github_pat_'+('A'.repeat(256)),'github_pat_'+('é'.repeat(30)),sentinel+' '+sentinel,'x'.repeat(513)]){const f=fixture();try{writeFileSync(f.credential,token);await assert.rejects(collect(f),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,0);}finally{f.close();}}
 for(const mode of [0o644,0o640,0o604,0o660,0o700,0o4600]){const f=fixture();try{chmodSync(f.credential,mode);await assert.rejects(collect(f),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,0);}finally{f.close();}}
 const f=fixture();try{chmodSync(f.credential,0o400);assert.equal((await collect(f)).result.status,'CI_VERIFIED');}finally{f.close();}
});
test('private credential final/parent symlinks, hardlinks, directories and FIFO cannot be read',async()=>{
 for(const kind of ['file-link','parent-link','hardlink','directory','fifo']){const f=fixture();try{let path=join(f.directory,'unsafe');if(kind==='file-link')symlinkSync(f.credential,path);if(kind==='parent-link'){symlinkSync(f.directory,path);path=join(path,'credential');}if(kind==='hardlink')linkSync(f.credential,path);if(kind==='directory')mkdirSync(path);if(kind==='fifo'){const result=spawnSync('mkfifo',[path],{timeout:1000,encoding:'utf8'});assert.equal(result.status,0,result.stderr);chmodSync(path,0o600);}await assert.rejects(collectPrivateContributionEvidence(f.policy,path,{fetch:f.fetch}),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,0);}finally{f.close();}}
});
test('private credentials stay outside mandatory tool/caller checkouts and additive protected directories',async()=>{
 const f=fixture();try{await assert.rejects(collectPrivateContributionEvidence(f.policy,f.credential,{fetch:f.fetch,protectedDirectories:[f.directory]}),/PRIVATE_CREDENTIAL_UNAVAILABLE/);await assert.rejects(collectPrivateContributionEvidence(f.policy,resolve('package.json'),{fetch:f.fetch,protectedDirectories:[]}),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,0);assert.equal(readFileSync(f.credential,'utf8'),sentinel+'\n');}finally{f.close();}
});
test('private credentials reject a different file owner when the runtime can construct that boundary',async()=>{
 const f=fixture();try{if(process.getuid()===0){chownSync(f.credential,1,process.getgid());await assert.rejects(collect(f),/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls.length,0);}else{assert.equal((await collect(f)).result.status,'CI_VERIFIED');}}finally{f.close();}
});
