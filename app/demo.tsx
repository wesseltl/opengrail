'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, Download, FlaskConical, Play, RefreshCw, X} from 'lucide-react';
import {parseUniqueJson} from './unique-json';
import {boundedStrategyRecord, strategyRecordV1Schema, type StrategyRecordV1, strategyDigest, strategyListSchema, strategyGetSchema} from './strategy-model';
import {parseStrategyHandoff, verifyStrategyHandoff} from './strategy-handoff';
import {boundedDemoRequest, demoLimits, verifyDemoArtifact, type DemoArtifact, type DemoRequest} from './demo-model';
import {replayDemo, syntheticDemoInput} from './demo-engine';
import './network.css';
import './demo.css';

type Item = ReturnType<typeof strategyListSchema.parse>['items'][number];
type Strategy = StrategyRecordV1;
type Selection = {record: Strategy; digest: string; origin: 'PUBLIC_SNAPSHOT' | 'SYNTHETIC_OFFLINE'};
type Trial = {localId: string; attemptedAt: string; label: string; strategyDigest: string; source: {id: string; digest: string} | null; sourceConfirmed: boolean; priorStatus: Trial['status'] | null; origin: Selection['origin']; status: 'RUNNING' | 'INTERRUPTED' | 'INPUT_REJECTED' | 'OUTPUT_UNCONFIRMED' | 'CLEARED' | DemoArtifact['status']; error: string | null; input: DemoRequest | null; artifact: DemoArtifact | null};
const maximumTrials = 32;
const maximumHistoryBytes = maximumTrials * (demoLimits.artifactBytes + demoLimits.requestBytes) + 262_144;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const locationSearch = () => typeof window === 'undefined' ? '' : window.location.search;
const shortId = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const label = (selection: Selection) => selection.origin === 'SYNTHETIC_OFFLINE' ? 'Synthetic offline fixture' : selection.record.content.name;
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
class SourceUnavailable extends Error { constructor(readonly id: string) { super('Public source unavailable.'); } }

async function responseJson(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw Error('Missing catalog response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const {value, done} = await reader.read(); if (done) break; size += value.byteLength; if (size > 2_097_152) { await reader.cancel(); throw Error('Catalog response too large.'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), 2_097_152, 10);
}
async function verifyCatalog(items: Item[]) {
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => `${item.rootId}:${item.revision}`)).size !== items.length) throw Error('Duplicate catalog identity.');
  for (const item of items) if (item.record && await strategyDigest(boundedStrategyRecord(item.record).payload) !== item.digest) throw Error('Catalog digest mismatch.');
}

