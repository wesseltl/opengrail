#!/usr/bin/env node
/** Fixed local checks. A self-reported digest is never a CI attestation or an approval. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, writeFile, realpath, mkdtemp, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const contributionCheckLimits = Object.freeze({ commandTimeoutMs: 1200000, metadataTimeoutMs: 10000, outputBytes: 2097152, retainedBytesPerStream: 16384, reportBytes: 262144, sourceBytes: 262144 });
export const contributionScriptPins = Object.freeze({ 'install:ci': 'node scripts/install-ci.mjs', test: 'node --test tests/*.test.mjs', typecheck: 'tsc --noEmit', build: 'node scripts/run-framework.mjs build' });
const sha = /^[0-9a-f]{40}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const emptyOutput = () => ({ text: '', bytes: 0, sha256: hash(''), truncated: false });
const rootFile = fileURLToPath(import.meta.url);
export class ContributionCheckError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new ContributionCheckError(code); };

// Native, bounded duplicate-key grammar validation before JSON.parse.
function json(raw, maximumBytes = contributionCheckLimits.sourceBytes) {
  if (Buffer.byteLength(raw) > maximumBytes) fail('INPUT_LIMIT');
  let n = 0;
  const space = () => { while (/[\t\r\n ]/.test(raw[n] ?? '') && n < raw.length) n++; };
  const string = () => { const start = n; if (raw[n++] !== '"') fail('INVALID_JSON'); while (n < raw.length) { const c = raw[n++]; if (c === '\\') n++; else if (c === '"') { try { return JSON.parse(raw.slice(start, n)); } catch { fail('INVALID_JSON'); } } } fail('INVALID_JSON'); };
  function value(depth) {
    if (depth > 16) fail('INPUT_LIMIT');
    space();
    if (raw[n] === '{') { n++; space(); const keys = new Set(); if (raw[n] === '}') { n++; return; } while (n < raw.length) { space(); const key = string(); if (keys.has(key)) fail('DUPLICATE_JSON_KEY'); keys.add(key); space(); if (raw[n++] !== ':') fail('INVALID_JSON'); value(depth + 1); space(); if (raw[n] === '}') { n++; return; } if (raw[n++] !== ',') fail('INVALID_JSON'); } fail('INVALID_JSON'); }
    if (raw[n] === '[') { n++; space(); if (raw[n] === ']') { n++; return; } while (n < raw.length) { value(depth + 1); space(); if (raw[n] === ']') { n++; return; } if (raw[n++] !== ',') fail('INVALID_JSON'); } fail('INVALID_JSON'); }
    if (raw[n] === '"') { string(); return; }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(n)); if (!token) fail('INVALID_JSON'); n += token[0].length;
  }
  value(0); space(); if (n !== raw.length) fail('INVALID_JSON');
  try { return JSON.parse(raw); } catch { fail('INVALID_JSON'); }
}
async function boundedFile(path, maximumBytes = contributionCheckLimits.sourceBytes) {
  if (await realpath(dirname(path)) !== dirname(path)) fail('UNSAFE_SOURCE_PATH');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat(); if (!stat.isFile() || stat.size > maximumBytes) fail('INPUT_LIMIT');
    const buffer = Buffer.alloc(maximumBytes + 1); let count = 0;
    while (count < buffer.length) { const read = await handle.read(buffer, count, buffer.length - count, count); if (read.bytesRead === 0) break; count += read.bytesRead; }
    if (count > maximumBytes || (await handle.stat()).size > maximumBytes) fail('INPUT_LIMIT');
    return buffer.subarray(0, count);
  } finally { await handle.close(); }
}
function plainOptions(raw) {
  if (!raw || Object.getPrototypeOf(raw) !== Object.prototype) fail('INVALID_OPTIONS');
  const keys = ['root', 'baseSha', 'headSha', 'testedSha', 'reportPath', 'signal', 'commandTimeoutMs'];
  for (const key of Reflect.ownKeys(raw)) { const descriptor = Object.getOwnPropertyDescriptor(raw, key); if (typeof key !== 'string' || !keys.includes(key) || !('value' in descriptor)) fail('INVALID_OPTIONS'); }
  for (const key of ['root', 'reportPath']) if (typeof raw[key] !== 'string' || !isAbsolute(raw[key]) || raw[key].length > 4096 || /[\x00-\x1f]/.test(raw[key])) fail('INVALID_OPTIONS');
  for (const key of ['baseSha', 'headSha', 'testedSha']) if (typeof raw[key] !== 'string' || !sha.test(raw[key])) fail('INVALID_IDENTITY');
  if (raw.signal !== undefined && !(raw.signal instanceof AbortSignal)) fail('INVALID_OPTIONS');
  const timeout = raw.commandTimeoutMs ?? contributionCheckLimits.commandTimeoutMs;
  if (!Number.isInteger(timeout) || timeout < 50 || timeout > contributionCheckLimits.commandTimeoutMs) fail('INVALID_OPTIONS');
  return { ...raw, commandTimeoutMs: timeout };
}
function githubContext(baseSha, headSha, testedSha) {
  if (process.env.GITHUB_ACTIONS !== 'true') return null;
  const e = process.env;
  if (e.GITHUB_EVENT_NAME !== 'pull_request' || e.GITHUB_SHA !== testedSha || e.OG_CI_BASE_SHA !== baseSha || e.OG_CI_HEAD_SHA !== headSha || e.OG_CI_TESTED_SHA !== testedSha) fail('PROVIDER_IDENTITY_MISMATCH');
  const integer = name => { if (!/^[1-9]\d{0,19}$/.test(e[name] ?? '')) fail('PROVIDER_IDENTITY_MISMATCH'); return e[name]; };
  const repository = (name, id) => { if (!/^[A-Za-z0-9_-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(e[name] ?? '')) fail('PROVIDER_IDENTITY_MISMATCH'); return { id: integer(id), fullName: e[name] }; };
  const pullRequest = integer('OG_CI_PR_NUMBER');
  if (e.GITHUB_REF !== `refs/pull/${pullRequest}/merge`) fail('PROVIDER_IDENTITY_MISMATCH');
  return { event: 'pull_request', repository: repository('GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID'), headRepository: repository('OG_CI_HEAD_REPOSITORY', 'OG_CI_HEAD_REPOSITORY_ID'), pullRequest, runId: integer('GITHUB_RUN_ID'), runAttempt: integer('GITHUB_RUN_ATTEMPT'), ref: e.GITHUB_REF };
}
function childEnvironment(scratch) {
  // No inherited provider tokens, Node preload flags or workstation npm credentials.
  return { PATH: process.env.PATH ?? '', ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot ?? '' } : {}), HOME: scratch, TMPDIR: scratch, CI: 'true', NO_COLOR: '1', FORCE_COLOR: '0', NPM_CONFIG_USERCONFIG: resolve(scratch, 'npm-user-config'), NPM_CONFIG_GLOBALCONFIG: resolve(scratch, 'npm-global-config'), npm_config_cache: resolve(scratch, 'npm-cache'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
}
function safeText(bytes) {
  // Retained logs are diagnostics, not arbitrary terminal commands or credential storage.
  let text = bytes.toString('utf8');
  for (let n = 0; n < 3; n++) { try { const decoded = decodeURIComponent(text); if (decoded === text) break; text = decoded; } catch { break; } }
  text = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  text = text.replace(/og_(?:agent|local_owner|local_producer)_[^\s"'<>]{1,256}|\bgh[pousr]_[A-Za-z0-9_]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{22,255}\b|\bBearer\s+[^\s"'<>]{1,512}/gi, '[REDACTED_CREDENTIAL]');
  // Bound the actual JSON string allowance too (quotes/newlines can expand when encoded).
  if (Buffer.byteLength(JSON.stringify(text)) > contributionCheckLimits.retainedBytesPerStream) {
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (Buffer.byteLength(JSON.stringify(text.slice(0, mid))) <= contributionCheckLimits.retainedBytesPerStream) lo = mid; else hi = mid - 1; }
    text = text.slice(0, lo);
  }
  return text;
}
async function command(argv, { root, env, timeoutMs, signal, maximumBytes = contributionCheckLimits.outputBytes }) {
  const started = performance.now();
  if (signal?.aborted) return { status: 'INTERRUPTED', exitCode: null, signal: null, durationMs: 0, stdout: emptyOutput(), stderr: emptyOutput() };
  return new Promise(resolveResult => {
    const streams = { stdout: { bytes: 0, digest: createHash('sha256'), chunks: [], retained: 0 }, stderr: { bytes: 0, digest: createHash('sha256'), chunks: [], retained: 0 } };
    let cause = null, total = 0, child, timer, killTimer, completed = false;
    const kill = why => { if (!cause) cause = why; try { process.kill(-child.pid, 'SIGTERM'); } catch { child?.kill('SIGTERM'); } killTimer ??= setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child?.kill('SIGKILL'); } }, 250); killTimer.unref(); };
    const aborted = () => kill('INTERRUPTED');
    const complete = (code, exitSignal) => {
      if (completed) return; completed = true; clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', aborted);
      const output = key => { const s = streams[key]; const retained = Buffer.concat(s.chunks), text = safeText(retained); return { text, bytes: s.bytes, sha256: s.digest.digest('hex'), truncated: s.bytes > s.retained || Buffer.byteLength(text) < retained.length }; };
      resolveResult({ status: cause ?? (code === 0 ? 'PASSED' : 'FAILED'), exitCode: Number.isInteger(code) ? code : null, signal: exitSignal ?? null, durationMs: Math.round(performance.now() - started), stdout: output('stdout'), stderr: output('stderr') });
    };
    try { child = spawn(argv[0], argv.slice(1), { cwd: root, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { cause = 'FAILED'; complete(null, null); return; }
    for (const key of ['stdout', 'stderr']) child[key].on('data', chunk => { if (cause === 'OUTPUT_LIMIT') return; const s = streams[key]; total += chunk.length; s.bytes += chunk.length; s.digest.update(chunk); const keep = Math.min(chunk.length, contributionCheckLimits.retainedBytesPerStream - s.retained); if (keep > 0) { s.chunks.push(chunk.subarray(0, keep)); s.retained += keep; } if (total > maximumBytes) kill('OUTPUT_LIMIT'); });
    child.on('error', () => { cause = 'FAILED'; }); child.on('close', complete);
    timer = setTimeout(() => kill('TIMED_OUT'), timeoutMs); timer.unref(); signal?.addEventListener('abort', aborted, { once: true }); if (signal?.aborted) aborted();
  });
}
async function metadata(argv, options) { const result = await command(['git', '-c', 'core.hooksPath=/dev/null', ...argv], { ...options, timeoutMs: contributionCheckLimits.metadataTimeoutMs, maximumBytes: contributionCheckLimits.sourceBytes }); if (result.status !== 'PASSED' || result.stdout.truncated || result.stderr.truncated) fail('SOURCE_UNAVAILABLE'); return result.stdout.text.trim(); }
async function snapshot(options, includeFiles = true) {
  const commitSha = await metadata(['rev-parse', '--verify', 'HEAD'], options);
  const treeSha = await metadata(['rev-parse', '--verify', 'HEAD^{tree}'], options);
  const parents = (await metadata(['rev-list', '--parents', '-n', '1', 'HEAD'], options)).split(' ').slice(1);
  const dirty = (await metadata(['status', '--porcelain=v1', '--untracked-files=normal'], options)) !== '';
  if (!sha.test(commitSha) || !sha.test(treeSha) || parents.some(v => !sha.test(v))) fail('SOURCE_UNAVAILABLE');
  const result = { commitSha, treeSha, parents, dirty };
  if (includeFiles) {
    const files = {};
    for (const [key, name] of Object.entries({ checker: 'scripts/check-contribution.mjs', workflow: '.github/workflows/contribution.yml', packageJson: 'package.json' })) files[key] = hash(await boundedFile(resolve(options.root, name)));
    const pkg = json((await boundedFile(resolve(options.root, 'package.json'))).toString('utf8'));
    if (!pkg || typeof pkg !== 'object' || !pkg.scripts || typeof pkg.scripts !== 'object') fail('SCRIPT_PIN_MISMATCH');
    for (const [key, value] of Object.entries(contributionScriptPins)) if (pkg.scripts[key] !== value || Object.hasOwn(pkg.scripts, `pre${key}`) || Object.hasOwn(pkg.scripts, `post${key}`)) fail('SCRIPT_PIN_MISMATCH');
    if (files.checker !== hash(await boundedFile(rootFile))) fail('CHECKER_IDENTITY_MISMATCH');
    result.files = files; result.scripts = { ...contributionScriptPins };
  }
  return result;
}
function sameSource(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function createReportWriter(path) {
  const directory = await realpath(dirname(path));
  if (directory !== dirname(path)) fail('UNSAFE_REPORT_PATH');
  const reservation = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  await reservation.close();
  let previous = hash('');
  return async body => {
    const report = { ...body, reportDigest: hash(JSON.stringify(body)) }; const bytes = Buffer.from(JSON.stringify(report) + '\n');
    if (bytes.length > contributionCheckLimits.reportBytes) fail('REPORT_LIMIT');
    if (hash(await boundedFile(path, contributionCheckLimits.reportBytes)) !== previous) fail('REPORT_CHANGED');
    const temporary = `${path}.pending-${randomUUID()}`; let handle;
    try { handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null; await rename(temporary, path); const dir = await open(directory, constants.O_RDONLY); try { await dir.sync(); } finally { await dir.close(); } previous = hash(bytes); return report; } finally { if (handle) await handle.close(); await rm(temporary, { force: true }); }
  };
}

/** Fixed commands only; timeout override may only lower the public bound (used by isolated fixtures). */
export async function runContributionChecks(raw) {
  const options = plainOptions(raw); options.root = await realpath(options.root);
  const reportParent = await realpath(dirname(options.reportPath)); const rel = relative(options.root, reportParent);
  if (rel === '' || !rel.startsWith('..') && !isAbsolute(rel)) fail('REPORT_MUST_BE_OUTSIDE_CHECKOUT');
  const write = await createReportWriter(options.reportPath);
  const scratch = await mkdtemp(resolve(tmpdir(), 'opengrail-contribution-'));
  await writeFile(resolve(scratch, 'npm-user-config'), '', { mode: 0o600 }); await writeFile(resolve(scratch, 'npm-global-config'), '', { mode: 0o600 });
  const env = childEnvironment(scratch); const execution = { root: options.root, env, signal: options.signal };
  const commands = [{ id: 'test', command: ['npm', 'test'] }, { id: 'typecheck', command: ['npm', 'run', 'typecheck'] }, { id: 'build', command: ['npm', 'run', 'build'] }, { id: 'diffcheck', command: ['git', '-c', 'core.hooksPath=/dev/null', 'diff', '--check', options.baseSha, options.testedSha] }];
  const body = { version: 1, kind: 'LOCAL_CHECK_REPORT', classification: 'AUTHOR_REPORTED', qualification: 'NONE', status: 'RUNNING', startedAt: new Date().toISOString(), finishedAt: null, declared: { baseSha: options.baseSha, headSha: options.headSha, testedSha: options.testedSha }, providerContext: null, runtime: { node: process.version, platform: process.platform, architecture: process.arch }, source: null, afterSource: null, checks: commands.map(v => ({ ...v, status: 'NOT_RUN', exitCode: null, signal: null, durationMs: 0, stdout: emptyOutput(), stderr: emptyOutput() })), failureReasons: [] };
  let report;
  try {
    await write(body);
    body.providerContext = githubContext(options.baseSha, options.headSha, options.testedSha);
    body.source = await snapshot(execution);
    if (body.source.dirty) fail('DIRTY_CHECKOUT');
    if (body.source.commitSha !== options.testedSha || body.source.parents.length !== 2 || body.source.parents[0] !== options.baseSha || body.source.parents[1] !== options.headSha) fail('CHECKOUT_IDENTITY_MISMATCH');
    for (let n = 0; n < commands.length; n++) {
      if (options.signal?.aborted) { body.failureReasons.push('INTERRUPTED'); break; }
      if (!sameSource(body.source, await snapshot(execution))) fail('SOURCE_CHANGED');
      body.checks[n].status = 'RUNNING'; await write(body);
      Object.assign(body.checks[n], await command(commands[n].command, { ...execution, timeoutMs: options.commandTimeoutMs }));
      await write(body);
      if (body.checks[n].status === 'INTERRUPTED') { body.failureReasons.push('INTERRUPTED'); break; }
      if (!sameSource(body.source, await snapshot(execution))) fail('SOURCE_CHANGED');
    }
    body.afterSource = await snapshot({ ...execution, signal: undefined });
    if (!sameSource(body.source, body.afterSource)) fail('SOURCE_CHANGED');
  } catch (error) { body.failureReasons.push(error instanceof ContributionCheckError ? error.code : 'LOCAL_CHECK_FAILURE'); }
  finally {
    body.finishedAt = new Date().toISOString();
    body.status = options.signal?.aborted || body.failureReasons.includes('INTERRUPTED') || body.checks.some(v => v.status === 'INTERRUPTED') ? 'INTERRUPTED' : body.failureReasons.length === 0 && body.checks.every(v => v.status === 'PASSED') ? 'PASSED' : 'FAILED';
    try { report = await write(body); } finally { await rm(scratch, { recursive: true, force: true }); }
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4) fail('USAGE_CHECK_CONTRIBUTION_BASE_HEAD_TESTED_NEW_REPORT');
  const controller = new AbortController(); const stop = () => controller.abort(); process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try { const report = await runContributionChecks({ root: process.cwd(), baseSha: args[0], headSha: args[1], testedSha: args[2], reportPath: args[3], signal: controller.signal }); process.stdout.write(JSON.stringify(report) + '\n'); process.exitCode = report.status === 'PASSED' ? 0 : 1; }
  finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}
if (process.argv[1] && resolve(process.argv[1]) === rootFile) main().catch(error => { process.stderr.write(JSON.stringify({ kind: 'LOCAL_CHECK_ERROR', code: error instanceof ContributionCheckError ? error.code : 'LOCAL_CHECK_FAILURE', qualification: 'NONE' }) + '\n'); process.exitCode = 1; });
