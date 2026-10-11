import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Local hook/event tests exercise the actual component and schema. They do not prove browser
// layout, hosted Sites authentication, moderation operations or independently verified outcomes.
const require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const context = {state: [], refs: [], deps: [], effects: [], cleanup: [], si: 0, ri: 0, ei: 0};
globalThis.__strategyHooks = {
  useState(initial) { const i = context.si++; if (!(i in context.state)) context.state[i] = typeof initial === 'function' ? initial() : initial; return [context.state[i], next => context.state[i] = typeof next === 'function' ? next(context.state[i]) : next]; },
  useRef(initial) { return context.refs[context.ri++] ??= {current: initial}; },
  useEffect(callback, deps) { const i = context.ei++, old = context.deps[i]; if (!old || deps.some((value, n) => value !== old[n])) { context.deps[i] = deps; context.effects.push(() => { context.cleanup[i]?.(); context.cleanup[i] = callback(); }); } },
};
const stubs = {react: 'export const {useState,useRef,useEffect}=globalThis.__strategyHooks;', '@/components/ui/dialog': 'export const Dialog=()=>null,DialogContent=()=>null,DialogHeader=()=>null,DialogTitle=()=>null,DialogDescription=()=>null;'};
const built = await build({entryPoints: ['app/strategies.tsx'], bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2022', jsx: 'automatic', loader: {'.css': 'empty'}, plugins: [{name: 'strategy-hooks', setup(builder) {
  builder.onResolve({filter: /.*/}, args => args.importer.endsWith('/app/strategies.tsx') && args.path in stubs ? {path: args.path, namespace: 'stub'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'stub'}, args => ({contents: stubs[args.path], loader: 'js'}));
}}]});
const module = {exports: {}}; new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
const Strategy = module.exports.default;
const bundled = await build({entryPoints: ['app/strategy-model.ts'], bundle: true, format: 'esm', platform: 'node', write: false, target: 'es2022'});
const model = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const authorId = await model.strategyPublicHumanId('synthetic-sponsor'), otherId = await model.strategyPublicHumanId('another-sponsor');
const me = {version: 1, authorId, sponsorId: authorId, moderator: false, executionEnabled: false};
const T = new Date().toISOString();
const content = {name: 'Test an after-cost definition', description: 'Measure the proposed rules on independent observations.', definition: model.strategyTemplate('TREND'), assumptions: 'Costs and missing observations must be disclosed.', falsification: 'Reject when the independent result does not survive costs.', sources: [{url: 'https://example.com/strategy', classification: 'PRIMARY', note: 'An author-classified reference.'}], relation: null};
async function item(changes = {}, contentChanges = {}) {
  const id = changes.id ?? crypto.randomUUID(), author = changes.author ?? {kind: 'HUMAN', id: authorId, sponsorId: authorId};
  const {record, payload} = model.boundedStrategyRecord({version: 1, id, rootId: id, revision: 1, requestId: crypto.randomUUID(), createdAt: T, author, content: {...content, ...contentChanges}, policyAccepted: 'public-strategy-v1', verification: 'UNTESTED', executionEnabled: false, ...changes});
  return {id: record.id, digest: await model.strategyDigest(payload), rootId: record.rootId, revision: record.revision, requestId: record.requestId, createdAt: record.createdAt, author: model.strategyAuthorReference(record.author), state: 'VISIBLE', reason: null, record, moderation: []};
}
function tombstone(value, state = 'WITHDRAWN', command = {}) {
  const reason = command.reason ?? (state === 'WITHDRAWN' ? 'AUTHOR_REQUEST' : 'POLICY');
  return {...value, state, reason, record: null, moderation: [...value.moderation, {sequence: value.moderation.length + 1, requestId: command.requestId ?? crypto.randomUUID(), createdAt: T, actor: {kind: 'HUMAN', id: authorId, sponsorId: authorId}, state, reason}]};
}
const list = (items, nextCursor = null) => ({version: 1, items, nextCursor, executionEnabled: false});
const receipt = (command, value, report = null) => ({version: 1, action: command.action, requestId: command.requestId, item: value, report, executionEnabled: false});
async function publication(command, parent = null, changes = {}, contentChanges = {}) {
  const revision = command.relation?.type === 'REVISION';
  return item({id: command.id, requestId: command.requestId, rootId: revision ? parent.rootId : command.id, revision: revision ? parent.revision + 1 : 1, ...changes}, {name: command.name, description: command.description, definition: command.definition, assumptions: command.assumptions, falsification: command.falsification, sources: command.sources, relation: command.relation, ...contentChanges});
}
function expand(node) { return node && typeof node === 'object' && typeof node.type === 'function' && ['StrategyCard','DefinitionEditor'].includes(node.type.name) ? node.type(node.props) : node; }
function walk(node, predicate) { const n = expand(node); if (!n || typeof n !== 'object') return []; if (Array.isArray(n)) return n.flatMap(child => walk(child, predicate)); return [...(predicate(n) ? [n] : []), ...walk(n.props?.children, predicate)]; }
function text(node) { const n = expand(node); return n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(text).join(' ') : typeof n === 'object' ? text(n.props?.children) : String(n); }
const label = node => text(node).replace(/\s+/g, ' ').trim();
const button = (tree, name) => walk(tree, node => node.type === 'button' && (node.props['aria-label'] === name || label(node) === name))[0];
const field = (tree, name) => walk(tree, node => node.props?.['aria-label'] === name)[0];
function harness(props = {signedIn: true}) {
  context.cleanup.forEach(cleanup => cleanup?.()); for (const key of ['state', 'refs', 'deps', 'effects', 'cleanup']) context[key] = [];
  const render = () => { context.si = context.ri = context.ei = 0; return Strategy(props); };
  const flush = async () => { for (let i = 0; i < 12; i++) { render(); while (context.effects.length) context.effects.shift()(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  const until = async predicate => { const deadline = Date.now() + 5000; do { const tree = await flush(); if (typeof predicate === 'function' ? predicate(tree) : text(tree).includes(predicate)) return tree; } while (Date.now() < deadline); assert.fail('Timed out waiting for ' + predicate + ': ' + text(render())); };
  return {props, render, flush, until,
    click(name, subtree) { const found = button(subtree ?? render(), name); assert(found, 'missing ' + name); assert(!found.props.disabled, name + ' disabled'); found.props.onClick(); },
    field(name, value) { const found = field(render(), name); assert(found, 'missing ' + name); found.props.onChange({target: {value, checked: value}}); },
    submit() { const form = walk(render(), node => node.type === 'form')[0]; assert(form, 'missing form'); form.props.onSubmit({preventDefault() {}}); },
    close() { walk(render(), node => node.props?.onOpenChange)[0]?.props.onOpenChange(false); },
    unmount() { context.cleanup.forEach(cleanup => cleanup?.()); },
    card(id) { return walk(render(), node => node.props?.['aria-label'] === 'Strategy ' + id)[0]; },
  };
}
function server(initial = [], post, options = {}) {
  const requests = [], records = [...initial];
  globalThis.fetch = async (path, init = {}) => {
    requests.push({path, init});
    if (path === '/api/strategies/me') return options.meResponse ?? Response.json(me);
    if (init.method !== 'POST') return path.includes('?root=') ? Response.json({version: 1, items: records.filter(value => value.rootId === new URL(path, 'https://local').searchParams.get('root')), executionEnabled: false}) : Response.json(list(records));
    const command = JSON.parse(init.body), target = records.find(value => value.id === command.id), parent = records.find(value => value.id === command.relation?.id);
    if (post) { const override = await post(command, records); if (override !== undefined) return override instanceof Response ? override : Response.json(override); }
    if (command.action === 'report') return Response.json(receipt(command, null, {requestId: command.requestId, id: command.id, digest: command.digest, reason: command.reason, createdAt: T}));
    const saved = command.action === 'publish' ? await publication(command, parent) : tombstone(target, 'WITHDRAWN', command);
    records.splice(0, records.length, saved, ...records.filter(value => value.id !== saved.id));
    return Response.json(receipt(command, saved));
  };
  return {requests, records};
}
async function ready(h) { await h.until(tree => button(tree, 'Create strategy')?.props.disabled === false); }
async function fill(h, overrides = {}) {
  const values = {...content, ...overrides};
  for (const [name, value] of [['Strategy name', values.name], ['Strategy description', values.description], ['Strategy assumptions', values.assumptions], ['Strategy falsification', values.falsification]]) { h.field(name, value); await h.flush(); }
  if (!field(h.render(), 'Fast SMA period') && !field(h.render(), 'Definition JSON') && !walk(h.render(), node => node.type === 'input' && node.props['aria-label'] === 'Market symbol').length) { h.click('Use TREND template'); await h.flush(); }
  h.field('Accept public strategy policy', true); await h.flush();
}
after(() => { context.cleanup.forEach(cleanup => cleanup?.()); globalThis.fetch = originalFetch; delete globalThis.__strategyHooks; });

test('anonymous catalog uses real attributable definitions and honest untested costs without private context', async () => {
  const human = await item(), agent = await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Synthetic agent'}});
  const {requests} = server([human, agent]), h = harness({signedIn: false}); const tree = await h.until(human.record.content.name);
  assert.deepEqual(requests.map(request => request.path), ['/api/strategies']);
  for (const phrase of ['Human ', 'Agent ', 'Human sponsor', 'Untested', 'Fee / side', 'Slippage / side', 'total allocation', 'orders disabled']) assert(text(tree).includes(phrase), phrase);
  assert(!text(tree).includes('Synthetic agent')); assert.equal(button(tree, 'Fork'), undefined);
  const signin = walk(tree, node => node.type === 'a' && node.props.href === '/signin-with-chatgpt?return_to=/strategies');
  assert(signin.length); assert(signin.every(node => node.props.target === '_top'));
  assert(!requests.some(request => /account|connection|performance|signal|execute/.test(request.path)));
});

test('publication requires consent and a template, then sends only strict metadata and disabled declarative rules', async () => {
  const {requests} = server(), h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); h.submit(); await h.flush();
  assert(text(h.render()).includes('Agree to the public strategy policy')); assert.equal(requests.filter(request => request.init.method === 'POST').length, 0);
  const link = walk(h.render(), node => node.type === 'a' && node.props.href === '/strategy-policy' && label(node) === 'Read policy')[0];
  assert(link); assert.equal(link.props.rel, 'noopener noreferrer');
  h.field('Accept public strategy policy', true); await h.flush(); h.submit(); await h.flush(); assert(text(h.render()).includes('Complete the strategy'));
  await fill(h); h.submit(); const tree = await h.until('Strategy recorded');
  const post = requests.find(request => request.init.method === 'POST'), command = model.strategyPublishSchema.parse(JSON.parse(post.init.body));
  assert.deepEqual(Object.keys(command).sort(), ['action','assumptions','definition','description','falsification','id','name','policyAccepted','relation','requestId','sources']);
  assert.equal(command.policyAccepted, 'public-strategy-v1'); assert.equal(post.init.headers['X-Strategy-Intent'], 'submit');
  assert.deepEqual(command.definition, model.strategyTemplate('TREND')); assert(!post.init.body.includes(authorId)); assert(text(tree).includes('public and untested'));
});

test('all seven guided templates produce the actual schema with conservative explicit cost defaults', async () => {
  for (const type of ['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']) {
    const {requests} = server(), h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); h.click('Use ' + type + ' template'); await h.flush();
    assert.equal(field(h.render(), 'Total allocation %').props.value, 1); assert.equal(field(h.render(), 'Maximum daily loss %').props.value, 1);
    assert.equal(field(h.render(), 'Fee per side bps').props.value, 10); assert.equal(field(h.render(), 'Slippage per side bps').props.value, 10);
    await fill(h); h.submit(); await h.until('Strategy recorded');
    const command = JSON.parse(requests.find(request => request.init.method === 'POST').init.body);
    assert.deepEqual(model.strategyDefinitionSchema.parse(command.definition), model.strategyTemplate(type));
  }
});

test('guided trend, signal and rule edits retain their exact declared direction and authored assumptions', async () => {
  for (const type of ['TREND','SIGNAL','RULES']) {
    const {requests} = server(), h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); h.click('Use ' + type + ' template'); await h.flush();
    h.field('Market symbol', 'ETH/USDT'); await h.flush(); h.field('Timeframe', '4h'); await h.flush(); h.field('Direction', 'SHORT'); await h.flush();
    if (type === 'TREND') { h.field('Fast SMA period','12'); await h.flush(); h.field('Slow SMA period','48'); await h.flush(); h.field('Trend confirmation','ALIGNED'); await h.flush(); }
    if (type === 'SIGNAL') { h.field('Signal provider','TRADINGVIEW'); await h.flush(); assert.equal(field(h.render(),'Signal event').props.value,'Bearish · short'); assert(text(h.render()).includes('No signal source or webhook receiver is connected')); }
    if (type === 'RULES') { h.click('Add condition'); await h.flush(); h.field('Rule match','ANY'); await h.flush(); h.field('Condition 2 indicator','RSI'); await h.flush(); h.field('Condition 2 threshold','70'); await h.flush(); assert(text(h.render()).includes('this Hub runs no rules')); }
    await fill(h); h.submit(); await h.until('Strategy recorded'); const d = JSON.parse(requests.find(request => request.init.method === 'POST').init.body).definition;
    assert.deepEqual(d.market,{symbol:'ETH/USDT',timeframe:'4h',direction:'SHORT'});
    if(type==='TREND') assert.deepEqual(d.entry,{type:'TREND',fastPeriod:12,slowPeriod:48,confirmation:'ALIGNED'});
    if(type==='SIGNAL') assert.equal(d.entry.event,'BEARISH');
    if(type==='RULES') { assert.equal(d.entry.match,'ANY'); assert.equal(d.entry.conditions[1].threshold,70); }
  }
});

