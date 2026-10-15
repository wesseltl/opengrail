import {boundedSessionConfig,boundedSessionEvent,sessionClock,sessionDigest,sessionLimits,sessionMethod,sessionStateDigest,sessionStateSchema,verifySessionState,SessionError,type SessionConfig,type SessionState,type SessionEvent,type SessionPosition,type SessionTrade,type SessionAudit} from './session-model';
import {boundedStrategyRecord} from './strategy-model';
import {demoTimeframes} from './demo-model';

type Reason=SessionAudit['reason'];
class ArithmeticFailure extends Error{}
const finite=(n:number)=>{if(!Number.isFinite(n))throw new ArithmeticFailure();return n;};
const positive=(n:number)=>{finite(n);if(n<=0)throw new ArithmeticFailure();return n;};
const blank='0'.repeat(64);

export async function createSession(rawConfig:unknown,startedAt:unknown):Promise<SessionState>{
 const {config}=boundedSessionConfig(rawConfig),at=sessionClock(startedAt),methodDigest=await sessionDigest(JSON.stringify(sessionMethod));
 if(config.strategy.digest!==await sessionDigest(boundedStrategyRecord(config.strategy.record).payload))throw new SessionError('The exact strategy digest does not match.');
 const headDigest=await sessionDigest(JSON.stringify({config,startedAt:at,methodDigest}));
 const state:SessionState={version:1,classification:'AUTHOR_REPORTED',qualification:'NONE',mode:'DEMO',ordersEnabled:false,liveEnabled:false,config,startedAt:at,lastReceivedAt:at,methodDigest,status:'ACTIVE',failure:null,capacityHalted:false,dataGap:false,emergencyAt:null,sequence:0,headDigest,events:[],bars:[],quotes:[],signals:[],consumed:[],pending:null,openPositions:[],trades:[],audit:[{sequence:0,at,sourceObservedAt:null,barIndex:null,type:'START',reason:'STARTED',positionId:null,signalId:null}],equity:[],daily:{day:at.slice(0,10),baseline:config.initialCapital,halted:false},counters:{positions:0,dcaEntries:0},account:{markedAt:null,sourceObservedAt:null,cash:config.initialCapital,equity:config.initialCapital,reservedCollateral:0,unrealizedPnl:0,realizedPnl:0,totalFees:0,turnover:0},stateDigest:blank};
 state.stateDigest=await sessionStateDigest(state);return state;
}

/** Current quote mark, including both paid entry and estimated adverse exit costs. */
export function sessionPositionMark(state:SessionState,position:SessionPosition){
 try{const quote=state.quotes.at(-1);if(!quote)return null;
 const d=state.config.strategy.record.content.definition,sign=position.direction==='LONG'?1:-1,exitPrice=positive(quote.price*(1-sign*d.costs.slippageBps/10000)),exitFee=finite(position.quantity*exitPrice*d.costs.feeBps/10000),grossPnl=finite(sign*position.quantity*(exitPrice-position.entryPrice));
 return {at:quote.receivedAt,observedAt:quote.observedAt,exitPrice,estimatedExitFee:exitFee,grossPnl,netPnl:finite(grossPnl-position.entryFee-exitFee)};
 }catch{return null;}
}

