import {parseUniqueJson} from './unique-json';
import {strategyGetSchema,strategyMeSchema,type StrategyPublicItem} from './strategy-model';
import {verifyProgramSource} from './program-link';
import {createProgramSearchPlan} from './program-search-protocol';
import {syntheticProgramSearchExample} from './program-search-example';
import {programForwardLimits,boundedProgramForwardValue,type LockedProgramSearchHandoff} from './program-forward-plan';
import type {ProgramForwardStorageOwner} from './program-forward-storage';

export class ProgramForwardSourceUnavailable extends Error{}
export class ProgramForwardOwnerChanged extends Error{}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export async function programForwardJson(response:Response,maximum:number,signal:AbortSignal){
 const reader=response.body?.getReader();if(!reader)throw Error('Missing response.');const chunks:Uint8Array[]=[];let total=0;
 try{for(;;){signal.throwIfAborted();const{done,value}=await reader.read();signal.throwIfAborted();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw Error('Whole input exceeds capacity.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}return parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,programForwardLimits.depth);
}
export async function programForwardFile(file:File,maximum:number,signal:AbortSignal){if(!Number.isSafeInteger(file.size)||file.size<1||file.size>maximum)throw Error('Whole file exceeds capacity.');return programForwardJson(new Response(file.stream()),maximum,signal);}
export function downloadProgramForward(value:unknown,name:string,maximum:number){boundedProgramForwardValue(value,maximum);const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));try{const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();}finally{URL.revokeObjectURL(url);}}

/** Per-mount fresh owner and monotonic source fences, never an execution grant. */
export class ProgramForwardBrowserContext{
 owner:ProgramForwardStorageOwner|null=null;
 private principal:ReturnType<typeof strategyMeSchema.parse>|null=null;
 private observations=new Map<string,{identity:string;moderation:StrategyPublicItem['moderation']}>();
 async identity(signedIn:boolean,signal:AbortSignal){
  if(!signedIn){if(this.owner&&this.owner!=='ANONYMOUS')throw new ProgramForwardOwnerChanged();this.owner='ANONYMOUS';return this.owner;}
  const response=await fetch('/api/strategies/me',{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(response.status===401||response.status===403)throw new ProgramForwardOwnerChanged();if(!response.ok)throw Error('Account check unavailable.');const value=strategyMeSchema.parse(await programForwardJson(response,4096,signal));signal.throwIfAborted();if(this.principal&&!same(this.principal,value))throw new ProgramForwardOwnerChanged();this.principal=value;this.owner=value.authorId as ProgramForwardStorageOwner;return this.owner;
 }
 async sources(handoff:LockedProgramSearchHandoff,signal:AbortSignal):Promise<boolean>{
  const example=await syntheticProgramSearchExample(),canonical=await createProgramSearchPlan(example.admission);signal.throwIfAborted();
  if(same(handoff.ledger.plan.admission,canonical.admission))return true;
  const read=async(source:StrategyPublicItem)=>{
   signal.throwIfAborted();const response=await fetch('/api/strategies?id='+encodeURIComponent(source.id),{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(response.status===404)throw new ProgramForwardSourceUnavailable();if(!response.ok)throw Error('Source check unavailable.');const item=strategyGetSchema.parse(await programForwardJson(response,65536,signal)).item;signal.throwIfAborted();
   if(item.id!==source.id||item.digest!==source.digest||item.state!=='VISIBLE'||!item.record)throw new ProgramForwardSourceUnavailable();const value=await verifyProgramSource({id:source.id,digest:source.digest},item);signal.throwIfAborted();
   if(!same(value.record,source.record)||value.moderation.length<source.moderation.length||!same(value.moderation.slice(0,source.moderation.length),source.moderation))throw new ProgramForwardSourceUnavailable();
   const identity=JSON.stringify({id:value.id,digest:value.digest,rootId:value.rootId,revision:value.revision,requestId:value.requestId,createdAt:value.createdAt,author:value.author}),prior=this.observations.get(value.id);
   if(prior&&(prior.identity!==identity||value.moderation.length<prior.moderation.length||!same(value.moderation.slice(0,prior.moderation.length),prior.moderation)))throw new ProgramForwardSourceUnavailable();this.observations.set(value.id,{identity,moderation:structuredClone(value.moderation)});
  };
  for(const candidate of handoff.ledger.plan.admission.candidates)await read(candidate.source);await Promise.all(handoff.ledger.plan.admission.candidates.map(candidate=>read(candidate.source)));signal.throwIfAborted();return false;
 }
 async check(signedIn:boolean,handoff:LockedProgramSearchHandoff,signal:AbortSignal){await this.identity(signedIn,signal);const synthetic=await this.sources(handoff,signal);await this.identity(signedIn,signal);return synthetic;}
}
