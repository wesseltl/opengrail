import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
export const programFingerprintFiles=Object.freeze({interpreter:'app/program-wasm.ts',runner:'app/program-run.ts',inputModel:'app/program-run-model.ts',evidenceModel:'app/program-evidence.ts',sourceModel:'app/program-source-model.ts',strategyModel:'app/strategy-model.ts',demoModel:'app/demo-model.ts',serialization:'app/unique-json.ts',lockfile:'package-lock.json'});
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
export function currentProgramFingerprints(){return Object.fromEntries(Object.entries(programFingerprintFiles).map(([key,path])=>[key,hash(path)]));}
/** Fixed file data only; never evaluate the generated TypeScript or caller input. */
export function assertProgramExecutionFingerprints(){
 const source=readFileSync(new URL('app/program-fingerprints.ts',root),'utf8'),match=/export const programSourceFingerprints = Object\.freeze\((\{[\s\S]*?\})\);\s*$/.exec(source);
 if(!match||JSON.stringify(JSON.parse(match[1]))!==JSON.stringify(currentProgramFingerprints()))throw Error('Program source fingerprints are stale.');
 const evaluator=readFileSync(new URL('app/evaluator-fingerprints.ts',root),'utf8');
 for(const [name,path] of [['primary','app/demo-engine.ts'],['reference','app/reference-engine.ts']]){const declared=new RegExp(name+": '([a-f0-9]{64})'").exec(evaluator)?.[1];if(declared!==hash(path))throw Error('Trading source fingerprints are stale.');}
}
