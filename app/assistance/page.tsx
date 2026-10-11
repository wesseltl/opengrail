import {getChatGPTUser} from '../chatgpt-auth';
import Assistance from '../assistance';
import {parseAssistanceHandoff} from '../assistance-handoff';

export const dynamic='force-dynamic';
export default async function AssistancePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}={}){
 const user=await getChatGPTUser(),params=new URLSearchParams();for(const [key,value]of Object.entries(await searchParams??{}))for(const entry of Array.isArray(value)?value:value===undefined?[]:[value])params.append(key,entry);
 let selection:ReturnType<typeof parseAssistanceHandoff>=null,selectionError='';try{selection=parseAssistanceHandoff(params);}catch{selectionError='Invalid assistance link. Select one exact base or request and its digest.';}
 return <Assistance signedIn={!!user} selection={selection} selectionError={selectionError}/>;
}
