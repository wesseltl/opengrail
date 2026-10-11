import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {createSessionMonitor,validateMonitorState,validateMonitorReceipt,parseMonitorJson,monitorLimits} from '../scripts/session-monitor.mjs';
import {receiverState,receiverReceipt} from '../scripts/session-receiver-protocol.mjs';

// The actual fixed browser module runs against a small DOM/event fixture and real engine
// projections. These checks do not establish browser rendering or hosted/provider availability.
const built=await build({stdin:{contents:"export * from './app/session-model';export * from './app/session-journal';export * from './app/session-engine';export * from './app/session-example';export * from './app/strategy-model';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const html=await readFile('scripts/session-monitor.html','utf8'),sha=value=>createHash('sha256').update(value).digest('hex'),T='2026-10-11T09:00:00.000Z';
const owner='og_local_owner_'+ '1a'.repeat(32),replacement='og_local_owner_'+ '2b'.repeat(32);
class Element extends EventTarget{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.value='';this.className='';this.ownText='';this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},contains:name=>this.className.split(/\s+/).includes(name)};}
 set textContent(value){this.ownText=String(value);this.children=[];}get textContent(){return this.ownText+this.children.map(child=>child.textContent).join(' ');}
 set innerHTML(_){throw Error('HTML insertion is forbidden in monitor fixtures.');}
 setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.className=String(value);}getAttribute(key){return this.attributes[key]??null;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.ownText='';this.children=[...nodes];}
}
class Doc extends EventTarget{
 constructor(){super();this.hidden=false;this.nodes=new Map();for(const match of html.matchAll(/<([a-z-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const element=new Element(match[1]);element.hidden=/\bhidden\b/.test(match[0]);element.disabled=/\bdisabled\b/.test(match[0]);this.nodes.set(match[2],element);}}
 getElementById(id){return this.nodes.get(id)??null;}createElement(tag){return new Element(tag);}createElementNS(_,tag){return new Element(tag);}
}
const walk=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>walk(child,predicate))];
async function fixture({open=true,authorName,name='Actual local DCA',capital=1000}={}){
 const example=await m.syntheticSessionExample(),definition=m.strategyTemplate('DCA');definition.entry.intervalBars=1;const record={...example.config.strategy.record,content:{...example.config.strategy.record.content,name,definition}};
 if(authorName)record.author={kind:'AGENT',id:crypto.randomUUID(),sponsorId:record.author.sponsorId,name:authorName};
 const bound=m.boundedStrategyRecord(record),strategy={record:bound.record,digest:await m.strategyDigest(bound.payload)},config={...example.config,sessionId:crypto.randomUUID(),clockMode:'SYSTEM_RECEIPT',strategy,initialCapital:capital,sourceLabel:'Supplied synthetic local inputs'};
 let journal=await m.createSessionJournal(config,T);if(open){journal=await m.appendSessionEvent(journal,{requestId:crypto.randomUUID(),type:'CLOSED_BAR',bar:{closedAt:T,open:100,high:100,low:100,close:100,volume:1}},T);const at=new Date(Date.parse(T)+1).toISOString();journal=await m.appendSessionEvent(journal,{requestId:crypto.randomUUID(),type:'QUOTE',observedAt:at,price:100},at);assert.equal(journal.state.openPositions.length,1);}return journal;
}
function harness(journal,handler){
 const doc=new Doc(),win=new EventTarget(),calls=[],timers=new Map();let nextTimer=0,current=journal,time=Date.parse(T)+2,postCount=0;
 const el=id=>doc.getElementById(id),tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
 const request=async(path,init)=>{calls.push({path,init});const override=await handler?.(path,init,{get journal(){return current;},set journal(next){current=next;},get posts(){return postCount;}});if(override!==undefined)return override;
  if(path==='/api/state')return Response.json(receiverState(current,m));
  if(path==='/api/control'){postCount++;const command=JSON.parse(init.body),previous=current.state.sequence;current=await m.appendSessionEvent(current,command,new Date(++time).toISOString());return Response.json(receiverReceipt(current,command.requestId,'owner',current.state.sequence===previous));}
  if(path.startsWith('/api/receipts/')){try{return Response.json(receiverReceipt(current,path.slice('/api/receipts/'.length),'owner'));}catch{return Response.json({version:1,error:'NOT_FOUND',confirmed:false,ordersEnabled:false},{status:404});}}
  assert.fail('Unexpected network path '+path);
 };
 const monitor=createSessionMonitor({document:doc,window:win,fetch:request,crypto,now:()=>time,setTimeout:(callback,delay)=>{timers.set(++nextTimer,{callback,delay});return nextTimer;},clearTimeout:id=>timers.delete(id)});
 const until=async(predicate)=>{const end=Date.now()+5000;do{await tick();if(predicate())return;}while(Date.now()<end);assert.fail('Monitor fixture timed out: '+el('message').textContent);};
 return {doc,win,el,calls,timers,monitor,tick,until,get journal(){return current;},set journal(value){current=value;},set now(value){time=value;},get now(){return time;},input(value){el('owner-token').value=value;el('owner-token').dispatchEvent(new Event('input'));},async connect(value=owner){this.input(value);el('connect-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>!el('dashboard').hidden||el('message').textContent.includes('rejected')||el('connection-status').textContent.includes('unavailable'));},click(id){assert(!el(id).disabled,id+' disabled');el(id).dispatchEvent(new Event('click'));},async poll(){await monitor.refresh();await tick();},hide(value){doc.hidden=value;doc.dispatchEvent(new Event('visibilitychange'));},dispose(){monitor.destroy();}};
}

test('explicit owner connection loads actual confirmed exposure and costs without an automatic network call',async()=>{
 const j=await fixture(),h=harness(j);assert.equal(h.calls.length,0);assert.equal(h.el('dashboard').hidden,true);await h.connect();assert.equal(h.el('owner-token').value,'');assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/state');assert.equal(h.calls[0].init.headers.Authorization,'Bearer '+owner);assert.equal(h.calls[0].init.credentials,'omit');assert.equal(h.calls[0].init.redirect,'error');assert(h.el('strategy-summary').textContent.includes('DCA'));assert.equal(h.el('sequence').textContent,'2');assert(h.el('positions').textContent.includes('Stop loss'));assert(h.el('positions').textContent.includes('Take profit'));assert(h.el('net-pnl').classList.contains('negative'));assert.equal(h.el('quote-chart').children.length,0);assert(h.el('freshness').textContent.includes(j.state.account.markedAt));assert(h.el('freshness').textContent.includes(j.state.account.sourceObservedAt));assert(h.el('source-summary').textContent.includes('authenticity UNKNOWN'));h.dispose();
});

test('all seven canonical strategy families and admitted agent aliases validate against actual receiver projections',async()=>{
 for(const type of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']){const j=await fixture({open:false,authorName:'og_agent_researcher'}),record=m.boundedStrategyRecord({...j.config.strategy.record,content:{...j.config.strategy.record.content,definition:m.strategyTemplate(type)}}),config={...j.config,strategy:{record:record.record,digest:await m.strategyDigest(record.payload)}};const actual=await m.createSessionJournal(config,T),state=receiverState(actual,m);assert.equal((await validateMonitorState(state)).strategy.record.content.definition.entry.type,type);assert.equal(state.strategy.record.author.name,'og_agent_researcher');}
});

test('real confirmed quote observations draw a finite chart and current position levels, never a manufactured history',async()=>{
 const h=harness(await fixture());await h.connect();const at=new Date(h.now+1000).toISOString();h.journal=await m.appendSessionEvent(h.journal,{requestId:crypto.randomUUID(),type:'QUOTE',observedAt:at,price:100.5},at);h.now=Date.parse(at);await h.poll();const svg=h.el('quote-chart').children[0];assert.equal(svg.tagName,'SVG');assert.equal(walk(svg,n=>n.tagName==='LINE').length,2);const points=walk(svg,n=>n.tagName==='POLYLINE')[0].getAttribute('points');assert(!/NaN|Infinity/.test(points));assert.equal(points.split(' ').length,2);assert(h.el('quote-summary').textContent.includes('2 confirmed observations'));assert(h.el('net-pnl').classList.contains('positive'));h.dispose();
});

test('stale quote timestamps and numerical failure expose earlier account marks without claiming current profit',async()=>{
 const h=harness(await fixture({capital:1000000}));await h.connect();h.now+=61000;await h.poll();assert(h.el('quote-summary').textContent.includes('STALE'));const priorMark=h.journal.state.account.markedAt,at=new Date(h.now).toISOString();h.journal=await m.appendSessionEvent(h.journal,{requestId:crypto.randomUUID(),type:'QUOTE',observedAt:at,price:Number.MAX_VALUE},at);assert.equal(h.journal.state.failure,'NUMERICAL_LIMIT');await h.poll();assert(h.el('freshness').textContent.includes('NUMERICAL_LIMIT'));assert(h.el('freshness').textContent.includes(priorMark));assert(h.el('positions').textContent.includes('UNKNOWN'));h.dispose();
});

test('a failed poll retains dated values with stale status and disables Resume, without inventing liquidation',async()=>{
 let unavailable=false;const h=harness(await fixture(),path=>path==='/api/state'&&unavailable?Response.json({version:1,error:'UNCONFIRMED',confirmed:false,ordersEnabled:false},{status:503}):undefined);await h.connect();const before=h.el('positions').textContent;unavailable=true;await h.poll();assert.equal(h.el('session-status').textContent,'Stale view · last ACTIVE');assert.equal(h.el('positions').textContent,before);assert(h.el('freshness').textContent.includes('Current state UNKNOWN'));assert(h.el('resume').disabled);assert(!h.el('emergency').disabled);assert(!h.el('pause').disabled);const notes=h.el('notes').children.length;await h.poll();assert.equal(h.el('notes').children.length,notes);h.dispose();
});

test('Pause and explicit Resume use actual canonical receipts and never automatically change recovered admission state',async()=>{
 let j=await fixture();j=await m.appendSessionEvent(j,{requestId:crypto.randomUUID(),type:'PAUSE'},new Date(Date.parse(T)+2).toISOString());const h=harness(j);await h.connect();assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0);assert(h.el('control-status').textContent.includes('explicit owner action'));assert(!h.el('resume').disabled);h.click('resume');await h.until(()=>h.el('session-status').textContent==='ACTIVE');const resume=h.calls.find(c=>c.init.method==='POST');assert.deepEqual(Object.keys(JSON.parse(resume.init.body)),['requestId','type']);assert.equal(JSON.parse(resume.init.body).type,'RESUME');assert(h.el('pending-control').hidden);h.click('pause');await h.until(()=>h.el('session-status').textContent==='PAUSED');assert.equal(h.journal.state.openPositions.length,1);h.dispose();
});

test('Emergency keeps real exposure exit-pending until a strictly later permitted quote confirms the exit',async()=>{
 const h=harness(await fixture());await h.connect();h.click('emergency');await h.until(()=>h.el('session-status').textContent==='STOPPING');assert(h.el('control-status').textContent.includes('Exit pending'));assert.equal(h.journal.state.openPositions.length,1);const at=new Date(h.now+1000).toISOString();h.journal=await m.appendSessionEvent(h.journal,{requestId:crypto.randomUUID(),type:'QUOTE',observedAt:at,price:95},at);h.now=Date.parse(at);await h.poll();assert.equal(h.el('session-status').textContent,'STOPPED');assert.equal(h.journal.state.openPositions.length,0);assert.equal(h.journal.state.trades[0].reason,'EMERGENCY_STOP');assert(h.el('positions').textContent.includes('No open'));h.dispose();
});

test('unknown acknowledgements retain exact command identity through unrelated producer updates and identical retries',async()=>{
 let posts=0;const h=harness(await fixture(),async(path,init,context)=>{if(path==='/api/control'&&++posts===1){context.journal=await m.appendSessionEvent(context.journal,JSON.parse(init.body),new Date(Date.parse(T)+3).toISOString());throw Error('Synthetic lost response');}});await h.connect();h.click('pause');await h.until(()=>!h.el('retry').disabled);const first=h.calls.find(c=>c.init.method==='POST'),id=JSON.parse(first.init.body).requestId;const at=new Date(h.now+1000).toISOString();h.journal=await m.appendSessionEvent(h.journal,{requestId:crypto.randomUUID(),type:'QUOTE',observedAt:at,price:100},at);h.now=Date.parse(at);await h.poll();assert.equal(h.el('pending-control').hidden,false);assert(h.el('pending-description').textContent.includes(id));assert(h.el('emergency').disabled);h.click('retry');await h.until(()=>h.el('pending-control').hidden);const writes=h.calls.filter(c=>c.init.method==='POST');assert.equal(writes.length,2);assert.equal(writes[0].init.body,writes[1].init.body);assert.equal(h.journal.events.filter(row=>row.event.requestId===id).length,1);h.dispose();
});

test('a lost response reconciles the exact receipt without another POST; a missing receipt stays unresolved',async()=>{
 for(const accepted of [false,true]){const h=harness(await fixture(),async(path,init,context)=>{if(path==='/api/control'){if(accepted)context.journal=await m.appendSessionEvent(context.journal,JSON.parse(init.body),new Date(Date.parse(T)+3).toISOString());throw Error('Synthetic lost response');}});await h.connect();h.click('pause');await h.until(()=>!h.el('reconcile').disabled);h.click('reconcile');await h.until(()=>accepted?h.el('pending-control').hidden:h.el('message').textContent.includes('does not prove'));assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);assert.equal(h.el('pending-control').hidden,accepted);h.dispose();}
});

test('mismatched command receipt or digest never acknowledges a pending owner request',async()=>{
 for(const field of ['requestId','eventDigest']){const h=harness(await fixture(),async(path,init,context)=>{if(path==='/api/control'){context.journal=await m.appendSessionEvent(context.journal,JSON.parse(init.body),new Date(Date.parse(T)+3).toISOString());const result=receiverReceipt(context.journal,JSON.parse(init.body).requestId,'owner');result.receipt[field]=field==='requestId'?crypto.randomUUID():'a'.repeat(64);return Response.json(result);}});await h.connect();h.click('pause');await h.until(()=>!h.el('retry').disabled);assert.equal(h.el('pending-control').hidden,false);assert(h.el('message').textContent.includes('unknown'));h.click('reconcile');await h.until(()=>h.el('pending-control').hidden);h.dispose();}
});

test('pending controls and receipt lookups carry the captured session identity, and replacement sessions cannot receive old commands',async()=>{
 for(const route of ['retry','lookup']){let posts=0;const h=harness(await fixture(),(path,init,context)=>{if(path==='/api/control'&&++posts===1)return Promise.reject(Error('Synthetic uncertainty'));if((path==='/api/control'||path.startsWith('/api/receipts/'))&&init.headers['X-Session-Id']!==context.journal.config.sessionId)return Response.json({version:1,error:'SESSION_MISMATCH',confirmed:false,ordersEnabled:false},{status:409});});await h.connect();const captured=h.journal.config.sessionId;h.click('pause');await h.until(()=>!h.el('retry').disabled);assert.equal(h.calls.find(c=>c.init.method==='POST').init.headers['X-Session-Id'],captured);h.journal=await fixture();const replacementSequence=h.journal.state.sequence;if(route==='retry')h.click('retry');else h.click('reconcile');await h.until(()=>h.el('dashboard').hidden);const last=h.calls.at(-1);assert.equal(last.init.headers['X-Session-Id'],captured);assert.equal(h.journal.state.sequence,replacementSequence);assert.equal(h.el('pending-control').hidden,true);assert.equal(h.el('positions').children.length,0);assert.equal(h.el('owner-token').value,'');assert.equal(h.timers.size,0);h.dispose();}
});

test('a new session observed by polling clears the old credential and pending body, requiring explicit reconnect',async()=>{
 const h=harness(await fixture(),path=>path==='/api/control'?Promise.reject(Error('Synthetic uncertainty')):undefined);await h.connect();h.click('pause');await h.until(()=>!h.el('retry').disabled);h.journal=await fixture();await h.poll();assert.equal(h.el('dashboard').hidden,true);assert.equal(h.el('pending-control').hidden,true);assert(h.el('message').textContent.includes('reconnect explicitly'));const count=h.calls.length;await h.poll();assert.equal(h.calls.length,count);h.dispose();
});

test('a fresh history with the same session UUID has a different instance and cannot receive or acknowledge an old pending control',async()=>{
 for(const route of ['poll','retry','lookup']){let posts=0;const h=harness(await fixture(),(path,init,context)=>{if(path==='/api/control'&&++posts===1)return Promise.reject(Error('Synthetic uncertainty'));if((path==='/api/control'||path.startsWith('/api/receipts/'))&&init.headers['X-Session-Instance']!==receiverState(context.journal,m).sessionInstance)return Response.json({version:1,error:'SESSION_MISMATCH',confirmed:false,ordersEnabled:false},{status:409});});await h.connect();const original=receiverState(h.journal,m);h.click('pause');await h.until(()=>!h.el('retry').disabled);h.journal=await m.createSessionJournal(h.journal.config,new Date(Date.parse(T)+3000).toISOString());const next=receiverState(h.journal,m);assert.equal(next.sessionId,original.sessionId);assert.notEqual(next.sessionInstance,original.sessionInstance);if(route==='poll')await h.poll();else h.click(route==='retry'?'retry':'reconcile');await h.until(()=>h.el('dashboard').hidden);assert.equal(h.journal.state.sequence,0);assert.equal(h.el('pending-control').hidden,true);assert.equal(h.el('pending-description').textContent,'');if(route!=='poll'){assert.equal(h.calls.at(-1).init.headers['X-Session-Id'],original.sessionId);assert.equal(h.calls.at(-1).init.headers['X-Session-Instance'],original.sessionInstance);}h.dispose();}
});

test('a control receipt with the same session UUID but another history instance clears the connection without acknowledgement',async()=>{
 const h=harness(await fixture(),async(path,init,context)=>{if(path==='/api/control'){context.journal=await m.appendSessionEvent(context.journal,JSON.parse(init.body),new Date(Date.parse(T)+3).toISOString());const result=receiverReceipt(context.journal,JSON.parse(init.body).requestId,'owner');result.sessionInstance='f'.repeat(64);return Response.json(result);}});await h.connect();h.click('pause');await h.until(()=>h.el('dashboard').hidden);assert.equal(h.el('pending-control').hidden,true);assert.equal(h.el('pending-description').textContent,'');assert(h.el('message').textContent.includes('another session'));h.dispose();
});

test('a receipt from another session clears identity and never acknowledges the original pending request',async()=>{
 const h=harness(await fixture(),async(path,init,context)=>{if(path==='/api/control'){context.journal=await m.appendSessionEvent(context.journal,JSON.parse(init.body),new Date(Date.parse(T)+3).toISOString());const result=receiverReceipt(context.journal,JSON.parse(init.body).requestId,'owner');result.sessionId=crypto.randomUUID();return Response.json(result);}});await h.connect();h.click('pause');await h.until(()=>h.el('dashboard').hidden);assert.equal(h.el('pending-control').hidden,true);assert(h.el('message').textContent.includes('another session'));assert.equal(h.el('owner-token').value,'');h.dispose();
});

test('a delayed old-session conflict body cannot erase a new explicit owner connection',async()=>{
 let release,reading=false;const h=harness(await fixture(),path=>path==='/api/control'?new Response(new ReadableStream({start(controller){release=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify({version:1,error:'SESSION_MISMATCH',confirmed:false,ordersEnabled:false})));controller.close();};},pull(){reading=true;}}),{status:409,headers:{'Content-Type':'application/json'}}):undefined);await h.connect();h.click('pause');await h.until(()=>reading&&h.calls.some(call=>call.init.method==='POST'));h.click('disconnect');assert.equal(h.el('pending-description').textContent,'');h.journal=await fixture();const nextSession=h.journal.config.sessionId;await h.connect(replacement);assert.equal(h.el('dashboard').hidden,false);release();await h.tick();assert.equal(h.el('dashboard').hidden,false);assert(h.el('identity').textContent.includes(nextSession));assert.equal(h.el('pending-control').hidden,true);assert.equal(h.el('pending-description').textContent,'');assert.equal(h.el('disconnect').disabled,false);assert.equal(h.calls.at(-1).init.headers.Authorization,'Bearer '+replacement);h.dispose();
});

