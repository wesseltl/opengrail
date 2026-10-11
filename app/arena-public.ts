import {parseUniqueJson} from './unique-json';
import {experimentGetSchema, experimentReferenceSchema, experimentInputStrategy, experimentManifestFlags, experimentOutcomeFlags, validateExperimentItem, verifyExperimentArtifact, type ExperimentPublicItem} from './experiment-model';
import {boundedStrategyRecord, strategyDigest, strategyGetSchema, type StrategyPublicItem} from './strategy-model';
import {experimentReviewCommandForRecord, experimentReviewGetSchema, experimentReviewListSchema, experimentReviewSummarySchema, validateExperimentReviewBindings, validateExperimentReviewItem, type ExperimentReviewPublicItem, type ExperimentReviewSummary, type ExperimentReviewVerificationMemo} from './experiment-review-model';
import type {ArenaMember} from './arena-model';

export const arenaPublicReferenceSchema = experimentReferenceSchema;
export const arenaPublicReadLimits = {reviews: 32, concurrency: 4, requests: 224, bytes: 67_108_864, durationMs: 120_000, requestMs: 15_000, experimentBytes: 1_048_576, strategyBytes: 65_536, reviewBytes: 393_216} as const;
export type ArenaPublicScope = 'OUTCOME' | 'MANIFEST' | 'STRATEGY' | 'ORIGINAL' | 'REVIEWS' | 'NETWORK';
export type ArenaPublicResource = 'EXPERIMENT' | 'STRATEGY' | 'REVIEW';
type Reference = {id: string; digest: string};
export class ArenaPublicUnavailable extends Error {
  constructor(message: string, public scope: ArenaPublicScope, public suppressed = false, public reference?: Reference, public resourceKind: ArenaPublicResource | null = scope === 'NETWORK' ? null : scope === 'STRATEGY' ? 'STRATEGY' : scope === 'REVIEWS' ? 'REVIEW' : 'EXPERIMENT') {super(message); this.name = 'ArenaPublicUnavailable';}
}
export type ArenaPublicMember = ArenaMember & {reviewContext: {
  original: Reference;
  originalItem: ExperimentPublicItem;
  items: ExperimentReviewSummary[];
  currentHead: ExperimentReviewPublicItem | null;
  dependencies: ExperimentPublicItem[];
  lifecycle: Pick<ExperimentReviewPublicItem, 'id' | 'digest' | 'state' | 'moderation'>[];
}};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ref = (value: Reference): Reference => ({id: value.id, digest: value.digest});
export function sameArenaPublicMember(a: ArenaPublicMember, b: ArenaPublicMember) {return same(a, b);}
function fail(scope: ArenaPublicScope, reference: Reference, message = 'Exact arena evidence is unavailable or inconsistent.'): never {throw new ArenaPublicUnavailable(message, scope, false, reference);}
function visible(item: {state: string; record: unknown}, scope: ArenaPublicScope, reference: Reference, resourceKind: ArenaPublicResource) {
  if (item.state !== 'VISIBLE' || !item.record) throw new ArenaPublicUnavailable('Exact arena source is suppressed. Retained dependent payloads must be cleared.', scope, true, reference, resourceKind);
}
function reviewSuppression(current: ExperimentReviewSummary[], known: ExperimentReviewSummary[]) {
  const affected = current.find(item => item.state !== 'VISIBLE' && known.some(previous => previous.id === item.id && previous.state === 'VISIBLE'));
  if (affected) throw new ArenaPublicUnavailable('Exact arena review became suppressed. Retained dependent payloads must be cleared.', 'REVIEWS', true, ref(affected));
}

/** Fixed same-origin public GETs only. Two complete passes detect changes observed
 * while reading; they do not freeze the registry or attest future visibility. */
