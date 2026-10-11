# Chronological training/test plans

The existing `/experiments` runner can evaluate a selected exact registered input. A chronological plan partitions that input into training data, an optional excluded gap and later test data. It freezes two exact registration drafts before computation and uses the same fixed primary/reference evaluators for each separately registered child.

All evidence remains **AUTHOR_REPORTED**, qualification **NONE**, and unseen data **NOT_ESTABLISHED**. The full parent input is already supplied/public. A local timestamp, hash or server registration cannot prove that the author avoided looking at the test data, kept every external trial or specified a hypothesis before inspection.

## Partition rules

Choose the number of initial training bars and excluded gap bars. Each retained partition requires at least two contiguous bars. Zero gap is an explicit choice, not an embargo claim. Excluded bars and signal reasons remain in the exported plan.

Each partition starts with the parent's exact initial capital, strategy, costs, hypothesis and falsification criterion. It computes indicators only from its own bars, carries no cash, positions, indicators or consumed signals from training, and uses the existing batch end-of-data liquidation. This is a pair of cold-start batch tests, not continuous forward trading or one shared account path.

Signals are retained only when their original observation names a retained closed bar and their original availability also lies in the same partition's closed-bar range. An observation in the gap or an availability crossing the boundary is excluded with a retained reason. Timestamps are never clamped or moved to make a signal trade.

An original absolute emergency before the test's first open boundary rejects the plan; it cannot be erased to restart trading after the stop. A stop inside a partition retains its exact time. A stop strictly after a partition's end is recorded as outside that partition. The plan exports this mapping explicitly.

The original search selection, trial count, logs, reuse count, conflicts and access declarations remain captured. A previously COMPLETE search log becomes PARTIAL for the new child drafts because it does not contain these new planned trials. A prior UNSEEN declaration becomes UNKNOWN; prior SEEN remains SEEN. The planner does not fabricate a complete search history or infer independence from a matching evaluator comparison.

## Human workflow

Inspect a visible exact manifest and source, review the partition counts/ranges/exclusions, then explicitly freeze the plan. A changed boundary creates a new retained plan. The page retains at most four one-MiB plans; reaching capacity stops new freezes rather than deleting failures.

A failed freeze retains safe identifiers, disposition and bounded numeric requested cuts where parsing succeeded. It does not retain raw malformed material or claim reconstructible rejected-input history. Completed frozen plans and admitted evaluation attempts retain their exact bounded evidence until observed content suppression or signout clears held payloads.

Prepare the training and test registration drafts separately through the existing form. Every sharing/policy consent starts unchecked. Publication requires the same authenticated participant, visibility checks and sponsor-pooled quotas as ordinary manifests. The two registrations can partially succeed; retain their stable command identifiers and retry an uncertain write identically rather than create replacements.

Only an exact visible child record matching the frozen command can enter the existing rights-confirmed local runner. Retain negative, failed, no-trade, cancelled, unavailable and disagreeing attempts beside successful ones. Training and test can have different durations, trade counts and warmed-up samples: compare the disclosed metrics without presenting an aggregate portfolio return or ranking an unqualified winner.

The original manifest link is local plan provenance. Existing public registrations have no server-enforced original-parent lineage field: original withdrawal does not automatically suppress an independently published child. The UI rechecks original/child/source visibility and clears held dependent payloads on observed unavailability or signout. It cannot recall previous exports or promise an atomic ancestor-visibility fence at the child server commit.

## Sponsor-local agent workflow

Use Node.js 22.13 or newer, installed reviewed dependencies and a local Linux/POSIX filesystem with hard links and directory synchronization. The preparation CLI evaluates nothing, fetches no URL, accepts no execution module and makes no provider, model, account or public API request. The subsequent existing durable run tool also requires Python 3 with POSIX locks.

Keep configuration, snapshots, plans and ledgers outside the checkout or in ignored `work/`. A source bundle has exactly `{version:1, manifest:<public manifest item>, source:<public strategy item>}`. Retrieve these items through the documented APIs; the snapshots are still offline author-supplied evidence to the local tool.

```sh
mkdir -p work/plans
node scripts/plan-experiment.mjs freeze work/plans/parent-bundle.json 150 5 work/plans/plan.json
node scripts/plan-experiment.mjs verify work/plans/plan.json
node scripts/plan-experiment.mjs prepare work/plans/plan.json TRAIN work/plans/training-command.json --confirm-public-sharing
node scripts/plan-experiment.mjs prepare work/plans/plan.json TEST work/plans/test-command.json --confirm-public-sharing
```

The counts above are examples: use counts appropriate for the actual supplied dataset. `freeze` creates a new mode-0600 file and synchronizes it and its parent before acknowledging. It never replaces an existing file. `verify` reconstructs the canonical declarations and checks identity/correlation, not strategy execution, genuine public availability or a complete search history. All diagnostic source authentication is `OFFLINE_SNAPSHOT_UNVERIFIED`.

After explicit separately authorized registration with the existing public API, save each actual response's `item` as a child snapshot. No local tool invents that public record. Verify its expected request ID, manifest ID, source and exact content before making a runner bundle:

```sh
node scripts/plan-experiment.mjs bundle work/plans/plan.json TRAIN work/plans/training-item.json work/plans/training-bundle.json
node scripts/plan-experiment.mjs bundle work/plans/plan.json TEST work/plans/test-item.json work/plans/test-bundle.json
node scripts/run-experiment.mjs run work/plans/training-bundle.json work/plans/training-ledger.json
node scripts/run-experiment.mjs run work/plans/test-bundle.json work/plans/test-ledger.json
```

The fixed CLI rejects the original full manifest, a wrong partition, changed frozen content, symlinks, duplicate JSON keys, invalid UTF-8, known credential prefixes and oversized material. A competing creator cannot overwrite a frozen plan. If synchronization or acknowledgment is uncertain, preserve the file and inspect it before retrying; a file's existence alone is not a confirmed durability acknowledgment.

Each ledger admits its exact attempt before evaluation and retains terminal evidence or recovery interruption. Keep the frozen plan and both complete ledgers together. Preparing either a registration or outcome draft submits nothing; tokens belong only in an explicitly authorized caller's Authorization header, never in these files, URLs or logs.

The [invented local example](../examples/plans/README.md) includes a complete frozen plan, separately labeled fictitious child records and actual local runs with nonzero assumed costs. It demonstrates training gains followed by a test loss; it is not real public registration or measured market performance.

## Remaining validation

This protocol improves reproducible chronological separation. It does not complete unseen-data custody, enforced untouched holdouts, comprehensive external search provenance, independently reviewed reproduction, qualified rankings, reputation, hosted computation or remote signal authority. Live orders, investments and private account access remain disabled.
