import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Controlled hooks and events of the actual component, with canonical synthetic model
// fixtures. This does not establish real-browser, hosted API or private GitHub acceptance.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const hooks = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0};
globalThis.__contributionHooks = {
  useState(initial) {const i = hooks.si++; if (!(i in hooks.state)) hooks.state[i] = typeof initial === 'function' ? initial() : initial; return [hooks.state[i], value => hooks.state[i] = typeof value === 'function' ? value(hooks.state[i]) : value];},
  useRef(initial) {return hooks.refs[hooks.ri++] ??= {current: initial};},
  useEffect(callback, deps) {const i = hooks.ei++, old = hooks.deps[i]; if (!old || deps.some((value, n) => value !== old[n])) {hooks.deps[i] = deps; hooks.effects.push(() => {hooks.cleanup[i]?.(); hooks.cleanup[i] = callback();});}}
};
const built = await build({entryPoints: ['app/contributions.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'controlled-contribution', setup(b) {
  b.onResolve({filter: /^react$/}, a => a.importer.endsWith('/app/contributions.tsx') ? {path: a.path, namespace: 'stub'} : undefined);
  b.onLoad({filter: /.*/, namespace: 'stub'}, () => ({contents: 'export const {useState,useRef,useEffect}=globalThis.__contributionHooks;', loader: 'js'}));
}}]});
const component = {exports: {}};
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, component, component.exports);
const Contributions = component.exports.default;
const modelBuild = await build({entryPoints: ['app/contribution-model.ts'], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
const m = await import('data:text/javascript;base64,' + Buffer.from(modelBuild.outputFiles[0].text).toString('base64'));
const uid = () => crypto.randomUUID(), at = '2026-10-11T10:00:00.000Z';
const human = n => ({kind: 'HUMAN', id: 'human_' + String(n).repeat(64), sponsorId: 'human_' + String(n).repeat(64)});
const participant = human(2), maintainer = human(1);
const identity = (author = participant, role = false) => ({version: 1, authorId: author.id, sponsorId: author.sponsorId, maintainer: role, executionEnabled: false});
const ref = item => ({id: item.id, digest: item.digest}), envelope = item => ({version: 1, item, executionEnabled: false});
const list = (items, nextCursor = null) => ({version: 1, items, nextCursor, executionEnabled: false});
const history = (task, items, nextCursor = null) => ({version: 1, task, items, nextCursor, executionEnabled: false});
const sorted = rows => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
async function taskFixture(changes = {}) {
  const command = m.boundedContributionCommand({action: 'register', requestId: uid(), id: uid(), title: 'Retain failed synthetic checks', summary: 'A concrete synthetic contribution problem.', kind: 'TESTS', acceptance: ['Retain unsuccessful evidence.', 'Reject altered exact identities.'], rejection: ['Reject private source disclosure.'], policyAccepted: m.contributionPolicy}).command;
  const record = m.contributionTaskRecordForCommand(command, maintainer, at);
  return m.validateContributionTaskItem({...ref(record), digest: await m.contributionDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: record.createdAt, author: record.author, state: 'OPEN', sequence: 0, reason: null, record, events: [], ...changes});
}
async function claimFixture(task, author = participant, changes = {}) {
  const command = m.boundedContributionCommand({action: 'claim', requestId: uid(), id: uid(), task: ref(task), expectedTaskSequence: task.sequence, policyAccepted: m.contributionPolicy}).command;
  const record = m.contributionClaimRecordForCommand(command, author, at);
  return m.validateContributionClaimItem({id: record.id, digest: await m.contributionDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: record.createdAt, expiresAt: record.expiresAt, checkedAt: at, author, task: ref(task), taskState: task.state, sequence: 0, status: 'ACTIVE', handoffDigest: null, reason: null, record, events: [], ...changes});
}
async function lifecycle(task, claim, rawCommand, author = participant, clock = '2026-10-11T10:00:01.000Z') {
  const command = m.boundedContributionCommand(rawCommand).command;
  const record = m.contributionEventRecordForCommand(command, author, clock), event = {...record, digest: await m.contributionDigest(JSON.stringify(record))};
  if (command.action === 'close' || command.action === 'hide') {
    task = await m.validateContributionTaskItem({...task, state: record.state, sequence: record.sequence, reason: record.reason, record: record.state === 'HIDDEN' ? null : task.record, events: [...task.events, event]});
    if (claim) claim = await m.validateContributionClaimItem({...claim, taskState: task.state, checkedAt: clock, ...(task.state === 'HIDDEN' ? {record: null, handoffDigest: null, reason: null, events: []} : {})});
  } else {
    claim = await m.validateContributionClaimItem({...claim, status: record.state, sequence: record.sequence, checkedAt: clock, reason: record.reason, handoffDigest: command.action === 'submit' ? record.handoffDigest : claim.handoffDigest, events: [...claim.events, event]});
  }
  return {task, claim, record, digest: event.digest};
}
async function hidden(task, claim = null) {
  return lifecycle(task, claim, {action: 'hide', requestId: uid(), task: ref(task), expectedSequence: task.sequence, reason: 'POLICY', policyAccepted: m.contributionPolicy}, maintainer, '2026-10-11T10:00:30.000Z');
}
function walk(node, predicate) {if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate)); return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];}
function text(node) {return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node);}
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const field = (tree, name) => walk(tree, node => node.props?.['aria-label'] === name)[0];
function harness(authenticated = true) {
  hooks.cleanup.forEach(cleanup => cleanup?.()); for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup']) hooks[key] = [];
  const props = {authenticated};
  const render = () => {hooks.si = hooks.ri = hooks.ei = 0; return Contributions(props);};
  const flush = async () => {for (let n = 0; n < 6; n++) {render(); while (hooks.effects.length) hooks.effects.shift()(); await new Promise(resolve => setImmediate(resolve));} return render();};
  const until = async predicate => {const end = Date.now() + 5000; do {const tree = await flush(); if (typeof predicate === 'function' ? predicate(tree) : text(tree).includes(predicate)) return tree;} while (Date.now() < end); assert.fail('Timed out: ' + predicate + '\n' + text(render()));};
  return {props, render, flush, until, click(name) {const b = button(render(), name); assert(b, 'missing ' + name); assert(!b.props.disabled, name + ' disabled'); b.props.onClick();}, field(name, value) {const f = field(render(), name); assert(f, 'missing ' + name); assert(!f.props.disabled, name + ' disabled'); f.props.onChange({target: {value, checked: value}});}, submit() {const form = walk(render(), n => n.type === 'form')[0]; assert(form); form.props.onSubmit({preventDefault() {}});}, unmount() {hooks.cleanup.forEach(cleanup => cleanup?.());}};
}
function server(task, {claims = [], me = identity(), get, post} = {}) {
  const state = {tasks: [task], claims: [...claims], me, requests: [], accepted: new Map(), clock: 0};
  state.accept = async (command, author = participant) => {
    const replay = state.accepted.get(command.requestId);
    if (replay) {
      assert.equal(replay.body, m.boundedContributionCommand(command).payload, 'fixture retry body changed');
      return {...replay.receipt, task: state.tasks.find(item => item.id === replay.receipt.task.id), claim: replay.receipt.claim ? state.claims.find(item => item.id === replay.receipt.claim.id) : null};
    }
    let currentTask = state.tasks.find(item => item.id === command.task?.id), claim = state.claims.find(item => item.id === command.claim?.id), record, digest;
    const clock = new Date(Date.parse(at) + (++state.clock) * 1000).toISOString();
    if (command.action === 'register') {
      record = m.contributionTaskRecordForCommand(command, author, clock); digest = await m.contributionDigest(JSON.stringify(record));
      currentTask = await m.validateContributionTaskItem({id: record.id, digest, requestId: record.requestId, createdAt: record.createdAt, author, state: 'OPEN', sequence: 0, reason: null, record, events: []}); state.tasks.unshift(currentTask);
    } else if (command.action === 'claim') {
      record = m.contributionClaimRecordForCommand(command, author, clock); digest = await m.contributionDigest(JSON.stringify(record));
      claim = await m.validateContributionClaimItem({id: record.id, digest, requestId: record.requestId, createdAt: record.createdAt, expiresAt: record.expiresAt, checkedAt: clock, author, task: ref(currentTask), taskState: currentTask.state, sequence: 0, status: 'ACTIVE', handoffDigest: null, reason: null, record, events: []}); state.claims.unshift(claim);
    } else {
      ({task: currentTask, claim, record, digest} = await lifecycle(currentTask, claim, command, author, clock));
      state.tasks = state.tasks.map(item => item.id === currentTask.id ? currentTask : item);
      if (claim) state.claims = state.claims.map(item => item.id === claim.id ? claim : item);
      if (command.action === 'hide') state.claims = state.claims.map(item => item.task.id === currentTask.id ? {...item, taskState: 'HIDDEN', record: null, handoffDigest: null, reason: null, events: []} : item);
    }
    const responseClaim = ['register', 'close', 'hide'].includes(command.action) ? null : claim;
    const receipt = {version: 1, action: command.action, requestId: command.requestId, task: currentTask, claim: responseClaim, acknowledgement: {action: command.action, requestId: command.requestId, actor: author, task: ref(currentTask), claim: responseClaim ? ref(responseClaim) : null, sequence: command.action === 'register' || command.action === 'claim' ? 0 : record.sequence, createdAt: record.createdAt, commandDigest: await m.contributionDigest(m.boundedContributionCommand(command).payload), digest}, executionEnabled: false};
    await m.validateContributionWrite(receipt, command, author);
    state.accepted.set(command.requestId, {body: m.boundedContributionCommand(command).payload, receipt});
    return receipt;
  };
  globalThis.fetch = async (path, init = {}) => {
    state.requests.push({path, init}); const url = new URL(path, 'https://synthetic.invalid');
    if (init.method === 'POST') {const command = JSON.parse(init.body); if (post) {const result = await post(command, state, init); if (result !== undefined) return result instanceof Response ? result : Response.json(result);} return Response.json(await state.accept(command, human(init.headers['X-Contribution-Author']?.slice(6, 7) ?? 2)));}
    if (get) {const result = await get(path, state, init); if (result !== undefined) return result instanceof Response ? result : Response.json(result);}
    if (path === '/api/contributions/me') return state.me ? Response.json(state.me) : new Response(null, {status: 401});
    if (url.searchParams.has('task')) {const exact = state.tasks.find(item => item.id === url.searchParams.get('task')); return Response.json(history(exact, sorted(state.claims.filter(item => item.task.id === exact.id))));}
    return Response.json(list(sorted(state.tasks)));
  };
  return state;
}
async function ready(h, task) {await h.until(tree => button(tree, 'Inspect task ' + task.id) && !button(tree, 'Inspect task ' + task.id).props.disabled); h.click('Inspect task ' + task.id); await h.until('Acceptance criteria');}
async function confirm(h) {h.field('Accept contribution policy', true); await h.flush(); h.submit();}
const posts = state => state.requests.filter(request => request.init.method === 'POST');
after(() => {hooks.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; delete globalThis.__contributionHooks;});

