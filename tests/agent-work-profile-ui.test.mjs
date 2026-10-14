import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

// Controlled hooks/events of the actual public component, route and private-card link.
// Synthetic reads only; these are not browser-layout, deployed API or outside-agent evidence.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const hooks = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0, stopped: false, writesAfterStop: 0};
globalThis.__agentWorkHooks = {
  useState(initial) { const i = hooks.si++; if (!(i in hooks.state)) hooks.state[i] = typeof initial === 'function' ? initial() : initial; return [hooks.state[i], next => { if (hooks.stopped) hooks.writesAfterStop++; hooks.state[i] = typeof next === 'function' ? next(hooks.state[i]) : next; }]; },
  useRef(initial) { return hooks.refs[hooks.ri++] ??= {current: initial}; },
  useEffect(callback, deps) { const i = hooks.ei++, old = hooks.deps[i]; if (!old || deps.some((value, n) => value !== old[n])) { hooks.deps[i] = deps; hooks.effects.push(() => { hooks.cleanup[i]?.(); hooks.cleanup[i] = callback(); }); } },
};
const stubs = {react: 'export const {useState,useRef,useEffect}=globalThis.__agentWorkHooks;', '@/components/ui/dialog': 'export const Dialog=()=>null,DialogContent=()=>null,DialogHeader=()=>null,DialogTitle=()=>null,DialogDescription=()=>null;'};
const compiled = await build({stdin: {contents: "export {default as Profile} from './app/agent-work-profile';export {default as WorkPage} from './app/work/page';export {default as Network} from './app/network';export {agentWorkProfileSchema} from './app/agent-work-profile-model';", resolveDir: process.cwd(), loader: 'tsx'}, bundle: true, write: false, format: 'cjs', platform: 'node', target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'controlled-agent-work', setup(builder) {
  builder.onResolve({filter: /.*/}, args => (args.importer.endsWith('/app/agent-work-profile.tsx') || args.importer.endsWith('/app/network.tsx')) && args.path in stubs ? {path: args.path, namespace: 'work-stub'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'work-stub'}, args => ({contents: stubs[args.path], loader: 'js'}));
}}]});
const module = {exports: {}}; new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, module, module.exports); const api = module.exports;
const id = number => '00000000-0000-4000-8000-' + number.toString(16).padStart(12, '0');
const ref = number => ({id: id(number), digest: number.toString(16).padStart(64, '0')});
const subject = number => ({kind: 'AGENT', id: id(number), sponsorId: 'human_' + 'a'.repeat(64)});
const at = '2026-10-14T08:00:00.000Z', reviewer = {kind: 'HUMAN', id: 'human_' + 'b'.repeat(64), sponsorId: 'human_' + 'b'.repeat(64)};
function profile(agent = id(100), statuses = ['ATTESTED', 'DISPUTED', 'HELD', 'REJECTED', 'SUPERSEDED']) {
  const units = statuses.map((status, index) => {
    const base = 10 + index * 10, reproduction = ref(base + 1), current = ref(base + 5);
    const decision = status === 'ATTESTED' || status === 'SUPERSEDED' ? 'REPRODUCED' : status;
    const reasons = decision === 'REPRODUCED' ? ['COMPUTATION_MATCH'] : decision === 'DISPUTED' ? ['COMPUTATION_MISMATCH'] : ['INCOMPLETE_EVIDENCE'];
    const first = {review: ref(base + 4), sequence: 1, createdAt: at, reviewer, reproduction, decision: 'HELD', reasons: ['INCOMPLETE_EVIDENCE'], sharedDependencies: ['METHOD_SPECIFICATION'], otherConflicts: 'Controlled synthetic retained history.'};
    const head = {review: current, sequence: 2, createdAt: at, reviewer, reproduction: status === 'SUPERSEDED' ? ref(base + 6) : reproduction, decision, reasons, sharedDependencies: ['METHOD_SPECIFICATION'], otherConflicts: ''};
    return {original: ref(base), reproduction, manifest: ref(base + 2), strategy: ref(base + 3), currentHead: {...current, sequence: 2}, status, sponsorSeparation: {outcomes: true, reviewer: true}, history: [first, head]};
  });
  return api.agentWorkProfileSchema.parse({version: 1, subject: {...subject(100), id: agent}, observedAt: at, method: 'COMPUTATIONAL_REPRODUCTION', classification: 'EVIDENCE_LINKED_WORK_PROFILE', qualification: 'NONE', independence: 'NOT_ESTABLISHED', executionEnabled: false, ordersEnabled: false, coverage: 'CURRENT_VISIBLE_SUPPORTED_COMPUTATIONAL_WORK', supportedMethods: ['BATCH_DEMO', 'PROGRAM_DEMO', 'PROGRAM_FORWARD_DEMO'], counts: {total: units.length, attested: statuses.filter(value => value === 'ATTESTED').length, disputed: statuses.filter(value => value === 'DISPUTED').length, held: statuses.filter(value => value === 'HELD').length, rejected: statuses.filter(value => value === 'REJECTED').length, superseded: statuses.filter(value => value === 'SUPERSEDED').length}, units});
}
function expand(node) { return node && typeof node === 'object' && typeof node.type === 'function' && node.type.name === 'WorkUnit' ? node.type(node.props) : node; }
function walk(node, predicate) { const value = expand(node); if (!value || typeof value !== 'object') return []; if (Array.isArray(value)) return value.flatMap(child => walk(child, predicate)); return [...(predicate(value) ? [value] : []), ...walk(value.props?.children, predicate)]; }
function text(node) { const value = expand(node); return value == null || typeof value === 'boolean' ? '' : Array.isArray(value) ? value.map(text).join(' ') : typeof value === 'object' ? text(value.props?.children) : String(value); }
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const field = tree => walk(tree, node => node.type === 'input' && node.props['aria-label'] === 'Work profile agent ID')[0];
const workCards = tree => walk(tree, node => node.type === 'article' && node.props['aria-label']?.startsWith('Reviewed work '));
function harness(props = {agentId: id(100)}, component = api.Profile) {
  hooks.cleanup.forEach(cleanup => cleanup?.()); for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup']) hooks[key] = []; hooks.stopped = false; hooks.writesAfterStop = 0;
  const render = () => { hooks.si = hooks.ri = hooks.ei = 0; return component(props); };
  const flush = async () => { for (let n = 0; n < 8; n++) { render(); while (hooks.effects.length) hooks.effects.shift()(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  const until = async predicate => { const deadline = Date.now() + 5000; do { const tree = await flush(); if (typeof predicate === 'function' ? predicate(tree) : text(tree).includes(predicate)) return tree; } while (Date.now() < deadline); assert.fail('Timed out: ' + text(render())); };
  return {props, render, flush, until, change(value) { field(render()).props.onChange({target: {value}}); }, click(name) { const node = button(render(), name); assert(node, 'missing ' + name); assert(!node.props.disabled, name + ' disabled'); node.props.onClick(); }, submit() { const node = walk(render(), value => value.type === 'form')[0]; assert(node); node.props.onSubmit({preventDefault() {}}); }, unmount() { hooks.cleanup.forEach(cleanup => cleanup?.()); hooks.stopped = true; }};
}
function server(respond = () => Response.json(profile())) {
  const calls = []; globalThis.fetch = async (path, options) => { calls.push({path, options}); assert(path.startsWith('/api/reputation/agents?id=')); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.deepEqual(options.headers, {Accept: 'application/json'}); assert(!options.body); return respond(path, options, calls.length); }; return calls;
}
const deferred = () => { let resolve; return {promise: new Promise(done => {resolve = done;}), resolve: value => resolve(value)}; };
after(() => { hooks.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; delete globalThis.__agentWorkHooks; });

test('public work lookup is explicit and the page refuses mixed or duplicate identity links before any request', async () => {
  const calls = server(), h = harness(); await h.flush(); assert.equal(calls.length, 0); assert.equal(workCards(h.render()).length, 0); assert.equal(field(h.render()).props.value, id(100));
  for (const query of [{id: [id(100), id(100)]}, {id: id(100), digest: 'a'.repeat(64)}, {id: 'not-an-id'}, {id: id(100).toUpperCase().replace('4000', 'ABCD')}]) {
    const page = await api.WorkPage({searchParams: Promise.resolve(query)}); assert.equal(page.props.agentId, ''); assert(page.props.selectionError.includes('No profile was requested'));
  }
  const valid = await api.WorkPage({searchParams: Promise.resolve({id: id(100)})}); assert.equal(valid.props.agentId, id(100)); assert.equal(valid.props.selectionError, '');
  h.change('invalid'); assert(button(h.render(), 'Open profile').props.disabled); h.submit(); await h.flush(); assert.equal(calls.length, 0);
});

test('actual component shows neutral current decisions, exact linked references and retained visible history without owner IDs', async () => {
  const value = profile(), calls = server(() => Response.json(value)), h = harness(); await h.flush(); h.submit(); await h.until(tree => workCards(tree).length === 5);
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/api/reputation/agents?id=' + value.subject.id);
  const tree = h.render(), copy = text(tree), cards = workCards(tree); assert(copy.includes('Attested reproduction')); assert(copy.includes('reproduced losses')); assert(copy.includes('Independence and trading performance remain not established')); assert(!copy.includes(value.subject.sponsorId)); assert(!copy.includes(reviewer.id));
  assert.deepEqual(walk(tree, node => node.type === 'dl' && node.props['aria-label'] === 'Current reviewed work counts').flatMap(node => walk(node, child => child.type === 'dd').map(text)), ['1', '1', '1', '1', '1']);
  for (let i = 0; i < cards.length; i++) {
    const unit = value.units[i], hrefs = walk(cards[i], node => node.type === 'a').map(node => node.props.href);
    for (const name of ['original', 'reproduction', 'manifest']) assert(hrefs.includes('/experiments?id=' + unit[name].id + '&digest=' + unit[name].digest));
    assert(hrefs.includes('/strategies?id=' + unit.strategy.id + '&digest=' + unit.strategy.digest));
    assert(hrefs.includes('/experiments?id=' + unit.original.id + '&digest=' + unit.original.digest + '&review=' + unit.currentHead.id + '&reviewDigest=' + unit.currentHead.digest));
    const disclosure = walk(cards[i], node => node.type === 'details'); assert.equal(disclosure.length, 1); assert.equal(disclosure[0].props.open, undefined); assert.equal(walk(disclosure[0], node => node.type === 'dl').length, 1); assert.equal(walk(disclosure[0], node => node.type === 'li').length, 2); assert(text(disclosure[0]).includes('Controlled synthetic retained history.'));
  }
});

test('refetch scrubs the complete old profile immediately and a current suppression or refusal never resurrects it', async () => {
  for (const status of [404, 503]) {
    let cancelled = false; const pending = deferred(), calls = server((_path, _options, n) => n === 1 ? Response.json(profile()) : pending.promise), h = harness(); await h.flush(); h.submit(); await h.until(tree => workCards(tree).length === 5);
    h.click('Refresh profile'); assert.equal(workCards(h.render()).length, 0); assert(text(h.render()).includes('Loading current public reviewed work')); pending.resolve(new Response(new ReadableStream({start(controller) {controller.enqueue(new TextEncoder().encode('{"error":"Suppressed secret metadata must not render."}'));}, cancel() {cancelled = true;}}), {status, headers: {'Content-Type': 'application/json'}}));
    await h.until(status === 404 ? 'No public reviewed work is available' : 'Public reviewed work is unavailable'); assert(cancelled); assert.equal(calls.length, 2); assert.equal(workCards(h.render()).length, 0); assert(!text(h.render()).includes('Suppressed secret metadata')); assert(!text(h.render()).includes('Controlled synthetic retained history.'));
  }
});

test('changed identity aborts and fences a late old response while the new explicit lookup binds to its exact subject', async () => {
  const pending = deferred(), calls = server((_path, _options, n) => n === 1 ? pending.promise : Response.json(profile(id(101), ['HELD']))), h = harness(); await h.flush(); h.submit(); assert.equal(calls.length, 1);
  h.change(id(101)); assert(calls[0].options.signal.aborted); assert.equal(workCards(h.render()).length, 0); h.submit(); await h.until(tree => workCards(tree).length === 1); pending.resolve(Response.json(profile())); await h.flush();
  assert(text(h.render()).includes(id(101))); assert(!text(h.render()).includes('Attested reproduction')); assert.equal(workCards(h.render()).length, 1);
});

test('a fresh empty visible projection removes old review history and shows zero current work without an adverse or trust conclusion', async () => {
  server((_path, _options, n) => Response.json(profile(id(100), n === 1 ? ['ATTESTED', 'DISPUTED'] : []))); const h = harness(); await h.flush(); h.submit(); await h.until(tree => workCards(tree).length === 2);
  h.click('Refresh profile'); assert.equal(workCards(h.render()).length, 0); await h.until('No currently visible supported work'); const tree = h.render(); assert.equal(workCards(tree).length, 0); assert(!text(tree).includes('Controlled synthetic retained history.')); assert(text(tree).includes('no conclusion is implied'));
  assert.deepEqual(walk(tree, node => node.type === 'dl' && node.props['aria-label'] === 'Current reviewed work counts').flatMap(node => walk(node, child => child.type === 'dd').map(text)), ['0', '0', '0', '0', '0']);
});

test('route identity changes hide loaded work before effects run and fence pending work from the previous route', async () => {
  const pending = deferred(), calls = server((_path, _options, n) => n === 1 ? Response.json(profile()) : pending.promise), h = harness(); await h.flush(); h.submit(); await h.until(tree => workCards(tree).length === 5);
  const staleSubmit = walk(h.render(), node => node.type === 'form')[0].props.onSubmit;
  h.props.agentId = id(101); assert.equal(workCards(h.render()).length, 0); staleSubmit({preventDefault() {}}); assert.equal(calls.length, 1); await h.flush(); assert.equal(field(h.render()).props.value, id(101)); assert.equal(calls.length, 1); h.submit(); await h.flush();
  h.props.agentId = id(102); assert.equal(workCards(h.render()).length, 0); await h.flush(); assert(calls[1].options.signal.aborted); pending.resolve(Response.json(profile(id(101)))); await h.flush(); assert.equal(workCards(h.render()).length, 0); assert.equal(field(h.render()).props.value, id(102));
});

test('cancel and unmount stop original requests and late results cannot retain work or update an unmounted component', async () => {
  for (const stop of ['cancel', 'unmount']) {
    const pending = deferred(), calls = server(() => pending.promise), h = harness(); await h.flush(); h.submit(); await h.flush(); assert(text(h.render()).includes('Loading current public reviewed work'));
    if (stop === 'cancel') h.click('Cancel lookup'); else h.unmount(); assert(calls[0].options.signal.aborted); pending.resolve(Response.json(profile()));
    if (stop === 'cancel') { await h.flush(); assert(text(h.render()).includes('Lookup cancelled.')); assert.equal(workCards(h.render()).length, 0); }
    else { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); assert.equal(hooks.writesAfterStop, 0); }
  }
});

test('subject substitution, forged labels, corrupt counts and extra response fields all fail closed after previous work is cleared', async () => {
  const variants = [value => {value.subject.id = id(101);}, value => {value.qualification = 'QUALIFIED';}, value => {value.ordersEnabled = true;}, value => {value.counts.attested = 2;}, value => {value.ownerToken = 'untrusted-response-field';}];
  for (const mutate of variants) {
    const bad = profile(); mutate(bad); server((_path, _options, n) => Response.json(n === 1 ? profile() : bad)); const h = harness(); await h.flush(); h.submit(); await h.until(tree => workCards(tree).length === 5); h.click('Refresh profile'); assert.equal(workCards(h.render()).length, 0); await h.until('Public reviewed work is unavailable'); assert.equal(workCards(h.render()).length, 0); assert(!text(h.render()).includes('untrusted-response-field'));
  }
});

test('bounded streaming, duplicate JSON keys, invalid UTF-8 and non-JSON content cannot create a work profile', async () => {
  let oversizedCancelled = false, rejectedHeadersCancelled = 0;
  const headerResponse = headers => new Response(new ReadableStream({start(controller) {controller.enqueue(new TextEncoder().encode(JSON.stringify(profile())));}, cancel() {rejectedHeadersCancelled++;}}), {headers});
  const duplicate = JSON.stringify(profile()).replace('"version":1', '"version":1,"version":1');
  const responses = [
    () => new Response(new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(262145));}, cancel() {oversizedCancelled = true;}}), {headers: {'Content-Type': 'application/json'}}),
    () => new Response(duplicate, {headers: {'Content-Type': 'application/json'}}),
    () => new Response(new Uint8Array([0xff, 0xfe]), {headers: {'Content-Type': 'application/json'}}),
    () => headerResponse({'Content-Type': 'text/html'}),
    () => headerResponse({'Content-Type': 'application/json', 'Content-Length': '262145'}),
  ];
  for (const response of responses) { server(response); const h = harness(); await h.flush(); h.submit(); await h.until('Public reviewed work is unavailable'); assert.equal(workCards(h.render()).length, 0); }
  assert(oversizedCancelled); assert.equal(rejectedHeadersCancelled, 2);
});

