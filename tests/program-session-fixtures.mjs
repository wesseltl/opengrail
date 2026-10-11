import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {trendProgram,moduleHex} from './helpers/program-fixtures.mjs';
let loading;
/** Synthetic first-party fixtures only. No provider, native guest execution or hosted bindings. */
export async function loadProgramSessionTestModule(){
 if(!loading)loading=(async()=>{
  const bundle=await build({stdin:{contents:"export * from './app/program-session-model';export * from './app/program-session-journal';export * from './app/program-session-engine';export {syntheticProgramRunInput} from './app/program-run';export {strategyRecordV2Schema,boundedStrategyRecord,strategyDigest} from './app/strategy-model';export {programBinaryDigest} from './app/program-source-model';export {sessionDigest,sessionStateDigest} from './app/session-model';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
  const directory=mkdtempSync(join(tmpdir(),'opengrail-program-session-test-')),path=join(directory,'trusted.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx'});
  try{return await import(pathToFileURL(path).href);}finally{rmSync(directory,{recursive:true,force:true});}
 })();return loading;
}
/** In-memory observation only: physical legacy sources and their pins remain unchanged. */
export async function loadInstrumentedProgramSessionTestModule(){
 const counters={kernel:0,program:0},observe=kind=>{counters[kind]++;},key='__programSessionColdReplayObserver';globalThis[key]=observe;
 const bundle=await build({stdin:{contents:"export * from './app/program-session-model';export * from './app/program-session-journal';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',plugins:[{name:'observe-cold-reconstruction',setup(build){build.onLoad({filter:/\/app\/(?:program-)?session-journal\.ts$/},async args=>{const original=readFileSync(args.path,'utf8'),program=args.path.endsWith('/program-session-journal.ts'),needle=program?' options.signal?.throwIfAborted();const claimed=':' options.signal?.throwIfAborted();const journal=';if(!original.includes(needle))throw Error('OBSERVATION_POINT_MISSING');return {contents:original.replace(needle,` globalThis['${key}']('${program?'program':'kernel'}');`+needle),loader:'ts'};});}}]});
 const directory=mkdtempSync(join(tmpdir(),'opengrail-program-session-observed-')),path=join(directory,'observed.mjs');writeFileSync(path,bundle.outputFiles[0].text,{flag:'wx'});try{return {m:await import(pathToFileURL(path).href),counters,close:()=>{delete globalThis[key];}};}finally{rmSync(directory,{recursive:true,force:true});}
}
export const programSessionTestId=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export async function programSessionFixture({binary=trendProgram(),parameters=[0],direction='SHORT',prices=[100,99,99],symbol='BTC/USD',timeframe='1h',startedAt='2026-01-01T00:00:00.000Z',clockMode='SYNTHETIC_PLAYBACK'}={}){
 const m=await loadProgramSessionTestModule(),seed=await m.syntheticProgramRunInput(),bytesHex=moduleHex(binary),record=structuredClone(seed.strategy.record);
 record.content.name='Invented persistent stateful program';record.content.definition.market={symbol,timeframe,direction};record.content.definition.entry={type:'SIGNAL',provider:'CUSTOM',event:direction==='LONG'?'BULLISH':'BEARISH',maxAgeBars:1};record.content.definition.risk={positionPct:10,maxOpenPositions:1,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:5};record.content.program={...record.content.program,bytesHex,digest:await m.programBinaryDigest(bytesHex),parameters};
 const source=m.strategyRecordV2Schema.parse(record),step=({'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000})[timeframe];
 const config=m.boundedProgramSessionConfig({version:1,kind:'LOCAL_PROGRAM_SESSION_CONFIG',sessionId:programSessionTestId(700),methodVersion:m.programSessionVersion,clockMode,origin:'SYNTHETIC_FIXTURE',strategy:{record:source,digest:await m.strategyDigest(m.boundedStrategyRecord(source).payload)},initialCapital:1000,provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented local prices and clocks; no market observations.'},sourceLabel:'Invented persistent program stream',ordersEnabled:false,liveEnabled:false}).config;
 const bars=prices.map((close,n)=>({closedAt:new Date(Date.parse(startedAt)+(n+1)*step).toISOString(),open:close,high:close,low:close,close,volume:100}));
 return {config,startedAt,bars,events:bars.map((bar,n)=>({event:{requestId:programSessionTestId(800+n),type:'CLOSED_BAR',bar},receivedAt:bar.closedAt,completedAt:new Date(Date.parse(bar.closedAt)+10).toISOString()}))};
}
