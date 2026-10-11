# 007 — Integrated exact experiment runs

Status: bounded source increment implemented and locally verified with 512/512 coordinated checks passing. Ordered build and native source-save evidence are tracked separately in the [release review](../release-experiment-runner.md). The full [independent experiment registry](003-independent-experiment-registry.md) remains incomplete.

## Problem and intended behavior

An exact public manifest currently requires a reader to export inputs, run another tool, import an artifact and then check a claim separately. That handoff can lose failed attempts or attach a result to the wrong inputs. Join those local steps without adding server execution or silently turning an author report into qualified evidence.

## Scope

- Admit one stable local attempt with exact manifest, strategy and source identities before evaluation. Run fixed trusted primary/reference code; inputs cannot select executable modules or external services.
- Retain admitted failures, adverse/no-trade outcomes, numerical disagreement, cancellation and interruption. Durable recovery records abandoned running attempts explicitly; reruns cannot overwrite previous attempts.
- Compare the newly computed primary artifact against fresh primary/reference results. Preserve all three pair dispositions and the fixed comparison policy. This is an initial local report, not reproduction of a historical published outcome or research independence.
- Integrate rights-confirmed local running and export in the existing experiment UI. Check current source/parent visibility, invalidate stale work and clear dependent payloads on observed suppression or signout.
- Prepare an exact existing-schema outcome only after an explicit action. Reset all publication consents. Preserve public command identifiers for identical same-author retries, without an automatic POST or a credential-bearing runner.
- Keep complete bounded local artifacts when the public registry cannot accept their size. Prepare an honest unavailable-artifact disposition; never truncate loss, trade or audit evidence.
- Bound local memory, input, artifact, ledger and admitted-attempt resources. Stop new admissions at capacity rather than delete old failures. Describe the ledger as admitted local history, not a complete external search log.

## Acceptance evidence

1. An exact public manifest runs locally and its exported result, sidecar and draft preserve all input/source references and costs.
2. Wrong manifest, source or artifact identities are rejected without substituting defaults; malformed or missing input receives retained safe evidence where admission permits it.
3. Actual negative, no-trade, halted, failed and disagreeing results remain available beside successful runs. A rejected artifact with no accepted input cannot become a matching public artifact.
4. A durable runner persists its admission before evaluation. Concurrent writers, corrupt recovery, persistence uncertainty and interruption cannot invent a completed result or lose an admitted running attempt.
5. Cancellation, stale callbacks, withdrawal, logout and unmount preserve the authority/content boundary. Local run/export/preparation makes no public write.
6. Preparing a public outcome resets every consent and retains exact command identifiers. Changed material is a new public command; retries do not inherit another principal's receipt.
7. Resource caps preserve adverse outcomes and stop additional work. Oversized public artifacts remain complete locally with an explicit unavailable-artifact option.
8. The documented checks pass against actual modules and component/CLI boundaries. Hosted behavior, research independence and qualification are reported separately.

## Remaining full-goal work

Authentic/unseen data, enforced holdouts, complete external search provenance, independently reviewed reproductions, qualified rankings and reputation remain separate deliverables. This increment authorizes no Live orders, investment commitments, private records, provider access, paid compute, hosted evaluation service or deployment.

The ordered Sites build completed successfully. Exact local evidence and source hashes are in [the validation receipt](../../validation/experiment-runner-20261011.json); native save verification follows separately.

