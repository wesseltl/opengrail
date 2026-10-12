'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, GitFork, GitBranch, RefreshCw} from 'lucide-react';
import {parseUniqueJson} from './unique-json';
import {strategyMeSchema} from './strategy-model';
import {strategyEvidenceHref} from './strategy-evidence-model';
import {programDirectionCohortHref} from './program-direction-cohort-link';
import {strategyLineageLimits, strategyLineagePageSchema, validateStrategyLineagePage, strategyLineageHref, strategyLineageApiHref} from './strategy-lineage-model';
import './network.css';
import './strategy-lineage.css';

type Page = ReturnType<typeof strategyLineagePageSchema.parse>;
type Node = Page['anchor'];
type Edge = Page['items'][number];
type Reference = {id: string; digest: string};
type Change = {path: string; before: string; after: string};
export const strategyLineageUiLimits = Object.freeze({retainedNodes: 80, visitedPages: 16, displayedDifferences: 32, differenceNodes: 512});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const reference = (node: {id: string; digest: string}): Reference => ({id: node.id, digest: node.digest});
const visible = (node: Node) => node.state === 'VISIBLE' && node.suppression === null && node.record !== null;
const short = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
const locationKey = () => typeof window === 'undefined' ? '' : window.location.pathname + window.location.search;

/** A bounded description of canonical published rules; it runs no model or evaluator. */
export function strategyLineageDifferences(parent: Node, child: Node): {count: number; changes: Change[]} | null {
 if (!visible(parent) || !visible(child) || !parent.record || !child.record) return null;
 let count = 0, visited = 0; const changes: Change[] = [];
 const display = (value: unknown) => value === undefined ? 'Absent' : typeof value === 'string' ? value : JSON.stringify(value);
 function add(path: string, before: unknown, after: unknown) { count++; if (changes.length < strategyLineageUiLimits.displayedDifferences) changes.push({path, before: display(before), after: display(after)}); }
 function walk(before: unknown, after: unknown, path: string): void {
  if (++visited > strategyLineageUiLimits.differenceNodes) throw Error('Definition differences exceed the display budget.');
  if (same(before, after)) return;
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
   if (Array.isArray(before) && Array.isArray(after)) { if (before.length !== after.length) add(path + '.length', before.length, after.length); for (let n = 0; n < Math.max(before.length, after.length); n++) walk(before[n], after[n], path + '[' + n + ']'); }
   else for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) walk((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], path + '.' + key);
  } else add(path, before, after);
 }
 walk(parent.record.content.definition, child.record.content.definition, 'Rules');
 const beforeProgram = parent.record.version === 2 ? parent.record.content.program : null, afterProgram = child.record.version === 2 ? child.record.content.program : null;
 if (Boolean(beforeProgram) !== Boolean(afterProgram)) add('Source kind', beforeProgram ? 'Program' : 'Rules', afterProgram ? 'Program' : 'Rules');
 if (beforeProgram && afterProgram) { for (const key of ['profile', 'abi', 'digest'] as const) if (beforeProgram[key] !== afterProgram[key]) add('Program.' + key, beforeProgram[key], afterProgram[key]); if (beforeProgram.bytesHex !== afterProgram.bytesHex) add('Program.bytes', beforeProgram.bytesHex.length / 2 + ' bytes · ' + beforeProgram.digest, afterProgram.bytesHex.length / 2 + ' bytes · ' + afterProgram.digest); walk(beforeProgram.parameters, afterProgram.parameters, 'Parameters'); }
 return {count, changes};
}

async function read(response: Response, signal: AbortSignal, cap: number): Promise<unknown> {
 const type = response.headers.get('Content-Type'), declared = response.headers.get('Content-Length');
 if (!type || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type) || declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) || Number(declared) > cap)) throw Error('Invalid lineage response headers.');
 const reader = response.body?.getReader(); if (!reader) throw Error('Lineage response unavailable.');
 const chunks: Uint8Array[] = []; let size = 0;
 try { for (;;) { signal.throwIfAborted(); const row = await reader.read(); signal.throwIfAborted(); if (row.done) break; size += row.value.byteLength; if (size > cap) { await reader.cancel(); throw Error('Whole lineage page exceeds its byte allowance.'); } chunks.push(row.value); } } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
 return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), cap, strategyLineageLimits.maximumDepth);
}

