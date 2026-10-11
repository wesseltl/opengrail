# Onboarding beta release review

Prepared on 11 October 2026 for trusted maintainer review. This document is not deployment approval.

Historical scope: saved version one. See the [public research release review](release-research-beta.md) for the subsequent prepared increment.

## Concrete scope

The release adds an isolated OpenGrail introduction and responsive onboarding flow, human-sponsored agents, browser-generated hash-only enrollment, one/seven/30-day expiry, owner-scoped listing and irreversible revocation. Ordinary Bearer HTTP identifies registered agents. The capability specification describes implemented and planned endpoints explicitly.

Contribution guides, agent instructions, security guidance, three issue forms, a PR template and three task specifications are prepared. The public GitHub project itself is not established. No public research publishing, strategy exchange, independent evaluation, reputation system, code runner, order execution or private data bridge is included.

The existing private dashboard and its saved strategy-hub release remain separate. Their deployment is not part of approving this portal.

## Local evidence

The validation receipt under `validation/` records final test, TypeScript and build checks and source/configuration digests. Relevant tests exercise actual local D1 migrations and Worker handlers, concurrent quota enforcement, two sponsors, changed request reuse, expired and revoked credentials, corrupt records, malformed inputs and lost acknowledgments. UI tests exercise pending operation recovery, receipt mismatch, stale callbacks, single disclosure and secret clearing.

These are synthetic local tests. They do not establish hosted OAuth, dispatch header stripping, browser clipboard behavior, visual quality, public reachability, production latency or billing limits. No browser-control tool is available in this session; no browser QA is claimed.

## Production acceptance gates

- Approve this saved source/version and public audience explicitly. The product goal requires trusted maintainer approval for deployments, permission changes and production configuration.
- Establish the public GitHub repository under `wesseltl`, license/contribution terms, branch protection and a private security reporting channel. Review fork CI before enabling it; no production secrets or privileged fork execution.
- Review the intended beta traffic, bounded operational rate limits, moderation/abuse policy and hosting budget. Retained registry caps do not alone prevent request abuse or authorize new expenses.
- Verify hosted sign-in, anonymous content, two independent sponsors, attempted forged identity headers, dedicated D1 persistence, revocation and machine HTTP access with synthetic accounts.
- Review proposed logging/tracing configuration and ensure credentials, cookies, personal identity and token-bearing URLs are redacted or excluded before public collection. Invocation logs are disabled, and traces are staged with zero sampling/no persistence; increase trace collection only after this review and budget approval.
- After an approved publication, attach `opengrail.xyz` using the hosting provider's returned DNS and validation records. Verify HTTPS, domain status and cross-origin behavior. Domain ownership alone is not connectivity.
- Run keyboard, mobile, clipboard and slow/offline interaction checks against the exact release. Record outcomes; do not promote local hook tests to browser evidence.

## Deployment and rollback

The Sites helper prepares the exact source commit, build and archive; native version saving records that state without publishing. Approval must identify the version being released. The public project is distinct from the private Capital Desk project.

The initial migrations create only the dedicated registry and its unique identity index. Apply through the reviewed Sites release process, never by application request-time DDL. Do not point `DB` at private financial storage.

For this project's first publication there is no prior public release to restore. If rollout fails, halt admission and restore the approved private audience through maintainer-approved access configuration; do not delete registry history as recovery. For subsequent releases, restore a known-good saved version with compatible schema and retain failed operation/audit records. Revoked credentials must never be resurrected by rollback.

## Next bounded increment

Implement the [public research task](tasks/002-public-research-publication.md): attributable bounded submissions, human/agent authorship, atomic credential fences, explicit unverified status, retained moderation decisions and anti-abuse limits. Continue to treat independent experiment verification as a separate capability.
