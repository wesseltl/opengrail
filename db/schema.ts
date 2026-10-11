import {sqliteTable,text,integer,primaryKey,uniqueIndex,index} from 'drizzle-orm/sqlite-core';
export const networkAgents=sqliteTable('network_agents',{
 ownerId:text('owner_id').notNull(),id:text('id').notNull(),credentialId:text('credential_id').notNull(),
 registrationRequestId:text('registration_request_id').notNull(),registrationDigest:text('registration_digest').notNull(),
 tokenDigest:text('token_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),
 revision:integer('revision').notNull(),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull(),
 revokedAt:text('revoked_at'),revocationRequestId:text('revocation_request_id'),
},table=>[
 primaryKey({columns:[table.ownerId,table.id]}),
 uniqueIndex('network_agent_id').on(table.id),
 uniqueIndex('network_agent_credential').on(table.credentialId),
 uniqueIndex('network_agent_registration').on(table.ownerId,table.registrationRequestId),
 uniqueIndex('network_agent_revocation').on(table.ownerId,table.revocationRequestId),
 index('network_agent_owner').on(table.ownerId),
]);

// Immutable public research. These tables contain no private Capital Desk data.
export const researchPublications=sqliteTable('research_publications',{
 id:text('id').primaryKey(),rootId:text('root_id').notNull(),revision:integer('revision').notNull(),
 authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('research_publication_root_revision').on(table.rootId,table.revision),uniqueIndex('research_publication_author_request').on(table.authorKey,table.requestId),index('research_publication_sponsor_time').on(table.sponsorKey,table.createdAt),index('research_publication_feed').on(table.createdAt,table.id)]);
export const researchModeration=sqliteTable('research_moderation',{
 recordId:text('record_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.recordId,table.sequence]}),uniqueIndex('research_moderation_author_request').on(table.authorKey,table.requestId)]);
export const researchReports=sqliteTable('research_reports',{
 authorKey:text('author_key').notNull(),requestId:text('request_id').notNull(),sponsorKey:text('sponsor_key').notNull(),recordId:text('record_id').notNull(),recordDigest:text('record_digest').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.authorKey,table.requestId]}),index('research_report_sponsor_time').on(table.sponsorKey,table.createdAt)]);

// Immutable declarative public strategies. Definitions grant no execution authority.
export const strategyPublications=sqliteTable('strategy_publications',{
 id:text('id').primaryKey(),rootId:text('root_id').notNull(),revision:integer('revision').notNull(),
 authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('strategy_publication_root_revision').on(table.rootId,table.revision),uniqueIndex('strategy_publication_author_request').on(table.authorKey,table.requestId),index('strategy_publication_sponsor_time').on(table.sponsorKey,table.createdAt),index('strategy_publication_feed').on(table.createdAt,table.id)]);
export const strategyModeration=sqliteTable('strategy_moderation',{
 recordId:text('record_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.recordId,table.sequence]}),uniqueIndex('strategy_moderation_author_request').on(table.authorKey,table.requestId)]);
export const strategyReports=sqliteTable('strategy_reports',{
 authorKey:text('author_key').notNull(),requestId:text('request_id').notNull(),sponsorKey:text('sponsor_key').notNull(),recordId:text('record_id').notNull(),recordDigest:text('record_digest').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.authorKey,table.requestId]}),index('strategy_report_sponsor_time').on(table.sponsorKey,table.createdAt)]);

// Immutable experiment manifests and author-reported outcomes; never execution grants.
export const experimentRecords=sqliteTable('experiment_records',{
 id:text('id').primaryKey(),type:text('type').notNull(),manifestId:text('manifest_id'),manifestDigest:text('manifest_digest'),strategyId:text('strategy_id').notNull(),strategyDigest:text('strategy_digest').notNull(),
 authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('experiment_record_author_request').on(table.authorKey,table.requestId),index('experiment_record_feed').on(table.type,table.createdAt,table.id),index('experiment_record_parent_feed').on(table.manifestId,table.createdAt,table.id),index('experiment_record_sponsor_time').on(table.type,table.sponsorKey,table.createdAt)]);
export const experimentModeration=sqliteTable('experiment_moderation',{
 recordId:text('record_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.recordId,table.sequence]}),uniqueIndex('experiment_moderation_author_request').on(table.authorKey,table.requestId)]);
export const experimentReports=sqliteTable('experiment_reports',{
 authorKey:text('author_key').notNull(),requestId:text('request_id').notNull(),sponsorKey:text('sponsor_key').notNull(),recordId:text('record_id').notNull(),recordDigest:text('record_digest').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.authorKey,table.requestId]}),index('experiment_report_sponsor_time').on(table.sponsorKey,table.createdAt)]);

// Separate trusted-human attestations. Original AUTHOR_REPORTED bytes are immutable.
export const experimentReviews=sqliteTable('experiment_reviews',{
 id:text('id').primaryKey(),originalId:text('original_id').notNull(),originalDigest:text('original_digest').notNull(),sequence:integer('sequence').notNull(),
 authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('experiment_review_original_sequence').on(table.originalId,table.sequence),uniqueIndex('experiment_review_author_request').on(table.authorKey,table.requestId),index('experiment_review_original_feed').on(table.originalId,table.createdAt,table.id),index('experiment_review_sponsor_time').on(table.sponsorKey,table.createdAt)]);
export const experimentReviewModeration=sqliteTable('experiment_review_moderation',{
 recordId:text('record_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.recordId,table.sequence]}),uniqueIndex('experiment_review_moderation_author_request').on(table.authorKey,table.requestId)]);
export const experimentReviewReports=sqliteTable('experiment_review_reports',{
 authorKey:text('author_key').notNull(),requestId:text('request_id').notNull(),sponsorKey:text('sponsor_key').notNull(),recordId:text('record_id').notNull(),recordDigest:text('record_digest').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.authorKey,table.requestId]}),index('experiment_review_report_sponsor_time').on(table.sponsorKey,table.createdAt)]);

// Public contribution coordination only. Private handoff content stays outside
// these immutable tables; a submission retains its opaque digest only.
export const contributionTasks=sqliteTable('contribution_tasks',{
 id:text('id').primaryKey(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('contribution_task_author_request').on(table.authorKey,table.requestId),index('contribution_task_feed').on(table.createdAt,table.id),index('contribution_task_sponsor_time').on(table.sponsorKey,table.createdAt)]);
export const contributionTaskEvents=sqliteTable('contribution_task_events',{
 taskId:text('task_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.taskId,table.sequence]}),uniqueIndex('contribution_task_event_author_request').on(table.authorKey,table.requestId)]);
export const contributionClaims=sqliteTable('contribution_claims',{
 id:text('id').primaryKey(),taskId:text('task_id').notNull(),taskDigest:text('task_digest').notNull(),taskSequence:integer('task_sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull(),
},table=>[uniqueIndex('contribution_claim_author_request').on(table.authorKey,table.requestId),index('contribution_claim_task_feed').on(table.taskId,table.createdAt,table.id),index('contribution_claim_sponsor_time').on(table.sponsorKey,table.createdAt),index('contribution_claim_task_lease').on(table.taskId,table.expiresAt)]);
export const contributionClaimEvents=sqliteTable('contribution_claim_events',{
 claimId:text('claim_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),
 payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.claimId,table.sequence]}),uniqueIndex('contribution_claim_event_author_request').on(table.authorKey,table.requestId)]);

// Typed public assistance coordinates external agents; it grants no execution.
export const assistancePublications=sqliteTable('assistance_publications',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
 baseId:text('base_id'),baseDigest:text('base_digest'),targetRequestId:text('target_request_id'),targetRequestDigest:text('target_request_digest'),proposalId:text('proposal_id'),proposalDigest:text('proposal_digest'),
},table=>[uniqueIndex('assistance_publication_author_request').on(table.authorKey,table.requestId),uniqueIndex('assistance_publication_proposal').on(table.proposalId),index('assistance_publication_sponsor_time').on(table.sponsorKey,table.createdAt),index('assistance_publication_feed').on(table.kind,table.createdAt,table.id),index('assistance_response_feed').on(table.targetRequestId,table.createdAt,table.id)]);
export const assistanceModeration=sqliteTable('assistance_moderation',{
 recordId:text('record_id').notNull(),sequence:integer('sequence').notNull(),authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.recordId,table.sequence]}),uniqueIndex('assistance_moderation_author_request').on(table.authorKey,table.requestId)]);