test('blank costs and rule thresholds stay incomplete rather than silently becoming zero', async () => {
  for (const label of ['Fee per side bps','Slippage per side bps','Condition 1 threshold']) {
    const {requests} = server(), h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); h.click('Use RULES template'); await h.flush(); await fill(h);
    h.field(label,''); await h.flush(); h.submit(); await h.until('Empty costs or thresholds are not zero'); assert.equal(requests.filter(request=>request.init.method==='POST').length,0);
    h.click('Definition JSON'); await h.flush(); assert.equal(field(h.render(),'Definition JSON'),undefined); assert.equal(field(h.render(),label).props.value,'');
    h.click('Use RSI template'); await h.flush(); assert(button(h.render(),'Use RULES template').props['aria-pressed']); assert.equal(field(h.render(),label).props.value,'');
    h.field(label,'0'); await h.flush(); h.submit(); await h.until('Strategy recorded');
    const d=JSON.parse(requests.find(request=>request.init.method==='POST').init.body).definition;
    assert.equal(label==='Fee per side bps'?d.costs.feeBps:label==='Slippage per side bps'?d.costs.slippageBps:d.entry.conditions[0].threshold,0);
  }
});

test('removing rule rows remaps visible numeric drafts and discards removed incomplete values', async () => {
  const {requests}=server(), h=harness(); await ready(h); h.click('Create strategy'); await h.flush(); h.click('Use RULES template'); await h.flush();
  h.field('Condition 1 period','10'); await h.flush(); h.field('Condition 1 threshold',''); await h.flush(); h.click('Add condition'); await h.flush();
  h.field('Condition 2 period','27'); await h.flush(); h.field('Condition 2 threshold','1.25'); await h.flush(); h.click('Remove condition 1'); await h.flush();
  assert.equal(field(h.render(),'Condition 1 period').props.value,'27'); assert.equal(field(h.render(),'Condition 1 threshold').props.value,'1.25'); assert.equal(field(h.render(),'Condition 2 period'),undefined);
  await fill(h); h.submit(); await h.until('Strategy recorded'); const d=JSON.parse(requests.find(request=>request.init.method==='POST').init.body).definition;
  assert.equal(d.entry.conditions.length,1); assert.equal(d.entry.conditions[0].period,27); assert.equal(d.entry.conditions[0].threshold,1.25);
});

