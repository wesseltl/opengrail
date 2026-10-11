import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AssistanceRepository} from '@/app/assistance-store';
import {isResearchModerator} from '@/app/research-config';
import {assistanceReportsRequest,assistanceHeaders} from '@/app/assistance-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await assistanceReportsRequest(request,await getChatGPTUser(),()=>new AssistanceRepository(getNetworkDb()),isResearchModerator);}
 catch{return Response.json({error:'Assistance identity unavailable.'},{status:503,headers:assistanceHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
export const PUT=handle;
export const PATCH=handle;
export const HEAD=handle;
export const OPTIONS=handle;
