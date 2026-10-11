import {getChatGPTUser} from '../chatgpt-auth';
import Session from '../session';
import ProgramSessionWorkspace from '../program-session-workspace';

export const dynamic = 'force-dynamic';

export default async function SessionPage({searchParams}: {searchParams?: Promise<{method?: string}>}) {
  const user = await getChatGPTUser();
  const query=await searchParams;
  return query?.method==='programs'?<ProgramSessionWorkspace signedIn={!!user}/>:<Session signedIn={!!user}/>;
}
