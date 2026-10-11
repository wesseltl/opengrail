# Local second-implementation comparison

This source increment implements a separately written, trusted local reference evaluator and a bounded comparison of a supplied Demo artifact with fresh primary and reference runs. It creates no registry status, persistent comparison attachment, execution grant or independently qualified research. Coordinated local tests, typecheck and whitespace checks passed; implementation, coverage and evidence are recorded in the [release review](release-local-comparison.md). The local comparison's ordered Sites build completed successfully; exact packaged source identities are recorded in the [validation receipt](../validation/local-comparison-20261011.json).

## The evidence boundary

The existing primary evaluator implements the declared `opengrail-demo-v1` method. The reference evaluator is a distinct implementation of that same method, using a separate event/lot/cash-flow accounting design. Its simulation logic must not import, call or fall back to the primary engine, nor reuse its indicator, fill, allocation, accounting or metric helpers. Shared strict schemas and hashing utilities remain shared dependencies.

Both implementations share the declared specification, TypeScript/JavaScript runtime, supplied data and portions of the validation contract. The reference author has access to the primary source; this is not a claim of clean-room development. The team, operator or human sponsor may also be shared. Different agents, files or source hashes do not establish independent investigators or independent data. A matching result cannot verify that a dataset is authentic, licensed, historically available or unseen, or that every prior parameter trial was disclosed.

The comparison reruns both trusted implementations on the exact retained input. It compares three pairs: `CLAIM_PRIMARY`, `CLAIM_REFERENCE` and `PRIMARY_REFERENCE`. A match requires all three semantic comparisons to match. It establishes the bounded local agreement described below; it does not prove that the supplied artifact historically executed either source. Even a self-consistently hashed claim may have been fabricated. All published registry records remain `AUTHOR_REPORTED`.

The registry's existing source declaration belongs to the manifest. It supplies no structured per-outcome implementation/execution attestation. This local sidecar remains separate from the unchanged registry, rather than retroactively turning an ordinary `REPRODUCTION` claim into proof of the reference implementation. Independent qualification still requires the remaining [Task 003](tasks/003-independent-experiment-registry.md) evidence and a reviewed authority boundary.

## Exact input and declared assumptions

Admission verifies a bounded Demo artifact and its internal request, strategy, dataset, signal, declared-method and result digests. Reconstructible artifacts must retain the complete exact valid request. A rejected artifact can retain a digest of the unvalidated raw request, and sometimes its request ID, while keeping accepted strategy/dataset/signal identities absent. That rejected request hash is not proof of admitted input. Reference and primary runs receive the same canonical input; neither retrieves missing data, fills missing bars, fetches source URLs or connects a provider. A symbol or `ALTFINS`/`TRADINGVIEW` label remains an authored assumption.

The reference implements all seven declarative families: TREND, RSI, BREAKOUT, DCA, GRID, SIGNAL and RULES, for LONG and SHORT under the existing [Demo methodology](demo-methodology.md). Passing fixtures exercise every family in both directions; this is not exhaustive parameter or market validation. Reviewed boundaries include closed-bar decisions and next-open fills; signal availability, age and consumption; indicator warmup; per-side costs; adverse gaps and stop-first dual touches; allocation/cash/collateral; UTC daily halts; emergency timing; uncapped SHORT failure; and terminal/failed/no-trade outcomes. A missing implementation must never silently invoke the primary engine or report successful agreement.

The reference implements the same declared simulation assumptions. Agreement cannot validate those assumptions against an actual order book, intrabar path, margin system, borrow/funding cost or real fill. A common methodological error can remain in both implementations and their shared specification.

## Fixed semantic comparison

The compared projection includes status/reason, all trade fields, the complete equity/account trace, all metrics and baseline fields, and ordered audit fields other than `audit.details` prose. Input identity and bound digests are checked separately. Free audit wording is excluded because two implementations may describe the same event differently; the original artifact digests still bind that wording.

Array lengths and order, field presence, nulls, enums, IDs, timestamps, booleans, decisions and comparability are exact. Numerical indices and counts are also exact: `barIndex`, `entryBar`, `exitBar`, `gridLevel`, `openPositions`, `trades`, `wins` and `losses`. Declared `initialCapital` and `allocationPct` remain exact.

Other finite numerical fields match only when:

`abs(a - b) <= 1e-8 + 1e-9 * max(abs(a), abs(b))`

This predeclared absolute-plus-relative allowance addresses floating-point arithmetic differences. It cannot excuse a different entry, exit, signal consumption, halt, failure, array count or status. Aggregate return alone is insufficient: different trades can produce the same final number. A tolerance match is bounded numerical agreement, not bit-identical output or an error bound for actual trading.

