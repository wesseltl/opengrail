CREATE TABLE `network_agents` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`credential_id` text NOT NULL,
	`registration_request_id` text NOT NULL,
	`registration_digest` text NOT NULL,
	`token_digest` text NOT NULL,
	`payload` text NOT NULL,
	`digest` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`revocation_request_id` text,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `network_agent_credential` ON `network_agents` (`credential_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `network_agent_registration` ON `network_agents` (`owner_id`,`registration_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `network_agent_revocation` ON `network_agents` (`owner_id`,`revocation_request_id`);--> statement-breakpoint
CREATE INDEX `network_agent_owner` ON `network_agents` (`owner_id`);