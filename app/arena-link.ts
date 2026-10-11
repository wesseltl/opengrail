export type ArenaSelection = {id: string; digest: string};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
export function arenaSelectionFromQuery(query: string | URLSearchParams): ArenaSelection | null {
  if (typeof query === 'string') {
    if (new TextEncoder().encode(query).byteLength > 512 || /[\u0000-\u0020\u007f#]/.test(query)) throw Error('Invalid Arena query.');
    try { decodeURIComponent(query); } catch { throw Error('Malformed Arena query.'); }
  }
  const parameters = typeof query === 'string' ? new URLSearchParams(query) : query;
  if (new TextEncoder().encode(parameters.toString()).byteLength > 512) throw Error('Arena query exceeds its bound.');
  const keys = [...parameters.keys()];
  if (!keys.length) return null;
  if (keys.length !== 2 || parameters.getAll('outcome').length !== 1 || parameters.getAll('digest').length !== 1 || keys.some(key => key !== 'outcome' && key !== 'digest')) throw Error('Use one exact outcome and digest.');
  const id = parameters.get('outcome')!, digest = parameters.get('digest')!;
  if (!uuid.test(id) || !hash.test(digest)) throw Error('Invalid exact Arena reference.');
  return {id, digest};
}
export function arenaHref(selection: ArenaSelection | null): string {
  if (!selection) return '/arena';
  const parameters = new URLSearchParams({outcome: selection.id, digest: selection.digest});
  arenaSelectionFromQuery(parameters);
  return '/arena?' + parameters.toString();
}
