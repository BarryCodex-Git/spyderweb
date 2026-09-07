UPDATE `hosting_domains`
SET `php_profile_status` = 'php_runtime_pending'
WHERE `wordpress_status` = 'installed'
  AND (`php_version` IS NULL OR `php_version` LIKE '%php7%' OR `php_version` LIKE '7.%');
