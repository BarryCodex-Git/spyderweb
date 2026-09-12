import assert from 'node:assert/strict';
import test from 'node:test';

import { baseDomainWorkflowForProject, domainWorkflowForProject } from '../lib/project-workflow.ts';

test('only an installed template build belongs in Template Loaded', () => {
  assert.equal(baseDomainWorkflowForProject({ buildType: 'Template', wordpressInstalled: true }), 'Template Loaded');
  assert.equal(baseDomainWorkflowForProject({ buildType: 'Template', wordpressInstalled: false }), 'Available');
  assert.equal(baseDomainWorkflowForProject({ buildType: 'Custom', wordpressInstalled: true }), 'Available');
});

test('setup preserves the underlying Available or Template Loaded state', () => {
  assert.equal(domainWorkflowForProject({ stage: 'Setup', stageStatus: 'in_progress', progress: 4, assigned: true }), null);
});

test('assigned projects become busy when template changes begin', () => {
  assert.equal(domainWorkflowForProject({ stage: 'Build Home Page', stageStatus: 'in_progress', progress: 12, assigned: true }), 'Busy Working');
  assert.equal(domainWorkflowForProject({ stage: 'Build Home Page', stageStatus: 'in_progress', progress: 12, assigned: false }), null);
});

test('final stages require completed service-page work and progress above 70 percent', () => {
  assert.equal(domainWorkflowForProject({ stage: 'Review Full Build', stageStatus: 'in_progress', progress: 71, assigned: true }), 'Final Stages');
  assert.equal(domainWorkflowForProject({ stage: 'Review Full Build', stageStatus: 'in_progress', progress: 70, assigned: true }), 'Busy Working');
  assert.equal(domainWorkflowForProject({ stage: 'Build All Service Pages', stageStatus: 'completed', progress: 71, assigned: true }), 'Final Stages');
  assert.equal(domainWorkflowForProject({ stage: 'Build All Service Pages', stageStatus: 'in_progress', progress: 71, assigned: true }), 'Busy Working');
});
