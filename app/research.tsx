'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, Check, FlaskConical, GitFork, History, MessageSquare, Plus, RefreshCw, X} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {parseUniqueJson} from './unique-json';
import {boundedResearchRecord, researchCommandSchema, researchDigest, researchHistorySchema, researchListSchema, researchMeSchema, researchPublicationContent, researchPublicationVersion, researchThreadSchema, researchVentureListSchema, researchWriteSchema} from './research-model';
import {researchSelection, researchThreadHref, researchThreadLocation, researchThreadRequest, type ResearchSelection} from './research-thread';
import {blankVentureDossier, type VentureDossier} from './venture-model';
import {VentureCardDetails, VentureEditor, VentureSummary, remapVentureSources} from './venture-editor';
import './network.css';
import './research.css';

type Item = ReturnType<typeof researchListSchema.parse>['items'][number];
type Record = NonNullable<Item['record']>;
type Content = Record['content'];
type Me = ReturnType<typeof researchMeSchema.parse>;
type Command = ReturnType<typeof researchCommandSchema.parse>;
type Result = ReturnType<typeof researchWriteSchema.parse>;
type Form = {action: 'publish' | 'withdraw' | 'report'; target: Item | null; relation: Content['relation']};
type Fields = {domain: 'GENERAL' | 'VENTURE'; venture: VentureDossier | null; kind: Content['kind']; title: string; statement: string; assumptions: string; falsification: string; sources: Content['sources']; consent: boolean; reason: string; details: string};
type Pending = {command: Command; body: string; author: Me; target: Item | null};
type Thread = {target: Item; items: Item[]; nextCursor: string | null; pageCursor: string | null};
const policy = 'public-research-v1' as const;
const signIn = '/signin-with-chatgpt?return_to=/research';
const kindLabel = {HYPOTHESIS: 'Hypothesis', OBSERVATION: 'Observation', FAILURE: 'Failed experiment', CHALLENGE: 'Challenge'};
const sourceLabel = {PRIMARY: 'Primary source', SECONDARY: 'Secondary source', AUTHOR_CLAIM: 'Author claim', ESTIMATE: 'Estimate', SPECULATION: 'Speculation'};
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shortId = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const blank = (venture = false): Fields => ({domain: venture ? 'VENTURE' : 'GENERAL', venture: venture ? blankVentureDossier(new Date().toISOString().slice(0, 10)) : null, kind: 'HYPOTHESIS', title: '', statement: '', assumptions: '', falsification: '', sources: [], consent: false, reason: '', details: ''});

async function readResponse(response: Response, maximum = 1_048_576): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing research response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw Error('Research response too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), maximum, 10);
}

async function verify(items: Item[]) {
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => `${item.rootId}:${item.revision}`)).size !== items.length) throw Error('Duplicate research identity.');
  for (const item of items) {
    if (item.record) {
      const {payload} = boundedResearchRecord(item.record);
      if (await researchDigest(payload) !== item.digest) throw Error('Research digest mismatch.');
    }
  }
}
function matches(pending: Pending, result: Result) {
  const c = pending.command;
  if (result.action !== c.action || result.requestId !== c.requestId) return false;
  if (c.action === 'report') return result.item === null && !!result.report && result.report.requestId === c.requestId && result.report.id === c.id && result.report.digest === c.digest && result.report.reason === c.reason;
  if (c.action !== 'publish' && c.action !== 'withdraw') return false;
  const item = result.item;
  if (!item || result.report !== null || item.id !== c.id) return false;
  if (c.action === 'withdraw') {
    const event = item.moderation.at(-1), target = pending.target;
    return !!target && item.digest === c.digest && item.state === 'WITHDRAWN' && item.record === null && same(item.author, target.author) && item.rootId === target.rootId && item.revision === target.revision && item.createdAt === target.createdAt && item.requestId === target.requestId && same(item.moderation.slice(0, target.moderation.length), target.moderation) && !!event && event.requestId === c.requestId && event.state === 'WITHDRAWN' && event.reason === c.reason && event.actor.kind === 'HUMAN' && event.actor.id === pending.author.authorId && event.actor.sponsorId === pending.author.sponsorId;
  }
  if (item.requestId !== c.requestId || item.author.kind !== 'HUMAN' || item.author.id !== pending.author.authorId || item.author.sponsorId !== pending.author.sponsorId) return false;
  const revision = c.relation?.type === 'REVISION';
  if (item.rootId !== (revision ? pending.target?.rootId : c.id) || item.revision !== (revision ? (pending.target?.revision ?? 0) + 1 : 1)) return false;
  // Redacted retry receipts confirm immutable identity only. They must never restore authored content.
  if (!item.record) return item.state === 'HIDDEN' || item.state === 'WITHDRAWN';
  const content = researchPublicationContent(c);
  return item.record.version === researchPublicationVersion(c) && item.record.verification === 'UNVERIFIED' && same(item.record.content, content);
}

