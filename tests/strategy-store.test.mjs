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
const model=load('app/strategy-model.ts'),{StrategyRepository}=load('app/strategy-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const uid=()=>crypto.randomUUID(),at=()=>new Date(Date.now()-10_000).toISOString(),policyAccepted='public-strategy-v1',human=(moderator=false)=>({kind:'HUMAN',userId:uid(),moderator});
const publication=(extra={})=>({action:'publish',requestId:uid(),id:uid(),name:'A falsifiable strategy definition',description:'A dated test may show whether these declared rules survive realistic assumptions.',definition:model.strategyTemplate('TREND'),assumptions:'Input provenance and costs must be representative.',falsification:'Reject if unseen samples fail the declared test after costs.',sources:[{url:'https://example.test/primary',classification:'PRIMARY',note:'Declared primary reference; not independently fetched.'}],relation:null,policyAccepted,...extra});
const ref=item=>({id:item.id,digest:item.digest}),relation=(item,type)=>({...ref(item),type});
const withdraw=(item,reason='AUTHOR_REQUEST')=>({action:'withdraw',requestId:uid(),...ref(item),reason,policyAccepted});
const moderate=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted});
const report=item=>({action:'report',requestId:uid(),...ref(item),reason:'MISLEADING',details:'Private report evidence that must never enter public output.',policyAccepted});
const status=code=>error=>error instanceof model.StrategyError&&error.status===code;
let mf,db;
before(async()=>{
 const source=`import {StrategyRepository} from './app/strategy-store.ts';import {NetworkRepository} from './app/network-store.ts';export default{async fetch(request,env){const input=await request.json();try{const repo=new StrategyRepository(env.DB);if(input.read)return Response.json(await repo.get(input.read));const actor=input.token?{kind:'AGENT',principal:await new NetworkRepository(env.DB).authenticate(input.token,input.at)}:{kind:'HUMAN',userId:input.user,moderator:false};return Response.json(await repo.write(actor,input.command,input.at));}catch(error){return Response.json({error:error.message},{status:error.status??503});}}};`;
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const repo=()=>new StrategyRepository(db);
async function agent(sponsor,name='Sponsored strategy researcher',registeredAt=at(),days=7){const generated=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:generated.credentialId,name,tokenDigest:generated.tokenDigest,days};await new NetworkRepository(db).write(sponsor.userId,command,registeredAt);const principal=await new NetworkRepository(db).authenticate(generated.token,registeredAt);return {actor:{kind:'AGENT',principal},token:generated.token,command};}
async function count(table){return (await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;}
function wrapper(beforeRun,afterRun){return {prepare(sql){const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const result=await statement.run();await afterRun?.(sql);return result;}});return wrap(db.prepare(sql));}};}
async function write(actor,command=publication(),time=at()){return repo().write(actor,command,time);}

test('strict inputs reject forged authority, unsafe URLs, credentials, missing falsification and excess bounds',async()=>{
 const actor=human(),command=publication();model.strategyPublishSchema.parse(command);
 for(const extra of [{author:{kind:'HUMAN',id:uid()}},{sponsorId:uid()},{verified:true},{verification:'VERIFIED'},{executionEnabled:true},{reputation:100},{policyAccepted:'other'},{description:'og_agent_'+uid()+'.'+'a'.repeat(64)},{description:'%6f%67_agent_hidden'},{name:'a'.repeat(121)},{description:'a'.repeat(3001)},{falsification:''},{assumptions:''}])await assert.rejects(()=>write(actor,{...command,...extra}),status(400));
 for(const url of ['http://example.test','https://name:secret@example.test','javascript:alert(1)','https://example.test/og_agent_hidden'])await assert.rejects(()=>write(actor,{...command,sources:[{...command.sources[0],url}]}),status(400));
 const safe=await write(actor,publication({description:'<script>doNotRun()</script> is recorded as literal strategy text.'}));assert.equal(safe.item.record.content.description,'<script>doNotRun()</script> is recorded as literal strategy text.');assert.equal(await count('strategy_publications'),1);
 const author=safe.item.author;assert.equal(model.strategyAuthorReferenceSchema.safeParse({...author,sponsorId:'human_'+'f'.repeat(64)}).success,false);
 const oversized=publication({description:'界'.repeat(3000),assumptions:'界'.repeat(1500),falsification:'界'.repeat(2000),sources:Array.from({length:8},()=>({url:'https://example.test/'+'界'.repeat(120),classification:'PRIMARY',note:'界'.repeat(300)}))});await assert.rejects(()=>write(actor,oversized),status(413));assert.equal(await count('strategy_publications'),1);
});

