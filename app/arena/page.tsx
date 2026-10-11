import {getChatGPTUser} from '../chatgpt-auth';
import Arena from '../arena';
import {arenaSelectionFromQuery} from '../arena-link';

export const dynamic = 'force-dynamic';

export default async function ArenaPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  let selection = null, selectionError = false;
  try { selection = arenaSelectionFromQuery(query); } catch { selectionError = true; }
  const user = await getChatGPTUser();
  return <Arena selection={selection} selectionError={selectionError} signedIn={!!user}/>;
}