/** Incremental state transition. No stream-tail liquidation, historical fill or batch replay. */
export async function advanceSession(rawState:unknown,rawEvent:unknown,receivedAt:unknown):Promise<SessionState>{
 const original=await verifySessionState(rawState),{event,payload}=boundedSessionEvent(rawEvent),at=sessionClock(receivedAt),eventDigest=await sessionDigest(payload),old=original.events.find(e=>e.requestId===event.requestId);
 if(old){if(old.eventDigest!==eventDigest)throw new SessionError('The request ID already names another event.',409);return original;}
 const reserved=event.type==='EMERGENCY'||event.type==='QUOTE';
 if(original.sequence>=sessionLimits.events+sessionLimits.emergencyReserve||original.sequence>=sessionLimits.events&&!reserved)throw new SessionError('Session capacity is exhausted; only reserved emergency/risk quote intake remains.',429);
 // Canonical parsing above created a detached plain snapshot; no caller object is mutated.
 const s=original,d=s.config.strategy.record.content.definition,sign=d.market.direction==='LONG'?1:-1,fee=d.costs.feeBps/10000,slip=d.costs.slippageBps/10000,step=demoTimeframes[d.market.timeframe];
 s.sequence++;
 let disposition:'ACCEPTED'|'REJECTED'='ACCEPTED',receiptReason:Reason=event.type==='QUOTE'?'QUOTE_RECEIVED':event.type==='CLOSED_BAR'?'BAR_RECEIVED':event.type==='SIGNAL'?'SIGNAL_RECEIVED':event.type==='PAUSE'?'PAUSED':event.type==='RESUME'?'RESUMED':'EMERGENCY_STOP';
 const source=event.type==='QUOTE'?event.observedAt:event.type==='CLOSED_BAR'?event.bar.closedAt:event.type==='SIGNAL'?event.signal.observedAt:null;
 const note=(type:SessionAudit['type'],reason:Reason,positionId:string|null=null,signalId:string|null=null)=>{if(s.audit.length>=sessionLimits.audit)throw new SessionError('Audit capacity is exhausted.',429);s.audit.push({sequence:s.sequence,at,sourceObservedAt:source,barIndex:s.bars.length?s.bars.length-1:null,type,reason,positionId,signalId});};
 const reject=(reason:Reason)=>{disposition='REJECTED';receiptReason=reason;note('REJECTION',reason,null,event.type==='SIGNAL'?event.signal.id:null);};
 const mark=(raw:number)=>{
  let realized=0,fees=0,turnover=0,reservedCollateral=0,unrealizedPnl=0;
  for(const t of s.trades){realized=finite(realized+t.netPnl);fees=finite(fees+t.entryFee+t.exitFee);turnover=finite(turnover+t.quantity*(t.entryPrice+t.exitPrice));}
  let cash=finite(s.config.initialCapital+realized);
  for(const p of s.openPositions){const exit=positive(raw*(1-sign*slip)),gross=finite(sign*p.quantity*(exit-p.entryPrice)),exitFee=finite(p.quantity*exit*fee);reservedCollateral=finite(reservedCollateral+p.collateral);cash=finite(cash-p.collateral-p.entryFee);unrealizedPnl=finite(unrealizedPnl+gross-p.entryFee-exitFee);fees=finite(fees+p.entryFee);turnover=finite(turnover+p.collateral);}
  return {markedAt:at,sourceObservedAt:source,cash,equity:finite(s.config.initialCapital+realized+unrealizedPnl),reservedCollateral,unrealizedPnl,realizedPnl:realized,totalFees:fees,turnover};
 };
 const close=(p:SessionPosition,quote:Extract<SessionEvent,{type:'QUOTE'}>,reason:SessionTrade['reason'])=>{
  if(s.trades.length>=sessionLimits.trades)throw new ArithmeticFailure();
  const exitPrice=positive(quote.price*(1-sign*slip)),exitFee=finite(p.quantity*exitPrice*fee),grossPnl=finite(sign*p.quantity*(exitPrice-p.entryPrice)),netPnl=finite(grossPnl-p.entryFee-exitFee);
  const t:SessionTrade={id:p.id,direction:p.direction,entryBar:p.entryBar,exitBar:s.bars.length-1,entryAt:p.entryAt,exitAt:at,entryObservedAt:p.entryObservedAt,exitObservedAt:quote.observedAt,quantity:p.quantity,entryPrice:p.entryPrice,exitPrice,collateral:p.collateral,entryFee:p.entryFee,exitFee,grossPnl,netPnl,reason,gridLevel:p.gridLevel,signalId:p.signalId};
  s.trades.push(t);s.openPositions=s.openPositions.filter(l=>l.id!==p.id);note('EXIT',reason,p.id,p.signalId);
 };
 const closeAll=(q:Extract<SessionEvent,{type:'QUOTE'}>,reason:SessionTrade['reason'])=>{for(const p of [...s.openPositions])close(p,q,reason);s.account=mark(q.price);};
 const stopFailure=(reason:'INSOLVENT'|'NUMERICAL_LIMIT',quote?:Extract<SessionEvent,{type:'QUOTE'}>)=>{
  s.status='FAILED';s.failure=reason;s.pending=null;receiptReason=reason;note('FAILURE',reason);
  if(reason==='INSOLVENT'&&quote){closeAll(quote,'INSOLVENT');s.account=mark(quote.price);}
 };
 const dailyCheck=(q:Extract<SessionEvent,{type:'QUOTE'}>)=>{
  s.account=mark(q.price);
  if(s.account.equity<=0){stopFailure('INSOLVENT',q);return;}
  if(!s.daily.halted&&s.account.equity<=finite(s.daily.baseline*(1-d.risk.maxDailyLossPct/100))){s.daily.halted=true;s.pending=null;note('HALT','DAILY_LOSS');closeAll(q,'DAILY_LOSS');}
 };
 const mayEnter=()=>s.status==='ACTIVE'&&!s.daily.halted&&!s.capacityHalted&&!s.dataGap&&s.emergencyAt===null;
 const queue=(reason:'ENTRY_RULE'|'DCA_INTERVAL'|'GRID_CROSS'|'SIGNAL_RECEIVED',gridLevel:number|null=null,signalId:string|null=null)=>{
  if(!mayEnter())return;if(s.pending){note('REJECTION','PENDING_ENTRY',null,signalId);return;}
  s.pending={decisionKnownAt:at,barIndex:s.bars.length-1,sequence:s.sequence,reason,gridLevel,signalId};note('DECISION',reason,null,signalId);
 };
 // Prefix-only indicators are recomputed from retained closed observations, never quotes/future bars.
 const mean=(period:number,end:number):number|null=>{if(end+1<period||end<0)return null;let total=0;for(let k=end-period+1;k<=end;k++)total=finite(total+s.bars[k].close);return finite(total/period);};
 const rsi=(period:number,end:number):number|null=>{if(end<0)return null;let gain=0,loss=0;for(let k=1;k<=Math.min(period,end);k++){const change=finite(s.bars[k].close-s.bars[k-1].close);gain=finite(gain+Math.max(0,change));loss=finite(loss+Math.max(0,-change));}if(end<period)return null;gain/=period;loss/=period;for(let k=period+1;k<=end;k++){const change=finite(s.bars[k].close-s.bars[k-1].close);gain=finite((gain*(period-1)+Math.max(0,change))/period);loss=finite((loss*(period-1)+Math.max(0,-change))/period);}return loss===0?gain===0?50:100:finite(100-100/(1+gain/loss));};
 const value=(indicator:'PRICE_SMA'|'RSI'|'RETURN',period:number,n:number):number|null=>{if(n<0)return null;if(indicator==='RSI')return rsi(period,n);if(indicator==='RETURN')return n<period?null:finite(100*(s.bars[n].close/s.bars[n-period].close-1));const m=mean(period,n);return m===null?null:finite(s.bars[n].close/m);};
 const signalDecision=(id?:string)=>{
  if(d.entry.type!=='SIGNAL'||!mayEnter())return;const rule=d.entry,n=s.bars.length-1;if(n<0)return;if(Date.parse(at)-Date.parse(s.bars[n].closedAt)>2*step){note('REJECTION','STALE_BAR',null,id??null);return;}
  for(const stored of s.signals){const signal=stored.signal;if(id&&id!==signal.id||s.consumed.includes(signal.id))continue;s.consumed.push(signal.id);
   if(signal.provider!==rule.provider){note('REJECTION','PROVIDER_MISMATCH',null,signal.id);continue;}
   if(signal.event!==rule.event){note('REJECTION','EVENT_MISMATCH',null,signal.id);continue;}
   const age=(Date.parse(s.bars[n].closedAt)-Date.parse(signal.observedAt))/step;
   if(age<0||age>rule.maxAgeBars){note('REJECTION','STALE_SIGNAL',null,signal.id);continue;}
   note('RECEIPT','SIGNAL_CONSUMED',null,signal.id);queue('SIGNAL_RECEIVED',null,signal.id);
  }
 };
 const barDecision=()=>{
  const n=s.bars.length-1,rule=d.entry;if(!mayEnter())return;if(Date.parse(at)-Date.parse(s.bars[n].closedAt)>2*step){s.pending=null;note('WARMUP','STALE_BAR');return;}if(rule.type==='SIGNAL'){signalDecision();return;}
  let yes=false,warm=false,gridLevel:number|null=null;
  switch(rule.type){
   case 'DCA':if(s.counters.dcaEntries>=rule.maxEntries){note('DECISION','DCA_EXHAUSTED');return;}yes=n%rule.intervalBars===0;break;
   case 'TREND':{const f=mean(rule.fastPeriod,n),slow=mean(rule.slowPeriod,n),pf=mean(rule.fastPeriod,n-1),ps=mean(rule.slowPeriod,n-1);warm=f===null||slow===null||rule.confirmation==='CROSS'&&(pf===null||ps===null);yes=!warm&&sign*(f!-slow!)>0&&(rule.confirmation==='ALIGNED'||sign*(pf!-ps!)<=0);break;}
   case 'RSI':{const v=rsi(rule.period,n);warm=v===null;yes=v!==null&&(rule.comparison==='BELOW'?v<rule.threshold:v>rule.threshold);break;}
   case 'BREAKOUT':warm=n<rule.lookback;if(!warm){let bound=sign===1?-Infinity:Infinity;for(let k=n-rule.lookback;k<n;k++)bound=sign===1?Math.max(bound,s.bars[k].high):Math.min(bound,s.bars[k].low);yes=sign*(s.bars[n].close-bound)>0;}break;
   case 'GRID':{warm=n===0;if(!warm){const crossed:number[]=[];for(let k=0;k<rule.levels;k++){const price=finite(rule.lowerPrice+(rule.upperPrice-rule.lowerPrice)*k/(rule.levels-1));if(sign===1?s.bars[n-1].close>price&&s.bars[n].close<=price:s.bars[n-1].close<price&&s.bars[n].close>=price)crossed.push(k);}if(sign===1)crossed.reverse();gridLevel=crossed.find(level=>!s.openPositions.some(p=>p.gridLevel===level))??null;yes=gridLevel!==null;if(!yes&&crossed.length)note('REJECTION','GRID_LEVEL_ACTIVE');}break;}
   case 'RULES':{const tests:(boolean|null)[]=[];for(const condition of rule.conditions){const v=value(condition.indicator,condition.period,n),previous=value(condition.indicator,condition.period,n-1);if(v===null||condition.comparison.startsWith('CROSSES_')&&previous===null){tests.push(null);continue;}tests.push(condition.comparison==='GT'?v>condition.threshold:condition.comparison==='LT'?v<condition.threshold:condition.comparison==='CROSSES_ABOVE'?v>condition.threshold&&previous!<=condition.threshold:v<condition.threshold&&previous!>=condition.threshold);}warm=tests.includes(null);yes=!warm&&(rule.match==='ALL'?tests.every(v=>v===true):tests.some(v=>v===true));break;}
  }
  if(warm)note('WARMUP','WARMUP');else if(yes)queue(rule.type==='DCA'?'DCA_INTERVAL':rule.type==='GRID'?'GRID_CROSS':'ENTRY_RULE',gridLevel);else note('DECISION','NO_ENTRY_RULE');
 };
 const admit=(q:Extract<SessionEvent,{type:'QUOTE'}>)=>{
  const p=s.pending;if(!p||!mayEnter())return;if(Date.parse(at)-Date.parse(s.bars[p.barIndex].closedAt)>2*step){s.pending=null;note('REJECTION','STALE_BAR',null,p.signalId);return;}
  if(at<=p.decisionKnownAt||q.observedAt<=p.decisionKnownAt){note('REJECTION','AWAITING_FRESH_QUOTE',null,p.signalId);return;}
  s.pending=null;
  if(s.openPositions.length>=d.risk.maxOpenPositions){note('REJECTION','POSITION_LIMIT',null,p.signalId);return;}
  if(p.gridLevel!==null&&s.openPositions.some(l=>l.gridLevel===p.gridLevel)){note('REJECTION','GRID_LEVEL_ACTIVE',null,p.signalId);return;}
  if(d.entry.type==='DCA'&&s.counters.dcaEntries>=d.entry.maxEntries){note('REJECTION','DCA_EXHAUSTED');return;}
  s.account=mark(q.price);const budget=finite(s.account.equity*d.risk.positionPct/100),remaining=finite(budget-s.account.reservedCollateral),partitions=d.entry.type==='DCA'?d.entry.maxEntries:d.entry.type==='GRID'?d.entry.levels:d.risk.maxOpenPositions;
  if(remaining<=s.config.initialCapital*1e-12){note('REJECTION','ALLOCATION_LIMIT',null,p.signalId);return;}
  const collateral=finite(Math.min(budget/partitions,remaining,s.account.cash/(1+fee)));if(collateral<=s.config.initialCapital*1e-12){note('REJECTION','CASH_LIMIT',null,p.signalId);return;}
  const entryPrice=positive(q.price*(1+sign*slip)),quantity=positive(collateral/entryPrice),entryFee=finite(collateral*fee),stopLoss=positive(entryPrice*(1-sign*d.risk.stopLossPct/100)),takeProfit=positive(entryPrice*(1+sign*d.risk.takeProfitPct/100));
  const lot:SessionPosition={id:'session_position_'+(++s.counters.positions),direction:d.market.direction,entryBar:p.barIndex,entryAt:at,entryObservedAt:q.observedAt,entrySequence:s.sequence,quantity,entryPrice,collateral,entryFee,stopLoss,takeProfit,gridLevel:p.gridLevel,signalId:p.signalId};
  s.openPositions.push(lot);if(d.entry.type==='DCA')s.counters.dcaEntries++;note('ENTRY',p.reason,lot.id,p.signalId);
  // Adverse entry slippage can itself put the current raw quote beyond the new stop.
  if(sign*(q.price-lot.stopLoss)<=0)close(lot,q,'STOP_LOSS');s.account=mark(q.price);
 };
 try{
  if(at<s.lastReceivedAt)reject('OUT_OF_ORDER');
  else{
   s.lastReceivedAt=at;
   if(s.sequence>=sessionLimits.events&&!s.capacityHalted){s.capacityHalted=true;s.pending=null;note('HALT','CAPACITY_LIMIT');}
   if(at.slice(0,10)!==s.daily.day&&s.account.equity>0){s.daily={day:at.slice(0,10),baseline:s.account.equity,halted:false};note('RESET','DAILY_RESET');}
   if(event.type==='PAUSE'){s.pending=null;if(s.status==='ACTIVE')s.status='PAUSED';note('CONTROL','PAUSED');}
   else if(event.type==='RESUME'){if(s.status==='PAUSED'&&!s.emergencyAt)s.status='ACTIVE';else if(s.status!=='ACTIVE')reject('SESSION_STOPPED');if(disposition==='ACCEPTED')note('CONTROL','RESUMED');}
   else if(event.type==='EMERGENCY'){s.pending=null;s.emergencyAt??=at;if(s.status!=='FAILED')s.status=s.openPositions.length?'STOPPING':'STOPPED';note('HALT','EMERGENCY_STOP');}
   else if(event.type==='QUOTE'){
    const now=Date.parse(at),observed=Date.parse(event.observedAt),previous=s.quotes.at(-1);
    if(observed>now)reject('FUTURE_INPUT');else if(now-observed>sessionLimits.quoteMaxAgeMs||event.observedAt<s.startedAt)reject('STALE_QUOTE');else if(previous&&event.observedAt<=previous.observedAt)reject('OUT_OF_ORDER');else{
     s.quotes.push({observedAt:event.observedAt,receivedAt:at,price:event.price,sequence:s.sequence});note('RECEIPT','QUOTE_RECEIVED');
     // Reserve deficit is explicit terminal economic failure, never a capped short payoff.
     const breach=s.openPositions.some(p=>finite(p.collateral+sign*p.quantity*(positive(event.price*(1-sign*slip))-p.entryPrice)-p.quantity*positive(event.price*(1-sign*slip))*fee)<0);
     if(breach){stopFailure('INSOLVENT',event);}
     else if(s.emergencyAt!==null){if(at>s.emergencyAt&&event.observedAt>s.emergencyAt){closeAll(event,'EMERGENCY_STOP');if(s.status!=='FAILED')s.status='STOPPED';}else note('REJECTION','AWAITING_FRESH_QUOTE');}
     else{
      for(const p of [...s.openPositions])if(sign*(event.price-p.stopLoss)<=0)close(p,event,'STOP_LOSS');else if(sign*(event.price-p.takeProfit)>=0)close(p,event,'TAKE_PROFIT');
      dailyCheck(event);if(s.status!=='FAILED'){admit(event);dailyCheck(event);}
     }
     s.account=mark(event.price);s.equity.push({sequence:s.sequence,at,sourceObservedAt:event.observedAt,equity:s.account.equity,cash:s.account.cash,reservedCollateral:s.account.reservedCollateral,openPositions:s.openPositions.length,dailyHalted:s.daily.halted});
    }
   }else if(event.type==='CLOSED_BAR'){
    const bar=event.bar,clock=Date.parse(bar.closedAt),last=s.bars.at(-1);
    if(clock>Date.parse(at))reject('FUTURE_INPUT');else if(clock%step!==0)reject('BAR_ALIGNMENT');else if(last&&bar.closedAt<=last.closedAt)reject('OUT_OF_ORDER');else if(last&&clock-Date.parse(last.closedAt)!==step){s.dataGap=true;s.pending=null;reject('BAR_GAP');}else if(s.bars.length>=sessionLimits.bars)reject('CAPACITY_LIMIT');else{
     s.bars.push(bar);s.dataGap=false;note('RECEIPT','BAR_RECEIVED');
     if(bar.closedAt<s.startedAt)note('WARMUP','WARMUP');else barDecision();
    }
   }else if(event.type==='SIGNAL'){
    const signal=event.signal;
    if(signal.availableAt<signal.observedAt||signal.availableAt>at||signal.observedAt>at)reject('FUTURE_INPUT');else if(!s.bars.some(b=>b.closedAt===signal.observedAt))reject('UNKNOWN_SIGNAL_BAR');else if(s.signals.some(v=>v.signal.id===signal.id||v.signal.provider===signal.provider&&v.signal.event===signal.event&&v.signal.observedAt===signal.observedAt))reject('SIGNAL_DUPLICATE');else if(s.signals.length>=sessionLimits.signals)reject('CAPACITY_LIMIT');else{
     s.signals.push({signal,receivedAt:at,sequence:s.sequence});note('RECEIPT','SIGNAL_RECEIVED',null,signal.id);if(signal.observedAt>=s.startedAt)signalDecision(signal.id);else{s.consumed.push(signal.id);note('WARMUP','WARMUP',null,signal.id);}
    }
   }
  }
 }catch(error){if(!(error instanceof ArithmeticFailure))throw error;stopFailure('NUMERICAL_LIMIT');}
 const receipt={sequence:s.sequence,requestId:event.requestId,eventDigest,receivedAt:at,disposition,reason:receiptReason,previousDigest:s.headDigest,digest:blank};const {digest:_,...receiptBody}=receipt;receipt.digest=await sessionDigest(JSON.stringify(receiptBody));s.headDigest=receipt.digest;s.events.push(receipt);
 s.stateDigest=blank;const result=sessionStateSchema.parse(s);
 // The full schema above already validated and ordered this detached snapshot.
 const {stateDigest:priorStateDigest,...stateBody}=result;void priorStateDigest;result.stateDigest=await sessionDigest(JSON.stringify(stateBody));if(new TextEncoder().encode(JSON.stringify(result)).byteLength>sessionLimits.stateBytes)throw new SessionError('Session checkpoint exceeds its retained byte budget.',413);return result;
}
