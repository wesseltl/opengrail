# Incremental signal-to-Demo session methodology

This source increment consumes external event lines incrementally in a sponsor-owned local process and offers a browser session view. It is separate from the immutable batch replay and local comparison methods. The implemented contracts and measured local evidence are recorded in the [release review](release-signal-session.md); this source is not a completed provider connection, hosted delivery or uptime claim.

## Evidence and authority

Session input is data for fixed trusted simulation code, not executable strategy code or an instruction to the application. An external producer can supply events through connected standard input, but the transport does not authenticate market data or prove the producer's claims. A provider label, source timestamp or agent-generated signal remains an author declaration. Session results remain simulated, author reported and unqualified.

The sponsor chooses and operates the producer and runner. This increment introduces no public webhook, background hosted worker, D1 session storage, exchange connection, order permission or mandatory AI inference. Existing public agent credentials retain their public contribution scope; they do not gain access to private sessions. No private Capital Desk source, storage, account connection or credential is imported.

## Causal timing

The session must record source observation time separately from local acceptance order/time. A source can lie about its timestamps, and an operator can alter a local clock or omit external trials; journal hashes do not independently attest either. Clock regressions, future observations and stale inputs require explicit dispositions rather than silent timestamp repair.

The pinned method is `opengrail-session-v1`. Immutable session configuration binds its session ID, exact strategy record/digest, virtual capital, provenance/rights/source label, and either `SYSTEM_RECEIPT` or `SYNTHETIC_PLAYBACK` clock mode. System receipt time is assigned when the local runner processes normalized input; it is not an authenticated upstream arrival timestamp. Synthetic playback explicitly uses authored simulated time. Neither provides a third-party time or data attestation. Modes cannot be silently switched during resume. `PUBLIC_STRATEGY` and `SYNTHETIC_FIXTURE` origins describe the definition source; imported canonical bytes alone cannot authenticate a current public publication.

The event families are `QUOTE`, `CLOSED_BAR`, `SIGNAL`, `PAUSE`, `RESUME` and `EMERGENCY`. Quotes have an authored observation time and price; accepted input has a separate receipt time/order. A usable quote is at most 60 seconds old at receipt. To fill an intent, both its receipt and observation time must strictly follow the decision's receipt. A later-arriving quote with an older price timestamp cannot backfill it. A control request or source label grants no financial permission.

The producer must normalize data for the pinned market symbol and timeframe. The event shapes do not independently identify a venue or authenticate that a supplied price belongs to that instrument. Symbol alignment, data rights and provider attribution remain supplied assumptions until an independently reviewed adapter establishes them.

An accepted closed bar can create a decision using available data. Its next historical open may already be past when the bar arrives. A fill therefore requires a later accepted eligible quote under a separately pinned forward method. Prior or unavailable quotes cannot backfill an entry. Historical warmup data can initialize indicators but cannot create retrospective positions. Full-bar highs and lows must not retroactively act on a position that entered partway through that bar.

Quote-driven protective exits, gap handling, fees, slippage, allocation, daily halts and emergency stops require explicit rules in the implemented method. A stop request without a later usable quote must retain pending exits; a cached quote is not a fictitious current liquidation. Waiting, stale feeds, negative results, no trades, numerical failures and insolvency are retained session outcomes, not exceptions to the evidence.

Risk is evaluated from admitted quotes, not candle extrema. UTC daily loss state uses the receipt clock and a new day resets its reference from prior marked equity. `PAUSE` stops admission while risk processing continues. `EMERGENCY` immediately disables new admission and remains `STOPPING` until eligible later quotes settle remaining virtual positions; it cannot promise an immediate exit. Session states are `ACTIVE`, `PAUSED`, `STOPPING`, `STOPPED` and `FAILED`. Uncapped SHORT losses remain retained. A virtual lot's collateral deficit or nonpositive account equity is terminal `INSOLVENT`, even if another accounting balance remains positive; this is a declared simulation rule, not a real broker liquidation model.

Protective insolvency checks precede the ordinary emergency exit gate. An admitted adverse quote may therefore trigger terminal insolvency even when its observation precedes the emergency receipt; ordinary emergency exits still require both clocks strictly after the stop. Other protective exits use the monotonically increasing admitted quote observations rather than claiming that each source observation occurred after the preceding fill's receipt. No executable historical price or authenticated arrival is established by this scalar-price simulation.

