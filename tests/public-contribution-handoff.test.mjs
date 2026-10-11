import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,statSync,chmodSync,symlinkSync,linkSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkedFixture,handoffFixture,cli,M,clone,sha,uid,reportDigest,publicCi} from './public-contribution-handoff-fixtures.mjs';
import {publicHandoffPlain,parsePublicHandoffJson,parsePublicContributionContext,validateLocalContributionReport,normalizePublicContributionHandoff} from '../scripts/contribution-public-handoff-core.mjs';
import {validateContributionEvidence} from '../scripts/contribution-evidence-core.mjs';
let check;
before(async()=>{check=await checkedFixture();assert.equal(check.report.status,'PASSED');});after(()=>check?.close());
const retained=f=>JSON.parse(readFileSync(f.paths.output,'utf8'));
const safe=result=>{assert(!/Synthetic public contribution|Retain failures|synthetic-public-owner|synthetic-agent|retained fixture failure|PRIVATE KEY|og_agent_|github_pat_|ghp_/.test(result.stdout+result.stderr));assert(result.stdout.length<4096);};
async function withFixture(callback,overrides){const f=await handoffFixture(check,overrides);try{return await callback(f);}finally{f.close();}}

test('actual offline CLI binds canonical task/claim and real isolated checker report with absent CI, exact digest and no authority',async()=>withFixture(async f=>{
 const prepared=cli(f);assert.equal(prepared.status,0,prepared.stderr);safe(prepared);const summary=JSON.parse(prepared.stdout),bytes=readFileSync(f.paths.output),record=retained(f);
 assert.equal(summary.handoffDigest,sha(bytes));assert.equal(statSync(f.paths.output).mode&0o777,0o600);assert.equal(record.kind,'PUBLIC_CONTRIBUTION_HANDOFF');assert.equal(record.context.pullRequestNumber,null);assert.equal(record.ci,null);assert.equal(record.ciAssessment.status,'UNAVAILABLE');assert.equal(record.ciAssessment.reason,'NOT_COLLECTED');assert.equal(record.ciAssessment.correlation,null);
 assert.equal(record.inputFileDigests.report,undefined);assert.equal(record.inputFileDigests.localReport,sha(readFileSync(f.paths.report)));assert.equal(record.inputFileDigests.publicPolicy,null);assert.equal(record.inputFileDigests.publicCiReceipt,null);assert.deepEqual(record.localReport,check.report);assert.equal(record.localAssessment.source,'MATCHED_DECLARED_MERGE');
 for(const key of ['repositoryAccessGranted','taskCompletionVerified','merged','reputationAwarded','published','researchQualified','independentResearch','mergeApproved','deploymentApproved','permissionChangeApproved','executionEnabled','ordersEnabled','liveEnabled'])assert.equal(record[key],false);
 const verified=cli(f,'verify',[f.paths.output,summary.handoffDigest]);assert.equal(verified.status,0,verified.stderr);safe(verified);assert.equal(JSON.parse(verified.stdout).currentness,'NOT_RECHECKED');assert.notEqual(cli(f,'verify',[f.paths.output,'f'.repeat(64)]).status,0);
 writeFileSync(f.paths.output,Buffer.concat([bytes,Buffer.from(' ')]));assert.notEqual(cli(f,'verify',[f.paths.output,summary.handoffDigest]).status,0);
}));

test('public CI pair recomputes narrow offline correlation and binds exact public context without claiming authenticated execution',async()=>withFixture(async f=>{
 f.values.context.pullRequestNumber=9;const invented=publicCi(f.values.context,f.values.report);f.values.policy=invented.policy;f.values.ci=invented.receipt;for(const key of ['context','policy','ci'])f.write(key);
 const result=cli(f,'prepare',[f.paths.policy,f.paths.ci]);assert.equal(result.status,0,result.stderr);safe(result);const record=retained(f);assert.equal(record.ciAssessment.status,'CI_VERIFIED');assert.equal(record.ciAssessment.collection,'OFFLINE_UNAUTHENTICATED_SNAPSHOT');assert.equal(record.ciAssessment.currentness,'NOT_RECHECKED');assert.equal(record.ciAssessment.cryptographicAttestation,false);assert.equal(record.qualification,'NONE');
 assert.equal(record.inputFileDigests.publicPolicy,sha(readFileSync(f.paths.policy)));assert.equal(cli(f,'verify',[f.paths.output,JSON.parse(result.stdout).handoffDigest]).status,0);
}));

