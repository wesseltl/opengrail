CREATE TABLE `experiment_moderation` (
	`record_id` text NOT NULL,
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
	PRIMARY KEY(`record_id`, `sequence`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_moderation_author_request` ON `experiment_moderation` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `experiment_records` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`manifest_id` text,
	`manifest_digest` text,
	`strategy_id` text NOT NULL,
	`strategy_digest` text NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_record_author_request` ON `experiment_records` (`author_key`,`request_id`);--> statement-breakpoint
CREATE INDEX `experiment_record_feed` ON `experiment_records` (`type`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `experiment_record_parent_feed` ON `experiment_records` (`manifest_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `experiment_record_sponsor_time` ON `experiment_records` (`type`,`sponsor_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `experiment_reports` (
	`author_key` text NOT NULL,
	`request_id` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`record_id` text NOT NULL,
	`record_digest` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`author_key`, `request_id`)
);
--> statement-breakpoint
CREATE INDEX `experiment_report_sponsor_time` ON `experiment_reports` (`sponsor_key`,`created_at`);