import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

let prepared;
export async function loadSearchModules() {
  if (!prepared) prepared = (async () => {
    const bundle = await build({stdin: {contents: "export * from './app/search-protocol';export * from './app/search-example';export {strategyDigest,boundedStrategyRecord,strategyTemplate,strategyAuthorReference} from './app/strategy-model';export {boundedDemoRequest,demoArtifactDigest,verifyDemoArtifact,demoLimits} from './app/demo-model';export {replayDemo} from './app/demo-engine';export {compareDemoArtifact,verifyComparisonReport} from './app/evaluator-comparison';", resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
    const directory=mkdtempSync(join(tmpdir(),'opengrail-search-core-')),path=join(directory,'fixed-search.mjs');
    writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx',mode:0o600});
    process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));
    return import(pathToFileURL(path).href);
  })();
  return prepared;
}
export async function searchFixture() { return (await loadSearchModules()).syntheticSearchExample(); }
