import {boundedStrategyRecord,strategyDigest,strategyRecordV2Schema,type StrategyRecordV2} from './strategy-model';
import {programSourceBytes,programBinaryDigest} from './program-source-model';
import {parseProgramModule,programModuleInfo,createProgramInstance,invokeProgram,programState,ProgramWasmError} from './program-wasm';
import {boundedDemoRequest,demoEvaluatorVersion,demoLimits,verifyDemoArtifact,type DemoDataset,type DemoRequest,type DemoSignal} from './demo-model';
import {replayDemo,syntheticDemoInput} from './demo-engine';
import {compareDemoArtifact} from './evaluator-comparison';
import {verifyProgramRunInput,programDemoProjection,generatedProgramSignal} from './program-evidence';
export {verifyProgramRunInput,validateProgramRunOutcome,programDemoProjection} from './program-evidence';
import {boundedProgramRunInput,guardProgramData,programRunLimits,programRunMethod,sealProgramRunOutcome,programUuid,type ProgramRunInput,type ProgramRunOutcome} from './program-run-model';
import {programSourceFingerprints} from './program-fingerprints';

const digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
export type ProgramRunFields=Pick<ProgramRunInput,'requestId'|'initialCapital'|'hypothesis'|'falsification'|'emergencyStopAt'>;
export async function prepareProgramRunInput(source:{record:StrategyRecordV2;digest:string},dataset:DemoDataset,fields:ProgramRunFields):Promise<ProgramRunInput>{
 guardProgramData(source,programRunLimits.inputBytes);guardProgramData(dataset,programRunLimits.inputBytes);guardProgramData(fields,programRunLimits.inputBytes);const methodDigest=await digest(programRunMethod);
 if('methodDigest' in fields&&fields.methodDigest!==methodDigest)throw Error('Previously frozen program method differs.');
 const {input,payload}=boundedProgramRunInput({version:1,kind:'LOCAL_PROGRAM_RUN_INPUT',requestId:fields.requestId,initialCapital:fields.initialCapital,hypothesis:fields.hypothesis,falsification:fields.falsification,emergencyStopAt:fields.emergencyStopAt,strategy:source,dataset,methodDigest});void payload;await verifyProgramRunInput(input);return input;
}
async function emptyOutcome(attemptId:string,input:ProgramRunInput|null,inputDigest:string|null):Promise<Omit<ProgramRunOutcome,'outcomeDigest'>>{
 return {version:1,kind:'LOCAL_PROGRAM_RUN_OUTCOME',attemptId:programUuid.parse(attemptId),classification:'AUTHOR_REPORTED',qualification:'NONE',generatorIndependence:'NOT_ESTABLISHED',ordersEnabled:false,status:'FAILED',reason:'MODULE_ERROR',input,inputDigest,implementations:programSourceFingerprints,digests:{method:await digest(programRunMethod),source:input?.strategy.digest??null,module:input?.strategy.record.content.program.digest??null,dataset:input?await digest(input.dataset):null},configure:[],trace:[],signals:[],totalFuel:0,state:null,stateDigest:null,demoRequest:null,artifact:null,comparison:null};
}
function safeCode(error:unknown){return error instanceof ProgramWasmError&&/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)?error.code:'PROGRAM_ERROR';}
function usedFuel(error:unknown,budget:number){return error instanceof ProgramWasmError&&typeof error.fuelUsed==='number'&&Number.isInteger(error.fuelUsed)&&error.fuelUsed>=0&&error.fuelUsed<=budget?error.fuelUsed:0;}

