import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createHash, randomUUID} from 'node:crypto';

const compiled = await build({entryPoints: ['app/agent-strategy-quickstart.ts'], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false});
const q = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const contracts = await build({stdin: {contents: `export * from './app/strategy-model';export * from './app/experiment-model';export * from './app/demo-model';`, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false});
const m = await import('data:text/javascript;base64,' + Buffer.from(contracts.outputFiles[0].text).toString('base64'));
const routeBuild = await build({stdin: {contents: `import * as route from './app/api/network/strategy-quickstart/route';export default {fetch(request){const handler=route[request.method];return handler?handler(request):new Response(null,{status:405,headers:{Allow:'GET'}});}}`, resolveDir: process.cwd()}, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true});
const worker = new Miniflare({modules: true, script: routeBuild.outputFiles[0].text, compatibilityDate: '2026-05-15'});
after(async () => { await worker.dispose(); });
const spec = q.agentStrategyQuickstartSpec, origin = 'https://synthetic-strategy-quickstart.test';
const sha = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const who = {version: 1, agent: {id: spec.protocol.exampleCommitments.strategyRecord.author.id, name: 'Synthetic onboarding agent', credentialId: '20000000-0000-4000-8000-000000000020', expiresAt: '2030-01-01T00:00:00.000Z', scope: 'PUBLIC_RESEARCH_SUBMIT'}, executionEnabled: false};
const sponsor = 'human_' + '1'.repeat(64), author = {kind: 'AGENT', id: who.agent.id, sponsorId: sponsor, name: who.agent.name};
const consent = {confirmPublicSharing: true}, withReceipt = {...consent, receiptStatus: 200};
const ids = () => ({requestId: randomUUID(), id: randomUUID(), inputRequestId: randomUUID(), datasetId: randomUUID()});
const freshStrategy = () => ({...spec.workflow.strategy.example, requestId: randomUUID(), id: randomUUID()});
function strategyReceipt(pending) {
  const c = pending.command, content = {name: c.name, description: c.description, assumptions: c.assumptions, falsification: c.falsification, sources: c.sources, definition: c.definition, relation: c.relation};
  const {record, payload} = m.boundedStrategyRecord({version: 1, id: c.id, rootId: c.id, revision: 1, requestId: c.requestId, createdAt: '2026-01-01T00:00:00.000Z', author, content, policyAccepted: c.policyAccepted, verification: 'UNTESTED', executionEnabled: false});
  return m.strategyWriteSchema.parse({version: 1, action: 'publish', requestId: c.requestId, item: {id: c.id, digest: createHash('sha256').update(payload).digest('hex'), rootId: c.id, revision: 1, requestId: c.requestId, createdAt: record.createdAt, author: {kind: author.kind, id: author.id, sponsorId: sponsor}, state: 'VISIBLE', reason: null, record, moderation: []}, report: null, executionEnabled: false});
}
function experimentReceipt(pending) {
  const c = pending.command, type = c.action === 'register' ? 'MANIFEST' : 'OUTCOME';
  const content = type === 'MANIFEST' ? {name: c.name, input: c.input, evaluator: c.evaluator, baseline: c.baseline, disclosures: c.disclosures} : {name: c.name, manifest: c.manifest, result: c.result, claim: c.claim};
  const flags = type === 'MANIFEST' ? m.experimentManifestFlags(c.disclosures) : m.experimentOutcomeFlags(author, pending.parent.author, c.claim);
  const {record, payload} = m.boundedExperimentRecord({version: 1, id: c.id, requestId: c.requestId, createdAt: type === 'MANIFEST' ? '2026-01-01T00:01:00.000Z' : '2026-01-01T00:02:00.000Z', author, type, content, flags, policyAccepted: c.policyAccepted, classification: 'AUTHOR_REPORTED', executionEnabled: false});
  return m.experimentWriteSchema.parse({version: 1, action: c.action, requestId: c.requestId, item: {id: c.id, digest: createHash('sha256').update(payload).digest('hex'), type, requestId: c.requestId, createdAt: record.createdAt, author: {kind: author.kind, id: author.id, sponsorId: sponsor}, strategy: {id: pending.source.id, digest: pending.source.digest}, manifest: type === 'MANIFEST' ? null : c.manifest, state: 'VISIBLE', reason: null, suppression: null, reporting: type === 'MANIFEST' ? 'UNREPORTED' : 'AUTHOR_REPORTED', outcomeCount: 0, record, moderation: []}, report: null, executionEnabled: false});
}
async function sequence() {
  const strategy = q.prepareAgentStrategyQuickstartStrategy(freshStrategy(), who, consent), source = strategyReceipt(strategy);
  const manifest = await q.prepareAgentStrategyQuickstartManifest(strategy, source, ids(), withReceipt), parent = experimentReceipt(manifest);
  const outcome = await q.prepareAgentStrategyQuickstartUnavailableOutcome(manifest, parent, source.item, {requestId: randomUUID(), id: randomUUID()}, withReceipt), result = experimentReceipt(outcome);
  return {strategy, source, manifest, parent, outcome, result};
}
function hidden(item, state = 'HIDDEN') {
  return {...item, state, reason: state === 'HIDDEN' ? 'POLICY' : 'AUTHOR_REQUEST', record: null, moderation: [{sequence: 1, requestId: randomUUID(), createdAt: '2026-01-01T00:03:00.000Z', actor: state === 'HIDDEN' ? {kind: 'HUMAN', id: 'human_' + '2'.repeat(64), sponsorId: 'human_' + '2'.repeat(64)} : item.author, state, reason: state === 'HIDDEN' ? 'POLICY' : 'AUTHOR_REQUEST'}]};
}

test('actual anonymous GET endpoint is static, bounded, deeply frozen and independent of identity/storage/evaluators/providers', async () => {
  const r = await worker.dispatchFetch(origin + '/api/network/strategy-quickstart'); assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store'); assert.equal(r.headers.get('Set-Cookie'), null); assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  const body = await r.text(); assert(Buffer.byteLength(body) <= q.agentStrategyQuickstartLimits.responseBytes); assert.deepEqual(JSON.parse(body), spec);
  const decorated = await worker.dispatchFetch(origin + '/api/network/strategy-quickstart', {headers: {Authorization: 'Bearer sentinel-credential', Cookie: 'private=sentinel-owner', 'X-Fixture-Actor': 'sentinel-person'}});
  assert.equal(await decorated.text(), body); assert.equal(decorated.headers.get('Set-Cookie'), null); assert.equal(spec.deployedOrigin, null);
  assert.equal(spec.executionEnabled, false); assert.equal(spec.ordersEnabled, false); assert.equal(spec.hostedAgentCompute, false);
  assert.equal(spec.strategyVerification, 'UNTESTED'); assert.equal(spec.qualification, 'NONE'); assert.equal(spec.independence, 'NOT_ESTABLISHED');
  assert(Object.isFrozen(spec.protocol.canonicalOrders.entry.SIGNAL)); assert(Object.isFrozen(spec.workflow.manifest.example.input.strategy.record));
  for (const dependency of Object.keys(routeBuild.metafile.inputs)) assert(!/\b(?:network-http|strategy-store|experiment-store|network-store|research-store|demo-engine|reference-engine|session-engine|session-journal|experiment-runner|evaluator-comparison|chatgpt-auth|db\/index|hypurring)\b/.test(dependency), dependency);
  assert(!/cloudflare:workers|api\.kraken\.com|await fetch\(/.test(routeBuild.outputFiles[0].text));
});

test('actual machine route rejects query input including empty query and every non-GET method without echoing material', async () => {
  for (const query of ['?token=sentinel-secret', '?id=x', '?x=1&x=2', '?']) { const r = await worker.dispatchFetch(origin + '/api/network/strategy-quickstart' + query); assert.equal(r.status, 400); assert(!/sentinel-secret|token|id=x/.test(await r.text())); }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) { const r = await worker.dispatchFetch(origin + '/api/network/strategy-quickstart', {method}); assert.equal(r.status, 405); assert.equal(r.headers.get('Allow'), 'GET'); }
});

test('complete fixture commands and public canonical commitments satisfy unchanged schemas and exact UTF-8 hashes', async () => {
  assert.deepEqual(m.boundedStrategyCommand(spec.workflow.strategy.example).command, spec.workflow.strategy.example);
  assert.deepEqual(m.boundedExperimentCommand(spec.workflow.manifest.example).command, spec.workflow.manifest.example);
  assert.deepEqual(m.boundedExperimentCommand(spec.workflow.outcome.example).command, spec.workflow.outcome.example);
  const s = spec.protocol.exampleCommitments.strategyRecord, p = spec.protocol.exampleCommitments.manifestRecord;
  assert.equal(sha(s), spec.protocol.exampleCommitments.strategyDigest); assert.equal(sha(p), spec.protocol.exampleCommitments.manifestDigest);
  assert.equal(spec.workflow.manifest.example.input.strategy.digest, sha(s)); assert.equal(spec.workflow.outcome.example.manifest.digest, sha(p));
  assert.deepEqual(Object.keys(s), spec.workflow.strategy.canonicalRecordOrder); assert.deepEqual(Object.keys(p), spec.workflow.manifest.canonicalRecordOrder);
  assert.deepEqual(Object.keys(s.content), spec.workflow.strategy.canonicalContentOrder); assert.deepEqual(Object.keys(p.content), spec.workflow.manifest.canonicalContentOrder);
  const orders = spec.protocol.canonicalOrders;
  for (const [value, order] of [[s.author, orders.agentAuthor], [s.content.definition, orders.definition], [s.content.definition.market, orders.market], [s.content.definition.entry, orders.entry.SIGNAL], [s.content.definition.risk, orders.risk], [s.content.definition.costs, orders.costs], [s.content.definition.execution, orders.execution], [p.content.input, orders.input], [p.content.input.strategy, orders.inputStrategy], [p.content.input.dataset, orders.dataset], [p.content.input.dataset.rights, orders.rights], [p.content.input.dataset.bars[0], orders.bar], [p.content.evaluator, orders.evaluator], [p.content.disclosures, orders.disclosures], [p.content.disclosures.search, orders.search], [p.content.disclosures.validation, orders.validation], [p.content.disclosures.conflicts, orders.conflicts], [p.content.disclosures.publication, orders.publication]]) assert.deepEqual(Object.keys(value), order);
  assert.deepEqual(p.flags, m.experimentManifestFlags(p.content.disclosures)); assert.equal(spec.workflow.outcome.noEvaluationAttempted, true); assert.equal(spec.workflow.outcome.example.result.kind, 'ARTIFACT_UNAVAILABLE'); assert.match(spec.workflow.outcome.example.result.reason, /No evaluation was attempted/);
  assert.deepEqual(spec.workflow.manifest.example.input.signals, []); assert.equal(spec.workflow.manifest.example.input.dataset.provenance, 'SYNTHETIC'); assert.equal(spec.workflow.manifest.example.disclosures.search.logCompleteness, 'UNAVAILABLE'); assert.equal(spec.workflow.manifest.example.disclosures.validation.holdoutPriorAccess, 'SEEN');
  assert.deepEqual(spec.limits.strategy, m.strategyLimits); assert.deepEqual(spec.limits.experiment, m.experimentLimits);
});

test('secret-free reference sequence binds confirmed full canonical receipts with explicit distinct consent and unavailable evidence', async () => {
  const flow = await sequence();
  for (const [pending, receipt] of [[flow.strategy, flow.source], [flow.manifest, flow.parent], [flow.outcome, flow.result]]) {
    assert.deepEqual(await q.validateAgentStrategyQuickstartReceipt(receipt, pending, 200), receipt); assert.equal(pending.body, JSON.stringify(pending.command)); assert(Object.isFrozen(pending)); assert(Object.isFrozen(pending.identity.agent));
    q.validateAgentStrategyQuickstartIdentity(who, pending);
  }
  assert.deepEqual(flow.manifest.command.input.strategy, {record: flow.source.item.record, digest: flow.source.item.digest}); assert.deepEqual(flow.outcome.command.manifest, {id: flow.parent.item.id, digest: flow.parent.item.digest});
  assert.deepEqual(flow.outcome.parent, flow.parent.item); assert.deepEqual(flow.outcome.source, flow.source.item); assert.equal(flow.outcome.sponsorId, sponsor);
  assert.equal(flow.result.item.record.content.result.kind, 'ARTIFACT_UNAVAILABLE'); assert.deepEqual(flow.result.item.record.flags, ['SOURCE_EXECUTION_UNVERIFIED', 'TIMING_UNVERIFIED', 'SAME_AUTHOR', 'SAME_SPONSOR', 'SHARED_DEPENDENCIES']);
  assert.equal(flow.source.item.record.verification, 'UNTESTED'); assert.equal(flow.result.item.record.classification, 'AUTHOR_REPORTED'); assert(!('artifact' in flow.result.item.record.content.result));
});

test('all preparation requires separate explicit consent, strict original commands and fresh canonical distinct IDs', async () => {
  const flow = await sequence();
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy(freshStrategy(), who, {}));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...freshStrategy(), sponsorId: sponsor}, who, consent));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...freshStrategy(), id: who.agent.id}, who, consent));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...freshStrategy(), requestId: randomUUID().toUpperCase()}, who, consent));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...freshStrategy(), id: '90000000-0000-0000-0000-000000000030'}, who, consent));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...freshStrategy(), relation: {type: 'FORK', id: randomUUID(), digest: '0'.repeat(64)}}, who, consent));
  await assert.rejects(q.prepareAgentStrategyQuickstartManifest(flow.strategy, flow.source, ids(), {receiptStatus: 200}));
  const repeated = ids(); repeated.id = repeated.requestId; await assert.rejects(q.prepareAgentStrategyQuickstartManifest(flow.strategy, flow.source, repeated, withReceipt));
  await assert.rejects(q.prepareAgentStrategyQuickstartManifest(flow.strategy, flow.source, {...ids(), extra: true}, withReceipt));
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, flow.source.item, {requestId: randomUUID(), id: randomUUID()}, {receiptStatus: 200}));
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, flow.source.item, {requestId: randomUUID(), id: flow.parent.item.id}, withReceipt));
});

