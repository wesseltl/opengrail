# Check a trusted local self-host build

Status: **LOCAL_COMPILED_CHECK_IMPLEMENTED**. The public command completed from a pinned clean local checkout on 13 October 2026. It checked the actual compiled app with synthetic fixtures; every operator must retain their own final result for their exact installation.

Use this check to inspect the actual compiled standalone OpenGrail application with synthetic local identities and databases. It connects the build to an observable sign-in, ownership and persistence check without configuring a real provider or hosted service. The [self-hosting guide](self-hosting.md) retains the separate production configuration and acceptance requirements.

1. Use a disposable clean clone at an exact reviewed commit. Read `AGENTS.md`, `package.json`, the lockfile and installation/build scripts before running code. This procedure is for source you trust; a checkout and cleared environment are not an OS sandbox for arbitrary contributed code.
2. Use Linux with Node >=22.13 and already installed locked dependencies. This local checker uses Linux procfs and `/usr/bin/git`. If dependencies are missing, perform the existing reviewed installation procedure separately. The check installs nothing, changes no dependency version and needs no AI account, model subscription, paid API or production secret. Keep the declared May 2026 Workers compatibility baseline; a local run proves neither newer platform semantics nor every operating system.
3. Prepare an existing directory outside the repository that you own, with mode `700`. Choose a new absolute child path that does not exist. Each invocation builds inside its own output, preserving any existing `dist-selfhost` build; you can use the same clean clone for another deliberately fresh attempt. Do not point the command at an old run, production database or backup. Keep this checkout free of operator dotenv/dev-vars and production configuration; those filenames are refused before and after compilation without reading their contents. The compiler input environment is cleared and HOME/TMP/config paths use the private output.
4. From the repository root, run the fixed command once:

   ```sh
   node scripts/selfhost-local-check.mjs --output /absolute/fresh/check
   ```

5. Read `result.json` and its bound source/build/Node identities. Successful local acceptance requires exit code 0, status `ACCEPTED_LOCAL_SELF_CHECK`, both collected original child waits, closed owned groups and observed descendants, and confirmed source/build preservation. An admitted `UNCONFIRMED` attempt exits with code 1. A preflight refusal may create no output; a missing or partial result never passes. Inspect failed or uncertain results first; do not overwrite their directories or erase an old build to retry. A deliberate new attempt needs another fresh output beneath an eligible private parent.

The command owns a bounded standalone build and local Miniflare run: limits are 600 seconds for build, 900 for native execution and 1,600 overall, with finite termination/drain windows. It uses the real compiled entry, pages and APIs with separate synthetic `DB` and `AUTH_DB`, a local signed RS256/S256 provider and ordered migrations. It checks 20 auth-consuming pages through 140 HTML and 140 full RSC observations, warm/overlapping users and anonymous access, ownership/scoped writes, logout/revocation, closed restart, separate closed backup/restore with epoch rotation, retained quota boundaries and corrupt signatures. Application presentation and authentication are not substituted. The seeded capacity records and registrations are synthetic, not 1,000 users or outside contributors.

The native child receipt has schema `OPENGRAIL_LOCAL_SELFHOST_BODY_V1`. Its `BODY_COMPLETE` status still carries `OUTER_EXECUTION_CLOSURE_PENDING`: the outer command must finish process closure and final guards. Read the final outer result, not a child receipt or build exit alone. A complete result is `LOCAL_SELF_CHECK`, qualification `NONE`, independence `NOT_ESTABLISHED`. It proves the recorded local behavior of those exact inputs and installed runtime, including retained negative checks. It does not establish safe upgrade, an execution sandbox, real-provider interoperability, production ingress, browser usability, legal rights, financial performance or actual user demand.

After admission, output retains the compiler's `compiled` tree, the held `build` tree, `admission.json`, `runtime-pins.json`, `build.stdout`, `build.stderr`, `build-phase.json`, corresponding `worker` files, native receipts and final `result.json` as each phase is reached. It is private and includes local synthetic response evidence and database/backup material. Keep it out of source control. Inspect material before deliberately sharing a minimal receipt; never add real cookies, keys, provider responses, private records or personal identity details. No upload, invitation, contact, account grant, source adoption or publication follows the command. A failure or hard interruption leaves evidence for inspection; uncertain closure is not a pass and requires operator recovery before reusing resources. Cooperative checks and process deadlines are not an OS sandbox.

Optional feedback can be a local text file containing only these four answers:

```text
Run result: complete / failed / uncertain
Useful step: ...
Blocker or setup friction: ...
Reuse: would run again / would not / unknown, because ...
```

No personal identity is requested, and the file is not submitted automatically. If you choose to return feedback through an already authorized channel, include only the exact source and minimal result reference needed to explain it. One report is one stated experience; repeated useful use, independent evaluation and willingness to pay require actual separate evidence.
