import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const bundle = await build({stdin:{contents:"export {strategyHumanRequest} from './app/strategy-http';export {strategyPublicHumanId,strategyTemplate,boundedStrategyRecord,strategyDigest,strategyAuthorReference} from './app/strategy-model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,target:'es2022'});
const module={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const m=module.exports, at='2026-10-11T10:00:00.000Z';
const sent={action:'publish',requestId:'40000000-0000-4000-8000-000000000001',id:'40000000-0000-4000-8000-000000000002',name:'Invented optional author guard fixture',description:'Synthetic handler evidence only.',assumptions:'No performance is measured.',falsification:'A matching receipt is not strategy qualification.',sources:[],definition:m.strategyTemplate('TREND'),relation:null,policyAccepted:'public-strategy-v1'};
async function run(userId,expectedAuthor){
 const headers={'Origin':'https://fixture.opengrail.test','X-Strategy-Intent':'submit','Content-Type':'application/json'};
 if(expectedAuthor!==undefined)headers['X-Strategy-Author']=expectedAuthor;
 const request=new Request('https://fixture.opengrail.test/api/strategies',{method:'POST',headers,body:JSON.stringify(sent)});
 let writes=0, identity;
 const response=await m.strategyHumanRequest(request,{userId},()=>({async write(actor,command,time){
  writes++;identity=actor.userId;const authorId=await m.strategyPublicHumanId(actor.userId);
  const {record,payload}=m.boundedStrategyRecord({version:1,id:command.id,rootId:command.id,revision:1,requestId:command.requestId,createdAt:time,author:{kind:'HUMAN',id:authorId,sponsorId:authorId},content:{name:command.name,description:command.description,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,definition:command.definition,relation:command.relation},policyAccepted:command.policyAccepted,verification:'UNTESTED',executionEnabled:false});
  const item={id:record.id,digest:await m.strategyDigest(payload),rootId:record.rootId,revision:1,requestId:record.requestId,createdAt:record.createdAt,author:m.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]};
  return {version:1,action:'publish',requestId:command.requestId,item,report:null,executionEnabled:false};
 }}),()=>false,()=>at);
 return {response,writes,identity};
}

test('optional frozen strategy author refuses an account swap before calling the existing writer',async()=>{
 const original=await m.strategyPublicHumanId('invented-first-human');
 const result=await run('invented-second-human',original);
 assert.equal(result.response.status,403);assert.equal(result.writes,0);
 assert.equal((await result.response.json()).error,'Strategy account changed. Preserve the original operation.');
});
test('malformed expected author refuses without publishing or reflecting its value',async()=>{
 for(const bad of ['human_'+'A'.repeat(64),'human_'+'a'.repeat(63),'not-an-identity']){
  const result=await run('invented-first-human',bad);
  assert.equal(result.response.status,403);assert.equal(result.writes,0);
  assert(!(await result.response.text()).includes(bad));
 }
});
test('matching frozen strategy author and prior clients omitting the optional guard preserve existing publication behavior',async()=>{
 const user='invented-first-human',author=await m.strategyPublicHumanId(user);
 for(const expected of [author,undefined]){
  const result=await run(user,expected),body=await result.response.json();
  assert.equal(result.response.status,200);assert.equal(result.writes,1);assert.equal(result.identity,user);
  assert.equal(body.item.author.id,author);assert.equal(body.item.record.verification,'UNTESTED');
  assert.equal(body.item.record.content.definition.execution.ordersEnabled,false);
 }
});
