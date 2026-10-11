# 030 — Programmable signal strategies

Status: separately reviewed source design and local synthetic implementation. Hosted execution, rollout and outside-code acceptance are not authorized or established by this specification. This increment advances the full programmable workflow; public program-run registry methods, chronological/search/forward integration and independent qualification remain explicit follow-on requirements.

## Real workflow

Publish, revise or fork an attributable immutable strategy containing actual restricted WebAssembly binary bytes and numeric parameters. Inspect the exact source. A human or external agent freezes a local program run before execution. A trusted fuel-bounded interpreter consumes one completed bar at a time, retains every output and resource disposition, generates causal CUSTOM signals, and sends them through the unchanged Demo trading and reference evaluators. Export the complete source, run and adverse history. Publication stores bytes and metadata only; ordinary server routes never execute guest modules.

## Isolation review

Guest bytes are data for an explicitly restricted interpreter: no native WebAssembly compile/instantiate, JavaScript evaluation, dynamic guest imports, host function imports, URLs, paths, filesystem, network, clock, randomness, credentials or financial capabilities. Workers can improve responsiveness and cancellation; they are not an OS security boundary. Node permissions do not protect against malicious code. Parser bounds and deterministic per-instruction fuel bound guest allocation and computation. A source-prepared implementation and first-party synthetic tests do not approve broader hosted execution or contributed native binaries.

The binary profile supports real i32/f64 arithmetic, typed locals, structured branches/loops, direct functions, bounded mutable globals and optional bounded linear memory. Unsupported features are rejected explicitly. Imports/WASI, start sections, tables/indirect calls, references/GC, SIMD/threads/shared memory, memory64 and unbounded growth are refused. Structural/type/control-flow validation occurs before execution; runtime invariants remain checked. Bind checked exact interpreter, runner, input/source models, strategy/Demo models, JSON parser and lockfile source fingerprints before admission. Refuse recognizable credential prefixes in binary metadata without claiming covert-data detection. Bound binary size, section/count/LEB work, expanded locals, AST depth, call/operand stacks, memory, per-bar fuel, total fuel, traces, signals and retained attempts before allocation. Charge fuel before every executed instruction, including branches and calls. Document the admitted numerical semantics and test them against reviewed bounded native first-party fixtures only.

## Source compatibility

Add strict version-two strategy publication/records with a `program` field alongside the existing market/risk/cost definition. Preserve version-one bytes, fields and quotas. Program sources require SIGNAL/CUSTOM entry with direction-consistent event and unchanged risk bounds; program code cannot choose leverage, fills, costs or limits. Retain exact canonical module hex bytes and SHA-256, profile/ABI identity and up to sixteen finite numeric parameters. A revision preserves source version; an explicit fork may introduce a program source. Source hash validation and current authenticated lineage/lifecycle/uncertain-write guards remain mandatory. No schema migration, new agent role, quota increase, expense or production configuration change is implied. The existing policy's additive V2 interpretation needs maintainer rollout review.

## ABI and execution

Profile: `opengrail-wasm-i32-f64-v1`. ABI: `opengrail-causal-signal-wasm-v1`.

Required export `on_bar(index:i32, closedAt:f64, open:f64, high:f64, low:f64, close:f64, volume:f64) -> i32`. Optional export `configure(index:i32,value:f64) -> void` receives the frozen indexed parameters before the first bar. Return `0=NONE`, `1=BULLISH`, `2=BEARISH`; any other output terminates the attempt. State starts fresh for every admitted trial. Reject negative-zero JSON input parameters/volume; retain exact little-endian global bits for guest-generated signed zero. Host inputs include only the current closed bar and the program's own retained prior state. No future rows or host objects enter the interpreter. This does not prove that code authors lacked prior knowledge or embedded future information.

Signals have deterministic identities bound to the complete run input and bar index/event, `provider=CUSTOM`, and observation/availability at that bar's close. Opposite-direction and final-bar outputs remain in the complete stream for the unchanged Demo disposition logic. Refuse supplied input signals and signal-capacity overflow; never silently mix, sample or replace provenance.

A separately typed local program input retains the exact V2 source and generates an internal V1 Demo projection solely for the unchanged evaluators. That internal projection is explicitly derived and is not a public strategy version. Ordinary Demo/Session/Search/registry paths must reject program sources until their genuine program path is integrated; they cannot backtest a program using arbitrary caller-supplied signals or publish the projection as the exact public source. Current period comparisons do not independently validate the signal generator.

## Evidence and integration

Retain durable admission before execution (browser IndexedDB and separate sponsor-local CLI files) and every malformed module, unsupported feature, trap, invalid output, fuel/signal-capacity exhaustion, cancellation, recovery interruption, zero-trade run and loss. Bind module/ABI/interpreter/source fingerprints, fixed limits, parameters, dataset and input digests, complete per-bar output/fuel trace, generated signals, derived Demo request, complete artifact/comparison and final bounded state identity. Reserve whole-history bytes before admission, never trim adverse history, and preserve original IDs on recovery/retry. Interrupted records cannot become completed results.

Provide an actual Strategy Hub program source editor/inspection and an exact `/program` local workflow, plus a deterministic sponsor-local CLI. The CLI accepts bounded JSON/binary data, never caller commands, guest JavaScript, module paths or remote fetch instructions. Public source permissions remain inert. The browser workflow must retain source lifecycle/current-identity fences, exports and explicit consent. No automatic result publication or source adoption.

Required tests cover non-preset modules changing actual signals and trades; deterministic replay; prefix invariance under changed future prices; module/ABI/parameters/state/trace/output alterations; parser/type/LEB/numerical/control-flow edge cases; imports/unsupported features/resource exhaustion; current source credentials/lineage/suppression/uncertain acknowledgements using actual D1/HTTP; adverse history/recovery; real rendered controls and exports; and explicit rejection by legacy execution paths.

## Full goal still outstanding

Implement an additive public program manifest/outcome method retaining this complete provenance, genuine per-candidate TRAIN/TEST generation and forward persistent state, program-aware comparison/review, authentic data custody and independent qualification. Prove hosted onboarding, real useful repeat contributors and evidence-based reputation separately. Do not describe this increment as completed public programmable evaluation or profitable automation.

Primary isolation sources: [WASM security](https://webassembly.org/docs/security/), [core binary modules](https://webassembly.github.io/spec/core/binary/modules.html), [numeric semantics](https://webassembly.github.io/spec/core/exec/numerics.html), [Node permissions](https://nodejs.org/download/release/v22.13.0/docs/api/permissions.html), [worker limits](https://nodejs.org/download/release/v26.8.2/docs/api/worker_threads.html#new-workerfilename-options).
