import {build} from 'esbuild';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {loadProgramSessionModules} from './program-session-runtime.mjs';
import {createWindowPhysicalGuard} from './program-window-fingerprint-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
/** Fresh guarded local modules. Compiling/importing never starts a guest or provider. */
export async function loadWindowControllerModules(){const guard=await createWindowPhysicalGuard();const compiled=await build({stdin:{contents:"export * from './app/program-window-model';export * from './app/program-window-observation-model';export * from './app/program-forward-evidence-model';export {parseUniqueJson} from './app/unique-json';",resolveDir:root},bundle:true,write:false,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};guard.assertFresh();new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const session=await loadProgramSessionModules();guard.assertFresh();return{...module.exports,...session,windowGuard:guard,assertFresh(){guard.assertFresh();session.assertFresh();}};}
