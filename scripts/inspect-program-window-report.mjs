import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {reportProgramWindowCli, loadProgramWindowReportModules, programWindowReportLimits} from './report-program-window.mjs';
import {reportDirectory, holdReportFile, reportFileEnsure as ensure} from './program-window-report-files.mjs';
import {windowPhysicalSource, assertWindowPhysicalSource} from './program-window-fingerprint-core.mjs';
import {cleanupProgramSessionModules} from './program-session-runtime.mjs';

export const programWindowInspectionLimits = Object.freeze({bytes: 32768, depth: 12, nodes: 8192});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const knownCodes = new Set(['INSPECTION_USAGE', 'INSPECTION_CORRELATION_FAILED', 'INSPECTION_CANCELLED',
  'PRIVATE_DIRECTORY_REQUIRED', 'PRIVATE_DIRECTORY_CHANGED', 'PRIVATE_PARENT_REQUIRED',
  'PRIVATE_COMPLETE_FILE_REQUIRED', 'REPORT_FILE_CHANGED', 'REPORT_SOURCE_GRAPH_CHANGED',
  'ORIGINAL_INTERRUPTION_RETAINED', 'COMPONENTS_DO_NOT_REPRODUCE', 'STRICT_JSON_REQUIRED',
  'UNEXPECTED_OR_INCOMPLETE_REPORT_FILES', 'REPORT_ADMISSION_CHANGED']);
const errorCode = error => knownCodes.has(error?.message) ? error.message : 'UNCONFIRMED';

function parsed(m, file, maximum) {
  ensure(!(file.bytes[0] === 0xef && file.bytes[1] === 0xbb && file.bytes[2] === 0xbf), 'STRICT_JSON_REQUIRED');
  try {
    const value = m.parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(file.bytes), maximum, 44);
    m.boundedProgramWindowValue(value, maximum, 44, 12500000);
    return value;
  } catch { throw Error('STRICT_JSON_REQUIRED'); }
}

