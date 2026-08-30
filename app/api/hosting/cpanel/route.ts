import { discoverCpanel } from '@/lib/cpanel';
import { encryptHostingToken } from '@/lib/credential-crypto';
import { ensureHostingSchema, getDatabase, stableId } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function cleanText(value: unknown, label: string, maxLength = 255) {
  if (typeof value !== 'string') throw new Error(`Enter a valid ${label}.`);
  const result = value.trim();
  if (!result || result.length > maxLength || /[\r\n\0]/.test(result)) {
    throw new Error(`Enter a valid ${label}.`);
  }
  return result;
}

export async function GET(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to view hosting connections.' }, 401);

  try {
    const db = await ensureHostingSchema();
    await db.prepare(`UPDATE hosting_connections SET
      operational_auth_type = NULL, operational_credential_status = 'not_configured',
      destructive_actions_enabled = 0,
      default_template_domain = COALESCE(default_template_domain, (
        SELECT d.domain FROM hosting_domains d
        WHERE d.connection_id = hosting_connections.id AND d.owner_user_id = hosting_connections.owner_user_id
          AND d.active = 1 AND LOWER(d.domain) LIKE '%template%'
        ORDER BY CASE WHEN d.wordpress_status = 'installed' THEN 0 ELSE 1 END, d.domain LIMIT 1
      )), updated_at = ?
      WHERE owner_user_id = ? AND provider = 'cpanel'
        AND operational_auth_type = 'cpanel_token' AND encrypted_operational_secret IS NULL`)
      .bind(new Date().toISOString(), identity.userId).run();
    const [connections, domains, audit] = await Promise.all([
      db
        .prepare(`SELECT id, provider, name, base_url AS baseUrl, username, primary_domain AS primaryDomain,
          status, mode, credential_storage AS credentialStorage, capabilities_json AS capabilitiesJson,
          write_actions_enabled AS writeActionsEnabled,
          destructive_actions_enabled AS destructiveActionsEnabled,
          operational_credential_status AS operationalCredentialStatus,
          default_template_domain AS defaultTemplateDomain,
          confirmation_policy AS confirmationPolicy, last_sync_at AS lastSyncAt
          FROM hosting_connections WHERE owner_user_id = ? ORDER BY updated_at DESC`)
        .bind(identity.userId)
        .all(),
      db
        .prepare(`SELECT id, connection_id AS connectionId, domain, domain_type AS domainType,
          document_root AS documentRoot, php_version AS phpVersion,
          wordpress_status AS wordpressStatus, wordpress_version AS wordpressVersion,
          wordpress_site_name AS wordpressSiteName, wordpress_url AS wordpressUrl,
          wordpress_installation_id AS wordpressInstallationId, wordpress_source AS wordpressSource,
          workflow_status_override AS workflowStatusOverride,
          assigned_developer AS assignedDeveloper, wordpress_soft_locked AS wordpressSoftLocked,
          restore_point_at AS restorePointAt, php_profile_status AS phpProfileStatus,
          ssl_status AS sslStatus, last_seen_at AS lastSeenAt
          FROM hosting_domains WHERE owner_user_id = ? AND active = 1 ORDER BY domain`)
        .bind(identity.userId)
        .all(),
      db.prepare(`SELECT id, action, target, outcome, details_json AS detailsJson, created_at AS createdAt
        FROM hosting_audit_events WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 40`)
        .bind(identity.userId).all(),
    ]);

    return json({
      connections: connections.results.map((connection) => ({
        ...connection,
        capabilities: JSON.parse(String(connection.capabilitiesJson || '{}')),
        capabilitiesJson: undefined,
      })),
      domains: domains.results,
      audit: audit.results.map((event) => ({
        ...event,
        details: JSON.parse(String(event.detailsJson || '{}')),
        detailsJson: undefined,
      })),
    });
  } catch {
    return json({ error: 'Hosting inventory is temporarily unavailable.' }, 500);
  }
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner to connect cPanel.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This connection request was blocked for safety.' }, 403);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = cleanText(body.name, 'connection name', 100);
    const primaryDomain = cleanText(body.primaryDomain, 'primary development domain', 253).toLowerCase();
    const discovered = await discoverCpanel({
      baseUrl: cleanText(body.baseUrl, 'secure cPanel URL', 500),
      username: cleanText(body.username, 'cPanel username', 128),
      token: cleanText(body.token, 'cPanel API token', 4096),
    });

    const now = new Date().toISOString();
    const connectionId = await stableId(
      identity.userId,
      'cpanel',
      discovered.baseUrl,
      discovered.username,
    );
    const credential = await encryptHostingToken(
      cleanText(body.token, 'cPanel API token', 4096),
      identity.userId,
      connectionId,
    );
    const db = await ensureHostingSchema(getDatabase());
    const connectionStatus = discovered.scanStatus === 'complete' ? 'connected_managed' : 'connected_scan_issue';
    const defaultTemplateDomain = discovered.domains
      .filter((domain) => /template/i.test(domain.domain))
      .sort((a, b) => Number(b.wordpressStatus === 'installed') - Number(a.wordpressStatus === 'installed'))[0]?.domain ?? null;
    const statements = [
      db
        .prepare(`INSERT INTO hosting_connections (
          id, owner_user_id, owner_email, provider, name, base_url, username, primary_domain,
          status, mode, credential_storage, encrypted_token, encryption_iv, credential_version,
          capabilities_json, write_actions_enabled, destructive_actions_enabled,
          operational_auth_type, operational_credential_status, default_template_domain,
          confirmation_policy, last_sync_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'cpanel', ?, ?, ?, ?, ?, 'managed_write', 'encrypted_cloud', ?, ?, ?, ?, 1, 0,
          NULL, 'not_configured', ?, 'soft_lock+clear_confirmation', ?, ?, ?)
        ON CONFLICT(owner_user_id, provider, base_url, username) DO UPDATE SET
          owner_email = excluded.owner_email, name = excluded.name,
          primary_domain = excluded.primary_domain,
          status = excluded.status, mode = 'managed_write',
          credential_storage = excluded.credential_storage,
          encrypted_token = excluded.encrypted_token, encryption_iv = excluded.encryption_iv,
          credential_version = excluded.credential_version,
          capabilities_json = excluded.capabilities_json,
          write_actions_enabled = 1,
          destructive_actions_enabled = CASE WHEN hosting_connections.operational_credential_status = 'verified' THEN 1 ELSE 0 END,
          default_template_domain = COALESCE(excluded.default_template_domain, hosting_connections.default_template_domain),
          last_sync_at = excluded.last_sync_at,
          updated_at = excluded.updated_at`)
        .bind(
          connectionId,
          identity.userId,
          identity.email,
          name,
          discovered.baseUrl,
          discovered.username,
          primaryDomain,
          connectionStatus,
          credential.encryptedToken,
          credential.encryptionIv,
          credential.credentialVersion,
          JSON.stringify(discovered.capabilities),
          defaultTemplateDomain,
          now,
          now,
          now,
        ),
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
        ) VALUES (?, ?, ?, 'cpanel.inventory_scan', ?, ?, ?, ?)`)
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
      connection: {
        id: connectionId,
        provider: 'cpanel',
        name,
        baseUrl: discovered.baseUrl,
        username: discovered.username,
        primaryDomain,
        status: connectionStatus,
        mode: 'managed_write',
        credentialStorage: 'encrypted_cloud',
        capabilities: discovered.capabilities,
        writeActionsEnabled: 1,
        destructiveActionsEnabled: 0,
        operationalCredentialStatus: 'not_configured',
        defaultTemplateDomain,
        confirmationPolicy: 'soft_lock+clear_confirmation',
        lastSyncAt: now,
      },
      domains: discovered.domains.map((domain) => ({
        ...domain,
        id: undefined,
        connectionId,
        sslStatus: 'not_checked',
        workflowStatusOverride: null,
        lastSeenAt: now,
      })),
      scanStatus: discovered.scanStatus,
      wordpressScanStatus: discovered.wordpressScanStatus,
      message: discovered.scanStatus === 'complete'
        ? discovered.wordpressScanStatus === 'complete'
          ? `${discovered.domains.length} domains discovered and ${discovered.wordpressInstallationCount} WordPress installations identified. Domain and PHP management are connected. Activate WordPress Management in Settings to enable Softaculous actions.`
          : `${discovered.domains.length} domains discovered. Domain and PHP management are connected; activate WordPress Management in Settings for installs, deletion and template cloning.`
        : 'cPanel connected. The live domain scan needs another attempt; use Retry scan from Settings, then activate WordPress Management.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The cPanel connection could not be completed.';
    return json({ error: message }, 400);
  }
}
