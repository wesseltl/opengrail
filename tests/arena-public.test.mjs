import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

// Actual fixed schemas, hashes and retained synthetic inputs over mocked public
// HTTP responses. No provider, identity grant, hosted execution or qualification.
let reader, experiment, strategy, review, replayDemo, compareDemoArtifact, journal, snapshotSessionEvidence, pureInputs;
const originalFetch = globalThis.fetch, uid = () => crypto.randomUUID(), ref = value => ({id: value.id, digest: value.digest}), clone = value => structuredClone(value);
const at = '2026-10-11T12:00:00.000Z', human = n => ({kind: 'HUMAN', id: 'human_' + String(n).repeat(64), sponsorId: 'human_' + String(n).repeat(64)});
before(async () => {
  const pure = await build({entryPoints: ['app/arena-public.ts'], bundle: true, write: false, metafile: true, format: 'esm', platform: 'node', target: 'es2022'}); pureInputs = Object.keys(pure.metafile.inputs);
  const result = await build({stdin: {contents: "import * as reader from './app/arena-public';import * as experiment from './app/experiment-model';import * as strategy from './app/strategy-model';import * as review from './app/experiment-review-model';import {replayDemo} from './app/demo-engine';import {compareDemoArtifact} from './app/evaluator-comparison';import * as journal from './app/session-journal';import {snapshotSessionEvidence} from './app/session-evidence';export {reader,experiment,strategy,review,replayDemo,compareDemoArtifact,journal,snapshotSessionEvidence};", resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
  ({reader, experiment, strategy, review, replayDemo, compareDemoArtifact, journal, snapshotSessionEvidence} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')));
});
after(() => {globalThis.fetch = originalFetch;});
async function projected(record, source, parent = null) {
  const canonical = experiment.boundedExperimentRecord(record);
  return {id: record.id, digest: await experiment.experimentDigest(canonical.payload), type: record.type, requestId: record.requestId, createdAt: record.createdAt, author: record.author, strategy: ref(source), manifest: parent ? ref(parent) : null, state: 'VISIBLE', reason: null, suppression: null, reporting: 'AUTHOR_REPORTED', outcomeCount: record.type === 'MANIFEST' ? 2 : 0, record: canonical.record, moderation: []};
}
async function fixture({kind = 'ARTIFACT', continuous = false} = {}) {
  const input = JSON.parse(readFileSync('examples/experiments/signal-input.json', 'utf8')), record = input.strategy.record;
  Object.assign(record, {id: uid(), requestId: uid(), createdAt: '2026-10-11T08:00:00.000Z', author: human(1), revision: 1}); record.rootId = record.id; record.content.relation = null;
  const source = {id: record.id, digest: await strategy.strategyDigest(strategy.boundedStrategyRecord(record).payload), rootId: record.id, revision: 1, requestId: record.requestId, createdAt: record.createdAt, author: record.author, state: 'VISIBLE', reason: null, record: strategy.boundedStrategyRecord(record).record, moderation: []};
  input.strategy = {record: source.record, digest: source.digest}; input.requestId = uid();
  let defaults, artifact;
  if (continuous) {
    const config = {version: 1, sessionId: uid(), methodVersion: 'opengrail-session-v1', clockMode: 'SYNTHETIC_PLAYBACK', origin: 'PUBLIC_STRATEGY', strategy: input.strategy, initialCapital: 1000, provenance: 'SYNTHETIC', rights: {permission: 'CREATED_SYNTHETIC', acknowledged: true, note: 'Invented public arena input.'}, sourceLabel: 'Synthetic arena observations', ordersEnabled: false, liveEnabled: false};
    const tape = await journal.createSessionJournal(config, '2026-10-11T08:30:00.000Z'), bundle = await snapshotSessionEvidence(tape); assert.equal(bundle.result.kind, 'ARTIFACT'); artifact = bundle.result.artifact; defaults = experiment.experimentContinuousRegisterDefaults(bundle.input, 'Invented arena checkpoint');
  } else {artifact = await replayDemo(input); defaults = experiment.experimentRegisterDefaults(input);}
  defaults.disclosures.search = {trialCount: 1, selection: 'FIRST_DECLARED', logCompleteness: 'COMPLETE', log: 'Invented one-attempt synthetic history.'};
  defaults.disclosures.validation = {trainEvaluationOverlap: 'NONE', holdoutDeclared: true, holdoutPriorAccess: 'UNSEEN', holdoutReuseCount: 0, note: 'Synthetic disclosure; independence is not established.'};
  const manifest = await projected({version: continuous ? 2 : 1, id: uid(), requestId: uid(), createdAt: '2026-10-11T09:00:00.000Z', author: human(2), type: 'MANIFEST', content: defaults, flags: experiment.experimentManifestFlags(defaults.disclosures), policyAccepted: 'public-experiment-v1', classification: 'AUTHOR_REPORTED', executionEnabled: false}, source);
  const result = kind === 'ARTIFACT' ? {kind, artifact} : {kind, reason: 'Synthetic retained adverse disposition.'};
  const outcome = async (author, claim, createdAt) => projected({version: continuous ? 2 : 1, id: uid(), requestId: uid(), createdAt, author, type: 'OUTCOME', content: {...continuous ? {method: 'CONTINUOUS_DEMO'} : {}, name: 'Invented retained arena outcome', manifest: ref(manifest), result, claim}, flags: experiment.experimentOutcomeFlags(author, manifest.author, claim), policyAccepted: 'public-experiment-v1', classification: 'AUTHOR_REPORTED', executionEnabled: false}, source, manifest);
  const original = await outcome(human(3), {type: 'ORIGINAL', relation: null, sharedDependencies: [], conflicts: ''}, '2026-10-11T09:01:00.000Z');
  const reproduction = await outcome(human(4), {type: 'REPRODUCTION', relation: {type: 'SUPPORTS', ...ref(original)}, sharedDependencies: [], conflicts: ''}, '2026-10-11T09:02:00.000Z');
  return {source, manifest, original, reproduction, artifact, reviews: []};
}
async function addReview(f, {decision = 'HELD', hidden = false, continuous = false} = {}) {
  const sequence = f.reviews.length + 1, prior = f.reviews.at(-1), evidence = decision === 'REPRODUCED' ? {original: await compareDemoArtifact(f.artifact), reproduction: await compareDemoArtifact(f.artifact)} : null;
  const content = {target: {original: ref(f.original), reproduction: ref(f.reproduction), manifest: ref(f.manifest), strategy: ref(f.source)}, previous: prior ? ref(prior) : null, decision, reasons: [continuous ? 'UNSUPPORTED_METHOD' : decision === 'REPRODUCED' ? 'COMPUTATION_MATCH' : 'INCOMPLETE_EVIDENCE'], evidence, attestations: {fixedCode: decision === 'REPRODUCED', exactInputs: decision === 'REPRODUCED', inspectedDifferences: decision === 'REPRODUCED', separateOriginalAndReproductionProcesses: decision === 'REPRODUCED'}, sharedDependencies: [...review.experimentReviewSharedDependencies], otherConflicts: '', note: 'Invented retained review ' + sequence};
  const record = review.boundedExperimentReviewRecord({version: 1, id: uid(), requestId: uid(), createdAt: new Date(Date.parse(at) + sequence).toISOString(), author: human(5), sequence, content, policyAccepted: 'public-experiment-review-v1', classification: 'REVIEW_ATTESTATION', executionAssurance: 'TRUSTED_HUMAN_ATTESTATION', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false}).record;
  const item = {id: record.id, digest: await strategy.strategyDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: record.createdAt, author: record.author, sequence, target: content.target, previous: content.previous, state: 'VISIBLE', reason: null, suppression: null, decision, record, moderation: []};
  if (hidden) Object.assign(item, {state: 'HIDDEN', decision: null, record: null, reason: 'POLICY', moderation: [{sequence: 1, requestId: uid(), createdAt: new Date(Date.parse(at) + sequence + 100).toISOString(), actor: human(5), state: 'HIDDEN', reason: 'POLICY'}]});
  f.reviews.push(item); return item;
}
function summarize(item) {const {record, moderation, ...metadata} = item; return {...metadata, reasons: record?.content.reasons ?? []};}
function response(body) {return body instanceof Response ? body : new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json'}});}
function server(f, fault = () => undefined) {
  const calls = [], counts = new Map();
  globalThis.fetch = async (path, options) => {
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'same-origin'); assert(options.signal);
    assert(!options.method || options.method === 'GET'); assert(/^\/api\/(?:experiments(?:\/reviews)?|strategies)\?/.test(path));
    calls.push(path); const count = (counts.get(path) ?? 0) + 1; counts.set(path, count);
    const url = new URL(path, 'https://synthetic.invalid'), params = url.searchParams; let body;
    if (url.pathname === '/api/strategies') body = {version: 1, item: f.source, executionEnabled: false};
    else if (url.pathname === '/api/experiments') {const item = [f.original, f.reproduction, f.manifest].find(item => item.id === params.get('id')); assert(item, path); body = {version: 1, item, executionEnabled: false};}
    else if (params.has('id')) {const item = f.reviews.find(item => item.id === params.get('id')); assert(item, path); body = {version: 1, item, executionEnabled: false};}
    else {
      assert.equal(params.get('outcome'), f.original.id); assert.equal(params.get('digest'), f.original.digest);
      const ordered = [...f.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), cursor = params.get('cursor'), start = cursor ? ordered.findIndex(item => item.id === cursor) + 1 : 0, selected = ordered.slice(start, start + 20), head = f.reviews.at(-1);
      body = {version: 1, target: ref(f.original), currentHead: head ? {...ref(head), sequence: head.sequence} : null, items: selected.map(summarize), nextCursor: ordered.length > start + selected.length ? selected.at(-1).id : null, executionEnabled: false};
    }
    return response(await fault({path, url, count, calls, body: clone(body)}) ?? body);
  };
  return {calls, counts};
}
const read = (f, item = f.original, controller = new AbortController()) => reader.readArenaMember(ref(item), controller.signal);
const unavailable = (scope, suppressed = false) => error => error instanceof reader.ArenaPublicUnavailable && error.scope === scope && error.suppressed === suppressed;

test('public reader imports no evaluator, provider adapter, runner or server repository', () => {
  assert(!pureInputs.some(path => /(?:demo-engine|reference-engine|session-engine|session-journal|evaluator-comparison|arena-engine|arena-model|store)\.(?:ts|mjs)$/.test(path)), pureInputs.join('\n'));
});
test('negative artifact binds exact input/source and returns a stable fresh snapshot without qualification', async () => {
  const f = await fixture(), seen = server(f), value = await read(f); assert(f.artifact.metrics.netPnl < 0);
  assert.deepEqual(value.outcome, f.original); assert.deepEqual(value.manifest, f.manifest); assert.deepEqual(value.strategy, f.source); assert.deepEqual(value.reviewContext, {original: ref(f.original), originalItem: f.original, items: [], currentHead: null, dependencies: [], lifecycle: []});
  assert.equal(seen.counts.get('/api/experiments?id=' + f.original.id), 3); assert.equal(seen.counts.get('/api/strategies?id=' + f.source.id), 3);
  assert(reader.sameArenaPublicMember(value, clone(value))); const changed = clone(value); changed.manifest.outcomeCount++; assert(!reader.sameArenaPublicMember(value, changed));
});
test('reproduction resolves its exact original and retains latest adverse review after earlier reproduction', async () => {
  const f = await fixture(); await addReview(f, {decision: 'REPRODUCED'}); const head = await addReview(f); server(f);
  const value = await read(f, f.reproduction); assert.deepEqual(value.reviewContext.original, ref(f.original)); assert.equal(value.reviewContext.items.length, 2); assert.equal(value.reviewContext.currentHead.id, head.id); assert.equal(value.reviewContext.currentHead.decision, 'HELD'); assert(value.reviewContext.items.some(item => item.decision === 'REPRODUCED'));
});
test('all 32 retained reviews cross two pages and preserve hidden latest head with no positive fallback', async () => {
  const f = await fixture(); for (let n = 0; n < 32; n++) await addReview(f, {hidden: n === 31}); const seen = server(f), value = await read(f);
  assert.equal(value.reviewContext.items.length, 32); assert.equal(value.reviewContext.currentHead.sequence, 32); assert.equal(value.reviewContext.currentHead.state, 'HIDDEN'); assert.equal(value.reviewContext.currentHead.record, null); assert.equal(value.reviewContext.currentHead.decision, null); assert(value.reviewContext.items.some(item => item.state === 'HIDDEN' && item.reasons.length === 0)); assert(seen.calls.some(path => path.includes('&cursor=')));
  assert.equal(value.reviewContext.lifecycle.length, 32); assert.deepEqual(value.reviewContext.lifecycle.find(item => item.id === f.reviews.at(-1).id).moderation, f.reviews.at(-1).moderation); assert(value.reviewContext.lifecycle.every(item => !('record' in item)));
});
test('interruptions, unavailable artifacts and unsupported continuous evidence remain members', async () => {
  for (const kind of ['INTERRUPTED', 'ARTIFACT_UNAVAILABLE']) {const f = await fixture({kind}); server(f); assert.equal((await read(f)).outcome.record.content.result.kind, kind);}
  const f = await fixture({continuous: true}); await addReview(f, {continuous: true}); server(f); const value = await read(f); assert.equal(value.outcome.record.version, 2); assert.deepEqual(value.reviewContext.currentHead.record.content.reasons, ['UNSUPPORTED_METHOD']);
});
test('duplicate fields, unknown fields, malformed UTF8 and oversized streamed envelopes fail closed', async () => {
  for (const kind of ['duplicate', 'unknown', 'utf8', 'oversized']) {
    const f = await fixture(); server(f, ({url, body}) => {
      if (url.pathname !== '/api/experiments' || url.searchParams.get('id') !== f.original.id) return;
      if (kind === 'duplicate') return new Response(JSON.stringify(body).replace('"version":1', '"version":1,"version":1'), {headers: {'Content-Type': 'application/json'}});
      if (kind === 'unknown') return {...body, independent: true};
      if (kind === 'utf8') return new Response(new Uint8Array([0xff]), {headers: {'Content-Type': 'application/json'}});
      return new Response(' '.repeat(reader.arenaPublicReadLimits.experimentBytes + 1), {headers: {'Content-Type': 'application/json'}});
    }); await assert.rejects(() => read(f), unavailable('OUTCOME'));
  }
});
test('redirects, wrong content types, unsuccessful responses and forged declared sizes are refused', async () => {
  for (const kind of ['type', 'status', 'length', 'redirect']) {const f = await fixture(); server(f, ({body}) => {
    if (kind === 'type') return new Response(JSON.stringify(body), {headers: {'Content-Type': 'text/plain'}});
    if (kind === 'status') return new Response('{}', {status: 503, headers: {'Content-Type': 'application/json'}});
    if (kind === 'length') return new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json', 'Content-Length': '999999999'}});
    const value = response(body); Object.defineProperty(value, 'redirected', {value: true}); return value;
  }); await assert.rejects(() => read(f), unavailable('OUTCOME'));}
});
test('forged record digests and cross-manifest artifact input substitutions are rejected', async () => {
  for (const kind of ['digest', 'parent-input', 'flags', 'source']) {
    const f = await fixture(); server(f, async ({url, body}) => {
      const id = url.searchParams.get('id');
      if (kind === 'digest' && id === f.original.id) {body.item.record.content.name = 'Unhashed replacement'; return body;}
      if (kind === 'flags' && id === f.original.id) {body.item.record.flags.push('SAME_SPONSOR'); body.item.digest = await experiment.experimentDigest(JSON.stringify(body.item.record)); f.original.digest = body.item.digest; return body;}
      if (kind === 'source' && url.pathname === '/api/strategies') {body.item.record.content.name = 'Unhashed strategy'; return body;}
      if (kind === 'parent-input' && id === f.manifest.id) {body.item.record.content.input.initialCapital += 10; body.item.digest = await experiment.experimentDigest(JSON.stringify(body.item.record)); return body;}
    }); await assert.rejects(() => read(f), error => error instanceof reader.ArenaPublicUnavailable);
  }
});
test('self-hashed canonical outcomes still require exact parent input and recomputed concern flags', async () => {
  const f = await fixture(); f.manifest.record.content.input.initialCapital += 10; f.manifest.digest = await experiment.experimentDigest(experiment.boundedExperimentRecord(f.manifest.record).payload);
  f.original.manifest = ref(f.manifest); f.original.record.content.manifest = ref(f.manifest); f.original.digest = await experiment.experimentDigest(experiment.boundedExperimentRecord(f.original.record).payload);
  await experiment.validateExperimentItem(f.manifest); await experiment.validateExperimentItem(f.original); server(f); await assert.rejects(() => read(f), unavailable('OUTCOME'));
  const g = await fixture(); g.original.record.flags.push('SAME_SPONSOR'); g.original.digest = await experiment.experimentDigest(experiment.boundedExperimentRecord(g.original.record).payload);
  await experiment.validateExperimentItem(g.original); server(g); await assert.rejects(() => read(g), unavailable('OUTCOME'));
});
test('observed outcome, original, manifest and source suppression carry precise scopes for clearing', async () => {
  for (const scope of ['OUTCOME', 'ORIGINAL', 'MANIFEST', 'STRATEGY']) {
    const f = await fixture(); server(f, ({url, count, body}) => {
      const target = scope === 'OUTCOME' ? f.reproduction : scope === 'ORIGINAL' ? f.original : scope === 'MANIFEST' ? f.manifest : f.source;
      if (url.searchParams.get('id') !== target.id || count !== 2) return;
      if (scope === 'STRATEGY') Object.assign(body.item, {state: 'HIDDEN', record: null, reason: 'POLICY', moderation: [{sequence: 1, requestId: uid(), createdAt: at, actor: human(5), state: 'HIDDEN', reason: 'POLICY'}]});
      else Object.assign(body.item, {state: 'HIDDEN', record: null, suppression: 'SOURCE_UNAVAILABLE'});
      return body;
    }); await assert.rejects(() => read(f, f.reproduction), error => unavailable(scope, true)(error) && error.resourceKind === (scope === 'STRATEGY' ? 'STRATEGY' : 'EXPERIMENT'));
  }
});
test('new review head or same-head moderation change between complete passes invalidates the snapshot', async () => {
  for (const kind of ['append', 'hide']) {
    const f = await fixture(); await addReview(f); server(f, async ({url, count, body}) => {
      if (url.pathname !== '/api/experiments/reviews' || !url.searchParams.has('outcome') || count !== 2) return;
      if (kind === 'append') await addReview(f); else {const item = f.reviews[0]; Object.assign(item, {state: 'HIDDEN', record: null, decision: null, reason: 'POLICY', moderation: [{sequence: 1, requestId: uid(), createdAt: new Date(Date.parse(at) + 100).toISOString(), actor: human(5), state: 'HIDDEN', reason: 'POLICY'}]});}
      const head = f.reviews.at(-1); return {...body, currentHead: {...ref(head), sequence: head.sequence}, items: [...f.reviews].reverse().map(summarize)};
    }); await assert.rejects(() => read(f), unavailable('REVIEWS', kind === 'hide'));
  }
});
test('incomplete, duplicated, forged or cross-target review histories cannot be accepted', async () => {
  for (const kind of ['missing', 'duplicate', 'head', 'digest', 'target', 'previous']) {
    const f = await fixture(); await addReview(f); await addReview(f); server(f, ({url, body}) => {
      if (url.pathname !== '/api/experiments/reviews') return;
      if (url.searchParams.has('outcome')) {
        if (kind === 'missing') body.items.pop();
        if (kind === 'duplicate') body.items.push(clone(body.items[0]));
        if (kind === 'head') body.currentHead.id = uid();
        if (kind === 'target') body.items[0].target.manifest.digest = 'f'.repeat(64);
        return body;
      }
      if (kind === 'digest') body.item.record.content.note = 'Unhashed changed review';
      if (kind === 'previous') body.item.previous = {...body.item.previous, digest: 'f'.repeat(64)};
      return body;
    }); await assert.rejects(() => read(f), unavailable('REVIEWS'));
  }
});
test('cross-page head changes, backwards ordering and foreign cursors are rejected', async () => {
  for (const kind of ['head', 'order', 'cursor']) {
    const f = await fixture(); for (let n = 0; n < 21; n++) await addReview(f); server(f, ({url, body}) => {
      if (!url.searchParams.has('cursor')) return;
      if (kind === 'head') body.currentHead.digest = 'f'.repeat(64);
      if (kind === 'order') body.items[0] = summarize(f.reviews.at(-1));
      if (kind === 'cursor') body.nextCursor = url.searchParams.get('cursor'); return body;
    }); await assert.rejects(() => read(f), unavailable('REVIEWS'));
  }
});
test('unrelated original and changed peer visibility cannot create a reviewable substitute', async () => {
  const f = await fixture(); f.original.record.content.claim = {type: 'REPRODUCTION', relation: {type: 'SUPPORTS', id: uid(), digest: 'f'.repeat(64)}, sharedDependencies: [], conflicts: ''}; f.original.digest = await experiment.experimentDigest(JSON.stringify(f.original.record)); f.reproduction.record.content.claim.relation = {type: 'SUPPORTS', ...ref(f.original)}; f.reproduction.digest = await experiment.experimentDigest(JSON.stringify(f.reproduction.record)); server(f); await assert.rejects(() => read(f, f.reproduction), unavailable('ORIGINAL'));
  const g = await fixture(); await addReview(g); server(g, ({url, body}) => {if (url.pathname === '/api/experiments' && url.searchParams.get('id') === g.reproduction.id) return {...body, item: {...body.item, state: 'HIDDEN', record: null, suppression: 'PARENT_UNAVAILABLE'}};}); await assert.rejects(() => read(g), error => unavailable('REVIEWS', true)(error) && error.reference.id === g.reproduction.id && error.resourceKind === 'EXPERIMENT');
});
test('abort stops the same read and never returns a partially populated member', async () => {
  const f = await fixture(), controller = new AbortController(); server(f, () => {controller.abort();}); await assert.rejects(() => read(f, f.original, controller), unavailable('NETWORK'));
  server(f); await assert.rejects(() => reader.readArenaMember({id: f.original.id, digest: 'bad'}, new AbortController().signal), unavailable('OUTCOME'));
});
test('final source and non-head lifecycle fences observe late suppression after expensive verification', async () => {
  const f = await fixture(); server(f, ({url, count, body}) => {
    if (url.pathname === '/api/strategies' && count === 3) return {...body, item: {...body.item, state: 'HIDDEN', record: null, reason: 'POLICY', moderation: [{sequence: 1, requestId: uid(), createdAt: at, actor: human(5), state: 'HIDDEN', reason: 'POLICY'}]}};
  }); await assert.rejects(() => read(f), unavailable('STRATEGY', true));
  const g = await fixture(); const historical = await addReview(g); await addReview(g); server(g, ({url, count, body}) => {
    if (url.pathname === '/api/experiments/reviews' && url.searchParams.get('id') === historical.id && count === 3) return {...body, item: {...body.item, state: 'HIDDEN', record: null, decision: null, reason: 'POLICY', moderation: [{sequence: 1, requestId: uid(), createdAt: new Date(Date.parse(at) + 100).toISOString(), actor: human(5), state: 'HIDDEN', reason: 'POLICY'}]}};
  }); await assert.rejects(() => read(g), unavailable('REVIEWS', true));
  for (const kind of ['head', 'history']) {
    const h = await fixture(); await addReview(h); await addReview(h); const affected = kind === 'head' ? h.reviews.at(-1) : h.reviews[0];
    server(h, ({url, count, body}) => {
      if (url.pathname !== '/api/experiments/reviews' || !url.searchParams.has('outcome') || count !== 3) return;
      const row = body.items.find(item => item.id === affected.id); Object.assign(row, {state: 'HIDDEN', decision: null, reasons: [], reason: 'POLICY'}); return body;
    }); await assert.rejects(() => read(h), error => unavailable('REVIEWS', true)(error) && error.reference.id === affected.id && error.resourceKind === 'REVIEW');
  }
});
test('complete checked moderation lineage distinguishes later legitimate restoration from lagged visibility', async () => {
  const f = await fixture(); const historical = await addReview(f), authored = clone(historical); await addReview(f);
  const hide = {sequence: 1, requestId: uid(), createdAt: new Date(Date.parse(at) + 100).toISOString(), actor: human(5), state: 'HIDDEN', reason: 'POLICY'};
  Object.assign(historical, {state: 'HIDDEN', record: null, decision: null, reason: 'POLICY', moderation: [hide]}); server(f); const hidden = await read(f);
  const restore = {sequence: 2, requestId: uid(), createdAt: new Date(Date.parse(at) + 200).toISOString(), actor: human(5), state: 'VISIBLE', reason: 'RESTORED'};
  Object.assign(historical, {state: 'VISIBLE', record: authored.record, decision: authored.decision, reason: 'RESTORED', moderation: [hide, restore]}); server(f); const restored = await read(f);
  const previous = hidden.reviewContext.lifecycle.find(item => item.id === historical.id), current = restored.reviewContext.lifecycle.find(item => item.id === historical.id);
  assert.deepEqual(current.moderation.slice(0, previous.moderation.length), previous.moderation); assert.equal(current.moderation.at(-1).reason, 'RESTORED'); assert.equal(current.state, 'VISIBLE'); assert.equal(restored.reviewContext.currentHead.id, f.reviews.at(-1).id); assert(!reader.sameArenaPublicMember(hidden, restored));
});
test('a new head appended while final exact rows are checked is detected by the closing head fence', async () => {
  const f = await fixture(); const oldHead = await addReview(f); server(f, async ({url, count, body}) => {
    if (url.pathname === '/api/experiments/reviews' && url.searchParams.get('id') === oldHead.id && count === 3) {await addReview(f); return body;}
  }); await assert.rejects(() => read(f), unavailable('REVIEWS'));
});
