import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const result = await build({entryPoints: ['app/agent-guide/page.tsx'], bundle: true, platform: 'node', format: 'cjs', target: 'es2022', write: false, jsx: 'automatic', loader: {'.css': 'empty'}});
const module = {exports: {}}; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const tree = module.exports.default();
function walk(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => walk(value, predicate));
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function text(node) { return node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node); }

test('guide renders anonymous self-contained steps, policy and machine specification links without source-access assumptions', () => {
  const content = text(tree), links = walk(tree, node => node.type === 'a');
  for (const phrase of ['human sponsors', 'external', 'secret manager', 'contains no sponsorId', 'server derives sponsorship', 'exact ID and digest', 'same-cost', 'UNVERIFIED', 'record: null', 'identical serialized body', 'original agent/credential principal', 'no automatic reset', 'Public source available', 'hosted acceptance pending', 'source/opengrail-foundation', 'contains a README directory', 'Hosted CI and API availability remain unverified']) assert(content.includes(phrase), phrase);
  assert(links.some(node => node.props.href === '/research-policy')); assert(links.some(node => node.props.href === '/api/network/quickstart'));
  assert(links.some(node => node.props.href === '/#agents'));
  assert.deepEqual(links.filter(node => node.props.href.startsWith('https:')).map(node => node.props.href), ['https://github.com/wesseltl/opengrail/tree/16f141c3f2822a5c42e53b1017622a257e6210e2', 'https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/agent-contributor-start.md']);
  assert(!links.some(node => /og_agent_|token=|authorization/i.test(node.props.href)));
  assert(links.some(node => node.props.href === '/agent-guide/task-discussions'));
  assert.equal(walk(tree, node => ['form', 'input', 'textarea', 'button'].includes(node.type)).length, 0);
  assert.equal(walk(tree, node => node.type === 'h1').length, 1);
  const sections = walk(tree, node => node.type === 'section').map(node => node.props.id); assert.deepEqual(sections, ['sponsor', 'identity', 'publish', 'receipt', 'withdraw', 'limits']);
  assert.equal(walk(tree, node => node.type === 'table').length, 1); assert.equal(walk(tree, node => node.type === 'caption').length, 1);
});

test('guide code examples are display-only complete current commands, and disclose canonical order and navigation loss', () => {
  const content = text(tree), code = walk(tree, node => node.type === 'pre').map(text);
  const commands = code.filter(value => value.trim().startsWith('{')).map(value => JSON.parse(value));
  assert.equal(commands.length, 2); assert.equal(commands[0].action, 'publish'); assert.equal(commands[0].kind, 'HYPOTHESIS'); assert.equal(commands[1].action, 'withdraw'); assert.equal(commands[1].id, commands[0].id);
  assert(content.includes('Save before navigating')); assert(content.includes('server cannot recover'));
  assert(content.includes('canonical v1') || content.includes('Canonical v1')); assert(content.includes('SHA-256'));
  assert(content.includes('No submission is sent by this page'));
  const source = readFileSync('app/agent-guide/page.tsx', 'utf8');
  assert(!/['"]use client|\bfetch\s*\(|localStorage|sessionStorage|process\.env|cookies\(|useEffect|clipboard/.test(source));
  const css = readFileSync('app/agent-guide/agent-guide.css', 'utf8'); assert(css.includes('focus-visible')); assert(css.includes('prefers-reduced-motion')); assert(css.includes('max-width:760px'));
});


test('guide offers compact three-step discovery and identifies the SDK as source without invented hosted downloads or write authority',()=>{
 const content=text(tree),links=walk(tree,node=>node.type==='a');
 for(const phrase of ['Start in three steps','Discover one focus','fixed original IDs','matching receipt','scripts/opengrail-agent-client.mjs','docs/agent-start.md','Source only','hosted availability is UNKNOWN','no hosted SDK download','automatic retry','required paid AI API','financial permission','400, 401, 409, 429 or 503 can follow a stored write','cannot prove NOT_APPLIED'])assert(content.includes(phrase),phrase);
 assert(links.some(node=>node.props.href==='/api/network/agent-start'));assert(links.some(node=>node.props.href==='/api/network/quickstart'));assert(!links.some(node=>/\/scripts\/opengrail-agent-client\.mjs|\/docs\/agent-start\.md/.test(node.props.href)),'Unserved source paths cannot be presented as hosted downloads.');
});
