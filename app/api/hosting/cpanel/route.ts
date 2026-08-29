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
    const [connections, domains] = await Promise.all([
      db
        .prepare(`SELECT id, provider, name, base_url AS baseUrl, username, primary_domain AS primaryDomain,
          status, mode, credential_storage AS credentialStorage, capabilities_json AS capabilitiesJson,
          write_actions_enabled AS writeActionsEnabled,
          destructive_actions_enabled AS destructiveActionsEnabled,
          confirmation_policy AS confirmationPolicy, last_sync_at AS lastSyncAt
          FROM hosting_connections WHERE owner_user_id = ? ORDER BY updated_at DESC`)
        .bind(identity.userId)
        .all(),
      db
        .prepare(`SELECT id, connection_id AS connectionId, domain, domain_type AS domainType,
          document_root AS documentRoot, php_version AS phpVersion,
          wordpress_status AS wordpressStatus, ssl_status AS sslStatus, last_seen_at AS lastSeenAt
          FROM hosting_domains WHERE owner_user_id = ? AND active = 1 ORDER BY domain`)
        .bind(identity.userId)
        .all(),
    ]);

    return json({
      connections: connections.results.map((connection) => ({
        ...connection,
        capabilities: JSON.parse(String(connection.capabilitiesJson || '{}')),
        capabilitiesJson: undefined,
      })),
      domains: domains.results,
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
    if (body.readOnly !== true) {
      return json({ error: 'The first cPanel connection must remain read-only.' }, 400);
    }

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
    const statements = [
      db
        .prepare(`INSERT INTO hosting_connections (
          id, owner_user_id, owner_email, provider, name, base_url, username, primary_domain,
          status, mode, credential_storage, encrypted_token, encryption_iv, credential_version,
          capabilities_json, write_actions_enabled,
          destructive_actions_enabled, confirmation_policy, last_sync_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'cpanel', ?, ?, ?, ?, 'connected_read_only', 'read_only', 'encrypted_cloud', ?, ?, ?, ?, 0, 0,
          'owner_code+exact_domain+backup', ?, ?, ?)
        ON CONFLICT(owner_user_id, provider, base_url, username) DO UPDATE SET
          owner_email = excluded.owner_email, name = excluded.name,
          primary_domain = excluded.primary_domain, status = excluded.status,
          credential_storage = excluded.credential_storage,
          encrypted_token = excluded.encrypted_token, encryption_iv = excluded.encryption_iv,
          credential_version = excluded.credential_version,
          capabilities_json = excluded.capabilities_json, last_sync_at = excluded.last_sync_at,
          updated_at = excluded.updated_at`)
        .bind(
          connectionId,
          identity.userId,
          identity.email,
          name,
          discovered.baseUrl,
          discovered.username,
          primaryDomain,
          credential.encryptedToken,
          credential.encryptionIv,
          credential.credentialVersion,
          JSON.stringify(discovered.capabilities),
          now,
          now,
          now,
        ),
      db.prepare('UPDATE hosting_domains SET active = 0 WHERE connection_id = ?').bind(connectionId),
    ];

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
        ) VALUES (?, ?, ?, 'cpanel.read_only_scan', ?, 'success', ?, ?)`)
        .bind(
          crypto.randomUUID(),
          identity.userId,
          connectionId,
          discovered.baseUrl,
          JSON.stringify({ domainCount: discovered.domains.length }),
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
        status: 'connected_read_only',
        mode: 'read_only',
        credentialStorage: 'encrypted_cloud',
        capabilities: discovered.capabilities,
        writeActionsEnabled: 0,
        destructiveActionsEnabled: 0,
        confirmationPolicy: 'owner_code+exact_domain+backup',
        lastSyncAt: now,
      },
      domains: discovered.domains.map((domain) => ({
        ...domain,
        id: undefined,
        connectionId,
        wordpressStatus: 'not_checked',
        sslStatus: 'not_checked',
        lastSeenAt: now,
      })),
      message: `${discovered.domains.length} domains discovered. This cPanel connection is now securely saved for future synchronisation.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The cPanel connection could not be completed.';
    return json({ error: message }, 400);
  }
}
