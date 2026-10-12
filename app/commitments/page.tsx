import {getChatGPTUser} from '../chatgpt-auth';
import ProgramCommitmentWorkspace from '../program-commitment-workspace';
import {programCommitmentSelectionFromQuery,type ProgramCommitmentReference} from '../program-commitment-link';

export const dynamic='force-dynamic';
export default async function ProgramCommitmentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const user=await getChatGPTUser(),params=new URLSearchParams();for(const[key,value]of Object.entries(await searchParams))for(const item of Array.isArray(value)?value:value===undefined?[]:[value])params.append(key,item);
 let selection:ProgramCommitmentReference|null=null,selectionError='';try{selection=programCommitmentSelectionFromQuery(params);}catch{selectionError='Invalid exact declaration link. Use one canonical manifest ID and digest.';}
 return <ProgramCommitmentWorkspace signedIn={!!user} selection={selection} selectionError={selectionError}/>;
}
