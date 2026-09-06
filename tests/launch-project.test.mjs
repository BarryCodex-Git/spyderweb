import assert from 'node:assert/strict';
import { normalizeSubdomainLabel, rootInstallationUrl, suggestedSubdomainLabel } from '../lib/launch-project.ts';

assert.equal(normalizeSubdomainLabel('jamies-plumbing'), 'jamies-plumbing');
assert.throws(() => normalizeSubdomainLabel('jamies.plumbing'));
assert.equal(suggestedSubdomainLabel("Jamie's Plumbing"), 'jamie-s-plumbing');
assert.equal(rootInstallationUrl('https://dev.example.com/', 'dev.example.com'), true);
assert.equal(rootInstallationUrl('https://dev.example.com/wp', 'dev.example.com'), false);
assert.equal(rootInstallationUrl('https://other.example.com/', 'dev.example.com'), false);

console.log('Launch project safeguards passed.');
