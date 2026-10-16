import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// First-party invented inputs only. No market feed, real clock measurement or public identity.
let m;
before(async () => {
  const built = await build({stdin: {contents: `export * from './app/synthetic-replay-journey'; export * from './app/replay-forward-context'; export {syntheticDemoInput,replayDemo} from './app/demo-engine'; export {createSessionJournal,appendSessionEvent} from './app/session-journal'; export {snapshotSessionEvidence} from './app/session-evidence'; export {strategyTemplate,boundedStrategyRecord,strategyDigest} from './app/strategy-model';`, resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
  m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
});
const copy = value => JSON.parse(JSON.stringify(value));
async function fixture(type = 'TREND', timeframe = '1h') {
  const input = await m.syntheticDemoInput();
  const record = copy(input.strategy.record); record.content.definition = m.strategyTemplate(type); record.content.definition.market.timeframe = timeframe;
  const source = {record, digest: await m.strategyDigest(m.boundedStrategyRecord(record).payload)};
  const selectedInput = await m.syntheticDemoInput(source); selectedInput.initialCapital = 4321.25;
  const artifact = await m.replayDemo(selectedInput);
  const selected = {localId: crypto.randomUUID(), attemptedAt: '2099-01-01T00:00:00.000Z', label: 'Invented offline fixture', strategyDigest: source.digest, source: null, sourceConfirmed: true, priorStatus: null, origin: 'SYNTHETIC_OFFLINE', status: artifact.status, error: null, input: selectedInput, artifact};
  const adverse = {...selected, localId: crypto.randomUUID(), status: 'INPUT_REJECTED', sourceConfirmed: false, input: null, artifact: null, error: 'Rejected authored input retained.'};
  return {selected, context: await m.createReplayForwardContext([adverse, selected], selected.localId)};
}

test('explicit synthetic preparation retains exact rules/capital and shifts the entire stream beyond every retained clock', async () => {
  for (const [type, timeframe] of [['TREND','1h'], ['SIGNAL','5m'], ['SIGNAL','1d']]) {
    const f = await fixture(type, timeframe), before = JSON.stringify(f.context);
    const prepared = await m.prepareSyntheticReplayContinuation(f.context, '2027-01-01T00:00:00.000Z');
    assert.equal(JSON.stringify(f.context), before);
    assert.deepEqual(prepared.config.strategy, f.selected.input.strategy); assert.equal(prepared.config.initialCapital, 4321.25);
    assert.equal(prepared.config.origin, 'SYNTHETIC_FIXTURE'); assert.equal(prepared.config.clockMode, 'SYNTHETIC_PLAYBACK');
    assert.equal(prepared.config.provenance, 'SYNTHETIC'); assert.equal(prepared.config.rights.permission, 'CREATED_SYNTHETIC');
    assert.equal(prepared.config.ordersEnabled, false); assert.equal(prepared.config.liveEnabled, false);
    assert(prepared.startedAt > m.replayForwardLastClock(f.context));
    const step = {'5m':300000,'1h':3600000,'1d':86400000}[timeframe];
    const bars = prepared.events.filter(value => value.event.type === 'CLOSED_BAR');
    assert.equal(bars.length, 360); assert.equal(Date.parse(bars[0].event.bar.closedAt) - Date.parse(prepared.startedAt), step);
    for (let n = 0; n < bars.length; n++) { assert.equal(Date.parse(bars[n].event.bar.closedAt) % step, 0); if (n) assert.equal(Date.parse(bars[n].event.bar.closedAt) - Date.parse(bars[n-1].event.bar.closedAt), step); }
    for (const row of prepared.events) {
      assert(row.receivedAt > prepared.startedAt);
      if (row.event.type === 'QUOTE') { assert.equal(row.receivedAt, row.event.observedAt); assert.equal(Date.parse(row.receivedAt) % step, 2); }
      if (row.event.type === 'SIGNAL') { assert.equal(row.event.signal.observedAt, row.event.signal.availableAt); assert.equal(Date.parse(row.receivedAt) - Date.parse(row.event.signal.availableAt), 1); }
    }
    const later = await m.prepareSyntheticReplayContinuation(f.context, '2100-01-01T00:00:00.000Z'); assert(later.startedAt > '2100-01-01T00:00:00.000Z');
  }
});

test('synthetic admission rejects public identity, genuine-input claims and noncanonical preparation clocks', async () => {
  const f = await fixture();
  const publicTrial = {...f.selected, origin: 'PUBLIC_SNAPSHOT', source: {id: f.selected.input.strategy.record.id, digest: f.selected.strategyDigest}};
  const publicContext = await m.createReplayForwardContext([publicTrial], publicTrial.localId);
  await assert.rejects(m.verifySyntheticReplayContext(publicContext));
  const input = copy(f.selected.input); input.dataset.provenance = 'USER_SUPPLIED'; input.dataset.rights.permission = 'AUTHORIZED_USE';
  const artifact = await m.replayDemo(input), supplied = {...f.selected, input, artifact, status: artifact.status};
  await assert.rejects(m.verifySyntheticReplayContext(await m.createReplayForwardContext([supplied], supplied.localId)));
  let coercions = 0; const coercingClock = {toString(){coercions++;return '2027-01-01T00:00:00.000Z';}};
  for (const clock of [coercingClock, null, 0, 'invalid', '2027-01-01', '2027-01-01T00:00:00Z']) await assert.rejects(m.prepareSyntheticReplayContinuation(f.context, clock));
  assert.equal(coercions, 0);
});

test('a separate demo-only report retains exact complete context and reconstructed checkpoint without accepting a public forward report', async () => {
  const f = await fixture('DCA'), original = JSON.stringify(f.context), prepared = await m.prepareSyntheticReplayContinuation(f.context, '2100-01-01T00:00:00.000Z');
  let journal = await m.createSessionJournal(prepared.config, prepared.startedAt);
  for (const row of prepared.events.slice(0,2)) journal = await m.appendSessionEvent(journal, row.event, row.receivedAt);
  assert.equal(journal.state.openPositions.length, 1);
  const evidence = await m.snapshotSessionEvidence(journal), report = await m.createSyntheticReplayJourney(f.context, evidence);
  assert.equal(report.kind, 'LOCAL_SYNTHETIC_REPLAY_JOURNEY'); assert.equal(report.scope, 'SYNTHETIC_DEMONSTRATION_ONLY');
  assert.equal(JSON.stringify(report.context), original); assert.deepEqual(report.continuation.input.events, journal.events);
  assert.equal(report.continuation.result.kind, 'ARTIFACT'); assert.deepEqual(report.continuation.result.artifact.projection.openPositions, journal.state.openPositions);
  assert.equal(report.qualification, 'NONE'); assert.equal(report.independence, 'NOT_ESTABLISHED');
  assert.deepEqual(await m.verifySyntheticReplayJourney(copy(report)), report);
  await assert.rejects(m.createReplayForwardReport(f.context, evidence)); await assert.rejects(m.verifyReplayForwardReport(report));
  for (const patch of [{initialCapital:1000}, {clockMode:'SYSTEM_RECEIPT'}, {origin:'PUBLIC_STRATEGY'}]) {
    const changed = await m.createSessionJournal({...prepared.config,...patch}, prepared.startedAt);
    await assert.rejects(m.createSyntheticReplayJourney(f.context, await m.snapshotSessionEvidence(changed)));
  }
  const earlier = await m.createSessionJournal(prepared.config, f.selected.attemptedAt);
  await assert.rejects(m.createSyntheticReplayJourney(f.context, await m.snapshotSessionEvidence(earlier)));
  const tampered = copy(report); tampered.scope = 'PROSPECTIVE_MARKET_EVIDENCE'; await assert.rejects(m.verifySyntheticReplayJourney(tampered));
  tampered.scope = report.scope; tampered.context.trials.pop(); await assert.rejects(m.verifySyntheticReplayJourney(tampered));
  let getters = 0; const hostile = Object.create(null, {context: {enumerable:true,get(){getters++;return f.context;}}});
  await assert.rejects(m.verifySyntheticReplayJourney(hostile)); assert.equal(getters, 0);
});
