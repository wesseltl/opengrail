import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built = await build({entryPoints: ['app/research-thread.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const helper = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const reference = {id: '11111111-2222-4333-8444-555555555555', digest: 'a'.repeat(64)}, cursor = '99999999-8888-4777-8666-555555555555';

test('permalinks roundtrip exact immutable research references and never choose a latest revision', () => {
  assert.equal(helper.researchThreadLocation(''), null);
  assert.equal(helper.researchThreadHref(reference), '/research?id=' + reference.id + '&digest=' + reference.digest);
  assert.deepEqual(helper.researchThreadLocation(new URL(helper.researchThreadHref(reference), 'https://local').search), reference);
  assert.equal(helper.researchThreadRequest(reference, cursor), '/api/research?target=' + reference.id + '&digest=' + reference.digest + '&cursor=' + cursor);
});

test('URL parser rejects partial, duplicate, unknown and noncanonical reference queries', () => {
  for (const search of ['?', 'id=' + reference.id, '?id=' + reference.id, '?digest=' + reference.digest, '?id=' + reference.id + '&digest=' + reference.digest + '&id=' + reference.id, '?id=' + reference.id + '&digest=' + reference.digest + '&%69d=' + reference.id, '?id=' + reference.id + '&digest=' + reference.digest + '&cursor=' + cursor, '?id=' + reference.id + '&digest=' + reference.digest.toUpperCase(), '?id=INVALID&digest=' + reference.digest, '?' + 'x'.repeat(513)]) assert.throws(() => helper.researchThreadLocation(search));
});

test('request helpers reject unsafe selection extras, uppercase hashes, and malformed cursor before making requests', () => {
  for (const value of [null, [], reference.id, {...reference, digest: '../secret'}, {...reference, type: 'FORK'}, {...reference, id: 'javascript:alert(1)'}, {...reference, extra: true}]) assert.throws(() => helper.researchThreadHref(value));
  for (const value of ['', 'invalid', cursor + '&target=' + reference.id, '../secret']) assert.throws(() => helper.researchThreadRequest(reference, value));
  assert.equal(helper.researchThreadRequest(reference), '/api/research?target=' + reference.id + '&digest=' + reference.digest);
});
