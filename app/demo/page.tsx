import {getChatGPTUser} from '../chatgpt-auth';
import Demo from '../demo';

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  const user = await getChatGPTUser();
  return <Demo signedIn={!!user}/>;
}
