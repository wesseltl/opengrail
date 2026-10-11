# Task 021 — Supplied signals into sponsor-local Demo

Status: source integrated; 1335/1335 coordinated tests, typecheck and ordered build passed. Actual upstream operation, approved rollout, hosted acceptance and private GitHub setup are not established.

## Observable gap and scope

The actual receiver already admits SIGNAL events and the fixed Session method evaluates them against retained closed bars and strictly later quotes. The sampled Kraken producer emits bars/quotes only. There is no usable operator/agent signal producer. Add one missing producer leg, reusing the existing receiver, writer, validation, durable storage and file-lock design; do not introduce another simulation engine.

Provide `node scripts/supplied-signal.mjs start CONFIG.json NEW_STATE.json SIGNAL.json`, `submit CONFIG.json STATE.json SIGNAL.json` and `resume CONFIG.json STATE.json`. Each invocation consumes one bounded explicit authorization JSON on stdin followed by EOF. Authorization contains the same exact loopback origin, sessionInstance, original receiverStartedAt, fixed receiverImplementation and producer token as the existing local receiver, plus literal `suppliedSignalUseApproved: true`. No token enters arguments, URLs, retained files, logs or the website. Tokens are not OpenGrail public-agent credentials.

SIGNAL.json is one bounded duplicate-free UTF-8 object: version 1, kind SUPPLIED_SIGNAL, original requestId, exact uppercase symbol/timeframe, a strict existing signal `{id,provider,event,observedAt,availableAt}`, declared source `{kind:OPERATOR_SUPPLIED|AGENT_SUPPLIED,label,note}`, and rights `{acknowledged:true,note}`. Source labels and provider selectors are declarations, not authentication or connectivity. No URL, code, quote, price, timestamp fallback or caller-selected remote service is executed.

## Fixed behavior

- Match the pinned exact configuration, SIGNAL family/provider/event and market/timeframe. Verify fixed Session fingerprints and history preimage before intake/network work. Permit HTTP only at the exact `127.0.0.1` origin. No redirects, third-party calls, model or financial action.
- Preserve supplied observedAt/availableAt, requestId and signal ID. Require canonical clocks and aligned declared bar-close time; do not round an alert time, make an old signal fresh or manufacture a missing candle. The existing receiver remains authoritative for retained bar presence, warmup, staleness, pause, later-quote fills and risk decisions.
- Retain complete normalized input, exact input-byte digest/length, normalized event digest, delivery attempts and actual adverse receipts in a private mode-0600 state. Canonical and raw-byte identity are separate. Fixed lifetime limits: 120 retained signals, eight delivery attempts per signal, one MiB of state, 4096 input bytes, 2048 authorization bytes, bounded receipt bytes/timeouts. Duplicate submissions do not create a new signal or reset limits.
- Persist original pending event and attempt before any delivery. Unknown acknowledgment prevents new input admission. Explicit resume first looks up the original receipt, then retries the identical event only on an authoritative not-found response for an unconfirmed event. Changed bodies/IDs/history and replaced receiver instances never repurpose a pending event. Previously confirmed receipt loss is not permission to reinsert it.
- Confirm exact session/history/request/event digest, source/receipt time and known disposition. Actual receiver rejection is retained and stops further admissions. No automatic owner Resume, Emergency, new session, risk change, EOF liquidation or unbounded retries. Failed/interrupted deliveries preserve their original outbox. Malformed input refuses before delivery without echoing its content; existing state/history must survive.
- Reuse the existing private atomic ProducerStore and Python advisory-lock mechanism where compatible; impose the smaller new state bound before every save. Assert concurrent/external state changes, symlinks and unsafe files cannot overwrite audit evidence. Preserve actual regressed clocks and stop, without clock repair.

## Product integration and evidence

Add a concise public local-signal guide and a discovery link from Session receiver setup, explaining exact bar timestamps, separate bars/quotes, local/private-source prerequisites, original pending recovery and actual confirmed positions. Do not connect the browser to localhost, collect credentials or pretend the website starts the process.

Exercise the actual receiver/runtime/writer with this signal producer and the existing market producer using explicitly synthetic provider-shaped responses. Show an accepted decision, strictly later quote fill, retained adverse stop/fees and reconstruction. Include both directions, wrong source/provider/market, causal clocks, pending/body collisions, lost acknowledgments, original recovery, owner pause/recovery and a same-ID replacement history. Real subprocess tests cover the CLI, private persistence and concurrent writers. No actual third-party provider request is authorized by this task.

Run relevant checks then the required full tests, TypeScript, ordered Sites build, whitespace and fixed fingerprints. Preserve prior engines/schemas/migrations/scopes/roles/quotas/dependencies/hosting and the private application. Fix the task-index table continuity when adding this task. Record local checks/source/package/native provenance separately.

## Remaining full-goal gates and rollback

This is usable local supplied-signal intake, not an authenticated altFINS adapter, remote TradingView webhook, genuine upstream/forward evidence, hosted public session or independent qualification. AI assistance, staged unseen evaluation, actual private GitHub/CI, approved deployment/public audience and real hosted/browser acceptance remain required. Claims stay AUTHOR_REPORTED, sourceAuthentication UNKNOWN, qualification NONE, orders/Live disabled.

No source saving authorizes deployment, grants, production configuration or expenses. GitHub source must remain PRIVATE; its actual visibility is UNKNOWN. Roll back to saved version 22 before rollout. Retain existing journals, failed inputs and uncertain original operations; this increment adds no migration or writer permission.
