import {getChatGPTUser} from '../../chatgpt-auth';
import ProgramWindowComparison from '../../program-window-comparison';
export const dynamic='force-dynamic';
export default async function ForwardWindowComparisonPage(){const user=await getChatGPTUser();return <ProgramWindowComparison signedIn={!!user}/>;}
