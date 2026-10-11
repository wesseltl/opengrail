import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Local hook/event tests exercise the actual component and schema. They do not prove browser
// layout, hosted Sites authentication, moderation operations or independently verified outcomes.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch, originalWindow = globalThis.window;
const context = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0};
globalThis.__researchHooks = {
  useState(initial) { const i = context.si++; if (!(i in context.state)) context.state[i] = typeof initial === 'function' ? initial() : initial; return [context.state[i], next => context.state[i] = typeof next === 'function' ? next(context.state[i]) : next]; },
  useRef(initial) { return context.refs[context.ri++] ??= {current: initial}; },
  useEffect(callback, deps) { const i = context.ei++, old = context.deps[i]; if (!old || deps.some((value, n) => value !== old[n])) { context.deps[i] = deps; context.effects.push(() => { context.cleanup[i]?.(); context.cleanup[i] = callback(); }); } },
};
const stubs = {react: 'export const {useState,useRef,useEffect}=globalThis.__researchHooks;', '@/components/ui/dialog': 'export const Dialog=()=>null,DialogContent=()=>null,DialogHeader=()=>null,DialogTitle=()=>null,DialogDescription=()=>null;'};
const built = await build({entryPoints: ['app/research.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'research-hooks', setup(builder) {
  builder.onResolve({filter: /.*/}, args => args.importer.endsWith('/app/research.tsx') && args.path in stubs ? {path: args.path, namespace: 'stub'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'stub'}, args => ({contents: stubs[args.path], loader: 'js'}));
}}]});
const module = {exports: {}}; new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
const Research = module.exports.default;
const bundled = await build({entryPoints: ['app/research-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const model = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const ventureBuild = await build({entryPoints: ['app/venture-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const ventureModel = await import('data:text/javascript;base64,' + Buffer.from(ventureBuild.outputFiles[0].text).toString('base64'));
const authorId = await model.researchPublicHumanId('synthetic-sponsor'), otherId = await model.researchPublicHumanId('another-sponsor');
const me = {version: 1, authorId, sponsorId: authorId, moderator: false, executionEnabled: false};
const T = new Date().toISOString();
const content = {kind: 'HYPOTHESIS', title: 'Test an after-cost hypothesis', statement: 'Measure the proposed rules on independent observations.', assumptions: 'Costs and missing observations must be disclosed.', falsification: 'Reject when the independent result does not survive costs.', sources: [{url: 'https://example.com/research', classification: 'PRIMARY', note: 'An author-classified reference.'}], relation: null};
async function item(changes = {}, contentChanges = {}) {
  const id = changes.id ?? crypto.randomUUID(), author = changes.author ?? {kind: 'HUMAN', id: authorId, sponsorId: authorId};
  const {record, payload} = model.boundedResearchRecord({version: 1, id, rootId: id, revision: 1, requestId: crypto.randomUUID(), createdAt: T, author, content: {...content, ...contentChanges}, policyAccepted: 'public-research-v1', verification: 'UNVERIFIED', executionEnabled: false, ...changes});
  return {id: record.id, digest: await model.researchDigest(payload), rootId: record.rootId, revision: record.revision, requestId: record.requestId, createdAt: record.createdAt, author: model.researchAuthorReference(record.author), state: 'VISIBLE', reason: null, record, moderation: []};
}
function tombstone(value, state = 'WITHDRAWN', command = {}) {
  const reason = command.reason ?? (state === 'WITHDRAWN' ? 'AUTHOR_REQUEST' : 'POLICY');
  return {...value, state, reason, record: null, moderation: [...value.moderation, {sequence: value.moderation.length + 1, requestId: command.requestId ?? crypto.randomUUID(), createdAt: T, actor: {kind: 'HUMAN', id: authorId, sponsorId: authorId}, state, reason}]};
}
const list = (items, nextCursor = null) => ({version: 1, items, nextCursor, executionEnabled: false});
const receipt = (command, value, report = null) => ({version: 1, action: command.action, requestId: command.requestId, item: value, report, executionEnabled: false});
async function publication(command, parent = null, changes = {}, contentChanges = {}) {
  const revision = command.relation?.type === 'REVISION';
  return item({version: model.researchPublicationVersion(command), id: command.id, requestId: command.requestId, rootId: revision ? parent.rootId : command.id, revision: revision ? parent.revision + 1 : 1, ...changes}, {...model.researchPublicationContent(command), ...contentChanges});
}
function expand(node) { return node && typeof node === 'object' && typeof node.type === 'function' && (node.type.name === 'ResearchCard' || node.type.name.startsWith('Venture')) ? node.type(node.props) : node; }
function walk(node, predicate) { const n = expand(node); if (!n || typeof n !== 'object') return []; if (Array.isArray(n)) return n.flatMap(child => walk(child, predicate)); return [...(predicate(n) ? [n] : []), ...walk(n.props?.children, predicate)]; }
function text(node) { const n = expand(node); return n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(text).join(' ') : typeof n === 'object' ? text(n.props?.children) : String(n); }
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const field = (tree, name) => walk(tree, node => node.props?.['aria-label'] === name)[0];
function harness(props = {signedIn: true}, search) {
  if (search === undefined) delete globalThis.window;
  else {
    const events = new Map();
    globalThis.window = {location: {search}, history: {pushState(_state, _title, href) { window.location.search = new URL(href, 'https://local').search; }, replaceState(_state, _title, href) { window.location.search = new URL(href, 'https://local').search; }}, addEventListener(name, listener) { events.set(name, listener); }, removeEventListener(name) { events.delete(name); }, events};
  }
  context.cleanup.forEach(cleanup => cleanup?.()); for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup']) context[key] = [];
  const render = () => { context.si = context.ri = context.ei = 0; return Research(props); };
  const flush = async () => { for (let i = 0; i < 12; i++) { render(); while (context.effects.length) context.effects.shift()(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  const until = async predicate => { const deadline = Date.now() + 5000; do { const tree = await flush(); if (typeof predicate === 'function' ? predicate(tree) : text(tree).includes(predicate)) return tree; } while (Date.now() < deadline); assert.fail('Timed out waiting for ' + predicate + ': ' + text(render())); };
  return {props, render, flush, until,
    link(name, subtree) { const found = walk(subtree ?? render(), node => node.type === 'a' && label(node) === name)[0]; assert(found, 'missing link ' + name); found.props.onClick({preventDefault() {}}); },
    click(name, subtree) { const found = button(subtree ?? render(), name); assert(found, 'missing ' + name); assert(!found.props.disabled, name + ' disabled'); found.props.onClick(); },
    field(name, value) { const found = field(render(), name); assert(found, 'missing ' + name); found.props.onChange({target: {value, checked: value}}); },
    submit() { const form = walk(render(), node => node.type === 'form')[0]; assert(form, 'missing form'); form.props.onSubmit({preventDefault() {}}); },
    close() { walk(render(), node => node.props?.onOpenChange)[0]?.props.onOpenChange(false); },
    unmount() { context.cleanup.forEach(cleanup => cleanup?.()); },
    card(id) { return walk(render(), node => node.props?.['aria-label'] === 'Research ' + id)[0]; },
  };
}
function server(initial = [], post, options = {}) {
  const requests = [], records = [...initial];
  globalThis.fetch = async (path, init = {}) => {
    requests.push({path, init});
    if (path === '/api/research/me') return options.meResponse ?? Response.json(me);
    if (init.method !== 'POST' && path.includes('?target=')) { const query = new URL(path, 'https://local').searchParams, target = records.find(value => value.id === query.get('target')); return Response.json({version: 1, target, items: target.record ? records.filter(value => value.record?.content.relation?.id === target.id && value.record.content.relation.digest === target.digest).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 20) : [], nextCursor: null, executionEnabled: false}); }
    if (init.method !== 'POST' && path.includes('?domain=VENTURE')) return Response.json({version: 1, domain: 'VENTURE', items: records.filter(value => !value.record || value.record.version === 2).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), nextCursor: null, executionEnabled: false});
    if (init.method !== 'POST') return path.includes('?root=') ? Response.json({version: 1, items: records.filter(value => value.rootId === new URL(path, 'https://local').searchParams.get('root')), executionEnabled: false}) : Response.json(list(records));
    const command = JSON.parse(init.body), target = records.find(value => value.id === command.id), parent = records.find(value => value.id === command.relation?.id);
    if (post) { const override = await post(command, records); if (override !== undefined) return override instanceof Response ? override : Response.json(override); }
    if (command.action === 'report') return Response.json(receipt(command, null, {requestId: command.requestId, id: command.id, digest: command.digest, reason: command.reason, createdAt: T}));
    const saved = command.action === 'publish' ? await publication(command, parent) : tombstone(target, 'WITHDRAWN', command);
    records.splice(0, records.length, saved, ...records.filter(value => value.id !== saved.id));
    return Response.json(receipt(command, saved));
  };
  return {requests, records};
}
async function ready(h) { await h.until(tree => button(tree, 'Publish research')?.props.disabled === false); }
async function fill(h, overrides = {}) {
  const values = {...content, ...overrides};
  for (const [name, value] of [['Research title', values.title], ['Research statement', values.statement], ['Research assumptions', values.assumptions], ['Research falsification', values.falsification]]) { h.field(name, value); await h.flush(); }
  h.field('Accept public research policy', true); await h.flush();
}
after(() => { context.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; delete globalThis.__researchHooks; });

test('anonymous public board loads real records, distinguishes failed human and agent work without private context', async () => {
  const human = await item({}, {kind: 'FAILURE', title: 'This experiment failed'}), agent = await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Synthetic agent'}});
  const {requests} = server([human, agent]), h = harness({signedIn: false}); const tree = await h.until(human.record.content.title);
  assert.equal(requests.length, 1); assert.equal(requests[0].path, '/api/research'); assert(text(tree).includes('Failed experiment')); assert(text(tree).includes('Human sponsor'));
  assert(text(tree).includes('Human ')); assert(text(tree).includes('Agent ')); assert(text(tree).includes('Unverified')); assert(!text(tree).includes('Synthetic agent'));
  assert.equal(button(tree, 'Fork'), undefined); const signin = walk(tree, node => node.type === 'a' && node.props.href === '/signin-with-chatgpt?return_to=/research'); assert(signin.every(node => node.props.target === '_top'));
});

test('publishing requires explicit public retention consent and sends strict content without caller authorship', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); h.submit(); await h.flush();
  const policyLink = walk(h.render(), node => node.type === 'a' && node.props.href === '/research-policy')[0]; assert(policyLink); assert.equal(policyLink.props.rel, 'noopener noreferrer');
  assert(text(h.render()).includes('Agree to the public research policy')); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  await fill(h); h.submit(); const tree = await h.until('Research recorded'); const post = requests.find(value => value.init.method === 'POST'), command = JSON.parse(post.init.body);
  assert.equal(command.policyAccepted, 'public-research-v1'); assert.equal(command.title, content.title); assert.equal(command.action, 'publish'); assert.equal(post.init.headers['X-Research-Intent'], 'submit'); assert.equal(post.init.headers['X-Research-Author'], authorId);
  assert.deepEqual(Object.keys(command).sort(), ['action', 'assumptions', 'falsification', 'id', 'kind', 'policyAccepted', 'relation', 'requestId', 'sources', 'statement', 'title']);
  assert(!post.init.body.includes(authorId)); assert(text(tree).includes('public and unverified')); assert(!requests.some(value => /trade|execution/.test(value.path)));
});

test('unknown writes retain exact bytes and block edits, close and competing submissions until same request retry', async () => {
  let first = true; const {requests} = server([], command => { if (first) { first = false; return Response.json({error: 'unconfirmed'}, {status: 503}); } });
  const h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown');
  h.close(); assert(walk(h.render(), node => node.props?.open).length); const oldTitle = field(h.render(), 'Research title').props.value;
  field(h.render(), 'Research title').props.onChange({target: {value: 'Changed after uncertainty'}}); h.submit(); await h.flush(); assert.equal(field(h.render(), 'Research title').props.value, oldTitle);
  assert.equal(requests.filter(value => value.init.method === 'POST').length, 1); h.click('Retry same request'); await h.until('Research recorded');
  const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts.length, 2); assert.equal(posts[0].init.body, posts[1].init.body); assert.equal(posts[0].init.headers['X-Research-Author'], authorId); assert.equal(posts[1].init.headers['X-Research-Author'], authorId);
});

test('double submits serialize one mutation and late mismatched receipts cannot confirm publication', async () => {
  let first = true;
  const {requests} = server([], async command => { if (first) { first = false; return receipt(command, await publication(command, null, {}, {title: 'Unexpected content'})); } }), h = harness();
  await ready(h); h.click('Publish research'); await h.flush(); await fill(h); const submit = walk(h.render(), node => node.type === 'form')[0].props.onSubmit;
  submit({preventDefault() {}}); submit({preventDefault() {}}); await h.until('Outcome unknown'); assert(!text(h.render()).includes('Research recorded')); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
  h.click('Retry same request'); await h.until('Research recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('corrupt digests, wrong author and wrong operation receipts remain uncertain until valid reconciliation', async () => {
  for (const alter of [value => ({...value, digest: 'a'.repeat(64)}), async value => item({id: value.id, requestId: value.requestId, author: {kind: 'HUMAN', id: otherId, sponsorId: otherId}}, value.record.content), value => ({...value, requestId: crypto.randomUUID()})]) {
    let first = true; const {requests} = server([], async command => { if (first) { first = false; return receipt(command, await alter(await publication(command))); } }), h = harness();
    await ready(h); h.click('Publish research'); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown'); assert(!text(h.render()).includes('Research recorded'));
    h.click('Retry same request'); await h.until('Research recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
  }
});

test('human revision, fork and challenge reference exact records without inheriting attribution or verification', async () => {
  for (const type of ['REVISION', 'FORK', 'CHALLENGE']) {
    const target = await item(), {requests} = server([target]), h = harness(); await ready(h);
    h.click(type === 'REVISION' ? 'Revise' : type === 'FORK' ? 'Fork' : 'Challenge', h.card(target.id)); await h.flush(); await fill(h);
    h.submit(); await h.until('Research recorded'); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body);
    assert.deepEqual(command.relation, {type, id: target.id, digest: target.digest}); assert.notEqual(command.id, target.id);
    assert.equal(command.kind, type === 'CHALLENGE' ? 'CHALLENGE' : 'HYPOTHESIS'); assert(!('verification' in command));
  }
});

test('agent sponsorship permits withdrawal but cannot grant human revision of agent-authored work', async () => {
  const ownedAgent = await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Sponsored agent'}}), foreign = await item({author: {kind: 'HUMAN', id: otherId, sponsorId: otherId}});
  server([ownedAgent, foreign]); const h = harness(); await ready(h);
  assert.equal(button(h.card(ownedAgent.id), 'Revise'), undefined); assert(button(h.card(ownedAgent.id), 'Withdraw')); assert.equal(button(h.card(foreign.id), 'Withdraw'), undefined); assert.equal(button(h.card(foreign.id), 'Revise'), undefined);
  assert(button(h.card(foreign.id), 'Challenge')); assert(button(h.card(foreign.id), 'Report'));
});

test('author and sponsor withdrawal confirms exact digest and renders content-free tombstones', async () => {
  const target = await item({}, {title: 'Content to remove', statement: 'This public statement will be withdrawn.'}), {requests} = server([target]), h = harness(); await ready(h);
  h.click('Withdraw', h.card(target.id)); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn');
  const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.id, target.id); assert.equal(command.digest, target.digest); assert.equal(command.reason, 'AUTHOR_REQUEST');
  h.click('Done'); await h.until('Withdrawn research'); const tree = h.render(); assert(!text(tree).includes(target.record.content.title)); assert(!text(tree).includes(target.record.content.statement)); assert(!walk(tree, node => node.type === 'a').some(node => node.props.href === content.sources[0].url));
});

test('a human sponsor can withdraw an already hidden agent record without recovering authored text', async () => {
  const target = tombstone(await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Previously hidden agent'}}, {title: 'Previously hidden title'}), 'HIDDEN');
  const {requests} = server([target]), h = harness(); await ready(h);
  assert.equal(button(h.card(target.id), 'Revise'), undefined); h.click('Withdraw', h.card(target.id)); await h.flush();
  h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn');
  const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.reason, 'SPONSOR_REQUEST'); assert.equal(command.digest, target.digest);
  h.click('Done'); await h.until('Withdrawn research'); assert(!text(h.render()).includes('Previously hidden title')); assert.equal(button(h.card(target.id), 'Withdraw'), undefined);
});

test('a retained-capacity rejection does not imply a daily automatic reset', async () => {
  server([], () => Response.json({error: 'full'}, {status: 429})); const h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await fill(h); h.submit();
  await h.until('no automatic reset is scheduled'); assert(!text(h.render()).includes('Try again later'));
});

test('withdrawal from retained history clears stale content so closing success cannot reopen the old visible version', async () => {
  const target = await item({}, {title: 'Remove cached history content'}); server([target]); const h = harness(); await ready(h);
  h.click('History', h.card(target.id)); await h.until('Immutable research history'); await h.until(tree => walk(tree, node => node.props?.['aria-label'] === 'Research ' + target.id).length > 1);
  const cards = walk(h.render(), node => node.props?.['aria-label'] === 'Research ' + target.id); h.click('Withdraw', cards.at(-1)); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn');
  h.click('Done'); await h.until('Withdrawn research'); assert(!text(h.render()).includes('Remove cached history content')); assert(!text(h.render()).includes('Immutable research history'));
});

test('report details stay private and the public board never renders a report body', async () => {
  const target = await item(), {requests} = server([target]), h = harness(); await ready(h); h.click('Report', h.card(target.id)); await h.flush();
  h.field('Report reason', 'MISLEADING'); await h.flush(); h.field('Private report details', 'Private contextual concern for moderation only.'); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit();
  await h.until('Report received'); assert(!text(h.render()).includes('Private contextual concern')); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body);
  assert.equal(command.details, 'Private contextual concern for moderation only.'); assert.equal(command.digest, target.digest); h.click('Done'); await h.flush(); assert(!text(h.render()).includes(command.details));
});

