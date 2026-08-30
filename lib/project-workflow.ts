export const PROJECT_STAGES = [
  'Setup',
  'Build Home Page',
  'Review Home Page',
  'Set Up Service Page Template',
  'Build First Service Page',
  'Build All Service Pages',
  'Build Service Page Hub',
  'Location Pages (optional)',
  'Review Full Build',
  'Launch Preparation',
  'Migrated to Live Site',
  'Ready to Delete',
] as const;

export const PROJECT_STAGE_STATUSES = [
  'not_started',
  'in_progress',
  'awaiting_review',
  'blocked',
  'completed',
] as const;

export const PROJECT_DEVELOPERS = ['Barry', 'Clive', 'Owner Account'] as const;
export const PROJECT_BUILD_TYPES = ['Template', 'Custom'] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];
export type ProjectStageStatus = (typeof PROJECT_STAGE_STATUSES)[number];
export type ProjectDeveloper = (typeof PROJECT_DEVELOPERS)[number];
export type ProjectBuildType = (typeof PROJECT_BUILD_TYPES)[number];

export function suggestedProgress(stage: ProjectStage, status: ProjectStageStatus) {
  if (status === 'completed' && stage === PROJECT_STAGES.at(-1)) return 100;
  const index = PROJECT_STAGES.indexOf(stage);
  const base = Math.round((index / PROJECT_STAGES.length) * 100);
  return Math.min(99, base + (status === 'not_started' ? 0 : status === 'in_progress' ? 4 : 6));
}

export function domainWorkflowForStage(stage: ProjectStage) {
  const index = PROJECT_STAGES.indexOf(stage);
  if (index < 1) return null;
  return index >= PROJECT_STAGES.indexOf('Review Full Build') ? 'Final Stages' : 'Busy Working';
}
