import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Actual component hooks/events with canonical invented messages, tasks, reports and identities.
// These checks establish neither a real browser nor hosted auth, moderation or GitHub setup.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const hooks = {state: [], refs: [], deps: [], effects: [], cleanup: [], effectFns: [], si: 0, ri: 0, ei: 0};
globalThis.__taskDiscussionHooks = {
  useState(initial) {const i = hooks.si++; if (!(i in hooks.state)) hooks.state[i] = typeof initial === 'function' ? initial() : initial; return [hooks.state[i], value => hooks.state[i] = typeof value === 'function' ? value(hooks.state[i]) : value];},
  useRef(initial) {return hooks.refs[hooks.ri++] ??= {current: initial};},
  useEffect(callback, deps) {const i = hooks.ei++, old = hooks.deps[i]; hooks.effectFns[i] = callback; if (!old || deps.some((value, n) => value !== old[n])) {hooks.deps[i] = deps; hooks.effects.push(() => {hooks.cleanup[i]?.(); hooks.cleanup[i] = callback();});}}
};
async function bundle(entry, plugins = []) {const built = await build({entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node', target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins}); const module = {exports: {}}; new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports); return module.exports;}
const Component = (await bundle('app/task-discussion-workspace.tsx', [{name: 'actual-task-discussion-hooks', setup(b) {
  b.onResolve({filter: /^react$/}, a => a.importer.endsWith('/app/task-discussion-workspace.tsx') ? {path: a.path, namespace: 'hook-stub'} : undefined);
  b.onLoad({filter: /.*/, namespace: 'hook-stub'}, () => ({contents: 'export const {useState,useRef,useEffect}=globalThis.__taskDiscussionHooks;', loader: 'js'}));
}}])).default;
const m = await bundle('app/task-discussion-model.ts'), c = await bundle('app/contribution-model.ts');
const PageModule = await bundle('app/contribute/discussion/page.tsx', [{name: 'actual-discussion-page-boundary', setup(b) {
  b.onResolve({filter: /chatgpt-auth|task-discussion-workspace$/}, a => a.importer.endsWith('/app/contribute/discussion/page.tsx') ? {path: a.path, namespace: 'page-stub'} : undefined);
  b.onLoad({filter: /.*/, namespace: 'page-stub'}, a => ({contents: a.path.includes('chatgpt-auth') ? 'export async function getChatGPTUser(){if(globalThis.__discussionAuthFailure) throw Error("Synthetic unavailable");return globalThis.__discussionUser??null;}' : 'export default function TaskDiscussionWorkspace(){return null;}', loader: 'js'}));
}}]);
const uid = () => crypto.randomUUID(), at = '2026-10-11T10:00:00.000Z';
const human = n => ({kind: 'HUMAN', id: 'human_' + String(n).repeat(64), sponsorId: 'human_' + String(n).repeat(64)});
const participant = human(2), maintainer = human(1), peer = {kind: 'AGENT', id: uid(), sponsorId: human(3).id};
const identity = (author = participant, role = false) => ({version: 1, authorId: author.id, sponsorId: author.sponsorId, maintainer: role, executionEnabled: false});
const ref = item => ({id: item.id, digest: item.digest}), envelope = {version: 1, executionEnabled: false};
const sorted = rows => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
const reportKey = row => row.reporter.kind + ':' + row.reporter.id;
const sortedReports = rows => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || reportKey(b).localeCompare(reportKey(a)) || b.requestId.localeCompare(a.requestId));
async function taskFixture() {
  const command = c.boundedContributionCommand({action: 'register', requestId: uid(), id: uid(), title: 'Retain unsuccessful contribution evidence', summary: 'Review one synthetic bounded test specification.', kind: 'TESTS', acceptance: ['Retain failed checks.', 'Bind the original task identity.'], rejection: ['Reject leaked credentials.'], policyAccepted: c.contributionPolicy}).command;
  const record = c.contributionTaskRecordForCommand(command, maintainer, at);
  return c.validateContributionTaskItem({id: record.id, digest: await c.contributionDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: at, author: record.author, state: 'OPEN', sequence: 0, reason: null, record, events: []});
}
async function claimFixture(task, author = peer) {
  const command = c.boundedContributionCommand({action: 'claim', id: uid(), requestId: uid(), task: ref(task), expectedTaskSequence: task.sequence, policyAccepted: c.contributionPolicy}).command;
  const record = c.contributionClaimRecordForCommand(command, author, at);
  return c.validateContributionClaimItem({id: record.id, digest: await c.contributionDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: at, expiresAt: record.expiresAt, checkedAt: at, author, task: ref(task), taskState: 'OPEN', sequence: 0, status: 'ACTIVE', handoffDigest: null, reason: null, record, events: []});
}
async function messageFixture(task, {author = peer, body = 'Which failure would reject this specification?', kind = 'QUESTION', claim = null, replyTo = null, clock = '2026-10-11T10:00:01.000Z'} = {}) {
  const command = m.boundedTaskDiscussionCommand({action: 'publish', id: uid(), requestId: uid(), task: ref(task), expectedTaskSequence: task.sequence, claim, replyTo, kind, body, policyAccepted: m.taskDiscussionPolicy}).command;
  const record = m.taskDiscussionRecordForCommand(command, author, clock), digest = await m.taskDiscussionDigest(m.boundedTaskDiscussionRecord(record).payload);
  return m.validateTaskDiscussionItem({id: record.id, digest, requestId: record.requestId, createdAt: clock, author, task: ref(task), taskState: task.state, sequence: 0, state: 'VISIBLE', reason: null, record, events: []});
}
async function messageEvent(item, action = 'hide', author = maintainer, clock = '2026-10-11T10:01:00.000Z') {
  const command = m.boundedTaskDiscussionCommand({action, requestId: uid(), task: item.task, message: ref(item), expectedSequence: item.sequence, reason: action === 'hide' ? 'POLICY' : 'AUTHOR_REQUEST', policyAccepted: m.taskDiscussionPolicy}).command;
  const record = m.taskDiscussionEventRecordForCommand(command, author, clock), event = {...record, digest: await m.taskDiscussionDigest(m.boundedTaskDiscussionEvent(record).payload)};
  return m.validateTaskDiscussionItem({...item, state: record.state, reason: record.reason, sequence: event.sequence, record: null, events: [...item.events, event]});
}
async function taskEvent(task, action = 'hide') {
  const command = c.boundedContributionCommand({action, requestId: uid(), task: ref(task), expectedSequence: task.sequence, reason: action === 'hide' ? 'POLICY' : 'MAINTAINER_CLOSED', policyAccepted: c.contributionPolicy}).command;
  const record = c.contributionEventRecordForCommand(command, maintainer, '2026-10-11T10:02:00.000Z'), event = {...record, digest: await c.contributionDigest(JSON.stringify(record))};
  return c.validateContributionTaskItem({...task, state: record.state, reason: record.reason, sequence: event.sequence, record: action === 'hide' ? null : task.record, events: [...task.events, event]});
}
function walk(node, predicate) {if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate)); return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];}
function text(node) {return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node);}
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const field = (tree, name) => walk(tree, node => node.props?.['aria-label'] === name)[0];
function harness(task, authenticated = true) {
  hooks.cleanup.forEach(cleanup => cleanup?.()); for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup', 'effectFns']) hooks[key] = [];
  const props = {authenticated, taskId: task?.id ?? null, taskDigest: task?.digest ?? null};
  const render = () => {hooks.si = hooks.ri = hooks.ei = 0; return Component(props);};
  const flush = async () => {for (let n = 0; n < 6; n++) {render(); while (hooks.effects.length) hooks.effects.shift()(); await new Promise(resolve => setImmediate(resolve));} return render();};
  const until = async predicate => {const end = Date.now() + 5000; do {const tree = await flush(); if (typeof predicate === 'function' ? predicate(tree) : text(tree).includes(predicate)) return tree;} while (Date.now() < end); assert.fail('Timed out: ' + predicate + '\n' + text(render()));};
  return {props, render, flush, until, click(name, subtree) {const b = button(subtree ?? render(), name); assert(b, 'missing ' + name); assert(!b.props.disabled, name + ' disabled'); b.props.onClick();}, field(name, value) {const f = field(render(), name); assert(f, 'missing ' + name); assert(!f.props.disabled, name + ' disabled'); f.props.onChange({target: {value, checked: value}});}, submit() {const form = walk(render(), node => node.type === 'form')[0]; assert(form); form.props.onSubmit({preventDefault() {}});}, replayEffects() {hooks.cleanup.forEach(cleanup => cleanup?.()); hooks.effectFns.forEach((callback, n) => hooks.cleanup[n] = callback());}, unmount() {hooks.cleanup.forEach(cleanup => cleanup?.());}};
}
function server(task, {messages = [], claims = [], me = identity(), reports = [], get, post} = {}) {
  const state = {task, messages: [...messages], claims: [...claims], me, reports: [...reports], requests: [], accepted: new Map(), clock: 60};
  state.project = item => ({...item, taskState: state.task.state, state: state.task.state === 'HIDDEN' && item.state !== 'WITHDRAWN' ? 'HIDDEN' : item.state, record: state.task.state === 'HIDDEN' || item.state !== 'VISIBLE' ? null : item.record});
  state.accept = async (command, author = state.me ? {kind: 'HUMAN', id: state.me.authorId, sponsorId: state.me.sponsorId} : participant) => {
    const body = m.boundedTaskDiscussionCommand(command).payload, prior = state.accepted.get(command.requestId);
    if (prior) {assert.equal(body, prior.body, 'fixture changed original retry'); return {...prior.receipt, task: state.task, message: prior.receipt.message ? state.project(state.messages.find(row => row.id === prior.receipt.message.id)) : null};}
    const clock = new Date(Date.parse(at) + (++state.clock) * 1000).toISOString(); let message = null, report = null, digest, sequence = 0;
    if (command.action === 'publish') {
      const record = m.taskDiscussionRecordForCommand(command, author, clock); digest = await m.taskDiscussionDigest(m.boundedTaskDiscussionRecord(record).payload);
      message = await m.validateTaskDiscussionItem({id: record.id, digest, requestId: record.requestId, createdAt: record.createdAt, author, task: ref(state.task), taskState: state.task.state, sequence: 0, state: 'VISIBLE', reason: null, record, events: []}); state.messages.push(message);
    } else if (command.action === 'report') {
      const row = m.taskDiscussionReportForCommand(command, author, clock); state.reports.push(row); digest = await m.taskDiscussionDigest(m.boundedTaskDiscussionReport(row).payload);
      report = {requestId: row.requestId, task: row.task, message: row.message, category: row.category, createdAt: row.createdAt};
    } else {
      const old = state.messages.find(row => row.id === command.message.id), record = m.taskDiscussionEventRecordForCommand(command, author, clock); digest = await m.taskDiscussionDigest(m.boundedTaskDiscussionEvent(record).payload); sequence = record.sequence;
      message = await m.validateTaskDiscussionItem({...old, taskState: state.task.state, record: null, sequence, state: record.state, reason: record.reason, events: [...old.events, {...record, digest}]}); state.messages = state.messages.map(row => row.id === message.id ? message : row);
    }
    const receipt = {...envelope, action: command.action, requestId: command.requestId, acknowledgement: {actor: author, commandDigest: await m.taskDiscussionDigest(body), digest, createdAt: clock, sequence}, task: state.task, message, report};
    await m.validateTaskDiscussionWrite(receipt, command, author); state.accepted.set(command.requestId, {body, receipt}); return receipt;
  };
  globalThis.fetch = async (path, init = {}) => {
    state.requests.push({path, init}); const url = new URL(path, 'https://synthetic.invalid');
    if (init.method === 'POST') {const command = JSON.parse(init.body); if (post) {const result = await post(command, state, init); if (result !== undefined) return result instanceof Response ? result : Response.json(result);} return Response.json(await state.accept(command));}
    if (get) {const result = await get(path, state, init); if (result !== undefined) return result instanceof Response ? result : Response.json(result);}
    if (url.pathname.endsWith('/me')) return state.me ? Response.json(state.me) : new Response(null, {status: 401});
    if (url.pathname.endsWith('/reports')) {
      const rows = sortedReports(state.reports), cursor = url.searchParams.get('cursor'); let start = 0;
      if (cursor) {for (let n = 0; n < rows.length; n++) if (await m.taskDiscussionDigest(m.boundedTaskDiscussionReport(rows[n]).payload) === cursor) start = n + 1;}
      const page = rows.slice(start, start + m.taskDiscussionLimits.page), nextCursor = rows.length > start + page.length ? await m.taskDiscussionDigest(m.boundedTaskDiscussionReport(page.at(-1)).payload) : null;
      return Response.json({...envelope, reports: page, nextCursor});
    }
    if (url.pathname === '/api/contributions') return Response.json({...envelope, task: state.task, items: state.claims.map(row => ({...row, taskState: state.task.state})), nextCursor: null});
    if (url.searchParams.has('id')) return Response.json({...envelope, task: state.task, item: state.project(state.messages.find(row => row.id === url.searchParams.get('id')))});
    const rows = sorted(state.messages).map(state.project), cursor = url.searchParams.get('cursor'), start = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
    const page = rows.slice(start, start + m.taskDiscussionLimits.page), nextCursor = rows.length > start + page.length ? page.at(-1).id : null;
    return Response.json({...envelope, task: state.task, items: page, nextCursor});
  };
  return state;
}
const posts = state => state.requests.filter(row => row.init.method === 'POST');
async function ready(h, task, signed = true) {await h.until(tree => text(tree).includes(task.record?.content.title ?? 'Task content suppressed') && (!signed || button(tree, 'Question') && !button(tree, 'Question').props.disabled));}
async function confirm(h) {h.field('Accept task discussion policy', true); await h.flush(); h.submit();}
async function publish(h, body = 'Retain every failed synthetic assertion.', kind = 'Question') {h.click(kind); await h.flush(); h.field('Public discussion body', body); await h.flush(); await confirm(h);}
after(() => {hooks.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; delete globalThis.__taskDiscussionHooks; delete globalThis.__discussionUser; delete globalThis.__discussionAuthFailure;});