test('hidden publication retry receipts reconcile metadata without restoring the submitted body', async () => {
  let first = true;
  const {requests} = server([], async command => { if (first) { first = false; return Response.json({error: 'lost acknowledgment'}, {status: 503}); } return receipt(command, tombstone(await publication(command), 'HIDDEN')); }), h = harness();
  await ready(h); h.click('Publish research'); await h.flush(); await fill(h, {title: 'Body that was hidden'}); h.submit(); await h.until('Outcome unknown'); h.click('Retry same request'); await h.until('content is hidden or withdrawn');
  assert(!text(h.render()).includes('Body that was hidden')); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('401/403 clear pending mutation and form state while leaving anonymously readable research public', async () => {
  for (const status of [401, 403]) {
    const target = await item(), {requests} = server([target], () => Response.json({error: 'access'}, {status})), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await fill(h, {title: 'Private unfinished draft'});
    const stale = walk(h.render(), node => node.type === 'form')[0].props.onSubmit; h.submit(); await h.until('Your session expired'); stale({preventDefault() {}}); await h.flush();
    assert.equal(requests.filter(value => value.init.method === 'POST').length, 1); assert.equal(field(h.render(), 'Research title'), undefined); assert(text(h.render()).includes(target.record.content.title));
  }
});

test('late writes after sign-out or unmount cannot revive forms or private report details', async () => {
  for (const action of ['signout', 'unmount']) {
    let release; const {requests} = server([], command => new Promise(resolve => release = async () => resolve(receipt(command, await publication(command))))), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await fill(h); h.submit(); await h.until('Submitting…');
    const pending = context.refs.find(ref => ref?.current?.pending)?.current.pending; assert(pending?.body);
    if (action === 'signout') { h.props.signedIn = false; await h.flush(); } else h.unmount(); assert.equal(pending.body, '');
    await release(); await h.flush(); assert(!text(h.render()).includes('Research recorded')); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
  }
});

test('deterministic rejection unlocks editing with a new operation, and rate rejection communicates retry timing', async () => {
  for (const status of [400, 404, 409, 413, 415, 429]) {
    let first = true; const {requests} = server([], () => { if (first) { first = false; return Response.json({error: 'rejected'}, {status, headers: {'Retry-After': '60'}}); } }), h = harness();
    await ready(h); h.click('Publish research'); await h.flush(); await fill(h); h.submit(); await h.until(tree => text(tree).includes('Submission rejected') || text(tree).includes('record changed') || text(tree).includes('Submission quota'));
    assert.equal(button(h.render(), 'Retry same request'), undefined); if (status === 429) assert(text(h.render()).includes('Retry after 60 seconds'));
    h.field('Research title', 'Reviewed replacement'); await h.flush(); assert.equal(field(h.render(), 'Accept public research policy').props.checked, false); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.notEqual(JSON.parse(posts[0].init.body).requestId, JSON.parse(posts[1].init.body).requestId);
  }
});

test('public text stays React text, safe source anchors do not fetch author URLs or execute HTML', async () => {
  const hostile = '<img src=x onerror=alert(1)><script>alert(2)</script>', target = await item({}, {title: hostile.slice(0, 120), statement: hostile, assumptions: hostile});
  const {requests} = server([target]), h = harness({signedIn: false}); const tree = await h.until(hostile);
  assert(text(tree).includes(hostile)); assert.equal(walk(tree, node => node.type === 'img' || node.type === 'script' || node.props?.dangerouslySetInnerHTML).length, 0);
  const link = walk(tree, node => node.type === 'a' && node.props.href === content.sources[0].url)[0]; assert.equal(link.props.rel, 'noopener noreferrer'); assert.equal(link.props.target, '_blank');
  assert.deepEqual(requests.map(value => value.path), ['/api/research']);
});

test('tombstones hide authored names, sources and text while retaining exact identities and unverified status', async () => {
  const target = await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Name to redact'}}, {title: 'Title to redact', statement: 'Statement to redact'});
  server([tombstone(target)]); const h = harness({signedIn: false}); const tree = await h.until('Withdrawn research');
  for (const hidden of ['Name to redact', 'Title to redact', 'Statement to redact', content.sources[0].url]) assert(!text(tree).includes(hidden));
  assert(text(tree).includes(target.digest)); assert(text(tree).includes('Unverified')); assert.equal(button(tree, 'Fork'), undefined);
});

test('strict bounded public parsing rejects duplicate keys, malformed content, fake authority and digest drift', async () => {
  const target = await item(); const invalid = ['invalid JSON', ' '.repeat(1_048_577), JSON.stringify(list([target])).replace('{"version":1,', '{"version":1,"version":1,'), JSON.stringify({...list([target]), executionEnabled: true}), JSON.stringify(list([{...target, digest: 'a'.repeat(64)}])), JSON.stringify(list([{...target, state: 'HIDDEN'}]))];
  for (const body of invalid) { globalThis.fetch = async () => new Response(body); const h = harness({signedIn: false}); await h.until('Research unavailable'); assert(!text(h.render()).includes(target.record.content.title)); }
});

test('pagination removes stale action targets and history rejects a different root identity', async () => {
  const first = await item(), next = await item({}, {title: 'Next page research'}), cursor = crypto.randomUUID(), calls = [];
  globalThis.fetch = async path => { calls.push(path); if (path === '/api/research/me') return Response.json(me); if (path.includes('?root=')) return Response.json({version: 1, items: [next], executionEnabled: false}); return Response.json(path.includes('?cursor=') ? list([next]) : list([first], cursor)); };
  const h = harness(); await ready(h); const staleFork = button(h.card(first.id), 'Fork'); h.click('Next page'); await h.until(next.record.content.title); staleFork.props.onClick(); await h.flush(); assert.equal(field(h.render(), 'Research title'), undefined);
  assert(calls.includes('/api/research?cursor=' + cursor)); h.click('History', h.card(next.id)); await h.until('Immutable research history');
  // The first record requests the other root, proving correlation rather than a generic schema-only check.
  h.close(); h.click('Back to latest'); await h.until(first.record.content.title); h.click('History', h.card(first.id)); await h.until('History unavailable');
});

test('a newer known revision disables old human revision and captured closed forms cannot submit', async () => {
  const original = await item(), newer = await item({id: crypto.randomUUID(), rootId: original.rootId, revision: 2}, {relation: {type: 'REVISION', id: original.id, digest: original.digest}});
  const {requests} = server([newer, original]), h = harness(); await ready(h); assert(button(h.card(original.id), 'Revise').props.disabled); assert(!button(h.card(newer.id), 'Revise').props.disabled);
  h.click('Publish research'); await h.flush(); await fill(h); const stale = walk(h.render(), node => node.type === 'form')[0].props.onSubmit; h.close(); h.click('Publish research'); await h.flush(); stale({preventDefault() {}}); await h.flush(); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
});

test('research UI introduces no public report text, moderator controls, persistent drafts or executable rendering', async () => {
  const source = await readFile('app/research.tsx', 'utf8'); assert(!/localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML|eval\(|console\.(?:log|warn|error)/.test(source));
  assert(!/action:\s*['"]moderate['"]/.test(source)); const page = await readFile('app/research/page.tsx', 'utf8'); assert(page.includes('getChatGPTUser')); assert(page.includes('signedIn={!!user}'));
});

const threadResponse = (target, items = [], nextCursor = null) => ({version: 1, target, items: [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), nextCursor, executionEnabled: false});
const href = value => '/research?id=' + value.id + '&digest=' + value.digest;
async function child(target, changes = {}, contentChanges = {}) { return item(changes, {relation: {type: 'FORK', id: target.id, digest: target.digest}, ...contentChanges}); }

test('exact public permalink resolves a target outside the board and renders direct discussion anonymously', async () => {
  const selected = await item({}, {title: 'Exact off-board hypothesis'}), board = await item({}, {title: 'Unrelated board contribution'}), reply = await child(selected, {}, {title: 'Direct counterexample', kind: 'CHALLENGE', relation: {type: 'CHALLENGE', id: selected.id, digest: selected.digest}}), requests = [];
  globalThis.fetch = async (path, init = {}) => { requests.push({path, init}); return Response.json(path.includes('?target=') ? threadResponse(selected, [reply]) : list([board])); };
  const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search), tree = await h.until(reply.record.content.title);
  assert(text(tree).includes(selected.record.content.title)); assert(text(tree).includes('Every contribution remains unverified')); assert(text(tree).includes(board.record.content.title));
  assert.equal(requests.length, 2); assert(requests.some(value => value.path === '/api/research?target=' + selected.id + '&digest=' + selected.digest)); assert(requests.every(value => value.init.method !== 'POST'));
  assert(!requests.some(value => value.path === '/api/research/me')); assert.equal(button(h.card(selected.id), 'Fork'), undefined);
  const parent = walk(h.card(reply.id), node => node.type === 'a' && label(node) === 'Open referenced contribution')[0]; assert.equal(parent.props.href, href(selected));
});

test('board discussion links preserve exact ID/digest, support outgoing parent navigation and selected-record writes', async () => {
  const selected = await item({}, {title: 'Inspect this exact record'}), reply = await child(selected, {}, {title: 'A fork to inspect'}), {requests} = server([selected, reply]), h = harness(); await ready(h);
  const link = walk(h.card(selected.id), node => node.type === 'a' && label(node) === 'Open discussion')[0]; assert.equal(link.props.href, href(selected));
  h.link('Open discussion', h.card(selected.id)); await h.until('Exact contribution & discussion'); await h.until(tree => walk(tree, node => node.props?.['aria-label'] === 'Research ' + selected.id).length > 1);
  const selectedCard = walk(h.render(), node => node.props?.['aria-label'] === 'Research ' + selected.id)[0]; h.click('Challenge', selectedCard); await h.flush(); await fill(h); h.submit(); await h.until('Research recorded');
  const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.deepEqual(command.relation, {type: 'CHALLENGE', id: selected.id, digest: selected.digest});
  h.click('Done'); await h.flush(); h.link('Open referenced contribution', h.card(reply.id)); await h.until('Exact contribution & discussion'); assert(requests.filter(value => value.path.includes('?target=')).length >= 2);
});

test('malformed exact links show a visible error without silently selecting a board record', async () => {
  const selected = await item();
  for (const search of ['?id=' + selected.id, '?digest=' + selected.digest, '?id=' + selected.id + '&id=' + selected.id + '&digest=' + selected.digest, '?id=' + selected.id + '&digest=' + selected.digest + '&extra=yes', '?id=' + selected.id.toUpperCase() + '&digest=' + selected.digest, '?id=invalid&digest=' + selected.digest]) {
    const {requests} = server([selected]), h = harness({signedIn: false}, search); await h.until('Invalid research link'); await h.until(selected.record.content.title);
    assert(!requests.some(value => value.path.includes('?target='))); assert.equal(button(h.render(), 'Refresh discussion'), undefined); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  }
});

test('thread reads reject forged target identity, wrong child relation, duplicate keys and corrupt digests', async () => {
  const selected = await item(), foreign = await item(), reply = await child(selected), wrong = await child(foreign);
  const invalid = [threadResponse(foreign), threadResponse({...selected, digest: 'a'.repeat(64)}), threadResponse(selected, [wrong]), threadResponse(selected, [{...reply, digest: 'a'.repeat(64)}]), threadResponse(selected, [reply, reply]), {...threadResponse(selected), executionEnabled: true}];
  for (const value of invalid) {
    globalThis.fetch = async path => Response.json(path.includes('?target=') ? value : list([])); const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until('Exact research discussion unavailable');
    assert.equal(h.card(selected.id), undefined); assert.equal(h.card(reply.id), undefined);
  }
  globalThis.fetch = async path => path.includes('?target=') ? new Response(JSON.stringify(threadResponse(selected)).replace('{"version":1,', '{"version":1,"version":1,')) : Response.json(list([]));
  const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until('Exact research discussion unavailable'); assert.equal(h.card(selected.id), undefined);
});

test('discussion pagination fetches exact cursor, replaces the page and rejects repeated cursor children', async () => {
  const selected = await item(), replies = (await Promise.all(Array.from({length: 21}, (_, n) => child(selected, {}, {title: 'Discussion page item ' + n})))).sort((a, b) => b.id.localeCompare(a.id)), first = replies.slice(0, 20), next = replies[20], cursor = first.at(-1).id, requests = [];
  globalThis.fetch = async path => { requests.push(path); if (!path.includes('?target=')) return Response.json(list([])); return Response.json(path.includes('&cursor=') ? threadResponse(selected, [next]) : threadResponse(selected, first, cursor)); };
  const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until(tree => button(tree, 'Next discussion page')); h.click('Next discussion page'); await h.until(next.record.content.title);
  assert.equal(h.card(first[0].id), undefined); assert(requests.includes('/api/research?target=' + selected.id + '&digest=' + selected.digest + '&cursor=' + cursor));
  h.click('First discussion page'); await h.until(first[0].record.content.title);
  globalThis.fetch = async path => Response.json(path.includes('?target=') ? threadResponse(selected, [first.at(-1)]) : list([])); h.click('Next discussion page'); await h.until('Exact research discussion unavailable'); assert.equal(h.card(first.at(-1).id), undefined);
});

test('superseded thread responses cannot install a stale selected record', async () => {
  const first = await item({}, {title: 'Superseded exact target'}), second = await item({}, {title: 'Current exact target'}); let release;
  globalThis.fetch = async path => path.includes('target=' + first.id) ? new Promise(resolve => release = () => resolve(Response.json(threadResponse(first)))) : Response.json(path.includes('?target=') ? threadResponse(second) : list([first, second]));
  const h = harness({signedIn: false}); await h.until(second.record.content.title); h.link('Open discussion', h.card(first.id)); await h.until('Loading exact research discussion'); h.link('Open discussion', h.card(second.id)); await h.until('Exact contribution & discussion'); await h.until(tree => walk(tree, node => node.props?.['aria-label'] === 'Research ' + second.id).length > 1);
  await release(); await h.flush(); assert.equal(walk(h.render(), node => node.props?.['aria-label'] === 'Research ' + first.id).length, 1);
});

test('a hidden target clears selected discussion and every cached copy without hiding independently visible children', async () => {
  const selected = await item({}, {title: 'Target content must disappear'}), reply = await child(selected, {}, {title: 'Independently visible child'}), hidden = tombstone(selected, 'HIDDEN'); let suppress = false;
  globalThis.fetch = async path => { if (path === '/api/research/me') return Response.json(me); return Response.json(path.includes('?target=') ? threadResponse(suppress ? hidden : selected, suppress ? [] : [reply]) : list([selected, reply])); };
  const h = harness({}, new URL(href(selected), 'https://local').search); await h.until(selected.record.content.title); await h.until('Direct challenges, forks & revisions'); suppress = true; h.click('Refresh discussion'); await h.until('Discussion is unavailable while');
  assert(!text(h.render()).includes(selected.record.content.title)); assert(text(h.render()).includes(reply.record.content.title)); assert.equal(walk(h.render(), node => node.props?.['aria-label'] === 'Research ' + reply.id).length, 1);
  h.click('Refresh research'); await h.flush(); assert(!text(h.render()).includes(selected.record.content.title));
});

test('hidden children redact board and history copies and old visible refreshes cannot resurrect them', async () => {
  const selected = await item(), reply = await child(selected, {}, {title: 'Child content to redact'}), hidden = tombstone(reply, 'HIDDEN'); let suppress = false;
  globalThis.fetch = async path => { if (path === '/api/research/me') return Response.json(me); if (path.includes('?root=')) return Response.json({version: 1, items: [reply], executionEnabled: false}); return Response.json(path.includes('?target=') ? threadResponse(selected, [suppress ? hidden : reply]) : list([selected, reply])); };
  const h = harness({signedIn: true}, new URL(href(selected), 'https://local').search); await ready(h); await h.until('Direct challenges, forks & revisions'); h.click('History', h.card(reply.id)); await h.until('Immutable research history'); await h.until(tree => walk(tree, node => node.props?.['aria-label'] === 'Research ' + reply.id).length > 2); h.close(); await h.flush();
  suppress = true; h.click('Refresh discussion'); await h.until('Hidden research'); assert(!text(h.render()).includes(reply.record.content.title)); h.click('Refresh research'); await h.flush(); assert(!text(h.render()).includes(reply.record.content.title));
});

test('WITHDRAWN is terminal and deliberate HIDDEN restoration requires a newer extending RESTORED event', async () => {
  for (const state of ['HIDDEN', 'WITHDRAWN']) {
    const selected = await item({}, {title: 'Suppressed content ' + state}), hidden = tombstone(selected, state); let value = hidden;
    globalThis.fetch = async path => Response.json(path.includes('?target=') ? threadResponse(value) : list([])); const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until(state === 'HIDDEN' ? 'Hidden research' : 'Withdrawn research');
    value = selected; h.click('Refresh discussion'); await h.flush(); assert(!text(h.render()).includes(selected.record.content.title));
    if (state === 'HIDDEN') {
      value = {...selected, moderation: [...hidden.moderation, {sequence: 2, requestId: crypto.randomUUID(), createdAt: T, actor: {kind: 'HUMAN', id: authorId, sponsorId: authorId}, state: 'VISIBLE', reason: 'RESTORED'}], reason: 'RESTORED'};
      h.click('Refresh discussion'); await h.until(selected.record.content.title); value = hidden; h.click('Refresh discussion'); await h.flush(); assert(text(h.render()).includes(selected.record.content.title)); assert(!text(h.render()).includes('Hidden research'));
    }
  }
});

test('lost-ACK exact writes retain original bytes while a pending thread read suppresses the parent and display draft', async () => {
  const selected = await item({}, {title: 'Parent becomes hidden during retry'}), hidden = tombstone(selected, 'HIDDEN'); let release, first = true; const requests = [];
  globalThis.fetch = async (path, init = {}) => {
    requests.push({path, init}); if (path === '/api/research/me') return Response.json(me);
    if (init.method === 'POST') { const command = JSON.parse(init.body); if (first) { first = false; return Response.json({error: 'lost'}, {status: 503}); } return Response.json(receipt(command, await publication(command, selected))); }
    if (path.includes('?target=')) return new Promise(resolve => release = () => resolve(Response.json(threadResponse(hidden))));
    return Response.json(list([selected]));
  };
  const h = harness(); await ready(h); h.link('Open discussion', h.card(selected.id)); await h.until('Loading exact research discussion'); h.click('Fork', h.card(selected.id)); await h.flush(); await fill(h, {title: 'Draft scrubbed after suppression'}); h.submit(); await h.until('Outcome unknown');
  const pending = context.refs.find(ref => ref?.current?.pending)?.current.pending, exactBody = pending.body; await release(); await h.flush(); assert.equal(field(h.render(), 'Research title').props.value, ''); assert.equal(pending.body, exactBody);
  const navigation = walk(h.render(), node => node.type === 'a' && label(node) === 'Open discussion')[0]; assert.equal(navigation.props['aria-disabled'], true); navigation.props.onClick({preventDefault() {}}); assert.equal(requests.filter(value => value.path.includes('?target=')).length, 1);
  h.click('Retry same request'); await h.until('Research recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts.length, 2); assert.equal(posts[0].init.body, posts[1].init.body); assert(!text(h.render()).includes(selected.record.content.title));
});

test('unauthorized discussion reads clear private form identity and late private writes cannot regain it', async () => {
  const selected = await item(); let first = true;
  globalThis.fetch = async path => { if (path === '/api/research/me') return Response.json(me); return path.includes('?target=') ? Response.json({error: 'expired'}, {status: 401}) : Response.json(list([selected])); };
  const h = harness(); await ready(h); h.link('Open discussion', h.card(selected.id)); await h.until('Your session expired'); assert.equal(button(h.render(), 'Publish research'), undefined); assert(text(h.render()).includes(selected.record.content.title));
});

test('normal detail clicks use the inspector while modified clicks retain usable native permalinks', async () => {
  const selected = await item(), {requests} = server([selected]), h = harness({signedIn: false}); await h.until(selected.record.content.title);
  const link = walk(h.card(selected.id), node => node.type === 'a' && label(node) === 'Open discussion')[0]; assert.equal(link.props.href, href(selected));
  for (const gesture of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}, {button: 2}]) { let prevented = false; link.props.onClick({...gesture, preventDefault() { prevented = true; }}); assert.equal(prevented, false); }
  assert.equal(requests.filter(value => value.path.includes('?target=')).length, 0); let prevented = false; link.props.onClick({button: 0, preventDefault() { prevented = true; }}); assert.equal(prevented, true); await h.until('Direct challenges, forks & revisions');
});

test('selected anonymous sign-in retains a safe encoded exact permalink', async () => {
  const selected = await item(); server([selected]); const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until('Direct challenges, forks & revisions');
  const signin = walk(h.render(), node => node.type === 'a' && label(node) === 'Sign in to contribute')[0]; assert.equal(signin.props.href, '/signin-with-chatgpt?return_to=' + encodeURIComponent(href(selected))); assert.equal(signin.props.target, '_top');
});

test('thread pagination rejects an individually valid page that repeats or moves ahead of the frozen cursor', async () => {
  const selected = await item(), rows = (await Promise.all(Array.from({length: 21}, (_, n) => child(selected, {}, {title: 'Cursor floor item ' + n})))).sort((a, b) => b.id.localeCompare(a.id)), first = rows.slice(0, 20), cursor = first.at(-1).id;
  for (const returned of [first[0], first.at(-1)]) {
    globalThis.fetch = async path => Response.json(path.includes('?target=') ? path.includes('&cursor=') ? threadResponse(selected, [returned]) : threadResponse(selected, first, cursor) : list([]));
    const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until(tree => button(tree, 'Next discussion page')); h.click('Next discussion page'); await h.until('Exact research discussion unavailable'); assert.equal(h.card(returned.id), undefined);
  }
});

test('principal changes before retry clear the original private form without submitting its old command as another account', async () => {
  const {requests} = server([], () => Response.json({error: 'lost'}, {status: 503})), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown');
  const retry = button(h.render(), 'Retry same request'), view = context.refs.find(ref => ref?.current?.me)?.current, pending = context.refs.find(ref => ref?.current?.pending)?.current.pending; assert(pending.body); view.me = {...me, authorId: otherId, sponsorId: otherId};
  retry.props.onClick(); await h.until('Your session expired'); assert.equal(pending.body, ''); assert.equal(field(h.render(), 'Research title'), undefined); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
});

test('a forged batch with a valid suppression followed by contradictory cached identity cannot partially mutate visibility caches', async () => {
  const selected = await item(), firstAt = new Date(Date.parse(T) + 2000).toISOString(), secondAt = new Date(Date.parse(T) + 1000).toISOString(), changedAt = new Date(Date.parse(T) + 1500).toISOString();
  const first = await child(selected, {createdAt: firstAt}, {title: 'Suppression in rejected whole batch'}), second = await child(selected, {createdAt: secondAt}, {title: 'Contradictory later immutable identity'});
  const hiddenFirst = tombstone(first, 'HIDDEN'); hiddenFirst.moderation[0].createdAt = firstAt;
  const wrongSecond = tombstone({...second, createdAt: changedAt}, 'HIDDEN'); wrongSecond.moderation[0].createdAt = changedAt;
  let corrupt = false;
  globalThis.fetch = async path => Response.json(path.includes('?target=') ? threadResponse(selected, corrupt ? [hiddenFirst, wrongSecond] : [first, second]) : list([selected, first, second]));
  const h = harness({signedIn: false}, new URL(href(selected), 'https://local').search); await h.until('Direct challenges, forks & revisions'); corrupt = true; h.click('Refresh discussion'); await h.until('Exact research discussion unavailable');
  assert(text(h.render()).includes(first.record.content.title));
  const held = context.refs.find(ref => ref?.current?.visibility)?.current; assert.equal(held.visibility.get(first.id + ':' + first.digest).state, 'VISIBLE'); assert.equal(held.suppressed.has(first.id + ':' + first.digest), false);
});

test('a stale detail link cannot navigate even with modifier keys once its original write is unresolved', async () => {
  const selected = await item(), {requests} = server([selected], () => Response.json({error: 'lost'}, {status: 503})), h = harness(); await ready(h);
  const stale = walk(h.card(selected.id), node => node.type === 'a' && label(node) === 'Open discussion')[0]; h.click('Fork', h.card(selected.id)); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown');
  for (const gesture of [{button: 0}, {ctrlKey: true}, {metaKey: true}, {button: 1}]) { let prevented = false; stale.props.onClick({...gesture, preventDefault() { prevented = true; }}); assert.equal(prevented, true); }
  assert.equal(requests.filter(value => value.path.includes('?target=')).length, 0); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
});

test('popstate loads exact discussion, surfaces malformed links and restores the previous URL while a write is unresolved', async () => {
  const first = await item({}, {title: 'First history-selected contribution'}), second = await item({}, {title: 'Second history-selected contribution'}), {requests} = server([first, second], () => Response.json({error: 'lost'}, {status: 503})), h = harness({signedIn: true}, ''); await ready(h);
  h.link('Open discussion', h.card(first.id)); await h.until('Direct challenges, forks & revisions'); window.location.search = new URL(href(second), 'https://local').search; window.events.get('popstate')();
  await h.until(tree => walk(tree, node => node.props?.['aria-label'] === 'Research ' + second.id).length === 2); assert.equal(walk(h.render(), node => node.props?.['aria-label'] === 'Research ' + first.id).length, 1);
  window.location.search = '?id=' + first.id; window.events.get('popstate')(); await h.until('Invalid research link');
  h.link('Open discussion', h.card(second.id)); await h.until('Direct challenges, forks & revisions'); h.click('Fork', h.card(second.id)); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown');
  const before = requests.filter(value => value.path.includes('?target=')).length; window.location.search = new URL(href(first), 'https://local').search; window.events.get('popstate')(); await h.flush();
  assert.equal(window.location.search, new URL(href(second), 'https://local').search); assert.equal(requests.filter(value => value.path.includes('?target=')).length, before); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
});

const ventureDate = T.slice(0, 10);
function dossier(changes = {}) {
  const blank = ventureModel.blankVentureDossier(ventureDate);
  return {...blank, issuer: {...blank.issuer, name: 'Synthetic infrastructure company', website: 'https://example.com/issuer', sector: 'AI', stage: 'PRE_SEED'}, risks: ['No independently established paying demand.'], nextCatalyst: {event: 'Confirm current round terms and customer evidence.', date: null}, ...changes};
}
async function ventureItem(changes = {}, data = dossier(), contentChanges = {}) { return item({version: 2, ...changes}, {domain: 'VENTURE', venture: data, ...contentChanges}); }
async function chooseVenture(h) { h.field('Research domain', 'VENTURE'); await h.flush(); }
async function fillVenture(h) {
  for (const [name, value] of [['Venture issuer name', 'Synthetic infrastructure company'], ['Venture issuer website', 'https://example.com/issuer'], ['Venture risk 1', 'No independently established paying demand.'], ['Venture next catalyst', 'Confirm current round terms and customer evidence.']]) { h.field(name, value); await h.flush(); }
  await fill(h);
}
async function addSource(h, url) { h.click('Add source'); await h.flush(); const sources = walk(h.render(), node => node.props?.['aria-label']?.match(/^Source \d+ URL$/)); h.field('Source ' + sources.length + ' URL', url); await h.flush(); }

// Controlled local interactions, not financial due diligence, a browser audit or hosted access.
test('guided venture publication keeps unknown facts honest and sends explicit v2 canonical content after renewed consent', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h);
  assert.equal(field(h.render(), 'Venture issuer name').props.value, ''); assert.equal(field(h.render(), 'Valuation status').props.value, 'UNKNOWN'); assert.equal(field(h.render(), 'Minimum ticket status').props.value, 'UNKNOWN'); assert.equal(field(h.render(), 'Netherlands access status').props.value, 'UNKNOWN');
  await fillVenture(h); h.field('Venture stage', 'PRE_SEED'); await h.flush(); assert.equal(field(h.render(), 'Accept public research policy').props.checked, false); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded');
  const post = requests.find(value => value.init.method === 'POST'), command = JSON.parse(post.init.body); assert.equal(command.version, 2); assert.equal(command.domain, 'VENTURE'); assert.equal(command.venture.terms.valuation.state, 'UNKNOWN'); assert.equal(command.venture.terms.minimumTicket.state, 'UNKNOWN'); assert.deepEqual(command.venture.access, {status: 'UNKNOWN', asOf: null, sourceIndices: [], route: null, conditions: ''}); assert(command.venture.scoring.components.founders === null); assert.equal(post.init.headers['X-Research-Author'], authorId);
  h.click('Done'); await h.until('ACCESS UNKNOWN'); assert(label(h.render()).includes('Author score: UNKNOWN')); assert(text(h.render()).includes('not performance'));
});

test('reported facts, financial terms and Dutch access bind dates, currency, basis and explicitly selected sources', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h); await addSource(h, 'https://example.com/current-terms');
  h.field('Product status', 'REPORTED'); await h.flush(); h.field('Product value', 'Founder describes a deployed developer tool.'); await h.flush(); h.field('Product classification', 'FOUNDER_CLAIM'); await h.flush(); h.field('Product source 1', true); await h.flush();
  h.field('Valuation status', 'REPORTED'); await h.flush(); h.field('Valuation amount', '4500000'); await h.flush(); h.field('Valuation basis', 'PRE_MONEY'); await h.flush(); h.field('Valuation source 1', true); await h.flush();
  h.field('Minimum ticket status', 'REPORTED'); await h.flush(); h.field('Minimum ticket amount', '500'); await h.flush(); h.field('Minimum ticket source 1', true); await h.flush(); h.field('Netherlands access status', 'MAYBE'); await h.flush(); h.field('Netherlands access conditions', 'Dutch retail eligibility and all-in fees require current platform review.'); await h.flush(); h.field('Netherlands access route', 'https://example.com/current-round'); await h.flush(); h.field('Netherlands access source 1', true); await h.flush();
  h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded'); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body);
  assert.deepEqual(command.venture.product.sourceIndices, [0]); assert.equal(command.venture.product.asOf, ventureDate); assert.equal(command.venture.terms.valuation.amount, 4500000); assert.equal(command.venture.terms.valuation.currency, 'EUR'); assert.equal(command.venture.terms.valuation.basis, 'PRE_MONEY'); assert.equal(command.venture.terms.minimumTicket.amount, 500); assert.equal(command.venture.access.status, 'MAYBE'); assert.deepEqual(command.venture.access.sourceIndices, [0]);
  h.click('Done'); await h.until('EUR 4,500,000'); assert(text(h.render()).includes('author reported, review required')); assert(label(h.render()).includes('as of ' + ventureDate)); assert(requests.every(value => value.path.startsWith('/api/research'))); assert(!requests.some(value => value.path.startsWith('https:')));
});

