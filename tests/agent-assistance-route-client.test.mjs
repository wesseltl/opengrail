import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createOpenGrailAgentClient} from '../scripts/opengrail-agent-client.mjs';
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';
import {createOpenGrailAssistanceAdapter} from '../scripts/opengrail-assistance-adapter.mjs';
import * as bundled from '../scripts/opengrail-assistance-validator.bundle.mjs';
import {publishAssistanceResponse} from '../examples/agent-assistance-response.mjs';

// Real HTTPS handlers and repositories; invented local enrollment/human context and local D1.
// No public origin, model, source page, real credential, guest program or order is used.
const contents=`
import {NetworkRepository} from './app/network-store.ts';
import {createNetworkToken} from './app/network-model.ts';
import {networkAgentRequest} from './app/network-http.ts';
import {StrategyRepository} from './app/strategy-store.ts';
import {strategyPublicRequest} from './app/strategy-http.ts';
import {strategyTemplate,strategyPublicHumanId} from './app/strategy-model.ts';
import {ResearchRepository} from './app/research-store.ts';
import {researchPublicRequest} from './app/research-http.ts';
import {blankVentureDossier} from './app/venture-model.ts';
import {AssistanceRepository} from './app/assistance-store.ts';
import {assistanceAgentRequest,assistancePublicRequest} from './app/assistance-http.ts';
const uid=()=>crypto.randomUUID(),ref=item=>({id:item.id,digest:item.digest});
export default{async fetch(request,env){
 const path=new URL(request.url).pathname,identities=()=>new NetworkRepository(env.DB),assistance=()=>new AssistanceRepository(env.DB),strategies=()=>new StrategyRepository(env.DB),research=()=>new ResearchRepository(env.DB);
 if(path==='/_synthetic/setup'){
  const setup=await request.json(),domain=setup.domain??'STRATEGY';if(!['STRATEGY','RESEARCH','VENTURE'].includes(domain))return new Response(null,{status:400});
  const ownerId=uid(),agentId=uid(),generated=await createNetworkToken(),baseAt=new Date(Date.now()-60000).toISOString(),requestAt=new Date(Date.parse(baseAt)+1000).toISOString(),proposalAt=new Date(Date.parse(baseAt)+2000).toISOString();
  await identities().write(ownerId,{action:'register',requestId:uid(),id:agentId,credentialId:generated.credentialId,name:'Synthetic assistance participant',tokenDigest:generated.tokenDigest,days:7},baseAt);
  const human={kind:'HUMAN',userId:ownerId,moderator:false},registered=await identities().authenticate(generated.token,proposalAt),agent={kind:'AGENT',principal:registered};
  const researchCommand=()=>({action:'publish',requestId:uid(),id:uid(),kind:'HYPOTHESIS',title:'Synthetic source-linked hypothesis',statement:'An invented declaration needs contrary evidence.',assumptions:'Source authenticity and demand are unknown.',falsification:'Reject unsupported claims after independent investigation.',sources:[{url:'https://synthetic.example.test/declared',classification:'AUTHOR_CLAIM',note:'Not fetched or verified.'}],relation:null,policyAccepted:'public-research-v1'});
  let publication;
  if(domain==='STRATEGY')publication={action:'publish',requestId:uid(),id:uid(),name:'Synthetic trend definition',description:'No tested return or execution claim.',assumptions:'Costs are author assumptions.',falsification:'Reject without independently reproduced results.',sources:[],definition:strategyTemplate('TREND'),relation:null,policyAccepted:'public-strategy-v1'};
  else{publication=researchCommand();if(domain==='VENTURE'){const venture=blankVentureDossier(baseAt.slice(0,10));venture.issuer={name:'Synthetic unverified issuer',website:'https://synthetic.example.test',kind:'COMPANY',sector:'AI',stage:'PRE_SEED'};venture.risks=['No independently verified paying customers.'];venture.nextCatalyst={event:'Await independent evidence.',date:null};publication={version:2,...publication,domain:'VENTURE',venture};}}
  const repo=domain==='STRATEGY'?strategies():research(),base=(await repo.write(human,publication,baseAt)).item;
  const common={action:'request',requestId:uid(),id:uid(),base:ref(base),intent:'Investigate the exact existing definition or claim.',constraints:'Preserve contrary evidence and uncertainty. Demo only; no orders.',falsification:'Reject conclusions without exact independently checked evidence.',policyAccepted:'public-assistance-v1'};
  const requestCommand=domain==='STRATEGY'?common:{version:2,...common,domain,objectives:[{id:'claim-evidence',prompt:'Does the attributed source establish this statement?',claimPath:'/statement',sourceIndices:[0]}]};
  const target=(await assistance().write(human,requestCommand,requestAt)).item;
  const proposalCommand={...publication,requestId:uid(),id:uid(),relation:{type:domain==='RESEARCH'?'CHALLENGE':'FORK',...ref(base)}};
  if(domain==='STRATEGY'){proposalCommand.name='Synthetic later agent fork';proposalCommand.definition={...publication.definition,entry:{...publication.definition.entry,slowPeriod:60}};}
  else{proposalCommand.title='Synthetic later agent investigation';if(domain==='RESEARCH')proposalCommand.kind='CHALLENGE';}
  let proposalAuthor=agent;
  if(setup.foreignProposal===true){const siblingKey=await createNetworkToken();await identities().write(ownerId,{action:'register',requestId:uid(),id:uid(),credentialId:siblingKey.credentialId,name:'Synthetic assistance participant',tokenDigest:siblingKey.tokenDigest,days:7},baseAt);proposalAuthor={kind:'AGENT',principal:await identities().authenticate(siblingKey.token,proposalAt)};}
  const proposal=(await repo.write(proposalAuthor,proposalCommand,proposalAt)).item;
  return Response.json({domain,ownerId,agentId,credentialId:generated.credentialId,credential:generated.token,sponsorId:await strategyPublicHumanId(ownerId),base,request:target,proposal});
 }
 if(path==='/_synthetic/control'){
  const value=await request.json(),now=new Date().toISOString();
  if(value.kind==='REVOKE_AGENT')return Response.json(await identities().write(value.ownerId,{action:'revoke',requestId:uid(),id:value.agentId,revision:1},now));
  if(value.kind==='HIDE_REQUEST'){const item=(await assistance().get(value.id)).item;return Response.json(await assistance().write({kind:'HUMAN',userId:value.ownerId,moderator:true},{action:'moderate',requestId:uid(),id:item.id,digest:item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:'public-assistance-v1'},now));}
  if(value.kind==='HIDE_PROPOSAL'){const repo=value.domain==='STRATEGY'?strategies():research(),item=(await repo.get(value.id)).item;return Response.json(await repo.write({kind:'HUMAN',userId:value.ownerId,moderator:true},{action:'moderate',requestId:uid(),id:item.id,digest:item.digest,state:'HIDDEN',reason:'POLICY',policyAccepted:value.domain==='STRATEGY'?'public-strategy-v1':'public-research-v1'},now));}
  return new Response(null,{status:400});
 }
 if(path==='/api/network/agent')return networkAgentRequest(request,identities);
 if(path==='/api/assistance/agent')return assistanceAgentRequest(request,assistance,identities);
 if(path==='/api/assistance')return assistancePublicRequest(request,assistance);
 if(path==='/api/strategies')return strategyPublicRequest(request,strategies);
 if(path==='/api/research')return researchPublicRequest(request,research);
 return new Response(null,{status:404});
}};
`;
let mf,db;
before(async()=>{
 const built=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:built.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const name of ['0000_confused_zombie.sql','0001_gray_wolfpack.sql','0002_sour_puma.sql','0003_zippy_unus.sql','0004_slim_taskmaster.sql','0008_stale_the_hand.sql'])for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
beforeEach(async()=>{for(const table of ['assistance_reports','assistance_moderation','assistance_publications','strategy_reports','strategy_moderation','strategy_publications','research_reports','research_moderation','research_publications','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>{if(mf)await mf.dispose();});
const baseOrigin='https://synthetic-assistance-adapter.test',uid=()=>crypto.randomUUID(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const count=async table=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
async function accepted(response){assert.equal(response.status,200);return response.json();}
const seed=async(domain='STRATEGY',extra={})=>accepted(await mf.dispatchFetch(baseOrigin+'/_synthetic/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,...extra})}));
const control=async value=>mf.dispatchFetch(baseOrigin+'/_synthetic/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const options=s=>({agentId:s.agentId,credentialId:s.credentialId,sponsorId:s.sponsorId});
const ref=item=>({id:item.id,digest:item.digest});
const responseCommand=s=>({...(s.domain==='STRATEGY'?{}:{version:2,domain:s.domain}),action:'respond',requestId:uid(),id:uid(),request:ref(s.request),proposal:ref(s.proposal),rationale:'The synthetic proposal remains unverified and requires later independent evaluation.',questions:'Which independent evidence could falsify this declaration?',...(s.domain==='STRATEGY'?{}:{answers:[{objectiveId:'claim-evidence',stance:'UNKNOWN',explanation:'The declared source does not establish independently verified evidence.',sourceIndices:[0]}]}),policyAccepted:'public-assistance-v1'});
function loopback(s,calls,transport){return {kind:'SYNTHETIC_LOOPBACK_ONLY',fetch:async(url,init)=>{const parsed=new URL(url),target=baseOrigin+parsed.pathname+parsed.search;calls.push({path:parsed.pathname,query:parsed.search,method:init.method,body:init.body,authorized:init.headers.Authorization!==undefined});return transport?transport(target,init):mf.dispatchFetch(target,init);}};}
function configured(s,transport){const calls=[],adapter=createOpenGrailAssistanceAdapter(options(s)),boundary=createOpenGrailAgentBoundary({baseOrigin,credential:s.credential,agentId:s.agentId,fetch:async(url,init)=>{calls.push({path:new URL(url).pathname,method:init.method,body:init.body,authorized:init.headers.Authorization!==undefined});return transport?transport(url,init):mf.dispatchFetch(url,init);},receiptValidators:{'/api/assistance/agent':adapter.receiptValidator}});return {boundary,adapter,calls};}
async function approved(f,command){const identity=await f.boundary.controller.identify();assert.equal(identity.disposition,'IDENTIFIED');f.adapter.checkIdentity(identity.identity);const prepared=f.boundary.controller.prepareWrite('/api/assistance/agent',command);f.boundary.controller.approveWrite(prepared.handle,{confirmPublicSharing:true});return prepared;}
function example(s,command,extra={}){return publishAssistanceResponse({baseOrigin:'http://127.0.0.1',credential:s.credential,...options(s),command,approveExactPublicCommand:async()=>true,...extra});}

test('actual generated bundle binds the reviewed complete graph, recipe, MIT notice and measured source',()=>{
 const graphBytes=readFileSync('scripts/agent-assistance-validator.build.json'),graph=JSON.parse(graphBytes),proof=JSON.parse(readFileSync('scripts/opengrail-assistance-validator.bundle.provenance.json')),code=readFileSync('scripts/opengrail-assistance-validator.bundle.mjs');
 assert.equal(proof.status,'BUILT_TWICE_IDENTICAL_RUNTIME_NOT_TESTED');assert.equal(proof.buildInputsSha256,sha(graphBytes));assert.equal(proof.recipeSha256,sha(readFileSync('scripts/build-agent-assistance-validator.mjs')));assert.equal(proof.output.bytes,code.length);assert.equal(proof.output.sha256,sha(code));assert.deepEqual(Object.keys(bundled).sort(),graph.exports);
 assert.equal(graph.runtimeInputs.length,18);for(const row of [...graph.runtimeInputs,...graph.packageMetadata]){const bytes=readFileSync(row.path);assert.equal(bytes.length,row.bytes,row.path);assert.equal(sha(bytes),row.sha256,row.path);}
 assert(code.includes(readFileSync('node_modules/zod/LICENSE')));assert.deepEqual(Object.keys(proof.metafile.inputs).sort(),[...graph.runtimeInputs.map(row=>row.path),'entry.mjs'].sort());const outputs=Object.values(proof.metafile.outputs);assert.equal(outputs.length,1);assert.deepEqual(outputs[0].imports,[]);assert.equal(proof.applicationExecution,false);assert.equal(proof.qualification,'NONE');assert.equal(proof.hostedAvailability,'UNKNOWN');
});

test('adapter options refuse hooks or invented configuration without evaluating caller accessors',()=>{
 const value={agentId:'34700000-0000-4000-8000-000000000001',credentialId:'34700000-0000-4000-8000-000000000002',sponsorId:'human_'+'c'.repeat(64)};let touched=0;
 for(const bad of [{...value,get sponsorId(){touched++;return value.sponsorId;}},{...value,extra:true},{...value,[Symbol('hidden')]:true},{...value,credentialId:'UNKNOWN'},{...value,sponsorId:'human'}])assert.throws(()=>createOpenGrailAssistanceAdapter(bad));assert.equal(touched,0);
});

for(const domain of ['STRATEGY','RESEARCH','VENTURE'])test('one explicit '+domain+' controller response crosses actual handlers and SQL with no proposal creation',async()=>{
 const s=await seed(domain),command=responseCommand(s),calls=[],reviews=[],beforeStrategies=await count('strategy_publications'),beforeResearch=await count('research_publications');
 const session=await example(s,command,{testAdapter:loopback(s,calls),approveExactPublicCommand:async review=>{reviews.push(review);return true;}});
 try{
  assert.equal(session.result.disposition,'CONFIRMED');assert.equal(session.result.receipt.item.id,command.id);assert.equal(session.result.receipt.item.author.id,s.agentId);assert.equal(session.result.receipt.item.availability,'AVAILABLE');assert.equal(session.result.qualification,'NONE');assert.equal(reviews.length,1);assert.equal(reviews[0].path,'/api/assistance/agent');assert.deepEqual(JSON.parse(reviews[0].body),command);
  assert.equal(await count('assistance_publications'),2);assert.equal(await count('strategy_publications'),beforeStrategies);assert.equal(await count('research_publications'),beforeResearch);assert.equal(calls.filter(c=>c.method==='POST').length,1);assert(calls.filter(c=>c.path!=='/api/network/agent'&&c.method==='GET').every(c=>!c.authorized));assert.equal(calls.filter(c=>c.path==='/api/network/agent').length,2);assert(!JSON.stringify(session.result).includes(s.credential));assert(!JSON.stringify(session.result).includes(s.ownerId));
  if(domain!=='STRATEGY'){assert.equal(session.result.receipt.item.domain,domain);assert.equal(session.result.receipt.item.record.answers[0].stance,'UNKNOWN');}
 }finally{session.boundary.controller.close();}
});

test('SDK without the adapter refuses assistance response before dispatch',async()=>{
 const s=await seed(),calls=[],client=createOpenGrailAgentClient({baseOrigin,credential:s.credential,agentId:s.agentId,fetch:async(url,init)=>{calls.push(init.method);return mf.dispatchFetch(url,init);}});
 try{await client.identify();await assert.rejects(()=>client.submit('/api/assistance/agent',responseCommand(s),{confirmPublicSharing:true}),/FULL_RECEIPT_VALIDATOR_REQUIRED/);assert.deepEqual(calls,['GET']);assert.equal(await count('assistance_publications'),1);assert.equal(client.pending(),null);}finally{client.close();}
});

test('mismatched configured enrollment stops before public reads, consent or writes',async()=>{
 const s=await seed(),calls=[],reviews=[];let candidate=uid();while(candidate===s.credentialId)candidate=uid();
 await assert.rejects(()=>example(s,responseCommand(s),{credentialId:candidate,testAdapter:loopback(s,calls),approveExactPublicCommand:async review=>{reviews.push(review);return true;}}),/IDENTITY_MISMATCH/);
 assert.deepEqual(calls.map(c=>[c.method,c.path]),[['GET','/api/network/agent']]);assert.equal(reviews.length,0);assert.equal(await count('assistance_publications'),1);
});

test('foreign sponsorship, wrong domain and invalid objective evidence stop before consent or publication',async()=>{
 const s=await seed('RESEARCH');
 for(const change of ['SPONSOR','DOMAIN','OBJECTIVE','SOURCE']){
  const command=responseCommand(s),calls=[],reviews=[],extra={testAdapter:loopback(s,calls),approveExactPublicCommand:async review=>{reviews.push(review);return true;}};
  if(change==='SPONSOR')extra.sponsorId=s.sponsorId==='human_'+'f'.repeat(64)?'human_'+'e'.repeat(64):'human_'+'f'.repeat(64);
  if(change==='DOMAIN')command.domain='VENTURE';if(change==='OBJECTIVE')command.answers[0].objectiveId='foreign-objective';if(change==='SOURCE')command.answers[0].sourceIndices=[1];
  await assert.rejects(()=>example(s,command,extra));assert.equal(reviews.length,0);assert.equal(calls.filter(c=>c.method==='POST').length,0);assert.equal(await count('assistance_publications'),1);
 }
});

test('another actual agent under the same sponsor and display name cannot answer with its sibling proposal',async()=>{
 const s=await seed('STRATEGY',{foreignProposal:true}),calls=[],reviews=[];assert.notEqual(s.proposal.author.id,s.agentId);assert.equal(s.proposal.author.sponsorId,s.sponsorId);
 await assert.rejects(()=>example(s,responseCommand(s),{testAdapter:loopback(s,calls),approveExactPublicCommand:async review=>{reviews.push(review);return true;}}),/AUTHOR_MISMATCH/);
 assert.equal(reviews.length,0);assert.equal(calls.filter(c=>c.method==='POST').length,0);assert.equal(await count('assistance_publications'),1);
});

test('read helpers reject hooked reference objects before evaluating them',async()=>{
 const s=await seed('RESEARCH'),adapter=createOpenGrailAssistanceAdapter(options(s)),raw=await accepted(await mf.dispatchFetch(baseOrigin+'/api/research?id='+s.base.id));let touched=0;
 const reference={id:s.base.id,get digest(){touched++;return s.base.digest;}};
 await assert.rejects(()=>adapter.checkResearch(raw,{reference,domain:'RESEARCH',signal:new AbortController().signal}),/INVALID_SCHEMA/);assert.equal(touched,0);
});

test('declining exact public-sharing consent makes no response write',async()=>{
 const s=await seed('VENTURE'),calls=[],session=await example(s,responseCommand(s),{testAdapter:loopback(s,calls),approveExactPublicCommand:async()=>false});
 assert.deepEqual(session,{disposition:'DECLINED_BEFORE_PUBLICATION'});assert.equal(calls.filter(c=>c.method==='POST').length,0);assert.equal(await count('assistance_publications'),1);
});

test('current dependency suppression after consent stops the reread before any response write',async()=>{
 for(const domain of ['STRATEGY','RESEARCH']){
  const s=await seed(domain),calls=[];
  await assert.rejects(()=>example(s,responseCommand(s),{testAdapter:loopback(s,calls),approveExactPublicCommand:async()=>{assert.equal((await control({kind:'HIDE_PROPOSAL',ownerId:s.ownerId,id:s.proposal.id,domain})).status,200);return true;}}));
  assert.equal(calls.filter(c=>c.method==='POST').length,0);
 }
 assert.equal(await count('assistance_publications'),2);
});

test('real committed lost acknowledgment retains exact original bytes and only an explicit identical retry',async()=>{
 const s=await seed('RESEARCH');let lost=true;const f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method==='POST'&&lost){lost=false;assert.equal(response.status,200);throw Error('Synthetic lost response after committed SQL write.');}return response;}),command=responseCommand(s),prepared=await approved(f,command);
 try{
  const result=await f.boundary.controller.executeApproved(prepared.handle);assert.equal(result.disposition,'UNCERTAIN');assert.equal(await count('assistance_publications'),2);const original=f.boundary.controller.pending().body;assert.equal(original,JSON.stringify(command));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  const changed=f.boundary.controller.prepareWrite('/api/assistance/agent',{...command,rationale:'A replacement must not overwrite uncertain original intent.'});f.boundary.controller.approveWrite(changed.handle,{confirmPublicSharing:true});await assert.rejects(()=>f.boundary.controller.executeApproved(changed.handle),/ORIGINAL_PENDING_COMMAND_REQUIRED/);f.boundary.controller.discardPrepared(changed.handle);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.equal((await f.boundary.controller.retryApproved(prepared.handle)).disposition,'CONFIRMED');assert.equal(await count('assistance_publications'),2);const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts[0].body,posts[1].body);assert.equal(f.boundary.controller.pending(),null);
 }finally{f.boundary.controller.close();}
});

test('actual route receipt tampering and even rehashed replacement content remain uncertain after commit',async()=>{
 for(const change of ['SPONSOR','NAME','REHASHED_CONTENT','DOMAIN']){
  const s=await seed('RESEARCH'),f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method!=='POST')return response;assert.equal(response.status,200);const raw=await response.json();
   if(change==='SPONSOR')raw.item.author.sponsorId='human_'+'f'.repeat(64);if(change==='NAME')raw.item.record.author.name='Forged original agent name';if(change==='DOMAIN')raw.item.domain='VENTURE';
   if(change==='REHASHED_CONTENT'){raw.item.record.rationale='Rehashed replacement evidence does not match the original command.';raw.item.digest=await bundled.strategyDigest(bundled.boundedAssistanceRecord(raw.item.record).payload);}
   return Response.json(raw);
  }),command=responseCommand(s),prepared=await approved(f,command);
  try{const result=await f.boundary.controller.executeApproved(prepared.handle);assert.equal(result.disposition,'UNCERTAIN');assert.equal(f.boundary.controller.pending().body,JSON.stringify(command));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}finally{f.boundary.controller.close();}
 }
 assert.equal(await count('assistance_publications'),8);
});

test('suppressed original acceptance reconstructs its full original author without restoring response content',async()=>{
 const s=await seed('VENTURE');let lost=true;const f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method==='POST'&&lost){lost=false;assert.equal(response.status,200);throw Error('Synthetic lost committed acknowledgment.');}return response;}),command=responseCommand(s),prepared=await approved(f,command);
 try{
  assert.equal((await f.boundary.controller.executeApproved(prepared.handle)).disposition,'UNCERTAIN');assert.equal((await control({kind:'HIDE_REQUEST',ownerId:s.ownerId,id:s.request.id})).status,200);
  const result=await f.boundary.controller.retryApproved(prepared.handle);assert.equal(result.disposition,'CONFIRMED');assert.equal(result.receipt.item.availability,'DEPENDENCY_UNAVAILABLE');assert.equal(result.receipt.item.record,null);assert.equal(result.receipt.item.domain,'VENTURE');assert(!JSON.stringify(result).includes(command.rationale));assert.equal(await count('assistance_publications'),2);assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
  const altered=structuredClone((await f.boundary.controller.identify()).identity);altered.agent.name='Tampered original author name';await assert.rejects(()=>f.adapter.receiptValidator(result.receipt,{command,identity:altered,signal:new AbortController().signal}));
 }finally{f.boundary.controller.close();}
});

