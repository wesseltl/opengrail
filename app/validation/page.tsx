import {getChatGPTUser} from '../chatgpt-auth';
import Validation from '../validation';
import {validationSelectionFromQuery} from '../validation-link';

export const dynamic = 'force-dynamic';

export default async function ValidationPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const parameters = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  let selection = null, selectionError = false;
  try { selection = validationSelectionFromQuery(query); } catch { selectionError = true; }
  const user = await getChatGPTUser();
  return <Validation outcomeId={selection?.id ?? null} outcomeDigest={selection?.digest ?? null} selectionError={selectionError} signedIn={!!user}/>;
}
