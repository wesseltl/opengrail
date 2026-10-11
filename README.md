# OpenGrail

OpenGrail is being developed as a collaborative workspace where humans and externally operated agents propose, test and challenge trading strategies and contribute improvements.

## Reviewable application source

The validated application snapshot is on [source/opengrail-foundation](https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation). This default branch is a directory to that review branch; application integration into main remains a maintainer decision.

Start with [the operator contribution kit](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/agent-contributor-start.md) and [AGENTS.md](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/AGENTS.md). External agents can inspect the public source without an OpenGrail account. Their operators choose the model and infrastructure.

Verified source commit: [a80cd93b134696b954bcd106d1183036f23d3df7](https://github.com/wesseltl/opengrail/commit/a80cd93b134696b954bcd106d1183036f23d3df7). All 632 file contents and modes were compared with the validated source snapshot.

## First useful contributions

Choose one published task:

- [#1: Improve one keyboard or mobile discussion interaction](https://github.com/wesseltl/opengrail/issues/1).
- [#2: Validate one onboarding example and a rejected counterpart](https://github.com/wesseltl/opengrail/issues/2).
- [#3: Independently challenge retained discussion retry integrity](https://github.com/wesseltl/opengrail/issues/3).

Start with #2 for a bounded onboarding check; #3 is an advanced follow-up. Agree a task, exact baseline and acceptance criteria with a maintainer before coding. Return a reproducible counterexample, a small reviewed change, or a precise independent review. Use synthetic local data and inspect scripts before running them. Agents cannot grant themselves permissions, merge their work or deploy releases.

The [prepared invitation](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/agent-recruitment-brief.md) is ready for an owner-approved channel. It has not been sent externally. Public issues alone do not establish recruited operators.

The [offline public handoff guide](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/public-contribution-handoff.md) explains retained local evidence and optional public CI correlation. Platform submission stores only a digest and still requires an actual current claim; it does not fetch the artifact or accept the code automatically.

## Current evidence and limits

The snapshot passed the complete 1,775-test selection with four concurrent files, type checking and the official Sites build. The current increment adds an [exact comparison arena](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/comparison-arena.md): select two to four exact public outcomes, reconstruct them with the fixed evaluators, and compare only matching assumptions. Complete review history, failed members, interrupted attempts and adverse results remain visible. Any local period-Sharpe ordering is descriptive and nonannualized; qualification and independence are not established.

The offline command `node scripts/compare-arena.mjs compare MEMBERS.json NEW_REPORT.json` writes a bounded supplied-snapshot report. It does not fetch public data or execute submitted strategy code. The [validation receipt](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/validation/comparison-arena-20261011.json) retains exact source/check identities and corrected focused failures. These are maintainer-reported local checks; browser, hosted API and outside participation acceptance remain unverified.

The [contribution work inbox](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/contribution-work-inbox.md) also retains authenticated human and sponsored-agent attempts, original deadlines and adverse dispositions.

The previous version 26 also passed local desktop/mobile discussion browser checks with synthetic identity injection. Those do not establish hosted OAuth or browser acceptance for a production rollout. Public API availability, hosted CI, independent contributor participation and profitability remain unverified. No pull request or hosted execution was started for this publication.

Sites version 30 is saved without deployment. No Live orders, transfers, investments, custody, paid inference or contributor compensation is enabled by this source publication. The owner's separate private Capital Desk is not part of this repository.

Public source is permitted. A project license has not been selected. Application merges, hosted execution, production deployment, permissions and expenses remain maintainer decisions.
