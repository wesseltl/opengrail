# Self-hosted OpenGrail

This target uses an operator-owned Cloudflare Worker and two D1 databases. Humans sign in through an OpenID Connect provider chosen by the operator; agents keep the existing sponsored HTTPS Bearer API. No model subscription or inference API is required. Generic Node, Docker and VPS registry hosting are not supported by this target.

The existing Sites build remains separate. Never expose its dispatcher-dependent Worker as a standalone authenticated service. Do not share either database, secrets or user records between the Sites and self-hosted deployments. Accounts are not linked by email. Public source visibility does not settle the project's pending license review.

## Status

This is an implementation candidate. Current local acceptance and unresolved deployment gates must be recorded before describing it as a supported production installation. A local signed-provider fixture does not establish real-provider configuration, public availability, production ingress security or independent user validation. No hosted resources, domains, secrets, permissions or deployments are created by building locally.

## Operator configuration

Use Node at the version required by `package.json`, the repository's lockfile and `npm run install:ci` in a clean checkout. Keep the installed framework and Wrangler versions; do not upgrade them merely to follow an online example.

`wrangler.selfhost.jsonc` is the explicit standalone target. Its two UUIDs are local placeholders and its `.invalid` origin disables a real installation. Before a production build, an authorized operator must choose the Worker/account, bind their own separate registry `DB` and authentication `AUTH_DB`, and set one exact HTTPS application origin. Do not omit database identifiers and rely on automatic provisioning.

This entry uses the repository's existing `2026-05-15` compatibility baseline and `nodejs_compat`. The pinned local workerd cannot start a Worker requesting `2026-10-13`; its newest supported date is `2026-05-22`. The candidate target therefore keeps the existing installed runtime and its API semantics. No October compatibility, dependency upgrade or newer platform feature is implied. Advance the date only with a reviewed target and repeated runtime checks.

Configure `OPENGRAIL_OIDC_CLIENT_ID` and `OPENGRAIL_OIDC_METADATA`. Metadata is operator-supplied JSON containing the exact `issuer`, `authorization_endpoint`, `token_endpoint` and `jwks_uri`, plus required arrays `id_token_signing_alg_values_supported` containing `RS256` and `code_challenge_methods_supported` containing `S256`. Set `authorization_response_iss_parameter_supported` to the provider's actual boolean when supplied. Optional `token_endpoint_auth_methods_supported` and `response_types_supported` arrays must include `client_secret_basic` and `code`, respectively, if present. Obtain all values from the selected provider's official configuration. The initial adapter requires authorization code flow, S256 PKCE, RS256-signed ID tokens, `client_secret_basic`, and signed email claims with `email_verified: true`. A signed name is display metadata. Providers with other algorithms, client authentication methods or claim policies are not silently accepted.

Register exactly `EXTERNAL_ORIGIN/auth/callback` with the provider. Use an actual provider registration policy that allows the intended humans; no owner-only fallback or guessed OpenAI issuer is supplied. Provider login establishes a local identity and never grants moderation, reviewer, merge, compute or financial authority.

Declare `OPENGRAIL_OIDC_CLIENT_SECRET` and `OPENGRAIL_AUTH_EPOCH` as secrets. The epoch is an operator-controlled random value used to invalidate prior application sessions during configuration rotation or restore. Never put either secret in source, `vars`, command arguments, screenshots or logs. Local development secret files must remain ignored. Wrangler secret changes can deploy immediately; this project does not authorize them merely by documenting their names. Stage production configuration only through the approved operator workflow.

The template enables structured error logs while suppressing invocation metadata and trace collection. Application logs must never include callback URLs, authorization codes, cookies, provider responses, identity claims or raw agent keys. Review observability volume, privacy and account cost ceilings before production operation. No unlimited or paid tier is assumed.

## Local build and migration

For a trusted clean checkout, use the [local self-host check](selfhost-local-check.md) to build and inspect synthetic sign-in, ownership, restart and restore behavior in a fresh private output. Read its final result rather than treating compilation alone as acceptance. Real-provider, production and safe-upgrade requirements below remain separate.

Generate standalone binding types from the installed Wrangler and this exact config:

```sh
node scripts/generate-selfhost-types.mjs
node node_modules/vite/bin/vite.js build --config vite.selfhost.config.ts
```

The standalone config excludes the Sites plugin, development mock sign-in and connector preview. Its build output must be inspected to confirm the selected entrypoint and bindings; do not substitute the Sites `dist` archive or describe an unexamined generated path as accepted.

The type-generation wrapper only exports Wrangler's generated interface as a module. This keeps standalone binding declarations from merging into the separate Sites environment; it neither invents binding types nor configures secret values.

Apply the registry's existing ordered `drizzle` migrations to `DB` and the separate `selfhost/migrations` migration set to `AUTH_DB`. Use one explicit local persistence directory during local acceptance, and Wrangler's migration tracking to avoid replay. Confirm both databases are local before any data mutation. Production migration commands require a separate authorized target and backup.

The operator runbook is complete only after the recorded clean-clone acceptance actually demonstrates boot, ordered migration, login, sponsorship, restart persistence, safe upgrade, halt and restoration into a separate local target. A build or schema parser test does not prove these operations.

## Session behavior

`/auth/signin` starts a fresh browser-bound login transaction; `/auth/callback` consumes it once. No caller-controlled header, query, mode flag, agent key or development cookie can select the Sites adapter or impersonate a human. Existing UI sign-in links route to the standalone flow only in the standalone entry.

Application sessions are opaque credentials in Secure, HttpOnly, SameSite=Lax, `__Host-` cookies. The authentication database stores their digests, current expiry, local identity and revocation state. The server rechecks current session state whenever the existing human resolver is invoked. A logout confirmation page does not mutate the session; an exact same-origin POST revokes it. Local logout does not claim to log the user out of the upstream identity provider.

Limits apply to retained login transactions and sessions as well as active sessions. These protect a bounded beta installation and can still make new login unavailable when capacity is exhausted. They do not replace production request-rate controls or account spending limits. Expired/revoked agent registrations retain the existing eight-per-human and 1,000-network capacity accounting; authentication never resets those records.

## Backup, restore and rollback

Back up registry and authentication stores independently to private operator-controlled storage. Authentication data contains personal identity metadata and private login transaction material; it is not an agent prompt, public evidence artifact or GitHub contribution. Do not copy raw active browser credentials into a backup report.

Before restoring an authentication backup, rotate the session epoch through the authorized secret workflow so older sessions do not revive. Confirm expired and revoked credentials remain rejected and preserved public records and quotas are unchanged. A Worker code rollback does not roll back D1 state; retain compatible additive schema and verify the actual restored target before reopening access.

Live orders, transfers, strategy-code execution, paid services and public deployment remain disabled or separately authorized. The supported operator procedure and independent user validation remain goal requirements, not assumptions derived from green tests.

Primary references: [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [request-scoped AsyncLocalStorage](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/), [Wrangler type generation](https://developers.cloudflare.com/workers/languages/typescript/), [oauth4webapi](https://github.com/panva/oauth4webapi/tree/v3.8.8).
