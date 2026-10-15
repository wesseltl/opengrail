# Deterministic Demo replay — methodology v1

Evaluator identifier: `opengrail-demo-v1`. This specification describes the implemented bounded local simulation; coordinated final checks and rollout review are recorded separately. It does not establish live signals, forward Demo operation, independently qualified results or an investment recommendation.

## Exact supplied input

A request uses version one, a lowercase UUID `requestId`, the evaluator identifier, an exact canonical strategy record and digest, a dataset, supplied signals, initial virtual capital, a hypothesis, a falsification criterion and nullable `emergencyStopAt`. Objects are strict; caller-supplied execution grants, code and unknown fields are rejected.

The strategy record uses the [declarative Strategy Hub schema](strategy-api.md). Its canonical digest must match, and its market label/timeframe must agree with the dataset. This validates structure and byte identity. A self-hashed imported record does not establish that its author exists in the registry or that it was authenticated, tested or independently reproduced. Publication and a successful local replay confer no financial authority.

The request limit is 524,288 UTF-8 bytes. Initial virtual capital is between 0.01 and 1,000,000 quote-currency units. Hypothesis and falsification are nonempty bounded text of at most 2,000 characters each. They are supplied declarations rather than immutable preregistration in a shared experiment registry.

The dataset contains a UUID, version one, a claimed provenance (`SYNTHETIC` or `USER_SUPPLIED`), a matching market/timeframe label and 2–2,000 bars. Its rights object requires an acknowledged permission (`CREATED_SYNTHETIC` or `AUTHORIZED_USE`) and a bounded note. Synthetic provenance must agree with synthetic permission. This is the contributor’s declaration, not verification of provenance, ownership or licensing. There is no current-quote or provider connection implied by a symbol or label.

Each bar contains canonical UTC `closedAt`, positive finite open/high/low/close prices and finite nonnegative volume. High/low must contain the open and close. Closing timestamps are strictly increasing, epoch-aligned and contiguous for the declared 5m, 15m, 1h, 4h or 1d interval. Its open is at `closedAt − timeframe`; high, low and close become known only at the close. Missing intervals are rejected rather than filled with invented candles. Supplied prices can still be false or selected after seeing results.

There are at most 500 signals. Each has a unique lowercase UUID, provider (`ALTFINS`, `TRADINGVIEW` or `CUSTOM`), event (`BULLISH` or `BEARISH`), observation time and availability time. An observation must identify an included closed bar; availability cannot precede observation or exceed the last close. Provider/event/observation tuples must also be unique, so changing an ID does not duplicate one observed event. These are supplied timestamps and labels, not proof of historical availability or actual provider ingestion.

An emergency time, when supplied, must lie within the supplied intervals. Its precise execution boundary must follow the event order below; a mid-bar timestamp does not reveal a contemporaneous quote from OHLC data.

## Timing and eligibility

An entry decision uses completed bars and signals already available at its decision time. It may schedule a fill only at the following bar’s open. It cannot use that following bar’s high, low or close to choose the earlier opening fill. A final-bar decision has no subsequent open and creates no invented tail trade.

Signal-driven entries require the declared provider/event, availability by the decision boundary and an age within `maxAgeBars`, measured from the observed closed-bar index. Accepted observations are consumed once; mismatches, stale/unused signals and unavailable inputs must remain visible in the audit rather than being promoted to a connected feed. Signal ordering and exact consumption behavior are part of the evaluator contract, not an independently verified event history.

Supplied events are ordered by availability, observation time and ID. At a decision, all newly available events are consumed: provider/direction/age mismatches receive rejections, the first matching event can queue one entry, and additional matching events receive consumed-without-another-entry audit rows. A consumed event is not retried if the next-open entry is rejected or if the final decision has no next open. The age boundary is inclusive. Events never reached before termination remain unused.

Indicators use the Strategy Hub’s intended closed-bar semantics: simple moving averages for TREND, Wilder-smoothed RSI, a preceding high/low range for BREAKOUT, and explicit ratio/RSI/return comparisons for RULES. Strict crossings use prior and current closed values. Warmup and undefined calculations do not silently default into eligibility. No strategy code is uploaded or evaluated as an executable expression.

SMA requires its complete closing-price window. RSI initializes average gain/loss from its first `period` close-to-close changes, then uses Wilder smoothing; zero loss gives 100, while zero gain and zero loss gives 50. BREAKOUT excludes the current bar from its prior high/low window. `PRICE_SMA` is close divided by SMA; `RETURN` is `100 × (close / close[period] − 1)`. A crossing needs both prior and current values. Every RULES condition must have its needed values before either ALL or ANY becomes eligible.

The fixed bar sequence is:

1. Reset a daily latch when the bar’s UTC opening day changes, using the previous closing equity as its new reference.
2. Apply an emergency already effective at the open; otherwise process existing opening-gap stops/targets and the open-equity daily-loss check.
3. Admit the prior decision’s queued entry if current allocation, position, cash and halt checks allow it.
4. Process intrabar stops, the adverse-extreme daily-loss check, then targets. This intentionally prioritizes adverse observations when the OHLC path is unknown.
5. Defer a mid-bar emergency to the observable close; otherwise check close equity, evaluate the closed-bar entry rule and retain closing equity.
6. At the final close, reject any queued tail entry, liquidate remaining positions and replace that closing-equity point with the realized final value.

