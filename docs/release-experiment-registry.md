# Persistent experiment registry release review

Prepared on 11 October 2026 for maintainer review. The final integrated source passed 304/304 local tests, typecheck and whitespace checks. The ordered build has passed; the prepared source/configuration fingerprints are recorded in the final validation receipt. There is no hosted-acceptance or deployment claim. The saved [local Demo replay increment](release-demo-replay.md) provides the prior implementation baseline; the checks below validate this source increment locally.

## Intended concrete scope

This increment adds immutable persistent experiment manifests and an append-only `AUTHOR_REPORTED` outcome ledger. Exact public strategy snapshots, supplied replay inputs, method/source identities, declared baselines, hypothesis/falsification and bias/conflict disclosures must remain reconstructable under bounded intake and storage. Negative, failed, no-trade and unreported experiments must not disappear behind a selected success.

Public registration creates no independent qualification, unseen-holdout proof, verified search completeness, strategy ranking, reputation, financial permission or server replay. The application must fetch no arbitrary submitted sources, execute no uploaded code and import no private financial state. Public submission authority remains attributable and narrowly scoped.

See the [API contract](experiment-api.md), [candidate experiment policy](experiment-policy.md) and [Task 003](tasks/003-independent-experiment-registry.md). The frozen contract uses compact 20-item pages and individually bounded full records. Its proposed limits are 768 KiB per request/response, 192 KiB canonical input, 256 KiB manifest, 512 KiB artifact and 576 KiB outcome. Registrations/outcomes share sponsor-day caps of 5/10; retained caps are 250/500, with 32 outcomes per manifest. Reports have a ten-per-day sponsor cap and 500 retained cap; event 16 is reserved for withdrawal. Hidden and withdrawn records count.

These source limits do not establish an approved free hosting budget. Maximum canonical manifest/outcome payload allowances alone total about 344 MiB, before reports, events, indexes, database overhead, parsing/verification work and egress. Intake, retention and request-cost measurements require production resource review before rollout.

## Local validation evidence

The coordinator ran `npm test`: 304/304 passed, zero failed, cancelled or skipped, exit 0, in 28.40 seconds. `npm run typecheck` and `git diff --check` both exited 0. The four owned policy/API/release/task documents separately passed relative-link, trailing-whitespace and final-newline checks, including new files. These are local source checks, not hosted identity, browser or public-launch acceptance.

The ordered Sites build helper completed successfully, running npm run build. The generated Worker entrypoint and isolated storage/configuration declaration were checked after that success. [The final source/configuration receipt](../validation/experiment-registry-20261011.json) records 304 passing tests, typecheck, whitespace checks, build evidence, the additive migration and exact source/artifact fingerprints. No production migration or deployment was performed.

Meaningful checks must cover exact strategy/input/method/baseline correlation; server-derived authorship; cross-principal and cross-action retries; expiry/revocation and visibility races; quota and retained-capacity races; distinct immutable changed-input records and adverse history; incomplete or leaky disclosures without qualification; current hidden-source suppression through nested artifacts and retries; bounded feed/detail and private-report pagination; corruption; byte bounds; and generic diagnostics without input or credential disclosure.

The integrated suite includes 26 actual local D1/bundled Worker backend fixtures and 26 actual-component UI fixtures. Backend coverage includes a retained negative cost-aware result, pooled/global/final-slot races, credential expiry/revocation, canonical changed-input identity, source/parent/related visibility fences, nested retry redaction, private reports, self-consistently rehashed invalid linked-record references and deterministic rejection of unregistered selected sources. Missing internal source/parent links remain corruption503, while a new command selecting an unknown published source/manifest receives404 before mutation. UI coverage includes sponsored suppressed-outcome withdrawal under a foreign parent tombstone, consent resets, exact inputs, uncertain receipts and stale-cache suppression. Local fixtures do not establish hosted or browser acceptance.

The [checked-in synthetic cases](../examples/experiments/README.md) demonstrate two manifests and four outcomes in a fresh local database with invented participants, receipt times, prices and supplied signals. One cost-aware six-trade case retains negative net P&L, an interruption and a deliberately contradictory author report. The other retains uncapped SHORT insolvency and negative equity with an incomparable baseline. Registration receipts preserve the original unreported state and immutable manifest bytes after outcomes are appended. These are local fixtures, not production registrations or genuine provider observations.

The conflicting artifact is deliberately self-hashed and passes registry identity checks while failing the actual same-implementation CLI reconstruction. It demonstrates why accepting an internally consistent artifact cannot qualify performance. `tests/experiment-fixtures.test.mjs` contributes four passing fixtures to the integrated suite for these cases, immutable history, CLI reconstruction/rejection and byte-identical fresh local generation. No successful hash check proves data rights, truthful timestamps or profitable execution.

The retained evaluator version is `opengrail-demo-v1`. The unchanged replay files match saved v4 source `84a1a668ef160bc3c9c4e0596a514b5d15e6dd49`; direct file SHA-256 checks agree with the synthetic case index:

| Material | SHA-256 |
| --- | --- |
| Canonical declared method metadata | `a3e031a6d223ffd7d73095f7ea48827d4386e886813dd9d4a9e0e625acd15572` |
| `app/demo-engine.ts` | `cbc31d441c12a8c3652ddbb1873e9160b574316968889805cdc57aed04597e51` |
| `app/demo-model.ts` | `cecb9e391d3217b2735fa5ccf16c0506d2e0365017beb5454490a6482de307ca` |

These fingerprints identify source/method bytes; they do not prove which source a contributor executed. The new registry schema is the additive [0005 migration](../drizzle/0005_magenta_starbolt.sql), retaining isolated experiment record, moderation and private-report tables. Final source/configuration fingerprints are recorded in the validation receipt. Native saved-version metadata separately identifies the pushed commit and packaged artifact.

## Isolation, retention and rollback

Existing onboarding, research, strategy and local replay behavior must remain intact. Prior migrations and private source must remain unchanged; this increment may add isolated registry tables and an additive migration. No credential grants or production moderator settings are installed by this source task.

Original accepted material and tombstones remain retained. Current hidden/withdrawn sources must suppress dependent public bodies and nested artifact content, while preserving attribution and safe state metadata. Previously exported public copies remain outside that recall boundary. No hard-delete claim or resolved production license/erasure policy is implied.

An approved rollback must disable registry access without deleting evidence, changing prior publication histories or restoring revoked credentials. There is no existing hosted registry service to describe as a tested production rollback target.

## Outstanding gates

- Maintainer approval of production submission scope, intake/storage/egress budgets, quotas, privacy/rights policy, moderation and rollback operations.
- Real hosted identity, public/private boundary, storage, domain/HTTPS and browser/mobile/keyboard acceptance.
- Verified public repository and contribution workflow; no repository URL or published issue is assumed here.
- The rest of [Task 003](tasks/003-independent-experiment-registry.md): durable complete-search evidence, unseen-data controls, independent reproduction, conflicting-result adjudication, conflicts and qualification permissions.

Persistent author reports are an evidence-retention foundation. They do not finish the independent validation arena or supply an investment recommendation or profitability promise.
