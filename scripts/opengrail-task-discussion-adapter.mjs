/** Trusted local adapter. No requests, ID minting, storage, model invocation or approval. */
import {AgentClientError} from './opengrail-agent-client.mjs';
import {validateTaskDiscussionWrite,validateTaskDiscussionGet,validateContributionTaskItem,boundedTaskDiscussionCommand} from './opengrail-task-discussion-validator.bundle.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const human=/^human_[a-f0-9]{64}$/;
const fail=code=>{throw new AgentClientError(code);};
function fields(raw,keys){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getOwnPropertySymbols(raw).length)fail('INVALID_SCHEMA');
 const prototype=Object.getPrototypeOf(raw),descriptors=Object.getOwnPropertyDescriptors(raw);
 if(prototype!==Object.prototype&&prototype!==null||Object.keys(descriptors).length!==keys.length||keys.some(key=>!Object.hasOwn(descriptors,key))||Object.values(descriptors).some(value=>!('value'in value)||!value.enumerable))fail('INVALID_SCHEMA');
 return Object.fromEntries(Object.entries(descriptors).map(([key,value])=>[key,value.value]));
}
function signalCheck(signal){if(!(signal instanceof AbortSignal))fail('INVALID_SIGNAL');if(signal.aborted)throw new DOMException('Task discussion validation cancelled.','AbortError');}
function identityCheck(raw,agentId,credentialId){
 const identity=fields(raw,['version','agent','executionEnabled']),agent=fields(identity.agent,['id','name','credentialId','expiresAt','scope']);
 if(identity.version!==1||identity.executionEnabled!==false||agent.id!==agentId||agent.credentialId!==credentialId||agent.scope!=='PUBLIC_RESEARCH_SUBMIT'||typeof agent.name!=='string'||agent.name.length<1||agent.name.length>48||agent.name!==agent.name.trim()||/[\u0000-\u001f\u007f]/.test(agent.name)||typeof agent.expiresAt!=='string'||!Number.isFinite(Date.parse(agent.expiresAt))||new Date(agent.expiresAt).toISOString()!==agent.expiresAt)fail('IDENTITY_MISMATCH');
}
export function createOpenGrailTaskDiscussionAdapter(rawOptions){
 const {agentId,credentialId,sponsorId}=fields(rawOptions,['agentId','credentialId','sponsorId']);
 if(typeof agentId!=='string'||!uuid.test(agentId)||typeof credentialId!=='string'||!uuid.test(credentialId)||typeof sponsorId!=='string'||!human.test(sponsorId))fail('INVALID_SCHEMA');
 // Configuration comes from enrollment and the sponsor, never from retrieved content or the model.
 const author=Object.freeze({kind:'AGENT',id:agentId,sponsorId});
 async function receiptValidator(raw,rawContext){
  const {command,identity,signal}=fields(rawContext,['command','identity','signal']);signalCheck(signal);identityCheck(identity,agentId,credentialId);
  const value=await validateTaskDiscussionWrite(raw,command,author);signalCheck(signal);return value;
 }
 async function checkTask(raw,rawOptions){const {signal}=fields(rawOptions,['signal']);signalCheck(signal);const value=await validateContributionTaskItem(raw);signalCheck(signal);return value;}
 async function checkDiscussion(raw,rawOptions){const {signal}=fields(rawOptions,['signal']);signalCheck(signal);const value=await validateTaskDiscussionGet(raw);signalCheck(signal);return value;}
 function checkCommand(raw){return boundedTaskDiscussionCommand(raw).command;}
 return Object.freeze({receiptValidator,checkTask,checkDiscussion,checkCommand});
}
