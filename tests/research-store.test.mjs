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
const model=load('app/research-model.ts'),{ResearchRepository}=load('app/research-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-10_000).toISOString(),policyAccepted='public-research-v1',human=(moderator=false)=>({kind:'HUMAN',userId:uid(),moderator});
const publication=(extra={})=>({action:'publish',requestId:uid(),id:uid(),kind:'HYPOTHESIS',title:'A falsifiable research hypothesis',statement:'A dated test may show whether a specific mechanism survives realistic assumptions.',assumptions:'Input provenance and costs must be representative.',falsification:'Reject if unseen samples fail the declared test after costs.',sources:[{url:'https://example.test/primary',classification:'PRIMARY',note:'Declared primary reference; not independently fetched.'}],relation:null,policyAccepted,...extra});
const ref=item=>({id:item.id,digest:item.digest}),relation=(item,type)=>({...ref(item),type});
const withdraw=(item,reason='AUTHOR_REQUEST')=>({action:'withdraw',requestId:uid(),...ref(item),reason,policyAccepted});
const moderate=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted});
const report=item=>({action:'report',requestId:uid(),...ref(item),reason:'MISLEADING',details:'Private report evidence that must never enter public output.',policyAccepted});
const status=code=>error=>error instanceof model.ResearchError&&error.status===code;
let mf,db;
before(async()=>{
 const source=`import {ResearchRepository} from './app/research-store.ts';import {NetworkRepository} from './app/network-store.ts';export default{async fetch(request,env){const input=await request.json();try{const repo=new ResearchRepository(env.DB);if(input.read)return Response.json(await repo.get(input.read));const actor=input.token?{kind:'AGENT',principal:await new NetworkRepository(env.DB).authenticate(input.token,input.at)}:{kind:'HUMAN',userId:input.user,moderator:false};return Response.json(await repo.write(actor,input.command,input.at));}catch(error){return Response.json({error:error.message},{status:error.status??503});}}};`;
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['research_reports','research_moderation','research_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const repo=()=>new ResearchRepository(db);
async function agent(sponsor,name='Sponsored researcher',registeredAt=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name,tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,registeredAt);const principal=await new NetworkRepository(db).authenticate(generated.token,registeredAt);return {actor:{kind:'AGENT',principal},token:generated.token,command};}
async function count(table){return (await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;}
function wrapper(beforeRun,afterRun){return {prepare(sql){const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const result=await statement.run();await afterRun?.(sql);return result;}});return wrap(db.prepare(sql));}};}
async function write(actor,command=publication(),time=at()){return repo().write(actor,command,time);}

test('strict inputs reject forged authority, unsafe URLs, credentials, missing falsification and excess bounds',async()=>{
 const actor=human(),command=publication();model.researchPublishSchema.parse(command);
 for(const extra of [{author:{kind:'HUMAN',id:uid()}},{sponsorId:uid()},{verified:true},{verification:'VERIFIED'},{executionEnabled:true},{reputation:100},{policyAccepted:'other'},{statement:'og_agent_'+uid()+'.'+'a'.repeat(64)},{statement:'%6f%67_agent_hidden'},{title:'a'.repeat(121)},{falsification:''},{assumptions:''}])await assert.rejects(()=>write(actor,{...command,...extra}),status(400));
 for(const url of ['http://example.test','https://name:secret@example.test','javascript:alert(1)','https://example.test/og_agent_hidden'])await assert.rejects(()=>write(actor,{...command,sources:[{...command.sources[0],url}]}),status(400));
 const safe=await write(actor,publication({statement:'<script>doNotRun()</script> is recorded as literal research text.'}));assert.equal(safe.item.record.content.statement,'<script>doNotRun()</script> is recorded as literal research text.');assert.equal(await count('research_publications'),1);
 const author=safe.item.author;assert.equal(model.researchAuthorReferenceSchema.safeParse({...author,sponsorId:'human_'+'f'.repeat(64)}).success,false);
 const oversized=publication({statement:'界'.repeat(4000),assumptions:'界'.repeat(1500),falsification:'界'.repeat(2000)});await assert.rejects(()=>write(actor,oversized),status(413));assert.equal(await count('research_publications'),1);
});

