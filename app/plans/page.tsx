import {getChatGPTUser} from '../chatgpt-auth';
import ProgramForwardPlanner from '../program-forward-planner';

export const dynamic='force-dynamic';
export default async function PlansPage(){const user=await getChatGPTUser();return <ProgramForwardPlanner signedIn={!!user}/>;}
