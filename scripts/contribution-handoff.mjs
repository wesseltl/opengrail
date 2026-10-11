#!/usr/bin/env node
import {readFileSync,mkdtempSync,writeFileSync,rmSync,realpathSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {z} from 'zod';
import {parseContributionJson,parseContributionPolicy,parseContributionEvidence,validateContributionEvidence} from './contribution-evidence-core.mjs';
import {preparePrivateEvidenceOutput,PrivateEvidenceOutputError} from './contribution-private-credential.mjs';
import {readPrivateHandoffFile} from './contribution-handoff-files.mjs';

const project=fileURLToPath(new URL('../',import.meta.url)),maximum=1048576;
const sha=value=>createHash('sha256').update(value).digest('hex'),hash=z.string().regex(/^[a-f0-9]{64}$/),clock=z.string().datetime().refine(value=>new Date(value).toISOString()===value);
const ciReceiptSchema=z.object({version:z.literal(1),kind:z.literal('PRIVATE_GITHUB_CI_EVIDENCE'),collection:z.literal('PRIVATE_GITHUB_API_READ'),cryptographicAttestation:z.literal(false),policyDigest:hash,evidence:z.unknown(),result:z.unknown(),readStatistics:z.object({requests:z.number().int().min(0).max(32),bytes:z.number().int().min(0).max(4194304)}).strict(),reason:z.string().regex(/^[A-Z0-9_]{1,80}$/).nullable()}).strict();
const handoffSchema=z.object({version:z.literal(1),kind:z.literal('PRIVATE_CONTRIBUTION_HANDOFF'),preparedAt:clock,task:z.unknown(),claim:z.unknown(),policy:z.unknown(),ciReceipt:z.unknown(),ciReceiptFileSha256:hash,ciAssessment:z.unknown(),classification:z.literal('AUTHOR_REPORTED'),publicSnapshots:z.literal('LOCAL_UNAUTHENTICATED_SNAPSHOTS'),ciSnapshot:z.literal('OFFLINE_UNAUTHENTICATED_SNAPSHOT'),currentness:z.literal('NOT_RECHECKED'),privateIssueMapping:z.literal('OPERATOR_DECLARED_NOT_VERIFIED'),repositoryAccessGranted:z.literal(false),taskCompletionVerified:z.literal(false),merged:z.literal(false),reputationAwarded:z.literal(false),published:z.literal(false),executionEnabled:z.literal(false),ordersEnabled:z.literal(false),liveEnabled:z.literal(false)}).strict();
let temporary,protectedDirectories=[];
const controller=new AbortController(),stop=()=>controller.abort();
process.on('SIGINT',stop);process.on('SIGTERM',stop);

// Only fixed, reviewed first-party model code is bundled. No input file can
// choose an import, dependency, provider endpoint or command to execute.
async function modules(){
 const settings={stdin:{contents:"export * from './app/contribution-model';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true};
 const discovery=await build(settings),inputs=Object.keys(discovery.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name));
 const sources=new Map(inputs.map(path=>[path,sha(readFileSync(path))])),output=await build(settings);
 if(JSON.stringify(Object.keys(output.metafile.inputs).filter(name=>name!=='<stdin>').map(name=>resolve(project,name)))!==JSON.stringify(inputs))throw Error();
 temporary=mkdtempSync(join(tmpdir(),'opengrail-contribution-handoff-'));const path=join(temporary,'fixed-model.mjs');writeFileSync(path,output.outputFiles[0].text,{flag:'wx',mode:0o600});
 const model=await import(pathToFileURL(path).href);
 function fresh(){if(controller.signal.aborted)throw Error();for(const [file,digest] of sources)if(sha(readFileSync(file))!==digest)throw Error();}
 fresh();return {model,fresh};
}
function input(path,cap=maximum){const source=readPrivateHandoffFile(path,cap,protectedDirectories);return {raw:parseContributionJson(source,cap),fileDigest:sha(Buffer.from(source))};}
function protectWorkingCheckout(path){
 if(typeof path!=='string'||path.length>4096||path.includes('\0')||resolve(path)!==path||realpathSync(path)!==path||!lstatSync(path).isDirectory())throw Error();
 // Explicitly declared by the operator, not proof of checkout identity/isolation.
 protectedDirectories=[path];
}
async function normalize(model,raw){
 const original=handoffSchema.parse(raw),task=await model.validateContributionTaskItem(original.task),claim=await model.validateContributionClaimItem(original.claim),policy=parseContributionPolicy(original.policy),ciReceipt=ciReceiptSchema.parse(original.ciReceipt),evidence=parseContributionEvidence(ciReceipt.evidence);
 if(policy.version!==2||ciReceipt.policyDigest!==sha(JSON.stringify(policy))||JSON.stringify(claim.task)!==JSON.stringify({id:task.id,digest:task.digest})||task.state!=='OPEN'||claim.taskState!=='OPEN'||claim.status!=='ACTIVE'||claim.sequence!==0||!task.record||!claim.record||claim.checkedAt>original.preparedAt||claim.createdAt>original.preparedAt||original.preparedAt>=claim.expiresAt||Date.parse(evidence.collectedAt)>Date.parse(original.preparedAt))throw Error();
 const assessment=validateContributionEvidence(policy,evidence);
 if(JSON.stringify(original.ciAssessment)!==JSON.stringify(assessment))throw Error();
 return handoffSchema.parse({...original,task,claim,policy,ciReceipt:{...ciReceipt,evidence},ciAssessment:assessment});
}
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function main(){
 const [operation,...args]=process.argv.slice(2);
 if(operation==='prepare'&&args.length===6){
  protectWorkingCheckout(args.shift());
  const output=preparePrivateEvidenceOutput(args[4],protectedDirectories);
  try{
   const {model,fresh}=await modules(),taskInput=input(args[0],model.contributionLimits.responseBytes),claimInput=input(args[1],model.contributionLimits.responseBytes),policyInput=input(args[2],32768),ciInput=input(args[3]);
   const task=model.contributionGetSchema.parse(taskInput.raw).item,claimPage=model.contributionClaimGetSchema.parse(claimInput.raw);
   if(JSON.stringify(task)!==JSON.stringify(claimPage.task))throw Error();
   const policy=parseContributionPolicy(policyInput.raw),ciReceipt=ciReceiptSchema.parse(ciInput.raw),evidence=parseContributionEvidence(ciReceipt.evidence);
   const record=await normalize(model,{version:1,kind:'PRIVATE_CONTRIBUTION_HANDOFF',preparedAt:new Date().toISOString(),task,claim:claimPage.item,policy,ciReceipt,ciReceiptFileSha256:ciInput.fileDigest,ciAssessment:validateContributionEvidence(policy,evidence),classification:'AUTHOR_REPORTED',publicSnapshots:'LOCAL_UNAUTHENTICATED_SNAPSHOTS',ciSnapshot:'OFFLINE_UNAUTHENTICATED_SNAPSHOT',currentness:'NOT_RECHECKED',privateIssueMapping:'OPERATOR_DECLARED_NOT_VERIFIED',repositoryAccessGranted:false,taskCompletionVerified:false,merged:false,reputationAwarded:false,published:false,executionEnabled:false,ordersEnabled:false,liveEnabled:false});
   const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');if(bytes.length>maximum)throw Error();fresh();output.write(record);
   emit({kind:'PRIVATE_CONTRIBUTION_HANDOFF_PREPARED',handoffDigest:sha(bytes),ciStatus:record.ciAssessment.status,ciSnapshot:record.ciSnapshot,currentness:record.currentness,published:false,ordersEnabled:false,liveEnabled:false});return 0;
  }finally{output.close();}
 }
 if(operation==='verify'&&args.length===3&&hash.safeParse(args[2]).success){
  protectWorkingCheckout(args.shift());
  const {model,fresh}=await modules(),file=input(args[0]);if(file.fileDigest!==args[1])throw Error();const record=await normalize(model,file.raw);fresh();
  emit({kind:'PRIVATE_CONTRIBUTION_HANDOFF_VERIFIED',handoffDigest:file.fileDigest,ciStatus:record.ciAssessment.status,ciSnapshot:record.ciSnapshot,currentness:record.currentness,cryptographicAttestation:false,published:false,ordersEnabled:false,liveEnabled:false});return 0;
 }
 process.stderr.write('Usage: contribution-handoff.mjs prepare WORKING_CHECKOUT TASK_SNAPSHOT CLAIM_SNAPSHOT PRIVATE_POLICY PRIVATE_CI_EVIDENCE NEW_PRIVATE_HANDOFF | verify WORKING_CHECKOUT PRIVATE_HANDOFF EXPECTED_DIGEST\n');return 1;
}
try{process.exitCode=await main();}
catch(error){const reason=error instanceof PrivateEvidenceOutputError?error.code:'PRIVATE_HANDOFF_NOT_CONFIRMED';process.stderr.write(reason+'\n');process.exitCode=controller.signal.aborted?130:1;}
finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);if(temporary)rmSync(temporary,{recursive:true,force:true});}
