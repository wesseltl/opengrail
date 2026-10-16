import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const modelBuild = await build({entryPoints: ['app/agent-quickstart.ts'], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
const q = await import('data:text/javascript;base64,' + Buffer.from(modelBuild.outputFiles[0].text).toString('base64'));
const modelEntry = `export * from './app/network-model';export * from './app/research-model';export {networkIdentitySchema} from './app/network-http';`;
const modelsBuild = await build({stdin: {contents: modelEntry, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false});
const models = await import('data:text/javascript;base64,' + Buffer.from(modelsBuild.outputFiles[0].text).toString('base64'));
const staticBuild = await build({stdin: {contents: `import * as route from './app/api/network/quickstart/route';export default {fetch(request){const handler=route[request.method];return handler?handler(request):new Response(null,{status:405,headers:{Allow:'GET'}});}}`, resolveDir: process.cwd()}, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true});
const staticWorker = new Miniflare({modules: true, script: staticBuild.outputFiles[0].text, compatibilityDate: '2026-05-15'});
const at = new Date(Date.now() - 2000).toISOString(), origin = 'https://quickstart.test';
// Actual existing handlers and local D1. Fixture identity is not proof of hosted Sites sign-in.
const flowSource = `import {networkOwnerRequest,networkAgentRequest} from './app/network-http';import {NetworkRepository} from './app/network-store';import {researchAgentRequest,researchPublicRequest,researchHumanRequest} from './app/research-http';import {ResearchRepository} from './app/research-store';
export default {fetch(request,env){const path=new URL(request.url).pathname,now=()=>env.FIXTURE_AT,network=()=>new NetworkRepository(env.DB),research=()=>new ResearchRepository(env.DB);
if(path==='/api/network/agents'){const user=request.headers.get('X-Fixture-Actor');return networkOwnerRequest(request,user?{userId:user}:null,network,now);}
if(path==='/api/network/agent')return networkAgentRequest(request,network,now);
if(path==='/api/research/agent')return researchAgentRequest(request,research,network,now);
if(path==='/api/research'&&request.method==='POST'){const user=request.headers.get('X-Fixture-Actor');return researchHumanRequest(request,user?{userId:user}:null,research,id=>id==='synthetic-fixture-moderator',now);}
return researchPublicRequest(request,research);}};`;
const flowBuild = await build({stdin: {contents: flowSource, resolveDir: process.cwd()}, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', external: ['node:crypto'], write: false});
const worker = new Miniflare({modules: true, script: flowBuild.outputFiles[0].text, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], bindings: {FIXTURE_AT: at}});
let db;
before(async () => {
  db = await worker.getD1Database('DB');
  for (const file of readdirSync('drizzle').filter(value => value.endsWith('.sql')).sort()) for (const sql of readFileSync('drizzle/' + file, 'utf8').split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql).run();
});
after(async () => { await staticWorker.dispose(); await worker.dispose(); });
const management = (owner, command) => worker.dispatchFetch(origin + '/api/network/agents', {method: 'POST', headers: {'X-Fixture-Actor': owner, Origin: origin, 'Content-Type': 'application/json', 'X-Network-Intent': 'onboard'}, body: JSON.stringify(command)});
const identity = token => worker.dispatchFetch(origin + '/api/network/agent', {headers: {Authorization: 'Bearer ' + token}});
const publish = (token, body) => worker.dispatchFetch(origin + '/api/research/agent', {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body});

test('actual static route is anonymous, bounded, immutable and independent of runtime account/storage/provider bindings', async () => {
  const response = await staticWorker.dispatchFetch(origin + '/api/network/quickstart');
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff'); assert.match(response.headers.get('Content-Type'), /application\/json/);
  const body = await response.text(); assert(Buffer.byteLength(body) <= q.agentQuickstartLimits.responseBytes);
  assert.deepEqual(JSON.parse(body), q.agentQuickstartSpec); assert.equal(q.agentQuickstartSpec.deployedOrigin, null);
  assert.equal(q.agentQuickstartSpec.executionEnabled, false); assert.equal(q.agentQuickstartSpec.hostedAgentCompute, false);
  assert.match(q.agentQuickstartSpec.availability, /remain unverified/); assert.match(q.agentQuickstartSpec.participation, /source and contribution guides are public/);
  assert.match(q.agentQuickstartSpec.participation, /https:\/\/github\.com\/wesseltl\/opengrail\/tree\/source\/opengrail-foundation/);
  assert.match(q.agentQuickstartSpec.participation, /source access grants no platform or production authority/);
  const decorated = await staticWorker.dispatchFetch(origin + '/api/network/quickstart', {headers: {Cookie: 'fixture=do-not-reflect', Authorization: 'Bearer sentinel-do-not-reflect'}});
  assert.equal(await decorated.text(), body); assert.equal(decorated.headers.get('Set-Cookie'), null);
  for (const dependency of Object.keys(staticBuild.metafile.inputs)) assert(!/network-store|research-store|chatgpt-auth|db\/index|evaluator|session-runtime/.test(dependency), dependency);
  assert(!/cloudflare:workers/.test(staticBuild.outputFiles[0].text));
  assert(Object.isFrozen(q.agentQuickstartSpec.publication.example));
});

test('anonymous quickstart separates an account-free local first computation from unchanged authenticated sharing', async () => {
  const response = await staticWorker.dispatchFetch(origin + '/api/network/quickstart');
  assert.equal(response.status, 200);
  const body = await response.text(), guide = JSON.parse(body), first = guide.localFirstExperiment;
  assert(Buffer.byteLength(body) <= q.agentQuickstartLimits.responseBytes);
  assert.equal(first.guide, '/agent-guide#first-test'); assert.equal(first.location, 'OPERATOR_LOCAL');
  assert.deepEqual(first.run, ['node', 'scripts/agent-first-test.mjs', '/absolute/NEW/output-directory']);
  assert.deepEqual(first.reproduce, ['node', 'scripts/replay-demo.mjs', 'verify', '/absolute/NEW/output-directory/artifact.json']);
  assert.equal(first.source.repository, 'https://github.com/wesseltl/opengrail'); assert.equal(first.source.branch, 'source/opengrail-foundation');
  for (const path of [first.source.script, first.source.documentation, first.reproduce[1]]) {
    assert(!path.startsWith('/') && !path.includes('://')); assert(existsSync(path), path);
  }
  assert.match(first.sourceAvailability, /source files in a checkout, not a hosted script or download/); assert.match(first.sourceAvailability, /Inspect the reviewed checkout before execution/);
  assert.equal(first.prerequisites.node, '>=22.13.0'); assert.equal(first.prerequisites.python, '3'); assert.equal(first.prerequisites.platform, 'POSIX'); assert.match(first.prerequisites.checkout, /dependencies already installed/);
  for (const field of ['accountRequired', 'credentialRequired', 'networkRequired', 'hostedCompute', 'automaticExecution', 'automaticPublication', 'ordersEnabled']) assert.equal(first[field], false, field);
  assert.match(first.networkScope, /after the reviewed development dependencies are installed/);
  assert.equal(first.instructionAuthority, 'NONE'); assert.equal(first.provenance, 'SYNTHETIC'); assert.equal(first.classification, 'AUTHOR_REPORTED'); assert.equal(first.qualification, 'NONE'); assert.equal(first.independence, 'NOT_ESTABLISHED'); assert.equal(first.verification, 'SAME_IMPLEMENTATION_REPLAY');
  assert.equal(guide.version, 1); assert.equal(guide.deployedOrigin, null); assert.equal(guide.hostedAgentCompute, false);
  assert.equal(guide.identity.authorization, 'AGENT_BEARER'); assert.equal(guide.publication.authorization, 'AGENT_BEARER'); assert.equal(guide.publication.path, '/api/research/agent'); assert.equal(guide.publication.policyAccepted, 'public-research-v1');
  assert(Object.isFrozen(q.agentQuickstartSpec.localFirstExperiment.run));
});

test('static route rejects every query and non-GET method without reflecting supplied material', async () => {
  for (const query of ['?token=sentinel-secret', '?id=bad', '?cursor=bad', '?x=1&x=2']) {
    const response = await staticWorker.dispatchFetch(origin + '/api/network/quickstart' + query);
    assert.equal(response.status, 400); assert(!/sentinel-secret|token|cursor|bad/.test(await response.text()));
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = await staticWorker.dispatchFetch(origin + '/api/network/quickstart', {method});
    assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'GET');
  }
});

test('complete synthetic examples satisfy actual existing schemas and disclose exact limits without fictitious recovery or resets', async () => {
  assert.deepEqual(models.boundedResearchCommand(q.agentQuickstartSpec.publication.example).command, q.agentQuickstartSpec.publication.example);
  assert.deepEqual(models.researchWithdrawSchema.parse(q.agentQuickstartSpec.withdrawal.example), q.agentQuickstartSpec.withdrawal.example);
  assert.equal(q.agentQuickstartSpec.publication.example.kind, 'HYPOTHESIS'); assert.equal(q.agentQuickstartSpec.publication.example.relation, null);
  assert.match(q.agentQuickstartSpec.publication.example.statement, /synthetic/i);
  const command = q.agentQuickstartSpec.publication.example, synthetic = models.boundedResearchRecord({version: 1, id: command.id, rootId: command.id, revision: 1, requestId: command.requestId, createdAt: '2026-10-11T16:00:00.000Z', author: {kind: 'AGENT', id: '10000000-0000-4000-8000-000000000003', sponsorId: await models.researchPublicHumanId('quickstart-synthetic-sponsor'), name: 'Synthetic quickstart agent'}, content: models.researchPublicationContent(command), policyAccepted: command.policyAccepted, verification: 'UNVERIFIED', executionEnabled: false});
  assert.equal(await models.researchDigest(synthetic.payload), q.agentQuickstartSpec.withdrawal.example.digest);
  assert.deepEqual(q.agentQuickstartSpec.identity.response.agentFields, ['id', 'name', 'credentialId', 'expiresAt', 'scope']);
  assert(!q.agentQuickstartSpec.identity.response.agentFields.includes('sponsorId'));
  assert.match(q.agentQuickstartSpec.identity.checks, /does not return sponsorId/);
  assert.deepEqual(q.agentQuickstartSpec.limits.research, models.researchLimits); assert.deepEqual(q.agentQuickstartSpec.limits.enrollment, models.networkLimits);
  assert.match(q.agentQuickstartSpec.retry.rule, /identical serialized body, requestId and original agent\/credential principal/);
  assert.match(q.agentQuickstartSpec.errors.find(value => value.status === '429').meaning, /retained caps have no automatic reset/);
});

test('synthetic sponsor enrollment → agent identity → exact publish/lost-ACK retry → withdrawal/tombstone → revoke uses actual local D1/Worker boundaries', async () => {
  const key = await models.createNetworkToken('10000000-0000-4000-8000-000000000006'), owner = 'quickstart-synthetic-sponsor';
  const registration = {action: 'register', requestId: '10000000-0000-4000-8000-000000000005', id: '10000000-0000-4000-8000-000000000003', credentialId: key.credentialId, name: 'Synthetic quickstart agent', tokenDigest: key.tokenDigest, days: 7};
  assert.equal((await management('', registration)).status, 401);
  const enrollment = await management(owner, registration); assert.equal(enrollment.status, 200); const enrolled = models.networkWriteSchema.parse(await enrollment.json());
  const identityResponse = await identity(key.token); assert.equal(identityResponse.status, 200); const who = models.networkIdentitySchema.parse(await identityResponse.json());
  assert.equal(who.agent.id, enrolled.agent.id); assert.equal(who.agent.credentialId, enrolled.agent.credentialId); assert(!('sponsorId' in who.agent));
  const pending = q.freezeAgentQuickstartCommand(q.agentQuickstartSpec.publication.example, who), originalBody = pending.body;
  assert(Object.isFrozen(pending)); assert(Object.isFrozen(pending.command.sources));
  // First write is accepted; discarding its acknowledgment models the caller's uncertainty.
  const first = await publish(key.token, pending.body); assert.equal(first.status, 200); const original = await first.json();
  q.validateAgentQuickstartIdentity(await (await identity(key.token)).json(), pending);
  const retry = await publish(key.token, pending.body); assert.equal(retry.status, 200); const confirmed = await q.validateAgentQuickstartReceipt(await retry.json(), pending);
  assert.deepEqual(confirmed, original); assert.equal(pending.body, originalBody);
  assert.equal(confirmed.item.digest, await models.researchDigest(models.boundedResearchRecord(confirmed.item.record).payload));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM research_publications WHERE id=?').bind(pending.command.id).first()).n, 1);
  assert.equal((await publish(key.token, JSON.stringify({...pending.command, title: 'Changed unresolved operation'}))).status, 409);
  const withdraw = await q.agentQuickstartWithdrawal(pending, confirmed, q.agentQuickstartSpec.withdrawal.example.requestId);
  assert.deepEqual(withdraw.command, {...q.agentQuickstartSpec.withdrawal.example, digest: confirmed.item.digest});
  const removed = await publish(key.token, withdraw.body); assert.equal(removed.status, 200); const tombstone = await q.validateAgentQuickstartReceipt(await removed.json(), withdraw);
  assert.equal(tombstone.item.state, 'WITHDRAWN'); assert.equal(tombstone.item.record, null);
  const mismatchedWithdrawal = structuredClone(tombstone); mismatchedWithdrawal.item.moderation.at(-1).requestId = crypto.randomUUID();
  await assert.rejects(q.validateAgentQuickstartReceipt(mismatchedWithdrawal, withdraw));
  assert.equal(withdraw.body, JSON.stringify(withdraw.command));
  assert.deepEqual(await q.validateAgentQuickstartReceipt(await (await publish(key.token, withdraw.body)).json(), withdraw), tombstone);
  const publicationRetry = await q.validateAgentQuickstartReceipt(await (await publish(key.token, pending.body)).json(), pending);
  assert.equal(publicationRetry.item.record, null); assert.equal(publicationRetry.item.state, 'WITHDRAWN');
  assert(!JSON.stringify(publicationRetry).includes(pending.command.statement)); assert(!JSON.stringify(publicationRetry).includes(registration.name));
  const revoke = {action: 'revoke', requestId: crypto.randomUUID(), id: registration.id, revision: 1}; assert.equal((await management(owner, revoke)).status, 200);
  assert.equal((await identity(key.token)).status, 401); assert.equal((await publish(key.token, pending.body)).status, 401);
  const retained = await db.prepare('SELECT * FROM network_agents WHERE id=?').bind(registration.id).first();
  assert(!JSON.stringify(retained).includes(key.token)); assert(!JSON.stringify(retained).includes(key.token.split('.')[1]));
});

test('receipt verifier rejects wrong action/request/id/agent/content/hash and preserves the exact body on failures', async () => {
  const owner = crypto.randomUUID(), key = await models.createNetworkToken(), registration = {action: 'register', requestId: crypto.randomUUID(), id: crypto.randomUUID(), credentialId: key.credentialId, name: 'Synthetic receipt checker', tokenDigest: key.tokenDigest, days: 7};
  assert.equal((await management(owner, registration)).status, 200);
  const who = await (await identity(key.token)).json(), command = {...q.agentQuickstartSpec.publication.example, requestId: crypto.randomUUID(), id: crypto.randomUUID()};
  const pending = q.freezeAgentQuickstartCommand(command, who), body = pending.body;
  const response = await publish(key.token, body); assert.equal(response.status, 200); const good = await response.json(); await q.validateAgentQuickstartReceipt(good, pending);
  const wrongRecord = structuredClone(good); wrongRecord.item.record.content.statement = 'Another synthetically forged statement.'; wrongRecord.item.digest = await models.researchDigest(JSON.stringify(models.researchRecordSchema.parse(wrongRecord.item.record)));
  const bad = [{...good, action: 'withdraw'}, {...good, requestId: crypto.randomUUID()}, {...good, item: {...good.item, id: crypto.randomUUID()}}, {...good, item: {...good.item, digest: '0'.repeat(64)}}, wrongRecord, {...good, executionEnabled: true}];
  const other = structuredClone(good); other.item.author.id = crypto.randomUUID(); other.item.record.author.id = other.item.author.id; other.item.digest = await models.researchDigest(JSON.stringify(other.item.record)); bad.push(other);
  for (const receipt of bad) { await assert.rejects(q.validateAgentQuickstartReceipt(receipt, pending)); assert.equal(pending.body, body); }
  for (const change of [{credentialId: crypto.randomUUID()}, {id: crypto.randomUUID()}, {scope: 'ADMIN'}]) assert.throws(() => q.validateAgentQuickstartIdentity({...who, agent: {...who.agent, ...change}}, pending));
  assert.throws(() => q.freezeAgentQuickstartCommand({...command, sponsorId: 'invented'}, who));
  // Hide through the existing human moderation handler with a synthetic fixture-only role.
  const moderation = {action: 'moderate', requestId: crypto.randomUUID(), id: command.id, digest: good.item.digest, state: 'HIDDEN', reason: 'POLICY', policyAccepted: 'public-research-v1'};
  const hidden = await worker.dispatchFetch(origin + '/api/research', {method: 'POST', headers: {'X-Fixture-Actor': 'synthetic-fixture-moderator', Origin: origin, 'Content-Type': 'application/json', 'X-Research-Intent': 'submit'}, body: JSON.stringify(moderation)});
  assert.equal(hidden.status, 200);
  const hiddenRetry = await q.validateAgentQuickstartReceipt(await (await publish(key.token, pending.body)).json(), pending);
  assert.equal(hiddenRetry.item.state, 'HIDDEN'); assert.equal(hiddenRetry.item.record, null); assert.equal(hiddenRetry.item.digest, good.item.digest);
  assert(!JSON.stringify(hiddenRetry).includes(command.statement)); assert(!JSON.stringify(hiddenRetry).includes(registration.name));
});
