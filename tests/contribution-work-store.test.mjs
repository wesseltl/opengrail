import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(module,module.exports,id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id));return module.exports;}
const M=load('app/contribution-model.ts'),W=load('app/contribution-work-model.ts'),{ContributionRepository}=load('app/contribution-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-30_000).toISOString(),plus=(time,ms)=>new Date(Date.parse(time)+ms).toISOString(),human=(maintainer=false)=>({kind:'HUMAN',userId:uid(),maintainer}),ref=item=>({id:item.id,digest:item.digest}),status=code=>error=>error instanceof M.ContributionError&&error.status===code;
const register=(extra={})=>({action:'register',requestId:uid(),id:uid(),title:'Contribution inbox fixture',summary:'Retain bounded work and adverse review history.',kind:'TESTS',acceptance:['Current exact evidence can be inspected.'],rejection:['Reject fabricated authority.'],policyAccepted:M.contributionPolicy,...extra});
const claim=task=>({action:'claim',requestId:uid(),id:uid(),task:ref(task),expectedTaskSequence:task.sequence,policyAccepted:M.contributionPolicy});
const submit=(task,item)=>({action:'submit',requestId:uid(),task:ref(task),claim:ref(item),expectedSequence:item.sequence,handoffDigest:'a'.repeat(64),policyAccepted:M.contributionPolicy});
const review=(task,item,decision='CHANGES_REQUESTED')=>({action:'review',requestId:uid(),task:ref(task),claim:ref(item),expectedSequence:item.sequence,decision,reason:decision==='ACCEPTED'?'ACCEPTANCE_MET':decision==='REJECTED'?'FAILED_ACCEPTANCE':'NEEDS_CHANGES',policyAccepted:M.contributionPolicy});
const release=(task,item)=>({action:'release',requestId:uid(),task:ref(task),claim:ref(item),expectedSequence:item.sequence,reason:'AUTHOR_RELEASE',policyAccepted:M.contributionPolicy});
let mf,db;
before(async()=>{
 const contents=`import {ContributionRepository} from './app/contribution-store.ts';import {NetworkRepository} from './app/network-store.ts';export default{async fetch(request,env){const data=await request.json();try{const actor=data.token?{kind:'AGENT',principal:await new NetworkRepository(env.DB).authenticate(data.token,data.at)}:{kind:'HUMAN',userId:data.user,maintainer:false};return Response.json(await new ContributionRepository(env.DB).work(actor,data.cursor??null,data.at));}catch(error){return Response.json({error:error.message},{status:error.status??503});}}};`;
 const bundle=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['contribution_claim_events','contribution_claims','contribution_task_events','contribution_tasks','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf?.dispose());
const repo=()=>new ContributionRepository(db),write=(actor,command,time=at())=>repo().write(actor,command,time);
async function task(time=at(),actor=human(true),extra={}){return {actor,item:(await write(actor,register(extra),time)).task};}
async function agent(sponsor,name='Synthetic inbox agent',time=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name,tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,time);return {actor:{kind:'AGENT',principal:await new NetworkRepository(db).authenticate(generated.token,time)},token:generated.token,command,sponsor};}
const revoke=(a,time=at())=>new NetworkRepository(db).write(a.sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},time);
const parentEvent=(t,action,time)=>write(t.actor,{action,requestId:uid(),task:ref(t.item),expectedSequence:t.item.sequence,reason:action==='hide'?'POLICY':'MAINTAINER_CLOSED',policyAccepted:M.contributionPolicy},time);
const publicHuman=async actor=>{const id=await M.contributionPublicHumanId(actor.userId);return {kind:'HUMAN',id,sponsorId:id};};
async function seedClaim(t,author,time){const command=claim(t.item),checked=M.boundedContributionClaimRecord(M.contributionClaimRecordForCommand(command,author,time));await db.prepare('INSERT INTO contribution_claims(id,task_id,task_digest,task_sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(command.id,t.item.id,t.item.digest,0,author.kind+':'+author.id,author.sponsorId,command.requestId,await M.contributionDigest(M.boundedContributionCommand(command).payload),checked.payload,await M.contributionDigest(checked.payload),time,checked.record.expiresAt).run();return command.id;}
function wrapper(hook){return {prepare(sql){const wrap=(statement,args=[])=>({bind(...values){return wrap(statement.bind(...values),values);},async first(...values){await hook({sql,args,phase:'before'});const result=await statement.first(...values);await hook({sql,args,phase:'after',result});return result;},async all(){await hook({sql,args,phase:'before'});const result=await statement.all();await hook({sql,args,phase:'after',result});return result;},async run(){await hook({sql,args,phase:'before'});const result=await statement.run();await hook({sql,args,phase:'after',result});return result;}});return wrap(db.prepare(sql));}};}
async function worker(input){return mf.dispatchFetch('https://fixture.test/work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});}

test('actual Worker/D1 returns a sponsor family and an exact agent scope without leaking private identities',async()=>{
 const time=at(),sponsor=human(),other=human(),a=await agent(sponsor,'Agent A',time),b=await agent(sponsor,'Agent B',time),foreign=await agent(other,'Foreign agent',time),tasks=await Promise.all(Array.from({length:4},()=>task(time)));
 const self=await write(sponsor,claim(tasks[0].item),time);await write(sponsor,release(tasks[0].item,self.claim),time);
 const first=await write(a.actor,claim(tasks[1].item),time),second=await write(b.actor,claim(tasks[2].item),time);await write(foreign.actor,claim(tasks[3].item),time);
 const response=await worker({user:sponsor.userId,at:time}),page=await W.validateContributionWorkPage(await response.json());assert.equal(response.status,200);assert.equal(page.scope,'SPONSOR');assert.equal(page.items.length,3);assert.deepEqual(new Set(page.items.map(x=>x.claim.author.id)),new Set([self.claim.author.id,a.command.id,b.command.id]));assert(!JSON.stringify(page).includes(sponsor.userId));assert(!JSON.stringify(page).includes(a.token));assert(!page.items.some(x=>x.claim.author.id===foreign.command.id));
 const own=await worker({token:a.token,at:time}),agentPage=await W.validateContributionWorkPage(await own.json());assert.equal(agentPage.scope,'AGENT');assert.deepEqual(agentPage.participant,first.claim.author);assert.deepEqual(agentPage.items.map(x=>x.claim.id),[first.claim.id]);assert(!agentPage.items.some(x=>x.claim.id===second.claim.id));assert.equal(page.executionEnabled,false);
});

test('two-task work retains active, submitted and adverse terminal feedback across explicit fresh attempts',async()=>{
 const time=at(),sponsor=human(),a=await agent(sponsor,'Returning contributor',time),t1=await task(time),t2=await task(time),first=await write(a.actor,claim(t1.item),time),second=await write(a.actor,claim(t2.item),time),submitted=await write(a.actor,submit(t1.item,first.claim),plus(time,100));
 let page=await repo().work(a.actor,null,plus(time,100));assert.deepEqual(new Set(page.items.map(x=>x.claim.status)),new Set(['ACTIVE','SUBMITTED']));
 const reviewed=await write(t1.actor,review(t1.item,submitted.claim),plus(time,200));await assert.rejects(()=>write(a.actor,submit(t1.item,reviewed.claim),plus(time,300)),status(409));
 const next=await write(a.actor,claim(t1.item),plus(time,300));page=await repo().work(a.actor,null,plus(time,300));assert.equal(page.items.length,3);const retained=page.items.find(x=>x.claim.id===first.claim.id).claim;assert.equal(retained.status,'CHANGES_REQUESTED');assert.equal(retained.reason,'NEEDS_CHANGES');assert.equal(retained.handoffDigest,submitted.claim.handoffDigest);assert.deepEqual(retained.events,reviewed.claim.events);assert.equal(retained.expiresAt,first.claim.expiresAt);assert(page.items.some(x=>x.claim.id===next.claim.id&&x.claim.status==='ACTIVE'));assert(page.items.some(x=>x.claim.id===second.claim.id&&x.claim.status==='ACTIVE'));assert(!('reputation'in page));assert(!('acceptedContributions'in page));
});

test('bounded keyset pagination preserves all terminal attempts, tied clocks and a foreign cursor fails closed',async()=>{
 const time=at(),sponsor=human(),author=await publicHuman(sponsor),t=await task(plus(time,-1));for(let n=0;n<12;n++)await seedClaim(t,author,time);
 let cursor=null,all=[];do{const page=await repo().work(sponsor,cursor,time);assert(page.items.length<=5);assert.equal(page.nextCursor===null||page.nextCursor===page.items.at(-1).claim.id,true);all.push(...page.items);cursor=page.nextCursor;}while(cursor);
 assert.equal(all.length,12);assert.equal(new Set(all.map(x=>x.claim.id)).size,12);assert.deepEqual(all.map(x=>x.claim.id),all.map(x=>x.claim.id).sort().reverse());
 const foreign=human(),foreignId=await seedClaim(t,await publicHuman(foreign),time);await assert.rejects(()=>repo().work(sponsor,foreignId,time),status(404));await assert.rejects(()=>repo().work(sponsor,uid(),time),status(404));await assert.rejects(()=>repo().work(sponsor,'INVALID',time),status(400));
});

test('agent cursors cannot select a sibling claim even though both are publicly readable',async()=>{
 const time=at(),sponsor=human(),a=await agent(sponsor,'First sibling',time),b=await agent(sponsor,'Second sibling',time),t1=await task(time),t2=await task(time),own=await write(a.actor,claim(t1.item),time),sibling=await write(b.actor,claim(t2.item),time);assert.equal((await repo().getClaim(sibling.claim.id,time)).item.author.id,b.command.id);await assert.rejects(()=>repo().work(a.actor,sibling.claim.id,time),status(404));assert.equal((await repo().work(sponsor,sibling.claim.id,time)).scope,'SPONSOR');assert.equal((await repo().work(a.actor,own.claim.id,time)).items.length,0);
});

test('expiry is a projection, not a renewed lease or appended event, and terminal outcomes survive later expiry',async()=>{
 const time=at(),sponsor=human(),t=await task(plus(time,-4*86400000)),expired=await seedClaim(t,await publicHuman(sponsor),plus(time,-4*86400000));let page=await repo().work(sponsor,null,time);assert.equal(page.items[0].claim.id,expired);assert.equal(page.items[0].claim.status,'EXPIRED');assert.equal(page.items[0].claim.sequence,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contribution_claim_events').first()).n,0);
 const t2=await task(time),current=await write(sponsor,claim(t2.item),time),submitted=await write(sponsor,submit(t2.item,current.claim),time);await write(t2.actor,review(t2.item,submitted.claim,'REJECTED'),time);page=await repo().work(sponsor,null,plus(time,4*86400000));assert.equal(page.items.find(x=>x.claim.id===current.claim.id).claim.status,'REJECTED');
});

test('revoked or expired agent credentials cannot read while sponsors retain the agent history',async()=>{
 const time=at(),sponsor=human(),a=await agent(sponsor,'Revoked history',time),t=await task(time),owned=await write(a.actor,claim(t.item),time);await revoke(a,time);await assert.rejects(()=>repo().work(a.actor,null,time),status(401));assert.equal((await repo().work(sponsor,null,time)).items[0].claim.id,owned.claim.id);
 const expired=await agent(human(),'Expired empty inbox',plus(time,-2*86400000),1);await assert.rejects(()=>repo().work(expired.actor,null,time),status(401));await assert.rejects(()=>repo().work(null,null,time),status(401));
});

test('revocation at the final combined SELECT rejects a populated and an empty agent inbox',async()=>{
 for(const populated of [true,false]){const time=at(),a=await agent(human(),'Final revocation',time);if(populated){const t=await task(time);await write(a.actor,claim(t.item),time);}let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'&&!reached){reached=true;await revoke(a,time);}}));await assert.rejects(()=>racing.work(a.actor,null,time),status(401));assert.equal(reached,true);}
});

test('the real SQLite clock rejects an agent credential expiring after valid read admission',async()=>{
 const now=new Date().toISOString(),registered=plus(now,-86400000+1200),a=await agent(human(),'Expiring work read',registered,1);let waited=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'&&!waited){waited=true;const delay=Date.parse(a.actor.principal.expiresAt)-Date.now()+70;if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));}}));await assert.rejects(()=>racing.work(a.actor,null,now),status(401));assert(waited);
});

test('hiding during the final read reconciles suppressed task and submitted handoff content',async()=>{
 const time=at(),sponsor=human(),t=await task(time,human(true),{title:'Suppress this authored sentinel'}),owned=await write(sponsor,claim(t.item),time),submitted=await write(sponsor,submit(t.item,owned.claim),time);let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'&&!reached){reached=true;await parentEvent(t,'hide',time);}}));const page=await racing.work(sponsor,null,time);assert(reached);assert.equal(page.items[0].task.state,'HIDDEN');assert.equal(page.items[0].task.record,null);assert.equal(page.items[0].claim.record,null);assert.equal(page.items[0].claim.handoffDigest,null);assert.equal(page.items[0].claim.reason,null);assert.deepEqual(page.items[0].claim.events,[]);assert(!JSON.stringify(page).includes('Suppress this authored sentinel'));assert(!JSON.stringify(page).includes(submitted.claim.handoffDigest));assert.equal(page.items[0].claim.status,'SUBMITTED');
});

test('a review appended during the final read reconciles the retained new disposition',async()=>{
 const time=at(),sponsor=human(),t=await task(time),owned=await write(sponsor,claim(t.item),time),submitted=await write(sponsor,submit(t.item,owned.claim),time);let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'&&!reached){reached=true;await write(t.actor,review(t.item,submitted.claim),time);}}));const page=await racing.work(sponsor,null,time);assert(reached);assert.equal(page.items[0].claim.status,'CHANGES_REQUESTED');assert.equal(page.items[0].claim.events.length,2);assert.equal(page.items[0].claim.reason,'NEEDS_CHANGES');
});

test('canonical claim/task/event corruption is retained and unavailable rather than omitted or repaired',async()=>{
 for(const target of ['claim','task','event']){const time=at(),sponsor=human(),t=await task(time),owned=await write(sponsor,claim(t.item),time);if(target==='event')await write(sponsor,submit(t.item,owned.claim),time);const table=target==='task'?'contribution_tasks':target==='claim'?'contribution_claims':'contribution_claim_events',column=target==='event'?'claim_id':'id',id=target==='task'?t.item.id:owned.claim.id;await db.prepare(`UPDATE ${table} SET payload=? WHERE ${column}=?`).bind('{}',id).run();await assert.rejects(()=>repo().work(sponsor,null,time),status(503));assert.equal((await db.prepare(`SELECT payload FROM ${table} WHERE ${column}=?`).bind(id).first()).payload,'{}');await db.prepare(`DELETE FROM ${table} WHERE ${column}=?`).bind(id).run();}
});

test('corrupt lookahead and scoped cursor cannot be hidden behind the returned five rows',async()=>{
 const time=at(),sponsor=human(),t=await task(time),author=await publicHuman(sponsor);for(let n=0;n<7;n++)await seedClaim(t,author,plus(time,n));const first=await repo().work(sponsor,null,plus(time,7)),sixth=(await repo().work(sponsor,first.nextCursor,plus(time,7))).items[0].claim;await db.prepare('UPDATE contribution_claims SET payload=? WHERE id=?').bind('{}',sixth.id).run();await assert.rejects(()=>repo().work(sponsor,null,plus(time,7)),status(503));await assert.rejects(()=>repo().work(sponsor,sixth.id,plus(time,7)),status(503));
});

test('a scoped pagination anchor retains full dependency history checks even when it is not a returned item',async()=>{
 const time=at(),sponsor=human(),t=await task(time),owned=await write(sponsor,claim(t.item),time);await write(sponsor,submit(t.item,owned.claim),time);assert.equal((await repo().work(sponsor,owned.claim.id,time)).items.length,0);
 await db.prepare('UPDATE contribution_claim_events SET payload=? WHERE claim_id=?').bind('{}',owned.claim.id).run();await assert.rejects(()=>repo().work(sponsor,owned.claim.id,time),status(503));assert.equal((await db.prepare('SELECT payload FROM contribution_claim_events WHERE claim_id=?').bind(owned.claim.id).first()).payload,'{}');
});

test('source hiding on the final scoped-anchor fence is reconciled without exposing omitted anchor content',async()=>{
 const time=at(),sponsor=human(),t=await task(time,human(true),{title:'Omitted anchor sentinel'}),owned=await write(sponsor,claim(t.item),time);let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'&&!reached){reached=true;await parentEvent(t,'hide',time);}}));const page=await racing.work(sponsor,owned.claim.id,time);assert(reached);assert.deepEqual(page.items,[]);assert.equal(page.nextCursor,null);assert(!JSON.stringify(page).includes('Omitted anchor sentinel'));assert.equal((await repo().get(t.item.id,time)).item.state,'HIDDEN');
});

test('a self-consistent immutable task replacement during reconciliation is rejected',async()=>{
 const time=at(),sponsor=human(),t=await task(time),owned=await write(sponsor,claim(t.item),time),record={...t.item.record,content:{...t.item.record.content,title:'Changed immutable source'}},payload=M.boundedContributionTaskRecord(record).payload;let replaced=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'&&!replaced){replaced=true;await db.prepare('UPDATE contribution_tasks SET payload=?,digest=?,command_digest=? WHERE id=?').bind(payload,await M.contributionDigest(payload),await M.contributionDigest(M.boundedContributionCommand(M.contributionTaskCommandForRecord(record)).payload),t.item.id).run();}}));await assert.rejects(()=>racing.work(sponsor,null,time),status(503));assert(replaced);assert.equal((await db.prepare('SELECT payload FROM contribution_tasks WHERE id=?').bind(t.item.id).first()).payload,payload);assert.equal((await db.prepare('SELECT id FROM contribution_claims WHERE id=?').bind(owned.claim.id).first()).id,owned.claim.id);
});

test('work-page validation rejects cross-scope, misbound, stale, duplicate and untrusted material',async()=>{
 const time=at(),sponsor=human(),t=await task(time),owned=await write(sponsor,claim(t.item),time),page=await repo().work(sponsor,null,time);assert.deepEqual(await W.validateContributionWorkPage(page),page);
 for(const edit of [x=>x.scope='AGENT',x=>x.participant.id='human_'+'0'.repeat(64),x=>x.items[0].task.digest='0'.repeat(64),x=>x.items[0].claim.checkedAt=plus(time,1),x=>x.items.push(x.items[0]),x=>x.nextCursor=owned.claim.id,x=>x.executionEnabled=true,x=>x.items[0].task.record.content.summary='github_pat_'+'a'.repeat(40),x=>x.items[0].task.record.content.title=' Changed canonical text ']){const changed=structuredClone(page);edit(changed);await assert.rejects(()=>W.validateContributionWorkPage(changed));}
 let called=false;const hooks=Object.defineProperty({},'version',{enumerable:true,get(){called=true;return 1;}});await assert.rejects(()=>W.validateContributionWorkPage(hooks));assert.equal(called,false);const hidden=Object.defineProperty(structuredClone(page),'secret',{value:'hidden'});await assert.rejects(()=>W.validateContributionWorkPage(hidden));const deep={};let tail=deep;for(let n=0;n<30;n++){tail.next={};tail=tail.next;}await assert.rejects(()=>W.validateContributionWorkPage(deep));const cyclic={};cyclic.next=cyclic;await assert.rejects(()=>W.validateContributionWorkPage(cyclic));
});

test('the work response byte cap rejects multibyte material before schema normalization',async()=>{
 const time=at(),page=await repo().work(human(),null,time),oversized={...page,unknown:'界'.repeat(180000)};assert(oversized.unknown.length<W.contributionWorkLimits.responseBytes);assert(new TextEncoder().encode(JSON.stringify(oversized)).byteLength>W.contributionWorkLimits.responseBytes);assert.throws(()=>W.parseContributionWorkPage(oversized),status(413));await assert.rejects(()=>W.validateContributionWorkPage(oversized),status(413));
});

test('one work page cannot mix visible and suppressed snapshots of the same exact task',async()=>{
 const time=at(),sponsor=human(),t=await task(time),author=await publicHuman(sponsor);await seedClaim(t,author,time);await seedClaim(t,author,time);const visible=await repo().work(sponsor,null,time);await parentEvent(t,'hide',time);const hidden=await repo().work(sponsor,null,time),mixed={...hidden,items:[hidden.items[0],visible.items[1]]};await assert.rejects(()=>W.validateContributionWorkPage(mixed),status(400));assert.deepEqual(await W.validateContributionWorkPage(hidden),hidden);
});

test('three actual failed scoped-cursor fences bound an agent read to 19 D1 queries and preserve retained attempts',async()=>{
 const time=at(),a=await agent(human(),'Bounded work read',time),tasks=[];let cursor;
 for(let n=0;n<3;n++){const t=await task(time),clock=plus(time,n+1),owned=await write(a.actor,claim(t.item),clock);await write(a.actor,release(t.item,owned.claim),clock);tasks.push(t);cursor=owned.claim.id;}
 const before=(await db.prepare('SELECT * FROM contribution_claims ORDER BY id').all()).results,events=(await db.prepare('SELECT * FROM contribution_claim_events ORDER BY claim_id,sequence').all()).results;let queries=0,fences=0;
 const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(phase!=='before')return;queries++;if(sql.startsWith('SELECT 1 AS contribution_work_stable')){const target=tasks[fences++];await parentEvent(target,'hide',plus(time,100));}}));
 await assert.rejects(()=>racing.work(a.actor,cursor,plus(time,200)),status(503));assert.equal(fences,3);assert.equal(W.contributionWorkLimits.reconciliationAttempts,3);assert.equal(queries,19);assert(2*queries+2<=50);
 assert.deepEqual((await db.prepare('SELECT * FROM contribution_claims ORDER BY id').all()).results,before);assert.deepEqual((await db.prepare('SELECT * FROM contribution_claim_events ORDER BY claim_id,sequence').all()).results,events);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contribution_task_events').first()).n,3);
 const current=await repo().work(a.actor,cursor,plus(time,200));assert.equal(current.items.length,2);assert(current.items.every(item=>item.task.state==='HIDDEN'&&item.claim.record===null));
});

test('mixed-version work validates revision predecessor beyond its bounded visible page',async()=>{
 const time=at(),owner=human(),t=await task(time),first=await write(owner,claim(t.item),time),submitted=await write(owner,submit(t.item,first.claim),plus(time,10)),prior=await write(t.actor,review(t.item,submitted.claim),plus(time,20));
 for(let n=0;n<2;n++){const ordinary=await write(owner,claim(t.item),plus(time,30+n*2));await write(owner,release(t.item,ordinary.claim),plus(time,31+n*2));}
 const command={...claim(t.item),version:2,revisionOf:{claim:ref(prior.claim),review:{sequence:2,digest:prior.claim.events[1].digest}}},linked=await write(owner,command,plus(time,40));
 for(let n=0;n<4;n++){const other=await task(time),ordinary=await write(owner,claim(other.item),plus(time,100+n*10));await write(owner,release(other.item,ordinary.claim),plus(time,101+n*10));}
 const page=await repo().work(owner,null,plus(time,150));assert.equal(page.items.length,5);assert(page.items.some(item=>item.claim.id===linked.claim.id&&item.claim.record.version===2));assert(!page.items.some(item=>item.claim.id===prior.claim.id));assert(page.nextCursor);assert.equal(page.version,1);assert.equal(page.executionEnabled,false);
 let changed=false;const guarded=new ContributionRepository(wrapper(async({sql,phase})=>{if(!changed&&sql.startsWith('SELECT 1 AS contribution_work_stable')&&phase==='before'){changed=true;await db.prepare('DELETE FROM contribution_claim_events WHERE claim_id=? AND sequence=2').bind(prior.claim.id).run();}}));await assert.rejects(()=>guarded.work(owner,null,plus(time,150)),status(503));assert(changed);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contribution_claims WHERE id=?').bind(linked.claim.id).first()).n,1);
});


test('the final exhausted reconciliation observation still returns401 for a revoked agent',async()=>{
 const time=at(),a=await agent(human(),'Last-fence revocation',time),tasks=[];let cursor;
 for(let n=0;n<3;n++){const t=await task(time),owned=await write(a.actor,claim(t.item),plus(time,n+1));await write(a.actor,release(t.item,owned.claim),plus(time,n+1));tasks.push(t);cursor=owned.claim.id;}
 let fences=0;const guarded=new ContributionRepository(wrapper(async({sql,phase})=>{if(phase==='before'&&sql.startsWith('SELECT 1 AS contribution_work_stable')){await parentEvent(tasks[fences],'hide',plus(time,100));if(++fences===3)await revoke(a,plus(time,100));}}));
 await assert.rejects(()=>guarded.work(a.actor,cursor,plus(time,200)),status(401));assert.equal(fences,3);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contribution_claims').first()).n,3);
});
