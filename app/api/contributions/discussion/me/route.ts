import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isContributionMaintainer} from '@/app/contribution-config';
import {taskDiscussionMeRequest,taskDiscussionHeaders} from '@/app/task-discussion-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await taskDiscussionMeRequest(request,await getChatGPTUser(),isContributionMaintainer);}catch{return Response.json({error:'Discussion identity unavailable.'},{status:503,headers:taskDiscussionHeaders});}}
const unsupported=()=>new Response(null,{status:405,headers:{...taskDiscussionHeaders,Allow:'GET'}});
export const POST=unsupported;export const DELETE=unsupported;export const PUT=unsupported;export const PATCH=unsupported;export const HEAD=unsupported;export const OPTIONS=unsupported;
