import assert from 'node:assert/strict';
import { normalizeProjectPriority, sortProjectsByPriority } from '../lib/project-priority.ts';

const projects = [
  { id: 'default-first', priority: '', latestActivityAt: '2026-09-07T09:00:00Z' },
  { id: 'idle', priority: 'Idle', latestActivityAt: '2026-09-07T12:00:00Z' },
  { id: 'urgent-old', priority: 'Urgent', latestActivityAt: '2026-09-05T09:00:00Z' },
  { id: 'busy', priority: 'Busy', latestActivityAt: '2026-09-07T11:00:00Z' },
  { id: 'urgent-new', priority: 'Urgent', latestActivityAt: '2026-09-07T10:00:00Z' },
  { id: 'default-second', priority: '', latestActivityAt: '2026-09-01T09:00:00Z' },
];

assert.deepEqual(
  sortProjectsByPriority(projects).map(({ id }) => id),
  ['urgent-new', 'urgent-old', 'busy', 'idle', 'default-first', 'default-second'],
  'manual groups should override default order, with activity sorting only inside each manual group',
);

const cleared = projects.map((project) => project.id === 'urgent-new' ? { ...project, priority: '' } : project);
assert.deepEqual(
  sortProjectsByPriority(cleared).filter((project) => !project.priority).map(({ id }) => id),
  ['default-first', 'urgent-new', 'default-second'],
  'cleared priority should return to the untouched default sequence',
);

assert.equal(normalizeProjectPriority('invalid'), '');
assert.equal(normalizeProjectPriority('Busy'), 'Busy');

console.log('Project priority sorting tests passed.');