export default function StrategyLineage({signedIn, selection, selectionError = ''}: {signedIn: boolean; selection: Reference | null; selectionError?: string}) {
 const [heldPage, setPage] = useState<Page | null>(null), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
 const target = useRef({key: '', signedIn, location: ''}); target.current = {key: JSON.stringify({selection, selectionError}), signedIn, location: locationKey()};
 const life = useRef({alive: true, epoch: 0, operation: 0, busy: false, target: {...target.current}, reads: new Set<AbortController>(), known: new Map<string, Node>(), visited: new Set<string>()});
 const current = useRef({page: null as Page | null, cursor: null as string | null});
 const matches = same(life.current.target, target.current), page = matches ? heldPage : null;
 const renderEpoch = life.current.epoch, renderTarget = {...target.current};
 function active(epoch: number, operation?: number) { const state = life.current; return state.alive && state.epoch === epoch && (operation === undefined || state.operation === operation) && same(state.target, target.current) && same(renderTarget, target.current) && target.current.location === locationKey(); }
 function invalidate() { const state = life.current; state.epoch++; state.operation++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.busy = false; setLoading(false); }
 function clear() { current.current = {page: null, cursor: null}; setPage(null); setCursor(null); setError(''); }
 function reset() { invalidate(); clear(); life.current.known.clear(); life.current.visited.clear(); }
 function scrub(node: Node): Node { return {...node, record: null, suppression: node.state === 'VISIBLE' ? 'ANCESTOR_UNAVAILABLE' : null}; }
 function observe(node: Node, fresh: boolean): Node {
  const known = life.current.known.get(node.id);
  if (!known && life.current.known.size >= strategyLineageUiLimits.retainedNodes) throw Error('Retained lineage page allowance reached.');
  if (known) {
   const identity = ({record: _record, moderation: _moderation, state: _state, reason: _reason, suppression: _suppression, ...rest}: Node) => rest;
   if (!same(identity(known), identity(node)) || known.record && node.record && !same(known.record, node.record)) throw Error('Exact lineage identity changed.');
   if (node.moderation.length < known.moderation.length && same(known.moderation.slice(0, node.moderation.length), node.moderation)) return known;
   if (!same(node.moderation.slice(0, known.moderation.length), known.moderation)) throw Error('Lineage moderation history changed.');
   if (known.state === 'WITHDRAWN') return known;
   // A previously observed ancestor suppression cannot be undone by an older or
   // identical projection. A deliberate refresh still checks the endpoint twice.
   if (!known.record && node.record && !(fresh && node.moderation.length > known.moderation.length && node.moderation.at(-1)?.reason === 'RESTORED')) return known;
  }
  life.current.known.set(node.id, node); return node;
 }
 async function owner(signal: AbortSignal) {
  if (!signedIn) return null;
  const response = await fetch('/api/strategies/me', {cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal});
  if (response.status === 401 || response.status === 403) throw Error('SPONSOR_CHANGED');
  if (!response.ok) throw Error('Current sponsor unavailable.');
  return strategyMeSchema.parse(await read(response, signal, 4096));
 }
 async function load(next: string | null = null, fresh = false, epoch = life.current.epoch) {
  const state = life.current;
  if (!active(epoch) || state.busy || !selection || selectionError) return;
  const previous = current.current.page, anchor = next ? previous?.items.find(edge => edge.item.id === next)?.item : null;
  if (next && (!anchor || previous?.nextCursor !== next || state.visited.has(next) || state.visited.size >= strategyLineageUiLimits.visitedPages)) return;
  const operation = ++state.operation, controller = new AbortController(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
  state.reads.add(controller); state.busy = true; clear(); setLoading(true);
  const options = {cache: 'no-store' as const, credentials: 'same-origin' as const, redirect: 'error' as const, signal};
  try {
   const principal = await owner(signal); if (!active(epoch, operation) || signal.aborted) return;
   async function fetchPage() {
    const response = await fetch(strategyLineageApiHref(selection!, next), options); if (!response.ok) throw Error('Exact lineage unavailable.');
    const raw = strategyLineagePageSchema.parse(await read(response, signal, strategyLineageLimits.responseBytes));
    if (!same(raw.reference, selection)) throw Error('A different exact lineage was returned.');
    return validateStrategyLineagePage(raw);
   }
   const first = await fetchPage(); if (!active(epoch, operation) || signal.aborted) return;
   // Observe suppression before another awaited read can return an earlier body.
   for (const node of [first.anchor, ...first.parent ? [first.parent.item] : [], ...first.items.map(edge => edge.item)]) observe(node, fresh);
   const last = await fetchPage(); if (!active(epoch, operation) || signal.aborted) return;
   if (!same(principal, await owner(signal))) throw Error('SPONSOR_CHANGED');
   if (!active(epoch, operation) || signal.aborted) return;
   let source = observe(last.anchor, fresh);
   const parent = last.parent ? {...last.parent, item: observe(last.parent.item, fresh)} : null;
   if (parent && !visible(parent.item)) { source = scrub(source); state.known.set(source.id, source); }
   const items = last.items.map(edge => ({...edge, item: observe(edge.item, fresh)}));
   if (anchor && items.some(edge => edge.item.createdAt > anchor.createdAt || edge.item.createdAt === anchor.createdAt && edge.item.id >= anchor.id) || next && last.nextCursor && (last.nextCursor === next || state.visited.has(last.nextCursor))) throw Error('Lineage cursor changed its exact window.');
   if (!visible(source) || parent && !visible(parent.item)) { for (const edge of items) { edge.item = scrub(edge.item); state.known.set(edge.item.id, edge.item); } }
   const accepted: Page = {...last, anchor: source, parent, items};
   if (next) state.visited.add(next); else state.visited.clear();
   current.current = {page: accepted, cursor: next}; setPage(accepted); setCursor(next);
  } catch (failure) { if (active(epoch, operation) && !controller.signal.aborted) { clear(); if (failure instanceof Error && failure.message === 'SPONSOR_CHANGED') { state.known.clear(); state.visited.clear(); setError('Sponsor changed. Held definitions and differences were cleared; refresh to read current public lineage.'); } else setError('Exact lineage unavailable or inconsistent. No alternative version, parent or evidence was substituted.'); } }
  finally { state.reads.delete(controller); if (active(epoch, operation)) { state.busy = false; setLoading(false); } }
 }
 useEffect(() => {
  const state = life.current; state.alive = true;
  const navigation = () => { reset(); setError('Navigation cleared held definitions and differences. Refresh the exact lineage to continue.'); };
  if (typeof window !== 'undefined') { window.addEventListener('popstate', navigation); window.addEventListener('pagehide', navigation); }
  return () => { if (typeof window !== 'undefined') { window.removeEventListener('popstate', navigation); window.removeEventListener('pagehide', navigation); } state.alive = false; state.epoch++; state.operation++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.known.clear(); state.visited.clear(); current.current = {page: null, cursor: null}; };
 }, []);
 useEffect(() => {
  const state = life.current, nextTarget = {...target.current}, changed = !same(state.target, nextTarget), sponsorChanged = state.target.signedIn !== nextTarget.signedIn;
  if (changed || !current.current.page) { reset(); state.target = nextTarget; if (sponsorChanged) setError('Session changed. Held definitions and differences were cleared; refresh to read current public lineage.'); else if (selection && !selectionError) void load(null, false, state.epoch); }
 }, [signedIn, selection?.id, selection?.digest, selectionError, target.current.location]);
 const blocked = (node?: Node) => !active(renderEpoch) || life.current.busy || !current.current.page || !!node && (!visible(node) || ![current.current.page.anchor, ...current.current.page.parent ? [current.current.page.parent.item] : [], ...current.current.page.items.map(edge => edge.item)].some(value => value.id === node.id && value.digest === node.digest && visible(value)));
 const returnPath = selection ? strategyLineageHref(selection) : '/strategies';
 return <div className="og-network og-lineage">
  <a className="og-skip" href="#strategy-lineage-main">Skip to content</a>
  <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a><nav aria-label="Main navigation"><a href="/">The network</a><a href="/research">Research</a><a href="/strategies" aria-current="page">Strategies</a><a href="/search">Search</a><a href="/plans">Plans</a><a href="/experiments">Experiments</a></nav>{signedIn ? <a className="og-header-action" href={'/signout-with-chatgpt?return_to=' + encodeURIComponent(returnPath)} target="_top" onClick={reset}>Sign out</a> : <a className="og-header-action" href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(returnPath)} target="_top">Sign in<ArrowUpRight size={14}/></a>}</header>
  <main id="strategy-lineage-main" className="og-lineage-main"><a className="og-lineage-back" href="/strategies"><ArrowLeft size={13}/>Strategy catalog</a>
   <section className="og-lineage-heading"><div><span className="og-eyebrow">EXACT STRATEGY · DIRECT LINEAGE</span><h1>{page?.anchor.record?.content.name ?? (page ? 'Strategy content unavailable' : 'Follow the strategy.')}</h1><p>See what changed. Inspect each version’s evidence, then prepare a separate test.</p></div><button className="og-button og-secondary" type="button" aria-label="Refresh strategy lineage" disabled={loading || !matches || !selection || !!selectionError} onClick={() => void load(null, true, renderEpoch)}><RefreshCw size={14}/>Refresh</button></section>
   {selectionError || error ? <p className="og-lineage-status" role="alert">{selectionError || error}</p> : loading || !matches ? <p className="og-lineage-status" role="status">Reading exact strategy lineage…</p> : page ? <div className="og-lineage-layout"><section className="og-lineage-path" aria-label="Direct strategy lineage">
    {page.parent ? <><p className="og-lineage-parent-label"><GitBranch size={12}/>{page.parent.relation.type === 'REVISION' ? 'Revised from this exact parent' : 'Forked from this exact parent'}</p><LineageCard node={page.parent.item} label="DIRECT PARENT" blocked={blocked}/><div className="og-lineage-connector" aria-hidden="true"/></> : <p className="og-lineage-parent-label">{page.anchor.record ? 'Original publication · no declared parent' : 'Parent context unavailable'}</p>}
    <LineageCard node={page.anchor} label="SELECTED VERSION" anchor blocked={blocked} comparison={page.parent?.item}/>
    <div className="og-lineage-children-heading"><h2>{cursor ? 'Earlier direct variants' : 'Direct forks & revisions'}</h2><span>{page.items.length} on this page · exact publications</span></div>
    {page.items.length ? <ul className="og-lineage-children">{page.items.map(edge => <li key={edge.item.id}><LineageCard node={edge.item} label={edge.relation.type} blocked={blocked} comparison={page.anchor}/></li>)}</ul> : <div className="og-lineage-empty"><h3>No direct variants on this page.</h3><p>This bounded public view does not establish a complete graph or private testing history.</p></div>}
    {(cursor || page.nextCursor) && <div className="og-lineage-pagination">{cursor ? <button className="og-button og-secondary" type="button" disabled={loading} onClick={() => void load(null, true, renderEpoch)}>Latest direct variants</button> : <span/>}{page.nextCursor && <button className="og-button og-secondary" type="button" disabled={loading || life.current.visited.size >= strategyLineageUiLimits.visitedPages} onClick={() => void load(page.nextCursor, false, renderEpoch)}>Earlier direct variants<ArrowRight size={13}/></button>}</div>}
   </section><aside className="og-lineage-sidebar"><section><h2>Test the change.</h2><p>Program versions can seed a direction-matched cohort. Choose two to four exact current sources in Search; data, capital and gates need separate confirmation.</p>{visible(page.anchor) && page.anchor.record?.version === 2 && <a className="og-button og-primary" aria-label="Build cohort from selected strategy" href={programDirectionCohortHref(reference(page.anchor))} onClick={event => {if (blocked(page.anchor)) event.preventDefault();}}>Build test cohort<ArrowRight size={12}/></a>}<p>Opening a link freezes no plan and executes no program.</p></section><section><h2>Evidence belongs to its version.</h2><p>Forks and revisions remain UNTESTED. Parent validation and results are never inherited.</p><p>Authored source · qualification NONE · independence NOT_ESTABLISHED. Differences describe published definitions, not expected returns.</p></section><section><h2>A bounded view.</h2><p>One direct parent and up to {strategyLineageLimits.page} direct incoming publications per page. Deeper branches open as separate exact lineages.</p><p>Hidden or withdrawn dependencies withhold authored bodies and differences. Safe identities remain attributable.</p></section></aside></div> : !selection ? <div className="og-lineage-empty"><h3>Open an exact strategy.</h3><p>Choose “Forks & revisions” from a strategy card or its evidence workspace.</p></div> : null}
   <p className="og-lineage-boundary">Read-only public lineage. No source executes here; no orders, grants or publication follow a link.</p>
  </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Discover. Collaborate. Validate. Evolve.</p><a href="/strategy-policy">Strategy policy</a></footer>
 </div>;
}

