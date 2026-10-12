# Programmable selection before TEST

Choose Programs in `/search`, or use `scripts/program-search.mjs` in a reviewed sponsor-local checkout. This page describes the original method. The separately declared [Direction-matched V2 method](direction-matched-program-search.md) supports within-direction SHORT or LONG selection with whole reference trading evidence; it never upgrades an existing ledger. This method is separate from Rules Search V1: its bytes, limits, supplied-signal interpretation and existing forward handoff remain unchanged. A program cohort contains two to four exact V2 sources. Mixed rule/program cohorts are explicitly unsupported.

Freeze the full candidate set, module/configuration identities, common TRAIN OHLCV, market, costs, risk, capital, hypothesis/falsification and fixed selection thresholds. Freeze all operation IDs and a later TEST dataset ID, interval/count, excluded gap and rights declaration. TRAIN and TEST accept datasets only; no supplied signals can masquerade as generator output. No TEST prices enter the plan. Program and trading implementation identities are part of the frozen method.

Each TRAIN runs a fresh configured restricted interpreter on its own exact source. Its actual causal outputs generate signals for the unchanged primary/reference trading methods. Retain the complete original outcome, whole same-implementation reconstruction and comparison: input, configuration, trace, fuel, final globals/bits/memory, generated signals, internal V1 projection and trading evidence. A reproduced trap or fuel failure remains an adverse strategy result. No trades, losses, interruption, mismatch and unavailable computation remain in the ledger.

Selection waits for every frozen TRAIN candidate in order. Eligibility requires completed program execution, matching whole generator and trading comparisons, comparable metrics and the frozen trade/return/drawdown thresholds. Deterministic tolerance and candidate order resolve ties. The lock binds the entire result set. NO_SELECTION blocks TEST. A selected winner receives only one later TEST with unchanged source/protocol and fresh configuration/state/capital. Admission precedes computation; a crash, losing result or interruption consumes TEST and never reopens selection.

## Browser retention

Inspect an admission or the explicitly invented example, acknowledge data rights/trial retention, and freeze deliberately. Programs uses a separate owner-scoped IndexedDB ledger. Transaction completion confirms storage; a successful individual request alone is insufficient. Admission commits before module Worker creation, and complete terminal evidence commits before another phase can advance. Storage failure blocks computation. Reload resumes the retained ledger and offers explicit interruption recovery for pending work; it never automatically executes a guest.

Current account, navigation and public-source suppression fences clear held source/data and dependent exports. Removal of the known local record is attempted; already downloaded files cannot be recalled, and an uncertain removal must remain visible. An anonymous synthetic slot is explicit and does not invent registered public sources. Concurrent tabs use expected-digest history checks; retained terminal results cannot be replaced. Browser-local storage is not independent custody or a witnessed complete external search.

Export the complete ledger and any complete per-attempt program outcome. The latter can be imported into the existing Experiments preparation journey with separate truthful disclosures and public sharing consent. Public record limits remain unchanged and are smaller than local evidence bounds. An oversized complete record is refused intact rather than trimmed; individual public outcomes do not certify complete search history. No automatic POST, provider launch or authority follows a selection.

## Sponsor-local CLI

Requires the reviewed public application source, its existing Node >=22.13 dependencies, Python 3, Linux with `/proc/self/fd`, and a filesystem supporting the required synchronization/locking. Use canonical absolute paths to private regular files outside both the checkout and current working directory; files are data, never executable import paths.

```sh
chmod 600 /private/run/admission.json /private/run/test-input.json
node scripts/program-search.mjs freeze /private/run/admission.json /private/run/new-ledger.json
node scripts/program-search.mjs train /private/run/new-ledger.json
# Repeat once per remaining frozen TRAIN candidate.
node scripts/program-search.mjs lock /private/run/new-ledger.json
node scripts/program-search.mjs test /private/run/test-input.json /private/run/new-ledger.json
node scripts/program-search.mjs verify /private/run/new-ledger.json
```

`admit-train /private/run/new-ledger.json` and `admit-test /private/run/test-input.json /private/run/new-ledger.json` persist without computing. `execute /private/run/new-ledger.json ATTEMPT_ID` accepts only the original pending identity. `recover /private/run/new-ledger.json` records interruption without executing the guest. Keep the original file after an uncertain response and verify it before reconciliation.

The fixed trusted compilation graph and physical program/trading identities are checked before and after evaluation. Bounded fatal-UTF-8, duplicate-free plain JSON, private guarded paths, exclusive writer locking and original-content checks govern local files. File and parent-directory fsync plus exact readback precede confirmed admission/terminal results. This is local retained evidence, not an execution attestation or external operator verification. Exit 0 confirms the requested operation; exit 2 retains an adverse/mismatching/interrupted computation; exit 1 means unconfirmed. A valid completed monetary loss can still exit 0.

Separate program-only limits are 1 MiB admission/plan, 512 KiB TEST input, 22 MiB attempt and 128 MiB ledger, with at most five attempts and sixteen events. Reserve worst-case terminal space for every candidate and TEST before admitting work. Refuse complete excess; never sample adverse traces to fit. Actual filesystem/IndexedDB capacity can still be unavailable.

## Evidence boundaries and remaining work

Classification stays AUTHOR_REPORTED, qualification NONE, generator reconstruction SAME_IMPLEMENTATION_RECONSTRUCTION, independence and unseen custody NOT_ESTABLISHED. Local clocks/digests order this workflow; they do not authenticate data, prove historical TEST was never seen, disclose external tuning or make an operator independent. Source publication is inert and grants no hosted execution, reputation, financial authority or profitable-strategy assurance.

Persistent programmable forward state now has a separately prepared [Plans and Session path](program-forward-demo.md), specified in [task 033](tasks/033-programmable-forward-demo.md). After the sole TEST is terminal, export the complete locked program handoff; failed or losing TEST remains in it. This is local source preparation, not public forward registration or hosted availability. Authentic licensed observations, independently witnessed precommit/custody, useful verified outside contributors, qualification/reputation, hosted onboarding/availability and approved rollout remain required by the full goal. See [task 032](tasks/032-program-search.md). Save-only preparation does not authorize deployment. The prior source baseline is saved version 33; a rollback must retain sponsor-owned adverse evidence and receive maintainer review.
