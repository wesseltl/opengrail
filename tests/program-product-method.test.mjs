import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

// Real server route decision code, with only local authentication/component stubs.
// This does not exercise or claim hosted OAuth, layout or native browser storage.
const stubs={
 './search-workspace':'RulesSearch','./program-search-method-workspace':'ProgramsSearch',
 './program-forward-planner':'LegacyPlanner','./program-direction-forward-planner':'DirectionPlanner','./program-window-planner':'SampledPlanner',
 './session':'RulesSession','./program-session-workspace':'LegacySession','./program-direction-session-workspace':'DirectionSession',
};
const compiled=await build({stdin:{contents:"export {default as Search} from './app/search/page';export {default as Plans} from './app/plans/page';export {default as Session} from './app/session/page';export * from './app/program-product-method';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022',jsx:'automatic',plugins:[{name:'local-method-route-stubs',setup(b){
 b.onResolve({filter:/^\.\.\//},args=>{const key='./'+args.path.slice(3);if(key==='./chatgpt-auth')return{path:'auth',namespace:'stub'};if(stubs[key])return{path:stubs[key],namespace:'stub'};});
 b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='auth'?'export const getChatGPTUser=async()=>({id:"synthetic-local-human"});':`export default function ${args.path}(){return null;}`,loader:'js'}));
}}]});
const require=createRequire(import.meta.url),module={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);const m=module.exports;
const route=(page,query)=>m[page]({searchParams:Promise.resolve(query)});
test('route defaults preserve legacy Rules/Programs choices and explicitly retain the V2 method through all three workspaces',async()=>{
 assert.equal((await route('Search',{})).type.name,'RulesSearch');
 let view=await route('Search',{method:'programs'});assert.equal(view.type.name,'ProgramsSearch');assert.equal(view.props.initialMethod,'LEGACY');
 view=await route('Search',{method:'programs',selection:'direction-matched-v2'});assert.equal(view.type.name,'ProgramsSearch');assert.equal(view.props.initialMethod,'DIRECTION');assert.equal(view.props.signedIn,true);
 assert.equal((await route('Plans',{})).type.name,'LegacyPlanner');assert.equal((await route('Plans',{selection:'direction-matched-v2'})).type.name,'DirectionPlanner');
 assert.equal((await route('Session',{})).type.name,'RulesSession');assert.equal((await route('Session',{method:'programs'})).type.name,'LegacySession');assert.equal((await route('Session',{method:'programs',selection:'direction-matched-v2'})).type.name,'DirectionSession');
});
test('unknown, repeated or incoherent method choices refuse instead of falling through to a legacy or executable workspace',async()=>{
 for(const selection of ['v2','legacy-v2','',null,['direction-matched-v2'],['direction-matched-v2','direction-matched-v2']])for(const page of ['Search','Plans','Session'])assert.equal((await route(page,{method:'programs',selection})).type,'main');
 for(const page of ['Search','Session'])for(const query of [{selection:'direction-matched-v2'},{method:'rules',selection:'direction-matched-v2'},{method:['programs'],selection:'direction-matched-v2'},{method:'unknown'}])assert.equal((await route(page,query)).type,'main');
 assert.equal(m.programProductMethod(undefined),'LEGACY');assert.equal(m.programProductMethod('direction-matched-v2'),'DIRECTION');
});
test('exact published cohort links reach only the V2 Programs draft, with no sources, data or execution authority in the route',async()=>{
 const source={id:'036a0000-0000-4000-8000-000000000001',digest:'a'.repeat(64)},query={method:'programs',selection:'direction-matched-v2',strategy:source.id,digest:source.digest};
 const view=await route('Search',query);assert.equal(view.type.name,'ProgramsSearch');assert.equal(view.props.initialMethod,'DIRECTION');assert.deepEqual(view.props.initialStrategy,source);
 for(const bad of [{...query,strategy:[source.id,source.id]},{...query,digest:[source.digest]},{...query,digest:undefined},{...query,strategy:source.id.toUpperCase()},{...query,digest:'A'.repeat(64)},{...query,selection:undefined},{...query,method:undefined},{...query,method:'rules'},{...query,extra:'unrelated'},{...query,dataset:'caller-data'},{...query,permission:'AUTHORIZED_USE'}])assert.equal((await route('Search',bad)).type,'main');
 assert.equal((await route('Search',{})).type.name,'RulesSearch');assert.equal((await route('Search',{method:'programs'})).props.initialStrategy,undefined);
});
test('sampled windows require one exact separate route choice and preserve the existing planners',async()=>{
 const view=await route('Plans',{window:'sampled-v1'});
 assert.equal(view.type.name,'SampledPlanner');assert.deepEqual(view.props,{signedIn:true});
 for(const window of ['sampled-v2','',null,['sampled-v1'],['sampled-v1','sampled-v1']])assert.equal((await route('Plans',{window})).type,'main');
 for(const selection of ['direction-matched-v2','',null,['direction-matched-v2']])assert.equal((await route('Plans',{window:'sampled-v1',selection})).type,'main');
 assert.equal((await route('Plans',{})).type.name,'LegacyPlanner');
 assert.equal((await route('Plans',{selection:'direction-matched-v2'})).type.name,'DirectionPlanner');
});
