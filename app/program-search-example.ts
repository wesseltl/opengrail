import {boundedStrategyRecord,strategyAuthorReference,strategyDigest,type StrategyPublicItem} from './strategy-model';
import {demoTimeframes,type DemoDataset} from './demo-model';
import {programBinaryDigest} from './program-source-model';
import {syntheticProgramRunInput} from './program-run';
import type {ProgramSearchPlanAdmission,ProgramSearchTestInput} from './program-search-protocol';

/** Exact deterministic first-party sources and invented prices; no public issuer. */
export async function syntheticProgramSearchExample():Promise<{admission:ProgramSearchPlanAdmission;testInput:ProgramSearchTestInput}>{
 const id=(n:number)=>'a3200000-0000-4000-8000-'+String(n).padStart(12,'0'),createdAt='2025-01-01T00:00:00.000Z',step=demoTimeframes['1h'],base=await syntheticProgramRunInput(),sources:StrategyPublicItem[]=[];
 const noOutputHex='0061736d01000000010c0160077f7c7c7c7c7c7c017f03020100070a01066f6e5f62617200000a0601040041000b';
 for(let n=0;n<2;n++){
  const bytesHex=n?noOutputHex:base.strategy.record.content.program.bytesHex;
  const {record,payload}=boundedStrategyRecord({...base.strategy.record,id:id(10+n),rootId:id(10+n),revision:1,requestId:id(20+n),createdAt,
   author:{kind:'HUMAN',id:'human_'+'0'.repeat(64),sponsorId:'human_'+'0'.repeat(64)},
   content:{...base.strategy.record.content,name:n?'Invented no-output program':'Invented first-bar program',description:'Reviewed deterministic binary fixture; author and strategy are not registered.',assumptions:'Invented prices, fixed fills and costs. No authentic market data, customer demand or trading edge is established.',falsification:'Reject claims that synthetic program selection establishes real performance or unseen TEST custody.',sources:[],relation:null,program:{...base.strategy.record.content.program,bytesHex,digest:await programBinaryDigest(bytesHex),parameters:[]}}});
  sources.push({id:record.id,digest:await strategyDigest(payload),rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt,author:strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]});
 }
 const dataset=(test:boolean):DemoDataset=>({version:1,id:id(test?31:30),provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented bounded OHLCV fixture; no genuine provider observations or investment evidence.'},symbol:'BTC/USDT',timeframe:'1h',bars:Array.from({length:48},(_,n)=>{const open=test?200-n:100+n,close=test?open-1:open+1;return {closedAt:new Date(Date.parse(createdAt)+(n+(test?51:1))*step).toISOString(),open,close,high:Math.max(open,close)*1.001,low:Math.min(open,close)*.999,volume:1000};})});
 const train=dataset(false),test=dataset(true);
 return {admission:{version:1,kind:'LOCAL_PROGRAM_SEARCH_ADMISSION',id:id(1),createdAt:train.bars.at(-1)!.closedAt,candidates:sources.map((source,n)=>({source,attemptId:id(40+n),requestId:id(50+n)})),train:{dataset:train},test:{datasetId:test.id,firstClosedAt:test.bars[0].closedAt,barCount:test.bars.length,gapBars:2,provenance:'SYNTHETIC',permission:'CREATED_SYNTHETIC',attemptId:id(60),requestId:id(61)},initialCapital:1000,hypothesis:'Keep every actual programmable TRAIN outcome, lock its selection, then retain a losing synthetic TEST without retuning.',falsification:'Reject if supplied signals replace actual generation, cold state carries across partitions, adverse evidence disappears or TEST reopens.',selection:{objective:'MAX_RETURN_PCT',minTrades:1,maxDrawdownPct:5,minReturnPct:0,tieTolerancePct:.00000001,tieBreak:'CANDIDATE_ORDER'}},testInput:{dataset:test}};
}
