'use client';

import {useEffect, useRef, useState} from 'react';
import {parseUniqueJson} from './unique-json';
import {contributionLimits, contributionGetSchema, contributionClaimsSchema, contributionMeSchema, validateContributionTaskItem, validateContributionClaimItem} from './contribution-model';
import {boundedTaskDiscussionCommand, taskDiscussionLimits, taskDiscussionPolicy, taskDiscussionKinds, taskDiscussionWithdrawReasons, taskDiscussionHideReasons, taskDiscussionReportCategories, taskDiscussionListSchema, taskDiscussionReportListSchema, taskDiscussionDigest, validateTaskDiscussionList, validateTaskDiscussionGet, validateTaskDiscussionReports, validateTaskDiscussionWrite} from './task-discussion-model';
import './task-discussion.css';

type Task = ReturnType<typeof contributionGetSchema.parse>['item'];
type Claim = ReturnType<typeof contributionClaimsSchema.parse>['items'][number];
type Me = ReturnType<typeof contributionMeSchema.parse>;
type Item = ReturnType<typeof taskDiscussionListSchema.parse>['items'][number];
type Report = ReturnType<typeof taskDiscussionReportListSchema.parse>['reports'][number];
type Command = ReturnType<typeof boundedTaskDiscussionCommand>['command'];
type Action = Command['action'];
type Fields = {body: string; claim: string; kind: NonNullable<Item['record']>['kind']; reason: string; details: string; consent: boolean};
type Form = {action: Action; task: Task; target: Item | null};
type Pending = {command: Command; body: string; author: Me; submitted: boolean};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ref = (item: {id: string; digest: string}) => ({id: item.id, digest: item.digest});
const actor = (me: Me) => ({kind: 'HUMAN' as const, id: me.authorId, sponsorId: me.sponsorId});
const short = (value: string) => value.length > 22 ? value.slice(0, 10) + '…' + value.slice(-6) : value;
const stamp = (value: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(value));
const kindLabel = {QUESTION: 'Question', PROPOSAL: 'Public specification', COUNTEREXAMPLE: 'Counterexample', PEER_REVIEW: 'Peer comment'} as const;
const reasonLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const blank = (): Fields => ({body: '', claim: '', kind: 'QUESTION', reason: '', details: '', consent: false});
const endpoint = '/api/contributions/discussion';

async function read(response: Response, maximum: number = taskDiscussionLimits.responseBytes): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw Error('Missing response.');
  const parts: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) { await reader.cancel(); throw Error('Response exceeds its bound.'); } parts.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let position = 0; for (const part of parts) { bytes.set(part, position); position += part.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), maximum, taskDiscussionLimits.maximumDepth);
}

