import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertProgramExecutionFingerprints} from './program-fingerprint-core.mjs';
const root=new URL('../',import.meta.url);
export const programDirectionFingerprintFiles=Object.freeze({model:'app/program-direction-search-model.ts',runner:'app/program-direction-search.ts',cli:'scripts/program-direction-search.mjs'});
export function currentProgramDirectionFingerprints(){return Object.fromEntries(Object.entries(programDirectionFingerprintFiles).map(([key,path])=>[key,createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex')]));}
export function assertProgramDirectionExecutionFingerprints(){assertProgramExecutionFingerprints();const text=readFileSync(new URL('app/program-direction-fingerprints.ts',root),'utf8'),match=/export const programDirectionSourceFingerprints=Object\.freeze\((\{[^;]*\})\);\s*$/.exec(text);if(!match||JSON.stringify(JSON.parse(match[1]))!==JSON.stringify(currentProgramDirectionFingerprints()))throw Error('Direction selection physical fingerprints are stale.');}