test('cancel after an actual commit retains the original command for deliberate recovery',async()=>{
 const s=await seed(),controller=new AbortController();let cancel=true;const f=configured(s,async(url,init)=>{const response=await mf.dispatchFetch(url,init);if(init.method==='POST'&&cancel){cancel=false;controller.abort();}return response;}),command=responseCommand(s),prepared=await approved(f,command);
 try{const result=await f.boundary.controller.executeApproved(prepared.handle,{signal:controller.signal});assert.equal(result.disposition,'UNCERTAIN');assert.equal(await count('assistance_publications'),2);assert.equal(f.boundary.controller.pending().body,JSON.stringify(command));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal((await f.boundary.controller.retryApproved(prepared.handle)).disposition,'CONFIRMED');assert.equal(await count('assistance_publications'),2);}finally{f.boundary.controller.close();}
});

test('revoked original principal cannot submit or replace its pending response',async()=>{
 const s=await seed('RESEARCH'),f=configured(s),command=responseCommand(s),prepared=await approved(f,command);
 try{assert.equal((await control({kind:'REVOKE_AGENT',ownerId:s.ownerId,agentId:s.agentId})).status,200);const result=await f.boundary.controller.executeApproved(prepared.handle);assert.equal(result.disposition,'UNCERTAIN');assert.equal(result.status,401);assert.equal(await count('assistance_publications'),1);assert.equal(f.boundary.controller.pending().body,JSON.stringify(command));assert.equal((await f.boundary.controller.identify()).disposition,'IDENTITY_UNAVAILABLE');const before=f.calls.length;await assert.rejects(()=>f.boundary.controller.retryApproved(prepared.handle),/IDENTITY_CHANGED/);assert.equal(f.calls.length,before);}finally{f.boundary.controller.close();}
});