test('failed, stale and unavailable public CI snapshots remain retained without inherited success',async()=>{
 for(const [status,edit] of [['FAILED',r=>r.evidence.jobs.items[0].steps[4].conclusion='failure'],['STALE',r=>r.evidence.pullRequestAfter={...r.evidence.pullRequestAfter,mergeSha:'d'.repeat(40)}],['UNAVAILABLE',r=>r.evidence.availability='UNAVAILABLE']])await withFixture(async f=>{
  f.values.context.pullRequestNumber=9;const invented=publicCi(f.values.context,f.values.report);edit(invented.receipt);invented.receipt.result=validateContributionEvidence(invented.policy,invented.receipt.evidence);f.values.policy=invented.policy;f.values.ci=invented.receipt;for(const key of ['context','policy','ci'])f.write(key);const result=cli(f,'prepare',[f.paths.policy,f.paths.ci]);assert.equal(result.status,0,result.stderr);assert.equal(retained(f).ciAssessment.status,status);assert.equal(retained(f).ciAssessment.correlation.status,status);safe(result);
 });
});

test('actual failed, timed-out, interrupted and missing-source checker reports preserve distinct outcomes and all original bytes',async()=>{
 const variants=[{test:"import test from 'node:test';test('retained fixture failure',()=>{throw Error('synthetic rejection');});\n"},{test:'setInterval(()=>{},1000);',timeout:300},{signal:AbortSignal.abort()},{pins:{test:'node unsupported-script'}}];
 for(const options of variants){const adverse=await checkedFixture(options);try{assert.notEqual(adverse.report.status,'PASSED');const f=await handoffFixture(adverse);try{const original=readFileSync(f.paths.report),result=cli(f);assert.equal(result.status,0,result.stderr);const record=retained(f);assert.equal(record.localAssessment.status,adverse.report.status);assert.deepEqual(record.localReport,adverse.report);assert.deepEqual(readFileSync(f.paths.report),original);if(!adverse.report.source)assert.equal(record.localAssessment.source,'NOT_OBSERVED');if(options.timeout)assert(record.localReport.checks.some(item=>item.status==='TIMED_OUT'));if(options.signal)assert.equal(record.localAssessment.status,'INTERRUPTED');}finally{f.close();}}finally{adverse.close();}}
});

test('actual fixed checker late abort remains INTERRUPTED after all four checks passed, without invented reason or successful handoff inflation',async()=>{
 const adverse=await checkedFixture({lateAbort:true});try{
  assert.equal(adverse.report.status,'INTERRUPTED');assert(adverse.report.checks.every(item=>item.status==='PASSED'));assert.deepEqual(adverse.report.failureReasons,[]);
  const f=await handoffFixture(adverse);try{const result=cli(f);assert.equal(result.status,0,result.stderr);assert.equal(retained(f).localAssessment.status,'INTERRUPTED');assert.equal(JSON.parse(result.stdout).localStatus,'INTERRUPTED');}finally{f.close();}
 }finally{adverse.close();}
});

test('canonical public refs reject invalid components without executing Git and direct report validation rejects malformed preparation clocks',()=>{
 for(const ref of ['/refs/heads/a','refs//heads/a','refs/heads/.hidden','refs/heads/a.','refs/a.lock/b','a..b','feature.lock']){const context=clone(check.context);context.base.ref=ref;assert.throws(()=>parsePublicContributionContext(context));}
 for(const ref of ['main','source/opengrail-foundation','refs/heads/feature']){const context=clone(check.context);context.base.ref=ref;assert.equal(parsePublicContributionContext(context).base.ref,ref);}
 assert.throws(()=>validateLocalContributionReport(check.report,check.context,'UNKNOWN'));
});

