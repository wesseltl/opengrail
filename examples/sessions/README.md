# Invented continuous-session examples

Each checkpoint set shares one synthetic virtual-clock history. All contain invented prices and a declared CUSTOM signal, with no real provider, profitability evidence or independent qualification. Their source remains `SYNTHETIC_PLAYBACK`.

- `signal-open.json`: a signal decision followed by a later quote leaves one virtual position open.
- `emergency-awaiting-quote.json`: an emergency disables admissions, while the same position visibly awaits a later quote.
- `emergency-adverse-exit.json`: the later invented adverse quote closes it at a loss after fees and slippage.

The current-source examples are in [`20261011/`](20261011/). Run `node scripts/example-sessions.mjs` to reconstruct that fixed set using the current declared Session implementation. Existing files there must match exactly; the generator refuses to replace differing evidence and accepts no output path or other argument. For example:

```sh
node scripts/session-runtime.mjs verify examples/sessions/20261011/signal-open.json
node scripts/session-evidence.mjs prepare examples/sessions/20261011/signal-open.json NEW_REVIEW.json
```

The three JSON files directly in this directory are historical checkpoints bound to their original implementation fingerprints. Their bytes and identities remain unchanged. The current verifier deliberately refuses them after a source identity changes. Preserve them with their matching source; never repair their fingerprints, recompute their identities or relabel them as current evidence. The new dated examples are fresh synthetic reconstruction, not independent reproduction of the archived journals.

Successful current-source reconstruction cannot authenticate the supplied source or virtual clock. Synthetic playback cannot be started as connected system-receipt intake.

The Session page can stage and reconstruct an exported checkpoint. The command-line runner's `start CONFIG.json NEW_JOURNAL.json` and `resume JOURNAL.json` commands use a local system clock and NDJSON standard input. See [methodology](../../docs/session-methodology.md) for limits and recovery details.
