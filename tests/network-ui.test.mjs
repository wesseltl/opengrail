import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';

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
const navigationBuild = await build({entryPoints: ['app/main-navigation.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2022', jsx: 'automatic'});
const navigationModule = {exports: {}};
new Function('require', 'module', 'exports', navigationBuild.outputFiles[0].text)(require, navigationModule, navigationModule.exports);
const MainNavigation = navigationModule.exports.MainNavigation;
const modelBuild = await build({entryPoints: ['app/network-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const model = await import('data:text/javascript;base64,' + Buffer.from(modelBuild.outputFiles[0].text).toString('base64'));
const researchModelBuild = await build({entryPoints: ['app/research-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const researchModel = await import('data:text/javascript;base64,' + Buffer.from(researchModelBuild.outputFiles[0].text).toString('base64'));
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
const details = (tree, name) => walk(tree, node => node.props?.role === 'group' && node.props['aria-label'] === name)[0];
function expectDetails(group, value) {
  assert(group, 'missing confirmed or retained agent details');
  assert.deepEqual(walk(group, node => node.type === 'code').map(text), [value.id, value.credentialId, value.scope]);
  const expiry = walk(group, node => node.type === 'time')[0];
  assert.equal(expiry.props.dateTime, value.expiresAt); assert.equal(text(expiry), value.expiresAt);
}
async function settleWithoutRender() {
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
}
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
  const hero = walk(tree, node => node.type === 'section' && node.props.className === 'og-hero')[0];
  const primary = walk(hero, node => node.type === 'a' && node.props.className === 'og-button og-primary');
  assert.equal(primary.length, 1); assert.equal(label(primary[0]), 'Try an example');
  assert.equal(primary[0].props.href, '/demo');
  assert.equal(primary[0].props.onClick, undefined); assert.equal(primary[0].props.target, undefined);
  const browse = walk(hero, node => node.type === 'a' && label(node).includes('Browse strategies'))[0];
  assert.equal(browse.props.href, '/strategies'); assert.equal(browse.props.className, 'og-button og-secondary');
  assert(text(hero).includes('Published strategies are untested'));
  assert(text(walk(hero, node => node.type === 'h1')[0]).includes('Test trading strategies before risking money'));
  assert(text(hero).includes('people and AI agents'));
  assert(text(hero).includes('No sign-in needed'));
  const how = walk(hero, node => node.type === 'section' && node.props['aria-labelledby'] === 'how-it-works-title')[0];
  assert(how); assert.equal(walk(how, node => node.type === 'ol').length, 1);
  assert.equal(walk(how, node => node.type === 'li').length, 3);
  assert.equal(walk(how, node => node.type === 'a').length, 0, 'the explanation must not compete with the example action');
  assert(text(how).includes('fees, slippage and risk limits')); assert(text(how).includes('losses and drawdown'));
  const navigation = walk(tree, node => node.type === 'nav' && node.props['aria-label'] === 'Main navigation')[0];
  const directLinks = [navigation.props.children].flat(Infinity).filter(node => node?.type === 'a');
  assert.deepEqual(directLinks.map(node => node.props.href), ['/strategies', '/demo', '/research', '/agent-guide']);
  assert.equal(label(directLinks.find(node => node.props.href === '/agent-guide')), 'For agents');
  const more = walk(navigation, node => node.type === 'details' && node.props.className === 'og-workspaces')[0];
  assert.equal(label(walk(more, node => node.type === 'summary')[0]), 'More'); assert(!more.props.open);
  assert.deepEqual(walk(navigation, node => node.type === 'a').map(node => node.props.href).sort(), ['#agents', '/agent-guide', '/arena', '/assistance', '/assistance/research', '/contribute', '/demo', '/documents', '/experiments', '/program', '/research', '/search', '/session', '/strategies', '/validation', '/venture'].sort());
  const contributorDetails = walk(tree, node => node.type === 'details' && node.props.className === 'og-home-details')[0];
  assert(contributorDetails); assert(!contributorDetails.props.open);
  assert(walk(contributorDetails, node => node.type === 'a' && node.props.href === '/api/network/capabilities').length === 1);
  assert(walk(tree, node => node.type === 'a').some(node => node.props.href === '/demo'));
  assert(walk(tree, node => node.type === 'a' && node.props.href === '/contribute' && label(node).includes('Contributor guide')).length === 1);
  assert(!text(tree).includes('Research publishing and the Arena come next'));
  assert(text(tree).includes('Repository link not configured'));
  assert(!text(tree).includes('PRIVATE SOURCE'));
  assert(walk(tree, node => node.type === 'details' && node.props.className === 'og-workspaces').length === 1);
  assert(walk(tree, node => node.type === 'a' && node.props.href === '/assistance/research').length === 1);
  assert(!text(tree).includes('BUILD IN THE OPEN'));
  const guide = walk(tree, node => node.type === 'a' && node.props.href === '/agent-guide' && label(node).includes('Agent quickstart'));
  assert.equal(guide.length, 1); assert.equal(guide[0].props.target, '_blank');
  assert(text(tree).includes('Public API participation needs no repository access'));
  const anchors = walk(tree, node => node.type === 'a' && node.props.href === '/signin-with-chatgpt?return_to=/');
  assert(anchors.length >= 2); assert(anchors.every(node => node.props.target === '_top'));
  assert.equal(button(tree, 'Register agent'), undefined);
  assert.equal(walk(tree, node => node.type === 'img').length, 0);
});

test('shared navigation keeps workspace agent access and current destinations precise when pages add routes', () => {
  const tree = MainNavigation({activeHref: '/arena', extraLinks: [
    {href: '/strategies', label: 'Duplicate primary'}, {href: '/arena', label: 'Duplicate secondary'},
    {href: '/agent-guide', label: 'Duplicate agent entry'},
    {href: '/research-policy', label: 'Research policy'}, {href: '/research-policy', label: 'Duplicate extra'},
  ]});
  const links = walk(tree, node => node.type === 'a'), destinations = links.map(node => node.props.href);
  assert.equal(new Set(destinations).size, destinations.length);
  assert(destinations.includes('/#agents')); assert(!destinations.includes('#agents'));
  assert.equal(links.find(node => node.props.href === '/research-policy').props.children, 'Research policy');
  assert.deepEqual(links.filter(node => node.props['aria-current'] === 'page').map(node => node.props.href), ['/arena']);
  const more = walk(tree, node => node.type === 'details')[0];
  assert(!more.props.open); assert.equal(more.props.role, undefined);
  assert(walk(more, node => node.type === 'a' && node.props.href === '/arena').length === 1);
  assert(links.every(node => node.props.tabIndex === undefined && node.props.onClick === undefined));
  const unknown = MainNavigation({activeHref: '/research-policy/unknown'});
  assert.equal(walk(unknown, node => node.props?.['aria-current'] === 'page').length, 0);
});

test('repository contribution link only permits a credential-free HTTPS GitHub URL', async () => {
  for (const githubUrl of ['https://user:secret@github.com/open/research', 'javascript:alert(1)', 'https://example.com/source']) {
    server(); const h = harness({signedIn: false, githubUrl});
    assert(!walk(await h.flush(), node => node.type === 'a').some(node => node.props.href === githubUrl));
  }
  server(); const h = harness({signedIn: false, githubUrl: 'https://github.com/open/research'});
  assert(walk(await h.flush(), node => node.type === 'a').some(node => node.props.href === 'https://github.com/open/research' && label(node).includes('View source on GitHub')));
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
  const guide = walk(tree, node => node.type === 'a' && node.props.href === '/agent-guide' && label(node).toLowerCase().includes('quickstart'));
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

test('confirmed identity handoff survives failed list refresh and supplies the distinct expected agent ID to the safe client', async () => {
  let saved, enrollment, reads = 0;
  globalThis.fetch = async (path, init = {}) => {
    assert.equal(path, '/api/network/agents');
    if (init.method === 'POST') { enrollment = JSON.parse(init.body); saved = agent(enrollment); return Response.json(receipt(saved)); }
    return ++reads === 1 ? Response.json(list([])) : Response.json({error: 'unavailable'}, {status: 503});
  };
  const h = harness(); await register(h); await h.until('Copy credential');
  const tree = await h.until('Your agent list is unavailable');
  expectDetails(details(tree, 'Confirmed agent details'), saved);
  const token = field(tree, 'Agent credential').props.value;
  assert.notEqual(saved.id, saved.credentialId); assert.equal(token.slice(9).split('.')[0], saved.credentialId);
  h.click('Copy confirmed agent details'); await h.flush();
  const copiedBody = clipboard.at(-1), copied = JSON.parse(copiedBody);
  assert.deepEqual(copied, {agentId: saved.id, credentialId: saved.credentialId, scope: saved.scope, expiresAt: saved.expiresAt});
  assert(!copiedBody.includes(token)); assert(!copiedBody.includes(token.split('.')[1])); assert(!copiedBody.includes(enrollment.tokenDigest));
  const calls = [], transport = async (url, init) => {
    calls.push({url, init}); assert.equal(url, 'https://opengrail.test/api/network/agent');
    assert.equal(init.method, 'GET'); assert.equal(init.headers.Authorization, 'Bearer ' + token); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
    return Response.json({version: 1, agent: {id: saved.id, name: saved.name, credentialId: saved.credentialId, expiresAt: saved.expiresAt, scope: saved.scope}, executionEnabled: false});
  };
  for (const expectedId of [copied.agentId, copied.credentialId]) {
    const boundary = createOpenGrailAgentBoundary({baseOrigin: 'https://opengrail.test', credential: token, agentId: expectedId, fetch: transport});
    try { const result = await boundary.controller.identify(); assert.equal(result.disposition, expectedId === saved.id ? 'IDENTIFIED' : 'IDENTITY_UNAVAILABLE'); }
    finally { boundary.controller.close(); }
  }
  assert.equal(calls.length, 2);
});

test('retained active, expired and revoked registration details copy exact nonsecret metadata without recovering a credential', async () => {
  const active = agent({}, {name: 'Current registration'});
  const expired = agent({}, {name: 'Expired registration', createdAt: new Date(Date.parse(T) - 8 * 86_400_000).toISOString(), expiresAt: new Date(Date.parse(T) - 86_400_000).toISOString()});
  const revoked = agent({}, {name: 'Revoked registration', revision: 2, revokedAt: T, revocationRequestId: crypto.randomUUID()});
  const {requests} = server([active, expired, revoked]), h = harness(); const tree = await h.until(revoked.name);
  assert(text(tree).includes('Registered')); assert(text(tree).includes('Expired')); assert(text(tree).includes('Revoked'));
  for (const value of [active, expired, revoked]) {
    expectDetails(details(tree, `Registration details for ${value.id}`), value);
    h.click(`Copy agent details for ${value.id}`); await h.flush();
    const body = clipboard.at(-1); assert.deepEqual(JSON.parse(body), {agentId: value.id, credentialId: value.credentialId, scope: value.scope, expiresAt: value.expiresAt});
    assert(!body.includes('og_agent_')); assert(!body.includes('tokenDigest')); assert(!body.includes('sponsor'));
  }
  assert.equal(field(h.render(), 'Agent credential'), undefined); assert(!requests.some(item => item.init.method === 'POST'));
});

test('agent-details clipboard failure leaves exact manually selectable metadata and adds no secret or connection request', async () => {
  const value = agent(), {requests} = server([value]), h = harness(); await h.until(value.name);
  const previous = navigator.clipboard.writeText;
  navigator.clipboard.writeText = async () => { throw Error('Synthetic clipboard refusal.'); };
  try {
    h.click(`Copy agent details for ${value.id}`); const tree = await h.until('Select the agent details and copy them manually');
    expectDetails(details(tree, `Registration details for ${value.id}`), value);
    assert.equal(field(tree, 'Agent credential'), undefined); assert.equal(requests.length, 1);
  } finally { navigator.clipboard.writeText = previous; }
});

test('credential and confirmed-details retries replace only their own clipboard feedback and preserve API errors', async () => {
  let saved, reads = 0;
  globalThis.fetch = async (path, init = {}) => {
    assert.equal(path, '/api/network/agents');
    if (init.method === 'POST') { saved = agent(JSON.parse(init.body)); return Response.json(receipt(saved)); }
    return ++reads === 1 ? Response.json(list([])) : Response.json({error: 'Synthetic unavailable'}, {status: 503});
  };
  const h = harness(); await register(h); await h.until('Your agent list is unavailable');
  const tree = await h.until('Copy credential'), credentialCopy = button(tree, 'Copy credential'), detailsCopy = button(tree, 'Copy confirmed agent details');
  const credentialError = 'Select the credential and copy it manually', detailsError = 'Select the agent details and copy them manually';
  const previous = navigator.clipboard.writeText; let fail = true;
  navigator.clipboard.writeText = async body => { clipboard.push(body); if (fail) throw Error('Synthetic clipboard refusal.'); };
  const checkApiError = () => assert(text(h.render()).includes('Your agent list is unavailable'), 'Clipboard feedback must preserve the unrelated list failure.');
  try {
    credentialCopy.props.onClick(); await h.flush(); detailsCopy.props.onClick(); await h.flush();
    assert(text(h.render()).includes(credentialError)); assert(text(details(h.render(), 'Confirmed agent details')).includes(detailsError));
    assert(!text(details(h.render(), 'Confirmed agent details')).includes(credentialError)); checkApiError();

    fail = false; credentialCopy.props.onClick();
    assert(!text(h.render()).includes(credentialError), 'A new credential attempt clears its error before completion.');
    await h.flush();
    assert(button(h.render(), 'Copied')); assert(!text(h.render()).includes(credentialError));
    assert(text(details(h.render(), 'Confirmed agent details')).includes(detailsError)); checkApiError();
    fail = true; credentialCopy.props.onClick();
    assert.equal(button(h.render(), 'Copied'), undefined, 'A new credential attempt resets old success before completion.');
    await h.flush();
    assert(button(h.render(), 'Copy credential')); assert.equal(button(h.render(), 'Copied'), undefined);
    assert(text(h.render()).includes(credentialError)); checkApiError();

    fail = false; detailsCopy.props.onClick();
    assert(!text(h.render()).includes(detailsError), 'A new details attempt clears only its own error before completion.');
    await h.flush();
    assert(text(details(h.render(), 'Confirmed agent details')).includes('Details copied'));
    assert(!text(h.render()).includes(detailsError)); assert(text(h.render()).includes(credentialError)); checkApiError();
    fail = true; detailsCopy.props.onClick();
    assert(!text(details(h.render(), 'Confirmed agent details')).includes('Details copied'), 'A new details attempt resets old success before completion.');
    await h.flush();
    assert(!text(details(h.render(), 'Confirmed agent details')).includes('Details copied'));
    assert(text(details(h.render(), 'Confirmed agent details')).includes(detailsError)); checkApiError();

    h.click('Done'); await h.flush();
    assert(!text(h.render()).includes(credentialError)); assert(!text(h.render()).includes(detailsError));
    globalThis.fetch = async () => Response.json(list([saved])); h.click('Refresh agents'); await h.until(saved.name);
    h.click('Register agent'); await h.flush();
    assert(!text(h.render()).includes(credentialError)); assert(!text(h.render()).includes(detailsError));
  } finally { navigator.clipboard.writeText = previous; h.unmount(); }
});

test('only the latest overlapping credential, confirmed-details or retained-details copy can set success or error', async () => {
  for (const kind of ['credential', 'confirmed', 'retained']) for (const latest of ['SUCCESS', 'FAILURE']) {
    const value = agent(), {requests} = server(kind === 'retained' ? [value] : []), h = harness();
    if (kind === 'retained') await h.until(value.name); else { await register(h); await h.until('Copy credential'); }
    const copy = button(h.render(), kind === 'credential' ? 'Copy credential' : kind === 'confirmed' ? 'Copy confirmed agent details' : `Copy agent details for ${value.id}`);
    const previous = navigator.clipboard.writeText, held = [], beforeRequests = requests.length;
    navigator.clipboard.writeText = body => { clipboard.push(body); return new Promise((resolve, reject) => held.push({resolve, reject})); };
    const settle = (index, result) => result === 'SUCCESS' ? held[index].resolve() : held[index].reject(Error('Synthetic delayed clipboard refusal.'));
    const checkLatest = () => {
      const tree = h.render(), group = kind === 'credential' ? tree : details(tree, kind === 'confirmed' ? 'Confirmed agent details' : `Registration details for ${value.id}`);
      if (kind === 'credential') assert.equal(!!button(tree, 'Copied'), latest === 'SUCCESS');
      else assert.equal(text(group).includes('Details copied'), latest === 'SUCCESS');
      assert.equal(text(group).includes(kind === 'credential' ? 'Select the credential and copy it manually' : 'Select the agent details and copy them manually'), latest === 'FAILURE');
    };
    try {
      copy.props.onClick(); copy.props.onClick(); assert.equal(held.length, 2, 'Exercise overlap before React renders.');
      settle(1, latest); await h.flush(); checkLatest();
      settle(0, latest === 'SUCCESS' ? 'FAILURE' : 'SUCCESS'); await settleWithoutRender(); checkLatest();
      assert.equal(requests.length, beforeRequests, 'Clipboard retries cannot send additional network commands.');
    } finally { held.forEach(operation => operation.resolve()); await settleWithoutRender(); navigator.clipboard.writeText = previous; h.unmount(); }
  }
});

test('late credential copy success or failure cannot restore feedback after same-turn close or sign-out', async () => {
  for (const ending of ['close', 'signout']) for (const result of ['SUCCESS', 'FAILURE']) {
    server(); const h = harness(); await register(h); const tree = await h.until('Copy credential'), copy = button(tree, 'Copy credential');
    const previous = navigator.clipboard.writeText; let complete;
    navigator.clipboard.writeText = body => { clipboard.push(body); return new Promise((resolve, reject) => complete = () => result === 'SUCCESS' ? resolve() : reject(Error('Synthetic late refusal.'))); };
    try {
      const before = clipboard.length; copy.props.onClick(); assert.equal(clipboard.length, before + 1);
      if (ending === 'close') button(tree, 'Done').props.onClick();
      else walk(tree, node => node.type === 'a' && label(node) === 'Sign out')[0].props.onClick();
      copy.props.onClick(); assert.equal(clipboard.length, before + 1, 'A captured callback must stop before a render.');
      complete(); await settleWithoutRender(); const after = h.render();
      assert.equal(field(after, 'Agent credential'), undefined); assert.equal(button(after, 'Copied'), undefined);
      assert(!text(after).includes('Select the credential and copy it manually'));
    } finally { complete?.(); await settleWithoutRender(); navigator.clipboard.writeText = previous; h.unmount(); }
  }
});

test('removed rows, closed reveals and lost authentication reject captured metadata copy handlers', async () => {
  const value = agent(), {records} = server([value]), h = harness(); await h.until(value.name);
  const oldRetained = button(h.render(), `Copy agent details for ${value.id}`), count = clipboard.length;
  records.splice(0); h.click('Refresh agents'); await h.until('No agents registered');
  oldRetained.props.onClick(); await h.flush(); assert.equal(clipboard.length, count);
  await register(h); await h.until('Copy credential');
  const oldConfirmed = button(h.render(), 'Copy confirmed agent details');
  h.click('Done'); await h.flush(); oldConfirmed.props.onClick(); await h.flush(); assert.equal(clipboard.length, count);
  assert.equal(details(h.render(), 'Confirmed agent details'), undefined);
  h.props.signedIn = false; await h.flush(); oldRetained.props.onClick(); oldConfirmed.props.onClick(); await h.flush();
  assert.equal(clipboard.length, count); assert.equal(details(h.render(), `Registration details for ${value.id}`), undefined);
});

test('late metadata clipboard completion cannot restore a closed reveal or confirm a later form', async () => {
  server(); const h = harness(); await register(h); await h.until('Copy credential');
  const previous = navigator.clipboard.writeText; let complete;
  navigator.clipboard.writeText = body => { clipboard.push(body); return new Promise(resolve => complete = resolve); };
  try {
    h.click('Copy confirmed agent details'); await h.flush(); assert.equal(typeof complete, 'function');
    h.click('Done'); await h.flush(); h.click('Register agent'); await h.flush();
    complete(); await h.flush(); assert(!text(h.render()).includes('Details copied')); assert.equal(details(h.render(), 'Confirmed agent details'), undefined);
    const held = context.refs.find(ref => ref?.current?.confirmedRegistration !== undefined)?.current;
    assert.equal(held.confirmedRegistration, null); assert.equal(field(h.render(), 'Agent credential'), undefined);
  } finally { navigator.clipboard.writeText = previous; }
});

test('retained metadata copy rejects a same-turn unresolved refresh and never reuses an earlier validated generation', async () => {
  const value = agent(); let reads = 0, releaseRefresh;
  globalThis.fetch = async () => ++reads === 1 ? Response.json(list([value])) : new Promise(resolve => releaseRefresh = resolve);
  const h = harness(), tree = await h.until(value.name), copy = button(tree, `Copy agent details for ${value.id}`), refresh = button(tree, 'Refresh agents');
  const count = clipboard.length;
  try {
    refresh.props.onClick(); copy.props.onClick();
    assert.equal(clipboard.length, count, 'A refresh must invalidate copying before React renders.');
    releaseRefresh(Response.json(list([value]))); await settleWithoutRender();
    assert.equal(context.refs.find(ref => ref?.current?.reads instanceof Set).current.reads.size, 0, 'The fresh read must settle without rendering the component.');
    copy.props.onClick(); assert.equal(clipboard.length, count, 'Identical fresh rows must not restore an old callback generation.');
    await h.flush(); h.click(`Copy agent details for ${value.id}`); await h.flush();
    assert.equal(clipboard.length, count + 1); assert.equal(JSON.parse(clipboard.at(-1)).agentId, value.id);
  } finally { releaseRefresh?.(Response.json(list([value]))); await h.flush(); }
});

test('retained clipboard completion cannot confirm an unresolved, failed, corrupt, changed or replaced list before render', async () => {
  for (const outcome of ['UNRESOLVED', 'FAILED', 'CORRUPT', 'CHANGED', 'IDENTICAL']) {
    const value = agent(), changed = {...value, revision: 2, revokedAt: T, revocationRequestId: crypto.randomUUID()};
    let reads = 0, releaseRefresh, completeCopy;
    globalThis.fetch = async () => ++reads === 1 ? Response.json(list([value])) : new Promise(resolve => releaseRefresh = resolve);
    const h = harness(), tree = await h.until(value.name), copy = button(tree, `Copy agent details for ${value.id}`), refresh = button(tree, 'Refresh agents');
    const previous = navigator.clipboard.writeText;
    navigator.clipboard.writeText = body => { clipboard.push(body); return new Promise(resolve => completeCopy = resolve); };
    try {
      const count = clipboard.length; copy.props.onClick(); assert.equal(clipboard.length, count + 1);
      refresh.props.onClick();
      if (outcome !== 'UNRESOLVED') {
        releaseRefresh(outcome === 'FAILED' ? Response.json({error: 'synthetic unavailable'}, {status: 503}) : outcome === 'CORRUPT' ? Response.json({...list([value]), executionEnabled: true}) : Response.json(list([outcome === 'CHANGED' ? changed : value])));
        await settleWithoutRender();
      }
      assert.equal(context.refs.find(ref => ref?.current?.reads instanceof Set).current.reads.size, outcome === 'UNRESOLVED' ? 1 : 0, 'Exercise the declared read phase before clipboard completion.');
      completeCopy(); await settleWithoutRender();
      assert(!context.state.includes(`retained:${value.id}`), `${outcome}: stale copied feedback must not be installed before a render.`);
      copy.props.onClick(); assert.equal(clipboard.length, count + 1, `${outcome}: old callbacks must not dispatch after refresh settlement.`);
      assert(!text(h.render()).includes('Details copied'));
    } finally {
      releaseRefresh?.(Response.json(list([value]))); completeCopy?.(); await h.flush(); navigator.clipboard.writeText = previous;
    }
  }
});

test('confirmed receipt details and credential remain copyable while their following list refresh is unresolved', async () => {
  let saved, reads = 0, releaseRefresh;
  globalThis.fetch = async (path, init = {}) => {
    assert.equal(path, '/api/network/agents');
    if (init.method === 'POST') { saved = agent(JSON.parse(init.body)); return Response.json(receipt(saved)); }
    return ++reads === 1 ? Response.json(list([])) : new Promise(resolve => releaseRefresh = resolve);
  };
  const h = harness();
  try {
    await register(h); const tree = await h.until('Copy credential');
    expectDetails(details(tree, 'Confirmed agent details'), saved);
    const token = field(tree, 'Agent credential').props.value;
    h.click('Copy confirmed agent details'); await h.flush(); assert.equal(JSON.parse(clipboard.at(-1)).agentId, saved.id);
    h.click('Copy credential'); await h.flush(); assert.equal(clipboard.at(-1), token);
    releaseRefresh(Response.json({error: 'synthetic unavailable'}, {status: 503})); await h.until('Your agent list is unavailable');
    expectDetails(details(h.render(), 'Confirmed agent details'), saved);
  } finally { releaseRefresh?.(Response.json(list(saved ? [saved] : []))); await h.flush(); }
});

test('active confirmed and retained copy callbacks and delayed success or failure stay blocked after same-turn sign-out', async () => {
  for (const kind of ['confirmed', 'retained']) for (const completion of ['SUCCESS', 'FAILURE']) {
    const value = agent(); server(kind === 'retained' ? [value] : []); const h = harness();
    if (kind === 'confirmed') { await register(h); await h.until('Copy credential'); } else await h.until(value.name);
    const tree = h.render(), copy = button(tree, kind === 'confirmed' ? 'Copy confirmed agent details' : `Copy agent details for ${value.id}`);
    const signout = walk(tree, node => node.type === 'a' && label(node) === 'Sign out')[0]; assert(signout);
    const previous = navigator.clipboard.writeText; let settleCopy;
    navigator.clipboard.writeText = body => { clipboard.push(body); return new Promise((resolve, reject) => settleCopy = () => completion === 'SUCCESS' ? resolve() : reject(Error('Synthetic delayed clipboard refusal.'))); };
    try {
      const count = clipboard.length; copy.props.onClick(); assert.equal(clipboard.length, count + 1);
      signout.props.onClick(); copy.props.onClick(); assert.equal(clipboard.length, count + 1, 'Active captured callbacks must stop before a sign-out render.');
      settleCopy(); await settleWithoutRender();
      assert(!context.state.some(value => typeof value === 'string' && /^(?:confirmed|retained):/.test(value)));
      const next = h.render(); assert(!text(next).includes('Details copied')); assert(!text(next).includes('Select the agent details and copy them manually'));
      assert.equal(field(next, 'Agent credential'), undefined); assert.equal(walk(next, node => node.props?.role === 'group' && node.props.className === 'og-registration-details').length, 0);
      const held = context.refs.find(ref => ref?.current?.confirmedRegistration !== undefined)?.current;
      assert.equal(held.confirmedRegistration, null); assert.equal(held.validatedList, null);
    } finally { settleCopy?.(); await settleWithoutRender(); navigator.clipboard.writeText = previous; h.unmount(); }
  }
});

test('copied enrollment agent ID drives an explicitly approved canonical research receipt through a synthetic-only boundary', async () => {
  const {records} = server(), h = harness(); await register(h); await h.until('Copy credential');
  const token = field(h.render(), 'Agent credential').props.value, saved = records[0];
  h.click('Copy confirmed agent details'); await h.flush(); const copied = JSON.parse(clipboard.at(-1));
  const command = researchModel.researchPublishV1Schema.parse({action: 'publish', requestId: crypto.randomUUID(), id: crypto.randomUUID(), kind: 'HYPOTHESIS', title: 'Synthetic onboarding bridge', statement: 'Synthetic local fixture only; this is not an observed strategy result.', assumptions: 'No authentic market observations or independent execution are established.', falsification: 'Reject any uncorrelated identity or receipt.', sources: [], relation: null, policyAccepted: 'public-research-v1'});
  const {action, requestId, id, policyAccepted, ...content} = command;
  const author = {kind: 'AGENT', id: saved.id, sponsorId: 'human_' + 'c'.repeat(64), name: saved.name};
  const {record, payload} = researchModel.boundedResearchRecord({version: 1, id, rootId: id, revision: 1, requestId, createdAt: T, author, content, policyAccepted, verification: 'UNVERIFIED', executionEnabled: false});
  const digest = await researchModel.researchDigest(payload);
  const accepted = researchModel.researchWriteSchema.parse({version: 1, action, requestId, item: {id, digest, rootId: id, revision: 1, requestId, createdAt: T, author: {kind: 'AGENT', id: saved.id, sponsorId: author.sponsorId}, state: 'VISIBLE', reason: null, record, moderation: []}, report: null, executionEnabled: false});
  const calls = [], transport = async (url, init) => {
    calls.push({url, init}); assert.equal(init.headers.Authorization, 'Bearer ' + token); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
    if (url === 'http://127.0.0.1/api/network/agent') { assert.equal(init.method, 'GET'); return Response.json({version: 1, agent: {id: saved.id, name: saved.name, credentialId: saved.credentialId, expiresAt: saved.expiresAt, scope: saved.scope}, executionEnabled: false}); }
    assert.equal(url, 'http://127.0.0.1/api/research/agent'); assert.equal(init.method, 'POST'); assert.equal(init.body, JSON.stringify(command)); return Response.json(accepted);
  };
  const options = {baseOrigin: 'http://127.0.0.1', credential: token, agentId: copied.agentId, testAdapter: {kind: 'SYNTHETIC_LOOPBACK_ONLY', fetch: transport}};
  const boundary = createOpenGrailAgentBoundary(options);
  try {
    assert.equal((await boundary.controller.identify()).disposition, 'IDENTIFIED');
    const prepared = boundary.controller.prepareWrite('/api/research/agent', command);
    await assert.rejects(boundary.controller.executeApproved(prepared.handle), /APPROVAL_STATE_REFUSED/); assert.equal(calls.filter(call => call.init.method === 'POST').length, 0);
    boundary.controller.approveWrite(prepared.handle, {confirmPublicSharing: true});
    const result = await boundary.controller.executeApproved(prepared.handle);
    assert.equal(result.disposition, 'CONFIRMED'); assert.equal(result.receipt.item.digest, digest); assert.equal(result.receipt.item.author.id, copied.agentId);
    assert.equal(JSON.stringify(result.receipt.item.record), JSON.stringify(record)); assert.equal(result.qualification, 'NONE'); assert.equal(result.executionEnabled, false);
    assert.equal(calls.filter(call => call.init.method === 'POST').length, 1);
  } finally { boundary.controller.close(); }
  const wrong = createOpenGrailAgentBoundary({...options, agentId: copied.credentialId});
  try {
    assert.equal((await wrong.controller.identify()).disposition, 'IDENTITY_UNAVAILABLE');
    const prepared = wrong.controller.prepareWrite('/api/research/agent', command); wrong.controller.approveWrite(prepared.handle, {confirmPublicSharing: true});
    await assert.rejects(wrong.controller.executeApproved(prepared.handle), /IDENTIFY_FIRST/); assert.equal(calls.filter(call => call.init.method === 'POST').length, 1);
  } finally { wrong.controller.close(); }
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
  assert.equal(details(h.render(), 'Confirmed agent details'), undefined);
  h.close(); assert(walk(h.render(), node => node.props?.open).length);
  const oldName = field(h.render(), 'Agent name').props.value; field(h.render(), 'Agent name').props.onChange({target: {value: 'Changed after uncertainty'}}); await h.flush();
  assert.equal(field(h.render(), 'Agent name').props.value, oldName);
  h.click('Retry same request'); const tree = await h.until('Copy credential');
  const posts = requests.filter(item => item.init.method === 'POST'); assert.equal(posts.length, 2); assert.equal(posts[0].init.body, posts[1].init.body);
  assert.equal(await model.networkDigest(field(tree, 'Agent credential').props.value), JSON.parse(posts[0].init.body).tokenDigest);
  expectDetails(details(tree, 'Confirmed agent details'), agent(JSON.parse(posts[0].init.body)));
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
    assert.equal(details(h.render(), 'Confirmed agent details'), undefined);
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

test('a refused list read keeps its own transport open, cancels other reads and immediately fences revealed credentials and stale copies', async () => {
  for (const status of [401, 403]) {
    const existing = agent(), {records} = server([existing]), h = harness();
    await register(h, 'Registration before list refusal');
    await h.until('Copy credential');
    const tree = await h.until(tree => button(tree, 'Refresh agents')?.props.disabled === false && details(tree, `Registration details for ${records[0].id}`));
    const confirmedCopy = button(tree, 'Copy confirmed agent details'), credentialCopy = button(tree, 'Copy credential');
    const retainedCopy = button(tree, `Copy agent details for ${existing.id}`), refresh = button(tree, 'Refresh agents');
    const beforeCopies = clipboard.length, pendingReads = [], previousClipboard = navigator.clipboard.writeText;
    let completeCopy;
    navigator.clipboard.writeText = body => { clipboard.push(body); return new Promise(resolve => completeCopy = resolve); };
    globalThis.fetch = (path, init = {}) => {
      assert.equal(path, '/api/network/agents'); assert.notEqual(init.method, 'POST');
      return new Promise(resolve => pendingReads.push({signal: init.signal, respond: resolve}));
    };
    try {
      confirmedCopy.props.onClick(); assert.equal(clipboard.length, beforeCopies + 1);
      // A captured Refresh handler exercises two overlapping reads before React disables the control.
      refresh.props.onClick(); refresh.props.onClick();
      assert.equal(pendingReads.length, 2); assert(pendingReads.every(read => read.signal?.aborted === false));
      pendingReads[1].respond(Response.json({error: 'Synthetic authentication refusal'}, {status}));
      await settleWithoutRender();
      assert.equal(pendingReads[1].signal.aborted, false, 'The received refusal must not cancel its own remaining response transport.');
      assert.equal(pendingReads[0].signal.aborted, true, 'Authentication loss must still cancel every other outstanding list read.');
      confirmedCopy.props.onClick(); retainedCopy.props.onClick(); credentialCopy.props.onClick(); refresh.props.onClick();
      assert.equal(clipboard.length, beforeCopies + 1, 'Captured metadata and credential callbacks must be fenced before a render.');
      assert.equal(pendingReads.length, 2, 'A captured refresh cannot issue a read after authentication loss.');
      completeCopy(); await settleWithoutRender();
      const denied = h.render();
      assert(text(denied).includes('Sign in again'));
      assert.equal(field(denied, 'Agent credential'), undefined); assert.equal(button(denied, 'Register agent'), undefined);
      assert.equal(walk(denied, node => node.props?.role === 'group' && node.props.className === 'og-registration-details').length, 0);
      assert(!text(denied).includes('Details copied')); assert(!text(denied).includes('Select the agent details and copy them manually'));
      // Deliver an older success despite its cancellation to exercise the late-response fence.
      pendingReads[0].respond(Response.json(list(records))); await h.flush();
      assert(text(h.render()).includes('Sign in again')); assert(!text(h.render()).includes(existing.name));
      assert.equal(field(h.render(), 'Agent credential'), undefined);
      assert.equal(walk(h.render(), node => node.props?.role === 'group' && node.props.className === 'og-registration-details').length, 0);
      confirmedCopy.props.onClick(); credentialCopy.props.onClick(); await settleWithoutRender();
      assert.equal(clipboard.length, beforeCopies + 1);
    } finally {
      pendingReads.forEach(read => read.respond(Response.json(list(records)))); completeCopy?.();
      await settleWithoutRender(); navigator.clipboard.writeText = previousClipboard; h.unmount();
    }
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
    assert.equal(context.refs.find(ref => ref?.current?.confirmedRegistration !== undefined)?.current.confirmedRegistration, null);
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

test('revocation close focuses the stable heading while refresh is held and cannot move focus after auth loss or a later form', async () => {
  for (const ending of ['HELD_READ', 'SIGNOUT', 'LATER_FORM']) {
    const value = agent(), {records, requests} = server([value]), transport = globalThis.fetch;
    let reads = 0, releaseWrite, releaseRead;
    globalThis.fetch = async (path, init = {}) => {
      if (init.method === 'POST') {
        const response = await transport(path, init);
        return new Promise(resolve => releaseWrite = () => resolve(response));
      }
      if (++reads === 1) return transport(path, init);
      return new Promise(resolve => releaseRead = resolve);
    };
    const h = harness(), focused = []; await h.until(value.name);
    const initial = h.render(), refresh = button(initial, 'Refresh agents');
    const heading = walk(initial, node => node.type === 'h3' && label(node) === 'Your agents')[0]; assert(heading);
    const triggerNode = {isConnected: true, disabled: false, focus() { focused.push('Revoke'); }};
    const refreshNode = {isConnected: true, disabled: false, focus() { focused.push('Refresh'); }};
    const headingNode = {isConnected: true, focus() { focused.push('Your agents'); }};
    refresh.props.ref.current = refreshNode;
    // Absence of the new heading ref in the RED component must yield a behavioral failure, not setup failure.
    if (heading.props.ref) heading.props.ref.current = headingNode;
    try {
      button(initial, 'Revoke').props.onClick({currentTarget: triggerNode}); await h.flush();
      const autofocus = walk(h.render(), node => typeof node.props?.onCloseAutoFocus === 'function')[0].props.onCloseAutoFocus;
      h.click('Revoke credential'); const writing = await h.until('Revoking…');
      triggerNode.disabled = button(writing, 'Revoke').props.disabled;
      refreshNode.disabled = button(writing, 'Refresh agents').props.disabled;
      assert(triggerNode.disabled && refreshNode.disabled, 'Both rendered buttons must actually be disabled while the write is pending.');
      assert.equal(typeof releaseWrite, 'function'); releaseWrite();
      const closed = await h.until('Agent credential revoked');
      assert.equal(typeof releaseRead, 'function'); assert.equal(walk(closed, node => node.props?.open).length, 0);
      assert.equal(button(closed, 'Revoke'), undefined, 'The unloaded post-revocation list removes its remembered trigger.');
      triggerNode.isConnected = false; refreshNode.disabled = button(closed, 'Refresh agents').props.disabled;
      assert(refreshNode.disabled, 'The following held list read must keep Refresh disabled.');
      assert.equal(context.refs.find(ref => ref?.current?.reads instanceof Set).current.reads.size, 1);

      if (ending === 'SIGNOUT') {
        walk(closed, node => node.type === 'a' && label(node) === 'Sign out')[0].props.onClick();
      } else if (ending === 'LATER_FORM') {
        releaseRead(Response.json(list(records))); await h.until(tree => button(tree, 'Register agent')?.props.disabled === false);
        h.click('Register agent'); await h.flush(); h.close(); await h.flush();
        assert.equal(walk(h.render(), node => node.props?.open).length, 0);
        refreshNode.disabled = button(h.render(), 'Refresh agents').props.disabled;
        assert.equal(refreshNode.disabled, false, 'The stale form event must be blocked even with an eligible button.');
      }
      let prevented = 0; autofocus({preventDefault() { prevented++; }});
      assert.equal(prevented, 1);
      assert.deepEqual(focused, ending === 'HELD_READ' ? ['Your agents'] : [], 'Only the current authorized closed form can restore focus.');
      if (ending === 'HELD_READ') assert.equal(heading.props.tabIndex, -1);
      assert.equal(triggerNode.disabled, true, 'Focus recovery must never enable the remembered button.');
      assert.equal(requests.filter(item => item.init.method === 'POST').length, 1);
    } finally {
      releaseWrite?.(); releaseRead?.(Response.json(list(records))); await h.flush(); h.unmount();
    }
  }
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


test('public sponsor setup is a separate read-only component only within authenticated agent management', async () => {
  const requests = server().requests, h = harness();
  await h.until(tree => button(tree, 'Register agent')?.props.disabled === false);
  const sponsor = walk(h.render(), node => typeof node.type === 'function' && node.type.name === 'NetworkSponsorIdentity')[0];
  assert(sponsor); assert.equal(sponsor.props.enabled, true); assert.equal(sponsor.props.isCurrent(), true);
  assert.deepEqual(requests.map(value => value.path), ['/api/network/agents']);
  h.click('Register agent'); assert.equal(sponsor.props.isCurrent(), false, 'A captured setup callback must stop before a dialog render.');
  h.props.signedIn = false; await h.flush();
  assert.equal(walk(h.render(), node => typeof node.type === 'function' && node.type.name === 'NetworkSponsorIdentity').length, 0);
  assert.equal(sponsor.props.isCurrent(), false);
});
