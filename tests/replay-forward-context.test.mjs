import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Synthetic first-party functions only: no browser, provider, account or publication.
let m;
before(async () => {
  const built = await build({stdin: {contents: `export * from './app/replay-forward-context'; export {syntheticDemoInput,replayDemo} from './app/demo-engine'; export {createSessionJournal} from './app/session-journal'; export {snapshotSessionEvidence} from './app/session-evidence';`, resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
  m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
});
const copy = value => JSON.parse(JSON.stringify(value));
async function fixture() {
  const input = await m.syntheticDemoInput(); input.initialCapital = 1234.5;
  input.hypothesis = 'Retain this original invented replay hypothesis.';
  input.falsification = 'Reject changed strategy, costs, capital or missing adverse page trials.';
  const artifact = await m.replayDemo(input), source = {id: input.strategy.record.id, digest: input.strategy.digest};
  const selected = {localId: crypto.randomUUID(), attemptedAt: '2026-10-15T00:00:00.000Z', label: 'Invented replay', strategyDigest: source.digest, source, sourceConfirmed: true, priorStatus: null, origin: 'PUBLIC_SNAPSHOT', status: artifact.status, error: null, input, artifact};
  const interrupted = {...selected, localId: crypto.randomUUID(), status: 'INTERRUPTED', sourceConfirmed: false, input: null, artifact: null, error: 'Interrupted before a result was confirmed.'};
  const rejected = {...interrupted, localId: crypto.randomUUID(), status: 'INPUT_REJECTED', error: 'Input was rejected before evaluation.'};
  return {input, artifact, selected, context: await m.createReplayForwardContext([interrupted, rejected, selected], selected.localId)};
}
test('context retains every available trial and exact replay without claiming a complete search', async () => {
  const f = await fixture(), original = JSON.stringify(f.context);
  const verified = await m.verifyReplayForwardContext(copy(f.context));
  assert.equal(JSON.stringify(verified), original);
  assert.equal(verified.historyScope, 'AVAILABLE_PAGE_HISTORY_ONLY');
  assert.deepEqual(verified.trials.map(trial => trial.status), ['INTERRUPTED', 'INPUT_REJECTED', f.artifact.status]);
  assert.equal(m.selectedReplayTrial(verified).input.initialCapital, 1234.5);
  assert.deepEqual(m.selectedReplayTrial(verified).artifact, f.artifact);
  assert.equal(verified.qualification, 'NONE'); assert.equal(verified.independence, 'NOT_ESTABLISHED');
});
test('tampered artifacts, source bindings, duplicate trials and unknown authority fail admission', async () => {
  const f = await fixture();
  for (const change of [value => value.trials[2].artifact.audit.push({...value.trials[2].artifact.audit[0], details: 'tampered'}), value => value.trials[2].source.id = crypto.randomUUID(), value => value.trials.push(copy(value.trials[0])), value => value.liveEnabled = true, value => value.provider = 'caller-selected']) {
    const raw = copy(f.context); change(raw); await assert.rejects(m.verifyReplayForwardContext(raw));
  }
  const unconfirmed = {...f.selected, sourceConfirmed: false};
  await assert.rejects(m.createReplayForwardContext([unconfirmed], unconfirmed.localId));
  for (const status of ['NO_TRADES', 'CLEARED', 'INPUT_REJECTED', 'INTERRUPTED']) {
    const contradictory = {...f.selected, localId: crypto.randomUUID(), status};
    if (status === f.selected.status) continue;
    await assert.rejects(m.createReplayForwardContext([contradictory, f.selected], f.selected.localId));
  }
  const repeated = {...f.selected, localId: crypto.randomUUID()};
  const duplicateSources = await m.createReplayForwardContext([repeated, f.selected], f.selected.localId);
  assert.equal(m.replayForwardPublicInputs(duplicateSources).length, 1);
});
test('over-budget history is refused rather than trimmed and object getters never run', async () => {
  const f = await fixture(), tooMany = Array.from({length: 33}, () => ({...f.selected, localId: crypto.randomUUID()}));
  await assert.rejects(m.createReplayForwardContext(tooMany, tooMany[0].localId));
  let getterCalls = 0; const hostile = Object.create(null, {trials: {enumerable: true, get() { getterCalls++; return []; }}});
  await assert.rejects(m.verifyReplayForwardContext(hostile)); assert.equal(getterCalls, 0);
  await assert.rejects(m.verifyReplayForwardContext({text: 'x'.repeat(m.replayForwardLimits.bytes + 1)}));
  for (const token of ['og_local_owner_secret', 'og_local_producer_secret', 'og%5fagent%5fsecret']) {
    const raw = copy(f.context); raw.trials[0].error = token; await assert.rejects(m.verifyReplayForwardContext(raw));
  }
});
test('journey report retains the original replay and separate forward text with exact capital and rules', async () => {
  const f = await fixture(), original = JSON.stringify(f.context), config = {version: 1, sessionId: crypto.randomUUID(), methodVersion: 'opengrail-session-v1', clockMode: 'SYSTEM_RECEIPT', origin: 'PUBLIC_STRATEGY', strategy: f.input.strategy, initialCapital: f.input.initialCapital, provenance: 'USER_SUPPLIED', rights: {permission: 'AUTHORIZED_USE', acknowledged: true, note: 'Invented test permission for new inputs.'}, sourceLabel: 'Invented local forward test only', ordersEnabled: false, liveEnabled: false};
  const journal = await m.createSessionJournal(config, '2027-01-01T00:00:00.000Z');
  const forwardEvidence = await m.snapshotSessionEvidence(journal, {hypothesis: 'Separate prospective forward text.', falsification: 'Reject a reconstruction mismatch.'});
  const report = await m.createReplayForwardReport(f.context, forwardEvidence);
  assert.equal(JSON.stringify(report.context), original); assert.deepEqual(report.forwardEvidence, forwardEvidence);
  assert.equal(m.selectedReplayTrial(report.context).input.hypothesis, f.input.hypothesis);
  assert.notEqual(report.forwardEvidence.input.hypothesis, f.input.hypothesis);
  assert.deepEqual(await m.verifyReplayForwardReport(copy(report)), report);
  const changed = await m.createSessionJournal({...config, initialCapital: 1000}, '2027-01-01T00:00:00.000Z');
  await assert.rejects(m.createReplayForwardReport(f.context, await m.snapshotSessionEvidence(changed)));
  const retrospective = await m.createSessionJournal(config, '2026-01-01T00:00:00.000Z');
  await assert.rejects(m.createReplayForwardReport(f.context, await m.snapshotSessionEvidence(retrospective)));
  const syntheticClock = await m.createSessionJournal({...config, clockMode: 'SYNTHETIC_PLAYBACK', provenance: 'SYNTHETIC', rights: {...config.rights, permission: 'CREATED_SYNTHETIC'}}, '2027-01-01T00:00:00.000Z');
  await assert.rejects(m.createReplayForwardReport(f.context, await m.snapshotSessionEvidence(syntheticClock)));
  const forged = copy(report); forged.context.selectedTrialId = forged.context.trials[0].localId;
  await assert.rejects(m.verifyReplayForwardReport(forged));
});
