import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOpenGrailAgentClient} from '../scripts/opengrail-agent-client.mjs';
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';

const agentId='33333333-3333-4333-8333-333333333333',credentialId='44444444-4444-4444-8444-444444444444',credential=['og','agent',credentialId+'.'+'ab'.repeat(32)].join('_');
const encoded=value=>Array.from(value,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
const nested=(value,count)=>{let result=encoded(value);for(let n=1;n<count;n++)result=result.replaceAll('%','%25');return result;};
const all=encoded(credential),variants=[
 ['malformed percent suffix',all+'%zz'],
 ['mixed hexadecimal prefix and malformed suffix',encoded(credential.slice(0,9)).toUpperCase()+credential.slice(9)+'%x0'],
 ['contiguous invalid UTF8 suffix',all+'%ff'],
 ['contiguous invalid UTF8 prefix','%c0%af'+all],
 ['nested malformed percent suffix',encoded(all+'%zz')],
 ['nested invalid UTF8 suffix',encoded(all+'%ff')],
 ['eighth encoding layer',nested(credential,8)],
 ['ninth encoding layer',nested(credential,9)],
];
function fixture(payload,{key=false,jsonEscapePercent=false}={}){
 let calls=0,authorized=false;let body=JSON.stringify(key?{[payload]:'data'}:{note:payload});if(jsonEscapePercent)body=body.replaceAll('%','\\u0025');
 const fetch=async(_url,init)=>{calls++;authorized||=Object.hasOwn(init.headers,'Authorization');return new Response(body,{headers:{'Content-Type':'application/json'}});};
 const options={baseOrigin:'http://127.0.0.1:5197',credential,agentId,testAdapter:{kind:'SYNTHETIC_LOOPBACK_ONLY',fetch}},client=createOpenGrailAgentClient(options),boundary=createOpenGrailAgentBoundary(options);
 return {client,boundary,counts:()=>({calls,authorized}),bodyBytes:Buffer.byteLength(body),close(){client.close();boundary.controller.close();}};
}
async function refusedIncoming(payload,options={},code='UNSAFE_OR_OVERSIZE_JSON'){
 const f=fixture(payload,options);try{assert(f.bodyBytes<786432);const direct=await f.client.read('/api/research'),wrapped=await f.boundary.tools.read('/api/research');for(const result of [direct,wrapped.result]){assert.equal(result.disposition,'READ_UNAVAILABLE');assert.equal(result.code,code);assert.equal(Object.hasOwn(result,'data'),false);}assert.equal(wrapped.instructionAuthority,'NONE');assert.equal(f.counts().calls,2);assert.equal(f.counts().authorized,false);}finally{f.close();}
}
for(const[name,payload]of variants)test('incoming credential scan refuses '+name+' before model exposure',()=>refusedIncoming(payload));
test('incoming encoded object key with malformed UTF8 is refused as UNSAFE_JSON',()=>refusedIncoming(all+'%ff',{key:true},'UNSAFE_JSON'));
test('incoming JSON unicode escapes preserve percent-pattern refusal with malformed UTF8',()=>refusedIncoming(all+'%ff',{jsonEscapePercent:true}));
test('benign malformed and UTF8 percent content stays unchanged through client and model tools',async()=>{
 for(const payload of ['public%20research%zz','snowman%20%E2%98%83%ff',nested('ordinary research',7)]){const f=fixture(payload);try{const direct=await f.client.read('/api/research'),wrapped=await f.boundary.tools.read('/api/research');for(const result of [direct,wrapped.result]){assert.equal(result.disposition,'READ');assert.equal(result.data.note,payload);}assert.equal(wrapped.instructionAuthority,'NONE');assert.equal(f.counts().authorized,false);}finally{f.close();}}
});
test('deep benign percent encoding exhausts the existing eight-round scan bound below byte capacity',()=>refusedIncoming(nested('ordinary research',9)));
for(const[name,payload]of variants.filter(([name])=>!name.includes('encoding layer')))test('outgoing preparation refuses '+name+' without transport',()=>{
 const f=fixture('inert');try{assert.throws(()=>f.boundary.controller.prepareWrite('/api/research/agent',{action:'publish',requestId:'55555555-5555-4555-8555-555555555555',id:'66666666-6666-4666-8666-666666666666',policyAccepted:'public-research-v1',statement:payload}),error=>error.code==='CREDENTIAL_EXPOSURE');assert.equal(f.counts().calls,0);}finally{f.close();}
});
test('outgoing deep benign percent encoding exhausts the existing 32-round preparation bound',()=>{
 const f=fixture('inert');try{assert.throws(()=>f.boundary.controller.prepareWrite('/api/research/agent',{statement:nested('ordinary research',33)}),error=>error.code==='STRUCTURE_LIMIT');assert.equal(f.counts().calls,0);}finally{f.close();}
});
