import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=id=>id.startsWith('.')?load(resolve(dirname(file),/\.(?:ts|mjs)$/.test(id)?id:id+'.ts')):native(id);new Function('module','exports','require',code)(m,m.exports,req);return m.exports;}
const model=load('app/experiment-model.ts'),http=load('app/experiment-http.ts'),demo=load('app/demo-model.ts'),{syntheticDemoInput,replayDemo}=load('app/demo-engine.ts'),strategy=load('app/strategy-model.ts'),{StrategyRepository}=load('app/strategy-store.ts'),{ExperimentRepository}=load('app/experiment-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const sessionJournal=load('app/session-journal.ts'),sessionEvidence=load('app/session-evidence.ts'),{syntheticSessionExample}=load('app/session-example.ts');
const uid=()=>crypto.randomUUID(),at=new Date(Date.now()-3000).toISOString(),policyAccepted='public-experiment-v1',origin='https://experiments.test';
const source=`import * as h from './app/experiment-http';import {NetworkRepository} from './app/network-store';import {ExperimentRepository} from './app/experiment-store';import {researchModeratorAllowed} from './app/research-moderation';
export default {fetch(request,env){const path=new URL(request.url).pathname,user=request.headers.get('X-Fixture-Actor'),actor=user?{userId:user}:null,factory=()=>new ExperimentRepository(env.DB),moderator=id=>researchModeratorAllowed(id,env.FIXTURE_MODERATORS),now=()=>env.FIXTURE_AT;
if(path==='/api/experiments/me')return h.experimentMeRequest(request,actor,moderator);
if(path==='/api/experiments/reports')return h.experimentReportsRequest(request,actor,factory,moderator,now);
if(path==='/api/experiments/agent')return h.experimentAgentRequest(request,factory,()=>new NetworkRepository(env.DB),now);
return request.method==='GET'?h.experimentPublicRequest(request,factory):h.experimentHumanRequest(request,actor,factory,moderator,now);}};`;
let mf,db;
before(async()=>{const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at,FIXTURE_MODERATORS:'["fixture-maintainer"]'}});db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(v=>v.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
after(async()=>await mf?.dispose());
const human=id=>({kind:'HUMAN',userId:id,moderator:false}),factory=()=>new ExperimentRepository(db),headers=id=>({'X-Fixture-Actor':id,Origin:origin,'Content-Type':'application/json','X-Experiment-Intent':'submit'});
const post=(id,raw,extra={})=>mf.dispatchFetch(origin+'/api/experiments',{method:'POST',headers:{...headers(id),...extra},body:typeof raw==='string'?raw:JSON.stringify(raw)});
const get=query=>mf.dispatchFetch(origin+'/api/experiments'+(query??''));
const machine=(token,raw,extra={})=>mf.dispatchFetch(origin+'/api/experiments/agent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(raw)});
async function agent(owner){const key=await createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:key.credentialId,name:'Registry fixture agent',tokenDigest:key.tokenDigest,days:7};await new NetworkRepository(db).write(owner,command,at);return {...key,command};}
async function fixture(type='DCA',owner=uid()){
 const published=await new StrategyRepository(db).write(human(owner),{action:'publish',requestId:uid(),id:uid(),name:'Synthetic registered source',description:'Offline data, no commercial signal feed.',assumptions:'Fees and time boundaries are explicit.',falsification:'Reject unsupported out-of-sample inference.',sources:[],relation:null,definition:strategy.strategyTemplate(type),policyAccepted:'public-strategy-v1'},at);
 const input=await syntheticDemoInput({record:published.item.record,digest:published.item.digest});
 const command={action:'register',requestId:uid(),id:uid(),name:'Exact synthetic experiment',input,evaluator:{version:'opengrail-demo-v1',sourceVersion:'84a1a668ef160bc3c9c4e0596a514b5d15e6dd49',sourceDigest:'cbc31d441c12a8c3652ddbb1873e9160b574316968889805cdc57aed04597e51',methodDigest:await strategy.strategyDigest(JSON.stringify(demo.demoEvaluatorMethod))},baseline:'COST_AWARE_LONG_SAME_ALLOCATION_V1',disclosures:{search:{trialCount:1,selection:'FIRST_DECLARED',logCompleteness:'COMPLETE',log:'This sole synthetic fixture is not a market experiment.'},validation:{trainEvaluationOverlap:'NONE',holdoutDeclared:true,holdoutPriorAccess:'UNSEEN',holdoutReuseCount:0,note:'An author declaration, not proof of unseen input.'},transformations:[],seeds:[],conflicts:{sharedDependencies:[],other:'No independence claim.'},publication:{dataRights:true,publicData:true,publicArtifact:true}},policyAccepted};
 return {owner,source:published.item,input,command};
}
async function registered(type='DCA',owner=uid()){const f=await fixture(type,owner),response=await post(owner,f.command);assert.equal(response.status,200,await response.clone().text());return {...f,item:(await response.json()).item};}
const reference=item=>({id:item.id,digest:item.digest});
const outcome=(item,artifact,patch={})=>({action:'outcome',requestId:uid(),id:uid(),name:'Retained synthetic result',manifest:reference(item),result:{kind:'ARTIFACT',artifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:'First reported attempt, not a verified reproduction.'},policyAccepted,...patch});
async function continuousFixture(type='DCA',owner=uid()){
 const f=await fixture(type,owner),example=await syntheticSessionExample(),config={...example.config,origin:'PUBLIC_STRATEGY',strategy:{record:f.source.record,digest:f.source.digest}};
 const start='2025-01-01T00:00:00.000Z',barAt='2025-01-01T01:00:00.000Z',quoteAt='2025-01-01T01:00:00.001Z';
 let journal=await sessionJournal.createSessionJournal(config,start);
 journal=await sessionJournal.appendSessionEvent(journal,{requestId:uid(),type:'CLOSED_BAR',bar:{closedAt:barAt,open:100,high:100,low:100,close:100,volume:1}},barAt);
 journal=await sessionJournal.appendSessionEvent(journal,{requestId:uid(),type:'QUOTE',observedAt:quoteAt,price:100},quoteAt);
 const bundle=await sessionEvidence.snapshotSessionEvidence(journal),command={action:'register',requestId:uid(),id:uid(),...model.experimentContinuousRegisterDefaults(bundle.input,'synthetic-http-fixture'),policyAccepted};
 return {...f,journal,bundle,command};
}
const continuousOutcome=(item,bundle,patch={})=>({...outcome(item,bundle.result.artifact,patch),method:'CONTINUOUS_DEMO'});

test('actual Worker handlers register exact attributable inputs and expose bounded summaries without artifacts',async()=>{
 const f=await registered(),response=await get('?id='+f.item.id);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization');
 const item=(await response.json()).item;assert.deepEqual(item,f.item);assert.deepEqual(item.record.content.input,f.input);assert.equal(item.reporting,'UNREPORTED');assert.equal(item.outcomeCount,0);assert.equal(item.record.classification,'AUTHOR_REPORTED');
 const feed=await (await get()).json(),summary=feed.items.find(v=>v.id===f.item.id);assert(summary);assert(!('record' in summary));assert(!JSON.stringify(feed).includes(f.owner));assert.equal(feed.executionEnabled,false);
 const me=await mf.dispatchFetch(origin+'/api/experiments/me',{headers:{'X-Fixture-Actor':f.owner}});assert.equal(me.status,200);const identity=await me.json();assert.equal(identity.authorId,await model.experimentPublicHumanId(f.owner));assert.equal(identity.moderator,false);
});

test('outcomes preserve adverse artifacts and explicit interruptions without replacing prior evidence',async()=>{
 const f=await registered(),artifact=await replayDemo(f.input),cmd=outcome(f.item,artifact),response=await post(f.owner,cmd);assert.equal(response.status,200,await response.clone().text());const first=(await response.json()).item;
 assert.deepEqual(first.record.content.result.artifact,artifact);assert.equal(first.record.classification,'AUTHOR_REPORTED');
 const interrupted=outcome(f.item,artifact,{name:'Interrupted independent attempt',result:{kind:'INTERRUPTED',reason:'Local evaluator process ended before producing an artifact.'}});
 assert.equal((await post(uid(),interrupted)).status,200);const page=await (await get('?outcomes='+f.item.id)).json();assert.equal(page.items.length,2);assert(page.items.every(v=>!('record' in v)));assert(page.items.some(v=>v.status==='INTERRUPTED'));
 assert.equal((await (await get('?id='+f.item.id)).json()).item.outcomeCount,2);assert.deepEqual((await (await get('?id='+first.id)).json()).item.record.content.result.artifact,artifact);
});

test('seven nested strategy families survive the actual depth-bounded HTTP parser',async()=>{
 for(const type of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']){
  const f=await registered(type),artifact=await replayDemo(f.input),response=await post(f.owner,outcome(f.item,artifact));assert.equal(response.status,200,type+' '+await response.clone().text());
  assert.equal((await response.json()).item.record.content.result.artifact.input.strategy.record.content.definition.entry.type,type);
 }
});

test('anonymous writes, forged authorship, self-qualification and foreign retries cannot create or borrow evidence',async()=>{
 const f=await fixture();let calls=0;
 assert.equal((await http.experimentHumanRequest(new Request(origin+'/api/experiments',{method:'POST'}),null,()=>{calls++;throw Error();},()=>false)).status,401);assert.equal(calls,0);
 for(const patch of [{author:{kind:'HUMAN',id:f.owner}},{sponsorId:f.owner},{classification:'REPRODUCED'},{verified:true},{moderator:true},{executionEnabled:true},{score:100},{reputation:9}])assert.equal((await post(f.owner,{...f.command,...patch})).status,400);
 const result=await post(f.owner,f.command);assert.equal(result.status,200);const body=await result.json();assert.deepEqual(await (await post(f.owner,f.command)).json(),body);assert.equal((await post(f.owner,{...f.command,name:'Changed registered material'})).status,409);assert.equal((await post(uid(),f.command)).status,409);
 const a=await agent(f.owner);assert.equal((await machine(a.token,f.command)).status,409);
});

test('related human and external-agent submissions remain distinct and visibly share sponsorship',async()=>{
 const owner=uid(),a=await agent(owner),b=await agent(owner),f=await fixture('DCA',owner),commands=[f.command,{...f.command,requestId:uid(),id:uid()}, {...f.command,requestId:uid(),id:uid()}];
 const responses=await Promise.all([post(owner,commands[0]),machine(a.token,commands[1]),machine(b.token,commands[2])]);for(const r of responses)assert.equal(r.status,200,await r.clone().text());
 const items=await Promise.all(responses.map(async r=>(await r.json()).item));assert.equal(new Set(items.map(x=>x.author.id)).size,3);assert.equal(new Set(items.map(x=>x.author.sponsorId)).size,1);
 for(const item of items){const raw=JSON.stringify(item);for(const secret of [owner,a.token,b.token,a.tokenDigest,b.tokenDigest,'ownerId','tokenDigest','registryDigest'])assert(!raw.includes(secret));}
});

test('origins, methods, credentials in URLs and conflicting query selectors fail before repository access',async()=>{
 const f=await fixture();
 for(const extra of [{Origin:'https://foreign.test'},{Origin:''},{'X-Experiment-Intent':''}])assert.equal((await post(f.owner,f.command,extra)).status,403);
 assert.equal((await post(f.owner,f.command,{'Content-Type':'text/plain'})).status,415);
 for(const query of ['?id=invalid','?id='+f.command.id+'&cursor='+uid(),'?outcomes='+uid()+'&id='+uid(),'?cursor='+uid()+'&cursor='+uid(),'?ownerId=private-owner','?outcomes='+uid()+'&token=secret'])assert.equal((await get(query)).status,400);
 let calls=0;assert.equal((await http.experimentPublicRequest(new Request(origin+'/api/experiments?token=never-echo'),()=>{calls++;throw Error();})).status,400);assert.equal(calls,0);
 assert.equal((await http.experimentPublicRequest(new Request(origin+'/api/experiments',{method:'POST'}),()=>{throw Error();})).headers.get('Allow'),'GET');
 assert.equal((await http.experimentAgentRequest(new Request('http://experiments.test/api/experiments/agent',{method:'POST'}),()=>{throw Error();},()=>{throw Error();})).status,403);
});

test('duplicate fields, invalid UTF8, byte overflow and known credentials never enter public records',async()=>{
 const f=await fixture();
 assert.equal((await post(f.owner,JSON.stringify(f.command).replace('"name":"Exact synthetic experiment"','"name":"one","name":"two"'))).status,400);
 assert.equal((await post(f.owner,' '.repeat(model.experimentLimits.requestBytes+1))).status,413);
 const request=new Request(origin+'/api/experiments',{method:'POST',headers:headers(f.owner),body:new Uint8Array([123,34,120,34,58,34,255,34,125])});assert.equal((await http.experimentHumanRequest(request,{userId:f.owner},factory,()=>false,()=>at)).status,400);
 const a=await agent(f.owner);
 for(const text of [a.token,encodeURIComponent(a.token)]){const r=await post(f.owner,{...f.command,name:text});assert.equal(r.status,400);assert(!(await r.text()).includes(a.token));}
 const reg=await post(f.owner,f.command);assert.equal(reg.status,200);const item=(await reg.json()).item,artifact=await replayDemo(f.input),tampered=structuredClone(artifact);
 tampered.audit[0].details=a.token; // Even self-hashed audit text is not trusted public content.
 tampered.resultDigest=await demo.demoArtifactDigest(tampered);
 const r=await post(f.owner,outcome(item,tampered));assert.equal(r.status,400);assert(!(await r.text()).includes(a.token));
});

test('changed input, method and declared baseline cannot be acknowledged as the registered artifact',async()=>{
 const f=await registered(),artifact=await replayDemo(f.input),changedInput=structuredClone(f.input);changedInput.initialCapital+=1;
 const mismatched=await replayDemo(changedInput);assert.equal((await post(f.owner,outcome(f.item,mismatched))).status,400);
 const invalidMethod={...f.command,requestId:uid(),id:uid(),evaluator:{...f.command.evaluator,methodDigest:'0'.repeat(64)}};assert.equal((await post(f.owner,invalidMethod)).status,400);
 assert.equal((await post(f.owner,{...f.command,requestId:uid(),id:uid(),baseline:'NO_COST_WINNER'})).status,400);
 const qualification={...outcome(f.item,artifact),claim:{type:'REPRODUCED',relation:null,sharedDependencies:[],conflicts:'Forged state.'}};assert.equal((await post(f.owner,qualification)).status,400);
});

test('hiding the source suppresses embedded input and artifacts across reads, pages and identical retries',async()=>{
 const f=await registered(),artifact=await replayDemo(f.input),command=outcome(f.item,artifact),receipt=await (await post(f.owner,command)).json();
 await new StrategyRepository(db).write({kind:'HUMAN',userId:'fixture-maintainer',moderator:true},{action:'moderate',requestId:uid(),id:f.source.id,digest:f.source.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'},at);
 for(const response of [await get('?id='+f.item.id),await get('?id='+receipt.item.id),await get('?outcomes='+f.item.id),await post(f.owner,f.command),await post(f.owner,command)]){
  assert.equal(response.status,200,await response.clone().text());const body=await response.json(),raw=JSON.stringify(body);assert(!raw.includes('Exact synthetic experiment'));assert(!raw.includes('Retained synthetic result'));assert(!raw.includes('"bars"'));assert(!raw.includes('"audit"'));
  if(body.item)assert.equal(body.item.record,null);
 }
});

test('private reports and moderator dispositions require explicit grants; withdrawn history cannot be revived',async()=>{
 const f=await registered(),report={action:'report',requestId:uid(),...reference(f.item),reason:'MISLEADING',details:'Synthetic private challenge details.',policyAccepted};
 const response=await post(uid(),report);assert.equal(response.status,200);assert(!(await response.text()).includes(report.details));
 assert.equal((await mf.dispatchFetch(origin+'/api/experiments/reports')).status,401);assert.equal((await mf.dispatchFetch(origin+'/api/experiments/reports',{headers:{'X-Fixture-Actor':f.owner}})).status,403);
 const queue=await mf.dispatchFetch(origin+'/api/experiments/reports',{headers:{'X-Fixture-Actor':'fixture-maintainer'}});assert.equal(queue.status,200);assert((await queue.text()).includes(report.details));
 const withdraw={action:'withdraw',requestId:uid(),...reference(f.item),reason:'AUTHOR_REQUEST',policyAccepted};assert.equal((await post(f.owner,withdraw)).status,200);
 const restore={action:'moderate',requestId:uid(),...reference(f.item),state:'VISIBLE',reason:'RESTORED',policyAccepted};assert.equal((await post('fixture-maintainer',restore)).status,409);
 assert.equal((await (await get('?id='+f.item.id)).json()).item.state,'WITHDRAWN');assert(!JSON.stringify(await (await post(f.owner,f.command)).json()).includes('Exact synthetic experiment'));
});

test('credential revocation after HTTP authentication fences registration and returns a bearer refusal',async()=>{
 const f=await fixture(),a=await agent(f.owner),identities=new NetworkRepository(db),request=new Request(origin+'/api/experiments/agent',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify(f.command)});let authenticated=false;
 const response=await http.experimentAgentRequest(request,factory,()=>({authenticate:async(token,time)=>{const principal=await identities.authenticate(token,time);authenticated=true;await identities.write(f.owner,{action:'revoke',requestId:uid(),id:a.command.id,revision:1},time);return principal;}}),()=>at);
 assert.equal(authenticated,true);assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');assert.equal((await get('?id='+f.command.id)).status,404);
});

test('transport rejects changed returned content, identities and result artifacts instead of confirming a write',async()=>{
 const f=await registered(),good=await factory().write(human(f.owner),f.command,at),request=()=>new Request(origin+'/api/experiments',{method:'POST',headers:headers(f.owner),body:JSON.stringify(f.command)});
 for(const bad of [{...good,requestId:uid()},{...good,item:{...good.item,digest:'0'.repeat(64)}}])assert.equal((await http.experimentHumanRequest(request(),{userId:f.owner},()=>({write:async()=>bad}),()=>false,()=>at)).status,503);
 const record=structuredClone(good.item.record);record.content.name='Different registered hypothesis';const changed={...good,item:{...good.item,record,digest:await model.experimentDigest(JSON.stringify(record))}};
 assert.equal((await http.experimentHumanRequest(request(),{userId:f.owner},()=>({write:async()=>changed}),()=>false,()=>at)).status,503);
 const foreign=await model.experimentPublicHumanId(uid()),spoof={...good,item:{...good.item,author:{kind:'HUMAN',id:foreign,sponsorId:foreign}}};
 assert.equal((await http.experimentHumanRequest(request(),{userId:f.owner},()=>({write:async()=>spoof}),()=>false,()=>at)).status,503);
});

test('unexpected diagnostics and malformed moderator configuration never echo user data or exception contents',async()=>{
 const f=await fixture(),request=()=>new Request(origin+'/api/experiments',{method:'POST',headers:headers(f.owner),body:JSON.stringify(f.command)});
 const response=await http.experimentHumanRequest(request(),{userId:f.owner},()=>({write:async()=>{throw Error('private-account-secret');}}),()=>false,()=>at);assert.equal(response.status,503);assert(!(await response.text()).includes('private-account-secret'));
 const me=await http.experimentMeRequest(new Request(origin+'/api/experiments/me'),{userId:f.owner},()=>{throw Error('private-policy');});assert.equal(me.status,503);assert(!(await me.text()).includes('private-policy'));
 for(const [error,wait] of [[new model.ExperimentError('Daily limit.',429,60),'60'],[new model.ExperimentError('Retained capacity.',429),null]]){const r=await http.experimentHumanRequest(request(),{userId:f.owner},()=>({write:async()=>{throw error;}}),()=>false,()=>at);assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),wait);}
});

