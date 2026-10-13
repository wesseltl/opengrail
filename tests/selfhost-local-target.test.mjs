import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

test('standalone build target preserves the default and confines local checks to fresh owned outputs', async t => {
  const compiled = await build({ entryPoints: ['build/selfhost-local-target.ts'], bundle: true, write: false,
    format: 'esm', platform: 'node', target: 'node22', external: ['node:*'] });
  const { standaloneOutputRoot } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'opengrail-local-target-')));
  const project = join(parent, 'project'); mkdirSync(project, { mode: 0o755 });
  const originalCwd = process.cwd(); const previous = process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT;
  const marker = outputRoot => ({ schema: 'OPENGRAIL_LOCAL_SELFHOST_BUILD_TARGET_V1', sourceRoot: project, outputRoot, runId: randomUUID() });
  const create = (name, options = {}) => {
    const output = join(parent, name); mkdirSync(output, { mode: options.mode ?? 0o700 });
    chmodSync(output, options.mode ?? 0o700);
    const path = join(output, 'local-check-build.json');
    writeFileSync(path, options.bytes ?? JSON.stringify({ ...marker(output), ...options.patch }, null, 2) + '\n', { mode: options.markerMode ?? 0o600, flag: 'wx' });
    chmodSync(path, options.markerMode ?? 0o600);
    process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT = output;
    return { output, path };
  };
  try {
    process.chdir(project);
    await t.test('normal standalone build retains its existing relative directory', () => {
      delete process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT;
      assert.equal(standaloneOutputRoot(), 'dist-selfhost');
    });
    await t.test('two fresh local targets leave a previous source build intact', () => {
      mkdirSync('dist-selfhost'); writeFileSync('dist-selfhost/keep.txt', 'prior build');
      for (const name of ['first', 'second']) {
        const { output } = create(name);
        assert.equal(standaloneOutputRoot(), join(output, 'compiled'));
      }
      assert.equal(readFileSync('dist-selfhost/keep.txt', 'utf8'), 'prior build');
    });
    await t.test('a target inside the source cannot redirect build output', () => {
      const output = join(project, 'inside'); mkdirSync(output, { mode: 0o700 });
      writeFileSync(join(output, 'local-check-build.json'), JSON.stringify(marker(output), null, 2) + '\n', { mode: 0o600 });
      process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT = output;
      assert.throws(standaloneOutputRoot);
    });
    await t.test('public output directories and marker files are refused', () => {
      create('public-directory', { mode: 0o755 }); assert.throws(standaloneOutputRoot);
      create('public-marker', { markerMode: 0o644 }); assert.throws(standaloneOutputRoot);
    });
    await t.test('a forged source binding or extra field cannot select an output', () => {
      create('foreign-source', { patch: { sourceRoot: parent } }); assert.throws(standaloneOutputRoot);
      create('extra-field', { patch: { provider: 'caller-controlled' } }); assert.throws(standaloneOutputRoot);
    });
    await t.test('duplicate keys, malformed UTF-8 and oversized metadata fail closed', () => {
      const duplicate = create('duplicate'); const value = marker(duplicate.output);
      writeFileSync(duplicate.path, JSON.stringify(value, null, 2).replace('{', '{\n  "schema": "discarded",') + '\n');
      assert.throws(standaloneOutputRoot);
      create('invalid-utf8', { bytes: Buffer.from([0x7b, 0xff, 0x7d]) }); assert.throws(standaloneOutputRoot);
      create('oversized', { bytes: Buffer.alloc(4097, 0x20) }); assert.throws(standaloneOutputRoot);
    });
    await t.test('linked markers and aliased targets are refused', () => {
      const linked = create('linked-marker'); linkSync(linked.path, linked.path + '.alias'); assert.throws(standaloneOutputRoot);
      const symbolic = create('symbolic-marker'); const stored = symbolic.path + '.stored';
      writeFileSync(stored, readFileSync(symbolic.path), { mode: 0o600 }); rmSync(symbolic.path); symlinkSync(stored, symbolic.path);
      assert.throws(standaloneOutputRoot);
      const actual = create('actual-target'); const alias = join(parent, 'target-alias'); symlinkSync(actual.output, alias);
      process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT = alias; assert.throws(standaloneOutputRoot);
    });
    await t.test('existing compiled files, directories and symlinks are retained rather than reused', () => {
      for (const kind of ['file', 'directory', 'symlink']) {
        const { output } = create('existing-' + kind); const path = join(output, 'compiled');
        if (kind === 'file') writeFileSync(path, 'keep original');
        else if (kind === 'directory') { mkdirSync(path); writeFileSync(join(path, 'keep'), 'keep original'); }
        else symlinkSync(project, path);
        assert.throws(standaloneOutputRoot);
        if (kind === 'file') assert.equal(readFileSync(path, 'utf8'), 'keep original');
        if (kind === 'directory') assert.equal(readFileSync(join(path, 'keep'), 'utf8'), 'keep original');
      }
    });
  } finally {
    process.chdir(originalCwd);
    if (previous === undefined) delete process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT;
    else process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT = previous;
    chmodSync(parent, 0o700); rmSync(parent, { recursive: true, force: true });
  }
});