test('anonymous actual workspace reads exact task and peer discussion without identity, token intake or automatic writes', async () => {
  const task = await taskFixture(), message = await messageFixture(task), s = server(task, {messages: [message]}), h = harness(task, false); await ready(h, task, false);
  assert(text(h.render()).includes(message.record.body)); assert(text(h.render()).includes('Separate from maintainer claim dispositions'));
  assert.equal(posts(s).length, 0); assert(!s.requests.some(row => row.path.endsWith('/me') || row.path.endsWith('/reports')));
  assert(!button(h.render(), 'Question')); assert(!button(h.render(), 'Hide message')); assert.equal(walk(h.render(), node => node.type === 'form' || node.type === 'input').length, 0);
  assert(s.requests.some(row => row.path === '/api/contributions/discussion?task=' + task.id + '&digest=' + task.digest));
});

test('non-claiming participant explicitly publishes bounded public text with exact task and derived current identity', async () => {
  const task = await taskFixture(), s = server(task), h = harness(task); await ready(h, task); h.click('Question'); await h.flush();
  assert.equal(posts(s).length, 0); assert(button(h.render(), 'Confirm public message').props.disabled);
  h.field('Public discussion body', 'Which failure rejects this?'); await h.flush(); await confirm(h); await h.until('Original message confirmed.');
  const request = posts(s)[0], command = m.boundedTaskDiscussionCommand(JSON.parse(request.init.body)).command;
  assert.equal(command.kind, 'QUESTION'); assert.deepEqual(command.task, ref(task)); assert.equal(command.expectedTaskSequence, 0); assert.equal(command.claim, null); assert.equal(command.replyTo, null);
  assert.equal(request.init.headers['X-Task-Discussion-Author'], participant.id); assert.equal(request.init.headers['X-Task-Discussion-Intent'], 'submit');
  assert(!('author' in command) && !('sponsor' in command) && !('maintainer' in command)); assert.equal(s.claims.length, 0); assert.equal(s.messages[0].author.id, participant.id);
});

