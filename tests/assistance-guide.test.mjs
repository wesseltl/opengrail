import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {default as Guide,metadata} from './app/agent-guide/assistance/page';export * from './app/assistance-model';export {boundedStrategyCommand,boundedStrategyRecord,strategyDigest} from './app/strategy-model';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',target:'es2022',write:false,jsx:'automatic',loader:{'.css':'empty'}});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const m=module.exports;
let networkCalls=0,tree,html;const originalFetch=globalThis.fetch;
try{globalThis.fetch=async()=>{networkCalls++;throw Error('Public instruction never needs a provider or write.');};tree=m.Guide();html=m.renderToStaticMarkup(tree);}finally{globalThis.fetch=originalFetch;}
function walk(node,predicate){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(value=>walk(value,predicate));return [...(predicate(node)?[node]:[]),...walk(node.props?.children,predicate)];}
function text(node){return node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?text(node.props?.children):String(node);}
const content=text(tree),documents=walk(tree,node=>node.type==='pre').map(text).filter(value=>value.trim().startsWith('{')).map(value=>JSON.parse(value)),guide=documents.find(value=>value.kind==='EXTERNAL_AGENT_ASSISTANCE'),commands=documents.filter(value=>value.action);

test('public semantic guide is human-readable, anonymous and complete without credential intake, write or model call',()=>{
 assert.equal(networkCalls,0);assert.equal(m.metadata.title,'External agent assistance · OpenGrail');assert.equal(walk(tree,node=>node.type==='h1').length,1);
 assert.deepEqual(walk(tree,node=>node.type==='section').map(node=>node.props.id),['discover','identity','proposal','respond','receipts','review','contracts']);
 assert.equal(walk(tree,node=>['form','input','textarea','button','iframe','script','img'].includes(node.type)).length,0);assert(!/<details[^>]*\bopen\b/.test(html));
 const links=walk(tree,node=>node.type==='a');for(const href of ['/agent-guide','/assistance','/strategies','/#agents','/agent-guide/strategies','/strategy-policy'])assert(links.some(node=>node.props.href===href),href);
 assert(links.every(node=>/^\//.test(node.props.href)||/^#/.test(node.props.href)));assert(!links.some(node=>/github|token=|30000000/.test(node.props.href)));
 for(const phrase of ['No private repository access','particular model provider or paid inference service is required','hosted acceptance pending','No private repository invitation is needed','This page performs no write','no evaluation was attempted','No orders, Live trading or autonomous adoption','Viewing and selecting proposals makes no write'])assert(content.includes(phrase),phrase);
});

test('all displayed request/proposal/respond commands pass their actual strict schemas and fixture commitments hash canonically',async()=>{
 assert(guide);assert.equal(commands.length,3);const [request,proposal,response]=commands;
 assert.deepEqual(m.boundedAssistanceCommand(request).command,request);assert.deepEqual(m.boundedStrategyCommand(proposal).command,proposal);assert.deepEqual(m.boundedAssistanceCommand(response).command,response);
 assert.deepEqual(request,guide.workflow.request.example);assert.deepEqual(proposal,guide.workflow.proposal.example);assert.deepEqual(response,guide.workflow.response.example);
 const fixture=guide.fixture,base=m.boundedStrategyRecord(fixture.baseRecord),requestRecord=m.boundedAssistanceRecord(fixture.requestRecord),proposalRecord=m.boundedStrategyRecord(fixture.proposalRecord);
 assert.equal(await m.strategyDigest(base.payload),fixture.baseDigest);assert.equal(await m.strategyDigest(requestRecord.payload),fixture.requestDigest);assert.equal(await m.strategyDigest(proposalRecord.payload),fixture.proposalDigest);
 assert.deepEqual(request.base,{id:base.record.id,digest:fixture.baseDigest});assert.deepEqual(proposal.relation,{type:'FORK',...request.base});assert.deepEqual(response.request,{id:request.id,digest:fixture.requestDigest});assert.deepEqual(response.proposal,{id:proposal.id,digest:fixture.proposalDigest});
 assert.equal(proposal.definition.entry.maxAgeBars,2);assert.equal(base.record.content.definition.entry.maxAgeBars,3);assert.equal(proposalRecord.record.author.kind,'AGENT');assert.equal(proposalRecord.record.verification,'UNTESTED');
 assert.throws(()=>m.boundedAssistanceCommand({...response,sponsorId:'invented'}));assert.throws(()=>m.boundedStrategyCommand({...proposal,performance:{returnPct:100}}));
});

test('self-contained public JSON specifies exact closed wrappers, nested orders, role restrictions, reports and current suppression',()=>{
 const {protocol}=guide;
 assert.deepEqual(protocol.canonicalOrders.requestRecord,['version','kind','id','requestId','createdAt','author','base','intent','constraints','falsification','policyAccepted','executionEnabled']);
 assert.deepEqual(protocol.canonicalOrders.responseRecord,['version','kind','id','requestId','createdAt','author','request','proposal','rationale','questions','policyAccepted','executionEnabled']);
 assert.deepEqual(protocol.reads.list.fields,['version','request','items','nextCursor','executionEnabled']);assert.deepEqual(protocol.reads.get.fields,['version','item','executionEnabled']);assert.deepEqual(protocol.receipt.fields,['version','action','requestId','item','report','executionEnabled']);
 assert.deepEqual(protocol.publicItem.availability,['AVAILABLE','SUPPRESSED','DEPENDENCY_UNAVAILABLE']);assert(protocol.publicItem.correlation.includes('own VISIBLE'));assert(protocol.publicItem.correlation.includes('never restores cached content'));
 for(const family of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES'])assert(Array.isArray(protocol.canonicalOrders.strategyNested.entry[family]),family);
 for(const action of ['withdraw','moderate','report'])assert(protocol.operations[action].fields.includes('policyAccepted'));
 assert(protocol.operations.moderate.actor.includes('explicit existing research moderator HUMAN'));assert.equal(protocol.privateReports.executionEnabled,false);assert(protocol.privateReports.privacy.includes('never appear'));assert(protocol.receipt.report.includes('no private details/reporter'));
 assert.equal(guide.transport.human.headers['X-Assistance-Author'],'authorId from a fresh GET /api/assistance/me');assert.equal(guide.scope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(guide.executionEnabled,false);assert.equal(guide.hostedAgentCompute,false);
 assert.equal(guide.limits.assistance.requestBytes,16384);assert.equal(guide.limits.assistance.recordBytes,12288);assert.equal(guide.limits.assistance.page,12);assert.equal(guide.limits.assistance.responsesPerRequest,32);assert(guide.discovery.responsePage.includes('cursor='));assert(guide.retry.rule.includes('Retry identical body'));assert(guide.retry.identity.includes('Revocation'));
 const proposal=guide.workflow.proposal.example;assert.deepEqual(proposal.definition.execution,{mode:'DEMO',leverage:1,ordersEnabled:false});assert(guide.workflow.adoption.definition.includes('Unchanged'));assert(guide.workflow.adoption.consent.includes('Viewing, selecting or receiving'));
});
