import {openSync,closeSync,fstatSync,readSync,writeFileSync,constants,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

async function main(){
 const [command,input,output,...extra]=process.argv.slice(2);
 if(command!=='check'||!input||!output||extra.length){process.stderr.write('Usage: node scripts/compare-evaluators.mjs check ARTIFACT.json NEW_REPORT.json\n');return 1;}
 const root=new URL('../',import.meta.url),project=fileURLToPath(root);
 const compiled=await build({stdin:{contents:"export {compareDemoArtifact,verifyComparisonReport,comparisonLimits} from './app/evaluator-comparison';export {parseUniqueJson} from './app/unique-json';export {evaluatorSourceFingerprints} from './app/evaluator-fingerprints';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 const fixed=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 for(const [key,path] of [['primary','app/demo-engine.ts'],['reference','app/reference-engine.ts']]){
  if(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex')!==fixed.evaluatorSourceFingerprints[key])throw Error('Stale evaluator identity.');
 }
 const fd=openSync(input,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));let bytes;
 try{
  const stat=fstatSync(fd),maximum=fixed.comparisonLimits.artifactBytes;
  if(!stat.isFile()||stat.size<1||stat.size>maximum)throw Error('Invalid file.');
  bytes=Buffer.alloc(Math.min(stat.size+1,maximum+1));let length=0;
  for(;;){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;if(length===bytes.length||length>maximum)throw Error('Input changed or exceeds its bound.');}
  bytes=bytes.subarray(0,length);
 }finally{closeSync(fd);}
 const raw=fixed.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),fixed.comparisonLimits.artifactBytes,16);
 const report=await fixed.verifyComparisonReport(await fixed.compareDemoArtifact(raw));
 const text=JSON.stringify(report,null,2)+'\n';
 if(Buffer.byteLength(text)>fixed.comparisonLimits.reportBytes)throw Error('Report exceeds its bound.');
 writeFileSync(output,text,{flag:'wx',mode:0o600});
 process.stdout.write(report.status+': local comparison retained; AUTHOR_REPORTED, no independent qualification.\n');
 return report.status==='MATCH'?0:2;
}
try{process.exitCode=await main();}
catch{process.stderr.write('Comparison failed. Check bounded artifact integrity, fixed source fingerprints and a new output filename.\n');process.exitCode=1;}