test('venture builder rejects unsourced known claims, future review/fact dates and incomplete money without a POST', async () => {
  for (const variant of ['unsourced', 'future-dossier', 'future-fact', 'money']) {
    const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h);
    if (variant === 'unsourced') { h.field('Product status', 'REPORTED'); await h.flush(); h.field('Product value', 'A claim without a source.'); await h.flush(); }
    if (variant === 'future-dossier') h.field('Venture dossier date', '2099-01-01');
    if (variant === 'future-fact') { await addSource(h, 'https://example.com/fact'); h.field('Product status', 'REPORTED'); await h.flush(); h.field('Product value', 'Future-dated factual claim.'); await h.flush(); h.field('Product source 1', true); await h.flush(); h.field('Product date', '2099-01-01'); }
    if (variant === 'money') { await addSource(h, 'https://example.com/terms'); h.field('Valuation status', 'REPORTED'); await h.flush(); h.field('Valuation source 1', true); }
    await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Venture claims need dated sources'); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  }
});

test('source removal keeps stable remaining URL identity and invalidates even partially sourced claims until explicit review', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h); await addSource(h, 'https://example.com/source-a'); await addSource(h, 'https://example.com/source-b');
  h.field('Product status', 'REPORTED'); await h.flush(); h.field('Product value', 'Reported result citing both documents.'); await h.flush(); h.field('Product source 1', true); await h.flush(); h.field('Product source 2', true); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.click('Remove source 1'); await h.flush();
  assert.equal(field(h.render(), 'Accept public research policy').props.checked, false); assert.equal(field(h.render(), 'Product source 1').props.checked, true); assert.equal(field(h.render(), 'Source 1 URL').props.value, 'https://example.com/source-b'); assert(text(h.render()).includes('This claim cannot publish until'));
  h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Venture claims need dated sources'); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  h.click('Review remaining product sources'); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded'); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.deepEqual(command.venture.product.sourceIndices, [0]); assert.equal(command.sources[0].url, 'https://example.com/source-b');
});

