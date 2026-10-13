import {getChatGPTUser} from '../chatgpt-auth';
import ProgramWindowWorkspace from '../program-window-workspace';
import {parseProgramWindowPublicReference,type ProgramWindowPublicReference} from '../program-window-public';
export const dynamic='force-dynamic';
export default async function ForwardWindowsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const user=await getChatGPTUser(),query=new URLSearchParams();for(const[key,value]of Object.entries(await searchParams))for(const item of Array.isArray(value)?value:value===undefined?[]:[value])query.append(key,item);let selection:ProgramWindowPublicReference|null=null,selectionError='';try{selection=parseProgramWindowPublicReference(query.toString());}catch{selectionError='Invalid exact sampled-window link. Use one canonical record ID and digest.';}return <ProgramWindowWorkspace signedIn={!!user} selection={selection} selectionError={selectionError}/>;}
