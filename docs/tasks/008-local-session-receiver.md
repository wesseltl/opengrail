# 008 — Sponsor-local connected Demo receiver

Status: source implemented and locally verified; ordered build/source evidence is recorded in the release review. This is a sponsor-operated loopback connection, not a hosted provider, public session permission or qualified forward result.

## Intended behavior

An external agent should submit a bounded market event and obtain its durable receipt without streaming terminal output or importing a new file into the website. The owner should see the actual confirmed strategy, positions, protective prices, pending decisions and remaining journal capacity while the process runs.

Reuse the fixed continuous Session method and its existing writer. The receiver must not create a second reducer, historical fill rule, store or recovery interpretation. Distinct local producer and owner credentials confer only the stated local access. Public agent publication credentials do not authenticate this transport.

## Acceptance

1. Bind exclusively to `127.0.0.1`; validate the exact Host and same-origin browser requests. Do not expose a remote service, CORS bridge, public grant or provider connection.
2. Authenticate market intake separately from owner controls and reads. Persist credential digests only. No raw token may appear in a URL, journal, routine diagnostic or browser storage.
3. Process existing strict market/control schemas through the unchanged durable Session writer. Success follows the writer's durable acknowledgment and matching retained journal checks. Concurrent requests cannot fork state.
4. Exact retries recover their original receipt and timestamp. Changed request bodies conflict. An uncertain response remains reconcilable without inventing an accepted event.
5. Start serving only after initial persistence or complete journal reconstruction and the recovery pause. Recovered admissions require explicit owner resume; emergency positions remain open until an eligible quote actually arrives.
6. Monitor only confirmed state with real timestamps, direction, entry, SL/TP and cost-aware marked P&L. Missing/stale data or disconnected intake cannot imply fresh prices, liquidation or continuous uptime.
7. Bound bodies, connections, queues, diagnostics and retained history. Preserve normal admission and emergency headroom; exhaustion cannot silently discard earlier adverse events.
8. Actual loopback tests cover a signal-to-position-to-negative-exit flow, credentials, headers, malformed input, retries, concurrency, recovery, protective controls and durability uncertainty. Local fixtures remain distinct from real-browser, hosted or authentic market-data acceptance.

## Gates beyond this increment

Provider selection and licensing, plan/request budgets, authentic market availability, remote exposure, unattended operation, new public/session capabilities, public forward evidence and independent qualification need separate review. This local receiver introduces no paid inference dependency, financial action or private-application access.

The ordered Sites build completed successfully. Exact local evidence and source fingerprints are in [the validation receipt](../../validation/local-session-receiver-20261011.json); native save verification follows separately.
