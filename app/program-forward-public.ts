import {parseUniqueJson} from './unique-json';
import {experimentGetSchema,experimentInputDependencies,experimentIsProgramForwardManifest,experimentOutcomeFlags,experimentTransportDepth,validateExperimentItem,type ExperimentPublicItem,type ExperimentProgramForwardManifest} from './experiment-model';
import {strategyGetSchema,type StrategyPublicItem} from './strategy-model';
import {verifyProgramSource} from './program-link';
import {type ProgramForwardEvidenceInput} from './program-forward-evidence-model';
import {checkedProgramCommitmentVerificationScope,type ProgramCommitmentVerificationScope} from './program-commitment-model';

export type PublicProgramForwardReference={kind:'MANIFEST'|'OUTCOME';id:string;digest:string};
export type PublicProgramForwardContext={reference:PublicProgramForwardReference;manifest:ExperimentPublicItem&{record:ExperimentProgramForwardManifest};outcome:ExperimentPublicItem|null;sources:StrategyPublicItem[];source:StrategyPublicItem};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/,same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export class PublicProgramForwardUnavailable extends Error{constructor(readonly sourceId:string){super('Current exact forward evidence is unavailable.');}}
export function parsePublicProgramForwardReference(query:string):PublicProgramForwardReference|null{
 const p=new URLSearchParams(query);if(!p.has('manifest')&&!p.has('outcome'))return null;const key=p.has('outcome')?'outcome':'manifest';
 if([...p.keys()].some(k=>![key,'digest'].includes(k))||p.getAll(key).length!==1||p.getAll('digest').length!==1||!uuid.test(p.get(key)!)||!hash.test(p.get('digest')!))throw Error('Use one exact forward record and digest.');
 return {kind:key==='outcome'?'OUTCOME':'MANIFEST',id:p.get(key)!,digest:p.get('digest')!};
}
export function assertForwardPublicMemberContinuation(before:ExperimentPublicItem|StrategyPublicItem,after:ExperimentPublicItem|StrategyPublicItem){
 if(after.state!=='VISIBLE'||!after.record||'suppression'in after&&after.suppression)throw new PublicProgramForwardUnavailable(after.id);
 const immutable=(item:ExperimentPublicItem|StrategyPublicItem)=>{if('type'in item){const{moderation:_m,state:_s,reason:_r,suppression:_p,reporting:_a,outcomeCount:_n,...rest}=item;return rest;}const{moderation:_m,state:_s,reason:_r,...rest}=item;return rest;};
 if(!same(immutable(before),immutable(after))||after.moderation.length<before.moderation.length||!same(after.moderation.slice(0,before.moderation.length),before.moderation))throw new PublicProgramForwardUnavailable(after.id);
 return after;
}
export async function readProgramForwardPublicJson(response:Response,signal:AbortSignal,cap=1_048_576){
 const declared=response.headers.get('Content-Length'),type=response.headers.get('Content-Type');if(!type||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)||declared!==null&&(!/^(?:0|[1-9]\d*)$/.test(declared)||Number(declared)>cap))throw Error('Invalid public response headers.');
 const reader=response.body?.getReader();if(!reader)throw Error('Public response unavailable.');const parts:Uint8Array[]=[];let n=0;
 try{for(;;){signal.throwIfAborted();const next=await reader.read();signal.throwIfAborted();if(next.done)break;n+=next.value.byteLength;if(n>cap){await reader.cancel();throw Error('Public evidence exceeds its complete byte budget.');}parts.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(n);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),cap,experimentTransportDepth);
}
const options=(signal:AbortSignal)=>({cache:'no-store' as const,redirect:'error' as const,credentials:'same-origin' as const,signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
/** Read every original strategy and retained Search candidate, twice, without invoking any guest. */
export async function readProgramForwardSources(input:ProgramForwardEvidenceInput,signal:AbortSignal,previous:StrategyPublicItem[]=[]):Promise<StrategyPublicItem[]>{
 const dependencies=experimentInputDependencies(input),historical=input.plan?.handoff.ledger.plan.admission.candidates.map(c=>c.source)??[];
 async function read(dep:typeof dependencies[number]){const response=await fetch('/api/strategies?id='+encodeURIComponent(dep.id),options(signal));if(response.status===404)throw new PublicProgramForwardUnavailable(dep.id);if(!response.ok)throw Error('Source confirmation unavailable.');const source=strategyGetSchema.parse(await readProgramForwardPublicJson(response,signal,65536)).item;
  if(source.state!=='VISIBLE'||!source.record)throw new PublicProgramForwardUnavailable(dep.id);const verified=await verifyProgramSource({id:dep.id,digest:dep.digest},source);signal.throwIfAborted();if(!same(verified.record,dep.record))throw new PublicProgramForwardUnavailable(dep.id);
  for(const before of [...previous,...historical].filter(item=>item.id===dep.id))assertForwardPublicMemberContinuation(before,verified);return verified;
 }
 const first=await Promise.all(dependencies.map(read));signal.throwIfAborted();const last=await Promise.all(dependencies.map(read));last.forEach((after,index)=>assertForwardPublicMemberContinuation(first[index],after));signal.throwIfAborted();return last;
}
/** This exact reader uses pure admission models and source parsing only. Reading grants no execution. */
export async function readPublicProgramForwardContext(reference:PublicProgramForwardReference,signal:AbortSignal,verificationScope?:ProgramCommitmentVerificationScope):Promise<PublicProgramForwardContext>{
 const scope=checkedProgramCommitmentVerificationScope(verificationScope);
 if(!parsePublicProgramForwardReference('?'+(reference.kind==='OUTCOME'?'outcome':'manifest')+'='+reference.id+'&digest='+reference.digest))throw Error('Invalid forward reference.');
 async function experiment(id:string){const response=await fetch('/api/experiments?id='+encodeURIComponent(id),options(signal));if(response.status===404)throw new PublicProgramForwardUnavailable(id);if(!response.ok)throw Error('Forward record unavailable.');const item=await validateExperimentItem(experimentGetSchema.parse(await readProgramForwardPublicJson(response,signal)).item,scope);signal.throwIfAborted();if(item.id!==id)throw Error('Wrong exact forward identity.');if(item.state!=='VISIBLE'||!item.record||item.suppression)throw new PublicProgramForwardUnavailable(item.strategy.id);return item;}
 const first=await experiment(reference.id);if(first.type!==reference.kind||first.digest!==reference.digest)throw Error('Wrong exact forward reference.');const outcome=reference.kind==='OUTCOME'?first:null,manifest=outcome?await experiment(outcome.manifest!.id):first;
 if(!manifest.record||!experimentIsProgramForwardManifest(manifest.record))throw Error('PROGRAM_FORWARD_DEMO manifest required.');
 if(outcome){if(outcome.record?.version!==4||outcome.record.type!=='OUTCOME'||!same(outcome.manifest,{id:manifest.id,digest:manifest.digest})||!same(outcome.strategy,manifest.strategy))throw Error('Different forward parent or method.');if(outcome.record.content.result.kind==='ARTIFACT'){const artifact=outcome.record.content.result.artifact;if(!same(artifact.input,manifest.record.content.input))throw Error('Different exact forward input.');}if(!same(outcome.record.flags,experimentOutcomeFlags(outcome.author,manifest.author,outcome.record.content.claim))||Date.parse(outcome.createdAt)<Date.parse(manifest.createdAt))throw Error('Forward claim flags or creation order differ.');}
 const sources=await readProgramForwardSources(manifest.record.content.input,signal);if(sources.some(source=>Date.parse(source.createdAt)>Date.parse(manifest.createdAt)))throw Error('Source creation follows manifest.');
 const [freshManifest,freshOutcome]=await Promise.all([experiment(manifest.id),outcome?experiment(outcome.id):Promise.resolve(null)]);assertForwardPublicMemberContinuation(manifest,freshManifest);if(outcome&&freshOutcome)assertForwardPublicMemberContinuation(outcome,freshOutcome);const freshSources=await readProgramForwardSources(manifest.record.content.input,signal,sources),source=freshSources.find(item=>item.id===manifest.strategy.id);if(!source)throw Error('Original forward source missing.');signal.throwIfAborted();
 return {reference,manifest:freshManifest as PublicProgramForwardContext['manifest'],outcome:freshOutcome,sources:freshSources,source};
}
export function assertPublicProgramForwardContinuation(before:PublicProgramForwardContext,after:PublicProgramForwardContext){if(!same(before.reference,after.reference)||!!before.outcome!==!!after.outcome||before.sources.length!==after.sources.length)throw Error('Forward context changed.');assertForwardPublicMemberContinuation(before.manifest,after.manifest);if(before.outcome&&after.outcome)assertForwardPublicMemberContinuation(before.outcome,after.outcome);before.sources.forEach((source,index)=>assertForwardPublicMemberContinuation(source,after.sources[index]));return after;}
