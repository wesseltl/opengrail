# Selection before TEST

Search offers separate Rules and Programs modes. The Rules protocol below keeps its original version, bytes and page-memory behavior. Programs uses actual restricted signal generation, durable local admission and complete retained reconstruction; see [programmable search](program-search.md). Mixing rule/program candidates is not supported in this increment.

The `/search` workspace and `scripts/search-strategies.mjs` implement one bounded local selection protocol. It is separate from public experiment registration. It neither fabricates public receipts nor removes any existing post-selection concern or review blocker.

Freeze two to four exact visible source snapshots, one TRAIN dataset and signals, initial capital, identical market/cost/risk definitions, a fixed return/trade/drawdown rule and the later TEST interval. No TEST prices or signals are accepted at freeze. All candidates run through the existing fixed primary and reference computations with one retained disposition each, in frozen order. Selection waits for the entire result set. Ineligible/no-trade/failed/interrupted/disagreeing trials remain retained; NO_SELECTION blocks TEST.

After locking, separately supply TEST with the prefrozen dataset ID, rights class, interval/count and excluded gap. Only the locked strategy is admitted, using unchanged costs, risk and capital with a separate cold start. The claimed final TEST bar must close no later than its admission clock. This checks declared coherence, not clock or source authenticity. Persist the sole TEST admission before computation. A losing result, mismatch, crash or interruption does not unlock selection or allow another TEST.

## Browser

Import a strict admission JSON file, inspect its candidates and protocol, and freeze deliberately. Run TRAIN in sequence, lock selection, then import separate TEST input. Complete history includes every candidate, its actual result/comparison and benchmarks where comparable. Import/export uses the same verified ledger as the CLI. Exports include complete adverse evidence.

Browser state lives in page memory. Reloading or leaving loses unexported work. Export before leaving. Importing a RUNNING admission does not silently execute it; explicit recovery records interruption. Concurrent button work and stale asynchronous callbacks are guarded. This is component-tested local behavior, not real-browser or hosted acceptance.

A verified locked SELECTED result can also prepare a [forward Demo handoff](forward-demo.md). This preserves the entire ledger and adverse TEST history, fills the exact winner/capital in Session, and requires new data-rights acknowledgement before a separate prospective plan is exported. It does not reopen TEST, retune the winner, launch a provider or establish independent precommit timing.

The public guide at `/agent-guide/search` supplies the complete invented schema-valid admission and separate TEST example. Synthetic authors/versions are not registered participants and prove no real market result.

## Sponsor-local agent workflow

Requires a reviewed checkout of the published OpenGrail application source on `source/opengrail-foundation`, existing Node >=22.13 dependencies and Python 3 on a POSIX filesystem. Record the exact commit and inspect the fixed tooling first. Public API enrollment grants no access to the separate private Capital Desk. Files are data; submitted source is never executed.

```sh
chmod 600 ADMISSION.json TEST_INPUT.json
node scripts/search-strategies.mjs freeze ADMISSION.json NEW_LEDGER.json
node scripts/search-strategies.mjs train LEDGER.json
# Repeat TRAIN once per remaining frozen candidate.
node scripts/search-strategies.mjs lock LEDGER.json
node scripts/search-strategies.mjs test TEST_INPUT.json LEDGER.json
node scripts/search-strategies.mjs verify LEDGER.json
```

To admit without computing, use `admit-train LEDGER.json` or `admit-test TEST_INPUT.json LEDGER.json`. Resume only the exact original pending identity with `execute LEDGER.json ATTEMPT_ID`. To retain a crash/cancellation as interruption, use `recover LEDGER.json`. A terminal TEST cannot be replaced or retried.

The writer checks fixed physical evaluator fingerprints before computation, takes the existing advisory lock, accepts bounded fatal-UTF-8/duplicate-free JSON, requires private regular non-symlink/single-link ledger files and atomically fsyncs file/directory state before confirming admission or terminal results. Create refuses an existing target; updates require its original content hash. Retained terminal capacity covers every frozen candidate and TEST. Raw descriptions, paths, tokens and exception details do not enter diagnostics.

Exit 0 confirms the requested operation or complete matching computation; a monetary loss can still be a valid completed result. Exit 2 indicates a retained interruption, unavailable/failed/rejected result or disagreement. Exit 1 means the command was not confirmed. Keep the original file after uncertainty and verify it before reconciling. Do not infer that exit 0 proves profitability or execution authenticity.

## Method and limits

The objective is MAX_RETURN_PCT with declared minimum trades, return floor and maximum drawdown. Eligibility uses COMPLETED primary artifacts, MATCH comparison and comparable finite metrics. The declared fixed numerical tolerance and original candidate ordinal resolve ties. Existing SHORT noncomparability remains ineligible rather than being relabeled. The selector binds the full TRAIN result-set identity and preserves a locked NO_SELECTION decision when appropriate.

Primary/reference engines, shared method/runtime/schemas and all existing risk/cost rules remain unchanged. Each phase receives separate state, capital and warmup. TRAIN and later TEST are disjoint and retain a declared gap. This is one fixed local search, not a risk-adjusted cross-strategy public ranking or independent validation arena.

At most four candidates and five total attempts use bounded complete artifacts/comparisons in a 64 MiB ledger with a <=1 MiB plan. The tool reserves worst-case terminal capacity before admission and refuses excess rather than trimming unfavorable evidence. No dependency, schema, migration, scope, quota, production configuration or financial authority is added.

## What this does not establish

Classification remains AUTHOR_REPORTED, qualification NONE, independence and unseen data NOT_ESTABLISHED. Supplied source/data identity is checked, not authenticated custody. Files can be copied/rewritten and trials performed outside the ledger. The workflow orders its own computation; it cannot prove historical TEST was never seen, a data source is authentic, the external search log is complete or the operator is independent. Genuine prospective or independently authenticated custody, shared precommit/release enforcement and independent qualification remain required future work.

Existing BEST_OBSERVED/POST_SELECTED flags and positive-review blockers must remain. No automatic public submission, token/model/API call, provider connection, paid inference, contributed-code execution, reputation, Live order or profitability claim follows.

## Rollback

The previous saved source/package is version 24. Revert this source increment only through reviewed rollback; preserve sponsor-owned ledgers and all adverse evidence. Native saving does not authorize deployment, migrations, grants, audience changes or costs. The full OpenGrail goal remains active.
