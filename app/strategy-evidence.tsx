'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, Braces, FlaskConical, Radio, RefreshCw} from 'lucide-react';
import {parseUniqueJson} from './unique-json';
import {boundedStrategyRecord, strategyDigest, strategyGetSchema, strategyLimits, verifyStrategyProgram, type StrategyPublicItem} from './strategy-model';
import {strategyEvidenceHref, strategyEvidenceLimits, strategyEvidencePageSchema, validateStrategyEvidencePage} from './strategy-evidence-model';
import {strategyHandoffHref} from './strategy-handoff';
import {strategyLineageHref} from './strategy-lineage-model';
import {programHref} from './program-link';
import {assistanceHref} from './assistance-handoff';
import {experimentHref} from './experiment-link';
import {experimentLimits} from './experiment-model';
import './network.css';
import './strategy-evidence.css';

type Page = ReturnType<typeof strategyEvidencePageSchema.parse>;
type Entry = Page['items'][number];
type Selection = {id: string; digest: string | null};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const key = (value: {id: string; digest: string}) => value.id + ':' + value.digest;
const before = (item: {id: string; createdAt: string}, anchor: {id: string; createdAt: string}) => item.createdAt < anchor.createdAt || item.createdAt === anchor.createdAt && item.id < anchor.id;
const short = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
const number = (value: number) => new Intl.NumberFormat('en-GB', {maximumFractionDigits: 2}).format(value);
const tone = (value: number) => value < 0 ? 'og-evidence-negative' : value > 0 ? 'og-evidence-positive' : undefined;

async function read(response: Response, cap: number = strategyEvidenceLimits.responseBytes): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw Error('Missing evidence response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > cap) { await reader.cancel(); throw Error('Evidence response exceeds its byte budget.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let position = 0; for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), cap, 16);
}
function scrub(entry: Entry, sourceUnavailable = false): Entry {
  const {method: _method, ...summary} = entry.summary;
  return {...entry, summary: {...summary, state: summary.state === 'WITHDRAWN' ? 'WITHDRAWN' : 'HIDDEN', suppression: sourceUnavailable ? 'SOURCE_UNAVAILABLE' : summary.suppression, name: null, status: null, flags: []}, claim: null, observation: null};
}

