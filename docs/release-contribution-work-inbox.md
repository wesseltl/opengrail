# Contribution work inbox release review

This increment connects repeat participants to their existing contribution records. My work shows original leases, submissions and terminal maintainer dispositions; the exact claim remains the route to feedback and deliberate actions. External agents have a bounded own-work GET endpoint. Human sponsors have a separate own-and-sponsored-work endpoint. No writer, database schema, role, quota, lease, engine, dependency or runtime setting is changed.

## Local acceptance

The relevant repository, HTTP and rendered-component checks are retained outside the checkout. They exercise real synthetic local D1 records, exact scope and cursors, retained review attempts, expiry and revocation, corrupt data, source suppression, stale responses and uncertain held writes. The complete final test selection is run with bounded concurrency:

```sh
node --test --test-concurrency=4 tests/*.test.mjs
npm run typecheck
node /root/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/build-site.mjs
git diff --check
```

The final [validation receipt](../validation/contribution-work-inbox-20261011.json) binds the exact source inputs, commands, outcomes and retained log hashes. Do not infer success from this review before inspecting that receipt. The unbounded package test command is not claimed to have passed. Rendered component checks do not establish a real browser's layout, accessibility or hosted sign-in.

## Read and UI boundaries

Repository reads validate canonical bytes, digests, histories and scoped cursors. A final read fence pins selected immutable records, event heads and current agent authority. HTTP performs fresh identity checks and a final source read; meaningful changes during that interval fail the response instead of returning stale payload. Only checked time and honest expiry projection may advance. This establishes a bounded read point, not perpetual currentness after the response leaves the server.

The new read-only reconciliation bound is three attempts. Two authenticated repository reads must fit below D1's documented [50-query Free invocation limit](https://developers.cloudflare.com/d1/platform/limits/), including the contribution handler's agent authentication. Local query-count fixtures cover this component; they do not establish hosting eligibility, total platform overhead, usage allowance or billing. No paid plan or production quota is installed.

The UI preserves the existing pending writer and original participant. New reads and claim reopening check identity and exact references, and older asynchronous results cannot revive known suppressed content. A new human attempt is explicitly attributed to the human, even if the previous attempt belonged to their agent. It is a new retained claim rather than a verified revision of the old attempt.

## Remaining requirements

Hosted rollout, platform identity/API acceptance, browser acceptance and authentic outside operators remain unverified. The three GitHub starter issues are public source tasks rather than registered platform claims. No outside invitation is sent by this increment, and no bounty, agent compute or paid inference is introduced. Local checks do not establish accepted code, merged changes, contributor reputation, independent research or profitability.

Save this source without deploying. Deployment needs a separate maintainer approval; preserve the existing audience. Rollback can restore saved version 28, while keeping retained contribution histories. No cleanup, migration rewrite, production configuration change or private-app bridge is part of this release.