test('a human and two sponsored agents publish distinct stable authors sharing one pseudonymous sponsor',async()=>{
 const sponsor=human(),firstAgent=await agent(sponsor,'First research agent'),secondAgent=await agent(sponsor,'og_agent_researcher'),items=[];
 for(const actor of [sponsor,firstAgent.actor,secondAgent.actor])items.push((await write(actor)).item);
 const publicSponsor=await model.researchPublicHumanId(sponsor.userId);assert.equal(publicSponsor,'human_'+await model.researchDigest('OpenGrail-public-sponsor-v1:'+sponsor.userId));assert.equal(new Set(items.map(item=>item.author.id)).size,3);assert(items.every(item=>item.author.sponsorId===publicSponsor));
 assert.equal(items[0].record.author.kind,'HUMAN');assert.equal(items[1].record.author.name,'First research agent');assert.equal(items[2].record.author.name,'og_agent_researcher');assert(!('name' in items[1].author));
 for(const item of items){assert.equal(item.rootId,item.id);assert.equal(item.revision,1);assert.equal(item.record.verification,'UNVERIFIED');assert.equal(item.record.executionEnabled,false);assert.equal(item.digest,await model.researchDigest(JSON.stringify(item.record)));const row=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(item.id).first();assert.equal(row.payload,JSON.stringify(item.record));}
 const listed=await repo().list();const serialized=JSON.stringify(listed);for(const value of [sponsor.userId,firstAgent.token,secondAgent.token,firstAgent.actor.principal.tokenDigest,'ownerId','credentialId','tokenDigest'])assert(!serialized.includes(value));assert.equal(listed.items.length,3);
});

test('idempotency is author scoped, exactly retryable and never reveals another principal’s private receipt',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),command=publication(),first=await write(sponsor,command);
 assert.deepEqual(await write(sponsor,command),first);await assert.rejects(()=>write(sponsor,{...command,title:'Changed'}),status(409));
 for(const actor of [human(),a.actor,b.actor])await assert.rejects(()=>write(actor,command),status(409));assert.equal(await count('research_publications'),1);
 const shared=uid(),siblings=await Promise.all([a.actor,b.actor].map(actor=>write(actor,publication({requestId:shared}))));assert.notEqual(siblings[0].item.author.id,siblings[1].item.author.id);assert.equal(await count('research_publications'),3);
 const own=publication(),raced=await Promise.all([write(a.actor,own),write(a.actor,own)]);assert.deepEqual(raced[0],raced[1]);assert.equal(await count('research_publications'),4);
 await assert.rejects(()=>write(sponsor,{...withdraw(first.item),requestId:command.requestId}),status(409));
});

test('revisions preserve original author and kind, exact latest ancestry and immutable prior records under races',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),first=(await write(a.actor)).item,revision=()=>publication({relation:relation(first,'REVISION')});
 for(const actor of [sponsor,b.actor,human()])await assert.rejects(()=>write(actor,revision()),status(403));
 await assert.rejects(()=>write(a.actor,publication({kind:'FAILURE',relation:relation(first,'REVISION')})),status(409));
 const commands=[revision(),revision()],results=await Promise.allSettled(commands.map(command=>write(a.actor,command)));assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);
 const second=results.find(result=>result.status==='fulfilled').value.item;assert.equal(second.rootId,first.id);assert.equal(second.revision,2);assert.deepEqual(second.record.content.relation,relation(first,'REVISION'));assert.deepEqual((await repo().get(first.id)).item,first);assert.deepEqual((await repo().history(first.id)).items,[second,first]);await assert.rejects(()=>write(a.actor,revision()),status(409));
});

test('forks and challenges retain exact visible targets without inheriting authorship or verification',async()=>{
 const first=(await write(human())).item,other=human();
 const fork=(await write(other,publication({kind:'FAILURE',relation:relation(first,'FORK')}))).item;assert.equal(fork.rootId,fork.id);assert.equal(fork.revision,1);assert.equal(fork.record.content.kind,'FAILURE');assert.notEqual(fork.author.id,first.author.id);assert.equal(fork.record.verification,'UNVERIFIED');
 const challenge=(await write(other,publication({kind:'CHALLENGE',relation:relation(first,'CHALLENGE')}))).item;assert.equal(challenge.record.content.kind,'CHALLENGE');assert.deepEqual(challenge.record.content.relation,relation(first,'CHALLENGE'));
 const updated=(await write(other,publication({kind:'CHALLENGE',relation:relation(challenge,'REVISION')}))).item;assert.equal(updated.rootId,challenge.id);assert.equal(updated.revision,2);
 await assert.rejects(()=>write(other,publication({kind:'CHALLENGE'})),status(400));await assert.rejects(()=>write(other,publication({relation:relation(first,'CHALLENGE')})),status(400));await assert.rejects(()=>write(other,publication({relation:{...relation(first,'FORK'),digest:'0'.repeat(64)}})),status(404));
});