test('anonymous actual desk reads public exact task/history without identity, publication, credential or private source access', async () => {
  const task = await taskFixture(), s = server(task), h = harness(false); await ready(h, task);
  assert(text(h.render()).includes('Retain unsuccessful evidence.')); assert(text(h.render()).includes('grants no private source access'));
  assert.equal(posts(s).length, 0); assert(!s.requests.some(request => request.path.endsWith('/me')));
  assert(!button(h.render(), 'Claim task')); assert(!button(h.render(), 'Register task'));
  assert(s.requests.some(request => request.path === '/api/contributions?task=' + task.id + '&digest=' + task.digest));
  assert.equal(walk(h.render(), node => node.type === 'input' || node.type === 'form').length, 0);
});

test('participant claims exact task with explicit consent, derived identity header and fixed original lease', async () => {
  const task = await taskFixture(), s = server(task), h = harness(); await ready(h, task);
  assert(!button(h.render(), 'Register task')); assert(!button(h.render(), 'Close task')); h.click('Claim task'); await h.flush();
  assert.equal(posts(s).length, 0); assert(button(h.render(), 'Confirm claim').props.disabled);
  await confirm(h); await h.until('Claim recorded with its original 72-hour deadline');
  const request = posts(s)[0], c = m.boundedContributionCommand(JSON.parse(request.init.body)).command;
  assert.equal(c.action, 'claim'); assert.deepEqual(c.task, ref(task)); assert.equal(c.expectedTaskSequence, 0);
  assert.equal(request.init.headers['X-Contribution-Author'], participant.id); assert.equal(request.init.headers['X-Contribution-Intent'], 'submit');
  assert(!('author' in c) && !('sponsor' in c) && !('repository' in c)); assert.equal(s.claims[0].author.id, participant.id);
  assert.equal(Date.parse(s.claims[0].expiresAt) - Date.parse(s.claims[0].createdAt), 72 * 3600000);
});

