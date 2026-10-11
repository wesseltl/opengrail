# Public experiment registry API — source contract

## Separate review attestation contract

`GET /api/experiments/reviews?outcome=<original UUID>&digest=<SHA256>[&cursor=<review UUID>]` returns bounded summaries and `currentHead`; `?id=<review UUID>&digest=<SHA256>` reads one exact review. A human `POST` requires same origin, JSON, `X-Experiment-Review-Intent: submit` and `X-Experiment-Review-Author` matching authenticated identity. Publishing additionally requires a separate explicit reviewer grant. Commands use `review`, `withdraw`, `report` or `moderate`; policy is `public-experiment-review-v1`. Reviews bind original/reproduction/manifest/strategy, previous head, decision, typed reasons, paired reports or null, process attestations and disclosed dependencies/conflicts. Caller-supplied reviewer, permission or qualification fields are rejected.

`/api/experiments/reviews/me` exposes current human identity and separate reviewer/moderator flags. `/reports` is an explicitly authorized human moderation queue. `/agent` permits only private reports under current sponsored credentials. These additive source endpoints, tables and role configuration remain pending rollout approval. Full decisions, limits, retry/suppression behavior and rollback are in [the review guide](experiment-reviews.md). The existing experiment endpoint additionally accepts optional `X-Experiment-Author` to guard frozen identity; its canonical publication bytes are unchanged.

This contract describes the source increment under review. It does not establish a deployed service, approve production submission scope or install a moderator. [Experiment policy](experiment-policy.md) describes rights, retention and evidence limitations; [Demo methodology](demo-methodology.md) defines the declared local evaluator.

## Authority and transport

Public reads are anonymous. Human writes use the actual signed Sites identity, the exact request origin, `X-Experiment-Intent: submit` and `Content-Type: application/json`. Machine writes use an active registered-agent credential in the HTTPS `Authorization: Bearer <agent credential>` header. An agent request may omit Origin; a supplied Origin must equal the request origin. Credentials do not belong in URLs, command bodies or public artifacts.

Human and agent authorship is server-derived. Public human IDs have the form `human_<64 lowercase hexadecimal characters>` and use the existing stable public sponsor hash. Agents have their registered UUID, sponsor pseudonym and registered name in visible canonical records. Outer metadata and tombstones omit agent names. No owner email, Sites user ID, token, token digest or private account identifier is published.

The existing fixed public-research submission role supplies contribution authority only. This source endpoint expansion grants no execution, private-dashboard, account, moderation or administrative capability. Production rollout of the expanded intake requires approval. Moderation requires an explicitly allowlisted human; the allowlist defaults to none. Agents cannot moderate, including through receipt retries.

Requests use strict UTF-8 JSON, unique object keys and a maximum nesting depth of 16. Unknown command fields are refused. Request bodies and serialized responses are limited to 786,432 bytes (768 KiB). Responses use `Cache-Control: private, no-store`, `Vary: Cookie, Authorization` and `X-Content-Type-Options: nosniff`.

## Endpoints and pagination

| Method and path | Behavior |
| --- | --- |
| `GET /api/experiments` | At most 20 compact manifest summaries, newest first. |
| `GET /api/experiments?cursor=<manifest UUID>` | Next manifest summary page after the exact retained anchor. |
| `GET /api/experiments?id=<record UUID>` | One full current manifest or outcome projection. |
| `GET /api/experiments?outcomes=<manifest UUID>` | At most 20 compact outcomes for that exact manifest. |
| `GET /api/experiments?outcomes=<manifest UUID>&cursor=<outcome UUID>` | Next page using an outcome anchor belonging to the same manifest. |
| `POST /api/experiments` | Signed human command. No query parameters. |
| `POST /api/experiments/agent` | HTTPS bearer-agent command. No query parameters. |
| `GET /api/experiments/me` | Signed human's own public author/sponsor ID and moderator boolean. No database or machine credential disclosure. |
| `GET /api/experiments/reports` | Explicit human moderator's private report page, at most 20. |
| `GET /api/experiments/reports?cursor=<report payload digest>` | Next private page using its exact canonical report digest. |

Only the combinations above are accepted. Query keys occur once; IDs/cursors are lowercase UUIDs, except the private report cursor, which is 64 lowercase hexadecimal characters. A record detail cannot be combined with another parameter. Public feeds order by `createdAt DESC, id DESC`; private reports order by timestamp, author key and request ID descending. Unknown anchors return 404. Malformed queries return 400; ambiguous or corrupt retained anchors fail closed with 503.

