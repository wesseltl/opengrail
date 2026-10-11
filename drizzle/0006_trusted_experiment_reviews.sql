CREATE TABLE `experiment_reviews` (
 `id` text PRIMARY KEY NOT NULL,
 `original_id` text NOT NULL,
 `original_digest` text NOT NULL,
 `sequence` integer NOT NULL,
 `author_key` text NOT NULL,
 `sponsor_key` text NOT NULL,
 `request_id` text NOT NULL,
 `command_digest` text NOT NULL,
 `payload` text NOT NULL,
 `digest` text NOT NULL,
 `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_review_original_sequence` ON `experiment_reviews` (`original_id`,`sequence`);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_review_author_request` ON `experiment_reviews` (`author_key`,`request_id`);
--> statement-breakpoint
CREATE INDEX `experiment_review_original_feed` ON `experiment_reviews` (`original_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `experiment_review_sponsor_time` ON `experiment_reviews` (`sponsor_key`,`created_at`);
--> statement-breakpoint
CREATE TABLE `experiment_review_moderation` (
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
 PRIMARY KEY (`record_id`,`sequence`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_review_moderation_author_request` ON `experiment_review_moderation` (`author_key`,`request_id`);
--> statement-breakpoint
CREATE TABLE `experiment_review_reports` (
 `author_key` text NOT NULL,
 `request_id` text NOT NULL,
 `sponsor_key` text NOT NULL,
 `record_id` text NOT NULL,
 `record_digest` text NOT NULL,
 `command_digest` text NOT NULL,
 `payload` text NOT NULL,
 `digest` text NOT NULL,
 `created_at` text NOT NULL,
 PRIMARY KEY (`author_key`,`request_id`)
);
--> statement-breakpoint
CREATE INDEX `experiment_review_report_sponsor_time` ON `experiment_review_reports` (`sponsor_key`,`created_at`);
