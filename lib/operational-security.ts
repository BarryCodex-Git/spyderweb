type DomainActionRecord = {
  id: string;
  domain: string;
  documentRoot: string | null;
  connectionId: string;
  wordpressStatus: string;
  wordpressInstallationId: string | null;
  softLocked: boolean;
  restorePointAt: string | null;
  connectionMode: string;
  writeActionsEnabled: boolean;
  operationalCredentialStatus: string;
};

export async function loadDomainActionRecord(db: D1Database, ownerUserId: string, domainId: string) {
  const record = await db.prepare(`SELECT d.id, d.domain, d.document_root AS documentRoot,
    d.connection_id AS connectionId,
    d.wordpress_status AS wordpressStatus, d.wordpress_installation_id AS wordpressInstallationId,
    d.wordpress_soft_locked AS wordpressSoftLocked, d.restore_point_at AS restorePointAt,
    c.mode AS connectionMode, c.write_actions_enabled AS writeActionsEnabled,
    c.operational_credential_status AS operationalCredentialStatus
    FROM hosting_domains d JOIN hosting_connections c ON c.id = d.connection_id
    WHERE d.id = ? AND d.owner_user_id = ? AND d.active = 1 LIMIT 1`)
    .bind(domainId, ownerUserId).first<Record<string, unknown>>();
  if (!record) throw new Error('This development domain was not found.');
  return {
    id: String(record.id), domain: String(record.domain),
    documentRoot: record.documentRoot ? String(record.documentRoot) : null,
    connectionId: String(record.connectionId),
    wordpressStatus: String(record.wordpressStatus),
    wordpressInstallationId: record.wordpressInstallationId ? String(record.wordpressInstallationId) : null,
    softLocked: record.wordpressSoftLocked !== 0,
    restorePointAt: record.restorePointAt ? String(record.restorePointAt) : null,
    connectionMode: String(record.connectionMode),
    writeActionsEnabled: record.writeActionsEnabled === 1,
    operationalCredentialStatus: String(record.operationalCredentialStatus),
  } satisfies DomainActionRecord;
}

export function requireOperationalAccess(record: DomainActionRecord) {
  if (record.connectionMode !== 'managed_write' || !record.writeActionsEnabled) {
    throw new Error('Switch this cPanel connection to Managed access in Settings first.');
  }
  if (record.operationalCredentialStatus !== 'verified') {
    throw new Error('Activate WordPress Management for this cPanel account in Settings first.');
  }
}

export function requireUnlocked(record: DomainActionRecord) {
  if (record.softLocked) throw new Error('Unlock this domain before preparing a WordPress write action.');
}
