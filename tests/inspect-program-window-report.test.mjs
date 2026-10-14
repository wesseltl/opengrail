import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, chmodSync, writeFileSync, readFileSync, readdirSync,
  lstatSync, existsSync, rmSync, symlinkSync, linkSync, unlinkSync, copyFileSync, cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {programWindowControllerFixture} from './program-window-controller-fixtures.mjs';
import {runProgramWindowController} from '../scripts/program-window-controller.mjs';
import {cleanupProgramSessionModules} from '../scripts/program-session-runtime.mjs';

// First-party invented raw observations, programs and virtual clocks only.
// Subprocesses always deny fetch and receive no inherited credentials/model env.
// This file never injects a verifier, changes a kernel or edits actual source.
const project = process.cwd();
const reportCli = resolve('scripts/report-program-window.mjs');
const inspectorCli = resolve('scripts/inspect-program-window-report.mjs');
const childEnv = {PATH: '/usr/bin:/bin', LANG: 'C.UTF-8'};
const sha = value => createHash('sha256').update(value).digest('hex');
const parse = path => JSON.parse(readFileSync(path, 'utf8'));
const fixtures = [];
let directory, noNetwork, successful, completedReport, savedFetch, serial = 0;
const next = name => join(directory, String(++serial) + '-' + name);
function write(path, value) {
  writeFileSync(path, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value),
    {flag: 'wx', mode: 0o600});
}
function child(cli, args, {cwd = project, preload = noNetwork} = {}) {
  const result = spawnSync(process.execPath, ['--import', preload, cli, ...args], {
    cwd, env: childEnv, encoding: 'utf8', timeout: 90000, killSignal: 'SIGKILL', maxBuffer: 65536,
  });
  assert.equal(result.error, undefined, 'The original bounded child must complete without a launch/timeout error.');
  assert.equal(result.signal, null, 'Do not accept a killed subprocess as a completed inspection.');
  return result;
}
const inspect = (path, options) => child(inspectorCli, ['inspect', path], options);
const report = (original, output, options) => child(reportCli, ['report', original, output], options);
function snapshot(path) {
  const rows = [];
  function walk(base, prefix = '') {
    for (const name of readdirSync(base).sort()) {
      const file = join(base, name), relative = prefix + name, stat = lstatSync(file);
      if (name.endsWith('.lock')) continue; // Existing verifier may open coordination locks.
      assert(!stat.isSymbolicLink(), 'Synthetic evidence snapshots must contain no symlinks.');
      if (stat.isDirectory()) walk(file, relative + '/');
      else {
        assert(stat.isFile());
        const bytes = readFileSync(file);
        rows.push({path: relative, bytes: bytes.length, sha256: sha(bytes), mode: stat.mode & 0o7777,
          nlink: stat.nlink});
      }
    }
  }
  walk(path);
  return rows;
}
function cloneReport(name) {
  const target = next(name);
  cpSync(completedReport, target, {recursive: true, preserveTimestamps: false});
  chmodSync(target, 0o700);
  return target;
}
async function original({failed = false, retainOpenExposure = false} = {}) {
  const f = await programWindowControllerFixture();
  fixtures.push(f);
  let sourceFetch = f.sourceFetch;
  if (failed) sourceFetch = async () => new Response('{"error":');
  if (retainOpenExposure) {
    // Declare a different complete synthetic raw path BEFORE the controller.
    // Consistent descending bars generate SHORT decisions; flat received quotes
    // leave the real kernel position open. No portfolio/journal is fabricated.
    sourceFetch = async url => {
      const response = await f.sourceFetch(url), value = await response.json();
      const symbol = f.input.protocol.market.symbol;
      if (new URL(url).pathname.endsWith('OHLC')) {
        for (const row of value.result[symbol]) {
          const price = 100 - (row[0] * 1000 - (f.start - 900000)) / 300000 * 0.5;
          row[1] = row[4] = String(price); row[2] = '110'; row[3] = '90';
        }
      } else for (const row of value.result[symbol]) row[0] = '99';
      return Response.json(value);
    };
  }
  const result = await runProgramWindowController({command: 'start', input: f.input, directory: f.directory,
    m: f.m, now: f.now, sleep: f.sleep, sourceFetch});
  assert.equal(result.status, failed ? 'FAILED' : 'COMPLETED', JSON.stringify(result));
  return f;
}
function assertViewMatchesOriginal(view, path) {
  const input = parse(join(path, 'original/input.json'));
  const accounting = parse(join(path, 'accounting-report.json'));
  const terminal = parse(join(path, 'report.json'));
  const admission = parse(join(path, 'admission.json'));
  const protocol = input.protocol;
  assert.equal(view.kind, 'LOCAL_SINGLE_PROGRAM_WINDOW_INSPECTION');
  assert.equal(view.status, terminal.status);
  assert.equal(view.freshCompleteVerification, true);
  assert.equal(view.partialInspection, true);
  assert.equal(view.fullOriginalsRequired, true);
  assert.equal(view.trust, 'UNTRUSTED_DATA_NOT_AUTHORITY');
  assert.equal(view.instructionAuthority, 'NONE');
  assert.deepEqual(view.assumptions.market, protocol.market);
  assert.deepEqual(view.assumptions.risk, protocol.risk);
  assert.deepEqual(view.assumptions.costs, protocol.costs);
  assert.equal(view.assumptions.initialCapital, protocol.initialCapital);
  assert.equal(view.assumptions.startsAt, protocol.startsAt);
  assert.equal(view.assumptions.endsAt, protocol.endsAt);
  assert.equal(view.assumptions.sourceMode, protocol.sourceMode);
  assert.deepEqual(view.assumptions.source, protocol.source);
  assert.equal(view.assumptions.licensedData, 'NOT_ESTABLISHED');
  assert.equal(view.assumptions.sourceAuthentication, 'UNKNOWN');
  for (const key of ['kind', 'verification', 'marketDataUseApproved', 'rawRetentionApproved',
    'sharedIpRateBudgetApproved', 'publicSharing']) assert.equal(view.assumptions.rights[key], protocol.rights[key]);
  assert.equal(view.assumptions.rights.noteIn, 'original/input.json');
  assert.equal(Object.hasOwn(view.assumptions.rights, 'note'), false);
  assert.equal(JSON.stringify(view).includes(protocol.rights.note), false);
  for (const key of ['venueFeeVerified', 'executableSpreadVerified', 'shortFinancingVerified'])
    assert.equal(view.assumptions[key], false);
  for (const key of ['performanceInterpretation', 'availability', 'completePerformance', 'computationStatus',
    'observationStatus', 'boundaryStatus', 'reasons', 'portfolio', 'baselines', 'diagnostics'])
    assert.deepEqual(view.result[key], accounting[key], 'Display must equal the actual freshly verified ' + key);
  assert.equal(Object.hasOwn(view.result, 'marks'), false);
  assert.equal(view.searchHistory.ledgerDigest, input.plan.handoff.ledger.ledgerDigest);
  assert.equal(view.searchHistory.attemptCount, input.plan.handoff.ledger.attempts.length);
  assert.equal(view.searchHistory.testAttemptCount, 1);
  assert.equal(view.searchHistory.backtestReplayed, false);
  assert.equal(view.verification.attemptId, admission.attemptId);
  assert.equal(view.verification.reportDigest, accounting.reportDigest);
  assert.equal(view.verification.terminalDigest, terminal.terminalDigest);
  assert.equal(view.verification.admissionDigest, admission.admissionDigest);
  assert.equal(view.verification.inputDigest, input.inputDigest);
  assert.equal(view.verification.protocolDigest, protocol.protocolDigest);
  assert.equal(view.verification.archiveDigest, accounting.archiveDigest);
  assert.equal(view.verification.originalArtifactDigest, accounting.originalArtifactDigest);
  assert.equal(view.verification.originalJournalDigest, accounting.originalJournalDigest);
  assert.equal(view.verification.historicalReportSourceGraphDigest, sha(readFileSync(join(path, 'report-source-graph.json'))));
  assert.equal(view.classification, 'AUTHOR_REPORTED');
  assert.equal(view.qualification, 'NONE');
  assert.equal(view.independence, 'NOT_ESTABLISHED');
  assert.equal(view.financialExecutionAuthority, 'NONE');
  for (const key of ['providerStarted', 'controllerStarted', 'publicReferencesAuthenticated', 'registered',
    'ordersEnabled', 'liveEnabled', 'independentQualification']) assert.equal(view[key], false);
  assert(Buffer.byteLength(JSON.stringify(view)) <= 32768);
  return {input, accounting, terminal, admission};
}