test('explicit maintainer registers ordered public criterion arrays and retains private guide restrictions', async () => {
  const task = await taskFixture(), s = server(task, {me: identity(maintainer, true)}), h = harness(); await ready(h, task);
  h.click('Register task'); await h.flush();
  for (const [name, value] of [['Task title', 'Bounded synthetic UI work'], ['Task summary', 'Retain exact uncertain receipt evidence.'], ['Task acceptance', 'One valid receipt.\nOne rejected stale receipt.'], ['Task rejection', 'Reject private metadata.']]) {h.field(name, value); await h.flush();}
  await confirm(h); await h.until('Original contribution request confirmed'); const c = JSON.parse(posts(s)[0].init.body);
  assert.equal(c.action, 'register'); assert.deepEqual(c.acceptance, ['One valid receipt.', 'One rejected stale receipt.']); assert.deepEqual(c.rejection, ['Reject private metadata.']);
  assert.equal(posts(s)[0].init.headers['X-Contribution-Author'], maintainer.id); assert(!text(h.render()).includes('Completed task'));
});

test('own submission accepts only SHA256 handoff digest, binds exact sequence and never uploads private source', async () => {
  const task = await taskFixture(), claim = await claimFixture(task), s = server(task, {claims: [claim]}), h = harness(); await ready(h, task);
  h.click('Submit handoff digest'); await h.flush(); h.field('Private handoff digest', 'a'.repeat(64)); await h.flush(); await confirm(h); await h.until('Original contribution request confirmed');
  const c = JSON.parse(posts(s)[0].init.body); assert.equal(c.action, 'submit'); assert.equal(c.handoffDigest, 'a'.repeat(64)); assert.deepEqual(c.claim, ref(claim)); assert.equal(c.expectedSequence, 0);
  assert.equal(s.claims[0].status, 'SUBMITTED'); assert.equal(s.claims[0].expiresAt, claim.expiresAt); assert(!Object.keys(c).some(key => /url|source|evidence|upload|token/i.test(key)));
});

