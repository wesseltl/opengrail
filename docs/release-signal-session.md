# Incremental Demo session release review

Prepared on 11 October 2026. The quote-based kernel, local journal, connected standard-input runner and browser source are implemented. Coordinated local checks, ordered build and exact source receipt are complete; native version verification is recorded separately after saving. No hosted acceptance, provider connection, market-data authentication or deployment is claimed.

## Source increment

The separately pinned `opengrail-session-v1` method processes event input incrementally, fills queued entries only from later eligible quotes, retains exact configuration/events/outcomes, and supports a bounded local journal with reconstruction and recovery. Its retained history is logically append-only; the sponsor-owned file is persisted by atomic replacement. A sponsor process accepts connected standard-input NDJSON from an external producer. The browser uses fixed trusted local simulation code and labels its input/source limitations.

This transport is not a hosted feed receiver or an authenticated provider adapter. There is no D1 session table, new public credential grant, paid service, private application bridge, order execution or automatic public publication. Existing batch replay, reference evaluator and registry/publication contracts remain unchanged.

## Recorded local checks

- Kernel: `node --test tests/session-engine.test.mjs` passed 34/34, including actual 2,032-event capacity and all seven families in both directions.
- Journal: 12/12 targeted fixtures passed, including all three retained synthetic checkpoint reconstructions.
- Actual local command-line transport: 11/11 targeted fixtures passed, including file persistence, identical/conflicting retries, clock regression, concurrent writers, killed lock helper and crash recovery. A running process acknowledged and persisted sequential bar/quote inputs before standard input closed.
- Read-only capabilities: 6/6 targeted fixtures passed; the addition changes metadata and navigation without a submission endpoint or permission grant.
- Session UI: 31/31 actual component fixtures passed, including full reconstruction, source suppression races, capped-history protective controls, pending-intent protection, numerical mark timestamps and compact checkpoint export.

The final coordinated `npm test` suite passed 458/458, with zero failures, cancellations or skips (102.385 seconds). `npm run typecheck` and `git diff --check` passed. An unnecessary home-page copy change was restored, and two existing comparison fixtures now wait for the actual asynchronous evaluator callback before asserting; their cancellation and no-export checks remain intact. Earlier failed test logs remain separate from the final passing evidence. These counts do not claim exhaustive storage faults, power-loss simulation, real-browser acceptance or hosted operation.

The ordered Sites build helper completed successfully. Exact source, dependency, helper and runtime evidence is recorded in the [validation receipt](../validation/signal-session-20261011.json).

Source and package are prepared for native version verification. The native saved-version receipt is recorded separately after saving. No deployment is authorized or claimed by these checks.

The three source-file pins are deliberately narrower than an execution attestation or complete dependency identity. The validation receipt retains the broader build/source inventory.

| Source file | SHA-256 |
| --- | --- |
| `app/session-engine.ts` | `7f4c1263910a4ca25036c610b755af548e2e2a002a2a9021be8c528ff6455215` |
| `app/session-model.ts` | `98e89daed604b52209b57efbf27d1c224665c0684f681f62c08603763eda40cb` |
| `app/session-journal.ts` | `f2ebbeb3121e61d140bb68a4a41957509208b2dd8d38009a226a227f043c81fe` |

The [invented examples](../examples/sessions/README.md) retain an open signal-driven position, an emergency awaiting a quote and the subsequent adverse exit. All three use synthetic prices and a virtual clock; neither the checkpoints nor their source hashes authenticate a real provider.

## Required local evidence

Review the actual model, reducer, transport, journal and UI together. Checks must cover causal signal/bar/quote ordering, warmup, all supported rule families, costs and virtual risk accounting, stop/target gaps, stale quotes, daily/emergency pending exits, consumed-event retries, malformed/oversized input, bounded disk admission, partial persistence, concurrent processes, checkpoints, corrupted resume, clock regression, disconnection and retained adverse outcomes.

Fresh reconstruction must reproduce exact admitted transitions, receipts and source/method identities. A rejection, missing quote or interrupted process cannot be promoted into a completed fill. Local clock and upstream timestamps remain unauthenticated declarations even when the journal is internally consistent. Authored session history is not proof that all external trials were disclosed.

## Outstanding gates

- Native saved-version verification follows the successful ordered build and exact [validation receipt](../validation/signal-session-20261011.json).
- Approved hosted/browser acceptance and public rollout.
- A chosen read-only provider adapter, authenticated data/provenance, licensing and plan/request-budget review.
- Unattended infrastructure, private session authority, resource quotas and scoped external-agent integration if later requested.
- Public forward-artifact publication, independent qualification and complete search/holdout evidence.

See the [session methodology](session-methodology.md) and [task specification](tasks/006-continuous-demo-session.md). This increment makes no profitability or always-on hosting promise.
