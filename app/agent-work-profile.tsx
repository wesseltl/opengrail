'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, FileCheck2, RefreshCw, Search, X} from 'lucide-react';
import {agentWorkProfileLimits, boundedAgentWorkProfile, type AgentWorkProfile as Profile, type AgentWorkUnit} from './agent-work-profile-model';
import {parseUniqueJson} from './unique-json';
import {experimentHref} from './experiment-link';
import {strategyEvidenceHref} from './strategy-evidence-model';
import {MainNavigation} from './main-navigation';
import './network.css';
import './agent-work-profile.css';

const canonicalId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const statusLabel = {ATTESTED: 'Attested reproduction', DISPUTED: 'Disputed', HELD: 'Held', REJECTED: 'Rejected', SUPERSEDED: 'Superseded'} as const;
const decisionLabel = {REPRODUCED: 'Attested reproduction', DISPUTED: 'Disputed', HELD: 'Held', REJECTED: 'Rejected'} as const;
const reasonLabel = (reason: string) => reason.toLowerCase().replaceAll('_', ' ');
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'}).format(new Date(at)) + ' UTC';
const reviewHref = (original: AgentWorkUnit['original'], review: AgentWorkUnit['currentHead']) => experimentHref({...original, review: review.id, reviewDigest: review.digest});
function cancelResponseBody(response: Response) { try { void response.body?.cancel().catch(() => {}); } catch {} }

async function readProfile(response: Response, signal: AbortSignal): Promise<Profile> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > agentWorkProfileLimits.responseBytes)) { cancelResponseBody(response); throw Error('Work response exceeds its bound.'); }
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) { cancelResponseBody(response); throw Error('Work response is not JSON.'); }
  if (signal.aborted) { cancelResponseBody(response); throw Error('Work read stopped.'); }
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing work response.');
  const chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, {once: true});
  try {
    for (;;) {
      if (signal.aborted) throw Error('Work read stopped.');
      const {value, done} = await reader.read();
      if (signal.aborted) throw Error('Work read stopped.');
      if (done) break;
      size += value.byteLength;
      if (size > agentWorkProfileLimits.responseBytes) { await reader.cancel(); throw Error('Work response exceeds its bound.'); }
      chunks.push(value);
    }
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), agentWorkProfileLimits.responseBytes, agentWorkProfileLimits.maximumDepth);
  return boundedAgentWorkProfile(raw).profile;
}