test('lost ACK holds exact body/request/principal and unchanged retry correlates canonical acceptance', async () => {
  const task = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (c, state) => {const receipt = await state.accept(c); if (++attempt === 1) throw Error('Synthetic accepted response lost'); return receipt;}}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('Outcome unknown.');
  const first = posts(s)[0]; assert(button(h.render(), 'Cancel action').props.disabled); assert(button(h.render(), 'Refresh exact task').props.disabled);
  h.click('Retry identical request'); await h.until('Claim recorded with its original 72-hour deadline');
  assert.equal(posts(s).length, 2); assert.equal(posts(s)[1].init.body, first.init.body); assert.deepEqual(posts(s)[1].init.headers, first.init.headers); assert.equal(s.claims.length, 1);
});

test('unknown ACK retry after hide accepts immutable content-free ACK and cannot restore cached task/claim payloads', async () => {
  const task = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (c, state) => {const receipt = await state.accept(c); if (++attempt === 1) {const suppressed = await hidden(state.tasks[0], state.claims[0]); state.tasks = [suppressed.task]; state.claims = [suppressed.claim]; return new Response(null, {status: 503});} return receipt;}}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('Outcome unknown.'); h.click('Retry identical request'); await h.until('Original request confirmed. Current task content is hidden');
  assert(!text(h.render()).includes(task.record.content.title)); assert(!text(h.render()).includes(task.record.content.summary)); assert(!button(h.render(), 'Claim task'));
  const body = posts(s)[0].init.body; assert.equal(posts(s)[1].init.body, body);
  s.tasks = [task]; s.claims = []; h.click('Refresh tasks'); await h.until(tree => !button(tree, 'Refresh tasks').props.disabled); assert(!text(h.render()).includes(task.record.content.title));
  h.click('Refresh exact task'); await h.flush(); assert(!text(h.render()).includes(task.record.content.summary));
});

