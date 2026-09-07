import assert from 'node:assert/strict';
import {
  collectPhpPackages, currentPhpPackage, ensureCpanelPhpHandler, phpPackageLabel,
  selectRecommendedPhpPackage,
} from '../lib/php-version.ts';

assert.deepEqual(collectPhpPackages({ versions: ['ea-php74', 'ea-php83', 'ea-php84'] }), [
  'ea-php74', 'ea-php83', 'ea-php84',
]);
assert.equal(selectRecommendedPhpPackage(['ea-php74', 'ea-php83', 'ea-php84'], 'ea-php84'), 'ea-php84');
assert.equal(selectRecommendedPhpPackage(['ea-php74', 'ea-php83', 'ea-php84'], 'ea-php74'), 'ea-php83');
assert.equal(selectRecommendedPhpPackage(['ea-php74', 'ea-php82'], 'ea-php74'), null);
assert.equal(currentPhpPackage([{ vhost: 'dev4.testwebsitebuild.com', version: 'ea-php74' }], 'dev4.testwebsitebuild.com'), 'ea-php74');
assert.equal(currentPhpPackage({
  default: { version: 'ea-php84' },
  vhosts: [{ vhost: 'dev4.testwebsitebuild.com', phpversion: 'ea-php74' }],
}, 'dev4.testwebsitebuild.com'), 'ea-php74');
assert.equal(currentPhpPackage({
  'dev4.testwebsitebuild.com': { version: 'ea-php83' },
}, 'dev4.testwebsitebuild.com'), 'ea-php83');
assert.equal(currentPhpPackage({ default: { version: 'ea-php84' } }, 'dev4.testwebsitebuild.com'), null);
assert.equal(phpPackageLabel('ea-php83'), 'PHP 8.3');

const staleHandler = `# WordPress rules\n# php -- BEGIN cPanel-generated handler, do not edit\n<IfModule mime_module>\n  AddHandler application/x-httpd-ea-php74 .php .php7 .phtml\n</IfModule>\n# php -- END cPanel-generated handler, do not edit\n`;
const repairedHandler = ensureCpanelPhpHandler(staleHandler, 'ea-php84');
assert.equal(repairedHandler.changed, true);
assert.deepEqual(repairedHandler.previousPackages, ['ea-php74']);
assert.match(repairedHandler.content, /application\/x-httpd-ea-php84 \.php \.php8 \.phtml/);
assert.doesNotMatch(repairedHandler.content, /ea-php74/);
assert.equal(ensureCpanelPhpHandler(repairedHandler.content, 'ea-php84').changed, false);

console.log('php-version tests passed');
