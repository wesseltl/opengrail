import {getChatGPTUser} from '../chatgpt-auth';
import ProgramForwardPlanner from '../program-forward-planner';
import ProgramDirectionForwardPlanner from '../program-direction-forward-planner';
import {programProductMethod} from '../program-product-method';

export const dynamic='force-dynamic';
export default async function PlansPage({searchParams}:{searchParams?:Promise<{selection?:string|string[]}>}={}){const user=await getChatGPTUser();let selected;try{selected=programProductMethod((await searchParams)?.selection);}catch{return <main><a href="/plans">Open Plans</a><p>Unknown program method. The original plan has not been converted.</p></main>;}return selected==='DIRECTION'?<ProgramDirectionForwardPlanner signedIn={!!user}/>:<ProgramForwardPlanner signedIn={!!user}/>;}
