const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
export type ValidationSelection = {id: string; digest: string | null};
export function validationSelectionFromQuery(query: string | URLSearchParams): ValidationSelection | null {
  const parameters = typeof query === 'string' ? new URLSearchParams(query) : query;
  if (!Array.from(parameters.keys()).length) return null;
  if (Array.from(parameters.keys()).some(key => key !== 'outcome' && key !== 'digest') || parameters.getAll('outcome').length !== 1 || parameters.getAll('digest').length > 1) throw Error('Use one exact outcome and optional digest.');
  const id = parameters.get('outcome'), digest = parameters.get('digest');
  if (!id || !uuid.test(id) || digest !== null && !hash.test(digest)) throw Error('Invalid outcome reference.');
  return {id, digest};
}
export function validationHref(selection: ValidationSelection | null): string {
  if (!selection) return '/validation';
  const parameters = new URLSearchParams({outcome: selection.id});
  if (selection.digest !== null) parameters.set('digest', selection.digest);
  validationSelectionFromQuery(parameters);
  return '/validation?' + parameters.toString();
}
