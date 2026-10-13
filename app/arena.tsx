'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Download, FlaskConical, LockKeyhole, Plus, RefreshCw, X} from 'lucide-react';
import {arenaLimits, verifyArenaReport, type ArenaMember, type ArenaReport} from './arena-model';
import {evaluateArena} from './arena-evaluator';
import {ArenaPublicUnavailable, arenaPublicReferenceSchema, readArenaMember, sameArenaPublicMember, type ArenaPublicMember} from './arena-public';
import {experimentMeSchema} from './experiment-model';
import type {DemoArtifact} from './demo-model';
import {parseUniqueJson} from './unique-json';
import {arenaHref, type ArenaSelection} from './arena-link';
import {experimentHref} from './experiment-link';
import {MainNavigation} from './main-navigation';
import './network.css';
import './arena.css';

type Attempt = {id: string; admittedAt: string; refs: ArenaSelection[]; status: 'RUNNING' | ArenaReport['status']; members: ArenaPublicMember[] | null; report: ArenaReport | null; error: string | null; cleared: boolean; current: boolean};
type Busy = 'LOAD' | 'RUN' | 'EXPORT' | null;
type Known = {digest: string; state: string; moderation: string[] | null; outcomeCount: number};
type Projection = {id: string; digest: string; state: string; moderation?: unknown[]; outcomeCount?: number};
const now = () => new Date().toISOString(), ref = (item: {id: string; digest: string}): ArenaSelection => ({id: item.id, digest: item.digest});
const short = (value: string) => value.startsWith('human_') ? value.slice(6, 14) : value.slice(0, 8);
const amount = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('en-GB', {maximumFractionDigits: 3}).format(value);
const stamp = (value: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(value));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const locationQuery = () => typeof window === 'undefined' ? '' : window.location.search;
function modelMember(member: ArenaPublicMember): ArenaMember {
  const head = member.reviewContext.currentHead;
  return {outcome: member.outcome, manifest: member.manifest, strategy: member.strategy,...(member.sourceDependencies?{sourceDependencies:member.sourceDependencies}:{}), reviewContext: {original: member.reviewContext.original, currentHead: head ? {id: head.id, digest: head.digest, sequence: head.sequence, decision: head.decision, state: head.state} : null}};
}
function declaredAssumptions(member: ArenaPublicMember) {
  const record = member.manifest.record; if (!record || record.type !== 'MANIFEST') return null;
  const input = record.content.input, definition = member.strategy.record?.content.definition;
  return {market: definition?.market, risk: definition?.risk, costs: definition?.costs, initialCapital: 'kind' in input && (input.kind === 'CONTINUOUS_DEMO_INPUT'||input.kind==='PROGRAM_FORWARD_DEMO_INPUT') ? input.config.initialCapital : 'initialCapital' in input ? input.initialCapital : undefined, evaluator: record.content.evaluator, disclosures: record.content.disclosures,...(record.version===4?{method:'PROGRAM_FORWARD_DEMO',plan:record.content.input.plan?{digest:record.content.input.plan.planDigest,mode:record.content.input.plan.mode,ledger:record.content.input.plan.handoff.ledger.ledgerDigest,attempts:record.content.input.plan.handoff.ledger.attempts.map(attempt=>({phase:attempt.phase,candidate:attempt.candidateId,status:attempt.status,digest:attempt.attemptDigest}))}:null,ranking:'HELD / FORWARD_PROTOCOL_UNSUPPORTED',sources:member.sourceDependencies?.map(source=>({id:source.id,digest:source.digest,name:source.record?.content.name,state:source.state,moderation:source.moderation}))??null}:{})};
}
function download(payload: string) {
  const url = URL.createObjectURL(new Blob([payload], {type: 'application/json'}));
  try {const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'opengrail-arena-attempts.json'; anchor.click();} finally {URL.revokeObjectURL(url);}
}
class ChangedContext extends Error {constructor(){super('Exact source or review context changed. A fresh cohort and reconstruction are required.');}}
class IdentityLost extends Error {constructor(){super('Signed-in identity is no longer available.');}}
const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function EquityChart({artifact}: {artifact: DemoArtifact | null}) {
  if (!artifact?.input || !artifact.equity.length) return <span>—</span>;
  const values = [artifact.input.initialCapital, ...artifact.equity.map(point => point.equity)], low = Math.min(...values), high = Math.max(...values), span = high - low;
  const y = (value: number) => span === 0 ? 17 : 31 - (value - low) / span * 28;
  const points = values.map((value, index) => (index / (values.length - 1) * 112 + 2).toFixed(2) + ',' + y(value).toFixed(2)).join(' ');
  return <svg className="og-arena-equity" viewBox="0 0 116 34" role="img" aria-label="Freshly reconstructed equity curve"><title>Freshly reconstructed equity across {artifact.equity.length} retained closed bars. Dashed reference is initial capital. Author-reported and unqualified.</title><line x1="2" x2="114" y1={y(artifact.input.initialCapital)} y2={y(artifact.input.initialCapital)} className="og-arena-equity-reference"/><polyline points={points} fill="none" className={values.at(-1)! < values[0] ? 'og-arena-equity-loss' : 'og-arena-equity-line'}/></svg>;
}

