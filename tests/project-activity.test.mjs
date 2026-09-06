import assert from 'node:assert/strict';
import { activityRefreshDue, latestProjectActivity } from '../lib/project-activity.ts';

const project = '2026-09-01T10:00:00.000Z';
const wordpress = '2026-09-02T12:00:00.000Z';
assert.deepEqual(latestProjectActivity(project, wordpress), { at: wordpress, source: 'wordpress' });
assert.deepEqual(latestProjectActivity(project, '2026-08-31T10:00:00.000Z'), { at: project, source: 'project' });
assert.equal(activityRefreshDue('2026-09-06T09:58:00.000Z', Date.parse('2026-09-06T10:00:00.000Z')), false);
assert.equal(activityRefreshDue('2026-09-06T09:54:00.000Z', Date.parse('2026-09-06T10:00:00.000Z')), true);
console.log('Project activity selection and refresh throttling passed.');
