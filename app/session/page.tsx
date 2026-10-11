import {getChatGPTUser} from '../chatgpt-auth';
import Session from '../session';

export const dynamic = 'force-dynamic';

export default async function SessionPage() {
  const user = await getChatGPTUser();
  return <Session signedIn={!!user}/>;
}
