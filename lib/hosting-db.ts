import { env } from 'cloudflare:workers';

type HostingDatabaseEnv = { DB: D1Database };

export function getDatabase() {
  return (env as unknown as HostingDatabaseEnv).DB;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS hosting_connections (
    id TEXT PRIMARY KEY NOT NULL,
    owner_user_id TEXT NOT NULL,
    owner_email TEXT,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    username TEXT NOT NULL,
    primary_domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected_read_only',
    mode TEXT NOT NULL DEFAULT 'read_only',
    credential_storage TEXT NOT NULL DEFAULT 'encrypted_cloud',
    encrypted_token TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    credential_version INTEGER NOT NULL DEFAULT 1,
    capabilities_json TEXT NOT NULL DEFAULT '{}',
    write_actions_enabled INTEGER NOT NULL DEFAULT 0,
    destructive_actions_enabled INTEGER NOT NULL DEFAULT 0,
    confirmation_policy TEXT NOT NULL DEFAULT 'owner_code+exact_domain+backup',
    last_sync_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_hosting_connections_owner_account
    ON hosting_connections (owner_user_id, provider, base_url, username)`,
  `CREATE TABLE IF NOT EXISTS hosting_domains (
    id TEXT PRIMARY KEY NOT NULL,
    connection_id TEXT NOT NULL REFERENCES hosting_connections(id) ON DELETE CASCADE,
    owner_user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    domain_type TEXT NOT NULL,
    document_root TEXT,
    php_version TEXT,
    wordpress_status TEXT NOT NULL DEFAULT 'not_checked',
    ssl_status TEXT NOT NULL DEFAULT 'not_checked',
    active INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_hosting_domains_connection_domain
    ON hosting_domains (connection_id, domain)`,
  `CREATE TABLE IF NOT EXISTS hosting_audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    owner_user_id TEXT NOT NULL,
    connection_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    outcome TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hosting_domains_owner_active
    ON hosting_domains (owner_user_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_hosting_audit_owner_created
    ON hosting_audit_events (owner_user_id, created_at)`,
];

export async function ensureHostingSchema(db = getDatabase()) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return db;
}

export async function stableId(...parts: string[]) {
  const bytes = new TextEncoder().encode(parts.join('\u001f'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
