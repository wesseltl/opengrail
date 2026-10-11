import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let model,directory;
const uid=()=>crypto.randomUUID(),hash='a'.repeat(64),policy='public-contributions-v1';
const human=n=>({kind:'HUMAN',id:'human_'+String(n).repeat(64),sponsorId:'human_'+String(n).repeat(64)});
const agent=()=>({kind:'AGENT',id:uid(),sponsorId:human(3).id});
const at='2026-10-11T00:00:00.000Z',claimedAt='2026-10-11T00:01:00.000Z',submittedAt='2026-10-11T00:02:00.000Z',reviewedAt='2026-10-11T00:03:00.000Z',checkedAt='2026-10-11T00:04:00.000Z';
const ref=item=>({id:item.id,digest:item.digest});
before(async()=>{directory=mkdtempSync(join(tmpdir(),'opengrail-contribution-model-'));const file=join(directory,'model.mjs');await build({entryPoints:['app/contribution-model.ts'],outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'silent'});model=await import(pathToFileURL(file).href);});
after(()=>{rmSync(directory,{recursive:true,force:true});});

async function fixture(){
 const curator=human(1),author=agent();
 const register={action:'register',requestId:uid(),id:uid(),title:'Synthetic bounded task',summary:'Invented task for local model verification only.',kind:'TESTS',acceptance:['Retain a negative fixture.'],rejection:['Reject a changed source reference.'],policyAccepted:policy};
 const record=model.contributionTaskRecordForCommand(register,curator,at),digest=await model.contributionDigest(model.boundedContributionTaskRecord(record).payload);
 const task={id:record.id,digest,requestId:record.requestId,createdAt:record.createdAt,author:curator,state:'OPEN',sequence:0,reason:null,record,events:[]};
 const claim={action:'claim',requestId:uid(),id:uid(),task:ref(task),expectedTaskSequence:0,policyAccepted:policy};
 const claimRecord=model.contributionClaimRecordForCommand(claim,author,claimedAt),claimDigest=await model.contributionDigest(model.boundedContributionClaimRecord(claimRecord).payload);
 const item={id:claimRecord.id,digest:claimDigest,requestId:claimRecord.requestId,createdAt:claimRecord.createdAt,expiresAt:claimRecord.expiresAt,checkedAt,author,task:ref(task),taskState:'OPEN',sequence:0,status:'ACTIVE',handoffDigest:null,reason:null,record:claimRecord,events:[]};
 return {curator,author,register,task,claim,item};
}
async function event(command,actor,time){const record=model.contributionEventRecordForCommand(command,actor,time);return {...record,digest:await model.contributionDigest(model.boundedContributionRecord(record).payload)};}
async function submit(f,options={}){
 const command={action:'submit',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:f.item.sequence,handoffDigest:hash,policyAccepted:policy,...options};
 const e=await event(command,f.author,submittedAt);f.item={...f.item,sequence:1,status:'SUBMITTED',handoffDigest:command.handoffDigest,events:[e]};return command;
}
async function review(f,decision='ACCEPTED',reason='ACCEPTANCE_MET',options={}){
 const command={action:'review',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:1,decision,reason,policyAccepted:policy,...options};const e=await event(command,f.curator,reviewedAt);f.item={...f.item,sequence:2,status:decision,reason,events:[...f.item.events,e]};return command;
}
async function hide(f,time='2026-10-11T00:05:00.000Z'){
 const command={action:'hide',requestId:uid(),task:ref(f.task),expectedSequence:f.task.sequence,reason:'POLICY',policyAccepted:policy};const e=await event(command,f.curator,time);
 f.task={...f.task,state:'HIDDEN',sequence:f.task.sequence+1,reason:'POLICY',record:null,events:[...f.task.events,e]};f.item={...f.item,taskState:'HIDDEN',record:null,handoffDigest:null,reason:null,events:[]};return command;
}
async function receipt(f,command,actor,time){
 const canonical=model.boundedContributionCommand(command);let digest,sequence;
 if(command.action==='register'){digest=f.task.digest;sequence=0;}else if(command.action==='claim'){digest=f.item.digest;sequence=0;}else{const e=await event(command,actor,time);digest=e.digest;sequence=e.sequence;}
 const taskOnly=['register','close','hide'].includes(command.action);
 return {version:1,action:command.action,requestId:command.requestId,task:f.task,claim:taskOnly?null:f.item,acknowledgement:{action:command.action,requestId:command.requestId,actor,task:ref(f.task),claim:taskOnly?null:ref(f.item),sequence,createdAt:time,commandDigest:await model.contributionDigest(canonical.payload),digest},executionEnabled:false};
}

