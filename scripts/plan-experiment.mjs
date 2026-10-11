import {openSync, closeSync, fstatSync, readSync, constants, readFileSync, writeFileSync, fsyncSync, realpathSync, linkSync, unlinkSync, mkdtempSync, rmSync} from 'node:fs';
import {dirname, basename, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
import {build} from 'esbuild';

// Fixed reviewed local modules. All supplied files are data, never code or
// network locations. This tool prepares drafts/bundles and evaluates nothing.
const root = new URL('../', import.meta.url), bundleBytes = 393216;
let temporary;
const digest = value => createHash('sha256').update(value).digest('hex');
function readBounded(path, maximum) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > maximum) throw Error('Invalid bounded regular input.');
    const data = Buffer.alloc(Math.min(stat.size + 1, maximum + 1));
    let length = 0;
    for (;;) {
      const count = readSync(fd, data, length, data.length - length, null);
      if (!count) break;
      length += count;
      if (length === data.length) throw Error('Input changed while reading.');
    }
    return new TextDecoder('utf-8', {fatal: true}).decode(data.subarray(0, length));
  } finally { closeSync(fd); }
}
function createNew(requested, value, maximum) {
  const payload = Buffer.from(JSON.stringify(value));
  if (payload.length > maximum) throw Error('Output exceeds capacity.');
  const directory = realpathSync(dirname(requested)), destination = join(directory, basename(requested));
  const temp = join(directory, '.opengrail-plan-' + randomUUID() + '.tmp');
  let fd;
  try {
    fd = openSync(temp, 'wx', 0o600);
    writeFileSync(fd, payload); fsyncSync(fd); closeSync(fd); fd = undefined;
    // A competing creator or an existing file/symlink cannot be overwritten.
    linkSync(temp, destination); unlinkSync(temp);
    const parent = openSync(directory, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0));
    try { fsyncSync(parent); } finally { closeSync(parent); }
    return digest(payload);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temp); } catch {}
  }
}
async function modules() {
  const result = await build({stdin: {contents: "export * from './app/experiment-plan'; export {parseUniqueJson} from './app/unique-json'; export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';", resolveDir: fileURLToPath(root)}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
  temporary = mkdtempSync(join(tmpdir(), 'opengrail-chronological-plan-'));
  const file = join(temporary, 'fixed-plan.mjs');
  writeFileSync(file, result.outputFiles[0].text, {flag: 'wx', mode: 0o600});
  const m = await import(pathToFileURL(file).href);
  for (const [key, path] of [['primary', 'app/demo-engine.ts'], ['reference', 'app/reference-engine.ts']]) {
    if (digest(readFileSync(new URL(path, root))) !== m.evaluatorSourceFingerprints[key]) throw Error('Fixed source identity changed.');
  }
  return m;
}
const identities = () => ({requestId: randomUUID(), id: randomUUID(), inputRequestId: randomUUID(), datasetId: randomUUID()});
const parseFile = (m, path, maximum) => m.parseUniqueJson(readBounded(path, maximum), maximum, 24);
async function emit(value) {
  const output = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(output) > 4096) throw Error('Diagnostic capacity.');
  await new Promise((resolve, reject) => process.stdout.write(output, error => error ? reject(error) : resolve()));
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const valid = command === 'freeze' && args.length === 4 && /^[0-9]{1,4}$/.test(args[1]) && /^[0-9]{1,4}$/.test(args[2])
    || command === 'verify' && args.length === 1
    || command === 'prepare' && args.length === 4 && ['TRAIN', 'TEST'].includes(args[1]) && args[3] === '--confirm-public-sharing'
    || command === 'bundle' && args.length === 4 && ['TRAIN', 'TEST'].includes(args[1]);
  if (!valid) {
    process.stderr.write('Usage: node scripts/plan-experiment.mjs freeze BUNDLE.json TRAINING_BARS GAP_BARS NEW_PLAN.json | verify PLAN.json | prepare PLAN.json TRAIN|TEST NEW_COMMAND.json --confirm-public-sharing | bundle PLAN.json TRAIN|TEST CHILD_ITEM.json NEW_BUNDLE.json\n');
    return 1;
  }
  const m = await modules();
  if (command === 'freeze') {
    const bundle = parseFile(m, args[0], bundleBytes);
    if (!bundle || bundle.version !== 1 || Object.keys(bundle).sort().join(',') !== 'manifest,source,version') throw Error('Invalid exact source bundle.');
    const plan = await m.createChronologicalPlan({planId: randomUUID(), createdAt: new Date().toISOString(), parent: bundle.manifest, source: bundle.source, trainingBars: Number(args[1]), excludedGapBars: Number(args[2]), children: {TRAIN: identities(), TEST: identities()}});
    const fileDigest = createNew(args[3], plan, m.chronologicalPlanLimits.planBytes);
    await emit({type: 'PLAN_FROZEN', planId: plan.planId, planDigest: plan.planDigest, fileDigest, classification: 'AUTHOR_REPORTED', qualification: 'NONE', unseen: 'NOT_ESTABLISHED', sourceAuthentication: 'OFFLINE_SNAPSHOT_UNVERIFIED', evaluated: false, submitted: false, ordersEnabled: false});
    return 0;
  }
  const plan = await m.verifyChronologicalPlan(parseFile(m, args[0], m.chronologicalPlanLimits.planBytes));
  if (command === 'verify') {
    await emit({type: 'PLAN_IDENTITY_CHECKED', planId: plan.planId, planDigest: plan.planDigest, qualification: 'NONE', unseen: 'NOT_ESTABLISHED', executionReconstructed: false, sourceAuthentication: 'OFFLINE_SNAPSHOT_UNVERIFIED', ordersEnabled: false});
    return 0;
  }
  const partition = args[1];
  if (command === 'prepare') {
    const draft = await m.prepareChronologicalManifest(plan, partition, {confirmPublicSharing: true});
    const fileDigest = createNew(args[2], draft, 786432);
    await emit({type: 'REGISTRATION_DRAFT_EXPORTED', planId: plan.planId, partition, requestId: draft.requestId, manifestId: draft.id, fileDigest, submitted: false, ordersEnabled: false});
    return 0;
  }
  const child = await m.correlateChronologicalManifest(plan, partition, parseFile(m, args[2], bundleBytes));
  const bundle = {version: 1, manifest: child, source: plan.captured.source};
  const fileDigest = createNew(args[3], bundle, bundleBytes);
  await emit({type: 'EXACT_CHILD_BUNDLE_EXPORTED', planId: plan.planId, partition, manifestId: child.id, fileDigest, sourceAuthentication: 'OFFLINE_SNAPSHOT_UNVERIFIED', evaluated: false, submitted: false, ordersEnabled: false});
  return 0;
}
try { process.exitCode = await main(); }
catch { process.stderr.write('Plan command was not confirmed. Preserve any existing output; check exact sources, strict inputs, capacity and original child registration before retrying.\n'); process.exitCode = 1; }
finally { if (temporary) rmSync(temporary, {recursive: true, force: true}); }
