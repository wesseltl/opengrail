import {boundedStrategyRecord, strategyAuthorReference, strategyDigest, strategyTemplate, type StrategyPublicItem} from './strategy-model';
import {demoTimeframes, type DemoDataset, type DemoSignal} from './demo-model';
import type {SearchPlanAdmission} from './search-protocol';

/** Invented offline snapshots and prices. No registry, provider or participant is contacted. */
export async function syntheticSearchExample(): Promise<{admission: SearchPlanAdmission; testInput: {dataset: DemoDataset; signals: DemoSignal[]}}> {
  const id = (n: number) => 'a2300000-0000-4000-8000-' + String(n).padStart(12, '0');
  const createdAt = '2025-01-01T00:00:00.000Z', step = demoTimeframes['1h'];
  const sources: StrategyPublicItem[] = [];
  for (let n = 0; n < 2; n++) {
    const definition = strategyTemplate('DCA');
    definition.entry = {type: 'DCA', intervalBars: n ? 12 : 1, maxEntries: n ? 2 : 1};
    const {record, payload} = boundedStrategyRecord({version: 1, id: id(10 + n), rootId: id(10 + n), revision: 1, requestId: id(20 + n), createdAt,
      author: {kind: 'HUMAN', id: 'human_' + '0'.repeat(64), sponsorId: 'human_' + '0'.repeat(64)},
      content: {name: n ? 'Synthetic spaced entries' : 'Synthetic single entry', description: 'Invented local example; this strategy and author are not registered.',
        assumptions: 'Invented prices, fixed fills and declared costs. No real demand, provider or market edge is established.',
        falsification: 'Reject any claim that these synthetic outcomes demonstrate real trading performance.', sources: [], definition, relation: null},
      policyAccepted: 'public-strategy-v1', verification: 'UNTESTED', executionEnabled: false});
    sources.push({id: record.id, digest: await strategyDigest(payload), rootId: record.rootId, revision: record.revision, requestId: record.requestId,
      createdAt, author: strategyAuthorReference(record.author), state: 'VISIBLE', reason: null, record, moderation: []});
  }
  const dataset = (test: boolean): DemoDataset => ({version: 1, id: id(test ? 31 : 30), provenance: 'SYNTHETIC',
    rights: {permission: 'CREATED_SYNTHETIC', acknowledged: true, note: 'Invented local monotonic price fixture. No real market data or investment evidence.'},
    symbol: 'BTC/USDT', timeframe: '1h', bars: Array.from({length: 48}, (_, n) => {
      const open = test ? 200 - n : 100 + n, close = test ? open - 1 : open + 1;
      return {closedAt: new Date(Date.parse(createdAt) + (n + (test ? 51 : 1)) * step).toISOString(), open, close,
        high: Math.max(open, close) * 1.001, low: Math.min(open, close) * .999, volume: 1000};
    })});
  const train = dataset(false), test = dataset(true);
  return {admission: {version: 1, id: id(1), createdAt: train.bars.at(-1)!.closedAt, candidates: sources.map((source, n) => ({source, attemptId: id(40 + n), requestId: id(50 + n)})),
    train: {dataset: train, signals: []},
    test: {datasetId: test.id, firstClosedAt: test.bars[0].closedAt, barCount: test.bars.length, gapBars: 2,
      provenance: 'SYNTHETIC', permission: 'CREATED_SYNTHETIC', attemptId: id(60), requestId: id(61)},
    initialCapital: 1000, hypothesis: 'Observe whether a frozen selection retains a subsequent synthetic loss without retuning.',
    falsification: 'Reject this workflow if a loss is hidden, the locked choice changes or the TEST can be replaced.',
    selection: {objective: 'MAX_RETURN_PCT', minTrades: 1, maxDrawdownPct: 5, minReturnPct: 0, tieTolerancePct: .00000001, tieBreak: 'CANDIDATE_ORDER'}},
    testInput: {dataset: test, signals: []}};
}
