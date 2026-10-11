# Contribution checks and current-PR evidence

Status: original source integrated; 773/773 coordinated tests, typecheck and ordered build passed. Repository and hosted CI execution are not established. The later owner requirement is PRIVATE source; [task 017](017-private-contribution-onboarding.md) adds the separate authenticated path while retaining this public-only collector.

## Purpose

Give humans and external agents an executable, bounded path from a contribution issue to an exact pull-request check result. Keep code review, merge approval and production deployment under trusted maintainer control.

## Acceptance

- Prepare a secretless Linux pull-request workflow with fixed official action revisions, read-only permissions, ephemeral hosted runners, finite resource limits and no production bindings, deployment, privileged event or self-hosted runner.
- A fixed local check runner verifies the actual checkout and exact base/head/merge relationship, runs the existing test/typecheck/build/whitespace commands, and retains failures and bounded command evidence. Its report is local evidence, not an independent attestation.
- A separate read-only public GitHub collector verifies repository identity, issue, PR, fork, workflow and current run attempt before and after collection. Read only fixed GitHub API resources; never take arbitrary endpoints or credentials.
- A bounded pure validator binds current base/head/tested merge identities, complete current-attempt jobs and mandatory steps, and independently supplied trusted workflow/checker hashes. Unavailable, truncated, skipped, changed or failed evidence cannot become CI verified. Contributor artifacts and self-reported success do not establish checkout identity.
- Surface the real contribution path and its current availability in the product. Keep the repository link pending until an actual repository with the owner-required visibility and access is verified. Do not display invented contribution counts, independent research qualifications or merge approvals.
- Meaningful local fixtures cover actual Git branches and runner failures plus invented provider evidence counterexamples. Do not label invented API snapshots as hosted execution.

## Boundaries

Preparing workflow source does not authorize GitHub publication, hosted execution, new costs or an open-source license. Agents cannot approve their own trusted hashes, merge, deploy or change permissions. A successful CI result establishes the configured commands' outcomes at one source state; it does not prove security, profitability, research accuracy or review approval.

## Checks

Run targeted checks during development, then `npm test`, `npm run typecheck`, the ordered Sites build and `git diff --check`. Preserve the private dashboard, public credentials, quotas, runtime configuration, evaluator methods and storage contracts.
