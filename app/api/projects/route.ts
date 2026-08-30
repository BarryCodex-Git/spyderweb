import { ensureHostingSchema } from '@/lib/hosting-db';
import {
  PROJECT_BUILD_TYPES,
  PROJECT_DEVELOPERS,
  PROJECT_STAGES,
  PROJECT_STAGE_STATUSES,
  domainWorkflowForStage,
  type ProjectBuildType,
  type ProjectDeveloper,
  type ProjectStage,
  type ProjectStageStatus,
} from '@/lib/project-workflow';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function textValue(value: unknown, label: string, maxLength = 255) {
  if (typeof value !== 'string') throw new Error(`Enter a valid ${label}.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength || /[\0]/.test(cleaned)) throw new Error(`Enter a valid ${label}.`);
  return cleaned;
}

function optionalText(value: unknown, maxLength = 1000) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('Enter valid project information.');
  const cleaned = value.trim();
  if (cleaned.length > maxLength || /[\0]/.test(cleaned)) throw new Error('Project information is too long.');
  return cleaned || null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const cleaned = String(value || '') as T;
  if (!allowed.includes(cleaned)) throw new Error(`Choose a valid ${label}.`);
  return cleaned;
}

function progressValue(value: unknown) {
  const progress = Number(value);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error('Progress must be between 0 and 100.');
  return progress;
}

function mapProject(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    domainId: row.domainId ? String(row.domainId) : null,
    domain: String(row.domain),
    client: String(row.client),
    buildType: String(row.buildType),
    developer: String(row.developer),
    stage: String(row.stage),
    stageStatus: String(row.stageStatus),
    progress: Number(row.progress),
    due: row.due ? String(row.due) : '',
    next: String(row.nextAction),
    intakeNotes: row.intakeNotes ? String(row.intakeNotes) : '',
    lifecycleStatus: String(row.lifecycleStatus),
    lastReportedBy: String(row.lastReportedBy),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    project: String(row.project),
    developer: String(row.developer),
    eventType: String(row.eventType),
    source: String(row.source),
    stage: row.stage ? String(row.stage) : null,
    stageStatus: row.stageStatus ? String(row.stageStatus) : null,
    note: row.note ? String(row.note) : null,
    details: JSON.parse(String(row.detailsJson || '{}')),
    createdAt: String(row.createdAt),
  };
}

export async function GET(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to view projects.' }, 401);

  try {
    const db = await ensureHostingSchema();
    const [projectRows, eventRows] = await Promise.all([
      db.prepare(`SELECT id, domain_id AS domainId, domain, client_name AS client,
        build_type AS buildType, assigned_developer AS developer, current_stage AS stage,
        stage_status AS stageStatus, progress, target_date AS due, next_action AS nextAction,
        intake_notes AS intakeNotes, lifecycle_status AS lifecycleStatus,
        last_reported_by AS lastReportedBy, created_at AS createdAt, updated_at AS updatedAt
        FROM projects WHERE owner_user_id = ? AND lifecycle_status != 'archived'
        ORDER BY updated_at DESC`).bind(identity.userId).all<Record<string, unknown>>(),
      db.prepare(`SELECT e.id, e.project_id AS projectId, p.client_name AS project,
        p.assigned_developer AS developer, e.event_type AS eventType, e.source,
        e.stage, e.stage_status AS stageStatus, e.note, e.details_json AS detailsJson,
        e.created_at AS createdAt
        FROM project_events e JOIN projects p ON p.id = e.project_id
        WHERE e.owner_user_id = ? ORDER BY e.created_at DESC LIMIT 200`)
        .bind(identity.userId).all<Record<string, unknown>>(),
    ]);
    return json({ projects: projectRows.results.map(mapProject), events: eventRows.results.map(mapEvent) });
  } catch {
    return json({ error: 'Project information is temporarily unavailable.' }, 500);
  }
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner to create a project.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This project request was blocked for safety.' }, 403);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const domainId = textValue(body.domainId, 'development domain', 64);
    if (!/^[a-f0-9]{32}$/.test(domainId)) throw new Error('Choose a connected development domain.');
    const client = textValue(body.client, 'client or business name', 180);
    const buildType = enumValue(body.buildType, PROJECT_BUILD_TYPES, 'build type') as ProjectBuildType;
    const developer = enumValue(body.developer, PROJECT_DEVELOPERS, 'developer') as ProjectDeveloper;
    const stage = enumValue(body.stage ?? 'Setup', PROJECT_STAGES, 'project stage') as ProjectStage;
    const stageStatus = enumValue(body.stageStatus ?? 'not_started', PROJECT_STAGE_STATUSES, 'stage status') as ProjectStageStatus;
    const progress = progressValue(body.progress ?? 0);
    const due = optionalText(body.due, 80);
    const nextAction = textValue(body.nextAction || 'Complete setup and pre-flight check', 'next action', 500);
    const intakeNotes = optionalText(body.intakeNotes, 4000);
    const note = optionalText(body.note, 2000) || `Project added manually at ${stage}.`;
    const db = await ensureHostingSchema();
    const domain = await db.prepare(`SELECT id, domain FROM hosting_domains
      WHERE id = ? AND owner_user_id = ? AND active = 1`).bind(domainId, identity.userId)
      .first<{ id: string; domain: string }>();
    if (!domain) throw new Error('Choose a connected development domain.');
    const existing = await db.prepare(`SELECT id FROM projects WHERE owner_user_id = ? AND domain = ?
      AND lifecycle_status != 'archived' LIMIT 1`).bind(identity.userId, domain.domain).first();
    if (existing) return json({ error: `${domain.domain} already has an active project. Open it from Projects.` }, 409);

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const workflow = domainWorkflowForStage(stage);
    const statements = [
      db.prepare(`INSERT INTO projects (
        id, owner_user_id, domain_id, domain, client_name, build_type, assigned_developer,
        current_stage, stage_status, progress, target_date, next_action, intake_notes,
        lifecycle_status, last_reported_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'Owner Account', ?, ?)`)
        .bind(projectId, identity.userId, domainId, domain.domain, client, buildType, developer,
          stage, stageStatus, progress, due, nextAction, intakeNotes, now, now),
      db.prepare(`INSERT INTO project_events (
        id, project_id, owner_user_id, event_type, source, stage, stage_status, note, details_json, created_at
      ) VALUES (?, ?, ?, 'project.created', 'Owner Account', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), projectId, identity.userId, stage, stageStatus, note,
          JSON.stringify({ progress, developer, buildType }), now),
      workflow
        ? db.prepare(`UPDATE hosting_domains SET assigned_developer = ?, workflow_status_override = ?
          WHERE id = ? AND owner_user_id = ?`).bind(developer, workflow, domainId, identity.userId)
        : db.prepare(`UPDATE hosting_domains SET assigned_developer = ?
          WHERE id = ? AND owner_user_id = ?`).bind(developer, domainId, identity.userId),
    ];
    await db.batch(statements);
    return json({ projectId, message: `${client} is now tracked manually from ${stage}.` }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'The project could not be created.' }, 400);
  }
}
