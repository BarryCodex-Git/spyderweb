CREATE TABLE `project_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`source` text DEFAULT 'Owner Account' NOT NULL,
	`stage` text,
	`stage_status` text,
	`note` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_events_project_created` ON `project_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_project_events_owner_created` ON `project_events` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`domain_id` text,
	`domain` text NOT NULL,
	`client_name` text NOT NULL,
	`build_type` text NOT NULL,
	`assigned_developer` text NOT NULL,
	`current_stage` text DEFAULT 'Setup' NOT NULL,
	`stage_status` text DEFAULT 'not_started' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`target_date` text,
	`next_action` text DEFAULT 'Complete setup and pre-flight check' NOT NULL,
	`intake_notes` text,
	`lifecycle_status` text DEFAULT 'active' NOT NULL,
	`last_reported_by` text DEFAULT 'Owner Account' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `hosting_domains`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_projects_owner_updated` ON `projects` (`owner_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_projects_owner_domain` ON `projects` (`owner_user_id`,`domain`);