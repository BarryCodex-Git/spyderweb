import { decryptSecret, encryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema } from '@/lib/hosting-db';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import { generateTotpSecret, totpUri, verifyTotp } from '@/lib/totp';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  const db = await ensureHostingSchema();
  const record = await db.prepare(`SELECT totp_enabled AS enabled, pending_created_at AS pendingCreatedAt
    FROM owner_security WHERE owner_user_id = ?`).bind(identity.userId).first();
  return json({ enabled: record?.enabled === 1, enrollmentPending: Boolean(record?.pendingCreatedAt) });
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in as the SpyderWeb owner.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This security update was blocked.' }, 403);
  const body = await request.json() as Record<string, unknown>;
  const db = await ensureHostingSchema();
  const now = new Date().toISOString();

  if (body.action === 'begin') {
    const secret = generateTotpSecret();
    const encrypted = await encryptSecret(secret, identity.userId, 'owner-totp');
    await db.prepare(`INSERT INTO owner_security (
      owner_user_id, encrypted_totp_secret, totp_secret_iv, totp_enabled, pending_created_at, updated_at
    ) VALUES (?, ?, ?, 0, ?, ?)
    ON CONFLICT(owner_user_id) DO UPDATE SET encrypted_totp_secret = excluded.encrypted_totp_secret,
      totp_secret_iv = excluded.totp_secret_iv, totp_enabled = 0,
      pending_created_at = excluded.pending_created_at, last_accepted_counter = NULL,
      updated_at = excluded.updated_at`).bind(identity.userId, encrypted.encrypted, encrypted.iv, now, now).run();
    return json({ secret, uri: totpUri(secret, identity.email), message: 'Add this key to your authenticator app, then enter its six-digit code.' });
  }

  const record = await db.prepare(`SELECT encrypted_totp_secret AS encryptedSecret,
    totp_secret_iv AS secretIv, totp_enabled AS enabled, last_accepted_counter AS lastAcceptedCounter
    FROM owner_security WHERE owner_user_id = ?`).bind(identity.userId).first<Record<string, unknown>>();
  if (!record?.encryptedSecret || !record.secretIv) return json({ error: 'Start authenticator setup first.' }, 400);
  const secret = await decryptSecret(String(record.encryptedSecret), String(record.secretIv), identity.userId, 'owner-totp');
  const counter = await verifyTotp(secret, String(body.code || ''), Number(record.lastAcceptedCounter) || null);
  if (counter === null) return json({ error: 'That code is invalid or has already been used. Wait for a new code and try again.' }, 400);

  if (body.action === 'confirm') {
    await db.batch([
      db.prepare(`UPDATE owner_security SET totp_enabled = 1, pending_created_at = NULL,
        last_accepted_counter = ?, updated_at = ? WHERE owner_user_id = ?`)
        .bind(counter, now, identity.userId),
      db.prepare(`UPDATE hosting_connections SET destructive_actions_enabled = 1
        WHERE owner_user_id = ? AND mode = 'managed_write' AND operational_credential_status = 'verified'`)
        .bind(identity.userId),
    ]);
    return json({ enabled: true, message: 'Authenticator protection is active.' });
  }
  return json({ error: 'Choose a valid authenticator action.' }, 400);
}
