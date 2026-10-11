import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Actual component hooks and user events with synthetic public projections.
// These fixtures establish neither browser layout, hosted accounts, models nor usefulness.
const require=createRequire(import.meta.url),originalFetch=globalThis.fetch;
const context={state:[],refs:[],deps:[],effects:[],cleanup:[],si:0,ri:0,ei:0};
globalThis.__assistanceHooks={
 useState(initial){const i=context.si++;if(!(i in context.state))context.state[i]=typeof initial==='function'?initial():initial;return [context.state[i],next=>context.state[i]=typeof next==='function'?next(context.state[i]):next];},
 useRef(initial){return context.refs[context.ri++]??={current:initial};},
 useEffect(callback,deps){const i=context.ei++,old=context.deps[i];if(!old||deps.some((value,n)=>value!==old[n])){context.deps[i]=deps;context.effects.push(()=>{context.cleanup[i]?.();context.cleanup[i]=callback();});}},
};
const built=await build({entryPoints:['app/assistance.tsx'],bundle:true,format:'cjs',platform:'node',write:false,target:'es2022',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'assistance-hooks',setup(b){b.onResolve({filter:/^react$/},a=>a.importer.endsWith('/app/assistance.tsx')?{path:a.path,namespace:'hooks'}:undefined);b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:'export const {useState,useRef,useEffect}=globalThis.__assistanceHooks;',loader:'js'}));}}]});
const module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);const Assistance=module.exports.default;
const modelBuilt=await build({stdin:{contents:"export * from './app/strategy-model';export * from './app/assistance-model';export * from './app/assistance-handoff';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const m=await import('data:text/javascript;base64,'+Buffer.from(modelBuilt.outputFiles[0].text).toString('base64'));
const uid=()=>crypto.randomUUID(),copy=value=>structuredClone(value),ref=value=>({id:value.id,digest:value.digest});
const human={kind:'HUMAN',id:'human_'+'a'.repeat(64),sponsorId:'human_'+'a'.repeat(64)},other={kind:'HUMAN',id:'human_'+'b'.repeat(64),sponsorId:'human_'+'b'.repeat(64)},agent={kind:'AGENT',id:uid(),sponsorId:other.id,name:'INVENTED external proposal agent'};
const principal={version:1,authorId:human.id,sponsorId:human.id,moderator:false,executionEnabled:false},otherPrincipal={...principal,authorId:other.id,sponsorId:other.id};
const clocks={base:'2026-10-11T08:00:00.000Z',request:'2026-10-11T08:01:00.000Z',proposal:'2026-10-11T08:02:00.000Z',response:'2026-10-11T08:03:00.000Z',adoption:'2026-10-11T08:04:00.000Z'};
async function strategy({author=human,name='INVENTED exact UI base',definition=m.strategyTemplate('TREND'),relation=null,createdAt=clocks.base,id=uid(),requestId=uid()}={}){
 const record=m.boundedStrategyRecord({version:1,id,rootId:id,revision:1,requestId,createdAt,author,content:{name,description:'Invented declarative proposal; no returns established.',assumptions:'Data selection and costs can refute the idea.',falsification:'Reject unsupported improvements and unbounded risk.',sources:[],definition,relation},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false}).record;
 return {id,digest:await m.strategyDigest(JSON.stringify(record)),rootId:id,revision:1,requestId,createdAt,author:m.strategyAuthorReference(author),state:'VISIBLE',reason:null,record,moderation:[]};
}
async function assistance(command,author=human,createdAt=clocks.request){const record=m.assistanceRecordForCommand(command,author,createdAt);return {id:record.id,kind:record.kind,digest:await m.strategyDigest(m.boundedAssistanceRecord(record).payload),requestId:record.requestId,createdAt,author:m.strategyAuthorReference(author),state:'VISIBLE',reason:null,availability:'AVAILABLE',record,moderation:[]};}
async function fixture(){
 const base=await strategy(),request=await assistance({action:'request',id:uid(),requestId:uid(),base:ref(base),intent:'INVENTED investigate a slower trend filter',constraints:'Keep Demo, leverage 1 and explicit costs.',falsification:'Reject unsupported performance or changed provenance.',policyAccepted:'public-assistance-v1'}),definition=copy(base.record.content.definition);definition.entry.fastPeriod=25;definition.costs.feeBps=12;
 const proposal=await strategy({author:agent,name:'INVENTED proposed slower filter',definition,relation:{type:'FORK',...ref(base)},createdAt:clocks.proposal}),response=await assistance({action:'respond',id:uid(),requestId:uid(),request:ref(request),proposal:ref(proposal),rationale:'INVENTED a slower filter is a hypothesis to test.',questions:'Which unseen dataset would reject this change?',policyAccepted:'public-assistance-v1'},agent,clocks.response);
 return {base,request,response,proposal};
}
function suppressed(item,state='HIDDEN'){const reason=state==='WITHDRAWN'?'AUTHOR_REQUEST':'POLICY';return {...copy(item),state,reason,...('availability'in item?{availability:'SUPPRESSED'}:{}),record:null,moderation:[...item.moderation,{sequence:item.moderation.length+1,requestId:uid(),createdAt:clocks.adoption,actor:human,state,reason}]};}
const wrap=item=>({version:1,item,executionEnabled:false}),page=(items=[],request=null,nextCursor=null)=>({version:1,items,request,nextCursor,executionEnabled:false});
async function receipt(command){
 if(command.action==='request')return {version:1,action:'request',requestId:command.requestId,item:await assistance(command),report:null,executionEnabled:false};
 const record=m.boundedStrategyRecord({version:1,id:command.id,rootId:command.id,revision:1,requestId:command.requestId,createdAt:clocks.adoption,author:human,content:{name:command.name,description:command.description,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,definition:command.definition,relation:command.relation},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false}).record;
 return {version:1,action:'publish',requestId:command.requestId,item:{id:command.id,digest:await m.strategyDigest(JSON.stringify(record)),rootId:command.id,revision:1,requestId:command.requestId,createdAt:record.createdAt,author:human,state:'VISIBLE',reason:null,record,moderation:[]},report:null,executionEnabled:false};
}
function walk(node,predicate){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(child=>walk(child,predicate));return [...(predicate(node)?[node]:[]),...walk(node.props?.children,predicate)];}
function text(node){return node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?text(node.props?.children):String(node);}
const label=node=>text(node).replace(/\s+/g,' ').trim(),field=(tree,name)=>walk(tree,n=>n.props?.['aria-label']===name)[0],button=(tree,name)=>walk(tree,n=>n.type==='button'&&(n.props['aria-label']===name||label(n)===name))[0];
function harness(props){
 context.cleanup.forEach(cleanup=>cleanup?.());for(const key of ['state','refs','deps','effects','cleanup'])context[key]=[];
 const render=()=>{context.si=0;context.ri=0;context.ei=0;return Assistance(props);};
 const flush=async()=>{for(let n=0;n<12;n++){render();while(context.effects.length)context.effects.shift()();await new Promise(resolve=>setImmediate(resolve));}return render();};
 const until=async predicate=>{const deadline=Date.now()+5000;do{const tree=await flush();if(typeof predicate==='function'?predicate(tree):text(tree).includes(predicate))return tree;}while(Date.now()<deadline);assert.fail('Timed out: '+text(render()));};
 return {props,render,flush,until,click(name){const b=button(render(),name);assert(b,'Missing '+name);assert(!b.props.disabled,name+' disabled');b.props.onClick();},edit(name,value){const f=field(render(),name);assert(f,'Missing '+name);assert(!f.props.disabled,name+' disabled');f.props.onChange({target:f.props.type==='checkbox'?{checked:value}:{value}});},unmount(){context.cleanup.forEach(cleanup=>cleanup?.());}};
}
function server(bundle,intercept=()=>undefined){
 const requests=[];globalThis.fetch=async(path,init={})=>{const event={path,init};requests.push(event);let result=await intercept(event,requests);
  if(result===undefined){if(init.method==='POST')result=await receipt(JSON.parse(init.body));else if(path==='/api/assistance/me')result=principal;else if(path==='/api/assistance')result=page(bundle?[bundle.request]:[]);else if(path==='/api/assistance?request='+bundle?.request.id)result=page([bundle.response],ref(bundle.request));else if(path==='/api/assistance?id='+bundle?.request.id)result=wrap(bundle.request);else if(path==='/api/assistance?id='+bundle?.response.id)result=wrap(bundle.response);else if(path==='/api/strategies?id='+bundle?.base.id)result=wrap(bundle.base);else if(path==='/api/strategies?id='+bundle?.proposal.id)result=wrap(bundle.proposal);else throw Error('Unexpected synthetic request '+path);}
  return result instanceof Response?result:Response.json(result);
 };return requests;
}
async function fullResponsePage(b){const entries=[];for(let n=12;n>=1;n--)entries.push(await assistance({...m.assistanceCommandForRecord(b.response.record),id:'f0000000-1111-4111-8111-'+n.toString(16).padStart(12,'0'),requestId:uid()},agent,clocks.response));return entries;}
const posts=requests=>requests.filter(event=>event.init.method==='POST'),baseSelection=bundle=>({kind:'BASE',reference:ref(bundle.base)}),requestSelection=bundle=>({kind:'REQUEST',reference:ref(bundle.request)});
async function readyRequest(h){await h.until(tree=>!!field(tree,'Assistance intent'));h.edit('Assistance intent','Investigate a bounded change with unseen data.');h.edit('Assistance constraints','Keep costs, Demo and current risk constraints.');h.edit('Assistance falsification','Reject any unverified claim of profitability.');}
async function readyAdoption(h,bundle){await h.until('INVENTED investigate');h.click('Review proposal '+bundle.response.id);await h.until(tree=>!!field(tree,'Human adoption name'));h.edit('Human adoption name','My explicitly reviewed hypothetical fork');}
after(()=>{context.cleanup.forEach(cleanup=>cleanup?.());globalThis.fetch=originalFetch;delete globalThis.__assistanceHooks;});

test('anonymous browsing reads bounded requests and exact response scope without identity, writes or model calls',async()=>{
 const b=await fixture(),requests=server(b),h=harness({signedIn:false});await h.until(b.request.record.intent);assert.deepEqual(requests.map(event=>event.path),['/api/assistance']);assert.equal(field(h.render(),'Open assistance request '+b.request.id).props.href,m.assistanceHref('REQUEST',ref(b.request)));assert.equal(walk(h.render(),n=>['input','textarea'].includes(n.type)).length,0);
 h.props.selection=requestSelection(b);await h.until(b.response.record.rationale);h.click('Review proposal '+b.response.id);await h.until(b.proposal.record.content.name);const tree=h.render();for(const value of ['entry.fastPeriod','costs.feeBps','25','12','Which unseen dataset','UNTESTED','no built-in model','orders disabled'])assert(text(tree).includes(value),value);assert.equal(field(tree,'Human adoption name'),undefined);assert.equal(posts(requests).length,0);assert(!requests.some(event=>event.path.includes('/me')));assert(requests.every(event=>event.path.startsWith('/api/assistance')||event.path.startsWith('/api/strategies')));
});

test('anonymous exact base preserves canonical sign-in return and never creates a request',async()=>{
 const b=await fixture(),requests=server(b),h=harness({signedIn:false,selection:baseSelection(b)});await h.until(b.base.record.content.name);const signIn=walk(h.render(),n=>n.type==='a'&&label(n)==='Sign in to publish a request')[0];assert.equal(signIn.props.href,'/signin-with-chatgpt?return_to='+encodeURIComponent(m.assistanceHref('BASE',ref(b.base))));assert.equal(signIn.props.target,'_top');assert.equal(field(h.render(),'Assistance intent'),undefined);assert.deepEqual(requests.map(event=>event.path),['/api/strategies?id='+b.base.id]);
});

test('human request requires explicit sharing consent and publishes one exact-base command with the frozen-author guard',async()=>{
 const b=await fixture(),requests=server(b),h=harness({signedIn:true,selection:baseSelection(b)});await readyRequest(h);assert(button(h.render(),'Publish assistance request').props.disabled);assert.equal(posts(requests).length,0);h.edit('Confirm public assistance request',true);h.click('Publish assistance request');await h.until('Public request recorded.');assert.equal(posts(requests).length,1);const posted=posts(requests)[0],command=JSON.parse(posted.init.body);assert.equal(posted.path,'/api/assistance');assert.equal(posted.init.headers['X-Assistance-Author'],human.id);assert.equal(posted.init.headers['X-Assistance-Intent'],'submit');assert.deepEqual(command.base,ref(b.base));assert.equal(command.policyAccepted,'public-assistance-v1');assert.equal(command.action,'request');assert.notEqual(command.id,command.requestId);assert(!('author'in command)&&!('definition'in command));assert(requests.filter(event=>event.path==='/api/strategies?id='+b.base.id).length>=3);assert(requests.filter(event=>event.path==='/api/assistance/me').length>=3);assert.equal(field(h.render(),'Assistance intent').props.value,'');assert.equal(field(h.render(),'Confirm public assistance request').props.checked,false);
});

test('response review is read-only and explicit human adoption preserves all proposed rules through the old writer',async()=>{
 const b=await fixture(),requests=server(b),h=harness({signedIn:true,selection:requestSelection(b)});await readyAdoption(h,b);assert.equal(posts(requests).length,0);assert(button(h.render(),'Adopt agent proposal').props.disabled);assert(text(h.render()).includes('later request or response changes are not one atomic transaction'));h.edit('Confirm human proposal adoption',true);h.click('Adopt agent proposal');await h.until('Human fork recorded as UNTESTED.');assert.equal(posts(requests).length,1);const posted=posts(requests)[0],command=JSON.parse(posted.init.body);assert.equal(posted.path,'/api/strategies');assert.equal(posted.init.headers['X-Strategy-Author'],human.id);assert.equal(posted.init.headers['X-Strategy-Intent'],'submit');assert.equal(command.name,'My explicitly reviewed hypothetical fork');assert.deepEqual(command.definition,b.proposal.record.content.definition);for(const key of ['description','assumptions','falsification','sources'])assert.deepEqual(command[key],b.proposal.record.content[key]);assert.deepEqual(command.relation,{type:'FORK',...ref(b.proposal)});assert.equal(command.policyAccepted,'public-strategy-v1');assert.equal(command.definition.execution.leverage,1);assert.equal(command.definition.execution.ordersEnabled,false);assert(!('author'in command));assert.notEqual(command.id,b.proposal.id);assert(field(h.render(),'Open confirmed publication').props.href.includes(command.id));
});

test('lost post-commit acknowledgment holds request and adoption bodies for exact same-account retries',async()=>{
 for(const kind of ['REQUEST','ADOPTION']){
  const b=await fixture();let originalReceipt,postCount=0;const requests=server(b,async({init})=>{if(init.method!=='POST')return;postCount++;if(postCount===1){originalReceipt=await receipt(JSON.parse(init.body));throw Error('INVENTED lost acknowledgment after commit');}return originalReceipt;});
  const h=harness({signedIn:true,selection:kind==='REQUEST'?baseSelection(b):requestSelection(b)});if(kind==='REQUEST'){await readyRequest(h);h.edit('Confirm public assistance request',true);h.click('Publish assistance request');}else{await readyAdoption(h,b);h.edit('Confirm human proposal adoption',true);h.click('Adopt agent proposal');}
  await h.until('Outcome unknown.');const held=field(h.render(),'Held original operation');assert(held);assert(button(h.render(),'Refresh assistance').props.disabled);assert(field(h.render(),kind==='REQUEST'?'Assistance intent':'Human adoption name').props.disabled);const originalBody=posts(requests)[0].init.body,originalHeader=posts(requests)[0].init.headers;
  h.click('Retry original assistance operation');await h.until(kind==='REQUEST'?'Public request recorded.':'Human fork recorded as UNTESTED.');assert.equal(posts(requests).length,2);assert.equal(posts(requests)[1].init.body,originalBody);assert.deepEqual(posts(requests)[1].init.headers,originalHeader);assert.equal(field(h.render(),'Held original operation'),undefined);
 }
});

test('uncorrelated digest, command, operation or human receipts remain uncertain and cannot unlock fresh publication',async()=>{
 for(const fault of ['digest','intent','operation','principal','status']){
  const b=await fixture(),requests=server(b,async({init})=>{if(init.method!=='POST')return;const value=await receipt(JSON.parse(init.body));if(fault==='digest')value.item.digest='e'.repeat(64);if(fault==='intent'){value.item.record.intent+=' substituted';value.item.digest=await m.strategyDigest(m.boundedAssistanceRecord(value.item.record).payload);}if(fault==='operation')value.requestId=uid();if(fault==='principal'){value.item.author=other;value.item.record.author=other;value.item.digest=await m.strategyDigest(m.boundedAssistanceRecord(value.item.record).payload);}return fault==='status'?Response.json(value,{status:202}):value;});
  const h=harness({signedIn:true,selection:baseSelection(b)});await readyRequest(h);h.edit('Confirm public assistance request',true);h.click('Publish assistance request');await h.until('Outcome unknown.');assert.equal(posts(requests).length,1);assert.equal(field(h.render(),'Confirmed publication'),undefined);assert(field(h.render(),'Assistance intent').props.disabled);assert(button(h.render(),'Refresh assistance').props.disabled);
 }
});

test('human swaps before submission or original retry clear the operation without republishing under a new account',async()=>{
 for(const stage of ['prepare','retry']){
  const b=await fixture();let swap=false;const requests=server(b,({path,init})=>{if(path==='/api/assistance/me'&&swap)return otherPrincipal;if(init.method==='POST')throw Error('INVENTED lost acknowledgment');});const h=harness({signedIn:true,selection:baseSelection(b)});await readyRequest(h);h.edit('Confirm public assistance request',true);
  if(stage==='prepare'){swap=true;h.click('Publish assistance request');}else{h.click('Publish assistance request');await h.until('Outcome unknown.');swap=true;h.click('Retry original assistance operation');}
  await h.until('Account changed.');assert.equal(posts(requests).length,stage==='prepare'?0:1);assert.equal(field(h.render(),'Held original operation'),undefined);assert.equal(field(h.render(),'Assistance intent'),undefined);assert(!text(h.render()).includes('Investigate a bounded change with unseen data.'));
 }
});

test('commit-time frozen-author rejection never accepts a response from a changed account',async()=>{
 const b=await fixture(),requests=server(b,({init})=>init.method==='POST'?Response.json({error:'INVENTED other account'},{status:403}):undefined),h=harness({signedIn:true,selection:baseSelection(b)});await readyRequest(h);h.edit('Confirm public assistance request',true);h.click('Publish assistance request');await h.until('Human authorization rejected.');assert.equal(posts(requests).length,1);assert.equal(posts(requests)[0].init.headers['X-Assistance-Author'],human.id);assert.equal(field(h.render(),'Held original operation'),undefined);assert.equal(field(h.render(),'Confirmed publication'),undefined);assert.equal(field(h.render(),'Assistance intent'),undefined);
});

test('fresh hidden base, request, response or proposal blocks adoption and removes reviewed content before any POST',async()=>{
 for(const target of ['base','request','response','proposal']){
  const b=await fixture(),requests=server(b),h=harness({signedIn:true,selection:requestSelection(b)});await readyAdoption(h,b);h.edit('Confirm human proposal adoption',true);b[target]=suppressed(b[target]);h.click('Adopt agent proposal');await h.until('No publication was sent.');assert.equal(posts(requests).length,0);assert.equal(field(h.render(),'Reviewed agent proposal'),undefined);assert.equal(field(h.render(),'Human adoption name'),undefined);assert.equal(field(h.render(),'Held original operation'),undefined);assert(!text(h.render()).includes(b.proposal.record?.content.name??'INVENTED proposed slower filter'));
 }
});

test('original redacted request and adoption retries retain receipt identity without reconstructing public content',async()=>{
 for(const kind of ['REQUEST','ADOPTION']){
  const b=await fixture();let committed,count=0;const requests=server(b,async({init})=>{if(init.method!=='POST')return;if(++count===1){committed=await receipt(JSON.parse(init.body));throw Error('INVENTED acknowledgment lost');}return {...committed,item:suppressed(committed.item,'WITHDRAWN')};});
  const h=harness({signedIn:true,selection:kind==='REQUEST'?baseSelection(b):requestSelection(b)});if(kind==='REQUEST'){await readyRequest(h);h.edit('Confirm public assistance request',true);h.click('Publish assistance request');}else{await readyAdoption(h,b);h.edit('Confirm human proposal adoption',true);h.click('Adopt agent proposal');}await h.until('Outcome unknown.');h.click('Retry original assistance operation');await h.until('Original publication confirmed.');assert.equal(posts(requests).length,2);assert.equal(posts(requests)[0].init.body,posts(requests)[1].init.body);assert(text(h.render()).includes('Current content unavailable.'));assert.equal(field(h.render(),'Reviewed agent proposal'),undefined);assert.equal(field(h.render(),'Held original operation'),undefined);
 }
});

test('current tombstones suppress authored intent and responses without cached content restoration',async()=>{
 for(const target of ['base','request','response']){
  const b=await fixture(),requests=server(b),h=harness({signedIn:false,selection:requestSelection(b)});await h.until(b.response.record.rationale);const oldReview=button(h.render(),'Review proposal '+b.response.id);b[target]=suppressed(b[target]);h.click('Refresh assistance');await h.until(tree=>!button(tree,'Review proposal '+b.response.id));oldReview.props.onClick();await h.flush();assert.equal(field(h.render(),'Reviewed agent proposal'),undefined);assert.equal(posts(requests).length,0);assert(!text(h.render()).includes('INVENTED a slower filter'));
 }
});

test('wrong response feed scope, repeated/newer cursor entries and foreign parents never paint a substituted page',async()=>{
 for(const fault of ['scope','duplicate','newer','foreign']){
  const b=await fixture(),first=await fullResponsePage(b),anchor=first.at(-1).id,older=await assistance({...m.assistanceCommandForRecord(b.response.record),id:'e0000000-1111-4111-8111-111111111111',requestId:uid(),rationale:'INVENTED older exact response'},agent,clocks.response);
  const requests=server(b,({path})=>{if(path==='/api/assistance?request='+b.request.id)return page(first,ref(b.request),anchor);if(path.startsWith('/api/assistance?cursor=')){const item=fault==='duplicate'?first.at(-1):fault==='newer'?{...older,createdAt:clocks.adoption}:fault==='foreign'?{...older,record:{...older.record,request:{id:uid(),digest:'a'.repeat(64)}}}:older;return page([item],fault==='scope'?{id:uid(),digest:b.request.digest}:ref(b.request));}}),h=harness({signedIn:false,selection:requestSelection(b)});await h.until(b.response.record.rationale);h.click('Earlier assistance records');await h.until('Current assistance references are unavailable or inconsistent.');assert(!text(h.render()).includes('INVENTED older exact response'));assert.equal(posts(requests).length,0);assert(requests.some(event=>event.path==='/api/assistance?cursor='+anchor));
 }
});

test('response cursor alone preserves its exact parent scope and accepted older ordering',async()=>{
 const b=await fixture(),first=await fullResponsePage(b),anchor=first.at(-1).id,older=await assistance({...m.assistanceCommandForRecord(b.response.record),id:'e0000000-1111-4111-8111-111111111111',requestId:uid(),rationale:'INVENTED accepted older response'},agent,clocks.response),requests=server(b,({path})=>path==='/api/assistance?request='+b.request.id?page(first,ref(b.request),anchor):path.startsWith('/api/assistance?cursor=')?page([older],ref(b.request)):undefined),h=harness({signedIn:false,selection:requestSelection(b)});await h.until(b.response.record.rationale);h.click('Earlier assistance records');await h.until(older.record.rationale);assert.equal(button(h.render(),'Earlier assistance records'),undefined);assert(button(h.render(),'Latest assistance records'));assert(!requests.some(event=>event.path.includes('cursor=')&&event.path.includes('request=')));h.click('Latest assistance records');await h.until(b.response.record.rationale);assert.equal(posts(requests).length,0);
});

test('selection changes guard pre-effect paint, captured callbacks and late reads without poisoning the new cache',async()=>{
 const a=await fixture(),b=await fixture();let finish;const held=new Promise(resolve=>finish=resolve),requests=server(a,({path})=>path==='/api/strategies?id='+a.base.id?held:path==='/api/strategies?id='+b.base.id?wrap(b.base):undefined),h=harness({signedIn:true,selection:baseSelection(a)});await h.flush();h.props.selection=baseSelection(b);assert(!text(h.render()).includes(a.base.record.content.name));await h.until(tree=>!!field(tree,'Assistance intent'));finish(wrap(a.base));await h.flush();assert.equal(field(h.render(),'Assistance exact base').props.href,'/strategies?id='+b.base.id+'&digest='+b.base.digest);assert(!text(h.render()).includes(a.base.id));assert.equal(posts(requests).length,0);
 const oldInput=field(h.render(),'Assistance intent');h.props.signedIn=false;assert.equal(field(h.render(),'Assistance intent'),undefined);oldInput.props.onChange({target:{value:'INVENTED stale draft'}});await h.flush();assert(!text(h.render()).includes('INVENTED stale draft'));assert.equal(posts(requests).length,0);
});

test('sign-out and unmount invalidate captured publication callbacks and original uncertain retries',async()=>{
 for(const action of ['signout','unmount']){
  const b=await fixture(),requests=server(b,({init})=>{if(init.method==='POST')throw Error('INVENTED unknown result');}),h=harness({signedIn:true,selection:baseSelection(b)});await readyRequest(h);h.edit('Confirm public assistance request',true);const stalePublish=button(h.render(),'Publish assistance request');h.click('Publish assistance request');await h.until('Outcome unknown.');const staleRetry=button(h.render(),'Retry original assistance operation');if(action==='signout'){walk(h.render(),n=>n.type==='a'&&label(n)==='Sign out')[0].props.onClick();await h.flush();assert.equal(field(h.render(),'Held original operation'),undefined);}else h.unmount();stalePublish.props.onClick();staleRetry.props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(posts(requests).length,1);
 }
});

test('duplicate-key, excessive and invalid read bodies fail generically without provider fallback or authored leakage',async()=>{
 for(const body of ['{"version":1,"version":1,"items":[],"request":null,"nextCursor":null,"executionEnabled":false}','x'.repeat(262145),'{"INVENTED secret reflected message":"not a wrapper"}']){
  const requests=server(null,()=>new Response(body,{status:200})),h=harness({signedIn:false});await h.until('Current assistance references are unavailable or inconsistent.');assert.equal(requests.length,1);assert(!text(h.render()).includes('INVENTED secret'));assert.equal(posts(requests).length,0);assert.equal(walk(h.render(),n=>n.type==='textarea').length,0);
 }
});

test('same-ID digest drift and lifecycle rollback fail closed instead of reviving a known current projection',async()=>{
 for(const fault of ['digest','lifecycle']){
  const b=await fixture(),requests=server(b),h=harness({signedIn:false,selection:baseSelection(b)});await h.until(b.base.record.content.name);if(fault==='digest'){b.base.record.content.name='INVENTED substituted exact base';b.base.digest=await m.strategyDigest(m.boundedStrategyRecord(b.base.record).payload);}else{const original=copy(b.base);b.base=suppressed(b.base);h.click('Refresh assistance');await h.until('This exact base is unavailable.');b.base=original;}h.click('Refresh assistance');await h.until('Current assistance references are unavailable or inconsistent.');assert.equal(field(h.render(),'Assistance exact base'),undefined);assert(!text(h.render()).includes('INVENTED substituted exact base'));assert.equal(posts(requests).length,0);
 }
});

test('invalid selected links make no read or writer calls',async()=>{const requests=server(null,()=>{throw Error('Forbidden');}),h=harness({signedIn:false,selection:null,selectionError:'Invalid assistance link.'});await h.until('Invalid assistance link.');assert.equal(requests.length,0);assert(button(h.render(),'Refresh assistance').props.disabled);});

test('server page validates exact one-of selection and forwards only the sign-in boolean',async()=>{
 const compiled=await build({entryPoints:['app/assistance/page.tsx'],bundle:true,format:'cjs',platform:'node',write:false,target:'es2022',jsx:'automatic',plugins:[{name:'route-stub',setup(b){b.onResolve({filter:/^\.\.\/(chatgpt-auth|assistance)$/},a=>a.importer.endsWith('/app/assistance/page.tsx')?{path:a.path,namespace:'route-stub'}:undefined);b.onLoad({filter:/.*/,namespace:'route-stub'},a=>({contents:a.path.includes('chatgpt-auth')?'export async function getChatGPTUser(){return globalThis.__assistanceRouteUser??null;}':'export default function Assistance(){return null;}',loader:'js',resolveDir:fileURLToPath(new URL('../app/',import.meta.url))}));}}]});const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);const b=await fixture();assert.deepEqual((await mod.exports.default()).props,{signedIn:false,selection:null,selectionError:''});for(const kind of ['BASE','REQUEST']){const item=kind==='BASE'?b.base:b.request,props=(await mod.exports.default({searchParams:Promise.resolve({[kind.toLowerCase()]:item.id,digest:item.digest})})).props;assert.deepEqual(props,{signedIn:false,selection:{kind,reference:ref(item)},selectionError:''});}for(const query of [{base:b.base.id},{request:b.request.id,digest:b.request.digest,unknown:'ignored?'},{base:[b.base.id,b.base.id],digest:b.base.digest},{base:b.base.id,request:b.request.id,digest:b.base.digest}]){const props=(await mod.exports.default({searchParams:Promise.resolve(query)})).props;assert.equal(props.selection,null);assert(props.selectionError.includes('Invalid assistance link.'));}globalThis.__assistanceRouteUser={id:'invented-private-user',email:'never forward'};assert.deepEqual((await mod.exports.default()).props,{signedIn:true,selection:null,selectionError:''});delete globalThis.__assistanceRouteUser;
});
