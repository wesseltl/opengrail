import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

// Actual component handlers with controlled React hooks and canonical synthetic
// receipts. This is local interaction evidence, not a browser or hosted rollout.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch, originalDocument = globalThis.document;
const hooks = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0, sets: 0};
globalThis.__contributionWorkHooks = {
  useState(initial) {const i = hooks.si++; if (!(i in hooks.state)) hooks.state[i] = typeof initial === 'function' ? initial() : initial; return [hooks.state[i], value => {hooks.sets++; hooks.state[i] = typeof value === 'function' ? value(hooks.state[i]) : value;}];},
  useRef(initial) {return hooks.refs[hooks.ri++] ??= {current: initial};},
  useEffect(callback, deps) {const i = hooks.ei++, old = hooks.deps[i]; if (!old || deps.some((value, n) => value !== old[n])) {hooks.deps[i] = deps; hooks.effects.push(() => {hooks.cleanup[i]?.(); hooks.cleanup[i] = callback();});}},
};
const built = await build({entryPoints: ['app/contributions.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'controlled-contribution-work', setup(b) {
  b.onResolve({filter: /^react$/}, a => a.importer.endsWith('/app/contributions.tsx') ? {path: a.path, namespace: 'stub'} : undefined);
  b.onLoad({filter: /.*/, namespace: 'stub'}, () => ({contents: 'export const {useState,useRef,useEffect}=globalThis.__contributionWorkHooks;', loader: 'js'}));
}}]});
const component = {exports: {}};
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, component, component.exports);
const Contributions = component.exports.default;
const model = await build({stdin: {contents: "export * from './app/contribution-model.ts'; export * from './app/contribution-work-model.ts';", resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
const m = await import('data:text/javascript;base64,' + Buffer.from(model.outputFiles[0].text).toString('base64'));
const uid = () => crypto.randomUUID(), at = '2026-10-11T10:00:00.000Z', checkedAt = '2026-10-11T10:02:00.000Z';
const human = n => ({kind: 'HUMAN', id: 'human_' + String(n).repeat(64), sponsorId: 'human_' + String(n).repeat(64)});
const participant = human(2), maintainer = human(1), agent = {kind: 'AGENT', id: uid(), sponsorId: participant.id};
const identity = (author = participant) => ({version: 1, authorId: author.id, sponsorId: author.sponsorId, maintainer: false, executionEnabled: false});
const ref = item => ({id: item.id, digest: item.digest});
const sorted = rows => [...rows].sort((a, b) => b.claim.createdAt.localeCompare(a.claim.createdAt) || b.claim.id.localeCompare(a.claim.id));
async function taskFixture(title = 'Synthetic work task') {
  const command = m.boundedContributionCommand({action: 'register', requestId: uid(), id: uid(), title, summary: 'A concrete synthetic contribution problem.', kind: 'TESTS', acceptance: ['Retain unfavorable evidence.'], rejection: ['Reject altered exact identities.'], policyAccepted: m.contributionPolicy}).command;
  const record = m.contributionTaskRecordForCommand(command, maintainer, at);
  return m.validateContributionTaskItem({id: record.id, digest: await m.contributionDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: record.createdAt, author: record.author, state: 'OPEN', sequence: 0, reason: null, record, events: []});
}
async function claimFixture(task, author = participant, createdAt = at) {
  const command = m.boundedContributionCommand({action: 'claim', requestId: uid(), id: uid(), task: ref(task), expectedTaskSequence: task.sequence, policyAccepted: m.contributionPolicy}).command;
  const record = m.contributionClaimRecordForCommand(command, author, createdAt);
  return m.validateContributionClaimItem({id: record.id, digest: await m.contributionDigest(JSON.stringify(record)), requestId: record.requestId, createdAt: record.createdAt, expiresAt: record.expiresAt, checkedAt, author, task: ref(task), taskState: task.state, sequence: 0, status: 'ACTIVE', handoffDigest: null, reason: null, record, events: []});
}
async function changeClaim(task, claim, action, actor, clock, extra = {}) {
  const command = m.boundedContributionCommand({action, requestId: uid(), task: ref(task), claim: ref(claim), expectedSequence: claim.sequence, policyAccepted: m.contributionPolicy, ...extra}).command;
  const record = m.contributionEventRecordForCommand(command, actor, clock), event = {...record, digest: await m.contributionDigest(JSON.stringify(record))};
  return m.validateContributionClaimItem({...claim, sequence: event.sequence, status: event.state, reason: event.reason, handoffDigest: action === 'submit' ? event.handoffDigest : claim.handoffDigest, events: [...claim.events, event]});
}
async function reviewed(task, claim, decision = 'CHANGES_REQUESTED') {
  claim = await changeClaim(task, claim, 'submit', claim.author, '2026-10-11T10:00:10.000Z', {handoffDigest: 'a'.repeat(64)});
  return changeClaim(task, claim, 'review', maintainer, '2026-10-11T10:00:20.000Z', {decision, reason: decision === 'ACCEPTED' ? 'ACCEPTANCE_MET' : decision === 'REJECTED' ? 'FAILED_ACCEPTANCE' : 'NEEDS_CHANGES'});
}
async function hide(task, claim) {
  const command = m.boundedContributionCommand({action: 'hide', requestId: uid(), task: ref(task), expectedSequence: task.sequence, reason: 'POLICY', policyAccepted: m.contributionPolicy}).command;
  const record = m.contributionEventRecordForCommand(command, maintainer, '2026-10-11T10:01:00.000Z'), event = {...record, digest: await m.contributionDigest(JSON.stringify(record))};
  task = await m.validateContributionTaskItem({...task, state: 'HIDDEN', sequence: event.sequence, reason: event.reason, record: null, events: [...task.events, event]});
  claim = await m.validateContributionClaimItem({...claim, taskState: 'HIDDEN', record: null, handoffDigest: null, reason: null, events: []});
  return {task, claim};
}
function page(rows, nextCursor = null, principal = participant, clock = checkedAt) {
  return m.contributionWorkPageSchema.parse({version: 1, scope: principal.kind === 'HUMAN' ? 'SPONSOR' : 'AGENT', participant: principal, checkedAt: clock, items: sorted(rows).map(row => ({task: row.task, claim: {...row.claim, checkedAt: clock}})), nextCursor, executionEnabled: false});
}
function walk(node, predicate) {if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate)); return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];}
function text(node) {return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node);}
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const panel = tree => walk(tree, node => node.props?.['aria-label'] === 'My contribution work')[0];
const deferred = () => {let resolve; const promise = new Promise(done => resolve = done); return {promise, resolve};};
function harness(authenticated = true) {
  hooks.cleanup.forEach(cleanup => cleanup?.()); for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup']) hooks[key] = []; hooks.sets = 0;
  const listeners = new Map(), doc = {hidden: false, addEventListener(name, fn) {const rows = listeners.get(name) ?? new Set(); rows.add(fn); listeners.set(name, rows);}, removeEventListener(name, fn) {listeners.get(name)?.delete(fn);}};
  globalThis.document = doc;
  const props = {authenticated}, render = () => {hooks.si = hooks.ri = hooks.ei = 0; return Contributions(props);};
  const flush = async () => {for (let n = 0; n < 8; n++) {render(); while (hooks.effects.length) hooks.effects.shift()(); await new Promise(resolve => setImmediate(resolve));} return render();};
  const until = async predicate => {const end = Date.now() + 5000; do {const tree = await flush(); if (predicate(tree)) return tree;} while (Date.now() < end); assert.fail('Timed out: ' + text(render()));};
  return {props, render, flush, until, click(name) {const b = button(render(), name); assert(b, 'missing ' + name); assert(!b.props.disabled, name + ' disabled'); b.props.onClick();}, field(name, value) {const f = walk(render(), node => node.props?.['aria-label'] === name)[0]; assert(f); assert(!f.props.disabled); f.props.onChange({target: {value, checked: value}});}, submit() {const form = walk(render(), node => node.type === 'form')[0]; assert(form); form.props.onSubmit({preventDefault() {}});}, visibility(hidden) {doc.hidden = hidden; for (const fn of listeners.get('visibilitychange') ?? []) fn();}, unmount() {hooks.cleanup.forEach(cleanup => cleanup?.());}};
}
function server(rows, {work, exact, post, me} = {}) {
  const state = {rows: [...rows], requests: [], who: identity(), writes: [], pages: 0, accepted: new Map()};
  globalThis.fetch = async (path, init = {}) => {
    state.requests.push({path, init}); const url = new URL(path, 'https://synthetic.invalid');
    if (url.pathname === '/api/contributions/me') return me ? await me(state) : Response.json(state.who);
    if (url.pathname === '/api/contributions/work') {state.pages++; assert.equal(init.headers?.['X-Contribution-Author'], state.who.authorId); return work ? await work(url, state, init) : Response.json(page(state.rows));}
    if (init.method === 'POST') {const command = JSON.parse(init.body); state.writes.push({command, init}); if (post) return post(command, state, init); assert.equal(command.action, 'claim'); let receipt = state.accepted.get(command.requestId); if (receipt) return Response.json(receipt); const task = state.rows.find(row => row.task.id === command.task.id).task, createdAt = '2026-10-11T10:03:00.000Z', record = m.contributionClaimRecordForCommand(command, participant, createdAt), digest = await m.contributionDigest(JSON.stringify(record)); const claim = await m.validateContributionClaimItem({id: record.id, digest, requestId: record.requestId, createdAt, expiresAt: record.expiresAt, checkedAt: createdAt, author: participant, task: ref(task), taskState: task.state, sequence: 0, status: 'ACTIVE', handoffDigest: null, reason: null, record, events: []}); receipt = {version: 1, action: 'claim', requestId: command.requestId, task, claim, acknowledgement: {action: 'claim', requestId: command.requestId, actor: participant, task: ref(task), claim: ref(claim), sequence: 0, createdAt, commandDigest: await m.contributionDigest(m.boundedContributionCommand(command).payload), digest}, executionEnabled: false}; await m.validateContributionWrite(receipt, command, participant); state.accepted.set(command.requestId, receipt); state.rows.unshift({task, claim}); return Response.json(receipt);}
    if (url.searchParams.has('claim')) {const row = state.rows.find(row => row.claim.id === url.searchParams.get('claim')); return exact ? await exact(row, state) : Response.json({version: 1, task: row.task, item: row.claim, executionEnabled: false});}
    const tasks = [...new Map(state.rows.map(row => [row.task.id, row.task])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    if (url.searchParams.has('task')) {const task = tasks.find(task => task.id === url.searchParams.get('task')), claims = state.rows.filter(row => row.task.id === task.id).map(row => row.claim).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)); return Response.json({version: 1, task, items: claims, nextCursor: null, executionEnabled: false});}
    return Response.json({version: 1, items: tasks, nextCursor: null, executionEnabled: false});
  };
  return state;
}
after(() => {hooks.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; delete globalThis.__contributionWorkHooks;});

