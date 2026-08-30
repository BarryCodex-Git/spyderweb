import { decryptSecret } from '@/lib/credential-crypto';
import { verifyTotp } from '@/lib/totp';

type DomainActionRecord = {
  id: string;
  domain: string;
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
  const record = await db.prepare(`SELECT d.id, d.domain, d.connection_id AS connectionId,
    d.wordpress_status AS wordpressStatus, d.wordpress_installation_id AS wordpressInstallationId,
    d.wordpress_soft_locked AS wordpressSoftLocked, d.restore_point_at AS restorePointAt,
    c.mode AS connectionMode, c.write_actions_enabled AS writeActionsEnabled,
    c.operational_credential_status AS operationalCredentialStatus
    FROM hosting_domains d JOIN hosting_connections c ON c.id = d.connection_id
    WHERE d.id = ? AND d.owner_user_id = ? AND d.active = 1 LIMIT 1`)
    .bind(domainId, ownerUserId).first<Record<string, unknown>>();
  if (!record) throw new Error('This development domain was not found.');
  return {
    id: String(record.id), domain: String(record.domain), connectionId: String(record.connectionId),
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
    throw new Error('Verify the WordPress management credential for this cPanel connection in Settings first.');
  }
}

export function requireExactDomain(record: DomainActionRecord, exactDomain: unknown) {
  if (String(exactDomain || '').trim().toLowerCase() !== record.domain.toLowerCase()) {
    throw new Error(`Enter ${record.domain} exactly to confirm this action.`);
  }
}

export function requireUnlocked(record: DomainActionRecord) {
  if (record.softLocked) throw new Error('Unlock this domain before preparing a WordPress write action.');
}

export function requireRecentRestorePoint(record: DomainActionRecord) {
  const created = record.restorePointAt ? Date.parse(record.restorePointAt) : Number.NaN;
  if (!Number.isFinite(created) || Date.now() - created > 24 * 60 * 60 * 1000) {
    throw new Error('Create a verified restore point within the last 24 hours before deleting this installation.');
  }
}

export async function verifyOwnerCode(db: D1Database, ownerUserId: string, code: unknown) {
  const security = await db.prepare(`SELECT encrypted_totp_secret AS encryptedSecret,
    totp_secret_iv AS secretIv, totp_enabled AS enabled, last_accepted_counter AS lastAcceptedCounter
    FROM owner_security WHERE owner_user_id = ?`).bind(ownerUserId).first<Record<string, unknown>>();
  if (!security || security.enabled !== 1 || !security.encryptedSecret || !security.secretIv) {
    throw new Error('Turn on authenticator protection in Settings before using protected WordPress actions.');
  }
  const secret = await decryptSecret(String(security.encryptedSecret), String(security.secretIv), ownerUserId, 'owner-totp');
  const counter = await verifyTotp(secret, String(code || ''), Number(security.lastAcceptedCounter) || null);
  if (counter === null) throw new Error('That owner code is invalid or has already been used. Wait for a new code and try again.');
  await db.prepare(`UPDATE owner_security SET last_accepted_counter = ?, updated_at = ? WHERE owner_user_id = ?`)
    .bind(counter, new Date().toISOString(), ownerUserId).run();
}