Public page envelopes are `{version:1, items, nextCursor, executionEnabled:false}`. The cursor is the last returned record ID when another page exists, otherwise null. Full detail is `{version:1, item, executionEnabled:false}`. A compact summary carries IDs, digests, attribution, effective state, suppression, reporting/count metadata, and visible name/status/caution flags. It includes no canonical record, replay input, artifact or moderation history. Full records are fetched individually.

The private report envelope is `{version:1, reports, nextCursor, executionEnabled:false}`. Private details and reporter references are never included in public events or summaries. Permission is checked before private cursor lookup.

## Register an immutable manifest

The strict `register` command contains:

- `action: "register"`, lowercase UUID `requestId` and new record `id`, and `name` of 1–120 characters.
- `input`: the complete exact Demo request, including canonical strategy record/digest, supplied bars and signals, capital, hypothesis, falsification and any emergency boundary. Its strategy must exactly match a currently visible retained public strategy. Canonical input is limited to 196,608 bytes (192 KiB).
- `evaluator`: `version: "opengrail-demo-v1"`, author-declared `sourceVersion` of 1–80 characters, 64-hex `sourceDigest`, and 64-hex `methodDigest` matching the fixed Demo method metadata. Source declarations do not prove that code executed.
- `baseline: "COST_AWARE_LONG_SAME_ALLOCATION_V1"`. Its SHORT, failure and emergency comparability limitations remain those of the Demo methodology.
- `disclosures`: the required object described below.
- `policyAccepted: "public-experiment-v1"`.

Disclosures are strict nested objects:

- `search`: integer `trialCount` from 1 through 100,000; `selection` of `FIRST_DECLARED`, `BEST_OBSERVED` or `OTHER`; `logCompleteness` of `COMPLETE`, `PARTIAL` or `UNAVAILABLE`; and `log` up to 4,000 characters. `COMPLETE` requires nonempty text; the registry does not verify completeness.
- `validation`: `trainEvaluationOverlap` of `NONE`, `PRESENT` or `UNKNOWN`; boolean `holdoutDeclared`; `holdoutPriorAccess` of `UNSEEN`, `SEEN` or `UNKNOWN`; integer `holdoutReuseCount` from 0 through 100,000; and `note` up to 1,500 characters.
- `transformations`: at most eight nonempty strings of up to 500 characters; `seeds`: at most eight unsigned 32-bit integers.
- `conflicts`: at most eight nonempty `sharedDependencies` strings of up to 200 characters and `other` up to 1,500 characters.
- `publication`: literal `dataRights:true`, `publicData:true` and `publicArtifact:true`, asserting permission to use and publicly redistribute the supplied input and artifacts. These are contributor assertions, not verified licenses.

The canonical `MANIFEST` adds version, type, server receipt timestamp, authenticated author, derived caution flags, policy, `classification:"AUTHOR_REPORTED"` and `executionEnabled:false`. Its content order is name, input, evaluator, baseline and disclosures. Its canonical JSON is limited to 262,144 bytes (256 KiB); its SHA-256 identifies that exact stored record. Changed inputs or disclosures require a new manifest. This increment supplies no predecessor/correction link between manifests.

## Append an outcome

The strict `outcome` command contains `action:"outcome"`, new UUID `requestId` and `id`, name, exact `manifest:{id,digest}`, `result`, `claim` and `policyAccepted:"public-experiment-v1"`. Any authenticated contributor may append an attributable outcome; authors cannot replace another contributor's record.

`result` is one of:

- `{kind:"ARTIFACT", artifact:<complete Demo artifact>}`. Canonical artifact bytes must not exceed 524,288 (512 KiB). Declared method, artifact/input/result hashes and retained input are checked; retained input must exactly equal the manifest input. No server replay occurs. An internally consistent fabricated result remains possible and remains author-reported.
- `{kind:"INTERRUPTED", reason:<1–2000 characters>}`.
- `{kind:"ARTIFACT_UNAVAILABLE", reason:<1–2000 characters>}`. This records an explicit missing artifact, including an oversized local result, without claiming successful evaluation.

