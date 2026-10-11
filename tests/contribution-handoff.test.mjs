import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,statSync,existsSync,chmodSync,symlinkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import ts from 'typescript';
import {contributionGatePaths,contributionRequiredSteps,validateContributionEvidence} from '../scripts/contribution-evidence-core.mjs';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(m,m.exports,id=>id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id));return m.exports;}
const M=load('app/contribution-model.ts'),sha=value=>createHash('sha256').update(value).digest('hex'),uid=()=>randomUUID();

// Invented metadata, timestamps and actors only. No GitHub, token or provider request.
function privateCi(){
 const repository={id:101,fullName:'invented-private-owner/private-opengrail'},fork={id:202,fullName:'invented-private-agent/private-fork'},baseSha='a'.repeat(40),headSha='b'.repeat(40),testedSha='c'.repeat(40);
 const policy={version:2,repositoryVisibility:'PRIVATE',privateReadApproved:true,credentialIsolationConfirmed:true,target:{repository,issueNumber:7,pullRequestNumber:9,base:{ref:'main',sha:baseSha},head:{repository:fork,ref:'private-fix',sha:headSha},testedSha,runId:301},trusted:{workflowId:401,workflowPath:contributionGatePaths[0],files:contributionGatePaths.map(path=>({path,digest:sha('Invented gate '+path)}))}};
 const pr={id:501,number:9,repositoryId:101,state:'open',draft:false,merged:false,base:{repository,ref:'main',sha:baseSha},head:policy.target.head,mergeSha:testedSha};
 const run={id:301,repositoryId:101,workflowId:401,path:contributionGatePaths[0],attempt:2,event:'pull_request',status:'completed',conclusion:'success',headSha,headRepository:fork,pullRequests:[{number:9,base:pr.base,head:pr.head}],createdAt:'2026-10-11T01:00:00Z',updatedAt:'2026-10-11T01:02:00Z',startedAt:'2026-10-11T01:00:01Z'};
 const job={id:601,runId:301,runAttempt:2,headSha,name:'Contribution checks',status:'completed',conclusion:'success',startedAt:'2026-10-11T01:00:02Z',completedAt:'2026-10-11T01:01:59Z',steps:contributionRequiredSteps(testedSha).map((name,n)=>({number:n+1,name,status:'completed',conclusion:'success',startedAt:'2026-10-11T01:00:03Z',completedAt:'2026-10-11T01:01:58Z'}))};
 const observed={...repository,private:true},issue={id:701,number:7,repositoryId:101,isPullRequest:false,state:'open'},workflow={id:401,path:contributionGatePaths[0],state:'active'};
 const evidence={version:1,collectedAt:'2026-10-11T01:03:00.000Z',availability:'COMPLETE',repositoryBefore:observed,repositoryAfter:observed,issueBefore:issue,issueAfter:issue,pullRequestBefore:pr,pullRequestAfter:pr,workflowBefore:workflow,workflowAfter:workflow,runBefore:run,runAfter:run,jobs:{runId:301,attempt:2,totalCount:1,complete:true,items:[job]},testedCommit:{repositoryId:101,sha:testedSha,parents:[baseSha,headSha]},gateFiles:{complete:true,items:[testedSha,headSha].flatMap(ref=>policy.trusted.files.map(file=>({...file,ref})))}};
 return {policy,receipt:{version:1,kind:'PRIVATE_GITHUB_CI_EVIDENCE',collection:'PRIVATE_GITHUB_API_READ',cryptographicAttestation:false,policyDigest:sha(JSON.stringify(policy)),evidence,result:validateContributionEvidence(policy,evidence),readStatistics:{requests:20,bytes:12000},reason:null}};
}
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'opengrail-private-handoff-')),at=new Date(Date.now()-2000).toISOString(),authorId=await M.contributionPublicHumanId('synthetic-handoff-sponsor'),author={kind:'HUMAN',id:authorId,sponsorId:authorId};
 const command={action:'register',requestId:uid(),id:uid(),title:'Invented task',summary:'Synthetic handoff fixture; no real repository.',kind:'TESTS',acceptance:['Retain failed evidence.'],rejection:['Promote a hash to execution proof.'],policyAccepted:M.contributionPolicy},record=M.contributionTaskRecordForCommand(command,author,at),task={id:record.id,digest:sha(JSON.stringify(record)),requestId:record.requestId,createdAt:at,author,state:'OPEN',sequence:0,reason:null,record,events:[]};
 const claimCommand={action:'claim',requestId:uid(),id:uid(),task:{id:task.id,digest:task.digest},expectedTaskSequence:0,policyAccepted:M.contributionPolicy},claimRecord=M.contributionClaimRecordForCommand(claimCommand,author,at),claim={id:claimRecord.id,digest:sha(JSON.stringify(claimRecord)),requestId:claimRecord.requestId,createdAt:at,expiresAt:claimRecord.expiresAt,checkedAt:new Date().toISOString(),author,task:claimRecord.task,taskState:'OPEN',sequence:0,status:'ACTIVE',handoffDigest:null,reason:null,record:claimRecord,events:[]},ci=privateCi();
 const paths={task:join(dir,'task.json'),claim:join(dir,'claim.json'),policy:join(dir,'policy.json'),ci:join(dir,'ci.json'),output:join(dir,'handoff.json'),preload:join(dir,'no-provider.mjs'),working:join(dir,'working')};mkdirSync(paths.working);
 const values={task:{version:1,item:task,executionEnabled:false},claim:{version:1,task,item:claim,executionEnabled:false},policy:ci.policy,ci:ci.receipt};
 function write(key){writeFileSync(paths[key],JSON.stringify(values[key]),{mode:0o600});}
 for(const key of Object.keys(values))write(key);
 writeFileSync(paths.preload,"globalThis.fetch=()=>{throw Error('UNEXPECTED_PROVIDER_REQUEST');};\n",{mode:0o600});
 return {dir,paths,values,write,close(){rmSync(dir,{recursive:true,force:true});}};
}
function cli(f,args=['prepare',f.paths.task,f.paths.claim,f.paths.policy,f.paths.ci,f.paths.output],preload=f.paths.preload){return spawnSync(process.execPath,[...(preload?['--import',preload]:[]),'scripts/contribution-handoff.mjs',args[0],f.paths.working,...args.slice(1)],{cwd:resolve('.'),env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'},encoding:'utf8',timeout:15000,maxBuffer:131072});}
function safe(f,result){for(const value of [f.values.policy.target.repository.fullName,f.values.policy.target.head.repository.fullName,f.values.policy.target.head.ref,f.values.policy.target.testedSha]){assert(!result.stdout.includes(value));assert(!result.stderr.includes(value));}}

test('actual file-only CLI binds public task/claim and private CI, retains exclusive private bytes and verifies exact submitted digest',async()=>{
 const f=await fixture();try{
  const prepared=cli(f);assert.equal(prepared.status,0,prepared.stderr);safe(f,prepared);const summary=JSON.parse(prepared.stdout),bytes=readFileSync(f.paths.output),record=JSON.parse(bytes);
  assert.equal(summary.handoffDigest,sha(bytes));assert.equal(statSync(f.paths.output).mode&0o777,0o600);assert.equal(summary.ciStatus,'CI_VERIFIED');assert.equal(summary.ciSnapshot,'OFFLINE_UNAUTHENTICATED_SNAPSHOT');
  assert.equal(record.task.digest,f.values.task.item.digest);assert.equal(record.claim.task.digest,record.task.digest);assert.equal(record.ciAssessment.policyDigest,sha(JSON.stringify(f.values.policy)));assert.equal(record.privateIssueMapping,'OPERATOR_DECLARED_NOT_VERIFIED');
  for(const field of ['repositoryAccessGranted','taskCompletionVerified','merged','reputationAwarded','published','executionEnabled','ordersEnabled','liveEnabled'])assert.equal(record[field],false);
  const verified=cli(f,['verify',f.paths.output,summary.handoffDigest]);assert.equal(verified.status,0,verified.stderr);safe(f,verified);assert.equal(JSON.parse(verified.stdout).cryptographicAttestation,false);
  assert.notEqual(cli(f,['verify',f.paths.output,'f'.repeat(64)]).status,0);
  writeFileSync(f.paths.output,Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),bytes]));
  const bom=cli(f,['verify',f.paths.output,summary.handoffDigest]);assert.notEqual(bom.status,0);assert.equal(bom.stderr.trim(),'PRIVATE_HANDOFF_NOT_CONFIRMED');
 }finally{f.close();}
});

