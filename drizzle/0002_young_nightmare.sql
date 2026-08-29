ALTER TABLE `hosting_domains` ADD `assigned_developer` text;--> statement-breakpoint
ALTER TABLE `hosting_domains` ADD `wordpress_soft_locked` integer DEFAULT 1 NOT NULL;