export async function readArenaMember(raw: Reference, signal: AbortSignal): Promise<ArenaPublicMember> {
  let reference: Reference;
  try {reference = arenaPublicReferenceSchema.parse(raw);} catch {throw new ArenaPublicUnavailable('Use one exact outcome ID and digest.', 'OUTCOME');}
  const active = AbortSignal.any([signal, AbortSignal.timeout(arenaPublicReadLimits.durationMs)]);
  let requests = 0, totalBytes = 0;
  const check = () => {if (active.aborted) throw new ArenaPublicUnavailable('Arena evidence read was interrupted. No partial member was accepted.', 'NETWORK');};
  async function guarded<T>(scope: ArenaPublicScope, target: Reference, operation: () => Promise<T>): Promise<T> {
    try {check(); const value = await operation(); check(); return value;} catch (error) {
      if (error instanceof ArenaPublicUnavailable) throw error;
      check(); throw new ArenaPublicUnavailable('Exact arena evidence is unavailable or inconsistent.', scope, false, target);
    }
  }
  async function json(path: string, maximum: number, scope: ArenaPublicScope, target: Reference) {
    return guarded(scope, target, async () => {
      if (++requests > arenaPublicReadLimits.requests) throw new ArenaPublicUnavailable('Arena evidence exceeded its request budget. No history was trimmed.', scope, false, target);
      const response = await fetch(path, {cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.any([active, AbortSignal.timeout(arenaPublicReadLimits.requestMs)])});
      if (!response.ok || response.redirected || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(scope, target);
      const declared = response.headers.get('Content-Length');
      if (declared !== null && (!/^(?:0|[1-9]\d*)$/.test(declared) || Number(declared) > maximum)) fail(scope, target);
      const reader = response.body?.getReader(); if (!reader) fail(scope, target);
      const chunks: Uint8Array[] = []; let size = 0;
      try {for (;;) {
        check(); const result = await reader.read(); check(); if (result.done) break;
        size += result.value.byteLength; totalBytes += result.value.byteLength;
        if (size > maximum || totalBytes > arenaPublicReadLimits.bytes) {await reader.cancel(); throw new ArenaPublicUnavailable('Arena evidence exceeded its byte budget. No history was trimmed.', scope, false, target);}
        chunks.push(result.value);
      }} finally {reader.releaseLock();}
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
      return parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), maximum, 16);
    });
  }
  async function experiment(target: Reference, scope: ArenaPublicScope) {
    return guarded(scope, target, async () => {
      const item = await validateExperimentItem(experimentGetSchema.parse(await json('/api/experiments?id=' + target.id, arenaPublicReadLimits.experimentBytes, scope, target)).item);
      if (!same(ref(item), target)) fail(scope, target); visible(item, scope, target, 'EXPERIMENT'); return item;
    });
  }
  async function source(target: Reference) {
    return guarded('STRATEGY', target, async () => {
      const item = strategyGetSchema.parse(await json('/api/strategies?id=' + target.id, arenaPublicReadLimits.strategyBytes, 'STRATEGY', target)).item;
      if (!same(ref(item), target)) fail('STRATEGY', target); visible(item, 'STRATEGY', target, 'STRATEGY');
      if (!item.record || await strategyDigest(boundedStrategyRecord(item.record).payload) !== item.digest) fail('STRATEGY', target); return item;
    });
  }
  async function bindOutcome(item: ExperimentPublicItem, manifest: ExperimentPublicItem, strategy: StrategyPublicItem, scope: ArenaPublicScope) {
    return guarded(scope, ref(item), async () => {
      const result = item.record, parent = manifest.record;
      if (result?.type !== 'OUTCOME' || parent?.type !== 'MANIFEST' || !strategy.record || result.version !== parent.version || !same(item.manifest, ref(manifest)) || !same(item.strategy, ref(strategy)) || !same(manifest.strategy, ref(strategy))) fail(scope, ref(item));
      if (result.createdAt < parent.createdAt || parent.createdAt < strategy.createdAt || !same(result.flags, experimentOutcomeFlags(item.author, manifest.author, result.content.claim)) || !same(parent.flags, experimentManifestFlags(parent.content.disclosures))) fail(scope, ref(item));
      const inputSource = experimentInputStrategy(parent.content.input);
      if (!same(inputSource, {record: strategy.record, digest: strategy.digest})) fail('STRATEGY', ref(strategy));
      if (result.content.result.kind === 'ARTIFACT') await verifyExperimentArtifact(result.content.result.artifact, parent.content.input);
    });
  }
  async function batch<T, R>(values: T[], operation: (value: T) => Promise<R>): Promise<R[]> {
    const output: R[] = [];
    for (let index = 0; index < values.length; index += arenaPublicReadLimits.concurrency) {
      const settled = await Promise.allSettled(values.slice(index, index + arenaPublicReadLimits.concurrency).map(operation));
      // Inspect every settled request. Known suppression takes precedence over a
      // transient sibling error so the caller can clear all dependent payloads.
      const rejected = settled.filter((value): value is PromiseRejectedResult => value.status === 'rejected');
      if (rejected.length) throw rejected.find(value => value.reason instanceof ArenaPublicUnavailable && value.reason.suppressed)?.reason ?? rejected[0].reason;
      output.push(...settled.map(value => (value as PromiseFulfilledResult<R>).value)); check();
    }
    return output;
  }
  let checkedReviews: ExperimentReviewPublicItem[] = [];
  async function pass(): Promise<ArenaPublicMember> {
    const outcome = await experiment(reference, 'OUTCOME');
    if (outcome.record?.type !== 'OUTCOME' || !outcome.manifest) fail('OUTCOME', reference, 'Arena selection requires an exact outcome.');
    const [manifest, strategy] = await batch([0, 1], async kind => kind === 0 ? experiment(outcome.manifest!, 'MANIFEST') : source(outcome.strategy)) as [ExperimentPublicItem, StrategyPublicItem];
    await bindOutcome(outcome, manifest, strategy, 'OUTCOME');
    const relation = outcome.record.content.claim.relation;
    const original = relation ? await experiment(ref(relation), 'ORIGINAL') : outcome;
    await bindOutcome(original, manifest, strategy, 'ORIGINAL');
    if (original.record?.type !== 'OUTCOME' || original.record.content.claim.type !== 'ORIGINAL' || original.record.content.claim.relation !== null || original.createdAt > outcome.createdAt) fail('ORIGINAL', ref(original));
    const target = ref(original), items: ExperimentReviewSummary[] = [];
    let cursor: string | null = null, head: {id: string; digest: string; sequence: number} | null = null;
    for (let pageNumber = 0; ; pageNumber++) {
      if (pageNumber > 1) fail('REVIEWS', target, 'Review history exceeded its retained bound.');
      const page = await guarded('REVIEWS', target, async () => experimentReviewListSchema.parse(await json('/api/experiments/reviews?outcome=' + target.id + '&digest=' + target.digest + (cursor ? '&cursor=' + cursor : ''), arenaPublicReadLimits.reviewBytes, 'REVIEWS', target)));
      if (!same(page.target, target) || pageNumber && !same(page.currentHead, head)) fail('REVIEWS', target, 'Review head changed during pagination.');
      if (!pageNumber) head = page.currentHead;
      for (const item of page.items) {
        const previous = items.at(-1);
        if (items.some(known => known.id === item.id || known.sequence === item.sequence) || !same(item.target.manifest, ref(manifest)) || !same(item.target.strategy, ref(strategy)) || previous && (item.createdAt > previous.createdAt || item.createdAt === previous.createdAt && item.id >= previous.id)) fail('REVIEWS', target);
        items.push(item);
      }
      if (items.length > arenaPublicReadLimits.reviews || page.nextCursor === cursor && cursor !== null || page.nextCursor && !page.items.length) fail('REVIEWS', target);
      if (page.nextCursor === null) break; cursor = page.nextCursor;
    }
    if (head ? items.length !== head.sequence || !items.some(item => same(ref(item), ref(head)) && item.sequence === head.sequence) : items.length !== 0) fail('REVIEWS', target, 'Complete review history does not bind its current head.');
    const reviews = await batch(items, async summary => guarded('REVIEWS', ref(summary), async () => {
      const item = await validateExperimentReviewItem(experimentReviewGetSchema.parse(await json('/api/experiments/reviews?id=' + summary.id + '&digest=' + summary.digest, arenaPublicReadLimits.reviewBytes, 'REVIEWS', ref(summary))).item);
      const {record, moderation: _moderation, ...metadata} = item;
      const actual = experimentReviewSummarySchema.parse({...metadata, reasons: record?.content.reasons ?? []});
      reviewSuppression([actual], [summary]);
      if (!same(summary, actual)) fail('REVIEWS', ref(summary), 'Review projection changed during exact reading.'); return item;
    }));
    const ordered = [...reviews].sort((a, b) => a.sequence - b.sequence);
    for (let index = 0; index < ordered.length; index++) {
      const item = ordered[index], prior = ordered[index - 1];
      if (item.sequence !== index + 1 || !same(item.previous, prior ? ref(prior) : null) || prior && item.createdAt < prior.createdAt) fail('REVIEWS', target, 'Review history is incomplete or inconsistent.');
    }
    const peers = new Map<string, ExperimentPublicItem>([[outcome.id, outcome], [original.id, original]]);
    const peerReferences = reviews.flatMap(item => item.record ? [item.target.reproduction] : []).filter((item, index, all) => !peers.has(item.id) && all.findIndex(value => value.id === item.id) === index);
    for (const item of reviews) if (item.record && !same(item.target.original, target)) fail('REVIEWS', target);
    const dependencies = await batch(peerReferences, async peer => {
      const item = await experiment(peer, 'REVIEWS'); await bindOutcome(item, manifest, strategy, 'REVIEWS'); return item;
    });
    for (const item of dependencies) peers.set(item.id, item);
    const memo: ExperimentReviewVerificationMemo = new Map();
    for (const item of reviews) if (item.record) await guarded('REVIEWS', ref(item), async () => {
      const reproduction = peers.get(item.target.reproduction.id);
      if (!reproduction || !same(ref(reproduction), item.target.reproduction)) fail('REVIEWS', ref(item));
      await validateExperimentReviewBindings(experimentReviewCommandForRecord(item.record!), {original, reproduction, manifest, strategy}, item.author, undefined, memo);
    });
    const currentHead = head ? reviews.find(item => same(ref(item), ref(head))) ?? null : null;
    if (head && !currentHead) fail('REVIEWS', target);
    checkedReviews = reviews;
    return {outcome, manifest, strategy, reviewContext: {original: target, originalItem: original, items, currentHead, dependencies: dependencies.sort((a, b) => a.id.localeCompare(b.id)), lifecycle: reviews.map(item => ({id: item.id, digest: item.digest, state: item.state, moderation: item.moderation}))}};
  }
  const first = await pass(), second = await pass(); check();
  if (!sameArenaPublicMember(first, second)) {
    reviewSuppression(second.reviewContext.items, first.reviewContext.items);
    const oldHead = first.reviewContext.currentHead, newHead = second.reviewContext.currentHead;
    if (newHead && newHead.state !== 'VISIBLE' && (oldHead?.id !== newHead.id || oldHead.state === 'VISIBLE')) throw new ArenaPublicUnavailable('The current arena review head is suppressed. Retained dependent payloads must be cleared.', 'REVIEWS', true, ref(newHead));
    const scope: ArenaPublicScope = !same(first.outcome, second.outcome) ? 'OUTCOME' : !same(first.manifest, second.manifest) ? 'MANIFEST' : !same(first.strategy, second.strategy) ? 'STRATEGY' : 'REVIEWS';
    throw new ArenaPublicUnavailable('Exact arena evidence changed during reading. Refresh and prepare a new comparison.', scope, false, reference);
  }
  // Digest and semantic verification can await substantial local work. Fresh
  // exact bytes at this fence must equal those already checked, so no further
  // hash/evaluator work follows the final public observations. These independent
  // GETs still do not create an atomic registry snapshot.
  const sources: {item: ExperimentPublicItem | StrategyPublicItem; scope: ArenaPublicScope; strategy: boolean}[] = [
    {item: second.outcome, scope: 'OUTCOME', strategy: false}, {item: second.manifest, scope: 'MANIFEST', strategy: false}, {item: second.strategy, scope: 'STRATEGY', strategy: true},
    ...second.reviewContext.originalItem.id !== second.outcome.id ? [{item: second.reviewContext.originalItem, scope: 'ORIGINAL' as const, strategy: false}] : [],
    ...second.reviewContext.dependencies.map(item => ({item, scope: 'REVIEWS' as const, strategy: false})),
  ];
  await batch(sources, async source => guarded(source.scope, ref(source.item), async () => {
    const target = ref(source.item), path = (source.strategy ? '/api/strategies?id=' : '/api/experiments?id=') + target.id;
    const raw = await json(path, source.strategy ? arenaPublicReadLimits.strategyBytes : arenaPublicReadLimits.experimentBytes, source.scope, target);
    const item = source.strategy ? strategyGetSchema.parse(raw).item : experimentGetSchema.parse(raw).item;
    visible(item, source.scope, target, source.strategy ? 'STRATEGY' : 'EXPERIMENT');
    if (!same(item, source.item)) fail(source.scope, target, 'Exact arena source changed after verification.');
  }));
  const target = second.reviewContext.original;
  const expectedHead = second.reviewContext.currentHead ? {...ref(second.reviewContext.currentHead), sequence: second.reviewContext.currentHead.sequence} : null;
  async function fenceReviewPages() {
    const finalItems: ExperimentReviewSummary[] = []; let cursor: string | null = null;
    for (let n = 0; ; n++) {
      if (n > 1) fail('REVIEWS', target);
      const page = await guarded('REVIEWS', target, async () => experimentReviewListSchema.parse(await json('/api/experiments/reviews?outcome=' + target.id + '&digest=' + target.digest + (cursor ? '&cursor=' + cursor : ''), arenaPublicReadLimits.reviewBytes, 'REVIEWS', target)));
      reviewSuppression(page.items, second.reviewContext.items);
      const pageHead = page.items.find(item => item.id === page.currentHead?.id);
      if (pageHead && pageHead.state !== 'VISIBLE' && second.reviewContext.currentHead?.state === 'VISIBLE') throw new ArenaPublicUnavailable('The current arena review head became suppressed.', 'REVIEWS', true, ref(pageHead));
      if (!same(page.target, target) || !same(page.currentHead, expectedHead)) fail('REVIEWS', target, 'Review head changed after verification.');
      finalItems.push(...page.items);
      if (finalItems.length > arenaPublicReadLimits.reviews || page.nextCursor !== null && page.nextCursor === cursor) fail('REVIEWS', target);
      if (page.nextCursor === null) break; cursor = page.nextCursor;
    }
    if (!same(finalItems, second.reviewContext.items)) fail('REVIEWS', target, 'Review history changed after verification.');
  }
  await fenceReviewPages();
  await batch(checkedReviews, async known => guarded('REVIEWS', ref(known), async () => {
    const target = ref(known), current = experimentReviewGetSchema.parse(await json('/api/experiments/reviews?id=' + target.id + '&digest=' + target.digest, arenaPublicReadLimits.reviewBytes, 'REVIEWS', target)).item;
    if (known.state === 'VISIBLE' && current.state !== 'VISIBLE') throw new ArenaPublicUnavailable('Exact arena review became suppressed after verification.', 'REVIEWS', true, target);
    if (!same(current, known)) fail('REVIEWS', target, 'Exact review lifecycle changed after verification.');
  }));
  await fenceReviewPages();
  check();
  return second;
}
