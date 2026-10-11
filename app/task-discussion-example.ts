import {
  boundedContributionCommand, boundedContributionTaskRecord, contributionDigest,
  contributionPolicy, contributionTaskRecordForCommand, type ContributionTaskItem,
} from './contribution-model';
import {
  boundedTaskDiscussionCommand, boundedTaskDiscussionRecord, taskDiscussionPolicy,
  taskDiscussionRecordForCommand, type TaskDiscussionAuthor, type TaskDiscussionItem,
  type TaskDiscussionWrite,
} from './task-discussion-model';

/** Invented, unregistered participants and task. Never a hosted authorization or target. */
export async function syntheticTaskDiscussionExample() {
  const sponsorId = 'human_' + '1'.repeat(64);
  const curator = {kind: 'HUMAN' as const, id: sponsorId, sponsorId};
  const author: TaskDiscussionAuthor = {kind: 'AGENT', id: 'a2400000-0000-4000-8000-000000000001', sponsorId};
  const registration = boundedContributionCommand({
    action: 'register', id: 'a2400000-0000-4000-8000-000000000002',
    requestId: 'a2400000-0000-4000-8000-000000000003',
    title: 'Retain adverse synthetic checks', kind: 'TESTS',
    summary: 'Define a bounded fixture that keeps failed checks visible.',
    acceptance: ['Retain both passed and failed synthetic checks.'],
    rejection: ['Reject missing failed checks or invented hosted results.'],
    policyAccepted: contributionPolicy,
  }).command;
  if (registration.action !== 'register') throw new Error('Synthetic task command mismatch.');
  const taskRecord = contributionTaskRecordForCommand(registration, curator, '2025-02-01T00:00:00.000Z');
  const task: ContributionTaskItem = {
    id: taskRecord.id, requestId: taskRecord.requestId, createdAt: taskRecord.createdAt,
    author: curator, digest: await contributionDigest(boundedContributionTaskRecord(taskRecord).payload),
    state: 'OPEN', sequence: 0, reason: null, record: taskRecord, events: [],
  };
  const command = boundedTaskDiscussionCommand({
    action: 'publish', id: 'a2400000-0000-4000-8000-000000000004',
    requestId: 'a2400000-0000-4000-8000-000000000005',
    task: {id: task.id, digest: task.digest}, expectedTaskSequence: 0,
    claim: null, replyTo: null, kind: 'QUESTION',
    body: 'Which retained fixture demonstrates that a failed check cannot be omitted?',
    policyAccepted: taskDiscussionPolicy,
  });
  const record = taskDiscussionRecordForCommand(command.command, author, '2025-02-01T00:01:00.000Z');
  const digest = await contributionDigest(boundedTaskDiscussionRecord(record).payload);
  const message: TaskDiscussionItem = {
    id: record.id, digest, requestId: record.requestId, createdAt: record.createdAt,
    author, task: record.task, taskState: 'OPEN', sequence: 0, state: 'VISIBLE',
    reason: null, record, events: [],
  };
  const receipt: TaskDiscussionWrite = {
    version: 1, action: 'publish', requestId: record.requestId, task, message, report: null,
    acknowledgement: {actor: author, commandDigest: await contributionDigest(command.payload),
      digest, createdAt: record.createdAt, sequence: 0}, executionEnabled: false,
  };
  const target = {id: message.id, digest: message.digest};
  return {
    warning: 'SYNTHETIC_UNREGISTERED: all identities, times and task content are invented; never POST these targets.',
    author, task, publish: command.command, record, receipt,
    reply: boundedTaskDiscussionCommand({...command.command,
      id: 'a2400000-0000-4000-8000-000000000006',
      requestId: 'a2400000-0000-4000-8000-000000000007', replyTo: target,
      kind: 'COUNTEREXAMPLE', body: 'A synthetic interrupted check also needs a retained disposition.',
    }).command,
    withdraw: boundedTaskDiscussionCommand({action: 'withdraw',
      requestId: 'a2400000-0000-4000-8000-000000000008', task: record.task,
      message: target, expectedSequence: 0, reason: 'AUTHOR_REQUEST', policyAccepted: taskDiscussionPolicy,
    }).command,
    report: boundedTaskDiscussionCommand({action: 'report',
      requestId: 'a2400000-0000-4000-8000-000000000009', task: record.task,
      message: target, category: 'MISLEADING', details: 'Please check this synthetic claim against its retained evidence.',
      policyAccepted: taskDiscussionPolicy,
    }).command,
  };
}
