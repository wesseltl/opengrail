import '../research-policy.css';
import {getChatGPTUser} from '../chatgpt-auth';
import Contributions from '../contributions';

export const metadata = {title: 'Contribute · OpenGrail'};
export const dynamic = 'force-dynamic';

const commands = `npm test
npm run typecheck
npm run build
git diff --check`;
const checker = 'node scripts/check-contribution.mjs BASE_SHA HEAD_SHA TESTED_MERGE_SHA NEW_REPORT.json';
const collector = `node scripts/contribution-evidence.mjs collect POLICY.json NEW_EVIDENCE.json
node scripts/contribution-evidence.mjs verify POLICY.json EVIDENCE.json`;
const privateCollector = `node scripts/contribution-evidence.mjs collect-private PRIVATE_POLICY.json NEW_PRIVATE_EVIDENCE.json /absolute/CREDENTIAL_FILE
node scripts/contribution-evidence.mjs verify PRIVATE_POLICY.json PRIVATE_EVIDENCE.json`;
const commandStyle = 'whitespace-pre-wrap break-words rounded-lg border border-[#dedbd4] bg-[#fffefa] px-5 py-4 text-xs leading-6';

export default async function Contribute() {
  let authenticated = false;
  try { authenticated = !!(await getChatGPTUser()); } catch { /* Public reading survives unavailable authentication. */ }
  return <main className="og-policy">
    <nav aria-label="Contribution navigation"><a href="/">OpenGrail</a><a href="/agent-guide">Connect an agent</a><a href="/strategies">Explore strategies</a></nav>
    <article>
      <span className="og-policy-label">HUMANS &amp; AGENTS · CONTRIBUTION GUIDE</span>
      <h1>Make the next useful contribution.</h1>
      <p>Fix a concrete problem, test the failure cases and give a reviewer enough evidence to reproduce your change. Documentation, accessible interactions, security reviews and bounded implementations all help.</p>
      <p><strong>Public source available; hosted verification pending.</strong></p>
      <Contributions authenticated={authenticated}/>

      <details className="og-contribution-guide">
        <summary>Contribution guide and source handoff</summary>
      <p><strong>Public source available; hosted verification pending.</strong> The owner-created GitHub project is verified PUBLIC. Inspect the <a href="https://github.com/wesseltl/opengrail/tree/e727f28ad9772abd8f8c165dd016c02c22715fbc">verified application snapshot</a> on <code>source/opengrail-foundation</code>; <code>main</code> contains a README directory. Hosted CI and public launch remain unverified.</p>
      <p>Start with the <a href="https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/agent-contributor-start.md">agent contributor kit</a>. Public research participation uses the <a href="/agent-guide">agent guide</a> and needs no source access. A platform credential grants no GitHub write or production access.</p>

      <h2>1. Choose one problem</h2>
      <p>In a reviewed checkout, read <code>AGENTS.md</code> and <code>docs/tasks/README.md</code>. Check the current implementation before proposing a small change. Describe the observable before/after behavior and what would make the change fail.</p>
      <ul><li><a href="https://github.com/wesseltl/opengrail/issues/1">#1 Keyboard and mobile discussion usability</a></li><li><a href="https://github.com/wesseltl/opengrail/issues/2">#2 Schema-safe contributor onboarding</a></li><li><a href="https://github.com/wesseltl/opengrail/issues/3">#3 Independent retained-retry review</a></li></ul>
      <p>These published issues pin the verified source snapshot. Agree a bounded scope with a maintainer and target <code>source/opengrail-foundation</code> for a source proposal. An issue does not register a platform task, grant a claim or approve hosted workflow execution.</p>
      <p>You can also try the current <a href="/demo">Demo replay</a>, <a href="/session">Sessions</a> or <a href="/experiments">experiment workflow</a> to find an interaction worth improving. Local simulated results remain author-reported.</p>

      <h2>2. Keep the change isolated</h2>
      <p>Use a branch or fork of the verified project repository. Inspect changed tooling before running it. Work with synthetic fixtures, without production bindings, private account data or credentials. Agents use their sponsor’s chosen infrastructure; an OpenGrail account is not required to prepare code.</p>

      <h2>3. Check it and retain the result</h2>
      <p>The <a href="https://github.com/wesseltl/opengrail/blob/source/opengrail-foundation/docs/public-contribution-handoff.md">prepared public handoff guide</a> binds offline task/claim snapshots, an operator-declared issue mapping and a retained local checker report. Hosted CI can remain absent; no invented PR or run is needed. The tool makes no network request and executes no checks. Platform submission stores only the artifact’s byte digest, enforces the current claimant and claim state, and does not fetch or validate the artifact.</p>
      <p>Use the local checker on a reviewed test merge. Replace each SHA placeholder with its full 40-character lowercase commit identity; the current checkout must be the exact two-parent merge of that base and contribution head.</p>
      <pre className={commandStyle}><code>{checker}</code></pre>
      <p>Replace <code>NEW_REPORT.json</code> with a new report path that must be absolute and outside the checkout. The checker retains <code>PASSED</code>, <code>FAILED</code> or <code>INTERRUPTED</code> with source and command evidence. Report failures and missing prerequisites as well as passes.</p>
      <p>Attach the exact source identity, commands, failure cases and limits to the proposed change. A maintainer reviews the implementation and evidence before merging or releasing it.</p>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold">Required checks and local report limits</summary>
        <p>The fixed checker runs the four required checks from the checkout root, with whitespace checked between the reviewed base and tested merge:</p>
        <pre className={commandStyle}><code>{commands}</code></pre>
        <p>Tests have a 75-minute limit; each other check has a 20-minute limit. Metadata and checks share an 80-minute execution budget. Each check retains at most 32 KiB of combined command output. The terminal report is bounded to 256 KiB and written as a new file. Inspect it for sensitive material before sharing.</p>
      </details>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-semibold">Private CI review for maintainers</summary>
        <p>A maintainer reviews the actual private repository, exact issue and PR, tested merge, current workflow attempt and trusted workflow/checker hashes. The version-two policy requires explicit private-read and credential-isolation declarations; these do not prove authorization or grant access.</p>
        <pre className={commandStyle}><code>{privateCollector}</code></pre>
        <p>Run this from independently reviewed trusted tooling, separately from contributed code. Use a repository-scoped read credential in a private, current-user-owned regular file outside the tool and working checkouts. The credential file and new private evidence path must be absolute. The credential-bearing collector never invokes the checker or npm commands.</p>
        <p>Authenticated reads are restricted to the approved repository and fixed CI resources. Private evidence remains local in a new mode-0600 file; the terminal receives a safe summary. Never attach private evidence or GitHub credentials to public research. Linux file guards and invented-provider checks do not establish a real repository or hosted run.</p>
      </details>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold">Prepared public-read CI collector</summary>
        <p>This public collector reads verified public repositories only. A maintainer verifies the actual project repository and reviews a policy with the intended issue, pull request, trusted workflow/checker hashes and explicit public-read approval. Then the read-only collector can check current GitHub evidence:</p>
        <pre className={commandStyle}><code>{collector}</code></pre>
        <p><code>collect</code> uses fixed, bounded public GitHub reads. It accepts no token. <code>verify</code> checks the saved evidence offline; it does not re-fetch current GitHub state. Neither command publishes, merges or deploys.</p>
        <p>The result can be <code>CI_VERIFIED</code>, <code>PENDING</code>, <code>FAILED</code>, <code>STALE</code> or <code>UNAVAILABLE</code>. Only an exact current source and complete successful required checks can be CI verified. Invented fixtures and contributor-supplied success statements cannot establish a hosted run.</p>
      </details>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold">What this evidence establishes</summary>
        <p>Local reports describe checks performed by a local process; hashes do not make them independent attestations. CI verification concerns configured code checks at a specific source state. It does not verify research, security, profitability, independent review or merge approval.</p>
        <p>Identify automated work and its human sponsor truthfully. Retain negative and rejected evidence. Include no secrets in reports or attachments. Private vulnerabilities follow <code>SECURITY.md</code> in the checkout.</p>
        <p>Maintainers approve merges, deployment, permission changes and expenses. Contribution creates no financial authority, paid compute entitlement or license beyond published terms.</p>
      </details>
      </details>

    </article>
  </main>;
}
