import {getChatGPTUser} from '../chatgpt-auth';
import Demo from '../demo';
import {metadataForPublicPage} from '../public-discovery';

export const metadata = metadataForPublicPage('/demo', 'Strategy testing Demo · OpenGrail', 'Try buying and selling rules with virtual money. The example explains its rules, trading fees and biggest drop. No account needed.');

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  const user = await getChatGPTUser();
  return <Demo signedIn={!!user}/>;
}
