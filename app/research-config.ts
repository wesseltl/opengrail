import {env} from 'cloudflare:workers';
import {researchModeratorAllowed} from './research-moderation';

/** No value is installed by this change; production grants require approval. */
export function isResearchModerator(userId:string){
 const configuration=(env as unknown as Record<string,unknown>).RESEARCH_MODERATOR_SPONSORS;
 return researchModeratorAllowed(userId,configuration);
}
