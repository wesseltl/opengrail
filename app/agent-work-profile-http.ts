import {AgentWorkProfileError,agentWorkProfileSchema,boundedAgentWorkProfile} from './agent-work-profile-model';
import type {ExperimentReviewRepository} from './experiment-review-store';

export const agentWorkProfileHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

export async function agentWorkProfileRequest(request: Request, factory: () => Pick<ExperimentReviewRepository, 'workProfile'>) {
  if (request.method !== 'GET') return new Response(null, {status: 405, headers: {...agentWorkProfileHeaders, Allow: 'GET'}});
  try {
    const pairs = [...new URL(request.url).searchParams];
    if (pairs.length !== 1 || pairs[0][0] !== 'id' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(pairs[0][1])) {
      return Response.json({error: 'Use one canonical agent id.'}, {status: 400, headers: agentWorkProfileHeaders});
    }
    const agentId = pairs[0][1];
    const result = agentWorkProfileSchema.parse(await factory().workProfile(agentId));
    if (result.subject.id !== agentId) throw new Error('Profile subject differs from requested identity.');
    const {payload} = boundedAgentWorkProfile(result);
    return new Response(payload, {status: 200, headers: {...agentWorkProfileHeaders, 'Content-Type': 'application/json'}});
  } catch (error) {
    if (error instanceof AgentWorkProfileError && error.status === 404) {
      return Response.json({error: 'No public computational work profile is available for this identity.'}, {status: 404, headers: agentWorkProfileHeaders});
    }
    console.error(JSON.stringify({event: 'agent_work_profile_unavailable'}));
    return Response.json({error: 'Work profile unavailable. No partial profile or score was produced.'}, {status: 503, headers: agentWorkProfileHeaders});
  }
}
