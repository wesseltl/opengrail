'use client';

import {useEffect, useRef, useState} from 'react';
import {parseUniqueJson} from './unique-json';
import {experimentDigest, experimentGetSchema, validateExperimentItem, type ExperimentPublicItem} from './experiment-model';
import {boundedStrategyRecord, strategyGetSchema} from './strategy-model';
import {experimentHref, type ExperimentSelection} from './experiment-link';
import {strategyEvidenceHref} from './strategy-evidence-model';
import {boundedExperimentReviewCommand, experimentReviewContent, experimentReviewGetSchema, experimentReviewLimits, experimentReviewListSchema, experimentReviewMeSchema, experimentReviewReasons, experimentReviewReportsSchema, experimentReviewSharedDependencies, experimentReviewWriteSchema, validateExperimentReviewBindings, validateExperimentReviewItem, verifyExperimentReviewDraft, type ExperimentReviewCommand, type ExperimentReviewPublishCommand, type ExperimentReviewPublicItem, type ExperimentReviewReferences, type ExperimentReviewSummary, type LocalExperimentReviewDraft} from './experiment-review-model';

type Item = ExperimentReviewPublicItem;
type Summary = ExperimentReviewSummary;
type Me = ReturnType<typeof experimentReviewMeSchema.parse>;
type Receipt = ReturnType<typeof experimentReviewWriteSchema.parse>;
type Mode = 'review' | 'withdraw' | 'report' | 'moderate';
type Fields = {json: string; draft: LocalExperimentReviewDraft | null; holdTarget: ExperimentReviewPublishCommand['target'] | null; peerId: string; peerDigest: string; decision: ExperimentReviewPublishCommand['decision']; reasons: ExperimentReviewPublishCommand['reasons']; attestations: ExperimentReviewPublishCommand['attestations']; conflicts: string; note: string; reason: string; state: 'VISIBLE' | 'HIDDEN'; rights: boolean; share: boolean; consent: boolean};
type Pending = {command: ExperimentReviewCommand; body: string; author: Me; target: Item | null; submitted: boolean; expectedSequence: number | null};
const blank = (): Fields => ({json: '', draft: null, holdTarget: null, peerId: '', peerDigest: '', decision: 'HELD', reasons: [], attestations: {fixedCode: false, exactInputs: false, inspectedDifferences: false, separateOriginalAndReproductionProcesses: false}, conflicts: '', note: '', reason: 'OTHER', state: 'HIDDEN', rights: false, share: false, consent: false});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ref = (item: {id: string; digest: string}) => ({id: item.id, digest: item.digest});
const before = (item: {id: string; createdAt: string}, anchor: {id: string; createdAt: string}) => item.createdAt < anchor.createdAt || item.createdAt === anchor.createdAt && item.id < anchor.id;
const summarize = (item: Item): Summary => { const {record, moderation: _moderation, ...metadata} = item; return {...metadata, reasons: record?.content.reasons ?? []}; };
const policy = 'public-experiment-review-v1' as const;

async function read(response: Response, cap = 1_048_576): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw Error('Missing response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > cap) { await reader.cancel(); throw Error('Byte budget exceeded.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let position = 0; for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), cap, 16);
}
export function experimentReviewHref(original: ExperimentSelection, review: ExperimentSelection) {
  return experimentHref(original) + '&review=' + review.id + '&reviewDigest=' + review.digest;
}
function matches(pending: Pending, receipt: Receipt) {
  const command = pending.command, item = receipt.item;
  if (receipt.action !== command.action || receipt.requestId !== command.requestId) return false;
  if (command.action === 'report') return !item && receipt.report?.requestId === command.requestId && receipt.report.id === command.id && receipt.report.digest === command.digest && receipt.report.reason === command.reason;
  if (!item || item.id !== command.id) return false;
  if (command.action === 'review') {
    if (item.sequence !== pending.expectedSequence || item.requestId !== command.requestId || !same(item.author, {kind: 'HUMAN', id: pending.author.authorId, sponsorId: pending.author.sponsorId}) || !same(item.target, command.target) || !same(item.previous, command.previous)) return false;
    return !item.record ? item.state !== 'VISIBLE' : item.record.version === 1 && same(item.record.content, experimentReviewContent(command));
  }
  const target = pending.target, event = item.moderation.at(-1);
  if (!target || item.digest !== command.digest || item.requestId !== target.requestId || item.createdAt !== target.createdAt || item.sequence !== target.sequence || !same(item.target, target.target) || !same(item.previous, target.previous) || !same(item.author, target.author) || !same(item.moderation.slice(0, target.moderation.length), target.moderation) || !event || event.requestId !== command.requestId || !same(event.actor, {kind: 'HUMAN', id: pending.author.authorId, sponsorId: pending.author.sponsorId}) || event.reason !== command.reason) return false;
  return command.action === 'withdraw' ? item.state === 'WITHDRAWN' && !item.record && event.state === 'WITHDRAWN' : event.state === command.state && (command.state !== 'VISIBLE' || !item.record || !target.record || same(item.record, target.record));
}

