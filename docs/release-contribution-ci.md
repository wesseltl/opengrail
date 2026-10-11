# Contribution CI release review

Prepared on 11 October 2026. Coordinated local checks and ordered build passed. Native source-save verification follows separately; no public repository, CI execution or deployment is claimed.

## Resulting behavior

The home contribution section links to `/contribute`. The static guide gives humans and externally hosted agents a concrete isolated task-to-review path without account registration, additional requests, credentials or an invented repository link.

The local checker admits the exact two-parent test merge and fixed package scripts, then runs the existing tests, typecheck, build and base-to-merge whitespace check. It retains bounded output digests and terminal failures/interruption without overwriting a previous report. Its report remains AUTHOR_REPORTED, qualification NONE.

The prepared GitHub workflow uses official pinned actions, read-only contents permission, an ephemeral Ubuntu runner and finite timeouts. A trusted workflow step checks the exact checkout and parents before running any contributed installer. No privileged event, production secret, paid inference, deployment or self-hosted runner is introduced. Publishing the workflow or running hosted CI requires the pending maintainer approval.

The separate public GitHub collector reads only fixed resources through unauthenticated GET requests. It retains repository/issue/PR/workflow/run snapshots around collection, complete bounded current-attempt job pages, exact merge parents and source hashes at both head and test merge. A pure validator rejects incomplete, stale, changed, skipped and failed evidence. Trusted hashes are independently reviewed policy inputs; they cannot approve themselves. No contribution artifact or supplied success flag establishes the result.

The result concerns required CI gates at a collected snapshot. It is not an attestation that hostile code could not mutate a runner, a proof of research correctness, a security approval or permission to merge. Offline verification is explicitly an unauthenticated saved-snapshot assessment with freshness not rechecked.

## Local checks

- `npm test`: **773/773 passed**, zero failed, cancelled, skipped or todo cases.
- The73 new cases comprise19 actual isolated Git/npm checker fixtures,25 pure evidence-validation cases,17 collector/file/CLI cases with invented provider responses,8 bounded read-transport cases and4 actual static contribution component fixtures.
- `npm run typecheck`: passed.
- The ordered Sites `build-site.mjs` production build passed before this documentation/receipt finalization.
- `git diff --check`, fixed evaluator fingerprint checks and new-script syntax checks passed.
- Local fixtures include real clean two-parent merges and actual nonzero npm/whitespace exits, source changes, interruption, timeout, bounded diagnostics, FIFO/symlink rejection and durable new reports. They do not run a hosted contribution or prove hostile-code isolation.
- Provider evidence fixtures explicitly invent all repositories, PRs, run IDs and responses. They test changed source/attempts, omitted actual-provider job attempt fields, timestamps, rate/access failure, pagination, skipped gates, trusted hashes, known credential rejection and unauthenticated offline reassessment.
- No real GitHub CI collection/run, browser acceptance, public repository or deployment is established by these checks.
- The initial full run retained772 passes and one existing Demo fixture failure. Under contention the fixture cancelled before its deferred engine callback was registered. Three late-completion fixtures now wait for that actual boundary; production behavior and cancellation assertions are unchanged. The original failed run and its source freeze are retained separately.

The coordinated logs and source freeze are retained outside the checkout; their SHA256 identities are recorded in the validation receipt.

## Preserved boundaries

The private dashboard and its saved source remain untouched. Public onboarding, credentials, scopes, quotas, database migrations, HTTP contracts, evaluator source fingerprints, dependencies and hosting configuration remain unchanged. There is no private/public bridge, Live activation, financial order, public code-execution endpoint or paid inference dependency.

The connected account is `wesseltl`; the owner's domain-ownership statement is retained, without asserting DNS control or domain routing. No public OpenGrail repository was present in the connected owner repository listing on 11 October 2026. License choice, public source export, public audience, custom domain, real browser acceptance and hosted acceptance remain pending.

## Rollback

Before deployment, select the preceding saved v13 source and its matching artifact. This increment changes no database schema or retained record contract. Do not infer an automatic production rollback or change permissions. If workflow source is later approved and published, disabling or reverting it is a separate maintainer action; previous failures and run history must remain visible.
