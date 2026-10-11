import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import ts from 'typescript';

const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(module,module.exports,id=>id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id));return module.exports;}
const M=load('app/contribution-model.ts'),W=load('app/contribution-work-model.ts'),H=load('app/contribution-work-http.ts'),N=load('app/network-model.ts'),{NetworkRepository}=load('app/network-store.ts'),{ContributionRepository}=load('app/contribution-store.ts');
const uid=()=>crypto.randomUUID(),origin='https://opengrail-work-fixture.test',at=new Date(Date.now()-1000).toISOString(),plus=(clock,ms)=>new Date(Date.parse(clock)+ms).toISOString(),ref=item=>({id:item.id,digest:item.digest}),human=userId=>({kind:'HUMAN',userId,maintainer:false});
let mf,db;
before(async()=>{
 // Actual Workerd/handler/D1 boundary. Fixture identity headers are neither
 // hosted OAuth nor a production account-switch test.
 const source=`import {contributionWorkHumanRequest,contributionWorkAgentRequest} from './app/contribution-work-http';import {ContributionRepository} from './app/contribution-store';import {NetworkRepository} from './app/network-store';
 export default{async fetch(request,env){const path=new URL(request.url).pathname,factory=()=>new ContributionRepository(env.DB),user=request.headers.get('X-Fixture-Actor'),current=request.headers.get('X-Fixture-Current-Actor'),actor=user?{userId:user}:null,now=()=>env.FIXTURE_AT;
 if(path==='/api/contributions/work/agent')return contributionWorkAgentRequest(request,factory,()=>new NetworkRepository(env.DB),now);
 return contributionWorkHumanRequest(request,actor,factory,async()=>current===null?actor:current==='SIGNED_OUT'?null:{userId:current},now);}};`;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});
 mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at}});
 db=await mf.getD1Database('DB');for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(value=>value.trim()).filter(Boolean))await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['contribution_claim_events','contribution_claims','contribution_task_events','contribution_tasks','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const repo=()=>new ContributionRepository(db);
async function task(){const userId=uid(),command={action:'register',requestId:uid(),id:uid(),title:'Synthetic work inbox task',summary:'Invented contribution fixture; no issue, deployment or external access.',kind:'TESTS',acceptance:['Current scoped receipt is inspectable.'],rejection:['Foreign work or stale material is disclosed.'],policyAccepted:M.contributionPolicy};return {actor:{kind:'HUMAN',userId,maintainer:true},item:(await repo().write({kind:'HUMAN',userId,maintainer:true},command,at)).task};}
async function claim(actor,parent,{release=false,submit=false}={}){const command={action:'claim',requestId:uid(),id:uid(),task:ref(parent.item),expectedTaskSequence:parent.item.sequence,policyAccepted:M.contributionPolicy};let item=(await repo().write(actor,command,at)).claim;if(release||submit)item=(await repo().write(actor,{action:release?'release':'submit',requestId:uid(),task:ref(parent.item),claim:ref(item),expectedSequence:item.sequence,...release?{reason:'AUTHOR_RELEASE'}:{handoffDigest:'e'.repeat(64)},policyAccepted:M.contributionPolicy},at)).claim;return item;}
async function agent(userId=uid()){const generated=await N.createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,tokenDigest:generated.tokenDigest,name:'Synthetic work inbox agent',days:30};await new NetworkRepository(db).write(userId,command,at);const principal=await new NetworkRepository(db).authenticate(generated.token,at);return {userId,token:generated.token,id:command.id,principal,actor:{kind:'AGENT',principal}};}
async function humanRequest(userId,query='',headers={},method='GET'){return mf.dispatchFetch(origin+'/api/contributions/work'+query,{method,headers:{'X-Fixture-Actor':userId,'X-Contribution-Author':await M.contributionPublicHumanId(userId),...headers}});}
async function agentRequest(identity,query='',headers={},method='GET',base=origin){return mf.dispatchFetch(base+'/api/contributions/work/agent'+query,{method,headers:{Authorization:'Bearer '+identity.token,...headers}});}
async function decode(response){assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/private.*no-store/);assert.equal(response.headers.get('Vary'),'Cookie, Authorization');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');return W.validateContributionWorkPage(await response.json());}
async function directHuman(userId,factory,current=async()=>({userId}),now=()=>at,query=''){const request=new Request(origin+'/api/contributions/work'+query,{headers:{'X-Contribution-Author':await M.contributionPublicHumanId(userId)}});return H.contributionWorkHumanRequest(request,{userId},factory,current,now);}
const machineRequest=identity=>new Request(origin+'/api/contributions/work/agent',{headers:{Authorization:'Bearer '+identity.token}});

