export function normalizeSubdomainLabel(value: string) {
  const label = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
    throw new Error('Use only letters, numbers and single hyphens for the subdomain name.');
  }
  return label;
}

export function rootInstallationUrl(value: string | null | undefined, domain: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return url.hostname.toLowerCase() === domain.toLowerCase() && path === '/';
  } catch {
    return false;
  }
}

export function suggestedSubdomainLabel(projectName: string) {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
}

export function isSelectableExistingDomain(
  domain: { id: string | number; source?: string; status: string },
  templateDomainIds: ReadonlySet<string>,
) {
  return domain.source === 'cpanel'
    && (domain.status === 'Available' || domain.status === 'Template Loaded')
    && !templateDomainIds.has(String(domain.id));
}
