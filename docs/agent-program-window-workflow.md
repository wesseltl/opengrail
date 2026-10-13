# Prepare an agent-local sampled Demo window

`scripts/prepare-program-window.mjs` connects the existing direction-matched V2 Search CLI to one prospective sampled Demo input. It prepares files on sponsor-chosen infrastructure without a particular model or paid inference service. It runs no program guest, provider, receiver or public API, and grants no execution, source-registration or investment authority. Live and orders remain disabled.

The complete ledger, handoff and final input must each fit **8 MiB**. This fitting-file tool does not support every theoretical 164 MiB Search ledger or larger forward plan. It refuses the entire original rather than removing a losing candidate, shortening a TEST or exporting only the winner. Larger complete histories stay in the existing file-only methods; do not describe a refused input as prepared.

## Keep the original backtest history

Use the existing [direction-matched Search workflow](direction-matched-program-search.md) to freeze candidates, run every TRAIN, lock its choice and admit exactly one separately supplied TEST. Retain the complete original ledger. A losing, failed or interrupted TEST stays consumed and may remain in the forward handoff; a pending attempt or NO_SELECTION cannot produce this plan.

Preparation verifies retained identities and correlations. It **does not rerun TRAIN/TEST**, authenticate supplied data or publications, prove unseen custody, or establish strategy profitability. Use the existing explicit Search reconstruction if that computation is needed and retain its complete original/fresh results separately.

## Explicit future setup

Create a private JSON SETUP file with exactly these fields:

```json
{
  "startsAt": "2027-01-01T12:00:00.000Z",
  "endsAt": "2027-01-01T14:00:00.000Z",
  "pollMs": 120000,
  "cycles": 62,
  "warmupBars": 2,
  "sourceMode": "SYNTHETIC_RESPONSES",
  "rights": {
    "kind": "AUTHOR_DECLARED_RIGHTS",
    "verification": "NOT_ESTABLISHED",
    "marketDataUseApproved": true,
    "rawRetentionApproved": true,
    "sharedIpRateBudgetApproved": true,
    "publicSharing": "NOT_CONSENTED",
    "note": "Invented local exercise data; no permission for an actual provider is implied."
  }
}
```

Those dates are illustrative. Supply a genuine future interval aligned to the selected timeframe, later than all retained Search clocks, with at least 60 seconds of lead left when the file is published. The unchanged sampled protocol checks active slots, the two closeout slots, polling/cycle budgets and feasibility. This two-hour example fits an hourly strategy with 120-second polling; it does not choose suitable warmup for a particular program or guarantee observations will arrive in time.

The tool supplies the actual process preparation clock, a new random session ID and all six current physical component declarations. Caller-supplied preparation clocks, IDs, hashes, provider URLs, tokens, commands and additional fields are refused. Capital, winner, costs, risk, parameters and the whole Search history come unchanged from the ledger. Rights are explicit author declarations; provider licensing and data-use permission must be established separately.

`SYNTHETIC_RESPONSES` labels invented observations. The existing public controller CLI refuses this mode because it exposes no synthetic fetch seam. It cannot silently become an actual provider run. `PUBLIC_HTTP` means separately authorized market snapshot operation and does not itself supply permission or authenticate observations.

## Prepare and inspect

Run from a reviewed checkout with its existing local dependencies, supported Node runtime, Linux `/proc` and filesystem synchronization. Use absolute canonical paths outside both checkout and working directory. Files must be current-user-owned regular mode-0600 files with one link, without symlink ancestry; their immediate parent directories must be current-user-owned mode 0700. Inputs are strict duplicate-free UTF-8 JSON; BOM, credentials and unsafe file types are refused.

```sh
node scripts/prepare-program-window.mjs prepare /private/run/search-ledger.json /private/run/setup.json /private/run/new-window-input.json
node scripts/prepare-program-window.mjs verify /private/run/new-window-input.json
```

The new output must not exist. Publication uses a private exclusive staged file, file/directory synchronization and exact readback. Held input identities, compiled import graph and physical sources are checked before and after. If confirmation fails, preserve the original inputs and any possibly written output; do not overwrite it or silently replace the operation. Concurrent attempts cannot overwrite the same destination.

`verify` checks the complete V2 prospective input and current local physical component declarations. It is historical consistency checking, including after the planned dates. It does not grant fresh run admission, replay prior evaluations, authenticate public sources, start observation or prove precommit timing. Current source mismatch refuses rather than relabeling old evidence with new hashes. Successful exit confirms this requested file operation; it does not mean a strategy passed TEST or made money.

## Separate observation and report

Review the complete input, data rights and fixed request budget before separately starting the existing [sampled window controller](tasks/039-sampled-program-windows.md). No preparation or verification command starts it automatically. Preserve its original complete raw directory, journal, outbox, ACK clocks and every adverse disposition.

For one complete V2 original, use the [single-run file report](single-program-window-report.md). It freezes the whole fitting context, retains admission before fixed local reconstruction, and keeps full accounting, observation and reconstruction components separately:

```sh
node scripts/report-program-window.mjs report /private/run/original-window /private/run/new-report
node scripts/report-program-window.mjs verify /private/run/new-report
node scripts/report-program-window.mjs recover /private/run/interrupted-report
```

Verification actually reconstructs and checks every component. Recovery records the pending original as interrupted without guest execution; it does not overwrite a confirmed attempt. Preserve all original and partial files after an uncertain result. A new attempt needs a new directory. The whole context, including raw bodies and artifact, must fit 8 MiB; preparation's input cap alone does not guarantee it fits. The conservative 700 MiB attempt ceiling requires available unreserved storage before admission and establishes no universal memory fit. No report command starts a controller, provider or publication, or reruns prior TRAIN/TEST.

The existing [complete browser export](agent-forward-windows.md) and `/forward-windows` remain available for explicit inspection. File-only cohort comparison still requires two to four distinct complete originals; do not invent a second member to inspect one run. A controller `inspect` or V4 journal reconstruction alone is not a complete sampled accounting report. Public sharing remains separate.

All output remains AUTHOR_REPORTED, qualification NONE, independence NOT_ESTABLISHED and source authenticity unverified. Local preparation and synthetic checks establish no hosted availability, authenticated licensed market run, independent evaluation, useful outside participation or financial recommendation. Publication remains subject to the owner and maintainer's existing hold and approval boundaries.
