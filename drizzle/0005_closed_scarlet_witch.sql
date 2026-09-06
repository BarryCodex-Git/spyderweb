CREATE TABLE `template_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`slot_number` integer NOT NULL,
	`name` text NOT NULL,
	`source_domain_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_domain_id`) REFERENCES `hosting_domains`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_template_slots_owner_number` ON `template_slots` (`owner_user_id`,`slot_number`);--> statement-breakpoint
ALTER TABLE `hosting_domains` ADD `wordpress_activity_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
PRAGMA optimize;