export default function Arena({selection = null, selectionError = false, signedIn = false}: {selection?: ArenaSelection | null; selectionError?: boolean; signedIn?: boolean}) {
  const [id, setId] = useState(selection?.id ?? ''), [digest, setDigest] = useState(selection?.digest ?? ''), [draft, setDraft] = useState<ArenaPublicMember[]>([]), [rights, setRights] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]), [busy, setBusy] = useState<Busy>(null), [message, setMessage] = useState(''), [epochState, setEpochState] = useState(0);
  const context = JSON.stringify({selection, selectionError, signedIn}), rendered = useRef(context); rendered.current = context;
  const life = useRef({alive: true, epoch: 0, operation: 0, context, query: locationQuery(), busy: null as Busy, control: null as AbortController | null, activeAttempt: null as string | null});
  const held = useRef({id, digest, draft, rights, attempts}); held.current = {id, digest, draft, rights, attempts};
  const known = useRef(new Map<string, Known>()), quarantined = useRef(new Set<string>()), heads = useRef(new Map<string, {id: string; digest: string; sequence: number}>());
  const visibleContext = life.current.context === context && life.current.query === locationQuery(), epoch = epochState;
  function active(captured = epoch) {return life.current.alive && life.current.epoch === captured && life.current.context === context && rendered.current === context && life.current.query === locationQuery() && (typeof document === 'undefined' || document.visibilityState !== 'hidden');}
  function updateAttempts(values: Attempt[]) {held.current.attempts = values; setAttempts(values);}
  function replaceAttempt(attemptId: string, changes: Partial<Attempt>) {updateAttempts(held.current.attempts.map(attempt => attempt.id === attemptId ? {...attempt, ...changes} : attempt));}
  function replaceDraft(values: ArenaPublicMember[]) {held.current.draft = values; held.current.rights = false; setDraft(values); setRights(false);}
  function invalidate(reason: string, clear = true) {
    const state = life.current; state.epoch++; state.operation++; state.control?.abort(); state.control = null; state.busy = null; state.activeAttempt = null;
    updateAttempts(held.current.attempts.map(attempt => ({...attempt, status: attempt.status === 'RUNNING' ? 'INTERRUPTED' : attempt.status, ...(clear ? {members: null, report: null, cleared: true} : {}), current: false, error: reason})));
    if (clear) replaceDraft([]);
    setBusy(null); setEpochState(state.epoch); setMessage(reason);
  }
  function begin(kind: NonNullable<Busy>) {
    if (!active() || life.current.busy) return null;
    const state = life.current; state.busy = kind; state.operation++; state.control = new AbortController(); setBusy(kind); setMessage('');
    return {epoch: state.epoch, operation: state.operation, control: state.control};
  }
  function valid(work: {epoch: number; operation: number}) {return active(work.epoch) && life.current.operation === work.operation;}
  function finish(work: {epoch: number; operation: number}) {if (valid(work)) {life.current.busy = null; life.current.control = null; life.current.activeAttempt = null; setBusy(null);}}
  function rememberProjection(namespace: string, item: Projection) {
    const key = namespace + ':' + item.id, old = known.current.get(key), moderation = item.moderation?.map(event => JSON.stringify(event)) ?? null;
    if (quarantined.current.has(key) && item.state === 'VISIBLE') {
      const last = item.moderation?.at(-1) as {state?: string; reason?: string} | undefined;
      if (!old?.moderation || !moderation || moderation.length <= old.moderation.length || last?.state !== 'VISIBLE' || last.reason !== 'RESTORED') throw new ChangedContext();
      quarantined.current.delete(key);
    }
    if (old && (old.digest !== item.digest || old.outcomeCount > (item.outcomeCount ?? 0) || old.moderation && (!moderation || old.moderation.length > moderation.length || old.moderation.some((event, index) => moderation[index] !== event)))) throw new ChangedContext();
    if (old && old.state !== 'VISIBLE' && item.state === 'VISIBLE') {
      const last = item.moderation?.at(-1) as {state?: string; reason?: string} | undefined;
      if (!old.moderation || !moderation || moderation.length <= old.moderation.length || last?.state !== 'VISIBLE' || last.reason !== 'RESTORED') throw new ChangedContext();
    }
    known.current.set(key, {digest: item.digest, state: item.state, moderation: moderation ?? old?.moderation ?? null, outcomeCount: item.outcomeCount ?? 0});
  }
  function remember(member: ArenaPublicMember) {
    for (const item of [member.outcome, member.manifest, member.reviewContext.originalItem, ...member.reviewContext.dependencies]) rememberProjection('EXPERIMENT', item);
    rememberProjection('STRATEGY', member.strategy);
    const head = member.reviewContext.currentHead, key = member.reviewContext.original.id, old = heads.current.get(key);
    if (old && (!head || head.sequence < old.sequence || head.sequence === old.sequence && (head.id !== old.id || head.digest !== old.digest))) throw new ChangedContext();
    if (head) heads.current.set(key, {id: head.id, digest: head.digest, sequence: head.sequence});
    for (const item of member.reviewContext.lifecycle) {rememberProjection('REVIEW', item); if (item.state !== 'VISIBLE') quarantined.current.add('REVIEW:' + item.id);}
  }
  function noteSuppression(error: unknown) {
    if (!(error instanceof ArenaPublicUnavailable) || !error.suppressed || !error.reference) return;
    const namespace = error.resourceKind ?? (error.scope === 'STRATEGY' ? 'STRATEGY' : error.scope === 'REVIEWS' ? 'REVIEW' : 'EXPERIMENT');
    quarantined.current.add(namespace + ':' + error.reference.id);
    for (const possible of ['EXPERIMENT', 'STRATEGY', 'REVIEW']) if (known.current.has(possible + ':' + error.reference.id)) quarantined.current.add(possible + ':' + error.reference.id);
  }
  async function fresh(members: ArenaPublicMember[], signal: AbortSignal) {
    const results = await Promise.allSettled(members.map(member => readArenaMember(ref(member.outcome), signal)));
    let failure: unknown = null;
    const values: ArenaPublicMember[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {try {remember(result.value); values.push(result.value);} catch (error) {failure ??= error;}}
      else {noteSuppression(result.reason); if (result.reason instanceof ArenaPublicUnavailable && result.reason.suppressed) failure = result.reason; else failure ??= result.reason;}
    }
    signal.throwIfAborted(); if (failure) throw failure;
    if (values.length !== members.length || values.some((member, index) => !sameArenaPublicMember(member, members[index]))) throw new ChangedContext();
    return values;
  }
  async function identity(signal: AbortSignal) {
    if (!signedIn) return null;
    const response = await fetch('/api/experiments/me', {cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)])});
    if (response.status === 401 || response.status === 403) throw new IdentityLost();
    if (!response.ok || response.redirected || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Error('Signed-in identity unavailable.');
    const reader = response.body?.getReader(); if (!reader) throw Error('Identity response unavailable.');
    const chunks: Uint8Array[] = []; let total = 0;
    try {for (;;) {signal.throwIfAborted(); const {done, value} = await reader.read(); signal.throwIfAborted(); if (done) break; total += value.byteLength; if (total > 4096) {await reader.cancel(); throw Error('Identity bound.');} chunks.push(value);}} finally {reader.releaseLock();}
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    return experimentMeSchema.parse(parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), 4096, 8));
  }
  function unavailable(error: unknown, reason: string) {
    if (error instanceof ChangedContext || error instanceof IdentityLost || error instanceof ArenaPublicUnavailable && error.suppressed) {
      noteSuppression(error); invalidate(reason + ' Held source, review and report payloads cleared; exact attempt references and adverse dispositions remain. Earlier downloads cannot be recalled.');
    } else {
      updateAttempts(held.current.attempts.map(attempt => ({...attempt, current: false})));
      setMessage(reason + ' Current visibility is unconfirmed; no current rank or export was released.');
    }
  }
  async function add(reference?: ArenaSelection) {
    if (!active() || life.current.busy || held.current.draft !== draft || held.current.draft.length >= arenaLimits.members) return;
    let selection: ArenaSelection;
    try {selection = arenaPublicReferenceSchema.parse(reference ?? {id: held.current.id, digest: held.current.digest});} catch {setMessage('Use one complete lowercase outcome UUID and SHA-256 digest.'); return;}
    if (held.current.draft.some(member => member.outcome.id === selection.id)) {setMessage('That exact outcome is already in this draft.'); return;}
    const original = held.current.draft, work = begin('LOAD'); if (!work) return;
    try {
      const member = await readArenaMember(selection, work.control.signal); if (!valid(work) || held.current.draft !== original) return; remember(member);
      if (original.some(value => value.strategy.id === member.strategy.id && value.strategy.digest === member.strategy.digest)) throw Error('Choose a distinct exact strategy version.');
      if (byteSize([...original, member]) > arenaLimits.admissionBytes) {setMessage('Complete cohort exceeds 8 MiB, including full review dependencies. No member was admitted or history trimmed.'); return;}
      replaceDraft([...original, member]); setMessage('Exact public member added. Its sources, disclosures and current review head are retained; no computation has run.');
    } catch (error) {if (valid(work)) unavailable(error, 'Exact member unavailable or changed. No alternative outcome was substituted.');} finally {finish(work);}
  }
  function changeField(field: 'id' | 'digest', value: string) {
    if (!active() || life.current.busy || held.current[field] !== (field === 'id' ? id : digest)) return;
    if (value.length > (field === 'id' ? 36 : 64)) {setMessage('Exact reference field exceeds its bound. No replacement value was accepted.'); return;}
    if (field === 'id') {held.current.id = value; setId(value);} else {held.current.digest = value; setDigest(value);}
  }
  function remove(index: number) {if (!active() || life.current.busy || held.current.draft !== draft) return; replaceDraft(draft.filter((_, memberIndex) => memberIndex !== index));}
  async function run() {
    if (!active() || life.current.busy || held.current.draft !== draft || held.current.attempts !== attempts || !held.current.rights || draft.length < 2 || attempts.length >= arenaLimits.attempts) return;
    const cohortBytes = byteSize(draft);
    if (cohortBytes > arenaLimits.admissionBytes || byteSize(attempts) + cohortBytes + arenaLimits.reportBytes + 4096 > arenaLimits.exportBytes) {setMessage('Complete history cannot reserve another bounded report within 64 MiB. No attempt was admitted, cloned or trimmed; export the retained history.'); return;}
    const members = structuredClone(draft), work = begin('RUN'); if (!work) return;
    const attempt: Attempt = {id: crypto.randomUUID(), admittedAt: now(), refs: members.map(member => ref(member.outcome)), status: 'RUNNING', members, report: null, error: null, cleared: false, current: false};
    life.current.activeAttempt = attempt.id; updateAttempts([...held.current.attempts, attempt]); held.current.rights = false; setRights(false);
    try {
      const principal = await identity(work.control.signal); if (!valid(work)) return;
      await fresh(members, work.control.signal); if (!valid(work)) return;
      const report = await evaluateArena(members.map(modelMember), {signal: work.control.signal}); if (!valid(work)) return;
      const verified = await verifyArenaReport(report); if (!valid(work)) return;
      replaceAttempt(attempt.id, {report: verified, current: false});
      const currentPrincipal = await identity(work.control.signal); if (!valid(work)) return;
      if (!same(principal, currentPrincipal)) {invalidate('Signed-in identity changed. Held cohort and report payloads cleared.'); return;}
      const confirmed = await fresh(members, work.control.signal); if (!valid(work)) return;
      const retained = held.current.attempts.find(value => value.id === attempt.id);
      if (!retained || retained.status !== 'RUNNING' || !retained.members || retained.members.some((member, index) => !sameArenaPublicMember(member, confirmed[index])) || !same(verified.members, members.map(modelMember))) throw new ChangedContext();
      replaceAttempt(attempt.id, {status: verified.status, report: verified, current: true});
      setMessage('Whole frozen cohort reconstructed. Every selected member and adverse disposition is retained. This local comparison establishes no independent qualification.');
    } catch (error) {
      if (valid(work)) {
        replaceAttempt(attempt.id, {status: work.control.signal.aborted ? 'INTERRUPTED' : 'HELD', error: work.control.signal.aborted ? 'USER_CANCELLED' : 'Confirmation or reconstruction unavailable; no selected member was dropped.', current: false});
        unavailable(error, 'Arena confirmation failed. The complete admitted cohort remains represented.');
      }
    } finally {finish(work);}
  }
  function cancel(operation: number) {
    if (!active() || life.current.operation !== operation || life.current.busy !== 'RUN' || !life.current.activeAttempt) return;
    const attemptId = life.current.activeAttempt; life.current.control?.abort(); life.current.operation++; life.current.busy = null; life.current.control = null; life.current.activeAttempt = null;
    replaceAttempt(attemptId, {status: 'INTERRUPTED', error: 'USER_CANCELLED', current: false}); setBusy(null); setMessage('Interrupted attempt retained with its entire frozen cohort. A later run creates a separate attempt.');
  }
  async function exportAll() {
    if (!active() || life.current.busy || !attempts.length || held.current.attempts !== attempts) return;
    const original = held.current.attempts, work = begin('EXPORT'); if (!work) return;
    try {
      const principal = await identity(work.control.signal); if (!valid(work) || held.current.attempts !== original) return;
      for (const attempt of original) if (attempt.report) {await verifyArenaReport(attempt.report); if (!valid(work) || held.current.attempts !== original) return; if (!attempt.members || !same(attempt.report.members, attempt.members.map(modelMember))) throw new ChangedContext();}
      const currentPrincipal = await identity(work.control.signal); if (!valid(work) || held.current.attempts !== original) return;
      if (!same(principal, currentPrincipal)) {invalidate('Signed-in identity changed. Held cohort and report payloads cleared.'); return;}
      const confirmed: {attempt: Attempt; members: ArenaPublicMember[]}[] = [];
      for (const attempt of original) if (attempt.members) {confirmed.push({attempt, members: await fresh(attempt.members, work.control.signal)}); if (!valid(work) || held.current.attempts !== original) return;}
      const payload = JSON.stringify({version: 1, kind: 'LOCAL_ARENA_ATTEMPTS', exportedAt: now(), classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false, liveEnabled: false, attempts: original});
      if (new TextEncoder().encode(payload).byteLength > arenaLimits.exportBytes) throw Error('Complete history exceeds the export bound; no selected member or attempt was trimmed.');
      if (!valid(work) || held.current.attempts !== original || confirmed.some(value => !value.attempt.members || value.members.some((member, index) => !sameArenaPublicMember(member, value.attempt.members![index])))) throw new ChangedContext();
      download(payload); setMessage('Complete local attempt history exported, including failures, interruptions and cleared dispositions. Preserve this file; reload loses unexported work.');
    } catch (error) {if (valid(work)) unavailable(error, 'Export withheld. Current exact sources and review context must be confirmed; no partial history was downloaded.');} finally {finish(work);}
  }
  useEffect(() => {
    life.current.alive = true; setEpochState(life.current.epoch); setAttempts(held.current.attempts);
    const navigation = () => invalidate('Navigation interrupted confirmation and cleared held payloads. Safe attempt dispositions remain.'), visibility = () => {if (typeof document !== 'undefined' && document.visibilityState === 'hidden') invalidate('Tab visibility lost. Confirmation interrupted and held payloads cleared. Safe attempt dispositions remain.');};
    if (typeof window !== 'undefined') {window.addEventListener('popstate', navigation); window.addEventListener('pagehide', navigation);}
    if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', visibility);
    return () => {
      if (typeof window !== 'undefined') {window.removeEventListener('popstate', navigation); window.removeEventListener('pagehide', navigation);}
      if (typeof document !== 'undefined') document.removeEventListener?.('visibilitychange', visibility);
      const state = life.current; state.alive = false; state.epoch++; state.operation++; state.control?.abort(); state.control = null; state.busy = null; state.activeAttempt = null;
      held.current = {...held.current, draft: [], rights: false, attempts: held.current.attempts.map(attempt => ({...attempt, status: attempt.status === 'RUNNING' ? 'INTERRUPTED' : attempt.status, members: null, report: null, cleared: true, current: false, error: 'Unmount interrupted confirmation and cleared held payloads.'}))};
    };
  }, []);
  useEffect(() => {
    if (life.current.context !== context) {invalidate('Selection or sign-in changed. Confirmation interrupted and held payloads cleared. Safe attempt dispositions remain.'); life.current.context = context; life.current.query = locationQuery();}
    held.current.id = selection?.id ?? ''; held.current.digest = selection?.digest ?? ''; setId(held.current.id); setDigest(held.current.digest);
    if (selectionError) {setMessage('Invalid exact Arena link. Use one outcome UUID and SHA-256 digest; unknown and duplicate fields are rejected.'); return;}
    if (selection && held.current.draft.length === 0) void add(selection);
  }, [context]);
  const shownDraft = visibleContext ? draft : [], shownAttempts = visibleContext ? attempts : attempts.map(attempt => ({...attempt, members: null, report: null, current: false, cleared: true}));
  const blocked = !!busy || !active() || selectionError, capturedOperation = life.current.operation;
  const returnPath = arenaHref(selection);
  return <div className="og-network og-arena"><a className="og-skip" href="#arena-main">Skip to content</a>
    <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a>{MainNavigation({activeHref:'/arena'})}{signedIn ? <a className="og-header-action" href={'/signout-with-chatgpt?return_to=' + encodeURIComponent(returnPath)} target="_top" onClick={event => {if (!active()) {event.preventDefault(); return;} invalidate('Sign-out interrupted confirmation and cleared held payloads. Safe attempt dispositions remain.');}}>Sign out</a> : <a className="og-header-action" href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(returnPath)} target="_top">Sign in<ArrowUpRight size={14}/></a>}</header>
    <main id="arena-main" className="og-container">
    <header className="og-arena-header"><div><h1>Compare outcomes</h1><p>Reconstruct 2–4 exact public outcomes under their declared assumptions.</p></div><span className="og-arena-badge">Demo · no orders</span></header>
    <div className="og-arena-intro"><span>AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED</span><a href="/experiments">Find public outcomes<ArrowUpRight size={13}/></a></div>
    <section className="og-arena-panel" aria-label="Arena cohort draft"><div className="og-arena-panel-head"><h2>Selected outcomes</h2><span>{shownDraft.length}/{arenaLimits.members} members</span></div>
      <div className="og-arena-form"><label>Outcome UUID<input aria-label="Arena outcome UUID" maxLength={36} value={visibleContext ? id : ''} disabled={blocked || shownDraft.length >= arenaLimits.members} onChange={event => changeField('id', event.target.value)} spellCheck={false}/></label><label>Exact digest<input aria-label="Arena outcome digest" maxLength={64} value={visibleContext ? digest : ''} disabled={blocked || shownDraft.length >= arenaLimits.members} onChange={event => changeField('digest', event.target.value)} spellCheck={false}/></label><button className="og-button og-secondary" disabled={blocked || shownDraft.length >= arenaLimits.members} type="button" onClick={() => void add()}><Plus size={14}/>Add exact outcome</button></div>
      {shownDraft.length === 0 ? <div className="og-arena-empty"><FlaskConical size={26}/><p>Add exact outcomes from Experiments. No strategy, report or provider is selected automatically.</p></div> : <div className="og-arena-members">{shownDraft.map((member, index) => <article key={member.outcome.id} className="og-arena-member" aria-label={'Arena member ' + member.outcome.id}><div><span className="og-arena-index">{index + 1}</span><h3>{member.outcome.record?.content.name ?? 'Unavailable authored outcome'}</h3><button aria-label={'Remove Arena member ' + member.outcome.id} type="button" disabled={blocked} onClick={() => remove(index)}><X size={15}/></button></div><p>{member.strategy.record?.content.name ?? 'Unavailable strategy'} · {member.strategy.record?.content.definition.market.symbol} · {member.strategy.record?.content.definition.market.direction}</p><small>{member.outcome.author.kind} {short(member.outcome.author.id)} · sponsor {short(member.outcome.author.sponsorId)}</small>{member.outcome.record?.version===4&&<p className="og-arena-warning">PROGRAM_FORWARD_DEMO · HELD / FORWARD_PROTOCOL_UNSUPPORTED. Full forward member retained; every cohort member remains unranked. No financial diagnostics or baseline are computed for this method.</p>}<p className="og-arena-review">Latest review: {member.reviewContext.currentHead ? member.reviewContext.currentHead.state === 'VISIBLE' ? member.reviewContext.currentHead.decision : member.reviewContext.currentHead.state + ' · no older review substituted' : 'No retained head'} · {member.reviewContext.items.length} retained review records</p><details><summary>Disclosures &amp; exact sources</summary><p>{[...new Set([...(member.manifest.record?.flags ?? []), ...(member.outcome.record?.flags ?? [])])].join(' · ') || 'No derived disclosure flags'}</p><pre>{JSON.stringify(declaredAssumptions(member), null, 2)}</pre><ol className="og-arena-reviews">{member.reviewContext.items.map(review => <li key={review.id}>Review {review.sequence} · {review.state === 'VISIBLE' ? review.decision : review.state} · {review.reasons.join(' · ') || 'Authored reasons suppressed'}</li>)}</ol><a href={experimentHref(ref(member.outcome))} onClick={event => {if (!active() || !held.current.draft.includes(member)) event.preventDefault();}}>Inspect exact outcome<ArrowUpRight size={12}/></a></details></article>)}</div>}
      <label className="og-arena-check"><input type="checkbox" aria-label="Confirm Arena local data rights and whole cohort" checked={visibleContext && rights} disabled={blocked || shownDraft.length < 2} onChange={event => {if (!active() || life.current.busy || held.current.draft !== draft) return; held.current.rights = event.target.checked; setRights(event.target.checked);}}/><span>I have rights to use these public inputs locally. Freeze every selected member, retain failures and compare the full cohort; no unseen data, independent qualification or complete external search history is established.</span></label>
      <div className="og-arena-actions"><button className="og-button og-primary" type="button" disabled={blocked || !rights || shownDraft.length < 2 || attempts.length >= arenaLimits.attempts} onClick={() => void run()}><LockKeyhole size={14}/>Freeze cohort &amp; reconstruct</button>{busy === 'RUN' && <button className="og-button og-secondary" type="button" aria-label="Cancel Arena reconstruction" onClick={() => cancel(capturedOperation)}><X size={14}/>Cancel reconstruction</button>}<span>Maximum {arenaLimits.attempts} retained attempts. Reload loses unexported work.</span></div>
      {message && <p className="og-arena-message" role="status">{message}</p>}{busy && <p className="og-arena-loading" role="status">{busy === 'RUN' ? 'Reconstructing the complete frozen cohort…' : busy === 'EXPORT' ? 'Confirming every retained source and review before export…' : 'Checking exact public evidence and review history…'}</p>}
    </section>
    <section className="og-arena-history" aria-label="Arena attempt history"><div className="og-arena-history-head"><div><h2>Comparison history</h2><p>Editing the draft does not alter a frozen attempt. Losses, unsupported members and interruptions stay visible.</p></div><button className="og-button og-secondary" type="button" disabled={blocked || !attempts.length} onClick={() => void exportAll()}><Download size={14}/>Export complete Arena history</button></div>
      {shownAttempts.length === 0 && <div className="og-arena-empty"><p>No reconstruction admitted yet. Review a complete cohort and confirm local use first.</p></div>}
      {shownAttempts.map(attempt => <article className="og-arena-attempt" key={attempt.id} aria-label={'Arena attempt ' + attempt.id} data-status={attempt.status}><div className="og-arena-attempt-head"><div><span className="og-arena-badge">{attempt.status}</span><h3>{attempt.refs.length} frozen members · {short(attempt.id)}</h3></div><time dateTime={attempt.admittedAt}>{stamp(attempt.admittedAt)} Amsterdam</time></div>
        <p>{attempt.cleared ? 'Held source, review and report payloads cleared. Safe references and the prior disposition remain.' : attempt.current ? 'Exact source and review snapshots confirmed for this local result. Registry reads are point-in-time checks, not a frozen public registry.' : 'Historical or unfinished attempt; current public context is unconfirmed. No current rank is shown.'}</p>{attempt.error && <p className="og-arena-warning">{attempt.error}</p>}
        {attempt.report ? <><div className="og-arena-table-scroll"><table className="og-arena-table"><caption>Full selected cohort · freshly reconstructed values</caption><thead><tr><th scope="col">Local rank</th><th scope="col">Member</th><th scope="col">Reconstruction</th><th scope="col">Fresh equity</th><th scope="col">Return</th><th scope="col">Drawdown</th><th scope="col">Period Sharpe</th><th scope="col">Fees</th><th scope="col">Trades</th></tr></thead><tbody>{attempt.report.rows.map(row => <tr key={row.outcome.id}><td>{attempt.current && attempt.report!.ranking.eligible ? row.rank : '—'}</td><th scope="row">{row.name ?? short(row.outcome.id)}</th><td>{row.programComparison?.status ?? row.comparison?.status ?? row.status}{row.programComparison && <small>Generator · same implementation</small>}{row.programReconstructed && <small>{row.programReconstructed.status} · {row.programReconstructed.reason}</small>}{row.reason && <small>{row.reason}</small>}</td><td><EquityChart artifact={row.reconstructed}/></td><td className={row.reconstructed?.metrics && row.reconstructed.metrics.returnPct < 0 ? 'og-arena-negative' : ''}>{amount(row.reconstructed?.metrics?.returnPct)}{row.reconstructed?.metrics ? '%' : ''}</td><td>{amount(row.reconstructed?.metrics?.maxDrawdownPct)}{row.reconstructed?.metrics ? '%' : ''}</td><td>{amount(row.diagnostics?.periodSharpe)}</td><td>{amount(row.reconstructed?.metrics?.totalFees)}</td><td>{row.reconstructed?.metrics?.trades ?? '—'}</td></tr>)}</tbody></table></div>
          <p className="og-arena-ranking">{attempt.current && attempt.report.ranking.eligible ? 'Descriptive order within this operator-selected cohort: nonannualized mean closed-bar return / sample standard deviation, zero reference. This is not a qualified leaderboard.' : 'Rank withheld for this cohort.'} {attempt.report.ranking.reasons.join(' · ')}</p>
          <details><summary>Common assumptions, risks &amp; reconstruction details</summary><p>Selection: operator-selected public outcomes; complete external search history UNKNOWN. Unseen data NOT_ESTABLISHED. No independent data custody or financial authority is established.</p><p>{attempt.report.protocolDifferences.length ? attempt.report.protocolDifferences.join(' · ') : 'Every selected member shares the declared dataset, market, costs, risk limits, capital, horizon and method identities. Batch signals must match; program signals are regenerated separately for each strategy.'}</p><pre>{JSON.stringify(attempt.report.commonProtocol, null, 2)}</pre>{attempt.report.rows.map(row => <div className="og-arena-row-detail" key={row.outcome.id}><h4>{row.name ?? short(row.outcome.id)}</h4><p>{row.cautions.join(' · ') || 'No derived caution flags'} · {row.diagnostics?.sampleCount ?? 0}/{row.diagnostics?.expectedSamples ?? 0} observations · {row.diagnostics?.fullHorizon ? 'full declared horizon' : 'horizon unconfirmed'}</p><p>Mean period return {amount(row.diagnostics?.meanReturnPct)}% · dispersion {amount(row.diagnostics?.dispersionPct)}% · downside deviation {amount(row.diagnostics?.downsideDeviationPct)}%. {row.diagnostics?.reasons.join(' · ')}</p><p>Turnover {amount(row.reconstructed?.metrics?.turnover)} · total fees {amount(row.reconstructed?.metrics?.totalFees)} · closed trades {row.reconstructed?.metrics?.trades ?? '—'}. Cost-aware long benchmark: {row.reconstructed?.benchmark?.comparable ? amount(row.reconstructed.benchmark.returnPct) + '%' : 'UNAVAILABLE for comparison · ' + (row.reconstructed?.benchmark?.reason ?? 'noncomparable or missing baseline')}. Every comparison report, fresh artifact, audit event and equity point remains in the complete export.</p><ol className="og-arena-reviews">{attempt.members?.[row.index]?.reviewContext.items.map(review => <li key={review.id}>Review {review.sequence} · {review.state === 'VISIBLE' ? review.decision : review.state} · {review.reasons.join(' · ') || 'Authored reasons suppressed'}</li>)}</ol></div>)}</details>
        </> : <ul className="og-arena-dispositions">{attempt.refs.map((reference, index) => <li key={reference.id}><span>Member {index + 1}</span><code>{reference.id}</code><small>{reference.digest}</small><span>{attempt.status === 'RUNNING' ? 'Awaiting full-cohort confirmation' : attempt.status === 'INTERRUPTED' ? 'Interrupted member retained' : 'Unconfirmed member retained'}</span></li>)}</ul>}
      </article>)}
    </section><footer className="og-arena-footer"><a href="/validation"><RefreshCw size={13}/>Inspect a single reconstruction</a><a href={arenaHref(selection)}>Exact Arena link<ArrowUpRight size={13}/></a><p>Local browser memory only. No server publication, hosted code execution, AI inference, provider connection or Live order.</p></footer>
  </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><a href="/experiment-policy">Evidence policy</a></footer></div>;
}
