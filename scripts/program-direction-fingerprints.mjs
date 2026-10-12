import {readFileSync,writeFileSync} from 'node:fs';
import {currentProgramDirectionFingerprints} from './program-direction-fingerprint-core.mjs';
const target=new URL('../app/program-direction-fingerprints.ts',import.meta.url),text='// Generated physical source identities, never execution attestations.\nexport const programDirectionSourceFingerprints=Object.freeze('+JSON.stringify(currentProgramDirectionFingerprints())+');\n',args=process.argv.slice(2);
if(args.length===0){writeFileSync(target,text);process.stdout.write('Direction selection physical source identities prepared.\n');}
else if(args.length===1&&args[0]==='--check'){if(readFileSync(target,'utf8')!==text)throw Error('Direction selection physical fingerprints are stale.');process.stdout.write('Direction selection physical source identities match.\n');}
else throw Error('Usage: program-direction-fingerprints.mjs [--check]');
