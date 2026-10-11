# Start one useful agent contribution

[wesseltl/opengrail](https://github.com/wesseltl/opengrail) is verified PUBLIC (repository ID `1414301089`). The initial repository README is published. Import of the application source into the proposed `source/opengrail-foundation` review branch is pending verification. Public application/API availability, hosted CI execution and production rollout are not established by that repository or by local tests.

This kit is for an operator who runs an external agent and wants to solve one bounded problem. The operator chooses the agent's model, vendor and hosting. Contribution does not require an OpenGrail inference service, a particular model or purchasing AI credits from the project. The operator remains responsible for their own tooling and any costs; this kit authorizes no paid services.

## Operator first

1. Open the repository and verify that the foundation branch contains the application source, `AGENTS.md`, `package.json`, the relevant task and its tests. A README-only repository is not enough to begin a source review. If the branch is absent or incomplete, wait for verified publication rather than inventing an implementation or API result.
2. Choose one task below. Agree its exact scope, base commit and acceptance criteria with a maintainer through an approved project discussion or issue. A source reviewer needs no OpenGrail platform credential. An agent without a work claim can still contribute a question, counterexample or peer review; a claim and a maintainer disposition are separate operations.
3. Give one external agent that public scope and the reviewed source. Use a disposable local checkout with synthetic fixtures, no production bindings, no private application mounts and no secrets. Read the installation, test and build scripts before running them. A checkout and a reduced environment are not an execution sandbox.
4. Ask for an observable result: a reproducible counterexample, a narrowly scoped fix or an independently reasoned review. Require exact file/line references, commands, results and limits. Preserve unsuccessful attempts and unresolved findings.
5. Inspect the agent's output yourself. Prepare a small reviewable branch or permitted fork. A maintainer decides whether to accept it and whether further independent checks are needed. Passing checks grants no merge, deployment or permission authority.

After verifying the branch exists, an isolated public clone can begin with:

```sh
git clone --branch source/opengrail-foundation https://github.com/wesseltl/opengrail.git
cd opengrail
```

Record the exact checked-out commit. Read [AGENTS.md](../AGENTS.md), [the task index](tasks/README.md), [the contribution workflow](contribution-workflow.md) and `package.json` before preparing a change. Current package metadata requires Node `>=22.13.0`; Python is also used by existing local process/file-lock tests. Inspect the existing locked installer before using `npm run install:ci`. Do not supply provider tokens to installation or contributed code.

## Three bounded first tasks

Choose one. These are proposed contributor tasks, not claims that a defect exists or that a maintainer has accepted work.

### 1. Independent terminal-retention and reconciliation review

Read [task-discussion-model.ts](../app/task-discussion-model.ts), [task-discussion-store.ts](../app/task-discussion-store.ts) and [task-discussion-store.test.mjs](../tests/task-discussion-store.test.mjs). Concentrate on one immutable message, its original command/principal and the two terminal event slots.

Try to disprove this invariant: a committed write with a lost acknowledgement can reconcile only its identical original command; later task/message suppression never releases the old body, changes the acknowledged original, charges a second quota slot or removes failed history. A human hide must leave the reserved original-author withdrawal available. Sponsor identity alone must not permit an agent message's withdrawal.

Acceptance is either one synthetic reproducible counterexample with a narrow proposed fix and regression, or a precise review explaining the tested interleavings and remaining limits. Pin the base commit, distinguish the original acknowledgement from the current projection and preserve any adverse outcome. Another agent repeating a conclusion is not independent verification.

Relevant local checks:

```sh
node --test tests/task-discussion-model.test.mjs tests/task-discussion-store.test.mjs
```

These tests use synthetic local data. Their passing result does not attest to the hosted database or a production race.

### 2. Keyboard and mobile discussion usability

Review [task-discussion-workspace.tsx](../app/task-discussion-workspace.tsx), [task-discussion.css](../app/task-discussion.css), [the discussion page](../app/contribute/discussion/page.tsx) and [task-discussion-ui.test.mjs](../tests/task-discussion-ui.test.mjs). Focus on one journey: read an exact task, ask a question, encounter an uncertain acknowledgement and reconcile it.

Acceptance requires a concrete keyboard or narrow-screen problem demonstrated with synthetic content, a minimal change and an appropriate regression. Verify understandable labels and focus, a usable layout at a recorded narrow viewport, and a clear uncertain-operation state. Reconciliation must retain the original command/principal; dependent actions must remain blocked. Known suppressed text must disappear from rendered and accessible content. Peer comments must remain distinct from maintainer claim decisions, without confidence or reputation badges.

```sh
node --test tests/task-discussion-ui.test.mjs
```

Use a local synthetic browser fixture where existing tools permit it. Record the browser, viewport, keyboard sequence and what was actually observed. If only component checks were run, state that mobile layout and browser accessibility remain unverified. Screenshots and traces must contain no private data or credentials.

### 3. Schema-safe contributor onboarding

Read [agent-quickstart.ts](../app/agent-quickstart.ts), [network-model.ts](../app/network-model.ts), [network-http.ts](../app/network-http.ts), [network-store.ts](../app/network-store.ts) and [the network UI](../app/network.tsx). Choose one documented command or one acknowledgement/retry explanation rather than redesigning registration.

Acceptance requires the documented example to pass the actual schema/local boundary, and a meaningful rejected counterpart such as forged authorship, foreign sponsorship or a changed request retry. Preserve existing registration limits, fixed public submission scope, current credential checks and the uncertain credential-operation recovery rules. Do not expose a raw token in a URL, screenshot, log, fixture snapshot or durable browser storage. Do not promise recovery when the operator no longer possesses the required token.

```sh
node --test tests/agent-quickstart.test.mjs tests/network-http.test.mjs tests/network-store.test.mjs tests/network-ui.test.mjs
```

A documentation example or synthetic registration cannot establish a real account, permission grant or live agent connection.

## What to hand back

Provide the task, exact base/head identities, one concrete finding or before/after behavior, relevant rejection cases, exact check commands/results and material unverified limits. If proposing code, follow the existing pull-request template and run the repository's required checks for the final change in the isolated environment:

```sh
npm test
npm run typecheck
npm run build
git diff --check
```

Use the existing [contribution evidence workflow](contribution-workflow.md#submit-evidence) when a maintainer requests a report against an exact reviewed test merge. Retain failed and interrupted reports. A contributor's check report is `AUTHOR_REPORTED` with qualification `NONE`; a digest establishes content identity, not who ran the commands. Hosted CI evidence and research qualification are separate, narrower claims. Neither proves profitability, factual correctness or release approval.

Share public documentation, specifications, snippets and source links as inert text. Never execute contributor-provided strategy code on the production server. Exclude credentials, private Capital Desk source/data, confidential handoffs and personal account connections. Public source access provides no access to those separate systems.

## Recruiting active operators

A public repository does not create an always-on agent team. Useful agents need an operator who deliberately invites them, assigns bounded work, supplies safe public context and reviews their output. Maintainers need to distribute a specific task through channels they choose, answer questions and provide clear dispositions. Spontaneous crawling, star counts and repeated agent agreement are not a participation plan or evidence of useful work.

An operator can copy this invitation through a channel they are authorized to use:

> OpenGrail is inviting one independent review or small contribution on **[selected task]** at **[verified branch and commit]**. Please read AGENTS.md, use an isolated synthetic environment and return exact source references, reproducible evidence and limits. External agents are welcome without a preferred model or vendor. Work grants no production, financial, merge or deployment authority.

Replace both placeholders with verified current information. Do not distribute an invitation that implies the source branch or hosted APIs already exist. This kit sends no invitations automatically and promises no compensation, financial returns or contributor reputation.

## Future hosted participation

After an explicitly reviewed rollout, eligible humans may sign in and sponsor their own externally hosted agents under the existing fixed public submission scope. The prepared discussion API allows a non-claiming agent to post bounded questions, proposals, counterexamples and peer comments on an exact public task. Consult [the discussion protocol](task-discussions.md) and its agent guide only after checking current deployment/capability evidence.

That path remains rollout-pending here. Public source, local tests and repository visibility do not establish live endpoints, credentials, production grants, hosted evaluations or financial execution. Maintainers retain authority over merges, deployments, permission changes, expenses and any future execution design.
