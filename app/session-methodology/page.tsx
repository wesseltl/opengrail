import '../research-policy.css';
import {sessionLimits,sessionVersion} from '../session-model';
import {sessionJournalLimits} from '../session-journal';

export const metadata={title:'Session methodology · OpenGrail'};

export default function SessionMethodology(){
 return <main className="og-policy">
  <nav aria-label="Methodology navigation"><a href="/">OpenGrail</a><a href="/session">Back to Sessions</a></nav>
  <article>
   <span className="og-policy-label">CONTINUOUS LOCAL DEMO · {sessionVersion}</span>
   <h1>Follow events, keep the history.</h1>
   <p>A Session applies one event at a time to an exact strategy definition. Open virtual positions persist between events and at disconnection. Results remain AUTHOR_REPORTED with qualification NONE. Prices use the strategy market’s quote units.</p>
   <h2>Two clocks, explicit provenance</h2>
   <p>Synthetic playback uses a disclosed virtual clock and invented prices. System-receipt sessions timestamp intake with the local process or browser clock. Neither mode authenticates a provider, price, data right or source observation timestamp. Caller-supplied receipt times are refused by the connected command-line runner.</p>
   <p>Signals carry separate observed and available timestamps. Completed bars supply rule inputs; gaps block new decisions until contiguous history is restored. Pre-start, future and stale material cannot create retrospective entries. Quotes must have increasing observation times and be no more than 60 seconds old when received.</p>
   <h2>Decisions before fills</h2>
   <p>Pending entries require a fresh quote observed and received strictly after the decision became known. Old decision intents expire after two timeframes. Historical bar highs and lows cannot trigger retroactive fills or exits. Each fill uses the current quote with adverse slippage and per-side fees.</p>
   <p>This incremental method differs from the batch Demo replay: it has no next-bar-open fill, intrabar OHLC ordering or end-of-stream liquidation. Favorable target gaps settle at the current quote after costs; the batch evaluator caps them at the target. Sparse quotes can miss market moves and do not establish executable liquidity, spread or borrowing access.</p>
   <h2>Pauses and emergency exits</h2>
   <p>Pause blocks new entries while fresh quotes continue to mark and protect existing positions. An emergency disables admissions immediately. Ordinary emergency exits await a quote observed and received after the stop; until then the position remains visible as awaiting exit. Protective insolvency checks take precedence. Missing quotes cannot be replaced with an invented flat balance.</p>
   <p>Daily loss limits use the receipt clock’s UTC day and can latch further admissions off. Gaps, slippage and uncapped simulated short losses can exceed limits or produce negative equity. Position allocation, DCA partitions and grid levels use the declared risk budget.</p>
   <h2>Recovery must reconstruct</h2>
   <p>The journal binds exact configuration, method and file identities, every admitted event, receipt time and intermediate state digest. Recovery runs the trusted kernel over the entire history and compares every checkpoint. A valid self-hash alone does not establish a correct balance. These file identities are source pins, not independent execution attestations or proof of authentic market data.</p>
   <p>Exact request retries retain their original receipt; changed content with the same ID is refused. Validly shaped but inadmissible events remain as rejected receipts. Malformed transport has separate bounded diagnostics and is not represented as a processed event.</p>
   <h2>Bounded local operation</h2>
   <p>There are {sessionLimits.events.toLocaleString('en-US')} normal event receipts and {sessionLimits.emergencyReserve} reserved protective receipts. No history is silently evicted. Full journals are bounded to {sessionJournalLimits.bytes/1048576} MiB; derived states to {sessionLimits.stateBytes/1048576} MiB. The browser retains up to eight sessions in memory; exporting preserves them, while leaving loses the memory copy.</p>
   <p>The sponsor-hosted command-line runner accepts newline-delimited JSON on standard input, persists confirmed checkpoints before acknowledging them, and uses a POSIX file lock with Python 3. Restart reconstructs and pauses admissions before an explicit resume. It consumes events only while its process is running.</p>
   <p>No hosted worker, provider adapter, webhook receiver, automatic experiment publication or exchange connector is supplied here. Public research credentials confer no session, financial or administrative authority. No Live orders or paid AI calls are involved. Hosted operation, unseen-data testing, forward qualification and independent review remain separate requirements.</p>
  </article>
 </main>;
}
