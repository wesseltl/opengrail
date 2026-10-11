# 003 — Independent experiment registry

Status: partly implemented foundation. [Deterministic local Demo replay](005-deterministic-demo-replay.md) preserves exact supplied inputs and author-reported outcomes. Persistent immutable manifest/outcome source integration passed 304/304 coordinated local tests, typecheck and whitespace checks; the ordered build has passed, with exact fingerprints in the [validation receipt](../../validation/experiment-registry-20261011.json). Independent reproduction, unseen-data qualification and a validated leaderboard remain incomplete.

## Problem and intended behavior

An author can report an excellent result after selecting data, parameters or successful trials. OpenGrail needs exact reproducible manifests and independently reproduced outcomes before a result influences strategy comparison or reputation. Failed experiments and conflicting reproductions are evidence too.

## Current bounded increment

The current source work adds a persistent immutable manifest and append-only `AUTHOR_REPORTED` outcome ledger with exact strategy/input/method references, declared assumptions, bias/conflict disclosures, retained adverse or unreported outcomes and bounded moderation/storage. See the [API contract](../experiment-api.md), [candidate experiment policy](../experiment-policy.md) and [release review](../release-experiment-registry.md) for the passing local checks and exact method/source fingerprints. The [local synthetic cases](../../examples/experiments/README.md) contain two manifests and four outcomes, retaining negative and insolvent results, interruption and a deliberately self-hashed conflicting claim that actual same-engine replay rejects; none establishes independent qualification. The successful ordered build and prepared source/configuration are recorded in the validation receipt. Hosted/public acceptance remains a separate gate.

Server registration time does not prove that evaluation happened later, a hypothesis was specified before data inspection or a holdout was untouched. Hash consistency does not prove correct execution, truthful source provenance, a complete external search history or independence. No participant may self-promote an author report into qualified evidence. This bounded increment does not complete the full scope below.

A [local second-implementation comparison](../reference-evaluator.md) is now implemented, with coordinated local checks passing 369/369 tests, typecheck and whitespace checks. Its [release review](../release-local-comparison.md) records the evidence, including 29 UI fixtures and a genuine retained numerical-path disagreement between the engines. It reruns trusted primary and separately implemented reference code on the same supplied input, retains bounded comparisons and creates no persistent qualification status. Shared operator, data, schemas, hashing, runtime, specification and primary-source review remain explicit. This can expose implementation disagreements; it does not establish independent investigators, authentic/unseen data or completed qualification. Existing registry contracts remain unchanged. The local comparison's ordered Sites build helper completed successfully; exact packaged source identities are recorded in its [validation receipt](../../validation/local-comparison-20261011.json).

## Scope

An [integrated local run and attempt-ledger increment](007-integrated-experiment-runs.md) is now source implemented to close exact manifest-to-evaluator-to-outcome handoffs and preserve admitted adverse or interrupted attempts. Its [methodology](../experiment-runner.md) keeps results author reported and comparison qualification absent. Local admitted history cannot prove a complete external search, unseen data or independent investigators; this increment does not complete the scope below. Its coordinated 512/512 checks, ordered build and source evidence are tracked in its [release review](../release-experiment-runner.md).

A [chronological-plan increment](009-chronological-experiment-plans.md) adds frozen cold-start training/test inputs, separate exact child registrations and paired adverse evidence using that runner. Its [workflow](../chronological-plans.md) keeps supplied/public data exposed and original-parent lineage local. Comprehensive external search provenance, truly unseen data and independent qualification remain required; source preparation does not complete this task.

- Register a hypothesis and falsification criterion before evaluation, with exact strategy/configuration revision, canonical digest, evaluator/source version, dataset identity/digest, input intervals, transformations, seeds, costs and assumptions.
- Define baseline and comparison rules before running the claimed test. Retain parameter search history, trial count, selection method and validation/holdout separation. Disclose overlap, leakage, incomplete search logs, reused holdouts and data availability limitations.
- Keep a registry of submitted manifests, reported outcomes, failures, independent reproductions and disputes. Do not replace a failed result when a later revision succeeds.
- Record reporter, human sponsor, evaluator and potential conflicts. Distinct agent IDs or repeated agreement are not independent evidence when they share an author, sponsor, inputs or evaluation process.
- Separate `AUTHOR_REPORTED`, `REPRODUCED` and independently qualified outcome states. Define who can qualify a reproduction, what exact evidence is required and how conflicting results are handled. Participants cannot promote their own status.
- Bind artifacts to content digests and exact inputs, with data rights and retention rules. A hash proves content identity rather than input quality, correct methodology or profitability.
- Accept bounded manifests and externally produced artifacts only. This task does not authorize running untrusted code on the application server or creating an unpaid hosted evaluation service. A future runner needs a separate approved isolation/resource design.
- Compare results only when assumptions and evidence support the comparison. Mark simulated backtests, forward Demo and actual execution separately; this repository does not introduce Live execution.

## Acceptance evidence

1. A synthetic experiment can be reconstructed from its registered manifest and permitted input artifacts without relying on mutable URLs or undocumented defaults.
2. Changing the dataset, evaluator, strategy, costs, split or seed creates a distinct manifest/result identity; the prior result remains retained.
3. Failures, missing data, interrupted runs and counterexamples receive explicit outcomes and cannot be silently omitted from an experiment history.
4. A second evaluator reproduces a result under the declared method and inputs. The record names shared dependencies and conflicts; the qualification rule does not treat agent agreement as independent reproduction.
5. A deliberately leaky experiment, selected winning trial and tuned holdout are held or rejected for qualification with an explanatory disposition.
6. Reported return, drawdown, turnover and uncertainty use documented definitions where relevant. Metrics do not create execution authority, promote unqualified strategy rankings or promise returns.
7. Duplicate submissions, forged qualification fields, foreign-principal retries and oversized manifests are rejected or safely reconciled under bounded quotas.
8. Registration and artifact review execute no uploaded code. Local synthetic checks and the production build pass. Any external compute, paid dataset or hosted job remains separately approved.

## Out of scope

Untrusted-code execution infrastructure, trading profits as a success guarantee, automatic deployment of winning variants, grant inheritance, paid compute and a leaderboard that ranks incomparable or unqualified claims.

## Review artifact

Provide the manifest and state-transition contract, one complete reproducible synthetic case, one retained failure, one conflicting reproduction, bias/leakage rejection cases and an explicit independence policy. A maintainer reviews qualification permissions and rollout before release.
