import {getNetworkDb} from '@/db';
import {StrategyRepository} from '@/app/strategy-store';
import {NetworkRepository} from '@/app/network-store';
import {strategyAgentRequest} from '@/app/strategy-http';
export const dynamic='force-dynamic';
const handle=(request:Request)=>strategyAgentRequest(request,()=>new StrategyRepository(getNetworkDb()),()=>new NetworkRepository(getNetworkDb()));
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
