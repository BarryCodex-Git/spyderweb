import { ensureHostingSchema } from '@/lib/hosting-db';
import {
  PROJECT_DEVELOPERS,
  PROJECT_STAGES,
  PROJECT_STAGE_STATUSES,
  domainWorkflowForStage,
  suggestedProgress,
  type ProjectDeveloper,
  type ProjectStage,
  type ProjectStageStatus,
} from '@/lib/project-workflow';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function optionalText(value: unknown, fallback: string, maxLength = 1000) {
  if (value === undefined) return fallback;
  if (value === null) return '';
  if (typeof value !== 'string' || value.length > maxLength || /[\0]/.test(value)) throw new Error('Enter valid project information.');
  return value.trim();
}

function enumValue<T extends string>(value: unknown, fallback: T, allowed: readonly T[], label: string): T {
  if (value === undefined) return fallback;
  const cleaned = String(value) as T;
  if (!allowed.includes(cleaned)) throw new Error(`Choose a valid ${label}.`);
  return cleaned;
}

function progressValue(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  const progress = Number(value);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error('Progress must be between 0 and 100.');
  return progress;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner to update a project.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This project update was blocked for safety.' }, 403);

  try {
    const { projectId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ error: 'Invalid project.' }, 400);
    const body = (await request.json()) as Record<string, unknown>;
    const db = await ensureHostingSchema();
    const current = await db.prepare(`SELECT id, domain_id AS domainId, domain, client_name AS client,
      assigned_developer AS developer, current_stage AS stage, stage_status AS stageStatus,
      progress, target_date AS due, next_action AS nextAction
      FROM projects WHERE id = ? AND owner_user_id = ? AND lifecycle_status != 'archived'`)
      .bind(projectId, identity.userId).first<Record<string, unknown>>();
    if (!current) return json({ error: 'This project was not found.' }, 404);

    const action = String(body.action || 'save');
    let stage = enumValue(body.stage, String(current.stage) as ProjectStage, PROJECT_STAGES, 'project stage');
    let stageStatus = enumValue(body.stageStatus, String(current.stageStatus) as ProjectStageStatus, PROJECT_STAGE_STATUSES, 'stage status');
    let progress = progressValue(body.progress, Number(current.progress));
    let eventType = 'project.manual_update';
    let defaultNote = `Manual progress updated at ${stage}.`;

    if (action === 'complete_stage') {
      const currentIndex = PROJECT_STAGES.indexOf(String(current.stage) as ProjectStage);
      const nextIndex = Math.min(currentIndex + 1, PROJECT_STAGES.length - 1);
      stage = PROJECT_STAGES[nextIndex];
      stageStatus = currentIndex === PROJECT_STAGES.length - 1 ? 'completed' : 'in_progress';
      progress = suggestedProgress(stage, stageStatus);
      eventType = 'project.stage_completed';
      defaultNote = currentIndex === PROJECT_STAGES.length - 1
        ? 'The final workflow stage was marked complete.'
        : `${String(current.stage)} completed. ${stage} is now active.`;
    } else if (action === 'request_review') {
      stageStatus = 'awaiting_review';
      progress = Math.max(progress, suggestedProgress(stage, stageStatus));
      eventType = 'project.review_requested';
      defaultNote = `Review requested for ${stage}.`;
    } else if (action !== 'save') {
      return json({ error: 'Choose a valid project action.' }, 400);
    }

    const developer = enumValue(body.developer, String(current.developer) as ProjectDeveloper, PROJECT_DEVELOPERS, 'developer');
    const due = optionalText(body.due, String(current.due || ''), 80);
    const nextAction = optionalText(body.nextAction, String(current.nextAction || ''), 500) || 'Choose the next required action';
    const note = optionalText(body.note, '', 2000) || defaultNote;
    const now = new Date().toISOString();
    const workflow = domainWorkflowForStage(stage);
    const statements = [
      db.prepare(`UPDATE projects SET assigned_developer = ?, current_stage = ?, stage_status = ?,
        progress = ?, target_date = ?, next_action = ?, last_reported_by = 'Owner Account', updated_at = ?
        WHERE id = ? AND owner_user_id = ?`)
        .bind(developer, stage, stageStatus, progress, due || null, nextAction, now, projectId, identity.userId),
      db.prepare(`INSERT INTO project_events (
        id, project_id, owner_user_id, event_type, source, stage, stage_status, note, details_json, created_at
      ) VALUES (?, ?, ?, ?, 'Owner Account', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), projectId, identity.userId, eventType, stage, stageStatus, note,
          JSON.stringify({ progress, developer, nextAction, due }), now),
    ];
    if (current.domainId) {
      statements.push(workflow
        ? db.prepare(`UPDATE hosting_domains SET assigned_developer = ?, workflow_status_override = ?
          WHERE id = ? AND owner_user_id = ?`).bind(developer, workflow, current.domainId, identity.userId)
        : db.prepare(`UPDATE hosting_domains SET assigned_developer = ?
          WHERE id = ? AND owner_user_id = ?`).bind(developer, current.domainId, identity.userId));
    }
    await db.batch(statements);
    return json({ message: `${String(current.client)} was updated to ${stage} · ${stageStatus.replaceAll('_', ' ')}.` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'The project could not be updated.' }, 400);
  }
}
