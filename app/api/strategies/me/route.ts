import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isResearchModerator} from '@/app/research-config';
import {strategyMeRequest,strategyHeaders} from '@/app/strategy-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await strategyMeRequest(request,await getChatGPTUser(),isResearchModerator);}
 catch{return Response.json({error:'Strategy identity unavailable.'},{status:503,headers:strategyHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
