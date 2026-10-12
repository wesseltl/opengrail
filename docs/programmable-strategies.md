# Programmable strategies — local synthetic workflow

This source increment adds actual numeric binary strategies. V2 publication stores attributable bytes and parameters only. `/program` and `scripts/program-replay.mjs` run a trusted restricted interpreter on local closed-bar data, generate CUSTOM signals, then use the existing Demo and reference trading methods. All outcomes remain AUTHOR_REPORTED, qualification NONE, generator independence NOT_ESTABLISHED. No hosted execution, orders, model inference or financial account access is introduced.

## Publish and inspect

Use Strategy Hub's program editor or the existing human/agent strategy writer. V2 commands add `version:2` and `program` alongside the original content fields. V2 records retain `content.program`. Revisions preserve source version; a deliberate fork may change it. Exact raw binary SHA-256, original attribution, current credential, immutable lineage, suppression and identical uncertain-write checks still apply.

Program fields are `profile:"opengrail-wasm-i32-f64-v1"`, `abi:"opengrail-causal-signal-wasm-v1"`, canonical lowercase `bytesHex`, raw-byte `digest`, and up to sixteen finite parameters within ±1e12. Parameter negative zero is refused because JSON cannot distinguish it from positive zero. Recognizable credential prefixes in bounded binary metadata are refused; this does not detect arbitrary covert encodings. The source must use SIGNAL/CUSTOM, direction-consistent event and maxAgeBars=1. Existing position, loss, cost and execution limits stay fixed.

Publication validates bytes and hashes without running the program. Legacy Demo, continuous Session, Search and batch/continuous experiment methods reject V2 sources. The separate PROGRAM_DEMO registry method retains the exact V2 source. They cannot claim to evaluate code using caller-supplied signals. An exact Strategy Hub link opens `/program?strategy=…&digest=…`; it never chooses a latest version or runs automatically.

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

Freeze source, dataset, capital, hypothesis, falsification, emergency boundary and method digest before admission. The method binds exact declared interpreter/runner/input/evidence-validator/source/strategy/Demo-model/JSON-parser/lockfile fingerprints. Run `node scripts/program-fingerprints.mjs` after changing one of those declared dependencies; `--check` rejects drift. These source hashes are author-supplied identities, not attestations of honest execution or a complete software-supply-chain proof.

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

Programmable selection-before-TEST is integrated separately in task 032: exact V2 candidates generate their own signals, complete adverse TRAIN evidence locks selection, and a sole separate TEST starts fresh. See [the programmable search workflow](program-search.md). Persistent forward program state and Plans are integrated separately through [program forward Demo](program-forward-demo.md). The [direction-matched V2 workflow](direction-matched-program-search.md) retains its complete synthetic SHORT Search-to-forward chain; [prospective declarations](prospective-program-commitments.md) register fitting whole future plans and attributable later evidence. Accepted local checks are recorded in [task 037’s receipt](../validation/prospective-program-commitments-20261012.json). Independent qualification, authentic licensed observations, complete forward horizons and hosted availability remain outstanding. Public program manifests/outcomes, same-implementation generator comparison, paired human computational review and comparative arena provenance are prepared in task 031; production deployment and hosted acceptance remain unverified. Browser/source preparation is not hosted acceptance, recruited operators, authentic market-data custody or verified reputation. The [task specification](tasks/030-programmable-signal-strategies.md) keeps these requirements explicit. No profitable-strategy claim follows from passing synthetic tests.


## Share a complete program experiment

Task 031 adds the explicit `PROGRAM_DEMO` method with experiment record version 3. Prepare a complete finished trial from Program replay, then import the outcome in Experiments. Review the exact source and dataset, enter truthful search/holdout/conflict disclosures, and give separate public sharing consent. Publish the manifest first and the retained outcome second. This is retrospective evidence unless registration actually preceded execution. Publication is optional and never automatic.

The manifest stores the full original program input and a declared evaluator descriptor: `version`, `sourceVersion`, `methodDigest` and all nine `implementations` fingerprints. The outcome's `ARTIFACT` stores the complete program outcome, including generated signals, every trace/fuel/configuration entry, state identity, internal projection and trading artifacts. `INTERRUPTED` and `ARTIFACT_UNAVAILABLE` dispositions retain their reasons. Program failures and cancellations may be published as attributable adverse evidence. They cannot be relabeled successful trades.

The unchanged public input allowance is 196,608 bytes; an artifact is limited to 524,288 bytes and a full outcome record to 589,824 bytes. A complete local outcome may exceed those budgets. Publication then refuses the whole record while local history remains intact. No adverse trace or state is sampled or removed to fit the network. Do not publish private datasets, credentials or data without redistribution rights.

The server performs bounded structural, source, hash and correlation checks. It never executes the signal module, Demo engine or reference engine. A coherently self-hashed invented generator trace can therefore be stored only as AUTHOR_REPORTED. Execution assurance requires explicit local reconstruction and separate reviewer attestations.

## Reproduce and challenge exact evidence

Open an exact public outcome from Experiments in Validation or Program replay. Current public reads bind that outcome, its manifest and the original V2 source. Inspect the complete input before authorizing local computation. Reconstruction reruns the restricted generator with the exact input and claimed attempt ID, then repeats the trading evaluations. A matching digest binds the entire deterministic outcome, including output/fuel/state and trading evidence; it is called SAME_IMPLEMENTATION_RECONSTRUCTION, not independent generator validation.

An external operator can retain a complete local comparison without a model provider or network:

```sh
node scripts/compare-program.mjs check OUTCOME.json NEW_ADMISSION.json NEW_RESULT.json
node scripts/compare-program.mjs verify NEW_RESULT.json
node scripts/compare-program.mjs recover NEW_ADMISSION.json RECOVERED_RESULT.json
```

Admission is retained before execution; result files are exclusive and contain the original claim, compact comparison and full reconstructed outcome. Recovery preserves the original admission and records interruption without replay. Verification checks retained identities and differences; it does not establish who ran the computation. Failed/trapped/fuel-exhausted computation can match reproducibly while remaining a failed strategy attempt. Cancellation and unknown-input claims receive explicit unavailable/interrupted results.

A separately authorized human reviewer can bind two program comparison reports to the exact original and reproduction outcomes. Positive review requires distinct retained local attempt IDs and semantically identical original/reproduction outcomes, ignoring only the top-level attempt ID and outcome digest. Contradictory generated outputs cannot receive a positive decision even if compact reports claim MATCH. Existing sponsor separation, process attestations, disclosure gates, current review heads, moderation and quotas apply. A public agent cannot grant itself reviewer authority. Qualification stays NONE, independence and unseen-data custody remain NOT_ESTABLISHED.

The arena retains full generated provenance before using fresh equity for diagnostics. Program competitors must share exact dataset, capital, market, risk, cost and method identities; their modules and generated streams may differ. Mixed or incompatible methods, zero-trade runs, failures, mismatches and adverse disclosure/review context remain visible and prevent unsupported ranks. See [task 031](tasks/031-public-program-experiments.md).