An intrabar stop/target or adverse-extreme liquidation uses the close timestamp as the replay’s reporting boundary because the actual touch time is unknown. Its price is the declared OHLC-based fill assumption. A mid-bar emergency uses the close price, not the earlier open or an invented instantaneous quote. A terminal emergency stops at the current bar’s retained closing-equity point; opening-emergency exposure has already become cash at the separately recorded opening fill time. It is not comparable to a full-period baseline.

## Accounting and execution assumptions

All amounts use virtual quote-currency accounting. Definitions remain Demo-only, leverage one and orders disabled. Long and short entries reserve virtual notional; this is not a real margin, borrowing or broker-liquidation model. Short sale proceeds do not create extra spendable capital. Entry fees reduce available cash, and marked equity includes open-position profit/loss and estimated adverse exit costs before more entries are admitted.

At an entry, the total budget is pre-admission opening marked equity times `positionPct / 100`, less already reserved collateral. DCA partitions the total by `maxEntries`, grid by `levels`, and other families by `maxOpenPositions`. New collateral is the minimum of one partition, the remaining total budget and cash divided by `1 + feeRate`. Quantity is collateral divided by the slipped entry price. Each check occurs again at the fill boundary; a queued decision does not reserve funds or override a halt. A declining budget rejects further allocation rather than forcing an extra entry. Profits change subsequent leg budgets, while entry costs and later equity changes can move reserved allocation above that percentage without an automatic rebalance. The percentage is an admission budget, not a guaranteed maximum loss.

Fees and slippage are per-side authored basis-point assumptions. A buy receives adverse upward slippage and a sell adverse downward slippage; short entry/covering follow those same sides. Both entry and exit fees count. Stop/target returns and raw candle prices must not be presented as already cost-adjusted fills. No maker/taker tiers, real spread, borrowing/funding fees, partial-fill probability or venue latency are independently measured here.

For a completed trade, gross profit/loss follows the signed entry-to-exit price difference times quantity. Net trade profit/loss deducts both fees. Exits release reserved virtual notional and apply the actual simulated profit/loss and exit cost. Negative short loss is not clipped to collateral: a reserve breach creates a retained terminal `FAILED`/`INSOLVENT` outcome, closes remaining exposure under the declared conservative rule and permits no further entries. The full deficit remains visible. Such metrics and the benchmark are non-comparable; leverage one is not a limited-recourse payoff guarantee.

The daily-loss rule uses marked equity, including estimated exit costs, and a UTC-day latch. Reaching it prevents new or pending entries and triggers the declared conservative liquidation. Recovery later that day does not remove the latch. A new UTC day can reset the daily latch; an emergency or terminal failure cannot be reset into more entries. Stop and daily thresholds are simulation rules, not guarantees against gaps or actual market losses.

Opening gaps and simultaneous touches require conservative handling. A gap beyond a stop uses the adverse available open rather than the stale stop price. A newly filled position whose entry slippage already places its stop beyond the raw open also closes at that observed open, not at a favorable stale stop. A favorable target gap is credited only at the target rather than gifting the better open. If a bar touches stop and target and supplies no path ordering, stop takes priority. Any OHLC-wide adverse forced-exit approximation must be explicit; it is a modeled price assumption, not a quote observed at an arbitrary instant.

## DCA and grid allocation

`positionPct` is the total intended strategy allocation. DCA divides it by `maxEntries`; grid divides it by `levels`. Neither family receives a fresh full allocation for every leg. Available cash, total allocation and maximum open positions still fence entries.

DCA decisions use zero-based dataset indices divisible by `intervalBars`, starting at index zero; their fills are at the next open. Rejected fills do not increment the lifetime filled-entry count or move this dataset-anchored schedule. It does not reset a lifetime entry limit merely because a leg closed.

Grid levels are evenly spaced and inclusive of the declared lower/upper bounds. Eligibility is based on closed-bar crossings rather than assumed intrabar limit fills: LONG requires prior close above and current close at/below a level; SHORT requires prior close below and current close at/above it. If multiple free levels cross, LONG selects the highest and SHORT the lowest. At most one fresh level entry is scheduled per bar, an active level cannot be duplicated, and a level may rearm after its position exits. The fill remains the next opening price, not the selected grid level. Shared stop/target assumptions govern exits. This is a declared discrete replay model, not a live exchange grid implementation or an inference of OHLC touch order.

## Metrics and baseline

Final account equity minus initial capital is net account profit/loss; return is `100 × (final / initial − 1)`. Drawdown uses initial capital and retained closing-equity peaks, including estimated adverse exit costs while positions remain open. It is not an exhaustive intrabar-equity measure. Wins and losses count completed trades by net profit/loss, excluding zero outcomes from either count. Fees count actual entry/exit charges; turnover sums simulated entry/exit notional, plus entry collateral for any remaining exposure in a failed calculation. Terminal numerical failures can have no meaningful metrics.

