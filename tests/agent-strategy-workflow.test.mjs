import {test, before, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createHash} from 'node:crypto';

const modelBuild = await build({entryPoints: ['app/agent-strategy-quickstart.ts'], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
const q = await import('data:text/javascript;base64,' + Buffer.from(modelBuild.outputFiles[0].text).toString('base64'));
const modelEntry = `export * from './app/network-model';export * from './app/strategy-model';export * from './app/experiment-model';export {networkIdentitySchema} from './app/network-http';export {validateStrategyEvidencePage} from './app/strategy-evidence-model';`;
const modelBundle = await build({stdin: {contents: modelEntry, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false});
const m = await import('data:text/javascript;base64,' + Buffer.from(modelBundle.outputFiles[0].text).toString('base64'));
const origin = 'https://strategy-workflow.test', at = new Date(Date.now() - 2000).toISOString();
// Human admission and time are explicitly synthetic local fixture boundaries. Machine
// identity, permissions, credential hashing, expiry, all writes and reads use actual
// existing HTTP handlers and isolated D1. This is not hosted Sites sign-in evidence.
const flowSource = `import {networkOwnerRequest,networkAgentRequest} from './app/network-http';import {NetworkRepository} from './app/network-store';
import {strategyAgentRequest,strategyPublicRequest,strategyHumanRequest} from './app/strategy-http';import {StrategyRepository} from './app/strategy-store';
import {experimentAgentRequest,experimentPublicRequest,experimentHumanRequest} from './app/experiment-http';import {ExperimentRepository} from './app/experiment-store';
import {strategyEvidencePublicRequest} from './app/strategy-evidence-http';
import * as quickstart from './app/api/network/strategy-quickstart/route';
export default {fetch(request,env){const path=new URL(request.url).pathname,now=()=>request.headers.get('X-Fixture-Time')??env.FIXTURE_AT;
const network=()=>new NetworkRepository(env.DB),strategy=()=>new StrategyRepository(env.DB),experiment=()=>new ExperimentRepository(env.DB);
const user=request.headers.get('X-Fixture-Actor'),actor=user?{userId:user}:null,moderator=id=>id==='synthetic-workflow-moderator';
if(path==='/api/network/strategy-quickstart'){const handler=quickstart[request.method];return handler?handler(request):new Response(null,{status:405,headers:{Allow:'GET'}});}
if(path==='/api/network/agents')return networkOwnerRequest(request,actor,network,now);
if(path==='/api/network/agent')return networkAgentRequest(request,network,now);
if(path==='/api/strategies/agent')return strategyAgentRequest(request,strategy,network,now);
if(path==='/api/experiments/agent')return experimentAgentRequest(request,experiment,network,now);
if(path==='/api/strategies/evidence')return strategyEvidencePublicRequest(request,experiment);
if(path==='/api/strategies')return request.method==='GET'?strategyPublicRequest(request,strategy):strategyHumanRequest(request,actor,strategy,moderator,now);
if(path==='/api/experiments')return request.method==='GET'?experimentPublicRequest(request,experiment):experimentHumanRequest(request,actor,experiment,moderator,now);
return new Response(null,{status:404});}};`;
const flowBuild = await build({stdin: {contents: flowSource, resolveDir: process.cwd()}, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', external: ['node:crypto'], write: false, metafile: true});
const worker = new Miniflare({modules: true, script: flowBuild.outputFiles[0].text, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], bindings: {FIXTURE_AT: at}});
let db;
before(async () => {
  db = await worker.getD1Database('DB');
  for (const file of readdirSync('drizzle').filter(value => value.endsWith('.sql')).sort()) for (const sql of readFileSync('drizzle/' + file, 'utf8').split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql).run();
});
beforeEach(async () => {
  for (const table of ['experiment_reports', 'experiment_moderation', 'experiment_records', 'strategy_reports', 'strategy_moderation', 'strategy_publications', 'network_agents']) await db.prepare('DELETE FROM ' + table).run();
});
after(async () => { await worker.dispose(); });
const uid = () => crypto.randomUUID(), consent = Object.freeze({confirmPublicSharing: true, receiptStatus: 200});
const ids = () => ({requestId: uid(), id: uid(), inputRequestId: uid(), datasetId: uid()});
const operationIds = () => ({requestId: uid(), id: uid()});
const management = (owner, command) => worker.dispatchFetch(origin + '/api/network/agents', {method: 'POST', headers: {'X-Fixture-Actor': owner, Origin: origin, 'Content-Type': 'application/json', 'X-Network-Intent': 'onboard'}, body: JSON.stringify(command)});
const identity = (token, extra = {}) => worker.dispatchFetch(origin + '/api/network/agent', {headers: {Authorization: 'Bearer ' + token, ...extra}});
const publish = (agent, pending, extra = {}) => worker.dispatchFetch(origin + (pending.stage === 'STRATEGY' ? '/api/strategies/agent' : '/api/experiments/agent'), {method: 'POST', headers: {Authorization: 'Bearer ' + agent.token, 'Content-Type': 'application/json', ...extra}, body: pending.body});
const rawWrite = (agent, stage, command, extra = {}) => publish(agent, {stage, body: typeof command === 'string' ? command : JSON.stringify(command)}, extra);
const getStrategy = id => worker.dispatchFetch(origin + '/api/strategies?id=' + id);
const getExperiment = id => worker.dispatchFetch(origin + '/api/experiments?id=' + id);
const count = async table => (await db.prepare('SELECT COUNT(*) AS n FROM ' + table).first()).n;
async function agent(owner = uid(), name = 'Synthetic strategy workflow agent') {
  const key = await m.createNetworkToken(), command = {action: 'register', requestId: uid(), id: uid(), credentialId: key.credentialId, name, tokenDigest: key.tokenDigest, days: 7};
  assert.equal((await management(owner, command)).status, 200);
  const response = await identity(key.token); assert.equal(response.status, 200);
  const who = m.networkIdentitySchema.parse(await response.json());
  assert.equal(who.agent.id, command.id); assert.equal(who.agent.credentialId, key.credentialId); assert.equal(who.agent.scope, 'PUBLIC_RESEARCH_SUBMIT');
  assert(!('sponsorId' in who.agent));
  return {...key, owner, command, who};
}
function strategyPending(a, patch = {}) {
  return q.prepareAgentStrategyQuickstartStrategy({...structuredClone(q.agentStrategyQuickstartSpec.workflow.strategy.example), requestId: uid(), id: uid(), ...patch}, a.who, consent);
}
async function confirmed(a, pending) {
  const response = await publish(a, pending); assert.equal(response.status, 200, await response.clone().text());
  const receipt = await response.json();
  await q.validateAgentStrategyQuickstartReceipt(receipt, pending, response.status);
  return receipt;
}
async function registered(a = null) {
  a ??= await agent(); const strategy = strategyPending(a), strategyReceipt = await confirmed(a, strategy);
  const manifest = await q.prepareAgentStrategyQuickstartManifest(strategy, strategyReceipt, ids(), consent), manifestReceipt = await confirmed(a, manifest);
  return {a, strategy, strategyReceipt, manifest, manifestReceipt};
}
async function completed(a = null) {
  const f = await registered(a), source = (await (await getStrategy(f.strategy.command.id)).json()).item;
  const outcome = await q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, f.manifestReceipt, source, operationIds(), consent), outcomeReceipt = await confirmed(f.a, outcome);
  return {...f, source, outcome, outcomeReceipt};
}
async function hide(stage, receipt) {
  const kind = stage === 'STRATEGY' ? 'Strategy' : 'Experiment';
  const command = {action: 'moderate', requestId: uid(), id: receipt.item.id, digest: receipt.item.digest, state: 'HIDDEN', reason: 'POLICY', policyAccepted: stage === 'STRATEGY' ? 'public-strategy-v1' : 'public-experiment-v1'};
  const response = await worker.dispatchFetch(origin + (stage === 'STRATEGY' ? '/api/strategies' : '/api/experiments'), {method: 'POST', headers: {'X-Fixture-Actor': 'synthetic-workflow-moderator', Origin: origin, 'Content-Type': 'application/json', ['X-' + kind + '-Intent']: 'submit'}, body: JSON.stringify(command)});
  assert.equal(response.status, 200, await response.clone().text()); return response.json();
}

test('actual credential routes retain exact strategy → manifest → deliberately unavailable outcome → bounded exact evidence', async () => {
  const f = await completed(), sponsor = await m.strategyPublicHumanId(f.a.owner);
  for (const [pending, receipt] of [[f.strategy, f.strategyReceipt], [f.manifest, f.manifestReceipt], [f.outcome, f.outcomeReceipt]]) {
    assert(Object.isFrozen(pending)); assert(Object.isFrozen(pending.command)); assert.equal(pending.body, JSON.stringify(pending.command));
    assert.equal(receipt.item.author.kind, 'AGENT'); assert.equal(receipt.item.author.id, f.a.who.agent.id); assert.equal(receipt.item.author.sponsorId, sponsor);
    assert.equal(receipt.item.record.author.name, f.a.who.agent.name); assert.equal(receipt.item.record.executionEnabled, false);
    assert.equal(receipt.item.requestId, pending.command.requestId); assert.equal(receipt.item.id, pending.command.id);
    const bounded = pending.stage === 'STRATEGY' ? m.boundedStrategyRecord(receipt.item.record) : m.boundedExperimentRecord(receipt.item.record);
    assert.equal(await m.strategyDigest(bounded.payload), receipt.item.digest);
    assert(!pending.body.includes(f.a.token)); assert(!JSON.stringify(receipt).includes(f.a.token));
  }
  assert.equal(f.strategyReceipt.item.record.verification, 'UNTESTED');
  assert.deepEqual(f.manifest.source, f.strategyReceipt.item); assert.deepEqual(f.manifest.command.input.strategy, {record: f.strategyReceipt.item.record, digest: f.strategyReceipt.item.digest});
  assert.equal(f.manifest.sponsorId, sponsor); assert.equal(f.outcome.sponsorId, sponsor); assert.deepEqual(f.outcome.parent, f.manifestReceipt.item);
  assert.equal(f.manifestReceipt.item.record.classification, 'AUTHOR_REPORTED'); assert.deepEqual(f.outcome.command.manifest, {id: f.manifest.command.id, digest: f.manifestReceipt.item.digest});
  assert.equal(f.outcome.command.result.kind, 'ARTIFACT_UNAVAILABLE'); assert.deepEqual(Object.keys(f.outcome.command.result), ['kind', 'reason']);
  assert.match(f.outcome.command.result.reason, /(?:not attempted|no evaluation|not run)/i);
  assert.equal(f.outcomeReceipt.item.record.classification, 'AUTHOR_REPORTED');
  assert(f.outcomeReceipt.item.record.flags.includes('SAME_AUTHOR')); assert(f.outcomeReceipt.item.record.flags.includes('SAME_SPONSOR'));
  const exact = await getExperiment(f.outcome.command.id); assert.equal(exact.status, 200); assert.deepEqual((await exact.json()).item, f.outcomeReceipt.item);
  const evidenceResponse = await worker.dispatchFetch(origin + '/api/strategies/evidence?strategy=' + f.source.id + '&digest=' + f.source.digest);
  assert.equal(evidenceResponse.status, 200, await evidenceResponse.clone().text());
  const evidence = await m.validateStrategyEvidencePage(await evidenceResponse.json());
  assert.deepEqual(evidence.strategy, f.source); assert.equal(evidence.items.length, 2); assert.equal(evidence.qualification, 'NONE'); assert.equal(evidence.independence, 'NOT_ESTABLISHED');
  assert.equal(evidence.executionEnabled, false); assert.equal(evidence.ordersEnabled, false);
  assert.deepEqual(evidence.items.find(item => item.summary.id === f.outcome.command.id).observation, {kind: 'ARTIFACT_UNAVAILABLE'});
  assert.equal(await count('strategy_publications'), 1); assert.equal(await count('experiment_records'), 2);
  const retained = await db.prepare('SELECT * FROM network_agents WHERE id=?').bind(f.a.command.id).first(); assert(!JSON.stringify(retained).includes(f.a.token));
});

test('unknown acknowledgments at every stage reconcile with the unchanged original body and principal only', async () => {
  const a = await agent(), strategy = strategyPending(a);
  const first = await publish(a, strategy); assert.equal(first.status, 200); const strategyAccepted = await first.json();
  const stages = [[strategy, strategyAccepted]];
  const strategyRetry = await confirmed(a, strategy); assert.deepEqual(strategyRetry, strategyAccepted);
  const manifest = await q.prepareAgentStrategyQuickstartManifest(strategy, strategyRetry, ids(), consent), manifestFirst = await publish(a, manifest);
  assert.equal(manifestFirst.status, 200); const manifestAccepted = await manifestFirst.json(); stages.push([manifest, manifestAccepted]);
  const manifestRetry = await confirmed(a, manifest); assert.deepEqual(manifestRetry, manifestAccepted);
  const source = (await (await getStrategy(strategy.command.id)).json()).item;
  const outcome = await q.prepareAgentStrategyQuickstartUnavailableOutcome(manifest, manifestRetry, source, operationIds(), consent), outcomeFirst = await publish(a, outcome);
  assert.equal(outcomeFirst.status, 200); const outcomeAccepted = await outcomeFirst.json(); stages.push([outcome, outcomeAccepted]);
  assert.deepEqual(await confirmed(a, outcome), outcomeAccepted);
  for (const [pending, receipt] of stages) {
    const originalBody = pending.body; q.validateAgentStrategyQuickstartIdentity(await (await identity(a.token)).json(), pending);
    // Manifest metadata can gain an outcome count, but its retained canonical body never changes.
    const retry = await confirmed(a, pending); assert.equal(retry.item.digest, receipt.item.digest); assert.deepEqual(retry.item.record, receipt.item.record);
    assert.equal(pending.body, originalBody);
    assert.equal((await rawWrite(a, pending.stage, {...pending.command, name: 'Different uncertain operation'})).status, 409);
  }
  assert.equal(await count('strategy_publications'), 1); assert.equal(await count('experiment_records'), 2);
});

test('revoked real D1 credentials cannot submit prepared dependent writes or retrieve an accepted retry', async () => {
  const f = await registered(), source = (await (await getStrategy(f.strategy.command.id)).json()).item;
  const outcome = await q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, f.manifestReceipt, source, operationIds(), consent), body = outcome.body;
  assert.equal((await management(f.a.owner, {action: 'revoke', requestId: uid(), id: f.a.command.id, revision: 1})).status, 200);
  assert.equal((await identity(f.a.token)).status, 401);
  for (const pending of [f.strategy, f.manifest, outcome]) assert.equal((await publish(f.a, pending)).status, 401);
  assert.equal(outcome.body, body); assert.equal(await count('experiment_records'), 1);
});

test('expiry is enforced by actual credential admission before a dependent write or original retry', async () => {
  const a = await agent(), pending = strategyPending(a), receipt = await confirmed(a, pending);
  const manifest = await q.prepareAgentStrategyQuickstartManifest(pending, receipt, ids(), consent), body = manifest.body;
  const expired = {'X-Fixture-Time': new Date(Date.parse(a.who.agent.expiresAt) + 1).toISOString()};
  assert.equal((await identity(a.token, expired)).status, 401);
  assert.equal((await publish(a, manifest, expired)).status, 401); assert.equal((await publish(a, pending, expired)).status, 401);
  assert.equal(manifest.body, body); assert.equal(await count('strategy_publications'), 1); assert.equal(await count('experiment_records'), 0);
});

test('another actually registered credential cannot impersonate the original agent or adopt its unknown acknowledgment', async () => {
  const owner = uid(), a = await agent(owner, 'Original synthetic agent'), b = await agent(owner, 'Second synthetic agent');
  const pending = strategyPending(a), receipt = await confirmed(a, pending), body = pending.body;
  assert.throws(() => q.validateAgentStrategyQuickstartIdentity(b.who, pending));
  assert.equal((await publish(b, pending)).status, 409);
  const manifest = await q.prepareAgentStrategyQuickstartManifest(pending, receipt, ids(), consent), accepted = await confirmed(a, manifest);
  assert.equal((await publish(b, manifest)).status, 409); assert.throws(() => q.validateAgentStrategyQuickstartIdentity(b.who, manifest));
  assert.equal(pending.body, body); assert.equal(accepted.item.author.id, a.command.id); assert.equal(await count('experiment_records'), 1);
});

test('canonical receipt drift, wrong source/parent/author/sponsor and non-200 responses cannot become confirmations', async () => {
  const f = await completed();
  for (const [pending, good] of [[f.strategy, f.strategyReceipt], [f.manifest, f.manifestReceipt], [f.outcome, f.outcomeReceipt]]) {
    const body = pending.body, mutated = [];
    for (const change of [value => {value.requestId = uid();}, value => {value.item.id = uid();}, value => {value.executionEnabled = true;}, value => {value.item.digest = '0'.repeat(64);}, value => {value.action = 'report';}]) {const value = structuredClone(good); change(value); mutated.push(value);}
    // Re-seal full canonical records so rejection cannot rely only on a bad digest.
    const recordChanges = [record => {record.author.id = uid();}, record => {record.author.name = 'Another synthetic name';}, record => {record.content.name = 'Different frozen content';}];
    // The identity API does not expose sponsorship. The first server-declared
    // sponsor is learned on strategy acknowledgment and only then can be pinned.
    if (pending.stage !== 'STRATEGY') recordChanges.push(record => {record.author.sponsorId = 'human_' + 'f'.repeat(64);});
    for (const change of recordChanges) {
      const value = structuredClone(good); change(value.item.record); value.item.author = m.strategyAuthorReference(value.item.record.author);
      value.item.digest = await m.strategyDigest((pending.stage === 'STRATEGY' ? m.boundedStrategyRecord(value.item.record) : m.boundedExperimentRecord(value.item.record)).payload); mutated.push(value);
    }
    for (const value of mutated) await assert.rejects(q.validateAgentStrategyQuickstartReceipt(value, pending, 200));
    for (const status of [undefined, 0, 201, 401, 409, 503]) await assert.rejects(q.validateAgentStrategyQuickstartReceipt(good, pending, status));
    assert.equal(pending.body, body);
  }
  const wrongSource = structuredClone(f.source); wrongSource.record.content.name = 'Wrong current source'; wrongSource.digest = await m.strategyDigest(m.boundedStrategyRecord(wrongSource.record).payload);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, f.manifestReceipt, wrongSource, operationIds(), consent));
  const wrongManifest = structuredClone(f.manifestReceipt); wrongManifest.item.record.content.name = 'Wrong canonical parent'; wrongManifest.item.digest = await m.strategyDigest(m.boundedExperimentRecord(wrongManifest.item.record).payload);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, wrongManifest, f.source, operationIds(), consent));
});