test('a source quote ahead of a regressed monitor clock has UNKNOWN freshness instead of being labeled fresh',async()=>{
 const h=harness(await fixture());await h.connect();h.now=Date.parse(T)-1000;await h.poll();assert(h.el('quote-summary').textContent.includes('ahead of the local monitor clock'));assert(h.el('quote-summary').textContent.includes('freshness UNKNOWN'));h.dispose();
});

test('foreground polling waits five seconds, serializes pending reads and never retries an owner control automatically',async()=>{
 const h=harness(await fixture(),path=>path==='/api/control'?Promise.reject(Error('Synthetic uncertainty')):undefined);await h.connect();const timer=[...h.timers.entries()].find(([,value])=>value.delay===5000);assert(timer);h.timers.delete(timer[0]);timer[1].callback();await h.until(()=>h.calls.length===2&&h.el('connection-status').textContent.includes('Connected'));h.click('pause');await h.until(()=>!h.el('retry').disabled);await h.poll();await h.poll();assert.equal(h.calls.filter(call=>call.init.method==='POST').length,1);assert.equal(h.el('pending-control').hidden,false);assert.equal([...h.timers.values()].filter(value=>value.delay===5000).length,1);h.dispose();
});

test('double clicks serialize one owner control before asynchronous digest or receiver acknowledgement',async()=>{
 let release;const h=harness(await fixture(),(path,init,context)=>path==='/api/control'?new Promise(resolve=>release=async()=>{context.journal=await m.appendSessionEvent(context.journal,JSON.parse(init.body),new Date(Date.parse(T)+3).toISOString());resolve(Response.json(receiverReceipt(context.journal,JSON.parse(init.body).requestId,'owner')));}):undefined);await h.connect();h.click('pause');h.el('pause').dispatchEvent(new Event('click'));await h.until(()=>typeof release==='function');assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);await release();await h.until(()=>h.el('pending-control').hidden);h.dispose();
});

