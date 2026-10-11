import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isContributionMaintainer} from '@/app/contribution-config';
import {contributionMeRequest,contributionHeaders} from '@/app/contribution-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return await contributionMeRequest(request,await getChatGPTUser(),isContributionMaintainer);}
 catch{return Response.json({error:'Contribution identity unavailable.'},{status:503,headers:contributionHeaders});}
}
const unsupported=()=>new Response(null,{status:405,headers:{...contributionHeaders,Allow:'GET'}});
export const POST=unsupported;
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
