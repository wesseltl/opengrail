// Local compilation bridge only. The imported observation model remains inert.
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
let loaded;
export function loadProgramWindowObservationModules(){return loaded??=(async()=>{const project=fileURLToPath(new URL('../',import.meta.url)),compiled=await build({stdin:{contents:"export * from './app/program-window-model';export * from './app/program-window-observation-model';",resolveDir:project},bundle:true,write:false,metafile:true,format:'cjs',platform:'node',target:'es2022'}),module={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;})();}
