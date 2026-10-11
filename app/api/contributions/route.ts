import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ContributionRepository} from '@/app/contribution-store';
import {isContributionMaintainer} from '@/app/contribution-config';
import {contributionPublicRequest,contributionHumanRequest,contributionHeaders} from '@/app/contribution-http';
export const dynamic='force-dynamic';
const factory=()=>new ContributionRepository(getNetworkDb());
export const GET=(request:Request)=>contributionPublicRequest(request,factory);
export async function POST(request:Request){
 try{return await contributionHumanRequest(request,await getChatGPTUser(),factory,isContributionMaintainer);}
 catch{return Response.json({error:'Contribution identity unavailable.'},{status:503,headers:contributionHeaders});}
}
const unsupported=()=>new Response(null,{status:405,headers:{...contributionHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
