import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as F from './task-discussion-fixtures.mjs';
import * as bundled from '../scripts/opengrail-task-discussion-validator.bundle.mjs';
import {createOpenGrailTaskDiscussionAdapter} from '../scripts/opengrail-task-discussion-adapter.mjs';

const agentId='34400000-0000-4000-8000-000000000001',credentialId='34400000-0000-4000-8000-000000000002',sponsorId=F.human.id;
const author={kind:'AGENT',id:agentId,sponsorId},options={agentId,credentialId,sponsorId};
const identity={version:1,agent:{id:agentId,credentialId,name:'Synthetic adapter participant',scope:'PUBLIC_RESEARCH_SUBMIT',expiresAt:'2027-01-01T00:00:00.000Z'},executionEnabled:false};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const context=(command,signal=new AbortController().signal)=>({command,identity,signal});
async function publication(){const task=await F.taskFixture(),command=F.publishCommand(task),message=await F.messageFixture(task,command,author),receipt=await F.writeFixture(task,command,message,author);return {task,command,message,receipt};}
async function acceptance(fn){try{return {accepted:true,value:await fn()};}catch{return {accepted:false};}}

test('generated module is bound to actual declared models/Zod and has no external runtime resolution',()=>{
 const graphBytes=readFileSync('scripts/agent-task-discussion-validator.build.json'),graph=JSON.parse(graphBytes);
 const proof=JSON.parse(readFileSync('scripts/opengrail-task-discussion-validator.bundle.provenance.json'));
 assert.equal(proof.status,'BUILT_TWICE_IDENTICAL_RUNTIME_NOT_TESTED');assert.equal(proof.buildInputsSha256,sha(graphBytes));
 assert.equal(proof.recipeSha256,sha(readFileSync('scripts/build-agent-task-discussion-validator.mjs')));
 assert.equal(proof.output.sha256,sha(readFileSync('scripts/opengrail-task-discussion-validator.bundle.mjs')));
 assert.deepEqual(Object.keys(bundled).sort(),graph.exports);assert.equal(graph.runtimeInputs.length,14);
 for(const row of [...graph.runtimeInputs,...graph.packageMetadata]){const bytes=readFileSync(row.path);assert.equal(bytes.length,row.bytes,row.path);assert.equal(sha(bytes),row.sha256,row.path);}
 const outputs=Object.values(proof.metafile.outputs);assert.equal(outputs.length,1);assert.deepEqual(outputs[0].imports,[]);
 assert.deepEqual(Object.keys(proof.metafile.inputs).sort(),[...graph.runtimeInputs.map(row=>row.path),'entry.mjs'].sort());
 assert.equal(proof.applicationExecution,false);assert.equal(proof.hostedAvailability,'UNKNOWN');assert.equal(proof.qualification,'NONE');
});

test('adapter configuration is detached and refuses hooks, unknown fields or invented identities',()=>{
 let touched=0;const bad=[{...options,get sponsorId(){touched++;return sponsorId;}},{...options,extra:true},{...options,[Symbol('hidden')]:true},{...options,agentId:'34400000-0000-4000-8000-00000000000A'},{...options,sponsorId:'someone'},{...options,credentialId:null}];
 for(const value of bad)assert.throws(()=>createOpenGrailTaskDiscussionAdapter(value));assert.equal(touched,0);
 const configured={...options},adapter=createOpenGrailTaskDiscussionAdapter(configured);configured.sponsorId=F.otherHuman.id;assert(Object.isFrozen(adapter));
});

test('actual bundle agrees with unchanged model for publish, terminal withdrawal and private report',async()=>{
 const initial=await publication(),adapter=createOpenGrailTaskDiscussionAdapter(options);
 const withdrawal=F.eventCommand(initial.message),withdrawn=await F.messageEvent(initial.message,withdrawal,author);
 const report=F.reportCommand(initial.message),cases=[
  [initial.command,initial.receipt],
  [withdrawal,await F.writeFixture(initial.task,withdrawal,withdrawn,author,F.later)],
  [report,await F.writeFixture(initial.task,report,null,author,F.later)],
 ];
 for(const [command,receipt]of cases){assert.deepEqual(adapter.checkCommand(command),F.m.boundedTaskDiscussionCommand(command).command);const original=await F.m.validateTaskDiscussionWrite(receipt,command,author),full=await bundled.validateTaskDiscussionWrite(receipt,command,author),adapted=await adapter.receiptValidator(receipt,context(command));assert.deepEqual(full,original);assert.deepEqual(adapted,original);assert.deepEqual(receipt,full);}
 const privateReceipt=cases[2][1];assert.equal(privateReceipt.message,null);assert(!('details'in privateReceipt.report));assert(!('reporter'in privateReceipt.report));
});

test('current hidden task projection validates retained publication without restoring text',async()=>{
 const initial=await publication(),task=await F.taskEvent(initial.task,'hide'),receipt=F.clone(initial.receipt);
 receipt.task=task;receipt.message.taskState='HIDDEN';receipt.message.state='HIDDEN';receipt.message.record=null;
 const checked=await createOpenGrailTaskDiscussionAdapter(options).receiptValidator(receipt,context(initial.command));
 assert.equal(checked.task.record,null);assert.equal(checked.message.record,null);assert(!JSON.stringify(checked).includes(initial.command.body));
 assert.deepEqual(checked,await F.m.validateTaskDiscussionWrite(receipt,initial.command,author));
});

