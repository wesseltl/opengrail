import {z} from 'zod';
import {createHash,timingSafeEqual} from 'node:crypto';

export const receiverLimits=Object.freeze({hashBytes:4096,bodyBytes:4096,lineBytes:4096,queue:8,sockets:16,requestMs:5000,childMs:15000,startupMs:120000,readPerMinute:120,rejectionsPerMinute:128,stateBytes:131072,assetBytes:131072,recentAudit:32});
const hash=z.string().regex(/^[a-f0-9]{64}$/),uuid=z.string().uuid().refine(v=>v===v.toLowerCase());
export const receiverHashesSchema=z.object({version:z.literal(1),producerDigest:hash,ownerDigest:hash}).strict().refine(v=>v.producerDigest!==v.ownerDigest,'Local roles must have distinct credentials.');
export class ReceiverError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const sha=value=>createHash('sha256').update(value).digest('hex');
export function parseReceiverHashes(text,parse){try{return receiverHashesSchema.parse(parse(text,receiverLimits.hashBytes,4));}catch{throw new ReceiverError('INVALID_CREDENTIAL_FILE');}}
export function receiverAuthorization(value,hashes){
 if(typeof value!=='string')throw new ReceiverError('UNAUTHORIZED',401);
 const match=/^Bearer og_local_(producer|owner)_([a-f0-9]{64})$/.exec(value);if(!match)throw new ReceiverError('UNAUTHORIZED',401);
 const role=match[1],digest=sha(value.slice(7)),expected=hashes[role+'Digest'];
 if(!timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(expected,'hex')))throw new ReceiverError('UNAUTHORIZED',401);return role;
}
export function receiverOrigin(host,origin,port){const expected='127.0.0.1:'+port;if(host!==expected||origin!==undefined&&origin!=='http://'+expected)throw new ReceiverError('INVALID_ORIGIN',403);}
export function receiverSessionId(value,current){try{uuid.parse(value);}catch{throw new ReceiverError('INVALID_REQUEST');}if(value!==current)throw new ReceiverError('SESSION_MISMATCH',409);}
export function receiverInstance(journal){return sha(JSON.stringify({kind:'LOCAL_SESSION_INSTANCE_V1',config:journal.config,startedAt:journal.startedAt,implementation:journal.implementation}));}
export function receiverSessionInstance(value,current){try{hash.parse(value);}catch{throw new ReceiverError('INVALID_REQUEST');}if(value!==current)throw new ReceiverError('SESSION_MISMATCH',409);}
/** Local credentials must not become source labels, strategy text or retained exports. */
export function receiverNoSecrets(value){
 if(typeof value==='string'){let text=value;for(let n=0;n<4;n++){if(/og_local_(?:producer|owner)_/i.test(text))throw new ReceiverError('CREDENTIAL_MATERIAL');try{const next=decodeURIComponent(text);if(next===text)break;text=next;}catch{break;}}}
 else if(value&&typeof value==='object')for(const child of Object.values(value))receiverNoSecrets(child);
}
export function receiverRoute(method,target){
 if(typeof target!=='string'||target.includes('?')||target.includes('#'))throw new ReceiverError('INVALID_REQUEST');
 const routes={'/':'ASSET_HTML','/monitor.js':'ASSET_JS','/monitor.css':'ASSET_CSS','/api/state':'STATE','/api/journal':'JOURNAL','/api/events':'EVENTS','/api/control':'CONTROL'};
 if(routes[target]){const route=routes[target],expected=['EVENTS','CONTROL'].includes(route)?'POST':'GET';if(method!==expected)throw new ReceiverError('METHOD_NOT_ALLOWED',405);return {route};}
 const match=/^\/api\/receipts\/([^/]+)$/.exec(target);if(match){try{uuid.parse(match[1]);}catch{throw new ReceiverError('INVALID_REQUEST');}if(method!=='GET')throw new ReceiverError('METHOD_NOT_ALLOWED',405);return {route:'RECEIPT',id:match[1]};}
 throw new ReceiverError('NOT_FOUND',404);
}
export function receiverEvent(text,route,role,m){
 const expected=route==='EVENTS'?'producer':'owner';if(role!==expected)throw new ReceiverError('FORBIDDEN',403);
 let event;try{event=m.boundedSessionEvent(m.parseUniqueJson(text,receiverLimits.bodyBytes,16)).event;}catch{throw new ReceiverError('INVALID_EVENT');}
 const permitted=route==='EVENTS'?['QUOTE','CLOSED_BAR','SIGNAL']:['PAUSE','RESUME','EMERGENCY'];if(!permitted.includes(event.type))throw new ReceiverError('FORBIDDEN',403);return event;
}
const receiptView=r=>({requestId:r.requestId,eventDigest:r.eventDigest,receivedAt:r.receivedAt,sequence:r.sequence,disposition:r.disposition,reason:r.reason});
export function receiverReceipt(journal,requestId,role,duplicate=true){
 const n=journal.events.findIndex(v=>v.event.requestId===requestId);if(n<0||role==='producer'&&!['QUOTE','CLOSED_BAR','SIGNAL'].includes(journal.events[n].event.type))throw new ReceiverError('NOT_FOUND',404);
 const receipt=journal.state.events[n];if(!receipt||receipt.requestId!==requestId)throw new ReceiverError('UNCONFIRMED',503);
 return {version:1,sessionId:journal.config.sessionId,sessionInstance:receiverInstance(journal),receipt:receiptView(receipt),duplicate,stateDigest:journal.state.stateDigest,journalDigest:journal.journalDigest,ordersEnabled:false};
}
export function receiverState(journal,m){
 const s=journal.state,eventsRetained=journal.events.length,normalMaximum=m.sessionLimits.events,reservedMaximum=m.sessionLimits.emergencyReserve,totalMaximum=normalMaximum+reservedMaximum;
 const projection={version:1,kind:'LOCAL_DEMO_RECEIVER_STATE',classification:'AUTHOR_REPORTED',qualification:'NONE',ordersEnabled:false,liveEnabled:false,sessionId:journal.config.sessionId,sessionInstance:receiverInstance(journal),strategy:journal.config.strategy,implementation:journal.implementation,source:{label:journal.config.sourceLabel,provenance:journal.config.provenance,authenticity:'UNKNOWN'},clockMode:'SYSTEM_RECEIPT',sequence:s.sequence,status:s.status,failure:s.failure,account:s.account,openPositions:s.openPositions.map(position=>({...position,mark:m.sessionPositionMark(s,position)})),pending:s.pending,daily:s.daily,dataGap:s.dataGap,capacityHalted:s.capacityHalted,emergencyAt:s.emergencyAt,lastReceipt:s.events.length?receiptView(s.events.at(-1)):null,lastQuote:s.quotes.at(-1)??null,recentAudit:s.audit.slice(-receiverLimits.recentAudit),capacity:{eventsRetained,normalMaximum,reservedMaximum,totalMaximum,remainingNormal:Math.max(0,normalMaximum-eventsRetained),remainingTotal:Math.max(0,totalMaximum-eventsRetained),journalBytes:Buffer.byteLength(JSON.stringify(journal)),maximumJournalBytes:m.sessionJournalLimits.bytes},stateDigest:s.stateDigest,journalDigest:journal.journalDigest};
 if(Buffer.byteLength(JSON.stringify(projection))>receiverLimits.stateBytes)throw new ReceiverError('UNCONFIRMED',503);return projection;
}
export function receiverReady(raw,journal){
 const s=journal.state;if(!raw||raw.type!=='READY'||raw.sessionId!==journal.config.sessionId||raw.sequence!==s.sequence||raw.status!==s.status||raw.openPositions!==s.openPositions.length||raw.pendingEntry!==(s.pending!==null)||raw.exitPending!==(s.status==='STOPPING')||raw.stateDigest!==s.stateDigest||raw.journalDigest!==journal.journalDigest||raw.ordersEnabled!==false||raw.clockMode!=='SYSTEM_RECEIPT'||journal.config.clockMode!=='SYSTEM_RECEIPT')throw new ReceiverError('UNCONFIRMED',503);
}
export function receiverAcknowledgment(raw,event,prior,journal,m){
 const previous=prior.events.find(v=>v.event.requestId===event.requestId),duplicate=Boolean(previous),s=journal.state;
 if(previous&&JSON.stringify(previous.event)!==JSON.stringify(event))throw new ReceiverError('CONFLICT',409);
 const expected=duplicate?prior.events: [...prior.events,journal.events.at(-1)];
 const entry=journal.events.find(v=>v.event.requestId===event.requestId),receipt=s.events.find(v=>v.requestId===event.requestId);
 if(!raw||raw.type!=='RECEIPT'||raw.requestId!==event.requestId||raw.duplicate!==duplicate||raw.sessionId!==journal.config.sessionId||raw.sequence!==prior.state.sequence+(duplicate?0:1)||raw.sequence!==s.sequence||raw.status!==s.status||raw.openPositions!==s.openPositions.length||raw.pendingEntry!==(s.pending!==null)||raw.exitPending!==(s.status==='STOPPING')||raw.stateDigest!==s.stateDigest||raw.journalDigest!==journal.journalDigest||raw.ordersEnabled!==false||!entry||!receipt||raw.disposition!==receipt.disposition||raw.reason!==receipt.reason||JSON.stringify(entry.event)!==JSON.stringify(event)||JSON.stringify(journal.config)!==JSON.stringify(prior.config)||journal.startedAt!==prior.startedAt||JSON.stringify(journal.events)!==JSON.stringify(expected)||duplicate&&journal.journalDigest!==prior.journalDigest)throw new ReceiverError('UNCONFIRMED',503);
 if(!duplicate&&(journal.events.length!==prior.events.length+1||entry.stateDigest!==s.stateDigest||entry.receivedAt!==receipt.receivedAt))throw new ReceiverError('UNCONFIRMED',503);
 return receiverReceipt(journal,event.requestId,event.type==='PAUSE'||event.type==='RESUME'||event.type==='EMERGENCY'?'owner':'producer',duplicate);
}
