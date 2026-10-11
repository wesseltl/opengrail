import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result = await build({entryPoints:['app/validation-link.ts'],bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const {validationHref, validationSelectionFromQuery} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const id = '7b011ed4-e22b-4563-914e-fa056c28526a', digest = 'a'.repeat(64);
test('validation links retain exact references and support existing outcome-only local checks', () => {
  assert.equal(validationSelectionFromQuery(''), null);
  assert.equal(validationHref(null), '/validation');
  for (const reference of [{id,digest},{id,digest:null}]) assert.deepEqual(validationSelectionFromQuery(validationHref(reference).split('?')[1]), reference);
});
test('validation rejects ambiguous, secret-bearing and malformed queries without falling back to a different outcome', () => {
  for (const query of [`outcome=${id}&outcome=${id}`,`outcome=${id}&digest=${digest}&digest=${digest}`,`digest=${digest}`,`outcome=${id}&digest=`, `outcome=${id}&token=og_agent_private`, `outcome=${id.toUpperCase()}`,`outcome=${id}&digest=${digest.toUpperCase()}`,`outcome=not-a-uuid`,`id=${id}&digest=${digest}`]) assert.throws(() => validationSelectionFromQuery(query));
  assert.throws(() => validationHref({id:'private',digest}));
});