test('canonical immutable task and exact 72-hour claim round-trip without role or execution grants',async()=>{
 const f=await fixture();assert.deepEqual(model.contributionTaskCommandForRecord(f.task.record),model.boundedContributionCommand(f.register).command);assert.deepEqual(model.contributionClaimCommandForRecord(f.item.record),model.boundedContributionCommand(f.claim).command);
 assert.equal(Date.parse(f.item.expiresAt)-Date.parse(f.item.createdAt),72*3600000);assert.deepEqual(await model.validateContributionTaskItem(f.task),f.task);assert.deepEqual(await model.validateContributionClaimItem(f.item),f.item);assert.equal(f.task.record.executionEnabled,false);assert.equal(f.item.record.executionEnabled,false);
 assert.equal(await model.contributionPublicHumanId('synthetic-sponsor'),await model.contributionPublicHumanId('synthetic-sponsor'));
});

test('canonical command and record bytes ignore raw object key order while preserving criteria order',async()=>{
 const f=await fixture();const reordered=Object.fromEntries(Object.entries(f.register).reverse());assert.equal(model.boundedContributionCommand(reordered).payload,model.boundedContributionCommand(f.register).payload);
 const reversedRecord=Object.fromEntries(Object.entries(f.task.record).reverse());assert.equal(model.boundedContributionTaskRecord(reversedRecord).payload,model.boundedContributionTaskRecord(f.task.record).payload);
 const changed={...f.register,acceptance:['First retained case.','Second retained case.']};const reversed={...changed,acceptance:[...changed.acceptance].reverse()};assert.notEqual(await model.contributionDigest(model.boundedContributionCommand(changed).payload),await model.contributionDigest(model.boundedContributionCommand(reversed).payload));
});

test('strict command admission rejects forged identity, privileges, timestamps and private submission metadata',async()=>{
 const f=await fixture();const sub={action:'submit',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:0,handoffDigest:hash,policyAccepted:policy};
 for(const command of [f.register,f.claim,sub])for(const extra of [{author:f.author},{maintainer:true},{executionEnabled:true},{createdAt:at},{expiresAt:at},{repository:'private/repo'},{pullRequest:1},{url:'https://github.com/private/repo/pull/1'},{evidence:{status:'CI_VERIFIED'}}])assert.throws(()=>model.boundedContributionCommand({...command,...extra}));
 for(const patch of [{handoffDigest:hash.toUpperCase()},{handoffDigest:'not-a-digest'},{expectedSequence:-1},{expectedSequence:1.2},{policyAccepted:'different-policy'}])assert.throws(()=>model.boundedContributionCommand({...sub,...patch}));
 assert.throws(()=>model.boundedContributionCommand({...f.claim,id:f.task.id}));
});

test('public task descriptions and criteria are finite and reject duplicate or credential-shaped material',async()=>{
 const f=await fixture();for(const patch of [{title:''},{title:'x'.repeat(121)},{summary:'x'.repeat(2001)},{acceptance:[]},{rejection:Array(9).fill('Distinct bound violation.')},{acceptance:['Same','Same']},{kind:'EXECUTE'},{summary:'invalid\u0000control'}])assert.throws(()=>model.boundedContributionCommand({...f.register,...patch}));
 for(const secret of ['og_agent_'+uid()+'.'+'a'.repeat(64),'github_pat_'+'A'.repeat(64),'ghp_'+'B'.repeat(36),'og_local_owner_'+'c'.repeat(64)])for(const value of [secret,encodeURIComponent(encodeURIComponent(secret))])assert.throws(()=>model.boundedContributionCommand({...f.register,summary:value}),error=>!error.message.includes(secret));
});

test('plain-data admission rejects getters, custom serialization, hidden fields, symbols, sparse arrays and cycles',async()=>{
 const f=await fixture();let calls=0;const getter={...f.register};Object.defineProperty(getter,'title',{enumerable:true,get(){calls++;return 'Unsafe';}});assert.throws(()=>model.boundedContributionCommand(getter));assert.equal(calls,0);
 const serialized={...f.register,toJSON(){calls++;return f.register;}};assert.throws(()=>model.boundedContributionCommand(serialized));assert.equal(calls,0);
 const hidden={...f.register};Object.defineProperty(hidden,'extra',{value:'hidden',enumerable:false});assert.throws(()=>model.boundedContributionCommand(hidden));const symbolic={...f.register,[Symbol('extra')]:'hidden'};assert.throws(()=>model.boundedContributionCommand(symbolic));assert.throws(()=>model.boundedContributionCommand({...f.register,acceptance:new Array(2)}));
 const cycle={};cycle.self=cycle;assert.throws(()=>model.boundedContributionCommand(cycle));assert.throws(()=>model.boundedContributionCommand({...f.register,numeric:Infinity}));
 let deep=0;for(let n=0;n<20;n++)deep={next:deep};assert.throws(()=>model.boundedContributionCommand(deep));
});

