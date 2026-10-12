import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';
import { build as viteBuild } from 'vite';
import rsc, { getPluginApi } from '@vitejs/plugin-rsc';

const require = createRequire(import.meta.url), temporary = [];
const source = readFileSync('build/rsc-emitted-assets-plugin.ts', 'utf8').replace('"@vitejs/plugin-rsc"', JSON.stringify(pathToFileURL(require.resolve('@vitejs/plugin-rsc')).href));
const compiled = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const m = await import('data:text/javascript;base64,' + Buffer.from(compiled.code).toString('base64'));
function directory() { const path = mkdtempSync(join(tmpdir(), 'opengrail-rsc-assets-')); temporary.push(path); return path; }
after(() => { for (const path of temporary) rmSync(path, { recursive: true, force: true }); });
function fixture() {
  const root = directory();
  mkdirSync(join(root, 'chunks')); mkdirSync(join(root, 'css'));
  const bundle = {
    'chunks/index.js': { type: 'chunk', fileName: 'chunks/index.js', code: 'export{}' },
    'chunks/planner.js': { type: 'chunk', fileName: 'chunks/planner.js', code: 'export{}' },
    'css/shared.css': { type: 'asset', fileName: 'css/shared.css', source: '.plan{color:blue}' },
  };
  for (const output of Object.values(bundle)) writeFileSync(join(root, output.fileName), output.code ?? output.source);
  const manifest = { bootstrapScriptContent: 'import("/chunks/index.js")', clientReferenceDeps: { planner: { js: ['/chunks/planner.js'], css: ['/css/shared.css'] } }, serverResources: { root: { css: ['/css/shared.css'] } } };
  return { root, bundle, manifest };
}
function fakeConfig(capture, cssHook = () => {}) {
  const capturePlugin = { name: m.rscEmittedAssetAssumptions.capturePlugin, generateBundle: capture }, cssPlugin = { name: m.rscEmittedAssetAssumptions.cssPlugin, generateBundle: cssHook };
  return { plugins: [capturePlugin, cssPlugin], getSortedPlugins(hook) { return this.plugins.filter(p => p[hook]).sort((a, b) => Number(a[hook].order === 'post') - Number(b[hook].order === 'post')); } };
}

test('adapter is build-only and preserves the original capture handler and hook options', () => {
  const handler = () => {}, config = fakeConfig({ handler, sequential: true });
  m.orderRscAssetCaptureAfterCss(config);
  assert.equal(config.plugins[0].generateBundle.handler, handler);
  assert.equal(config.plugins[0].generateBundle.sequential, true);
  assert.equal(config.plugins[0].generateBundle.order, 'post');
  assert.equal(m.rscEmittedAssets().apply, 'build');
  assert.equal(m.rscEmittedAssets().buildApp.order, 'post');
});

test('missing, duplicate or changed installed hooks fail before changing build semantics', () => {
  for (const config of [{ ...fakeConfig(() => {}), plugins: [] }, fakeConfig(null), fakeConfig(() => {}, { handler() {}, order: 'post' })]) assert.throws(() => m.orderRscAssetCaptureAfterCss(config), /installed|expected/);
  const duplicate = fakeConfig(() => {}); duplicate.plugins.push(duplicate.plugins[0]);
  assert.throws(() => m.orderRscAssetCaptureAfterCss(duplicate), /expected one/);
  const wrongOrder = fakeConfig(() => {}); wrongOrder.getSortedPlugins = () => wrongOrder.plugins;
  assert.throws(() => m.orderRscAssetCaptureAfterCss(wrongOrder), /after CSS/);
});

test('every client, server CSS and bootstrap reference must name an actual emitted file', () => {
  const f = fixture();
  assert.deepEqual(m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), { references: 4, files: 3 });
  unlinkSync(join(f.root, 'chunks/planner.js'));
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), /emitted file is missing/);
});

test('server CSS copied after the client snapshot requires its exact source asset and physical client file', () => {
  const f = fixture(), css = f.bundle['css/shared.css']; delete f.bundle['css/shared.css'];
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), /unemitted css/);
  assert.equal(m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/', { 'css/shared.css': css }).files, 3);
  writeFileSync(join(f.root, 'css/shared.css'), '.wrong{color:red}');
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/', { 'css/shared.css': css }), /CSS differs/);
  unlinkSync(join(f.root, 'css/shared.css'));
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/', { 'css/shared.css': css }), /emitted file is missing/);
  const g = fixture(), js = g.bundle['chunks/planner.js']; delete g.bundle['chunks/planner.js'];
  assert.throws(() => m.validateRscEmittedAssets(g.manifest, g.bundle, g.root, '/', { 'chunks/planner.js': js }), /unemitted js/);
  const h = fixture(), conflicting = { ...h.bundle['css/shared.css'], source: '.different{color:red}' };
  assert.throws(() => m.validateRscEmittedAssets(h.manifest, h.bundle, h.root, '/', { 'css/shared.css': conflicting }), /conflicting client and server/);
});

