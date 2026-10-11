import {readFileSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

async function main(){
 assert.equal(process.argv.length,2,'This fixed fixture generator accepts no arguments.');
 const root=new URL('../',import.meta.url),project=fileURLToPath(root);
 const bundle=await build({stdin:{contents:"export {compareDemoArtifact,verifyComparisonReport} from './app/evaluator-comparison';export {parseUniqueJson} from './app/unique-json';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const fixture=name=>m.parseUniqueJson(readFileSync(new URL('examples/experiments/'+name,root),'utf8'),8388608,16);
 const directory=new URL('examples/comparisons/',root);mkdirSync(directory,{recursive:true});
 for(const [name,artifact,status] of [
  ['negative-reconstructed.json',fixture('signal-author-artifact.json'),'MATCH'],
  ['insolvency-reconstructed.json',fixture('insolvency-artifact.json'),'MATCH'],
  ['false-claim-disagreement.json',fixture('signal-conflicting-outcome.json').item.record.content.result.artifact,'MISMATCH']
 ]){
  const report=await m.verifyComparisonReport(await m.compareDemoArtifact(artifact));assert.equal(report.status,status);assert.equal(report.qualification,'NONE');
  const text=JSON.stringify(report,null,2)+'\n',target=new URL(name,directory);
  if(existsSync(target))assert.equal(readFileSync(target,'utf8'),text,'Existing evidence differs; preserve it for review.');else writeFileSync(target,text,{flag:'wx',mode:0o600});
 }
 process.stdout.write('Three synthetic comparison fixtures retained, without independent qualification.\n');
}
main().catch(()=>{process.stderr.write('Comparison fixture generation failed. Existing evidence is retained.\n');process.exitCode=1;});
