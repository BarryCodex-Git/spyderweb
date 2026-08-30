import { applyRecommendedPhpProfile } from '@/lib/cpanel';
import { decryptHostingToken, decryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema } from '@/lib/hosting-db';
import {
  loadDomainActionRecord, requireExactDomain, requireOperationalAccess,
  requireRecentRestorePoint, requireUnlocked, verifyOwnerCode,
} from '@/lib/operational-security';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import { softaculousAction, type OperationalCredential } from '@/lib/softaculous';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function audit(db: D1Database, input: { ownerUserId: string; connectionId: string; action: string; target: string; outcome: string; details?: Record<string, unknown> }) {
  await db.prepare(`INSERT INTO hosting_audit_events (id, owner_user_id, connection_id, action,
    target, outcome, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), input.ownerUserId, input.connectionId, input.action, input.target,
      input.outcome, JSON.stringify(input.details || {}), new Date().toISOString()).run();
}

export async function POST(request: Request, { params }: { params: Promise<{ domainId: string }> }) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This WordPress action was blocked.' }, 403);
  const { domainId } = await params;
  if (!/^[a-f0-9]{32}$/.test(domainId)) return json({ error: 'Invalid hosting domain.' }, 400);
  const db = await ensureHostingSchema();
  let record: Awaited<ReturnType<typeof loadDomainActionRecord>> | null = null;
  let action = 'unknown';
  try {
    const body = await request.json() as Record<string, unknown>;
    action = String(body.action || '');
    record = await loadDomainActionRecord(db, identity.userId, domainId);
    requireOperationalAccess(record);
    requireExactDomain(record, body.exactDomain);
    await verifyOwnerCode(db, identity.userId, body.code);

    const connection = await db.prepare(`SELECT base_url AS baseUrl, username, encrypted_token AS encryptedToken,
      encryption_iv AS encryptionIv, encrypted_operational_secret AS encryptedOperationalSecret,
      operational_secret_iv AS operationalSecretIv, default_template_domain AS defaultTemplateDomain
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(record.connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection?.encryptedOperationalSecret || !connection.operationalSecretIv) throw new Error('Save the WordPress management credential in Settings first.');
    const secrets = JSON.parse(await decryptSecret(String(connection.encryptedOperationalSecret), String(connection.operationalSecretIv), identity.userId, `operational:${record.connectionId}`)) as OperationalCredential & { adminUsername: string; adminPassword: string; adminEmail: string };
    const baseUrl = String(connection.baseUrl);

    if (action === 'create_restore_point') {
      if (record.wordpressStatus !== 'installed' || !record.wordpressInstallationId) throw new Error('Softaculous must identify this WordPress installation before it can create a restore point. Scan the connection in Settings.');
      await softaculousAction({ baseUrl, credential: secrets, action: 'backup', domain: record.domain, installationId: record.wordpressInstallationId });
      const now = new Date().toISOString();
      await db.prepare(`UPDATE hosting_domains SET restore_point_at = ? WHERE id = ? AND owner_user_id = ?`)
        .bind(now, record.id, identity.userId).run();
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: 'wordpress.restore_point_created', target: record.domain, outcome: 'success' });
      return json({ message: `A fresh Softaculous restore point was created for ${record.domain}. It can authorise deletion for 24 hours.` });
    }

    if (action === 'delete') {
      requireUnlocked(record);
      if (record.wordpressStatus !== 'installed' || !record.wordpressInstallationId) throw new Error('No Softaculous-managed WordPress installation is available to delete.');
      requireRecentRestorePoint(record);
      await softaculousAction({ baseUrl, credential: secrets, action: 'remove', domain: record.domain, installationId: record.wordpressInstallationId });
      await db.prepare(`UPDATE hosting_domains SET wordpress_status = 'not_checked', wordpress_version = NULL,
        wordpress_site_name = NULL, wordpress_url = NULL, wordpress_installation_id = NULL,
        wordpress_source = 'Pending post-operation scan', restore_point_at = NULL,
        workflow_status_override = 'Needs Inspection' WHERE id = ? AND owner_user_id = ?`)
        .bind(record.id, identity.userId).run();
    } else if (action === 'install') {
      requireUnlocked(record);
      if (record.wordpressStatus === 'installed') throw new Error('This domain already has WordPress. Create a restore point and delete it first; SpyderWeb will not overwrite it in one step.');
      await softaculousAction({ baseUrl, credential: secrets, action: 'install', domain: record.domain,
        adminUsername: secrets.adminUsername, adminPassword: secrets.adminPassword, adminEmail: secrets.adminEmail });
      await db.prepare(`UPDATE hosting_domains SET wordpress_status = 'not_checked', wordpress_source = 'Pending post-operation scan',
        workflow_status_override = 'Needs Inspection' WHERE id = ? AND owner_user_id = ?`).bind(record.id, identity.userId).run();
    } else if (action === 'clone_template') {
      requireUnlocked(record);
      if (record.wordpressStatus === 'installed') throw new Error('This domain already has WordPress. Create a restore point and delete it first; SpyderWeb will not overwrite it in one step.');
      const templateDomain = String(connection.defaultTemplateDomain || '');
      const template = await db.prepare(`SELECT wordpress_installation_id AS installationId FROM hosting_domains
        WHERE connection_id = ? AND owner_user_id = ? AND domain = ? AND active = 1 LIMIT 1`)
        .bind(record.connectionId, identity.userId, templateDomain).first<Record<string, unknown>>();
      if (!template?.installationId) throw new Error('The default template is not identified in Softaculous. Re-verify WordPress management in Settings.');
      await softaculousAction({ baseUrl, credential: secrets, action: 'clone', domain: record.domain, sourceInstallationId: String(template.installationId) });
      await db.prepare(`UPDATE hosting_domains SET wordpress_status = 'not_checked', wordpress_source = 'Pending template verification',
        workflow_status_override = 'Needs Inspection' WHERE id = ? AND owner_user_id = ?`).bind(record.id, identity.userId).run();
    } else if (action === 'apply_php_profile') {
      const cpanelToken = await decryptHostingToken(String(connection.encryptedToken), String(connection.encryptionIv), identity.userId, record.connectionId);
      await applyRecommendedPhpProfile({ baseUrl, username: String(connection.username), token: cpanelToken, domain: record.domain });
      await db.prepare(`UPDATE hosting_domains SET php_profile_status = 'recommended_applied' WHERE id = ? AND owner_user_id = ?`)
        .bind(record.id, identity.userId).run();
    } else {
      throw new Error('Choose a valid WordPress management action.');
    }

    await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: `wordpress.${action}`, target: record.domain, outcome: 'accepted', details: { verificationRequired: true } });
    const messages: Record<string, string> = {
      delete: `Softaculous accepted the WordPress removal for ${record.domain}. Run a scan when it finishes.`,
      install: `Softaculous accepted the clean WordPress installation for ${record.domain}. No optional plugin bundle was selected.`,
      clone_template: `Softaculous accepted the default-template clone to ${record.domain}. Run a scan when it finishes.`,
      apply_php_profile: `The recommended 512 MB PHP profile was applied to ${record.domain}.`,
    };
    return json({ message: messages[action] || 'The WordPress action was accepted.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The WordPress action could not be completed.';
    if (record) await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: `wordpress.${action}`, target: record.domain, outcome: 'blocked', details: { message } }).catch(() => undefined);
    return json({ error: message }, 400);
  }
}
