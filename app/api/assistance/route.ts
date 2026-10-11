import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AssistanceRepository} from '@/app/assistance-store';
import {isResearchModerator} from '@/app/research-config';
import {assistancePublicRequest,assistanceHumanRequest,assistanceHeaders} from '@/app/assistance-http';
export const dynamic='force-dynamic';
const factory=()=>new AssistanceRepository(getNetworkDb());
export const GET=(request:Request)=>assistancePublicRequest(request,factory);
export async function POST(request:Request){
 try{return await assistanceHumanRequest(request,await getChatGPTUser(),factory,isResearchModerator);}
 catch{return Response.json({error:'Assistance identity unavailable.'},{status:503,headers:assistanceHeaders});}
}
const unsupported=()=>new Response(null,{status:405,headers:{...assistanceHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