`claim` contains `type`, `relation`, at most eight `sharedDependencies` strings of up to 200 characters and `conflicts` up to 1,500 characters. `ORIGINAL` requires null relation and means an initial-report claim, not manifest ownership. `REPRODUCTION` requires `{type:"SUPPORTS",id,digest}`; `CONFLICTING` requires `{type:"CONFLICTS",id,digest}`. The reference must identify an exact currently visible outcome for the same manifest. An outcome cannot reference itself.

An immutable `OUTCOME` has the same canonical attribution/classification envelope as a manifest, content ordered name, manifest, result and claim, and a 589,824-byte (576 KiB) canonical limit. `SAME_AUTHOR` and `SAME_SPONSOR` compare the outcome reporter with the manifest author. Declared dependencies add cautions; no flag proves independence from the referenced report.

Both record types always carry `SOURCE_EXECUTION_UNVERIFIED` and `TIMING_UNVERIFIED`. Other flags reflect submitted disclosures and authenticated author/sponsor relationships. Publication, agreement and distinct agent IDs cannot create qualified or independently reproduced status.

## Retrospective continuous Demo snapshots (additive version two)

Existing version-one commands, canonical records and response envelopes retain their bytes and semantics. The same endpoints additionally accept `method:"CONTINUOUS_DEMO"` on a register or outcome command. These commands produce version-two records whose **content** carries that method. There is no new database, credential role, endpoint, quota or execution grant. Compact visible summaries additionally carry the method and may report Session statuses `ACTIVE`, `PAUSED`, `STOPPING`, `STOPPED` or `FAILED`.

A continuous register command contains the existing action/request/id/name/policy/disclosures fields, `method:"CONTINUOUS_DEMO"`, an exact continuous `input`, and a Session `evaluator`. It has no batch baseline:

- Input has `version:1`, `kind:"CONTINUOUS_DEMO_INPUT"`, exact `config`, original `startedAt`, `implementation:{version:"opengrail-session-v1",engine,model,journal}`, checked `methodDigest`, bounded `hypothesis` and `falsification`, and complete `events:[{event,receivedAt,stateDigest}]` from creation through this checkpoint. It also carries the original `journalDigest`, `finalStateDigest` and `receiptHead`.
- Each normalized event uses the existing strict Session schema. No receipt sorting, clock repair or dropped rejected transition is permitted. The count is bounded by the unchanged Session capacity; actual complete input bytes must fit the unchanged 192 KiB registry input budget.
- Evaluator carries `version:"opengrail-session-v1"`, declared `sourceVersion`, exact pinned `sourceDigests:{engine,model,journal}` and the matching method digest. These identities are declarations of the fixed implementation, not proof of provider delivery or execution.

A continuous outcome carries the same method and exact manifest reference. Its result is a continuous `ARTIFACT`, explicit `INTERRUPTED` or `ARTIFACT_UNAVAILABLE`. The artifact uses `version:1`, `kind:"CONTINUOUS_DEMO_ARTIFACT"`, `AUTHOR_REPORTED`/`NONE`/`NOT_ESTABLISHED` labels, disabled orders/Live, the complete identical input, checked `inputDigest`, declared terminal `projection` and checked `resultDigest`. Projection retains status/failure, data-gap/capacity flags, emergency/pending state, account mark/source times, open inventory, trades, equity observations, counts and terminal state/receipt identities. No batch liquidation or baseline is added.

The server checks bounded schemas/hashes, exact source/configuration/method and parent input, current visibility and existing atomic participation predicates. It does not reconstruct the Session kernel. A self-consistent fabricated projection can therefore remain a retained author claim. The fixed local Session evidence tool and Validation reader check all intermediate commitments, original journal digest and terminal projection through same-kernel reconstruction. This does not create independent research qualification.

Same-manifest reproduction/conflict semantics remain exact-input semantics: any later event prefix requires a new manifest. Registry receipt time cannot establish historical delivery or preregistration. A complete input over 192 KiB remains local and cannot be replaced by a trimmed tape or a parent-less unavailable report. `ARTIFACT_UNAVAILABLE` can retain a missing/oversized result only under a fitting exact manifest. Both methods share all current daily/global/per-manifest capacities and suppression/retry rules. See the [continuous evidence workflow](continuous-session-evidence.md).

## Withdrawal, private reports and moderation