test('retained hidden/withdrawn acknowledgments stay content-free and block new dependent preparation', async () => {
  const flow = await sequence();
  for (const state of ['HIDDEN', 'WITHDRAWN']) {
    const sourceAck = {...flow.source, item: hidden(flow.source.item, state)};
    const checked = await q.validateAgentStrategyQuickstartReceipt(sourceAck, flow.strategy, 200); assert.equal(checked.item.record, null); assert(!JSON.stringify(checked).includes(flow.strategy.command.description));
    await assert.rejects(q.prepareAgentStrategyQuickstartManifest(flow.strategy, sourceAck, ids(), withReceipt));
    await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, sourceAck.item, {requestId: randomUUID(), id: randomUUID()}, withReceipt));
    const parentAck = {...flow.parent, item: hidden(flow.parent.item, state)};
    assert.equal((await q.validateAgentStrategyQuickstartReceipt(parentAck, flow.manifest, 200)).item.record, null);
    await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, parentAck, flow.source.item, {requestId: randomUUID(), id: randomUUID()}, withReceipt));
    const resultAck = {...flow.result, item: hidden(flow.result.item, state)}; const retained = await q.validateAgentStrategyQuickstartReceipt(resultAck, flow.outcome, 200);
    assert.equal(retained.item.record, null); assert(!JSON.stringify(retained).includes(flow.outcome.command.result.reason));
  }
  const suppressed = {...flow.parent, item: {...flow.parent.item, state: 'HIDDEN', suppression: 'SOURCE_UNAVAILABLE', record: null}};
  assert.equal((await q.validateAgentStrategyQuickstartReceipt(suppressed, flow.manifest, 200)).item.record, null);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, suppressed, flow.source.item, {requestId: randomUUID(), id: randomUUID()}, withReceipt));
});

