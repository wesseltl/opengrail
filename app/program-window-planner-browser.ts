import {parseUniqueJson} from './unique-json';
import {programWindowPlannerLimits,type ProgramWindowPlannerImport} from './program-window-planner-model';
import {readProgramWindowPublicationIdentity,ProgramCommitmentOwnerChanged} from './program-window-publisher-browser';
import {readProgramCommitmentCandidateSources,ProgramCommitmentUnavailable} from './program-commitment-browser';
import {ProgramWindowPublicUnavailable} from './program-window-public';
import {boundedProgramWindowValue} from './program-window-model';
import type {StrategyPublicItem} from './strategy-model';
import type {ProgramWindowPlanOwner} from './program-window-plan-storage';
import type {ProgramWindowPublicationIdentity} from './program-window-publication-storage';

/** Whole streams are bounded before parse; no file name, URL or text is code. */
export async function programWindowPlannerFile(file:File,maximum:number,signal:AbortSignal):Promise<unknown>{
 if(!Number.isSafeInteger(maximum)||maximum<1||maximum>programWindowPlannerLimits.fileBytes)throw Error('The complete file needs an explicit finite browser byte bound.');
 if(!Number.isSafeInteger(file.size)||file.size<1||file.size>maximum)throw Error('The complete file exceeds this browser capacity.');
 signal.throwIfAborted();
 const reader=file.stream().getReader(),parts:Uint8Array[]=[];let total=0;
 try{for(;;){signal.throwIfAborted();const row=await reader.read();signal.throwIfAborted();if(row.done)break;total+=row.value.byteLength;if(total>maximum){await reader.cancel();throw Error('The whole file exceeds its original byte bound.');}parts.push(row.value);}}catch(error){try{await reader.cancel();}catch{}throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,programWindowPlannerLimits.depth);
}
export function downloadProgramWindowPlan(raw:unknown,name:string){const body=boundedProgramWindowValue(raw,programWindowPlannerLimits.fileBytes,44,programWindowPlannerLimits.nodes),url=URL.createObjectURL(new Blob([body],{type:'application/json'}));try{const link=document.createElement('a');link.href=url;link.download=name;link.click();}finally{URL.revokeObjectURL(url);}}

/** Fresh per-mount identity and monotonic public source observations. This
 * supplies local context checks, never an atomic server admission or grant. */
export class ProgramWindowPlannerBrowserContext{
 owner:ProgramWindowPlanOwner|null=null;
 private principal:ProgramWindowPublicationIdentity|null=null;
 private previous:StrategyPublicItem[]=[];
 async identity(signedIn:boolean,signal:AbortSignal):Promise<ProgramWindowPlanOwner>{
  if(!signedIn){if(this.owner&&this.owner!=='ANONYMOUS')throw new ProgramCommitmentOwnerChanged();this.owner='ANONYMOUS';return this.owner;}
  const current=await readProgramWindowPublicationIdentity(signal,this.principal);if(this.owner==='ANONYMOUS')throw new ProgramCommitmentOwnerChanged();this.principal=current;this.owner=current.authorId as ProgramWindowPlanOwner;return this.owner;
 }
 async sources(imported:ProgramWindowPlannerImport,signal:AbortSignal){
  boundedProgramWindowValue(imported,programWindowPlannerLimits.fileBytes,44,programWindowPlannerLimits.nodes);
  const handoff=imported.kind==='HANDOFF'?imported.handoff:imported.kind==='PLAN'?imported.plan.handoff:imported.input.plan.handoff;
  try{this.previous=await readProgramCommitmentCandidateSources(handoff.ledger.plan.admission.candidates.map(candidate=>candidate.source),signal,this.previous);}catch(error){if(error instanceof ProgramCommitmentUnavailable)throw new ProgramWindowPublicUnavailable(error.id);throw error;}
  signal.throwIfAborted();return this.previous;
 }
 async check(signedIn:boolean,imported:ProgramWindowPlannerImport,signal:AbortSignal){const owner=await this.identity(signedIn,signal);await this.sources(imported,signal);await this.identity(signedIn,signal);signal.throwIfAborted();return owner;}
}