test('public specification, counterexample and peer comment remain inert authored messages, without fake acceptance', async () => {
  const task = await taskFixture(), s = server(task), h = harness(task); await ready(h, task);
  const cases = [['Public specification', 'PROPOSAL', 'Public example: https://github.com/example/project\n```js\nconst retained = true;\n```'], ['Counterexample', 'COUNTEREXAMPLE', 'A cancelled assertion must remain unsuccessful.'], ['Peer comment', 'PEER_REVIEW', 'An independent test must bind the same original input.']];
  for (const [label, kind, body] of cases) {await publish(h, body, label); await h.until('Original message confirmed.'); assert.equal(JSON.parse(posts(s).at(-1).init.body).kind, kind);}
  assert.equal(s.messages.length, 3); assert(text(h.render()).includes('awards no trust, task acceptance or reputation')); assert.equal(s.accepted.size, 3);
});

test('reply and optional foreign-owned claim bind visible exact references without taking a claim or private handoff', async () => {
  const task = await taskFixture(), claim = await claimFixture(task), message = await messageFixture(task), s = server(task, {claims: [claim], messages: [message]}), h = harness(task); await ready(h, task);
  h.click('Load optional claim references'); await h.until(tree => label(tree).includes('1 current-page references')); h.click('Reply to message'); await h.flush(); h.field('Optional discussion claim', claim.id); h.field('Public discussion body', 'Here is a public test specification for that counterexample.'); await h.flush(); await confirm(h); await h.until('Original message confirmed.');
  const command = JSON.parse(posts(s)[0].init.body); assert.deepEqual(command.claim, ref(claim)); assert.deepEqual(command.replyTo, ref(message)); assert.equal(command.action, 'publish'); assert.equal(s.claims[0].author.id, peer.id);
  assert(!Object.keys(command).some(key => /handoff|upload|private|execution|authority/i.test(key)));
});

