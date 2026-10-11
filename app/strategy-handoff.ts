import {z} from 'zod';
import {strategyPublicItemSchema,boundedStrategyRecord,strategyDigest,type StrategyPublicItem} from './strategy-model';
import {boundedSessionValue,boundedSessionConfig,sessionVersion,SessionError,type SessionConfig} from './session-model';

export const strategyHandoffLimits={queryBytes:512,sourceBytes:65536} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase()),hash=z.string().regex(/^[a-f0-9]{64}$/);
const referenceSchema=z.object({id:uuid,digest:hash}).strict();
export type StrategyHandoffReference=z.infer<typeof referenceSchema>;
const configAdmissionSchema=z.object({source:strategyPublicItemSchema,sessionId:uuid,initialCapital:z.number().finite().min(.01).max(1000000),sourceLabel:z.string().trim().min(1).max(80),rightsNote:z.string().trim().min(1).max(1000),confirmRights:z.literal(true)}).strict();
export class StrategyHandoffError extends Error{constructor(message:string,public status=400){super(message);}}
const size=(text:string)=>new TextEncoder().encode(text).byteLength;
function plain(raw:unknown,maximum:number){try{boundedSessionValue(raw,maximum);}catch(error){throw new StrategyHandoffError('Only bounded plain finite JSON data is accepted.',error instanceof SessionError?error.status:400);}}
function credentials(raw:unknown,inAuthor=false):void{
 if(typeof raw==='string'){let value=raw;for(let n=0;n<4;n++){if(/og_local_(producer|owner)_/i.test(value)||!inAuthor&&/og_agent_/i.test(value))throw new StrategyHandoffError('Credentials cannot enter a strategy handoff or receiver configuration.');try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}}}
 else if(raw&&typeof raw==='object')for(const [key,value]of Object.entries(raw))credentials(value,inAuthor||key==='author');
}
function reference(raw:unknown):StrategyHandoffReference{plain(raw,256);let value:StrategyHandoffReference;try{value=referenceSchema.parse(raw);}catch{throw new StrategyHandoffError('An exact lowercase strategy ID and digest are required.');}return value;}

/** Parse only a location search string. Query material cannot choose URLs, rules or permissions. */
export function parseStrategyHandoff(search:string):StrategyHandoffReference|null{
 if(typeof search!=='string')throw new StrategyHandoffError('Invalid strategy handoff query.');
 if(size(search)>strategyHandoffLimits.queryBytes)throw new StrategyHandoffError('Strategy handoff query is too large.',413);
 if(search===''||search==='?')return null;
 if(!search.startsWith('?')||search.includes('#')||/[\u0000-\u0020\u007f]/.test(search)||search.slice(1).split('&').some(part=>part===''))throw new StrategyHandoffError('Invalid strategy handoff query.');
 try{decodeURIComponent(search.slice(1));}catch{throw new StrategyHandoffError('Malformed strategy handoff encoding.');}
 const params=new URLSearchParams(search.slice(1)),keys=Array.from(params.keys());
 if(keys.length!==2||keys.filter(key=>key==='strategy').length!==1||keys.filter(key=>key==='digest').length!==1)throw new StrategyHandoffError('Only one complete strategy and digest pair is accepted.');
 return reference({id:params.get('strategy'),digest:params.get('digest')});
}

/** Fixed relative destinations; never a caller-selected origin or redirect. */
export function strategyHandoffHref(path:'/demo'|'/session',raw:StrategyHandoffReference):string{
 if(path!=='/demo'&&path!=='/session')throw new StrategyHandoffError('A local Demo or Session destination is required.');
 const value=reference(raw);return path+'?strategy='+value.id+'&digest='+value.digest;
}

/** Snapshot consistency only. The caller must obtain a fresh same-origin public projection. */
export async function verifyStrategyHandoff(rawReference:StrategyHandoffReference,rawPublicItem:unknown):Promise<StrategyPublicItem>{
 const expected=reference(rawReference);plain(rawPublicItem,strategyHandoffLimits.sourceBytes);credentials(rawPublicItem);
 let item:StrategyPublicItem;try{item=strategyPublicItemSchema.parse(rawPublicItem);}catch{throw new StrategyHandoffError('The public strategy projection is invalid.');}
 if(item.id!==expected.id||item.digest!==expected.digest)throw new StrategyHandoffError('The public strategy does not match the pinned reference.',409);
 if(item.state!=='VISIBLE'||!item.record)throw new StrategyHandoffError('The exact public strategy is unavailable.',409);
 let canonical:ReturnType<typeof boundedStrategyRecord>;try{canonical=boundedStrategyRecord(item.record);}catch{throw new StrategyHandoffError('The public strategy record is invalid.');}
 if(await strategyDigest(canonical.payload)!==expected.digest)throw new StrategyHandoffError('The public strategy digest does not match its record.');
 return item;
}

/** Pure reviewed configuration data: no session, journal, feed, credential or grant is created. */
export async function prepareLocalReceiverConfig(raw:unknown):Promise<SessionConfig>{
 plain(raw,strategyHandoffLimits.sourceBytes+2048);credentials(raw);
 let admission:z.infer<typeof configAdmissionSchema>;try{admission=configAdmissionSchema.parse(raw);}catch{throw new StrategyHandoffError('Exact source, valid capital, source label and explicit data rights are required.');}
 const source=await verifyStrategyHandoff({id:admission.source.id,digest:admission.source.digest},admission.source);
 const value={version:1,sessionId:admission.sessionId,methodVersion:sessionVersion,clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record:source.record!,digest:source.digest},initialCapital:admission.initialCapital,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:admission.rightsNote},sourceLabel:admission.sourceLabel,ordersEnabled:false,liveEnabled:false};
 try{return boundedSessionConfig(value).config;}catch(error){throw new StrategyHandoffError('The reviewed local receiver configuration is invalid.',error instanceof SessionError?error.status:400);}
}
