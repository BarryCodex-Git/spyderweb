export type ProjectActivitySource = 'wordpress' | 'project';

function validTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function latestProjectActivity(projectUpdatedAt: string, wordpressActivityAt?: string | null) {
  const projectTimestamp = validTimestamp(projectUpdatedAt) ?? 0;
  const wordpressTimestamp = validTimestamp(wordpressActivityAt);
  if (wordpressTimestamp !== null && wordpressTimestamp > projectTimestamp) {
    return { at: new Date(wordpressTimestamp).toISOString(), source: 'wordpress' as ProjectActivitySource };
  }
  return { at: projectUpdatedAt, source: 'project' as ProjectActivitySource };
}

export function activityRefreshDue(checkedAt: string | null | undefined, now = Date.now(), intervalMs = 5 * 60_000) {
  const checkedTimestamp = validTimestamp(checkedAt);
  return checkedTimestamp === null || now - checkedTimestamp >= intervalMs;
}
