import {getChatGPTUser} from '../chatgpt-auth';
import ProgramForwardPlanner from '../program-forward-planner';
import ProgramDirectionForwardPlanner from '../program-direction-forward-planner';
import {programProductMethod} from '../program-product-method';
import ProgramWindowPlanner from '../program-window-planner';

export const dynamic='force-dynamic';
export default async function PlansPage({searchParams}:{searchParams?:Promise<{selection?:string|string[];window?:string|string[]}>}={}){const user=await getChatGPTUser(),query=await searchParams;if(query?.window!==undefined){if(query.window!=='sampled-v1'||query.selection!==undefined)return <main><a href="/plans">Open Plans</a><p>Choose one exact plan method. The original plan has not been converted.</p></main>;return <ProgramWindowPlanner signedIn={!!user}/>;}let selected;try{selected=programProductMethod(query?.selection);}catch{return <main><a href="/plans">Open Plans</a><p>Unknown program method. The original plan has not been converted.</p></main>;}return selected==='DIRECTION'?<ProgramDirectionForwardPlanner signedIn={!!user}/>:<ProgramForwardPlanner signedIn={!!user}/>;}
