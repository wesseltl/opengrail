CREATE TABLE `contribution_claim_events` (
	`claim_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`state` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`claim_id`, `sequence`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contribution_claim_event_author_request` ON `contribution_claim_events` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `contribution_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`task_digest` text NOT NULL,
	`task_sequence` integer NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contribution_claim_author_request` ON `contribution_claims` (`author_key`,`request_id`);--> statement-breakpoint
CREATE INDEX `contribution_claim_task_feed` ON `contribution_claims` (`task_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `contribution_claim_sponsor_time` ON `contribution_claims` (`sponsor_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `contribution_claim_task_lease` ON `contribution_claims` (`task_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `contribution_task_events` (
	`task_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`state` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`task_id`, `sequence`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contribution_task_event_author_request` ON `contribution_task_events` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `contribution_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contribution_task_author_request` ON `contribution_tasks` (`author_key`,`request_id`);--> statement-breakpoint
CREATE INDEX `contribution_task_feed` ON `contribution_tasks` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `contribution_task_sponsor_time` ON `contribution_tasks` (`sponsor_key`,`created_at`);