test('advanced JSON must be explicitly applied and round-trips through the same guided definition schema', async () => {
  const {requests}=server(),h=harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.click('Definition JSON'); await h.flush();
  const imported=model.strategyTemplate('GRID'); imported.market.symbol='ETH/USDT'; imported.entry.lowerPrice=1500; imported.entry.upperPrice=2500;
  h.field('Definition JSON',JSON.stringify(imported)); await h.flush(); h.submit(); await h.until('Apply or discard your JSON changes'); assert.equal(requests.filter(request=>request.init.method==='POST').length,0);
  h.click('Guided builder'); await h.flush(); assert(field(h.render(),'Definition JSON')); h.click('Apply definition'); await h.flush(); h.click('Guided builder'); await h.flush();
  assert.equal(field(h.render(),'Grid lower price').props.value,1500); assert.equal(field(h.render(),'Grid upper price').props.value,2500); assert(text(h.render()).includes('not current quotes'));
  h.submit(); await h.until('Strategy recorded'); assert.deepEqual(JSON.parse(requests.find(request=>request.init.method==='POST').init.body).definition,imported);
});

test('JSON rejects duplicate fields, code, extra privileges and live execution without losing the edited text', async () => {
  const {requests}=server(),h=harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.click('Definition JSON'); await h.flush();
  const valid=JSON.stringify(model.strategyTemplate('TREND'));
  for(const invalid of [valid.replace('{"schemaVersion":1,','{"schemaVersion":1,"schemaVersion":1,'),JSON.stringify({...model.strategyTemplate('TREND'),code:'fetch("https://example.com")'}),valid.replace('"DEMO"','"LIVE"'),valid.replace('"ordersEnabled":false','"ordersEnabled":true'),valid.replace('"leverage":1','"leverage":2')]) {
    h.field('Definition JSON',invalid); await h.flush(); h.click('Apply definition'); await h.until('Invalid definition'); assert.equal(field(h.render(),'Definition JSON').props.value,invalid); h.submit(); await h.flush();
  }
  assert.equal(requests.filter(request=>request.init.method==='POST').length,0); h.click('Discard JSON changes'); await h.flush(); assert.equal(field(h.render(),'Definition JSON').props.value,JSON.stringify(model.strategyTemplate('TREND'),null,2));
});

