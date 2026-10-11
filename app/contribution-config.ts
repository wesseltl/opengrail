import {env} from 'cloudflare:workers';
import {contributionMaintainerAllowed} from './contribution-permission';

/** Source preparation installs no production maintainer grant. */
export function isContributionMaintainer(userId: string) {
  const configuration = (env as unknown as Record<string, unknown>).CONTRIBUTION_MAINTAINER_USER_IDS;
  return contributionMaintainerAllowed(userId, configuration);
}