test('token change and disconnection clear all payloads and fence late state responses',async()=>{
 for(const mode of ['token','disconnect','pagehide']){let release;const h=harness(await fixture(),path=>path==='/api/state'?new Promise(resolve=>release=resolve):undefined);h.input(owner);h.el('connect-form').dispatchEvent(new Event('submit',{cancelable:true}));await h.until(()=>typeof release==='function');if(mode==='token')h.input(replacement);else if(mode==='disconnect')h.click('disconnect');else h.win.dispatchEvent(new Event('pagehide'));release(Response.json(receiverState(h.journal,m)));await h.tick();assert.equal(h.el('dashboard').hidden,true);assert.equal(h.el('positions').children.length,0);assert.equal(h.el('owner-token').value,mode==='token'?replacement:'');assert.equal(h.timers.size,0);h.dispose();}
});

test('authorization rejection clears a held checkpoint and pending control rather than retaining private state',async()=>{
 let unauthorized=false;const h=harness(await fixture(),path=>path==='/api/state'&&unauthorized?Response.json({version:1,error:'UNAUTHORIZED',confirmed:false,ordersEnabled:false},{status:401}):path==='/api/control'?Promise.reject(Error('Synthetic uncertainty')):undefined);await h.connect();h.click('pause');await h.until(()=>!h.el('retry').disabled);unauthorized=true;await h.poll();assert.equal(h.el('dashboard').hidden,true);assert.equal(h.el('pending-control').hidden,true);assert.equal(h.el('pending-description').textContent,'');assert.equal(h.el('positions').children.length,0);assert.equal(h.el('owner-token').value,'');assert.equal(h.timers.size,0);h.dispose();
});