test('local JSON imports are bounded UTF-8 drafts and never uploaded or auto-applied', async () => {
  const {requests}=server(),h=harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.click('Definition JSON'); await h.flush();
  const bytes=new TextEncoder().encode(JSON.stringify(model.strategyTemplate('DCA')));
  for(const file of [{size:32769,arrayBuffer:async()=>{throw Error('must not read');}},{size:2,arrayBuffer:async()=>new Uint8Array([0xff,0xfe]).buffer}]) {
    field(h.render(),'Import definition JSON').props.onChange({target:{files:[file],value:'local.json'}}); await h.until('Use a UTF-8 JSON definition file');
  }
  field(h.render(),'Import definition JSON').props.onChange({target:{files:[{size:bytes.length,arrayBuffer:async()=>bytes.buffer}],value:'local.json'}});
  await h.until(tree=>field(tree,'Definition JSON')?.props.value===new TextDecoder().decode(bytes)); assert(button(h.render(),'Publish definition').props.disabled);
  assert.equal(requests.filter(request=>request.init.method==='POST').length,0); h.click('Apply definition'); await h.flush(); h.submit(); await h.until('Strategy recorded');
  assert.equal(JSON.parse(requests.find(request=>request.init.method==='POST').init.body).definition.entry.type,'DCA'); assert(requests.every(request=>request.path.startsWith('/api/strategies')));
});

test('file completion and captured callbacks cannot revive a private definition after session loss', async () => {
  for(const action of ['signout','unmount']) {
    server(); const h=harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.click('Definition JSON'); await h.flush();
    let release; const importCallback=field(h.render(),'Import definition JSON').props.onChange;
    importCallback({target:{files:[{size:12,arrayBuffer:()=>new Promise(resolve=>release=resolve)}],value:'private.json'}}); await h.until('Reading definition file');
    if(action==='signout'){h.props.signedIn=false; await h.flush();}else h.unmount();
    release(new TextEncoder().encode('{"private":true}').buffer); await h.flush();
    if(action==='signout') assert.equal(field(h.render(),'Definition JSON'),undefined);
    else assert.equal(field(h.render(),'Definition JSON').props.value,JSON.stringify(model.strategyTemplate('TREND'),null,2));
    assert(!text(h.render()).includes('{"private":true}'));
  }
});

