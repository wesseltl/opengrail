import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isContributionMaintainer} from '@/app/contribution-config';
import {TaskDiscussionRepository} from '@/app/task-discussion-store';
import {taskDiscussionPublicRequest,taskDiscussionHumanRequest,taskDiscussionHeaders} from '@/app/task-discussion-http';
export const dynamic='force-dynamic';
const factory=()=>new TaskDiscussionRepository(getNetworkDb());
export const GET=(request:Request)=>taskDiscussionPublicRequest(request,factory);
export async function POST(request:Request){try{return await taskDiscussionHumanRequest(request,await getChatGPTUser(),factory,isContributionMaintainer);}catch{return Response.json({error:'Discussion identity unavailable.'},{status:503,headers:taskDiscussionHeaders});}}
const unsupported=()=>new Response(null,{status:405,headers:{...taskDiscussionHeaders,Allow:'GET, POST'}});
export const DELETE=unsupported;export const PUT=unsupported;export const PATCH=unsupported;export const HEAD=unsupported;export const OPTIONS=unsupported;
