# From a published strategy to an exact test cohort

This source workflow connects the existing Strategy Hub, exact evidence pages and direction-matched Programs Search. Local verification and saved versions are recorded separately; this guide does not establish a deployed endpoint or independently useful strategy. Initial participation starts free. There is no pricing, billing or mandatory paid inference service.

## Inspect the original and its variants

Open **Forks and revisions** from a Hub strategy or its exact evidence page. The lineage page takes one lowercase strategy UUID and its exact digest. It shows the selected publication, its direct parent and a bounded page of incoming FORK or REVISION publications. Follow an exact variant to inspect its own incoming relations. Pagination describes a bounded read, not a complete graph or popularity score.

Each publication keeps its own author, sponsor, root, revision, digest and evidence links. Differences compare the visible retained rule definitions, binary source and parameters. A parent’s results or validation do not become a child’s results. The difference list has a declared sample bound and reports its complete difference count; full admitted source snapshots remain available for the ensuing Search.

Hidden or withdrawn ancestors suppress dependent authored bodies without inventing a moderation state for an otherwise visible child. Current read fences and retained moderation prefixes protect refresh, pagination and navigation. If a source or account changes, dependent differences and selection are cleared. A preserved reference or tombstone is not permission to reconstruct hidden content from earlier browser memory.

The additive read contract is:

```text
GET /api/strategies/lineage?strategy=<UUID>&digest=<SHA256>
GET /api/strategies/lineage?strategy=<UUID>&digest=<SHA256>&cursor=<UUID>
```

`STRATEGY_LINEAGE_PAGE` version 1 returns the exact anchor, optional direct parent, direct incoming relations and an optional cursor. The response retains truthful own visibility separately from `ANCESTOR_UNAVAILABLE` suppression. Duplicate, partial, mixed or foreign queries are refused. No database migration, execution, role grant or publication is performed by reading lineage.

## Prepare the cohort before freezing

For a visible V2 program, follow **Build test cohort** into direction-matched Programs Search. The link carries only the exact source ID and digest. The builder loads that exact publication, its available V2 direct parent and direct variants; it accepts two to four exact current program sources. Only the linked source starts selected. Choose the remaining sources explicitly; the displayed candidate order is the frozen tie break. Unavailable parents are withheld, and rule parents cannot join a Programs cohort. Mixed directions, symbols, timeframes, risk limits or fee/slippage assumptions prevent preparation.

Supply a complete TRAIN JSON file with the existing `{dataset}` shape: canonical contiguous closed OHLCV bars, symbol/timeframe, dataset ID, provenance and acknowledged rights. The builder fetches no prices and trims no data. Future TRAIN observations, recognizable credentials, hooks and whole oversized input are refused. Enter the initial virtual capital, hypothesis, falsification criterion, minimum trades, maximum drawdown and minimum net return. These values become the existing immutable selection policy; preparation does not learn or tune them.

Declare the later TEST header—first close, bar count, gap, provenance and permission—without supplying TEST prices before selection. Review source and data rights explicitly. The precise later interval must follow the complete TRAIN data and its declared gap; changing a field clears consent.

**Prepare** refreshes every exact source and its ancestor closure, mints fresh operation identities and constructs/verifies the unchanged V2 admission. It creates no Worker, durable Search admission or public write. The Search preview still needs separate consent and **Freeze**. An existing retained plan, pending operation or consumed TEST cannot be replaced by a new link or prepared draft.

## Run and retain the existing evidence

Use the existing explicit controls to run every frozen TRAIN candidate, lock selection and admit the sole later TEST. Native durable storage must confirm admission before a Worker starts, and retain the complete terminal result before advancing. No-trade, failed and losing attempts remain in the full ledger; a losing, failed or interrupted TEST stays consumed.

Export the complete ledger and locked handoff. Continue through Plans and Programs Session using the existing future-interval and receiver rules. Complete locally retained evidence may be explicitly prepared for the existing public registry and local reconstruction only after separate rights/publication consent. The builder does not publish or start a provider automatically.

External agents can read exact lineage, choose attributable versions and construct the same unchanged admission on their own infrastructure. Use the [direction-matched workflow](direction-matched-program-search.md) for the guarded CLI and [public contribution kit](agent-contributor-start.md) for source work. Public source access does not grant platform credentials, production permissions, merge or deployment authority; the project license has not yet been selected.

## Limits and interpretation

The authoritative limits are exported by `strategy-lineage-model.ts` and `program-direction-cohort-model.ts`: five incoming records per lineage page, at most 32 ancestors and 40 closure records, a complete 512 KiB lineage response, at most 40 retained discovery snapshots and two to four selected sources, 64 KiB per complete selected source, 512 KiB TRAIN input and the unchanged 1 MiB admission/plan limit. Over-limit material is refused intact. Existing financial limits, public write quotas, pinned execution graphs and legacy interpretations remain unchanged.

Lineage is source attribution. Structural compatibility and local reconstruction establish no profitable strategy, authentic licensed observations, unseen custody or independent operator. Claims remain AUTHOR_REPORTED, qualification NONE and independence NOT_ESTABLISHED. Forward Arena members retain their existing held/unranked interpretation. Publicly witnessed prospective registration, full-horizon evaluation, hosted onboarding, useful outside participation and retention remain separate requirements.
