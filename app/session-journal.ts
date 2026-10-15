import {z} from 'zod';
import {boundedSessionValue,boundedSessionEvent,sessionConfigSchema,sessionEventSchema,sessionStateSchema,sessionClock,sessionDigest,verifySessionState,sessionLimits,sessionVersion,SessionError,type SessionConfig,type SessionEvent,type SessionState} from './session-model';
import {createSession,advanceSession} from './session-engine';
import {sessionSourceFingerprints} from './session-fingerprints';
import {sessionImplementationKind} from './session-implementation-registry';
import * as legacy from './compat/session-20261011/session-journal';

export const sessionJournalLimits={bytes:8388608,reservedBytes:524288,eventCanonicalBytes:1024,events:sessionLimits.events+sessionLimits.emergencyReserve} as const;
const hash=z.string().regex(/^[a-f0-9]{64}$/),clock=z.string().datetime().refine(v=>new Date(v).toISOString()===v);
const bodySchema=z.object({version:z.literal(1),kind:z.literal('LOCAL_DEMO_SESSION'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),ordersEnabled:z.literal(false),implementation:z.object({version:z.literal(sessionVersion),engine:hash,model:hash,journal:hash}).strict(),config:sessionConfigSchema,startedAt:clock,events:z.array(z.object({event:sessionEventSchema,receivedAt:clock,stateDigest:hash}).strict()).max(sessionJournalLimits.events),state:sessionStateSchema}).strict();
export const sessionJournalSchema=bodySchema.extend({journalDigest:hash});
export type SessionJournal=z.infer<typeof sessionJournalSchema>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const trusted=new WeakSet<object>();
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
// Routing reads descriptors only; the selected implementation still performs
// its complete untrusted proof or recognizes its own immutable trusted handle.
function legacyJournal(raw:unknown){const descriptor=raw&&typeof raw==='object'?Object.getOwnPropertyDescriptor(raw,'implementation'):undefined;return descriptor&&'value'in descriptor&&sessionImplementationKind(descriptor.value)==='LEGACY_20261011';}
function prepared(){if(Object.values(sessionSourceFingerprints).some(v=>/^0+$/.test(v)))throw new SessionError('Session source identities are not prepared.',503);}
async function seal(body:z.infer<typeof bodySchema>):Promise<SessionJournal>{
 const canonical=bodySchema.parse(body),journal=sessionJournalSchema.parse({...canonical,journalDigest:await sessionDigest(JSON.stringify(canonical))});
 boundedSessionValue(journal,sessionJournalLimits.bytes);freeze(journal);trusted.add(journal);return journal;
}
/** Structure and identity only. Recovery must reconstruct every accepted transition. */
export async function verifySessionJournal(raw:unknown):Promise<SessionJournal>{
 prepared();boundedSessionValue(raw,sessionJournalLimits.bytes);
 let journal:SessionJournal;try{journal=sessionJournalSchema.parse(raw);}catch{throw new SessionError('Invalid bounded session journal.');}
 if(sessionImplementationKind(journal.implementation)==='LEGACY_20261011')return legacy.verifySessionJournal(journal);
 const {journalDigest,...body}=journal;
 if(await sessionDigest(JSON.stringify(body))!==journalDigest||!same(journal.implementation,{version:sessionVersion,...sessionSourceFingerprints}))throw new SessionError('Session journal identity or source version is inconsistent.');
 const state=await verifySessionState(journal.state);
 if(!same(journal.config,state.config)||journal.startedAt!==state.startedAt||state.sequence!==journal.events.length)throw new SessionError('Journal and checkpoint identity disagree.');
 for(let n=0;n<journal.events.length;n++){
  const entry=journal.events[n],receipt=state.events[n];
  if(receipt.requestId!==entry.event.requestId||receipt.receivedAt!==entry.receivedAt||receipt.eventDigest!==await sessionDigest(JSON.stringify(entry.event)))throw new SessionError('Journal does not match its receipt chain.');
 }
 if(journal.events.length&&journal.events.at(-1)!.stateDigest!==state.stateDigest)throw new SessionError('Final journal checkpoint mismatch.');
 return journal;
}
export async function createSessionJournal(rawConfig:unknown,startedAt:string):Promise<SessionJournal>{
 prepared();const state=await createSession(rawConfig,sessionClock(startedAt));
 return seal({version:1,kind:'LOCAL_DEMO_SESSION',classification:'AUTHOR_REPORTED',qualification:'NONE',ordersEnabled:false,implementation:{version:sessionVersion,...sessionSourceFingerprints},config:state.config,startedAt:state.startedAt,events:[],state});
}
export async function appendSessionEvent(rawJournal:unknown,rawEvent:unknown,receivedAt:string):Promise<SessionJournal>{
 if(legacyJournal(rawJournal))return legacy.appendSessionEvent(rawJournal,rawEvent,receivedAt);
 const journal=rawJournal!==null&&typeof rawJournal==='object'&&trusted.has(rawJournal)?rawJournal as SessionJournal:await reconstructSessionJournal(rawJournal);
 const {event,payload}=boundedSessionEvent(rawEvent),at=sessionClock(receivedAt);
 if(new TextEncoder().encode(payload).byteLength>sessionJournalLimits.eventCanonicalBytes)throw new SessionError('Normalized event exceeds its journal budget.',413);
 const prior=journal.events.find(v=>v.event.requestId===event.requestId);
 if(prior){if(!same(prior.event,event))throw new SessionError('A request identity cannot change its event.',409);return journal;}
 const reserved=event.type==='EMERGENCY'||event.type==='QUOTE';
 if(journal.events.length>=sessionJournalLimits.events||!reserved&&journal.events.length>=sessionLimits.events)throw new SessionError('Session capacity is retained; only reserved emergency and risk quotes remain.',429);
 const state=await advanceSession(journal.state,event,at);
 if(state.stateDigest===journal.state.stateDigest)throw new SessionError('A unique event did not yield a retained transition.',503);
 const {journalDigest,...body}=journal;void journalDigest;
 const next=await seal({...body,state,events:[...journal.events,{event,receivedAt:at,stateDigest:state.stateDigest}]});
 if(!reserved&&new TextEncoder().encode(JSON.stringify(next)).byteLength>sessionJournalLimits.bytes-sessionJournalLimits.reservedBytes)throw new SessionError('Normal journal byte budget exhausted; emergency headroom is reserved.',429);
 return next;
}
/** Fresh fixed-code reconstruction. Hash-consistent fabricated account snapshots fail. */
export async function reconstructSessionJournal(raw:unknown,options:{signal?:AbortSignal}={}):Promise<SessionJournal>{
 options.signal?.throwIfAborted();const journal=await verifySessionJournal(raw);
 if(sessionImplementationKind(journal.implementation)==='LEGACY_20261011')return legacy.reconstructSessionJournal(journal,options);
 let state=await createSession(journal.config,journal.startedAt);
 for(const entry of journal.events){
  options.signal?.throwIfAborted();state=await advanceSession(state,entry.event,entry.receivedAt);
  if(state.stateDigest!==entry.stateDigest)throw new SessionError('An intermediate session checkpoint does not reconstruct.');
 }
 options.signal?.throwIfAborted();
 if(!same(state,journal.state))throw new SessionError('The retained session does not reconstruct from its exact inputs.');
 const {journalDigest,...body}=journal;void journalDigest;return seal(body);
}
