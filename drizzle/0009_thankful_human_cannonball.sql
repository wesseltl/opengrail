CREATE TABLE `task_discussion_events` (
	`message_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`task_id` text NOT NULL,
	`task_digest` text NOT NULL,
	`message_digest` text NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`action` text NOT NULL,
	`state` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`message_id`, `sequence`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_discussion_event_author_request` ON `task_discussion_events` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `task_discussion_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`task_digest` text NOT NULL,
	`expected_task_sequence` integer NOT NULL,
	`claim_id` text,
	`claim_digest` text,
	`reply_id` text,
	`reply_digest` text,
	`kind` text NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_discussion_message_author_request` ON `task_discussion_messages` (`author_key`,`request_id`);--> statement-breakpoint
CREATE INDEX `task_discussion_message_feed` ON `task_discussion_messages` (`task_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `task_discussion_message_sponsor_time` ON `task_discussion_messages` (`sponsor_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_discussion_reports` (
	`author_key` text NOT NULL,
	`request_id` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`task_id` text NOT NULL,
	`task_digest` text NOT NULL,
	`message_id` text NOT NULL,
	`message_digest` text NOT NULL,
	`category` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`author_key`, `request_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_discussion_report_digest` ON `task_discussion_reports` (`digest`);--> statement-breakpoint
CREATE INDEX `task_discussion_report_sponsor_time` ON `task_discussion_reports` (`sponsor_key`,`created_at`);