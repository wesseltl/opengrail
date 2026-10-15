import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Local hook/event tests exercise the actual component and schema. They do not prove browser
// layout, deployed availability or independent validation. Engine calls use the real bounded local engine;
// fault/deferred injection tests only exercise receipt and lifecycle boundaries, never claim reproduction.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch, originalWindow = globalThis.window;
const context = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0};
globalThis.__demoHooks = {
  useState(initial) { const i = context.si++; if (!(i in context.state)) context.state[i] = typeof initial === 'function' ? initial() : initial; return [context.state[i], next => context.state[i] = typeof next === 'function' ? next(context.state[i]) : next]; },
  useRef(initial) { return context.refs[context.ri++] ??= {current: initial}; },
  useEffect(callback, deps) { const i = context.ei++, old = context.deps[i]; if (!old || deps.some((value, n) => value !== old[n])) { context.deps[i] = deps; context.effects.push(() => { context.cleanup[i]?.(); context.cleanup[i] = callback(); }); } },
};
const enginePath=fileURLToPath(new URL('../app/demo-engine.ts',import.meta.url));
const stubs = {react: 'export const {useState,useRef,useEffect}=globalThis.__demoHooks;', './demo-engine': `import {replayDemo as actualReplay,syntheticDemoInput as actualSynthetic} from ${JSON.stringify(enginePath)}; export const replayDemo=(...args)=>globalThis.__demoReplayOverride?globalThis.__demoReplayOverride(...args,actualReplay):actualReplay(...args);export const syntheticDemoInput=(...args)=>globalThis.__demoExampleOverride?globalThis.__demoExampleOverride(...args,actualSynthetic):actualSynthetic(...args);`};
const built = await build({entryPoints: ['app/demo.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'strategy-hooks', setup(builder) {
  builder.onResolve({filter: /.*/}, args => args.importer.endsWith('/app/demo.tsx') && args.path in stubs ? {path: args.path, namespace: 'stub'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'stub'}, args => ({contents: stubs[args.path], loader: 'js', resolveDir: fileURLToPath(new URL('../app/',import.meta.url))}));
}}]});
const module = {exports: {}}; new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
const Demo = module.exports.default;
const bundled = await build({entryPoints: ['app/strategy-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const model = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const engineBundle = await build({entryPoints:['app/demo-engine.ts'],bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const engine = await import('data:text/javascript;base64,'+Buffer.from(engineBundle.outputFiles[0].text).toString('base64'));
const demoBundle = await build({entryPoints:['app/demo-model.ts'],bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const demoModel = await import('data:text/javascript;base64,'+Buffer.from(demoBundle.outputFiles[0].text).toString('base64'));

const originalDocument=globalThis.document,originalCreateUrl=URL.createObjectURL,originalRevokeUrl=URL.revokeObjectURL;
const exports=[], urls=new Map();
URL.createObjectURL=blob=>{const url='blob:synthetic-'+crypto.randomUUID(); urls.set(url,blob); return url;};
URL.revokeObjectURL=url=>urls.delete(url);
globalThis.document={createElement:()=>({click(){exports.push({name:this.download,blob:urls.get(this.href)});}})};
const list=(items,nextCursor=null)=>({version:1,items,nextCursor,executionEnabled:false});
async function item(type='TREND',changes={}) {
  const request=await engine.syntheticDemoInput(), authorId=await model.strategyPublicHumanId('synthetic-public-sponsor'),id=changes.id??crypto.randomUUID();
  const {record,payload}=model.boundedStrategyRecord({...request.strategy.record,id,rootId:id,author:{kind:'HUMAN',id:authorId,sponsorId:authorId},content:{...request.strategy.record.content,name:'Synthetic public '+type+' fixture',definition:model.strategyTemplate(type)},...changes});
  return {id:record.id,digest:await model.strategyDigest(payload),rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:model.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]};
}
function expand(node){return node&&typeof node==='object'&&typeof node.type==='function'&&['TrialCard','EquityChart'].includes(node.type.name)?node.type(node.props):node;}
function walk(node,predicate){const n=expand(node);if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(child=>walk(child,predicate));return [...(predicate(n)?[n]:[]),...walk(n.props?.children,predicate)];}
function text(node){const n=expand(node);return n==null||typeof n==='boolean'?'':Array.isArray(n)?n.map(text).join(' '):typeof n==='object'?text(n.props?.children):String(n);}
const label=node=>text(node).replace(/\s+/g,' ').trim();
const button=(tree,name)=>walk(tree,node=>node.type==='button'&&(node.props['aria-label']===name||label(node)===name))[0];
const field=(tree,name)=>walk(tree,node=>node.props?.['aria-label']===name)[0];
const forwardLink=tree=>walk(tree,node=>node.type==='a'&&label(node)==='Set up forward Demo')[0];
function harness(props={signedIn:false},search=''){
 const listeners=new Map(),win={location:{search},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};globalThis.window=win;
 context.cleanup.forEach(cleanup=>cleanup?.());for(const key of ['state','refs','deps','effects','cleanup'])context[key]=[];exports.length=0;delete globalThis.__demoReplayOverride;delete globalThis.__demoExampleOverride;
 const render=()=>{context.si=context.ri=context.ei=0;return Demo(props);};
 const flush=async()=>{for(let i=0;i<12;i++){render();while(context.effects.length)context.effects.shift()();await new Promise(resolve=>setImmediate(resolve));}return render();};
 const until=async predicate=>{const end=Date.now()+5000;do{const tree=await flush();if(typeof predicate==='function'?predicate(tree):text(tree).includes(predicate))return tree;}while(Date.now()<end);assert.fail('Timed out: '+predicate+' '+text(render()));};
 return {props,render,flush,until,navigate(next){win.location.search=next;listeners.get('popstate')?.();},click(name,subtree){const found=button(subtree??render(),name);assert(found,'missing '+name);assert(!found.props.disabled,name+' disabled');found.props.onClick();},field(name,value){const found=field(render(),name);assert(found,'missing '+name);found.props.onChange({target:{value,checked:value}});},unmount(){context.cleanup.forEach(cleanup=>cleanup?.());},trials(){return walk(render(),node=>node.props?.['aria-label']?.startsWith('Local trial '));}};
}
function server(items=[]){const requests=[],records=new Map(items.map(value=>[value.id,value]));globalThis.fetch=async(path,init={})=>{requests.push({path,init});const url=new URL(path,'https://local');if(url.searchParams.has('id')){const found=records.get(url.searchParams.get('id'));return found?Response.json({version:1,item:found,executionEnabled:false}):new Response(null,{status:404});}return Response.json(list([...records.values()]));};return {requests,records};}
async function offline(h){await h.until('No visible public definitions');h.click('Use synthetic offline example');await h.until('Synthetic inputs prepared');}
async function run(h){h.field('Confirm input rights and provenance',true);await h.flush();h.click('Run local replay');await h.until(tree=>h.trials().length&& !text(tree).includes('Running local replay…'));}
async function exported(h,name,tree){const before=exports.length;h.click(name,tree);await h.until(()=>exports.length===before+1&&button(h.render(),name)?.props.disabled!==true);return exports.at(-1);}
async function imported(h,request){h.field('Replay request JSON',JSON.stringify(request));await h.flush();}
after(()=>{context.cleanup.forEach(cleanup=>cleanup?.());globalThis.fetch=originalFetch;globalThis.window=originalWindow;globalThis.document=originalDocument;URL.createObjectURL=originalCreateUrl;URL.revokeObjectURL=originalRevokeUrl;delete globalThis.__demoHooks;delete globalThis.__demoReplayOverride;delete globalThis.__demoExampleOverride;});

test('anonymous opening fetches only the bounded public catalog and displays no invented results or identity',async()=>{
 const value=await item(),{requests}=server([value]),h=harness();await h.until(value.record.content.name);
 assert.deepEqual(requests.map(request=>request.path),['/api/strategies']);assert.equal(h.trials().length,0);assert.equal(walk(h.render(),node=>node.type==='svg'&&node.props.role==='img').length,0);
 assert(text(h.render()).includes('UNTESTED'));assert(text(h.render()).includes('No local results yet'));assert(button(h.render(),'Run local replay').props.disabled);
 assert(!requests.some(request=>request.init.method==='POST'||/\/me|account|performance|connection|signal/.test(request.path)));
});

test('an explicitly synthetic offline replay produces verified real-engine metrics, equity and a reproducible export',async()=>{
 const {requests}=server(),h=harness();await offline(h);const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);
 assert(text(h.render()).includes('Synthetic fixture · not a public strategy or registered author'));assert(button(h.render(),'Run local replay').props.disabled);
 await run(h);const tree=h.render();assert.equal(h.trials().length,1);assert(text(tree).includes('AUTHOR_REPORTED'));assert(text(tree).includes('SIMULATED'));assert(text(tree).includes('SYNTHETIC'));
 assert(text(tree).includes('USDT'));assert(text(tree).includes('Realized fees'));assert(text(tree).includes('Slippage')||text(tree).includes('slippage'));
 assert.equal(forwardLink(tree),undefined);
 const charts=walk(tree,node=>node.type==='svg'&&node.props.role==='img');assert.equal(charts.length,1);assert.equal(charts[0].props['aria-label'],'Actual simulated account equity by supplied closed bar');
 const polyline=walk(charts[0],node=>node.type==='polyline')[0];assert(!/NaN|Infinity/.test(polyline.props.points));assert(polyline.props.points.length>0);
 await exported(h,'Export reproducible artifact',h.trials()[0]);assert.equal(exports.length,1);const artifact=await demoModel.verifyDemoArtifact(JSON.parse(await exports[0].blob.text()));
 assert.deepEqual(artifact.input,input);assert.deepEqual(artifact,await engine.replayDemo(input));assert.equal(artifact.ordersEnabled,false);assert.equal(urls.size,0);assert.deepEqual(requests.map(request=>request.path),['/api/strategies']);
});

test('public replay binds the exact digest-checked record and never reuses synthetic fixture authorship',async()=>{
 const value=await item('DCA'),{requests}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');
 const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);assert.equal(input.strategy.digest,value.digest);assert.deepEqual(input.strategy.record,value.record);
 await run(h);await exported(h,'Export reproducible artifact',h.trials()[0]);const artifact=await demoModel.verifyDemoArtifact(JSON.parse(await exports[0].blob.text()));assert.deepEqual(artifact.input.strategy.record,value.record);
 assert.equal(forwardLink(h.trials()[0]).props.href,'/session?strategy='+value.id+'&digest='+value.digest);
 assert(text(h.render()).includes('Public strategy snapshot captured locally'));assert.deepEqual(requests.map(request=>request.path),['/api/strategies',...Array(5).fill('/api/strategies?id='+value.id)]);
});

test('exact inputs can be exported before evaluation without an upload or a fabricated trial',async()=>{
 const value=await item('RULES'),{requests}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');
 const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);await exported(h,'Export replay input');assert.equal(exports.length,1);assert.deepEqual(JSON.parse(await exports[0].blob.text()),input);assert.equal(h.trials().length,0);assert.equal(urls.size,0);assert.deepEqual(requests.map(row=>row.path),['/api/strategies',...Array(3).fill('/api/strategies?id='+value.id)]);
 assert(walk(h.render(),node=>node.type==='a'&&node.props.href==='/experiments').length>0);
 await imported(h,{...input,initialCapital:0});h.click('Export replay input');await h.until('Input export failed');assert.equal(exports.length,1);
});

test('self-hashed foreign author or record imports cannot impersonate the selected public definition',async()=>{
 const value=await item(),{requests}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');
 const input=JSON.parse(field(h.render(),'Replay request JSON').props.value),foreignId=await model.strategyPublicHumanId('foreign-synthetic-principal');input.strategy.record.author={kind:'HUMAN',id:foreignId,sponsorId:foreignId};input.strategy.digest=await model.strategyDigest(model.boundedStrategyRecord(input.strategy.record).payload);
 await imported(h,input);let called=false;globalThis.__demoReplayOverride=()=>{called=true;throw Error('must not run');};await run(h);
 assert(!called);assert(text(h.render()).includes('INPUT REJECTED'));assert(!text(h.render()).includes(foreignId));assert.equal(h.trials().length,1);assert.deepEqual(requests.map(request=>request.path),['/api/strategies',...Array(2).fill('/api/strategies?id='+value.id)]);
});

test('invalid and duplicate JSON attempts remain in full session history without executing rules or exporting raw rejected text',async()=>{
 server();const h=harness();await offline(h);const valid=field(h.render(),'Replay request JSON').props.value;let called=false;globalThis.__demoReplayOverride=()=>{called=true;throw Error('must not run');};
 for(const json of ['{"private":"discard this rejected text"}',valid.replace('{\n  "version": 1,','{\n  "version": 1,"version":1,'),' '.repeat(demoModel.demoLimits.requestBytes+1)]){h.field('Replay request JSON',json);await h.flush();await run(h);}
 assert(!called);assert.equal(h.trials().length,3);assert(h.trials().every(trial=>text(trial).includes('INPUT REJECTED')));await exported(h,'Export complete session');const session=JSON.parse(await exports[0].blob.text());
 assert.equal(session.source,'LOCAL_SESSION_UNQUALIFIED');assert.equal(session.executionEnabled,false);assert.equal(session.trials.length,3);assert(session.trials.every(trial=>trial.artifact===null&&trial.input===null));assert(!JSON.stringify(session).includes('discard this rejected text'));
});

test('data rights, executable fields, bad temporal bars and excess signals are strict input rejections',async()=>{
 server();const h=harness();await offline(h);const original=JSON.parse(field(h.render(),'Replay request JSON').props.value);
 const invalid=[{...original,code:'fetch("https://example.com")'}, {...original,dataset:{...original.dataset,provenance:'USER_SUPPLIED'}}, {...original,dataset:{...original.dataset,bars:[...original.dataset.bars].reverse()}}, {...original,signals:Array.from({length:501},()=>original.signals[0]??{id:crypto.randomUUID(),provider:'CUSTOM',event:'BULLISH',observedAt:original.dataset.bars[0].closedAt,availableAt:original.dataset.bars[0].closedAt})}];
 let calls=0;globalThis.__demoReplayOverride=()=>{calls++;throw Error('must not run');};for(const input of invalid){await imported(h,input);await run(h);}assert.equal(calls,0);assert.equal(h.trials().length,4);assert(h.trials().every(trial=>text(trial).includes('INPUT REJECTED')));
});

test('a no-trade local replay retains a valid zero outcome and its decision audit rather than inventing performance',async()=>{
 server();const h=harness();await offline(h);const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);input.dataset.bars=input.dataset.bars.map(bar=>({...bar,open:100,high:100,low:100,close:100,volume:0}));input.signals=[];
 await imported(h,input);await run(h);assert(text(h.render()).includes('NO TRADES'));assert(text(h.render()).includes('No trades occurred under these exact inputs and rules'));
 await exported(h,'Export reproducible artifact',h.trials()[0]);const artifact=await demoModel.verifyDemoArtifact(JSON.parse(await exports[0].blob.text()));assert.equal(artifact.trades.length,0);assert.equal(artifact.metrics.returnPct,0);assert(artifact.audit.length>0);
});