test('native cancellation during receipt validation and forged signal objects cannot confirm',async()=>{
 const s=await seed(),f=configured(s),command=responseCommand(s),prepared=await approved(f,command);
 try{
  const result=await f.boundary.controller.executeApproved(prepared.handle);assert.equal(result.disposition,'CONFIRMED');const identity=(await f.boundary.controller.identify()).identity;
  const before=new AbortController();before.abort();await assert.rejects(()=>f.adapter.receiptValidator(result.receipt,{command,identity,signal:before.signal}),error=>error.name==='AbortError');
  const during=new AbortController(),validation=f.adapter.receiptValidator(result.receipt,{command,identity,signal:during.signal});during.abort();await assert.rejects(()=>validation,error=>error.name==='AbortError');
  await assert.rejects(()=>f.adapter.receiptValidator(result.receipt,{command,identity,signal:{aborted:false}}),/INVALID_SIGNAL/);
 }finally{f.boundary.controller.close();}
});

test('private reports use the complete existing receipt validator and disclose neither details nor reporter',async()=>{
 const s=await seed('VENTURE'),f=configured(s),command=responseCommand(s),prepared=await approved(f,command);
 try{
  const published=await f.boundary.controller.executeApproved(prepared.handle),item=published.receipt.item,report={action:'report',requestId:uid(),id:item.id,digest:item.digest,reason:'MISLEADING',details:'Synthetic private assistance report sentinel 347.',policyAccepted:'public-assistance-v1'},pending=f.boundary.controller.prepareWrite('/api/assistance/agent',report);f.boundary.controller.approveWrite(pending.handle,{confirmPublicSharing:true});const result=await f.boundary.controller.executeApproved(pending.handle);
  assert.equal(result.disposition,'CONFIRMED');assert.equal(result.receipt.item,null);assert(!('details'in result.receipt.report));assert(!('reporter'in result.receipt.report));assert(!JSON.stringify(result.receipt).includes(report.details));assert.equal(await count('assistance_reports'),1);assert.throws(()=>f.adapter.checkResponseCommand(report),/COMMAND_REFUSED/);
 }finally{f.boundary.controller.close();}
});