test('all seven declarative families retain canonical bounded definitions and remain untested without execution grants',async()=>{
 const author=human(),types=['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES'];
 for(const type of types){
  const definition=model.strategyTemplate(type),command=publication({definition}),item=(await write(author,command)).item;
  assert.deepEqual(item.record.content.definition,definition);assert.equal(item.record.verification,'UNTESTED');assert.equal(item.record.executionEnabled,false);assert.deepEqual(definition.execution,{mode:'DEMO',leverage:1,ordersEnabled:false});
  const bounded=model.boundedStrategyRecord(item.record);assert.equal(item.digest,await model.strategyDigest(bounded.payload));assert.deepEqual((await repo().get(item.id)).item,item);
 }
 const one=model.strategyTemplate('RULES');one.entry.conditions[0].threshold=99;assert.equal(model.strategyTemplate('RULES').entry.conditions[0].threshold,1);
 assert.equal((await repo().list()).items.length,7);
});

test('definition guards reject executable extensions, split allocation budgets, malformed predicates and numeric extremes before storage',async()=>{
 const actor=human(),base=model.strategyTemplate('TREND');
 const invalid=[
  {...base,code:'fetch(secret)'},{...base,accountId:'private'},{...base,performance:{returnPct:100}},
  {...base,execution:{...base.execution,mode:'LIVE'}},{...base,execution:{...base.execution,ordersEnabled:true}},{...base,execution:{...base.execution,leverage:2}},{...base,execution:{...base.execution,exchangeId:'private'}},
  {...base,market:{...base.market,symbol:'btc/usdt'}},{...base,market:{...base.market,symbol:'BTC/USDT/PERP'}},{...base,market:{...base.market,timeframe:'1s'}},
  {...base,entry:{...base.entry,fastPeriod:50,slowPeriod:50}},{...base,entry:{...base.entry,fastPeriod:1}},{...base,entry:{...base.entry,slowPeriod:301}},{...base,entry:{...base.entry,confirmation:'ABOVE'}},
  {...base,risk:{...base.risk,positionPct:10.01}},{...base,risk:{...base.risk,positionPct:NaN}},{...base,risk:{...base.risk,maxOpenPositions:1.5}},{...base,risk:{...base.risk,maxDailyLossPct:5.01}},
  {...base,costs:{...base.costs,slippageBps:Infinity}},{...base,costs:{...base.costs,feeBps:-1}},
  {...base,entry:{type:'GRID',lowerPrice:2,upperPrice:2,levels:4}},{...base,entry:{type:'GRID',lowerPrice:0,upperPrice:10,levels:4}},{...base,entry:{type:'GRID',lowerPrice:1,upperPrice:1e9+1,levels:4}},{...base,entry:{type:'GRID',lowerPrice:1,upperPrice:10,levels:31}},
  {...base,entry:{type:'DCA',intervalBars:1,maxEntries:11}},{...base,entry:{type:'DCA',intervalBars:1,maxEntries:2,entryPct:10}},
  {...base,entry:{type:'SIGNAL',provider:'TRADINGVIEW',event:'BEARISH',maxAgeBars:1}},{...base,entry:{type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:1,receiverUrl:'https://example.test'}},
  {...base,entry:{type:'RULES',match:'ALL',conditions:[]}},{...base,entry:{type:'RULES',match:'ALL',conditions:Array.from({length:9},()=>({indicator:'RSI',period:14,comparison:'LT',threshold:30}))}},
  {...base,entry:{type:'RULES',match:'ALL',conditions:[{indicator:'RSI',period:14,comparison:'LT',threshold:30,script:'return true'}]}},{...base,entry:{type:'RULES',match:'ALL',conditions:[{indicator:'RSI',period:14,comparison:'LT',threshold:-101}]}},
  {...base,entry:{type:'RSI',period:14,threshold:100,comparison:'BELOW'}},{...base,entry:{type:'BREAKOUT',lookback:301}},
 ];
 for(const definition of invalid)await assert.rejects(()=>write(actor,publication({definition})),status(400));
 assert.equal(await count('strategy_publications'),0);
 const short=model.strategyTemplate('SIGNAL');short.market.direction='SHORT';short.entry.event='BEARISH';const item=(await write(actor,publication({definition:short}))).item;assert.equal(item.record.content.definition.market.direction,'SHORT');assert.equal(item.record.verification,'UNTESTED');
 for(const type of ['DCA','GRID']){const definition=model.strategyTemplate(type);definition.risk.positionPct=10;assert.equal((await write(actor,publication({definition}))).item.record.content.definition.risk.positionPct,10);}
});

