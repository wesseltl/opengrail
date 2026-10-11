# Sample Kraken market data into a local Demo session

This source increment prepares an optional sponsor-run producer for the existing [local Session receiver](local-session-receiver.md). It reads public Kraken market data and submits normalized `CLOSED_BAR` and sampled `QUOTE` events to one explicitly selected local history. Coordinated local checks and the ordered build passed; native source-save evidence is verified separately. No external market-data run, hosted provider connection or financial action has been performed as part of this work.

The producer runs on your own machine. The website does not connect to it, receive its token or start it. It needs no Kraken account, exchange credential, AI inference service or paid signal subscription. Public endpoint access does not by itself establish permission to use, retain or redistribute the data; review the provider's current terms and your intended use before opting in.

## Review the setup

Use the existing Node.js 22.13+ installation and local receiver prerequisites. Start the receiver with an explicitly reviewed `SYSTEM_RECEIPT` configuration, an exact public strategy and your acknowledged data-use rights. Keep local configuration, feed state, credential hashes and journals in the ignored `work/` directory or outside the checkout. Never force-add them to Git.

From the receiver's `READY` output, copy its `http://127.0.0.1:PORT` origin, `sessionInstance`, original `startedAt` and canonical `implementation`. Supply the latter two as `receiverStartedAt` and `receiverImplementation`. Before creating feed state or requesting public data, the producer checks the fixed Session source fingerprints and recomputes the existing history instance from the exact configuration, original start time and implementation. A substituted market, timeframe, configuration or new history cannot use a copied instance hash as a shortcut. This binds the declared configuration/history preimage; it is not provider authentication, producer-code attestation or a global execution identity. Instance identity survives resume of the same retained history; a new journal at the same port or with the same session UUID must not inherit a pending event. Only the separate producer credential is accepted. The owner credential belongs in the local monitor, where Pause, Resume and Emergency remain owner actions.

The strategy's exact uppercase slash market and one of `5m`, `15m`, `1h`, `4h` or `1d` determine the provider requests. The returned display key must match that market. Unsupported markets and substituted response keys fail; the producer does not silently switch aliases, quote currencies or strategies.

## Explicit local start

These commands describe the prepared source interface; running them with approved authorization permits actual external GET requests. No such run is assumed or performed by this documentation.

```sh
node scripts/kraken-market-data.mjs start work/local-session/session-config.json work/local-session/kraken-feed-state.json
```

The process expects one bounded JSON authorization line followed by end of input on standard input. Close stdin after supplying it; a newline alone does not start polling. Supply it through your approved secret-input mechanism, with the actual local origin, history instance and producer token. Do not put the token in command arguments, shell history, environment files, logs or a saved authorization file. The following is a schema illustration with placeholders, not an executable credential:

```json
{"receiverOrigin":"http://127.0.0.1:PORT","sessionInstance":"<64 lowercase hex characters from READY>","receiverStartedAt":"<original READY.startedAt in canonical ISO UTC>","receiverImplementation":{"version":"opengrail-session-v1","engine":"<READY.implementation.engine 64 hex>","model":"<READY.implementation.model 64 hex>","journal":"<READY.implementation.journal 64 hex>"},"producerToken":"<local producer token held in memory>","publicDataUseApproved":true,"sharedIpRateBudgetApproved":true,"pollMs":15000,"cycles":120}
```

Both approval fields must be literal `true` on every invocation; neither is defaulted. They record the operator's explicit acknowledgement, not provider permission or application-issued authorization. Approve the use and retention of public data and the aggregate request budget of every process sharing your public IP. Declining or omitting either acknowledgement starts no feed. There is no additional approval flag.

`pollMs` ranges from 15,000 to 3,600,000 ms and is a minimum interval between poll starts. Each poll issues at most two serial explicit GET fetch attempts to the fixed Kraken public OHLC and Trades endpoints, at least 1,000 ms apart, without caller-selected URLs or redirects. This bounds the script's scheduled fetch invocations, not wire-level library behavior or a provider-authorized combined IP budget. Slower polling may be appropriate. Provider throttling, unavailable data and transport errors stop the producer with retained failure evidence; they do not trigger an unbounded retry loop.

Keep the process output free of credentials. Status output is bounded operational metadata; the local feed state is created privately with mode `0600`. The raw token stays in process memory and in authorization headers sent only to the fixed local receiver. It is neither a Kraken API key nor an OpenGrail public-agent grant.

## What the producer observes

| Input | Normalized use | Limits on the evidence |
| --- | --- | --- |
| Finalized OHLC entries | Strict aligned, increasing, contiguous closed bars; initial tail at most 300 bars. | The last current candle is always omitted. No missing candle, price or volume is invented. The kernel decides warmup and eligibility using the actual start, source and receipt times. |
| Recent Trades response | The greatest genuine provider trade timestamp becomes at most one sampled last-trade quote per poll. | It is not a bid/ask quote, spread, executable price or complete tick stream. Provider seconds are represented at millisecond precision without bumping an older timestamp forward. |
| Opaque provider cursors | Retained response metadata only; not used in later requests. | Requests do not pass `since`, page or claim that every intervening trade was captured. |

