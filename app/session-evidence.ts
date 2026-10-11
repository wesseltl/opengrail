import {createSessionJournal, appendSessionEvent, verifySessionJournal, reconstructSessionJournal, type SessionJournal} from './session-journal';
import {sessionVersion} from './session-model';
import {sessionSourceFingerprints} from './session-fingerprints';
import {SessionEvidenceError, sessionEvidenceDigest, sessionEvidenceProjection, sessionEvidenceProjectionSchema, verifySessionEvidenceInput, verifySessionEvidenceArtifact, sealSessionEvidenceArtifact, sealSessionEvidenceBundle, sealSessionEvidenceReview, type SessionEvidenceInput, type SessionEvidenceBundle, type SessionEvidenceArtifact, type SessionEvidenceProjection, type SessionEvidenceReview} from './session-evidence-model';

// Fixed local reconstruction only. No provider access, publication or imported code execution.
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const retrospectiveHypothesis = 'Retrospective report of this retained Demo Session snapshot; no hypothesis preregistration or authentic feed timing is established.';
const retrospectiveFalsification = 'Reject the reported computation if fixed reconstruction does not reproduce every retained transition, the final journal identity and the reported terminal projection.';
type Options = {signal?: AbortSignal};
function cancelled(options: Options) { return options.signal?.aborted === true; }
function abort(options: Options) { if (cancelled(options)) throw new SessionEvidenceError('Local continuous Session review interrupted.', 409); }
async function inputFromJournal(journal: SessionJournal, options: {hypothesis?: string; falsification?: string}): Promise<SessionEvidenceInput> {
  return verifySessionEvidenceInput({version: 1, kind: 'CONTINUOUS_DEMO_INPUT', config: journal.config, startedAt: journal.startedAt, implementation: journal.implementation, methodDigest: journal.state.methodDigest, hypothesis: options.hypothesis ?? retrospectiveHypothesis, falsification: options.falsification ?? retrospectiveFalsification, events: journal.events, journalDigest: journal.journalDigest, finalStateDigest: journal.state.stateDigest, receiptHead: journal.state.headDigest});
}
/** A complete retained snapshot or an explicit rejection; never slices oversized input. */
export async function snapshotSessionEvidence(rawJournal: unknown, options: Options & {hypothesis?: string; falsification?: string} = {}): Promise<SessionEvidenceBundle> {
  abort(options);
  const journal = await verifySessionJournal(rawJournal);
  abort(options);
  // Admit the public full-input cap before the more expensive fixed reconstruction.
  const input = await inputFromJournal(journal, options);
  abort(options);
  const reconstructed = await reconstructSessionJournal(journal, {signal: options.signal});
  abort(options);
  try {
    const artifact = await sealSessionEvidenceArtifact(input, sessionEvidenceProjection(reconstructed.state));
    abort(options);
    return sealSessionEvidenceBundle(input, {kind: 'ARTIFACT', artifact});
  } catch (error) {
    if (error instanceof SessionEvidenceError && error.status === 413) return sealSessionEvidenceBundle(input, {kind: 'ARTIFACT_UNAVAILABLE', reason: 'The complete retained input fits the public registry, but its reported projection exceeds the 512 KiB public artifact limit. Keep the full local journal; no transition or adverse result has been dropped.'});
    throw error;
  }
}

type Mismatch = 'CHECKPOINT_MISMATCH' | 'FINAL_STATE_MISMATCH' | 'JOURNAL_MISMATCH' | 'PROJECTION_MISMATCH';
/** Rebuild the exact tape, preserving rejected receipt clocks and open exposure. */
export async function reconstructSessionEvidence(rawInput: unknown, options: Options = {}): Promise<SessionJournal> {
  const input = await verifySessionEvidenceInput(rawInput);
  abort(options);
  let journal = await createSessionJournal(input.config, input.startedAt);
  for (const entry of input.events) {
    abort(options);
    journal = await appendSessionEvent(journal, entry.event, entry.receivedAt);
    if (journal.state.stateDigest !== entry.stateDigest) throw new SessionEvidenceError('An intermediate continuous Session checkpoint does not reconstruct.');
  }
  abort(options);
  if (journal.state.stateDigest !== input.finalStateDigest || journal.state.headDigest !== input.receiptHead || journal.journalDigest !== input.journalDigest) throw new SessionEvidenceError('The final continuous Session snapshot does not reconstruct.');
  return journal;
}

/** Invalid bytes/hashes fail admission. Hash-consistent false reports retain a MISMATCH. */
export async function reviewSessionEvidence(rawArtifact: unknown, options: Options = {}): Promise<SessionEvidenceReview> {
  const artifact: SessionEvidenceArtifact = await verifySessionEvidenceArtifact(rawArtifact), input = artifact.input;
  let observed: SessionEvidenceProjection | null = null, mismatch: Mismatch | null = null;
  const identity = {artifact: artifact.resultDigest, input: artifact.inputDigest, journal: input.journalDigest, state: input.finalStateDigest};
  const result = async (status: SessionEvidenceReview['status'], reason: SessionEvidenceReview['reason']) => {
    const body = {version: 1 as const, kind: 'LOCAL_CONTINUOUS_DEMO_RECONSTRUCTION' as const, classification: 'AUTHOR_REPORTED' as const, qualification: 'NONE' as const, independence: 'NOT_ESTABLISHED' as const, ordersEnabled: false as const, liveEnabled: false as const, scope: 'FIXED_LOCAL_RECONSTRUCTION_ONLY' as const, status, reason, identity, implementation: {version: sessionVersion, ...sessionSourceFingerprints}, observed};
    try { return await sealSessionEvidenceReview(body); }
    catch (error) { if (error instanceof SessionEvidenceError && error.status === 413) return sealSessionEvidenceReview({...body, status: 'FAILED', reason: 'RECONSTRUCTION_FAILURE', observed: null}); throw error; }
  };
  try {
    if (cancelled(options)) return result('INTERRUPTED', 'USER_CANCELLED');
    let journal = await createSessionJournal(input.config, input.startedAt);
    observed = sessionEvidenceProjection(journal.state);
    for (const entry of input.events) {
      if (cancelled(options)) return result('INTERRUPTED', 'USER_CANCELLED');
      journal = await appendSessionEvent(journal, entry.event, entry.receivedAt);
      observed = sessionEvidenceProjection(journal.state);
      if (journal.state.stateDigest !== entry.stateDigest && mismatch === null) mismatch = 'CHECKPOINT_MISMATCH';
    }
    if (cancelled(options)) return result('INTERRUPTED', 'USER_CANCELLED');
    if ((journal.state.stateDigest !== input.finalStateDigest || journal.state.headDigest !== input.receiptHead) && mismatch === null) mismatch = 'FINAL_STATE_MISMATCH';
    if (journal.journalDigest !== input.journalDigest && mismatch === null) mismatch = 'JOURNAL_MISMATCH';
    if (!same(sessionEvidenceProjectionSchema.parse(artifact.projection), observed) && mismatch === null) mismatch = 'PROJECTION_MISMATCH';
    return result(mismatch ? 'MISMATCH' : 'MATCH', mismatch);
  } catch {
    // No supplied exception/data text is echoed. This is an incomplete local review, not success.
    if (cancelled(options)) return result('INTERRUPTED', 'USER_CANCELLED');
    return result('FAILED', 'RECONSTRUCTION_FAILURE');
  }
}