test('editing a cited URL never attaches its old fact to the replacement URL without explicit selection', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h); await addSource(h, 'https://example.com/original'); h.field('Product status', 'REPORTED'); await h.flush(); h.field('Product value', 'Source-bound claim.'); await h.flush(); h.field('Product source 1', true); await h.flush();
  h.field('Source 1 URL', 'https://example.com/replacement'); await h.flush(); assert.equal(field(h.render(), 'Product source 1').props.checked, false); assert(text(h.render()).includes('cited URLs changed')); h.click('Review remaining product sources'); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Venture claims need dated sources'); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  h.field('Product source 1', true); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded'); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.sources[0].url, 'https://example.com/replacement'); assert.deepEqual(command.venture.product.sourceIndices, [0]);
});

test('sparse author assessment stays UNKNOWN and unsupported entry/access scores are rejected without crashing the editor', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h); h.field('Venture score founders', '12'); await h.flush(); assert(text(h.render()).includes('UNKNOWN · incomplete assessment')); h.field('Venture score market', '99'); await h.flush(); assert(text(h.render()).includes('UNKNOWN · incomplete assessment')); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Venture claims need dated sources'); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  h.field('Venture score market', ''); await h.flush(); h.field('Venture score accessibility', '1'); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Venture claims need dated sources'); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
  h.field('Venture score accessibility', ''); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded'); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.venture.scoring.components.founders, 12); assert.equal(command.venture.scoring.components.market, null); assert.equal(command.venture.scoring.components.accessibility, null);
});

