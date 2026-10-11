CREATE TABLE `strategy_moderation` (
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
CREATE UNIQUE INDEX `strategy_moderation_author_request` ON `strategy_moderation` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `strategy_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`revision` integer NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strategy_publication_root_revision` ON `strategy_publications` (`root_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `strategy_publication_author_request` ON `strategy_publications` (`author_key`,`request_id`);--> statement-breakpoint
CREATE INDEX `strategy_publication_sponsor_time` ON `strategy_publications` (`sponsor_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `strategy_publication_feed` ON `strategy_publications` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `strategy_reports` (
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
CREATE INDEX `strategy_report_sponsor_time` ON `strategy_reports` (`sponsor_key`,`created_at`);