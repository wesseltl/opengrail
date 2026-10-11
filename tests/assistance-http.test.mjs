import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './app/assistance-http';export * from './app/assistance-model';export {strategyDigest,strategyPublicHumanId} from './app/strategy-model';export {NetworkError} from './app/network-model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',target:'es2022',write:false});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const h=module.exports;
const uid=()=>crypto.randomUUID(),at='2026-10-11T12:00:00.000Z',origin='https://assistance-http.test',user='synthetic-human';
const authorId=await h.strategyPublicHumanId(user),author={kind:'HUMAN',id:authorId,sponsorId:authorId},agent={kind:'AGENT',id:uid(),sponsorId:authorId};
const requestCommand=()=>({action:'request',requestId:uid(),id:uid(),base:{id:uid(),digest:'1'.repeat(64)},intent:'Propose one explicit definition change.',constraints:'Preserve Demo and leverage one.',falsification:'Reject claims without independent evidence.',policyAccepted:'public-assistance-v1'});
const responseCommand=()=>({action:'respond',requestId:uid(),id:uid(),request:{id:uid(),digest:'2'.repeat(64)},proposal:{id:uid(),digest:'3'.repeat(64)},rationale:'Synthetic rationale.',questions:'',policyAccepted:'public-assistance-v1'});
async function receipt(command,actor=author){
 const full=actor.kind==='AGENT'?{...actor,name:'Synthetic registered agent'}:actor,record=h.assistanceRecordForCommand(command,full,at),digest=await h.strategyDigest(h.boundedAssistanceRecord(record).payload);
 return {version:1,action:command.action,requestId:command.requestId,item:{id:command.id,kind:record.kind,digest,requestId:command.requestId,createdAt:at,author:actor,state:'VISIBLE',reason:null,availability:'AVAILABLE',record,moderation:[]},report:null,executionEnabled:false};
}
const humanRequest=(raw,extra={},path='/api/assistance')=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Assistance-Intent':'submit','X-Assistance-Author':authorId,...extra},body:typeof raw==='string'?raw:JSON.stringify(raw)});
const invoke=(request,repo,actor={userId:user})=>h.assistanceHumanRequest(request,actor,()=>repo,()=>false,()=>at);
const goodRepo=result=>({write:async()=>result});

test('same-origin signed HUMAN publication freezes the expected public author before repository access',async()=>{
 const command=requestCommand(),result=await receipt(command);let calls=0;
 const response=await invoke(humanRequest(command),{write:async(actor,sent,time)=>{calls++;assert.deepEqual(actor,{kind:'HUMAN',userId:user,moderator:false});assert.deepEqual(sent,command);assert.equal(time,at);return result;}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),result);assert.equal(calls,1);
 for(const extra of [{Origin:'https://foreign.test'},{Origin:''},{'X-Assistance-Intent':''},{'X-Assistance-Author':''},{'X-Assistance-Author':'human_'+'f'.repeat(64)},{'X-Assistance-Author':authorId.toUpperCase()}]){
  const refused=await invoke(humanRequest(command,extra),{write:async()=>{calls++;throw Error();}});assert.equal(refused.status,403);
 }
 assert.equal((await invoke(humanRequest(command),goodRepo(result),{userId:'switched-account'})).status,403);
 assert.equal((await invoke(humanRequest(command),goodRepo(result),null)).status,401);assert.equal(calls,1);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization');
});

