import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const buildModule = async path => { const result = await build({entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022', jsx: 'automatic'}); return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')); };
const ui = await buildModule('app/venture-editor.tsx'), model = await buildModule('app/venture-model.ts');
const date = '2026-10-11', sources = ['https://example.com/a','https://example.com/b','https://example.com/c'].map(url => ({url, classification: 'PRIMARY', note: ''}));
const fact = sourceIndices => ({state: 'REPORTED', value: 'Synthetic declared claim.', classification: 'FOUNDER_CLAIM', asOf: date, sourceIndices});
function sample() {
  const blank = model.blankVentureDossier(date);
  return {...blank, issuer: {...blank.issuer, name: 'Synthetic issuer', website: 'https://example.com/issuer', sector: 'CRYPTO_INFRA'}, risks: ['Customer demand is unknown.'], nextCatalyst: {event: 'Check paid customer evidence.', date: null}, product: fact([0, 2]), founders: [fact([2])], traction: [fact([1])], terms: {...blank.terms, minimumTicket: {state: 'REPORTED', amount: 500, currency: 'EUR', classification: 'ESTIMATE', asOf: date, sourceIndices: [1]}}, access: {status: 'MAYBE', asOf: date, sourceIndices: [0], route: null, conditions: 'Current Dutch retail eligibility needs review.'}, crypto: {usage: fact([2]), tokenomics: {state: 'UNKNOWN'}, liquidity: fact([1])}};
}

test('source reorder keeps every nested venture claim attached to its original exact URL', () => {
  const before = sample(), afterSources = [sources[2], sources[0], sources[1]], after = ui.remapVentureSources(before, sources, afterSources);
  assert.deepEqual(after.product.sourceIndices, [0, 1]); assert.deepEqual(after.founders[0].sourceIndices, [0]); assert.deepEqual(after.traction[0].sourceIndices, [2]); assert.deepEqual(after.terms.minimumTicket.sourceIndices, [2]); assert.deepEqual(after.access.sourceIndices, [1]); assert.deepEqual(after.crypto.usage.sourceIndices, [0]); assert.deepEqual(after.crypto.liquidity.sourceIndices, [2]); model.validateVentureSources(after, afterSources, date);
  assert.deepEqual(before.product.sourceIndices, [0, 2]); assert.equal(after.product.value, before.product.value); assert.equal(after.product.asOf, before.product.asOf);
});

test('partial source loss retains a rejecting unresolved marker even while another cited URL remains', () => {
  const after = ui.remapVentureSources(sample(), sources, sources.slice(1));
  assert.deepEqual(after.product.sourceIndices, [1, model.ventureLimits.sources]); assert.deepEqual(after.access.sourceIndices, [model.ventureLimits.sources]); assert.equal(after.product.state, 'REPORTED'); assert.throws(() => model.validateVentureSources(after, sources.slice(1), date));
});

test('changed or ambiguous URLs never receive a prior claim through index reuse', () => {
  for (const afterSources of [[{...sources[0], url: 'https://example.com/replacement'}, sources[1], sources[2]], [sources[0], sources[0], sources[2]]]) { const after = ui.remapVentureSources(sample(), sources, afterSources); assert(after.product.sourceIndices.includes(model.ventureLimits.sources)); assert(after.access.sourceIndices.includes(model.ventureLimits.sources)); assert.throws(() => model.validateVentureSources(after, afterSources, date)); }
});

test('source classification edits preserve URL identity without granting claim verification or filling unknown values', () => {
  const before = sample(), after = ui.remapVentureSources(before, sources, sources.map(value => ({...value, classification: 'AUTHOR_CLAIM', note: 'Author changed classification.'})));
  assert.deepEqual(after, before); assert.equal(after.crypto.tokenomics.state, 'UNKNOWN'); assert.equal(after.terms.valuation.state, 'UNKNOWN'); assert.equal(model.ventureScoreTotal(after.scoring.components), null);
});

test('venture page shares authenticated Research registry and editor has no persistence, remote fetch or executable input', async () => {
  const page = await readFile('app/venture/page.tsx', 'utf8'), editor = await readFile('app/venture-editor.tsx', 'utf8'); assert(page.includes('getChatGPTUser')); assert(page.includes('signedIn={!!user} ventureOnly')); assert(!/localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML|eval\(|fetch\(|console\.(?:log|warn|error)/.test(editor));
});
