import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,statSync,symlinkSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {receiverInstance} from '../scripts/session-receiver-protocol.mjs';
import {runProducer,ProducerStore,validateProducerAuthorization,validateProducerState,loadProducerModules,cleanupProducerModules,producerLimits} from '../scripts/kraken-market-data.mjs';

// All provider and receiver responses in this file are invented local fixtures.
// These checks do not establish API permission, authentic prices or real fills.
const sha=v=>createHash('sha256').update(v).digest('hex'),receiverStartedAt='2026-10-11T04:00:00.000Z';let instance,receiverImplementation;
const producerToken='og_local_producer_'+sha('INVENTED fixture producer credential');
let directory,m,config,serial=0;
before(async()=>{
 directory=mkdtempSync(join(tmpdir(),'opengrail-feed-tests-'));m=await loadProducerModules();
 const record={version:1,id:randomUUID(),rootId:null,revision:1,requestId:randomUUID(),createdAt:'2026-10-11T00:00:00.000Z',author:{kind:'HUMAN',id:'human_'+'a'.repeat(64),sponsorId:'human_'+'a'.repeat(64)},content:{name:'INVENTED DCA source',description:'Synthetic fixture; not a public hub record.',assumptions:'Invented public-provider envelopes.',falsification:'No provider authenticity or outcome qualification.',sources:[],definition:{schemaVersion:1,market:{symbol:'BTC/USD',timeframe:'5m',direction:'LONG'},entry:{type:'DCA',intervalBars:1,maxEntries:1},risk:{positionPct:1,maxOpenPositions:1,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:1},costs:{feeBps:23,slippageBps:37},execution:{mode:'DEMO',leverage:1,ordersEnabled:false}},relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false};record.rootId=record.id;
 config=m.boundedSessionConfig({version:1,sessionId:randomUUID(),methodVersion:'opengrail-session-v1',clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record,digest:sha(JSON.stringify(record))},initialCapital:1000,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'INVENTED authorized synthetic provider envelopes for tests.'},sourceLabel:'INVENTED Kraken fixture',ordersEnabled:false,liveEnabled:false}).config;receiverImplementation={version:'opengrail-session-v1',...m.sessionSourceFingerprints};instance=receiverInstance({config,startedAt:receiverStartedAt,implementation:receiverImplementation});
});
after(()=>{cleanupProducerModules();rmSync(directory,{recursive:true,force:true});});
const auth=overrides=>({receiverOrigin:'http://127.0.0.1:23456',sessionInstance:instance,receiverStartedAt,receiverImplementation,producerToken,publicDataUseApproved:true,sharedIpRateBudgetApproved:true,pollMs:15000,cycles:1,...overrides});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
function fixture(options={}){
 let time=Date.parse('2026-10-11T05:00:30.000Z'),sourceCalls=[],posts=[],lookups=[],receipts=new Map();const path=join(directory,'case-'+(++serial)+'.json'),store=new ProducerStore(path),now=()=>new Date(time).toISOString();
 const sourceFetch=async(url,request)=>{sourceCalls.push({url:url.toString(),request,at:time});if(options.sourceFetch)return options.sourceFetch(url,request,{time,sourceCalls});const pair='BTC/USD',start=Math.floor(time/300000)*300;return json(url.pathname.endsWith('/OHLC')?{error:[],result:{[pair]:[[start-300,'100','101','99','100','100','1',2],[start,'100','101','99','100','100','1',2]],last:start}}:{error:[],result:{[pair]:[['100','1',(options.quoteTime??time-1)/1000,'b','m','',123]],last:'123456789'}});};
 const receiverFetch=async(url,request)=>{if(url.pathname.startsWith('/api/receipts/')){lookups.push(url.pathname);const receipt=receipts.get(url.pathname.split('/').at(-1));return json(receipt??{version:1,error:'NOT_FOUND',confirmed:false,ordersEnabled:false},receipt?200:404);}
  assert.equal(url.origin,auth().receiverOrigin);assert.equal(url.pathname,'/api/events');assert.equal(request.redirect,'error');const event=JSON.parse(request.body);posts.push({event,body:request.body});const disk=JSON.parse(readFileSync(path,'utf8')),entry=disk.entries.find(v=>v.event.requestId===event.requestId);assert(entry,'Exact prepared event must be durable before transport.');assert.equal(entry.status,'PENDING');assert.equal(entry.attempts.at(-1).status,'PENDING');assert.equal(entry.eventDigest,sha(request.body));
  const confirmation={version:1,sessionId:config.sessionId,sessionInstance:instance,receipt:{requestId:event.requestId,eventDigest:sha(request.body),receivedAt:now(),sequence:receipts.size+1,disposition:options.rejected?'REJECTED':'ACCEPTED',reason:options.rejected?'BAR_GAP':event.type==='QUOTE'?'QUOTE_RECEIVED':'BAR_RECEIVED'},duplicate:false,stateDigest:sha('INVENTED derived state'),journalDigest:sha('INVENTED derived journal'),ordersEnabled:false};receipts.set(event.requestId,confirmation);
  if(options.receiverFetch)return options.receiverFetch(confirmation,{event,request,posts,receipts});return json(confirmation);
 };
 return {path,store,sourceCalls,posts,lookups,receipts,now,setTime:v=>{time=v;},advance:v=>{time+=v;},sleep:async ms=>{time+=ms;},sourceFetch,receiverFetch,options:overrides=>({command:'start',config,authorization:auth(),store,sourceFetch,receiverFetch,sleep:async ms=>{time+=ms;},now,...overrides})};
}

