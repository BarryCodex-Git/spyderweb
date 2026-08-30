import { applyRecommendedPhpProfile } from '@/lib/cpanel';
import { decryptHostingToken, decryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema } from '@/lib/hosting-db';
import {
  loadDomainActionRecord, requireOperationalAccess,
  requireUnlocked,
} from '@/lib/operational-security';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import { listSoftaculousInstallations, softaculousAction, type OperationalCredential } from '@/lib/softaculous';

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

async function refreshDomainWordPress(
  db: D1Database,
  input: {
    ownerUserId: string;
    domainId: string;
    domain: string;
    baseUrl: string;
    credential: OperationalCredential;
    expected: 'installed' | 'template' | 'removed';
  },
) {
  const installations = await listSoftaculousInstallations(input.baseUrl, input.credential);
  const installation = installations.find((item) => item.domain === input.domain);
  if (installation) {
    await db.prepare(`UPDATE hosting_domains SET wordpress_status = 'installed', wordpress_version = ?,
      wordpress_site_name = ?, wordpress_url = ?, wordpress_installation_id = ?,
      wordpress_source = 'Softaculous live verification', restore_point_at = NULL,
      workflow_status_override = COALESCE(?, workflow_status_override) WHERE id = ? AND owner_user_id = ?`)
      .bind(
        installation.version,
        installation.siteName,
        installation.url || `https://${input.domain}`,
        installation.id,
        input.expected === 'template' ? 'Template Loaded' : input.expected === 'installed' ? 'Available' : null,
        input.domainId,
        input.ownerUserId,
      ).run();
    return { installation, verified: input.expected !== 'removed' };
  }

  await db.prepare(`UPDATE hosting_domains SET wordpress_status = ?, wordpress_version = NULL,
    wordpress_site_name = NULL, wordpress_url = NULL, wordpress_installation_id = NULL,
    wordpress_source = ?, restore_point_at = NULL, workflow_status_override = ?
    WHERE id = ? AND owner_user_id = ?`)
    .bind(
      input.expected === 'removed' ? 'not_installed' : 'not_checked',
      input.expected === 'removed' ? 'Softaculous live verification' : 'Softaculous action pending verification',
      input.expected === 'removed' ? 'Available' : null,
      input.domainId,
      input.ownerUserId,
    ).run();
  return { installation: null, verified: input.expected === 'removed' };
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
  let verificationWarning = '';
  let replacementRemoved = false;
  let replacementSiteName = '';
  try {
    const body = await request.json() as Record<string, unknown>;
    action = String(body.action || '');
    record = await loadDomainActionRecord(db, identity.userId, domainId);
    const connection = await db.prepare(`SELECT base_url AS baseUrl, username, encrypted_token AS encryptedToken,
      encryption_iv AS encryptionIv, encrypted_operational_secret AS encryptedOperationalSecret,
      operational_secret_iv AS operationalSecretIv, default_template_domain AS defaultTemplateDomain
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(record.connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection) throw new Error('The hosting connection for this domain was not found.');
    if (action === 'apply_php_profile') {
      const cpanelToken = await decryptHostingToken(String(connection.encryptedToken), String(connection.encryptionIv), identity.userId, record.connectionId);
      await applyRecommendedPhpProfile({ baseUrl: String(connection.baseUrl), username: String(connection.username), token: cpanelToken, domain: record.domain });
      await db.prepare(`UPDATE hosting_domains SET php_profile_status = 'recommended_applied' WHERE id = ? AND owner_user_id = ?`)
        .bind(record.id, identity.userId).run();
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: 'wordpress.apply_php_profile', target: record.domain, outcome: 'success' });
      return json({ message: `The recommended 512 MB PHP profile was applied to ${record.domain}.`, warning: false });
    }

    requireOperationalAccess(record);
    const secrets = connection.encryptedOperationalSecret && connection.operationalSecretIv
      ? JSON.parse(await decryptSecret(String(connection.encryptedOperationalSecret), String(connection.operationalSecretIv), identity.userId, `operational:${record.connectionId}`)) as OperationalCredential & { adminUsername?: string; adminPassword?: string; adminEmail?: string }
      : {
          username: String(connection.username),
          token: await decryptHostingToken(String(connection.encryptedToken), String(connection.encryptionIv), identity.userId, record.connectionId),
          authMode: 'cpanel_token' as const,
          adminUsername: 'admin', adminPassword: 'admin', adminEmail: identity.email || `admin@${record.domain}`,
        };
    const baseUrl = String(connection.baseUrl);
    const replacementConfirmed = body.confirmReplacement === true;

    async function prepareCleanDestination(operationLabel: string) {
      if (!record) throw new Error('This development domain was not found.');
      const installations = await listSoftaculousInstallations(baseUrl, secrets);
      const existing = installations.find((item) => item.domain === record?.domain);
      if (!existing) {
        if (record.wordpressStatus === 'installed') {
          throw new Error(`SpyderWeb and Softaculous disagree about the installation on ${record.domain}. Scan the hosting account again before ${operationLabel}.`);
        }
        return null;
      }

      requireUnlocked(record);
      const siteName = existing.siteName || existing.domain;
      replacementSiteName = siteName;
      if (!replacementConfirmed) {
        throw new Error(`Confirmation required: this will delete “${siteName}” from ${record.domain} before ${operationLabel}. Open the action again and confirm the replacement.`);
      }
      if (!existing.id) {
        throw new Error(`Softaculous detected “${siteName}” on ${record.domain} but did not provide an installation ID. Scan the hosting account again before replacing it.`);
      }

      await softaculousAction({ baseUrl, credential: secrets, action: 'remove', domain: record.domain, installationId: existing.id });
      for (const delay of [0, 800, 1600]) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        const remaining = await listSoftaculousInstallations(baseUrl, secrets);
        if (!remaining.some((item) => item.domain === record?.domain)) {
          replacementRemoved = true;
          await audit(db, {
            ownerUserId: identity!.userId,
            connectionId: record.connectionId,
            action: 'wordpress.clean_destination',
            target: record.domain,
            outcome: 'success',
            details: { removedSiteName: siteName, nextAction: action },
          });
          return existing;
        }
      }
      throw new Error(`Softaculous still reports “${siteName}” on ${record.domain}. The new installation was not started.`);
    }

    if (action === 'create_restore_point') {
      if (record.wordpressStatus !== 'installed' || !record.wordpressInstallationId) throw new Error('Softaculous must identify this WordPress installation before it can create a restore point. Scan the connection in Settings.');
      await softaculousAction({ baseUrl, credential: secrets, action: 'backup', domain: record.domain, installationId: record.wordpressInstallationId });
      const now = new Date().toISOString();
      await db.prepare(`UPDATE hosting_domains SET restore_point_at = ? WHERE id = ? AND owner_user_id = ?`)
        .bind(now, record.id, identity.userId).run();
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: 'wordpress.restore_point_created', target: record.domain, outcome: 'success' });
      return json({ message: `An optional Softaculous backup was created for ${record.domain}.` });
    }

    if (action === 'delete') {
      requireUnlocked(record);
      if (record.wordpressStatus !== 'installed' || !record.wordpressInstallationId) throw new Error('No Softaculous-managed WordPress installation is available to delete.');
      await softaculousAction({ baseUrl, credential: secrets, action: 'remove', domain: record.domain, installationId: record.wordpressInstallationId });
      const refreshed = await refreshDomainWordPress(db, { ownerUserId: identity.userId, domainId: record.id,
        domain: record.domain, baseUrl, credential: secrets, expected: 'removed' });
      if (!refreshed.verified) verificationWarning = 'Softaculous accepted the removal but still reports the installation. SpyderWeb kept the live status unchanged; scan again before retrying.';
    } else if (action === 'install') {
      await prepareCleanDestination('installing clean WordPress');
      await softaculousAction({ baseUrl, credential: secrets, action: 'install', domain: record.domain,
        adminUsername: secrets.adminUsername, adminPassword: secrets.adminPassword, adminEmail: secrets.adminEmail });
      const refreshed = await refreshDomainWordPress(db, { ownerUserId: identity.userId, domainId: record.id,
        domain: record.domain, baseUrl, credential: secrets, expected: 'installed' });
      if (!refreshed.verified) verificationWarning = 'Softaculous accepted the installation but has not reported the new installation yet. SpyderWeb marked it for inspection; scan again shortly.';
    } else if (action === 'clone_template') {
      let templateDomain = String(connection.defaultTemplateDomain || '');
      if (!templateDomain) {
        const fallback = await db.prepare(`SELECT domain FROM hosting_domains
          WHERE connection_id = ? AND owner_user_id = ? AND active = 1 AND LOWER(domain) LIKE '%template%'
          ORDER BY CASE WHEN wordpress_status = 'installed' THEN 0 ELSE 1 END, domain LIMIT 1`)
          .bind(record.connectionId, identity.userId).first<Record<string, unknown>>();
        templateDomain = String(fallback?.domain || '');
      }
      if (!templateDomain) throw new Error('No template domain was detected on this cPanel account.');
      if (record.domain === templateDomain) throw new Error('The default template source cannot be loaded onto itself. Choose a development domain.');
      const liveInstallations = await listSoftaculousInstallations(baseUrl, secrets);
      const template = liveInstallations.find((installation) => installation.domain === templateDomain);
      if (!template?.id) throw new Error(`Softaculous did not identify the template installation on ${templateDomain}. Scan the hosting account again before loading it.`);
      await prepareCleanDestination('loading the default template');
      await softaculousAction({ baseUrl, credential: secrets, action: 'clone', domain: record.domain, sourceInstallationId: template.id });
      const refreshed = await refreshDomainWordPress(db, { ownerUserId: identity.userId, domainId: record.id,
        domain: record.domain, baseUrl, credential: secrets, expected: 'template' });
      if (!refreshed.verified) verificationWarning = 'Softaculous accepted the clone but has not reported the destination yet. SpyderWeb marked it for inspection; scan again shortly.';
    } else {
      throw new Error('Choose a valid WordPress management action.');
    }

    await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: `wordpress.${action}`, target: record.domain, outcome: 'accepted' });
    const messages: Record<string, string> = {
      delete: `WordPress removal completed for ${record.domain}, and the Softaculous inventory was checked again.`,
      install: `A clean WordPress installation completed for ${record.domain} with temporary admin/admin credentials, and the live inventory was refreshed.`,
      clone_template: `The default template clone completed for ${record.domain}, and the live inventory was refreshed.`,
    };
    return json({
      message: verificationWarning || messages[action] || 'The WordPress action was accepted.',
      warning: Boolean(verificationWarning),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : 'The WordPress action could not be completed.';
    const message = replacementRemoved
      ? `The previous WordPress website was removed, but the new ${action === 'clone_template' ? 'template clone' : 'WordPress installation'} did not complete. The destination is empty. ${cause}`
      : cause;
    if (record) await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: `wordpress.${action}`, target: record.domain, outcome: 'blocked', details: { message } }).catch(() => undefined);
    const requiresConfirmation = message.startsWith('Confirmation required:');
    return json({ error: message, requiresConfirmation, replacementSiteName: replacementSiteName || null }, requiresConfirmation ? 409 : 400);
  }
}