test('revisions and forks reference exact immutable definitions without granting authorship or a tested result', async () => {
  for(const type of ['REVISION','FORK']) {
    const target=await item(),{requests}=server([target]),h=harness(); await ready(h); h.click(type==='REVISION'?'Revise':'Fork',h.card(target.id)); await h.flush(); await fill(h); h.submit(); await h.until('Strategy recorded');
    const command=JSON.parse(requests.find(request=>request.init.method==='POST').init.body); assert.deepEqual(command.relation,{type,id:target.id,digest:target.digest}); assert.notEqual(command.id,target.id);
    assert.equal(command.definition.entry.type,'TREND'); assert(!('verification' in command));
  }
});

test('schema-bound guided numbers reject inconsistent ranges, fractional counts and invalid allocations', async () => {
  for(const [type,number,value] of [['TREND','Fast SMA period','50'],['GRID','Grid lower price','70000'],['DCA','Maximum DCA entries','2.5'],['RSI','Total allocation %','11'],['RULES','Condition 1 threshold','NaN']]) {
    const {requests}=server(),h=harness(); await ready(h); h.click('Create strategy'); await h.flush(); h.click('Use '+type+' template'); await h.flush(); await fill(h); h.field(number,value); await h.flush(); h.submit(); await h.flush();
    assert.equal(requests.filter(request=>request.init.method==='POST').length,0); assert(text(h.render()).includes(value==='NaN'?'Complete every numeric field':'Complete the strategy'));
  }
});

test('a valid near-capacity 32-version history larger than 1 MiB renders; responses above 2 MiB do not', async () => {
  const url='https://example.com/'+ 'a'.repeat(2048-'https://example.com/'.length);
  const large={name:'n'.repeat(120),description:'d'.repeat(3000),assumptions:'a'.repeat(1500),falsification:'f'.repeat(2000),sources:Array.from({length:8},()=>({url,classification:'PRIMARY',note:'"'.repeat(150)+'n'.repeat(150)}))};
  const items=[];
  for(let index=0;index<32;index++) {
    const previous=items.at(-1),value=await item(previous?{rootId:items[0].id,revision:index+1}:{},{...large,relation:previous?{type:'REVISION',id:previous.id,digest:previous.digest}:null});
    value.moderation=Array.from({length:14},(_,n)=>({sequence:n+1,requestId:crypto.randomUUID(),createdAt:T,actor:{kind:'HUMAN',id:otherId,sponsorId:otherId},state:n%2?'VISIBLE':'HIDDEN',reason:n%2?'RESTORED':'POLICY'}));
    value.reason='RESTORED'; model.strategyPublicItemSchema.parse(value); items.push(value);
  }
  const valid=JSON.stringify({version:1,items,executionEnabled:false});
  assert(Buffer.byteLength(valid)>1_048_576); assert(Buffer.byteLength(valid)<2_097_152); model.strategyHistorySchema.parse(JSON.parse(valid));
  for(const body of [valid,valid+' '.repeat(2_097_153-Buffer.byteLength(valid))]) {
    globalThis.fetch=async path=>path.includes('?root=')?new Response(body):Response.json(list([items.at(-1)]));
    const h=harness({signedIn:false}); await h.until(large.name); h.click('History',h.card(items.at(-1).id));
    if(body===valid) { await h.until(tree=>walk(tree,node=>node.props?.['aria-label']?.startsWith('Strategy ')).length===33); assert(!text(h.render()).includes('History unavailable')); }
    else await h.until('History unavailable');
  }
});