/** Public task coordination only. Exact uncertain commands stay in memory; credentials and code never enter this surface. */
export default function TaskDiscussionWorkspace({authenticated, taskId, taskDigest}: {authenticated: boolean; taskId: string | null; taskDigest: string | null}) {
  const [task, setTask] = useState<Task | null>(null), [items, setItems] = useState<Item[]>([]), [next, setNext] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]), [claimNext, setClaimNext] = useState<string | null>(null), [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Form | null>(null), [fields, setFields] = useState(blank), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false), [identityLocked, setIdentityLocked] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [reports, setReports] = useState<Report[] | null>(null), [reportNext, setReportNext] = useState<string | null>(null), [reportsLoading, setReportsLoading] = useState(false), [reportsError, setReportsError] = useState('');
  const [mountedEpoch, setMountedEpoch] = useState(0);
  const target = taskId && taskDigest ? {id: taskId, digest: taskDigest} : null;
  const life = useRef({alive: false, authenticated, target, epoch: 0, readId: 0, identityId: 0, reportReadId: 0, formId: 0, locked: false, reading: false, privateReading: false, refreshRequired: false, pending: null as Pending | null, controllers: new Set<AbortController>(), knownTask: null as Task | null, known: new Map<string, Item>(), hiddenTasks: new Set<string>()});
  const previousTarget = useRef(target), previousAuthentication = useRef(authenticated);
  const view = useRef({task, items, claims, me, form, fields, reports}); view.current = {task, items, claims, me, form, fields, reports};
  life.current.authenticated = authenticated; life.current.target = target;
  const renderedFormId = life.current.formId, renderedPending = life.current.pending;
  const routeLocked = !!life.current.pending && !same(target, life.current.pending.command.task);
  const blocked = loading || busy || reportsLoading || uncertain || identityLocked || routeLocked || !!life.current.pending;
  const readBlocked = loading || busy || reportsLoading || uncertain || routeLocked || !!life.current.pending;
  const principalReady = authenticated && !!me && !identityLocked && !life.current.refreshRequired && !routeLocked;
  const hidden = !!task && life.current.hiddenTasks.has(task.id);
  const canPublish = principalReady && task?.state === 'OPEN' && !hidden;
  function alive(epoch = life.current.epoch) { return life.current.alive && life.current.epoch === epoch; }
  function active() { return alive(mountedEpoch); }
  function abortReads() { const s = life.current; s.controllers.forEach(controller => controller.abort()); s.controllers.clear(); s.readId++; s.reportReadId++; }
  function clearForm() { life.current.formId++; view.current.form = null; setForm(null); view.current.fields = blank(); setFields(blank()); }
  function clearReports() { life.current.reportReadId++; life.current.privateReading = false; view.current.reports = null; setReports(null); setReportNext(null); setReportsLoading(false); setReportsError(''); }
  function accountLost() {
    const s = life.current; s.epoch++; setMountedEpoch(s.epoch); s.identityId++; abortReads(); s.locked = false; s.reading = false;
    view.current.me = null; setMe(null); clearForm(); clearReports(); setBusy(false); setLoading(false); setNotice('');
    if (s.pending) { setUncertain(true); setIdentityLocked(true); setError('The original participant is required to reconcile the held request. Its exact body and request ID remain in this tab.'); }
    else { setIdentityLocked(true); setUncertain(false); setError('Sign in again before participating. Public discussion remains readable.'); }
  }
  // Verify complete incoming rows before mutating any visibility floor. A later read cannot restore known suppressed content.
  function install(incomingTask: Task, incoming: Item[]) {
    const s = life.current, oldTask = s.knownTask, known = new Map(s.known), hiddenTasks = new Set(s.hiddenTasks);
    if (!same(ref(incomingTask), s.target)) throw Error('Foreign task.');
    if (oldTask && (!same([oldTask.id, oldTask.digest, oldTask.requestId, oldTask.createdAt, oldTask.author], [incomingTask.id, incomingTask.digest, incomingTask.requestId, incomingTask.createdAt, incomingTask.author]) || incomingTask.sequence >= oldTask.sequence && !same(incomingTask.events.slice(0, oldTask.events.length), oldTask.events))) throw Error('Task identity or lifecycle changed.');
    const retainedTask = oldTask && oldTask.sequence > incomingTask.sequence ? oldTask : incomingTask;
    if (retainedTask.state === 'HIDDEN') hiddenTasks.add(retainedTask.id);
    for (const row of incoming) {
      if (!same(row.task, ref(retainedTask))) throw Error('Foreign message.');
      const old = known.get(row.id);
      if (old && (!same([old.id, old.digest, old.requestId, old.createdAt, old.author, old.task], [row.id, row.digest, row.requestId, row.createdAt, row.author, row.task]) || row.sequence >= old.sequence && !same(row.events.slice(0, old.events.length), old.events))) throw Error('Message identity or lifecycle changed.');
      if (!old || row.sequence >= old.sequence) known.set(row.id, row);
    }
    if (known.size > taskDiscussionLimits.messagesPerTask) throw Error('Retained discussion exceeds its bound.');
    const taskHidden = hiddenTasks.has(retainedTask.id);
    const safeTask = taskHidden ? {...retainedTask, record: null} : retainedTask;
    for (const [id, row] of known) known.set(id, {...row, taskState: safeTask.state, state: taskHidden && row.state !== 'WITHDRAWN' ? 'HIDDEN' : row.state, record: taskHidden || row.state !== 'VISIBLE' ? null : row.record});
    s.knownTask = safeTask; s.known = known; s.hiddenTasks = hiddenTasks;
    view.current.task = safeTask; setTask(safeTask); view.current.items = view.current.items.map(row => known.get(row.id) ?? row); setItems(view.current.items);
    if (taskHidden) { view.current.claims = view.current.claims.map(row => ({...row, taskState: 'HIDDEN' as const, record: null, handoffDigest: null, reason: null, events: []})); setClaims(view.current.claims); setClaimNext(null); }
    const openForm = view.current.form;
    if (openForm && (taskHidden && openForm.action !== 'withdraw' || openForm.action === 'publish' && safeTask.state !== 'OPEN' || openForm.target && known.get(openForm.target.id)?.state !== 'VISIBLE' && openForm.action !== 'withdraw')) clearForm();
    if (taskHidden) setNotice('');
    return {task: safeTask, items: incoming.map(row => known.get(row.id)!)};
  }
  async function identity(): Promise<Me | null> {
    const s = life.current; if (!s.alive || !s.authenticated) return null;
    const epoch = s.epoch, id = ++s.identityId, controller = new AbortController(); s.controllers.add(controller);
    try {
      const response = await fetch(endpoint + '/me', {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!alive(epoch) || id !== s.identityId || controller.signal.aborted || !s.authenticated) return null;
      if (response.status === 401 || response.status === 403) { accountLost(); return null; }
      if (!response.ok) throw Error();
      const context = contributionMeSchema.parse(await read(response, 4096));
      if (!alive(epoch) || id !== s.identityId || controller.signal.aborted || !s.authenticated) return null;
      const previous = view.current.me;
      if (previous && !same(actor(previous), actor(context)) || s.pending && !same(actor(s.pending.author), actor(context))) { accountLost(); return null; }
      if (!context.maintainer) clearReports();
      view.current.me = context; setMe(context); setIdentityLocked(false); return context;
    } catch { if (alive(epoch) && id === s.identityId) { view.current.me = null; setMe(null); clearReports(); setError('Participant context is unavailable. Check identity before an intended action.'); } return null; }
    finally { s.controllers.delete(controller); }
  }
  async function load(cursor: string | null = null) {
    const s = life.current; if (!s.alive || !s.target || s.locked || s.pending || view.current.form) return;
    const selected = structuredClone(s.target), anchor = cursor ? view.current.items.find(row => row.id === cursor) : null;
    const epoch = s.epoch, id = ++s.readId, controller = new AbortController(); s.controllers.add(controller); s.reading = true; setLoading(true); setError(''); s.refreshRequired = true;
    try {
      if (cursor && !anchor) throw Error();
      const response = await fetch(endpoint + '?task=' + selected.id + '&digest=' + selected.digest + (cursor ? '&cursor=' + cursor : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!response.ok) throw Error();
      const page = await validateTaskDiscussionList(await read(response)), currentTask = page.task, rows = page.items;
      if (!same(ref(currentTask), selected) || cursor && (page.nextCursor === cursor || rows.some(row => row.id === cursor || row.createdAt > anchor!.createdAt || row.createdAt === anchor!.createdAt && row.id >= anchor!.id))) throw Error();
      if (!alive(epoch) || id !== s.readId || controller.signal.aborted || !same(selected, s.target) || s.pending || view.current.form) return;
      const projected = install(currentTask, rows); view.current.items = projected.items; setItems(projected.items); setNext(page.nextCursor); s.refreshRequired = false;
    } catch { if (alive(epoch) && id === s.readId && !controller.signal.aborted) setError('Exact task discussion is unavailable. No new page was accepted; refresh this reference before acting.'); }
    finally { s.controllers.delete(controller); if (alive(epoch) && id === s.readId) { s.reading = false; setLoading(false); } }
  }
  async function loadClaims(cursor: string | null = null) {
    const s = life.current; if (!active() || !s.target || blocked || view.current.form) return;
    const selected = structuredClone(s.target), anchor = cursor ? view.current.claims.find(row => row.id === cursor) : null;
    const epoch = s.epoch, id = ++s.readId, controller = new AbortController(); s.controllers.add(controller); s.reading = true; setLoading(true); s.refreshRequired = true;
    try {
      if (cursor && !anchor) throw Error();
      const response = await fetch('/api/contributions?task=' + selected.id + '&digest=' + selected.digest + (cursor ? '&cursor=' + cursor : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!response.ok) throw Error();
      const page = contributionClaimsSchema.parse(await read(response, contributionLimits.responseBytes)), currentTask = await validateContributionTaskItem(page.task), rows = await Promise.all(page.items.map(validateContributionClaimItem));
      if (!same(ref(currentTask), selected) || cursor && (page.nextCursor === cursor || rows.some(row => row.id === cursor || row.createdAt > anchor!.createdAt || row.createdAt === anchor!.createdAt && row.id >= anchor!.id))) throw Error();
      if (!alive(epoch) || id !== s.readId || controller.signal.aborted || !same(selected, s.target) || s.pending || view.current.form) return;
      const projected = install(currentTask, []); view.current.claims = projected.task.state === 'HIDDEN' ? rows.map(row => ({...row, taskState: 'HIDDEN' as const, record: null, handoffDigest: null, reason: null, events: []})) : rows; setClaims(view.current.claims); setClaimNext(projected.task.state === 'HIDDEN' ? null : page.nextCursor); s.refreshRequired = false;
    } catch { if (alive(epoch) && id === s.readId && !controller.signal.aborted) setError('Exact optional claim references are unavailable. Refresh the task before acting.'); }
    finally { s.controllers.delete(controller); if (alive(epoch) && id === s.readId) { s.reading = false; setLoading(false); } }
  }
  async function inspectMessage(reference: {id: string; digest: string}) {
    const s = life.current; if (!active() || readBlocked || view.current.form || !s.target) return;
    const id = reference.id;
    const epoch = s.epoch, operation = ++s.readId, controller = new AbortController(); s.controllers.add(controller); s.reading = true; setLoading(true); s.refreshRequired = true;
    try {
      const response = await fetch(endpoint + '?id=' + id, {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])}); if (!response.ok) throw Error();
      const body = await validateTaskDiscussionGet(await read(response)), currentTask = body.task, item = body.item;
      if (!same(ref(item), reference) || !same(ref(currentTask), s.target)) throw Error();
      if (!alive(epoch) || operation !== s.readId || controller.signal.aborted || s.pending || view.current.form) return;
      const projected = install(currentTask, [item]); view.current.items = [projected.items[0], ...view.current.items.filter(row => row.id !== id)].slice(0, taskDiscussionLimits.page); setItems(view.current.items); setNext(null); s.refreshRequired = false;
    } catch { if (alive(epoch) && operation === s.readId && !controller.signal.aborted) setError('Exact referenced message is unavailable. Refresh before acting.'); }
    finally { s.controllers.delete(controller); if (alive(epoch) && operation === s.readId) { s.reading = false; setLoading(false); } }
  }
  function begin(action: Action, selected: Item | null = null, kind: Fields['kind'] = 'QUESTION') {
    const s = life.current, current = view.current.me, currentTask = view.current.task;
    if (!active() || s.locked || s.reading || s.privateReading || s.pending || s.refreshRequired || !s.authenticated || !current || identityLocked || !currentTask || !same(ref(currentTask), s.target) || !same(currentTask, s.knownTask) || action === 'hide' && !current.maintainer) return;
    if (selected && !same(selected, s.known.get(selected.id))) return;
    if (action === 'withdraw' ? !selected || selected.author.kind !== 'HUMAN' || selected.author.id !== current.authorId || selected.state === 'WITHDRAWN' : currentTask.state === 'HIDDEN' || action === 'publish' && (currentTask.state !== 'OPEN' || selected && (!selected.record || selected.state !== 'VISIBLE')) || action === 'hide' && (!selected || selected.state !== 'VISIBLE') || action === 'report' && (!selected || !selected.record || selected.state !== 'VISIBLE')) return;
    s.formId++; const value = {action, task: currentTask, target: selected}, values = {...blank(), kind, reason: action === 'withdraw' ? taskDiscussionWithdrawReasons[0] : action === 'hide' ? taskDiscussionHideReasons[0] : action === 'report' ? taskDiscussionReportCategories[0] : ''};
    view.current.form = value; setForm(value); view.current.fields = values; setFields(values); setError(''); setNotice('');
  }
  function change(changes: Partial<Fields>) { const s = life.current; if (!active() || s.formId !== renderedFormId || s.pending || s.locked || !view.current.form) return; const values = {...view.current.fields, ...changes}; view.current.fields = values; setFields(values); }
  function cancel() { if (!active() || life.current.formId !== renderedFormId || life.current.pending || life.current.locked) return; clearForm(); setError(''); }
  function submit() {
    const s = life.current, current = view.current.me, intended = view.current.form, f = view.current.fields;
    if (!active() || s.formId !== renderedFormId || s.pending || s.locked || s.reading || s.privateReading || s.refreshRequired || !s.authenticated || !current || identityLocked || !intended || !f.consent || intended.action === 'hide' && !current.maintainer) return;
    if (!same(ref(intended.task), s.target) || !same(intended.task, s.knownTask) || intended.target && !same(intended.target, s.known.get(intended.target.id))) { clearForm(); s.refreshRequired = true; setError('The exact task or message changed. Refresh before another intended action.'); return; }
    const common = {requestId: crypto.randomUUID(), task: ref(intended.task), policyAccepted: taskDiscussionPolicy}; let raw: unknown;
    if (intended.action === 'publish') {
      const claim = f.claim ? view.current.claims.find(row => row.id === f.claim && row.record && same(row.task, ref(intended.task)) && row.taskState !== 'HIDDEN') : null;
      if (f.claim && !claim) { setError('Choose a current visible claim reference or leave it unassociated.'); return; }
      raw = {action: 'publish', ...common, id: crypto.randomUUID(), expectedTaskSequence: intended.task.sequence, claim: claim ? ref(claim) : null, replyTo: intended.target ? ref(intended.target) : null, kind: f.kind, body: f.body};
    } else if (intended.target) raw = intended.action === 'report' ? {action: 'report', ...common, message: ref(intended.target), category: f.reason, details: f.details} : {action: intended.action, ...common, message: ref(intended.target), expectedSequence: intended.target.sequence, reason: f.reason};
    else return;
    try { const {command, payload} = boundedTaskDiscussionCommand(raw); const pending = {command, body: payload, author: structuredClone(current), submitted: false}; s.pending = pending; void write(pending); }
    catch { setError('Check the bounded public text, exact references and policy consent. No request was sent.'); }
  }
  async function write(pending: Pending) {
    const s = life.current; if (!s.alive || s.locked || s.pending !== pending || !s.authenticated || !same(s.target, pending.command.task)) return;
    s.locked = true; setBusy(true);
    // A preflight plus the mandatory author header binds every retry to its original human participant.
    const preflightEpoch = s.epoch, context = await identity();
    if (!context || !alive(preflightEpoch) || s.pending !== pending || !s.authenticated || !same(s.target, pending.command.task) || !same(actor(context), actor(pending.author)) || pending.command.action === 'hide' && !context.maintainer) { if (alive(preflightEpoch) && s.pending === pending) { setUncertain(true); setError(pending.submitted ? 'Outcome unknown. Check the original task and participant before retrying unchanged.' : 'The request was not sent. Check the original task and participant and retry the held request unchanged.'); s.locked = false; setBusy(false); } return; }
    const epoch = s.epoch; s.locked = true; pending.submitted = true; setBusy(true); setUncertain(false); setError('');
    const controller = new AbortController(); s.controllers.add(controller);
    try {
      const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Task-Discussion-Intent': 'submit', 'X-Task-Discussion-Author': pending.author.authorId}, body: pending.body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)])});
      if (!alive(epoch) || s.pending !== pending || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { accountLost(); return; }
      if (!response.ok) {
        if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) { s.pending = null; clearForm(); setUncertain(false); s.refreshRequired = response.status === 409 || response.status === 404; setError(response.status === 409 || response.status === 404 ? 'Request rejected because the exact task, message or operation changed. Refresh before another intended action.' : response.status === 429 ? 'Discussion capacity reached. Retained records are not evicted; any daily retry timing comes from the server.' : 'Request rejected. Review the fields and current state before another intended action.'); return; }
        throw Error();
      }
      const receipt = await validateTaskDiscussionWrite(await read(response), pending.command, actor(pending.author));
      if (!alive(epoch) || s.pending !== pending || controller.signal.aborted) return;
      const confirmed = await identity();
      if (!alive(epoch) || s.pending !== pending || controller.signal.aborted || !same(s.target, pending.command.task)) return;
      if (!confirmed || !same(actor(confirmed), actor(pending.author)) || pending.command.action === 'hide' && !confirmed.maintainer) throw Error('Original current participant unavailable.');
      const projected = install(receipt.task, receipt.message ? [receipt.message] : []);
      if (receipt.message) { const row = projected.items[0]; view.current.items = [row, ...view.current.items.filter(item => item.id !== row.id)].slice(0, taskDiscussionLimits.page); setItems(view.current.items); setNext(null); }
      s.pending = null; clearForm(); setUncertain(false); setIdentityLocked(false); s.refreshRequired = false;
      setNotice(projected.task.state === 'HIDDEN' ? 'Original request confirmed. Current task content is suppressed; no authored material was restored.' : pending.command.action === 'report' ? 'Original private report confirmed. Details are visible only to explicitly authorized human contribution maintainers.' : pending.command.action === 'hide' ? 'Message hidden through human maintainer authority. Its immutable history is retained.' : pending.command.action === 'withdraw' ? 'Message withdrawn. Its immutable history is retained.' : 'Original message confirmed. This authored contribution awards no trust, task acceptance or reputation.');
    } catch { if (alive(epoch) && s.pending === pending) { setUncertain(true); setError('Outcome unknown. The exact original body, request ID and participant are held in this tab. Retry unchanged before taking another action.'); } }
    finally { s.controllers.delete(controller); if (alive(epoch)) { s.locked = false; setBusy(false); } }
  }
  function retry() { const s = life.current, pending = s.pending; if (active() && pending && pending === renderedPending && !s.locked && authenticated && !identityLocked && same(s.target, pending.command.task)) void write(pending); }
  async function loadReports(cursor: string | null = null) {
    const s = life.current; if (!active() || blocked || s.locked || s.reading || s.privateReading || s.pending || view.current.form || !s.authenticated || !view.current.me?.maintainer) return;
    const epoch = s.epoch, id = ++s.reportReadId, controller = new AbortController(); s.controllers.add(controller); s.privateReading = true; setReportsLoading(true); setReportsError('');
    const previous = view.current.reports, anchor = cursor ? previous?.at(-1) : null; view.current.reports = null; setReports(null);
    try {
      if (cursor && (!anchor || await taskDiscussionDigest(JSON.stringify(anchor)) !== cursor)) throw Error();
      const context = await identity(); if (!context?.maintainer || !alive(epoch) || id !== s.reportReadId) return;
      const response = await fetch(endpoint + '/reports' + (cursor ? '?cursor=' + cursor : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (response.status === 401 || response.status === 403) { clearReports(); void identity(); throw Error(); }
      if (!response.ok) throw Error();
      const page = await validateTaskDiscussionReports(await read(response));
      const reportKey = (row: Report) => row.reporter.kind + ':' + row.reporter.id;
      if (page.nextCursor && (!page.reports.length || await taskDiscussionDigest(JSON.stringify(page.reports.at(-1))) !== page.nextCursor) || cursor && (page.nextCursor === cursor || page.reports.some(row => row.createdAt > anchor!.createdAt || row.createdAt === anchor!.createdAt && (reportKey(row) > reportKey(anchor!) || reportKey(row) === reportKey(anchor!) && row.requestId >= anchor!.requestId)))) throw Error();
      if (!alive(epoch) || id !== s.reportReadId || controller.signal.aborted || !s.authenticated || !view.current.me?.maintainer) return;
      const confirmed = await identity();
      if (!alive(epoch) || id !== s.reportReadId || controller.signal.aborted || !s.authenticated) return;
      if (!confirmed?.maintainer || !same(actor(confirmed), actor(context))) throw Error('Current private queue authority unavailable.');
      view.current.reports = page.reports; setReports(page.reports); setReportNext(page.nextCursor);
    } catch { if (alive(epoch) && id === s.reportReadId && !controller.signal.aborted) { view.current.reports = null; setReports(null); setReportNext(null); setReportsError('The private queue is unavailable. No private report page was accepted.'); } }
    finally { s.controllers.delete(controller); if (alive(epoch) && id === s.reportReadId) { s.privateReading = false; setReportsLoading(false); } }
  }
  useEffect(() => {
    const s = life.current; s.alive = true; s.epoch++; setMountedEpoch(s.epoch); view.current.me = null; setMe(null); clearReports(); clearForm(); setUncertain(false); setIdentityLocked(false); setBusy(false); void load(); if (s.authenticated) void identity();
    return () => { s.alive = false; s.epoch++; abortReads(); if (s.pending) { s.pending.body = ''; } s.pending = null; s.locked = false; s.known.clear(); s.knownTask = null; s.hiddenTasks.clear(); view.current.fields = blank(); view.current.me = null; view.current.reports = null; };
  }, []);
  useEffect(() => {
    const wasAuthenticated = previousAuthentication.current; previousAuthentication.current = authenticated;
    if (!authenticated) { if (wasAuthenticated || view.current.me || view.current.form) accountLost(); }
    else if (life.current.alive) void identity();
  }, [authenticated]);
  useEffect(() => {
    if (same(previousTarget.current, target)) return;
    previousTarget.current = target; const s = life.current; s.epoch++; setMountedEpoch(s.epoch); abortReads(); s.reading = false; s.locked = false; clearForm(); clearReports(); setLoading(false); setBusy(false); view.current.task = null; setTask(null); view.current.items = []; setItems([]); view.current.claims = []; setClaims([]); setNext(null); setClaimNext(null); s.known.clear(); s.knownTask = null; s.hiddenTasks.clear(); s.refreshRequired = true;
    if (s.pending) { setUncertain(true); setError('Return to the original exact task and participant to reconcile the held request. No substitute task can receive it.'); }
    else void load();
  }, [taskId, taskDigest]);

  const formReasons = form?.action === 'withdraw' ? taskDiscussionWithdrawReasons : form?.action === 'hide' ? taskDiscussionHideReasons : taskDiscussionReportCategories;
  const signIn = '/signin-with-chatgpt?return_to=' + encodeURIComponent('/contribute/discussion' + (target ? '?task=' + target.id + '&digest=' + target.digest : ''));
  return <section className="og-task-discussion" aria-label="Shared task discussion">
    <p className="og-td-context">Prepared source; hosted acceptance pending. Public specifications and peer comments remain author-reported. Discussion grants no claim, private source access, task acceptance, execution or reputation. <a href="/task-discussion-policy">Discussion policy</a></p>
    {!target && <p className="og-td-notice og-td-error" role="alert">Choose an exact task from the <a href="/contribute">contribution desk</a>. This link needs one lowercase task ID and digest, without extra parameters.</p>}
    {!authenticated && <p className="og-td-context"><a href={signIn} target="_top">Sign in with ChatGPT</a> to participate. Public discussion is readable without an account.</p>}
    {error && <p className="og-td-notice og-td-error" role="alert">{error}</p>}{notice && <p className="og-td-notice" role="status">{notice}</p>}
    {uncertain && <div className="og-td-recovery"><p>{routeLocked ? 'Return to the original task reference to reconcile.' : identityLocked ? 'Return to the original participant to reconcile. Another account cannot replace the held operation.' : 'Retry the original request unchanged. Leaving this tab loses its held operation; do not assume it succeeded.'}</p><div className="og-td-actions"><button className="og-td-button" disabled={busy || identityLocked || routeLocked || !authenticated} onClick={retry}>{busy ? 'Reconciling…' : 'Retry identical request'}</button>{authenticated && <button className="og-td-button" disabled={busy} onClick={() => { if (active()) void identity(); }}>Check original identity</button>}</div></div>}
    {target && <><div className="og-td-task"><div className="og-td-header"><span className="og-td-pill">{hidden ? 'HIDDEN' : task?.state ?? 'NOT CHECKED'}</span><button className="og-td-button" disabled={readBlocked || !!form} onClick={() => { if (active()) void load(); }}>Refresh exact discussion</button></div>{loading && <p role="status">Checking exact current records…</p>}<h2>{hidden ? 'Task content suppressed' : task?.record?.content.title ?? 'Exact task not available'}</h2>{!hidden && task?.record ? <><p>{task.record.content.summary}</p><h3>Acceptance criteria</h3><ul>{task.record.content.acceptance.map(value => <li key={value}>{value}</li>)}</ul><h3>Reject the work when</h3><ul>{task.record.content.rejection.map(value => <li key={value}>{value}</li>)}</ul></> : task && <p>Authored task and dependent message content are suppressed. Immutable references and current metadata remain.</p>}<p className="og-td-reference">Task {target.id}<br/>Digest {target.digest}{task && <><br/>Sequence {task.sequence} · {stamp(task.createdAt)} Amsterdam</>}</p>{task?.state === 'CLOSED' && <p>This task is closed. Retained comments remain readable; new publications are blocked.</p>}<div className="og-td-actions">{canPublish && taskDiscussionKinds.map(kind => <button key={kind} className={'og-td-button ' + (kind === 'QUESTION' ? 'og-td-primary' : '')} disabled={blocked || !!form} onClick={() => begin('publish', null, kind)}>{kindLabel[kind]}</button>)}{authenticated && !me && !uncertain && <button className="og-td-button" disabled={busy} onClick={() => { if (active()) void identity(); }}>Check participant identity</button>}</div></div>
    <div className="og-td-thread"><div className="og-td-toolbar"><h3>Peer discussion</h3><span className="og-td-reference">Separate from maintainer claim dispositions</span></div>{!items.length && !loading && <p className="og-td-empty">No messages returned on this page. No work claim is required to ask a question.</p>}<ol className="og-td-list">{items.map(item => {
      const content = hidden || item.state !== 'VISIBLE' ? null : item.record, own = me && item.author.kind === 'HUMAN' && item.author.id === me.authorId;
      return <li className="og-td-message" key={item.id} aria-label={`Message ${item.id}`}><div className="og-td-meta"><span className="og-td-pill">{content ? kindLabel[content.kind] : item.state === 'VISIBLE' ? 'TASK HIDDEN' : item.state}</span><span>{item.author.kind.toLowerCase()} {short(item.author.id)}</span><span>Sponsor {short(item.author.sponsorId)}</span><span>{stamp(item.createdAt)} Amsterdam</span></div>{content ? <><p className="og-td-body">{content.body}</p>{content.replyTo && <p className="og-td-reference">Reply to {short(content.replyTo.id)} · {short(content.replyTo.digest)} <button className="og-td-button" disabled={readBlocked || !!form} onClick={() => void inspectMessage(content.replyTo!)}>Inspect referenced message</button></p>}{content.claim && <p className="og-td-reference">Optional claim {content.claim.id}<br/>Digest {content.claim.digest}. Association grants no ownership or disposition.</p>}</> : <p className="og-td-body">Authored message content is suppressed; its immutable history remains.</p>}<p className="og-td-reference">Message {item.id}<br/>Digest {item.digest} · sequence {item.sequence}{item.reason && <><br/>Reason: {reasonLabel(item.reason)}</>}</p><div className="og-td-actions">{canPublish && content && <button className="og-td-button" disabled={blocked || !!form} onClick={() => begin('publish', item)}>Reply to message</button>}{principalReady && own && item.state !== 'WITHDRAWN' && <button className="og-td-button" disabled={blocked || !!form} onClick={() => begin('withdraw', item)}>Withdraw my message</button>}{principalReady && content && <button className="og-td-button" disabled={blocked || !!form} onClick={() => begin('report', item)}>Report privately</button>}{principalReady && me?.maintainer && !hidden && item.state === 'VISIBLE' && <button className="og-td-button" disabled={blocked || !!form} onClick={() => begin('hide', item)}>Hide message</button>}</div></li>;
    })}</ol><div className="og-td-pagination"><button className="og-td-button" disabled={readBlocked || !!form} onClick={() => { if (active()) void load(); }}>Newest messages</button><button className="og-td-button" disabled={readBlocked || !!form || !next} onClick={() => { if (active()) void load(next); }}>Older messages</button></div></div>
    {canPublish && !form && <div className="og-td-actions"><button className="og-td-button" disabled={blocked} onClick={() => void loadClaims()}>Load optional claim references</button><button className="og-td-button" disabled={blocked || !claimNext} onClick={() => void loadClaims(claimNext)}>Older claim references</button><span className="og-td-reference">{claims.length} current-page references · association is optional</span></div>}</>}
    {form && <form className="og-td-form" aria-label={`${form.action} task discussion`} onSubmit={event => {event.preventDefault(); submit();}}><h3>{form.action === 'publish' ? form.target ? 'Reply on this exact task' : kindLabel[fields.kind] : form.action === 'withdraw' ? 'Withdraw your authored message' : form.action === 'hide' ? 'Human maintainer moderation' : 'Private report'}</h3>{form.action === 'publish' ? <><label>Message type<select aria-label="Discussion kind" disabled={blocked} value={fields.kind} onChange={event => change({kind: event.target.value as Fields['kind']})}>{taskDiscussionKinds.map(kind => <option key={kind} value={kind}>{kindLabel[kind]}</option>)}</select></label><label>Public message<textarea aria-label="Public discussion body" rows={5} maxLength={taskDiscussionLimits.bodyCharacters} required disabled={blocked} value={fields.body} onChange={event => change({body: event.target.value})}/></label><label>Optional claim association<select aria-label="Optional discussion claim" disabled={blocked} value={fields.claim} onChange={event => change({claim: event.target.value})}><option value="">No claim association</option>{claims.filter(claim => claim.record && claim.taskState !== 'HIDDEN').map(claim => <option key={claim.id} value={claim.id}>{short(claim.id)} · {claim.status} · {short(claim.author.id)}</option>)}</select></label><p>Use public prose, snippets, links and test or documentation specifications. Keep secrets, private source, private repository/PR identities, handoffs and personal records out. Submitted text is inert; there is no upload or code execution.</p>{form.target && <p className="og-td-reference">Exact reply {form.target.id}<br/>Digest {form.target.digest}</p>}</> : <><label>{form.action === 'report' ? 'Private category' : 'Fixed public reason'}<select aria-label="Discussion reason" disabled={blocked} value={fields.reason} onChange={event => change({reason: event.target.value})}>{formReasons.map(reason => <option key={reason} value={reason}>{reasonLabel(reason)}</option>)}</select></label>{form.action === 'report' ? <><label>Private report details<textarea aria-label="Private report details" rows={4} maxLength={taskDiscussionLimits.detailsCharacters} required disabled={blocked} value={fields.details} onChange={event => change({details: event.target.value})}/></label><p>Only explicitly authorized human contribution maintainers can read this separate queue. Do not include credentials, private code or personal records, including when reporting exposure.</p></> : <p>{form.action === 'withdraw' ? 'Withdrawal suppresses your message and retains its attributable history. It can also terminate your authored record after task closure or moderation.' : 'Hiding suppresses this message permanently through your separately assigned human maintainer authority. It awards no review status, merge approval or trust.'}</p>}<p className="og-td-reference">Exact message {form.target?.id}<br/>Digest {form.target?.digest} · sequence {form.target?.sequence}</p></>}
      <label className="og-td-check"><input aria-label="Accept task discussion policy" type="checkbox" disabled={blocked} checked={fields.consent} onChange={event => change({consent: event.target.checked})}/><span>I reviewed this intended action and accept the <a href="/task-discussion-policy" target="_blank" rel="noopener noreferrer">discussion policy</a>. Public participation grants no private source or execution authority.</span></label><div className="og-td-actions"><button className="og-td-button" type="button" disabled={blocked} onClick={cancel}>Cancel message action</button><button className="og-td-button og-td-primary" type="submit" disabled={blocked || !fields.consent}>{busy ? 'Sending…' : form.action === 'publish' ? 'Confirm public message' : form.action === 'report' ? 'Confirm private report' : form.action === 'withdraw' ? 'Confirm withdrawal' : 'Confirm hide'}</button></div></form>}
    {principalReady && me?.maintainer && <div className="og-td-reports"><h3>Private contribution reports</h3><p className="og-td-context">Separate human maintainer authority. Reports are allegations; inspecting a report awards no research confidence or contribution disposition.</p><div className="og-td-actions"><button className="og-td-button" disabled={blocked || !!form || reportsLoading} onClick={() => void loadReports()}>Read private report queue</button><button className="og-td-button" disabled={blocked || !!form || reportsLoading || !reportNext} onClick={() => void loadReports(reportNext)}>Older private reports</button>{reports !== null && <button className="og-td-button" disabled={reportsLoading} onClick={() => { if (active()) clearReports(); }}>Close private queue</button>}</div>{reportsLoading && <p role="status">Checking private report authority…</p>}{reportsError && <p className="og-td-notice og-td-error" role="alert">{reportsError}</p>}{reports?.length === 0 && <p className="og-td-empty">No reports returned on this page.</p>}{reports?.map(report => <article className="og-td-report" key={report.reporter.kind + ':' + report.reporter.id + ':' + report.requestId}><h3>{reasonLabel(report.category)}</h3><p>{report.details}</p><p className="og-td-reference">Reporter {report.reporter.kind.toLowerCase()} {short(report.reporter.id)} · {stamp(report.createdAt)} Amsterdam<br/>Message {report.message.id} · {short(report.message.digest)}<br/>Task {report.task.id} · {short(report.task.digest)}</p><a className="og-td-button" href={'/contribute/discussion?task=' + report.task.id + '&digest=' + report.task.digest}>Open exact reported task</a></article>)}</div>}
    <p className="og-td-footer">Public reads and exact retries preserve suppression. This tab stores held operations in memory only. No hosted availability, independent verification, reputation or GitHub connection is established here.</p>
  </section>;
}
