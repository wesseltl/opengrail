import {syntheticDemoInput} from './demo-engine';
import {boundedStrategyRecord,strategyDigest,strategyTemplate} from './strategy-model';
import {sessionConfigSchema,sessionEventSchema,sessionVersion,type SessionConfig,type SessionEvent} from './session-model';
import type {DemoStrategy} from './demo-model';

/** Invented prices and virtual clock, never a market adapter or historical availability evidence. */
export async function syntheticSessionExample(selected?:DemoStrategy):Promise<{config:SessionConfig;startedAt:string;events:Array<{event:SessionEvent;receivedAt:string}>}>{
 let strategy=selected;
 if(!strategy){
  const seed=await syntheticDemoInput(),record=structuredClone(seed.strategy.record),definition=strategyTemplate('SIGNAL');
  definition.entry={type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:3};
  record.content.definition=definition;record.content.name='Invented continuous signal fixture';
  strategy={record,digest:await strategyDigest(boundedStrategyRecord(record).payload)};
 }
 const input=await syntheticDemoInput(strategy),first=input.dataset.bars[0];
 const step=({ '5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000} as const)[input.dataset.timeframe];
 const startedAt=new Date(Date.parse(first.closedAt)-step).toISOString();
 const config=sessionConfigSchema.parse({version:1,sessionId:'00000000-0000-4000-8000-000000000500',methodVersion:sessionVersion,clockMode:'SYNTHETIC_PLAYBACK',origin:selected?'PUBLIC_STRATEGY':'SYNTHETIC_FIXTURE',strategy:input.strategy,initialCapital:input.initialCapital,provenance:'SYNTHETIC',rights:input.dataset.rights,sourceLabel:'Invented triangular-wave event stream',ordersEnabled:false,liveEnabled:false});
 const events:Array<{event:SessionEvent;receivedAt:string}>=[];let serial=1000;
 const id=()=> '00000000-0000-4000-8000-'+String(serial++).padStart(12,'0');
 for(const bar of input.dataset.bars){
  events.push({event:sessionEventSchema.parse({requestId:id(),type:'CLOSED_BAR',bar}),receivedAt:bar.closedAt});
  for(const signal of input.signals.filter(v=>v.observedAt===bar.closedAt))events.push({event:sessionEventSchema.parse({requestId:id(),type:'SIGNAL',signal}),receivedAt:new Date(Date.parse(bar.closedAt)+1).toISOString()});
  const at=new Date(Date.parse(bar.closedAt)+2).toISOString();
  events.push({event:sessionEventSchema.parse({requestId:id(),type:'QUOTE',observedAt:at,price:bar.close}),receivedAt:at});
 }
 return {config,startedAt,events};
}