test('actual My work renders own and sponsored-agent attempts across tasks with actual actor, original deadline and retained review', async () => {
  const taskA = await taskFixture('Synthetic reviewed work'), taskB = await taskFixture('Synthetic active work');
  const claimA = await reviewed(taskA, await claimFixture(taskA)), claimB = await claimFixture(taskB, agent, '2026-10-11T10:00:30.000Z');
  const s = server([{task: taskA, claim: claimA}, {task: taskB, claim: claimB}]), h = harness();
  const tree = await h.until(tree => text(panel(tree)).includes('Synthetic reviewed work') && text(panel(tree)).includes('Synthetic active work'));
  assert(text(panel(tree)).includes(participant.id)); assert(text(panel(tree)).includes(agent.id)); assert(text(panel(tree)).includes('CHANGES_REQUESTED')); assert(text(panel(tree)).includes('needs changes')); assert(text(panel(tree)).includes('Original deadline'));
  const clocks = walk(panel(tree), node => node.type === 'time'); assert(clocks.some(node => node.props.dateTime === claimA.expiresAt)); assert(clocks.some(node => node.props.dateTime === claimB.expiresAt));
  assert.equal(s.writes.length, 0); assert.equal(s.pages, 1); assert.equal(s.requests.filter(row => row.path === '/api/contributions/me').length, 3);
});