before(async () => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('NO_PROVIDER_PERMISSION_IN_SYNTHETIC_INSPECTION_TEST'); };
  directory = mkdtempSync(join(tmpdir(), 'opengrail-inspection-'));
  chmodSync(directory, 0o700);
  noNetwork = next('deny-fetch.mjs');
  write(noNetwork, "globalThis.fetch = async () => { throw Error('NO_PROVIDER_PERMISSION_IN_SYNTHETIC_INSPECTION_CHILD'); };\n");
  successful = await original();
  completedReport = next('complete-report');
  const created = report(successful.directory, completedReport);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).terminalConfirmed, true);
}, {timeout: 180000});
after(() => {
  globalThis.fetch = savedFetch;
  cleanupProgramSessionModules();
  for (const f of fixtures) f.cleanup();
  if (directory) rmSync(directory, {recursive: true, force: true});
});

test('actual controller -> report -> fresh inspector exposes unchanged costs/provenance and retains negative evidence', {timeout: 180000}, () => {
  const beforeOriginal = snapshot(successful.directory), beforeReport = snapshot(completedReport);
  const result = inspect(completedReport);
  assert.equal(result.status, 0, result.stderr);
  const view = JSON.parse(result.stdout), {input, accounting} = assertViewMatchesOriginal(view, completedReport);
  assert.equal(view.assumptions.sourceMode, 'SYNTHETIC_RESPONSES');
  assert(input.plan.handoff.ledger.attempts.find(row => row.phase === 'TEST').outcome.artifact.metrics.netPnl < 0,
    'The actually evaluated sole losing TEST must remain in the complete original.');
  assert(accounting.portfolio.closedTradeCount > 0);
  assert(accounting.portfolio.realizedPnl < 0, 'The real synthetic kernel protective loss is not a favorable summary.');
  assert(accounting.portfolio.paidFees > 0);
  for (const row of view.verification.inspectorPhysicalSources) {
    const bytes = readFileSync(resolve(project, row.path));
    assert.equal(row.sha256, sha(bytes)); assert.equal(row.bytes, bytes.length);
  }
  assert(view.verification.inspectorPhysicalSources.some(row => row.path === 'scripts/inspect-program-window-report.mjs'));
  assert.deepEqual(snapshot(successful.directory), beforeOriginal);
  assert.deepEqual(snapshot(completedReport), beforeReport);
});