test('exact research threads retain all three direct relation kinds across stable equal-clock pages',async()=>{
 const time=at(),author=human(),target=(await write(author,publication(),time)).item,children=[];
 children.push((await write(author,publication({relation:relation(target,'REVISION')}),time)).item);
 for(let n=0;n<42;n++)children.push((await write(human(),publication({kind:n%2?'CHALLENGE':'HYPOTHESIS',relation:relation(target,n%2?'CHALLENGE':'FORK')}),time)).item);
 const indirect=(await write(human(),publication({relation:relation(children[0],'FORK')}),time)).item;
 await write(human());
 const hidden=children[7];await write(human(true),moderate(hidden),time);await write({kind:'HUMAN',userId:author.userId,moderator:false},publication({relation:relation(children[0],'REVISION')}),time);
 // Fixture withdrawal retains the original sponsor through a separately created agent publication.
 const sponsor=human(),agentAuthor=await agent(sponsor,'Hidden thread display name',time),agentChild=(await write(agentAuthor.actor,publication({relation:relation(target,'FORK'),title:'Hidden thread body'}),time)).item;
 await write(sponsor,withdraw(agentChild,'SPONSOR_REQUEST'),time);children.push(agentChild);
 const expected=[...children].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)),collected=[],sizes=[];let cursor=null;
 do{const page=await repo().thread(target.id,target.digest,cursor);model.researchThreadSchema.parse(page);assert.equal(page.target.id,target.id);sizes.push(page.items.length);collected.push(...page.items);if(page.nextCursor)assert.equal(page.nextCursor,page.items.at(-1).id);cursor=page.nextCursor;}while(cursor);
 assert.deepEqual(sizes,[20,20,4]);assert.deepEqual(collected.map(item=>item.id),expected.map(item=>item.id));assert.equal(new Set(collected.map(item=>item.id)).size,44);assert(!collected.some(item=>item.id===indirect.id));
 assert.equal(collected.find(item=>item.id===hidden.id).record,null);assert.equal(collected.find(item=>item.id===agentChild.id).state,'WITHDRAWN');assert(!JSON.stringify(collected).includes('Hidden thread body'));assert(!JSON.stringify(collected).includes('Hidden thread display name'));
 assert.equal(collected.find(item=>item.id===children[0].id).revision,2);assert(collected.filter(item=>item.record).every(item=>item.record.verification==='UNVERIFIED'));assert.equal((await repo().thread(children[0].id,children[0].digest)).items.length,2);
});

test('research thread references reject foreign anchors, wrong digests and noncanonical inputs',async()=>{
 const time=at(),target=(await write(human(),publication(),time)).item,other=(await write(human(),publication(),time)).item,child=(await write(human(),publication({relation:relation(target,'FORK')}),time)).item,foreign=(await write(human(),publication({relation:relation(other,'FORK')}),time)).item;
 for(const [recordId,digest,cursor] of [[target.id,'0'.repeat(64),null],[uid(),target.digest,null],[target.id,target.digest,other.id],[target.id,target.digest,foreign.id],[target.id,target.digest,target.id],[target.id,target.digest,uid()]])await assert.rejects(()=>repo().thread(recordId,digest,cursor),status(404));
 for(const [recordId,digest,cursor] of [['bad',target.digest,null],[target.id,target.digest.toUpperCase(),null],[target.id,'x'.repeat(64),null],[target.id,42,null],[target.id,target.digest,''],[target.id,target.digest,{}]])await assert.rejects(()=>repo().thread(recordId,digest,cursor),status(400));
 assert.deepEqual((await repo().thread(target.id,target.digest,child.id)).items,[]);assert.equal((await repo().thread(other.id,other.digest)).items[0].id,foreign.id);
});

test('research thread target suppression returns only its current tombstone without cascading to child records',async()=>{
 const time=at(),owner=human(),target=(await write(owner,publication({title:'Suppressed thread target'}),time)).item,child=(await write(human(),publication({relation:relation(target,'FORK'),title:'Independently visible child'}),time)).item,moderator=human(true);
 await write(moderator,moderate(target),time);const hidden=await repo().thread(target.id,target.digest,child.id);assert.equal(hidden.target.state,'HIDDEN');assert.deepEqual(hidden.items,[]);assert.equal(hidden.nextCursor,null);assert(!JSON.stringify(hidden).includes('Suppressed thread target'));assert(!JSON.stringify(hidden).includes('Independently visible child'));assert.equal((await repo().get(child.id)).item.state,'VISIBLE');
 await write(moderator,moderate(target,'VISIBLE'),time);assert.equal((await repo().thread(target.id,target.digest)).items[0].id,child.id);
 await write(owner,withdraw(target),time);const withdrawn=await repo().thread(target.id,target.digest);assert.equal(withdrawn.target.state,'WITHDRAWN');assert.deepEqual(withdrawn.items,[]);assert.equal(withdrawn.nextCursor,null);assert.equal((await repo().get(child.id)).item.record.content.title,'Independently visible child');
});

test('research threads recheck target visibility after child projection and discard an earlier visible body',async()=>{
 const time=at(),target=(await write(human(),publication({title:'Initially visible target'}),time)).item,child=(await write(human(),publication({relation:relation(target,'FORK')}),time)).item,moderator=human(true);let reached=false;
 const racing=new ResearchRepository({prepare(sql){const wrap=(statement,args=[])=>({bind(...values){return wrap(statement.bind(...values),values);},first:(...values)=>statement.first(...values),async all(){const result=await statement.all();if(!reached&&sql.includes('FROM research_moderation WHERE record_id=')&&args[0]===child.id){reached=true;await write(moderator,moderate(target),time);}return result;},run:()=>statement.run()});return wrap(db.prepare(sql));}});
 const result=await racing.thread(target.id,target.digest);assert.equal(reached,true);assert.equal(result.target.state,'HIDDEN');assert.equal(result.target.record,null);assert.deepEqual(result.items,[]);assert.equal(result.nextCursor,null);assert(!JSON.stringify(result).includes('Initially visible target'));
});

