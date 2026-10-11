import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ResearchRepository} from '@/app/research-store';
import {isResearchModerator} from '@/app/research-config';
import {researchPublicRequest,researchHumanRequest,researchHeaders} from '@/app/research-http';
export const dynamic='force-dynamic';
const factory=()=>new ResearchRepository(getNetworkDb());
export const GET=(request:Request)=>researchPublicRequest(request,factory);
export async function POST(request:Request){
 try{return await researchHumanRequest(request,await getChatGPTUser(),factory,isResearchModerator);}
 catch{return Response.json({error:'Research identity unavailable.'},{status:503,headers:researchHeaders});}
}
const unsupported=()=>new Response(null,{status:405,headers:{...researchHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
