CREATE TABLE `assistance_moderation` (
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
CREATE UNIQUE INDEX `assistance_moderation_author_request` ON `assistance_moderation` (`author_key`,`request_id`);--> statement-breakpoint
CREATE TABLE `assistance_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`author_key` text NOT NULL,
	`sponsor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`command_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	`base_id` text,
	`base_digest` text,
	`target_request_id` text,
	`target_request_digest` text,
	`proposal_id` text,
	`proposal_digest` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistance_publication_author_request` ON `assistance_publications` (`author_key`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assistance_publication_proposal` ON `assistance_publications` (`proposal_id`);--> statement-breakpoint
CREATE INDEX `assistance_publication_sponsor_time` ON `assistance_publications` (`sponsor_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `assistance_publication_feed` ON `assistance_publications` (`kind`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `assistance_response_feed` ON `assistance_publications` (`target_request_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `assistance_reports` (
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
CREATE INDEX `assistance_report_sponsor_time` ON `assistance_reports` (`sponsor_key`,`created_at`);