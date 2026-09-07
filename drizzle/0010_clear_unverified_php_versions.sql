-- Version 60 could mistake a generic/default entry in cPanel's response for
-- the requested domain's runtime. Remove only values recorded by that rollout;
-- the strict per-vhost verifier will repopulate them after a genuine read-back.
UPDATE `hosting_domains`
SET `php_version` = NULL,
    `php_profile_status` = 'not_checked'
WHERE EXISTS (
  SELECT 1
  FROM `hosting_audit_events`
  WHERE `hosting_audit_events`.`target` = `hosting_domains`.`domain`
    AND `hosting_audit_events`.`action` = 'wordpress.apply_php_profile'
    AND `hosting_audit_events`.`outcome` = 'success'
    AND `hosting_audit_events`.`created_at` >= '2026-09-07T05:15:00.000Z'
);
