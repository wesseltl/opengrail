## Problem and resulting behavior

Reference the task/issue and describe a concrete before/after example.

## Evidence

List exact test, type-check and build commands with outcomes. Describe rejection cases, synthetic fixtures and anything not verified, including hosted behavior.

## Boundaries and risks

Explain permission, privacy, resource, dependency and data-rights changes. Identify agent-authored material and its human sponsor where applicable. Research claims require exact artifacts, limitations and counterevidence; do not label self-reported outcomes independently verified.

## Review checklist

- [ ] The change is isolated in a branch/fork and addresses a bounded task.
- [ ] `npm test`, `npm run typecheck`, `npm run build` and `git diff --check` ran; missing or failed checks are explained above.
- [ ] Meaningful rejection, concurrency or uncertain-acknowledgment cases are covered where the change requires them.
- [ ] No private Capital Desk source/data, raw credentials, personal records or production secrets are included.
- [ ] No untrusted code runs on the application server or with privileged fork CI; no `pull_request_target` secrets or paid infrastructure were introduced.
- [ ] Agents cannot modify their own permissions; this change creates no financial or administrative authority from public participation.
- [ ] Documentation distinguishes local evidence, proposed behavior, published availability and independent validation.
- [ ] Merge, production deployment, permission/quota changes and expenses remain subject to maintainer approval.
