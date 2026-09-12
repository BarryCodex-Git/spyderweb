import {
  ensurePhpRuntimeHandlerProfile, ensureRecommendedPhpProfile, ensureRecommendedPhpVersion, resolveCpanelDocumentRoot,
  setCloudLinuxPhpSelectorVersion,
  ensureWordPressMemoryProfile, publicWordPressInfo,
} from '@/lib/cpanel';
import { effectiveDocumentRoot } from '@/lib/cpanel-subdomain';
import { decryptHostingToken, decryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema } from '@/lib/hosting-db';
import {
  loadDomainActionRecord, requireOperationalAccess,
  requireUnlocked,
} from '@/lib/operational-security';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import {
  createCpanelSession, listSoftaculousBackups, listSoftaculousInstallations,
  softaculousManagedAction, softaculousErrorDetails, softaculousResponseWasAmbiguous,
  isSoftaculousExistingFilesError,
  type OperationalCredential, type SoftaculousBackup,
} from '@/lib/softaculous';

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

function installationBackups(backups: SoftaculousBackup[], installationId: string, domain: string) {
  return backups.filter((backup) => backup.installationId === installationId || backup.domain === domain);
}

function newestBackup(backups: SoftaculousBackup[]) {
  return [...backups].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime || right.fileName.localeCompare(left.fileName);
  })[0] ?? null;
}

function oldestBackup(backups: SoftaculousBackup[]) {
  return [...backups].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || left.fileName.localeCompare(right.fileName);
  })[0] ?? null;
}

