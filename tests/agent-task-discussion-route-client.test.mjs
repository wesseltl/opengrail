import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createOpenGrailAgentClient} from '../scripts/opengrail-agent-client.mjs';
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';
import {createOpenGrailTaskDiscussionAdapter} from '../scripts/opengrail-task-discussion-adapter.mjs';
import {publishFirstTaskComment} from '../examples/agent-task-discussion-first-comment.mjs';

// Actual handlers/repositories; fake enrollments and local synthetic D1 only.
const contents=`
import {NetworkRepository} from './app/network-store.ts';
import {createNetworkToken} from './app/network-model.ts';
import {networkAgentRequest} from './app/network-http.ts';
import {ContributionRepository} from './app/contribution-store.ts';
import {contributionPublicRequest} from './app/contribution-http.ts';
import {contributionPublicHumanId} from './app/contribution-model.ts';
import {TaskDiscussionRepository} from './app/task-discussion-store.ts';
import {taskDiscussionAgentRequest,taskDiscussionPublicRequest} from './app/task-discussion-http.ts';
export default{async fetch(request,env){const path=new URL(request.url).pathname,identities=()=>new NetworkRepository(env.DB),discussions=()=>new TaskDiscussionRepository(env.DB);
 if(path==='/_synthetic/setup'){const ownerId=crypto.randomUUID(),agentId=crypto.randomUUID(),generated=await createNetworkToken(),at=new Date(Date.now()-1000).toISOString();await identities().write(ownerId,{action:'register',requestId:crypto.randomUUID(),id:agentId,credentialId:generated.credentialId,name:'Synthetic route/client participant',tokenDigest:generated.tokenDigest,days:7},at);const task=(await new ContributionRepository(env.DB).write({kind:'HUMAN',userId:ownerId,maintainer:true},{action:'register',requestId:crypto.randomUUID(),id:crypto.randomUUID(),title:'Synthetic adapter integration task',summary:'Retain the original command after an unknown acknowledgement.',kind:'TESTS',acceptance:['Actual retained byte correlation.'],rejection:['No invented success or omitted loss.'],policyAccepted:'public-contributions-v1'},at)).task;return Response.json({agentId,credentialId:generated.credentialId,credential:generated.token,sponsorId:await contributionPublicHumanId(ownerId),ownerId,task});}
 if(path==='/_synthetic/control'){const value=await request.json();if(value.kind==='REVOKE_AGENT')return Response.json(await identities().write(value.ownerId,{action:'revoke',requestId:crypto.randomUUID(),id:value.agentId,revision:1},new Date().toISOString()));if(value.kind==='HIDE_TASK'){const repo=new ContributionRepository(env.DB),task=(await repo.get(value.taskId)).item;return Response.json(await repo.write({kind:'HUMAN',userId:value.ownerId,maintainer:true},{action:'hide',requestId:crypto.randomUUID(),task:{id:task.id,digest:task.digest},expectedSequence:task.sequence,reason:'POLICY',policyAccepted:'public-contributions-v1'},new Date().toISOString()));}return new Response(null,{status:400});}
 if(path==='/api/network/agent')return networkAgentRequest(request,identities);
 if(path==='/api/contributions/discussion/agent')return taskDiscussionAgentRequest(request,discussions,identities);
 if(path==='/api/contributions/discussion')return taskDiscussionPublicRequest(request,discussions);
 if(path==='/api/contributions')return contributionPublicRequest(request,()=>new ContributionRepository(env.DB));
 return new Response(null,{status:404});}};
`;
let mf,db;
before(async()=>{const built=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});mf=new Miniflare({modules:true,script:built.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');for(const name of ['0000_confused_zombie.sql','0007_public_contribution_tasks.sql','0009_thankful_human_cannonball.sql'])for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
beforeEach(async()=>{for(const table of ['task_discussion_reports','task_discussion_events','task_discussion_messages','contribution_claim_events','contribution_claims','contribution_task_events','contribution_tasks','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const baseOrigin='https://synthetic-adapter.test',uid=()=>crypto.randomUUID(),count=async table=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
const seed=async()=>await(await mf.dispatchFetch(baseOrigin+'/_synthetic/setup',{method:'POST'})).json();
const control=async value=>await mf.dispatchFetch(baseOrigin+'/_synthetic/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const command=s=>({action:'publish',id:uid(),requestId:uid(),task:{id:s.task.id,digest:s.task.digest},expectedTaskSequence:s.task.sequence,claim:null,replyTo:null,kind:'COUNTEREXAMPLE',body:'Synthetic failure: an acknowledgement with changed bytes must remain uncertain.',policyAccepted:'public-task-discussion-v1'});
function configured(s,transport){const calls=[],adapter=createOpenGrailTaskDiscussionAdapter(safeOptions(s)),boundary=createOpenGrailAgentBoundary({baseOrigin,credential:s.credential,agentId:s.agentId,fetch:async(url,init)=>{calls.push({url,method:init.method,body:init.body,authorized:init.headers.Authorization!==undefined});return transport?transport(url,init):mf.dispatchFetch(url,init);},receiptValidators:{'/api/contributions/discussion/agent':adapter.receiptValidator}});return {boundary,adapter,calls};}
const safeOptions=s=>({agentId:s.agentId,credentialId:s.credentialId,sponsorId:s.sponsorId});
async function approved(f,c){assert.equal((await f.boundary.controller.identify()).disposition,'IDENTIFIED');const prepared=f.boundary.controller.prepareWrite('/api/contributions/discussion/agent',c);f.boundary.controller.approveWrite(prepared.handle,{confirmPublicSharing:true});return prepared;}

test('complete external first-comment example crosses actual HTTPS handlers and synthetic D1 without a work claim',async()=>{
 const s=await seed(),messageId=uid(),requestId=uid(),reviews=[];
 // Explicit labeled local adapter at loopback; rewritten synthetic origin retains actual HTTPS route gates.
 const session=await publishFirstTaskComment({baseOrigin:'http://127.0.0.1',credential:s.credential,...safeOptions(s),taskId:s.task.id,taskDigest:s.task.digest,messageId,requestId,body:'Which retained synthetic case falsifies this criterion?',approveExactPublicCommand:async review=>{reviews.push(review);return true;},testAdapter:{kind:'SYNTHETIC_LOOPBACK_ONLY',fetch:(url,init)=>mf.dispatchFetch(baseOrigin+new URL(url).pathname+new URL(url).search,init)}});
 try{assert.equal(reviews.length,1);assert.equal(reviews[0].path,'/api/contributions/discussion/agent');assert.equal(JSON.parse(reviews[0].body).id,messageId);assert.equal(session.result.disposition,'CONFIRMED');assert.equal(session.result.receipt.message.id,messageId);assert.equal(await count('task_discussion_messages'),1);assert.equal(await count('contribution_claims'),0);assert(!JSON.stringify(session.result).includes(s.credential));const read=await session.boundary.tools.read('/api/contributions/discussion',{query:{id:messageId}}),checked=await session.adapter.checkDiscussion(read.result.data,{signal:new AbortController().signal});assert.equal(checked.item.digest,session.result.receipt.message.digest);}finally{session.boundary.controller.close();}
});

test('no adapter still refuses discussion publication before dispatch',async()=>{
 const s=await seed(),calls=[],client=createOpenGrailAgentClient({baseOrigin,credential:s.credential,agentId:s.agentId,fetch:(url,init)=>{calls.push(init.method);return mf.dispatchFetch(url,init);}});
 try{await client.identify();await assert.rejects(()=>client.submit('/api/contributions/discussion/agent',command(s),{confirmPublicSharing:true}),/FULL_RECEIPT_VALIDATOR_REQUIRED/);assert.deepEqual(calls,['GET']);assert.equal(await count('task_discussion_messages'),0);assert.equal(client.pending(),null);}finally{client.close();}
});

test('committed lost acknowledgement retains one original operation and an explicitly identical retry',async()=>{
 const s=await seed();let lost=true;const f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method==='POST'&&lost){lost=false;assert.equal(response.status,200);throw Error('Synthetic lost response after actual commit.');}return response;}),c=command(s),p=await approved(f,c);
 try{const result=await f.boundary.controller.executeApproved(p.handle);assert.equal(result.disposition,'UNCERTAIN');assert.equal(await count('task_discussion_messages'),1);assert.equal(f.calls.filter(x=>x.method==='POST').length,1);const held=f.boundary.controller.pending();assert.equal(held.body,JSON.stringify(c));const changed=f.boundary.controller.prepareWrite('/api/contributions/discussion/agent',{...c,body:'A changed original operation.'});f.boundary.controller.approveWrite(changed.handle,{confirmPublicSharing:true});await assert.rejects(()=>f.boundary.controller.executeApproved(changed.handle),/ORIGINAL_PENDING_COMMAND_REQUIRED/);assert.equal(f.calls.filter(x=>x.method==='POST').length,1);f.boundary.controller.discardPrepared(changed.handle);const retried=await f.boundary.controller.retryApproved(p.handle);assert.equal(retried.disposition,'CONFIRMED');assert.equal(await count('task_discussion_messages'),1);const posts=f.calls.filter(x=>x.method==='POST');assert.equal(posts[0].body,posts[1].body);assert.equal(f.boundary.controller.pending(),null);}finally{f.boundary.controller.close();}
});

test('tampered actual route receipts remain uncertain after a real stored publication',async()=>{
 for(const mutate of [r=>{r.acknowledgement.actor.sponsorId='human_'+'f'.repeat(64);},r=>{r.message.record.body='Forged receipt content.';},r=>{r.task.digest='f'.repeat(64);},r=>{r.acknowledgement.commandDigest='f'.repeat(64);}]){const s=await seed(),f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method!=='POST')return response;const raw=await response.json();mutate(raw);return Response.json(raw);}),c=command(s),p=await approved(f,c);try{const result=await f.boundary.controller.executeApproved(p.handle);assert.equal(result.disposition,'UNCERTAIN');assert.equal(f.boundary.controller.pending().body,JSON.stringify(c));assert.equal(f.calls.filter(x=>x.method==='POST').length,1);}finally{f.boundary.controller.close();}}
 assert.equal(await count('task_discussion_messages'),4);
});

test('hidden retained acceptance suppresses original text, then own withdrawal remains exact',async()=>{
 const s=await seed();let lost=true;const f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method==='POST'&&lost){lost=false;throw Error('Synthetic lost committed acknowledgement.');}return response;}),c=command(s),p=await approved(f,c);
 try{assert.equal((await f.boundary.controller.executeApproved(p.handle)).disposition,'UNCERTAIN');assert.equal((await control({kind:'HIDE_TASK',ownerId:s.ownerId,taskId:s.task.id})).status,200);const reconciled=await f.boundary.controller.retryApproved(p.handle);assert.equal(reconciled.disposition,'CONFIRMED');assert.equal(reconciled.receipt.message.record,null);assert(!JSON.stringify(reconciled).includes(c.body));const message=reconciled.receipt.message,w={action:'withdraw',requestId:uid(),task:c.task,message:{id:message.id,digest:message.digest},expectedSequence:message.sequence,reason:'AUTHOR_REQUEST',policyAccepted:'public-task-discussion-v1'},withdraw=f.boundary.controller.prepareWrite('/api/contributions/discussion/agent',w);f.boundary.controller.approveWrite(withdraw.handle,{confirmPublicSharing:true});const result=await f.boundary.controller.executeApproved(withdraw.handle);assert.equal(result.disposition,'CONFIRMED');assert.equal(result.receipt.message.state,'WITHDRAWN');assert.equal(result.receipt.message.record,null);assert.equal(await count('task_discussion_messages'),1);assert.equal(await count('task_discussion_events'),1);}finally{f.boundary.controller.close();}
});

