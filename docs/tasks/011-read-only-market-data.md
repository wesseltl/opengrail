# 011 — Read-only sampled market data into local Sessions

Status: source integrated; 700/700 coordinated tests, typecheck and ordered build passed. Native source-save verification follows separately. No external market-data run, hosted provider connection or deployment is claimed. This increment prepares a sponsor-run source adapter for the existing durable Session receiver; it changes no public authority or pinned evaluation method.

## Problem and intended behavior

An exact strategy can now be reviewed, exported and launched in a local Demo receiver, but a producer must still construct market events manually. Add a small fixed read-only Kraken adapter that supplies finalized bars and genuine timestamped sampled last trades, retains delivery uncertainty and adverse outcomes, and makes its resource/permission limits explicit.

## Scope

- Provide `node scripts/kraken-market-data.mjs start CONFIG.json NEW_FEED_STATE.json` and `resume CONFIG.json FEED_STATE.json`. Accept one bounded strict JSON authorization line on standard input with the fixed local origin, retained history instance, original `receiverStartedAt`, canonical `receiverImplementation`, producer token, `publicDataUseApproved: true`, `sharedIpRateBudgetApproved: true`, `pollMs` and `cycles`, followed by EOF. Both approvals are explicit on every invocation; no default or extra flag grants permission.
- Before creating feed state or any public fetch, verify the fixed kernel fingerprints and recompute the existing instance from exact config/start/implementation. Reject substituted market/timeframe/configuration or replacement history without an asserted-digest fallback. This is declared preimage binding, not provider authentication or global execution attestation.
- Use only fixed public Kraken OHLC and Trades GETs with `assetVersion=1`, serial requests spaced by at least one second and a cycle minimum of 15 seconds, at most 240 explicit provider fetch invocations over 120 retained polls, not a wire-level library request attestation. Retain opaque cursors as metadata only; do not page, pass `since` or infer complete coverage. Follow the exact uppercase strategy market and supported timeframe; reject unsupported/substituted response keys, redirects and caller-selected URLs.
- Bound provider responses and parsing. Omit the current uncommitted candle; admit finalized coherent aligned contiguous bars. Seed at most 300 closed bars without inventing gaps, prices or past fills. Preserve the existing Session warmup/source/receipt decisions.
- Select at most one genuine latest provider-timestamped trade as a sampled quote per poll. Preserve source time without making stale quotes fresh or claiming complete ticks, bid/ask spreads, liquidity or executable prices. Reject future/inconsistent data; an older-than-60-second trade is not a fresh quote.
- Emit only `CLOSED_BAR` and `QUOTE`. Leave `SIGNAL` strategies dependent on separately authorized external signals; do not replace Altfins or invent provider events.
- Persist a bounded private mode-0600 feed state with exact configuration, session/history instance, source identity and normalized outbox before any POST. Raw tokens stay in memory/header transport, never arguments, logs, state files or URLs.
- Correlate exact original receipts and retain uncertain requests unchanged. Receipt lookup or identical retries reconcile uncertainty without replacing IDs or repurposing bodies for a different retained history. Known reducer rejections, gaps and clock regressions stop with evidence. Preserve actual regressed/prior times in `clockFault`; never repair clocks or auto-resume terminal state.
- Retain failed/interrupted poll attempts within a lifetime budget of 120 polls, 1,800 normalized events and 4 MiB of state. Explicit resume cannot reset those limits, roll over history, auto-resume owner admissions or create fictitious EOF liquidation. Receiver capacity remains separately authoritative.
- Add an operator guide explaining external-data opt-in, data-use/licensing and shared-IP budgets, source authenticity limits, sampled data, adverse retention and remaining delivery gates. No website connection, new public API/scope, paid service, Live orders or private bridge.

## Acceptance evidence

1. Actual fixed parser fixtures cover every supported timeframe, exact pair keys, closed/current candle separation, malformed or future data, gaps, duplicates, opaque cursors, sampled-trade timestamp ordering and stale quotes. Synthetic provider-shaped responses are labeled as fixtures.
2. Missing or false approvals, wrong credentials/context, unsupported symbol responses, duplicate keys, invalid UTF-8, redirects, oversized bodies and arbitrary URLs produce no admitted event or external-authority claim.
3. Local transport tests exercise actual receiver persistence and exact acknowledgements, body/id collisions, unknown response recovery, original receipt lookup, same-UUID replacement history refusal and preserved outbox identity.
4. Failures, pauses, stale/missing quotes, exhausted capacity and interrupted polls retain evidence. They cannot fabricate a fill, silently reset budget, replace a failed trial or automatically perform owner controls.
5. Actual operator tokens cannot enter arguments, URLs, output, retained state or fixtures; invented fixture credentials are explicitly local test data. Config/state concurrency and partial persistence fail without confirming unaudited delivery.
6. Source tests, typecheck, whitespace checks and coordinated ordered build pass with no external market endpoint run. Record actual counts and packaged source identities after validation; synthetic tests do not prove Kraken availability, usage rights, independent provenance or profitable performance.

## Authority and remaining delivery

An operator's explicit acknowledgement is not a provider license or an issued network grant. Review current provider terms and the complete shared-IP budget before an actual external run. This source preparation does not authorize expenses, public hosting, production deployment, remotely exposed intake, new account credentials or financial actions.

Authentic/licensed feed operation, a real authorized signal source, complete external search history, unattended lifecycle controls, hosted/browser acceptance and independently reviewed forward evidence remain separate work. The Holy Grail remains a pursuit, not a profitability claim.

See the [market-data guide](../kraken-market-data.md), [local receiver](../local-session-receiver.md), [Session methodology](../session-methodology.md) and [exact strategy handoff](010-exact-strategy-handoff.md).