function publicBackupSummary(backups: SoftaculousBackup[], fallbackLatest: string | null = null) {
  const latest = newestBackup(backups);
  const knownSizes = backups.map((backup) => backup.sizeBytes).filter((size): size is number => size !== null);
  return {
    count: backups.length,
    latestCreatedAt: latest?.createdAt ?? fallbackLatest,
    latestSizeBytes: latest?.sizeBytes ?? null,
    totalSizeBytes: knownSizes.length ? knownSizes.reduce((total, size) => total + size, 0) : null,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ domainId: string }> }) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  const { domainId } = await params;
  if (!/^[a-f0-9]{32}$/.test(domainId)) return json({ error: 'Invalid hosting domain.' }, 400);
  try {
    const db = await ensureHostingSchema();
    const record = await loadDomainActionRecord(db, identity.userId, domainId);
    if (record.wordpressStatus !== 'installed' || !record.wordpressInstallationId) {
      return json(publicBackupSummary([], record.restorePointAt));
    }
    requireOperationalAccess(record);
    const connection = await db.prepare(`SELECT base_url AS baseUrl,
      encrypted_operational_secret AS encryptedOperationalSecret,
      operational_secret_iv AS operationalSecretIv
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(record.connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection?.encryptedOperationalSecret || !connection.operationalSecretIv) {
      throw new Error('Activate WordPress Management for this cPanel account in Settings first.');
    }
    const credential = JSON.parse(await decryptSecret(
      String(connection.encryptedOperationalSecret), String(connection.operationalSecretIv),
      identity.userId, `operational:${record.connectionId}`,
    )) as OperationalCredential;
    const backups = installationBackups(
      await listSoftaculousBackups(String(connection.baseUrl), credential),
      record.wordpressInstallationId,
      record.domain,
    );
    return json(publicBackupSummary(backups, record.restorePointAt));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Backup information could not be loaded.' }, 400);
  }
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
  let installations: Awaited<ReturnType<typeof listSoftaculousInstallations>> = [];
  let inventoryError: unknown = null;
  try {
    installations = await listSoftaculousInstallations(input.baseUrl, input.credential);
  } catch (error) {
    inventoryError = error;
  }
  const installation = installations.find((item) => item.domain === input.domain);
  if (installation) {
    await db.prepare(`UPDATE hosting_domains SET wordpress_status = 'installed', wordpress_version = ?,
      wordpress_site_name = ?, wordpress_url = ?, wordpress_installation_id = ?,
      wordpress_source = 'Softaculous live verification', restore_point_at = NULL,
      php_profile_status = CASE WHEN php_profile_status = 'wordpress_memory_verified'
        THEN php_profile_status ELSE 'wordpress_memory_pending' END,
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

  // Softaculous can finish a clone before its installation inventory catches up.
  // Confirm the new WordPress site directly so the UI does not fall back to a
  // misleading "scan pending" state after a successful operation.
  if (input.expected !== 'removed') {
    const publicInfo = await publicWordPressInfo(input.domain);
    if (publicInfo.detected) {
      await db.prepare(`UPDATE hosting_domains SET wordpress_status = 'installed', wordpress_version = ?,
        wordpress_site_name = ?, wordpress_url = ?, wordpress_installation_id = NULL,
        wordpress_source = 'Public WordPress endpoint', restore_point_at = NULL,
        php_profile_status = CASE WHEN php_profile_status = 'wordpress_memory_verified'
          THEN php_profile_status ELSE 'wordpress_memory_pending' END,
        workflow_status_override = COALESCE(?, workflow_status_override) WHERE id = ? AND owner_user_id = ?`)
        .bind(
          publicInfo.version,
          publicInfo.siteName,
          publicInfo.url || `https://${input.domain}`,
          input.expected === 'template' ? 'Template Loaded' : 'Available',
          input.domainId,
          input.ownerUserId,
        ).run();
      return { installation: null, verified: true };
    }
  }

  // Public WordPress metadata is a safe independent verification path for an
  // install or clone. An unavailable Softaculous inventory cannot, however,
  // prove that a destructive removal finished.
  if (inventoryError && input.expected === 'removed') throw inventoryError;

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

async function verifyDomainWordPressAfterAction(
  db: D1Database,
  input: Parameters<typeof refreshDomainWordPress>[1],
) {
  let result: Awaited<ReturnType<typeof refreshDomainWordPress>> | null = null;
  for (const delay of [0, 1000, 2000, 4000, 6000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    result = await refreshDomainWordPress(db, input);
    if (result.verified) return result;
  }
  return result!;
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
  let replacementConfirmed = false;
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
      let managementCredential: OperationalCredential | null = null;
      if (connection.encryptedOperationalSecret && connection.operationalSecretIv) {
        managementCredential = JSON.parse(await decryptSecret(
          String(connection.encryptedOperationalSecret), String(connection.operationalSecretIv),
          identity.userId, `operational:${record.connectionId}`,
        )) as OperationalCredential;
      }
      const managementPassword = managementCredential?.password ?? null;
      const storedDocumentRoot = effectiveDocumentRoot(record);
      const session = managementCredential?.password
        ? await createCpanelSession(String(connection.baseUrl), managementCredential).catch(() => null)
        : null;
      let phpVersionResult: Awaited<ReturnType<typeof ensureRecommendedPhpVersion>>;
      let selectorMode: 'cloudlinux' | 'multiphp' = 'cloudlinux';
      try {
        await setCloudLinuxPhpSelectorVersion({
          baseUrl: String(connection.baseUrl), username: String(connection.username), token: cpanelToken,
          version: '8.3',
        });
        phpVersionResult = {
          status: 'updated', version: 'alt-php83', label: 'PHP 8.3', previousVersion: null,
          method: 'cloudlinux_php_selector',
        };
      } catch {
        selectorMode = 'multiphp';
        phpVersionResult = await ensureRecommendedPhpVersion({
          baseUrl: String(connection.baseUrl), username: String(connection.username), token: cpanelToken,
          domain: record.domain, password: managementPassword, session,
        });
      }
      const documentRoot = await resolveCpanelDocumentRoot(
        String(connection.baseUrl), String(connection.username), cpanelToken, record.domain,
      ) ?? storedDocumentRoot;
      if (!documentRoot) throw new Error(`The document root for ${record.domain} could not be determined safely.`);
      const phpHandlerResult = selectorMode === 'multiphp'
        ? await ensurePhpRuntimeHandlerProfile({
          baseUrl: String(connection.baseUrl), username: String(connection.username), token: cpanelToken,
          domain: record.domain, documentRoot, phpPackage: phpVersionResult.version,
          password: managementPassword, session,
        })
        : { status: 'already_correct' as const, previousPackages: [] as string[], backupFile: null };
      const phpResult = await ensureRecommendedPhpProfile({
        baseUrl: String(connection.baseUrl), username: String(connection.username), token: cpanelToken,
        domain: record.domain, documentRoot, password: managementPassword, session,
      });
      let wordpressResult: Awaited<ReturnType<typeof ensureWordPressMemoryProfile>> | null = null;
      if (record.wordpressStatus === 'installed') {
        if (!documentRoot) throw new Error(`The document root for ${record.domain} could not be determined safely.`);
        wordpressResult = await ensureWordPressMemoryProfile({
          baseUrl: String(connection.baseUrl), username: String(connection.username), token: cpanelToken,
          domain: record.domain, documentRoot, password: managementPassword, session,
          siteUrl: `https://${record.domain}`,
        });
      }
      await db.prepare(`UPDATE hosting_domains SET php_profile_status = ?, php_version = ?,
        document_root = COALESCE(document_root, ?) WHERE id = ? AND owner_user_id = ?`)
        .bind(wordpressResult ? 'wordpress_memory_verified' : 'recommended_applied', phpVersionResult.version,
          documentRoot, record.id, identity.userId).run();
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: 'wordpress.apply_php_profile', target: record.domain, outcome: 'success', details: {
        phpStatus: phpResult.status,
        phpRuntimeStatus: phpVersionResult.status,
        phpRuntimePrevious: phpVersionResult.previousVersion,
        phpRuntimeVersion: phpVersionResult.version,
        phpRuntimeMethod: phpVersionResult.method,
        phpHandlerStatus: phpHandlerResult.status,
        phpHandlerPrevious: phpHandlerResult.previousPackages,
        phpHandlerRollbackCopy: phpHandlerResult.backupFile,
        wordpressStatus: wordpressResult?.status ?? 'not_installed',
        wordpressMemoryLimit: wordpressResult?.values.WP_MEMORY_LIMIT ?? null,
        wordpressMaxMemoryLimit: wordpressResult?.values.WP_MAX_MEMORY_LIMIT ?? null,
        rollbackCopy: wordpressResult?.backupFile ?? null,
      } });
      const runtimeSummary = selectorMode === 'cloudlinux'
        ? 'The CloudLinux account PHP Selector was set to PHP 8.3.'
        : phpVersionResult.status === 'already_correct'
        ? `${phpVersionResult.label} was already selected.`
        : `${phpVersionResult.label} was selected and verified.`;
      const handlerSummary = selectorMode === 'cloudlinux' ? '' : phpHandlerResult.status === 'already_correct'
        ? 'The document-root PHP handler was already aligned.'
        : `The document-root PHP handler was aligned and verified${phpHandlerResult.backupFile ? `; ${phpHandlerResult.backupFile} is the rollback copy` : ''}.`;
      const phpSummary = phpResult.status === 'already_correct' ? 'The cPanel PHP limits were already correct.' : 'The cPanel PHP limits were updated and verified.';
      const wordpressSummary = wordpressResult
        ? wordpressResult.status === 'already_correct'
          ? `WordPress was already requesting ${wordpressResult.values.WP_MEMORY_LIMIT} normally and ${wordpressResult.values.WP_MAX_MEMORY_LIMIT} for administration.`
          : `wp-config.php now requests ${wordpressResult.values.WP_MEMORY_LIMIT} normally and ${wordpressResult.values.WP_MAX_MEMORY_LIMIT} for administration; ${wordpressResult.backupFile} is the rollback copy.`
        : 'No WordPress installation is present, so there was no wp-config.php to change.';
      return json({
        message: `${runtimeSummary} ${handlerSummary} ${phpSummary} ${wordpressSummary}`.replace(/\s+/g, ' ').trim(),
        warning: false,
      });
    }

    requireOperationalAccess(record);
    if (!connection.encryptedOperationalSecret || !connection.operationalSecretIv) {
      throw new Error('Activate WordPress Management for this cPanel account in Settings first.');
    }
    const secrets = JSON.parse(await decryptSecret(String(connection.encryptedOperationalSecret), String(connection.operationalSecretIv), identity.userId, `operational:${record.connectionId}`)) as OperationalCredential & { adminUsername?: string; adminPassword?: string; adminEmail?: string };
    const baseUrl = String(connection.baseUrl);
    const cpanelUsername = String(connection.username);
    const encryptedToken = String(connection.encryptedToken);
    const encryptionIv = String(connection.encryptionIv);
    replacementConfirmed = body.confirmReplacement === true;

    async function applyPostInstallMemoryProfile() {
      if (!record) return;
      const storedDocumentRoot = effectiveDocumentRoot(record);
      const cpanelToken = await decryptHostingToken(
        encryptedToken, encryptionIv, identity!.userId, record.connectionId,
      );
      const session = await createCpanelSession(baseUrl, secrets).catch(() => null);
      let phpVersionResult: Awaited<ReturnType<typeof ensureRecommendedPhpVersion>>;
      let selectorMode: 'cloudlinux' | 'multiphp' = 'cloudlinux';
      try {
        await setCloudLinuxPhpSelectorVersion({
          baseUrl, username: cpanelUsername, token: cpanelToken, version: '8.3',
        });
        phpVersionResult = {
          status: 'updated', version: 'alt-php83', label: 'PHP 8.3', previousVersion: null,
          method: 'cloudlinux_php_selector',
        };
      } catch {
        selectorMode = 'multiphp';
        phpVersionResult = await ensureRecommendedPhpVersion({
          baseUrl, username: cpanelUsername, token: cpanelToken,
          domain: record.domain, password: secrets.password, session,
        });
      }
      const documentRoot = await resolveCpanelDocumentRoot(
        baseUrl, cpanelUsername, cpanelToken, record.domain,
      ) ?? storedDocumentRoot;
      if (!documentRoot) throw new Error(`The document root for ${record.domain} could not be determined safely.`);
      const phpHandlerResult = selectorMode === 'multiphp'
        ? await ensurePhpRuntimeHandlerProfile({
          baseUrl, username: cpanelUsername, token: cpanelToken,
          domain: record.domain, documentRoot, phpPackage: phpVersionResult.version,
          password: secrets.password, session,
        })
        : { status: 'already_correct' as const, previousPackages: [] as string[], backupFile: null };
      const phpResult = await ensureRecommendedPhpProfile({
        baseUrl, username: cpanelUsername, token: cpanelToken,
        domain: record.domain, documentRoot, password: secrets.password, session,
      });
      const wordpressResult = await ensureWordPressMemoryProfile({
        baseUrl, username: cpanelUsername, token: cpanelToken,
        domain: record.domain, documentRoot, password: secrets.password, session,
        siteUrl: `https://${record.domain}`,
      });
      await db.prepare(`UPDATE hosting_domains SET php_profile_status = 'wordpress_memory_verified', php_version = ?,
        document_root = ? WHERE id = ? AND owner_user_id = ?`)
        .bind(phpVersionResult.version, documentRoot, record.id, identity!.userId).run();
      await audit(db, {
        ownerUserId: identity!.userId,
        connectionId: record.connectionId,
        action: 'wordpress.post_install_memory',
        target: record.domain,
        outcome: 'success',
        details: {
          phpStatus: phpResult.status,
          phpRuntimeStatus: phpVersionResult.status,
          phpRuntimePrevious: phpVersionResult.previousVersion,
          phpRuntimeVersion: phpVersionResult.version,
          phpHandlerStatus: phpHandlerResult.status,
          phpHandlerPrevious: phpHandlerResult.previousPackages,
          phpHandlerRollbackCopy: phpHandlerResult.backupFile,
          wordpressStatus: wordpressResult.status,
          wordpressMemoryLimit: wordpressResult.values.WP_MEMORY_LIMIT,
          wordpressMaxMemoryLimit: wordpressResult.values.WP_MAX_MEMORY_LIMIT,
          rollbackCopy: wordpressResult.backupFile,
        },
      });
    }

    function freshDatabaseName() {
      // Softaculous requires a database for both fresh installs and clones.
      // Keep the suffix short so cPanel can safely add its account prefix.
      return `sw${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`;
    }

    async function prepareCleanDestination(operationLabel: string) {
      if (!record) throw new Error('This development domain was not found.');
      const installations = await listSoftaculousInstallations(baseUrl, secrets);
      const existing = installations.find((item) => item.domain === record?.domain);
      if (!existing) {
        if (record.wordpressStatus === 'installed') {
          requireUnlocked(record);
          replacementSiteName = `Existing files on ${record.domain}`;
          if (!replacementConfirmed) {
            throw new Error(`Confirmation required: ${record.domain} contains WordPress files that are not registered in Softaculous. Confirm replacement before ${operationLabel}.`);
          }
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

      await softaculousManagedAction({ baseUrl, credential: secrets,
        action: 'remove', domain: record.domain, installationId: existing.id });
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
      await softaculousManagedAction({ baseUrl, credential: secrets,
        action: 'backup', domain: record.domain, installationId: record.wordpressInstallationId });
      const liveBackups = installationBackups(await listSoftaculousBackups(baseUrl, secrets), record.wordpressInstallationId, record.domain);
      const now = newestBackup(liveBackups)?.createdAt ?? new Date().toISOString();
      await db.prepare(`UPDATE hosting_domains SET restore_point_at = ? WHERE id = ? AND owner_user_id = ?`)
        .bind(now, record.id, identity.userId).run();
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: 'wordpress.restore_point_created', target: record.domain, outcome: 'success' });
      return json({ message: `A new Softaculous restore point was created for ${record.domain}.`, backup: publicBackupSummary(liveBackups, now) });
    }

    if (action === 'delete_oldest_backup') {
      if (record.wordpressStatus !== 'installed' || !record.wordpressInstallationId) throw new Error('No Softaculous-managed WordPress installation is available for backup management.');
      const current = installationBackups(await listSoftaculousBackups(baseUrl, secrets), record.wordpressInstallationId, record.domain);
      const oldest = oldestBackup(current);
      if (!oldest) throw new Error(`No saved Softaculous backup was found for ${record.domain}.`);
      await softaculousManagedAction({ baseUrl, credential: secrets,
        action: 'delete_backup', domain: record.domain, backupFileName: oldest.fileName });
      const remaining = installationBackups(await listSoftaculousBackups(baseUrl, secrets), record.wordpressInstallationId, record.domain);
      if (remaining.some((backup) => backup.fileName === oldest.fileName)) {
        throw new Error('Softaculous accepted the request, but the old backup still appears in its inventory.');
      }
      const latestAt = newestBackup(remaining)?.createdAt ?? null;
      await db.prepare(`UPDATE hosting_domains SET restore_point_at = ? WHERE id = ? AND owner_user_id = ?`)
        .bind(latestAt, record.id, identity.userId).run();
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: 'wordpress.backup_deleted', target: record.domain, outcome: 'success' });
      return json({ message: `The oldest saved backup for ${record.domain} was deleted.`, backup: publicBackupSummary(remaining, latestAt) });
    }

    if (action === 'install') {
      await prepareCleanDestination('installing clean WordPress');
      let installError: unknown = null;
      try {
        await softaculousManagedAction({ baseUrl, credential: secrets,
          action: 'install', domain: record.domain, databaseName: freshDatabaseName(),
          adminUsername: secrets.adminUsername, adminPassword: secrets.adminPassword,
          adminEmail: secrets.adminEmail, overwriteExisting: replacementConfirmed });
      } catch (error) {
        if (isSoftaculousExistingFilesError(error)) throw error;
        installError = error;
      }
      const refreshed = await verifyDomainWordPressAfterAction(db, { ownerUserId: identity.userId, domainId: record.id,
        domain: record.domain, baseUrl, credential: secrets, expected: 'installed' });
      if (installError && !refreshed.verified) throw installError;
      if (installError && refreshed.verified) {
        verificationWarning = softaculousResponseWasAmbiguous(installError)
          ? 'WordPress was installed and independently verified. Softaculous returned an unclear completion page, so SpyderWeb did not repeat the install.'
          : 'WordPress was installed and independently verified after Softaculous rejected the first authentication method.';
      }
      if (!refreshed.verified) verificationWarning = 'Softaculous accepted the installation but has not reported the new installation yet. SpyderWeb marked it for inspection; scan again shortly.';
      if (refreshed.verified) {
        try {
          await applyPostInstallMemoryProfile();
        } catch (error) {
          await db.prepare(`UPDATE hosting_domains SET php_profile_status = 'failed'
            WHERE id = ? AND owner_user_id = ?`).bind(record.id, identity.userId).run();
          const detail = error instanceof Error ? error.message : 'The memory profile could not be verified.';
          verificationWarning = `${verificationWarning ? `${verificationWarning} ` : ''}WordPress is installed, but its PHP and WordPress memory profile still needs attention. ${detail}`;
        }
      }
    } else if (action === 'clone_template') {
      const requestedTemplateDomain = String(body.templateDomain || '').trim().toLowerCase();
      if (requestedTemplateDomain && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(requestedTemplateDomain)) {
        throw new Error('Choose a valid template source domain.');
      }
      let templateDomain = requestedTemplateDomain || String(connection.defaultTemplateDomain || '');
      if (requestedTemplateDomain) {
        const selectedSource = await db.prepare(`SELECT domain FROM hosting_domains
          WHERE connection_id = ? AND owner_user_id = ? AND active = 1 AND LOWER(domain) = ? LIMIT 1`)
          .bind(record.connectionId, identity.userId, requestedTemplateDomain).first<Record<string, unknown>>();
        if (!selectedSource) throw new Error('Choose a template source from this connected cPanel account.');
        templateDomain = String(selectedSource.domain);
        await db.prepare(`UPDATE hosting_connections SET default_template_domain = ?, updated_at = ?
          WHERE id = ? AND owner_user_id = ?`)
          .bind(templateDomain, new Date().toISOString(), record.connectionId, identity.userId).run();
      }
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
      let cloneError: unknown = null;
      try {
        await softaculousManagedAction({ baseUrl, credential: secrets,
          action: 'clone', domain: record.domain, sourceInstallationId: template.id,
          databaseName: freshDatabaseName(), overwriteExisting: replacementConfirmed });
      } catch (error) {
        // Some Softaculous builds complete a clone but return an empty or
        // non-JSON completion response. Never repeat the destructive request;
        // verify the destination through inventory and the public WP endpoint.
        if (!softaculousResponseWasAmbiguous(error)) throw error;
        cloneError = error;
      }
      const refreshed = await verifyDomainWordPressAfterAction(db, { ownerUserId: identity.userId, domainId: record.id,
        domain: record.domain, baseUrl, credential: secrets, expected: 'template' });
      if (cloneError && !refreshed.verified) throw cloneError;
      if (cloneError && refreshed.verified) {
        verificationWarning = 'The template was loaded and independently verified. Softaculous returned an unclear completion response, so SpyderWeb did not repeat the clone.';
      }
      if (!refreshed.verified) verificationWarning = 'Softaculous accepted the clone but the destination could not yet be verified. SpyderWeb has not reported this as completed; scan again shortly.';
      if (refreshed.verified) {
        try {
          await applyPostInstallMemoryProfile();
        } catch (error) {
          await db.prepare(`UPDATE hosting_domains SET php_profile_status = 'failed'
            WHERE id = ? AND owner_user_id = ?`).bind(record.id, identity.userId).run();
          const detail = error instanceof Error ? error.message : 'The memory profile could not be verified.';
          verificationWarning = `The template is loaded, but its PHP and WordPress memory profile still needs attention. ${detail}`;
        }
      }
    } else {
      throw new Error('Choose a valid WordPress management action.');
    }

    await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: `wordpress.${action}`, target: record.domain, outcome: 'accepted' });
    const messages: Record<string, string> = {
      install: `A clean WordPress installation completed for ${record.domain} with temporary admin/admin credentials, and the live inventory was refreshed.`,
      clone_template: `The template from ${String(body.templateDomain || connection.defaultTemplateDomain || 'the configured default')} was loaded onto ${record.domain}, and the live inventory was refreshed.`,
    };
    return json({
      message: verificationWarning || messages[action] || 'The WordPress action was accepted.',
      warning: Boolean(verificationWarning),
    });
  } catch (error) {
    const existingFilesNeedConfirmation = !replacementConfirmed && isSoftaculousExistingFilesError(error);
    if (existingFilesNeedConfirmation && record) replacementSiteName = `Existing files on ${record.domain}`;
    const cause = existingFilesNeedConfirmation
      ? `Confirmation required: ${record?.domain || 'this domain'} already contains WordPress files that are not registered in Softaculous. Confirm replacement to overwrite those files and load the selected WordPress setup.`
      : error instanceof Error ? error.message : 'The WordPress action could not be completed.';
    const message = replacementRemoved
      ? `The previous WordPress website was removed, but the new ${action === 'clone_template' ? 'template clone' : 'WordPress installation'} did not complete. The destination is empty. ${cause}`
      : cause;
    if (record) {
      if (action === 'apply_php_profile') {
        await db.prepare(`UPDATE hosting_domains SET php_profile_status = 'failed'
          WHERE id = ? AND owner_user_id = ?`).bind(record.id, identity.userId).run().catch(() => undefined);
      }
      await audit(db, { ownerUserId: identity.userId, connectionId: record.connectionId, action: `wordpress.${action}`, target: record.domain, outcome: 'blocked', details: { message, ...softaculousErrorDetails(error) } }).catch(() => undefined);
    }
    const requiresConfirmation = message.startsWith('Confirmation required:');
    return json({ error: message, requiresConfirmation, replacementSiteName: replacementSiteName || null }, requiresConfirmation ? 409 : 400);
  }
}
