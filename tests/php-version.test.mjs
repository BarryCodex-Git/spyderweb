import assert from 'node:assert/strict';
import {
  collectPhpPackages, currentPhpPackage, phpPackageLabel,
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

console.log('php-version tests passed');
