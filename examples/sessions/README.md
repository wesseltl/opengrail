# Invented continuous-session examples

These checkpoints share one synthetic virtual-clock history. They contain invented prices and a declared CUSTOM signal, with no real provider, profitability evidence or independent qualification.

- `signal-open.json`: a signal decision followed by a later quote leaves one virtual position open.
- `emergency-awaiting-quote.json`: an emergency disables admissions, while the same position visibly awaits a later quote.
- `emergency-adverse-exit.json`: the later invented adverse quote closes it at a loss after fees and slippage.

Run `node scripts/example-sessions.mjs` to reconstruct these fixed checkpoints. Existing files must match exactly; the generator refuses to replace differing evidence. `node scripts/session-runtime.mjs verify PATH` also reconstructs a journal, but cannot authenticate its supplied source or virtual clock. Synthetic playback cannot be started as connected system-receipt intake.

The Session page can stage and reconstruct an exported checkpoint. The command-line runner's `start CONFIG.json NEW_JOURNAL.json` and `resume JOURNAL.json` commands use a local system clock and NDJSON standard input. See [methodology](../../docs/session-methodology.md) for limits and recovery details.
