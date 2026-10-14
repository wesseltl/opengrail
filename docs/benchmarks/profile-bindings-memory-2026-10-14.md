# Local memory comparison

All six scheduled runs and independent validators finished with exit 0. Every run retained the same 50-row synthetic dataset, ten requests, and 22 checks.

Primary: application-isolate `usedSize` at `compiled-near-cap-repeated-profile/after`. The previously closed pilots are excluded.

| Pair | Order | Source067 MiB | Source068 MiB | Difference MiB | Observed reduction |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | 067→068 | 548.98 | 123.58 | -425.40 | 77.49% |
| 2 | 068→067 | 569.76 | 123.64 | -446.12 | 78.30% |
| 3 | 067→068 | 549.69 | 123.57 | -426.13 | 77.52% |

All three paired differences are negative. Median signed difference: -426.13 MiB; range: -446.12 to -425.40 MiB.

The full JSON retains every run, pair, position, exact byte value, separate secondary fields, sample counts and acceptance/terminal pins. No retries or extra rounds were added.

These are descriptive local checkpoint observations. They do not certify a peak, total hosted memory, hosted CPU limits, causal benefit, statistical significance, profitability, adoption or deployment. Allocation and garbage collection can affect the observations. The three-pair order is only partially balanced.

Full local results receipt SHA-256: `cae17bd55e1bcdee343e048d4a01356fffb6fb6d867dec4cf09c1111f07023f2`. The receipt and per-run artifacts are retained locally; their public distribution has not been established.

Validation was completed against the original Source068 proposal: 42 targeted tests, 3,018 full-suite tests, type checking, production build and diff checks passed. The application and test files in the ready branch are byte-identical to that tested proposal. Only documentation changed afterward; the completed code checks are reused.

The finite comparison used the same compiled workload, dependency bytes and 50-row synthetic fixture (8,374,010 canonical wire bytes). Run order was 067→068, 068→067, 067→068. Each run used a fresh database and process, with no forced garbage collection or extra warmups. A separate validator checked all ten response bodies, native data, provenance and cleanup after each actual terminal exit.
