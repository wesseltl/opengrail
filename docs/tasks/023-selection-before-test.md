# 023: Retained candidate search and selection before TEST

Source integrated; 1491/1491 coordinated tests, typecheck and ordered build passed; no hosted rollout, unseen-data custody or research qualification is implied. Read `AGENTS.md`, the fixed Demo/comparison engines, and the existing experiment/review contracts before implementing. Preserve their behavior and all existing risk limits.

## User outcome

A human or externally hosted agent freezes two to four exact candidate strategy snapshots against one supplied TRAIN dataset, a common capital/cost/risk protocol and a declared selection rule. Every candidate receives one retained training disposition. Only after all are terminal can a deterministic choice be locked. A separately supplied later TEST dataset is accepted once, bound to that choice. Losing TEST results, interruptions and disagreements remain retained; they never trigger a replacement winner or another TEST.

The browser provides this actual workflow with explicit file import/export; a sponsor-local command provides durable admission, exclusive writing, crash recovery and the same fixed computation. Neither publishes, connects a provider, executes contributed code, accesses accounts or places orders.

## Shared implementation contract

Add `app/search-protocol.ts`; do not change existing schemas, evaluators, persistence writers, permissions, quotas, dependencies or migrations. Export `searchLimits`, `SearchPlanAdmission`, `SearchPlan`, `SearchAttempt`, `SearchLedger`, and these async functions:

- `createSearchPlan(raw)` / `verifySearchPlan(raw)`.
- `createSearchLedger(plan)` / `verifySearchLedger(raw)`.
- `admitSearchTrain(ledger, candidateId, startedAt)`.
- `admitSearchTest(ledger, {dataset, signals}, startedAt)`.
- `evaluateSearchAttempt(attempt, {signal?, finishedAt?})`.
- `finishSearchAttempt(ledger, terminal)`.
- `lockSearchSelection(ledger, lockedAt)`.
- `recoverSearchLedger(ledger, finishedAt)`; mark an admitted pending attempt interrupted, never silently rerun it.
- `pendingSearchAttempt(ledger)` (synchronous; operate on already verified values).

Admission is strict version-one plain bounded JSON:

```ts
{
 version: 1, id: canonicalUUID, createdAt: canonicalClock,
 candidates: [{source: StrategyPublicItem, attemptId: canonicalUUID, requestId: canonicalUUID}],
 train: {dataset: DemoDataset, signals: DemoSignal[]},
 test: {datasetId: canonicalUUID, firstClosedAt: canonicalClock, barCount: integer,
        gapBars: integer, provenance: 'SYNTHETIC'|'USER_SUPPLIED',
        permission: 'CREATED_SYNTHETIC'|'AUTHORIZED_USE',
        attemptId: canonicalUUID, requestId: canonicalUUID},
 initialCapital: number, hypothesis: string, falsification: string,
 selection: {objective: 'MAX_RETURN_PCT', minTrades: integer,
             maxDrawdownPct: number, minReturnPct: number,
             tieTolerancePct: 0.00000001, tieBreak: 'CANDIDATE_ORDER'}
}
```

Two to four candidates; require distinct versions and lifecycle identities, exact visible source/digest correlation, common market symbol/timeframe/direction, identical existing costs and risk definitions. Never silently rewrite a candidate. TRAIN inputs use existing `boundedDemoRequest`; TEST contains no prices/signals at freeze. Freeze exact chronological TEST interval of 2–2,000 bars, after TRAIN plus the declared excluded gap; preserve separate cold start and equal initial capital. Source authenticity, operator prior access and complete external search history remain unverified. No public experiment receipt may be manufactured for this local workflow.

Plans capture the admission, common protocol, TRAIN request/input digests, fixed method and both evaluator fingerprints, and a plan digest. Attempts retain phase, candidate ID, prefrozen attempt/request identities, canonical input, admission/completion clocks, status `RUNNING|EVALUATED|INTERRUPTED|UNAVAILABLE`, reason, primary artifact and complete comparison. Ledger contains `plan`, `attempts`, `selection`, hash-chained events and a ledger digest. Selection contains `decision: SELECTED|NO_SELECTION`, `selectedCandidateId: UUID|null`, `lockedAt`, complete TRAIN result-set identity and its decision digest. Additional typed derived fields may be added consistently by the core owner before consumers depend on them.

