import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const modelBundle=await build({stdin:{contents:"export * from './app/assistance-model';export * from './app/assistance-handoff';export * from './app/assistance-http';export * from './app/strategy-model';export {createNetworkToken} from './app/network-model';export {NetworkRepository} from './app/network-store';export {AssistanceRepository} from './app/assistance-store';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',target:'es2022',write:false});
const module={exports:{}};new Function('require','module','exports',modelBundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const m=module.exports;
const origin='https://assistance-pipeline.test',at=new Date(Date.now()-2000).toISOString();
// Synthetic human admission/time only. Enrollment, hashed registry credentials,
// public HTTP handlers, SQL fences, repositories and reads are the real local code.
// The acknowledgment-loss fixture discards a response after its actual committed write.
const source=`import {networkOwnerRequest,networkAgentRequest} from './app/network-http';import {NetworkRepository} from './app/network-store';
import {strategyHumanRequest,strategyAgentRequest,strategyPublicRequest} from './app/strategy-http';import {StrategyRepository} from './app/strategy-store';
import * as h from './app/assistance-http';import {AssistanceRepository} from './app/assistance-store';
export default {async fetch(request,env){const path=new URL(request.url).pathname,now=()=>request.headers.get('X-Fixture-Time')??env.FIXTURE_AT,user=request.headers.get('X-Fixture-Actor'),actor=user?{userId:user}:null,moderator=id=>['synthetic-assistance-maintainer','synthetic-assistance-maintainer-b'].includes(id);
const network=()=>new NetworkRepository(env.DB),strategy=()=>new StrategyRepository(env.DB),assistance=()=>new AssistanceRepository(env.DB);let response;
if(path==='/api/network/agents')response=await networkOwnerRequest(request,actor,network,now);
else if(path==='/api/network/agent')response=await networkAgentRequest(request,network,now);
else if(path==='/api/strategies/agent')response=await strategyAgentRequest(request,strategy,network,now);
else if(path==='/api/strategies')response=await(request.method==='GET'?strategyPublicRequest(request,strategy):strategyHumanRequest(request,actor,strategy,moderator,now));
else if(path==='/api/assistance/agent')response=await h.assistanceAgentRequest(request,assistance,network,now);
else if(path==='/api/assistance/me')response=await h.assistanceMeRequest(request,actor,moderator);
else if(path==='/api/assistance/reports')response=await h.assistanceReportsRequest(request,actor,assistance,moderator,now);
else if(path==='/api/assistance')response=await(request.method==='GET'?h.assistancePublicRequest(request,assistance):h.assistanceHumanRequest(request,actor,assistance,moderator,now));
else response=new Response(null,{status:404});
if(request.headers.get('X-Fixture-Lose-Acknowledgment')==='yes'&&request.method==='POST'&&response.status===200)return Response.json({error:'Synthetic acknowledgment unavailable after commit.'},{status:503,headers:h.assistanceHeaders});return response;}};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});
const worker=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at}});
let db;
before(async()=>{db=await worker.getD1Database('DB');for(const file of readdirSync('drizzle').filter(v=>v.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
beforeEach(async()=>{for(const table of ['assistance_reports','assistance_moderation','assistance_publications','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await worker.dispose());
const uid=()=>crypto.randomUUID(),op=()=>({requestId:uid(),id:uid()}),ref=item=>({id:item.id,digest:item.digest}),count=async(table='assistance_publications')=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
async function humanHeaders(owner,kind='assistance',extra={}){return {'X-Fixture-Actor':owner,Origin:origin,'Content-Type':'application/json',['X-'+(kind==='assistance'?'Assistance':'Strategy')+'-Intent']:'submit',...(kind==='assistance'?{'X-Assistance-Author':await m.strategyPublicHumanId(owner)}:{'X-Strategy-Author':await m.strategyPublicHumanId(owner)}),...extra};}
async function humanPost(owner,command,kind='assistance',extra={}){return worker.dispatchFetch(origin+'/api/'+(kind==='assistance'?'assistance':'strategies'),{method:'POST',headers:await humanHeaders(owner,kind,extra),body:typeof command==='string'?command:JSON.stringify(command)});}
const machinePost=(agent,command,kind='assistance',extra={})=>worker.dispatchFetch(origin+'/api/'+(kind==='assistance'?'assistance':'strategies')+'/agent',{method:'POST',headers:{Authorization:'Bearer '+agent.token,'Content-Type':'application/json',...extra},body:typeof command==='string'?command:JSON.stringify(command)});
const get=(path)=>worker.dispatchFetch(origin+path);
async function accepted(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
async function agent(owner=uid(),name='Synthetic registered assistance agent'){
 const key=await m.createNetworkToken(),command={action:'register',...op(),credentialId:key.credentialId,name,tokenDigest:key.tokenDigest,days:7};
 const registration=await worker.dispatchFetch(origin+'/api/network/agents',{method:'POST',headers:{'X-Fixture-Actor':owner,Origin:origin,'Content-Type':'application/json','X-Network-Intent':'onboard'},body:JSON.stringify(command)});await accepted(registration);
 const identity=await accepted(await worker.dispatchFetch(origin+'/api/network/agent',{headers:{Authorization:'Bearer '+key.token}}));assert.equal(identity.agent.id,command.id);assert.equal(identity.agent.credentialId,key.credentialId);assert.equal(identity.agent.scope,'PUBLIC_RESEARCH_SUBMIT');
 return {...key,owner,command,identity};
}
const strategyCommand=(patch={})=>({action:'publish',...op(),name:'Synthetic exact-base strategy',description:'Synthetic definition; no evaluation or measured return.',assumptions:'Costs remain authored assumptions.',falsification:'Reject future claims without exact independent evidence.',sources:[],definition:m.strategyTemplate('TREND'),relation:null,policyAccepted:'public-strategy-v1',...patch});
const requestCommand=base=>({action:'request',...op(),base:ref(base),intent:'Propose a slower trend entry while retaining explicit costs.',constraints:'Preserve BTC/USDT, 1h, Demo, leverage one and disabled orders.',falsification:'Reject if no actual field changes, if execution becomes enabled or if unmeasured returns are claimed.',policyAccepted:'public-assistance-v1'});
const responseCommand=(request,proposal,patch={})=>({action:'respond',...op(),request:ref(request),proposal:ref(proposal),rationale:'Increase the slow period from 50 to 60 as a hypothesis for later testing. No return has been measured.',questions:'Is a slower author-defined entry acceptable for later unseen evaluation?',policyAccepted:'public-assistance-v1',...patch});
async function setup(){const owner=uid(),a=await agent(owner),base=(await accepted(await humanPost(owner,strategyCommand(),'strategy'))).item,command=requestCommand(base),request=(await accepted(await humanPost(owner,command))).item;return {owner,a,base,command,request};}
async function proposal(f,a=f.a,base=f.base){const definition=structuredClone(base.record.content.definition);definition.entry.slowPeriod=60;const command=strategyCommand({name:'Synthetic external-agent proposal',definition,relation:{type:'FORK',...ref(base)}}),receipt=await accepted(await machinePost(a,command,'strategy'));assert.equal(receipt.item.author.kind,'AGENT');return {command,receipt,item:receipt.item};}
async function completed(){const f=await setup(),p=await proposal(f),command=responseCommand(f.request,p.item),response=(await accepted(await machinePost(f.a,command))).item;return {...f,proposal:p.item,proposalCommand:p.command,response,responseCommand:command};}

test('actual human request → registered AGENT strategy FORK → linked response → explicitly reviewed HUMAN adoption',async()=>{
 const f=await completed(),before=await count('strategy_publications');
 const feed=await accepted(await get('/api/assistance'));assert.equal(feed.items.length,1);assert.equal(feed.items[0].kind,'REQUEST');
 const responses=await accepted(await get('/api/assistance?request='+f.request.id));assert.equal(responses.items.length,1);assert.equal(responses.items[0].kind,'RESPONSE');
 const bundle=await m.validateAssistanceHandoff({base:(await accepted(await get('/api/strategies?id='+f.base.id))).item,request:(await accepted(await get('/api/assistance?id='+f.request.id))).item,response:(await accepted(await get('/api/assistance?id='+f.response.id))).item,proposal:(await accepted(await get('/api/strategies?id='+f.proposal.id))).item});
 assert.deepEqual(m.assistanceDefinitionChanges(bundle.base,bundle.proposal),[{path:'entry.slowPeriod',before:'50',after:'60'}]);assert.equal(await count('strategy_publications'),before);
 const me=await accepted(await worker.dispatchFetch(origin+'/api/assistance/me',{headers:{'X-Fixture-Actor':f.owner}}));
 const pending=await m.prepareAssistanceAdoption({...bundle,principal:me,...op(),name:'Human-reviewed synthetic fork',confirmAdoption:true});
 assert.equal(await count('strategy_publications'),before);assert.equal(pending.command.relation.type,'FORK');assert.deepEqual(pending.command.relation,{type:'FORK',...ref(f.proposal)});assert.deepEqual(pending.command.definition,f.proposal.record.content.definition);
 const lost=await humanPost(f.owner,pending.body,'strategy',{'X-Fixture-Lose-Acknowledgment':'yes'});assert.equal(lost.status,503);assert.equal(await count('strategy_publications'),before+1);await assert.rejects(m.validateAssistancePendingReceipt(await lost.json(),pending,503));
 const adopted=await accepted(await humanPost(f.owner,pending.body,'strategy'));await m.validateAssistancePendingReceipt(adopted,pending,200);
 assert.equal(adopted.item.author.kind,'HUMAN');assert.equal(adopted.item.author.id,me.authorId);assert.equal(adopted.item.record.verification,'UNTESTED');assert.deepEqual(adopted.item.record.content.definition.execution,{mode:'DEMO',leverage:1,ordersEnabled:false});assert.equal(await count('strategy_publications'),before+1);
 const publicText=JSON.stringify({feed,responses,adopted});for(const secret of [f.owner,f.a.token,f.a.tokenDigest,'ownerId','registryDigest'])assert(!publicText.includes(secret));
});

test('real committed writes with lost acknowledgments reconcile only identical original commands and principal',async()=>{
 const owner=uid(),a=await agent(owner),base=(await accepted(await humanPost(owner,strategyCommand(),'strategy'))).item,command=requestCommand(base),body=JSON.stringify(command);
 assert.equal((await humanPost(owner,body,'assistance',{'X-Fixture-Lose-Acknowledgment':'yes'})).status,503);assert.equal(await count(),1);
 const first=await accepted(await humanPost(owner,body));assert.deepEqual(await accepted(await humanPost(owner,body)),first);assert.equal(await count(),1);
 assert.equal((await humanPost(owner,{...command,intent:'Repurposed unknown operation'})).status,409);assert.equal((await humanPost(uid(),body)).status,409);
 const f={owner,a,base,request:first.item},p=await proposal(f),response=responseCommand(first.item,p.item),responseBody=JSON.stringify(response);
 assert.equal((await machinePost(a,responseBody,'assistance',{'X-Fixture-Lose-Acknowledgment':'yes'})).status,503);assert.equal(await count(),2);
 const confirmed=await accepted(await machinePost(a,responseBody));assert.deepEqual(await accepted(await machinePost(a,responseBody)),confirmed);
 const sibling=await agent(owner,'Another synthetic registered agent');assert([403,409].includes((await machinePost(sibling,responseBody)).status));assert.equal(await count(),2);
 const hide={action:'moderate',requestId:uid(),id:first.item.id,digest:first.item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-assistance-v1'};await accepted(await humanPost('synthetic-assistance-maintainer',hide));
 const redacted=await accepted(await machinePost(a,responseBody));assert.equal(redacted.item.availability,'DEPENDENCY_UNAVAILABLE');assert.equal(redacted.item.state,'VISIBLE');assert.equal(redacted.item.record,null);assert(!JSON.stringify(redacted).includes(response.rationale));assert.equal(await count(),2);assert.equal(body,JSON.stringify(command));
});

test('actual wrong role, base, proposal digest and another agent authorship cannot link a response',async()=>{
 const f=await setup(),p=await proposal(f),command=responseCommand(f.request,p.item);
 assert.equal((await humanPost(f.owner,command)).status,403);assert.equal((await machinePost(f.a,requestCommand(f.base))).status,403);
 assert.equal((await machinePost(f.a,{...command,proposal:{...command.proposal,digest:'0'.repeat(64)}})).status,404);
 const otherBase=(await accepted(await humanPost(f.owner,strategyCommand(),'strategy'))).item,foreignBase=await proposal(f,f.a,otherBase);assert([403,409].includes((await machinePost(f.a,responseCommand(f.request,foreignBase.item))).status));
 const sibling=await agent(f.owner,'Sibling proposal agent'),foreignAuthor=await proposal(f,sibling);assert([403,409].includes((await machinePost(f.a,responseCommand(f.request,foreignAuthor.item))).status));
 const humanProposal=(await accepted(await humanPost(f.owner,strategyCommand({relation:{type:'FORK',...ref(f.base)}}),'strategy'))).item;assert([403,409].includes((await machinePost(f.a,responseCommand(f.request,humanProposal))).status));
 assert.equal(await count(),1);assert.equal((await accepted(await get('/api/assistance?request='+f.request.id))).items.length,0);
});

test('one proposal binds once under concurrent actual writes; hidden dependencies suppress content and block fresh work',async()=>{
 const f=await setup(),p=await proposal(f),commands=[responseCommand(f.request,p.item),responseCommand(f.request,p.item)],replies=await Promise.all(commands.map(command=>machinePost(f.a,command)));assert.deepEqual(replies.map(v=>v.status).sort(),[200,409]);assert.equal(await count(),2);
 const acceptedIndex=replies.findIndex(v=>v.status===200),response=(await replies[acceptedIndex].json()).item;
 const hide={action:'moderate',requestId:uid(),id:p.item.id,digest:p.item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'};await accepted(await humanPost('synthetic-assistance-maintainer',hide,'strategy'));
 const suppressed=(await accepted(await get('/api/assistance?id='+response.id))).item;assert.equal(suppressed.state,'VISIBLE');assert.equal(suppressed.availability,'DEPENDENCY_UNAVAILABLE');assert.equal(suppressed.record,null);assert.equal((await accepted(await get('/api/assistance?id='+f.request.id))).item.availability,'AVAILABLE');
 assert([404,409].includes((await machinePost(f.a,responseCommand(f.request,p.item))).status));
 const hiddenBase={...hide,requestId:uid(),id:f.base.id,digest:f.base.digest};await accepted(await humanPost('synthetic-assistance-maintainer',hiddenBase,'strategy'));
 const unavailable=(await accepted(await get('/api/assistance?id='+f.request.id))).item;assert.equal(unavailable.availability,'DEPENDENCY_UNAVAILABLE');assert.equal(unavailable.record,null);assert([404,409].includes((await humanPost(f.owner,requestCommand(f.base))).status));
 await assert.rejects(m.validateAssistanceHandoff({base:f.base,request:unavailable,response:suppressed,proposal:p.item}));
});

test('reports remain private behind explicit existing moderator authorization; sponsor withdrawal is terminal',async()=>{
 const f=await completed(),report={action:'report',requestId:uid(),id:f.response.id,digest:f.response.digest,reason:'MISLEADING',details:'Synthetic private report investigation',policyAccepted:'public-assistance-v1'},receipt=await accepted(await humanPost(uid(),report));assert.equal(receipt.item,null);assert(!JSON.stringify(receipt).includes(report.details));
 assert.equal((await get('/api/assistance/reports')).status,401);assert.equal((await worker.dispatchFetch(origin+'/api/assistance/reports',{headers:{'X-Fixture-Actor':f.owner}})).status,403);
 const queue=await accepted(await worker.dispatchFetch(origin+'/api/assistance/reports',{headers:{'X-Fixture-Actor':'synthetic-assistance-maintainer'}}));assert.equal(queue.reports[0].details,report.details);
 assert(!(await (await get('/api/assistance?id='+f.response.id)).text()).includes(report.details));
 const withdraw={action:'withdraw',requestId:uid(),id:f.response.id,digest:f.response.digest,reason:'SPONSOR_REQUEST',policyAccepted:'public-assistance-v1'};assert.equal((await humanPost(uid(),withdraw)).status,403);await accepted(await humanPost(f.owner,withdraw));
 for(const response of [await get('/api/assistance?id='+f.response.id),await machinePost(f.a,f.responseCommand)]){const result=await accepted(response);assert.equal(result.item.state,'WITHDRAWN');assert.equal(result.item.availability,'SUPPRESSED');assert.equal(result.item.record,null);assert(!JSON.stringify(result).includes(f.responseCommand.rationale));}
 const restore={action:'moderate',requestId:uid(),id:f.response.id,digest:f.response.digest,state:'VISIBLE',reason:'RESTORED',policyAccepted:'public-assistance-v1'};assert.equal((await humanPost('synthetic-assistance-maintainer',restore)).status,409);
});

test('expired or revoked actual credentials cannot submit or reconcile their original response',async()=>{
 const f=await completed(),expired={'X-Fixture-Time':new Date(Date.parse(f.a.identity.agent.expiresAt)+1).toISOString()};
 const exp=await machinePost(f.a,f.responseCommand,'assistance',expired);assert.equal(exp.status,401);assert.equal(exp.headers.get('WWW-Authenticate'),'Bearer');
 const revoke={action:'revoke',requestId:uid(),id:f.a.command.id,revision:1};await accepted(await worker.dispatchFetch(origin+'/api/network/agents',{method:'POST',headers:{'X-Fixture-Actor':f.owner,Origin:origin,'Content-Type':'application/json','X-Network-Intent':'onboard'},body:JSON.stringify(revoke)}));
 assert.equal((await machinePost(f.a,f.responseCommand)).status,401);assert.equal((await machinePost(f.a,responseCommand(f.request,f.proposal))).status,401);assert.equal(await count(),2);
});

test('revocation between real HTTP authentication and D1 insertion is fenced without a stale response',async()=>{
 const f=await setup(),p=await proposal(f),command=responseCommand(f.request,p.item),network=new m.NetworkRepository(db),request=new Request(origin+'/api/assistance/agent',{method:'POST',headers:{Authorization:'Bearer '+f.a.token,'Content-Type':'application/json'},body:JSON.stringify(command)});
 const response=await m.assistanceAgentRequest(request,()=>new m.AssistanceRepository(db),()=>({authenticate:async(token,time)=>{const principal=await network.authenticate(token,time);await network.write(f.owner,{action:'revoke',requestId:uid(),id:f.a.command.id,revision:1},time);return principal;}}),()=>at);
 assert.equal(response.status,401);assert.equal(await count(),1);assert.equal((await get('/api/assistance?id='+command.id)).status,404);
});

test('actual response pagination retains exact parent scope through a redacted response cursor',async()=>{
 const f=await setup();
 for(let n=0;n<13;n++){const a=await agent(uid(),'Synthetic page agent '+n),p=await proposal(f,a);await accepted(await machinePost(a,responseCommand(f.request,p.item)));}
 const first=await accepted(await get('/api/assistance?request='+f.request.id));assert.equal(first.items.length,12);assert(first.nextCursor);assert.deepEqual(first.request,ref(f.request));
 const cursor=first.items.at(-1),hide={action:'moderate',requestId:uid(),id:cursor.id,digest:cursor.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-assistance-v1'};await accepted(await humanPost('synthetic-assistance-maintainer',hide));
 const tombstone=(await accepted(await get('/api/assistance?id='+cursor.id))).item;assert.equal(tombstone.record,null);assert.equal(tombstone.availability,'SUPPRESSED');
 const second=await accepted(await get('/api/assistance?cursor='+first.nextCursor));assert.deepEqual(second.request,ref(f.request));assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);assert.equal(second.items[0].kind,'RESPONSE');assert.deepEqual(second.items[0].record.request,ref(f.request));assert(!first.items.some(item=>item.id===second.items[0].id));
 const wrong=(await accepted(await get('/api/assistance?cursor='+f.request.id)));assert.equal(wrong.request,null);assert(wrong.items.every(item=>item.kind==='REQUEST'));
});

test('lifecycle receipts correlate actor and operation when two authorized moderators reuse the same UUID',async()=>{
 const f=await setup(),requestId=uid(),a='synthetic-assistance-maintainer',b='synthetic-assistance-maintainer-b',hide={action:'moderate',requestId,id:f.request.id,digest:f.request.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-assistance-v1'};
 const hidden=await accepted(await humanPost(a,hide));assert.equal(hidden.item.state,'HIDDEN');assert.equal(hidden.item.record,null);
 const restore={...hide,state:'VISIBLE',reason:'RESTORED'},restored=await accepted(await humanPost(b,restore));
 assert.equal(restored.item.state,'VISIBLE');assert.equal(restored.item.availability,'AVAILABLE');assert.deepEqual(restored.item.moderation.map(event=>({requestId:event.requestId,actor:event.actor.id,state:event.state,reason:event.reason})),[{requestId,actor:await m.strategyPublicHumanId(a),state:'HIDDEN',reason:'POLICY'},{requestId,actor:await m.strategyPublicHumanId(b),state:'VISIBLE',reason:'RESTORED'}]);
 assert.deepEqual(await accepted(await humanPost(b,restore)),restored);assert.deepEqual((await accepted(await get('/api/assistance?id='+f.request.id))).item,restored.item);assert.equal(await count('assistance_moderation'),2);
});
