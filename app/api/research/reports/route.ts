import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ResearchRepository} from '@/app/research-store';
import {isResearchModerator} from '@/app/research-config';
import {researchReportsRequest,researchHeaders} from '@/app/research-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await researchReportsRequest(request,await getChatGPTUser(),()=>new ResearchRepository(getNetworkDb()),isResearchModerator);}
 catch{return Response.json({error:'Moderation identity unavailable.'},{status:503,headers:researchHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
