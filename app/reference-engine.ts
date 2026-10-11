import type {DemoRequest,DemoArtifact,DemoAudit,DemoTrade,DemoEquity} from './demo-model';

export const referenceEvaluatorVersion='opengrail-reference-v1' as const;
export type ReferenceResult={
 status:DemoArtifact['status'];reason:DemoArtifact['reason'];
 audit:Pick<DemoAudit,'barIndex'|'at'|'type'|'reason'|'positionId'|'signalId'>[];
 trades:DemoTrade[];equity:DemoEquity[];metrics:DemoArtifact['metrics'];benchmark:DemoArtifact['benchmark'];
};
type Reason=DemoAudit['reason'];
type Audit=ReferenceResult['audit'][number];
type Lot=Pick<DemoTrade,'id'|'direction'|'entryBar'|'entryAt'|'quantity'|'entryPrice'|'collateral'|'entryFee'|'gridLevel'|'signalId'>;
type Intent={reason:Reason;gridLevel:number|null;signalId:string|null};
type Boundary={index:number;at:string;price:number};
const caps={trades:2000,audit:12000};
const intervals={'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
class ReferenceFailure extends Error{constructor(public reason:Reason){super(reason);}}
function number(value:number){if(!Number.isFinite(value))throw new ReferenceFailure('NUMERICAL_LIMIT');return value;}

/** Separate lot ledger: cash and equity are derived from retained closed trades and open obligations. */
class Portfolio{
 readonly active=new Map<string,Lot>();
 readonly completed:DemoTrade[]=[];
 private sequence=0;
 constructor(readonly initial:number,readonly direction:'LONG'|'SHORT',readonly fee:number,readonly slippage:number){}
 get sign(){return this.direction==='LONG'?1:-1;}
 price(raw:number,isEntry:boolean){const value=number(raw*(1+this.slippage*this.sign*(isEntry?1:-1)));if(value<=0)throw new ReferenceFailure('NUMERICAL_LIMIT');return value;}
 realized(){let result=0;for(const trade of this.completed)result=number(result+trade.netPnl);return result;}
 cash(){let value=number(this.initial+this.realized());for(const lot of this.active.values())value=number(value-lot.collateral-lot.entryFee);return value;}
 collateral(){let total=0;for(const lot of this.active.values())total=number(total+lot.collateral);return total;}
 equity(raw:number){
  // Collateral is an obligation, not an extra asset or spendable short-sale proceeds.
  let value=number(this.initial+this.realized());
  for(const lot of this.active.values()){
   const exit=this.price(raw,false),gain=number(this.sign*lot.quantity*(exit-lot.entryPrice)),fee=number(lot.quantity*exit*this.fee);
   value=number(value+gain-lot.entryFee-fee);
  }
  return value;
 }
 acquire(intent:Intent,boundary:Boundary,collateral:number){
  const entryPrice=this.price(boundary.price,true),quantity=number(collateral/entryPrice),entryFee=number(collateral*this.fee);
  if(quantity<=0)throw new ReferenceFailure('NUMERICAL_LIMIT');
  const lot:Lot={id:'demo_position_'+(++this.sequence),direction:this.direction,entryBar:boundary.index,entryAt:boundary.at,quantity,entryPrice,collateral,entryFee,gridLevel:intent.gridLevel,signalId:intent.signalId};
  // Check the finite ledger balance before admitting a new obligation.
  number(this.cash()-collateral-entryFee);this.active.set(lot.id,lot);return lot;
 }
 dispose(lot:Lot,boundary:Boundary,reason:DemoTrade['reason']){
  if(this.completed.length>=caps.trades)throw new ReferenceFailure('RESULT_LIMIT');
  const exitPrice=this.price(boundary.price,false),exitFee=number(lot.quantity*exitPrice*this.fee),grossPnl=number(this.sign*lot.quantity*(exitPrice-lot.entryPrice)),release=number(lot.collateral+grossPnl-exitFee),netPnl=number(grossPnl-lot.entryFee-exitFee);
  number(this.cash()+release);
  const trade:DemoTrade={...lot,exitBar:boundary.index,exitAt:boundary.at,exitPrice,exitFee,grossPnl,netPnl,reason};this.active.delete(lot.id);this.completed.push(trade);return {trade,release};
 }
}

/** Independent prefix arithmetic; no indicator table or decision from the primary evaluator is reused. */
class Observations{
 private means=new Map<string,number|null>();
 private oscillators=new Map<string,number|null>();
 constructor(private closes:readonly number[]){}
 mean(period:number,end:number):number|null{
  if(end<0||end+1<period)return null;const key=period+':'+end;if(this.means.has(key))return this.means.get(key)!;
  let sum=0;for(let offset=0;offset<period;offset++)sum=number(sum+this.closes[end-period+1+offset]);const result=number(sum/period);this.means.set(key,result);return result;
 }
 rsi(period:number,end:number):number|null{
  if(end<0)return null;const key=period+':'+end;if(this.oscillators.has(key))return this.oscillators.get(key)!;
  let gains=0,losses=0;
  for(let k=1;k<=Math.min(period,end);k++){const difference=number(this.closes[k]-this.closes[k-1]);gains=number(gains+Math.max(0,difference));losses=number(losses+Math.max(0,-difference));}
  if(end<period){this.oscillators.set(key,null);return null;}gains/=period;losses/=period;
  for(let k=period+1;k<=end;k++){const difference=number(this.closes[k]-this.closes[k-1]);gains=number((gains*(period-1)+Math.max(0,difference))/period);losses=number((losses*(period-1)+Math.max(0,-difference))/period);}
  const result=losses===0?(gains===0?50:100):number(100-100/(1+gains/losses));this.oscillators.set(key,result);return result;
 }
 value(indicator:'PRICE_SMA'|'RSI'|'RETURN',period:number,end:number):number|null{
  if(end<0)return null;if(indicator==='RSI')return this.rsi(period,end);
  if(indicator==='PRICE_SMA'){const average=this.mean(period,end);return average===null?null:number(this.closes[end]/average);}
  return end<period?null:number(100*(this.closes[end]/this.closes[end-period]-1));
 }
}

/** Fixed first-party local implementation. Input must already pass the strict canonical request contract. */
export function referenceReplay(input:DemoRequest):ReferenceResult{
 const definition=input.strategy.record.content.definition,bars=input.dataset.bars,step=intervals[input.dataset.timeframe],direction=definition.market.direction,sign=direction==='LONG'?1:-1;
 const book=new Portfolio(input.initialCapital,direction,definition.costs.feeBps/10000,definition.costs.slippageBps/10000),observations=new Observations(bars.map(bar=>bar.close));
 const audit:Audit[]=[],equity:DemoEquity[]=[],available=[...input.signals].sort((a,b)=>a.availableAt<b.availableAt?-1:a.availableAt>b.availableAt?1:a.observedAt<b.observedAt?-1:a.observedAt>b.observedAt?1:a.id<b.id?-1:a.id>b.id?1:0),used=new Set<string>();
 let queued:Intent|null=null,filledDca=0,openingDay='',dayReference=input.initialCapital,dayLocked=false,lastClosingEquity=input.initialCapital,failure:Reason|null=null,emergency=false;
 let boundary:Boundary={index:0,at:new Date(Date.parse(bars[0].closedAt)-step).toISOString(),price:bars[0].open};
 let lastObserved:Boundary={...boundary};
 const note=(type:Audit['type'],reason:Reason,index:number|null,at:string|null,positionId:string|null=null,signalId:string|null=null)=>{
  if(audit.length>=caps.audit-1)throw new ReferenceFailure('RESULT_LIMIT');audit.push({barIndex:index,at,type,reason,positionId,signalId});
 };
 const atClose=(index:number)=>bars[index].closedAt;
 const exit=(lot:Lot,price:number,at:string,reason:DemoTrade['reason'])=>{
  lastObserved={index:boundary.index,price,at};const {release}=book.dispose(lot,lastObserved,reason);note('EXIT',reason,boundary.index,at,lot.id,lot.signalId);
  if(release<0||book.cash()<=0)throw new ReferenceFailure('INSOLVENT');
 };
 const liquidate=(price:number,at:string,reason:DemoTrade['reason'])=>{for(const lot of [...book.active.values()])exit(lot,price,at,reason);};
 const dailyCheck=(price:number,at:string)=>{
  if(dayLocked||book.equity(price)>number(dayReference*(1-definition.risk.maxDailyLossPct/100)))return;
  dayLocked=true;queued=null;note('HALT','DAILY_LOSS',boundary.index,at);liquidate(price,at,'DAILY_LOSS');
 };
 const snapshot=(index:number)=>{lastClosingEquity=book.equity(bars[index].close);equity.push({barIndex:index,closedAt:atClose(index),equity:lastClosingEquity,cash:book.cash(),reservedCollateral:book.collateral(),openPositions:book.active.size,dailyHalted:dayLocked});};
 const schedule=(index:number):Intent|null=>{
  const rule=definition.entry;
  if(rule.type==='SIGNAL'){
   const matching:typeof available=[];
   for(const signal of available){
    if(used.has(signal.id)||signal.availableAt>atClose(index))continue;used.add(signal.id);
    if(signal.provider!==rule.provider){note('REJECTION','PROVIDER_MISMATCH',index,atClose(index),null,signal.id);continue;}
    if(signal.event!==rule.event){note('REJECTION','EVENT_MISMATCH',index,atClose(index),null,signal.id);continue;}
    if((Date.parse(atClose(index))-Date.parse(signal.observedAt))/step>rule.maxAgeBars){note('REJECTION','STALE_SIGNAL',index,atClose(index),null,signal.id);continue;}
    matching.push(signal);
   }
   if(!matching.length){note('DECISION','MISSING_SIGNAL',index,atClose(index));return null;}
   for(const signal of matching)note('SIGNAL','SIGNAL_CONSUMED',index,atClose(index),null,signal.id);
   return {reason:'ENTRY_RULE',gridLevel:null,signalId:matching[0].id};
  }
  let accepted=false,missing=false,gridLevel:number|null=null;
  switch(rule.type){
   case 'TREND':{
    const currentFast=observations.mean(rule.fastPeriod,index),currentSlow=observations.mean(rule.slowPeriod,index),beforeFast=observations.mean(rule.fastPeriod,index-1),beforeSlow=observations.mean(rule.slowPeriod,index-1);
    missing=currentFast===null||currentSlow===null||rule.confirmation==='CROSS'&&(beforeFast===null||beforeSlow===null);
    if(!missing)accepted=sign*(currentFast!-currentSlow!)>0&&(rule.confirmation==='ALIGNED'||sign*(beforeFast!-beforeSlow!)<=0);
    break;
   }
   case 'RSI':{const oscillator=observations.rsi(rule.period,index);missing=oscillator===null;accepted=oscillator!==null&&(rule.comparison==='BELOW'?oscillator<rule.threshold:oscillator>rule.threshold);break;}
   case 'BREAKOUT':{
    missing=index<rule.lookback;if(!missing){let limit=sign===1?-Infinity:Infinity;for(let k=index-rule.lookback;k<index;k++)limit=sign===1?Math.max(limit,bars[k].high):Math.min(limit,bars[k].low);accepted=sign*(bars[index].close-limit)>0;}break;
   }
   case 'DCA':
    if(filledDca>=rule.maxEntries){note('DECISION','DCA_EXHAUSTED',index,atClose(index));return null;}accepted=index%rule.intervalBars===0;break;
   case 'GRID':{
    missing=index===0;if(!missing){const crossed:number[]=[];for(let k=0;k<rule.levels;k++){const price=number(rule.lowerPrice+(rule.upperPrice-rule.lowerPrice)*k/(rule.levels-1));if(sign===1?bars[index-1].close>price&&bars[index].close<=price:bars[index-1].close<price&&bars[index].close>=price)crossed.push(k);}
     if(sign===1)crossed.reverse();gridLevel=crossed.find(level=>![...book.active.values()].some(lot=>lot.gridLevel===level))??null;accepted=gridLevel!==null;
     if(!accepted&&crossed.length)note('REJECTION','GRID_LEVEL_ACTIVE',index,atClose(index));
    }break;
   }
   case 'RULES':{
    const outcomes:(boolean|null)[]=[];
    for(const condition of rule.conditions){const current=observations.value(condition.indicator,condition.period,index),before=observations.value(condition.indicator,condition.period,index-1);
     if(current===null||condition.comparison.startsWith('CROSSES_')&&before===null){outcomes.push(null);continue;}
     switch(condition.comparison){case 'GT':outcomes.push(current>condition.threshold);break;case 'LT':outcomes.push(current<condition.threshold);break;case 'CROSSES_ABOVE':outcomes.push(current>condition.threshold&&before!<=condition.threshold);break;case 'CROSSES_BELOW':outcomes.push(current<condition.threshold&&before!>=condition.threshold);break;}
    }
    missing=outcomes.includes(null);accepted=!missing&&(rule.match==='ALL'?outcomes.every(result=>result===true):outcomes.some(result=>result===true));break;
   }
  }
  if(missing){note('WARMUP','WARMUP',index,atClose(index));return null;}if(!accepted)return null;
  const reason=rule.type==='GRID'?'GRID_CROSS':rule.type==='DCA'?'DCA_INTERVAL':'ENTRY_RULE';note('DECISION',reason,index,atClose(index));return {reason,gridLevel,signalId:null};
 };
 const admit=(intent:Intent)=>{
  if(book.active.size>=definition.risk.maxOpenPositions){note('REJECTION','POSITION_LIMIT',boundary.index,boundary.at,null,intent.signalId);return;}
  const marked=book.equity(boundary.price),budget=number(marked*definition.risk.positionPct/100),remaining=number(budget-book.collateral()),partitions=definition.entry.type==='DCA'?definition.entry.maxEntries:definition.entry.type==='GRID'?definition.entry.levels:definition.risk.maxOpenPositions;
  if(marked<=0)throw new ReferenceFailure('INSOLVENT');
  if(remaining<=input.initialCapital*1e-12){note('REJECTION','ALLOCATION_LIMIT',boundary.index,boundary.at,null,intent.signalId);return;}
  const collateral=number(Math.min(budget/partitions,remaining,book.cash()/(1+book.fee)));
  if(collateral<=input.initialCapital*1e-12){note('REJECTION','CASH_LIMIT',boundary.index,boundary.at,null,intent.signalId);return;}
  const lot=book.acquire(intent,boundary,collateral);if(definition.entry.type==='DCA')filledDca++;
  note('ENTRY',intent.reason,boundary.index,boundary.at,lot.id,lot.signalId);
 };
 try{
  for(let index=0;index<bars.length;index++){
   const candle=bars[index],opening=new Date(Date.parse(candle.closedAt)-step).toISOString();boundary={index,at:opening,price:candle.open};lastObserved={...boundary};
   if(opening.slice(0,10)!==openingDay){if(openingDay)note('RESET','DAILY_RESET',index,opening);openingDay=opening.slice(0,10);dayReference=lastClosingEquity;dayLocked=false;}
   // Observable opening boundary: risk on existing lots precedes a queued entry.
   if(input.emergencyStopAt!==null&&input.emergencyStopAt<=opening){queued=null;note('HALT','EMERGENCY_STOP',index,opening);liquidate(candle.open,opening,'EMERGENCY_STOP');emergency=true;snapshot(index);break;}
   for(const lot of [...book.active.values()]){
    const stop=lot.entryPrice*(1-sign*definition.risk.stopLossPct/100),target=lot.entryPrice*(1+sign*definition.risk.takeProfitPct/100);
    if(sign*(candle.open-stop)<=0)exit(lot,candle.open,opening,'STOP_LOSS');else if(sign*(candle.open-target)>=0)exit(lot,target,opening,'TAKE_PROFIT');
   }
   dailyCheck(candle.open,opening);
   if(queued){const intent=queued;queued=null;if(dayLocked)note('REJECTION','DAILY_LOSS',index,opening,null,intent.signalId);else admit(intent);}
   for(const lot of [...book.active.values()]){const stop=number(lot.entryPrice*(1-sign*definition.risk.stopLossPct/100));if(sign*(candle.open-stop)<=0)exit(lot,candle.open,opening,'STOP_LOSS');}
   // At the close OHLC is observable, but the path is unknown: all stops, adverse risk, then targets.
   boundary={index,at:candle.closedAt,price:sign===1?candle.low:candle.high};lastObserved={...boundary};
   for(const lot of [...book.active.values()]){const stop=number(lot.entryPrice*(1-sign*definition.risk.stopLossPct/100));if(sign===1?candle.low<=stop:candle.high>=stop)exit(lot,stop,candle.closedAt,'STOP_LOSS');}
   dailyCheck(sign===1?candle.low:candle.high,candle.closedAt);
   for(const lot of [...book.active.values()]){const target=number(lot.entryPrice*(1+sign*definition.risk.takeProfitPct/100));if(sign===1?candle.high>=target:candle.low<=target)exit(lot,target,candle.closedAt,'TAKE_PROFIT');}
   if(input.emergencyStopAt!==null&&input.emergencyStopAt<=candle.closedAt){queued=null;note('HALT','EMERGENCY_STOP',index,candle.closedAt);liquidate(candle.close,candle.closedAt,'EMERGENCY_STOP');emergency=true;snapshot(index);break;}
   dailyCheck(candle.close,candle.closedAt);if(!dayLocked)queued=schedule(index);snapshot(index);
   if(index===bars.length-1){if(queued)note('REJECTION','END_OF_DATA',index,candle.closedAt,null,queued.signalId);queued=null;liquidate(candle.close,candle.closedAt,'END_OF_DATA');equity.pop();snapshot(index);}
  }
 }catch(error){
  failure=error instanceof ReferenceFailure?error.reason:'NUMERICAL_LIMIT';queued=null;
  if(failure==='INSOLVENT'){
   const last={...lastObserved};for(const lot of [...book.active.values()]){try{exit(lot,last.price,last.at,'INSOLVENT');}catch(next){if(next instanceof ReferenceFailure&&next.reason!=='INSOLVENT'){failure=next.reason;break;}}}
   try{if(equity.at(-1)?.barIndex===boundary.index)equity.pop();snapshot(boundary.index);}catch{failure='NUMERICAL_LIMIT';}
  }
  if(audit.length<caps.audit)audit.push({barIndex:boundary.index,at:lastObserved.at,type:'FAILURE',reason:failure,positionId:null,signalId:null});
 }
 for(const signal of available)if(!used.has(signal.id)&&audit.length<caps.audit-1)audit.push({barIndex:null,at:null,type:'REJECTION',reason:'SIGNAL_UNUSED',positionId:null,signalId:signal.id});
 let metrics:DemoArtifact['metrics']=null,benchmark:DemoArtifact['benchmark']=null;
 try{
  const comparable=failure===null&&direction==='LONG'&&!emergency;
  if(failure===null||failure==='INSOLVENT'){
   const finalEquity=equity.at(-1)?.equity??input.initialCapital;let highest=input.initialCapital,drawdown=0;
   for(const point of equity){highest=Math.max(highest,point.equity);drawdown=Math.max(drawdown,number(100*(highest-point.equity)/highest));}
   let fees=0,turnover=0;for(const trade of book.completed){fees=number(fees+trade.entryFee+trade.exitFee);turnover=number(turnover+trade.quantity*(trade.entryPrice+trade.exitPrice));}
   for(const lot of book.active.values()){fees=number(fees+lot.entryFee);turnover=number(turnover+lot.collateral);}
   metrics={initialCapital:input.initialCapital,finalEquity,netPnl:number(finalEquity-input.initialCapital),returnPct:number(100*(finalEquity/input.initialCapital-1)),maxDrawdownPct:drawdown,trades:book.completed.length,wins:book.completed.filter(trade=>trade.netPnl>0).length,losses:book.completed.filter(trade=>trade.netPnl<0).length,totalFees:fees,turnover,comparable};
  }
  // Separate full-period LONG counterfactual, sharing only declared allocation/cost assumptions.
  const first=number(bars[1].open*(1+book.slippage)),last=number(bars.at(-1)!.close*(1-book.slippage)),allocation=number(Math.min(input.initialCapital*definition.risk.positionPct/100,input.initialCapital/(1+book.fee))),quantity=number(allocation/first),fees=number(allocation*book.fee+quantity*last*book.fee),finalEquity=number(input.initialCapital+quantity*(last-first)-fees);
  benchmark={status:'COMPLETED',reason:null,allocationPct:definition.risk.positionPct,direction:'LONG',initialCapital:input.initialCapital,finalEquity,netPnl:number(finalEquity-input.initialCapital),returnPct:number(100*(finalEquity/input.initialCapital-1)),totalFees:fees,comparable};
 }catch{
  if(failure===null){failure='NUMERICAL_LIMIT';if(audit.length<caps.audit)audit.push({barIndex:boundary.index,at:bars[boundary.index].closedAt,type:'FAILURE',reason:failure,positionId:null,signalId:null});}metrics=null;benchmark=null;
 }
 const status:ReferenceResult['status']=failure!==null?'FAILED':emergency||dayLocked?'HALTED':book.completed.length?'COMPLETED':'NO_TRADES';
 return {status,reason:failure??(emergency?'EMERGENCY_STOP':dayLocked?'DAILY_LOSS':book.completed.length?null:'NO_TRADES'),audit,trades:book.completed,equity,metrics,benchmark};
}
