#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

async function main(){
// Reviewed fixed first-party imports, a fresh local D1 and synthetic data only.
// No command/source/module path, credential or provider input is accepted.
assert.equal(process.argv.length,2,'This fixture generator accepts no arguments.');
const entry="export * from './app/experiment-model';export * from './app/demo-model';export * from './app/demo-engine';export {StrategyRepository} from './app/strategy-store';export {ExperimentRepository} from './app/experiment-store';";
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const method=await m.experimentDigest(JSON.stringify(m.demoEvaluatorMethod)),sourceHash=createHash('sha256').update(readFileSync('app/demo-engine.ts')).digest('hex');
assert.equal(sourceHash,m.experimentRegisterDefaults({}).evaluator.sourceDigest);
assert.equal(method,m.experimentRegisterDefaults({}).evaluator.methodDigest);
const mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('Local synthetic fixture only.');}}",compatibilityDate:'2026-05-15',d1Databases:['DB']});
const time='2026-10-11T01:00:00.000Z',author={kind:'HUMAN',userId:'synthetic-registry-author',moderator:false},challenger={kind:'HUMAN',userId:'synthetic-registry-challenger',moderator:false};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const path='examples/experiments';mkdirSync(path,{recursive:true});
function save(name,value){const text=JSON.stringify(value,null,2)+'\n',target=path+'/'+name;if(existsSync(target)){assert.equal(readFileSync(target,'utf8'),text,'Existing fixture differs; preserve it for review.');}else writeFileSync(target,text,{flag:'wx',mode:0o600});}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>/^[0-9]{4}_.*[.]sql$/.test(f)).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const strategies=new m.StrategyRepository(db),registry=new m.ExperimentRepository(db),old=JSON.parse(readFileSync('examples/demo/synthetic-signal-input.json','utf8'));
 async function published(input,n,name){const c=input.strategy.record.content;const reply=await strategies.write(author,{action:'publish',requestId:id(n),id:id(n+1),...c,name,relation:null,policyAccepted:'public-strategy-v1'},time);return {record:reply.item.record,digest:reply.item.digest};}
 const input={...old,requestId:id(10),strategy:await published(old,11,'Synthetic supplied-signal registry source')};
 const content=m.experimentRegisterDefaults(input);content.name='Synthetic negative supplied-signal experiment';content.disclosures.search.logCompleteness='COMPLETE';content.disclosures.search.log='One declared local synthetic fixture; this is not a complete record of prior research.';content.disclosures.validation.note='No unseen market sample or independent data origin is claimed.';
 const command={action:'register',requestId:id(20),id:id(21),...content,policyAccepted:'public-experiment-v1'};
 const registration=await registry.write(author,command,time),manifest=registration.item;
 // Registration occurs before this generator's evaluator call; this cannot establish no prior trial existed.
 const artifact=await m.replayDemo(input);await m.verifyDemoArtifact(artifact);
 assert.equal(artifact.status,'COMPLETED');assert.equal(artifact.trades.length,6);assert(artifact.metrics.netPnl<0);
 const result=(n,name,report,claim)=>({action:'outcome',requestId:id(n),id:id(n+1),name,manifest:{id:manifest.id,digest:manifest.digest},result:report,claim,policyAccepted:'public-experiment-v1'});
 const original=result(30,'Synthetic negative initial report',{kind:'ARTIFACT',artifact},{type:'ORIGINAL',relation:null,sharedDependencies:['opengrail-demo-v1'],conflicts:'Local synthetic author report; not independently reproduced.'});
 const first=await registry.write(author,original,time);
 const interrupted=result(40,'Synthetic interrupted attempt',{kind:'INTERRUPTED',reason:'Demonstration of an interrupted evaluation without invented metrics.'},{type:'ORIGINAL',relation:null,sharedDependencies:['opengrail-demo-v1'],conflicts:'Same author and sponsor; no independence claim.'});
 const failure=await registry.write(author,interrupted,time);
 // Deliberately inconsistent self-hashed performance shows why digest checks are not qualification.
 const inconsistent=structuredClone(artifact);inconsistent.metrics.netPnl+=1;inconsistent.metrics.finalEquity+=1;inconsistent.metrics.returnPct=inconsistent.metrics.netPnl/input.initialCapital*100;inconsistent.resultDigest=await m.demoArtifactDigest(inconsistent);await m.verifyDemoArtifact(inconsistent);
 const dispute=result(50,'Synthetic adversarial conflicting report',{kind:'ARTIFACT',artifact:inconsistent},{type:'CONFLICTING',relation:{type:'CONFLICTS',id:first.item.id,digest:first.item.digest},sharedDependencies:['opengrail-demo-v1','copied source artifact'],conflicts:'Adversarial synthetic self-hashed metric alteration, deliberately not an independent evaluator result.'});
 const conflict=await registry.write(challenger,dispute,time);
 save('signal-input.json',input);save('signal-registration-command.json',command);save('signal-registration-receipt.json',registration);save('signal-author-artifact.json',artifact);save('signal-author-outcome.json',first);save('signal-interrupted-outcome.json',failure);save('signal-conflicting-outcome.json',conflict);save('signal-current-manifest.json',await registry.get(manifest.id));save('signal-outcome-page.json',await registry.outcomes(manifest.id));

 const short=structuredClone(input);short.requestId=id(60);short.hypothesis='Test that a synthetic short opening gap retains the full loss rather than clipping collateral.';short.falsification='Reject the accounting if it reports a successful comparable outcome after insolvency.';short.initialCapital=1000;
 short.strategy.record.content.definition.market.direction='SHORT';short.strategy.record.content.definition.entry={type:'SIGNAL',provider:'CUSTOM',event:'BEARISH',maxAgeBars:1};short.strategy.record.content.definition.costs={feeBps:0,slippageBps:0};
 short.dataset={...short.dataset,id:id(61),rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented prices for a local accounting counterexample. Public fixture permission only.'},bars:[100,100,1e9].map((price,n)=>({closedAt:new Date(Date.parse('2025-01-01T01:00:00.000Z')+n*3600000).toISOString(),open:price,high:price,low:price,close:price,volume:1}))};
 short.signals=[{id:id(62),provider:'CUSTOM',event:'BEARISH',observedAt:short.dataset.bars[0].closedAt,availableAt:short.dataset.bars[0].closedAt}];short.strategy=await published(short,63,'Synthetic uncapped short-insolvency source');
 const shortContent=m.experimentRegisterDefaults(short);shortContent.name='Synthetic retained insolvency experiment';shortContent.disclosures.conflicts.sharedDependencies=['opengrail-demo-v1'];shortContent.disclosures.validation.note='Synthetic accounting edge case; no unseen-data or provider claim.';
 const shortCommand={action:'register',requestId:id(70),id:id(71),...shortContent,policyAccepted:'public-experiment-v1'},shortRegistration=await registry.write(author,shortCommand,time),shortArtifact=await m.replayDemo(short);
 assert.equal(shortArtifact.status,'FAILED');assert.equal(shortArtifact.reason,'INSOLVENT');await m.verifyDemoArtifact(shortArtifact);
 const shortOutcome=await registry.write(author,{action:'outcome',requestId:id(80),id:id(81),name:'Synthetic uncapped insolvency retained',manifest:{id:shortRegistration.item.id,digest:shortRegistration.item.digest},result:{kind:'ARTIFACT',artifact:shortArtifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:['opengrail-demo-v1'],conflicts:'Synthetic local accounting fixture, not independent validation.'},policyAccepted:'public-experiment-v1'},time);
 save('insolvency-input.json',short);save('insolvency-registration-command.json',shortCommand);save('insolvency-registration-receipt.json',shortRegistration);save('insolvency-artifact.json',shortArtifact);save('insolvency-outcome.json',shortOutcome);save('insolvency-current-manifest.json',await registry.get(shortRegistration.item.id));
 save('case-index.json',{version:1,classification:'SYNTHETIC_LOCAL_FIXTURE_ONLY',fixtureServerReceiptTime:time,sourceConnected:false,productionRegistration:false,independentQualification:false,executionEnabled:false,evaluator:{version:m.demoEvaluatorVersion,declaredMethodDigest:method,sourceSha256:sourceHash},cases:[{manifestId:manifest.id,manifestDigest:manifest.digest,retainedOutcomes:3,statuses:['COMPLETED','INTERRUPTED','CONFLICTING_CLAIM'],note:'The contradictory artifact is deliberately self-hashed false evidence, not a second evaluator.'},{manifestId:shortRegistration.item.id,manifestDigest:shortRegistration.item.digest,retainedOutcomes:1,statuses:['FAILED_INSOLVENT'],note:'Uncapped short deficit remains an incomparable failure.'}]});
 console.log(JSON.stringify({fixture:path,manifests:2,outcomes:4,connectedSources:false,qualification:false}));
}finally{await mf.dispose();}
}
main().catch(()=>{process.stderr.write("Synthetic registry fixture failed. Preserve existing files and inspect the reviewed generator.\n");process.exitCode=1;});
