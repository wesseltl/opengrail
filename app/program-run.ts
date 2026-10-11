import {boundedStrategyRecord,strategyDigest,strategyRecordV1Schema,strategyRecordV2Schema,verifyStrategyProgram,type StrategyRecordV2} from './strategy-model';
import {programSourceBytes,programBinaryDigest} from './program-source-model';
import {parseProgramModule,programModuleInfo,createProgramInstance,invokeProgram,programState,ProgramWasmError} from './program-wasm';
import {boundedDemoRequest,demoEvaluatorVersion,demoLimits,verifyDemoArtifact,type DemoDataset,type DemoRequest,type DemoSignal} from './demo-model';
import {replayDemo,syntheticDemoInput} from './demo-engine';
import {compareDemoArtifact,verifyComparisonReport} from './evaluator-comparison';
import {boundedProgramRunInput,guardProgramData,programRunLimits,programRunMethod,programRunOutcomeSchema,sealProgramRunOutcome,programUuid,type ProgramRunInput,type ProgramRunOutcome} from './program-run-model';
import {programSourceFingerprints} from './program-fingerprints';

const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
async function derivedUuid(material:unknown){const hex=await digest(material);return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);}
export type ProgramRunFields=Pick<ProgramRunInput,'requestId'|'initialCapital'|'hypothesis'|'falsification'|'emergencyStopAt'>;
export async function prepareProgramRunInput(source:{record:StrategyRecordV2;digest:string},dataset:DemoDataset,fields:ProgramRunFields):Promise<ProgramRunInput>{
 guardProgramData(source,programRunLimits.inputBytes);guardProgramData(dataset,programRunLimits.inputBytes);guardProgramData(fields,programRunLimits.inputBytes);const methodDigest=await digest(programRunMethod);
 if('methodDigest' in fields&&fields.methodDigest!==methodDigest)throw Error('Previously frozen program method differs.');
 const {input,payload}=boundedProgramRunInput({version:1,kind:'LOCAL_PROGRAM_RUN_INPUT',requestId:fields.requestId,initialCapital:fields.initialCapital,hypothesis:fields.hypothesis,falsification:fields.falsification,emergencyStopAt:fields.emergencyStopAt,strategy:source,dataset,methodDigest});void payload;await verifyInput(input);return input;
}
async function verifyInput(input:ProgramRunInput){if(Object.values(programSourceFingerprints).some(hash=>/^0+$/.test(hash))||input.methodDigest!==await digest(programRunMethod))throw Error('Program implementation identity differs.');await verifyStrategyProgram(input.strategy.record);if(await strategyDigest(boundedStrategyRecord(input.strategy.record).payload)!==input.strategy.digest)throw Error('Program source identity differs.');}
export async function verifyProgramRunInput(raw:unknown){const {input}=boundedProgramRunInput(raw);await verifyInput(input);return input;}
async function emptyOutcome(attemptId:string,input:ProgramRunInput|null,inputDigest:string|null):Promise<Omit<ProgramRunOutcome,'outcomeDigest'>>{
 return {version:1,kind:'LOCAL_PROGRAM_RUN_OUTCOME',attemptId:programUuid.parse(attemptId),classification:'AUTHOR_REPORTED',qualification:'NONE',generatorIndependence:'NOT_ESTABLISHED',ordersEnabled:false,status:'FAILED',reason:'MODULE_ERROR',input,inputDigest,implementations:programSourceFingerprints,digests:{method:await digest(programRunMethod),source:input?.strategy.digest??null,module:input?.strategy.record.content.program.digest??null,dataset:input?await digest(input.dataset):null},configure:[],trace:[],signals:[],totalFuel:0,state:null,stateDigest:null,demoRequest:null,artifact:null,comparison:null};
}
/** Explicitly derived private evaluator input. Its V1 identity is never the public V2 source. */
export async function programDemoProjection(input:ProgramRunInput,inputDigest:string,signals:DemoSignal[]):Promise<DemoRequest>{
 const original=input.strategy.record,{program,...content}=original.content;void program;
 const id=await derivedUuid(['internal-program-projection',inputDigest,original.id]);
 const record=strategyRecordV1Schema.parse({...original,version:1,id,rootId:id,revision:1,requestId:await derivedUuid(['internal-program-source-request',inputDigest]),content:{...content,relation:null}});
 if(record.id===original.id||record.requestId===original.requestId)throw Error('Projection identity collided.');
 return boundedDemoRequest({version:1,requestId:await derivedUuid(['internal-program-demo-request',input.requestId,inputDigest]),evaluatorVersion:demoEvaluatorVersion,strategy:{record,digest:await strategyDigest(boundedStrategyRecord(record).payload)},dataset:input.dataset,signals,initialCapital:input.initialCapital,hypothesis:input.hypothesis,falsification:input.falsification,emergencyStopAt:input.emergencyStopAt}).input;
}
async function generatedSignal(inputDigest:string,barIndex:number,closedAt:string,output:number):Promise<DemoSignal>{return {id:await derivedUuid(['program-signal',inputDigest,barIndex,output]),provider:'CUSTOM',event:output===1?'BULLISH':'BEARISH',observedAt:closedAt,availableAt:closedAt};}
function safeCode(error:unknown){return error instanceof ProgramWasmError&&/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)?error.code:'PROGRAM_ERROR';}
function usedFuel(error:unknown,budget:number){return error instanceof ProgramWasmError&&typeof error.fuelUsed==='number'&&Number.isInteger(error.fuelUsed)&&error.fuelUsed>=0&&error.fuelUsed<=budget?error.fuelUsed:0;}

