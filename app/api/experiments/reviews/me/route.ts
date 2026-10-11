import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isExperimentReviewer} from '@/app/experiment-review-config';
import {isResearchModerator} from '@/app/research-config';
import {experimentReviewMeRequest,experimentReviewHeaders} from '@/app/experiment-review-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await experimentReviewMeRequest(request,await getChatGPTUser(),isExperimentReviewer,isResearchModerator);}catch{return Response.json({error:'Experiment review identity unavailable.'},{status:503,headers:experimentReviewHeaders});}}
const unsupported=()=>new Response(null,{status:405,headers:{...experimentReviewHeaders,Allow:'GET'}});
export const POST=unsupported;
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
