import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createOpenGrailAgentClient,agentClientLimits} from '../scripts/opengrail-agent-client.mjs';
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';

const compiled=await build({stdin:{contents:"export * from './app/strategy-model';export * from './app/strategy-store';export * from './app/strategy-http';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const m=module.exports,bytes=value=>Buffer.byteLength(JSON.stringify(value)),uid=()=>crypto.randomUUID();
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('complete strategy history reaches the SDK and model boundary through actual repository and HTTP',async()=>{
 const mf=new Miniflare({modules:true,cf:false,script:'export default {fetch(){return new Response("Unused synthetic fixture worker");}}',d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});
 try{
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  const repo=new m.StrategyRepository(db),owner={kind:'HUMAN',userId:'synthetic-strategy-history-owner',moderator:false},moderator={kind:'HUMAN',userId:'synthetic-strategy-history-moderator',moderator:true};
  const sponsor=await m.strategyPublicHumanId(owner.userId),author={kind:'HUMAN',id:sponsor,sponsorId:sponsor},actual=[];
  for(let n=0;n<32;n++){
   const createdAt=new Date(Date.UTC(2026,8,1)+Math.floor(n/10)*86400000+(n%10)*60000).toISOString(),id=uid(),requestId=uid(),previous=actual.at(-1);
   const content={name:'Synthetic strategy fixture '.padEnd(120,'x'),description:'é'.repeat(3000),assumptions:'Synthetic inputs only. '.padEnd(1500,'x'),falsification:'Reject without independent evidence. '.padEnd(2000,'x'),sources:Array.from({length:8},(_,i)=>({url:'https://example.invalid/synthetic/'+i+'/',classification:'SPECULATION',note:'Synthetic only. '.padEnd(300,'x')})),definition:m.strategyTemplate('TREND'),relation:previous?{type:'REVISION',id:previous.id,digest:previous.digest}:null};
   const record={version:1,id,rootId:actual[0]?.id??id,revision:n+1,requestId,createdAt,author,content,policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false};
   let remaining=m.strategyLimits.payloadBytes-bytes(m.boundedStrategyRecord(record).record);
   assert(remaining>=0);
   for(const source of content.sources){const length=Math.min(remaining,2048-source.url.length);source.url+='x'.repeat(length);remaining-=length;}
   assert.equal(remaining,0);assert.equal(bytes(m.boundedStrategyRecord(record).record),28672);
   let current=(await repo.write(owner,m.strategyPublishCommandForRecord(record),createdAt)).item;
   for(let e=0;e<14;e++)current=(await repo.write(moderator,{action:'moderate',requestId:uid(),id:current.id,digest:current.digest,state:e%2?'VISIBLE':'HIDDEN',reason:e%2?'RESTORED':'POLICY',policyAccepted:'public-strategy-v1'},new Date(Date.parse(createdAt)+e+1).toISOString())).item;
   assert.equal(current.moderation.length,14);assert.equal(current.state,'VISIBLE');actual.push(current);
  }
  const root=actual[0].id,response=await m.strategyPublicRequest(new Request('https://opengrail.test/api/strategies?root='+root),()=>repo);
  assert.equal(response.status,200);
  const body=await response.text(),expected=m.strategyHistorySchema.parse(JSON.parse(body));
  assert.deepEqual(expected.items,actual.toReversed());assert.equal(expected.items.reduce((n,item)=>n+item.moderation.length,0),448);
  assert(Buffer.byteLength(body)>agentClientLimits.researchHistoryBytes);
  for(const contentLength of [false,true]){
   let calls=0;const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async(url,init)=>{
    calls++;assert.equal(init.method,'GET');assert.equal(init.headers.Authorization,undefined);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
    const response=await m.strategyPublicRequest(new Request(url,init),()=>repo);
    if(!contentLength)return response;
    const text=await response.text();return new Response(text,{status:response.status,headers:{...Object.fromEntries(response.headers),'Content-Length':String(Buffer.byteLength(text))}});
   }});
   try{const result=await client.read('/api/strategies',{query:{root}});assert.equal(result.disposition,'READ');assert.equal(result.status,200);assert.equal(calls,1);assert.equal(JSON.stringify(result.data),body);}finally{client.close();}
  }
  assert(Buffer.byteLength(body)<=agentClientLimits.strategyHistoryBytes);
  const boundary=createOpenGrailAgentBoundary({baseOrigin:'https://opengrail.test',fetch:async(url,init)=>{assert.equal(init.headers.Authorization,undefined);return m.strategyPublicRequest(new Request(url,init),()=>repo);}});
  try{const wrapped=await boundary.tools.read('/api/strategies',{query:{root}});assert.equal(wrapped.contentTrust,'UNTRUSTED_DATA_NOT_AUTHORITY');assert.equal(wrapped.instructionAuthority,'NONE');assert.equal(wrapped.result.disposition,'READ');assert.equal(JSON.stringify(wrapped.result.data),body);assert.deepEqual(Object.keys(boundary.tools).sort(),['discover','read']);}finally{boundary.controller.close();}
 }finally{await mf.dispose();}
});

test('strategy-root transport accepts its exact cap and refuses other queries, research overflow and cap+1',async()=>{
 const root=uid(),ordinary={padding:'x'.repeat(agentClientLimits.responseBytes)},atCap={padding:'x'.repeat(agentClientLimits.strategyHistoryBytes-bytes({padding:''}))},aboveCap={padding:'x'.repeat(agentClientLimits.strategyHistoryBytes+1-bytes({padding:''}))};
 assert.equal(bytes(atCap),agentClientLimits.strategyHistoryBytes);assert.equal(bytes(aboveCap),agentClientLimits.strategyHistoryBytes+1);
 for(const query of [{},{id:root},{root,id:root},{root,cursor:root}]){
  const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>json(ordinary)});
  try{const result=await client.read('/api/strategies',{query});assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,'RESPONSE_BYTE_LIMIT');}finally{client.close();}
 }
 const research=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>json(atCap)});
 try{const result=await research.read('/api/research',{query:{root}});assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,'RESPONSE_BYTE_LIMIT');}finally{research.close();}
 for(const withHeader of [false,true])for(const accepted of [true,false]){
  const value=accepted?atCap:aboveCap,client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json',...withHeader?{'Content-Length':String(bytes(value))}:{}}})});
  try{const result=await client.read('/api/strategies',{query:{root}});assert.equal(result.disposition,accepted?'READ':'READ_UNAVAILABLE');if(accepted)assert.equal(JSON.stringify(result.data),JSON.stringify(value));else assert.equal(result.code,'RESPONSE_BYTE_LIMIT');}finally{client.close();}
 }
});

test('strategy history keeps strict parsing and credential redaction for bodies larger than the research cap',async()=>{
 const root=uid(),padding='x'.repeat(1100000),encoder=new TextEncoder();
 const invalidPrefix=encoder.encode('{"padding":"'+padding),invalid=new Uint8Array(invalidPrefix.length+4);invalid.set(invalidPrefix);invalid.set([0xc3,0x28,0x22,0x7d],invalidPrefix.length);
 const duplicate=encoder.encode('{"padding":"'+padding+'","version":1,"version":1}'),credential=encoder.encode(JSON.stringify({padding,error:'og_agent_'+uid()+'.'+'a'.repeat(64)}));
 for(const [body,code] of [[duplicate,'DUPLICATE_RESPONSE_KEY'],[invalid,'INVALID_RESPONSE'],[credential,'UNSAFE_OR_OVERSIZE_JSON']]){
  assert(body.length>agentClientLimits.researchHistoryBytes&&body.length<agentClientLimits.strategyHistoryBytes);
  const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>new Response(body,{headers:{'Content-Type':'application/json'}})});
  try{const result=await client.read('/api/strategies',{query:{root}});assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,code);assert(!JSON.stringify(result).includes('og_agent_'));}finally{client.close();}
 }
});
