#!/usr/bin/env node
import {readFileSync,mkdtempSync,writeFileSync,rmSync,realpathSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {readPrivateHandoffFile} from './contribution-handoff-files.mjs';
import {preparePrivateEvidenceOutput,PrivateEvidenceOutputError} from './contribution-private-credential.mjs';
import {parseContributionPolicy,parseContributionEvidence,validateContributionEvidence} from './contribution-evidence-core.mjs';
import {publicHandoffLimits,publicHandoffHash,parsePublicHandoffJson,parsePublicContributionContext,validateLocalContributionReport,normalizePublicContributionHandoff,assessLocalContributionReport,publicHandoffAuthority} from './contribution-public-handoff-core.mjs';

const project=fileURLToPath(new URL('../',import.meta.url)),hash=/^[a-f0-9]{64}$/;
let temporary;const controller=new AbortController(),stop=()=>controller.abort();
process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function modules(){
 const settings={stdin:{contents:"export * from './app/contribution-model';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true};
 const discovered=await build(settings),inputs=Object.keys(discovered.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name)),sources=new Map(inputs.map(path=>[path,publicHandoffHash(readFileSync(path))])),compiled=await build(settings);
 if(JSON.stringify(Object.keys(compiled.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name)))!==JSON.stringify(inputs))throw Error();
 temporary=mkdtempSync(join(tmpdir(),'opengrail-public-handoff-'));const path=join(temporary,'fixed-model.mjs');writeFileSync(path,compiled.outputFiles[0].text,{flag:'wx',mode:0o600});const model=await import(pathToFileURL(path).href);
 function fresh(){if(controller.signal.aborted)throw Error();for(const [file,digest] of sources)if(publicHandoffHash(readFileSync(file))!==digest)throw Error();}
 fresh();return {model,fresh};
}
function protect(path){if(typeof path!=='string'||path.length>4096||/[\x00-\x1f]/.test(path)||resolve(path)!==path||realpathSync(path)!==path||!lstatSync(path).isDirectory())throw Error();return [path];}
function input(path,maximum,protectedDirectories){const text=readPrivateHandoffFile(path,maximum,protectedDirectories);return {raw:parsePublicHandoffJson(text,maximum),fileDigest:publicHandoffHash(Buffer.from(text))};}
function summary(kind,digest,record){return {kind,handoffDigest:digest,localStatus:record.localAssessment.status,localSource:record.localAssessment.source,ciStatus:record.ciAssessment.status,ciCollection:record.ciAssessment.collection,currentness:'NOT_RECHECKED',classification:'AUTHOR_REPORTED',qualification:'NONE',cryptographicAttestation:false,...publicHandoffAuthority};}
async function main(){
 const [operation,...args]=process.argv.slice(2);
 if(operation==='prepare'&&(args.length===6||args.length===8)){
  const protectedDirectories=protect(args[0]),output=preparePrivateEvidenceOutput(args[5],protectedDirectories);
  try{
   const {model,fresh}=await modules(),taskInput=input(args[1],model.contributionLimits.responseBytes,protectedDirectories),claimInput=input(args[2],model.contributionLimits.responseBytes,protectedDirectories),contextInput=input(args[3],publicHandoffLimits.contextBytes,protectedDirectories),reportInput=input(args[4],publicHandoffLimits.reportBytes,protectedDirectories),preparedAt=new Date().toISOString();
   const task=model.contributionGetSchema.parse(taskInput.raw).item,claimPage=model.contributionClaimGetSchema.parse(claimInput.raw);if(JSON.stringify(task)!==JSON.stringify(claimPage.task))throw Error();
   const context=parsePublicContributionContext(contextInput.raw),report=validateLocalContributionReport(reportInput.raw,context,preparedAt);
   let ci=null,publicPolicy=null,publicCiReceipt=null,ciAssessment={status:'UNAVAILABLE',reason:'NOT_COLLECTED',correlation:null,collection:'NOT_COLLECTED',currentness:'NOT_RECHECKED',cryptographicAttestation:false};
   if(args.length===8){const policyInput=input(args[6],32768,protectedDirectories),receiptInput=input(args[7],publicHandoffLimits.artifactBytes,protectedDirectories),policy=parseContributionPolicy(policyInput.raw),receipt=receiptInput.raw,evidence=parseContributionEvidence(receipt.evidence),correlation=validateContributionEvidence(policy,evidence);ci={policy,receipt};publicPolicy=policyInput.fileDigest;publicCiReceipt=receiptInput.fileDigest;ciAssessment={status:correlation.status,reason:correlation.reason,correlation,collection:'OFFLINE_UNAUTHENTICATED_SNAPSHOT',currentness:'NOT_RECHECKED',cryptographicAttestation:false};}
   const record=await normalizePublicContributionHandoff(model,{version:1,kind:'PUBLIC_CONTRIBUTION_HANDOFF',preparedAt,task,claim:claimPage.item,context,localReport:report,inputFileDigests:{taskSnapshot:taskInput.fileDigest,claimSnapshot:claimInput.fileDigest,context:contextInput.fileDigest,localReport:reportInput.fileDigest,publicPolicy,publicCiReceipt},ci,localAssessment:assessLocalContributionReport(report,ci?.policy),ciAssessment,classification:'AUTHOR_REPORTED',qualification:'NONE',publicSnapshots:'LOCAL_UNAUTHENTICATED_SNAPSHOTS',reviewContext:'OPERATOR_DECLARED_NOT_VERIFIED',issueMapping:'OPERATOR_DECLARED_NOT_VERIFIED',...publicHandoffAuthority});
   const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');if(bytes.length>publicHandoffLimits.artifactBytes)throw Error();fresh();output.write(record);
   try{fresh();const retained=readPrivateHandoffFile(args[5],publicHandoffLimits.artifactBytes,protectedDirectories);if(retained!==bytes.toString('utf8'))throw Error();}catch{throw new PrivateEvidenceOutputError(true);}
   process.stdout.write(JSON.stringify(summary('PUBLIC_CONTRIBUTION_HANDOFF_PREPARED',publicHandoffHash(bytes),record))+'\n');return 0;
  }finally{output.close();}
 }
 if(operation==='verify'&&args.length===3&&hash.test(args[2])){const protectedDirectories=protect(args[0]),{model,fresh}=await modules(),file=input(args[1],publicHandoffLimits.artifactBytes,protectedDirectories);if(file.fileDigest!==args[2])throw Error();const record=await normalizePublicContributionHandoff(model,file.raw);fresh();process.stdout.write(JSON.stringify(summary('PUBLIC_CONTRIBUTION_HANDOFF_VERIFIED',file.fileDigest,record))+'\n');return 0;}
 process.stderr.write('Usage: contribution-public-handoff.mjs prepare WORKING_CHECKOUT TASK_SNAPSHOT CLAIM_SNAPSHOT PUBLIC_CONTEXT LOCAL_CHECK_REPORT NEW_PUBLIC_HANDOFF [PUBLIC_POLICY PUBLIC_CI_EVIDENCE] | verify WORKING_CHECKOUT PUBLIC_HANDOFF EXPECTED_FILE_SHA256\n');return 1;
}
try{process.exitCode=await main();}catch(error){const reason=error instanceof PrivateEvidenceOutputError?error.code:'PUBLIC_HANDOFF_NOT_CONFIRMED';process.stderr.write(reason+'\n');process.exitCode=controller.signal.aborted?130:1;}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);if(temporary)rmSync(temporary,{recursive:true,force:true});}
