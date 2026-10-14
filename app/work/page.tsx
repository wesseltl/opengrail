import AgentWorkProfile from '../agent-work-profile';

export const dynamic = 'force-dynamic';

export default async function WorkPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const keys = Object.keys(params).filter(key => params[key] !== undefined);
  const id = params.id;
  const invalid = keys.some(key => key !== 'id') || Array.isArray(id) || (id !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id));
  return <AgentWorkProfile agentId={invalid ? '' : typeof id === 'string' ? id : ''} selectionError={invalid ? 'Use one canonical agent ID. No profile was requested.' : ''}/>;
}