test('hidden tabs stop polling and stale callbacks; pagehide erases the credential without stopping receiver exposure',async()=>{
 const h=harness(await fixture());await h.connect();assert.equal([...h.timers.values()].filter(t=>t.delay===monitorLimits.pollMs).length,1);h.hide(true);assert.equal(h.timers.size,0);const count=h.calls.length;await h.poll();assert.equal(h.calls.length,count);assert(h.el('session-status').textContent.startsWith('Stale view'));h.hide(false);await h.until(()=>h.calls.length>count&&h.el('session-status').textContent==='ACTIVE');h.win.dispatchEvent(new Event('pagehide'));assert.equal(h.el('dashboard').hidden,true);assert.equal(h.journal.state.openPositions.length,1);assert.equal(h.timers.size,0);h.dispose();
});

test('malformed, duplicate, excessive, inconsistent, unsafe or corrupted state cannot replace a confirmed checkpoint',async()=>{
 const good=receiverState(await fixture(),m);for(const mutate of [v=>v.ordersEnabled=true,v=>v.liveEnabled=true,v=>v.extra=true,v=>v.account.cash=null,v=>v.capacity.remainingTotal--,v=>v.strategy.digest='0'.repeat(64),v=>v.source.authenticity='VERIFIED',v=>v.openPositions[0].entrySequence=2033]){const value=structuredClone(good);mutate(value);await assert.rejects(validateMonitorState(value));}assert.throws(()=>parseMonitorJson('{"version":1,"version":1}'));assert.throws(()=>parseMonitorJson('{"\\u0076ersion":1,"version":1}'));assert.throws(()=>parseMonitorJson('['.repeat(18)+'0'+']'.repeat(18)));assert.throws(()=>parseMonitorJson('"'+ 'x'.repeat(monitorLimits.responseBytes)+'"'));
 let bad=false;const h=harness(await fixture(),path=>path==='/api/state'&&bad?new Response('{"version":1,"version":1}',{headers:{'Content-Type':'application/json'}}):undefined);await h.connect();const equity=h.el('equity').textContent;bad=true;await h.poll();assert.equal(h.el('equity').textContent,equity);assert(h.el('session-status').textContent.startsWith('Stale view'));h.dispose();
});

