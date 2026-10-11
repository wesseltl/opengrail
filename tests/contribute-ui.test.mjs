import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Actual server component fixtures check retained guide content, links and the client auth boolean. They are not browser,
// keyboard/visual acceptance, a hosted CI run or proof of published repository availability.
const require = createRequire(import.meta.url);
const built = await build({entryPoints: ['app/contribute/page.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false,
  target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'server-guide-boundary', setup(b) {
  b.onResolve({filter: /chatgpt-auth|contributions$/}, a => a.importer.endsWith('/app/contribute/page.tsx') ? {path: a.path, namespace: 'guide-stub'} : undefined);
  b.onLoad({filter: /.*/, namespace: 'guide-stub'}, a => ({contents: a.path.includes('chatgpt-auth') ? 'export async function getChatGPTUser(){if(globalThis.__guideAuthFailure) throw Error("Synthetic auth unavailable"); return globalThis.__guideAuthUser ?? null;}' : 'export default function Contributions(){return null;}', loader: 'js'}));
}}]});
const module = {exports: {}};
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
const Contribute = module.exports.default;
const originalFetch = globalThis.fetch;
let requests = 0;
globalThis.fetch = async () => { requests++; throw Error('Static contribution instructions must not fetch.'); };
after(() => { globalThis.fetch = originalFetch; delete globalThis.__guideAuthUser; delete globalThis.__guideAuthFailure; });

function walk(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate));
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function text(node) {
  return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') :
    typeof node === 'object' ? text(node.props?.children) : String(node);
}

