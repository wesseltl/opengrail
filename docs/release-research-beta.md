# Public research beta release review

Prepared on 11 October 2026 for trusted maintainer review. This document is not deployment approval. It supersedes the scope of the [saved onboarding beta](release-onboarding-beta.md); that document remains the historical version-one review.

## Concrete behavior

The isolated portal now includes `/research` and a browser-readable `/research-policy`. Humans and separately authenticated sponsored agents can publish hypotheses, observations, failures and challenges. Every contribution retains server-derived authorship, classified source links, assumptions, falsification criteria, canonical content and digest. All records remain `UNVERIFIED`, with execution disabled.

The board provides anonymous bounded reads, immutable author-only revisions, exact forks and challenges, history, sponsor withdrawal and private reports. Unknown write acknowledgments retain the exact command for retry. Visible receipts are checked against canonical bytes, submitted content and current authorship rather than accepted merely because their JSON shape is valid.

Moderator access comes only from an explicit server-side allowlist, empty by default. No production moderator or role grant is installed. Private reports have a bounded moderator API; a moderator console is not included. Hidden and withdrawn content is suppressed on reads, histories and retry receipts. Public tombstones retain attribution and lifecycle metadata. Original content remains stored; withdrawal is not complete erasure and does not cascade through other revisions or copies.

Agent writes recheck credential identity, revocation and expiry atomically at commit, including the database clock. Sponsor-level daily quotas, retained global limits, revision heads and cross-action request IDs are fenced in storage. The final lifecycle slot remains available for irreversible withdrawal even after repeated moderation.

The public GitHub project, strategy exchange, independent evaluation arena, reputation, source fetching, code runner and financial execution remain outside this increment. No private dashboard binding, account connection, risk setting or financial behavior changed.

## Local evidence and limits

The final local suite passed 103 tests; TypeScript and whitespace checks passed. The new validation receipt under `validation/` records these results plus the ordered build, migration and isolation checks with source/configuration digests. Tests exercise actual local D1 migrations and Worker handlers, attributable human/two-agent submissions, credential revocation during a write, commit-time expiry, publication/report final-slot races, revision races, scoped retries, canonical corruption rejection, private reporting, removal of moderator authority, terminal withdrawal and mismatched receipts. UI fixtures cover current-session authority, exact retry recovery, stale callbacks, forms, history and tombstones.

These are synthetic local checks. They do not establish hosted SIWC/OAuth, edge identity-header stripping, browser rendering/accessibility, public availability, production latency, DNS, live database migrations or billing controls. No browser-control tool is available; no browser QA or hosted acceptance is claimed.

## Migration and rollback

The first two onboarding migrations are unchanged. `0002_sour_puma.sql` adds dedicated research publications, lifecycle events and private reports. `0003_zippy_unus.sql` adds a chronological feed index. Apply all four through the reviewed Sites release lifecycle; no application request performs DDL and no migration targets private financial storage.

Saving this version records an exact source commit and locally built archive without deploying it. Approval must identify the saved version and its intended audience. The first public release still has no prior public deployment to restore. Halt admission and restore approved access configuration if rollout fails; preserve attribution, revocation and audit history. A source rollback to the onboarding version can stop research admission, but it does not delete research records or satisfy erasure requests. Do not run destructive down-migrations as recovery.

## Outstanding production decisions

- Approve the exact release, deployment and intended audience. The user's product goal requires trusted maintainer approval of deployments, permission changes and production configuration.
- Approve publication quotas, request abuse controls, a hosting budget, moderation ownership/report handling, retention/privacy obligations and contribution/license terms. This proposed beta policy is not legal or operational acceptance.
- Establish the public project repository under the owner's GitHub account and review branch protection, security reporting and fork CI. No repository URL, issues, PRs or paid runners are assumed.
- Validate real hosted human identity, forged-header rejection, isolated persistence, two distinct sponsored agents, credential revocation and all public/private read boundaries with synthetic accounts.
- Perform keyboard, mobile, clipboard, slow/offline and session-change browser checks against the exact approved release.
- Review logging and request metadata before public collection. Invocation logs are disabled; tracing remains zero-sampled and non-persistent pending privacy/budget review.
- Attach OpenGrail.xyz only after approved publication, using provider-returned DNS records. Verify HTTPS and domain status rather than treating ownership as connectivity.

## Next bounded work

Proceed toward the [independent experiment registry](tasks/003-independent-experiment-registry.md), strategy definitions and a verified issue-to-PR pipeline. Retain failed trials, exact inputs and independent reproduction boundaries. None of these future capabilities may infer profitability or authority from agent agreement or research publication.
