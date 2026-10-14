import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let m,directory,base;
const uid=()=>crypto.randomUUID(),at='2026-10-14T05:00:00.000Z';
const human=n=>({kind:'HUMAN',id:'human_'+String(n).repeat(64),sponsorId:'human_'+String(n).repeat(64)});
const agent=n=>({kind:'AGENT',id:uid(),sponsorId:human(n).id});
const ref=item=>({id:item.id,digest:item.digest});
const descriptor=item=>({...ref(item),author:item.author});
before(async()=>{
 const result=await build({stdin:{contents:"import * as profile from './app/agent-work-profile-model';import * as review from './app/experiment-review-model';import * as experiment from './app/experiment-model';import * as strategy from './app/strategy-model';import * as demo from './app/demo-model';import * as comparison from './app/evaluator-comparison';import {replayDemo} from './app/demo-engine';export {profile,review,experiment,strategy,demo,comparison,replayDemo};",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-agent-work-model-'));const target=join(directory,'local-fixture.mjs');writeFileSync(target,result.outputFiles[0].text,{flag:'wx',mode:0o600});m=await import(pathToFileURL(target).href);base=await fixture();
});
after(()=>directory&&rmSync(directory,{recursive:true,force:true}));
async function project(record,source,parent=null){
 const checked=m.experiment.boundedExperimentRecord(record);return {id:record.id,digest:await m.experiment.experimentDigest(checked.payload),type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:m.experiment.experimentAuthorReference(record.author),strategy:ref(source),manifest:parent?ref(parent):null,state:'VISIBLE',reason:null,suppression:null,reporting:'AUTHOR_REPORTED',outcomeCount:record.type==='MANIFEST'?2:0,record:checked.record,moderation:[]};
}
async function outcome(f,author,artifact,conflict=false){
 const claim={type:conflict?'CONFLICTING':'REPRODUCTION',relation:{type:conflict?'CONFLICTS':'SUPPORTS',...ref(f.original)},sharedDependencies:[],conflicts:''};
 const recordAuthor=author.kind==='AGENT'?{...author,name:'Synthetic local reproduction agent'}:author;
 return project({version:1,id:uid(),requestId:uid(),createdAt:'2026-10-14T04:02:00.000Z',author:recordAuthor,type:'OUTCOME',content:{name:'Synthetic checked reproduction',manifest:ref(f.manifest),result:{kind:'ARTIFACT',artifact},claim},flags:m.experiment.experimentOutcomeFlags(author,f.manifest.author,claim),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},f.strategy,f.manifest);
}
async function reviewItem(f,{previous=null,decision='REPRODUCED',reproduction=f.reproduction,createdAt='2026-10-14T04:03:00.000Z'}={}){
 const evidence=decision==='HELD'||decision==='REJECTED'?null:{original:await m.comparison.compareDemoArtifact(f.artifact),reproduction:await m.comparison.compareDemoArtifact(reproduction.record.content.result.artifact)};
 const command={action:'review',id:uid(),requestId:uid(),target:{original:ref(f.original),reproduction:ref(reproduction),manifest:ref(f.manifest),strategy:ref(f.strategy)},previous:previous?ref(previous):null,decision,reasons:[decision==='REPRODUCED'?'COMPUTATION_MATCH':decision==='DISPUTED'?'COMPUTATION_MISMATCH':'INCOMPLETE_EVIDENCE'],evidence,attestations:{fixedCode:true,exactInputs:true,inspectedDifferences:true,separateOriginalAndReproductionProcesses:true},sharedDependencies:[...m.review.experimentReviewSharedDependencies],otherConflicts:'Synthetic operator; operational independence is not established.',note:'Invented local model test; no genuine contributor.',policyAccepted:'public-experiment-review-v1'};
 await m.review.validateExperimentReviewBindings(command,{original:f.original,reproduction,manifest:f.manifest,strategy:f.strategy},human(5),createdAt);
 const checked=m.review.boundedExperimentReviewRecord({version:1,id:command.id,requestId:command.requestId,createdAt,author:human(5),sequence:previous?previous.sequence+1:1,content:m.review.experimentReviewContent(command),policyAccepted:command.policyAccepted,classification:'REVIEW_ATTESTATION',executionAssurance:'TRUSTED_HUMAN_ATTESTATION',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false});
 const item={id:command.id,digest:await m.strategy.strategyDigest(checked.payload),requestId:command.requestId,createdAt,author:human(5),sequence:checked.record.sequence,target:command.target,previous:command.previous,state:'VISIBLE',reason:null,suppression:null,decision,record:checked.record,moderation:[]};
 return m.review.validateExperimentReviewItem(item);
}
async function fixture(){
 const input=JSON.parse(readFileSync('examples/experiments/signal-input.json','utf8')),record=input.strategy.record;
 Object.assign(record,{id:uid(),rootId:null,revision:1,requestId:uid(),createdAt:'2026-10-14T03:00:00.000Z',author:human(1)});record.rootId=record.id;record.content.relation=null;
 const checked=m.strategy.boundedStrategyRecord(record);input.strategy={record:checked.record,digest:await m.strategy.strategyDigest(checked.payload)};input.requestId=uid();
 const source={id:record.id,digest:input.strategy.digest,rootId:record.id,revision:1,requestId:record.requestId,createdAt:record.createdAt,author:human(1),state:'VISIBLE',reason:null,record:checked.record,moderation:[]};
 const artifact=await m.replayDemo(input),defaults=m.experiment.experimentRegisterDefaults(input);
 defaults.disclosures={...defaults.disclosures,search:{trialCount:1,selection:'FIRST_DECLARED',logCompleteness:'COMPLETE',log:'One invented test, not an externally complete search.'},validation:{trainEvaluationOverlap:'NONE',holdoutDeclared:true,holdoutPriorAccess:'UNSEEN',holdoutReuseCount:0,note:'Synthetic declarations; actual unseen custody is not established.'}};
 const manifest=await project({version:1,id:uid(),requestId:uid(),createdAt:'2026-10-14T04:00:00.000Z',author:human(2),type:'MANIFEST',content:defaults,flags:m.experiment.experimentManifestFlags(defaults.disclosures),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},source);
 const claim={type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''};
 const original=await project({version:1,id:uid(),requestId:uid(),createdAt:'2026-10-14T04:01:00.000Z',author:human(3),type:'OUTCOME',content:{name:'Synthetic loss retained',manifest:ref(manifest),result:{kind:'ARTIFACT',artifact},claim},flags:m.experiment.experimentOutcomeFlags(human(3),manifest.author,claim),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},source,manifest);
 const f={strategy:source,manifest,original,artifact,subject:agent(4)};f.reproduction=await outcome(f,f.subject,structuredClone(artifact));f.first=await reviewItem(f);return f;
}
function input(f=base,history=[f.first],reproduction=f.reproduction){return {original:descriptor(f.original),reproduction:{...descriptor(reproduction),claim:reproduction.record.content.claim},manifest:{...descriptor(f.manifest),version:f.manifest.record.version,flags:f.manifest.record.flags},strategy:descriptor(f.strategy),dependencyAuthors:[f.strategy.author],currentHead:{...ref(history.at(-1)),sequence:history.at(-1).sequence},history};}
function profile(unit=input(),subject=base.subject){return m.profile.createAgentWorkProfile(subject,at,[unit]);}
function suppressed(item,{withdraw=false,source=false}={}){
 if(source)return {...item,state:'HIDDEN',suppression:'SOURCE_UNAVAILABLE',decision:null,record:null};
 const event={sequence:1,requestId:uid(),createdAt:'2026-10-14T04:10:00.000Z',actor:human(5),state:withdraw?'WITHDRAWN':'HIDDEN',reason:withdraw?'AUTHOR_REQUEST':'POLICY'};
 return {...item,state:event.state,reason:event.reason,decision:null,record:null,moderation:[event]};
}

test('actual fee-bearing replay and paired comparisons produce one nonzero attributed unit without qualifying performance',()=>{
 assert(base.artifact.metrics.returnPct<0);assert(base.artifact.metrics.totalFees>0);const unit=input(),original=JSON.stringify(unit),result=profile(unit);
 assert.equal(result.counts.attested,1);assert.equal(result.units[0].status,'ATTESTED');assert.deepEqual(result.units[0].reproduction,ref(base.reproduction));assert.equal(result.qualification,'NONE');assert.equal(result.independence,'NOT_ESTABLISHED');assert.equal(result.ordersEnabled,false);assert.equal(JSON.stringify(unit),original);
 assert(!JSON.stringify(result).includes('netPnl'));assert(!JSON.stringify(result).includes('evidence'));assert.equal(m.profile.createAgentWorkProfile(base.subject,at,[]).counts.attested,0);
});
test('same sponsors, self-review, wrong subject, leaked selection and forged lineage cannot obtain attested support',()=>{
 for(const mutate of [u=>u.original.author=base.subject,u=>u.dependencyAuthors=[base.strategy.author,human(5)],u=>u.reproduction.claim.relation.digest='0'.repeat(64),u=>u.manifest.flags.push('HOLDOUT_REUSED'),u=>u.manifest.version=2,u=>u.manifest.version=3,u=>u.manifest.version=4,u=>u.original.digest='0'.repeat(64),u=>u.authenticated=true]){const unit=structuredClone(input());mutate(unit);assert.throws(()=>profile(unit));}
 assert.throws(()=>profile(input(),agent(6)));assert.throws(()=>m.profile.createAgentWorkProfile({...base.subject,reviewer:true},at,[input()]));
});
test('retained heads replace positive support with real disagreement or held and rejected decisions',async()=>{
 const held=await reviewItem(base,{previous:base.first,decision:'HELD',createdAt:'2026-10-14T04:04:00.000Z'});const rejected=await reviewItem(base,{previous:held,decision:'REJECTED',createdAt:'2026-10-14T04:05:00.000Z'});
 assert.equal(profile(input(base,[base.first,held])).counts.held,1);const rejectedProfile=profile(input(base,[base.first,held,rejected]));assert.equal(rejectedProfile.counts.attested,0);assert.equal(rejectedProfile.counts.rejected,1);assert.equal(rejectedProfile.units[0].history.length,3);
 const falseArtifact=structuredClone(base.artifact);falseArtifact.metrics.netPnl+=5;falseArtifact.resultDigest=await m.demo.demoArtifactDigest(falseArtifact);
 const conflicting=await outcome(base,base.subject,falseArtifact,true),disputed=await reviewItem(base,{previous:base.first,decision:'DISPUTED',reproduction:conflicting,createdAt:'2026-10-14T04:06:00.000Z'});
 assert.equal(disputed.record.content.evidence.reproduction.status,'MISMATCH');const result=profile(input(base,[base.first,disputed],conflicting));assert.equal(result.counts.disputed,1);assert.equal(result.counts.attested,0);assert.deepEqual(result.units[0].reproduction,ref(conflicting));
});
test('another subject supersedes earlier work without transferring or duplicating attribution',async()=>{
 const subject=agent(6),reproduction=await outcome(base,subject,structuredClone(base.artifact)),second=await reviewItem(base,{previous:base.first,reproduction,createdAt:'2026-10-14T04:04:00.000Z'}),history=[base.first,second];
 assert.equal(profile(input(base,history)).counts.superseded,1);assert.equal(profile(input(base,history,reproduction),subject).counts.attested,1);
 assert.equal(profile(input(base,[suppressed(base.first),second])).counts.total,0);
 assert.equal(profile(input(base,[suppressed(base.first),second],reproduction),subject).counts.attested,1);
 assert.throws(()=>m.profile.createAgentWorkProfile(base.subject,at,[input(),input()]));const missing=structuredClone(input(base,history));missing.history.shift();assert.throws(()=>profile(missing));
 const wrong=structuredClone(input());wrong.currentHead.digest='0'.repeat(64);assert.throws(()=>profile(wrong));
});
test('hidden, withdrawn or dependency-suppressed newest heads never expose an older positive or hidden-work total',async()=>{
 const second=await reviewItem(base,{previous:base.first,decision:'HELD',createdAt:'2026-10-14T04:04:00.000Z'});
 for(const hidden of [suppressed(second),suppressed(second,{withdraw:true}),suppressed(second,{source:true})]){const result=profile(input(base,[base.first,hidden]));assert.deepEqual(result.units,[]);assert.equal(result.counts.total,0);assert(!JSON.stringify(result).includes(base.first.id));assert(!JSON.stringify(result).includes('suppressed'));}
 const hidden=suppressed(second),restored={...second,reason:'RESTORED',moderation:[...hidden.moderation,{sequence:2,requestId:uid(),createdAt:'2026-10-14T04:11:00.000Z',actor:human(5),state:'VISIBLE',reason:'RESTORED'}]};
 assert.equal(profile(input(base,[base.first,restored])).counts.held,1);
});
test('profile schemas refuse manufactured scores, misleading totals, future observations and output accessors',()=>{
 const result=profile();assert.throws(()=>m.profile.agentWorkProfileSchema.parse({...result,score:100}));assert.throws(()=>m.profile.agentWorkProfileSchema.parse({...result,counts:{...result.counts,attested:0}}));assert.throws(()=>m.profile.createAgentWorkProfile(base.subject,'2026-10-14T04:02:00.000Z',[input()]));
 let invoked=0;const raw=structuredClone(result);Object.defineProperty(raw,'score',{enumerable:true,get(){invoked++;return 100;}});assert.throws(()=>m.profile.boundedAgentWorkProfile(raw));assert.equal(invoked,0);
 const decorated=structuredClone(result);decorated.units.extra='discarded';assert.throws(()=>m.profile.boundedAgentWorkProfile(decorated));
});
test('whole profile count and byte ceilings refuse overflow rather than returning favourable partial work',()=>{
 assert.throws(()=>m.profile.createAgentWorkProfile(base.subject,at,Array.from({length:65},()=>input())));
 const result=profile(),raw=structuredClone(result);raw.units=Array.from({length:64},()=>{const unit=structuredClone(result.units[0]);unit.original.id=uid();const later=structuredClone(unit.history[0]);later.sequence=2;later.review={id:uid(),digest:'a'.repeat(64)};unit.history.push(later);unit.currentHead={...later.review,sequence:2};unit.history.forEach(item=>item.otherConflicts='x'.repeat(1500));return unit;});
 assert(Buffer.byteLength(JSON.stringify(raw),'utf8')>m.profile.agentWorkProfileLimits.responseBytes);assert.throws(()=>m.profile.boundedAgentWorkProfile(raw),error=>error.status===413);assert.equal(result.counts.total,1);
});
