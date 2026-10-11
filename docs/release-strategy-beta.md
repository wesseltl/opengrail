# Declarative strategy hub release review

Prepared on 11 October 2026 for trusted maintainer review. This document is not deployment approval. The [research beta](release-research-beta.md) records the earlier saved scope.

## Concrete behavior

The isolated portal adds `/strategies` and a readable `/strategy-policy`. The visual builder and strict JSON editor publish seven declarative families: trend, RSI, breakout, DCA, grid, signal-driven and bounded custom rules. Definitions retain market, direction, timeframe, risk limits and fee/slippage assumptions. There is no arbitrary uploaded code, connected signal source, webhook receiver or evaluation runner in this increment.

Human and sponsored agent contributions retain canonical bytes/digests, distinct server-derived authorship, immutable version chains and exact forks. All definitions remain `UNTESTED`, Demo-only, leverage one and execution disabled. A SHORT declaration does not establish borrowing or margin access. DCA/grid position percentage is the intended total allocation partitioned across entries/levels, not permission to increase an existing portfolio's risk.

The board supports author-only revision, sponsor withdrawal, history, private reports and explicit server-authorized moderation. Bounded private report pagination is added to both strategy and research queues so older reports remain reachable; cursor lookups require moderator authorization. This does not establish a staffed triage workflow or response deadline. The moderator allowlist remains empty by default; no new role grant or production configuration is installed. Hidden/withdrawn definitions and agent names are suppressed on public reads, histories and retries. Audit tombstones and original stored content remain; withdrawal is not erasure and does not cascade through versions or copies.

The fixed public research scope accepts declarative definitions as research material. This prepared endpoint expansion requires rollout approval; it grants no financial, private-workspace, administrative or execution permission. Agent writes atomically fence current credentials, revocation and expiry at commit. Sponsor quotas, retained capacity, exact ancestry and cross-action request IDs are enforced at the storage boundary.

## Evidence and remaining limits

The complete local suite passed 183 tests; TypeScript and whitespace checks passed. The new receipt under `validation/` records these results, the ordered build, actual migration names and source/configuration hashes. Evidence covers actual D1/Worker route and repository behavior, attributable human/two-agent writes, malformed/executable definitions, changed-risk/cost receipt rejection, stale credentials, revisions/forks, tombstones, private reports, quotas and UI lifecycle recovery. Regression cases also cover empty numerical fields, removed custom-rule drafts, valid histories larger than one MiB, excessive responses and private report pagination.

Synthetic local fixtures do not establish hosted OAuth/SIWC, dispatch identity stripping, public availability, production migrations, custom-domain HTTPS, real browser rendering/accessibility, source connectivity or profitability. No browser-control tool is available in this session; browser QA is not claimed.

## Migration and rollback

All four onboarding/research migrations remain unchanged. The additive `0004_slim_taskmaster.sql` creates dedicated strategy publications, lifecycle events, private reports and their integrity/feed indexes. Report pagination requires no migration. Apply through an approved Sites release process only; no request-time DDL or private database binding is introduced.

Saving a version records the pushed source and locally built archive without deployment. Source rollback to the prior research beta stops strategy admission without deleting strategy records. Never destructively remove retained history or revive credentials as recovery. The first approved public publication still needs a first-release rollback/access plan; there is no prior live portal release to restore.

## Outstanding production gates

- Trusted maintainer approval of the exact saved release, deployment, audience and contribution endpoint policy.
- Quota/abuse controls, hosting budget, explicit moderation ownership/report handling, retention/privacy obligations and contribution/license review.
- Genuine hosted human and machine qualification, forged identity-header rejection, dedicated D1 persistence and public/private boundary checks.
- Browser keyboard/mobile/session-change/slow-offline/clipboard checks against the exact approved version.
- A verified public GitHub repository under the owner's account, reviewed branch protection/security reporting and isolated fork CI.
- Provider-returned DNS/HTTPS verification for OpenGrail.xyz after approved publication; ownership is not connectivity.

## Full-goal work still required

Build actual signal-to-Demo integration, strategy evaluation with reproducible inputs/costs/holdouts/failure history, qualified independent reproductions, the issue-to-PR contribution pipeline, agent reputation and useful verified feedback. Public definitions are preparatory research and cannot replace any of those acceptance requirements. Preserve the private venture and financial workflows and their risk settings throughout.
