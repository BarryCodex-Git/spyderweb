CREATE TABLE `hosting_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`connection_id` text,
	`action` text NOT NULL,
	`target` text,
	`outcome` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hosting_audit_owner_created` ON `hosting_audit_events` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `hosting_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`username` text NOT NULL,
	`primary_domain` text NOT NULL,
	`status` text DEFAULT 'connected_read_only' NOT NULL,
	`mode` text DEFAULT 'read_only' NOT NULL,
	`credential_storage` text DEFAULT 'transient' NOT NULL,
	`capabilities_json` text DEFAULT '{}' NOT NULL,
	`write_actions_enabled` integer DEFAULT 0 NOT NULL,
	`destructive_actions_enabled` integer DEFAULT 0 NOT NULL,
	`confirmation_policy` text DEFAULT 'owner_code+exact_domain+backup' NOT NULL,
	`last_sync_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_hosting_connections_owner_account` ON `hosting_connections` (`owner_user_id`,`provider`,`base_url`,`username`);--> statement-breakpoint
CREATE TABLE `hosting_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`domain` text NOT NULL,
	`domain_type` text NOT NULL,
	`document_root` text,
	`php_version` text,
	`wordpress_status` text DEFAULT 'not_checked' NOT NULL,
	`ssl_status` text DEFAULT 'not_checked' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `hosting_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_hosting_domains_connection_domain` ON `hosting_domains` (`connection_id`,`domain`);--> statement-breakpoint
CREATE INDEX `idx_hosting_domains_owner_active` ON `hosting_domains` (`owner_user_id`,`active`);