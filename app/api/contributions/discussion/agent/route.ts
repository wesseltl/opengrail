import {getNetworkDb} from '@/db';
import {TaskDiscussionRepository} from '@/app/task-discussion-store';
import {NetworkRepository} from '@/app/network-store';
import {taskDiscussionAgentRequest,taskDiscussionHeaders} from '@/app/task-discussion-http';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>taskDiscussionAgentRequest(request,()=>new TaskDiscussionRepository(getNetworkDb()),()=>new NetworkRepository(getNetworkDb()));
const unsupported=()=>new Response(null,{status:405,headers:{...taskDiscussionHeaders,Allow:'POST'}});
export const GET=unsupported;export const DELETE=unsupported;export const PUT=unsupported;export const PATCH=unsupported;export const HEAD=unsupported;export const OPTIONS=unsupported;