test('hidden source keeps retained acknowledgment tombstones and blocks new dependent preparation and actual writes', async () => {
  const f = await completed(), pendingNew = await q.prepareAgentStrategyQuickstartManifest(f.strategy, f.strategyReceipt, ids(), consent);
  await hide('STRATEGY', f.strategyReceipt);
  const hiddenSource = (await (await getStrategy(f.strategy.command.id)).json()).item;
  assert.equal(hiddenSource.state, 'HIDDEN'); assert.equal(hiddenSource.record, null);
  const strategyTombstone = await confirmed(f.a, f.strategy); assert.equal(strategyTombstone.item.record, null);
  await assert.rejects(q.prepareAgentStrategyQuickstartManifest(f.strategy, strategyTombstone, ids(), consent));
  const manifestTombstone = await confirmed(f.a, f.manifest); assert.equal(manifestTombstone.item.suppression, 'SOURCE_UNAVAILABLE'); assert.equal(manifestTombstone.item.record, null);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, f.manifestReceipt, hiddenSource, operationIds(), consent));
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, manifestTombstone, f.source, operationIds(), consent));
  const outcomeTombstone = await confirmed(f.a, f.outcome); assert.equal(outcomeTombstone.item.record, null);
  for (const receipt of [strategyTombstone, manifestTombstone, outcomeTombstone]) {assert(!JSON.stringify(receipt).includes(f.a.who.agent.name)); assert(!JSON.stringify(receipt).includes('"bars"'));}
  assert.equal((await publish(f.a, pendingNew)).status, 409); assert.equal(await count('experiment_records'), 2);
});

