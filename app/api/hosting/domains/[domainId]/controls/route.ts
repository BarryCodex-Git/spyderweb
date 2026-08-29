import { ensureHostingSchema } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const allowedDevelopers = new Set(['Barry', 'Clive', 'Owner Account']);

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
    const body = (await request.json()) as Record<string, unknown>;
    const db = await ensureHostingSchema();
    const domain = await db
      .prepare(`SELECT id, connection_id AS connectionId, domain, wordpress_status AS wordpressStatus,
        workflow_status_override AS workflowStatusOverride
        FROM hosting_domains WHERE id = ? AND owner_user_id = ? AND active = 1`)
      .bind(domainId, identity.userId)
      .first<Record<string, unknown>>();
    if (!domain) return json({ error: 'This development domain was not found.' }, 404);

    const now = new Date().toISOString();
    if (body.action === 'set_soft_lock') {
      if (typeof body.locked !== 'boolean') return json({ error: 'Choose whether the domain should be locked.' }, 400);
      await db.batch([
        db.prepare(`UPDATE hosting_domains SET wordpress_soft_locked = ? WHERE id = ? AND owner_user_id = ?`)
          .bind(body.locked ? 1 : 0, domainId, identity.userId),
        db.prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'domain.wordpress_soft_lock', ?, 'success', ?, ?)`).bind(
          crypto.randomUUID(), identity.userId, String(domain.connectionId), String(domain.domain),
          JSON.stringify({ locked: body.locked }), now,
        ),
      ]);
      return json({ message: body.locked
        ? `${String(domain.domain)} is protected from WordPress deletion and overwrite.`
        : `${String(domain.domain)} is unlocked. Destructive actions still require final confirmation.` });
    }

    if (body.action === 'assign_developer') {
      const assignedDeveloper = body.assignedDeveloper === null ? null : String(body.assignedDeveloper || '');
      if (assignedDeveloper !== null && !allowedDevelopers.has(assignedDeveloper)) {
        return json({ error: 'Choose a recognised SpyderWeb developer or user.' }, 400);
      }
      const nextWorkflowStatus = assignedDeveloper
        ? domain.workflowStatusOverride === 'Final Stages' ? 'Final Stages' : 'Busy Working'
        : null;
      await db.batch([
        db.prepare(`UPDATE hosting_domains SET assigned_developer = ?, workflow_status_override = ?
          WHERE id = ? AND owner_user_id = ?`)
          .bind(assignedDeveloper, nextWorkflowStatus, domainId, identity.userId),
        db.prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'domain.developer_assignment', ?, 'success', ?, ?)`).bind(
          crypto.randomUUID(), identity.userId, String(domain.connectionId), String(domain.domain),
          JSON.stringify({ assignedDeveloper }), now,
        ),
      ]);
      return json({ message: assignedDeveloper
        ? `${String(domain.domain)} is now assigned to ${assignedDeveloper}.`
        : `${String(domain.domain)} is now unassigned.` });
    }

    return json({ error: 'Choose a valid domain control action.' }, 400);
  } catch {
    return json({ error: 'The domain control could not be updated.' }, 500);
  }
}
