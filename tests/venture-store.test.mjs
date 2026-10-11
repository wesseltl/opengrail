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
const model=load('app/research-model.ts'),ventureModel=load('app/venture-model.ts'),{ResearchRepository}=load('app/research-store.ts'),http=load('app/research-http.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const uid=()=>crypto.randomUUID(),at=new Date(Date.now()-10_000).toISOString(),day=at.slice(0,10),policyAccepted='public-research-v1',human=(moderator=false)=>({kind:'HUMAN',userId:uid(),moderator});
const generic=(extra={})=>({action:'publish',requestId:uid(),id:uid(),kind:'HYPOTHESIS',title:'Synthetic venture hypothesis',statement:'Evaluate a synthetic issuer using explicit unknowns and contrary evidence.',assumptions:'No source classification or access claim is independently verified.',falsification:'Reject if customers or investor eligibility cannot be independently established.',sources:[],relation:null,policyAccepted,...extra});
function dossier(){const value=ventureModel.blankVentureDossier(day);value.issuer={name:'Synthetic issuer',website:'https://issuer.example.test',kind:'COMPANY',sector:'AI',stage:'PRE_SEED'};value.risks=['No independently verified demand'];value.nextCatalyst={event:'Await independent customer evidence',date:null};return value;}
const venture=(extra={})=>({version:2,...generic(),domain:'VENTURE',venture:dossier(),...extra});
const source={url:'https://issuer.example.test/product',classification:'PRIMARY',note:'Synthetic reference; no remote source was fetched.'};
const reported=(extra={})=>({state:'REPORTED',value:'Synthetic software',classification:'REPORTED_FACT',asOf:day,sourceIndices:[0],...extra});
const ref=item=>({id:item.id,digest:item.digest}),relation=(item,type)=>({...ref(item),type});
const moderation=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted});
const withdrawal=(item,reason='AUTHOR_REQUEST')=>({action:'withdraw',requestId:uid(),...ref(item),reason,policyAccepted});
const status=code=>error=>error instanceof model.ResearchError&&error.status===code;
let mf,db;
before(async()=>{
 const code=`import * as h from './app/research-http';import {ResearchRepository} from './app/research-store';import {NetworkRepository} from './app/network-store';export default{fetch(request,env){const userId=request.headers.get('X-Fixture-Actor'),actor=userId?{userId}:null,factory=()=>new ResearchRepository(env.DB),moderator=id=>id==='fixture-maintainer',now=()=>env.FIXTURE_AT;if(new URL(request.url).pathname==='/api/research/agent')return h.researchAgentRequest(request,factory,()=>new NetworkRepository(env.DB),now);return request.method==='GET'?h.researchPublicRequest(request,factory):h.researchHumanRequest(request,actor,factory,moderator,now);}};`;
 const bundled=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{FIXTURE_AT:at}});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['research_reports','research_moderation','research_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>await mf.dispose());
const repo=()=>new ResearchRepository(db),write=(actor,command=venture(),time=at)=>repo().write(actor,command,time);
async function agent(sponsor){const key=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:key.credentialId,name:'Synthetic venture agent',tokenDigest:key.tokenDigest,days:7};await new NetworkRepository(db).write(sponsor.userId,command,at);return {token:key.token,command,actor:{kind:'AGENT',principal:await new NetworkRepository(db).authenticate(key.token,at)}};}
async function count(table='research_publications'){return (await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;}
function wrapped(beforeRun,afterRun){return {prepare(sql){const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},first:(...args)=>statement.first(...args),all:()=>statement.all(),async run(){await beforeRun?.(sql);const result=await statement.run();await afterRun?.(sql);return result;}});return wrap(db.prepare(sql));}};}
const headers=actor=>({'X-Fixture-Actor':actor.userId,Origin:'https://venture.test','Content-Type':'application/json','X-Research-Intent':'submit'});
const post=(actor,command,extra={})=>mf.dispatchFetch('https://venture.test/api/research',{method:'POST',headers:{...headers(actor),...extra},body:JSON.stringify(command)});
const get=query=>mf.dispatchFetch('https://venture.test/api/research'+(query??''));
const machine=(token,command)=>mf.dispatchFetch('https://venture.test/api/research/agent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});

test('v2 venture publication roundtrips human and sponsored agent dossiers without promoting evidence or access',async()=>{
 const sponsor=human(),contributor=await agent(sponsor),commands=[venture(),venture()],actors=[sponsor,contributor.actor];
 for(let n=0;n<2;n++){
  const result=await write(actors[n],commands[n]),item=result.item;assert.equal(item.record.version,2);assert.equal(item.record.content.domain,'VENTURE');assert.deepEqual(item.record.content.venture,commands[n].venture);assert.equal(item.record.verification,'UNVERIFIED');assert.equal(item.record.executionEnabled,false);assert.equal(item.digest,await model.researchDigest(JSON.stringify(item.record)));assert.deepEqual(await write(actors[n],commands[n]),result);assert.deepEqual((await repo().get(item.id)).item,item);
  const row=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(item.id).first();assert.equal(row.payload,JSON.stringify(item.record));assert.equal(row.command_digest,await model.researchDigest(model.boundedResearchCommand(commands[n]).payload));assert(!JSON.stringify(result).includes(sponsor.userId));assert(!JSON.stringify(result).includes(contributor.token));
 }
 const page=await repo().ventures();assert.equal(page.domain,'VENTURE');assert.equal(page.items.length,2);assert.equal(page.executionEnabled,false);assert.equal(new Set(page.items.map(item=>item.author.sponsorId)).size,1);assert.equal(new Set(page.items.map(item=>item.author.kind)).size,2);
});

test('v1 canonical command and record bytes remain exact beside v2 venture records',async()=>{
 const owner=human(),command=generic(),item=(await write(owner,command)).item,content={kind:command.kind,title:command.title,statement:command.statement,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,relation:command.relation};
 const expectedCommand=JSON.stringify({action:'publish',requestId:command.requestId,id:command.id,...content,policyAccepted}),expectedRecord=JSON.stringify({version:1,id:command.id,rootId:command.id,revision:1,requestId:command.requestId,createdAt:at,author:item.record.author,content,policyAccepted,verification:'UNVERIFIED',executionEnabled:false});
 const row=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(item.id).first();assert.equal(model.boundedResearchCommand(command).payload,expectedCommand);assert.equal(row.payload,expectedRecord);assert.equal(row.digest,await model.researchDigest(expectedRecord));assert.equal(row.command_digest,await model.researchDigest(expectedCommand));assert.equal(model.researchPublicationVersion(command),1);assert.equal(model.boundedResearchCommand(model.researchPublishCommandForRecord(item.record)).payload,expectedCommand);
 const newer=(await write(owner,venture())).item;assert.equal((await repo().list()).items.length,2);assert.deepEqual((await repo().get(item.id)).item,item);assert.deepEqual((await repo().ventures()).items.map(value=>value.id),[newer.id]);assert.equal((await repo().history(item.id)).items[0].record.version,1);
});

test('venture revisions preserve the domain while independent cross-domain forks and challenges retain exact parents',async()=>{
 const owner=human(),legacy=(await write(owner,generic())).item,original=(await write(owner,venture())).item;
 await assert.rejects(()=>write(owner,venture({relation:relation(legacy,'REVISION')})),status(409));await assert.rejects(()=>write(owner,generic({relation:relation(original,'REVISION')})),status(409));
 const revision=(await write(owner,venture({relation:relation(original,'REVISION')}))).item;assert.equal(revision.rootId,original.rootId);assert.equal(revision.revision,2);assert.equal(revision.record.version,2);assert.deepEqual((await repo().history(original.id)).items.map(value=>value.id),[revision.id,original.id]);await assert.rejects(()=>write(owner,venture({relation:relation(original,'REVISION')})),status(409));
 const fork=(await write(human(),venture({relation:relation(legacy,'FORK')}))).item,challenge=(await write(human(),generic({kind:'CHALLENGE',relation:relation(original,'CHALLENGE')}))).item;assert.equal(fork.record.version,2);assert.equal(challenge.record.version,1);assert.equal(fork.rootId,fork.id);assert.equal(challenge.rootId,challenge.id);assert.equal((await repo().get(original.id)).item.digest,original.digest);assert.deepEqual(new Set((await repo().thread(original.id,original.digest)).items.map(value=>value.id)),new Set([revision.id,challenge.id]));
});

test('canonical rows with an impossible cross-domain revision are held by history and discussion readers',async()=>{
 const owner=human(),original=(await write(owner,venture())).item,revision=(await write(owner,venture({relation:relation(original,'REVISION')}))).item;
 const content={kind:revision.record.content.kind,title:revision.record.content.title,statement:revision.record.content.statement,assumptions:revision.record.content.assumptions,falsification:revision.record.content.falsification,sources:revision.record.content.sources,relation:revision.record.content.relation},changed={...revision.record,version:1,content},checked=model.boundedResearchRecord(changed),command=model.boundedResearchCommand(model.researchPublishCommandForRecord(checked.record));
 await db.prepare('UPDATE research_publications SET payload=?,digest=?,command_digest=? WHERE id=?').bind(checked.payload,await model.researchDigest(checked.payload),await model.researchDigest(command.payload),revision.id).run();assert.equal((await repo().get(revision.id)).item.record.version,1);await assert.rejects(()=>repo().history(original.id),status(503));await assert.rejects(()=>repo().thread(original.id,original.digest),status(503));await assert.rejects(()=>repo().thread(original.id,original.digest,revision.id),status(503));assert.equal((await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(revision.id).first()).payload,checked.payload);
});

test('venture source references and factual dates are checked against the authoritative publication day',async()=>{
 const owner=human(),command=venture({sources:[source]});command.venture.product=reported();command.venture.terms.minimumTicket={state:'REPORTED',amount:500,currency:'EUR',classification:'FOUNDER_CLAIM',asOf:day,sourceIndices:[0]};const accepted=(await write(owner,command)).item;assert.equal(accepted.record.content.venture.terms.minimumTicket.amount,500);
 const invalidReference=venture({sources:[source]});invalidReference.venture.product=reported({sourceIndices:[1]});await assert.rejects(()=>write(owner,invalidReference),status(400));
 const future=venture({sources:[source]});future.venture.product=reported({asOf:new Date(Date.parse(at)+86400000).toISOString().slice(0,10)});await assert.rejects(()=>write(owner,future),status(400));
 const observedTooLate=venture({sources:[source]});observedTooLate.venture.product=reported();await assert.rejects(()=>write(owner,observedTooLate,new Date(Date.parse(at)-86400000).toISOString()),status(400));assert.equal(await count(),1);assert.deepEqual(await write(owner,command,new Date(Date.parse(at)+86400000).toISOString()),{version:1,action:'publish',requestId:command.requestId,item:accepted,report:null,executionEnabled:false});
});

test('venture publication fences revoked credentials before insertion and never returns an unauthorized retry',async()=>{
 const sponsor=human(),contributor=await agent(sponsor),command=venture();let reached=false;
 const racing=new ResearchRepository(wrapped(async sql=>{if(sql.startsWith('INSERT INTO research_publications')&&!reached){reached=true;await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:contributor.command.id,revision:1},at);}}));
 await assert.rejects(()=>racing.write(contributor.actor,command,at),status(401));assert.equal(reached,true);assert.equal(await count(),0);await assert.rejects(()=>write(contributor.actor,command),status(401));
 const fresh=await agent(sponsor),accepted=venture();await write(fresh.actor,accepted);await new NetworkRepository(db).write(sponsor.userId,{action:'revoke',requestId:uid(),id:fresh.command.id,revision:1},at);await assert.rejects(()=>write(fresh.actor,accepted),status(401));assert.equal(await count(),1);
});

