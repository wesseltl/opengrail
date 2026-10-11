# Read-only market-data increment review

The exact strategy handoff could prepare a running local Demo receiver, but market inputs still required a separate producer. This increment adds a fixed sponsor-local Kraken OHLC/Trades adapter. It omits unfinished candles, preserves source trade times, samples rather than claims a full tick stream, and persists exact outbox events before sending them to the existing receiver.

Coordinated local checks and ordered production build passed; native source-save verification follows separately. No external provider run, public deployment or independently qualified result is claimed.

## Review scope

- Only fixed public OHLC/Trades GETs and an explicitly selected loopback receiver. Both operator data-use and shared-IP-budget approvals are required on every start/resume. No private exchange key, AI service, provider-selected URL, owner control or order endpoint.
- Exact strategy configuration, market, timeframe and retained receiver instance are pinned. A valid local role or provider label does not authenticate market facts. A previously exported configuration does not monitor subsequent public-source withdrawal.
- At most 120 lifetime polls with two explicit source fetches each, 1,800 local events, 4 MiB state and eight delivery attempts per event. Current receiver headroom remains UNKNOWN to the producer. No reset, deletion, automatic rollover, fictitious liquidation or uptime promise.
- Closed/current-bar separation, genuine source time at millisecond precision, stale/nonadvancing trade suppression and explicit gap/regression failure. A quote fetched before a bar decision cannot fill that decision retrospectively.
- Private mode-0600 outbox, exact request/body preservation, exclusive CLI writer lock, compare-and-swap plus file/parent fsync, receipt lookup/identical retry, context/digest checks and retained confirmed rejections. Lost persistence or external changes cannot confirm an unaudited acknowledgment.
- Clock regressions retain their actual regressed time and fail without timestamp repair. Each resumed mutation checks the retained writer/context again after asynchronous receipt lookup. Known interruption cannot start a new POST.

## Completed local checks

- `npm test`: **700/700 passed**, zero failed, cancelled, skipped or todo cases;47 new checks comprise23 parser,23 producer/persistence/policy and1 actual local receiver runtime case.
- `npm run typecheck`: passed.
- Sites `build-site.mjs` / `npm run build`: passed immediately before this receipt/documentation finalization.
- `git diff --check`, parser/producer syntax checks and both unchanged fixed evaluator source-fingerprint checks: passed.
- Actual local receiver integration used invented source responses, production15-second poll spacing and an explicitly invented past-start history. It recovered a committed lost acknowledgment, filled only on a later source/receipt quote, preserved open inventory at finite feed completion, and retained a subsequent negative cost-inclusive emergency exit.
- Rejection fixtures cover provider parsing/limits, permissions, exact history/configuration binding, unknown responses, unchanged bodies/IDs, finite attempts, external file changes, interrupted asynchronous receipt lookups and canonical clock-regression evidence.
- Existing Session component cases passed; no real browser, external endpoint, provider license, hosted identity or unattended feed acceptance is established.

Full coordinated test/typecheck logs and the source freeze are retained outside the checkout; their SHA-256 identities are recorded in the validation receipt.

## Remaining delivery and authority

All provider responses used during validation are invented fixtures. The runtime fixture uses an explicitly invented past-start recovery history, actual local receiver HTTP/persistence and production polling delay. It is not authentic unattended market evidence or a public hub source-availability claim. Results remain AUTHOR_REPORTED, qualification NONE, Live/orders disabled. No source data or result is automatically published.

Public grants, quotas, D1 migrations, HTTP publication contracts, dependencies, hosting settings and pinned batch/continuous evaluator sources remain unchanged. The private Capital Desk is not connected or modified. A source-backed saved version is separate from deployment.

A permitted real feed run, genuine authorized Altfins/TradingView signals where needed, data licensing and aggregate rate budgets, monitored unattended operation, public GitHub issue/PR/CI acceptance, domain control and hosted/browser acceptance remain outstanding. The user's reported ownership of OpenGrail.xyz is recorded, not independently verified by this release.

Review [task 011](tasks/011-read-only-market-data.md) and [the operator guide](kraken-market-data.md). Roll back this increment by reviewing/reusing the prior exact source commit `642cea2fd78cd1f1449defeb6018fd5387e3ad27`; never replace an active session/producer journal or erase an adverse trial as rollback. Production merges/deployment remain subject to the maintainer approval requirement in [AGENTS.md](../AGENTS.md).