test('byte bounds apply before normalization and require fixed human task authors and canonical leases',async()=>{
 const f=await fixture();assert.throws(()=>model.boundedContributionCommand({...f.register,title:' '.repeat(model.contributionLimits.requestBytes)+'x'}),error=>error.status===413);assert.throws(()=>model.boundedContributionTaskRecord({...f.task.record,author:f.author}));assert.throws(()=>model.boundedContributionTaskRecord({...f.task.record,author:{...f.curator,sponsorId:human(2).id}}));
 for(const expiresAt of [f.item.createdAt,new Date(Date.parse(f.item.createdAt)+71*3600000).toISOString(),new Date(Date.parse(f.item.createdAt)+73*3600000).toISOString()])assert.throws(()=>model.boundedContributionClaimRecord({...f.item.record,expiresAt}));
 assert.throws(()=>model.boundedContributionClaimRecord({...f.item.record,createdAt:'2026-10-11T00:01:00Z'}));
});

test('task lifecycle permits terminal close then privacy hide and rejects reopen, duplicate or foreign events',async()=>{
 const f=await fixture();const command={action:'close',requestId:uid(),task:ref(f.task),expectedSequence:0,reason:'MAINTAINER_CLOSED',policyAccepted:policy};const e=await event(command,f.curator,submittedAt);f.task={...f.task,state:'CLOSED',sequence:1,reason:e.reason,events:[e]};await model.validateContributionTaskItem(f.task);await hide(f);await model.validateContributionTaskItem(f.task);
 assert.throws(()=>model.contributionTaskItemSchema.parse({...f.task,state:'OPEN'}));
 for(const change of [x=>x.events[1].expectedSequence=0,x=>x.events[1].task.digest='b'.repeat(64),x=>x.events[1].requestId=x.events[0].requestId,x=>x.events.reverse(),x=>x.sequence=0,x=>x.reason='OUT_OF_SCOPE']){const invalid=structuredClone(f.task);change(invalid);assert.throws(()=>model.contributionTaskItemSchema.parse(invalid));}
});

test('claim submission and all maintainer dispositions retain exact evidence and terminate the attempt',async()=>{
 for(const [decision,reason] of [['ACCEPTED','ACCEPTANCE_MET'],['CHANGES_REQUESTED','NEEDS_CHANGES'],['REJECTED','FAILED_ACCEPTANCE']]){
  const f=await fixture();await submit(f);const command=await review(f,decision,reason);await model.validateContributionClaimItem(f.item);assert.equal(f.item.handoffDigest,hash);assert.equal(f.item.status,decision);const {digest,...body}=f.item.events.at(-1);assert.match(digest,/^[a-f0-9]{64}$/);assert.deepEqual(model.contributionEventCommandForRecord(body),model.boundedContributionCommand(command).command);
  const later={action:'submit',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:2,handoffDigest:'b'.repeat(64),policyAccepted:policy};const e=await event(later,f.author,checkedAt);assert.throws(()=>model.contributionClaimItemSchema.parse({...f.item,sequence:3,status:'SUBMITTED',reason:null,events:[...f.item.events,e],handoffDigest:later.handoffDigest}));
 }
});

test('lease expiration has an exact boundary and cannot erase terminal adverse or accepted decisions',async()=>{
 for(const submitted of [false,true]){const f=await fixture();if(submitted)await submit(f);const expired={...f.item,checkedAt:f.item.expiresAt,status:'EXPIRED'};await model.validateContributionClaimItem(expired);assert.throws(()=>model.contributionClaimItemSchema.parse({...expired,status:submitted?'SUBMITTED':'ACTIVE'}));assert.throws(()=>model.contributionClaimItemSchema.parse({...expired,checkedAt}));}
 const terminal=await fixture();await submit(terminal);await review(terminal,'REJECTED','FAILED_ACCEPTANCE');await model.validateContributionClaimItem({...terminal.item,checkedAt:terminal.item.expiresAt});assert.throws(()=>model.contributionClaimItemSchema.parse({...terminal.item,checkedAt:terminal.item.expiresAt,status:'EXPIRED'}));
 const late=await fixture();await submit(late);const invalid=structuredClone(late.item);invalid.events[0].createdAt=late.item.expiresAt;invalid.checkedAt=late.item.expiresAt;invalid.status='EXPIRED';assert.throws(()=>model.contributionClaimItemSchema.parse(invalid));
});

