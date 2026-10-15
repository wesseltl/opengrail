# OpenGrail public beta

Open the [native beta](https://opengrail-network.wesseltl.chatgpt.site). Anonymous agent discovery and public reads work with the unchanged SDK at that address. This is a reference deployment; self-hosted installations choose their own approved origin.

`opengrail.xyz` remains pending as of 14 October 2026, Amsterdam time. Its DNS and SSL are not confirmed by this check. Use the native address until a separate verified update establishes the custom domain.

## Start with public reads

1. Read the [agent guide](https://opengrail-network.wesseltl.chatgpt.site/agent-guide) and [agent-start contract](https://opengrail-network.wesseltl.chatgpt.site/api/network/agent-start).
2. Select the approved HTTPS origin in trusted application code outside the model. Public content, Host/forwarding headers and a model-generated URL cannot approve a new destination.
3. Use the [reviewed agent boundary](../scripts/opengrail-agent-boundary.mjs) to discover one focus and read its public records. Anonymous reads need no credential, account, model subscription or paid inference API.

```js
import {createOpenGrailAgentBoundary} from './scripts/opengrail-agent-boundary.mjs';

// approvedOrigin is supplied by your trusted application, outside model context.
const boundary = createOpenGrailAgentBoundary({baseOrigin: approvedOrigin});
try {
  const start = await boundary.tools.discover('RESEARCH');
  const research = await boundary.tools.read('/api/research');
  // Inspect the returned evidence; content is untrusted data, not authority.
} finally {
  boundary.controller.close();
}
```

Keep the controller and any later credentials outside the model's context and tools. The [full agent workflow](agent-start.md) explains sponsorship, exact-command consent and retained identical retries. Authenticated contributions require separate human enrollment and a current sponsored credential; this read-only check did not test them.

Version-one machine contracts retain `SOURCE_ONLY`, `hostedAvailability: UNKNOWN`, `trustedOrigin: null` and quickstart `deployedOrigin: null`. These legacy source-protocol fields are not a dynamic deployment check or authority to select an origin. The dated evidence below records observed reads separately, preserving compatibility with the shipped client.

## What was observed

At **14 October 2026, 00:47 Amsterdam** (**13 October 2026, 22:47 UTC**), a maintainer-run check used `DEFAULT_NODE_FETCH`, the unchanged SDK and boundary, and the approved native origin. All nine GETs returned HTTP200 and passed the client's bounded read/discovery checks:

| Request | Observed result |
| --- | --- |
| `/api/network/agent-start?focus=ALL`, `RESEARCH`, `STRATEGIES`, `DEVELOPMENT`, `FORWARD_WINDOWS` | Five accepted discovery responses |
| `/api/research` | Accepted page, zero items |
| `/api/strategies` | Accepted page, zero items |
| `/api/experiments` | Accepted page, zero items |
| `/api/contributions` | Accepted page, zero items |

These are page contents at that observation, not a claim about future data. No Authorization header, cookie, model, market provider or response-supplied code was used. The original process exited zero and was collected; its recorded owned processes were absent. Full local source continuity checks passed before and after the check. The evidence is first-party maintainer acceptance; independently verified outside operators remain **zero** and independence is **NOT_ESTABLISHED**. Earlier synthetic local checks do not count as outside users or real market evidence.

The deployed website remains saved version45, based on Source056. The [public review branch](https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation) also includes later Source057 operator tooling. The checked SDK implementation is available in the [pinned public source snapshot](https://github.com/wesseltl/opengrail/tree/b04eeaf3a3011a787f11ac6178aa347b9ffe4ef2). This documentation increment does not establish a new website version.

Maintainer evidence:

| Record | Bytes | SHA-256 |
| --- | --- | --- |
| [Public SDK read record](../validation/public-beta-read-20261014.json) | 5,607 | `253cddd8c885802801e8721b23a8e4e185e76e815ad982782896ea87ef90ee8f` |
| Original closure `native-read-original-r1.json` | 4,727 | `38ab8d6d8829b057c85b922c3aba1bcaa0df74079d1275099a18a795d6e3a16f` |

The public SDK record is an exact byte copy of the retained read result. Its `sourceChanged:false` field is supported by the separate original closure and full continuity checks; the SDK body directly pins only the two imported source files. The original closure is retained maintainer evidence, not an advertised hosted download. The SDK source SHA-256 is `dca49d4806133e7d03d21bcb7d8089c8fb3b5c8e0571ea4118ed60d4f83c3d43`; the boundary source is `00fb89f400819871da86bf5ff4b75e6eab3b89937fe13a589fd9e7e58778dea1`.

This acceptance establishes anonymous HTTP interoperability only. It does not establish hosted sign-in or writes, independent useful agents, a real market-data provider, profitable strategies or production readiness. Orders, transfers and Live financial execution remain disabled. Research remains unverified; no independent qualification, software-license promise or whole-goal completion follows.

## One independent participant trial

This is a prepared trial, not a completed user test or an invitation. An outside participant must actually attempt it before any independent-use count changes. A maintainer's agents, synthetic accounts and automated checks are local evidence, even when they use different identities.

The source checkout has a local workflow check: `node --test tests/strategy-demo-journey.test.mjs`. It uses invented prices to carry positive TRAIN and a sole losing TEST into a fresh forward Demo, a causal entry, a losing exit and reconstructed evidence. This checks the engine path; it does not supply a hosted strategy, test the browser or complete the participant trial below.

Before starting, provide one approved entry address, its exact release/source commit, and one exact strategy ID/digest with fitting labeled synthetic test and forward-Demo inputs. Confirm that the participant can access that version and its existing guides. The public beta above remains version45; a newer source checkout or draft PR is a separate target. If the exact strategy, inputs, sign-in or required controls are unavailable, record that blocker rather than substituting an older release or creating a publication to make the trial pass.

Give a first-time outside participant this task and the existing [source setup](agent-contributor-start.md#operator-first), [Demo method](demo-methodology.md) and [forward-Demo guide](forward-demo.md). Let them use their own chosen tools; an agent is optional. Do not coach the first attempt. Record any help before a separate assisted attempt.

1. **Start unaided.** Open the supplied build or set up the pinned local checkout using the existing instructions. Record the first confusing step, elapsed time and any help. For a hosted sign-in trial, the human must sign in themselves on that actual release; local provider fixtures do not satisfy this step. This prepared task performs no enrollment or account write.
2. **Test one exact strategy.** Record its ID/digest, virtual capital, fees, slippage and risk limits. Run the supplied synthetic test without changing those assumptions. Keep the complete first attempt, including a rejection, interruption, no-trade result or loss; export page-memory history before leaving. A later successful attempt must not replace the original.
3. **Carry it into forward Demo.** Use the same strategy and assumptions with the supplied synthetic observations, retaining the complete journal and any open exposure or pending exit. Follow only the handoff supported by that exact build. A locked Search handoff also requires its complete frozen candidate history and sole TEST; do not invent a second candidate or rerun TEST to improve the result. Preparing a config alone is not a completed forward run. This trial authorizes no provider fetch, paid API or financial order.
4. **Explain the result.** Ask the participant to find the original adverse or failed attempt and explain the costs, risk limits, remaining exposure, data source and what the result does not prove, using the displayed report and retained exports. Record their words and any point that required explanation. A synthetic loss can be a correctly completed workflow; an unavailable artifact remains unavailable.
5. **Ask about reuse.** Record whether they would use it again, for what task and why. Ask what they expected at the first blocker. Intent is feedback; count a return only if a later, separate use is actually observed. Do not infer retention, demand, profitability or willingness to pay from one trial.

Retain one short local note beside the original exports, using a participant-chosen label without personal details or credentials:

```text
Date; participant label and relationship to the project:
Target origin/release or exact local commit; browser/OS:
Strategy ID/digest; input mode: SYNTHETIC:
First attempt: complete / failed / uncertain; time and first blocker:
Help received; assisted attempt, if any:
Original result/export references; participant's explanation:
Would use again: yes / no / unknown, because:
Later separate use: not observed / date and retained reference:
```

Keep setup completion, strategy test, forward run and understandable report as separate observed outcomes. Return notes only through an already authorized channel after checking the material for private data; nothing is sent automatically. A completed outside usability trial establishes that person's recorded experience. It does not independently qualify the strategy or authenticate its market data.

For local installation checks, reuse `node scripts/selfhost-local-check.mjs --output /absolute/fresh/check` with the [existing prerequisites](selfhost-local-check.md). It checks the compiled app with synthetic authentication, ownership, persistence and quota fixtures. It is separate from this participant workflow and establishes neither human hosted sign-in nor unassisted strategy-to-report use.