/** Fresh verification is mandatory. A supplied summary is never an input. */
export async function inspectProgramWindowReportCli(args, {signal} = {}) {
  ensure(Array.isArray(args) && args.length === 2 && args[0] === 'inspect' &&
    typeof args[1] === 'string' && args[1].length > 0 && args[1].length <= 4096 &&
    !/[\x00-\x1f\x7f]/.test(args[1]) && resolve(args[1]) === args[1], 'INSPECTION_USAGE');
  const abort = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(programWindowReportLimits.activeMs)]);
  const path = args[1], held = [], sources = [
    'scripts/inspect-program-window-report.mjs', 'scripts/report-program-window.mjs',
    'scripts/program-window-report-files.mjs', 'scripts/program-window-fingerprint-core.mjs',
  ].map(windowPhysicalSource);
  let directory, originalDirectory, m;
  try {
    abort.throwIfAborted();
    directory = reportDirectory(path);
    originalDirectory = reportDirectory(join(path, 'original'));
    const files = {};
    for (const [name, maximum] of [
      ['original/input.json', programWindowReportLimits.context],
      ['accounting-report.json', programWindowReportLimits.accounting],
      ['report.json', programWindowReportLimits.metadata],
      ['admission.json', programWindowReportLimits.metadata],
      ['report-source-graph.json', programWindowReportLimits.sourceGraph],
    ]) {
      const file = holdReportFile(join(path, name), maximum);
      held.push(file); files[name] = file;
    }
    m = await loadProgramWindowReportModules();
    const check = () => {
      directory.check(); originalDirectory.check(); m.assertFresh();
      for (const source of sources) assertWindowPhysicalSource(source);
      for (const file of held) file.check();
      abort.throwIfAborted();
    };
    check();
    // The original verifier reopens the complete context and all five results,
    // reruns the fixed reconstruction, and preserves every adverse disposition.
    const receipt = await reportProgramWindowCli(['verify', path], {signal: abort});
    check();
    const input = parsed(m, files['original/input.json'], programWindowReportLimits.context);
    const report = parsed(m, files['accounting-report.json'], programWindowReportLimits.accounting);
    const terminal = parsed(m, files['report.json'], programWindowReportLimits.metadata);
    const admission = parsed(m, files['admission.json'], programWindowReportLimits.metadata);
    const historicalGraph = parsed(m, files['report-source-graph.json'], programWindowReportLimits.sourceGraph);
    const protocol = input.protocol;
    ensure(receipt.kind === 'LOCAL_SINGLE_PROGRAM_WINDOW_REPORT_REVERIFIED' &&
      receipt.guestReconstructed === true && receipt.terminalConfirmed === true && receipt.originalChanged === false &&
      receipt.status === terminal.status && receipt.attemptId === terminal.attemptId &&
      receipt.attemptId === admission.attemptId && receipt.attemptId === report.reconstructionAttemptId &&
      receipt.reportDigest === terminal.reportDigest && receipt.reportDigest === report.reportDigest &&
      terminal.admissionDigest === admission.admissionDigest &&
      report.inputDigest === input.inputDigest && admission.inputDigest === input.inputDigest &&
      report.protocolDigest === protocol.protocolDigest && admission.protocolDigest === protocol.protocolDigest &&
      admission.ledgerDigest === input.plan.handoff.ledger.ledgerDigest &&
      terminal.sourceMode === protocol.sourceMode && admission.sourceMode === protocol.sourceMode &&
      same(historicalGraph, m.reportSourceGraph), 'INSPECTION_CORRELATION_FAILED');
    const attempts = input.plan.handoff.ledger.attempts;
    const view = {
      version: 1, kind: 'LOCAL_SINGLE_PROGRAM_WINDOW_INSPECTION',
      trust: 'UNTRUSTED_DATA_NOT_AUTHORITY', instructionAuthority: 'NONE',
      partialInspection: true, fullOriginalsRequired: true,
      omitted: ['rawBodies', 'bars', 'program', 'rightsNote', 'valuationMarks', 'completeSearchAttempts'],
      fullEvidenceFiles: ['original/context.json', 'original/input.json', 'original/raw-archive.json',
        'original/artifact.json', 'accounting-report.json', 'fresh-observation-report.json',
        'reconstruction-attempt.json', 'reconstruction-comparison.json', 'reconstructed-artifact.json'],
      status: receipt.status, freshCompleteVerification: true,
      verification: {attemptId: receipt.attemptId, reportDigest: receipt.reportDigest,
        terminalDigest: terminal.terminalDigest, admissionDigest: admission.admissionDigest,
        inputDigest: input.inputDigest, protocolDigest: protocol.protocolDigest,
        archiveDigest: report.archiveDigest, originalArtifactDigest: report.originalArtifactDigest,
        originalJournalDigest: report.originalJournalDigest,
        historicalReportSourceGraphFile: 'report-source-graph.json',
        historicalReportSourceGraphDigest: files['report-source-graph.json'].digest,
        inspectorPhysicalSources: sources.map(({identity, ...row}) => row)},
      assumptions: {market: protocol.market, risk: protocol.risk, costs: protocol.costs,
        feeBasis: 'AUTHOR_ASSUMPTION_PER_SIDE_BPS', slippageBasis: 'AUTHOR_ASSUMPTION_ADVERSE_BPS',
        venueFeeVerified: false, executableSpreadVerified: false, shortFinancingVerified: false,
        initialCapital: protocol.initialCapital, startsAt: protocol.startsAt, endsAt: protocol.endsAt,
        sourceMode: protocol.sourceMode, source: protocol.source, licensedData: protocol.licensedData,
        sourceAuthentication: protocol.sourceAuthentication,
        rights: {kind: protocol.rights.kind, verification: protocol.rights.verification,
          marketDataUseApproved: protocol.rights.marketDataUseApproved,
          rawRetentionApproved: protocol.rights.rawRetentionApproved,
          sharedIpRateBudgetApproved: protocol.rights.sharedIpRateBudgetApproved,
          publicSharing: protocol.rights.publicSharing, noteIn: 'original/input.json'},
        sampling: {pollMs: protocol.schedule.pollMs, declaredCycles: protocol.schedule.declaredCycles,
          activeSlots: protocol.schedule.active.length, closeoutSlots: protocol.schedule.closeout.length,
          continuousMarketCoverage: false}},
      searchHistory: {ledgerDigest: admission.ledgerDigest, attemptCount: attempts.length,
        trainAttemptCount: attempts.filter(row => row.phase === 'TRAIN').length,
        testAttemptCount: attempts.filter(row => row.phase === 'TEST').length,
        completeHistoryIn: 'original/input.json', backtestReplayed: false},
      result: {performanceInterpretation: report.performanceInterpretation, availability: report.availability,
        completePerformance: report.completePerformance, computationStatus: report.computationStatus,
        observationStatus: report.observationStatus, boundaryStatus: report.boundaryStatus,
        reasons: report.reasons, portfolio: report.portfolio, baselines: report.baselines,
        diagnostics: report.diagnostics},
      classification: 'AUTHOR_REPORTED', qualification: 'NONE', independence: 'NOT_ESTABLISHED',
      sourceAuthentication: 'NOT_ESTABLISHED', independentQualification: false,
      financialExecutionAuthority: 'NONE', providerStarted: false, controllerStarted: false,
      publicReferencesAuthenticated: false, registered: false, ordersEnabled: false, liveEnabled: false,
    };
    // Detach the bounded data view; keep whole original evidence unchanged.
    const bytes = m.boundedProgramWindowValue(view, programWindowInspectionLimits.bytes,
      programWindowInspectionLimits.depth, programWindowInspectionLimits.nodes);
    const output = m.parseUniqueJson(bytes, programWindowInspectionLimits.bytes, programWindowInspectionLimits.depth);
    check();
    return output;
  } finally {
    for (const file of held.reverse()) file.close();
    originalDirectory?.close(); directory?.close(); cleanupProgramSessionModules();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController(), stop = () => controller.abort();
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try {
    const result = await inspectProgramWindowReportCli(process.argv.slice(2), {signal: controller.signal});
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'ACCOUNTED' ? 0 : 2;
  } catch (error) {
    process.stderr.write('Sampled Demo inspection unconfirmed: ' + errorCode(error) +
      '. Preserve complete original and report files.\nUsage: inspect-program-window-report.mjs inspect ATTEMPT_DIRECTORY\n');
    process.exitCode = 1;
  } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}