The source reducer marks virtual inventory using the admitted quote with an estimated adverse exit cost. Entry and exit each apply the declared fee and directional adverse slippage. Stops and targets trigger against the raw admitted quote and settle at its cost-adjusted price; a gap can pass a stop or target. This differs from the batch replay's target-at-target gap convention. There is no order book, executable bid/ask, liquidity, partial-fill or real margin model behind the supplied scalar price.

Allocation uses current marked equity, the strategy's `positionPct`, existing virtual collateral and available cash. DCA partitions this allocation by lifetime `maxEntries`; its closed-bar phase is `retainedBarIndex % intervalBars`, with warmup bars included in the index. GRID partitions by level count, selects at most one free close-crossed level per decision, and rearms a level after exit. Successful entries and losses change future budgets; `positionPct` is an admission calculation rather than continuous rebalancing or a guaranteed loss ceiling. Account marks retain their receipt and source-observation times. If a numerical failure prevents a fresh valuation, the prior valid mark remains historical rather than a confirmed current equity value.

Closed bars must remain aligned and contiguous. A detected missing bar cancels pending admission and holds new admission until the missing sequence is supplied. Inputs more than two declared timeframes behind receipt can warm indicators but cannot create a fresh decision. Protective quote processing continues during a bar gap. Pre-start signals remain warmup permanently; they cannot become eligible merely because a later bar arrives.

A pending admission also expires when its decision bar is more than two timeframes behind the next quote's receipt. A fresh price cannot revive an old intent after a silent feed. The cancellation is retained as `STALE_BAR`; it does not suppress protective processing of inventory already open.

## Declarative entries

All seven bounded families use the retained closed-bar prefix. A decision queues at most one admission; it is not itself a fill. Missing indicator warmup makes a decision ineligible, including a `RULES` group with an unavailable member.

| Family | Intended and implemented local decision |
| --- | --- |
| `TREND` | Close-based fast/slow simple averages. `ALIGNED` requires fast above slow for LONG or below for SHORT; `CROSS` also requires the prior closed averages on the opposite/equal side. |
| `RSI` | Wilder-smoothed closed-bar RSI with the declared strict `BELOW` or `ABOVE` threshold. |
| `BREAKOUT` | Current close exceeds the preceding lookback highs for LONG or falls below the preceding lookback lows for SHORT. The current bar is excluded from the reference window. |
| `DCA` | Retained bar index modulo `intervalBars` is zero. Filled entries count toward lifetime `maxEntries`; exits do not reset the count. |
| `GRID` | Previous/current close crosses an inclusive evenly spaced level downward for LONG or upward for SHORT. Choose the highest free crossed level for LONG or lowest for SHORT; an active level cannot duplicate. |
| `SIGNAL` | A received signal references a retained closed bar, matches the declared provider/event and is within the declared closed-bar age. Availability cannot be later than receipt. Each stored signal is consumed once at decision or permanent warmup. |
| `RULES` | `PRICE_SMA` is close/simple average, `RSI` is Wilder RSI and `RETURN` is `100 * (close / close[period] - 1)`. Apply the declared `ALL`/`ANY` and strict comparisons; crossings move from the opposite/equal side using prior/current closed values. |

Provider/event labels in `SIGNAL` are authored assumptions. Their presence does not mean an adapter, webhook or provider subscription is connected. Source fixture coverage is recorded in the release review; it does not qualify a strategy or make the price data genuine.

## Persistence, limits and recovery

The intended local journal retains logically append-only history, with immutable session configuration, exact event identities, acceptance order and state/receipt digests. The CLI persists the full retained history using atomic file replacement; the file is not externally immutable and its owner can delete or fabricate another history. Identical retries reconcile an accepted event without producing a second fill; changed material under the same identity conflicts. A checkpoint is derived from the verified journal, not an independent mutable source of truth. Uncertain, partial or corrupted persistence must not confirm a state transition that cannot be reconstructed.

Journal, input-line, event-count, state and export capacities are checked before acknowledgment. Reaching a bound stops admission explicitly rather than silently evicting failures or continuing with an unaudited state. Recovery retains consumed signals, inventory, daily halt and emergency state. The CLI's recovery pause cancels pending admission with a retained control event; it requires an explicit resume before new decisions. Restart or disconnect does not justify filling against old quotes or pretending there was uninterrupted observation.

