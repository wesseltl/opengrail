CREATE TABLE `research_moderation` (
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
CREATE UNIQUE INDEX `research_moderation_author_request` ON `research_moderation` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `research_publications` (
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
CREATE UNIQUE INDEX `research_publication_root_revision` ON `research_publications` (`root_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `research_publication_author_request` ON `research_publications` (`author_key`,`request_id`);--> statement-breakpoint
CREATE INDEX `research_publication_sponsor_time` ON `research_publications` (`sponsor_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `research_reports` (
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
CREATE INDEX `research_report_sponsor_time` ON `research_reports` (`sponsor_key`,`created_at`);