export default function StrategyEvidence({signedIn, selection, selectionError = ''}: {signedIn: boolean; selection: Selection | null; selectionError?: string}) {
  const [heldSource, setSource] = useState<StrategyPublicItem | null>(null), [heldItems, setItems] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [pageCursor, setPageCursor] = useState<string | null>(null), [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const runtime = useRef({alive: true, generation: 0, readId: 0, busy: false, signedIn, selectionKey: '', pinned: null as {id: string; digest: string} | null, reads: new Set<AbortController>(), sources: new Map<string, StrategyPublicItem>(), rows: new Map<string, Entry>(), suppressed: new Map<string, Entry>(), visited: new Set<string>()});
  const target = useRef({selectionKey: '', signedIn}); target.current = {selectionKey: JSON.stringify({selection, selectionError}), signedIn};
  const contextCurrent = runtime.current.selectionKey === target.current.selectionKey && runtime.current.signedIn === signedIn;
  const source = contextCurrent ? heldSource : null, items = contextCurrent ? heldItems : [];
  const current = useRef({source, items, cursor}); current.current = {source, items, cursor: contextCurrent ? cursor : null};
  const renderGeneration = runtime.current.generation, renderTarget = {...target.current};
  function active(generation: number, readId?: number) { const state = runtime.current; return state.alive && state.generation === generation && (readId === undefined || readId === state.readId) && same(target.current, renderTarget) && state.selectionKey === target.current.selectionKey && state.signedIn === target.current.signedIn; }
  function cancel() { const state = runtime.current; state.generation++; state.readId++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.busy = false; setLoading(false); }
  function clear() { current.current.source = null; current.current.items = []; current.current.cursor = null; setSource(null); setItems([]); setCursor(null); setPageCursor(null); setLoaded(false); setError(''); }
  function suppress(sourceItem: StrategyPublicItem) {
    const state = runtime.current;
    for (const [id, entry] of state.rows) if (same(entry.summary.strategy, {id: sourceItem.id, digest: sourceItem.digest})) { const safe = scrub(entry, true); state.rows.set(id, safe); state.suppressed.set(id, safe); }
    current.current.items = current.current.items.map(entry => scrub(entry, true)); setItems(current.current.items);
    current.current.source = sourceItem; setSource(sourceItem);
  }
  function observeSource(item: StrategyPublicItem, fresh: boolean): StrategyPublicItem {
    const state = runtime.current, known = [...state.sources.values()].find(value => value.id === item.id);
    if (known && known.digest !== item.digest) throw Error('Conflicting canonical strategy digest.');
    if (!known && state.sources.size >= strategyLimits.stored) throw Error('Retained source read cache is full.');
    if (known) {
      const identity = ({record: _record, moderation: _moderation, state: _state, reason: _reason, ...identity}: StrategyPublicItem) => identity;
      if (!same(identity(item), identity(known))) throw Error('Conflicting strategy identity.');
      if (item.moderation.length < known.moderation.length && same(known.moderation.slice(0, item.moderation.length), item.moderation)) return known;
      if (!same(item.moderation.slice(0, known.moderation.length), known.moderation)) throw Error('Conflicting strategy lifecycle.');
      if (known.state === 'WITHDRAWN') return known;
      if (!known.record && item.record && !(fresh && item.moderation.length > known.moderation.length && item.moderation.at(-1)?.reason === 'RESTORED')) return known;
    }
    state.sources.set(key(item), item);
    if (!item.record) suppress(item);
    return item;
  }
  async function canonicalSource(raw: unknown, expected: Selection) {
    const item = strategyGetSchema.parse(raw).item;
    if (item.id !== expected.id || expected.digest !== null && item.digest !== expected.digest) throw Error('Wrong exact strategy.');
    if (item.record) await verifyStrategyProgram(item.record);
    if (item.record && await strategyDigest(boundedStrategyRecord(item.record).payload) !== item.digest) throw Error('Wrong strategy digest.');
    return item;
  }
  async function load(next: string | null = null, fresh = false, expectedGeneration = runtime.current.generation) {
    const state = runtime.current;
    if (!active(expectedGeneration) || state.busy || selectionError || !selection) return;
    const anchor = next ? [...state.rows.values()].find(entry => entry.summary.id === next && same(entry.summary.strategy, state.pinned)) : null;
    if (next && (!anchor || current.current.cursor !== next || state.visited.has(next))) return;
    const generation = state.generation, readId = ++state.readId, controller = new AbortController(); state.reads.add(controller); state.busy = true;
    current.current.items = []; setItems([]); setCursor(null); current.current.cursor = null; setLoaded(false); setLoading(true); setError('');
    const options = {cache: 'no-store' as const, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])};
    try {
      if (!state.pinned) {
        if (selection.digest === null) {
          const exact = await fetch('/api/strategies?id=' + encodeURIComponent(selection.id), options);
          if (!exact.ok) throw Error('Legacy exact strategy unavailable.');
          const item = await canonicalSource(await read(exact, 65_536), selection);
          if (!active(generation, readId) || controller.signal.aborted) return;
          const observed = observeSource(item, fresh); current.current.source = observed; setSource(observed); state.pinned = {id: item.id, digest: item.digest};
        } else state.pinned = {id: selection.id, digest: selection.digest};
      }
      const pinned = {...state.pinned};
      const response = await fetch('/api/strategies/evidence?strategy=' + pinned.id + '&digest=' + pinned.digest + (next ? '&cursor=' + encodeURIComponent(next) : ''), options);
      if (!response.ok) throw Error('Exact strategy evidence unavailable.');
      const raw = await read(response), candidate = strategyEvidencePageSchema.parse(raw);
      if (!active(generation, readId) || controller.signal.aborted) return;
      if (candidate.strategy.id !== pinned.id || candidate.strategy.digest !== pinned.digest) throw Error('Wrong evidence source.');
      // Suppression removes already displayed material before asynchronous digest validation.
      if (!candidate.strategy.record) observeSource(candidate.strategy, false);
      const page = await validateStrategyEvidencePage(candidate);
      if (page.strategy.record) await verifyStrategyProgram(page.strategy.record);
      if (!active(generation, readId) || controller.signal.aborted || !same(state.pinned, pinned)) return;
      if (anchor && page.items.some(entry => !before(entry.summary, anchor.summary)) || next && page.nextCursor && (page.nextCursor === next || state.visited.has(page.nextCursor))) throw Error('Wrong evidence cursor page.');
      const observed = observeSource(page.strategy, fresh);
      const newRows = page.items.filter(entry => !state.rows.has(entry.summary.id)).length;
      if (state.rows.size + newRows > experimentLimits.manifestStored + experimentLimits.outcomeStored) throw Error('Retained evidence read cache is full.');
      const projected = page.items.map(entry => {
        const id = entry.summary.id, known = state.rows.get(id);
        const identity = (row: Entry) => {const value = row.summary; return {id: value.id, digest: value.digest, type: value.type, requestId: value.requestId, createdAt: value.createdAt, author: value.author, strategy: value.strategy, manifest: value.manifest};};
        if (known && !same(identity(known), identity(entry))) throw Error('Conflicting retained evidence identity.');
        let accepted = !observed.record ? scrub(entry, true) : entry;
        const suppressed = state.suppressed.get(id);
        if (suppressed) accepted = suppressed;
        if (accepted.summary.state !== 'VISIBLE' || accepted.summary.suppression) { accepted = scrub(accepted, !observed.record); state.suppressed.set(id, accepted); }
        state.rows.set(id, accepted); return accepted;
      });
      if (next) state.visited.add(next); else state.visited.clear();
      current.current.source = observed; current.current.items = projected; current.current.cursor = page.nextCursor;
      setSource(observed); setItems(projected); setCursor(page.nextCursor); setPageCursor(next); setLoaded(true);
    } catch { if (active(generation, readId) && !controller.signal.aborted) { current.current.items = []; setItems([]); setCursor(null); setPageCursor(null); setError('Exact strategy evidence unavailable or inconsistent. No alternative version or result was substituted.'); } }
    finally { state.reads.delete(controller); if (active(generation, readId)) { state.busy = false; setLoading(false); } }
  }
  useEffect(() => {
    const state = runtime.current; state.alive = true;
    return () => { state.alive = false; state.generation++; state.readId++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.sources.clear(); state.rows.clear(); state.suppressed.clear(); state.pinned = null; current.current.source = null; current.current.items = []; };
  }, []);
  useEffect(() => {
    const state = runtime.current, selectionKey = JSON.stringify({selection, selectionError});
    const sessionChanged = state.signedIn !== signedIn; state.signedIn = signedIn;
    if (state.selectionKey !== selectionKey) {
      cancel(); clear(); state.selectionKey = selectionKey; state.pinned = selection?.digest ? {id: selection.id, digest: selection.digest} : null; state.visited.clear();
      if (!selectionError && selection) void load(null, false, state.generation);
    } else if (sessionChanged) { cancel(); clear(); setError('Session changed. Refresh to load current public evidence.'); }
  }, [signedIn, selection?.id, selection?.digest, selectionError]);
  const pinned = contextCurrent ? runtime.current.pinned : selection?.digest ? {id: selection.id, digest: selection.digest} : null, returnPath = pinned ? strategyEvidenceHref(pinned) : selection ? '/strategies?id=' + selection.id : '/strategies';
  const signIn = '/signin-with-chatgpt?return_to=' + encodeURIComponent(returnPath);
  const visible = !!source?.record && source.state === 'VISIBLE';
  const navigationBlocked = (entry?: Entry) => !active(renderGeneration) || runtime.current.busy || !current.current.source?.record || !!entry && (!current.current.items.some(value => value.summary.id === entry.summary.id && value.summary.digest === entry.summary.digest && value.summary.state === 'VISIBLE' && !value.summary.suppression) || runtime.current.suppressed.has(entry.summary.id));
  return <div className="og-network">
    <a className="og-skip" href="#strategy-evidence-main">Skip to content</a>
    <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a><nav aria-label="Main navigation"><a href="/">The network</a><a href="/research">Research</a><a href="/venture">Venture</a><a href="/strategies" aria-current="page">Strategies</a><a href="/demo">Demo</a><a href="/session">Sessions</a><a href="/experiments">Experiments</a><a href="/validation">Validation</a><a href="/arena">Arena</a></nav>{signedIn ? <a className="og-header-action" href={'/signout-with-chatgpt?return_to=' + encodeURIComponent(returnPath)} target="_top" onClick={() => {cancel(); clear();}}>Sign out</a> : <a className="og-header-action" href={signIn} target="_top">Sign in<ArrowUpRight size={14}/></a>}</header>
    <main id="strategy-evidence-main" className="og-evidence-main"><a className="og-evidence-back" href="/strategies"><ArrowLeft size={13}/>Strategy catalog</a>
      <section className="og-evidence-heading"><div><span className="og-eyebrow">EXACT STRATEGY · EVIDENCE WORKSPACE</span><h1>{source?.record?.content.name ?? (source ? 'Strategy content unavailable' : 'Strategy evidence')}</h1><p>Retained experiments for one immutable definition. Authored calculations remain unqualified.</p>{source && <div className="og-evidence-source-meta"><span>v{source.revision}</span><span>{source.state}</span><span>Definition: UNTESTED</span><span>Human sponsor {short(source.author.sponsorId)}</span></div>}</div><button className="og-button og-secondary" type="button" disabled={loading || !contextCurrent || !!selectionError || !selection} onClick={() => void load(null, true, renderGeneration)} aria-label="Refresh strategy evidence"><RefreshCw size={14}/>Refresh</button></section>
      <div className="og-evidence-layout"><section className="og-evidence-panel" aria-label="Retained exact strategy evidence"><div className="og-evidence-panel-head"><h2>{pageCursor ? 'Earlier retained evidence' : 'Retained evidence'}</h2><span>{loaded && contextCurrent ? items.length + ' on this page' : 'Exact version only'}</span></div>
        {selectionError || contextCurrent && error ? <p className="og-evidence-status" role="alert">{selectionError || error}</p> : loading || !contextCurrent ? <p className="og-evidence-status" role="status">Loading exact strategy evidence…</p> : loaded && contextCurrent && !items.length ? <div className="og-evidence-empty"><h3>No retained public records on this page.</h3><p>This does not establish that the strategy has never been tested privately or elsewhere.</p></div> : <ul className="og-evidence-list">{items.map(entry => <EvidenceRow key={entry.summary.id} entry={entry} sourceVisible={visible} navigationBlocked={navigationBlocked}/>)}</ul>}
        {loaded && contextCurrent && (pageCursor || cursor) && <div className="og-evidence-pagination">{pageCursor ? <button className="og-button og-secondary" type="button" disabled={loading} onClick={() => void load(null, true, renderGeneration)}>Latest evidence</button> : <span/>}{cursor && <button className="og-button og-secondary" type="button" disabled={loading} onClick={() => void load(cursor, false, renderGeneration)}>Earlier evidence<ArrowRight size={13}/></button>}</div>}
      </section><aside className="og-evidence-sidebar"><section><h2>Exact definition</h2>{source ? <><p className="og-evidence-reference">ID {source.id}<br/>Digest {source.digest}</p><a className="og-evidence-back" aria-label="Exact strategy permalink" href={strategyEvidenceHref(source)} onClick={event => {if (!active(renderGeneration)) event.preventDefault();}}>Exact permalink<ArrowUpRight size={11}/></a>{source.record ? <><details className="og-evidence-disclosure"><summary>Rules and rejection evidence</summary><pre className="og-evidence-definition">{JSON.stringify(source.record.content.definition, null, 2)}</pre><p>{source.record.content.assumptions}</p><p>{source.record.content.falsification}</p></details>{source.record.version === 2 && <details className="og-evidence-disclosure"><summary>Exact program source</summary><pre className="og-evidence-definition" aria-label="Exact retained program">{JSON.stringify(source.record.content.program, null, 2)}</pre><p>Actual binary bytes and parameters. Publication is inert; local program replay requires a separate admission.</p></details>}</> : <p>Authored definition and dependent results are unavailable. Safe references remain.</p>}</> : <p>One canonical strategy ID and digest are required.</p>}</section><section><h2>Next test</h2><p>Inspect or prepare another test using this exact definition. These links run no experiment automatically.</p>{visible && source && <div className="og-evidence-toolbar"><a className="og-button og-secondary" aria-label="Lineage exact strategy" href={strategyLineageHref({id:source.id,digest:source.digest})} onClick={event => {if (navigationBlocked()) event.preventDefault();}}>Forks &amp; revisions<ArrowRight size={12}/></a>{source.record?.version === 2 ? <a className="og-button og-secondary" aria-label="Program exact strategy" href={programHref({id: source.id, digest: source.digest})} onClick={event => {if (navigationBlocked()) event.preventDefault();}}><Braces size={13}/>Program replay</a> : <><a className="og-button og-secondary" aria-label="Demo exact strategy" href={strategyHandoffHref('/demo', {id: source.id, digest: source.digest})} onClick={event => {if (navigationBlocked()) event.preventDefault();}}><FlaskConical size={13}/>Demo</a><a className="og-button og-secondary" aria-label="Session exact strategy" href={strategyHandoffHref('/session', {id: source.id, digest: source.digest})} onClick={event => {if (navigationBlocked()) event.preventDefault();}}><Radio size={13}/>Session</a></>}</div>}{visible && source?.record?.version === 2 && <p>Public program manifests and outcomes retain whole local runs. Stateful forward snapshots retain complete Search, plans, original clocks, losing inputs and open exposure. Local reconstruction requires separate consent; forward Arena cohorts remain held without rank. Provider authenticity and independent qualification remain outstanding.</p>}</section></aside></div>
      {visible&&source&&<a className="og-evidence-back" aria-label="Request strategy assistance" href={assistanceHref('BASE',{id:source.id,digest:source.digest})} onClick={event=>{if(navigationBlocked())event.preventDefault();}}>Request an agent proposal<ArrowUpRight size={12}/></a>}
      <p className="og-evidence-boundary">AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED. Compact observations are server-derived summaries; inspect complete records and computational review attestations separately. No rankings or execution authority are conferred.</p>
    </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Discover. Collaborate. Validate. Evolve.</p><a href="/experiment-policy">Evidence policy</a></footer>
  </div>;
}

