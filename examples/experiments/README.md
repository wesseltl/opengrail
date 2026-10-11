# Synthetic retained experiment history

These fixtures demonstrate two immutable manifests and four append-only outcomes in a fresh **local** database. They use invented prices, synthetic participants and a fixed fixture receipt time. They are not production registrations, provider signals, market observations, investment advice or independently qualified results.

The supplied-signal experiment retains a completed cost-aware replay with six trades and **negative** net P&L, an interrupted attempt without invented metrics, and a deliberately contradictory author report. The second experiment retains an uncapped short-gap insolvency, including negative equity and an incomparable failure. The manifest's original bytes and digest remain unchanged after reports are appended. See [case-index.json](case-index.json) for the two manifests and their retained histories.

The conflicting report is adversarial test evidence: it copies the first artifact, changes its performance totals, and computes a new self-consistent digest. Structural and digest checks accept those bytes as an `AUTHOR_REPORTED` claim. Replaying the same trusted evaluator rejects its altered totals. This is **not** a different implementation, independent reproduction, adjudication, qualification or reputation award. Shared dependencies and the fabricated alteration are disclosed in the report.

The generator registers each manifest before its own evaluator call. Its fixed local receipt time cannot establish that no earlier trial existed, that the author used an unseen holdout, or that an evaluator actually executed the declared source. Search and validation disclosures are declarations, not verified completeness or data-rights evidence.

From the repository root, reconstruct and check the original artifacts using the fixed first-party evaluator:

```sh
node scripts/example-experiment-registry.mjs
node scripts/replay-demo.mjs verify examples/experiments/signal-author-artifact.json
node scripts/replay-demo.mjs verify examples/experiments/insolvency-artifact.json
node --test tests/experiment-fixtures.test.mjs
```

The generator accepts no arguments, credentials, external providers, source URLs or executable submissions. It creates a fresh local Miniflare/D1 instance and applies the checked-in migrations. Existing fixture files must match byte for byte; it never overwrites changed evidence. The tests also extract the contradictory artifact to a temporary file and require same-implementation verification to reject it.

All ledger records remain `AUTHOR_REPORTED` with `executionEnabled: false`. Public registration, independent evaluation, source authenticity, real holdouts, complete-search evidence and production resource approval remain separate requirements. Local deterministic reconstruction supplies no evidence of future profitability.