test('contradictory successful local/CI gate files reject, while failed local source change stays adverse with an explicit mismatch',async()=>{
 for(const failed of [false,true])await withFixture(async f=>{
  f.values.context.pullRequestNumber=9;const invented=publicCi(f.values.context,f.values.report);f.values.policy=invented.policy;f.values.ci=invented.receipt;f.values.report.afterSource.files.checker='e'.repeat(64);
  if(failed){f.values.report.status='FAILED';f.values.report.failureReasons=['SOURCE_CHANGED'];f.values.report.afterSource.dirty=true;}else f.values.report.source.files.checker='e'.repeat(64);
  reportDigest(f.values.report);for(const key of ['context','policy','ci','report'])f.write(key);const result=cli(f,'prepare',[f.paths.policy,f.paths.ci]);
  if(failed){assert.equal(result.status,0,result.stderr);assert.equal(retained(f).localAssessment.ciGateFiles,'MISMATCH');assert.equal(retained(f).localAssessment.status,'FAILED');}else{assert.notEqual(result.status,0);assert(!existsSync(f.paths.output));}
 });
});

test('local report rejects changed commands, commits, ordered parents, digest/status inflation, future checks and extra fields',async()=>{
 const edits=[r=>r.checks[0].command=['npm','run','evil'],r=>r.declared.headSha='d'.repeat(40),r=>r.source.parents.reverse(),r=>r.afterSource.commitSha='d'.repeat(40),r=>r.checks[0].exitCode=2,r=>r.afterSource=null,r=>r.source=null,r=>r.failureReasons=['SOURCE_CHANGED'],r=>r.finishedAt=new Date(Date.now()+60000).toISOString(),r=>r.executionEnabled=true,r=>r.checks[0].status='NOT_RUN'];
 for(const edit of edits)await withFixture(async f=>{edit(f.values.report);reportDigest(f.values.report);f.write('report');const result=cli(f);assert.notEqual(result.status,0);assert(!existsSync(f.paths.output));safe(result);});
 await withFixture(async f=>{f.values.report.reportDigest='f'.repeat(64);f.write('report');assert.notEqual(cli(f).status,0);});
});

test('context/task/claim substitutions and expired or future snapshots fail before publication',async()=>{
 const edits=[f=>f.values.context.repository.id=0,f=>f.values.context.testedSha=f.values.context.base.sha,f=>f.values.context.base.sha='D'.repeat(40),f=>f.values.context.pullRequestNumber=0,f=>f.values.context.extra=true,f=>f.values.claim.task.id=uid(),f=>f.values.claim.item.record.author.id='human_'+'e'.repeat(64),f=>f.values.claim.item.task.digest='e'.repeat(64),f=>f.values.claim.item.checkedAt=new Date(Date.now()+60000).toISOString(),f=>{const c=f.values.claim.item,at=new Date(Date.now()-73*3600000).toISOString();c.createdAt=c.record.createdAt=at;c.expiresAt=c.record.expiresAt=new Date(Date.parse(at)+72*3600000).toISOString();c.checkedAt=new Date(Date.parse(at)+1000).toISOString();c.digest=sha(JSON.stringify(c.record));},f=>{f.values.task.item.createdAt=new Date(Date.now()+60000).toISOString();},f=>{f.values.claim.item.status='SUBMITTED';},f=>f.values.task.item.record.executionEnabled=true];
 for(const edit of edits)await withFixture(async f=>{edit(f);for(const key of Object.keys(f.values))f.write(key);const result=cli(f);assert.notEqual(result.status,0);assert(!existsSync(f.paths.output));safe(result);});
});

