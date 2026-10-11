import {getChatGPTUser} from '../chatgpt-auth';
import Experiments from '../experiments';
import {experimentSelectionFromQuery, type ExperimentSelection} from '../experiment-link';

export const dynamic = 'force-dynamic';

export default async function ExperimentsPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const user = await getChatGPTUser();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, entry);
  let selection: ExperimentSelection | null = null, selectionError = '';
  try { selection = experimentSelectionFromQuery(params); } catch { selectionError = 'Invalid exact experiment link. Use one canonical ID and its digest.'; }
  return <Experiments signedIn={!!user} selection={selection} selectionError={selectionError}/>;
}
