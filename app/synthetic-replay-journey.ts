import {z} from 'zod';
import {demoTimeframes} from './demo-model';
import {syntheticSessionExample} from './session-example';
import {boundedSessionValue, sessionConfigSchema, sessionEventSchema} from './session-model';
import {verifySessionEvidenceBundle} from './session-evidence-model';
import {strategyDigest} from './strategy-model';
import {assertReplayForwardChronology, replayForwardLastClock, replayForwardLimits, selectedReplayTrial, verifyReplayForwardContext} from './replay-forward-context';

// Local product demonstration only. Never a public source, market adapter or prospective test.
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reportSchema = z.object({version: z.literal(1), kind: z.literal('LOCAL_SYNTHETIC_REPLAY_JOURNEY'), scope: z.literal('SYNTHETIC_DEMONSTRATION_ONLY'), classification: z.literal('AUTHOR_REPORTED'), qualification: z.literal('NONE'), independence: z.literal('NOT_ESTABLISHED'), ordersEnabled: z.literal(false), liveEnabled: z.literal(false), context: z.unknown(), continuation: z.unknown(), reportDigest: hash}).strict();

export async function verifySyntheticReplayContext(raw: unknown) {
  const context = await verifyReplayForwardContext(raw), trial = selectedReplayTrial(context);
  if (trial.origin !== 'SYNTHETIC_OFFLINE' || trial.source !== null || trial.input.dataset.provenance !== 'SYNTHETIC' || trial.input.dataset.rights.permission !== 'CREATED_SYNTHETIC') throw Error('Synthetic continuation requires a complete offline replay with declared invented inputs.');
  return context;
}

/** Explicit preparation only. Repeats an invented pattern; it creates no new market evidence. */
export async function prepareSyntheticReplayContinuation(rawContext: unknown, suppliedNow: string) {
  const context = await verifySyntheticReplayContext(rawContext), trial = selectedReplayTrial(context);
  if (typeof suppliedNow !== 'string' || !Number.isFinite(Date.parse(suppliedNow)) || new Date(suppliedNow).toISOString() !== suppliedNow) throw Error('A canonical preparation clock is required.');
  const generated = await syntheticSessionExample(trial.input.strategy);
  const step = demoTimeframes[trial.input.dataset.timeframe], base = Date.parse(generated.startedAt);
  const after = Math.max(Date.parse(replayForwardLastClock(context)), Date.parse(suppliedNow));
  const shift = Math.ceil((after + 1 - base) / step) * step;
  const shifted = (clock: string) => new Date(Date.parse(clock) + shift).toISOString();
  const config = sessionConfigSchema.parse({...generated.config, sessionId: crypto.randomUUID(), origin: 'SYNTHETIC_FIXTURE', initialCapital: trial.input.initialCapital, sourceLabel: 'Invented continuation of a repeated synthetic pattern'});
  if (!same(config.strategy, trial.input.strategy)) throw Error('Synthetic continuation changed the selected rules.');
  const startedAt = shifted(generated.startedAt);
  assertReplayForwardChronology(context, startedAt);
  const events = generated.events.map(({event, receivedAt}) => ({receivedAt: shifted(receivedAt), event: sessionEventSchema.parse(event.type === 'CLOSED_BAR' ? {...event, bar: {...event.bar, closedAt: shifted(event.bar.closedAt)}} : event.type === 'QUOTE' ? {...event, observedAt: shifted(event.observedAt)} : event.type === 'SIGNAL' ? {...event, signal: {...event.signal, observedAt: shifted(event.signal.observedAt), availableAt: shifted(event.signal.availableAt)}} : event)}));
  return {config, startedAt, events};
}

/** Identity checks only. Reconstruction is performed by the existing snapshot path. */
export async function createSyntheticReplayJourney(rawContext: unknown, rawContinuation: unknown) {
  const context = await verifySyntheticReplayContext(rawContext), trial = selectedReplayTrial(context);
  const continuation = await verifySessionEvidenceBundle(rawContinuation), config = continuation.input.config;
  if (config.origin !== 'SYNTHETIC_FIXTURE' || config.clockMode !== 'SYNTHETIC_PLAYBACK' || config.provenance !== 'SYNTHETIC' || config.rights.permission !== 'CREATED_SYNTHETIC' || !same(config.strategy, trial.input.strategy) || config.initialCapital !== trial.input.initialCapital) throw Error('A synthetic journey must retain the exact replay rules and capital with an invented playback clock.');
  assertReplayForwardChronology(context, continuation.input.startedAt);
  const body = {version: 1 as const, kind: 'LOCAL_SYNTHETIC_REPLAY_JOURNEY' as const, scope: 'SYNTHETIC_DEMONSTRATION_ONLY' as const, classification: 'AUTHOR_REPORTED' as const, qualification: 'NONE' as const, independence: 'NOT_ESTABLISHED' as const, ordersEnabled: false as const, liveEnabled: false as const, context, continuation};
  boundedSessionValue(body, replayForwardLimits.reportBytes);
  const report = {...body, reportDigest: await strategyDigest(JSON.stringify(body))};
  boundedSessionValue(report, replayForwardLimits.reportBytes);
  return report;
}

export async function verifySyntheticReplayJourney(raw: unknown) {
  boundedSessionValue(raw, replayForwardLimits.reportBytes);
  const supplied = reportSchema.parse(raw), verified = await createSyntheticReplayJourney(supplied.context, supplied.continuation);
  if (verified.reportDigest !== supplied.reportDigest) throw Error('Synthetic journey identity does not match.');
  return verified;
}