test('a human and two sponsored agents publish distinct stable authors sharing one pseudonymous sponsor',async()=>{
 const sponsor=human(),firstAgent=await agent(sponsor,'First strategy agent'),secondAgent=await agent(sponsor,'og_agent_strategyer'),items=[];
 for(const actor of [sponsor,firstAgent.actor,secondAgent.actor])items.push((await write(actor)).item);
 const publicSponsor=await model.strategyPublicHumanId(sponsor.userId);assert.equal(publicSponsor,'human_'+await model.strategyDigest('OpenGrail-public-sponsor-v1:'+sponsor.userId));assert.equal(new Set(items.map(item=>item.author.id)).size,3);assert(items.every(item=>item.author.sponsorId===publicSponsor));
 assert.equal(items[0].record.author.kind,'HUMAN');assert.equal(items[1].record.author.name,'First strategy agent');assert.equal(items[2].record.author.name,'og_agent_strategyer');assert(!('name' in items[1].author));
 for(const item of items){assert.equal(item.rootId,item.id);assert.equal(item.revision,1);assert.equal(item.record.verification,'UNTESTED');assert.equal(item.record.executionEnabled,false);assert.equal(item.digest,await model.strategyDigest(JSON.stringify(item.record)));const row=await db.prepare('SELECT * FROM strategy_publications WHERE id=?').bind(item.id).first();assert.equal(row.payload,JSON.stringify(item.record));}
 const listed=await repo().list();const serialized=JSON.stringify(listed);for(const value of [sponsor.userId,firstAgent.token,secondAgent.token,firstAgent.actor.principal.tokenDigest,'ownerId','credentialId','tokenDigest'])assert(!serialized.includes(value));assert.equal(listed.items.length,3);
});

test('idempotency is author scoped, exactly retryable and never reveals another principal’s private receipt',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),command=publication(),first=await write(sponsor,command);
 assert.deepEqual(await write(sponsor,command),first);await assert.rejects(()=>write(sponsor,{...command,name:'Changed'}),status(409));
 for(const actor of [human(),a.actor,b.actor])await assert.rejects(()=>write(actor,command),status(409));assert.equal(await count('strategy_publications'),1);
 const shared=uid(),siblings=await Promise.all([a.actor,b.actor].map(actor=>write(actor,publication({requestId:shared}))));assert.notEqual(siblings[0].item.author.id,siblings[1].item.author.id);assert.equal(await count('strategy_publications'),3);
 const own=publication(),raced=await Promise.all([write(a.actor,own),write(a.actor,own)]);assert.deepEqual(raced[0],raced[1]);assert.equal(await count('strategy_publications'),4);
 await assert.rejects(()=>write(sponsor,{...withdraw(first.item),requestId:command.requestId}),status(409));
});

test('revisions preserve original author, exact latest ancestry and immutable prior records under races',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),first=(await write(a.actor)).item,revision=()=>publication({relation:relation(first,'REVISION')});
 for(const actor of [sponsor,b.actor,human()])await assert.rejects(()=>write(actor,revision()),status(403));
 const commands=[revision(),revision()],results=await Promise.allSettled(commands.map(command=>write(a.actor,command)));assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);
 const second=results.find(result=>result.status==='fulfilled').value.item;assert.equal(second.rootId,first.id);assert.equal(second.revision,2);assert.deepEqual(second.record.content.relation,relation(first,'REVISION'));assert.deepEqual((await repo().get(first.id)).item,first);assert.deepEqual((await repo().history(first.id)).items,[second,first]);await assert.rejects(()=>write(a.actor,revision()),status(409));
});

