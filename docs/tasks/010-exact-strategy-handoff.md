# 010 — Exact strategy handoff into Demo and local Sessions

Status: implementation integrated; 653/653 coordinated tests, typecheck and build passed. Native source-save verification follows separately; no public deployment. This connects existing strategy, replay and sponsor-local runtime capabilities; it does not establish a connected provider or public deployment.

## Problem and intended behavior

Choosing a strategy in the hub currently loses its exact identity when moving to Demo or Sessions. A catalog limited to its latest page cannot reliably find an older version, and starting the local receiver still requires manually constructing its configuration. Carry the exact public ID and digest into the existing pages, then export a reviewed, consented receiver setup without starting a browser session or granting execution access.

## Scope

- Offer fixed relative Demo and Session links on visible strategy cards. Bind the immutable ID and digest; do not select the latest revision implicitly or link unavailable authored content.
- Parse a bounded, unique, complete `strategy` / `digest` query reference. Reject malformed, duplicate, incomplete or unknown query fields. Never fetch a caller-selected URL, execute query text or accept credentials in the handoff.
- Resolve an exact source through the existing same-origin public detail API, independently of catalog pagination. Verify strict metadata, visible state, full canonical record hash and the requested reference. Suppression, altered content and a different revision must not fall back to a more convenient source.
- Loading the reference selects rules only. Rights confirmations remain unchecked, and no synthetic data generation, replay, journal creation, provider connection or publication occurs automatically.
- Fence detail reads and held inputs against navigation, catalog refresh, source suppression, signout and unmount. Before public-source replay or export, confirm current visibility and content; retain safe adverse/interrupted attempt metadata when dependent payloads are cleared.
- Before a browser journal exists, allow an explicit export of a reviewed `SYSTEM_RECEIPT` local receiver configuration for the exact public strategy. Require finite capital, supplied source label, data permission note and explicit rights acknowledgement. Preserve strategy rules, risk and costs exactly. Keep `ordersEnabled` and `liveEnabled` false.
- Freeze the exported session ID and configuration until the setup changes. Re-exporting the same setup is not a new session; changes reset rights and discard the old draft. Creating a file starts no process, journal, event intake or financial action.
- Fresh source checks before and after preparation, together with captured setup and lifecycle identities, must precede the download. Do not place producer/owner/agent credentials or private account material on the public page or in its configuration.

## Acceptance evidence

1. A hub link carries the selected immutable revision, including an older source outside the first catalog page. The receiving component selects only that exact visible content and never auto-runs it.
2. Invalid query references, missing/hidden sources, forged metadata or rehashed altered records fail without fallback. Navigation, source suppression and stale callbacks cannot resurrect held inputs or exports.
3. All supported rule families and both directions preserve definitions and declared nonzero costs without changing the pinned evaluation methods.
4. An explicitly consented exported configuration passes the actual existing Session configuration and journal constructor, and can be consumed by the existing local runtime. Configuration export itself produces no journal, receipt, price or position.
5. Blank or invalid capital, unacknowledged rights, changed form values, encoded credentials and oversized or accessor-bearing data fail safely. Repeated unchanged exports preserve identity; changed settings require new review.
6. Existing relevant component cases plus meaningful core/handoff/lifecycle fixtures pass. Required coordinated tests, typecheck, build and whitespace checks are recorded. Component fixtures are not real-browser or hosted acceptance.

## Authority and remaining scope

Public API schemas, grants, quotas, database, dependencies, provider budgets, deployment policy and the private application remain unchanged. This source work creates no public webhook, network-to-loopback bridge, account connection, paid service or new permission. A real read-only producer adapter, permitted authentic market data, unattended operation, hosted acceptance and independent forward qualification still require separate work and review.

Use the existing [Session methodology](../session-methodology.md) and [local receiver](../local-session-receiver.md). The full contribution and validation requirements remain in tasks 003, 006 and 008.
