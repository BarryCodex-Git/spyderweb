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
    operational_auth_type TEXT,
    encrypted_operational_secret TEXT,
    operational_secret_iv TEXT,
    operational_credential_status TEXT NOT NULL DEFAULT 'not_configured',
    default_template_domain TEXT,
    capabilities_json TEXT NOT NULL DEFAULT '{}',
    write_actions_enabled INTEGER NOT NULL DEFAULT 0,
    destructive_actions_enabled INTEGER NOT NULL DEFAULT 0,
    confirmation_policy TEXT NOT NULL DEFAULT 'soft_lock+clear_confirmation',
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
    wordpress_version TEXT,
    wordpress_site_name TEXT,
    wordpress_url TEXT,
    wordpress_installation_id TEXT,
    wordpress_source TEXT,
    workflow_status_override TEXT,
    assigned_developer TEXT,
    wordpress_soft_locked INTEGER NOT NULL DEFAULT 1,
    restore_point_at TEXT,
    php_profile_status TEXT NOT NULL DEFAULT 'not_checked',
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
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    owner_user_id TEXT NOT NULL,
    domain_id TEXT REFERENCES hosting_domains(id) ON DELETE SET NULL,
    domain TEXT NOT NULL,
    client_name TEXT NOT NULL,
    build_type TEXT NOT NULL,
    assigned_developer TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'Setup',
    stage_status TEXT NOT NULL DEFAULT 'not_started',
    progress INTEGER NOT NULL DEFAULT 0,
    target_date TEXT,
    next_action TEXT NOT NULL DEFAULT 'Complete setup and pre-flight check',
    intake_notes TEXT,
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    last_reported_by TEXT NOT NULL DEFAULT 'Owner Account',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
    ON projects (owner_user_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_owner_domain
    ON projects (owner_user_id, domain)`,
  `CREATE TABLE IF NOT EXISTS project_events (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    owner_user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Owner Account',
    stage TEXT,
    stage_status TEXT,
    note TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_project_events_project_created
    ON project_events (project_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_project_events_owner_created
    ON project_events (owner_user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS owner_security (
    owner_user_id TEXT PRIMARY KEY NOT NULL,
    encrypted_totp_secret TEXT,
    totp_secret_iv TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    pending_created_at TEXT,
    last_accepted_counter INTEGER,
    updated_at TEXT NOT NULL
  )`,
];

const hostingDomainColumnMigrations = [
  ['wordpress_version', 'ALTER TABLE hosting_domains ADD COLUMN wordpress_version TEXT'],
  ['wordpress_site_name', 'ALTER TABLE hosting_domains ADD COLUMN wordpress_site_name TEXT'],
  ['wordpress_url', 'ALTER TABLE hosting_domains ADD COLUMN wordpress_url TEXT'],
  ['wordpress_installation_id', 'ALTER TABLE hosting_domains ADD COLUMN wordpress_installation_id TEXT'],
  ['wordpress_source', 'ALTER TABLE hosting_domains ADD COLUMN wordpress_source TEXT'],
  ['workflow_status_override', 'ALTER TABLE hosting_domains ADD COLUMN workflow_status_override TEXT'],
  ['assigned_developer', 'ALTER TABLE hosting_domains ADD COLUMN assigned_developer TEXT'],
  ['wordpress_soft_locked', 'ALTER TABLE hosting_domains ADD COLUMN wordpress_soft_locked INTEGER NOT NULL DEFAULT 1'],
  ['restore_point_at', 'ALTER TABLE hosting_domains ADD COLUMN restore_point_at TEXT'],
  ['php_profile_status', "ALTER TABLE hosting_domains ADD COLUMN php_profile_status TEXT NOT NULL DEFAULT 'not_checked'"],
] as const;

const hostingConnectionColumnMigrations = [
  ['operational_auth_type', 'ALTER TABLE hosting_connections ADD COLUMN operational_auth_type TEXT'],
  ['encrypted_operational_secret', 'ALTER TABLE hosting_connections ADD COLUMN encrypted_operational_secret TEXT'],
  ['operational_secret_iv', 'ALTER TABLE hosting_connections ADD COLUMN operational_secret_iv TEXT'],
  ['operational_credential_status', "ALTER TABLE hosting_connections ADD COLUMN operational_credential_status TEXT NOT NULL DEFAULT 'not_configured'"],
  ['default_template_domain', 'ALTER TABLE hosting_connections ADD COLUMN default_template_domain TEXT'],
] as const;

export async function ensureHostingSchema(db = getDatabase()) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  const columns = await db.prepare("PRAGMA table_info('hosting_domains')").all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  for (const [name, statement] of hostingDomainColumnMigrations) {
    if (!existing.has(name)) await db.prepare(statement).run();
  }
  const connectionColumns = await db.prepare("PRAGMA table_info('hosting_connections')").all<{ name: string }>();
  const existingConnectionColumns = new Set(connectionColumns.results.map((column) => column.name));
  for (const [name, statement] of hostingConnectionColumnMigrations) {
    if (!existingConnectionColumns.has(name)) await db.prepare(statement).run();
  }
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
