import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const bundle = await build({stdin: {contents: "export {default as Guide,metadata} from './app/agent-guide/search/page';export * from './app/search-protocol';export {syntheticSearchExample} from './app/search-example';export {networkCapabilities} from './app/network-capabilities';export {renderToStaticMarkup} from 'react-dom/server';", resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'cjs', target: 'es2022', write: false, jsx: 'automatic', loader: {'.css': 'empty'}});
const module = {exports: {}};
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const m = module.exports;
function walk(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => walk(value, predicate)); return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)]; }
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }

test('public guide renders complete actual admission/TEST examples with no network, account or credential intake', async () => {
  const original = globalThis.fetch; let calls = 0, tree;
  try { globalThis.fetch = async () => { calls++; throw Error('No external service authorized.'); }; tree = await m.Guide(); } finally { globalThis.fetch = original; }
  const html = m.renderToStaticMarkup(tree), content = text(tree);
  assert.equal(calls, 0); assert.equal(m.metadata.title, 'Selection before TEST · OpenGrail');
  assert.equal(walk(tree, node => node.type === 'h1').length, 1);
  assert.equal(walk(tree, node => ['input', 'textarea', 'form', 'button', 'script', 'iframe'].includes(node.type)).length, 0);
  assert(!/<details[^>]*\bopen\b/.test(html));
  for (const phrase of ['unregistered', 'AUTHOR_REPORTED', 'qualification NONE', 'NOT_ESTABLISHED', 'NO_SELECTION', 'POST_SELECTED', 'Public API participation does not grant access to the separate private Capital Desk application.', 'page memory', 'No network']) assert(content.includes(phrase), phrase);
  const documents = walk(tree, node => node.type === 'pre').map(text).filter(value => value.trim().startsWith('{')).map(value => JSON.parse(value));
  const admission = documents.find(value => value.candidates), testInput = documents.find(value => value.dataset);
  assert(admission); assert(testInput);
  const plan = await m.createSearchPlan(admission);
  assert.deepEqual(await m.verifySearchPlan(plan), plan);
  assert.deepEqual(plan.admission.test, admission.test);
  for (const key of ['dataset', 'bars', 'signals', 'prices']) assert.equal(key in plan.admission.test, false, 'TEST contains metadata only');
  assert.deepEqual(testInput, (await m.syntheticSearchExample()).testInput);
});

test('the displayed synthetic workflow actually locks TRAIN and keeps its losing TEST without a replacement attempt', async () => {
  const {admission, testInput} = await m.syntheticSearchExample();
  let ledger = await m.createSearchLedger(await m.createSearchPlan(admission));
  for (const [index, candidate] of admission.candidates.entries()) {
    const start = new Date(Date.parse('2025-02-01T00:00:00.000Z') + index * 120000);
    ledger = await m.admitSearchTrain(ledger, candidate.source.id, start.toISOString());
    const outcome = await m.evaluateSearchAttempt(m.pendingSearchAttempt(ledger), {finishedAt: new Date(start.getTime() + 60000).toISOString()});
    ledger = await m.finishSearchAttempt(ledger, outcome);
  }
  ledger = await m.lockSearchSelection(ledger, '2025-02-01T00:04:00.000Z');
  assert.equal(ledger.selection.decision, 'SELECTED'); const selected = ledger.selection.selectedCandidateId;
  ledger = await m.admitSearchTest(ledger, testInput, '2025-02-01T00:05:00.000Z');
  const outcome = await m.evaluateSearchAttempt(m.pendingSearchAttempt(ledger), {finishedAt: '2025-02-01T00:06:00.000Z'});
  ledger = await m.finishSearchAttempt(ledger, outcome);
  assert(outcome.artifact.metrics.netPnl < 0, 'The example must really produce an adverse TEST');
  assert.equal(ledger.selection.selectedCandidateId, selected);
  assert.equal(outcome.comparison.status, 'MATCH');
  await assert.rejects(() => m.admitSearchTest(ledger, testInput, '2025-02-01T00:07:00.000Z'));
  assert.deepEqual(await m.verifySearchLedger(ledger), ledger);
});

test('machine-readable capabilities distinguish local one-shot controls from unseen custody and qualified rankings', () => {
  const spec = m.networkCapabilities(), search = spec.strategySearch;
  assert.equal(search.page, '/search'); assert.equal(search.guide, '/agent-guide/search'); assert.deepEqual(search.limits, m.searchLimits);
  for (const field of ['trainBeforeSelection', 'allCandidateDispositionsRetained', 'separatelySuppliedTest', 'oneTestAdmission']) assert.equal(search[field], true);
  for (const field of ['qualifiedRankings', 'independentCustody', 'completeExternalSearchHistory', 'publicRegistrySubmission', 'hostedCompute', 'newPermissions', 'ordersEnabled', 'liveEnabled']) assert.equal(search[field], false);
  assert.equal(search.browserPersistence, 'PAGE_MEMORY_AND_EXPLICIT_EXPORT'); assert.equal(search.durableCheckpoint, 'SPONSOR_LOCAL_FILE_ONLY');
  assert.equal(search.qualification, 'NONE'); assert.equal(search.unseen, 'NOT_ESTABLISHED'); assert.equal(spec.experimentReviews.qualification, 'NONE'); assert.equal(spec.experiments.rankings, false);
});