test('private evidence, wrong public policy target, mismatched receipts and CI result inflation fail closed',async()=>{
 const edits=[f=>f.values.policy.version=2,f=>f.values.ci.kind='PRIVATE_GITHUB_CI_EVIDENCE',f=>f.values.ci.collection='PRIVATE_GITHUB_API_READ',f=>f.values.policy.target.issueNumber++,f=>f.values.policy.target.repository.id++,f=>f.values.policy.target.pullRequestNumber++,f=>f.values.policy.target.base.sha='d'.repeat(40),f=>f.values.ci.policyDigest='f'.repeat(64),f=>f.values.ci.result={status:'CI_VERIFIED'},f=>f.values.ci.evidence.collectedAt=new Date(Date.now()+60000).toISOString(),f=>f.values.context.pullRequestNumber=null];
 for(const edit of edits)await withFixture(async f=>{f.values.context.pullRequestNumber=9;const invented=publicCi(f.values.context,f.values.report);f.values.policy=invented.policy;f.values.ci=invented.receipt;edit(f);for(const key of ['context','policy','ci'])f.write(key);const result=cli(f,'prepare',[f.paths.policy,f.paths.ci]);assert.notEqual(result.status,0);assert(!existsSync(f.paths.output));safe(result);});
});

test('strict object and JSON admission rejects hooks, cycles, nonfinite values, duplicate keys, excess structures and nested encoded credentials',()=>{
 let read=false;const accessor={};Object.defineProperty(accessor,'x',{enumerable:true,get(){read=true;return 1;}});assert.throws(()=>publicHandoffPlain(accessor));assert.equal(read,false);
 for(const raw of [{x:NaN},{x:Infinity},{x:undefined},{toJSON(){throw Error('must not run');}},Object.assign(Object.create({}),{x:1}),{x:new Date()},new Array(2)])assert.throws(()=>publicHandoffPlain(raw));const cycle={};cycle.x=cycle;assert.throws(()=>publicHandoffPlain(cycle));assert.throws(()=>parsePublicHandoffJson('{"version":1,"version":1}'));assert.throws(()=>parsePublicHandoffJson('{"x":1e999}'));
 for(const secret of ['og_agent_'+uid()+'.'+'a'.repeat(64),'github_pat_'+'a'.repeat(40),'ghp_'+'a'.repeat(40),'sk-proj-'+'a'.repeat(40),'Bearer '+'a'.repeat(40)]){let encoded=encodeURIComponent(secret).replace(/o/g,'%6f').replace(/g/g,'%67');assert.throws(()=>parsePublicHandoffJson(JSON.stringify({x:encoded})));assert.throws(()=>publicHandoffPlain({x:'%zz'+encoded}));for(let n=0;n<7;n++)encoded=encodeURIComponent(encoded);assert.throws(()=>parsePublicHandoffJson(JSON.stringify({x:encoded})));}
 assert.throws(()=>publicHandoffPlain({x:'a'.repeat(1048577)}));let nested={};for(let n=0;n<18;n++)nested={x:nested};assert.throws(()=>publicHandoffPlain(nested));
});

test('guarded actual CLI rejects unsafe permissions, aliases, hard links, checkout paths, malformed JSON and existing outputs without deleting evidence',async()=>withFixture(async f=>{
 const original=readFileSync(f.paths.report);chmodSync(f.paths.report,0o644);assert.notEqual(cli(f).status,0);chmodSync(f.paths.report,0o600);
 const link=join(f.dir,'report-link.json');linkSync(f.paths.report,link);assert.notEqual(cli(f).status,0);unlinkSync(link);const symbolic=join(f.dir,'report-alias.json');symlinkSync(f.paths.context,symbolic);const saved=f.paths.context;f.paths.context=symbolic;assert.notEqual(cli(f).status,0);f.paths.context=saved;
 writeFileSync(f.paths.context,'{"version":1,"version":1}',{mode:0o600});assert.notEqual(cli(f).status,0);f.write('context');
 const output=f.paths.output;f.paths.output=join(f.paths.working,'handoff.json');assert.notEqual(cli(f).status,0);assert(!existsSync(f.paths.output));f.paths.output=output;
 writeFileSync(output,'retain original',{mode:0o600});assert.notEqual(cli(f).status,0);assert.equal(readFileSync(output,'utf8'),'retain original');assert.deepEqual(readFileSync(f.paths.report),original);
}));

