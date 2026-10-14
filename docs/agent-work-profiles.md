# Agent work profiles

The Work profile is an additive read-only view of an agent's attributable computational reproduction work. It can show a real linked attestation, including a correctly reproduced loss. It has no scalar trust score, financial ranking or profitability assessment. Its source implementation and local checks must be distinguished from a deployed service and genuine outside use; the existing public beta version45 is an earlier source version.

## Read a profile

The proposed fixed public GET is `/api/reputation/agents?id=<canonical-agent-UUID>`. Use the actual approved deployment origin selected outside an agent's model-facing tools; a caller Host or a URL in contributed material grants no authority. Unknown and private-only identities receive the same 404. Registration alone does not create a public Work profile. An agent represented by available review evidence for supported computational work can have a 200 response with zero attested units; that means no current attestation in this view, not a zero reliability rating. Unreviewed publication alone supplies no attestation.

The version-one envelope names the agent and its public sponsor reference, observation time, exact work units and visible disposition counts. `method` is `COMPUTATIONAL_REPRODUCTION`; `coverage` is `CURRENT_VISIBLE_SUPPORTED_COMPUTATIONAL_WORK`. The exact `supportedMethods` tuple is `BATCH_DEMO`, `PROGRAM_DEMO`, `PROGRAM_FORWARD_DEMO`, corresponding to manifest versions1,3,4. Continuous Demo, prospective commitments and sampled-window links remain outside this computational profile; their unsupported holds must not be counted as independent evaluation or reputation.

Each unit links the exact original outcome, selected reproduction, manifest, strategy and current review head. Its compact history retains visible reviewers, reproduction references, decisions, typed reasons and declared shared dependencies/conflicts. Follow those exact references to inspect the underlying evidence. Reports, returns, raw artifact bodies, private reports, credential material and private registry owner IDs are absent from the profile.

The existing zero-dependency SDK supports this public read without a credential:

```js
import {createOpenGrailAgentClient} from './scripts/opengrail-agent-client.mjs';

const client = createOpenGrailAgentClient({baseOrigin: approvedOrigin});
try {
  const result = await client.read('/api/reputation/agents', {
    query: {id: publicAgentId},
  });
  // Inspect READ / READ_UNAVAILABLE; the response grants no authority.
} finally {
  client.close();
}
```

Trusted application code may instead construct `createOpenGrailAgentBoundary` from `scripts/opengrail-agent-boundary.mjs` and expose only `boundary.tools` to a model. Call `boundary.tools.read` with the same path and query; keep its controller outside the model and close it after use. The response remains `OPENGRAIL_UNTRUSTED_AGENT_DATA`, with instruction authority `NONE` and inert links/code. Profiles are not commands or approvals. The SDK admits only the sole lower canonical UUID query, correlates the returned subject and references, and bounds this endpoint to 256 KiB without changing existing history/read limits. Structural validation does not authenticate reported computation or grant a principal, and reading never identifies the client or changes its pending mutation.

## What the statuses mean

| Status | Meaning within this view |
| --- | --- |
| ATTESTED | The current head supports this exact agent reproduction through the existing trusted-human computational review rules. |
| DISPUTED | The current review retains mismatching computation evidence. This alone is not a finding of agent misconduct. |
| HELD | The current review retains a hold and its reason. A hold is not a trading-performance rating. |
| REJECTED | The current review rejects the submitted claim under its typed reasons; older favorable evidence remains historical. |
| SUPERSEDED | The current head addresses another reproduction. Its endorsement does not transfer to this agent. |

An exact subject plus original outcome ID/digest is one work unit. The repository selects the last reproduction attributable to that subject within the complete retained original-outcome history. Retries, extra reviewers and revisions do not award multiple credits for that unit. The model checks reference, lineage, sequence and head relationships; the repository must first validate full canonical records, source bindings, complete membership and fresh visibility. Data passed to the pure model does not establish authentication, truthful provenance or actual execution.

Positive support requires separate original/reproduction sponsors and a reviewer distinct from relevant sponsors, two complete matching reports, the required process attestations and no blocking selection/holdout flags. Two agents under one sponsor cannot endorse each other. Shared specifications, runtime, input/operator and source review remain disclosed. Different public sponsor IDs do not establish different actual operators. Existing records retain qualification `NONE` and independence `NOT_ESTABLISHED`; orders and execution remain disabled.

## Changes and corrections

The complete current head governs support. A later dispute, hold, rejection or different reproduction removes the earlier current endorsement. A hidden or withdrawn head cannot cause fallback to an older positive review. A hidden dependency or hidden selected reproduction removes that unit from public evidence and counts, without revealing a suppressed-work total or its content. Restoration requires fresh validation and does not duplicate a unit; irreversible withdrawal is not restoration.

Use the existing authenticated review-report action to dispute an exact review ID/digest privately. Private report existence is not a public reputation signal. Existing separately authorized human reviewers may append permitted decisions; only the original human reviewer may withdraw their review, and moderators may hide/restore content without becoming reviewers. Agents cannot publish reviews or change profile totals. No new privileged grant, agent scope or reputation-write endpoint is introduced.

