# From task to reviewed contribution

The contributor page at `/contribute` connects this workflow to the product. The owner's latest instruction permits public OpenGrail source, superseding the earlier private-only preference. The owner-created `wesseltl/opengrail` repository (ID 1414301089) is verified PUBLIC; initial README is published, application source import and hosted CI remain pending. Public research participation uses `/agent-guide` without source access. Check and evidence tooling is source preparation; it does not establish a GitHub repository, published issues, pull requests, hosted CI execution or public launch. Public source and successful CI grant no merge, deployment or production authority.

## Pick a bounded problem

Read the [task index](tasks/README.md) and current code. Confirm the task's status against implementation and test evidence. An issue should state the observable problem, proposed scope, acceptance criteria, important rejection cases and expected verification. Reserve dependent infrastructure or permission changes for explicit maintainer review.

Choose a small piece that can be reviewed independently: a sponsorship isolation test, an accessible token acknowledgment flow, a bounded schema validator or an independent experiment manifest. Avoid one pull request that claims to deliver an entire autonomous trading network.

## Prepare an isolated change

After receiving approved repository access, use an isolated branch or permitted private fork. Keep public project fixtures separate from personal trading or venture data. Automated contributors follow [AGENTS.md](../AGENTS.md). External agents use sponsor-selected infrastructure and their own credentials; API participation must not require the project's preferred model or inference provider. A platform credential grants no GitHub access.

Before executing changed scripts or installing dependencies, inspect the changes. Run contributed code only in a local isolated environment without production bindings, private files or secrets. The application itself must not evaluate uploaded strategy code. A code runner, sandbox or hosted agent service needs its own reviewed task and authorization.

For onboarding, every signed-in human may sponsor their own agent under the fixed beta submission role. Server validation binds the sponsor, operation and idempotency ID. Check atomic limits, foreign-sponsor access, revocation, expiry and lost acknowledgments. Do not make public contribution contingent on access to the owner's private dashboard.

## Submit evidence

Pull requests include the task or issue, concrete behavior, risks and exact checks:

```sh
npm test
npm run typecheck
npm run build
git diff --check
```

The fixed local checker packages those outcomes against an exact reviewed test merge:

```sh
node scripts/check-contribution.mjs BASE_SHA HEAD_SHA TESTED_MERGE_SHA NEW_REPORT.json
```

Replace all three SHA placeholders with full lowercase 40-character commit identities. The current checkout must equal the tested merge, whose two parents are the intended base and contribution head. Replace `NEW_REPORT.json` with a new absolute report path outside the checkout; both conditions are required, and an existing report is not overwritten. The checker runs `npm test`, `npm run typecheck`, `npm run build` and `git diff --check BASE_SHA TESTED_MERGE_SHA` with fixed arguments. Each check is bounded to 20 minutes and 32 KiB of retained combined output; the terminal report is bounded to 256 KiB and fsynced as an exclusive new file.

`LOCAL_CHECK_REPORT` retains exact source/tree/scripts/control-file identities, check exit/output digests and `PASSED`, `FAILED` or `INTERRUPTED` status with qualification `NONE`. A report hash establishes content identity, not independent execution attestation. Preserve interrupted and failed reports alongside later attempts. Inspect retained output before sharing; running without private files, secrets or production bindings remains mandatory.

State missing scripts, failed checks and unverified hosted behavior plainly. Use relevant failure and concurrency cases; a test that repeats the implementation is weak evidence. UI checks should cover keyboard navigation, understandable state and narrow screens when the change affects them. Screenshots and traces must be synthetic and contain no credentials. A local report identifies the commands, checkout and execution conditions; it does not independently attest that a contributor honestly executed them.

Research contributions identify the author, sponsor where applicable, method, sources, limitations and falsification criterion. An independent experiment must additionally retain exact inputs, source/dataset digests, execution conditions, comparison rules, all relevant trials and failed outcomes. A published author claim is not an independently verified result.

## Review and release

A maintainer reviews the code, dependencies, security boundaries, data rights and evidence. A second agent repeating the author's conclusion does not establish independent validation. Reviewers should try a relevant rejection or counterexample rather than reward agreement.

Agents may revise their pull requests but cannot merge, deploy, change permissions or introduce expenses. Passing local checks does not approve a production release. Review and release approval should refer to the exact commit or artifact. If the reviewed content changes, review the changed parts before release.

No privileged CI is required to make a contribution useful. Prepared pull-request workflow source uses bounded, secretless checks and read-only permissions. It does not approve repository publication or hosted execution. Do not add production secrets, paid runners or `pull_request_target` jobs to test fork submissions. Before activation, maintainers review its exact source, permissions, resource costs and isolation.

## Collect current pull-request evidence

If a private repository is deliberately used, once its repository and workflow are verified, a maintainer reviews an independently supplied version-two policy identifying the exact repository, issue, pull request, tested merge/current run and trusted workflow/checker hashes. It requires `repositoryVisibility: "PRIVATE"`, `privateReadApproved: true` and `credentialIsolationConfirmed: true`. This optional private path does not require OpenGrail to be private. No approval, access, repository or trusted hash is supplied automatically; declarations are not proof of isolation or token privileges.

```sh
node scripts/contribution-evidence.mjs collect-private PRIVATE_POLICY.json NEW_PRIVATE_EVIDENCE.json /absolute/CREDENTIAL_FILE
node scripts/contribution-evidence.mjs verify PRIVATE_POLICY.json PRIVATE_EVIDENCE.json
```

Private collection runs from independently reviewed trusted tooling, separately from all contributed-code execution. It reads a bounded, current-user-owned mode-0400/0600 fine-grained credential file outside the tool and known working checkout. The new private evidence path is also absolute and outside those checkouts. No credential enters the checker, npm, contributor code, browser, Worker or public agent registry. Keep both policy and evidence private. Linux file guards are a local admission boundary, not a complete execution sandbox.

Collection makes only fixed-repository authenticated GitHub GETs with finite request/response bounds and no redirects, automatic retries, arbitrary endpoints or writes. Exact private visibility, repository identity, source refs, current workflow attempt, complete jobs and required step outcomes are checked before and after collection. The old version-one `collect POLICY.json NEW_EVIDENCE.json` remains credential-free and public-only for a separately approved public project. Neither mode is run against a real provider by source preparation.

Verification checks the saved report offline and makes no network request. Its provenance must remain offline: it cannot establish that GitHub state is still current after collection. Report states are `CI_VERIFIED`, `PENDING`, `FAILED`, `STALE` and `UNAVAILABLE`. Missing, skipped, truncated, changed or failed required evidence cannot be CI verified. Self-reported artifacts and invented provider fixtures cannot establish checkout identity or actual hosted execution.

`CI_VERIFIED` concerns the configured code checks at one exact current source state. It does not establish research validity, security, independent peer review, profitability, a license or merge approval. Public contributor guidance exposes no private isolation diagnostics or full release-proof artifacts. Maintain separate local/fixture results and real hosted evidence in any review.

## Measure useful participation

Record accepted contributions against their issue, reviewed commit and evidence artifact. Track problems resolved, reproducible experiments, defects found, strategy/research reuse and contributor retention. Counts must distinguish submissions, accepted contributions and independently validated outcomes. Preserve rejected claims and failed experiments when the publication policy permits them, with their disposition.

Do not award reputation because agents agree, resubmit the same claim or report high simulated returns. Any later reputation mechanism needs transparent rules, Sybil resistance, conflict disclosure, appeals and independent evidence. Monetization, compensation and license terms are separate decisions, not implied by participation.
