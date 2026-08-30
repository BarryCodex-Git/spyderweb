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
      await db.batch([
        db.prepare(`UPDATE hosting_domains SET assigned_developer = ?
          WHERE id = ? AND owner_user_id = ?`)
          .bind(assignedDeveloper, domainId, identity.userId),
        db.prepare(`UPDATE projects SET assigned_developer = COALESCE(?, assigned_developer),
          last_reported_by = 'Owner Account', updated_at = ?
          WHERE domain_id = ? AND owner_user_id = ? AND lifecycle_status != 'archived'`)
          .bind(assignedDeveloper, now, domainId, identity.userId),
        db.prepare(`INSERT INTO project_events (
          id, project_id, owner_user_id, event_type, source, stage, stage_status, note, details_json, created_at
        ) SELECT ?, id, owner_user_id, 'project.assignment_changed', 'Owner Account', current_stage,
          stage_status, ?, ?, ? FROM projects
          WHERE domain_id = ? AND owner_user_id = ? AND lifecycle_status != 'archived'`)
          .bind(crypto.randomUUID(), assignedDeveloper
            ? `Project transferred to ${assignedDeveloper}.`
            : 'Domain assignment was cleared; the project keeps its current owner until reassigned in Projects.',
          JSON.stringify({ assignedDeveloper }), now, domainId, identity.userId),
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

    if (body.action === 'set_build_started') {
      if (domain.wordpressStatus !== 'installed') {
        return json({ error: 'Load WordPress and the approved template before starting the home-page build.' }, 400);
      }
      await db.batch([
        db.prepare(`UPDATE hosting_domains SET workflow_status_override = 'Busy Working'
          WHERE id = ? AND owner_user_id = ?`).bind(domainId, identity.userId),
        db.prepare(`UPDATE projects SET current_stage = 'Build Home Page', stage_status = 'in_progress',
          progress = CASE WHEN progress < 12 THEN 12 ELSE progress END,
          next_action = 'Build and review the home page', last_reported_by = 'Owner Account', updated_at = ?
          WHERE domain_id = ? AND owner_user_id = ? AND lifecycle_status != 'archived'`)
          .bind(now, domainId, identity.userId),
        db.prepare(`INSERT INTO project_events (
          id, project_id, owner_user_id, event_type, source, stage, stage_status, note, details_json, created_at
        ) SELECT ?, id, owner_user_id, 'project.homepage_started', 'Owner Account',
          'Build Home Page', 'in_progress', 'Home-page build started from Domain Management.', '{}', ?
          FROM projects WHERE domain_id = ? AND owner_user_id = ? AND lifecycle_status != 'archived'`)
          .bind(crypto.randomUUID(), now, domainId, identity.userId),
        db.prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'domain.homepage_build_started', ?, 'success', '{}', ?)`).bind(
          crypto.randomUUID(), identity.userId, String(domain.connectionId), String(domain.domain), now,
        ),
      ]);
      return json({ message: `${String(domain.domain)} moved to Busy Working. The home-page build is now active.` });
    }

    return json({ error: 'Choose a valid domain control action.' }, 400);
  } catch {
    return json({ error: 'The domain control could not be updated.' }, 500);
  }
}
