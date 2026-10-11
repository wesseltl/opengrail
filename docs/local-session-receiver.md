# Connect a sponsor-local Demo session

OpenGrail's local receiver gives an external producer an authenticated HTTP intake and gives the owner a continuously updated local monitor. It wraps the existing fixed `session-runtime.mjs` writer; the continuous method, costs, protective behavior and journal reconstruction stay the same.

Run the reviewed source on infrastructure you control with Node.js 22.13 or newer, Python 3 with POSIX file locks, and the existing installed dependencies. It binds only to `127.0.0.1`. Opening it remotely or adding a proxy is outside this connection design. The OpenGrail website does not connect to the process or receive its credentials.

## Start

From the project root, create the ignored local working directory:

```sh
mkdir -p work/local-session
```

Use **Open Session** on an exact public hub strategy, review a system-receipt setup and explicitly export its local receiver configuration with acknowledged data-use rights. Save it as `work/local-session/session-config.json`; the [handoff workflow](exact-strategy-handoff.md) explains the exact-source checks and stable setup identity. It creates no running session or provider connection. You may also prepare a strict configuration following [the Session methodology](session-methodology.md), with `clockMode: SYSTEM_RECEIPT`, an exact strategy digest and acknowledged rights. A provider name is a declaration, not a working adapter.

```sh
node scripts/session-receiver.mjs credentials work/local-session/local-session-hashes.json
node scripts/session-receiver.mjs start work/local-session/session-config.json work/local-session/session-journal.json work/local-session/local-session-hashes.json
```

These example paths use the checkout's already ignored `work/` directory. Keep your configuration, hash file and retained journals there or outside the checkout; they are sponsor-local material, not public contributions. Never force-add them to Git. The explicit `credentials` command prints one producer token and one owner token once. Handle that output as a secret: do not record it in logs or commit it. The new mode-0600 credential file contains only their distinct SHA-256 digests. Existing files are refused. The normal receiver output contains a local URL and safe readiness information, not tokens.

Open the exact local URL in a browser on the same machine. Enter the owner token to view confirmed state. The monitor holds it in memory and sends it in an `Authorization: Bearer …` header; it does not place credentials in URLs or durable browser storage. Owner reads and controls require the owner token. Producer credentials are separate and do not provide owner controls or full-state access.

An optional final port argument selects a local port; omitted or `0` selects an available port. Record the newly emitted URL after every restart.

## Event and control API

| Endpoint | Role | Behavior |
| --- | --- | --- |
| `POST /api/events` | Producer | Existing strict `QUOTE`, `CLOSED_BAR` or `SIGNAL` event. |
| `POST /api/control` | Owner | Existing strict `PAUSE`, `RESUME` or `EMERGENCY` event. |
| `GET /api/receipts/<requestId>` | Owner or producer | Original confirmed receipt; producers cannot retrieve owner-control receipts. |
| `GET /api/state` | Owner | Bounded confirmed strategy, financial state, positions, timestamps, audit and capacity projection. |
| `GET /api/journal` | Owner | Exact confirmed journal for explicit local export and reconstruction. |

Send JSON bodies with `Content-Type: application/json`, unique keys and an existing lowercase UUID `requestId`. Writes and receipt lookups also require `X-Session-Id` and `X-Session-Instance` from the readiness/confirmed-state response. The instance binds the exact configuration, original start time and implementation: it survives resume of that history, and differs for a newly started journal even if its configuration and port are reused. A different context conflicts before mutation. No caller-supplied receipt time is accepted. Tokens belong only in the authorization header. Browser requests require the local origin; agent requests may omit Origin. Duplicate or conflicting security headers are rejected. There is no CORS permission for a remote website.

Give the producer both context values from the receiver's `READY` output; the producer role cannot read the owner state endpoint. `READY` also supplies the original `startedAt` and canonical `implementation` fields. The optional market-data producer requires those declarations to recompute the exact config/history instance before public fetches; this is a misconfiguration fence, not provider authentication or execution attestation. Bind it deliberately to the intended history. The instance identifies declared content/start/implementation and is not a globally attested execution identity; an owner-authored exact history copy retains that identity.

A successful response includes the exact session and history-instance identity, original event receipt and checked current journal/state digests. `disposition: REJECTED` means the reducer retained a rejection, even when transport persistence succeeded. It is not an executed decision or fill. Reusing an ID with the identical normalized event returns its original receipt; changing its body conflicts. A lookup does not prove an event was submitted if no receipt exists.

After an unknown response, retain the exact original request ID and body. Reconcile by receipt lookup or retry that identical event. Do not manufacture a new ID to replace a possibly committed request. After persistence or child-process uncertainty, the receiver stops accepting work; preserve the file and reconstruct it before restarting.

The receiver itself does not fetch prices, connect Altfins, authenticate an exchange or execute strategy code. The optional [Kraken sampled-market-data producer](kraken-market-data.md) is a separate sponsor-run source increment with explicit public-data/shared-IP approvals and finite retained delivery state; its coordinated local checks passed and no external feed run is claimed. It supplies market bars and sampled last trades, not Altfins or other `SIGNAL` events. A valid producer credential proves which local role sent an event. It does not prove that the price, source timestamp or provider label is genuine. Configuration and journal text containing local credential prefixes, including encoded copies, is refused; do not put credentials in source labels, rights notes or strategy descriptions.

## Recovery and protective behavior

```sh
node scripts/session-receiver.mjs resume work/local-session/session-journal.json work/local-session/local-session-hashes.json
node scripts/session-runtime.mjs verify work/local-session/session-journal.json
```

Resume reconstructs all retained transitions before serving. Active or paused recovered sessions record a recovery pause; owner resume is explicit. Existing open positions, consumed signals, decisions and daily halts remain intact. Emergency stopping waits for a strictly eligible fresh quote; stopping the receiver never fabricates a final price or liquidates inventory.

The local monitor shows confirmed state and quote/source/receipt times. Marked profit includes entry costs and the method's estimated exit costs. A stale mark is not a new market valuation. Lost connectivity, a hidden browser tab or polling interruption stops fresh monitoring; the receiver and its journal have their own lifecycle.

This is finite operation: the existing journal permits 2,000 ordinary events plus 32 reserved protective events, at most 8 MiB of retained journal bytes, with 512 KiB reserved from ordinary admission. No automatic event deletion, rollover or undisclosed trial reset is provided. Body, connection, queue and request limits are additional transport bounds. It is not an HFT engine or an unlimited unattended service.

## Evidence and authority

All session results remain **AUTHOR_REPORTED**, qualification **NONE**, with supplied market provenance. An internally reconstructed journal establishes consistency with the fixed local method, not authentic data, complete external history or profitable performance. No result is published automatically.

Public agent permissions, publication schemas, D1 tables and deployment settings are unchanged. The owner creates these local process credentials explicitly; they are not network grants or production permission changes. Live orders, investments and private Capital Desk access remain disabled or outside scope. No AI inference service or paid market API is required to run synthetic local fixtures.

See [task 008](tasks/008-local-session-receiver.md) and [the release review](release-local-session-receiver.md) for tested behavior and outstanding delivery gates.