test('bounded streamed UTF-8, duplicate keys, strict canonical text and unknown authority fail before writes',async()=>{
 const command=requestCommand();let calls=0;const repo={write:async()=>{calls++;throw Error();}};
 const duplicate=JSON.stringify(command).replace('"intent":"Propose one explicit definition change."','"intent":"first","intent":"second"');
 for(const raw of [duplicate,{...command,author},{...command,moderator:true},{...command,scope:'ADMIN'},'{"x":'+('['.repeat(15))+'0'+(']'.repeat(15))+'}',{...command,intent:' leading whitespace'},{...command,constraints:'trailing whitespace '},{...command,intent:'og_local_owner_example'},{...command,intent:'%256f%2567%255f%2561%2567%2565%256e%2574%255fexample'}])assert.equal((await invoke(humanRequest(raw),repo)).status,400);
 assert.equal((await invoke(humanRequest(' '.repeat(h.assistanceLimits.requestBytes+1)),repo)).status,413);
 assert.equal((await invoke(humanRequest(command,{'Content-Type':'text/plain'}),repo)).status,415);
 const invalid=new Request(origin+'/api/assistance',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Assistance-Intent':'submit','X-Assistance-Author':authorId},body:new Uint8Array([123,34,120,34,58,34,255,34,125])});
 assert.equal((await invoke(invalid,repo)).status,400);assert.equal(calls,0);
});

test('streamed body byte admission stops at the fixed bound and releases the canceled reader',async()=>{
 let chunks=0,canceled=false;const body=new ReadableStream({pull(controller){chunks++;controller.enqueue(new Uint8Array(h.assistanceLimits.requestBytes));},cancel(){canceled=true;}});
 const request=new Request(origin+'/api/assistance',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Assistance-Intent':'submit','X-Assistance-Author':authorId},body,duplex:'half'});
 let writes=0;const response=await invoke(request,{write:async()=>{writes++;throw Error();}});assert.equal(response.status,413);assert(canceled);assert(chunks<=3);assert.equal(writes,0);assert.equal(request.body.locked,false);
});

test('identity uses the existing strict strategy identity envelope and rejects methods or selectors',async()=>{
 const request=new Request(origin+'/api/assistance/me');assert.equal((await h.assistanceMeRequest(request,null,()=>false)).status,401);
 const response=await h.assistanceMeRequest(request,{userId:user},()=>false);assert.equal(response.status,200);assert.deepEqual(await response.json(),{version:1,authorId,sponsorId:authorId,moderator:false,executionEnabled:false});
 assert.equal((await h.assistanceMeRequest(new Request(origin+'/api/assistance/me?token=never-echo-secret'),{userId:user},()=>false)).status,400);
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])assert.equal((await h.assistanceMeRequest(new Request(origin+'/api/assistance/me',{method}),null,()=>false)).status,405);
});

test('public selectors are bounded unique exact UUIDs, no queries disclose attacker material',async()=>{
 let calls=0;const factory=()=>{calls++;throw Error();};
 for(const query of ['?token=never-echo-secret','?id='+uid()+'&id='+uid(),'?request='+uid()+'&cursor='+uid(),'?id=INVALID','?cursor=', '?cursor='+('0'.repeat(10000)), '?request='+uid().toUpperCase()]){
  const response=await h.assistancePublicRequest(new Request(origin+'/api/assistance'+query),factory);assert.equal(response.status,400);assert(!(await response.text()).includes('never-echo-secret'));
 }
 assert.equal(calls,0);
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])assert.equal((await h.assistancePublicRequest(new Request(origin+'/api/assistance',{method}),factory)).status,405);
 const command=requestCommand(),result=await receipt(command),repo={get:async()=>({version:1,item:result.item,executionEnabled:false}),list:async(cursor,request)=>{assert.equal(cursor,null);assert.equal(request,null);return {version:1,request:null,items:[result.item],nextCursor:null,executionEnabled:false};}};
 assert.equal((await h.assistancePublicRequest(new Request(origin+'/api/assistance?id='+command.id),()=>repo)).status,200);
 assert.equal((await h.assistancePublicRequest(new Request(origin+'/api/assistance'),()=>repo)).status,200);
 assert.equal((await h.assistancePublicRequest(new Request(origin+'/api/assistance?id='+uid()),()=>repo)).status,503);
});

test('full available or redacted receipt correlation rejects changed commands, actors, refs and correctly rehashed content',async()=>{
 const command=requestCommand(),good=await receipt(command),cases=[];
 for(const change of [value=>{value.requestId=uid();},value=>{value.item.id=uid();},value=>{value.item.digest='0'.repeat(64);},value=>{value.item.requestId=uid();}]){const bad=structuredClone(good);change(bad);cases.push(bad);}
 for(const change of [record=>{record.intent='Changed intent';},record=>{record.constraints='Changed constraints';},record=>{record.falsification='Changed rejection criteria';},record=>{record.base.id=uid();},record=>{record.base.digest='0'.repeat(64);},record=>{record.author.id='human_'+'f'.repeat(64);record.author.sponsorId=record.author.id;}]){
  const bad=structuredClone(good);change(bad.item.record);bad.item.author={...bad.item.record.author};bad.item.digest=await h.strategyDigest(h.boundedAssistanceRecord(bad.item.record).payload);cases.push(bad);
 }
 for(const bad of cases)assert.equal((await invoke(humanRequest(command),goodRepo(bad))).status,503);
 const tombstone=structuredClone(good);tombstone.item.availability='DEPENDENCY_UNAVAILABLE';tombstone.item.record=null;
 assert.deepEqual(await h.correlateAssistanceWrite(tombstone,command,author),tombstone);
 const bad=structuredClone(tombstone);bad.item.digest='f'.repeat(64);await assert.rejects(h.correlateAssistanceWrite(bad,command,author));
 const sent=responseCommand(),accepted=await receipt(sent,agent);await h.correlateAssistanceWrite(accepted,sent,agent,'Synthetic registered agent');
 for(const key of ['request','proposal']){const changed=structuredClone(accepted);changed.item.record[key].digest='f'.repeat(64);changed.item.digest=await h.strategyDigest(h.boundedAssistanceRecord(changed.item.record).payload);await assert.rejects(h.correlateAssistanceWrite(changed,sent,agent,'Synthetic registered agent'));}
 await assert.rejects(h.correlateAssistanceWrite(accepted,sent,agent,'Other agent'));
});

