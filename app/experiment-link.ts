export type ExperimentSelection = {id: string; digest: string; review?: string; reviewDigest?: string};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = /^[0-9a-f]{64}$/;
export function experimentSelectionFromQuery(query: string | URLSearchParams): ExperimentSelection | null {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;
  if (![...params.keys()].length) return null;
  if ([...params.keys()].some(key => !['id', 'digest', 'review', 'reviewDigest'].includes(key)) || params.getAll('id').length !== 1 || params.getAll('digest').length !== 1) throw Error('Use one exact experiment ID and digest.');
  const id = params.get('id')!, digest = params.get('digest')!;
  if (!uuid.test(id) || !hash.test(digest)) throw Error('Invalid exact experiment reference.');
  if (params.has('review') || params.has('reviewDigest')) {
    if (params.getAll('review').length !== 1 || params.getAll('reviewDigest').length !== 1 || !uuid.test(params.get('review')!) || !hash.test(params.get('reviewDigest')!)) throw Error('Invalid exact review reference.');
    return {id, digest, review: params.get('review')!, reviewDigest: params.get('reviewDigest')!};
  }
  return {id, digest};
}
export function experimentHref(selection: ExperimentSelection): string {
  const parsed = experimentSelectionFromQuery(new URLSearchParams(Object.entries({id: selection.id, digest: selection.digest, ...(selection.review !== undefined || selection.reviewDigest !== undefined ? {review: selection.review, reviewDigest: selection.reviewDigest} : {})}).filter((entry): entry is [string, string] => entry[1] !== undefined)));
  return '/experiments?id=' + parsed!.id + '&digest=' + parsed!.digest + (parsed!.review ? '&review=' + parsed!.review + '&reviewDigest=' + parsed!.reviewDigest : '');
}
