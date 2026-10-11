import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

// Actual retained adverse fixtures and fixed first-party local modules. No provider,
// public write, production binding, submitted code or independent qualification.
const file=name=>JSON.parse(readFileSync('examples/'+name,'utf8'));
const clone=value=>structuredClone(value);
const reference=item=>({id:item.id,digest:item.digest});
const uid=()=>crypto.randomUUID();
let model,experiment,strategy,journal,session,pureInputs,fixtureHashes;
before(async()=>{
 const pure=await build({entryPoints:['app/strategy-evidence-model.ts'],bundle:true,write:false,metafile:true,format:'esm',platform:'node',target:'es2022'});
 pureInputs=Object.keys(pure.metafile.inputs);
 const bundle=await build({stdin:{contents:"import * as model from './app/strategy-evidence-model';import * as experiment from './app/experiment-model';import * as strategy from './app/strategy-model';import * as journal from './app/session-journal';import {snapshotSessionEvidence as session} from './app/session-evidence';export {model,experiment,strategy,journal,session};",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 ({model,experiment,strategy,journal,session}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')));
 fixtureHashes=new Map(['experiments','sessions'].flatMap(directory=>readdirSync('examples/'+directory).filter(name=>name.endsWith('.json')).map(name=>{const path='examples/'+directory+'/'+name;return [path,createHash('sha256').update(readFileSync(path)).digest('hex')];})));
});
function publicStrategy(record,digest){return {id:record.id,digest,rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:strategy.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]};}
function source(name='signal-input.json'){const input=file('experiments/'+name);return publicStrategy(input.strategy.record,input.strategy.digest);}
function retained(name){return file('experiments/'+name).item;}
function page(selected=source(),items=['signal-current-manifest.json','signal-author-outcome.json','signal-conflicting-outcome.json','signal-interrupted-outcome.json'].map(retained)){
 return {version:1,strategy:selected,items:items.map(item=>model.strategyEvidenceEntryForItem(item)).sort((a,b)=>b.summary.createdAt.localeCompare(a.summary.createdAt)||b.summary.id.localeCompare(a.summary.id)),nextCursor:null,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false};
}
async function rejects(value){await assert.rejects(()=>model.validateStrategyEvidencePage(value));}
function suppressItem(item,suppression='SOURCE_UNAVAILABLE'){
 return {...clone(item),state:'HIDDEN',record:null,suppression,reason:null,moderation:[]};
}
function hideSource(selected){return {...clone(selected),state:'HIDDEN',record:null,reason:'POLICY',moderation:[{sequence:1,requestId:uid(),createdAt:'2026-10-11T02:00:00.000Z',actor:selected.author,state:'HIDDEN',reason:'POLICY'}]};}
async function continuous(name='signal-open.json'){
 const original=file('sessions/'+name),config=clone(original.config);config.origin='PUBLIC_STRATEGY';
 let tape=await journal.createSessionJournal(config,original.startedAt);
 for(const entry of original.events)tape=await journal.appendSessionEvent(tape,entry.event,entry.receivedAt);
 const bundle=await session(tape);assert.equal(bundle.result.kind,'ARTIFACT');
 const selected=publicStrategy(config.strategy.record,config.strategy.digest),author=config.strategy.record.author;
 const parent=await projected({version:2,id:uid(),requestId:uid(),createdAt:'2026-10-11T01:00:00.000Z',author,type:'MANIFEST',content:experiment.experimentContinuousRegisterDefaults(bundle.input,'Invented first-party retained checkpoint'),flags:experiment.experimentManifestFlags(experiment.experimentContinuousRegisterDefaults(bundle.input,'Invented first-party retained checkpoint').disclosures),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},selected);
 const claim={type:'ORIGINAL',relation:null,sharedDependencies:['Same fixed first-party synthetic Session fixture'],conflicts:''};
 const item=await projected({version:2,id:uid(),requestId:uid(),createdAt:'2026-10-11T01:01:00.000Z',author,type:'OUTCOME',content:{method:'CONTINUOUS_DEMO',name:'Invented retained checkpoint',manifest:reference(parent),result:bundle.result,claim},flags:experiment.experimentOutcomeFlags(author,parent.author,claim),policyAccepted:'public-experiment-v1',classification:'AUTHOR_REPORTED',executionEnabled:false},selected,parent);
 await experiment.validateExperimentItem(parent);await experiment.validateExperimentItem(item);
 return {selected,parent,item,tape,artifact:bundle.result.artifact};
}
async function projected(record,selected,parent=null){const canonical=experiment.boundedExperimentRecord(record);return {id:record.id,digest:await experiment.experimentDigest(canonical.payload),type:record.type,requestId:record.requestId,createdAt:record.createdAt,author:strategy.strategyAuthorReference(record.author),strategy:reference(selected),manifest:parent?reference(parent):null,state:'VISIBLE',reason:null,suppression:null,reporting:'AUTHOR_REPORTED',outcomeCount:record.type==='MANIFEST'?1:0,record:canonical.record,moderation:[]};}

test('exact strategy links pin a supplied digest and retain legacy ID-only selection',()=>{
 const ref=reference(source());assert.equal(model.strategyEvidenceSelectionFromQuery(''),null);
 assert.deepEqual(model.strategyEvidenceSelectionFromQuery(model.strategyEvidenceHref(ref).split('?')[1]),ref);
 assert.deepEqual(model.strategyEvidenceSelectionFromQuery('id='+ref.id),{id:ref.id,digest:null});
 assert.deepEqual(model.strategyEvidenceSelectionFromQuery(new URLSearchParams(ref)),ref);
 assert.equal(model.strategyEvidenceHref({...ref,rootId:uid()}),model.strategyEvidenceHref(ref));
});
test('selection rejects malformed, duplicate, mixed, unknown and incomplete references',()=>{
 const ref=reference(source()),query='id='+ref.id+'&digest='+ref.digest;
 for(const bad of ['digest='+ref.digest,'id=','id=bad','id='+ref.id+'&digest=',query+'&id='+ref.id,query+'&digest='+ref.digest,query+'&cursor='+ref.id,query+'&review='+ref.id,query+'&strategy='+ref.id,'id='+ref.id+'&digest='+ref.digest.toUpperCase(),'id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'.toUpperCase()])assert.throws(()=>model.strategyEvidenceSelectionFromQuery(bad),bad);
 for(const bad of [{id:uid(),digest:'bad'},{id:'bad',digest:ref.digest},{id:ref.id,digest:ref.digest.toUpperCase()}])assert.throws(()=>model.strategyEvidenceHref(bad));
});
test('actual negative, conflicting and interrupted fixture records project without erasing adverse evidence',async()=>{
 const names=['signal-current-manifest.json','signal-author-outcome.json','signal-conflicting-outcome.json','signal-interrupted-outcome.json'];
 for(const name of names)await experiment.validateExperimentItem(retained(name));
 const result=await model.validateStrategyEvidencePage(page());assert.equal(result.items.length,4);
 const original=result.items.find(entry=>entry.summary.id===retained('signal-author-outcome.json').id),conflict=result.items.find(entry=>entry.summary.id===retained('signal-conflicting-outcome.json').id),interruption=result.items.find(entry=>entry.summary.id===retained('signal-interrupted-outcome.json').id),manifest=result.items.find(entry=>entry.summary.type==='MANIFEST');
 assert(original.observation.metrics.netPnl<0);assert.deepEqual(original.observation.metrics,retained('signal-author-outcome.json').record.content.result.artifact.metrics);assert.deepEqual(original.observation.benchmark,retained('signal-author-outcome.json').record.content.result.artifact.benchmark);
 assert.equal(conflict.claim.type,'CONFLICTING');assert.deepEqual(conflict.claim.relation,{type:'CONFLICTS',...reference(retained('signal-author-outcome.json'))});assert.notEqual(conflict.observation.metrics.netPnl,original.observation.metrics.netPnl);
 assert.deepEqual(interruption.observation,{kind:'INTERRUPTED'});assert.equal(manifest.observation,null);assert.equal(manifest.claim,null);assert.equal(manifest.summary.outcomeCount,3);
 assert(result.items.every(entry=>!('record'in entry.summary)&&!('input'in(entry.observation??{}))&&!('artifact'in(entry.observation??{}))));
 assert.equal(result.strategy.record.verification,'UNTESTED');assert.equal(result.classification,'AUTHOR_REPORTED');assert.equal(result.qualification,'NONE');assert.equal(result.independence,'NOT_ESTABLISHED');
});
test('retained short insolvency exposes negative equity and noncomparable failure',async()=>{
 const item=retained('insolvency-outcome.json');await experiment.validateExperimentItem(item);
 const result=await model.validateStrategyEvidencePage(page(source('insolvency-input.json'),[item,retained('insolvency-current-manifest.json')]));
 const observed=result.items.find(entry=>entry.summary.type==='OUTCOME').observation;
 assert.equal(observed.status,'FAILED');assert(observed.metrics.finalEquity<0);assert(observed.metrics.netPnl<0);assert.equal(observed.metrics.comparable,false);assert.equal(observed.benchmark.comparable,false);
 const inconsistent=clone(result);inconsistent.items.find(entry=>entry.summary.type==='OUTCOME').observation.metrics.comparable=true;await rejects(inconsistent);
});
test('compact server-derived metrics are explicitly unauthenticated, never a reconstruction proof',async()=>{
 const altered=page();altered.items.find(entry=>entry.observation?.kind==='BATCH').observation.metrics.netPnl+=1;
 const admitted=await model.validateStrategyEvidencePage(altered);assert.equal(admitted.qualification,'NONE');assert.equal(admitted.independence,'NOT_ESTABLISHED');
 // A digest field identifies the full artifact elsewhere; this compact read cannot
 // authenticate a consistent metric edit against omitted full artifact bytes.
 assert.deepEqual(admitted,altered);
});
test('continuous checkpoints preserve open inventory, pending emergency and adverse exit separately',async()=>{
 const cases=[['signal-open.json','ACTIVE',1,0],['emergency-awaiting-quote.json','STOPPING',1,0],['emergency-adverse-exit.json','STOPPED',0,1]];
 for(const [name,status,openPositions,closedTrades]of cases){
  const f=await continuous(name),result=await model.validateStrategyEvidencePage(page(f.selected,[f.parent,f.item])),entry=result.items.find(value=>value.summary.type==='OUTCOME'),o=entry.observation;
  assert.equal(entry.summary.method,'CONTINUOUS_DEMO');assert.equal(o.kind,'CONTINUOUS');assert.equal(o.status,status);assert.equal(o.openPositions,openPositions);assert.equal(o.closedTrades,closedTrades);assert.deepEqual(o.account,f.artifact.projection.account);assert.equal(o.initialCapital,f.artifact.input.config.initialCapital);assert.equal(o.pending,f.artifact.projection.pending!==null);assert.equal(o.capacityHalted,f.artifact.projection.capacityHalted);assert.equal(o.dataGap,f.artifact.projection.dataGap);assert.equal(o.emergencyAt,f.artifact.projection.emergencyAt);
  assert(!('metrics'in o));assert(!('benchmark'in o));assert(!('events'in o));assert(!('openPositions'in o.account));
  if(status==='STOPPED'){assert(o.account.equity<o.initialCapital);assert(o.account.totalFees>0);}if(status==='STOPPING')assert.notEqual(o.emergencyAt,null);
 }
});
test('hidden sources and parent-suppressed outcomes retain metadata but suppress authored observations and relations',async()=>{
 const selected=hideSource(source()),items=['signal-current-manifest.json','signal-author-outcome.json','signal-conflicting-outcome.json','signal-interrupted-outcome.json'].map(name=>suppressItem(retained(name)));
 const result=await model.validateStrategyEvidencePage(page(selected,items));assert.equal(result.strategy.record,null);
 for(const entry of result.items){assert.equal(entry.summary.name,null);assert.equal(entry.summary.status,null);assert.deepEqual(entry.summary.flags,[]);assert.equal(entry.claim,null);assert.equal(entry.observation,null);assert.equal(entry.summary.suppression,'SOURCE_UNAVAILABLE');}
 const parentHidden=await model.validateStrategyEvidencePage(page(source(),[suppressItem(retained('signal-author-outcome.json'),'PARENT_UNAVAILABLE')]));assert.equal(parentHidden.items[0].summary.suppression,'PARENT_UNAVAILABLE');assert.equal(parentHidden.items[0].observation,null);
 const restored=clone(result);restored.items[0]=page().items[0];await rejects(restored);
 const leaked=clone(result);leaked.items[0].claim={type:'ORIGINAL',relation:null};await rejects(leaked);
 const metrics=clone(parentHidden);metrics.items[0].observation=page().items.find(entry=>entry.observation?.kind==='BATCH').observation;await rejects(metrics);
});
test('source digest and source authorship are validated before any compact entry is displayed',async()=>{
 const altered=page();altered.strategy.record.content.description+=' altered';await rejects(altered);
 for(const mutate of [v=>v.strategy.digest='0'.repeat(64),v=>v.strategy.author.id='human_'+'0'.repeat(64),v=>v.strategy.record.author.sponsorId='human_'+'0'.repeat(64),v=>v.strategy.id=uid(),v=>v.strategy.record.executionEnabled=true,v=>v.strategy.record.content.definition.execution.mode='LIVE',v=>v.strategy.record.content.definition.execution.ordersEnabled=true]){const v=page();mutate(v);await rejects(v);}
});
test('cross-version source references never become root, fork or revised aggregation',async()=>{
 for(const mutate of [v=>v.items[0].summary.strategy.id=uid(),v=>v.items[0].summary.strategy.digest='0'.repeat(64),v=>v.strategy=source('insolvency-input.json')]){const v=page();mutate(v);await rejects(v);}
 assert.equal((await model.validateStrategyEvidencePage(page(source(),[]))).items.length,0);
});
test('newest-first order, same-clock tie order, unique records and exact cursor anchors are enforced',async()=>{
 const valid=page();valid.nextCursor=valid.items.at(-1).summary.id;await model.validateStrategyEvidencePage(valid);
 for(const mutate of [v=>v.items.reverse(),v=>v.items[1].summary.createdAt='2026-10-12T01:00:00.000Z',v=>v.items.push(clone(v.items[0])),v=>v.nextCursor=v.items[0].summary.id,v=>v.nextCursor=uid(),v=>{v.items=[];v.nextCursor=uid();}]){const v=page();mutate(v);await rejects(v);}
});
test('page capacity admits twenty compact unique records and rejects a twenty-first',async()=>{
 const base=page(source(),[retained('signal-author-outcome.json')]),entry=base.items[0];
 base.items=Array.from({length:20},(_,n)=>{const value=clone(entry);value.summary.id='11111111-1111-4111-8111-'+String(20-n).padStart(12,'0');return value;});
 base.nextCursor=base.items.at(-1).summary.id;assert.equal((await model.validateStrategyEvidencePage(base)).items.length,20);
 const exceeded=clone(base),extra=clone(entry);extra.summary.id='11111111-1111-4111-8111-000000000000';exceeded.items.push(extra);exceeded.nextCursor=extra.summary.id;await rejects(exceeded);
});
test('continuous compact account and inventory are finite, bounded and method-specific',async()=>{
 const f=await continuous(),base=page(f.selected,[f.item]);
 for(const mutate of [o=>o.openPositions=6,o=>o.openPositions=-1,o=>o.closedTrades=2001,o=>o.closedTrades=1.5,o=>o.initialCapital=0,o=>o.account.equity=Infinity,o=>o.emergencyAt='not-a-clock',o=>o.pending='yes',o=>o.kind='BATCH',o=>o.benchmark={}]){const v=clone(base);mutate(v.items[0].observation);await rejects(v);}
 const batchMethod=clone(base);delete batchMethod.items[0].summary.method;await rejects(batchMethod);
 const hidden=page(hideSource(f.selected),[suppressItem(f.item)]);const admitted=await model.validateStrategyEvidencePage(hidden);assert.equal(admitted.items[0].observation,null);assert.equal(admitted.items[0].summary.method,undefined);
});
test('outcome kind, original relation, method and failure classification must agree',async()=>{
 const base=page();
 for(const mutate of [v=>v.items.find(e=>e.observation?.kind==='BATCH').observation.status='FAILED',v=>v.items.find(e=>e.observation?.kind==='BATCH').summary.method='CONTINUOUS_DEMO',v=>v.items.find(e=>e.claim?.type==='CONFLICTING').claim.relation.type='SUPPORTS',v=>{const e=v.items.find(e=>e.claim?.type==='CONFLICTING');e.claim.relation.id=e.summary.id;},v=>v.items.find(e=>e.claim?.type==='ORIGINAL').claim.relation={type:'SUPPORTS',id:uid(),digest:'a'.repeat(64)},v=>v.items.find(e=>e.observation?.kind==='INTERRUPTED').observation={kind:'ARTIFACT_UNAVAILABLE'},v=>v.items.find(e=>e.summary.type==='MANIFEST').claim={type:'ORIGINAL',relation:null}]){const v=clone(base);mutate(v);await rejects(v);}
});
test('exact projected identities reject trailing newlines despite valid UUID or hash prefixes',async()=>{
 for(const mutate of [v=>v.strategy.id+='\n',v=>v.strategy.digest+='\n',v=>v.items[0].summary.id+='\n',v=>v.items[0].summary.requestId+='\n',v=>v.items[0].summary.digest+='\n',v=>v.items[0].summary.strategy.id+='\n',v=>v.items[0].summary.strategy.digest+='\n',v=>v.items.find(e=>e.summary.manifest!==null).summary.manifest.id+='\n',v=>v.items.find(e=>e.summary.manifest!==null).summary.manifest.digest+='\n',v=>v.items.find(e=>e.claim?.relation!==null&&e.claim!==null).claim.relation.id+='\n',v=>v.items.find(e=>e.claim?.relation!==null&&e.claim!==null).claim.relation.digest+='\n',v=>v.items.find(e=>e.observation?.kind==='BATCH').observation.artifactDigest+='\n',v=>v.nextCursor=v.items.at(-1).summary.id+'\n']){const v=page();mutate(v);await rejects(v);}
});
test('artifact unavailability has no invented metrics, baseline or observation flags',async()=>{
 const original=retained('signal-interrupted-outcome.json'),changed=clone(original);changed.record.content.result={kind:'ARTIFACT_UNAVAILABLE',reason:'Invented retained artifact was not available.'};
 const canonical=experiment.boundedExperimentRecord(changed.record);changed.record=canonical.record;changed.digest=await experiment.experimentDigest(canonical.payload);await experiment.validateExperimentItem(changed);
 const result=await model.validateStrategyEvidencePage(page(source(),[changed]));assert.deepEqual(result.items[0].observation,{kind:'ARTIFACT_UNAVAILABLE'});
 const fabricated=clone(result);fabricated.items[0].observation.metrics=retained('signal-author-outcome.json').record.content.result.artifact.metrics;await rejects(fabricated);
});
test('strict envelopes reject extra authorship, credentials, ranking, qualification and live authority',async()=>{
 for(const mutate of [v=>v.author={id:'forged'},v=>v.token='not-a-credential',v=>v.reputation=100,v=>v.rankings=[],v=>v.liveEnabled=true,v=>v.ordersEnabled=true,v=>v.executionEnabled=true,v=>v.qualification='VERIFIED',v=>v.independence='INDEPENDENT',v=>v.classification='VERIFIED',v=>v.strategy.permissions=['DEPLOY'],v=>v.items[0].summary.author.role='MAINTAINER',v=>v.items.find(e=>e.observation?.kind==='BATCH').observation.ordersEnabled=true,v=>v.items.find(e=>e.claim!==null).claim.confidence='HIGH']){const v=page();mutate(v);await rejects(v);}
});
test('plain JSON structural, node and response byte bounds reject cycles, accessors and malformed material',async()=>{
 const cyclic=page();cyclic.loop=cyclic;await rejects(cyclic);
 const accessed=page();let calls=0;Object.defineProperty(accessed,'sideEffect',{enumerable:true,get(){calls++;throw Error('must not evaluate');}});await rejects(accessed);assert.equal(calls,0);
 const callable=page();callable.toJSON=()=>{calls++;return {};};await rejects(callable);assert.equal(calls,0);
 for(const value of [new Date(),Object.assign(Object.create({inherited:true}),page()),{...page(),x:BigInt(1)},{...page(),x:Symbol('x')},{...page(),x:undefined},{...page(),x:Infinity},{...page(),x:NaN}])await rejects(value);
 const symbolKey=page();symbolKey[Symbol('unserializable')]='hidden';await rejects(symbolKey);
 const deep=page();deep.unknown={};let tail=deep.unknown;for(let n=0;n<20;n++)tail=tail.child={};await assert.rejects(()=>model.validateStrategyEvidencePage(deep),/structural bounds/);
 const many=page();many.unknown=new Array(model.strategyEvidenceLimits.maximumNodes).fill(null);await assert.rejects(()=>model.validateStrategyEvidencePage(many),/structural bounds/);
 const large=page();large.unknown='x'.repeat(model.strategyEvidenceLimits.responseBytes);await assert.rejects(()=>model.validateStrategyEvidencePage(large),/byte bounds/);
 const invalid=page();invalid.items[0].summary.createdAt='not-a-clock';await rejects(invalid);
});
test('server admission dependency graph never imports evaluator engines, journal execution, provider or filesystem',()=>{
 assert(!pureInputs.some(path=>/(?:demo-engine|reference-engine|session-engine|session-journal|session-evidence|session-runtime|kraken-(?:demo|public)|receiver-runtime)\.(?:ts|mjs)$/.test(path)),pureInputs.join('\n'));
 const source=readFileSync('app/strategy-evidence-model.ts','utf8');assert(!/\bfetch\s*\(|\beval\s*\(|new Function|node:fs|localStorage|sessionStorage/.test(source));
});
test('read-only evidence checks preserve every retained example fixture byte',()=>{
 for(const [path,expected]of fixtureHashes)assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),expected,path);
});
