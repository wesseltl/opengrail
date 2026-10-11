# Task 019 — Exact strategy evidence workspace

Status: source integrated; 1234/1234 coordinated tests, typecheck and ordered build passed. Approved rollout, hosted acceptance and private GitHub setup are not established.

## Observable gap

Strategy links from computational reviews open the catalog instead of the referenced version. The experiment feed cannot discover all retained work for an exact strategy; losses, failures and interruptions require manual knowledge of individual manifests. A definition's immutable UNTESTED field does not describe whether author-reported calculations exist.

## Integrated scope

Prepare an exact strategy workspace at `/strategies?id=UUID&digest=SHA256`, a compact paginated read at `/api/strategies/evidence?strategy=UUID&digest=SHA256&cursor=UUID`, visible links from strategy cards and repaired review references. Preserve ordinary catalog and existing publishing, fork, revision, moderation and uncertain-command behavior. Legacy ID-only strategy links resolve one canonical exact record before pinning its returned digest; they never choose the newest root or fork. Source remains private.

The workspace presents retained manifests AND outcomes for this exact ID/digest, including adverse calculations and tombstones, and links complete records/review threads into the existing Experiments/Validation workflows. It creates no new writer, permission, schema, provider, evaluator, reputation, ranking or qualification. Default roles, private app, quotas, engines, dependencies and hosting configuration stay unchanged.

## Required behavior

- Strict selection queries: reject duplicate, malformed, unknown and mixed parameters. A supplied incorrect digest returns a missing exact version rather than falling back. Resolve beyond catalog pagination and preserve ID/digest in navigation and sign-in return links. Existing declarations and evidence fields keep their original source identities.
- Newest-first retained pages filter by BOTH strategy ID and digest. Page all MANIFEST and OUTCOME types, never root/revision/fork aggregation or profit-based filtering. Cursor identity must belong to the same exact version. Validate same-clock tie order, lookahead and canonical retained payloads, digests, source and parent/related bindings. Unknown targets use 404; corruption uses unavailable 503 without repairing/deleting rows.
- Envelope includes exact current canonical public strategy and at most 20 compact entries. Each entry retains existing summary metadata, caution flags and original outcome claim/relation. Visible batch metrics/baseline and continuous account/inventory/checkpoint observations stay separately typed; negative equity/returns, failure, interruption and artifact unavailability remain visible. Compact projections are server-derived AUTHOR_REPORTED data, not independently hash-authenticated artifacts or verified execution. Complete artifacts remain in existing exact reads.
- Recheck source and parent lifecycle across projection. Current hidden/withdrawn source suppresses all authored names, claims, metrics, checkpoint fields and dependent links. Retain safe metadata. A response that observed suppression cannot later release an older visible projection. Reads are bounded in response bytes, SQL statements and bind parameters; measure actual local boundaries. No eager per-row review queries.
- UI validates strict envelopes, exact source references, ordered pages and duplicates before presenting a page. Stale responses or selection changes cannot restore cached suppressed material. Parent-hidden rows stay tombstones; a workspace source hide/withdrawal clears all dependent results. No browser storage or automatic calls to providers/private application.
- Complete record links go to exact Experiments. Review links use the selected ORIGINAL outcome, or its referenced original for reproduction/conflict, through the existing lazy review workflow. Preserve its canonical currentHead, adverse/hidden head and retained predecessors; no older positive fallback. No new positive qualification badge is created.
- Keep immutable definition verification UNTESTED, report classification AUTHOR_REPORTED, review classification REVIEW_ATTESTATION, qualification NONE and independence NOT_ESTABLISHED. Display no aggregate success rate, high-conviction score, strategy leaderboard or promises. Empty page means no retained public records on that page, not proof of no private/prior tests.
- Compact next-test links use exact version-bound Demo/Session or selected manifest. They perform no evaluation, execution, source retrieval, automatic publication or authority escalation. Existing held-write and form locks block stale navigation handlers; signout/unmount cancel reads and clear dependent content.

## Evidence and rollout

Use actual local D1/Worker and component fixtures with invented actors/inputs. Include cross-version cursors, equal clocks, corrupt lookahead/parent/related/source rows, late hiding, adverse/unavailable/continuous exposure and stale UI selection/review references. Run repository tests, TypeScript, ordered Sites build and whitespace checks; preserve old migration bytes and fixed fingerprints. Record checked source/log identities and source archive provenance separately. No real browser or hosted acceptance follows from local fixtures.

Review source before rollout. This is read discovery/presentation only, with no production configuration or grant change. Roll back to saved version 20 before any rollout and preserve retained experiments and private handoffs. Hosted deployment, public audience, GitHub access and new costs require their separate maintainer approvals.
