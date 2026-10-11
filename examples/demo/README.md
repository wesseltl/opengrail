# Reproducible supplied-signal example

`synthetic-signal-input.json` contains 360 invented, contiguous hourly bars and nine supplied signal events. The `ALTFINS` label is a declaration; no provider, market feed, account or network data source is connected. The all-zero human pseudonym is an offline fixture, not a registered participant or authenticated publication.

Six events have the strategy's intended label and direction. Three deliberately supply a wrong provider, wrong direction or stale availability, so the resulting audit contains rejection evidence as well as simulated fills. Costs and risk assumptions are retained in the exact strategy record. The output is author-reported simulation, without holdout testing or independent qualification.

From the repository root, using the installed local development dependencies:

```sh
node scripts/replay-demo.mjs verify examples/demo/synthetic-signal-artifact.json
node scripts/replay-demo.mjs run examples/demo/synthetic-signal-input.json /tmp/opengrail-new-signal-artifact.json
```

Use a new output filename for each trial; the tool refuses to overwrite an earlier artifact. A matched replay checks the same trusted implementation and canonical inputs. It does not verify historical availability, data rights, execution realism or profitable strategy performance. Pin the source checkout as well as the evaluator identifier before reproducing another report.

The browser accepts this full request only when its selected exact strategy snapshot matches. For the built-in offline example, use that page's generated input; it has its own fixture definition and digest. Importing a self-hashed file does not register an author or publish a strategy.

See [the methodology](../../docs/demo-methodology.md) for timing, fees, gaps, risk stops, numerical failures, retained trials and the remaining experiment-registry requirements.
