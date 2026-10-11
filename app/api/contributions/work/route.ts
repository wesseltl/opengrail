import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ContributionRepository} from '@/app/contribution-store';
import {contributionWorkHumanRequest,contributionWorkHeaders,contributionWorkUnavailable} from '@/app/contribution-work-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return await contributionWorkHumanRequest(request,await getChatGPTUser(),()=>new ContributionRepository(getNetworkDb()),getChatGPTUser);}
 catch{return contributionWorkUnavailable();}
}
const unsupported=()=>new Response(null,{status:405,headers:{...contributionWorkHeaders,Allow:'GET'}});
export const POST=unsupported;
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