test('negative stop-loss and emergency-stop results remain alongside rejected attempts in the complete trial history',async()=>{
 const value=await item('DCA');server([value]);const h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');
 const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);input.dataset.bars=input.dataset.bars.map(bar=>({...bar,open:100,high:100,low:50,close:100,volume:0}));input.signals=[];await imported(h,input);await run(h);
 await exported(h,'Export reproducible artifact',h.trials()[0]);const loss=await demoModel.verifyDemoArtifact(JSON.parse(await exports[0].blob.text()));assert(loss.metrics.netPnl<0);assert(loss.trades.some(trade=>trade.reason==='STOP_LOSS'));assert(text(h.trials()[0]).includes('STOP_LOSS'));
 assert(forwardLink(h.trials()[0]),'losing public trials retain the same next step');
 const stopped={...input,emergencyStopAt:input.dataset.bars[0].closedAt};await imported(h,stopped);await run(h);h.field('Replay request JSON','invalid');await h.flush();await run(h);
 assert.equal(h.trials().length,3);assert(text(h.render()).includes('EMERGENCY_STOP'));assert(text(h.render()).includes('INPUT REJECTED'));await exported(h,'Export complete session');const session=JSON.parse(await exports.at(-1).blob.text());assert.equal(session.trials.length,3);assert(session.trials[0].artifact.metrics.netPnl<0);assert.equal(session.trials[1].artifact.status,'HALTED');assert.equal(session.trials[2].status,'INPUT_REJECTED');
});

