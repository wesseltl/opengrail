import {boundedStrategyRecord,strategyDigest,strategyRecordV1Schema,verifyStrategyProgram} from './strategy-model';
import {programSourceBytes} from './program-source-model';
import {parseProgramModule,programModuleInfo} from './program-wasm';
import {boundedDemoRequest,demoEvaluatorVersion,verifyDemoArtifact,type DemoRequest,type DemoSignal} from './demo-model';
import {verifyComparisonReport} from './comparison-model';
import {boundedProgramRunInput,guardProgramData,programRunLimits,programRunMethod,programRunOutcomeSchema,type ProgramRunInput,type ProgramRunOutcome} from './program-run-model';
import {programSourceFingerprints} from './program-fingerprints';

// Public-safe identity and structural checking only. No guest invocation or trading engine imports.
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
async function derivedUuid(material:unknown){const hex=await digest(material);return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);}
export async function verifyProgramSourceIdentity(input:ProgramRunInput){if(Object.values(programSourceFingerprints).some(hash=>/^0+$/.test(hash))||input.methodDigest!==await digest(programRunMethod))throw Error('Program implementation identity differs.');await verifyStrategyProgram(input.strategy.record);if(await strategyDigest(boundedStrategyRecord(input.strategy.record).payload)!==input.strategy.digest)throw Error('Program source identity differs.');}
export async function verifyProgramRunInput(raw:unknown){const {input}=boundedProgramRunInput(raw);await verifyProgramSourceIdentity(input);return input;}
/** Explicitly derived private evaluator input. Its V1 identity is never the public V2 source. */
export async function programDemoProjection(input:ProgramRunInput,inputDigest:string,signals:DemoSignal[]):Promise<DemoRequest>{
 const original=input.strategy.record,{program,...content}=original.content;void program;
 const id=await derivedUuid(['internal-program-projection',inputDigest,original.id]);
 const record=strategyRecordV1Schema.parse({...original,version:1,id,rootId:id,revision:1,requestId:await derivedUuid(['internal-program-source-request',inputDigest]),content:{...content,relation:null}});
 if(record.id===original.id||record.requestId===original.requestId)throw Error('Projection identity collided.');
 return boundedDemoRequest({version:1,requestId:await derivedUuid(['internal-program-demo-request',input.requestId,inputDigest]),evaluatorVersion:demoEvaluatorVersion,strategy:{record,digest:await strategyDigest(boundedStrategyRecord(record).payload)},dataset:input.dataset,signals,initialCapital:input.initialCapital,hypothesis:input.hypothesis,falsification:input.falsification,emergencyStopAt:input.emergencyStopAt}).input;
}
export async function generatedProgramSignal(inputDigest:string,barIndex:number,closedAt:string,output:number):Promise<DemoSignal>{return {id:await derivedUuid(['program-signal',inputDigest,barIndex,output]),provider:'CUSTOM',event:output===1?'BULLISH':'BEARISH',observedAt:closedAt,availableAt:closedAt};}
/** Structural correlations and hashes only. Reproduction is a separate explicit operation. */
export async function validateProgramRunOutcome(raw:unknown,expected?:ProgramRunInput):Promise<ProgramRunOutcome>{
 guardProgramData(raw,programRunLimits.outcomeBytes);const result=programRunOutcomeSchema.parse(raw),{outcomeDigest,...body}=result;
 if(!equal(result.implementations,programSourceFingerprints)||await digest(body)!==outcomeDigest||result.digests.method!==await digest(programRunMethod))throw Error('Program outcome or method identity differs.');
 if(expected&&!equal(boundedProgramRunInput(expected).input,result.input))throw Error('Program outcome differs from its frozen admission.');
 if(!result.input){if(result.status!=='REJECTED'||!['INVALID_INPUT','DIGEST_MISMATCH'].includes(result.reason)||result.configure.length||result.trace.length||result.signals.length||result.totalFuel||result.state||result.stateDigest||result.demoRequest||result.artifact||result.comparison||result.digests.source||result.digests.module||result.digests.dataset)throw Error('Rejected unknown input cannot claim execution.');return result;}
 const input=boundedProgramRunInput(result.input).input;await verifyProgramSourceIdentity(input);
 if(result.inputDigest!==await digest(input)||result.digests.source!==input.strategy.digest||result.digests.module!==input.strategy.record.content.program.digest||result.digests.dataset!==await digest(input.dataset))throw Error('Program input identities differ.');
 const parameters=input.strategy.record.content.program.parameters;
 if(result.configure.some((row,n)=>row.parameterIndex!==n||row.value!==parameters[n]||row.status==='APPLIED'&&row.code!==null||row.status==='FAILED'&&(row.code===null||n!==result.configure.length-1))||result.configure.length>parameters.length)throw Error('Configuration history differs.');
 const outputs:DemoSignal[]=[];let failed=result.configure.some(row=>row.status==='FAILED');
 if(result.trace.length&&result.configure.length!==parameters.length)throw Error('Bars cannot precede complete frozen configuration.');
 for(let n=0;n<result.trace.length;n++){
  const row=result.trace[n];if(failed||row.barIndex!==n||row.closedAt!==input.dataset.bars[n]?.closedAt)throw Error('Noncausal or interrupted output sequence.');
  if(row.status==='FAILED'){if(row.code===null)throw Error('Failure requires a disposition.');failed=true;}
  else{if(row.code!==null||row.output!==0&&row.output!==1&&row.output!==2)throw Error('Invalid successful output.');if(row.output)outputs.push(await generatedProgramSignal(result.inputDigest!,n,row.closedAt,row.output));}
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

