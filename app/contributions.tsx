'use client';

import {useEffect, useRef, useState} from 'react';
import {parseUniqueJson} from './unique-json';
import {boundedContributionCommand, contributionLimits, contributionPolicy, contributionCloseReasons, contributionHideReasons, contributionReviewReasons, contributionListSchema, contributionGetSchema, contributionClaimsSchema, contributionClaimGetSchema, contributionMeSchema, validateContributionTaskItem, validateContributionClaimItem, validateContributionWrite} from './contribution-model';
import './contributions.css';

type Task = ReturnType<typeof contributionGetSchema.parse>['item'];
type Claim = ReturnType<typeof contributionClaimGetSchema.parse>['item'];
type Me = ReturnType<typeof contributionMeSchema.parse>;
type Command = ReturnType<typeof boundedContributionCommand>['command'];
type Action = Command['action'];
type Fields = {title: string; summary: string; kind: 'CODE' | 'DOCS' | 'TESTS'; acceptance: string; rejection: string; handoff: string; reason: string; decision: 'ACCEPTED' | 'CHANGES_REQUESTED' | 'REJECTED'; consent: boolean};
type Form = {action: Action; task: Task | null; claim: Claim | null};
type Pending = {command: Command; body: string; author: Me; submitted: boolean};
const blank = (): Fields => ({title: '', summary: '', kind: 'CODE', acceptance: '', rejection: '', handoff: '', reason: '', decision: 'CHANGES_REQUESTED', consent: false});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ref = (item: {id: string; digest: string}) => ({id: item.id, digest: item.digest});
const actor = (me: Me) => ({kind: 'HUMAN' as const, id: me.authorId, sponsorId: me.sponsorId});
const short = (value: string) => value.length > 20 ? value.slice(0, 10) + '…' + value.slice(-6) : value;
const time = (value: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(value));
const reasons = (action: Action, decision: Fields['decision'] = 'CHANGES_REQUESTED', claim: Claim | null = null): readonly string[] => action === 'close' ? contributionCloseReasons : action === 'hide' ? contributionHideReasons : action === 'review' ? contributionReviewReasons.filter(reason => decision === 'ACCEPTED' ? reason === 'ACCEPTANCE_MET' : reason !== 'ACCEPTANCE_MET' && (decision !== 'REJECTED' || reason !== 'NEEDS_CHANGES')) : [claim?.author.kind === 'AGENT' ? 'SPONSOR_RELEASE' : 'AUTHOR_RELEASE'];
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const terminal = (claim: Claim) => ['RELEASED', 'EXPIRED', 'ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(claim.status);
const curated = (action: Action) => ['register', 'close', 'hide', 'review'].includes(action);

async function read(response: Response, cap: number = contributionLimits.responseBytes): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw Error('Missing response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > cap) { await reader.cancel(); throw Error('Response bound exceeded.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let position = 0; for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), cap, 16);
}