test('inspecting a cached reply requires its full frozen ID and digest before installing a previously unseen parent', async () => {
  const task = await taskFixture(), parent = await messageFixture(task), child = await messageFixture(task, {replyTo: ref(parent), body: 'A reply bound to the original parent.', clock: '2026-10-11T10:00:02.000Z'});
  const replacementRecord = m.boundedTaskDiscussionRecord({...parent.record, body: 'Substituted parent body must not display.'}).record;
  const replacement = await m.validateTaskDiscussionItem({...parent, digest: await m.taskDiscussionDigest(m.boundedTaskDiscussionRecord(replacementRecord).payload), record: replacementRecord});
  const s = server(task, {messages: [replacement, child], get: path => path.includes('?task=') ? {...envelope, task, items: [child], nextCursor: null} : undefined}), h = harness(task, false); await ready(h, task, false); h.click('Inspect referenced message'); await h.until('Exact referenced message is unavailable.');
  assert(!text(h.render()).includes(replacementRecord.body)); assert(text(h.render()).includes(child.record.body)); assert.equal(posts(s).length, 0);
});

test('sign-out with no held command keeps exact anonymous discussion refresh available', async () => {
  const task = await taskFixture(), s = server(task), h = harness(task); await ready(h, task); h.props.authenticated = false; await h.flush();
  const before = s.requests.length; assert(!button(h.render(), 'Refresh exact discussion').props.disabled); h.click('Refresh exact discussion'); await h.flush(); assert(s.requests.length > before); assert(!button(h.render(), 'Question')); assert.equal(posts(s).length, 0);
});

test('uncertain ACK retains exact original body/request/principal, blocks dependent actions, and reconciles unchanged', async () => {
  const task = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); if (++attempt === 1) throw Error('Synthetic accepted response lost'); return receipt;}}), h = harness(task); await ready(h, task); await publish(h); await h.until('Outcome unknown.');
  const first = posts(s)[0]; assert(button(h.render(), 'Cancel message action').props.disabled); assert(button(h.render(), 'Refresh exact discussion').props.disabled); assert(button(h.render(), 'Question').props.disabled);
  h.click('Retry identical request'); await h.until('Original message confirmed.'); assert.equal(posts(s).length, 2); assert.equal(posts(s)[1].init.body, first.init.body); assert.deepEqual(posts(s)[1].init.headers, first.init.headers); assert.equal(s.messages.length, 1);
});

