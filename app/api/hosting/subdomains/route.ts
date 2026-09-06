import { createCpanelSubdomain, discoverCpanel } from '@/lib/cpanel';
import { decryptHostingToken } from '@/lib/credential-crypto';
import { ensureHostingSchema, stableId } from '@/lib/hosting-db';
import { normalizeSubdomainLabel } from '@/lib/launch-project';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function requiredText(value: unknown, label: string, max: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\0]/.test(text)) throw new Error(`Enter a valid ${label}.`);
  return text;
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This subdomain request was blocked.' }, 403);

  const db = await ensureHostingSchema();
  let connectionId = '';
  let targetDomain = '';
  try {
    const body = await request.json() as Record<string, unknown>;
    connectionId = requiredText(body.connectionId, 'cPanel account', 64);
    const parentDomain = requiredText(body.parentDomain, 'parent domain', 253).toLowerCase();
    const label = normalizeSubdomainLabel(requiredText(body.subdomainLabel, 'subdomain name', 63));
    targetDomain = `${label}.${parentDomain}`;

    const connection = await db.prepare(`SELECT id, base_url AS baseUrl, username,
      encrypted_token AS encryptedToken, encryption_iv AS encryptionIv, mode
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection) throw new Error('Choose a connected cPanel account.');
    if (connection.mode !== 'managed_write') throw new Error('Resume operations for this cPanel account before creating a subdomain.');

    const parent = await db.prepare(`SELECT domain FROM hosting_domains
      WHERE connection_id = ? AND owner_user_id = ? AND domain = ? AND active = 1
        AND domain_type IN ('main', 'addon') LIMIT 1`)
      .bind(connectionId, identity.userId, parentDomain).first();
    if (!parent) throw new Error('Choose a main or add-on domain from the selected cPanel account.');

    const collision = await db.prepare(`SELECT id FROM hosting_domains
      WHERE owner_user_id = ? AND domain = ? AND active = 1 LIMIT 1`)
      .bind(identity.userId, targetDomain).first();
    if (collision) throw new Error(`${targetDomain} already exists. Nothing was changed.`);

    const token = await decryptHostingToken(
      String(connection.encryptedToken), String(connection.encryptionIv), identity.userId, connectionId,
    );
    let creationError: unknown = null;
    try {
      await createCpanelSubdomain({
        baseUrl: String(connection.baseUrl), username: String(connection.username), token, label, parentDomain,
      });
    } catch (error) { creationError = error; }

    // Always reconcile against cPanel after the one write. If cPanel completed the
    // operation but returned a late or misleading error, the new domain is still
    // imported and reported as successful instead of triggering a second write.
    const discovered = await discoverCpanel({
      baseUrl: String(connection.baseUrl), username: String(connection.username), token,
    });
    const created = discovered.domains.find((domain) => domain.domain === targetDomain);
    if (!created) {
      if (creationError) throw creationError;
      throw new Error(`cPanel accepted the request, but ${targetDomain} could not yet be verified. Scan the account before trying again.`);
    }

    const now = new Date().toISOString();
    const domainId = await stableId(connectionId, targetDomain);
    await db.batch([
      db.prepare(`INSERT INTO hosting_domains (
        id, connection_id, owner_user_id, domain, domain_type, document_root, php_version,
        wordpress_status, wordpress_version, wordpress_site_name, wordpress_url,
        wordpress_installation_id, wordpress_source, workflow_status_override,
        wordpress_soft_locked, php_profile_status, ssl_status, active, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 1, 'not_checked', 'not_checked', 1, ?)
      ON CONFLICT(connection_id, domain) DO UPDATE SET
        domain_type = excluded.domain_type, document_root = excluded.document_root,
        php_version = excluded.php_version, wordpress_status = excluded.wordpress_status,
        workflow_status_override = 'Available', wordpress_soft_locked = 1,
        active = 1, last_seen_at = excluded.last_seen_at`)
        .bind(domainId, connectionId, identity.userId, targetDomain, created.domainType,
          created.documentRoot, created.phpVersion, created.wordpressStatus,
          created.wordpressVersion, created.wordpressSiteName, created.wordpressUrl,
          created.wordpressInstallationId, created.wordpressSource, now),
      db.prepare(`INSERT INTO hosting_audit_events (
        id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
      ) VALUES (?, ?, ?, 'cpanel.subdomain_create', ?, 'success', ?, ?)`)
        .bind(crypto.randomUUID(), identity.userId, connectionId, targetDomain,
          JSON.stringify({ parentDomain, label, documentRoot: created.documentRoot,
            reconciledAfterCpanelError: Boolean(creationError) }), now),
    ]);

    return json({ domainId, domain: targetDomain, message: `${targetDomain} was created and added as an available domain.` }, 201);
  } catch (error) {
    if (connectionId) {
      await db.prepare(`INSERT INTO hosting_audit_events (
        id, owner_user_id, connection_id, action, target, outcome, details_json, created_at
      ) VALUES (?, ?, ?, 'cpanel.subdomain_create', ?, 'failed', ?, ?)`)
        .bind(crypto.randomUUID(), identity.userId, connectionId, targetDomain || null,
          JSON.stringify({ error: error instanceof Error ? error.message : 'Subdomain creation failed' }), new Date().toISOString())
        .run().catch(() => undefined);
    }
    return json({ error: error instanceof Error ? error.message : 'The subdomain could not be created.' }, 400);
  }
}
