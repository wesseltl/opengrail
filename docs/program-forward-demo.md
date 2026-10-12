# Persistent programmable forward Demo

Task 033 adds a separate local method for carrying a tested V2 program into ongoing Demo execution. Its local source and synthetic acceptance are recorded in [the task 033 receipt](../validation/program-forward-demo-20261011.json); later connected acceptance is retained in [task 035](../validation/direction-matched-program-search-20261012.json) and [task 037](../validation/prospective-program-commitments-20261012.json). These checks do not establish hosted availability, authentic observations or a completed forward horizon. See [the exact task](tasks/033-programmable-forward-demo.md) for requirements.

A forward program retains its globals and memory as accepted closed bars arrive. Its generated decisions use the existing Session account, fee, allocation, risk and protective-quote logic. It is not a sequence of cold batch runs. The source strategy remains the exact V2 publication; the private V1 projection used by the trading kernel has separate identities and cannot be passed off as the original publication.

## From selection to a session

Programs Search first freezes every candidate and the common TRAIN protocol. Every TRAIN disposition remains in the complete ledger. Selection is locked before the one separately admitted TEST. A terminal loss, failure or interruption consumes TEST. None establishes qualification or a profitable strategy.

A locked forward handoff carries the whole ledger, not just the winner. Programs planning requires a selected exact source and the terminal TEST. A prospective plan freezes unchanged capital, market, costs and risk, a later nominal interval and fresh authorized data rights. The synthetic exercise path is separate and explicitly invented. It cannot establish public source authenticity, authentic provider observations or unseen-data custody.

The plan binds a session configuration and the exact forward, interpreter and trading-kernel implementation identities. First prospective freezing refuses a nominal start that has already passed. A standalone configuration is not proof of a complete search plan. Importing either is an inspection step; execution and provider connection require separate deliberate actions. Exports retain failed trials and original source identities. An oversized full artifact is refused intact rather than having adverse history removed.

The legacy Search evaluator still marks SHORT results noncomparable and refuses them as ranked winners. The separate direction-matched V2 method supplies within-direction selection and an accepted synthetic selected SHORT Search-to-collector journey, retaining the losing TEST and forward history. See [the task 035 receipt](../validation/direction-matched-program-search-20261012.json). This does not change legacy comparability or establish authentic observations, independent custody or complete forward horizons.

## Clock and state

Producer events are CLOSED_BAR and QUOTE. PAUSE, RESUME and EMERGENCY belong to the owner. Supplied SIGNAL events are rejected because this method derives its signals from the exact program.

The outer journal records the original input, its original local receipt and an admission before computation. An accepted closed bar advances the retained guest once at its contiguous accepted-bar index. Rejected, duplicate, stale, out-of-order and missing-sequence bars do not advance it. Historical warmup cannot create prospective fills.

A generated signal becomes available at the retained actual post-guest completion clock. A quote observed before that clock cannot fill the decision even if delivered later. Reconstruction uses the recorded completion time rather than assigning a new time. Local clocks and supplied observation timestamps remain author evidence, not authenticated upstream arrival or execution attestations.

Configuration runs only after the first executable accepted bar is durably pending. The interpreter remains the fixed restricted implementation; a contributed binary is parsed data rather than a native executable module. Invocation and cumulative fuel are finite. Every output, fuel count, intermediate state digest and final or failed globals, raw global bits and memory are retained. Raw bits preserve distinctions such as negative zero that ordinary JSON numbers cannot express.

## Durability and failures

An input must be confirmed pending before its guest executes. The complete terminal must be confirmed durable before acknowledgement or another event advances. Local file confirmation includes file synchronization, parent-directory synchronization and exact readback. Browser confirmation requires the native strict IndexedDB transaction to complete before creating a module Worker.

After uncertain persistence, the runtime discards any mutated volatile instance and reconstructs the actual durable journal. A process killed with a pending input retains that same identity as INTERRUPTED and pauses admissions. It cannot silently rerun as a newly completed input. Explicit owner resume can follow an interrupted operation. A guest trap or fuel failure preserves partial mutations and consumed fuel and prevents new admissions.

Pausing admissions does not erase open exposure. Later usable quotes continue the unchanged protective exits. Emergency stopping cannot invent a fresh liquidation price. Paused bars may advance indicators and guest state, but cannot leave a decision that unexpectedly enters after resume. No historical candle extrema or artificial batch-end exit substitutes for a received quote.

Capacity is finite. Admission reserves complete terminal evidence and inner bar/signal/failure-pause slots before computation, with separate emergency and protective-quote headroom. Reaching a bound retains the whole unfavorable history and refuses further ordinary admission. It does not guarantee that a future quote can settle every position.

## Inspecting the evidence

The outer program journal and inner trading journal have different sequences. A raw observation maps to the original outer market event; generated signals and recovery controls map separately to inner transitions. A collector cannot claim a generated decision came directly from a provider.

Reconstruction starts a fresh fixed-code guest, applies the recorded configuration once, and replays the completed accepted-bar prefix. It checks outputs, consumed fuel, intermediate state, raw bits, memory and the complete inner trading history. A self-consistent hash over an invented snapshot is insufficient. This is same-implementation reconstruction and provides no independent qualification.

