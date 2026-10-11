import '../research-policy.css';

export const metadata={title:'Reference methodology · OpenGrail'};
export default function ReferenceMethodology(){return <main className="og-policy">
 <nav aria-label="Methodology navigation"><a href="/">OpenGrail</a><a href="/validation">Back to validation</a></nav>
 <article><span className="og-policy-label">LOCAL COMPARISON · AUTHOR REPORTED</span><h1>Compare implementations.</h1>
 <p>Reconstruct an exact reported outcome using two fixed local evaluators. Check the inputs and differences before drawing any conclusion.</p>
 <h2>What is compared</h2><p>The primary replay and a separate lot-ledger implementation each evaluate the same accepted input. Three comparisons check the supplied claim against each reconstruction, then compare the reconstructions with each other.</p>
 <p>Trades, their order, closing equity, fees, allocation, benchmark and semantic audit events are compared. Audit prose is excluded. IDs, timestamps, directions, counts, risk reasons, array lengths and comparability must match exactly.</p>
 <h2>Numeric differences</h2><p>Other finite numeric values match when their absolute difference is at most <code>1e-8 + 1e-9 × max(|a|, |b|)</code>. This rule never changes entry decisions or forgives different events. Reports retain the total difference count and up to 50 first differences per pair.</p>
 <p>The second implementation uses a separate portfolio ledger and prefix calculations. Arithmetic and exceptional numerical paths can differ; a mismatch remains a mismatch. Neither implementation falls back to the other.</p>
 <h2>Read the result</h2><p><strong>MATCH</strong> means all compared pairs agreed within the declared rule. <strong>MISMATCH</strong> retains disagreements. <strong>UNRECONSTRUCTIBLE</strong> means the original rejection retained no accepted input. <strong>FAILED</strong> means a complete comparison was not confirmed.</p>
 <p>A failed trading replay can still receive MATCH when its retained loss or insolvency is reconstructed. MATCH does not mean profitable, safe or qualified.</p>
 <h2>Shared dependencies</h2><p>Both implementations share the declared method, JavaScript numeric runtime, input schemas, hashing, supplied data and operator. The reference author reviewed the primary source. Engine-file hashes identify declared source bytes; they do not attest which code produced an imported claim.</p>
 <p>Every comparison remains <strong>AUTHOR_REPORTED</strong>, with qualification <strong>NONE</strong> and independence <strong>NOT_ESTABLISHED</strong>. Shared implementation checks cannot establish untouched holdouts, complete search history, truthful prices, independent authorship or future returns.</p>
 <h2>Local evidence</h2><p>No files are uploaded for a local check. The page retains at most 16 attempts in memory, including mismatches and interruptions. Export reports before leaving; refresh loses that history. Exports omit raw artifact prose and preserve safe comparison results and references.</p>
 <p>A public record is checked against its current manifest and strategy. Source or parent withdrawal suppresses dependent public content. Previously downloaded copies remain outside that recall boundary.</p>
 <p>Comparison reports are separate from the public outcome ledger. No qualification, ranking, account connection, paid inference or order permission is created.</p>
 <p><a href="/demo-methodology">Declared replay methodology</a> · <a href="/experiments">Experiment history</a></p>
 </article></main>;}
