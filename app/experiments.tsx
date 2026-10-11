'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Download, FlaskConical, Play, Plus, RefreshCw, X} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {parseUniqueJson} from './unique-json';
import {boundedDemoRequest, demoEvaluatorMethod, verifyDemoArtifact, type DemoRequest} from './demo-model';
import {boundedStrategyRecord, strategyGetSchema} from './strategy-model';
import {boundedExperimentCommand, experimentDigest, experimentGetSchema, experimentInputStrategy, experimentIsBatchManifest, experimentContinuousRegisterDefaults, experimentLimits, experimentListSchema, experimentManifestFlags, experimentMeSchema, experimentOutcomeFlags, experimentRegisterDefaults, experimentWriteSchema, validateExperimentItem, type ExperimentCommand, type ExperimentFlag, type ExperimentManifest, type ExperimentContinuousManifest, type ExperimentPublicItem, type ExperimentSummary} from './experiment-model';
import {boundedSessionEvidenceInput, sessionEvidenceLimits, verifySessionEvidenceInput, verifySessionEvidenceArtifact, verifySessionEvidenceBundle, type SessionEvidenceInput, type SessionEvidenceBundle} from './session-evidence-model';
import {reconstructSessionEvidence} from './session-evidence';
import {assertExperimentRunSources, createExperimentRun, evaluateExperimentRun, experimentRunDisclosure, experimentRunLimits, interruptExperimentRun, prepareExperimentRunOutcome, verifyExperimentRun, type ExperimentRun} from './experiment-runner';
import {assertChronologicalPlanSources, chronologicalPlanLimits, correlateChronologicalManifest, createChronologicalPlan, prepareChronologicalManifest, verifyChronologicalPlan, type ChronologicalPlan} from './experiment-plan';
import {experimentHref, type ExperimentSelection} from './experiment-link';
import ExperimentReviews from './experiment-reviews';
import './network.css';
import './experiments.css';

type Item = ExperimentPublicItem;
type Summary = ExperimentSummary;
type Me = ReturnType<typeof experimentMeSchema.parse>;
type Receipt = ReturnType<typeof experimentWriteSchema.parse>;
type Partition = 'TRAIN' | 'TEST';
type Form = {action: 'register' | 'outcome' | 'withdraw' | 'report'; target: Item | null; parent: Item | null; relation: Item | null; claim: 'ORIGINAL' | 'REPRODUCTION' | 'CONFLICTING'; localAttemptId?: string; split?: {planId: string; partition: Partition}; runIds?: {requestId: string; id: string}};
type LocalAttempt = {id: string; at: string; manifest: {id: string; digest: string}; source: {id: string; digest: string}; outcomeRequestId: string; outcomeId: string; split?: {planId: string; partition: Partition}; status: 'CHECKING' | 'RUNNING' | 'EVALUATED' | 'INTERRUPTED' | 'UNAVAILABLE' | 'UNCONFIRMED' | 'FAILED'; run: ExperimentRun | null; confirmed: boolean; cleared: boolean; error: string | null};
type Fields = {step: number; name: string; json: string; input: DemoRequest | SessionEvidenceInput | null; bundle: SessionEvidenceBundle | null; sourceVersion: string; sourceDigest: string; methodDigest: string; trialCount: string; selection: 'FIRST_DECLARED' | 'BEST_OBSERVED' | 'OTHER'; logCompleteness: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'; log: string; overlap: 'NONE' | 'PRESENT' | 'UNKNOWN'; holdout: boolean; access: 'UNSEEN' | 'SEEN' | 'UNKNOWN'; reuse: string; validationNote: string; transformations: string; seeds: string; dependencies: string; conflicts: string; dataRights: boolean; publicData: boolean; publicArtifact: boolean; consent: boolean; resultKind: 'ARTIFACT' | 'INTERRUPTED' | 'ARTIFACT_UNAVAILABLE'; reason: string; details: string};
type Pending = {command: ExperimentCommand; body: string; author: Me; target: Item | null; parent: Item | null; submitted: boolean; suppressionKnown: boolean; split?: {planId: string; partition: Partition}; localAttemptId?: string};
type PlanEntry = {id: string; at: string; parent: {id: string; digest: string}; source: {id: string; digest: string}; requested: {trainingBars: number | null; excludedGapBars: number | null}; childIds: {[key in Partition]: {id: string; requestId: string}}; status: 'CHECKING' | 'FROZEN' | 'FAILED' | 'INTERRUPTED'; plan: ChronologicalPlan | null; children: {[key in Partition]: Item | null}; cleared: boolean; error: string | null};
const policy = 'public-experiment-v1' as const;
const signIn = '/signin-with-chatgpt?return_to=/experiments';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const short = (id: string) => id.startsWith('human_') ? id.slice(6, 14) : id.slice(0, 8);
const stamp = (at: string) => new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(at));
const lines = (raw: string) => raw.split('\n').map(line => line.trim()).filter(Boolean);
const blank = (): Fields => ({step: 1, name: '', json: '', input: null, bundle: null, sourceVersion: '', sourceDigest: '', methodDigest: '', trialCount: '', selection: 'OTHER', logCompleteness: 'UNAVAILABLE', log: '', overlap: 'UNKNOWN', holdout: false, access: 'UNKNOWN', reuse: '0', validationNote: '', transformations: '', seeds: '', dependencies: '', conflicts: '', dataRights: false, publicData: false, publicArtifact: false, consent: false, resultKind: 'ARTIFACT', reason: 'OTHER', details: ''});
const flags: {[key in ExperimentFlag]: string} = {SOURCE_EXECUTION_UNVERIFIED: 'Source execution unverified', TIMING_UNVERIFIED: 'Execution timing unverified', MULTIPLE_TRIALS: 'Multiple trials declared', POST_SELECTED: 'Selection after search / unspecified', INCOMPLETE_SEARCH_LOG: 'Search log incomplete', TRAIN_EVAL_OVERLAP: 'Training / evaluation overlap', OVERLAP_UNKNOWN: 'Overlap unknown', NO_HOLDOUT: 'No holdout declared', HOLDOUT_SEEN: 'Holdout previously seen', HOLDOUT_ACCESS_UNKNOWN: 'Prior holdout access unknown', HOLDOUT_REUSED: 'Holdout reused', SHARED_DEPENDENCIES: 'Shared dependencies declared', SAME_AUTHOR: 'Same author as manifest', SAME_SPONSOR: 'Same sponsor as manifest'};

async function readResponse(response: Response, cap = 1_048_576) {
  const reader = response.body?.getReader(); if (!reader) throw Error('Missing response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > cap) { await reader.cancel(); throw Error('Response exceeds its byte budget.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), cap, 16);
}
function download(value: unknown, name: string, cap?: number) {
  const payload = cap ? JSON.stringify(value) : JSON.stringify(value, null, 2) + '\n';
  if (cap && new TextEncoder().encode(payload).byteLength > cap) throw Error('Local export exceeds its byte budget.');
  const blob = new Blob([payload], {type: 'application/json'}), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
class RunSourceUnavailable extends Error { constructor(public manifestId: string, public sourceId: string | null = null) { super('Current public inputs unavailable.'); } }
async function currentRunSources(parent: Item, signal: AbortSignal) {
  const options = {cache: 'no-store' as const, signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)])};
  const response = await fetch('/api/experiments?id=' + encodeURIComponent(parent.id), options);
  if (!response.ok) { if (response.status === 404) throw new RunSourceUnavailable(parent.id); throw Error('Current manifest unavailable.'); }
  const manifest = await validateExperimentItem(experimentGetSchema.parse(await readResponse(response)).item);
  if (signal.aborted) throw Error('Cancelled.');
  if (manifest.id !== parent.id || manifest.digest !== parent.digest || manifest.type !== 'MANIFEST' || manifest.state !== 'VISIBLE' || manifest.suppression || !manifest.record || manifest.record.type !== 'MANIFEST' || !same(manifest.record, parent.record) || !same(manifest.strategy, parent.strategy)) throw new RunSourceUnavailable(parent.id, manifest.suppression === 'SOURCE_UNAVAILABLE' ? parent.strategy.id : null);
  const sourceResponse = await fetch('/api/strategies?id=' + encodeURIComponent(parent.strategy.id), options);
  if (!sourceResponse.ok) { if (sourceResponse.status === 404) throw new RunSourceUnavailable(parent.id, parent.strategy.id); throw Error('Current source unavailable.'); }
  const source = strategyGetSchema.parse(await readResponse(sourceResponse)).item;
  if (signal.aborted) throw Error('Cancelled.');
  if (!source.record || source.state !== 'VISIBLE' || source.id !== parent.strategy.id || source.digest !== parent.strategy.digest || await experimentDigest(boundedStrategyRecord(source.record).payload) !== source.digest || !same(source.record, experimentInputStrategy(manifest.record.content.input).record)) throw new RunSourceUnavailable(parent.id, parent.strategy.id);
  if (signal.aborted) throw Error('Cancelled.');
  return {manifest, source};
}
function integer(raw: string) { if (!/^\d+$/.test(raw.trim())) throw Error('Complete the integer fields.'); return Number(raw); }
function requestedNumber(raw: string) { if (!/^-?\d{1,6}(\.\d{1,6})?$/.test(raw.trim())) return null; const value = Number(raw); return Number.isFinite(value) && Math.abs(value) <= 1_000_000 ? value : null; }
function summarize(item: Item): Summary {
  const {record, moderation: _moderation, ...metadata} = item;
  return {...metadata, ...(record?.version === 2 ? {method: 'CONTINUOUS_DEMO' as const} : {}), name: record?.content.name ?? null, flags: record?.flags ?? [], status: record?.type === 'OUTCOME' ? record.content.result.kind === 'ARTIFACT' ? record.version === 2 ? record.content.result.artifact.projection.status : record.content.result.artifact.status : record.content.result.kind : null};
}
function registration(fields: Fields, requestId: string, id: string) {
  const continuous = fields.input && 'kind' in fields.input;
  return {action: 'register', requestId, id, name: fields.name, input: fields.input, ...(continuous ? {method: 'CONTINUOUS_DEMO', evaluator: {...experimentContinuousRegisterDefaults(fields.input as SessionEvidenceInput, fields.sourceVersion).evaluator}} : {evaluator: {version: 'opengrail-demo-v1', sourceVersion: fields.sourceVersion, sourceDigest: fields.sourceDigest, methodDigest: fields.methodDigest}, baseline: 'COST_AWARE_LONG_SAME_ALLOCATION_V1'}), disclosures: {search: {trialCount: integer(fields.trialCount), selection: fields.selection, logCompleteness: fields.logCompleteness, log: fields.log}, validation: {trainEvaluationOverlap: fields.overlap, holdoutDeclared: fields.holdout, holdoutPriorAccess: fields.access, holdoutReuseCount: integer(fields.reuse), note: fields.validationNote}, transformations: lines(fields.transformations), seeds: lines(fields.seeds).map(integer), conflicts: {sharedDependencies: lines(fields.dependencies), other: fields.conflicts}, publication: {dataRights: true, publicData: true, publicArtifact: true}}, policyAccepted: policy};
}
function registrationFields(command: Extract<ExperimentCommand, {action: 'register'}>): Fields {
  const d = command.disclosures;
  return {...blank(), name: command.name, json: JSON.stringify(command.input), input: command.input, sourceVersion: command.evaluator.sourceVersion, sourceDigest: 'sourceDigest' in command.evaluator ? command.evaluator.sourceDigest : '', methodDigest: command.evaluator.methodDigest, trialCount: String(d.search.trialCount), selection: d.search.selection, logCompleteness: d.search.logCompleteness, log: d.search.log, overlap: d.validation.trainEvaluationOverlap, holdout: d.validation.holdoutDeclared, access: d.validation.holdoutPriorAccess, reuse: String(d.validation.holdoutReuseCount), validationNote: d.validation.note, transformations: d.transformations.join('\n'), seeds: d.seeds.join('\n'), dependencies: d.conflicts.sharedDependencies.join('\n'), conflicts: d.conflicts.other};
}
async function currentEvidenceSource(input: SessionEvidenceInput, signal: AbortSignal) {
  signal.throwIfAborted();
  const expected = input.config.strategy, response = await fetch('/api/strategies?id=' + encodeURIComponent(expected.record.id), {cache: 'no-store', signal});
  if (response.status === 404) throw new RunSourceUnavailable(expected.record.id, expected.record.id);
  if (!response.ok) throw Error('Source confirmation unavailable.');
  const source = strategyGetSchema.parse(await readResponse(response)).item;
  if (source.id !== expected.record.id || source.digest !== expected.digest) throw Error('Wrong immutable source.');
  if (!source.record || source.state !== 'VISIBLE') throw new RunSourceUnavailable(expected.record.id, expected.record.id);
  if (await experimentDigest(boundedStrategyRecord(source.record).payload) !== expected.digest || !same(source.record, expected.record)) throw Error('Wrong source bytes.');
  signal.throwIfAborted(); return source;
}
function matches(pending: Pending, receipt: Receipt) {
  const c = pending.command, item = receipt.item;
  if (receipt.action !== c.action || receipt.requestId !== c.requestId) return false;
  if (c.action === 'report') return receipt.item === null && receipt.report?.requestId === c.requestId && receipt.report.id === c.id && receipt.report.digest === c.digest && receipt.report.reason === c.reason;
  if (!item || item.id !== c.id) return false;
  if (c.action === 'withdraw') {
    const target = pending.target, event = item.moderation.at(-1);
    return !!target && item.digest === c.digest && item.state === 'WITHDRAWN' && item.record === null && item.type === target.type && item.requestId === target.requestId && item.createdAt === target.createdAt && same(item.author, target.author) && same(item.strategy, target.strategy) && same(item.manifest, target.manifest) && same(item.moderation.slice(0, target.moderation.length), target.moderation) && !!event && event.requestId === c.requestId && event.state === 'WITHDRAWN' && event.reason === c.reason && event.actor.kind === 'HUMAN' && event.actor.id === pending.author.authorId && event.actor.sponsorId === pending.author.sponsorId;
  }
  if (c.action !== 'register' && c.action !== 'outcome') return false;
  if (item.requestId !== c.requestId || item.type !== (c.action === 'register' ? 'MANIFEST' : 'OUTCOME') || item.author.kind !== 'HUMAN' || item.author.id !== pending.author.authorId || item.author.sponsorId !== pending.author.sponsorId) return false;
  const source = c.action === 'register' ? {id: experimentInputStrategy(c.input).record.id, digest: experimentInputStrategy(c.input).digest} : pending.parent?.strategy;
  if (!same(item.strategy, source) || !same(item.manifest, c.action === 'register' ? null : c.manifest)) return false;
  // A retry can return a tombstone. Identity is acknowledged without restoring submitted content.
  if (!item.record) return item.state === 'HIDDEN' || item.state === 'WITHDRAWN';
  const content = c.action === 'register' ? { ...('method' in c ? {method: c.method} : {}), name: c.name, input: c.input, evaluator: c.evaluator, ...('baseline' in c ? {baseline: c.baseline} : {}), disclosures: c.disclosures} : {...('method' in c ? {method: c.method} : {}), name: c.name, manifest: c.manifest, result: c.result, claim: c.claim};
  const expectedFlags = c.action === 'register' ? experimentManifestFlags(c.disclosures) : pending.parent ? experimentOutcomeFlags(item.author, pending.parent.author, c.claim) : null;
  return item.record.version === ('method' in c ? 2 : 1) && same(item.record.content, content) && same(item.record.flags, expectedFlags);
}