test('late output confirmation and replacement failures retain possible artifacts with explicit uncertainty and no success digest',async()=>{
 for(const source of ["import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const old=fs.fsyncSync;let n=0;fs.fsyncSync=fd=>{if(++n===2)throw Error('synthetic late fsync');return old(fd);};syncBuiltinESMExports();", "import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const old=fs.linkSync;fs.linkSync=(a,b)=>{old(a,b);fs.writeFileSync(b,'replaced public artifact');};syncBuiltinESMExports();"]){await withFixture(async f=>{const preload=join(f.dir,'late-publication.mjs');writeFileSync(preload,source,{mode:0o600});const result=cli(f,'prepare',[],preload);assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.equal(result.stderr.trim(),'PRIVATE_EVIDENCE_OUTPUT_UNCERTAIN');assert(existsSync(f.paths.output));assert(existsSync(f.paths.report));});}
});

test('input mutation and special-file guards fail promptly; model-stage interruption removes only its temporary bundle and retains input reports',async()=>{
 await withFixture(async f=>{
  const preload=join(f.dir,'input-race.mjs'),target=JSON.stringify(f.paths.context);writeFileSync(preload,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const old=fs.readSync;let changed=false;fs.readSync=(fd,...args)=>{let path;try{path=fs.realpathSync('/proc/self/fd/'+fd);}catch{}if(!changed&&path==="+target+"){changed=true;fs.writeFileSync(path,'changed guarded context');}return old(fd,...args);};syncBuiltinESMExports();",{mode:0o600});
  const original=readFileSync(f.paths.report),result=cli(f,'prepare',[],preload);assert.notEqual(result.status,0);assert(!existsSync(f.paths.output));assert.deepEqual(readFileSync(f.paths.report),original);
 });
 await withFixture(async f=>{const pipe=join(f.dir,'synthetic-context-pipe');execFileSync('mkfifo',[pipe]);f.paths.context=pipe;const result=cli(f);assert.notEqual(result.status,0);assert.equal(result.error,undefined);assert(!existsSync(f.paths.output));});
 await withFixture(async f=>{
  const preload=join(f.dir,'interrupt-bundle.mjs'),marker=join(f.dir,'temporary-bundle-path.txt');writeFileSync(preload,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const old=fs.writeFileSync;fs.writeFileSync=(path,...args)=>{const result=old(path,...args);if(String(path).endsWith('/fixed-model.mjs')){old("+JSON.stringify(marker)+",String(path),{mode:0o600});process.kill(process.pid,'SIGTERM');}return result;};syncBuiltinESMExports();",{mode:0o600});
  const original=readFileSync(f.paths.report),result=cli(f,'prepare',[],preload);assert.equal(result.status,130,result.stderr);assert.equal(result.stdout,'');assert(existsSync(marker));assert(!existsSync(readFileSync(marker,'utf8')));assert(!existsSync(f.paths.output));assert.deepEqual(readFileSync(f.paths.report),original);
 });
});

test('verification rejects reassessed artifact inflation and absent-CI substitution even when attacker supplies a new file hash',async()=>withFixture(async f=>{
 const prepared=cli(f);assert.equal(prepared.status,0,prepared.stderr);const original=retained(f);
 for(const edit of [r=>r.localAssessment.status='FAILED',r=>r.ciAssessment.status='CI_VERIFIED',r=>r.inputFileDigests.publicPolicy='a'.repeat(64),r=>r.issueMapping='VERIFIED',r=>r.ordersEnabled=true,r=>r.claim.author.id='human_'+'a'.repeat(64)]){const changed=clone(original);edit(changed);writeFileSync(f.paths.output,JSON.stringify(changed),{mode:0o600});const result=cli(f,'verify',[f.paths.output,sha(readFileSync(f.paths.output))]);assert.notEqual(result.status,0);safe(result);}
}));