test('wrong status, action, IDs, clocks, digest, canonical content, author, sponsorship and flags cannot reconcile frozen bodies', async () => {
  const flow = await sequence();
  for (const [pending, receipt] of [[flow.strategy, flow.source], [flow.manifest, flow.parent], [flow.outcome, flow.result]]) {
    const body = pending.body;
    for (const status of [0, 201, 204, 400, 401, 409, 503]) await assert.rejects(q.validateAgentStrategyQuickstartReceipt(receipt, pending, status));
    const changes = [r => {r.extra = true;}, r => {r.requestId = randomUUID();}, r => {r.item.requestId = randomUUID();}, r => {r.item.digest = '0'.repeat(64);}, r => {r.item.record.createdAt = r.item.createdAt = '2026-01-01T00:00:00Z';}, r => {r.item.record.author.name = 'Wrong attributable name'; r.item.digest = sha(r.item.record);}, r => {r.item.author.id = r.item.record.author.id = randomUUID(); r.item.digest = sha(r.item.record);}, r => {r.item.record.content.name = 'Other retained content'; r.item.digest = sha(r.item.record);}];
    if (pending.stage !== 'STRATEGY') changes.push(r => {r.item.author.sponsorId = r.item.record.author.sponsorId = 'human_' + '3'.repeat(64); r.item.digest = sha(r.item.record);}, r => {r.item.strategy = {id: randomUUID(), digest: '0'.repeat(64)};}, r => {r.item.record.flags = []; r.item.digest = sha(r.item.record);});
    if (pending.stage === 'OUTCOME') changes.push(r => {r.item.manifest.id = r.item.record.content.manifest.id = randomUUID(); r.item.digest = sha(r.item.record);}, r => {r.item.record.content.result.kind = 'INTERRUPTED'; r.item.digest = sha(r.item.record);});
    for (const change of changes) { const changed = structuredClone(receipt); change(changed); await assert.rejects(q.validateAgentStrategyQuickstartReceipt(changed, pending, 200)); assert.equal(pending.body, body); }
  }
});