The source contract allows 2,000 normal input events and reserves a further 32 slots for emergency/risk quote processing. Reserved space is finite; it cannot guarantee a usable future quote or a completed liquidation. The journal is capped at 8 MiB with 512 KiB reserved from ordinary admission; state is capped at 4 MiB, configuration at 32 KiB and a normalized journal event at 1 KiB. Raw input lines are capped at 4 KiB; the first overflow stops intake without draining an unlimited frame. After 128 transport/admission failures the CLI stops. These are local source budgets, not hosted quotas or a promise of unlimited storage.

Journal identity binds the current engine, model and journal source-file fingerprints. Import/resume and untrusted append reconstruct every retained transition before trusting the checkpoint. A matching state, method or file digest identifies bytes; it does not prove complete upstream history, honest clocks, historical execution, independent verification or compatibility with another source version.

The CLI requires the repository's local Node toolchain plus Python 3 and POSIX advisory-file-lock support. It invokes a fixed reviewed lock helper, not a submitted executable. Parent and helper retain the same locked file description; helper death cannot release the parent-held lock. A single writer reconstructs before resume, confirms paused admission and requires an explicit later `RESUME`. File and directory synchronization precede a confirmed acknowledgment. Clock regression that rejects recovery's pause prevents a `READY` claim. These local checks do not promise Windows support, universal filesystem durability or protection from a file owner who bypasses the advisory lock.

Schema-valid but temporally rejected normalized events retain their receipts. Malformed transport frames cannot become normalized events and receive bounded diagnostics with `retainedInJournal:false`; their original bytes are not copied into the journal. An exported journal therefore is not a complete record of every byte or attempt supplied by an upstream producer.

The browser retains up to eight session attempts and 64 rejection/interruption notes in page memory. At the note cap, new sessions and ordinary input are blocked; Pause and Emergency remain available. If a quote could fill an existing active admission, the page requires Pause or Emergency first rather than silently opening another position. Protective quotes can then settle retained exposure, subject to the finite journal reserve. Checkpoint exports use bounded compact JSON and can be reconstructed individually. Whole-history export is a separate snapshot capped at 64.25 MiB; it is not a restore command or complete external search record. A source-bound operation rechecks the exact visible public strategy, and an observed suppression invalidates pending work and clears related held bodies. Previous exported copies cannot be recalled.

## Local runner

```sh
node scripts/session-runtime.mjs start CONFIG.json NEW_JOURNAL.json
node scripts/session-runtime.mjs resume JOURNAL.json
node scripts/session-runtime.mjs verify JOURNAL.json
```

`start` and `resume` accept one normalized JSON event per standard-input line and process it before reading the next event. They require `SYSTEM_RECEIPT`; synthetic journals can be reconstructed by `verify` but cannot claim connected intake. `start` refuses an existing output. `resume` keeps the exact source version and begins with a confirmed admission pause. This tool does not launch an external producer, execute a URL, fetch missing observations or repair data automatically.

`READY`, `RECEIPT`, `TRANSPORT_REJECTED`, `NOT_CONFIRMED` and `DISCONNECTED` outputs distinguish retained transitions from failed transport or uncertain acknowledgment. Preserve the journal and retry the same event identity after uncertainty. Disconnect itself does not liquidate inventory or establish a completed strategy outcome.

Local files and page memory belong to the sponsor; their retention is not a complete external search log. Exports can retain authored inputs and outcomes, but must exclude credentials and arbitrary exception text. Exporting locally does not publish the material or establish current public authorship. Existing experiment artifacts use the batch replay contract: a forward session must not be relabeled as a compatible batch artifact merely to enter that registry.

## Delivery boundary

A genuinely incremental local transport is progress toward signal-to-Demo integration. It does not establish an authenticated upstream adapter, actual market quotes, provider plan compliance, independent research, persistent public session infrastructure or unattended hosted operation. Browser execution lasts only while its session is active; sponsor-hosted continuity depends on that sponsor's process and infrastructure.

Provider adapters, third-party credentials, paid data or hosted compute, public session APIs, new agent capabilities and production deployment require separate review and explicit authority. No expense or unlimited free operation is assumed. The [session task](tasks/006-continuous-demo-session.md) and [release review](release-signal-session.md) distinguish implemented local checks from these remaining gates.
