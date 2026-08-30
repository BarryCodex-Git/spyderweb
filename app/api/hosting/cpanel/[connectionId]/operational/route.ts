import { encryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import { listSoftaculousInstallations } from '@/lib/softaculous';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function field(value: unknown, label: string, max: number) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max || /[\r\n\0]/.test(result)) throw new Error(`Enter a valid ${label}.`);
  return result;
}

export async function POST(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This WordPress activation was blocked.' }, 403);
  const { connectionId } = await params;
  if (!/^[a-f0-9]{32}$/.test(connectionId)) return json({ error: 'Invalid hosting connection.' }, 400);

  try {
    const body = await request.json() as Record<string, unknown>;
    const db = await ensureHostingSchema();
    const connection = await db.prepare(`SELECT id, name, base_url AS baseUrl, username
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection) return json({ error: 'This cPanel connection was not found.' }, 404);

    const credential = {
      username: String(connection.username),
      password: field(body.password, 'cPanel account password', 4096),
      authMode: 'cpanel_basic' as const,
    };
    const defaultTemplateDomain = field(body.defaultTemplateDomain, 'default template domain', 253).toLowerCase();
    const templateRecord = await db.prepare(`SELECT id FROM hosting_domains WHERE connection_id = ?
      AND owner_user_id = ? AND domain = ? AND active = 1 LIMIT 1`)
      .bind(connectionId, identity.userId, defaultTemplateDomain).first();
    if (!templateRecord) throw new Error('Choose a template domain from this connected cPanel account.');

    // Read-only verification: no installation is changed during activation.
    const installations = await listSoftaculousInstallations(String(connection.baseUrl), credential);
    const template = installations.find((installation) => installation.domain === defaultTemplateDomain);
    if (!template?.id) {
      throw new Error(`Softaculous connected, but ${defaultTemplateDomain} is not registered as a WordPress installation. Open WordPress Manager by Softaculous, run Scan, then try again.`);
    }

    const encrypted = await encryptSecret(JSON.stringify({
      ...credential,
      adminUsername: 'admin',
      adminPassword: 'admin',
      adminEmail: identity.email || `admin@${defaultTemplateDomain}`,
    }), identity.userId, `operational:${connectionId}`);
    const now = new Date().toISOString();
    const statements = [
      db.prepare(`UPDATE hosting_connections SET operational_auth_type = 'cpanel_basic',
        encrypted_operational_secret = ?, operational_secret_iv = ?,
        operational_credential_status = 'verified', default_template_domain = ?,
        mode = 'managed_write', status = 'connected_managed', write_actions_enabled = 1,
        destructive_actions_enabled = 1, confirmation_policy = 'soft_lock+clear_confirmation', updated_at = ?
        WHERE id = ? AND owner_user_id = ?`)
        .bind(encrypted.encrypted, encrypted.iv, defaultTemplateDomain, now, connectionId, identity.userId),
      db.prepare(`INSERT INTO hosting_audit_events (id, owner_user_id, connection_id, action, target,
        outcome, details_json, created_at) VALUES (?, ?, ?, 'wordpress.management_activated', ?, 'success', ?, ?)`) 
        .bind(crypto.randomUUID(), identity.userId, connectionId, defaultTemplateDomain,
          JSON.stringify({ installationCount: installations.length, verification: 'read_only_list' }), now),
    ];
    for (const installation of installations) {
      statements.push(db.prepare(`UPDATE hosting_domains SET wordpress_installation_id = COALESCE(?, wordpress_installation_id),
        wordpress_site_name = COALESCE(?, wordpress_site_name), wordpress_url = COALESCE(?, wordpress_url),
        wordpress_version = COALESCE(?, wordpress_version), wordpress_status = 'installed',
        wordpress_source = 'Softaculous WordPress Management'
        WHERE connection_id = ? AND owner_user_id = ? AND domain = ?`)
        .bind(installation.id, installation.siteName, installation.url, installation.version,
          connectionId, identity.userId, installation.domain));
    }
    await db.batch(statements);
    return json({
      verified: true,
      installationCount: installations.length,
      message: `WordPress Management is active for ${String(connection.name)}. Softaculous reported ${installations.length} installation${installations.length === 1 ? '' : 's'} and ${defaultTemplateDomain} is the default template source.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WordPress Management could not be activated.';
    return json({ error: message }, 400);
  }
}
