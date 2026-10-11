'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, Download, FlaskConical, Play, RefreshCw, X} from 'lucide-react';
import {parseUniqueJson} from './unique-json';
import {boundedStrategyRecord, strategyDigest, strategyGetSchema} from './strategy-model';
import {experimentGetSchema, experimentInputStrategy, validateExperimentItem, type ExperimentPublicItem} from './experiment-model';
import {verifyDemoArtifact, type DemoArtifact} from './demo-model';
import {compareDemoArtifact, comparisonLimits, verifyComparisonReport, type ComparisonReport} from './evaluator-comparison';
import {sessionEvidenceLimits, verifySessionEvidenceArtifact, verifySessionEvidenceReview, type SessionEvidenceArtifact, type SessionEvidenceReview} from './session-evidence-model';
import {reviewSessionEvidence} from './session-evidence';
import {validateProgramRunOutcome} from './program-evidence';
import {programRunLimits,type ProgramRunOutcome} from './program-run-model';
import {compareProgramOutcome} from './program-comparison';
import {bindProgramComparisonReport,type ProgramComparisonReport} from './program-comparison-model';
import {sealExperimentReviewDraft} from './experiment-review-model';
import {experimentHref} from './experiment-link';
import {validationHref} from './validation-link';
import './network.css';
import './validation.css';