test('counterexamples retain full authoritative validation rather than matching an acknowledgement alone',async()=>{
 const initial=await publication(),withdrawal=F.eventCommand(initial.message),withdrawn=await F.messageEvent(initial.message,withdrawal,author),withdrawReceipt=await F.writeFixture(initial.task,withdrawal,withdrawn,author,F.later),adapter=createOpenGrailTaskDiscussionAdapter(options);
 const mutations=[
  [initial.command,initial.receipt,r=>{r.acknowledgement.commandDigest='b'.repeat(64);} ],
  [initial.command,initial.receipt,r=>{r.acknowledgement.actor.sponsorId=F.otherHuman.id;} ],
  [initial.command,initial.receipt,r=>{r.message.record.body='An invented replacement body.';} ],
  [initial.command,initial.receipt,r=>{r.task.record.content.acceptance=['An invented acceptance criterion.'];} ],
  [initial.command,initial.receipt,r=>{r.message.task.digest='b'.repeat(64);} ],
  [initial.command,initial.receipt,r=>{r.message.record.claim=F.ref();} ],
  [initial.command,initial.receipt,r=>{r.extra=true;} ],
  [withdrawal,withdrawReceipt,r=>{r.message.events[0].digest='b'.repeat(64);} ],
  [withdrawal,withdrawReceipt,r=>{r.message.events[0].expectedSequence=1;} ],
  [withdrawal,withdrawReceipt,r=>{r.message.events[0].actor.id=credentialId;} ],
 ];
 for(const [command,original,mutate]of mutations){const receipt=F.clone(original);mutate(receipt);const source=await acceptance(()=>F.m.validateTaskDiscussionWrite(receipt,command,author)),copy=await acceptance(()=>bundled.validateTaskDiscussionWrite(receipt,command,author)),wrapped=await acceptance(()=>adapter.receiptValidator(receipt,context(command)));assert.equal(source.accepted,false);assert.deepEqual(copy,source);assert.deepEqual(wrapped,source);}
 const report=F.reportCommand(initial.message),privateReceipt=await F.writeFixture(initial.task,report,null,author,F.later);privateReceipt.report.details=report.details;
 await assert.rejects(()=>adapter.receiptValidator(privateReceipt,context(report)));
});

test('receipt validator binds separately configured sponsor and both enrollment identities',async()=>{
 const initial=await publication(),adapter=createOpenGrailTaskDiscussionAdapter(options);
 for(const mutate of [v=>{v.agent.id=credentialId;},v=>{v.agent.credentialId=agentId;},v=>{v.executionEnabled=true;},v=>{v.agent.scope='ADMIN';}]){const who=F.clone(identity);mutate(who);await assert.rejects(()=>adapter.receiptValidator(initial.receipt,{...context(initial.command),identity:who}));}
 const wrongSponsor=createOpenGrailTaskDiscussionAdapter({...options,sponsorId:F.otherHuman.id});await assert.rejects(()=>wrongSponsor.receiptValidator(initial.receipt,context(initial.command)));
 const caller={...options},detached=createOpenGrailTaskDiscussionAdapter(caller);caller.sponsorId=F.otherHuman.id;assert.deepEqual(await detached.receiptValidator(initial.receipt,context(initial.command)),initial.receipt);
});

test('native cancellation before and during full validation cannot return a confirmed receipt',async()=>{
 const initial=await publication(),adapter=createOpenGrailTaskDiscussionAdapter(options);
 const before=new AbortController();before.abort();await assert.rejects(()=>adapter.receiptValidator(initial.receipt,context(initial.command,before.signal)),e=>e.name==='AbortError');
 const during=new AbortController(),operation=adapter.receiptValidator(initial.receipt,context(initial.command,during.signal));during.abort();await assert.rejects(operation,e=>e.name==='AbortError');
 await assert.rejects(()=>adapter.receiptValidator(initial.receipt,{...context(initial.command),signal:{aborted:false}}));
});

test('bounded read helpers validate complete current task/message projections and canonical digests',async()=>{
 const initial=await publication(),adapter=createOpenGrailTaskDiscussionAdapter(options),read={version:1,task:initial.task,item:initial.message,executionEnabled:false},signal=new AbortController().signal;
 assert.deepEqual(await adapter.checkTask(initial.task,{signal}),await F.c.validateContributionTaskItem(initial.task));
 assert.deepEqual(await adapter.checkDiscussion(read,{signal}),await F.m.validateTaskDiscussionGet(read));
 const corrupt=F.clone(read);corrupt.item.record.body='Forged current text.';await assert.rejects(()=>adapter.checkDiscussion(corrupt,{signal}));
 const task=F.clone(initial.task);task.digest='b'.repeat(64);await assert.rejects(()=>adapter.checkTask(task,{signal}));
 const closed=await F.taskEvent(initial.task,'close');assert.equal((await adapter.checkTask(closed,{signal})).state,'CLOSED');
});
