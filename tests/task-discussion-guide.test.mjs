import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const bundle = await build({stdin: {contents: "export {default as Guide,metadata} from './app/agent-guide/task-discussions/page';export {default as Policy} from './app/task-discussion-policy/page';export {syntheticTaskDiscussionExample} from './app/task-discussion-example';export * from './app/task-discussion-model';export {networkCapabilities} from './app/network-capabilities';export {renderToStaticMarkup} from 'react-dom/server';", resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'cjs', target: 'es2022', write: false, jsx: 'automatic', loader: {'.css': 'empty'}});
const module = {exports: {}};
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const m = module.exports;
function walk(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => walk(value, predicate)); return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)]; }
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }

test('anonymous guide renders complete typed inert examples without network, identity or credential intake', async () => {
  const original = globalThis.fetch; let calls = 0, tree;
  try { globalThis.fetch = async () => { calls++; throw Error('No external service authorized.'); }; tree = await m.Guide(); } finally { globalThis.fetch = original; }
  assert.equal(calls, 0); const content = text(tree), html = m.renderToStaticMarkup(tree);
  assert.equal(m.metadata.title, 'Task discussions · OpenGrail');
  assert.equal(walk(tree, node => node.type === 'h1').length, 1);
  assert.equal(walk(tree, node => ['input', 'textarea', 'form', 'button', 'script', 'iframe'].includes(node.type)).length, 0);
  assert(!/<details[^>]*\bopen\b/.test(html));
  for (const phrase of ['claim is optional', 'hosted acceptance pending', 'synthetic and unregistered', 'secret manager', 'original serialized body', 'record:null', 'no truth', 'separate from claim dispositions']) assert(content.includes(phrase), phrase);
  const documents = walk(tree, node => node.type === 'pre').map(text).filter(value => value.trim().startsWith('{')).map(value => JSON.parse(value));
  const first = documents.find(value => value.task && value.command), third = documents.find(value => value.receipt);
  assert(first && third); assert.equal(first.command.claim, null); assert.equal(first.command.replyTo, null);
  assert.deepEqual(await m.validateTaskDiscussionWrite(third.receipt, first.command, third.author), third.receipt);
  assert.equal(third.receipt.message.record.body, first.command.body);
});

test('displayed commands bind exact synthetic lineage; altered actor, task or original text cannot inherit a receipt', async () => {
  const fixture = await m.syntheticTaskDiscussionExample();
  for (const name of ['publish', 'reply', 'withdraw', 'report']) assert.deepEqual(m.boundedTaskDiscussionCommand(fixture[name]).command, fixture[name]);
  assert.deepEqual(fixture.reply.replyTo, {id: fixture.record.id, digest: fixture.receipt.message.digest});
  assert.deepEqual(fixture.report.message, fixture.reply.replyTo);
  assert.deepEqual(await m.validateTaskDiscussionItem(fixture.receipt.message), fixture.receipt.message);
  for (const change of [r => {r.message.record.body += ' altered';}, r => {r.acknowledgement.actor.id = 'a2400000-0000-4000-8000-000000000010';}, r => {r.task.digest = '2'.repeat(64);}, r => {r.report = {details: 'private report text'};}]) {
    const receipt = structuredClone(fixture.receipt); change(receipt);
    await assert.rejects(() => m.validateTaskDiscussionWrite(receipt, fixture.publish, fixture.author));
  }
});

test('policy distinguishes public inert source, retained suppression and private reports from execution authority', () => {
  const tree = m.Policy(), content = text(tree);
  for (const phrase of ['public-task-discussion-v1', 'never executed or fetched', 'automated credential checks', 'private to explicitly authorized', 'no report details or reporter', 'no restore command', 'leaving or reloading loses it']) assert(content.toLowerCase().includes(phrase.toLowerCase()), phrase);
  assert.equal(walk(tree, node => ['input', 'textarea', 'form', 'button', 'script', 'iframe'].includes(node.type)).length, 0);
  assert(walk(tree, node => node.type === 'a').some(node => node.props.href === '/agent-guide/task-discussions'));
});

test('capabilities distinguish shared authored discussion and verified repository existence from code import or hosted CI', () => {
  const spec = m.networkCapabilities(), discussion = spec.taskDiscussion;
  assert.equal(discussion.page, '/contribute/discussion'); assert.equal(discussion.guide, '/agent-guide/task-discussions');
  assert.equal(discussion.policy, m.taskDiscussionPolicy); assert.deepEqual(discussion.limits, m.taskDiscussionLimits);
  assert.equal(discussion.claimRequired, false); assert.equal(discussion.classification, 'AUTHOR_REPORTED');
  for (const field of ['reputationAwarded', 'automaticMerge', 'submittedCodeExecution', 'maintainerGrantedByDefault', 'ordersEnabled', 'liveEnabled']) assert.equal(discussion[field], false, field);
  assert.equal(discussion.qualification, 'NONE');
  const endpoint = spec.endpoints.find(value => value.path === discussion.readPath);
  assert.deepEqual(endpoint.queryParameters, ['task', 'digest', 'cursor', 'id']);
  assert.equal(endpoint.write.requiredExpectedAuthorHeader, 'X-Task-Discussion-Author: current human pseudonym');
  const repository = spec.contributions.sourceRepository;
  assert.equal(repository.visibility, 'PUBLIC'); assert.equal(repository.repositoryId, 1414301089);
  assert.equal(repository.url, 'https://github.com/wesseltl/opengrail');
  assert.equal(repository.applicationSourcePublished, false); assert.equal(repository.hostedCiVerified, false);
});
