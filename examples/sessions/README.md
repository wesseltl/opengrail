# Invented continuous-session examples

Each checkpoint set shares one synthetic virtual-clock history. All contain invented prices and a declared CUSTOM signal, with no real provider, profitability evidence or independent qualification. Their source remains `SYNTHETIC_PLAYBACK`.

- `signal-open.json`: a signal decision followed by a later quote leaves one virtual position open.
- `emergency-awaiting-quote.json`: an emergency disables admissions, while the same position visibly awaits a later quote.
- `emergency-adverse-exit.json`: the later invented adverse quote closes it at a loss after fees and slippage.

The supported archived examples are in [`20261011/`](20261011/). Run `node scripts/example-sessions.mjs` to reconstruct that fixed set using the exact archived Session implementation in `app/compat/session-20261011/`. Existing files there must match exactly; the generator refuses to replace differing evidence and accepts no output path or other argument. The current verifier dispatches these checkpoints to that archived code and preserves their original identities. For example:

```sh
node scripts/session-runtime.mjs verify examples/sessions/20261011/signal-open.json
node scripts/session-evidence.mjs prepare examples/sessions/20261011/signal-open.json NEW_REVIEW.json
```

The three JSON files directly in this directory are older historical checkpoints bound to a different implementation. They remain unsupported by the current verifier, and their bytes and identities remain unchanged. Preserve them with their matching source; never repair their fingerprints, recompute their identities or relabel them as current evidence. Reconstruction of the dated examples uses their own archived code and does not establish independent reproduction.

Successful reconstruction cannot authenticate the supplied source or virtual clock. Synthetic playback cannot be started as connected system-receipt intake.

The Session page can stage and reconstruct an exported checkpoint. The command-line runner's `start CONFIG.json NEW_JOURNAL.json` and `resume JOURNAL.json` commands use a local system clock and NDJSON standard input. See [methodology](../../docs/session-methodology.md) for limits and recovery details.
