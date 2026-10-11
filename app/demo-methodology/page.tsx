import '../research-policy.css';
import {demoLimits,demoEvaluatorVersion} from '../demo-model';

export const metadata={title:'Demo methodology · OpenGrail'};

export default function DemoMethodology(){
 return <main className="og-policy">
  <nav aria-label="Methodology navigation"><a href="/">OpenGrail</a><a href="/demo">Back to Demo</a></nav>
  <article>
   <span className="og-policy-label">LOCAL SIMULATION · {demoEvaluatorVersion}</span>
   <h1>Know what the result measures.</h1>
   <p>Demo replays supplied data with trusted application rules. It uses no account, exchange, connected signal feed or paid inference service. Every result is simulated and author reported; public strategies remain UNTESTED.</p>
   <h2>Exact inputs, disclosed assumptions</h2>
   <p>A replay binds an exact strategy record and digest, OHLC bars, timestamped signals, capital, hypothesis and falsification criterion. Synthetic examples are invented data. User-supplied provenance and data rights are author declarations. Digests identify the retained bytes; they do not prove source authenticity, data quality or valid unseen-data testing.</p>
   <p>Bars must be coherent, increasing and contiguous at the declared timeframe. Prices and capital use the market’s quote unit; there is no currency conversion. Inputs are limited to {demoLimits.bars.toLocaleString('en-US')} bars, {demoLimits.signals} signals and {demoLimits.requestBytes/1024} KiB.</p>
   <h2>Timing and fills</h2>
   <p>Entry rules use completed bars and signals available at that decision time. Entries fill at the following bar’s open, with adverse per-side slippage and fees. A provider label does not prove a signal came from Altfins or TradingView. Each accepted signal can be consumed once; mismatches and stale inputs appear in the audit.</p>
   <p>Stop gaps use the opening price; favorable target gaps are conservatively capped at the target price. If a bar touches both stop and target and their order is unknown, the stop is applied first. OHLC does not reveal execution sequence, order-book depth, spread or market impact; these assumptions cannot guarantee achievable fills.</p>
   <h2>Allocation and risk</h2>
   <p>Position percentage is the total allocation budget. DCA partitions it across its entry allowance; grid partitions it across levels. Position and available-capital checks can reject an entry. Shorts use hypothetical reserved collateral without establishing borrowing or broker access.</p>
   <p>Daily marked-equity losses can halt further entries and close simulated positions; gaps and costs may exceed the threshold. An emergency stop is terminal at the next observable bar boundary; OHLC alone cannot supply an exact mid-bar emergency fill. Short gap losses are uncapped: insufficient collateral or equity creates a retained failure, rather than invented limited-recourse protection.</p>
   <h2>Read performance in context</h2>
   <p>Return includes fees and adverse slippage. Drawdown uses retained marked equity under the stated sampling method. The benchmark is an allocation-matched, cost-aware LONG buy-and-hold simulation over the same data. Failed runs and SHORT comparisons are explicitly incomparable. These results are not strategy rankings or return forecasts.</p>
   <h2>Keep the failures</h2>
   <p>The browser retains every attempted trial for this session and stops accepting new trials at its history limit. Export to preserve the history; refreshing or leaving loses the in-memory copy. Rejected inputs retain safe reasons rather than arbitrary private data. CLI artifacts use new filenames and never overwrite an earlier trial.</p>
   <p>Rerunning an artifact with the same evaluator checks reproducibility of that implementation. It is not independent verification. A persistent preregistered experiment history, disclosed parameter searches, untouched holdouts, conflicting reproductions and trusted qualification remain separate requirements.</p>
  </article>
 </main>;
}