test('short and insolvent replay results do not advertise a comparable benchmark or clip losses',async()=>{
 const template=model.strategyTemplate('DCA');template.market.direction='SHORT';const seed=await item('DCA');const {record,payload}=model.boundedStrategyRecord({...seed.record,content:{...seed.record.content,definition:template}});const value={...seed,record,digest:await model.strategyDigest(payload)};
 server([value]);const h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');
 const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);input.dataset.bars=input.dataset.bars.map((bar,index)=>({...bar,open:index<2?100:1e8,high:index<2?100:1e8,low:index<2?100:1e8,close:index<2?100:1e8,volume:0}));input.signals=[];await imported(h,input);await run(h);
 assert(text(h.render()).includes('FAILED'));assert(text(h.render()).includes('losses have not been clipped'));assert(text(h.render()).includes('Baseline not comparable'));await exported(h,'Export reproducible artifact',h.trials()[0]);const artifact=await demoModel.verifyDemoArtifact(JSON.parse(await exports[0].blob.text()));assert(artifact.metrics.finalEquity<0);assert.equal(artifact.metrics.comparable,false);assert.equal(artifact.benchmark.comparable,false);
});

test('invalid artifact hashes and mismatched exact input cannot become confirmed metrics',async()=>{
 for(const fault of ['digest','input']){server();const h=harness();await offline(h);globalThis.__demoReplayOverride=async(input,actual)=>{const artifact=await actual(input);if(fault==='digest')return {...artifact,resultDigest:'a'.repeat(64)};const changed=structuredClone(input);changed.initialCapital+=1;return actual(changed);};await run(h);assert(text(h.render()).includes('OUTPUT UNCONFIRMED'));assert.equal(button(h.render(),'Export reproducible artifact'),undefined);assert.equal(walk(h.render(),node=>node.type==='svg'&&node.props.role==='img').length,0);await exported(h,'Export complete session');const session=JSON.parse(await exports[0].blob.text());assert(session.trials[0].input);assert.equal(session.trials[0].artifact,null);}
});

