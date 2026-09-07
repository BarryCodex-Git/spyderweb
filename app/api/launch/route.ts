import {
  createCpanelSubdomain, discoverCpanel, ensurePhpRuntimeHandlerProfile,
  ensureRecommendedPhpProfile, ensureRecommendedPhpVersion,
  ensureWordPressMemoryProfile, publicWordPressInfo, resolveCpanelDocumentRoot,
  setCloudLinuxPhpSelectorVersion,
} from '@/lib/cpanel';
import { effectiveDocumentRoot, reconcileCreatedSubdomain } from '@/lib/cpanel-subdomain';
import { decryptHostingToken, decryptSecret } from '@/lib/credential-crypto';
import { ensureHostingSchema, stableId } from '@/lib/hosting-db';
import { normalizeSubdomainLabel, rootInstallationUrl, softaculousDatabaseName } from '@/lib/launch-project';
import { parseClientIntake } from '@/lib/client-intake';
import { PROJECT_DEVELOPERS, type ProjectDeveloper } from '@/lib/project-workflow';
import { getRequestIdentity, isSameOrigin } from '@/lib/request-auth';
import {
  createCpanelSession, listSoftaculousInstallations, softaculousAction,
  type OperationalCredential,
} from '@/lib/softaculous';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function requiredText(value: unknown, label: string, max = 255) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\0]/.test(text)) throw new Error(`Enter a valid ${label}.`);
  return text;
}

async function seedTemplateSlots(db: D1Database, ownerUserId: string) {
  const existing = await db.prepare('SELECT COUNT(*) AS count FROM template_slots WHERE owner_user_id = ?')
    .bind(ownerUserId).first<{ count: number }>();
  if (Number(existing?.count || 0) >= 4) return;
  const candidates = await db.prepare(`SELECT id FROM hosting_domains
    WHERE owner_user_id = ? AND active = 1 AND wordpress_status = 'installed'
      AND (LOWER(domain) LIKE '%template%' OR LOWER(COALESCE(wordpress_site_name, '')) LIKE '%template%')
    ORDER BY domain LIMIT 4`).bind(ownerUserId).all<{ id: string }>();
  const now = new Date().toISOString();
  const writes = [];
  for (let slotNumber = 1; slotNumber <= 4; slotNumber += 1) {
    writes.push(db.prepare(`INSERT OR IGNORE INTO template_slots
      (id, owner_user_id, slot_number, name, source_domain_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), ownerUserId, slotNumber, `Template ${slotNumber}`,
        candidates.results[slotNumber - 1]?.id ?? null, now, now));
  }
  await db.batch(writes);
}

async function loadSlots(db: D1Database, ownerUserId: string) {
  await seedTemplateSlots(db, ownerUserId);
  const rows = await db.prepare(`SELECT s.id, s.slot_number AS slotNumber, s.name,
    s.source_domain_id AS sourceDomainId, d.domain AS sourceDomain,
    d.connection_id AS connectionId, d.wordpress_site_name AS siteName,
    d.wordpress_url AS previewUrl
    FROM template_slots s LEFT JOIN hosting_domains d ON d.id = s.source_domain_id
    WHERE s.owner_user_id = ? ORDER BY s.slot_number`).bind(ownerUserId).all<Record<string, unknown>>();
  return rows.results.map((row) => ({
    id: String(row.id), slotNumber: Number(row.slotNumber), name: String(row.name),
    sourceDomainId: row.sourceDomainId ? String(row.sourceDomainId) : null,
    sourceDomain: row.sourceDomain ? String(row.sourceDomain) : null,
    connectionId: row.connectionId ? String(row.connectionId) : null,
    siteName: row.siteName ? String(row.siteName) : null,
    previewUrl: row.previewUrl ? String(row.previewUrl) : row.sourceDomain ? `https://${row.sourceDomain}` : null,
  }));
}

export async function GET(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to configure project templates.' }, 401);
  try {
    const db = await ensureHostingSchema();
    return json({ templates: await loadSlots(db, identity.userId) });
  } catch {
    return json({ error: 'Template choices are temporarily unavailable.' }, 500);
  }
}

