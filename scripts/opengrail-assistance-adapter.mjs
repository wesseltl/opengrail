/** Trusted local adapter. No requests, ID minting, persistence, model invocation or approval. */
import {AgentClientError} from './opengrail-agent-client.mjs';
import {boundedAssistanceCommand,assistanceRecordForCommand,boundedAssistanceRecord,assistancePublicItemDomain,validateAssistanceWrite,strategyDigest,verifyAssistanceItem,verifyAssistanceStrategy,validateAssistanceHandoff,verifyResearchAssistanceRecord,verifyResearchAssistanceSource,validateResearchAssistanceBundle} from './opengrail-assistance-validator.bundle.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const human=/^human_[a-f0-9]{64}$/;
const hash=/^[a-f0-9]{64}$/;
const fail=code=>{throw new AgentClientError(code);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function fields(raw,keys){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getOwnPropertySymbols(raw).length)fail('INVALID_SCHEMA');
 const prototype=Object.getPrototypeOf(raw),descriptors=Object.getOwnPropertyDescriptors(raw);
 if(prototype!==Object.prototype&&prototype!==null||Object.keys(descriptors).length!==keys.length||keys.some(key=>!Object.hasOwn(descriptors,key))||Object.values(descriptors).some(value=>!('value'in value)||!value.enumerable))fail('INVALID_SCHEMA');
 return Object.fromEntries(Object.entries(descriptors).map(([key,value])=>[key,value.value]));
}
function signalCheck(signal){if(!(signal instanceof AbortSignal))fail('INVALID_SIGNAL');if(signal.aborted)throw new DOMException('Assistance validation cancelled.','AbortError');}
function checkedReference(raw){const value=fields(raw,['id','digest']);if(typeof value.id!=='string'||!uuid.test(value.id)||typeof value.digest!=='string'||!hash.test(value.digest))fail('INVALID_REFERENCE');return value;}
function envelope(raw){const value=fields(raw,['version','item','executionEnabled']);if(value.version!==1||value.executionEnabled!==false)fail('INVALID_RESPONSE');return value.item;}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}

