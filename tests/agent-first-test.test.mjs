import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const sha=value=>createHash('sha256').update(value).digest('hex');
const call=directory=>spawnSync(process.execPath,['scripts/agent-first-test.mjs',directory],{cwd:process.cwd(),encoding:'utf8',maxBuffer:16384,timeout:90000});
const json=file=>JSON.parse(readFileSync(file,'utf8'));

test('one real first-test command retains a loss, full comparison and genuine replay; an existing destination stays byte-for-byte unchanged',()=>{
 const parent=mkdtempSync(join(tmpdir(),'opengrail-agent-first-test-')),directory=join(parent,'first-run');
 try{
  const result=call(directory);assert.equal(result.status,0,result.stderr);assert.equal(result.signal,null);
  const report=JSON.parse(result.stdout),files=report.files,ledger=json(files['ledger.json']),slot=ledger.entries[0],outcome=slot.outcome,artifact=json(files['artifact.json']),comparison=json(files['comparison.json']);
  assert.equal(report.status,'VERIFIED');assert.equal(report.provenance,'SYNTHETIC');assert.equal(report.classification,'AUTHOR_REPORTED');assert.equal(report.qualification,'NONE');assert.equal(report.independence,'NOT_ESTABLISHED');assert.equal(report.ordersEnabled,false);assert.equal(report.publicationSubmitted,false);
  assert.deepEqual(json(files['summary.json']),report);assert.equal(ledger.entries.length,1);assert.deepEqual(ledger.events.map(event=>event.type),['ADMITTED','FINISHED']);assert.equal(slot.admission.status,'RUNNING');assert.equal(outcome.status,'EVALUATED');
  const fixture=readFileSync('examples/runs/synthetic-negative-bundle.json');assert.deepEqual(readFileSync(files['input-bundle.json']),fixture);assert.deepEqual(outcome.captured,{manifest:JSON.parse(fixture).manifest,source:JSON.parse(fixture).source});
  assert.deepEqual(artifact,outcome.artifact);assert.deepEqual(comparison,outcome.comparison);assert.equal(artifact.status,'COMPLETED');assert(artifact.metrics.netPnl<0);assert.equal(comparison.status,'MATCH');assert.deepEqual(report.metrics,artifact.metrics);assert.equal(report.digests.ledger,ledger.ledgerDigest);assert.equal(report.digests.comparison,comparison.reportDigest);assert.equal(report.digests.artifact,artifact.resultDigest);
  const {resultDigest,...artifactBody}=artifact;assert.equal(sha(JSON.stringify(artifactBody)),resultDigest);assert.equal(comparison.identity.claimedArtifact,resultDigest);assert.equal(report.digests.strategy,artifact.digests.strategy);
  assert.deepEqual(report.verification,{ledgerIdentity:'CHECKED',ledgerExecutionReconstructed:false,sameImplementationReplay:'MATCH',primaryReferenceComparison:'MATCH'});
  assert.deepEqual(report.steps.map(step=>[step.step,step.exitCode,step.completed]),[['run',0,true],['ledger-verify',0,true],['replay-verify',0,true]]);
  const identity=json(join(directory,'ledger-verify.stdout.log'));assert.equal(identity.executionReconstructed,false);assert.equal(identity.ledgerDigest,ledger.ledgerDigest);
  assert.equal(readFileSync(join(directory,'replay-verify.stdout.log'),'utf8'),'Exact same-implementation replay matched. This is not independent qualification.\n');
  assert.equal(lstatSync(directory).mode&0o777,0o700);
  const snapshot=()=>Object.fromEntries(readdirSync(directory).sort().map(name=>{const path=join(directory,name),stat=lstatSync(path);assert(stat.isFile());assert.equal(stat.mode&0o777,0o600);return [name,{mode:stat.mode&0o777,sha256:sha(readFileSync(path))}];}));
  const before=snapshot(),again=call(directory);assert.notEqual(again.status,0);assert.equal(again.stdout,'');assert.match(again.stderr,/Output directory was refused/);assert.deepEqual(snapshot(),before);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