test('hidden manifest suppresses outcomes, refuses dependent preparation and preserves exact original retry identity', async () => {
  const f = await completed(), nextOutcome = await q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, f.manifestReceipt, f.source, operationIds(), consent);
  await hide('MANIFEST', f.manifestReceipt);
  const parent = await confirmed(f.a, f.manifest); assert.equal(parent.item.state, 'HIDDEN'); assert.equal(parent.item.record, null);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, parent, f.source, operationIds(), consent));
  const outcome = await confirmed(f.a, f.outcome); assert.equal(outcome.item.record, null); assert.equal(outcome.item.suppression, 'PARENT_UNAVAILABLE');
  assert.equal(outcome.item.id, f.outcome.command.id); assert.equal(outcome.item.digest, f.outcomeReceipt.item.digest);
  assert.equal((await publish(f.a, nextOutcome)).status, 409); assert.equal(await count('experiment_records'), 2);
});

test('existing actor request namespaces reject changed operations and do not collapse different agents into one principal', async () => {
  const owner = uid(), a = await agent(owner, 'Namespace original'), b = await agent(owner, 'Namespace second'), f = await registered(a);
  const body = structuredClone(f.manifest.command); body.id = uid(); body.name = 'Changed request';
  assert.equal((await rawWrite(a, 'MANIFEST', body)).status, 409);
  const accepted = await rawWrite(b, 'MANIFEST', body); assert.equal(accepted.status, 200, await accepted.clone().text());
  const receipt = await accepted.json(); assert.equal(receipt.item.author.id, b.command.id); assert.equal(receipt.item.author.sponsorId, f.manifestReceipt.item.author.sponsorId);
  await assert.rejects(q.validateAgentStrategyQuickstartReceipt(receipt, f.manifest, 200));
  const outcome = await q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, f.manifestReceipt, (await (await getStrategy(f.strategy.command.id)).json()).item, operationIds(), consent);
  assert.equal((await rawWrite(a, 'OUTCOME', {...outcome.command, requestId: f.manifest.command.requestId})).status, 409);
  assert.equal(await count('experiment_records'), 2);
});

