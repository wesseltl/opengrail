# 006 — Incremental signal-to-Demo sessions

Status: source implemented and locally verified; build/source checks are recorded and native version verification follows separately in the [release review](../release-signal-session.md). This task adds a local/sponsor-run session foundation; it does not claim a connected provider, hosted continuous service, authenticated market data or completed forward qualification.

## Problem and intended behavior

A historical replay does not show whether a system reacts correctly when events arrive one at a time. Reusing a next historical open after receiving the prior bar late would backdate a fill. A genuine session must retain what it knew, when it accepted the input, what decision it made and which later quote supported a simulated fill.

## Implemented source increment

- Pin an exact declarative strategy and separate quote-based forward method; preserve existing batch replay and reference semantics.
- Consume strict bounded external event lines incrementally through connected standard input in a sponsor-owned process. Fixed trusted code processes data without starting caller-selected executables or contacting a provider.
- Separate source timestamps from acceptance order/clock. Use closed available inputs for decisions and later eligible received quotes for fills; warmup cannot produce past positions and earlier bar extrema cannot act on a mid-bar entry.
- Retain fee/slippage assumptions, virtual allocation/cash/collateral, daily loss halts, emergency pending exits and uncapped adverse failures. Missing usable quotes keep an explicit pending state.
- Persist a bounded append-only local journal with exact event/idempotency identity, immutable session configuration, digests and deterministic reconstruction. Checkpoints derive from verified retained history, and incomplete persistence cannot confirm an unaudited transition.
- Keep malformed, stale, rejected, no-trade, negative, interrupted and failed outcomes visible. Capacity stops admission instead of dropping failed events; resumed sessions retain inventory, intent, consumed signals and halt state.
- Provide an actual browser interaction for local session input and evidence. Label synthetic/supplied data, page/process lifetime and unauthenticated producer claims plainly.
- Keep existing public agent grants, publication schemas and D1 storage unchanged. No session is published automatically or disguised as a batch replay artifact.

## Acceptance evidence

1. Sequential arriving inputs produce decisions only from accepted available information; a past open or stale quote cannot create a fill.
2. Hand-calculated LONG/SHORT cost/risk cases and every claimed supported family exercise the actual reducer.
3. Delayed or missing quotes, gaps, clock regression, source delay, disconnection, emergency requests and daily resets retain honest outcomes without fictitious liquidation or uninterrupted uptime.
4. Duplicate identical events reconcile without a second fill; changed reuse conflicts. Competing, uncertain and resumed operations cannot fork confirmed state silently.
5. Bounded line/stream/journal/state limits, partial writes, corrupt checkpoints/journals, and export failures fail safely without overwriting prior evidence or confirming unpersisted fills.
6. An external producer can supply multiple events to the running standard-input transport; the process applies them incrementally rather than waiting for a complete historical batch.
7. Public reads and local execution introduce no new permission, provider secret, paid service, server-side uploaded-code execution, financial action or private-application access.
8. Source tests/typecheck/whitespace/ordered build pass. Hosted identity, browser acceptance, provider operation and production cost controls remain separately reviewed.

## Remaining delivery gates

The [exact strategy handoff](010-exact-strategy-handoff.md) connects an immutable hub version to the Session setup and explicitly exports the existing system-receipt configuration for the sponsor-local receiver. This reduces manual configuration work without starting the process, generating market events or authenticating a provider.

[Task 011](011-read-only-market-data.md) prepares a sponsor-local read-only Kraken producer for finalized bars and sampled last-trade quotes, with explicit operator approval, exact config/start/implementation instance binding, finite request budgets and retained uncertain deliveries. Clock regressions remain terminal evidence rather than repaired timestamps. Its checks are pending; no external provider run or website connection is claimed. `SIGNAL` strategies still require a separately authorized signal producer.

Authenticated market provenance, actual permitted data use and shared-IP budgets, unattended operation, scoped agent capabilities, private/public session policy, public forward-artifact integration and independent qualification remain separate delivery work. Source-level preparation does not authorize deployment, new credentials or costs.

The ordered Sites build helper completed successfully; exact packaged source identities and checks are recorded in the [validation receipt](../../validation/signal-session-20261011.json).
