import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
// Exact baseline bytes from 179f649. The archive imports its original modules
// through fixed transparent bridges; shared dependencies must retain these bytes.
// These identities establish source compatibility, not execution attestation.
export const sessionLegacySourceHashes=Object.freeze({
 'app/compat/session-20261011/session-engine.ts':'7f4c1263910a4ca25036c610b755af548e2e2a002a2a9021be8c528ff6455215',
 'app/compat/session-20261011/session-model.ts':'7d6dc8a8b7cc05a39b759c82c970a72443cd1af7dc897076234a839b75a265d3',
 'app/compat/session-20261011/session-journal.ts':'f2ebbeb3121e61d140bb68a4a41957509208b2dd8d38009a226a227f043c81fe',
 'app/compat/session-20261011/session-fingerprints.ts':'c1f87d609b22092c9b83e6188bafe143235b10563b523c8503f191b13d1942a4',
 'app/compat/session-20261011/program-session-engine.ts':'3a97a8b84b306dc43db840ffed4edc3558b051e4637969d1ee79a9b0294c2ece',
 'app/compat/session-20261011/program-session-model.ts':'998ff75167100a63b6b26bd0556e875ed3e1ff5e8c5f443bff578a31ef5a7c73',
 'app/compat/session-20261011/program-session-journal.ts':'ea3fc52299295beab12d166cfa0bad34e620fcd1f491a2ed165a47ae3af0c9a3',
 'app/compat/session-20261011/program-session-fingerprints.ts':'e0c1a76cc0b065fa8506adaf35d4a44548fb2ae6d8d6f1220e6393acf0ce2116',
 'app/comparison-model.ts':'c5e83dff8f89685e72681abb498ccb7ae7875d163d4a74b9e9db0db8622e61cc',
 'app/demo-model.ts':'a689f435ad075dedac88a99bc468a8c10d53c9e2f31e0bdc3abe417908703017',
 'app/evaluator-fingerprints.ts':'7ca6f199ef9161ce178249ad58633072398bf1ff1740a9751cc37a24d3c63d43',
 'app/network-model.ts':'b008b69cf73d93e8793a79efaf251debb1d6a717add226275427a124135f30d1',
 'app/network-store.ts':'91cea667991b646f6b460ae2fb255da85684b95b71e82e96652b7904f2b0074e',
 'app/program-fingerprints.ts':'8de2a73f1b5c4ab4b370341acc28852e32d19fe3973e814f0f15710396c3be6f',
 'app/program-run-model.ts':'27dc7a06db7b6b8a1da85c88e882ff8afc5200afaee060d822a75f10819d3c3c',
 'app/program-source-model.ts':'0228ba6f0d5a9e4586ed3cfb4d9ad891209c9e65ae588248bc5a5443a25b3cc7',
 'app/program-wasm.ts':'7deae26a6ce3640db14aa99b778989b50e222062efa00e0939a0385827c1103e',
 'app/research-model.ts':'ccbc1f0e0861e1e24586209757e1296b98e28e48e30ac32330fcd8ce6cd2e8e0',
 'app/strategy-model.ts':'2f2af2b98f00623ea1d1bddd5ff3db53c02ca04e6880a79ad48c82518975c6f2',
 'app/venture-model.ts':'5e712118b85642c04d06a6946003b5432c2bb661b7eebdaf02f084ae0f2f7ada',
 'package-lock.json':'225fc399e48a7dc093f84c9e3da14c36dd47e674ab073caa3a464396d3f4d6b4',
});
const bridges=Object.freeze([
 'strategy-model',
 'demo-model',
 'program-run-model',
 'program-fingerprints',
 'program-source-model',
 'program-wasm',
 ]);
export function assertSessionLegacyFingerprints(){
 for(const [path,expected]of Object.entries(sessionLegacySourceHashes)){
  const bytes=readFileSync(new URL(path,root));
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Archived Session source or dependency differs: '+path);
 }
 for(const name of bridges){
  const path='app/compat/session-20261011/'+name+'.ts',expected=Buffer.from("export * from '../../"+name+"';\n");
  if(!readFileSync(new URL(path,root)).equals(expected))throw Error('Archived Session bridge differs: '+path);
 }
}
