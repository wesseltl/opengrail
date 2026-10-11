# 005 — Deterministic local Demo replay

Status: source implemented; coordinated tests (234/234), full typecheck, whitespace checks and the ordered build passed on 11 October 2026. The [build and source receipt](../../validation/demo-replay-20261011.json) records this saved source increment. Maintainer rollout review remains pending. This task specifies a bounded local evaluator, not hosted signal ingestion, forward Demo trading, independent qualification or a working investment strategy.

## Problem and intended behavior

Published definitions alone do not show what their rules do under a declared sequence of bars and signals. This increment adds a deterministic replay that preserves the exact strategy, input and method, exposes rejected assumptions and accounts for costs and adverse outcomes without looking into future bars.

This is necessary engine work toward [003: the independent experiment registry](003-independent-experiment-registry.md). It does not replace that task’s preregistration, full trial history, holdout/leakage controls, independent reproduction, conflicts policy, qualification permissions or durable shared evidence registry.

## Scope

- Accept a strict bounded declarative strategy record and digest, initial virtual capital, contiguous time-aligned closed OHLC bars and explicitly timed supplied signals. Reject inconsistent canonical identity, unknown fields, executable code, invalid prices and malformed chronology.
- Calculate decisions from closed, available inputs. Queue an eligible entry for the next bar’s open; never use that bar’s later close/high/low to decide an entry at its open. State exactly when signal observation, availability, age and consumption are evaluated.
- Apply adverse per-side slippage and fees. Handle opening gaps, stop/target touches, simultaneous touches, terminal close and missing warmup under an explicit conservative event order. OHLC bars do not reveal intrabar paths.
- Account for reserved virtual notional, available capital, mark-to-market exposure and estimated exit costs before new entries. Keep allocation and open-position bounds; do not multiply DCA/grid capital by the number of legs. Latch a UTC-day loss halt and describe reset and forced-exit behavior.
- Define DCA spacing/count and grid level crossing/rearming without inventing intrabar fills. Keep signal providers and synthetic samples explicitly disconnected from actual feeds.
- Bind artifacts to exact request, strategy, bars, signals and evaluator/method identities. Numeric or accounting failures are retained terminal outcomes rather than silently repaired results. Unsupported short-margin assumptions must not turn clipped loss into ordinary complete performance.
- Run only the reviewed first-party declarative evaluator locally. No uploaded code, public compute service, account connection, order, transfer, private financial source or paid dependency is authorized.
- Retain attempted local trials, including validation rejection, no-trade runs, negative outcomes and terminal failures. Describe the local retention bound and loss on navigation; it is not a complete persistent search history or a shared registry.

## Acceptance evidence

1. Identical canonical strategy and input produce identical artifacts under the declared evaluator. Changing the strategy, data, supplied signals, initial capital or method changes the appropriate identity.
2. A future bar or unavailable signal cannot create an earlier fill. Entries occur at the next open; the final bar’s decision cannot produce a nonexistent later entry.
3. Long and short hand-calculated fixtures agree with entry/exit fees, adverse slippage, collateral and mark-to-market accounting. Gap and dual-touch fixtures preserve conservative stop/target assumptions.
4. Daily halt, open-position and available-capital fixtures prevent further entries at the declared event boundary, including pending entries. A halt does not disappear after a same-day recovery. Insolvency and unsupported inputs remain visible terminal cases.
5. Every supported family has a documented eligibility and budget rule. DCA/grid fixtures prove partitioned total allocation and do not infer a profitable path from bar extrema. Missing indicator warmup and undefined calculations do not silently become signals.
6. A synthetic or manually supplied provider signal is labelled as supplied input, with no claim of an actual Altfins/TradingView connection, current quote or source provenance.
7. Rejected, no-trade, negative and failed trials remain in the bounded local UI history rather than being replaced by the selected winner. Stale async work cannot replace another trial, revive a private draft after page loss or produce a claimed success without an exact artifact match.
8. Actual engine/UI fixtures and the repository’s final checks pass under synthetic local inputs. Release evidence distinguishes these checks from hosted browser behavior, public availability and independent validation.

## Out of scope and review artifact

There is no live signal receiver, broker/exchange adapter, forward-running portfolio, investment recommendation, reputation update, qualified ranking, independent reproduction or profit guarantee. Imported timestamps and source labels remain author claims. A deterministic hash cannot establish that the data were available historically or that a holdout remained unseen.

Provide the [methodology](../demo-methodology.md), exact request/artifact schemas, hand-calculated and adversarial fixtures, the [complete synthetic supplied-signal case](../../examples/demo/README.md), retained failure cases, UI retention/recovery behavior and [release evidence](../release-demo-replay.md). A maintainer must review production scope, data rights, operational/resource controls and hosted acceptance separately. No local pass authorizes deployment or additional permissions.
