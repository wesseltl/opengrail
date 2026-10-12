import {getChatGPTUser} from '../chatgpt-auth';
import Session from '../session';
import ProgramSessionWorkspace from '../program-session-workspace';
import ProgramDirectionSessionWorkspace from '../program-direction-session-workspace';
import {programProductMethod} from '../program-product-method';

export const dynamic = 'force-dynamic';

export default async function SessionPage({searchParams}: {searchParams?: Promise<{method?: string|string[];selection?:string|string[]}>}) {
  const user = await getChatGPTUser();
  const query=await searchParams;
  let selected;try{selected=programProductMethod(query?.selection);if(query?.method!==undefined&&query.method!=='programs'||selected==='DIRECTION'&&query?.method!=='programs')throw Error();}catch{return <main><a href="/session">Open Session</a><p>Unknown program method. No retained plan was converted or executed.</p></main>;}
  return query?.method==='programs'?(selected==='DIRECTION'?<ProgramDirectionSessionWorkspace signedIn={!!user}/>:<ProgramSessionWorkspace signedIn={!!user}/>):<Session signedIn={!!user}/>;
}