test('input mutation by a delayed engine boundary cannot change the immutable captured request',async()=>{
 server();const h=harness();await offline(h);const original=JSON.parse(field(h.render(),'Replay request JSON').props.value);globalThis.__demoReplayOverride=async(input,actual)=>{input.initialCapital+=1;return actual(input);};await run(h);assert(text(h.render()).includes('OUTPUT UNCONFIRMED'));await exported(h,'Export complete session');const session=JSON.parse(await exports[0].blob.text());assert.equal(session.trials[0].input.initialCapital,original.initialCapital);
});

test('double clicks serialize one local attempt and stale input/rights callbacks cannot certify a changed draft',async()=>{
 server();const h=harness();await offline(h);const staleRights=field(h.render(),'Confirm input rights and provenance').props.onChange,staleRun=button(h.render(),'Run local replay').props.onClick;
 const input=JSON.parse(field(h.render(),'Replay request JSON').props.value);input.hypothesis='A newly edited hypothesis.';await imported(h,input);staleRights({target:{checked:true}});await h.flush();assert.equal(field(h.render(),'Confirm input rights and provenance').props.checked,false);staleRun();await h.flush();assert.equal(h.trials().length,0);
 h.field('Confirm input rights and provenance',true);await h.flush();const active=button(h.render(),'Run local replay').props.onClick;active();active();await h.until(tree=>h.trials().length&&!text(tree).includes('Running local replay…'));assert.equal(h.trials().length,1);
});