/** Public coordination only. Private handoff bytes and credentials never enter this component. */
export default function Contributions({authenticated}: {authenticated: boolean}) {
  const [tasks, setTasks] = useState<Task[]>([]), [selected, setSelected] = useState<Task | null>(null), [claims, setClaims] = useState<Claim[]>([]);
  const [next, setNext] = useState<string | null>(null), [claimNext, setClaimNext] = useState<string | null>(null), [loading, setLoading] = useState(false), [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Form | null>(null), [fields, setFields] = useState(blank), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [identityLocked, setIdentityLocked] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const life = useRef({alive: true, authenticated, epoch: 0, readId: 0, identityId: 0, formId: 0, locked: false, refreshRequired: false, pending: null as Pending | null, reads: new Set<AbortController>(), hidden: new Set<string>(), knownTasks: new Map<string, Task>(), knownClaims: new Map<string, Claim>()});
  const previousAuthentication = useRef(authenticated);
  const view = useRef({tasks, selected, claims, me, form, fields}); view.current = {tasks, selected, claims, me, form, fields}; life.current.authenticated = authenticated;
  const renderForm = life.current.formId, renderPending = life.current.pending;
  const blocked = loading || busy || uncertain || identityLocked || !!life.current.pending;
  const principalReady = authenticated && !!me && !identityLocked && !life.current.refreshRequired;
  function alive(epoch = life.current.epoch) { return life.current.alive && life.current.epoch === epoch; }
  function abortReads() { life.current.reads.forEach(controller => controller.abort()); life.current.reads.clear(); }
  function clearPrivate() {
    const state = life.current; state.epoch++; state.identityId++; state.formId++; abortReads(); state.locked = false;
    view.current.me = null; setMe(null); view.current.form = null; setForm(null); view.current.fields = blank(); setFields(blank()); setBusy(false); setLoading(false);
    if (state.pending?.submitted) { setUncertain(true); setIdentityLocked(true); setError('The original participant is required to reconcile the held request. Its exact body and request ID remain in this tab.'); }
    else { state.pending = null; setUncertain(false); setIdentityLocked(false); setError('Sign in to participate. Public tasks remain available.'); }
  }
  function scrub(taskId: string) {
    const state = life.current; state.hidden.add(taskId);
    const redactTask = (item: Task): Task => item.id === taskId ? {...item, record: null} : item;
    const redactClaim = (item: Claim): Claim => item.task.id === taskId ? {...item, taskState: 'HIDDEN', record: null, handoffDigest: null, reason: null, events: []} : item;
    state.knownTasks.forEach((item, id) => state.knownTasks.set(id, redactTask(item)));
    state.knownClaims.forEach((item, id) => state.knownClaims.set(id, redactClaim(item)));
    view.current.tasks = view.current.tasks.map(redactTask); setTasks(view.current.tasks);
    view.current.claims = view.current.claims.map(redactClaim); setClaims(view.current.claims);
    if (view.current.selected?.id === taskId) { view.current.selected = redactTask(view.current.selected); setSelected(view.current.selected); }
    if (view.current.form?.task?.id === taskId) { view.current.form = null; setForm(null); view.current.fields = blank(); setFields(blank()); state.formId++; }
    setNotice('');
  }
  // Validate all rows before committing any visibility floor or authored payload.
  function install(taskRows: Task[], claimRows: Claim[]) {
    const state = life.current, taskMap = new Map(state.knownTasks), claimMap = new Map(state.knownClaims), hidden = new Set(state.hidden);
    for (const item of taskRows) {
      const old = taskMap.get(item.id);
      if (old && !same({id: old.id, digest: old.digest, requestId: old.requestId, author: old.author, createdAt: old.createdAt}, {id: item.id, digest: item.digest, requestId: item.requestId, author: item.author, createdAt: item.createdAt})) throw Error('Task identity changed.');
      if (item.state === 'HIDDEN') hidden.add(item.id);
      if (old && item.sequence < old.sequence) continue;
      if (old && !same(item.events.slice(0, old.events.length), old.events)) throw Error('Task event history changed.');
      if (old?.state === 'HIDDEN' && item.state !== 'HIDDEN') continue;
      if (old && item.sequence === old.sequence && !hidden.has(item.id) && !same(old, item)) throw Error('Task snapshot changed at the same sequence.');
      taskMap.set(item.id, hidden.has(item.id) ? {...item, record: null} : item);
    }
    for (const item of claimRows) {
      const old = claimMap.get(item.id);
      if (old && !same({id: old.id, digest: old.digest, task: old.task, requestId: old.requestId, author: old.author, createdAt: old.createdAt, expiresAt: old.expiresAt}, {id: item.id, digest: item.digest, task: item.task, requestId: item.requestId, author: item.author, createdAt: item.createdAt, expiresAt: item.expiresAt})) throw Error('Claim identity changed.');
      if (item.taskState === 'HIDDEN') hidden.add(item.task.id);
      if (old && (item.sequence < old.sequence || item.sequence === old.sequence && item.checkedAt < old.checkedAt)) continue;
      if (old && !hidden.has(item.task.id) && !same(item.events.slice(0, old.events.length), old.events)) throw Error('Claim event history changed.');
      if (old && item.sequence === old.sequence && old.status === 'EXPIRED' && ['ACTIVE', 'SUBMITTED'].includes(item.status)) continue;
      if (old && item.sequence === old.sequence && item.checkedAt === old.checkedAt && !hidden.has(item.task.id) && !same(old, item)) throw Error('Claim snapshot changed at the same clock.');
      claimMap.set(item.id, hidden.has(item.task.id) ? {...item, taskState: 'HIDDEN', record: null, handoffDigest: null, reason: null, events: []} : item);
    }
    if (taskMap.size > contributionLimits.tasksStored || claimMap.size > contributionLimits.claimsStored) throw Error('Retained client record bound exceeded.');
    state.knownTasks = taskMap; state.knownClaims = claimMap;
    for (const id of hidden) scrub(id);
    return {tasks: taskRows.map(item => state.knownTasks.get(item.id)!), claims: claimRows.map(item => state.knownClaims.get(item.id)!)};
  }
  async function identity() {
    const state = life.current; if (!state.alive || !state.authenticated) return null;
    const epoch = state.epoch, id = ++state.identityId, controller = new AbortController(); state.reads.add(controller);
    try {
      const response = await fetch('/api/contributions/me', {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!alive(epoch) || id !== state.identityId || !state.authenticated || controller.signal.aborted) return null;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return null; } if (!response.ok) throw Error();
      const current = contributionMeSchema.parse(await read(response, 4096)); if (!alive(epoch) || id !== state.identityId) return null;
      const intended = state.pending?.author ?? view.current.me;
      if (intended && !same(actor(intended), actor(current))) { clearPrivate(); return null; }
      if (state.pending && curated(state.pending.command.action) && !current.maintainer) { clearPrivate(); return null; }
      view.current.me = current; setMe(current); setIdentityLocked(false); return current;
    } catch { if (alive(epoch) && id === state.identityId) setError('Participant identity is unavailable. Public reading remains available.'); return null; }
    finally { state.reads.delete(controller); }
  }
  async function load(cursor: string | null = null) {
    const state = life.current; if (!state.alive || state.pending || state.locked || view.current.form) return;
    const anchor = cursor ? view.current.tasks.find(item => item.id === cursor) : null; if (cursor && !anchor) return;
    const epoch = state.epoch, id = ++state.readId, controller = new AbortController(); state.reads.add(controller); setLoading(true); setError('');
    try {
      const response = await fetch('/api/contributions' + (cursor ? '?cursor=' + cursor : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])}); if (!response.ok) throw Error();
      const page = contributionListSchema.parse(await read(response)), rows = await Promise.all(page.items.map(validateContributionTaskItem));
      if (cursor && (page.nextCursor === cursor || rows.some(item => item.id === cursor || item.createdAt > anchor!.createdAt || item.createdAt === anchor!.createdAt && item.id >= anchor!.id))) throw Error();
      if (!alive(epoch) || id !== state.readId || controller.signal.aborted || state.pending || view.current.form) return;
      const projected = install(rows, []); view.current.tasks = projected.tasks; setTasks(projected.tasks); setNext(page.nextCursor);
      if (view.current.selected) { const fresh = state.knownTasks.get(view.current.selected.id); if (fresh) { view.current.selected = fresh; setSelected(fresh); } }
    } catch { if (alive(epoch) && id === state.readId && !controller.signal.aborted) setError('Tasks are unavailable or inconsistent. No page was accepted.'); }
    finally { state.reads.delete(controller); if (alive(epoch) && id === state.readId) setLoading(false); }
  }
  async function openTask(item: Task, cursor: string | null = null) {
    const state = life.current; if (!state.alive || state.pending || state.locked || view.current.form) return;
    const anchor = cursor ? view.current.claims.find(claim => claim.id === cursor) : null; if (cursor && !anchor) return;
    const epoch = state.epoch, id = ++state.readId, controller = new AbortController(); state.reads.add(controller); setLoading(true); setError('');
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
      const response = await fetch('/api/contributions?task=' + item.id + '&digest=' + item.digest + (cursor ? '&cursor=' + cursor : ''), {cache: 'no-store', signal}); if (!response.ok) throw Error();
      const page = contributionClaimsSchema.parse(await read(response)), task = await validateContributionTaskItem(page.task), rows = await Promise.all(page.items.map(validateContributionClaimItem));
      if (!same(ref(task), ref(item)) || rows.some(claim => !same(claim.task, ref(item))) || cursor && (page.nextCursor === cursor || rows.some(claim => claim.id === cursor || claim.createdAt > anchor!.createdAt || claim.createdAt === anchor!.createdAt && claim.id >= anchor!.id))) throw Error();
      if (!alive(epoch) || id !== state.readId || controller.signal.aborted || state.pending || view.current.form) return;
      const projected = install([task], rows); state.refreshRequired = false; view.current.selected = projected.tasks[0]; setSelected(view.current.selected); view.current.claims = projected.claims; setClaims(projected.claims); setClaimNext(page.nextCursor);
      view.current.tasks = view.current.tasks.map(row => row.id === task.id ? projected.tasks[0] : row); setTasks(view.current.tasks);
    } catch { if (alive(epoch) && id === state.readId && !controller.signal.aborted) setError('Exact task and claim history are unavailable. No other task was substituted.'); }
    finally { state.reads.delete(controller); if (alive(epoch) && id === state.readId) setLoading(false); }
  }
  function begin(action: Action, task: Task | null = view.current.selected, claim: Claim | null = null) {
    const state = life.current, current = view.current.me; if (!state.alive || state.locked || state.pending || state.refreshRequired || !state.authenticated || !current || identityLocked || loading || curated(action) && !current.maintainer) return;
    if (task && (!same(state.knownTasks.get(task.id), task) || state.hidden.has(task.id) && action !== 'release')) return;
    if (claim && !same(state.knownClaims.get(claim.id), claim)) return;
    state.formId++; const value = {action, task, claim}, nextFields = {...blank(), reason: reasons(action, 'CHANGES_REQUESTED', claim)[0]};
    if (action === 'release' && claim?.author.kind === 'AGENT') nextFields.reason = 'SPONSOR_RELEASE';
    view.current.form = value; setForm(value); view.current.fields = nextFields; setFields(nextFields); setError(''); setNotice('');
  }
  function change(changes: Partial<Fields>) { if (life.current.formId !== renderForm || life.current.pending || life.current.locked || !view.current.form) return; const nextFields = {...view.current.fields, ...changes}; view.current.fields = nextFields; setFields(nextFields); }
  function close() { if (life.current.formId !== renderForm || life.current.pending || life.current.locked) return; life.current.formId++; view.current.form = null; setForm(null); view.current.fields = blank(); setFields(blank()); setError(''); }
  function submit() {
    const state = life.current, current = view.current.me, form = view.current.form, f = view.current.fields;
    if (!state.alive || state.formId !== renderForm || state.pending || state.locked || !state.authenticated || !current || identityLocked || !form || !f.consent || curated(form.action) && !current.maintainer) return;
    let raw: unknown; const ids = {requestId: crypto.randomUUID(), policyAccepted: contributionPolicy}, task = form.task;
    if (form.action === 'register') raw = {action: 'register', ...ids, id: crypto.randomUUID(), title: f.title, summary: f.summary, kind: f.kind, acceptance: f.acceptance.split('\n').map(value => value.trim()).filter(Boolean), rejection: f.rejection.split('\n').map(value => value.trim()).filter(Boolean)};
    else if (!task) return;
    else if (form.action === 'claim') raw = {action: 'claim', ...ids, id: crypto.randomUUID(), task: ref(task), expectedTaskSequence: task.sequence};
    else if (form.action === 'close' || form.action === 'hide') raw = {action: form.action, ...ids, task: ref(task), expectedSequence: task.sequence, reason: f.reason};
    else if (form.claim) raw = {action: form.action, ...ids, task: ref(task), claim: ref(form.claim), expectedSequence: form.claim.sequence, ...(form.action === 'submit' ? {handoffDigest: f.handoff} : form.action === 'review' ? {decision: f.decision, reason: f.reason} : {reason: f.reason})};
    else return;
    try { const {command, payload} = boundedContributionCommand(raw); const pending = {command, body: payload, author: structuredClone(current), submitted: false}; state.pending = pending; void write(pending); }
    catch { setError('Check the required fields, exact digest and policy consent. No request was sent.'); }
  }
  async function write(pending: Pending) {
    const state = life.current; if (!state.alive || state.locked || state.pending !== pending || !state.authenticated) return;
    // Verify the original account before every attempt; the mandatory header also binds it at the server.
    const preflightEpoch = state.epoch, current = await identity(); if (!current || state.pending !== pending || !same(actor(current), actor(pending.author))) { if (alive(preflightEpoch) && state.pending === pending) { setUncertain(true); setError(pending.submitted ? 'Outcome unknown. Confirm the original participant and retry the held request unchanged.' : 'The request was not sent because participant identity is unavailable. Retry the held request unchanged after identity is available.'); } return; }
    const epoch = state.epoch; state.locked = true; pending.submitted = true; setBusy(true); setUncertain(false); setError('');
    const controller = new AbortController(); state.reads.add(controller);
    try {
      const response = await fetch('/api/contributions', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Contribution-Intent': 'submit', 'X-Contribution-Author': pending.author.authorId}, body: pending.body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)])});
      if (!alive(epoch) || state.pending !== pending || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if (!response.ok) {
        if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) { state.pending = null; setUncertain(false); state.formId++; view.current.form = null; setForm(null); view.current.fields = blank(); setFields(blank()); state.refreshRequired = response.status === 409 || response.status === 404; setError(response.status === 409 ? 'Request rejected: the task, claim or operation changed. Refresh the exact current state before another action.' : response.status === 429 ? 'Contribution capacity reached. Retained capacity has no automatic reset; daily retry timing comes only from the server.' : 'The request was rejected. Review the fields and current state before another intended action.'); return; }
        throw Error();
      }
      const receipt = await validateContributionWrite(await read(response), pending.command, actor(pending.author));
      if (!alive(epoch) || state.pending !== pending) return;
      const projected = install([receipt.task], receipt.claim ? [receipt.claim] : []);
      const task = projected.tasks[0], changedTask = view.current.selected?.id !== task.id; view.current.selected = task; setSelected(task); setClaimNext(null);
      view.current.tasks = view.current.tasks.some(item => item.id === task.id) ? view.current.tasks.map(item => item.id === task.id ? task : item) : [task, ...view.current.tasks].slice(0, 20); setTasks(view.current.tasks);
      if (receipt.claim) { const claim = projected.claims[0]; view.current.claims = [claim, ...view.current.claims.filter(item => item.task.id === task.id && item.id !== claim.id)].slice(0, contributionLimits.page); setClaims(view.current.claims); }
      else if (changedTask) { view.current.claims = []; setClaims([]); }
      state.pending = null; state.formId++; view.current.form = null; setForm(null); view.current.fields = blank(); setFields(blank()); setUncertain(false);
      setNotice(state.hidden.has(task.id) ? 'Original request confirmed. Current task content is hidden; no authored payload was restored.' : pending.command.action === 'review' ? 'Maintainer disposition recorded. It establishes no merge, source access, safety or research qualification.' : pending.command.action === 'claim' ? 'Claim recorded with its original 72-hour deadline. It grants no GitHub write or production access.' : 'Original contribution request confirmed. Its current state is shown below.');
    } catch { if (alive(epoch) && state.pending === pending) { setUncertain(true); setError('Outcome unknown. The original body, request ID and participant are held in this tab. Retry unchanged before taking another action.'); } }
    finally { state.reads.delete(controller); if (alive(epoch)) { state.locked = false; setBusy(false); } }
  }
  function retry() { const pending = life.current.pending; if (pending && pending === renderPending && !life.current.locked && authenticated && !identityLocked) void write(pending); }
  useEffect(() => {
    const state = life.current; state.alive = true; void load();
    return () => { state.alive = false; state.epoch++; abortReads(); state.pending = null; state.knownTasks.clear(); state.knownClaims.clear(); view.current.fields = blank(); view.current.me = null; };
  }, []);
  useEffect(() => { const wasAuthenticated = previousAuthentication.current; previousAuthentication.current = authenticated; if (!authenticated) { if (wasAuthenticated || view.current.me || life.current.pending || view.current.form) clearPrivate(); } else void identity(); }, [authenticated]);

  const hidden = !!selected && life.current.hidden.has(selected.id), content = hidden ? null : selected?.record?.content;
  const canClaim = principalReady && selected?.state === 'OPEN' && !hidden && ![...life.current.knownClaims.values()].some(claim => claim.task.id === selected.id && ['ACTIVE', 'SUBMITTED'].includes(claim.status));
  return <section className="og-contribution-desk" aria-label="Contribution desk">
    <div className="og-cd-heading"><div><span className="og-cd-kicker">PUBLIC TASKS · PRIVATE CODE HANDOFF</span><h2>Find useful work.</h2><p>Choose a bounded task, coordinate a claim and retain the review.</p></div>{principalReady && me?.maintainer && <button className="og-cd-button og-cd-primary" disabled={blocked} onClick={() => begin('register', null)}>Register task</button>}</div>
    <p className="og-cd-context">Prepared source; hosted acceptance pending. A claim grants no private source access, budget or execution permission. <a href="/contribution-policy">Contribution policy</a></p>
    {!authenticated && <p className="og-cd-context"><a href="/signin-with-chatgpt?return_to=/contribute" target="_top">Sign in with ChatGPT</a> to claim or submit. External agents use the existing sponsored public-submission role; no new source grant.</p>}
    {error && <p className="og-cd-message og-cd-error" role="alert">{error}</p>}{notice && <p className="og-cd-message" role="status">{notice}</p>}
    {uncertain && <div className="og-cd-recovery"><p>{identityLocked ? 'Return to the original signed-in participant to reconcile. Other accounts cannot replace this held operation.' : 'Retry the exact original request before any new action. Leaving this tab loses its held operation; do not assume a retry succeeded.'}</p><div className="og-cd-actions"><button className="og-cd-button" disabled={busy || identityLocked || !authenticated} onClick={retry}>{busy ? 'Reconciling…' : 'Retry identical request'}</button>{identityLocked && authenticated && <button className="og-cd-button" disabled={busy} onClick={() => void identity()}>Check original identity</button>}</div></div>}
    <div className="og-cd-grid"><div className="og-cd-catalog"><div className="og-cd-toolbar"><strong>Tasks</strong><button className="og-cd-button" disabled={blocked || !!form} onClick={() => void load()}>Refresh tasks</button></div>{loading && <p className="og-cd-empty" role="status">Checking current records…</p>}{!tasks.length && !loading && <p className="og-cd-empty">No tasks returned. Registration is reserved for explicitly assigned human maintainers.</p>}<ul className="og-cd-task-list">{tasks.map(task => <li key={task.id}><button className="og-cd-task-button" disabled={blocked || !!form} aria-current={selected?.id === task.id} aria-label={`Inspect task ${task.id}`} onClick={() => void openTask(task)}><span className="og-cd-task-meta"><span className={'og-cd-pill ' + (task.state === 'OPEN' ? 'og-cd-active' : '')}>{life.current.hidden.has(task.id) ? 'HIDDEN' : task.state}</span><span className="og-cd-reference">{short(task.id)}</span></span><strong>{!life.current.hidden.has(task.id) && task.record ? task.record.content.title : 'Task content unavailable'}</strong><span>{task.record?.content.kind ?? 'Retained metadata'} · {time(task.createdAt)}</span></button></li>)}</ul><div className="og-cd-pagination"><button className="og-cd-button" disabled={blocked || !!form} onClick={() => void load()}>Newest tasks</button><button className="og-cd-button" disabled={blocked || !!form || !next} onClick={() => void load(next)}>Older tasks</button></div></div>
      <div className="og-cd-detail">{!selected ? <p className="og-cd-empty">Inspect a task to see its criteria, current lease and retained claim history.</p> : <><div className="og-cd-detail-header"><span className="og-cd-pill">{hidden ? 'HIDDEN' : selected.state}</span><button className="og-cd-button" disabled={blocked || !!form} onClick={() => void openTask(selected)}>Refresh exact task</button></div><h3>{content?.title ?? 'Task content unavailable'}</h3>{content ? <><p>{content.summary}</p><h4>Acceptance criteria</h4><ul>{content.acceptance.map(value => <li key={value}>{value}</li>)}</ul><h4>Reject the work when</h4><ul>{content.rejection.map(value => <li key={value}>{value}</li>)}</ul></> : <p>Authored task and dependent claim payloads are suppressed. Immutable references and current metadata remain.</p>}<p className="og-cd-reference">Task {selected.id}<br/>Digest {selected.digest}<br/>Sequence {selected.sequence} · {selected.author.kind.toLowerCase()} {short(selected.author.id)}</p><div className="og-cd-actions">{content && !blocked && !form && <a className="og-cd-button" href={'/contribute/discussion?task=' + selected.id + '&digest=' + selected.digest}>Discuss task</a>}{canClaim && <button className="og-cd-button og-cd-primary" disabled={blocked || !!form} onClick={() => begin('claim')}>Claim task</button>}{principalReady && me?.maintainer && !hidden && <><button className="og-cd-button" disabled={blocked || !!form || selected.state !== 'OPEN'} onClick={() => begin('close')}>Close task</button><button className="og-cd-button" disabled={blocked || !!form} onClick={() => begin('hide')}>Hide task</button></>}</div><div className="og-cd-claims"><h4>Claim history</h4>{!claims.length && <p>No claims returned. This page is not a frozen network snapshot.</p>}{claims.map(claim => { const own = me && claim.author.kind === 'HUMAN' && claim.author.id === me.authorId, sponsored = me && claim.author.kind === 'AGENT' && claim.author.sponsorId === me.sponsorId; return <article className="og-cd-claim" key={claim.id} aria-label={`Claim ${claim.id}`}><span className="og-cd-pill">{claim.status}</span><p>{claim.author.kind.toLowerCase()} {short(claim.author.id)} · sponsor {short(claim.author.sponsorId)}</p><p>Original deadline {time(claim.expiresAt)} Amsterdam. Checked {time(claim.checkedAt)}.</p><p className="og-cd-reference">Claim {claim.id}<br/>Digest {claim.digest} · sequence {claim.sequence}</p>{!hidden && claim.handoffDigest && <p className="og-cd-reference">Private handoff SHA-256 {claim.handoffDigest}</p>}{!hidden && ['ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(claim.status) && <p>Recorded coordination disposition only; no merge, completed task, code safety or qualified result is established.</p>}<div className="og-cd-actions">{principalReady && own && claim.status === 'ACTIVE' && selected.state === 'OPEN' && !hidden && <button className="og-cd-button" disabled={blocked || !!form} onClick={() => begin('submit', selected, claim)}>Submit handoff digest</button>}{principalReady && (own || sponsored) && !terminal(claim) && <button className="og-cd-button" disabled={blocked || !!form} onClick={() => begin('release', selected, claim)}>Release claim</button>}{principalReady && me?.maintainer && claim.status === 'SUBMITTED' && selected.state === 'OPEN' && !hidden && <button className="og-cd-button" disabled={blocked || !!form} onClick={() => begin('review', selected, claim)}>Record disposition</button>}</div></article>; })}<div className="og-cd-actions"><button className="og-cd-button" disabled={blocked || !!form} onClick={() => void openTask(selected)}>Newest claims</button><button className="og-cd-button" disabled={blocked || !!form || !claimNext} onClick={() => void openTask(selected, claimNext)}>Older claims</button></div></div></>}</div>
    </div>
    {form && <form className="og-cd-form" aria-label={`${form.action} contribution`} onSubmit={event => {event.preventDefault(); submit();}}><h3>{form.action === 'register' ? 'Register an immutable task' : form.action === 'submit' ? 'Submit a private handoff digest' : form.action === 'review' ? 'Record a maintainer disposition' : label(form.action) + ' task work'}</h3>{form.action === 'register' ? <><label>Title<input aria-label="Task title" maxLength={120} required disabled={blocked} value={fields.title} onChange={event => change({title: event.target.value})}/></label><label>Work type<select aria-label="Task kind" disabled={blocked} value={fields.kind} onChange={event => change({kind: event.target.value as Fields['kind']})}><option value="CODE">Code</option><option value="DOCS">Documentation</option><option value="TESTS">Tests</option></select></label><label>Public problem<textarea aria-label="Task summary" rows={3} maxLength={2000} required disabled={blocked} value={fields.summary} onChange={event => change({summary: event.target.value})}/></label><label>Acceptance criteria<textarea aria-label="Task acceptance" rows={3} maxLength={2408} required disabled={blocked} value={fields.acceptance} onChange={event => change({acceptance: event.target.value})}/></label><label>Rejection criteria<textarea aria-label="Task rejection" rows={3} maxLength={2408} required disabled={blocked} value={fields.rejection} onChange={event => change({rejection: event.target.value})}/></label><p>Enter one criterion per line, up to eight lines of 300 characters each. Publish public criteria only. Keep private repository identity, PR/source details and personal data out. Changes require a new task.</p></> : form.action === 'submit' ? <><label>Private handoff SHA-256<input aria-label="Private handoff digest" inputMode="text" maxLength={64} pattern="[a-f0-9]{64}" autoComplete="off" spellCheck={false} required disabled={blocked} value={fields.handoff} onChange={event => change({handoff: event.target.value})}/></label><p>Prepare the complete handoff using independently reviewed local tooling and share it through a separately approved private channel. Paste only its lowercase 64-character digest. No upload, source, repository URL, private evidence or credential belongs here.</p></> : form.action === 'claim' ? <p>This records one 72-hour lease under your actual participant identity. It grants no repository invitation, budget, hosted compute or execution permission.</p> : <>{form.action === 'review' && <label>Disposition<select aria-label="Maintainer decision" disabled={blocked} value={fields.decision} onChange={event => change({decision: event.target.value as Fields['decision'], reason: reasons('review', event.target.value as Fields['decision'])[0]})}><option value="CHANGES_REQUESTED">Changes requested</option><option value="REJECTED">Rejected</option><option value="ACCEPTED">Accepted for coordination</option></select></label>}<label>Public reason<select aria-label="Contribution reason" disabled={blocked} value={fields.reason} onChange={event => change({reason: event.target.value})}>{reasons(form.action, fields.decision, form.claim).map(reason => <option key={reason} value={reason}>{label(reason)}</option>)}</select></label><p>{form.action === 'hide' ? 'Hiding suppresses task and dependent authored payloads. It cannot be undone in this workflow.' : form.action === 'review' ? 'Inspect the separately shared private handoff first. This records a coordination decision, not a merged PR, completed task, safety judgment, reputation or research qualification.' : form.action === 'release' ? 'Release terminates this attempt without deleting its history. Its original deadline is not extended.' : 'Closure blocks new dependent work. Changing the task requires a new immutable registration.'}</p></>}
      <label className="og-cd-check"><input aria-label="Accept contribution policy" type="checkbox" disabled={blocked} checked={fields.consent} onChange={event => change({consent: event.target.checked})}/><span>I have reviewed this intended public action and accept the <a href="/contribution-policy" target="_blank" rel="noopener noreferrer">contribution policy</a>.</span></label><div className="og-cd-actions"><button className="og-cd-button" type="button" disabled={blocked} onClick={close}>Cancel action</button><button className="og-cd-button og-cd-primary" type="submit" disabled={blocked || !fields.consent}>{busy ? 'Sending…' : 'Confirm ' + label(form.action)}</button></div></form>}
    <p className="og-cd-footer">All attempts remain attributable. Accepted dispositions do not award reputation. Current reads and exact retries never revive hidden authored material.</p>
  </section>;
}
