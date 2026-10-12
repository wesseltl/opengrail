import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {loadProgramDirectionSearchModules} from './program-direction-search-fixtures.mjs';

const built=await build({stdin:{contents:"export * from './app/program-direction-cohort-model';export * from './app/program-direction-cohort-link';",resolveDir:process.cwd()},bundle:true,write:false,metafile:true,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};
new Function('require','module','exports',built.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const api=module.exports;
async function fixture(){const m=await loadProgramDirectionSearchModules(),f=await m.syntheticProgramDirectionSearchExample();return{m,draft:{sources:f.admission.candidates.map(candidate=>candidate.source),train:f.admission.train,initialCapital:f.admission.initialCapital,hypothesis:f.admission.hypothesis,falsification:f.admission.falsification,selection:{minTrades:1,maxDrawdownPct:5,minReturnPct:0},test:{firstClosedAt:f.admission.test.firstClosedAt,barCount:4,gapBars:2,provenance:'SYNTHETIC',permission:'CREATED_SYNTHETIC'},rightsConfirmed:true},ids:{id:crypto.randomUUID(),createdAt:'2026-10-12T00:00:00.000Z',testDatasetId:crypto.randomUUID(),testAttemptId:crypto.randomUUID(),testRequestId:crypto.randomUUID(),candidates:f.admission.candidates.map(()=>({attemptId:crypto.randomUUID(),requestId:crypto.randomUUID()}))}};}
async function change(source,m,transform){const record=structuredClone(source.record);transform(record);const canonical=m.boundedStrategyRecord(record);return{...source,record:canonical.record,digest:await m.strategyDigest(canonical.payload)};}

test('cohort preparation graph contains inert models and decoder only, with no generator/trading/coordinator import',()=>{
 const forbidden=['app/program-direction-search.ts','app/program-run.ts','app/demo-engine.ts','app/reference-engine.ts','app/session-engine.ts','app/program-session-engine.ts','app/program-direction-search-storage.ts'];
 for(const name of forbidden)assert(!Object.hasOwn(built.metafile.inputs,name),name);
 assert(!/function (?:invokeProgram|createProgramInstance)\(/.test(built.outputFiles[0].text));assert(!built.outputFiles[0].text.includes('randomUUID'));
});
test('pure visual cohort constructs the unchanged full V2 admission and verifies its plan without modifying inputs',async()=>{
 const {m,draft,ids}=await fixture(),before=structuredClone({draft,ids}),plan=await api.prepareProgramDirectionCohort(draft,ids);
 assert.deepEqual({draft,ids},before);assert.deepEqual(await m.createProgramDirectionSearchPlan(plan.admission),plan);assert.deepEqual(await m.verifyProgramDirectionSearchPlan(plan),plan);
 assert.deepEqual(plan.admission.train,draft.train);assert.deepEqual(plan.admission.candidates.map(candidate=>candidate.source),draft.sources);assert.equal(plan.admission.test.datasetId,ids.testDatasetId);assert.equal(plan.admission.test.firstClosedAt,draft.test.firstClosedAt);assert(!Object.hasOwn(plan.admission.test,'bars'));
 assert.equal(plan.admission.selection.tieTolerancePct,.00000001);assert.equal(plan.admission.selection.tieBreak,'CANDIDATE_ORDER');assert.equal(plan.classification,'AUTHOR_REPORTED');assert.equal(plan.qualification,'NONE');assert.equal(plan.unseen,'NOT_ESTABLISHED');assert.equal(plan.ordersEnabled,false);
});
test('cohort displays separate direction, market, risk and cost incompatibilities and refuses preparation',async()=>{
 const {m,draft,ids}=await fixture();draft.sources[1]=await change(draft.sources[1],m,record=>{record.content.definition.market.direction='LONG';record.content.definition.market.symbol='ETH/USD';record.content.definition.entry.event='BULLISH';record.content.definition.risk.stopLossPct=3;record.content.definition.costs.feeBps+=1;});
 const check=api.programDirectionCohortCompatibility(draft.sources);assert.deepEqual(check.issues.map(issue=>issue.field),['DIRECTION','MARKET','RISK','COSTS']);assert.equal(check.compatible,false);await assert.rejects(api.prepareProgramDirectionCohort(draft,ids));
});
test('duplicate IDs/digests, missing bodies, rule sources and candidate count cannot form a cohort',async()=>{
 const {m,draft,ids}=await fixture();assert.equal(api.programDirectionCohortCompatibility([draft.sources[0]]).issues[0].field,'COUNT');assert.throws(()=>api.programDirectionCohortCompatibility(Array(5).fill(draft.sources[0])));
 assert(api.programDirectionCohortCompatibility([draft.sources[0],draft.sources[0]]).issues.some(issue=>issue.field==='DUPLICATE'));
 const rule=structuredClone(draft.sources[1]),{program,...content}=rule.record.content;void program;const checked=m.boundedStrategyRecord({...rule.record,version:1,content});rule.record=checked.record;rule.digest=await m.strategyDigest(checked.payload);assert(api.programDirectionCohortCompatibility([draft.sources[0],rule]).issues.some(issue=>issue.field==='SOURCE'));
 await assert.rejects(api.prepareProgramDirectionCohort({...draft,sources:[draft.sources[0],rule]},ids));
});
test('whole oversized TRAIN, wrong rights, supplied signals and normalization are refused intact',async()=>{
 const {draft}=await fixture(),whole=structuredClone(draft.train);whole.dataset.rights.note='x'.repeat(api.programDirectionCohortLimits.trainBytes);const before=JSON.stringify(whole);assert.throws(()=>api.validateProgramDirectionCohortTrain(whole));assert.equal(JSON.stringify(whole),before);
 for(const transform of [value=>value.dataset.rights.acknowledged=false,value=>value.dataset.rights.permission='AUTHORIZED_USE',value=>value.signals=[],value=>value.dataset.rights.note='  Created synthetic data.  ']){const value=structuredClone(draft.train);transform(value);assert.throws(()=>api.validateProgramDirectionCohortTrain(value));}
});
test('hooks, encoded credentials, nonfinite numbers and sparse arrays are refused before schema traversal',async()=>{
 const {draft,ids}=await fixture();let invoked=0;const hooked={};Object.defineProperty(hooked,'dataset',{enumerable:true,get(){invoked++;return draft.train.dataset;}});assert.throws(()=>api.validateProgramDirectionCohortTrain(hooked));assert.equal(invoked,0);
 await assert.rejects(api.prepareProgramDirectionCohort({...draft,hypothesis:encodeURIComponent('Bearer secretcredential123456')},ids));await assert.rejects(api.prepareProgramDirectionCohort({...draft,initialCapital:Infinity},ids));const sparse=structuredClone(draft.train);delete sparse.dataset.bars[1];assert.throws(()=>api.validateProgramDirectionCohortTrain(sparse));
});
test('future TRAIN, mismatched dataset market, wrong TEST gap and reused operations are refused',async()=>{
 for(const transform of [(draft,ids)=>ids.createdAt='2025-01-01T00:00:00.000Z',draft=>draft.train.dataset.symbol='ETH/USD',draft=>draft.test.gapBars=1,(draft,ids)=>ids.testAttemptId=ids.candidates[0].attemptId]){const {draft,ids}=await fixture();transform(draft,ids);await assert.rejects(api.prepareProgramDirectionCohort(draft,ids));}
});
test('cohort seed carries exact canonical references only and leaves no-seed method routing unchanged',()=>{
 const reference={id:'a3500000-0000-4000-8000-000000000010',digest:'a'.repeat(64)},href=api.programDirectionCohortHref(reference);assert.equal(href,'/search?method=programs&selection=direction-matched-v2&strategy='+reference.id+'&digest='+reference.digest);assert.deepEqual(api.programDirectionCohortSelectionFromQuery(new URLSearchParams(href.split('?')[1])),reference);
 for(const value of ['', 'method=rules','method=programs&selection=legacy-v1','method=programs&method=rules'])assert.equal(api.programDirectionCohortSelectionFromQuery(new URLSearchParams(value)),null);
 for(const value of ['strategy='+reference.id,'digest='+reference.digest,'method=rules&selection=direction-matched-v2&strategy='+reference.id+'&digest='+reference.digest,'method=programs&strategy='+reference.id+'&digest='+reference.digest,href.split('?')[1]+'&strategy='+reference.id,href.split('?')[1]+'&method=programs',href.split('?')[1]+'&url=https://example.com',href.split('?')[1].replace(reference.id,reference.id.toUpperCase())])assert.throws(()=>api.programDirectionCohortSelectionFromQuery(new URLSearchParams(value)));
 let calls=0;const hooked={digest:reference.digest};Object.defineProperty(hooked,'id',{enumerable:true,get(){calls++;return reference.id;}});assert.throws(()=>api.programDirectionCohortHref(hooked));assert.equal(calls,0);
});
