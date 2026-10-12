# Direction-matched programmable Search

Choose **Direction-matched V2** in Programs Search, or open `/search?method=programs&selection=direction-matched-v2`. This is the separately frozen `DIRECTION_MATCHED_TRAIN_RETURN_V1` method. Legacy Search remains available and continues to reject SHORT candidates as noncomparable. Existing ledgers are never converted.

A cohort shares one exact LONG or SHORT direction, market, timeframe, costs, risk and capital. V2 selects by net account return within that cohort, subject to the trade, return and drawdown thresholds declared before TRAIN. The original evaluator's SHORT comparability flag and LONG baseline remain unchanged. V2 makes no cross-direction or benchmark-outperformance ranking. Its virtual linear exposure does not model borrowing, funding or the availability of an actual shortable instrument.

Freeze two to four exact program sources and the complete TRAIN data. Every candidate receives its own fresh configured interpreter and complete original/fresh program outcomes. Each evaluated trading result retains an additional whole first-party reference result. A guest that fails before producing a trading input retains its failure evidence and an explicitly unavailable reference. The certificate checks full trades, audit, equity, costs and accounting against the original primary artifact. Compact comparison reports are not substitutes for the whole reference result.

Selection waits for every TRAIN terminal. Failed, interrupted, unavailable, no-trade, mismatching, emergency-halted and insolvent candidates remain in the ledger and cannot qualify. The winner receives one separately supplied later cold TEST with fresh state and capital. A losing, failed or interrupted TEST stays consumed; it cannot change selection or open a replacement TEST.

## Local files and reconstruction

Use a reviewed checkout with the existing Node dependencies, Python 3 and Linux `/proc/self/fd`. Keep canonical absolute private file paths outside the checkout and current directory. The [complete agent guide source](../app/agent-guide/program-direction-search/page.tsx), prepared at `/agent-guide/program-direction-search`, supplies an explicitly invented four-bar input example.

```sh
chmod 600 /private/run/admission.json /private/run/test-input.json
node scripts/program-direction-search.mjs freeze /private/run/admission.json /private/run/new-ledger.json
node scripts/program-direction-search.mjs train /private/run/new-ledger.json
# Repeat once per remaining frozen TRAIN candidate.
node scripts/program-direction-search.mjs lock /private/run/new-ledger.json
node scripts/program-direction-search.mjs test /private/run/test-input.json /private/run/new-ledger.json
node scripts/program-direction-search.mjs verify /private/run/new-ledger.json
node scripts/program-direction-search.mjs reconstruct /private/run/new-ledger.json /private/run/new-reconstruction.json
```

`verify` checks complete retained identities and correlations. `reconstruct` performs explicit fresh computation for evaluated attempts and retains the complete original ledger, every actual fresh result, all difference counts and a bounded displayed sample. Pending work is never executed by reconstruction. Historical interruptions and unavailable computations remain explicitly not reexecuted. The result does not replace a winner, TEST or original ledger. A coherent, self-rehashed false accounting/reference claim can pass inert admission and still be disproved by this fresh computation.

`admit-train`, `admit-test` and `execute ... ATTEMPT_ID` separate durable admission from computation. `recover` records an interruption without rerunning a pending guest. File and directory fsync plus exact readback precede confirmation; the browser requires strict IndexedDB transaction completion before creating its Worker. Original IDs, expected history and full terminal results protect retries and concurrent tabs. Exit 0 confirms a completed requested computation, including a monetary loss or no trades; inspect the retained disposition and eligibility. Exit 2 retains an adverse/interrupted/mismatching computation; exit 1 means unconfirmed.

V2 local maxima are 32 MiB per whole attempt and 164 MiB per whole ledger. Capacity is reserved for every candidate and the sole TEST before admission. A full reference is bounded separately at 8 MiB. Structural limits and actual storage can still refuse a complete record; no losing trace is sampled or removed to make it fit.

## Plans, Session and recorded observations

After the sole TEST is terminal, export the complete locked V2 handoff. Open `/plans?selection=direction-matched-v2`, then Programs Session at `/session?method=programs&selection=direction-matched-v2`. The plan preserves the full ledger and exact original V2 winner. It freezes unchanged capital, costs, risk and source parameters, fresh data rights and an interval later than all retained preparation, source, observation and terminal clocks.

The prospective method uses the unchanged stateful Session interpreter and trading kernel. One guest persists across accepted closed bars; a signal becomes available at its actual retained completion clock. Only a quote observed after that decision can fill it. Prestart warmup cannot create prospective entries. There are no retrospective candle fills or automatic snapshot liquidation. Pause and restart preserve open exposure and permit later protective quotes.

Use `scripts/recorded-direction-program-kraken.mjs` for the separately identified V2 recorded collector. Its exact physical graph is distinct from the legacy collector; original collectors and their bound source bytes remain unchanged. It retains raw responses, normalization clocks and durable outbox identities, then correlates outer receipts and actual guest/inner trading evidence. Receiver credentials stay outside evidence and are sent only in authorization headers. Importing a plan starts no provider or receiver.

The complete actual-clock synthetic SHORT collector acceptance is recorded in [task 035’s receipt](../validation/direction-matched-program-search-20261012.json); both forward horizons remain incomplete. A synthetic receiver/collector test with injected historical startup clocks, a LONG winner or a standalone SHORT runtime cannot satisfy that acceptance. Recorded synthetic responses must stay marked synthetic even when local startup and receipt clocks are actual.

## Sharing and scope

The existing [public forward workflow](public-program-forward-evidence.md) accepts an exact nested V2 plan and keeps every candidate source dependency. The public input and artifact ceilings remain 192 KiB and 512 KiB. Oversized local evidence is refused intact. A new small fixture may be declared before freezing; a previously admitted ledger cannot be shortened into that fixture.

Public registration is inert. Explicit forward reconstruction checks the forward journal; it does not rerun the earlier Search. Use the separate Search reconstruction for that question. Computational matches preserve losses and interruptions. Search and custody disclosure blockers still require an appropriate HELD review; forward Arena members and their whole cohorts remain unranked with null financial diagnostics and baselines.

All evidence remains AUTHOR_REPORTED, qualification NONE, independence/unseen custody/provider authenticity NOT_ESTABLISHED. Source preparation and synthetic checks establish no hosted sign-in/API availability, authentic licensed observations, outside operator independence or profitable investment. Publication remains on hold. The complete OpenGrail objective remains active.
