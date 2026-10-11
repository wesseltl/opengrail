# Deliver supplied signals into local Demo

The prepared `scripts/supplied-signal.mjs` intake supplies the missing SIGNAL producer leg for a sponsor-local receiver. It consumes one explicitly supplied local JSON file per intended signal and keeps the original normalized event pending until its actual receiver acknowledgement is correlated. It reuses the existing Session writer and its fees, risk, later-quote fills and failure history. The website supplies a guide and local receiver configuration; it neither starts this process nor collects its token.

This source interface does not connect TradingView or altFINS. Provider/source labels are declarations. No real signal acquisition, provider authentication, licensed upstream operation or hosted forward service has been established. Participation in public APIs requires no private source access; running these local CLI scripts does require an approved private checkout and the existing local receiver prerequisites.

## Prepare one exact history

Select the exact public SIGNAL strategy in `/session`, choose SYSTEM_RECEIPT and explicitly acknowledge input rights. Export its local receiver configuration. Start the existing loopback receiver with separate producer/owner credentials, retaining its journal. From READY capture the actual `http://127.0.0.1:PORT`, sessionInstance, original startedAt and canonical implementation. The producer recomputes the exact history preimage and checks fixed Session fingerprints; copying a hash does not permit another configuration or replaced journal.

Keep configuration, supplied files, signal state, market state and receiver journal in ignored `work/` or outside the source checkout. The raw producer token belongs only in the bounded stdin authorization and loopback Authorization header, never an argument, saved authorization file, environment file, URL, log, website or outbox. It is a separate local role, not a public OpenGrail agent credential. The owner retains Pause, Resume and Emergency.

Supply finalized closed bars and real source-timestamped quotes independently. The existing sampled Kraken producer can supply those legs only after its separate explicit data-use and shared-IP budget approvals. Running the signal producer makes no third-party request and gives no provider permission. Do not replace a missing candle, quote or signal timestamp with an estimate.

## Submit and reconcile

```sh
node scripts/supplied-signal.mjs start work/local-session/session-config.json work/local-session/signal-state.json work/local-session/signal.json
node scripts/supplied-signal.mjs submit work/local-session/session-config.json work/local-session/signal-state.json work/local-session/next-signal.json
node scripts/supplied-signal.mjs resume work/local-session/session-config.json work/local-session/signal-state.json
```

Each invocation expects one bounded authorization JSON on stdin followed by EOF, using the original receiver context and token plus literal `suppliedSignalUseApproved: true`. Use an approved in-memory secret-input mechanism. Closing stdin is deliberate; a newline alone does not complete authorization. The signal input is a strict duplicate-free UTF-8 JSON file, not a command, URL or program.

Use the complete schema and example in `/signal-guide`. Preserve the source's observedAt and availableAt, exact market/timeframe/provider/event and original request/signal IDs. observedAt names the exact retained closed-bar timestamp and must align to that timeframe. A generic alert time cannot be rounded into a bar close. availableAt cannot precede observation; old signals do not become fresh on retry. The existing receiver decides bar presence, warmup, staleness, owner pause and admission.

The producer retains the complete normalized input and its separate raw-byte identity, event digest, pending body, attempts and actual receipts in a mode-0600 state. Changed source bytes or reused IDs cannot silently replace an intended operation. Unknown acknowledgement blocks new signal admission. Explicit resume first looks up the original receipt; only an authoritative not-found response for an unconfirmed operation permits its identical original event to be posted again. Loss of a previously confirmed receipt is not permission to reinsert it.

Preserve malformed source files and operational failure evidence. Refusal before delivery creates no accepted event, invented receipt or favorable result. Receiver-rejected signals and uncertain deliveries remain retained. Concurrent writers, unsafe files, external state edits, clock regressions, replaced context and exhausted capacity stop rather than erase history. Do not hand-edit a state digest to get around refusal.

## Understand the result

A durable accepted signal can create a pending decision, rather than a position. Entry needs a quote with both source observation and receipt strictly later than the decision receipt. Fees, adverse slippage, protective prices, daily halts and emergency handling come from the fixed existing method. The signal producer sends no price, bar or owner control. In the owner monitor inspect actual confirmed positions, protection and receipt time; source timestamps and declarations remain supplied claims.

Lifetime bounds are 120 retained signals, eight delivery attempts per signal and one MiB of state. Inputs are at most 4096 bytes and authorization 2048 bytes, with bounded local receipt parsing and timeouts. These are one retained producer-history limits, not a global rate grant or complete search/provenance attestation. Duplicate submissions do not reset capacity. EOF or producer exit creates no liquidation. A recovered receiver remains paused until the owner explicitly resumes; pending/emergency exits still require an eligible later quote.

The example, parser and actual local receiver/market-shaped acceptance tests use synthetic fixtures. AUTHOR_REPORTED, sourceAuthentication UNKNOWN and qualification NONE remain accurate. Native source saving is not deployment. Authentic altFINS/TradingView integrations, genuine licensed forward observation, hosted public operation, browser acceptance, independent evaluation/ranking and the remaining agent/AI-assistance goal still require evidence and approval where applicable.
