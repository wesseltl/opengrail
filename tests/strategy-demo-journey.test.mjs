import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Acceptance: fixed TRAIN selects a profitable invented DCA candidate; its sole
// losing TEST stays consumed. The complete handoff preserves that exact strategy,
// capital, costs and risk through a new forward journal, causal entry, an adverse
// exit and the existing reconstructible evidence report. No engine is mocked.
// All prices, source identities and clocks below are invented local fixtures.
// SYSTEM_RECEIPT is the required forward-plan schema, not a claim that these
// authored receipt constants were measured from a provider or running service.
// This is not hosted, browser, human, independent or real-market acceptance.
let m;
before(async () => {
  const bundle = await build({
    stdin: {contents: `
      export * from './app/search-protocol';
      export {syntheticSearchExample} from './app/search-example';
      export {createLockedSearchHandoff, createForwardDemoPlan, verifyForwardDemoPlan} from './app/forward-demo-model';
      export {prepareLocalReceiverConfig} from './app/strategy-handoff';
      export {createSessionJournal, appendSessionEvent, reconstructSessionJournal} from './app/session-journal';
      export {snapshotSessionEvidence, reviewSessionEvidence} from './app/session-evidence';
      export {verifySessionEvidenceBundle} from './app/session-evidence-model';
    `, resolveDir: process.cwd()},
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022',
  });
  m = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
});

const id = n => 'b4500000-0000-4000-8000-' + String(n).padStart(12, '0');
const copy = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10, `${actual} must equal ${expected}`);

