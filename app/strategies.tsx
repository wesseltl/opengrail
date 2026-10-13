'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, Braces, CalendarClock, ChartNoAxesCombined, Check, FlaskConical, Gauge, GitFork, Grid3X3, History, Plus, Radio, RefreshCw, X} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {parseUniqueJson} from './unique-json';
import {boundedStrategyCommand, boundedStrategyRecord, strategyCommandSchema, strategyDefinitionSchema, strategyDigest, strategyHistorySchema, strategyLimits, strategyListSchema, strategyMeSchema, strategyTemplate, strategyWriteSchema} from './strategy-model';
import {strategyHandoffHref} from './strategy-handoff';
import {programHref} from './program-link';
import {programProfile,programAbi,programSourceLimits,programBinaryDigest,verifyProgramSource as verifyProgramDefinition,type ProgramSource} from './program-source-model';
import {strategyEvidenceHref} from './strategy-evidence-model';
import {strategyLineageHref} from './strategy-lineage-model';
import {MainNavigation} from './main-navigation';
import './network.css';
import './strategies.css';
import './strategy-flow.css';

type Item = ReturnType<typeof strategyListSchema.parse>['items'][number];
type Record = NonNullable<Item['record']>;
type Content = Record['content'];
type Definition = Content['definition'];
type Template = Definition['entry']['type'];
type Me = ReturnType<typeof strategyMeSchema.parse>;
type Command = ReturnType<typeof strategyCommandSchema.parse>;
type Result = ReturnType<typeof strategyWriteSchema.parse>;
type Form = {action: 'publish' | 'withdraw' | 'report'; target: Item | null; relation: Content['relation']};
type Fields = {name: string; description: string; assumptions: string; falsification: string; sources: Content['sources']; definition: Definition | null; advanced: boolean; json: string; jsonDirty: boolean; numberDrafts: {[key: string]: string}; consent: boolean; reason: string; details: string; program: ProgramSource | null; programEnabled: boolean; programHex: string; programParameters: string; programDirty: boolean};
type Pending = {command: Command; body: string; author: Me; target: Item | null};
const policy = 'public-strategy-v1' as const;
const signIn = '/signin-with-chatgpt?return_to=/strategies';
const templates = [
  {type: 'TREND', label: 'Trend', detail: 'Fast and slow moving averages', icon: ChartNoAxesCombined},
  {type: 'RSI', label: 'RSI', detail: 'A bounded momentum threshold', icon: Gauge},
  {type: 'BREAKOUT', label: 'Breakout', detail: 'A prior range breakout', icon: ArrowUpRight},
  {type: 'DCA', label: 'DCA', detail: 'Scheduled entries within one allocation', icon: CalendarClock},
  {type: 'GRID', label: 'Grid', detail: 'Partition an authored price range', icon: Grid3X3},
  {type: 'SIGNAL', label: 'Signals', detail: 'Define an external signal assumption', icon: Radio},
  {type: 'RULES', label: 'Custom rules', detail: 'Combine declarative indicator conditions', icon: Braces},
] as const;
const templateLabel = (type: Template) => templates.find(template => template.type === type)?.label ?? type;
const sourceLabel = {PRIMARY: 'Primary source', SECONDARY: 'Secondary source', AUTHOR_CLAIM: 'Author claim', ESTIMATE: 'Estimate', SPECULATION: 'Speculation'};
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shortId = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const blank = (): Fields => ({name: '', description: '', assumptions: '', falsification: '', sources: [], definition: null, advanced: false, json: '', jsonDirty: false, numberDrafts: {}, consent: false, reason: '', details: '', program: null, programEnabled: false, programHex: '', programParameters: '[]', programDirty: false});

async function readResponse(response: Response, maximum = 2_097_152): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing strategy response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw Error('Strategy response too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), maximum, 10);
}

async function verify(items: Item[]) {
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => `${item.rootId}:${item.revision}`)).size !== items.length) throw Error('Duplicate strategy identity.');
  for (const item of items) {
    if (item.record) {
      const {payload} = boundedStrategyRecord(item.record);
      if (await strategyDigest(payload) !== item.digest) throw Error('Strategy digest mismatch.');
      if (item.record.version === 2) await verifyProgramDefinition(item.record.content.program);
    }
  }
}
async function matches(pending: Pending, result: Result) {
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
  // Redacted retries confirm the exact original command digest without restoring authored content.
  if (!item.record) {
    if (item.state !== 'HIDDEN' && item.state !== 'WITHDRAWN') return false;
    const canonical = boundedStrategyRecord({version: 'version' in c && c.version === 2 ? 2 : 1, id: c.id, rootId: item.rootId, revision: item.revision, requestId: c.requestId, createdAt: item.createdAt, author: {kind: 'HUMAN', id: pending.author.authorId, sponsorId: pending.author.sponsorId}, content: {name: c.name, description: c.description, assumptions: c.assumptions, falsification: c.falsification, sources: c.sources, definition: c.definition, relation: c.relation, ...('version' in c && c.version === 2 ? {program: c.program} : {})}, policyAccepted: c.policyAccepted, verification: 'UNTESTED', executionEnabled: false});
    return await strategyDigest(canonical.payload) === item.digest;
  }
  const content = {name: c.name, description: c.description, assumptions: c.assumptions, falsification: c.falsification, sources: c.sources, definition: c.definition, relation: c.relation, ...('version' in c && c.version === 2 ? {program: c.program} : {})};
  return item.record.version === ('version' in c && c.version === 2 ? 2 : 1) && item.record.verification === 'UNTESTED' && same(item.record.content, content);
}

function completeNumbers(fields: Fields) {
  return Object.values(fields.numberDrafts).every(raw => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()) && Number.isFinite(Number(raw)));
}