test('forks retain exact visible targets without inheriting authorship or test verification',async()=>{
 const first=(await write(human())).item,other=human();
 const fork=(await write(other,publication({definition:model.strategyTemplate('GRID'),relation:relation(first,'FORK')}))).item;
 assert.equal(fork.rootId,fork.id);assert.equal(fork.revision,1);assert.equal(fork.record.content.definition.entry.type,'GRID');assert.notEqual(fork.author.id,first.author.id);assert.equal(fork.record.verification,'UNTESTED');
 const updated=(await write(other,publication({definition:model.strategyTemplate('RSI'),relation:relation(fork,'REVISION')}))).item;
 assert.equal(updated.rootId,fork.id);assert.equal(updated.revision,2);assert.equal(updated.record.content.definition.entry.type,'RSI');assert.deepEqual((await repo().get(fork.id)).item,fork);
 await assert.rejects(()=>write(other,publication({relation:relation(first,'CHALLENGE')})),status(400));
 await assert.rejects(()=>write(other,publication({relation:{...relation(first,'FORK'),digest:'0'.repeat(64)}})),status(404));
});

test('revocation between earlier authentication and the publication INSERT fences both new writes and replay',async()=>{
 const sponsor=human(),a=await agent(sponsor),first=await write(a.actor),command=publication();let reached=false;
 const racing=new StrategyRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO strategy_publications')&&!reached){reached=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());}}));
 await assert.rejects(()=>racing.write(a.actor,command,at()),status(401));assert.equal(reached,true);assert.equal(await count('strategy_publications'),1);await assert.rejects(()=>write(a.actor,{...first.item.record.content,action:'publish',id:first.item.id,requestId:first.item.requestId,policyAccepted}),status(401));
});

test('agent reports and withdrawal also atomically recheck revoked credentials instead of trusting earlier authentication',async()=>{
 for(const action of ['report','withdraw']){
  const sponsor=human(),a=await agent(sponsor),first=(await write(a.actor)).item,command=action==='report'?report(first):withdraw(first);let reached=false;
  const racing=new StrategyRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO strategy_')&&!reached){reached=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},at());}}));
  await assert.rejects(()=>racing.write(a.actor,command,at()),status(401));assert.equal(reached,true);assert.equal((await repo().get(first.id)).item.state,'VISIBLE');
  assert.equal(await db.prepare('SELECT request_id FROM strategy_reports WHERE request_id=?').bind(command.requestId).first(),null);assert.equal(await db.prepare('SELECT request_id FROM strategy_moderation WHERE request_id=?').bind(command.requestId).first(),null);
 }
});

test('agent identity and registry digest changes cannot forge authorship or replay a former write',async()=>{
 const sponsor=human(),a=await agent(sponsor),command=publication(),first=await write(a.actor,command),p=a.actor.principal;
 for(const changed of [{name:'Different author'},{ownerId:uid()},{agentId:uid()},{credentialId:uid()},{tokenDigest:'f'.repeat(64)},{registryDigest:'f'.repeat(64)},{payload:' '+p.payload}])await assert.rejects(()=>write({kind:'AGENT',principal:{...p,...changed}}),status(401));
 await db.prepare('UPDATE network_agents SET digest=? WHERE id=?').bind('0'.repeat(64),p.agentId).run();await assert.rejects(()=>write(a.actor,command),status(401));
 assert.equal(await count('strategy_publications'),1);assert.deepEqual((await repo().get(first.item.id)).item,first.item);
});

test('SQLite actual commit clock rejects a credential expiring while asynchronous processing holds a fresh principal',async()=>{
 const sponsor=human(),registrationTime=new Date(Date.now()-86400000+1500).toISOString(),a=await agent(sponsor,'Expiring strategyer',registrationTime,1),command=publication(),requestTime=new Date().toISOString();let reached=false;
 const delayed=new StrategyRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO strategy_publications')){reached=true;const delay=Date.parse(a.actor.principal.expiresAt)-Date.now()+80;if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));}}));
 await assert.rejects(()=>delayed.write(a.actor,command,requestTime),status(401));assert.equal(reached,true);assert.equal(await count('strategy_publications'),0);
});

test('exact target visibility is fenced at INSERT for forks and revisions',async()=>{
 for(const type of ['FORK','REVISION']){
  const author=human(),first=(await write(author)).item,moderator=human(true),command=publication({relation:relation(first,type)});let reached=false;
  const racing=new StrategyRepository(wrapper(async sql=>{if(sql.startsWith('INSERT INTO strategy_publications')&&!reached){reached=true;await write(moderator,moderate(first));}}));
  await assert.rejects(()=>racing.write(author,command,at()),status(409));assert.equal(reached,true);assert.equal((await repo().get(first.id)).item.record,null);assert.equal(await db.prepare('SELECT id FROM strategy_publications WHERE id=?').bind(command.id).first(),null);
 }
});