test('forged original body/author/request acknowledgement remains uncertain and is not installed', async () => {
  for (const corrupt of [receipt => ({...receipt, requestId: uid()}), receipt => ({...receipt, acknowledgement: {...receipt.acknowledgement, actor: human(4)}}), receipt => ({...receipt, message: {...receipt.message, digest: 'f'.repeat(64)}})]) {
    const task = await taskFixture(), s = server(task, {post: async (command, state) => corrupt(await state.accept(command))}), h = harness(task); await ready(h, task); await publish(h); await h.until('Outcome unknown.');
    assert.equal(posts(s).length, 1); assert(!text(h.render()).includes('Original message confirmed.')); assert(!text(h.render()).includes(s.messages[0].id)); assert(button(h.render(), 'Retry identical request'));
  }
});

test('identity preflight outage sends no command and leaves the original request retryable', async () => {
  const task = await taskFixture(); let fail = false;
  const s = server(task, {get: path => path.endsWith('/me') && fail ? (fail = false, new Response(null, {status: 503})) : undefined}), h = harness(task); await ready(h, task); fail = true; await publish(h); await h.until('The request was not sent.');
  assert.equal(posts(s).length, 0); h.click('Retry identical request'); await h.until('Original message confirmed.'); assert.equal(posts(s).length, 1);
});

test('sign-out or account substitution cannot repurpose an uncertain held operation', async () => {
  const task = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); return ++attempt === 1 ? new Response(null, {status: 503}) : receipt;}}), h = harness(task); await ready(h, task); await publish(h); await h.until('Outcome unknown.');
  const first = posts(s)[0]; h.props.authenticated = false; await h.until('The original participant is required'); assert(button(h.render(), 'Retry identical request').props.disabled);
  s.me = identity(human(4)); h.props.authenticated = true; await h.flush(); assert.equal(posts(s).length, 1); assert(button(h.render(), 'Retry identical request').props.disabled);
  s.me = identity(); h.click('Check original identity'); await h.until(tree => !button(tree, 'Retry identical request').props.disabled); h.click('Retry identical request'); await h.until('Original message confirmed.'); assert.equal(posts(s)[1].init.body, first.init.body); assert.deepEqual(posts(s)[1].init.headers, first.init.headers);
});

test('changing exact task during an uncertain request blocks retries to a substitute and preserves original reconciliation', async () => {
  const task = await taskFixture(), other = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); return ++attempt === 1 ? new Response(null, {status: 503}) : receipt;}}), h = harness(task); await ready(h, task); await publish(h); await h.until('Outcome unknown.');
  h.props.taskId = other.id; h.props.taskDigest = other.digest; await h.until('Return to the original exact task'); assert(button(h.render(), 'Retry identical request').props.disabled); assert.equal(posts(s).length, 1);
  h.props.taskId = task.id; h.props.taskDigest = task.digest; await h.flush(); h.click('Retry identical request'); await h.until('Original message confirmed.'); assert.equal(posts(s).length, 2); assert.deepEqual(JSON.parse(posts(s)[1].init.body).task, ref(task));
});

test('task switch during a delayed identity preflight sends no original command until the original task is restored', async () => {
  const task = await taskFixture(), other = await taskFixture(); let hold = false, finish, enter;
  const delayed = new Promise(resolve => finish = resolve), entered = new Promise(resolve => enter = resolve);
  const s = server(task, {get: path => hold && path.endsWith('/me') ? (enter(), delayed) : undefined}), h = harness(task); await ready(h, task); hold = true; await publish(h); await entered;
  h.props.taskId = other.id; h.props.taskDigest = other.digest; await h.until('Return to the original exact task'); finish(Response.json(identity())); await h.flush(); assert.equal(posts(s).length, 0); assert(button(h.render(), 'Retry identical request').props.disabled);
  hold = false; h.props.taskId = task.id; h.props.taskDigest = task.digest; await h.flush(); h.click('Retry identical request'); await h.until('Original message confirmed.'); assert.equal(posts(s).length, 1); assert.deepEqual(JSON.parse(posts(s)[0].init.body).task, ref(task));
});

test('account cookie change while a POST response is delayed cannot install its canonical receipt under the new principal', async () => {
  const task = await taskFixture(); let finish, enter;
  const delayed = new Promise(resolve => finish = resolve), entered = new Promise(resolve => enter = resolve);
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); enter(); await delayed; return receipt;}}), h = harness(task); await ready(h, task); await publish(h, 'Original author body awaiting confirmed identity.'); await entered;
  const first = posts(s)[0]; s.me = identity(human(4)); finish(); await h.until('The original participant is required'); assert(!text(h.render()).includes('Original message confirmed.')); assert(!text(h.render()).includes('Original author body awaiting confirmed identity.')); assert(button(h.render(), 'Retry identical request').props.disabled);
  s.me = identity(); h.click('Check original identity'); await h.until(tree => !button(tree, 'Retry identical request').props.disabled); h.click('Retry identical request'); await h.until('Original message confirmed.'); assert.equal(posts(s)[1].init.body, first.init.body); assert.equal(s.messages.length, 1);
});