test('actual failed raw collection remains HELD exit2 with complete adverse reasons and unavailable null results', {timeout: 240000}, async () => {
  const f = await original({failed: true}), output = next('held-report');
  const beforeOriginal = snapshot(f.directory), created = report(f.directory, output);
  assert.equal(created.status, 2, created.stderr);
  const beforeReport = snapshot(output), inspected = inspect(output);
  assert.equal(inspected.status, 2, inspected.stderr);
  const view = JSON.parse(inspected.stdout), {accounting} = assertViewMatchesOriginal(view, output);
  assert.equal(view.status, 'HELD'); assert.equal(view.result.completePerformance, false);
  assert(accounting.reasons.length > 0); assert.deepEqual(view.result.reasons, accounting.reasons);
  assert.equal(view.result.baselines.passiveLong.status, 'UNAVAILABLE');
  assert.equal(view.result.baselines.passiveLong.terminalReturnPct, null);
  assert.equal(view.result.diagnostics.excessReturnVsPassiveLongPct, null);
  assert.deepEqual(snapshot(f.directory), beforeOriginal);
  assert.deepEqual(snapshot(output), beforeReport);
});

test('actual stable synthetic quotes retain open exposure and valuation-only exit costs without forced liquidation', {timeout: 240000}, async () => {
  const f = await original({retainOpenExposure: true}), output = next('open-exposure-report');
  const created = report(f.directory, output); assert.equal(created.status, 0, created.stderr);
  const before = snapshot(output), inspected = inspect(output); assert.equal(inspected.status, 0, inspected.stderr);
  const view = JSON.parse(inspected.stdout), {accounting} = assertViewMatchesOriginal(view, output);
  assert(accounting.portfolio.openPositionIds.length > 0, 'An actual kernel open position is required for this control.');
  assert.deepEqual(view.result.portfolio.openPositionIds, accounting.portfolio.openPositionIds);
  assert.equal(view.result.portfolio.forcedClose, false);
  assert.equal(view.result.portfolio.estimatedExitFeesPaid, false);
  assert(view.result.portfolio.estimatedExitFees > 0);
  assert.deepEqual(snapshot(output), before);
});

