import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runContributionChecks, contributionScriptPins, contributionCheckLimits } from '../scripts/check-contribution.mjs';
import { localContributionReportSchema } from '../scripts/contribution-public-handoff-core.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function fixture(t, options = {}) {
  const outer = await mkdtemp(resolve(tmpdir(), 'opengrail-check-fixture-')), root = resolve(outer, 'repo');
  t.after(() => rm(outer, { recursive: true, force: true }));
  for (const dir of ['', 'scripts', 'tests', 'node_modules/.bin', '.github/workflows']) await mkdir(resolve(root, dir), { recursive: true });
  await copyFile(resolve(project, 'scripts/check-contribution.mjs'), resolve(root, 'scripts/check-contribution.mjs'));
  await copyFile(resolve(project, '.github/workflows/contribution.yml'), resolve(root, '.github/workflows/contribution.yml'));
  await writeFile(resolve(root, 'package.json'), JSON.stringify({ name: 'invented-isolated-contribution-fixture', private: true, type: 'module', scripts: { ...contributionScriptPins, ...options.scripts } }));
  await writeFile(resolve(root, '.gitignore'), 'node_modules/\ndist/\n');
  await writeFile(resolve(root, 'tests/fixture.test.mjs'), options.test ?? "import test from 'node:test';import assert from 'node:assert/strict';test('invented tiny fixture',()=>assert.equal(1+1,2));\n");
  await writeFile(resolve(root, 'scripts/run-framework.mjs'), options.build ?? "import {mkdir,writeFile} from 'node:fs/promises';await mkdir('dist',{recursive:true});await writeFile('dist/synthetic-result','tiny fixture only');console.log('fixture build pass');\n");
  await writeFile(resolve(root, 'node_modules/.bin/tsc'), '#!/usr/bin/env node\n' + (options.typecheck ?? "console.log('fixture typecheck pass');\n"), { mode: 0o755 });
  await writeFile(resolve(root, 'change.txt'), 'base\n');
  git(root, 'init', '-b', 'main'); git(root, 'config', 'user.email', 'invented-fixture@example.invalid'); git(root, 'config', 'user.name', 'Invented local fixture');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'invented initial fixture'); git(root, 'checkout', '-b', 'feature');
  await writeFile(resolve(root, 'change.txt'), options.whitespace ? 'feature trailing whitespace   \n' : 'feature\n'); git(root, 'add', 'change.txt'); git(root, 'commit', '-m', 'invented proposed change'); const headSha = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', 'main'); await writeFile(resolve(root, 'base-only.txt'), 'independent base advance\n'); git(root, 'add', 'base-only.txt'); git(root, 'commit', '-m', 'invented base advance'); const baseSha = git(root, 'rev-parse', 'HEAD');
  git(root, 'merge', '--no-ff', 'feature', '-m', 'invented tested merge'); const testedSha = git(root, 'rev-parse', 'HEAD');
  return { root, baseSha, headSha, testedSha, reportPath: resolve(outer, 'report.json') };
}
async function checked(options) {
  const report = await runContributionChecks(options);
  const bytes = await readFile(options.reportPath), stored = JSON.parse(bytes);
  assert.deepEqual(stored, report);
  const { reportDigest, ...body } = stored; assert.equal(reportDigest, digest(JSON.stringify(body)));
  assert.equal((await stat(options.reportPath)).mode & 0o777, 0o600);
  assert.ok(bytes.length <= contributionCheckLimits.reportBytes);
  localContributionReportSchema.parse(stored);
  assert.equal(stored.kind, 'LOCAL_CHECK_REPORT'); assert.equal(stored.classification, 'AUTHOR_REPORTED'); assert.equal(stored.qualification, 'NONE');
  assert.equal(JSON.stringify(stored).includes('"VERIFIED"'), false);
  return stored;
}

