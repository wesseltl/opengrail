import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertProgramExecutionFingerprints} from './program-fingerprint-core.mjs';
import {assertSessionLegacyFingerprints} from './session-legacy-fingerprint-core.mjs';
const root=new URL('../',import.meta.url);
export const programSessionFingerprintFiles=Object.freeze({engine:'app/program-session-engine.ts',model:'app/program-session-model.ts',journal:'app/program-session-journal.ts'});
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
export function currentProgramSessionFingerprints(){return Object.fromEntries(Object.entries(programSessionFingerprintFiles).map(([key,path])=>[key,hash(path)]));}
export function assertProgramSessionFingerprints(){
 assertSessionLegacyFingerprints();
 assertProgramExecutionFingerprints();
 const source=readFileSync(new URL('app/program-session-fingerprints.ts',root),'utf8'),match=/export const programSessionSourceFingerprints = Object\.freeze\((\{[^;]*\})\);\s*$/.exec(source);
 if(!match||JSON.stringify(JSON.parse(match[1]))!==JSON.stringify(currentProgramSessionFingerprints()))throw Error('Program session physical source fingerprints are stale.');
 const kernel=readFileSync(new URL('app/session-fingerprints.ts',root),'utf8'),declared=/export const sessionSourceFingerprints=(\{[^;]*\}) as const;/.exec(kernel);
 if(!declared)throw Error('Session kernel physical identities are unavailable.');
 for(const [key,path]of Object.entries({engine:'app/session-engine.ts',model:'app/session-model.ts',journal:'app/session-journal.ts'}))if(JSON.parse(declared[1])[key]!==hash(path))throw Error('Session kernel source fingerprints are stale.');
}
export const assertProgramSessionExecutionFingerprints=assertProgramSessionFingerprints;
