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
const {ResearchRepository}=load('app/research-store.ts'),model=load('app/research-model.ts'),http=load('app/research-http.ts'),{researchModeratorAllowed}=load('app/research-moderation.ts');
const at=new Date().toISOString();
// Actual handlers and D1. Fixture identity headers do not establish hosted OAuth.
const source=`import * as h from './app/research-http';import {NetworkRepository} from './app/network-store';import {ResearchRepository} from './app/research-store';import {researchModeratorAllowed} from './app/research-moderation';
export default {fetch(request,env){const path=new URL(request.url).pathname,user=request.headers.get('X-Fixture-Actor'),actor=user?{userId:user}:null,factory=()=>new ResearchRepository(env.DB),moderator=id=>researchModeratorAllowed(id,env.FIXTURE_MODERATORS),now=()=>env.FIXTURE_AT;
if(path==='/api/research/me')return h.researchMeRequest(request,actor,moderator);
if(path==='/api/research/reports')return h.researchReportsRequest(request,actor,factory,moderator,now);
if(path==='/api/research/agent')return h.researchAgentRequest(request,factory,()=>new NetworkRepository(env.DB),now);
return request.method==='GET'?h.researchPublicRequest(request,factory):h.researchHumanRequest(request,actor,factory,moderator,now);}};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at,FIXTURE_MODERATORS:'["fixture-maintainer"]'}});let db;
before(async()=>{db=await mf.getD1Database('DB');for(const name of readdirSync('drizzle').filter(v=>v.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
after(async()=>await mf.dispose());
const user=()=>crypto.randomUUID(),factory=()=>new ResearchRepository(db),human=id=>({kind:'HUMAN',userId:id,moderator:false});
const publish=(patch={})=>({action:'publish',requestId:crypto.randomUUID(),id:crypto.randomUUID(),kind:'HYPOTHESIS',title:'Synthetic hypothesis',statement:'A claim to test, not a reported return.',assumptions:'Costs and data rights remain explicit.',falsification:'Reject if an unseen-data reproduction contradicts this claim.',sources:[{url:'https://example.com/research',classification:'AUTHOR_CLAIM',note:'Synthetic reference; not retrieved.'}],relation:null,policyAccepted:'public-research-v1',...patch});
const headers=id=>({'X-Fixture-Actor':id,Origin:'https://research.test','Content-Type':'application/json','X-Research-Intent':'submit'});
const post=(id,raw,extra={})=>mf.dispatchFetch('https://research.test/api/research',{method:'POST',headers:{...headers(id),...extra},body:typeof raw==='string'?raw:JSON.stringify(raw)});
const get=query=>mf.dispatchFetch('https://research.test/api/research'+(query??''));
const machine=(token,raw,extra={})=>mf.dispatchFetch('https://research.test/api/research/agent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(raw)});
async function agent(owner){const key=await createNetworkToken(),command={action:'register',requestId:crypto.randomUUID(),id:crypto.randomUUID(),credentialId:key.credentialId,name:'Fixture external agent',tokenDigest:key.tokenDigest,days:7};await new NetworkRepository(db).write(owner,command,at);return {...key,command};}

test('anonymous public reads and signed-human context expose only pseudonymous research identity',async()=>{
 const owner=user(),cmd=publish(),result=await post(owner,cmd);assert.equal(result.status,200);const receipt=await result.json();
 const response=await get('?id='+cmd.id);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const body=await response.json();assert.deepEqual(body.item,receipt.item);assert.equal(body.item.record.verification,'UNVERIFIED');assert.equal(body.executionEnabled,false);
 const profile=await mf.dispatchFetch('https://research.test/api/research/me',{headers:{'X-Fixture-Actor':owner}});assert.equal(profile.status,200);const me=await profile.json();assert.equal(me.authorId,await model.researchPublicHumanId(owner));assert.equal(me.sponsorId,me.authorId);assert.equal(me.moderator,false);assert.equal(body.item.author.id,me.authorId);
 assert(!(await (await get()).text()).includes(owner));assert.equal((await mf.dispatchFetch('https://research.test/api/research/me')).status,401);
});

test('two external agents and their human sponsor have distinct attributable authors with the same public sponsorship',async()=>{
 const owner=user(),a=await agent(owner),b=await agent(owner),aCmd=publish(),bCmd=publish(),hCmd=publish();
 // Consume each Miniflare response immediately while the three writes remain concurrent.
 const items=await Promise.all([post(owner,hCmd),machine(a.token,aCmd),machine(b.token,bCmd)].map(async pending=>{const r=await pending;assert.equal(r.status,200);return (await r.json()).item;}));assert.deepEqual(items.map(item=>item.author.kind),['HUMAN','AGENT','AGENT']);assert.equal(new Set(items.map(item=>item.author.id)).size,3);assert.equal(new Set(items.map(item=>item.author.sponsorId)).size,1);
 for(const item of items){assert.equal(item.record.verification,'UNVERIFIED');const serialized=JSON.stringify(item);for(const secret of [owner,a.token,b.token,a.tokenDigest,b.tokenDigest,'ownerId','tokenDigest','registryDigest'])assert(!serialized.includes(secret));}
 assert.equal((await post('',hCmd,{Authorization:'Bearer '+a.token})).status,401);
});

test('anonymous and forged authorship or verification cannot create research records',async()=>{
 const owner=user(),cmd=publish();let calls=0;
 assert.equal((await http.researchHumanRequest(new Request('https://research.test/api/research',{method:'POST'}),null,()=>{calls++;throw Error();},()=>false)).status,401);assert.equal(calls,0);
 for(const extra of [{author:{kind:'HUMAN',id:owner}},{userId:owner},{verified:true},{verification:'REPRODUCED'},{moderator:true},{executionEnabled:true},{score:99},{privateWorkspaceId:'private'}])assert.equal((await post(owner,{...cmd,...extra})).status,400);
 assert.equal((await get('?id='+cmd.id)).status,404);
});

test('optional expected human author rejects a changed account before publishing without changing legacy or agent clients',async()=>{
 const accountA=user(),accountB=user(),expectedA=await model.researchPublicHumanId(accountA),expectedB=await model.researchPublicHumanId(accountB),cmd=publish();
 for(const value of [expectedA,'human_'+'a'.repeat(63),expectedB.toUpperCase(),'malformed-expected-author']){
  const response=await post(accountB,cmd,{'X-Research-Author':value});assert.equal(response.status,403);const raw=await response.text();assert(!raw.includes(expectedA));assert(!raw.includes(expectedB));assert(!raw.includes('malformed-expected-author'));assert.equal((await get('?id='+cmd.id)).status,404);
 }
 // Miniflare dispatch removes empty headers; call the real handler with a preserved empty header separately.
 let writes=0;for(const value of [expectedA,'']){const request=new Request('https://research.test/api/research',{method:'POST',headers:{...headers(accountB),'X-Research-Author':value},body:JSON.stringify(cmd)});assert.equal(request.headers.get('X-Research-Author'),value);const rejected=await http.researchHumanRequest(request,{userId:accountB},()=>({write:async()=>{writes++;throw Error('Account-swapped write attempted.');}}),()=>false,()=>at);assert.equal(rejected.status,403);}assert.equal(writes,0);
 const first=await post(accountA,cmd,{'X-Research-Author':expectedA});assert.equal(first.status,200);const receipt=await first.json();assert.equal(receipt.item.author.id,expectedA);assert.deepEqual(await (await post(accountA,cmd,{'X-Research-Author':expectedA})).json(),receipt);
 assert.equal((await post(accountB,cmd,{'X-Research-Author':expectedA})).status,403);assert.deepEqual(await (await post(accountA,cmd)).json(),receipt);
 const legacy=publish();assert.equal((await post(accountB,legacy)).status,200);assert.equal((await (await get('?id='+legacy.id)).json()).item.author.id,expectedB);
 const contributor=await agent(accountA),machineCommand=publish();const machineResponse=await machine(contributor.token,machineCommand,{'X-Research-Author':'ignored-by-machine-route'});assert.equal(machineResponse.status,200);assert.equal((await machineResponse.json()).item.author.kind,'AGENT');
});

test('identical retries reconcile and changed or sibling-writer collisions do not return another author receipt',async()=>{
 const owner=user(),cmd=publish(),first=await (await post(owner,cmd)).json();assert.deepEqual(await (await post(owner,cmd)).json(),first);
 assert.equal((await post(owner,{...cmd,title:'Changed claim'})).status,409);assert.equal((await post(user(),cmd)).status,409);
 const a=await agent(owner);assert.equal((await machine(a.token,cmd)).status,409);
 const independent=publish({requestId:cmd.requestId});assert.equal((await post(user(),independent)).status,200);
});

test('origin, content, method and bounded-query checks stop malformed operations',async()=>{
 const owner=user(),cmd=publish();for(const extra of [{Origin:'https://foreign.test'},{Origin:''},{'X-Research-Intent':''}])assert.equal((await post(owner,cmd,extra)).status,403);
 assert.equal((await post(owner,cmd,{'Content-Type':'text/plain'})).status,415);
 for(const query of ['?ownerId=private','?id='+cmd.id+'&root='+cmd.id,'?id='+cmd.id+'&id='+cmd.id,'?cursor='+('x'.repeat(513)),'?id=invalid'])assert.equal((await get(query)).status,400);
 let calls=0;const invalid=await http.researchPublicRequest(new Request('https://research.test/api/research?token=never-echo-secret'),()=>{calls++;throw Error();});assert.equal(invalid.status,400);assert.equal(calls,0);assert(!(await invalid.text()).includes('never-echo-secret'));
 assert.equal((await get('?id='+cmd.id)).status,404);
});

test('duplicate-key, oversized, unsafe-source, credential-bearing and invalid-UTF8 content is rejected',async()=>{
 const owner=user(),cmd=publish();assert.equal((await post(owner,JSON.stringify(cmd).replace('"title":"Synthetic hypothesis"','"title":"one","title":"two"'))).status,400);
 assert.equal((await post(owner,' '.repeat(model.researchLimits.requestBytes+1))).status,413);
 for(const source of ['javascript:alert(1)','https://person:secret@example.com/a','http://example.com/a'])assert.equal((await post(owner,publish({sources:[{url:source,classification:'PRIMARY',note:''}]}))).status,400);
 const a=await agent(owner);for(const secret of [a.token,encodeURIComponent(a.token)]){const result=await post(owner,publish({statement:secret}));assert.equal(result.status,400);assert(!(await result.text()).includes(secret));}
 const request=new Request('https://research.test/api/research',{method:'POST',headers:headers(owner),body:new Uint8Array([123,34,120,34,58,34,255,34,125])});assert.equal((await http.researchHumanRequest(request,{userId:owner},factory,()=>false,()=>at)).status,400);
});

test('public historical versions, forks and challenges keep exact references and no verification inheritance',async()=>{
 const owner=user(),cmd=publish(),first=(await (await post(owner,cmd)).json()).item;
 const revision=publish({relation:{type:'REVISION',id:first.id,digest:first.digest}}),updated=(await (await post(owner,revision)).json()).item;assert.equal(updated.rootId,first.id);assert.equal(updated.revision,2);
 const history=await (await get('?root='+first.id)).json();assert.deepEqual(history.items.map(item=>item.id),[updated.id,first.id]);
 assert.equal((await post(user(),publish({relation:{type:'REVISION',id:updated.id,digest:updated.digest}}))).status,403);
 const fork=await post(user(),publish({relation:{type:'FORK',id:updated.id,digest:updated.digest}}));assert.equal(fork.status,200);const f=(await fork.json()).item;assert.equal(f.rootId,f.id);assert.equal(f.revision,1);assert.equal(f.record.verification,'UNVERIFIED');
 const challenge=await post(user(),publish({kind:'CHALLENGE',relation:{type:'CHALLENGE',id:updated.id,digest:updated.digest}}));assert.equal(challenge.status,200);
 assert.equal((await post(owner,publish({relation:{type:'FORK',id:updated.id,digest:'0'.repeat(64)}}))).status,404);
});

const threadQuery=(target,cursor=null)=>'?target='+target.id+'&digest='+target.digest+(cursor?'&cursor='+cursor:'');
test('actual public research thread handler pages exact direct replies and retains child tombstones',async()=>{
 const owner=user(),target=(await (await post(owner,publish())).json()).item,children=[];
 children.push((await (await post(owner,publish({relation:{type:'REVISION',id:target.id,digest:target.digest}}))).json()).item);
 for(let n=0;n<22;n++)children.push((await (await post(user(),publish({kind:n%2?'CHALLENGE':'HYPOTHESIS',relation:{type:n%2?'CHALLENGE':'FORK',id:target.id,digest:target.digest}}))).json()).item);
 const indirect=(await (await post(user(),publish({relation:{type:'FORK',id:children[0].id,digest:children[0].digest}}))).json()).item;
 const hidden=children[4];assert.equal((await post('fixture-maintainer',{action:'moderate',requestId:crypto.randomUUID(),id:hidden.id,digest:hidden.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-research-v1'})).status,200);
 const firstResponse=await get(threadQuery(target));assert.equal(firstResponse.status,200);assert.equal(firstResponse.headers.get('Cache-Control'),'private, no-store');const first=model.researchThreadSchema.parse(await firstResponse.json());assert.equal(first.items.length,20);assert.equal(first.nextCursor,first.items.at(-1).id);
 const secondResponse=await get(threadQuery(target,first.nextCursor));assert.equal(secondResponse.status,200);const second=model.researchThreadSchema.parse(await secondResponse.json());assert.equal(second.items.length,3);assert.equal(second.nextCursor,null);
 const collected=[...first.items,...second.items],expected=[...children].sort((a,b)=>b.id.localeCompare(a.id));assert.deepEqual(collected.map(item=>item.id),expected.map(item=>item.id));assert(!collected.some(item=>item.id===indirect.id));assert.equal(collected.find(item=>item.id===hidden.id).record,null);assert(collected.filter(item=>item.record).every(item=>item.record.verification==='UNVERIFIED'));assert.equal(first.executionEnabled,false);
});

test('exact thread transport refuses missing, duplicate, conflicting or noncanonical query parameters before repository access',async()=>{
 const id=crypto.randomUUID(),digest='a'.repeat(64),valid='?target='+id+'&digest='+digest;let calls=0;
 for(const query of ['?target='+id,'?digest='+digest,valid+'&target='+id,valid+'&digest='+digest,valid+'&cursor='+id+'&cursor='+id,valid+'&id='+id,valid+'&root='+id,valid+'&token=do-not-echo',valid+'&cursor=',valid+'&cursor=bad','?target='+id.toUpperCase()+'&digest='+digest,'?target='+id+'&digest='+digest.toUpperCase()]){
  const response=await http.researchPublicRequest(new Request('https://research.test/api/research'+query),()=>{calls++;throw Error('Unexpected repository access.');});assert.equal(response.status,400);assert(!(await response.text()).includes('do-not-echo'));
 }
 assert.equal(calls,0);assert.equal((await http.researchPublicRequest(new Request('https://research.test/api/research'+valid,{method:'POST'}),()=>{calls++;throw Error();})).status,405);assert.equal(calls,0);
});

test('thread HTTP requires the exact target digest and a cursor belonging to that target',async()=>{
 const target=(await (await post(user(),publish())).json()).item,other=(await (await post(user(),publish())).json()).item,foreign=(await (await post(user(),publish({relation:{type:'FORK',id:other.id,digest:other.digest}}))).json()).item;
 for(const query of [threadQuery({...target,digest:'0'.repeat(64)}),threadQuery({...target,id:crypto.randomUUID()}),threadQuery(target,other.id),threadQuery(target,foreign.id),threadQuery(target,target.id),threadQuery(target,crypto.randomUUID())])assert.equal((await get(query)).status,404);
});

test('thread target moderation and withdrawal return only its tombstone while independent children remain public',async()=>{
 const owner=user(),target=(await (await post(owner,publish({title:'Hidden exact thread target'}))).json()).item,child=(await (await post(user(),publish({relation:{type:'FORK',id:target.id,digest:target.digest},title:'Separate public child'}))).json()).item;
 assert.equal((await post('fixture-maintainer',{action:'moderate',requestId:crypto.randomUUID(),id:target.id,digest:target.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-research-v1'})).status,200);
 for(const cursor of [null,child.id]){const response=await get(threadQuery(target,cursor));assert.equal(response.status,200);const thread=await response.json();assert.equal(thread.target.record,null);assert.deepEqual(thread.items,[]);assert.equal(thread.nextCursor,null);assert(!JSON.stringify(thread).includes('Hidden exact thread target'));assert(!JSON.stringify(thread).includes('Separate public child'));}
 assert.equal((await post(owner,{action:'withdraw',requestId:crypto.randomUUID(),id:target.id,digest:target.digest,reason:'AUTHOR_REQUEST',policyAccepted:'public-research-v1'})).status,200);const withdrawn=await (await get(threadQuery(target))).json();assert.equal(withdrawn.target.state,'WITHDRAWN');assert.deepEqual(withdrawn.items,[]);assert.equal((await (await get('?id='+child.id)).json()).item.record.content.title,'Separate public child');
});

test('thread transport rejects malicious target, page, relation, cursor and digest responses',async()=>{
 const owner=user(),target=(await factory().write(human(owner),publish(),at)).item,children=[];
 for(let n=0;n<22;n++)children.push((await factory().write(human(user()),publish({relation:{type:'FORK',id:target.id,digest:target.digest}}),at)).item);
 const good=await factory().thread(target.id,target.digest),request=(cursor=null)=>new Request('https://research.test/api/research'+threadQuery(target,cursor));
 const unrelated=(await factory().write(human(user()),publish(),at)).item;
 const changedRecord={...good.items[0].record,content:{...good.items[0].record.content,relation:{type:'FORK',id:unrelated.id,digest:unrelated.digest}}},changed={...good.items[0],record:changedRecord,digest:await model.researchDigest(JSON.stringify(changedRecord))};
 const cases=[{...good,target:unrelated},{...good,target:{...good.target,digest:'0'.repeat(64)}},{...good,items:[good.items[0],good.items[0]],nextCursor:null},{...good,items:[...good.items].reverse()},{...good,items:[changed,...good.items.slice(1)]},{...good,items:[{...good.items[0],digest:'0'.repeat(64)},...good.items.slice(1)]},{...good,nextCursor:good.items[0].id},{...good,items:[target],nextCursor:null}];
 for(const result of cases)assert.equal((await http.researchPublicRequest(request(),()=>({thread:async()=>result}))).status,503);
 // A schema-valid earlier page is still wrong for the requested anchor.
 const cursor=good.items.at(-1).id;assert.equal((await http.researchPublicRequest(request(cursor),()=>({thread:async()=>good,get:id=>factory().get(id)}))).status,503);
 const later=await factory().thread(target.id,target.digest,cursor);assert.equal((await http.researchPublicRequest(request(cursor),()=>({thread:async()=>later,get:async()=>({version:1,item:unrelated,executionEnabled:false})}))).status,503);
 const malformedAnchor=await factory().get(cursor);malformedAnchor.item.digest='0'.repeat(64);assert.equal((await http.researchPublicRequest(request(cursor),()=>({thread:async()=>later,get:async()=>malformedAnchor}))).status,503);
});

test('reports stay private; only explicitly authorized human moderation can hide or restore a claim',async()=>{
 const owner=user(),cmd=publish(),item=(await (await post(owner,cmd)).json()).item;
 const report={action:'report',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'MISLEADING',details:'Synthetic private report detail',policyAccepted:'public-research-v1'};
 const reported=await post(user(),report);assert.equal(reported.status,200);const receipt=await reported.json();assert.equal(receipt.item,null);assert(!JSON.stringify(receipt).includes(report.details));
 assert.equal((await mf.dispatchFetch('https://research.test/api/research/reports',{headers:{'X-Fixture-Actor':owner}})).status,403);assert.equal((await mf.dispatchFetch('https://research.test/api/research/reports')).status,401);
 const queue=await mf.dispatchFetch('https://research.test/api/research/reports',{headers:{'X-Fixture-Actor':'fixture-maintainer'}});assert.equal(queue.status,200);assert((await queue.text()).includes(report.details));assert(!(await (await get('?id='+item.id)).text()).includes(report.details));
 const moderate={action:'moderate',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-research-v1'};
 assert.equal((await post(owner,moderate)).status,403);const a=await agent(owner);assert.equal((await machine(a.token,moderate)).status,403);assert.equal((await post('fixture-maintainer',moderate)).status,200);
 const hidden=(await (await get('?id='+item.id)).json()).item;assert.equal(hidden.record,null);assert.equal(hidden.state,'HIDDEN');assert(!JSON.stringify(hidden).includes(cmd.title));
 assert.equal((await post('fixture-maintainer',{...moderate,requestId:crypto.randomUUID(),state:'VISIBLE',reason:'RESTORED'})).status,200);
});

test('sponsor withdrawal is irreversible and retry/get/history never restore retained private content',async()=>{
 const owner=user(),a=await agent(owner),cmd=publish({title:'Withdraw this synthetic material'}),item=(await (await machine(a.token,cmd)).json()).item;
 const withdraw={action:'withdraw',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'SPONSOR_REQUEST',policyAccepted:'public-research-v1'};assert.equal((await post(user(),withdraw)).status,403);assert.equal((await post(owner,withdraw)).status,200);
 for(const response of [await get('?id='+item.id),await get('?root='+item.id),await machine(a.token,cmd)]){assert.equal(response.status,200);const raw=await response.text();assert(!raw.includes(cmd.title));assert(!raw.includes(a.command.name));assert(raw.includes('WITHDRAWN'));assert(raw.includes('"record":null'));}
 assert.equal((await post('fixture-maintainer',{action:'moderate',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,state:'VISIBLE',reason:'RESTORED',policyAccepted:'public-research-v1'})).status,409);
});

test('revocation between HTTP authentication and INSERT prevents the stale principal from publishing',async()=>{
 const owner=user(),a=await agent(owner),identities=new NetworkRepository(db),cmd=publish();
 const request=new Request('https://research.test/api/research/agent',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const response=await http.researchAgentRequest(request,factory,()=>({authenticate:async(token,t)=>{const principal=await identities.authenticate(token,t);await identities.write(owner,{action:'revoke',requestId:crypto.randomUUID(),id:a.command.id,revision:1},t);return principal;}}),()=>at);
 assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');assert.equal((await get('?id='+cmd.id)).status,404);
});

test('expiry advancing after authentication and insecure machine transports cannot publish',async()=>{
 const owner=user(),a=await agent(owner),cmd=publish();let n=0;
 const request=()=>new Request('https://research.test/api/research/agent',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const response=await http.researchAgentRequest(request(),factory,()=>new NetworkRepository(db),()=>n++===0?at:new Date(Date.parse(at)+7*86400000).toISOString());assert.equal(response.status,401);assert.equal((await get('?id='+cmd.id)).status,404);
 assert.equal((await http.researchAgentRequest(new Request('http://research.test/api/research/agent',{method:'POST'}),()=>{throw Error();},()=>{throw Error();})).status,403);
 assert.equal((await machine(a.token,cmd,{Origin:'https://foreign.test'})).status,403);
});

test('transport refuses otherwise valid receipts for changed content, authors or target identities',async()=>{
 const owner=user(),cmd=publish(),good=await factory().write(human(owner),cmd,at),request=()=>new Request('https://research.test/api/research',{method:'POST',headers:headers(owner),body:JSON.stringify(cmd)});
 const author=await model.researchPublicHumanId(user());
 for(const changed of [{...good,requestId:crypto.randomUUID()},{...good,item:{...good.item,digest:'0'.repeat(64)}},{...good,item:{...good.item,author:{kind:'HUMAN',id:author,sponsorId:author},record:{...good.item.record,author:{kind:'HUMAN',id:author,sponsorId:author}}}}])assert.equal((await http.researchHumanRequest(request(),{userId:owner},()=>({write:async()=>changed}),()=>false,()=>at)).status,503);
 const changedRecord={...good.item.record,content:{...good.item.record.content,title:'Different returned material'}},changed={...good,item:{...good.item,record:changedRecord,digest:await model.researchDigest(JSON.stringify(changedRecord))}};assert.equal((await http.researchHumanRequest(request(),{userId:owner},()=>({write:async()=>changed}),()=>false,()=>at)).status,503);
 assert.equal((await http.researchPublicRequest(new Request('https://research.test/api/research'),()=>({list:async()=>({version:1,items:[{...good.item,digest:'0'.repeat(64)}],nextCursor:null,executionEnabled:false})}))).status,503);
});

test('moderator configuration is explicit, bounded, duplicate-safe and fail-closed without a default grant',async()=>{
 const owner=user();for(const value of [undefined,null,'','[]'])assert.equal(researchModeratorAllowed(owner,value),false);assert.equal(researchModeratorAllowed(owner,JSON.stringify([owner])),true);
 for(const value of ['{',JSON.stringify([owner,owner]),' '.repeat(4097),JSON.stringify(Array(17).fill(owner)),JSON.stringify(['\u0000'])])assert.throws(()=>researchModeratorAllowed(owner,value),error=>error.status===503);
 const response=await http.researchMeRequest(new Request('https://research.test/api/research/me'),{userId:owner},id=>researchModeratorAllowed(id,'{'));assert.equal(response.status,503);assert(!(await response.text()).includes(owner));
});

test('moderation receipts cannot acknowledge a different event, author or terminal transition',async()=>{
 const owner=user(),cmd=publish(),item=(await factory().write(human(owner),cmd,at)).item;
 const hide={action:'moderate',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-research-v1'};
 const hidden=(await factory().write({kind:'HUMAN',userId:'fixture-maintainer',moderator:true},hide,at)).item;
 const withdraw={action:'withdraw',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'AUTHOR_REQUEST',policyAccepted:'public-research-v1'};
 const request=()=>new Request('https://research.test/api/research',{method:'POST',headers:headers(owner),body:JSON.stringify(withdraw)});
 const missing={version:1,action:'withdraw',requestId:withdraw.requestId,item:hidden,report:null,executionEnabled:false};
 assert.equal((await http.researchHumanRequest(request(),{userId:owner},()=>({write:async()=>missing}),()=>false,()=>at)).status,503);
 const actual=await factory().write(human(owner),withdraw,at),foreign=await model.researchPublicHumanId(user());
 for(const patch of [{reason:'PERSONAL_DATA'},{actor:{kind:'HUMAN',id:foreign,sponsorId:foreign}}]){
  const bad={...actual,item:{...actual.item,moderation:actual.item.moderation.map(event=>event.requestId===withdraw.requestId?{...event,...patch}:event)}};
  assert.equal((await http.researchHumanRequest(request(),{userId:owner},()=>({write:async()=>bad}),()=>false,()=>at)).status,503);
 }
});

test('daily throttling exposes only actual bounded Retry-After while retained capacity has no invented reset',async()=>{
 const owner=user(),cmd=publish(),request=()=>new Request('https://research.test/api/research',{method:'POST',headers:headers(owner),body:JSON.stringify(cmd)});
 for(const [error,wait] of [[new model.ResearchError('Daily limit.',429,60),'60'],[new model.ResearchError('Retained capacity.',409),null],[new model.ResearchError('Unknown reset.',429),null]]){
  const response=await http.researchHumanRequest(request(),{userId:owner},()=>({write:async()=>{throw error;}}),()=>false,()=>at);assert.equal(response.status,error.status);assert.equal(response.headers.get('Retry-After'),wait);
 }
});


test('moderator-only report pagination reaches retained details and rejects ambiguous or secret-bearing queries',async()=>{
 const owner=user(),cmd=publish(),item=(await (await post(owner,cmd)).json()).item;
 const expected=new Set();
 for(let n=0;n<25;n++){
  const report={action:'report',requestId:crypto.randomUUID(),id:item.id,digest:item.digest,reason:'OTHER',details:'Queue pagination fixture '+n,policyAccepted:'public-research-v1'};
  expected.add(report.requestId);assert.equal((await post(user(),report)).status,200);
 }
 const endpoint='https://research.test/api/research/reports';
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
