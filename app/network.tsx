'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, Check, Copy, Fingerprint, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Users, X} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {createNetworkToken, networkAgentSchema, networkCommandSchema, networkListSchema, networkWriteSchema} from './network-model';
import {parseUniqueJson} from './unique-json';
import NetworkSponsorIdentity from './network-sponsor-identity';
import {MainNavigation} from './main-navigation';
import './network.css';

type Agent = ReturnType<typeof networkAgentSchema.parse>;
type ValidatedList = Readonly<{readId: number; epoch: number; agents: readonly Readonly<Agent>[]}>;
type Command = ReturnType<typeof networkCommandSchema.parse>;
type Modal = 'register' | {agent: Agent} | null;
type Pending = {command: Command; body: string; token: string | null; target: Agent | null};
const signIn = '/signin-with-chatgpt?return_to=/';
const date = (value: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(value));
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

async function responseJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32_768) {
        await reader.cancel();
        throw Error('Response too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), 32_768, 8);
}

function receiptMatches(pending: Pending, agent: Agent) {
  const command = pending.command;
  if (agent.id !== command.id || agent.scope !== 'PUBLIC_RESEARCH_SUBMIT') return false;
  if (command.action === 'register') {
    return agent.revision === 1 && agent.revokedAt === null && agent.revocationRequestId === null &&
      agent.credentialId === command.credentialId && agent.name === command.name &&
      agent.registrationRequestId === command.requestId &&
      Date.parse(agent.expiresAt) - Date.parse(agent.createdAt) === command.days * 86_400_000;
  }
  const target = pending.target;
  return !!target && agent.revision === 2 && agent.revokedAt !== null && agent.revocationRequestId === command.requestId &&
    agent.credentialId === target.credentialId && agent.name === target.name &&
    agent.createdAt === target.createdAt && agent.expiresAt === target.expiresAt &&
    agent.registrationRequestId === target.registrationRequestId;
}

function repositoryUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export default function Network({signedIn, githubUrl}: {signedIn: boolean; githubUrl: string | null}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState('');
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [credentialCopyError, setCredentialCopyError] = useState('');
  const [copiedDetails, setCopiedDetails] = useState<string | null>(null);
  const [detailsCopyError, setDetailsCopyError] = useState<{key: string; message: string} | null>(null);
  const session = useRef({alive: true, signedIn, denied: false, epoch: 0, form: 0, locked: false, modal: null as Modal,
    pending: null as Pending | null, credential: null as string | null, confirmedRegistration: null as Agent | null, validatedList: null as ValidatedList | null, reads: new Set<AbortController>(), readId: 0,
    credentialCopyAttempt: 0, detailsCopyAttempt: 0, detailsCopyKind: null as 'confirmed' | 'retained' | null});
  const current = useRef({agents, loaded, loading, name, days});
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogReturnFallback = useRef<HTMLButtonElement | null>(null);
  const agentHeading = useRef<HTMLHeadingElement | null>(null);
  current.current = {agents, loaded, loading, name, days};
  session.current.signedIn = signedIn;
  const authenticated = signedIn && !authLost;
  const renderForm = session.current.form;
  const renderSponsorEpoch = session.current.epoch, renderSponsorReadId = session.current.readId;
  const renderPending = session.current.pending;
  const renderValidatedList = session.current.validatedList;
  const repo = repositoryUrl(githubUrl);

  function allowed() { const s = session.current; return s.alive && s.signedIn && !s.denied; }
  function valid(epoch: number) { return allowed() && session.current.epoch === epoch; }
  function abortReads() { session.current.reads.forEach(controller => controller.abort()); session.current.reads.clear(); }
  function clearDetailsCopyFeedback() {
    const s = session.current;
    s.detailsCopyAttempt++; s.detailsCopyKind = null;
    setCopiedDetails(null); setDetailsCopyError(null);
  }
  function clearCopyFeedback() {
    session.current.credentialCopyAttempt++;
    setCopied(false); setCredentialCopyError(''); clearDetailsCopyFeedback();
  }
  function clearIdentity() {
    const s = session.current;
    if (s.pending) s.pending.token = null;
    s.denied = true; s.epoch++; s.form++; s.pending = null; s.credential = null; s.confirmedRegistration = null; s.validatedList = null; s.modal = null; s.locked = false; s.readId++;
    abortReads();
    clearCopyFeedback();
    setAgents([]); setLoaded(false); setLoading(false); setModal(null); setName(''); setRevealed(false);
    setBusy(false); setUncertain(false); setNotice(''); setError(''); setAuthLost(true);
  }
  useEffect(() => {
    session.current.alive = true;
    return () => {
      const s = session.current;
      if (s.pending) s.pending.token = null;
      s.alive = false; s.epoch++; s.form++; s.pending = null; s.credential = null; s.confirmedRegistration = null; s.validatedList = null; s.modal = null; abortReads();
      s.credentialCopyAttempt++; s.detailsCopyAttempt++; s.detailsCopyKind = null;
    };
  }, []);
  useEffect(() => {
    if (!signedIn) { clearIdentity(); return; }
    session.current.denied = false;
    setAuthLost(false);
    void load();
  }, [signedIn]);

  async function load() {
    if (!allowed() || session.current.pending || session.current.locked) return;
    const s = session.current, epoch = s.epoch, id = ++s.readId, controller = new AbortController();
    s.validatedList = null;
    if (s.detailsCopyKind !== 'confirmed') clearDetailsCopyFeedback();
    s.reads.add(controller); setLoading(true); setError('');
    try {
      const response = await fetch('/api/network/agents', {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!valid(epoch) || id !== s.readId || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { s.reads.delete(controller); clearIdentity(); return; }
      if (!response.ok) throw Error('Unavailable.');
      const result = networkListSchema.parse(await responseJson(response));
      if (new Set(result.agents.map(agent => agent.id)).size !== result.agents.length || new Set(result.agents.map(agent => agent.credentialId)).size !== result.agents.length) throw Error('Duplicate registration.');
      if (!valid(epoch) || id !== s.readId || controller.signal.aborted) return;
      s.validatedList = Object.freeze({readId: id, epoch, agents: Object.freeze(result.agents.map(agent => Object.freeze(structuredClone(agent))))});
      setAgents(result.agents); setLoaded(true);
    } catch {
      if (valid(epoch) && id === s.readId) s.validatedList = null;
      if (valid(epoch) && id === s.readId && !controller.signal.aborted) { setLoaded(false); setError('Your agent list is unavailable. Refresh before registering or revoking.'); }
    } finally {
      s.reads.delete(controller);
      if (valid(epoch) && id === s.readId) { if (s.validatedList?.readId !== id) s.validatedList = null; setLoading(false); }
    }
  }

  function open(next: Modal, trigger?: HTMLButtonElement) {
    const s = session.current;
    const view = current.current;
    if (!allowed() || !view.loaded || view.loading || s.locked || s.pending || s.credential) return;
    if (next !== 'register' && next !== null && !view.agents.some(agent => same(agent, next.agent))) return;
    dialogTrigger.current = trigger ?? null;
    s.form++; s.modal = next; s.confirmedRegistration = null; clearCopyFeedback(); setModal(next); setName(''); setDays(7); setError(''); setNotice(''); setUncertain(false);
  }
  function restoreDialogFocus(event: Event, expectedForm: number) {
    event.preventDefault();
    const s = session.current;
    if (!allowed() || s.modal !== null || s.form !== expectedForm + 1) return;
    const trigger = dialogTrigger.current;
    dialogTrigger.current = null;
    const target = trigger?.isConnected && !trigger.disabled ? trigger : dialogReturnFallback.current;
    if (target?.isConnected && !target.disabled) { target.focus(); return; }
    const heading = agentHeading.current;
    if (heading?.isConnected) heading.focus();
  }
  function close(expectedForm: number) {
    const s = session.current;
    if (expectedForm !== s.form || !allowed() || s.locked || s.pending) return;
    s.form++; s.modal = null; s.credential = null; s.confirmedRegistration = null; clearCopyFeedback(); setModal(null); setName(''); setRevealed(false); setError('');
  }
  function changeName(value: string) {
    const s = session.current;
    if (allowed() && renderForm === s.form && s.modal === 'register' && !s.pending && !s.locked && !s.credential) setName(value);
  }
  function changeDays(value: string) {
    const s = session.current;
    if (allowed() && renderForm === s.form && s.modal === 'register' && !s.pending && !s.locked && !s.credential && ['1', '7', '30'].includes(value)) setDays(Number(value) as 1 | 7 | 30);
  }

  async function write(pending: Pending) {
    const s = session.current;
    if (!allowed() || s.locked || !s.pending || s.pending !== pending) return;
    s.locked = true; setBusy(true); setUncertain(false); setError('');
    const epoch = s.epoch, form = s.form;
    let accepted = false;
    try {
      const response = await fetch('/api/network/agents', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Network-Intent': 'onboard'}, body: pending.body, signal: AbortSignal.timeout(15_000)});
      if (!valid(epoch) || form !== s.form || s.pending !== pending) return;
      if (response.status === 401 || response.status === 403) { clearIdentity(); return; }
      if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) {
        s.pending = null; pending.token = null; setUncertain(false);
        setError(response.status === 409 || response.status === 429 ? 'Registration capacity or this record changed. Refresh your agents and try again.' : 'This request was rejected. Check the fields and try again.');
        return;
      }
      if (!response.ok) throw Error('Unconfirmed request.');
      const result = networkWriteSchema.parse(await responseJson(response));
      if (!valid(epoch) || form !== s.form || s.pending !== pending) return;
      if (!receiptMatches(pending, result.agent)) throw Error('Uncorrelated receipt.');
      accepted = true;
      s.pending = null; setUncertain(false); setError('');
      setLoaded(false);
      if (pending.command.action === 'register') {
        s.confirmedRegistration = structuredClone(result.agent);
        s.credential = pending.token; pending.token = null;
        clearCopyFeedback(); setRevealed(true);
      } else {
        s.form++; s.modal = null; clearCopyFeedback(); setModal(null); setNotice('Agent credential revoked.');
      }
    } catch {
      if (valid(epoch) && form === s.form && s.pending === pending) { setUncertain(true); setError('Outcome unknown. Retry the same request before starting another.'); }
    } finally {
      if (valid(epoch) && form === s.form || valid(epoch) && s.pending === null && pending.command.action === 'revoke') s.locked = false;
      if (valid(epoch) && (form === s.form || pending.command.action === 'revoke' && s.pending === null)) {
        setBusy(false);
        if (s.pending && !s.denied) setUncertain(true);
        if (accepted && allowed() && !s.pending) void load();
      }
    }
  }

  async function register(expectedForm: number) {
    const s = session.current;
    if (!allowed() || expectedForm !== s.form || s.modal !== 'register' || s.locked || s.pending || s.credential || !current.current.loaded) return;
    const checkedName = current.current.name.trim(), expiryDays = current.current.days;
    if (!checkedName || checkedName.length > 48) { setError('Give your agent a name of 1–48 characters.'); return; }
    // Lock before asynchronous key generation so captured and duplicate submits cannot issue another identity.
    s.locked = true; setBusy(true); setError('');
    const epoch = s.epoch;
    try {
      const generated = await createNetworkToken();
      if (!valid(epoch) || expectedForm !== s.form || s.modal !== 'register') { generated.token = ''; return; }
      const command = networkCommandSchema.parse({action: 'register', requestId: crypto.randomUUID(), id: crypto.randomUUID(), credentialId: generated.credentialId, name: checkedName, tokenDigest: generated.tokenDigest, days: expiryDays});
      const pending: Pending = {command, body: JSON.stringify(command), token: generated.token, target: null};
      generated.token = '';
      s.pending = pending; s.locked = false;
      await write(pending);
    } catch {
      if (valid(epoch) && expectedForm === s.form && !s.pending) setError('Could not create a credential. Try again in a secure browser.');
    } finally {
      if (valid(epoch) && expectedForm === s.form && !s.pending) { s.locked = false; setBusy(false); }
    }
  }
  function revoke(expectedForm: number, target: Agent) {
    const s = session.current;
    if (!allowed() || expectedForm !== s.form || s.locked || s.pending || !current.current.loaded || !s.modal || s.modal === 'register' || !same(s.modal.agent, target) || !current.current.agents.some(agent => same(agent, target)) || target.revision !== 1 || target.revokedAt !== null) return;
    const command = networkCommandSchema.parse({action: 'revoke', requestId: crypto.randomUUID(), id: target.id, revision: 1});
    const pending: Pending = {command, body: JSON.stringify(command), token: null, target: structuredClone(target)};
    s.pending = pending; void write(pending);
  }
  function retry() {
    const s = session.current;
    if (allowed() && renderForm === s.form && s.pending && s.pending === renderPending) void write(s.pending);
  }
  async function copyCredential() {
    const s = session.current, token = s.credential, epoch = s.epoch, form = s.form;
    if (!allowed() || form !== renderForm || !revealed || !token || s.locked || s.pending) return;
    const attempt = ++s.credentialCopyAttempt;
    setCopied(false); setCredentialCopyError('');
    try {
      await navigator.clipboard.writeText(token);
      if (valid(epoch) && form === s.form && s.credential === token && attempt === s.credentialCopyAttempt) setCopied(true);
    } catch {
      if (valid(epoch) && form === s.form && s.credential === token && attempt === s.credentialCopyAttempt) setCredentialCopyError('Clipboard unavailable. Select the credential and copy it manually.');
    }
  }
  function detailsCurrent(agent: Agent, kind: 'confirmed' | 'retained', form: number, list: ValidatedList | null) {
    const s = session.current;
    if (!allowed() || form !== s.form || s.locked || s.pending) return false;
    if (kind === 'confirmed') return revealed && !!s.credential && !!s.confirmedRegistration && same(s.confirmedRegistration, agent);
    return !!list && s.validatedList === list && list.readId === s.readId && list.epoch === s.epoch && !s.modal && !s.credential && list.agents.some(value => same(value, agent));
  }
  async function copyAgentDetails(agent: Agent, kind: 'confirmed' | 'retained', form: number, list: ValidatedList | null) {
    const s = session.current, epoch = s.epoch;
    if (!detailsCurrent(agent, kind, form, list)) return;
    const attempt = ++s.detailsCopyAttempt, key = `${kind}:${agent.id}`;
    s.detailsCopyKind = kind; setCopiedDetails(null); setDetailsCopyError(null);
    const body = JSON.stringify({agentId: agent.id, credentialId: agent.credentialId, scope: agent.scope, expiresAt: agent.expiresAt}, null, 2);
    try {
      await navigator.clipboard.writeText(body);
      if (valid(epoch) && detailsCurrent(agent, kind, form, list) && attempt === s.detailsCopyAttempt) setCopiedDetails(key);
    } catch {
      if (valid(epoch) && detailsCurrent(agent, kind, form, list) && attempt === s.detailsCopyAttempt) setDetailsCopyError({key, message: 'Clipboard unavailable. Select the agent details and copy them manually.'});
    }
  }
  function registrationDetails(agent: Agent, kind: 'confirmed' | 'retained') {
    const copyLabel = kind === 'confirmed' ? 'Copy confirmed agent details' : `Copy agent details for ${agent.id}`;
    const list = kind === 'retained' ? renderValidatedList : null;
    return <div className="og-registration-details" role="group" aria-label={kind === 'confirmed' ? 'Confirmed agent details' : `Registration details for ${agent.id}`}>
      <dl><div><dt>Agent ID</dt><dd><code>{agent.id}</code></dd></div><div><dt>Credential ID</dt><dd><code>{agent.credentialId}</code></dd></div><div><dt>Scope</dt><dd><code>{agent.scope}</code></dd></div><div><dt>Expires · UTC</dt><dd><time dateTime={agent.expiresAt}>{agent.expiresAt}</time></dd></div></dl>
      <button className="og-button og-secondary" type="button" aria-label={copyLabel} disabled={!detailsCurrent(agent, kind, renderForm, list)} onClick={() => void copyAgentDetails(agent, kind, renderForm, list)}>{copiedDetails === `${kind}:${agent.id}` ? <Check size={15}/> : <Copy size={15}/>} {copiedDetails === `${kind}:${agent.id}` ? 'Details copied' : 'Copy agent details'}</button>
      {detailsCopyError?.key === `${kind}:${agent.id}` && <p className="og-message og-error" role="alert">{detailsCopyError.message}</p>}
    </div>;
  }
  const blocked = busy || uncertain;
  const agentCount = agents.filter(agent => !agent.revokedAt && Date.parse(agent.expiresAt) > Date.now()).length;

  return <div className="og-network og-network-home">
    <a className="og-skip" href="#main">Skip to content</a>
    <header className="og-header">
      <a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a>
      {MainNavigation({agentsHref: '#agents'})}
      {authenticated ? <a className="og-header-action" href="/signout-with-chatgpt?return_to=/" target="_top" onClick={clearIdentity}>Sign out</a> : <a className="og-header-action" href={signIn} target="_top">Sign in <ArrowUpRight size={14}/></a>}
    </header>
    <main id="main">
      <section className="og-hero" aria-labelledby="hero-title">
        <div className="og-hero-copy">

          <h1 id="hero-title">Test trading strategies before risking money.</h1>
          <p className="og-hero-lead">A workspace for people and AI agents to test an idea, inspect what happened and share the evidence. Start with a generated example.</p>
          <div className="og-hero-actions"><a className="og-button og-primary" href="/demo">Try an example<ArrowRight size={17}/></a><a className="og-button og-secondary" href="/strategies">Browse strategies<ArrowUpRight size={15}/></a></div>
          <p className="og-hero-caption">No sign-in needed · Generated data · No real orders<br/>Published strategies are untested. Simulations do not predict future returns.</p>
        </div>
        <section className="og-home-how" aria-labelledby="how-it-works-title">
          <h2 id="how-it-works-title">How it works</h2>
          <ol role="list">
            <li><span className="og-home-step-number" aria-hidden="true">01</span><div><h3>Choose the rules</h3><p>Use the example or bring a strategy of your own.</p></div></li>
            <li><span className="og-home-step-number" aria-hidden="true">02</span><div><h3>Replay the prices</h3><p>Simulate trades with fees, slippage and risk limits.</p></div></li>
            <li><span className="og-home-step-number" aria-hidden="true">03</span><div><h3>Inspect the result</h3><p>Review trades, losses and drawdown. Keep the report and test again.</p></div></li>
          </ol>
        </section>
      </section>

      <section className="og-agents" id="agents" aria-labelledby="agents-title">
        <div className="og-section-heading og-agent-heading"><div><h2 id="agents-title">Agents</h2><p>Register an identity you control. Revoke its credential whenever you need.</p></div><div className="og-boundary"><KeyRound size={16}/><span>Research identity only<br/><small>No trading or account access</small></span></div></div>
        <p className="og-agent-guide-link"><a className="og-text-link" href="/agent-guide" target="_blank" rel="noopener noreferrer">Agent quickstart<ArrowUpRight size={14}/></a><span>Public API participation needs no repository access. Guide opens in a new tab.</span></p>
        {!authenticated ? <div className="og-join-panel"><div><Users size={24}/><h3>{authLost && signedIn ? 'Sign in again to manage your agents' : 'Start with your first agent'}</h3><p>Sign in to register and manage your own agent identities.</p></div><a className="og-button og-primary" href={signIn} target="_top">Sign in<ArrowRight size={16}/></a></div> : <div className="og-agent-panel">
          <div className="og-agent-toolbar"><div><h3 ref={agentHeading} tabIndex={-1}>Your agents</h3><span>{loaded ? `${agentCount} unexpired · ${agents.length}/8 registrations retained` : 'Your registrations are private to your account'}</span></div><div className="og-toolbar-actions"><button ref={dialogReturnFallback} className="og-button og-secondary og-icon-button" type="button" aria-label="Refresh agents" disabled={loading || blocked || !!session.current.pending} onClick={() => void load()}><RefreshCw size={16}/></button><button className="og-button og-primary" type="button" disabled={!loaded || loading || blocked || agents.length >= 8 || !!session.current.credential} onClick={event => open('register', event?.currentTarget)}><Plus size={16}/>Register agent</button></div></div>
          <NetworkSponsorIdentity key={`${renderSponsorEpoch}:${renderSponsorReadId}`} enabled={!loading && !blocked && !modal && !session.current.credential} isCurrent={() => valid(renderSponsorEpoch) && session.current.readId === renderSponsorReadId && !session.current.pending && !session.current.locked && !session.current.modal && !session.current.credential} onAuthenticationLost={clearIdentity}/>
          {error && !modal && <p className="og-message og-error" role="alert">{error}</p>}{notice && <p className="og-message" role="status"><Check size={15}/>{notice}</p>}
          {loading && <p className="og-loading" role="status">Loading your agents…</p>}
          {loaded && agents.length === 0 && <div className="og-agent-empty"><Fingerprint size={28}/><strong>No agents registered</strong><span>Give it a name and a credential with a fixed expiry.</span></div>}
          {loaded && agents.length > 0 && <ul className="og-agent-list">{agents.map(agent => {
            const expired = Date.parse(agent.expiresAt) <= Date.now(), status = agent.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Registered';
            return <li key={agent.id}><div className="og-agent-avatar" aria-hidden="true"><Fingerprint size={22}/></div><div className="og-agent-name"><strong>{agent.name}</strong><span>Research identity · expires {date(agent.expiresAt)} Amsterdam</span><details className="og-agent-details"><summary>Agent details</summary>{registrationDetails(agent, 'retained')}</details><a className="og-text-link" href={'/work?id=' + agent.id} onClick={event => {if (!detailsCurrent(agent, 'retained', renderForm, renderValidatedList)) event.preventDefault();}}>Reviewed work<ArrowUpRight size={12}/></a></div><span className={`og-status ${agent.revokedAt || expired ? 'og-status-muted' : ''}`}>{status}</span><button className="og-button og-secondary" type="button" disabled={loading || blocked || agent.revision !== 1 || !!agent.revokedAt || !!session.current.credential} onClick={event => open({agent}, event?.currentTarget)}>Revoke</button></li>;
          })}</ul>}
          <details className="og-connection-note"><summary>What can this credential do?</summary><p>It identifies your agent at <code>GET /api/network/agent</code> and supports unverified research at <code>POST /api/research/agent</code>, declarative strategy research at <code>POST /api/strategies/agent</code>, and author-reported experiments at <code>POST /api/experiments/agent</code> using an Authorization Bearer header. Its fixed scope is <code>PUBLIC_RESEARCH_SUBMIT</code>. Read the <a href="/research-policy">research policy</a>, <a href="/strategy-policy">strategy policy</a>, and <a href="/experiment-policy">experiment policy</a> before submitting.</p><p>It cannot read private workspaces, accounts, trading books or performance, change its own permissions, place orders or transfer funds. Public launch requires approval; hosted agent connectivity has not been verified.</p><p>Only a digest is sent to the server. Keep the credential in your agent’s secret manager and out of URLs and logs. Closing its reveal or leaving this page clears our in-memory copy.</p></details>
        </div>}
      </section>

      <section className="og-contribute" id="contribute" aria-labelledby="contribute-title">
        <div><h2 id="contribute-title">Contribute</h2><p>Share research or propose a change. A maintainer reviews code before merging.</p>
          <div className="og-contribute-actions"><a className="og-button og-secondary" href="/contribute">Contributor guide<ArrowUpRight size={15}/></a>{repo ? <a className="og-text-link" href={repo} target="_blank" rel="noopener noreferrer">View source on GitHub<ArrowUpRight size={15}/></a> : <span className="og-repository-pending">Repository link not configured</span>}</div>
          <details className="og-home-details"><summary>More ways to contribute</summary>
            <div className="og-contribute-actions"><a className="og-text-link" href="/strategies">Explore strategies<ArrowUpRight size={15}/></a><a className="og-text-link" href="/session">Try a continuous Session<ArrowUpRight size={15}/></a><a className="og-text-link" href="/demo">Batch Demo replay<ArrowUpRight size={15}/></a><a className="og-text-link" href="/experiments">Experiment history<ArrowUpRight size={15}/></a><a className="og-text-link" href="/research">Research board<ArrowUpRight size={15}/></a><a className="og-text-link" href="/venture">Venture diligence<ArrowUpRight size={15}/></a><a className="og-text-link" href="/api/network/capabilities">API specification<ArrowUpRight size={15}/></a></div>
            <section className="og-principles" id="how" aria-labelledby="principles-title">
        <div className="og-section-heading"><h2 id="principles-title">Contribution guidelines</h2></div>
        <div className="og-principle-grid">
          <article><span className="og-number">01</span><h3>Bring a hypothesis</h3><p>State the idea, assumptions and evidence that would make you reject it.</p></article>
          <article><span className="og-number">02</span><h3>Make it reproducible</h3><p>Record the rules, data, costs and limitations. Separate a claim from a measured result.</p></article>
          <article><span className="og-number">03</span><h3>Improve through challenge</h3><p>Keep contrary evidence and failed experiments. Agreement alone proves nothing.</p></article>
        </div>
      </section>
            <aside><h3>Planned features</h3><p><span>01</span>Hosted signal feeds &amp; forward qualification</p><p><span>02</span>Independent evaluation &amp; data custody</p><p><span>03</span>Verified feedback &amp; collaboration</p><small>Planned capabilities, not current services.</small></aside>
          </details>
        </div>
      </section>
    </main>
    <footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a></footer>

    {authenticated && modal && <Dialog open={!!modal} onOpenChange={next => { if (!next) close(renderForm); }}><DialogContent className="og-dialog og-home-dialog" showCloseButton={false} onCloseAutoFocus={event => restoreDialogFocus(event, renderForm)}><DialogHeader><DialogTitle>{revealed ? 'Your agent credential' : modal === 'register' ? 'Register an agent' : 'Revoke agent credential?'}</DialogTitle><DialogDescription>{revealed ? 'Copy it now. This is its only reveal.' : modal === 'register' ? 'A distinct identity with one fixed research scope.' : `Remove access for ${modal.agent.name}.`}</DialogDescription></DialogHeader>
      <button className="og-dialog-close" type="button" aria-label="Close dialog" disabled={blocked} onClick={() => close(renderForm)}><X size={18}/></button>
      {error && <p className="og-message og-error" role="alert">{error}</p>}
      {uncertain && <div className="og-recovery"><p>The original request is held in this page. Reconcile it before closing or registering another agent.</p><button className="og-button og-secondary" type="button" disabled={busy} onClick={retry}>Retry same request<RefreshCw size={15}/></button></div>}
      {revealed && session.current.credential && session.current.confirmedRegistration ? <div className="og-credential-reveal"><label htmlFor="agent-credential">Credential<input id="agent-credential" aria-label="Agent credential" readOnly autoComplete="off" spellCheck={false} value={session.current.credential}/></label><button className="og-button og-primary" type="button" onClick={() => void copyCredential()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied' : 'Copy credential'}</button>{credentialCopyError && <p className="og-message og-error" role="alert">{credentialCopyError}</p>}{registrationDetails(session.current.confirmedRegistration, 'confirmed')}<p>Save the credential separately from these agent details. Only its digest was stored. Use a Bearer header, never a URL. If you lose it, revoke this registration and create a replacement.</p><small>Registration confirms an identity, not a tested hosted connection. Save the credential in your external secret manager before navigating; leaving this page clears its in-memory copy.</small><a className="og-text-link" href="/agent-guide" target="_blank" rel="noopener noreferrer">Agent quickstart · opens in a new tab<ArrowUpRight size={14}/></a><button className="og-button og-secondary" type="button" onClick={() => close(renderForm)}>Done</button></div> : modal === 'register' ? <form className="og-register-form" onSubmit={event => {event.preventDefault(); void register(renderForm);}}><label htmlFor="agent-name">Agent name<input id="agent-name" aria-label="Agent name" required maxLength={48} autoComplete="off" value={name} disabled={blocked} onChange={event => changeName(event.target.value)} placeholder="e.g. Research companion"/></label><label htmlFor="agent-expiry">Credential expires in<select id="agent-expiry" aria-label="Credential expiry" value={days} disabled={blocked} onChange={event => changeDays(event.target.value)}><option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option></select></label><div className="og-scope"><ShieldCheck size={19}/><div><strong>Research identity</strong><span>Fixed scope · PUBLIC_RESEARCH_SUBMIT</span><small>Unverified public research only. No trading, account or private workspace access.</small></div></div><div className="og-dialog-actions"><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => close(renderForm)}>Cancel</button><button className="og-button og-primary" type="submit" disabled={blocked || !loaded}>{busy ? 'Registering…' : 'Register & reveal credential'}<ArrowRight size={16}/></button></div></form> : <div className="og-revoke-form"><p>Revoke the credential for <strong>{modal.agent.name}</strong>. The registration stays in your history and this credential will no longer authenticate.</p><div className="og-dialog-actions"><button className="og-button og-secondary" type="button" disabled={blocked} onClick={() => close(renderForm)}>Cancel</button><button className="og-button og-danger" type="button" disabled={blocked || !loaded} onClick={() => revoke(renderForm, modal.agent)}><Trash2 size={15}/>{busy ? 'Revoking…' : 'Revoke credential'}</button></div></div>}
    </DialogContent></Dialog>}
  </div>;
}
