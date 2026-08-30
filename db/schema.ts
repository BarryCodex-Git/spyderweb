import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const hostingConnections = sqliteTable(
  'hosting_connections',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    ownerEmail: text('owner_email'),
    provider: text('provider').notNull(),
    name: text('name').notNull(),
    baseUrl: text('base_url').notNull(),
    username: text('username').notNull(),
    primaryDomain: text('primary_domain').notNull(),
    status: text('status').notNull().default('connected_read_only'),
    mode: text('mode').notNull().default('read_only'),
    credentialStorage: text('credential_storage').notNull().default('encrypted_cloud'),
    encryptedToken: text('encrypted_token').notNull(),
    encryptionIv: text('encryption_iv').notNull(),
    credentialVersion: integer('credential_version').notNull().default(1),
    operationalAuthType: text('operational_auth_type'),
    encryptedOperationalSecret: text('encrypted_operational_secret'),
    operationalSecretIv: text('operational_secret_iv'),
    operationalCredentialStatus: text('operational_credential_status').notNull().default('not_configured'),
    defaultTemplateDomain: text('default_template_domain'),
    capabilitiesJson: text('capabilities_json').notNull().default('{}'),
    writeActionsEnabled: integer('write_actions_enabled').notNull().default(0),
    destructiveActionsEnabled: integer('destructive_actions_enabled').notNull().default(0),
    confirmationPolicy: text('confirmation_policy')
      .notNull()
      .default('owner_code+exact_domain+backup'),
    lastSyncAt: text('last_sync_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_hosting_connections_owner_account').on(
      table.ownerUserId,
      table.provider,
      table.baseUrl,
      table.username,
    ),
  ],
);

export const hostingDomains = sqliteTable(
  'hosting_domains',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => hostingConnections.id, { onDelete: 'cascade' }),
    ownerUserId: text('owner_user_id').notNull(),
    domain: text('domain').notNull(),
    domainType: text('domain_type').notNull(),
    documentRoot: text('document_root'),
    phpVersion: text('php_version'),
    wordpressStatus: text('wordpress_status').notNull().default('not_checked'),
    wordpressVersion: text('wordpress_version'),
    wordpressSiteName: text('wordpress_site_name'),
    wordpressUrl: text('wordpress_url'),
    wordpressInstallationId: text('wordpress_installation_id'),
    wordpressSource: text('wordpress_source'),
    workflowStatusOverride: text('workflow_status_override'),
    assignedDeveloper: text('assigned_developer'),
    wordpressSoftLocked: integer('wordpress_soft_locked').notNull().default(1),
    restorePointAt: text('restore_point_at'),
    phpProfileStatus: text('php_profile_status').notNull().default('not_checked'),
    sslStatus: text('ssl_status').notNull().default('not_checked'),
    active: integer('active').notNull().default(1),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_hosting_domains_connection_domain').on(
      table.connectionId,
      table.domain,
    ),
    index('idx_hosting_domains_owner_active').on(table.ownerUserId, table.active),
  ],
);

export const ownerSecurity = sqliteTable('owner_security', {
  ownerUserId: text('owner_user_id').primaryKey(),
  encryptedTotpSecret: text('encrypted_totp_secret'),
  totpSecretIv: text('totp_secret_iv'),
  totpEnabled: integer('totp_enabled').notNull().default(0),
  pendingCreatedAt: text('pending_created_at'),
  lastAcceptedCounter: integer('last_accepted_counter'),
  updatedAt: text('updated_at').notNull(),
});

export const hostingAuditEvents = sqliteTable(
  'hosting_audit_events',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    connectionId: text('connection_id'),
    action: text('action').notNull(),
    target: text('target'),
    outcome: text('outcome').notNull(),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_hosting_audit_owner_created').on(table.ownerUserId, table.createdAt)],
);
