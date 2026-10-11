import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {receiverInstance} from '../scripts/session-receiver-protocol.mjs';
import {loadProducerModules, cleanupProducerModules} from '../scripts/kraken-market-data.mjs';
import {validateSignalContext, parseSuppliedSignal} from '../scripts/supplied-signal-core.mjs';

const bundle = await build({stdin: {contents: `
  export {default as SignalGuide} from './app/signal-guide/page';
  export {syntheticSessionExample} from './app/session-example';
  export {strategyTemplate, strategyDigest} from './app/strategy-model';
  export {renderToStaticMarkup} from 'react-dom/server';
`, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'cjs', target: 'es2022', write: false, jsx: 'automatic', loader: {'.css': 'empty'}});
const module = {exports: {}};
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
let calls = 0, tree, html;
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { calls++; throw Error('Guide rendering must make no delivery.'); };
  tree = api.SignalGuide(); html = api.renderToStaticMarkup(tree);
} finally { globalThis.fetch = originalFetch; }
function walk(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => walk(value, predicate));
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }
const content = text(tree), links = walk(tree, node => node.type === 'a');
after(() => cleanupProducerModules());

test('local signal guide renders accessible closed contracts without credential intake or transport', () => {
  assert.equal(calls, 0);
  assert.equal(walk(tree, node => node.type === 'h1').length, 1);
  const ids = walk(tree, node => node.props?.id).map(node => node.props.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const link of links.filter(node => node.props.href.startsWith('#'))) assert(ids.includes(link.props.href.slice(1)));
  for (const href of ['/', '/session', '/session-methodology', '/agent-guide']) assert(links.some(node => node.props.href === href));
  assert(links.every(node => node.props.href.startsWith('/') || node.props.href.startsWith('#')));
  assert.equal(walk(tree, node => ['form', 'input', 'textarea', 'button', 'iframe', 'script'].includes(node.type)).length, 0);
  const details = walk(tree, node => node.type === 'details');
  assert(details.length >= 4); assert(details.every(node => !node.props.open));
  assert(html.includes('<details')); assert(!/<details[^>]*\bopen\b/.test(html));
  assert(!html.includes('og_local_producer_')); assert(!html.includes('og_agent_'));
});

test('complete rendered synthetic input is accepted by the actual producer contract with original clocks and byte identity', async () => {
  // This proves the documentation contract, not a provider connection or a real delivery.
  const raw = walk(tree, node => node.type === 'pre').map(text).find(value => value.trim().startsWith('{'));
  const supplied = JSON.parse(raw), m = await loadProducerModules();
  const config = structuredClone((await api.syntheticSessionExample()).config);
  config.clockMode = 'SYSTEM_RECEIPT';
  config.strategy.record.content.definition = api.strategyTemplate('SIGNAL');
  config.strategy.record.content.definition.market = {symbol: supplied.symbol, timeframe: supplied.timeframe, direction: 'LONG'};
  config.strategy.record.content.definition.entry = {type: 'SIGNAL', provider: 'CUSTOM', event: 'BULLISH', maxAgeBars: 3};
  config.strategy.digest = await api.strategyDigest(JSON.stringify(config.strategy.record));
  const sha = value => createHash('sha256').update(value).digest('hex');
  const auth = {receiverOrigin: 'http://127.0.0.1:23456', receiverStartedAt: '2026-01-01T09:00:00.000Z', receiverImplementation: {version: 'opengrail-session-v1', ...m.sessionSourceFingerprints}, producerToken: 'og_local_producer_' + sha('INVENTED local guide fixture token'), suppliedSignalUseApproved: true};
  auth.sessionInstance = receiverInstance({config, startedAt: auth.receiverStartedAt, implementation: auth.receiverImplementation});
  const prepared = parseSuppliedSignal(raw, validateSignalContext(config, auth, m), m);
  assert.equal(prepared.event.requestId, supplied.requestId);
  assert.deepEqual(prepared.event.signal, supplied.signal);
  assert.equal(prepared.inputByteDigest, sha(raw));
  assert.equal(prepared.inputBytes, Buffer.byteLength(raw));
  assert.equal(prepared.event.type, 'SIGNAL');
  assert.equal(prepared.event.price, undefined);
  assert.equal(prepared.input.rights.acknowledged, true);
  assert.notEqual(prepared.inputByteDigest, prepared.inputDigest);
});

test('guide states exact local prerequisites, original recovery and unestablished upstream/performance', () => {
  for (const phrase of ['approved access to the private checkout', 'SYSTEM_RECEIPT', 'separate owner and producer credentials', 'sourceAuthentication', 'UNKNOWN', 'qualification', 'NONE', 'AUTHOR_REPORTED', 'strictly later', 'suppliedSignalUseApproved', '120 signals', 'eight delivery attempts', '4096 bytes', '2048 bytes', 'lost previously confirmed receipt', 'does not publish the site or grant access']) assert(content.includes(phrase), phrase);
  assert(content.includes('This guide connects no TradingView or altFINS feed'));
  assert(content.includes('Never make an old signal fresh'));
  assert(content.includes('only an authoritative not-found response for an unconfirmed event'));
  assert(content.includes('Producer exit or EOF causes no liquidation'));
  const commands = walk(tree, node => node.type === 'pre').map(text).find(value => value.startsWith('node ')).split('\n');
  assert.equal(commands.length, 3);
  assert(commands[0].includes('supplied-signal.mjs start '));
  assert(commands[1].includes('supplied-signal.mjs submit '));
  assert(commands[2].includes('supplied-signal.mjs resume '));
  assert(!commands.join(' ').includes('token'));
});
