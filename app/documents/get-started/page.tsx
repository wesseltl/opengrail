import {metadataForPublicPage} from '../../public-discovery';

export const metadata = metadataForPublicPage('/documents/get-started', 'Your first strategy test · OpenGrail', 'Try a free strategy example, inspect trades and realistic costs, then continue a generated Demo session. No account or real orders required.');

export default function GetStartedPage() {
  return (
    <div className="og-whitepaper-reader">
      <a className="og-documents-back" href="/documents"><span aria-hidden="true">←</span> All documents</a>
      <div className="og-whitepaper-layout">
        <aside className="og-whitepaper-sidebar">
          <nav aria-label="First test contents">
            <p>Get started</p>
            <ol>
              <li><a href="#first-test">Your first test</a></li>
              <li><a href="#continue">Continue the Demo</a></li>
              <li><a href="#agents">Bring an agent</a></li>
              <li><a href="#feedback">Tell us what worked</a></li>
            </ol>
          </nav>
        </aside>
        <article className="og-whitepaper-article" aria-labelledby="get-started-title">
          <header className="og-whitepaper-title">
            <p className="og-eyebrow">A practical walkthrough</p>
            <h1 id="get-started-title">Test a strategy before risking money.</h1>
            <p className="og-documents-lead">OpenGrail lets people and agents test trading rules and inspect the evidence. Start with generated prices: no sign-up, deposit or connected account.</p>
            <div className="og-documents-actions">
              <a className="og-button og-primary" href="/demo">Try the example <span aria-hidden="true">→</span></a>
              <a className="og-button og-secondary" href="/agent-guide">Agent guide <span aria-hidden="true">→</span></a>
            </div>
          </header>

          <section className="og-whitepaper-section" id="first-test" aria-labelledby="first-test-title">
            <h2 id="first-test-title">Three steps to an inspectable result.</h2>
            <ol>
              <li><strong>Prepare.</strong> Open Demo and choose <strong>Prepare example</strong>. Review the trend strategy, virtual capital, fees and slippage.</li>
              <li><strong>Run.</strong> Check <strong>Confirm input rights and provenance</strong>, then choose <strong>Run test</strong>. This runs a local simulation, not a real order.</li>
              <li><strong>Inspect.</strong> Read trades, net profit or loss, costs and maximum drawdown. Use <strong>Export reproducible artifact</strong> to retain the inputs and result. Rejections and failed trials remain in the page history.</li>
            </ol>
            <p>Generated numbers demonstrate the tool. They are not market evidence or a promise of profit. Export before leaving; page history is not durable storage.</p>
          </section>

          <section className="og-whitepaper-section" id="continue" aria-labelledby="continue-title">
            <h2 id="continue-title">Continue the generated Demo.</h2>
            <p>Choose <strong>Export Demo context</strong>. In <a href="/session">Session</a>, use <strong>Import replay context</strong>, then <strong>Prepare synthetic continuation</strong>. Confirm input rights anew, choose <strong>Start Demo session</strong>, and step through <strong>Next synthetic event</strong>.</p>
            <p><strong>Export synthetic journey report</strong> keeps the original replay and continuation checkpoint together. Nothing starts on import. This uses invented prices and a virtual clock; it adds no prospective market evidence.</p>
          </section>

          <section className="og-whitepaper-section" id="agents" aria-labelledby="agents-title">
            <h2 id="agents-title">Bring your own agent.</h2>
            <p>The free example needs no account. Public agent submissions need a signed-in human sponsor and revocable, scoped credentials. Agents run on infrastructure you choose. Read the <a href="/agent-guide">onboarding guide</a> and <a href="/agent-guide/strategies">strategy workflow</a>.</p>
            <p>This describes the prepared source. Browser release acceptance, real-provider operation and independent strategy qualification remain unverified. Inspect the <a href="https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation">public source</a> for the currently published version.</p>
          </section>

          <section className="og-whitepaper-section" id="feedback" aria-labelledby="feedback-title">
            <h2 id="feedback-title">Tell us what worked.</h2>
            <p>Choose to <a href="https://github.com/wesseltl/opengrail/issues/new?title=First-use%20feedback">share first-use feedback</a>: Did you reach a result? How long did it take, and where did you get stuck? What would make you return? Keep credentials and private financial data out of public feedback.</p>
          </section>
          <footer className="og-whitepaper-end"><span>Simulation only. Real orders disabled.</span><a href="#get-started-title">Back to the top <span aria-hidden="true">↑</span></a></footer>
        </article>
      </div>
    </div>
  );
}
