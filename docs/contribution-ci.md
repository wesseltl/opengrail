# Contribution checks

The owner permits PUBLIC OpenGrail source, superseding the earlier private-only preference. The last accepted source snapshot before task 038 is [task 037](https://github.com/wesseltl/opengrail/tree/19128a1a3422690709250725aad41168b7f9e240) on `source/opengrail-foundation`, tree `15572f9aa8cc9e3e1f287d5ca3c3abea28400f5a`, with all 853 file contents and modes verified on 12 October 2026. Starter issues keep their historical `e727f28ad9772abd8f8c165dd016c02c22715fbc` pin; default `main` contains a README directory. The credential-free version-one public collector is the relevant public path. A version-two repository-pinned authenticated reader remains separate for explicitly approved private work. Repository protection, runner allowance and actual CI operation require maintainer review. Source publication and the actual starter issues do not establish a hosted run.

The executable checker and GitHub workflow are prepared in this source. They have been exercised with isolated, invented local Git repositories and tiny npm scripts. The public repository, application branch and starter issues were verified separately; an actual hosted workflow run, contributor branch/fork or pull request, runner allowance and contribution terms have not been established by those fixtures. Preparing these files does not authorize access grants or hosted execution. The [prepared public handoff](public-contribution-handoff.md) can retain a local checker report with CI explicitly absent, without inventing a PR or run.

Use [the contribution workflow](contribution-workflow.md) to prepare an issue and a fork contribution. A maintainer reviews code and approves merges, releases and permissions separately from checking commands.

## Exact source and fixed commands

The local checker requires a clean checkout of the exact two-parent merge commit being checked. Its first parent must be the declared base SHA and its second parent the declared contribution head SHA. It will not substitute a newer branch, a latest commit or the contribution head for the tested merge. All three SHAs are complete lowercase 40-character Git object IDs.

```sh
node scripts/check-contribution.mjs BASE_SHA HEAD_SHA TESTED_MERGE_SHA /absolute/new-report.json
```

The report path must be new, outside the checkout and under a real directory without symlink redirection. The checker reserves it with mode `0600`. Existing evidence and symlink destinations are refused. The command exits zero only when all checks pass and source identity remains unchanged. Invalid arguments or an unavailable report destination fail before admission; they cannot produce a successful check receipt.

The commands are fixed:

| Check | Command |
| --- | --- |
| Test | `npm test` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Changed-source whitespace | `git diff --check BASE_SHA TESTED_MERGE_SHA` |

The whitespace command checks the committed change range. A clean worktree alone does not mean that the proposed change is free of whitespace errors. The checker also verifies the exact existing `install:ci`, `test`, `typecheck` and `build` npm script strings, rejects their pre/post lifecycle hooks, and refuses replacement commands. There is no submitted-command option. Check code, installation code and dependencies still require review.

## Retained local report

`runContributionChecks()` writes an initial `RUNNING` report and atomically replaces it with bounded checkpoints before and after each command, then a terminal report. Temporary files are synced before rename, and the containing directory is synced. A changed report file is refused rather than repaired. A storage failure can leave the last confirmed checkpoint; a hard process kill can leave `RUNNING`. Neither is a passed terminal result. Power-loss behavior has not been independently demonstrated.

The report has `kind: LOCAL_CHECK_REPORT`, `classification: AUTHOR_REPORTED`, `qualification: NONE` and status `RUNNING`, `PASSED`, `FAILED` or `INTERRUPTED`. It records declared base/head/tested identities, actual commit/tree/parents, observed checker/workflow/package digests, the fixed script map, runtime, per-command exit status, bounded diagnostics, observed-output SHA256 digests and safe failure reasons. It also records the current GitHub PR/run context when invoked in the prepared workflow. SHA256 of the canonical report body forms `reportDigest`; this establishes byte consistency, not who executed it.

The source is rechecked between commands and after the final command. A failing test, typecheck, build or range check remains in the report; ordinary command failures do not hide the other checks. Source changes stop further commands. Interrupted, timed-out, unavailable or unrun checks cannot become `PASSED`.

| Bound | Limit |
| --- | --- |
| Fixed checks | 4 |
| Time per check | 20 minutes |
| Git metadata operation | 10 seconds |
| Observed stdout + stderr before termination | 2 MiB per check; a received chunk can cross the threshold |
| Retained JSON-encoded diagnostic strings | 16 KiB per stream, 32 KiB per check |
| Report | 256 KiB |
| Each gate-source file | 256 KiB |

Logs carry truncation flags. Output digests describe the bounded captured prefix; additional output is discarded after `OUTPUT_LIMIT` while the process is terminated. Termination is not proof that a complete stream was captured. Diagnostics remove control sequences and recognized OpenGrail/GitHub credential patterns, including bounded percent decoding. This is a limited redaction rule, not a general secret detector. Do not run contributed code with private data or credentials.

The checker gives child processes a small environment and scratch home/npm configuration. It does not forward provider tokens, private environment values or Node preload flags. This is not a sandbox: repository code can access files and network available to the account running it. Use an isolated disposable environment with synthetic fixtures and no private mounts, secrets, production bindings or paid services.

## Prepared GitHub workflow

`.github/workflows/contribution.yml` listens only to `pull_request` opening, synchronization, reopening and ready-for-review events. It uses the ephemeral `ubuntu-24.04` hosted runner, Node 22, Python 3.12, `contents: read`, cancellation of superseded PR work and a 95-minute job bound. It has no deployment, public agent credential, secret input, privileged trigger, self-hosted runner, artifact upload or write-permission grant. Runner availability, repository settings and costs require maintainer review before actual hosted use.

The `Contribution checks` job performs these required steps in order:

1. `Checkout exact PR merge`: explicit `github.sha`, full history, credentials not persisted, no submodules or LFS.
2. `Verify checkout identity <tested SHA>`: direct Git checks of the exact merge and both parents, plus a clean worktree, before running repository installation code.
3. `Set up Node 22`.
4. `Set up Python`.
5. `Install locked dependencies`: existing `npm run install:ci`, with a 10-minute bound. A clean clone uses the existing portable installer.
6. `Run fixed contribution checks <tested SHA>`: repeat direct checkout checks, then invoke the fixed checker, with an 82-minute step bound. The final local JSON report is printed to the execution log.

The checker saves its local report under `RUNNER_TEMP`. This source does not upload it as an artifact or guarantee external report retention after the ephemeral runner is removed. A failure before checker admission has no checker report; the job and failed step remain the relevant provider evidence. Workflow cancellation can prevent a terminal receipt.

The action revisions were checked against the official repositories on 11 October 2026:

| Action | Fixed commit | Primary source |
| --- | --- | --- |
| `actions/checkout` v4.2.2 | `11bd71901bbe5b1630ceea73d27597364c9af683` | [Official release](https://github.com/actions/checkout/releases/tag/v4.2.2) |
| `actions/setup-node` v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | [Official release](https://github.com/actions/setup-node/releases/tag/v4.4.0) |
| `actions/setup-python` v5.6.0 | `a26af69be951a213d495a4c3e4e4022e16d87065` | [Official release](https://github.com/actions/setup-python/releases/tag/v5.6.0) |

For `pull_request`, GitHub documents `GITHUB_SHA` as the merge commit and the PR head as a separate identity. The step names deliberately include the provider-expression tested SHA; a workflow-run `head_sha` field alone is not checkout proof. [GitHub event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

## What can establish CI evidence

Use the [read-only collector operator guide](contribution-evidence.md) for the exact reviewed policy, commands, limits and offline assessment distinction.

The checker and workflow cannot approve their own expected hashes. A maintainer supplies trusted workflow, checker and package-file digests independently. The separate read-only collector/validator checks current repository and PR identities, the current workflow attempt, complete successful required steps, the exact merge and parents, and the expected gate-file hashes at both the source head and tested merge. It does not accept an uploaded report or a green aggregate badge as that proof. Unavailable, changed, skipped, cancelled or incomplete evidence remains unverified.

Even independently matched CI evidence concerns the configured checks at a source state. Contributed tests can omit important assertions; hostile code can manipulate its own behavior, workspace or output. This workflow is not a hostile-code execution attestation, a security audit, independent research qualification, profitable-strategy proof or approval to merge or deploy. Review installation/build code and gate-file changes separately. Keep fork workflows read-only and without secrets; GitHub repository administrators control actual settings and approvals. [GitHub runner security guidance](https://docs.github.com/en/actions/concepts/security/compromised-runners).