test('private report receipts never contain details/reporter, and only explicit human moderators can read the queue',async()=>{
 const target=await receipt(requestCommand()),command={action:'report',requestId:uid(),id:target.item.id,digest:target.item.digest,reason:'OTHER',details:'Private synthetic investigation detail',policyAccepted:'public-assistance-v1'},report={requestId:command.requestId,id:command.id,digest:command.digest,reason:command.reason,createdAt:at},result={version:1,action:'report',requestId:command.requestId,item:null,report,executionEnabled:false};
 const response=await invoke(humanRequest(command),goodRepo(result));assert.equal(response.status,200);const raw=await response.text();assert(!raw.includes(command.details));assert(!raw.includes('reporter'));
 assert.equal((await invoke(humanRequest(command),goodRepo({...result,report:{...report,details:command.details}}))).status,503);
 const req=new Request(origin+'/api/assistance/reports'),repo={reports:async actor=>{assert.equal(actor.moderator,true);return {version:1,reports:[{...report,details:command.details,reporter:author}],nextCursor:null,executionEnabled:false};}};
 assert.equal((await h.assistanceReportsRequest(req,null,()=>repo,()=>true)).status,401);
 assert.equal((await h.assistanceReportsRequest(req,{userId:user},()=>repo,()=>false)).status,403);
 const queue=await h.assistanceReportsRequest(req,{userId:user},()=>repo,()=>true,()=>at);assert.equal(queue.status,200);assert((await queue.text()).includes(command.details));
 for(const query of ['?cursor='+uid(),'?token=never-echo-secret','?cursor='+'a'.repeat(64)+'&cursor='+'b'.repeat(64)])assert.equal((await h.assistanceReportsRequest(new Request(origin+'/api/assistance/reports'+query),{userId:user},()=>repo,()=>true)).status,400);
});

test('HTTPS Bearer-only machine boundary checks registry principal and refuses human authority',async()=>{
 const sent=responseCommand(),good=await receipt(sent,agent),credentialId=uid(),token='og_agent_'+credentialId+'.'+'a'.repeat(64),principal={agentId:agent.id,ownerId:user,credentialId,name:'Synthetic registered agent'},req=(url=origin+'/api/assistance/agent',extra={})=>new Request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(sent)});
 let writes=0;const repo={write:async(actor,command)=>{writes++;assert.equal(actor.kind,'AGENT');assert.deepEqual(command,sent);return good;}},registry=()=>({authenticate:async()=>principal});
 assert.equal((await h.assistanceAgentRequest(req(),()=>repo,registry,()=>at)).status,200);assert.equal(writes,1);
 assert.equal((await h.assistanceAgentRequest(req('http://assistance-http.test/api/assistance/agent'),()=>repo,registry)).status,403);
 assert.equal((await h.assistanceAgentRequest(req(origin+'/api/assistance/agent?token=never-echo-secret'),()=>repo,registry)).status,400);
 for(const extra of [{Authorization:''},{Authorization:token},{Authorization:'Basic '+token}])assert.equal((await h.assistanceAgentRequest(req(undefined,extra),()=>repo,registry)).status,401);
 assert.equal((await h.assistanceAgentRequest(req(undefined,{Origin:'https://foreign.test'}),()=>repo,registry)).status,403);
 assert.equal((await h.assistanceAgentRequest(req(),()=>repo,()=>({authenticate:async()=>({...principal,credentialId:uid()})}))).status,503);
 const revoked=await h.assistanceAgentRequest(req(),()=>repo,()=>({authenticate:async()=>{throw new h.NetworkError('Never echo registry private details',401);}}));assert.equal(revoked.status,401);assert.equal(revoked.headers.get('WWW-Authenticate'),'Bearer');assert(!(await revoked.text()).includes('private details'));
 assert.equal(writes,1);
 assert.equal((await invoke(humanRequest(sent),()=>repo)).status,403);
 const machineRequest=new Request(origin+'/api/assistance/agent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(requestCommand())});assert.equal((await h.assistanceAgentRequest(machineRequest,()=>repo,registry)).status,403);
});
