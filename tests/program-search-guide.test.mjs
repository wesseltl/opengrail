import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const bundle=await build({stdin:{contents:"export {default as Guide,metadata} from './app/agent-guide/program-search/page';export * from './app/program-search-protocol';export {syntheticProgramSearchExample} from './app/program-search-example';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',target:'es2022',write:false,jsx:'automatic',loader:{'.css':'empty'}});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const m=module.exports;
function walk(node,predicate){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(value=>walk(value,predicate));return [...(predicate(node)?[node]:[]),...walk(node.props?.children,predicate)];}
const text=node=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?text(node.props?.children):String(node);

test('actual public program search guide supplies complete schema-valid inputs without a service call',async()=>{
 const original=globalThis.fetch;let calls=0,tree;try{globalThis.fetch=async()=>{calls++;throw Error('External calls are not part of this guide.');};tree=await m.Guide();}finally{globalThis.fetch=original;}
 const html=m.renderToStaticMarkup(tree),documents=walk(tree,node=>node.type==='pre'&&node.props['data-program-search-example']).map(node=>({kind:node.props['data-program-search-example'],value:JSON.parse(text(node))}));
 assert.equal(calls,0);assert.equal(walk(tree,node=>node.type==='h1').length,1);assert.equal(walk(tree,node=>['input','textarea','form','script','iframe'].includes(node.type)).length,0);assert(!/<details[^>]*\bopen\b/.test(html));
 const admission=documents.find(row=>row.kind==='admission').value,testInput=documents.find(row=>row.kind==='test').value,plan=await m.createProgramSearchPlan(admission);assert.deepEqual(await m.verifyProgramSearchPlan(plan),plan);assert.equal(plan.admission.candidates.length,2);assert(plan.admission.candidates.every(candidate=>candidate.source.record.version===2));
 assert.deepEqual(testInput,(await m.syntheticProgramSearchExample()).testInput);for(const field of ['bars','signals','dataset','prices'])assert.equal(field in plan.admission.test,false);assert.equal('signals' in admission.train,false);assert.equal('signals' in testInput,false);
});

test('displayed program examples generate actual candidate signals and preserve their losing sole TEST',async()=>{
 const {admission,testInput}=await m.syntheticProgramSearchExample();let ledger=await m.createProgramSearchLedger(await m.createProgramSearchPlan(admission));
 for(const [index,candidate]of admission.candidates.entries()){
  const start=new Date(Date.parse('2025-02-01T00:00:00.000Z')+index*120000);ledger=await m.admitProgramSearchTrain(ledger,candidate.source.id,start.toISOString());const terminal=await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(ledger),{finishedAt:new Date(start.getTime()+60000).toISOString()});ledger=await m.finishProgramSearchAttempt(ledger,terminal);
 }
 assert.equal(ledger.attempts[0].outcome.signals.length,1);assert.equal(ledger.attempts[1].outcome.signals.length,0);assert(ledger.attempts.every(attempt=>attempt.generatorComparison.status==='MATCH'&&attempt.reconstruction!==null));
 ledger=await m.lockProgramSearchSelection(ledger,'2025-02-01T00:04:00.000Z');assert.equal(ledger.selection.decision,'SELECTED');const selected=ledger.selection.selectedCandidateId;
 ledger=await m.admitProgramSearchTest(ledger,testInput,'2025-02-01T00:05:00.000Z');const terminal=await m.evaluateProgramSearchAttempt(m.pendingProgramSearchAttempt(ledger),{finishedAt:'2025-02-01T00:06:00.000Z'});ledger=await m.finishProgramSearchAttempt(ledger,terminal);
 assert(terminal.outcome.artifact.metrics.netPnl<0);assert.equal(terminal.generatorComparison.status,'MATCH');assert.equal(terminal.outcome.comparison.status,'MATCH');assert.equal(ledger.selection.selectedCandidateId,selected);assert.equal(terminal.input.strategy.record.version,2);assert.deepEqual(terminal.input.dataset,testInput.dataset);
 await assert.rejects(()=>m.admitProgramSearchTest(ledger,testInput,'2025-02-01T00:07:00.000Z'));assert.deepEqual(await m.verifyProgramSearchLedger(ledger),ledger);
});
