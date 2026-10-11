import {getChatGPTUser} from '../chatgpt-auth';
import Research from '../research';

export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
  const user = await getChatGPTUser();
  return <Research signedIn={!!user}/>;
}
