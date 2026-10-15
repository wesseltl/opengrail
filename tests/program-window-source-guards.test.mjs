import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync,copyFileSync,cpSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {windowHistoricalSourcePaths} from '../scripts/program-window-preserved-sources.mjs';

test('window source guard verifies preserved legacy bytes and separately refuses changed active runtime code',async()=>{
 const isolated=mkdtempSync(join(tmpdir(),'opengrail-window-source-guards-'));
 try{
  cpSync(resolve('app'),join(isolated,'app'),{recursive:true});
  cpSync(resolve('scripts'),join(isolated,'scripts'),{recursive:true});
  for(const name of ['package.json','package-lock.json','tsconfig.json'])copyFileSync(resolve(name),join(isolated,name));
  mkdirSync(join(isolated,'node_modules'));
  cpSync(realpathSync(resolve('node_modules/zod')),join(isolated,'node_modules/zod'),{recursive:true});
  symlinkSync(realpathSync(resolve('node_modules/esbuild')),join(isolated,'node_modules/esbuild'));
  const m=await import(pathToFileURL(join(isolated,'scripts/program-window-fingerprint-core.mjs')).href);
  const preserved=m.assertWindowLegacySources();
  assert.equal(preserved.length,64);
  assert.equal(preserved.filter(row=>row.preservation==='HISTORICAL_ARCHIVE').length,Object.keys(windowHistoricalSourcePaths).length);
  const path=windowHistoricalSourcePaths['app/program-forward-plan.ts'],historical=join(isolated,path),original=readFileSync(historical);
  assert.equal(preserved.find(row=>row.path==='app/program-forward-plan.ts').preservedPath,path);
  appendFileSync(historical,'\n// Changed preserved source.\n');
  assert.throws(()=>m.assertWindowLegacySources(),/CHANGED_PROTECTED_WINDOW_SOURCE:app\/program-forward-plan\.ts/);
  writeFileSync(historical,original);
  const guard=await m.createWindowPhysicalGuard();
  guard.assertFresh();
  assert(guard.receipt.extra.some(row=>row.path==='scripts/program-session-runtime.mjs'));
  assert(guard.receipt.extra.some(row=>row.path==='scripts/program-window-preserved-sources.mjs'));
  assert(guard.receipt.extra.some(row=>row.path==='scripts/session-legacy-fingerprint-core.mjs'));
  assert(guard.receipt.extra.some(row=>row.path==='app/session-implementation-registry.ts'));
  appendFileSync(join(isolated,'scripts/program-session-runtime.mjs'),'\n// Changed active source.\n');
  m.assertWindowLegacySources();
  assert.throws(()=>guard.assertFresh(),/CHANGED_WINDOW_SOURCE:scripts\/program-session-runtime\.mjs/);
 }finally{rmSync(isolated,{recursive:true,force:true});}
});