test('valid new hidden projection clears handoff digest and all held form fields with terminal visibility floor', async () => {
  const task = await taskFixture(), initial = await claimFixture(task), submitted = await lifecycle(task, initial, {action: 'submit', requestId: uid(), task: ref(task), claim: ref(initial), expectedSequence: 0, handoffDigest: 'b'.repeat(64), policyAccepted: m.contributionPolicy}), s = server(task, {claims: [submitted.claim]}), h = harness(); await ready(h, task);
  assert(text(h.render()).includes('b'.repeat(64))); const tombstone = await hidden(task, submitted.claim); s.tasks = [tombstone.task]; s.claims = [tombstone.claim]; h.click('Refresh exact task'); await h.until('Authored task and dependent claim payloads are suppressed');
  assert(!text(h.render()).includes('b'.repeat(64))); assert(!text(h.render()).includes(task.record.content.summary));
  s.tasks = [task]; s.claims = [submitted.claim]; h.click('Refresh exact task'); await h.flush(); assert(!text(h.render()).includes('b'.repeat(64))); assert(!text(h.render()).includes(task.record.content.title));
});

test('identity swap locks held operation and original account alone can perform identical reconciliation', async () => {
  const task = await taskFixture(); let attempt = 0; const s = server(task, {post: async (c, state) => {const receipt = await state.accept(c); return ++attempt === 1 ? new Response(null, {status: 503}) : receipt;}}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('Outcome unknown.');
  s.me = identity(human(3)); h.click('Retry identical request'); await h.until('The original participant is required'); assert.equal(posts(s).length, 1); assert(button(h.render(), 'Retry identical request').props.disabled); assert(!field(h.render(), 'Accept contribution policy'));
  s.me = identity(); h.click('Check original identity'); await h.until(tree => !button(tree, 'Retry identical request').props.disabled); h.click('Retry identical request'); await h.until('Claim recorded with its original 72-hour deadline'); assert.equal(posts(s).length, 2); assert.equal(posts(s)[0].init.body, posts(s)[1].init.body);
});

test('schema-valid uncorrelated ACK stays unresolved and is never accepted or replaced by a new command', async () => {
  const task = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (c, state) => {const receipt = await state.accept(c); return ++attempt === 1 ? {...receipt, acknowledgement: {...receipt.acknowledgement, commandDigest: 'f'.repeat(64)}} : receipt;}}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('Outcome unknown.');
  assert(!text(h.render()).includes('Claim recorded with its original')); h.click('Retry identical request'); await h.until('Claim recorded with its original'); assert.equal(posts(s)[0].init.body, posts(s)[1].init.body);
});