test('original agent/credential identity and unresolved normalized body stay immutable after identity or acknowledgment failure', async () => {
  const flow = await sequence(), original = flow.outcome.body;
  for (const replacement of [{id: randomUUID()}, {credentialId: randomUUID()}, {name: 'Another identity'}, {expiresAt: '2031-01-01T00:00:00.000Z'}, {scope: 'ADMIN'}]) assert.throws(() => q.validateAgentStrategyQuickstartIdentity({...who, agent: {...who.agent, ...replacement}}, flow.outcome));
  const reordered = Object.fromEntries(Object.entries(flow.strategy.command).reverse()); const normalized = q.prepareAgentStrategyQuickstartStrategy(reordered, who, consent); assert.equal(normalized.body, flow.strategy.body);
  assert.equal(flow.outcome.body, original); assert.throws(() => {flow.outcome.identity.agent.credentialId = randomUUID();}); assert.throws(() => {flow.outcome.command.result.reason = 'Claimed positive return';});
  await assert.rejects(q.validateAgentStrategyQuickstartReceipt({...flow.result, action: 'register'}, flow.outcome, 200)); assert.equal(flow.outcome.body, original);
});

test('current source requires full canonical exact bytes; another root/fork/version or rehashed changed source cannot be adopted', async () => {
  const flow = await sequence(), targetIds = {requestId: randomUUID(), id: randomUUID()};
  const foreign = structuredClone(flow.source.item); foreign.id = foreign.rootId = foreign.record.id = foreign.record.rootId = randomUUID(); foreign.digest = sha(foreign.record);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, foreign, targetIds, withReceipt));
  const changed = structuredClone(flow.source.item); changed.record.content.description = 'A rehashed changed canonical source'; changed.digest = sha(changed.record);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, changed, targetIds, withReceipt));
  const corrupt = {...flow.source.item, digest: '0'.repeat(64)}; await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, corrupt, targetIds, withReceipt));
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(flow.manifest, flow.parent, {version: 1, item: flow.source.item, executionEnabled: false}, targetIds, withReceipt));
});