type PublicContext = {outcome: ExperimentPublicItem; manifest: ExperimentPublicItem; strategy: ReturnType<typeof strategyGetSchema.parse>['item']};
type Artifact = DemoArtifact | SessionEvidenceArtifact | ProgramRunOutcome;
type LocalReport = ComparisonReport | SessionEvidenceReview | ProgramComparisonReport;
type Selection = {origin: 'PUBLIC_OUTCOME' | 'SUPPLIED_ARTIFACT'; artifact: Artifact; context: PublicContext | null};
type PublicReference = {outcome: {id: string; digest: string}; manifest: {id: string; digest: string}; strategy: {id: string; digest: string}};
type Attempt = {id: string; attemptedAt: string; origin: Selection['origin']; publicReference: PublicReference | null; status: 'RUNNING' | 'INTERRUPTED' | ComparisonReport['status'] | ProgramComparisonReport['status']; report: LocalReport | null; programReconstruction?: ProgramRunOutcome | null; error: string | null; cleared: boolean};
const continuousArtifact = (artifact: Artifact): artifact is SessionEvidenceArtifact => 'kind' in artifact && artifact.kind === 'CONTINUOUS_DEMO_ARTIFACT';
const programArtifact = (artifact: Artifact): artifact is ProgramRunOutcome => 'kind' in artifact && artifact.kind === 'LOCAL_PROGRAM_RUN_OUTCOME';
const historyBytes = 33_554_432;
const artifactBytes = Math.max(comparisonLimits.artifactBytes,programRunLimits.outcomeBytes);
async function readArtifact(raw: unknown): Promise<Artifact> { const kind = raw && typeof raw === 'object' && 'kind' in raw ? raw.kind : null; return kind === 'LOCAL_PROGRAM_RUN_OUTCOME' ? validateProgramRunOutcome(raw) : kind === 'CONTINUOUS_DEMO_ARTIFACT' ? verifySessionEvidenceArtifact(raw) : verifyDemoArtifact(raw); }
async function compareArtifact(artifact: Artifact,signal:AbortSignal):Promise<{report:LocalReport;programReconstruction:ProgramRunOutcome|null}>{
 if(programArtifact(artifact)){const result=await compareProgramOutcome(structuredClone(artifact),{signal});return {report:result.report,programReconstruction:result.reconstructed};}
 return {report:continuousArtifact(artifact)?await verifySessionEvidenceReview(await reviewSessionEvidence(structuredClone(artifact),{signal})):await verifyComparisonReport(await compareDemoArtifact(structuredClone(artifact))),programReconstruction:null};
}
async function correlateReport(report: LocalReport,artifact: Artifact){
 if(programArtifact(artifact)){if(report.kind!=='LOCAL_PROGRAM_COMPARISON')throw Error('Wrong program comparison method.');await bindProgramComparisonReport(report,artifact);return;}
 if(continuousArtifact(artifact)){if(report.kind!=='LOCAL_CONTINUOUS_DEMO_RECONSTRUCTION'||!same(report.identity,{artifact:artifact.resultDigest,input:artifact.inputDigest,journal:artifact.input.journalDigest,state:artifact.input.finalStateDigest}))throw Error('Wrong continuous reconstruction.');return;}
 if(report.kind!=='LOCAL_EVALUATOR_COMPARISON'||!same(report.identity,identity(artifact))||!same(report.summaries.claimed,brief(artifact)))throw Error('Wrong batch comparison.');
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const short = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
const pairNames = {CLAIM_PRIMARY: 'Claim ↔ primary', CLAIM_REFERENCE: 'Claim ↔ reference', PRIMARY_REFERENCE: 'Primary ↔ reference'} as const;
const amount = (value: number) => new Intl.NumberFormat('en-GB', {maximumFractionDigits: 6}).format(value);
const refFor = (item: {id: string; digest: string}) => ({id: item.id, digest: item.digest});
const reference = (context: PublicContext): PublicReference => ({outcome: {id: context.outcome.id, digest: context.outcome.digest}, manifest: {id: context.manifest.id, digest: context.manifest.digest}, strategy: {id: context.strategy.id, digest: context.strategy.digest}});
const identity = (artifact: DemoArtifact) => ({requestId: artifact.requestId, claimedArtifact: artifact.resultDigest, request: artifact.digests.request, strategy: artifact.digests.strategy, dataset: artifact.digests.dataset, signals: artifact.digests.signals, declaredMethod: artifact.digests.evaluator});
const brief = (artifact: DemoArtifact) => ({status: artifact.status, reason: artifact.reason, metrics: artifact.metrics, benchmark: artifact.benchmark});
class PublicUnavailable extends Error { constructor(readonly scope: {outcomeId: string; manifestId?: string; strategyId?: string}) { super('Current public content unavailable.'); } }

async function responseJson(response: Response) {
  const cap = 1_048_576, reader = response.body?.getReader(); if (!reader) throw Error('Missing public response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > cap) { await reader.cancel(); throw Error('Public response too large.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), cap, 16);
}
async function publicContext(outcomeId: string, signal: AbortSignal, expectedDigest: string | null = null): Promise<PublicContext> {
  async function experiment(id: string) {
    signal.throwIfAborted();
    const response = await fetch('/api/experiments?id=' + encodeURIComponent(id), {cache: 'no-store', signal});
    if (response.status === 404) throw new PublicUnavailable({outcomeId,...(id !== outcomeId ? {manifestId:id} : {})});
    if (!response.ok) throw Error('Public experiment unavailable.');
    const value = experimentGetSchema.parse(await responseJson(response)), item = await validateExperimentItem(value.item);
    if (item.id !== id) throw Error('Wrong public identity.');
    if (item.state !== 'VISIBLE' || !item.record || item.suppression) throw new PublicUnavailable({outcomeId, ...(item.type === 'MANIFEST' || item.suppression === 'PARENT_UNAVAILABLE' ? {manifestId: item.type === 'MANIFEST' ? item.id : item.manifest?.id} : {}), ...(item.suppression === 'SOURCE_UNAVAILABLE' ? {strategyId: item.strategy.id} : {})});
    return item;
  }
  const outcome = await experiment(outcomeId);
  if (expectedDigest !== null && outcome.digest !== expectedDigest) throw Error('Wrong exact outcome digest.');
  if (outcome.type !== 'OUTCOME' || outcome.record?.type !== 'OUTCOME' || !outcome.manifest || outcome.record.content.result.kind !== 'ARTIFACT') throw Error('No retained artifact.');
  const manifest = await experiment(outcome.manifest.id);
  if (manifest.type !== 'MANIFEST' || manifest.record?.type !== 'MANIFEST' || manifest.digest !== outcome.manifest.digest || !same(manifest.strategy, outcome.strategy)) throw Error('Wrong manifest reference.');
  if (outcome.record.version !== manifest.record.version) throw Error('Different evidence method.');
  const artifact = await readArtifact(outcome.record.content.result.artifact);
  if (!artifact.input || !same(artifact.input, manifest.record.content.input)) throw Error('Different manifest input.');
  signal.throwIfAborted();
  const response = await fetch('/api/strategies?id=' + encodeURIComponent(outcome.strategy.id), {cache: 'no-store', signal});
  if (response.status === 404) throw new PublicUnavailable({outcomeId,strategyId:outcome.strategy.id});
  if (!response.ok) throw Error('Public strategy unavailable.');
  const strategy = strategyGetSchema.parse(await responseJson(response)).item;
  if (strategy.id !== outcome.strategy.id || strategy.digest !== outcome.strategy.digest) throw Error('Wrong source identity.');
  if (strategy.state !== 'VISIBLE' || !strategy.record) throw new PublicUnavailable({outcomeId, strategyId: strategy.id});
  if (await strategyDigest(boundedStrategyRecord(strategy.record).payload) !== strategy.digest || !same(strategy.record, experimentInputStrategy(artifact.input).record)) throw Error('Exact source inconsistent.');
  return {outcome, manifest, strategy};
}
function publicArtifact(context: PublicContext): Artifact {
  const record = context.outcome.record;
  if (!record || record.type !== 'OUTCOME' || record.content.result.kind !== 'ARTIFACT') throw Error('No artifact.');
  return record.content.result.artifact;
}
function sameContext(a: PublicContext, b: PublicContext) { return same(reference(a), reference(b)) && same(a.outcome.record, b.outcome.record) && same(a.manifest.record, b.manifest.record) && same(a.strategy.record, b.strategy.record); }
function download(value: unknown, name: string) {
  const payload = JSON.stringify(value); if (new TextEncoder().encode(payload).byteLength > historyBytes) throw Error('Report export exceeds its local bound.');
  const blob = new Blob([payload], {type: 'application/json'}), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export default function Validation({outcomeId = null, outcomeDigest = null, selectionError = false, signedIn = false}: {outcomeId?: string | null; outcomeDigest?: string | null; selectionError?: boolean; signedIn?: boolean}) {
  const [publicId, setPublicId] = useState(outcomeId ?? ''), [selection, setSelection] = useState<Selection | null>(null), [json, setJson] = useState(''), [rights, setRights] = useState(false);
  const [busy, setBusy] = useState<'LOAD' | 'IMPORT' | 'RUN' | 'EXPORT' | 'PAIR' | null>(null), [message, setMessage] = useState(''), [attempts, setAttempts] = useState<Attempt[]>([]), [exportError, setExportError] = useState('');
  const life = useRef({alive: true, epoch: 0, workId: 0, busy: null as typeof busy, activeAttempt: null as string | null, reads: new Set<AbortController>(), previousSignedIn: signedIn});
  const current = useRef({publicId, selection, json, rights, attempts}); current.current = {publicId, selection, json, rights, attempts};
  const renderEpoch = life.current.epoch;
  function updateAttempts(next: Attempt[]) { current.current.attempts = next; setAttempts(next); }
  function replaceAttempt(id: string, changes: Partial<Attempt>) { updateAttempts(current.current.attempts.map(value => value.id === id ? {...value, ...changes} : value)); }
  function retainInterruptedProgramResult(id:string,report:LocalReport|null,reconstruction:ProgramRunOutcome|null){
    const held=current.current.attempts.find(value=>value.id===id);
    if(!life.current.alive||held?.status!=='INTERRUPTED'||held.cleared||report?.kind!=='LOCAL_PROGRAM_COMPARISON'||!reconstruction||report.reconstructedOutcomeDigest!==reconstruction.outcomeDigest)return;
    replaceAttempt(id,{report,programReconstruction:reconstruction,error:'Complete local computation retained after interruption. Final current-source confirmation did not complete; this is historical author-reported evidence.'});
  }
  function invalidate(reason: string) {
    const state = life.current; state.epoch++; state.workId++; state.reads.forEach(controller => controller.abort()); state.reads.clear();
    updateAttempts(current.current.attempts.map(value => value.status === 'RUNNING' ? {...value, status: 'INTERRUPTED', error: reason} : value));
    state.activeAttempt = null; state.busy = null; setBusy(null);
  }
  function clearSelection() { current.current.selection = null; current.current.json = ''; current.current.rights = false; setSelection(null); setJson(''); setRights(false); }
  function redactPublic(outcome: string, scope?: PublicUnavailable['scope']) {
    updateAttempts(current.current.attempts.map(value => value.publicReference && (value.publicReference.outcome.id === outcome || scope?.manifestId === value.publicReference.manifest.id || scope?.strategyId === value.publicReference.strategy.id) ? {...value, report: null, programReconstruction: null, cleared: true, error: 'Current public content is unavailable; held report payload cleared. Earlier exports cannot be recalled.'} : value));
  }
  function clearSession() {
    invalidate('Signed-in navigation interrupted confirmation.'); clearSelection(); updateAttempts(current.current.attempts.map(value => ({...value, report: null, programReconstruction: null, cleared: true, error: 'Held payload cleared on sign-out. The safe prior disposition is retained.'}))); setMessage('Held artifacts and report payloads cleared. Local checks still work anonymously.');
  }
  useEffect(() => {
    life.current.alive = true;
    return () => { const state = life.current; state.alive = false; state.epoch++; state.workId++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.busy = null; state.activeAttempt = null; current.current.selection = null; current.current.json = ''; current.current.rights = false; current.current.attempts = []; };
  }, []);
  useEffect(() => {
    current.current.publicId = outcomeId ?? ''; setPublicId(current.current.publicId);
    if (selectionError) { invalidate('Invalid public reference interrupted confirmation.'); clearSelection(); setMessage('Invalid public reference. Use one outcome UUID and optional exact digest; duplicate and unknown query fields are rejected.'); }
    else if (outcomeId !== null) void loadPublic(outcomeId, outcomeDigest); else { invalidate('Public outcome navigation interrupted confirmation.'); clearSelection(); setMessage(''); }
  }, [outcomeId, outcomeDigest, selectionError]);
  useEffect(() => { if (life.current.previousSignedIn && !signedIn) clearSession(); life.current.previousSignedIn = signedIn; }, [signedIn]);
  function available(epoch = renderEpoch) { return life.current.alive && life.current.epoch === epoch && !life.current.busy; }
  async function loadPublic(id: string, expectedDigest: string | null = null) {
    const state = life.current; if (!state.alive) return;
    invalidate('Public outcome navigation interrupted this comparison before confirmation.'); clearSelection(); setMessage('');
    if (!uuid.test(id) || expectedDigest !== null && !/^[a-f0-9]{64}$/.test(expectedDigest)) { setMessage('Use exactly one lowercase public outcome UUID. No artifact or credential belongs in a URL.'); return; }
    const epoch = state.epoch, workId = ++state.workId, controller = new AbortController(); state.reads.add(controller); state.busy = 'LOAD'; setBusy('LOAD');
    try {
      const context = await publicContext(id, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), expectedDigest);
      if (!state.alive || epoch !== state.epoch || workId !== state.workId || controller.signal.aborted) return;
      const artifact = publicArtifact(context), next: Selection = {origin: 'PUBLIC_OUTCOME', artifact, context};
      current.current.selection = next; current.current.json = JSON.stringify(artifact); current.current.rights = false; setSelection(next); setJson(current.current.json); setRights(false);
      setMessage('Exact current outcome, manifest and strategy captured from public responses. Confirm local use before checking; nothing is published by this page.');
    } catch (error) { if (state.alive && epoch === state.epoch && workId === state.workId && !controller.signal.aborted) { redactPublic(id, error instanceof PublicUnavailable ? error.scope : undefined); clearSelection(); setMessage('Public artifact unavailable or inconsistent. Hidden, withdrawn, missing-artifact and mismatched references cannot be checked as current public evidence.'); } }
    finally { state.reads.delete(controller); if (state.alive && epoch === state.epoch && workId === state.workId) { state.busy = null; setBusy(null); } }
  }
  function editId(value: string) { if (!available() || current.current.publicId !== publicId) return; current.current.publicId = value; setPublicId(value); }
  function localMode() { if (!available()) return; invalidate('Switching artifact source interrupted confirmation.'); clearSelection(); setMessage('Supplied artifacts are local claims. Their author and registry provenance are not authenticated by import.'); }
  function edit(value: string) {
    if (!available() || current.current.json !== json || current.current.selection?.origin === 'PUBLIC_OUTCOME') return;
    current.current.selection = null; current.current.json = value; current.current.rights = false; setSelection(null); setJson(value); setRights(false); setMessage('');
  }
  function rejection(error: string) {
    if (current.current.attempts.length >= comparisonLimits.attempts) return;
    updateAttempts([...current.current.attempts, {id: crypto.randomUUID(), attemptedAt: new Date().toISOString(), origin: 'SUPPLIED_ARTIFACT', publicReference: null, status: 'UNRECONSTRUCTIBLE', report: null, error, cleared: false}]);
  }
  async function importArtifact(file: File | undefined) {
    const state = life.current; if (!file || !available() || current.current.attempts.length >= comparisonLimits.attempts) return;
    invalidate('Import navigation interrupted confirmation.'); clearSelection(); setMessage('');
    const epoch = state.epoch, workId = ++state.workId; state.busy = 'IMPORT'; setBusy('IMPORT');
    try {
      if (file.size > artifactBytes) throw Error('Artifact too large.');
      const bytes = await file.arrayBuffer(); if (bytes.byteLength > artifactBytes) throw Error('Artifact too large.');
      const raw = new TextDecoder('utf-8', {fatal: true}).decode(bytes), artifact = await readArtifact(parseUniqueJson(raw, artifactBytes, 24));
      if (!state.alive || epoch !== state.epoch || workId !== state.workId) return;
      const next: Selection = {origin: 'SUPPLIED_ARTIFACT', artifact, context: null}; current.current.selection = next; current.current.json = raw; current.current.rights = false;
      setSelection(next); setJson(raw); setRights(false); setMessage('Artifact read locally. Internal digest checks establish byte consistency; no public author or source execution is authenticated.');
    } catch { if (state.alive && epoch === state.epoch && workId === state.workId) { rejection('Artifact import rejected: use bounded unique-key UTF-8 JSON with intact hashes. No supplied text is retained in this safe rejection.'); setMessage('Artifact import rejected. Batch maximum 8 MiB; continuous maximum 512 KiB; program maximum 10 MiB; duplicate keys, malformed UTF-8 and invalid hashes are rejected without uploading or executing submitted code.'); } }
    finally { if (state.alive && epoch === state.epoch && workId === state.workId) { state.busy = null; setBusy(null); } }
  }
  async function run() {
    const state = life.current, view = current.current;
    if (!available() || view.json !== json || view.selection !== selection || view.rights !== rights || !rights || !view.json || view.attempts.length >= comparisonLimits.attempts) return;
    const epoch = state.epoch, workId = ++state.workId, attemptId = crypto.randomUUID(), selected = view.selection;
    const attempt: Attempt = {id: attemptId, attemptedAt: new Date().toISOString(), origin: selected?.origin ?? 'SUPPLIED_ARTIFACT', publicReference: selected?.context ? reference(selected.context) : null, status: 'RUNNING', report: null, error: null, cleared: false};
    updateAttempts([...view.attempts, attempt]); state.activeAttempt = attemptId; state.busy = 'RUN'; setBusy('RUN'); setMessage(''); let invoked = false, computed: {report:LocalReport;programReconstruction:ProgramRunOutcome|null}|null=null;
    const controller = new AbortController(); state.reads.add(controller);
    try {
      const artifact = await readArtifact(parseUniqueJson(view.json, artifactBytes, 24));
      if (programArtifact(artifact) && new TextEncoder().encode(JSON.stringify(current.current.attempts)).byteLength + programRunLimits.outcomeBytes + 262_144 > historyBytes) throw Error('Full program reconstruction history capacity reached. Earlier outcomes remain retained.');
      if (!state.alive || epoch !== state.epoch || workId !== state.workId || state.activeAttempt !== attemptId) return;
      if (selected && !same(artifact, selected.artifact)) throw Error('Selection changed.');
      if (selected?.context) {
        const fresh = await publicContext(selected.context.outcome.id, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
        if (!sameContext(fresh, selected.context)) throw Error('Public input changed.');
      }
      if (!state.alive || epoch !== state.epoch || workId !== state.workId || state.activeAttempt !== attemptId) return;
      invoked = true;
      const {report,programReconstruction} = await compareArtifact(artifact,controller.signal);
      await correlateReport(report,artifact);
      computed={report,programReconstruction};
      if (!state.alive || epoch !== state.epoch || workId !== state.workId || state.activeAttempt !== attemptId) {retainInterruptedProgramResult(attemptId,report,programReconstruction);return;}
      if (selected?.context) {
        const fresh = await publicContext(selected.context.outcome.id, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
        if (!sameContext(fresh, selected.context)) throw Error('Public input changed.');
      }
      if (!state.alive || epoch !== state.epoch || workId !== state.workId || state.activeAttempt !== attemptId) return;
      replaceAttempt(attemptId, {status: report.status, report, programReconstruction});
    } catch (error) {
      if (state.alive && epoch === state.epoch && workId === state.workId && state.activeAttempt === attemptId) {
        replaceAttempt(attemptId, {status: invoked ? 'FAILED' : 'UNRECONSTRUCTIBLE', error: invoked ? 'No correlated local report was confirmed. This failed attempt is retained; do not count it as agreement.' : 'Artifact or current public bindings could not be reconstructed. No confirmed comparison exists.'});
        if (selected?.context) { redactPublic(selected.context.outcome.id, error instanceof PublicUnavailable ? error.scope : undefined); clearSelection(); setMessage('Current public content or reconstruction is unavailable. Held report payloads cleared; refresh the exact outcome before checking again.'); }
      }
    } finally { if(computed)retainInterruptedProgramResult(attemptId,computed.report,computed.programReconstruction);state.reads.delete(controller); if (state.alive && epoch === state.epoch && workId === state.workId) { state.busy = null; state.activeAttempt = null; setBusy(null); } }
  }
  async function preparePair() {
    const state = life.current, view = current.current, selected = view.selection, peer = selected?.context, peerRecord = peer?.outcome.record;
    if (!available() || selected !== selection || view.rights !== rights || !rights || !peer || peerRecord?.type !== 'OUTCOME' || (peerRecord.version !== 1 && peerRecord.version !== 3) || !peerRecord.content.claim.relation || peerRecord.content.result.kind !== 'ARTIFACT' || view.attempts.length + 2 > comparisonLimits.attempts) return;
    const root = peerRecord.content.claim.relation;
    if (root.id === peer.outcome.id) return;
    const epoch = state.epoch, workId = ++state.workId, controller = new AbortController(), ids = [crypto.randomUUID(), crypto.randomUUID()];
    const references: PublicReference[] = [{...reference(peer), outcome: {id: root.id, digest: root.digest}}, reference(peer)];
    updateAttempts([...view.attempts, ...ids.map((id, index): Attempt => ({id, attemptedAt: new Date().toISOString(), origin: 'PUBLIC_OUTCOME', publicReference: references[index], status: 'RUNNING', report: null, error: null, cleared: false}))]);
    state.reads.add(controller); state.busy = 'PAIR'; setBusy('PAIR'); setMessage(''); setExportError('');
    const active = () => state.alive && epoch === state.epoch && workId === state.workId && !controller.signal.aborted;
    const signal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    let invoked = false;
    const reports: Array<LocalReport | null> = [null, null], reconstructions: Array<ProgramRunOutcome | null> = [null,null];
    try {
      const original = await publicContext(root.id, signal(), root.digest);
      if (!active()) return;
      const originalArtifact = publicArtifact(original), peerArtifact = publicArtifact(peer);
      if (continuousArtifact(originalArtifact) || continuousArtifact(peerArtifact) || original.outcome.record?.version !== peerRecord.version || programArtifact(originalArtifact) !== programArtifact(peerArtifact) || !same(refFor(original.manifest), refFor(peer.manifest)) || !same(original.manifest.record, peer.manifest.record) || !same(refFor(original.strategy), refFor(peer.strategy)) || !same(original.strategy.record, peer.strategy.record) || !same(originalArtifact.input, peerArtifact.input)) throw Error('Different paired inputs.');
      const contexts = [original, peer], artifacts = [originalArtifact, peerArtifact];
      async function confirm() {
        for (const context of contexts) {
          if (!active()) return false;
          const fresh = await publicContext(context.outcome.id, signal(), context.outcome.digest);
          if (!sameContext(context, fresh)) throw Error('Paired public content changed.');
        }
        return active();
      }
      if (programArtifact(originalArtifact) && new TextEncoder().encode(JSON.stringify(current.current.attempts)).byteLength + 2 * (programRunLimits.outcomeBytes + 262_144) > historyBytes) throw Error('Full paired reconstruction capacity reached. Earlier evidence remains retained.');
      const errors: Array<string | null> = [null, null];
      for (let index = 0; index < artifacts.length; index++) {
        if (!await confirm()) return;
        invoked = true;
        try {
          const artifact = artifacts[index], {report,programReconstruction} = await compareArtifact(artifact,controller.signal);
          await correlateReport(report,artifact);
          reports[index] = report; reconstructions[index] = programReconstruction;
          if (!active()) {for(let n=0;n<=index;n++)retainInterruptedProgramResult(ids[n],reports[n],reconstructions[n]);return;}
        } catch {
          if (!active()) return;
          errors[index] = 'Fixed evaluation did not return a correlated report. This failed attempt is retained.';
        }
      }
      if (!await confirm()) return;
      for (let index = 0; index < ids.length; index++) replaceAttempt(ids[index], {status: reports[index]?.status ?? 'FAILED', report: reports[index], programReconstruction: reconstructions[index], error: errors[index]});
      if (!reports[0] || !reports[1]) { setMessage('Both attempts are retained. A paired review draft requires two correlated reports; no draft was exported.'); return; }
      const draft = await sealExperimentReviewDraft({version: 1, kind: 'LOCAL_EXPERIMENT_REVIEW_DRAFT', preparedAt: new Date().toISOString(), target: {original: references[0].outcome, reproduction: references[1].outcome, manifest: references[0].manifest, strategy: references[0].strategy}, evidence: {...(programArtifact(originalArtifact)?{method:'PROGRAM_DEMO'}:{}),original: reports[0], reproduction: reports[1]}, classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false});
      if (!await confirm()) return;
      download(draft, `opengrail-review-draft-${peer.outcome.id}.json`);
      setMessage('Paired review draft exported from two fresh local checks. Mismatches and adverse results remain in the reports. Import it in Experiments; only an explicitly assigned reviewer can publish a separate attestation. No review was published here.');
    } catch (error) {
      if (active()) {
        for (const id of ids) replaceAttempt(id, {status: invoked ? 'FAILED' : 'UNRECONSTRUCTIBLE', report: null, programReconstruction: null, cleared: true, error: 'Paired references or report confirmation failed. No current review draft was exported; both attempts remain in history.'});
        for (const ref of references) redactPublic(ref.outcome.id, error instanceof PublicUnavailable ? error.scope : undefined);
        clearSelection(); setMessage('Paired draft unavailable. Exact original, reproduction, manifest and strategy must remain visible and consistent through confirmation. Refresh the public outcome before trying again.');
      }
    } finally {
      for(let n=0;n<ids.length;n++)retainInterruptedProgramResult(ids[n],reports[n],reconstructions[n]);
      state.reads.delete(controller);
      if (state.alive && epoch === state.epoch && workId === state.workId) { state.busy = null; setBusy(null); }
    }
  }
  function cancel() { if (!life.current.alive || renderEpoch !== life.current.epoch) return; invalidate('Cancelled before a correlated local report was confirmed.'); setMessage('Local confirmation cancelled. Any interrupted comparison remains in history.'); }
  async function confirmPublicExport(captured: Attempt[], completeHistory: boolean, filename: string, fullProgram=false) {
    const state = life.current, epoch = state.epoch, workId = ++state.workId, controller = new AbortController(); state.reads.add(controller); state.busy = 'EXPORT'; setBusy('EXPORT');
    try {
      for (const attempt of captured) if (!attempt.cleared && attempt.report && attempt.publicReference) {
        const fresh = await publicContext(attempt.publicReference.outcome.id, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), attempt.publicReference.outcome.digest), artifact = publicArtifact(fresh);
        if (!same(reference(fresh), attempt.publicReference)) throw Error('Wrong exported reference.');
        await correlateReport(attempt.report,artifact);
        if (programArtifact(artifact) && attempt.programReconstruction && attempt.programReconstruction.outcomeDigest !== (attempt.report.kind==='LOCAL_PROGRAM_COMPARISON'?attempt.report.reconstructedOutcomeDigest:null)) throw Error('Wrong complete program reconstruction.');
        if (!state.alive || epoch !== state.epoch || workId !== state.workId || controller.signal.aborted) return;
      }
      if (!state.alive || epoch !== state.epoch || workId !== state.workId || !captured.every(attempt => current.current.attempts.includes(attempt))) return;
      download(completeHistory ? {version: 1, kind: 'LOCAL_COMPARISON_SESSION', classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false, retention: 'EXPORTED_SESSION_SNAPSHOT', attempts: captured} : fullProgram ? await validateProgramRunOutcome(captured[0].programReconstruction) : captured[0].report, filename); setExportError('');
    } catch (error) { if (state.alive && epoch === state.epoch && workId === state.workId) { if (error instanceof PublicUnavailable) { redactPublic(error.scope.outcomeId, error.scope); const context = current.current.selection?.context; if (context && (context.outcome.id === error.scope.outcomeId || context.manifest.id === error.scope.manifestId || context.strategy.id === error.scope.strategyId)) clearSelection(); } setExportError('Export withheld. Exact public references could not be confirmed; known unavailable payloads are cleared.'); } }
    finally { state.reads.delete(controller); if (state.alive && epoch === state.epoch && workId === state.workId) { state.busy = null; setBusy(null); } }
  }
  function exportReport(attempt: Attempt) {
    if (!available() || !attempt.report || !current.current.attempts.some(value => value.id === attempt.id && !value.cleared && value.report?.reportDigest === attempt.report?.reportDigest)) return;
    if (attempt.publicReference) { void confirmPublicExport([attempt], false, `opengrail-reconstruction-${attempt.id}.json`); return; }
    try { download(attempt.report, `opengrail-comparison-${attempt.id}.json`); setExportError(''); } catch { setExportError('Export failed. The report remains only in this page session.'); }
  }
  function exportProgramReconstruction(attempt:Attempt){
    if(!available()||!attempt.programReconstruction||!current.current.attempts.some(value=>value===attempt&&!value.cleared)||attempt.report?.kind!=='LOCAL_PROGRAM_COMPARISON'||attempt.programReconstruction.outcomeDigest!==attempt.report.reconstructedOutcomeDigest)return;
    if(attempt.publicReference){void confirmPublicExport([attempt],false,`opengrail-complete-program-reconstruction-${attempt.id}.json`,true);return;}
    try{download(attempt.programReconstruction,`opengrail-complete-program-reconstruction-${attempt.id}.json`);setExportError('');}catch{setExportError('Complete reconstruction export failed. The full outcome remains retained in this page history.');}
  }
  function exportHistory() {
    if (!available() || !current.current.attempts.length) return;
    if (current.current.attempts.some(attempt => !attempt.cleared && attempt.report && attempt.publicReference)) { void confirmPublicExport([...current.current.attempts], true, 'opengrail-comparison-session.json'); return; }
    try { download({version: 1, kind: 'LOCAL_COMPARISON_SESSION', classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false, retention: 'EXPORTED_SESSION_SNAPSHOT', attempts: current.current.attempts}, 'opengrail-comparison-session.json'); setExportError(''); } catch { setExportError('Export failed. History is held only in this page session.'); }
  }
  const context = selection?.context, artifact = selection?.artifact;
  const returnTo = context ? validationHref({id: context.outcome.id, digest: context.outcome.digest}) : !selectionError && outcomeId && uuid.test(outcomeId) && (outcomeDigest === null || /^[a-f0-9]{64}$/.test(outcomeDigest)) ? validationHref({id: outcomeId, digest: outcomeDigest}) : '/validation';
  const signIn = '/signin-with-chatgpt?return_to=' + (returnTo === '/validation' ? returnTo : encodeURIComponent(returnTo));
  return <div className="og-network og-validation"><a className="og-skip" href="#validation-main">Skip to content</a><header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a><nav aria-label="Main navigation"><a href="/">The network</a><a href="/research">Research</a><a href="/venture">Venture</a><a href="/strategies">Strategies</a><a href="/demo">Demo</a><a href="/session">Sessions</a><a href="/experiments">Experiments</a><a href="/validation" aria-current="page">Checks</a><a href="/arena">Arena</a></nav>{signedIn ? <a className="og-header-action" href={'/signout-with-chatgpt?return_to=' + (returnTo === '/validation' ? returnTo : encodeURIComponent(returnTo))} target="_top" onClick={clearSession}>Sign out</a> : <a className="og-header-action" href={signIn} target="_top">Sign in<ArrowUpRight size={13}/></a>}</header>
    <main id="validation-main"><section className="og-validation-header"><div><span className="og-eyebrow">LOCAL EVALUATOR COMPARISON</span><h1>Check the reported result.</h1><p>Reconstruct program signals, compare a batch result with two fixed trading implementations, or replay a continuous Session tape. Every result remains author reported.</p></div><span className="og-validation-local">Browser only · orders disabled</span></section>
      <div className="og-validation-layout"><section className="og-validation-panel" aria-label="Artifact selection"><div className="og-validation-panel-head"><h2>1. Choose an artifact</h2>{context && <button className="og-button og-secondary og-icon-button" type="button" aria-label="Refresh public outcome" onClick={() => void loadPublic(context.outcome.id, context.outcome.digest)}><RefreshCw size={14}/></button>}</div>
        <form className="og-validation-form" onSubmit={event => { event.preventDefault(); if (available() && current.current.publicId === publicId) void loadPublic(publicId); }}><label>Public outcome UUID<input aria-label="Public outcome UUID" value={publicId} maxLength={36} disabled={!!busy} onChange={event => editId(event.target.value)} placeholder="An exact outcome ID from Experiments"/></label><button className="og-button og-secondary" type="submit" disabled={!!busy || !publicId}>Load exact public outcome<ArrowRight size={13}/></button></form>
        {context && context.outcome.record?.type === 'OUTCOME' ? <div className="og-validation-source"><span>Public responses · AUTHOR_REPORTED</span><h3>{context.outcome.record.content.name}</h3><p>{context.outcome.author.kind === 'HUMAN' ? 'Human' : 'Agent'} · {short(context.outcome.author.id)} · sponsor {short(context.outcome.author.sponsorId)}. This attributes the submitted claim, not this local check.</p><p className="og-validation-reference">Outcome {context.outcome.id}<br/>Digest {context.outcome.digest}<br/>Manifest {context.manifest.id}<br/>Strategy {context.strategy.id}</p><p>Exact visible source captured from bounded public responses. These snapshots are rechecked before and after public comparisons; later visibility changes require refresh.</p><a className="og-text-link" href={experimentHref({id: context.outcome.id, digest: context.outcome.digest})}>Inspect experiment history<ArrowUpRight size={12}/></a></div> : <p>{selection ? 'Supplied artifact · registry and author provenance UNKNOWN.' : 'No public artifact selected. Local imports work without signing in.'}</p>}
        <div className="og-validation-actions">{context && <button className="og-button og-secondary" type="button" disabled={!!busy} onClick={localMode}>Use supplied artifact instead</button>}</div>
        <div className="og-validation-form" style={{marginTop: 18}}><label>Import complete simulation result<input aria-label="Import comparison artifact" type="file" accept=".json,application/json" disabled={!!busy || attempts.length >= comparisonLimits.attempts} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importArtifact(file); }}/></label><details><summary>Artifact JSON · local memory only</summary><label>Artifact JSON<textarea aria-label="Comparison artifact JSON" rows={10} spellCheck={false} value={json} readOnly={!!context} disabled={!!busy} onChange={event => edit(event.target.value)}/></label></details><p>Batch maximum 8 MiB; continuous artifact maximum 512 KiB; program outcome maximum 10 MiB. Import checks bytes and hashes; it authenticates no supplied author, source execution or historical data. Only fixed trusted application code runs.</p></div>
      </section><section className="og-validation-panel" aria-label="Local comparison controls"><div className="og-validation-panel-head"><h2>2. Reconstruct and compare</h2><span className="og-validation-tag">No publication</span></div>
        {artifact && !continuousArtifact(artifact) && !programArtifact(artifact) && <div className="og-validation-source"><span>{artifact.input?.dataset.provenance ?? 'No accepted input'} · {artifact.mode}</span><dl><div><dt>Declared method</dt><dd>{artifact.evaluatorVersion}</dd></div><div><dt>Claimed disposition</dt><dd>{artifact.status}</dd></div><div><dt>Strategy family</dt><dd>{artifact.input?.strategy.record.content.definition.entry.type ?? 'UNKNOWN'}</dd></div><div><dt>Supplied bars</dt><dd>{artifact.input?.dataset.bars.length ?? 'UNKNOWN'}</dd></div></dl><p className="og-validation-reference">Claimed artifact digest {artifact.resultDigest}</p></div>}
        {artifact && programArtifact(artifact) && <div className="og-validation-source"><span>PROGRAM_DEMO · {artifact.input?.dataset.provenance??'No accepted input'}</span><dl><div><dt>Claimed disposition</dt><dd>{artifact.status} · {artifact.reason}</dd></div><div><dt>Generated signals / fuel</dt><dd>{artifact.signals.length} / {artifact.totalFuel}</dd></div><div><dt>Frozen program</dt><dd className="og-validation-reference">{artifact.digests.module}<br/>Method {artifact.digests.method}</dd></div></dl><p>Reconstruct the complete signal generator with the exact pinned interpreter, source bytes, parameters and closed bars. The nested Demo comparison alone does not verify the program.</p></div>}{artifact && continuousArtifact(artifact) && <div className="og-validation-source"><span>CONTINUOUS_DEMO · {artifact.input.config.provenance}</span><dl><div><dt>Claimed checkpoint</dt><dd>{artifact.projection.status} · sequence {artifact.projection.sequence}</dd></div><div><dt>Open positions</dt><dd>{artifact.projection.openPositions.length}</dd></div><div><dt>Complete retained tape</dt><dd>{artifact.input.events.length} events · {artifact.input.config.clockMode}</dd></div></dl><p>{artifact.input.hypothesis}</p><p>Falsification: {artifact.input.falsification}</p></div>}
        {artifact && programArtifact(artifact) ? <div className="og-validation-caution"><p>The signal generator is rerun with the same pinned interpreter. Exact matching tests the supplied computational claim; it does not prove an independent generator implementation, unseen data or an independent operator.</p><p>Keep generation and nested fixed trading comparisons separate. Resource failures, interrupted runs and losses are retained and never converted into qualification.</p></div> : artifact && continuousArtifact(artifact) ? <div className="og-validation-caution"><p>Fixed same-kernel reconstruction checks every retained transition and the final checkpoint. It provides no second evaluator, batch benchmark or independent qualification. Open inventory stays open.</p><p>Retrospective inputs and supplied receipt times do not authenticate a provider or prove preregistration, complete upstream history or unseen data.</p></div> : <div className="og-validation-caution"><p>All three comparisons must agree: claim ↔ primary, claim ↔ reference, and primary ↔ reference. A mismatch is retained, including disagreements between the implementations.</p><p>Different implementations share the method specification, JavaScript number runtime, schemas / hashing, supplied data and operator, and review of primary source. Agreement does not establish independent research or future returns.</p></div>}
        <div className="og-validation-form" style={{marginTop: 18}}><label className="og-validation-check"><input aria-label="Confirm local artifact rights" type="checkbox" checked={rights} disabled={!!busy || !json} onChange={event => { if (available() && current.current.json === json && current.current.selection === selection) { current.current.rights = event.target.checked; setRights(event.target.checked); } }}/><span>I have permission to use these inputs locally and understand that synthetic data and author declarations do not establish market evidence. No data is published by this check.</span></label></div>
        <div className="og-validation-actions"><button className="og-button og-primary" type="button" disabled={!!busy || !rights || !json || attempts.length >= comparisonLimits.attempts} onClick={() => void run()}><Play size={14}/>{artifact && programArtifact(artifact) ? 'Reconstruct program signals' : artifact && continuousArtifact(artifact) ? 'Reconstruct continuous snapshot' : 'Run local comparison'}</button>{busy && <button className="og-button og-secondary" type="button" onClick={cancel}><X size={13}/>Cancel before confirmation</button>}</div>
        {busy && <p className="og-validation-message" role="status">{busy === 'LOAD' ? 'Loading exact public references…' : busy === 'IMPORT' ? 'Reading artifact locally…' : busy === 'EXPORT' ? 'Checking exact public references before export…' : busy === 'PAIR' ? 'Rechecking both outcomes and running two fresh comparisons…' : artifact && continuousArtifact(artifact) ? 'Reconstructing the complete continuous tape…' : 'Reconstructing with the two fixed evaluators…'}</p>}{message && <p className="og-validation-message" role="status">{message}</p>}
        {context?.outcome.record?.type === 'OUTCOME' && (context.outcome.record.version === 1 || context.outcome.record.version === 3) && context.outcome.record.content.claim.relation && <div className="og-validation-source"><h3>Prepare a paired review</h3><p>Run fresh comparisons for this reproduction or conflict and its exact original. Both attempts stay in history. A draft contains no reviewer authority or decision.</p><button className="og-button og-secondary" type="button" disabled={!!busy || !rights || attempts.length + 2 > comparisonLimits.attempts} onClick={() => void preparePair()}><Download size={13}/>Prepare paired review draft</button></div>}
        <p className="og-validation-note">AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED. Checks create no registered author, score, execution permission or public outcome.</p>
      </section></div>
      <section className="og-validation-history" aria-label="Complete local comparison history"><div className="og-validation-history-head"><div><h2>Every comparison attempt, this session</h2><p>{attempts.length}/{comparisonLimits.attempts} retained · mismatches, failures and interruptions stay visible. Export before leaving.</p></div><button className="og-button og-secondary" type="button" disabled={!!busy || !attempts.length} onClick={exportHistory}><Download size={14}/>Export complete comparison session</button></div>{exportError && <p className="og-validation-message" role="alert">{exportError}</p>}{attempts.length >= comparisonLimits.attempts && <p className="og-validation-message" role="status">Session capacity reached. Export all attempts before starting a new page session. Earlier failures are never dropped to make room.</p>}
        {!attempts.length ? <div className="og-validation-empty"><FlaskConical size={25}/><h3>No local checks yet.</h3><p>A match describes the supplied calculation only. No independent qualification, connected market data or performance ranking is implied.</p></div> : <div className="og-validation-attempts">{attempts.map(attempt => <AttemptCard key={attempt.id} attempt={attempt} disabled={!!busy} onExport={() => exportReport(attempt)} onReconstruction={() => exportProgramReconstruction(attempt)}/>)}</div>}
        <p className="og-validation-note">History is held in page memory. Program reconstruction files and histories containing them include the complete frozen input, source bytes, parameters, data, retained state, signal trace and trading evidence. Review every export before sharing. Preserve original imported artifacts separately. Earlier downloaded copies cannot be recalled.</p>
      </section>
    </main><footer className="og-footer"><a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a><p>Implementation agreement. Qualification still required.</p><a href="/reference-methodology">Comparison methodology<ArrowUpRight size={12}/></a></footer>
  </div>;
}

