import {z} from 'zod';
import {boundedStrategyRecord, strategyDigest} from './strategy-model';
import {boundedSessionConfig, boundedSessionEvent, boundedSessionValue, sessionConfigSchema, sessionEventSchema, sessionLimits, sessionMethod, sessionStateSchema, sessionVersion, type SessionState} from './session-model';
import {sessionImplementationKind} from './session-implementation-registry';

// Public admission is identity checking only. This module imports no Session engine/journal.
export const sessionEvidenceLimits = {inputBytes: 196608, artifactBytes: 524288, bundleBytes: 786432, reportBytes: 524288, events: sessionLimits.events + sessionLimits.emergencyReserve, eventCanonicalBytes: 1024} as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const clock = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const text = (maximum: number) => z.string().trim().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value => !credentialLike(value), 'Credentials cannot be shared.');
export const sessionEvidenceImplementationSchema = z.object({version: z.literal(sessionVersion), engine: hash, model: hash, journal: hash}).strict();
export const sessionEvidenceEvaluatorSchema = z.object({version: z.literal(sessionVersion), sourceVersion: text(80), sourceDigests: z.object({engine: hash, model: hash, journal: hash}).strict(), methodDigest: hash}).strict();
export type SessionEvidenceEvaluator = z.infer<typeof sessionEvidenceEvaluatorSchema>;

export const sessionEvidenceInputSchema = z.object({
  version: z.literal(1), kind: z.literal('CONTINUOUS_DEMO_INPUT'),
  config: sessionConfigSchema, startedAt: clock, implementation: sessionEvidenceImplementationSchema,
  methodDigest: hash, hypothesis: text(2000), falsification: text(2000),
  events: z.array(z.object({event: sessionEventSchema, receivedAt: clock, stateDigest: hash}).strict()).max(sessionEvidenceLimits.events),
  journalDigest: hash, finalStateDigest: hash, receiptHead: hash,
}).strict().superRefine((input, context) => {
  if (new Set(input.events.map(entry => entry.event.requestId)).size !== input.events.length)
    context.addIssue({code: z.ZodIssueCode.custom, message: 'A retained transition request identity cannot repeat.'});
  if (input.events.length && input.events.at(-1)!.stateDigest !== input.finalStateDigest)
    context.addIssue({code: z.ZodIssueCode.custom, message: 'The final transition commitment must match the retained checkpoint.'});
  // Rejected OUT_OF_ORDER receipts retain their original timestamps. Never sort/repair the tape.
});
export type SessionEvidenceInput = z.infer<typeof sessionEvidenceInputSchema>;

export const sessionEvidenceProjectionSchema = sessionStateSchema.pick({
  status: true, failure: true, capacityHalted: true, dataGap: true, emergencyAt: true,
  sequence: true, lastReceivedAt: true, headDigest: true, stateDigest: true, pending: true,
  account: true, openPositions: true, trades: true, equity: true, daily: true, counters: true,
}).strict();
export type SessionEvidenceProjection = z.infer<typeof sessionEvidenceProjectionSchema>;
const labels = {classification: z.literal('AUTHOR_REPORTED'), qualification: z.literal('NONE'), independence: z.literal('NOT_ESTABLISHED'), ordersEnabled: z.literal(false), liveEnabled: z.literal(false)};
const artifactBodySchema = z.object({version: z.literal(1), kind: z.literal('CONTINUOUS_DEMO_ARTIFACT'), ...labels, input: sessionEvidenceInputSchema, inputDigest: hash, projection: sessionEvidenceProjectionSchema}).strict();
export const sessionEvidenceArtifactSchema = artifactBodySchema.extend({resultDigest: hash}).superRefine((artifact, context) => {
  if (artifact.projection.sequence !== artifact.input.events.length || artifact.projection.stateDigest !== artifact.input.finalStateDigest || artifact.projection.headDigest !== artifact.input.receiptHead)
    context.addIssue({code: z.ZodIssueCode.custom, message: 'The reported checkpoint does not identify the retained input.'});
});
export type SessionEvidenceArtifact = z.infer<typeof sessionEvidenceArtifactSchema>;
export const sessionEvidenceResultSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('ARTIFACT'), artifact: sessionEvidenceArtifactSchema}).strict(),
  z.object({kind: z.literal('ARTIFACT_UNAVAILABLE'), reason: text(2000)}).strict(),
]);
const bundleBodySchema = z.object({version: z.literal(1), kind: z.literal('LOCAL_CONTINUOUS_DEMO_REVIEW'), ...labels, input: sessionEvidenceInputSchema, result: sessionEvidenceResultSchema}).strict();
export const sessionEvidenceBundleSchema = bundleBodySchema.extend({bundleDigest: hash});
export type SessionEvidenceBundle = z.infer<typeof sessionEvidenceBundleSchema>;
export const sessionEvidenceReviewReasonSchema = z.enum(['CHECKPOINT_MISMATCH', 'FINAL_STATE_MISMATCH', 'JOURNAL_MISMATCH', 'PROJECTION_MISMATCH', 'RECONSTRUCTION_FAILURE', 'USER_CANCELLED']);
const reviewBodySchema = z.object({
  version: z.literal(1), kind: z.literal('LOCAL_CONTINUOUS_DEMO_RECONSTRUCTION'), ...labels,
  scope: z.literal('FIXED_LOCAL_RECONSTRUCTION_ONLY'), status: z.enum(['MATCH', 'MISMATCH', 'FAILED', 'INTERRUPTED']), reason: sessionEvidenceReviewReasonSchema.nullable(),
  identity: z.object({artifact: hash, input: hash, journal: hash, state: hash}).strict(), implementation: sessionEvidenceImplementationSchema,
  observed: sessionEvidenceProjectionSchema.nullable(),
}).strict();
export const sessionEvidenceReviewSchema = reviewBodySchema.extend({reportDigest: hash}).superRefine((report, context) => {
  if (report.status === 'MATCH' && (report.reason !== null || !report.observed) || report.status === 'MISMATCH' && (!report.observed || !['CHECKPOINT_MISMATCH', 'FINAL_STATE_MISMATCH', 'JOURNAL_MISMATCH', 'PROJECTION_MISMATCH'].includes(report.reason ?? '')) || report.status === 'FAILED' && report.reason !== 'RECONSTRUCTION_FAILURE' || report.status === 'INTERRUPTED' && report.reason !== 'USER_CANCELLED')
    context.addIssue({code: z.ZodIssueCode.custom, message: 'The local review disposition is inconsistent.'});
});
export type SessionEvidenceReview = z.infer<typeof sessionEvidenceReviewSchema>;
export class SessionEvidenceError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const sessionEvidenceDigest = strategyDigest;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