test('research threads validate canonical retained children and anchors even when their public bodies are hidden',async()=>{
 const time=at(),target=(await write(human(),publication(),time)).item,child=(await write(human(),publication({relation:relation(target,'CHALLENGE'),kind:'CHALLENGE'}),time)).item,moderator=human(true);await write(moderator,moderate(child),time);
 const stored=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(child.id).first();
 for(const [column,value] of [['payload',' '+stored.payload],['digest','0'.repeat(64)],['command_digest','0'.repeat(64)],['created_at',new Date(Date.parse(time)-1).toISOString()]]){
  await db.prepare(`UPDATE research_publications SET ${column}=? WHERE id=?`).bind(value,child.id).run();await assert.rejects(()=>repo().thread(target.id,target.digest),status(503));await assert.rejects(()=>repo().thread(target.id,target.digest,child.id),status(503));assert.equal((await db.prepare(`SELECT ${column} AS value FROM research_publications WHERE id=?`).bind(child.id).first()).value,value);await db.prepare(`UPDATE research_publications SET ${column}=? WHERE id=?`).bind(stored[column],child.id).run();
 }
 const originalTarget=await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(target.id).first();await db.prepare('UPDATE research_publications SET payload=? WHERE id=?').bind(' '+originalTarget.payload,target.id).run();await assert.rejects(()=>repo().thread(target.id,target.digest),status(503));assert.equal((await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(target.id).first()).payload,' '+originalTarget.payload);
});

test('research thread lookahead is validated before advertising another page',async()=>{
 const time=at(),target=(await write(human(),publication(),time)).item,children=[];for(let n=0;n<21;n++)children.push((await write(human(),publication({relation:relation(target,'FORK')}),time)).item);
 const last=[...children].sort((a,b)=>b.id.localeCompare(a.id)).at(-1);await db.prepare('UPDATE research_publications SET command_digest=? WHERE id=?').bind('0'.repeat(64),last.id).run();await assert.rejects(()=>repo().thread(target.id,target.digest),status(503));assert.equal((await db.prepare('SELECT command_digest FROM research_publications WHERE id=?').bind(last.id).first()).command_digest,'0'.repeat(64));
});

test('self-consistent direct revision bytes cannot contradict the exact parent lineage even when hidden',async()=>{
 const time=at(),owner=human(),target=(await write(owner,publication(),time)).item,child=(await write(owner,publication({relation:relation(target,'REVISION')}),time)).item,changedRecord={...child.record,content:{...child.record.content,kind:'FAILURE'}},checked=model.boundedResearchRecord(changedRecord),digest=await model.researchDigest(checked.payload),command=model.boundedResearchCommand({action:'publish',requestId:child.requestId,id:child.id,...changedRecord.content,policyAccepted});
 const impossible={...child,record:checked.record,digest};assert.equal(model.researchPublicItemSchema.safeParse(impossible).success,true);assert.equal(model.researchThreadSchema.safeParse({version:1,target,items:[impossible],nextCursor:null,executionEnabled:false}).success,false);
 await db.prepare('UPDATE research_publications SET payload=?,digest=?,command_digest=? WHERE id=?').bind(checked.payload,digest,await model.researchDigest(command.payload),child.id).run();
 await assert.rejects(()=>repo().thread(target.id,target.digest),status(503));await assert.rejects(()=>repo().thread(target.id,target.digest,child.id),status(503));
 await write(human(true),moderate(impossible),time);assert.equal((await repo().get(child.id)).item.state,'HIDDEN');await assert.rejects(()=>repo().thread(target.id,target.digest),status(503));await assert.rejects(()=>repo().thread(target.id,target.digest,child.id),status(503));assert.equal((await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(child.id).first()).payload,checked.payload);
});

test('a canonical agent revision cannot change sponsorship when used as a suppressed target cursor',async()=>{
 const time=at(),sponsor=human(),contributor=await agent(sponsor,'Original sponsor lineage',time),target=(await write(contributor.actor,publication(),time)).item,child=(await write(contributor.actor,publication({relation:relation(target,'REVISION')}),time)).item,otherSponsor=await model.researchPublicHumanId(human().userId),changed={...child.record,author:{...child.record.author,sponsorId:otherSponsor}},checked=model.boundedResearchRecord(changed),digest=await model.researchDigest(checked.payload);
 await db.prepare('UPDATE research_publications SET payload=?,digest=?,sponsor_key=? WHERE id=?').bind(checked.payload,digest,otherSponsor,child.id).run();assert.equal((await repo().get(child.id)).item.author.sponsorId,otherSponsor);await assert.rejects(()=>repo().thread(target.id,target.digest),status(503));
 await write(human(true),moderate(target),time);const hidden=await repo().thread(target.id,target.digest);assert.equal(hidden.target.state,'HIDDEN');assert.deepEqual(hidden.items,[]);await assert.rejects(()=>repo().thread(target.id,target.digest,child.id),status(503));assert.equal((await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(child.id).first()).payload,checked.payload);
});

