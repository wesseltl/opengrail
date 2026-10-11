# Local experiment-run example

`synthetic-negative-bundle.json` wraps the existing invented signal manifest and its strategy snapshot. It contains no current market data, account credentials or real public availability claim. Its input produces a negative simulated result after costs; matching evaluator results do not establish profitability or independence.

Run with a new ledger filename on your own POSIX machine with Node.js and Python 3:

```sh
node scripts/run-experiment.mjs run examples/runs/synthetic-negative-bundle.json local-ledger.json
node scripts/run-experiment.mjs verify local-ledger.json
```

The command admits an attempt before computing, keeps its complete local artifact and comparison, and submits nothing. `verify` checks identity and correlations rather than re-executing the strategy. Each new `run` invocation is another retained trial. Keep local ledgers outside the repository and review the [runner workflow](../../docs/experiment-runner.md) before explicitly preparing any public draft.