test('invented local strategy journey retains positive TRAIN, sole losing TEST and causal adverse forward Demo evidence', async t => {
  const example = await m.syntheticSearchExample();
  let ledger = await m.createSearchLedger(await m.createSearchPlan(example.admission));
  assert.equal(ledger.attempts.length, 0);
  assert.equal(ledger.selection, null);
  for (const candidate of example.admission.candidates) {
    const at = ledger.events.at(-1).at;
    ledger = await m.admitSearchTrain(ledger, candidate.source.id, at);
    ledger = await m.finishSearchAttempt(ledger, await m.evaluateSearchAttempt(m.pendingSearchAttempt(ledger), {finishedAt: at}));
  }
  assert.equal(ledger.attempts.length, 2);
  assert(ledger.attempts.every(attempt => attempt.status === 'EVALUATED' && attempt.artifact.status === 'COMPLETED'));
  assert(ledger.attempts.every(attempt => attempt.comparison.status === 'MATCH'));
  ledger = await m.lockSearchSelection(ledger, ledger.events.at(-1).at);
  assert.equal(ledger.selection.decision, 'SELECTED');
  const locked = copy(ledger.selection);
  const winner = example.admission.candidates.find(candidate => candidate.source.id === locked.selectedCandidateId).source;
  const train = ledger.attempts.find(attempt => attempt.candidateId === winner.id);
  assert(train.artifact.metrics.returnPct > 0);
  assert.equal(winner.record.content.definition.entry.type, 'DCA');

  const testAt = example.testInput.dataset.bars.at(-1).closedAt;
  ledger = await m.admitSearchTest(ledger, example.testInput, testAt);
  ledger = await m.finishSearchAttempt(ledger, await m.evaluateSearchAttempt(m.pendingSearchAttempt(ledger), {finishedAt: testAt}));
  const adverseTest = ledger.attempts.find(attempt => attempt.phase === 'TEST');
  assert.equal(adverseTest.status, 'EVALUATED');
  assert.equal(adverseTest.artifact.status, 'COMPLETED');
  assert.equal(adverseTest.comparison.status, 'MATCH');
  assert(adverseTest.artifact.metrics.returnPct < 0);
  assert(adverseTest.artifact.trades.some(trade => trade.netPnl < 0));
  assert.equal(adverseTest.candidateId, winner.id);
  assert.equal(ledger.attempts.filter(attempt => attempt.phase === 'TEST').length, 1);
  assert.deepEqual(ledger.selection, locked);
  await assert.rejects(m.admitSearchTest(ledger, example.testInput, testAt));
  const originalLedger = JSON.stringify(ledger);

  const handoff = await m.createLockedSearchHandoff(ledger);
  assert.equal(JSON.stringify(handoff.ledger), originalLedger);
  const config = await m.prepareLocalReceiverConfig({
    source: handoff.winner.source, sessionId: id(1), initialCapital: handoff.initialCapital,
    sourceLabel: 'INVENTED forward prices and authored clocks; no provider connected',
    rightsNote: 'Locally invented test observations only; no real market data, provider rights or public publication.',
    confirmRights: true,
  });
  const plan = await m.createForwardDemoPlan({
    handoff, config, preparedAt: '2026-12-31T23:00:00.000Z',
    startsAt: '2027-01-01T00:00:00.000Z', endsAt: '2027-01-01T02:00:00.000Z', pollMs: 15000, cycles: 1,
  });
  assert.deepEqual(await m.verifyForwardDemoPlan(copy(plan)), plan);
  assert.deepEqual(config.strategy, {record: winner.record, digest: winner.digest});
  assert.equal(config.initialCapital, example.admission.initialCapital);
  const definition = config.strategy.record.content.definition;
  assert.deepEqual(definition.risk, handoff.risk);
  assert.deepEqual(definition.costs, handoff.costs);
  assert(definition.costs.feeBps > 0 && definition.costs.slippageBps > 0);

  let journal = await m.createSessionJournal(config, plan.startsAt);
  assert.equal(journal.events.length, 0);
  assert.equal(journal.state.trades.length, 0);
  assert.equal(journal.state.openPositions.length, 0);
  assert.equal(journal.state.account.equity, config.initialCapital);
  const barAt = '2027-01-01T01:00:00.000Z';
  const afterBar = milliseconds => new Date(Date.parse(barAt) + milliseconds).toISOString();
  journal = await m.appendSessionEvent(journal, {
    requestId: id(2), type: 'CLOSED_BAR',
    bar: {closedAt: barAt, open: 100, high: 101, low: 99, close: 100, volume: 1},
  }, barAt);
  assert.equal(journal.state.pending.reason, 'DCA_INTERVAL');
  assert.equal(journal.state.openPositions.length, 0);
  journal = await m.appendSessionEvent(journal, {requestId: id(3), type: 'QUOTE', observedAt: barAt, price: 100}, barAt);
  assert(journal.state.pending);
  assert.equal(journal.state.openPositions.length, 0);
  assert(journal.state.audit.some(row => row.reason === 'AWAITING_FRESH_QUOTE'));
  journal = await m.appendSessionEvent(journal, {requestId: id(4), type: 'QUOTE', observedAt: afterBar(1), price: 100}, afterBar(2));
  assert.equal(journal.state.openPositions.length, 1);
  assert.equal(journal.state.pending, null);
  const position = journal.state.openPositions[0];
  assert(position.entryAt > barAt && position.entryObservedAt > barAt);
  assert.equal(position.entryAt, afterBar(2));
  const fee = definition.costs.feeBps / 10000, slippage = definition.costs.slippageBps / 10000;
  near(position.entryPrice, 100 * (1 + slippage));
  near(position.entryFee, position.collateral * fee);

  journal = await m.appendSessionEvent(journal, {requestId: id(5), type: 'EMERGENCY'}, afterBar(3));
  assert.equal(journal.state.status, 'STOPPING');
  const openEvidence = await m.snapshotSessionEvidence(journal);
  assert.equal(openEvidence.result.kind, 'ARTIFACT');
  assert.equal(openEvidence.result.artifact.projection.openPositions.length, 1);
  assert.equal(openEvidence.result.artifact.projection.trades.length, 0);
  assert.equal((await m.reviewSessionEvidence(openEvidence.result.artifact)).status, 'MATCH');
  journal = await m.appendSessionEvent(journal, {requestId: id(6), type: 'QUOTE', observedAt: afterBar(4), price: 90}, afterBar(5));
  assert.equal(journal.state.status, 'STOPPED');
  assert.equal(journal.events.length, 5);
  assert.equal(journal.state.openPositions.length, 0);
  assert.equal(journal.state.trades.length, 1);
  const trade = journal.state.trades[0];
  assert.equal(trade.reason, 'EMERGENCY_STOP');
  assert.equal(trade.entryPrice, position.entryPrice);
  near(trade.exitPrice, 90 * (1 - slippage));
  assert(trade.entryFee > 0 && trade.exitFee > 0 && trade.netPnl < 0);
  near(trade.exitFee, trade.quantity * trade.exitPrice * fee);
  near(trade.netPnl, trade.grossPnl - trade.entryFee - trade.exitFee);
  near(journal.state.account.totalFees, trade.entryFee + trade.exitFee);
  near(journal.state.account.equity, config.initialCapital + trade.netPnl);

  assert.deepEqual(await m.reconstructSessionJournal(copy(journal)), journal);
  const evidence = await m.snapshotSessionEvidence(journal);
  assert.deepEqual(await m.verifySessionEvidenceBundle(copy(evidence)), evidence);
  assert.equal(evidence.result.kind, 'ARTIFACT');
  const artifact = evidence.result.artifact, review = await m.reviewSessionEvidence(artifact);
  assert.equal(review.status, 'MATCH');
  assert.deepEqual(review.observed, artifact.projection);
  assert.deepEqual(artifact.input.config, config);
  assert.deepEqual(artifact.input.events, journal.events);
  assert.equal(review.observed.trades[0].netPnl, trade.netPnl);
  assert.equal(review.observed.account.equity, journal.state.account.equity);
  assert.equal(review.observed.account.totalFees, journal.state.account.totalFees);
  assert.equal(evidence.classification, 'AUTHOR_REPORTED');
  assert.equal(evidence.qualification, 'NONE');
  assert.equal(evidence.independence, 'NOT_ESTABLISHED');
  assert.equal(review.scope, 'FIXED_LOCAL_RECONSTRUCTION_ONLY');
  assert.equal(evidence.ordersEnabled, false);
  assert.equal(evidence.liveEnabled, false);
  assert.equal(JSON.stringify(plan.handoff.ledger), originalLedger);
  assert.deepEqual(plan.handoff.ledger.attempts.at(-1), adverseTest);

  // Readable values come from the retained reports, without asserting UI or
  // actual participant comprehension. The complete originals stay authoritative.
  t.diagnostic(JSON.stringify({
    inputs: 'INVENTED_LOCAL_ONLY', strategyId: winner.id, strategyDigest: winner.digest,
    trainReturnPct: train.artifact.metrics.returnPct, soleTestReturnPct: adverseTest.artifact.metrics.returnPct,
    initialCapital: config.initialCapital, feeBps: definition.costs.feeBps, slippageBps: definition.costs.slippageBps,
    risk: definition.risk, forwardEvents: journal.events.length, closedTrades: review.observed.trades.length,
    netPnl: trade.netPnl, totalFees: review.observed.account.totalFees, equity: review.observed.account.equity,
    remainingPositions: review.observed.openPositions.length, reconstruction: review.status,
    qualification: evidence.qualification, independence: evidence.independence,
  }));
});