test('generic and venture publications share the existing atomic sponsor-day quota across sibling agents',async()=>{
 const sponsor=human(),a=await agent(sponsor),b=await agent(sponsor);for(let n=0;n<19;n++)await write(sponsor,generic());
 const commands=[venture(),venture(),venture()],results=await Promise.allSettled(commands.map((command,n)=>write([sponsor,a.actor,b.actor][n],command)));assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===429).length,2);assert.equal(await count(),20);assert.equal((await repo().ventures()).items.length,1);const index=results.findIndex(result=>result.status==='fulfilled');assert.deepEqual(await write([sponsor,a.actor,b.actor][index],commands[index]),results[index].value);assert.equal(await count(),20);
});

test('venture-only pagination includes all retained equal-clock entries and current tombstones',async()=>{
 const entries=[];for(let n=0;n<43;n++){const owner=human(),command=venture();command.venture.issuer.name='Synthetic issuer '+n;entries.push({owner,item:(await write(owner,command)).item});}
 const legacy=(await write(human(),generic())).item,hidden=entries[5],withdrawn=entries[32];await write(human(true),moderation(hidden.item));await write(withdrawn.owner,withdrawal(withdrawn.item));
 const expected=entries.map(entry=>entry.item).sort((a,b)=>b.id.localeCompare(a.id)),collected=[],sizes=[];let cursor=null;
 do{const page=await repo().ventures(cursor);model.researchVentureListSchema.parse(page);sizes.push(page.items.length);collected.push(...page.items);if(page.nextCursor)assert.equal(page.nextCursor,page.items.at(-1).id);cursor=page.nextCursor;}while(cursor);
 assert.deepEqual(sizes,[20,20,3]);assert.deepEqual(collected.map(item=>item.id),expected.map(item=>item.id));assert.equal(new Set(collected.map(item=>item.id)).size,43);assert(!collected.some(item=>item.id===legacy.id));assert.equal(collected.find(item=>item.id===hidden.item.id).record,null);assert.equal(collected.find(item=>item.id===withdrawn.item.id).record,null);assert(!JSON.stringify(collected).includes('Synthetic issuer 5"'));assert(!JSON.stringify(collected).includes('Synthetic issuer 32"'));
 await assert.rejects(()=>repo().ventures(legacy.id),status(404));await assert.rejects(()=>repo().ventures(uid()),status(404));for(const bad of ['',{},'invalid',legacy.id.toUpperCase()])await assert.rejects(()=>repo().ventures(bad),status(400));assert.equal((await repo().ventures(hidden.item.id)).items.some(item=>item.id===hidden.item.id),false);
});

