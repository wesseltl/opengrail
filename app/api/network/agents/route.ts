import {getNetworkDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {NetworkRepository} from '@/app/network-store';
import {networkOwnerRequest,networkHeaders} from '@/app/network-http';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{const actor=await getChatGPTUser();return await networkOwnerRequest(request,actor,()=>new NetworkRepository(getNetworkDb()));}
 catch{return Response.json({error:'Agent enrollment access unavailable.'},{status:503,headers:networkHeaders});}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
