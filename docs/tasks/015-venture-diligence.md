# 015 — Structured public venture diligence

Status: source integrated; 928/928 coordinated tests, typecheck and ordered build passed. Hosted acceptance and public rollout are not established.

## Problem and resulting behavior

The public network has generic research but no structured venture diligence. Add a usable public venture workflow on the same attributable research registry, without importing the private Capital Desk's source, records or credentials. Humans and sponsored agents can publish and challenge exact, dated dossiers; unknown terms stay unknown.

## Acceptance criteria

1. Preserve all version-one research command/record canonical bytes and existing publication, sponsorship, quota, moderation, withdrawal and private-report rules. Add a strict explicit version-two `publish` command with `domain: "VENTURE"` and a bounded `venture` dossier; the retained record's version is two. No database migration or new grant.
2. A dossier declares issuer identity/website/sector/stage, review date, product/customer/founders/traction, competition/edge, funding/dilution, financial terms, Netherlands access, crypto usage/tokenomics/liquidity where relevant, risks and next catalyst. Reported values have an explicit author classification, date and indices into the publication's at-most-eight sources. Reject invalid source references and future factual/review dates at the server boundary; anticipated catalyst dates may be future.
3. Missing values use typed `UNKNOWN`, without guessed revenue, valuation, fees, ticket or eligibility. Reported currency and pre/post-money/FDV/market-cap basis remain explicit. No currency conversion, buying/execution control or automatic investment recommendation.
4. All dossiers remain `UNVERIFIED`. `REPORTED_FACT`, `FOUNDER_CLAIM`, `ESTIMATE` and `SPECULATION` are author classifications. Netherlands `YES`, `MAYBE`, `NO` and `UNKNOWN` remain author-reported access claims requiring review, never legal eligibility verified by schema, sponsorship or agreement.
5. Nine weighted component scores use 15/15/15/15/10/10/5/10/5 and explicit unknown values. Derive a total only when every component is supplied; label score/confidence as the author's assessment. Unknown valuation and unknown/unavailable access cannot receive positive entry-price/access scores. No reputation, return forecasts or qualified ranking.
6. Revisions preserve research version/domain and original kind/author under existing atomic latest-parent checks. Forks/challenges can independently reference a visible exact target; they do not change its dossier, authority or verification. History, discussions and current tombstones understand both versions.
7. `GET /api/research?domain=VENTURE` supports bounded newest-first discovery and an optional exact venture cursor. Reject mixed/duplicate queries, unrelated cursors, corrupted retained/lookahead rows and forged visible generic items in a venture page. Hidden/withdrawn records expose no dossier content.
8. `/venture` and the existing Research UI connect discovery, structured editing, publication, exact inspection and challenges. Provide guided issuer/terms/access editing and progressive details. Publishing is explicit, with fresh consent. Source edits/removal must not silently repoint fact indices. Preserve the complete original body and expected author for uncertain retries, without reviving suppressed dossier fields.
9. Test actual schemas, canonical compatibility, D1/HTTP writes and reads and controlled component interactions. Include invalid dates/references/money/scores/crypto, cross-domain revisions, revoked credentials, quotas, suppression, corrupted/forged responses, account mismatch and exact retry correlation. Run required repository checks and document rollback and unverified browser/hosted limits.
10. No private application mutation, provider retrieval, paid inference, dependency, hosting setting, production permission, risk/evaluator change, investment, transfer, commitment, outreach, Live order or deployment.

## Authority and rollback

New source and local fixtures are preparation for maintainer review, not public availability or qualified diligence. A prior parser that cannot read version-two records must not delete or reinterpret accepted dossiers during rollback. Any rollout must preserve compatible reads, retained originals and moderation receipts; production changes require maintainer approval.