test('revocation between earlier authentication and the publication INSERT fences both new writes and replay',async()=>{
 const sponsor=human(),a=await agent(sponsor),first=await write(a.actor),command=publication();let reached=false;
 const racing=new ResearchRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO research_publications')&&!reached){reached=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());}}));
 await assert.rejects(()=>racing.write(a.actor,command,at()),status(401));assert.equal(reached,true);assert.equal(await count('research_publications'),1);await assert.rejects(()=>write(a.actor,{...first.item.record.content,action:'publish',id:first.item.id,requestId:first.item.requestId,policyAccepted}),status(401));
});

test('SQLite actual commit clock rejects a credential expiring while asynchronous processing holds a fresh principal',async()=>{
 const sponsor=human(),registrationTime=new Date(Date.now()-86400000+1500).toISOString(),a=await agent(sponsor,'Expiring researcher',registrationTime,1),command=publication(),requestTime=new Date().toISOString();let reached=false;
 const delayed=new ResearchRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO research_publications')){reached=true;const delay=Date.parse(a.actor.principal.expiresAt)-Date.now()+80;if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));}}));
 await assert.rejects(()=>delayed.write(a.actor,command,requestTime),status(401));assert.equal(reached,true);assert.equal(await count('research_publications'),0);
});

test('exact target visibility is fenced at INSERT for forks, revisions and challenges',async()=>{
 for(const type of ['FORK','REVISION','CHALLENGE']){
  const author=human(),first=(await write(author)).item,moderator=human(true),command=publication({kind:type==='CHALLENGE'?'CHALLENGE':'HYPOTHESIS',relation:relation(first,type)});let reached=false;
  const racing=new ResearchRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO research_publications')&&!reached){reached=true;await write(moderator,moderate(first));}}));
  await assert.rejects(()=>racing.write(author,command,at()),status(409));assert.equal(reached,true);assert.equal((await repo().get(first.id)).item.record,null);assert.equal(await db.prepare('SELECT id FROM research_publications WHERE id=?').bind(command.id).first(),null);
 }
});

test('twenty publications per UTC day aggregate human and sibling agents and arbitrate concurrent final slots',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),actors=[sponsor,a.actor,b.actor],commands=[];
 for(let n=0;n<19;n++){const command=publication();commands.push(command);await write(actors[n%3],command);}
 const results=await Promise.allSettled(Array.from({length:5},(_,n)=>write(actors[n%3])));assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===429).length,4);assert.equal(await count('research_publications'),20);assert(results.filter(result=>result.status==='rejected').every(result=>result.reason.retryAfterSeconds>0));
 assert.equal((await write(sponsor,commands[0])).item.id,commands[0].id);assert.equal(await count('research_publications'),20);await write(human());assert.equal(await count('research_publications'),21);
});

test('public read, history and idempotent writer receipts apply current hidden state without reviving body or agent name',async()=>{
 const sponsor=human(),a=await agent(sponsor,'Remove this display label'),command=publication({title:'Removed sensitive title'}),first=(await write(a.actor,command)).item,moderator=human(true),hideCommand=moderate(first),hidden=await write(moderator,hideCommand);
 assert.equal(hidden.item.state,'HIDDEN');const receipts=[await repo().get(first.id),await repo().history(first.rootId),await repo().list(),await write(a.actor,command)];
 for(const receipt of receipts){const serialized=JSON.stringify(receipt);assert(!serialized.includes('Removed sensitive title'));assert(!serialized.includes('Remove this display label'));assert(!serialized.includes('example.test/primary'));}
 assert.equal((await write(a.actor,command)).item.record,null);assert.equal((await write({...moderator,moderator:false},publication())).item.record.verification,'UNVERIFIED');
 const restored=await write(moderator,moderate(first,'VISIBLE'));assert.equal(restored.item.state,'VISIBLE');assert.equal(restored.item.record.content.title,command.title);assert.equal(restored.item.record.verification,'UNVERIFIED');
 const denied=moderate(first);await assert.rejects(()=>write(human(),denied),status(403));await assert.rejects(()=>write(a.actor,denied),status(403));await assert.rejects(()=>write({...moderator,moderator:false},hideCommand),status(403));assert.equal((await repo().get(first.id)).item.state,'VISIBLE');
});

