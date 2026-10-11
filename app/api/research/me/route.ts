import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isResearchModerator} from '@/app/research-config';
import {researchMeRequest,researchHeaders} from '@/app/research-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await researchMeRequest(request,await getChatGPTUser(),isResearchModerator);}
 catch{return Response.json({error:'Research identity unavailable.'},{status:503,headers:researchHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
