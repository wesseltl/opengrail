import {researchRelationSchema} from './research-model';

export type ResearchSelection = {id: string; digest: string};
export function researchSelection(raw: unknown): ResearchSelection {
  const relation = researchRelationSchema.parse({...((raw && typeof raw === 'object') ? raw : {}), type: 'FORK'});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'digest,id') throw Error('Invalid exact research reference.');
  return {id: relation.id, digest: relation.digest};
}
export function researchThreadLocation(search: string): ResearchSelection | null {
  if (typeof search !== 'string' || search.length > 512 || (search && !search.startsWith('?'))) throw Error('Invalid research link.');
  if (!search) return null;
  const query = new URLSearchParams(search);
  const names = [...query.keys()];
  if (names.length !== 2 || new Set(names).size !== 2 || !query.has('id') || !query.has('digest')) throw Error('Use an exact research ID and digest.');
  return researchSelection({id: query.get('id'), digest: query.get('digest')});
}
export function researchThreadHref(raw: ResearchSelection): string {
  const value = researchSelection(raw);
  return '/research?id=' + value.id + '&digest=' + value.digest;
}
export function researchThreadRequest(raw: ResearchSelection, cursor: string | null = null): string {
  const value = researchSelection(raw);
  if (cursor !== null) researchSelection({id: cursor, digest: value.digest});
  return '/api/research?target=' + value.id + '&digest=' + value.digest + (cursor ? '&cursor=' + cursor : '');
}