test('authenticated work pagination appends five older attempts with stable cursor, distinct identities and current page clock', async () => {
  const task = await taskFixture(), rows = []; for (let n = 0; n < 7; n++) rows.push({task, claim: await claimFixture(task, n % 2 ? agent : participant, new Date(Date.parse(at) + n * 1000).toISOString())}); const ordered = sorted(rows), anchor = ordered[4].claim.id;
  const s = server(rows, {work: async url => Response.json(url.searchParams.has('cursor') ? page(ordered.slice(5), null, participant, '2026-10-11T10:02:01.000Z') : page(ordered.slice(0, 5), anchor))}), h = harness();
  await h.until(tree => !!button(tree, 'Load older work') && !button(tree, 'Load older work').props.disabled); assert.equal(walk(panel(h.render()), node => node.type === 'li').length, 5);
  h.click('Load older work'); await h.until(tree => walk(panel(tree), node => node.type === 'li').length === 7 && !button(tree, 'Load older work'));
  assert.equal(s.requests.filter(row => row.path === '/api/contributions/work?cursor=' + anchor).length, 1); assert.equal(new Set(walk(panel(h.render()), node => node.type === 'li').map(row => row.props['aria-label'])).size, 7);
});

test('opening My work fetches the exact claim and current task before existing controls and exact discussion are shown', async () => {
  const task = await taskFixture('Exact synthetic task'), claim = await claimFixture(task), s = server([{task, claim}]), h = harness(); await h.until(tree => !!button(tree, 'Open work attempt ' + claim.id) && !button(tree, 'Open work attempt ' + claim.id).props.disabled);
  h.click('Open work attempt ' + claim.id); await h.until(tree => !!button(tree, 'Submit handoff digest') && !button(tree, 'Submit handoff digest').props.disabled);
  assert(s.requests.some(row => row.path === '/api/contributions?claim=' + claim.id)); assert(walk(h.render(), node => node.type === 'a').some(node => node.props.href === '/contribute/discussion?task=' + task.id + '&digest=' + task.digest)); assert.equal(s.writes.length, 0);
});

