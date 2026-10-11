# 016 — Trusted experiment reviews

Status: source integrated; 1021/1021 coordinated tests, typecheck and ordered build passed. Hosted acceptance and public rollout are not established.

## Problem and resulting behavior

Exact experiment outcomes retain author reports, but have no durable trusted review. Add an immutable review sidecar and an integrated paired local-review preparation and publication workflow. Preserve original records and adverse decisions. A trusted human attests a computational review; this does not establish independent performance qualification, source truth or unseen data.

## Acceptance criteria

1. Preserve every legacy batch/continuous experiment command, canonical record and classification. Reviews are separate immutable records, with exact original outcome, reproduction/conflict outcome, manifest and strategy ID/digest references, a previous-review reference and atomic sequence. Publish no qualified ranking or contributor score.
2. A separately configured human reviewer permission defaults to none. Moderator, author, sponsor and agent status confer no review publication authority. Routes derive current identities; no submitted author, role, classification or execution grant is accepted. Bind the frozen intended author to the signed-in human before a mutation and recheck current authorization for retries.
3. Batch review evidence retains two complete bounded fixed A/B comparison reports: one for the original artifact, one for the reproduction/conflict artifact. Their exact artifacts, accepted inputs, method, implementation pins, claimed summaries and comparison pairs must bind to the retained records. Hashes alone do not prove execution. Record explicit trusted-human local-run/process attestations and shared dependencies; classification remains a review attestation, qualification NONE and independence NOT_ESTABLISHED.
4. REPRODUCED requires both exact reports to MATCH, supported reproduction lineage, a reviewer distinct from original/reproduction/manifest/strategy sponsors, distinct original/reproduction sponsors and explicit process/conflict review. Matching negative or failed results may be reproduced. DISPUTED retains actual MISMATCH reports. HELD/REJECTED retain typed reasons and notes; shared process, leakage, selected trials, reused holdouts or unsupported continuous methods cannot silently become a positive review.
5. Continuous evidence has no independent reference evaluator. It may receive an explicit unsupported-method hold, without claiming A/B reproduction or changing its original classification. Do not execute any evaluator or contributor code on the server; use pure identity and report checks.
6. Dedicated bounded public reads expose review summaries and exact full records under current source/parent/outcome visibility. Stable pagination, category-bound cursors, canonical rows and lookahead fail closed on corruption. Suppressed review or referenced content exposes no report, metrics, differences, notes or URLs. Retain withdrawal and moderation histories and private reports.
7. Additive local migrations and prepared reviewer configuration require rollout approval; install no production grant or migration. Atomic writes fence exact payloads/digests, current visibility, expected review head, daily/retained capacity and request identity. Identical uncertain retries reconcile current tombstones; concurrent slots/heads and cross-action request collisions cannot duplicate or replace evidence.
8. Integrate review histories into exact experiment reading and link Validation to paired fresh local preparation. Use explicit input rights and separate public sharing consent. No auto-publication, fabricated comparison or inference from imported agreement. Exact links carry IDs and digests, reject mixed/duplicate queries and preserve sign-in context. Preserve frozen bytes/principal across uncertain acknowledgements and scrub observed suppressed payloads.
9. Test actual pure schemas, D1/HTTP authorization and persistence plus controlled component flows, including self/agent/moderator/account-swap refusals, forged reports/lineage, adverse and conflicting results, held biased evidence, concurrency, authorization removal, uncertainty, suppression and corruption. Run required checks and document rollback and actual browser/hosted limits.
10. No private application mutation, provider retrieval, paid inference/dependency, hosting setting, production permission/risk/evaluator change, investment, transfer, commitment, outreach, Live order or deployment.

## Scope and rollback

REPRODUCED is a narrowly scoped trusted-human computational review statement. It is not independently qualified trading performance. Distinct public sponsorship and a checkbox cannot prove operational independence; these limits remain visible. Public agent reputation and independent qualification still need separate policy and evidence.

Retain old records and additive review tables on rollback. A prior release may leave reviews unavailable but must not erase, reinterpret or rewrite them. No rollout, reviewer grant or rollback is performed by this task.
