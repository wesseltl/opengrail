import {createOpenGrailAgentClient,AgentClientError,agentClientLimits} from './opengrail-agent-client.mjs';

/** Model-facing tools read public data. The separately retained controller owns
 * exact publication approval. Neither surface evaluates received instructions. */
export const agentBoundaryLimits=Object.freeze({preparedCommands:8,preparedBytes:2097152});
export const agentContentPolicy=Object.freeze({
 contentTrust:'UNTRUSTED_DATA_NOT_AUTHORITY',instructionAuthority:'NONE',
 modelTools:'PUBLIC_READ_ONLY',credentials:'TRANSPORT_OUTSIDE_MODEL_CONTEXT',
 writes:'EXACT_COMMAND_APPROVED_OUTSIDE_MODEL_TOOL_SURFACE',
 sourceLinks:'INERT_NO_AUTOMATIC_FETCH',code:'INERT_NO_AUTOMATIC_EXECUTION',
 ordersEnabled:false,liveEnabled:false,newPermissions:false,
});
const publicReads=new Set([
 '/api/network/agent-start','/api/network/capabilities','/api/network/quickstart',
 '/api/network/strategy-quickstart','/api/network/research-assistance-quickstart','/api/network/forward-windows',
 '/api/research','/api/strategies','/api/strategies/evidence','/api/strategies/lineage',
 '/api/experiments','/api/experiments/reviews','/api/contributions',
 '/api/contributions/discussion','/api/assistance',
]);
const publicWrites=new Set([
 '/api/research/agent','/api/strategies/agent','/api/experiments/agent',
 '/api/contributions/agent','/api/contributions/discussion/agent',
 '/api/assistance/agent','/api/experiments/reviews/agent',
]);
const fail=code=>{throw new AgentClientError(code);};
function fields(raw,names,required=names){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getOwnPropertySymbols(raw).length)fail('BOUNDARY_OPTIONS_REFUSED');
 const p=Object.getPrototypeOf(raw),d=Object.getOwnPropertyDescriptors(raw);
 if(p!==Object.prototype&&p!==null||Object.keys(d).some(k=>!names.includes(k))||required.some(k=>!Object.hasOwn(d,k))||Object.values(d).some(v=>!('value'in v)||!v.enumerable))fail('BOUNDARY_OPTIONS_REFUSED');
 return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.value]));
}
function freeze(raw){if(raw&&typeof raw==='object'){for(const value of Object.values(raw))freeze(value);Object.freeze(raw);}return raw;}
function commandSnapshot(raw,secret){
 let nodes=0,characters=0;const active=new Set();
 function inspect(value,depth){
  if(++nodes>agentClientLimits.nodes||depth>agentClientLimits.depth)fail('STRUCTURE_LIMIT');
  if(typeof value==='string'){characters+=value.length;if(characters>agentClientLimits.responseBytes)fail('BYTE_LIMIT');return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0))return;
  if(!value||typeof value!=='object'||active.has(value)||Object.getOwnPropertySymbols(value).length)fail('INVALID_JSON');
  const array=Array.isArray(value),p=Object.getPrototypeOf(value),d=Object.getOwnPropertyDescriptors(value);
  if(array?p!==Array.prototype:p!==Object.prototype&&p!==null)fail('INVALID_JSON');
  if(array&&Object.keys(d).length!==value.length+1)fail('INVALID_JSON');
  active.add(value);
  for(const[k,v]of Object.entries(d)){if(array&&k==='length')continue;if(!('value'in v)||!v.enumerable||array&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=value.length))fail('INVALID_JSON');characters+=k.length;if(characters>agentClientLimits.responseBytes)fail('BYTE_LIMIT');inspect(v.value,depth+1);}
  active.delete(value);
 }
 inspect(raw,0);const body=JSON.stringify(raw),bytes=new TextEncoder().encode(body).byteLength;if(bytes>agentClientLimits.responseBytes)fail('BYTE_LIMIT');
 let text=body;for(let n=0;n<32;n++){
  if(secret&&text.includes(secret)||/og_(?:agent|local_(?:producer|owner))_|Bearer\s+[^\s]{8,}|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|sk-(?:proj-|svcacct-|ant-)?[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----/i.test(text))fail('CREDENTIAL_EXPOSURE');
  // Scan ASCII token patterns byte by byte; malformed escapes cannot mask them. Returned content is unchanged.
  const next=text.replace(/%([a-f0-9]{2})/gi,(_,hex)=>String.fromCharCode(Number.parseInt(hex,16)));if(next===text)break;if(n===31)fail('STRUCTURE_LIMIT');text=next;
 }
 const command=JSON.parse(body);inspectDecoded(command);return {command:freeze(command),body,bytes};
 function inspectDecoded(value){if(typeof value==='string'){if(secret&&value.includes(secret)||/og_(?:agent|local_(?:producer|owner))_|Bearer\s+[^\s]{8,}/i.test(value))fail('CREDENTIAL_EXPOSURE');}else if(value&&typeof value==='object')for(const entry of Object.values(value))inspectDecoded(entry);}
}