async function checkSource(selection: Selection, signal: AbortSignal) {
  if (selection.origin === 'SYNTHETIC_OFFLINE') return;
  signal.throwIfAborted();
  const response = await fetch('/api/strategies?id=' + encodeURIComponent(selection.record.id), {cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)])});
  if (response.status === 404) throw new SourceUnavailable(selection.record.id);
  if (!response.ok) throw Error('Public source confirmation unavailable.');
  const item = strategyGetSchema.parse(await responseJson(response)).item;
  signal.throwIfAborted();
  if (item.id !== selection.record.id || item.digest !== selection.digest) throw Error('Wrong source reference.');
  if (item.state !== 'VISIBLE' || !item.record) throw new SourceUnavailable(item.id);
  const verified = await verifyStrategyHandoff({id: selection.record.id, digest: selection.digest}, item);
  if (!same(verified.record, selection.record)) throw Error('Source content inconsistent.');
  signal.throwIfAborted();
}
function download(value: unknown, name: string, cap: number) {
  const payload = JSON.stringify(value); if (new TextEncoder().encode(payload).byteLength > cap) throw Error('Export exceeds its local byte budget.');
  const blob = new Blob([payload], {type: 'application/json'}), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export default function Demo({signedIn = false}: {signedIn?: boolean} = {}) {
  const [items, setItems] = useState<Item[]>([]), [cursor, setCursor] = useState<string | null>(null), [pageCursor, setPageCursor] = useState<string | null>(null), [catalogBusy, setCatalogBusy] = useState(false), [catalogError, setCatalogError] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null), [json, setJson] = useState(''), [rights, setRights] = useState(false), [busy, setBusy] = useState<'IMPORT' | 'EXAMPLE' | 'RUN' | 'EXPORT' | null>(null), [message, setMessage] = useState('');
  const [trials, setTrials] = useState<Trial[]>([]), [exportError, setExportError] = useState('');
  const life = useRef({alive: true, epoch: 0, catalogId: 0, workId: 0, busy: null as typeof busy, activeTrial: null as string | null, pendingSourceId: null as string | null, search: locationSearch(), previousSignedIn: signedIn, reads: new Set<AbortController>()});
  const current = useRef({items, selection, json, rights, trials}); current.current = {items, selection, json, rights, trials};
  const renderEpoch = life.current.epoch;
  function updateTrials(next: Trial[]) { current.current.trials = next; setTrials(next); }
  function replaceTrial(id: string, changes: Partial<Trial>) { updateTrials(current.current.trials.map(trial => trial.localId === id ? {...trial, ...changes} : trial)); }
  function invalidate(reason: string) {
    const state = life.current; state.epoch++; state.workId++;
    state.catalogId++; state.reads.forEach(controller => controller.abort()); state.reads.clear();
    if (state.activeTrial) { const trial = current.current.trials.find(value => value.localId === state.activeTrial); replaceTrial(state.activeTrial, {status: trial?.artifact ? 'OUTPUT_UNCONFIRMED' : 'INTERRUPTED', priorStatus: trial?.artifact?.status ?? trial?.priorStatus ?? null, error: trial?.artifact ? 'Computation retained, but final current-source confirmation was interrupted.' : reason}); }
    state.activeTrial = null; state.pendingSourceId = null; state.busy = null; setBusy(null);
  }
  function clearSelection() { current.current.selection = null; current.current.json = ''; current.current.rights = false; setSelection(null); setJson(''); setRights(false); }
  function clearSource(id: string) {
    invalidate('Observed public source suppression interrupted local confirmation.');
    updateTrials(current.current.trials.map(trial => trial.source?.id === id ? {...trial, label: 'Public source unavailable', priorStatus: trial.priorStatus ?? trial.artifact?.status ?? trial.status, input: null, artifact: null, sourceConfirmed: false, status: 'CLEARED', error: 'Current public source unavailable; held payload cleared. Earlier exports cannot be recalled.'} : trial));
    if (current.current.selection?.record.id === id) clearSelection();
    current.current.items = current.current.items.filter(item => item.id !== id); setItems(current.current.items);
  }
  function clearPayloads(reason: string) {
    invalidate(reason); clearSelection(); current.current.items = []; setItems([]);
    updateTrials(current.current.trials.map(trial => ({...trial, label: trial.origin === 'PUBLIC_SNAPSHOT' ? 'Public strategy payload cleared' : 'Synthetic fixture payload cleared', priorStatus: trial.priorStatus ?? trial.artifact?.status ?? trial.status, input: null, artifact: null, sourceConfirmed: false, status: 'CLEARED', error: reason})));
  }
  useEffect(() => {
    life.current.alive = true; life.current.search = locationSearch(); void loadCatalog(null, life.current.search);
    const changed = () => { clearPayloads('URL navigation cleared held inputs and results; safe attempt metadata remains.'); life.current.search = locationSearch(); void loadCatalog(null, life.current.search); };
    if (typeof window !== 'undefined') window.addEventListener('popstate', changed);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('popstate', changed); const state = life.current; state.alive = false; state.epoch++; state.workId++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.activeTrial = null; state.busy = null; current.current.selection = null; current.current.json = ''; current.current.rights = false; current.current.trials = []; };
  }, []);
  useEffect(() => { if (life.current.previousSignedIn && !signedIn) clearPayloads('Sign-out cleared held inputs and results; safe attempt metadata remains.'); life.current.previousSignedIn = signedIn; }, [signedIn]);
  function available(epoch = renderEpoch) { return life.current.alive && life.current.epoch === epoch && life.current.search === locationSearch() && !life.current.busy; }
  function operation(kind: NonNullable<typeof busy>, sourceId: string | null = null) {
    const state = life.current, controller = new AbortController(), epoch = state.epoch, id = ++state.workId;
    state.busy = kind; state.pendingSourceId = sourceId; state.reads.add(controller); setBusy(kind);
    return {signal: controller.signal, valid: () => state.alive && state.epoch === epoch && state.workId === id && state.search === locationSearch() && !controller.signal.aborted, done: () => { state.reads.delete(controller); if (state.alive && state.epoch === epoch && state.workId === id) { state.busy = null; state.pendingSourceId = null; setBusy(null); } }};
  }
  function selectedExact(value: Selection) {
    return value.origin === 'SYNTHETIC_OFFLINE' || current.current.items.some(item => item.record && item.state === 'VISIBLE' && item.digest === value.digest && same(item.record, value.record));
  }
  async function loadCatalog(next: string | null = null, handoffSearch?: string) {
    const state = life.current; if (!state.alive) return;
    const known = [...current.current.trials.flatMap(trial => trial.source ? [trial.source] : []), ...(current.current.selection?.origin === 'PUBLIC_SNAPSHOT' ? [{id: current.current.selection.record.id, digest: current.current.selection.digest}] : [])];
    invalidate('Catalog navigation interrupted this attempt before confirmation.'); clearSelection(); setMessage(''); setCatalogBusy(true); setCatalogError('');
    current.current.items = []; setItems([]); setCursor(null);
    const id = ++state.catalogId, epoch = state.epoch, controller = new AbortController(); state.reads.add(controller);
    const valid = () => state.alive && id === state.catalogId && epoch === state.epoch && state.search === locationSearch() && !controller.signal.aborted;
    try {
      const reference = handoffSearch === undefined ? null : parseStrategyHandoff(handoffSearch);
      const response = await fetch('/api/strategies' + (reference ? '?id=' + encodeURIComponent(reference.id) : next ? '?cursor=' + encodeURIComponent(next) : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!valid()) return;
      if (!response.ok) throw Error('Catalog unavailable.');
      const raw = await responseJson(response);
      const result = reference ? {items: [await verifyStrategyHandoff(reference, strategyGetSchema.parse(raw).item)], nextCursor: null} : strategyListSchema.parse(raw); await verifyCatalog(result.items);
      if (!valid()) return;
      for (const item of result.items) if (known.some(reference => reference.id === item.id && reference.digest !== item.digest)) throw Error('Catalog contradicts retained immutable source.');
      for (const item of result.items) if (item.state !== 'VISIBLE' && current.current.trials.some(trial => trial.source?.id === item.id)) clearSource(item.id);
      if (!valid()) { setCatalogBusy(false); return; }
      current.current.items = result.items; setItems(result.items); setCursor(result.nextCursor); setPageCursor(next);
      if (reference) { const item = result.items[0]; const selected: Selection = {record: strategyRecordV1Schema.parse(item.record), digest: item.digest, origin: 'PUBLIC_SNAPSHOT'}; current.current.selection = selected; setSelection(selected); setMessage('Linked exact strategy selected. No inputs, replay or permission were enabled.'); }
    } catch { if (valid()) setCatalogError(handoffSearch ? 'Exact strategy link rejected or unavailable. No latest version or synthetic fallback was selected. Refresh the catalog to choose another definition.' : 'Public catalog unavailable. Refresh to retry, or use the clearly marked offline synthetic fixture.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.catalogId) setCatalogBusy(false); }
  }
  function choose(item: Item) {
    if (!available() || !item.record || item.record.version !== 1 || item.state !== 'VISIBLE' || !current.current.items.some(row => same(row, item))) return;
    invalidate('Changing the strategy interrupted this attempt before confirmation.');
    const next: Selection = {record: structuredClone(item.record), digest: item.digest, origin: 'PUBLIC_SNAPSHOT'};
    current.current.selection = next; current.current.json = ''; current.current.rights = false;
    setSelection(next); setJson(''); setRights(false); setMessage('Load synthetic inputs or import a replay request bound to this exact strategy.');
  }
  async function example(offline: boolean) {
    const selected = current.current.selection;
    if (!available() || current.current.selection !== selection || current.current.json !== json || (!offline && (!selected || !selectedExact(selected)))) return;
    const work = operation('EXAMPLE', !offline && selected?.origin === 'PUBLIC_SNAPSHOT' ? selected.record.id : null); setMessage('');
    try {
      if (!offline && selected) await checkSource(selected, work.signal); if (!work.valid()) return;
      const request = boundedDemoRequest(await syntheticDemoInput(offline ? undefined : structuredClone({record: selected!.record, digest: selected!.digest}))).input;
      if (!work.valid()) return;
      const next: Selection = offline ? {record: request.strategy.record, digest: request.strategy.digest, origin: 'SYNTHETIC_OFFLINE'} : selected!;
      if (!selectedExact(next) || request.strategy.digest !== next.digest || !same(request.strategy.record, next.record)) throw Error('Synthetic binding mismatch.');
      if (!offline) await checkSource(next, work.signal); if (!work.valid()) return;
      current.current.selection = next; current.current.json = JSON.stringify(request, null, 2); current.current.rights = false;
      setSelection(next); setJson(current.current.json); setRights(false); setMessage('Synthetic inputs prepared. These generated bars and signals are not market observations.');
    } catch (error) { if (work.valid()) { if (error instanceof SourceUnavailable) clearSource(error.id); setMessage('Synthetic preparation failed. No replay was run.'); } } finally { work.done(); }
  }
  function edit(value: string) {
    if (!available() || current.current.selection !== selection || current.current.json !== json) return;
    current.current.json = value; current.current.rights = false; setJson(value); setRights(false); setMessage('');
  }
  async function importInput(file: File | undefined) {
    const state = life.current; if (!file || !available() || !current.current.selection || current.current.selection !== selection || current.current.json !== json) return;
    const epoch = state.epoch, id = ++state.workId; state.busy = 'IMPORT'; setBusy('IMPORT'); setMessage('');
    try {
      if (file.size > demoLimits.requestBytes) throw Error('Input too large.');
      const bytes = await file.arrayBuffer();
      if (!state.alive || epoch !== state.epoch || id !== state.workId || state.busy !== 'IMPORT' || state.search !== locationSearch()) return;
      if (bytes.byteLength > demoLimits.requestBytes) throw Error('Input too large.');
      const raw = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
      current.current.json = raw; current.current.rights = false; setJson(raw); setRights(false); setMessage('File read locally. Confirm its rights and provenance before replay; import alone does not run it.');
    } catch { if (state.alive && epoch === state.epoch && id === state.workId) setMessage('Import failed. Use a bounded UTF-8 JSON replay request. No file was uploaded or run.'); }
    finally { if (state.alive && epoch === state.epoch && id === state.workId) { state.busy = null; setBusy(null); } }
  }
  async function run() {
    const view = current.current, selected = view.selection;
    if (!available() || !selected || selected !== selection || view.json !== json || view.rights !== rights || !view.rights || !selectedExact(selected) || view.trials.length >= maximumTrials) return;
    const trialId = crypto.randomUUID(), work = operation('RUN', selected.origin === 'PUBLIC_SNAPSHOT' ? selected.record.id : null); life.current.activeTrial = trialId; setMessage('');
    updateTrials([...view.trials, {localId: trialId, attemptedAt: new Date().toISOString(), label: label(selected), strategyDigest: selected.digest, source: selected.origin === 'PUBLIC_SNAPSHOT' ? {id: selected.record.id, digest: selected.digest} : null, sourceConfirmed: selected.origin === 'SYNTHETIC_OFFLINE', origin: selected.origin, priorStatus: null, status: 'RUNNING', error: null, input: null, artifact: null}]);
    let captured: DemoRequest | null = null, invoked = false;
    try {
      captured = boundedDemoRequest(parseUniqueJson(view.json, demoLimits.requestBytes, 12)).input;
      if (captured.strategy.digest !== selected.digest || !same(captured.strategy.record, selected.record) || await strategyDigest(boundedStrategyRecord(captured.strategy.record).payload) !== selected.digest) throw Error('Wrong strategy binding.');
      if (!work.valid()) return;
      await checkSource(selected, work.signal); if (!work.valid()) return;
      replaceTrial(trialId, {input: captured}); invoked = true;
      const artifact = await verifyDemoArtifact(await replayDemo(structuredClone(captured)));
      if (!work.valid() || life.current.activeTrial !== trialId) return;
      if (!same(artifact.input, captured)) throw Error('Uncorrelated replay output.');
      // Preserve computed adverse evidence on transient post-check failure, without displaying it as current-source confirmed.
      replaceTrial(trialId, {artifact, sourceConfirmed: selected.origin === 'SYNTHETIC_OFFLINE'});
      await checkSource(selected, work.signal); if (!work.valid()) return;
      replaceTrial(trialId, {status: artifact.status, sourceConfirmed: true, error: null});
    } catch (error) {
      if (work.valid() && life.current.activeTrial === trialId) {
        if (error instanceof SourceUnavailable) { clearSource(error.id); setMessage('Public source unavailable. Related held inputs and results cleared; safe attempt metadata remains.'); }
        else replaceTrial(trialId, {status: invoked ? 'OUTPUT_UNCONFIRMED' : 'INPUT_REJECTED', error: invoked ? 'Computed evidence retained locally, but output or current-source confirmation is unavailable. Fresh source checks are required before export or display.' : 'Replay input or current public source confirmation rejected. No rules were run; no suppression was inferred from a transport failure.'});
      }
    } finally { if (work.valid()) life.current.activeTrial = null; work.done(); }
  }
  function cancel() { if (!life.current.alive || renderEpoch !== life.current.epoch) return; invalidate('Cancelled before a correlated local result was confirmed.'); setMessage('The interrupted attempt remains in the session. No orders can be placed.'); }
  async function exportInput() {
    const view = current.current, selected = view.selection;
    if (!available() || !selected || selected !== selection || view.json !== json || !selectedExact(selected)) return;
    const work = operation('EXPORT', selected.origin === 'PUBLIC_SNAPSHOT' ? selected.record.id : null);
    try {
      const input = boundedDemoRequest(parseUniqueJson(view.json, demoLimits.requestBytes, 12)).input;
      if (input.strategy.digest !== selected.digest || !same(input.strategy.record, selected.record)) throw Error('Input binding mismatch.');
      await checkSource(selected, work.signal); if (!work.valid() || current.current.selection !== selected || current.current.json !== view.json) return;
      download(input, `opengrail-demo-input-${input.requestId}.json`, demoLimits.requestBytes);
      setMessage('Exact input exported locally. A public strategy input can be registered in Experiments before replay; public sharing needs separate confirmation.');
    } catch (error) { if (work.valid()) { if (error instanceof SourceUnavailable) clearSource(error.id); setMessage('Input export failed. Confirm a valid bounded request and its currently visible exact source.'); } } finally { work.done(); }
  }
  async function exportHistory() {
    if (!available() || !current.current.trials.length) return;
    const captured = [...current.current.trials], work = operation('EXPORT');
    try {
      for (const trial of captured) if (trial.source && (trial.input || trial.artifact)) { const input = trial.artifact?.input ?? trial.input; if (!input) throw Error('Missing bound input.'); life.current.pendingSourceId = trial.source.id; await checkSource({record: input.strategy.record, digest: trial.source.digest, origin: 'PUBLIC_SNAPSHOT'}, work.signal); if (!work.valid()) return; }
      if (!same(current.current.trials, captured)) return;
      download({version: 1,source: 'LOCAL_SESSION_UNQUALIFIED',retention: 'EXPORTED_SNAPSHOT',executionEnabled: false,trials: captured}, 'opengrail-local-demo-session.json', maximumHistoryBytes); setExportError('');
    } catch (error) { if (work.valid()) { if (error instanceof SourceUnavailable) clearSource(error.id); setExportError('History export withheld; exact public source confirmation is unavailable. Held evidence remains session-only unless its source is known unavailable.'); } } finally { work.done(); }
  }
  async function exportArtifact(trial: Trial) {
    if (!available() || !trial.artifact || !current.current.trials.some(row => row.localId === trial.localId && row.artifact?.resultDigest === trial.artifact?.resultDigest)) return;
    const artifact = trial.artifact, work = operation('EXPORT', trial.source?.id ?? null);
    try {
      if (trial.source) { if (!artifact.input) throw Error('Missing bound input.'); await checkSource({record: artifact.input.strategy.record, digest: trial.source.digest, origin: 'PUBLIC_SNAPSHOT'}, work.signal); }
      if (!work.valid() || !current.current.trials.some(row => row.localId === trial.localId && row.artifact?.resultDigest === artifact.resultDigest)) return;
      download(artifact, `opengrail-demo-${trial.localId}.json`, demoLimits.artifactBytes);
      replaceTrial(trial.localId, {sourceConfirmed: true, status: artifact.status, error: null}); setExportError('');
    } catch (error) { if (work.valid()) { if (error instanceof SourceUnavailable) clearSource(error.id); setExportError('Artifact export withheld; exact current source confirmation failed.'); } } finally { work.done(); }
  }

  return <div className="og-network og-demo"><a className="og-skip" href="#demo-main">Skip to content</a><header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a><nav aria-label="Main navigation"><a href="/">The network</a><a href="/research">Research</a><a href="/venture">Venture</a><a href="/strategies">Strategies</a><a href="/demo" aria-current="page">Demo</a><a href="/session">Sessions</a><a href="/experiments">Experiments</a><a href="/validation">Validation</a></nav><a className="og-header-action" href="/strategies">Strategy Hub<ArrowUpRight size={14}/></a></header>
    <main id="demo-main"><section className="og-demo-header"><div><span className="og-eyebrow">LOCAL DEMO REPLAY</span><h1>Test the exact rules.</h1><p>Replay a strategy against supplied closed bars. Inspect costs, losses and decisions before treating a definition as evidence.</p></div><span className="og-demo-local">Browser only · orders disabled</span></section>
      <div className="og-demo-layout"><section className="og-demo-panel" aria-label="Demo strategy selection"><div className="og-demo-panel-head"><h2>1. Choose a definition</h2><button className="og-button og-secondary og-icon-button" type="button" aria-label="Refresh demo catalog" disabled={catalogBusy} onClick={() => void loadCatalog()}><RefreshCw size={15}/></button></div>
        {catalogBusy && <p role="status">Loading public definitions…</p>}{catalogError && <p className="og-demo-message" role="alert">{catalogError}</p>}
        <p>Programmable sources use <a href="/program">Program replay</a>.</p><div className="og-demo-choice-list">{items.filter(item => item.record?.version === 1 && item.state === 'VISIBLE').map(item => <button className="og-demo-choice" type="button" aria-label={`Select strategy ${item.id}`} aria-pressed={selection?.origin === 'PUBLIC_SNAPSHOT' && selection.record.id === item.id} key={item.id} onClick={() => choose(item)}><div><strong>{item.record!.content.name}</strong><small>{item.record!.content.definition.entry.type} · {item.record!.content.definition.market.symbol} · {item.record!.content.definition.market.timeframe} · {item.record!.content.definition.market.direction}<br/>{item.author.kind === 'HUMAN' ? 'Human' : 'Agent'} {shortId(item.author.id)} · human sponsor {shortId(item.author.sponsorId)} · v{item.revision}</small></div><span>UNTESTED</span></button>)}</div>
        {!catalogBusy && !catalogError && !items.some(item => item.record) && <p>No visible public definitions on this page. The offline example can still demonstrate the evaluator.</p>}
        <div className="og-demo-catalog-actions">{pageCursor && <button className="og-button og-secondary" type="button" disabled={catalogBusy} onClick={() => void loadCatalog()}>Latest definitions</button>}{cursor && <button className="og-button og-secondary" type="button" disabled={catalogBusy} onClick={() => void loadCatalog(cursor)}>Next definitions<ArrowRight size={14}/></button>}</div>
        <div className="og-demo-offline"><button className="og-button og-secondary" type="button" disabled={!!busy} onClick={() => void example(true)}><FlaskConical size={14}/>Use synthetic offline example</button><p>Generated prices and signals. No published author, market feed or registered experiment is implied.</p></div>
        {selection && <div className="og-demo-selected"><h3>{label(selection)}</h3><p>{selection.origin === 'SYNTHETIC_OFFLINE' ? 'Synthetic fixture · not a public strategy or registered author.' : 'Digest checked against the exact visible public definition captured locally.'}</p><div className="og-demo-reference">ID {selection.record.id}<br/>Root {selection.record.rootId} · v{selection.record.revision}<br/>Digest {selection.digest}</div><details><summary>Exact definition &amp; costs</summary><pre className="og-demo-definition">{JSON.stringify(selection.record.content.definition, null, 2)}</pre></details></div>}
      </section><section className="og-demo-panel" aria-label="Demo replay inputs"><div className="og-demo-panel-head"><h2>2. Supply the inputs</h2><span>No uploads</span></div><div className="og-demo-input"><p>Full replay request: exact strategy, closed bars, available-at signals, capital, hypothesis and falsification. Fees and slippage come from the selected definition.</p>
        <label>Replay JSON file<input aria-label="Import replay JSON" type="file" accept=".json,application/json" disabled={!!busy || !selection} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void importInput(file);}}/></label>
        <label>Replay request<textarea aria-label="Replay request JSON" rows={12} maxLength={demoLimits.requestBytes} spellCheck={false} value={json} disabled={!!busy || !selection} onChange={event => edit(event.target.value)} placeholder="Choose a public strategy or the clearly marked synthetic example."/></label>
        {selection && <p className="og-demo-input-note">Capital uses {selection.record.content.definition.market.symbol.split('/')[1]} quote units. No deposit, currency conversion or account connection is involved.</p>}
        <label className="og-demo-consent"><input aria-label="Confirm input rights and provenance" type="checkbox" checked={rights} disabled={!!busy || !selection} onChange={event => {if (available() && current.current.selection === selection && current.current.json === json) {current.current.rights = event.target.checked; setRights(event.target.checked);}}}/><span>I have permission to use these inputs and their provenance and rights note are truthful. Synthetic inputs are generated examples, not quotes.</span></label>
        <p className="og-demo-input-note">Data stays in this page. Export the input to <a href="/experiments">register an experiment</a> before running; save session history before leaving. Results remain simulated author reports.</p>
      </div><div className="og-demo-actions"><button className="og-button og-secondary" type="button" disabled={!!busy || !selection} onClick={() => void example(false)}>Load synthetic inputs</button><button className="og-button og-secondary" type="button" aria-label="Export replay input" disabled={!!busy || !selection || !json} onClick={() => void exportInput()}><Download size={14}/>Export input</button><button className="og-button og-primary" type="button" disabled={!!busy || !selection || !rights || !json || trials.length >= maximumTrials} onClick={() => void run()}><Play size={14}/>Run local replay</button>{busy && <button className="og-button og-secondary" type="button" onClick={cancel}><X size={13}/>Cancel local work</button>}</div>
        {busy && <p className="og-demo-message" role="status">{busy === 'IMPORT' ? 'Reading replay file…' : busy === 'EXAMPLE' ? 'Preparing synthetic inputs…' : busy === 'EXPORT' ? 'Checking exact sources before export…' : 'Running local replay…'}</p>}{message && <p className="og-demo-message" role="status">{message}</p>}
      </section></div>
      <section className="og-demo-trials" aria-label="Complete local trial history"><div className="og-demo-trials-head"><div><h2>Every attempt, this session</h2><p>{trials.length}/{maximumTrials} retained · failed and interrupted trials stay visible. Export before leaving.</p></div><button className="og-button og-secondary" type="button" disabled={!!busy || trials.length === 0} onClick={() => void exportHistory()}><Download size={14}/>Export complete session</button></div>{exportError && <p className="og-demo-message" role="alert">{exportError}</p>}{trials.length >= maximumTrials && <p className="og-demo-message" role="status">Session trial capacity reached. Export all attempts before starting a new page session; prior trials are never dropped to make room.</p>}
        {!trials.length ? <div className="og-demo-empty"><FlaskConical size={26}/><h3>No local results yet.</h3><p>A replay will appear here with its exact inputs, costs and audit trail. Nothing is registered or saved by opening this page.</p></div> : <div className="og-demo-trial-list">{trials.map(trial => <TrialCard key={trial.localId} trial={trial} exportDisabled={!!busy} onExport={() => void exportArtifact(trial)}/>)}</div>}
        <p className="og-demo-export-note">Session-only history. Exported artifacts retain the captured inputs and public strategy snapshot. Digests establish content consistency, not data quality or independent evidence.</p>
      </section>
    </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Exact inputs. Costs included. No execution authority.</p><a href="/demo-methodology">Replay methodology<ArrowUpRight size={12}/></a></footer>
  </div>;
}