test('a genuine missing JS reference fails intact instead of being pruned or replaced', () => {
  const f = fixture(); f.manifest.clientReferenceDeps.planner.js.push('/chunks/missing.js');
  const original = JSON.stringify(f.manifest);
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), /unemitted js reference/);
  assert.equal(JSON.stringify(f.manifest), original);
  assert.equal(Object.keys(f.bundle).includes('chunks/missing.js'), false);
});

test('CSS, bootstrap and emitted asset types are checked independently', () => {
  for (const change of [f => f.manifest.serverResources.root.css.push('/css/missing.css'), f => f.manifest.bootstrapScriptContent = 'import("/chunks/missing.js")', f => f.manifest.clientReferenceDeps.planner.js = ['/css/shared.css']]) {
    const f = fixture(); change(f);
    assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), /unemitted|wrong emitted asset type/);
  }
  const f = fixture(); f.manifest.bootstrapScriptContent = 'arbitrary()';
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), /single-import/);
});

test('unsupported runtime URLs and escaping emitted paths fail without executing code', () => {
  const f = fixture(); f.manifest.clientReferenceDeps.planner.js = [{ runtime: 'arbitrary()' }];
  assert.throws(() => m.validateRscEmittedAssets(f.manifest, f.bundle, f.root, '/'), /runtime asset URLs/);
  const g = fixture(); g.bundle['../outside.js'] = { type: 'chunk', fileName: '../outside.js' }; g.manifest.clientReferenceDeps.planner.js = ['/../outside.js'];
  assert.throws(() => m.validateRscEmittedAssets(g.manifest, g.bundle, g.root, '/'), /escapes/);
});

test('installed capture reproduces the CSS-only dangling JS, and post-CSS order prevents it', async () => {
  assert.equal(require('@vitejs/plugin-rsc/package.json').version, m.rscEmittedAssetAssumptions.rscVersion);
  assert.equal(require('vite/package.json').version, m.rscEmittedAssetAssumptions.viteVersion);
  async function actualBuild(corrected) {
    const root = directory(); writeFileSync(join(root, 'index.js'), 'import "./shared.css";export const index=1;'); writeFileSync(join(root, 'other.js'), 'import "./shared.css";export const other=2;'); writeFileSync(join(root, 'shared.css'), '.plan{color:blue}');
    const installed = rsc().flat(Infinity), names = ['rsc:minimal', m.rscEmittedAssetAssumptions.capturePlugin, 'rsc:virtual:vite-rsc/track-bundles'];
    let manager;
    await viteBuild({ configFile: false, root, logLevel: 'silent', environments: { rsc: { build: { cssCodeSplit: true } } }, build: { outDir: join(root, 'dist'), rolldownOptions: { input: { index: join(root, 'index.js'), other: join(root, 'other.js') } } }, plugins: [...installed.filter(p => names.includes(p.name)), { name: 'synthetic-rsc-capture-metadata', configResolved(config) { manager = getPluginApi(config).manager; manager.bundles.rsc = {}; manager.clientReferenceMetaMap = { synthetic: { referenceKey: 'synthetic', groupChunkId: join(root, 'index.js') } }; if (corrected) m.orderRscAssetCaptureAfterCss(config); } }] });
    return { manager, root };
  }
  const original = await actualBuild(false), corrected = await actualBuild(true);
  const originalDeps = original.manager.buildAssetsManifest.clientReferenceDeps.synthetic;
  assert(originalDeps.js.some(href => !original.manager.bundles.client[href.slice(1)]));
  assert.throws(() => m.validateRscEmittedAssets(original.manager.buildAssetsManifest, original.manager.bundles.client, join(original.root, 'dist'), '/'), /unemitted js/);
  const correctedDeps = corrected.manager.buildAssetsManifest.clientReferenceDeps.synthetic;
  assert(correctedDeps.css.length > 0);
  assert(correctedDeps.js.every(href => corrected.manager.bundles.client[href.slice(1)]));
  const result = m.validateRscEmittedAssets(corrected.manager.buildAssetsManifest, corrected.manager.bundles.client, join(corrected.root, 'dist'), '/');
  assert(result.references >= 3); assert(result.files >= 2);
});