test('unknown writes retain exact bytes and block edits, close and competing submissions until same request retry', async () => {
  let first = true; const {requests} = server([], command => { if (first) { first = false; return Response.json({error: 'unconfirmed'}, {status: 503}); } });
  const h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown');
  h.close(); assert(walk(h.render(), node => node.props?.open).length); const oldTitle = field(h.render(), 'Strategy name').props.value;
  field(h.render(), 'Strategy name').props.onChange({target: {value: 'Changed after uncertainty'}}); h.submit(); await h.flush(); assert.equal(field(h.render(), 'Strategy name').props.value, oldTitle);
  assert.equal(requests.filter(value => value.init.method === 'POST').length, 1); h.click('Retry same request'); await h.until('Strategy recorded');
  const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts.length, 2); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('double submits serialize one mutation and late mismatched receipts cannot confirm publication', async () => {
  let first = true;
  const {requests} = server([], async command => { if (first) { first = false; return receipt(command, await publication(command, null, {}, {name: 'Unexpected content'})); } }), h = harness();
  await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); const submit = walk(h.render(), node => node.type === 'form')[0].props.onSubmit;
  submit({preventDefault() {}}); submit({preventDefault() {}}); await h.until('Outcome unknown'); assert(!text(h.render()).includes('Strategy recorded')); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
  h.click('Retry same request'); await h.until('Strategy recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('corrupt digests, wrong author and wrong operation receipts remain uncertain until valid reconciliation', async () => {
  for (const alter of [value => ({...value, digest: 'a'.repeat(64)}), async value => item({id: value.id, requestId: value.requestId, author: {kind: 'HUMAN', id: otherId, sponsorId: otherId}}, value.record.content), value => ({...value, requestId: crypto.randomUUID()})]) {
    let first = true; const {requests} = server([], async command => { if (first) { first = false; return receipt(command, await alter(await publication(command))); } }), h = harness();
    await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.submit(); await h.until('Outcome unknown'); assert(!text(h.render()).includes('Strategy recorded'));
    h.click('Retry same request'); await h.until('Strategy recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
  }
});

test('agent sponsorship permits withdrawal but cannot grant human revision of agent-authored work', async () => {
  const ownedAgent = await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Sponsored agent'}}), foreign = await item({author: {kind: 'HUMAN', id: otherId, sponsorId: otherId}});
  server([ownedAgent, foreign]); const h = harness(); await ready(h);
  assert.equal(button(h.card(ownedAgent.id), 'Revise'), undefined); assert(button(h.card(ownedAgent.id), 'Withdraw')); assert.equal(button(h.card(foreign.id), 'Withdraw'), undefined); assert.equal(button(h.card(foreign.id), 'Revise'), undefined);
  assert(button(h.card(foreign.id), 'Fork')); assert(button(h.card(foreign.id), 'Report'));
});

test('author and sponsor withdrawal confirms exact digest and renders content-free tombstones', async () => {
  const target = await item({}, {name: 'Content to remove', description: 'This public statement will be withdrawn.'}), {requests} = server([target]), h = harness(); await ready(h);
  h.click('Withdraw', h.card(target.id)); await h.flush(); h.field('Accept public strategy policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn');
  const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.id, target.id); assert.equal(command.digest, target.digest); assert.equal(command.reason, 'AUTHOR_REQUEST');
  h.click('Done'); await h.until('Withdrawn strategy'); const tree = h.render(); assert(!text(tree).includes(target.record.content.name)); assert(!text(tree).includes(target.record.content.description)); assert(!walk(tree, node => node.type === 'a').some(node => node.props.href === content.sources[0].url));
});

test('a human sponsor can withdraw an already hidden agent record without recovering authored text', async () => {
  const target = tombstone(await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Previously hidden agent'}}, {name: 'Previously hidden title'}), 'HIDDEN');
  const {requests} = server([target]), h = harness(); await ready(h);
  assert.equal(button(h.card(target.id), 'Revise'), undefined); h.click('Withdraw', h.card(target.id)); await h.flush();
  h.field('Accept public strategy policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn');
  const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body); assert.equal(command.reason, 'SPONSOR_REQUEST'); assert.equal(command.digest, target.digest);
  h.click('Done'); await h.until('Withdrawn strategy'); assert(!text(h.render()).includes('Previously hidden title')); assert.equal(button(h.card(target.id), 'Withdraw'), undefined);
});

test('a retained-capacity rejection does not imply a daily automatic reset', async () => {
  server([], () => Response.json({error: 'full'}, {status: 429})); const h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.submit();
  await h.until('no automatic reset is scheduled'); assert(!text(h.render()).includes('Try again later'));
});

test('withdrawal from retained history clears stale content so closing success cannot reopen the old visible version', async () => {
  const target = await item({}, {name: 'Remove cached history content'}); server([target]); const h = harness(); await ready(h);
  h.click('History', h.card(target.id)); await h.until('Immutable strategy history'); await h.until(tree => walk(tree, node => node.props?.['aria-label'] === 'Strategy ' + target.id).length > 1);
  const cards = walk(h.render(), node => node.props?.['aria-label'] === 'Strategy ' + target.id); h.click('Withdraw', cards.at(-1)); await h.flush(); h.field('Accept public strategy policy', true); await h.flush(); h.submit(); await h.until('Content withdrawn');
  h.click('Done'); await h.until('Withdrawn strategy'); assert(!text(h.render()).includes('Remove cached history content')); assert(!text(h.render()).includes('Immutable strategy history'));
});

test('report details stay private and the public board never renders a report body', async () => {
  const target = await item(), {requests} = server([target]), h = harness(); await ready(h); h.click('Report', h.card(target.id)); await h.flush();
  h.field('Report reason', 'MISLEADING'); await h.flush(); h.field('Private report details', 'Private contextual concern for moderation only.'); await h.flush(); h.field('Accept public strategy policy', true); await h.flush(); h.submit();
  await h.until('Report received'); assert(!text(h.render()).includes('Private contextual concern')); const command = JSON.parse(requests.find(value => value.init.method === 'POST').init.body);
  assert.equal(command.details, 'Private contextual concern for moderation only.'); assert.equal(command.digest, target.digest); h.click('Done'); await h.flush(); assert(!text(h.render()).includes(command.details));
});

test('hidden publication retry receipts reconcile metadata without restoring the submitted body', async () => {
  let first = true;
  const {requests} = server([], async command => { if (first) { first = false; return Response.json({error: 'lost acknowledgment'}, {status: 503}); } return receipt(command, tombstone(await publication(command), 'HIDDEN')); }), h = harness();
  await ready(h); h.click('Create strategy'); await h.flush(); await fill(h, {name: 'Body that was hidden'}); h.submit(); await h.until('Outcome unknown'); h.click('Retry same request'); await h.until('content is hidden or withdrawn');
  assert(!text(h.render()).includes('Body that was hidden')); const posts = requests.filter(value => value.init.method === 'POST'); assert.equal(posts[0].init.body, posts[1].init.body);
});

test('401/403 clear pending mutation and form state while leaving anonymously readable strategy public', async () => {
  for (const status of [401, 403]) {
    const target = await item(), {requests} = server([target], () => Response.json({error: 'access'}, {status})), h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h, {name: 'Private unfinished draft'});
    const stale = walk(h.render(), node => node.type === 'form')[0].props.onSubmit; h.submit(); await h.until('Your session expired'); stale({preventDefault() {}}); await h.flush();
    assert.equal(requests.filter(value => value.init.method === 'POST').length, 1); assert.equal(field(h.render(), 'Strategy name'), undefined); assert(text(h.render()).includes(target.record.content.name));
  }
});