test('anonymous contributor route gives a real local path without auth, network calls, privileges or invented public links', async () => {
  const tree = await Contribute(), content = text(tree);
  assert.equal(tree.type, 'main');
  assert.equal(requests, 0);
  assert.equal(module.exports.metadata.title, 'Contribute · OpenGrail');
  assert(content.includes('AGENTS.md') && content.includes('docs/tasks/README.md'));
  assert(content.includes('Public source available; hosted verification pending'));
  assert(content.includes('owner-created GitHub project is verified PUBLIC') && content.includes('verified application snapshot'));
  assert(content.includes('source/opengrail-foundation') && content.includes('main') && content.includes('contains a README directory'));
  assert(content.includes('Hosted CI and public launch remain unverified'));
  assert(!content.includes('application source import is pending'));
  assert(content.includes('An issue does not register a platform task, grant a claim or approve hosted workflow execution'));
  assert(content.includes('operator-declared issue mapping') && content.includes('Hosted CI can remain absent'));
  assert(content.includes('does not fetch or validate the artifact'));
  assert(content.includes('OpenGrail account is not required'));
  assert.equal(walk(tree, node => ['button', 'form', 'input', 'script', 'img', 'iframe'].includes(node.type)).length, 0);
  const anchors = walk(tree, node => node.type === 'a');
  const publicLinks = ['https://github.com/wesseltl/opengrail/tree/e727f28ad9772abd8f8c165dd016c02c22715fbc', 'https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/agent-contributor-start.md', 'https://github.com/wesseltl/opengrail/issues/1', 'https://github.com/wesseltl/opengrail/issues/2', 'https://github.com/wesseltl/opengrail/issues/3', 'https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/public-contribution-handoff.md'];
  assert.deepEqual(anchors.map(node => node.props.href), ['/', '/agent-guide', '/strategies', publicLinks[0], publicLinks[1], '/agent-guide', ...publicLinks.slice(2,5), '/demo', '/session', '/experiments', publicLinks[5]]);
  assert.deepEqual(anchors.filter(node => node.props.href.startsWith('https:')).map(node => node.props.href), publicLinks);
  assert(anchors.every(node => !/og_agent_|token=|authorization|validation\//i.test(node.props.href)));
});

test('checker instructions bind explicit reviewed commits and retain failed and interrupted local evidence', async () => {
  const tree = await Contribute(), content = text(tree), blocks = walk(tree, node => node.type === 'pre').map(text);
  assert(blocks.includes('node scripts/check-contribution.mjs BASE_SHA HEAD_SHA TESTED_MERGE_SHA NEW_REPORT.json'));
  assert(content.includes('exact two-parent merge') && content.includes('40-character lowercase commit identity'));
  assert(content.includes('Replace') && content.includes('NEW_REPORT.json') && content.includes('new report path that must be absolute and outside the checkout'));
  for (const outcome of ['PASSED', 'FAILED', 'INTERRUPTED']) assert(content.includes(outcome));
  for (const command of ['npm test', 'npm run typecheck', 'npm run build', 'git diff --check']) assert(blocks.some(block => block.includes(command)));
  assert(content.includes('20-minute') && content.includes('32 KiB') && content.includes('256 KiB'));
  assert(content.includes('not verify research, security, profitability, independent review or merge approval'));
});

test('collector instructions distinguish offline verification and current-PR checks from hosted proof or automatic publication', async () => {
  const tree = await Contribute(), content = text(tree), blocks = walk(tree, node => node.type === 'pre').map(text);
  assert(blocks.some(block => block.includes('node scripts/contribution-evidence.mjs collect POLICY.json NEW_EVIDENCE.json') &&
    block.includes('node scripts/contribution-evidence.mjs verify POLICY.json EVIDENCE.json')));
  assert(content.includes('collector reads verified public repositories only') && content.includes('trusted workflow/checker hashes'));
  assert(content.includes('explicit public-read approval') && content.includes('accepts no token'));
  assert(content.includes('offline; it does not re-fetch') && content.includes('Neither command publishes, merges or deploys'));
  for (const status of ['CI_VERIFIED', 'PENDING', 'FAILED', 'STALE', 'UNAVAILABLE']) assert(content.includes(status));
  assert(content.includes('Invented fixtures') && content.includes('cannot establish a hosted run'));
  const details = walk(tree, node => node.type === 'details');
  assert.equal(details.length, 4);
  assert(details.every(node => !node.props.open && walk(node, child => child.type === 'summary').length === 1));
});

test('private review instructions isolate read credentials and evidence from contributors and public research', async () => {
  const tree = await Contribute(), content = text(tree), blocks = walk(tree, node => node.type === 'pre').map(text);
  assert(blocks.some(block => block.includes('collect-private PRIVATE_POLICY.json NEW_PRIVATE_EVIDENCE.json /absolute/CREDENTIAL_FILE')));
  for (const phrase of ['no source access', 'Use a branch or fork', 'grants no GitHub write or production access', 'independently reviewed trusted tooling', 'separately from contributed code', 'never invokes the checker or npm commands', 'mode-0600', 'safe summary', 'Never attach private evidence', 'Linux file guards']) assert(content.includes(phrase), phrase);
  assert.equal(requests, 0);
  assert.equal(walk(tree, node => ['form', 'input', 'script', 'iframe'].includes(node.type)).length, 0);
});

test('server route passes only fail-closed auth boolean and preserves explicit homepage repository wiring', async () => {
  const [source, home] = await Promise.all([readFile('app/contribute/page.tsx', 'utf8'), readFile('app/page.tsx', 'utf8')]);
  assert(!/fetch\(|useEffect|useState|localStorage|sessionStorage|createObjectURL|clipboard|dangerouslySetInnerHTML/.test(source));
  assert(home.includes('githubUrl="https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation"'));
  assert(source.includes('getChatGPTUser') && source.includes('force-dynamic') && source.includes('<Contributions authenticated={authenticated}'));
  assert.equal(walk(await Contribute(), node => typeof node.type === 'function' && node.type.name === 'Contributions')[0].props.authenticated, false);
  globalThis.__guideAuthUser = {id: 'synthetic-user', privateField: 'Do not forward'};
  const signed = walk(await Contribute(), node => typeof node.type === 'function' && node.type.name === 'Contributions')[0];
  assert.deepEqual(signed.props, {authenticated: true});
  globalThis.__guideAuthFailure = true;
  assert.deepEqual(walk(await Contribute(), node => typeof node.type === 'function' && node.type.name === 'Contributions')[0].props, {authenticated: false});
  delete globalThis.__guideAuthFailure; delete globalThis.__guideAuthUser;
  assert.equal(requests, 0);
});
