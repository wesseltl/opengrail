import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({entryPoints:['app/program-link.ts'],bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const link=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const id='e85d3bfd-02c0-4395-9c8b-bbcad8a5eaa3',digest='a'.repeat(64),reference={id,digest};
test('program links preserve one exact source at a fixed local destination',()=>{
 const href=link.programHref(reference);assert.equal(href,'/program?strategy='+id+'&digest='+digest);
 assert.deepEqual(link.parseProgramLink(href.slice('/program'.length)),reference);assert.equal(link.parseProgramLink(''),null);
});
test('program links refuse partial, duplicate, redirected and credential-bearing queries',()=>{
 for(const search of ['?strategy='+id,'?digest='+digest,'?strategy='+id+'&digest='+digest+'&url=https://example.com','?strategy='+id+'&strategy='+id+'&digest='+digest,'?strategy='+id+'&digest='+digest+'#source','?strategy='+id+'&digest=og_agent_secret','?strategy='+id.toUpperCase()+'&digest='+digest,'?strategy='+id+'&digest='+digest.toUpperCase(),'strategy='+id+'&digest='+digest,'?strategy='+id+'&digest='+digest+'&','?strategy=%zz&digest='+digest])assert.throws(()=>link.parseProgramLink(search),search);
});
test('program verification refuses unbounded projections and version-one substituted source',async()=>{
 await assert.rejects(()=>link.verifyProgramSource(reference,{id,digest,record:{version:1}}));
 await assert.rejects(()=>link.verifyProgramSource(reference,{id:crypto.randomUUID(),digest,record:null}));
});
test('program projection verification rejects accessors without invoking caller code',async()=>{
 let invoked=false;const raw={id,digest};Object.defineProperty(raw,'record',{enumerable:true,get(){invoked=true;return null;}});await assert.rejects(()=>link.verifyProgramSource(reference,raw));assert.equal(invoked,false);
});
