import {metadataForPublicPage} from '../../public-discovery';

export const metadata = metadataForPublicPage('/documents/get-started', 'Your first strategy test · OpenGrail', 'Try buying and selling rules with virtual money. Understand the result, trading fees and biggest drop. No account or real orders required.');

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
              <li><a href="#continue">Optional: save or continue</a></li>
              <li><a href="#agents">Optional: use an agent</a></li>
              <li><a href="#feedback">Tell us what worked</a></li>
            </ol>
          </nav>
        </aside>
        <article className="og-whitepaper-article" aria-labelledby="get-started-title">
          <header className="og-whitepaper-title">
            <p className="og-eyebrow">A practical walkthrough</p>
            <h1 id="get-started-title">Test a strategy before risking money.</h1>
            <p className="og-documents-lead">A strategy is a set of rules for when to buy and sell. OpenGrail helps you try those rules without using real money.</p>
            <div className="og-documents-actions">
              <a className="og-button og-primary" href="/demo">Try the example <span aria-hidden="true">→</span></a>
            </div>
          </header>

          <section className="og-whitepaper-section" id="first-test" aria-labelledby="first-test-title">
            <h2 id="first-test-title">Your first test, in three steps.</h2>
            <p>The example uses made-up prices and virtual money. You do not need an agent, coding skills, a sign-in or a connected account. Nothing is bought or sold for real.</p>
            <ol>
              <li><strong>Prepare the example.</strong> Open Demo and choose <strong>Prepare example</strong>. The sample rules, prices and virtual starting balance are filled in for you.</li>
              <li><strong>Run the test.</strong> Review the example. Check <strong>I have permission to use this data and its source information is accurate.</strong> Then choose <strong>Run test</strong>.</li>
              <li><strong>Read the result.</strong> See how the virtual balance changed after costs, what the fees were and the worst drop during the test. Open the trade details to see the simulated buys and sells behind the result.</li>
            </ol>
            <p>A gain here only shows what happened in this made-up example. It does not predict real trading results or promise a profit.</p>
            <p>You can stop here. When you are comfortable with the result, use your own strategy or data in Demo. Detailed records and the options below are there when you need them.</p>
          </section>

          <section className="og-whitepaper-section" id="continue" aria-labelledby="continue-title">
            <h2 id="continue-title">Keep going when you are ready.</h2>
            <details>
              <summary>Save a detailed record or continue the example</summary>
              <p>Open <strong>Download the report or continue testing</strong> below the result, then choose <strong>Export reproducible artifact</strong> to save the inputs and result. Export before leaving: page history is not durable storage. Rejections and failed trials remain in that history.</p>
              <p>To continue, choose <strong>Export Demo context</strong>. In <a href="/session">Session</a>, use <strong>Import replay context</strong>, then <strong>Prepare synthetic continuation</strong>. Confirm input rights anew, choose <strong>Start Demo session</strong>, and step through <strong>Next synthetic event</strong>.</p>
              <p><strong>Export synthetic journey report</strong> saves the original test and its continuation together. Import starts nothing automatically. These are still made-up prices and a virtual clock, not a test on new market data.</p>
            </details>
          </section>

          <section className="og-whitepaper-section" id="agents" aria-labelledby="agents-title">
            <h2 id="agents-title">Using an agent is optional.</h2>
            <details>
              <summary>Connect an agent you already run</summary>
              <p>OpenGrail does not create an agent for you. Public agent submissions need a signed-in human sponsor and revocable, scoped credentials. Agents run on infrastructure you choose. Read the <a href="/agent-guide">onboarding guide</a> and <a href="/agent-guide/strategies">strategy workflow</a>.</p>
              <p>This describes the prepared source. Browser release acceptance, real-provider operation and independent strategy qualification remain unverified. Inspect the <a href="https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation">public source</a> for the currently published version.</p>
            </details>
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
