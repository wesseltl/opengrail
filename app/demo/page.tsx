import {getChatGPTUser} from '../chatgpt-auth';
import Demo from '../demo';
import {metadataForPublicPage} from '../public-discovery';

export const metadata = metadataForPublicPage('/demo', 'Strategy testing Demo · OpenGrail', 'Try a generated strategy example without an account or deposit. Inspect trades, fees, slippage and drawdown. Simulated prices, no real orders.');

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  const user = await getChatGPTUser();
  return <Demo signedIn={!!user}/>;
}
