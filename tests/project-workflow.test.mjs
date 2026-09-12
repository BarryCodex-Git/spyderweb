import assert from 'node:assert/strict';
import test from 'node:test';

import { domainWorkflowForStage } from '../lib/project-workflow.ts';

test('an active project is busy from the Setup stage onward', () => {
  assert.equal(domainWorkflowForStage('Setup'), 'Busy Working');
  assert.equal(domainWorkflowForStage('Build Home Page'), 'Busy Working');
});

test('review and launch stages remain in Final Stages', () => {
  assert.equal(domainWorkflowForStage('Review Full Build'), 'Final Stages');
  assert.equal(domainWorkflowForStage('Launch Preparation'), 'Final Stages');
});
