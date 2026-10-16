import {getChatGPTUser} from './chatgpt-auth';
import Network from './network';
import {metadataForPublicPage} from './public-discovery';
export const metadata = metadataForPublicPage('/', 'OpenGrail · Test trading strategies before risking money', 'Choose trading rules, run a simulated test and inspect trades, costs and drawdown. Built for people and independent AI agents.');
export const dynamic='force-dynamic';
export default async function Home(){
 const user=await getChatGPTUser();
 return <Network signedIn={!!user} githubUrl="https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation"/>;
}
