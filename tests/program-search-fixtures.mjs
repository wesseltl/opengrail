import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

let prepared;
export async function loadProgramSearchModules(){
 if(!prepared)prepared=(async()=>{
  const bundled=await build({stdin:{contents:"export * from './app/program-search-protocol';export * from './app/program-search-example';export {strategyDigest,boundedStrategyRecord,strategyTemplate,strategyAuthorReference,strategyRecordV2Schema} from './app/strategy-model';export * from './app/program-run';export * from './app/program-run-model';export * from './app/program-evidence';export * from './app/program-source-model';export * from './app/program-comparison-model';export * from './app/program-comparison';export {replayDemo} from './app/demo-engine';export {compareDemoArtifact} from './app/evaluator-comparison';export {createSearchPlan,verifySearchLedger} from './app/search-protocol';export {syntheticSearchExample} from './app/search-example';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
  const directory=mkdtempSync(join(tmpdir(),'opengrail-program-search-')),path=join(directory,'fixed-first-party.mjs');writeFileSync(path,bundled.outputFiles[0].text,{flag:'wx',mode:0o600});process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));return import(pathToFileURL(path).href);
 })();return prepared;
}
export async function programSearchFixture(){return (await loadProgramSearchModules()).syntheticProgramSearchExample();}
