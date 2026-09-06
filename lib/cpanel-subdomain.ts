export type SubdomainCreateInput = {
  label: string;
  parentDomain: string;
};

export function isCpanelSuccessStatus(status: unknown) {
  return status === 1 || status === '1' || status === true;
}

export function buildSubdomainCreateQuery(input: SubdomainCreateInput) {
  const hostname = `${input.label}.${input.parentDomain}`;
  return {
    domain: input.label,
    rootdomain: input.parentDomain,
    dir: hostname,
    disallowdot: '1',
  };
}

export function effectiveDocumentRoot(input: {
  domain: string;
  domainType?: string | null;
  documentRoot?: string | null;
}) {
  const reported = input.documentRoot?.trim();
  if (reported) return reported;
  // SpyderWeb creates every subdomain with `dir` equal to its full hostname.
  // Some shared cPanel accounts do not expose that value again during scans.
  return input.domainType === 'subdomain' ? input.domain.trim().toLowerCase() : null;
}

export async function issueSubdomainCreate(
  call: (module: string, fn: string, query: Record<string, string>) => Promise<unknown>,
  input: SubdomainCreateInput,
) {
  return call('SubDomain', 'addsubdomain', buildSubdomainCreateQuery(input));
}

export function reconcileCreatedSubdomain<T extends { domain: string }>(
  domains: T[],
  targetDomain: string,
  creationError: unknown,
) {
  const created = domains.find((domain) => domain.domain === targetDomain) ?? null;
  if (created) return created;
  if (creationError) throw creationError;
  return null;
}
