import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {StrategyRepository} from '@/app/strategy-store';
import {isResearchModerator} from '@/app/research-config';
import {strategyReportsRequest,strategyHeaders} from '@/app/strategy-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{return await strategyReportsRequest(request,await getChatGPTUser(),()=>new StrategyRepository(getNetworkDb()),isResearchModerator);}
 catch{return Response.json({error:'Moderation identity unavailable.'},{status:503,headers:strategyHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
