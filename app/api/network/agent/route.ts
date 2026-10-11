import {getNetworkDb} from '@/db';
import {NetworkRepository} from '@/app/network-store';
import {networkAgentRequest} from '@/app/network-http';
export const dynamic='force-dynamic';
const handle=(request:Request)=>networkAgentRequest(request,()=>new NetworkRepository(getNetworkDb()));
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