test('actual machine routes reject authored privilege fields, altered source/method bindings and duplicate JSON before retention', async () => {
  const a = await agent(), strategy = strategyPending(a);
  for (const patch of [{author: {kind: 'AGENT', id: a.command.id}}, {sponsorId: 'f'.repeat(64)}, {scope: 'ADMIN'}, {executionEnabled: true}, {reputation: 100}, {verification: 'VERIFIED'}]) assert.equal((await rawWrite(a, 'STRATEGY', {...strategy.command, ...patch})).status, 400);
  assert.equal(await count('strategy_publications'), 0);
  const receipt = await confirmed(a, strategy), manifest = await q.prepareAgentStrategyQuickstartManifest(strategy, receipt, ids(), consent);
  for (const patch of [{author: {kind: 'AGENT', id: a.command.id}}, {sponsorId: 'f'.repeat(64)}, {qualification: 'QUALIFIED'}, {ordersEnabled: true}, {classification: 'VERIFIED'}, {evaluator: {...manifest.command.evaluator, methodDigest: '0'.repeat(64)}}]) assert.equal((await rawWrite(a, 'MANIFEST', {...manifest.command, ...patch})).status, 400);
  const duplicate = manifest.body.replace('"action":"register"', '"action":"register","action":"register"');
  assert.notEqual(duplicate, manifest.body); assert.equal((await rawWrite(a, 'MANIFEST', duplicate)).status, 400);
  assert.equal(await count('experiment_records'), 0);
});