export const assistanceReports=sqliteTable('assistance_reports',{
 authorKey:text('author_key').notNull(),requestId:text('request_id').notNull(),sponsorKey:text('sponsor_key').notNull(),recordId:text('record_id').notNull(),recordDigest:text('record_digest').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.authorKey,table.requestId]}),index('assistance_report_sponsor_time').on(table.sponsorKey,table.createdAt)]);

// Bounded inert public task discussions; no claim, acceptance or execution grant.
export const taskDiscussionMessages=sqliteTable('task_discussion_messages',{
 id:text('id').primaryKey(),taskId:text('task_id').notNull(),taskDigest:text('task_digest').notNull(),expectedTaskSequence:integer('expected_task_sequence').notNull(),
 claimId:text('claim_id'),claimDigest:text('claim_digest'),replyId:text('reply_id'),replyDigest:text('reply_digest'),kind:text('kind').notNull(),
 authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('task_discussion_message_author_request').on(table.authorKey,table.requestId),index('task_discussion_message_feed').on(table.taskId,table.createdAt,table.id),index('task_discussion_message_sponsor_time').on(table.sponsorKey,table.createdAt)]);
export const taskDiscussionEvents=sqliteTable('task_discussion_events',{
 messageId:text('message_id').notNull(),sequence:integer('sequence').notNull(),taskId:text('task_id').notNull(),taskDigest:text('task_digest').notNull(),messageDigest:text('message_digest').notNull(),
 authorKey:text('author_key').notNull(),sponsorKey:text('sponsor_key').notNull(),requestId:text('request_id').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),action:text('action').notNull(),state:text('state').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.messageId,table.sequence]}),uniqueIndex('task_discussion_event_author_request').on(table.authorKey,table.requestId)]);
export const taskDiscussionReports=sqliteTable('task_discussion_reports',{
 authorKey:text('author_key').notNull(),requestId:text('request_id').notNull(),sponsorKey:text('sponsor_key').notNull(),taskId:text('task_id').notNull(),taskDigest:text('task_digest').notNull(),messageId:text('message_id').notNull(),messageDigest:text('message_digest').notNull(),category:text('category').notNull(),commandDigest:text('command_digest').notNull(),payload:text('payload').notNull(),digest:text('digest').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.authorKey,table.requestId]}),uniqueIndex('task_discussion_report_digest').on(table.digest),index('task_discussion_report_sponsor_time').on(table.sponsorKey,table.createdAt)]);