test('forward setup carries only the exact public reference and fences busy, stale and suppressed trial links',async()=>{
 const value=await item('DCA'),{requests,records}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');await run(h);
 const original=forwardLink(h.trials()[0]),url=new URL(original.props.href,'https://local');
 assert.equal(url.pathname,'/session');assert.deepEqual([...url.searchParams.keys()],['strategy','digest']);assert.equal(url.searchParams.get('strategy'),value.id);assert.equal(url.searchParams.get('digest'),value.digest);
 assert(text(h.trials()[0]).includes('Export your replay before leaving'));
 let prevented=0;const click=link=>link.props.onClick({preventDefault(){prevented++;}}),before=requests.length;click(original);assert.equal(prevented,0);assert.equal(requests.length,before);assert.equal(h.trials().length,1);
 let release;globalThis.__demoReplayOverride=(input,actual)=>new Promise(resolve=>release=async()=>resolve(await actual(input)));h.field('Confirm input rights and provenance',true);await h.flush();h.click('Run local replay');await h.until(()=>typeof release==='function');
 const busyLink=forwardLink(h.trials()[0]);assert.equal(busyLink.props['aria-disabled'],true);assert.equal(busyLink.props.tabIndex,-1);click(original);assert.equal(prevented,1);click(busyLink);assert.equal(prevented,2);
 h.click('Cancel local work');await h.flush();await release();await h.flush();click(original);assert.equal(prevented,3);const current=forwardLink(h.trials()[0]);assert.equal(current.props['aria-disabled'],false);click(current);assert.equal(prevented,3);
 records.set(value.id,suppressed(value));h.click('Refresh demo catalog');await h.until(()=>!forwardLink(h.render())&&text(h.render()).includes('CLEARED'));click(current);assert.equal(prevented,4);assert(h.trials().length===2&&h.trials().every(trial=>!forwardLink(trial)));
 h.unmount();click(current);assert.equal(prevented,5);assert(requests.every(request=>request.path.startsWith('/api/strategies')&&!request.init.method));assert.equal(exports.length,0);
});

test('catalog refresh cancels a pending replay, clears its selection and prevents late output confirmation',async()=>{
 server();const h=harness();await offline(h);let release;globalThis.__demoReplayOverride=(input,actual)=>new Promise(resolve=>release=async()=>resolve(await actual(input)));h.field('Confirm input rights and provenance',true);await h.flush();h.click('Run local replay');await h.until(()=>typeof release==='function');assert(text(h.render()).includes('Running local replay…'));assert.equal(h.trials().length,1);h.click('Refresh demo catalog');await h.until('No visible public definitions');assert.equal(field(h.render(),'Replay request JSON').props.value,'');assert(text(h.render()).includes('INTERRUPTED'));await release();await h.flush();assert.equal(button(h.render(),'Export reproducible artifact'),undefined);assert(text(h.render()).includes('INTERRUPTED'));
});

test('cancelled attempts are retained and late result callbacks cannot replace their interruption state',async()=>{
 server();const h=harness();await offline(h);let release;globalThis.__demoReplayOverride=(input,actual)=>new Promise(resolve=>release=async()=>resolve(await actual(input)));h.field('Confirm input rights and provenance',true);await h.flush();h.click('Run local replay');await h.until(()=>typeof release==='function');assert(text(h.render()).includes('Running local replay…'));assert.equal(h.trials().length,1);h.click('Cancel local work');await h.flush();await release();await h.flush();assert.equal(h.trials().length,1);assert(text(h.render()).includes('INTERRUPTED'));assert.equal(button(h.render(),'Export reproducible artifact'),undefined);
});

test('local imports enforce byte/UTF-8 bounds, never upload, and reset rights instead of automatically replaying',async()=>{
 const {requests}=server(),h=harness();await offline(h);h.field('Confirm input rights and provenance',true);await h.flush();const original=JSON.parse(field(h.render(),'Replay request JSON').props.value);original.hypothesis='Imported local hypothesis';const bytes=new TextEncoder().encode(JSON.stringify(original));
 for(const file of [{size:demoModel.demoLimits.requestBytes+1,arrayBuffer:async()=>{throw Error('must not read');}},{size:2,arrayBuffer:async()=>new Uint8Array([255,254]).buffer}]){field(h.render(),'Import replay JSON').props.onChange({target:{files:[file],value:'local.json'}});await h.until('Import failed');}
 field(h.render(),'Import replay JSON').props.onChange({target:{files:[{size:bytes.length,arrayBuffer:async()=>bytes.buffer}],value:'local.json'}});await h.until('File read locally');assert.equal(field(h.render(),'Confirm input rights and provenance').props.checked,false);assert.equal(h.trials().length,0);assert.equal(JSON.parse(field(h.render(),'Replay request JSON').props.value).hypothesis,original.hypothesis);assert.deepEqual(requests.map(request=>request.path),['/api/strategies']);
});