test('a coherently rehashed favorable derived report still fails fresh verification and emits no view or repairs', {timeout: 180000}, () => {
  const target = cloneReport('self-rehashed-favorable'), accountingPath = join(target, 'accounting-report.json');
  const accounting = parse(accountingPath), terminal = parse(join(target, 'report.json'));
  assert(accounting.portfolio && accounting.portfolio.terminalReturnPct !== null);
  accounting.portfolio.actualCash += 500;
  accounting.portfolio.realizedPnl += 500;
  accounting.portfolio.terminalReturnPct += 50;
  const {reportDigest: discarded, ...reportBody} = accounting; void discarded;
  accounting.reportDigest = sha(JSON.stringify(reportBody));
  const bytes = Buffer.from(JSON.stringify(accounting));
  writeFileSync(accountingPath, bytes, {mode: 0o600});
  const descriptor = terminal.components.find(row => row.name === 'accounting-report.json');
  descriptor.bytes = bytes.length; descriptor.digest = sha(bytes); terminal.reportDigest = accounting.reportDigest;
  const {terminalDigest: ignored, ...terminalBody} = terminal; void ignored;
  terminal.terminalDigest = sha(JSON.stringify(terminalBody));
  writeFileSync(join(target, 'report.json'), JSON.stringify(terminal), {mode: 0o600});
  const before = snapshot(target), result = inspect(target);
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.deepEqual(snapshot(target), before, 'Untrusted favorable evidence must not be repaired or overwritten.');
  assert.equal(existsSync(join(target, 'failure.json')), false);
});

test('unsafe private paths, unsupported commands and hardlinked actual evidence refuse without a view', {timeout: 240000}, () => {
  const linked = next('symlink-report'); symlinkSync(completedReport, linked);
  const publicDirectory = cloneReport('public-report'); chmodSync(publicDirectory, 0o755);
  const sourceBefore = snapshot(completedReport);
  for (const args of [['inspect', linked], ['inspect', publicDirectory], ['inspect', completedReport + '\x7f'],
    ['inspect', resolve('scripts')], ['verify', completedReport], ['inspect', completedReport, 'unapproved-extra']]) {
    const result = child(inspectorCli, args); assert.equal(result.status, 1); assert.equal(result.stdout, '');
  }
  const target = cloneReport('hardlink-report'), alias = next('accounting-hardlink.bin');
  linkSync(join(target, 'accounting-report.json'), alias);
  try {
    const before = snapshot(target), result = inspect(target);
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.deepEqual(snapshot(target), before); assert.equal(lstatSync(alias).nlink, 2);
  } finally { unlinkSync(alias); }
  assert.deepEqual(snapshot(completedReport), sourceBefore);
});