test('terminal agent attempt prepares a separately consented new human claim without changing original deadline, actor or disposition', async () => {
  const task = await taskFixture(), old = await reviewed(task, await claimFixture(task, agent)), s = server([{task, claim: old}]), h = harness(); await h.until(tree => !!button(tree, 'Start new human attempt after ' + old.id) && !button(tree, 'Start new human attempt after ' + old.id).props.disabled);
  h.click('Start new human attempt after ' + old.id); await h.until(tree => walk(tree, node => node.type === 'form').length === 1); assert.equal(s.writes.length, 0); h.field('Accept contribution policy', true); h.submit(); await h.until(tree => text(tree).includes('Claim recorded with its original 72-hour deadline'));
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0].command.action, 'claim'); assert.equal(s.writes[0].init.headers['X-Contribution-Author'], participant.id); assert.notEqual(s.writes[0].command.id, old.id); assert(!('retryOf' in s.writes[0].command));
  const retained = s.rows.find(row => row.claim.id === old.id).claim; assert.equal(retained.expiresAt, old.expiresAt); assert.deepEqual(retained.author, agent); assert.equal(retained.status, 'CHANGES_REQUESTED'); assert(text(panel(h.render())).includes(old.id));
});

test('new attempt checks current task history and refuses an active foreign claim absent from the sponsor inbox', async () => {
  const task = await taskFixture(), old = await reviewed(task, await claimFixture(task, agent)), foreign = await claimFixture(task, human(3), '2026-10-11T10:00:30.000Z');
  const s = server([{task, claim: old}, {task, claim: foreign}], {work: async () => Response.json(page([{task, claim: old}]))}), h = harness(); await h.until(tree => !!button(tree, 'Start new human attempt after ' + old.id) && !button(tree, 'Start new human attempt after ' + old.id).props.disabled);
  h.click('Start new human attempt after ' + old.id); await h.until(tree => text(panel(tree)).includes('A new attempt is unavailable'));
  assert(s.requests.some(row => row.path === '/api/contributions?task=' + task.id + '&digest=' + task.digest)); assert.equal(s.writes.length, 0); assert.equal(walk(h.render(), node => node.type === 'form').length, 0); assert(text(panel(h.render())).includes(old.id));
});

test('fresh attempt inspects both bounded history pages and refuses an older active claim beyond the first twenty rows', async () => {
  const task = await taskFixture(), old = await reviewed(task, await claimFixture(task, agent)), rows = [{task, claim: old}];
  for (let n = 1; n <= 20; n++) {let claim = await claimFixture(task, participant, new Date(Date.parse(at) + n * 1000).toISOString()); claim = await changeClaim(task, claim, 'release', participant, '2026-10-11T10:01:00.000Z', {reason: 'AUTHOR_RELEASE'}); rows.push({task, claim});}
  const foreign = await claimFixture(task, human(3)), ordered = sorted([...rows, {task, claim: foreign}]), cursor = ordered[19].claim.id;
  const s = server(ordered, {work: async () => Response.json(page([{task, claim: old}]))}); const normalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init) => {const url = new URL(path, 'https://synthetic.invalid'); if (url.searchParams.has('task')) {s.requests.push({path, init}); const second = url.searchParams.has('cursor'); return Response.json({version: 1, task, items: (second ? ordered.slice(20) : ordered.slice(0, 20)).map(row => row.claim), nextCursor: second ? null : cursor, executionEnabled: false});} return normalFetch(path, init);};
  const h = harness(); await h.until(tree => !!button(tree, 'Start new human attempt after ' + old.id) && !button(tree, 'Start new human attempt after ' + old.id).props.disabled); h.click('Start new human attempt after ' + old.id); await h.until(tree => text(panel(tree)).includes('A new attempt is unavailable'));
  assert.equal(s.requests.filter(row => new URL(row.path, 'https://synthetic.invalid').searchParams.has('task')).length, 4); assert(s.requests.some(row => row.path.endsWith('&cursor=' + cursor))); assert.equal(s.writes.length, 0); assert.equal(walk(h.render(), node => node.type === 'form').length, 0);
});

