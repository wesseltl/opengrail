# Public contribution handoff

This offline tool binds a declared public GitHub issue and reviewed merge identities to exact OpenGrail task/claim snapshots and a retained local checker report. The output file SHA256 can enter the existing digest-only `submit` command. The platform does not retrieve the file, inspect the GitHub issue or validate a PR by accepting that digest.

The verified public source proposal is [source/opengrail-foundation](https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation), initially imported at `e727f28ad9772abd8f8c165dd016c02c22715fbc`. The actual starter issues are [#1 keyboard/mobile discussion](https://github.com/wesseltl/opengrail/issues/1), [#2 schema-safe onboarding](https://github.com/wesseltl/opengrail/issues/2) and [#3 retained-retry review](https://github.com/wesseltl/opengrail/issues/3). Check their exact scope and current source before choosing work. GitHub issue publication does not register a platform task. Default `main` is a README directory; it is not the imported application. Hosted task/API participation, hosted CI and project licensing remain unverified or undecided.

## Inputs and commands

Run independently reviewed first-party tooling separately from contributed-code execution. This tool reads files only: it takes no token, fetches no URL, runs no tests or submitted commands, checks out no source and publishes nothing. Follow [AGENTS.md](../AGENTS.md) and [the contributor workflow](contribution-workflow.md) before executing the separate fixed checker in an isolated synthetic environment.

Replace every path below with an absolute canonical local path. `WORKING_CHECKOUT` is the declared contributed checkout directory, not an isolation attestation. Input files must be Linux regular files owned by the current user, mode `0400` or `0600`, with one hard link and no symlink path components. Inputs and the new output must be outside that checkout, the tooling checkout and the process working directory. The output is exclusively created with mode `0600`; existing evidence is never overwritten.

```sh
node scripts/contribution-public-handoff.mjs prepare WORKING_CHECKOUT TASK_SNAPSHOT CLAIM_SNAPSHOT PUBLIC_CONTEXT LOCAL_CHECK_REPORT NEW_PUBLIC_HANDOFF
node scripts/contribution-public-handoff.mjs verify WORKING_CHECKOUT PUBLIC_HANDOFF EXPECTED_FILE_SHA256
```

`TASK_SNAPSHOT` is the full `GET /api/contributions?id=...` response. `CLAIM_SNAPSHOT` is the full exact claim response, including the same parent task. These are offline unauthenticated snapshots. Preparation requires a visible OPEN task and ACTIVE sequence-zero claim, exact references and canonical record/event hashes, with creation/check clocks no later than preparation and the original lease not expired at preparation. Supplying a snapshot does not prove current hosted state or ownership. Verification uses the historical preparation clock; it does not renew a lease.

`PUBLIC_CONTEXT` uses exactly:

```text
version: 1
repository: {id, fullName}
issueNumber: positive integer
pullRequestNumber: positive integer or null
base: {ref, sha}
head: {repository: {id, fullName}, ref, sha}
testedSha: lowercase 40-character Git commit SHA
```

Repository IDs and issue/PR numbers must be positive safe integers. Repository names are bounded `owner/name` strings. Refs are bounded branch shorthand or full refs without empty, dot-prefixed, `.lock`-ending or otherwise invalid components. Base, head and tested merge SHAs must be distinct, lowercase 40-character identities. Use `pullRequestNumber: null` when no actual PR exists; absent hosted CI requires no invented workflow/run/PR ID. The context and task-to-issue mapping remain `OPERATOR_DECLARED_NOT_VERIFIED`, even when the repository and issue themselves are real.

`LOCAL_CHECK_REPORT` is one complete retained terminal report from [the fixed checker](contribution-ci.md). Preparation validates its exact schema, producer-order report digest, four fixed commands, declared merge identities and any observed commit/ordered parents. The report's exact file SHA256 is retained separately from its canonical report digest. Missing observed source in a failed/interrupted report remains `NOT_OBSERVED`. Failed, interrupted, timed-out, output-limited and not-run checks remain separate; they are not converted to successful evidence. Partial overall RUNNING checkpoints are rejected as incomplete reports.

Keep the original local reports, including failed or interrupted attempts. The handoff remains `AUTHOR_REPORTED` with qualification `NONE`; report hashes do not authenticate who ran commands. Stream digests describe original output bytes while retained text may be sanitized, redacted or truncated, so the artifact does not claim to reconstruct full logs.

A real interruption after the last check can leave all four check statuses PASSED and no failure reason while the producer's terminal outcome is INTERRUPTED. This conservative overall outcome is retained; it is never promoted to PASSED because its individual commands succeeded.

## Optional public CI

Append both optional inputs together, after the new output path:

```sh
node scripts/contribution-public-handoff.mjs prepare WORKING_CHECKOUT TASK_SNAPSHOT CLAIM_SNAPSHOT PUBLIC_CONTEXT LOCAL_CHECK_REPORT NEW_PUBLIC_HANDOFF PUBLIC_POLICY PUBLIC_CI_EVIDENCE
```

Only the existing public policy v1 and `PUBLIC_GITHUB_CI_EVIDENCE` receipt are accepted. They must correlate to the context's exact repository, issue, established PR, base/head/tested identities and canonical policy digest. Private policy v2 and private receipts are rejected. The saved receipt assessment is checked against a fresh recomputation of the existing narrow validator. Collection cannot follow preparation. A local report declaring the same provider run must also have compatible run/attempt and clocks.

Without this pair, `ci` and its two input-file digests are null, and CI assessment is `UNAVAILABLE` / `NOT_COLLECTED`. Unavailable, failed and stale snapshots can be retained; they cannot inherit successful assessment. When local and CI reports both claim success for the same tested commit, their checker/workflow/package-file pins must agree. Adverse local file changes remain retained with `ciGateFiles: MISMATCH` where appropriate.

Any `CI_VERIFIED` value inside this offline artifact means correlation of stored configured-gate metadata only. The enclosing assessment remains `OFFLINE_UNAUTHENTICATED_SNAPSHOT`, `NOT_RECHECKED` and cryptographic attestation false. It does not authenticate GitHub, establish current provider state, qualify research, approve code or prove profitability.

## Retain, review and submit

The persisted kind is `PUBLIC_CONTRIBUTION_HANDOFF`. It binds normalized snapshots/context/report, exact admitted input-file SHA256 declarations, optional CI and recomputed assessments. Offline verification rechecks the artifact's expected exact byte hash, schemas and cross-input relationships. It cannot recover or independently rehash original input-file whitespace from normalized embedded records. Retain the original input files for review.

Terminal output is a bounded summary containing the exact handoff digest, local/CI outcomes and authority limits. It prints no task body, source identity, report logs or token. On a late publication/confirmation failure, the existing guarded writer reports `PRIVATE_EVIDENCE_OUTPUT_UNCERTAIN`; this shared file primitive can leave the public handoff present. Keep that possible artifact and adverse reports. Inspect and hash the retained file through a trusted local workflow, then verify that exact digest; do not rerun preparation at the same path or delete uncertain evidence automatically.

After checking actual current task/claim state and ownership, the claimant can use the existing submission shape:

```text
action: submit
requestId: new lowercase UUID
task: {id, digest} from the confirmed task
claim: {id, digest} from the confirmed claim
expectedSequence: current claim sequence
handoffDigest: exact SHA256 of the retained handoff file bytes
policyAccepted: public-contributions-v1
```

Human submissions use the existing same-origin identity headers; sponsored agents use their active credential in the Authorization header over HTTPS. After an uncertain response, keep the identical command/body, request ID and original principal for reconciliation. A foreign, expired, closed or revoked participant cannot use a prepared artifact to gain authority. Changing the digest on an already accepted request is a conflicting retry.

Maintainers separately inspect the actual issue-to-task correspondence, source change, retained adverse outcomes and any current provider evidence. A narrow platform ACCEPTED disposition is not a merged PR, task-completion attestation or reputation award. All execution, order, Live, merge, release, permission and financial authority flags remain false. The existing [private handoff](contribution-desk.md) remains a separate optional workflow with its original format and restrictions.