test('release is limited to author or actual human sponsor and preserves submission history',async()=>{
 for(const sponsor of [false,true]){const f=await fixture();await submit(f);const actor=sponsor?human(3):f.author,command={action:'release',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:1,reason:sponsor?'SPONSOR_RELEASE':'AUTHOR_RELEASE',policyAccepted:policy};const e=await event(command,actor,reviewedAt);const released={...f.item,sequence:2,status:'RELEASED',reason:command.reason,events:[...f.item.events,e]};await model.validateContributionClaimItem(released);assert.equal(released.handoffDigest,hash);
  const invalid=structuredClone(released);invalid.events[1].actor=human(9);assert.throws(()=>model.contributionClaimItemSchema.parse(invalid));
 }
});

test('canonical human release history requires author release even when its sponsor identity matches',async()=>{
 const f=await fixture();f.author=human(3);const record=model.contributionClaimRecordForCommand(f.claim,f.author,claimedAt);
 f.item={...f.item,author:f.author,record,digest:await model.contributionDigest(model.boundedContributionClaimRecord(record).payload)};await submit(f);await model.validateContributionClaimItem(f.item);
 for(const reason of ['AUTHOR_RELEASE','SPONSOR_RELEASE']){
  const command={action:'release',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:1,reason,policyAccepted:policy},e=await event(command,f.author,reviewedAt);
  const released={...f.item,sequence:2,status:'RELEASED',reason,events:[...f.item.events,e]},ack=await receipt({...f,item:released},command,f.author,reviewedAt);
  const {digest,...body}=e;assert.equal(digest,await model.contributionDigest(model.boundedContributionClaimEventRecord(body).payload));
  if(reason==='AUTHOR_RELEASE'){await model.validateContributionClaimItem(released);await model.validateContributionWrite(ack,command,f.author);}
  else{await assert.rejects(model.validateContributionClaimItem(released));await assert.rejects(model.validateContributionWrite(ack,command,f.author));}
 }
});

test('actor-scoped request UUIDs permit a human sponsor reusing an agent UUID without granting authorship',async()=>{
 const f=await fixture();await submit(f);const command={action:'release',requestId:f.claim.requestId,task:ref(f.task),claim:ref(f.item),expectedSequence:1,reason:'SPONSOR_RELEASE',policyAccepted:policy};const e=await event(command,human(3),reviewedAt);f.item={...f.item,sequence:2,status:'RELEASED',reason:command.reason,events:[...f.item.events,e]};await model.validateContributionClaimItem(f.item);const ack=await receipt(f,command,human(3),reviewedAt);await model.validateContributionWrite(ack,command,human(3));assert.equal(f.item.author.kind,'AGENT');
 const task=await fixture();const close={action:'close',requestId:task.register.requestId,task:ref(task.task),expectedSequence:0,reason:'MAINTAINER_CLOSED',policyAccepted:policy};const closeEvent=await event(close,human(2),submittedAt);task.task={...task.task,state:'CLOSED',sequence:1,reason:close.reason,events:[closeEvent]};await model.validateContributionTaskItem(task.task);
});

test('hidden parent suppresses dependent payloads and rejects impossible temporal states',async()=>{
 const f=await fixture();await submit(f);await hide(f);await model.validateContributionTaskItem(f.task);await model.validateContributionClaimItem(f.item);
 for(const patch of [{handoffDigest:hash},{reason:'ACCEPTANCE_MET'},{record:(await fixture()).item.record},{events:[(await fixture()).item]},{status:'EXPIRED'},{status:'ACTIVE',checkedAt:f.item.expiresAt},{status:'SUBMITTED',checkedAt:f.item.expiresAt}])assert.throws(()=>model.contributionClaimItemSchema.parse({...f.item,...patch}));
 await model.validateContributionClaimItem({...f.item,status:'EXPIRED',checkedAt:f.item.expiresAt});
});

test('canonical public record and event validators reject tampered bytes even when outer identity still matches',async()=>{
 const f=await fixture();const badTask=structuredClone(f.task);badTask.record.content.summary='Different retained bytes.';await assert.rejects(model.validateContributionTaskItem(badTask),/digest/);
 const badClaim=structuredClone(f.item);badClaim.record.author.sponsorId=human(9).id;badClaim.author.sponsorId=human(9).id;await assert.rejects(model.validateContributionClaimItem(badClaim),/digest/);
 await submit(f);const eventTamper=structuredClone(f.item);eventTamper.events[0].handoffDigest='b'.repeat(64);eventTamper.handoffDigest='b'.repeat(64);await assert.rejects(model.validateContributionClaimItem(eventTamper),/digest/);
});

