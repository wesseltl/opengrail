# Recorded observations for a locked forward Demo

This optional local collector binds the complete locked search handoff and its separate forward plan to the existing receiver configuration. It composes the unchanged Kraken producer and Session kernel. It records bounded exact **decompressed response-body bytes**, never claimed wire/TLS bytes, before delivering the producer's existing normalized events. The local verifier reconstructs every retained receiver transition. None of these records independently establish provider authenticity, precommit timing, custody, licensed reuse, profitable performance or deployed behavior.

Start with [the locked-search forward plan](forward-demo.md), [the existing sampled Kraken feed](kraken-market-data.md) and [the local receiver](local-session-receiver.md). The exported config preserves the exact locked strategy, capital, costs and risk; it is the existing canonical `SYSTEM_RECEIPT` / `PUBLIC_STRATEGY` / `USER_SUPPLIED` config. The separate `LOCAL_FORWARD_DEMO_PLAN` retains the complete verified search, including adverse TEST and failed/interrupted attempts. Do not retype or retune the winner.

## Starting and verifying

Run these commands from the repository checkout. Every argument below is an absolute path outside the checkout and current working directory. Plan/config inputs must be private regular files owned by the operator, mode `0400` or `0600`, with no hard links or symlinked ancestry. The mutable feed and receiver journal are private `0600` files. The archive is a new exclusive `0700` directory; its index and ordinal body files are `0600`.

Wait until the planned `startsAt`, then start the existing receiver with the exact exported config, a **new** journal and separately provisioned role hashes. Do not backdate its journal. Record the actual READY instance/start/implementation and retain the original journal path. The collector requires that original journal to reconstruct as sequence zero and match the config, instance and actual start; it rereads unchanged preflight bytes immediately before the first provider request. This is a **local file snapshot**, not an authenticated attestation of the current endpoint. The first receiver acknowledgment checks the producer's declared receiver instance. Owner credentials stay outside the collector; the receiver's full-journal HTTP endpoint remains owner-only.

Prepare the existing bounded producer authorization JSON in a private file. It contains only the producer token, loopback receiver origin, exact instance/start/implementation, poll interval, cycles and the existing explicit data-use/shared-IP acknowledgments. Never add the owner token. The operator must separately establish that their use **and raw retention** are permitted. The additional flag below records that explicit acknowledgment; it supplies no provider license or permissions.

```sh
node scripts/recorded-kraken-market-data.mjs start /absolute/private/plan.json /absolute/private/config.json /absolute/private/new-feed.json /absolute/private/new-raw-archive /absolute/private/original-journal.json --retain-public-data < /absolute/private/producer-authorization.json
```

Resume only the exact matching recorded history, while still inside the declared interval, using its existing feed, archive and receiver journal:

```sh
node scripts/recorded-kraken-market-data.mjs resume /absolute/private/plan.json /absolute/private/config.json /absolute/private/feed.json /absolute/private/raw-archive /absolute/private/original-journal.json --retain-public-data < /absolute/private/producer-authorization.json
```

Offline verification uses no credential, network request or data-use authorization:

```sh
node scripts/recorded-kraken-market-data.mjs verify /absolute/private/plan.json /absolute/private/config.json /absolute/private/feed.json /absolute/private/raw-archive /absolute/private/original-journal.json
```

The verifier's internal identity-only reference satisfies the old state validator's structure; it cannot authorize a real request. It rechecks the exact plan, config, feed, journal and archived body bytes before reporting success. It does not execute caller-selected commands, strategy code, URLs or provider writes. Programmatic synthetic hooks are test capabilities; the CLI exposes none.

## What is retained

Before each fixed `OHLC` or `Trades` GET, `index.json` retains a numbered request slot, poll, endpoint, original producer clock and capture start. URLs are built by the existing fixed first-party normalizer; headers and exception text are not archived. Complete responses preserve their exact bounded body, status and the JSON/type/length semantics the old producer uses. HTTP failures, bodyless HTTP statuses, malformed/duplicate JSON, interrupted streams, oversized prefixes, timeouts, unused observations and uncertain writes remain adverse history.

The clock after returning a buffered response is a **candidate** clock. It becomes a normalization clock only when the unchanged producer durably reports that response's successful parsed poll digest. A failed HTTP/JSON/normalization attempt remains unnormalized. Fresh quotes before `startsAt` are retained and rejected without advancing source timestamps. Closed historical bars remain warmup under the unchanged Session kernel. Body/candidate clock regressions retain actual clocks and halt; recorded clock faults cannot be automatically resumed.

Successful observations are bound to the original durable outbox event UUIDs and digests before delivery. Feed/index/body publication is not one atomic transaction. If a write might have committed, a parent/lock/source changes, or the files disagree, preserve every possible committed file and stop. No uncertain body is republished under its ordinal. Orphans or feed/archive disagreements block normal resume; the tool supplies no automatic repair, pruning, rebinding or retrospective raw-body graft onto a legacy feed. Original requests, delivery attempts and receiver acknowledgments stay retained. A pending request or lost acknowledgment never resets the budgets.

The original bounds remain: 120 polls, 240 public GETs, minimum 15-second poll interval, existing one-second endpoint pacing, eight delivery attempts per event and 1,800 producer events. Bodies have a 262,144-byte per-response cap and a 62,914,560-byte aggregate cap; the separate index has a 2,097,152-byte cap. Full journal verification retains the existing 8,388,608-byte journal limit. Disk exhaustion or a concurrent writer halts intake. These caps do not establish adequate sampling or complete market coverage.

## Reading the result

`RAW_OUTBOX_FULL_JOURNAL` means every mapped raw body re-normalizes to the exact producer outbox and the complete receiver journal reconstructs with current pinned first-party code. Every journal market event must have an outbox mapping; owner `PAUSE`, `RESUME` and `EMERGENCY` events remain separately retained. A receipt lookup may return the original receipt with **later** journal/state digests; verification accepts only a reconstructed prefix at or after that original sequence. A committed event without a confirmed acknowledgment is reported as such and is not silently promoted.

`finiteBudgetCompleted` describes the producer budget only. `declaredIntervalEnded` reports retained clocks reaching the declared end, while `declaredHorizonCovered` remains false: this sampled collector does not prove continuous market coverage. `WINDOW_NOT_REACHED`, `PARTIAL` and `GAPPED`, late observations/events, warmup versus forward bars, pending entries, open positions, realized losses and fees remain visible. New requests stop at the window boundary; in-flight late observations and already delivered events stay in the complete history. Nothing creates a closing quote or liquidates inventory at a stream tail.

The Kraken adapter supplies closed bars and sampled last trades. **SIGNAL strategies are unsupported by this collector.** It never invents signal labels. Sampled last trades are not an order book, executable spread or exchange fill. Unexpected provider symbol encoding/schema is retained and rejected. No real provider compatibility, provider use, licensing or market performance is established by the synthetic acceptance tests.

All output remains `AUTHOR_REPORTED`, qualification `NONE`, source authentication `UNKNOWN`, with independence unestablished and orders/Live disabled. Do not upload archives, journals, role files or tokens publicly without reviewing data rights and private material. This local tool does not start a hosted job or execute an investment.
