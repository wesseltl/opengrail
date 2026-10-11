import {getChatGPTUser} from './chatgpt-auth';
import Network from './network';
export const dynamic='force-dynamic';
export default async function Home(){
 const user=await getChatGPTUser();
 return <Network signedIn={!!user} githubUrl={null}/>;
}
