#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {loadForwardDemoModules,cleanupForwardDemoModules,readForwardDemoPlan} from './forward-demo-core.mjs';
import {readPrivateForwardFile,preparePrivateForwardOutput,PrivateForwardFileError} from './forward-demo-files.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const controller=new AbortController(),stop=()=>controller.abort();process.on('SIGINT',stop);process.on('SIGTERM',stop);
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
function flags(args,required){if(args.length!==required.length*2)throw Error();const found={};for(let n=0;n<args.length;n+=2){const name=args[n];if(!required.includes(name)||Object.hasOwn(found,name)||typeof args[n+1]!=='string')throw Error();found[name]=args[n+1];}if(required.some(name=>!Object.hasOwn(found,name)))throw Error();return found;}
function integer(raw){if(!/^[1-9][0-9]{0,9}$/.test(raw))throw Error();const n=Number(raw);if(!Number.isSafeInteger(n))throw Error();return n;}
function snapshot(model,path,maximum){const text=readPrivateForwardFile(path,maximum);return {path,maximum,digest:sha(Buffer.from(text)),raw:model.parseUniqueJson(text,maximum,model.forwardDemoLimits.maximumDepth)};}
function confirm(inputs){if(controller.signal.aborted)throw Error();for(const input of inputs)if(sha(Buffer.from(readPrivateForwardFile(input.path,input.maximum)))!==input.digest)throw Error();}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='prepare'){
  const values=flags(args,['--handoff','--config','--starts-at','--ends-at','--poll-ms','--cycles','--output']),model=await loadForwardDemoModules(),output=preparePrivateForwardOutput(values['--output'],model.forwardDemoLimits.planBytes);
  let published=false;try{
   const handoff=snapshot(model,values['--handoff'],model.forwardDemoLimits.handoffBytes),config=snapshot(model,values['--config'],model.sessionLimits.configBytes),preparedAt=new Date().toISOString();
   const plan=await model.createForwardDemoPlan({handoff:handoff.raw,config:config.raw,preparedAt,startsAt:values['--starts-at'],endsAt:values['--ends-at'],pollMs:integer(values['--poll-ms']),cycles:integer(values['--cycles'])});
   await model.assertFresh();confirm([handoff,config]);if(Date.parse(plan.startsAt)<=Date.now())throw Error();output.write(plan);published=true;await model.assertFresh();confirm([handoff,config]);
   const retained=await readForwardDemoPlan(values['--output']);confirm([handoff,config]);if(retained.planDigest!==plan.planDigest||controller.signal.aborted)throw Error();
   emit({kind:'LOCAL_FORWARD_DEMO_PLAN_PREPARED',planDigest:plan.planDigest,handoffDigest:plan.handoff.handoffDigest,configDigest:plan.configDigest,preparedAt:plan.preparedAt,clockEvidence:plan.clockEvidence,independence:plan.independence,providerAuthenticity:plan.providerAuthenticity,qualification:plan.qualification,ordersEnabled:false,liveEnabled:false});return;
  }catch(error){if(error instanceof PrivateForwardFileError)throw error;if(published)throw new PrivateForwardFileError(true);throw error;}finally{output.close();}
 }
 if(command==='verify'){
  const values=flags(args,['--plan']),plan=await readForwardDemoPlan(values['--plan']);if(controller.signal.aborted)throw Error();
  emit({kind:'LOCAL_FORWARD_DEMO_PLAN_VERIFIED',planDigest:plan.planDigest,handoffDigest:plan.handoff.handoffDigest,configDigest:plan.configDigest,verification:'HISTORICAL_CONSISTENCY_ONLY',freshAdmission:false,clockEvidence:plan.clockEvidence,independence:plan.independence,providerAuthenticity:plan.providerAuthenticity,qualification:plan.qualification,ordersEnabled:false,liveEnabled:false});return;
 }
 process.stderr.write('Usage: forward-demo.mjs prepare --handoff PATH --config PATH --starts-at ISO --ends-at ISO --poll-ms INTEGER --cycles INTEGER --output NEW_PRIVATE_PATH | verify --plan PRIVATE_PATH\n');process.exitCode=1;
}
try{await main();}catch(error){process.stderr.write((error instanceof PrivateForwardFileError?error.code:'FORWARD_DEMO_NOT_CONFIRMED')+'\n');process.exitCode=controller.signal.aborted?130:1;}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await cleanupForwardDemoModules();}
