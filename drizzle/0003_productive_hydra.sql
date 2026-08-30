CREATE TABLE `owner_security` (
	`owner_user_id` text PRIMARY KEY NOT NULL,
	`encrypted_totp_secret` text,
	`totp_secret_iv` text,
	`totp_enabled` integer DEFAULT 0 NOT NULL,
	`pending_created_at` text,
	`last_accepted_counter` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `hosting_connections` ADD `operational_auth_type` text;--> statement-breakpoint
ALTER TABLE `hosting_connections` ADD `encrypted_operational_secret` text;--> statement-breakpoint
ALTER TABLE `hosting_connections` ADD `operational_secret_iv` text;--> statement-breakpoint
ALTER TABLE `hosting_connections` ADD `operational_credential_status` text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE `hosting_connections` ADD `default_template_domain` text;--> statement-breakpoint
ALTER TABLE `hosting_domains` ADD `restore_point_at` text;--> statement-breakpoint
ALTER TABLE `hosting_domains` ADD `php_profile_status` text DEFAULT 'not_checked' NOT NULL;