test('actual isolated merge runs all four fixed commands and binds the exact checkout, tree and source bytes', async t => {
  const options = await fixture(t), report = await checked(options);
  assert.equal(report.status, 'PASSED'); assert.deepEqual(report.checks.map(v => v.status), ['PASSED', 'PASSED', 'PASSED', 'PASSED']);
  assert.deepEqual(report.source.parents, [options.baseSha, options.headSha]); assert.equal(report.source.commitSha, options.testedSha); assert.equal(report.source.treeSha, git(options.root, 'rev-parse', 'HEAD^{tree}'));
  assert.deepEqual(report.source, report.afterSource); assert.equal(report.source.files.packageJson, digest(await readFile(resolve(options.root, 'package.json'))));
  assert.deepEqual(report.checks.at(-1).command.slice(-4), ['diff', '--check', options.baseSha, options.testedSha]);
});
test('actual failing npm test is retained and typecheck, build and range check still run', async t => {
  const report = await checked(await fixture(t, { test: "import test from 'node:test';test('invented negative',()=>{throw Error('retained fixture failure')});" }));
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[0].status, 'FAILED'); assert.notEqual(report.checks[0].exitCode, 0); assert.match(report.checks[0].stdout.text, /retained fixture failure/);
  assert.deepEqual(report.checks.slice(1).map(v => v.status), ['PASSED', 'PASSED', 'PASSED']);
});
test('synthetic middle TAP failure and final summary survive beyond the prefix with exact raw evidence', async t => {
  const padding = 'synthetic passing noise '.repeat(8);
  const raw = 'TAP version 13\n' + Array.from({ length: 300 }, (_, n) => `ok ${n + 1} - ${padding}\n`).join('') +
    "not ok 301 - middle fixture rejection\n  ---\n  error: 'retained middle failure diagnostic'\n  code: 'ERR_ASSERTION'\n  ...\n" +
    Array.from({ length: 300 }, (_, n) => `ok ${n + 302} - ${padding}\n`).join('') +
    '1..601\n# tests 601\n# pass 600\n# fail 1\n# duration_ms 123\n';
  const report = await checked(await fixture(t, { build: `process.stderr.write(${JSON.stringify(raw)});process.exitCode=1;` }));
  const output = report.checks[2].stderr;
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[2].status, 'FAILED');
  assert.equal(output.bytes, Buffer.byteLength(raw)); assert.equal(output.sha256, digest(raw));
  assert.ok(output.bytes > contributionCheckLimits.retainedBytesPerStream * 2); assert.equal(output.truncated, true);
  assert.match(output.text, /not ok 301 - middle fixture rejection/); assert.match(output.text, /retained middle failure diagnostic/);
  assert.match(output.text, /\[\.\.\. output omitted \.\.\.\]/); assert.match(output.text, /# fail 1/); assert.match(output.text, /# duration_ms/);
  assert.ok(Buffer.byteLength(JSON.stringify(output.text)) <= contributionCheckLimits.retainedBytesPerStream);
  assert.deepEqual(report.checks.map(v => v.status), ['PASSED', 'PASSED', 'FAILED', 'PASSED']);
});
test('passing output keeps its tail, exact raw hash and split UTF-8 and percent-encoded redaction before clipping', async t => {
  const secret = 'og_local_producer_' + 'd'.repeat(64), encoded = encodeURIComponent(secret).replace('og', '%6f%67');
  const raw = 'synthetic prefix\n' + ('quoted \\" noise\n'.repeat(1800)) + ('og_local_owner_' + 'b'.repeat(64) + '\n').repeat(100) + 'tail 🚀 ' + encoded + '\nsynthetic final summary\n';
  const split = Buffer.from(raw).indexOf(Buffer.from('🚀')) + 2;
  const percentSplit = Buffer.from(raw).indexOf(Buffer.from('%6f')) + 2;
  const build = `const raw=Buffer.from(${JSON.stringify(raw)});for(const [start,end] of [[0,${split}],[${split},${percentSplit}],[${percentSplit},raw.length]]){process.stderr.write(raw.subarray(start,end));await new Promise(r=>setTimeout(r,15));}`;
  const report = await checked(await fixture(t, { build })), output = report.checks[2].stderr;
  assert.equal(report.status, 'PASSED'); assert.equal(output.bytes, Buffer.byteLength(raw)); assert.equal(output.sha256, digest(raw)); assert.equal(output.truncated, true);
  assert.match(output.text, /synthetic prefix/); assert.match(output.text, /tail 🚀 \[REDACTED_CREDENTIAL\]/); assert.match(output.text, /synthetic final summary/);
  assert.equal(output.text.includes('�'), false); assert.equal(output.text.includes('d'.repeat(24)), false); assert.equal(output.text.includes('b'.repeat(24)), false); assert.equal(output.text.includes('%6f'), false);
  assert.ok(Buffer.byteLength(JSON.stringify(output.text)) <= contributionCheckLimits.retainedBytesPerStream);
});
test('malformed-percent noise cannot disable encoded credential redaction in prefix or tail excerpts', async t => {
  const prefix = '%6f%67_local_owner_' + 'p'.repeat(64);
  const tail = encodeURIComponent(encodeURIComponent('%67ithub_pat_' + 'q'.repeat(64)));
  const raw = 'prefix ' + prefix + '\n' + 'synthetic padding\n'.repeat(1500) + 'progress 50% and malformed %zz\ntail %ff' + tail + '\nfinal diagnostic summary\n';
  const report = await checked(await fixture(t, { build: `process.stderr.write(${JSON.stringify(raw)});` })), output = report.checks[2].stderr;
  assert.equal(report.status, 'PASSED'); assert.equal(output.bytes, Buffer.byteLength(raw)); assert.equal(output.sha256, digest(raw)); assert.equal(output.truncated, true);
  assert.match(output.text, /prefix \[REDACTED_CREDENTIAL\]/); assert.match(output.text, /tail ÿ\[REDACTED_CREDENTIAL\]/);
  assert.match(output.text, /progress 50% and malformed %zz/); assert.match(output.text, /final diagnostic summary/);
  for (const fragment of [prefix, tail, 'p'.repeat(24), 'q'.repeat(24)]) assert.equal(output.text.includes(fragment), false);
  assert.ok(Buffer.byteLength(JSON.stringify(output.text)) <= contributionCheckLimits.retainedBytesPerStream);
});
test('nonzero typecheck and build statuses survive a durable terminal failure receipt', async t => {
  const report = await checked(await fixture(t, { typecheck: "console.error('type fixture failure');process.exitCode=2;", build: "console.error('build fixture failure');process.exitCode=3;" }));
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[1].exitCode, 2); assert.equal(report.checks[2].exitCode, 3); assert.equal(report.checks[3].status, 'PASSED');
});
test('diffcheck tests the committed base-to-merge change, even though the worktree itself is clean', async t => {
  const options = await fixture(t, { whitespace: true }); assert.equal(git(options.root, 'status', '--porcelain'), '');
  const report = await checked(options); assert.equal(report.checks[3].status, 'FAILED'); assert.match(report.checks[3].stdout.text, /trailing whitespace/); assert.equal(report.status, 'FAILED');
});
test('a wrong tested commit or wrong merge parent cannot execute any check', async t => {
  const options = await fixture(t); const report = await checked({ ...options, testedSha: options.headSha });
  assert.ok(report.failureReasons.includes('CHECKOUT_IDENTITY_MISMATCH')); assert.ok(report.checks.every(v => v.status === 'NOT_RUN'));
  const second = await checked({ ...options, reportPath: resolve(dirname(options.reportPath), 'wrong-parent.json'), baseSha: options.headSha });
  assert.ok(second.failureReasons.includes('CHECKOUT_IDENTITY_MISMATCH')); assert.ok(second.checks.every(v => v.status === 'NOT_RUN'));
});
test('dirty tracked or untracked source is rejected before contributed npm scripts run', async t => {
  const options = await fixture(t); await writeFile(resolve(options.root, 'unreviewed.txt'), 'unknown source');
  const report = await checked(options); assert.ok(report.failureReasons.includes('DIRTY_CHECKOUT')); assert.ok(report.checks.every(v => v.status === 'NOT_RUN'));
});
test('the exact required script map rejects replacement commands and pre/post lifecycle hooks', async t => {
  const one = await checked(await fixture(t, { scripts: { test: 'echo fabricated-pass' } })); assert.ok(one.failureReasons.includes('SCRIPT_PIN_MISMATCH')); assert.ok(one.checks.every(v => v.status === 'NOT_RUN'));
  const two = await checked(await fixture(t, { scripts: { pretest: 'echo unauthorized-lifecycle' } })); assert.ok(two.failureReasons.includes('SCRIPT_PIN_MISMATCH')); assert.ok(two.checks.every(v => v.status === 'NOT_RUN'));
});
test('duplicate package fields are rejected rather than silently replacing the npm command pins', async t => {
  const options = await fixture(t); const file = resolve(options.root, 'package.json'), original = await readFile(file, 'utf8');
  await writeFile(file, original.replace('"scripts":', '"scripts":{},"scripts":')); git(options.root, 'add', 'package.json'); git(options.root, 'commit', '--amend', '--no-edit'); options.testedSha = git(options.root, 'rev-parse', 'HEAD');
  const report = await checked(options); assert.ok(report.failureReasons.includes('DUPLICATE_JSON_KEY')); assert.ok(report.checks.every(v => v.status === 'NOT_RUN'));
});
test('source changed by a contributed test stops remaining work and cannot become PASSED', async t => {
  const report = await checked(await fixture(t, { test: "import {writeFileSync} from 'node:fs';writeFileSync('change.txt','source mutated by fixture');" }));
  assert.equal(report.checks[0].status, 'PASSED'); assert.ok(report.failureReasons.includes('SOURCE_CHANGED')); assert.ok(report.checks.slice(1).every(v => v.status === 'NOT_RUN')); assert.equal(report.status, 'FAILED');
});
test('a hanging command is terminated at a lowered fixture timeout and the timeout is retained', async t => {
  const options = await fixture(t, { test: 'setInterval(()=>{},1000);' }); const started = Date.now();
  const report = await checked({ ...options, commandTimeoutMs: 700 }); assert.equal(report.checks[0].status, 'TIMED_OUT'); assert.equal(report.status, 'FAILED'); assert.ok(Date.now() - started < 10000);
});
test('termination drops an incomplete credential and UTF-8 boundary line but preserves observed raw bytes and digest', async t => {
  const raw = Buffer.concat([Buffer.from('complete diagnostic before termination\nog_local_owner_' + 'x'.repeat(24)), Buffer.from('🚀').subarray(0, 2)]);
  const typecheck = `process.stderr.write(Buffer.from(${JSON.stringify(raw.toString('base64'))},'base64'));setInterval(()=>{},1000);`;
  const report = await checked({ ...await fixture(t, { typecheck }), commandTimeoutMs: 700 }), output = report.checks[1].stderr;
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[1].status, 'TIMED_OUT');
  assert.equal(output.bytes, raw.length); assert.equal(output.sha256, digest(raw)); assert.equal(output.truncated, true);
  assert.match(output.text, /complete diagnostic before termination/); assert.match(output.text, /\[\.\.\. output omitted \.\.\.\]/);
  assert.equal(output.text.includes('og_local_owner_'), false); assert.equal(output.text.includes('x'.repeat(24)), false); assert.equal(output.text.includes('�'), false);
});
test('abort retains an INTERRUPTED disposition and leaves the remaining fixed checks unrun', async t => {
  const options = await fixture(t, { test: 'setInterval(()=>{},1000);' }), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000); t.after(() => clearTimeout(timer));
  const report = await checked({ ...options, signal: controller.signal }); assert.equal(report.status, 'INTERRUPTED'); assert.ok(report.checks.slice(1).every(v => v.status === 'NOT_RUN'));
});
test('actual excess output is bounded, hashed and retained as a failed check without oversized reports', async t => {
  const options = await fixture(t, { test: "process.stdout.write('\\\\'.repeat(2300000));" });
  const report = await checked(options); assert.equal(report.checks[0].status, 'OUTPUT_LIMIT'); assert.equal(report.status, 'FAILED'); assert.equal(report.checks[0].stdout.truncated, true);
  for (const check of report.checks) for (const key of ['stdout', 'stderr']) assert.ok(Buffer.byteLength(JSON.stringify(check[key].text)) <= contributionCheckLimits.retainedBytesPerStream);
});
test('child commands do not inherit provider/private environment or raw credential diagnostics', async t => {
  const original = process.env.OPEN_GRAIL_PRIVATE_FIXTURE; process.env.OPEN_GRAIL_PRIVATE_FIXTURE = 'synthetic-not-a-real-secret'; t.after(() => { if (original === undefined) delete process.env.OPEN_GRAIL_PRIVATE_FIXTURE; else process.env.OPEN_GRAIL_PRIVATE_FIXTURE = original; });
  const options = await fixture(t, { test: "import assert from 'node:assert/strict';assert.equal(process.env.OPEN_GRAIL_PRIVATE_FIXTURE,undefined);assert.equal(process.env.GITHUB_TOKEN,undefined);console.log('og_local_owner_'+ 'a'.repeat(64));console.log('ghp_'+ 'b'.repeat(36));console.log('github_pat_'+ 'c'.repeat(60));console.log(encodeURIComponent('og_local_producer_'+ 'd'.repeat(64)).replace('og','%6f%67'));" });
  const report = await checked(options); assert.equal(report.status, 'PASSED'); assert.match(report.checks[0].stdout.text, /REDACTED_CREDENTIAL/); for (const prefix of ['og_local_owner_', 'og_local_producer_', 'ghp_', 'github_pat_']) assert.equal(JSON.stringify(report).includes(prefix), false);
});
test('new report path refuses existing evidence, a symlink or a checkout-local destination', async t => {
  const options = await fixture(t); await writeFile(options.reportPath, 'retained prior evidence');
  await assert.rejects(runContributionChecks(options)); assert.equal(await readFile(options.reportPath, 'utf8'), 'retained prior evidence');
  const link = resolve(dirname(options.reportPath), 'link.json'); await symlink(options.reportPath, link); await assert.rejects(runContributionChecks({ ...options, reportPath: link }));
  await assert.rejects(runContributionChecks({ ...options, reportPath: resolve(options.root, 'report.json') }), /REPORT_MUST_BE_OUTSIDE_CHECKOUT/);
});
test('strict API rejects accessor, extra option, malformed identity and unsupported timeout without executing', async t => {
  const options = await fixture(t); let read = false; const accessor = { ...options }; Object.defineProperty(accessor, 'baseSha', { get() { read = true; return options.baseSha; }, enumerable: true });
  await assert.rejects(runContributionChecks(accessor), /INVALID_OPTIONS/); assert.equal(read, false);
  await assert.rejects(runContributionChecks({ ...options, command: 'echo untrusted' }), /INVALID_OPTIONS/);
  await assert.rejects(runContributionChecks({ ...options, testedSha: 'HEAD' }), /INVALID_IDENTITY/);
  await assert.rejects(runContributionChecks({ ...options, commandTimeoutMs: contributionCheckLimits.commandTimeoutMs + 1 }), /INVALID_OPTIONS/);
});
test('actual CLI returns nonzero while printing and retaining its exact bounded failure report', async t => {
  const raw = 'invented CLI prefix\n' + 'invented omitted output\n'.repeat(1800) + 'invented CLI failure summary\n';
  const options = await fixture(t, { build: `process.stderr.write(${JSON.stringify(raw)});process.exitCode=3;` });
  const result = await new Promise((resolveResult, reject) => { const child = spawn(process.execPath, ['scripts/check-contribution.mjs', options.baseSha, options.headSha, options.testedSha, options.reportPath], { cwd: options.root, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = ''; child.stdout.on('data', v => { stdout += v; }); child.stderr.on('data', v => { stderr += v; }); child.on('error', reject); child.on('close', code => resolveResult({ code, stdout, stderr })); });
  assert.equal(result.code, 1); assert.equal(result.stderr, ''); const report = JSON.parse(result.stdout); assert.equal(report.status, 'FAILED'); assert.equal(report.checks[2].exitCode, 3); assert.deepEqual(report, JSON.parse(await readFile(options.reportPath, 'utf8')));
  localContributionReportSchema.parse(report);
  const output = report.checks[2].stderr;
  assert.equal(output.bytes, Buffer.byteLength(raw)); assert.equal(output.sha256, digest(raw)); assert.equal(output.truncated, true);
  assert.match(output.text, /invented CLI failure summary/); assert.match(output.text, /\[\.\.\. output omitted \.\.\.\]/);
});
test('a named FIFO source cannot block the checker before its regular-file guard', async t => {
  const options = await fixture(t); const file = resolve(options.root, '.github/workflows/contribution.yml'); await rm(file); execFileSync('mkfifo', [file]);
  const before = Date.now(), report = await checked(options); assert.ok(Date.now() - before < 3000); assert.ok(report.failureReasons.includes('INPUT_LIMIT')); assert.ok(report.checks.every(v => v.status === 'NOT_RUN'));
});
test('a symlinked source parent cannot export an outside file into a receipt', async t => {
  const options = await fixture(t), outside = resolve(dirname(options.reportPath), 'outside'); await mkdir(resolve(outside, 'workflows'), { recursive: true });
  await writeFile(resolve(outside, 'workflows/contribution.yml'), 'synthetic outside material never read'); await rm(resolve(options.root, '.github'), { recursive: true }); await symlink(outside, resolve(options.root, '.github'));
  const report = await checked(options); assert.ok(report.failureReasons.includes('UNSAFE_SOURCE_PATH')); assert.ok(report.checks.every(v => v.status === 'NOT_RUN')); assert.equal(JSON.stringify(report).includes('synthetic outside material never read'), false);
});
test('an oversized source file is rejected without loading an unbounded document', async t => {
  const options = await fixture(t); await writeFile(resolve(options.root, '.github/workflows/contribution.yml'), 'x'.repeat(contributionCheckLimits.sourceBytes + 1));
  const report = await checked(options); assert.ok(report.failureReasons.includes('INPUT_LIMIT')); assert.ok(report.checks.every(v => v.status === 'NOT_RUN'));
});


test('the shared runtime budget terminates an actual hanging test before its longer command allowance and retains unrun checks', async t => {
  const options = await fixture(t, { test: 'setInterval(()=>{},1000);' }); const started = performance.now();
  const report = await checked({ ...options, commandTimeoutMs: 10000, runTimeoutMs: 2000 });
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[0].status, 'TIMED_OUT');
  assert.ok(report.failureReasons.includes('CHECK_RUN_TIMED_OUT'));
  assert.ok(report.source); assert.equal(report.afterSource, null);
  assert.ok(report.checks.slice(1).every(item => item.status === 'NOT_RUN'));
  assert.ok(performance.now() - started < 15000);
});
test('one runtime budget covers earlier failed checks and a later hanging build without hiding adverse evidence', async t => {
  const options = await fixture(t, { test: "import test from 'node:test';test('retained earlier rejection',()=>{throw Error('failure before shared deadline');});", build: 'setInterval(()=>{},1000);' });
  const report = await checked({ ...options, commandTimeoutMs: 10000, runTimeoutMs: 2500 });
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[0].status, 'FAILED');
  assert.match(report.checks[0].stdout.text, /failure before shared deadline/);
  assert.equal(report.checks[1].status, 'PASSED'); assert.equal(report.checks[2].status, 'TIMED_OUT');
  assert.equal(report.checks[3].status, 'NOT_RUN'); assert.ok(report.failureReasons.includes('CHECK_RUN_TIMED_OUT'));
  assert.equal(report.afterSource, null);
});
test('a shorter explicit command timeout remains a command failure while the remaining checks fit the shared budget', async t => {
  const options = await fixture(t, { test: 'setInterval(()=>{},1000);' });
  const report = await checked({ ...options, commandTimeoutMs: 1000, runTimeoutMs: 10000 });
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[0].status, 'TIMED_OUT');
  assert.equal(report.failureReasons.includes('CHECK_RUN_TIMED_OUT'), false);
  assert.deepEqual(report.checks.slice(1).map(item => item.status), ['PASSED', 'PASSED', 'PASSED']);
  assert.deepEqual(report.source, report.afterSource);
});
test('runtime-budget overrides reject increases, noninteger values and accessors before reserving a report or running checks', async t => {
  const options = await fixture(t);
  for (const runTimeoutMs of [49, contributionCheckLimits.runTimeoutMs + 1, 50.5, NaN, '2000']) {
    await assert.rejects(runContributionChecks({ ...options, runTimeoutMs }), /INVALID_OPTIONS/);
  }
  let read = false; const accessor = { ...options };
  Object.defineProperty(accessor, 'runTimeoutMs', { get() { read = true; return 2000; }, enumerable: true });
  await assert.rejects(runContributionChecks(accessor), /INVALID_OPTIONS/); assert.equal(read, false);
  await assert.rejects(stat(options.reportPath), error => error.code === 'ENOENT');
});


test('a nonenumerable lower command timeout survives normalization and does not become the shared runtime deadline', async t => {
  const options = await fixture(t, { test: 'setInterval(()=>{},1000);' });
  const input = { ...options, runTimeoutMs: 10000 };
  Object.defineProperty(input, 'commandTimeoutMs', { value: 1000, enumerable: false });
  const report = await checked(input);
  assert.equal(report.status, 'FAILED'); assert.equal(report.checks[0].status, 'TIMED_OUT');
  assert.equal(report.failureReasons.includes('CHECK_RUN_TIMED_OUT'), false);
  assert.deepEqual(report.checks.slice(1).map(item => item.status), ['PASSED', 'PASSED', 'PASSED']);
  assert.deepEqual(report.source, report.afterSource);
});
