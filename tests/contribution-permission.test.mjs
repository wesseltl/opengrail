import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(m,m.exports,id=>id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id));return m.exports;}
const {contributionMaintainerAllowed}=load('app/contribution-permission.ts');
test('coordination maintainer authority is absent by default and uses its own explicit human configuration',()=>{
 for(const configuration of [undefined,null,'','[]'])assert.equal(contributionMaintainerAllowed('participant',configuration),false);
 assert.equal(contributionMaintainerAllowed('participant','["participant"]'),true);
 assert.equal(contributionMaintainerAllowed('agent','["participant"]'),false);
 const source=readFileSync('app/contribution-config.ts','utf8');
 assert(source.includes('CONTRIBUTION_MAINTAINER_USER_IDS'));
 for(const other of ['RESEARCH_MODERATOR_USER_IDS','EXPERIMENT_REVIEWER_USER_IDS','getChatGPTUser','NetworkRepository'])assert(!source.includes(other));
 assert(!readFileSync('.openai/hosting.json','utf8').includes('CONTRIBUTION_MAINTAINER_USER_IDS'));
});
test('invalid, duplicate, excessive and nonstring maintainer configuration fails closed',()=>{
 for(const configuration of [true,{},'{}','[1]','[""]','["bad\\u0000id"]','["person","person"]','["person"',JSON.stringify(['x'.repeat(257)]),JSON.stringify(Array.from({length:17},(_,i)=>'person'+i)),' '.repeat(4097)+'[]'])assert.throws(()=>contributionMaintainerAllowed('person',configuration),error=>error.status===503);
 assert.equal(contributionMaintainerAllowed('person',JSON.stringify(Array.from({length:16},(_,i)=>'person'+i))),false);
});
