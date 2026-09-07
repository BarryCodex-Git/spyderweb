export const PROJECT_PRIORITIES = ['Urgent', 'Busy', 'Idle'] as const;

export type ProjectPriority = typeof PROJECT_PRIORITIES[number] | '';

type PrioritizableProject = {
  priority?: string | null;
  latestActivityAt?: string | null;
  updatedAt?: string | null;
};

const priorityRank: Record<ProjectPriority, number> = {
  Urgent: 0,
  Busy: 1,
  Idle: 2,
  '': 3,
};

export function normalizeProjectPriority(value: unknown): ProjectPriority {
  return PROJECT_PRIORITIES.includes(value as typeof PROJECT_PRIORITIES[number])
    ? value as typeof PROJECT_PRIORITIES[number]
    : '';
}

export function sortProjectsByPriority<T extends PrioritizableProject>(projects: T[]): T[] {
  return projects
    .map((project, defaultIndex) => ({ project, defaultIndex }))
    .sort((left, right) => {
      const leftPriority = normalizeProjectPriority(left.project.priority);
      const rightPriority = normalizeProjectPriority(right.project.priority);
      const rankDifference = priorityRank[leftPriority] - priorityRank[rightPriority];
      if (rankDifference !== 0) return rankDifference;

      if (leftPriority) {
        const leftActivity = Date.parse(left.project.latestActivityAt || left.project.updatedAt || '') || 0;
        const rightActivity = Date.parse(right.project.latestActivityAt || right.project.updatedAt || '') || 0;
        if (leftActivity !== rightActivity) return rightActivity - leftActivity;
      }

      return left.defaultIndex - right.defaultIndex;
    })
    .map(({ project }) => project);
}