export async function PUT(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to edit project templates.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This template update was blocked.' }, 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const slotNumber = Number(body.slotNumber);
    if (![1, 2, 3, 4].includes(slotNumber)) throw new Error('Choose one of the four template spaces.');
    const name = requiredText(body.name, 'template name', 80);
    const sourceDomainId = body.sourceDomainId ? requiredText(body.sourceDomainId, 'template domain', 64) : null;
    const db = await ensureHostingSchema();
    await seedTemplateSlots(db, identity.userId);
    if (sourceDomainId) {
      const source = await db.prepare(`SELECT id FROM hosting_domains WHERE id = ? AND owner_user_id = ?
        AND active = 1 AND wordpress_status = 'installed'`).bind(sourceDomainId, identity.userId).first();
      if (!source) throw new Error('Choose a connected domain with WordPress installed.');
    }
    await db.prepare(`UPDATE template_slots SET name = ?, source_domain_id = ?, updated_at = ?
      WHERE owner_user_id = ? AND slot_number = ?`).bind(name, sourceDomainId, new Date().toISOString(), identity.userId, slotNumber).run();
    return json({ templates: await loadSlots(db, identity.userId), message: `${name} was saved.` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'The template could not be saved.' }, 400);
  }
}

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) return json({ error: 'Sign in to launch a project.' }, 401);
  if (!isSameOrigin(request)) return json({ error: 'This project launch was blocked.' }, 403);
  const db = await ensureHostingSchema();
  let connectionId = '';
  let targetDomain = '';
  try {
    const body = await request.json() as Record<string, unknown>;
    const projectName = requiredText(body.projectName, 'project name', 180);
    connectionId = requiredText(body.connectionId, 'cPanel account', 64);
    const targetMode = body.targetMode === 'existing' ? 'existing' : 'new';
    const keepExistingTemplate = targetMode === 'existing' && body.templateDecision === 'keep';
    const existingDomainId = targetMode === 'existing' ? requiredText(body.existingDomainId, 'existing domain', 64) : '';
    const parentDomain = targetMode === 'new' ? requiredText(body.parentDomain, 'parent domain', 253).toLowerCase() : '';
    const subdomainLabel = targetMode === 'new' ? normalizeSubdomainLabel(requiredText(body.subdomainLabel, 'subdomain name', 63)) : '';
    if (targetMode === 'new') targetDomain = `${subdomainLabel}.${parentDomain}`;
    const templateSlotNumber = Number(body.templateSlotNumber);
    const developer = requiredText(body.developer, 'developer', 80) as ProjectDeveloper;
    if (!PROJECT_DEVELOPERS.includes(developer)) throw new Error('Choose a valid developer.');
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : '';
    let intakeSource: unknown = {};
    if (typeof body.intakeJson === 'string' && body.intakeJson) {
      try { intakeSource = JSON.parse(body.intakeJson); } catch { throw new Error('The submitted project details could not be read.'); }
    }
    const intake = parseClientIntake(intakeSource, projectName);

    const connection = await db.prepare(`SELECT id, base_url AS baseUrl, username, encrypted_token AS encryptedToken,
      encryption_iv AS encryptionIv, encrypted_operational_secret AS encryptedOperationalSecret,
      operational_secret_iv AS operationalSecretIv, mode, operational_credential_status AS operationalStatus
      FROM hosting_connections WHERE id = ? AND owner_user_id = ? LIMIT 1`)
      .bind(connectionId, identity.userId).first<Record<string, unknown>>();
    if (!connection) throw new Error('Choose a connected cPanel account.');
    if (!keepExistingTemplate && (connection.mode !== 'managed_write' || connection.operationalStatus !== 'verified')) {
      throw new Error('WordPress Management must be active for the selected cPanel account.');
    }
    let existingDomain: Record<string, unknown> | null = null;
    if (targetMode === 'existing') {
      existingDomain = await db.prepare(`SELECT id, domain, domain_type AS domainType,
        document_root AS documentRoot, php_version AS phpVersion,
        wordpress_status AS wordpressStatus, wordpress_version AS wordpressVersion,
        wordpress_site_name AS wordpressSiteName, wordpress_url AS wordpressUrl,
        wordpress_installation_id AS wordpressInstallationId,
        workflow_status_override AS workflowStatusOverride, wordpress_soft_locked AS softLocked
        FROM hosting_domains WHERE id = ? AND connection_id = ? AND owner_user_id = ? AND active = 1 LIMIT 1`)
        .bind(existingDomainId, connectionId, identity.userId).first<Record<string, unknown>>();
      if (!existingDomain) throw new Error('Choose an existing domain from this cPanel account.');
      targetDomain = String(existingDomain.domain).toLowerCase();
      const masterTemplate = await db.prepare(`SELECT id FROM template_slots
        WHERE owner_user_id = ? AND source_domain_id = ? LIMIT 1`)
        .bind(identity.userId, existingDomainId).first();
      if (masterTemplate) throw new Error('A master template domain cannot be used as a project destination.');
      const templateDetected = String(existingDomain.wordpressStatus) === 'installed'
        && (existingDomain.workflowStatusOverride === 'Template Loaded'
          || /(\btemplate\b|\bnew\s+(?:client\s+)?build\b)/i.test(`${targetDomain} ${String(existingDomain.wordpressSiteName || '')}`));
      const available = existingDomain.workflowStatusOverride === 'Available'
        || String(existingDomain.wordpressStatus) === 'not_installed';
      if (!available && !templateDetected) throw new Error('Choose a domain marked Available or Template Loaded on the Dashboard.');
      if (keepExistingTemplate && !templateDetected) throw new Error('Only a Template Loaded domain can keep its current template.');
    } else {
      const parent = await db.prepare(`SELECT id, domain_type AS domainType FROM hosting_domains
        WHERE connection_id = ? AND owner_user_id = ? AND domain = ? AND active = 1`)
        .bind(connectionId, identity.userId, parentDomain).first<Record<string, unknown>>();
      if (!parent || !['main', 'addon'].includes(String(parent.domainType))) {
        throw new Error('Choose a main or add-on domain from this cPanel account.');
      }
      const collision = await db.prepare(`SELECT id FROM hosting_domains WHERE owner_user_id = ? AND domain = ? AND active = 1`)
        .bind(identity.userId, targetDomain).first();
      if (collision) throw new Error(`${targetDomain} already exists. Nothing was changed.`);
    }
    let template: Record<string, unknown> | null = null;
    if (!keepExistingTemplate) {
      if (![1, 2, 3, 4].includes(templateSlotNumber)) throw new Error('Choose a template.');
      template = await db.prepare(`SELECT s.name, d.id AS domainId, d.domain,
        d.connection_id AS connectionId, d.wordpress_installation_id AS installationId
        FROM template_slots s JOIN hosting_domains d ON d.id = s.source_domain_id
        WHERE s.owner_user_id = ? AND s.slot_number = ? AND d.wordpress_status = 'installed'`)
        .bind(identity.userId, templateSlotNumber).first<Record<string, unknown>>();
      if (!template) throw new Error('The selected template does not have a verified WordPress installation.');
      if (String(template.connectionId) !== connectionId) {
        throw new Error('Choose a template hosted in the same cPanel account as the destination domain.');
      }
      if (String(template.domain).toLowerCase() === targetDomain) throw new Error('The template source cannot be used as its own destination.');
    }

    let token = '';
    let credential: OperationalCredential | null = null;
    let sourceInstallationId = '';
    if (!keepExistingTemplate) {
      token = await decryptHostingToken(String(connection.encryptedToken), String(connection.encryptionIv), identity.userId, connectionId);
      credential = JSON.parse(await decryptSecret(
        String(connection.encryptedOperationalSecret), String(connection.operationalSecretIv),
        identity.userId, `operational:${connectionId}`,
      )) as OperationalCredential;
      const installations = await listSoftaculousInstallations(String(connection.baseUrl), credential);
      const destination = installations.find((item) => item.domain === targetDomain);
      if (targetMode === 'new' && destination) throw new Error(`${targetDomain} already has a Softaculous installation. Nothing was changed.`);
      const source = installations.find((item) => item.domain === String(template!.domain));
      if (!source?.id) throw new Error('Softaculous could not find the selected template installation.');
      sourceInstallationId = source.id;

      if (destination) {
        if (Number(existingDomain?.softLocked || 0) === 1) throw new Error(`${targetDomain} is soft locked. Unlock it in Domains before replacing WordPress.`);
        if (body.confirmExistingOverwrite !== true && body.confirmExistingOverwrite !== 'true') {
          throw new Error(`Confirm that SpyderWeb may delete “${destination.siteName || targetDomain}” before loading the selected template.`);
        }
        if (!destination.id) throw new Error(`Softaculous did not provide an installation ID for ${targetDomain}. Scan cPanel before retrying.`);
        await softaculousAction({ baseUrl: String(connection.baseUrl), credential, action: 'remove', domain: targetDomain, installationId: destination.id });
        let removed = false;
        for (const delay of [0, 800, 1600]) {
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          const remaining = await listSoftaculousInstallations(String(connection.baseUrl), credential);
          if (!remaining.some((item) => item.domain === targetDomain)) { removed = true; break; }
        }
        if (!removed) throw new Error(`Softaculous still reports the old WordPress installation on ${targetDomain}. The template was not loaded.`);
      }
    }

    let created: Awaited<ReturnType<typeof discoverCpanel>>['domains'][number] | null = null;
    if (targetMode === 'new') {
      let creationError: unknown = null;
      try {
        await createCpanelSubdomain({ baseUrl: String(connection.baseUrl), username: String(connection.username), token,
          label: subdomainLabel, parentDomain });
      } catch (error) {
        creationError = error;
      }
      const discovered = await discoverCpanel({ baseUrl: String(connection.baseUrl), username: String(connection.username), token });
      created = reconcileCreatedSubdomain(discovered.domains, targetDomain, creationError);
      if (!created) throw new Error(`cPanel accepted the request, but ${targetDomain} could not yet be verified. Rescan cPanel before retrying.`);
    }

    const now = new Date().toISOString();
    const domainId = targetMode === 'existing' ? String(existingDomain!.id) : await stableId(connectionId, targetDomain);
    const existingProject = await db.prepare(`SELECT id FROM projects WHERE owner_user_id = ? AND domain_id = ?
      AND lifecycle_status != 'archived' LIMIT 1`).bind(identity.userId, domainId).first<{ id: string }>();
    const projectId = existingProject?.id ?? crypto.randomUUID();
    const nextOrder = await db.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM projects WHERE owner_user_id = ?`)
      .bind(identity.userId).first<{ nextOrder: number }>();
    const setupWrites: D1PreparedStatement[] = [];
    if (targetMode === 'new') setupWrites.push(db.prepare(`INSERT INTO hosting_domains (id, connection_id, owner_user_id, domain, domain_type,
        document_root, php_version, wordpress_status, wordpress_source, workflow_status_override,
        assigned_developer, wordpress_soft_locked, php_profile_status, ssl_status, active, last_seen_at)
        VALUES (?, ?, ?, ?, 'subdomain', ?, ?, 'not_installed', 'New cPanel subdomain', 'Needs Inspection',
        ?, 1, 'not_checked', 'not_checked', 1, ?)`)
        .bind(domainId, connectionId, identity.userId, targetDomain, effectiveDocumentRoot(created!), created!.phpVersion, developer, now));
    const projectWrite = existingProject
      ? db.prepare(`UPDATE projects SET client_name = ?, build_type = 'Template', assigned_developer = ?,
          current_stage = 'Setup', stage_status = 'in_progress', progress = 4,
          next_action = 'Review the loaded template and begin the home page', intake_notes = ?, intake_json = ?,
          lifecycle_status = 'active', last_reported_by = 'Owner Account', created_at = ?, updated_at = ?
          WHERE id = ? AND owner_user_id = ?`)
        .bind(projectName, developer, notes || null, JSON.stringify(intake), now, now, projectId, identity.userId)
      : db.prepare(`INSERT INTO projects (id, owner_user_id, domain_id, domain, client_name, build_type,
        assigned_developer, current_stage, stage_status, progress, next_action, intake_notes, intake_json,
        lifecycle_status, last_reported_by, created_at, updated_at, sort_order)
        VALUES (?, ?, ?, ?, ?, 'Template', ?, 'Setup', 'in_progress', 4,
        'Review the loaded template and begin the home page', ?, ?, 'active', 'Owner Account', ?, ?, ?)`)
        .bind(projectId, identity.userId, domainId, targetDomain, projectName, developer, notes || null,
          JSON.stringify(intake), now, now, Number(nextOrder?.nextOrder || 1));
    setupWrites.push(projectWrite);
    await db.batch(setupWrites);

    let installationId = keepExistingTemplate ? String(existingDomain?.wordpressInstallationId || '') : '';
    let verifiedUrl = keepExistingTemplate ? String(existingDomain?.wordpressUrl || `https://${targetDomain}`) : '';
    let siteName = keepExistingTemplate ? String(existingDomain?.wordpressSiteName || 'Template loaded') : String(template!.name);
    let version = keepExistingTemplate ? String(existingDomain?.wordpressVersion || '') : '';
    let phpRuntimeVersion = keepExistingTemplate ? String(existingDomain?.phpVersion || '') : '';
    let memoryProfileStatus = keepExistingTemplate ? 'wordpress_memory_pending' : 'not_checked';
    let memoryWarning = '';
    let cpanelSession: Awaited<ReturnType<typeof createCpanelSession>> | null = null;
    let verifiedDocumentRoot = keepExistingTemplate
      ? effectiveDocumentRoot({
          domain: targetDomain,
          domainType: String(existingDomain?.domainType || 'subdomain'),
          documentRoot: existingDomain?.documentRoot ? String(existingDomain.documentRoot) : null,
        })
      : null;
    if (!keepExistingTemplate) {
      await softaculousAction({ baseUrl: String(connection.baseUrl), credential: credential!, action: 'clone', domain: targetDomain,
        sourceInstallationId, databaseName: softaculousDatabaseName(),
        overwriteExisting: body.confirmExistingOverwrite === true || body.confirmExistingOverwrite === 'true' });
      const storedDocumentRoot = effectiveDocumentRoot({
        domain: targetDomain,
        domainType: created?.domainType ?? String(existingDomain?.domainType || 'subdomain'),
        documentRoot: created?.documentRoot ?? (existingDomain?.documentRoot ? String(existingDomain.documentRoot) : null),
      });
      verifiedDocumentRoot = await resolveCpanelDocumentRoot(
        String(connection.baseUrl), String(connection.username), token, targetDomain,
      ).catch(() => null) || storedDocumentRoot;
      let installation: Awaited<ReturnType<typeof listSoftaculousInstallations>>[number] | undefined;
      let publicInfo: Awaited<ReturnType<typeof publicWordPressInfo>> | null = null;
      let correctedSiteUrl = false;
      // A successful Softaculous clone can take several seconds to appear in its
      // installation inventory. Poll the inventory and the live WordPress endpoint
      // before reporting a failure; never repeat the clone itself.
      for (const delay of [0, 1000, 2000, 4000, 8000]) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        const refreshed = await listSoftaculousInstallations(String(connection.baseUrl), credential!);
        installation = refreshed.find((item) => item.domain === targetDomain);
        if (installation && rootInstallationUrl(installation.url, targetDomain)) break;
        if (installation?.id && !correctedSiteUrl) {
          await softaculousAction({
            baseUrl: String(connection.baseUrl), credential: credential!, action: 'wordpress_url',
            domain: targetDomain, installationId: installation.id, siteName: String(template!.name),
          });
          correctedSiteUrl = true;
          break;
        }
        publicInfo = await publicWordPressInfo(targetDomain);
        if (publicInfo.detected && rootInstallationUrl(publicInfo.url, targetDomain)) break;
      }
      installationId = installation?.id ?? '';
      verifiedUrl = correctedSiteUrl && installationId
        ? `https://${targetDomain}`
        : installation?.url ?? '';
      siteName = installation?.siteName ?? String(template!.name);
      version = installation?.version ?? '';
      if (!installation || !rootInstallationUrl(verifiedUrl, targetDomain)) {
        publicInfo ??= await publicWordPressInfo(targetDomain);
        if (publicInfo.detected && rootInstallationUrl(publicInfo.url, targetDomain)) {
          verifiedUrl = publicInfo.url || ''; siteName = publicInfo.siteName ?? siteName; version = publicInfo.version || '';
        } else if (installation?.url && !rootInstallationUrl(installation.url, targetDomain)) {
          throw new Error(`Softaculous reported ${installation.url}. SpyderWeb requires WordPress at the domain root and will not accept a /wp installation.`);
        } else {
          throw new Error('The subdomain and project were created, but the root WordPress clone is still awaiting verification. Do not retry the launch; rescan cPanel first.');
        }
      }
      const documentRoot = verifiedDocumentRoot;
      if (!documentRoot) {
        memoryProfileStatus = 'failed';
        memoryWarning = ' The project is live, but its memory profile needs inspection because cPanel did not return its document root.';
      } else {
        try {
          cpanelSession = cpanelSession ?? await createCpanelSession(String(connection.baseUrl), credential!).catch(() => null);
          const session = cpanelSession;
          let phpVersionResult: Awaited<ReturnType<typeof ensureRecommendedPhpVersion>>;
          let selectorMode: 'cloudlinux' | 'multiphp' = 'cloudlinux';
          try {
            await setCloudLinuxPhpSelectorVersion({
              baseUrl: String(connection.baseUrl), username: String(connection.username), token, version: '8.3',
            });
            phpVersionResult = {
              status: 'updated', version: 'alt-php83', label: 'PHP 8.3', previousVersion: null,
              method: 'cloudlinux_php_selector',
            };
          } catch {
            selectorMode = 'multiphp';
            phpVersionResult = await ensureRecommendedPhpVersion({
              baseUrl: String(connection.baseUrl), username: String(connection.username), token,
              domain: targetDomain, password: credential!.password, session,
            });
          }
          if (selectorMode === 'multiphp') {
            await ensurePhpRuntimeHandlerProfile({
              baseUrl: String(connection.baseUrl), username: String(connection.username), token,
              domain: targetDomain, documentRoot, phpPackage: phpVersionResult.version,
              password: credential!.password, session,
            });
          }
          await ensureRecommendedPhpProfile({
            baseUrl: String(connection.baseUrl), username: String(connection.username), token,
            domain: targetDomain, documentRoot, password: credential!.password, session,
          });
          await ensureWordPressMemoryProfile({
            baseUrl: String(connection.baseUrl), username: String(connection.username), token,
            domain: targetDomain, documentRoot, password: credential!.password, session,
          });
          memoryProfileStatus = 'wordpress_memory_verified';
          phpRuntimeVersion = phpVersionResult.version;
        } catch (error) {
          memoryProfileStatus = 'failed';
          const detail = error instanceof Error ? error.message : 'The memory profile could not be verified.';
          memoryWarning = ` The project is live, but its PHP and WordPress memory profile needs inspection. ${detail}`;
        }
      }
    }
    const templateName = keepExistingTemplate ? siteName : String(template!.name);
    const templateDomain = keepExistingTemplate ? targetDomain : String(template!.domain);
    await db.batch([
      db.prepare(`UPDATE hosting_domains SET wordpress_status = 'installed', wordpress_version = ?, php_version = ?,
        wordpress_site_name = ?, wordpress_url = ?, wordpress_installation_id = ?,
        wordpress_source = ?, workflow_status_override = 'Template Loaded',
        wordpress_soft_locked = 1,
        document_root = COALESCE(?, document_root), php_profile_status = ?,
        last_seen_at = ? WHERE id = ? AND owner_user_id = ?`)
        .bind(version || null, phpRuntimeVersion || null, siteName, verifiedUrl || `https://${targetDomain}`, installationId || null,
          keepExistingTemplate ? 'Existing loaded template' : 'Softaculous project launch',
          verifiedDocumentRoot, memoryProfileStatus,
          new Date().toISOString(), domainId, identity.userId),
      db.prepare(`INSERT INTO project_events (id, project_id, owner_user_id, event_type, source,
        stage, stage_status, note, details_json, created_at) VALUES (?, ?, ?, 'project.launched',
        'Owner Account', 'Setup', 'in_progress', ?, ?, ?)`)
        .bind(crypto.randomUUID(), projectId, identity.userId,
          keepExistingTemplate
            ? `Started ${projectName} on ${targetDomain} using its existing ${templateName} template without changing WordPress.`
            : `${targetMode === 'new' ? 'Created' : 'Prepared'} ${targetDomain} and loaded ${templateName} at the domain root.`,
          JSON.stringify({ targetMode, templateDecision: keepExistingTemplate ? 'keep' : 'replace', templateSlotNumber: keepExistingTemplate ? null : templateSlotNumber, templateDomain, wordpressDirectory: '' }), new Date().toISOString()),
      db.prepare(`INSERT INTO hosting_audit_events (id, owner_user_id, connection_id, action, target,
        outcome, details_json, created_at) VALUES (?, ?, ?, 'project.launch', ?, 'success', ?, ?)`)
        .bind(crypto.randomUUID(), identity.userId, connectionId, targetDomain,
          JSON.stringify({ projectName, targetMode, templateDecision: keepExistingTemplate ? 'keep' : 'replace', template: templateName, templateDomain, wordpressDirectory: '', memoryProfileStatus }), new Date().toISOString()),
    ]);
    return json({ projectId, domainId, domain: targetDomain,
      message: keepExistingTemplate
        ? `${projectName} is ready at ${targetDomain}. Its existing ${templateName} template was kept unchanged.`
        : `${projectName} is ready at ${targetDomain}. The template was loaded directly at the domain root.${memoryWarning}` }, 201);
  } catch (error) {
    if (connectionId) {
      await db.prepare(`INSERT INTO hosting_audit_events (id, owner_user_id, connection_id, action, target,
        outcome, details_json, created_at) VALUES (?, ?, ?, 'project.launch', ?, 'failed', ?, ?)`)
        .bind(crypto.randomUUID(), identity.userId, connectionId, targetDomain || null, JSON.stringify({ error: error instanceof Error ? error.message : 'Launch failed' }), new Date().toISOString()).run().catch(() => undefined);
    }
    return json({ error: error instanceof Error ? error.message : 'The project could not be launched.' }, 400);
  }
}
