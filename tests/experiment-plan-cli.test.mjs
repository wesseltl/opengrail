import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, symlinkSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
let directory, model;
const file = name => join(directory, name);
const call = (...args) => spawnSync(process.execPath, ['scripts/plan-experiment.mjs', ...args], {cwd: process.cwd(), encoding: 'utf8', timeout: 20000, maxBuffer: 32768});
const rows = result => result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const read = name => JSON.parse(readFileSync(file(name), 'utf8'));
function freeze(name) {
  const result = call('freeze', file('bundle.json'), '150', '5', file(name));
  assert.equal(result.status, 0, result.stderr);
  return read(name);
}
async function child(plan, partition) {
  const {action, requestId, id, policyAccepted, ...content} = plan.children[partition].command;
  assert.equal(action, 'register');
  // Invented local public projection; no actual registration/authentication is claimed.
  const record = model.experimentManifestSchema.parse({version: 1, id, requestId, createdAt: new Date().toISOString(), author: plan.captured.parent.record.author, type: 'MANIFEST', content, flags: model.experimentManifestFlags(content.disclosures), policyAccepted, classification: 'AUTHOR_REPORTED', executionEnabled: false});
  const digest = await model.experimentDigest(model.boundedExperimentRecord(record).payload);
  return {id, digest, type: 'MANIFEST', requestId, createdAt: record.createdAt, author: plan.captured.parent.author, strategy: plan.captured.parent.strategy, manifest: null, state: 'VISIBLE', reason: null, suppression: null, reporting: 'UNREPORTED', outcomeCount: 0, record, moderation: []};
}
before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'opengrail-plan-cli-test-'));
  writeFileSync(file('bundle.json'), readFileSync('examples/runs/synthetic-negative-bundle.json'));
  const result = await build({stdin: {contents: "export * from './app/experiment-model';", resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
  writeFileSync(file('model.mjs'), result.outputFiles[0].text);
  model = await import(pathToFileURL(file('model.mjs')).href);
});
after(() => rmSync(directory, {recursive: true, force: true}));

test('actual CLI freezes strict partitions durably before any evaluation and never overwrites them', () => {
  const plan = freeze('frozen.json'), bytes = readFileSync(file('frozen.json'));
  assert.equal(plan.children.TRAIN.range.barCount, 150);
  assert.equal(plan.excluded.bars.length, 5);
  assert.equal(plan.unseen, 'NOT_ESTABLISHED');
  assert.equal(statSync(file('frozen.json')).mode & 0o777, 0o600);
  assert.equal(call('freeze', file('bundle.json'), '120', '0', file('frozen.json')).status, 1);
  assert.deepEqual(readFileSync(file('frozen.json')), bytes);
  const checked = call('verify', file('frozen.json'));
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(rows(checked)[0].executionReconstructed, false);
  assert.equal(rows(checked)[0].sourceAuthentication, 'OFFLINE_SNAPSHOT_UNVERIFIED');
});

test('explicit draft preparation preserves stable child IDs across retries and submits nothing', () => {
  const plan = freeze('prepare-plan.json');
  assert.equal(call('prepare', file('prepare-plan.json'), 'TRAIN', file('unconfirmed.json')).status, 1);
  assert(!existsSync(file('unconfirmed.json')));
  for (const name of ['train-one.json', 'train-two.json']) {
    const result = call('prepare', file('prepare-plan.json'), 'TRAIN', file(name), '--confirm-public-sharing');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(rows(result)[0].submitted, false);
  }
  assert.deepEqual(readFileSync(file('train-one.json')), readFileSync(file('train-two.json')));
  assert.equal(read('train-one.json').id, plan.children.TRAIN.command.id);
  const bytes = readFileSync(file('train-one.json'));
  assert.equal(call('prepare', file('prepare-plan.json'), 'TRAIN', file('train-one.json'), '--confirm-public-sharing').status, 1);
  assert.deepEqual(readFileSync(file('train-one.json')), bytes);
});

test('actual child bundles require exact partition registration; the original or wrong child cannot substitute', async () => {
  const plan = freeze('binding-plan.json');
  for (const partition of ['TRAIN', 'TEST']) {
    const receipt = await child(plan, partition);
    writeFileSync(file(partition + '-item.json'), JSON.stringify(receipt));
    const result = call('bundle', file('binding-plan.json'), partition, file(partition + '-item.json'), file(partition + '-bundle.json'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(rows(result)[0].evaluated, false);
    const bundle = read(partition + '-bundle.json');
    assert.deepEqual(bundle.manifest, receipt);
    assert.deepEqual(bundle.source, plan.captured.source);
  }
  writeFileSync(file('original.json'), JSON.stringify(plan.captured.parent));
  for (const item of ['original.json', 'TEST-item.json']) {
    const result = call('bundle', file('binding-plan.json'), 'TRAIN', file(item), file('wrong-bundle.json'));
    assert.equal(result.status, 1);
    assert(!existsSync(file('wrong-bundle.json')));
  }
});

test('strict local file boundary rejects symlinks, duplicate JSON, invalid UTF-8, secret prefixes and forged plans', () => {
  const plan = freeze('input-plan.json');
  symlinkSync(file('input-plan.json'), file('linked-plan.json'));
  writeFileSync(file('duplicate.json'), '{"version":1,"version":1}');
  writeFileSync(file('invalid-utf8.json'), Buffer.from([255, 254]));
  const secret = structuredClone(plan);
  secret.captured.parent.record.content.input.hypothesis = 'og_local_owner_' + 'a'.repeat(64);
  writeFileSync(file('secret.json'), JSON.stringify(secret));
  const forged = structuredClone(plan);
  forged.children.TRAIN.command.input.initialCapital *= 2;
  writeFileSync(file('forged.json'), JSON.stringify(forged));
  for (const name of ['linked-plan.json', 'duplicate.json', 'invalid-utf8.json', 'secret.json', 'forged.json']) {
    const result = call('verify', file(name));
    assert.equal(result.status, 1, name);
    assert(!result.stderr.includes('a'.repeat(64)));
  }
  for (const count of ['1', '-1', 'NaN', '1e3', '9999']) {
    assert.equal(call('freeze', file('bundle.json'), count, '5', file('invalid-freeze.json')).status, 1);
    assert(!existsSync(file('invalid-freeze.json')));
  }
});

test('a genuine competing creator cannot replace the first frozen plan', async () => {
  const launch = () => new Promise(resolve => {
    const p = spawn(process.execPath, ['scripts/plan-experiment.mjs', 'freeze', file('bundle.json'), '150', '5', file('race-plan.json')], {cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    p.stdout.on('data', b => stdout += b); p.stderr.on('data', b => stderr += b);
    p.on('close', status => resolve({status, stdout, stderr}));
  });
  const results = await Promise.all([launch(), launch()]);
  assert.deepEqual(results.map(x => x.status).sort(), [0, 1]);
  assert.equal(call('verify', file('race-plan.json')).status, 0);
  const success = results.find(x => x.status === 0);
  assert.equal(rows(success)[0].planId, read('race-plan.json').planId);
});

test('a first-party post-link directory-sync fault gives no frozen acknowledgment and preserves reconcilable bytes', () => {
  const hook = file('fsync-fault.mjs');
  writeFileSync(hook, "import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.fsyncSync;let count=0;fs.fsyncSync=function(fd){if(++count===2)throw Error('synthetic parent-sync fault');return original(fd)};syncBuiltinESMExports();");
  const result = spawnSync(process.execPath, ['--import', hook, 'scripts/plan-experiment.mjs', 'freeze', file('bundle.json'), '150', '5', file('uncertain-plan.json')], {cwd: process.cwd(), encoding: 'utf8', maxBuffer: 32768, timeout: 20000});
  assert.equal(result.status, 1);
  assert(!result.stdout.includes('PLAN_FROZEN'));
  assert(existsSync(file('uncertain-plan.json')));
  assert.equal(call('verify', file('uncertain-plan.json')).status, 0);
  assert.equal(call('freeze', file('bundle.json'), '150', '5', file('uncertain-plan.json')).status, 1);
});