test('reference preparation requires explicit public sharing and canonical fresh IDs without importing an evaluator or agent runtime', async () => {
  const a = await agent(), raw = {...structuredClone(q.agentStrategyQuickstartSpec.workflow.strategy.example), requestId: uid(), id: uid()};
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy(raw, a.who, {confirmPublicSharing: false}));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...raw, id: raw.requestId}, a.who, consent));
  assert.throws(() => q.prepareAgentStrategyQuickstartStrategy({...raw, id: raw.id.toUpperCase()}, a.who, consent));
  const pending = strategyPending(a), receipt = await confirmed(a, pending);
  await assert.rejects(q.prepareAgentStrategyQuickstartManifest(pending, receipt, ids(), {...consent, confirmPublicSharing: false}));
  await assert.rejects(q.prepareAgentStrategyQuickstartManifest(pending, receipt, {...ids(), id: pending.command.id}, consent));
  for (const inputs of [modelBuild.metafile.inputs, flowBuild.metafile.inputs]) for (const path of Object.keys(inputs)) assert(!/(?:demo-engine|session-engine|session-journal|session-runtime|reference-engine|chatgpt-auth|agent-management|provider)/.test(path), path);
  assert.equal(q.agentStrategyQuickstartSpec.executionEnabled, false);
});