test('strict bounded UTF-8 responses reject oversize, malformed bytes and non-JSON bodies',async()=>{
 for(const response of [new Response('x'.repeat(monitorLimits.responseBytes+1),{headers:{'Content-Type':'application/json'}}),new Response(Uint8Array.from([123,34,120,34,58,34,0xc3,0x28,34,125]),{headers:{'Content-Type':'application/json'}}),new Response('<html>Unexpected</html>',{headers:{'Content-Type':'text/html'}})]){const h=harness(await fixture(),()=>response);await h.connect();assert.equal(h.el('dashboard').hidden,true);assert(h.el('connection-status').textContent.includes('unavailable'));h.dispose();}
});

test('hostile authored HTML stays literal text and no source URL, code, provider or credential storage path is used',async()=>{
 const hostile='<img src=x onerror=alert(1)>',h=harness(await fixture({name:hostile}));await h.connect();assert.equal(h.el('strategy-name').textContent,hostile);assert.equal(h.el('strategy-name').children.length,0);assert(h.calls.every(call=>call.path==='/api/state'));const source=await readFile('scripts/session-monitor.mjs','utf8'),css=await readFile('scripts/session-monitor.css','utf8');assert(!/localStorage|sessionStorage|indexedDB|innerHTML|eval\(|new Function|console\.(?:log|warn|error)|WebSocket|EventSource/.test(source));assert(!/<script(?![^>]*src=)[^>]*>/.test(html));assert(!/\bon(?:click|submit|load)=|<style\b|style=/.test(html));assert(!/id="owner-token"[^>]*\bname=/.test(html));assert(css.includes('prefers-reduced-motion'));assert(css.includes('max-width:760px'));assert(css.includes(':focus-visible'));h.dispose();
});