test('ten publications per UTC day aggregate human and sibling agents and arbitrate concurrent final slots',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor),actors=[sponsor,a.actor,b.actor],commands=[];
 for(let n=0;n<9;n++){const command=publication();commands.push(command);await write(actors[n%3],command);}
 const results=await Promise.allSettled(Array.from({length:5},(_,n)=>write(actors[n%3])));assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===429).length,4);assert.equal(await count('strategy_publications'),10);assert(results.filter(result=>result.status==='rejected').every(result=>result.reason.retryAfterSeconds>0));
 assert.equal((await write(sponsor,commands[0])).item.id,commands[0].id);assert.equal(await count('strategy_publications'),10);await write(human());assert.equal(await count('strategy_publications'),11);
});

test('public read, history and idempotent writer receipts apply current hidden state without reviving body or agent name',async()=>{
 const sponsor=human(),a=await agent(sponsor,'Remove this display label'),command=publication({name:'Removed sensitive title'}),first=(await write(a.actor,command)).item,moderator=human(true),hideCommand=moderate(first),hidden=await write(moderator,hideCommand);
 assert.equal(hidden.item.state,'HIDDEN');const receipts=[await repo().get(first.id),await repo().history(first.rootId),await repo().list(),await write(a.actor,command)];
 for(const receipt of receipts){const serialized=JSON.stringify(receipt);assert(!serialized.includes('Removed sensitive title'));assert(!serialized.includes('Remove this display label'));assert(!serialized.includes('example.test/primary'));}
 assert.equal((await write(a.actor,command)).item.record,null);assert.equal((await write({...moderator,moderator:false},publication())).item.record.verification,'UNTESTED');
 const restored=await write(moderator,moderate(first,'VISIBLE'));assert.equal(restored.item.state,'VISIBLE');assert.equal(restored.item.record.content.name,command.name);assert.equal(restored.item.record.verification,'UNTESTED');
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
 const results=await Promise.allSettled([write(sponsor,report(first)),write(a.actor,report(first)),write(sponsor,report(first))]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===429).length,2);assert.equal(await count('strategy_reports'),10);
 const own=await write(a.actor,commands[0]);assert.equal(own.item,null);assert(!JSON.stringify(own).includes('Private report evidence'));assert.equal(own.report.id,first.id);
 for(const actor of [sponsor,a.actor])await assert.rejects(()=>repo().reports(actor,at()),status(403));const moderator=human(true),feed=await repo().reports(moderator,at());assert.equal(feed.reports.length,10);assert(feed.reports.every(report=>report.details.includes('Private report evidence')));
 const publicRead=JSON.stringify(await repo().get(first.id));assert(!publicRead.includes('Private report evidence'));assert(!publicRead.includes('reporter'));assert(!JSON.stringify(feed).includes(sponsor.userId));
 await assert.rejects(()=>write(human(),{...report(first),details:'界'.repeat(1500)}),status(413));assert.equal(await count('strategy_reports'),10);
});

test('lost acknowledgments reconcile committed publications, reports and moderation without duplicate quota charges',async()=>{
 const author=human(),command=publication();let lose=true;const r=new StrategyRepository(wrapper(null,sql=>{if(sql.startsWith('INSERT')&&lose){lose=false;throw Error('lost acknowledgement');}})),first=await r.write(author,command,at());assert.equal(await count('strategy_publications'),1);assert.deepEqual(await write(author,command),first);
 for(const next of [report(first.item),withdraw(first.item)]){let lost=true;const uncertain=new StrategyRepository(wrapper(null,sql=>{if(sql.startsWith('INSERT')&&lost){lost=false;throw Error('lost acknowledgment');}}));const receipt=await uncertain.write(author,next,at());assert.deepEqual(await write(author,next),receipt);}
 assert.equal(await count('strategy_reports'),1);assert.equal(await count('strategy_moderation'),1);
 const missing=publication(),before=new StrategyRepository(wrapper(sql=>{if(sql.startsWith('INSERT'))throw Error('before commit');}));await assert.rejects(()=>before.write(author,missing,at()),/before commit/);assert.equal(await count('strategy_publications'),1);await write(author,missing);assert.equal(await count('strategy_publications'),2);
});