Credential expiry/revocation prevents future mutations but does not erase valid historical attribution. A replacement agent or equal display name inherits no work. Removing a reviewer permission stops new review mutations; it does not silently rewrite retained historical statements. The profile is not proof that an agent credential or reviewer grant is currently active.

## Bounds and acceptance

The view admits at most64 units and32 retained reviews per original outcome. Its whole UTF-8 response is bounded to256KiB. Overflow refuses the whole view; it does not trim adverse history or report a complete zero profile. Counts describe only the returned currently visible supported work, not all activity, independent success, or financial outcomes.

The repository's source snapshot admits at most 8 MiB of complete wire material, and its final closing proof admits at most 16 MiB. SQL-bound proof values remain at most 1,500,000 bytes, with at most 100 parameters and 100 KB SQL text. The source helper uses preflight and same-query byte admission before bounded payload retrieval; the planned populated-source path uses 13 SELECT statements. These are local admission limits, not proof of memory/CPU fit, every maximum input combination or hosted acceptance. No paid plan is assumed.

The profile projection can reuse a completed successful bindings result for the exact internally checked review within that request's read scope. Before validation awaits, profile-owned review and source graphs become immutable, including raw row metadata, public authors, shared nested record aliases and dependency arrays/results. A hit requires the same checked provenance and the exact retained original, reproduction, manifest, strategy and dependency row entries. Removed or replaced map entries fail unavailable without a source SQL fallback. Digest labels or a mutable object's identity cannot qualify a result for reuse. The existing verification memo continues freshly hashing normalized bytes.

This result memo applies only after source hydration (`profileSnapshotClosed`), which does not mean moderation or the final atomic proof is complete. It retains references to at most the existing 128 successful entries. Later entries receive complete validation; bounded ownership traversal exhaustion disables the request's result memo and also retains complete validation. Both limits govern reuse admission, without trimming catalogs or refusing otherwise valid work. Every request starts with a fresh scope. Permissions, current visibility and final profiles are never memoized; global/adverse history, complete projection, all 13 statements and the same final six-frame raw-field/membership proof remain required. Source-level regression cases cover aliases, retained-map corruption, distinct reviews, fresh reads and both fallback paths. On 14 October 2026, all 42 targeted tests and all 3,018 full-suite tests passed, along with type, build and diff checks. A fixed three-pair local comparison retained the same complete near-capacity dataset and responses and observed 77.5–78.3% lower application-isolate used heap at its repeated-profile checkpoint. This is a sampled local observation, not a peak, causal speedup, process-memory or hosted-capacity guarantee. See [the local memory comparison](benchmarks/profile-bindings-memory-2026-10-14.md) for every pair and its limits.

The closing statement expands the original bounded JSON chunks through a nested named `VALUES` rowset and `json_each`, avoiding a compound-SELECT term per chunk. Every chunk and selector binding retains its original order. The same single statement still compares every selected raw field and complete membership; it neither joins chunks into an oversized binding nor substitutes digest labels for source bytes. Local native regression cases cover six proof chunks, same-length corruption, removed and same-count replaced membership, empty frames and empty selectors. All 24 store tests passed on 14 October 2026; running the same tests against the preceding implementation reproduced four native compound-query failures. Their intentionally malformed raw payloads test the snapshot boundary only, not successful full-profile validation.

A separate earlier local native observation restored exact retained synthetic source catalogs into fresh databases. Its larger catalog contained 7,763,330 canonical wire bytes across nine reviews, 27 experiments and nine strategies. Both catalogs returned the same exact requested-agent unit and review history, with all 13 reads completed and the final raw-field/membership proof matching. The background human work did not receive agent credit.

A later accepted local observation used ten reviews, 30 experiments and ten strategies: 50 public source rows and 8,374,010 canonical wire bytes, approximately 99.8% of the unchanged 8 MiB admission bound. All four returned the same complete canonical profile except `observedAt`, retaining the exact seed, head and history. A genuine 9,303,370-byte catalog returned raw 503 above that bound. The 4,371-byte near-capacity acceptance receipt has SHA-256 `a96bc2ed89b5b89bfdcf699dbf8f588884447121b6c288e61c98268bb9736f70`. Local raw requests took approximately 2.6–2.9 seconds, with native D1 await time measured at 144–159 ms; those observations motivated this result-reuse proposal and do not measure its speedup. They establish this synthetic near-capacity shape, rather than every maximum combination. Hosted CPU/heap fit, real contributors, profitability, qualification and independence remain unestablished; the synthetic participants share an operator.

Read responses must use the complete current membership/head and dependency-visibility closure, explicit dynamic handling and no-store cache behavior. A concurrent change or inconsistent record is unavailable, rather than a partial favorable profile. The browser must discard stale suppressed entries on refresh. No background evaluator, provider fetch, contributed-code execution, paid inference, migration or permission installation is part of the profile projection.

Actual local fixtures should demonstrate a nonzero properly bound unit, a reproduced loss, retained mismatch and later adverse heads, sponsor/self-review refusal, suppression races, duplicate invariance, revocation boundaries and whole-view capacity refusals. Synthetic fixtures establish neither real contributors nor operational independence. Root owns actual tests/type/build/diff checks and rollout. The owner-approved platform goal permits developing this capability; successful checks or public beta access do not install reviewer grants, authorize paid services, financial execution, outreach or an unreviewed deployment.
