import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

// Actual component hooks and the existing human handler, with synthetic authentication only.
// No browser, native clipboard, hosted sign-in, registration or publication acceptance is claimed.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch, originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const copies = []; Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {writeText: async value => copies.push(value)}}});
const context = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0, afterState: null};
globalThis.__sponsorHooks = {
  useState(initial) { const id = context.si++; if (!(id in context.state)) context.state[id] = initial; return [context.state[id], value => { context.state[id] = value; context.afterState?.(value); }]; },
  useRef(initial) { return context.refs[context.ri++] ??= {current: initial}; },
  useEffect(callback, deps) { const id = context.ei++, previous = context.deps[id]; if (!previous || deps.some((value, index) => value !== previous[index])) { context.deps[id] = deps; context.effects.push(() => { context.cleanup[id]?.(); context.cleanup[id] = callback(); }); } },
};
const built = await build({entryPoints: ['app/network-sponsor-identity.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2022', jsx: 'automatic', plugins: [{name: 'sponsor-hooks', setup(builder) {
  builder.onResolve({filter: /^react$/}, args => args.importer.endsWith('/app/network-sponsor-identity.tsx') ? {path: 'react', namespace: 'sponsor-stub'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'sponsor-stub'}, () => ({contents: 'export const {useState,useRef,useEffect}=globalThis.__sponsorHooks;', loader: 'js'}));
}}]});
const module = {exports: {}}; new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports); const Sponsor = module.exports.default;
const handlerBuild = await build({stdin: {contents: "export {taskDiscussionMeRequest} from './app/task-discussion-http.ts';export {contributionPublicHumanId} from './app/contribution-model.ts';", resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
const handler = await import('data:text/javascript;base64,' + Buffer.from(handlerBuild.outputFiles[0].text).toString('base64'));
const endpoint = '/api/contributions/discussion/me', user = {userId: 'synthetic-sponsor-owner-do-not-expose'}, own = await handler.contributionPublicHumanId(user.userId), other = await handler.contributionPublicHumanId('synthetic-other-owner');
const identity = sponsorId => ({version: 1, authorId: sponsorId, sponsorId, maintainer: false, executionEnabled: false});
function walk(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => walk(value, predicate)); return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)]; }
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }
const button = (tree, label) => walk(tree, node => node.type === 'button' && text(node) === label)[0];
const field = tree => walk(tree, node => node.type === 'input' && node.props['aria-label'] === 'Public sponsor ID')[0];
function harness(props = {enabled: true, isCurrent: () => true, onAuthenticationLost: () => {}}) {
  context.cleanup.forEach(value => value?.()); context.afterState = null; for (const name of ['state', 'refs', 'deps', 'effects', 'cleanup']) context[name] = [];
  const render = () => { context.si = context.ri = context.ei = 0; return Sponsor(props); };
  const flush = async () => { for (let i = 0; i < 6; i++) { render(); while (context.effects.length) context.effects.shift()(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  const until = async predicate => { const deadline = Date.now() + 5000; do { const tree = await flush(); if (predicate(tree)) return tree; } while (Date.now() < deadline); assert.fail('Sponsor UI did not reach its expected state: ' + text(render())); };
  return {props, render, flush, until, click(label) { const value = button(render(), label); assert(value, label); assert(!value.props.disabled); value.props.onClick(); }, unmount() { context.cleanup.forEach(value => value?.()); }};
}
function server(respond = () => Response.json(identity(own))) {
  const calls = []; globalThis.fetch = async (path, options) => { calls.push({path, options}); assert.equal(path, endpoint); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert(!('Authorization' in options.headers)); assert(!options.body); return respond(path, options); }; return calls;
}
after(() => { context.cleanup.forEach(value => value?.()); globalThis.fetch = originalFetch; delete globalThis.__sponsorHooks; if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator; });

test('explicit sponsor setup reads the actual human handler and copies only its public pseudonym after a fresh recheck', async () => {
  const calls = server(() => handler.taskDiscussionMeRequest(new Request('https://synthetic.test' + endpoint), user, () => false)), h = harness();
  const first = await h.flush(); assert.equal(first.type, 'details'); assert(!first.props.open); assert.equal(calls.length, 0); assert.equal(field(first), undefined);
  h.click('Show sponsor ID'); await h.until(tree => field(tree)?.props.value === own);
  const visible = field(h.render()); assert(visible.props.readOnly); assert.equal(visible.props.autoComplete, 'off'); assert(!text(h.render()).includes(user.userId));
  const before = copies.length; h.click('Copy sponsor ID'); await h.until(tree => !!button(tree, 'Sponsor ID copied'));
  assert.equal(calls.length, 2); assert.equal(copies.length, before + 1); assert.equal(copies.at(-1), own); assert(!copies.at(-1).includes('og_agent_'));
});

test('existing identity handler derives only the current human pseudonym and rejects anonymous or caller-selected identities', async () => {
  const response = await handler.taskDiscussionMeRequest(new Request('https://synthetic.test' + endpoint), user, () => false);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie, Authorization');
  const body = await response.json(); assert.deepEqual(body, identity(own)); assert(!JSON.stringify(body).includes(user.userId));
  assert.equal((await handler.taskDiscussionMeRequest(new Request('https://synthetic.test' + endpoint), null, () => true)).status, 401);
  assert.equal((await handler.taskDiscussionMeRequest(new Request('https://synthetic.test' + endpoint + '?sponsorId=' + other), user, () => false)).status, 400);
  const changed = await handler.taskDiscussionMeRequest(new Request('https://synthetic.test' + endpoint), {userId: 'synthetic-other-owner'}, () => false); assert.deepEqual(await changed.json(), identity(other));
});

test('complete identity validation rejects mismatched pseudonyms, extra private fields, privileges and corrupt bounded JSON', async () => {
  const cases = [Response.json({...identity(own), authorId: other}), Response.json({...identity(own), ownerId: user.userId}), Response.json({...identity(own), executionEnabled: true}), Response.json({...identity(own), maintainer: 'yes'}), new Response(JSON.stringify(identity(own)).replace('"version":1', '"version":1,"version":1'), {headers: {'Content-Type': 'application/json'}}), new Response(' '.repeat(1025), {headers: {'Content-Type': 'application/json'}}), new Response(new Uint8Array([0xff]), {headers: {'Content-Type': 'application/json'}})];
  for (const response of cases) {
    const calls = server(() => response), h = harness(), before = copies.length; await h.flush(); h.click('Show sponsor ID'); await h.until(tree => text(tree).includes('Sponsor identity unavailable'));
    assert.equal(field(h.render()), undefined); assert.equal(button(h.render(), 'Copy sponsor ID'), undefined); assert.equal(calls.length, 1); assert.equal(copies.length, before);
  }
});

test('copy rechecks a changed current human before clipboard dispatch and clears the obsolete identity', async () => {
  let reads = 0; const calls = server(() => Response.json(identity(++reads === 1 ? own : other))), h = harness(); await h.flush(); h.click('Show sponsor ID'); await h.until(tree => !!field(tree));
  const before = copies.length; h.click('Copy sponsor ID'); await h.until(tree => text(tree).includes('Your sponsor identity changed'));
  assert.equal(field(h.render()), undefined); assert.equal(copies.length, before); assert.equal(calls.length, 2);
  h.click('Show sponsor ID'); await h.until(tree => field(tree)?.props.value === other);
});

test('clipboard refusal preserves the freshly checked manually selectable pseudonym without claiming success', async () => {
  server(); const h = harness(); await h.flush(); h.click('Show sponsor ID'); await h.until(tree => !!field(tree));
  const previous = navigator.clipboard.writeText; navigator.clipboard.writeText = async () => { throw Error('Synthetic clipboard denial'); };
  try { h.click('Copy sponsor ID'); await h.until(tree => text(tree).includes('copy it manually')); assert.equal(field(h.render()).props.value, own); assert(field(h.render()).props.readOnly); assert.equal(button(h.render(), 'Sponsor ID copied'), undefined); assert.equal(walk(h.render(), node => node.props?.role === 'status').length, 0); }
  finally { navigator.clipboard.writeText = previous; }
});

test('401 and 403 clear a previously shown identity and invoke the existing authentication-loss boundary', async () => {
  for (const status of [401, 403]) {
    let active = true, lost = 0, reads = 0; const calls = server(() => ++reads === 1 ? Response.json(identity(own)) : new Response(null, {status}));
    const h = harness({enabled: true, isCurrent: () => active, onAuthenticationLost: () => { lost++; active = false; }}); await h.flush(); h.click('Show sponsor ID'); await h.until(tree => !!field(tree));
    const captured = button(h.render(), 'Copy sponsor ID'), before = copies.length; h.click('Copy sponsor ID'); await h.until(() => lost === 1);
    assert.equal(field(h.render()), undefined); captured.props.onClick(); await h.flush(); assert.equal(calls.length, 2); assert.equal(copies.length, before);
  }
});

test('same-turn parent invalidation and disabled setup reject captured copy callbacks before another read', async () => {
  let active = true; const calls = server(), h = harness({enabled: true, isCurrent: () => active, onAuthenticationLost: () => {}}); await h.flush(); h.click('Show sponsor ID'); await h.until(tree => !!field(tree));
  const captured = button(h.render(), 'Copy sponsor ID'), before = copies.length; active = false; captured.props.onClick(); assert.equal(calls.length, 1); assert.equal(copies.length, before);
  h.props.enabled = false; await h.flush(); assert.equal(field(h.render()), undefined); assert(button(h.render(), 'Show sponsor ID').props.disabled);
});

test('late identity reads cannot restore disabled or unmounted setup', async () => {
  for (const ended of ['DISABLED', 'UNMOUNTED']) {
    let finish; const calls = server(() => new Promise(resolve => finish = resolve)), h = harness(); await h.flush(); h.click('Show sponsor ID'); await h.flush(); assert.equal(calls.length, 1);
    if (ended === 'DISABLED') { h.props.enabled = false; await h.flush(); } else h.unmount();
    assert(calls[0].options.signal.aborted); finish(Response.json(identity(own))); await h.flush(); assert.equal(field(h.render()), undefined); assert.equal(button(h.render(), 'Sponsor ID copied'), undefined);
  }
});

test('a late clipboard completion cannot restore copied feedback after the parent session ends', async () => {
  let active = true, finish; server(); const h = harness({enabled: true, isCurrent: () => active, onAuthenticationLost: () => {}}); await h.flush(); h.click('Show sponsor ID'); await h.until(tree => !!field(tree));
  const previous = navigator.clipboard.writeText; navigator.clipboard.writeText = () => new Promise(resolve => finish = resolve);
  try { h.click('Copy sponsor ID'); await h.until(() => typeof finish === 'function'); active = false; h.props.enabled = false; await h.flush(); finish(); await h.flush(); assert.equal(field(h.render()), undefined); assert.equal(button(h.render(), 'Sponsor ID copied'), undefined); }
  finally { navigator.clipboard.writeText = previous; }
});


test('parent invalidation before the deferred read factory prevents request dispatch', async () => {
  let active = true; const calls = server(), h = harness({enabled: true, isCurrent: () => active, onAuthenticationLost: () => {}}); await h.flush();
  h.click('Show sponsor ID'); active = false; h.props.enabled = false; await h.flush();
  assert.equal(calls.length, 0); assert.equal(field(h.render()), undefined);
});
test('parent invalidation between fresh identity presentation and the deferred clipboard factory prevents copying', async () => {
  let active = true; const calls = server(), h = harness({enabled: true, isCurrent: () => active, onAuthenticationLost: () => {}}); await h.flush(); h.click('Show sponsor ID'); await h.until(tree => !!field(tree));
  const before = copies.length;
  // Simulate an independent parent auth transition as the newly checked ID is presented,
  // before the next microtask starts the native clipboard operation. No private state index is used.
  context.afterState = value => { if (value === own) { active = false; context.afterState = null; } };
  h.click('Copy sponsor ID'); await h.until(() => !active); h.props.enabled = false; await h.flush();
  assert.equal(calls.length, 2); assert.equal(copies.length, before); assert.equal(field(h.render()), undefined); assert.equal(button(h.render(), 'Sponsor ID copied'), undefined);
});
