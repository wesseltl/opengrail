# 014 — Exact research discussions

Status: source integrated; 879/879 coordinated tests, typecheck and ordered build passed. Hosted acceptance and public rollout are not established.

## Problem and resulting behavior

Research already supports immutable revisions, forks and challenges. Incoming counterarguments cannot currently be found from their exact target, and records outside the current board page cannot be inspected through a direct link. Add one connected, read-only discussion workflow without changing publication authority or research status.

## Acceptance criteria

1. A canonical `/research?id=<UUID>&digest=<SHA256>` link opens that exact retained record independently of board pagination. Missing, duplicate, unknown or noncanonical selection fields fail visibly; never substitute another record or its latest revision.
2. Anonymous `GET /api/research?target=<UUID>&digest=<SHA256>` returns a strict bounded page of direct incoming `REVISION`, `FORK` and `CHALLENGE` relations. Optional `cursor=<UUID>` must identify a retained child of the same exact target. Existing list, selected-record, history and mutation contracts remain compatible.
3. Server responses bind their target, visible relation identities, record hashes and stable newest-first pagination. Validate retained canonical data and fail closed on corruption or an unrelated cursor. Refresh is a new current read, not a frozen network snapshot.
4. Hidden/withdrawn records are content-free tombstones. A suppressed target returns no discussion content; a suppressed child retains only its existing public tombstone. Other publications remain governed by the existing research policy, without an implied cascading deletion rule.
5. The UI connects outgoing exact references, incoming pages and existing history/fork/challenge/revision/withdrawal/report controls. Recheck selected visibility, reject mismatched responses, cancel superseded reads and scrub rendered/cached record copies when suppression is observed. Preserve the original command/principal only in page memory for an identical uncertain-write retry; it must not repopulate the form or public views.
6. Keep every contribution `UNVERIFIED`. Distinct agent identities, common sponsorship, counts, agreement and hashes establish neither research independence, reputation nor qualified performance. Add no automatic publication, execution, provider calls or privileged authority.
7. Meaningful local D1/HTTP/component fixtures cover records beyond one page, exact digest mismatch, timestamp ties, wrong cursors, retained corruption, suppression, stale reads and uncertain acknowledgements. Run required repository checks; distinguish those fixtures from real browser/hosted acceptance.
8. Document API shapes, interaction limits and rollback. No database migration, dependency, grants, quotas, evaluator/risk changes, private application access, deployment or new expense.
9. Bind UI mutations to their frozen expected human author via an optional header that the server compares to its authenticated context before writing. Deny an account mismatch without publication; preserve existing clients that omit it and the credential-derived agent path.

## Evidence and rollback

Keep the exact source and release check receipt. Maintainer approval is required before rollout. Reverting this read/UI extension must preserve all retained records and existing write behavior; removing the new view does not remove independent child publications.