test('conflict discards a definitively rejected command and requires exact refresh before new publication', async () => {
  const task = await taskFixture(), s = server(task, {post: () => new Response(null, {status: 409})}), h = harness(task); await ready(h, task); await publish(h); await h.until('Request rejected because the exact task');
  assert.equal(posts(s).length, 1); assert(!button(h.render(), 'Question')); assert(!button(h.render(), 'Retry identical request')); h.click('Refresh exact discussion'); await ready(h, task); assert(button(h.render(), 'Question'));
});

test('human maintainer hides a peer message; its author retains the reserved withdrawal after moderation', async () => {
  const task = await taskFixture(), own = await messageFixture(task, {author: participant, body: 'A message retained through moderation.'}), s = server(task, {messages: [own], me: identity(maintainer, true)}), h = harness(task); await ready(h, task);
  h.click('Hide message'); await h.flush(); await confirm(h); await h.until('Message hidden through human maintainer authority.'); assert(!text(h.render()).includes(own.record.body)); assert.equal(JSON.parse(posts(s)[0].init.body).expectedSequence, 0);
  h.props.authenticated = false; await h.flush(); s.me = identity(); h.props.authenticated = true; await h.until(tree => button(tree, 'Withdraw my message') && !button(tree, 'Withdraw my message').props.disabled); h.click('Withdraw my message'); await h.flush(); await confirm(h); await h.until('Message withdrawn.');
  const withdraw = JSON.parse(posts(s)[1].init.body); assert.equal(withdraw.action, 'withdraw'); assert.equal(withdraw.expectedSequence, 1); assert.equal(s.messages[0].events.length, 2); assert.equal(s.messages[0].state, 'WITHDRAWN'); assert(!button(h.render(), 'Hide message'));
});

test('own author withdrawal works after parent closure or hiding while new public messages stay blocked', async () => {
  for (const action of ['close', 'hide']) {
    const task = await taskFixture(), own = await messageFixture(task, {author: participant, body: 'Content to suppress on parent hide.'}), s = server(task, {messages: [own]}), h = harness(task); await ready(h, task); s.task = await taskEvent(task, action); h.click('Refresh exact discussion'); await h.until(action === 'hide' ? 'Task content suppressed' : 'This task is closed.');
    assert(!button(h.render(), 'Question')); assert(button(h.render(), 'Withdraw my message')); if (action === 'hide') assert(!text(h.render()).includes(own.record.body));
    h.click('Withdraw my message'); await h.flush(); await confirm(h); await h.until(action === 'hide' ? 'Original request confirmed. Current task content is suppressed;' : 'Message withdrawn.'); assert.equal(s.messages[0].state, 'WITHDRAWN'); assert.equal(posts(s).length, 1);
  }
});

test('known hidden parent and messages cannot be revived by an older valid visible page', async () => {
  const task = await taskFixture(), message = await messageFixture(task, {body: 'Suppressed peer body.'}), s = server(task, {messages: [message]}), h = harness(task); await ready(h, task); s.task = await taskEvent(task); h.click('Refresh exact discussion'); await h.until('Task content suppressed');
  s.task = task; h.click('Refresh exact discussion'); await h.flush(); assert(!text(h.render()).includes(task.record.content.title)); assert(!text(h.render()).includes(message.record.body)); assert(!button(h.render(), 'Question'));
});

test('accepted publication reconciles after parent hide with original bytes and never restores the suppressed authored body', async () => {
  const task = await taskFixture(); let attempt = 0;
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); return ++attempt === 1 ? new Response(null, {status: 503}) : receipt;}}), h = harness(task); await ready(h, task); await publish(h, 'Original body that must remain suppressed.'); await h.until('Outcome unknown.');
  const first = posts(s)[0]; s.task = await taskEvent(task); h.click('Retry identical request'); await h.until('Original request confirmed. Current task content is suppressed;');
  assert.equal(posts(s)[1].init.body, first.init.body); assert.equal(s.messages.length, 1); assert(!text(h.render()).includes('Original body that must remain suppressed.')); assert(!text(h.render()).includes(task.record.content.title)); assert(!button(h.render(), 'Question'));
});

test('a superseded public-page failure cannot overwrite a later successful exact claim-reference read', async () => {
  const task = await taskFixture(); let hold = false, finish;
  const delayed = new Promise(resolve => finish = resolve);
  const s = server(task, {get: path => hold && path.startsWith('/api/contributions/discussion?task=') ? delayed : undefined}), h = harness(task); await ready(h, task);
  const refresh = button(h.render(), 'Refresh exact discussion'), claimRead = button(h.render(), 'Load optional claim references'); hold = true; refresh.props.onClick(); s.task = await taskEvent(task); claimRead.props.onClick(); await h.until('Task content suppressed');
  finish(new Response(null, {status: 503})); await h.flush(); assert(!text(h.render()).includes('Exact task discussion is unavailable.')); assert(!text(h.render()).includes(task.record.content.title));
});

