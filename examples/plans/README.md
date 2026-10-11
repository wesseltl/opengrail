# Invented chronological example

Every participant ID, strategy/manifest ID, timestamp, visible source snapshot and child record in this directory is invented local example data. No record was registered with a public service, no participant was authenticated and no provider was contacted. These shapes must never be presented as real public receipts.

The fixed local core freezes 12 invented hourly bars into six rising training bars and six falling test bars, with an explicitly optional zero gap. Each starts with 1,000 quote units and fresh indicators, cash, positions, DCA counters and baseline. The unchanged declarative DCA rule has one lifetime entry, total allocation 10%, stop loss 20%, take profit 100% and maximum daily loss 5%. Fee 10 basis points and adverse slippage 10 basis points on each side are **chosen synthetic assumptions**, not measured exchange fees or real fills. Each partition closes its own remaining positions at its endpoint. The returns cannot be concatenated as one funded portfolio.

The actual fixed evaluator reports training net P&L 18.590951905237603 quote units and later test net P&L -26.40840029535684 quote units. Both complete terminal runs retain the exact input, trades, equity, audit and freshly computed primary/reference comparison. Matching implementations establish no independent research or profitable real strategy. Classification stays AUTHOR_REPORTED, qualification NONE, and unseen data NOT_ESTABLISHED. The deliberately constructed dataset was fully available before the plan.

Recreate with no arguments from the repository:

```sh
node scripts/example-chronological-plans.mjs
node scripts/plan-experiment.mjs verify examples/plans/plan.json
```

The generator uses only fixed first-party code, checks both evaluator source pins, and refuses to overwrite differing examples. It evaluates nothing supplied by a contributor. The CLI verification checks exact declaration identity and correlations; it is not execution or server-authentication proof.

- `parent-bundle.json`: invented full visible parent/source bundle.
- `plan.json`: exact frozen split, child inputs and stable registration drafts.
- `train-registration-command.json`, `test-registration-command.json`: unsubmitted drafts, not publication consent from any person.
- `train-invented-child.json`, `test-invented-child.json`: explicitly invented matching child snapshots, not server receipts.
- `train-run.json`, `test-run.json`: actual complete local simulation and comparison outputs under those invented snapshots.
- `case-index.json`: exact identities and adverse result retained alongside the training gain.

The local plan has no server-enforced ancestor relationship. Child records would require separate real registration and fresh visibility checks before use as public artifacts. Nothing here implies an unseen holdout, purge/embargo qualification, complete external search log, automated submission or Live authority.
