import {boundedStrategyRecord,strategyDigest,strategyTemplate} from './strategy-model';
import {boundedDemoRequest,demoArtifactSchema,demoArtifactDigest,demoEvaluatorVersion,demoEvaluatorMethod,demoLimits,demoTimeframes,DemoError,type DemoRequest,type DemoArtifact,type DemoStrategy,type DemoAudit,type DemoTrade,type DemoEquity,type DemoBar,type DemoSignal} from './demo-model';

type Reason=DemoAudit['reason'];
type Position={id:string;direction:'LONG'|'SHORT';entryBar:number;entryAt:string;quantity:number;entryPrice:number;collateral:number;entryFee:number;gridLevel:number|null;signalId:string|null};
type Pending={gridLevel:number|null;signalId:string|null;reason:Reason};
class ReplayFailure extends Error{constructor(public reason:Reason){super(reason);}}
const finite=(value:number)=>{if(!Number.isFinite(value))throw new ReplayFailure('NUMERICAL_LIMIT');return value;};
const iso=(time:number)=>new Date(time).toISOString();
function rawPayload(raw:unknown){
 let nodes=0;const visit=(value:unknown,depth:number)=>{
  if(++nodes>100000||depth>40)throw new DemoError('Demo input is too complex.',413);
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){if(Number.isFinite(value))return;throw new DemoError('Demo input must contain finite JSON numbers.');}
  if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null&&!Array.isArray(value))throw new DemoError('Demo input must be plain JSON data.');
  const descriptors=Object.getOwnPropertyDescriptors(value);for(const [key,property] of Object.entries(descriptors)){if(Array.isArray(value)&&key==='length')continue;if(!('value' in property))throw new DemoError('Demo input cannot contain executable accessors.');visit(property.value,depth+1);}
 };
 visit(raw,0);let payload:string;try{payload=JSON.stringify(raw);}catch{throw new DemoError('Demo input must be serializable JSON.');}if(typeof payload!=='string')throw new DemoError('Demo input must be JSON data.');if(new TextEncoder().encode(payload).byteLength>demoLimits.requestBytes)throw new DemoError('Demo input exceeds the local byte budget.',413);return payload;
}
async function seal(body:Omit<DemoArtifact,'resultDigest'>){const artifact=demoArtifactSchema.parse({...body,resultDigest:'0'.repeat(64)});artifact.resultDigest=await demoArtifactDigest(artifact);if(new TextEncoder().encode(JSON.stringify(artifact)).byteLength>demoLimits.artifactBytes)throw new DemoError('Demo artifact exceeds the local byte budget.',413);return artifact;}
async function rejected(payload:string,reason:Reason,requestId:string|null=null){return seal({version:1,requestId,evaluatorVersion:demoEvaluatorVersion,classification:'AUTHOR_REPORTED',mode:'SIMULATED',ordersEnabled:false,status:'REJECTED',reason,input:null,digests:{request:await strategyDigest(payload),strategy:null,dataset:null,signals:null,evaluator:await strategyDigest(JSON.stringify(demoEvaluatorMethod))},audit:[{barIndex:null,at:null,type:'REJECTION',reason,positionId:null,signalId:null,details:'The bounded request was rejected. Unvalidated raw data was not retained.'}],trades:[],equity:[],metrics:null,benchmark:null});}

