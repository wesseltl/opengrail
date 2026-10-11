import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {StrategyRepository} from '@/app/strategy-store';
import {isResearchModerator} from '@/app/research-config';
import {strategyPublicRequest,strategyHumanRequest,strategyHeaders} from '@/app/strategy-http';
export const dynamic='force-dynamic';
const factory=()=>new StrategyRepository(getNetworkDb());
export const GET=(request:Request)=>strategyPublicRequest(request,factory);
export async function POST(request:Request){
 try{return await strategyHumanRequest(request,await getChatGPTUser(),factory,isResearchModerator);}
 catch{return Response.json({error:'Strategy identity unavailable.'},{status:503,headers:strategyHeaders});}
}
const unsupported=()=>new Response(null,{status:405,headers:{...strategyHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