test('venture discovery validates hidden anchors and the lookahead record without repairing corrupt bytes',async()=>{
 const entries=[];for(let n=0;n<21;n++)entries.push((await write(human(),venture())).item);const expected=entries.sort((a,b)=>b.id.localeCompare(a.id)),lookahead=expected.at(-1),stored=await db.prepare('SELECT * FROM research_publications WHERE id=?').bind(lookahead.id).first();
 await write(human(true),moderation(lookahead));await db.prepare('UPDATE research_publications SET command_digest=? WHERE id=?').bind('0'.repeat(64),lookahead.id).run();await assert.rejects(()=>repo().ventures(),status(503));await assert.rejects(()=>repo().ventures(lookahead.id),status(503));assert.equal((await db.prepare('SELECT command_digest FROM research_publications WHERE id=?').bind(lookahead.id).first()).command_digest,'0'.repeat(64));
 await db.prepare('UPDATE research_publications SET command_digest=? WHERE id=?').bind(stored.command_digest,lookahead.id).run();await db.prepare('UPDATE research_publications SET payload=? WHERE id=?').bind(' '+stored.payload,lookahead.id).run();await assert.rejects(()=>repo().ventures(),status(503));await assert.rejects(()=>repo().ventures(lookahead.id),status(503));assert.equal((await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(lookahead.id).first()).payload,' '+stored.payload);
 await db.prepare('UPDATE research_publications SET payload=? WHERE id=?').bind('{malformed retained json',lookahead.id).run();await assert.rejects(()=>repo().ventures(),status(503));assert.equal((await db.prepare('SELECT payload FROM research_publications WHERE id=?').bind(lookahead.id).first()).payload,'{malformed retained json');
});