test('source hiding or a new active claim during the final identity await is rechecked before a fresh attempt can open', async () => {
  for (const change of ['HIDE', 'ACTIVE']) {
    const task = await taskFixture('Final identity race title'), old = await reviewed(task, await claimFixture(task, agent)), concealed = await hide(task, old), foreign = await claimFixture(task, human(3), '2026-10-11T10:00:30.000Z'), wait = deferred(); let holdIdentity = false, waiting = false, exactReads = 0;
    const s = server([{task, claim: old}], {work: async () => Response.json(page([{task, claim: old}])), me: async state => {if (holdIdentity) {holdIdentity = false; waiting = true; return wait.promise;} return Response.json(state.who);}, exact: async row => {if (++exactReads === 1) holdIdentity = true; return Response.json({version: 1, task: row.task, item: row.claim, executionEnabled: false});}}), h = harness();
    await h.until(tree => !!button(tree, 'Start new human attempt after ' + old.id) && !button(tree, 'Start new human attempt after ' + old.id).props.disabled); h.click('Start new human attempt after ' + old.id); await h.until(() => waiting);
    s.rows = change === 'HIDE' ? [concealed] : [{task, claim: old}, {task, claim: foreign}]; wait.resolve(Response.json(s.who)); await h.until(tree => text(panel(tree)).includes('A new attempt is unavailable'));
    assert.equal(exactReads, 2); assert.equal(s.writes.length, 0); assert.equal(walk(h.render(), node => node.type === 'form').length, 0); assert(text(panel(h.render())).includes(old.id));
    if (change === 'HIDE') {assert(!text(panel(h.render())).includes('Final identity race title')); assert(!text(h.render()).includes('a'.repeat(64)));}
  }
});

test('older inbox page cannot repeat a retained claim or move ahead of its requested cursor', async () => {
  const task = await taskFixture(), rows = []; for (let n = 0; n < 6; n++) rows.push({task, claim: await claimFixture(task, participant, new Date(Date.parse(at) + n * 1000).toISOString())}); const ordered = sorted(rows), cursor = ordered[4].claim.id;
  const s = server(rows, {work: async url => Response.json(url.searchParams.has('cursor') ? page([ordered[0]]) : page(ordered.slice(0, 5), cursor))}), h = harness(); await h.until(tree => !!button(tree, 'Load older work') && !button(tree, 'Load older work').props.disabled); h.click('Load older work'); await h.until(tree => text(panel(tree)).includes('Your work is unavailable'));
  assert.equal(walk(panel(h.render()), node => node.type === 'li').length, 5); assert(button(h.render(), 'Load older work').props.disabled); assert.equal(s.pages, 2); assert.equal(s.writes.length, 0);
});

test('schema-valid foreign sponsor and agent-only inbox responses are rejected before authored payload is installed', async () => {
  for (const principal of [human(3), agent]) {const task = await taskFixture('Foreign work must stay absent'), claim = await claimFixture(task, principal); server([{task, claim}], {work: async () => Response.json(page([{task, claim}], null, principal))}); const h = harness(); await h.until(tree => text(panel(tree)).includes('Your work is unavailable')); assert(!text(panel(h.render())).includes('Foreign work must stay absent')); assert(!button(h.render(), 'Open work attempt ' + claim.id));}
});

