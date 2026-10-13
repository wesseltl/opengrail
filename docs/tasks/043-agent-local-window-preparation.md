# 043 — Prepare a sampled Demo window from an agent's Search ledger

Status: source implementation. Check outcomes are recorded separately; this specification is not proof of successful execution or hosted acceptance. This is a bounded increment toward the current [product goal](../../PRODUCT_GOAL.md), not completion of the full signal-to-report workflow. Baseline: `aa8ea4cbdc5a4122bb6a689c801e04277eee707d`.

## Behavior

Provide a supported file-only command for an agent to turn its complete direction-matched V2 program Search ledger into a prospective sampled Demo input. Reuse the existing locked handoff, planner, schedule and physical-source guards. Keep every candidate, TRAIN disposition and the sole terminal TEST, including losses, failures or interruption. Freeze the selected program, capital, fees, slippage and risk without modifying them.

The tool supplies its actual preparation time, fresh session ID and locally derived implementation fingerprints. Operator setup supplies the future interval, polling/cycle/warmup choices and explicit data-rights declarations. Preparation runs no guest, starts no provider, creates no credential and publishes nothing. Starting the existing controller is a separate operation.

This first command supports complete inputs up to 8 MiB, matching the existing planner. An oversized whole ledger or output is refused; never trim it or advertise the larger Search ledger allowance as supported. Supplied external SIGNAL strategies and legacy program selection are separate paths.

## Acceptance

- Exercise the actual CLI with a complete V2 ledger containing a losing TEST. Preserve its full ledger and all economics; derive current component hashes rather than accept caller hashes.
- Reject pending or invalid selection/TEST histories, changed source/economics, credentials, duplicate JSON fields, malformed UTF-8, unknown setup fields and insufficient actual pre-start lead. Refuse past or infeasible intervals without shifting dates.
- Keep private canonical Linux paths outside the checkout and working directory. Enforce owner, mode 0600, regular file, one link and stable ancestor/file identity. Refuse existing destinations and concurrent publication. Synchronize the new file and parent and confirm exact readback before returning success.
- Recheck original input bytes and the complete trusted compilation/source graph. On interruption, replacement or uncertain publication, preserve originals and any partial output; never automatically delete, retry or rename an uncertain result as confirmed.
- Read-only verification checks the complete frozen input and current implementation pins. It does not reconstruct TRAIN/TEST, authenticate a public source, start a controller or certify market-data rights.
- Run meaningful targeted boundary tests and the required `npm test`, `npm run typecheck`, `npm run build` and `git diff --check` after the final change.

## Remaining workflow

Use the existing sampled controller, complete archive export and explicit browser inspection or two-to-four-member file comparison. A supported single-original file-only accounting report remains separate work. This preparation increment alone does not prove an actual forward horizon, independent evaluation, usability, authentic licensed data, standalone production authentication or product demand.

Preserve all 64 protected execution-source leaves, the immutable staged application and private Capital Desk. Publication remains on hold; no provider operation, new grant, quota change, live order, deployment, paid service or outreach follows from these checks.
