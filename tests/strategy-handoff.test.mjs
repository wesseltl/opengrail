import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let m,directory;
const id=n=>'a1000000-0000-4000-8000-'+String(n).padStart(12,'0'),at='2026-10-11T10:00:00.000Z',copy=structuredClone;
const author={kind:'HUMAN',id:'human_'+'a'.repeat(64),sponsorId:'human_'+'a'.repeat(64)};
async function source(type='TREND',direction='LONG'){
 const definition=m.strategyTemplate(type);definition.market.direction=direction;if(type==='SIGNAL')definition.entry.event=direction==='LONG'?'BULLISH':'BEARISH';Object.assign(definition.costs,{feeBps:23,slippageBps:37});Object.assign(definition.risk,{positionPct:3,maxOpenPositions:2,stopLossPct:4,takeProfitPct:9,maxDailyLossPct:2});
 const canonical=m.boundedStrategyRecord({version:1,id:id(1),rootId:id(1),revision:1,requestId:id(2),createdAt:at,author,content:{name:'Invented '+type+' '+direction+' source',description:'Local exact handoff fixture, without a participant or provider authentication claim.',assumptions:'Nonzero authored fees, slippage, risk and allocation must survive configuration export.',falsification:'Reject any changed definition or synthetic/default replacement.',sources:[],definition,relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false});
 return {id:id(1),digest:await m.strategyDigest(canonical.payload),rootId:id(1),revision:1,requestId:id(2),createdAt:at,author:m.strategyAuthorReference(author),state:'VISIBLE',reason:null,record:canonical.record,moderation:[]};
}
function admission(item,changes={}){return {source:copy(item),sessionId:id(3),initialCapital:1234.5,sourceLabel:'Supplied local producer · authenticity UNKNOWN',rightsNote:'I declare permission for local data use; this is not a verified vendor license.',confirmRights:true,...changes};}
const ref=item=>({id:item.id,digest:item.digest}),query=item=>'?strategy='+item.id+'&digest='+item.digest;
async function reseal(item){item=copy(item);item.digest=await m.strategyDigest(m.boundedStrategyRecord(item.record).payload);return item;}

before(async()=>{
 const compiled=await build({stdin:{contents:"export * from './app/strategy-handoff';export {boundedStrategyRecord,strategyDigest,strategyAuthorReference,strategyTemplate} from './app/strategy-model';export {boundedSessionConfig} from './app/session-model';export {createSessionJournal,verifySessionJournal} from './app/session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 directory=mkdtempSync(join(tmpdir(),'opengrail-strategy-handoff-'));const file=join(directory,'handoff.mjs');writeFileSync(file,compiled.outputFiles[0].text,{flag:'wx'});m=await import(pathToFileURL(file).href);
});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('empty search and exact immutable query references parse without selecting rules or producing a session',async()=>{
 const item=await source();assert.equal(m.parseStrategyHandoff(''),null);assert.equal(m.parseStrategyHandoff('?'),null);assert.deepEqual(m.parseStrategyHandoff(query(item)),ref(item));assert.deepEqual(m.parseStrategyHandoff('?digest='+item.digest+'&strategy='+item.id),ref(item));assert.deepEqual(m.parseStrategyHandoff('?%73trategy='+item.id+'&digest='+item.digest),ref(item));
});

test('incomplete, unknown, duplicate and percent-aliased duplicate fields never become a reference',async()=>{
 const item=await source();for(const q of ['?strategy='+item.id,'?digest='+item.digest,'?strategy=&digest='+item.digest,query(item)+'&strategy='+item.id,query(item)+'&%64igest='+item.digest,query(item)+'&cursor='+id(4),query(item)+'&url=https://example.com',query(item)+'&execute=true','?foo=bar',query(item)+'&',query(item).replace('&','&&')])assert.throws(()=>m.parseStrategyHandoff(q));
});

test('query parsing rejects malformed encoding, case changes, fragments, controls and full URLs',async()=>{
 const item=await source();for(const q of [query(item).replace(item.id,item.id.toUpperCase()),query(item).replace(item.digest,item.digest.toUpperCase()),query(item)+'#secret',query(item)+'%','?strategy=%FF&digest='+item.digest,'?strategy=%E0%A4&digest='+item.digest,query(item)+'\n','?strategy='+item.id+'&digest=%00','https://example.com/demo'+query(item),query(item).slice(1),42,null])assert.throws(()=>m.parseStrategyHandoff(q));
 assert.throws(()=>m.parseStrategyHandoff('?'+ 'x'.repeat(m.strategyHandoffLimits.queryBytes)),e=>e.status===413);
});

test('fixed href builder produces only relative pinned Demo/Session destinations',async()=>{
 const item=await source();for(const path of ['/demo','/session']){const href=m.strategyHandoffHref(path,ref(item));assert.equal(href,path+query(item));assert.deepEqual(m.parseStrategyHandoff(new URL(href,'https://local').search),ref(item));}
 for(const path of ['https://example.com','//example.com','/session?url=https://example.com','/demo#run','/api/strategies','javascript:alert(1)'])assert.throws(()=>m.strategyHandoffHref(path,ref(item)));
 for(const value of [{id:item.id},{...ref(item),url:'https://example.com'},{...ref(item),digest:'b'.repeat(63)}])assert.throws(()=>m.strategyHandoffHref('/demo',value));
});

test('verified full public DTO is cloned from a bounded canonical exact record, with no catalog dependency',async()=>{
 const item=await source(),snapshot=copy(item),accepted=await m.verifyStrategyHandoff(ref(item),item);assert.deepEqual(accepted,snapshot);assert.notEqual(accepted,item);item.record.content.description='Changed source object';assert.notEqual(accepted.record.content.description,item.record.content.description);assert.equal(accepted.record.verification,'UNTESTED');assert.equal(accepted.record.executionEnabled,false);
});

test('a visible older immutable revision can be handed off without upgrading to the latest record',async()=>{
 const item=await source();item.id=id(5);item.record.id=id(5);item.revision=2;item.record.revision=2;item.requestId=id(6);item.record.requestId=id(6);item.record.content.relation={type:'REVISION',id:id(1),digest:item.digest};const older=await reseal(item);
 const accepted=await m.verifyStrategyHandoff(ref(older),older);assert.equal(accepted.revision,2);assert.equal(accepted.id,id(5));assert.equal(accepted.rootId,id(1));const latest=await source();await assert.rejects(()=>m.verifyStrategyHandoff(ref(older),latest),e=>e.status===409);
});

test('valid hidden or withdrawn tombstones are unavailable and cannot export even with correct pinned IDs',async()=>{
 const item=await source();for(const state of ['HIDDEN','WITHDRAWN']){const tombstone=copy(item);tombstone.state=state;tombstone.reason=state==='HIDDEN'?'POLICY':'AUTHOR_REQUEST';tombstone.record=null;tombstone.moderation=[{sequence:1,requestId:id(7),createdAt:at,actor:author,state,reason:tombstone.reason}];await assert.rejects(()=>m.verifyStrategyHandoff(ref(item),tombstone),e=>e.status===409);await assert.rejects(()=>m.prepareLocalReceiverConfig(admission(tombstone)),e=>e.status===409);}
});

test('wrong identity, changed digest, inconsistent public metadata and changed body cannot satisfy a pinned reference',async()=>{
 const item=await source();for(const expected of [{...ref(item),id:id(8)},{...ref(item),digest:'a'.repeat(64)}])await assert.rejects(()=>m.verifyStrategyHandoff(expected,item),e=>e.status===409);
 for(const changes of [v=>v.author.id='human_'+'b'.repeat(64),v=>v.revision=2,v=>v.record.content.description='Unhashed replacement',v=>v.record.createdAt='2026-10-11T11:00:00.000Z',v=>v.permissions=['LIVE'],v=>v.record.content.definition.execution.ordersEnabled=true]){const raw=copy(item);changes(raw);await assert.rejects(()=>m.verifyStrategyHandoff(ref(item),raw));}
 const changed=copy(item);changed.record.content.name='Changed and rehashed';const rehashed=await reseal(changed);await assert.rejects(()=>m.verifyStrategyHandoff(ref(item),rehashed),e=>e.status===409);assert.equal((await m.verifyStrategyHandoff(ref(rehashed),rehashed)).record.content.name,'Changed and rehashed');
});

test('all seven families and both directions retain exact nonzero fees, risk and definitions through the real Session constructor',async()=>{
 for(const type of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES'])for(const direction of ['LONG','SHORT']){const item=await source(type,direction),request=admission(item),config=await m.prepareLocalReceiverConfig(request);assert.deepEqual(config.strategy,{record:item.record,digest:item.digest});assert.deepEqual(config.strategy.record.content.definition.costs,{feeBps:23,slippageBps:37});assert.deepEqual(config.strategy.record.content.definition.risk,item.record.content.definition.risk);assert.equal(config.strategy.record.content.definition.market.direction,direction);assert.equal(config.strategy.record.content.definition.entry.type,type);
  assert.equal(config.origin,'PUBLIC_STRATEGY');assert.equal(config.clockMode,'SYSTEM_RECEIPT');assert.equal(config.provenance,'USER_SUPPLIED');assert.equal(config.rights.permission,'AUTHORIZED_USE');assert.equal(config.rights.acknowledged,true);assert.equal(config.rights.note,request.rightsNote);assert.equal(config.sourceLabel,request.sourceLabel);assert.equal(config.ordersEnabled,false);assert.equal(config.liveEnabled,false);assert.equal('startedAt' in config,false);assert.equal('events' in config,false);assert.equal('credentials' in config,false);
  const roundtrip=m.boundedSessionConfig(JSON.parse(JSON.stringify(config))).config;assert.deepEqual(roundtrip,config);const journal=await m.createSessionJournal(roundtrip,'2026-10-11T12:00:00.000Z');assert.equal(journal.events.length,0);assert.equal(journal.state.openPositions.length,0);assert.equal(journal.state.account.equity,1234.5);assert.equal(journal.ordersEnabled,false);assert.deepEqual((await m.verifySessionJournal(journal)).config,config);
 }
});

test('same reviewed inputs preserve configuration identity while supplied capital or session IDs never receive defaults',async()=>{
 const item=await source(),request=admission(item),first=await m.prepareLocalReceiverConfig(request),second=await m.prepareLocalReceiverConfig(copy(request));assert.deepEqual(first,second);assert.deepEqual(request,admission(item));
 for(const amount of [.01,1000000])assert.equal((await m.prepareLocalReceiverConfig(admission(item,{initialCapital:amount}))).initialCapital,amount);
 for(const field of ['source','sessionId','initialCapital','sourceLabel','rightsNote','confirmRights']){const raw=admission(item);delete raw[field];await assert.rejects(()=>m.prepareLocalReceiverConfig(raw));}
 const changed=await m.prepareLocalReceiverConfig(admission(item,{sessionId:id(9),initialCapital:2000}));assert.equal(changed.sessionId,id(9));assert.equal(changed.initialCapital,2000);assert.deepEqual(changed.strategy,first.strategy);
});

test('blank/nonfinite capital, unchecked rights, invalid text and caller governance fields reject before export',async()=>{
 const item=await source();for(const changes of [{initialCapital:''},{initialCapital:'1000'},{initialCapital:0},{initialCapital:.009},{initialCapital:1000001},{initialCapital:NaN},{initialCapital:Infinity},{confirmRights:false},{confirmRights:'true'},{sourceLabel:' '},{rightsNote:''},{rightsNote:'\u0000'},{sourceLabel:'x'.repeat(81)},{rightsNote:'x'.repeat(1001)},{sessionId:id(3).toUpperCase()},{origin:'SYNTHETIC_FIXTURE'},{clockMode:'SYNTHETIC_PLAYBACK'},{ordersEnabled:true},{liveEnabled:true},{rights:{acknowledged:true}},{provider:'ALTFINS'},{apiKey:'secret'},{journal:{}}])await assert.rejects(()=>m.prepareLocalReceiverConfig(admission(item,changes)));
});

test('encoded agent/producer/owner credential material is rejected in all authored exported text',async()=>{
 const item=await source(),values=['og_agent_'+id(20)+'.'+'f'.repeat(64),'og_local_owner_'+'f'.repeat(64),'og_local_producer_'+'e'.repeat(64),'%6f%67%5flocal_owner_'+'d'.repeat(64),'%256f%2567%255fagent_'+id(20)+'.'+'c'.repeat(64),'%25256f%252567%25255flocal_producer_'+'b'.repeat(64)];
 for(const value of values)for(const field of ['sourceLabel','rightsNote'])await assert.rejects(()=>m.prepareLocalReceiverConfig(admission(item,{[field]:value})),/Credentials/);
 const local=copy(item);local.record.author={kind:'AGENT',id:id(30),sponsorId:author.id,name:'og_local_owner_short'};local.author=m.strategyAuthorReference(local.record.author);const malformed=await reseal(local);await assert.rejects(()=>m.verifyStrategyHandoff(ref(malformed),malformed),/Credentials/);
});

test('legitimate registered-agent labels remain intact while local credential names remain forbidden',async()=>{
 const item=await source();item.record.author={kind:'AGENT',id:id(31),sponsorId:author.id,name:'og_agent_researcher'};item.author=m.strategyAuthorReference(item.record.author);const registered=await reseal(item);const accepted=await m.verifyStrategyHandoff(ref(registered),registered),config=await m.prepareLocalReceiverConfig(admission(accepted));assert.equal(config.strategy.record.author.name,'og_agent_researcher');assert.equal(config.strategy.record.author.id,id(31));
});

test('getters, executable/nonplain objects, nonfinite data and depth are rejected before schema admission',async()=>{
 const item=await source();let invoked=false;const raw=admission(item);Object.defineProperty(raw,'source',{enumerable:true,get(){invoked=true;return item;}});await assert.rejects(()=>m.prepareLocalReceiverConfig(raw));assert.equal(invoked,false);
 const bad=copy(item);Object.defineProperty(bad,'record',{enumerable:true,get(){invoked=true;return item.record;}});await assert.rejects(()=>m.verifyStrategyHandoff(ref(item),bad));assert.equal(invoked,false);
 for(const value of [()=>{},new Date(),Object.create({inherited:true}),{value:undefined},{value:Infinity},{toJSON:()=>{invoked=true;return item;}}])await assert.rejects(()=>m.prepareLocalReceiverConfig(value));assert.equal(invoked,false);
 let deep={};for(let n=0;n<27;n++)deep={deep};await assert.rejects(()=>m.verifyStrategyHandoff(ref(item),deep),e=>e.status===413);
});

test('whole raw source/admission budgets reject oversized unknown data before schema parsing',async()=>{
 const item=await source();await assert.rejects(()=>m.verifyStrategyHandoff(ref(item),{padding:'x'.repeat(m.strategyHandoffLimits.sourceBytes)}),e=>e.status===413);await assert.rejects(()=>m.prepareLocalReceiverConfig({padding:'x'.repeat(m.strategyHandoffLimits.sourceBytes+2048)}),e=>e.status===413);await assert.rejects(()=>m.verifyStrategyHandoff({...ref(item),padding:'x'.repeat(256)},item),e=>e.status===413);
});

test('valid large canonical content remains unchanged rather than being truncated or replaced with defaults',async()=>{
 const item=await source('RULES');item.record.content.description='D'.repeat(3000);item.record.content.assumptions='A'.repeat(1500);item.record.content.falsification='F'.repeat(2000);item.record.content.sources=Array.from({length:8},(_,n)=>({url:'https://example.com/'+n+'x'.repeat(1800),classification:'AUTHOR_CLAIM',note:'N'.repeat(300)}));const large=await reseal(item),config=await m.prepareLocalReceiverConfig(admission(large,{rightsNote:'R'.repeat(1000),sourceLabel:'S'.repeat(80)}));assert.deepEqual(config.strategy.record,large.record);assert.equal(config.strategy.record.content.description.length,3000);assert.equal(config.rights.note.length,1000);assert.equal(config.sourceLabel.length,80);m.boundedSessionConfig(config);
});
