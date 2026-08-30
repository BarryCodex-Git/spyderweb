import { discoverCpanel } from '@/lib/cpanel';
import { decryptHostingToken, decryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema, stableId } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import { listSoftaculousInstallations, type OperationalCredential } from '@/lib/softaculous';

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
        encryption_iv AS encryptionIv, encrypted_operational_secret AS encryptedOperationalSecret,
        operational_secret_iv AS operationalSecretIv,
        operational_credential_status AS operationalCredentialStatus FROM hosting_connections
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
    if (connection.operationalCredentialStatus === 'verified') {
      const credential = connection.encryptedOperationalSecret && connection.operationalSecretIv
        ? JSON.parse(await decryptSecret(
            String(connection.encryptedOperationalSecret),
            String(connection.operationalSecretIv),
            identity.userId,
            `operational:${connectionId}`,
          )) as OperationalCredential
        : { username: String(connection.username), token, authMode: 'cpanel_token' as const };
      try {
        const installations = await listSoftaculousInstallations(String(connection.baseUrl), credential);
        const byDomain = new Map(installations.map((installation) => [installation.domain, installation]));
        for (const domain of discovered.domains) {
          const installation = byDomain.get(domain.domain);
          domain.wordpressStatus = installation ? 'installed' : 'not_installed';
          domain.wordpressInstallationId = installation?.id ?? null;
          domain.wordpressSiteName = installation?.siteName ?? null;
          domain.wordpressUrl = installation?.url ?? null;
          domain.wordpressVersion = installation?.version ?? null;
          domain.wordpressSource = installation ? 'Softaculous connected API' : null;
        }
        discovered.wordpressInstallationCount = installations.length;
        discovered.wordpressScanStatus = 'complete';
        discovered.capabilities.wordpressInventory = true;
        discovered.capabilities.wordpressManagement = true;
      } catch (error) {
        discovered.inventoryAttempts.push({
          source: 'Softaculous management API',
          status: 'unavailable',
          domainCount: 0,
          message: error instanceof Error ? error.message : 'The management API did not return an inventory.',
        });
      }
    }

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
            wordpress_status, wordpress_version, wordpress_site_name, wordpress_url,
            wordpress_installation_id, wordpress_source, ssl_status, active, last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_checked', 1, ?)
          ON CONFLICT(connection_id, domain) DO UPDATE SET
            domain_type = excluded.domain_type, document_root = excluded.document_root,
            php_version = excluded.php_version,
            wordpress_status = CASE WHEN excluded.wordpress_status = 'not_checked'
              THEN hosting_domains.wordpress_status ELSE excluded.wordpress_status END,
            wordpress_version = CASE WHEN excluded.wordpress_status = 'not_checked'
              THEN hosting_domains.wordpress_version ELSE excluded.wordpress_version END,
            wordpress_site_name = CASE WHEN excluded.wordpress_status = 'not_checked'
              THEN hosting_domains.wordpress_site_name ELSE excluded.wordpress_site_name END,
            wordpress_url = CASE WHEN excluded.wordpress_status = 'not_checked'
              THEN hosting_domains.wordpress_url ELSE excluded.wordpress_url END,
            wordpress_installation_id = CASE WHEN excluded.wordpress_status = 'not_checked'
              THEN hosting_domains.wordpress_installation_id ELSE excluded.wordpress_installation_id END,
            wordpress_source = CASE WHEN excluded.wordpress_status = 'not_checked'
              THEN hosting_domains.wordpress_source ELSE excluded.wordpress_source END,
            active = 1, last_seen_at = excluded.last_seen_at`)
          .bind(
            domainId,
            connectionId,
            identity.userId,
            domain.domain,
            domain.domainType,
            domain.documentRoot,
            domain.phpVersion,
            domain.wordpressStatus,
            domain.wordpressVersion,
            domain.wordpressSiteName,
            domain.wordpressUrl,
            domain.wordpressInstallationId,
            domain.wordpressSource,
            now,
          ),
      );
    }

    statements.push(
      db
        .prepare(`INSERT INTO hosting_audit_events (
          id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
        ) VALUES (?, ?, ?, 'cpanel.inventory_sync', ?, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          identity.userId,
          connectionId,
          discovered.baseUrl,
          discovered.scanStatus === 'complete' ? 'success' : 'warning',
          JSON.stringify({
            domainCount: discovered.domains.length,
            wordpressInstallationCount: discovered.wordpressInstallationCount,
            wordpressScanStatus: discovered.wordpressScanStatus,
            inventoryAttempts: discovered.inventoryAttempts,
          }),
          now,
        ),
    );
    await db.batch(statements);

    return json({
      scanStatus: discovered.scanStatus,
      message: discovered.scanStatus === 'complete'
        ? discovered.wordpressScanStatus === 'complete'
          ? `${String(connection.name)} synchronised successfully. ${discovered.domains.length} domains and ${discovered.wordpressInstallationCount} WordPress installations are current.`
          : `${String(connection.name)} domains are current, but WordPress inspection still needs attention. The saved connection will retry automatically.`
        : `${String(connection.name)} is connected, but the live domain scan still needs attention. The saved connection remains available for retrying.`,
      domainCount: discovered.domains.length,
      wordpressInstallationCount: discovered.wordpressInstallationCount,
      wordpressScanStatus: discovered.wordpressScanStatus,
      lastSyncAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The cPanel synchronisation failed.';
    return json({ error: message }, 400);
  }
}
