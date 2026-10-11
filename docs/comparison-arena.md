# Compare exact public strategy outcomes

The source-prepared `/arena` workspace compares a user-selected cohort of two to four exact public outcomes. Open **Compare strategies** from an outcome in Experiments or the strategy evidence workspace, then add the other outcome IDs and digests. Inspect the captured source, assumptions, disclosure flags and current computational review context before explicitly running a local comparison.

This complements `/validation` (one exact outcome or a related reproduction) and `/search` (a frozen local TRAIN selection followed by one separately supplied TEST). The arena does not infer a complete search history from the winning outcomes somebody chose to publish.

## Comparison contract

Each selected member resolves its immutable outcome, manifest and strategy through existing public read contracts. The entire cohort is frozen before evaluation. To compare strategy versions, require identical full dataset content and digest, signals, capital, market, risk, costs, emergency policy and declared fixed evaluator identity. A matching symbol or date range is insufficient. Duplicate outcomes and repeated exact strategy versions cannot count as additional competitors.

Every selected member remains in the result. Interrupted or unavailable outcomes, unsupported continuous snapshots, mismatched reconstructions and failed evaluations block descriptive ranking; none may be silently removed to produce a winner. Continuous Session evidence includes open inventory, gaps and different horizon semantics, so it remains separately typed and links to its existing reconstruction workflow.

For each batch artifact, the trusted primary and separately implemented reference evaluators run again with the original exact input. The comparison includes the claimed result, both fresh computations and their differences. Equity-derived risk diagnostics use a separate fresh primary replay. A valid content hash does not establish correct execution, authentic market data or independent investigation.

## Reading the table

Return is net of the declared per-side fees and adverse slippage. Drawdown, fees, turnover and trade count remain visible alongside it. Eligible long-only results retain the existing cost-aware same-allocation long baseline. Short results retain the existing evaluator's noncomparable performance/baseline labels and are not ranked under this method; insolvency and losses remain unclipped.

One period return is `equity / precedingEquity - 1`; the initial capital precedes the first closed-bar equity point. There is one observation per declared bar. Return dispersion is the sample standard deviation, with denominator `n - 1`. Downside dispersion is `sqrt(sum(min(return, 0)^2) / n)`. The nonannualized period Sharpe ratio is arithmetic mean return divided by sample dispersion, with a zero reference return. Common timeframe and horizon are necessary to compare these descriptive values.

The workspace requires at least three declared bars for the ratio and discloses observations and unavailable reasons. Zero variance, insufficient observations, nonpositive preceding equity, partial horizons and numeric overflow cannot produce fabricated zero-valued ratios. Eligible ordinal positions describe only the complete selected cohort under the displayed metric and gates. An adverse current review or blocking search/holdout flag prevents ranking. Matching computations and a positive human computational attestation remain distinct from independent qualification. No agent reputation or majority-confidence score is derived.

## Review history and freshness

The reader captures the explicit original outcome, every retained computational review summary within the existing limit and the exact current review head. Hidden history remains a tombstone. A newer disputed, held, rejected or unavailable head cannot fall back to an older positive review. Peer outcomes used by retained reviews are dependencies of the read, rather than invisible corroboration.

Public sources and review context are rechecked around comparison and before export. Changed context requires a fresh comparison; known suppression clears dependent held payloads. These are bounded fresh observations through the existing APIs, not a transaction spanning all public records or a guarantee that content cannot change after a response. Earlier downloaded copies cannot be recalled.

The browser retains at most four attempts in memory. The full reader cohort is limited to 8 MiB, including review dependencies. Before admitting a new attempt, its cohort, a maximum 48 MiB report and metadata must fit with existing history inside the 64 MiB export limit. Capacity refusal preserves earlier attempts; no losing member is trimmed to make room. Current draft edits cannot rewrite frozen prior attempts.

A verified computed report is staged as unconfirmed before final public checks. A temporary confirmation outage or cancellation retains already-computed adverse evidence with no current rank. Known suppression, sign-out, navigation, visibility loss or unmount clears dependent payloads and prevents late promises from restoring them. Export the complete retained history to keep it beyond the page session.

## Authority and limits

External operators can run the same fixed comparison without a hosted website or inference service:

```sh
node scripts/compare-arena.mjs compare MEMBERS.json NEW_REPORT.json
```

The input is the complete two-to-four-member array of supplied exact outcome, manifest and strategy snapshots, with the model's explicit review-context projection. Read the command and repository setup instructions before running it in an isolated local environment. The new output file retains the complete comparison, including valid adverse results. Exit `0` means an eligible descriptive cohort, `2` means a retained held or noncomparable result, and `1` means invalid input or uncertain output.

The file wrapper labels visibility `SUPPLIED_SNAPSHOTS_NOT_CURRENTLY_VERIFIED` and review heads `SUPPLIED_NOT_AUTHENTICATED_OR_CURRENT`. Offline snapshots cannot establish current public visibility, reviewer authentication or independent execution. This command reads local bounded JSON, recompiles only trusted repository modules, checks fixed source identities and makes no HTTP requests. It does not execute submitted code. Existing output files are never overwritten.

All results are `AUTHOR_REPORTED`, qualification `NONE`, independence `NOT_ESTABLISHED`, with orders disabled. There is no new public write contract, database schema, agent role, hosted evaluation service, provider fetch, uploaded-code execution, model call, automatic strategy adoption or paid inference dependency.

Hosted/browser acceptance and a maintainer-approved rollout remain outstanding. Genuine outside operators, licensed authentic data, unseen-data custody, independent review and qualification, verified reputation and isolated programmable execution remain required parts of the full OpenGrail goal. See [task 028](tasks/028-exact-comparison-arena.md) for acceptance criteria.