Comparator version, projection and tolerance must be pinned with the source evidence before reviewing a result. A later change creates distinct comparison evidence. Do not widen tolerances, drop failed rows or tune the reference to hide a disagreement without preserving and reviewing the original mismatch.

A genuine numerical-path disagreement is retained in the [SMA regression](../tests/reference-disagreement.test.mjs): after a daily halt, the primary fills its historical SMA cache through an overflowing window, while the reference computes finite current/prior windows after the UTC reset. Earlier observable events agree; the later failure and re-entry disagree. The comparison preserves that mismatch without changing the engine sources or tolerance. Such disagreement requires review before any qualification; it is not proof that either implementation has established the correct economic model.

## Honest terminal outcomes

Invalid JSON, oversized input and corrupt digests fail admission without a confirmed comparison. Safe local attempt history must retain that disposition without arbitrary raw input or exception text. A valid rejected artifact without retained valid input receives an `UNRECONSTRUCTIBLE` result, with no primary/reference summary or comparison pairs; it cannot be rerun or counted as a match. The verifier rejects inconsistent report states, a changed declared method and unprepared source fingerprints.

A runtime exception receives a safe retained `FAILED` comparison instead of exposing input, paths, credentials or exception contents. Simulation failures, insolvency, negative and no-trade outcomes are retained evidence. Agreement on a failure means only that the compared failure semantics agree; it does not make failed metrics comparable or profitable.

Disagreements remain inspectable with bounded differences and original digests. A selected matching case cannot replace mismatches or establish a complete search history. Browser attempt retention is local and finite, rather than a durable registry or a proof that every external trial was retained.

## Local operation and copies

The `/validation` reader accepts an exact visible public outcome or a bounded local artifact import, runs fixed trusted code locally and exports a separate comparison report. Public reads use existing GET endpoints; comparison submits no POST, changes no public record and creates no persistent attachment. Uploaded JSON is data, not executable code, a module path or evaluator instructions. No arbitrary code or paid hosted evaluator runs on the server.

Local imported artifacts do not establish authenticated authorship or a current public registration, even when their hashes are valid. Public source identity requires the exact current canonical publication and digest. Previously downloaded copies and local comparison reports cannot be recalled when a source is later hidden or withdrawn; they must not be presented as fresh authenticated public content.

The local CLI uses the same fixed comparator and checks that the declared evaluator fingerprints still match the source files before running. For an existing local artifact and a new output filename:

```sh
node scripts/compare-evaluators.mjs check ARTIFACT.json NEW_REPORT.json
```

It accepts a bounded regular file with strict UTF-8 and unique-key JSON, and refuses to overwrite an existing report. Exit `0` means a retained `MATCH`; exit `2` means a retained mismatch, failed comparison or unreconstructible input. Exit `1` means admission, source preparation or output failed and no confirmed report is claimed. Reports are bounded to 128 KiB. The report verifier checks bounded schema, digest and declared source identity; it does not attest execution history. Source review and fresh fixed-code comparison provide the additional local evidence.

The report's two evaluator SHA-256 values identify the two engine files, not their complete transitive dependencies or a compiled runtime. The release receipt must also identify comparator, shared validation/hashing source, dependency lockfile and build environment. These identities make the packaged code inspectable; they are not signed execution attestations.

The UI caps attempted comparisons at 16 in page memory, blocking additional attempts rather than evicting earlier failures. Local artifact imports use the existing 8 MiB artifact limit. Refresh/navigation loses the page history; export preserves the available sidecars locally. These allowances do not expand the registry's 512 KiB artifact intake or its permissions.

## Required checks and remaining qualification

Review the reference dependency graph and source, rather than accepting a different filename/hash as implementation independence. Hand-computed fixtures should establish timing and arithmetic without deriving every expected value from the primary engine. Shared golden fixtures are useful regression evidence but can encode a shared error.

Require all supported families and both directions, flat-price friction, protective gaps/dual touches, immediate slipped-entry stops, signal boundaries/ordering/consumption, UTC resets, GRID/DCA accounting, emergency timing and uncapped insolvency. Future-data/prefix invariance and independently constructed boundary cases must exercise both engines. Deliberately self-hashed wrong claims, changed trade timing and identical-ROI/different-trace claims must fail comparison. Corrupt inputs, bounds, unconstructible rejections, runtime failures, stale reads and finite attempt retention require meaningful regressions.

Performance qualification remains separate: permitted authentic data, historical availability, full search/selection history, valid untouched holdouts, independent investigators/operators and execution evidence, conflict review, robustness and a maintainer-approved qualification process. Neither this comparison nor future qualification guarantees returns or grants financial execution.
