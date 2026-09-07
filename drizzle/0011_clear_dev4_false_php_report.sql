-- DEV4 was used to expose the difference between cPanel's vhost assignment
-- and the document-root handler. Do not display the assignment as the live
-- runtime until the complete handler-aware repair verifies successfully.
UPDATE `hosting_domains`
SET `php_version` = NULL,
    `php_profile_status` = 'not_checked'
WHERE `domain` = 'dev4.testwebsitebuild.com';
