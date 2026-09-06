import { clientIntakeDocx } from '@/lib/client-intake-docx';
import { parseClientIntake } from '@/lib/client-intake';
import { ensureHostingSchema } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function projectRecord(db: D1Database, ownerUserId: string, projectId: string) {
  return db.prepare(`SELECT id, client_name AS clientName, domain, intake_json AS intakeJson,
    created_at AS createdAt FROM projects WHERE id = ? AND owner_user_id = ? AND lifecycle_status != 'archived'`)
    .bind(projectId, ownerUserId).first<Record<string, unknown>>();
}

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to view project details.' }, 401);
  try {
    const { projectId } = await params;
    const db = await ensureHostingSchema();
    const project = await projectRecord(db, identity.userId, projectId);
    if (!project) return json({ error: 'Project not found.' }, 404);
    const intake = parseClientIntake(JSON.parse(String(project.intakeJson || '{}')), String(project.clientName));
    if (new URL(request.url).searchParams.get('download') !== '1') return json({ intake });
    const buffer = await clientIntakeDocx({ intake, domain: String(project.domain), createdAt: String(project.createdAt) });
    const filename = `${String(project.clientName).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'client'}-project-details.docx`;
    return new Response(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store',
    } });
  } catch {
    return json({ error: 'Project details are temporarily unavailable.' }, 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to update project details.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This project update was blocked.' }, 403);
  try {
    const { projectId } = await params;
    const db = await ensureHostingSchema();
    const project = await projectRecord(db, identity.userId, projectId);
    if (!project) return json({ error: 'Project not found.' }, 404);
    const body = await request.json() as { intake?: unknown };
    const intake = parseClientIntake(body.intake, String(project.clientName));
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`UPDATE projects SET intake_json = ?, updated_at = ?, last_reported_by = 'Owner Account'
        WHERE id = ? AND owner_user_id = ?`).bind(JSON.stringify(intake), now, projectId, identity.userId),
      db.prepare(`INSERT INTO project_events (id, project_id, owner_user_id, event_type, source,
        note, details_json, created_at) VALUES (?, ?, ?, 'project.intake_updated', 'Owner Account',
        'Client project details updated.', '{}', ?)`).bind(crypto.randomUUID(), projectId, identity.userId, now),
    ]);
    return json({ intake, message: 'Project details saved.' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Project details could not be saved.' }, 400);
  }
}
