import {getChatGPTUser} from '../../chatgpt-auth';
import StrategyLineage from '../../strategy-lineage';
import {strategyLineageSelectionFromQuery} from '../../strategy-lineage-model';

export const dynamic = 'force-dynamic';

export default async function StrategyLineagePage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>} = {}) {
 const user = await getChatGPTUser(), params = new URLSearchParams();
 for (const [key, value] of Object.entries(await searchParams ?? {})) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
 let selection: ReturnType<typeof strategyLineageSelectionFromQuery> = null, selectionError = '';
 try { selection = strategyLineageSelectionFromQuery(params); } catch { selectionError = 'Invalid exact lineage link. Use one canonical strategy ID and its digest.'; }
 return <StrategyLineage signedIn={!!user} selection={selection} selectionError={selectionError}/>;
}