test('venture unknown acknowledgements retain exact dossier/body/header and reject a schema-valid wrong issuer receipt', async () => {
  let first = true; const {requests} = server([], async command => { if (first) { first = false; return receipt(command, await publication(command, null, {}, {venture: {...command.venture, issuer: {...command.venture.issuer, name: 'Wrong schema-valid issuer'}}})); } }), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h); h.submit(); await h.until('Outcome unknown');
  assert.equal(field(h.render(), 'Venture issuer name').props.disabled, true); h.field('Venture issuer name', 'Cannot replace frozen dossier'); await h.flush(); assert.equal(field(h.render(), 'Venture issuer name').props.value, 'Synthetic infrastructure company'); h.click('Retry same request'); await h.until('Research recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body); assert.equal(posts[0].init.headers['X-Research-Author'], posts[1].init.headers['X-Research-Author']); assert(!text(h.render()).includes('Wrong schema-valid issuer'));
});

test('v2 visible records retain dossier/version for forks, revisions and exact challenges without changing the original', async () => {
  for (const action of ['Fork', 'Revise', 'Challenge']) {
    const target = await ventureItem(), {requests} = server([target]), h = harness(); await ready(h); h.click(action, h.card(target.id)); await h.flush(); assert.equal(field(h.render(), 'Research domain').props.value, 'VENTURE'); assert.equal(field(h.render(), 'Venture issuer name').props.value, target.record.content.venture.issuer.name); await fill(h); h.submit(); await h.until('Research recorded');
    const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.version, 2); assert.equal(command.domain, 'VENTURE'); assert.deepEqual(command.venture, target.record.content.venture); assert.equal(command.relation.digest, target.digest); assert.equal(target.record.verification, 'UNVERIFIED');
  }
});