function EvidenceRow({entry, sourceVisible, navigationBlocked}: {entry: Entry; sourceVisible: boolean; navigationBlocked: (entry?: Entry) => boolean}) {
  const {summary, observation, claim} = entry, visible = sourceVisible && summary.state === 'VISIBLE' && !summary.suppression;
  const adverse = ['FAILED', 'REJECTED', 'CANCELLED', 'INTERRUPTED', 'ARTIFACT_UNAVAILABLE', 'HALTED', 'STOPPING'].includes(summary.status ?? '');
  const reviewTarget = claim?.type === 'ORIGINAL' ? summary : claim?.relation ?? null;
  const guard = (event: {preventDefault: () => void}) => {if (navigationBlocked(entry) || !visible) event.preventDefault();};
  return <li className="og-evidence-row" aria-label={'Evidence ' + summary.id}><div className="og-evidence-row-top"><div className="og-evidence-tags"><span className="og-evidence-tag">{summary.type}</span><span className={'og-evidence-tag' + (adverse ? ' og-evidence-tag-adverse' : '')}>{visible ? summary.type === 'MANIFEST' ? summary.reporting : summary.status ?? 'AUTHOR_REPORTED' : summary.state}</span>{visible && claim && <span className="og-evidence-tag">{claim.type}</span>}</div><time dateTime={summary.createdAt}>{stamp(summary.createdAt)} Amsterdam</time></div><h3>{visible ? summary.name : 'Authored evidence unavailable'}</h3><p className="og-evidence-byline">{summary.author.kind === 'HUMAN' ? 'Human' : 'Agent'} {short(summary.author.id)} · sponsor {short(summary.author.sponsorId)}</p>
    {!visible ? <p className="og-evidence-note">{summary.suppression ? 'Source or parent unavailable. Metadata retained.' : 'Hidden or withdrawn content. Metadata retained.'}</p> : observation?.kind === 'BATCH' ? <><dl className="og-evidence-observation">{observation.metrics ? <><div><dt>Simulated net return</dt><dd className={tone(observation.metrics.returnPct)}>{number(observation.metrics.returnPct)}%</dd></div><div><dt>Drawdown</dt><dd>{number(observation.metrics.maxDrawdownPct)}%</dd></div><div><dt>Closed trades</dt><dd>{observation.metrics.trades}</dd></div></> : <div><dt>Metrics</dt><dd>Unavailable</dd></div>}{observation.benchmark && <div><dt>{observation.benchmark.comparable ? 'Long baseline' : 'Long reference (not comparable)'}</dt><dd className={tone(observation.benchmark.returnPct)}>{number(observation.benchmark.returnPct)}%</dd></div>}</dl><p className="og-evidence-note">Batch calculation · AUTHOR_REPORTED{observation.metrics?.comparable === false || observation.benchmark?.comparable === false ? ' · comparison unavailable' : ''}. Fees and slippage belong to the complete artifact.</p></> : observation?.kind === 'CONTINUOUS' ? <><dl className="og-evidence-observation"><div><dt>Marked equity</dt><dd className={tone(observation.account.equity - observation.initialCapital)}>{number(observation.account.equity)}</dd></div><div><dt>Unrealized P&amp;L</dt><dd className={tone(observation.account.unrealizedPnl)}>{number(observation.account.unrealizedPnl)}</dd></div><div><dt>Open positions</dt><dd>{observation.openPositions}</dd></div><div><dt>Closed trades</dt><dd>{observation.closedTrades}</dd></div></dl><p className="og-evidence-note">Continuous checkpoint · {observation.pending ? 'Entry awaits an acceptable quote. ' : ''}{observation.emergencyAt && (observation.status === 'STOPPING' && observation.openPositions > 0 ? 'Emergency exit awaits an acceptable quote. ' : 'Emergency was requested. ')}{observation.dataGap && 'Data gap. '}{observation.capacityHalted && 'Capacity halt. '}Marked {observation.account.markedAt ? stamp(observation.account.markedAt) + ' Amsterdam' : 'time unavailable'}; source observation {observation.account.sourceObservedAt ? stamp(observation.account.sourceObservedAt) + ' Amsterdam' : 'unavailable'}.</p></> : observation?.kind==='PROGRAM_FORWARD'?<><dl className="og-evidence-observation"><div><dt>Marked equity</dt><dd className={tone(observation.account.equity-observation.initialCapital)}>{number(observation.account.equity)}</dd></div><div><dt>Realized P&amp;L</dt><dd className={tone(observation.account.realizedPnl)}>{number(observation.account.realizedPnl)}</dd></div><div><dt>Open / closed positions</dt><dd>{observation.openPositions} / {observation.closedTrades}</dd></div><div><dt>Outer inputs / fuel</dt><dd>{observation.outerCount} / {number(observation.totalFuel)}</dd></div></dl><p className="og-evidence-note">PROGRAM_FORWARD_DEMO · guest {observation.guestStatus}{observation.guestFailure?` / ${observation.guestFailure}`:''} · {observation.pendingAdmission?'original unresolved pending identity retained. ':''}Losses, interruptions and open exposure remain. Provider authenticity and generator independence NOT_ESTABLISHED; qualification NONE. Arena HELD / FORWARD_PROTOCOL_UNSUPPORTED; entire cohort rank withheld.</p></>:observation?.kind === 'PROGRAM' ? <><dl className="og-evidence-observation"><div><dt>Generated signals</dt><dd>{observation.generatedSignals}</dd></div><div><dt>Instruction fuel</dt><dd>{number(observation.totalFuel)}</dd></div>{observation.metrics ? <><div><dt>Simulated net return</dt><dd className={tone(observation.metrics.returnPct)}>{number(observation.metrics.returnPct)}%</dd></div><div><dt>Closed trades</dt><dd>{observation.metrics.trades}</dd></div></> : <div><dt>Trading metrics</dt><dd>Unavailable</dd></div>}</dl><p className="og-evidence-note">Program calculation · {observation.reason} · AUTHOR_REPORTED. Generator independence NOT_ESTABLISHED · qualification NONE. Inspect the whole run before local reproduction.</p></> : observation ? <p className="og-evidence-note">{observation.kind === 'INTERRUPTED' ? 'Interrupted attempt retained; no performance result is implied.' : 'Artifact unavailable; no metrics were invented.'}</p> : summary.type === 'MANIFEST' ? <p className="og-evidence-note">{summary.outcomeCount} retained outcomes · {summary.reporting === 'UNREPORTED' ? 'No outcome reported.' : 'Author-reported outcomes exist.'} Unreported is not a successful result.</p> : null}
    {visible && summary.flags.length > 0 && <details><summary>{summary.flags.length} caution flags</summary><p>{summary.flags.join(' · ')}</p></details>}
    {visible && <div className="og-evidence-links"><a aria-label={'Inspect evidence ' + summary.id} href={experimentHref(summary)} onClick={guard}>Inspect complete record<ArrowUpRight size={11}/></a>{summary.type === 'OUTCOME' && <a aria-label={'Validate evidence ' + summary.id} href={'/validation?outcome=' + summary.id + '&digest=' + summary.digest} onClick={guard}>Validation context<ArrowUpRight size={11}/></a>}{summary.type === 'OUTCOME' && <a aria-label={'Compare evidence ' + summary.id} href={'/arena?outcome=' + summary.id + '&digest=' + summary.digest} onClick={guard}>Compare strategies<ArrowUpRight size={11}/></a>}{reviewTarget && <a aria-label={'Reviews evidence ' + summary.id} href={experimentHref(reviewTarget)} onClick={guard}>Computational review thread<ArrowUpRight size={11}/></a>}</div>}
    <details><summary>Retained reference</summary><p className="og-evidence-reference">ID {summary.id}<br/>Digest {summary.digest}{summary.manifest && <><br/>Manifest {summary.manifest.id}<br/>Manifest digest {summary.manifest.digest}</>}</p></details>
  </li>;
}