After an explicit successful Worker reconstruction, Session offers `Export complete program reconstruction`. It retains the complete original and reconstructed journals together, with their source identities and author-reported interpretation. Another input, reload, source suppression or owner change clears the held reconstruction and requires a fresh explicit check. Complete history export remains available separately; import and reload execute no guest.

The local monitor exposes strict confirmed projections: original V2 identity, program status, fuel, latest output, outer and inner sequences, positions and risk. Complete memory and trace belong in deliberate full exports. Receiver credentials do not belong in exports, URLs or the public app. The authorized loopback monitor holds its owner token only in memory and sends it in the Authorization header to its local receiver.

## Sponsor-local operation

Export a complete prospective plan and its exact receiver config from Plans. Keep both files: config alone is not proof of the search or plan. Synthetic exercises use their separate virtual clock and cannot open connected intake. The runner requires the reviewed local Node dependencies, Python 3, Linux `/proc` and a filesystem supporting the declared locking and synchronization. Use canonical absolute private paths outside the checkout and current working directory, with existing data files mode 0600.

```sh
node scripts/program-session-runtime.mjs start /private/run/config.json /private/run/new-journal.json
node scripts/program-session-runtime.mjs resume /private/run/journal.json
node scripts/program-session-runtime.mjs verify /private/run/journal.json
```

The connected runner accepts one normalized event per standard-input line. Starting an empty session invokes no guest. Resume reconstructs completed history and confirms a recovery pause before READY; preserve the same journal and explicitly resume admissions. A transport rejection is distinct from a retained normalized input. Malformed transport bytes are not represented as successful guest attempts.

The separate loopback receiver uses `scripts/program-session-receiver.mjs`. Its explicit `credentials` command creates distinct local producer and owner roles and stores hashes, not raw credentials. Keep the returned secrets in operator memory. Producer authorization permits market inputs and their own receipts; the owner may inspect the strict monitor, export the full journal and issue controls. Public agent credentials grant no local receiver access. Do not expose this loopback service remotely or place credentials in URLs, source, files or screenshots.

```sh
node scripts/program-session-receiver.mjs start /private/run/config.json /private/run/new-journal.json /private/run/roles.json
node scripts/program-session-receiver.mjs resume /private/run/journal.json /private/run/roles.json
node scripts/recorded-program-kraken.mjs start /private/run/plan.json /private/run/config.json /private/run/new-observations /private/run/journal.json --retain-public-data
node scripts/recorded-program-kraken.mjs resume /private/run/plan.json /private/run/config.json /private/run/observations /private/run/journal.json --retain-public-data
node scripts/recorded-program-kraken.mjs verify /private/run/plan.json /private/run/config.json /private/run/observations /private/run/journal.json
```

Collector start/resume receives its bounded authorization through standard input only. It binds the actual receiver instance/start/implementation, local producer role, frozen poll/cycle budget and explicit public-data-use/shared-IP budget approvals. `--retain-public-data` is deliberate local retention consent, not provider permission or a license. Keep the original raw archive after interruption or an uncertain acknowledgement. Resume verifies the whole raw/outbox/journal evidence before delivery. Reconciliation uses the original event identity; it cannot substitute a newly generated input. After the nominal end it can retrieve an existing receipt only: missing or uncertain acknowledgement preserves the original input, and no new POST or provider capture is allowed. A completed finite budget does not prove the nominal forward horizon was observed.

The collector uses the unchanged Kraken normalization method and separately retains raw responses, original outer outbox and actual program/trading journal. Verification binds each raw request to its declared poll/endpoint slot, reproduces normalization, and correlates receipt digest pairs with actual reconstructed journal checkpoints. A lost acknowledgement may refer to a later confirmed checkpoint, but cannot claim an invented history. Local tests use explicitly synthetic responses; they do not verify a genuine provider run. Verification returns complete local evidence with source authentication UNKNOWN and independent qualification NONE. Nothing on the website launches this collector automatically.

## Remaining work

The additive [shared forward evidence source increment](public-program-forward-evidence.md) distinguishes `PROGRAM_FORWARD_DEMO` version-four records from continuous rule Sessions and cold program runs. Its inert registry, explicit local reconstruction and paired-review path have accepted local checks in [task 034’s receipt](../validation/public-program-forward-evidence-20261012.json), followed by the connected synthetic journeys in [task 035](../validation/direction-matched-program-search-20261012.json) and [task 037](../validation/prospective-program-commitments-20261012.json). These results do not establish public availability, authentic observations, independent custody or completed forward horizons. Authentic licensed observations, independent custody, verified useful contributors, reuse and retention, and approved hosted rollout remain required.

Task 033's original selection policy still declares SHORT noncomparable, and its retained failed selection is unchanged. The additive [direction-matched V2 workflow](direction-matched-program-search.md) supplies a separately frozen within-direction method, whole reference trading results, a sole cold TEST and its own collector. Its complete actual-clock synthetic SHORT acceptance is recorded in [task 035’s receipt](../validation/direction-matched-program-search-20261012.json); both forward horizons remain incomplete. A LONG winner, separate SHORT runtime or synthetic feed presented as authentic observations cannot satisfy that acceptance.

Classification is AUTHOR_REPORTED; qualification NONE; independence and unseen custody NOT_ESTABLISHED. Source saving does not deploy the app, start a provider, create a public execution sandbox or enable Live trading. The separate private Capital Desk and existing program, rule-session and collector identities remain preserved.
