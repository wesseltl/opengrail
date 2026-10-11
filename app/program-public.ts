import {parseUniqueJson} from './unique-json';
import {experimentGetSchema, experimentIsProgramManifest, experimentLimits, experimentOutcomeFlags, validateExperimentItem, type ExperimentPublicItem, type ExperimentProgramManifest} from './experiment-model';
import {strategyGetSchema, type StrategyPublicItem} from './strategy-model';
import {verifyProgramSource} from './program-link';
import {validateProgramRunOutcome} from './program-evidence';

export type PublicProgramReference = {kind: 'MANIFEST' | 'OUTCOME'; id: string; digest: string};
export type PublicProgramContext = {reference: PublicProgramReference; manifest: ExperimentPublicItem & {record: ExperimentProgramManifest}; outcome: ExperimentPublicItem | null; source: StrategyPublicItem};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = /^[0-9a-f]{64}$/;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
export class PublicProgramUnavailable extends Error { constructor(readonly sourceId: string) { super('Current exact public program evidence is unavailable.'); } }

function assertMemberContinuation(before: ExperimentPublicItem | StrategyPublicItem, after: ExperimentPublicItem | StrategyPublicItem) {
 if (after.state !== 'VISIBLE' || !after.record || 'suppression' in after && after.suppression) throw new PublicProgramUnavailable(after.id);
 const immutable = (item: ExperimentPublicItem | StrategyPublicItem) => {
  if ('type' in item) { const {moderation: _moderation, state: _state, reason: _reason, suppression: _suppression, reporting: _reporting, outcomeCount: _count, ...rest} = item; return rest; }
  const {moderation: _moderation, state: _state, reason: _reason, ...rest} = item; return rest;
 };
 if (!same(immutable(before),immutable(after)) || after.moderation.length < before.moderation.length || !same(after.moderation.slice(0,before.moderation.length),before.moderation)) throw Error('Observed exact public evidence changed or its lifecycle regressed.');
}

/** Public links contain references only. No strategy bytes, data or credentials belong in URLs. */
export function parsePublicProgramReference(query: string): PublicProgramReference | null {
 const params = new URLSearchParams(query);
 if (!params.has('outcome') && !params.has('manifest')) return null;
 const key = params.has('outcome') ? 'outcome' : 'manifest';
 if ([...params.keys()].some(name => ![key,'digest'].includes(name)) || params.getAll(key).length !== 1 || params.getAll('digest').length !== 1 || !uuid.test(params.get(key)!) || !hash.test(params.get('digest')!)) throw Error('Use one exact public program record ID and digest.');
 return {kind: key === 'outcome' ? 'OUTCOME' : 'MANIFEST', id: params.get(key)!, digest: params.get('digest')!};
}
export function publicProgramHref(reference:PublicProgramReference){
 const query='?'+(reference.kind==='OUTCOME'?'outcome':'manifest')+'='+reference.id+'&digest='+reference.digest;
 if(!parsePublicProgramReference(query))throw Error('An exact public program reference is required.');return '/program'+query;
}

async function body(response: Response) {
 const cap = 1_048_576, declared = response.headers.get('Content-Length'), contentType = response.headers.get('Content-Type');
 if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType) || declared !== null && (!/^(?:0|[1-9]\d*)$/.test(declared) || Number(declared) > cap)) throw Error('Public evidence response headers are invalid.');
 const reader = response.body?.getReader(); if (!reader) throw Error('Public response unavailable.');
 const parts: Uint8Array[] = []; let length = 0;
 try { for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > cap) { await reader.cancel(); throw Error('Public evidence exceeds its byte budget.'); } parts.push(next.value); } } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(length); let at = 0; for (const part of parts) { bytes.set(part,at); at += part.byteLength; }
 return parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),cap,experimentLimits.maximumDepth);
}

