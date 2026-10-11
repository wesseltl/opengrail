import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

// Actual fixed modules and invented local events only. No provider, hosted DB or independent research claim.
let m;
before(async () => {
  const bundle = await build({stdin: {contents: "export * from './app/session-evidence-model';export * from './app/session-evidence';export * from './app/session-journal';export {syntheticSessionExample} from './app/session-example';export {strategyTemplate,strategyDigest} from './app/strategy-model';", resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
  m = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
});
const startedAt = '2025-01-01T00:00:00.000Z', at = '2025-01-01T01:00:00.000Z';
const later = milliseconds => new Date(Date.parse(at) + milliseconds).toISOString();
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const bar = {requestId: id(1), type: 'CLOSED_BAR', bar: {closedAt: at, open: 100, high: 100, low: 100, close: 100, volume: 1}};
async function seed(direction = 'LONG') {
  const example = await m.syntheticSessionExample(), config = structuredClone(example.config), record = config.strategy.record;
  record.content.definition = m.strategyTemplate('DCA');
  record.content.definition.market.direction = direction;
  record.content.definition.entry = {type: 'DCA', intervalBars: 1, maxEntries: 4};
  record.content.definition.risk = {positionPct: 10, maxOpenPositions: 2, stopLossPct: 2, takeProfitPct: 4, maxDailyLossPct: 5};
  config.strategy.digest = await m.strategyDigest(JSON.stringify(record));
  return m.createSessionJournal(config, startedAt);
}
async function open(direction = 'LONG') {
  let journal = await seed(direction);
  journal = await m.appendSessionEvent(journal, bar, at);
  return m.appendSessionEvent(journal, {requestId: id(2), type: 'QUOTE', observedAt: later(1), price: 100}, later(2));
}
async function rehashArtifact(value) {
  value.inputDigest = await m.sessionEvidenceDigest(JSON.stringify(value.input));
  const {resultDigest, ...body} = value; void resultDigest;
  value.resultDigest = await m.sessionEvidenceDigest(JSON.stringify(body));
  return value;
}
const artifactOf = bundle => { assert.equal(bundle.result.kind, 'ARTIFACT'); return bundle.result.artifact; };

test('pure public admission dependency graph contains no kernel, journal runtime or network access', async () => {
  const result = await build({entryPoints: ['app/session-evidence-model.ts'], bundle: true, write: false, format: 'esm', platform: 'node', metafile: true});
  assert(!Object.keys(result.metafile.inputs).some(path => /session-(?:engine|journal)\.ts$/.test(path)));
  const source = await readFile('app/session-evidence-model.ts', 'utf8');
  assert(!/fetch\(|eval\(|new Function|node:fs|localStorage|sessionStorage/.test(source));
});

test('full exact input and terminal open inventory export without forced tail liquidation', async () => {
  const journal = await open(), bundle = await m.snapshotSessionEvidence(journal, {hypothesis: 'Retrospective synthetic DCA case.', falsification: 'Every retained transition must reconstruct.'}), artifact = artifactOf(bundle);
  assert.deepEqual(bundle.input.events, journal.events);
  assert.deepEqual(bundle.input.config, journal.config);
  assert.equal(bundle.input.startedAt, journal.startedAt);
  assert.equal(bundle.input.journalDigest, journal.journalDigest);
  assert.equal(bundle.input.finalStateDigest, journal.state.stateDigest);
  assert.equal(artifact.projection.openPositions.length, 1);
  assert.equal(artifact.projection.trades.length, 0);
  assert.deepEqual(artifact.projection.account, journal.state.account);
  assert.equal(artifact.inputDigest, await m.sessionEvidenceDigest(JSON.stringify(bundle.input)));
  assert.equal(bundle.qualification, 'NONE'); assert.equal(bundle.independence, 'NOT_ESTABLISHED');
  assert.equal(bundle.ordersEnabled, false); assert.equal(bundle.liveEnabled, false);
  assert(!('consent' in bundle)); assert(!('benchmark' in artifact));
  assert.deepEqual(await m.verifySessionEvidenceBundle(JSON.parse(JSON.stringify(bundle))), bundle);
  assert.deepEqual(await m.reconstructSessionEvidence(bundle.input), journal);
});

test('actual local reconstruction MATCH binds all identities and never grants independent qualification', async () => {
  const artifact = artifactOf(await m.snapshotSessionEvidence(await open())), report = await m.reviewSessionEvidence(artifact);
  assert.equal(report.status, 'MATCH'); assert.equal(report.reason, null);
  assert.deepEqual(report.observed, artifact.projection);
  assert.equal(report.identity.artifact, artifact.resultDigest); assert.equal(report.identity.input, artifact.inputDigest);
  assert.equal(report.identity.journal, artifact.input.journalDigest);
  assert.equal(report.qualification, 'NONE'); assert.equal(report.independence, 'NOT_ESTABLISHED');
  assert.equal(report.scope, 'FIXED_LOCAL_RECONSTRUCTION_ONLY');
  assert.deepEqual(await m.verifySessionEvidenceReview(JSON.parse(JSON.stringify(report))), report);
});

test('empty session is a reconstructible unmarked snapshot with no invented market price or trade', async () => {
  const journal = await seed(), artifact = artifactOf(await m.snapshotSessionEvidence(journal));
  assert.equal(artifact.input.events.length, 0); assert.equal(artifact.projection.account.markedAt, null);
  assert.equal(artifact.projection.account.sourceObservedAt, null); assert.equal(artifact.projection.openPositions.length, 0);
  assert.equal(artifact.projection.trades.length, 0); assert.equal((await m.reviewSessionEvidence(artifact)).status, 'MATCH');
});

test('PAUSE preserves exposure and a subsequent adverse quote settles risk with actual costs', async () => {
  let journal = await open(); journal = await m.appendSessionEvent(journal, {requestId: id(3), type: 'PAUSE'}, later(3));
  const paused = artifactOf(await m.snapshotSessionEvidence(journal)); assert.equal(paused.projection.status, 'PAUSED'); assert.equal(paused.projection.openPositions.length, 1);
  journal = await m.appendSessionEvent(journal, {requestId: id(4), type: 'QUOTE', observedAt: later(4), price: 90}, later(5));
  const artifact = artifactOf(await m.snapshotSessionEvidence(journal));
  assert.equal(artifact.projection.trades[0].reason, 'STOP_LOSS'); assert(artifact.projection.trades[0].netPnl < 0);
  assert(artifact.projection.account.totalFees > 0); assert.equal(artifact.projection.account.markedAt, later(5));
  assert.equal(artifact.projection.account.sourceObservedAt, later(4));
  assert.equal((await m.reviewSessionEvidence(artifact)).status, 'MATCH');
});

test('emergency remains STOPPING with inventory until a strictly later quote, then retains adverse exit', async () => {
  let journal = await open(); journal = await m.appendSessionEvent(journal, {requestId: id(3), type: 'EMERGENCY'}, later(3));
  const pending = artifactOf(await m.snapshotSessionEvidence(journal)); assert.equal(pending.projection.status, 'STOPPING'); assert.equal(pending.projection.openPositions.length, 1); assert.equal(pending.projection.trades.length, 0);
  assert.equal((await m.reviewSessionEvidence(pending)).status, 'MATCH');
  journal = await m.appendSessionEvent(journal, {requestId: id(4), type: 'QUOTE', observedAt: later(4), price: 90}, later(5));
  const artifact = artifactOf(await m.snapshotSessionEvidence(journal)); assert.equal(artifact.projection.status, 'STOPPED'); assert.equal(artifact.projection.trades[0].reason, 'EMERGENCY_STOP'); assert(artifact.projection.trades[0].netPnl < 0);
  assert.equal((await m.reviewSessionEvidence(artifact)).status, 'MATCH');
});

test('uncapped SHORT insolvency and terminal negative equity survive public projection and reconstruction', async () => {
  let journal = await open('SHORT'); journal = await m.appendSessionEvent(journal, {requestId: id(3), type: 'QUOTE', observedAt: later(3), price: 1e8}, later(4));
  const artifact = artifactOf(await m.snapshotSessionEvidence(journal));
  assert.equal(artifact.projection.status, 'FAILED'); assert.equal(artifact.projection.failure, 'INSOLVENT');
  assert(artifact.projection.account.equity < 0); assert(artifact.projection.trades[0].netPnl < -artifact.projection.trades[0].collateral);
  assert.equal((await m.reviewSessionEvidence(artifact)).status, 'MATCH');
});

test('stale quote and regressed receipt clock retain exact rejected transition order without repair', async () => {
  let journal = await open(); journal = await m.appendSessionEvent(journal, {requestId: id(3), type: 'QUOTE', observedAt: at, price: 100}, later(60001));
  assert.equal(journal.state.events.at(-1).reason, 'STALE_QUOTE');
  journal = await m.appendSessionEvent(journal, {requestId: id(4), type: 'PAUSE'}, later(4));
  assert.equal(journal.state.events.at(-1).reason, 'OUT_OF_ORDER');
  const artifact = artifactOf(await m.snapshotSessionEvidence(journal));
  assert.equal(artifact.input.events.at(-1).receivedAt, later(4)); assert.equal(artifact.input.events.at(-2).receivedAt, later(60001));
  assert.equal(artifact.projection.account.markedAt, later(2)); assert.equal((await m.reviewSessionEvidence(artifact)).status, 'MATCH');
});

test('a prefetched source quote never becomes a backdated fill after a later received bar decision', async () => {
  let journal = await seed(); journal = await m.appendSessionEvent(journal, {requestId: id(2), type: 'QUOTE', observedAt: at, price: 100}, at);
  journal = await m.appendSessionEvent(journal, bar, later(5));
  const artifact = artifactOf(await m.snapshotSessionEvidence(journal)); assert.equal(artifact.projection.openPositions.length, 0); assert(artifact.projection.pending);
  assert.equal((await m.reviewSessionEvidence(artifact)).status, 'MATCH');
});

test('every intermediate commitment matters even when a fabricated tape keeps the original terminal commitment', async () => {
  const artifact = structuredClone(artifactOf(await m.snapshotSessionEvidence(await open())));
  artifact.input.events[0].stateDigest = 'a'.repeat(64); await rehashArtifact(artifact);
  await m.verifySessionEvidenceArtifact(artifact);
  const report = await m.reviewSessionEvidence(artifact); assert.equal(report.status, 'MISMATCH'); assert.equal(report.reason, 'CHECKPOINT_MISMATCH');
  assert.equal(report.observed.stateDigest, artifact.projection.stateDigest);
  await assert.rejects(m.reconstructSessionEvidence(artifact.input));
});

test('self-hashed profitable account fabrication passes identity only and is exposed by actual reconstruction', async () => {
  const artifact = structuredClone(artifactOf(await m.snapshotSessionEvidence(await open())));
  artifact.projection.account.equity += 100000; artifact.projection.account.realizedPnl += 100000; await rehashArtifact(artifact);
  await m.verifySessionEvidenceArtifact(artifact);
  const report = await m.reviewSessionEvidence(artifact); assert.equal(report.status, 'MISMATCH'); assert.equal(report.reason, 'PROJECTION_MISMATCH');
  assert.notEqual(report.observed.account.equity, artifact.projection.account.equity); assert.equal(report.qualification, 'NONE');
});

test('self-hashed false original-journal identity cannot become a MATCH', async () => {
  const artifact = structuredClone(artifactOf(await m.snapshotSessionEvidence(await open()))); artifact.input.journalDigest = 'a'.repeat(64); await rehashArtifact(artifact);
  await m.verifySessionEvidenceArtifact(artifact); const report = await m.reviewSessionEvidence(artifact); assert.equal(report.status, 'MISMATCH'); assert.equal(report.reason, 'JOURNAL_MISMATCH');
});

test('schema/digest/source/method corruption fails admission rather than obtaining a confirmed review', async () => {
  const original = artifactOf(await m.snapshotSessionEvidence(await open()));
  for (const modify of [a => {a.resultDigest = 'a'.repeat(64);}, a => {a.input.implementation.engine = 'a'.repeat(64);}, a => {a.input.methodDigest = 'a'.repeat(64);}, a => {a.input.config.strategy.digest = 'a'.repeat(64);}, a => {a.inputDigest = 'a'.repeat(64);}, a => {a.ordersEnabled = true;}, a => {a.projection.sequence++;}, a => {a.input.events.push(a.input.events[0]);}]) {
    const value = structuredClone(original); modify(value); await assert.rejects(m.verifySessionEvidenceArtifact(value)); await assert.rejects(m.reviewSessionEvidence(value));
  }
});

test('different retrospective hypotheses/falsification create exact distinct input identities without changing source journal', async () => {
  const journal = await open(), first = artifactOf(await m.snapshotSessionEvidence(journal, {hypothesis: 'First disclosed claim.', falsification: 'First rejection condition.'})), second = artifactOf(await m.snapshotSessionEvidence(journal, {hypothesis: 'Changed disclosed claim.', falsification: 'Changed rejection condition.'}));
  assert.notEqual(first.inputDigest, second.inputDigest); assert.notEqual(first.resultDigest, second.resultDigest);
  assert.equal(first.input.journalDigest, second.input.journalDigest); assert.deepEqual(first.input.events, second.input.events);
});

test('getter/toJSON/exotic/hidden/nonfinite inputs never execute submitted code', async () => {
  const bundle = await m.snapshotSessionEvidence(await open()); let invoked = false;
  const getter = {...bundle.input}; Object.defineProperty(getter, 'hypothesis', {enumerable: true, get() {invoked = true; throw Error('private');}});
  const hostile = {...bundle.input, toJSON() {invoked = true; throw Error('private');}};
  const hidden = {...bundle.input}; Object.defineProperty(hidden, 'hidden', {value: 1});
  for (const value of [getter, hostile, hidden, new Map(), {...bundle.input, number: Infinity}]) await assert.rejects(m.verifySessionEvidenceInput(value));
  assert.equal(invoked, false);
});

test('known agent/receiver/GitHub secrets and encoded variants cannot enter public hypotheses, config or evaluator', async () => {
  const original = (await m.snapshotSessionEvidence(await open())).input;
  const tokens = ['og_agent_' + id(700) + '.' + 'a'.repeat(64), 'og_local_owner_' + 'a'.repeat(64), 'og_local_producer_' + 'a'.repeat(64), 'ghp_' + 'A'.repeat(36), 'github_pat_' + 'A'.repeat(30)];
  for (const token of tokens) for (const value of [token, encodeURIComponent(encodeURIComponent(token.replaceAll('_', '%5f')))]) {
    await assert.rejects(m.verifySessionEvidenceInput({...original, hypothesis: value}), error => !error.message.includes(token));
    await assert.rejects(m.verifySessionEvidenceInput({...original, config: {...original.config, sourceLabel: value}}));
    assert.equal(m.sessionEvidenceEvaluatorSchema.safeParse({...m.sessionEvidenceEvaluatorDefaults(original), sourceVersion: value}).success, false);
  }
  const label = structuredClone(original); label.config.strategy.record.author = {kind: 'AGENT', id: id(700), sponsorId: label.config.strategy.record.author.sponsorId, name: 'og_agent_researcher'};
  label.config.strategy.digest = await m.strategyDigest(JSON.stringify(label.config.strategy.record)); await m.verifySessionEvidenceInput(label);
});

test('full public input cap rejects without slicing and is smaller than the local journal allowance', async () => {
  const original = (await m.snapshotSessionEvidence(await open())).input, input = structuredClone(original);
  input.events = Array.from({length: m.sessionEvidenceLimits.events}, (_, index) => ({event: {requestId: id(index + 1000), type: 'CLOSED_BAR', bar: {...bar.bar}}, receivedAt: at, stateDigest: original.finalStateDigest}));
  assert(Buffer.byteLength(JSON.stringify(input)) > m.sessionEvidenceLimits.inputBytes);
  await assert.rejects(m.verifySessionEvidenceInput(input), error => error.status === 413);
  assert.equal(input.events.length, m.sessionEvidenceLimits.events); assert(m.sessionEvidenceLimits.inputBytes < m.sessionJournalLimits.bytes);
});

test('public projection overflow fails artifact admission while the exact input remains retained', async () => {
  const original = artifactOf(await m.snapshotSessionEvidence(await open())), projection = structuredClone(original.projection);
  projection.trades = Array.from({length: 2000}, (_, index) => ({id: 'session_position_' + (index + 1), direction: 'LONG', entryBar: 0, exitBar: 0, entryAt: at, exitAt: later(5), entryObservedAt: at, exitObservedAt: later(4), quantity: 1, entryPrice: 100, exitPrice: 90, collateral: 100, entryFee: 0.1, exitFee: 0.1, grossPnl: -10, netPnl: -10.2, reason: 'STOP_LOSS', gridLevel: null, signalId: null}));
  assert(Buffer.byteLength(JSON.stringify(projection)) > m.sessionEvidenceLimits.artifactBytes);
  await assert.rejects(m.sealSessionEvidenceArtifact(original.input, projection), error => error.status === 413);
  const unavailable = await m.sealSessionEvidenceBundle(original.input, {kind: 'ARTIFACT_UNAVAILABLE', reason: 'Complete input retained; public projection does not fit.'});
  assert.deepEqual(unavailable.input, original.input); assert.equal(unavailable.result.kind, 'ARTIFACT_UNAVAILABLE');
  await m.verifySessionEvidenceBundle(unavailable);
});

test('mismatched or rehashed bundle input cannot silently replace its reported artifact', async () => {
  const bundle = structuredClone(await m.snapshotSessionEvidence(await open())); bundle.input.hypothesis = 'Changed frozen input.';
  const {bundleDigest, ...body} = bundle; void bundleDigest; bundle.bundleDigest = await m.sessionEvidenceDigest(JSON.stringify(body));
  await assert.rejects(m.verifySessionEvidenceBundle(bundle));
});

test('cancellation is retained without a MATCH and snapshot preparation never changes its source journal', async () => {
  const journal = await open(), before = JSON.stringify(journal), artifact = artifactOf(await m.snapshotSessionEvidence(journal)), controller = new AbortController(); controller.abort();
  const report = await m.reviewSessionEvidence(artifact, {signal: controller.signal}); assert.equal(report.status, 'INTERRUPTED'); assert.equal(report.reason, 'USER_CANCELLED'); assert.equal(report.observed, null);
  await assert.rejects(m.snapshotSessionEvidence(journal, {signal: controller.signal})); assert.equal(JSON.stringify(journal), before);
});

test('existing full-from-start signal/open, awaiting-emergency and adverse-exit fixtures reconstruct exactly', async () => {
  for (const name of ['signal-open', 'emergency-awaiting-quote', 'emergency-adverse-exit']) {
    const journal = JSON.parse(await readFile('examples/sessions/' + name + '.json', 'utf8'));
    const bundle = await m.snapshotSessionEvidence(journal), artifact = artifactOf(bundle), report = await m.reviewSessionEvidence(artifact);
    assert.deepEqual(bundle.input.events, journal.events); assert.equal(report.status, 'MATCH');
    assert.deepEqual(artifact.projection, m.sessionEvidenceProjection(journal.state));
    assert(Buffer.byteLength(JSON.stringify(bundle.input)) < m.sessionEvidenceLimits.inputBytes);
  }
});
