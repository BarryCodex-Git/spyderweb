import assert from 'node:assert/strict';
import {
  buildSubdomainCreateQuery,
  effectiveDocumentRoot,
  isCpanelSuccessStatus,
  issueSubdomainCreate,
  reconcileCreatedSubdomain,
} from '../lib/cpanel-subdomain.ts';

assert.equal(isCpanelSuccessStatus(1), true);
assert.equal(isCpanelSuccessStatus('1'), true, 'some cPanel hosts serialize a successful status as a string');
assert.equal(isCpanelSuccessStatus(true), true);
assert.equal(isCpanelSuccessStatus(0), false);

const input = { label: 'dev5', parentDomain: 'testwebsitebuild.com' };
assert.deepEqual(buildSubdomainCreateQuery(input), {
  domain: 'dev5',
  rootdomain: 'testwebsitebuild.com',
  dir: 'dev5.testwebsitebuild.com',
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

const misleadingError = new Error('A DNS entry already exists.');
const reconciled = reconcileCreatedSubdomain(
  [{ domain: 'dev5.testwebsitebuild.com', documentRoot: '/dev5.testwebsitebuild.com' }],
  'dev5.testwebsitebuild.com',
  misleadingError,
);
assert.equal(reconciled.documentRoot, '/dev5.testwebsitebuild.com',
  'an authoritative cPanel inventory match must override a misleading write response');
assert.equal(effectiveDocumentRoot({ domain: 'dev6.testwebsitebuild.com', domainType: 'subdomain', documentRoot: null }),
  'dev6.testwebsitebuild.com', 'a missing root must recover from the full-hostname convention');
assert.equal(effectiveDocumentRoot({ domain: 'testwebsitebuild.com', domainType: 'main', documentRoot: null }), null,
  'a primary-domain root must never be guessed');
assert.throws(() => reconcileCreatedSubdomain([], 'dev5.testwebsitebuild.com', misleadingError), misleadingError);
console.log('Single-write cPanel subdomain creation passed.');