test('corrupt canonical bytes, hashes and event/report metadata are held without repair or public fallback',async()=>{
 const author=human(),first=(await write(author)).item,stored=await db.prepare('SELECT * FROM strategy_publications WHERE id=?').bind(first.id).first();
 for(const [column,value] of [['digest','0'.repeat(64)],['payload',' '+stored.payload],['payload','x'.repeat(28673)],['author_key','HUMAN:human_'+'f'.repeat(64)],['command_digest','0'.repeat(64)]]){
  await db.prepare(`UPDATE strategy_publications SET ${column}=? WHERE id=?`).bind(value,first.id).run();await assert.rejects(()=>repo().get(first.id),status(503));await assert.rejects(()=>repo().list(),status(503));assert.equal((await db.prepare(`SELECT ${column} AS value FROM strategy_publications WHERE id=?`).bind(first.id).first()).value,value);await db.prepare(`UPDATE strategy_publications SET ${column}=? WHERE id=?`).bind(stored[column],first.id).run();
 }
 await write(author,report(first));await db.prepare('UPDATE strategy_reports SET payload=?').bind('{}').run();await assert.rejects(()=>repo().reports(human(true),at()),status(503));assert.equal((await db.prepare('SELECT payload FROM strategy_reports').first()).payload,'{}');
 await write(human(true),moderate(first));await db.prepare('UPDATE strategy_moderation SET digest=?').bind('f'.repeat(64)).run();await assert.rejects(()=>repo().get(first.id),status(503));assert.equal((await db.prepare('SELECT digest FROM strategy_moderation').first()).digest,'f'.repeat(64));
});

test('real Worker runtime authenticates externally supplied agent tokens and retains public-only strategy',async()=>{
 const sponsor=human(),a=await agent(sponsor),command=publication({definition:model.strategyTemplate('DCA')}),response=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({token:a.token,command,at:at()})});assert.equal(response.status,200);const written=await response.json();assert.equal(written.item.record.author.id,a.command.id);assert.equal(written.item.record.content.definition.entry.type,'DCA');assert.equal(written.item.record.verification,'UNTESTED');
 const publicRead=await mf.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({read:command.id})});assert.equal(publicRead.status,200);assert(!JSON.stringify(await publicRead.json()).includes(a.token));
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(value=>value.name);assert(!tables.some(name=>/capital|financial|execution|wallet|account/.test(name)));
});

test('strategy records and operation UUIDs are isolated from the existing public research namespace',async()=>{
 const {ResearchRepository}=load('app/research-store.ts'),author=human(),oldRepo=new ResearchRepository(db),requestId=uid();
 const oldCommand={action:'publish',requestId,id:uid(),kind:'HYPOTHESIS',title:'Existing independent research',statement:'This original research must remain unchanged.',assumptions:'Independent public namespace.',falsification:'Reject if another API changes this retained body.',sources:[],relation:null,policyAccepted:'public-research-v1'},old=await oldRepo.write(author,oldCommand,at()),before=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(old.item.id).first();
 const command=publication({requestId}),created=await write(author,command);assert.equal(created.item.requestId,requestId);assert.notEqual(created.item.id,old.item.id);
 await assert.rejects(()=>write(author,publication({relation:relation(old.item,'FORK')})),status(404));
 await assert.rejects(()=>oldRepo.write(author,{...oldCommand,requestId:uid(),id:uid(),relation:relation(created.item,'FORK')},at()),error=>error.status===404);
 await write(author,withdraw(created.item));assert.deepEqual(await oldRepo.write(author,oldCommand,at()),old);assert.deepEqual(await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(old.item.id).first(),before);
 assert.equal(await count('research_moderation'),0);assert.equal(await count('research_reports'),0);
});