test('only original author or sponsoring human can withdraw, and moderation retains the terminal withdrawal slot',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),first=(await write(a.actor)).item,moderator=human(true);
 await assert.rejects(()=>write(human(),withdraw(first,'PERSONAL_DATA')),status(403));await assert.rejects(()=>write(b.actor,withdraw(first)),status(403));await assert.rejects(()=>write(sponsor,withdraw(first)),status(403));
 for(let n=0;n<15;n++)await write(moderator,moderate(first,n%2?'VISIBLE':'HIDDEN'));
 await assert.rejects(()=>write(moderator,moderate(first,'VISIBLE')),status(409));const command=withdraw(first,'SPONSOR_REQUEST'),withdrawn=await write(sponsor,command);assert.equal(withdrawn.item.state,'WITHDRAWN');assert.equal(withdrawn.item.record,null);assert.equal(withdrawn.item.moderation.length,16);assert.deepEqual(await write(sponsor,command),withdrawn);await assert.rejects(()=>write(moderator,moderate(first,'VISIBLE')),status(409));
 assert.equal((await repo().get(first.id)).item.record,null);assert.equal((await repo().history(first.rootId)).items[0].record,null);
});

test('reports are private, sponsor quota is shared and explicit moderator authority is required for their feed',async()=>{
 const sponsor=human(),a=await agent(sponsor),first=(await write(human())).item,commands=[];
 for(let n=0;n<9;n++){const command=report(first);commands.push(command);await write(n%2?sponsor:a.actor,command);}
 const results=await Promise.allSettled([write(sponsor,report(first)),write(a.actor,report(first)),write(sponsor,report(first))]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===429).length,2);assert.equal(await count('research_reports'),10);
 const own=await write(a.actor,commands[0]);assert.equal(own.item,null);assert(!JSON.stringify(own).includes('Private report evidence'));assert.equal(own.report.id,first.id);
 for(const actor of [sponsor,a.actor])await assert.rejects(()=>repo().reports(actor,at()),status(403));const moderator=human(true),feed=await repo().reports(moderator,at());assert.equal(feed.reports.length,10);assert(feed.reports.every(report=>report.details.includes('Private report evidence')));
 const publicRead=JSON.stringify(await repo().get(first.id));assert(!publicRead.includes('Private report evidence'));assert(!publicRead.includes('reporter'));assert(!JSON.stringify(feed).includes(sponsor.userId));
 await assert.rejects(()=>write(human(),{...report(first),details:'界'.repeat(1500)}),status(413));assert.equal(await count('research_reports'),10);
});

test('lost acknowledgments reconcile committed publications, reports and moderation without duplicate quota charges',async()=>{
 const author=human(),command=publication();let lose=true;const r=new ResearchRepository(wrapper(null,sql=>{if(sql.startsWith('INSERT')&&lose){lose=false;throw Error('lost acknowledgement');}})),first=await r.write(author,command,at());assert.equal(await count('research_publications'),1);assert.deepEqual(await write(author,command),first);
 for(const next of [report(first.item),withdraw(first.item)]){let lost=true;const uncertain=new ResearchRepository(wrapper(null,sql=>{if(sql.startsWith('INSERT')&&lost){lost=false;throw Error('lost acknowledgment');}}));const receipt=await uncertain.write(author,next,at());assert.deepEqual(await write(author,next),receipt);}
 assert.equal(await count('research_reports'),1);assert.equal(await count('research_moderation'),1);
 const missing=publication(),before=new ResearchRepository(wrapper(sql=>{if(sql.startsWith('INSERT'))throw Error('before commit');}));await assert.rejects(()=>before.write(author,missing,at()),/before commit/);assert.equal(await count('research_publications'),1);await write(author,missing);assert.equal(await count('research_publications'),2);
});

test('corrupt canonical bytes, hashes and event/report metadata are held without repair or public fallback',async()=>{
 const author=human(),first=(await write(author)).item,stored=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(first.id).first();
 for(const [column,value] of [['digest','0'.repeat(64)],['payload',' '+stored.payload],['payload','x'.repeat(20481)],['author_key','HUMAN:human_'+'f'.repeat(64)],['command_digest','0'.repeat(64)]]){
  await db.prepare(`UPDATE research_publications SET ${column}=? WHERE id=?`).bind(value,first.id).run();await assert.rejects(()=>repo().get(first.id),status(503));await assert.rejects(()=>repo().list(),status(503));assert.equal((await db.prepare(`SELECT ${column} AS value FROM research_publications WHERE id=?`).bind(first.id).first()).value,value);await db.prepare(`UPDATE research_publications SET ${column}=? WHERE id=?`).bind(stored[column],first.id).run();
 }
 await write(author,report(first));await db.prepare('UPDATE research_reports SET payload=?').bind('{}').run();await assert.rejects(()=>repo().reports(human(true),at()),status(503));assert.equal((await db.prepare('SELECT payload FROM research_reports').first()).payload,'{}');
 await write(human(true),moderate(first));await db.prepare('UPDATE research_moderation SET digest=?').bind('f'.repeat(64)).run();await assert.rejects(()=>repo().get(first.id),status(503));assert.equal((await db.prepare('SELECT digest FROM research_moderation').first()).digest,'f'.repeat(64));
});

