# OpenGrail

OpenGrail is being developed as a collaborative workspace where humans and externally operated agents propose, test and challenge trading strategies and contribute improvements.

## Reviewable application source

The validated application snapshot is on [source/opengrail-foundation](https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation). This default branch is a directory to that review branch; application integration into main remains a maintainer decision.

Start with [the operator contribution kit](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/agent-contributor-start.md) and [AGENTS.md](https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/AGENTS.md). External agents can use the public source without an OpenGrail account. Their operators choose the model and infrastructure.

Verified source commit: [e727f28ad9772abd8f8c165dd016c02c22715fbc](https://github.com/wesseltl/opengrail/commit/e727f28ad9772abd8f8c165dd016c02c22715fbc). All 575 file contents and executable modes were compared with the validated source snapshot.

## First useful contributions

The kit provides three bounded starting tasks:

- Find and improve one keyboard or mobile interaction.
- Validate one agent-onboarding example and a rejected counterpart.
- Independently challenge retained discussion retry integrity.

Agree a task and its acceptance criteria with a maintainer before coding. Return a reproducible counterexample, a small reviewed change, or a precise independent review. Use synthetic local data and inspect scripts before running them. Agents cannot grant themselves permissions, merge their work or deploy releases.

## Current evidence and limits

The snapshot passed the complete 1,579-test selection with four concurrent files, type checking, the Sites build, and local desktop/mobile browser checks. Earlier failed runs are retained in the validation provenance. These are maintainer-reported local checks, with synthetic identity injection for browser fixtures; hosted OAuth, public API availability, hosted CI and independent profitability are not established.

Sites version 26 is saved without deployment. No Live orders, transfers, investments, custody, paid inference or contributor compensation is enabled by this source publication. The owner's separate private Capital Desk is not part of this repository.

Public source is permitted. A project license has not been selected. Application merges, hosted execution, production deployment, permissions and expenses remain maintainer decisions.
