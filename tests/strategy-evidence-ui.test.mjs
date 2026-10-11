import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {constantProgram,moduleHex} from './helpers/program-fixtures.mjs';

// Actual component hook/event fixtures with invented public projections. These checks
// do not establish browser layout, hosted authentication or independent execution.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const context = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0};
globalThis.__strategyEvidenceHooks = {
  useState(initial) {const i=context.si++; if (!(i in context.state)) context.state[i]=typeof initial==='function'?initial():initial; return [context.state[i], next=>context.state[i]=typeof next==='function'?next(context.state[i]):next];},
  useRef(initial) {return context.refs[context.ri++]??={current:initial};},
  useEffect(callback,deps) {const i=context.ei++,old=context.deps[i]; if (!old||deps.some((value,n)=>value!==old[n])) {context.deps[i]=deps; context.effects.push(()=>{context.cleanup[i]?.();context.cleanup[i]=callback();});}},
};
const built=await build({entryPoints:['app/strategy-evidence.tsx'],bundle:true,format:'cjs',platform:'node',write:false,target:'es2022',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'evidence-hooks',setup(b){b.onResolve({filter:/^react$/},a=>a.importer.endsWith('/app/strategy-evidence.tsx')?{path:a.path,namespace:'hooks'}:undefined);b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:'export const {useState,useRef,useEffect}=globalThis.__strategyEvidenceHooks;',loader:'js'}));}}]});
const module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);const StrategyEvidence=module.exports.default;
async function bundle(path){const b=await build({entryPoints:[path],bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
const [strategy,model]=await Promise.all([bundle('app/strategy-model.ts'),bundle('app/strategy-evidence-model.ts')]);
const at='2026-10-11T08:30:00.000Z',authorId=await strategy.strategyPublicHumanId('invented-ui-sponsor'),author={kind:'HUMAN',id:authorId,sponsorId:authorId};
const uid=()=>crypto.randomUUID(),ref=value=>({id:value.id,digest:value.digest});
async function source(name='Synthetic exact source'){
  const id=uid(),record={version:1,id,rootId:id,revision:1,requestId:uid(),createdAt:at,author,content:{name,description:'Invented strategy for component fixtures.',assumptions:'Reject inconsistent results.',falsification:'Costs or negative outcomes may refute the hypothesis.',sources:[],definition:strategy.strategyTemplate('TREND'),relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false};
  const bounded=strategy.boundedStrategyRecord(record);return {id,digest:await strategy.strategyDigest(bounded.payload),rootId:id,revision:1,requestId:record.requestId,createdAt:at,author,state:'VISIBLE',reason:null,record,moderation:[]};
}
async function programSource(){
  const item=await source('Actual inert binary strategy'),definition=strategy.strategyTemplate('SIGNAL'),bytesHex=moduleHex(constantProgram(1));
  definition.entry={type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:1};
  const record=strategy.boundedStrategyRecord({...item.record,version:2,content:{...item.record.content,definition,program:{profile:'opengrail-wasm-i32-f64-v1',abi:'opengrail-causal-signal-wasm-v1',bytesHex,digest:createHash('sha256').update(Buffer.from(bytesHex,'hex')).digest('hex'),parameters:[]}}}).record;
  return {...item,record,digest:await strategy.strategyDigest(JSON.stringify(record))};
}
function suppressed(sourceItem,state='HIDDEN'){
  const reason=state==='WITHDRAWN'?'AUTHOR_REQUEST':'POLICY';return {...sourceItem,state,reason,record:null,moderation:[...sourceItem.moderation,{sequence:sourceItem.moderation.length+1,requestId:uid(),createdAt:at,actor:author,state,reason}]};
}
function entry(sourceItem,{id=uid(),type='OUTCOME',name='Invented retained result',status='INTERRUPTED',state='VISIBLE',claim={type:'ORIGINAL',relation:null},observation={kind:'INTERRUPTED'},manifest={id:uid(),digest:'c'.repeat(64)},method,flags=[],createdAt=at,reporting='AUTHOR_REPORTED',outcomeCount=0,suppression=null}={}){
  return {summary:{id,digest:'d'.repeat(64),type,requestId:uid(),createdAt,author,strategy:ref(sourceItem),manifest:type==='MANIFEST'?null:manifest,state,reason:state==='VISIBLE'?null:state==='WITHDRAWN'?'AUTHOR_REQUEST':'POLICY',suppression,reporting:type==='MANIFEST'?outcomeCount?'AUTHOR_REPORTED':'UNREPORTED':reporting,outcomeCount:type==='MANIFEST'?outcomeCount:0,name:state==='VISIBLE'?name:null,status:state==='VISIBLE'&&type==='OUTCOME'?status:null,flags:state==='VISIBLE'?flags:[],...(method&&state==='VISIBLE'?{method}:{})},claim:state==='VISIBLE'&&type==='OUTCOME'?claim:null,observation:state==='VISIBLE'&&type==='OUTCOME'?observation:null};
}
function page(sourceItem,items=[],nextCursor=null){return {version:1,strategy:sourceItem,items:[...items].sort((a,b)=>b.summary.createdAt.localeCompare(a.summary.createdAt)||b.summary.id.localeCompare(a.summary.id)),nextCursor,classification:'AUTHOR_REPORTED',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false};}
function expand(node){return node&&typeof node==='object'&&typeof node.type==='function'&&node.type.name==='EvidenceRow'?node.type(node.props):node;}
function walk(node,predicate){const n=expand(node);if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(child=>walk(child,predicate));return [...(predicate(n)?[n]:[]),...walk(n.props?.children,predicate)];}
function text(node){const n=expand(node);return n==null||typeof n==='boolean'?'':Array.isArray(n)?n.map(text).join(' '):typeof n==='object'?text(n.props?.children):String(n);}
const label=node=>text(node).replace(/\s+/g,' ').trim(),button=(tree,name)=>walk(tree,n=>n.type==='button'&&(n.props['aria-label']===name||label(n)===name))[0],field=(tree,name)=>walk(tree,n=>n.props?.['aria-label']===name)[0];
function harness(props){context.cleanup.forEach(cleanup=>cleanup?.());for(const k of ['state','refs','deps','effects','cleanup'])context[k]=[];const render=()=>{context.si=0;context.ri=0;context.ei=0;return StrategyEvidence(props);};const flush=async()=>{for(let n=0;n<12;n++){render();while(context.effects.length)context.effects.shift()();await new Promise(resolve=>setImmediate(resolve));}return render();};const until=async predicate=>{const deadline=Date.now()+5000;do{const tree=await flush();if(typeof predicate==='function'?predicate(tree):text(tree).includes(predicate))return tree;}while(Date.now()<deadline);assert.fail('Timed out: '+text(render()));};return {props,render,flush,until,click(name){const b=button(render(),name);assert(b,'Missing '+name);assert(!b.props.disabled,name+' disabled');b.props.onClick();},unmount(){context.cleanup.forEach(cleanup=>cleanup?.());}};}
function server(get){const requests=[];globalThis.fetch=async(path,init={})=>{requests.push({path,init});const result=await get(path,init,requests);return result instanceof Response?result:Response.json(result);};return requests;}
after(()=>{context.cleanup.forEach(cleanup=>cleanup?.());globalThis.fetch=originalFetch;delete globalThis.__strategyEvidenceHooks;});

test('exact anonymous workspace reads one pinned projection, keeps canonical links and creates no writer or review query',async()=>{
  const s=await source(),row=entry(s),requests=server(()=>page(s,[row])),h=harness({signedIn:false,selection:ref(s)});await h.until(row.summary.name);const tree=h.render();assert.equal(requests.length,1);assert.equal(requests[0].path,'/api/strategies/evidence?strategy='+s.id+'&digest='+s.digest);assert(requests.every(r=>r.init.cache==='no-store'&&!r.init.method&&!r.init.body));
  for(const phrase of ['Definition: UNTESTED','AUTHOR_REPORTED','qualification NONE','independence NOT_ESTABLISHED','server-derived summaries','Interrupted attempt retained'])assert(text(tree).includes(phrase),phrase);
  assert.equal(field(tree,'Exact strategy permalink').props.href,model.strategyEvidenceHref(s));assert.equal(field(tree,'Inspect evidence '+row.summary.id).props.href,'/experiments?id='+row.summary.id+'&digest='+row.summary.digest);assert.equal(field(tree,'Reviews evidence '+row.summary.id).props.href,field(tree,'Inspect evidence '+row.summary.id).props.href);
  assert.equal(field(tree,'Demo exact strategy').props.href,'/demo?strategy='+s.id+'&digest='+s.digest);assert.equal(field(tree,'Session exact strategy').props.href,'/session?strategy='+s.id+'&digest='+s.digest);
  assert(walk(tree,n=>n.type==='a'&&n.props.href==='/signin-with-chatgpt?return_to='+encodeURIComponent(model.strategyEvidenceHref(s))).every(n=>n.props.target==='_top'));assert.equal(walk(tree,n=>['form','input','textarea'].includes(n.type)).length,0);
});

test('exact V2 source inspection retains every binary field and links only the causal program workflow',async()=>{
  const s=await programSource();let hidden=false;const requests=server(()=>page(hidden?suppressed(s):s)),h=harness({signedIn:false,selection:ref(s)});await h.until('Exact program source');
  const tree=h.render(),retained=field(tree,'Exact retained program'),link=field(tree,'Program exact strategy');
  assert.deepEqual(JSON.parse(text(retained)),s.record.content.program);assert.equal(link.props.href,'/program?strategy='+s.id+'&digest='+s.digest);assert(!field(tree,'Demo exact strategy')&&!field(tree,'Session exact strategy'));
  for(const phrase of ['Publication is inert','local program replay requires a separate admission','Public program manifests and outcomes','independent qualification remain outstanding'])assert(text(tree).includes(phrase),phrase);
  assert.equal(requests.length,1);assert(requests.every(request=>!request.init.method&&!request.init.body));
  hidden=true;h.click('Refresh strategy evidence');await h.until('Strategy content unavailable');assert(!field(h.render(),'Exact retained program')&&!field(h.render(),'Program exact strategy'));let prevented=false;link.props.onClick({preventDefault(){prevented=true;}});assert(prevented);
});

test('a coherent outer strategy hash cannot hide a wrong raw program digest in the evidence reader',async()=>{
  for(const legacy of [false,true]){
    const s=await programSource();s.record.content.program.digest='0'.repeat(64);s.digest=await strategy.strategyDigest(JSON.stringify(s.record));const requests=server(path=>path.startsWith('/api/strategies?id=')?{version:1,item:s,executionEnabled:false}:page(s)),h=harness({signedIn:false,selection:{id:s.id,digest:legacy?null:s.digest}});
    await h.until('No alternative version or result was substituted.');assert(!text(h.render()).includes(s.record.content.name));assert(!field(h.render(),'Exact retained program')&&!field(h.render(),'Program exact strategy'));assert.equal(requests.length,1);
  }
});

test('legacy ID-only link resolves exactly once then pins returned digest beyond the catalog',async()=>{
  const s=await source('Version absent from catalog'),requests=server(path=>path.startsWith('/api/strategies?id=')?{version:1,item:s,executionEnabled:false}:page(s)),h=harness({signedIn:false,selection:{id:s.id,digest:null}});await h.until(s.record.content.name);await h.until(tree=>text(tree).includes('No retained public records'));assert.deepEqual(requests.map(r=>r.path),['/api/strategies?id='+s.id,'/api/strategies/evidence?strategy='+s.id+'&digest='+s.digest]);assert.equal(field(h.render(),'Exact strategy permalink').props.href,model.strategyEvidenceHref(s));h.click('Refresh strategy evidence');await h.flush();assert.equal(requests.filter(r=>r.path.startsWith('/api/strategies?id=')).length,1);
});

test('supplied wrong digest never resolves legacy ID or substitutes another revision',async()=>{
  const s=await source(),requests=server(()=>page(s)),h=harness({signedIn:false,selection:{id:s.id,digest:'e'.repeat(64)}});await h.until('No alternative version or result was substituted.');assert(!text(h.render()).includes(s.record.content.name));assert(requests.every(r=>r.path.includes('&digest='+'e'.repeat(64))));h.click('Refresh strategy evidence');await h.flush();assert.equal(requests.length,2);assert(!requests.some(r=>r.path.startsWith('/api/strategies?id=')));
});

test('invalid exact selection renders an error and makes no catalog or provider call',async()=>{const requests=server(()=>{throw Error('Forbidden');}),h=harness({signedIn:false,selection:null,selectionError:'Invalid exact strategy link.'});await h.until('Invalid exact strategy link.');assert.equal(requests.length,0);assert(button(h.render(),'Refresh strategy evidence').props.disabled);});

test('timeline retains losses, interruption, unavailable artifacts, unreported manifests and tombstones without rankings',async()=>{
  const s=await source(),metrics={initialCapital:1000,finalEquity:900,netPnl:-100,returnPct:-10,maxDrawdownPct:12,trades:2,wins:0,losses:2,totalFees:4,turnover:2000,comparable:true},benchmark={status:'COMPLETED',reason:null,allocationPct:1,direction:'LONG',initialCapital:1000,finalEquity:950,netPnl:-50,returnPct:-5,totalFees:2,comparable:true};
  const rows=[entry(s,{name:'Retained loss',status:'COMPLETED',observation:{kind:'BATCH',status:'COMPLETED',artifactDigest:'a'.repeat(64),metrics,benchmark},flags:['SAME_SPONSOR']}),entry(s,{name:'Retained failure',status:'FAILED',observation:{kind:'BATCH',status:'FAILED',artifactDigest:'b'.repeat(64),metrics:null,benchmark:null}}),entry(s,{name:'Retained interruption'}),entry(s,{name:'Retained missing artifact',status:'ARTIFACT_UNAVAILABLE',observation:{kind:'ARTIFACT_UNAVAILABLE'}}),entry(s,{type:'MANIFEST',name:'Unreported manifest'}),entry(s,{state:'HIDDEN',name:'Must never render hidden body'}),entry(s,{state:'WITHDRAWN',name:'Must never render withdrawn body'})];server(()=>page(s,rows));const h=harness({signedIn:false,selection:ref(s)});await h.until('Retained loss');const tree=h.render();assert(/-10\s*%/.test(text(tree)));assert(/-5\s*%/.test(text(tree)));for(const phrase of ['Retained failure','Interrupted attempt retained','Artifact unavailable','Unreported is not a successful result','WITHDRAWN','HIDDEN','SAME_SPONSOR'])assert(text(tree).includes(phrase),phrase);assert.equal(walk(tree,n=>n.props?.['aria-label']?.startsWith('Evidence ')).length,7);assert(!text(tree).includes('Must never render'));assert(!/win rate|leaderboard|qualified strategy|verified return/i.test(text(tree)));assert(walk(tree,n=>n.type==='dd'&&n.props.className==='og-evidence-negative').length>=2);assert.equal(rows.filter(r=>r.summary.state==='VISIBLE').length,walk(tree,n=>n.props?.['aria-label']?.startsWith('Inspect evidence ')).length);
});

test('continuous losses and open exposure stay checkpoint observations without batch baseline or return metric',async()=>{
  const s=await source(),row=entry(s,{name:'Pending emergency checkpoint',status:'STOPPING',method:'CONTINUOUS_DEMO',observation:{kind:'CONTINUOUS',status:'STOPPING',artifactDigest:'f'.repeat(64),initialCapital:1000,account:{markedAt:at,sourceObservedAt:at,cash:900,equity:970,reservedCollateral:100,unrealizedPnl:-30,realizedPnl:0,totalFees:1,turnover:100},openPositions:1,closedTrades:0,pending:false,capacityHalted:false,dataGap:true,emergencyAt:at}});server(()=>page(s,[row]));const h=harness({signedIn:false,selection:ref(s)});await h.until(row.summary.name);const tree=h.render();assert(text(tree).includes('Marked equity')&&text(tree).includes('Unrealized P&L')&&text(tree).includes('-30'));assert(text(tree).includes('Emergency exit awaits an acceptable quote')&&text(tree).includes('Data gap'));assert(!text(tree).includes('Simulated net return')&&!text(tree).includes('Long baseline'));assert(walk(tree,n=>n.type==='dd'&&n.props.className==='og-evidence-negative').length===2);
});

test('reproduction and conflicting outcome review links use their exact referenced original',async()=>{
  const s=await source(),original={id:uid(),digest:'a'.repeat(64)},rows=[entry(s,{name:'Reproduction result',claim:{type:'REPRODUCTION',relation:{type:'SUPPORTS',...original}}}),entry(s,{name:'Conflicting result',claim:{type:'CONFLICTING',relation:{type:'CONFLICTS',...original}}})],requests=server(()=>page(s,rows)),h=harness({signedIn:false,selection:ref(s)});await h.until('Conflicting result');for(const row of rows)assert.equal(field(h.render(),'Reviews evidence '+row.summary.id).props.href,'/experiments?id='+original.id+'&digest='+original.digest);assert.equal(requests.length,1);assert(!requests[0].path.includes('reviews'));
});

test('cursor pages preserve same-clock ordering and reject repeated, newer and foreign version projections',async()=>{
  for(const fault of ['none','repeated','newer','foreign']){
    const s=await source(),firstRows=[entry(s,{id:'f0000000-1111-4111-8111-111111111111'}),entry(s,{id:'e0000000-1111-4111-8111-111111111111'})],second=entry(s,{id:'d0000000-1111-4111-8111-111111111111',name:'Older exact evidence'}),anchor=firstRows[1].summary.id;
    server(path=>{if(!path.includes('&cursor='))return page(s,firstRows,anchor);if(fault==='repeated')return page(s,firstRows,anchor);if(fault==='newer')return page(s,[entry(s,{id:'f1000000-1111-4111-8111-111111111111'})]);if(fault==='foreign'){const changed=structuredClone(second);changed.summary.strategy.digest='f'.repeat(64);return page(s,[changed]);}return page(s,[second]);});const h=harness({signedIn:false,selection:ref(s)});await h.until(tree=>button(tree,'Earlier evidence'));h.click('Earlier evidence');if(fault==='none'){await h.until('Older exact evidence');assert(text(h.render()).includes('Earlier retained evidence'));h.click('Latest evidence');await h.until(tree=>button(tree,'Earlier evidence'));}else{await h.until('No alternative version or result was substituted.');assert(!button(h.render(),'Latest evidence'));assert(!text(h.render()).includes('Older exact evidence'));}
  }
});

test('malformed, duplicate-key, oversized and mismatched observation envelopes clear the page',async()=>{
  for(const fault of ['duplicate','unknown','oversized','wrong-status','wrong-source','bad-source-hash']){
    const s=await source(),row=entry(s),body=page(s,[row]);server(()=>{if(fault==='duplicate')return new Response(JSON.stringify(body).replace('"version":1','"version":1,"version":1'),{headers:{'Content-Type':'application/json'}});if(fault==='unknown')return {...body,profitabilityGuaranteed:true};if(fault==='oversized')return new Response(' '.repeat(model.strategyEvidenceLimits.responseBytes+1));if(fault==='wrong-status'){body.items[0].summary.status='ARTIFACT_UNAVAILABLE';return body;}if(fault==='wrong-source'){body.items[0].summary.strategy.digest='e'.repeat(64);return body;}body.strategy.record.content.name='Tampered source';return body;});const h=harness({signedIn:false,selection:ref(s)});await h.until('No alternative version or result was substituted.');assert(!text(h.render()).includes(row.summary.name));assert(!text(h.render()).includes('Tampered source'));
  }
});

test('hidden source clears all names, metrics and dependent links and older visible refresh cannot restore them',async()=>{
  const s=await source(),row=entry(s,{name:'Suppressed retained evidence'}),hidden=suppressed(s),hiddenRow=entry(s,{...row.summary,id:row.summary.id,state:'HIDDEN',suppression:'SOURCE_UNAVAILABLE'});let phase=0;server(()=>phase===1?page(hidden,[hiddenRow]):page(s,[row]));const h=harness({signedIn:false,selection:ref(s)});await h.until(row.summary.name);const oldLink=field(h.render(),'Inspect evidence '+row.summary.id);phase=1;h.click('Refresh strategy evidence');await h.until('Strategy content unavailable');assert(!text(h.render()).includes(row.summary.name));assert(!field(h.render(),'Demo exact strategy')&&!field(h.render(),'Inspect evidence '+row.summary.id));let prevented=false;oldLink.props.onClick({preventDefault(){prevented=true;}});assert(prevented);phase=2;h.click('Refresh strategy evidence');await h.until(tree=>!button(tree,'Refresh strategy evidence').props.disabled);assert(!text(h.render()).includes(s.record.content.name));assert(!text(h.render()).includes(row.summary.name));
});

test('parent-hidden evidence remains metadata only while its exact source stays visible',async()=>{const s=await source(),row=entry(s,{name:'Private parent-dependent body',state:'HIDDEN',suppression:'PARENT_UNAVAILABLE'});server(()=>page(s,[row]));const h=harness({signedIn:false,selection:ref(s)});await h.until('Source or parent unavailable');assert(text(h.render()).includes(s.record.content.name));assert(!text(h.render()).includes('Private parent-dependent body'));assert(!field(h.render(),'Inspect evidence '+row.summary.id)&&!field(h.render(),'Reviews evidence '+row.summary.id));assert(field(h.render(),'Demo exact strategy'));});

test('selection change fences a deferred old page and preserves the new canonical sign-in target',async()=>{
  const a=await source('Old source must not return'),b=await source('New exact source'),oldRow=entry(a,{name:'Old evidence must not return'});let release;const wait=new Promise(resolve=>release=resolve);server(async path=>{if(path.includes('strategy='+a.id)){await wait;return page(a,[oldRow]);}return page(b);});const h=harness({signedIn:false,selection:ref(a)});await h.flush();h.props.selection=ref(b);await h.until(b.record.content.name);release();await h.flush();assert(!text(h.render()).includes(a.record.content.name)&&!text(h.render()).includes(oldRow.summary.name));assert.equal(field(h.render(),'Exact strategy permalink').props.href,model.strategyEvidenceHref(b));assert(walk(h.render(),n=>n.type==='a'&&n.props.href==='/signin-with-chatgpt?return_to='+encodeURIComponent(model.strategyEvidenceHref(b))).length);
});

test('selection and sign-in changes fence the paint and captured callbacks before effects run',async()=>{
  for(const transition of ['selection','session']){
    const a=await source('Previous context name'),b=await source('Current context name'),row=entry(a,{name:'Previous context evidence'}),requests=server(path=>page(path.includes('strategy='+a.id)?a:b,path.includes('strategy='+a.id)?[row]:[])),h=harness({signedIn:true,selection:ref(a)});await h.until(row.summary.name);const oldLink=field(h.render(),'Inspect evidence '+row.summary.id),oldRefresh=button(h.render(),'Refresh strategy evidence'),count=requests.length;
    if(transition==='selection')h.props.selection=ref(b);else h.props.signedIn=false;
    const firstPaint=h.render();assert(!text(firstPaint).includes(a.record.content.name)&&!text(firstPaint).includes(row.summary.name));let prevented=false;oldLink.props.onClick({preventDefault(){prevented=true;}});assert(prevented);oldRefresh.props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,count);
    if(transition==='selection')await h.until(b.record.content.name);else await h.until('Session changed');
  }
});

test('repeated publication IDs cannot acquire different digests on a later refresh',async()=>{
  const s=await source(),row=entry(s,{name:'Original retained identity'});let changed=false;server(()=>{const value=structuredClone(row);if(changed){value.summary.digest='a'.repeat(64);value.summary.name='Conflicting replacement';}return page(s,[value]);});const h=harness({signedIn:false,selection:ref(s)});await h.until(row.summary.name);changed=true;h.click('Refresh strategy evidence');await h.until('No alternative version or result was substituted.');assert(!text(h.render()).includes('Conflicting replacement'));
});

test('captured outcome links cannot navigate after their row becomes hidden or leaves the accepted page',async()=>{
  for(const transition of ['hidden','page']){
    const s=await source(),row=entry(s,{name:'Initially visible evidence'});let phase=0;server(()=>page(s,phase===0?[row]:transition==='hidden'?[{...row,summary:{...row.summary,state:'HIDDEN',reason:'POLICY',suppression:'PARENT_UNAVAILABLE',name:null,status:null,flags:[]},claim:null,observation:null}]:[]));const h=harness({signedIn:false,selection:ref(s)});await h.until(row.summary.name);const oldLink=field(h.render(),'Inspect evidence '+row.summary.id);phase=1;h.click('Refresh strategy evidence');await h.until(transition==='hidden'?'Source or parent unavailable':'No retained public records');let prevented=false;oldLink.props.onClick({ctrlKey:true,preventDefault(){prevented=true;}});assert(prevented);
  }
});

test('a full retained read cache fails closed without evicting prior suppression floors',async()=>{
  const s=await source(),row=entry(s,{name:'Boundary record'});server(()=>page(s,[row]));const h=harness({signedIn:false,selection:ref(s)});await h.until(row.summary.name);const state=context.refs.find(value=>value.current?.rows instanceof Map).current;state.rows.clear();for(let n=0;n<750;n++)state.rows.set('invented-retained-'+n,{...row,summary:{...row.summary,id:'invented-retained-'+n}});state.suppressed.set('retained-suppression-floor',row);h.click('Refresh strategy evidence');await h.until('No alternative version or result was substituted.');assert.equal(state.rows.size,750);assert.equal(state.suppressed.size,1);assert(state.suppressed.has('retained-suppression-floor'));
});

test('signout and unmount cancel deferred reads and stale navigation callbacks without browser storage',async()=>{
  for(const transition of ['signout','unmount']){
    const s=await source(),row=entry(s),requests=server(()=>page(s,[row])),h=harness({signedIn:true,selection:ref(s)});await h.until(row.summary.name);const oldLink=field(h.render(),'Inspect evidence '+row.summary.id),oldRefresh=button(h.render(),'Refresh strategy evidence');let release;const wait=new Promise(resolve=>release=resolve);globalThis.fetch=async(path,init)=>{requests.push({path,init});await wait;return Response.json(page(s,[row]));};h.click('Refresh strategy evidence');await h.flush();if(transition==='signout'){h.props.signedIn=false;await h.until('Session changed');}else h.unmount();let prevented=false;oldLink.props.onClick({preventDefault(){prevented=true;}});assert(prevented);oldRefresh.props.onClick();const count=requests.length;release();await h.flush();assert.equal(requests.length,count);if(transition==='signout')assert(!text(h.render()).includes(row.summary.name)&&!text(h.render()).includes(s.record.content.name));assert(requests.every(r=>!r.init.method&&!r.init.body));
  }
});

test('server route strictly branches exact links and keeps the existing catalog for an empty query',async()=>{
  const b=await build({entryPoints:['app/strategies/page.tsx'],bundle:true,format:'cjs',platform:'node',write:false,target:'es2022',jsx:'automatic',plugins:[{name:'route-boundary',setup(builder){builder.onResolve({filter:/chatgpt-auth|\/strategies$|strategy-evidence$/},a=>a.importer.endsWith('/app/strategies/page.tsx')?{path:a.path,namespace:'route-stub'}:undefined);builder.onLoad({filter:/.*/,namespace:'route-stub'},a=>({contents:a.path.includes('chatgpt-auth')?'export async function getChatGPTUser(){return globalThis.__evidenceRouteUser??null;}':a.path.endsWith('/strategies')?'export default function Strategies(){return null;}':'export default function StrategyEvidence(){return null;}',loader:'js',resolveDir:fileURLToPath(new URL('../app/',import.meta.url))}));}}]});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const s=await source();
  assert.equal((await m.exports.default()).type.name,'Strategies');assert.equal((await m.exports.default({searchParams:Promise.resolve({})})).type.name,'Strategies');
  const exact=await m.exports.default({searchParams:Promise.resolve(ref(s))});assert.equal(exact.type.name,'StrategyEvidence');assert.deepEqual(exact.props,{signedIn:false,selection:ref(s),selectionError:''});
  for(const query of [{id:s.id,digest:s.digest,other:'ignored?'},{id:[s.id,s.id],digest:s.digest},{id:s.id,digest:''},{digest:s.digest},{id:'malformed'}]){const bad=await m.exports.default({searchParams:Promise.resolve(query)});assert.equal(bad.type.name,'StrategyEvidence');assert.equal(bad.props.selection,null);assert(bad.props.selectionError.includes('Invalid exact strategy link'));}
  globalThis.__evidenceRouteUser={id:'invented-user',privateField:'never forward'};const legacy=await m.exports.default({searchParams:Promise.resolve({id:s.id})});assert.deepEqual(legacy.props,{signedIn:true,selection:{id:s.id,digest:null},selectionError:''});delete globalThis.__evidenceRouteUser;
});
