import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isResearchModerator} from '@/app/research-config';
import {experimentMeRequest,experimentHeaders} from '@/app/experiment-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await experimentMeRequest(request,await getChatGPTUser(),isResearchModerator);}
 catch{return Response.json({error:'Experiment identity unavailable.'},{status:503,headers:experimentHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
export const PUT=handle;
export const PATCH=handle;
export const HEAD=handle;
export const OPTIONS=handle;
