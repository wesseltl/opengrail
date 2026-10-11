import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result = await build({entryPoints: ['app/arena-link.ts'], bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022'});
const {arenaSelectionFromQuery, arenaHref} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const reference = {id: '28abcdef-0000-4000-8000-000000000001', digest: 'a'.repeat(64)};
test('Arena link pins one exact outcome and digest at a fixed local destination', () => {
  assert.equal(arenaHref(null), '/arena'); assert.equal(arenaSelectionFromQuery(''), null);
  const href = arenaHref(reference); assert.equal(href, '/arena?outcome=' + reference.id + '&digest=' + reference.digest);
  assert.deepEqual(arenaSelectionFromQuery(href.slice('/arena'.length)), reference);
  assert.deepEqual(arenaSelectionFromQuery(new URLSearchParams({digest: reference.digest, outcome: reference.id})), reference);
});
test('Arena links reject incomplete, repeated, unknown, uppercase and malformed query material', () => {
  const valid = 'outcome=' + reference.id + '&digest=' + reference.digest;
  for (const value of ['outcome=' + reference.id, 'digest=' + reference.digest, valid + '&digest=' + reference.digest, valid + '&outcome=' + reference.id, valid + '&redirect=https://evil.invalid', valid + '&token=secret', valid.replace(reference.id, reference.id.toUpperCase()), valid.replace(reference.digest, 'A'.repeat(64)), valid + '#fragment', valid + ' ', valid + '&bad=%ZZ', 'outcome=x&digest=y', 'x'.repeat(513)]) assert.throws(() => arenaSelectionFromQuery(value), value);
  assert.throws(() => arenaSelectionFromQuery(new URLSearchParams({outcome: reference.id, digest: reference.digest, execution: 'LIVE'})));
  assert.throws(() => arenaHref({...reference, digest: 'x'}));
});