const amount = (value: number, digits = 2) => new Intl.NumberFormat('en-GB', {maximumFractionDigits: digits, minimumFractionDigits: Math.min(2, digits)}).format(value);
const percent = (value: number) => `${amount(value, 4)}%`;

function EquityChart({artifact}: {artifact: DemoArtifact}) {
  if (!artifact.equity.length || !artifact.metrics) return null;
  const points = artifact.equity, width = 680, height = 150, padding = 10, initial = artifact.metrics.initialCapital;
  const scale = Math.max(1, Math.abs(initial), ...points.map(point => Math.abs(point.equity)));
  const low = Math.min(initial / scale, ...points.map(point => point.equity / scale)), high = Math.max(initial / scale, ...points.map(point => point.equity / scale)), range = high - low || .001;
  const y = (value: number) => height - padding - (value / scale - low) / range * (height - 2 * padding);
  const sampled = points.filter((_, index) => index % Math.max(1, Math.ceil(points.length / 200)) === 0 || index === points.length - 1);
  const line = sampled.map(point => `${padding + point.barIndex / Math.max(1, points.at(-1)!.barIndex) * (width - 2 * padding)},${y(point.equity)}`).join(' ');
  return <figure className="og-demo-chart"><svg role="img" aria-label="Actual simulated account equity by supplied closed bar" viewBox={`0 0 ${width} ${height}`}><line x1={padding} x2={width - padding} y1={y(initial)} y2={y(initial)} stroke="#c6c0ba" strokeDasharray="4 5"/><polyline points={line} fill="none" stroke={artifact.metrics.netPnl >= 0 ? '#3f6c52' : '#914557'} strokeWidth="2" strokeLinejoin="round"/></svg><figcaption>Computed closed-bar equity · {points.length} observations · initial capital shown as a dashed line. The display may sample points; the export retains the full series.</figcaption></figure>;
}

