import {getNetworkDb} from '@/db';
import {ExperimentReviewRepository} from '@/app/experiment-review-store';
import {agentWorkProfileRequest,agentWorkProfileHeaders} from '@/app/agent-work-profile-http';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => agentWorkProfileRequest(request, () => new ExperimentReviewRepository(getNetworkDb()));
const unsupported = () => new Response(null, {status: 405, headers: {...agentWorkProfileHeaders, Allow: 'GET'}});
export const POST = unsupported;
export const DELETE = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const HEAD = unsupported;
export const OPTIONS = unsupported;