test('actual Worker returns own sponsor work across tasks and agents without foreign rows, credentials or write authority',async()=>{
 const user=uid(),one=await agent(user),two=await agent(user),foreign=await agent(),rows=[];
 for(const actor of [human(user),one.actor,two.actor]){const parent=await task();rows.push(await claim(actor,parent,{release:true}));}
 const outsider=await claim(foreign.actor,await task(),{release:true}),response=await humanRequest(user),page=await decode(response);
 assert.equal(page.scope,'SPONSOR');assert.deepEqual(page.participant,{kind:'HUMAN',id:await M.contributionPublicHumanId(user),sponsorId:await M.contributionPublicHumanId(user)});assert.deepEqual(new Set(page.items.map(item=>item.claim.id)),new Set(rows.map(item=>item.id)));assert(page.items.every(item=>item.claim.status==='RELEASED'));assert(!JSON.stringify(page).includes(outsider.id));assert.equal(page.executionEnabled,false);
 for(const secret of [user,foreign.userId,one.token,two.token,one.principal.tokenDigest,one.principal.registryDigest])assert(!JSON.stringify(page).includes(secret));
 const empty=await decode(await humanRequest(uid()));assert.deepEqual(empty.items,[]);assert.equal(empty.nextCursor,null);
});
test('actual agent inbox contains only its exact actor, while the sponsor can inspect all own agent claims',async()=>{
 const user=uid(),one=await agent(user),two=await agent(user),first=await claim(one.actor,await task()),second=await claim(two.actor,await task()),page=await decode(await agentRequest(one));
 assert.equal(page.scope,'AGENT');assert.equal(page.participant.id,one.id);assert.deepEqual(page.items.map(item=>item.claim.id),[first.id]);assert(!JSON.stringify(page).includes(second.id));assert(!JSON.stringify(page).includes(one.token));assert.equal((await decode(await humanRequest(user))).items.length,2);
});
test('actual scoped pagination preserves retained order, rejects foreign cursors and never grants cursor-based actor selection',async()=>{
 const user=uid(),rows=[];for(let i=0;i<6;i++)rows.push(await claim(human(user),await task(),{release:true}));
 const first=await decode(await humanRequest(user));assert.equal(first.items.length,W.contributionWorkLimits.page);assert.equal(first.nextCursor,first.items.at(-1).claim.id);
 const second=await decode(await humanRequest(user,'?cursor='+first.nextCursor));assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(item=>item.claim.id)).size,6);
 for(let i=1;i<first.items.length;i++)assert(first.items[i].claim.id<first.items[i-1].claim.id);
 const outsider=await claim(human(uid()),await task(),{release:true});assert.equal((await humanRequest(user,'?cursor='+outsider.id)).status,404);
 const one=await agent(),other=await agent(one.userId),foreign=await claim(other.actor,await task(),{release:true});assert.equal((await agentRequest(one,'?cursor='+foreign.id)).status,404);
 for(const query of ['?owner='+user,'?sponsor='+await M.contributionPublicHumanId(user),'?agent='+one.id,'?task='+rows[0].task.id,'?cursor=','?cursor=bad','?cursor='+rows[0].id.toUpperCase(),'?cursor='+rows[0].id+'&cursor='+rows[0].id,'?token=forbidden']){assert.equal((await humanRequest(user,query)).status,400);assert.equal((await agentRequest(one,query)).status,400);}
});
test('actual hidden-task inbox retains safe identities while removing task, handoff and claim event payloads',async()=>{
 const user=uid(),parent=await task(),item=await claim(human(user),parent,{submit:true});
 await repo().write(parent.actor,{action:'hide',requestId:uid(),task:ref(parent.item),expectedSequence:0,reason:'POLICY',policyAccepted:M.contributionPolicy},at);
 const page=await decode(await humanRequest(user)),row=page.items[0];assert.equal(row.claim.id,item.id);assert.equal(row.task.state,'HIDDEN');assert.equal(row.task.record,null);assert.equal(row.claim.record,null);assert.equal(row.claim.handoffDigest,null);assert.deepEqual(row.claim.events,[]);assert.equal(row.claim.reason,null);assert(!JSON.stringify(page).includes(parent.item.record.content.summary));assert(!JSON.stringify(page).includes('e'.repeat(64)));
});
test('human reads require current identity and frozen author header; unsupported methods reach no repository',async()=>{
 const user=uid();assert.equal((await mf.dispatchFetch(origin+'/api/contributions/work')).status,401);
 for(const headers of [{'X-Contribution-Author':''},{'X-Contribution-Author':'human_'+'a'.repeat(64)},{'X-Fixture-Current-Actor':uid()},{'X-Fixture-Current-Actor':'SIGNED_OUT'},{Origin:'https://foreign.test'}])assert.equal((await humanRequest(user,'',headers)).status,403,JSON.stringify(headers));
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS']){const response=await humanRequest(user,'',{},method);assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET');const denied=await agentRequest(await agent(),' ',{},method);assert.equal(denied.status,405);}
 let calls=0;const response=await H.contributionWorkHumanRequest(new Request(origin+'/api/contributions/work',{method:'POST'}),{userId:user},()=>{calls++;throw Error();},async()=>({userId:user}),()=>at);assert.equal(response.status,405);assert.equal(calls,0);
});
test('agent reads require HTTPS and header-only credentials and reject actual revoked registrations',async()=>{
 const identity=await agent();assert.equal((await agentRequest(identity,'',{},'GET','http://opengrail-work-fixture.test')).status,403);
 for(const authorization of ['',identity.token,'Bearer bad','Bearer '+identity.token+'x']){const response=await agentRequest(identity,'',{Authorization:authorization});assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');}
 assert.equal((await agentRequest(identity,'',{Origin:'https://foreign.test'})).status,403);
 await new NetworkRepository(db).write(identity.userId,{action:'revoke',requestId:uid(),id:identity.id,revision:1},at);
 const revoked=await agentRequest(identity);assert.equal(revoked.status,401);assert.equal(revoked.headers.get('WWW-Authenticate'),'Bearer');assert(!JSON.stringify(await revoked.json()).includes(identity.token));
});
test('handler refuses swapped participant, foreign claim, wrong source pairing, malformed canonical material and forged authority',async()=>{
 const user=uid(),parent=await task();await claim(human(user),parent);const baseline=await repo().work(human(user),null,at),foreignUser=uid(),foreignParent=await task(),foreignClaim=await claim(human(foreignUser),foreignParent);
 const cases=[{...baseline,participant:{kind:'HUMAN',id:await M.contributionPublicHumanId(foreignUser),sponsorId:await M.contributionPublicHumanId(foreignUser)}},{...baseline,items:[{task:foreignParent.item,claim:foreignClaim}]},{...baseline,items:[{...baseline.items[0],task:foreignParent.item}]},{...baseline,items:[{...baseline.items[0],claim:{...baseline.items[0].claim,digest:'f'.repeat(64)}}]},{...baseline,checkedAt:plus(at,1)},{...baseline,executionEnabled:true},{...baseline,owner:user},{...baseline,items:[...baseline.items,...baseline.items]},{...baseline,items:[{...baseline.items[0],task:{...parent.item,record:{...parent.item.record,content:{...parent.item.record.content,title:'x'.repeat(W.contributionWorkLimits.responseBytes)}}}}]}];
 for(const value of cases){const response=await directHuman(user,()=>({work:async()=>value}));assert.equal(response.status,503);const body=await response.json();assert(!JSON.stringify(body).includes(parent.item.record.content.summary));assert(!JSON.stringify(body).includes(foreignClaim.id));}
 const getter={...baseline};Object.defineProperty(getter,'items',{enumerable:true,get(){throw Error('Untrusted response hook');}});assert.equal((await directHuman(user,()=>({work:async()=>getter}))).status,503);
 const repeated=await directHuman(user,()=>({work:async()=>baseline}),async()=>({userId:user}),()=>at,'?cursor='+baseline.items[0].claim.id);assert.equal(repeated.status,503);
});
test('human switch during an awaited repository read returns no previously fetched work',async()=>{
 const user=uid(),parent=await task();await claim(human(user),parent);let active=user,read=false;
 const response=await directHuman(user,()=>({async work(...args){const value=await repo().work(...args);read=true;active=uid();return value;}}),async()=>({userId:active}));assert.equal(read,true);assert.equal(response.status,403);assert(!JSON.stringify(await response.json()).includes(parent.item.id));
});
test('a task hidden during the final human identity await cannot release the earlier unsuppressed page',async()=>{
 const user=uid(),parent=await task();await claim(human(user),parent,{submit:true});let checks=0;
 const response=await directHuman(user,()=>repo(),async()=>{checks++;await repo().write(parent.actor,{action:'hide',requestId:uid(),task:ref(parent.item),expectedSequence:0,reason:'POLICY',policyAccepted:M.contributionPolicy},at);return {userId:user};});
 assert.equal(checks,1);assert.equal(response.status,503);assert(!JSON.stringify(await response.json()).includes(parent.item.record.content.summary));
 const retry=await decode(await humanRequest(user));assert.equal(retry.items[0].task.state,'HIDDEN');assert.equal(retry.items[0].claim.handoffDigest,null);
});
test('a task hidden during final agent authentication cannot release earlier task or handoff content',async()=>{
 const identity=await agent(),parent=await task();await claim(identity.actor,parent,{submit:true});let authentications=0;
 const identities={async authenticate(...args){authentications++;if(authentications===2)await repo().write(parent.actor,{action:'hide',requestId:uid(),task:ref(parent.item),expectedSequence:0,reason:'POLICY',policyAccepted:M.contributionPolicy},at);return new NetworkRepository(db).authenticate(...args);}};
 const response=await H.contributionWorkAgentRequest(machineRequest(identity),()=>repo(),()=>identities,()=>at);assert.equal(authentications,2);assert.equal(response.status,503);assert(!JSON.stringify(await response.json()).includes(parent.item.record.content.summary));
});
test('agent revocation after a successful repository read is fenced by fresh final authentication',async()=>{
 const identity=await agent(),parent=await task();await claim(identity.actor,parent);let read=false;
 const response=await H.contributionWorkAgentRequest(machineRequest(identity),()=>({async work(...args){const value=await repo().work(...args);read=true;await new NetworkRepository(db).write(identity.userId,{action:'revoke',requestId:uid(),id:identity.id,revision:1},at);return value;}}),()=>new NetworkRepository(db),()=>at);
 assert.equal(read,true);assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');assert(!JSON.stringify(await response.json()).includes(parent.item.id));
});
test('claim expiry while reads await changes only projection time and preserves original immutable evidence',async()=>{
 const user=uid(),parent=await task(),item=await claim(human(user),parent,{submit:true}),later=plus(item.expiresAt,1);let current=at;
 const response=await directHuman(user,()=>({async work(...args){const value=await repo().work(...args);current=later;return value;}}),async()=>({userId:user}),()=>current),page=await decode(response),row=page.items[0];
 assert.equal(page.checkedAt,later);assert.equal(row.claim.checkedAt,later);assert.equal(row.claim.status,'EXPIRED');assert.deepEqual(row.claim.record,item.record);assert.deepEqual(row.claim.events,item.events);assert.equal(row.claim.digest,item.digest);assert.equal(row.claim.handoffDigest,item.handoffDigest);
 const regressed=await directHuman(user,()=>({work:(...args)=>repo().work(...args)}),async()=>{current=plus(at,-1);return {userId:user};},()=>{const value=current;current=at;return value;});assert.equal(regressed.status,503);
});
test('agent expiry across final authentication and changed credential identities never release the page',async()=>{
 const identity=await agent(),parent=await task();await claim(identity.actor,parent);const value=await repo().work(identity.actor,null,at),future=identity.principal.expiresAt;let current=at,calls=0;
 const late={async authenticate(){calls++;if(calls===2)current=future;return identity.principal;}};
 const expired=await H.contributionWorkAgentRequest(machineRequest(identity),()=>({work:async()=>value}),()=>late,()=>current);assert.equal(calls,2);assert.equal(expired.status,401);
 const changed={async authenticate(){return ++calls===1?identity.principal:{...identity.principal,name:'Changed identity'};}};calls=0;current=at;
 const swapped=await H.contributionWorkAgentRequest(machineRequest(identity),()=>({work:async()=>value}),()=>changed,()=>current);assert.equal(swapped.status,401);
 const wrong={authenticate:async()=>({...identity.principal,credentialId:uid()})};assert.equal((await H.contributionWorkAgentRequest(machineRequest(identity),()=>repo(),()=>wrong,()=>at)).status,503);
});
test('actual canonical corruption remains unavailable without modifying retained rows',async()=>{
 const user=uid(),parent=await task(),item=await claim(human(user),parent);await db.prepare('UPDATE contribution_claims SET command_digest=? WHERE id=?').bind('f'.repeat(64),item.id).run();const response=await humanRequest(user);assert.equal(response.status,503);assert.equal((await db.prepare('SELECT command_digest FROM contribution_claims WHERE id=?').bind(item.id).first()).command_digest,'f'.repeat(64));
});
test('the actual two-read agent handler stays within the D1 invocation budget when both scoped reads reconcile three times',async()=>{
 const identity=await agent();for(let i=0;i<6;i++)await claim(identity.actor,await task(),{release:true});
 const first=await repo().work(identity.actor,null,at);assert.equal(first.items.length,W.contributionWorkLimits.page);assert(first.nextCursor);
 const expected=await repo().work(identity.actor,first.nextCursor,at);assert.equal(expected.items.length,1);
 let queries=0,fences=0,authentications=0;
 // Every counted operation reaches actual local D1. Only the first two stable
 // results per read are replaced with synthetic uncertainty after SQL executes;
 // canonical evidence remains unchanged so final publication can succeed.
 const counted={prepare(sql){
  const wrap=statement=>({bind(...values){return wrap(statement.bind(...values));},async first(...args){queries++;if(sql.includes('FROM network_agents WHERE credential_id='))authentications++;const value=await statement.first(...args);if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&++fences%W.contributionWorkLimits.reconciliationAttempts!==0)return null;return value;},async all(){queries++;if(sql.includes('FROM network_agents WHERE credential_id='))authentications++;return statement.all();},async run(){queries++;return statement.run();}});
  return wrap(db.prepare(sql));
 }};
 const request=new Request(origin+'/api/contributions/work/agent?cursor='+first.nextCursor,{headers:{Authorization:'Bearer '+identity.token}});
 const response=await H.contributionWorkAgentRequest(request,()=>new ContributionRepository(counted),()=>new NetworkRepository(counted),()=>at),page=await decode(response);
 assert.deepEqual(page,expected);assert.equal(W.contributionWorkLimits.reconciliationAttempts,3);assert.equal(fences,6);assert.equal(authentications,2);assert.equal(queries,44);assert(queries<=50);
 // This counts the actual handler's local D1 calls, not platform authentication,
 // production billing/latency, or extra queries from an outer deployment wrapper.
});
test('new route exports allow GET only and new handlers contain no writer or maintainer grant',()=>{
 for(const file of ['app/api/contributions/work/route.ts','app/api/contributions/work/agent/route.ts']){const source=readFileSync(file,'utf8');assert(/export (?:async function GET|const GET=)/.test(source));for(const method of ['POST','DELETE','PUT','PATCH','HEAD','OPTIONS'])assert(source.includes('export const '+method+'=unsupported;'));assert(source.includes("Allow:'GET'"));}
 const source=readFileSync('app/contribution-work-http.ts','utf8');assert(!/\.write\(|maintainer:true|process\.env|Bearer.*console/.test(source));
});