test('409 is an explicit rejection requiring fresh exact state; no automatic retry or stale second write', async () => {
  const task = await taskFixture(), s = server(task, {post: () => new Response(null, {status: 409})}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('Request rejected:');
  assert.equal(posts(s).length, 1); assert(!button(h.render(), 'Retry identical request')); assert(!walk(h.render(), n => n.type === 'form').length); assert(!button(h.render(), 'Claim task'));
  h.click('Refresh exact task'); await h.until(tree => button(tree, 'Claim task') && !button(tree, 'Claim task').props.disabled); assert.equal(posts(s).length, 1);
});

test('maintainer disposition uses compatible reason and terminal attempt without claiming merge or task completion', async () => {
  const task = await taskFixture(), initial = await claimFixture(task), submitted = await lifecycle(task, initial, {action: 'submit', requestId: uid(), task: ref(task), claim: ref(initial), expectedSequence: 0, handoffDigest: 'c'.repeat(64), policyAccepted: m.contributionPolicy}), s = server(task, {claims: [submitted.claim], me: identity(maintainer, true)}), h = harness(); await ready(h, task); h.click('Record disposition'); await h.flush();
  assert.equal(field(h.render(), 'Contribution reason').props.value, 'NEEDS_CHANGES'); h.field('Maintainer decision', 'ACCEPTED'); await h.flush(); assert.equal(field(h.render(), 'Contribution reason').props.value, 'ACCEPTANCE_MET'); await confirm(h); await h.until('Maintainer disposition recorded');
  const c = JSON.parse(posts(s)[0].init.body); assert.equal(c.expectedSequence, 1); assert.equal(c.decision, 'ACCEPTED'); assert.equal(c.reason, 'ACCEPTANCE_MET'); assert.equal(s.tasks[0].state, 'OPEN'); assert.equal(s.claims[0].status, 'ACCEPTED'); assert(!button(h.render(), 'Record disposition'));
  assert(text(h.render()).includes('no merge, completed task, code safety or qualified result'));
});

test('sponsor release uses sponsor reason without impersonating agent and expired claim offers no mutation', async () => {
  const task = await taskFixture(), agent = {kind: 'AGENT', id: uid(), sponsorId: participant.id}, claim = await claimFixture(task, agent), s = server(task, {claims: [claim]}), h = harness(); await ready(h, task); assert(!button(h.render(), 'Submit handoff digest')); h.click('Release claim'); await h.flush(); assert.equal(field(h.render(), 'Contribution reason').props.value, 'SPONSOR_RELEASE'); await confirm(h); await h.until('Original contribution request confirmed');
  assert.equal(s.claims[0].author.id, agent.id); assert.equal(s.claims[0].events[0].actor.id, participant.id); assert.equal(JSON.parse(posts(s)[0].init.body).reason, 'SPONSOR_RELEASE');
  const expired = await claimFixture(task, participant, {status: 'EXPIRED', checkedAt: '2026-10-14T10:00:00.000Z'}); server(task, {claims: [expired]}); const eh = harness(); await ready(eh, task); assert(!button(eh.render(), 'Release claim')); assert(!button(eh.render(), 'Submit handoff digest'));
});

test('hidden task still permits actual-author release with exact references and no suppressed handoff or prose', async () => {
  const task = await taskFixture(), claim = await claimFixture(task), tombstone = await hidden(task, claim), s = server(tombstone.task, {claims: [tombstone.claim], post: () => new Response(null, {status: 409})}), h = harness(); await h.until(tree => button(tree, 'Inspect task ' + task.id) && !button(tree, 'Inspect task ' + task.id).props.disabled); h.click('Inspect task ' + task.id); await h.until('Authored task and dependent claim payloads are suppressed');
  h.click('Release claim'); await h.flush(); assert(field(h.render(), 'Accept contribution policy')); await confirm(h); await h.until('Request rejected:'); const c = JSON.parse(posts(s)[0].init.body); assert.equal(c.action, 'release'); assert.deepEqual(c.task, ref(task)); assert.deepEqual(c.claim, ref(claim));
});

test('raw duplicate keys, excessive response bytes and incorrect canonical record digest reject public page', async () => {
  for (const fault of ['duplicate', 'oversize', 'digest']) {
    const task = await taskFixture(); server(task, {get: path => path === '/api/contributions' ? fault === 'duplicate' ? new Response('{"version":1,"version":1,"items":[],"nextCursor":null,"executionEnabled":false}') : fault === 'oversize' ? new Response(' '.repeat(m.contributionLimits.responseBytes + 1)) : list([{...task, digest: 'f'.repeat(64)}]) : undefined}); const h = harness(false); await h.until('No page was accepted.'); assert(!text(h.render()).includes(task.record.content.title));
  }
});

test('unmount cannot acknowledge a deferred POST', async () => {
  const task = await taskFixture(); let finish; const delayed = new Promise(resolve => finish = resolve), s = server(task, {post: async (c, state) => {const receipt = await state.accept(c); await delayed; return receipt;}}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until(tree => button(tree, 'Sending…')); h.unmount(); finish(); await h.flush(); assert(!text(h.render()).includes('Claim recorded with its original')); assert.equal(posts(s).length, 1);
});

test('contribution UI contains no durable browser store, token intake, uploader, provider or automatic publication', async () => {
  const [source, css] = await Promise.all([readFile('app/contributions.tsx', 'utf8'), readFile('app/contributions.css', 'utf8')]);
  assert(!/localStorage|sessionStorage|indexedDB|type="file"|navigator\.clipboard|dangerouslySetInnerHTML|Authorization|api\.github|openai\.com/.test(source));
  assert(source.includes('validateContributionWrite') && source.includes('AbortSignal') && source.includes('parseUniqueJson'));
  assert(source.includes('pending.body') && source.includes('pending.author.authorId')); assert(css.includes(':focus-visible') && css.includes('prefers-reduced-motion'));
});

test('preflight identity outage before any POST keeps a retryable original body without trapping the form', async () => {
  const task = await taskFixture(); let identityReads = 0;
  const s = server(task, {get: path => path === '/api/contributions/me' && ++identityReads === 2 ? new Response(null, {status: 503}) : undefined}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('The request was not sent');
  assert.equal(posts(s).length, 0); assert(button(h.render(), 'Retry identical request')); h.click('Retry identical request'); await h.until('Claim recorded with its original'); assert.equal(posts(s).length, 1);
});

test('sign-out during uncertain command preserves original operation and cannot send under another identity', async () => {
  const task = await taskFixture(); let attempts = 0;
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); return ++attempts === 1 ? new Response(null, {status: 503}) : receipt;}}), h = harness(); await ready(h, task); h.click('Claim task'); await h.flush(); await confirm(h); await h.until('Outcome unknown.');
  const first = posts(s)[0]; h.props.authenticated = false; await h.until('The original participant is required'); assert(button(h.render(), 'Retry identical request').props.disabled); assert.equal(posts(s).length, 1);
  h.props.authenticated = true; await h.until(tree => button(tree, 'Retry identical request') && !button(tree, 'Retry identical request').props.disabled); h.click('Retry identical request'); await h.until('Claim recorded with its original'); assert.equal(posts(s)[1].init.body, first.init.body); assert.deepEqual(posts(s)[1].init.headers, first.init.headers);
});

