/** Explicit trusted-application example. Importing this file makes no requests. */
import {createOpenGrailAgentBoundary} from '../scripts/opengrail-agent-boundary.mjs';
import {createOpenGrailAssistanceAdapter} from '../scripts/opengrail-assistance-adapter.mjs';

export async function publishAssistanceResponse({baseOrigin,credential,agentId,credentialId,sponsorId,command,approveExactPublicCommand,signal=new AbortController().signal,testAdapter}){
 if(typeof approveExactPublicCommand!=='function')throw Error('An independent application approval function is required.');
 const adapter=createOpenGrailAssistanceAdapter({agentId,credentialId,sponsorId}),checkedCommand=adapter.checkResponseCommand(command);
 const boundary=createOpenGrailAgentBoundary({baseOrigin,credential,agentId,...(testAdapter?{testAdapter}:{}),receiptValidators:{'/api/assistance/agent':adapter.receiptValidator}});
 const path='/api/assistance/agent',domain='version'in checkedCommand?checkedCommand.domain:'STRATEGY';
 let dispatchStarted=false;
 async function identify(){const result=await boundary.controller.identify({signal});if(result.disposition!=='IDENTIFIED')throw Error('Agent identity is unconfirmed.');return adapter.checkIdentity(result.identity);}
 async function readContext(identity){
  const selected=await boundary.tools.read('/api/assistance',{query:{id:checkedCommand.request.id,domain},signal});
  if(selected.result.disposition!=='READ')throw Error('The exact request is unavailable.');
  const request=await adapter.checkRequest(selected.result.data,{command:checkedCommand,signal}),sourcePath=domain==='STRATEGY'?'/api/strategies':'/api/research';
  const reads=await Promise.allSettled([boundary.tools.read(sourcePath,{query:{id:request.record.base.id},signal}),boundary.tools.read(sourcePath,{query:{id:checkedCommand.proposal.id},signal})]);
  for(const result of reads)if(result.status!=='fulfilled'||result.value.result.disposition!=='READ')throw Error('An exact assistance dependency is unavailable.');
  return adapter.checkResponseContext({command:checkedCommand,identity,request:selected.result.data,base:reads[0].value.result.data,proposal:reads[1].value.result.data,signal});
 }
 try{
  // Model-facing tools may inspect public data; only this outside-model controller owns approval.
  const originalIdentity=await identify(),originalContext=await readContext(originalIdentity),prepared=boundary.controller.prepareWrite(path,checkedCommand);
  if(await approveExactPublicCommand(prepared.review)!==true){boundary.controller.discardPrepared(prepared.handle);boundary.controller.close();return {disposition:'DECLINED_BEFORE_PUBLICATION'};}
  // Consent to the exact bytes does not waive current identity or dependency validation.
  const currentIdentity=await identify(),currentContext=await readContext(currentIdentity);
  if(JSON.stringify(currentIdentity)!==JSON.stringify(originalIdentity)||JSON.stringify(currentContext)!==JSON.stringify(originalContext))throw Error('Assistance context changed after review. No response was dispatched.');
  boundary.controller.approveWrite(prepared.handle,{confirmPublicSharing:true});dispatchStarted=true;
  let result;
  try{result=await boundary.controller.executeApproved(prepared.handle,{signal});}
  catch{return {disposition:'CONTROLLER_ERROR_SESSION_RETAINED',boundary,handle:prepared.handle,adapter};}
  // A suppressed CONFIRMED receipt confirms original acceptance only; this example has no next stage.
  // After UNCERTAIN, retain this session outside model context and deliberately call
  // session.boundary.controller.retryApproved(session.handle,{signal:newSignal}).
  return {result,boundary,handle:prepared.handle,adapter};
 }catch(error){if(!dispatchStarted)boundary.controller.close();throw error;}
}
