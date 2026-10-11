import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

async function load(file) {
  const built = await build({entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
}
const venture = await load('app/venture-model.ts'), research = await load('app/research-model.ts');
const day = '2026-10-11', at = day + 'T10:00:00.000Z', id = '11111111-2222-4333-8444-555555555555', requestId = '99999999-8888-4777-8666-555555555555';
const humanId = 'human_' + 'a'.repeat(64), author = {kind: 'HUMAN', id: humanId, sponsorId: humanId};
const source = {url: 'https://issuer.example.test/product', classification: 'PRIMARY', note: 'Synthetic author-classified source; not fetched.'};
const fact = (patch = {}) => ({state: 'REPORTED', value: 'Synthetic dated claim', classification: 'REPORTED_FACT', asOf: day, sourceIndices: [0], ...patch});
const money = (patch = {}) => ({state: 'REPORTED', amount: 500, currency: 'EUR', classification: 'FOUNDER_CLAIM', asOf: day, sourceIndices: [0], ...patch});
function dossier(patch = {}) {
  return {...venture.blankVentureDossier(day), issuer: {name: 'Synthetic issuer', website: 'https://issuer.example.test', kind: 'COMPANY', sector: 'AI', stage: 'PRE_SEED'}, risks: ['Independent customer demand has not been established.'], nextCatalyst: {event: 'Await independent customer evidence.', date: null}, ...patch};
}
function command(patch = {}) {
  return {version: 2, action: 'publish', requestId, id, kind: 'HYPOTHESIS', title: 'Synthetic venture thesis', statement: 'A falsifiable company hypothesis, not an investment recommendation.', assumptions: 'Financial and access claims require independent review.', falsification: 'Reject if customer demand or Netherlands eligibility cannot be established.', sources: [source], relation: null, domain: 'VENTURE', venture: dossier(), policyAccepted: 'public-research-v1', ...patch};
}
function record(sent = command(), patch = {}) {
  return {version: research.researchPublicationVersion(sent), id: sent.id, rootId: sent.id, revision: 1, requestId: sent.requestId, createdAt: at, author, content: research.researchPublicationContent(sent), policyAccepted: sent.policyAccepted, verification: 'UNVERIFIED', executionEnabled: false, ...patch};
}
async function item(sent = command(), patch = {}) {
  const parsed = research.boundedResearchRecord(record(sent)), retained = parsed.record;
  return {id: retained.id, digest: await research.researchDigest(parsed.payload), rootId: retained.rootId, revision: retained.revision, requestId: retained.requestId, createdAt: retained.createdAt, author: research.researchAuthorReference(retained.author), state: 'VISIBLE', reason: null, record: retained, moderation: [], ...patch};
}
function tombstone(value) {
  return {...value, state: 'HIDDEN', reason: 'POLICY', record: null, moderation: [{sequence: 1, requestId: 'aaaa1111-2222-4333-8444-555555555555', createdAt: at, actor: author, state: 'HIDDEN', reason: 'POLICY'}]};
}

test('blank venture fields are explicit unknowns and an honest draft requires identity, risk and catalyst before publication', () => {
  const blank = venture.blankVentureDossier(day);
  assert.equal(blank.issuer.name, ''); assert.equal(blank.issuer.website, ''); assert.deepEqual(blank.risks, ['']); assert.equal(blank.nextCatalyst.event, '');
  assert.equal(venture.ventureDossierSchema.safeParse(blank).success, false); assert.deepEqual(blank.access, {status: 'UNKNOWN', asOf: null, sourceIndices: [], route: null, conditions: ''});
  for (const value of [blank.product, blank.customer, blank.competition, blank.edge, blank.funding, blank.dilution, ...Object.values(blank.terms)]) assert.deepEqual(value, {state: 'UNKNOWN'});
  assert.deepEqual(blank.founders, []); assert.deepEqual(blank.traction, []); assert.equal(blank.crypto, null); assert.equal(venture.ventureScoreTotal(blank.scoring.components), null);
  assert.equal(venture.ventureDossierSchema.safeParse(dossier()).success, true); assert.equal(research.researchPublishSchema.safeParse(command({sources: []})).success, true);
});

test('version-one command and record canonical bytes keep their exact historical keys, field order and normalization', () => {
  // Fixed fixtures describe the pre-venture contract independently of the new builders.
  const legacy = {action: 'publish', requestId, id, kind: 'OBSERVATION', title: 'Legacy observation', statement: 'Original statement', assumptions: 'Original assumptions', falsification: 'Original falsification', sources: [source], relation: null, policyAccepted: 'public-research-v1'};
  const expectedContent = {kind: 'OBSERVATION', title: 'Legacy observation', statement: 'Original statement', assumptions: 'Original assumptions', falsification: 'Original falsification', sources: [source], relation: null};
  const expectedRecord = {version: 1, id, rootId: id, revision: 1, requestId, createdAt: at, author, content: expectedContent, policyAccepted: 'public-research-v1', verification: 'UNVERIFIED', executionEnabled: false};
  assert.equal(research.boundedResearchCommand({...legacy, title: '  Legacy observation  '}).payload, JSON.stringify(legacy));
  assert.equal(research.boundedResearchRecord({...expectedRecord, content: {...expectedContent, statement: ' Original statement '}}).payload, JSON.stringify(expectedRecord));
  assert.equal(JSON.stringify(research.researchPublicationContent(legacy)), JSON.stringify(expectedContent)); assert.equal(research.researchPublicationVersion(legacy), 1);
  assert.equal(JSON.stringify(research.researchPublishCommandForRecord(expectedRecord)), JSON.stringify(legacy));
  for (const extra of [{version: 1}, {domain: 'VENTURE'}, {venture: dossier()}, {verified: true}]) assert.equal(research.researchPublishSchema.safeParse({...legacy, ...extra}).success, false);
  const nonAgentLegacyText = {...legacy, statement: 'An authored local token marker og_local_owner_' + 'a'.repeat(64)};
  assert.equal(research.researchPublishSchema.safeParse(nonAgentLegacyText).success, true, 'Existing v1 text semantics are unchanged.');
});

test('version-two canonical builders bind the dossier while receipts remain research version one', async () => {
  const sent = research.researchPublishSchema.parse(command()), retained = research.boundedResearchRecord(record(sent)), visible = await item(sent);
  assert.equal(research.researchPublicationVersion(sent), 2); assert.deepEqual(Object.keys(retained.record.content), ['kind', 'title', 'statement', 'assumptions', 'falsification', 'sources', 'relation', 'domain', 'venture']);
  assert.deepEqual(Object.keys(sent), ['version', 'action', 'requestId', 'id', 'kind', 'title', 'statement', 'assumptions', 'falsification', 'sources', 'relation', 'domain', 'venture', 'policyAccepted']);
  assert.equal(JSON.stringify(research.researchPublishCommandForRecord(retained.record)), JSON.stringify(sent)); assert.equal(retained.record.verification, 'UNVERIFIED'); assert.equal(retained.record.executionEnabled, false);
  assert.equal(research.researchWriteSchema.parse({version: 1, action: 'publish', requestId, item: visible, report: null, executionEnabled: false}).version, 1);
  const changed = record(sent); changed.content.venture.risks = ['A different retained risk.']; assert.notEqual(await research.researchDigest(research.boundedResearchRecord(changed).payload), visible.digest);
  for (const extra of [{domain: 'OTHER'}, {version: 1}, {version: 3}, {verified: true}, {investmentEnabled: true}]) assert.equal(research.researchPublishSchema.safeParse({...sent, ...extra}).success, false);
});

test('all claim states stay authored, and reported entries require unique bounded existing source indices', () => {
  for (const classification of ['REPORTED_FACT', 'FOUNDER_CLAIM', 'ESTIMATE', 'SPECULATION']) {
    const value = dossier({product: fact({classification})}); venture.validateVentureSources(value, [source], at); assert.equal(value.product.classification, classification);
  }
  for (const sourceIndices of [[], [0, 0], [-1], [8], [0.5], [1], [0, 1]]) assert.equal(research.researchPublishSchema.safeParse(command({venture: dossier({product: fact({sourceIndices})})})).success, false);
  for (const url of ['http://issuer.example.test', 'https://username:password@issuer.example.test', 'javascript:alert(1)']) assert.throws(() => venture.validateVentureSources(dossier(), [{url}], at));
  assert.throws(() => venture.validateVentureSources(dossier(), [source, {...source, note: 'A second label for the same page.'}], at));
  assert.throws(() => venture.validateVentureSources(dossier(), Array.from({length: 9}, (_, i) => ({url: 'https://source.example.test/' + i})), at));
  for (const patch of [{state: 'VERIFIED'}, {state: 'UNKNOWN', value: 'Unknown must contain no asserted value.'}, {state: 'REPORTED', value: ''}, {state: 'REPORTED', classification: 'VERIFIED_FACT'}]) assert.equal(venture.ventureFactSchema.safeParse({...fact(), ...patch}).success, false);
});

test('every financial and access source reference is checked against the actual publication source array', () => {
  const modifications = [value => value.customer = fact({sourceIndices: [1]}), value => value.founders = [fact({sourceIndices: [1]})], value => value.traction = [fact({sourceIndices: [1]})], value => value.terms.valuation = {...money({sourceIndices: [1]}), basis: 'PRE_MONEY'}, value => value.terms.roundSize = money({sourceIndices: [1]}), value => value.terms.minimumTicket = money({sourceIndices: [1]}), value => value.terms.security = fact({sourceIndices: [1]}), value => value.terms.fees = fact({sourceIndices: [1]}), value => value.crypto = {usage: fact({sourceIndices: [1]}), tokenomics: {state: 'UNKNOWN'}, liquidity: {state: 'UNKNOWN'}}, value => value.access = {status: 'YES', asOf: day, sourceIndices: [1], route: null, conditions: 'Claim still requires review.'}];
  for (const modify of modifications) { const value = dossier(); modify(value); assert.equal(research.researchPublishSchema.safeParse(command({venture: value})).success, false); }
});

test('canonical calendar dates reject rollover and facts cannot postdate review or the authoritative creation clock', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00.000Z', 'not-a-date']) assert.equal(venture.ventureDateSchema.safeParse(date).success, false);
  assert.equal(venture.ventureDateSchema.parse('2024-02-29'), '2024-02-29');
  const futureFact = dossier({product: fact({asOf: '2026-10-12'})}); assert.equal(venture.ventureDossierSchema.safeParse(futureFact).success, false);
  const futureAccess = dossier({access: {status: 'MAYBE', asOf: '2026-10-12', sourceIndices: [0], route: null, conditions: 'Not yet qualified.'}}); assert.equal(venture.ventureDossierSchema.safeParse(futureAccess).success, false);
  const futureReview = dossier({asOf: '2026-10-12'}); assert.equal(research.researchPublishSchema.safeParse(command({venture: futureReview})).success, true); assert.throws(() => venture.validateVentureSources(futureReview, [source], at)); assert.equal(research.researchRecordSchema.safeParse(record(command({venture: futureReview}))).success, false);
  assert.doesNotThrow(() => venture.validateVentureSources(dossier(), [source], day)); assert.doesNotThrow(() => venture.validateVentureSources(dossier(), [source], at));
  for (const clock of ['2026-10-10', '2026-10-10T23:59:59.999Z', '2026-10-11T10:00:00Z', '2026-10-11T12:00:00.000+02:00', 'bad']) assert.throws(() => venture.validateVentureSources(dossier(), [source], clock));
  const anticipated = dossier({nextCatalyst: {event: 'A possible future product launch.', date: '2035-01-01'}}); assert.doesNotThrow(() => venture.validateVentureSources(anticipated, [source], at));
});

test('known valuation dates are bound even if all other claims remain unknown', () => {
  for (const field of ['valuation', 'roundSize', 'minimumTicket']) {
    const value = dossier(); value.terms[field] = {...money({asOf: '2026-10-12'}), ...(field === 'valuation' ? {basis: 'POST_MONEY'} : {})}; assert.equal(venture.ventureDossierSchema.safeParse(value).success, false);
  }
});

test('money keeps denomination and valuation basis explicit without guessing or currency conversion', () => {
  for (const currency of ['EUR', 'USD', 'GBP', 'CHF']) assert.equal(venture.ventureMoneySchema.parse(money({currency})).currency, currency);
  assert.equal(venture.ventureMoneySchema.parse(money({amount: 0})).amount, 0); assert.equal(venture.ventureMoneySchema.parse(money({amount: 0.5})).amount, 0.5);
  for (const amount of [-1, Infinity, NaN, 1e15 + 1]) assert.equal(venture.ventureMoneySchema.safeParse(money({amount})).success, false);
  for (const basis of ['PRE_MONEY', 'POST_MONEY', 'FDV', 'MARKET_CAP', 'UNKNOWN']) assert.equal(venture.ventureValuationSchema.parse({...money(), amount: 2_000_000, basis}).basis, basis);
  for (const value of [{...money(), amount: 0, basis: 'PRE_MONEY'}, {...money(), basis: 'ENTERPRISE_VALUE'}, {...money()}, {...money(), currency: 'BTC', basis: 'FDV'}, {state: 'UNKNOWN', amount: 0}]) assert.equal(venture.ventureValuationSchema.safeParse(value).success, false);
});

test('Dutch access is an explicit sourced author assertion and unknown access contains no residual terms', () => {
  for (const status of ['YES', 'MAYBE', 'NO']) {
    const access = {status, asOf: day, sourceIndices: [0], route: 'https://issuer.example.test/terms', conditions: 'Synthetic author claim; Dutch eligibility requires independent review.'};
    assert.equal(research.researchPublishSchema.parse(command({venture: dossier({access})})).venture.access.status, status); assert(!('verified' in access));
  }
  for (const patch of [{status: 'UNKNOWN', asOf: day}, {status: 'UNKNOWN', route: 'https://issuer.example.test/round'}, {status: 'UNKNOWN', sourceIndices: [0]}, {status: 'YES', asOf: day, sourceIndices: [], route: null, conditions: 'Unsubstantiated claim.'}, {status: 'YES', asOf: day, sourceIndices: [0], route: null, conditions: ''}, {status: 'YES', asOf: day, sourceIndices: [0], route: 'http://unsafe.example.test', conditions: 'Review needed.'}]) assert.equal(venture.ventureAccessSchema.safeParse({...dossier().access, ...patch}).success, false);
  assert.equal(venture.ventureAccessSchema.safeParse({...dossier().access, verified: true}).success, false);
});

test('score totals retain unknowns and use exact weights without turning author confidence into verification', () => {
  assert.equal(Object.values(venture.ventureScoreWeights).reduce((a, b) => a + b, 0), 100);
  const value = dossier(); assert.equal(venture.ventureScoreTotal(value.scoring.components), null);
  const maximum = {...venture.ventureScoreWeights}; assert.equal(venture.ventureScoreTotal(maximum), 100); assert.equal(venture.ventureScoreTotal({...maximum, traction: null}), null);
  const zeros = Object.fromEntries(Object.keys(maximum).map(key => [key, 0])); assert.equal(venture.ventureScoreTotal(zeros), 0);
  for (const [key, weight] of Object.entries(maximum)) for (const amount of [-1, 0.5, weight + 1, NaN]) assert.throws(() => venture.ventureScoreTotal({...zeros, [key]: amount}));
  for (const key of ['valuation', 'accessibility']) { const changed = dossier(); changed.scoring.components[key] = 1; assert.equal(venture.ventureDossierSchema.safeParse(changed).success, false); changed.scoring.components[key] = 0; assert.equal(venture.ventureDossierSchema.safeParse(changed).success, true); }
  value.terms.valuation = {...money(), amount: 2_000_000, basis: 'PRE_MONEY'}; value.access = {status: 'MAYBE', asOf: day, sourceIndices: [0], route: null, conditions: 'Author-supplied conditional route.'}; value.scoring = {components: maximum, confidence: 'HIGH'};
  assert.doesNotThrow(() => venture.validateVentureSources(value, [source], at)); value.access.status = 'NO'; assert.equal(venture.ventureDossierSchema.safeParse(value).success, false);
});

test('token and crypto-infrastructure dossiers require explicit usage, tokenomics and liquidity states', () => {
  for (const change of [value => value.issuer.kind = 'TOKEN', value => value.issuer.sector = 'CRYPTO_INFRA']) {
    const value = dossier(); change(value); assert.equal(venture.ventureDossierSchema.safeParse(value).success, false);
    value.crypto = {usage: {state: 'UNKNOWN'}, tokenomics: {state: 'UNKNOWN'}, liquidity: {state: 'UNKNOWN'}}; assert.equal(venture.ventureDossierSchema.safeParse(value).success, true);
    value.crypto.usage = fact(); assert.doesNotThrow(() => venture.validateVentureSources(value, [source], at)); delete value.crypto.liquidity; assert.equal(venture.ventureDossierSchema.safeParse(value).success, false);
  }
});

test('bounded strict dossier fields refuse extra authority, abandoned required states and oversized arrays or text', () => {
  for (const modify of [value => value.issuer.name = 'x'.repeat(121), value => value.product = fact({value: 'x'.repeat(801)}), value => value.founders = Array.from({length: 6}, () => fact()), value => value.traction = Array.from({length: 7}, () => fact()), value => value.risks = [], value => value.risks = Array(6).fill('A risk.'), value => value.risks = ['x'.repeat(501)], value => value.nextCatalyst.event = 'x'.repeat(501), value => value.issuer.ownerId = 'forged', value => value.scoring.rank = 1, value => value.verified = true]) { const value = dossier(); modify(value); assert.equal(venture.ventureDossierSchema.safeParse(value).success, false); }
  assert.equal(venture.ventureDossierSchema.safeParse({...dossier(), product: {state: 'UNKNOWN', classification: 'REPORTED_FACT'}}).success, false);
});

test('known decoded agent, local receiver and GitHub credentials cannot enter venture fields or generic v2 prose', () => {
  const credentials = ['og_agent_' + id + '.' + 'a'.repeat(64), 'og_local_owner_' + 'b'.repeat(64), 'og_local_producer_' + 'c'.repeat(64), 'ghp_' + 'D'.repeat(30), 'github_pat_' + 'E'.repeat(35)];
  for (const token of credentials) for (const value of [token, [...token].map(character => '%' + character.charCodeAt(0).toString(16)).join(''), encodeURIComponent([...token].map(character => '%' + character.charCodeAt(0).toString(16)).join(''))]) {
    assert.equal(venture.ventureDossierSchema.safeParse(dossier({risks: ['Credential ' + value]})).success, false);
    assert.equal(research.researchPublishSchema.safeParse(command({statement: 'Credential ' + value})).success, false);
    assert.equal(research.researchPublishSchema.safeParse(command({sources: [{...source, note: value}]})).success, false);
    assert.equal(venture.ventureDossierSchema.safeParse(dossier({issuer: {...dossier().issuer, website: 'https://issuer.example.test/' + value}})).success, false);
  }
});

test('aggregate public UTF-8 budgets still reject independently bounded v2 fields without truncation', () => {
  const value = dossier(), long = fact({value: '界'.repeat(800)}); value.product = long; value.customer = long; value.competition = long; value.edge = long; value.funding = long; value.dilution = long; value.founders = Array(5).fill(long); value.traction = Array(6).fill(long);
  const sent = command({venture: value}); assert.equal(research.researchPublishSchema.safeParse(sent).success, true);
  assert.throws(() => research.boundedResearchCommand(sent), error => error instanceof research.ResearchError && error.status === 413);
  assert.throws(() => research.boundedResearchRecord(record(sent)), error => error instanceof research.ResearchError && error.status === 413); assert.equal(value.product.value.length, 800);
});

test('venture discovery refuses generic visible records, forged cursors and ordering but keeps content-free tombstones', async () => {
  const visible = await item(), legacyCommand = command(); delete legacyCommand.version; delete legacyCommand.domain; delete legacyCommand.venture; const generic = await item(legacyCommand);
  const page = {version: 1, domain: 'VENTURE', items: [visible], nextCursor: null, executionEnabled: false}; assert.equal(research.researchVentureListSchema.safeParse(page).success, true);
  assert.equal(research.researchVentureListSchema.safeParse({...page, items: [tombstone(visible)]}).success, true);
  for (const altered of [{...page, items: [generic]}, {...page, items: [visible, visible]}, {...page, nextCursor: visible.id}, {...page, domain: 'OTHER'}, {...page, executionEnabled: true}]) assert.equal(research.researchVentureListSchema.safeParse(altered).success, false);
  const another = await item(command({id: 'ffff1111-2222-4333-8444-555555555555', requestId: 'bbbb1111-2222-4333-8444-555555555555'})); assert.equal(research.researchVentureListSchema.safeParse({...page, items: [visible, another]}).success, false);
  assert.equal(research.researchVentureListSchema.safeParse({...page, items: [another, visible]}).success, true);
});

test('shared challenge rules and exact thread revisions cannot switch research version or domain', async () => {
  for (const sent of [command({kind: 'CHALLENGE'}), command({relation: {type: 'CHALLENGE', id: 'ffff1111-2222-4333-8444-555555555555', digest: 'b'.repeat(64)}}), command({relation: {type: 'FORK', id, digest: 'b'.repeat(64)}})]) assert.equal(research.researchPublishSchema.safeParse(sent).success, false);
  const target = await item(), relation = {type: 'REVISION', id: target.id, digest: target.digest}, childId = 'eeee1111-2222-4333-8444-555555555555', childRequest = 'dddd1111-2222-4333-8444-555555555555';
  const revisionRecord = record(command({id: childId, requestId: childRequest, relation}), {rootId: target.rootId, revision: 2}), parsed = research.boundedResearchRecord(revisionRecord), child = {id: childId, digest: await research.researchDigest(parsed.payload), rootId: target.rootId, revision: 2, requestId: childRequest, createdAt: at, author, state: 'VISIBLE', reason: null, record: parsed.record, moderation: []};
  const thread = {version: 1, target, items: [child], nextCursor: null, executionEnabled: false}; assert.equal(research.researchThreadSchema.safeParse(thread).success, true);
  const oldContent = {...child.record.content}; delete oldContent.domain; delete oldContent.venture; const oldRecord = {...child.record, version: 1, content: oldContent}; assert.equal(research.researchRecordSchema.safeParse(oldRecord).success, true);
  const crossVersion = {...child, record: oldRecord, digest: await research.researchDigest(JSON.stringify(oldRecord))}; assert.equal(research.researchThreadSchema.safeParse({...thread, items: [crossVersion]}).success, false);
});