/** Separately authorized human review. Importing a report never grants execution or review authority. */
export default function ExperimentReviews({original: supplied, signedIn, blocked = false, onBusyChange, onUnavailable, exactReview = null}: {original: ExperimentPublicItem; signedIn: boolean; blocked?: boolean; onBusyChange: (busy: boolean) => void; onUnavailable: () => void; exactReview?: ExperimentSelection | null}) {
  const [original, setOriginal] = useState<ExperimentPublicItem | null>(null), [items, setItems] = useState<Summary[]>([]), [cursor, setCursor] = useState<string | null>(null), [page, setPage] = useState<string | null>(null), [selected, setSelected] = useState<Item | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [me, setMe] = useState<Me | null>(null), [authLost, setAuthLost] = useState(false), [mode, setMode] = useState<Mode | null>(null), [fields, setFields] = useState(blank), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [reports, setReports] = useState<ReturnType<typeof experimentReviewReportsSchema.parse> | null>(null);
  const runtime = useRef({alive: true, signedIn, blocked, denied: false, epoch: 0, readId: 0, identityId: 0, workId: 0, mutationId: 0, locked: false, unavailable: false, pending: null as Pending | null, reads: new Set<AbortController>(), known: new Map<string, Item>(), suppressed: new Set<string>(), withdrawn: new Set<string>()});
  runtime.current.signedIn = signedIn; runtime.current.blocked = blocked;
  const current = useRef({original, items, selected, me, mode, fields, receipt}); current.current = {original, items, selected, me, mode, fields, receipt};
  const callbacks = useRef({onBusyChange, onUnavailable}); callbacks.current = {onBusyChange, onUnavailable};
  const renderEpoch = runtime.current.epoch, renderFields = fields, renderMode = mode, renderPending = runtime.current.pending;
  const disabled = blocked || busy || uncertain || runtime.current.unavailable;
  const root = original ?? supplied, signIn = '/signin-with-chatgpt?return_to=' + encodeURIComponent(selected ? experimentReviewHref(root, selected) : exactReview ? experimentReviewHref(root, exactReview) : experimentHref(root));
  function privateAllowed() { const state = runtime.current; return state.alive && state.signedIn && !state.denied && !!current.current.me; }
  function erasePending() { const pending = runtime.current.pending; if (pending) { pending.body = ''; if (pending.command.action === 'review') pending.command.evidence = null; } runtime.current.pending = null; }
  function clearPrivate() {
    const state = runtime.current, hadPrivate = !!current.current.me || !!current.current.mode || !!state.pending; state.denied = true; state.identityId++; state.mutationId++; state.epoch++; state.workId++; state.locked = false; erasePending(); current.current.me = null; current.current.mode = null; current.current.fields = blank(); current.current.receipt = null;
    setMe(null); setMode(null); setFields(blank()); setReceipt(null); setBusy(false); setUncertain(false); setReports(null); setAuthLost(hadPrivate || state.signedIn); callbacks.current.onBusyChange(false);
  }
  function suppressDependencies() {
    const state = runtime.current; if (state.unavailable) return; state.unavailable = true; state.epoch++; state.readId++; state.reads.forEach(controller => controller.abort()); state.reads.clear();
    const scrub = (item: Summary): Summary => ({...item, state: item.state === 'WITHDRAWN' ? 'WITHDRAWN' : 'HIDDEN', suppression: item.suppression ?? 'OUTCOME_UNAVAILABLE', decision: null, reasons: []});
    current.current.items = current.current.items.map(scrub); setItems(current.current.items);
    if (current.current.selected) { const item = current.current.selected; current.current.selected = {...item, ...scrub(summarize(item)), record: null}; setSelected(current.current.selected); }
    for (const [id, item] of state.known) state.known.set(id, {...item, ...scrub(summarize(item)), record: null});
    if (current.current.original) { current.current.original = {...current.current.original, state: current.current.original.state === 'WITHDRAWN' ? 'WITHDRAWN' : 'HIDDEN', suppression: current.current.original.suppression ?? 'PARENT_UNAVAILABLE', record: null}; setOriginal(current.current.original); }
    if (state.pending?.target) state.pending.target = {...state.pending.target, record: null};
    if (state.pending?.submitted) setUncertain(true);
    const next = blank(); current.current.fields = next; setFields(next); current.current.receipt = null; setReceipt(null); setReports(null); setError('Referenced content is unavailable. Reports, notes and local draft evidence were cleared. A new exact-page read is required after restoration.');
    callbacks.current.onUnavailable();
  }
  // Keep a history floor; explicit refresh can accept a newer restoration, never an older snapshot.
  function reconcile(item: Item, fresh = false): Item {
    const state = runtime.current, known = state.known.get(item.id);
    if (known) {
      const identity = (row: Item) => ({id: row.id, digest: row.digest, requestId: row.requestId, createdAt: row.createdAt, author: row.author, sequence: row.sequence, target: row.target, previous: row.previous});
      if (!same(identity(known), identity(item))) throw Error('Conflicting review identity.');
      if (item.moderation.length < known.moderation.length && same(known.moderation.slice(0, item.moderation.length), item.moderation)) return known;
      if (!same(item.moderation.slice(0, known.moderation.length), known.moderation)) throw Error('Conflicting review history.');
      if (known.state === 'WITHDRAWN') return known;
      if (!known.record && item.record && (!fresh || item.moderation.length <= known.moderation.length || item.moderation.at(-1)?.reason !== 'RESTORED')) return known;
    }
    if (item.record && state.suppressed.has(item.id) && !(fresh && !state.withdrawn.has(item.id) && item.moderation.at(-1)?.reason === 'RESTORED' && (!known || item.moderation.length > known.moderation.length))) return known && !known.record ? known : {...item, state: 'HIDDEN', decision: null, record: null};
    if (!item.record) { state.suppressed.add(item.id); if (item.state === 'WITHDRAWN') state.withdrawn.add(item.id); } else if (fresh) state.suppressed.delete(item.id);
    const projected = state.unavailable ? {...item, state: item.state === 'WITHDRAWN' ? 'WITHDRAWN' as const : 'HIDDEN' as const, suppression: item.suppression ?? 'OUTCOME_UNAVAILABLE' as const, decision: null, record: null} : item;
    state.known.set(projected.id, projected);
    current.current.items = current.current.items.map(row => row.id === projected.id ? summarize(projected) : row); setItems(current.current.items);
    if (current.current.selected?.id === projected.id) { current.current.selected = projected; setSelected(projected); }
    if (current.current.receipt?.item?.id === projected.id) { current.current.receipt = {...current.current.receipt, item: projected}; setReceipt(current.current.receipt); }
    if (!projected.record && state.pending?.target?.id === projected.id) state.pending.target = {...state.pending.target, record: null};
    if (!projected.record && !state.pending && current.current.mode) { current.current.fields = blank(); setFields(blank()); }
    return projected;
  }
  async function fetchExperiment(reference: ExperimentSelection, signal: AbortSignal) {
    const response = await fetch('/api/experiments?id=' + reference.id, {cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)])}); if (!response.ok) throw Error('Referenced outcome unavailable.');
    const item = await validateExperimentItem(experimentGetSchema.parse(await read(response)).item);
    if (!same(ref(item), reference)) throw Error('Wrong immutable experiment.');
    if (!item.record) { suppressDependencies(); throw Error('Referenced content unavailable.'); }
    return item;
  }
  async function references(target: ExperimentReviewPublishCommand['target'], signal: AbortSignal): Promise<ExperimentReviewReferences> {
    const results = await Promise.allSettled([fetchExperiment(target.original, signal), fetchExperiment(target.reproduction, signal), fetchExperiment(target.manifest, signal), (async () => {
      const response = await fetch('/api/strategies?id=' + target.strategy.id, {cache: 'no-store', signal}); if (!response.ok) throw Error('Source unavailable.');
      const item = strategyGetSchema.parse(await read(response)).item;
      if (!same(ref(item), target.strategy)) throw Error('Wrong immutable strategy.');
      if (!item.record || item.state !== 'VISIBLE') { suppressDependencies(); throw Error('Source unavailable.'); }
      if (await experimentDigest(boundedStrategyRecord(item.record).payload) !== item.digest) throw Error('Wrong strategy digest.'); return item;
    })()]);
    const failure = results.find(result => result.status === 'rejected'); if (failure?.status === 'rejected') throw failure.reason;
    return {original: (results[0] as PromiseFulfilledResult<ExperimentPublicItem>).value, reproduction: (results[1] as PromiseFulfilledResult<ExperimentPublicItem>).value, manifest: (results[2] as PromiseFulfilledResult<ExperimentPublicItem>).value, strategy: (results[3] as PromiseFulfilledResult<ExperimentReviewReferences['strategy']>).value};
  }
  useEffect(() => {
    const state = runtime.current; state.alive = true; void initialize();
    return () => { state.alive = false; state.epoch++; state.readId++; state.workId++; state.reads.forEach(controller => controller.abort()); erasePending(); state.known.clear(); current.current.fields = blank(); current.current.me = null; callbacks.current.onBusyChange(false); };
  }, []);
  useEffect(() => { if (!signedIn) clearPrivate(); else { runtime.current.denied = false; setAuthLost(false); void loadIdentity(); } }, [signedIn]);
  useEffect(() => { if (!supplied.record && !runtime.current.unavailable) suppressDependencies(); }, [supplied.state, supplied.suppression]);
  useEffect(() => { callbacks.current.onBusyChange(!!mode || busy || uncertain); }, [mode, busy, uncertain]);
  async function loadIdentity() {
    const state = runtime.current; if (!state.alive || !state.signedIn || state.denied) return;
    const epoch = state.epoch, identityId = ++state.identityId;
    try {
      const response = await fetch('/api/experiments/reviews/me', {cache: 'no-store', signal: AbortSignal.timeout(15_000)});
      if (!state.alive || epoch !== state.epoch || identityId !== state.identityId || !state.signedIn) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; } if (!response.ok) throw Error('Review permissions unavailable.');
      const next = experimentReviewMeSchema.parse(await read(response, 4096)); if (!state.alive || epoch !== state.epoch || identityId !== state.identityId || state.denied) return;
      const previous = state.pending?.author ?? current.current.me;
      if (previous && (previous.authorId !== next.authorId || previous.sponsorId !== next.sponsorId)) { clearPrivate(); return; }
      if (state.pending?.command.action === 'review' && !next.reviewer || state.pending?.command.action === 'moderate' && !next.moderator) { clearPrivate(); return; }
      current.current.me = next; setMe(next);
    } catch { if (state.alive && epoch === state.epoch && identityId === state.identityId) setError('Review permissions unavailable. Public reading remains available.'); }
  }
  async function initialize() {
    const state = runtime.current, id = ++state.readId, controller = new AbortController(); state.reads.add(controller); setLoading(true);
    try {
      if (!supplied.record || supplied.record.type !== 'OUTCOME') throw Error('Outcome unavailable.');
      const relation = supplied.record.content.claim.relation, target = relation ? await fetchExperiment(ref(relation), controller.signal) : supplied;
      if (target.type !== 'OUTCOME' || !same(target.manifest, supplied.manifest) || !same(target.strategy, supplied.strategy)) throw Error('Wrong original outcome.');
      if (!state.alive || id !== state.readId || controller.signal.aborted) return;
      current.current.original = target; setOriginal(target); setLoading(false); await load(null, target);
      if (exactReview && state.alive && !state.unavailable) await choose(exactReview, true);
    } catch { if (state.alive && id === state.readId && !controller.signal.aborted && !state.unavailable) setError('Exact original outcome unavailable. No other outcome was substituted.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.readId) setLoading(false); }
  }
  async function pageRead(target: ExperimentPublicItem, next: string | null, signal: AbortSignal, anchor: Summary | null) {
    const response = await fetch('/api/experiments/reviews?outcome=' + target.id + '&digest=' + target.digest + (next ? '&cursor=' + next : ''), {cache: 'no-store', signal});
    if (!response.ok) throw Error('Review history unavailable.'); const value = experimentReviewListSchema.parse(await read(response));
    if (!same(value.target, ref(target)) || next && (!anchor || value.nextCursor === next || value.items.some(item => item.id === next || !before(item, anchor)))) throw Error('Wrong review page.');
    return value;
  }
  async function load(next: string | null = null, target = current.current.original) {
    const state = runtime.current; if (!state.alive || state.locked || state.pending || current.current.mode || state.blocked || !target || state.unavailable) return;
    const anchor = next ? current.current.items.find(item => item.id === next) ?? null : null, id = ++state.readId, controller = new AbortController(); state.reads.add(controller); setLoading(true); setError('');
    try {
      const value = await pageRead(target, next, controller.signal, anchor);
      if (!state.alive || id !== state.readId || controller.signal.aborted || state.pending || current.current.mode) return;
      // Summary suppression is observed before opening any full record. It cannot re-expose a known tombstone.
      const projected = value.items.map(item => { const known = state.known.get(item.id); return known && !known.record ? summarize(known) : state.suppressed.has(item.id) && item.state === 'VISIBLE' ? {...item, state: 'HIDDEN' as const, decision: null, reasons: []} : item; });
      if (value.items.some(item => item.suppression)) { suppressDependencies(); return; }
      const suppressedRows = value.items.filter(item => item.state !== 'VISIBLE');
      // Scrub observed summaries immediately, but install moderation floors only from exact full tombstones.
      for (const item of suppressedRows) {
        state.suppressed.add(item.id); if (item.state === 'WITHDRAWN') state.withdrawn.add(item.id);
        const known = state.known.get(item.id); if (known) state.known.set(item.id, {...known, state: 'HIDDEN', decision: null, record: null});
        if (current.current.selected?.id === item.id) { const previous = current.current.selected; current.current.selected = {...previous, state: item.state, reason: item.reason, suppression: item.suppression, decision: null, record: null}; setSelected(current.current.selected); }
        if (current.current.receipt?.item?.id === item.id) { current.current.receipt = null; setReceipt(null); }
      }
      const full = await Promise.allSettled(suppressedRows.map(async row => {
        const response = await fetch('/api/experiments/reviews?id=' + row.id + '&digest=' + row.digest, {cache: 'no-store', signal: controller.signal});
        if (!response.ok) throw Error('Suppression confirmation unavailable.');
        const item = await validateExperimentReviewItem(experimentReviewGetSchema.parse(await read(response)).item);
        if (!same(summarize(item), row)) throw Error('Conflicting suppressed summary.'); return item;
      }));
      if (!state.alive || id !== state.readId || controller.signal.aborted) return;
      if (full.some(result => result.status === 'rejected')) throw Error('Suppression confirmation failed.');
      for (const result of full) if (result.status === 'fulfilled') reconcile(result.value);
      current.current.items = projected.map(row => { const known = state.known.get(row.id); return known && !known.record ? summarize(known) : row; }); setItems(current.current.items); setCursor(value.nextCursor); setPage(next);
    } catch { if (state.alive && id === state.readId && !controller.signal.aborted && !state.unavailable) setError('Review history unavailable or inconsistent. No review page was accepted.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.readId) setLoading(false); }
  }
  async function choose(reference: ExperimentSelection, fresh = false) {
    const state = runtime.current, target = current.current.original; if (!state.alive || state.blocked || state.locked || state.pending || current.current.mode || !target || state.unavailable) return;
    const id = ++state.readId, controller = new AbortController(); state.reads.add(controller); setLoading(true); setError('');
    try {
      const response = await fetch('/api/experiments/reviews?id=' + reference.id + '&digest=' + reference.digest, {cache: 'no-store', signal: controller.signal}); if (!response.ok) throw Error('Review unavailable.');
      const item = await validateExperimentReviewItem(experimentReviewGetSchema.parse(await read(response)).item);
      if (!same(ref(item), reference) || !same(item.target.original, ref(target))) throw Error('Wrong exact review.');
      if (item.record) await validateExperimentReviewBindings({...experimentReviewCommand(item), policyAccepted: policy}, await references(item.target, controller.signal), item.author, item.createdAt);
      if (!state.alive || id !== state.readId || controller.signal.aborted || state.pending || current.current.mode) return;
      const projected = reconcile(item, fresh); current.current.selected = projected; setSelected(projected);
      if (item.suppression) suppressDependencies();
    } catch { if (state.alive && id === state.readId && !controller.signal.aborted && !state.unavailable) setError('Exact review unavailable or inconsistent. Reports and notes were not accepted.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.readId) setLoading(false); }
  }
  function open(action: Mode) {
    const state = runtime.current, author = current.current.me, target = current.current.selected;
    if (!privateAllowed() || state.blocked || state.locked || state.pending || current.current.mode || state.epoch !== renderEpoch || loading) return;
    if (action === 'review' && (!author?.reviewer || !current.current.original?.record || state.unavailable)) return;
    if (action !== 'review' && !target) return;
    if (action === 'withdraw' && (target!.state === 'WITHDRAWN' || target!.author.sponsorId !== author!.sponsorId)) return;
    if (action === 'moderate' && !author?.moderator || action === 'report' && !target?.record) return;
    state.epoch++; state.readId++; state.reads.forEach(controller => controller.abort()); state.reads.clear();
    const next = blank(); if (action === 'review' && current.current.original?.record?.version === 2) { next.decision = 'HELD'; next.reasons = ['UNSUPPORTED_METHOD']; } if (action === 'withdraw') next.reason = 'AUTHOR_REQUEST'; if (action === 'moderate') { next.state = target?.state === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN'; next.reason = next.state === 'VISIBLE' ? 'RESTORED' : 'POLICY'; }
    current.current.mode = action; current.current.fields = next; current.current.receipt = null; setMode(action); setFields(next); setReceipt(null); setError(''); callbacks.current.onBusyChange(true);
  }
  function change(changes: Partial<Fields>, material = true) {
    const state = runtime.current; if (!privateAllowed() || state.locked || state.pending || state.epoch !== renderEpoch || current.current.fields !== renderFields || current.current.mode !== renderMode || current.current.receipt) return;
    if (material) state.workId++;
    const next = {...fields, ...(material ? {rights: false, share: false, consent: false} : {}), ...changes};
    if ('json' in changes) next.draft = null; if ('peerId' in changes || 'peerDigest' in changes) next.holdTarget = null;
    current.current.fields = next; setFields(next); setError('');
  }
  async function importDraft() {
    const state = runtime.current; if (!privateAllowed() || state.locked || state.pending || current.current.mode !== 'review' || current.current.fields !== fields || state.unavailable) return;
    const epoch = state.epoch, id = ++state.workId; state.locked = true; setBusy(true); setError('');
    try {
      const draft = await verifyExperimentReviewDraft(parseUniqueJson(fields.json, experimentReviewLimits.requestBytes, 16));
      if (!same(draft.target.original, ref(current.current.original!))) throw Error('Wrong original.');
      // An adverse draft is held by default. The reviewer must choose and attest every disposition.
      const command: ExperimentReviewPublishCommand = {action: 'review' as const, id: crypto.randomUUID(), requestId: crypto.randomUUID(), target: draft.target, previous: null, decision: 'HELD' as const, reasons: ['INCOMPLETE_EVIDENCE' as const], evidence: draft.evidence, attestations: blank().attestations, sharedDependencies: [...experimentReviewSharedDependencies], otherConflicts: '', note: 'Imported evidence pending human review.', policyAccepted: policy};
      await validateExperimentReviewBindings(command, await references(draft.target, AbortSignal.timeout(15_000)), {kind: 'HUMAN', id: current.current.me!.authorId, sponsorId: current.current.me!.sponsorId});
      if (!state.alive || epoch !== state.epoch || id !== state.workId || !privateAllowed() || state.unavailable) return;
      const next = {...blank(), draft, json: '', reasons: ['INCOMPLETE_EVIDENCE' as const]}; current.current.fields = next; setFields(next);
    } catch { if (state.alive && epoch === state.epoch && !state.unavailable) setError('Draft rejected. Use a complete bounded paired review draft whose reports bind both exact retained outcomes.'); }
    finally { if (state.alive && id === state.workId) { state.locked = false; setBusy(false); } }
  }
  async function checkContinuousHold() {
    const state = runtime.current, target = current.current.original;
    if (!privateAllowed() || state.locked || state.pending || current.current.mode !== 'review' || target?.record?.version !== 2 || target.type !== 'OUTCOME' || !target.manifest || fields !== current.current.fields) return;
    const epoch = state.epoch, workId = ++state.workId; state.locked = true; setBusy(true); setError('');
    try {
      const referencesTarget = {original: ref(target), reproduction: {id: fields.peerId, digest: fields.peerDigest}, manifest: target.manifest, strategy: target.strategy};
      const checked = boundedExperimentReviewCommand({action: 'review', id: crypto.randomUUID(), requestId: crypto.randomUUID(), target: referencesTarget, previous: null, decision: 'HELD', reasons: ['UNSUPPORTED_METHOD'], evidence: null, attestations: blank().attestations, sharedDependencies: [...experimentReviewSharedDependencies], otherConflicts: '', note: 'Unsupported continuous method pending explicit human note.', policyAccepted: policy});
      if (checked.command.action !== 'review') throw Error('Wrong command.');
      await validateExperimentReviewBindings(checked.command, await references(referencesTarget, AbortSignal.timeout(15_000)), {kind: 'HUMAN', id: current.current.me!.authorId, sponsorId: current.current.me!.sponsorId});
      if (!privateAllowed() || state.epoch !== epoch || state.unavailable) return;
      const next = {...blank(), holdTarget: referencesTarget, peerId: fields.peerId, peerDigest: fields.peerDigest, reasons: ['UNSUPPORTED_METHOD' as const]}; current.current.fields = next; setFields(next);
    } catch { if (state.alive && epoch === state.epoch && !state.unavailable) setError('Use the exact related continuous reproduction or conflicting outcome under this same manifest and source.'); }
    finally { if (state.alive && workId === state.workId) { state.locked = false; setBusy(false); } }
  }
  async function importFile(file?: File) {
    if (!file || file.size > experimentReviewLimits.requestBytes || !privateAllowed() || runtime.current.locked || runtime.current.pending) { setError('Review draft exceeds its byte budget or is unavailable.'); return; }
    const epoch = runtime.current.epoch, heldFields = current.current.fields, workId = ++runtime.current.workId;
    try { const raw = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer()); parseUniqueJson(raw, experimentReviewLimits.requestBytes, 16); if (privateAllowed() && epoch === runtime.current.epoch && workId === runtime.current.workId && current.current.fields === heldFields && !runtime.current.pending && !runtime.current.locked) change({json: raw}); }
    catch { if (runtime.current.alive && epoch === runtime.current.epoch) setError('Use strict UTF-8 unique-key JSON.'); }
  }
  async function submit() {
    const state = runtime.current, author = current.current.me, action = current.current.mode;
    if (!privateAllowed() || state.blocked || state.locked || state.pending || state.epoch !== renderEpoch || !action || fields !== current.current.fields) return;
    if (!fields.consent || action === 'review' && (!fields.rights || !fields.share)) { setError('Confirm input rights, public evidence sharing and review policy where required.'); return; }
    state.locked = true; setBusy(true);
    try {
      let raw: unknown, expectedSequence: number | null = null;
      const common = {requestId: crypto.randomUUID(), id: selected?.id, digest: selected?.digest, policyAccepted: policy};
      if (action === 'review') {
        if (!author!.reviewer || state.unavailable) throw Error('Separate reviewer permission required.');
        const target = fields.draft?.target ?? fields.holdTarget;
        if (!target) throw Error('Import a paired exact review draft first.');
        // A head precondition is frozen with the body. A concurrent change receives a definite conflict.
        const response = await pageRead(current.current.original!, null, AbortSignal.timeout(15_000), null);
        const head = response.currentHead; expectedSequence = (head?.sequence ?? 0) + 1;
        raw = {action, id: crypto.randomUUID(), requestId: crypto.randomUUID(), target, previous: head ? ref(head) : null, decision: fields.decision, reasons: fields.reasons, evidence: fields.draft?.evidence ?? null, attestations: fields.attestations, sharedDependencies: [...experimentReviewSharedDependencies], otherConflicts: fields.conflicts, note: fields.note, policyAccepted: policy};
      } else raw = action === 'report' ? {...common, action, reason: fields.reason, details: fields.note} : action === 'withdraw' ? {...common, action, reason: fields.reason} : {...common, action, state: fields.state, reason: fields.reason};
      const bounded = boundedExperimentReviewCommand(raw);
      if (!privateAllowed() || state.pending || state.epoch !== renderEpoch || current.current.fields !== fields || current.current.mode !== action || current.current.me !== author) return;
      const pending: Pending = {command: bounded.command, body: bounded.payload, author: structuredClone(author!), target: selected ? structuredClone(selected) : null, submitted: false, expectedSequence};
      state.pending = pending; state.locked = false; await write(pending);
    } catch { if (privateAllowed() && !state.pending) setError('Complete the exact evidence, decision, reasons, process attestations and required note. Unsupported continuous evidence requires an evidence-free hold.'); }
    finally { if (state.alive && !state.pending) { state.locked = false; setBusy(false); } }
  }
  async function write(pending: Pending) {
    const state = runtime.current, author = current.current.me;
    if (!privateAllowed() || state.blocked || state.locked || state.pending !== pending) return;
    if (!author || pending.author.authorId !== author.authorId || pending.author.sponsorId !== author.sponsorId || pending.command.action === 'review' && !author.reviewer || pending.command.action === 'moderate' && !author.moderator) { clearPrivate(); return; }
    const epoch = state.epoch, mutationId = ++state.mutationId; state.locked = true; setBusy(true); setUncertain(false); setError('');
    try {
      if (pending.command.action === 'review' && !pending.submitted) await validateExperimentReviewBindings(pending.command, await references(pending.command.target, AbortSignal.timeout(15_000)), {kind: 'HUMAN', id: pending.author.authorId, sponsorId: pending.author.sponsorId});
      if (!privateAllowed() || epoch !== state.epoch || state.pending !== pending || current.current.me?.authorId !== pending.author.authorId) return;
      pending.submitted = true;
      const response = await fetch('/api/experiments/reviews', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Experiment-Review-Intent': 'submit', 'X-Experiment-Review-Author': pending.author.authorId}, body: pending.body, signal: AbortSignal.timeout(15_000)});
      if (!privateAllowed() || epoch !== state.epoch || state.pending !== pending) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) { erasePending(); setUncertain(false); setError(response.status === 409 ? 'Current reference or review head changed. Close and refresh before a new publication.' : response.status === 429 ? 'Review capacity or submission quota reached. No automatic reset is promised.' : 'Review rejected. Correct the complete evidence and policy declarations.'); return; }
      if (!response.ok) throw Error('Unknown acknowledgement.');
      const value = experimentReviewWriteSchema.parse(await read(response)); if (value.item) await validateExperimentReviewItem(value.item);
      if (!privateAllowed() || epoch !== state.epoch || state.pending !== pending) return;
      if (!matches(pending, value)) throw Error('Wrong acknowledgement.');
      if (value.item?.suppression) suppressDependencies();
      if ((state.unavailable || value.item && state.suppressed.has(value.item.id)) && value.item?.record && pending.command.action !== 'moderate') throw Error('Stale visible acknowledgement.');
      const projected = value.item ? reconcile(value.item, pending.command.action === 'moderate' && pending.command.state === 'VISIBLE') : null;
      if (state.unavailable && projected?.record) throw Error('Suppressed acknowledgement.');
      const acknowledged = {...value, item: projected}; erasePending(); const next = blank(); current.current.fields = next; current.current.receipt = acknowledged; setFields(next); setReceipt(acknowledged); setUncertain(false);
    } catch { if (privateAllowed() && state.pending === pending) { if (!pending.submitted) { erasePending(); setError(state.unavailable ? 'Referenced evidence was suppressed before submission.' : 'Evidence binding failed. Nothing was submitted.'); } else { setUncertain(true); setError('Outcome unknown. Retry the identical request with the same intended author. Keep this tab open.'); } } }
    finally { if (state.alive && mutationId === state.mutationId) { state.locked = false; setBusy(false); } }
  }
  function close() {
    const state = runtime.current; if (state.locked || state.pending || !state.alive) return;
    state.epoch++; current.current.mode = null; current.current.fields = blank(); current.current.receipt = null; setMode(null); setFields(blank()); setReceipt(null); setError(''); callbacks.current.onBusyChange(false);
  }
  async function loadReports(next: string | null = null) {
    const state = runtime.current; if (!privateAllowed() || !current.current.me?.moderator || state.blocked || state.locked || state.pending || current.current.mode) return;
    const epoch = state.epoch;
    try { const response = await fetch('/api/experiments/reviews/reports' + (next ? '?cursor=' + next : ''), {cache: 'no-store', signal: AbortSignal.timeout(15_000)}); if (response.status === 401 || response.status === 403) { clearPrivate(); return; } if (!response.ok) throw Error('Reports unavailable.'); const value = experimentReviewReportsSchema.parse(await read(response)); if (privateAllowed() && epoch === state.epoch && current.current.me?.moderator) setReports(value); }
    catch { if (state.alive && epoch === state.epoch) setError('Private review reports unavailable.'); }
  }
  const editing = !!mode && !receipt, canRead = !mode && !disabled && !loading && !runtime.current.unavailable;
  return <section className="og-experiment-reviews" aria-label="Trusted review history"><div className="og-experiment-toolbar"><h2>Computational reviews</h2><button className="og-button og-secondary" disabled={!canRead} onClick={() => void load(page)} aria-label="Refresh review history">Refresh</button></div>
    <p>Separate trusted-human attestations. Original outcomes remain AUTHOR_REPORTED. Qualification NONE · independence NOT_ESTABLISHED. Reproducing losses is possible; agreement does not establish profitability.</p>
    {original && <p className="og-experiment-reference">Original <a href={experimentHref(original)} onClick={event => { if (runtime.current.pending || current.current.mode || runtime.current.locked || runtime.current.blocked) event.preventDefault(); }}>{original.id}</a><br/>Digest {original.digest}</p>}
    {(error || authLost) && <p role="alert" className="og-experiment-message">{authLost ? 'Review session unavailable. Private drafts and pending operations cleared.' : error}</p>}
    {loading && <p role="status">Checking exact review records…</p>}
    {!items.length && !loading && !error && <p>No review on this page. Absence of reviews is not evidence of success.</p>}
    <div className="og-experiment-list">{items.map(item => <article className="og-experiment-card" key={item.id} aria-label={`Review summary ${item.id}`}><span className="og-experiment-pill">{item.decision ?? item.state}</span><p>Review {item.sequence} · human {item.author.id.slice(6, 14)} · {item.createdAt}</p><p>{item.reasons.join(' · ') || 'Content unavailable; metadata retained.'}</p><button className="og-button og-secondary" aria-label={`Open review ${item.id}`} disabled={!canRead} onClick={() => void choose(ref(item))}>Inspect review</button></article>)}</div>
    <div className="og-experiment-pagination">{page ? <button className="og-button og-secondary" disabled={!canRead} onClick={() => void load()}>First reviews</button> : <span/>}{cursor && <button className="og-button og-secondary" disabled={!canRead} onClick={() => void load(cursor)}>Next reviews</button>}</div>
    {selected && <><ReviewDetail item={selected} disabled={!canRead} original={root} navigationBlocked={() => !!runtime.current.pending || !!current.current.mode || runtime.current.locked || runtime.current.blocked}/><button className="og-button og-secondary" disabled={!canRead} onClick={() => void choose(ref(selected), true)}>Refresh selected review</button></>}
    {!mode && <div className="og-experiment-card-actions">{me?.reviewer && <button className="og-button og-primary" disabled={!canRead || !original?.record} onClick={() => open('review')}>Prepare human review</button>}{me && selected?.record && <button className="og-button og-secondary" disabled={!canRead} onClick={() => open('report')}>Flag review privately</button>}{me && selected && selected.author.sponsorId === me.sponsorId && selected.state !== 'WITHDRAWN' && <button className="og-button og-secondary" disabled={!canRead} onClick={() => open('withdraw')}>Withdraw review</button>}{me?.moderator && selected && selected.state !== 'WITHDRAWN' && <button className="og-button og-secondary" disabled={!canRead} onClick={() => open('moderate')}>Moderate review</button>}{me?.moderator && <button className="og-button og-secondary" disabled={!canRead} onClick={() => void loadReports()}>Private review reports</button>}</div>}
    {signedIn && !authLost && <button className="og-button og-secondary" disabled={busy || blocked} onClick={() => void loadIdentity()}>Refresh review permissions</button>}
    {!me?.reviewer && <p>{signedIn && !authLost ? 'Review publication requires separate human reviewer authorization. Moderator, author and agent status do not confer it.' : <a href={signIn} target="_top">Sign in for available actions</a>}</p>}
    {editing && <form className="og-experiment-form og-review-form" aria-label="Human review form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h3>{mode === 'review' ? 'Human review declaration' : mode === 'report' ? 'Private review report' : mode === 'withdraw' ? 'Withdraw this review' : 'Review moderation'}</h3>
      {mode === 'review' ? <><p>Prepare fresh paired evidence in Validation, then import it. A signed-in reviewer must inspect the reports and truthfully attest the local process; imported hashes do not prove execution.</p><a href={`/validation?outcome=${root.id}&digest=${root.digest}`} onClick={event => event.preventDefault()} aria-disabled="true">Close this form to prepare paired evidence in Validation</a>{original?.record?.version === 2 ? <><p>Continuous evidence has no independent reference evaluator. Only an evidence-free UNSUPPORTED_METHOD hold is available.</p><label>Related outcome ID<input aria-label="Continuous peer outcome ID" value={fields.peerId} disabled={disabled} onChange={event => change({peerId: event.target.value})}/></label><label>Related outcome digest<input aria-label="Continuous peer outcome digest" value={fields.peerDigest} disabled={disabled} onChange={event => change({peerDigest: event.target.value})}/></label><button type="button" className="og-button og-secondary" disabled={disabled} onClick={() => void checkContinuousHold()}>Check continuous hold references</button>{fields.holdTarget && <ReviewReferences target={fields.holdTarget} disabled={true}/>}</> : !fields.draft ? <><label>Paired local review draft JSON<textarea className="og-experiment-json" aria-label="Paired review draft JSON" rows={5} value={fields.json} disabled={disabled} onChange={event => change({json: event.target.value})}/></label><label>Import paired draft file<input type="file" aria-label="Import paired review draft file" accept="application/json,.json" disabled={disabled} onChange={event => void importFile(event.target.files?.[0])}/></label><button type="button" className="og-button og-secondary" disabled={disabled || !fields.json} onClick={() => void importDraft()}>Check paired draft</button></> : <><ReviewReferences target={fields.draft.target} disabled={true}/><p>Original report: {fields.draft.evidence.original.status} · reproduction report: {fields.draft.evidence.reproduction.status}. Imported evidence remains AUTHOR_REPORTED until separately reviewed. {'method' in fields.draft.evidence && <span>PROGRAM_DEMO · same-implementation generator reconstruction. A matching resource failure or losing outcome remains adverse; operator independence and input custody are not established.</span>}</p><details><summary>Complete paired reports</summary><pre className="og-experiment-definition">{JSON.stringify(fields.draft.evidence, null, 2)}</pre></details></>}
      <label>Decision<select aria-label="Review decision" value={fields.decision} disabled={disabled || original?.record?.version === 2} onChange={event => change({decision: event.target.value as Fields['decision'], reasons: []})}>{['REPRODUCED','DISPUTED','HELD','REJECTED'].map(value => <option key={value}>{value}</option>)}</select></label>
      <fieldset><legend>Reasons · required</legend>{experimentReviewReasons.map(reason => <ReviewCheck key={reason} label={'Review reason ' + reason} checked={fields.reasons.includes(reason)} disabled={disabled || original?.record?.version === 2} onChange={value => change({reasons: value ? [...fields.reasons, reason] : fields.reasons.filter(item => item !== reason)})}>{reason.replaceAll('_', ' ')}</ReviewCheck>)}</fieldset>
      <fieldset><legend>Process attestations</legend>{Object.keys(fields.attestations).map(key => <ReviewCheck key={key} label={'Attest ' + key} checked={fields.attestations[key as keyof Fields['attestations']]} disabled={disabled} onChange={value => change({attestations: {...fields.attestations, [key]: value}})}>{({fixedCode: 'I ran the pinned fixed code locally.', exactInputs: 'I checked both exact accepted inputs and retained artifacts.', inspectedDifferences: 'I inspected every retained comparison and difference.', separateOriginalAndReproductionProcesses: 'I reviewed separate original and reproduction processes; public sponsorship alone cannot prove this.'})[key]}</ReviewCheck>)}</fieldset>
      <details><summary>Always shared dependencies</summary><ul>{experimentReviewSharedDependencies.map(value => <li key={value}>{value.replaceAll('_', ' ')}</li>)}</ul></details><label>Other conflicts<textarea aria-label="Review conflicts" maxLength={1500} rows={2} value={fields.conflicts} disabled={disabled} onChange={event => change({conflicts: event.target.value})}/></label>
      <ReviewCheck label="Confirm review input rights" checked={fields.rights} disabled={disabled} onChange={value => change({rights: value}, false)}>I may use and publish the exact supplied evidence.</ReviewCheck><ReviewCheck label="Confirm public review evidence" checked={fields.share} disabled={disabled} onChange={value => change({share: value}, false)}>Publish both full reports, differences, attestations, conflicts and note publicly.</ReviewCheck></> : <><label>Reason<select aria-label="Review action reason" value={fields.reason} disabled={disabled} onChange={event => change({reason: event.target.value})}>{(mode === 'withdraw' ? ['AUTHOR_REQUEST','PERSONAL_DATA','CREDENTIAL_EXPOSURE'] : mode === 'moderate' ? fields.state === 'VISIBLE' ? ['RESTORED'] : ['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','POLICY'] : ['SPAM','ABUSE','PERSONAL_DATA','CREDENTIAL_EXPOSURE','MISLEADING','OTHER']).map(value => <option key={value}>{value}</option>)}</select></label>{mode === 'moderate' && <label>Disposition<select aria-label="Review moderation state" value={fields.state} disabled={disabled} onChange={event => change({state: event.target.value as Fields['state'], reason: event.target.value === 'VISIBLE' ? 'RESTORED' : 'POLICY'})}><option>HIDDEN</option><option>VISIBLE</option></select></label>}</>}
      {(mode === 'review' || mode === 'report') && <label>{mode === 'review' ? 'Public review note' : 'Private report details'}<textarea aria-label="Review note" rows={3} maxLength={mode === 'review' ? 2000 : 1500} value={fields.note} disabled={disabled} onChange={event => change({note: event.target.value})}/></label>}
      <ReviewCheck label="Accept review policy" checked={fields.consent} disabled={disabled} onChange={value => change({consent: value}, false)}>I accept <a href="/experiment-review-policy" target="_blank" rel="noopener noreferrer">the public review policy</a>. This grants no execution or financial qualification.</ReviewCheck>
      <div className="og-experiment-card-actions">{uncertain ? <button type="button" className="og-button og-primary" disabled={busy || blocked} onClick={() => { if (runtime.current.pending === renderPending && renderPending) void write(renderPending); }}>Retry identical review request</button> : <button type="submit" className="og-button og-primary" disabled={disabled}>{busy ? 'Checking…' : mode === 'review' ? 'Publish human review' : mode === 'report' ? 'Send private review report' : mode === 'withdraw' ? 'Confirm review withdrawal' : 'Confirm review moderation'}</button>}<button type="button" className="og-button og-secondary" disabled={busy || uncertain} onClick={close}>Close review form</button></div>
    </form>}
    {receipt && <div role="status" className="og-experiment-success"><p>{receipt.action === 'review' ? 'Human review recorded' : receipt.action === 'report' ? 'Private review report recorded' : receipt.action === 'withdraw' ? 'Review withdrawn' : 'Review moderation recorded'}{receipt.item && !receipt.item.record ? ' · content unavailable; metadata retained.' : '.'}</p><button className="og-button og-secondary" onClick={() => { close(); void load(); }}>Done reviewing</button></div>}
    {reports && me?.moderator && <details open><summary>Private review reports</summary>{reports.reports.map(report => <article key={report.id + report.requestId} className="og-experiment-card"><p>{report.reason} · {report.createdAt}</p><p className="og-experiment-reference">Review {report.id}<br/>{report.digest}</p><p>{report.details}</p><button className="og-button og-secondary" disabled={!canRead} onClick={() => void choose(ref(report))}>Inspect reported review</button></article>)}{reports.nextCursor && <button className="og-button og-secondary" disabled={!canRead} onClick={() => void loadReports(reports.nextCursor)}>Next private review reports</button>}</details>}
  </section>;
}
function experimentReviewCommand(item: Item): ExperimentReviewPublishCommand { if (!item.record) throw Error('No retained review.'); return {action: 'review', id: item.id, requestId: item.requestId, ...item.record.content, policyAccepted: policy}; }
function ReviewCheck({label, checked, disabled, onChange, children}: {label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void; children: React.ReactNode}) { return <label className="og-experiment-check"><input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/><span>{children}</span></label>; }
function ReviewReferences({target, disabled = false, navigationBlocked}: {target: ExperimentReviewPublishCommand['target']; disabled?: boolean; navigationBlocked?: () => boolean}) { return <dl className="og-review-references">{Object.entries(target).map(([name, reference]) => <div key={name}><dt>{name}</dt><dd className="og-experiment-reference"><a href={name === 'strategy' ? strategyEvidenceHref(reference) : experimentHref(reference)} onClick={event => { if (disabled || navigationBlocked?.()) event.preventDefault(); }}>{reference.id}</a><br/>{reference.digest}</dd></div>)}</dl>; }
function ReviewDetail({item, disabled, original, navigationBlocked}: {item: Item; disabled: boolean; original: ExperimentSelection; navigationBlocked: () => boolean}) { const content = item.record?.content; return <article className="og-experiment-outcome" aria-label={`Exact review ${item.id}`}><span className="og-experiment-pill">{item.decision ?? item.state}</span><p>REVIEW_ATTESTATION · trusted human {item.author.id.slice(6, 14)} · sequence {item.sequence}</p><p className="og-experiment-reference">ID {item.id}<br/>Digest {item.digest}</p><a href={experimentReviewHref(original, item)} aria-label="Exact review permalink" onClick={event => { if (disabled || navigationBlocked()) event.preventDefault(); }}>Exact review permalink</a>{content ? <><p>Qualification NONE · independence NOT_ESTABLISHED. A trusted computational attestation does not establish source truth, unseen data, operational independence or future performance.</p><ReviewReferences target={content.target} disabled={disabled} navigationBlocked={navigationBlocked}/>{content.previous && <a href={experimentReviewHref(original, content.previous)} onClick={event => { if (disabled || navigationBlocked()) event.preventDefault(); }}>Previous exact review</a>}<p>{content.reasons.join(' · ')}</p><p>{content.note}</p><details><summary>Process, conflicts and full comparison evidence</summary><ul>{Object.entries(content.attestations).map(([key, value]) => <li key={key}>{key}: {value ? 'ATTESTED' : 'NOT ATTESTED'}</li>)}</ul><p>{content.sharedDependencies.join(' · ')}</p><p>{content.otherConflicts || 'No other conflicts declared; independence remains unestablished.'}</p>{content.evidence ? <pre className="og-experiment-definition">{JSON.stringify(content.evidence, null, 2)}</pre> : <p>No paired batch evidence retained.</p>}</details></> : <p>Reports, notes and authored content unavailable. Public metadata implies no computational conclusion.</p>}<details><summary>Moderation history</summary>{item.moderation.map(event => <p key={event.sequence}>{event.sequence} · {event.state} · {event.reason} · {event.createdAt}</p>)}</details></article>; }