test('cancelling an already streaming lookup cancels its reader without publishing partial or previous work', async () => {
  let cancelled = false; const response = new Response(new ReadableStream({start(controller) {controller.enqueue(new TextEncoder().encode('{"version":1'));}, cancel() {cancelled = true;}}), {headers: {'Content-Type': 'application/json'}});
  server(() => response); const h = harness(); await h.flush(); h.submit(); await h.flush(); h.click('Cancel lookup'); await h.flush(); assert(cancelled); assert.equal(workCards(h.render()).length, 0); assert(text(h.render()).includes('Lookup cancelled.'));
});

test('uniform unknown/private-only lookup responses assert no enrollment and expose no server-supplied body', async () => {
  for (const agent of [id(100), id(101)]) { server(() => Response.json({error: 'Private enrollment details'}, {status: 404})); const h = harness({agentId: agent}); await h.flush(); h.submit(); const tree = await h.until('No public reviewed work is available'); assert(text(tree).includes('Registration is not disclosed')); assert(!text(tree).includes('Private enrollment details')); assert.equal(workCards(tree).length, 0); }
});

test('private agent cards link only the exact public identity and stale links are blocked during a retained-list refresh', async () => {
  const pending = deferred(), createdAt = new Date().toISOString(), agent = {id: id(100), credentialId: id(101), name: 'Controlled research companion', createdAt, expiresAt: new Date(Date.now() + 86400000).toISOString(), revision: 1, revokedAt: null, scope: 'PUBLIC_RESEARCH_SUBMIT', registrationRequestId: id(102), revocationRequestId: null};
  let calls = 0; globalThis.fetch = async path => { assert.equal(path, '/api/network/agents'); return ++calls === 1 ? Response.json({version: 1, agents: [agent], maximumPerUser: 8, maximumNetwork: 1000, executionEnabled: false}) : pending.promise; };
  const h = harness({signedIn: true, githubUrl: null}, api.Network); const tree = await h.until('Reviewed work'), link = walk(tree, node => node.type === 'a' && label(node) === 'Reviewed work')[0]; assert(link); assert.equal(link.props.href, '/work?id=' + agent.id); assert(!link.props.href.includes(agent.credentialId));
  let prevented = false; link.props.onClick({preventDefault() {prevented = true;}}); assert(!prevented); h.click('Refresh agents'); link.props.onClick({preventDefault() {prevented = true;}}); assert(prevented); pending.resolve(Response.json({version: 1, agents: [], maximumPerUser: 8, maximumNetwork: 1000, executionEnabled: false})); await h.until('No agents registered'); assert.equal(walk(h.render(), node => node.type === 'a' && label(node) === 'Reviewed work').length, 0);
});