test('actual agent withdrawals retain suppressed acceptance without granting management or moderation authority', async () => {
  const f = await completed();
  const unauthorizedModeration = {action: 'moderate', requestId: uid(), id: f.strategy.command.id, digest: f.strategyReceipt.item.digest, state: 'HIDDEN', reason: 'POLICY', policyAccepted: 'public-strategy-v1'};
  assert.equal((await rawWrite(f.a, 'STRATEGY', unauthorizedModeration)).status, 403);
  const manageWithAgent = await worker.dispatchFetch(origin + '/api/network/agents', {method: 'POST', headers: {Authorization: 'Bearer ' + f.a.token, Origin: origin, 'Content-Type': 'application/json', 'X-Network-Intent': 'onboard'}, body: JSON.stringify({action: 'revoke', requestId: uid(), id: f.a.command.id, revision: 1})});
  assert.equal(manageWithAgent.status, 401);
  const withdraw = {action: 'withdraw', requestId: uid(), id: f.manifest.command.id, digest: f.manifestReceipt.item.digest, reason: 'AUTHOR_REQUEST', policyAccepted: 'public-experiment-v1'};
  assert.equal((await rawWrite(f.a, 'MANIFEST', withdraw)).status, 200);
  const parent = await confirmed(f.a, f.manifest); assert.equal(parent.item.state, 'WITHDRAWN'); assert.equal(parent.item.record, null);
  await assert.rejects(q.prepareAgentStrategyQuickstartUnavailableOutcome(f.manifest, parent, f.source, operationIds(), consent));
  const outcome = await confirmed(f.a, f.outcome); assert.equal(outcome.item.suppression, 'PARENT_UNAVAILABLE'); assert.equal(outcome.item.record, null);
  assert.equal((await rawWrite(f.a, 'STRATEGY', {action: 'withdraw', requestId: uid(), id: f.strategy.command.id, digest: f.strategyReceipt.item.digest, reason: 'AUTHOR_REQUEST', policyAccepted: 'public-strategy-v1'})).status, 200);
  const source = await confirmed(f.a, f.strategy); assert.equal(source.item.state, 'WITHDRAWN'); assert.equal(source.item.record, null);
  await assert.rejects(q.prepareAgentStrategyQuickstartManifest(f.strategy, source, ids(), consent));
  assert.equal(await count('strategy_publications'), 1); assert.equal(await count('experiment_records'), 2);
});

