# Read-only current-PR evidence

This sponsor-local tool collects bounded GitHub evidence for one reviewed issue, pull request and run. The owner requires PRIVATE OpenGrail source: use the explicit version-two private path below. The original credential-free version-one public path remains separate. Neither mode creates a repository, issue, PR, workflow run, invitation or review. Repository setup, access and hosted CI remain unverified; local fixtures do not establish them.

## Private OpenGrail review

Run the reader only from independently reviewed trusted tooling and dependencies, separately from the contributed checkout and all contributed-code execution. Do not place its credential in the checker, npm environment, browser, Worker, public-agent registry, source, policy, command arguments or logs. An agent registration grants no private GitHub access.

The strict private policy has these top-level fields:

```text
version: 2
repositoryVisibility: PRIVATE
privateReadApproved: true
credentialIsolationConfirmed: true
target: the exact reviewed target object below
trusted: the exact independently reviewed gate object below
```

The two true flags are explicit local operator declarations. They do not prove permission, credential isolation or token scope. Target and trusted fields retain the same strict shape as version one: exact repository ID/name, issue/PR, base/head/tested merge, workflow/run and reviewed gate-file SHA256 digests. Supply no additional fields or token material. Both actual repository snapshots must match the declared identity and be private.

Use a fine-grained personal access token restricted to the one approved repository, with only Metadata, Contents, Issues, Pull requests and Actions read permissions needed by the fixed resources. Review actual token settings independently; a `github_pat_` prefix cannot establish them. GitHub documents endpoint permission requirements and permits private workflow-job reads with Actions read permission. [GitHub permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens), [workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs).

Prepare the token through your trusted local secret workflow as an absolute-path regular file owned by the current user, mode `0400` or `0600`, with one hardlink and at most 512 bytes. Do not put the token in a shell argument or ask an agent to recover it from another account. The reader refuses unsafe permissions, symlink path components, nonregular files, aliases/changes and known checkout locations. Credential admission uses Linux descriptor-relative `/proc/self/fd` guards; Windows/macOS operation is not established. These guards are not an execution sandbox or proof of all possible private mounts.

```sh
node scripts/contribution-evidence.mjs collect-private PRIVATE_POLICY.json /absolute/new-private-evidence.json /absolute/CREDENTIAL_FILE
node scripts/contribution-evidence.mjs verify PRIVATE_POLICY.json /absolute/private-evidence.json
```

The evidence path must be new, absolute, outside the tool and working checkouts, with a canonical nonsymlink parent. Output is exclusively created mode `0600`; existing files and symlink destinations are refused. Preserve private policy and evidence locally; do not attach them to public research or expose private repository/PR details. The private CLI emits only safe assessment/hash/read-count summaries, not private target metadata or credential content.

If publication succeeds but its final confirmation fails, the collector returns `PRIVATE_EVIDENCE_OUTPUT_UNCERTAIN` and preserves the destination. Inspect the original path before retrying with a new destination; do not delete or overwrite retained evidence. Before reading a credential, the private reader also rejects repository paths that URL normalization would change, including dot segments.

Authenticated GETs are pinned to the exact approved repository and fixed policy-derived resources, including the current run-attempt jobs and reviewed gate paths at the declared refs. No arbitrary URL, redirect, retry, token fallback, write, child process or contributed code is used. Existing request/time/body/job limits apply. Missing access, visibility changes, stale context, incomplete jobs, altered gates and failures cannot become verified CI evidence. Raw provider errors are replaced by fixed safe reasons.

Saved wrappers use `PRIVATE_GITHUB_CI_EVIDENCE` and `PRIVATE_GITHUB_API_READ`, with the exact policy digest and bounded version-one provider evidence. Offline `verify` checks the matching wrapper kind, recomputes the assessment rather than trusting claimed success, requires no token and emits `OFFLINE_UNAUTHENTICATED_SNAPSHOT` with freshness `NOT_RECHECKED`. A fabricated saved file can mimic provider metadata; neither hashing nor offline success authenticates a real run.

## Prepare the independent policy

A trusted maintainer must first verify the actual repository ID/full name, issue and PR numbers, base and branch/fork identities, exact two-parent tested merge, workflow ID and run ID. GitHub's workflow-run head SHA is distinct from the tested merge: use the declared merge and its two actual parents. Obtain the workflow, checker and package hashes from independently reviewed source, not from the contributor's assertion or this tool's output. Updating trusted hashes requires review of the changed gate code.

The following version-one PUBLIC field guide is retained for a separately approved public project. It is not the private OpenGrail policy. For version two use the top-level private fields above and the exact same `target`/`trusted` shape below. All entries are placeholders, not a runnable policy or proof of an existing repository:

