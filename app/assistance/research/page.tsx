import {getChatGPTUser} from '../../chatgpt-auth';
import ResearchAssistance from '../../research-assistance';
import {parseResearchAssistanceLink} from '../../research-assistance-link';

export const dynamic='force-dynamic';
export default async function ResearchAssistancePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}={}){
 const user=await getChatGPTUser(),query=new URLSearchParams();for(const [key,value]of Object.entries(await searchParams??{}))for(const entry of Array.isArray(value)?value:value===undefined?[]:[value])query.append(key,entry);
 let selection:ReturnType<typeof parseResearchAssistanceLink>=null,selectionError='';try{selection=parseResearchAssistanceLink(query);}catch{selectionError='Invalid research assistance link. Select one exact base or request, domain and digest.';}
 return <ResearchAssistance signedIn={!!user} selection={selection} selectionError={selectionError}/>;
}