/** Fixed trusted interpreter only: guest binaries are parsed data, never native executable modules. */
export async function runProgramReplay(raw:unknown,attemptId:string):Promise<ProgramRunOutcome>{
 programUuid.parse(attemptId);let input:ProgramRunInput|null=null,inputDigest:string|null=null;
 try{const bounded=boundedProgramRunInput(raw);input=bounded.input;inputDigest=await strategyDigest(bounded.payload);await verifyInput(input);}catch{
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
   if(output)result.signals.push(await generatedSignal(inputDigest!,n,bar.closedAt,output));
  }
  await captureState();result.demoRequest=await programDemoProjection(input,inputDigest!,result.signals);
  try{result.artifact=await verifyDemoArtifact(await replayDemo(result.demoRequest));result.comparison=await compareDemoArtifact(result.artifact);}catch{return fail('EVALUATOR_FAILED');}
  if(result.artifact.status==='REJECTED'||result.artifact.status==='FAILED'||result.comparison.status!=='MATCH'){result.status='FAILED';result.reason='EVALUATOR_FAILED';}
  else{result.status=result.artifact.status;result.reason='NONE';}
  return sealProgramRunOutcome(result);
 }catch{return fail('MODULE_ERROR');}
}

/** Structural correlations and hashes only. Reproduction is a separate explicit operation. */
export async function validateProgramRunOutcome(raw:unknown,expected?:ProgramRunInput):Promise<ProgramRunOutcome>{
 guardProgramData(raw,programRunLimits.outcomeBytes);const result=programRunOutcomeSchema.parse(raw),{outcomeDigest,...body}=result;
 if(!equal(result.implementations,programSourceFingerprints)||await digest(body)!==outcomeDigest||result.digests.method!==await digest(programRunMethod))throw Error('Program outcome or method identity differs.');
 if(expected&&!equal(boundedProgramRunInput(expected).input,result.input))throw Error('Program outcome differs from its frozen admission.');
 if(!result.input){if(result.status!=='REJECTED'||!['INVALID_INPUT','DIGEST_MISMATCH'].includes(result.reason)||result.configure.length||result.trace.length||result.signals.length||result.totalFuel||result.state||result.stateDigest||result.demoRequest||result.artifact||result.comparison||result.digests.source||result.digests.module||result.digests.dataset)throw Error('Rejected unknown input cannot claim execution.');return result;}
 const input=boundedProgramRunInput(result.input).input;await verifyInput(input);
 if(result.inputDigest!==await digest(input)||result.digests.source!==input.strategy.digest||result.digests.module!==input.strategy.record.content.program.digest||result.digests.dataset!==await digest(input.dataset))throw Error('Program input identities differ.');
 const parameters=input.strategy.record.content.program.parameters;
 if(result.configure.some((row,n)=>row.parameterIndex!==n||row.value!==parameters[n]||row.status==='APPLIED'&&row.code!==null||row.status==='FAILED'&&(row.code===null||n!==result.configure.length-1))||result.configure.length>parameters.length)throw Error('Configuration history differs.');
 const outputs:DemoSignal[]=[];let failed=result.configure.some(row=>row.status==='FAILED');
 if(result.trace.length&&result.configure.length!==parameters.length)throw Error('Bars cannot precede complete frozen configuration.');
 for(let n=0;n<result.trace.length;n++){
  const row=result.trace[n];if(failed||row.barIndex!==n||row.closedAt!==input.dataset.bars[n]?.closedAt)throw Error('Noncausal or interrupted output sequence.');
  if(row.status==='FAILED'){if(row.code===null)throw Error('Failure requires a disposition.');failed=true;}
  else{if(row.code!==null||row.output!==0&&row.output!==1&&row.output!==2)throw Error('Invalid successful output.');if(row.output)outputs.push(await generatedSignal(result.inputDigest!,n,row.closedAt,row.output));}
 }
 if(!equal(outputs,result.signals)||result.totalFuel!==result.configure.reduce((sum,row)=>sum+row.fuelUsed,0)+result.trace.reduce((sum,row)=>sum+row.fuelUsed,0))throw Error('Generated signals or consumed fuel differ.');
 if(Boolean(result.state)!==Boolean(result.stateDigest)||result.state&&await digest(result.state)!==result.stateDigest)throw Error('Program state identity differs.');
 if(result.state){
  const info=programModuleInfo(parseProgramModule(programSourceBytes(input.strategy.record.content.program.bytesHex))),state=result.state;
  if(state.globals.length!==info.globalTypes.length||state.globalBits.length!==info.globalTypes.length||state.memory.length%65536!==0||state.memory.length<info.memoryPages*65536||state.memory.length>info.memoryMaximumPages*65536)throw Error('State dimensions differ from the admitted program.');
  for(let n=0;n<state.globals.length;n++){const type=info.globalTypes[n],hex=state.globalBits[n];if(hex.length!==(type==='i32'?8:16))throw Error('State bit width differs.');const bytes=Uint8Array.from(hex.match(/../g)!,pair=>Number.parseInt(pair,16)),view=new DataView(bytes.buffer),number=type==='i32'?view.getInt32(0,true):view.getFloat64(0,true);if(!Number.isFinite(number)||number!==state.globals[n])throw Error('Exact program state bits differ from the numeric snapshot.');}
 }
 const interrupted=result.status==='CANCELLED'||result.status==='INTERRUPTED';
 if(interrupted){if(result.reason!==result.status||result.configure.length||result.trace.length||result.signals.length||result.totalFuel||result.state||result.demoRequest||result.artifact||result.comparison)throw Error('Interrupted result cannot claim completed work.');return result;}
 if(result.status==='REJECTED')throw Error('Accepted input cannot be relabelled rejected.');
 if(result.demoRequest||result.artifact||result.comparison){
  if(!result.demoRequest||failed||result.configure.length!==parameters.length||result.trace.length!==input.dataset.bars.length||!result.state)throw Error('Incomplete program result cannot claim evaluated trades.');
  if(!equal(result.demoRequest,await programDemoProjection(input,result.inputDigest!,outputs)))throw Error('Internal Demo projection differs from the exact program run.');
  if(!result.artifact||!result.comparison){if(result.status!=='FAILED'||result.reason!=='EVALUATOR_FAILED'||!result.artifact&&result.comparison)throw Error('Incomplete trading evaluation requires a retained failure.');if(result.artifact){const partial=await verifyDemoArtifact(result.artifact);if(!equal(partial.input,result.demoRequest))throw Error('Partial evaluator input differs.');}return result;}
  const artifact=await verifyDemoArtifact(result.artifact);if(!equal(artifact.input,result.demoRequest))throw Error('Trading artifact differs from generated inputs.');
  const comparison=await verifyComparisonReport(result.comparison);if(comparison.identity.claimedArtifact!==artifact.resultDigest||comparison.identity.request!==artifact.digests.request)throw Error('Comparison identity differs.');
  const succeeded=artifact.status!=='REJECTED'&&artifact.status!=='FAILED'&&comparison.status==='MATCH';
  if(succeeded?(result.status!==artifact.status||result.reason!=='NONE'):(result.status!=='FAILED'||result.reason!=='EVALUATOR_FAILED'))throw Error('Program disposition differs from the retained trading evidence.');
 }else if(result.status!=='FAILED'||['NONE','INVALID_INPUT','DIGEST_MISMATCH','EVALUATOR_FAILED','CANCELLED','INTERRUPTED'].includes(result.reason))throw Error('An unevaluated program cannot claim success.');
 return result;
}

export async function interruptProgramRun(raw:unknown,attemptId:string,status:'CANCELLED'|'INTERRUPTED',_diagnostic?:string){const {input,payload}=boundedProgramRunInput(raw);await verifyInput(input);if(status!=='CANCELLED'&&status!=='INTERRUPTED')throw Error('Invalid interruption.');return sealProgramRunOutcome({...await emptyOutcome(attemptId,input,await strategyDigest(payload)),status,reason:status});}

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