test('late writes after sign-out or unmount cannot revive forms or private report details', async () => {
  for (const action of ['signout', 'unmount']) {
    let release; const {requests} = server([], command => new Promise(resolve => release = async () => resolve(receipt(command, await publication(command))))), h = harness(); await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.submit(); await h.until('Submitting…');
    const pending = context.refs.find(ref => ref?.current?.pending)?.current.pending; assert(pending?.body);
    if (action === 'signout') { h.props.signedIn = false; await h.flush(); } else h.unmount(); assert.equal(pending.body, '');
    await release(); await h.flush(); assert(!text(h.render()).includes('Strategy recorded')); assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
  }
});

test('deterministic rejection unlocks editing with a new operation, and rate rejection communicates retry timing', async () => {
  for (const status of [400, 404, 409, 413, 415, 429]) {
    let first = true; const {requests} = server([], () => { if (first) { first = false; return Response.json({error: 'rejected'}, {status, headers: {'Retry-After': '60'}}); } }), h = harness();
    await ready(h); h.click('Create strategy'); await h.flush(); await fill(h); h.submit(); await h.until(tree => text(tree).includes('Submission rejected') || text(tree).includes('record changed') || text(tree).includes('Submission quota'));
    assert.equal(button(h.render(), 'Retry same request'), undefined); if (status === 429) assert(text(h.render()).includes('Retry after 60 seconds'));
    h.field('Strategy name', 'Reviewed replacement'); await h.flush(); h.submit(); await h.until('Strategy recorded'); const posts = requests.filter(value => value.init.method === 'POST'); assert.notEqual(JSON.parse(posts[0].init.body).requestId, JSON.parse(posts[1].init.body).requestId);
  }
});

test('public text stays React text, safe source anchors do not fetch author URLs or execute HTML', async () => {
  const hostile = '<img src=x onerror=alert(1)><script>alert(2)</script>', target = await item({}, {name: hostile.slice(0, 120), description: hostile, assumptions: hostile});
  const {requests} = server([target]), h = harness({signedIn: false}); const tree = await h.until(hostile);
  assert(text(tree).includes(hostile)); assert.equal(walk(tree, node => node.type === 'img' || node.type === 'script' || node.props?.dangerouslySetInnerHTML).length, 0);
  const link = walk(tree, node => node.type === 'a' && node.props.href === content.sources[0].url)[0]; assert.equal(link.props.rel, 'noopener noreferrer'); assert.equal(link.props.target, '_blank');
  assert.deepEqual(requests.map(value => value.path), ['/api/strategies']);
});

test('tombstones hide authored names, sources and text while retaining exact identities and unverified status', async () => {
  const target = await item({author: {kind: 'AGENT', id: crypto.randomUUID(), sponsorId: authorId, name: 'Name to redact'}}, {name: 'Title to redact', description: 'Statement to redact'});
  server([tombstone(target)]); const h = harness({signedIn: false}); const tree = await h.until('Withdrawn strategy');
  for (const hidden of ['Name to redact', 'Title to redact', 'Statement to redact', content.sources[0].url]) assert(!text(tree).includes(hidden));
  assert(text(tree).includes(target.digest)); assert(text(tree).includes('Untested')); assert.equal(button(tree, 'Fork'), undefined);
});

test('strict bounded public parsing rejects duplicate keys, malformed content, fake authority and digest drift', async () => {
  const target = await item(); const invalid = ['invalid JSON', ' '.repeat(2_097_153), JSON.stringify(list([target])).replace('{"version":1,', '{"version":1,"version":1,'), JSON.stringify({...list([target]), executionEnabled: true}), JSON.stringify(list([{...target, digest: 'a'.repeat(64)}])), JSON.stringify(list([{...target, state: 'HIDDEN'}]))];
  for (const body of invalid) { globalThis.fetch = async () => new Response(body); const h = harness({signedIn: false}); await h.until('Strategy unavailable'); assert(!text(h.render()).includes(target.record.content.name)); }
});

test('pagination removes stale action targets and history rejects a different root identity', async () => {
  const first = await item(), next = await item({}, {name: 'Next page strategy'}), cursor = crypto.randomUUID(), calls = [];
  globalThis.fetch = async path => { calls.push(path); if (path === '/api/strategies/me') return Response.json(me); if (path.includes('?root=')) return Response.json({version: 1, items: [next], executionEnabled: false}); return Response.json(path.includes('?cursor=') ? list([next]) : list([first], cursor)); };
  const h = harness(); await ready(h); const staleFork = button(h.card(first.id), 'Fork'); h.click('Next page'); await h.until(next.record.content.name); staleFork.props.onClick(); await h.flush(); assert.equal(field(h.render(), 'Strategy name'), undefined);
  assert(calls.includes('/api/strategies?cursor=' + cursor)); h.click('History', h.card(next.id)); await h.until('Immutable strategy history');
  // The first record requests the other root, proving correlation rather than a generic schema-only check.
  h.close(); h.click('Back to latest'); await h.until(first.record.content.name); h.click('History', h.card(first.id)); await h.until('History unavailable');
});

