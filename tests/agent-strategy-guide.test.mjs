import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const result = await build({stdin: {contents: `
  export {default as StrategyGuide, metadata} from './app/agent-guide/strategies/page';
  export {default as ResearchGuide} from './app/agent-guide/page';
  export {agentStrategyQuickstartSpec as spec} from './app/agent-strategy-quickstart';
  export {boundedStrategyCommand, boundedStrategyRecord, strategyDigest} from './app/strategy-model';
  export {boundedExperimentCommand, boundedExperimentRecord, experimentManifestFlags} from './app/experiment-model';
  export {renderToStaticMarkup} from 'react-dom/server';
`, resolveDir: process.cwd(), sourcefile: 'rendered-agent-strategy-guide.ts'}, bundle: true, platform: 'node', format: 'cjs', target: 'es2022', write: false, jsx: 'automatic', loader: {'.css': 'empty'}});
const module = {exports: {}};
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
let networkCalls = 0;
const originalFetch = globalThis.fetch;
let tree, researchTree, html;
try {
  globalThis.fetch = async () => { networkCalls++; throw Error('A readable guide must not call a provider or write.'); };
  tree = api.StrategyGuide(); researchTree = api.ResearchGuide(); html = api.renderToStaticMarkup(tree);
} finally { globalThis.fetch = originalFetch; }
function walk(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => walk(value, predicate));
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }
const content = text(tree), links = walk(tree, node => node.type === 'a');
const code = walk(tree, node => node.type === 'pre').map(text);
const documents = code.filter(value => /^[\[{]/.test(value.trim())).map(value => JSON.parse(value));
const commands = documents.filter(value => value.action);

test('anonymous strategy guide renders a compact semantic workflow and complete closed contracts without any write or credential intake', () => {
  assert.equal(networkCalls, 0);
  assert.equal(api.metadata.title, 'Agent strategy workflow · OpenGrail');
  assert.equal(walk(tree, node => node.type === 'h1').length, 1);
  assert.deepEqual(walk(tree, node => node.type === 'section').map(node => node.props.id), ['identity', 'strategy', 'receipt', 'manifest', 'outcome', 'inspect', 'contracts']);
  const ids = walk(tree, node => node.props?.id).map(node => node.props.id); assert.equal(new Set(ids).size, ids.length);
  for (const link of links.filter(node => node.props.href.startsWith('#'))) assert(ids.includes(link.props.href.slice(1)), link.props.href);
  const overview = walk(tree, node => node.type === 'ol' && node.props['aria-label'] === 'Workflow overview');
  assert.equal(overview.length, 1); assert.equal(walk(overview[0], node => node.type === 'li').length, 5);
  const contracts = walk(tree, node => node.type === 'details'); assert(contracts.length >= 10); assert(contracts.every(node => !node.props.open));
  assert.equal(walk(tree, node => ['form', 'input', 'textarea', 'button', 'iframe', 'script', 'img'].includes(node.type)).length, 0);
  assert(html.includes('<details')); assert(!/<details[^>]*\bopen\b/.test(html));
  assert(html.includes('&lt;credential from your external secret manager&gt;'));
});

test('guide links onboarding, policy and exact-read instruction without fixture targets, private-source access or external origins', () => {
  for (const href of ['/', '/agent-guide', '/#agents', '/strategies', '/experiments', '/api/network/strategy-quickstart', '/strategy-policy', '/experiment-policy']) assert(links.some(node => node.props.href === href), href);
  assert(links.every(node => /^\//.test(node.props.href) || /^#/.test(node.props.href)));
  assert(!links.some(node => /\?|github|token=|20000000-0000/.test(node.props.href)));
  for (const phrase of ['No private repository invitation is needed', 'maintainer-confirmed HTTPS origin', 'hosted acceptance pending', 'no model or paid inference service is required', 'This page never accepts or uses it']) assert(content.includes(phrase), phrase);
  assert(content.includes('/api/strategies/evidence?strategy=<confirmed strategy UUID>&digest=<confirmed strategy digest>'));
  assert(content.includes('/experiments?id=<confirmed record UUID>&digest=<confirmed record digest>'));
});

test('displayed commands and the complete public contract come directly from one shared authority and satisfy actual strict bounded schemas', async () => {
  const {spec} = api;
  assert.equal(commands.length, 3);
  assert.deepEqual(commands, [spec.workflow.strategy.example, spec.workflow.manifest.example, spec.workflow.outcome.example]);
  assert.deepEqual(api.boundedStrategyCommand(commands[0]).command, commands[0]);
  assert.deepEqual(api.boundedExperimentCommand(commands[1]).command, commands[1]);
  assert.deepEqual(api.boundedExperimentCommand(commands[2]).command, commands[2]);
  assert.throws(() => api.boundedStrategyCommand({...commands[0], performance: {returnPct: 100}}));
  assert.throws(() => api.boundedExperimentCommand({...commands[1], sponsorId: 'invented'}));
  assert.throws(() => api.boundedExperimentCommand({...commands[2], result: {...commands[2].result, metrics: {netReturnPct: 10}}}));
  assert(documents.some(value => JSON.stringify(value) === JSON.stringify(spec)), 'whole public contract is present without private documentation');
  for (const name of ['identity', 'receipt', 'retry', 'readback', 'limits', 'errors']) assert(documents.some(value => JSON.stringify(value) === JSON.stringify(spec[name])), name);
  for (const phase of Object.values(spec.workflow)) {
    assert(code.includes('POST ' + phase.path + '\nContent-Type: application/json\nAuthorization: Bearer <credential from your external secret manager>'));
    assert(links.some(node => node.props.href === phase.policy));
    assert(content.includes(phase.canonicalRecordOrder.join(', '))); assert(content.includes(phase.canonicalContentOrder.join(', ')));
  }
  const [strategy, manifest, outcome] = commands;
  const source = api.boundedStrategyRecord(manifest.input.strategy.record);
  assert.equal(source.record.id, strategy.id); assert.equal(source.record.requestId, strategy.requestId);
  assert.equal(source.record.content.name, strategy.name); assert.deepEqual(source.record.content.definition, strategy.definition);
  assert.equal(await api.strategyDigest(source.payload), manifest.input.strategy.digest);
  const manifestRecord = api.boundedExperimentRecord({version: 1, id: manifest.id, requestId: manifest.requestId, createdAt: '2026-01-01T00:01:00.000Z', author: source.record.author, type: 'MANIFEST', content: {name: manifest.name, input: manifest.input, evaluator: manifest.evaluator, baseline: manifest.baseline, disclosures: manifest.disclosures}, flags: api.experimentManifestFlags(manifest.disclosures), policyAccepted: manifest.policyAccepted, classification: 'AUTHOR_REPORTED', executionEnabled: false});
  assert.equal(outcome.manifest.id, manifest.id); assert.equal(await api.strategyDigest(manifestRecord.payload), outcome.manifest.digest);
});

test('the unavailable synthetic example makes no evaluation, interruption, performance, provider or qualification claim', () => {
  const {spec} = api, [strategy, manifest, outcome] = commands;
  assert.equal(manifest.input.dataset.provenance, 'SYNTHETIC'); assert.equal(manifest.input.dataset.rights.permission, 'CREATED_SYNTHETIC');
  assert.equal(manifest.disclosures.validation.holdoutDeclared, false); assert.equal(manifest.disclosures.validation.holdoutPriorAccess, 'SEEN');
  assert.equal(outcome.result.kind, 'ARTIFACT_UNAVAILABLE'); assert.deepEqual(Object.keys(outcome.result), ['kind', 'reason']);
  assert.equal(outcome.claim.type, 'ORIGINAL'); assert.equal(outcome.claim.relation, null);
  assert.equal(strategy.definition.execution.mode, 'DEMO'); assert.equal(strategy.definition.execution.leverage, 1); assert.equal(strategy.definition.execution.ordersEnabled, false);
  assert.equal(spec.strategyVerification, 'UNTESTED'); assert.equal(spec.classification, 'AUTHOR_REPORTED'); assert.equal(spec.qualification, 'NONE'); assert.equal(spec.independence, 'NOT_ESTABLISHED');
  assert.equal(spec.executionEnabled, false); assert.equal(spec.ordersEnabled, false); assert.equal(spec.hostedAgentCompute, false);
  for (const phrase of ['No evaluation was attempted', 'neither an interrupted run nor a successful experiment', 'No artifact, measured return or profitable strategy is claimed', 'No real signal feed', 'planned author declarations', 'Publishing does not run its rules', 'Keep adverse and unavailable entries', 'Live orders stay disabled']) assert(content.includes(phrase), phrase);
});

test('complete public protocol renders nested canonical orders, strict lifecycle and flag contracts while bounding this onboarding interpretation', () => {
  const displayed = documents.find(value => value.kind === 'AGENT_STRATEGY_QUICKSTART');
  assert(displayed?.protocol);
  const {protocol} = displayed;
  for (const family of ['TREND', 'RSI', 'BREAKOUT', 'DCA', 'GRID', 'SIGNAL', 'RULES']) assert(Array.isArray(protocol.canonicalOrders.entry[family]), family);
  assert.deepEqual(protocol.canonicalOrders.agentAuthor, ['kind', 'id', 'sponsorId', 'name']);
  assert.deepEqual(protocol.canonicalOrders.inputStrategy, ['record', 'digest']);
  assert.deepEqual(protocol.canonicalOrders.unavailableResult, ['kind', 'reason']);
  assert(protocol.strategyPublicItem.fields.includes('moderation')); assert(protocol.experimentPublicItem.fields.includes('suppression'));
  assert(protocol.lifecycle.history.includes('WITHDRAWN is terminal'));
  assert(protocol.flagRules.manifest.appendInOrder.some(item => item.flag === 'NO_HOLDOUT'));
  assert(protocol.flagRules.outcome.appendInOrder.some(item => item.flag === 'SAME_SPONSOR'));
  assert.equal(protocol.evidencePage.maximumItems, 20); assert.equal(protocol.evidencePage.constants.qualification, 'NONE');
  assert(protocol.evidencePage.otherKinds.includes('no full batch/continuous artifact parser'));
  assert(content.includes('other batch or continuous artifacts require their separate method contracts before interpretation'));
  const protocolLink = links.find(node => node.props.href === '#contracts' && text(node) === 'complete public protocol'); assert(protocolLink);
  assert.deepEqual(protocol.exampleCommitments.strategyRecord, commands[1].input.strategy.record);
  assert.equal(protocol.exampleCommitments.manifestDigest, commands[2].manifest.digest);
});

test('guide requires explicit phase consent, frozen identity, complete canonical correlation and safe suppression before dependent writes', () => {
  for (const phrase of ['explicitly accept it before this write', 'explicitly accept publication of these exact inputs', 'deliberately accept the experiment policy again', 'serialized UTF-8 body and requestId', 'original agent/credential principal', 'do not edit it, replace its IDs, switch credentials or start the next phase', 'Stop if identity changes, expires or is revoked', 'unique JSON keys', 'complete frozen content', 'Compute lowercase SHA-256', 'full visible canonical record and digest', 'never substitute its latest revision or a fork', 'record: null', 'cannot prepare a new dependent manifest or outcome', 'do not restore names, inputs, artifacts or results from an older response', 'no automatic reset or pruning']) assert(content.includes(phrase), phrase);
  assert(code.some(value => value.includes('record: confirmedStrategyReceipt.item.record') && value.includes('digest: confirmedStrategyReceipt.item.digest')));
  assert(code.some(value => value.includes('id: confirmedManifestReceipt.item.id') && value.includes('digest: confirmedManifestReceipt.item.digest')));
  assert(content.includes('Fixture IDs, authors, timestamps and digests below are invented examples, never live targets'));
  assert(content.includes('A digest') || content.includes('The digest identifies content'));
  assert(content.includes('qualification NONE') || content.includes('qualification  NONE'));
});

test('guide remains a server-rendered read-only document with existing responsive and keyboard behavior', () => {
  const source = readFileSync('app/agent-guide/strategies/page.tsx', 'utf8');
  assert(!/['"]use client|\bfetch\s*\(|localStorage|sessionStorage|process\.env|cookies\(|useEffect|clipboard|dangerouslySetInnerHTML|onClick|onSubmit/.test(source));
  assert(source.includes("import '../agent-guide.css'")); assert(source.includes("import './strategy-guide.css'"));
  const sharedCss = readFileSync('app/agent-guide/agent-guide.css', 'utf8'), css = readFileSync('app/agent-guide/strategies/strategy-guide.css', 'utf8');
  assert(sharedCss.includes('focus-visible')); assert(sharedCss.includes('prefers-reduced-motion')); assert(css.includes('max-width:760px')); assert(css.includes('flex-wrap:wrap'));
});

test('existing research guide adds strategy discovery while retaining its original research and withdrawal commands', () => {
  const researchLinks = walk(researchTree, node => node.type === 'a');
  assert.equal(researchLinks.filter(node => node.props.href === '/agent-guide/strategies').length, 1);
  assert(researchLinks.some(node => node.props.href === '/api/network/quickstart'));
  assert.deepEqual(walk(researchTree, node => node.type === 'section').map(node => node.props.id), ['sponsor', 'identity', 'publish', 'receipt', 'withdraw', 'limits']);
  const researchCommands = walk(researchTree, node => node.type === 'pre').map(text).filter(value => value.trim().startsWith('{')).map(value => JSON.parse(value));
  assert.equal(researchCommands.length, 2); assert.equal(researchCommands[0].action, 'publish'); assert.equal(researchCommands[0].kind, 'HYPOTHESIS'); assert.equal(researchCommands[1].action, 'withdraw'); assert.equal(researchCommands[1].id, researchCommands[0].id);
});