test('account swap while an inbox response is pending clears private work and prevents stale payload restoration', async () => {
  const task = await taskFixture('Old participant inbox text'), claim = await claimFixture(task), wait = deferred(), s = server([{task, claim}], {work: async () => wait.promise}), h = harness(); await h.until(() => s.pages === 1); s.who = identity(human(3)); wait.resolve(Response.json(page([{task, claim}])));
  await h.until(tree => text(tree).includes('Sign in to participate. Public tasks remain available.')); assert(!text(panel(h.render())).includes('Old participant inbox text')); assert.equal(walk(panel(h.render()), node => node.type === 'li').length, 0); assert.equal(s.writes.length, 0);
});

test('known hidden task floors scrub inbox rationale and handoff even when a later page supplies an older visible snapshot', async () => {
  const task = await taskFixture('Hidden inbox title'), claim = await reviewed(task, await claimFixture(task)), original = {task, claim}, concealed = await hide(task, claim), s = server([original]), h = harness(); await h.until(tree => text(panel(tree)).includes('Hidden inbox title'));
  s.rows = [concealed]; h.click('Refresh tasks'); await h.until(tree => !text(panel(tree)).includes('Hidden inbox title')); s.rows = [original]; h.click('Refresh my work'); await h.until(tree => !!button(tree, 'Refresh my work') && !button(tree, 'Refresh my work').props.disabled && s.pages === 2);
  assert(!text(panel(h.render())).includes('Hidden inbox title')); assert(!text(panel(h.render())).includes('needs changes')); assert(!text(panel(h.render())).includes('a'.repeat(64))); assert(text(panel(h.render())).includes('Task content unavailable'));
});

test('visibility suspension invalidates a pending inbox response and requires an explicit fresh request when visible again', async () => {
  const task = await taskFixture('Suspended inbox source'), claim = await claimFixture(task), wait = deferred(), s = server([{task, claim}], {work: async () => s.pages === 1 ? wait.promise : Response.json(page([{task, claim}]))}), h = harness();
  await h.until(() => s.pages === 1);
  h.visibility(true); wait.resolve(Response.json(page([{task, claim}]))); await h.flush();
  assert(!text(panel(h.render())).includes('Suspended inbox source'));
  h.visibility(false);
  // The independent task-catalog load may still be validating its hashes.
  // Wait for the actual user action to become available, while proving that
  // restoring visibility does not issue an automatic inbox request.
  await h.until(tree => {
    assert.equal(s.pages, 1, 'visibility restoration must not refresh the inbox automatically');
    assert(!text(panel(tree)).includes('Suspended inbox source'), 'the suspended response must remain absent');
    const refresh = button(tree, 'Refresh my work');
    return !!refresh && !refresh.props.disabled;
  });
  assert(text(panel(h.render())).includes('Refresh your work'));
  h.click('Refresh my work'); await h.until(tree => text(panel(tree)).includes('Suspended inbox source'));
  assert.equal(s.pages, 2); assert.equal(s.writes.length, 0);
});

test('retained writer uncertainty blocks inbox refresh and stale saved handlers without replacing the original command', async () => {
  const task = await taskFixture(), claim = await reviewed(task, await claimFixture(task)), s = server([{task, claim}], {post: async () => {throw Error('Synthetic lost acknowledgment');}}), h = harness(); await h.until(tree => !!button(tree, 'Start new human attempt after ' + claim.id) && !button(tree, 'Start new human attempt after ' + claim.id).props.disabled); const oldRefresh = button(h.render(), 'Refresh my work').props.onClick;
  h.click('Start new human attempt after ' + claim.id); await h.until(tree => walk(tree, node => node.type === 'form').length === 1); h.field('Accept contribution policy', true); h.submit(); await h.until(tree => !!button(tree, 'Retry identical request'));
  const body = s.writes[0].init.body, pages = s.pages; assert(button(h.render(), 'Refresh my work').props.disabled); oldRefresh(); await h.flush(); assert.equal(s.pages, pages); h.click('Retry identical request'); await h.until(() => s.writes.length === 2); assert.equal(s.writes[1].init.body, body); assert.equal(s.writes[1].command.requestId, s.writes[0].command.requestId);
});

test('unmount invalidates deferred inbox work without later state writes or automatic publication', async () => {
  const task = await taskFixture(), claim = await claimFixture(task), wait = deferred(), s = server([{task, claim}], {work: async () => wait.promise}), h = harness(); await h.until(() => s.pages === 1); h.unmount(); const count = hooks.sets; wait.resolve(Response.json(page([{task, claim}]))); await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); assert.equal(hooks.sets, count); assert.equal(s.writes.length, 0);
});