/** Pure local trusted replay. There is no fetch, database, uploaded code or order execution. */
export async function replayDemo(raw:unknown):Promise<DemoArtifact>{
 const rawJson=rawPayload(raw);let input:DemoRequest,payload:string;
 try{({input,payload}=boundedDemoRequest(raw));}catch(error){if(error instanceof DemoError&&error.status===413)throw error;return rejected(rawJson,'INVALID_INPUT');}
 const strategyPayload=boundedStrategyRecord(input.strategy.record).payload;
 if(await strategyDigest(strategyPayload)!==input.strategy.digest)return rejected(payload,'DIGEST_MISMATCH',input.requestId);
 const digests={request:await strategyDigest(payload),strategy:input.strategy.digest,dataset:await strategyDigest(JSON.stringify(input.dataset)),signals:await strategyDigest(JSON.stringify(input.signals)),evaluator:await strategyDigest(JSON.stringify(demoEvaluatorMethod))};
 const definition=input.strategy.record.content.definition,bars=input.dataset.bars,step=demoTimeframes[input.dataset.timeframe],sign=definition.market.direction==='LONG'?1:-1,feeRate=definition.costs.feeBps/10000,slippage=definition.costs.slippageBps/10000;
 const audit:DemoAudit[]=[],trades:DemoTrade[]=[],equity:DemoEquity[]=[],positions:Position[]=[],consumed=new Set<string>(),signals=[...input.signals].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||Date.parse(a.observedAt)-Date.parse(b.observedAt)||(a.id<b.id?-1:a.id>b.id?1:0));
 let cash=input.initialCapital,pending:Pending|null=null,serial=0,dcaEntries=0,day='',dayStart=input.initialCapital,dailyHalted=false,terminal:Reason|null=null,failed=false,currentBar=0,lastEquity=input.initialCapital,observedPrice=bars[0].open,observedAt=iso(Date.parse(bars[0].closedAt)-step);
 const emit=(type:DemoAudit['type'],reason:Reason,n:number|null,details:string,positionId:string|null=null,signalId:string|null=null,atOverride?:string)=>{if(audit.length>=demoLimits.audit-1)throw new ReplayFailure('RESULT_LIMIT');audit.push({barIndex:n,at:atOverride??(n===null?null:bars[n].closedAt),type,reason,positionId,signalId,details});};
 const fill=(price:number,entry:boolean)=>{const value=finite(price*(1+(entry?sign:-sign)*slippage));if(value<=0)throw new ReplayFailure('NUMERICAL_LIMIT');return value;};
 const mark=(price:number)=>positions.reduce((total,p)=>{const exit=fill(price,false),gross=finite(sign*p.quantity*(exit-p.entryPrice)),fee=finite(p.quantity*exit*feeRate);return finite(total+p.collateral+gross-fee);},cash);
 const close=(p:Position,price:number,n:number,at:string,reason:DemoTrade['reason'])=>{
  observedPrice=price;observedAt=at;
  if(trades.length>=demoLimits.trades)throw new ReplayFailure('RESULT_LIMIT');
  const exitPrice=fill(price,false),exitFee=finite(p.quantity*exitPrice*feeRate),grossPnl=finite(sign*p.quantity*(exitPrice-p.entryPrice)),release=finite(p.collateral+grossPnl-exitFee),netPnl=finite(grossPnl-p.entryFee-exitFee);
  cash=finite(cash+release);positions.splice(positions.indexOf(p),1);
  trades.push({...p,exitBar:n,exitAt:at,exitPrice,exitFee,grossPnl,netPnl,reason});emit('EXIT',reason,n,'Virtual position closed with adverse slippage and per-side fees.',p.id,p.signalId,at);
  if(release<0||cash<=0)throw new ReplayFailure('INSOLVENT');
 };
 const closeAll=(price:number,n:number,at:string,reason:DemoTrade['reason'])=>{for(const p of [...positions])close(p,price,n,at,reason);};
 const recordEquity=(n:number)=>{lastEquity=mark(bars[n].close);equity.push({barIndex:n,closedAt:bars[n].closedAt,equity:lastEquity,cash,reservedCollateral:finite(positions.reduce((sum,p)=>sum+p.collateral,0)),openPositions:positions.length,dailyHalted});};
 const haltDay=(price:number,n:number,at:string)=>{if(!dailyHalted&&mark(price)<=finite(dayStart*(1-definition.risk.maxDailyLossPct/100))){dailyHalted=true;pending=null;emit('HALT','DAILY_LOSS',n,'UTC-day loss halt latched; gaps and observed bar extremes can exceed the threshold.',null,null,at);closeAll(price,n,at,'DAILY_LOSS');}};
 const smaCache=new Map<number,(number|null)[]>(),rsiCache=new Map<number,{values:(number|null)[];gain:number;loss:number}>();
 // Compute only through the observed closed bar: future numeric failures cannot alter an earlier decision.
 const sma=(period:number,n:number):number|null=>{if(n<0)return null;let values=smaCache.get(period);if(!values){values=[];smaCache.set(period,values);}for(let k=values.length;k<=n;k++){if(k+1<period){values.push(null);continue;}let sum=0;for(let j=k-period+1;j<=k;j++)sum=finite(sum+bars[j].close);values.push(finite(sum/period));}return values[n];};
 const rsi=(period:number,n:number):number|null=>{if(n<0)return null;let state=rsiCache.get(period);if(!state){state={values:[null],gain:0,loss:0};rsiCache.set(period,state);}for(let k=state.values.length;k<=n;k++){const change=finite(bars[k].close-bars[k-1].close);if(k<=period){state.gain=finite(state.gain+Math.max(change,0));state.loss=finite(state.loss+Math.max(-change,0));if(k<period){state.values.push(null);continue;}state.gain/=period;state.loss/=period;}else{state.gain=finite((state.gain*(period-1)+Math.max(change,0))/period);state.loss=finite((state.loss*(period-1)+Math.max(-change,0))/period);}state.values.push(state.loss===0?state.gain===0?50:100:finite(100-100/(1+state.gain/state.loss)));}return state.values[n];};
 const indicator=(condition:{indicator:'PRICE_SMA'|'RSI'|'RETURN';period:number},n:number):number|null=>{if(n<0)return null;if(condition.indicator==='PRICE_SMA'){const average=sma(condition.period,n);return average===null?null:finite(bars[n].close/average);}if(condition.indicator==='RSI')return rsi(condition.period,n);return n<condition.period?null:finite(100*(bars[n].close/bars[n-condition.period].close-1));};
 const decision=(n:number):Pending|null=>{
  const entry=definition.entry;let match=false,warmup=false;let gridLevel:number|null=null;
  if(entry.type==='SIGNAL'){
   const eligible:DemoSignal[]=[];
   for(const signal of signals){if(consumed.has(signal.id)||Date.parse(signal.availableAt)>Date.parse(bars[n].closedAt))continue;consumed.add(signal.id);
    if(signal.provider!==entry.provider){emit('REJECTION','PROVIDER_MISMATCH',n,'Supplied event provider does not match this definition.',null,signal.id);continue;}
    if(signal.event!==entry.event){emit('REJECTION','EVENT_MISMATCH',n,'Supplied event direction does not match this definition.',null,signal.id);continue;}
    if((Date.parse(bars[n].closedAt)-Date.parse(signal.observedAt))/step>entry.maxAgeBars){emit('REJECTION','STALE_SIGNAL',n,'The available event exceeds the declared closed-bar age.',null,signal.id);continue;}
    eligible.push(signal);
   }
   if(!eligible.length){emit('DECISION','MISSING_SIGNAL',n,'No unused matching event is available at this closed bar.');return null;}
   const selected=eligible[0];for(const signal of eligible)emit('SIGNAL','SIGNAL_CONSUMED',n,signal===selected?'Matching event consumed once for a next-open decision.':'Additional same-decision event consumed without a second entry.',null,signal.id);
   return {gridLevel:null,signalId:selected.id,reason:'ENTRY_RULE'};
  }
  if(entry.type==='TREND'){const fast=sma(entry.fastPeriod,n),slow=sma(entry.slowPeriod,n),priorFast=sma(entry.fastPeriod,n-1),priorSlow=sma(entry.slowPeriod,n-1);warmup=fast===null||slow===null||entry.confirmation==='CROSS'&&(priorFast===null||priorSlow===null);if(!warmup){const aligned=sign*(fast!-slow!)>0;match=aligned&&(entry.confirmation==='ALIGNED'||sign*(priorFast!-priorSlow!)<=0);}}
  if(entry.type==='RSI'){const value=rsi(entry.period,n);warmup=value===null;match=value!==null&&(entry.comparison==='BELOW'?value<entry.threshold:value>entry.threshold);}
  if(entry.type==='BREAKOUT'){warmup=n<entry.lookback;if(!warmup){const prior=bars.slice(n-entry.lookback,n);match=sign===1?bars[n].close>Math.max(...prior.map(bar=>bar.high)):bars[n].close<Math.min(...prior.map(bar=>bar.low));}}
  if(entry.type==='DCA'){if(dcaEntries>=entry.maxEntries){emit('DECISION','DCA_EXHAUSTED',n,'The lifetime number of filled DCA entries is exhausted.');return null;}match=n%entry.intervalBars===0;}
  if(entry.type==='GRID'){
   warmup=n===0;if(!warmup){const levels=Array.from({length:entry.levels},(_,k)=>finite(entry.lowerPrice+(entry.upperPrice-entry.lowerPrice)*k/(entry.levels-1))),crossed=levels.map((level,k)=>({level,k})).filter(({level})=>sign===1?bars[n-1].close>level&&bars[n].close<=level:bars[n-1].close<level&&bars[n].close>=level).sort((a,b)=>sign===1?b.level-a.level:a.level-b.level);
    const free=crossed.find(({k})=>!positions.some(p=>p.gridLevel===k));if(free){match=true;gridLevel=free.k;}else if(crossed.length)emit('REJECTION','GRID_LEVEL_ACTIVE',n,'Crossed levels already have active virtual inventory.');
   }
  }
  if(entry.type==='RULES'){const outcomes=entry.conditions.map(condition=>{const value=indicator(condition,n),prior=indicator(condition,n-1);if(value===null||condition.comparison.startsWith('CROSSES_')&&prior===null)return null;if(condition.comparison==='GT')return value>condition.threshold;if(condition.comparison==='LT')return value<condition.threshold;if(condition.comparison==='CROSSES_ABOVE')return value>condition.threshold&&prior!<=condition.threshold;return value<condition.threshold&&prior!>=condition.threshold;});warmup=outcomes.some(value=>value===null);match=!warmup&&(entry.match==='ALL'?outcomes.every(Boolean):outcomes.some(Boolean));}
  if(warmup){emit('WARMUP','WARMUP',n,'Required prior closed-bar observations are unavailable; no fallback signal.');return null;}
  if(!match)return null;emit('DECISION',entry.type==='GRID'?'GRID_CROSS':entry.type==='DCA'?'DCA_INTERVAL':'ENTRY_RULE',n,'Closed-bar conditions schedule at most one next-open entry.');return {gridLevel,signalId:null,reason:entry.type==='GRID'?'GRID_CROSS':entry.type==='DCA'?'DCA_INTERVAL':'ENTRY_RULE'};
 };
 const enter=(planned:Pending,n:number,openAt:string)=>{
  if(positions.length>=definition.risk.maxOpenPositions){emit('REJECTION','POSITION_LIMIT',n,'Maximum virtual open positions reached.',null,planned.signalId,openAt);return;}
  const value=mark(bars[n].open),total=finite(value*definition.risk.positionPct/100),reserved=finite(positions.reduce((sum,p)=>sum+p.collateral,0)),remaining=finite(total-reserved),parts=definition.entry.type==='DCA'?definition.entry.maxEntries:definition.entry.type==='GRID'?definition.entry.levels:definition.risk.maxOpenPositions;
  if(value<=0)throw new ReplayFailure('INSOLVENT');if(remaining<=input.initialCapital*1e-12){emit('REJECTION','ALLOCATION_LIMIT',n,'Total strategy allocation is already reserved.',null,planned.signalId,openAt);return;}
  const collateral=finite(Math.min(total/parts,remaining,cash/(1+feeRate)));if(collateral<=input.initialCapital*1e-12){emit('REJECTION','CASH_LIMIT',n,'Available virtual cash cannot cover collateral and entry costs.',null,planned.signalId,openAt);return;}
  const entryPrice=fill(bars[n].open,true),quantity=finite(collateral/entryPrice),entryFee=finite(collateral*feeRate);if(quantity<=0)throw new ReplayFailure('NUMERICAL_LIMIT');
  cash=finite(cash-collateral-entryFee);const p:Position={id:'demo_position_'+(++serial),direction:definition.market.direction,entryBar:n,entryAt:openAt,quantity,entryPrice,collateral,entryFee,gridLevel:planned.gridLevel,signalId:planned.signalId};positions.push(p);if(definition.entry.type==='DCA')dcaEntries++;emit('ENTRY',planned.reason,n,`Virtual quantity ${quantity}; reserved collateral ${collateral}; entry fee ${entryFee}.`,p.id,p.signalId,openAt);
 };
 try{
  for(let n=0;n<bars.length;n++){
   currentBar=n;const bar=bars[n],openAt=iso(Date.parse(bar.closedAt)-step),utcDay=openAt.slice(0,10);observedPrice=bar.open;observedAt=openAt;
   if(utcDay!==day){if(day)emit('RESET','DAILY_RESET',n,'New UTC opening day resets the loss halt using previous closed equity.',null,null,openAt);day=utcDay;dayStart=lastEquity;dailyHalted=false;}
   if(input.emergencyStopAt!==null&&Date.parse(input.emergencyStopAt)<=Date.parse(openAt)){pending=null;emit('HALT','EMERGENCY_STOP',n,'Emergency stop observed at this open; no new entry.',null,null,openAt);closeAll(bar.open,n,openAt,'EMERGENCY_STOP');terminal='EMERGENCY_STOP';recordEquity(n);break;}
   // Opening gaps are observed before admitting the previously queued decision.
   for(const p of [...positions]){const stop=p.entryPrice*(1-sign*definition.risk.stopLossPct/100),target=p.entryPrice*(1+sign*definition.risk.takeProfitPct/100);if(sign*(bar.open-stop)<=0)close(p,bar.open,n,openAt,'STOP_LOSS');else if(sign*(bar.open-target)>=0)close(p,target,n,openAt,'TAKE_PROFIT');}
   haltDay(bar.open,n,openAt);
   if(pending){const planned=pending;pending=null;if(dailyHalted)emit('REJECTION','DAILY_LOSS',n,'A latched daily halt rejects the queued next-open entry.',null,planned.signalId,openAt);else enter(planned,n,openAt);}
   // A newly filled position can already breach its stop because of entry slippage; use the observed open, not a stale favorable stop.
   for(const p of [...positions]){const stop=finite(p.entryPrice*(1-sign*definition.risk.stopLossPct/100));if(sign*(bar.open-stop)<=0)close(p,bar.open,n,openAt,'STOP_LOSS');}
   observedPrice=sign===1?bar.low:bar.high;observedAt=bar.closedAt;
   // With OHLC only, stop is pessimistically processed before target.
   for(const p of [...positions]){const stop=finite(p.entryPrice*(1-sign*definition.risk.stopLossPct/100));if(sign===1?bar.low<=stop:bar.high>=stop)close(p,stop,n,bar.closedAt,'STOP_LOSS');}
   haltDay(sign===1?bar.low:bar.high,n,bar.closedAt);
   for(const p of [...positions]){const target=finite(p.entryPrice*(1+sign*definition.risk.takeProfitPct/100));if(sign===1?bar.high>=target:bar.low<=target)close(p,target,n,bar.closedAt,'TAKE_PROFIT');}
   if(input.emergencyStopAt!==null&&Date.parse(input.emergencyStopAt)<=Date.parse(bar.closedAt)){pending=null;emit('HALT','EMERGENCY_STOP',n,'Mid-interval emergency is deferred to this observable close, never backdated to its open.');closeAll(bar.close,n,bar.closedAt,'EMERGENCY_STOP');terminal='EMERGENCY_STOP';recordEquity(n);break;}
   haltDay(bar.close,n,bar.closedAt);
   if(!dailyHalted)pending=decision(n);recordEquity(n);
   if(n===bars.length-1){if(pending)emit('REJECTION','END_OF_DATA',n,'The final closed-bar decision has no next open; no entry.',null,pending.signalId);pending=null;closeAll(bar.close,n,bar.closedAt,'END_OF_DATA');equity.pop();recordEquity(n);}
  }
 }catch(error){
  failed=true;terminal=error instanceof ReplayFailure?error.reason:'NUMERICAL_LIMIT';pending=null;
  if(terminal==='INSOLVENT'){
   const failurePrice=observedPrice,failureAt=observedAt;for(const p of [...positions]){try{close(p,failurePrice,currentBar,failureAt,'INSOLVENT');}catch(next){if(next instanceof ReplayFailure&&next.reason!=='INSOLVENT'){terminal=next.reason;break;}}}
   try{if(equity.at(-1)?.barIndex===currentBar)equity.pop();recordEquity(currentBar);}catch{terminal='NUMERICAL_LIMIT';}
  }
  if(audit.length<demoLimits.audit)audit.push({barIndex:currentBar,at:observedAt,type:'FAILURE',reason:terminal,positionId:null,signalId:null,details:'Replay terminated; uncapped economic losses and completed finite observations are retained. No further entries.'});
 }
 for(const signal of signals)if(!consumed.has(signal.id)&&audit.length<demoLimits.audit-1)audit.push({barIndex:null,at:null,type:'REJECTION',reason:'SIGNAL_UNUSED',positionId:null,signalId:signal.id,details:'Supplied event was not consumed before replay ended.'});
 const status:DemoArtifact['status']=failed?'FAILED':terminal==='EMERGENCY_STOP'||dailyHalted?'HALTED':trades.length?'COMPLETED':'NO_TRADES',reason=failed||terminal?terminal:dailyHalted?'DAILY_LOSS':trades.length?null:'NO_TRADES';
 let metrics:DemoArtifact['metrics']=null,benchmark:DemoArtifact['benchmark']=null;
 try{
  if(!failed||terminal==='INSOLVENT'){
   const finalEquity=equity.at(-1)?.equity??input.initialCapital;let peak=input.initialCapital,drawdown=0;for(const point of equity){peak=Math.max(peak,point.equity);drawdown=Math.max(drawdown,finite(100*(peak-point.equity)/peak));}
   metrics={initialCapital:input.initialCapital,finalEquity,netPnl:finite(finalEquity-input.initialCapital),returnPct:finite(100*(finalEquity/input.initialCapital-1)),maxDrawdownPct:drawdown,trades:trades.length,wins:trades.filter(t=>t.netPnl>0).length,losses:trades.filter(t=>t.netPnl<0).length,totalFees:finite(trades.reduce((sum,t)=>sum+t.entryFee+t.exitFee,0)+positions.reduce((sum,p)=>sum+p.entryFee,0)),turnover:finite(trades.reduce((sum,t)=>sum+t.quantity*(t.entryPrice+t.exitPrice),0)+positions.reduce((sum,p)=>sum+p.collateral,0)),comparable:!failed&&definition.market.direction==='LONG'&&terminal!=='EMERGENCY_STOP'};
  }
  const entryPrice=finite(bars[1].open*(1+slippage)),exitPrice=finite(bars.at(-1)!.close*(1-slippage)),collateral=finite(Math.min(input.initialCapital*definition.risk.positionPct/100,input.initialCapital/(1+feeRate))),quantity=finite(collateral/entryPrice),totalFees=finite(collateral*feeRate+quantity*exitPrice*feeRate),finalEquity=finite(input.initialCapital+quantity*(exitPrice-entryPrice)-totalFees);
  benchmark={status:'COMPLETED',reason:null,allocationPct:definition.risk.positionPct,direction:'LONG',initialCapital:input.initialCapital,finalEquity,netPnl:finite(finalEquity-input.initialCapital),returnPct:finite(100*(finalEquity/input.initialCapital-1)),totalFees,comparable:!failed&&definition.market.direction==='LONG'&&terminal!=='EMERGENCY_STOP'};
 }catch{if(!failed){failed=true;terminal='NUMERICAL_LIMIT';if(audit.length<demoLimits.audit)audit.push({barIndex:currentBar,at:bars[currentBar].closedAt,type:'FAILURE',reason:'NUMERICAL_LIMIT',positionId:null,signalId:null,details:'Derived metrics or benchmark exceeded finite numeric limits; no comparable result.'});}metrics=null;benchmark=null;}
 const finalStatus=failed?'FAILED':status,finalReason=failed?terminal:reason;
 return seal({version:1,requestId:input.requestId,evaluatorVersion:demoEvaluatorVersion,classification:'AUTHOR_REPORTED',mode:'SIMULATED',ordersEnabled:false,status:finalStatus,reason:finalReason,input,digests,audit,trades,equity,metrics,benchmark});
}