test('private report validates original bytes without exposing details or reporter fields',async()=>{
 const s=await seed(),f=configured(s),c=command(s),p=await approved(f,c);
 try{const published=await f.boundary.controller.executeApproved(p.handle),message=published.receipt.message,report={action:'report',requestId:uid(),task:c.task,message:{id:message.id,digest:message.digest},category:'MISLEADING',details:'Private synthetic detail sentinel 344.',policyAccepted:'public-task-discussion-v1'},prepared=f.boundary.controller.prepareWrite('/api/contributions/discussion/agent',report);f.boundary.controller.approveWrite(prepared.handle,{confirmPublicSharing:true});const result=await f.boundary.controller.executeApproved(prepared.handle);assert.equal(result.disposition,'CONFIRMED');assert.equal(result.receipt.message,null);assert(!('details'in result.receipt.report));assert(!('reporter'in result.receipt.report));assert(!JSON.stringify(result.receipt).includes(report.details));assert(!JSON.stringify(result.receipt).includes(s.ownerId));assert.equal(await count('task_discussion_reports'),1);}finally{f.boundary.controller.close();}
});

test('revoked identity cannot gain publication through the adapter or resolve its pending write',async()=>{
 const s=await seed(),f=configured(s),c=command(s),p=await approved(f,c);
 try{assert.equal((await control({kind:'REVOKE_AGENT',ownerId:s.ownerId,agentId:s.agentId})).status,200);const result=await f.boundary.controller.executeApproved(p.handle);assert.equal(result.disposition,'UNCERTAIN');assert.equal(result.status,401);assert.equal(await count('task_discussion_messages'),0);assert.equal(f.boundary.controller.pending().body,JSON.stringify(c));assert.equal((await f.boundary.controller.identify()).disposition,'IDENTITY_UNAVAILABLE');const calls=f.calls.length;await assert.rejects(()=>f.boundary.controller.retryApproved(p.handle),/IDENTITY_CHANGED/);assert.equal(f.calls.length,calls);}finally{f.boundary.controller.close();}
});

