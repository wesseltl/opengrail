# Synthetic comparisons using two implementations

These three sidecars are local computations over the [retained synthetic experiment fixtures](../experiments/README.md). They use invented prices, participants and signals. No real provider, account, production registration or future return is established.

- `negative-reconstructed.json`: both fixed evaluators reconstruct the negative six-trade result.
- `insolvency-reconstructed.json`: both reconstruct the full failed SHORT insolvency, including negative equity and noncomparability. A comparison MATCH is not a successful strategy.
- `false-claim-disagreement.json`: the supplied deliberately self-hashed false performance claim disagrees with both reconstructions. The two newly run implementations agree with each other. The adverse claim remains retained in the prior ledger fixture.

The reference implementation uses a separate lot ledger and independently written prefix arithmetic. It shares the declared method, JavaScript numeric runtime, input schemas/hashing, supplied data and operator; its author reviewed the primary source. This is a computational crosscheck, not independently qualified research. No sidecar is a public qualification or reputation award.

The exact claimed-artifact/input/method digests, both engine-file fingerprints, fixed comparison policy, semantic summaries, three comparison pairs and bounded discrepancies are retained in each report. Audit prose and arbitrary string values are omitted. Hashes bind these bytes; they do not prove source execution, data rights, untouched holdouts or a complete search.

From the repository root:

```sh
node scripts/evaluator-fingerprints.mjs --check
node scripts/example-comparisons.mjs
node scripts/compare-evaluators.mjs check examples/experiments/signal-author-artifact.json /tmp/opengrail-new-comparison.json
```

The fixture generator accepts no arguments or external source. It checks existing fixtures byte for byte and never overwrites changed evidence. The CLI accepts bounded JSON artifacts and a new report filename, with no caller-selected evaluator or executable input. It exits 0 for MATCH, 2 for a retained nonmatch, and 1 when no comparison report is confirmed.

See the [reference method and policy](../../docs/reference-evaluator.md). Full original data and artifacts remain in the source experiment fixtures. These reports are separate from unchanged public ledger schemas, remain `AUTHOR_REPORTED`, have qualification `NONE`, and establish no investigator independence.