/** An invented offline fixture, never proof of registration, market data or a connected provider. */
export async function syntheticDemoInput(selected?:DemoStrategy):Promise<DemoRequest>{
 const strategy=selected??(()=>{const {record,payload}=boundedStrategyRecord({version:1,id:'00000000-0000-4000-8000-000000000001',rootId:'00000000-0000-4000-8000-000000000001',revision:1,requestId:'00000000-0000-4000-8000-000000000002',createdAt:'2025-01-01T00:00:00.000Z',author:{kind:'HUMAN',id:'human_'+'0'.repeat(64),sponsorId:'human_'+'0'.repeat(64)},content:{name:'Invented offline Demo fixture',description:'Deterministic synthetic input, not a registered participant or tested market strategy.',assumptions:'Friction, fills and data are authored simulation assumptions.',falsification:'Reject economic claims that cannot be independently reproduced with permitted unseen data.',sources:[],definition:strategyTemplate('TREND'),relation:null},policyAccepted:'public-strategy-v1',verification:'UNTESTED',executionEnabled:false});return {record,payload};})();
 const exact='payload' in strategy?{record:strategy.record,digest:await strategyDigest(strategy.payload)}:strategy,definition=exact.record.content.definition,step=demoTimeframes[definition.market.timeframe],start=Date.parse('2025-01-01T00:00:00.000Z'),base=definition.entry.type==='GRID'?(definition.entry.lowerPrice+definition.entry.upperPrice)/2:100;
 const bars:DemoBar[]=Array.from({length:360},(_,n)=>{const previous=base*(1+.01*((((n+47)%48)<24?(n+47)%48:48-(n+47)%48)-12)),close=base*(1+.01*((n%48<24?n%48:48-n%48)-12)),open=n?previous:base;return {closedAt:iso(start+(n+1)*step),open,high:Math.max(open,close)*1.003,low:Math.min(open,close)*.997,close,volume:1000};});
 const signals:DemoSignal[]=definition.entry.type==='SIGNAL'?Array.from({length:6},(_,n)=>({id:'00000000-0000-4000-8000-'+String(n+10).padStart(12,'0'),provider:definition.entry.type==='SIGNAL'?definition.entry.provider:'CUSTOM',event:definition.market.direction==='LONG'?'BULLISH':'BEARISH',observedAt:bars[60+n*40].closedAt,availableAt:bars[60+n*40].closedAt})):[];
 return boundedDemoRequest({version:1,requestId:'00000000-0000-4000-8000-000000000003',evaluatorVersion:demoEvaluatorVersion,strategy:exact,dataset:{version:1,id:'00000000-0000-4000-8000-000000000004',provenance:'SYNTHETIC',rights:{permission:'CREATED_SYNTHETIC',acknowledged:true,note:'Invented deterministic triangular-wave OHLC fixture created locally; no external source or real market prices.'},symbol:definition.market.symbol,timeframe:definition.market.timeframe,bars},signals,initialCapital:1000,hypothesis:'The exact declarative rules produce a reproducible cost-aware synthetic replay, without evidence of market profitability.',falsification:'Reject if identical inputs yield different artifacts, use future information, or omit costs and failed trials.',emergencyStopAt:null}).input;
}