test('out-of-order exact refreshes preserve newer hidden metadata and never expose an older visible page', async () => {
  const task = await taskFixture(), tombstone = await hidden(task); let delayed = false, finish;
  const waiting = new Promise(resolve => finish = resolve);
  server(task, {get: async path => {if (path.includes('?task=') && delayed) {delayed = false; await waiting; return history(task, []);} return undefined;}});
  const h = harness(false); await ready(h, task); delayed = true;
  const exactButton = button(h.render(), 'Refresh exact task'); exactButton.props.onClick(); await h.flush();
  // The original captured button represents a queued callback; current readId must fence it.
  globalThis.fetch = async () => Response.json(history(tombstone.task, [])); exactButton.props.onClick(); await h.until('Authored task and dependent claim payloads are suppressed'); finish(); await h.flush(); assert(!text(h.render()).includes(task.record.content.summary)); assert(text(h.render()).includes('HIDDEN'));
});

test('schema-valid unrelated exact task response is refused with no substituted authored content', async () => {
  const task = await taskFixture();
  const second = await taskFixture(); server(task, {get: path => path.includes('?task=') ? history(second, []) : undefined}); const h = harness(false); await h.until(tree => button(tree, 'Inspect task ' + task.id) && !button(tree, 'Inspect task ' + task.id).props.disabled); h.click('Inspect task ' + task.id); await h.until('No other task was substituted.'); assert(!text(h.render()).includes('Acceptance criteria')); assert(!text(h.render()).includes(second.digest));
});