These commands contain `requestId`, target `id`, exact target `digest` and `policyAccepted:"public-experiment-v1"`:

- `withdraw`: reason `AUTHOR_REQUEST`, `SPONSOR_REQUEST`, `PERSONAL_DATA` or `CREDENTIAL_EXPOSURE`. Only the original author or sponsoring human may withdraw the record. Author/sponsor reason codes must match that authority. Withdrawal is terminal.
- `report`: reason `SPAM`, `ABUSE`, `PERSONAL_DATA`, `CREDENTIAL_EXPOSURE`, `MISLEADING` or `OTHER`, with nonempty `details` up to 1,500 characters. The canonical private report is additionally limited to 4,096 UTF-8 bytes.
- `moderate`: explicitly allowlisted human only, state `VISIBLE` or `HIDDEN`, with safe reason `SPAM`, `ABUSE`, `PERSONAL_DATA`, `CREDENTIAL_EXPOSURE`, `MISLEADING`, `POLICY` or `RESTORED`. `VISIBLE` requires `RESTORED`; withdrawals cannot be restored.

Public events expose sequence, request ID, timestamp, stable actor reference, state and safe reason only. At most 15 ordinary moderation events may be appended, reserving event 16 for withdrawal. A moderator grant removed before a retry cannot be recovered by replaying an accepted command.

## Current visibility and receipts

Full items contain `id`, digest, type, request ID, receipt time, author IDs, exact strategy reference, outcome manifest reference or null, effective `state`, safe `reason`, `suppression`, `reporting`, `outcomeCount`, current `record` or null and public moderation events. A source strategy hidden or withdrawn suppresses its linked manifest/outcome bodies; a hidden or withdrawn manifest suppresses its outcomes. `suppression` is `SOURCE_UNAVAILABLE`, `PARENT_UNAVAILABLE` or null. An own terminal withdrawal takes precedence. Hidden/withdrawn summaries redact name, status and flags; full bodies, nested inputs/artifacts and agent names are suppressed. Bounded outcome metadata remains readable for a retained manifest tombstone, so an outcome's own author or sponsoring human can still withdraw it after someone else withdraws its parent. A later hidden referenced SUPPORTS/CONFLICTS outcome does not erase an already accepted metadata link or embed its former body.

`UNREPORTED` means zero retained outcomes. `AUTHOR_REPORTED` and the count include any retained outcome, including a foreign, hidden, interrupted, unavailable or failed report. They do not prove that the manifest author ran the experiment. Outcomes themselves are always author-reported and have zero outcome count.

A write returns `{version:1,action,requestId,item,report,executionEnabled:false}`. Reports return only a private receipt reference and no public item; other commands return the current item. Receipt correlation checks the exact submitted action, request, target, authenticated author and applicable material/event bindings. An identical retry is a current projection, rather than an old body snapshot; current suppression applies. Previously downloaded copies remain outside this boundary.

Request UUIDs are scoped to the authenticated author across registration, outcome, event and report actions in this experiment namespace. Reusing a request for different material returns 409. Another author cannot retrieve the first author's receipt by reusing the request or record ID. Research/strategy request namespaces remain separate. Revoked/expired agents cannot publish or reconcile using their former grant. Exact credential, source/parent/related visibility, UUID and capacity predicates share the mutation's atomic INSERT.

## Proposed quotas and errors

Five manifest registrations, ten outcomes and ten private reports per UTC day are shared by the human sponsor and all sponsored agents. Retained caps are 250 manifests, 500 outcomes, 32 outcomes per manifest and 500 private reports. Hidden and withdrawn records count. Identical retries consume no additional quota. Quotas and resource budgets require approval before production rollout; no automatic global reset or eviction is promised.

Malformed input uses 400, missing exact identities/anchors 404, unauthorized participation 401/403, changed request material or eligibility 409, byte limits 413, content type 415 and quotas/capacity 429. A daily-limit 429 may include a bounded `Retry-After` until the next UTC day; retained-capacity 429 has no invented reset time. Corrupt records or unexpected failures use generic 503 and a fixed diagnostic event without command, exception or credential contents. For an uncertain write, reconcile with the identical saved command; a new request UUID could create another immutable record.

The source registry verifies structure and digest consistency. It does not fetch submitted sources, execute code, validate unseen data, award reputation, rank strategies, connect a provider, place orders or grant access to private financial state.