export default function Research({signedIn, ventureOnly = false}: {signedIn: boolean; ventureOnly?: boolean}) {
  const [items, setItems] = useState<Item[]>([]), [cursor, setCursor] = useState<string | null>(null), [pageCursor, setPageCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(false), [boardError, setBoardError] = useState('');
  const [me, setMe] = useState<Me | null>(null), [identityError, setIdentityError] = useState(''), [authLost, setAuthLost] = useState(false);
  const [form, setForm] = useState<Form | null>(null), [fields, setFields] = useState(() => blank(ventureOnly)), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [formError, setFormError] = useState(''), [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Item[] | null>(null), [historyRoot, setHistoryRoot] = useState<string | null>(null), [historyError, setHistoryError] = useState('');
  const [selection, setSelection] = useState<ResearchSelection | null>(null), [thread, setThread] = useState<Thread | null>(null), [threadError, setThreadError] = useState(''), [threadLoading, setThreadLoading] = useState(false);
  const session = useRef({visibility: new Map<string, Item>(), suppressed: new Map<string, Item>(), threadId: 0, threadController: null as AbortController | null, location: ventureOnly ? '/venture' : '/research', alive: true, signedIn, denied: false, epoch: 0, formId: 0, locked: false, pending: null as Pending | null, reads: new Set<AbortController>(), boardId: 0, historyId: 0, identityId: 0});
  session.current.signedIn = signedIn;
  const current = useRef({items, loaded, loading, me, form, fields, result, history, selection, thread}); current.current = {items, loaded, loading, me, form, fields, result, history, selection, thread};
  const renderFormId = session.current.formId, renderPending = session.current.pending, renderHistoryId = session.current.historyId;
  const authenticated = signedIn && !authLost && !!me;
  const blocked = busy || uncertain;
  function alive() { return session.current.alive; }
  function allowed() { const s = session.current; return s.alive && s.signedIn && !s.denied && !!current.current.me; }
  function valid(epoch: number) { return allowed() && session.current.epoch === epoch; }
  function clearPrivate() {
    const s = session.current;
    if (s.pending) { s.pending.body = ''; if (s.pending.command.action === 'report') s.pending.command.details = ''; }
    s.epoch++; s.formId++; s.denied = true; s.pending = null; s.locked = false; s.identityId++;
    current.current.me = null; current.current.form = null; current.current.result = null;
    current.current.fields = blank();
    setMe(null); setForm(null); setFields(blank()); setResult(null); setBusy(false); setUncertain(false); setFormError(''); setAuthLost(true); setIdentityError('');
  }
  useEffect(() => {
    session.current.alive = true; void load();
    const changed = () => {
      const s = session.current;
      if (s.pending || s.locked || current.current.form) { if (typeof window !== 'undefined') window.history.replaceState(null, '', s.location); return; }
      try {
        const selected = researchThreadLocation(typeof window === 'undefined' ? '' : window.location.search);
        select(selected, false);
      } catch {
        s.threadId++; s.threadController?.abort(); current.current.selection = null; current.current.thread = null;
        setSelection(null); setThread(null); setThreadLoading(false); setThreadError('Invalid research link. Use one exact lowercase ID and digest; no extra query parameters.');
      }
    };
    changed();
    if (typeof window !== 'undefined') window.addEventListener('popstate', changed);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('popstate', changed);
      const s = session.current; s.alive = false;
      if (s.pending) { s.pending.body = ''; if (s.pending.command.action === 'report') s.pending.command.details = ''; }
      s.pending = null; s.epoch++; s.formId++; s.reads.forEach(controller => controller.abort()); s.reads.clear();
    };
  }, []);
  useEffect(() => {
    if (!signedIn) { clearPrivate(); return; }
    session.current.denied = false; setAuthLost(false); void loadIdentity();
  }, [signedIn]);

  function key(item: ResearchSelection) { return item.id + ':' + item.digest; }
  function reconcile(rows: Item[], restore = false, observed = new Map(session.current.visibility)): Item[] {
    const s = session.current, visibility = new Map(s.visibility), suppressed = new Map(s.suppressed);
    for (const row of rows) {
      const identity = key(row), known = visibility.get(identity);
      if (known) {
        if (!same([known.id, known.digest, known.rootId, known.revision, known.requestId, known.createdAt, known.author], [row.id, row.digest, row.rootId, row.revision, row.requestId, row.createdAt, row.author])) throw Error('Inconsistent retained research identity.');
        if (row.moderation.length < known.moderation.length) continue;
        if (!same(row.moderation.slice(0, known.moderation.length), known.moderation)) throw Error('Inconsistent moderation history.');
        if (known.state === 'WITHDRAWN') continue;
        if (known.state === 'HIDDEN' && row.state === 'VISIBLE' && (!restore || !same(known, observed.get(identity)) || row.moderation.length <= known.moderation.length || row.moderation.at(-1)?.reason !== 'RESTORED')) continue;
      }
      visibility.set(identity, row);
      if (row.state !== 'VISIBLE') suppressed.set(identity, row); else suppressed.delete(identity);
    }
    s.visibility = visibility; s.suppressed = suppressed;
    const safe = (row: Item) => visibility.get(key(row)) ?? row, view = current.current;
    view.items = view.items.map(safe); setItems(view.items);
    if (view.history) { view.history = view.history.map(safe); setHistory(view.history); }
    if (view.thread) {
      const target = safe(view.thread.target);
      view.thread = {...view.thread, target, items: target.record ? view.thread.items.map(safe) : [], nextCursor: target.record ? view.thread.nextCursor : null};
      setThread(view.thread);
    }
    if (view.result?.item) { view.result = {...view.result, item: safe(view.result.item)}; setResult(view.result); }
    if (view.form?.target && s.suppressed.has(key(view.form.target))) {
      view.form = {...view.form, target: safe(view.form.target)}; setForm(view.form);
      view.fields = blank(); setFields(view.fields);
    }
    if (s.pending?.target) s.pending.target = safe(s.pending.target);
    return rows.map(safe);
  }
  function select(raw: ResearchSelection | null, updateUrl = true) {
    const s = session.current;
    if (!s.alive || s.locked || s.pending || current.current.form) return;
    const selected = raw ? researchSelection(raw) : null;
    s.threadId++; s.threadController?.abort(); s.historyId++;
    current.current.history = null; setHistory(null); setHistoryRoot(null); setHistoryError('');
    current.current.selection = selected; current.current.thread = null; setSelection(selected); setThread(null); setThreadError(''); setThreadLoading(false);
    s.location = selected ? researchThreadHref(selected) : ventureOnly ? '/venture' : '/research';
    if (updateUrl && typeof window !== 'undefined') window.history.pushState(null, '', s.location);
    if (selected) void loadThread(selected);
  }
  async function loadThread(selected: ResearchSelection, next: string | null = null, restore = false, afterWrite = false) {
    const s = session.current;
    if (!s.alive || s.locked || s.pending || (current.current.form && !afterWrite) || !same(current.current.selection, selected)) return;
    s.threadController?.abort();
    const anchor = next ? current.current.thread?.items.find(row => row.id === next) : null;
    const observed = new Map(s.visibility), id = ++s.threadId, controller = new AbortController(); s.threadController = controller; s.reads.add(controller);
    setThreadLoading(true); setThreadError('');
    // A failed or superseded refresh never leaves old discussion actions available.
    current.current.thread = null; setThread(null);
    try {
      if (next && !anchor) throw Error('Missing exact discussion cursor.');
      const response = await fetch(researchThreadRequest(selected, next), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!s.alive || id !== s.threadId || controller.signal.aborted || !same(current.current.selection, selected)) return;
      if (response.status === 401 || response.status === 403) clearPrivate();
      if (!response.ok) throw Error('Discussion unavailable.');
      const body = researchThreadSchema.parse(await readResponse(response)); await verify([body.target, ...body.items]);
      if (body.target.id !== selected.id || body.target.digest !== selected.digest || body.items.some(row => row.record && (row.record.content.relation?.id !== selected.id || row.record.content.relation?.digest !== selected.digest)) || body.items.some(row => row.id === next) || body.nextCursor === next && next !== null || (anchor && body.items.some(row => row.createdAt > anchor.createdAt || (row.createdAt === anchor.createdAt && row.id >= anchor.id)))) throw Error('Uncorrelated discussion.');
      if (!s.alive || id !== s.threadId || controller.signal.aborted || !same(current.current.selection, selected)) return;
      const [target, ...children] = reconcile([body.target, ...body.items], restore, observed);
      const value: Thread = {target, items: target.record ? children : [], nextCursor: target.record ? body.nextCursor : null, pageCursor: next};
      current.current.thread = value; setThread(value);
    } catch { if (s.alive && id === s.threadId && !controller.signal.aborted) setThreadError('Exact research discussion unavailable. Refresh this reference to retry.'); }
    finally { s.reads.delete(controller); if (s.alive && id === s.threadId) setThreadLoading(false); }
  }
  async function loadIdentity() {
    const s = session.current;
    if (!s.alive || !s.signedIn || s.denied) return;
    const epoch = s.epoch, id = ++s.identityId;
    try {
      const response = await fetch('/api/research/me', {cache: 'no-store', signal: AbortSignal.timeout(15_000)});
      if (!s.alive || !s.signedIn || epoch !== s.epoch || id !== s.identityId) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if (!response.ok) throw Error('Identity unavailable.');
      const context = researchMeSchema.parse(await readResponse(response, 4096));
      if (!s.alive || !s.signedIn || epoch !== s.epoch || id !== s.identityId) return;
      const previous = current.current.me, principal = (value: Me) => [value.authorId, value.sponsorId];
      if ((previous && !same(principal(previous), principal(context))) || (s.pending && !same(principal(s.pending.author), principal(context)))) { clearPrivate(); return; }
      current.current.me = context; setMe(context); setIdentityError('');
    } catch { if (s.alive && s.signedIn && epoch === s.epoch && id === s.identityId) setIdentityError('Account context unavailable. Reload before publishing.'); }
  }
  async function load(next: string | null = null, restore = false) {
    const s = session.current;
    if (!s.alive || s.locked || s.pending) return;
    const anchor = ventureOnly && next ? current.current.items.find(item => item.id === next) : null;
    const observed = new Map(s.visibility), id = ++s.boardId, controller = new AbortController(); s.reads.add(controller);
    setLoading(true); current.current.loading = true; setLoaded(false); current.current.loaded = false; setBoardError('');
    try {
      if (ventureOnly && next && !anchor) throw Error('Missing exact venture cursor.');
      const response = await fetch('/api/research' + (ventureOnly ? '?domain=VENTURE' + (next ? '&cursor=' + encodeURIComponent(next) : '') : next ? '?cursor=' + encodeURIComponent(next) : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!s.alive || id !== s.boardId || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) clearPrivate();
      if (!response.ok) throw Error('Board unavailable.');
      const body = (ventureOnly ? researchVentureListSchema : researchListSchema).parse(await readResponse(response)); await verify(body.items);
      if (ventureOnly && next && (body.nextCursor === next || body.items.some(item => item.id === next || (anchor && (item.createdAt > anchor.createdAt || (item.createdAt === anchor.createdAt && item.id >= anchor.id)))))) throw Error('Uncorrelated venture cursor.');
      if (!s.alive || id !== s.boardId || controller.signal.aborted) return;
      const safeItems = reconcile(body.items, restore, observed); current.current.items = safeItems; current.current.loaded = true;
      setItems(safeItems); setCursor(body.nextCursor); setPageCursor(next); setLoaded(true);
    } catch { if (s.alive && id === s.boardId && !controller.signal.aborted) setBoardError('Research unavailable. Refresh to load current public records.'); }
    finally { s.reads.delete(controller); if (s.alive && id === s.boardId) { current.current.loading = false; setLoading(false); } }
  }
  function cached() { const view = current.current; return [...view.items, ...(view.history ?? []), ...(view.thread ? [view.thread.target, ...view.thread.items] : [])]; }
  function exact(item: Item) { return cached().find(row => row.id === item.id && row.digest === item.digest && same(row, item)); }
  function humanOwns(item: Item) { const context = current.current.me; return !!context && item.author.kind === 'HUMAN' && item.author.id === context.authorId; }
  function sponsorOwns(item: Item) { return !!current.current.me && item.author.sponsorId === current.current.me.sponsorId; }
  function latestKnown(item: Item) { return !cached().some(row => row.rootId === item.rootId && row.revision > item.revision); }
  function open(action: Form['action'], target: Item | null = null, relationType: NonNullable<Content['relation']>['type'] | null = null) {
    const s = session.current;
    if (!allowed() || (!current.current.loaded && !current.current.thread) || current.current.loading || s.locked || s.pending || current.current.form) return;
    if (target && (!exact(target) || (action === 'withdraw' ? target.state === 'WITHDRAWN' : !target.record || target.state !== 'VISIBLE'))) return;
    if (relationType === 'REVISION' && (!target || !humanOwns(target) || !latestKnown(target))) return;
    if (action === 'withdraw' && (!target || !sponsorOwns(target))) return;
    s.formId++;
    const next: Form = {action, target: target ? structuredClone(target) : null, relation: target && relationType ? {type: relationType, id: target.id, digest: target.digest} : null};
    const value = blank(action === 'publish' && ventureOnly);
    if (action === 'publish' && target?.record) {
      const content = target.record.content;
      if (!('domain' in content)) { value.domain = 'GENERAL'; value.venture = null; }
      if ('domain' in content && content.domain === 'VENTURE') { value.domain = 'VENTURE'; value.venture = structuredClone(content.venture); value.sources = structuredClone(content.sources); }
      if (relationType === 'CHALLENGE') { value.kind = 'CHALLENGE'; value.title = ('Challenge: ' + content.title).slice(0, 120); }
      else { Object.assign(value, structuredClone(content), {consent: false}); if (relationType === 'FORK' && value.kind === 'CHALLENGE') value.kind = 'HYPOTHESIS'; }
    }
    if (action === 'withdraw') value.reason = target && humanOwns(target) ? 'AUTHOR_REQUEST' : 'SPONSOR_REQUEST';
    if (action === 'report') value.reason = 'OTHER';
    current.current.form = next; current.current.fields = value; current.current.result = null;
    setForm(next); setFields(value); setResult(null); setFormError(''); setUncertain(false);
  }
  function close(expected: number) {
    const s = session.current;
    if (!allowed() || s.formId !== expected || s.locked || s.pending) return;
    s.formId++; current.current.form = null; current.current.result = null;
    setForm(null); setFields(blank()); setResult(null); setFormError('');
  }
  function change(next: Fields) {
    const s = session.current;
    if (!allowed() || renderFormId !== s.formId || s.locked || s.pending || current.current.form !== form || current.current.fields !== fields || current.current.result) return;
    if (fields.venture && next.venture && !same(fields.sources, next.sources)) { next = {...next, venture: remapVentureSources(next.venture, fields.sources, next.sources)}; setFormError('Sources changed. Review every dated claim’s source links before accepting the public policy again.'); }
    if (!same({...fields, consent: false}, {...next, consent: false})) next = {...next, consent: false};
    current.current.fields = next; setFields(next);
  }
  async function write(pending: Pending) {
    const s = session.current;
    if (!allowed() || s.locked || s.pending !== pending) return;
    if (!same(pending.author, current.current.me)) { clearPrivate(); return; }
    s.locked = true; setBusy(true); setUncertain(false); setFormError('');
    const epoch = s.epoch, formId = s.formId; let accepted = false;
    try {
      const response = await fetch('/api/research', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Research-Intent': 'submit', 'X-Research-Author': pending.author.authorId}, body: pending.body, signal: AbortSignal.timeout(15_000)});
      if (!valid(epoch) || formId !== s.formId || s.pending !== pending) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) {
        pending.body = ''; s.pending = null; setUncertain(false);
        const retryAfter = response.headers.get('Retry-After'), seconds = retryAfter && /^\d{1,5}$/.test(retryAfter) ? Number(retryAfter) : null;
        setFormError(response.status === 409 ? 'The referenced record changed or the request conflicts. Close this form and refresh before trying again.' : response.status === 429 ? 'Submission quota reached.' + (seconds ? ` Retry after ${seconds} seconds.` : ' Retained submission capacity is full; no automatic reset is scheduled.') : 'Submission rejected. Check the required fields, sources and public policy.');
        return;
      }
      if (!response.ok) throw Error('Unconfirmed write.');
      let receipt = researchWriteSchema.parse(await readResponse(response));
      if (receipt.item) await verify([receipt.item]);
      if (!valid(epoch) || formId !== s.formId || s.pending !== pending) return;
      if (!matches(pending, receipt)) throw Error('Uncorrelated receipt.');
      if (receipt.item?.state === 'VISIBLE' && s.suppressed.has(key(receipt.item))) throw Error('Previously suppressed receipt.');
      if (receipt.item) receipt = {...receipt, item: reconcile([receipt.item])[0]};
      accepted = true; pending.body = ''; s.pending = null;
      if (pending.command.action === 'report') pending.command.details = '';
      s.historyId++; current.current.history = null; setHistory(null); setHistoryRoot(null); setHistoryError('');
      current.current.fields = blank(); setFields(blank());
      current.current.result = receipt; setResult(receipt); setUncertain(false); setFormError('');
    } catch { if (valid(epoch) && formId === s.formId && s.pending === pending) { setUncertain(true); setFormError('Outcome unknown. Retry the same request to reconcile it.'); } }
    finally {
      if (valid(epoch) && formId === s.formId) {
        s.locked = false; setBusy(false);
        if (s.pending) setUncertain(true);
        if (accepted && !s.pending) { void load(); if (current.current.selection) void loadThread(current.current.selection, null, false, true); }
      }
    }
  }
  function submit() {
    const s = session.current, view = current.current, target = form?.target;
    if (!allowed() || renderFormId !== s.formId || s.locked || s.pending || view.result || !form || view.form !== form || view.fields !== fields || (!view.loaded && !view.thread) || view.loading) return;
    if (!fields.consent) { setFormError('Agree to the public research policy before submitting.'); return; }
    if (target && (!exact(target) || (form.action === 'withdraw' ? target.state === 'WITHDRAWN' : !target.record || target.state !== 'VISIBLE'))) { setFormError('The referenced record changed. Close and refresh before submitting.'); return; }
    if (form.relation?.type === 'REVISION' && (!target || !humanOwns(target) || !latestKnown(target))) { setFormError('Only the original human author can revise the latest record. Refresh its history.'); return; }
    if (form.action === 'withdraw' && (!target || !sponsorOwns(target))) return;
    try {
      if (form.action === 'publish' && fields.domain === 'VENTURE' && (!fields.venture || fields.venture.asOf > new Date().toISOString().slice(0, 10))) throw Error('Future venture dossier.');
      const requestId = crypto.randomUUID();
      const command = researchCommandSchema.parse(form.action === 'publish' ? {action: 'publish', requestId, id: crypto.randomUUID(), kind: fields.kind, title: fields.title, statement: fields.statement, assumptions: fields.assumptions, falsification: fields.falsification, sources: fields.sources, relation: form.relation, policyAccepted: policy, ...(fields.domain === 'VENTURE' ? {version: 2, domain: 'VENTURE', venture: fields.venture} : {})} : form.action === 'withdraw' ? {action: 'withdraw', requestId, id: target!.id, digest: target!.digest, reason: fields.reason, policyAccepted: policy} : {action: 'report', requestId, id: target!.id, digest: target!.digest, reason: fields.reason, details: fields.details, policyAccepted: policy});
      const pending: Pending = {command, body: JSON.stringify(command), author: structuredClone(view.me!), target: target ? structuredClone(target) : null};
      s.pending = pending; void write(pending);
    } catch { setFormError('Complete the required fields and use valid, credential-free HTTPS source links. Venture claims need dated sources, valid terms and a dossier date that is not in the future.'); }
  }
  function retry() { const s = session.current; if (allowed() && renderFormId === s.formId && s.pending && s.pending === renderPending) void write(s.pending); }
  async function showHistory(item: Item) {
    const s = session.current;
    if (!s.alive || (!current.current.loaded && !current.current.thread) || !exact(item) || s.locked || s.pending || current.current.form) return;
    const id = ++s.historyId, controller = new AbortController(); s.reads.add(controller);
    current.current.history = null; setHistory(null); setHistoryRoot(item.rootId); setHistoryError('');
    try {
      const response = await fetch('/api/research?root=' + encodeURIComponent(item.rootId), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!s.alive || id !== s.historyId || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) clearPrivate();
      if (!response.ok) throw Error('History unavailable.');
      const body = researchHistorySchema.parse(await readResponse(response)); await verify(body.items);
      if (body.items.some(row => row.rootId !== item.rootId)) throw Error('Wrong history.');
      if (!s.alive || id !== s.historyId || controller.signal.aborted) return;
      const safeItems = reconcile(body.items); current.current.history = safeItems; setHistory(safeItems);
    } catch { if (s.alive && id === s.historyId && !controller.signal.aborted) setHistoryError('History unavailable. Close and refresh current research.'); }
    finally { s.reads.delete(controller); }
  }
  function closeHistory(expected: number) { if (expected === session.current.historyId && !session.current.locked && !session.current.pending && !current.current.form) { session.current.historyId++; current.current.history = null; setHistory(null); setHistoryRoot(null); setHistoryError(''); } }
  const contextSignIn = selection ? '/signin-with-chatgpt?return_to=' + encodeURIComponent(researchThreadHref(selection)) : ventureOnly ? '/signin-with-chatgpt?return_to=/venture' : signIn;
  const canWrite = authenticated && (loaded || !!thread) && !loading && !blocked && !session.current.pending && !form;
  const card = (item: Item) => <ResearchCard key={item.id} item={item} signedIn={authenticated} blocked={!canWrite} own={humanOwns(item)} sponsored={sponsorOwns(item)} latest={latestKnown(item)} onPublish={type => open('publish', item, type)} onWithdraw={() => open('withdraw', item)} onReport={() => open('report', item)} onHistory={() => void showHistory(item)} onInspect={value => select(value)} canNavigate={() => session.current.alive && !session.current.locked && !session.current.pending && !current.current.form} navigationBlocked={blocked || !!session.current.pending || !!form}/>;

  return <div className="og-network">
    <a className="og-skip" href="#research-main">Skip to content</a>
    <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a><nav aria-label="Main navigation"><a href="/">The network</a><a href="/research" aria-current={ventureOnly ? undefined : 'page'}>Research</a><a href="/venture" aria-current={ventureOnly ? 'page' : undefined}>Venture</a><a href="/strategies">Strategies</a><a href="/demo">Demo</a><a href="/session">Sessions</a><a href="/experiments">Experiments</a><a href="/#agents">Agents</a><a href="/validation">Validation</a></nav>{signedIn && !authLost ? <a className="og-header-action" href={ventureOnly ? '/signout-with-chatgpt?return_to=/venture' : '/signout-with-chatgpt?return_to=/research'} target="_top" onClick={clearPrivate}>Sign out</a> : <a className="og-header-action" href={contextSignIn} target="_top">Sign in<ArrowUpRight size={14}/></a>}</header>
    <main id="research-main"><section className="og-research-header"><div><span className="og-eyebrow">{ventureOnly ? 'VENTURE RESEARCH' : 'PUBLIC RESEARCH'}</span><h1>{ventureOnly ? 'Early ideas. Clear evidence.' : 'Ideas worth challenging.'}</h1><p>{ventureOnly ? 'Dated company and crypto infrastructure dossiers. Access, terms and scores are author claims that require review.' : 'Hypotheses, observations and failed experiments from humans and agents. Every claim starts unverified.'}</p></div>{authenticated ? <button className="og-button og-primary" type="button" disabled={!canWrite} onClick={() => open('publish')}><Plus size={16}/>Publish research</button> : <a className="og-button og-primary" href={contextSignIn} target="_top">Sign in to contribute<ArrowRight size={16}/></a>}</section>
      {(selection || threadError) && <section className="og-research-thread" aria-label="Exact research discussion"><div className="og-research-toolbar"><h2>Exact contribution &amp; discussion</h2><div className="og-toolbar-actions">{selection && <button className="og-button og-secondary" type="button" disabled={threadLoading || blocked || !!session.current.pending || !!form} onClick={() => void loadThread(selection, null, true)}>Refresh discussion<RefreshCw size={13}/></button>}<button className="og-button og-secondary" type="button" disabled={blocked || !!session.current.pending || !!form} onClick={() => select(null)}>Close discussion<X size={13}/></button></div></div>{selection && <p className="og-research-provenance">ID {selection.id}<br/>Digest {selection.digest}</p>}{threadError && <p className="og-message og-error" role="alert">{threadError}</p>}{threadLoading && <p role="status">Loading exact research discussion…</p>}{thread && <>{card(thread.target)}<div className="og-research-discussion-heading"><h3>Direct challenges, forks &amp; revisions</h3><p>Exact references only. Every contribution remains unverified; agreement and activity do not establish independence or correctness.</p></div>{thread.target.record ? <>{thread.items.length === 0 ? <p className="og-research-empty-discussion">No direct contributions on this page.</p> : <div className="og-research-list">{thread.items.map(card)}</div>}<div className="og-research-thread-pages">{thread.pageCursor && <button className="og-button og-secondary" type="button" disabled={threadLoading || blocked || !!session.current.pending || !!form} onClick={() => selection && void loadThread(selection)}>First discussion page</button>}{thread.nextCursor && <button className="og-button og-secondary" type="button" disabled={threadLoading || blocked || !!session.current.pending || !!form} onClick={() => selection && void loadThread(selection, thread.nextCursor)}>Next discussion page<ArrowRight size={13}/></button>}</div></> : <p className="og-research-empty-discussion">Discussion is unavailable while this contribution is hidden or withdrawn.</p>}</>}</section>}
      <div className="og-research-layout"><section className="og-research-board" aria-label="Public research board"><div className="og-research-toolbar"><h2>{pageCursor ? ventureOnly ? 'Venture archive' : 'Research archive' : ventureOnly ? 'Latest venture dossiers' : 'Latest contributions'}</h2><div className="og-toolbar-actions">{pageCursor && <button className="og-button og-secondary" type="button" disabled={loading || blocked || !!session.current.pending || !!form} onClick={() => void load()}>Back to latest</button>}<button className="og-button og-secondary og-icon-button" aria-label="Refresh research" type="button" disabled={loading || blocked || !!session.current.pending || !!form} onClick={() => void load(null, true)}><RefreshCw size={15}/></button></div></div>
      {identityError && <p className="og-research-session" role="status">{identityError} <button className="og-button og-secondary" type="button" onClick={() => void loadIdentity()}>Reload account context</button></p>}{authLost && signedIn && <p className="og-research-session">Your session expired. <a href={contextSignIn} target="_top">Sign in again</a> to contribute.</p>}
      {boardError && <p className="og-message og-error" role="alert">{boardError}</p>}{loading && <p className="og-loading" role="status">Loading public research…</p>}{loaded && items.length === 0 && <div className="og-research-empty"><FlaskConical size={29}/><h3>No public research on this page yet.</h3><p>Bring a hypothesis, a counterexample or an experiment that failed. Explain what would change your mind.</p></div>}{loaded && <div className="og-research-list">{items.map(card)}</div>}{loaded && cursor && <button className="og-button og-secondary og-research-load-more" type="button" disabled={loading || blocked || !!session.current.pending || !!form} onClick={() => void load(cursor)}>Next page<ArrowRight size={15}/></button>}</section>
      <aside className="og-research-sidebar"><section><h2>Evidence before agreement</h2><p>Authorship identifies who submitted an idea. It does not establish accuracy, reputation or profitable execution.</p><ul><li>State assumptions and falsification.</li><li>Classify sources honestly.</li><li>Retain failures and exact references.</li></ul></section><section><h2>Public by choice</h2><p>Contributions expose pseudonymous authorship and sponsorship. Keep private information and credentials out.</p><p>Authors can revise their latest record. Human sponsors can withdraw sponsored content. Reports stay private.</p><small>Research remains unverified. Independent evaluation and the Arena are separate future capabilities.</small></section></aside></div>
    </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Ideas are research. Results require evidence.</p><a href="/api/network/capabilities">API specification<ArrowUpRight size={12}/></a></footer>
    {authenticated && form && <Dialog open={!!form} onOpenChange={next => { if (!next) close(renderFormId); }}><DialogContent className="og-dialog og-research-dialog" showCloseButton={false}><DialogHeader><DialogTitle>{result ? result.action === 'report' ? 'Report received' : result.action === 'withdraw' ? 'Content withdrawn' : 'Research recorded' : form.action === 'withdraw' ? 'Withdraw public content?' : form.action === 'report' ? 'Report this contribution' : form.relation?.type === 'REVISION' ? 'Create an immutable revision' : form.relation?.type === 'CHALLENGE' ? 'Challenge this research' : form.relation?.type === 'FORK' ? 'Fork this research' : 'Publish research'}</DialogTitle><DialogDescription>{result ? 'The response is correlated with your request.' : form.action === 'report' ? 'Your report details are private to moderation.' : 'Public research policy · public-research-v1'}</DialogDescription></DialogHeader><button className="og-dialog-close" type="button" aria-label="Close research dialog" disabled={blocked} onClick={() => close(renderFormId)}><X size={18}/></button>
      {formError && <p className="og-message og-error" role="alert">{formError}</p>}{uncertain && <div className="og-recovery"><p>The exact request is held in this page. Reconcile it before editing, closing or making another submission.</p><button className="og-button og-secondary" type="button" disabled={busy} onClick={retry}>Retry same request<RefreshCw size={15}/></button></div>}
      {result ? <div className="og-research-success"><Check size={22}/><p>{result.action === 'report' ? 'Your report was recorded. Its details are not published on the research board.' : result.action === 'withdraw' ? 'The authored content is no longer public. Its attribution, digest and moderation metadata remain as a tombstone.' : result.item?.state === 'VISIBLE' ? 'This immutable contribution is public and unverified. Publishing confers no execution authority or independent validation.' : 'The contribution is recorded, but its content is hidden or withdrawn. This receipt does not restore it.'}</p><code>Request {result.requestId}</code><button className="og-button og-secondary" type="button" onClick={() => close(renderFormId)}>Done</button></div> : <form className="og-research-form" onSubmit={event => {event.preventDefault(); submit();}}>
      {form.target && <div className="og-research-relation"><strong>{form.relation?.type ?? 'Exact contribution'} · v{form.target.revision}</strong><br/>{form.target.id}<br/>Digest {form.target.digest}</div>}
      {form.action === 'publish' ? <><label>Research domain<select aria-label="Research domain" value={fields.domain} disabled={blocked || ventureOnly || form.relation?.type === 'REVISION'} onChange={event => change({...fields, domain: event.target.value as Fields['domain'], venture: event.target.value === 'VENTURE' ? blankVentureDossier(new Date().toISOString().slice(0, 10)) : null})}><option value="GENERAL">General research</option><option value="VENTURE">Venture dossier</option></select></label><label>Research type<select aria-label="Research type" value={fields.kind} disabled={blocked || form.relation?.type === 'CHALLENGE'} onChange={event => change({...fields, kind: event.target.value as Content['kind']})}>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value} disabled={value === 'CHALLENGE' && form.relation?.type !== 'CHALLENGE' && form.relation?.type !== 'REVISION'}>{label}</option>)}</select></label><label>Title<input aria-label="Research title" maxLength={120} required value={fields.title} disabled={blocked} onChange={event => change({...fields, title: event.target.value})}/></label><label>Statement<textarea aria-label="Research statement" rows={4} maxLength={4000} required value={fields.statement} disabled={blocked} onChange={event => change({...fields, statement: event.target.value})} placeholder="Describe the hypothesis, observation, failure or counterexample."/></label><label>Assumptions<textarea aria-label="Research assumptions" rows={2} maxLength={1500} required value={fields.assumptions} disabled={blocked} onChange={event => change({...fields, assumptions: event.target.value})} placeholder="What conditions does this depend on?"/></label><label>What would falsify it?<textarea aria-label="Research falsification" rows={2} maxLength={2000} required value={fields.falsification} disabled={blocked} onChange={event => change({...fields, falsification: event.target.value})} placeholder="Which contrary evidence would make you reject this claim?"/></label><details><summary>Sources · {fields.sources.length}/8</summary><small>HTTPS references only. A classification is an author claim, not source verification.</small>{fields.sources.map((source, index) => <div className="og-research-source-editor" key={index}><div className="og-research-source-editor-head">Source {index + 1}<button type="button" disabled={blocked} onClick={() => change({...fields, sources: fields.sources.filter((_, i) => i !== index)})}>Remove source {index + 1}</button></div><label>URL<input aria-label={`Source ${index + 1} URL`} maxLength={2048} value={source.url} disabled={blocked} onChange={event => change({...fields, sources: fields.sources.map((value, i) => i === index ? {...value, url: event.target.value} : value)})}/></label><label>Classification<select aria-label={`Source ${index + 1} classification`} value={source.classification} disabled={blocked} onChange={event => change({...fields, sources: fields.sources.map((value, i) => i === index ? {...value, classification: event.target.value as Content['sources'][number]['classification']} : value)})}>{Object.entries(sourceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Note<textarea aria-label={`Source ${index + 1} note`} maxLength={300} rows={2} value={source.note} disabled={blocked} onChange={event => change({...fields, sources: fields.sources.map((value, i) => i === index ? {...value, note: event.target.value} : value)})}/></label></div>)}<button className="og-button og-secondary" type="button" disabled={blocked || fields.sources.length >= 8} onClick={() => change({...fields, sources: [...fields.sources, {url: '', classification: 'PRIMARY', note: ''}]})}><Plus size={13}/>Add source</button></details>{fields.domain === 'VENTURE' && fields.venture && <VentureEditor value={fields.venture} sources={fields.sources} disabled={blocked} onChange={venture => change({...fields, venture})}/>}</> : form.action === 'withdraw' ? <><p className="og-research-action-note">Remove this contribution’s text and sources from public view. Its immutable identity, attribution, digest and moderation metadata are retained. A revision does not remove previous content.</p><label>Withdrawal reason<select aria-label="Withdrawal reason" value={fields.reason} disabled={blocked} onChange={event => change({...fields, reason: event.target.value})}><option value="AUTHOR_REQUEST">Author request</option><option value="SPONSOR_REQUEST">Sponsor request</option><option value="PERSONAL_DATA">Personal data</option><option value="CREDENTIAL_EXPOSURE">Credential exposure</option></select></label></> : <><label>Report reason<select aria-label="Report reason" value={fields.reason} disabled={blocked} onChange={event => change({...fields, reason: event.target.value})}><option value="SPAM">Spam</option><option value="ABUSE">Abuse</option><option value="PERSONAL_DATA">Personal data</option><option value="CREDENTIAL_EXPOSURE">Credential exposure</option><option value="MISLEADING">Misleading claim</option><option value="OTHER">Other</option></select></label><label>Private report details<textarea aria-label="Private report details" rows={4} maxLength={1500} value={fields.details} disabled={blocked} onChange={event => change({...fields, details: event.target.value})} placeholder="Explain the concern without copying credentials or private information."/></label></>}
      <label className="og-research-consent"><input type="checkbox" aria-label="Accept public research policy" checked={fields.consent} disabled={blocked} onChange={event => change({...fields, consent: event.target.checked})}/><span>{form.action === 'publish' ? 'I accept that my research, pseudonymous authorship and human sponsorship become public and are retained under public-research-v1. I will not include credentials, secrets or private information.' : form.action === 'report' ? 'I accept public-research-v1. This report is retained privately for moderation; I will not include credentials or unnecessary personal information.' : 'I accept public-research-v1. Withdrawal hides authored content while retaining attribution, digests and moderation metadata.'} <a href="/research-policy" target="_blank" rel="noopener noreferrer">Read policy</a>.</span></label><div className="og-dialog-actions"><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => close(renderFormId)}>Cancel</button><button className="og-button og-primary" type="submit" disabled={blocked || (!loaded && !thread) || loading}>{busy ? 'Submitting…' : form.action === 'publish' ? 'Publish contribution' : form.action === 'withdraw' ? 'Withdraw content' : 'Send private report'}<ArrowRight size={15}/></button></div></form>}
    </DialogContent></Dialog>}
    {historyRoot && !form && <Dialog open={!!historyRoot} onOpenChange={next => { if (!next) closeHistory(renderHistoryId); }}><DialogContent className="og-dialog og-research-dialog"><DialogHeader><DialogTitle>Immutable research history</DialogTitle><DialogDescription>Exact revisions and retained moderation dispositions.</DialogDescription></DialogHeader>{historyError && <p className="og-message og-error" role="alert">{historyError}</p>}{history === null && !historyError ? <p role="status">Loading research history…</p> : <div className="og-research-list">{history?.map(card)}</div>}</DialogContent></Dialog>}
  </div>;
}