test('plain-data and structural/byte guards reject accessors, undefined/symbols, cycles, credentials and excess before preparation', async () => {
  const command = freshStrategy(), getter = {...command}; Object.defineProperty(getter, 'name', {get() {throw Error('Getter must not run.');}, enumerable: true}); assert.throws(() => q.prepareAgentStrategyQuickstartStrategy(getter, who, consent), /Accessors/);
  for (const invalid of [{...command, extra: undefined}, {...command, [Symbol('x')]: true}, {...command, description: 'og_agent_credential-sentinel'}, {...command, definition: {...command.definition, execution: {...command.definition.execution, ordersEnabled: true}}}, {...command, name: 'x'.repeat(33000)}]) assert.throws(() => q.prepareAgentStrategyQuickstartStrategy(invalid, who, consent));
  const cycle = {...command}; cycle.loop = cycle; assert.throws(() => q.prepareAgentStrategyQuickstartStrategy(cycle, who, consent));
  let deep = {}; for (let n = 0; n < 18; n++) deep = {deep}; assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...command, deep}, who, consent), /structure/);
  const flow = await sequence(); await assert.rejects(q.validateAgentStrategyQuickstartReceipt({...flow.result, fill: 'x'.repeat(q.agentStrategyQuickstartLimits.receiptBytes)}, flow.outcome, 200), /byte bound/);
});

test('synthetic local manifest stays aligned to each supported exact strategy timeframe without fetching data', async () => {
  for (const [timeframe, step] of Object.entries(m.demoTimeframes)) {
    const command = freshStrategy(); command.definition = {...command.definition, market: {...command.definition.market, timeframe}};
    const strategy = q.prepareAgentStrategyQuickstartStrategy(command, who, consent), source = strategyReceipt(strategy), manifest = await q.prepareAgentStrategyQuickstartManifest(strategy, source, ids(), withReceipt);
    assert.equal(manifest.command.input.dataset.timeframe, timeframe); assert.equal(manifest.command.input.dataset.provenance, 'SYNTHETIC');
    const times = manifest.command.input.dataset.bars.map(bar => Date.parse(bar.closedAt)); assert(times.every((time, n) => time % step === 0 && (!n || time - times[n - 1] === step)));
    assert.deepEqual(manifest.command.input.signals, []); assert.equal(manifest.command.evaluator.sourceDigest, spec.workflow.manifest.evaluator.sourceDigest);
  }
});