test('actual continuous Worker registration and outcome retain open inventory and exact input without a batch baseline',async()=>{
 const f=await continuousFixture(),registered=await post(f.owner,f.command);assert.equal(registered.status,200,await registered.clone().text());const item=(await registered.json()).item;
 assert.equal(item.record.version,2);assert.equal(item.record.content.method,'CONTINUOUS_DEMO');assert.deepEqual(item.record.content.input,f.bundle.input);assert(!('baseline' in item.record.content));
 const command=continuousOutcome(item,f.bundle),response=await post(f.owner,command);assert.equal(response.status,200,await response.clone().text());const first=await response.json();
 assert.equal(first.item.record.version,2);assert.equal(first.item.record.content.result.artifact.projection.openPositions.length,1);assert.equal(first.item.record.content.result.artifact.projection.trades.length,0);
 assert.equal(first.item.record.content.result.artifact.qualification,'NONE');assert.equal(first.item.record.executionEnabled,false);assert.deepEqual(await (await post(f.owner,command)).json(),first);
 const page=await (await get('?outcomes='+item.id)).json();assert.equal(page.items[0].status,'ACTIVE');assert.equal(page.items[0].method,'CONTINUOUS_DEMO');assert(!JSON.stringify(page).includes('"events"'));
 assert.equal((await sessionEvidence.reviewSessionEvidence(first.item.record.content.result.artifact)).status,'MATCH');
});