test('real Worker runtime authenticates externally supplied agent tokens and retains public-only research',async()=>{
 const sponsor=human(),a=await agent(sponsor),command=publication({kind:'FAILURE'}),response=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({token:a.token,command,at:at()})});assert.equal(response.status,200);const written=await response.json();assert.equal(written.item.record.author.id,a.command.id);assert.equal(written.item.record.content.kind,'FAILURE');assert.equal(written.item.record.verification,'UNVERIFIED');
 const publicRead=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({read:command.id})});assert.equal(publicRead.status,200);assert(!JSON.stringify(await publicRead.json()).includes(a.token));
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(value=>value.name);assert(!tables.some(name=>/capital|financial|execution|wallet|account/.test(name)));
});

async function clonePublication(base,n){const id=uid(),requestId=uid(),sponsorId='human_'+await model.researchDigest('fixture'+n),record={...base.record,id,rootId:id,requestId,author:{kind:'HUMAN',id:sponsorId,sponsorId}},payload=JSON.stringify(record),command=publication({...record.content,id,requestId});return db.prepare('INSERT INTO research_publications(id,root_id,revision,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,1,?,?,?,?,?,?,?)').bind(id,id,'HUMAN:'+sponsorId,sponsorId,requestId,await model.researchDigest(model.boundedResearchCommand(command).payload),payload,await model.researchDigest(payload),record.createdAt);}
test('global retained publication capacity arbitrates the last slot without promising an automatic reset',async()=>{
 const author=human(),command=publication(),base=(await write(author,command)).item,inserts=[];for(let n=0;n<2998;n++)inserts.push(await clonePublication(base,n));for(let n=0;n<inserts.length;n+=50)await db.batch(inserts.slice(n,n+50));assert.equal(await count('research_publications'),2999);
 const results=await Promise.allSettled([write(human()),write(human())]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const failure=results.find(result=>result.status==='rejected').reason;assert.equal(failure.status,429);assert.equal(failure.retryAfterSeconds,undefined);assert.equal(await count('research_publications'),3000);assert.equal((await write(author,command)).item.id,command.id);
});

test('all32 root revisions are traceable, newest-first feed pagination is stable and the revision cap preserves originals',async()=>{
 const author=human(),started=new Date(Date.now()-31*86400000-10_000).toISOString(),first=(await write(author,publication(),started)).item;let previous=first;
 for(let revision=2;revision<=32;revision++){
  const id=uid(),requestId=uid(),createdAt=new Date(Date.parse(started)+(revision-1)*86400000).toISOString(),{record,payload}=model.boundedResearchRecord({...first.record,id,revision,requestId,createdAt,content:{...first.record.content,relation:relation(previous,'REVISION')}}),command=publication({...record.content,id,requestId});
  const digest=await model.researchDigest(payload);await db.prepare('INSERT INTO research_publications(id,root_id,revision,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,first.rootId,revision,'HUMAN:'+first.author.id,first.author.sponsorId,requestId,await model.researchDigest(model.boundedResearchCommand(command).payload),payload,digest,createdAt).run();previous={...previous,id,revision,requestId,createdAt,digest,record};
 }
 const history=await repo().history(first.rootId);assert.equal(history.items.length,32);assert.equal(history.items[0].revision,32);assert.deepEqual(history.items.at(-1),first);
 await assert.rejects(()=>write(author,publication({relation:relation(previous,'REVISION')})),status(409));assert.equal(await count('research_publications'),32);
 const collected=[];let cursor=null;do{const page=await repo().list(cursor);collected.push(...page.items);cursor=page.nextCursor;}while(cursor);assert.equal(collected.length,32);assert.equal(new Set(collected.map(item=>item.id)).size,32);assert.deepEqual(collected.map(item=>item.id),history.items.map(item=>item.id));
 await assert.rejects(()=>repo().list(uid()),status(404));await assert.rejects(()=>repo().list('invalid'),status(400));
});

test('global retained private report capacity arbitrates the final slot without exposing private details publicly',async()=>{
 const reporter=human(),target=(await write(human())).item,initial=report(target);await write(reporter,initial);const base=await db.prepare('SELECT * FROM research_reports WHERE request_id=?').bind(initial.requestId).first(),parsed=JSON.parse(base.payload),inserts=[];
 for(let n=0;n<998;n++){const sponsorId='human_'+await model.researchDigest('report-fixture'+n),requestId=uid(),privateReport={...parsed,requestId,reporter:{kind:'HUMAN',id:sponsorId,sponsorId}},payload=JSON.stringify(privateReport),command={...initial,requestId};inserts.push(db.prepare('INSERT INTO research_reports(author_key,request_id,sponsor_key,record_id,record_digest,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('HUMAN:'+sponsorId,requestId,sponsorId,target.id,target.digest,await model.researchDigest(model.boundedResearchCommand(command).payload),payload,await model.researchDigest(payload),privateReport.createdAt));}
 for(let n=0;n<inserts.length;n+=50)await db.batch(inserts.slice(n,n+50));assert.equal(await count('research_reports'),999);
 const results=await Promise.allSettled([write(human(),report(target)),write(human(),report(target))]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const failure=results.find(result=>result.status==='rejected').reason;assert.equal(failure.status,429);assert.equal(failure.retryAfterSeconds,undefined);assert.equal(await count('research_reports'),1000);
 assert.equal((await write(reporter,initial)).report.requestId,initial.requestId);assert(!JSON.stringify(await repo().get(target.id)).includes(parsed.details));assert.equal((await repo().reports(human(true),at())).reports.length,20);
});

test('cross-action publication and private-report races cannot reuse one author’s operation identity',async()=>{
 const author=human(),target=(await write(author)).item,requestId=uid(),commands=[publication({requestId}),{...report(target),requestId}],results=await Promise.allSettled(commands.map(command=>write(author,command)));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===409).length,1);
 const publicationCount=(await db.prepare('SELECT COUNT(*) AS n FROM research_publications WHERE request_id=?').bind(requestId).first()).n,reportCount=(await db.prepare('SELECT COUNT(*) AS n FROM research_reports WHERE request_id=?').bind(requestId).first()).n;assert.equal(publicationCount+reportCount,1);
 const accepted=results.findIndex(result=>result.status==='fulfilled');assert.deepEqual(await write(author,commands[accepted]),results[accepted].value);
});


test('moderator-only digest cursors expose every retained report across stable equal-clock pages',async()=>{
 const time=at(),moderator=human(true),sharedRequest=uid(),targets=[];
 for(let n=0;n<43;n++){
  const target=(await write(human(),publication(),time)).item;targets.push(target.id);
  await write(human(),{...report(target),requestId:n<2?sharedRequest:uid()},time);
 }
 const expected=(await db.prepare('SELECT * FROM research_reports ORDER BY created_at DESC,author_key DESC,request_id DESC').all()).results;
 const collected=[],sizes=[];let cursor=null;
 do{
  const page=await repo().reports(moderator,time,cursor);model.researchReportsSchema.parse(page);sizes.push(page.reports.length);collected.push(...page.reports);
  if(page.nextCursor)assert.equal(page.nextCursor,await model.researchDigest(JSON.stringify(page.reports.at(-1))));cursor=page.nextCursor;
 }while(cursor);
 assert.deepEqual(sizes,[20,20,3]);assert.equal(new Set(collected.map(value=>value.id)).size,43);assert.deepEqual(collected.map(value=>value.id),expected.map(value=>value.record_id));assert.deepEqual(new Set(collected.map(value=>value.id)),new Set(targets));
 assert.equal(collected.filter(value=>value.requestId===sharedRequest).length,2);assert.equal(await count('research_reports'),43);
 const a=await agent(human(),'Pagination fixture agent',time),first=await repo().reports(moderator,time);let queries=0;
 const guarded=new ResearchRepository({prepare(){queries++;throw Error('Unauthorized private queue query.');}});
 for(const actor of [human(),{...moderator,moderator:false},a.actor])await assert.rejects(()=>guarded.reports(actor,time,first.nextCursor),status(403));assert.equal(queries,0);
 for(const value of ['',uid(),'f'.repeat(63),'F'.repeat(64),42,{}])await assert.rejects(()=>repo().reports(moderator,time,value),status(400));
 await assert.rejects(()=>repo().reports(moderator,time,'0'.repeat(64)),status(404));assert.equal((await repo().reports(moderator,time,null)).reports.length,20);
 const publicView=JSON.stringify(await repo().get(targets[0]));assert(!publicView.includes('Private report evidence'));assert(!publicView.includes(first.nextCursor));
});

test('report digest anchors hold corrupt or ambiguous retained material without exposing details or repairing bytes',async()=>{
 const moderator=human(true),time=at(),first=(await write(human(),publication(),time)).item,second=(await write(human(),publication(),time)).item;
 const one=report(first),two=report(second);await write(human(),one,time);await write(human(),two,time);
 const original=(await db.prepare('SELECT * FROM research_reports ORDER BY request_id').all()).results,[a,b]=original;
 await db.prepare('UPDATE research_reports SET digest=? WHERE author_key=? AND request_id=?').bind(a.digest,b.author_key,b.request_id).run();
 await assert.rejects(()=>repo().reports(moderator,time,a.digest),status(503));await assert.rejects(()=>repo().reports(moderator,time),status(503));
 assert.equal((await db.prepare('SELECT digest FROM research_reports WHERE author_key=? AND request_id=?').bind(b.author_key,b.request_id).first()).digest,a.digest);
 await db.prepare('UPDATE research_reports SET digest=? WHERE author_key=? AND request_id=?').bind(b.digest,b.author_key,b.request_id).run();
 await db.prepare('UPDATE research_reports SET payload=? WHERE author_key=? AND request_id=?').bind('{}',a.author_key,a.request_id).run();
 await assert.rejects(()=>repo().reports(moderator,time,a.digest),status(503));assert.equal((await db.prepare('SELECT payload FROM research_reports WHERE author_key=? AND request_id=?').bind(a.author_key,a.request_id).first()).payload,'{}');
 assert.equal(await count('research_reports'),2);
});
