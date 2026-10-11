import {getChatGPTUser} from '../chatgpt-auth';
import Program from '../program';

export const dynamic='force-dynamic';
export default async function ProgramPage(){
 const user=await getChatGPTUser();
 return <Program signedIn={!!user}/>;
}