/** Fetches exact inert evidence. This module never imports or invokes a program interpreter. */
export async function readPublicProgramContext(reference: PublicProgramReference, signal: AbortSignal): Promise<PublicProgramContext> {
 if (!parsePublicProgramReference('?' + (reference.kind === 'OUTCOME' ? 'outcome' : 'manifest') + '=' + reference.id + '&digest=' + reference.digest)) throw Error('Invalid public reference.');
 const options = {cache:'no-store' as const,redirect:'error' as const,credentials:'same-origin' as const,signal:AbortSignal.any([signal,AbortSignal.timeout(15_000)])};
 async function experiment(id: string) {
  const response = await fetch('/api/experiments?id=' + encodeURIComponent(id),options);
  if (response.status === 404) throw new PublicProgramUnavailable(id);
  if (!response.ok) throw Error('Public program record unavailable.');
  const item = await validateExperimentItem(experimentGetSchema.parse(await body(response)).item); signal.throwIfAborted();
  if (item.id !== id) throw Error('Wrong exact public identity.');
  if (item.state !== 'VISIBLE' || !item.record || item.suppression) throw new PublicProgramUnavailable(item.strategy.id);
  return item;
 }
 const first = await experiment(reference.id); if (first.digest !== reference.digest || first.type !== reference.kind) throw Error('Wrong exact program record.');
 const outcome = reference.kind === 'OUTCOME' ? first : null;
 if (outcome && (outcome.record?.version !== 3 || outcome.record.type !== 'OUTCOME' || !outcome.manifest || outcome.record.content.result.kind !== 'ARTIFACT')) throw Error('Choose a complete PROGRAM_DEMO outcome.');
 const manifest = outcome ? await experiment(outcome.manifest!.id) : first;
 if (!manifest.record || !experimentIsProgramManifest(manifest.record)) throw Error('A PROGRAM_DEMO manifest is required.');
 if (manifest.strategy.id !== manifest.record.content.input.strategy.record.id || manifest.strategy.digest !== manifest.record.content.input.strategy.digest) throw Error('Program source metadata differs from exact input.');
 if (outcome && (outcome.manifest!.digest !== manifest.digest || !same(outcome.strategy,manifest.strategy))) throw Error('Public parent identity differs.');
 if (outcome?.record?.version === 3 && outcome.record.type === 'OUTCOME' && outcome.record.content.result.kind === 'ARTIFACT') {
  await validateProgramRunOutcome(outcome.record.content.result.artifact,manifest.record.content.input);
  if (!same(outcome.record.flags,experimentOutcomeFlags(outcome.author,manifest.author,outcome.record.content.claim)) || Date.parse(outcome.createdAt) < Date.parse(manifest.createdAt)) throw Error('Public outcome flags or creation order differ.');
 }
 const response = await fetch('/api/strategies?id=' + encodeURIComponent(manifest.strategy.id),options);
 if (response.status === 404) throw new PublicProgramUnavailable(manifest.strategy.id);
 if (!response.ok) throw Error('Current program source unavailable.');
 const raw = strategyGetSchema.parse(await body(response)).item;
 if (raw.state !== 'VISIBLE' || !raw.record) throw new PublicProgramUnavailable(manifest.strategy.id);
 const source = await verifyProgramSource(manifest.strategy,raw); signal.throwIfAborted();
 if (!same(source.record,manifest.record.content.input.strategy.record) || Date.parse(source.createdAt) > Date.parse(manifest.createdAt)) throw Error('Exact public program bytes or creation order differ.');
 // Complete the heavy digest/input checks before these final bounded exact GETs.
 // Only immutable bytes and monotonic moderation are compared afterward; the
 // independent reads do not constitute an atomic snapshot or future guarantee.
 async function fence(item: ExperimentPublicItem | StrategyPublicItem, strategy: boolean) {
  const response = await fetch((strategy ? '/api/strategies?id=' : '/api/experiments?id=') + encodeURIComponent(item.id),options);
  if (response.status === 404) throw new PublicProgramUnavailable(item.id);
  if (!response.ok) throw Error('Final exact public program observation unavailable.');
  const current = strategy ? strategyGetSchema.parse(await body(response)).item : experimentGetSchema.parse(await body(response)).item;
  signal.throwIfAborted(); assertMemberContinuation(item,current); return current;
 }
 const [freshManifest,freshOutcome,freshSource] = await Promise.all([fence(manifest,false),outcome ? fence(outcome,false) : Promise.resolve(null),fence(source,true)]);
 signal.throwIfAborted();
 return {reference,manifest:freshManifest as PublicProgramContext['manifest'],outcome:freshOutcome as ExperimentPublicItem | null,source:freshSource as StrategyPublicItem};
}

export function assertPublicProgramContinuation(previous: PublicProgramContext, next: PublicProgramContext) {
 if (!same(previous.reference,next.reference) || Boolean(previous.outcome) !== Boolean(next.outcome)) throw Error('The exact public program evidence changed.');
 for (const [before,after] of [[previous.manifest,next.manifest],[previous.outcome,next.outcome],[previous.source,next.source]] as const) {
  if (!before || !after) continue;
  assertMemberContinuation(before,after);
 }
 return next;
}
