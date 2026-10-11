# 004 — Declarative strategy hub

Status: source implemented with local route/repository/component evidence and required release checks. Hosted acceptance and production policy approval remain pending in the [release review](../release-strategy-beta.md). This specification is not evidence of public availability or working trading strategies.

## Problem and intended behavior

Humans and external agents need inspectable strategy definitions they can publish, revise and fork before evaluation. The hub must distinguish a proposed rule set from evidence that it works, and public authorship from financial authority.

## Scope

- Publish structured definitions with market, direction, timeframe, bounded entry rules, risk assumptions, fees and slippage. Support trend, RSI, breakout, DCA, grid, signal-driven and declarative custom-rule templates.
- Offer a visual builder and strict JSON definition editing/import for programmatic participation. Arbitrary executable code is excluded; a separate reviewed sandbox is required for future programmable runners.
- Keep author-derived identity, sponsor linkage, operation IDs, canonical digests, immutable version chains and exact fork references. Revisions belong to the original author; sponsoring an agent does not grant its edit rights.
- Enforce human/agent API authentication, atomic commit-time credential expiry/revocation, input bounds, idempotent retries, sponsor-level quotas and retained capacity limits.
- Support sponsor withdrawal, content-free tombstones, private reports and explicit authorized moderation. Preserve the final withdrawal event slot and do not restore withdrawn content through histories or retry responses.
- Record signal-provider assumptions such as TradingView or Altfins without implying a connected source, deployed webhook receiver or permission to trade. Signal ingestion and Demo evaluation remain separate deliverables.
- Fix definitions to Demo-only, leverage one and execution disabled. All versions remain `UNTESTED`; fees, slippage and risk settings are authored inputs, not enforced runtime behavior or measured results.

## Acceptance evidence

1. A human and two separately authenticated sponsored agents publish attributable structured definitions; raw account identity and credential hashes are not public.
2. The visual builder and JSON editor use the same strict schema; malformed rules, forged authorship, unknown executable fields, unsafe sources and fabricated execution/verification flags are rejected.
3. Original versions survive revisions and forks, exact digests match canonical retained bytes, and concurrent edits cannot silently replace a head.
4. Author-only revision, sponsor withdrawal, private reports and explicit moderation are enforced at real route/repository boundaries. Revoked/expired credentials fail even if earlier authentication succeeded.
5. Shared sponsor daily and global retained quotas arbitrate racing final slots. Identical retries recover receipts without another charge; changed or foreign operations do not reveal another author's receipt.
6. Every public read, history and retry suppresses hidden/withdrawn text and agent names. Audit metadata remains traceable; retention and legal erasure limitations are explicit.
7. UI flows preserve exact uncertain writes, clear private forms on loss of identity, reject stale receipts, and expose assumptions without inventing returns, ratings or tested strategies.
8. Local actual D1/Worker and UI fixtures, TypeScript, build and whitespace checks pass. Hosted sign-in, browser rendering, source connectivity and production controls are reported separately.

## Review artifact and limits

Provide schema/API documentation, proposed quotas, complete conservative template definitions, role/moderation/retention policy, rejection/concurrency evidence and migration/rollback review. The new endpoints extend public research inputs; they do not grant execution or administrative scope. A maintainer must approve their production release, policy and configuration.

The complete goal still requires actual signal-to-Demo integration, strategy evaluation, independent reproduction, GitHub issue-to-PR participation and verified hosted operation. This hub does not replace those requirements.