test('venture withdrawal and hidden publication retry receipts scrub every dossier field and sources', async () => {
  const target = await ventureItem(), {requests} = server([target]), h = harness(); await ready(h); h.click('Withdraw', h.card(target.id)); await h.flush(); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn'); h.click('Done'); await h.until('Withdrawn research');
  assert(!text(h.render()).includes(target.record.content.venture.issuer.name)); assert(!text(h.render()).includes(target.record.content.venture.issuer.website)); assert(!text(h.render()).includes(target.record.content.venture.risks[0])); assert(!text(h.render()).includes(target.record.content.venture.nextCatalyst.event)); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
  let first = true; const second = server([], async command => { if (first) { first = false; return Response.json({error: 'lost'}, {status: 503}); } return receipt(command, tombstone(await publication(command), 'HIDDEN')); }), retry = harness(); await ready(retry); retry.click('Publish research'); await retry.flush(); await chooseVenture(retry); await fillVenture(retry); retry.submit(); await retry.until('Outcome unknown'); retry.click('Retry same request'); await retry.until('content is hidden or withdrawn'); assert(!text(retry.render()).includes('Synthetic infrastructure company')); assert.equal(field(retry.render(), 'Venture issuer name'), undefined); const posts = second.requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('dedicated venture board anonymously filters pages and defaults new contributions to venture dossiers', async () => {
  const rows = (await Promise.all(Array.from({length: 21}, (_, index) => ventureItem({}, dossier({issuer: {...dossier().issuer, name: 'Synthetic venture ' + index}}))))).sort((a, b) => b.id.localeCompare(a.id)), first = rows.slice(0, 20), next = rows[20], cursor = first.at(-1).id, requests = [];
  globalThis.fetch = async path => { requests.push(path); if (path === '/api/research/me') return Response.json(me); return Response.json({version: 1, domain: 'VENTURE', items: path.includes('&cursor=') ? [next] : first, nextCursor: path.includes('&cursor=') ? null : cursor, executionEnabled: false}); };
  const h = harness({signedIn: false, ventureOnly: true}); await h.until(first[0].record.content.venture.issuer.name); assert(text(h.render()).includes('Latest venture dossiers')); assert.deepEqual(requests, ['/api/research?domain=VENTURE']); h.click('Next page'); await h.until(next.record.content.venture.issuer.name); assert(requests.includes('/api/research?domain=VENTURE&cursor=' + cursor)); assert.equal(h.card(first[0].id), undefined);
  const own = harness({signedIn: true, ventureOnly: true}); await ready(own); own.click('Publish research'); await own.flush(); assert.equal(field(own.render(), 'Research domain').props.value, 'VENTURE'); assert.equal(field(own.render(), 'Research domain').props.disabled, true); assert.equal(field(own.render(), 'Venture issuer name').props.value, '');
});

test('dedicated venture response rejects forged generic records, digest corruption and fake authority', async () => {
  const generic = await item(), venture = await ventureItem();
  for (const response of [{version: 1, domain: 'VENTURE', items: [generic], nextCursor: null, executionEnabled: false}, {version: 1, domain: 'VENTURE', items: [{...venture, digest: 'a'.repeat(64)}], nextCursor: null, executionEnabled: false}, {version: 1, domain: 'VENTURE', items: [venture], nextCursor: null, executionEnabled: true}]) { globalThis.fetch = async () => Response.json(response); const h = harness({signedIn: false, ventureOnly: true}); await h.until('Research unavailable'); assert.equal(h.card(generic.id), undefined); assert.equal(h.card(venture.id), undefined); }
});

test('crypto dossier requires explicit usage/tokenomics/liquidity states and never treats popularity as verified adoption', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Publish research'); await h.flush(); await chooseVenture(h); await fillVenture(h); h.field('Venture issuer kind', 'TOKEN'); await h.flush(); assert.equal(field(h.render(), 'Crypto dossier status').props.disabled, true); assert.equal(field(h.render(), 'Real product usage status').props.value, 'UNKNOWN'); h.field('Accept public research policy', true); await h.flush(); h.submit(); await h.until('Research recorded'); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.deepEqual(command.venture.crypto, {usage: {state: 'UNKNOWN'}, tokenomics: {state: 'UNKNOWN'}, liquidity: {state: 'UNKNOWN'}}); assert(requests.every(value => value.path.startsWith('/api/research')));
});

test('venture category pagination rejects canonical earlier pages or a repeated cursor rather than accepting a forged archive', async () => {
  const rows = (await Promise.all(Array.from({length: 21}, (_, index) => ventureItem({}, dossier({issuer: {...dossier().issuer, name: 'Venture cursor floor ' + index}}))))).sort((a, b) => b.id.localeCompare(a.id)), first = rows.slice(0, 20), cursor = first.at(-1).id;
  for (const repeat of [false, true]) {
    globalThis.fetch = async path => Response.json({version: 1, domain: 'VENTURE', items: path.includes('&cursor=') && !repeat ? first.slice(0, 19) : first, nextCursor: path.includes('&cursor=') && !repeat ? null : cursor, executionEnabled: false});
    const h = harness({signedIn: false, ventureOnly: true}); await h.until(tree => button(tree, 'Next page')); h.click('Next page'); await h.until('Research unavailable'); assert.equal(h.card(first[0].id), undefined); assert.equal(button(h.render(), 'Next page'), undefined);
  }
});
