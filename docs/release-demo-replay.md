# Deterministic local Demo replay release review

Prepared on 11 October 2026 for maintainer review. This source increment does not authorize deployment, new financial permissions or paid compute. The [Strategy Hub release](release-strategy-beta.md) records the prior source scope.

## Concrete scope

This increment adds a reviewed first-party evaluator and a local Demo replay interface for exact declarative strategy records, supplied closed bars and explicitly timed signals. Its purpose is inspectable deterministic simulation with declared costs, event timing, capital accounting and retained rejected or adverse outcomes. Synthetic samples and provider labels must remain distinct from actual connected feeds or market observations.

The evaluator runs locally under bounded inputs. There is no uploaded-code runner, private account source, broker/exchange connection, order, transfer, hosted agent job or provider webhook receiver. A replay does not change a published definition’s `UNTESTED` status, establish reputation or create execution authority.

See [the methodology](demo-methodology.md) for the implemented event and accounting contract, including gap/dual-touch assumptions, short insolvency, DCA/grid allocation and digest meanings. [Task 005](tasks/005-deterministic-demo-replay.md) records the acceptance criteria. Source implementation, the full test suite, typecheck, whitespace checks and the ordered build have passed. The final source/configuration receipt is recorded below. No hosted release or deployment is approved.

## Validation evidence

On 11 October 2026, the coordinated `npm test` run exited zero with **234/234 passing**, zero failed, cancelled or skipped. It includes 19 engine fixtures, 10 CLI fixtures and 22 Demo component fixtures. The actual `npm run typecheck` command exited zero, and whitespace checks passed. The fixtures cover next-open timing, unavailable signals, per-side costs and short accounting, gap/dual-touch exits, daily/open-position/capital bounds, all seven entry families, rejected/no-trade/negative/insolvent outcomes, deterministic identity and UI stale-work/retention/import/export behavior.

Independent read-only review found and resolved future-bar numerical failures leaking through eager indicator caches and opening events receiving closing audit timestamps. Regressions retain earlier replay prefixes when later observations overflow, and match opening entry/exit/reset timestamps to their actual boundaries. Further fixtures cover immediate slippage stop breaches, uncapped short insolvency at the observed opening price, safe derived-metric failure artifacts and mid-bar emergency deferral.

Hand-calculated fixtures test known accounting and timing cases; they do not independently qualify a strategy. Synthetic local checks do not establish authentic historical data, data rights, held-out evaluation, hosted browser behavior, public availability, forward Demo returns or profitability. The component checks use the real component and engine with local lifecycle fault injection; they do not establish browser layout or hosted end-to-end behavior.

The evaluator identifier is `opengrail-demo-v1`. The successful ordered build is recorded in [the final validation receipt](../validation/demo-replay-20261011.json), with the actual build result and exact source/configuration/input/artifact fingerprints. The declared-method digest, source-code hashes and canonical case digests have different meanings. The saved source archive/version will be recorded without deployment.

The [complete synthetic supplied-signal case](../examples/demo/README.md) retains its exact request and author-reported negative outcome, including matching and deliberately mismatched/stale events. Its source labels and fixture pseudonym establish no provider connection or real participant. Source and declared-method hashes must remain separate from that case’s request, strategy, data, signal and result identities.

## Retention, rollback and isolation

Local trial history must preserve rejected, no-trade, negative and terminal-failure attempts within its stated bound. Reaching that bound must not silently evict failures. Export and page/session retention behavior must be described explicitly. Local history is not a persistent shared registry or proof that every search trial was retained elsewhere.

No private Capital Desk source, record, credential, risk configuration or deployment may change. The public database’s existing publication histories and credential grants remain separate from this local replay. An approved source rollback can remove replay access without deleting publication histories or restoring revoked credentials. There is no prior live public replay service to claim as a tested rollback target.

The coordinated review confirms the private worktree remained clean and unchanged. This increment adds no migration: all five existing migrations, schema, existing network/research/strategy models and stores, Worker configuration and package/dependency fingerprints remain frozen against the preceding saved Strategy Hub source baseline. Local replay creates no new credential or permission grant.

## Outstanding release and full-goal work

- Maintainer review of the exact source artifact, public audience, resource budget, input/data-rights policy and any production rollout.
- Real browser/mobile/keyboard and slow-device QA against the approved version; local component fixtures are narrower evidence.
- Genuine hosted authentication/private-boundary and domain/HTTPS acceptance for the broader portal. Local replay does not establish those checks.
- A verified public GitHub project and isolated issue-to-PR contribution workflow; no repository URL or published issue is assumed.
- Actual signal ingestion and forward Demo operation, including source availability, reconciliation and operational failure handling.
- [Task 003](tasks/003-independent-experiment-registry.md): durable exact experiment manifests, declared baselines, full search/failure history, holdout/leakage controls, independent reproductions, conflicts and qualification rules.

Deterministic local replay is necessary engine work. It does not finish the independent experiment registry, Arena, qualified comparisons, strategy reputation or verified feedback, and supplies no investment recommendation or promised return.