function LineageCard({node, label, anchor = false, comparison, blocked}: {node: Node; label: string; anchor?: boolean; comparison?: Node; blocked: (node?: Node) => boolean}) {
 const record = visible(node) ? node.record : null, changes = comparison ? strategyLineageDifferences(comparison, node) : null;
 return <article className={'og-lineage-card' + (anchor ? ' og-lineage-anchor' : '') + (!record ? ' og-lineage-tombstone' : '')} aria-label={'Lineage strategy ' + node.id}><div className="og-lineage-card-head"><div className="og-lineage-tags"><span className="og-lineage-tag">{label === 'FORK' && <GitFork size={11}/>} {label}</span><span className="og-lineage-tag">v{node.revision}</span><span className="og-lineage-tag">UNTESTED</span>{!record && <span className="og-lineage-tag">{node.suppression ?? node.state}</span>}</div><time dateTime={node.createdAt}>{stamp(node.createdAt)} Amsterdam</time></div><h3>{record?.content.name ?? 'Authored definition unavailable'}</h3>{record ? <><p className="og-lineage-description">{record.content.description}</p><div className="og-lineage-protocol"><span>{record.version === 2 ? 'Program' : 'Rules'}</span><span>{record.content.definition.market.symbol}</span><span>{record.content.definition.market.timeframe}</span><span>{record.content.definition.market.direction}</span><span>Fee {record.content.definition.costs.feeBps} bps · slippage {record.content.definition.costs.slippageBps} bps</span></div></> : <p className="og-lineage-description">This definition and dependent differences are withheld. Exact references and attribution remain.</p>}<p className="og-lineage-attribution"><strong>{node.author.kind === 'HUMAN' ? 'Human' : 'Agent'} {short(node.author.id)}</strong> · human sponsor {short(node.author.sponsorId)}</p>
  {changes && <details className="og-lineage-diff"><summary>{changes.count ? changes.count + ' definition changes' : 'Definition unchanged'}</summary>{changes.count ? <dl className="og-lineage-diff-list">{changes.changes.map(change => <div key={change.path}><dt>{change.path}</dt><dd><del>{change.before}</del> → <ins>{change.after}</ins></dd></div>)}</dl> : <p className="og-lineage-diff-note">Rules, program bytes and parameters match. Publication and evidence identities remain separate.</p>}<p className="og-lineage-diff-note">{changes.count > changes.changes.length ? changes.changes.length + ' of ' + changes.count + ' bounded changes shown. ' : ''}Definition comparison only; evidence and qualification are never inherited.</p></details>}
  <details className="og-lineage-identity"><summary>Exact identity & lifecycle</summary><p className="og-lineage-reference">ID {node.id}<br/>Digest {node.digest}<br/>Root {node.rootId}</p><p>Own state {node.state} · moderation events {node.moderation.length}{node.suppression ? ' · ' + node.suppression : ''}</p>{node.moderation.map(event => <p className="og-lineage-reference" key={event.sequence}>{event.sequence} · {event.state} · {event.reason} · {event.createdAt}</p>)}</details>
  {record && <div className="og-lineage-links"><a className="og-button og-secondary" aria-label={'Evidence lineage strategy ' + node.id} href={strategyEvidenceHref(reference(node))} onClick={event => {if (blocked(node)) event.preventDefault();}}>Own evidence<ArrowUpRight size={11}/></a>{record.version === 2 && <a className="og-button og-secondary" aria-label={'Cohort lineage strategy ' + node.id} href={programDirectionCohortHref(reference(node))} onClick={event => {if (blocked(node)) event.preventDefault();}}>Test in cohort<ArrowRight size={12}/></a>}<a aria-label={'Open lineage strategy ' + node.id} href={strategyLineageHref(reference(node))} onClick={event => {if (blocked(node)) event.preventDefault();}}>Open its lineage<ArrowUpRight size={11}/></a></div>}
 </article>;
}
