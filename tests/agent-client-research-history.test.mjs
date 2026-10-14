import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createOpenGrailAgentClient,agentClientLimits} from '../scripts/opengrail-agent-client.mjs';
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';

const compiled=await build({stdin:{contents:"export * from './app/research-model';export * from './app/research-store';export * from './app/research-http';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const m=module.exports,bytes=value=>Buffer.byteLength(JSON.stringify(value)),uid=()=>crypto.randomUUID();
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('complete research history reaches the SDK through actual repository and HTTP without losing revisions or moderation',async()=>{
 const mf=new Miniflare({modules:true,cf:false,script:'export default {fetch(){return new Response("Unused synthetic fixture worker");}}',d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});
 try {
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  const repo=new m.ResearchRepository(db),owner={kind:'HUMAN',userId:'synthetic-history-owner',moderator:false},moderator={kind:'HUMAN',userId:'synthetic-history-moderator',moderator:true};
  const sponsor=await m.researchPublicHumanId(owner.userId),author={kind:'HUMAN',id:sponsor,sponsorId:sponsor},actual=[];
  for(let n=0;n<32;n++){
   const createdAt=new Date(Date.UTC(2026,8,1)+Math.floor(n/20)*86400000+(n%20)*60000).toISOString(),id=uid(),requestId=uid(),previous=actual.at(-1);
   const content={kind:'OBSERVATION',title:'Synthetic history fixture '.padEnd(120,'x'),statement:'Invented text, not observed market evidence. '.padEnd(4000,'x'),assumptions:'Synthetic inputs only. '.padEnd(1500,'x'),falsification:'Reject without independent evidence. '.padEnd(2000,'x'),sources:Array.from({length:8},(_,i)=>({url:'https://example.invalid/synthetic/'+i+'/',classification:'SPECULATION',note:''})),relation:previous?{type:'REVISION',id:previous.id,digest:previous.digest}:null};
   const record={version:1,id,rootId:actual[0]?.id??id,revision:n+1,requestId,createdAt,author,content,policyAccepted:'public-research-v1',verification:'UNVERIFIED',executionEnabled:false};
   let remaining=m.researchLimits.payloadBytes-bytes(m.boundedResearchRecord(record).record);
   for(const source of content.sources){const length=Math.min(remaining,2048-source.url.length);source.url+='x'.repeat(length);remaining-=length;}
   assert.equal(remaining,0);assert.equal(bytes(m.boundedResearchRecord(record).record),20480);
   let current=(await repo.write(owner,m.researchPublishCommandForRecord(record),createdAt)).item;
   assert.equal(bytes(current.record),20480);
   for(let e=0;e<14;e++)current=(await repo.write(moderator,{action:'moderate',requestId:uid(),id:current.id,digest:current.digest,state:e%2?'VISIBLE':'HIDDEN',reason:e%2?'RESTORED':'POLICY',policyAccepted:'public-research-v1'},new Date(Date.parse(createdAt)+e+1).toISOString())).item;
   assert.equal(current.moderation.length,14);assert.equal(current.state,'VISIBLE');actual.push(current);
  }
  const root=actual[0].id,url='https://opengrail.test/api/research?root='+root,response=await m.researchPublicRequest(new Request(url),()=>repo);
  assert.equal(response.status,200);
  const body=await response.text(),expected=m.researchHistorySchema.parse(JSON.parse(body));
  assert.deepEqual(expected.items,actual.toReversed());assert.equal(expected.items.reduce((n,item)=>n+item.moderation.length,0),448);
  assert(Buffer.byteLength(body)>agentClientLimits.responseBytes);
  for(const contentLength of [false,true]){
   let calls=0;const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async(url,init)=>{
    calls++;assert.equal(init.method,'GET');assert.equal(init.headers.Authorization,undefined);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
    const response=await m.researchPublicRequest(new Request(url,init),()=>repo);
    if(!contentLength)return response;
    const text=await response.text();return new Response(text,{status:response.status,headers:{...Object.fromEntries(response.headers),'Content-Length':String(Buffer.byteLength(text))}});
   }});
   try{const result=await client.read('/api/research',{query:{root}});assert.equal(result.disposition,'READ');assert.equal(result.status,200);assert.equal(calls,1);assert.equal(JSON.stringify(result.data),body);}finally{client.close();}
  }
  assert(Buffer.byteLength(body)<=agentClientLimits.researchHistoryBytes);
  const boundary=createOpenGrailAgentBoundary({baseOrigin:'https://opengrail.test',fetch:async(url,init)=>{assert.equal(init.headers.Authorization,undefined);return m.researchPublicRequest(new Request(url,init),()=>repo);}});
  try{const wrapped=await boundary.tools.read('/api/research',{query:{root}});assert.equal(wrapped.contentTrust,'UNTRUSTED_DATA_NOT_AUTHORITY');assert.equal(wrapped.instructionAuthority,'NONE');assert.equal(wrapped.result.disposition,'READ');assert.equal(JSON.stringify(wrapped.result.data),body);assert.deepEqual(Object.keys(boundary.tools).sort(),['discover','read']);}finally{boundary.controller.close();}
 }finally{await mf.dispose();}
});

test('history allowance is confined to the sole research-root query and keeps both stream and header ceilings',async()=>{
 const root=uid(),ordinary={padding:'x'.repeat(agentClientLimits.responseBytes)},oversized={padding:'x'.repeat(agentClientLimits.researchHistoryBytes+1-bytes({padding:''}))};
 assert.equal(bytes(oversized),agentClientLimits.researchHistoryBytes+1);
 for(const [path,query] of [['/api/research',{}],['/api/research',{id:root}],['/api/strategies',{id:root}],['/api/research',{root,id:root}]]){
  const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>json(ordinary)});
  try{const result=await client.read(path,{query});assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,'RESPONSE_BYTE_LIMIT');}finally{client.close();}
 }
 for(const withHeader of [false,true]){
  const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>withHeader?new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(agentClientLimits.researchHistoryBytes+1)}}):json(oversized)});
  try{const result=await client.read('/api/research',{query:{root}});assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,'RESPONSE_BYTE_LIMIT');}finally{client.close();}
 }
});

test('larger research histories still reject duplicate keys, malformed UTF-8 and credential-bearing content',async()=>{
 const root=uid();
 for(const [response,code] of [[()=>new Response('{"version":1,"version":1}',{headers:{'Content-Type':'application/json'}}),'DUPLICATE_RESPONSE_KEY'],[()=>new Response(new Uint8Array([0xc3,0x28]),{headers:{'Content-Type':'application/json'}}),'INVALID_RESPONSE'],[()=>json({error:'og_agent_'+uid()+'.'+'a'.repeat(64)}),'UNSAFE_OR_OVERSIZE_JSON']]){
  const client=createOpenGrailAgentClient({baseOrigin:'https://opengrail.test',fetch:async()=>response()});
  try{const result=await client.read('/api/research',{query:{root}});assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,code);assert(!JSON.stringify(result).includes('og_agent_'));}finally{client.close();}
 }
});