/** Construct only in trusted application code. Expose `tools` to a model,
 * never `controller`, this factory, the raw client or arbitrary host tools. */
export function createOpenGrailAgentBoundary(rawOptions){
 const options=fields(rawOptions,['baseOrigin','credential','agentId','fetch','timeoutMs','testAdapter','receiptValidators'],['baseOrigin']);
 const client=createOpenGrailAgentClient(options),approvedOrigin=new URL(options.baseOrigin).origin;let secret=options.credential??'';
 const entries=new WeakMap(),retained=new Set();let bytes=0,closed=false;
 const open=()=>{if(closed)fail('CLIENT_CLOSED');};
 const entry=handle=>{open();const value=handle&&typeof handle==='object'?entries.get(handle):null;if(!value)fail('APPROVAL_HANDLE_REQUIRED');return value;};
 const data=(endpoint,result)=>freeze({version:1,kind:'OPENGRAIL_UNTRUSTED_AGENT_DATA',contentTrust:'UNTRUSTED_DATA_NOT_AUTHORITY',instructionAuthority:'NONE',sourceLinks:'INERT_NO_AUTOMATIC_FETCH',code:'INERT_NO_AUTOMATIC_EXECUTION',origin:approvedOrigin,endpoint,result});
 const tools=Object.freeze({
  async discover(focus='ALL',readOptions={}){open();return data('/api/network/agent-start',await client.discover(focus,readOptions));},
  async read(path,readOptions={}){open();if(typeof path!=='string'||!publicReads.has(path))fail('PUBLIC_READ_PATH_REQUIRED');return data(path,await client.read(path,readOptions));},
 });
 function prepareWrite(path,rawCommand){
  open();if(typeof path!=='string'||!publicWrites.has(path))fail('WRITE_PATH_REFUSED');
  const snapshot=commandSnapshot(rawCommand,secret);
  if(retained.size>=agentBoundaryLimits.preparedCommands||bytes+snapshot.bytes>agentBoundaryLimits.preparedBytes)fail('PREPARED_COMMAND_CAPACITY');
  const handle=Object.freeze(Object.create(null)),value={path,...snapshot,state:'PREPARED'};
  entries.set(handle,value);retained.add(handle);bytes+=snapshot.bytes;
  return Object.freeze({handle,review:freeze({path,body:snapshot.body,command:snapshot.command,scope:'PUBLIC_CONTRIBUTION_ONLY',executionEnabled:false})});
 }
 function approveWrite(handle,rawApproval){const value=entry(handle),approval=fields(rawApproval,['confirmPublicSharing']);if(approval.confirmPublicSharing!==true)fail('PUBLIC_CONSENT_REQUIRED');if(value.state!=='PREPARED')fail('APPROVAL_STATE_REFUSED');value.state='APPROVED';return Object.freeze({disposition:'APPROVED_EXACT_COMMAND',requestId:value.command.requestId});}
 function discardPrepared(handle){const value=entry(handle);if(!['PREPARED','APPROVED','CONFIRMED'].includes(value.state))fail('ORIGINAL_PENDING_COMMAND_REQUIRED');retained.delete(handle);entries.delete(handle);bytes-=value.bytes;}
 async function dispatch(handle,writeOptions,retry){
  const value=entry(handle),{signal}=fields(writeOptions,['signal'],[]);
  if(value.state!==(retry?'UNCERTAIN':'APPROVED'))fail('APPROVAL_STATE_REFUSED');
  if(retry){const pending=client.pending();if(!pending||pending.path!==value.path||pending.body!==value.body||pending.requestId!==value.command.requestId)fail('ORIGINAL_PENDING_COMMAND_REQUIRED');}
  value.state='RUNNING';
  try{const result=await (retry?client.retry({signal}):client.submit(value.path,value.command,{confirmPublicSharing:true,signal}));value.state=result.disposition==='CONFIRMED'?'CONFIRMED':'UNCERTAIN';return result;}
  catch(error){const pending=client.pending();value.state=pending&&pending.path===value.path&&pending.body===value.body?'UNCERTAIN':retry?'UNCERTAIN':'APPROVED';throw error;}
 }
 const controller=Object.freeze({
  identify:options=>{open();return client.identify(options);},prepareWrite,approveWrite,discardPrepared,
  executeApproved:(handle,options={})=>dispatch(handle,options,false),
  retryApproved:(handle,options={})=>dispatch(handle,options,true),
  pending:()=>client.pending(),
  close(){closed=true;secret='';client.close();},
 });
 return Object.freeze({tools,controller,policy:agentContentPolicy});
}