test('new boundary rejects trailing-newline hashes, human IDs, symbols, actors and UUID references without changing old schemas', async () => {
  const flow = await sequence();
  const newlineSponsor = structuredClone(flow.source); newlineSponsor.item.author.sponsorId += '\n'; newlineSponsor.item.record.author.sponsorId += '\n'; newlineSponsor.item.digest = sha(newlineSponsor.item.record);
  // A recomputed digest does not make the malformed first declared sponsorship canonical.
  await assert.rejects(q.validateAgentStrategyQuickstartReceipt(newlineSponsor, flow.strategy, 200));
  const command = freshStrategy(); command.definition = {...command.definition, market: {...command.definition.market, symbol: 'BTC/USDT\n'}}; assert.throws(() => q.prepareAgentStrategyQuickstartStrategy(command, who, consent));
  const mutations = [r => {r.item.digest += '\n';}, r => {r.item.id += '\n';}, r => {r.item.strategy.digest += '\n';}, r => {r.item.strategy.id += '\n';}, r => {r.item.manifest.digest += '\n';}];
  for (const mutate of mutations) { const forged = structuredClone(flow.result); mutate(forged); await assert.rejects(q.validateAgentStrategyQuickstartReceipt(forged, flow.outcome, 200)); }
  const hiddenAck = {...flow.source, item: hidden(flow.source.item)}; hiddenAck.item.moderation[0].actor.id += '\n'; hiddenAck.item.moderation[0].actor.sponsorId += '\n'; await assert.rejects(q.validateAgentStrategyQuickstartReceipt(hiddenAck, flow.strategy, 200));
  assert.throws(() => q.validateAgentStrategyQuickstartIdentity({...who, agent: {...who.agent, expiresAt: '2030-01-01T00:00:00Z'}}, flow.strategy));
});

test('copied pending commands and bodies cannot silently alter stages, selected source, parent or principal', async () => {
  const flow = await sequence();
  const mutations = [p => {p.stage = 'STRATEGY';}, p => {p.parent = null;}, p => {p.sponsorId = 'human_' + '4'.repeat(64);}, p => {p.source.digest = '0'.repeat(64);}, p => {p.parent.digest = '0'.repeat(64);}, p => {p.source.record.content.description = 'Changed held source'; p.source.digest = sha(p.source.record);}, p => {p.parent.record.flags = []; p.parent.digest = sha(p.parent.record);}, p => {p.command.manifest.id = randomUUID(); p.body = JSON.stringify(p.command);}, p => {p.command.result.reason = 'A different copied unavailable reason'; p.body = JSON.stringify(p.command);}];
  for (const mutate of mutations) { const changed = structuredClone(flow.outcome); mutate(changed); await assert.rejects(q.validateAgentStrategyQuickstartReceipt(flow.result, changed, 200)); }
  const alteredManifest = structuredClone(flow.manifest); alteredManifest.command.input.initialCapital = 500; alteredManifest.body = JSON.stringify(alteredManifest.command); await assert.rejects(q.validateAgentStrategyQuickstartReceipt(flow.parent, alteredManifest, 200));
});

test('local public identity schema accepts exactly the existing network identity envelope and canonical order', async () => {
  const b = await build({stdin: {contents: `export {networkIdentitySchema} from './app/network-http';`, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'esm', write: false});
  const actual = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
  for (const candidate of [who, {...who, extra: true}, {...who, agent: {...who.agent, sponsorId: sponsor}}, {...who, agent: {...who.agent, scope: 'ADMIN'}}, {...who, agent: {...who.agent, name: ''}}, {...who, executionEnabled: true}]) {
    const a = actual.networkIdentitySchema.safeParse(candidate), local = q.agentStrategyQuickstartIdentitySchema.safeParse(candidate); assert.equal(local.success, a.success); if (a.success) assert.deepEqual(local.data, a.data);
  }
  assert.deepEqual(Object.keys(q.agentStrategyQuickstartIdentitySchema.parse(who)), ['version', 'agent', 'executionEnabled']); assert.deepEqual(Object.keys(q.agentStrategyQuickstartIdentitySchema.parse(who).agent), spec.identity.response.agentFields);
});