test('BOM, duplicate-key, invalid UTF8 and credential-bearing original input are refused without echo or repair', {timeout: 300000}, () => {
  const input = readFileSync(join(completedReport, 'original/input.json'));
  const credential = 'og_local_owner_synthetic_credential_must_never_be_printed';
  const withCredential = JSON.parse(input); withCredential.protocol.rights.note = credential;
  const mutations = [
    ['bom', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), input])],
    ['duplicate-key', Buffer.from('{"version":1,' + input.toString('utf8').slice(1))],
    ['invalid-utf8', Buffer.concat([input, Buffer.from([0xff])])],
    ['credential', Buffer.from(JSON.stringify(withCredential))],
  ];
  for (const [name, bytes] of mutations) {
    const target = cloneReport(name); writeFileSync(join(target, 'original/input.json'), bytes, {mode: 0o600});
    const before = snapshot(target), result = inspect(target);
    assert.equal(result.status, 1, name); assert.equal(result.stdout, '', name);
    assert.equal(result.stderr.includes(credential), false);
    assert.deepEqual(snapshot(target), before, name);
  }
});

test('new inspector source mutation is rejected in a positively checked isolated capsule without changing actual source', {timeout: 300000}, () => {
  const isolated = next('isolated-trusted-source'); mkdirSync(isolated, {mode: 0o700});
  mkdirSync(join(isolated, 'app')); mkdirSync(join(isolated, 'node_modules'));
  for (const name of readdirSync(resolve('app'))) if (name.endsWith('.ts'))
    copyFileSync(resolve('app', name), join(isolated, 'app', name));
  cpSync(resolve('scripts'), join(isolated, 'scripts'), {recursive: true});
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) copyFileSync(resolve(name), join(isolated, name));
  cpSync(resolve('node_modules/zod'), join(isolated, 'node_modules/zod'), {recursive: true});
  symlinkSync(resolve('node_modules/esbuild'), join(isolated, 'node_modules/esbuild'));
  const capsuleInspector = join(isolated, 'scripts/inspect-program-window-report.mjs');
  const capsuleReport = join(isolated, 'scripts/report-program-window.mjs');
  const output = next('capsule-positive-report');
  const created = child(capsuleReport, ['report', successful.directory, output], {cwd: isolated});
  assert.equal(created.status, 0, created.stderr);
  const positive = child(capsuleInspector, ['inspect', output], {cwd: isolated});
  assert.equal(positive.status, 0, positive.stderr); assert.equal(JSON.parse(positive.stdout).freshCompleteVerification, true);
  const actualDigest = sha(readFileSync(inspectorCli)), capsuleDigest = sha(readFileSync(capsuleInspector));
  const beforeEvidence = snapshot(output), fault = next('mutate-isolated-inspector.mjs');
  write(fault, "import {appendFileSync} from 'node:fs';\nconst iso = Date.prototype.toISOString; let changed = false;\n" +
    "Date.prototype.toISOString = function() { const value = iso.call(this); if (!changed) { changed = true; appendFileSync(" +
    JSON.stringify(capsuleInspector) + ", '\\n// isolated first-party inspector mutation\\n'); } return value; };\n" +
    "globalThis.fetch = async () => { throw Error('NO_NETWORK_IN_SOURCE_MUTATION_TEST'); };\n");
  const failed = child(capsuleInspector, ['inspect', output], {cwd: isolated, preload: fault});
  assert.equal(failed.status, 1, failed.stderr); assert.equal(failed.stdout, '');
  assert.notEqual(sha(readFileSync(capsuleInspector)), capsuleDigest, 'The source mutation must actually occur.');
  assert.equal(sha(readFileSync(inspectorCli)), actualDigest, 'Actual candidate/Main source cannot be the fault target.');
  assert.deepEqual(snapshot(output), beforeEvidence);
});