test('client retains no more than the advertised 64 distinct exact-task messages across valid pages', async () => {
  const task = await taskFixture(), messages = [];
  for (let n = 0; n < 65; n++) messages.push(await messageFixture(task, {body: 'Retained synthetic message ' + n, clock: new Date(Date.parse(at) + n * 1000).toISOString()}));
  const s = server(task, {messages}), h = harness(task, false); await ready(h, task, false);
  for (const n of [48, 32, 16]) {h.click('Older messages'); await h.until(tree => text(tree).includes('Retained synthetic message ' + n) && !button(tree, 'Older messages').props.disabled);}
  h.click('Older messages'); await h.until('No new page was accepted;'); assert(!text(h.render()).includes('Retained synthetic message 0 ')); assert.equal(posts(s).length, 0);
});

test('bounded response reader cancels oversized data and rejects malformed UTF-8 before installing a public page', async () => {
  for (const oversized of [true, false]) {
    const task = await taskFixture(); let cancelled = false;
    const s = server(task, {get: path => path.includes('?task=') ? new Response(new ReadableStream({start(controller) {controller.enqueue(oversized ? new Uint8Array(m.taskDiscussionLimits.responseBytes + 1) : new Uint8Array([255])); if (!oversized) controller.close();}, cancel() {cancelled = true;}})) : undefined}), h = harness(task, false); await h.until('No new page was accepted;');
    assert.equal(cancelled, oversized); assert(!text(h.render()).includes(task.record.content.title)); assert.equal(posts(s).length, 0);
  }
});

test('private reporting sends bounded details only in the intended report; public receipt exposes no report payload', async () => {
  const task = await taskFixture(), message = await messageFixture(task), s = server(task, {messages: [message]}), h = harness(task); await ready(h, task); h.click('Report privately'); await h.flush(); h.field('Discussion reason', 'MISLEADING'); h.field('Private report details', 'Synthetic private allegation to inspect.'); await h.flush(); await confirm(h); await h.until('Original private report confirmed.');
  const command = JSON.parse(posts(s)[0].init.body); assert.equal(command.action, 'report'); assert.deepEqual(command.message, ref(message)); assert.equal(command.category, 'MISLEADING'); assert.equal(s.reports.length, 1); assert(!text(h.render()).includes(command.details)); assert(!button(h.render(), 'Read private report queue')); assert(!s.requests.some(row => row.path.includes('/reports')));
});

test('explicit human maintainer queue read correlates private SHA cursor and scrubs details after role loss or sign-out', async () => {
  const task = await taskFixture(), message = await messageFixture(task), reports = [];
  for (let n = 0; n < 17; n++) reports.push(m.taskDiscussionReportForCommand({action: 'report', requestId: uid(), task: ref(task), message: ref(message), category: 'OTHER', details: 'Private synthetic report ' + n, policyAccepted: m.taskDiscussionPolicy}, human(3), new Date(Date.parse(at) + n * 1000).toISOString()));
  const s = server(task, {messages: [message], me: identity(maintainer, true), reports}), h = harness(task); await ready(h, task); assert(!s.requests.some(row => row.path.includes('/reports'))); h.click('Read private report queue'); await h.until('Private synthetic report 16'); assert(button(h.render(), 'Older private reports') && !button(h.render(), 'Older private reports').props.disabled);
  h.click('Older private reports'); await h.until('Private synthetic report 0'); const request = s.requests.find(row => row.path.includes('/reports?cursor=')); assert.match(request.path, /cursor=[a-f0-9]{64}$/);
  h.props.authenticated = false; await h.flush(); assert(!text(h.render()).includes('Private synthetic report')); assert(!button(h.render(), 'Read private report queue')); s.me = identity(maintainer, false); h.props.authenticated = true; await h.flush(); assert(!button(h.render(), 'Read private report queue'));
});

test('fresh identity after a delayed private queue response fences account changes and maintainer role loss', async () => {
  for (const nextIdentity of [identity(human(4), false), identity(maintainer, false)]) {
    const task = await taskFixture(), message = await messageFixture(task), report = m.taskDiscussionReportForCommand({action: 'report', requestId: uid(), task: ref(task), message: ref(message), category: 'OTHER', details: 'Private queue detail must never reach a changed participant.', policyAccepted: m.taskDiscussionPolicy}, participant, at);
    let finish, enter; const delayed = new Promise(resolve => finish = resolve), entered = new Promise(resolve => enter = resolve);
    const s = server(task, {messages: [message], reports: [report], me: identity(maintainer, true), get: path => path.endsWith('/reports') ? (enter(), delayed) : undefined}), h = harness(task); await ready(h, task); h.click('Read private report queue'); await entered; s.me = nextIdentity; finish(Response.json({...envelope, reports: [report], nextCursor: null})); await h.until(tree => !button(tree, 'Read private report queue'));
    assert(!text(h.render()).includes(report.details)); assert(!button(h.render(), 'Hide message')); assert(s.requests.filter(row => row.path.endsWith('/me')).length >= 3);
  }
});

