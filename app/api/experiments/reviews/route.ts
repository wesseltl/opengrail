import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ExperimentReviewRepository} from '@/app/experiment-review-store';
import {isExperimentReviewer} from '@/app/experiment-review-config';
import {isResearchModerator} from '@/app/research-config';
import {experimentReviewPublicRequest,experimentReviewHumanRequest,experimentReviewHeaders} from '@/app/experiment-review-http';
export const dynamic='force-dynamic';
const factory=()=>new ExperimentReviewRepository(getNetworkDb());
export const GET=(request:Request)=>experimentReviewPublicRequest(request,factory);
export async function POST(request:Request){try{return await experimentReviewHumanRequest(request,await getChatGPTUser(),factory,isExperimentReviewer,isResearchModerator);}catch{return Response.json({error:'Experiment review identity unavailable.'},{status:503,headers:experimentReviewHeaders});}}
const unsupported=()=>new Response(null,{status:405,headers:{...experimentReviewHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const HEAD=unsupported;
export const OPTIONS=unsupported;
