import {openSync, closeSync, fstatSync, readSync, writeFileSync, constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

// These imports are fixed trusted repository code. Input files are JSON data,
// never module paths, programs, URLs or evaluation instructions.
const project = fileURLToPath(new URL('../', import.meta.url));
const compiled = await build({stdin:{contents:
  "export {replayDemo,syntheticDemoInput} from './app/demo-engine.ts';export {demoLimits,verifyDemoArtifact} from './app/demo-model.ts';export {parseUniqueJson} from './app/unique-json.ts';",
  resolveDir:project},bundle:true,platform:'browser',format:'esm',target:'es2022',write:false});
const evaluator = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const inputLimit = evaluator.demoLimits.requestBytes, artifactLimit = evaluator.demoLimits.artifactBytes;

function readBounded(path, maximum) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > maximum) throw Error('Invalid file.');
    const bytes = Buffer.alloc(Math.min(maximum+1, stat.size+1));
    let length = 0;
    for (;;) {
      const count = readSync(fd, bytes, length, bytes.length-length, null);
      if (!count) break;
      length += count;
      if (length === bytes.length || length > maximum) throw Error('File changed or exceeds its limit.');
    }
    return bytes.subarray(0,length);
  } finally { closeSync(fd); }
}

function parse(bytes, maximum) {
  return evaluator.parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,16);
}

function save(path, value) {
  const text = JSON.stringify(value,null,2)+'\n';
  if (Buffer.byteLength(text) > artifactLimit) throw Error('Artifact exceeds its limit.');
  // A new trial cannot silently replace an earlier successful or failed trial.
  writeFileSync(path,text,{flag:'wx',mode:0o600});
}

async function main() {
  const [command, first, second, ...extra] = process.argv.slice(2);
  if (extra.length || !first || !['example','run','verify'].includes(command) ||
      (command==='run' ? !second : second!==undefined)) {
    process.stderr.write('Usage: node scripts/replay-demo.mjs example INPUT.json | run INPUT.json ARTIFACT.json | verify ARTIFACT.json\n');
    return 1;
  }
  if (command==='example') {
    save(first,await evaluator.syntheticDemoInput());
    process.stdout.write('Synthetic Demo input saved. It contains no current market data.\n');
    return 0;
  }
  if (command==='run') {
    let bytes=null,raw;
    try { bytes=readBounded(first,inputLimit);raw = parse(bytes,inputLimit); }
    catch {
      save(second,{version:1,kind:'REPLAY_INPUT_REJECTION',status:'REJECTED',
        inputDigest:bytes?createHash('sha256').update(bytes).digest('hex'):null,
        reason:'Input is unavailable or not a bounded unique-key UTF-8 JSON document.',
        classification:'AUTHOR_REPORTED',ordersEnabled:false});
      process.stdout.write('REJECTED: safe input rejection retained.\n');
      return 2;
    }
    const artifact = await evaluator.replayDemo(raw);
    save(second,artifact);
    process.stdout.write('Demo artifact retained: '+artifact.status+'.\n');
    return ['REJECTED','FAILED'].includes(artifact.status) ? 2 : 0;
  }
  const artifact = await evaluator.verifyDemoArtifact(parse(readBounded(first,artifactLimit),artifactLimit));
  if (!artifact.input) {
    process.stderr.write('This rejection has no retained valid input to replay.\n');
    return 2;
  }
  const reproduced = await evaluator.replayDemo(artifact.input);
  if (JSON.stringify(reproduced)!==JSON.stringify(artifact)) {
    process.stderr.write('Artifact does not match the exact input and trusted evaluator.\n');
    return 2;
  }
  process.stdout.write('Exact same-implementation replay matched. This is not independent qualification.\n');
  return 0;
}

try { process.exitCode = await main(); }
catch {
  // Never echo input, tokens, supplied paths or schema values to diagnostics.
  process.stderr.write('Demo command failed. Check bounded input, artifact integrity and a new output filename.\n');
  process.exitCode = 1;
}
