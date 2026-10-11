# Programmable strategies — local synthetic workflow

This source increment adds actual numeric binary strategies. V2 publication stores attributable bytes and parameters only. `/program` and `scripts/program-replay.mjs` run a trusted restricted interpreter on local closed-bar data, generate CUSTOM signals, then use the existing Demo and reference trading methods. All outcomes remain AUTHOR_REPORTED, qualification NONE, generator independence NOT_ESTABLISHED. No hosted execution, orders, model inference or financial account access is introduced.

## Publish and inspect

Use Strategy Hub's program editor or the existing human/agent strategy writer. V2 commands add `version:2` and `program` alongside the original content fields. V2 records retain `content.program`. Revisions preserve source version; a deliberate fork may change it. Exact raw binary SHA-256, original attribution, current credential, immutable lineage, suppression and identical uncertain-write checks still apply.

Program fields are `profile:"opengrail-wasm-i32-f64-v1"`, `abi:"opengrail-causal-signal-wasm-v1"`, canonical lowercase `bytesHex`, raw-byte `digest`, and up to sixteen finite parameters within ±1e12. Parameter negative zero is refused because JSON cannot distinguish it from positive zero. Recognizable credential prefixes in bounded binary metadata are refused; this does not detect arbitrary covert encodings. The source must use SIGNAL/CUSTOM, direction-consistent event and maxAgeBars=1. Existing position, loss, cost and execution limits stay fixed.

Publication validates bytes and hashes without running the program. Legacy Demo, continuous Session, Search and experiment-registry inputs reject V2 sources. They cannot claim to evaluate code using caller-supplied signals. An exact Strategy Hub link opens `/program?strategy=…&digest=…`; it never chooses a latest version or runs automatically.

## Restricted binary ABI

Required export:

```text
on_bar(index:i32, closedAt:f64, open:f64, high:f64,
       low:f64, close:f64, volume:f64) -> i32
```

Optional `configure(index:i32,value:f64)->void` receives each frozen parameter before the first bar. Parameterized sources without it fail before bar execution. `closedAt` is the included bar's epoch milliseconds. Outputs are 0=NONE, 1=BULLISH, 2=BEARISH. Each trial starts with fresh program state; only current closed-bar numbers and frozen parameters enter the host interface. Code authors may still have prior knowledge or embed future constants. This interface does not establish unseen-data custody or economic usefulness.

Real i32/f64 operations, typed locals, structured control, direct calls, globals and one bounded memory page are supported. Finite binary64 is an explicit restriction: NaN/Infinity constants, loads and computed results are refused. Integer wrapping, unsigned reinterpretation and signed-zero arithmetic follow the documented profile. Global little-endian bit snapshots distinguish guest-generated -0 after JSON round trips. Imports/WASI, host functions, start, tables/indirect calls, reference types, SIMD, threads, shared/unbounded memory, memory64 and unsupported instructions are refused.

Module size is 4096 bytes; 32 types/functions, 128 locals/function, 64 globals, 8192 decoded instructions, nesting 32, call depth 16 and operand stack 256. Each executed semantic instruction costs one fuel, including branches/calls. Else/end delimiters are not AST instructions. Each invocation has 20,000 fuel; a complete job has 2,000,000. The parser validates structure/types/control before execution; runtime guards remain active. No admitted guest bytes are passed to native WebAssembly, eval, Function or dynamic imports. A Worker provides responsiveness/cancellation; it is not an OS sandbox. This implementation is not authorization for outside native code or hosted execution.

## Exact local evidence

Freeze source, dataset, capital, hypothesis, falsification, emergency boundary and method digest before admission. The method binds exact declared interpreter/runner/input/source/strategy/Demo-model/JSON-parser/lockfile fingerprints. Run `node scripts/program-fingerprints.mjs` after changing one of those declared dependencies; `--check` rejects drift. These source hashes are author-supplied identities, not attestations of honest execution or a complete software-supply-chain proof.

Keep all configuration and closed-bar output/fuel dispositions, generated signal identities/times, exact final global bits/memory, and every trap/invalid output/resource failure. At most 500 signals are admitted; the 501st output fails the attempt instead of producing a truncated trading result. Opposite/final-bar outputs remain for Demo's original rejection rules. Generated signal IDs bind the complete input, so changing future input changes IDs even where earlier semantic outputs remain identical.

The retained V2 source derives a distinct internal V1 projection solely for the unchanged evaluators. The full original source and projection remain separate. Preserve the complete Demo artifact and fixed primary/reference comparison. Agreement compares trading on those generated signals; it does not independently qualify the generator, author, data or returns. A failed/no-trade/loss outcome stays in the same history as successful computation.

Three complete attempts, 10 MiB per outcome, 512 KiB per input and 32 MiB whole-history bounds are fixed. Reserve worst-case retained space before execution. Pending attempts recover as INTERRUPTED with original IDs, never as completed results. Browser persistence must complete before posting to the trusted Worker; actual browser acceptance is still a separate check. Storage failure blocks execution. Known source/account suppression clears held payload; separately retained metadata does not pretend to preserve the original full ledger. Export before moving environments.

Safe bounded malformed/unsupported source snapshots retain exact rejected JSON, hash and disposition without execution. Credential-bearing, non-plain, oversized or unrepresentable input instead has an explicit unavailable-snapshot disposition and a raw digest when available. Never silently trim source or relabel missing data as a completed evaluation. Local hashes/event chains cannot prove an operator did not omit a separate trial or rewrite the whole history.

## Sponsor-local CLI

```sh
node scripts/program-replay.mjs example INPUT.json
node scripts/program-replay.mjs run INPUT.json ADMISSION.json FINAL.json
node scripts/program-replay.mjs verify FINAL.json
node scripts/program-replay.mjs recover ADMISSION.json RECOVERED.json
node scripts/program-replay.mjs run NEXT.json NEXT_ADMISSION.json NEXT_FINAL.json FINAL.json
```

Example uses a reviewed first-party binary and invented prices. Caller files are bounded unique-key UTF-8 JSON, not code/module paths, shell commands or remote fetch instructions. Output files are exclusive-created; admission is durable before execution. A crash leaves the original admission for explicit interruption recovery. Verify explicitly reproduces each computational outcome with the same implementation, reports interruptions/rejections separately, and never grants independent qualification. Node ≥22.13 and already-reviewed repository dependencies are required.

## Outstanding full goal

Public program manifests/outcomes, per-candidate chronological TRAIN/TEST generation, persistent forward program state, program-aware comparison/review and independent qualification remain to be integrated. Browser/source preparation is not hosted acceptance, recruited operators, authentic market-data custody or verified reputation. The [task specification](tasks/030-programmable-signal-strategies.md) keeps these requirements explicit. No profitable-strategy claim follows from passing synthetic tests.
