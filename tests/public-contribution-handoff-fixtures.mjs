import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import ts from 'typescript';
import {runContributionChecks,contributionScriptPins} from '../scripts/check-contribution.mjs';
import {contributionGatePaths,contributionRequiredSteps,validateContributionEvidence} from '../scripts/contribution-evidence-core.mjs';

const native=createRequire(import.meta.url),cache=new Map();
export function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(m,m.exports,id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id));return m.exports;}
export const M=load('app/contribution-model.ts'),sha=value=>createHash('sha256').update(value).digest('hex'),uid=()=>randomUUID(),clone=value=>JSON.parse(JSON.stringify(value));
const git=(root,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
/** Actual fixed checker over a tiny isolated synthetic Git merge; no provider. */
export async function checkedFixture(options={}){
 const dir=mkdtempSync(join(tmpdir(),'opengrail-public-check-')),root=join(dir,'repo');
 for(const path of ['', 'scripts','.github/workflows','tests','node_modules/.bin'])mkdirSync(join(root,path),{recursive:true});
 copyFileSync('scripts/check-contribution.mjs',join(root,'scripts/check-contribution.mjs'));copyFileSync('.github/workflows/contribution.yml',join(root,'.github/workflows/contribution.yml'));
 writeFileSync(join(root,'package.json'),JSON.stringify({name:'synthetic-public-handoff-check',type:'module',private:true,scripts:{...contributionScriptPins,...(options.pins??{})}}));
 writeFileSync(join(root,'.gitignore'),'node_modules/\ndist/\n');writeFileSync(join(root,'tests/synthetic.test.mjs'),options.test??"import test from 'node:test';test('synthetic isolated check',()=>{});\n");
 writeFileSync(join(root,'scripts/run-framework.mjs'),"import {mkdirSync,writeFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});writeFileSync('dist/synthetic','isolated fixture');\n");
 writeFileSync(join(root,'node_modules/.bin/tsc'),"#!/usr/bin/env node\nconsole.log('synthetic typecheck');\n",{mode:0o755});writeFileSync(join(root,'change.txt'),'base\n');
 git(root,'init','-b','main');git(root,'config','user.name','Synthetic checker fixture');git(root,'config','user.email','synthetic@example.invalid');git(root,'add','.');git(root,'commit','-m','synthetic base');git(root,'checkout','-b','synthetic-change');writeFileSync(join(root,'change.txt'),'head\n');git(root,'add','change.txt');git(root,'commit','-m','synthetic contribution');const headSha=git(root,'rev-parse','HEAD');git(root,'checkout','main');writeFileSync(join(root,'base-extra.txt'),'advance\n');git(root,'add','.');git(root,'commit','-m','synthetic base advance');const baseSha=git(root,'rev-parse','HEAD');git(root,'merge','--no-ff','synthetic-change','-m','synthetic test merge');const testedSha=git(root,'rev-parse','HEAD');
 let signal=options.signal;
 if(options.lateAbort){
  // Fire a real AbortController at the producer's final status read, after all
  // commands and afterSource observation. This is a synthetic timing fixture.
  const controller=new AbortController();signal=controller.signal;
  const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get,line=readFileSync('scripts/check-contribution.mjs','utf8').split('\n').findIndex(line=>line.includes('body.status = options.signal'))+1;
  Object.defineProperty(signal,'aborted',{get(){if(new Error().stack.includes('check-contribution.mjs:'+line+':'))controller.abort();return nativeAborted.call(signal);}});
 }
 const reportPath=join(dir,'retained-report.json'),report=await runContributionChecks({root,baseSha,headSha,testedSha,reportPath,...(options.timeout?{commandTimeoutMs:options.timeout}:{}),...(signal?{signal}:{})});
 const repository={id:1701,fullName:'synthetic-public-owner/opengrail-fixture'},context={version:1,repository,issueNumber:3,pullRequestNumber:null,base:{ref:'main',sha:baseSha},head:{repository:{id:1702,fullName:'synthetic-agent/opengrail-fixture'},ref:'synthetic-change',sha:headSha},testedSha};
 return {dir,root,reportPath,report,context,close(){rmSync(dir,{recursive:true,force:true});}};
}
export async function handoffFixture(check,overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'opengrail-public-handoff-')),working=join(dir,'working');mkdirSync(working);
 const at=new Date(Date.now()-2000).toISOString(),authorId=await M.contributionPublicHumanId('synthetic-public-handoff-sponsor'),author={kind:'HUMAN',id:authorId,sponsorId:authorId};
 const register={action:'register',requestId:uid(),id:uid(),title:'Synthetic public contribution',summary:'Isolated task; no real GitHub claim.',kind:'TESTS',acceptance:['Retain failures.'],rejection:['Treat a digest as provider authentication.'],policyAccepted:M.contributionPolicy},record=M.contributionTaskRecordForCommand(register,author,at),task={id:record.id,digest:sha(JSON.stringify(record)),requestId:record.requestId,createdAt:at,author,state:'OPEN',sequence:0,reason:null,record,events:[]};
 const claimCommand={action:'claim',requestId:uid(),id:uid(),task:{id:task.id,digest:task.digest},expectedTaskSequence:0,policyAccepted:M.contributionPolicy},claimRecord=M.contributionClaimRecordForCommand(claimCommand,author,at),claim={id:claimRecord.id,digest:sha(JSON.stringify(claimRecord)),requestId:claimRecord.requestId,createdAt:at,expiresAt:claimRecord.expiresAt,checkedAt:new Date().toISOString(),author,task:claimRecord.task,taskState:'OPEN',sequence:0,status:'ACTIVE',handoffDigest:null,reason:null,record:claimRecord,events:[]};
 const paths={working,task:join(dir,'task.json'),claim:join(dir,'claim.json'),context:join(dir,'context.json'),report:join(dir,'report.json'),policy:join(dir,'policy.json'),ci:join(dir,'ci.json'),output:join(dir,'handoff.json'),preload:join(dir,'no-network.mjs')};
 const values={task:{version:1,item:task,executionEnabled:false},claim:{version:1,task,item:claim,executionEnabled:false},context:clone(check.context),report:clone(check.report),...overrides};
 function write(key){writeFileSync(paths[key],JSON.stringify(values[key]),{mode:0o600});}
 for(const key of Object.keys(values))write(key);writeFileSync(paths.preload,"globalThis.fetch=()=>{throw Error('UNEXPECTED_NETWORK_REQUEST');};\n",{mode:0o600});
 return {dir,paths,values,write,close(){rmSync(dir,{recursive:true,force:true});}};
}
export function cli(f,operation='prepare',extra=[],preload=f.paths.preload){const args=operation==='prepare'?['prepare',f.paths.working,f.paths.task,f.paths.claim,f.paths.context,f.paths.report,f.paths.output,...extra]:['verify',f.paths.working,...extra];return spawnSync(process.execPath,[...(preload?['--import',preload]:[]),'scripts/contribution-public-handoff.mjs',...args],{cwd:resolve('.'),encoding:'utf8',timeout:30000});}
export function reportDigest(report){const {reportDigest,...body}=report;report.reportDigest=sha(JSON.stringify(body));return report;}
/** Invented PUBLIC provider metadata only; never a real provider claim. */
export function publicCi(context,localReport){
 const repository=context.repository,baseSha=context.base.sha,headSha=context.head.sha,testedSha=context.testedSha,now=Date.now()-10000,start=new Date(now).toISOString(),end=new Date(now+5000).toISOString(),collectedAt=new Date(now+6000).toISOString();
 const names={'.github/workflows/contribution.yml':'workflow','scripts/check-contribution.mjs':'checker','package.json':'packageJson'},policy={version:1,publicReadApproved:true,target:{repository,issueNumber:context.issueNumber,pullRequestNumber:context.pullRequestNumber,base:context.base,head:context.head,testedSha,runId:2301},trusted:{workflowId:2401,workflowPath:contributionGatePaths[0],files:contributionGatePaths.map(path=>({path,digest:localReport.source.files[names[path]]}))}};
 const pr={id:2501,number:context.pullRequestNumber,repositoryId:repository.id,state:'open',draft:false,merged:false,base:{repository,...context.base},head:context.head,mergeSha:testedSha},run={id:2301,repositoryId:repository.id,workflowId:2401,path:contributionGatePaths[0],attempt:1,event:'pull_request',status:'completed',conclusion:'success',headSha,headRepository:context.head.repository,pullRequests:[{number:context.pullRequestNumber,base:pr.base,head:pr.head}],createdAt:start,updatedAt:end,startedAt:start};
 const job={id:2601,runId:2301,runAttempt:1,headSha,name:'Contribution checks',status:'completed',conclusion:'success',startedAt:start,completedAt:end,steps:contributionRequiredSteps(testedSha).map((name,n)=>({number:n+1,name,status:'completed',conclusion:'success',startedAt:start,completedAt:end}))};
 const observed={...repository,private:false},issue={id:2701,number:context.issueNumber,repositoryId:repository.id,isPullRequest:false,state:'open'},workflow={id:2401,path:contributionGatePaths[0],state:'active'},evidence={version:1,collectedAt,availability:'COMPLETE',repositoryBefore:observed,repositoryAfter:observed,issueBefore:issue,issueAfter:issue,pullRequestBefore:pr,pullRequestAfter:pr,workflowBefore:workflow,workflowAfter:workflow,runBefore:run,runAfter:run,jobs:{runId:2301,attempt:1,totalCount:1,complete:true,items:[job]},testedCommit:{repositoryId:repository.id,sha:testedSha,parents:[baseSha,headSha]},gateFiles:{complete:true,items:[testedSha,headSha].flatMap(ref=>policy.trusted.files.map(file=>({...file,ref})))}};
 return {policy,receipt:{version:1,kind:'PUBLIC_GITHUB_CI_EVIDENCE',collection:'PUBLIC_GITHUB_API_READ',cryptographicAttestation:false,policyDigest:sha(JSON.stringify(policy)),evidence,result:validateContributionEvidence(policy,evidence),readStatistics:{requests:20,bytes:12000},reason:null}};
}
