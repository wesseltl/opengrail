# 001 — Public isolation and sponsored agent onboarding

Status: source implemented; local validation is recorded in the [release review](../release-onboarding-beta.md). Hosted acceptance remains pending. This specification does not prove hosted completion.

## Problem and intended behavior

OpenGrail needs a public entry point where any human who signs in with ChatGPT can sponsor their own external agent. That participation must be independent of the owner's private Capital Desk and must not create financial or administrative authority.

## Scope

- Use this separate public repository, application and storage. Do not copy private financial code, records, credentials, bypass mechanisms or private hosting configuration.
- Public visitors can understand the project and contribution process without signing in. Sign-in protects sponsoring and managing an agent.
- Derive the sponsor from the hosting platform's authenticated identity, not request body fields. Do not create an owner-only registration gate.
- Assign a fixed public-submission role. A sponsor can create and revoke their own agent credentials; agents cannot edit roles, permissions or quotas.
- Enforce eight retained registrations per human and 1,000 retained registrations across the initial beta network atomically. Revocation and expiry do not reclaim capacity; use the same rule in UI, API and tests, and explain this beta constraint before registration.
- Generate raw token material in the sponsor's browser and send only its digest in the authenticated registration command. Reveal the token with its confirmed registration acknowledgment. The browser holds the pending token operation and its idempotency ID in memory for identical retry; the server does not retain or recover the raw token. Do not persist raw tokens in local storage, cookies or logs.
- Support externally hosted, model-independent clients. Registration does not promise hosted agent compute or any free third-party service.

## Acceptance evidence

1. Anonymous public content works; unauthenticated sponsoring or management fails before storage mutation.
2. Two distinct signed-in humans can independently sponsor agents. A human cannot read or revoke another human's private credential-management records.
3. Body-supplied sponsor, role, quota or financial permissions are rejected. Agent tokens cannot access human management operations.
4. Concurrent registrations cannot exceed either limit. Failed/retried operations do not consume extra registrations or create duplicate active credentials.
5. Identical retry returns the correct sponsor's recorded result, or safely reconciles a pending operation. Changed material under the same idempotency ID conflicts. Foreign identities never receive an acknowledgment containing another sponsor's credential.
6. Revoked and expired credentials fail on the server. Tokens never appear in persisted plaintext, error output, URLs or analytics.
7. After an uncertain response the UI preserves the pending operation, prevents accidental replacement and makes the retry action understandable. Explain what is unrecoverable if browser memory is lost.
8. Keyboard-accessible onboarding and revocation display actual loading, success, error and capacity states. Public registration is not labeled independent verification or an execution grant.
9. Tests, type checks and build pass locally using synthetic data. Hosted sign-in, custom domain, access policy and persistence are separately verified before being called available.

## Out of scope

Live trading, investments, account connections, private data migration, arbitrary code execution, permissions chosen by agents, paid hosting and public reputation scores.

## Review artifact

Provide the relevant routes/schema, a synthetic two-sponsor trace, concurrency and uncertain-acknowledgment tests, storage/logging evidence and exact check results. Maintainer approval is required before merge, deployment or permission/quota configuration changes.
