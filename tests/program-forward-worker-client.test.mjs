import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {programForwardEvidenceFixture} from './program-forward-evidence-fixtures.mjs';
import {fittingProgramDirectionPublicFixture} from './program-direction-public-fixtures.mjs';

const originalWorker=globalThis.Worker,originalFetch=globalThis.fetch,require=createRequire(import.meta.url);
const workerAsset="/static/program-forward-evidence-reviewed.js";
const built=await build({entryPoints:['app/program-forward-worker-client.ts'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2022',plugins:[{name:'forward-worker-asset',setup(b){b.onResolve({filter:/^\.\/program-forward-evidence\.worker\.ts\?worker&url$/},()=>({path:'forward-worker-asset',namespace:'worker-asset'}));b.onLoad({filter:/.*/,namespace:'worker-asset'},()=>({contents:'export default '+JSON.stringify(workerAsset)+';',loader:'js'}));}}]}),module={exports:{}};
new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
const {compareProgramForwardInWorker}=module.exports;
const fixture=await programForwardEvidenceFixture(),valid=await fixture.m.compareProgramForwardEvidence(fixture.artifact);
let response,workers=[];
class WorkerResponseFixture{
 constructor(url,options){this.url=url;this.options=options;this.terminated=false;this.commands=[];workers.push(this);}
 postMessage(command){this.commands.push(command);if(command.type==='COMPARE')queueMicrotask(()=>this.onmessage?.({data:{operationId:command.operationId,type:'RESULT',result:structuredClone(response)}}));}
 terminate(){this.terminated=true;}
}
globalThis.Worker=WorkerResponseFixture;
globalThis.fetch=()=>assert.fail('Local forward Worker client must not fetch or publish.');
after(()=>{globalThis.Worker=originalWorker;globalThis.fetch=originalFetch;});
async function refusal(value){response=value;workers=[];await assert.rejects(compareProgramForwardInWorker(fixture.artifact));assert.equal(workers.length,1);assert(workers[0].terminated);}

test('client retains the whole independently identified fresh artifact and actual journal for a trusted-valid comparison',async()=>{
 response=valid;workers=[];const result=await compareProgramForwardInWorker(fixture.artifact);assert.deepEqual(result,valid);assert.notEqual(result.reconstructed.attemptId,fixture.artifact.attemptId);assert.equal(result.attempt.journal.journalDigest,result.reconstructed.journal.journalDigest);assert.equal(workers[0].url,workerAsset);assert.equal(workers[0].options.type,'module');assert.equal(workers[0].commands[0].type,'COMPARE');assert(workers[0].terminated);
});
test('client preserves a complete nonnull V2 SHORT plan, adverse trials and full fresh Worker result',async()=>{
 const direction=await fittingProgramDirectionPublicFixture(),fresh=await direction.m.compareProgramForwardEvidence(direction.artifact);
 assert.equal(fresh.report.status,'MATCH');assert(new TextEncoder().encode(JSON.stringify(fresh)).byteLength<=direction.m.programForwardEvidenceReconstructionReservation(direction.artifact.input));
 response=fresh;workers=[];const result=await compareProgramForwardInWorker(direction.artifact);
 assert.deepEqual(result,fresh);assert.deepEqual(result.reconstructed.input.plan,direction.plan);assert.equal(result.reconstructed.input.plan.handoff.ledger.attempts.length,3);assert(result.reconstructed.input.plan.handoff.ledger.attempts.at(-1).outcome.artifact.metrics.netPnl<0);
 assert.deepEqual(result.attempt.journal,direction.journal);assert.notEqual(result.reconstructed.attemptId,direction.artifact.attemptId);assert.equal(workers[0].url,workerAsset);assert.equal(workers[0].options.type,'module');assert(workers[0].terminated);
});
test('client rejects a valid MATCH report with its full reconstructed field removed, null or an extra result field',async()=>{
 const missing=structuredClone(valid);delete missing.reconstructed;await refusal(missing);await refusal({...valid,reconstructed:null});await refusal({...valid,unexpected:'claimed completion'});
});
test('client rejects a separately valid resealed cancelled attempt paired with a MATCH report and completed artifact',async()=>{
 const attempt=structuredClone(valid.attempt),{attemptDigest:_digest,...body}=attempt;body.status='CANCELLED';body.reason='USER_CANCELLED';const cancelled=await fixture.m.verifyProgramForwardReconstructionAttempt({...body,attemptDigest:await fixture.m.programForwardEvidenceDigest(body)});await refusal({...valid,attempt:cancelled});
});
test('client rejects independently valid fresh artifact and attempt identities from different reconstruction wrappers',async()=>{
 const other=await fixture.m.snapshotProgramForwardEvidence(valid.reconstructed.journal,valid.reconstructed.input.plan);await refusal({...valid,reconstructed:other});
});
test('client proves the whole fresh comparison operands rather than accepting only a valid sealed report and matching input',async()=>{
 const claimed=structuredClone(fixture.artifact.journal);claimed.guest.state.globals[0]=777;const bits=new Uint8Array(8);new DataView(bits.buffer).setFloat64(0,777,true);claimed.guest.state.globalBits[0]=Buffer.from(bits).toString('hex');claimed.guest.stateDigest=await fixture.m.programForwardEvidenceDigest(claimed.guest.state);claimed.guest.trace.at(-1).stateDigest=claimed.guest.stateDigest;for(const row of claimed.events)if(row.guestTraceLength===claimed.guest.trace.length)row.guestStateDigest=claimed.guest.stateDigest;const {journalDigest:_journal,...journalBody}=claimed;claimed.journalDigest=await fixture.m.programForwardEvidenceDigest(journalBody);
 const artifact=await fixture.m.sealProgramForwardEvidenceArtifact(fixture.artifact.input,claimed,crypto.randomUUID()),mismatch=await fixture.m.compareProgramForwardEvidence(artifact);assert.equal(mismatch.report.status,'MISMATCH');const {reportDigest:_report,...reportBody}=structuredClone(mismatch.report),operand=reportBody.comparison.differences[0];operand.rightDigest='f'.repeat(64);const forgedReport=await fixture.m.bindProgramForwardComparisonReport(await fixture.m.sealProgramForwardComparisonReport(reportBody),artifact);response={...mismatch,report:forgedReport};workers=[];await assert.rejects(compareProgramForwardInWorker(artifact));assert(workers[0].terminated);
});
