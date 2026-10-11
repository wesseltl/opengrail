import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeGithubReader,githubReadLimits} from '../scripts/contribution-github-read.mjs';

const path='/repos/example/opengrail/pulls/7';
const fixture=()=>Response.json({id:7});
test('public GitHub reader uses only credential-free GET with fixed origin and bounded timeout',async()=>{
 const calls=[];const r=makeGithubReader({fetch:async(...args)=>{calls.push(args);return fixture();}});assert.deepEqual(await r.get(path),{id:7});
 assert.equal(calls[0][0],'https://api.github.com'+path);assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][1].redirect,'error');assert.equal(calls[0][1].cache,'no-store');assert(!('Authorization'in calls[0][1].headers));assert(calls[0][1].signal instanceof AbortSignal);assert.deepEqual(r.statistics(),{requests:1,bytes:8});
});
test('public reader rejects external origins, URL credentials, encoded paths and traversal before fetch',async()=>{
 let calls=0;const r=makeGithubReader({fetch:async()=>{calls++;return fixture();}});
 for(const input of ['https://example.com/','https://secret@api.github.com/repos/a/b',path+'#secret','/repos/a/b/../secrets','/repos/a/b/%2e%2e',path+'\\hidden','/orgs/a'])await assert.rejects(r.get(input),/INVALID_GITHUB_PATH/);assert.equal(calls,0);
});
test('403, 429, missing resources and redirects retain unavailable rather than retrying',async()=>{
 for(const status of [403,429,404,302,500]){let calls=0;const r=makeGithubReader({fetch:async()=>{calls++;return new Response('untrusted detail',{status});}});await assert.rejects(r.get(path),/GITHUB_(?:RATE_OR_ACCESS_LIMIT|RESOURCE_UNAVAILABLE|RESPONSE_UNAVAILABLE)/);assert.equal(calls,1);}
});
test('response type, invalid UTF-8, duplicates and declared byte capacity fail closed',async()=>{
 for(const response of [new Response('html',{headers:{'Content-Type':'text/html'}}),new Response(new Uint8Array([255]),{headers:{'Content-Type':'application/json'}}),new Response('{"id":7,"id":8}',{headers:{'Content-Type':'application/json'}}),new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(githubReadLimits.responseBytes+1)}})])await assert.rejects(makeGithubReader({fetch:async()=>response}).get(path));
});
test('streamed byte capacity cancels the reader even without a Content-Length',async()=>{
 let cancelled=false;const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(githubReadLimits.responseBytes+1));},cancel(){cancelled=true;}});
 await assert.rejects(makeGithubReader({fetch:async()=>new Response(body,{headers:{'Content-Type':'application/json'}})}).get(path),/GITHUB_RESPONSE_BYTE_LIMIT/);assert(cancelled);
});
test('finite GET attempt budget includes rejected reads and never adds a retry',async()=>{
 let calls=0;const r=makeGithubReader({fetch:async()=>{calls++;return fixture();}});for(let i=0;i<githubReadLimits.requests;i++)await r.get(path);await assert.rejects(r.get(path),/READ_REQUEST_LIMIT/);assert.equal(calls,githubReadLimits.requests);
});
test('caller interruption and actual clock regression stop before a new fetch',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;await assert.rejects(makeGithubReader({signal:controller.signal,fetch:async()=>{calls++;return fixture();}}).get(path),/INTERRUPTED/);
 let at=100;const r=makeGithubReader({now:()=>at,fetch:async()=>{calls++;return fixture();}});at=99;await assert.rejects(r.get(path),/CLOCK_REGRESSION/);assert.equal(calls,0);
});
test('total elapsed collection time cannot be reset by issuing a new read',async()=>{
 let at=100;let calls=0;const r=makeGithubReader({now:()=>at,fetch:async()=>{calls++;return fixture();}});await r.get(path);at+=githubReadLimits.totalMs+1;await assert.rejects(r.get(path),/READ_TIME_LIMIT/);assert.equal(calls,1);
});
