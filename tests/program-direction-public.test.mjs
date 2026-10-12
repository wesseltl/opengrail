import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {fittingProgramDirectionPublicFixture,loadProgramDirectionPublicModules} from './program-direction-public-fixtures.mjs';

// Real bundled handlers and local D1; actor headers and clock are synthetic fixtures.
const origin='https://direction-public.test',uid=()=>crypto.randomUUID(),at=new Date(Date.now()-10000).toISOString(),ref=item=>({id:item.id,digest:item.digest});
let mf,db,m,bundle;
const worker=`import * as e from './app/experiment-http';import * as r from './app/experiment-review-http';import * as s from './app/strategy-http';import {ExperimentRepository} from './app/experiment-store';import {ExperimentReviewRepository} from './app/experiment-review-store';import {StrategyRepository} from './app/strategy-store';export default {async fetch(request,env){const path=new URL(request.url).pathname,user=request.headers.get('X-Fixture-Actor'),actor=user?{userId:user}:null,er=()=>new ExperimentRepository(env.DB),rr=()=>new ExperimentReviewRepository(env.DB),sr=()=>new StrategyRepository(env.DB),reviewer=id=>id==='reviewer',moderator=id=>id==='moderator',now=()=>env.AT;if(path==='/api/strategies')return request.method==='GET'?s.strategyPublicRequest(request,sr):s.strategyHumanRequest(request,actor,sr,moderator,now);if(path.startsWith('/api/experiments/reviews'))return request.method==='GET'?r.experimentReviewPublicRequest(request,rr):r.experimentReviewHumanRequest(request,actor,rr,reviewer,moderator,now);return request.method==='GET'?e.experimentPublicRequest(request,er):e.experimentHumanRequest(request,actor,er,moderator,now);}};`;
before(async()=>{
 m=await loadProgramDirectionPublicModules();bundle=await build({stdin:{contents:worker,resolveDir:process.cwd()},bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 for(const file of Object.keys(bundle.metafile.inputs))assert(!/(?:program-session-(?:engine|journal)|program-forward-plan|program-search-protocol|program-direction-(?:search|forward-plan)|program-run|session-(?:engine|journal)|demo-engine|reference-engine|evaluator-comparison)\.ts$/.test(file),file);
 assert(!/function (?:invokeProgram|createProgramInstance|referenceReplay|replayDemo)\(/.test(bundle.outputFiles[0].text));
 assert(Object.keys(bundle.metafile.inputs).some(file=>file.endsWith('program-direction-search-model.ts')));
 mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{AT:at}});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['experiment_review_reports','experiment_review_moderation','experiment_reviews','experiment_reports','experiment_moderation','experiment_records','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>mf?.dispose());

async function post(path,command,user='author'){
 const review=path.includes('/reviews'),strategy=path==='/api/strategies',label=strategy?'Strategy':review?'Experiment-Review':'Experiment';
 return mf.dispatchFetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Fixture-Actor':user,[`X-${label}-Intent`]:'submit',[`X-${label}-Author`]:await m.experimentPublicHumanId(user)},body:JSON.stringify(command)});
}
async function sent(path,command,user='author'){const response=await post(path,command,user);assert.equal(response.status,200,await response.clone().text());return (await response.json()).item;}
async function fixture(){let n=0;return fittingProgramDirectionPublicFixture({sourceClock:Date.now(),registerSource:async source=>sent('/api/strategies',{...m.strategyPublishCommandForRecord(source.record),id:uid(),requestId:uid()},'source-'+n++)});}
const manifestCommand=f=>({action:'register',id:uid(),requestId:uid(),...m.experimentForwardRegisterDefaults(f.artifact.input,'Complete invented SHORT forward'),policyAccepted:'public-experiment-v1'});
const outcomeCommand=(parent,artifact,claim={type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''})=>({action:'outcome',id:uid(),requestId:uid(),method:'PROGRAM_FORWARD_DEMO',name:'Full invented SHORT result',manifest:ref(parent),result:{kind:'ARTIFACT',artifact},claim,policyAccepted:'public-experiment-v1'});
async function published(f=undefined){f??=await fixture();const command=manifestCommand(f),manifest=await sent('/api/experiments',command),originalCommand=outcomeCommand(manifest,f.artifact),original=await sent('/api/experiments',originalCommand),fresh=await m.compareProgramForwardEvidence(f.artifact),reproduction=await sent('/api/experiments',outcomeCommand(manifest,fresh.reconstructed,{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(original)},sharedDependencies:['Same first-party code and invented prices'],conflicts:''}),'reproducer');return {...f,command,manifest,originalCommand,original,fresh,reproduction,evidence:{method:'PROGRAM_FORWARD_DEMO',original:fresh.report,reproduction:(await m.compareProgramForwardEvidence(fresh.reconstructed)).report}};}
const review=f=>({action:'review',id:uid(),requestId:uid(),target:{original:ref(f.original),reproduction:ref(f.reproduction),manifest:ref(f.manifest),strategy:ref(f.sources.find(source=>source.id===f.config.strategy.record.id))},previous:null,decision:'HELD',reasons:['INCOMPLETE_EVIDENCE'],evidence:f.evidence,attestations:{fixedCode:true,exactInputs:true,inspectedDifferences:true,separateOriginalAndReproductionProcesses:false},sharedDependencies:[...m.experimentReviewSharedDependencies],otherConflicts:'Synthetic first-party actors; independent operators are not established.',note:'A matching SHORT computation remains held under the Search and custody gates.',policyAccepted:'public-experiment-review-v1'});
async function withPublicFetch(fn){const previous=globalThis.fetch;globalThis.fetch=(url,options)=>mf.dispatchFetch(String(url).startsWith('/')?origin+url:String(url),options);try{return await fn();}finally{globalThis.fetch=previous;}}

test('complete SHORT V2 input retains every native/reference trial and adverse TEST under unchanged public caps',async()=>{
 const f=await fixture(),input=f.artifact.input;
 assert.equal(input.plan.version,2);assert.equal(input.plan.method,'DIRECTION_MATCHED_TRAIN_RETURN_V1');assert.equal(input.plan.handoff.ledger.selection.decision,'SELECTED');assert.equal(f.ledger.attempts.length,3);
 assert.equal(f.ledger.attempts[0].outcome.artifact.metrics.comparable,false);assert.equal(f.ledger.attempts[0].outcome.comparison.status,'MATCH');assert(f.ledger.attempts[0].certificate.reference.trades.length>0);
 assert.equal(f.ledger.attempts[1].outcome.status,'NO_TRADES');assert.equal(f.ledger.attempts[2].phase,'TEST');assert(f.ledger.attempts[2].outcome.artifact.metrics.netPnl<0);assert(f.ledger.attempts[2].certificate.reference.metrics.netPnl<0);
 assert(f.journal.trading.state.trades.some(trade=>trade.direction==='SHORT'&&trade.netPnl<0));assert(f.journal.events.some(row=>row.status==='INTERRUPTED'));
 assert(new TextEncoder().encode(JSON.stringify(input)).byteLength<=m.experimentLimits.inputBytes);assert(new TextEncoder().encode(JSON.stringify(f.artifact)).byteLength<=m.experimentLimits.artifactBytes);
 const command=manifestCommand(f),item=await sent('/api/experiments',command);assert.deepEqual(item.record.content.input,input);assert.equal(item.record.classification,'AUTHOR_REPORTED');assert.equal(item.record.content.input.plan.qualification,'NONE');assert(item.record.flags.includes('POST_SELECTED'));assert.equal(item.record.content.disclosures.search.trialCount,3);
 assert.equal(m.programForwardEvidenceInputLimit(input),m.programDirectionForwardEvidenceLimits.inputBytes);assert.equal(m.programForwardEvidenceInputLimit({...input,plan:null}),m.programForwardEvidenceLimits.inputBytes);
});

test('real V4 handler paired review remains HELD after complete new-method reconstruction',async()=>{
 const f=await published();assert.equal(f.fresh.report.status,'MATCH');assert.notEqual(f.fresh.reconstructed.attemptId,f.artifact.attemptId);assert.deepEqual(f.fresh.reconstructed.input,f.artifact.input);assert.deepEqual(f.fresh.reconstructed.journal,f.artifact.journal);
 const completeFreshBytes=new TextEncoder().encode(JSON.stringify(f.fresh)).byteLength;
 assert(completeFreshBytes<=m.programForwardEvidenceReconstructionReservation(f.artifact.input));
 assert.equal(m.programForwardEvidenceCliResultLimit(f.fresh),m.programDirectionForwardEvidenceLimits.cliResultBytes);
 const command=review(f),held=await sent('/api/experiments/reviews',command,'reviewer');assert.equal(held.decision,'HELD');assert.equal(held.record.qualification,'NONE');assert.equal(held.method,'PROGRAM_FORWARD_DEMO');
 const retry=await sent('/api/experiments/reviews',command,'reviewer');assert.deepEqual(retry,held);
 // This deliberately false process attestation must still fail the post-selection gate.
 const unsafe={...review(f),attestations:{fixedCode:true,exactInputs:true,inspectedDifferences:true,separateOriginalAndReproductionProcesses:true},previous:ref(held),decision:'REPRODUCED',reasons:['COMPUTATION_MATCH']};m.boundedExperimentReviewCommand(unsafe);const refused=await post('/api/experiments/reviews',unsafe,'reviewer');assert.equal(refused.status,400);assert.deepEqual(await refused.json(),{error:'Selected, incomplete or leaked validation cannot receive a positive review.'});
 const got=await mf.dispatchFetch(origin+'/api/experiments?id='+f.original.id);assert.equal(got.status,200);assert.deepEqual((await got.json()).item.record.content.result.artifact.input.plan,f.plan);
});

test('coherent false forward state is admitted inertly and exposed by real local execution',async()=>{
 const f=await published(),raw=structuredClone(f.journal),value=777;raw.guest.state.globals[0]=value;const bits=new Uint8Array(8);new DataView(bits.buffer).setFloat64(0,value,true);raw.guest.state.globalBits[0]=Buffer.from(bits).toString('hex');raw.guest.stateDigest=await m.programForwardEvidenceDigest(raw.guest.state);raw.guest.trace.at(-1).stateDigest=raw.guest.stateDigest;
 for(const row of raw.events)if(row.guestTraceLength===raw.guest.trace.length)row.guestStateDigest=raw.guest.stateDigest;
 const {journalDigest,...body}=raw;raw.journalDigest=await m.programForwardEvidenceDigest(body);
 const forged=await m.sealProgramForwardEvidenceArtifact(f.artifact.input,raw,uid()),conflict=await sent('/api/experiments',outcomeCommand(f.manifest,forged,{type:'CONFLICTING',relation:{type:'CONFLICTS',...ref(f.original)},sharedDependencies:[],conflicts:''}),'conflicting-author');
 assert.equal(conflict.record.classification,'AUTHOR_REPORTED');assert.equal(forged.inputDigest,f.artifact.inputDigest);const fresh=await m.compareProgramForwardEvidence(forged);assert.equal(fresh.report.status,'MISMATCH');assert(fresh.report.comparison.differenceCount>0);assert.deepEqual(fresh.reconstructed.journal,f.journal);
});

test('all V2 losing-source dependencies suppress public bodies and paired review after hiding',async()=>{
 const f=await published(),held=await sent('/api/experiments/reviews',review(f),'reviewer'),loser=f.sources.find(source=>source.id!==f.config.strategy.record.id);
 assert.equal(m.experimentInputDependencies(f.artifact.input).length,2);
 const hide={action:'moderate',requestId:uid(),...ref(loser),state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'};await sent('/api/strategies',hide,'moderator');
 for(const path of ['/api/experiments?id='+f.manifest.id,'/api/experiments?id='+f.original.id,'/api/experiments/reviews?id='+held.id+'&digest='+held.digest]){const response=await mf.dispatchFetch(origin+path);assert.equal(response.status,200);const current=(await response.json()).item;assert.equal(current.record,null);assert.equal(current.suppression,'SOURCE_UNAVAILABLE');}
 await assert.rejects(()=>withPublicFetch(()=>m.readPublicProgramForwardContext({kind:'OUTCOME',...ref(f.original)},new AbortController().signal)),/unavailable/i);
});

test('new-method forward cohort retains both distinct strategies and complete review context unranked',async()=>{
 const f=await published(),held=await sent('/api/experiments/reviews',review(f),'reviewer'),source=f.sources.find(source=>source.id!==f.config.strategy.record.id),config={...f.config,sessionId:uid(),strategy:{record:source.record,digest:source.digest}},journal=await m.createProgramSessionJournal(config,f.plan.startsAt),artifact=await m.snapshotProgramForwardEvidence(journal),peerManifest=await sent('/api/experiments',{action:'register',id:uid(),requestId:uid(),...m.experimentForwardRegisterDefaults(artifact.input,'Invented unplanned peer'),policyAccepted:'public-experiment-v1'},'peer'),peer=await sent('/api/experiments',outcomeCommand(peerManifest,artifact),'peer');
 await withPublicFetch(async()=>{const first=await m.readArenaMember(ref(f.original),new AbortController().signal),second=await m.readArenaMember(ref(peer),new AbortController().signal);assert.equal(first.sourceDependencies.length,2);assert.equal(first.reviewContext.currentHead.id,held.id);
  const compact=member=>({outcome:member.outcome,manifest:member.manifest,strategy:member.strategy,sourceDependencies:member.sourceDependencies,reviewContext:{original:member.reviewContext.original,currentHead:member.reviewContext.currentHead?{...ref(member.reviewContext.currentHead),sequence:member.reviewContext.currentHead.sequence,decision:member.reviewContext.currentHead.decision,state:member.reviewContext.currentHead.state}:null}});
  const report=await m.evaluateArena([compact(first),compact(second)]);assert.equal(report.status,'HELD');assert.equal(report.ranking.eligible,false);assert.equal(report.rows.length,2);for(const row of report.rows){assert.equal(row.reason,'FORWARD_PROTOCOL_UNSUPPORTED');assert.equal(row.rank,null);assert.equal(row.diagnostics,null);assert.equal(row.reconstructed,null);}await m.verifyArenaReport(report);
 });
});

test('unknown method tags and accessor capacity selectors cannot upgrade legacy admission',async()=>{
 const f=await fixture(),wrong=structuredClone(f.artifact.input);wrong.plan.method='UNKNOWN';await assert.rejects(()=>m.verifyProgramForwardEvidenceInput(wrong));
 let calls=0;const hostile={...f.artifact.input,get plan(){calls++;return f.plan;}};assert.equal(m.programForwardEvidenceInputLimit(hostile),m.programForwardEvidenceLimits.inputBytes);await assert.rejects(()=>m.verifyProgramForwardEvidenceInput(hostile),/hooks|hidden/i);assert.equal(calls,0);
 for(const raw of [{artifact:f.artifact},{admission:{artifact:f.artifact}},{reconstructed:f.artifact},{attempt:{input:f.artifact.input}}])assert.equal(m.programForwardEvidenceCliNodeLimit(raw),m.programDirectionForwardEvidenceLimits.cliMaximumNodes);
 const nested={get artifact(){calls++;return f.artifact;}},hostileResult={get reconstructed(){calls++;return f.artifact;},admission:nested};assert.equal(m.programForwardEvidenceCliNodeLimit(hostileResult),m.programForwardEvidenceLimits.maximumNodes);assert.equal(calls,0);
});
