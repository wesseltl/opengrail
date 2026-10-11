import {getChatGPTUser} from '../chatgpt-auth';
import Strategies from '../strategies';
import StrategyEvidence from '../strategy-evidence';
import {strategyEvidenceSelectionFromQuery} from '../strategy-evidence-model';

export const dynamic = 'force-dynamic';

export default async function StrategiesPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>} = {}) {
  const user = await getChatGPTUser();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, entry);
  let selection: ReturnType<typeof strategyEvidenceSelectionFromQuery> = null, selectionError = '';
  try { selection = strategyEvidenceSelectionFromQuery(params); } catch { selectionError = 'Invalid exact strategy link. Use one canonical ID and its digest.'; }
  if (selection || selectionError) return <StrategyEvidence signedIn={!!user} selection={selection} selectionError={selectionError}/>;
  return <Strategies signedIn={!!user}/>;
}
