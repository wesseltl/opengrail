import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const native=createRequire(import.meta.url),cache=new Map();
export function loadLineageModule(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',code)(module,module.exports,path=>path.startsWith('.')?loadLineageModule(resolve(dirname(file),path.endsWith('.ts')?path:path+'.ts')):native(path));return module.exports;}
export const sm=loadLineageModule('app/strategy-model.ts'),lm=loadLineageModule('app/strategy-lineage-model.ts');
export const uid=()=>crypto.randomUUID(),ref=item=>({id:item.id,digest:item.digest}),relation=(item,type)=>({type,...ref(item)});
export const time=new Date(Date.now()-3_600_000).toISOString(),human=(userId=uid(),moderator=false)=>({kind:'HUMAN',userId,moderator});
export const publication=(extra={})=>({action:'publish',requestId:uid(),id:uid(),name:'Synthetic independent lineage source',description:'Invented test source; attribution does not establish working strategy performance.',assumptions:'Data, fees and future outcomes require separate evidence.',falsification:'Reject unverified causal or profitable performance claims.',sources:[],definition:sm.strategyTemplate('TREND'),relation:null,policyAccepted:'public-strategy-v1',...extra});
export const moderate=(item,state='HIDDEN')=>({action:'moderate',requestId:uid(),...ref(item),state,reason:state==='VISIBLE'?'RESTORED':'POLICY',policyAccepted:'public-strategy-v1'});
export async function lineageNode(extra={}){
 const authorId=await sm.strategyPublicHumanId('synthetic-lineage-author'),author={kind:'HUMAN',id:authorId,sponsorId:authorId},id=uid(),command=publication(extra.content??{}),record=sm.strategyRecordSchema.parse({version:1,id,rootId:id,revision:1,requestId:command.requestId,createdAt:time,author,content:{name:command.name,description:command.description,assumptions:command.assumptions,falsification:command.falsification,sources:command.sources,definition:command.definition,relation:command.relation},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false,...extra.record});
 return {id:record.id,digest:await sm.strategyDigest(JSON.stringify(record)),rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt:record.createdAt,author:sm.strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[],suppression:null,...extra.node};
}
export function lineagePage(anchor,extra={}){return {version:1,kind:'STRATEGY_LINEAGE_PAGE',reference:ref(anchor),anchor,parent:null,items:[],nextCursor:null,scope:'DIRECT_RELATIONS_ONLY',classification:'AUTHOR_REPORTED',verification:'UNTESTED',qualification:'NONE',independence:'NOT_ESTABLISHED',executionEnabled:false,ordersEnabled:false,...extra};}