test('an external client can construct and correlate the full actual D1 workflow from anonymous machine JSON alone', async () => {
  // No private reference helper or schema is used to construct these requests or
  // canonical expectations. Shared schemas below only assert the public recipe.
  const guideResponse = await worker.dispatchFetch(origin + '/api/network/strategy-quickstart'); assert.equal(guideResponse.status, 200);
  const guide = await guideResponse.json(), orders = guide.protocol.canonicalOrders;
  const a = await agent(), originalPrincipal = structuredClone(a.who);
  const ordered = (keys, value) => {assert.deepEqual(Object.keys(value).sort(), [...keys].sort()); return Object.fromEntries(keys.map(key => [key, value[key]]));};
  const reference = value => ordered(orders.reference, value);
  const author = item => ordered(orders.agentAuthor, {...item.author, name: originalPrincipal.agent.name});
  const definition = value => ordered(orders.definition, {...value, market: ordered(orders.market, value.market), entry: ordered(orders.entry[value.entry.type], {...value.entry, ...value.entry.type === 'RULES' ? {conditions: value.entry.conditions.map(condition => ordered(orders.ruleCondition, condition))} : {}}), risk: ordered(orders.risk, value.risk), costs: ordered(orders.costs, value.costs), execution: ordered(orders.execution, value.execution)});
  const strategyContent = command => ordered(guide.workflow.strategy.canonicalContentOrder, Object.fromEntries(guide.workflow.strategy.canonicalContentOrder.map(key => [key, key === 'definition' ? definition(command[key]) : key === 'sources' ? command[key].map(value => ordered(orders.source, value)) : key === 'relation' && command[key] ? ordered(orders.relation, command[key]) : command[key]])));
  const disclosures = value => ordered(orders.disclosures, {...value, search: ordered(orders.search, value.search), validation: ordered(orders.validation, value.validation), conflicts: ordered(orders.conflicts, value.conflicts), publication: ordered(orders.publication, value.publication)});
  const flags = (rules, context, item = null, parent = null) => {
    const read = path => path.split('.').reduce((value, key) => value[key], context);
    const matches = rule => {
      if (rule === 'outcome author.kind/id equals parent author.kind/id') return item.author.kind === parent.author.kind && item.author.id === parent.author.id;
      if (rule === 'outcome author.sponsorId equals parent author.sponsorId') return item.author.sponsorId === parent.author.sponsorId;
      if (rule.startsWith('!')) return !read(rule.slice(1));
      const expression = /^([A-Za-z.]+)(!=|=|>)([A-Z_]+|[0-9]+)$/.exec(rule); assert(expression, rule);
      const actual = read(expression[1]), expected = /^[0-9]+$/.test(expression[3]) ? Number(expression[3]) : expression[3];
      return expression[2] === '=' ? actual === expected : expression[2] === '!=' ? actual !== expected : actual > expected;
    };
    return [...rules.initial, ...rules.appendInOrder.filter(rule => matches(rule.when)).map(rule => rule.flag)];
  };
  const digest = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
  const send = async (phase, command) => {
    const body = JSON.stringify(command), response = await worker.dispatchFetch(origin + phase.path, {method: phase.method, headers: {'Content-Type': guide.transport.contentType, Authorization: 'Bearer ' + a.token}, body});
    assert.equal(response.status, 200, await response.clone().text()); const receipt = await response.json();
    assert.deepEqual(Object.keys(receipt), guide.receipt.fields); assert.equal(receipt.action, command.action); assert.equal(receipt.requestId, command.requestId); assert.equal(receipt.item.id, command.id);
    assert.equal(receipt.item.author.kind, 'AGENT'); assert.equal(receipt.item.author.id, originalPrincipal.agent.id); assert.equal(receipt.item.record.author.name, originalPrincipal.agent.name);
    assert.equal(new Date(receipt.item.createdAt).toISOString(), receipt.item.createdAt); assert.equal(receipt.executionEnabled, false); assert.equal(receipt.report, null);
    assert.deepEqual(m.networkIdentitySchema.parse(await (await identity(a.token)).json()), originalPrincipal);
    const retry = await worker.dispatchFetch(origin + phase.path, {method: phase.method, headers: {'Content-Type': guide.transport.contentType, Authorization: 'Bearer ' + a.token}, body});
    assert.equal(retry.status, 200); assert.deepEqual(await retry.json(), receipt); return receipt;
  };
  const strategyCommand = {...guide.workflow.strategy.example, requestId: uid(), id: uid()};
  assert.deepEqual(m.boundedStrategyCommand(strategyCommand).command, strategyCommand);
  const strategyReceipt = await send(guide.workflow.strategy, strategyCommand), sponsor = strategyReceipt.item.author.sponsorId;
  const source = ordered(guide.workflow.strategy.canonicalRecordOrder, {version: 1, id: strategyCommand.id, rootId: strategyCommand.id, revision: 1, requestId: strategyCommand.requestId, createdAt: strategyReceipt.item.createdAt, author: author(strategyReceipt.item), content: strategyContent(strategyCommand), policyAccepted: strategyCommand.policyAccepted, verification: guide.strategyVerification, executionEnabled: guide.executionEnabled});
  assert.deepEqual(strategyReceipt.item.record, source); assert.equal(strategyReceipt.item.digest, digest(source));
  assert.equal(m.boundedStrategyRecord(source).payload, JSON.stringify(source));
  const manifestCommand = structuredClone(guide.workflow.manifest.example); manifestCommand.requestId = uid(); manifestCommand.id = uid(); manifestCommand.input.requestId = uid(); manifestCommand.input.dataset.id = uid();
  manifestCommand.input.strategy = {record: source, digest: strategyReceipt.item.digest};
  const input = ordered(orders.input, {...manifestCommand.input, strategy: ordered(orders.inputStrategy, manifestCommand.input.strategy), dataset: ordered(orders.dataset, {...manifestCommand.input.dataset, rights: ordered(orders.rights, manifestCommand.input.dataset.rights), bars: manifestCommand.input.dataset.bars.map(bar => ordered(orders.bar, bar))}), signals: manifestCommand.input.signals.map(signal => ordered(orders.signal, signal))});
  manifestCommand.input = input;
  manifestCommand.evaluator = ordered(orders.evaluator, manifestCommand.evaluator); manifestCommand.disclosures = disclosures(manifestCommand.disclosures);
  assert.deepEqual(m.boundedExperimentCommand(manifestCommand).command, manifestCommand);
  const manifestReceipt = await send(guide.workflow.manifest, manifestCommand); assert.equal(manifestReceipt.item.author.sponsorId, sponsor);
  const manifestRecord = ordered(guide.workflow.manifest.canonicalRecordOrder, {version: 1, id: manifestCommand.id, requestId: manifestCommand.requestId, createdAt: manifestReceipt.item.createdAt, author: author(manifestReceipt.item), type: 'MANIFEST', content: ordered(guide.workflow.manifest.canonicalContentOrder, {name: manifestCommand.name, input, evaluator: manifestCommand.evaluator, baseline: manifestCommand.baseline, disclosures: manifestCommand.disclosures}), flags: flags(guide.protocol.flagRules.manifest, manifestCommand.disclosures), policyAccepted: manifestCommand.policyAccepted, classification: guide.classification, executionEnabled: guide.executionEnabled});
  assert.deepEqual(manifestReceipt.item.record, manifestRecord); assert.equal(manifestReceipt.item.digest, digest(manifestRecord));
  assert.equal(m.boundedExperimentRecord(manifestRecord).payload, JSON.stringify(manifestRecord));
  const currentSourceResponse = await getStrategy(source.id); assert.equal(currentSourceResponse.status, 200); const currentSource = (await currentSourceResponse.json()).item;
  assert.equal(currentSource.state, 'VISIBLE'); assert.deepEqual(currentSource.record, source); assert.equal(currentSource.digest, strategyReceipt.item.digest);
  const outcomeCommand = {...structuredClone(guide.workflow.outcome.example), requestId: uid(), id: uid(), manifest: reference({id: manifestRecord.id, digest: manifestReceipt.item.digest})};
  outcomeCommand.result = ordered(orders.unavailableResult, outcomeCommand.result); outcomeCommand.claim = ordered(orders.claim, outcomeCommand.claim);
  assert.deepEqual(m.boundedExperimentCommand(outcomeCommand).command, outcomeCommand);
  const outcomeReceipt = await send(guide.workflow.outcome, outcomeCommand); assert.equal(outcomeReceipt.item.author.sponsorId, sponsor);
  const outcomeRecord = ordered(guide.workflow.outcome.canonicalRecordOrder, {version: 1, id: outcomeCommand.id, requestId: outcomeCommand.requestId, createdAt: outcomeReceipt.item.createdAt, author: author(outcomeReceipt.item), type: 'OUTCOME', content: ordered(guide.workflow.outcome.canonicalContentOrder, {name: outcomeCommand.name, manifest: outcomeCommand.manifest, result: outcomeCommand.result, claim: outcomeCommand.claim}), flags: flags(guide.protocol.flagRules.outcome, {claim: outcomeCommand.claim}, outcomeReceipt.item, manifestReceipt.item), policyAccepted: outcomeCommand.policyAccepted, classification: guide.classification, executionEnabled: guide.executionEnabled});
  assert.deepEqual(outcomeReceipt.item.record, outcomeRecord); assert.equal(outcomeReceipt.item.digest, digest(outcomeRecord));
  assert.equal(m.boundedExperimentRecord(outcomeRecord).payload, JSON.stringify(outcomeRecord));
  assert.equal(outcomeRecord.content.result.kind, 'ARTIFACT_UNAVAILABLE'); assert.equal(guide.workflow.outcome.noEvaluationAttempted, true);
  const evidencePath = guide.readback.evidence.replace('<confirmed strategy UUID>', source.id).replace('<confirmed strategy digest>', strategyReceipt.item.digest);
  const response = await worker.dispatchFetch(origin + evidencePath); assert.equal(response.status, 200);
  const evidence = await m.validateStrategyEvidencePage(await response.json()); assert.equal(evidence.qualification, 'NONE'); assert.equal(evidence.independence, 'NOT_ESTABLISHED');
  assert.deepEqual(evidence.items.find(value => value.summary.id === outcomeRecord.id).observation, {kind: 'ARTIFACT_UNAVAILABLE'});
  assert.equal(await count('strategy_publications'), 1); assert.equal(await count('experiment_records'), 2);
});
