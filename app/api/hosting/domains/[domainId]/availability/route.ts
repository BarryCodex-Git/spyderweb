import { ensureHostingSchema } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner to update a domain.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This domain update was blocked for safety.' }, 403);

  const { domainId } = await params;
  if (!/^[a-f0-9]{32}$/.test(domainId)) return json({ error: 'Invalid hosting domain.' }, 400);

  try {
    const db = await ensureHostingSchema();
    const domain = await db
      .prepare(`SELECT id, connection_id AS connectionId, domain FROM hosting_domains
        WHERE id = ? AND owner_user_id = ? AND active = 1`)
      .bind(domainId, identity.userId)
      .first<Record<string, unknown>>();
    if (!domain) return json({ error: 'This development domain was not found.' }, 404);

    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(`UPDATE hosting_domains SET workflow_status_override = 'Available'
          WHERE id = ? AND owner_user_id = ?`)
        .bind(domainId, identity.userId),
      db
        .prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'domain.marked_available', ?, 'success', ?, ?)`)
        .bind(
          crypto.randomUUID(),
          identity.userId,
          String(domain.connectionId),
          String(domain.domain),
          JSON.stringify({ scope: 'spyderweb_workflow_only' }),
          now,
        ),
    ]);

    return json({
      message: `${String(domain.domain)} is now available for a new build in SpyderWeb. The existing WordPress installation was not changed.`,
    });
  } catch {
    return json({ error: 'The domain could not be marked available.' }, 500);
  }
}