test('operator approvals, fixed local origin, producer-only credentials and finite budgets are required',()=>{
 assert.equal(validateProducerAuthorization(auth()).pollMs,15000);
 for(const overrides of [{publicDataUseApproved:false},{sharedIpRateBudgetApproved:false},{publicDataUseApproved:undefined},{receiverOrigin:'https://127.0.0.1:23456'},{receiverOrigin:'http://localhost:23456'},{receiverOrigin:'http://127.0.0.1:23456/'},{receiverOrigin:'http://127.0.0.1:23456/api'},{receiverOrigin:'http://127.0.0.1:23456?token=x'},{producerToken:'og_local_owner_'+'a'.repeat(64)},{producerToken:'og_agent_'+'a'.repeat(64)},{pollMs:14999},{cycles:121},{cycles:0},{arbitraryEndpoint:'https://evil.invalid'}])assert.throws(()=>validateProducerAuthorization(auth(overrides)));
});
test('missing approvals create no local feed state and make no source request',async()=>{const f=fixture();await assert.rejects(runProducer(f.options({authorization:auth({sharedIpRateBudgetApproved:false})})));assert.equal(f.sourceCalls.length,0);assert.throws(()=>readFileSync(f.path));});
test('fixed public GETs carry no local credentials, reject redirects and observe bounded sequential pacing',async()=>{
 const f=fixture();const state=await runProducer(f.options({authorization:auth({cycles:2})}));assert.equal(f.sourceCalls.length,4);for(const c of f.sourceCalls){assert.equal(new URL(c.url).origin,'https://api.kraken.com');assert.equal(c.request.method,'GET');assert.equal(c.request.redirect,'error');assert.equal(c.request.headers,undefined);assert(!c.url.includes(producerToken));assert.equal(new URL(c.url).searchParams.get('assetVersion'),'1');}
 assert(f.sourceCalls[1].at-f.sourceCalls[0].at>=1000);assert(f.sourceCalls[2].at-f.sourceCalls[0].at>=15000);assert.equal(state.status,'COMPLETED');assert.equal(state.ordersEnabled,false);assert.equal(state.qualification,'NONE');
});
test('normalized closed-bar and sampled-quote outbox is durable with response identities and no raw credential',async()=>{
 const f=fixture(),state=await runProducer(f.options());assert.equal(state.entries.length,2);assert.equal(state.entries[0].event.type,'CLOSED_BAR');assert.equal(state.entries[0].event.bar.closedAt,'2026-10-11T05:00:00.000Z');assert.equal(state.entries[1].event.type,'QUOTE');assert.equal(state.polls[0].currentBarOmitted,true);assert.match(state.polls[0].ohlcDigest,/^[a-f0-9]{64}$/);assert.equal(state.polls[0].tradesCursor,'123456789');assert.equal(statSync(f.path).mode&0o777,0o600);assert(!readFileSync(f.path,'utf8').includes(producerToken));assert.equal((await validateProducerState(state,config,auth())).stateDigest,state.stateDigest);
});
test('unchanged latest trade timestamp is skipped without timestamp bump or new duplicate quote',async()=>{const f=fixture({quoteTime:Date.parse('2026-10-11T05:00:30.000Z')-1}),state=await runProducer(f.options({authorization:auth({cycles:2})}));assert.equal(state.entries.filter(e=>e.event.type==='QUOTE').length,1);assert.equal(state.polls[1].repeatedQuote,true);});
test('lost committed response resumes by original receipt lookup without another source poll or POST',async()=>{
 let first=true;const f=fixture({receiverFetch:value=>{if(first){first=false;throw Error('INVENTED response loss');}return json(value);}});await assert.rejects(runProducer(f.options()));let state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(state.status,'UNCERTAIN');assert.equal(state.entries[0].attempts[0].status,'UNCONFIRMED');const original=state.entries[0].event;
 state=await runProducer(f.options({command:'resume',store:new ProducerStore(f.path)}));assert.equal(f.sourceCalls.length,2);assert.equal(f.posts.filter(v=>v.event.requestId===original.requestId).length,1);assert.equal(f.lookups.length,2);assert.deepEqual(state.entries[0].event,original);assert.equal(state.entries[0].attempts.length,2);assert.equal(state.status,'COMPLETED');
});
test('lost uncommitted response retries the identical durable body only after exact NOT_FOUND',async()=>{
 let first=true;const f=fixture({receiverFetch:(value,{event,receipts})=>{if(first){first=false;receipts.delete(event.requestId);throw Error('INVENTED no commit');}return json(value);}});await assert.rejects(runProducer(f.options()));const body=f.posts[0].body;await runProducer(f.options({command:'resume',store:new ProducerStore(f.path)}));assert.equal(f.posts[1].body,body);assert.equal(f.posts.filter(v=>v.body===body).length,2);assert.equal(f.sourceCalls.length,2);
});
test('wrong session instance on resume cannot mutate retained state or call either transport',async()=>{
 const f=fixture({receiverFetch:()=>{throw Error('INVENTED loss');}});await assert.rejects(runProducer(f.options()));const before=readFileSync(f.path,'utf8'),calls=f.sourceCalls.length;await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path),authorization:auth({sessionInstance:'b'.repeat(64)})})),/RECEIVER_CONFIG_MISMATCH/);assert.equal(readFileSync(f.path,'utf8'),before);assert.equal(f.sourceCalls.length,calls);
});
test('wrong acknowledgment event digest remains unconfirmed and cannot advance source watermark',async()=>{const f=fixture({receiverFetch:v=>json({...v,receipt:{...v.receipt,eventDigest:'b'.repeat(64)}})});await assert.rejects(runProducer(f.options()),/UNCONFIRMED_RECEIVER_RESPONSE/);const state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(state.lastBar,null);assert.equal(state.entries[0].status,'PENDING');assert.equal(state.entries[0].confirmation,null);});
test('a confirmed reducer rejection remains terminal rather than being retried as a new event',async()=>{
 const f=fixture({rejected:true});await assert.rejects(runProducer(f.options()),/CONFIRMED_REJECTION/);const state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(state.status,'FAILED');assert.equal(state.entries[0].confirmation.receipt.disposition,'REJECTED');assert.equal(f.posts.length,1);await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path)})),/TERMINAL_PRODUCER_STATE/);assert.equal(f.posts.length,1);
});
test('provider HTTP failure consumes and retains a poll; explicit resume uses the remaining lifetime budget',async()=>{
 let failing=true;const f=fixture({sourceFetch:(url,request,{time})=>{if(failing)return json({error:['INVENTED throttle']},429);const start=Math.floor(time/300000)*300;return json(url.pathname.endsWith('/OHLC')?{error:[],result:{'BTC/USD':[[start-300,'100','101','99','100','100','1',1],[start,'100','101','99','100','100','1',1]],last:start}}:{error:[],result:{'BTC/USD':[['100','1',(time-1)/1000,'b','m','',1]],last:'123'}});}});
 await assert.rejects(runProducer(f.options({authorization:auth({cycles:2})})),/PROVIDER_HTTP_FAILURE/);let state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(state.polls.length,1);assert.equal(state.polls[0].status,'FAILED');assert.equal(f.posts.length,0);failing=false;state=await runProducer(f.options({command:'resume',store:new ProducerStore(f.path),authorization:auth({cycles:2})}));assert.equal(state.polls.length,2);assert.equal(state.polls[0].reason,'PROVIDER_HTTP_FAILURE');assert.equal(f.sourceCalls.length,3);assert.equal(state.status,'COMPLETED');
});
test('duplicate JSON keys and oversized response bytes cannot produce events',async()=>{
 for(const response of [new Response('{"error":[],"error":[],"result":{}}',{headers:{'content-type':'application/json'}}),new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}})]){const f=fixture({sourceFetch:()=>response});await assert.rejects(runProducer(f.options()));assert.equal(f.posts.length,0);assert.equal(JSON.parse(readFileSync(f.path,'utf8')).polls[0].status,'FAILED');}
});
test('an externally changed producer state cannot be overwritten or confirm an unaudited event',async()=>{
 const f=fixture({receiverFetch:value=>{writeFileSync(f.path,'INVENTED external file modification',{mode:0o600});return json(value);}});await assert.rejects(runProducer(f.options()),/EXTERNAL_PRODUCER_CHANGE/);assert.equal(readFileSync(f.path,'utf8'),'INVENTED external file modification');assert.equal(f.posts.length,1);
});
test('a retained producer file cannot be silently replaced by another start',async()=>{const f=fixture();await runProducer(f.options());const before=readFileSync(f.path,'utf8');await assert.rejects(runProducer(f.options({store:new ProducerStore(f.path)})));assert.equal(readFileSync(f.path,'utf8'),before);});
test('state symlinks and broadly readable retained files are refused on resume',async()=>{
 const f=fixture({receiverFetch:()=>{throw Error('INVENTED loss');}});await assert.rejects(runProducer(f.options()));const link=f.path+'.link';symlinkSync(f.path,link);await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(link)})));chmodSync(f.path,0o644);await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path)})),/INVALID_LOCAL_FILE/);
});
test('clock regression stops before an unbounded wait or another provider call',async()=>{
 let f;f=fixture({receiverFetch:value=>{f.setTime(Date.parse('2026-10-11T04:00:00.000Z'));return json(value);}});await assert.rejects(runProducer(f.options({authorization:auth({cycles:2})})),/CLOCK_REGRESSION/);assert.equal(f.sourceCalls.length,2);assert.equal(JSON.parse(readFileSync(f.path,'utf8')).status,'FAILED');
});
test('delivery reconciliation has a persistent finite attempt budget across restarts',async()=>{
 const f=fixture({receiverFetch:(value,{event,receipts})=>{receipts.delete(event.requestId);throw Error('INVENTED loss');}});for(let n=0;n<producerLimits.deliveryAttempts;n++)await assert.rejects(runProducer(f.options({command:n?'resume':'start',store:new ProducerStore(f.path)})));await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path)})),/DELIVERY_ATTEMPT_CAPACITY/);const state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(state.entries[0].attempts.length,8);assert.equal(state.status,'FAILED');assert.equal(f.sourceCalls.length,2);
});
test('completed finite feed cannot reset its poll history on resume or claim liquidation',async()=>{const f=fixture(),logs=[];await runProducer(f.options({emit:v=>logs.push(v)}));assert.equal(logs.at(-1).sessionLiquidated,false);await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path)})),/TERMINAL_PRODUCER_STATE/);assert.equal(f.sourceCalls.length,2);});
test('actual CLI rejects absent consent and owner credentials before opening a network feed',()=>{
 const cfg=join(directory,'cli-config.json'),state=join(directory,'cli-state.json');writeFileSync(cfg,JSON.stringify(config));for(const input of [JSON.stringify(auth({publicDataUseApproved:false})),JSON.stringify(auth({producerToken:'og_local_owner_'+'a'.repeat(64)}))]){const result=spawnSync(process.execPath,['scripts/kraken-market-data.mjs','start',cfg,state],{cwd:process.cwd(),env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin'},input,encoding:'utf8',timeout:15000,maxBuffer:4096});assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/INVALID_OPERATOR_AUTHORIZATION/);assert(!result.stderr.includes(producerToken));assert.throws(()=>readFileSync(state));}
});

test('a resumed delivery with a regressed clock stops before receipt lookup or POST and remains valid retained failure',async()=>{
 const f=fixture({receiverFetch:()=>{throw Error('INVENTED loss');}});await assert.rejects(runProducer(f.options()));const count=f.posts.length;f.setTime(Date.parse('2026-10-11T04:00:00.000Z'));await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path)})),/CLOCK_REGRESSION/);assert.equal(f.lookups.length,0);assert.equal(f.posts.length,count);const state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(state.status,'FAILED');assert(state.clockFault.at<state.clockFault.previousAt);await validateProducerState(state,config,auth());
});
test('clock regression during a source fetch is retained without repairing time or creating invalid recovery history',async()=>{
 for(const outcome of ['success','httpFailure','transportFailure','malformed']){let f;f=fixture({sourceFetch:()=>{f.setTime(Date.parse('2026-10-11T04:00:00.000Z'));if(outcome==='transportFailure')throw Error('INVENTED network failure');if(outcome==='malformed')return new Response('not json',{headers:{'content-type':'application/json'}});return json({error:[],result:{'BTC/USD':[],last:123}},outcome==='httpFailure'?429:200);}});await assert.rejects(runProducer(f.options()),/CLOCK_REGRESSION/);const state=JSON.parse(readFileSync(f.path,'utf8'));assert.equal(f.sourceCalls.length,1);assert.equal(f.posts.length,0);assert.equal(state.polls[0].reason,'CLOCK_REGRESSION');assert(state.polls[0].finishedAt<state.polls[0].startedAt);await validateProducerState(state,config,auth());}
});
test('async receipt NOT_FOUND cannot trigger a POST after local state changes or known operator interruption',async()=>{
 for(const kind of ['changed','interrupted']){
  const f=fixture({receiverFetch:(value,{event,receipts})=>{receipts.delete(event.requestId);throw Error('INVENTED loss');}});await assert.rejects(runProducer(f.options()));const count=f.posts.length;let stopped=false;const receiverFetch=async(url,options)=>{assert(url.pathname.startsWith('/api/receipts/'));if(kind==='changed')writeFileSync(f.path,'INVENTED external change',{mode:0o600});else stopped=true;return json({version:1,error:'NOT_FOUND',confirmed:false,ordersEnabled:false},404);};
  await assert.rejects(runProducer(f.options({command:'resume',store:new ProducerStore(f.path),receiverFetch,interrupted:()=>stopped})));assert.equal(f.posts.length,count);if(kind==='changed')assert.equal(readFileSync(f.path,'utf8'),'INVENTED external change');else assert.equal(JSON.parse(readFileSync(f.path,'utf8')).entries[0].attempts.at(-1).reason,'OPERATOR_INTERRUPTED');
 }
});

test('receiver history preimage rejects changed market, timeframe, costs, capital, start or implementation before file/network',async()=>{
 for(const field of ['symbol','timeframe','fee','capital','startedAt','implementation']){
  const f=fixture(),changed=structuredClone(config),authorization=auth();
  if(field==='symbol')changed.strategy.record.content.definition.market.symbol='ETH/USD';if(field==='timeframe')changed.strategy.record.content.definition.market.timeframe='1h';if(field==='fee')changed.strategy.record.content.definition.costs.feeBps=24;if(field==='capital')changed.initialCapital=1001;if(field==='startedAt')authorization.receiverStartedAt='2026-10-11T03:00:00.000Z';if(field==='implementation')authorization.receiverImplementation={...receiverImplementation,engine:'b'.repeat(64)};changed.strategy.digest=sha(JSON.stringify(changed.strategy.record));
  await assert.rejects(runProducer(f.options({config:changed,authorization})),/RECEIVER_CONFIG_MISMATCH/);assert.equal(f.sourceCalls.length,0);assert.equal(f.posts.length,0);assert.throws(()=>readFileSync(f.path));
 }
});
