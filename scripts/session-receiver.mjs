import {createServer} from 'node:http';
import {openSync,closeSync,fstatSync,readSync,readFileSync,writeFileSync,fsyncSync,constants,mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {receiverLimits,receiverHashesSchema,ReceiverError,sha,parseReceiverHashes,receiverAuthorization,receiverOrigin,receiverSessionId,receiverInstance,receiverSessionInstance,receiverNoSecrets,receiverRoute,receiverEvent,receiverReceipt,receiverState,receiverReady,receiverAcknowledgment} from './session-receiver-protocol.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
let temporary,child,server,confirmed,diskDigest,hashFileDigest,hashPath,journalPath,hashes,m,port,stopped=false,shuttingDown=false,pending=null,queue=[],working=false;
const sockets=new Set();let readWindow=0,readCount=0,rejectionWindow=0,rejectionCount=0;
function readBounded(path,maximum,privateFile=false){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>maximum||privateFile&&((stat.mode&0o777)!==0o600||process.getuid&&stat.uid!==process.getuid()))throw new ReceiverError('INVALID_LOCAL_FILE');
  const bytes=Buffer.alloc(Math.min(stat.size+1,maximum+1));let size=0;for(;;){const n=readSync(fd,bytes,size,bytes.length-size,null);if(!n)break;size+=n;if(size===bytes.length)throw new ReceiverError('INVALID_LOCAL_FILE');}return bytes.subarray(0,size);
 }finally{closeSync(fd);}
}
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
function json(res,status,value){if(res.destroyed||res.writableEnded)return;if(status<400&&stopped){status=503;value={version:1,error:'UNCONFIRMED',confirmed:false,ordersEnabled:false};}const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':Buffer.byteLength(body)});res.end(body);}
function reject(res,error){const safe=error instanceof ReceiverError?error:new ReceiverError('UNCONFIRMED',503);json(res,safe.status,{version:1,error:safe.code,confirmed:false,ordersEnabled:false});}
async function modules(){
 const result=await build({stdin:{contents:"export {parseUniqueJson} from './app/unique-json';export {boundedSessionConfig,boundedSessionEvent,sessionLimits} from './app/session-model';export {verifySessionJournal,sessionJournalLimits} from './app/session-journal';export {sessionPositionMark} from './app/session-engine';export {sessionSourceFingerprints} from './app/session-fingerprints';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
 temporary=mkdtempSync(join(tmpdir(),'opengrail-session-receiver-'));const path=join(temporary,'fixed-protocol.mjs');writeFileSync(path,result.outputFiles[0].text,{flag:'wx',mode:0o600});
 const loaded=await import(pathToFileURL(path).href);for(const [key,path]of Object.entries({engine:'app/session-engine.ts',model:'app/session-model.ts',journal:'app/session-journal.ts'}))if(sha(readFileSync(join(project,path)))!==loaded.sessionSourceFingerprints[key])throw new ReceiverError('INVALID_FIXED_SOURCE');return loaded;
}
async function journal(bytes){const text=decode(bytes),raw=m.parseUniqueJson(text,m.sessionJournalLimits.bytes,24);receiverNoSecrets(raw);const value=await m.verifySessionJournal(raw);if(JSON.stringify(value)!==text)throw new ReceiverError('UNCONFIRMED',503);return value;}
function healthy(){if(stopped||shuttingDown)throw new ReceiverError('UNCONFIRMED',503);}
function unchangedHashes(){if(sha(readBounded(hashPath,receiverLimits.hashBytes,true))!==hashFileDigest)throw new ReceiverError('UNCONFIRMED',503);}
async function current(){healthy();unchangedHashes();const bytes=readBounded(journalPath,m.sessionJournalLimits.bytes,true);if(sha(bytes)!==diskDigest)throw new ReceiverError('UNCONFIRMED',503);const value=await journal(bytes);healthy();unchangedHashes();if(sha(readBounded(journalPath,m.sessionJournalLimits.bytes,true))!==diskDigest||value.journalDigest!==confirmed.journalDigest||value.state.stateDigest!==confirmed.state.stateDigest)throw new ReceiverError('UNCONFIRMED',503);return value;}
function failStop(){if(stopped)return;stopped=true;process.exitCode=1;if(pending){clearTimeout(pending.timer);pending.reject(new ReceiverError('UNCONFIRMED',503));pending=null;}for(const item of queue)reject(item.res,new ReceiverError('UNCONFIRMED',503));queue=[];if(child&&!child.killed)child.kill('SIGTERM');process.stderr.write('Local Demo receiver stopped without a confirmed acknowledgment. Preserve the journal and reconcile before retrying.\n');setImmediate(()=>{void shutdown();});}
function awaitLine(timeout=receiverLimits.childMs){healthy();if(pending)throw new ReceiverError('UNCONFIRMED',503);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending=null;reject(new ReceiverError('UNCONFIRMED',503));failStop();},timeout);pending={resolve,reject,timer};});}
function childLines(stream){let parts=[],size=0;stream.on('data',chunk=>{let start=0;while(start<chunk.length){const newline=chunk.indexOf(10,start),end=newline<0?chunk.length:newline,part=chunk.subarray(start,end);size+=part.length;if(size>receiverLimits.lineBytes){failStop();return;}parts.push(part);if(newline>=0){try{const raw=m.parseUniqueJson(decode(Buffer.concat(parts)),receiverLimits.lineBytes,8);if(!pending)throw Error();const waiter=pending;pending=null;clearTimeout(waiter.timer);waiter.resolve(raw);}catch{failStop();}parts=[];size=0;start=end+1;}else start=end;}});stream.on('error',failStop);}
async function begin(command,config){
 const ready=awaitLine(receiverLimits.startupMs);child=spawn(process.execPath,[join(project,'scripts/session-runtime.mjs'),...(command==='start'?['start',config,journalPath]:['resume',journalPath])],{cwd:project,env:{PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
 childLines(child.stdout);child.stdin.on('error',failStop);let stderrBytes=0;child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>receiverLimits.lineBytes)failStop();});child.on('error',failStop);child.on('exit',()=>{if(!shuttingDown)failStop();});
 const raw=await ready;healthy();const bytes=readBounded(journalPath,m.sessionJournalLimits.bytes,true);confirmed=await journal(bytes);healthy();receiverReady(raw,confirmed);diskDigest=sha(bytes);unchangedHashes();
}
async function body(req){
 if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(uniqueHeader(req,'content-type')??''))throw new ReceiverError('INVALID_REQUEST');const claimed=uniqueHeader(req,'content-length');if(claimed!==undefined&&(!/^\d+$/.test(claimed)||Number(claimed)>receiverLimits.bodyBytes))throw new ReceiverError('BODY_LIMIT',413);
 const chunks=[];let size=0;try{for await(const chunk of req){size+=chunk.length;if(size>receiverLimits.bodyBytes)throw new ReceiverError('BODY_LIMIT',413);chunks.push(chunk);}}catch(error){throw error instanceof ReceiverError?error:new ReceiverError('INVALID_REQUEST');}try{return decode(Buffer.concat(chunks));}catch{throw new ReceiverError('INVALID_REQUEST');}
}
function uniqueHeader(req,name){let count=0;for(let n=0;n<req.rawHeaders.length;n+=2)if(req.rawHeaders[n].toLowerCase()===name)count++;if(count>1)throw new ReceiverError('INVALID_REQUEST');return req.headers[name];}
function readBudget(){const now=Date.now();if(now-readWindow>=60000){readWindow=now;readCount=0;}if(++readCount>receiverLimits.readPerMinute)throw new ReceiverError('READ_LIMIT',429);}
function rejectionBudget(){const now=Date.now();if(now-rejectionWindow>=60000){rejectionWindow=now;rejectionCount=0;}return ++rejectionCount<=receiverLimits.rejectionsPerMinute;}
async function drain(){
 if(working)return;working=true;try{while(queue.length&&!stopped){const item=queue.shift();try{
  if(item.read){const value=await current();if(item.route==='RECEIPT')json(item.res,200,receiverReceipt(value,item.id,item.role));else if(item.route==='STATE')json(item.res,200,receiverState(value,m));else json(item.res,200,value);continue;}
  const prior=await current(),existing=prior.events.find(v=>v.event.requestId===item.event.requestId);if(existing&&JSON.stringify(existing.event)!==JSON.stringify(item.event))throw new ReceiverError('CONFLICT',409);
  if(!existing&&(prior.events.length>=m.sessionJournalLimits.events||!['QUOTE','EMERGENCY'].includes(item.event.type)&&prior.events.length>=m.sessionLimits.events))throw new ReceiverError('CAPACITY_LIMIT',429);
  const receipt=awaitLine();healthy();child.stdin.write(JSON.stringify(item.event)+'\n');const raw=await receipt;healthy();unchangedHashes();const bytes=readBounded(journalPath,m.sessionJournalLimits.bytes,true),next=await journal(bytes);healthy();unchangedHashes();if(sha(readBounded(journalPath,m.sessionJournalLimits.bytes,true))!==sha(bytes))throw new ReceiverError('UNCONFIRMED',503);const response=receiverAcknowledgment(raw,item.event,prior,next,m);
  confirmed=next;diskDigest=sha(bytes);json(item.res,200,response);
 }catch(error){reject(item.res,error);if(!(error instanceof ReceiverError)||error.status>=500)failStop();}}
 }finally{working=false;}
}
async function request(req,res){
 try{
  receiverOrigin(uniqueHeader(req,'host'),uniqueHeader(req,'origin'),port);const {route,id}=receiverRoute(req.method,req.url);
  if(stopped)throw new ReceiverError('UNCONFIRMED',503);
  if(route.startsWith('ASSET_')){readBudget();const file={ASSET_HTML:'session-monitor.html',ASSET_JS:'session-monitor.mjs',ASSET_CSS:'session-monitor.css'}[route],type={ASSET_HTML:'text/html',ASSET_JS:'text/javascript',ASSET_CSS:'text/css'}[route],asset=readBounded(join(project,'scripts',file),receiverLimits.assetBytes);res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'Content-Length':asset.length});res.end(asset);return;}
  unchangedHashes();const role=receiverAuthorization(uniqueHeader(req,'authorization'),hashes);
  if(['EVENTS','CONTROL','RECEIPT'].includes(route)){receiverSessionId(uniqueHeader(req,'x-session-id'),confirmed.config.sessionId);receiverSessionInstance(uniqueHeader(req,'x-session-instance'),receiverInstance(confirmed));}
  if(route==='EVENTS'||route==='CONTROL'){
   const text=await body(req);healthy();const event=receiverEvent(text,route,role,m);if(queue.length+(working?1:0)>=receiverLimits.queue)throw new ReceiverError('QUEUE_LIMIT',429);queue.push({event,res});void drain();return;
  }
  readBudget();if(route!=='RECEIPT'&&role!=='owner')throw new ReceiverError('FORBIDDEN',403);
  if(queue.length+(working?1:0)>=receiverLimits.queue)throw new ReceiverError('QUEUE_LIMIT',429);queue.push({read:true,route,id,role,res});void drain();
 }catch(error){const safe=error instanceof ReceiverError?error:new ReceiverError('UNCONFIRMED',503);reject(res,rejectionBudget()?safe:new ReceiverError('REJECTION_LIMIT',429));if(safe.status>=500)failStop();}
}
async function credentials(path){
 const producerToken='og_local_producer_'+randomBytes(32).toString('hex'),ownerToken='og_local_owner_'+randomBytes(32).toString('hex'),value=receiverHashesSchema.parse({version:1,producerDigest:sha(producerToken),ownerDigest:sha(ownerToken)});
 const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}const directory=openSync(dirname(path),constants.O_RDONLY|(constants.O_DIRECTORY??0));try{fsyncSync(directory);}finally{closeSync(directory);}
 process.stdout.write(JSON.stringify({version:1,producerToken,ownerToken})+'\n');
}
async function shutdown(){
 if(shuttingDown)return;shuttingDown=true;stopped=true;for(const item of queue)reject(item.res,new ReceiverError('UNCONFIRMED',503));queue=[];
 if(server)server.close();if(child){child.stdin.end();const exited=new Promise(resolve=>child.once('exit',resolve));await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,1500))]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');}
 for(const socket of sockets)socket.destroy();if(temporary)rmSync(temporary,{recursive:true,force:true});
}
process.on('SIGINT',()=>{void shutdown();});process.on('SIGTERM',()=>{void shutdown();});
async function main(){
 const [command,...args]=process.argv.slice(2);if(command==='credentials'&&args.length===1){await credentials(args[0]);return;}
 if(!['start','resume'].includes(command)||command==='start'&&(args.length<3||args.length>4)||command==='resume'&&(args.length<2||args.length>3))throw new ReceiverError('INVALID_USAGE');
 const config=command==='start'?args[0]:null,requested=command==='start'?args[1]:args[0];hashPath=command==='start'?args[2]:args[1];const supplied=command==='start'?args[3]:args[2];if(supplied!==undefined&&!/^(?:0|[1-9]\d{0,4})$/.test(supplied)||Number(supplied??0)>65535)throw new ReceiverError('INVALID_USAGE');port=Number(supplied??0);
 journalPath=join(realpathSync(dirname(requested)),basename(requested));m=await modules();const hashBytes=readBounded(hashPath,receiverLimits.hashBytes,true);hashes=parseReceiverHashes(decode(hashBytes),m.parseUniqueJson);hashFileDigest=sha(hashBytes);
 if(config){const raw=m.parseUniqueJson(decode(readBounded(config,m.sessionLimits.configBytes)),m.sessionLimits.configBytes,24);receiverNoSecrets(raw);m.boundedSessionConfig(raw);}else await journal(readBounded(journalPath,m.sessionJournalLimits.bytes,true));await begin(command,config);
 server=createServer((req,res)=>{void request(req,res);});server.requestTimeout=receiverLimits.requestMs;server.headersTimeout=receiverLimits.requestMs;server.keepAliveTimeout=3000;server.maxConnections=receiverLimits.sockets;server.maxRequestsPerSocket=100;
 server.on('connection',socket=>{sockets.add(socket);socket.setTimeout(receiverLimits.requestMs);socket.on('timeout',()=>socket.destroy());socket.on('close',()=>sockets.delete(socket));});server.on('clientError',(_error,socket)=>{socket.destroy();});server.on('error',failStop);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});healthy();port=server.address().port;
 process.stdout.write(JSON.stringify({type:'READY',version:1,url:'http://127.0.0.1:'+port,port,sessionId:confirmed.config.sessionId,sessionInstance:receiverInstance(confirmed),startedAt:confirmed.startedAt,implementation:confirmed.implementation,sequence:confirmed.state.sequence,status:confirmed.state.status,requiresExplicitResume:command==='resume'&&confirmed.state.status==='PAUSED',ordersEnabled:false,liveEnabled:false,classification:'AUTHOR_REPORTED',qualification:'NONE',sourceAuthenticity:'UNKNOWN',transport:'LOCAL_AUTHENTICATED_HTTP',limits:{queue:receiverLimits.queue,normalEvents:m.sessionLimits.events,reservedEvents:m.sessionLimits.emergencyReserve,journalBytes:m.sessionJournalLimits.bytes}})+'\n');
}
try{await main();}catch{process.stderr.write('Local Demo receiver stopped without a confirmed acknowledgment. Preserve the journal and reconcile before retrying.\n');process.exitCode=1;await shutdown();}
