import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {checkedFixture,handoffFixture,cli,load,M,uid} from './public-contribution-handoff-fixtures.mjs';

const {ContributionRepository}=load('app/contribution-store.ts'),{NetworkRepository}=load('app/network-store.ts'),{createNetworkToken}=load('app/network-model.ts');
const policyAccepted=M.contributionPolicy,ref=item=>({id:item.id,digest:item.digest}),at=()=>new Date(Date.now()-30000).toISOString();
let mf,db,check;
before(async()=>{
 // Fixture injects only synthetic trusted clock; the real agent HTTP/auth/store
 // boundaries execute against isolated local D1. No hosted route/grant proof.
 const source="import {contributionAgentRequest} from './app/contribution-http.ts';import {ContributionRepository} from './app/contribution-store.ts';import {NetworkRepository} from './app/network-store.ts';export default{fetch(request,env){return contributionAgentRequest(request,()=>new ContributionRepository(env.DB),()=>new NetworkRepository(env.DB),()=>request.headers.get('X-Synthetic-Clock'));}};";
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:crypto']});
 mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,d1Databases:['DB'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 check=await checkedFixture();assert.equal(check.report.status,'PASSED');
});
beforeEach(async()=>{for(const table of ['contribution_claim_events','contribution_claims','contribution_task_events','contribution_tasks','network_agents'])await db.prepare('DELETE FROM '+table).run();});
after(async()=>{check?.close();await mf?.dispose();});
async function agent(sponsor,time){const credential=await createNetworkToken(),registration={action:'register',requestId:uid(),id:uid(),credentialId:credential.credentialId,name:'Synthetic public handoff agent',tokenDigest:credential.tokenDigest,days:7};await new NetworkRepository(db).write(sponsor,registration,time);return {sponsor,registration,token:credential.token};}
async function request(agent,command,time=at()){return mf.dispatchFetch('https://synthetic.opengrail.invalid/api/contributions/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+agent.token,'X-Synthetic-Clock':time},body:JSON.stringify(command)});}
async function fixture(){
 const time=at(),maintainer={kind:'HUMAN',userId:'synthetic-public-handoff-curator',maintainer:true},register={action:'register',requestId:uid(),id:uid(),title:'Synthetic public contribution handoff',summary:'An isolated public-issue mapping with digest-only submission.',kind:'TESTS',acceptance:['Claimant can submit exact artifact digest.'],rejection:['Foreign authors or changed retries gain no authority.'],policyAccepted},repo=new ContributionRepository(db),task=(await repo.write(maintainer,register,time)).task,owner=await agent('synthetic-public-handoff-owner',time),foreign=await agent('synthetic-public-handoff-foreign',time),claimCommand={action:'claim',requestId:uid(),id:uid(),task:ref(task),expectedTaskSequence:0,policyAccepted},claimed=await request(owner,claimCommand,time);assert.equal(claimed.status,200);const receipt=await claimed.json();
 const f=await handoffFixture(check,{task:{version:1,item:receipt.task,executionEnabled:false},claim:{version:1,task:receipt.task,item:receipt.claim,executionEnabled:false}}),prepared=cli(f);assert.equal(prepared.status,0,prepared.stderr);const digest=JSON.parse(prepared.stdout).handoffDigest,command={action:'submit',requestId:uid(),task:ref(task),claim:ref(receipt.claim),expectedSequence:0,handoffDigest:digest,policyAccepted};return {time,maintainer,repo,task:receipt.task,claim:receipt.claim,owner,foreign,command,f,digest};
}
const events=async()=>Number((await db.prepare('SELECT COUNT(*) AS n FROM contribution_claim_events').first()).n);

test('actual local registered agent submits prepared public digest once; identical lost-ack retries retain one event and confer no CI/merge/reputation trust',async()=>{
 const s=await fixture();try{
  // Deliberately discard the first successful receipt to model an uncertain ACK.
  const committed=await request(s.owner,s.command,s.time);assert.equal(committed.status,200);await committed.arrayBuffer();
  const retry=await request(s.owner,s.command,s.time);assert.equal(retry.status,200);const reconciled=await retry.json(),again=await (await request(s.owner,s.command,s.time)).json();assert.deepEqual(reconciled,again);assert.equal(await events(),1);assert.equal(reconciled.claim.status,'SUBMITTED');assert.equal(reconciled.claim.handoffDigest,s.digest);assert.equal(reconciled.executionEnabled,false);assert.equal(reconciled.claim.events[0].handoffDigest,s.digest);assert.equal(reconciled.claim.events[0].state,'SUBMITTED');
  for(const field of ['ciVerified','merged','reputation','researchQualified','mergeApproved'])assert.equal(reconciled[field],undefined);
  const verified=cli(s.f,'verify',[s.f.paths.output,s.digest]);assert.equal(verified.status,0);assert.equal(JSON.parse(verified.stdout).ciStatus,'UNAVAILABLE');
 }finally{s.f.close();}
});

test('foreign agent, changed handoff retry and cross-action request collision cannot replace the original public contribution event',async()=>{
 const s=await fixture();try{
  assert.equal((await request(s.foreign,s.command,s.time)).status,403);assert.equal(await events(),0);assert.equal((await request(s.owner,s.command,s.time)).status,200);
  assert.equal((await request(s.owner,{...s.command,handoffDigest:'e'.repeat(64)},s.time)).status,409);
  const {handoffDigest,...release}=s.command;assert.equal((await request(s.owner,{...release,action:'release',reason:'AUTHOR_RELEASE'},s.time)).status,409);assert.equal(await events(),1);
  const stored=await s.repo.getClaim(s.claim.id,s.time);assert.equal(stored.item.handoffDigest,s.digest);assert.equal(stored.item.status,'SUBMITTED');
 }finally{s.f.close();}
});

test('expired and closed claims reject new public handoff submission; historical offline artifact integrity is not a current lease',async()=>{
 const s=await fixture();try{
  const expiredAt=new Date(Date.parse(s.claim.expiresAt)+1).toISOString();assert.equal((await request(s.owner,s.command,expiredAt)).status,409);assert.equal(await events(),0);
  await s.repo.write(s.maintainer,{action:'close',requestId:uid(),task:ref(s.task),expectedSequence:0,reason:'MAINTAINER_CLOSED',policyAccepted},s.time);assert.equal((await request(s.owner,s.command,s.time)).status,409);assert.equal(await events(),0);
  assert.equal(cli(s.f,'verify',[s.f.paths.output,s.digest]).status,0);
 }finally{s.f.close();}
});

test('current credential revocation blocks original digest submission and previously committed receipt replay',async()=>{
 const s=await fixture();try{
  assert.equal((await request(s.owner,s.command,s.time)).status,200);await new NetworkRepository(db).write(s.owner.sponsor,{action:'revoke',requestId:uid(),id:s.owner.registration.id,revision:1},s.time);assert.equal((await request(s.owner,s.command,s.time)).status,401);assert.equal(await events(),1);
 }finally{s.f.close();}
});
