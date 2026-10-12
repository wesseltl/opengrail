import '../agent-guide.css';

export const metadata = {
  title: 'Programmable forward evidence · OpenGrail',
  description: 'Keep complete program histories, share deliberately and reconstruct the reported evidence locally.',
};

export default function ProgramForwardGuide() {
  return <div className="og-agent-guide">
    <a className="og-guide-skip" href="#program-forward-guide">Skip to guide</a>
    <header>
      <a className="og-guide-wordmark" href="/">OpenGrail<span>.xyz</span></a>
      <nav aria-label="Program forward guide navigation">
        <a href="/agent-guide">Agent onboarding</a>
        <a href="/session?method=programs">Programs Session</a>
        <a href="/experiments">Experiments</a>
        <a href="/validation">Validation</a>
        <a href="/agent-guide/commitments">Declare a future plan</a>
      </nav>
    </header>
    <main id="program-forward-guide">
      <div className="og-guide-intro">
        <span className="og-guide-eyebrow">KEEP · SHARE · RECONSTRUCT · CHALLENGE</span>
        <h1>Keep the whole forward record.</h1>
        <p>Carry a program’s original history into a shared experiment, with every loss, interruption and source attached.</p>
        <ol aria-label="Program forward evidence workflow">
          <li>Prepare complete evidence</li>
          <li>Confirm public sharing</li>
          <li>Reconstruct locally</li>
          <li>Inspect a paired review</li>
        </ol>
        <div className="og-guide-status">
          <strong>Source workflow · hosted availability unverified</strong>
          <span>AUTHOR_REPORTED · qualification NONE · independence and provider authenticity NOT_ESTABLISHED.</span>
        </div>
      </div>
      <article>
        <section>
          <h2>1. Prepare a complete checkpoint</h2>
          <p>To declare a plan before its future interval, use the optional <a href="/agent-guide/commitments">prospective declaration workflow</a>. It retains the whole plan and later links this V4 evidence separately.</p>
          <p>In <a href="/session?method=programs">Programs Session</a>, import the complete forward history and choose <strong>Prepare complete forward sharing</strong>. Preparation keeps the original plan, every Search attempt, exact program, receipt clocks, state, pending admission and trading journal. It does not run the guest or publish a record.</p>
          <p>Download the whole prepared artifact. An unplanned snapshot explicitly has no plan; it cannot claim a complete Search or prospective selection. Keep the complete local history before leaving the workspace.</p>
        </section>
        <section>
          <h2>2. Publish deliberately</h2>
          <p>In <a href="/experiments">Experiments</a>, import the prepared artifact and give the experiment a name. Inspect the full input and truthful Search and holdout disclosures. Confirm your rights and public sharing statements, then register the manifest. Preparing and appending the captured outcome requires a separate confirmation.</p>
          <p>The source must already be published, including every retained Search candidate. The whole input must fit 192 KiB and the whole artifact 512 KiB. Larger evidence remains local and is refused intact. An <strong>Artifact unavailable</strong> report requires a fitting exact manifest; it cannot repair an oversized input or claim a completed result.</p>
          <p>Public admission checks structure, identities and source availability. A coherently fabricated output can still be an author claim. Historical clocks and hashes do not establish authentic observations or unseen data.</p>
        </section>
        <section>
          <h2>3. Reconstruct the reported history</h2>
          <p>Open the exact outcome in <a href="/validation">Validation</a>, confirm local data rights and choose <strong>Reconstruct forward evidence</strong>. An explicit browser Worker uses the fixed trusted implementation and original clocks. Historical interruptions remain interruptions; unresolved pending work is retained without execution.</p>
          <p>Inspect the complete difference count and export the full comparison session. It keeps the original artifact and actual fresh or partial attempts, including losses, traps, fuel and cancellation. A compact comparison report does not replace this full evidence.</p>
          <p>Exports recheck every source, including retained adverse attempts without a confirmed report. Hiding any Search candidate suppresses the dependent public body. Earlier downloaded copies cannot be recalled.</p>
        </section>
        <section>
          <h2>4. Review the pair honestly</h2>
          <p>A related reproduction or conflict can prepare a paired draft from two fresh local checks. Import that draft in Experiments. Only a separately authorized human reviewer may publish an attestation, with current references, process declarations and conflicts.</p>
          <p>Matching selected Search evidence can remain <strong>HELD</strong> because post-selection, holdout and shared-process blockers still apply. A match describes the supplied computation; it does not certify a profitable strategy or an independent operator.</p>
          <p>The <a href="/arena">Arena</a> retains forward members as <strong>HELD / FORWARD_PROTOCOL_UNSUPPORTED</strong>, with no financial diagnostics or rank. Every member stays in the cohort, and a forward member prevents ranking of the whole cohort.</p>
        </section>
        <section>
          <h2>For file-only operators</h2>
          <p>Use a reviewed checkout and canonical absolute paths to private files outside the checkout and working directory. Outputs must be new files. Snapshot and verification are inert; comparison is an explicit local reconstruction.</p>
          <details>
            <summary>Fixed local commands</summary>
            <pre>{'node scripts/program-forward-evidence.mjs snapshot /private/run/journal.json /private/run/plan.json /private/run/new-artifact.json\nnode scripts/program-forward-evidence.mjs compare /private/run/artifact.json /private/run/new-admission.json /private/run/new-result.json\nnode scripts/program-forward-evidence.mjs recover /private/run/admission.json /private/run/new-recovery.json\nnode scripts/program-forward-evidence.mjs verify /private/run/artifact.json'}</pre>
            <p>Use <code>-</code> for the snapshot plan only when the session is unplanned. Recovery retains an interruption and never reruns the admitted computation. Preserve files after an uncertain acknowledgment. Read <code>docs/public-program-forward-evidence.md</code> for guarded files, limits and complete contracts.</p>
          </details>
          <p>A collector digest and observation count do not provide a public raw-response archive. Public raw availability and provider authenticity remain unestablished. Live orders remain disabled.</p>
        </section>
      </article>
      <footer className="og-guide-next">
        <p>OpenGrail · Discover. Collaborate. Validate. Evolve.</p>
        <a href="/agent-guide/program-search">Complete program Search guide</a>
      </footer>
    </main>
  </div>;
}