The declared baseline is LONG buy-and-hold: enter at bar index one’s open, exit at the final close, apply the same per-side costs and allocate initial capital times `positionPct / 100`, bounded by cash including its entry fee. Remaining capital stays virtual cash. It does not apply the strategy’s stop/target, grid/DCA sequence or daily-loss rule. Failed runs, SHORT strategies and terminal emergencies mark both metrics and baseline incomparable. A lower or higher synthetic return supplies no outperformance or qualification claim.

## Outcomes, identity and local retention

Artifacts are classified `AUTHOR_REPORTED`, with mode `SIMULATED` and orders disabled. Outcome states are `COMPLETED`, `NO_TRADES`, `HALTED`, `REJECTED` and `FAILED`. No-trade and negative results are evidence, not omitted successes. Numerical, insolvency and finite-result-cap failures must be retained terminal outcomes rather than repaired or silently truncated into favorable performance.

Limits are 2,000 trades, 12,000 audit rows, 2,000 equity points and an 8,388,608-byte artifact. Audit rows record eligibility, rejection, entry/exit, signal, halt/reset and failure reasons. Rejected unknown input has no accepted request body, performance or benchmark; the local attempt still records its rejected disposition. This avoids treating unvalidated material as evaluated evidence.

Hashes bind the canonical request, strategy record, complete dataset, supplied signal array and evaluator identity. Dataset identity includes its metadata and rights claim as well as bars; an unchanged price series with different metadata is a different canonical input. Request identity includes its operation ID and declarations. The result digest binds the retained artifact body rather than itself. Artifact verification also requires the evaluator digest to equal the fixed `demoEvaluatorMethod` metadata digest. Hashes establish byte consistency, not truthful inputs, correct execution, authentic authorship, independence or profitability. This declared-method digest is distinct from a source-code hash, which must be pinned separately in release evidence. The CLI’s exact rerun comparison uses the same implementation and is explicitly not independent reproduction.

The browser retains up to 32 attempted replays in page memory, including input rejection, no-trade, negative, halted, interrupted and failed dispositions. Further attempts are blocked instead of dropping earlier failures. Import alone is not a replay. Selected public records and imported requests must match exact canonical bytes and digest; the offline fixture explicitly implies no published author. Draft changes reset rights consent, and selection/catalog changes invalidate pending work. Session exports preserve the available accepted inputs and results; rejected unknown inputs receive a safe disposition rather than retained arbitrary text. Refreshing or leaving the page loses the in-memory history. Local retention is not a durable shared registry, a complete parameter-search history or evidence that the hypothesis and holdout existed before a run. Exported artifacts remain author-reported even when internal digest checks pass.

After a source-confirmed public replay, **Set up forward Demo** opens a fresh Session setup for that exact strategy. The link carries only its public ID and digest; replay data, capital, results and rights consent stay in the current page. Export the replay or complete history before leaving. The destination rechecks the exact current public source and starts no session, collector or orders automatically. Offline, unconfirmed and suppressed trials have no continuation link; negative and no-trade public results remain eligible. Navigation is blocked during local work and after the originating trial or page becomes stale.

## What this increment establishes

Known synthetic fixtures can test deterministic timing, arithmetic, budget constraints, failures and byte identity in reviewed first-party code. That is necessary before meaningful strategy evaluation. It does not establish historical-source provenance, unseen holdouts, forward results, actual fills, connected signals, independent reproduction, ranking or reputation.

[Task 003](tasks/003-independent-experiment-registry.md) remains required for exact preregistered manifests, declared baselines, full trial/failure history, data/version rights, leakage and selection controls, conflicts, independently qualified reproductions and durable shared evidence. Real source ingestion, operational reconciliation, venue-specific assumptions and any execution authority require separate reviewed work. See [Task 005](tasks/005-deterministic-demo-replay.md) and [the release review](release-demo-replay.md) for this increment’s evidence and remaining checks.

## Complete local example

The checked-in [supplied-signal case](../examples/demo/README.md) contains an exact [synthetic request](../examples/demo/synthetic-signal-input.json) and [retained artifact](../examples/demo/synthetic-signal-artifact.json). Matching events, a wrong provider, a wrong direction and a stale event exercise both decisions and rejection evidence. Its ALTFINS label is supplied text; no actual provider or authenticated author is connected. The retained outcome is a negative simulated author report, not a selected successful strategy.

From the repository root with its local development dependencies installed:

```sh
node scripts/replay-demo.mjs verify examples/demo/synthetic-signal-artifact.json
node scripts/replay-demo.mjs run examples/demo/synthetic-signal-input.json /tmp/opengrail-new-signal-artifact.json
```

Use a new output name for each run. Verification checks byte consistency and an exact rerun by the same fixed implementation; it does not qualify independent reproduction or establish historical data rights. The browser enforces its own exact selected public/offline strategy binding and cannot import a different fixture merely because that file hashes correctly.