/** Fixed trusted interpreter only: guest binaries are parsed data, never native executable modules. */
export async function runProgramReplay(raw:unknown,attemptId:string):Promise<ProgramRunOutcome>{
 programUuid.parse(attemptId);let input:ProgramRunInput|null=null,inputDigest:string|null=null;
 try{const bounded=boundedProgramRunInput(raw);input=bounded.input;inputDigest=await strategyDigest(bounded.payload);await verifyProgramRunInput(input);}catch{
  if(!input){try{inputDigest=await strategyDigest(guardProgramData(raw,programRunLimits.inputBytes));}catch{inputDigest=null;}}
  const rejected=await emptyOutcome(attemptId,null,inputDigest);return sealProgramRunOutcome({...rejected,status:'REJECTED',reason:input?'DIGEST_MISMATCH':'INVALID_INPUT'});
 }
 const result=await emptyOutcome(attemptId,input,inputDigest);const source=input.strategy.record.content.program;
 let instance:ReturnType<typeof createProgramInstance>|null=null;
 const captureState=async()=>{if(instance){result.state=programState(instance);result.stateDigest=await digest(result.state);}};
 const fail=async(reason:ProgramRunOutcome['reason'])=>{result.status='FAILED';result.reason=reason;await captureState();return sealProgramRunOutcome(result);};
 try{
  const module=parseProgramModule(programSourceBytes(source.bytesHex));instance=createProgramInstance(module);
  if(source.parameters.length&&!programModuleInfo(module).exports.includes('configure'))return fail('MODULE_ERROR');
  for(let n=0;n<source.parameters.length;n++){
   const budget=Math.min(programRunLimits.perInvocationFuel,programRunLimits.totalFuel-result.totalFuel);
   if(budget<=0)return fail('TOTAL_FUEL_LIMIT');
   try{const invocation=invokeProgram(instance,'configure',[n,source.parameters[n]],budget);result.configure.push({parameterIndex:n,value:source.parameters[n],fuelUsed:invocation.fuelUsed,status:'APPLIED',code:null});result.totalFuel+=invocation.fuelUsed;}
   catch(error){const fuelUsed=usedFuel(error,budget);result.totalFuel+=fuelUsed;result.configure.push({parameterIndex:n,value:source.parameters[n],fuelUsed,status:'FAILED',code:safeCode(error)});return fail(safeCode(error)==='FUEL'?(budget<programRunLimits.perInvocationFuel?'TOTAL_FUEL_LIMIT':'FUEL_LIMIT'):'PROGRAM_TRAP');}
  }
  for(let n=0;n<input.dataset.bars.length;n++){
   const bar=input.dataset.bars[n],budget=Math.min(programRunLimits.perInvocationFuel,programRunLimits.totalFuel-result.totalFuel);
   if(budget<=0){result.trace.push({barIndex:n,closedAt:bar.closedAt,output:null,fuelUsed:0,status:'FAILED',code:'TOTAL_FUEL_LIMIT'});return fail('TOTAL_FUEL_LIMIT');}
   let output:number,fuelUsed:number;
   try{const invocation=invokeProgram(instance,'on_bar',[n,Date.parse(bar.closedAt),bar.open,bar.high,bar.low,bar.close,bar.volume],budget);output=invocation.value as number;fuelUsed=invocation.fuelUsed;result.totalFuel+=fuelUsed;}
   catch(error){fuelUsed=usedFuel(error,budget);result.totalFuel+=fuelUsed;result.trace.push({barIndex:n,closedAt:bar.closedAt,output:null,fuelUsed,status:'FAILED',code:safeCode(error)});return fail(safeCode(error)==='FUEL'?(budget<programRunLimits.perInvocationFuel?'TOTAL_FUEL_LIMIT':'FUEL_LIMIT'):'PROGRAM_TRAP');}
   if(output!==0&&output!==1&&output!==2){result.trace.push({barIndex:n,closedAt:bar.closedAt,output,fuelUsed,status:'FAILED',code:'INVALID_OUTPUT'});return fail('INVALID_OUTPUT');}
   if(output&&result.signals.length>=demoLimits.signals){result.trace.push({barIndex:n,closedAt:bar.closedAt,output,fuelUsed,status:'FAILED',code:'SIGNAL_LIMIT'});return fail('SIGNAL_LIMIT');}
   result.trace.push({barIndex:n,closedAt:bar.closedAt,output,fuelUsed,status:'OUTPUT',code:null});
   if(output)result.signals.push(await generatedProgramSignal(inputDigest!,n,bar.closedAt,output));
  }
  await captureState();result.demoRequest=await programDemoProjection(input,inputDigest!,result.signals);
  try{result.artifact=await verifyDemoArtifact(await replayDemo(result.demoRequest));result.comparison=await compareDemoArtifact(result.artifact);}catch{return fail('EVALUATOR_FAILED');}
  if(result.artifact.status==='REJECTED'||result.artifact.status==='FAILED'||result.comparison.status!=='MATCH'){result.status='FAILED';result.reason='EVALUATOR_FAILED';}
  else{result.status=result.artifact.status;result.reason='NONE';}
  return sealProgramRunOutcome(result);
 }catch{return fail('MODULE_ERROR');}
}

export async function interruptProgramRun(raw:unknown,attemptId:string,status:'CANCELLED'|'INTERRUPTED',_diagnostic?:string){const {input,payload}=boundedProgramRunInput(raw);await verifyProgramRunInput(input);if(status!=='CANCELLED'&&status!=='INTERRUPTED')throw Error('Invalid interruption.');return sealProgramRunOutcome({...await emptyOutcome(attemptId,input,await strategyDigest(payload)),status,reason:status});}

/** Reviewed first-party binary: emits BULLISH only for bar zero. All prices remain invented. */
export async function syntheticProgramRunInput(selected?:{record:StrategyRecordV2;digest:string}):Promise<ProgramRunInput>{
 const example=await syntheticDemoInput();let source=selected;
 if(!source){const bytesHex='0061736d01000000010c0160077f7c7c7c7c7c7c017f03020100070a01066f6e5f62617200000a0f010d00200045047f41010541000b0b',base=example.strategy.record;
  const record=strategyRecordV2Schema.parse({...base,version:2,id:'00000000-0000-4000-8000-000000000101',rootId:'00000000-0000-4000-8000-000000000101',requestId:'00000000-0000-4000-8000-000000000102',content:{...base.content,name:'Invented programmable first-bar fixture',definition:{...base.content.definition,entry:{type:'SIGNAL',provider:'CUSTOM',event:'BULLISH',maxAgeBars:1}},program:{profile:'opengrail-wasm-i32-f64-v1',abi:'opengrail-causal-signal-wasm-v1',bytesHex,digest:await programBinaryDigest(bytesHex),parameters:[]}}});
  source={record,digest:await strategyDigest(boundedStrategyRecord(record).payload)};
 }
 // Reuse only invented bars. Supplied Demo signals never enter this workflow.
 const definition=source.record.content.definition,dataset={...example.dataset,symbol:definition.market.symbol,timeframe:definition.market.timeframe};
 if(definition.market.timeframe!==example.dataset.timeframe){const steps={'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};dataset.bars=dataset.bars.map((bar,n)=>({...bar,closedAt:new Date(Date.parse('2025-01-01T00:00:00.000Z')+(n+1)*steps[definition.market.timeframe]).toISOString()}));}
 return prepareProgramRunInput(source,dataset,{requestId:'00000000-0000-4000-8000-000000000103',initialCapital:1000,hypothesis:'This reviewed first-party binary produces reproducible signals and synthetic cost-aware Demo trades; economic usefulness is unestablished.',falsification:'Reject if real binary outputs are ignored, future bars enter the guest, or adverse attempts disappear.',emergencyStopAt:null});
}
