import SearchWorkspace from '../search-workspace';
import {getChatGPTUser} from '../chatgpt-auth';
import ProgramSearchMethodWorkspace from '../program-search-method-workspace';
import {programProductMethod} from '../program-product-method';
import {programDirectionCohortSelectionFromQuery} from '../program-direction-cohort-link';

export const dynamic='force-dynamic';
export default async function SearchPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}={}){
 const user=await getChatGPTUser(),query=await searchParams,params=new URLSearchParams();
 for(const [key,value] of Object.entries(query??{}))for(const entry of Array.isArray(value)?value:value===undefined?[]:[value])params.append(key,entry);
 let selected,initialStrategy;
 try{
  selected=programProductMethod(query?.selection);
  if(query?.method!==undefined&&query.method!=='programs'||selected==='DIRECTION'&&query?.method!=='programs')throw Error();
  if((query?.strategy!==undefined||query?.digest!==undefined)&&(typeof query.strategy!=='string'||typeof query.digest!=='string'))throw Error();
  initialStrategy=programDirectionCohortSelectionFromQuery(params);
 }catch{return <main><a href="/search">Open Search</a><p>Unknown program method or invalid exact cohort link. Choose a supported method before importing evidence.</p></main>;}
 return query?.method==='programs'?<ProgramSearchMethodWorkspace signedIn={!!user} initialMethod={selected} initialStrategy={initialStrategy??undefined}/>:<SearchWorkspace signedIn={!!user}/>;
}
