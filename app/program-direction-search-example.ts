import {boundedStrategyRecord,strategyAuthorReference,strategyDigest,type StrategyPublicItem} from './strategy-model';
import {demoTimeframes,type DemoDataset} from './demo-model';
import {programBinaryDigest} from './program-source-model';
import {syntheticProgramRunInput} from './program-run';
import {programDirectionSearchMethod,type ProgramDirectionSearchPlanAdmission,type ProgramDirectionSearchTestInput} from './program-direction-search-model';

/** Newly declared four-bar exercise. No historical data or outcome is shortened. */
export async function syntheticProgramDirectionSearchExample():Promise<{admission:ProgramDirectionSearchPlanAdmission;testInput:ProgramDirectionSearchTestInput}>{
 const id=(n:number)=>'a3500000-0000-4000-8000-'+String(n).padStart(12,'0'),createdAt='2025-02-01T00:00:00.000Z',step=demoTimeframes['1h'],base=await syntheticProgramRunInput(),sources:StrategyPublicItem[]=[];
 // Reviewed previous-close and configured-threshold globals. The signal depends
 // on retained state and numeric input; it is not a first-bar or constant signal.
 const trendHex='0061736d0100000001110260077f7c7c7c7c7c7c017f60027f7c0003030200010619027c014400000000000000000b7c014400000000000000000b071602066f6e5f626172000009636f6e66696775726500010a3c023301017f200045047f410005200523002301a064047f410105200523002301a163047f41020541000b0b0b21072005240020070b0600200124010b';
 const noOutputHex='0061736d01000000010c0160077f7c7c7c7c7c7c017f03020100070a01066f6e5f62617200000a0601040041000b';
 for(let n=0;n<2;n++){
  const bytesHex=n?noOutputHex:trendHex;
  const {record,payload}=boundedStrategyRecord({...base.strategy.record,id:id(10+n),rootId:id(10+n),revision:1,requestId:id(20+n),createdAt,
   author:{kind:'HUMAN',id:'human_'+'0'.repeat(64),sponsorId:'human_'+'0'.repeat(64)},
   content:{...base.strategy.record.content,name:n?'Silent SHORT':'Invented SHORT',description:'Four invented bars.',assumptions:'Stateful; no edge.',falsification:'Reject edge claims.',sources:[],relation:null,
    definition:{...base.strategy.record.content.definition,market:{symbol:'BTC/USD',timeframe:'1h',direction:'SHORT'},entry:{type:'SIGNAL',provider:'CUSTOM',event:'BEARISH',maxAgeBars:1},risk:{positionPct:10,maxOpenPositions:1,stopLossPct:2,takeProfitPct:4,maxDailyLossPct:5}},
    program:{...base.strategy.record.content.program,bytesHex,digest:await programBinaryDigest(bytesHex),parameters:n?[]:[.1]}}});
  sources.push({id:record.id,digest:await strategyDigest(payload),rootId:record.rootId,revision:record.revision,requestId:record.requestId,createdAt,author:strategyAuthorReference(record.author),state:'VISIBLE',reason:null,record,moderation:[]});
 }
 const dataset=(test:boolean):DemoDataset=>({version:1,id:id(test?31:30),provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Created synthetic data.'},symbol:'BTC/USD',timeframe:'1h',bars:(test?[100,99,102,105]:[100,99,98,94]).map((price,n)=>({closedAt:new Date(Date.parse(createdAt)+(n+(test?7:1))*step).toISOString(),open:price,close:price,high:price*1.001,low:price*.999,volume:1000}))});
 const train=dataset(false),test=dataset(true);
 return {admission:{version:2,kind:'LOCAL_PROGRAM_DIRECTION_SEARCH_ADMISSION',method:programDirectionSearchMethod,id:id(1),createdAt:train.bars.at(-1)!.closedAt,candidates:sources.map((source,n)=>({source,attemptId:id(40+n),requestId:id(50+n)})),train:{dataset:train},test:{datasetId:test.id,firstClosedAt:test.bars[0].closedAt,barCount:test.bars.length,gapBars:2,provenance:'SYNTHETIC',permission:'CREATED_SYNTHETIC',attemptId:id(60),requestId:id(61)},initialCapital:1000,hypothesis:'Test SHORT.',falsification:'Reject missing trials.',selection:{objective:'MAX_RETURN_PCT',minTrades:1,maxDrawdownPct:5,minReturnPct:0,tieTolerancePct:.00000001,tieBreak:'CANDIDATE_ORDER'}},testInput:{dataset:test}};
}
