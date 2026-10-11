import SearchWorkspace from '../search-workspace';
import {getChatGPTUser} from '../chatgpt-auth';

export const dynamic='force-dynamic';
export default async function SearchPage(){const user=await getChatGPTUser();return <SearchWorkspace signedIn={!!user}/>;}