function TrialCard({trial, exportDisabled, onExport}: {trial: Trial; exportDisabled: boolean; onExport: () => void}) {
  const a = trial.sourceConfirmed ? trial.artifact : null, m = a?.metrics, input = a?.input, definition = input?.strategy.record.content.definition;
  const quote = definition?.market.symbol.split('/')[1] ?? 'capital units', benchmark = a?.benchmark;
  const comparable = !!m?.comparable && !!benchmark?.comparable && benchmark.status === 'COMPLETED';
  return <article className="og-demo-trial" aria-label={`Local trial ${trial.localId}`}><div className="og-demo-trial-head"><div><span className="og-demo-trial-state">{trial.status.replaceAll('_', ' ')}</span><h3>{trial.label}</h3></div><time dateTime={trial.attemptedAt}>{stamp(trial.attemptedAt)} Amsterdam</time></div>{trial.priorStatus && <p className="og-demo-trial-status">Previous disposition: {trial.priorStatus.replaceAll('_', ' ')}. Earlier disposition is retained as metadata.</p>}{trial.error && <p className="og-demo-trial-status" role="status">{trial.error}</p>}
    {trial.artifact && !trial.sourceConfirmed && <p className="og-demo-trial-status">Computed artifact retained; current source confirmation unavailable. Metrics withheld until a fresh successful source check.</p>}
    {a && <><p className="og-demo-trial-status">{a.classification} · {a.mode} · {input?.dataset.provenance ?? 'Input rejected'}{a.reason ? ` · ${a.reason}` : ''}. Orders disabled. {a.status === 'FAILED' ? 'Failed replay; metrics are not comparable and losses have not been clipped.' : a.status === 'NO_TRADES' ? 'No trades occurred under these exact inputs and rules.' : 'Local simulation, without independent reproduction or forward evidence.'}</p>
      {m && <><dl className="og-demo-metrics"><div><dt>Net account return</dt><dd className={m.netPnl >= 0 ? 'og-demo-positive' : 'og-demo-negative'}>{percent(m.returnPct)}</dd></div><div><dt>Maximum drawdown</dt><dd>{percent(m.maxDrawdownPct)}</dd></div><div><dt>Closed trades</dt><dd>{m.trades}</dd></div><div><dt>Realized fees</dt><dd>{amount(m.totalFees)} <small>{quote}</small></dd></div></dl><p className="og-demo-trial-status">Initial {amount(m.initialCapital)} → final {amount(m.finalEquity)} {quote}. Net P&amp;L {amount(m.netPnl, 4)} {quote}. {m.wins} wins · {m.losses} losses. {m.comparable ? 'Metrics describe these supplied inputs only.' : 'Incomparable result; do not rank or select it by return.'}</p></>}
      {definition && <p className="og-demo-trial-status">{definition.costs.feeBps} bps fee + {definition.costs.slippageBps} bps slippage per side · {definition.risk.positionPct}% total allocation · SL {definition.risk.stopLossPct}% · TP {definition.risk.takeProfitPct}% · daily loss stop {definition.risk.maxDailyLossPct}% · maximum {definition.risk.maxOpenPositions} positions.</p>}
      {a.equity.length > 0 && <EquityChart artifact={a}/>}
      {benchmark && <p className="og-demo-trial-status">{comparable ? `Buy-and-hold LONG baseline: ${percent(benchmark.returnPct)} net account return, same supplied intervals, capital, allocation and cost assumptions.` : 'Baseline not comparable with this result; no outperformance claim is made.'} {benchmark.reason ? `Baseline disposition: ${benchmark.reason}.` : ''}</p>}
      <details><summary>Trades &amp; stop evidence ({a.trades.length})</summary>{a.trades.length ? <div className="og-demo-table-scroll"><table className="og-demo-table"><thead><tr><th>Position</th><th>Direction</th><th>Entry bar / fill</th><th>Exit bar / fill</th><th>Net P&amp;L</th><th>Exit reason</th></tr></thead><tbody>{a.trades.slice(0, 40).map(trade => <tr key={trade.id}><td>{trade.id}</td><td>{trade.direction}</td><td>{trade.entryBar} / {amount(trade.entryPrice, 6)}</td><td>{trade.exitBar} / {amount(trade.exitPrice, 6)}</td><td>{amount(trade.netPnl, 4)} {quote}</td><td>{trade.reason}</td></tr>)}</tbody></table></div> : <p>No closed trades are present in this artifact.</p>}{a.trades.length > 40 && <p>Showing the first 40 trades; the artifact export contains every trade.</p>}<p>Fills include the declared slippage; net P&amp;L includes entry and exit fees. The artifact records quantities, collateral, signals and timestamps.</p></details>
      <details><summary>Decision audit &amp; position limits ({a.audit.length})</summary><div className="og-demo-table-scroll"><table className="og-demo-table"><thead><tr><th>Bar</th><th>Event</th><th>Disposition</th><th>Position</th><th>Evidence</th></tr></thead><tbody>{a.audit.slice(0, 40).map((event, index) => <tr key={index}><td>{event.barIndex ?? '—'}</td><td>{event.type}</td><td>{event.reason}</td><td>{event.positionId ?? '—'}</td><td>{event.details}</td></tr>)}</tbody></table></div>{a.audit.length > 40 && <p>Showing the first 40 events; the artifact export retains the complete decision and rejection audit.</p>}<p>Signals are supplied observations with availability times, not a connected provider. Entries, unused signals, rejected virtual entries, halts and resets remain in the artifact.</p></details>
    </>}
    <details><summary>Exact local reference</summary><p className="og-demo-reference">Local attempt {trial.localId}<br/>Strategy digest {trial.strategyDigest}<br/>{trial.origin === 'SYNTHETIC_OFFLINE' ? 'Synthetic offline fixture, no registered author.' : 'Public strategy snapshot captured locally.'}{a && <><br/>Evaluator {a.evaluatorVersion}<br/>Request digest {a.digests.request ?? 'UNKNOWN'}<br/>Dataset digest {a.digests.dataset ?? 'UNKNOWN'}<br/>Signals digest {a.digests.signals ?? 'UNKNOWN'}<br/>Result digest {a.resultDigest}</>}</p></details>
    {trial.artifact && <div className="og-demo-actions"><button className="og-button og-secondary" type="button" disabled={exportDisabled} onClick={onExport}><Download size={13}/>Export reproducible artifact</button></div>}
  </article>;
}
