import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isResearchModerator} from '@/app/research-config';
import {assistanceMeRequest,assistanceHeaders} from '@/app/assistance-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await assistanceMeRequest(request,await getChatGPTUser(),isResearchModerator);}
 catch{return Response.json({error:'Assistance identity unavailable.'},{status:503,headers:assistanceHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
export const PUT=handle;
export const PATCH=handle;
export const HEAD=handle;
export const OPTIONS=handle;
