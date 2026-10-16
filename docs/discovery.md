# Search discovery and sharing

This is prepared source, not a claim that a search engine has indexed or recommended OpenGrail. The current live release and dated acceptance evidence are in [the public beta guide](public-beta.md).

## Public entry points

- `/documents/get-started`: short, server-rendered first-test walkthrough, generated continuation and voluntary feedback link.
- `/demo`: the generated strategy test, with costs and retained adverse history.
- `/agent-guide`: human sponsorship, scoped credentials and independent agent infrastructure.
- `/documents` and `/documents/whitepaper`: methods, participation rules and the draft vision.

The homepage, Demo and these document pages declare their own canonical URL and Open Graph/Twitter text metadata. The root layout sets no global canonical that would collapse every page to the homepage. The official origin is `https://opengrail.xyz`; self-hosted forks should replace `PUBLIC_ORIGIN` in `app/public-discovery.ts` and the origins in the two static discovery files.

`public/robots.txt` allows OAI-SearchBot and general search crawlers while excluding API, Session and Work paths. This is crawl guidance, not access control. Authentication, source suppression and quotas are unchanged. `public/sitemap.xml` lists only six stable public entry pages, with no user records, query parameters or invented last-modification dates. Training crawler policy is not changed separately.

After an approved release, verify anonymous HTTPS 200 responses for the two discovery files and six entry pages, their correct content types, canonical URLs and absence of a blocking robots tag. Verify the new guide’s actual buttons in a browser. Static source/build checks do not establish those hosted results. A verified site owner may then submit the sitemap in their search-console accounts; no submission, account verification or external outreach is performed by this change.

[Official OpenAI crawler guidance](https://developers.openai.com/api/docs/bots) explains OAI-SearchBot access. [Google’s sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) explains discovery hints. Crawl access, a sitemap, public source and metadata provide no guarantee of indexing, ranking, endorsement or traffic.

## First-use feedback invitation

Draft for separately approved sharing after the linked release is available:

> OpenGrail helps people and agents test trading strategies before risking money. Would you try the generated example at https://opengrail.xyz/documents/get-started and tell us where you got stuck? No deposit, exchange connection or paid AI API is needed. Generated returns are a demonstration, not a profit claim.

Ask whether they understood the purpose before clicking, reached a first result, how long it took, any help they needed, and what would make them return. Capture the exact release, first attempt and failures before a separate assisted attempt. Participants choose whether to share publicly; public feedback must contain no credentials or private financial records. Do not invent reviews, adoption counts, retention or willingness to pay. The [prepared independent trial](public-beta.md#one-independent-participant-trial) records the broader workflow and its evidence limits.
