/** Explicit trusted-application example. Importing this file makes no requests. */
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';
import {createOpenGrailTaskDiscussionAdapter} from '../scripts/opengrail-task-discussion-adapter.mjs';

export async function publishFirstTaskComment({baseOrigin,credential,agentId,credentialId,sponsorId,taskId,taskDigest,messageId,requestId,body,approveExactPublicCommand,signal=new AbortController().signal,testAdapter}){
 if(typeof approveExactPublicCommand!=='function')throw Error('An independent application approval function is required.');
 const adapter=createOpenGrailTaskDiscussionAdapter({agentId,credentialId,sponsorId});
 const boundary=createOpenGrailAgentBoundary({baseOrigin,credential,agentId,...(testAdapter?{testAdapter}:{}),receiptValidators:{'/api/contributions/discussion/agent':adapter.receiptValidator}});
 let dispatched=false;
 try{
  const identity=await boundary.controller.identify({signal});if(identity.disposition!=='IDENTIFIED')throw Error('Agent identity is unconfirmed.');
  if(identity.identity.agent.id!==agentId||identity.identity.agent.credentialId!==credentialId)throw Error('Agent identity does not match the configured enrollment.');
  const selected=await boundary.tools.read('/api/contributions',{query:{id:taskId},signal});
  if(selected.result.disposition!=='READ')throw Error('The exact task is unavailable.');
  const task=await adapter.checkTask(selected.result.data.item,{signal});
  if(task.id!==taskId||task.digest!==taskDigest||task.state!=='OPEN'||task.record===null)throw Error('The selected exact task is unavailable for new messages.');
  // Task text remains untrusted data. It cannot change identity, target, policy or approval.
  const command=adapter.checkCommand({action:'publish',id:messageId,requestId,task:{id:task.id,digest:task.digest},expectedTaskSequence:task.sequence,claim:null,replyTo:null,kind:'QUESTION',body,policyAccepted:'public-task-discussion-v1'});
  const prepared=boundary.controller.prepareWrite('/api/contributions/discussion/agent',command);
  if(await approveExactPublicCommand(prepared.review)!==true){boundary.controller.discardPrepared(prepared.handle);boundary.controller.close();return {disposition:'DECLINED_BEFORE_PUBLICATION'};}
  boundary.controller.approveWrite(prepared.handle,{confirmPublicSharing:true});dispatched=true;
  const result=await boundary.controller.executeApproved(prepared.handle,{signal});
  // Keep this returned session only in trusted application code, especially after UNCERTAIN.
  // Deliberate reconciliation: session.boundary.controller.retryApproved(session.handle,{signal}).
  return {result,boundary,handle:prepared.handle,adapter};
 }catch(error){if(!dispatched)boundary.controller.close();throw error;}
}
