import SearchWorkspace from '../search-workspace';
import {getChatGPTUser} from '../chatgpt-auth';
import ProgramSearchMethodWorkspace from '../program-search-method-workspace';
import {programProductMethod} from '../program-product-method';

export const dynamic='force-dynamic';
export default async function SearchPage({searchParams}:{searchParams?:Promise<{method?:string|string[];selection?:string|string[]}>}={}){const user=await getChatGPTUser(),query=await searchParams;let selected;try{selected=programProductMethod(query?.selection);if(query?.method!==undefined&&query.method!=='programs'||selected==='DIRECTION'&&query?.method!=='programs')throw Error();}catch{return <main><a href="/search">Open Search</a><p>Unknown program method. Choose a supported method before importing evidence.</p></main>;}return query?.method==='programs'?<ProgramSearchMethodWorkspace signedIn={!!user} initialMethod={selected}/>:<SearchWorkspace signedIn={!!user}/>;}
