import { ensureHostingSchema, stableId } from '@/lib/hosting-db';
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
  const updatedAt = String(row.updatedAt);
  const wordpressActivityAt = row.wordpressActivityAt ? String(row.wordpressActivityAt) : null;
  const latestActivityAt = wordpressActivityAt && new Date(wordpressActivityAt) > new Date(updatedAt)
    ? wordpressActivityAt : updatedAt;
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
    updatedAt,
    sortOrder: Number(row.sortOrder || 0),
    wordpressActivityAt,
    latestActivityAt,
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

function uuidFromHex(hex: string) {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function importedProjectDefaults(domain: Record<string, unknown>) {
  const domainName = String(domain.domain);
  const siteName = domain.wordpressSiteName ? String(domain.wordpressSiteName) : '';
  const workflow = domain.workflowStatusOverride ? String(domain.workflowStatusOverride) : '';
  const wordpressStatus = String(domain.wordpressStatus || 'not_checked');
  const isTemplate = /(\btemplate\b|\bnew\s+(?:client\s+)?build\b)/i.test(`${domainName} ${siteName}`);
  const developer = PROJECT_DEVELOPERS.includes(String(domain.assignedDeveloper) as ProjectDeveloper)
    ? String(domain.assignedDeveloper) as ProjectDeveloper
    : 'Owner Account';

  if (workflow === 'Final Stages') {
    return { client: siteName || domainName, buildType: 'Template', developer,
      stage: 'Review Full Build', stageStatus: 'in_progress', progress: 71,
      nextAction: 'Confirm the final review and launch preparation stage' } as const;
  }
  if (workflow === 'Busy Working' || (wordpressStatus === 'installed' && !isTemplate)) {
    return { client: siteName || domainName, buildType: 'Template', developer,
      stage: 'Build Home Page', stageStatus: 'in_progress', progress: 12,
      nextAction: 'Confirm the current build stage' } as const;
  }
  if (isTemplate) {
    return { client: siteName || 'Default template', buildType: 'Template', developer,
      stage: 'Setup', stageStatus: 'in_progress', progress: 4,
      nextAction: 'Assign the template build and begin the home page' } as const;
  }
  return { client: siteName || domainName, buildType: 'Template', developer,
    stage: 'Setup', stageStatus: 'not_started', progress: 0,
    nextAction: 'Assign this domain and set its current project stage' } as const;
}

async function ensureDomainProjects(db: Awaited<ReturnType<typeof ensureHostingSchema>>, ownerUserId: string) {
  const missing = await db.prepare(`SELECT d.id, d.domain, d.wordpress_status AS wordpressStatus,
    d.wordpress_site_name AS wordpressSiteName, d.workflow_status_override AS workflowStatusOverride,
    d.assigned_developer AS assignedDeveloper
    FROM hosting_domains d
    WHERE d.owner_user_id = ? AND d.active = 1
      AND NOT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.owner_user_id = d.owner_user_id AND p.domain = d.domain
          AND p.lifecycle_status != 'archived'
      )
    ORDER BY d.domain`).bind(ownerUserId).all<Record<string, unknown>>();
  if (!missing.results.length) return;

  const now = new Date().toISOString();
  const statements = [];
  for (const domain of missing.results) {
    const defaults = importedProjectDefaults(domain);
    const projectId = uuidFromHex(await stableId('project', ownerUserId, String(domain.id)));
    statements.push(
      db.prepare(`INSERT OR IGNORE INTO projects (
        id, owner_user_id, domain_id, domain, client_name, build_type, assigned_developer,
        current_stage, stage_status, progress, target_date, next_action, intake_notes,
        lifecycle_status, last_reported_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 'active', 'Owner Account', ?, ?)`)
        .bind(projectId, ownerUserId, String(domain.id), String(domain.domain), defaults.client,
          defaults.buildType, defaults.developer, defaults.stage, defaults.stageStatus,
          defaults.progress, defaults.nextAction, now, now),
      db.prepare(`INSERT OR IGNORE INTO project_events (
        id, project_id, owner_user_id, event_type, source, stage, stage_status, note, details_json, created_at
      ) VALUES (?, ?, ?, 'project.imported_from_domain', 'System', ?, ?, ?, ?, ?)`)
        .bind(uuidFromHex(await stableId('project-event', ownerUserId, String(domain.id))), projectId,
          ownerUserId, defaults.stage, defaults.stageStatus,
          'Connected domain added to the manual project pipeline.',
          JSON.stringify({ progress: defaults.progress, developer: defaults.developer, automaticRecord: true }), now),
    );
  }
  await db.batch(statements);
}

export async function GET(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to view projects.' }, 401);

  try {
    const db = await ensureHostingSchema();
    await ensureDomainProjects(db, identity.userId);
    const [projectRows, eventRows] = await Promise.all([
      db.prepare(`SELECT p.id, p.domain_id AS domainId, p.domain, p.client_name AS client,
        p.build_type AS buildType, p.assigned_developer AS developer, p.current_stage AS stage,
        p.stage_status AS stageStatus, p.progress, p.target_date AS due, p.next_action AS nextAction,
        p.intake_notes AS intakeNotes, p.lifecycle_status AS lifecycleStatus,
        p.last_reported_by AS lastReportedBy, p.created_at AS createdAt, p.updated_at AS updatedAt,
        sort_order AS sortOrder, d.wordpress_activity_at AS wordpressActivityAt
        FROM projects p LEFT JOIN hosting_domains d ON d.id = p.domain_id
        WHERE p.owner_user_id = ? AND p.lifecycle_status != 'archived'
        ORDER BY CASE WHEN p.sort_order > 0 THEN 0 ELSE 1 END, p.sort_order, p.created_at ASC`)
        .bind(identity.userId).all<Record<string, unknown>>(),
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
      AND lifecycle_status != 'archived' LIMIT 1`).bind(identity.userId, domain.domain).first<{ id: string }>();

    const projectId = existing?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const workflow = domainWorkflowForStage(stage);
    const projectWrite = existing
      ? db.prepare(`UPDATE projects SET client_name = ?, build_type = ?, assigned_developer = ?,
          current_stage = ?, stage_status = ?, progress = ?, target_date = ?, next_action = ?,
          intake_notes = ?, lifecycle_status = 'active', last_reported_by = 'Owner Account', updated_at = ?
          WHERE id = ? AND owner_user_id = ?`)
        .bind(client, buildType, developer, stage, stageStatus, progress, due, nextAction,
          intakeNotes, now, projectId, identity.userId)
      : db.prepare(`INSERT INTO projects (
        id, owner_user_id, domain_id, domain, client_name, build_type, assigned_developer,
        current_stage, stage_status, progress, target_date, next_action, intake_notes,
        lifecycle_status, last_reported_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'Owner Account', ?, ?)`)
        .bind(projectId, identity.userId, domainId, domain.domain, client, buildType, developer,
          stage, stageStatus, progress, due, nextAction, intakeNotes, now, now);
    const statements = [
      projectWrite,
      db.prepare(`INSERT INTO project_events (
        id, project_id, owner_user_id, event_type, source, stage, stage_status, note, details_json, created_at
      ) VALUES (?, ?, ?, ?, 'Owner Account', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), projectId, identity.userId,
          existing ? 'project.configured' : 'project.created', stage, stageStatus, note,
          JSON.stringify({ progress, developer, buildType }), now),
      db.prepare(`UPDATE hosting_domains SET assigned_developer = ?, workflow_status_override = ?
        WHERE id = ? AND owner_user_id = ?`).bind(developer, workflow, domainId, identity.userId),
    ];
    await db.batch(statements);
    return json({ projectId, message: `${client} is now tracked manually from ${stage}.` }, existing ? 200 : 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'The project could not be created.' }, 400);
  }
}