A trade older than the 60-second quote-age bound produces no fresh quote. Future, malformed or inconsistent provider data fail validation. A duplicate timestamp does not become a new observed time merely because another poll or retry occurred. Accepted source timestamps remain distinct from the local receiver's receipt clock.

The fixed requests use `assetVersion=1` and require exact display market keys. The supported timeframes map to Kraken intervals of 5, 15, 60, 240 and 1,440 minutes. Parsing is bounded to 256 KiB per response, at most 720 OHLC tuples and 1,000 trade tuples. This is a small sampled-market-data adapter, not an exchange connection or historical-data archive.

Kraken documents that OHLC's last entry is uncommitted and that older history is bounded; its Trades endpoint supplies recent transactions and display keys through `assetVersion=1`. See the official [OHLC reference](https://docs.kraken.com/api-reference/market-data/get-ohlc-data), [recent Trades reference](https://docs.kraken.com/api-reference/market-data/get-recent-trades) and [public API rate-limit guidance](https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-), reviewed 11 October 2026. The public rate guidance applies OHLC/Trades limits by IP and pair. Review that guidance and the current provider policy before an actual run; these links do not establish your aggregate shared-IP allowance or data license.

The producer emits no `SIGNAL` events. A `SIGNAL` strategy still requires a separately authorized external signal producer through the existing receiver. Kraken prices do not replace Altfins signals, TradingView events, their timing or their subscription terms. Rule-based families may use admitted market bars and quotes under the current kernel; this does not establish profitable decisions.

## Retention and uncertain acknowledgements

Before posting, persist the normalized outbox event and its exact request ID to the private feed state. Confirm its original receipt using the selected session ID and history instance. Only an exact correlated persisted receipt advances confirmed local progress. A receipt with `disposition: REJECTED` remains a rejection even if HTTP transport succeeded; retain it and stop.

After an unknown acknowledgement, keep the original event, request ID and bindings. Resume reconciles that receipt or retries the identical event. A missing lookup is not proof that the original request never committed. Do not generate a replacement UUID, edit a pending body, switch the receiver history or delete a failed state to manufacture a fresh trial. The receiver's writer continues to enforce idempotency and durable journal reconstruction.

```sh
node scripts/kraken-market-data.mjs resume work/local-session/session-config.json work/local-session/kraken-feed-state.json
```

Supply the same strict authorization shape again on standard input, with current explicit approvals and the credential for that retained receiver context. Resume revalidates the exact configuration, source/history bindings and retained progress. Recoverable failed fetches or uncertain pending deliveries may be resumed explicitly when context is unchanged. Known rejected events, detected gaps, clock regressions and a completed budget are terminal; resume does not remove them or reset their evidence. A clock fault preserves the actual regressed time and prior time in `clockFault`, rather than bumping timestamps to repair chronology. Diagnose the fault without editing retained time, deleting failed state or automatically resuming admissions.

The producer checks its local pinned configuration, not current public Strategy Hub visibility. Previously exported files cannot be recalled by a later source withdrawal. Feed-state hashes and copied receipt fields establish internal consistency, not cryptographic receiver attestation or full journal reconstruction.

The producer never sends an owner Resume or changes a risk limit. Receiver recovery leaves the applicable paused/protective state intact. If an owner deliberately resumes entries, use the existing local monitor. A stopped feed, provider outage, exhausted budget or end of input never fabricates a closing quote or liquidates open positions. Check the receiver's retained exposure and source/receipt freshness; Emergency still requires an eligible later quote and finite protective capacity.

## Finite resources and claims

The feed state permits at most 120 total polls, including failed or interrupted attempts, at most 240 explicit public-provider fetch attempts issued by the script, at most 1,800 normalized local events and 4 MiB of retained state. Each pending event permits at most eight retained delivery/reconciliation attempts; this does not guarantee eventual confirmation. Authorization intake is bounded to 2 KiB, configuration to 32 KiB and local receipt responses to 128 KiB. Resume does not reset the poll budget. The receiver has its own stricter current admission, byte and reserved protective limits. A producer budget does not guarantee receiver headroom or an emergency fill. There is no automatic rollover, history deletion, external-data retry storm or guaranteed unattended uptime.

Provider response parsing and local transport use fixed trusted code. No submitted strategy code, downloaded executable, private exchange API, account balance, order endpoint or financial credential is used. Public scopes, database records, deployed configuration, strategy definitions and pinned Session semantics remain unchanged. No result is published automatically.

Market provenance remains a claim about the contacted source, not independent authenticated data. Results remain **AUTHOR_REPORTED**, qualification **NONE**, orders and Live disabled. Retained local state and journal reconstruction establish internal consistency; they do not prove complete upstream history, authentic feed delivery, independent research, untouched test data or profitable execution. Sampled last trades plus authored fee/slippage assumptions cannot prove an achievable return.

See [task 011](tasks/011-read-only-market-data.md) for acceptance requirements. Local tests use synthetic provider-shaped responses and actual local transports; 700/700 coordinated tests, typecheck and ordered build passed; native source-save evidence is verified separately. External endpoint acceptance, permitted operator deployment, provider licensing/budget review and independent forward qualification are separate gates.
