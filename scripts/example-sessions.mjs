import {readFileSync,mkdirSync,mkdtempSync,existsSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {assertSessionLegacyFingerprints} from './session-legacy-fingerprint-core.mjs';

async function main(){
 assert.equal(process.argv.length,2,'This fixed fixture generator accepts no arguments.');
 assertSessionLegacyFingerprints();
 const root=new URL('../',import.meta.url),project=fileURLToPath(root),temporary=mkdtempSync(join(tmpdir(),'opengrail-session-example-'));
 try{
  const bundle=await build({stdin:{contents:"export * from './app/compat/session-20261011/session-journal';export {syntheticSessionExample} from './app/session-example';export {sessionSourceFingerprints} from './app/compat/session-20261011/session-fingerprints';",resolveDir:project},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});
  const modulePath=join(temporary,'trusted.mjs');writeFileSync(modulePath,bundle.outputFiles[0].text,{flag:'wx',mode:0o600});const m=await import(pathToFileURL(modulePath).href);
  assertSessionLegacyFingerprints();
  for(const [key,path]of Object.entries({engine:'session-engine.ts',model:'session-model.ts',journal:'session-journal.ts'}))assert.equal(m.sessionSourceFingerprints[key],createHash('sha256').update(readFileSync(new URL('app/compat/session-20261011/'+path,root))).digest('hex'));
  const example=await m.syntheticSessionExample();let journal=await m.createSessionJournal(example.config,example.startedAt);
  for(const entry of example.events){journal=await m.appendSessionEvent(journal,entry.event,entry.receivedAt);if(journal.state.openPositions.length)break;}
  assert.equal(journal.state.openPositions.length,1);assert.equal(journal.state.trades.length,0);assert(journal.state.consumed.length>0);
  const open=journal,emergencyAt=new Date(Date.parse(journal.state.lastReceivedAt)+1).toISOString();
  journal=await m.appendSessionEvent(journal,{requestId:'00000000-0000-4000-8000-000000009001',type:'EMERGENCY'},emergencyAt);
  assert.equal(journal.state.status,'STOPPING');assert.equal(journal.state.openPositions.length,1);assert.equal(journal.state.trades.length,0);
  const pending=journal,quoteAt=new Date(Date.parse(emergencyAt)+1).toISOString();
  journal=await m.appendSessionEvent(journal,{requestId:'00000000-0000-4000-8000-000000009002',type:'QUOTE',observedAt:quoteAt,price:open.state.openPositions[0].entryPrice*.8},quoteAt);
  assert.equal(journal.state.status,'STOPPED');assert.equal(journal.state.openPositions.length,0);assert.equal(journal.state.trades.length,1);assert.equal(journal.state.trades[0].reason,'EMERGENCY_STOP');assert(journal.state.trades[0].netPnl<0);assert(journal.state.account.totalFees>0);
  // This fixed set retains its original implementation and dated namespace.
  // Older checkpoints at examples/sessions/*.json stay unsupported and unchanged.
  const directory=new URL('examples/sessions/20261011/',root);mkdirSync(directory,{recursive:true});
  for(const [name,value]of [['signal-open.json',open],['emergency-awaiting-quote.json',pending],['emergency-adverse-exit.json',journal]]){
   const reconstructed=await m.reconstructSessionJournal(value);assert.deepEqual(reconstructed,value);
   const text=JSON.stringify(value,null,2)+'\n',target=new URL(name,directory);
   if(existsSync(target))assert.equal(readFileSync(target,'utf8'),text,'Existing evidence differs; preserve it for review.');else writeFileSync(target,text,{flag:'wx',mode:0o600});
  }
  process.stdout.write('Three archived-source synthetic continuous-session checkpoints reconstructed and retained in examples/sessions/20261011/. Older checkpoints remain unchanged.\n');
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
main().catch(()=>{process.stderr.write('Session fixture generation failed. Existing evidence is retained.\n');process.exitCode=1;});