function credentialLike(raw: string) {
  let value = raw;
  for (let n = 0; n < 4; n++) {
    if (/og_agent_[a-f0-9-]{36}\.[a-f0-9]{64}|og_local_(?:owner|producer)_[a-f0-9]{64}|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}/i.test(value)) return true;
    try { const decoded = decodeURIComponent(value); if (decoded === value) break; value = decoded; } catch { break; }
  }
  return false;
}
function knownCredential(raw: unknown): void {
  if (typeof raw === 'string' && credentialLike(raw)) throw new SessionEvidenceError('Credentials cannot be shared in continuous Session evidence.');
  if (raw && typeof raw === 'object') for (const [key, value] of Object.entries(raw)) { knownCredential(key); knownCredential(value); }
}
function plain(raw: unknown, maximum: number) {
  try { boundedSessionValue(raw, maximum); }
  catch (error) { throw new SessionEvidenceError('Only bounded plain finite continuous Session evidence is accepted.', typeof error === 'object' && error !== null && 'status' in error && error.status === 413 ? 413 : 400); }
  // Descriptors are admitted before this traversal; no submitted getter/toJSON runs.
  knownCredential(raw);
}
function schemaValue<T>(raw: unknown, schema: z.ZodType<T>, maximum: number): T {
  plain(raw, maximum); const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new SessionEvidenceError('Invalid continuous Session evidence.');
  if (bytes(JSON.stringify(parsed.data)) > maximum) throw new SessionEvidenceError('Continuous Session evidence exceeds its public byte budget.', 413);
  return parsed.data;
}
export function boundedSessionEvidenceInput(raw: unknown) {
  const input = schemaValue(raw, sessionEvidenceInputSchema, sessionEvidenceLimits.inputBytes);
  boundedSessionConfig(input.config);
  for (const entry of input.events) if (bytes(boundedSessionEvent(entry.event).payload) > sessionEvidenceLimits.eventCanonicalBytes) throw new SessionEvidenceError('A normalized transition exceeds its retained event budget.', 413);
  return {input, payload: JSON.stringify(input)};
}
export async function verifySessionEvidenceInput(raw: unknown): Promise<SessionEvidenceInput> {
  const {input} = boundedSessionEvidenceInput(raw);
  if (sessionImplementationKind(input.implementation)===null || input.methodDigest !== await strategyDigest(JSON.stringify(sessionMethod)) || input.config.strategy.digest !== await strategyDigest(boundedStrategyRecord(input.config.strategy.record).payload)) throw new SessionEvidenceError('Continuous Session source, method or strategy identity is inconsistent.');
  return input;
}
export function boundedSessionEvidenceArtifact(raw: unknown) {
  const artifact = schemaValue(raw, sessionEvidenceArtifactSchema, sessionEvidenceLimits.artifactBytes);
  boundedSessionEvidenceInput(artifact.input);
  return {artifact, payload: JSON.stringify(artifact)};
}
export async function verifySessionEvidenceArtifact(raw: unknown): Promise<SessionEvidenceArtifact> {
  const {artifact} = boundedSessionEvidenceArtifact(raw), {resultDigest, ...body} = artifact;
  await verifySessionEvidenceInput(artifact.input);
  if (artifact.inputDigest !== await strategyDigest(JSON.stringify(artifact.input)) || resultDigest !== await strategyDigest(JSON.stringify(body))) throw new SessionEvidenceError('Continuous Session artifact identity is inconsistent.');
  return artifact;
}
export async function verifySessionEvidenceBundle(raw: unknown): Promise<SessionEvidenceBundle> {
  const bundle = schemaValue(raw, sessionEvidenceBundleSchema, sessionEvidenceLimits.bundleBytes), {bundleDigest, ...body} = bundle;
  await verifySessionEvidenceInput(bundle.input);
  if (bundle.result.kind === 'ARTIFACT') {
    const artifact = await verifySessionEvidenceArtifact(bundle.result.artifact);
    if (!same(artifact.input, bundle.input)) throw new SessionEvidenceError('The review bundle does not contain the same exact input.');
  }
  if (bundleDigest !== await strategyDigest(JSON.stringify(body))) throw new SessionEvidenceError('Continuous Session review bundle identity is inconsistent.');
  return bundle;
}
export function sessionEvidenceProjection(state: SessionState): SessionEvidenceProjection {
  return sessionEvidenceProjectionSchema.parse({status: state.status, failure: state.failure, capacityHalted: state.capacityHalted, dataGap: state.dataGap, emergencyAt: state.emergencyAt, sequence: state.sequence, lastReceivedAt: state.lastReceivedAt, headDigest: state.headDigest, stateDigest: state.stateDigest, pending: state.pending, account: state.account, openPositions: state.openPositions, trades: state.trades, equity: state.equity, daily: state.daily, counters: state.counters});
}
export function sessionEvidenceEvaluatorDefaults(input: SessionEvidenceInput): SessionEvidenceEvaluator {
  const {version, engine, model, journal} = input.implementation;
  return sessionEvidenceEvaluatorSchema.parse({version, sourceVersion: 'opengrail-session-v1 fixed source identities', sourceDigests: {engine, model, journal}, methodDigest: input.methodDigest});
}
export async function sealSessionEvidenceArtifact(input: SessionEvidenceInput, projection: SessionEvidenceProjection): Promise<SessionEvidenceArtifact> {
  await verifySessionEvidenceInput(input);
  const safeProjection = schemaValue(projection, sessionEvidenceProjectionSchema, sessionEvidenceLimits.artifactBytes);
  const body = artifactBodySchema.parse({version: 1, kind: 'CONTINUOUS_DEMO_ARTIFACT', classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false, liveEnabled: false, input, inputDigest: await strategyDigest(JSON.stringify(input)), projection: safeProjection});
  return verifySessionEvidenceArtifact({...body, resultDigest: await strategyDigest(JSON.stringify(body))});
}
export async function sealSessionEvidenceBundle(input: SessionEvidenceInput, result: z.infer<typeof sessionEvidenceResultSchema>): Promise<SessionEvidenceBundle> {
  const body = bundleBodySchema.parse({version: 1, kind: 'LOCAL_CONTINUOUS_DEMO_REVIEW', classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED', ordersEnabled: false, liveEnabled: false, input, result});
  return verifySessionEvidenceBundle({...body, bundleDigest: await strategyDigest(JSON.stringify(body))});
}
export async function sealSessionEvidenceReview(raw: z.infer<typeof reviewBodySchema>): Promise<SessionEvidenceReview> {
  const body = schemaValue(raw, reviewBodySchema, sessionEvidenceLimits.reportBytes);
  return verifySessionEvidenceReview({...body, reportDigest: await strategyDigest(JSON.stringify(body))});
}
/** Report verification is identity checking, never proof that a local review executed. */
export async function verifySessionEvidenceReview(raw: unknown): Promise<SessionEvidenceReview> {
  const report = schemaValue(raw, sessionEvidenceReviewSchema, sessionEvidenceLimits.reportBytes), {reportDigest, ...body} = report;
  if (sessionImplementationKind(report.implementation)===null || reportDigest !== await strategyDigest(JSON.stringify(body))) throw new SessionEvidenceError('Local continuous Session review identity is inconsistent.');
  return report;
}