test('a late file read or synthetic preparation cannot overwrite a refreshed selection',async()=>{
 for(const work of ['file','example']){server();const h=harness();await offline(h);let release;if(work==='file')field(h.render(),'Import replay JSON').props.onChange({target:{files:[{size:12,arrayBuffer:()=>new Promise(resolve=>release=()=>resolve(new TextEncoder().encode('late private draft').buffer))}],value:'private.json'}});else{globalThis.__demoExampleOverride=(...args)=>{const actual=args.pop();return new Promise(resolve=>release=async()=>resolve(await actual(...args)));};h.click('Load synthetic inputs');}await h.until(work==='file'?'Reading replay file':'Preparing synthetic inputs');h.click('Refresh demo catalog');await h.until('No visible public definitions');await release();await h.flush();assert.equal(field(h.render(),'Replay request JSON').props.value,'');assert.equal(h.trials().length,0);assert(!text(h.render()).includes('late private draft'));}
});

test('unmount clears retained input references and makes late engine completion inert',async()=>{
 server();const h=harness();await offline(h);let release;globalThis.__demoReplayOverride=(input,actual)=>new Promise(resolve=>release=async()=>resolve(await actual(input)));h.field('Confirm input rights and provenance',true);await h.flush();h.click('Run local replay');await h.until(()=>typeof release==='function');assert(text(h.render()).includes('Running local replay…'));assert.equal(h.trials().length,1);const current=context.refs.find(ref=>ref.current?.trials);assert(current.current.json);h.unmount();assert.equal(current.current.json,'');assert.deepEqual(current.current.trials,[]);await release();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(current.current.trials,[]);
});

test('capacity blocks new attempts without deleting failed trial history and exported history contains all 32',async()=>{
 server();const h=harness();await offline(h);h.field('Replay request JSON','invalid');await h.flush();for(let index=0;index<32;index++)await run(h);assert.equal(h.trials().length,32);assert(button(h.render(),'Run local replay').props.disabled);assert(text(h.render()).includes('prior trials are never dropped'));await exported(h,'Export complete session');const session=JSON.parse(await exports[0].blob.text());assert.equal(session.trials.length,32);assert(session.trials.every(trial=>trial.status==='INPUT_REJECTED'));
});

test('corrupt, oversized, duplicate and forged catalogs reject without constructing public strategy authority',async()=>{
 const value=await item(),valid=JSON.stringify(list([value]));for(const body of [valid.replace('{"version":1,','{"version":1,"version":1,'),' '.repeat(2_097_153),JSON.stringify(list([{...value,digest:'a'.repeat(64)}])),JSON.stringify({...list([value]),executionEnabled:true})]){globalThis.fetch=async()=>new Response(body);const h=harness();await h.until('Public catalog unavailable');assert.equal(button(h.render(),'Select strategy '+value.id),undefined);assert(!text(h.render()).includes(value.record.content.name));assert.equal(h.trials().length,0);}
});