test('all continuous rule families pass the unchanged actual HTTP depth and byte boundary',async()=>{
 for(const type of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']){
  const f=await continuousFixture(type),registered=await post(f.owner,f.command);assert.equal(registered.status,200,type+' '+await registered.clone().text());const item=(await registered.json()).item;
  const response=await post(f.owner,continuousOutcome(item,f.bundle));assert.equal(response.status,200,type+' '+await response.clone().text());
  assert.equal((await response.json()).item.record.content.result.artifact.input.config.strategy.record.content.definition.entry.type,type);
 }
});

test('continuous source suppression clears full tapes and projections on detail, outcome pages and identical retries',async()=>{
 const f=await continuousFixture(),registered=await post(f.owner,f.command);assert.equal(registered.status,200);const parent=(await registered.json()).item,command=continuousOutcome(parent,f.bundle),response=await post(f.owner,command);assert.equal(response.status,200);const item=(await response.json()).item;
 await new StrategyRepository(db).write({kind:'HUMAN',userId:'fixture-maintainer',moderator:true},{action:'moderate',requestId:uid(),id:f.source.id,digest:f.source.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'},at);
 for(const response of [await get('?id='+parent.id),await get('?id='+item.id),await get('?outcomes='+parent.id),await post(f.owner,f.command),await post(f.owner,command)]){
  assert.equal(response.status,200,await response.clone().text());const raw=await response.text();assert(!raw.includes('"config"'));assert(!raw.includes('"projection"'));assert(!raw.includes('"stateDigest"'));assert(!raw.includes('"events"'));
 }
});

test('continuous commands cannot publish known receiver credentials or mix batch and continuous methods',async()=>{
 const f=await continuousFixture();
 for(const token of ['og_local_owner_'+'a'.repeat(64),'og_local_producer_'+'b'.repeat(64)]){
  const raw={...f.command,input:{...f.command.input,hypothesis:encodeURIComponent(token)}},response=await post(f.owner,raw);assert.equal(response.status,400);assert(!(await response.text()).includes(token));
 }
 const mixed={...f.command,baseline:'COST_AWARE_LONG_SAME_ALLOCATION_V1'};assert.equal((await post(f.owner,mixed)).status,400);
 const registered=await post(f.owner,f.command);assert.equal(registered.status,200);const item=(await registered.json()).item,cmd=continuousOutcome(item,f.bundle),unmarked=structuredClone(cmd);delete unmarked.method;
 assert.equal((await post(f.owner,unmarked)).status,400);
});

test('continuous agent receipts derive identity and reject rehashed changed content rather than confirming an uncertain write',async()=>{
 const f=await continuousFixture(),a=await agent(f.owner),response=await machine(a.token,f.command);assert.equal(response.status,200,await response.clone().text());const receipt=await response.json();
 assert.equal(receipt.item.record.author.kind,'AGENT');assert.equal(receipt.item.record.author.id,a.command.id);assert.equal(receipt.item.record.author.name,a.command.name);assert.equal(receipt.item.record.author.sponsorId,await model.experimentPublicHumanId(f.owner));
 const changed=structuredClone(receipt);changed.item.record.content.input.hypothesis='Changed retrospective hypothesis';changed.item.digest=await model.experimentDigest(JSON.stringify(changed.item.record));
 const request=new Request(origin+'/api/experiments/agent',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify(f.command)});
 assert.equal((await http.experimentAgentRequest(request,()=>({write:async()=>changed}),()=>new NetworkRepository(db),()=>at)).status,503);
});