test('uncertain v2 acknowledgments reconcile exact commands and current tombstones while reports remain private',async()=>{
 const sponsor=human(),contributor=await agent(sponsor),command=venture({sources:[source],title:'Remove dossier title'});command.venture.issuer.name='Remove issuer identity';let lost=false;
 const uncertain=new ResearchRepository(wrapped(null,sql=>{if(sql.startsWith('INSERT INTO research_publications')&&!lost){lost=true;throw Error('Synthetic lost acknowledgment.');}})),accepted=await uncertain.write(contributor.actor,command,at);assert.equal(lost,true);assert.equal(await count(),1);assert.deepEqual(await write(contributor.actor,command),accepted);await assert.rejects(()=>write(contributor.actor,{...command,title:'Changed v2 retry'}),status(409));
 const report={action:'report',requestId:uid(),...ref(accepted.item),reason:'MISLEADING',details:'Private synthetic venture report details',policyAccepted};await write(human(),report);await write(human(true),moderation(accepted.item));
 for(const body of [await repo().ventures(),await repo().get(command.id),await repo().history(command.id),await repo().thread(command.id,accepted.item.digest),await write(contributor.actor,command)]){const raw=JSON.stringify(body);for(const secret of ['Remove dossier title','Remove issuer identity','issuer.example.test/product','Synthetic venture agent','Private synthetic venture report details'])assert(!raw.includes(secret));}
 assert.equal((await repo().reports(human(true),at)).reports[0].details,report.details);await write(sponsor,withdrawal(accepted.item,'SPONSOR_REQUEST'));const retry=await write(contributor.actor,command);assert.equal(retry.item.state,'WITHDRAWN');assert.equal(retry.item.record,null);assert.equal(await count(),1);assert.equal(await count('research_reports'),1);
});

