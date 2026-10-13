import type {ExperimentWindowManifest} from './experiment-model';

export default function ProgramWindowDeclarationDetail({record}:{record:ExperimentWindowManifest}){
 const {input,disclosures}=record.content,p=input.protocol,s=p.schedule;
 return <dl>
  <div><dt>Declared window</dt><dd><time>{p.startsAt}</time> to <time>{p.endsAt}</time><br/>{s.active.length} active slots · {s.closeout.length} observation-only closeout slots</dd></div>
  <div><dt>Retained strategy and Search</dt><dd>{input.plan.config.strategy.record.content.name}<br/>{input.plan.handoff.ledger.attempts.length} original attempts, including the consumed TEST<br/>{disclosures.search.log}</dd></div>
  <div><dt>Observation source</dt><dd>{p.sourceMode==='SYNTHETIC_RESPONSES'?'Synthetic responses · invented test data':'Author-declared public HTTP snapshots'}<br/>Provider authenticity and licensing are not established.</dd></div>
  <div><dt>Evidence identity</dt><dd className="og-experiment-reference">Input {input.inputDigest}<br/>Protocol {p.protocolDigest}</dd></div>
  <div><dt>Result scope</dt><dd>Registration records the declared protocol. Observation coverage, reconstruction, receipt timing and settlement require separate checks. Qualification NONE.</dd></div>
 </dl>;
}