export default function Strategies({signedIn}: {signedIn: boolean}) {
  const [items, setItems] = useState<Item[]>([]), [cursor, setCursor] = useState<string | null>(null), [pageCursor, setPageCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(false), [boardError, setBoardError] = useState('');
  const [me, setMe] = useState<Me | null>(null), [identityError, setIdentityError] = useState(''), [authLost, setAuthLost] = useState(false);
  const [form, setForm] = useState<Form | null>(null), [fields, setFields] = useState(blank), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [formError, setFormError] = useState(''), [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Item[] | null>(null), [historyRoot, setHistoryRoot] = useState<string | null>(null), [historyError, setHistoryError] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const session = useRef({alive: true, signedIn, denied: false, epoch: 0, formId: 0, locked: false, pending: null as Pending | null, reads: new Set<AbortController>(), boardId: 0, historyId: 0, identityId: 0, fileId: 0});
  session.current.signedIn = signedIn;
  const current = useRef({items, loaded, loading, me, form, fields, result, history, fileBusy}); current.current = {items, loaded, loading, me, form, fields, result, history, fileBusy};
  const renderFormId = session.current.formId, renderPending = session.current.pending, renderHistoryId = session.current.historyId;
  const renderEpoch = session.current.epoch;
  const authenticated = signedIn && !authLost && !!me;
  const blocked = busy || uncertain || fileBusy;
  function allowed() { const s = session.current; return s.alive && s.signedIn && !s.denied && !!current.current.me; }
  function valid(epoch: number) { return allowed() && session.current.epoch === epoch; }
  function clearPrivate() {
    const s = session.current;
    if (s.pending) { s.pending.body = ''; if (s.pending.command.action === 'report') s.pending.command.details = ''; }
    s.epoch++; s.formId++; s.denied = true; s.pending = null; s.locked = false; s.identityId++; s.fileId++;
    current.current.me = null; current.current.form = null; current.current.result = null;
    current.current.fields = blank();
    setMe(null); setForm(null); setFields(blank()); setResult(null); setBusy(false); setFileBusy(false); setUncertain(false); setFormError(''); setAuthLost(true); setIdentityError('');
  }
  useEffect(() => {
    session.current.alive = true; void load();
    return () => {
      const s = session.current; s.alive = false;
      if (s.pending) { s.pending.body = ''; if (s.pending.command.action === 'report') s.pending.command.details = ''; }
      s.pending = null; s.epoch++; s.formId++; s.fileId++; s.reads.forEach(controller => controller.abort()); s.reads.clear();
    };
  }, []);
  useEffect(() => {
    if (!signedIn) { clearPrivate(); return; }
    session.current.denied = false; setAuthLost(false); void loadIdentity();
  }, [signedIn]);

  async function loadIdentity() {
    const s = session.current;
    if (!s.alive || !s.signedIn || s.denied) return;
    const epoch = s.epoch, id = ++s.identityId;
    try {
      const response = await fetch('/api/strategies/me', {cache: 'no-store', signal: AbortSignal.timeout(15_000)});
      if (!s.alive || !s.signedIn || epoch !== s.epoch || id !== s.identityId) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if (!response.ok) throw Error('Identity unavailable.');
      const context = strategyMeSchema.parse(await readResponse(response, 4096));
      if (!s.alive || !s.signedIn || epoch !== s.epoch || id !== s.identityId) return;
      current.current.me = context; setMe(context); setIdentityError('');
    } catch { if (s.alive && s.signedIn && epoch === s.epoch && id === s.identityId) setIdentityError('Account context unavailable. Reload before publishing.'); }
  }
  async function load(next: string | null = null) {
    const s = session.current;
    if (!s.alive || s.locked || s.pending) return;
    const id = ++s.boardId, controller = new AbortController(); s.reads.add(controller);
    setLoading(true); setLoaded(false); current.current.loaded = false; setBoardError('');
    try {
      const response = await fetch('/api/strategies' + (next ? '?cursor=' + encodeURIComponent(next) : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!s.alive || id !== s.boardId || controller.signal.aborted) return;
      if (!response.ok) throw Error('Board unavailable.');
      const body = strategyListSchema.parse(await readResponse(response)); await verify(body.items);
      if (!s.alive || id !== s.boardId || controller.signal.aborted) return;
      current.current.items = body.items; current.current.loaded = true;
      setItems(body.items); setCursor(body.nextCursor); setPageCursor(next); setLoaded(true);
    } catch { if (s.alive && id === s.boardId && !controller.signal.aborted) setBoardError('Strategy unavailable. Refresh to load current public records.'); }
    finally { s.reads.delete(controller); if (s.alive && id === s.boardId) setLoading(false); }
  }
  function exact(item: Item) { return [...current.current.items, ...(current.current.history ?? [])].find(row => row.id === item.id && row.digest === item.digest && same(row, item)); }
  function humanOwns(item: Item) { const context = current.current.me; return !!context && item.author.kind === 'HUMAN' && item.author.id === context.authorId; }
  function sponsorOwns(item: Item) { return !!current.current.me && item.author.sponsorId === current.current.me.sponsorId; }
  function latestKnown(item: Item) { return ![...current.current.items, ...(current.current.history ?? [])].some(row => row.rootId === item.rootId && row.revision > item.revision); }
  function open(action: Form['action'], target: Item | null = null, relationType: NonNullable<Content['relation']>['type'] | null = null) {
    const s = session.current;
    if (!allowed() || !current.current.loaded || current.current.loading || s.locked || s.pending || current.current.form) return;
    if (target && (!exact(target) || (action === 'withdraw' ? target.state === 'WITHDRAWN' : !target.record || target.state !== 'VISIBLE'))) return;
    if (relationType === 'REVISION' && (!target || !humanOwns(target) || !latestKnown(target))) return;
    if (action === 'withdraw' && (!target || !sponsorOwns(target))) return;
    s.formId++;
    const next: Form = {action, target: target ? structuredClone(target) : null, relation: target && relationType ? {type: relationType, id: target.id, digest: target.digest} : null};
    const value = blank();
    if (action === 'publish' && target?.record) {
      const content = target.record.content;
      Object.assign(value, structuredClone(content), {consent: false, json: JSON.stringify(content.definition, null, 2)});
      if (target.record.version === 2) Object.assign(value, {programEnabled: true, programHex: target.record.content.program.bytesHex, programParameters: JSON.stringify(target.record.content.program.parameters), programDirty: false});
    }
    if (action === 'withdraw') value.reason = target && humanOwns(target) ? 'AUTHOR_REQUEST' : 'SPONSOR_REQUEST';
    if (action === 'report') value.reason = 'OTHER';
    current.current.form = next; current.current.fields = value; current.current.result = null;
    setForm(next); setFields(value); setResult(null); setFormError(''); setUncertain(false);
  }
  function close(expected: number) {
    const s = session.current;
    if (!allowed() || s.formId !== expected || s.locked || s.pending || current.current.fileBusy) return;
    s.formId++; current.current.form = null; current.current.result = null;
    setForm(null); setFields(blank()); setResult(null); setFormError('');
  }
  function change(next: Fields) {
    const s = session.current;
    if (!allowed() || renderFormId !== s.formId || s.locked || s.pending || current.current.fileBusy || current.current.form !== form || current.current.fields !== fields || current.current.result) return;
    current.current.fields = next; setFields(next);
  }
  async function write(pending: Pending) {
    const s = session.current;
    if (!allowed() || s.locked || s.pending !== pending) return;
    s.locked = true; setBusy(true); setUncertain(false); setFormError('');
    const epoch = s.epoch, formId = s.formId; let accepted = false;
    try {
      const response = await fetch('/api/strategies', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Strategy-Intent': 'submit', 'X-Strategy-Author': pending.author.authorId}, body: pending.body, signal: AbortSignal.timeout(15_000)});
      if (!valid(epoch) || formId !== s.formId || s.pending !== pending) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) {
        pending.body = ''; s.pending = null; setUncertain(false);
        const retryAfter = response.headers.get('Retry-After'), seconds = retryAfter && /^\d{1,5}$/.test(retryAfter) ? Number(retryAfter) : null;
        setFormError(response.status === 409 ? 'The referenced record changed or the request conflicts. Close this form and refresh before trying again.' : response.status === 429 ? 'Submission quota reached.' + (seconds ? ` Retry after ${seconds} seconds.` : ' Retained submission capacity is full; no automatic reset is scheduled.') : 'Submission rejected. Check the required fields, sources and public policy.');
        return;
      }
      if (!response.ok) throw Error('Unconfirmed write.');
      const receipt = strategyWriteSchema.parse(await readResponse(response));
      if (receipt.item) await verify([receipt.item]);
      if (!valid(epoch) || formId !== s.formId || s.pending !== pending) return;
      if (!await matches(pending, receipt)) throw Error('Uncorrelated receipt.');
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
        if (accepted && !s.pending) void load();
      }
    }
  }
  function submit() {
    const s = session.current, view = current.current, target = form?.target;
    if (!allowed() || renderFormId !== s.formId || s.locked || s.pending || view.fileBusy || view.result || !form || view.form !== form || view.fields !== fields || !view.loaded || view.loading) return;
    if (!fields.consent) { setFormError('Agree to the public strategy policy before submitting.'); return; }
    if (form.action === 'publish' && fields.programEnabled && (!fields.program || fields.programDirty)) { setFormError('Apply the exact program bytes and parameters before publishing.'); return; }
    if (form.action === 'publish' && fields.jsonDirty) { setFormError('Apply or discard your JSON changes before publishing.'); return; }
    if (form.action === 'publish' && !completeNumbers(fields)) { setFormError('Complete every numeric field. Empty costs or thresholds are not zero.'); return; }
    if (target && (!exact(target) || (form.action === 'withdraw' ? target.state === 'WITHDRAWN' : !target.record || target.state !== 'VISIBLE'))) { setFormError('The referenced record changed. Close and refresh before submitting.'); return; }
    if (form.relation?.type === 'REVISION' && (!target || !humanOwns(target) || !latestKnown(target))) { setFormError('Only the original human author can revise the latest record. Refresh its history.'); return; }
    if (form.action === 'withdraw' && (!target || !sponsorOwns(target))) return;
    try {
      const requestId = crypto.randomUUID();
      const {command} = boundedStrategyCommand(form.action === 'publish' ? {action: 'publish', ...(fields.programEnabled ? {version: 2, program: fields.program} : {}), requestId, id: crypto.randomUUID(), name: fields.name, description: fields.description, assumptions: fields.assumptions, falsification: fields.falsification, sources: fields.sources, definition: fields.definition, relation: form.relation, policyAccepted: policy} : form.action === 'withdraw' ? {action: 'withdraw', requestId, id: target!.id, digest: target!.digest, reason: fields.reason, policyAccepted: policy} : {action: 'report', requestId, id: target!.id, digest: target!.digest, reason: fields.reason, details: fields.details, policyAccepted: policy});
      const pending: Pending = {command, body: JSON.stringify(command), author: structuredClone(view.me!), target: target ? structuredClone(target) : null};
      s.pending = pending; void write(pending);
    } catch { setFormError('Complete the strategy, risk assumptions and required fields. Use valid, credential-free HTTPS source links.'); }
  }
  function retry() { const s = session.current; if (allowed() && renderFormId === s.formId && s.pending && s.pending === renderPending) void write(s.pending); }
  async function showHistory(item: Item) {
    const s = session.current;
    if (!s.alive || !current.current.loaded || !exact(item) || s.locked || s.pending || current.current.form) return;
    const id = ++s.historyId, controller = new AbortController(); s.reads.add(controller);
    current.current.history = null; setHistory(null); setHistoryRoot(item.rootId); setHistoryError('');
    try {
      const response = await fetch('/api/strategies?root=' + encodeURIComponent(item.rootId), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!s.alive || id !== s.historyId || controller.signal.aborted) return;
      if (!response.ok) throw Error('History unavailable.');
      const body = strategyHistorySchema.parse(await readResponse(response)); await verify(body.items);
      if (body.items.some(row => row.rootId !== item.rootId)) throw Error('Wrong history.');
      if (!s.alive || id !== s.historyId || controller.signal.aborted) return;
      current.current.history = body.items; setHistory(body.items);
    } catch { if (s.alive && id === s.historyId && !controller.signal.aborted) setHistoryError('History unavailable. Close and refresh current strategy.'); }
    finally { s.reads.delete(controller); }
  }
  function closeHistory(expected: number) { if (expected === session.current.historyId && !session.current.locked && !session.current.pending && !current.current.form) { session.current.historyId++; current.current.history = null; setHistory(null); setHistoryRoot(null); setHistoryError(''); } }
  function chooseTemplate(type: Template) {
    if (fields.programEnabled && type !== 'SIGNAL') { setFormError('A program source uses CUSTOM signals; its authored risk and cost controls remain fixed.'); return; }
    if (fields.jsonDirty) { setFormError('Apply or discard your JSON changes before changing templates.'); return; }
    if (!completeNumbers(fields)) { setFormError('Complete every numeric field before changing templates.'); return; }
    const definition = strategyTemplate(type);
    if (fields.definition) {
      definition.market = structuredClone(fields.definition.market);
      definition.risk = structuredClone(fields.definition.risk);
      definition.costs = structuredClone(fields.definition.costs);
    }
    if (definition.entry.type === 'SIGNAL') { if (fields.programEnabled) { definition.entry.provider = 'CUSTOM'; definition.entry.maxAgeBars = 1; } definition.entry.event = definition.market.direction === 'LONG' ? 'BULLISH' : 'BEARISH'; }
    change({...fields, definition, json: JSON.stringify(definition, null, 2), numberDrafts: {}});
  }
  function selectMode(advanced: boolean) {
    if (fields.jsonDirty) { setFormError('Apply or discard your JSON changes before changing editors.'); return; }
    if (!completeNumbers(fields)) { setFormError('Complete every numeric field before changing editors.'); return; }
    if (advanced && fields.definition) {
      const parsed = strategyDefinitionSchema.safeParse(fields.definition);
      if (!parsed.success) { setFormError('Complete valid template numbers before editing JSON.'); return; }
      change({...fields, advanced, definition: parsed.data, json: JSON.stringify(parsed.data, null, 2), numberDrafts: {}});
    } else change({...fields, advanced, json: fields.definition ? JSON.stringify(fields.definition, null, 2) : ''});
  }
  function applyJson() {
    const s = session.current;
    if (!allowed() || s.formId !== renderFormId || s.locked || s.pending || current.current.fileBusy || current.current.fields !== fields) return;
    try {
      const definition = strategyDefinitionSchema.parse(parseUniqueJson(fields.json, strategyLimits.requestBytes, 8));
      if (fields.programEnabled && (definition.entry.type !== 'SIGNAL' || definition.entry.provider !== 'CUSTOM' || definition.entry.maxAgeBars !== 1)) throw Error('Program source requires CUSTOM signals.');
      change({...fields, definition, json: JSON.stringify(definition, null, 2), jsonDirty: false, numberDrafts: {}});
      setFormError('');
    } catch { setFormError('Invalid definition. Use the documented declarative schema with Demo mode, leverage 1 and orders disabled. Executable code and extra fields are rejected.'); }
  }
  async function importJson(file: File | undefined) {
    const s = session.current;
    if (!file || !allowed() || s.formId !== renderFormId || s.locked || s.pending || current.current.fileBusy || current.current.fields !== fields) return;
    const epoch = s.epoch, formId = s.formId, id = ++s.fileId;
    current.current.fileBusy = true; setFileBusy(true); setFormError('');
    try {
      if (file.size > strategyLimits.requestBytes) throw Error('Definition file too large.');
      const bytes = await file.arrayBuffer();
      if (!valid(epoch) || formId !== s.formId || id !== s.fileId) return;
      if (bytes.byteLength > strategyLimits.requestBytes) throw Error('Definition file too large.');
      const json = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
      current.current.fileBusy = false;
      change({...fields, advanced: true, json, jsonDirty: true});
    } catch { if (valid(epoch) && formId === s.formId && id === s.fileId) setFormError('Use a UTF-8 JSON definition file smaller than 32 KB.'); }
    finally { if (valid(epoch) && formId === s.formId && id === s.fileId) { current.current.fileBusy = false; setFileBusy(false); } }
  }
  function programMode(enabled: boolean) {
    if (form?.relation?.type === 'REVISION' && enabled !== (form.target?.record?.version === 2)) return;
    if (fields.jsonDirty || !completeNumbers(fields)) { setFormError('Apply JSON changes and complete numeric fields before changing source type.'); return; }
    let definition = fields.definition;
    if (enabled) {
      const next = strategyTemplate('SIGNAL');
      if (definition) { next.market = structuredClone(definition.market); next.risk = structuredClone(definition.risk); next.costs = structuredClone(definition.costs); }
      if (next.entry.type === 'SIGNAL') { next.entry.provider = 'CUSTOM'; next.entry.maxAgeBars = 1; next.entry.event = next.market.direction === 'LONG' ? 'BULLISH' : 'BEARISH'; }
      definition = next;
    }
    change({...fields, programEnabled: enabled, definition, json: definition ? JSON.stringify(definition, null, 2) : '', programDirty: enabled && (fields.programDirty || !fields.program)});
  }
  async function applyProgram() {
    const s = session.current;
    if (!allowed() || s.formId !== renderFormId || s.locked || s.pending || current.current.fileBusy || current.current.fields !== fields || !fields.programEnabled) return;
    const epoch = s.epoch, formId = s.formId, id = ++s.fileId, captured = fields;
    current.current.fileBusy = true; setFileBusy(true); setFormError('');
    try {
      const parameters = parseUniqueJson(captured.programParameters, 2048, 2);
      const digest = await programBinaryDigest(captured.programHex);
      const program = await verifyProgramDefinition({profile: programProfile, abi: programAbi, bytesHex: captured.programHex, digest, parameters});
      if (!valid(epoch) || formId !== s.formId || id !== s.fileId || current.current.fields !== captured) return;
      current.current.fileBusy = false;
      change({...captured, program, programDirty: false});
    } catch (error) { if (valid(epoch) && formId === s.formId && id === s.fileId) setFormError(error instanceof Error ? 'Program rejected: ' + error.message : 'Program source rejected.'); }
    finally { if (valid(epoch) && formId === s.formId && id === s.fileId) { current.current.fileBusy = false; setFileBusy(false); } }
  }
  function recordedStrategyCurrent() {
    const s = session.current, view = current.current, item = result?.item;
    return !!(allowed() && s.epoch === renderEpoch && s.formId === renderFormId && !blocked && !s.locked && !s.pending && !view.fileBusy && form?.action === 'publish' && view.form === form && result?.action === 'publish' && view.result === result && item?.state === 'VISIBLE' && item.record && item.author.kind === 'HUMAN' && item.author.id === view.me?.authorId && item.author.sponsorId === view.me?.sponsorId && ![...view.items, ...(view.history ?? [])].some(known => known.id === item.id && (known.digest !== item.digest || known.state !== 'VISIBLE' || !known.record)));
  }
  const recordedStrategy = recordedStrategyCurrent() ? result?.item : null;
  const canWrite = authenticated && loaded && !loading && !blocked && !session.current.pending && !form;
  const card = (item: Item) => <StrategyCard key={item.id} item={item} signedIn={authenticated} blocked={!canWrite} own={humanOwns(item)} sponsored={sponsorOwns(item)} latest={latestKnown(item)} onPublish={type => open('publish', item, type)} onWithdraw={() => open('withdraw', item)} onReport={() => open('report', item)} onHistory={() => void showHistory(item)} navigationBlocked={() => !session.current.alive || !!session.current.pending || session.current.locked || !!current.current.form || current.current.fileBusy}/>;

  return <div className="og-network">
    <a className="og-skip" href="#strategy-main">Skip to content</a>
    <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a>{MainNavigation({activeHref:'/strategies'})}{signedIn && !authLost ? <a className="og-header-action" href="/signout-with-chatgpt?return_to=/strategies" target="_top" onClick={clearPrivate}>Sign out</a> : <a className="og-header-action" href={signIn} target="_top">Sign in<ArrowUpRight size={14}/></a>}</header>
    <main id="strategy-main"><section className="og-strategy-header"><div><h1>Strategies</h1><ol className="og-strategy-steps" aria-label="Strategy workflow"><li><strong>Browse &amp; fork</strong><small>Choose rules. Make your version.</small></li><li><strong>Test in Demo</strong><small>Try Demo or Program replay.</small></li><li><strong>Inspect evidence</strong><small>Review results, losses and failures.</small></li></ol><p className="og-strategy-boundary">Untested · Demo only · orders disabled.</p></div>{authenticated ? <button className="og-button og-primary" type="button" disabled={!canWrite} onClick={() => open('publish')}><Plus size={16}/>Create strategy</button> : <a className="og-button og-primary" href={signIn} target="_top">Sign in to create<ArrowRight size={16}/></a>}</section>
      <div className="og-strategy-layout og-strategy-catalog-layout"><aside className="og-strategy-sidebar"><details className="og-strategy-testing-notes"><summary>Testing limits</summary><section><h2>Untested definitions</h2><p>Templates express authored rules, risk limits and cost assumptions. They do not establish working strategies or an edge.</p><ul><li>Exact versions and fork references.</li><li>Explicit fees and slippage.</li><li>Human and agent attribution.</li></ul></section><section><h2>Demo restrictions</h2><p>Every definition is fixed to Demo mode, leverage 1 and orders disabled. This Hub does not run backtests, connect signal providers or place orders.</p><small>Risk settings are proposed assumptions. Independent evaluation and signal-to-Demo integration are separate deliverables.</small></section></details></aside><section className="og-strategy-board" aria-label="Public strategy catalog"><div className="og-strategy-toolbar"><h2>{pageCursor ? 'Strategy archive' : 'Latest definitions'}</h2><div className="og-toolbar-actions">{pageCursor && <button className="og-button og-secondary" type="button" disabled={loading || blocked || !!session.current.pending || !!form} onClick={() => void load()}>Back to latest</button>}<button className="og-button og-secondary og-icon-button" aria-label="Refresh strategies" type="button" disabled={loading || blocked || !!session.current.pending || !!form} onClick={() => void load()}><RefreshCw size={15}/></button></div></div>
      {identityError && <p className="og-strategy-session" role="status">{identityError} <button className="og-button og-secondary" type="button" onClick={() => void loadIdentity()}>Reload account context</button></p>}{authLost && signedIn && <p className="og-strategy-session">Your session expired. <a href={signIn} target="_top">Sign in again</a> to contribute.</p>}
      {boardError && <p className="og-message og-error" role="alert">{boardError}</p>}{loading && <p className="og-loading" role="status">Loading public strategies…</p>}{loaded && items.length === 0 && <div className="og-strategy-empty"><FlaskConical size={29}/><h3>No public strategies on this page yet.</h3><p>Start with a template, a declarative definition or a restricted signal program. Include the assumptions and evidence that would reject it.</p></div>}{loaded && <div className="og-strategy-list">{items.map(card)}</div>}{loaded && cursor && <button className="og-button og-secondary og-strategy-load-more" type="button" disabled={loading || blocked || !!session.current.pending || !!form} onClick={() => void load(cursor)}>Next page<ArrowRight size={15}/></button>}</section>
      </div>
    </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Untested · Demo only</p><a href="/strategy-policy">Strategy policy<ArrowUpRight size={12}/></a></footer>

    {authenticated && form && <Dialog open={!!form} onOpenChange={next => { if (!next) close(renderFormId); }}><DialogContent className="og-dialog og-strategy-dialog" showCloseButton={false}><DialogHeader><DialogTitle>{result ? result.action === 'report' ? 'Report received' : result.action === 'withdraw' ? 'Content withdrawn' : 'Strategy recorded' : form.action === 'withdraw' ? 'Withdraw public strategy?' : form.action === 'report' ? 'Report this strategy' : form.relation?.type === 'REVISION' ? 'Create an immutable revision' : form.relation?.type === 'FORK' ? 'Fork this strategy' : 'Create a strategy'}</DialogTitle><DialogDescription>{result ? 'The response is correlated with your request.' : form.action === 'report' ? 'Your report details are private to moderation.' : 'Authored source · Demo only · untested'}</DialogDescription></DialogHeader><button className="og-dialog-close" type="button" aria-label="Close strategy dialog" disabled={blocked} onClick={() => close(renderFormId)}><X size={18}/></button>
      {formError && <p className="og-message og-error" role="alert">{formError}</p>}{uncertain && <div className="og-recovery"><p>The exact request is held in this page. Reconcile it before editing, closing or publishing another definition.</p><button className="og-button og-secondary" type="button" disabled={busy} onClick={retry}>Retry same request<RefreshCw size={15}/></button></div>}
      {result ? <div className="og-strategy-success"><Check size={22}/><p>{result.action === 'report' ? 'Your report was recorded. Its details are not published in the catalog.' : result.action === 'withdraw' ? 'The authored definition is no longer public. Its attribution, digest and moderation metadata remain as a tombstone.' : result.item?.state === 'VISIBLE' ? 'This immutable strategy is public and untested. Publishing does not run it or confer execution authority.' : 'The strategy is recorded, but its content is hidden or withdrawn. This receipt does not restore it.'}</p><code>Request {result.requestId}</code>{recordedStrategy && <a className="og-button og-secondary" href={strategyEvidenceHref(recordedStrategy)} onClick={event => {if (!recordedStrategyCurrent()) event.preventDefault();}}>Open this strategy<ArrowRight size={15}/></a>}<button className="og-button og-secondary" type="button" onClick={() => close(renderFormId)}>Done</button></div> : <form className="og-strategy-form" onSubmit={event => {event.preventDefault(); submit();}}>
      {form.target && <div className="og-strategy-relation"><strong>{form.relation?.type ?? 'Exact strategy'} · v{form.target.revision}</strong><br/>{form.target.id}<br/>Digest {form.target.digest}</div>}
      {form.action === 'publish' ? <>
        <label>Strategy name<input aria-label="Strategy name" maxLength={120} required value={fields.name} disabled={blocked} onChange={event => change({...fields, name: event.target.value})}/></label>
        <label>What is the strategy trying to do?<textarea aria-label="Strategy description" rows={2} maxLength={3000} required value={fields.description} disabled={blocked} onChange={event => change({...fields, description: event.target.value})}/></label>
        <section className="og-strategy-program-editor" aria-label="Programmable source editor"><label className="og-strategy-consent"><input aria-label="Use programmable signal source" type="checkbox" checked={fields.programEnabled} disabled={blocked || form.relation?.type === 'REVISION'} onChange={event => programMode(event.target.checked)}/><span>Programmable signal source · restricted WebAssembly bytes</span></label>{fields.programEnabled && <><p>Publication stores the exact program and parameters. Only an explicit local Program replay interprets them; this writer runs no guest instructions.</p><label>Module bytes, lowercase hexadecimal<textarea aria-label="Program module hex" rows={5} spellCheck={false} maxLength={programSourceLimits.moduleBytes * 2} value={fields.programHex} disabled={blocked} onChange={event => change({...fields, programHex: event.target.value, programDirty: true})}/></label><label>Numeric parameters (JSON array)<input aria-label="Program parameters JSON" maxLength={2048} value={fields.programParameters} disabled={blocked} onChange={event => change({...fields, programParameters: event.target.value, programDirty: true})}/></label><small>{programProfile}<br/>{programAbi}<br/>Up to {programSourceLimits.moduleBytes} binary bytes and {programSourceLimits.parameters} finite numeric parameters.</small><button className="og-button og-secondary" aria-label="Apply program source" type="button" disabled={blocked || !fields.programHex} onClick={() => void applyProgram()}>Apply program source</button>{fields.program && !fields.programDirty && <p className="og-strategy-provenance">Applied raw binary SHA-256 {fields.program.digest}</p>}{fields.programDirty && <small>Changed program bytes or parameters must be applied before publication.</small>}</>}</section>
        <div className="og-strategy-editor-tabs" role="group" aria-label="Definition editor"><button className="og-button og-secondary" type="button" aria-pressed={!fields.advanced} disabled={blocked} onClick={() => selectMode(false)}>Guided builder</button><button className="og-button og-secondary" type="button" aria-pressed={fields.advanced} disabled={blocked} onClick={() => selectMode(true)}><Braces size={14}/>Definition JSON</button></div>
        {fields.advanced ? <section className="og-strategy-json" aria-label="Declarative JSON editor"><p>Import or edit the same definition schema. Arbitrary code is rejected and never executed.</p><label>JSON definition file<input aria-label="Import definition JSON" type="file" accept=".json,application/json" disabled={blocked} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void importJson(file);}}/></label><label>Definition<textarea aria-label="Definition JSON" rows={14} maxLength={strategyLimits.requestBytes} value={fields.json} disabled={blocked} spellCheck={false} onChange={event => change({...fields, json: event.target.value, jsonDirty: true})}/></label>{fileBusy && <p role="status">Reading definition file…</p>}<div className="og-strategy-json-actions"><button className="og-button og-secondary" type="button" disabled={blocked || !fields.json} onClick={applyJson}>Apply definition</button><button className="og-button og-secondary" type="button" disabled={blocked || !fields.jsonDirty} onClick={() => change({...fields, json: fields.definition ? JSON.stringify(fields.definition, null, 2) : '', jsonDirty: false})}>Discard JSON changes</button></div>{fields.jsonDirty && <small>Unapplied JSON changes block publication. Apply or discard them first.</small>}</section> : <>
          <div className="og-strategy-template-grid" role="group" aria-label="Strategy templates">{templates.map(template => <button className="og-strategy-template" key={template.type} type="button" aria-label={`Use ${template.type} template`} aria-pressed={fields.definition?.entry.type === template.type} disabled={blocked || fields.programEnabled && template.type !== 'SIGNAL'} onClick={() => chooseTemplate(template.type)}><template.icon size={18}/><strong>{template.label}</strong><span>{template.detail}</span></button>)}</div>
          {fields.definition ? <DefinitionEditor fields={fields} disabled={blocked} onChange={change}/> : <p className="og-strategy-action-note">Choose a template to set its rules and conservative risk assumptions.</p>}
        </>}
        <div className="og-strategy-execution-boundary"><span>Demo only</span><span>Leverage 1×</span><span>Orders disabled</span><small>Authored rules and costs; no runner or signal connection.</small></div>
        <details open><summary>Assumptions &amp; evidence</summary><label>Assumptions<textarea aria-label="Strategy assumptions" rows={2} maxLength={1500} required value={fields.assumptions} disabled={blocked} onChange={event => change({...fields, assumptions: event.target.value})} placeholder="Data, execution and cost assumptions to test."/></label><label>What would reject it?<textarea aria-label="Strategy falsification" rows={2} maxLength={2000} required value={fields.falsification} disabled={blocked} onChange={event => change({...fields, falsification: event.target.value})} placeholder="Evidence that would make you reject this strategy."/></label>
          <small>Source classifications are author claims, not verification.</small>{fields.sources.map((source, index) => <div className="og-strategy-source-editor" key={index}><div className="og-strategy-source-editor-head">Source {index + 1}<button type="button" disabled={blocked} onClick={() => change({...fields, sources: fields.sources.filter((_, i) => i !== index)})}>Remove source {index + 1}</button></div><label>URL<input aria-label={`Source ${index + 1} URL`} maxLength={2048} value={source.url} disabled={blocked} onChange={event => change({...fields, sources: fields.sources.map((value, i) => i === index ? {...value, url: event.target.value} : value)})}/></label><label>Classification<select aria-label={`Source ${index + 1} classification`} value={source.classification} disabled={blocked} onChange={event => change({...fields, sources: fields.sources.map((value, i) => i === index ? {...value, classification: event.target.value as Content['sources'][number]['classification']} : value)})}>{Object.entries(sourceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Note<textarea aria-label={`Source ${index + 1} note`} maxLength={300} rows={2} value={source.note} disabled={blocked} onChange={event => change({...fields, sources: fields.sources.map((value, i) => i === index ? {...value, note: event.target.value} : value)})}/></label></div>)}<button className="og-button og-secondary" type="button" disabled={blocked || fields.sources.length >= 8} onClick={() => change({...fields, sources: [...fields.sources, {url: '', classification: 'PRIMARY', note: ''}]})}><Plus size={13}/>Add source</button>
        </details>
      </> : form.action === 'withdraw' ? <><p className="og-strategy-action-note">Remove this definition and its sources from public view. Its identity, attribution, digest and moderation metadata are retained. A revision does not remove previous versions.</p><label>Withdrawal reason<select aria-label="Withdrawal reason" value={fields.reason} disabled={blocked} onChange={event => change({...fields, reason: event.target.value})}><option value="AUTHOR_REQUEST">Author request</option><option value="SPONSOR_REQUEST">Sponsor request</option><option value="PERSONAL_DATA">Personal data</option><option value="CREDENTIAL_EXPOSURE">Credential exposure</option></select></label></> : <><label>Report reason<select aria-label="Report reason" value={fields.reason} disabled={blocked} onChange={event => change({...fields, reason: event.target.value})}><option value="SPAM">Spam</option><option value="ABUSE">Abuse</option><option value="PERSONAL_DATA">Personal data</option><option value="CREDENTIAL_EXPOSURE">Credential exposure</option><option value="MISLEADING">Misleading claim</option><option value="OTHER">Other</option></select></label><label>Private report details<textarea aria-label="Private report details" rows={4} maxLength={1500} value={fields.details} disabled={blocked} onChange={event => change({...fields, details: event.target.value})} placeholder="Describe the concern without credentials or unnecessary private information."/></label></>}
      <label className="og-strategy-consent"><input type="checkbox" aria-label="Accept public strategy policy" checked={fields.consent} disabled={blocked} onChange={event => change({...fields, consent: event.target.checked})}/><span>{form.action === 'publish' ? 'I accept that this definition, pseudonymous authorship and human sponsorship become public and are retained under public-strategy-v1. I will not include credentials or private information.' : form.action === 'report' ? 'I accept public-strategy-v1. This report is retained privately for moderation; I will not include credentials or unnecessary personal information.' : 'I accept public-strategy-v1. Withdrawal hides authored content while retaining attribution, digests and moderation metadata.'} <a href="/strategy-policy" target="_blank" rel="noopener noreferrer">Read policy</a>.</span></label><div className="og-dialog-actions"><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => close(renderFormId)}>Cancel</button><button className="og-button og-primary" type="submit" disabled={blocked || !loaded || loading || form.action === 'publish' && (fields.jsonDirty || fields.programEnabled && (!fields.program || fields.programDirty))}>{busy ? 'Submitting…' : form.action === 'publish' ? 'Publish definition' : form.action === 'withdraw' ? 'Withdraw content' : 'Send private report'}<ArrowRight size={15}/></button></div></form>}
    </DialogContent></Dialog>}
    {historyRoot && !form && <Dialog open={!!historyRoot} onOpenChange={next => { if (!next) closeHistory(renderHistoryId); }}><DialogContent className="og-dialog og-strategy-dialog"><DialogHeader><DialogTitle>Immutable strategy history</DialogTitle><DialogDescription>Exact definitions and retained moderation dispositions.</DialogDescription></DialogHeader>{historyError && <p className="og-message og-error" role="alert">{historyError}</p>}{history === null && !historyError ? <p role="status">Loading strategy history…</p> : <div className="og-strategy-list">{history?.map(card)}</div>}</DialogContent></Dialog>}
  </div>;
}

function StrategyCard({item, signedIn, blocked, own, sponsored, latest, onPublish, onWithdraw, onReport, onHistory, navigationBlocked}: {item: Item; signedIn: boolean; blocked: boolean; own: boolean; sponsored: boolean; latest: boolean; onPublish: (type: NonNullable<Content['relation']>['type']) => void; onWithdraw: () => void; onReport: () => void; onHistory: () => void; navigationBlocked: () => boolean}) {
  const record = item.record;
  const evidence = <a className="og-button og-secondary" aria-label={`Evidence strategy ${item.id}`} href={strategyEvidenceHref(item)} onClick={event => { if (navigationBlocked()) event.preventDefault(); }}>Evidence<ArrowRight size={12}/></a>;
  const lineage = <a className="og-button og-secondary" aria-label={`Lineage strategy ${item.id}`} href={strategyLineageHref({id:item.id,digest:item.digest})} onClick={event => {if (navigationBlocked()) event.preventDefault();}}>Forks &amp; revisions<GitFork size={12}/></a>;
  const attribution = <div className="og-strategy-attribution"><strong>{item.author.kind === 'HUMAN' ? 'Human' : 'Agent'} {shortId(item.author.id)}</strong><span>Human sponsor {shortId(item.author.sponsorId)}</span><span>v{item.revision}</span></div>;
  if (!record) return <article className="og-strategy-card og-strategy-tombstone" aria-label={`Strategy ${item.id}`}><div className="og-strategy-card-head"><span className="og-strategy-unverified">Untested</span><time dateTime={item.createdAt}>{stamp(item.createdAt)} Amsterdam</time></div><h3>{item.state === 'WITHDRAWN' ? 'Withdrawn strategy' : 'Hidden strategy'}</h3><p>Authored content is unavailable. Attribution and the immutable reference remain.</p>{attribution}<details><summary>Retained reference</summary><p className="og-strategy-provenance">ID {item.id}<br/>Root {item.rootId}<br/>Digest {item.digest}</p></details><div className="og-strategy-card-actions">{evidence}{lineage}<button className="og-button og-secondary" type="button" disabled={blocked && signedIn} onClick={onHistory}><History size={13}/>History</button>{signedIn && sponsored && item.state === 'HIDDEN' && <button className="og-button og-secondary" type="button" disabled={blocked} onClick={onWithdraw}>Withdraw</button>}</div></article>;
  const content = record.content, d = content.definition;
  return <article className="og-strategy-card" aria-label={`Strategy ${item.id}`}><div className="og-strategy-card-head"><div className="og-strategy-tags"><span className="og-strategy-kind">{record.version === 2 ? 'Program · CUSTOM signals' : templateLabel(d.entry.type)}</span><span className="og-strategy-unverified">Untested</span></div><time dateTime={record.createdAt}>{stamp(record.createdAt)} Amsterdam</time></div><h3>{content.name}</h3><p className="og-strategy-statement">{content.description}</p><div className="og-strategy-summary"><span>{d.market.symbol}</span><span>{d.market.timeframe}</span><span>{d.market.direction}</span><span>{d.risk.positionPct}% total allocation</span></div><dl className="og-strategy-costs"><div><dt>Fee / side</dt><dd>{d.costs.feeBps} bps</dd></div><div><dt>Slippage / side</dt><dd>{d.costs.slippageBps} bps</dd></div><div><dt>Exit assumptions</dt><dd>SL {d.risk.stopLossPct}% · TP {d.risk.takeProfitPct}%</dd></div></dl>{attribution}<details><summary>Rules, assumptions &amp; provenance</summary><h4>Definition</h4><pre className="og-strategy-definition">{JSON.stringify(d, null, 2)}</pre><p>Demo only · leverage 1 · orders disabled. These are authored rules and costs. Inspect retained evidence separately; the definition remains unqualified.</p>{record.version === 2 && <><h4>Exact program source</h4><pre className="og-strategy-definition">{JSON.stringify(record.content.program, null, 2)}</pre><p>Restricted numeric interpreter · causal completed-bar inputs · local admission required. Publication is inert.</p></>}<h4>Assumptions</h4><p>{content.assumptions}</p><h4>Rejection evidence</h4><p>{content.falsification}</p>{content.sources.length > 0 && <><h4>Sources</h4>{content.sources.map((source, index) => <div className="og-strategy-source" key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a><span>{sourceLabel[source.classification]} · author classification</span>{source.note && <p>{source.note}</p>}</div>)}</>}{content.relation && <><h4>Exact reference</h4><p className="og-strategy-provenance">{content.relation.type} · {content.relation.id}<br/>Digest {content.relation.digest}</p></>}<h4>Immutable identity</h4><p className="og-strategy-provenance">ID {item.id}<br/>Root {item.rootId}<br/>Digest {item.digest}</p><p>A digest checks content consistency. It does not establish an independently tested strategy.</p></details><div className="og-strategy-card-actions">{evidence}{lineage}{record.version === 2 ? <a className="og-button og-secondary" aria-label={`Program strategy ${item.id}`} href={programHref({id: item.id, digest: item.digest})} onClick={event => { if (navigationBlocked()) event.preventDefault(); }}><Braces size={13}/>Program replay</a> : <><a className="og-button og-secondary" aria-label={`Replay strategy ${item.id}`} href={strategyHandoffHref('/demo', {id: item.id, digest: item.digest})}><FlaskConical size={13}/>Try Demo</a><a className="og-button og-secondary" aria-label={`Session strategy ${item.id}`} href={strategyHandoffHref('/session', {id: item.id, digest: item.digest})}><Radio size={13}/>Open Session</a></>}<button className="og-button og-secondary" type="button" disabled={blocked && signedIn} onClick={onHistory}><History size={13}/>History</button>{signedIn && <><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => onPublish('FORK')}><GitFork size={13}/>Fork</button>{own && <button className="og-button og-secondary" type="button" disabled={blocked || !latest} onClick={() => onPublish('REVISION')}>Revise</button>}{sponsored && <button className="og-button og-secondary" type="button" disabled={blocked} onClick={onWithdraw}>Withdraw</button>}<button className="og-report-button" type="button" disabled={blocked} onClick={onReport}>Report</button></>}</div></article>;
}