test('actual venture HTTP routes retain version-two commands, human account binding and machine attribution',async()=>{
 const owner=human(),command=venture({sources:[source]});command.venture.product=reported();const expected=await model.researchPublicHumanId(owner.userId),response=await post(owner,command,{'X-Research-Author':expected});assert.equal(response.status,200);const good=await response.json();assert.equal(good.item.record.version,2);assert.equal(good.item.record.content.venture.product.value,'Synthetic software');assert.deepEqual(await (await post(owner,command,{'X-Research-Author':expected})).json(),good);
 const list=await get('?domain=VENTURE');assert.equal(list.status,200);assert.equal(list.headers.get('Cache-Control'),'private, no-store');assert.equal((await list.json()).items[0].id,command.id);
 const other=human(),swapped=venture();assert.equal((await post(other,swapped,{'X-Research-Author':expected})).status,403);assert.equal((await get('?id='+swapped.id)).status,404);
 const contributor=await agent(owner),machineCommand=venture();const machineResponse=await machine(contributor.token,machineCommand);assert.equal(machineResponse.status,200);const attributed=(await machineResponse.json()).item;assert.equal(attributed.record.version,2);assert.equal(attributed.author.kind,'AGENT');assert.equal(attributed.author.sponsorId,expected);assert(!JSON.stringify(attributed).includes(contributor.token));
});

test('venture HTTP rejects invalid source, date, money, score and crypto claims while allowing anticipated catalysts',async()=>{
 const owner=human();for(const patch of [{author:{kind:'HUMAN',id:uid()}},{verified:true},{verification:'REPRODUCED'},{executionEnabled:true},{score:100},{version:1},{domain:'OTHER'}])assert.equal((await post(owner,{...venture(),...patch})).status,400);
 const badReference=venture({sources:[source]});badReference.venture.product=reported({sourceIndices:[1]});assert.equal((await post(owner,badReference)).status,400);const tomorrow=new Date(Date.parse(at)+86400000).toISOString().slice(0,10),future=venture({sources:[source]});future.venture.product=reported({asOf:tomorrow});assert.equal((await post(owner,future)).status,400);
 const futureReview=venture();futureReview.venture.asOf=tomorrow;assert.equal(model.researchCommandSchema.safeParse(futureReview).success,true);assert.equal((await post(owner,futureReview)).status,400);
 const badMoney=venture({sources:[source]});badMoney.venture.terms.minimumTicket={state:'REPORTED',amount:-1,currency:'EUR',classification:'FOUNDER_CLAIM',asOf:day,sourceIndices:[0]};assert.equal((await post(owner,badMoney)).status,400);
 const badScore=venture();badScore.venture.scoring.components.valuation=1;assert.equal((await post(owner,badScore)).status,400);const badCrypto=venture();badCrypto.venture.issuer.kind='TOKEN';assert.equal((await post(owner,badCrypto)).status,400);assert.equal(await count(),0);
 const catalyst=venture();catalyst.venture.nextCatalyst.date=tomorrow;assert.equal((await post(owner,catalyst)).status,200);assert.equal(await count(),1);
});

