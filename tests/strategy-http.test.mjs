import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id);new Function('module','exports','require',code)(m,m.exports,req);return m.exports;}
const {createNetworkToken}=load('app/network-model.ts'),{NetworkRepository}=load('app/network-store.ts');
const {StrategyRepository}=load('app/strategy-store.ts'),model=load('app/strategy-model.ts'),http=load('app/strategy-http.ts'),{researchModeratorAllowed}=load('app/research-moderation.ts');
const at=new Date().toISOString();
// Actual handlers and D1. Fixture identity headers do not establish hosted OAuth.
const source=`import * as h from './app/strategy-http';import {NetworkRepository} from './app/network-store';import {StrategyRepository} from './app/strategy-store';import {researchModeratorAllowed} from './app/research-moderation';
export default {fetch(request,env){const path=new URL(request.url).pathname,user=request.headers.get('X-Fixture-Actor'),actor=user?{userId:user}:null,factory=()=>new StrategyRepository(env.DB),moderator=id=>researchModeratorAllowed(id,env.FIXTURE_MODERATORS),now=()=>env.FIXTURE_AT;
if(path==='/api/strategies/me')return h.strategyMeRequest(request,actor,moderator);
if(path==='/api/strategies/reports')return h.strategyReportsRequest(request,actor,factory,moderator,now);
if(path==='/api/strategies/agent')return h.strategyAgentRequest(request,factory,()=>new NetworkRepository(env.DB),now);
return request.method==='GET'?h.strategyPublicRequest(request,factory):h.strategyHumanRequest(request,actor,factory,moderator,now);}};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at,FIXTURE_MODERATORS:'["fixture-maintainer"]'}});let db;
before(async()=>{db=await mf.getD1Database('DB');for(const name of readdirSync('drizzle').filter(v=>v.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
after(async()=>await mf.dispose());
const user=()=>crypto.randomUUID(),factory=()=>new StrategyRepository(db),human=id=>({kind:'HUMAN',userId:id,moderator:false});
const definition=()=>({schemaVersion:1,market:{symbol:'BTC/USDT',timeframe:'1h',direction:'LONG'},entry:{type:'TREND',fastPeriod:10,slowPeriod:30,confirmation:'CROSS'},risk:{positionPct:1,maxOpenPositions:1,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:2},costs:{feeBps:10,slippageBps:5},execution:{mode:'DEMO',leverage:1,ordersEnabled:false}});
const publish=(patch={})=>({action:'publish',requestId:crypto.randomUUID(),id:crypto.randomUUID(),name:'Synthetic strategy',description:'A definition to test, not a reported return.',definition:definition(),assumptions:'Costs and data rights remain explicit.',falsification:'Reject if an unseen-data reproduction contradicts this claim.',sources:[{url:'https://example.com/research',classification:'AUTHOR_CLAIM',note:'Synthetic reference; not retrieved.'}],relation:null,policyAccepted:'public-strategy-v1',...patch});
const headers=id=>({'X-Fixture-Actor':id,Origin:'https://research.test','Content-Type':'application/json','X-Strategy-Intent':'submit'});
const post=(id,raw,extra={})=>mf.dispatchFetch('https://research.test/api/strategies',{method:'POST',headers:{...headers(id),...extra},body:typeof raw==='string'?raw:JSON.stringify(raw)});
const get=query=>mf.dispatchFetch('https://research.test/api/strategies'+(query??''));
const machine=(token,raw,extra={})=>mf.dispatchFetch('https://research.test/api/strategies/agent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(raw)});
async function agent(owner){const key=await createNetworkToken(),command={action:'register',requestId:crypto.randomUUID(),id:crypto.randomUUID(),credentialId:key.credentialId,name:'Fixture external agent',tokenDigest:key.tokenDigest,days:7};await new NetworkRepository(db).write(owner,command,at);return {...key,command};}

test('anonymous public reads and signed-human context expose only pseudonymous research identity',async()=>{
 const owner=user(),cmd=publish(),result=await post(owner,cmd);assert.equal(result.status,200);const receipt=await result.json();
 const response=await get('?id='+cmd.id);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const body=await response.json();assert.deepEqual(body.item,receipt.item);assert.equal(body.item.record.verification,'UNTESTED');assert.equal(body.executionEnabled,false);
 const profile=await mf.dispatchFetch('https://research.test/api/strategies/me',{headers:{'X-Fixture-Actor':owner}});assert.equal(profile.status,200);const me=await profile.json();assert.equal(me.authorId,await model.strategyPublicHumanId(owner));assert.equal(me.sponsorId,me.authorId);assert.equal(me.moderator,false);assert.equal(body.item.author.id,me.authorId);
 assert(!(await (await get()).text()).includes(owner));assert.equal((await mf.dispatchFetch('https://research.test/api/strategies/me')).status,401);
});

test('two external agents and their human sponsor have distinct attributable authors with the same public sponsorship',async()=>{
 const owner=user(),a=await agent(owner),b=await agent(owner),aCmd=publish(),bCmd=publish(),hCmd=publish();
 // Consume each Miniflare response immediately while the three writes remain concurrent.
 const items=await Promise.all([post(owner,hCmd),machine(a.token,aCmd),machine(b.token,bCmd)].map(async pending=>{const r=await pending;assert.equal(r.status,200);return (await r.json()).item;}));assert.deepEqual(items.map(item=>item.author.kind),['HUMAN','AGENT','AGENT']);assert.equal(new Set(items.map(item=>item.author.id)).size,3);assert.equal(new Set(items.map(item=>item.author.sponsorId)).size,1);
 for(const item of items){assert.equal(item.record.verification,'UNTESTED');const serialized=JSON.stringify(item);for(const secret of [owner,a.token,b.token,a.tokenDigest,b.tokenDigest,'ownerId','tokenDigest','registryDigest'])assert(!serialized.includes(secret));}
 assert.equal((await post('',hCmd,{Authorization:'Bearer '+a.token})).status,401);
});

test('anonymous and forged authorship or verification cannot create research records',async()=>{
 const owner=user(),cmd=publish();let calls=0;
 assert.equal((await http.strategyHumanRequest(new Request('https://research.test/api/strategies',{method:'POST'}),null,()=>{calls++;throw Error();},()=>false)).status,401);assert.equal(calls,0);
 for(const extra of [{author:{kind:'HUMAN',id:owner}},{userId:owner},{verified:true},{verification:'REPRODUCED'},{moderator:true},{executionEnabled:true},{score:99},{privateWorkspaceId:'private'}])assert.equal((await post(owner,{...cmd,...extra})).status,400);
 assert.equal((await get('?id='+cmd.id)).status,404);
});

test('identical retries reconcile and changed or sibling-writer collisions do not return another author receipt',async()=>{
 const owner=user(),cmd=publish(),first=await (await post(owner,cmd)).json();assert.deepEqual(await (await post(owner,cmd)).json(),first);
 assert.equal((await post(owner,{...cmd,name:'Changed strategy'})).status,409);assert.equal((await post(user(),cmd)).status,409);
 const a=await agent(owner);assert.equal((await machine(a.token,cmd)).status,409);
 const independent=publish({requestId:cmd.requestId});assert.equal((await post(user(),independent)).status,200);
});

test('origin, content, method and bounded-query checks stop malformed operations',async()=>{
 const owner=user(),cmd=publish();for(const extra of [{Origin:'https://foreign.test'},{Origin:''},{'X-Strategy-Intent':''}])assert.equal((await post(owner,cmd,extra)).status,403);
 assert.equal((await post(owner,cmd,{'Content-Type':'text/plain'})).status,415);
 for(const query of ['?ownerId=private','?id='+cmd.id+'&root='+cmd.id,'?id='+cmd.id+'&id='+cmd.id,'?cursor='+('x'.repeat(513)),'?id=invalid'])assert.equal((await get(query)).status,400);
 let calls=0;const invalid=await http.strategyPublicRequest(new Request('https://research.test/api/strategies?token=never-echo-secret'),()=>{calls++;throw Error();});assert.equal(invalid.status,400);assert.equal(calls,0);assert(!(await invalid.text()).includes('never-echo-secret'));
 assert.equal((await get('?id='+cmd.id)).status,404);
});

test('duplicate-key, oversized, unsafe-source, credential-bearing and invalid-UTF8 content is rejected',async()=>{
 const owner=user(),cmd=publish();assert.equal((await post(owner,JSON.stringify(cmd).replace('"name":"Synthetic strategy"','"name":"one","name":"two"'))).status,400);
 assert.equal((await post(owner,' '.repeat(model.strategyLimits.requestBytes+1))).status,413);
 for(const source of ['javascript:alert(1)','https://person:secret@example.com/a','http://example.com/a'])assert.equal((await post(owner,publish({sources:[{url:source,classification:'PRIMARY',note:''}]}))).status,400);
 const a=await agent(owner);for(const secret of [a.token,encodeURIComponent(a.token)]){const result=await post(owner,publish({description:secret}));assert.equal(result.status,400);assert(!(await result.text()).includes(secret));}
 const request=new Request('https://research.test/api/strategies',{method:'POST',headers:headers(owner),body:new Uint8Array([123,34,120,34,58,34,255,34,125])});assert.equal((await http.strategyHumanRequest(request,{userId:owner},factory,()=>false,()=>at)).status,400);
});

test('public historical versions and forks keep exact references without claiming tested behavior',async()=>{
 const owner=user(),cmd=publish(),first=(await (await post(owner,cmd)).json()).item;
 const revision=publish({relation:{type:'REVISION',id:first.id,digest:first.digest}}),updated=(await (await post(owner,revision)).json()).item;assert.equal(updated.rootId,first.id);assert.equal(updated.revision,2);
 const history=await (await get('?root='+first.id)).json();assert.deepEqual(history.items.map(item=>item.id),[updated.id,first.id]);
 assert.equal((await post(user(),publish({relation:{type:'REVISION',id:updated.id,digest:updated.digest}}))).status,403);
 const fork=await post(user(),publish({relation:{type:'FORK',id:updated.id,digest:updated.digest}}));assert.equal(fork.status,200);const f=(await fork.json()).item;assert.equal(f.rootId,f.id);assert.equal(f.revision,1);assert.equal(f.record.verification,'UNTESTED');
 assert.equal((await post(user(),publish({relation:{type:'CHALLENGE',id:updated.id,digest:updated.digest}}))).status,400);
 assert.equal((await post(owner,publish({relation:{type:'FORK',id:updated.id,digest:'0'.repeat(64)}}))).status,404);
});

test('reports stay private; only explicitly authorized human moderation can hide or restore a claim',async()=>{
 const owner=user(),cmd=publish(),item=(await (await post(owner,cmd)).json()).item;
 const report={action:'report',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'MISLEADING',details:'Synthetic private report detail',policyAccepted:'public-strategy-v1'};
 const reported=await post(user(),report);assert.equal(reported.status,200);const receipt=await reported.json();assert.equal(receipt.item,null);assert(!JSON.stringify(receipt).includes(report.details));
 assert.equal((await mf.dispatchFetch('https://research.test/api/strategies/reports',{headers:{'X-Fixture-Actor':owner}})).status,403);assert.equal((await mf.dispatchFetch('https://research.test/api/strategies/reports')).status,401);
 const queue=await mf.dispatchFetch('https://research.test/api/strategies/reports',{headers:{'X-Fixture-Actor':'fixture-maintainer'}});assert.equal(queue.status,200);assert((await queue.text()).includes(report.details));assert(!(await (await get('?id='+item.id)).text()).includes(report.details));
 const moderate={action:'moderate',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'};
 assert.equal((await post(owner,moderate)).status,403);const a=await agent(owner);assert.equal((await machine(a.token,moderate)).status,403);assert.equal((await post('fixture-maintainer',moderate)).status,200);
 const hidden=(await (await get('?id='+item.id)).json()).item;assert.equal(hidden.record,null);assert.equal(hidden.state,'HIDDEN');assert(!JSON.stringify(hidden).includes(cmd.name));
 assert.equal((await post('fixture-maintainer',{...moderate,requestId:crypto.randomUUID(),state:'VISIBLE',reason:'RESTORED'})).status,200);
});

test('sponsor withdrawal is irreversible and retry/get/history never restore retained private content',async()=>{
 const owner=user(),a=await agent(owner),cmd=publish({name:'Withdraw this synthetic strategy'}),item=(await (await machine(a.token,cmd)).json()).item;
 const withdraw={action:'withdraw',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'SPONSOR_REQUEST',policyAccepted:'public-strategy-v1'};assert.equal((await post(user(),withdraw)).status,403);assert.equal((await post(owner,withdraw)).status,200);
 for(const response of [await get('?id='+item.id),await get('?root='+item.id),await machine(a.token,cmd)]){assert.equal(response.status,200);const raw=await response.text();assert(!raw.includes(cmd.name));assert(!raw.includes(a.command.name));assert(raw.includes('WITHDRAWN'));assert(raw.includes('"record":null'));}
 assert.equal((await post('fixture-maintainer',{action:'moderate',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,state:'VISIBLE',reason:'RESTORED',policyAccepted:'public-strategy-v1'})).status,409);
});

test('revocation between HTTP authentication and INSERT prevents the stale principal from publishing',async()=>{
 const owner=user(),a=await agent(owner),identities=new NetworkRepository(db),cmd=publish();
 const request=new Request('https://research.test/api/strategies/agent',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const response=await http.strategyAgentRequest(request,factory,()=>({authenticate:async(token,t)=>{const principal=await identities.authenticate(token,t);await identities.write(owner,{action:'revoke',requestId:crypto.randomUUID(),id:a.command.id,revision:1},t);return principal;}}),()=>at);
 assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');assert.equal((await get('?id='+cmd.id)).status,404);
});

test('expiry advancing after authentication and insecure machine transports cannot publish',async()=>{
 const owner=user(),a=await agent(owner),cmd=publish();let n=0;
 const request=()=>new Request('https://research.test/api/strategies/agent',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const response=await http.strategyAgentRequest(request(),factory,()=>new NetworkRepository(db),()=>n++===0?at:new Date(Date.parse(at)+7*86400000).toISOString());assert.equal(response.status,401);assert.equal((await get('?id='+cmd.id)).status,404);
 assert.equal((await http.strategyAgentRequest(new Request('http://research.test/api/strategies/agent',{method:'POST'}),()=>{throw Error();},()=>{throw Error();})).status,403);
 assert.equal((await machine(a.token,cmd,{Origin:'https://foreign.test'})).status,403);
});

test('transport refuses otherwise valid receipts for changed content, authors or target identities',async()=>{
 const owner=user(),cmd=publish(),good=await factory().write(human(owner),cmd,at),request=()=>new Request('https://research.test/api/strategies',{method:'POST',headers:headers(owner),body:JSON.stringify(cmd)});
 const author=await model.strategyPublicHumanId(user());
 for(const changed of [{...good,requestId:crypto.randomUUID()},{...good,item:{...good.item,digest:'0'.repeat(64)}},{...good,item:{...good.item,author:{kind:'HUMAN',id:author,sponsorId:author},record:{...good.item.record,author:{kind:'HUMAN',id:author,sponsorId:author}}}}])assert.equal((await http.strategyHumanRequest(request(),{userId:owner},()=>({write:async()=>changed}),()=>false,()=>at)).status,503);
 const changedRecord={...good.item.record,content:{...good.item.record.content,name:'Different returned strategy'}},changed={...good,item:{...good.item,record:changedRecord,digest:await model.strategyDigest(JSON.stringify(changedRecord))}};assert.equal((await http.strategyHumanRequest(request(),{userId:owner},()=>({write:async()=>changed}),()=>false,()=>at)).status,503);
 assert.equal((await http.strategyPublicRequest(new Request('https://research.test/api/strategies'),()=>({list:async()=>({version:1,items:[{...good.item,digest:'0'.repeat(64)}],nextCursor:null,executionEnabled:false})}))).status,503);
});

test('moderator configuration is explicit, bounded, duplicate-safe and fail-closed without a default grant',async()=>{
 const owner=user();for(const value of [undefined,null,'','[]'])assert.equal(researchModeratorAllowed(owner,value),false);assert.equal(researchModeratorAllowed(owner,JSON.stringify([owner])),true);
 for(const value of ['{',JSON.stringify([owner,owner]),' '.repeat(4097),JSON.stringify(Array(17).fill(owner)),JSON.stringify(['\u0000'])])assert.throws(()=>researchModeratorAllowed(owner,value),error=>error.status===503);
 const response=await http.strategyMeRequest(new Request('https://research.test/api/strategies/me'),{userId:owner},id=>researchModeratorAllowed(id,'{'));assert.equal(response.status,503);assert(!(await response.text()).includes(owner));
});

test('moderation receipts cannot acknowledge a different event, author or terminal transition',async()=>{
 const owner=user(),cmd=publish(),item=(await factory().write(human(owner),cmd,at)).item;
 const hide={action:'moderate',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'};
 const hidden=(await factory().write({kind:'HUMAN',userId:'fixture-maintainer',moderator:true},hide,at)).item;
 const withdraw={action:'withdraw',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'AUTHOR_REQUEST',policyAccepted:'public-strategy-v1'};
 const request=()=>new Request('https://research.test/api/strategies',{method:'POST',headers:headers(owner),body:JSON.stringify(withdraw)});
 const missing={version:1,action:'withdraw',requestId:withdraw.requestId,item:hidden,report:null,executionEnabled:false};
 assert.equal((await http.strategyHumanRequest(request(),{userId:owner},()=>({write:async()=>missing}),()=>false,()=>at)).status,503);
 const actual=await factory().write(human(owner),withdraw,at),foreign=await model.strategyPublicHumanId(user());
 for(const patch of [{reason:'PERSONAL_DATA'},{actor:{kind:'HUMAN',id:foreign,sponsorId:foreign}}]){
  const bad={...actual,item:{...actual.item,moderation:actual.item.moderation.map(event=>event.requestId===withdraw.requestId?{...event,...patch}:event)}};
  assert.equal((await http.strategyHumanRequest(request(),{userId:owner},()=>({write:async()=>bad}),()=>false,()=>at)).status,503);
 }
});

test('daily throttling exposes only actual bounded Retry-After while retained capacity has no invented reset',async()=>{
 const owner=user(),cmd=publish(),request=()=>new Request('https://research.test/api/strategies',{method:'POST',headers:headers(owner),body:JSON.stringify(cmd)});
 for(const [error,wait] of [[new model.StrategyError('Daily limit.',429,60),'60'],[new model.StrategyError('Retained capacity.',409),null],[new model.StrategyError('Unknown reset.',429),null]]){
  const response=await http.strategyHumanRequest(request(),{userId:owner},()=>({write:async()=>{throw error;}}),()=>false,()=>at);assert.equal(response.status,error.status);assert.equal(response.headers.get('Retry-After'),wait);
 }
});

test('all seven declarative families retain explicit costs and disabled Demo execution through actual handlers',async()=>{
 const owner=user();
 const entries=[
  {type:'TREND',fastPeriod:10,slowPeriod:30,confirmation:'CROSS'},
  {type:'RSI',period:14,threshold:30,comparison:'BELOW'},
  {type:'BREAKOUT',lookback:20},
  {type:'DCA',intervalBars:24,maxEntries:3},
  {type:'GRID',lowerPrice:100,upperPrice:120,levels:5},
  {type:'SIGNAL',provider:'TRADINGVIEW',event:'BULLISH',maxAgeBars:2},
  {type:'RULES',match:'ALL',conditions:[{indicator:'PRICE_SMA',period:20,comparison:'GT',threshold:1}]},
 ];
 for(const entry of entries){
  const authored={...definition(),entry},cmd=publish({definition:authored});
  const response=await post(owner,cmd);assert.equal(response.status,200,entry.type);
  const item=(await response.json()).item;assert.deepEqual(item.record.content.definition,authored);
  assert.equal(item.record.verification,'UNTESTED');assert.equal(item.record.executionEnabled,false);
  const publicRecord=(await (await get('?id='+cmd.id)).json()).item;
  assert.deepEqual(publicRecord.record.content.definition.costs,{feeBps:10,slippageBps:5});
  assert.deepEqual(publicRecord.record.content.definition.execution,{mode:'DEMO',leverage:1,ordersEnabled:false});
 }
});

test('definition schema rejects executable fields, account connections, leverage and forged results',async()=>{
 const owner=user(),base=definition();
 const invalid=[
  {...base,code:'globalThis.executed=true'},
  {...base,accountId:'private-exchange-account'},
  {...base,execution:{...base.execution,ordersEnabled:true}},
  {...base,execution:{...base.execution,mode:'LIVE'}},
  {...base,execution:{...base.execution,leverage:2}},
  {...base,entry:{type:'TREND',fastPeriod:30,slowPeriod:10,confirmation:'CROSS'}},
  {...base,entry:{type:'GRID',lowerPrice:120,upperPrice:100,levels:5}},
  {...base,entry:{type:'SIGNAL',provider:'TRADINGVIEW',event:'BEARISH',maxAgeBars:2}},
  {...base,entry:{type:'RULES',match:'ALL',conditions:[]}},
  {...base,risk:{...base.risk,positionPct:100}},
  {...base,costs:{feeBps:-1,slippageBps:5}},
  {...base,market:{...base.market,symbol:'BTC; execute'}},
 ];
 for(const authored of invalid){const cmd=publish({definition:authored});assert.equal((await post(owner,cmd)).status,400);assert.equal((await get('?id='+cmd.id)).status,404);}
 assert.equal((await post(owner,publish({results:{returnPct:1000}}))).status,400);
 assert.equal(globalThis.executed,undefined);
 const short={...base,market:{...base.market,direction:'SHORT'},entry:{type:'SIGNAL',provider:'ALTFINS',event:'BEARISH',maxAgeBars:2}};
 assert.equal((await post(owner,publish({definition:short}))).status,200);
});

test('schema-valid receipt with a changed risk rule or cost assumption cannot acknowledge the sent strategy',async()=>{
 const owner=user(),cmd=publish(),good=await factory().write(human(owner),cmd,at);
 const request=()=>new Request('https://research.test/api/strategies',{method:'POST',headers:headers(owner),body:JSON.stringify(cmd)});
 for(const patch of [{risk:{...cmd.definition.risk,stopLossPct:10}},{costs:{...cmd.definition.costs,slippageBps:0}}]){
  const record={...good.item.record,content:{...good.item.record.content,definition:{...good.item.record.content.definition,...patch}}};
  const receipt={...good,item:{...good.item,record,digest:await model.strategyDigest(JSON.stringify(record))}};
  assert.equal((await http.strategyHumanRequest(request(),{userId:owner},()=>({write:async()=>receipt}),()=>false,()=>at)).status,503);
 }
});


test('moderator-only report pagination reaches retained details and rejects ambiguous or secret-bearing queries',async()=>{
 const owner=user(),cmd=publish(),item=(await (await post(owner,cmd)).json()).item;
 const expected=new Set();
 for(let n=0;n<25;n++){
  const report={action:'report',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'OTHER',details:'Queue pagination fixture '+n,policyAccepted:'public-strategy-v1'};
  expected.add(report.requestId);assert.equal((await post(user(),report)).status,200);
 }
 const endpoint='https://research.test/api/strategies/reports';
 const authorized={'X-Fixture-Actor':'fixture-maintainer'};
 let cursor=null;const seen=new Set();let pages=0;
 do{
  const response=await mf.dispatchFetch(endpoint+(cursor?'?cursor='+cursor:''),{headers:authorized});
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const page=await response.json();assert(page.reports.length<=20);assert.equal(page.executionEnabled,false);
  for(const report of page.reports){assert(!seen.has(report.requestId));seen.add(report.requestId);}
  cursor=page.nextCursor;assert(cursor===null||/^[a-f0-9]{64}$/.test(cursor));pages++;assert(pages<10);
 }while(cursor);
 assert(pages>=2);for(const id of expected)assert(seen.has(id));
 assert.equal((await mf.dispatchFetch(endpoint+'?cursor='+'0'.repeat(64),{headers:authorized})).status,404);
 for(const query of ['?cursor=bad','?ownerId=never-echo','?cursor='+'0'.repeat(64)+'&cursor='+'0'.repeat(64),'?id='+item.id]){
  const response=await mf.dispatchFetch(endpoint+query,{headers:authorized});assert.equal(response.status,400);assert(!(await response.text()).includes('never-echo'));
 }
 assert.equal((await mf.dispatchFetch(endpoint+'?cursor=bad',{headers:{'X-Fixture-Actor':owner}})).status,403);
 assert.equal((await mf.dispatchFetch(endpoint)).status,401);
 assert(!(await (await get('?id='+item.id)).text()).includes('Queue pagination fixture'));
});