export default function Experiments({signedIn, selection = null, selectionError = ''}: {signedIn: boolean; selection?: ExperimentSelection | null; selectionError?: string}) {
  const [reviewBusy, setReviewBusy] = useState(false);
  const reviewLock = useRef(false);
  const [items, setItems] = useState<Summary[]>([]), [cursor, setCursor] = useState<string | null>(null), [pageCursor, setPageCursor] = useState<string | null>(null), [loading, setLoading] = useState(false), [boardError, setBoardError] = useState('');
  const [selected, setSelected] = useState<Item | null>(null), [detailBusy, setDetailBusy] = useState(false), [detailError, setDetailError] = useState('');
  const [outcomes, setOutcomes] = useState<Summary[]>([]), [outcomeCursor, setOutcomeCursor] = useState<string | null>(null), [outcomePage, setOutcomePage] = useState<string | null>(null), [outcomeBusy, setOutcomeBusy] = useState(false), [outcomeError, setOutcomeError] = useState(''), [outcome, setOutcome] = useState<Item | null>(null);
  const returnSelection = outcome ?? selected ?? selection;
  const signIn = returnSelection ? '/signin-with-chatgpt?return_to=' + encodeURIComponent(experimentHref({id: returnSelection.id, digest: returnSelection.digest, ...(selection?.id === returnSelection.id && selection.digest === returnSelection.digest && selection.review ? {review: selection.review, reviewDigest: selection.reviewDigest} : {})})) : '/signin-with-chatgpt?return_to=/experiments';
  const [me, setMe] = useState<Me | null>(null), [authLost, setAuthLost] = useState(false), [identityError, setIdentityError] = useState('');
  const [form, setForm] = useState<Form | null>(null), [fields, setFields] = useState(blank), [busy, setBusy] = useState(false), [workBusy, setWorkBusy] = useState(false), [uncertain, setUncertain] = useState(false), [formError, setFormError] = useState(''), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [localRuns, setLocalRuns] = useState<LocalAttempt[]>([]), [localRights, setLocalRights] = useState(false), [localBusy, setLocalBusy] = useState(false), [localMessage, setLocalMessage] = useState(''), [localExportError, setLocalExportError] = useState('');
  const [plans, setPlans] = useState<PlanEntry[]>([]), [trainingBars, setTrainingBars] = useState(''), [gapBars, setGapBars] = useState('0'), [splitConsent, setSplitConsent] = useState(false);
  const local = useRef({workId: 0, working: false, controller: null as AbortController | null, active: null as string | null, planActive: null as string | null});
  const s = useRef({alive: true, signedIn, denied: false, epoch: 0, formId: 0, identityId: 0, boardId: 0, detailId: 0, outcomeId: 0, workId: 0, locked: false, working: false, pending: null as Pending | null, reads: new Set<AbortController>()});
  s.current.signedIn = signedIn;
  const view = useRef({items, selected, outcomes, outcome, me, form, fields, receipt, localRuns, localRights, plans, trainingBars, gapBars, splitConsent}); view.current = {items, selected, outcomes, outcome, me, form, fields, receipt, localRuns, localRights, plans, trainingBars, gapBars, splitConsent};
  const renderEpoch = s.current.epoch, renderFormId = s.current.formId, renderPending = s.current.pending;
  const authenticated = signedIn && !authLost && !!me, blocked = busy || workBusy || uncertain || reviewBusy;
  function allowed() { return s.current.alive && s.current.signedIn && !s.current.denied && !!view.current.me; }
  function valid(epoch: number, formId = s.current.formId) { return allowed() && s.current.epoch === epoch && s.current.formId === formId; }
  function updateLocalRuns(next: LocalAttempt[]) { view.current.localRuns = next; setLocalRuns(next); }
  function replaceLocalRun(id: string, changes: Partial<LocalAttempt>) { updateLocalRuns(view.current.localRuns.map(value => value.id === id ? {...value, ...changes} : value)); }
  function updatePlans(next: PlanEntry[]) { view.current.plans = next; setPlans(next); }
  function replacePlan(id: string, changes: Partial<PlanEntry>) { updatePlans(view.current.plans.map(value => value.id === id ? {...value, ...changes} : value)); }
  function knownPlanChild(id: string | undefined) { return id ? view.current.plans.find(value => Object.values(value.childIds).some(child => child.id === id)) : undefined; }
  function knownChildUnavailable(id: string | undefined) { const entry = knownPlanChild(id); return !!entry && (entry.cleared || !entry.plan || !Object.values(entry.children).some(child => child?.id === id)); }
  function stopLocalWork(reason: string, interruption: 'USER_CANCELLED' | 'RECOVERY_INTERRUPTED' = 'RECOVERY_INTERRUPTED') {
    const state = local.current, id = state.active, held = view.current.localRuns.find(value => value.id === id), run = held?.run;
    state.workId++; state.controller?.abort(); state.controller = null;
    if (id) replaceLocalRun(id, {status: run && run.status !== 'RUNNING' ? 'UNCONFIRMED' : 'INTERRUPTED', confirmed: false, error: reason});
    if (state.planActive && view.current.plans.find(value => value.id === state.planActive)?.status === 'CHECKING') replacePlan(state.planActive, {status: 'INTERRUPTED', error: 'Plan confirmation interrupted. This retained slot is not a frozen plan.'});
    state.active = null; state.planActive = null; state.working = false; view.current.localRights = false; setLocalRights(false); setLocalBusy(false);
    if (run?.status === 'RUNNING') void interruptExperimentRun(run, new Date().toISOString(), interruption).then(terminal => {
      const current = view.current.localRuns.find(value => value.id === id);
      if (s.current.alive && current && !current.cleared && current.status === 'INTERRUPTED' && current.run?.runDigest === run.runDigest) replaceLocalRun(current.id, {run: terminal});
    }).catch(() => { /* Interrupted metadata remains; no terminal completion was fabricated. */ });
  }
  function redactLocalRuns(scope?: {manifestId: string; sourceId?: string | null}, preserveAcknowledgement = false) {
    const continuousInput = view.current.fields.bundle?.input ?? (view.current.fields.input && 'kind' in view.current.fields.input ? view.current.fields.input : null), continuousRecords = [view.current.form?.parent, view.current.form?.target, view.current.form?.relation].filter((item): item is Item => !!item && item.record?.version === 2);
    if (preserveAcknowledgement || (continuousInput || continuousRecords.length) && (!scope || continuousInput?.config.strategy.record.id === scope.sourceId || continuousRecords.some(item => item.id === scope.manifestId || item.manifest?.id === scope.manifestId || item.strategy.id === scope.sourceId))) {
      const state = s.current, reconcile = !!scope && state.pending?.submitted && 'method' in state.pending.command;
      state.workId++; state.working = false;
      if (preserveAcknowledgement) {
        if (view.current.form) { view.current.form = {...view.current.form, parent: view.current.form.parent ? {...view.current.form.parent, record: null} : null, target: view.current.form.target ? {...view.current.form.target, record: null} : null, relation: view.current.form.relation ? {...view.current.form.relation, record: null} : null}; setForm(view.current.form); }
      } else if (reconcile) {
        // The sole pending body is retained only for exact acknowledgement reconciliation.
        // Visible drafts / artifacts are cleared; later suppression cannot prove a prior POST failed.
        state.pending!.suppressionKnown = true;
        if (state.pending!.parent) state.pending!.parent = {...state.pending!.parent!, record: null};
        if (state.pending!.target) state.pending!.target = {...state.pending!.target!, record: null};
        if (view.current.form) { view.current.form = {...view.current.form, parent: view.current.form.parent ? {...view.current.form.parent, record: null} : null, target: view.current.form.target ? {...view.current.form.target, record: null} : null, relation: view.current.form.relation ? {...view.current.form.relation, record: null} : null}; setForm(view.current.form); }
        setUncertain(true); setFormError('Public content became unavailable after submission. The operation remains unresolved; retry its identical request to reconcile acknowledgement. No held artifact may be exported.');
      } else { erasePending(); state.formId++; state.locked = false; view.current.form = null; setForm(null); setBusy(false); setUncertain(false); }
      view.current.fields = blank(); view.current.receipt = null; setFields(blank()); setReceipt(null); setWorkBusy(false);
    }
    const affected = new Set(view.current.plans.filter(value => !scope || value.parent.id === scope.manifestId || Object.values(value.childIds).some(child => child.id === scope.manifestId) || !!scope.sourceId && value.source.id === scope.sourceId).map(value => value.id));
    const matchesScope = (value: LocalAttempt) => !scope || value.manifest.id === scope.manifestId || !!scope.sourceId && value.source.id === scope.sourceId || !!value.split && affected.has(value.split.planId);
    if (local.current.active && view.current.localRuns.some(value => value.id === local.current.active && matchesScope(value))) stopLocalWork('Current public input unavailable; local confirmation interrupted.');
    updateLocalRuns(view.current.localRuns.map(value => matchesScope(value) ? {...value, run: null, confirmed: false, cleared: true, error: 'Held result payload cleared. Current content is unavailable or the account was signed out; earlier exports cannot be recalled.'} : value));
    if (affected.size) {
      stopLocalWork('Chronological lineage became unavailable.');
      const selectedId = view.current.selected?.id, clearSelection = selectedId && view.current.plans.some(value => affected.has(value.id) && (value.parent.id === selectedId || Object.values(value.childIds).some(child => child.id === selectedId)));
      const clearedIds = new Set(view.current.plans.filter(value => affected.has(value.id)).flatMap(value => [value.parent.id, ...Object.values(value.childIds).map(child => child.id)]));
      view.current.items = view.current.items.filter(value => !clearedIds.has(value.id)); setItems(view.current.items);
      updatePlans(view.current.plans.map(value => affected.has(value.id) ? {...value, plan: null, children: {TRAIN: null, TEST: null}, cleared: true, error: 'Held plan and child payloads cleared. Earlier public records or exports cannot be recalled.'} : value));
      const prepared = view.current.form?.localAttemptId && view.current.localRuns.find(value => value.id === view.current.form!.localAttemptId);
      if (view.current.form?.split && affected.has(view.current.form.split.planId) || prepared && prepared.split && affected.has(prepared.split.planId)) { const state = s.current; erasePending(); state.formId++; state.workId++; state.working = false; state.locked = false; view.current.form = null; view.current.fields = blank(); view.current.receipt = null; setForm(null); setFields(blank()); setReceipt(null); setBusy(false); setWorkBusy(false); setUncertain(false); setFormError(''); }
      if (clearSelection) clearDetails();
    }
    const draft = view.current.form, prepared = draft?.localAttemptId && view.current.localRuns.find(value => value.id === draft.localAttemptId);
    if (prepared && matchesScope(prepared) && !s.current.pending && !s.current.locked) { s.current.formId++; s.current.workId++; s.current.working = false; view.current.form = null; view.current.fields = blank(); setForm(null); setFields(blank()); setWorkBusy(false); setFormError(''); }
  }
  function erasePending() { if (s.current.pending) { s.current.pending.body = ''; if (s.current.pending.command.action === 'report') s.current.pending.command.details = ''; } s.current.pending = null; }
  function clearPrivate() {
    stopLocalWork('Signed-in navigation interrupted local confirmation.'); redactLocalRuns();
    const state = s.current; erasePending(); state.epoch++; state.formId++; state.identityId++; state.workId++; state.denied = true; state.locked = false; state.working = false;
    view.current.me = null; view.current.form = null; view.current.fields = blank(); view.current.receipt = null;
    setMe(null); setAuthLost(true); setForm(null); setFields(blank()); setReceipt(null); setBusy(false); setWorkBusy(false); setUncertain(false); setFormError('');
  }
  function clearDetails() {
    stopLocalWork('Experiment navigation interrupted local confirmation.'); setLocalMessage('');
    view.current.splitConsent = false; view.current.trainingBars = ''; view.current.gapBars = '0'; setSplitConsent(false); setTrainingBars(''); setGapBars('0');
    const state = s.current; state.detailId++; state.outcomeId++; state.reads.forEach(controller => controller.abort()); state.reads.clear();
    view.current.selected = null; view.current.outcome = null; view.current.outcomes = [];
    setSelected(null); setOutcome(null); setOutcomes([]); setOutcomeCursor(null); setOutcomePage(null); setDetailError(''); setOutcomeError(''); setDetailBusy(false); setOutcomeBusy(false);
  }
  function sourceUnavailable(parent: Item) {
    redactLocalRuns({manifestId: parent.id, sourceId: parent.strategy.id});
    clearDetails(); view.current.items = []; setItems([]); setDetailError('Source or parent became unavailable. Refresh the feed to inspect current public metadata.'); setBoardError('Source or parent became unavailable. Refresh to load current projections.');
  }
  useEffect(() => { s.current.alive = true; if (selectionError) setDetailError(selectionError); else if (selection) void resolveExact(selection); else void load(); return () => { const state = s.current; state.alive = false; erasePending(); state.epoch++; state.formId++; state.workId++; state.reads.forEach(controller => controller.abort()); state.reads.clear(); local.current.workId++; local.current.controller?.abort(); local.current.controller = null; local.current.working = false; local.current.active = null; local.current.planActive = null; view.current.localRuns = []; view.current.plans = []; view.current.localRights = false; view.current.splitConsent = false; view.current.fields = blank(); view.current.form = null; view.current.me = null; view.current.receipt = null; }; }, []);
  useEffect(() => { if (!signedIn) { clearPrivate(); return; } s.current.denied = false; setAuthLost(false); void loadIdentity(); }, [signedIn]);
  async function loadIdentity() {
    const state = s.current; if (!state.alive || !state.signedIn || state.denied) return;
    const id = ++state.identityId;
    try {
      const response = await fetch('/api/experiments/me', {cache: 'no-store', signal: AbortSignal.timeout(15_000)});
      if (!state.alive || !state.signedIn || state.denied || id !== state.identityId) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if (!response.ok) throw Error('Identity unavailable.');
      const value = experimentMeSchema.parse(await readResponse(response, 4096));
      if (!state.alive || !state.signedIn || state.denied || id !== state.identityId) return;
      if ((view.current.me && (value.authorId !== view.current.me.authorId || value.sponsorId !== view.current.me.sponsorId)) || (state.pending && (value.authorId !== state.pending.author.authorId || value.sponsorId !== state.pending.author.sponsorId))) { clearPrivate(); return; }
      view.current.me = value; setMe(value); setIdentityError('');
    } catch { if (state.alive && state.signedIn && !state.denied && id === state.identityId) setIdentityError('Account context unavailable. Reload before submitting.'); }
  }
  async function load(next: string | null = null) {
    const state = s.current; if (!state.alive || state.locked || state.pending || reviewLock.current || view.current.form) return;
    state.epoch++; clearDetails(); view.current.items = []; setItems([]); setLoading(true); setBoardError('');
    const id = ++state.boardId, controller = new AbortController(); state.reads.add(controller);
    try {
      const response = await fetch('/api/experiments' + (next ? '?cursor=' + encodeURIComponent(next) : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!response.ok) throw Error('Feed unavailable.');
      const value = experimentListSchema.parse(await readResponse(response));
      if (value.items.some(item => item.type !== 'MANIFEST') || new Set(value.items.map(item => item.id)).size !== value.items.length) throw Error('Wrong feed.');
      if (!state.alive || id !== state.boardId || controller.signal.aborted) return;
      value.items.filter(item => item.state !== 'VISIBLE' || item.suppression).forEach(item => redactLocalRuns({manifestId: item.id, sourceId: item.suppression === 'SOURCE_UNAVAILABLE' ? item.strategy.id : null}));
      view.current.items = value.items; setItems(value.items); setCursor(value.nextCursor); setPageCursor(next);
    } catch { if (state.alive && id === state.boardId && !controller.signal.aborted) setBoardError('Experiment feed unavailable. Refresh to retry.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.boardId) setLoading(false); }
  }
  async function choose(summary: Summary) {
    const state = s.current; if (!state.alive || state.epoch !== renderEpoch || state.pending || state.locked || view.current.form) return;
    const isOutcome = summary.type === 'OUTCOME', parent = view.current.selected;
    if (!(isOutcome ? view.current.outcomes : view.current.items).some(row => same(row, summary)) || (isOutcome && (!parent || !same(summary.manifest, {id: parent.id, digest: parent.digest})))) return;
    const lineage = knownPlanChild(isOutcome ? parent?.id : summary.id);
    if (knownChildUnavailable(isOutcome ? parent?.id : summary.id)) { setDetailError('Known chronological lineage is unavailable in this tab. Public child metadata may remain, but held input bodies cannot be restored.'); return; }
    state.epoch++;
    if (!isOutcome) clearDetails(); else { view.current.outcome = null; setOutcome(null); }
    const id = ++state.detailId, controller = new AbortController(); state.reads.add(controller); setDetailBusy(true); setDetailError('');
    try {
      if (lineage) {
        const checked = await checkPlan(lineage, controller.signal), partition = lineage.childIds.TRAIN.id === (isOutcome ? parent!.id : summary.id) ? 'TRAIN' : 'TEST', child = lineage.children[partition];
        if (!child) throw new RunSourceUnavailable(lineage.parent.id);
        const fresh = await currentRunSources(child, controller.signal); await correlateChronologicalManifest(checked, partition, fresh.manifest);
        if (!state.alive || id !== state.detailId || controller.signal.aborted || view.current.plans.find(value => value.id === lineage.id)?.plan?.planDigest !== checked.planDigest) return;
      }
      const response = await fetch('/api/experiments?id=' + encodeURIComponent(summary.id), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!response.ok) throw Error('Detail unavailable.');
      const envelope = experimentGetSchema.parse(await readResponse(response)), item = await validateExperimentItem(envelope.item);
      if (item.id !== summary.id || item.digest !== summary.digest || item.type !== summary.type || !same(item.author, summary.author) || !same(item.strategy, summary.strategy) || !same(item.manifest, summary.manifest)) throw Error('Wrong detail.');
      if (!state.alive || id !== state.detailId || controller.signal.aborted || state.pending || reviewLock.current || view.current.form) return;
      if (item.type === 'MANIFEST' && !item.record) redactLocalRuns({manifestId: item.id, sourceId: item.suppression === 'SOURCE_UNAVAILABLE' ? item.strategy.id : null});
      if (isOutcome) {
        if (view.current.selected !== parent || !parent) return;
        if (item.suppression && parent.record) { sourceUnavailable(parent); return; }
        if (item.record && !parent.record) throw Error('Visible outcome cannot use an unavailable parent.');
        if (item.record?.type === 'OUTCOME' && !same(item.record.flags, experimentOutcomeFlags(item.author, parent.author, item.record.content.claim))) throw Error('Outcome attribution flags differ.');
        if (item.record?.type === 'OUTCOME' && item.record.content.result.kind === 'ARTIFACT' && parent.record?.type === 'MANIFEST' && !same(item.record.content.result.artifact.input, parent.record.content.input)) throw Error('Outcome input differs from manifest.');
        view.current.outcomes = view.current.outcomes.map(row => row.id === item.id ? summarize(item) : row); setOutcomes(view.current.outcomes);
        view.current.outcome = item; setOutcome(item);
      } else { view.current.items = view.current.items.map(row => row.id === item.id ? summarize(item) : row); setItems(view.current.items); view.current.selected = item; setSelected(item); if (item.record && experimentIsBatchManifest(item.record)) { view.current.trainingBars = String(Math.floor(item.record.content.input.dataset.bars.length / 2)); setTrainingBars(view.current.trainingBars); } setDetailBusy(false); void loadOutcomes(item); }
    } catch (error) { if (state.alive && id === state.detailId && !controller.signal.aborted) { if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); } setDetailError('Exact record unavailable or inconsistent. No content was accepted.'); } }
    finally { state.reads.delete(controller); if (state.alive && id === state.detailId) setDetailBusy(false); }
  }
  async function loadOutcomes(parent: Item, next: string | null = null, retainedOutcome: Item | null = null) {
    const state = s.current; if (!state.alive || state.pending || reviewLock.current || view.current.form || view.current.selected !== parent || parent.type !== 'MANIFEST') return;
    stopLocalWork('Outcome navigation interrupted local confirmation.'); state.epoch++; state.detailId++; setDetailBusy(false);
    const id = ++state.outcomeId, controller = new AbortController(); state.reads.add(controller); setOutcomeBusy(true); setOutcomeError(''); view.current.outcomes = []; view.current.outcome = retainedOutcome; setOutcomes([]); setOutcome(retainedOutcome);
    try {
      const response = await fetch('/api/experiments?outcomes=' + encodeURIComponent(parent.id) + (next ? '&cursor=' + encodeURIComponent(next) : ''), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
      if (!response.ok) throw Error('Outcomes unavailable.');
      const value = experimentListSchema.parse(await readResponse(response));
      if (new Set(value.items.map(item => item.id)).size !== value.items.length || value.items.some(item => item.type !== 'OUTCOME' || !same(item.manifest, {id: parent.id, digest: parent.digest}) || !same(item.strategy, parent.strategy))) throw Error('Wrong outcome page.');
      if (!state.alive || id !== state.outcomeId || controller.signal.aborted || view.current.selected !== parent || state.pending || reviewLock.current || view.current.form) return;
      if (parent.record && value.items.some(item => item.suppression !== null)) { sourceUnavailable(parent); return; }
      if (!parent.record && value.items.some(item => item.state === 'VISIBLE')) throw Error('Unavailable parent cannot expose outcome content.');
      view.current.outcomes = value.items; setOutcomes(value.items); setOutcomeCursor(value.nextCursor); setOutcomePage(next);
    } catch { if (state.alive && id === state.outcomeId && !controller.signal.aborted) setOutcomeError('Outcome history unavailable. No results were substituted.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.outcomeId) setOutcomeBusy(false); }
  }
  async function resolveExact(reference: ExperimentSelection) {
    const state = s.current; if (!state.alive || state.pending || reviewLock.current || view.current.form) return;
    state.epoch++; clearDetails(); const id = ++state.detailId, controller = new AbortController(); state.reads.add(controller); setDetailBusy(true); setDetailError('');
    try {
      const read = async (ref: ExperimentSelection) => {
        const response = await fetch('/api/experiments?id=' + encodeURIComponent(ref.id), {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])});
        if (!response.ok) throw Error('Exact record unavailable.');
        const item = await validateExperimentItem(experimentGetSchema.parse(await readResponse(response)).item);
        if (item.id !== ref.id || item.digest !== ref.digest) throw Error('Wrong exact record.');
        return item;
      };
      const item = await read(reference), parent = item.type === 'OUTCOME' ? await read(item.manifest!) : item;
      if (parent.type !== 'MANIFEST' || !same(item.strategy, parent.strategy) || (item.type === 'OUTCOME' && !same(item.manifest, {id: parent.id, digest: parent.digest}))) throw Error('Wrong exact lineage.');
      if (item.record?.type === 'OUTCOME') {
        if (!parent.record || parent.record.type !== 'MANIFEST' || item.record.version !== parent.record.version || !same(item.record.flags, experimentOutcomeFlags(item.author, parent.author, item.record.content.claim)) || (item.record.content.result.kind === 'ARTIFACT' && !same(item.record.content.result.artifact.input, parent.record.content.input))) throw Error('Wrong exact outcome input.');
      }
      if (!state.alive || id !== state.detailId || controller.signal.aborted || state.pending || reviewLock.current || view.current.form) return;
      if (!parent.record) redactLocalRuns({manifestId: parent.id, sourceId: parent.suppression === 'SOURCE_UNAVAILABLE' ? parent.strategy.id : null});
      view.current.selected = parent; setSelected(parent); view.current.outcome = item.type === 'OUTCOME' ? item : null; setOutcome(view.current.outcome); setDetailBusy(false);
      void loadOutcomes(parent, null, item.type === 'OUTCOME' ? item : null);
    } catch { if (state.alive && id === state.detailId && !controller.signal.aborted) setDetailError('Exact record unavailable or inconsistent. No alternative revision was substituted.'); }
    finally { state.reads.delete(controller); if (state.alive && id === state.detailId) setDetailBusy(false); }
  }
  function exact(item: Item) { return [view.current.selected, view.current.outcome].some(row => row && same(row, item)); }
  function sponsored(item: Item) { return !!view.current.me && item.author.sponsorId === view.current.me.sponsorId; }
  function open(action: Form['action'], target: Item | null = null, claim: Form['claim'] = 'ORIGINAL') {
    const state = s.current, parent = view.current.selected;
    if (!allowed() || state.epoch !== renderEpoch || state.locked || state.pending || reviewLock.current || state.working || local.current.working || view.current.form || loading || detailBusy || outcomeBusy) return;
    if (target && !exact(target)) return;
    if (action === 'withdraw' && (!target || target.state === 'WITHDRAWN' || !sponsored(target))) return;
    if (action === 'report' && !target?.record) return;
    if (action === 'outcome' && (!parent?.record || parent.record.type !== 'MANIFEST' || parent.state !== 'VISIBLE' || (claim !== 'ORIGINAL' && (!target?.record || target.type !== 'OUTCOME' || !same(target.manifest, {id: parent.id, digest: parent.digest}))))) return;
    state.reads.forEach(controller => controller.abort()); state.reads.clear(); state.detailId++; state.outcomeId++; state.formId++;
    const next: Form = {action, target: target ? structuredClone(target) : null, parent: action === 'outcome' ? structuredClone(parent!) : null, relation: claim === 'ORIGINAL' ? null : structuredClone(target!), claim};
    const value = blank(); if (action === 'withdraw') value.reason = target!.author.kind === 'HUMAN' && target!.author.id === view.current.me!.authorId ? 'AUTHOR_REQUEST' : 'SPONSOR_REQUEST';
    view.current.form = next; view.current.fields = value; view.current.receipt = null;
    setForm(next); setFields(value); setReceipt(null); setFormError(''); setUncertain(false);
  }
  function close() {
    const state = s.current; if (!allowed() || renderFormId !== state.formId || state.locked || state.pending || reviewLock.current || state.working) return;
    state.formId++; view.current.form = null; view.current.fields = blank(); view.current.receipt = null; setForm(null); setFields(blank()); setReceipt(null); setFormError('');
  }
  function change(changes: Partial<Fields>, material = true) {
    const state = s.current; if (!allowed() || renderFormId !== state.formId || state.locked || state.pending || reviewLock.current || state.working || view.current.form !== form || view.current.fields !== fields || view.current.receipt) return;
    if (material && form?.split) { setFormError('This child declaration is frozen. Close the form and create a new plan to change it.'); return; }
    const next = {...fields, ...(material ? {consent: false, dataRights: false, publicData: false, publicArtifact: false} : {}), ...changes};
    if ('json' in changes && form?.action === 'register') { next.input = null; next.bundle = null; next.methodDigest = ''; next.step = 1; }
    view.current.fields = next; setFields(next); setFormError('');
  }
  async function importFile(file: File | undefined) {
    const state = s.current; if (!file || !allowed() || renderFormId !== state.formId || state.locked || state.pending || reviewLock.current || state.working || !form || form.split || view.current.fields !== fields) return;
    const epoch = state.epoch, formId = state.formId, id = ++state.workId; state.working = true; setWorkBusy(true); setFormError('');
    try {
      const cap = form.action === 'register' ? sessionEvidenceLimits.bundleBytes : experimentLimits.artifactBytes;
      if (file.size > cap) throw Error('File exceeds the registry byte budget.');
      const raw = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer()); parseUniqueJson(raw, cap, 16);
      if (!valid(epoch, formId) || id !== state.workId) return;
      const next = {...view.current.fields, json: raw, input: null, bundle: null, methodDigest: '', step: 1, consent: false, dataRights: false, publicData: false, publicArtifact: false}; view.current.fields = next; setFields(next);
    } catch { if (valid(epoch, formId) && id === state.workId) setFormError(form.action === 'outcome' ? 'Import rejected. Registry artifacts must be strict UTF-8 JSON, at most 512 KiB. Keep the full artifact; use Artifact unavailable with an explanation if it cannot fit.' : 'Import rejected. Use strict UTF-8 unique-key JSON: request input at most 192 KiB, or a complete continuous review bundle at most 768 KiB.'); }
    finally { if (valid(epoch, formId) && id === state.workId) { state.working = false; setWorkBusy(false); } }
  }
  async function nextStep() {
    const state = s.current; if (!allowed() || renderFormId !== state.formId || state.locked || state.pending || reviewLock.current || state.working || form?.action !== 'register' || view.current.fields !== fields) return;
    if (fields.step === 2) {
      try { if (form.split) { const held = view.current.plans.find(value => value.id === form.split!.planId); if (!held?.plan || held.cleared) throw Error('Frozen plan unavailable.'); boundedExperimentCommand(held.plan.children[form.split.partition].command); } else boundedExperimentCommand(registration(fields, crypto.randomUUID(), crypto.randomUUID())); change({step: 3}, false); } catch { setFormError('Complete the source fingerprint, actual trial count and disclosure fields. A complete search log requires its contents.'); } return;
    }
    const epoch = state.epoch, formId = state.formId, id = ++state.workId; state.working = true; setWorkBusy(true); setFormError('');
    try {
      const parsed = parseUniqueJson(fields.json, sessionEvidenceLimits.bundleBytes, 16), bundle = parsed && typeof parsed === 'object' && 'kind' in parsed && parsed.kind === 'LOCAL_CONTINUOUS_DEMO_REVIEW' ? await verifySessionEvidenceBundle(parsed) : null;
      const rawInput = bundle?.input ?? parsed, continuous = rawInput && typeof rawInput === 'object' && 'kind' in rawInput;
      const input = continuous ? await verifySessionEvidenceInput(boundedSessionEvidenceInput(rawInput).input) : boundedDemoRequest(rawInput).input, expected = experimentInputStrategy(input);
      if (!fields.name.trim() || fields.name.trim().length > 120 || await experimentDigest(boundedStrategyRecord(expected.record).payload) !== expected.digest) throw Error('Invalid request or source.');
      const response = await fetch('/api/strategies?id=' + encodeURIComponent(expected.record.id), {cache: 'no-store', signal: AbortSignal.timeout(15_000)});
      if (!response.ok) throw Error('Published source unavailable.');
      const source = strategyGetSchema.parse(await readResponse(response)).item;
      if (source.id !== expected.record.id || source.digest !== expected.digest) throw Error('Source differs.');
      if (!source.record || source.state !== 'VISIBLE') throw new RunSourceUnavailable(expected.record.id, expected.record.id);
      if (await experimentDigest(boundedStrategyRecord(source.record).payload) !== source.digest || !same(source.record, expected.record)) throw Error('Source differs.');
      if ('kind' in input) { await reconstructSessionEvidence(input); if (!valid(epoch, formId) || id !== state.workId) return; await currentEvidenceSource(input, AbortSignal.timeout(15_000)); }
      const methodDigest = 'kind' in input ? input.methodDigest : await experimentDigest(JSON.stringify(demoEvaluatorMethod));
      if (!valid(epoch, formId) || id !== state.workId) return;
      const next = {...fields, input, bundle, json: JSON.stringify(input), methodDigest, ...('kind' in input ? {sourceVersion: 'opengrail-session-v1 fixed source identities', sourceDigest: '', validationNote: 'Retrospective supplied snapshot; source clocks and historical execution are unverified.', dependencies: 'Same first-party Session method and pinned implementation'} : {}), step: 2, consent: false, dataRights: false, publicData: false, publicArtifact: false}; view.current.fields = next; setFields(next);
    } catch (error) { if (valid(epoch, formId) && id === state.workId) { if (error instanceof RunSourceUnavailable) { view.current.fields = blank(); setFields(blank()); } setFormError('Request not accepted. Import an exact Demo request or complete continuous snapshot using a currently visible Strategy Hub record. Offline example authors are not registered sources. Check the 192 KiB input limit, required fields, digest and duplicate keys.'); } }
    finally { if (valid(epoch, formId) && id === state.workId) { state.working = false; setWorkBusy(false); } }
  }
  async function submit() {
    const state = s.current; if (!allowed() || renderFormId !== state.formId || state.locked || state.pending || reviewLock.current || state.working || !form || view.current.form !== form || view.current.fields !== fields || view.current.receipt) return;
    if (!fields.consent || ((form.action === 'register' || form.action === 'outcome') && (!fields.dataRights || !fields.publicData || !fields.publicArtifact))) { setFormError('Confirm the public sharing statements and policy before submitting.'); return; }
    if (form.action === 'register' && (fields.step !== 3 || !fields.input)) return;
    if (form.target && (!exact(form.target) || (form.action === 'withdraw' ? form.target.state === 'WITHDRAWN' : !form.target.record))) { setFormError('The referenced record changed. Close and refresh.'); return; }
    if (form.action === 'withdraw' && !sponsored(form.target!)) return;
    const epoch = state.epoch, formId = state.formId, workId = ++state.workId; state.working = true; setWorkBusy(true); setFormError('');
    try {
      const requestId = form.runIds?.requestId ?? crypto.randomUUID(), id = form.runIds?.id ?? crypto.randomUUID(); let raw: unknown;
      if (form.action === 'register') {
        raw = registration(fields, requestId, id);
        if (fields.input && 'kind' in fields.input) await currentEvidenceSource(fields.input, AbortSignal.timeout(15_000));
        if (form.split) {
          const held = view.current.plans.find(value => value.id === form.split!.planId);
          if (!held?.plan || held.cleared || held.children[form.split.partition]) throw Error('Frozen plan unavailable.');
          const checked = await checkPlan(held, AbortSignal.timeout(15_000));
          const planned = await prepareChronologicalManifest(checked, form.split.partition, {confirmPublicSharing: true});
          if (!same({...fields, step: 1, consent: false, dataRights: false, publicData: false, publicArtifact: false}, registrationFields(planned)) || !valid(epoch, formId) || workId !== state.workId || view.current.plans.find(value => value.id === held.id)?.plan?.planDigest !== checked.planDigest) throw Error('Frozen declaration differs.');
          raw = planned;
        }
      }
      else if (form.action === 'outcome') {
        const parent = form.parent;
        if (!parent?.record || parent.record.type !== 'MANIFEST' || !exact(parent)) throw Error('Parent changed.');
        if (parent.record.version === 2) await currentRunSources(parent, AbortSignal.timeout(15_000));
        if (form.localAttemptId) {
          const attempt = view.current.localRuns.find(value => value.id === form.localAttemptId);
          if (!attempt || attempt.cleared || !same(attempt.manifest, {id: parent.id, digest: parent.digest})) throw Error('Local evidence changed.');
          await checkAttemptPlan(attempt, AbortSignal.timeout(15_000));
          const fresh = await currentRunSources(parent, AbortSignal.timeout(15_000));
          if (attempt.run) { const run = await assertExperimentRunSources(attempt.run, fresh.manifest, fresh.source), planned = await prepareExperimentRunOutcome(run, {confirmPublicSharing: true}); if (planned.requestId !== requestId || planned.id !== id) throw Error('Publication identity changed.'); }
          if (!valid(epoch, formId) || workId !== state.workId) return;
        }
        let result: unknown = {kind: fields.resultKind, reason: fields.details};
        if (fields.resultKind === 'ARTIFACT') {
          const parsed = parseUniqueJson(fields.json, experimentLimits.artifactBytes, 16), artifact = parent.record.version === 2 ? await verifySessionEvidenceArtifact(parsed) : await verifyDemoArtifact(parsed);
          if (!artifact.input || !same(artifact.input, parent.record.content.input)) throw Error('Artifact input differs from manifest.');
          result = {kind: 'ARTIFACT', artifact};
        }
        raw = {action: 'outcome', ...(parent.record.version === 2 ? {method: 'CONTINUOUS_DEMO'} : {}), requestId, id, name: fields.name, manifest: {id: parent.id, digest: parent.digest}, result, claim: {type: form.claim, relation: form.relation ? {type: form.claim === 'REPRODUCTION' ? 'SUPPORTS' : 'CONFLICTS', id: form.relation.id, digest: form.relation.digest} : null, sharedDependencies: lines(fields.dependencies), conflicts: fields.conflicts}, policyAccepted: policy};
      } else raw = {action: form.action, requestId, id: form.target!.id, digest: form.target!.digest, reason: fields.reason, ...(form.action === 'report' ? {details: fields.details} : {}), policyAccepted: policy};
      const {command, payload} = boundedExperimentCommand(raw);
      if (!valid(epoch, formId) || workId !== state.workId) return;
      const pending: Pending = {command, body: payload, author: structuredClone(view.current.me!), target: form.target ? structuredClone(form.target) : null, parent: form.parent ? structuredClone(form.parent) : null, submitted: false, suppressionKnown: false, ...(form.split ? {split: {...form.split}} : {}), ...(form.localAttemptId ? {localAttemptId: form.localAttemptId} : {})};
      state.pending = pending; state.working = false; setWorkBusy(false); void write(pending);
    } catch (error) { if (valid(epoch, formId) && workId === state.workId) { if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); } else setFormError(form.action === 'outcome' ? 'Outcome not submitted. Supply the exact manifest input and a valid complete artifact within 512 KiB, or report Interrupted / Artifact unavailable with an explanation. Check required fields and credential-free disclosures.' : 'Submission not prepared. Check required fields, numeric disclosures, source fingerprint and credential-free content.'); } }
    finally { if (valid(epoch, formId) && workId === state.workId) { state.working = false; setWorkBusy(false); } }
  }
  async function write(pending: Pending) {
    const state = s.current; if (!allowed() || state.locked || reviewLock.current || state.pending !== pending) return;
    if (pending.author.authorId !== view.current.me!.authorId || pending.author.sponsorId !== view.current.me!.sponsorId) { clearPrivate(); return; }
    const epoch = state.epoch, formId = state.formId; state.locked = true; setBusy(true); setUncertain(false); setFormError('');
    try {
      if ('method' in pending.command && !pending.submitted) {
        if (pending.command.action === 'register') await currentEvidenceSource(pending.command.input, AbortSignal.timeout(15_000));
        else if (pending.parent) await currentRunSources(pending.parent, AbortSignal.timeout(15_000));
        if (!valid(epoch, formId) || state.pending !== pending) return;
      }
      if (pending.localAttemptId) { const attempt = view.current.localRuns.find(value => value.id === pending.localAttemptId); if (!attempt || attempt.cleared) throw Error('Local evidence unavailable.'); await checkAttemptPlan(attempt, AbortSignal.timeout(15_000)); if (!valid(epoch, formId) || state.pending !== pending) return; }
      if (pending.split) {
        const held = view.current.plans.find(value => value.id === pending.split!.planId);
        if (!held?.plan || held.cleared) throw Error('Frozen plan unavailable.');
        const checked = await checkPlan(held, AbortSignal.timeout(15_000));
        if (!same(checked.children[pending.split.partition].command, pending.command) || !valid(epoch, formId) || state.pending !== pending || view.current.plans.find(value => value.id === held.id)?.plan?.planDigest !== checked.planDigest) throw Error('Frozen declaration changed.');
      }
      pending.submitted = true;
      const response = await fetch('/api/experiments', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Experiment-Intent': 'submit', 'X-Experiment-Author': pending.author.authorId}, body: pending.body, signal: AbortSignal.timeout(15_000)});
      if (!valid(epoch, formId) || state.pending !== pending) return;
      if (response.status === 401 || response.status === 403) { clearPrivate(); return; }
      if ([400, 404, 405, 409, 413, 415, 429].includes(response.status)) {
        erasePending(); setUncertain(false); const retry = response.headers.get('Retry-After'), seconds = retry && /^\d{1,5}$/.test(retry) ? Number(retry) : null;
        setFormError(response.status === 409 ? 'Reference unavailable or request conflict. Close and refresh before correcting the request.' : response.status === 429 ? 'Submission quota reached.' + (seconds ? ` Retry after ${seconds} seconds.` : ' Retained capacity is full; no automatic reset is scheduled.') : response.status === 413 ? 'Registry byte budget exceeded. Keep artifacts complete; report Artifact unavailable if the full result cannot fit.' : 'Submission rejected. Correct the required fields and public policy statements.'); return;
      }
      if (!response.ok) throw Error('Unknown write.');
      const value = experimentWriteSchema.parse(await readResponse(response)); if (value.item) await validateExperimentItem(value.item);
      if (!valid(epoch, formId) || state.pending !== pending) return;
      if (!matches(pending, value)) throw Error('Receipt mismatch.');
      if (pending.suppressionKnown && value.item?.record) throw Error('Current projection unconfirmed after known suppression.');
      if (pending.localAttemptId) { const attempt = view.current.localRuns.find(entry => entry.id === pending.localAttemptId); if (!attempt || attempt.cleared) throw Error('Local evidence unavailable.'); await checkAttemptPlan(attempt, AbortSignal.timeout(15_000)); if (!valid(epoch, formId) || state.pending !== pending) return; }
      if (pending.split && value.item) {
        const held = view.current.plans.find(entry => entry.id === pending.split!.planId);
        if (!held?.plan || held.cleared) throw Error('Frozen plan unavailable.');
        if (value.item.record) {
          const checked = await checkPlan(held, AbortSignal.timeout(15_000)), child = await correlateChronologicalManifest(checked, pending.split.partition, value.item);
          if (!valid(epoch, formId) || state.pending !== pending || view.current.plans.find(entry => entry.id === held.id)?.plan?.planDigest !== held.plan.planDigest) return;
          replacePlan(held.id, {children: {...held.children, [pending.split.partition]: child}});
        } else redactLocalRuns({manifestId: held.parent.id});
      }
      if (value.item && !value.item.record) redactLocalRuns({manifestId: value.item.type === 'MANIFEST' ? value.item.id : value.item.manifest!.id, sourceId: value.item.suppression === 'SOURCE_UNAVAILABLE' ? value.item.strategy.id : null}, true);
      const reviewBundle = pending.command.action === 'register' && 'method' in pending.command && value.item?.record && view.current.fields.bundle && same(view.current.fields.bundle.input, pending.command.input) ? view.current.fields.bundle : null;
      erasePending(); clearDetails(); view.current.items = []; setItems([]); const cleared = {...blank(), bundle: reviewBundle}; view.current.fields = cleared; setFields(cleared); view.current.receipt = value; setReceipt(value); setUncertain(false); setFormError('');
    } catch (error) { if (valid(epoch, formId) && state.pending === pending) { if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); } else { setUncertain(true); setFormError('Outcome unknown. Retry the identical request to reconcile it. Keep this tab open; drafts and pending requests are not saved.'); } } }
    finally { if (valid(epoch, formId)) { state.locked = false; setBusy(false); if (state.pending) setUncertain(true); } }
  }
  function done() { if (!allowed() || renderFormId !== s.current.formId || s.current.pending || s.current.locked || !receipt || view.current.receipt !== receipt) return; close(); void load(); }
  function retry() { if (allowed() && renderFormId === s.current.formId && s.current.pending === renderPending && renderPending) void write(renderPending); }
  async function prepareCapturedOutcome() {
    const state = s.current, parent = view.current.receipt?.item, bundle = view.current.fields.bundle;
    if (!allowed() || renderFormId !== state.formId || state.pending || state.locked || state.working || !parent?.record || parent.record.version !== 2 || parent.record.type !== 'MANIFEST' || !bundle || !same(bundle.input, parent.record.content.input)) return;
    const epoch = state.epoch, formId = state.formId, id = ++state.workId; state.working = true; setWorkBusy(true);
    try {
      const checked = await verifySessionEvidenceBundle(bundle), fresh = await currentRunSources(parent, AbortSignal.timeout(15_000));
      if (!valid(epoch, formId) || id !== state.workId || view.current.fields.bundle !== bundle || view.current.receipt?.item !== parent) return;
      state.formId++; const next: Form = {action: 'outcome', target: null, parent: fresh.manifest, relation: null, claim: 'ORIGINAL'}, value = {...blank(), name: (parent.record.content.name + ' · snapshot').slice(0,120), json: checked.result.kind === 'ARTIFACT' ? JSON.stringify(checked.result.artifact) : '', resultKind: checked.result.kind, details: checked.result.kind === 'ARTIFACT_UNAVAILABLE' ? checked.result.reason : '', dependencies: 'Same first-party Session method and pinned implementation', conflicts: 'Retrospective AUTHOR_REPORTED snapshot; fixed same-kernel reconstruction does not establish independent research or historical provider authenticity.'};
      view.current.selected = fresh.manifest; setSelected(fresh.manifest); view.current.form = next; view.current.fields = value; view.current.receipt = null; setForm(next); setFields(value); setReceipt(null); setFormError('');
    } catch (error) { if (valid(epoch, formId) && id === state.workId) { if (error instanceof RunSourceUnavailable) { view.current.fields = blank(); setFields(blank()); } setFormError('Captured outcome unavailable. No substitute input or public write was created.'); } } finally { if (state.alive && state.epoch === epoch && id === state.workId) { state.working = false; setWorkBusy(false); } }
  }
  function localAvailable() { const state = s.current; return state.alive && state.epoch === renderEpoch && !state.pending && !reviewLock.current && !state.locked && !state.working && !view.current.form && !local.current.working && !loading && !detailBusy && !outcomeBusy; }
  function localOperation(active: string | null = null, planActive: string | null = null) {
    const state = local.current, epoch = s.current.epoch, id = ++state.workId, controller = new AbortController();
    state.controller = controller; state.active = active; state.planActive = planActive; state.working = true; setLocalBusy(true); setLocalExportError('');
    return {signal: controller.signal, valid: () => s.current.alive && s.current.epoch === epoch && state.workId === id && !controller.signal.aborted, done: () => { if (s.current.alive && state.workId === id) { state.controller = null; state.active = null; state.planActive = null; state.working = false; setLocalBusy(false); } }};
  }
  async function checkPlan(entry: PlanEntry, signal: AbortSignal) {
    if (!entry.plan || entry.cleared) throw new RunSourceUnavailable(entry.parent.id, entry.source.id);
    const fresh = await currentRunSources(entry.plan.captured.parent, signal);
    return assertChronologicalPlanSources(entry.plan, fresh.manifest, fresh.source);
  }
  async function checkAttemptPlan(attempt: LocalAttempt, signal: AbortSignal) {
    if (!attempt.split) return;
    const held = view.current.plans.find(value => value.id === attempt.split!.planId);
    if (!held?.plan || held.cleared) throw new RunSourceUnavailable(held?.parent.id ?? attempt.manifest.id, held?.source.id ?? attempt.source.id);
    const checked = await checkPlan(held, signal), child = held.children[attempt.split.partition];
    if (!child || !same(attempt.manifest, {id: child.id, digest: child.digest})) throw new RunSourceUnavailable(held.parent.id);
    await correlateChronologicalManifest(checked, attempt.split.partition, child);
  }
  async function freezeSplit() {
    const parent = view.current.selected;
    if (!localAvailable() || !parent?.record || !experimentIsBatchManifest(parent.record) || parent !== selected || !view.current.splitConsent || !splitConsent) return;
    const bytes = new TextEncoder().encode(JSON.stringify(view.current.plans)).byteLength;
    if (view.current.plans.length >= chronologicalPlanLimits.plans || bytes + chronologicalPlanLimits.planBytes + 16_384 > chronologicalPlanLimits.plans * (chronologicalPlanLimits.planBytes + 16_384)) { setLocalMessage('Chronological plan capacity reached. All earlier plans and failures remain retained.'); return; }
    const identities = () => ({requestId: crypto.randomUUID(), id: crypto.randomUUID(), inputRequestId: crypto.randomUUID(), datasetId: crypto.randomUUID()});
    const children = {TRAIN: identities(), TEST: identities()}, entry: PlanEntry = {id: crypto.randomUUID(), at: new Date().toISOString(), parent: {id: parent.id, digest: parent.digest}, source: {...parent.strategy}, requested: {trainingBars: requestedNumber(view.current.trainingBars), excludedGapBars: requestedNumber(view.current.gapBars)}, childIds: {TRAIN: {id: children.TRAIN.id, requestId: children.TRAIN.requestId}, TEST: {id: children.TEST.id, requestId: children.TEST.requestId}}, status: 'CHECKING', plan: null, children: {TRAIN: null, TEST: null}, cleared: false, error: null};
    updatePlans([...view.current.plans, entry]); const work = localOperation(null, entry.id); setLocalMessage('Confirming current inputs and freezing the two child declarations…');
    const capturedTraining = view.current.trainingBars, capturedGap = view.current.gapBars;
    try {
      const fresh = await currentRunSources(parent, work.signal); if (!work.valid() || view.current.selected !== parent) return;
      const plan = await verifyChronologicalPlan(await createChronologicalPlan({planId: entry.id, createdAt: entry.at, parent: fresh.manifest, source: fresh.source, trainingBars: integer(capturedTraining), excludedGapBars: integer(capturedGap), children}));
      if (!work.valid() || view.current.selected !== parent || view.current.trainingBars !== capturedTraining || view.current.gapBars !== capturedGap) return;
      const current = await currentRunSources(parent, work.signal); await assertChronologicalPlanSources(plan, current.manifest, current.source);
      if (!work.valid() || view.current.selected !== parent || view.current.plans.find(value => value.id === entry.id)?.cleared) return;
      if (plan.planId !== entry.id || plan.createdAt !== entry.at || !same(plan.captured.parent.record, parent.record)) throw Error('Uncorrelated plan.');
      replacePlan(entry.id, {status: 'FROZEN', plan}); view.current.splitConsent = false; setSplitConsent(false); setLocalMessage('Plan frozen locally. Review and register each exact child separately before running it. No evaluation or publication occurred.');
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); } replacePlan(entry.id, {status: 'FAILED', error: 'Plan not confirmed. Check integer boundaries, retained data/disclosures, emergency timing and current source. This failed slot remains in history.'}); setLocalMessage('Plan not frozen; no child was registered or evaluated.'); } } finally { work.done(); }
  }
  async function prepareSplitChild(entry: PlanEntry, partition: Partition) {
    if (!localAvailable() || !allowed() || !entry.plan || entry.cleared || entry.children[partition] || !view.current.plans.includes(entry)) return;
    const work = localOperation(); setLocalMessage('Rechecking the original declaration before preparing an unchecked child form…');
    try {
      const plan = await checkPlan(entry, work.signal), command = plan.children[partition].command;
      if (!work.valid() || !allowed() || !view.current.plans.includes(entry) || entry.cleared) return;
      const value = registrationFields(command), next: Form = {action: 'register', target: null, parent: null, relation: null, claim: 'ORIGINAL', split: {planId: entry.id, partition}, runIds: {requestId: command.requestId, id: command.id}};
      s.current.formId++; view.current.form = next; view.current.fields = value; view.current.receipt = null; setForm(next); setFields(value); setReceipt(null); setFormError(''); setUncertain(false); setLocalMessage('Frozen child draft prepared. Public sharing requires your separate confirmation.');
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); setLocalMessage('Child draft unavailable. Refresh the original manifest and source; no publication occurred.'); } } finally { work.done(); }
  }
  async function inspectSplitChild(entry: PlanEntry, partition: Partition) {
    const captured = entry.children[partition];
    if (!localAvailable() || !entry.plan || entry.cleared || !captured?.record || !view.current.plans.includes(entry)) return;
    const work = localOperation();
    try {
      const plan = await checkPlan(entry, work.signal), fresh = await currentRunSources(captured, work.signal), child = await correlateChronologicalManifest(plan, partition, fresh.manifest);
      if (!work.valid() || !view.current.plans.includes(entry) || entry.cleared) return;
      replacePlan(entry.id, {children: {...entry.children, [partition]: child}});
      view.current.items = [summarize(child), ...view.current.items.filter(value => value.id !== child.id)]; setItems(view.current.items);
      work.done(); clearDetails(); view.current.selected = child; setSelected(child); if (child.record && experimentIsBatchManifest(child.record)) { view.current.trainingBars = String(Math.floor(child.record.content.input.dataset.bars.length / 2)); setTrainingBars(view.current.trainingBars); } void loadOutcomes(child);
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); setLocalMessage('Registered child unavailable. No local evaluation was started.'); } } finally { work.done(); }
  }
  async function exportSplitHistory() {
    if (!localAvailable() || !view.current.plans.length) return;
    const captured = view.current.plans, work = localOperation();
    try {
      for (const entry of captured) if (entry.plan && !entry.cleared) { const checked = await checkPlan(entry, work.signal); for (const partition of ['TRAIN', 'TEST'] as const) if (entry.children[partition]) { const fresh = await currentRunSources(entry.children[partition]!, work.signal); await correlateChronologicalManifest(checked, partition, fresh.manifest); } if (!work.valid() || view.current.plans !== captured) return; }
      if (!work.valid() || view.current.plans !== captured) return;
      download({version: 1, kind: 'LOCAL_CHRONOLOGICAL_PLAN_HISTORY', classification: 'AUTHOR_REPORTED', qualification: 'NONE', unseen: 'NOT_ESTABLISHED', ordersEnabled: false, plans: captured}, 'opengrail-chronological-plan-history.json', chronologicalPlanLimits.plans * (chronologicalPlanLimits.planBytes + 600_000));
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); setLocalExportError('Plan export not confirmed. Retained safe metadata remains; refresh current inputs before exporting payloads.'); } } finally { work.done(); }
  }
  async function runSelectedManifest() {
    const parent = view.current.selected;
    if (!localAvailable() || !parent || parent !== selected || parent.state !== 'VISIBLE' || !parent.record || !experimentIsBatchManifest(parent.record) || !localRights || view.current.localRights !== localRights) return;
    const lineage = view.current.plans.find(value => Object.values(value.childIds).some(child => child.id === parent.id)), partition = lineage?.childIds.TRAIN.id === parent.id ? 'TRAIN' : 'TEST';
    if (lineage && (!lineage.plan || lineage.cleared || !lineage.children[partition])) { setLocalMessage('This chronological child requires its exact correlated receipt and available original lineage.'); return; }
    const historyBytes = new TextEncoder().encode(JSON.stringify(view.current.localRuns)).byteLength;
    if (view.current.localRuns.length >= experimentRunLimits.attempts || historyBytes + experimentRunLimits.reservedAttemptBytes + 16_384 > experimentRunLimits.historyBytes) { setLocalMessage('Local run capacity reached. Export the complete history before a new page session; no earlier attempt was removed.'); return; }
    const attempt: LocalAttempt = {id: crypto.randomUUID(), at: new Date().toISOString(), manifest: {id: parent.id, digest: parent.digest}, source: {...parent.strategy}, outcomeRequestId: crypto.randomUUID(), outcomeId: crypto.randomUUID(), ...(lineage ? {split: {planId: lineage.id, partition: partition as Partition}} : {}), status: 'CHECKING', run: null, confirmed: false, cleared: false, error: null};
    updateLocalRuns([...view.current.localRuns, attempt]); const work = localOperation(attempt.id); setLocalMessage('Checking current manifest and strategy before admission…');
    try {
      await checkAttemptPlan(attempt, work.signal); if (!work.valid() || view.current.selected !== parent) return;
      const fresh = await currentRunSources(parent, work.signal); if (!work.valid() || view.current.selected !== parent) return;
      const admitted = await verifyExperimentRun(await createExperimentRun({attemptId: attempt.id, startedAt: attempt.at, outcomeRequestId: attempt.outcomeRequestId, outcomeId: attempt.outcomeId, manifest: fresh.manifest, source: fresh.source}));
      if (!work.valid() || view.current.selected !== parent) return;
      if (admitted.status !== 'RUNNING' || admitted.attemptId !== attempt.id || admitted.outcomeRequestId !== attempt.outcomeRequestId || admitted.outcomeId !== attempt.outcomeId || admitted.startedAt !== attempt.at || !same(admitted.captured.manifest.record, parent.record)) throw Error('Uncorrelated admission.');
      replaceLocalRun(attempt.id, {status: 'RUNNING', run: admitted}); setLocalMessage('Running primary evaluation and the three-pair reference comparison locally…');
      const result = await verifyExperimentRun(await evaluateExperimentRun(structuredClone(admitted), {signal: work.signal}));
      if (!work.valid() || view.current.selected !== parent) return;
      if (result.status === 'RUNNING' || result.attemptId !== admitted.attemptId || result.startedAt !== admitted.startedAt || result.outcomeRequestId !== admitted.outcomeRequestId || result.outcomeId !== admitted.outcomeId || result.inputDigest !== admitted.inputDigest || !same(result.captured, admitted.captured)) throw Error('Uncorrelated result.');
      replaceLocalRun(attempt.id, {status: result.status, run: result, confirmed: false});
      await checkAttemptPlan(attempt, work.signal);
      const current = await currentRunSources(parent, work.signal); await assertExperimentRunSources(result, current.manifest, current.source);
      if (!work.valid() || view.current.selected !== parent) return;
      replaceLocalRun(attempt.id, {status: result.status, run: result, confirmed: true}); view.current.localRights = false; setLocalRights(false);
      setLocalMessage('Local attempt retained. Review the actual primary result and comparison; nothing was published.');
    } catch (error) {
      if (work.valid()) {
        if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); }
        const retained = view.current.localRuns.find(value => value.id === attempt.id);
        replaceLocalRun(attempt.id, {status: retained?.run ? 'UNCONFIRMED' : 'FAILED', confirmed: false, error: 'Local workflow confirmation failed. Any verified admission or actual computation remains retained; current public visibility must be rechecked before use.'});
        if (retained?.run?.status === 'RUNNING' && !retained.cleared) { const terminal = await interruptExperimentRun(retained.run, new Date().toISOString(), 'RECOVERY_INTERRUPTED'); if (work.valid() && view.current.localRuns.find(value => value.id === attempt.id)?.run?.runDigest === retained.run.runDigest) replaceLocalRun(attempt.id, {run: terminal}); }
        setLocalMessage('Local run not confirmed. No substitute source, result or publication was created.');
      }
    } finally { work.done(); }
  }
  function cancelLocalRun() {
    if (!s.current.alive || s.current.epoch !== renderEpoch || !local.current.working) return;
    stopLocalWork('Local workflow cancelled before final public visibility was confirmed; retained computation is unchanged.', 'USER_CANCELLED'); setLocalMessage('Local confirmation cancelled. The retained attempt remains in history.');
  }
  async function prepareLocalOutcome(attempt: LocalAttempt) {
    const parent = view.current.selected;
    if (!localAvailable() || !allowed() || !parent?.record || parent.record.type !== 'MANIFEST' || !view.current.localRuns.some(value => value === attempt && !value.cleared) || !same(attempt.manifest, {id: parent.id, digest: parent.digest}) || ['CHECKING', 'RUNNING'].includes(attempt.status)) return;
    const work = localOperation(); setLocalMessage('Rechecking the exact public inputs before preparing an unchecked draft…');
    try {
      await checkAttemptPlan(attempt, work.signal);
      const fresh = await currentRunSources(parent, work.signal); const run = attempt.run ? await assertExperimentRunSources(attempt.run, fresh.manifest, fresh.source) : null;
      if (!work.valid() || !allowed() || view.current.selected !== parent || !view.current.localRuns.some(value => value === attempt && !value.cleared)) return;
      if (run?.status === 'RUNNING') throw Error('No terminal attempt.');
      const value = blank(), artifactFits = !!run?.artifact?.input && new TextEncoder().encode(JSON.stringify(run.artifact)).byteLength <= experimentLimits.artifactBytes;
      value.name = (parent.record.content.name + ' · local run').slice(0, 120);
      value.resultKind = (run ? run.status === 'INTERRUPTED' : attempt.status === 'INTERRUPTED') ? 'INTERRUPTED' : artifactFits ? 'ARTIFACT' : 'ARTIFACT_UNAVAILABLE';
      value.json = value.resultKind === 'ARTIFACT' ? JSON.stringify(run!.artifact) : '';
      value.details = value.resultKind === 'INTERRUPTED' ? 'The local attempt was interrupted before a correlated completion was confirmed. No completed evaluation is claimed.' : value.resultKind === 'ARTIFACT_UNAVAILABLE' ? run?.artifact ? 'The complete local artifact exceeds the 512 KiB public registry allowance. It remains retained locally without truncation.' : 'No available correlated complete artifact was confirmed. The local failed or unavailable attempt remains retained.' : '';
      const disclosure = run ? experimentRunDisclosure(run) : {sharedDependencies: ['Fixed method specification', 'JavaScript runtime and shared input schemas', 'Same supplied data and local operator'], conflicts: 'No correlated complete local result is available. This author report does not establish independent research, untouched holdouts or a complete external search history.'};
      value.dependencies = disclosure.sharedDependencies.join('\n'); value.conflicts = disclosure.conflicts;
      replaceLocalRun(attempt.id, {confirmed: true});
      s.current.formId++; const next: Form = {action: 'outcome', target: null, parent: structuredClone(parent), relation: null, claim: 'ORIGINAL', localAttemptId: attempt.id, runIds: {requestId: attempt.outcomeRequestId, id: attempt.outcomeId}};
      view.current.form = next; view.current.fields = value; view.current.receipt = null; setForm(next); setFields(value); setReceipt(null); setFormError(''); setUncertain(false); setLocalMessage('Outcome draft prepared. Confirm each public-sharing statement yourself before submitting.');
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); } setLocalMessage('Draft not prepared. Refresh the exact visible manifest and source; no publication occurred.'); } } finally { work.done(); }
  }
  async function exportLocalAttempt(attempt: LocalAttempt, comparisonOnly = false) {
    if (!localAvailable() || !attempt.run || attempt.cleared || !view.current.localRuns.includes(attempt)) return;
    const work = localOperation();
    try {
      await checkAttemptPlan(attempt, work.signal);
      const fresh = await currentRunSources(attempt.run.captured.manifest, work.signal), run = await assertExperimentRunSources(attempt.run, fresh.manifest, fresh.source);
      if (!work.valid() || !view.current.localRuns.includes(attempt) || attempt.cleared) return;
      if (comparisonOnly && !run.comparison) throw Error('No comparison.');
      replaceLocalRun(attempt.id, {confirmed: true});
      download(comparisonOnly ? run.comparison : run, `opengrail-${comparisonOnly ? 'comparison' : 'local-run'}-${attempt.id}.json`, experimentRunLimits.attemptBytes);
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); setLocalExportError('Export unavailable. Retained safe attempt metadata remains; no result was substituted.'); } } finally { work.done(); }
  }
  async function exportLocalHistory() {
    if (!localAvailable() || !view.current.localRuns.length) return;
    const captured = view.current.localRuns, work = localOperation();
    try {
      for (const attempt of captured) if (attempt.run && !attempt.cleared) { await checkAttemptPlan(attempt, work.signal); const fresh = await currentRunSources(attempt.run.captured.manifest, work.signal); await assertExperimentRunSources(attempt.run, fresh.manifest, fresh.source); if (!work.valid() || view.current.localRuns !== captured) return; }
      if (!work.valid() || view.current.localRuns !== captured) return;
      const confirmed = captured.map(attempt => attempt.run && !attempt.cleared ? {...attempt, confirmed: true} : attempt); updateLocalRuns(confirmed);
      download({version: 1, kind: 'LOCAL_EXPERIMENT_RUN_HISTORY', classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false, attempts: confirmed}, 'opengrail-experiment-run-history.json', experimentRunLimits.historyBytes);
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); setLocalExportError('Complete history export could not be confirmed. Refresh unavailable inputs, then export retained metadata; earlier attempts were not removed.'); } } finally { work.done(); }
  }
  async function exportValue(value: unknown, name: string) {
    if (!s.current.alive || s.current.epoch !== renderEpoch || s.current.pending || view.current.form || detailBusy || outcomeBusy || view.current.selected !== selected || view.current.outcome !== outcome) return;
    const parent = view.current.selected, lineage = knownPlanChild(parent?.id);
    if (parent?.record?.version === 2) {
      if (!localAvailable()) return;
      const heldOutcome = view.current.outcome, work = localOperation();
      try {
        await currentRunSources(parent, work.signal);
        if (heldOutcome?.record) {
          const response = await fetch('/api/experiments?id=' + encodeURIComponent(heldOutcome.id), {cache: 'no-store', signal: work.signal});
          if (!response.ok) { if (response.status === 404) throw new RunSourceUnavailable(parent.id); throw Error('Outcome confirmation unavailable.'); }
          const fresh = await validateExperimentItem(experimentGetSchema.parse(await readResponse(response)).item);
          if (fresh.id !== heldOutcome.id || fresh.digest !== heldOutcome.digest) throw Error('Outcome reference changed.');
          if (!fresh.record || fresh.state !== 'VISIBLE') throw new RunSourceUnavailable(parent.id, fresh.suppression === 'SOURCE_UNAVAILABLE' ? parent.strategy.id : null);
          if (!same(fresh.record, heldOutcome.record)) throw Error('Outcome content changed.');
        }
        if (!work.valid() || view.current.selected !== parent || view.current.outcome !== heldOutcome) return;
        download(value, name, experimentLimits.requestBytes);
      } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) { redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); clearDetails(); } setLocalExportError('Continuous snapshot export withheld until its exact public source, manifest and outcome remain available.'); } } finally { work.done(); }
      return;
    }
    if (!lineage) { download(value, name); return; }
    if (!localAvailable() || !parent || knownChildUnavailable(parent.id)) { setLocalExportError('Known chronological lineage is unavailable; this input cannot be exported from held content.'); return; }
    const work = localOperation();
    try {
      const checked = await checkPlan(lineage, work.signal), fresh = await currentRunSources(parent, work.signal), partition = lineage.childIds.TRAIN.id === parent.id ? 'TRAIN' : 'TEST';
      await correlateChronologicalManifest(checked, partition, fresh.manifest);
      if (!work.valid() || view.current.selected !== parent || view.current.plans.find(entry => entry.id === lineage.id)?.plan?.planDigest !== checked.planDigest || knownChildUnavailable(parent.id)) return;
      download(value, name);
    } catch (error) { if (work.valid()) { if (error instanceof RunSourceUnavailable) redactLocalRuns({manifestId: error.manifestId, sourceId: error.sourceId}); setLocalExportError('Exact input export not confirmed. Current chronological lineage must remain available.'); } } finally { work.done(); }
  }
  const canNavigate = !form && !busy && !uncertain && !workBusy && !localBusy && !reviewBusy;
  const canWrite = authenticated && canNavigate && !loading && !detailBusy && !outcomeBusy;
  const manifest = selected?.record?.type === 'MANIFEST' ? selected.record : null;
  return <div className="og-network"><a className="og-skip" href="#experiment-main">Skip to content</a>
    <header className="og-header"><a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a><nav aria-label="Main navigation"><a href="/">Network</a><a href="/research">Research</a><a href="/venture">Venture</a><a href="/strategies">Strategies</a><a href="/demo">Demo</a><a href="/session">Sessions</a><a href="/experiments" aria-current="page">Experiments</a><a href="/search">Strategy search</a><a href="/validation">Validation</a><a href="/arena">Arena</a></nav>{signedIn && !authLost ? <a className="og-header-action" href="/signout-with-chatgpt?return_to=/experiments" target="_top" onClick={clearPrivate}>Sign out</a> : <a className="og-header-action" href={signIn} target="_top">Sign in<ArrowRight size={14}/></a>}</header>
    <main id="experiment-main"><section className="og-experiment-header"><div><span className="og-eyebrow">Declare. Report. Challenge.</span><h1>A record of reported outcomes.</h1><p>Register exact simulation inputs, then append results, failures or interruptions. Public declarations are author reported, with execution disabled.</p></div>{authenticated ? <button className="og-button og-primary" disabled={!canWrite} onClick={() => open('register')}><Plus size={14}/>Register experiment</button> : <a className="og-button og-primary" href={signIn} target="_top">Sign in to contribute<ArrowRight size={14}/></a>}</section>
    <div className="og-experiment-layout">
      <section className="og-experiment-panel" aria-label="Public experiment feed"><div className="og-experiment-toolbar"><h2>Experiment manifests</h2><button className="og-button og-secondary" disabled={!canNavigate || loading} onClick={() => void load(pageCursor)} aria-label="Refresh experiments"><RefreshCw size={13}/>Refresh</button></div>
        {(identityError || authLost) && <p className="og-experiment-session" role="status">{authLost ? 'Signed-in session unavailable. Private drafts and pending operations cleared.' : identityError} <a href={signIn} target="_top">Sign in</a></p>}
        {boardError ? <p className="og-experiment-message" role="alert">{boardError}</p> : loading ? <p className="og-experiment-session" role="status">Loading public manifests…</p> : !items.length ? <div className="og-experiment-empty"><FlaskConical size={25}/><h3>No experiment manifests yet</h3><p>Register a visible Strategy Hub definition with exact Demo inputs. No returns or independent evidence are implied.</p></div> : <div className="og-experiment-list">{items.map(item => <SummaryCard key={item.id} item={item} selected={selected?.id === item.id} localHeld={knownChildUnavailable(item.id)} disabled={!canNavigate || detailBusy || knownChildUnavailable(item.id)} onSelect={() => void choose(item)}/>)}</div>}
        <div className="og-experiment-pagination">{pageCursor ? <button className="og-button og-secondary" disabled={!canNavigate || loading} onClick={() => void load()}>First manifests</button> : <span/>}{cursor && <button className="og-button og-secondary" disabled={!canNavigate || loading} onClick={() => void load(cursor)}>Next manifests<ArrowRight size={12}/></button>}</div>
      </section>
      <section className="og-experiment-panel og-experiment-detail" aria-label="Exact experiment details">
        {detailBusy && <p role="status">Loading exact public record…</p>}{detailError && <p className="og-experiment-message" role="alert">{detailError}</p>}
        {!selected && !detailBusy ? <div className="og-experiment-empty"><FlaskConical size={25}/><h3>Inspect an exact experiment</h3><p>Open a manifest to see its immutable inputs, disclosures and complete paginated outcome history.</p></div> : selected && <>
          <span className="og-experiment-pill">{selected.record ? 'AUTHOR_REPORTED' : selected.state}</span><h2>{manifest?.content.name ?? 'Unavailable manifest'}</h2><Attribution item={selected}/><a href={experimentHref(selected)} aria-label="Exact manifest permalink" onClick={event => { if (s.current.pending || reviewLock.current || view.current.form || s.current.locked || s.current.working || local.current.working) event.preventDefault(); }}>Exact permalink</a><p className="og-experiment-reference">ID {selected.id}<br/>Digest {selected.digest}</p>
          {!manifest ? <p>Content is unavailable. {selected.suppression ? 'The source or parent is unavailable.' : 'Only its public metadata remains.'}</p> : <>
            <p>{manifest.content.input.hypothesis}</p><div className="og-experiment-caution"><p>Registration timestamp records this declaration. It does not prove unseen data, prior execution order, actual source execution or independent validation.</p><p>{(manifest.version === 2 ? manifest.content.input.config.provenance : manifest.content.input.dataset.provenance) === 'SYNTHETIC' ? 'SYNTHETIC data · simulated results are not market evidence.' : 'Supplied data · permission and provenance are author statements.'}</p></div>
            <p>{selected.outcomeCount} retained outcome{selected.outcomeCount === 1 ? '' : 's'} · {selected.reporting === 'UNREPORTED' ? 'UNREPORTED — no result submitted' : 'AUTHOR_REPORTED — no independent qualification'}</p>
            <Cautions values={manifest.flags}/><details className="og-experiment-disclosures"><summary>Inputs, source and disclosures</summary><ManifestDisclosure record={manifest}/></details>
            <div className="og-experiment-card-actions"><button className="og-button og-secondary" disabled={!canNavigate || detailBusy || outcomeBusy} onClick={() => exportValue(manifest.content.input, `opengrail-request-${manifest.id}.json`)}><Download size={12}/>Export exact request</button><button className="og-button og-secondary" disabled={!canNavigate || detailBusy || outcomeBusy} onClick={() => exportValue(manifest, `opengrail-manifest-${manifest.id}.json`)}>Export manifest</button></div>
            {manifest.version === 1 && <><section className="og-experiment-local" aria-label="Run the selected experiment locally"><h3>Run this experiment</h3><p>Compute the registered input with the pinned primary engine and reference comparison. Costs and losses remain visible; no outcome is published automatically.</p><label className="og-experiment-check"><input type="checkbox" aria-label="Confirm local experiment input rights" checked={localRights} disabled={!canNavigate || detailBusy || outcomeBusy} onChange={event => { if (localAvailable() && view.current.selected === selected && view.current.localRights === localRights) { view.current.localRights = event.target.checked; setLocalRights(event.target.checked); } }}/><span>I may use these public inputs locally. Supplied data and matching calculations do not establish unseen data, independent research or future returns.</span></label><div className="og-experiment-card-actions"><button className="og-button og-primary" disabled={!canNavigate || detailBusy || outcomeBusy || !localRights || localRuns.length >= experimentRunLimits.attempts} onClick={() => void runSelectedManifest()}><Play size={12}/>Run locally</button>{localBusy && <button className="og-button og-secondary" onClick={cancelLocalRun}>Cancel local confirmation</button>}</div><p>Browser only · AUTHOR_REPORTED · qualification NONE · independence NOT_ESTABLISHED.</p></section>
            <details className="og-experiment-split"><summary>Chronological training / test split</summary><div className="og-experiment-split-body"><p>Freeze two cold-start declarations from these already available inputs. Register each child separately, then use the existing local runner. This is not evidence of an unseen holdout.</p><div className="og-experiment-field-grid"><label>Training bars<input aria-label="Training bars" type="number" min={2} max={manifest.content.input.dataset.bars.length - 2} value={trainingBars} disabled={!canNavigate || detailBusy || outcomeBusy} onChange={event => { if (localAvailable() && view.current.selected === selected) { view.current.trainingBars = event.target.value; view.current.splitConsent = false; setTrainingBars(event.target.value); setSplitConsent(false); } }}/></label><label>Excluded gap bars<input aria-label="Excluded gap bars" type="number" min={0} max={manifest.content.input.dataset.bars.length - 4} value={gapBars} disabled={!canNavigate || detailBusy || outcomeBusy} onChange={event => { if (localAvailable() && view.current.selected === selected) { view.current.gapBars = event.target.value; view.current.splitConsent = false; setGapBars(event.target.value); setSplitConsent(false); } }}/></label></div><SplitPreview input={manifest.content.input} training={trainingBars} gap={gapBars}/><label className="og-experiment-check"><input type="checkbox" aria-label="Confirm chronological split review" checked={splitConsent} disabled={!canNavigate || detailBusy || outcomeBusy} onChange={event => { if (localAvailable() && view.current.selected === selected) { view.current.splitConsent = event.target.checked; setSplitConsent(event.target.checked); } }}/><span>I may use the inputs locally and reviewed the split. Each partition resets capital, risk state and indicator warmup; the fixed replay may liquidate at its own final bar. The full original data were already supplied or public.</span></label><div className="og-experiment-card-actions"><button className="og-button og-secondary" disabled={!canNavigate || detailBusy || outcomeBusy || !splitConsent || plans.length >= chronologicalPlanLimits.plans} onClick={() => void freezeSplit()}>Freeze local split plan</button>{localBusy && <button className="og-button og-secondary" onClick={cancelLocalRun}>Cancel local confirmation</button>}</div></div></details></>}
            {manifest.version === 2 && <p className="og-experiment-caution">CONTINUOUS_DEMO · complete retrospective event tape. Open inventory remains open; no batch baseline or end liquidation is applied. Report its exact artifact, then use Check reported outcome for fixed same-kernel reconstruction.</p>}
          </>}
          {localMessage && <p className="og-experiment-message" role="status">{localMessage}</p>}
          <div className="og-experiment-card-actions">{manifest && <button className="og-button og-primary" disabled={!canWrite} onClick={() => open('outcome')}>Report outcome<Plus size={12}/></button>}{authenticated && sponsored(selected) && selected.state !== 'WITHDRAWN' && <button className="og-button og-secondary" disabled={!canWrite} onClick={() => open('withdraw', selected)}>Withdraw</button>}{manifest && <button className="og-button og-secondary" disabled={!canWrite} onClick={() => open('report', selected)}>Flag privately</button>}</div>
          {selected.type === 'MANIFEST' && <section className="og-experiment-outcomes" aria-label="Complete paginated outcome history"><div className="og-experiment-toolbar"><h2>Outcome history</h2><button className="og-button og-secondary" disabled={!canNavigate || outcomeBusy || detailBusy} onClick={() => void loadOutcomes(selected, outcomePage)} aria-label="Refresh outcome history"><RefreshCw size={12}/></button></div>
            {outcomeError ? <p role="alert" className="og-experiment-message">{outcomeError}</p> : outcomeBusy ? <p role="status">Loading outcomes…</p> : !outcomes.length ? <p>No reported outcomes on this page. Unreported is not a successful result.</p> : <div className="og-experiment-list">{outcomes.map(item => <SummaryCard key={item.id} item={item} selected={outcome?.id === item.id} disabled={!canNavigate || detailBusy} onSelect={() => void choose(item)}/>)}</div>}
            <div className="og-experiment-pagination">{outcomePage ? <button className="og-button og-secondary" disabled={!canNavigate || outcomeBusy} onClick={() => void loadOutcomes(selected)}>First outcomes</button> : <span/>}{outcomeCursor && <button className="og-button og-secondary" disabled={!canNavigate || outcomeBusy} onClick={() => void loadOutcomes(selected, outcomeCursor)}>Next outcomes<ArrowRight size={12}/></button>}</div>
            {outcome && <><a href={experimentHref(outcome)} aria-label="Exact outcome permalink" onClick={event => { if (s.current.pending || reviewLock.current || view.current.form || s.current.locked || s.current.working || local.current.working) event.preventDefault(); }}>Exact permalink</a><OutcomeDetail item={outcome} disabled={!canNavigate || detailBusy || outcomeBusy} canWrite={canWrite} sponsored={sponsored(outcome)} onExport={(value, name) => exportValue(value, name)} onReport={() => open('report', outcome)} onWithdraw={() => open('withdraw', outcome)} onReproduce={() => open('outcome', outcome, 'REPRODUCTION')} onConflict={() => open('outcome', outcome, 'CONFLICTING')}/>{!outcomeBusy && <ExperimentReviews key={outcome.id + outcome.digest} original={outcome} signedIn={signedIn && !authLost} blocked={!!form || busy || uncertain || workBusy || localBusy || detailBusy || outcomeBusy} onBusyChange={value => { reviewLock.current = value; setReviewBusy(value); }} exactReview={selection?.review && selection.reviewDigest ? {id: selection.review, digest: selection.reviewDigest} : null} onUnavailable={() => {
              redactLocalRuns({manifestId: selected.id, sourceId: selected.strategy.id});
              const suppress = (row: Item): Item => ({...row, state: row.state === 'WITHDRAWN' ? 'WITHDRAWN' : 'HIDDEN', suppression: row.suppression ?? (row.type === 'MANIFEST' ? 'SOURCE_UNAVAILABLE' : 'PARENT_UNAVAILABLE'), record: null});
              view.current.selected = suppress(selected); setSelected(view.current.selected); if (view.current.outcome) { view.current.outcome = suppress(view.current.outcome); setOutcome(view.current.outcome); }
              view.current.items = view.current.items.map(row => same(row.strategy, selected.strategy) ? {...row, state: row.state === 'WITHDRAWN' ? 'WITHDRAWN' : 'HIDDEN', suppression: row.suppression ?? 'SOURCE_UNAVAILABLE', name: null, flags: [], status: null} : row); setItems(view.current.items);
              view.current.outcomes = view.current.outcomes.map(row => ({...row, state: row.state === 'WITHDRAWN' ? 'WITHDRAWN' : 'HIDDEN', suppression: row.suppression ?? 'PARENT_UNAVAILABLE', name: null, flags: [], status: null})); setOutcomes(view.current.outcomes);
            }}/>}</>}</section>}
        </>}
      </section>
      {plans.length > 0 && <section className="og-experiment-plans" aria-label="Retained chronological plan history"><div className="og-experiment-toolbar"><div><h2>Chronological plans · {plans.length}/{chronologicalPlanLimits.plans}</h2><p>Each partition needs its own explicit registration; the two writes are not atomic.</p></div><button className="og-button og-secondary" disabled={!canNavigate || detailBusy || outcomeBusy} onClick={() => void exportSplitHistory()}><Download size={12}/>Export plan history</button></div><div className="og-experiment-run-list">{plans.map(entry => <PlanCard key={entry.id} entry={entry} attempts={localRuns.filter(value => value.split?.planId === entry.id)} blocked={!canNavigate || detailBusy || outcomeBusy} canWrite={canWrite} onPrepare={partition => void prepareSplitChild(entry, partition)} onInspect={partition => void inspectSplitChild(entry, partition)}/>)}</div><p>Page memory only · four retained slots, including failed and interrupted plans. Changing the split creates a new plan. Child manifests consume separate registration quotas and retain separate public histories. Original lineage is locally checked; the registry does not automatically suppress child records when an original manifest is hidden. Export plans and local attempts before leaving.</p></section>}
      <section className="og-experiment-runs" aria-label="Complete local experiment run history"><div className="og-experiment-toolbar"><div><h2>Local attempts · {localRuns.length}/{experimentRunLimits.attempts}</h2><p>Every admitted attempt and preflight failure on this page stays in history.</p></div><button className="og-button og-secondary" disabled={!canNavigate || detailBusy || outcomeBusy || !localRuns.length} onClick={() => void exportLocalHistory()}><Download size={12}/>Export local history</button></div>{localExportError && <p className="og-experiment-message" role="alert">{localExportError}</p>}{!selected && localMessage && <p className="og-experiment-message" role="status">{localMessage}</p>}{!localRuns.length ? <p className="og-experiment-runs-empty">No local attempt yet. Open a manifest and confirm local use to run its exact inputs.</p> : <div className="og-experiment-run-list">{localRuns.map(attempt => <LocalRunCard key={attempt.id} attempt={attempt} blocked={!canNavigate || detailBusy || outcomeBusy} canPrepare={canWrite && !!selected?.record && same(attempt.manifest, {id: selected.id, digest: selected.digest})} onPrepare={() => void prepareLocalOutcome(attempt)} onExport={() => void exportLocalAttempt(attempt)} onComparison={() => void exportLocalAttempt(attempt, true)}/>)}</div>}<p>Page-memory history · 16 attempts and 32 MiB maximum, with 10 MiB reserved before each new run. Export before leaving. Capacity blocks new work without removing losses or failed attempts. This records work admitted here, not a complete external search history. Local comparisons are not published or independently qualified.</p></section>
    </div></main><footer className="og-footer"><span>Public declarations. No financial execution.</span><a href="/experiment-policy">Experiment policy</a></footer>
    <Dialog open={!!form} onOpenChange={value => { if (!value) close(); }}><DialogContent className="og-dialog og-experiment-dialog" showCloseButton={false}><DialogHeader><DialogTitle>{form?.action === 'register' ? 'Register an experiment' : form?.action === 'outcome' ? 'Append an outcome' : form?.action === 'withdraw' ? 'Withdraw public content' : 'Flag a record privately'}</DialogTitle><DialogDescription>{form?.action === 'register' ? 'An immutable public declaration, followed by separate outcome reports.' : form?.action === 'outcome' ? 'Preserve the actual result, including failure or interruption.' : form?.action === 'withdraw' ? 'Withdrawal is irreversible. Metadata remains; dependent content is suppressed.' : 'Details are retained for moderators and are not published.'}</DialogDescription></DialogHeader>
      <button className="og-dialog-close" aria-label="Close experiment form" disabled={blocked} onClick={close}><X size={17}/></button>
      {receipt ? <div className="og-experiment-success" role="status"><Check size={25}/><h3>{receipt.action === 'report' ? 'Private flag recorded' : receipt.action === 'withdraw' ? 'Content withdrawn' : receipt.item?.record ? receipt.action === 'register' ? 'Manifest registered' : 'Outcome appended' : 'Operation acknowledged; content unavailable'}</h3><p>{receipt.action === 'register' ? 'The server timestamp records registration only. Any later outcome remains author reported.' : receipt.action === 'report' ? 'Your private details are not part of public history.' : 'Refresh to inspect current public visibility.'}</p><code>{receipt.item?.id ?? receipt.report?.id}</code>{receipt.action === 'register' && receipt.item?.record?.version === 2 && fields.bundle && <button className="og-button og-primary" disabled={workBusy} onClick={() => void prepareCapturedOutcome()}>Prepare captured outcome</button>}<button className="og-button og-primary" onClick={done}>Done</button></div> : form && <form className="og-experiment-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        {form.action === 'register' && <><div className="og-experiment-steps" aria-label="Registration steps"><span aria-current={fields.step === 1 ? 'step' : undefined}>1 · Inputs</span><span aria-current={fields.step === 2 ? 'step' : undefined}>2 · Disclosures</span><span aria-current={fields.step === 3 ? 'step' : undefined}>3 · Public sharing</span></div>
          {form.split && <div className="og-experiment-caution og-experiment-plan-form-note"><p>Frozen {form.split.partition === 'TRAIN' ? 'training' : 'test'} child. Inputs and disclosures cannot change in this form; a changed split needs a new plan. Review each step and confirm sharing yourself.</p><code>Plan {form.split.planId}<br/>Child {form.runIds?.id}<br/>Request {form.runIds?.requestId}</code><p>Registration is separate from the other partition and proves neither execution order nor untouched data. The registry retains this child independently of the original manifest.</p></div>}
          {fields.step === 1 && <><label>Experiment name<input aria-label="Experiment name" maxLength={120} value={fields.name} disabled={blocked || !!form.split} onChange={event => change({name: event.target.value})}/></label><label>Exact request or continuous review bundle JSON<textarea className="og-experiment-json" aria-label="Experiment request JSON" rows={10} value={fields.json} disabled={blocked || !!form.split} onChange={event => change({json: event.target.value})}/></label><label>Import request file<input type="file" aria-label="Import experiment request" accept=".json,application/json" disabled={blocked || !!form.split} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importFile(file); }}/></label><p>Export an exact request from Demo, or export a review bundle from Sessions, then import it here. Complete input maximum 192 KiB; bundle import maximum 768 KiB. Continuous snapshots are retrospective and include the entire retained tape. Nothing is published by import.</p></>}
          {fields.step === 2 && <><div className="og-experiment-field-grid"><label>Source revision / version<input aria-label="Evaluator source version" value={fields.sourceVersion} maxLength={80} disabled={blocked || !!form.split} onChange={event => change({sourceVersion: event.target.value})}/></label>{!(fields.input && 'kind' in fields.input) && <label>Source SHA-256 fingerprint<input aria-label="Evaluator source digest" value={fields.sourceDigest} maxLength={64} disabled={blocked || !!form.split} onChange={event => change({sourceDigest: event.target.value})}/></label>}</div><button type="button" className="og-button og-secondary" disabled={blocked || !!form.split || !fields.input} onClick={() => { if (fields.input) { if ('kind' in fields.input) change({sourceVersion: 'opengrail-session-v1 fixed source identities'}); else { const declaration = experimentRegisterDefaults(fields.input).evaluator; change({sourceVersion: declaration.sourceVersion, sourceDigest: declaration.sourceDigest}); } } }}>Use documented evaluator</button><p>Planned source declaration only. Declare the exact source you intend to use. A matching fingerprint identifies bytes; it does not prove that source ran.</p><div className="og-experiment-field-grid"><label>Total trials considered<input aria-label="Trial count" type="number" min={1} max={100000} value={fields.trialCount} disabled={blocked || !!form.split} onChange={event => change({trialCount: event.target.value})}/></label><label>Selection method<select aria-label="Selection method" value={fields.selection} disabled={blocked || !!form.split} onChange={event => change({selection: event.target.value as Fields['selection']})}><option value="FIRST_DECLARED">First declared trial</option><option value="BEST_OBSERVED">Best observed after search</option><option value="OTHER">Other / unspecified</option></select></label></div><label>Search log completeness<select aria-label="Search log completeness" value={fields.logCompleteness} disabled={blocked || !!form.split} onChange={event => change({logCompleteness: event.target.value as Fields['logCompleteness']})}><option value="UNAVAILABLE">Unavailable</option><option value="PARTIAL">Partial</option><option value="COMPLETE">Complete</option></select></label><label>Search history<textarea aria-label="Search history" rows={3} value={fields.log} maxLength={4000} disabled={blocked || !!form.split} onChange={event => change({log: event.target.value})}/></label><details className="og-experiment-disclosures"><summary>Holdout and training overlap</summary><label>Training / evaluation overlap<select aria-label="Training evaluation overlap" value={fields.overlap} disabled={blocked || !!form.split} onChange={event => change({overlap: event.target.value as Fields['overlap']})}><option value="UNKNOWN">Unknown</option><option value="PRESENT">Present</option><option value="NONE">None declared</option></select></label><label className="og-experiment-check"><input aria-label="Declare holdout" type="checkbox" checked={fields.holdout} disabled={blocked || !!form.split} onChange={event => change({holdout: event.target.checked})}/>A holdout has been declared.</label><div className="og-experiment-field-grid"><label>Prior holdout access<select aria-label="Prior holdout access" value={fields.access} disabled={blocked || !!form.split} onChange={event => change({access: event.target.value as Fields['access']})}><option value="UNKNOWN">Unknown</option><option value="SEEN">Previously seen</option><option value="UNSEEN">Declared unseen</option></select></label><label>Holdout reuse count<input aria-label="Holdout reuse count" type="number" min={0} max={100000} value={fields.reuse} disabled={blocked || !!form.split} onChange={event => change({reuse: event.target.value})}/></label></div><label>Validation notes<textarea aria-label="Validation notes" rows={2} value={fields.validationNote} maxLength={1500} disabled={blocked || !!form.split} onChange={event => change({validationNote: event.target.value})}/></label></details><details className="og-experiment-disclosures"><summary>Transformations, seeds and shared dependencies</summary><label>Transformations · one per line<textarea aria-label="Transformations" rows={2} value={fields.transformations} disabled={blocked || !!form.split} onChange={event => change({transformations: event.target.value})}/></label><label>Seeds · one integer per line<textarea aria-label="Seeds" rows={2} value={fields.seeds} disabled={blocked || !!form.split} onChange={event => change({seeds: event.target.value})}/></label><DependencyFields fields={fields} disabled={blocked || !!form.split} change={change}/></details></>}
          {fields.step === 3 && <><div className="og-experiment-caution"><p>Registering publishes the complete request, dataset, signals, source fingerprints, disclosures and pseudonymous authorship / sponsor. Future artifacts must be explicitly public. Retained metadata cannot be erased by withdrawal.</p><p>Registration does not prove unseen data or execution timing. Search and holdout statements remain your declarations.</p></div>{fields.input && 'kind' in fields.input ? <p>Retrospective continuous snapshot: source labels, bars, quotes, signals, controls, original receipt times and open inventory are public. No batch baseline or independent execution proof is implied.</p> : <p>Cost-aware long baseline · same initial allocation. Short or failed results may be noncomparable.</p>}</>}
        </>}
        {form.action === 'outcome' && <>{form.localAttemptId && <div className="og-experiment-caution"><p>Prepared from a new local attempt. The retained run stays unchanged; edited fields are your author report. Review the complete result and all sharing statements before publishing. The comparison sidecar remains local.</p></div>}<p>{form.claim === 'ORIGINAL' ? 'Original report · any signed-in participant may report; this does not imply manifest ownership.' : `${form.claim === 'REPRODUCTION' ? 'Declared reproduction supporting' : 'Conflicting report challenging'} exact outcome ${form.relation?.id}. Agreement and shared sponsorship do not establish independence.`}</p><p className="og-experiment-reference">Manifest {form.parent?.id}<br/>Digest {form.parent?.digest}</p><label>Outcome name<input aria-label="Outcome name" maxLength={120} value={fields.name} disabled={blocked} onChange={event => change({name: event.target.value})}/></label><label>Outcome type<select aria-label="Outcome type" value={fields.resultKind} disabled={blocked} onChange={event => change({resultKind: event.target.value as Fields['resultKind'], json: '', details: ''})}><option value="ARTIFACT">Complete Demo artifact</option><option value="INTERRUPTED">Interrupted</option><option value="ARTIFACT_UNAVAILABLE">Artifact unavailable</option></select></label>{fields.resultKind === 'ARTIFACT' ? <><label>Complete artifact JSON<textarea className="og-experiment-json" aria-label="Outcome artifact JSON" rows={8} value={fields.json} disabled={blocked} onChange={event => change({json: event.target.value})}/></label><label>Import artifact file<input aria-label="Import outcome artifact" type="file" accept=".json,application/json" disabled={blocked} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importFile(file); }}/></label><p>Maximum 512 KiB; exact registered input and intact hashes required. No replay or independent validation occurs during reporting. Keep the complete artifact; use Artifact unavailable if it cannot fit.</p></> : <label>What happened?<textarea aria-label="Outcome explanation" rows={4} maxLength={2000} value={fields.details} disabled={blocked} onChange={event => change({details: event.target.value})}/></label>}<details className="og-experiment-disclosures"><summary>Shared dependencies and conflicts</summary><DependencyFields fields={fields} disabled={blocked} change={change}/></details><p>The full result and public author / sponsor attribution are retained. Interrupted and unavailable results contain no performance metrics.</p></>}
        {form.action === 'withdraw' && <><p className="og-experiment-reference">Record {form.target?.id}</p><label>Reason<select aria-label="Withdrawal reason" value={fields.reason} disabled={blocked} onChange={event => change({reason: event.target.value})}><option value="AUTHOR_REQUEST">Author request</option><option value="SPONSOR_REQUEST">Sponsor request</option><option value="PERSONAL_DATA">Personal data</option><option value="CREDENTIAL_EXPOSURE">Credential exposure</option></select></label></>}
        {form.action === 'report' && <><label>Reason<select aria-label="Private flag reason" value={fields.reason} disabled={blocked} onChange={event => change({reason: event.target.value})}><option value="OTHER">Other</option><option value="SPAM">Spam</option><option value="ABUSE">Abuse</option><option value="PERSONAL_DATA">Personal data</option><option value="CREDENTIAL_EXPOSURE">Credential exposure</option><option value="MISLEADING">Misleading</option></select></label><label>Private details<textarea aria-label="Private flag details" value={fields.details} maxLength={1500} rows={4} disabled={blocked} onChange={event => change({details: event.target.value})}/></label><p>Describe the concern without including secrets. Report details are private to authorized moderators.</p></>}
        {(form.action !== 'register' || fields.step === 3) && <>
          {(form.action === 'register' || form.action === 'outcome') && <><Consent label="Confirm data rights" checked={fields.dataRights} disabled={blocked} onChange={value => change({dataRights: value}, false)}>I have permission to share all included data and content publicly.</Consent><Consent label="Confirm public data sharing" checked={fields.publicData} disabled={blocked} onChange={value => change({publicData: value}, false)}>The complete inputs, datasets, source labels, bars, quotes, signals, controls, receipt times and disclosures may be public. I included no private data, credentials or secrets.</Consent><Consent label="Confirm public artifact sharing" checked={fields.publicArtifact} disabled={blocked} onChange={value => change({publicArtifact: value}, false)}>Complete artifacts and pseudonymous authorship / sponsorship may be public and retained. Withdrawal leaves metadata.</Consent></>}
          <Consent label="Accept experiment policy" checked={fields.consent} disabled={blocked} onChange={value => change({consent: value}, false)}>I agree to the <a href="/experiment-policy" target="_blank" rel="noopener noreferrer">experiment policy</a>{form.action === 'withdraw' ? ' and irreversible withdrawal.' : '.'}</Consent>
        </>}
        {formError && <p className="og-experiment-message" role="alert">{formError}</p>}
        {uncertain ? <button type="button" className="og-button og-primary" disabled={busy} onClick={retry}>Retry identical request</button> : <div className="og-experiment-card-actions">{form.action === 'register' && fields.step > 1 && <button type="button" className="og-button og-secondary" disabled={blocked} onClick={() => change({step: fields.step - 1}, false)}>Back</button>}{form.action === 'register' && fields.step < 3 ? <button type="button" className="og-button og-primary" disabled={blocked} onClick={() => void nextStep()}>{workBusy ? 'Checking exact inputs…' : 'Continue'}<ArrowRight size={12}/></button> : <button type="submit" className="og-button og-primary" disabled={blocked}>{busy || workBusy ? 'Submitting…' : form.action === 'register' ? 'Register public manifest' : form.action === 'outcome' ? 'Append public outcome' : form.action === 'withdraw' ? 'Withdraw permanently' : 'Send private flag'}</button>}</div>}
      </form>}
    </DialogContent></Dialog>
  </div>;
}