test('venture HTTP accepts only its strict domain query and rejects missing or unrelated cursors',async()=>{
 let calls=0;for(const query of ['?domain=venture','?domain=OTHER','?domain=VENTURE&domain=VENTURE','?domain=VENTURE&cursor='+uid()+'&cursor='+uid(),'?domain=VENTURE&id='+uid(),'?domain=VENTURE&root='+uid(),'?domain=VENTURE&target='+uid()+'&digest='+'a'.repeat(64),'?domain=VENTURE&extra=never-echo','?domain=VENTURE&cursor=','?domain=VENTURE&cursor=bad','?domain=VENTURE&cursor='+uid().toUpperCase()]){const response=await http.researchPublicRequest(new Request('https://venture.test/api/research'+query),()=>{calls++;throw Error();});assert.equal(response.status,400);assert(!(await response.text()).includes('never-echo'));}assert.equal(calls,0);
 const legacy=(await write(human(),generic())).item;assert.equal((await get('?domain=VENTURE&cursor='+legacy.id)).status,404);assert.equal((await get('?domain=VENTURE&cursor='+uid())).status,404);const empty=await get('?domain=VENTURE');assert.equal(empty.status,200);assert.deepEqual((await empty.json()).items,[]);
});

test('venture HTTP rejects a forged v1 receipt that drops the dossier and other otherwise canonical mismatches',async()=>{
 const owner=human(),command=venture(),good=await write(owner,command),request=()=>new Request('https://venture.test/api/research',{method:'POST',headers:headers(owner),body:JSON.stringify(command)}),content={kind:command.kind,title:command.title,statement:command.statement,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,relation:command.relation},oldRecord={...good.item.record,version:1,content},oldItem={...good.item,record:oldRecord,digest:await model.researchDigest(JSON.stringify(oldRecord))};
 const changedRecord=structuredClone(good.item.record);changedRecord.content.venture.issuer.name='Different synthetic issuer';const changedItem={...good.item,record:changedRecord,digest:await model.researchDigest(JSON.stringify(changedRecord))};
 for(const item of [oldItem,changedItem,{...good.item,digest:'0'.repeat(64)}])assert.equal((await http.researchHumanRequest(request(),{userId:owner.userId},()=>({write:async()=>({...good,item})}),()=>false,()=>at)).status,503);
 const legacy=(await write(human(),generic())).item;for(const result of [{version:1,domain:'VENTURE',items:[legacy],nextCursor:null,executionEnabled:false},{version:1,domain:'VENTURE',items:[good.item,good.item],nextCursor:null,executionEnabled:false},{version:1,domain:'VENTURE',items:[good.item],nextCursor:uid(),executionEnabled:false}])assert.equal((await http.researchPublicRequest(new Request('https://venture.test/api/research?domain=VENTURE'),()=>({ventures:async()=>result}))).status,503);
});

test('venture HTTP correlates page order against the exact requested cursor',async()=>{
 const items=[];for(let n=0;n<23;n++)items.push((await write(human(),venture())).item);const first=await repo().ventures(),cursor=first.nextCursor,second=await repo().ventures(cursor),request=()=>new Request('https://venture.test/api/research?domain=VENTURE&cursor='+cursor);
 const response=await get('?domain=VENTURE&cursor='+cursor);assert.equal(response.status,200);assert.deepEqual((await response.json()).items.map(item=>item.id),second.items.map(item=>item.id));assert.equal(second.items.length,3);
 assert.equal((await http.researchPublicRequest(request(),()=>({ventures:async()=>first,get:id=>repo().get(id)}))).status,503);const legacy=(await write(human(),generic())).item;assert.equal((await http.researchPublicRequest(request(),()=>({ventures:async()=>second,get:async()=>({version:1,item:legacy,executionEnabled:false})}))).status,503);
});
