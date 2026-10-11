import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Hook/event tests cover request sequencing and secret lifecycle. They are not browser rendering,
// visual/accessibility audits, native clipboard permission checks or hosted SIWC verification.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const clipboard = [];
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {writeText: async value => clipboard.push(value)}}});
const context = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0};
globalThis.__networkHooks = {
  useState(initial) { const id = context.si++; if (!(id in context.state)) context.state[id] = typeof initial === 'function' ? initial() : initial; return [context.state[id], next => context.state[id] = typeof next === 'function' ? next(context.state[id]) : next]; },
  useRef(initial) { return context.refs[context.ri++] ??= {current: initial}; },
  useEffect(callback, deps) { const id = context.ei++, previous = context.deps[id]; if (!previous || deps.some((value, index) => value !== previous[index])) { context.deps[id] = deps; context.effects.push(() => { context.cleanup[id]?.(); context.cleanup[id] = callback(); }); } },
};
const stubs = {
  react: 'export const {useState,useRef,useEffect}=globalThis.__networkHooks;',
  '@/components/ui/dialog': 'export const Dialog=()=>null,DialogContent=()=>null,DialogHeader=()=>null,DialogTitle=()=>null,DialogDescription=()=>null;',
};
const built = await build({entryPoints: ['app/network.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'network-hooks', setup(builder) {
  builder.onResolve({filter: /.*/}, args => args.importer.endsWith('/app/network.tsx') && args.path in stubs ? {path: args.path, namespace: 'stub'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'stub'}, args => ({contents: stubs[args.path], loader: 'js'}));
}}]});
const module = {exports: {}};
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
const Network = module.exports.default;
const modelBuild = await build({entryPoints: ['app/network-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const model = await import('data:text/javascript;base64,' + Buffer.from(modelBuild.outputFiles[0].text).toString('base64'));
const T = new Date().toISOString();
const later = days => new Date(Date.parse(T) + days * 86_400_000).toISOString();
function agent(command = {}, changes = {}) {
  return {id: command.id ?? crypto.randomUUID(), credentialId: command.credentialId ?? crypto.randomUUID(), name: command.name ?? 'Research companion', createdAt: T, expiresAt: later(command.days ?? 7), revision: 1, revokedAt: null, scope: 'PUBLIC_RESEARCH_SUBMIT', registrationRequestId: command.requestId ?? crypto.randomUUID(), revocationRequestId: null, ...changes};
}
const list = agents => ({version: 1, agents, maximumPerUser: 8, maximumNetwork: 1000, executionEnabled: false});
const receipt = value => ({version: 1, agent: value, executionEnabled: false});
function walk(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate));
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const field = (tree, name) => walk(tree, node => node.props?.['aria-label'] === name)[0];
function harness(props = {signedIn: true, githubUrl: null}) {
  context.cleanup.forEach(cleanup => cleanup?.());
  for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup']) context[key] = [];
  const render = () => { context.si = context.ri = context.ei = 0; return Network(props); };
  const flush = async () => { for (let i = 0; i < 10; i++) { render(); while (context.effects.length) context.effects.shift()(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  const until = async predicate => {
    const deadline = Date.now() + 5000;
    do { const tree = await flush(); if (typeof predicate === 'function' ? predicate(tree) : text(tree).includes(predicate)) return tree; } while (Date.now() < deadline);
    assert.fail('Timed out waiting for ' + predicate + ': ' + text(render()));
  };
  return {props, render, flush, until,
    click(name) { const found = button(render(), name); assert(found, 'missing ' + name); assert(!found.props.disabled, name + ' disabled'); found.props.onClick(); },
    field(name, value) { const found = field(render(), name); assert(found, 'missing field ' + name); found.props.onChange({target: {value}}); },
    submit() { const form = walk(render(), node => node.type === 'form')[0]; assert(form, 'missing form'); form.props.onSubmit({preventDefault() {}}); },
    close() { walk(render(), node => node.props?.onOpenChange)[0]?.props.onOpenChange(false); },
    unmount() { context.cleanup.forEach(cleanup => cleanup?.()); },
  };
}
function server(initial = [], post) {
  const requests = [], records = [...initial];
  globalThis.fetch = async (path, init = {}) => {
    requests.push({path, init});
    if (init.method !== 'POST') return Response.json(list(records));
    const command = JSON.parse(init.body);
    if (post) { const response = await post(command, records); if (response !== undefined) return response instanceof Response ? response : Response.json(response); }
    const current = records.find(value => value.id === command.id);
    const saved = command.action === 'register' ? agent(command) : {...current, revision: 2, revokedAt: T, revocationRequestId: command.requestId};
    records.splice(0, records.length, saved, ...records.filter(value => value.id !== saved.id));
    return Response.json(receipt(saved));
  };
  return {requests, records};
}
async function register(h, name = 'Evidence agent') {
  await h.until(tree => button(tree, 'Register agent')?.props.disabled === false);
  h.click('Register agent'); await h.flush(); h.field('Agent name', name); await h.flush(); h.submit();
}
after(() => {
  context.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; delete globalThis.__networkHooks;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
});

test('public portal uses a plain wordmark, honest planned states and ordinary SIWC anchors without private requests', async () => {
  const {requests} = server(), h = harness({signedIn: false, githubUrl: null});
  const tree = await h.flush();
  assert.equal(requests.length, 0); assert(text(tree).includes('OpenGrail')); assert(text(tree).includes('Planned'));
  assert(walk(tree, node => node.type === 'a').some(node => node.props.href === '/research'));
  assert(text(tree).includes('Publish research, define strategies and replay supplied data in Demo'));
  assert(walk(tree, node => node.type === 'a').some(node => node.props.href === '/demo'));
  assert(walk(tree, node => node.type === 'a' && node.props.href === '/contribute' && label(node).includes('Contributor guide')).length === 1);
  assert(!text(tree).includes('Research publishing and the Arena come next'));
  assert(text(tree).includes('Private repository access by invitation'));
  assert(!text(tree).includes('BUILD IN THE OPEN'));
  const guide = walk(tree, node => node.type === 'a' && node.props.href === '/agent-guide');
  assert.equal(guide.length, 1); assert.equal(guide[0].props.target, '_blank');
  assert(text(tree).includes('Public API participation needs no access to the private repository'));
  const anchors = walk(tree, node => node.type === 'a' && node.props.href === '/signin-with-chatgpt?return_to=/');
  assert(anchors.length >= 2); assert(anchors.every(node => node.props.target === '_top'));
  assert.equal(button(tree, 'Register agent'), undefined);
  assert.equal(walk(tree, node => node.type === 'img').length, 0);
});

test('repository contribution link only permits a credential-free HTTPS GitHub URL', async () => {
  for (const githubUrl of ['https://user:secret@github.com/open/research', 'javascript:alert(1)', 'https://example.com/source']) {
    server(); const h = harness({signedIn: false, githubUrl});
    assert(!walk(await h.flush(), node => node.type === 'a').some(node => node.props.href === githubUrl));
  }
  server(); const h = harness({signedIn: false, githubUrl: 'https://github.com/open/research'});
  assert(walk(await h.flush(), node => node.type === 'a').some(node => node.props.href === 'https://github.com/open/research' && label(node).includes('Private repository')));
});

test('signed-in agent listing stays account-specific and identifies enrollment without claiming an operational connection', async () => {
  const value = agent(), {requests} = server([value]), h = harness();
  const tree = await h.until(value.name);
  assert.equal(requests.length, 1); assert.equal(requests[0].path, '/api/network/agents');
  assert(text(tree).includes('Registered')); assert(text(tree).includes('Identity verification only') === false);
  assert(text(tree).includes('hosted agent connectivity has not been verified'));
  assert(!text(tree).includes('Connected')); assert(!requests.some(item => item.init.method === 'POST'));
});

test('registration sends only a digest, fixed lifetime and strict identities; the credential reveals after a correlated receipt', async () => {
  const {requests} = server(), h = harness();
  await register(h); const tree = await h.until('Copy credential');
  assert(text(tree).includes('leaving this page clears its in-memory copy'));
  const guide = walk(tree, node => node.type === 'a' && node.props.href === '/agent-guide');
  assert.equal(guide.length, 2); assert(guide.every(node => node.props.target === '_blank' && !node.props.href.includes('og_agent_')));
  const token = field(tree, 'Agent credential').props.value;
  assert.match(token, /^og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}$/);
  const post = requests.find(item => item.init.method === 'POST'), command = JSON.parse(post.init.body);
  assert.equal(command.tokenDigest, await model.networkDigest(token));
  assert.equal(command.credentialId, token.slice(9).split('.')[0]);
  assert.equal(command.days, 7); assert.equal(command.name, 'Evidence agent');
  assert.equal(post.init.headers['X-Network-Intent'], 'onboard');
  assert(!post.init.body.includes(token)); assert(!post.init.body.includes(token.split('.')[1]));
  assert.deepEqual(Object.keys(command).sort(), ['action', 'credentialId', 'days', 'id', 'name', 'requestId', 'tokenDigest']);
  assert(requests.every(item => !item.path.includes(token)));
  assert(text(tree).includes('Registration confirms an identity, not a tested hosted connection'));
  const copy = button(tree, 'Copy credential'); h.click('Copy credential'); await h.flush(); assert.equal(clipboard.at(-1), token);
  h.click('Done'); await h.flush(); assert.equal(field(h.render(), 'Agent credential'), undefined);
  const count = clipboard.length; copy.props.onClick(); await h.flush(); assert.equal(clipboard.length, count);
  h.click('Register agent'); await h.flush(); assert.equal(field(h.render(), 'Agent credential'), undefined);
});

test('credential durations use one, seven or thirty days and duplicate submits issue a single identity', async () => {
  for (const days of [1, 7, 30]) {
    const {requests} = server(), h = harness(); await h.until(tree => !button(tree, 'Register agent').props.disabled);
    h.click('Register agent'); await h.flush(); h.field('Agent name', 'Duration agent'); h.field('Credential expiry', String(days)); await h.flush();
    const submit = walk(h.render(), node => node.type === 'form')[0].props.onSubmit;
    submit({preventDefault() {}}); submit({preventDefault() {}});
    await h.until('Copy credential');
    const posts = requests.filter(item => item.init.method === 'POST'); assert.equal(posts.length, 1); assert.equal(JSON.parse(posts[0].init.body).days, days);
  }
});

test('unknown registration retains the original token and exact digest-only bytes until identical retry succeeds', async () => {
  let first = true;
  const {requests} = server([], command => { if (first) { first = false; return Response.json({error: 'unconfirmed'}, {status: 503}); } return receipt(agent(command)); });
  const h = harness(); await register(h); await h.until('Outcome unknown');
  assert.equal(field(h.render(), 'Agent credential'), undefined); assert(button(h.render(), 'Register & reveal credential').props.disabled);
  h.close(); assert(walk(h.render(), node => node.props?.open).length);
  const oldName = field(h.render(), 'Agent name').props.value; field(h.render(), 'Agent name').props.onChange({target: {value: 'Changed after uncertainty'}}); await h.flush();
  assert.equal(field(h.render(), 'Agent name').props.value, oldName);
  h.click('Retry same request'); const tree = await h.until('Copy credential');
  const posts = requests.filter(item => item.init.method === 'POST'); assert.equal(posts.length, 2); assert.equal(posts[0].init.body, posts[1].init.body);
  assert.equal(await model.networkDigest(field(tree, 'Agent credential').props.value), JSON.parse(posts[0].init.body).tokenDigest);
});

test('a lost acknowledgment during registration blocks close and double clicks while keeping secrets out of responses', async () => {
  let release;
  const {requests} = server([], command => new Promise(resolve => release = () => resolve(receipt(agent(command))))), h = harness();
  await register(h); await h.until('Registering…');
  h.submit(); h.close(); assert(walk(h.render(), node => node.props?.open).length); assert.equal(field(h.render(), 'Agent credential'), undefined);
  release(); await h.until('Copy credential'); assert.equal(requests.filter(item => item.init.method === 'POST').length, 1);
});

test('mismatched or authority-bearing receipts never reveal a credential and are reconciled with the original request', async () => {
  for (const alter of [value => ({...value, id: crypto.randomUUID()}), value => ({...value, credentialId: crypto.randomUUID()}), value => ({...value, name: 'Unrequested name'}), value => ({...value, registrationRequestId: crypto.randomUUID()}), value => ({...value, expiresAt: later(30)}), value => ({...value, token: 'server-plaintext'})]) {
    let first = true;
    const {requests} = server([], command => { const value = agent(command); if (first) { first = false; return receipt(alter(value)); } return receipt(value); }), h = harness();
    await register(h); await h.until('Outcome unknown'); assert.equal(field(h.render(), 'Agent credential'), undefined);
    h.click('Retry same request'); await h.until('Copy credential');
    const posts = requests.filter(item => item.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
  }
});

test('definitive pre-write rejection discards the original token and unlocks a fresh explicit registration', async () => {
  for (const status of [400, 404, 405, 409, 413, 415, 429]) {
    let first = true;
    const {requests} = server([], command => { if (first) { first = false; return Response.json({error: 'rejected'}, {status}); } return receipt(agent(command)); }), h = harness();
    await register(h); await h.until(tree => text(tree).includes('request was rejected') || text(tree).includes('Registration capacity'));
    assert.equal(button(h.render(), 'Retry same request'), undefined);
    h.field('Agent name', 'Replacement agent'); await h.flush(); h.submit(); await h.until('Copy credential');
    const posts = requests.filter(item => item.init.method === 'POST'), original = JSON.parse(posts[0].init.body), replacement = JSON.parse(posts[1].init.body);
    assert.notEqual(original.requestId, replacement.requestId); assert.notEqual(original.credentialId, replacement.credentialId); assert.notEqual(original.tokenDigest, replacement.tokenDigest);
  }
});

test('401 and 403 clear agent metadata and a pending credential; captured submits cannot restore access', async () => {
  for (const status of [401, 403]) {
    const {requests} = server([], () => Response.json({error: 'access'}, {status})), h = harness();
    await h.until(tree => !button(tree, 'Register agent').props.disabled); h.click('Register agent'); await h.flush(); h.field('Agent name', 'Private agent'); await h.flush();
    const stale = walk(h.render(), node => node.type === 'form')[0].props.onSubmit; stale({preventDefault() {}});
    await h.until('Sign in again'); stale({preventDefault() {}}); await h.flush();
    assert.equal(field(h.render(), 'Agent credential'), undefined); assert.equal(button(h.render(), 'Register agent'), undefined); assert.equal(requests.filter(item => item.init.method === 'POST').length, 1);
  }
});

test('authentication loss and unmount suppress late registration receipts and clear secrets', async () => {
  for (const ending of ['signout', 'unmount']) {
    let release;
    const {requests} = server([], command => new Promise(resolve => release = () => resolve(receipt(agent(command))))), h = harness();
    await register(h); await h.until('Registering…');
    const pending = context.refs.find(ref => ref?.current?.pending)?.current.pending;
    assert(pending?.token);
    if (ending === 'signout') { h.props.signedIn = false; await h.flush(); } else h.unmount();
    assert.equal(pending.token, null);
    release(); await h.flush(); assert.equal(field(h.render(), 'Agent credential'), undefined); assert.equal(requests.filter(item => item.init.method === 'POST').length, 1);
  }
});

test('a receipt from an earlier signed-in session cannot unlock or reveal a later registration', async () => {
  const held = [], posts = [];
  globalThis.fetch = async (path, init = {}) => {
    if (init.method !== 'POST') return Response.json(list([]));
    const command = JSON.parse(init.body); posts.push(command);
    return new Promise(resolve => held.push(() => resolve(Response.json(receipt(agent(command))))));
  };
  const h = harness(); await register(h, 'Earlier session'); await h.until('Registering…');
  h.props.signedIn = false; await h.flush(); h.props.signedIn = true; await h.flush();
  await register(h, 'Current session'); await h.until('Registering…');
  held[0](); await h.flush();
  assert.equal(field(h.render(), 'Agent credential'), undefined); assert(button(h.render(), 'Registering…').props.disabled);
  h.submit(); await h.flush(); assert.equal(posts.length, 2);
  held[1](); const tree = await h.until('Copy credential');
  assert.equal(await model.networkDigest(field(tree, 'Agent credential').props.value), posts[1].tokenDigest);
});

test('late reads after sign-out cannot restore another authentication session or private agent rows', async () => {
  let release;
  const value = agent(); globalThis.fetch = () => new Promise(resolve => release = resolve); const h = harness(); await h.flush();
  h.props.signedIn = false; await h.flush(); release(Response.json(list([value]))); await h.flush(); assert(!text(h.render()).includes(value.name));
  globalThis.fetch = async () => Response.json(list([])); h.props.signedIn = true; await h.until(tree => button(tree, 'Register agent')?.props.disabled === false);
  assert(!text(h.render()).includes(value.name));
});

test('revoke confirms a specific owned registration, sends no credential and retries the same revision after uncertainty', async () => {
  const value = agent(); let first = true;
  const {requests} = server([value], command => { if (first) { first = false; throw Error('Lost response.'); } return receipt({...value, revision: 2, revokedAt: T, revocationRequestId: command.requestId}); }), h = harness();
  await h.until(value.name); h.click('Revoke'); await h.flush(); assert.equal(requests.filter(item => item.init.method === 'POST').length, 0);
  h.click('Revoke credential'); await h.until('Outcome unknown'); h.close(); assert(walk(h.render(), node => node.props?.open).length);
  h.click('Retry same request'); await h.until('Agent credential revoked');
  const posts = requests.filter(item => item.init.method === 'POST'); assert.equal(posts.length, 2); assert.equal(posts[0].init.body, posts[1].init.body);
  assert.deepEqual(Object.keys(JSON.parse(posts[0].init.body)).sort(), ['action', 'id', 'requestId', 'revision']);
  assert.equal(field(h.render(), 'Agent credential'), undefined);
});

test('revoke receipts with different credential or request identities cannot confirm success', async () => {
  const value = agent(); let first = true;
  const {requests} = server([value], command => receipt({...value, revision: 2, revokedAt: T, revocationRequestId: command.requestId, ...(first ? (first = false, {credentialId: crypto.randomUUID()}) : {})})), h = harness();
  await h.until(value.name); h.click('Revoke'); await h.flush(); h.click('Revoke credential'); await h.until('Outcome unknown');
  assert(!text(h.render()).includes('Agent credential revoked')); h.click('Retry same request'); await h.until('Agent credential revoked');
  const posts = requests.filter(item => item.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('closed or replaced dialogs reject captured registration and revocation callbacks', async () => {
  const value = agent(), {requests} = server([value]), h = harness(); await h.until(value.name);
  h.click('Register agent'); await h.flush(); h.field('Agent name', 'Closed agent'); await h.flush();
  const oldSubmit = walk(h.render(), node => node.type === 'form')[0].props.onSubmit, oldClose = walk(h.render(), node => node.props?.onOpenChange)[0].props.onOpenChange;
  h.close(); h.click('Register agent'); await h.flush(); oldSubmit({preventDefault() {}}); oldClose(false); await h.flush(); assert(walk(h.render(), node => node.props?.open).length);
  assert.equal(requests.filter(item => item.init.method === 'POST').length, 0); h.close(); h.click('Revoke'); await h.flush(); const oldRevoke = button(h.render(), 'Revoke credential');
  h.close(); oldRevoke.props.onClick(); await h.flush(); assert.equal(requests.filter(item => item.init.method === 'POST').length, 0);
});

test('bounded and strict list parsing refuses malformed, duplicate, excessive and permission-bearing responses', async () => {
  const value = agent();
  const invalid = [
    'invalid JSON', ' '.repeat(32_769), JSON.stringify(list([value])).replace('{"version":1,', '{"version":1,"version":1,'),
    JSON.stringify({...list([value]), executionEnabled: true}), JSON.stringify(list([{...value, token: 'plaintext'}])),
    JSON.stringify(list([value, value])), JSON.stringify(list(Array.from({length: 9}, () => agent()))),
  ];
  for (const body of invalid) { globalThis.fetch = async () => new Response(body); const h = harness(); await h.until('agent list is unavailable'); assert(button(h.render(), 'Register agent').props.disabled); assert(!text(h.render()).includes(value.name)); }
});

test('eight retained registrations cap onboarding without silently deleting revoked or expired identities', async () => {
  const values = Array.from({length: 8}, (_, i) => agent({}, {name: 'Retained ' + i}));
  values[0] = {...values[0], revision: 2, revokedAt: T, revocationRequestId: crypto.randomUUID()};
  server(values); const h = harness(); const tree = await h.until('8/8 registrations retained');
  assert(button(tree, 'Register agent').props.disabled); assert(text(tree).includes('Revoked')); assert(text(tree).includes('Retained 0'));
});

test('the UI uses no token persistence, secret logging, downloads, token-bearing URLs or execution controls', async () => {
  const source = await readFile('app/network.tsx', 'utf8');
  assert(!/localStorage|sessionStorage|indexedDB|console\.(?:log|error|warn)|createObjectURL|download=/.test(source));
  assert(!/fetch\([^\n]*(?:token|credential)/.test(source));
  const {requests} = server(), h = harness(); await register(h); await h.until('Copy credential');
  assert(requests.every(item => item.path === '/api/network/agents'));
  assert(!walk(h.render(), node => node.type === 'button').some(node => /trade|execute|start demo|buy|sell/i.test(label(node))));
});
