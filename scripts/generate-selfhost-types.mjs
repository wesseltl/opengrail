import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rename, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

if (process.argv.length !== 2) throw Error('This command takes no arguments.');
const root = process.cwd();
if (JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).name !== 'opengrail-network') {
  throw Error('Run from the OpenGrail checkout root.');
}
await mkdir(resolve(root, 'selfhost'), {recursive:true});
const temporary = resolve(root, 'selfhost', '.generated-' + randomUUID() + '.d.ts');
const target = resolve(root, 'selfhost', 'env.d.ts');
const environment = {PATH: process.env.PATH ?? '/usr/bin:/bin', LANG:'C.UTF-8', CI:'1', NO_COLOR:'1',
  WRANGLER_SEND_METRICS:'false', WRANGLER_WRITE_LOGS:'false', CLOUDFLARE_CF_FETCH_ENABLED:'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false', CLOUDFLARE_INCLUDE_PROCESS_ENV:'false'};
try {
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
    'types', temporary, '--config', resolve(root, 'wrangler.selfhost.jsonc'),
    '--env-interface', 'SelfHostedEnv', '--include-runtime=false', '--strict-vars=false'],
    {cwd:root,env:environment,timeout:120000,maxBuffer:1024*1024,encoding:'utf8'});
  if (result.error || result.status !== 0) {
    throw Error('Standalone binding type generation failed.');
  }
  const info = await lstat(temporary);
  if (!info.isFile() || info.nlink !== 1 || info.size > 65536) throw Error('Invalid generated declarations.');
  const generated = await readFile(temporary, 'utf8');
  if (!generated.includes('interface SelfHostedEnv') || !generated.includes('AUTH_DB: D1Database')) {
    throw Error('Standalone bindings missing from generated declarations.');
  }
  // Export the generated interface as a module so its Cloudflare.Env namespace
  // cannot merge standalone secrets/bindings into the separate Sites target.
  // The binding declarations themselves come entirely from installed Wrangler.
  await writeFile(temporary, generated + '\nexport type { SelfHostedEnv };\n', {flag:'w'});
  await rename(temporary, target);
  console.log('Generated standalone binding types. No deployment or secret values.');
} finally {
  await rm(temporary, {force:true});
}
