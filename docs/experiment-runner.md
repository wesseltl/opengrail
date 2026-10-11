# Integrated local experiment runs

This increment connects an exact public experiment manifest to fixed local evaluators, retained attempt evidence and an explicitly prepared outcome. It does not run contributed code on the server, place orders or qualify research. Final source details and coordinated release checks are recorded in the [release review](release-experiment-runner.md).

## What a run establishes

A manifest identifies supplied inputs, a public strategy version, declared source/method identities, costs, baseline and disclosures. A local attempt uses those exact retained inputs; changing inputs creates a different experiment rather than quietly changing the selected manifest. The attempt binds its manifest and strategy references, local evaluator identities and its own attempt identifier before evaluation. This runner requires the manifest's declared primary source digest to match the current pinned primary evaluator; it does not silently run a different declared version.

A completed replay demonstrates what the fixed local implementation returned for those supplied inputs. A comparison freshly runs the primary and separately implemented reference evaluator under the [comparison method](reference-evaluator.md). It retains `CLAIM_PRIMARY`, `CLAIM_REFERENCE` and `PRIMARY_REFERENCE` dispositions, including disagreement. Here the claim is the newly generated primary artifact. This workflow does not compare a previously published historical outcome; the existing `/validation` reader provides that separate check. Matching a new primary result to another primary run must not be presented as confirmation of a historical claim.

Every result and comparison remains `AUTHOR_REPORTED`, with qualification `NONE` and independence `NOT_ESTABLISHED`. The two implementations share an operator, input data, specification, JavaScript runtime, schemas, hashing and source review. Another agent identifier, another sponsor, a matching digest or repeated agreement does not prove independent research, unseen data or authentic market provenance. A match can reproduce adverse, no-trade or failed behavior; it does not establish a profitable strategy.

The manifest's evaluator source fields are author declarations. Local source fingerprints identify the fixed code used by this workflow and must be distinguished from those declarations. Neither local timestamps nor server registration time prove that a hypothesis preceded data inspection or that a reported holdout was untouched.

## Attempt history and rejection evidence

An attempt is admitted with a stable identifier and exact manifest/source snapshots before evaluators start. Its input request identifier and a later public command's request identifier serve different purposes. A genuinely new local run remains a separate retained attempt even if its deterministic artifact matches a previous result. Public outcome retries preserve their original command identifiers and material rather than admitting another publication.

Retain completed, negative, no-trade, halted, rejected, failed, cancelled and interrupted attempts. A crash must not turn an unfinished run into success: explicit recovery gives an abandoned running attempt an interruption disposition. The sponsor can instead explicitly execute a still-pending admission using its existing identifier. After a terminal interruption, another run is a separate attempt rather than replacement of the earlier evidence. Admission and result bounds must preserve room for adverse terminal records; reaching capacity stops new work instead of deleting old failures.

Malformed UTF-8, duplicate JSON keys, oversized input, missing public records, wrong source/manifest digests and unexpected evaluator failure are useful rejection evidence. Use bounded reason codes and hashes where available; do not echo raw credentials, supplied paths, exception text or arbitrary malformed documents into diagnostics. A raw-input hash, if retained, identifies those bytes and is not proof of accepted evaluator input.

A valid local artifact can exceed the public registry's separate 512 KiB limit. Keep the complete bounded local artifact and prepare an explicit `ARTIFACT_UNAVAILABLE` report when appropriate; do not truncate a result or omit losing trades to make it fit. An artifact with no accepted input cannot be published as if it matched the manifest. An interrupted run has no invented metrics or successful reproduction claim.

The ledger covers the attempts admitted by this runner under its finite limits. It cannot prove that a sponsor disclosed all other searches, deleted no external files, used no other processes or kept a holdout unseen. Preserve the original manifest's search disclosures rather than automatically replacing them with a claim of complete search history.

For a declared chronological training/test protocol, use the [frozen-plan workflow](chronological-plans.md). Each partition registers and runs its own exact manifest; the full original manifest cannot accept a partition artifact. Keep the plan and both adverse run histories together. Chronological separation of already supplied/public inputs does not establish genuinely unseen data.

## Browser workflow

The integrated experiment UI reads an exact currently visible public manifest and strategy, requires permission to use the supplied data, and runs fixed trusted code locally. It retains attempts in page memory and offers explicit export. No result is automatically posted to the public registry.

Current source/parent visibility and exact digests are checked around local work. A discovered withdrawal or suppression invalidates pending callbacks and dependent authored payloads, sidecars and drafts. Cancellation, logout and unmount must not let stale asynchronous work revive content or publish an outcome. Earlier downloaded copies cannot be recalled, and memory history is not durable after leaving the page.

A transient post-run read failure retains the verified computation as `UNCONFIRMED` local evidence while withholding metrics and use until a successful fresh visibility check. An observed suppression instead clears dependent payloads and retains safe attempt metadata. Neither case substitutes a successful result or silently deletes the attempt.

Preparing an outcome is a separate action from running or comparing. It selects an exact retained artifact or an explicit interrupted/unavailable disposition and opens the existing publication form. All policy, data-rights and public-sharing checkboxes start false. The reader reviews the public payload and claim/dependency declarations before an explicit submission.

The prepared initial report uses `ORIGINAL` with no related outcome. It means a newly computed local report, not manifest ownership or independent research. This workflow does not automatically prepare a `REPRODUCTION`/`SUPPORTS` or `CONFLICTING` claim about a historical outcome. A matching primary pair alongside an implementation disagreement must retain that disagreement; a comparison cannot silently choose the favorable implementation. Existing `SAME_AUTHOR` and `SAME_SPONSOR` cautions compare the reporter with the manifest author and do not establish independence from other participants.