Selection eligibility requires actual terminal fixed-evaluator `COMPLETED` results, comparison `MATCH`, finite comparable metrics, declared minimum trade count, return floor and maximum drawdown. Preserve all ineligible results. Sort by return using the declared tolerance and original candidate ordinal for ties; no caller-picked winner. `NO_SELECTION` blocks TEST. Existing SHORT noncomparability must stay explicit; do not convert it to comparable research or change the engine to pass a search gate.

At most one pending attempt; training follows frozen candidate order, exactly once per candidate. Selection requires every TRAIN disposition and cannot be replaced. Require the claimed final TEST bar to close by its original admission clock in both admission and rehashed verification. This is declared coherence, not authenticated time or source. Persist TEST admission before computation; no second release, replacement dataset, changed definition/costs/capital/rule or retry after terminal interruption. An uncertain durable write is reconciled against the original file, not replaced. Reserve terminal storage for all candidates and TEST before admission: at most 5 × 10 MiB attempts in a 64 MiB ledger, plus a <=1 MiB plan and bounded events. Refuse excess bounds without truncating adverse results. Verify canonical identities and correlations without claiming verification reconstructs execution or proves complete custody.

## Product and CLI

`/search` exposes TRAIN → lock → supply TEST, complete adverse history, risk/benchmark information and explicit local-only export. It never promises persistence from browser memory; it supports verifying/importing the same ledger and warns that reload loses unexported work. Use accessible controls, bounded imports, stale asynchronous callback protection and disable mutations during pending work. No raw credential persistence or public POST.

`node scripts/search-strategies.mjs` exposes:

```text
freeze ADMISSION.json NEW_LEDGER.json
train LEDGER.json
admit-train LEDGER.json
execute LEDGER.json ATTEMPT_ID
lock LEDGER.json
test TEST_INPUT.json LEDGER.json
admit-test TEST_INPUT.json LEDGER.json
recover LEDGER.json
verify LEDGER.json
```

`train` advances exactly one frozen TRAIN candidate per call. Only `execute` can run an originally pending ID. `recover` consumes it as interrupted. Use the existing first-party fixed bundling and source hash checks, POSIX advisory lock, private regular non-symlink/single-link files, bounded fatal UTF-8/duplicate-key JSON parsing, atomic create-new or expected-old-hash replacement and file/directory fsync. Diagnostics contain safe identities/status/digests, never supplied descriptions, paths, tokens or raw exceptions. No network, runtime import from data, paid inference or arbitrary executable inputs. Document meaningful exit outcomes and unknown acknowledgments.

## Acceptance and limits

Test actual multi-candidate fixed computation and durable local processes. Include a TRAIN winner that loses TEST and stays selected; TEST changes cannot affect TRAIN choice; adverse/no-trade/failed/disagree/interrupted dispositions cannot be omitted; no early TEST/selection, cost/risk/data mutation, forged input/comparison, late threshold changes, repeated TEST, terminal overwrite, concurrent double admission or credential leakage. Retain crash/uncertain acknowledgment evidence and safe capacity failure.

Source snapshots and local files are not authenticated custody. A copied/rewritten ledger or undisclosed trials remain possible. Classification is `AUTHOR_REPORTED`; qualification `NONE`; independence and unseen data `NOT_ESTABLISHED`. Do not clear `BEST_OBSERVED`, `POST_SELECTED`, incomplete-history concerns or the existing positive-review blockers. Genuine prospective/independently controlled TEST, shared precommit enforcement, isolated programmable execution, qualified rankings and hosted/browser acceptance remain unfinished parts of the full objective.

Run meaningful focused tests, then `npm test`, `npm run typecheck`, ordered `npm run build` through Sites, and `git diff --check`. Save with source/package verification; no deployment or policy change without the already-required trusted maintainer approval and cost review. Rollback is a prior saved source/package; files created by the new local tool remain sponsor-owned and must be preserved rather than deleted.