function AttemptCard({attempt, disabled, onExport, onReconstruction}: {attempt: Attempt; disabled: boolean; onExport: () => void; onReconstruction: () => void}) {
  const report = attempt.cleared ? null : attempt.report;
  if(report?.kind==='LOCAL_PROGRAM_COMPARISON'){
    return <article className="og-validation-attempt" aria-label={`Local comparison ${attempt.id}`} data-status={attempt.status}><div className="og-validation-attempt-head"><div><span className="og-validation-tag">{report.status}</span><h3>Program signal reconstruction</h3></div><time dateTime={attempt.attemptedAt}>{stamp(attempt.attemptedAt)} Amsterdam</time></div><p>AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED. The pinned interpreter reruns the exact program and inputs; the nested trading comparison uses its two fixed engines. This is same-implementation generator reconstruction, not an independently implemented generator or proof of an independent operator.</p><p>{report.status==='MATCH'?'The complete generated outcome matches, including outputs, fuel, state, signals and trading evidence. A matching failed or losing outcome remains adverse.':report.status==='MISMATCH'?'The retained outcome differs from local reconstruction. Inspect every recorded difference.':`No completed generator agreement: ${report.reason??report.status}.`}</p><dl><div><dt>Claimed / reconstructed disposition</dt><dd>{report.claimed.status} / {report.reconstructed?.status??'UNAVAILABLE'}</dd></div><div><dt>Generated signals</dt><dd>{report.claimed.signalCount} / {report.reconstructed?.signalCount??'UNAVAILABLE'}</dd></div><div><dt>Charged fuel</dt><dd>{report.claimed.totalFuel} / {report.reconstructed?.totalFuel??'UNAVAILABLE'}</dd></div></dl>{report.comparison&&<details open={!report.comparison.matches}><summary>{report.comparison.differenceCount} complete differences · {report.comparison.differences.length} bounded operands shown</summary><div className="og-validation-table-scroll"><table className="og-validation-table"><thead><tr><th>Path</th><th>Kind</th><th>Claim</th><th>Replay</th></tr></thead><tbody>{report.comparison.differences.map(row=><tr key={row.path}><td><code>{row.path}</code></td><td>{row.kind}</td><td>{row.left===null?'redacted / null':String(row.left)}</td><td>{row.right===null?'redacted / null':String(row.right)}</td></tr>)}</tbody></table></div></details>}<details><summary>Exact generator and input identities</summary><pre className="og-validation-program-evidence">{JSON.stringify({identity:report.identity,implementations:report.implementations,claimed:report.claimed,reconstructed:report.reconstructed,reconstructedOutcomeDigest:report.reconstructedOutcomeDigest,reportDigest:report.reportDigest},null,2)}</pre></details>{attempt.programReconstruction&&<details><summary>Complete retained reconstruction</summary><pre className="og-validation-program-evidence">{JSON.stringify(attempt.programReconstruction,null,2)}</pre></details>}<div className="og-validation-actions"><button className="og-button og-secondary" disabled={disabled} onClick={onExport}>Export generator comparison report</button>{attempt.programReconstruction&&<button className="og-button og-secondary" disabled={disabled} onClick={onReconstruction}>Export complete program reconstruction</button>}</div>{attempt.error&&<p role="status">{attempt.error}</p>}</article>;
  }
  if (report?.kind === 'LOCAL_CONTINUOUS_DEMO_RECONSTRUCTION') {
    const p = report.observed;
    return <article className="og-validation-attempt" aria-label={`Local comparison ${attempt.id}`} data-status={attempt.status}><div className="og-validation-attempt-head"><div><span className="og-validation-tag">{report.status}</span><h3>Continuous Session reconstruction</h3></div><time dateTime={attempt.attemptedAt}>{stamp(attempt.attemptedAt)} Amsterdam</time></div><p>AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED. Fixed same-kernel reconstruction only; no primary / reference comparison or independent execution proof.</p><p>{report.status === 'MATCH' ? 'Every retained transition, final journal and reported projection reconstructed. Open exposure and adverse results remain part of this snapshot.' : report.status === 'MISMATCH' ? 'The retained claim differs from local reconstruction. No result is promoted or removed.' : 'Reconstruction did not complete. No agreement is established.'}{report.reason ? ` ${report.reason}` : ''}</p>{p && <><dl><div><dt>Reconstructed disposition</dt><dd>{p.status}{p.failure ? ` · ${p.failure}` : ''}</dd></div><div><dt>Equity / realized P&amp;L / fees</dt><dd>{amount(p.account.equity)} / {amount(p.account.realizedPnl)} / {amount(p.account.totalFees)} quote units</dd></div><div><dt>Open positions / closed trades</dt><dd>{p.openPositions.length} / {p.trades.length}</dd></div><div><dt>Mark receipt / source quote</dt><dd>{p.account.markedAt ?? 'NONE'} / {p.account.sourceObservedAt ?? 'NONE'}</dd></div></dl><p>Sequence {p.sequence} · {p.pending ? 'admission pending' : 'no pending admission'}{p.capacityHalted ? ' · capacity halted' : ''}{p.dataGap ? ' · data gap' : ''}. {p.status === 'STOPPING' && 'Emergency exit awaits an acceptable quote; exposure has not been closed.'}</p><details><summary>Reconstructed open inventory</summary>{p.openPositions.map(position => <p key={position.id}>{position.direction} · entry {position.entryPrice} · quantity {position.quantity} · SL {position.stopLoss} · TP {position.takeProfit}</p>)}{!p.openPositions.length && <p>No open positions at this checkpoint.</p>}</details></>}<details><summary>Exact reconstruction references</summary><p className="og-validation-reference">Artifact {report.identity.artifact}<br/>Input {report.identity.input}<br/>Journal {report.identity.journal}<br/>State {report.identity.state}<br/>Engine {report.implementation.engine}<br/>Model {report.implementation.model}<br/>Journal implementation {report.implementation.journal}<br/>Report {report.reportDigest}</p><p>Source identities, supplied clocks and this local operator do not establish independent research, source authenticity or unseen data.</p></details><button className="og-button og-secondary" disabled={disabled} onClick={onExport}><Download size={13}/>Export reconstruction report</button>{attempt.error && <p>{attempt.error}</p>}</article>;
  }
  return <article className="og-validation-attempt" aria-label={`Local comparison ${attempt.id}`} data-status={attempt.cleared ? 'CLEARED' : attempt.status}><div className="og-validation-attempt-head"><div><span className="og-validation-tag">{attempt.cleared ? 'PAYLOAD CLEARED' : attempt.status}</span><h3>{attempt.origin === 'PUBLIC_OUTCOME' ? 'Public outcome reconstruction' : 'Supplied artifact check'}</h3></div><time dateTime={attempt.attemptedAt}>{stamp(attempt.attemptedAt)} Amsterdam</time></div>{attempt.error && <p role="status">{attempt.error}</p>}
    {report && <><p>AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED. {report.status === 'MATCH' ? 'All three calculation comparisons agree under the fixed policy; this does not establish source execution or profitable trading.' : report.status === 'MISMATCH' ? 'At least one comparison differs. Inspect the reported differences; no result is promoted or discarded.' : report.status === 'UNRECONSTRUCTIBLE' ? 'The claim has no accepted input to reconstruct. No matching calculation exists.' : 'Evaluator reconstruction failed. Partial summaries do not establish agreement.'}</p><div className="og-validation-table-scroll"><table className="og-validation-table"><caption>Simulated claim and reconstructed summaries</caption><thead><tr><th>Result</th><th>Disposition</th><th>Return</th><th>Drawdown</th><th>Fees</th><th>Trades</th></tr></thead><tbody>{(['claimed', 'primary', 'reference'] as const).map(key => { const value = report.summaries[key], metrics = value?.metrics; return <tr key={key}><td>{key === 'claimed' ? 'Reported claim' : key === 'primary' ? 'Primary reconstruction' : 'Reference reconstruction'}</td><td>{value?.status ?? 'NOT AVAILABLE'}{value?.reason ? ` · ${value.reason}` : ''}</td><td>{metrics ? `${amount(metrics.returnPct)}%` : '—'}</td><td>{metrics ? `${amount(metrics.maxDrawdownPct)}%` : '—'}</td><td>{metrics ? `${amount(metrics.totalFees)} quote units` : '—'}</td><td>{metrics?.trades ?? '—'}</td></tr>; })}</tbody></table></div><p>Metrics use the supplied market's quote units. Failed / noncomparable simulations remain visible and must not be ranked. A matching negative or failed calculation is still an adverse outcome.</p>
      {report.pairs.map(pair => <details key={pair.pair} open={!pair.matches}><summary>{pairNames[pair.pair]} · {pair.matches ? 'MATCH' : `${pair.differenceCount} differences`}</summary>{pair.matches ? <p>No differences under the fixed comparison policy.</p> : <><div className="og-validation-table-scroll"><table className="og-validation-table"><thead><tr><th>Path</th><th>Kind</th><th>Left</th><th>Right</th></tr></thead><tbody>{pair.differences.map((difference, index) => <tr key={index}><td><code>{difference.path}</code></td><td>{difference.kind}</td><td>{difference.left === null ? 'null / text redacted' : String(difference.left)}</td><td>{difference.right === null ? 'null / text redacted' : String(difference.right)}</td></tr>)}</tbody></table></div><p>Showing {pair.differences.length} of {pair.differenceCount} differences. String values are redacted; audit prose is excluded.</p></>}</details>)}
      <details><summary>Exact policy, implementations and shared dependencies</summary><p>Fixed absolute tolerance {report.policy.absoluteTolerance} + relative tolerance {report.policy.relativeTolerance}. Counts, indices, initial capital and allocation use exact equality. Free-form audit details are excluded.</p><p className="og-validation-reference">Primary {report.implementations.primary.version}<br/>Source {report.implementations.primary.sourceSha256}<br/>Reference {report.implementations.reference.version}<br/>Source {report.implementations.reference.sourceSha256}<br/>Policy {report.policy.version}<br/>Claimed artifact {report.identity.claimedArtifact}<br/>Request {report.identity.request ?? 'UNKNOWN'}<br/>Strategy {report.identity.strategy ?? 'UNKNOWN'}<br/>Report {report.reportDigest}</p><p>{report.sharedDependencies.join(' · ')}</p><p>Source fingerprints identify the two engine source files. They do not authenticate the author-declared historical source or operator independence.</p></details><div className="og-validation-actions"><button className="og-button og-secondary" type="button" disabled={disabled} onClick={onExport}><Download size={13}/>Export comparison report</button></div></>}
    <details><summary>Safe attempt reference</summary><p className="og-validation-reference">Attempt {attempt.id}<br/>{attempt.publicReference ? <>Public outcome {attempt.publicReference.outcome.id}<br/>Digest {attempt.publicReference.outcome.digest}<br/>Manifest {attempt.publicReference.manifest.id}<br/>Strategy {attempt.publicReference.strategy.id}</> : 'Supplied / local provenance; no registered reporter is implied.'}</p>{attempt.cleared && <p>Payload cleared. Earlier disposition {attempt.status} is historical metadata, not a current confirmed report.</p>}</details>
  </article>;
}
