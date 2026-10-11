import {env} from 'cloudflare:workers';
import {experimentReviewerAllowed} from './experiment-review-permission';

/** Prepared only: this change installs no production reviewer permission. */
export function isExperimentReviewer(userId:string){
 const configuration=(env as unknown as Record<string,unknown>).EXPERIMENT_REVIEWER_USER_IDS;
 return experimentReviewerAllowed(userId,configuration);
}
