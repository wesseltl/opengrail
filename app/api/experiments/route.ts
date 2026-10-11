import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ExperimentRepository} from '@/app/experiment-store';
import {isResearchModerator} from '@/app/research-config';
import {experimentPublicRequest,experimentHumanRequest,experimentHeaders} from '@/app/experiment-http';
export const dynamic='force-dynamic';
const factory=()=>new ExperimentRepository(getNetworkDb());
export const GET=(request:Request)=>experimentPublicRequest(request,factory);
export async function POST(request:Request){
 try{return await experimentHumanRequest(request,await getChatGPTUser(),factory,isResearchModerator);}
 catch{return Response.json({error:'Experiment identity unavailable.'},{status:503,headers:experimentHeaders});}
}
const unsupported=()=>new Response(null,{status:405,headers:{...experimentHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
