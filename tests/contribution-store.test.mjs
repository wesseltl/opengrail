import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=id=>id.startsWith('.')?load(resolve(dirname(file),id.endsWith('.ts')?id:id+'.ts')):native(id);new Function('module','exports','require',code)(m,m.exports,req);return m.exports;}
const model=load('app/contribution-model.ts'),{ContributionRepository}=load('app/contribution-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-30_000).toISOString(),plus=(time,milliseconds)=>new Date(Date.parse(time)+milliseconds).toISOString(),human=(maintainer=false)=>({kind:'HUMAN',userId:uid(),maintainer}),policyAccepted=model.contributionPolicy;
const register=(extra={})=>({action:'register',requestId:uid(),id:uid(),title:'Bounded contribution fixture',summary:'Prepare an immutable, locally tested coordination change.',kind:'TESTS',acceptance:['Actual boundary tests pass with synthetic inputs.'],rejection:['Reject untested authority or execution claims.'],policyAccepted,...extra});
const ref=item=>({id:item.id,digest:item.digest});
const claim=(task,extra={})=>({action:'claim',requestId:uid(),id:uid(),task:ref(task),expectedTaskSequence:task.sequence,policyAccepted,...extra});
const taskEvent=(task,action='close',extra={})=>({action,requestId:uid(),task:ref(task),expectedSequence:task.sequence,reason:action==='close'?'MAINTAINER_CLOSED':'POLICY',policyAccepted,...extra});
const release=(task,item,extra={})=>({action:'release',requestId:uid(),task:ref(task),claim:ref(item),expectedSequence:item.sequence,reason:'AUTHOR_RELEASE',policyAccepted,...extra});
const submit=(task,item,extra={})=>({action:'submit',requestId:uid(),task:ref(task),claim:ref(item),expectedSequence:item.sequence,handoffDigest:'a'.repeat(64),policyAccepted,...extra});
const review=(task,item,decision='ACCEPTED',extra={})=>({action:'review',requestId:uid(),task:ref(task),claim:ref(item),expectedSequence:item.sequence,decision,reason:decision==='ACCEPTED'?'ACCEPTANCE_MET':decision==='CHANGES_REQUESTED'?'NEEDS_CHANGES':'FAILED_ACCEPTANCE',policyAccepted,...extra});
const status=code=>error=>error instanceof model.ContributionError&&error.status===code;
let mf,db;
before(async()=>{
 const source=`import {ContributionRepository} from './app/contribution-store.ts';import {NetworkRepository} from './app/network-store.ts';export default{async fetch(request,env){const input=await request.json();try{const repo=new ContributionRepository(env.DB);if(input.read)return Response.json(await repo.get(input.read,input.at));if(input.claimRead)return Response.json(await repo.getClaim(input.claimRead,input.at));const actor=input.token?{kind:'AGENT',principal:await new NetworkRepository(env.DB).authenticate(input.token,input.at)}:{kind:'HUMAN',userId:input.user,maintainer:false};return Response.json(await repo.write(actor,input.command,input.at));}catch(error){return Response.json({error:error.message},{status:error.status??503});}}};`;
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['contribution_claim_events','contribution_claims','contribution_task_events','contribution_tasks','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const repo=()=>new ContributionRepository(db);
async function write(actor,command,time=at()){return repo().write(actor,command,time);}
async function task(time=at(),actor=human(true),command=register()){return {actor,command,item:(await write(actor,command,time)).task};}
async function agent(sponsor,name='Synthetic contribution agent',registeredAt=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name,tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,registeredAt);const principal=await new NetworkRepository(db).authenticate(generated.token,registeredAt);return {actor:{kind:'AGENT',principal},token:generated.token,command};}
async function count(table){return (await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;}
function wrapper(hook){return {prepare(sql){const wrap=(statement,args=[])=>({bind(...values){return wrap(statement.bind(...values),values);},async first(...values){await hook?.({sql,args,operation:'first',phase:'before'});const result=await statement.first(...values);await hook?.({sql,args,operation:'first',phase:'after',result});return result;},async all(){await hook?.({sql,args,operation:'all',phase:'before'});const result=await statement.all();await hook?.({sql,args,operation:'all',phase:'after',result});return result;},async run(){await hook?.({sql,args,operation:'run',phase:'before'});const result=await statement.run();await hook?.({sql,args,operation:'run',phase:'after',result});return result;}});return wrap(db.prepare(sql));}};}
async function revoke(sponsor,a,time=at()){return new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},time);}
async function seedTask(command,author,time){const checked=model.boundedContributionTaskRecord(model.contributionTaskRecordForCommand(command,author,time)),digest=await model.contributionDigest(checked.payload);await db.prepare('INSERT INTO contribution_tasks(id,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(command.id,author.kind+':'+author.id,author.sponsorId,command.requestId,await model.contributionDigest(model.boundedContributionCommand(command).payload),checked.payload,digest,time).run();return {...ref({id:command.id,digest}),record:checked.record,author,createdAt:time,sequence:0};}
async function seedClaim(task,author,time,extra={}){const command=claim(task,extra),checked=model.boundedContributionClaimRecord(model.contributionClaimRecordForCommand(command,author,time)),digest=await model.contributionDigest(checked.payload);await db.prepare('INSERT INTO contribution_claims(id,task_id,task_digest,task_sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(command.id,task.id,task.digest,0,author.kind+':'+author.id,author.sponsorId,command.requestId,await model.contributionDigest(model.boundedContributionCommand(command).payload),checked.payload,digest,time,checked.record.expiresAt).run();return {command,item:{id:command.id,digest,record:checked.record,author,createdAt:time,expiresAt:checked.record.expiresAt,sequence:0}};}
async function seedEvent(command,actor,time){const checked=model.boundedContributionRecord(model.contributionEventRecordForCommand(command,actor,time)),event=checked.record,table='claim'in command?'contribution_claim_events':'contribution_task_events',column='claim'in command?'claim_id':'task_id',id='claim'in command?command.claim.id:command.task.id;await db.prepare(`INSERT INTO ${table}(${column},sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,state,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,event.sequence,actor.kind+':'+actor.id,actor.sponsorId,event.requestId,await model.contributionDigest(model.boundedContributionCommand(command).payload),checked.payload,await model.contributionDigest(checked.payload),event.state,event.reason??'',time).run();return event;}
const syntheticHuman=async n=>{const id='human_'+await model.contributionDigest('synthetic-contribution-sponsor:'+n);return {kind:'HUMAN',id,sponsorId:id};};

test('only an explicitly authorized human maintainer curates immutable public descriptors',async()=>{
 const time=at(),sponsor=human(),a=await agent(sponsor,'No inherited maintainer',time);
 for(const actor of [sponsor,a.actor,{...sponsor,moderator:true,reviewer:true}])await assert.rejects(()=>write(actor,register(),time),status(403));
 const owner=human(true),command=register({summary:'<script>literalFixture()</script> remains unexecuted public prose.'}),receipt=await write(owner,command,time);assert.equal(receipt.task.record.content.summary,command.summary);assert.equal(receipt.task.record.createdAt,time);assert.equal(receipt.task.author.id,await model.contributionPublicHumanId(owner.userId));assert.equal(receipt.executionEnabled,false);assert.deepEqual(Object.keys(receipt.task.author),['kind','id','sponsorId']);assert(!JSON.stringify(receipt).includes(owner.userId));assert.equal(receipt.acknowledgement.digest,receipt.task.digest);
 for(const extra of [{author:receipt.task.author},{maintainer:true},{executionEnabled:true},{source:'private source'},{repository:'owner/private'},{issue:1},{pullRequest:2},{handoff:'private evidence'},{policyAccepted:'other'},{title:'github_pat_'+'x'.repeat(40)},{summary:'og_agent_'+uid()+'.'+'a'.repeat(64)},{acceptance:[]},{title:'x'.repeat(121)}])await assert.rejects(()=>write(owner,register(extra),time),status(400));
 await assert.rejects(()=>write(owner,register({summary:'界'.repeat(2000),acceptance:Array.from({length:8},(_,n)=>n+'界'.repeat(299)),rejection:Array.from({length:8},(_,n)=>n+'界'.repeat(299))}),time),status(413));assert.equal(await count('contribution_tasks'),1);
 await assert.rejects(()=>write({...owner,maintainer:false},command,time),status(403));
});

test('fixed 72-hour leases bind the exact immutable task and claimant with no execution authority',async()=>{
 const time=at(),t=await task(time),owner=human(),command=claim(t.item),receipt=await write(owner,command,time),item=receipt.claim;
 assert.equal(Date.parse(item.expiresAt)-Date.parse(item.createdAt),72*3600000);assert.equal(item.status,'ACTIVE');assert.equal(item.sequence,0);assert.deepEqual(item.task,ref(t.item));assert.equal(item.author.id,await model.contributionPublicHumanId(owner.userId));assert.equal(item.record.executionEnabled,false);assert.equal(receipt.acknowledgement.digest,item.digest);
 await assert.rejects(()=>write(human(),claim(t.item,{task:{id:t.item.id,digest:'0'.repeat(64)}}),time),status(404));await assert.rejects(()=>write(human(),claim(t.item,{expectedTaskSequence:1}),time),status(409));await assert.rejects(()=>write(human(),claim(t.item,{expiresAt:plus(time,86400000)}),time),status(400));
 assert.equal(await count('contribution_claims'),1);assert.deepEqual(await write(owner,command,time),receipt);
});

test('concurrent task claims and identical request retries have one retained winner',async()=>{
 const time=at(),t=await task(time),actors=Array.from({length:6},()=>human()),commands=actors.map(()=>claim(t.item));const attempts=await Promise.allSettled(commands.map((command,n)=>write(actors[n],command,time)));
 assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);assert(attempts.filter(result=>result.status==='rejected').every(result=>result.reason.status===409));assert.equal(await count('contribution_claims'),1);
 const another=await task(time),owner=human(),same=claim(another.item),duplicates=await Promise.all(Array.from({length:5},()=>write(owner,same,time)));assert(duplicates.every(value=>JSON.stringify(value)===JSON.stringify(duplicates[0])));assert.equal(await count('contribution_claims'),2);
});

test('one sponsor has at most two current leases across its human and sibling agents',async()=>{
 const time=at(),sponsor=human(),a=await agent(sponsor,'First sibling',time),b=await agent(sponsor,'Second sibling',time),tasks=await Promise.all(Array.from({length:5},()=>task(time)));
 const operations=tasks.map((t,n)=>({actor:[sponsor,a.actor,b.actor][n%3],command:claim(t.item)})),attempts=await Promise.allSettled(operations.map(({actor,command})=>write(actor,command,time)));
 assert.equal(attempts.filter(result=>result.status==='fulfilled').length,2);assert(attempts.filter(result=>result.status==='rejected').every(result=>[409,429].includes(result.reason.status)));assert.equal(await count('contribution_claims'),2);
 // A concurrent guarded commit may conflict; identical retries after settlement must see the quota.
 for(const [n,result] of attempts.entries())if(result.status==='rejected')await assert.rejects(()=>write(operations[n].actor,operations[n].command,time),status(429));
 assert.equal(await count('contribution_claims'),2);
 const first=attempts.find(result=>result.status==='fulfilled').value,actor=first.claim.author.kind==='HUMAN'?sponsor:first.claim.author.id===a.command.id?a.actor:b.actor;await write(actor,release(first.task,first.claim),time);await write(b.actor,claim(tasks.find(t=>!attempts.some(result=>result.status==='fulfilled'&&result.value.task.id===t.item.id)).item),time);assert.equal(await count('contribution_claims'),3);
});

test('actor-scoped request namespace spans all actions while independent actors may use the same UUID',async()=>{
 const time=at(),maintainer=human(true),requestId=uid(),t=await task(time,maintainer,register({requestId})),claimant=human(),c=await write(claimant,claim(t.item,{requestId}),time);
 await assert.rejects(()=>write(maintainer,taskEvent(t.item,'close',{requestId}),time),status(409));await assert.rejects(()=>write(claimant,submit(t.item,c.claim,{requestId}),time),status(409));
 const submitCommand=submit(t.item,c.claim),s=await write(claimant,submitCommand,time),closeCommand=taskEvent(t.item,'close',{requestId:submitCommand.requestId});const closed=await write(maintainer,closeCommand,time);assert.equal(closed.task.state,'CLOSED');
 const another=await task(time,maintainer);await assert.rejects(()=>write(claimant,claim(another.item,{requestId:submitCommand.requestId}),time),status(409));assert.equal((await write(claimant,submitCommand,time)).claim.status,'SUBMITTED');assert.equal(s.acknowledgement.requestId,closed.acknowledgement.requestId);
});

test('only the current claimant submits a digest; maintainer dispositions remain narrow and terminal',async()=>{
 for(const decision of ['ACCEPTED','CHANGES_REQUESTED','REJECTED']){
  const time=at(),t=await task(time),owner=human(),c=await write(owner,claim(t.item),time);await assert.rejects(()=>write(human(),submit(t.item,c.claim),time),status(403));await assert.rejects(()=>write(t.actor,review(t.item,c.claim),time),status(409));
  const command=submit(t.item,c.claim),s=await write(owner,command,time);assert.equal(s.claim.status,'SUBMITTED');assert.equal(s.claim.handoffDigest,command.handoffDigest);assert.equal(s.claim.expiresAt,c.claim.expiresAt);await assert.rejects(()=>write(owner,submit(t.item,s.claim),time),status(403));await assert.rejects(()=>write(human(),review(t.item,s.claim,decision),time),status(403));
  const disposition=review(t.item,s.claim,decision),result=await write(t.actor,disposition,time);assert.equal(result.claim.status,decision);assert.equal(result.claim.expiresAt,c.claim.expiresAt);assert.equal(result.executionEnabled,false);assert(!('completed'in result.claim));await assert.rejects(()=>write(owner,release(t.item,result.claim),time),status(409));await assert.rejects(()=>write(t.actor,review(t.item,result.claim,'REJECTED'),time),status(409));
  const later=await repo().getClaim(c.claim.id,plus(c.claim.expiresAt,1));assert.equal(later.item.status,decision);await write(human(),claim(t.item),time);assert.equal((await repo().claims(t.item.id,t.item.digest,null,time)).items.length,2);
 }
});

test('only the original claimant or its sponsoring human releases a current lease',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Sponsor can release this claim',time),b=await agent(sponsor,'Sibling cannot release',time),c=await write(a.actor,claim(t.item),time);
 for(const [actor,reason] of [[sponsor,'AUTHOR_RELEASE'],[b.actor,'AUTHOR_RELEASE'],[b.actor,'SPONSOR_RELEASE'],[human(),'SPONSOR_RELEASE']])await assert.rejects(()=>write(actor,release(t.item,c.claim,{reason}),time),status(403));
 await revoke(sponsor,a,time);const command=release(t.item,c.claim,{reason:'SPONSOR_RELEASE'}),released=await write(sponsor,command,time);assert.equal(released.claim.status,'RELEASED');assert.deepEqual(released.claim.author,c.claim.author);assert.equal(released.claim.events[0].actor.kind,'HUMAN');assert.deepEqual(await write(sponsor,command,time),released);await assert.rejects(async()=>write(a.actor,claim((await task(time)).item),time),status(401));
 const t2=await task(time),self=await write(sponsor,claim(t2.item),time);await assert.rejects(()=>write(sponsor,release(t2.item,self.claim,{reason:'SPONSOR_RELEASE'}),time),status(403));await write(sponsor,release(t2.item,self.claim),time);
});

test('expiry is a read projection with no appended event, renewal or post-expiry mutation',async()=>{
 const time=at(),t=await task(plus(time,-4*86400000)),owner=human(),c=await write(owner,claim(t.item),plus(time,-4*86400000));assert.equal(c.claim.status,'ACTIVE');assert.equal(c.claim.sequence,0);assert.equal(await count('contribution_claim_events'),0);
 for(const command of [release(t.item,c.claim),submit(t.item,c.claim)])await assert.rejects(()=>write(owner,command,time),status(409));const projection=await repo().getClaim(c.claim.id,time);assert.equal(projection.item.status,'EXPIRED');assert.equal(projection.item.expiresAt,c.claim.expiresAt);assert.equal(await count('contribution_claim_events'),0);const replacement=await write(owner,claim(t.item),time);assert.notEqual(replacement.claim.id,c.claim.id);assert.equal((await repo().claims(t.item.id,t.item.digest,null,time)).items.length,2);
});

test('task closure and hiding enforce exact CAS, remain terminal, and permit attributable unexpired release',async()=>{
 const time=at(),t=await task(time),owner=human(),c=await write(owner,claim(t.item),time),closeCommand=taskEvent(t.item),closed=await write(t.actor,closeCommand,plus(time,100));assert.equal(closed.task.state,'CLOSED');
 await assert.rejects(()=>write(human(),claim(closed.task),plus(time,200)),status(409));await assert.rejects(()=>write(owner,submit(closed.task,c.claim),plus(time,200)),status(409));await assert.rejects(()=>write(t.actor,taskEvent(t.item,'hide'),plus(time,200)),status(409));await assert.rejects(()=>write(t.actor,taskEvent(closed.task),plus(time,200)),status(409));
 const hidden=await write(t.actor,taskEvent(closed.task,'hide'),plus(time,200));assert.equal(hidden.task.state,'HIDDEN');assert.equal(hidden.task.record,null);assert.equal(hidden.task.sequence,2);const released=await write(owner,release(hidden.task,c.claim),plus(time,300));assert.equal(released.claim.status,'RELEASED');assert.equal(released.claim.record,null);assert.equal(released.claim.reason,null);assert.deepEqual(released.claim.events,[]);assert.equal(released.claim.sequence,1);assert.equal(released.acknowledgement.sequence,1);assert.equal(released.acknowledgement.digest,(await db.prepare('SELECT digest FROM contribution_claim_events').first()).digest);
 await assert.rejects(()=>write(t.actor,taskEvent(hidden.task,'hide'),plus(time,400)),status(409));assert.equal(await count('contribution_task_events'),2);assert.equal((await write(t.actor,closeCommand,plus(time,400))).task.state,'HIDDEN');
});

test('hidden parent suppression applies to all receipts, claim history, digests and earlier retries',async()=>{
 const time=at(),t=await task(time,human(true),register({title:'Sensitive descriptor sentinel',summary:'Removed fixture prose'})),owner=human(),claimCommand=claim(t.item),c=await write(owner,claimCommand,time),submitCommand=submit(t.item,c.claim),s=await write(owner,submitCommand,time),reviewCommand=review(t.item,s.claim),r=await write(t.actor,reviewCommand,time);await write(t.actor,taskEvent(t.item,'hide'),plus(time,100));
 const receipts=[await repo().get(t.item.id),await repo().list(),await repo().claims(t.item.id,t.item.digest,null,plus(time,200)),await repo().getClaim(c.claim.id,plus(time,200)),await write(t.actor,t.command,plus(time,200)),await write(owner,claimCommand,plus(time,200)),await write(owner,submitCommand,plus(time,200)),await write(t.actor,reviewCommand,plus(time,200))];
 for(const receipt of receipts){const text=JSON.stringify(receipt);assert(!text.includes('Sensitive descriptor sentinel'));assert(!text.includes('Removed fixture prose'));assert(!text.includes(submitCommand.handoffDigest));}
 const replay=await write(owner,submitCommand,plus(time,200));assert.equal(replay.claim.sequence,2);assert.deepEqual(replay.claim.events,[]);assert.equal(replay.acknowledgement.sequence,1);assert.deepEqual(replay.acknowledgement,s.acknowledgement);assert.deepEqual((await write(t.actor,reviewCommand,plus(time,200))).acknowledgement,r.acknowledgement);assert.equal(await count('contribution_claim_events'),2);
});

test('lost acknowledgments reconcile accepted original rows under current suppression without duplicate records',async()=>{
 const time=at(),t=await task(time),owner=human();let lose=true;const r=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='after'&&lose){lose=false;await write(t.actor,taskEvent(t.item,'hide'),plus(time,100));throw Error('synthetic lost acknowledgement');}})),command=claim(t.item),receipt=await r.write(owner,command,time);
 assert.equal(receipt.task.state,'HIDDEN');assert.equal(receipt.claim.record,null);assert.equal(receipt.acknowledgement.action,'claim');assert.equal(await count('contribution_claims'),1);assert.deepEqual((await write(owner,command,time)).acknowledgement,receipt.acknowledgement);
 const open=await task(time),next=claim(open.item);let before=true;const failed=new ContributionRepository(wrapper(({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='before'&&before){before=false;throw Error('synthetic precommit failure');}}));await assert.rejects(()=>failed.write(owner,next,time),/precommit failure/);assert.equal(await count('contribution_claims'),1);await write(owner,next,time);assert.equal(await count('contribution_claims'),2);
});

test('CAS protects immutable task/claim payloads and event heads at the actual INSERT boundary',async()=>{
 const time=at(),t=await task(time),owner=human();let changed=false;const closed=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='before'&&!changed){changed=true;await write(t.actor,taskEvent(t.item),time);}}));await assert.rejects(()=>closed.write(owner,claim(t.item),time),status(409));assert.equal(await count('contribution_claims'),0);
 const open=await task(time),c=await write(owner,claim(open.item),time);let released=false;const raced=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claim_events')&&phase==='before'&&!released){released=true;await write(owner,release(open.item,c.claim),time);}}));await assert.rejects(()=>raced.write(owner,submit(open.item,c.claim),time),status(409));assert.equal((await repo().getClaim(c.claim.id,time)).item.status,'RELEASED');assert.equal(await count('contribution_claim_events'),1);
});

test('task hiding during a dependent read and receipt fence suppresses the final public payload',async()=>{
 const time=at(),t=await task(time),owner=human(),c=await write(owner,claim(t.item),time);let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT claim_id,')&&phase==='after'&&!reached){reached=true;await write(t.actor,taskEvent(t.item,'hide'),time);}}));
 const read=await racing.getClaim(c.claim.id,time);assert.equal(reached,true);assert.equal(read.task.state,'HIDDEN');assert.equal(read.item.taskState,'HIDDEN');assert.equal(read.item.record,null);
});

test('current stored agent registry fences a claim before commit and prevents replay after revocation',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Revocation race agent',time);let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='before'&&!reached){reached=true;await revoke(sponsor,a,time);}}));await assert.rejects(()=>racing.write(a.actor,claim(t.item),time),status(401));assert.equal(reached,true);assert.equal(await count('contribution_claims'),0);
 const b=await agent(sponsor,'Receipt revocation agent',time),command=claim(t.item),accepted=await write(b.actor,command,time);await revoke(sponsor,b,time);await assert.rejects(()=>write(b.actor,command,time),status(401));assert.equal((await repo().getClaim(accepted.claim.id,time)).item.author.id,b.command.id);
});

test('agent revocation after an actual commit withholds the acknowledgment but retains the accepted attempt',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Postcommit fenced agent',time),command=claim(t.item);let reached=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='after'&&!reached){reached=true;await revoke(sponsor,a,time);}}));await assert.rejects(()=>racing.write(a.actor,command,time),status(401));assert.equal(await count('contribution_claims'),1);await assert.rejects(()=>write(a.actor,command,time),status(401));const retained=await repo().getClaim(command.id,time);assert.equal(retained.item.status,'ACTIVE');await write(sponsor,release(retained.task,retained.item,{reason:'SPONSOR_RELEASE'}),time);
});

test('registry payload, digest, token hash and declared principal substitutions never authenticate writes',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Immutable principal',time);
 for(const override of [{name:'Changed name'},{ownerId:human().userId},{registryDigest:'f'.repeat(64)},{tokenDigest:'e'.repeat(64)},{credentialId:uid()},{expiresAt:plus(a.actor.principal.expiresAt,1000)},{payload:a.actor.principal.payload+' '}])await assert.rejects(()=>write({kind:'AGENT',principal:{...a.actor.principal,...override}},claim(t.item),time),status(401));assert.equal(await count('contribution_claims'),0);
});

test('SQLite commit time fences a credential which expires after earlier authentication',async()=>{
 const registrationTime=new Date(Date.now()-86400000+1400).toISOString(),sponsor=human(),a=await agent(sponsor,'Expiry at admission',registrationTime,1),t=await task(at()),requestTime=new Date().toISOString();let reached=false;const delayed=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='before'){reached=true;const delay=Date.parse(a.actor.principal.expiresAt)-Date.now()+80;if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));}}));await assert.rejects(()=>delayed.write(a.actor,claim(t.item),requestTime),status(401));assert.equal(reached,true);assert.equal(await count('contribution_claims'),0);
});

test('canonical retained rows and command metadata are checked before projection or suppression',async()=>{
 const time=at(),t=await task(time),owner=human(),c=await write(owner,claim(t.item),time),s=await write(owner,submit(t.item,c.claim),time);
 for(const [table,idColumn,id,read,changes] of [
  ['contribution_tasks','id',t.item.id,()=>repo().get(t.item.id,time),[['payload','{}'],['payload',' '+JSON.stringify(t.item.record)],['payload','x'.repeat(12289)],['digest','0'.repeat(64)],['command_digest','0'.repeat(64)],['author_key','HUMAN:human_'+'f'.repeat(64)],['created_at',plus(time,1)]]],
  ['contribution_claims','id',c.claim.id,()=>repo().getClaim(c.claim.id,time),[['payload','{}'],['digest','0'.repeat(64)],['command_digest','0'.repeat(64)],['task_digest','0'.repeat(64)],['task_sequence',1],['expires_at',plus(c.claim.expiresAt,1)]]],
  ['contribution_claim_events','claim_id',c.claim.id,()=>repo().getClaim(c.claim.id,time),[['payload','{}'],['digest','0'.repeat(64)],['command_digest','0'.repeat(64)],['reason','AUTHOR_RELEASE'],['state','RELEASED'],['sequence',2]]]
 ]){
  const original=await db.prepare(`SELECT * FROM ${table} WHERE ${idColumn}=?`).bind(id).first();for(const [column,value] of changes){await db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${idColumn}=?`).bind(value,id).run();await assert.rejects(read,status(503));assert.equal((await db.prepare(`SELECT ${column} AS value FROM ${table} WHERE ${idColumn}=?`).bind(id).first()).value,value);await db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${idColumn}=?`).bind(original[column],id).run();}
 }
 assert.equal((await repo().getClaim(c.claim.id,time)).item.status,s.claim.status);await write(t.actor,taskEvent(t.item,'hide'),time);await db.prepare('UPDATE contribution_claim_events SET command_digest=?').bind('f'.repeat(64)).run();await assert.rejects(()=>repo().claims(t.item.id,t.item.digest,null,time),status(503));await assert.rejects(()=>write(owner,model.contributionClaimCommandForRecord(c.claim.record),time),status(503));
});

test('self-consistent event bytes cannot place submission or disposition after task closure',async()=>{
 for(const action of ['submit','review']){
  const time=at(),t=await task(time),owner=human(),c=await write(owner,claim(t.item),time),submitted=action==='review'?await write(owner,submit(t.item,c.claim),plus(time,100)):c;await write(t.actor,taskEvent(t.item),plus(time,200));const actor=action==='submit'?c.claim.author:t.item.author,command=action==='submit'?submit(t.item,c.claim):review(t.item,submitted.claim);await seedEvent(command,actor,plus(time,300));await assert.rejects(()=>repo().getClaim(c.claim.id,plus(time,400)),status(503));await write(t.actor,taskEvent((await repo().get(t.item.id)).item,'hide'),plus(time,500));await assert.rejects(()=>repo().claims(t.item.id,t.item.digest,null,plus(time,600)),status(503));
 }
});

test('foreign task references and claim cursors never mix histories',async()=>{
 const time=at(),t=await task(time),other=await task(time),owner=human(),c=await write(owner,claim(t.item),time),foreign=await write(human(),claim(other.item),time);
 await assert.rejects(()=>write(owner,submit(other.item,c.claim),time),status(404));await assert.rejects(()=>repo().claims(t.item.id,'0'.repeat(64),null,time),status(404));await assert.rejects(()=>repo().claims(t.item.id,t.item.digest,foreign.claim.id,time),status(404));await assert.rejects(()=>repo().claims(t.item.id,t.item.digest,'broken',time),status(400));await assert.rejects(()=>repo().getClaim(uid(),time),status(404));
});

test('bounded pages retain every attempt, validate offpage rows and preserve newest-first cursor order',async()=>{
 const time=at(),t=await task(plus(time,-100*86400000)),inserts=[];
 for(let n=0;n<32;n++){const old=plus(time,-(33-n)*3*86400000),author=await syntheticHuman(n),c=await seedClaim(t.item,author,old);inserts.push(c.item);}
 const first=await repo().claims(t.item.id,t.item.digest,null,time),second=await repo().claims(t.item.id,t.item.digest,first.nextCursor,time);assert.equal(first.items.length,20);assert.equal(second.items.length,12);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,32);assert(first.items.every(item=>item.status==='EXPIRED'||item.status==='ACTIVE'));assert.equal(first.items[0].id,inserts.at(-1).id);
 await assert.rejects(()=>write(human(),claim(t.item),time),status(429));const oldest=inserts[0];await db.prepare('UPDATE contribution_claims SET command_digest=? WHERE id=?').bind('0'.repeat(64),oldest.id).run();await assert.rejects(()=>repo().claims(t.item.id,t.item.digest,null,time),status(503));assert.equal(await count('contribution_claims'),32);
});

test('task pages validate lookahead rows and immutable current event snapshots',async()=>{
 const time=at(),items=[];for(let n=0;n<21;n++)items.push(await seedTask(register(),await syntheticHuman(n),plus(time,-n*1000)));const first=await repo().list(null,time);assert.equal(first.items.length,20);assert.equal(first.nextCursor,first.items.at(-1).id);const second=await repo().list(first.nextCursor,time);assert.equal(second.items.length,1);assert.equal(second.items[0].id,items.at(-1).id);
 await db.prepare('UPDATE contribution_tasks SET command_digest=? WHERE id=?').bind('f'.repeat(64),items.at(-1).id).run();await assert.rejects(()=>repo().list(null,time),status(503));await assert.rejects(()=>repo().list(uid(),time),status(404));
});

test('shared sponsor daily claims quota retains released attempts and atomically admits the final slot',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Daily quota sibling',time),actors=[sponsor,a.actor],commands=[];
 for(let n=0;n<9;n++){const command=claim(t.item),c=await write(actors[n%2],command,time);commands.push(command);await write(actors[n%2],release(t.item,c.claim),time);}
 const t2=await task(time),t3=await task(time),attempts=await Promise.allSettled([write(sponsor,claim(t.item),time),write(a.actor,claim(t2.item),time),write(sponsor,claim(t3.item),time)]);assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);assert(attempts.filter(result=>result.status==='rejected').every(result=>result.reason.status===429&&result.reason.retryAfterSeconds>0));assert.equal(await count('contribution_claims'),10);assert.equal((await write(sponsor,commands[0],time)).claim.status,'RELEASED');assert.equal(await count('contribution_claims'),10);await write(human(),claim((await task(time)).item),time);assert.equal(await count('contribution_claims'),11);
});

test('maintainer UTC-day task quota is additive, atomic and exact retries remain free',async()=>{
 const time=at(),maintainer=human(true),commands=[];for(let n=0;n<9;n++){const command=register();commands.push(command);await write(maintainer,command,time);}const attempts=await Promise.allSettled(Array.from({length:4},()=>write(maintainer,register(),time)));assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);assert(attempts.filter(result=>result.status==='rejected').every(result=>result.reason.status===429&&result.reason.retryAfterSeconds>0));assert.equal(await count('contribution_tasks'),10);await write(maintainer,commands[0],time);assert.equal(await count('contribution_tasks'),10);await write(human(true),register(),time);assert.equal(await count('contribution_tasks'),11);
});

test('global retained task capacity admits one final slot and never resets hidden work',async()=>{
 const time=at(),t=await task(time),rows=[];for(let n=0;n<498;n++){const author=await syntheticHuman(n),command=register(),checked=model.boundedContributionTaskRecord(model.contributionTaskRecordForCommand(command,author,time));rows.push(db.prepare('INSERT INTO contribution_tasks(id,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(command.id,'HUMAN:'+author.id,author.id,command.requestId,await model.contributionDigest(model.boundedContributionCommand(command).payload),checked.payload,await model.contributionDigest(checked.payload),time));}for(let n=0;n<rows.length;n+=50)await db.batch(rows.slice(n,n+50));assert.equal(await count('contribution_tasks'),499);
 const attempts=await Promise.allSettled([write(human(true),register(),time),write(human(true),register(),time)]);assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);const failed=attempts.find(result=>result.status==='rejected').reason;assert.equal(failed.status,429);assert.equal(failed.retryAfterSeconds,undefined);await write(t.actor,taskEvent(t.item,'hide'),time);assert.equal(await count('contribution_tasks'),500);assert.equal((await write(t.actor,t.command,time)).task.record,null);await assert.rejects(()=>write(human(true),register(),time),status(429));
});

test('global retained claim capacity arbitrates the final slot without deleting adverse history',async()=>{
 const time=at(),t=await task(time),initial=await write(human(),claim(t.item),time),old=plus(time,-4*86400000),rows=[],parents=[];await write(t.actor,taskEvent(t.item),time);
 for(let n=0;n<63;n++)parents.push(await seedTask(register(),await syntheticHuman('task-'+n),plus(old,-32*72*3600000)));
 for(let n=0;n<1998;n++){const author=await syntheticHuman(n),parent=parents[Math.floor(n/32)],created=plus(old,-(31-n%32)*72*3600000),command=claim(parent),checked=model.boundedContributionClaimRecord(model.contributionClaimRecordForCommand(command,author,created));rows.push(db.prepare('INSERT INTO contribution_claims(id,task_id,task_digest,task_sequence,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(command.id,parent.id,parent.digest,0,'HUMAN:'+author.id,author.id,command.requestId,await model.contributionDigest(model.boundedContributionCommand(command).payload),checked.payload,await model.contributionDigest(checked.payload),created,checked.record.expiresAt));}for(let n=0;n<rows.length;n+=50)await db.batch(rows.slice(n,n+50));const one=await task(time),two=await task(time),attempts=await Promise.allSettled([write(human(),claim(one.item),time),write(human(),claim(two.item),time)]);assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);const failed=attempts.find(result=>result.status==='rejected').reason;assert.equal(failed.status,429);assert.equal(failed.retryAfterSeconds,undefined);assert.equal(await count('contribution_claims'),2000);assert.equal((await repo().getClaim(initial.claim.id,time)).item.status,'ACTIVE');assert.equal((await repo().claims(parents[0].id,parents[0].digest,null,time)).items.length,20);
});

test('closed and hidden parent attempts free sponsor capacity without fabricated releases',async()=>{
 const time=at(),sponsor=human(),tasks=await Promise.all(Array.from({length:4},()=>task(time))),one=await write(sponsor,claim(tasks[0].item),time),two=await write(sponsor,claim(tasks[1].item),time);await write(tasks[0].actor,taskEvent(tasks[0].item),time);await write(tasks[1].actor,taskEvent(tasks[1].item,'hide'),time);await write(sponsor,claim(tasks[2].item),time);await write(sponsor,claim(tasks[3].item),time);assert.equal((await repo().getClaim(one.claim.id,time)).item.status,'ACTIVE');assert.equal((await repo().getClaim(two.claim.id,time)).item.status,'ACTIVE');assert.equal(await count('contribution_claim_events'),0);assert.equal(await count('contribution_claims'),4);
});

test('worst retained sponsor histories use bounded SQL queries and fewer than 100 bind parameters',async context=>{
 const time=at(),sponsor=human(),author=await model.contributionPublicHumanId(sponsor.userId),publicActor={kind:'HUMAN',id:author,sponsorId:author},start=plus(time,-72*3600000+60_000),tasks=[];
 for(let n=0;n<39;n++){const day=Math.floor(n/10),created=day===3?plus(time,-20_000+(n%10)*1000):plus(start,day*86400000+(n%10)*1000),t=await seedTask(register(),await syntheticHuman(n),plus(start,-1000)),c=await seedClaim(t,publicActor,created);await seedEvent(release(t,c.item),publicActor,plus(created,100));tasks.push(t);}
 const target=await task(time);let queries=0,maxParameters=0;const bounded=new ContributionRepository(wrapper(({args,phase})=>{if(phase==='before'){queries++;maxParameters=Math.max(maxParameters,args.length);}}));const receipt=await bounded.write(sponsor,claim(target.item),time);assert.equal(receipt.claim.status,'ACTIVE');assert(queries<=50,`actual query budget: ${queries}`);assert(maxParameters<=100,`actual bound parameters: ${maxParameters}`);assert.equal(await count('contribution_claims'),40);context.diagnostic(`Claim admission with 39 retained sponsor histories: ${queries} queries; ${maxParameters} maximum bound parameters.`);
});

test('actual local Worker authenticates an external agent and never grants curation or private source access',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Worker fixture contributor',time),command=claim(t.item),response=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({token:a.token,command,at:time})});assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.claim.author.id,a.command.id);assert.equal(receipt.executionEnabled,false);assert(!JSON.stringify(receipt).includes(a.token));
 const forbidden=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({token:a.token,command:register(),at:time})});assert.equal(forbidden.status,403);const read=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({claimRead:command.id,at:time})});assert.equal(read.status,200);assert.equal((await read.json()).item.id,command.id);await revoke(sponsor,a,time);const denied=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({token:a.token,command,at:time})});assert.equal(denied.status,401);
});

test('registry revocation fences submit at commit and the final receipt read after canonical validation',async()=>{
 const time=at(),t=await task(time),sponsor=human(),a=await agent(sponsor,'Mutation fence contributor',time),claimCommand=claim(t.item),c=await write(a.actor,claimCommand,time);let revoked=false;const mutation=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claim_events')&&phase==='before'&&!revoked){revoked=true;await revoke(sponsor,a,time);}}));await assert.rejects(()=>mutation.write(a.actor,submit(t.item,c.claim),time),status(401));assert.equal(await count('contribution_claim_events'),0);
 const b=await agent(sponsor,'Last receipt fence contributor',time),t2=await task(time),command=claim(t2.item);let checks=0,finalRevoked=false;const receipt=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('SELECT 1 AS active')&&phase==='before'&&++checks===4){finalRevoked=true;await revoke(sponsor,b,time);}}));await assert.rejects(()=>receipt.write(b.actor,command,time),status(401));assert.equal(finalRevoked,true);assert.equal(await count('contribution_claims'),2);assert.equal((await repo().getClaim(command.id,time)).item.status,'ACTIVE');
});

test('the actual SQLite clock rejects a lease which expires while an earlier valid release is waiting',async()=>{
 const requestTime=new Date().toISOString(),time=plus(requestTime,-72*3600000+1400),owner=human(),authorId=await model.contributionPublicHumanId(owner.userId),author={kind:'HUMAN',id:authorId,sponsorId:authorId},t=await seedTask(register(),await syntheticHuman('expiring-parent'),plus(time,-1000)),c=await seedClaim(t,author,time);let delayed=false;const r=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claim_events')&&phase==='before'){delayed=true;const delay=Date.parse(c.item.expiresAt)-Date.now()+80;if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));}}));await assert.rejects(()=>r.write(owner,release(t,c.item),requestTime),status(409));assert.equal(delayed,true);assert.equal(await count('contribution_claim_events'),0);assert.equal((await repo().getClaim(c.item.id)).item.status,'EXPIRED');
});

test('canonical parent replacement between preflight and INSERT cannot admit a claim',async()=>{
 const time=at(),t=await task(time),command=claim(t.item);let changed=false;const racing=new ContributionRepository(wrapper(async({sql,phase})=>{if(sql.startsWith('INSERT INTO contribution_claims')&&phase==='before'&&!changed){changed=true;const altered=model.boundedContributionTaskRecord({...t.item.record,content:{...t.item.record.content,summary:'A replaced canonical parent must require a new identity.'}}),replacement=model.contributionTaskCommandForRecord(altered.record);await db.prepare('UPDATE contribution_tasks SET payload=?,digest=?,command_digest=? WHERE id=?').bind(altered.payload,await model.contributionDigest(altered.payload),await model.contributionDigest(model.boundedContributionCommand(replacement).payload),t.item.id).run();}}));await assert.rejects(()=>racing.write(human(),command,time),status(409));assert.equal(changed,true);assert.equal(await count('contribution_claims'),0);assert.notEqual((await repo().get(t.item.id,time)).item.digest,t.item.digest);
});

test('the contribution migration preserves every earlier generated artifact and introduces only its four coordination tables',()=>{
 const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')),previous=JSON.parse(readFileSync('drizzle/meta/0006_snapshot.json','utf8')),current=JSON.parse(readFileSync('drizzle/meta/0007_snapshot.json','utf8'));
 assert.equal(journal.entries[7].idx,7);assert.equal(journal.entries[7].tag,'0007_public_contribution_tasks');assert.equal(current.prevId,previous.id);for(const [name,table] of Object.entries(previous.tables))assert.deepEqual(current.tables[name],table);const added=Object.keys(current.tables).filter(name=>!Object.hasOwn(previous.tables,name)).sort();assert.deepEqual(added,['contribution_claim_events','contribution_claims','contribution_task_events','contribution_tasks']);const sql=readFileSync('drizzle/0007_public_contribution_tasks.sql','utf8');assert(!/DROP|ALTER|network_agents/i.test(sql));assert.equal((sql.match(/CREATE TABLE/g)||[]).length,4);
});
