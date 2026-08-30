import { decryptSecret, encryptSecret } from '@/lib/credential-crypto';
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
  if (!isSameOrigin(request)) return json({ error: 'This credential update was blocked.' }, 403);
  const { connectionId } = await params;
  if (!/^[a-f0-9]{32}$/.test(connectionId)) return json({ error: 'Invalid hosting connection.' }, 400);

  try {
    const body = await request.json() as Record<string, unknown>;
    const db = await ensureHostingSchema();
    const connection = await db.prepare(`SELECT id, base_url AS baseUrl, username, mode
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection) return json({ error: 'This cPanel connection was not found.' }, 404);

    const credential = {
      username: field(body.username || connection.username, 'management username', 128),
      password: field(body.password, 'management password', 4096),
    };
    const defaultTemplateDomain = field(body.defaultTemplateDomain, 'default template domain', 253).toLowerCase();
    const templateRecord = await db.prepare(`SELECT id FROM hosting_domains WHERE connection_id = ?
      AND owner_user_id = ? AND domain = ? AND active = 1 LIMIT 1`)
      .bind(connectionId, identity.userId, defaultTemplateDomain).first();
    if (!templateRecord) throw new Error('Choose a default template domain that belongs to this connected cPanel account.');

    const installations = await listSoftaculousInstallations(String(connection.baseUrl), credential);
    const template = installations.find((installation) => installation.domain === defaultTemplateDomain);
    if (!template?.id) {
      throw new Error(`Softaculous connected, but ${defaultTemplateDomain} is not registered there as a WordPress installation. Use Softaculous Scan first, then try again.`);
    }
    const encrypted = await encryptSecret(JSON.stringify({
      ...credential,
      adminUsername: 'admin',
      adminPassword: 'admin',
      adminEmail: identity.email || '',
    }), identity.userId, `operational:${connectionId}`);
    const now = new Date().toISOString();
    const statements = [
      db.prepare(`UPDATE hosting_connections SET operational_auth_type = 'cpanel_basic',
        encrypted_operational_secret = ?, operational_secret_iv = ?,
        operational_credential_status = 'verified', default_template_domain = ?, updated_at = ?
        WHERE id = ? AND owner_user_id = ?`)
        .bind(encrypted.encrypted, encrypted.iv, defaultTemplateDomain, now, connectionId, identity.userId),
      db.prepare(`INSERT INTO hosting_audit_events (id, owner_user_id, connection_id, action, target,
        outcome, details_json, created_at) VALUES (?, ?, ?, 'cpanel.operational_credential_verified', ?,
        'success', ?, ?)`)
        .bind(crypto.randomUUID(), identity.userId, connectionId, defaultTemplateDomain,
          JSON.stringify({ installationCount: installations.length, credentialType: 'cpanel_basic' }), now),
    ];
    if (String(connection.mode) === 'managed_write') {
      statements.push(db.prepare(`UPDATE hosting_connections SET destructive_actions_enabled = 1
        WHERE id = ? AND owner_user_id = ?`).bind(connectionId, identity.userId));
    }
    for (const installation of installations) {
      statements.push(db.prepare(`UPDATE hosting_domains SET wordpress_installation_id = COALESCE(?, wordpress_installation_id),
        wordpress_site_name = COALESCE(?, wordpress_site_name), wordpress_url = COALESCE(?, wordpress_url),
        wordpress_status = 'installed', wordpress_source = 'Softaculous operational connection'
        WHERE connection_id = ? AND owner_user_id = ? AND domain = ?`)
        .bind(installation.id, installation.siteName, installation.url, connectionId, identity.userId, installation.domain));
    }
    await db.batch(statements);
    return json({
      verified: true,
      installationCount: installations.length,
      message: `WordPress management is verified. Softaculous reported ${installations.length} installation${installations.length === 1 ? '' : 's'}, and ${defaultTemplateDomain} is ready as the default clone source.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The WordPress management credential could not be verified.';
    return json({ error: message }, 400);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This credential update was blocked.' }, 403);
  const { connectionId } = await params;
  const db = await ensureHostingSchema();
  const record = await db.prepare(`SELECT encrypted_operational_secret AS encryptedSecret,
    operational_secret_iv AS secretIv FROM hosting_connections WHERE id = ? AND owner_user_id = ?`)
    .bind(connectionId, identity.userId).first<Record<string, unknown>>();
  if (!record) return json({ error: 'This cPanel connection was not found.' }, 404);
  if (record.encryptedSecret && record.secretIv) {
    await decryptSecret(String(record.encryptedSecret), String(record.secretIv), identity.userId, `operational:${connectionId}`);
  }
  await db.prepare(`UPDATE hosting_connections SET operational_auth_type = NULL,
    encrypted_operational_secret = NULL, operational_secret_iv = NULL,
    operational_credential_status = 'not_configured', updated_at = ?
    WHERE id = ? AND owner_user_id = ?`).bind(new Date().toISOString(), connectionId, identity.userId).run();
  return json({ message: 'The saved WordPress management credential was removed. Domain inventory remains connected.' });
}