```text
version: 1
publicReadApproved: true (only after explicit operator approval)
target:
  repository: {id: verified numeric ID, fullName: verified owner/name}
  issueNumber: verified issue number
  pullRequestNumber: verified PR number
  base: {ref: exact base ref, sha: complete base SHA}
  head:
    repository: {id: verified fork ID, fullName: verified fork owner/name}
    ref: exact contribution ref
    sha: complete contribution head SHA
  testedSha: complete two-parent PR merge SHA
  runId: exact intended workflow run ID
trusted:
  workflowId: verified workflow ID
  workflowPath: .github/workflows/contribution.yml
  files:
    - {path: .github/workflows/contribution.yml, digest: reviewed SHA256}
    - {path: scripts/check-contribution.mjs, digest: reviewed SHA256}
    - {path: package.json, digest: reviewed SHA256}
```

Write those reviewed values as ordinary strict JSON to `POLICY.json`. Git SHAs must be 40 lowercase hexadecimal characters, SHA256 digests 64, IDs positive safe integers, and keys exactly as shown. Issue association is maintainer-declared; the collector does not prove that GitHub will close or credit that issue. Policy approval is an operator declaration, not a server authorization or cryptographic identity.

## Legacy public collection

```sh
node scripts/contribution-evidence.mjs collect POLICY.json /absolute/new-evidence.json
```

Version-one collection accepts no credential and requires public repository snapshots. It uses `https://api.github.com` GETs with redirects refused, no retries and no arbitrary URL input. Both modes read the repository, issue, PR, workflow and current run before and after the intervening job/commit/source reads. Jobs use the exact run-attempt endpoint; omitted job `run_attempt` fields are correlated through that endpoint, while conflicting supplied values are rejected. Required gates match at both the tested merge and contribution head. The trusted workflow checks the initial actual checkout before installing contributed dependencies and names both identity and fixed-check steps with the tested SHA.

The new evidence file is mode `0600`, synced and created without overwriting an existing destination or symlink. A provider failure is retained as unavailable evidence with a fixed reason; raw provider error details, issue prose and contributor artifacts are not emitted. A failed write may leave a created file before confirmation: inspect the original destination rather than deleting evidence or assuming no operation occurred.

| Bound | Limit |
| --- | --- |
| GET attempts per collection, either mode | 32, with no retries |
| Individual response / total received body bytes | 1 MiB / 4 MiB |
| Request / total elapsed collection time | 8 seconds / 120 seconds |
| Current-attempt job pages / jobs | 2 pages of 8 / 16 |
| Canonical evidence / policy | 512 KiB / 32 KiB |
| Gate file body | 128 KiB each |
| New evidence wrapper | 1 MiB |

Actual elapsed time and bytes are bounded; a received chunk may cross the threshold before cancellation. These limits describe application attempts, not a wire-level attestation. GitHub can impose tighter shared-IP limits. Rate/access rejection stays unavailable, without retries, token fallback or automatic scheduling. GitHub currently documents a 60-request-per-hour unauthenticated REST allowance per originating IP; one ordinary successful collection uses 18 reads. Other users of that IP remain unknown. [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Read the result

| Result | Meaning |
| --- | --- |
| `CI_VERIFIED` | The collected provider metadata and independently configured required gates match this exact current source/attempt snapshot. |
| `PENDING` | A required workflow, job or step is not terminal. |
| `FAILED` | A required gate failed, was skipped, is missing/ambiguous, or differs from trusted source. |
| `STALE` | PR, merge, run attempt or relevant context changed. |
| `UNAVAILABLE` | Evidence is missing, inaccessible, malformed, inconsistent or truncated. |

The command exits zero only for `CI_VERIFIED`. Every assessment retains false flags for research qualification, independent research, merge/security/deployment approval, permission changes, orders and Live execution. Successful metadata does not prove tests were sufficient or protect against malicious behavior inside an untrusted job. A maintainer still reviews the code and decides whether to accept it.

## Offline inspection

```sh
node scripts/contribution-evidence.mjs verify POLICY.json EVIDENCE.json
```

The offline command recomputes the assessment from the bounded saved snapshot, verifies the exact policy digest and ignores its reported success fields. Output is explicitly `OFFLINE_UNAUTHENTICATED_SNAPSHOT`, freshness `NOT_RECHECKED`, cryptographic attestation false. A fabricated file can mimic provider metadata; offline success does not prove a real GitHub run or that the PR remains current. Use a newly approved online collection for current review evidence.

See [the fixed checker and prepared workflow](contribution-ci.md) and [the contribution workflow](contribution-workflow.md). No public API grant or production code-execution service is created.
