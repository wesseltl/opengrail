# Locked search to forward Demo

Search can export the complete locked result for a new forward Demo. Session imports it, checks the current public strategy, and keeps the exact selected strategy, capital, costs and risk. Failed or interrupted TRAIN attempts and the sole adverse or interrupted TEST remain in the handoff. Changing the setup abandons the locked context. A hidden or withdrawn source prevents dependent exports.

The ordinary receiver configuration stays unchanged. A separate `LOCAL_FORWARD_DEMO_PLAN` binds its canonical digest, current evaluator and Session source identities, complete `LOCKED_SEARCH_HANDOFF`, new data-rights acknowledgement, prospective interval and finite poll budget. The interval must begin strictly after preparation and all retained search clocks. These clocks are author declarations; local digests and a future date do not establish independent precommit, data custody, provider authenticity or profitable performance.

The CLI reads Linux private, current-user, single-link regular files with mode `0400` or `0600`, outside this checkout and the working directory. Paths must be absolute and contain no symlinks. Outputs are new exclusive `0600` files; existing evidence is never overwritten. Full ledger retention has a separate 65 MiB handoff and 66 MiB plan budget. The complete fixed first-party compilation graph must remain unchanged, and the existing Session/evaluator source files must match their declared fingerprints. No input chooses imports, commands or provider URLs. Credential-bearing material, duplicate JSON fields, getters and arbitrary authority fields are refused.

Prepare a separate plan from exported handoff/config files:

```sh
node scripts/forward-demo.mjs prepare \
  --handoff /private/run/locked-search.json \
  --config /private/run/session-config.json \
  --starts-at 2027-01-01T12:00:00.000Z \
  --ends-at 2027-01-02T12:00:00.000Z \
  --poll-ms 15000 --cycles 120 \
  --output /private/run/forward-plan.json
```

Choose actual future UTC dates. The CLI supplies the current process preparation clock and refuses an interval that has already begun before publication. It does not start a receiver or collector. Rights, shared-IP rate budget and real provider use still require the existing separate operator acknowledgements.

Historical consistency can be checked later:

```sh
node scripts/forward-demo.mjs verify --plan /private/run/forward-plan.json
```

Verification grants no fresh run admission. `readForwardDemoPlan(path)` exposes the same guarded verification to the recorded collector. `loadForwardDemoModules()` exposes the fixed forward model and ordinary Session journal functions with an async `assertFresh()` guard; `cleanupForwardDemoModules()` removes its private compilation artifact.

The existing Kraken adapter supplies closed bars and sampled last trades. A locked SIGNAL strategy may retain its plan, but this collector cannot supply signals and must refuse it. Completing a finite poll budget does not complete the nominal observation horizon. Warmup bars do not establish forward trades. Missing observations, feed gaps, unmatched receiver inputs, open inventory, losses and incomplete horizons must remain visible; there is no fabricated final quote or forced tail liquidation.

The separate recorded adapter retains bounded exact response-body bytes and normalization clocks before ordinary producer delivery, then checks them against the durable outbox and full reconstructed receiver journal. See [the task contract](tasks/026-locked-search-forward-demo.md) for acceptance boundaries. Synthetic acceptance demonstrates the local evidence path, without establishing real observations, external custody, independent reproduction, evaluation qualification, CI or rollout approval. Orders and Live remain disabled.