async function clonePublication(base,n){const id=uid(),requestId=uid(),sponsorId='human_'+await model.strategyDigest('fixture'+n),record={...base.record,id,rootId:id,requestId,author:{kind:'HUMAN',id:sponsorId,sponsorId}},payload=JSON.stringify(record),command=publication({...record.content,id,requestId});return db.prepare('INSERT INTO strategy_publications(id,root_id,revision,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,1,?,?,?,?,?,?,?)').bind(id,id,'HUMAN:'+sponsorId,sponsorId,requestId,await model.strategyDigest(model.boundedStrategyCommand(command).payload),payload,await model.strategyDigest(payload),record.createdAt);}
test('global retained publication capacity arbitrates the last slot without promising an automatic reset',async()=>{
 const author=human(),command=publication(),base=(await write(author,command)).item,inserts=[];for(let n=0;n<998;n++)inserts.push(await clonePublication(base,n));for(let n=0;n<inserts.length;n+=50)await db.batch(inserts.slice(n,n+50));assert.equal(await count('strategy_publications'),999);
 const results=await Promise.allSettled([write(human()),write(human())]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const failure=results.find(result=>result.status==='rejected').reason;assert.equal(failure.status,429);assert.equal(failure.retryAfterSeconds,undefined);assert.equal(await count('strategy_publications'),1000);assert.equal((await write(author,command)).item.id,command.id);
});

test('all32 root revisions are traceable, newest-first feed pagination is stable and the revision cap preserves originals',async()=>{
 const author=human(),started=new Date(Date.now()-31*86400000-10_000).toISOString(),first=(await write(author,publication(),started)).item;let previous=first;
 for(let revision=2;revision<=32;revision++){
  const id=uid(),requestId=uid(),createdAt=new Date(Date.parse(started)+(revision-1)*86400000).toISOString(),{record,payload}=model.boundedStrategyRecord({...first.record,id,revision,requestId,createdAt,content:{...first.record.content,relation:relation(previous,'REVISION')}}),command=publication({...record.content,id,requestId});
  const digest=await model.strategyDigest(payload);await db.prepare('INSERT INTO strategy_publications(id,root_id,revision,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,first.rootId,revision,'HUMAN:'+first.author.id,first.author.sponsorId,requestId,await model.strategyDigest(model.boundedStrategyCommand(command).payload),payload,digest,createdAt).run();previous={...previous,id,revision,requestId,createdAt,digest,record};
 }
 const history=await repo().history(first.rootId);assert.equal(history.items.length,32);assert.equal(history.items[0].revision,32);assert.deepEqual(history.items.at(-1),first);
 await assert.rejects(()=>write(author,publication({relation:relation(previous,'REVISION')})),status(409));assert.equal(await count('strategy_publications'),32);
 const collected=[];let cursor=null;do{const page=await repo().list(cursor);collected.push(...page.items);cursor=page.nextCursor;}while(cursor);assert.equal(collected.length,32);assert.equal(new Set(collected.map(item=>item.id)).size,32);assert.deepEqual(collected.map(item=>item.id),history.items.map(item=>item.id));
 await assert.rejects(()=>repo().list(uid()),status(404));await assert.rejects(()=>repo().list('invalid'),status(400));
});

test('global retained private report capacity arbitrates the final slot without exposing private details publicly',async()=>{
 const reporter=human(),target=(await write(human())).item,initial=report(target);await write(reporter,initial);const base=await db.prepare('SELECT * FROM strategy_reports WHERE request_id=?').bind(initial.requestId).first(),parsed=JSON.parse(base.payload),inserts=[];
 for(let n=0;n<998;n++){const sponsorId='human_'+await model.strategyDigest('report-fixture'+n),requestId=uid(),privateReport={...parsed,requestId,reporter:{kind:'HUMAN',id:sponsorId,sponsorId}},payload=JSON.stringify(privateReport),command={...initial,requestId};inserts.push(db.prepare('INSERT INTO strategy_reports(author_key,request_id,sponsor_key,record_id,record_digest,command_digest,payload,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('HUMAN:'+sponsorId,requestId,sponsorId,target.id,target.digest,await model.strategyDigest(model.boundedStrategyCommand(command).payload),payload,await model.strategyDigest(payload),privateReport.createdAt));}
 for(let n=0;n<inserts.length;n+=50)await db.batch(inserts.slice(n,n+50));assert.equal(await count('strategy_reports'),999);
 const results=await Promise.allSettled([write(human(),report(target)),write(human(),report(target))]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const failure=results.find(result=>result.status==='rejected').reason;assert.equal(failure.status,429);assert.equal(failure.retryAfterSeconds,undefined);assert.equal(await count('strategy_reports'),1000);
 assert.equal((await write(reporter,initial)).report.requestId,initial.requestId);assert(!JSON.stringify(await repo().get(target.id)).includes(parsed.details));assert.equal((await repo().reports(human(true),at())).reports.length,20);
});

test('cross-action publication and private-report races cannot reuse one author’s operation identity',async()=>{
 const author=human(),target=(await write(author)).item,requestId=uid(),commands=[publication({requestId}),{...report(target),requestId}],results=await Promise.allSettled(commands.map(command=>write(author,command)));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===409).length,1);
 const publicationCount=(await db.prepare('SELECT COUNT(*) AS n FROM strategy_publications WHERE request_id=?').bind(requestId).first()).n,reportCount=(await db.prepare('SELECT COUNT(*) AS n FROM strategy_reports WHERE request_id=?').bind(requestId).first()).n;assert.equal(publicationCount+reportCount,1);
 const accepted=results.findIndex(result=>result.status==='fulfilled');assert.deepEqual(await write(author,commands[accepted]),results[accepted].value);
});


test('moderator-only digest cursors expose every retained report across stable equal-clock pages',async()=>{
 const time=at(),moderator=human(true),sharedRequest=uid(),targets=[];
 for(let n=0;n<43;n++){
  const target=(await write(human(),publication(),time)).item;targets.push(target.id);
  await write(human(),{...report(target),requestId:n<2?sharedRequest:uid()},time);
 }
 const expected=(await db.prepare('SELECT * FROM strategy_reports ORDER BY created_at DESC,author_key DESC,request_id DESC').all()).results;
 const collected=[],sizes=[];let cursor=null;
 do{
  const page=await repo().reports(moderator,time,cursor);model.strategyReportsSchema.parse(page);sizes.push(page.reports.length);collected.push(...page.reports);
  if(page.nextCursor)assert.equal(page.nextCursor,await model.strategyDigest(JSON.stringify(page.reports.at(-1))));cursor=page.nextCursor;
 }while(cursor);
 assert.deepEqual(sizes,[20,20,3]);assert.equal(new Set(collected.map(value=>value.id)).size,43);assert.deepEqual(collected.map(value=>value.id),expected.map(value=>value.record_id));assert.deepEqual(new Set(collected.map(value=>value.id)),new Set(targets));
 assert.equal(collected.filter(value=>value.requestId===sharedRequest).length,2);assert.equal(await count('strategy_reports'),43);
 const a=await agent(human(),'Pagination fixture agent',time),first=await repo().reports(moderator,time);let queries=0;
 const guarded=new StrategyRepository({prepare(){queries++;throw Error('Unauthorized private queue query.');}});
 for(const actor of [human(),{...moderator,moderator:false},a.actor])await assert.rejects(()=>guarded.reports(actor,time,first.nextCursor),status(403));assert.equal(queries,0);
 for(const value of ['',uid(),'f'.repeat(63),'F'.repeat(64),42,{}])await assert.rejects(()=>repo().reports(moderator,time,value),status(400));
 await assert.rejects(()=>repo().reports(moderator,time,'0'.repeat(64)),status(404));assert.equal((await repo().reports(moderator,time,null)).reports.length,20);
 const publicView=JSON.stringify(await repo().get(targets[0]));assert(!publicView.includes('Private report evidence'));assert(!publicView.includes(first.nextCursor));
});

test('report digest anchors hold corrupt or ambiguous retained material without exposing details or repairing bytes',async()=>{
 const moderator=human(true),time=at(),first=(await write(human(),publication(),time)).item,second=(await write(human(),publication(),time)).item;
 const one=report(first),two=report(second);await write(human(),one,time);await write(human(),two,time);
 const original=(await db.prepare('SELECT * FROM strategy_reports ORDER BY request_id').all()).results,[a,b]=original;
 await db.prepare('UPDATE strategy_reports SET digest=? WHERE author_key=? AND request_id=?').bind(a.digest,b.author_key,b.request_id).run();
 await assert.rejects(()=>repo().reports(moderator,time,a.digest),status(503));await assert.rejects(()=>repo().reports(moderator,time),status(503));
 assert.equal((await db.prepare('SELECT digest FROM strategy_reports WHERE author_key=? AND request_id=?').bind(b.author_key,b.request_id).first()).digest,a.digest);
 await db.prepare('UPDATE strategy_reports SET digest=? WHERE author_key=? AND request_id=?').bind(b.digest,b.author_key,b.request_id).run();
 await db.prepare('UPDATE strategy_reports SET payload=? WHERE author_key=? AND request_id=?').bind('{}',a.author_key,a.request_id).run();
 await assert.rejects(()=>repo().reports(moderator,time,a.digest),status(503));assert.equal((await db.prepare('SELECT payload FROM strategy_reports WHERE author_key=? AND request_id=?').bind(a.author_key,a.request_id).first()).payload,'{}');
 assert.equal(await count('strategy_reports'),2);
});
