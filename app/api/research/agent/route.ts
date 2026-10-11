import {getNetworkDb} from '@/db';
import {ResearchRepository} from '@/app/research-store';
import {NetworkRepository} from '@/app/network-store';
import {researchAgentRequest} from '@/app/research-http';
export const dynamic='force-dynamic';
const handle=(request:Request)=>researchAgentRequest(request,()=>new ResearchRepository(getNetworkDb()),()=>new NetworkRepository(getNetworkDb()));
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
