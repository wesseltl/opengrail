import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {experimentCommitmentFixture} from './experiment-commitment-fixtures.mjs';

const built=await build({stdin:{contents:"export * from './app/experiment-model';export * from './app/experiment-http';export * from './app/program-window-model';export * from './app/program-window-observation-model';export * from './app/program-window-evidence-model';export * from './app/strategy-evidence-model';export * from './app/strategy-model';export * from './app/network-model';export {ExperimentRepository} from './app/experiment-store';export {StrategyRepository} from './app/strategy-store';export {NetworkRepository} from './app/network-store';export * from './app/experiment-review-model';export {ExperimentReviewRepository} from './app/experiment-review-store';",resolveDir:process.cwd()},bundle:true,write:false,metafile:true,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};
new Function('require','module','exports',built.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const m=module.exports,uid=()=>crypto.randomUUID(),ref=item=>({id:item.id,digest:item.digest}),iso=ms=>new Date(ms).toISOString(),clock=()=>iso(Date.now()-10),policy='public-experiment-v1',origin='https://window.test';
let mf,db,hook,queries=0;
function measured(){return {prepare(sql){queries++;const statement=db.prepare(sql);const wrap=current=>({bind(...values){assert(values.length<=96);return wrap(current.bind(...values));},async all(){if(hook)await hook(sql,'all');const result=await current.all();if(hook)await hook(sql,'after-all');return result;},async first(...args){if(hook)await hook(sql,'first');return current.first(...args);},async run(){if(hook)await hook(sql,'run');return current.run();}});return wrap(statement);}};}
const repo=()=>new m.ExperimentRepository(measured());
before(async()=>{mf=new Miniflare({modules:true,script:'export default{fetch(){return new Response("synthetic")}}',d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false});db=await mf.getD1Database('DB');for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();});
beforeEach(async()=>{hook=null;for(const table of ['experiment_review_reports','experiment_review_moderation','experiment_reviews','experiment_reports','experiment_moderation','experiment_records','strategy_reports','strategy_moderation','strategy_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>{hook=null;await mf.dispose();});
async function fixture(){
 const owner={kind:'HUMAN',userId:uid(),moderator:false},sourceClock=Date.now()-120000,start=iso(Math.ceil((Date.now()+180000)/3600000)*3600000);
 const f=await experimentCommitmentFixture({kind:'DIRECTION',sourceClock,startsAt:start,registerSource:async source=>(await new m.StrategyRepository(db).write(owner,m.strategyPublishCommandForRecord(source.record),iso(sourceClock))).item});
 const plan=await f.m.createProgramDirectionForwardPlan({mode:'PROSPECTIVE',handoff:f.handoff,config:f.config,preparedAt:f.plan.preparedAt,startsAt:start,endsAt:iso(Date.parse(start)+3600000),pollMs:60000,cycles:62});
 const input=await m.createProgramWindowInput({plan,preparedAt:plan.preparedAt,warmupBars:0,sourceMode:'SYNTHETIC_RESPONSES',rights:{kind:'AUTHOR_DECLARED_RIGHTS',verification:'NOT_ESTABLISHED',marketDataUseApproved:true,rawRetentionApproved:true,sharedIpRateBudgetApproved:true,publicSharing:'AUTHOR_CONSENTED',note:'Invented local D1 test inputs and clocks; no authentic provider or rights are established.'},newImplementation:m.programWindowUnknownImplementation(),declaration:null});
 return {...f,owner,plan,input};
}
const command=async f=>({action:'register',requestId:uid(),id:uid(),...await m.experimentWindowRegisterDefaults(f.input,'invented-local-window-source'),policyAccepted:policy});
const humanRequest=body=>new Request(origin+'/api/experiments',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Experiment-Intent':'submit'},body:JSON.stringify(body)});
async function agent(f,registeredAt=clock(),days=7){const token=await m.createNetworkToken(),registration={action:'register',requestId:uid(),id:uid(),credentialId:token.credentialId,name:'Invented window test agent',tokenDigest:token.tokenDigest,days};await new m.NetworkRepository(db).write(f.owner.userId,registration,registeredAt);return {token,registration,actor:{kind:'AGENT',principal:await new m.NetworkRepository(db).authenticate(token.token,registeredAt)}};}
async function waitForActualCredentialExpiry(expiresAt){const expiresMs=Date.parse(expiresAt),beforeWaitMs=Date.now();assert(Number.isSafeInteger(expiresMs));assert(beforeWaitMs<expiresMs,'The expiry race must begin with a currently valid grant');const remaining=expiresMs-Date.now()+100;if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));const cutoffCrossedMs=Date.now();assert(cutoffCrossedMs>expiresMs,'Actual time must pass expiry without overriding the clock or grant');return {clock:'REAL_SYSTEM_CLOCK_UNCHANGED',beforeWaitAt:iso(beforeWaitMs),expiresAt,cutoffCrossedAt:iso(cutoffCrossedMs)};}
async function retainedLink(f,declared){
 // Intentionally interrupted, empty observation protocol. This is retained as
 // adverse authored evidence, never a completed sampling or performance claim.
 const journal=await f.m.createProgramSessionJournal(f.plan.config,f.plan.startsAt),artifact=await f.m.snapshotProgramForwardEvidence(journal,f.plan),at=iso(Date.parse(f.plan.startsAt)+1000);
 const forward=(await repo().write(f.owner,{action:'register',requestId:uid(),id:uid(),...m.experimentForwardRegisterDefaults(artifact.input,'invented-original-v4'),policyAccepted:policy},at)).item;
 const outcome=(await repo().write(f.owner,{action:'outcome',requestId:uid(),id:uid(),method:'PROGRAM_FORWARD_DEMO',name:'Original interrupted fixture',manifest:ref(forward),result:{kind:'ARTIFACT',artifact},claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},policyAccepted:policy},at)).item;
 const rawArchive=await m.createProgramWindowRawArchive({version:1,kind:'PROGRAM_WINDOW_RAW_ARCHIVE',method:m.programWindowMethod.localMethod,inputDigest:f.input.inputDigest,protocolDigest:f.input.protocol.protocolDigest,sessionId:f.plan.config.sessionId,sourceMode:'SYNTHETIC_RESPONSES',startedAt:f.plan.startsAt,closedAt:at,status:'INTERRUPTED',reason:'NO_SOURCE_CAPTURE',clockFault:null,slots:[...f.input.protocol.schedule.active,...f.input.protocol.schedule.closeout].map(slot=>({ordinal:slot.ordinal,status:'MISSING',reason:'NO_SOURCE_CAPTURE'})),requests:[],outbox:[]});
 const result=await m.createProgramWindowEvidence({version:1,kind:'WINDOW_EVIDENCE_LINK',method:m.programWindowMethod.localMethod,inputDigest:f.input.inputDigest,protocolDigest:f.input.protocol.protocolDigest,manifest:ref(forward),outcome:ref(outcome),rawArchive,closure:{kind:'AUTHOR_DECLARED_WINDOW_CLOSURE',verification:'NOT_ESTABLISHED',observationStatus:'INTERRUPTED',computationStatus:'UNAVAILABLE',boundaryStatus:'NOT_ESTABLISHED',settlementStatus:'UNKNOWN',terminalValuation:'UNAVAILABLE',observationReportDigest:null,reconstructionAttemptDigest:null,accountingReportDigest:null,reason:'No raw market observations were captured in this explicitly interrupted synthetic fixture.'},classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',performanceInterpretation:'SAMPLED_DEMO_WITH_TERMINAL_MARK',continuousMarketCoverage:false,independentQualification:false,executionEnabled:false,ordersEnabled:false,liveEnabled:false});
 const sent={action:'outcome',requestId:uid(),id:uid(),method:'PROGRAM_FORWARD_WINDOW',name:'Retained interrupted window',manifest:ref(declared),result,claim:{type:'ORIGINAL',relation:null,sharedDependencies:[],conflicts:''},policyAccepted:policy};return {artifact,forward,outcome,result,sent,at};
}
test('actual D1/HTTP keeps V6 full plan and new protocol inert, with identical retries and no guest in the server graph',async()=>{
 const f=await fixture(),sent=await command(f),receipt=await repo().write(f.owner,sent,clock(),clock);assert.equal(receipt.item.record.version,6);assert.deepEqual(receipt.item.record.content.input,f.input);assert.equal(receipt.item.record.executionEnabled,false);assert.equal(receipt.item.record.content.input.protocol.qualification,'NONE');
 assert.deepEqual((await repo().write(f.owner,sent,clock(),clock)).item,receipt.item);
 const response=await m.experimentPublicRequest(new Request(origin+'/api/experiments?id='+receipt.item.id),repo);assert.equal(response.status,200);assert.deepEqual((await response.json()).item.record.content.input,f.input);
 const changed=structuredClone(sent);changed.name+=' altered';await assert.rejects(repo().write(f.owner,changed,clock(),clock),error=>error.status===409);
 const page=await repo().list();assert.equal(page.items[0].method,'PROGRAM_FORWARD_WINDOW');assert.equal(page.items[0].status,null);
 for(const path of ['app/program-run.ts','app/program-session-journal.ts','app/program-session-engine.ts','app/program-forward-evidence.ts','app/program-direction-search.ts','app/demo-engine.ts','scripts/program-window-controller.mjs','scripts/program-window-runtime.mjs'])assert(!Object.keys(built.metafile.inputs).includes(path),path);
});
test('registration lead is checked at the final application clock and retains no late record',async()=>{
 const f=await fixture(),sent=await command(f),late=()=>iso(Date.parse(f.plan.startsAt)-59999);await assert.rejects(repo().write(f.owner,sent,clock(),late),error=>error.status===409);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,0);
});
test('losing candidate suppression races the actual V6 SQL admission, with no quota increase or hidden source replacement',async()=>{
 const f=await fixture(),sent=await command(f),loser=f.sources.find(source=>source.id!==f.plan.config.strategy.record.id);let changed=false;
 hook=async(sql,phase)=>{if(!changed&&phase==='run'&&sql.startsWith('INSERT INTO experiment_records')){changed=true;await new m.StrategyRepository(db).write({...f.owner,moderator:true},{action:'moderate',id:loser.id,digest:loser.digest,requestId:uid(),state:'HIDDEN',reason:'POLICY',policyAccepted:'public-strategy-v1'},clock());}};
 await assert.rejects(repo().write(f.owner,sent,clock(),clock),error=>error.status===409);hook=null;assert(changed);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,0);
});
test('agent revocation during final V6 insertion prevents admission',async()=>{
 const f=await fixture(),a=await agent(f),sent=await command(f);let changed=false;
 hook=async(sql,phase)=>{if(!changed&&phase==='run'&&sql.startsWith('INSERT INTO experiment_records')){changed=true;await new m.NetworkRepository(db).write(f.owner.userId,{action:'revoke',requestId:uid(),id:a.registration.id,revision:1},clock());}};
 await assert.rejects(repo().write(a.actor,sent,clock(),clock),error=>error.status===401);hook=null;assert(changed);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,0);
});
test('revocation at the final atomic acknowledgment withholds success while retaining the original admitted record',async()=>{
 const f=await fixture(),a=await agent(f),sent=await command(f),r=repo();let changed=false;
 hook=async(sql,phase)=>{if(!changed&&phase==='first'&&sql.includes(' AS matches,CASE WHEN ')&&sql.endsWith(' AS credential')){changed=true;await new m.NetworkRepository(db).write(f.owner.userId,{action:'revoke',requestId:uid(),id:a.registration.id,revision:1},clock());}};
 const request=new Request(origin+'/api/experiments/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token.token},body:JSON.stringify(sent)});
 const response=await m.experimentAgentRequest(request,()=>r,()=>new m.NetworkRepository(db),clock);hook=null;assert.equal(response.status,401);assert(changed);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records WHERE request_id=?').bind(sent.requestId).first()).n,1);
});
test('actual credential expiry at V6 INSERT denies admission despite earlier successful HTTP authentication',async t=>{
 const f=await fixture(),sent=await command(f),a=await agent(f,iso(Date.now()-86400000+15000),1),originalGrant=await db.prepare('SELECT * FROM network_agents WHERE id=?').bind(a.registration.id).first();let reached=false,expiryObservation=null;
 const body=JSON.stringify(sent),request=()=>new Request(origin+'/api/experiments/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token.token},body});
 hook=async(sql,phase)=>{if(!reached&&phase==='run'&&sql.startsWith('INSERT INTO experiment_records')){reached=true;assert(Date.now()<Date.parse(a.actor.principal.expiresAt));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,0);expiryObservation=await waitForActualCredentialExpiry(a.actor.principal.expiresAt);}};
 const response=await m.experimentAgentRequest(request(),repo,()=>new m.NetworkRepository(db),()=>new Date().toISOString());hook=null;
 assert(reached,'The valid authenticated V6 command must reach the actual INSERT fence before expiry');assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');const errorBody=await response.text();assert(!errorBody.includes(a.token.token));assert(!errorBody.includes(sent.id));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,0);assert.deepEqual(await db.prepare('SELECT * FROM network_agents WHERE id=?').bind(a.registration.id).first(),originalGrant);assert.equal(m.experimentLimits.registerPerSponsorDay,5);t.diagnostic(JSON.stringify({gate:'V6_INSERT_ACTUAL_EXPIRY',...expiryObservation,status:response.status,retainedRecords:0,grantUnmodified:true}));
});
test('actual expiry after V6 durable admission withholds the final acknowledgment and preserves the exact original on expired retry',async t=>{
 const f=await fixture(),sent=await command(f),a=await agent(f,iso(Date.now()-86400000+15000),1),originalGrant=await db.prepare('SELECT * FROM network_agents WHERE id=?').bind(a.registration.id).first(),r=repo();let reached=false,originalRow=null,expiryObservation=null;
 const body=JSON.stringify(sent),request=()=>new Request(origin+'/api/experiments/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token.token},body}),actualClock=()=>new Date().toISOString();
 hook=async(sql,phase)=>{if(!reached&&phase==='first'&&sql.includes(' AS matches,CASE WHEN ')&&sql.endsWith(' AS credential')){reached=true;assert(Date.now()<Date.parse(a.actor.principal.expiresAt));originalRow=await db.prepare('SELECT * FROM experiment_records WHERE request_id=?').bind(sent.requestId).first();assert(originalRow,'The original record must be committed before the final credential race');const record=JSON.parse(originalRow.payload);assert.equal(record.version,6);assert.equal(record.id,sent.id);assert.equal(record.requestId,sent.requestId);assert.equal(record.author.id,a.registration.id);assert.equal(record.executionEnabled,false);expiryObservation=await waitForActualCredentialExpiry(a.actor.principal.expiresAt);}};
 const response=await m.experimentAgentRequest(request(),()=>r,()=>new m.NetworkRepository(db),actualClock);hook=null;
 assert(reached,'Expiry must occur after final authentication at the combined publication/credential SQL fence');assert.equal(response.status,401);assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');const errorBody=await response.text();assert(!errorBody.includes(a.token.token));assert(!errorBody.includes(sent.id));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,1);assert.deepEqual(await db.prepare('SELECT * FROM experiment_records WHERE request_id=?').bind(sent.requestId).first(),originalRow);
 const retry=await m.experimentAgentRequest(request(),()=>r,()=>new m.NetworkRepository(db),actualClock);assert.equal(retry.status,401);assert.equal(retry.headers.get('WWW-Authenticate'),'Bearer');assert(!JSON.stringify(await retry.json()).includes(a.token.token));assert.deepEqual(await db.prepare('SELECT * FROM experiment_records WHERE request_id=?').bind(sent.requestId).first(),originalRow);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM experiment_records').first()).n,1);assert.deepEqual(await db.prepare('SELECT * FROM network_agents WHERE id=?').bind(a.registration.id).first(),originalGrant);assert.equal((await repo().get(sent.id)).item.record.version,6);t.diagnostic(JSON.stringify({gate:'V6_FINAL_ACK_ACTUAL_EXPIRY',...expiryObservation,status:response.status,retryStatus:retry.status,retainedRecords:1,originalRowUnmodified:true,grantUnmodified:true}));
});
test('shared five-manifest quota covers V5 and V6 together',async()=>{
 const f=await fixture();for(let n=0;n<4;n++)await repo().write(f.owner,{action:'register',requestId:uid(),id:uid(),...await m.experimentCommitmentRegisterDefaults(f.plan,'invented-original-plan'),policyAccepted:policy},clock(),clock);
 await repo().write(f.owner,await command(f),clock(),clock);await assert.rejects(repo().write(f.owner,await command(f),clock(),clock),error=>error.status===429);assert.equal(m.experimentLimits.registerPerSponsorDay,5);
});
test('complete interrupted raw evidence links its original V4 context without inheriting financial qualification',async()=>{
 const f=await fixture(),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,l=await retainedLink(f,declared),receipt=await repo().write(f.owner,l.sent,l.at,()=>l.at);
 assert.equal(receipt.item.record.version,6);assert.deepEqual(receipt.item.record.content.result.rawArchive,l.result.rawArchive);assert.equal(receipt.item.record.content.result.closure.observationStatus,'INTERRUPTED');
 const page=await repo().outcomes(declared.id);assert.equal(page.items[0].status,'WINDOW_EVIDENCE_LINK');
 queries=0;const evidence=await repo().forStrategy(f.plan.config.strategy.record.id,f.plan.config.strategy.digest);assert(queries<=50,`Compact evidence read used ${queries} SQL statements`);const projected=evidence.items.find(item=>item.summary.id===receipt.item.id);assert.equal(projected.observation.kind,'WINDOW_EVIDENCE_LINK');assert.equal(projected.observation.inheritedResults,false);assert.equal(projected.observation.verification,'NOT_ESTABLISHED');
 const bad=structuredClone(l.sent);bad.requestId=uid();bad.id=uid();bad.result.outcome.digest='a'.repeat(64);await assert.rejects(repo().write(f.owner,bad,l.at,()=>l.at));
});
test('current V4 dependency moderation suppresses complete V6 reads and outcome metadata',async()=>{
 const f=await fixture(),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,l=await retainedLink(f,declared),reported=(await repo().write(f.owner,l.sent,l.at,()=>l.at)).item;
 await repo().write({...f.owner,moderator:true},{action:'moderate',requestId:uid(),id:l.outcome.id,digest:l.outcome.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:policy},l.at);
 const item=(await repo().get(reported.id)).item;assert.equal(item.record,null);assert.equal(item.suppression,'PARENT_UNAVAILABLE');assert.equal((await repo().outcomes(declared.id)).items[0].status,null);
});
test('public raw byte credential traps and whole oversize evidence are rejected before schema publication',async()=>{
 const f=await fixture(),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,l=await retainedLink(f,declared),sent=structuredClone(l.sent);
 const secretBytes=new TextEncoder().encode('{"x":"og_agent_invented-test-token"}'),body=await m.createProgramWindowRawBody(secretBytes);
 sent.result.rawArchive.requests=[{ordinal:1,slotOrdinal:1,endpoint:'Trades',status:'FAILED',reason:'INVALID_RAW',startedAt:f.plan.startsAt,finishedAt:f.plan.startsAt,normalizationAt:null,httpStatus:200,body,normalized:null}];
 assert.throws(()=>m.boundedExperimentCommand(sent));
 const big=structuredClone(l.sent);big.result.rawArchive.requests=Array.from({length:2},(_,n)=>({ordinal:n+1,slotOrdinal:1,endpoint:n?'Trades':'OHLC',status:'FAILED',reason:'BODY_UNAVAILABLE',startedAt:f.plan.startsAt,finishedAt:f.plan.startsAt,normalizationAt:null,httpStatus:200,body:{encoding:'BASE64',byteLength:262144,digest:'a'.repeat(64),base64:'A'.repeat(349528)},normalized:null}));assert.throws(()=>m.boundedExperimentCommand(big),error=>error.status===413);
 const noConsent=structuredClone(f.input);noConsent.protocol.rights.publicSharing='NOT_CONSENTED';await assert.rejects(m.verifyProgramWindowEvidence(l.result,noConsent,'PUBLIC'));
});
test('rehashed fabricated original event and ACK claims cannot enter an attributed V6 link',async()=>{
 const f=await fixture(),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,l=await retainedLink(f,declared),event={requestId:uid(),type:'PAUSE'};
 const make=async changes=>{
  const archive=structuredClone(l.result.rawArchive);archive.outbox=[{ordinal:1,slotOrdinal:1,origin:'OWNER_CONTROL',sourceRequestOrdinal:null,sourceTuplePosition:null,createdAt:f.plan.startsAt,event,eventDigest:await m.programWindowDigest(event),status:'PENDING',attempts:[],...changes}];
  const {archiveDigest,...archiveBody}=archive;void archiveDigest;const rawArchive=await m.createProgramWindowRawArchive(archiveBody),{evidenceDigest,...body}=l.result;void evidenceDigest;
  return {...l.sent,id:uid(),requestId:uid(),result:await m.createProgramWindowEvidence({...body,rawArchive})};
 };
 const wrongDigest=await make({eventDigest:'a'.repeat(64)});await assert.rejects(repo().write(f.owner,wrongDigest,l.at,()=>l.at),error=>error.status===400);
 const fakeReceipt={requestId:event.requestId,eventDigest:await m.programWindowDigest(event),receivedAt:f.plan.startsAt,completedAt:f.plan.startsAt,sequence:1,status:'COMPLETED',reason:'APPLIED',innerStart:1,innerEnd:1};
 const fakeAck=await make({status:'CONFIRMED',attempts:[{startedAt:f.plan.startsAt,finishedAt:f.plan.startsAt,operation:'POST',status:'CONFIRMED',reason:null,acknowledgedAt:f.plan.startsAt,envelope:{version:1,kind:'LOCAL_PROGRAM_RECEIVER_RECEIPT',sessionId:f.plan.config.sessionId,sessionInstance:'a'.repeat(64),receipt:fakeReceipt,duplicate:false,journalDigest:l.artifact.journal.journalDigest,tradingDigest:l.artifact.journal.trading.journalDigest,ordersEnabled:false,liveEnabled:false}}]});
 await assert.rejects(repo().write(f.owner,fakeAck,l.at,()=>l.at));
 const pending=await make({});const retained=(await repo().write(f.owner,pending,l.at,()=>l.at)).item;assert.equal(retained.record.content.result.rawArchive.outbox[0].status,'PENDING');assert.equal(retained.record.content.result.closure.boundaryStatus,'NOT_ESTABLISHED');
});
test('actual full twenty-item window catalog batches the shared source and original V4 context without changing the metadata page size',async()=>{
 const f=await fixture(),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,l=await retainedLink(f,declared),original=(await repo().write(f.owner,l.sent,l.at,()=>l.at)).item;
 // Direct correlated D1 fixture seeds the read boundary. It does not bypass or
 // claim twenty normal API admissions through the shared daily write quota.
 for(let n=1;n<21;n++){
  const record=structuredClone(original.record);record.id=uid();record.requestId=uid();record.createdAt=iso(Date.parse(l.at)+n);
  const payload=JSON.stringify(record),digest=await m.experimentDigest(payload),commandPayload=m.boundedExperimentCommand({action:'outcome',requestId:record.requestId,id:record.id,...record.content,policyAccepted:policy}).payload,commandDigest=await m.experimentDigest(commandPayload);
  await db.prepare('INSERT INTO experiment_records(id,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,request_id,command_digest,payload,digest,created_at) SELECT ?,type,manifest_id,manifest_digest,strategy_id,strategy_digest,author_key,sponsor_key,?,?,?,?,? FROM experiment_records WHERE id=?').bind(record.id,record.requestId,commandDigest,payload,digest,record.createdAt,original.id).run();
 }
 queries=0;const page=await repo().outcomes(declared.id);assert.equal(page.items.length,20);assert(queries<=50,`Full catalog used ${queries} SQL statements`);assert.equal(page.nextCursor,page.items.at(-1).id);assert(page.items.every(item=>item.method==='PROGRAM_FORWARD_WINDOW'&&item.status==='WINDOW_EVIDENCE_LINK'));const next=await repo().outcomes(declared.id,page.nextCursor);assert.equal(next.items.length,1);assert.equal(next.nextCursor,null);
});
test('target-oriented V6 withdrawal cannot acknowledge success after final agent revocation',async()=>{
 const f=await fixture(),a=await agent(f),declared=(await repo().write(a.actor,await command(f),clock(),clock)).item,sent={action:'withdraw',requestId:uid(),id:declared.id,digest:declared.digest,reason:'AUTHOR_REQUEST',policyAccepted:policy},r=repo();let changed=false;
 hook=async(sql,phase)=>{if(!changed&&phase==='first'&&sql.includes(' AS matches,CASE WHEN ')&&sql.endsWith(' AS credential')){changed=true;await new m.NetworkRepository(db).write(f.owner.userId,{action:'revoke',requestId:uid(),id:a.registration.id,revision:1},clock());}};
 const response=await m.experimentAgentRequest(new Request(origin+'/api/experiments/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token.token},body:JSON.stringify(sent)}),()=>r,()=>new m.NetworkRepository(db),clock);hook=null;assert.equal(response.status,401);assert(changed);assert.equal((await repo().get(declared.id)).item.state,'WITHDRAWN');
});
test('a private agent report fences all original receipt metadata at the closing SQL observation',async()=>{
 const f=await fixture(),a=await agent(f),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,sent={action:'report',requestId:uid(),id:declared.id,digest:declared.digest,reason:'MISLEADING',details:'Invented private local test report.',policyAccepted:policy},r=repo();let changed=false;
 hook=async(sql,phase)=>{if(!changed&&phase==='first'&&sql.includes('experiment_reports WHERE author_key=?1')&&sql.includes(' AS credential')){changed=true;await db.prepare('UPDATE experiment_reports SET record_digest=? WHERE request_id=?').bind('a'.repeat(64),sent.requestId).run();}};
 const response=await m.experimentAgentRequest(new Request(origin+'/api/experiments/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token.token},body:JSON.stringify(sent)}),()=>r,()=>new m.NetworkRepository(db),clock);hook=null;assert.equal(response.status,503);assert(changed);
});
test('V6 reviews retain a separate unsupported hold and close the complete current raw/V4 context',async()=>{
 const f=await fixture(),declared=(await repo().write(f.owner,await command(f),clock(),clock)).item,l=await retainedLink(f,declared),original=(await repo().write(f.owner,l.sent,l.at,()=>l.at)).item;
 const reproducedV4=(await repo().write(f.owner,{action:'outcome',requestId:uid(),id:uid(),method:'PROGRAM_FORWARD_DEMO',name:'Invented original journal reproduction',manifest:ref(l.forward),result:{kind:'ARTIFACT',artifact:l.artifact},claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(l.outcome)},sharedDependencies:[],conflicts:''},policyAccepted:policy},l.at)).item;
 const {evidenceDigest,...body}=l.result;void evidenceDigest;
 const reproduced=(await repo().write(f.owner,{...l.sent,id:uid(),requestId:uid(),result:await m.createProgramWindowEvidence({...body,outcome:ref(reproducedV4)}),claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...ref(original)},sharedDependencies:[],conflicts:''}},l.at,()=>l.at)).item;
 const r=new m.ExperimentReviewRepository(measured()),actor={kind:'HUMAN',userId:uid(),moderator:false,reviewer:true},sent={action:'review',requestId:uid(),id:uid(),target:{original:ref(original),reproduction:ref(reproduced),manifest:ref(declared),strategy:declared.strategy},previous:null,decision:'HELD',reasons:['UNSUPPORTED_METHOD'],evidence:null,attestations:{fixedCode:false,exactInputs:false,inspectedDifferences:false,separateOriginalAndReproductionProcesses:false},sharedDependencies:[...m.experimentReviewSharedDependencies],otherConflicts:'Known first-party synthetic fixture.',note:'This separate window method cannot be qualified by the existing review method.',policyAccepted:'public-experiment-review-v1'};
 const receipt=await r.write(actor,sent,l.at);assert.equal(receipt.item.method,'PROGRAM_FORWARD_WINDOW');assert.equal(receipt.item.decision,'HELD');
 const current=await r.get(receipt.item.id,receipt.item.digest);assert.equal(current.item.method,'PROGRAM_FORWARD_WINDOW');assert((await r.confirmCommitment(current.item)).method==='PROGRAM_FORWARD_WINDOW');
 const bounded=await r.list(original.id,original.digest);assert.equal(bounded.method,'PROGRAM_FORWARD_WINDOW');assert.equal(bounded.items.length,1);
 const contextRepo=repo(),context=await contextRepo.windowContexts([ref(original),ref(reproduced)]);assert(context.every(value=>value.visible));
 await repo().write({...f.owner,moderator:true},{action:'moderate',requestId:uid(),id:l.outcome.id,digest:l.outcome.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:policy},l.at);
 await assert.rejects(contextRepo.confirmCommitmentContexts(context),error=>error.status===503);
 assert.equal((await new m.ExperimentReviewRepository(measured()).get(receipt.item.id,receipt.item.digest)).item.record,null);
});
