import { discoverCpanel } from '@/lib/cpanel';
import { decryptHostingToken } from '@/lib/credential-crypto';
import { ensureHostingSchema, stableId } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner to synchronise cPanel.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This synchronisation request was blocked for safety.' }, 403);

  const { connectionId } = await params;
  if (!/^[a-f0-9]{32}$/.test(connectionId)) return json({ error: 'Invalid hosting connection.' }, 400);

  try {
    const db = await ensureHostingSchema();
    const connection = await db
      .prepare(`SELECT id, name, base_url AS baseUrl, username, mode, encrypted_token AS encryptedToken,
        encryption_iv AS encryptionIv FROM hosting_connections
        WHERE id = ? AND owner_user_id = ? AND provider = 'cpanel'`)
      .bind(connectionId, identity.userId)
      .first<Record<string, unknown>>();

    if (!connection) return json({ error: 'This cPanel connection was not found.' }, 404);

    const token = await decryptHostingToken(
      String(connection.encryptedToken),
      String(connection.encryptionIv),
      identity.userId,
      connectionId,
    );
    const discovered = await discoverCpanel({
      baseUrl: String(connection.baseUrl),
      username: String(connection.username),
      token,
    });

    const now = new Date().toISOString();
    const connectionStatus = discovered.scanStatus === 'complete'
      ? String(connection.mode) === 'managed_write' ? 'connected_managed' : 'connected_read_only'
      : 'connected_scan_issue';
    const statements = [
      db
        .prepare(`UPDATE hosting_connections SET
          status = ?,
          capabilities_json = ?, last_sync_at = ?, updated_at = ?
          WHERE id = ? AND owner_user_id = ?`)
        .bind(connectionStatus, JSON.stringify(discovered.capabilities), now, now, connectionId, identity.userId),
    ];

    if (discovered.scanStatus === 'complete') {
      statements.push(db.prepare('UPDATE hosting_domains SET active = 0 WHERE connection_id = ?').bind(connectionId));
    }

    for (const domain of discovered.domains) {
      const domainId = await stableId(connectionId, domain.domain);
      statements.push(
        db
          .prepare(`INSERT INTO hosting_domains (
            id, connection_id, owner_user_id, domain, domain_type, document_root, php_version,
            wordpress_status, ssl_status, active, last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'not_checked', 'not_checked', 1, ?)
          ON CONFLICT(connection_id, domain) DO UPDATE SET
            domain_type = excluded.domain_type, document_root = excluded.document_root,
            php_version = excluded.php_version, active = 1, last_seen_at = excluded.last_seen_at`)
          .bind(
            domainId,
            connectionId,
            identity.userId,
            domain.domain,
            domain.domainType,
            domain.documentRoot,
            domain.phpVersion,
            now,
          ),
      );
    }

    statements.push(
      db
        .prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'cpanel.read_only_sync', ?, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          identity.userId,
          connectionId,
          discovered.baseUrl,
          discovered.scanStatus === 'complete' ? 'success' : 'warning',
          JSON.stringify({ domainCount: discovered.domains.length, inventoryAttempts: discovered.inventoryAttempts }),
          now,
        ),
    );
    await db.batch(statements);

    return json({
      scanStatus: discovered.scanStatus,
      message: discovered.scanStatus === 'complete'
        ? `${String(connection.name)} synchronised successfully. ${discovered.domains.length} domains are current.`
        : `${String(connection.name)} is connected, but the live domain scan still needs attention. The saved connection remains available for retrying.`,
      domainCount: discovered.domains.length,
      lastSyncAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The cPanel synchronisation failed.';
    return json({ error: message }, 400);
  }
}
