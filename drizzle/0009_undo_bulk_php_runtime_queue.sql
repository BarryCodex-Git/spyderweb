-- Version 60 incorrectly queued every installed site whose PHP version had not
-- been stored. Undo only that queue and the automatic failures produced after
-- the version-60 rollout; manual maintenance remains available per domain.
UPDATE `hosting_domains`
SET `php_profile_status` = 'not_checked'
WHERE `php_profile_status` = 'php_runtime_pending';

UPDATE `hosting_domains`
SET `php_profile_status` = 'not_checked'
WHERE `php_profile_status` = 'failed'
  AND EXISTS (
    SELECT 1
    FROM `hosting_audit_events`
    WHERE `hosting_audit_events`.`target` = `hosting_domains`.`domain`
      AND `hosting_audit_events`.`action` = 'wordpress.apply_php_profile'
      AND `hosting_audit_events`.`outcome` = 'blocked'
      AND `hosting_audit_events`.`created_at` >= '2026-09-07T05:15:00.000Z'
  );
