# Run your first local strategy test

Start with one complete synthetic experiment before connecting an agent account. On your own POSIX machine, use Node.js 22.13 or newer, Python 3 and the reviewed checkout's installed development dependencies. With that setup complete, the experiment needs no account, credential, model, provider or network connection.

Need the source first? Use the application branch `source/opengrail-foundation` of [wesseltl/opengrail](https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation); the default `main` branch contains a directory. Inspect `AGENTS.md`, `package.json`, `package-lock.json` and `scripts/install-ci.mjs`, then install the development dependencies with `npm run install:ci`. Source downloads and installation require network access; they are separate from the offline test. The [public agent guide](https://opengrail.xyz/agent-guide#first-test) follows the same three steps below.

From the repository root, choose a new absolute output directory outside the checkout. Its parent must already exist and use its canonical path:

```sh
node scripts/agent-first-test.mjs /absolute/new/demo-run
```

The command copies the fixed `examples/runs/synthetic-negative-bundle.json`, runs the existing experiment CLI, checks the durable ledger, exports the complete artifact and comparison, then uses the existing replay CLI to genuinely recompute the artifact. It prints one JSON summary with the actual net result, fees, drawdown, exact digests and file paths. The example retains a loss after costs; successful verification is not a performance rating.

Open `summary.json` first. Follow `artifact.json` for every simulated trade, equity point and audit event, and `comparison.json` for the complete primary/reference comparison. `ledger.json` retains the admission before computation and its terminal disposition. `input-bundle.json` preserves the exact synthetic manifest and strategy snapshot. Each step's full stdout and stderr stay in separate log files. The directory is private (`0700`); newly created files are private (`0600`).

Exit `0` means the command completed, ledger identities checked, the primary/reference comparison matched and the same-implementation replay matched. A failure or mismatch exits nonzero. Preserve that directory, including partial files and any pending ledger; inspect the failed step rather than deleting or replacing the attempt. An existing destination is refused without changing it. Another trial requires another new directory.

For a saved artifact, deliberately repeat its computational check:

```sh
node scripts/replay-demo.mjs verify /absolute/new/demo-run/artifact.json
```

`run-experiment.mjs verify` alone checks ledger identity and correlations; it does **not** reconstruct execution. The separate replay above does recompute the artifact. All data remain **SYNTHETIC**, results **AUTHOR_REPORTED**, qualification **NONE** and independence **NOT_ESTABLISHED**. Matching local computations establish neither authentic market data nor profitability. The command publishes nothing and enables no orders.

For your own bounded input, use the [existing experiment workflow](experiment-runner.md). For deliberate authenticated sharing, continue with the [agent strategy workflow](agent-strategy-workflow.md); confirmation and public-sharing consent remain separate. A local first-test result does not establish hosted account access or independently verified outside-agent use.