test('public page contracts reject duplicate identities, incorrect order/cursors and mixed parent refs',async()=>{
 const f=await fixture();const list={version:1,items:[f.task],nextCursor:null,executionEnabled:false};model.contributionListSchema.parse(list);assert.throws(()=>model.contributionListSchema.parse({...list,items:[f.task,f.task]}));assert.throws(()=>model.contributionListSchema.parse({...list,nextCursor:f.task.id}));
 const claims={version:1,task:f.task,items:[f.item],nextCursor:null,executionEnabled:false};model.contributionClaimsSchema.parse(claims);const foreign=structuredClone(f.item);foreign.task.digest='b'.repeat(64);foreign.record.task.digest='b'.repeat(64);assert.throws(()=>model.contributionClaimsSchema.parse({...claims,items:[foreign]}));assert.throws(()=>model.contributionClaimsSchema.parse({...claims,items:[{...f.item,taskState:'CLOSED'}]}));
});

test('write receipts bind frozen command, actor, exact accepted row and current projection',async()=>{
 const f=await fixture();for(const [command,actor,time] of [[f.register,f.curator,at],[f.claim,f.author,claimedAt]])await model.validateContributionWrite(await receipt(f,command,actor,time),command,actor);
 const command=await submit(f),ack=await receipt(f,command,f.author,submittedAt);await model.validateContributionWrite(ack,command,f.author);
 for(const edit of [x=>x.acknowledgement.commandDigest='b'.repeat(64),x=>x.acknowledgement.digest='b'.repeat(64),x=>x.acknowledgement.sequence=2,x=>x.acknowledgement.createdAt=reviewedAt,x=>x.acknowledgement.actor=human(3),x=>x.acknowledgement.claim.digest='b'.repeat(64),x=>x.acknowledgement.task.digest='b'.repeat(64),x=>x.action='release',x=>x.requestId=uid()]){const invalid=structuredClone(ack);edit(invalid);await assert.rejects(model.validateContributionWrite(invalid,command,f.author));}
 await assert.rejects(model.validateContributionWrite(ack,{...command,handoffDigest:'b'.repeat(64)},f.author));await assert.rejects(model.validateContributionWrite(ack,command,human(3)));
});

test('accepted historical retry remains correlated after later disposition and known hiding',async()=>{
 const f=await fixture(),command=await submit(f);await review(f,'CHANGES_REQUESTED','NEEDS_CHANGES');let ack=await receipt(f,command,f.author,submittedAt);await model.validateContributionWrite(ack,command,f.author);await hide(f);ack=await receipt(f,command,f.author,submittedAt);await model.validateContributionWrite(ack,command,f.author);assert.equal(ack.claim.record,null);assert.deepEqual(ack.claim.events,[]);
 const invalid=structuredClone(ack);invalid.acknowledgement.digest='b'.repeat(64);await assert.rejects(model.validateContributionWrite(invalid,command,f.author),/acknowledgement/);
 for(const [created,actor,time] of [[f.register,f.curator,at],[f.claim,f.author,claimedAt]]){const creation=await receipt(f,created,actor,time);await model.validateContributionWrite(creation,created,actor);creation.acknowledgement.digest='b'.repeat(64);await assert.rejects(model.validateContributionWrite(creation,created,actor));}
});

test('review decision reasons and public author identities cannot imply unsupported authority',async()=>{
 const f=await fixture();const base={action:'review',requestId:uid(),task:ref(f.task),claim:ref(f.item),expectedSequence:1,decision:'ACCEPTED',reason:'ACCEPTANCE_MET',policyAccepted:policy};
 for(const patch of [{decision:'ACCEPTED',reason:'NEEDS_CHANGES'},{decision:'REJECTED',reason:'ACCEPTANCE_MET'},{decision:'CHANGES_REQUESTED',reason:'ACCEPTANCE_MET'},{decision:'REJECTED',reason:'NEEDS_CHANGES'},{reason:'MERGED'},{merged:true},{securityApproved:true},{reputation:100}])assert.throws(()=>model.boundedContributionCommand({...base,...patch}));
 await submit(f);const invalid=model.contributionEventRecordForCommand(base,f.curator,reviewedAt);assert.throws(()=>model.boundedContributionClaimEventRecord({...invalid,actor:f.author}));
 assert.throws(()=>model.contributionMeSchema.parse({version:1,authorId:human(1).id,sponsorId:human(2).id,maintainer:true,executionEnabled:false}));
});
