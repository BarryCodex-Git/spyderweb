import { ensureHostingSchema, getDatabase } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner to change hosting access.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This access change was blocked for safety.' }, 403);

  const { connectionId } = await params;
  if (!/^[a-f0-9]{32}$/.test(connectionId)) return json({ error: 'Invalid hosting connection.' }, 400);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mode = body.mode;
    if (mode !== 'read_only' && mode !== 'managed_write') {
      return json({ error: 'Choose read-only or managed access.' }, 400);
    }

    const db = await ensureHostingSchema(getDatabase());
    const connection = await db
      .prepare(`SELECT id, name, mode, operational_credential_status AS operationalCredentialStatus FROM hosting_connections
        WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(connectionId, identity.userId)
      .first();
    if (!connection) return json({ error: 'This cPanel connection was not found.' }, 404);
    if (mode === 'managed_write' && connection.operationalCredentialStatus !== 'verified') {
      return json({ error: 'Reconnect this cPanel account so management can use its saved API token.' }, 400);
    }

    const previousMode = String(connection.mode || 'read_only');
    const now = new Date().toISOString();
    const writeActionsEnabled = mode === 'managed_write' ? 1 : 0;
    const destructiveActionsEnabled = mode === 'managed_write'
      && connection.operationalCredentialStatus === 'verified' ? 1 : 0;
    const status = mode === 'managed_write' ? 'connected_managed' : 'connected_read_only';

    await db.batch([
      db
        .prepare(`UPDATE hosting_connections SET mode = ?, status = ?, write_actions_enabled = ?,
          destructive_actions_enabled = ?, updated_at = ?
          WHERE id = ? AND owner_user_id = ?`)
        .bind(mode, status, writeActionsEnabled, destructiveActionsEnabled, now, connectionId, identity.userId),
      db
        .prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'cpanel.access_mode_changed', ?, 'success', ?, ?)`)
        .bind(
          crypto.randomUUID(),
          identity.userId,
          connectionId,
          String(connection.name),
          JSON.stringify({ previousMode, mode, destructiveActionsEnabled: destructiveActionsEnabled === 1 }),
          now,
        ),
    ]);

    return json({
      mode,
      status,
      writeActionsEnabled,
      destructiveActionsEnabled,
      message:
        mode === 'managed_write'
          ? `${String(connection.name)} WordPress operations are active. Per-domain soft locks and clear confirmations remain in place.`
          : `${String(connection.name)} WordPress operations are paused. Domain scanning remains connected.`,
    });
  } catch {
    return json({ error: 'The hosting access mode could not be changed.' }, 500);
  }
}
