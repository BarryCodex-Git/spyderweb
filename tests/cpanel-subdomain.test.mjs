import assert from 'node:assert/strict';
import { buildSubdomainCreateQuery, isCpanelSuccessStatus, issueSubdomainCreate } from '../lib/cpanel-subdomain.ts';

assert.equal(isCpanelSuccessStatus(1), true);
assert.equal(isCpanelSuccessStatus('1'), true, 'some cPanel hosts serialize a successful status as a string');
assert.equal(isCpanelSuccessStatus(true), true);
assert.equal(isCpanelSuccessStatus(0), false);

const input = { label: 'dev5', parentDomain: 'testwebsitebuild.com' };
assert.deepEqual(buildSubdomainCreateQuery(input), {
  domain: 'dev5',
  rootdomain: 'testwebsitebuild.com',
  dir: 'public_html/dev5.testwebsitebuild.com',
  disallowdot: '1',
});

const calls = [];
await issueSubdomainCreate(async (module, fn, query) => {
  calls.push({ module, fn, query });
  return { ok: true };
}, input);

assert.equal(calls.length, 1, 'subdomain creation must issue exactly one cPanel write');
assert.equal(calls[0].module, 'SubDomain');
assert.equal(calls[0].fn, 'addsubdomain');
console.log('Single-write cPanel subdomain creation passed.');
