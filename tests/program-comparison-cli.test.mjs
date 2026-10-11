import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync,mkdirSync,copyFileSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {programFingerprintFiles} from '../scripts/program-fingerprint-core.mjs';
const folder=mkdtempSync(join(tmpdir(),'opengrail-program-comparison-cli-'));let counter=0,claimFile,claim;
const path=name=>join(folder,(++counter)+'-'+name+'.json'),read=file=>JSON.parse(readFileSync(file,'utf8')),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const env={PATH:process.env.PATH,WRANGLER_SEND_METRICS:'false'};
const run=(...args)=>spawnSync(process.execPath,['scripts/compare-program.mjs',...args],{encoding:'utf8',timeout:30000,env});
before(()=>{const input=path('first-party-input'),admission=path('program-admission'),final=path('program-final');let result=spawnSync(process.execPath,['scripts/program-replay.mjs','example',input],{encoding:'utf8',timeout:30000,env});assert.equal(result.status,0,result.stderr);result=spawnSync(process.execPath,['scripts/program-replay.mjs','run',input,admission,final],{encoding:'utf8',timeout:30000,env});assert.equal(result.status,0,result.stderr);claim=read(final).entries[0].outcome;claimFile=path('complete-claim');writeFileSync(claimFile,JSON.stringify(claim));});
after(()=>rmSync(folder,{recursive:true,force:true}));
test('actual CLI admits the exact whole claim before generator replay and retains full fresh outcome separately',()=>{
 const admission=path('comparison-admission'),final=path('comparison-result'),checked=run('check',claimFile,admission,final);assert.equal(checked.status,0,checked.stderr);const a=read(admission),f=read(final);assert.deepEqual(a.claim,claim);assert.deepEqual(f.admission,a);assert.deepEqual(f.reconstructed,claim);assert.equal(f.report.status,'MATCH');assert.equal(f.report.identity.attemptId,claim.attemptId);assert.equal(f.report.qualification,'NONE');assert.equal(run('verify',final).status,0);
});
test('reviewed fsync interruption retains original admission without a terminal claim; recovery preserves exact IDs and forbids generator execution',()=>{
 const hook=join(folder,'first-party-fsync-interruption.mjs');writeFileSync(hook,"import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;fs.fsyncSync=fd=>{original(fd);if(fs.fstatSync(fd).isFile())throw Error('Reviewed local I/O interruption');};syncBuiltinESMExports();");
 const admission=path('interrupted-admission'),final=path('unwritten-terminal');const stopped=spawnSync(process.execPath,['--import',hook,'scripts/compare-program.mjs','check',claimFile,admission,final],{encoding:'utf8',timeout:30000,env});assert.equal(stopped.status,1);assert.equal(existsSync(admission),true);assert.equal(existsSync(final),false);const original=read(admission),recoveredFile=path('recovered');assert.equal(run('recover',admission,recoveredFile).status,2);const recovered=read(recoveredFile);assert.equal(recovered.admission.id,original.id);assert.equal(recovered.report.identity.attemptId,claim.attemptId);assert.equal(recovered.report.status,'INTERRUPTED');assert.equal(recovered.report.reason,'USER_CANCELLED');assert.equal(recovered.reconstructed,null);assert.equal(run('verify',recoveredFile).status,0);
});
test('complete false generator fuel remains a MISMATCH and structural verification rejects omitted fresh discrepancies after rehashing',()=>{
 const forged=structuredClone(claim);forged.trace.forEach(row=>row.fuelUsed++);forged.totalFuel+=forged.trace.length;const {outcomeDigest,...body}=forged;void outcomeDigest;forged.outcomeDigest=hash(body);const input=path('false-fuel');writeFileSync(input,JSON.stringify(forged));const admission=path('false-fuel-admission'),final=path('false-fuel-result');const checked=run('check',input,admission,final);assert.equal(checked.status,2,checked.stderr);const result=read(final);assert.equal(result.report.status,'MISMATCH');assert.deepEqual(result.reconstructed,claim);assert(result.report.comparison.differenceCount>50);assert.equal(result.report.comparison.differences.length,50);assert.equal(run('verify',final).status,0);
 result.report.comparison.differenceCount++;const {reportDigest,...reportBody}=result.report;void reportDigest;result.report.reportDigest=hash(reportBody);const {resultDigest,...resultBody}=result;void resultDigest;result.resultDigest=hash(resultBody);const altered=path('self-hashed-bad-count');writeFileSync(altered,JSON.stringify(result));assert.equal(run('verify',altered).status,1);
});
test('new outputs are exclusive, lexical path aliases and existing/symlink targets refuse before execution',()=>{
 const admission=path('new-admission'),final=path('existing-terminal');writeFileSync(final,'retained');assert.equal(run('check',claimFile,admission,final).status,1);assert.equal(existsSync(admission),false);assert.equal(readFileSync(final,'utf8'),'retained');assert.equal(run('check',claimFile,resolve(claimFile),path('never')).status,1);
 const target=path('target'),link=path('link');writeFileSync(target,'safe');symlinkSync(target,link);assert.equal(run('check',claimFile,path('never-admitted'),link).status,1);assert.equal(readFileSync(target,'utf8'),'safe');
});
test('bounded data reads reject symlinks, duplicate keys, invalid UTF8 and oversized JSON without echoing input',()=>{
 const linked=path('input-link');symlinkSync(claimFile,linked);assert.equal(run('check',linked,path('none-a'),path('none-b')).status,1);
 for(const bytes of [Buffer.from('{"version":1,"version":2}'),Buffer.from([0xff,0x00]),Buffer.from('{"hypothesis":"og_agent_synthetic_secret"}')]){const input=path('invalid'),admission=path('none');writeFileSync(input,bytes);const result=run('check',input,admission,path('none-final'));assert.equal(result.status,1);assert.equal(existsSync(admission),false);assert(!result.stdout.includes('og_agent_synthetic_secret'));assert(!result.stderr.includes('og_agent_synthetic_secret'));}
 const big=path('too-large');writeFileSync(big,' '.repeat(10485761));assert.equal(run('check',big,path('none'),path('none-final')).status,1);
});
test('stale pure evidence source is refused by the real CLI before bundling guest execution or writing admission',()=>{
 const fixture=join(folder,'stale-fixed-sources');const files=[...Object.values(programFingerprintFiles),'app/program-fingerprints.ts','app/evaluator-fingerprints.ts','app/demo-engine.ts','app/reference-engine.ts','scripts/program-fingerprint-core.mjs','scripts/compare-program.mjs'];for(const file of files){mkdirSync(dirname(join(fixture,file)),{recursive:true});copyFileSync(file,join(fixture,file));}symlinkSync(resolve('node_modules'),join(fixture,'node_modules'),'dir');appendFileSync(join(fixture,'app/program-evidence.ts'),'\n// Reviewed local stale-source refusal test.\n');const admission=path('stale-none'),final=path('stale-none-final'),result=spawnSync(process.execPath,[join(fixture,'scripts/compare-program.mjs'),'check',claimFile,admission,final],{encoding:'utf8',timeout:30000,env});assert.equal(result.status,1);assert.equal(existsSync(admission),false);assert.equal(existsSync(final),false);
});
test('unknown commands and incomplete arguments never create a retained execution',()=>{assert.equal(run('eval',claimFile).status,1);assert.equal(run('check',claimFile).status,1);});
