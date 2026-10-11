import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let review,experiment,strategy,demo,comparison,journal,session,pureInputs,directory;
const uid=()=>crypto.randomUUID(),at='2026-10-11T10:00:00.000Z';
const human=n=>({kind:'HUMAN',id:'human_'+String(n).repeat(64),sponsorId:'human_'+String(n).repeat(64)});
const ref=item=>({id:item.id,digest:item.digest});
const file=name=>JSON.parse(readFileSync('examples/'+name,'utf8'));
before(async()=>{
 const pure=await build({entryPoints:['app/experiment-review-model.ts'],bundle:true,write:false,metafile:true,format:'esm',platform:'node',target:'es2022'});pureInputs=Object.keys(pure.metafile.inputs);
 const result=await build({stdin:{contents:"import * as review from './app/experiment-review-model';import * as experiment from './app/experiment-model';import * as strategy from './app/strategy-model';import * as demo from './app/demo-model';import * as comparison from './app/evaluator-comparison';import {replayDemo} from './app/demo-engine';import * as journal from './app/session-journal';import {snapshotSessionEvidence} from './app/session-evidence';export {review,experiment,strategy,demo,comparison,replayDemo,journal,snapshotSessionEvidence};",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-review-model-'));const target=join(directory,'synthetic-fixture.mjs');writeFileSync(target,result.outputFiles[0].text,{flag:'wx'});const m=await import(pathToFileURL(target).href);
 ({review,experiment,strategy,demo,comparison,journal}=m);demo={...demo,replayDemo:m.replayDemo};session=m.snapshotSessionEvidence;
});
after(()=>directory&&rmSync(directory,{recursive:true,force:true}));
async function sourceAndInput(name='signal-input.json'){
 const input=file('experiments/'+name),record=input.strategy.record;
 record.id=uid();record.rootId=record.id;record.revision=1;record.requestId=uid();record.createdAt='2026-10-11T08:00:00.000Z';record.author=human(1);record.content.relation=null;
 const canonical=strategy.boundedStrategyRecord(record);input.strategy={record:canonical.record,digest:await strategy.strategyDigest(canonical.payload)};
 input.requestId=uid();
 const source={id:record.id,digest:input.strategy.digest,rootId:record.rootId,revision:1,requestId:record.requestId,createdAt:record.createdAt,author:human(1),state:'VISIBLE',reason:null,record:canonical.record,moderation:[]};
 return {source,input:demo.boundedDemoRequest(input).input};
}
function disclosures(defaults){return {...defaults,search:{trialCount:1,selection:'FIRST_DECLARED',logCompleteness:'COMPLETE',log:'One invented admitted test; no externally complete search is asserted.'},validation:{trainEvaluationOverlap:'NONE',holdoutDeclared:true,holdoutPriorAccess:'UNSEEN',holdoutReuseCount:0,note:'Synthetic declaration; unseen provenance remains unverified.'}};}
async function project(record,source,parent=null){
 const canonical=experiment.boundedExperimentRecord(record),digest=await experiment.experimentDigest(canonical.payload);
 return {id:record.id,digest,type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:record.author,strategy:ref(source),manifest:parent?ref(parent):null,state:'VISIBLE',reason:null,suppression:null,reporting:record.type==='MANIFEST'?'AUTHOR_REPORTED':'AUTHOR_REPORTED',outcomeCount:record.type==='MANIFEST'?2:0,record:canonical.record,moderation:[]};
}
async function outcome(parent,source,result,author,claim,createdAt){return project({version:parent.record.version,id:uid(),requestId:uid(),createdAt,author,type:'OUTCOME',content:{...parent.record.version===2?{method:'CONTINUOUS_DEMO'}:{},name:'Synthetic retained outcome',manifest:ref(parent),result,claim},flags:experiment.experimentOutcomeFlags(author,parent.author,claim),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},source,parent);}
async function fixture({name='signal-input.json',conflict=false,continuous=false}={}){
 const {source,input}=await sourceAndInput(name);let defaults,artifact;
 if(continuous){
  const config={version:1,sessionId:uid(),methodVersion:'opengrail-session-v1',clockMode:'SYNTHETIC_PLAYBACK',origin:'PUBLIC_STRATEGY',strategy:{record:source.record,digest:source.digest},initialCapital:1000,provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented local public fixture.'},sourceLabel:'Invented local observations',ordersEnabled:false,liveEnabled:false};
  const tape=await journal.createSessionJournal(config,'2026-10-11T08:30:00.000Z');
  const bundle=await session(tape,{hypothesis:'Invented retrospective test.',falsification:'Reject inconsistent transitions.'});assert.equal(bundle.result.kind,'ARTIFACT');artifact=bundle.result.artifact;
  defaults=experiment.experimentContinuousRegisterDefaults(bundle.input,'Synthetic source declaration');
 }else{defaults=experiment.experimentRegisterDefaults(input);artifact=await demo.replayDemo(input);}
 defaults.disclosures=disclosures(defaults.disclosures);
 const manifest=await project({version:continuous?2:1,id:uid(),requestId:uid(),createdAt:'2026-10-11T09:00:00.000Z',author:human(2),type:'MANIFEST',content:defaults,flags:experiment.experimentManifestFlags(defaults.disclosures),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},source);
 const original=await outcome(manifest,source,{kind:'ARTIFACT',artifact},human(3),{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},'2026-10-11T09:01:00.000Z');
 const secondArtifact=structuredClone(artifact);
 if(conflict){secondArtifact.metrics.netPnl+=5;secondArtifact.resultDigest=await demo.demoArtifactDigest(secondArtifact);}
 const reproduction=await outcome(manifest,source,{kind:'ARTIFACT',artifact:secondArtifact},human(4),{type:conflict?'CONFLICTING':'REPRODUCTION',relation:{type:conflict?'CONFLICTS':'SUPPORTS',...ref(original)},sharedDependencies:[],conflicts:''},'2026-10-11T09:02:00.000Z');
 const evidence=continuous?null:{original:await comparison.compareDemoArtifact(artifact),reproduction:await comparison.compareDemoArtifact(secondArtifact)};
 const command={action:'review',requestId:uid(),id:uid(),target:{original:ref(original),reproduction:ref(reproduction),manifest:ref(manifest),strategy:ref(source)},previous:null,decision:continuous?'HELD':conflict?'DISPUTED':'REPRODUCED',reasons:[continuous?'UNSUPPORTED_METHOD':conflict?'COMPUTATION_MISMATCH':'COMPUTATION_MATCH'],evidence,attestations:{fixedCode:!continuous,exactInputs:!continuous,inspectedDifferences:!continuous,separateOriginalAndReproductionProcesses:!continuous},sharedDependencies:[...review.experimentReviewSharedDependencies],otherConflicts:'',note:'Synthetic trusted-human computational attestation; no independently qualified performance.',policyAccepted:'public-experiment-review-v1'};
 return {command,references:{original,reproduction,manifest,strategy:source},reviewer:human(5)};
}
async function resealReport(report){const {reportDigest,...body}=report;void reportDigest;return {...body,reportDigest:await strategy.strategyDigest(JSON.stringify(body))};}
async function replaceRecord(item,patch){const record={...item.record,...patch},canonical=experiment.boundedExperimentRecord(record);return {...item,record:canonical.record,digest:await experiment.experimentDigest(canonical.payload),author:record.author,createdAt:record.createdAt,manifest:record.type==='OUTCOME'?record.content.manifest:null};}
function held(command,reasons=['INCOMPLETE_EVIDENCE']){return {...command,decision:'HELD',reasons,evidence:null};}
async function bind(f,command=f.command,references=f.references,reviewer=f.reviewer,clock=at){return review.validateExperimentReviewBindings(command,references,reviewer,clock);}
const bad400=error=>error?.status===400;

test('pure review and comparison admission imports no evaluator, journal, provider or execution module',()=>{assert(!pureInputs.some(file=>/(?:demo-engine|reference-engine|session-engine|session-journal|session-evidence)\.ts$/.test(file)));});

test('legacy A/B reports retain exact canonical bytes and engine identities after pure extraction',async()=>{
 for(const [artifact,golden] of [['signal-author-artifact','negative-reconstructed'],['insolvency-artifact','insolvency-reconstructed'],['signal-conflicting-artifact','false-claim-disagreement']]){
  const raw=artifact==='signal-conflicting-artifact'?file('experiments/signal-conflicting-outcome.json').item.record.content.result.artifact:file('experiments/'+artifact+'.json'),expected=file('comparisons/'+golden+'.json'),actual=await comparison.compareDemoArtifact(raw);
  assert.equal(JSON.stringify(actual),JSON.stringify(expected));assert.equal(await comparison.verifyComparisonReport(expected).then(v=>v.reportDigest),expected.reportDigest);
 }
});

test('two exact negative and insolvency reports can receive a computational reproduction with no qualification',async()=>{
 for(const name of ['signal-input.json','insolvency-input.json']){
  const f=await fixture({name});await bind(f);assert.equal(f.command.evidence.original.status,'MATCH');assert(f.command.evidence.original.summaries.claimed.metrics.netPnl<0);
  const record=review.boundedExperimentReviewRecord({version:1,id:f.command.id,requestId:f.command.requestId,createdAt:at,author:f.reviewer,sequence:1,content:review.experimentReviewContent(f.command),policyAccepted:f.command.policyAccepted,classification:'REVIEW_ATTESTATION',executionAssurance:'TRUSTED_HUMAN_ATTESTATION',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false}).record;
  assert.equal(record.qualification,'NONE');assert.equal(record.independence,'NOT_ESTABLISHED');assert.deepEqual(review.experimentReviewCommandForRecord(record),f.command);
 }
});

test('real conflicting retained claims preserve actual mismatches under DISPUTED',async()=>{const f=await fixture({conflict:true});assert.equal(f.command.evidence.reproduction.status,'MISMATCH');assert(f.command.evidence.reproduction.pairs.some(pair=>pair.differenceCount>0));await bind(f);await assert.rejects(()=>bind(f,{...f.command,decision:'REPRODUCED',reasons:['COMPUTATION_MATCH']}));});

test('self-hashed recorded differences cannot substitute claim operands, semantic paths or duplicated discrepancies',async()=>{
 const f=await fixture({conflict:true});
 for(const mutate of [report=>report.pairs[0].differences[0].left+=1,report=>report.pairs[0].differences[0].path='equity[99999999].cash',report=>{report.pairs[0].differences.push(structuredClone(report.pairs[0].differences[0]));report.pairs[0].differenceCount++;}]){
  const report=structuredClone(f.command.evidence.reproduction);mutate(report);const forged=await resealReport(report);await comparison.verifyComparisonReport(forged);
  await assert.rejects(()=>bind(f,{...f.command,evidence:{...f.command.evidence,reproduction:forged}}),bad400);
 }
});

test('strict commands reject submitted authority and fake qualifications, author roles and missing process attestations',async()=>{
 const f=await fixture();
 for(const patch of [{author:f.reviewer},{reviewer:true},{classification:'REPRODUCED'},{qualification:'INDEPENDENT'},{ordersEnabled:true},{decision:'QUALIFIED'},{reasons:['COMPUTATION_MATCH','COMPUTATION_MATCH']},{attestations:{...f.command.attestations,fixedCode:false}},{attestations:{...f.command.attestations,separateOriginalAndReproductionProcesses:false}}])assert.throws(()=>review.boundedExperimentReviewCommand({...f.command,...patch}));
 await assert.rejects(()=>bind(f,f.command,f.references,{kind:'AGENT',id:uid(),sponsorId:f.reviewer.id}));
});

test('self-hashed fabricated MATCH retains no authority and contradictions in claimed summaries or pairs are rejected',async()=>{
 const f=await fixture(),report=structuredClone(f.command.evidence.original);report.summaries.primary.metrics.netPnl+=20;
 const forged=await resealReport(report);await comparison.verifyComparisonReport(forged); // Identity alone is not proof that code ran.
 await assert.rejects(()=>bind(f,{...f.command,evidence:{...f.command.evidence,original:forged}}),bad400);
 report.summaries.claimed.metrics.netPnl+=30;await assert.rejects(async()=>bind(f,{...f.command,evidence:{...f.command.evidence,original:await resealReport(report)}}),bad400);
 assert.equal(review.experimentReviewPublishSchema.safeParse({...f.command,reviewer:true}).success,false);
});

test('exact artifact, accepted input, method, source pin and target identities cannot be replaced',async()=>{
 const f=await fixture();
 for(const field of ['claimedArtifact','request','strategy','dataset','signals','declaredMethod']){const report=structuredClone(f.command.evidence.original);report.identity[field]='f'.repeat(64);await assert.rejects(async()=>bind(f,{...f.command,evidence:{...f.command.evidence,original:await resealReport(report)}}));}
 const report=structuredClone(f.command.evidence.original);report.implementations.primary.sourceSha256='f'.repeat(64);await assert.rejects(async()=>bind(f,{...f.command,evidence:{...f.command.evidence,original:await resealReport(report)}}));
 for(const name of ['original','reproduction','manifest','strategy'])await assert.rejects(()=>bind(f,{...f.command,target:{...f.command.target,[name]:{...f.command.target[name],digest:'f'.repeat(64)}}}),bad400);
 const altered=structuredClone(f.references.original.record.content.result.artifact);altered.input.initialCapital+=1;const replacement=await demo.replayDemo(altered.input),original=await replaceRecord(f.references.original,{content:{...f.references.original.record.content,result:{kind:'ARTIFACT',artifact:replacement}}});
 await assert.rejects(()=>bind(f,held({...f.command,target:{...f.command.target,original:ref(original)}}),{...f.references,original}),bad400);
});

test('every sponsor separation and supported original/reproduction lineage is enforced',async()=>{
 const f=await fixture();for(const item of Object.values(f.references))await assert.rejects(()=>bind(f,f.command,f.references,{kind:'HUMAN',id:item.author.sponsorId,sponsorId:item.author.sponsorId}),bad400);
 const reproduction=await replaceRecord(f.references.reproduction,{author:f.references.original.author});reproduction.record.flags=experiment.experimentOutcomeFlags(reproduction.author,f.references.manifest.author,reproduction.record.content.claim);reproduction.digest=await experiment.experimentDigest(JSON.stringify(reproduction.record));
 await assert.rejects(()=>bind(f,{...f.command,target:{...f.command.target,reproduction:ref(reproduction)}},{...f.references,reproduction}),bad400);
 const original=await replaceRecord(f.references.original,{content:{...f.references.original.record.content,claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',id:uid(),digest:'a'.repeat(64)},sharedDependencies:[],conflicts:''}}});
 const refreshedPeer=await replaceRecord(f.references.reproduction,{content:{...f.references.reproduction.record.content,claim:{...f.references.reproduction.record.content.claim,relation:{type:'SUPPORTS',...ref(original)}}}});
 await assert.rejects(()=>bind(f,{...f.command,target:{...f.command.target,original:ref(original),reproduction:ref(refreshedPeer)}},{...f.references,original,reproduction:refreshedPeer}),error=>error.status===400&&/must be an original outcome/.test(error.message));
 const wrong=await replaceRecord(f.references.reproduction,{content:{...f.references.reproduction.record.content,claim:{...f.references.reproduction.record.content.claim,relation:{type:'SUPPORTS',id:uid(),digest:'b'.repeat(64)}}}});
 await assert.rejects(()=>bind(f,{...f.command,target:{...f.command.target,reproduction:ref(wrong)}},{...f.references,reproduction:wrong}),bad400);
});

test('blocking bias disclosures prevent positive review while held evidence remains retained',async()=>{
 const changes=[d=>d.search.selection='BEST_OBSERVED',d=>d.search.logCompleteness='PARTIAL',d=>d.validation.trainEvaluationOverlap='PRESENT',d=>d.validation.trainEvaluationOverlap='UNKNOWN',d=>d.validation.holdoutDeclared=false,d=>d.validation.holdoutPriorAccess='SEEN',d=>d.validation.holdoutPriorAccess='UNKNOWN',d=>d.validation.holdoutReuseCount=1];
 for(const change of changes){
  const f=await fixture(),content=structuredClone(f.references.manifest.record.content);change(content.disclosures);
  const manifest=await replaceRecord(f.references.manifest,{content,flags:experiment.experimentManifestFlags(content.disclosures)}),original=await replaceRecord(f.references.original,{content:{...f.references.original.record.content,manifest:ref(manifest)}}),reproduction=await replaceRecord(f.references.reproduction,{content:{...f.references.reproduction.record.content,manifest:ref(manifest),claim:{...f.references.reproduction.record.content.claim,relation:{type:'SUPPORTS',...ref(original)}}}});
  const command={...f.command,target:{...f.command.target,manifest:ref(manifest),original:ref(original),reproduction:ref(reproduction)}},references={...f.references,manifest,original,reproduction};
  await assert.rejects(()=>bind(f,command,references),bad400);await bind(f,held(command,[manifest.record.flags.find(flag=>review.experimentReviewBlockingFlags.includes(flag))]),references);
 }
});

test('continuous evidence may only receive explicit unsupported-method hold without fabricated A/B reports',async()=>{
 const f=await fixture({continuous:true});await bind(f);assert.equal(f.command.evidence,null);
 await assert.rejects(()=>bind(f,{...f.command,reasons:['INCOMPLETE_EVIDENCE']}),bad400);
 await assert.rejects(()=>bind(f,{...f.command,decision:'REJECTED',reasons:['OTHER']}),bad400);
 const batch=await fixture();await assert.rejects(()=>bind(f,{...f.command,evidence:batch.command.evidence}));
});

test('immutable binding can validate suppressed historical bytes while public projection suppresses content',async()=>{
 const f=await fixture(),references=structuredClone(f.references);
 for(const item of Object.values(references)){item.state='HIDDEN';item.reason='POLICY';}
 await bind(f,f.command,references);
 const record=review.boundedExperimentReviewRecord({version:1,id:f.command.id,requestId:f.command.requestId,createdAt:at,author:f.reviewer,sequence:1,content:review.experimentReviewContent(f.command),policyAccepted:f.command.policyAccepted,classification:'REVIEW_ATTESTATION',executionAssurance:'TRUSTED_HUMAN_ATTESTATION',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false}).record;
 const item={id:record.id,digest:await strategy.strategyDigest(JSON.stringify(record)),requestId:record.requestId,createdAt:record.createdAt,author:record.author,sequence:record.sequence,target:record.content.target,previous:null,state:'VISIBLE',reason:null,suppression:null,decision:record.content.decision,record,moderation:[]};await review.validateExperimentReviewItem(item);
 const hidden={...item,state:'HIDDEN',suppression:'OUTCOME_UNAVAILABLE',decision:null,record:null};assert.equal(review.experimentReviewPublicItemSchema.safeParse(hidden).success,true);assert.equal(review.experimentReviewPublicItemSchema.safeParse({...hidden,record}).success,false);assert.equal(review.experimentReviewPublicItemSchema.safeParse({...hidden,decision:'REPRODUCED'}).success,false);
 const {record:ignored,moderation,...metadata}=hidden;void ignored;void moderation;assert.equal(review.experimentReviewSummarySchema.safeParse({...metadata,reasons:[]}).success,true);assert.equal(review.experimentReviewSummarySchema.safeParse({...metadata,reasons:['COMPUTATION_MATCH']}).success,false);
});

test('review sequence/head/page constraints reject ambiguous retained histories',async()=>{
 const f=await fixture(),content=review.experimentReviewContent(f.command),record={version:1,id:f.command.id,requestId:f.command.requestId,createdAt:at,author:f.reviewer,sequence:1,content,policyAccepted:f.command.policyAccepted,classification:'REVIEW_ATTESTATION',executionAssurance:'TRUSTED_HUMAN_ATTESTATION',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false};
 assert.equal(review.experimentReviewRecordSchema.safeParse({...record,sequence:2}).success,false);assert.equal(review.experimentReviewRecordSchema.safeParse({...record,content:{...content,previous:{id:uid(),digest:'a'.repeat(64)}}}).success,false);
 const summary={id:record.id,digest:await strategy.strategyDigest(JSON.stringify(record)),requestId:record.requestId,createdAt:at,author:record.author,sequence:1,target:content.target,previous:null,state:'VISIBLE',reason:null,suppression:null,decision:content.decision,reasons:content.reasons},page={version:1,target:content.target.original,currentHead:{...ref(summary),sequence:1},items:[summary],nextCursor:null,executionEnabled:false};
 assert.equal(review.experimentReviewListSchema.safeParse(page).success,true);for(const patch of [{currentHead:null},{currentHead:{...page.currentHead,digest:'b'.repeat(64)}},{target:{id:uid(),digest:'c'.repeat(64)}},{items:[summary,summary]},{nextCursor:summary.id}])assert.equal(review.experimentReviewListSchema.safeParse({...page,...patch}).success,false);
});

test('local paired draft has exact bounded self-hash but carries no decision, reviewer, permission or publication consent',async()=>{
 const f=await fixture(),body={version:1,kind:'LOCAL_EXPERIMENT_REVIEW_DRAFT',preparedAt:at,target:f.command.target,evidence:f.command.evidence,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',ordersEnabled:false};
 const draft=await review.sealExperimentReviewDraft(body);assert.deepEqual(await review.verifyExperimentReviewDraft(draft),draft);assert.equal(draft.draftDigest,await strategy.strategyDigest(JSON.stringify(body)));
 for(const field of ['reviewer','author','decision','previous','policyAccepted','permission'])await assert.rejects(()=>review.sealExperimentReviewDraft({...body,[field]:true}));
 await assert.rejects(()=>review.verifyExperimentReviewDraft({...draft,preparedAt:'2026-10-11T11:00:00.000Z'}),bad400);
});

test('review material rejects raw oversize, token patterns, controls, getters, custom prototypes and deep JSON',async()=>{
 const f=await fixture();
 for(const value of ['og_agent_secret','%6fg_agent_secret','og_local_owner_secret','og_local_producer_secret','ghp_'+'a'.repeat(40),'github_pat_'+'a'.repeat(90),'bad\u0000note'])assert.throws(()=>review.boundedExperimentReviewCommand({...f.command,note:value}));
 assert.throws(()=>review.boundedExperimentReviewCommand({...f.command,note:' '.repeat(review.experimentReviewLimits.requestBytes)+'ok'}),error=>error.status===413);
 const getter={...f.command};Object.defineProperty(getter,'note',{get(){throw Error('getter executed');}});assert.throws(()=>review.boundedExperimentReviewCommand(getter),bad400);
 assert.throws(()=>review.boundedExperimentReviewCommand(Object.assign(new Date(),f.command)),bad400);assert.throws(()=>review.boundedExperimentReviewCommand({...f.command,toJSON(){throw Error('must not execute');}}),bad400);
 let deep=null;for(let n=0;n<18;n++)deep={deep};assert.throws(()=>review.boundedExperimentReviewCommand({...f.command,deep}),bad400);
 await assert.rejects(()=>bind(f,f.command,f.references,f.reviewer,'2026-10-11T09:01:00.000Z'),bad400);
});

test('request-local immutable verification memo reuses only identical bytes and still checks every reviewer, clock and decision',async()=>{
 const f=await fixture(),memo=review.createExperimentReviewVerificationMemo();
 await review.validateExperimentReviewBindings(f.command,f.references,f.reviewer,at,memo);const count=memo.size;assert(count>0);
 assert([...memo.keys()].every(key=>/^[a-f0-9]{64}$/.test(key)));for(const marker of memo.values())assert.equal(await marker,undefined);
 await review.validateExperimentReviewBindings(f.command,f.references,f.reviewer,at,memo);assert.equal(memo.size,count);
 await assert.rejects(()=>review.validateExperimentReviewBindings(f.command,f.references,f.references.original.author,at,memo),bad400);
 await assert.rejects(()=>review.validateExperimentReviewBindings(f.command,f.references,f.reviewer,'2026-10-11T09:01:00.000Z',memo),bad400);
 const changed=structuredClone(f.references);changed.original.record.content.result.artifact.metrics.netPnl+=1;
 await assert.rejects(()=>review.validateExperimentReviewBindings(f.command,changed,f.reviewer,at,memo),bad400);
 const changedSource=structuredClone(f.references);changedSource.strategy.record.content.description+=' changed bytes';
 await assert.rejects(()=>review.validateExperimentReviewBindings(f.command,changedSource,f.reviewer,at,memo),bad400);
 assert.equal(review.createExperimentReviewVerificationMemo().size,0);
 const bounded=review.createExperimentReviewVerificationMemo();for(let n=0;n<review.experimentReviewLimits.verificationMemoEntries-1;n++)bounded.set('fixture-'+n,Promise.resolve());
 await review.validateExperimentReviewBindings(f.command,f.references,f.reviewer,at,bounded);assert.equal(bounded.size,review.experimentReviewLimits.verificationMemoEntries);
 await assert.rejects(()=>review.validateExperimentReviewBindings(f.command,changed,f.reviewer,at,bounded),bad400);assert.equal(bounded.size,review.experimentReviewLimits.verificationMemoEntries);
});