function LocalRunCard({attempt, blocked, canPrepare, onPrepare, onExport, onComparison}: {attempt: LocalAttempt; blocked: boolean; canPrepare: boolean; onPrepare: () => void; onExport: () => void; onComparison: () => void}) {
  const held = attempt.run, run = attempt.confirmed ? held : null, artifact = run?.artifact, report = run?.comparison, metrics = artifact?.metrics, unit = artifact?.input?.dataset.symbol.split('/')[1] ?? 'quote units';
  const pending = ['CHECKING', 'RUNNING'].includes(attempt.status) || held?.status === 'RUNNING';
  return <article className="og-experiment-run" aria-label={`Local experiment attempt ${attempt.id}`} data-status={attempt.status}><div className="og-experiment-card-head"><span className="og-experiment-pill">{attempt.status === 'CHECKING' ? 'PREFLIGHT' : attempt.status}</span><span className="og-experiment-pill og-experiment-pill-muted">AUTHOR_REPORTED</span></div><h3>{run?.captured.manifest.record?.content.name ?? 'Retained local attempt'}</h3><p className="og-experiment-reference">Attempt {attempt.id}<br/>Manifest {attempt.manifest.id}<br/>Digest {attempt.manifest.digest}</p><p>Started locally {stamp(attempt.at)}. {attempt.status === 'CHECKING' ? 'Current public inputs have not yet been admitted.' : run ? `Primary ${artifact?.status ?? 'not completed'} · comparison ${report?.status ?? 'not completed'}.` : 'No available confirmed canonical run.'}</p>{attempt.error && <p>{attempt.error}</p>}{held && !attempt.confirmed && !attempt.cleared && <p>Canonical evidence retained; current visibility confirmation is incomplete. Export or prepare after a fresh check to inspect the result.</p>}{run && !attempt.cleared && <>{metrics ? <><dl className="og-experiment-metrics"><div><dt>Simulated net return</dt><dd className={metrics.returnPct < 0 ? 'og-experiment-negative' : metrics.returnPct > 0 ? 'og-experiment-positive' : ''}>{metrics.returnPct.toFixed(2)}%</dd></div><div><dt>Max drawdown</dt><dd>{metrics.maxDrawdownPct.toFixed(2)}%</dd></div><div><dt>Net P&amp;L</dt><dd>{metrics.netPnl.toFixed(2)} {unit}</dd></div><div><dt>Trades / fees</dt><dd>{metrics.trades} / {metrics.totalFees.toFixed(2)}</dd></div></dl><p>{metrics.comparable ? 'Exact submitted input and declared costs; simulated figures only.' : 'Noncomparable result. Adverse losses remain uncapped; no favorable benchmark claim is made.'}</p></> : <p>No performance metrics confirmed.</p>}{report && <details><summary>Three-pair comparison · {report.status}</summary><div className="og-experiment-run-pairs">{report.pairs.map(pair => <span key={pair.pair}>{pair.pair} · {pair.matches ? 'MATCH' : 'MISMATCH'} · {pair.differenceCount} differences{pair.differences.slice(0, 4).map((difference, index) => <span key={index}><br/>{difference.path} · {difference.kind} · {String(difference.left)} / {String(difference.right)}</span>)}</span>)}</div><p>Shared method, runtime, schemas, data, operator and primary-source review limit independence. Agreement checks these calculations; it does not reproduce a historical publication or qualify a strategy.</p><p className="og-experiment-reference">Primary engine source {report.implementations.primary.sourceSha256}<br/>Reference engine source {report.implementations.reference.sourceSha256}<br/>Comparison {report.reportDigest}</p></details>}{artifact && new TextEncoder().encode(JSON.stringify(artifact)).byteLength > experimentLimits.artifactBytes && <p className="og-experiment-caution">The full local artifact exceeds the 512 KiB registry allowance. Preserve the complete local export; an Artifact unavailable report will contain no metrics.</p>}<p>qualification NONE · independence NOT_ESTABLISHED · orders disabled. {run.status === 'INTERRUPTED' && 'Cancelled partial evidence is not a completed evaluation.'}</p></>}{!attempt.cleared && <div className="og-experiment-card-actions">{held && !pending && <button className="og-button og-secondary" disabled={blocked} onClick={onExport}>Export local run</button>}{held?.comparison && !pending && <button className="og-button og-secondary" disabled={blocked} onClick={onComparison}>Export comparison</button>}<button className="og-button og-primary" disabled={blocked || !canPrepare || pending} onClick={onPrepare}>Prepare outcome draft</button></div>}</article>;
}
function SplitPreview({input, training, gap}: {input: DemoRequest; training: string; gap: string}) {
  const n = /^\d+$/.test(training) ? Number(training) : NaN, g = /^\d+$/.test(gap) ? Number(gap) : NaN, bars = input.dataset.bars;
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(g) || n < 2 || g < 0 || n + g > bars.length - 2) return <p>Choose at least two training bars and two test bars, with a nonnegative excluded gap. Blank values are invalid.</p>;
  return <><div className="og-experiment-split-intervals"><div><strong>Training · {n} bars</strong><p>{stamp(bars[0].closedAt)} → {stamp(bars[n - 1].closedAt)}</p></div><div><strong>Test · {bars.length - n - g} bars</strong><p>{stamp(bars[n + g].closedAt)} → {stamp(bars.at(-1)!.closedAt)}</p></div></div><p>{g} gap bars excluded. Signals must be observed and available within the same partition; exclusions and emergency timing are recorded in the frozen plan. Both partitions use {input.initialCapital} {input.dataset.symbol.split('/')[1]} initial capital independently; returns are not concatenated.</p></>;
}
function PlanCard({entry, attempts, blocked, canWrite, onPrepare, onInspect}: {entry: PlanEntry; attempts: LocalAttempt[]; blocked: boolean; canWrite: boolean; onPrepare: (partition: Partition) => void; onInspect: (partition: Partition) => void}) {
  const plan = entry.cleared ? null : entry.plan;
  return <article className="og-experiment-plan" aria-label={`Chronological plan ${entry.id}`} data-status={entry.status}><div className="og-experiment-card-head"><span className="og-experiment-pill">{entry.status === 'CHECKING' ? 'PREFLIGHT' : entry.status}</span><span className="og-experiment-pill og-experiment-pill-muted">AUTHOR_REPORTED</span></div><h3>{plan ? 'Frozen chronological split' : 'Retained plan metadata'}</h3><p className="og-experiment-reference">Plan {entry.id}<br/>Original manifest {entry.parent.id}<br/>Digest {entry.parent.digest}</p><p>Local declaration {stamp(entry.at)}. Requested training {entry.requested.trainingBars ?? 'UNKNOWN'} / gap {entry.requested.excludedGapBars ?? 'UNKNOWN'} bars. qualification NONE · unseen NOT_ESTABLISHED.</p>{entry.error && <p>{entry.error}</p>}{plan && <><p>Separate cold starts with reset capital, risk and warmup. The full original data were already available. This does not establish execution chronology or an untouched holdout.</p><div className="og-experiment-plan-partitions">{(['TRAIN', 'TEST'] as const).map(partition => { const child = plan.children[partition], registered = entry.children[partition], trials = attempts.filter(value => value.split?.partition === partition); return <section key={partition} aria-label={`${partition} partition ${entry.id}`}><h4>{partition === 'TRAIN' ? 'Training' : 'Test'} · {registered ? 'REGISTERED' : 'NOT REGISTERED'}</h4><p>{child.range.barCount} bars · {child.range.signalCount} signals<br/>{stamp(child.range.firstOpenAt)} → {stamp(child.range.lastClosedAt)}<br/>Emergency: {child.emergency.reason.replaceAll('_', ' ')}{child.emergency.mappedAt ? ' · ' + stamp(child.emergency.mappedAt) : ''}</p><p className="og-experiment-reference">Child {child.command.id}<br/>Input {child.inputDigest}{registered && <><br/>Registered digest {registered.digest}</>}</p><div className="og-experiment-plan-results"><p>{trials.length} retained local attempts · {((Date.parse(child.range.lastClosedAt) - Date.parse(child.range.firstOpenAt)) / 3_600_000).toFixed(1)} hour sample</p>{trials.map(value => { const metrics = value.confirmed && !value.cleared ? value.run?.artifact?.metrics : null; return <div key={value.id} aria-label={`Partition attempt ${value.id}`}><p>{value.status} · {value.confirmed ? value.run?.artifact?.status ?? 'No complete artifact' : 'Current result unconfirmed'}</p>{metrics ? <dl className="og-experiment-metrics"><div><dt>Net P&amp;L</dt><dd className={metrics.netPnl < 0 ? 'og-experiment-negative' : metrics.netPnl > 0 ? 'og-experiment-positive' : ''}>{metrics.netPnl.toFixed(2)} {child.command.input.dataset.symbol.split('/')[1]}</dd></div><div><dt>Net return</dt><dd className={metrics.returnPct < 0 ? 'og-experiment-negative' : metrics.returnPct > 0 ? 'og-experiment-positive' : ''}>{metrics.returnPct.toFixed(2)}%</dd></div><div><dt>Max drawdown</dt><dd>{metrics.maxDrawdownPct.toFixed(2)}%</dd></div><div><dt>Trades</dt><dd>{metrics.trades}</dd></div></dl> : <p>No confirmed performance metrics.</p>}</div>; })}</div><div className="og-experiment-card-actions">{registered ? <button className="og-button og-secondary" disabled={blocked} onClick={() => onInspect(partition)} aria-label={`Inspect ${partition} child ${entry.id}`}>Open registered {partition === 'TRAIN' ? 'training' : 'test'}</button> : <button className="og-button og-primary" disabled={blocked || !canWrite} onClick={() => onPrepare(partition)} aria-label={`Prepare ${partition} registration ${entry.id}`}>Prepare {partition === 'TRAIN' ? 'training' : 'test'} registration</button>}</div></section>; })}</div><details><summary>Excluded data and exact plan identity</summary><p>{plan.excluded.bars.length} bars and {plan.excluded.signals.length} signals excluded. A signal crossing an availability boundary is not moved to the other partition.</p>{plan.excluded.signals.map(value => <p className="og-experiment-reference" key={value.id}>{value.id} · {value.reason.replaceAll('_', ' ')}</p>)}<p className="og-experiment-reference">Plan digest {plan.planDigest}</p><p>Parent search, selection, reuse and conflicts remain retained. Claimed UNSEEN access becomes UNKNOWN; declared SEEN remains SEEN. Complete prior logs become PARTIAL for these new trials.</p></details></>}</article>;
}
function Consent({label, checked, disabled, onChange, children}: {label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void; children: React.ReactNode}) { return <label className="og-experiment-check"><input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/><span>{children}</span></label>; }
function DependencyFields({fields, disabled, change}: {fields: Fields; disabled: boolean; change: (changes: Partial<Fields>) => void}) { return <><label>Shared dependencies · one per line<textarea aria-label="Shared dependencies" rows={2} value={fields.dependencies} disabled={disabled} onChange={event => change({dependencies: event.target.value})}/></label><label>Other conflicts<textarea aria-label="Other conflicts" rows={2} maxLength={1500} value={fields.conflicts} disabled={disabled} onChange={event => change({conflicts: event.target.value})}/></label><p>Shared data, source, sponsors or other dependencies limit independence. Empty fields do not establish independence.</p></>; }
function Attribution({item}: {item: Pick<Item, 'author' | 'createdAt'>}) { return <div className="og-experiment-byline"><strong>{item.author.kind === 'HUMAN' ? 'Human' : 'Agent'} · {short(item.author.id)}</strong><span>Sponsor · {short(item.author.sponsorId)}</span><time dateTime={item.createdAt}>{stamp(item.createdAt)}</time></div>; }
function Cautions({values}: {values: ExperimentFlag[]}) { return <details className="og-experiment-disclosures"><summary>{values.length} caution flags</summary><ul>{values.map(value => <li key={value}>{flags[value]}</li>)}</ul></details>; }
function SummaryCard({item, selected, disabled, localHeld = false, onSelect}: {item: Summary; selected: boolean; disabled: boolean; localHeld?: boolean; onSelect: () => void}) { return <article className="og-experiment-card" aria-label={`Public ${item.type === 'MANIFEST' ? 'manifest' : 'outcome'} ${item.id}`} aria-current={selected}><div className="og-experiment-card-head"><span className="og-experiment-pill">{item.state !== 'VISIBLE' ? item.state : item.type === 'MANIFEST' ? item.reporting : item.status?.replaceAll('_', ' ') ?? 'AUTHOR_REPORTED'}</span>{item.state === 'VISIBLE' && <span className="og-experiment-pill og-experiment-pill-muted">AUTHOR_REPORTED</span>}</div><h3>{item.name ?? 'Content unavailable'}</h3><Attribution item={item}/>{item.state === 'VISIBLE' ? <p>{item.type === 'MANIFEST' ? `${item.outcomeCount} retained outcomes · exact inputs and disclosures` : `${item.flags.length} caution flags · no independent qualification`}</p> : <p>{item.suppression ? 'Source or parent unavailable; authored content suppressed.' : 'Metadata retained; authored content unavailable.'}</p>}{localHeld && <p>Original chronological lineage unavailable in this tab. The separately retained public child is shown as metadata only.</p>}<div className="og-experiment-card-actions"><button className="og-button og-secondary" disabled={disabled} aria-label={`Open ${item.type === 'MANIFEST' ? 'manifest' : 'outcome'} ${item.id}`} onClick={onSelect}>Inspect exact record<ArrowRight size={12}/></button></div></article>; }
function ManifestDisclosure({record}: {record: ExperimentManifest | ExperimentContinuousManifest}) {
  if (record.version === 2) {
    const {input, evaluator, disclosures: d} = record.content, strategy = input.config.strategy.record.content.definition;
    return <dl><div><dt>Continuous source / complete tape</dt><dd>{input.config.strategy.record.content.name} · {strategy.market.symbol} / {strategy.market.timeframe} · {input.events.length} retained events · {input.config.provenance} · {input.config.clockMode}<br/>Start {input.startedAt} · source label {input.config.sourceLabel}</dd></div><div><dt>Falsification</dt><dd>{input.falsification}</dd></div><div><dt>Costs / capital</dt><dd>Fee {strategy.costs.feeBps} bps / slippage {strategy.costs.slippageBps} bps per side. Capital {input.config.initialCapital} {strategy.market.symbol.split('/')[1]}. Open exposure is not liquidated at this snapshot.</dd></div><div><dt>Fixed implementation declarations</dt><dd className="og-experiment-reference">{evaluator.sourceVersion}<br/>Engine {evaluator.sourceDigests.engine}<br/>Model {evaluator.sourceDigests.model}<br/>Journal {evaluator.sourceDigests.journal}<br/>Method {evaluator.methodDigest}<br/>Original journal {input.journalDigest}</dd></div><div><dt>Search / validation declarations</dt><dd>{d.search.trialCount} trials · {d.search.selection} · log {d.search.logCompleteness}<br/>{d.search.log || 'No search log provided.'}<br/>Overlap {d.validation.trainEvaluationOverlap} · prior holdout access {d.validation.holdoutPriorAccess} · reused {d.validation.holdoutReuseCount}<br/>{d.validation.note}<br/>{d.conflicts.sharedDependencies.join('; ')}<br/>{d.conflicts.other}</dd></div></dl>;
  }
  const {input, evaluator, disclosures: d} = record.content;
  return <dl><div><dt>Strategy / dataset</dt><dd>{input.strategy.record.content.name} · {input.dataset.symbol} / {input.dataset.timeframe} · {input.dataset.bars.length} bars · {input.signals.length} signals · {input.dataset.provenance}</dd></div><div><dt>Falsification</dt><dd>{input.falsification}</dd></div><div><dt>Costs and allocation</dt><dd>{input.strategy.record.content.definition.risk.positionPct}% total allocation · fee {input.strategy.record.content.definition.costs.feeBps} bps / slippage {input.strategy.record.content.definition.costs.slippageBps} bps per side. Initial capital {input.initialCapital} {input.dataset.symbol.split('/')[1] ?? 'quote units'}.</dd></div><div><dt>Declared evaluator source</dt><dd className="og-experiment-reference">{evaluator.sourceVersion}<br/>{evaluator.sourceDigest}<br/>Method {evaluator.methodDigest}</dd></div><div><dt>Search and validation declarations</dt><dd>{d.search.trialCount} trials · {d.search.selection} · log {d.search.logCompleteness}<br/>{d.search.log || 'No search log provided.'}<br/>Overlap {d.validation.trainEvaluationOverlap} · holdout {d.validation.holdoutDeclared ? 'declared' : 'not declared'} · prior access {d.validation.holdoutPriorAccess} · reused {d.validation.holdoutReuseCount} times<br/>{d.validation.note}</dd></div><div><dt>Transformations / seeds / conflicts</dt><dd>{d.transformations.join('; ') || 'No transformations declared.'}<br/>Seeds {d.seeds.join(', ') || 'none declared'}<br/>{d.conflicts.sharedDependencies.join('; ') || 'No shared dependencies declared.'}<br/>{d.conflicts.other}</dd></div></dl>;
}
function OutcomeDetail({item, disabled, canWrite, sponsored, onExport, onReport, onWithdraw, onReproduce, onConflict}: {item: Item; disabled: boolean; canWrite: boolean; sponsored: boolean; onExport: (value: unknown, name: string) => void; onReport: () => void; onWithdraw: () => void; onReproduce: () => void; onConflict: () => void}) {
  const record = item.record?.type === 'OUTCOME' ? item.record : null;
  if (record?.version === 2) {
    const result = record.content.result, artifact = result.kind === 'ARTIFACT' ? result.artifact : null;
    return <article className="og-experiment-outcome" aria-label={`Exact outcome ${item.id}`}><span className="og-experiment-pill">CONTINUOUS_DEMO · AUTHOR_REPORTED</span><h3>{record.content.name}</h3><Attribution item={item}/><p className="og-experiment-reference">ID {item.id}<br/>Digest {item.digest}</p><p>{record.content.claim.type} · {artifact?.projection.status ?? result.kind}</p>{artifact ? <ContinuousProjection artifact={artifact}/> : <p>{result.kind !== 'ARTIFACT' ? result.reason : ''} No performance metrics reported.</p>}<p>Exact retrospective tape and checkpoint. Hash checks do not replay it or prove historical delivery. No batch baseline, independent evaluator or terminal liquidation is applied.</p><Cautions values={record.flags}/><details><summary>Claim and dependency declarations</summary><p>{record.content.claim.relation ? `${record.content.claim.relation.type} ${record.content.claim.relation.id} · ${record.content.claim.relation.digest}` : 'No related outcome.'}</p><p>{record.content.claim.sharedDependencies.join('; ') || 'No shared dependencies declared.'}</p><p>{record.content.claim.conflicts}</p></details><div className="og-experiment-card-actions"><button className="og-button og-secondary" disabled={disabled} onClick={() => onExport(record, `opengrail-outcome-${record.id}.json`)}>Export outcome</button>{artifact && <><button className="og-button og-secondary" disabled={disabled} onClick={() => onExport(artifact, `opengrail-artifact-${record.id}.json`)}>Export exact artifact</button>{!disabled && <><a className="og-button og-secondary" href={`/validation?outcome=${encodeURIComponent(item.id)}&digest=${encodeURIComponent(item.digest)}`}>Check reported outcome</a><a className="og-button og-secondary" href={`/arena?outcome=${encodeURIComponent(item.id)}&digest=${encodeURIComponent(item.digest)}`}>Compare strategies</a></>}</>}<button className="og-button og-secondary" disabled={!canWrite} onClick={onReproduce}>Report reproduction</button><button className="og-button og-secondary" disabled={!canWrite} onClick={onConflict}>Report conflict</button><button className="og-button og-secondary" disabled={!canWrite} onClick={onReport}>Flag outcome privately</button></div>{sponsored && item.state !== 'WITHDRAWN' && <button className="og-button og-secondary" disabled={!canWrite} onClick={onWithdraw}>Withdraw outcome</button>}</article>;
  }
  const result = record?.content.result, artifact = result?.kind === 'ARTIFACT' ? result.artifact : null, metrics = artifact?.metrics, unit = artifact?.input?.dataset.symbol.split('/')[1] ?? 'quote units';
  return <article className="og-experiment-outcome" aria-label={`Exact outcome ${item.id}`}><span className="og-experiment-pill">{record ? 'AUTHOR_REPORTED' : item.state}</span><h3>{record?.content.name ?? 'Outcome unavailable'}</h3><Attribution item={item}/><p className="og-experiment-reference">ID {item.id}<br/>Digest {item.digest}</p>{record ? <><p>{record.content.claim.type} · {result?.kind === 'ARTIFACT' ? artifact?.status : result?.kind}</p>{result?.kind !== 'ARTIFACT' && <p>{result?.reason}</p>}{metrics ? <><dl className="og-experiment-metrics"><div><dt>Simulated net return</dt><dd className={metrics.returnPct < 0 ? 'og-experiment-negative' : metrics.returnPct > 0 ? 'og-experiment-positive' : ''}>{metrics.returnPct.toFixed(2)}%</dd></div><div><dt>Max drawdown</dt><dd>{metrics.maxDrawdownPct.toFixed(2)}%</dd></div><div><dt>Realized fees</dt><dd>{metrics.totalFees.toFixed(2)} {unit}</dd></div><div><dt>Trades</dt><dd>{metrics.trades}</dd></div><div><dt>Net P&amp;L</dt><dd>{metrics.netPnl.toFixed(2)} {unit}</dd></div><div><dt>Final equity</dt><dd>{metrics.finalEquity.toFixed(2)} {unit}</dd></div></dl><p>{metrics.comparable ? 'Simulated figures for the exact declared inputs and costs.' : 'Noncomparable result; losses are not clipped and no benchmark claim is made.'}</p></> : <p>No performance metrics reported.</p>}{artifact?.benchmark && <p>{artifact.benchmark.comparable ? `Cost-aware long baseline: ${artifact.benchmark.returnPct.toFixed(2)}% under the same initial allocation and costs.` : 'Cost-aware long baseline is not comparable.'}</p>}<p>Hashes check retained byte consistency. Reporting does not replay the source or establish independent execution.</p><Cautions values={record.flags}/><details><summary>Claim and dependency declarations</summary><p>{record.content.claim.relation ? `${record.content.claim.relation.type} ${record.content.claim.relation.id} · ${record.content.claim.relation.digest}` : 'No related outcome.'}</p><p>{record.content.claim.sharedDependencies.join('; ') || 'No shared dependencies declared.'}</p><p>{record.content.claim.conflicts}</p></details><div className="og-experiment-card-actions"><button className="og-button og-secondary" disabled={disabled} onClick={() => onExport(record, `opengrail-outcome-${record.id}.json`)}>Export outcome</button>{artifact && <button className="og-button og-secondary" disabled={disabled} onClick={() => onExport(artifact, `opengrail-artifact-${record.id}.json`)}>Export exact artifact</button>}{artifact && !disabled && <><a className="og-button og-secondary" href={`/validation?outcome=${encodeURIComponent(item.id)}&digest=${encodeURIComponent(item.digest)}`}>Check reported outcome</a><a className="og-button og-secondary" href={`/arena?outcome=${encodeURIComponent(item.id)}&digest=${encodeURIComponent(item.digest)}`}>Compare strategies</a></>}<button className="og-button og-secondary" disabled={!canWrite} onClick={onReproduce}>Report reproduction</button><button className="og-button og-secondary" disabled={!canWrite} onClick={onConflict}>Report conflict</button><button className="og-button og-secondary" disabled={!canWrite} onClick={onReport}>Flag outcome privately</button></div></> : <p>Authored result unavailable. Metadata does not establish performance.</p>}{sponsored && item.state !== 'WITHDRAWN' && <button className="og-button og-secondary" disabled={!canWrite} onClick={onWithdraw}>Withdraw outcome</button>}</article>;
}
function ContinuousProjection({artifact}: {artifact: Awaited<ReturnType<typeof verifySessionEvidenceArtifact>>}) {
  const p = artifact.projection, unit = artifact.input.config.strategy.record.content.definition.market.symbol.split('/')[1], net = p.account.equity - artifact.input.config.initialCapital;
  return <><dl className="og-experiment-metrics"><div><dt>Marked equity</dt><dd>{p.account.equity.toFixed(2)} {unit}</dd></div><div><dt>Net marked P&amp;L</dt><dd className={net < 0 ? 'og-experiment-negative' : net > 0 ? 'og-experiment-positive' : ''}>{net.toFixed(2)} {unit}</dd></div><div><dt>Realized P&amp;L / fees</dt><dd>{p.account.realizedPnl.toFixed(2)} / {p.account.totalFees.toFixed(2)} {unit}</dd></div><div><dt>Open positions / closed trades</dt><dd>{p.openPositions.length} / {p.trades.length}</dd></div></dl><p>Mark receipt {p.account.markedAt ?? 'NONE'} · observed quote {p.account.sourceObservedAt ?? 'NONE'}. Retained marks are not current quotes.</p><p>Sequence {p.sequence} · {p.status}{p.failure ? ` · failure ${p.failure}` : ''}{p.capacityHalted ? ' · capacity halted' : ''}{p.dataGap ? ' · data gap' : ''}{p.daily.halted ? ' · daily risk halted' : ''}. {p.pending ? 1 : 0} pending admission. {p.status === 'STOPPING' && 'Emergency exit awaits an acceptable quote; exposure remains open.'}</p><details><summary>Open inventory and retained failures</summary>{p.openPositions.map(position => <p key={position.id}>{position.direction} · entry {position.entryPrice} · quantity {position.quantity} · SL {position.stopLoss} · TP {position.takeProfit} · receipt {position.entryAt}</p>)}{!p.openPositions.length && <p>No open inventory at this checkpoint.</p>}<p>{artifact.input.events.length} retained events. No upstream delivery completeness is established.</p></details></>;
}