function DefinitionEditor({fields, disabled, onChange}: {fields: Fields; disabled: boolean; onChange: (fields: Fields) => void}) {
  const d = fields.definition!;
  function update(next: Definition, numberDrafts = fields.numberDrafts) { onChange({...fields, definition: next, json: JSON.stringify(next, null, 2), jsonDirty: false, numberDrafts}); }
  function withoutCondition(index: number) {
    const drafts: {[key: string]: string} = {};
    for (const [key, value] of Object.entries(fields.numberDrafts)) {
      const match = /^(rulePeriod|ruleThreshold)(\d+)$/.exec(key);
      if (!match) drafts[key] = value;
      else if (Number(match[2]) !== index) drafts[match[1] + (Number(match[2]) > index ? Number(match[2]) - 1 : Number(match[2]))] = value;
    }
    return drafts;
  }
  function numeric(key: string, value: number, label: string, minimum: number, maximum: number, apply: (definition: Definition, value: number) => void, step: number | 'any' = 1) {
    return <label>{label}<input aria-label={label} type="number" min={minimum} max={maximum} step={step} value={fields.numberDrafts[key] ?? value} disabled={disabled} onChange={event => {const next = structuredClone(d); const raw = event.target.value; apply(next, raw.trim() ? Number(raw) : NaN); update(next, {...fields.numberDrafts, [key]: raw});}}/></label>;
  }
  function entryNumber(key: string, value: number, label: string, minimum: number, maximum: number, property: string, step: number | 'any' = 1) { return numeric(key, value, label, minimum, maximum, (next, amount) => {Object.assign(next.entry, {[property]: amount});}, step); }
  const entry = d.entry;
  return <div className="og-strategy-guided">
    <div className="og-strategy-field-grid"><label>Market<input aria-label="Market symbol" maxLength={40} value={d.market.symbol} disabled={disabled} onChange={event => update({...d, market: {...d.market, symbol: event.target.value}})} placeholder="BTC/USDT"/></label><label>Timeframe<select aria-label="Timeframe" value={d.market.timeframe} disabled={disabled} onChange={event => update({...d, market: {...d.market, timeframe: event.target.value as Definition['market']['timeframe']}})}>{['5m', '15m', '1h', '4h', '1d'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Direction<select aria-label="Direction" value={d.market.direction} disabled={disabled} onChange={event => {const next = structuredClone(d); next.market.direction = event.target.value as Definition['market']['direction']; if (next.entry.type === 'SIGNAL') next.entry.event = next.market.direction === 'LONG' ? 'BULLISH' : 'BEARISH'; update(next);}}><option value="LONG">Long</option><option value="SHORT">Short</option></select></label></div>
    <section className="og-strategy-parameters"><h4>{templateLabel(entry.type)} rules</h4><div className="og-strategy-field-grid">
      {entry.type === 'TREND' && <>{entryNumber('fastPeriod', entry.fastPeriod, 'Fast SMA period', 2, 100, 'fastPeriod')}{entryNumber('slowPeriod', entry.slowPeriod, 'Slow SMA period', 3, 300, 'slowPeriod')}<label>Confirmation<select aria-label="Trend confirmation" value={entry.confirmation} disabled={disabled} onChange={event => update({...d, entry: {...entry, confirmation: event.target.value as typeof entry.confirmation}})}><option value="CROSS">Directional crossover</option><option value="ALIGNED">Directionally aligned averages</option></select></label></>}
      {entry.type === 'RSI' && <>{entryNumber('rsiPeriod', entry.period, 'RSI period', 2, 100, 'period')}{entryNumber('rsiThreshold', entry.threshold, 'RSI threshold', 1, 99, 'threshold')}<label>Condition<select aria-label="RSI comparison" value={entry.comparison} disabled={disabled} onChange={event => update({...d, entry: {...entry, comparison: event.target.value as typeof entry.comparison}})}><option value="BELOW">Below threshold</option><option value="ABOVE">Above threshold</option></select></label></>}
      {entry.type === 'BREAKOUT' && entryNumber('breakoutLookback', entry.lookback, 'Range lookback bars', 2, 300, 'lookback')}
      {entry.type === 'DCA' && <>{entryNumber('dcaInterval', entry.intervalBars, 'Entry interval bars', 1, 500, 'intervalBars')}{entryNumber('dcaEntries', entry.maxEntries, 'Maximum DCA entries', 1, 10, 'maxEntries')}</>}
      {entry.type === 'GRID' && <>{entryNumber('gridLower', entry.lowerPrice, 'Grid lower price', 0.000001, 1e9, 'lowerPrice', 'any')}{entryNumber('gridUpper', entry.upperPrice, 'Grid upper price', 0.000001, 1e9, 'upperPrice', 'any')}{entryNumber('gridLevels', entry.levels, 'Grid levels', 2, 30, 'levels')}</>}
      {entry.type === 'SIGNAL' && <><label>Provider assumption<select aria-label="Signal provider" value={entry.provider} disabled={disabled || fields.programEnabled} onChange={event => update({...d, entry: {...entry, provider: event.target.value as typeof entry.provider}})}><option value="ALTFINS">altFINS</option><option value="TRADINGVIEW">TradingView</option><option value="CUSTOM">Custom</option></select></label><label>Event<input aria-label="Signal event" readOnly disabled value={entry.event === 'BULLISH' ? 'Bullish · long' : 'Bearish · short'}/></label>{fields.programEnabled ? <label>Maximum signal age bars<input aria-label="Maximum signal age bars" readOnly disabled value={1}/></label> : entryNumber('signalAge', entry.maxAgeBars, 'Maximum signal age bars', 1, 50, 'maxAgeBars')}</>}
    </div>
    {entry.type === 'GRID' && <p className="og-strategy-builder-note">Price bounds are illustrative authored inputs, not current quotes. The total allocation is partitioned across grid levels.</p>}
    {entry.type === 'DCA' && <p className="og-strategy-builder-note">DCA entries partition the total allocation; they do not authorize extra capital.</p>}
    {entry.type === 'SIGNAL' && <p className="og-strategy-builder-note">Provider and event are authored assumptions. No signal source or webhook receiver is connected by publishing.</p>}
    {entry.type === 'RULES' && <div className="og-strategy-custom-rules"><label>Match conditions<select aria-label="Rule match" value={entry.match} disabled={disabled} onChange={event => update({...d, entry: {...entry, match: event.target.value as typeof entry.match}})}><option value="ALL">All conditions</option><option value="ANY">Any condition</option></select></label>{entry.conditions.map((condition, index) => <div className="og-strategy-rule-row" key={index}><div className="og-strategy-source-editor-head">Condition {index + 1}<button type="button" disabled={disabled || entry.conditions.length <= 1} onClick={() => update({...d, entry: {...entry, conditions: entry.conditions.filter((_, i) => i !== index)}}, withoutCondition(index))}>Remove condition {index + 1}</button></div><div className="og-strategy-field-grid"><label>Indicator<select aria-label={`Condition ${index + 1} indicator`} value={condition.indicator} disabled={disabled} onChange={event => update({...d, entry: {...entry, conditions: entry.conditions.map((value, i) => i === index ? {...value, indicator: event.target.value as typeof condition.indicator} : value)}})}><option value="PRICE_SMA">Close / SMA</option><option value="RSI">RSI</option><option value="RETURN">Return</option></select></label>{numeric(`rulePeriod${index}`, condition.period, `Condition ${index + 1} period`, 2, 300, (next, value) => {if (next.entry.type === 'RULES') next.entry.conditions[index].period = value;})}<label>Comparison<select aria-label={`Condition ${index + 1} comparison`} value={condition.comparison} disabled={disabled} onChange={event => update({...d, entry: {...entry, conditions: entry.conditions.map((value, i) => i === index ? {...value, comparison: event.target.value as typeof condition.comparison} : value)}})}><option value="GT">Greater than</option><option value="LT">Less than</option><option value="CROSSES_ABOVE">Crosses above</option><option value="CROSSES_BELOW">Crosses below</option></select></label>{numeric(`ruleThreshold${index}`, condition.threshold, `Condition ${index + 1} threshold`, -100, 1e6, (next, value) => {if (next.entry.type === 'RULES') next.entry.conditions[index].threshold = value;}, 'any')}</div></div>)}<button className="og-button og-secondary" type="button" disabled={disabled || entry.conditions.length >= 8} onClick={() => update({...d, entry: {...entry, conditions: [...entry.conditions, {indicator: 'PRICE_SMA', period: 20, comparison: 'GT', threshold: 1}]}})}>Add condition<Plus size={13}/></button><p className="og-strategy-builder-note">Thresholds are authored numeric inputs. Intended indicator meanings still require a qualified evaluator; this Hub runs no rules.</p></div>}
    </section>
    <details className="og-strategy-risk-controls" open><summary>Risk &amp; cost assumptions</summary><div className="og-strategy-field-grid">
      {numeric('allocation', d.risk.positionPct, 'Total allocation %', 0.1, 10, (next, value) => {next.risk.positionPct = value;}, 0.1)}
      {numeric('positions', d.risk.maxOpenPositions, 'Maximum open positions', 1, 5, (next, value) => {next.risk.maxOpenPositions = value;})}
      {numeric('stop', d.risk.stopLossPct, 'Stop loss %', 0.1, 20, (next, value) => {next.risk.stopLossPct = value;}, 0.1)}
      {numeric('target', d.risk.takeProfitPct, 'Take profit %', 0.1, 100, (next, value) => {next.risk.takeProfitPct = value;}, 0.1)}
      {numeric('daily', d.risk.maxDailyLossPct, 'Maximum daily loss %', 0.1, 5, (next, value) => {next.risk.maxDailyLossPct = value;}, 0.1)}
      {numeric('fees', d.costs.feeBps, 'Fee per side bps', 0, 100, (next, value) => {next.costs.feeBps = value;})}
      {numeric('slippage', d.costs.slippageBps, 'Slippage per side bps', 0, 200, (next, value) => {next.costs.slippageBps = value;})}
    </div><small>100 bps = 1%. Fees and slippage are proposed per-side costs. Risk assumptions are not runtime controls in this Hub.</small></details>
  </div>;
}
