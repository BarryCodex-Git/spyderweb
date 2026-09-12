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

export function baseDomainWorkflowForProject(input: {
  buildType: ProjectBuildType;
  wordpressInstalled: boolean;
}) {
  return input.buildType === 'Template' && input.wordpressInstalled
    ? 'Template Loaded'
    : 'Available';
}

export function domainWorkflowForProject(input: {
  stage: ProjectStage;
  stageStatus: ProjectStageStatus;
  progress: number;
  assigned: boolean;
}) {
  const index = PROJECT_STAGES.indexOf(input.stage);
  if (index < 0) return null;
  const servicePagesIndex = PROJECT_STAGES.indexOf('Build All Service Pages');
  const servicePagesComplete = index > servicePagesIndex
    || (index === servicePagesIndex && input.stageStatus === 'completed');
  if (servicePagesComplete && input.progress > 70) return 'Final Stages';
  const buildWorkStarted = index >= PROJECT_STAGES.indexOf('Build Home Page');
  return input.assigned && buildWorkStarted ? 'Busy Working' : null;
}
