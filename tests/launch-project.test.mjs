import assert from 'node:assert/strict';
import { isSelectableExistingDomain, normalizeSubdomainLabel, rootInstallationUrl, suggestedSubdomainLabel } from '../lib/launch-project.ts';

assert.equal(normalizeSubdomainLabel('jamies-plumbing'), 'jamies-plumbing');
assert.throws(() => normalizeSubdomainLabel('jamies.plumbing'));
assert.equal(suggestedSubdomainLabel("Jamie's Plumbing"), 'jamie-s-plumbing');
assert.equal(rootInstallationUrl('https://dev.example.com/', 'dev.example.com'), true);
assert.equal(rootInstallationUrl('https://dev.example.com/wp', 'dev.example.com'), false);
assert.equal(rootInstallationUrl('https://other.example.com/', 'dev.example.com'), false);
const templateSources = new Set(['master-template']);
assert.equal(isSelectableExistingDomain({ id: 'blank', source: 'cpanel', status: 'Available' }, templateSources), true);
assert.equal(isSelectableExistingDomain({ id: 'preloaded', source: 'cpanel', status: 'Template Loaded' }, templateSources), true);
assert.equal(isSelectableExistingDomain({ id: 'busy', source: 'cpanel', status: 'Busy Working' }, templateSources), false);
assert.equal(isSelectableExistingDomain({ id: 'master-template', source: 'cpanel', status: 'Template Loaded' }, templateSources), false);

console.log('Launch project safeguards passed.');
