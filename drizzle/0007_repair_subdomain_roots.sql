UPDATE `hosting_domains`
SET `document_root` = `domain`
WHERE `document_root` IS NULL
  AND `domain_type` = 'subdomain';
--> statement-breakpoint
UPDATE `hosting_domains`
SET `php_profile_status` = 'wordpress_memory_pending'
WHERE `wordpress_status` = 'installed'
  AND `php_profile_status` = 'recommended_applied';