test('a newer known revision disables old human revision and captured closed forms cannot submit', async () => {
  const original = await item(), newer = await item({id: crypto.randomUUID(), rootId: original.rootId, revision: 2}, {relation: {type: 'REVISION', id: original.id, digest: original.digest}});
  const {requests} = server([newer, original]), h = harness(); await ready(h); assert(button(h.card(original.id), 'Revise').props.disabled); assert(!button(h.card(newer.id), 'Revise').props.disabled);
  h.click('Create strategy'); await h.flush(); await fill(h); const stale = walk(h.render(), node => node.type === 'form')[0].props.onSubmit; h.close(); h.click('Create strategy'); await h.flush(); stale({preventDefault() {}}); await h.flush(); assert.equal(requests.filter(value => value.init.method === 'POST').length, 0);
});

test('public strategy links carry each immutable revision into Demo and Sessions without an account or automatic execution', async () => {
  const first = await item(), second = await item({rootId: first.rootId, revision: 2}, {relation: {type: 'REVISION', id: first.id, digest: first.digest}});
  const {requests} = server([second, first]), h = harness({signedIn: false}); await h.until(first.record.content.name);
  for (const source of [first, second]) {
    const card = h.card(source.id), anchors = walk(card, node => node.type === 'a' && ['Try Demo', 'Open Session'].includes(label(node)));
    assert.equal(anchors.length, 2);
    for (const anchor of anchors) {
      const url = new URL(anchor.props.href, 'https://local');
      assert.equal(url.origin, 'https://local'); assert.equal(url.pathname, label(anchor) === 'Try Demo' ? '/demo' : '/session');
      assert.deepEqual([...url.searchParams], [['strategy', source.id], ['digest', source.digest]]);
      assert.equal(anchor.props.onClick, undefined, 'navigation starts no replay, journal, publication or credential operation');
    }
  }
  assert.deepEqual(requests.map(value => value.path), ['/api/strategies']);
});

test('hidden and withdrawn strategies expose no executable handoff, while visible cards retain their exact links', async () => {
  const first = await item(), second = await item(), third = await item(); server([tombstone(first, 'HIDDEN'), tombstone(second), third]);
  const h = harness({signedIn: false}); await h.until(third.record.content.name);
  for (const source of [first, second]) assert.equal(walk(h.card(source.id), node => node.type === 'a' && ['Try Demo', 'Open Session'].includes(label(node))).length, 0);
  assert.equal(walk(h.card(third.id), node => node.type === 'a' && ['Try Demo', 'Open Session'].includes(label(node))).length, 2);
});

test('strategy UI introduces no public report text, moderator controls, persistent drafts or executable rendering', async () => {
  const source = await readFile('app/strategies.tsx', 'utf8'); assert(!/localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML|eval\(|console\.(?:log|warn|error)/.test(source));
  assert(!/action:\s*['"]moderate['"]/.test(source)); const page = await readFile('app/strategies/page.tsx', 'utf8'); assert(page.includes('getChatGPTUser')); assert(page.includes('signedIn={!!user}'));
});


test('evidence navigation pins exact visible and tombstone versions without fetching or autoevaluation', async () => {
  const visible = await item(), hidden = tombstone(await item(), 'HIDDEN'), withdrawn = tombstone(await item());
  const {requests} = server([visible, hidden, withdrawn]), h = harness({signedIn: false}); await h.until(visible.record.content.name);
  for (const value of [visible, hidden, withdrawn]) {
    const anchor = field(h.card(value.id), 'Evidence strategy ' + value.id);
    assert(anchor); assert.equal(anchor.props.href, '/strategies?id=' + value.id + '&digest=' + value.digest);
    let prevented = false; anchor.props.onClick({ctrlKey: true, preventDefault() { prevented = true; }}); assert.equal(prevented, false);
  }
  assert.deepEqual(requests.map(value => value.path), ['/api/strategies']);
});

test('captured evidence links cannot bypass open strategy forms or uncertain writes', async () => {
  const target = await item(), {requests} = server([target], () => new Response(null, {status: 503})), h = harness(); await ready(h);
  const anchor = field(h.card(target.id), 'Evidence strategy ' + target.id);
  h.click('Create strategy'); await h.flush(); let prevented = false;
  anchor.props.onClick({ctrlKey: true, preventDefault() { prevented = true; }}); assert(prevented);
  await fill(h); h.submit(); await h.until('Outcome unknown'); prevented = false;
  anchor.props.onClick({preventDefault() { prevented = true; }}); assert(prevented);
  assert.equal(requests.filter(value => value.init.method === 'POST').length, 1);
  h.unmount(); prevented = false; anchor.props.onClick({preventDefault() { prevented = true; }}); assert(prevented);
});