test('pagination rejects repeated and newer schema-valid pages under a retained cursor', async () => {
  const rows = sorted(await Promise.all(Array.from({length: 20}, () => taskFixture()))), cursor = rows.at(-1).id;
  for (const fault of ['repeated', 'newer']) {
    server(rows[0], {get: path => path === '/api/contributions' ? list(rows, cursor) : path.includes('?cursor=') ? list(fault === 'repeated' ? rows : rows.slice(0, 1), fault === 'repeated' ? cursor : null) : undefined});
    const h = harness(false); await h.until(tree => button(tree, 'Older tasks') && !button(tree, 'Older tasks').props.disabled); h.click('Older tasks'); await h.until('No page was accepted.'); assert(text(h.render()).includes(rows[0].digest) === false); assert.equal(walk(h.render(), n => n.props?.className === 'og-cd-task-button').length, 20);
  }
});

test('claim history retains known current lease when paging into older terminal attempts', async () => {
  const task = await taskFixture(), active = await claimFixture(task), older = await claimFixture(task, human(3));
  const releaseCommand = {action: 'release', requestId: uid(), task: ref(task), claim: ref(older), expectedSequence: 0, reason: 'AUTHOR_RELEASE', policyAccepted: m.contributionPolicy};
  const released = (await lifecycle(task, older, releaseCommand, human(3))).claim;
  const padding = await Promise.all(Array.from({length: 19}, async () => {const claim = await claimFixture(task, human(3)); return (await lifecycle(task, claim, {...releaseCommand, requestId: uid(), claim: ref(claim)}, human(3))).claim;}));
  const page = sorted([active, ...padding]), cursor = page.at(-1).id;
  // Force valid older identity ordering without changing canonical claim metadata.
  const olderRecord = m.contributionClaimRecordSchema.parse({...released.record, createdAt: '2026-10-11T09:00:00.000Z', expiresAt: '2026-10-14T09:00:00.000Z'});
  const olderClaim = await claimFixture(task, human(3), {id: olderRecord.id, digest: await m.contributionDigest(JSON.stringify(olderRecord)), requestId: olderRecord.requestId, createdAt: olderRecord.createdAt, expiresAt: olderRecord.expiresAt, record: olderRecord, status: 'ACTIVE'});
  const final = (await lifecycle(task, olderClaim, {...releaseCommand, requestId: uid(), claim: ref(olderClaim)}, human(3))).claim;
  server(task, {get: path => path.includes('?task=') ? history(task, path.includes('&cursor=') ? [final] : page, path.includes('&cursor=') ? null : cursor) : undefined}); const h = harness(); await ready(h, task); assert(!button(h.render(), 'Claim task')); h.click('Older claims'); await h.until(tree => text(tree).includes(final.id)); assert(!button(h.render(), 'Claim task'));
});