export default function AgentWorkProfile({agentId = '', selectionError = ''}: {agentId?: string; selectionError?: string}) {
  const [input, setInput] = useState(agentId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(selectionError);
  const [error, setError] = useState('');
  const routeKey = agentId + ':' + selectionError;
  const runtime = useRef({mounted: true, generation: 0, input: agentId, routeKey, renderedRouteKey: routeKey, controller: null as AbortController | null});
  runtime.current.renderedRouteKey = routeKey;

  function scrub() {
    const current = runtime.current;
    current.generation++; current.controller?.abort(); current.controller = null;
    setProfile(null); setLoading(false); setError(''); setNotice('');
  }
  useEffect(() => {
    runtime.current.mounted = true;
    scrub(); runtime.current.input = agentId; runtime.current.routeKey = routeKey;
    setInput(agentId); setNotice(selectionError);
  }, [agentId, selectionError]);
  useEffect(() => () => {
    const current = runtime.current;
    current.mounted = false; current.generation++; current.controller?.abort(); current.controller = null;
  }, []);

  function change(value: string) {
    scrub(); runtime.current.input = value; setInput(value);
  }
  function cancel() { scrub(); setNotice('Lookup cancelled.'); }
  async function lookup() {
    const current = runtime.current;
    if (!current.mounted || current.routeKey !== routeKey || current.renderedRouteKey !== routeKey || current.input !== input || !canonicalId.test(input)) return;
    scrub();
    const generation = current.generation, subject = input, controller = new AbortController();
    current.controller = controller; setLoading(true);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    const active = () => current.mounted && current.generation === generation && current.input === subject && current.routeKey === routeKey && current.renderedRouteKey === routeKey && !signal.aborted;
    try {
      const response = await fetch('/api/reputation/agents?id=' + subject, {method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', headers: {Accept: 'application/json'}, signal});
      if (!active()) { cancelResponseBody(response); return; }
      if (response.status === 404) { cancelResponseBody(response); setNotice('No public reviewed work is available. Registration is not disclosed.'); return; }
      if (!response.ok) { cancelResponseBody(response); throw Error('Work lookup refused.'); }
      const result = await readProfile(response, signal);
      if (!active()) return;
      if (result.subject.id !== subject) throw Error('Work profile subject changed.');
      setProfile(result);
    } catch {
      if (current.mounted && current.generation === generation && current.input === subject && current.routeKey === routeKey && current.renderedRouteKey === routeKey) {
        setProfile(null); setError('Public reviewed work is unavailable. Try again.');
      }
    } finally {
      if (current.mounted && current.generation === generation && current.routeKey === routeKey && current.renderedRouteKey === routeKey) { current.controller = null; setLoading(false); }
    }
  }
  // A route/input change hides the previous profile before the effect or next request settles.
  const visible = runtime.current.routeKey === routeKey && profile?.subject.id === input && runtime.current.input === input ? profile : null;

  return <div className="og-network og-work-profile">
    <a className="og-skip" href="#work-main">Skip to content</a>
    <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a>{MainNavigation()}<a className="og-header-action" href="/#agents">Your agents<ArrowUpRight size={14}/></a></header>
    <main id="work-main">
      <section className="og-work-heading"><h1>Agent work</h1><p>Reviewed reproductions and retained decisions.</p></section>
      <section className="og-work-lookup" aria-label="Find an agent work profile">
        <form onSubmit={event => {event.preventDefault(); void lookup();}}><label htmlFor="work-agent-id">Agent ID<input id="work-agent-id" aria-label="Work profile agent ID" value={input} maxLength={36} autoComplete="off" spellCheck={false} placeholder="Exact agent UUID" onChange={event => change(event.target.value)}/></label><button className="og-button og-primary" type="submit" disabled={loading || !canonicalId.test(input)}><Search size={15}/>Open profile</button>{loading && <button className="og-button og-secondary" type="button" onClick={cancel}><X size={15}/>Cancel lookup</button>}</form>
      </section>
      <div className="og-work-feedback" aria-live="polite">{loading && <p role="status">Loading current public reviewed work…</p>}{notice && <p role="status">{notice}</p>}{error && <p className="og-work-error" role="alert">{error}</p>}</div>
      {visible && <section className="og-work-result" aria-labelledby="work-result-heading">
        <div className="og-work-result-heading"><div><h2 id="work-result-heading">Reviewed work</h2><p>Agent <code>{visible.subject.id}</code></p><p className="og-work-note">Observed <time dateTime={visible.observedAt}>{stamp(visible.observedAt)}</time></p></div><button className="og-button og-secondary" type="button" onClick={() => void lookup()}><RefreshCw size={14}/>Refresh profile</button></div>
        <dl className="og-work-counts" aria-label="Current reviewed work counts">{([['Attested', visible.counts.attested], ['Disputed', visible.counts.disputed], ['Held', visible.counts.held], ['Rejected', visible.counts.rejected], ['Superseded', visible.counts.superseded]] as const).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl>
        <p className="og-work-boundary">Computational attestations include reproduced losses. Independence and trading performance remain not established.</p>
        {visible.units.length === 0 ? <div className="og-work-empty"><FileCheck2 size={24}/><h3>No currently visible supported work</h3><p>Hidden or withdrawn work is excluded; no conclusion is implied.</p></div> : <div className="og-work-units">{visible.units.map(unit => <WorkUnit key={unit.original.id + ':' + unit.original.digest} unit={unit}/>)}</div>}
        <p className="og-work-coverage">Batch Demo, Program Demo and Program forward Demo only.</p>
      </section>}
    </main>
    <footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Discover. Collaborate. Validate. Evolve.</p></footer>
  </div>;
}

function WorkUnit({unit}: {unit: AgentWorkUnit}) {
  return <article className="og-work-unit" aria-label={'Reviewed work ' + unit.original.id}>
    <div className="og-work-unit-heading"><h3>{statusLabel[unit.status]}</h3><span>Review {unit.currentHead.sequence}</span></div>
    <p className="og-work-quick-links"><a href={experimentHref(unit.original)}>Original · {unit.original.id.slice(0, 8)}</a><a href={experimentHref(unit.reproduction)}>Agent outcome</a><a href={experimentHref(unit.manifest)}>Manifest</a><a href={strategyEvidenceHref(unit.strategy)}>Strategy</a><a href={reviewHref(unit.original, unit.currentHead)}>Review</a></p>
    <details className="og-work-history"><summary>Evidence &amp; history</summary><dl className="og-work-references">{(['original', 'reproduction', 'manifest', 'strategy'] as const).map(name => <div key={name}><dt>{name === 'original' ? 'Original outcome' : name === 'reproduction' ? 'Agent outcome' : name === 'manifest' ? 'Manifest' : 'Strategy'}</dt><dd><a href={name === 'strategy' ? strategyEvidenceHref(unit[name]) : experimentHref(unit[name])}>{unit[name].id}<ArrowUpRight size={12}/></a><span>{unit[name].digest}</span></dd></div>)}<div><dt>Current review</dt><dd><a href={reviewHref(unit.original, unit.currentHead)}>{unit.currentHead.id}<ArrowUpRight size={12}/></a><span>{unit.currentHead.digest}</span></dd></div></dl><h4>Retained visible history · {unit.history.length}</h4><ol>{unit.history.map(review => <li key={review.review.id}><div className="og-work-history-heading"><strong>{decisionLabel[review.decision]}</strong><span>Review {review.sequence} · <time dateTime={review.createdAt}>{stamp(review.createdAt)}</time></span></div><p>{review.reasons.map(reasonLabel).join(' · ')}</p><p className="og-work-history-links"><a href={reviewHref(unit.original, {...review.review, sequence: review.sequence})}>Exact review</a><a href={experimentHref(review.reproduction)}>Reviewed outcome</a></p>{review.sharedDependencies.length > 0 && <p className="og-work-note">Shared dependencies: {review.sharedDependencies.map(reasonLabel).join(' · ')}.</p>}{review.otherConflicts && <p>{review.otherConflicts}</p>}</li>)}</ol></details>
  </article>;
}
