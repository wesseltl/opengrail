/** Fixed, local compiler recipe. Does not import or execute application modules. */
import {constants, openSync, closeSync, fstatSync, lstatSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname, resolve, join, isAbsolute, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--source-root'||args[2]!=='--output-dir'||!isAbsolute(args[1])||!isAbsolute(args[3]))throw Error('FIXED_BUILD_ARGUMENTS_REQUIRED');
const sourceRoot=resolve(args[1]),outputDir=resolve(args[3]);
const graphBytes=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'agent-task-discussion-validator.build.json'));
const graph=JSON.parse(graphBytes),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(graph.version!==1||graph.kind!=='OPENGRAIL_TASK_DISCUSSION_VALIDATOR_BUILD_INPUTS'||graph.runtimeInputs.length!==14||graph.compilerVersion!=='0.28.0'||graph.zodVersion!=='3.25.76')throw Error('BUILD_GRAPH_REFUSED');
const entry="export {validateTaskDiscussionWrite, validateTaskDiscussionGet, boundedTaskDiscussionCommand} from './app/task-discussion-model.ts';\nexport {validateContributionTaskItem} from './app/contribution-model.ts';\n";
if(graph.entrySource!==entry)throw Error('BUILD_ENTRY_REFUSED');
const expectedPaths=['app/contribution-model.ts','app/research-model.ts','app/task-discussion-model.ts','app/venture-model.ts','node_modules/zod/index.js','node_modules/zod/v3/ZodError.js','node_modules/zod/v3/errors.js','node_modules/zod/v3/external.js','node_modules/zod/v3/helpers/errorUtil.js','node_modules/zod/v3/helpers/parseUtil.js','node_modules/zod/v3/helpers/typeAliases.js','node_modules/zod/v3/helpers/util.js','node_modules/zod/v3/locales/en.js','node_modules/zod/v3/types.js'];
const expectedExports=['boundedTaskDiscussionCommand','validateContributionTaskItem','validateTaskDiscussionGet','validateTaskDiscussionWrite'];
if(JSON.stringify(graph.runtimeInputs.map(row=>row.path).sort())!==JSON.stringify(expectedPaths)||JSON.stringify(graph.exports)!==JSON.stringify(expectedExports)||JSON.stringify(graph.packageMetadata.map(row=>row.path).sort())!==JSON.stringify(['node_modules/zod/LICENSE','node_modules/zod/package.json'])||graph.compiler.path!=='node_modules/@esbuild/linux-x64/bin/esbuild'||graph.maximumBundleBytes!==1048576||graph.maximumMetafileBytes!==65536)throw Error('BUILD_GRAPH_REFUSED');
function parents(path){let current=sep;for(const segment of resolve(path).split(sep).filter(Boolean)){current=join(current,segment);const s=lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())throw Error('BUILD_PARENT_REFUSED');}}
parents(sourceRoot);parents(dirname(outputDir));
function snapshot(row){
 const path=join(sourceRoot,row.path);parents(dirname(path));
 const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==(row.allowedHardLinks??1))throw Error('BUILD_INPUT_KIND_REFUSED');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const before=fstatSync(fd),bytes=readFileSync(fd),after=fstatSync(fd),current=lstatSync(path);
  const unchanged=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&a.nlink===b.nlink;
  if(!unchanged(stat,before)||!unchanged(before,after)||!unchanged(after,current)||bytes.length!==row.bytes||sha(bytes)!==row.sha256||(after.mode&0o777)!==Number.parseInt(row.mode.slice(2),8))throw Error('BUILD_INPUT_IDENTITY_REFUSED');
  return bytes;
 }finally{closeSync(fd);}
}
const inputRows=[...graph.runtimeInputs,...graph.packageMetadata],material=new Map(inputRows.map(row=>[row.path,snapshot(row)]));snapshot(graph.compiler);
const compilerFd=openSync(join(sourceRoot,graph.compiler.path),constants.O_RDONLY|constants.O_NOFOLLOW);
const compilerBefore=fstatSync(compilerFd),compilerBytes=readFileSync(compilerFd);
if(compilerBytes.length!==graph.compiler.bytes||sha(compilerBytes)!==graph.compiler.sha256)throw Error('BUILD_COMPILER_REFUSED');
const compilerArgs=['entry.mjs','--bundle','--format=esm','--platform=browser','--target=es2022','--charset=utf8','--legal-comments=inline','--log-level=error','--tsconfig-raw={"compilerOptions":{}}','--metafile=metafile.json','--outfile=bundle.mjs'];
const temporary=[];
function compile(){
 const directory=mkdtempSync(join(tmpdir(),'opengrail-task-discussion-build-'));temporary.push(directory);
 for(const [path,bytes]of material){const target=join(directory,path);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,bytes,{flag:'wx',mode:0o600});}
 writeFileSync(join(directory,'entry.mjs'),entry,{flag:'wx',mode:0o600});
 // Pass the already measured binary FD. No JavaScript package loader, installation or network.
 execFileSync('/proc/self/fd/3',compilerArgs,{cwd:directory,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},stdio:['pipe','pipe','pipe',compilerFd],timeout:60000,maxBuffer:65536});
 const metadataBytes=readFileSync(join(directory,'metafile.json'));if(metadataBytes.length>graph.maximumMetafileBytes)throw Error('BUILD_METAFILE_LIMIT');
 const metadata=JSON.parse(metadataBytes),inputs=Object.keys(metadata.inputs).sort(),outputs=Object.values(metadata.outputs);
 if(JSON.stringify(inputs)!==JSON.stringify([...expectedPaths,'entry.mjs'].sort())||outputs.length!==1||outputs[0].imports.length!==0||JSON.stringify([...outputs[0].exports].sort())!==JSON.stringify(expectedExports)||Object.values(metadata.inputs).some(input=>input.imports.some(link=>link.external)))throw Error('BUILD_RESOLUTION_GRAPH_REFUSED');
 const code=readFileSync(join(directory,'bundle.mjs'));if(code.length>graph.maximumBundleBytes||code.includes(Buffer.from('import(')))throw Error('BUILD_RUNTIME_IMPORT_OR_SIZE_REFUSED');
 const license=material.get('node_modules/zod/LICENSE').toString('utf8');if(license.includes('*/'))throw Error('BUILD_LICENSE_COMMENT_REFUSED');
 const banner=`/** Generated from unchanged OpenGrail models. Source snapshot ${graph.sourceSnapshot.sourceDigest}. Build inputs SHA-256 ${sha(graphBytes)}. */\n/* Zod 3.25.76 license, retained verbatim:\n${license}*/\n`;
 const bundle=Buffer.concat([Buffer.from(banner),code]);if(bundle.length>graph.maximumBundleBytes)throw Error('BUILD_BUNDLE_LIMIT');
 return {bundle,metadata};
}
try{
 const first=compile(),second=compile();if(!first.bundle.equals(second.bundle)||JSON.stringify(first.metadata)!==JSON.stringify(second.metadata))throw Error('BUILD_NOT_REPRODUCIBLE');
 for(const row of inputRows)if(!snapshot(row).equals(material.get(row.path)))throw Error('BUILD_INPUT_CHANGED');snapshot(graph.compiler);
 const compilerAfter=fstatSync(compilerFd);if(compilerBefore.dev!==compilerAfter.dev||compilerBefore.ino!==compilerAfter.ino||compilerBefore.size!==compilerAfter.size||compilerBefore.mtimeMs!==compilerAfter.mtimeMs||compilerBefore.ctimeMs!==compilerAfter.ctimeMs)throw Error('BUILD_COMPILER_CHANGED');
 mkdirSync(outputDir,{mode:0o700});
 const outputName='opengrail-task-discussion-validator.bundle.mjs';writeFileSync(join(outputDir,outputName),first.bundle,{flag:'wx',mode:0o600});
 const provenance={version:1,kind:'OPENGRAIL_TASK_DISCUSSION_VALIDATOR_BUILD_NOT_RUNTIME_ACCEPTANCE',status:'BUILT_TWICE_IDENTICAL_RUNTIME_NOT_TESTED',sourceSnapshot:graph.sourceSnapshot,buildInputsSha256:sha(graphBytes),recipeSha256:sha(readFileSync(fileURLToPath(import.meta.url))),runtimeInputs:graph.runtimeInputs,packageMetadata:graph.packageMetadata,compiler:graph.compiler,nodeUsed:process.version,compilerArgs,entrySha256:sha(Buffer.from(entry)),output:{path:outputName,bytes:first.bundle.length,sha256:sha(first.bundle)},exports:expectedExports,metafile:first.metadata,noRuntimePackageImports:true,applicationExecution:false,hostedAvailability:'UNKNOWN',qualification:'NONE',executionEnabled:false};
 writeFileSync(join(outputDir,'opengrail-task-discussion-validator.bundle.provenance.json'),JSON.stringify(provenance,null,2)+'\n',{flag:'wx',mode:0o600});
 if(sha(readFileSync(join(outputDir,outputName)))!==provenance.output.sha256)throw Error('BUILD_OUTPUT_READBACK_FAILED');
 console.log(JSON.stringify({status:provenance.status,output:provenance.output,buildInputsSha256:provenance.buildInputsSha256}));
}finally{closeSync(compilerFd);for(const directory of temporary)rmSync(directory,{recursive:true,force:false});}
