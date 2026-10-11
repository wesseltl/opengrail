import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),target=new URL('app/evaluator-fingerprints.ts',root);
const digest=name=>createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex');
const value={primary:digest('app/demo-engine.ts'),reference:digest('app/reference-engine.ts')};
const text="// Generated source identities, not execution attestations. Run the reviewed\n// scripts/evaluator-fingerprints.mjs after changing either fixed evaluator.\nexport const evaluatorSourceFingerprints = Object.freeze({\n  primary: '"+value.primary+"',\n  reference: '"+value.reference+"',\n});\n";
const args=process.argv.slice(2);
if(args.length===0){writeFileSync(target,text,{mode:0o600});process.stdout.write('Fixed evaluator source fingerprints prepared.\n');}
else if(args.length===1&&args[0]==='--check'){
 if(readFileSync(target,'utf8')!==text){process.stderr.write('Evaluator source fingerprints are stale.\n');process.exitCode=1;}
 else process.stdout.write('Fixed evaluator source fingerprints match.\n');
}else {process.stderr.write('Usage: node scripts/evaluator-fingerprints.mjs [--check]\n');process.exitCode=1;}
