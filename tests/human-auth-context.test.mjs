import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
let production,development;
const alice={userId:'synthetic-human-a',email:'alice@synthetic.test',fullName:'Alice Example',displayName:'Alice Example'};
const bob={userId:'synthetic-human-b',email:'bob@synthetic.test',fullName:null,displayName:'bob@synthetic.test'};
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
function headers(user){return user?new Headers({'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email,...(user.fullName?{'oai-authenticated-user-full-name':encodeURIComponent(user.fullName),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}:{})}):new Headers();}
async function load(dev){
 const result=await build({stdin:{contents:"export * from './lib/human-auth-context';export * from './app/chatgpt-auth';export {default as worker} from './build/sites-worker';export {getConnectorBinding} from './lib/connector-context';",resolveDir:process.cwd()},bundle:true,write:false,metafile:true,platform:'node',format:'cjs',target:'es2022',define:{'import.meta.env.DEV':String(dev)},plugins:[{name:'trusted-local-auth-fixture',setup(builder){builder.onResolve({filter:/^(vinext\/server\/fetch-handler|next\/navigation|next\/headers)$/},args=>({path:args.path,namespace:'auth-fixture'}));builder.onLoad({filter:/.*/,namespace:'auth-fixture'},args=>({contents:args.path==='vinext/server/fetch-handler'?"export default {fetch(request,env,ctx){return globalThis.__humanAuthHandler(request,env,ctx);}}":args.path==='next/navigation'?"export function redirect(location){const error=new Error('SYNTHETIC_REDIRECT');error.location=location;throw error;}":"export async function headers(){return new Headers({'oai-authenticated-user-id':'forged-header-user','oai-authenticated-user-email':'forged@synthetic.test'});}",loader:'js'}));}}]});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return {...module.exports,dependencies:Object.keys(result.metafile.inputs)};
}
before(async()=>{production=await load(false);development=await load(true);});
after(()=>{delete globalThis.__humanAuthHandler;});

test('the actual compatibility resolver has no header fallback outside trusted server context',async()=>{
 assert.equal(await production.getChatGPTUser(),null);assert.equal(production.getHumanAuthContext(),undefined);
 assert(!production.dependencies.some(path=>path.includes('next/headers')),'The actual resolver must not import untrusted request-header identity.');
 const input={kind:'SITES_DISPATCH',user:{...alice}};
 await production.runWithHumanAuthContext(input,async()=>{input.user.userId='changed-after-admission';assert.deepEqual(await production.getChatGPTUser(),alice);assert(Object.isFrozen(await production.getChatGPTUser()));});
 assert.equal(await production.getChatGPTUser(),null);
});

test('Sites snapshot parsing preserves stable IDs and optional decoded names while refusing ambiguous identity',async()=>{
 const named={...alice,fullName:'Laak, Wessel',displayName:'Laak, Wessel'};
 await production.runWithHumanAuthContext(production.sitesDispatchHumanContext(headers(named)),async()=>assert.deepEqual(await production.getChatGPTUser(),named));
 for(const patch of [{'oai-authenticated-user-full-name':'%E0%A4%A'},{'oai-authenticated-user-full-name':'%00'},{'oai-authenticated-user-full-name-encoding':'unknown-encoding'}]){
  const h=headers(alice);for(const [key,value]of Object.entries(patch))h.set(key,value);await production.runWithHumanAuthContext(production.sitesDispatchHumanContext(h),async()=>assert.deepEqual(await production.getChatGPTUser(),{...alice,fullName:null,displayName:alice.email}));
 }
 const cases=[new Headers(),new Headers({'oai-authenticated-user-id':'only-id'}),new Headers({'oai-authenticated-user-email':'only@synthetic.test'}),headers(alice),headers(alice),headers(alice),headers(alice),headers(alice)];
 cases[3].append('OAI-Authenticated-User-Id',bob.userId);cases[4].append('oai-authenticated-user-email',bob.email);cases[5].set('oai-authenticated-user-id','x'.repeat(257));cases[6].set('oai-authenticated-user-full-name','x'.repeat(8193));cases[7].append('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
 for(const h of cases)await production.runWithHumanAuthContext(production.sitesDispatchHumanContext(h),async()=>assert.equal(await production.getChatGPTUser(),null));
});

test('the same SELF_HOSTED request refreshes current validity after revocation and during an awaited lookup',async()=>{
 const entered=deferred(),release=deferred();let revoked=false,calls=0;
 await production.runWithHumanAuthContext({kind:'SELF_HOSTED',currentUser:async()=>{if(++calls===2){entered.resolve();await release.promise;}return revoked?null:{...alice};}},async()=>{
  assert.deepEqual(await production.getChatGPTUser(),alice);const current=production.getChatGPTUser();await entered.promise;revoked=true;release.resolve();assert.equal(await current,null);assert.equal(await production.getChatGPTUser(),null);assert.equal(calls,3);
 });
 assert.equal(production.getHumanAuthContext(),undefined);assert.equal(await production.getChatGPTUser(),null);
 await assert.rejects(production.runWithHumanAuthContext({kind:'SELF_HOSTED',currentUser:async()=>{throw Error('SYNTHETIC_SESSION_LOOKUP_UNAVAILABLE');}},()=>production.getChatGPTUser()),/SYNTHETIC_SESSION_LOOKUP_UNAVAILABLE/);
 assert.equal(await production.getChatGPTUser(),null,'Verifier failure cannot restore a header actor.');
});

test('actual Sites wrapper retains separate overlapping human and connector scopes through nested failures',async()=>{
 const entered=deferred(),releases=[deferred(),deferred(),deferred()],bindings=[{fixture:'A'},{fixture:'B'},undefined];let count=0;
 globalThis.__humanAuthHandler=async request=>{
  const n=Number(new URL(request.url).pathname.slice(1)),before=await production.getChatGPTUser(),connector=production.getConnectorBinding();if(++count===3)entered.resolve();await releases[n].promise;
  const after=await Promise.resolve().then(()=>production.getChatGPTUser());assert.deepEqual(after,before);assert.equal(production.getConnectorBinding(),connector);
  await assert.rejects(production.runWithHumanAuthContext({kind:'SITES_DISPATCH',user:bob},async()=>{await Promise.resolve();assert.deepEqual(await production.getChatGPTUser(),bob);assert.equal(production.getConnectorBinding(),connector);throw Error('SYNTHETIC_NESTED_FAILURE');}),/SYNTHETIC_NESTED_FAILURE/);
  assert.deepEqual(await production.getChatGPTUser(),before);return Response.json({user:before,connector:connector?.fixture??null});
 };
 const pending=[alice,bob,null].map((user,n)=>production.worker.fetch(new Request('https://synthetic-sites.test/'+n,{headers:headers(user)}),{}, {props:{CONNECTORS:bindings[n]}}));
 await entered.promise;assert.equal(await production.getChatGPTUser(),null);assert.equal(production.getConnectorBinding(),undefined);releases[2].resolve();releases[0].resolve();releases[1].resolve();
 const results=await Promise.all(pending);assert.deepEqual(await Promise.all(results.map(response=>response.json())),[{user:alice,connector:'A'},{user:bob,connector:'B'},{user:null,connector:null}]);assert.equal(await production.getChatGPTUser(),null);assert.equal(production.getConnectorBinding(),undefined);
 globalThis.__humanAuthHandler=async()=>{assert.deepEqual(await production.getChatGPTUser(),alice);throw Error('SYNTHETIC_HANDLER_FAILURE');};
 await assert.rejects(production.worker.fetch(new Request('https://synthetic-sites.test/failure',{headers:headers(alice)}),{}, {props:{}}),/SYNTHETIC_HANDLER_FAILURE/);assert.equal(await production.getChatGPTUser(),null);
});

test('Sites production ignores the development connector fallback and local preview preserves it without creating a human',async()=>{
 let calls=0;const preview={getContext:async()=>{calls++;return {status:'fixture_connected'};},invoke:async()=>({status:'fixture_invoked'})};
 globalThis.__humanAuthHandler=async()=>Response.json({human:await production.getChatGPTUser(),binding:production.getConnectorBinding()!==undefined});
 const ordinary=await production.worker.fetch(new Request('https://synthetic-sites.test/'),{CONNECTORS:preview},{props:{}});assert.deepEqual(await ordinary.json(),{human:null,binding:false});assert.equal(calls,0);
 globalThis.__humanAuthHandler=async()=>{const binding=development.getConnectorBinding();assert(binding);assert.equal(await development.getChatGPTUser(),null);return Response.json(await binding.getContext());};
 const local=await development.worker.fetch(new Request('http://localhost/'),{CONNECTORS:preview},{props:{}});assert.deepEqual(await local.json(),{status:'fixture_connected'});assert.equal(calls,1);assert.equal(await development.getChatGPTUser(),null);assert.equal(development.getConnectorBinding(),undefined);
});

test('unsupported context shapes and identity accessors cannot confer roles or bypass required sign-in',async()=>{
 for(const context of [{kind:'UNKNOWN',user:alice},{kind:'SELF_HOSTED',user:alice},{kind:'SELF_HOSTED',currentUser:async()=>alice,user:alice},{kind:'SITES_DISPATCH',user:{...alice,moderator:true}}])assert.throws(()=>production.runWithHumanAuthContext(context,()=>{}));
 let invoked=false;const user={...alice};Object.defineProperty(user,'userId',{enumerable:true,get(){invoked=true;return alice.userId;}});assert.throws(()=>production.runWithHumanAuthContext({kind:'SITES_DISPATCH',user},()=>{}));assert.equal(invoked,false);
 assert.throws(()=>production.runWithHumanAuthContext({kind:'SITES_DISPATCH',user:{...alice,[Symbol('synthetic-role')]:true}},()=>{}));
 await assert.rejects(production.runWithHumanAuthContext({kind:'SELF_HOSTED',currentUser:async()=>({...alice,maintainer:true})},()=>production.getChatGPTUser()));
 await production.runWithHumanAuthContext({kind:'SELF_HOSTED',currentUser:async()=>alice},async()=>assert.deepEqual(await production.requireChatGPTUser('/network'),alice));
 for(const target of ['https://foreign.test/','//foreign.test/','/callback','/signin-with-chatgpt','/signout-with-chatgpt'])await assert.rejects(production.requireChatGPTUser(target),error=>error.message==='SYNTHETIC_REDIRECT'&&error.location==='/signin-with-chatgpt?return_to=%2F');
 const target='/forward-windows?view=run#chart';assert.equal(production.chatGPTSignInPath(target),'/signin-with-chatgpt?return_to='+encodeURIComponent(target));assert.equal(production.chatGPTSignOutPath(target),'/signout-with-chatgpt?return_to='+encodeURIComponent(target));assert.equal(await production.getChatGPTUser(),null);
});
