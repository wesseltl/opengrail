import {readFileSync,writeFileSync} from 'node:fs';
import {currentProgramSessionFingerprints} from './program-session-fingerprint-core.mjs';
const target=new URL('../app/program-session-fingerprints.ts',import.meta.url),args=process.argv.slice(2);
const content='// Generated physical source identities. Hashes are not execution attestations.\nexport const programSessionSourceFingerprints = Object.freeze('+JSON.stringify(currentProgramSessionFingerprints())+');\n';
if(args.length===0){writeFileSync(target,content);process.stdout.write('Program session source fingerprints prepared.\n');}
else if(args.length===1&&args[0]==='--check'){if(readFileSync(target,'utf8')!==content)throw Error('Program session source fingerprints are stale.');process.stdout.write('Program session source fingerprints match.\n');}
else throw Error('Usage: program-session-fingerprints.mjs [--check]');