test('pagination clears old selection, forbids captured stale selections and keeps completed session history',async()=>{
 const first=await item(),next=await item('DCA'),cursor=crypto.randomUUID(),requests=[];globalThis.fetch=async path=>{requests.push(path);return Response.json(path.includes('?id=')?{version:1,item:path.includes(first.id)?first:next,executionEnabled:false}:path.includes('?cursor=')?list([next]):list([first],cursor));};const h=harness();await h.until(first.record.content.name);const stale=button(h.render(),'Select strategy '+first.id);h.click('Select strategy '+first.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');await run(h);h.click('Next definitions');await h.until(next.record.content.name);stale.props.onClick();await h.flush();assert.equal(field(h.render(),'Replay request JSON').props.value,'');assert.equal(h.trials().length,1);assert(requests.includes('/api/strategies?cursor='+cursor));
});

test('hostile authored text remains text and source URLs/provider assumptions trigger no network access',async()=>{
 const original=await item(),hostile='<img src=x onerror=alert(1)><script>alert(2)</script>';const {record,payload}=model.boundedStrategyRecord({...original.record,content:{...original.record.content,name:hostile,sources:[{url:'https://example.com/never-fetch',classification:'AUTHOR_CLAIM',note:hostile}]}});const value={...original,record,digest:await model.strategyDigest(payload)},{requests}=server([value]),h=harness();await h.until(hostile);assert.equal(walk(h.render(),node=>node.type==='img'||node.type==='script'||node.props?.dangerouslySetInnerHTML).length,0);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');await run(h);assert.deepEqual(requests.map(request=>request.path),['/api/strategies',...Array(4).fill('/api/strategies?id='+value.id)]);
});

test('Demo source adds no persistent drafts, private writes, executable submitted code or account identity dependency',async()=>{
 const source=await readFile('app/demo.tsx','utf8');assert(!/localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML|eval\(|console\.(?:log|warn|error)|method:\s*['"]POST['"]/.test(source));assert(!source.includes('/api/strategies/me'));assert(!source.includes('getChatGPTUser'));const page=await readFile('app/demo/page.tsx','utf8');assert(page.includes('getChatGPTUser'));assert(page.includes('<Demo signedIn={!!user}/>'));assert(!page.includes('redirect('));
});

const handoff=source=>'?strategy='+source.id+'&digest='+source.digest;
function suppressed(source){return {...source,state:'HIDDEN',record:null,reason:'POLICY',moderation:[{sequence:1,requestId:crypto.randomUUID(),createdAt:'2026-10-11T09:00:00.000Z',actor:source.author,state:'HIDDEN',reason:'POLICY'}]};}

test('exact links load all seven older definitions directly without first-page lookup, inputs, permission or evaluation',async()=>{
 for(const type of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']){const value=await item(type),{requests}=server([value]),h=harness({signedIn:false},handoff(value));let calls=0;globalThis.__demoExampleOverride=globalThis.__demoReplayOverride=()=>{calls++;throw Error('no automatic compute');};await h.until('Linked exact strategy selected');assert.deepEqual(requests.map(r=>r.path),['/api/strategies?id='+value.id]);assert(text(h.render()).includes(value.digest));assert.equal(field(h.render(),'Replay request JSON').props.value,'');assert.equal(field(h.render(),'Confirm input rights and provenance').props.checked,false);assert.equal(h.trials().length,0);assert.equal(exports.length,0);assert.equal(calls,0);assert(button(h.render(),'Run local replay').props.disabled);}
});

test('malformed links and exact-source metadata/content/tombstone mismatches fail without latest or synthetic fallback',async()=>{
 const value=await item();for(const search of ['?strategy='+value.id,'?strategy='+value.id+'&digest='+value.digest+'&digest='+value.digest,handoff(value)+'&url=https%3A%2F%2Fexample.com','?token=og_agent_secret','?'+ 'x'.repeat(513)]){const {requests}=server([value]),h=harness({},search);await h.until('Exact strategy link rejected');assert.equal(requests.length,0);assert.equal(field(h.render(),'Replay request JSON').props.value,'');assert(!text(h.render()).includes(value.record.content.name));}
 const changed=structuredClone(value);changed.record.content.name='Rehashed changed authored body';changed.digest=await model.strategyDigest(model.boundedStrategyRecord(changed.record).payload);
 for(const returned of [suppressed(value),{...value,id:crypto.randomUUID()},changed,{...value,record:{...value.record,content:{...value.record.content,name:'Forged unbound content'}}}]){const requests=[];globalThis.fetch=async path=>{requests.push(path);return Response.json({version:1,item:returned,executionEnabled:false});};const h=harness({},handoff(value));await h.until('Exact strategy link rejected');assert.deepEqual(requests,['/api/strategies?id='+value.id]);assert(!text(h.render()).includes('Linked exact strategy selected'));assert.equal(field(h.render(),'Replay request JSON').props.value,'');assert.equal(h.trials().length,0);}
});

test('delayed linked source bodies cannot restore a previous URL, logged-out state or unmounted page',async()=>{
 const first=await item(),next=await item('DCA');for(const action of ['navigate','logout','unmount']){let release;globalThis.fetch=async path=>path.includes(first.id)?new Promise(resolve=>release=()=>resolve(Response.json({version:1,item:first,executionEnabled:false}))):Response.json({version:1,item:next,executionEnabled:false});const h=harness({signedIn:true},handoff(first));await h.until(()=>typeof release==='function');const retained=context.refs.find(r=>r.current?.trials);if(action==='navigate'){h.navigate(handoff(next));await h.until('Linked exact strategy selected');assert(text(h.render()).includes(next.record.content.name));}else if(action==='logout'){h.props.signedIn=false;await h.flush();}else h.unmount();release();await h.flush();assert.notEqual(retained.current.selection?.record.id,first.id);assert.equal(retained.current.json,'');assert.equal(retained.current.rights,false);assert.equal(exports.length,0);assert(!text(h.render()).includes(first.record.content.name));}
});

test('known source hiding before replay redacts prior public artifacts and stale exports without losing adverse disposition metadata',async()=>{
 const value=await item('DCA'),{records}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');await run(h);const held=context.refs.find(r=>r.current?.trials),prior=held.current.trials[0].artifact.status,staleExport=button(h.trials()[0],'Export reproducible artifact').props.onClick;records.set(value.id,suppressed(value));let calls=0;globalThis.__demoReplayOverride=()=>{calls++;throw Error('must not evaluate unavailable rules');};await run(h);assert.equal(calls,0);assert(held.current.trials.every(v=>v.input===null&&v.artifact===null&&v.status==='CLEARED'));assert.equal(held.current.trials[0].priorStatus,prior);assert.equal(field(h.render(),'Replay request JSON').props.value,'');staleExport();await h.flush();assert.equal(exports.length,0);await exported(h,'Export complete session');const history=JSON.parse(await exports.at(-1).blob.text());assert.equal(history.trials[0].priorStatus,prior);assert(!JSON.stringify(history).includes(value.record.content.name));
});

test('post-computation suppression retains the actual terminal disposition but clears every public body',async()=>{
 const value=await item('DCA'),{records}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');let status;globalThis.__demoReplayOverride=async(input,actual)=>{const output=await actual(input);status=output.status;records.set(value.id,suppressed(value));return output;};await run(h);const trial=context.refs.find(r=>r.current?.trials).current.trials[0];assert.equal(trial.status,'CLEARED');assert.equal(trial.priorStatus,status);assert.equal(trial.artifact,null);assert.equal(trial.input,null);assert(label(h.render()).includes('Previous disposition: '+status));assert.equal(walk(h.render(),n=>n.type==='svg'&&n.props.role==='img').length,0);
});

test('transient final-source failure preserves computed evidence unconfirmed and fresh export restores the real result',async()=>{
 const value=await item('DCA'),{requests}=server([value]),ordinary=globalThis.fetch,h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');let reads=0;globalThis.fetch=async(path,init)=>path.includes('?id=')&&++reads===2?new Response(null,{status:503}):ordinary(path,init);await run(h);const held=context.refs.find(r=>r.current?.trials),trial=held.current.trials[0];assert.equal(trial.status,'OUTPUT_UNCONFIRMED');assert(trial.artifact&&trial.input);assert.equal(trial.sourceConfirmed,false);assert.equal(forwardLink(h.render()),undefined);assert(!text(h.render()).includes('Current public source unavailable'));assert.equal(walk(h.render(),n=>n.type==='svg'&&n.props.role==='img').length,0);globalThis.fetch=ordinary;await exported(h,'Export reproducible artifact',h.trials()[0]);const actual=await demoModel.verifyDemoArtifact(JSON.parse(await exports.at(-1).blob.text()));assert.deepEqual(actual,trial.artifact);assert.equal(held.current.trials[0].status,actual.status);assert.equal(held.current.trials[0].sourceConfirmed,true);assert(forwardLink(h.trials()[0]));assert(requests.every(r=>r.path.startsWith('/api/strategies')&&!r.init.method));
});

test('cancelling final source confirmation preserves completed evidence rather than rewriting it as an unexecuted interruption',async()=>{
 const value=await item('DCA');server([value]);const ordinary=globalThis.fetch,h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');let reads=0,release;globalThis.fetch=async(path,init)=>path.includes('?id=')&&++reads===2?new Promise(resolve=>release=()=>resolve(Response.json({version:1,item:value,executionEnabled:false}))):ordinary(path,init);h.field('Confirm input rights and provenance',true);await h.flush();h.click('Run local replay');await h.until(()=>typeof release==='function');const held=context.refs.find(r=>r.current?.trials),artifact=held.current.trials[0].artifact;assert(artifact);h.click('Cancel local work');await h.flush();release();await h.flush();assert.equal(held.current.trials[0].status,'OUTPUT_UNCONFIRMED');assert.equal(held.current.trials[0].priorStatus,artifact.status);assert.deepEqual(held.current.trials[0].artifact,artifact);assert.equal(held.current.trials[0].sourceConfirmed,false);globalThis.fetch=ordinary;await exported(h,'Export reproducible artifact',h.trials()[0]);assert.equal(held.current.trials[0].status,artifact.status);
});

test('catalog tombstones redact retained bodies and stale source exports remain fenced after refresh',async()=>{
 const value=await item('DCA'),{records}=server([value]),h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');await run(h);const old=button(h.trials()[0],'Export reproducible artifact').props.onClick;records.set(value.id,suppressed(value));h.click('Refresh demo catalog');await h.until(tree=>!text(tree).includes(value.record.content.name));old();await h.flush();assert.equal(exports.length,0);const trial=context.refs.find(r=>r.current?.trials).current.trials[0];assert.equal(trial.artifact,null);assert.equal(trial.input,null);assert.equal(trial.status,'CLEARED');assert(trial.priorStatus);await exported(h,'Export complete session');assert.equal(JSON.parse(await exports.at(-1).blob.text()).trials[0].input,null);
});

test('a wrong-digest catalog tombstone cannot erase retained exact-source adverse evidence',async()=>{
 const value=await item('DCA');server([value]);const ordinary=globalThis.fetch,h=harness();await h.until(value.record.content.name);h.click('Select strategy '+value.id);await h.flush();h.click('Load synthetic inputs');await h.until('Synthetic inputs prepared');await run(h);const held=context.refs.find(r=>r.current?.trials),before=structuredClone(held.current.trials[0]);globalThis.fetch=async(path,init)=>path==='/api/strategies'?Response.json(list([{...suppressed(value),digest:'a'.repeat(64)}])):ordinary(path,init);h.click('Refresh demo catalog');await h.until('Public catalog unavailable');assert.deepEqual(held.current.trials[0],before);assert(!text(h.render()).includes('Current public source unavailable'));globalThis.fetch=ordinary;await exported(h,'Export reproducible artifact',h.trials()[0]);assert.deepEqual(JSON.parse(await exports.at(-1).blob.text()),before.artifact);
});