The existing public outcome schema accepts the artifact or an explicit interruption/unavailable disposition; it has no comparison-sidecar attachment field. The full comparison therefore remains a separate local export. Prepared conflict/dependency text includes the actual comparison disposition, report digest and all three pair difference counts when available, explicitly as an author report with no qualification or established independence. That bounded summary is editable public claim text, not the sidecar or execution proof. Editing a draft does not change the retained local attempt. An outcome's acceptance does not establish that a reader received the comparison or that its result was independently qualified.

## Sponsor-local workflow

The command-line workflow uses fixed trusted repository modules and bounded JSON files on the sponsor's own machine. It takes no investment, exchange, provider or publication token and performs no network request or automatic POST. Input files supply data, never executable paths, arbitrary imports, shell commands or evaluation instructions.

Its durable attempt ledger records admission before computation and persists results under an advisory single-writer lock, bounded atomic writes and receipt correlation. It supports a regular, single-hardlink ledger file on a POSIX filesystem with Python 3 for the existing lock helper. The inherited lock descriptor remains held by the parent process. The runner refuses symlink ledger files, detects a changed prior file digest, writes a temporary complete snapshot and fsyncs the file and parent directory before acknowledging. These checks are not a guarantee against every hostile filesystem operation or storage fault.

The retained event history is logically append-only; persistence replaces the complete ledger snapshot atomically. `verify` checks schema, hashes, correlations and lifecycle ordering. It does not reconstruct evaluator execution or prove that a sponsor never rewrote and rehashed local history. Explicit recovery validates those identities and records a pending attempt as `RECOVERY_INTERRUPTED`. Uncertain persistence is not reported as confirmed success.

The offline input bundle is `{version:1, manifest:<public experiment item>, source:<public strategy item>}`. Exact visible snapshot identities are required, but the CLI makes no live request to establish current visibility or authenticate that these snapshots came from a hosted endpoint. Diagnostics label source authentication `OFFLINE_SNAPSHOT_UNVERIFIED`.

```sh
node scripts/run-experiment.mjs run BUNDLE.json LEDGER.json
node scripts/run-experiment.mjs admit BUNDLE.json LEDGER.json
node scripts/run-experiment.mjs execute LEDGER.json ATTEMPT_ID
node scripts/run-experiment.mjs recover LEDGER.json
node scripts/run-experiment.mjs verify LEDGER.json
node scripts/run-experiment.mjs prepare LEDGER.json ATTEMPT_ID NEW_COMMAND.json --confirm-public-sharing
```

`run` durably admits a new attempt before evaluation; each invocation is a new trial. `admit` persists a pending attempt without evaluating it. `execute` evaluates that exact pending attempt. At most one pending attempt is allowed, so another admission requires execution or explicit recovery first. `prepare` exports a new file containing the existing-schema public command with the retained outcome identifiers, never an HTTP request. Its flag confirms public sharing of the draft, not current source availability or an investment action.

| Resource | Local bound |
| --- | --- |
| Offline input bundle | 384 KiB; strict UTF-8 JSON with unique keys and maximum depth 24. |
| Captured admission | At most 512 KiB of bounded plain JSON. |
| Admitted/rejected entries | At most 16 retained entries; no automatic eviction. |
| Retained run | At most 10 MiB. |
| Complete durable ledger | At most 32 MiB. |
| Admission reserve | 10 MiB for a terminal run, plus the admission snapshot and 4 KiB overhead. |
| Public registry artifact | Separate 512 KiB limit; it does not authorize truncation of a local artifact. |

An invalid bounded bundle receives a safe `INPUT_REJECTION` entry and a raw byte hash when readable bounded bytes are available. That rejection counts toward capacity. If admission or persistence cannot complete, the diagnostic reports an unconfirmed command rather than claiming retained evidence. Evaluator interruption is cooperative; a synchronous computation cannot promise immediate reaction to a signal.

CLI output is bounded metadata: attempt/ledger identifiers and digests, run/artifact/comparison dispositions, confirmation boundaries and disabled execution. A process exit code is not a performance rating: `0` denotes the confirmed successful command path, `2` denotes a retained input rejection, non-matching/incomplete comparison or rejected/failed artifact, and `1` denotes an unconfirmed command failure. A negative-return result can therefore exit `0` when its local comparison matches. Numerical disagreement and failed artifacts remain evidence rather than being rewritten to obtain a successful exit.

Prepared outcome commands use the existing [experiment API](experiment-api.md). They contain public material, require deliberate review/consent and preserve their command identifiers for an identical retry by the same authenticated author. Another author cannot use a request identifier to inherit the original receipt, identity or permissions. A changed payload needs a new public request identifier; an uncertain response must not trigger a fresh publication automatically.

The [synthetic negative example](../examples/runs/README.md) wraps the existing invented signal manifest and exact strategy snapshot. Running it retains a loss after costs and matching local implementations. It supplies no current market data, real hosted availability, authentic provider or profitable strategy evidence.

## Remaining qualification and rollout work

This workflow closes a local data handoff and preserves admitted failures. It does not complete an independent experiment registry, durable external search evidence, hidden-data controls, research qualification, risk-adjusted ranking, authenticated forward feeds, a public execution service or agent reputation.

Hosted acceptance, moderation/retention policy, public rollout and any future resource or permission expansion require maintainer review. External compute, paid data and hosted agents are not assumed free or authorized. Existing publication permissions do not grant financial access, private workspaces, privileged execution or automatic deployment of a successful strategy.

