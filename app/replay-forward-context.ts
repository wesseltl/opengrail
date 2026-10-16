import {z} from 'zod';
import {boundedDemoRequest, demoArtifactSchema, demoRequestSchema, verifyDemoArtifact, type DemoArtifact} from './demo-model';
import {boundedStrategyRecord, strategyDigest} from './strategy-model';
import {verifySessionEvidenceBundle, type SessionEvidenceBundle} from './session-evidence-model';

// A local transport wrapper, deliberately separate from evaluation/Session formats.
// Page history is supplied evidence: a hash cannot prove that other trials do not exist.
export const replayForwardLimits = {bytes: 16 * 1024 * 1024, reportBytes: 18 * 1024 * 1024, trials: 32, depth: 24, nodes: 1_000_000} as const;
const uuid = z.string().uuid().refine(value => value === value.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const clock = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const status = z.enum(['RUNNING', 'INTERRUPTED', 'INPUT_REJECTED', 'OUTPUT_UNCONFIRMED', 'CLEARED', 'COMPLETED', 'NO_TRADES', 'HALTED', 'REJECTED', 'FAILED']);
export const replayForwardTrialSchema = z.object({
  localId: uuid, attemptedAt: clock, label: z.string().max(1000), strategyDigest: hash,
  source: z.object({id: uuid, digest: hash}).strict().nullable(), sourceConfirmed: z.boolean(),
  priorStatus: status.nullable(), origin: z.enum(['PUBLIC_SNAPSHOT', 'SYNTHETIC_OFFLINE']), status,
  error: z.string().max(2000).nullable(), input: demoRequestSchema.nullable(), artifact: demoArtifactSchema.nullable(),
}).strict();
export type ReplayForwardTrial = z.infer<typeof replayForwardTrialSchema>;
const contextBodySchema = z.object({
  version: z.literal(1), kind: z.literal('LOCAL_REPLAY_FORWARD_CONTEXT'),
  classification: z.literal('AUTHOR_REPORTED'), qualification: z.literal('NONE'), independence: z.literal('NOT_ESTABLISHED'),
  historyScope: z.literal('AVAILABLE_PAGE_HISTORY_ONLY'), ordersEnabled: z.literal(false), liveEnabled: z.literal(false),
  selectedTrialId: uuid, trials: z.array(replayForwardTrialSchema).min(1).max(replayForwardLimits.trials),
}).strict();
const contextSchema = contextBodySchema.extend({contextDigest: hash}).strict();
export type ReplayForwardContext = z.infer<typeof contextSchema>;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function bounded(raw: unknown, maximum: number) {
  let nodes = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number, author = false): void {
    if (++nodes > replayForwardLimits.nodes || depth > replayForwardLimits.depth) throw Error('Local journey structure is too large.');
    if (typeof value === 'string') {
      let text = value;
      for (let n = 0; n < 4; n++) {
        if (/og_local_(producer|owner)_/i.test(text) || !author && /og_agent_/i.test(text)) throw Error('Credentials cannot enter local journey evidence.');
        try { const decoded = decodeURIComponent(text); if (decoded === text) break; text = decoded; } catch { break; }
      }
      return;
    }
    if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || Object.getOwnPropertySymbols(value).length || ancestors.has(value)) throw Error('Only plain finite JSON evidence is accepted.');
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw Error('Only plain JSON containers are accepted.');
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (Array.isArray(value) && key === 'length') continue;
      if (!('value' in descriptor) || !descriptor.enumerable) throw Error('Accessors and hidden fields are refused.');
      visit(descriptor.value, depth + 1, author || key === 'author');
    }
    ancestors.delete(value);
  }
  visit(raw, 0);
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > maximum) throw Error('The complete local journey exceeds its file budget; no history is trimmed.');
}
async function verifyTrials(trials: ReplayForwardTrial[]) {
  if (new Set(trials.map(trial => trial.localId)).size !== trials.length) throw Error('Duplicate local trial identity.');
  for (const trial of trials) {
    if (trial.origin === 'PUBLIC_SNAPSHOT' ? !trial.source || trial.source.digest !== trial.strategyDigest : trial.source !== null) throw Error('Trial source identity is inconsistent.');
    if (trial.status === 'CLEARED' && (trial.input !== null || trial.artifact !== null || trial.sourceConfirmed)) throw Error('Cleared trial payloads cannot be resurrected.');
    if (['COMPLETED', 'NO_TRADES', 'HALTED', 'REJECTED', 'FAILED'].includes(trial.status) && (!trial.artifact || trial.status !== trial.artifact.status)) throw Error('Final trial disposition must match its retained artifact.');
    if (trial.artifact && trial.status !== trial.artifact.status && trial.status !== 'OUTPUT_UNCONFIRMED' && trial.status !== 'RUNNING') throw Error('Trial disposition contradicts its retained artifact.');
    if (trial.input) {
      const input = boundedDemoRequest(trial.input).input;
      if (input.strategy.digest !== trial.strategyDigest || trial.source && input.strategy.record.id !== trial.source.id || await strategyDigest(boundedStrategyRecord(input.strategy.record).payload) !== trial.strategyDigest) throw Error('Trial input does not match its retained strategy.');
    }
    if (trial.artifact) {
      const artifact = await verifyDemoArtifact(trial.artifact);
      if (artifact.input && (!trial.input || !same(artifact.input, trial.input))) throw Error('Artifact and retained trial input differ.');
      if (artifact.input && artifact.input.strategy.digest !== trial.strategyDigest) throw Error('Artifact strategy differs from its trial.');
    }
  }
}
export function selectedReplayTrial(context: ReplayForwardContext) {
  const trial = context.trials.find(value => value.localId === context.selectedTrialId);
  if (!trial?.input || !trial.artifact?.input || !trial.sourceConfirmed || trial.status !== trial.artifact.status || trial.status === 'REJECTED') throw Error('Select a confirmed replay with its complete original input.');
  return trial as ReplayForwardTrial & {input: NonNullable<ReplayForwardTrial['input']>; artifact: DemoArtifact};
}
export async function createReplayForwardContext(trials: ReplayForwardTrial[], selectedTrialId: string): Promise<ReplayForwardContext> {
  bounded({trials, selectedTrialId}, replayForwardLimits.bytes);
  const body = contextBodySchema.parse({version: 1, kind: 'LOCAL_REPLAY_FORWARD_CONTEXT', classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', historyScope: 'AVAILABLE_PAGE_HISTORY_ONLY', ordersEnabled: false, liveEnabled: false, selectedTrialId, trials});
  await verifyTrials(body.trials);
  const context = {...body, contextDigest: await strategyDigest(JSON.stringify(body))};
  selectedReplayTrial(context); bounded(context, replayForwardLimits.bytes); return context;
}
export async function verifyReplayForwardContext(raw: unknown): Promise<ReplayForwardContext> {
  bounded(raw, replayForwardLimits.bytes);
  const supplied = contextSchema.parse(raw), verified = await createReplayForwardContext(supplied.trials, supplied.selectedTrialId);
  if (verified.contextDigest !== supplied.contextDigest) throw Error('Local replay history digest does not match.');
  return verified;
}
/** Public-source snapshots to recheck, including adverse/unconfirmed retained payloads. */
export function replayForwardPublicInputs(context: ReplayForwardContext) {
  const unique = new Map<string, {record: NonNullable<ReplayForwardTrial['input']>['strategy']['record']; digest: string; origin: 'PUBLIC_STRATEGY'}>();
  for (const trial of context.trials) if (trial.source && trial.input) {
    const key = trial.source.id + ':' + trial.source.digest;
    if (!unique.has(key)) unique.set(key, {record: trial.input.strategy.record, digest: trial.source.digest, origin: 'PUBLIC_STRATEGY'});
  }
  return [...unique.values()];
}
/** Supplied chronology only, never independent precommit or proof of genuine delivery. */
export function replayForwardLastClock(context: ReplayForwardContext) {
  let last = 0;
  for (const trial of context.trials) {
    last = Math.max(last, Date.parse(trial.attemptedAt));
    if (trial.input) {
      for (const bar of trial.input.dataset.bars) last = Math.max(last, Date.parse(bar.closedAt));
      for (const signal of trial.input.signals) last = Math.max(last, Date.parse(signal.observedAt), Date.parse(signal.availableAt));
    }
  }
  return new Date(last).toISOString();
}
export function assertReplayForwardChronology(context: ReplayForwardContext, startedAt: string) {
  if (!Number.isFinite(Date.parse(startedAt)) || Date.parse(startedAt) <= Date.parse(replayForwardLastClock(context))) throw Error('Forward Session must start after every retained replay/history clock.');
}
/** The original replay hypothesis stays in context; forward text belongs to its own evidence. */
export async function createReplayForwardReport(rawContext: unknown, rawForwardEvidence: unknown) {
  const context = await verifyReplayForwardContext(rawContext), trial = selectedReplayTrial(context);
  const forwardEvidence: SessionEvidenceBundle = await verifySessionEvidenceBundle(rawForwardEvidence);
  if (trial.origin !== 'PUBLIC_SNAPSHOT' || forwardEvidence.input.config.origin !== 'PUBLIC_STRATEGY' || forwardEvidence.input.config.clockMode !== 'SYSTEM_RECEIPT' || !same(forwardEvidence.input.config.strategy, trial.input.strategy) || forwardEvidence.input.config.initialCapital !== trial.input.initialCapital) throw Error('Forward evidence must bind the exact selected public replay and capital with system receipt.');
  assertReplayForwardChronology(context, forwardEvidence.input.startedAt);
  const body = {version: 1 as const, kind: 'LOCAL_REPLAY_FORWARD_REPORT' as const, classification: 'AUTHOR_REPORTED' as const, qualification: 'NONE' as const, independence: 'NOT_ESTABLISHED' as const, ordersEnabled: false as const, liveEnabled: false as const, context, forwardEvidence};
  bounded(body, replayForwardLimits.reportBytes);
  return {...body, reportDigest: await strategyDigest(JSON.stringify(body))};
}
export async function verifyReplayForwardReport(raw: unknown) {
  bounded(raw, replayForwardLimits.reportBytes);
  const supplied = z.object({version: z.literal(1), kind: z.literal('LOCAL_REPLAY_FORWARD_REPORT'), classification: z.literal('AUTHOR_REPORTED'), qualification: z.literal('NONE'), independence: z.literal('NOT_ESTABLISHED'), ordersEnabled: z.literal(false), liveEnabled: z.literal(false), context: z.unknown(), forwardEvidence: z.unknown(), reportDigest: hash}).strict().parse(raw);
  const verified = await createReplayForwardReport(supplied.context, supplied.forwardEvidence);
  if (verified.reportDigest !== supplied.reportDigest) throw Error('Local journey report digest does not match.');
  return verified;
}
