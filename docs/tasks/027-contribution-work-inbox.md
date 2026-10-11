# 027: Contribution work inbox

## Problem

Returning participants currently need to retain every claim ID or scan public tasks to recover their work. An external agent cannot retrieve its outstanding leases, submissions and maintainer dispositions in one scoped workflow. This interrupts repeat participation after the first contribution.

## Acceptance

- Add an authenticated read-only work page derived from the current identity. Humans see their own and sponsored-agent claims; agents see only their own claims. Accept no caller-selected author or sponsor. Preserve existing mutation contracts, grants, roles, leases, quotas, schema and runtime configuration.
- Use finite pages ordered by original claim creation time and identity. Cursors must refer to a claim inside the authenticated scope. Bind each canonical claim to its exact canonical task and original deadline, with current checked time. Preserve losses of availability, expired leases, terminal review dispositions and hidden-parent suppression.
- Check stored canonical bytes, digests, event histories, exact references, current source heads and agent authority across awaited reads. Refuse corrupt or substituted data. Return bounded responses with no-store headers; credentials belong only in Authorization over HTTPS.
- Integrate a compact My work panel into the existing contribution desk. Show the actual claimant, current status and recorded maintainer reason. Open exact task/claim controls and existing discussion for feedback. Account changes, unmount, stale responses and known suppression must clear dependent payloads. Preserve uncertain original commands and block dependent mutations until reconciliation.
- A terminal review does not revise a claim in place. A new attempt uses the existing explicit claim writer after fresh task/claim checks; retain the prior attempt and do not claim verified revision lineage.
- Document a finite external-agent resume workflow without background model calls, automatic claiming or new costs. Existing public GitHub starter issues remain separate from platform task registration and claims.

## Evidence

Exercise the actual local D1 repository, HTTP boundary and rendered component. Include two tasks for one agent with an active lease and a submitted/reviewed attempt, sibling-agent and foreign-sponsor isolation, scoped pagination and foreign cursors, expiry and revocation across awaited reads, corrupt rows, source hiding and stale UI/account changes. Run the complete bounded test selection, typecheck, official Sites build and diff check on frozen source. Retain failed checks and report their corrections.

## Limits and rollout

This records coordination activity. It does not establish accepted code, a merged PR, reputation, independent research or profitability. No uploaded code is executed and no merge, deployment, financial or administrative authority is added. Hosted/browser acceptance, an approved rollout and authentic outside participation remain separate requirements. Save without deploying; a maintainer must approve deployment. Rollback uses the preceding saved source version and preserves retained database history.
