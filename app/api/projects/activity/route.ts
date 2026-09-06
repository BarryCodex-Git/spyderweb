import { publicWordPressInfo } from '@/lib/cpanel';
import { ensureHostingSchema } from '@/lib/hosting-db';
import { activityRefreshDue } from '@/lib/project-activity';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to refresh project activity.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This activity refresh was blocked.' }, 403);

  try {
    const body = await request.json().catch(() => ({})) as { force?: boolean };
    const db = await ensureHostingSchema();
    const rows = await db.prepare(`SELECT DISTINCT d.id, d.domain,
      d.wordpress_activity_checked_at AS checkedAt
      FROM hosting_domains d JOIN projects p ON p.domain_id = d.id
      WHERE d.owner_user_id = ? AND d.active = 1 AND d.wordpress_status = 'installed'
        AND p.lifecycle_status != 'archived' ORDER BY d.domain`)
      .bind(identity.userId).all<{ id: string; domain: string; checkedAt: string | null }>();
    const now = new Date().toISOString();
    const due = body.force ? rows.results : rows.results.filter((row) => activityRefreshDue(row.checkedAt));
    const scans = await mapWithConcurrency(due, 4, async (row) => {
      const info = await publicWordPressInfo(row.domain);
      return { ...row, activityAt: info.detected ? info.activityAt : null };
    });
    if (scans.length) {
      await db.batch(scans.map((scan) => db.prepare(`UPDATE hosting_domains
        SET wordpress_activity_at = COALESCE(?, wordpress_activity_at), wordpress_activity_checked_at = ?
        WHERE id = ? AND owner_user_id = ?`).bind(scan.activityAt, now, scan.id, identity.userId)));
    }
    return json({ checked: scans.length, updated: scans.filter((scan) => scan.activityAt).length, checkedAt: now });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'WordPress activity could not be refreshed.' }, 400);
  }
}
