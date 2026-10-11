import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,statSync,existsSync,chmodSync,symlinkSync,linkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {contributionRequiredSteps} from '../scripts/contribution-evidence-core.mjs';
import {preparePrivateEvidenceOutput} from '../scripts/contribution-private-credential.mjs';

// The actual CLI/files run in child processes. A Node test preload installs
// invented fetch responses; production code has no test switch or alternate
// endpoint. These fixtures never contact a real repository or use a real PAT.
const sentinel='github_pat_InventedPrivateCLISentinel_'+('S'.repeat(64));
const hash=value=>createHash('sha256').update(value).digest('hex');
function fixture(mode='pass'){
 const directory=mkdtempSync(join(tmpdir(),'opengrail-private-cli-')),credential=join(directory,'credential'),policyFile=join(directory,'policy.json'),evidence=join(directory,'evidence.json'),preload=join(directory,'invented-fetch.mjs'),trace=join(directory,'trace.jsonl'),fixtureFile=join(directory,'invented-provider.json');
 writeFileSync(credential,sentinel+'\n',{mode:0o600});
 const repository={id:101,full_name:'synthetic-private-owner/private-opengrail',private:true},fork={id:202,full_name:'synthetic-invited-contributor/private-opengrail',private:true};
 const baseSha='a'.repeat(40),headSha='b'.repeat(40),testedSha='c'.repeat(40),clock='2026-10-10T00:00:00Z';
 const gateContent={'.github/workflows/contribution.yml':'Invented private workflow source','scripts/check-contribution.mjs':'Invented private checker source','package.json':'Invented private manifest source'};
 const policy={version:2,repositoryVisibility:'PRIVATE',privateReadApproved:true,credentialIsolationConfirmed:true,target:{repository:{id:101,fullName:repository.full_name},issueNumber:5,pullRequestNumber:7,base:{ref:'main-private-base',sha:baseSha},head:{repository:{id:202,fullName:fork.full_name},ref:'private-proposal-branch',sha:headSha},testedSha,runId:303},trusted:{workflowId:404,workflowPath:'.github/workflows/contribution.yml',files:Object.entries(gateContent).map(([path,content])=>({path,digest:hash(content)}))}};
 const base={repo:repository,ref:policy.target.base.ref,sha:baseSha},head={repo:fork,ref:policy.target.head.ref,sha:headSha};
 const issue={id:505,number:5,state:'open',html_url:'https://github.com/'+repository.full_name+'/issues/5'};
 const pr={id:707,number:7,state:'open',draft:false,merged:false,base,head,merge_commit_sha:testedSha,html_url:'https://github.com/'+repository.full_name+'/pull/7'};
 const workflow={id:404,path:'.github/workflows/contribution.yml',state:'active'};
 const run={id:303,repository,workflow_id:404,path:'.github/workflows/contribution.yml@refs/pull/7/merge',run_attempt:1,event:'pull_request',status:'completed',conclusion:'success',head_sha:headSha,head_repository:fork,pull_requests:[{number:7,base,head}],created_at:clock,updated_at:clock,run_started_at:clock};
 const job={id:909,run_id:303,head_sha:headSha,name:'Contribution checks',status:'completed',conclusion:'success',started_at:clock,completed_at:clock,steps:contributionRequiredSteps(testedSha).map((name,index)=>({number:index+1,name,status:'completed',conclusion:'success',started_at:clock,completed_at:clock}))};
 writeFileSync(policyFile,JSON.stringify(policy));writeFileSync(fixtureFile,JSON.stringify({mode,repository,fork,baseSha,headSha,testedSha,gateContent,issue,pr,workflow,run,job,credential,evidence,trace}));
 const source=`import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const f=JSON.parse(fs.readFileSync(new URL('./invented-provider.json',import.meta.url),'utf8'));
const sentinel=${JSON.stringify(sentinel)};
let clock=Date.parse('2026-10-11T00:00:00Z');Date.now=()=>clock;
const counts={};
if(f.mode==='late-fsync'||f.mode==='foreign-replacement'){
 const original=fs.fsyncSync;let count=0;
 fs.fsyncSync=function(fd){count++;if(count===2){if(f.mode==='foreign-replacement'){fs.unlinkSync(f.evidence);fs.writeFileSync(f.evidence,'foreign replacement fixture',{mode:0o600});}throw new Error(sentinel);}return original.call(fs,fd);};syncBuiltinESMExports();
}
if(f.mode==='growing-file'||f.mode==='replaced-file'){
 const original=fs.readSync;let changed=false;
 fs.readSync=function(fd,...args){const n=original.call(fs,fd,...args);if(!changed&&fs.readlinkSync('/proc/self/fd/'+fd)===f.credential){changed=true;if(f.mode==='growing-file')fs.appendFileSync(f.credential,'A');else{fs.renameSync(f.credential,f.credential+'.prior');fs.writeFileSync(f.credential,sentinel,{mode:0o600});}}return n;};syncBuiltinESMExports();
}
globalThis.fetch=async(url,options)=>{
 const u=new URL(url),path=u.pathname;counts[path]=(counts[path]??0)+1;
 const authorizationMatches=options.headers.Authorization==='Bearer '+sentinel;
 fs.appendFileSync(f.trace,JSON.stringify({url,method:options.method,redirect:options.redirect,authorizationMatches,credentialInArgv:process.argv.some(value=>value.includes(sentinel)),credentialInEnvironment:Object.values(process.env).some(value=>value.includes(sentinel))})+'\\n');
 if(!authorizationMatches||options.method!=='GET'||options.redirect!=='error'||u.origin!=='https://api.github.com')throw new Error('Unexpected invented transport');
 if(f.mode==='throw-sentinel')throw new Error(sentinel);
 if(f.mode==='denied')return new Response(sentinel,{status:403});
 if(f.mode==='redirect')return new Response(sentinel,{status:302});
 if(f.mode==='body-sentinel')return Response.json({private:true,id:101,full_name:sentinel});
 if(f.mode==='interrupt'){process.kill(process.pid,'SIGINT');await new Promise(resolve=>setImmediate(resolve));throw new Error(sentinel);}
 if(f.mode==='time-limit')clock+=120001;
 let value;
 if(path==='/repos/'+f.repository.full_name)value=f.repository;
 else if(path.endsWith('/issues/5'))value=f.issue;
 else if(path.endsWith('/pulls/7'))value=f.pr;
 else if(path.endsWith('/actions/workflows/404'))value=f.workflow;
 else if(path.endsWith('/actions/runs/303'))value=f.run;
 else if(path.endsWith('/actions/runs/303/attempts/1/jobs'))value={total_count:1,jobs:[f.job]};
 else if(path.endsWith('/git/commits/'+f.testedSha))value={sha:f.testedSha,parents:[{sha:f.baseSha},{sha:f.headSha}]};
 else if(path.includes('/contents/')){const file=path.split('/contents/')[1],content=f.gateContent[file];if(!content||![f.headSha,f.testedSha].includes(u.searchParams.get('ref')))throw new Error('Unexpected invented source read');value={type:'file',path:file,encoding:'base64',size:Buffer.byteLength(content),content:Buffer.from(content).toString('base64')};}
 else throw new Error('Unexpected invented API path');
 value=structuredClone(value);
 if(f.mode==='wrong-visibility'&&path==='/repos/'+f.repository.full_name)value.private=false;
 if(f.mode==='stale-head'&&path.endsWith('/pulls/7')&&counts[path]===2)value.head.sha='d'.repeat(40);
 if(f.mode==='failed-step'&&path.endsWith('/attempts/1/jobs'))value.jobs[0].steps[4].conclusion='failure';
 if(f.mode==='changed-gate'&&path.endsWith('/contents/package.json')){value.content=Buffer.from('changed').toString('base64');value.size=7;}
 if(f.mode==='forged-final'){const response=Response.json(value);Object.defineProperty(response,'url',{value:'https://elsewhere.invalid/private'});return response;}
 return Response.json(value);
};
`;
 writeFileSync(preload,source);
 return {directory,credential,policy,policyFile,evidence,preload,trace,fixtureFile,close(){rmSync(directory,{recursive:true,force:true});},calls(){return existsSync(trace)?readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];}};
}
function cli(f,args=['collect-private',f.policyFile,f.evidence,f.credential],{preload=true,env={}}={}){
 return spawnSync(process.execPath,[...(preload?['--import',f.preload]:[]),'scripts/contribution-evidence.mjs',...args],{cwd:resolve('.'),env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',...env},encoding:'utf8',timeout:10000,maxBuffer:1048576});
}
function assertSummary(f,result){
 assert(!result.stdout.includes(sentinel));assert(!result.stderr.includes(sentinel));
 for(const value of [f.policy.target.repository.fullName,f.policy.target.head.repository.fullName,f.policy.target.head.ref,f.policy.target.base.ref,f.policy.target.head.sha,f.policy.target.testedSha,'Invented private workflow source'])assert(!result.stdout.includes(value));
 const parsed=JSON.parse(result.stdout);assert(!('target'in parsed.result));assert(!('run'in parsed.result));for(const field of ['researchQualified','independentResearch','mergeApproved','securityApproved','deploymentApproved','permissionChangeApproved','ordersEnabled','liveEnabled'])assert.equal(parsed.result[field],false);return parsed;
}

test('actual private CLI publishes a new 0600 receipt and prints only bounded hashes/status/counts/narrow flags',()=>{
 const f=fixture();try{const result=cli(f);assert.equal(result.status,0,result.stderr);const summary=assertSummary(f,result);assert.equal(summary.collection,'PRIVATE_GITHUB_API_READ');assert.equal(summary.result.status,'CI_VERIFIED');assert.equal(summary.readStatistics.requests,18);const receipt=JSON.parse(readFileSync(f.evidence,'utf8'));assert.equal(statSync(f.evidence).mode&0o777,0o600);assert.equal(receipt.kind,'PRIVATE_GITHUB_CI_EVIDENCE');assert.equal(receipt.evidence.repositoryBefore.private,true);assert(!JSON.stringify(receipt).includes(sentinel));assert.equal(readFileSync(f.credential,'utf8'),sentinel+'\n');const calls=f.calls();assert.equal(calls.length,18);assert(calls.every(value=>value.authorizationMatches&&value.method==='GET'&&value.redirect==='error'&&!value.credentialInArgv&&!value.credentialInEnvironment));assert(!readFileSync(f.trace,'utf8').includes(sentinel));}finally{f.close();}
});
test('actual offline private verification recomputes results with no credential or network and redacts private refs',()=>{
 const f=fixture();try{assert.equal(cli(f).status,0);rmSync(f.credential);const result=cli(f,['verify',f.policyFile,f.evidence],{preload:false});assert.equal(result.status,0,result.stderr);const summary=assertSummary(f,result);assert.equal(summary.collection,'OFFLINE_UNAUTHENTICATED_SNAPSHOT');assert.equal(summary.freshness,'NOT_RECHECKED');assert.equal(summary.cryptographicAttestation,false);assert.equal(summary.result.status,'CI_VERIFIED');assert.equal(f.calls().length,18);}finally{f.close();}
});
test('offline private verification ignores a forged success and preserves the stale recomputed snapshot',()=>{
 const f=fixture();try{assert.equal(cli(f).status,0);const receipt=JSON.parse(readFileSync(f.evidence,'utf8'));receipt.result={status:'CI_VERIFIED',mergeApproved:true,ordersEnabled:true};receipt.evidence.pullRequestAfter.head.sha='d'.repeat(40);writeFileSync(f.evidence,JSON.stringify(receipt));const result=cli(f,['verify',f.policyFile,f.evidence],{preload:false});assert.equal(result.status,1);const summary=assertSummary(f,result);assert.equal(summary.result.status,'STALE');assert.equal(summary.freshness,'NOT_RECHECKED');}finally{f.close();}
});
test('offline private verification rejects wrong public kind, policy digest or collection label without disclosure',()=>{
 for(const field of ['kind','policyDigest','collection']){const f=fixture();try{assert.equal(cli(f).status,0);const receipt=JSON.parse(readFileSync(f.evidence,'utf8'));receipt[field]=field==='kind'?'PUBLIC_GITHUB_CI_EVIDENCE':field==='collection'?'PUBLIC_GITHUB_API_READ':'d'.repeat(64);writeFileSync(f.evidence,JSON.stringify(receipt));const result=cli(f,['verify',f.policyFile,f.evidence],{preload:false});assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/POLICY_EVIDENCE_MISMATCH/);assert(!result.stderr.includes(sentinel));assert.equal(f.calls().length,18);}finally{f.close();}}
});
test('actual private CLI keeps stale, failed and visibility-mismatched provider states and redacted summaries',()=>{
 for(const [mode,status] of [['stale-head','STALE'],['failed-step','FAILED'],['changed-gate','FAILED'],['wrong-visibility','UNAVAILABLE']]){const f=fixture(mode);try{const result=cli(f);assert.equal(result.status,1,result.stderr);assert.equal(assertSummary(f,result).result.status,status);assert(existsSync(f.evidence));assert(!readFileSync(f.evidence,'utf8').includes(sentinel));}finally{f.close();}}
});
test('actual private CLI sanitizes denied, redirected, thrown and reflected credentials with no retry',()=>{
 for(const mode of ['throw-sentinel','denied','redirect','body-sentinel','forged-final']){const f=fixture(mode);try{const result=cli(f);assert.equal(result.status,1,result.stderr);const summary=assertSummary(f,result);assert.equal(summary.result.status,'UNAVAILABLE');assert.equal(f.calls().length,1);assert(!readFileSync(f.evidence,'utf8').includes(sentinel));}finally{f.close();}}
});
test('actual private CLI retains bounded interruption and elapsed-time rejection',()=>{
 for(const [mode,reason] of [['interrupt','INTERRUPTED'],['time-limit','READ_TIME_LIMIT']]){const f=fixture(mode);try{const result=cli(f);assert.equal(result.status,1,result.stderr);const summary=assertSummary(f,result);assert.equal(summary.reason,reason);assert.equal(summary.result.status,'UNAVAILABLE');assert.equal(f.calls().length,1);}finally{f.close();}}
});
test('actual CLI requires explicit collect-private and never falls back to public/credential-free reads',()=>{
 const f=fixture();try{const result=cli(f,['collect',f.policyFile,f.evidence]);assert.equal(result.status,1);assert.match(result.stderr,/PUBLIC_POLICY_REQUIRED/);assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));const publicPolicy={version:1,publicReadApproved:true,target:f.policy.target,trusted:f.policy.trusted};writeFileSync(f.policyFile,JSON.stringify(publicPolicy));const wrong=cli(f);assert.equal(wrong.status,1);assert.match(wrong.stderr,/PRIVATE_POLICY_REQUIRED/);assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));}finally{f.close();}
});
test('actual private CLI rejects dot-segment target repositories before loading missing credentials or authenticating',()=>{
 for(const fullName of ['synthetic-private-owner/.','synthetic-private-owner/..']){const f=fixture();try{f.policy.target.repository.fullName=fullName;writeFileSync(f.policyFile,JSON.stringify(f.policy));rmSync(f.credential);const result=cli(f);assert.equal(result.status,1);assert.match(result.stderr,/PRIVATE_GITHUB_PATH_NOT_APPROVED/);assert.equal(result.stdout,'');assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));}finally{f.close();}}
});
test('actual private CLI rejects missing approvals and credential-shaped policy input before network or output',()=>{
 for(const kind of ['approval','isolation','policy-secret']){const f=fixture();try{if(kind==='approval')f.policy.privateReadApproved=false;if(kind==='isolation')f.policy.credentialIsolationConfirmed=false;if(kind==='policy-secret')f.policy.credential=sentinel;writeFileSync(f.policyFile,JSON.stringify(f.policy));const result=cli(f);assert.equal(result.status,1);assert.equal(result.stdout,'');assert(!result.stderr.includes(sentinel));assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));}finally{f.close();}}
});
test('actual private CLI does not accept raw token argv or environment tokens instead of a guarded file',()=>{
 for(const kind of ['argv','environment']){const f=fixture();try{rmSync(f.credential);const args=['collect-private',f.policyFile,f.evidence,kind==='argv'?sentinel:f.credential],result=cli(f,args,{env:kind==='environment'?{GITHUB_TOKEN:sentinel,GH_TOKEN:sentinel}:{}});assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert(!result.stderr.includes(sentinel));assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));}finally{f.close();}}
});
test('actual private CLI rejects unsafe credential modes, links and nonregular files without an authenticated read',()=>{
 for(const kind of ['mode','symlink','parent-link','hardlink','directory']){const f=fixture();try{let credential=f.credential;if(kind==='mode')chmodSync(credential,0o644);if(kind==='symlink'){credential=join(f.directory,'credential-link');symlinkSync(f.credential,credential);}if(kind==='parent-link'){const parent=join(f.directory,'linked');symlinkSync(f.directory,parent);credential=join(parent,'credential');}if(kind==='hardlink'){credential=join(f.directory,'credential-hardlink');linkSync(f.credential,credential);}if(kind==='directory'){credential=join(f.directory,'credential-dir');mkdirSync(credential);}const result=cli(f,['collect-private',f.policyFile,f.evidence,credential]);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));}finally{f.close();}}
});
test('actual descriptor reads reject a growing credential or replaced pathname without leaking its bytes',()=>{
 for(const mode of ['growing-file','replaced-file']){const f=fixture(mode);try{const result=cli(f);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/PRIVATE_CREDENTIAL_UNAVAILABLE/);assert(!result.stderr.includes(sentinel));assert.equal(f.calls().length,0);assert(!existsSync(f.evidence));}finally{f.close();}}
});
test('private output is validated before authenticated reads and never overwrites a file or follows symlink parents',()=>{
 for(const kind of ['existing','final-link','parent-link','directory','checkout']){const f=fixture();let checkoutFile;try{let output=f.evidence;if(kind==='existing')writeFileSync(output,'existing private bytes',{mode:0o600});if(kind==='final-link'){const existing=join(f.directory,'existing');writeFileSync(existing,'existing private bytes');symlinkSync(existing,output);}if(kind==='parent-link'){const parent=join(f.directory,'linked');symlinkSync(f.directory,parent);output=join(parent,'evidence.json');}if(kind==='directory')mkdirSync(output);if(kind==='checkout'){checkoutFile=resolve('.opengrail-private-evidence-'+process.pid+'-'+Date.now());output=checkoutFile;}const result=cli(f,['collect-private',f.policyFile,output,f.credential]);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/PRIVATE_EVIDENCE_OUTPUT_UNAVAILABLE/);assert.equal(f.calls().length,0);if(kind==='existing')assert.equal(readFileSync(output,'utf8'),'existing private bytes');if(kind==='final-link')assert.equal(readFileSync(output,'utf8'),'existing private bytes');if(kind==='checkout')assert(!existsSync(output));}finally{if(checkoutFile)rmSync(checkoutFile,{force:true});f.close();}}
});
test('private output rejects a target introduced after preparation and a second write never deletes the first',()=>{
 const f=fixture();try{const output=preparePrivateEvidenceOutput(f.evidence);try{writeFileSync(f.evidence,'introduced data',{mode:0o600});assert.throws(()=>output.write({version:1}),/PRIVATE_EVIDENCE_OUTPUT_UNAVAILABLE/);assert.equal(readFileSync(f.evidence,'utf8'),'introduced data');}finally{output.close();}rmSync(f.evidence);const fresh=preparePrivateEvidenceOutput(f.evidence);try{fresh.write({version:1});assert.throws(()=>fresh.write({version:2}),/PRIVATE_EVIDENCE_OUTPUT_UNAVAILABLE/);assert.equal(JSON.parse(readFileSync(f.evidence,'utf8')).version,1);assert.equal(statSync(f.evidence).mode&0o777,0o600);}finally{fresh.close();}}finally{f.close();}
});
test('private output refuses added protected directories and preserves mandatory source exclusion',()=>{
 const f=fixture();try{assert.throws(()=>preparePrivateEvidenceOutput(f.evidence,[f.directory]),/PRIVATE_EVIDENCE_OUTPUT_UNAVAILABLE/);assert.throws(()=>preparePrivateEvidenceOutput(resolve('private-evidence.json'),[]),/PRIVATE_EVIDENCE_OUTPUT_UNAVAILABLE/);assert(!existsSync(f.evidence));}finally{f.close();}
});
test('actual late output failure preserves the published receipt and cannot delete a foreign replacement',()=>{
 for(const mode of ['late-fsync','foreign-replacement']){const f=fixture(mode);try{const result=cli(f);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/PRIVATE_EVIDENCE_OUTPUT_UNCERTAIN/);assert(!result.stderr.includes(sentinel));assert.equal(f.calls().length,18);assert(existsSync(f.evidence));assert.equal(statSync(f.evidence).mode&0o777,0o600);if(mode==='late-fsync'){const receipt=JSON.parse(readFileSync(f.evidence,'utf8'));assert.equal(receipt.kind,'PRIVATE_GITHUB_CI_EVIDENCE');assert.equal(receipt.result.status,'CI_VERIFIED');assert(!JSON.stringify(receipt).includes(sentinel));}else assert.equal(readFileSync(f.evidence,'utf8'),'foreign replacement fixture');}finally{f.close();}}
});