test('invalid digest, duplicate JSON, wrong task, ordering and repeated cursor reject the entire public page', async () => {
  const task = await taskFixture(), message = await messageFixture(task), valid = {...envelope, task, items: [message], nextCursor: null};
  for (const body of [{...valid, items: [{...message, digest: 'f'.repeat(64)}]}, {...valid, items: [message, message]}, {...valid, task: {...task, digest: 'e'.repeat(64)}}, {...valid, items: [message], nextCursor: message.id}, '{"version":1,"version":1,"items":[]}']) {
    const s = server(task, {get: path => path.includes('?task=') ? typeof body === 'string' ? new Response(body) : body : undefined}), h = harness(task, false); await h.until('No new page was accepted;'); assert(!text(h.render()).includes(message.record.body)); assert.equal(posts(s).length, 0);
  }
});

test('public pagination rejects a page newer than its exact retained anchor', async () => {
  const task = await taskFixture(), messages = [];
  for (let n = 0; n < 17; n++) messages.push(await messageFixture(task, {body: 'Synthetic public page item ' + n, clock: new Date(Date.parse(at) + n * 1000).toISOString()}));
  const s = server(task, {messages, get: (path, state) => path.includes('&cursor=') ? {...envelope, task: state.task, items: [sorted(messages)[0]], nextCursor: null} : undefined}), h = harness(task, false); await ready(h, task, false); await h.until(tree => button(tree, 'Older messages') && !button(tree, 'Older messages').props.disabled); h.click('Older messages'); await h.until('No new page was accepted;'); assert(!text(h.render()).includes('Synthetic public page item 0'));
});

test('stale closures, rapid submits and mount effect replay cannot duplicate or strand an intended message', async () => {
  const task = await taskFixture(), s = server(task), h = harness(task); await ready(h, task); const stale = button(h.render(), 'Question'); h.replayEffects(); await ready(h, task); stale.props.onClick(); await h.flush(); assert.equal(walk(h.render(), node => node.type === 'form').length, 0);
  h.click('Question'); await h.flush(); h.field('Public discussion body', 'After effect replay, retain one intended message.'); h.field('Accept task discussion policy', true); await h.flush(); const form = walk(h.render(), node => node.type === 'form')[0]; form.props.onSubmit({preventDefault() {}}); form.props.onSubmit({preventDefault() {}}); await h.until('Original message confirmed.'); assert.equal(posts(s).length, 1); assert.equal(s.messages.length, 1);
});

test('unmount fences a deferred canonical response and does not acknowledge it in another lifecycle', async () => {
  const task = await taskFixture(); let finish, entered; const delayed = new Promise(resolve => finish = resolve), accepted = new Promise(resolve => entered = resolve);
  const s = server(task, {post: async (command, state) => {const receipt = await state.accept(command); entered(); await delayed; return receipt;}}), h = harness(task); await ready(h, task); await publish(h); await accepted; h.unmount(); finish(); await h.flush(); assert(!text(h.render()).includes('Original message confirmed.')); assert.equal(posts(s).length, 1);
});

test('server page validates exact canonical reference and forwards only fail-closed auth, never private account fields', async () => {
  const task = await taskFixture(), Page = PageModule.default;
  const context = tree => walk(tree, node => typeof node.type === 'function' && node.type.name === 'TaskDiscussionWorkspace')[0].props;
  assert.deepEqual(context(await Page({searchParams: Promise.resolve({task: task.id, digest: task.digest})})), {authenticated: false, taskId: task.id, taskDigest: task.digest});
  for (const query of [{task: [task.id, task.id], digest: task.digest}, {task: task.id.toUpperCase(), digest: task.digest}, {task: task.id, digest: task.digest, extra: '1'}, {}, {task: '00000000-0000-0000-0000-000000000000', digest: task.digest}]) assert.deepEqual(context(await Page({searchParams: query})), {authenticated: false, taskId: null, taskDigest: null});
  globalThis.__discussionUser = {id: 'synthetic-user', email: 'private@example.invalid', privateField: 'Never forward'};
  assert.deepEqual(context(await Page({searchParams: {task: task.id, digest: task.digest}})), {authenticated: true, taskId: task.id, taskDigest: task.digest});
  globalThis.__discussionAuthFailure = true; assert.equal(context(await Page({searchParams: {task: task.id, digest: task.digest}})).authenticated, false);
  const links = walk(await Page({}), node => node.type === 'a').map(node => node.props.href); assert.deepEqual(links, ['/', '/contribute', '/agent-guide/task-discussions']);
  delete globalThis.__discussionUser; delete globalThis.__discussionAuthFailure;
});

test('workspace has no durable browser state, credential input, code uploader, execution/provider or financial authority', async () => {
  const [source, css] = await Promise.all([readFile('app/task-discussion-workspace.tsx', 'utf8'), readFile('app/task-discussion.css', 'utf8')]);
  assert(!/localStorage|sessionStorage|indexedDB|type="file"|navigator\.clipboard|dangerouslySetInnerHTML|Authorization|api\.github|openai\.com|eval\(/.test(source));
  assert(source.includes('validateTaskDiscussionWrite') && source.includes('validateTaskDiscussionList') && source.includes('parseUniqueJson') && source.includes('pending.body') && source.includes('pending.author.authorId'));
  assert(css.includes(':focus-visible') && css.includes('prefers-reduced-motion') && css.includes('@media(max-width:640px)'));
  const task = await taskFixture(), s = server(task), h = harness(null, false); await h.until('Choose an exact task'); assert.equal(s.requests.length, 0);
});
