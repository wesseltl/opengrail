import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ExperimentReviewRepository} from '@/app/experiment-review-store';
import {isResearchModerator} from '@/app/research-config';
import {experimentReviewReportsRequest,experimentReviewHeaders} from '@/app/experiment-review-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await experimentReviewReportsRequest(request,await getChatGPTUser(),()=>new ExperimentReviewRepository(getNetworkDb()),isResearchModerator);}catch{return Response.json({error:'Experiment review moderation unavailable.'},{status:503,headers:experimentReviewHeaders});}}
const unsupported=()=>new Response(null,{status:405,headers:{...experimentReviewHeaders,Allow:'GET'}});
export const POST=unsupported;
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
