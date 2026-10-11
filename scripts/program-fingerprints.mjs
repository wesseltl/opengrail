import {readFileSync,writeFileSync} from 'node:fs';
import {currentProgramFingerprints} from './program-fingerprint-core.mjs';
const root=new URL('../',import.meta.url),target=new URL('app/program-fingerprints.ts',root);
const hashes=currentProgramFingerprints();
const content='// Generated exact source identities, not execution attestations or independent qualification.\n// Run scripts/program-fingerprints.mjs after changing a declared dependency.\nexport const programSourceFingerprints = Object.freeze('+JSON.stringify(hashes,null,2)+');\n';
const args=process.argv.slice(2);
if(!args.length){writeFileSync(target,content,{mode:0o600});process.stdout.write('Program source fingerprints prepared.\n');}
else if(args.length===1&&args[0]==='--check'){if(readFileSync(target,'utf8')!==content){process.stderr.write('Program source fingerprints are stale.\n');process.exitCode=1;}else process.stdout.write('Program source fingerprints match declared files.\n');}
else{process.stderr.write('Usage: program-fingerprints.mjs [--check]\n');process.exitCode=1;}