test('cancellation after actual commit retains the original pending command and permits only explicit recovery',async()=>{
 const s=await seed(),controller=new AbortController();let cancel=true;const f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method==='POST'&&cancel){cancel=false;controller.abort();}return response;}),c=command(s),p=await approved(f,c);
 try{const result=await f.boundary.controller.executeApproved(p.handle,{signal:controller.signal});assert.equal(result.disposition,'UNCERTAIN');assert.equal(await count('task_discussion_messages'),1);assert.equal(f.boundary.controller.pending().body,JSON.stringify(c));assert.equal(f.calls.filter(x=>x.method==='POST').length,1);const retried=await f.boundary.controller.retryApproved(p.handle);assert.equal(retried.disposition,'CONFIRMED');assert.equal(await count('task_discussion_messages'),1);}finally{f.boundary.controller.close();}
});


test('first-comment example rejects a mismatched configured credential ID before task read, approval or publication',async()=>{
 const s=await seed(),calls=[],reviews=[],candidate='34450000-0000-4000-8000-000000000001',wrongCredentialId=s.credentialId===candidate?'34450000-0000-4000-8000-000000000002':candidate;
 assert.notEqual(wrongCredentialId,s.credentialId);
 await assert.rejects(()=>publishFirstTaskComment({baseOrigin:'http://127.0.0.1',credential:s.credential,...safeOptions(s),credentialId:wrongCredentialId,taskId:s.task.id,taskDigest:s.task.digest,messageId:uid(),requestId:uid(),body:'This synthetic comment must never be approved or published.',approveExactPublicCommand:async review=>{reviews.push(review);return true;},testAdapter:{kind:'SYNTHETIC_LOOPBACK_ONLY',fetch:(url,init)=>{const parsed=new URL(url);calls.push({method:init.method,path:parsed.pathname,originalCredential:init.headers.Authorization==='Bearer '+s.credential});return mf.dispatchFetch(baseOrigin+parsed.pathname+parsed.search,init);}}}),/Agent identity does not match the configured enrollment/);
 assert.deepEqual(calls,[{method:'GET',path:'/api/network/agent',originalCredential:true}]);
 assert.equal(reviews.length,0);assert.equal(await count('task_discussion_messages'),0);assert.equal(await count('contribution_claims'),0);
});