test('explicit separate working checkout excludes both inputs and output even from trusted tooling cwd',async()=>{
 const f=await fixture();try{
  const inside=join(f.paths.working,'private-ci.json');writeFileSync(inside,JSON.stringify(f.values.ci),{mode:0o600});
  assert.notEqual(cli(f,['prepare',f.paths.task,f.paths.claim,f.paths.policy,inside,f.paths.output]).status,0);assert(!existsSync(f.paths.output));
  const output=join(f.paths.working,'private-handoff.json');assert.notEqual(cli(f,['prepare',f.paths.task,f.paths.claim,f.paths.policy,f.paths.ci,output]).status,0);assert(!existsSync(output));
  const working=f.paths.working;f.paths.working=working+'/../working';assert.notEqual(cli(f).status,0);f.paths.working=join(f.dir,'working-alias');symlinkSync(working,f.paths.working);assert.notEqual(cli(f).status,0);assert(!existsSync(f.paths.output));
 }finally{f.close();}
});
test('failed, unavailable and stale invented CI remains retained despite a false original success result',async()=>{
 for(const [status,edit] of [['FAILED',r=>r.evidence.jobs.items[0].steps[4].conclusion='failure'],['UNAVAILABLE',r=>r.evidence.availability='UNAVAILABLE'],['STALE',r=>r.evidence.pullRequestAfter={...r.evidence.pullRequestAfter,mergeSha:'d'.repeat(40)}]]){
  const f=await fixture();try{edit(f.values.ci);f.values.ci.result={status:'CI_VERIFIED',claim:'Invented false report'};f.write('ci');const result=cli(f);assert.equal(result.status,0,result.stderr);safe(f,result);assert.equal(JSON.parse(result.stdout).ciStatus,status);const retained=JSON.parse(readFileSync(f.paths.output));assert.equal(retained.ciReceipt.result.status,'CI_VERIFIED');assert.equal(retained.ciAssessment.status,status);}finally{f.close();}
 }
});
test('cross-task, expired lease, public policy, mismatched evidence and extra authority cannot produce a handoff',async()=>{
 const edits=[f=>f.values.claim.task={...f.values.claim.task,id:uid()},f=>{const c=f.values.claim.item,at=new Date(Date.now()-73*3600000).toISOString();c.createdAt=at;c.record.createdAt=at;c.expiresAt=new Date(Date.parse(at)+72*3600000).toISOString();c.record.expiresAt=c.expiresAt;c.checkedAt=new Date(Date.parse(at)+1000).toISOString();c.digest=sha(JSON.stringify(c.record));},f=>{f.values.policy={version:1,publicReadApproved:true,target:f.values.policy.target,trusted:f.values.policy.trusted};},f=>f.values.ci.policyDigest='f'.repeat(64),f=>f.values.task.item.record.executionEnabled=true];
 for(const edit of edits){const f=await fixture();try{edit(f);for(const key of Object.keys(f.values))f.write(key);const result=cli(f);assert.notEqual(result.status,0);assert(!existsSync(f.paths.output));safe(f,result);}finally{f.close();}}
});
test('actual CLI refuses unsafe inputs, duplicate JSON keys and output replacement before private publication',async()=>{
 const f=await fixture();try{
  chmodSync(f.paths.policy,0o644);assert.notEqual(cli(f).status,0);chmodSync(f.paths.policy,0o600);
  writeFileSync(f.paths.policy,'{"version":2,"version":1}',{mode:0o600});assert.notEqual(cli(f).status,0);f.write('policy');
  const alias=join(f.dir,'policy-alias');symlinkSync(f.paths.policy,alias);assert.notEqual(cli(f,['prepare',f.paths.task,f.paths.claim,alias,f.paths.ci,f.paths.output]).status,0);
  writeFileSync(f.paths.output,'retained original',{mode:0o600});const refused=cli(f);assert.notEqual(refused.status,0);assert.equal(readFileSync(f.paths.output,'utf8'),'retained original');safe(f,refused);
 }finally{f.close();}
});
test('late publication confirmation failure retains the handoff with explicit uncertainty',async()=>{
 const f=await fixture();try{
  const preload=join(f.dir,'late-fsync.mjs');writeFileSync(preload,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let n=0;fs.fsyncSync=(fd)=>{if(++n===2)throw Error('invented late confirmation failure');return original(fd);};syncBuiltinESMExports();globalThis.fetch=()=>{throw Error('UNEXPECTED_PROVIDER_REQUEST');};\n",{mode:0o600});
  const result=cli(f,undefined,preload);assert.notEqual(result.status,0);assert.equal(result.stderr.trim(),'PRIVATE_EVIDENCE_OUTPUT_UNCERTAIN');assert(existsSync(f.paths.output));assert.equal(JSON.parse(readFileSync(f.paths.output)).kind,'PRIVATE_CONTRIBUTION_HANDOFF');safe(f,result);
 }finally{f.close();}
});
