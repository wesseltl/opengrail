import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(m,m.exports,id=>id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id));return m.exports;}
const M=load('app/contribution-model.ts'),H=load('app/contribution-http.ts'),{ContributionRepository}=load('app/contribution-store.ts'),{NetworkRepository}=load('app/network-store.ts'),N=load('app/network-model.ts');
const at=new Date().toISOString(),origin='https://opengrail-fixture.test',maintainer='fixture-maintainer';
// Actual local Worker/handlers and D1. Fixture identity headers are not hosted OAuth.
const source=`import * as h from './app/contribution-http';import {ContributionRepository} from './app/contribution-store';import {NetworkRepository} from './app/network-store';import {contributionMaintainerAllowed} from './app/contribution-permission';
export default {fetch(request,env){const actor=request.headers.get('X-Fixture-Actor'),user=actor?{userId:actor}:null,path=new URL(request.url).pathname,factory=()=>new ContributionRepository(env.DB),maintainer=id=>contributionMaintainerAllowed(id,env.FIXTURE_MAINTAINERS),now=()=>env.FIXTURE_AT;
if(path==='/api/contributions/me')return h.contributionMeRequest(request,user,maintainer);
if(path==='/api/contributions/agent')return h.contributionAgentRequest(request,factory,()=>new NetworkRepository(env.DB),now);
return request.method==='GET'?h.contributionPublicRequest(request,factory,now):h.contributionHumanRequest(request,user,factory,maintainer,now);}};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:crypto'],write:false});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIXTURE_AT:at,FIXTURE_MAINTAINERS:JSON.stringify([maintainer])}});let db;
before(async()=>{db=await mf.getD1Database('DB');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint').map(value=>value.trim()).filter(Boolean))await db.prepare(sql).run();});after(()=>mf.dispose());
const uid=()=>randomUUID(),ref=item=>({id:item.id,digest:item.digest});
function register(){return {action:'register',requestId:uid(),id:uid(),title:'Synthetic contribution task',summary:'Invented public task; no real issue or source access.',kind:'TESTS',acceptance:['Exact fixture rejection is retained.'],rejection:['A changed retry replaces an accepted operation.'],policyAccepted:M.contributionPolicy};}
async function seed(){return (await new ContributionRepository(db).write({kind:'HUMAN',userId:uid(),maintainer:true},register(),at)).task;}
async function human(command,user=uid(),options={}){const id=await M.contributionPublicHumanId(user),headers={'Content-Type':'application/json',Origin:origin,'X-Contribution-Intent':'submit','X-Contribution-Author':id,'X-Fixture-Actor':user,...options.headers};return mf.dispatchFetch(origin+'/api/contributions'+(options.query??''),{method:options.method??'POST',headers,body:options.body??JSON.stringify(command)});}
async function agent(){const owner=uid(),token=await N.createNetworkToken(),command={action:'register',requestId:uid(),id:uid(),credentialId:token.credentialId,tokenDigest:token.tokenDigest,name:'Synthetic contribution agent',days:7};await new NetworkRepository(db).write(owner,command,at);return {owner,token:token.token,id:command.id};}
const claim=task=>({action:'claim',requestId:uid(),id:uid(),task:ref(task),expectedTaskSequence:task.sequence,policyAccepted:M.contributionPolicy});
async function machine(command,token,options={}){return mf.dispatchFetch((options.origin??origin)+'/api/contributions/agent'+(options.query??''),{method:options.method??'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...options.headers},body:options.body??JSON.stringify(command)});}

test('actual Worker exposes public tasks and separately pinned human identity without implicit maintainer grant',async()=>{
 const task=await seed(),response=await mf.dispatchFetch(origin+'/api/contributions?id='+task.id);assert.equal(response.status,200);assert.equal(M.contributionGetSchema.parse(await response.json()).item.digest,task.digest);assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.equal((await mf.dispatchFetch(origin+'/api/contributions/me')).status,401);
 const me=await mf.dispatchFetch(origin+'/api/contributions/me',{headers:{'X-Fixture-Actor':'fixture-ordinary'}});assert.equal(me.status,200);assert.equal((await me.json()).maintainer,false);
 assert.equal((await human(register(),'fixture-ordinary')).status,403);
 const created=await human(register(),maintainer);assert.equal(created.status,200);assert.equal((await created.json()).action,'register');
});
test('actual human command admission rejects foreign account, origin, intent, duplicate keys and oversized input',async()=>{
 const task=await seed(),sent=claim(task),user=uid();
 for(const options of [{headers:{'X-Contribution-Author':'human_'+'a'.repeat(64)}},{headers:{Origin:'https://foreign.test'}},{headers:{'X-Contribution-Intent':'other'}}])assert.equal((await human(sent,user,options)).status,403);
 assert.equal((await human(sent,user,{query:'?token=forbidden'})).status,400);
 assert.equal((await human(sent,user,{body:'{"action":"claim","action":"release"}'})).status,400);
 assert.equal((await human(sent,user,{body:' '.repeat(M.contributionLimits.requestBytes+1)})).status,413);
 assert.equal((await human({...sent,authorId:user},user)).status,400);
 assert.equal((await human(sent,user,{headers:{'Content-Type':'text/plain'}})).status,415);
 const rows=await db.prepare('SELECT count(*) AS count FROM contribution_claims WHERE task_id=?').bind(task.id).first();assert.equal(rows.count,0);
});
test('actual sponsored agent claims, submits digest only and reconciles historical receipts after hiding',async()=>{
 const task=await seed(),identity=await agent(),sent=claim(task),first=await machine(sent,identity.token);assert.equal(first.status,200);const written=M.contributionWriteSchema.parse(await first.json());assert.equal(written.claim.author.id,identity.id);assert(!JSON.stringify(written).includes(identity.owner));assert(!JSON.stringify(written).includes(identity.token));
 const submission={action:'submit',requestId:uid(),task:ref(task),claim:ref(written.claim),expectedSequence:0,handoffDigest:'e'.repeat(64),policyAccepted:M.contributionPolicy};
 const accepted=await machine(submission,identity.token);assert.equal(accepted.status,200);assert.equal((await accepted.json()).claim.status,'SUBMITTED');
 const hidden=await human({action:'hide',requestId:uid(),task:ref(task),expectedSequence:0,reason:'POLICY',policyAccepted:M.contributionPolicy},maintainer);assert.equal(hidden.status,200);
 for(const command of [sent,submission]){const retry=await machine(command,identity.token);assert.equal(retry.status,200);const receipt=await retry.json();assert.equal(receipt.task.record,null);assert.equal(receipt.claim.record,null);assert.equal(receipt.claim.handoffDigest,null);assert.deepEqual(receipt.claim.events,[]);await M.validateContributionWrite(receipt,command,{kind:'AGENT',id:identity.id,sponsorId:await M.contributionPublicHumanId(identity.owner)});}
 const publicClaims=await mf.dispatchFetch(origin+'/api/contributions?task='+task.id+'&digest='+task.digest);assert.equal(publicClaims.status,200);const page=await publicClaims.json();assert.equal(page.items[0].record,null);assert(!JSON.stringify(page).includes(submission.handoffDigest));
});
test('agents cannot curate/review, authenticate over HTTP, include credentials in query or write after revocation',async()=>{
 const task=await seed(),identity=await agent();assert.equal((await machine(register(),identity.token)).status,403);assert.equal((await machine(claim(task),identity.token,{origin:'http://opengrail-fixture.test'})).status,403);assert.equal((await machine(claim(task),identity.token,{query:'?credential=forbidden'})).status,400);assert.equal((await machine(claim(task),identity.token,{headers:{Origin:'https://foreign.test'}})).status,403);
 const sent=claim(task),accepted=await machine(sent,identity.token);assert.equal(accepted.status,200);
 await new NetworkRepository(db).write(identity.owner,{action:'revoke',requestId:uid(),id:identity.id,revision:1},at);
 const retry=await machine(sent,identity.token);assert.equal(retry.status,401);assert.equal(retry.headers.get('WWW-Authenticate'),'Bearer');
});
test('actual task/claim reads reject mixed, duplicate and cross-task cursors without guessing targets',async()=>{
 const task=await seed(),other=await seed(),identity=await agent(),receipt=await machine(claim(other),identity.token);assert.equal(receipt.status,200);const selected=(await receipt.json()).claim;
 for(const query of ['?id='+task.id+'&cursor='+task.id,'?id='+task.id+'&id='+task.id,'?task='+task.id,'?task='+task.id+'&digest=bad','?cursor=','?unknown=1','?claim='+selected.id+'&task='+other.id])assert.equal((await mf.dispatchFetch(origin+'/api/contributions'+query)).status,400);
 assert.equal((await mf.dispatchFetch(origin+'/api/contributions?task='+task.id+'&digest='+task.digest+'&cursor='+selected.id)).status,404);
 const exact=await mf.dispatchFetch(origin+'/api/contributions?claim='+selected.id);assert.equal(exact.status,200);assert.equal((await exact.json()).item.id,selected.id);
});
test('server projection corruption and altered post-commit acknowledgments are unavailable rather than definitive caller rejection',async()=>{
 const task=await seed(),repo=new ContributionRepository(db);
 const corrupted={list:async()=>({version:1,items:[{...task,digest:'f'.repeat(64)}],nextCursor:null,executionEnabled:false})};
 const response=await H.contributionPublicRequest(new Request(origin+'/api/contributions'),()=>corrupted,()=>at);assert.equal(response.status,503);assert(!JSON.stringify(await response.json()).includes(task.record.content.summary));
 const user=uid(),sent=claim(task),headers={'Content-Type':'application/json',Origin:origin,'X-Contribution-Intent':'submit','X-Contribution-Author':await M.contributionPublicHumanId(user)};
 const wrong={write:async(...args)=>{const result=await repo.write(...args);return {...result,acknowledgement:{...result.acknowledgement,digest:'f'.repeat(64)}};}};
 const uncertain=await H.contributionHumanRequest(new Request(origin+'/api/contributions',{method:'POST',headers,body:JSON.stringify(sent)}),{userId:user},()=>wrong,()=>false,()=>at);assert.equal(uncertain.status,503);
 const retry=await human(sent,user);assert.equal(retry.status,200);assert.equal((await retry.json()).claim.id,sent.id);
 const count=await db.prepare('SELECT count(*) AS count FROM contribution_claims WHERE task_id=?').bind(task.id).first();assert.equal(count.count,1);
});
test('human curation permission is rechecked before releasing a privileged acknowledgment',async()=>{
 const sent=register();let checks=0;const user=uid(),headers={'Content-Type':'application/json',Origin:origin,'X-Contribution-Intent':'submit','X-Contribution-Author':await M.contributionPublicHumanId(user)};
 const response=await H.contributionHumanRequest(new Request(origin+'/api/contributions',{method:'POST',headers,body:JSON.stringify(sent)}),{userId:user},()=>new ContributionRepository(db),()=>++checks===1,()=>at);assert.equal(response.status,403);
 const row=await db.prepare('SELECT count(*) AS count FROM contribution_tasks WHERE id=?').bind(sent.id).first();assert.equal(row.count,1);assert.equal(checks,2);
});

async function revisionHttpFixture(machineActor=false){
 const task=await seed(),participant=machineActor?await agent():{owner:uid()},send=command=>machineActor?machine(command,participant.token):human(command,participant.owner),first=await send(claim(task));assert.equal(first.status,200);const original=(await first.json()).claim;
 const submitted=await send({action:'submit',requestId:uid(),task:ref(task),claim:ref(original),expectedSequence:0,handoffDigest:'a'.repeat(64),policyAccepted:M.contributionPolicy});assert.equal(submitted.status,200);const current=(await submitted.json()).claim;
 const review=await human({action:'review',requestId:uid(),task:ref(task),claim:ref(current),expectedSequence:1,decision:'CHANGES_REQUESTED',reason:'NEEDS_CHANGES',policyAccepted:M.contributionPolicy},maintainer);assert.equal(review.status,200);const previous=(await review.json()).claim;
 const command={...claim(task),version:2,revisionOf:{claim:ref(previous),review:{sequence:2,digest:previous.events[1].digest}}};return {task,participant,send,previous,command};
}

test('actual Worker admits exact human revision and preserves V1 receipt envelope',async()=>{
 const f=await revisionHttpFixture(),response=await f.send(f.command);assert.equal(response.status,200);const raw=await response.json(),actor={kind:'HUMAN',id:await M.contributionPublicHumanId(f.participant.owner),sponsorId:await M.contributionPublicHumanId(f.participant.owner)};await M.validateContributionWrite(raw,f.command,actor);assert.equal(raw.version,1);assert.equal(raw.claim.record.version,2);assert.deepEqual(raw.claim.record.revisionOf,f.command.revisionOf);
 const retry=await f.send(f.command);assert.equal(retry.status,200);assert.deepEqual((await retry.json()).acknowledgement,raw.acknowledgement);
 const wrong=await f.send({...f.command,revisionOf:{...f.command.revisionOf,review:{sequence:2,digest:'f'.repeat(64)}}});assert.equal(wrong.status,409);
 const read=await mf.dispatchFetch(origin+'/api/contributions?claim='+f.command.id);assert.equal(read.status,200);assert.deepEqual((await read.json()).item.record.revisionOf,f.command.revisionOf);
});

test('agent revision HTTP cannot be authored by sponsor or a different agent',async()=>{
 const f=await revisionHttpFixture(true),sponsor=await human({...f.command,id:uid(),requestId:uid()},f.participant.owner);assert.equal(sponsor.status,403);const other=await agent();assert.equal((await machine({...f.command,id:uid(),requestId:uid()},other.token)).status,403);
 assert.equal((await machine(f.command,f.participant.token,{origin:'http://opengrail-fixture.test'})).status,403);assert.equal((await machine(f.command,f.participant.token,{query:'?author=spoof'})).status,400);
 const response=await f.send(f.command);assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.claim.author.kind,'AGENT');assert.equal(receipt.claim.author.id,f.participant.id);assert.deepEqual(receipt.claim.record.revisionOf,f.command.revisionOf);
 const after=await mf.dispatchFetch(origin+'/api/contributions?claim='+f.previous.id);assert.equal((await after.json()).item.status,'CHANGES_REQUESTED');
});

test('postcommit corrupted lineage is HTTP unavailable while accepted new row is retained',async()=>{
 const f=await revisionHttpFixture(),repo=new ContributionRepository(db),factory={write:async(...args)=>{const retained=await repo.write(...args);await db.prepare('DELETE FROM contribution_claim_events WHERE claim_id=? AND sequence=2').bind(f.previous.id).run();return retained;},confirmRevisionReceipt:repo.confirmRevisionReceipt.bind(repo)},headers={'Content-Type':'application/json',Origin:origin,'X-Contribution-Intent':'submit','X-Contribution-Author':await M.contributionPublicHumanId(f.participant.owner)};
 // The initially correlated body becomes stale after commit, before the HTTP
 // handler's closing observation. A syntactically valid old receipt is refused.
 const response=await H.contributionHumanRequest(new Request(origin+'/api/contributions',{method:'POST',headers,body:JSON.stringify(f.command)}),{userId:f.participant.owner},()=>factory,()=>false,()=>at);assert.equal(response.status,503);const count=await db.prepare('SELECT COUNT(*) AS n FROM contribution_claims WHERE id=?').bind(f.command.id).first();assert.equal(count.n,1);const read=await mf.dispatchFetch(origin+'/api/contributions?claim='+f.command.id);assert.equal(read.status,503);assert.equal((await f.send(f.command)).status,503);
});