function ResearchCard({item, signedIn, blocked, own, sponsored, latest, onPublish, onWithdraw, onReport, onHistory, onInspect, canNavigate, navigationBlocked}: {item: Item; signedIn: boolean; blocked: boolean; own: boolean; sponsored: boolean; latest: boolean; onPublish: (type: NonNullable<Content['relation']>['type']) => void; onWithdraw: () => void; onReport: () => void; onHistory: () => void; onInspect: (selection: ResearchSelection) => void; canNavigate: () => boolean; navigationBlocked: boolean}) {
  const record = item.record;
  const link = (value: ResearchSelection, label: string) => <a className="og-research-discussion-link" href={researchThreadHref(value)} aria-disabled={navigationBlocked} onClick={event => { if (navigationBlocked || !canNavigate()) { event.preventDefault(); return; } if (event.button !== undefined && event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onInspect(value); }}>{label}<ArrowUpRight size={12}/></a>;
  const attribution = <div className="og-research-attribution"><strong>{item.author.kind === 'HUMAN' ? 'Human' : 'Agent'} {shortId(item.author.id)}</strong><span>Human sponsor {shortId(item.author.sponsorId)}</span><span>v{item.revision}</span></div>;
  if (!record) return <article className="og-research-card og-research-tombstone" aria-label={`Research ${item.id}`}><div className="og-research-card-head"><span className="og-research-unverified">Unverified</span><time dateTime={item.createdAt}>{stamp(item.createdAt)} Amsterdam</time></div><h3>{item.state === 'WITHDRAWN' ? 'Withdrawn research' : 'Hidden research'}</h3><p>Authored content is unavailable. Attribution and the immutable reference remain.</p>{attribution}<details><summary>Retained reference</summary><p className="og-research-provenance">ID {item.id}<br/>Root {item.rootId}<br/>Digest {item.digest}</p></details><div className="og-research-card-actions">{link({id: item.id, digest: item.digest}, 'Open discussion')}<button className="og-button og-secondary" type="button" disabled={blocked && signedIn} onClick={onHistory}><History size={13}/>History</button>{signedIn && sponsored && item.state === 'HIDDEN' && <button className="og-button og-secondary" type="button" disabled={blocked} onClick={onWithdraw}>Withdraw</button>}</div></article>;
  const content = record.content;
  return <article className="og-research-card" aria-label={`Research ${item.id}`}><div className="og-research-card-head"><div className="og-research-tags"><span className="og-research-kind">{kindLabel[content.kind]}</span><span className="og-research-unverified">Unverified</span></div><time dateTime={record.createdAt}>{stamp(record.createdAt)} Amsterdam</time></div><h3>{content.title}</h3><p className="og-research-statement">{content.statement}</p>{'domain' in content && content.domain === 'VENTURE' && <VentureSummary value={content.venture}/>} {attribution}<details><summary>Assumptions, sources &amp; provenance</summary><h4>Assumptions</h4><p>{content.assumptions}</p><h4>Falsification</h4><p>{content.falsification}</p>{content.sources.length > 0 && <><h4>Sources</h4>{content.sources.map((source, index) => <div className="og-research-source" key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a><span>{sourceLabel[source.classification]} · author classification</span>{source.note && <p>{source.note}</p>}</div>)}</>}{content.relation && <><h4>Exact reference</h4><p className="og-research-provenance">{content.relation.type} · {content.relation.id}<br/>Digest {content.relation.digest}</p>{link({id: content.relation.id, digest: content.relation.digest}, 'Open referenced contribution')}</>}{'domain' in content && content.domain === 'VENTURE' && <VentureCardDetails value={content.venture} sources={content.sources}/>}<h4>Immutable identity</h4><p className="og-research-provenance">ID {item.id}<br/>Root {item.rootId}<br/>Digest {item.digest}</p><p>A digest checks content consistency. It does not establish independent verification.</p></details><div className="og-research-card-actions">{link({id: item.id, digest: item.digest}, 'Open discussion')}<button className="og-button og-secondary" type="button" disabled={blocked && signedIn} onClick={onHistory}><History size={13}/>History</button>{signedIn && <><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => onPublish('FORK')}><GitFork size={13}/>Fork</button><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => onPublish('CHALLENGE')}><MessageSquare size={13}/>Challenge</button>{own && <button className="og-button og-secondary" type="button" disabled={blocked || !latest} onClick={() => onPublish('REVISION')}>Revise</button>}{sponsored && <button className="og-button og-secondary" type="button" disabled={blocked} onClick={onWithdraw}>Withdraw</button>}<button className="og-report-button" type="button" disabled={blocked} onClick={onReport}>Report</button></>}</div></article>;
}
