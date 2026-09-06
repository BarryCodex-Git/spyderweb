import { ensureHostingSchema } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to arrange projects.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This project update was blocked.' }, 403);
  try {
    const body = await request.json() as { projectIds?: unknown };
    if (!Array.isArray(body.projectIds) || body.projectIds.some((id) => typeof id !== 'string')) {
      throw new Error('The project order was incomplete.');
    }
    const projectIds = body.projectIds as string[];
    if (new Set(projectIds).size !== projectIds.length) throw new Error('The project order contains duplicates.');
    const db = await ensureHostingSchema();
    const active = await db.prepare(`SELECT id FROM projects WHERE owner_user_id = ?
      AND lifecycle_status != 'archived'`).bind(identity.userId).all<{ id: string }>();
    const activeIds = new Set(active.results.map((row) => row.id));
    if (activeIds.size !== projectIds.length || projectIds.some((id) => !activeIds.has(id))) {
      throw new Error('The project list changed. Refresh and arrange it again.');
    }
    await db.batch(projectIds.map((id, index) => db.prepare(`UPDATE projects SET sort_order = ?
      WHERE id = ? AND owner_user_id = ?`).bind(index + 1, id, identity.userId)));
    return json({ message: 'Project order saved.' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'The project order could not be saved.' }, 400);
  }
}