export function createOpenGrailAssistanceAdapter(rawOptions){
 const {agentId,credentialId,sponsorId}=fields(rawOptions,['agentId','credentialId','sponsorId']);
 if(typeof agentId!=='string'||!uuid.test(agentId)||typeof credentialId!=='string'||!uuid.test(credentialId)||typeof sponsorId!=='string'||!human.test(sponsorId))fail('INVALID_SCHEMA');
 // Enrollment identifiers and sponsorship come from the trusted operator, never retrieved content.
 function checkIdentity(raw){
  const identity=fields(raw,['version','agent','executionEnabled']),agent=fields(identity.agent,['id','name','credentialId','expiresAt','scope']);
  if(identity.version!==1||identity.executionEnabled!==false||agent.id!==agentId||agent.credentialId!==credentialId||agent.scope!=='PUBLIC_RESEARCH_SUBMIT'||typeof agent.name!=='string'||agent.name.length<1||agent.name.length>48||agent.name!==agent.name.trim()||/[\u0000-\u001f\u007f]/.test(agent.name)||typeof agent.expiresAt!=='string'||!Number.isFinite(Date.parse(agent.expiresAt))||new Date(agent.expiresAt).toISOString()!==agent.expiresAt)fail('IDENTITY_MISMATCH');
  return freeze({version:1,agent:{id:agent.id,name:agent.name,credentialId:agent.credentialId,expiresAt:agent.expiresAt,scope:agent.scope},executionEnabled:false});
 }
 function fullAuthor(identity){return {kind:'AGENT',id:agentId,sponsorId,name:checkIdentity(identity).agent.name};}
 async function receiptValidator(raw,rawContext){
  const {command,identity,signal}=fields(rawContext,['command','identity','signal']);signalCheck(signal);
  // Full original author name permits exact digest reconstruction even after dependency suppression.
  const value=await validateAssistanceWrite(raw,command,fullAuthor(identity));signalCheck(signal);return value;
 }
 function checkResponseCommand(raw){const command=boundedAssistanceCommand(raw).command;if(command.action!=='respond')fail('COMMAND_REFUSED');return freeze(command);}
 async function checkRequest(raw,rawOptions){
  const {command,signal}=fields(rawOptions,['command','signal']);signalCheck(signal);const checked=checkResponseCommand(command),domain='version'in checked?checked.domain:'STRATEGY';
  const item=domain==='STRATEGY'?await verifyAssistanceItem(envelope(raw),checked.request,'REQUEST',true):await verifyResearchAssistanceRecord(envelope(raw),domain,checked.request);
  signalCheck(signal);if(item.kind!=='REQUEST'||item.state!=='VISIBLE'||item.availability!=='AVAILABLE'||item.record===null||item.record.kind!=='REQUEST'||assistancePublicItemDomain(item)!==domain)fail('INVALID_REFERENCE');
  return freeze(item);
 }
 async function checkStrategy(raw,rawOptions){const {reference:expected,signal}=fields(rawOptions,['reference','signal']);signalCheck(signal);const item=await verifyAssistanceStrategy(envelope(raw),checkedReference(expected),true);signalCheck(signal);return freeze(item);}
 async function checkResearch(raw,rawOptions){const {reference:expected,domain,signal}=fields(rawOptions,['reference','domain','signal']);signalCheck(signal);if(domain!=='RESEARCH'&&domain!=='VENTURE')fail('INVALID_SCHEMA');const item=await verifyResearchAssistanceSource(envelope(raw),checkedReference(expected),domain);signalCheck(signal);if(item.state!=='VISIBLE'||item.record===null)fail('INVALID_REFERENCE');return freeze(item);}
 async function checkResponseContext(raw){
  const {command:rawCommand,identity,request:rawRequest,base:rawBase,proposal:rawProposal,signal}=fields(raw,['command','identity','request','base','proposal','signal']);signalCheck(signal);
  const command=checkResponseCommand(rawCommand),domain='version'in command?command.domain:'STRATEGY',author=fullAuthor(identity);
  const request=await checkRequest(rawRequest,{command,signal});
  const base=domain==='STRATEGY'?await checkStrategy(rawBase,{reference:request.record.base,signal}):await checkResearch(rawBase,{reference:request.record.base,domain,signal});
  const proposal=domain==='STRATEGY'?await checkStrategy(rawProposal,{reference:command.proposal,signal}):await checkResearch(rawProposal,{reference:command.proposal,domain,signal});
  if(!same(proposal.record.author,author))fail('AUTHOR_MISMATCH');
  // An ephemeral candidate is only an input to existing complete semantic validators.
  // Use existing dependency clocks, without minting a clock or claiming server acceptance.
  const candidateAt=request.createdAt>proposal.createdAt?request.createdAt:proposal.createdAt;
  const candidateRecord=assistanceRecordForCommand(command,author,candidateAt),candidateDigest=await strategyDigest(boundedAssistanceRecord(candidateRecord).payload);
  const candidate={id:command.id,kind:'RESPONSE',digest:candidateDigest,requestId:command.requestId,createdAt:candidateAt,author:{kind:'AGENT',id:agentId,sponsorId},state:'VISIBLE',reason:null,availability:'AVAILABLE',record:candidateRecord,moderation:[],...(domain==='STRATEGY'?{}:{domain})};
  const chain={base,request,response:candidate,proposal};
  if(domain==='STRATEGY')await validateAssistanceHandoff(chain);else await validateResearchAssistanceBundle(chain,domain);
  signalCheck(signal);
  // Never expose the ephemeral candidate as a read item, receipt or accepted publication.
  return freeze({command,request,base,proposal});
 }
 return Object.freeze({receiptValidator,checkIdentity,checkResponseCommand,checkRequest,checkStrategy,checkResearch,checkResponseContext});
}
