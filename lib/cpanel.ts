export type CpanelDomain = {
  domain: string;
  domainType: 'main' | 'subdomain' | 'addon' | 'alias' | 'unknown';
  documentRoot: string | null;
  phpVersion: string | null;
};

export type CpanelCapabilities = {
  domainInventory: boolean;
  featureInventory: boolean;
  phpInventory: boolean;
  wordpressManagement: boolean;
  userManagement: boolean;
  writeActions: false;
  destructiveActions: false;
};

export type CpanelInventoryAttempt = {
  source: string;
  status: 'complete' | 'empty' | 'unavailable';
  domainCount: number;
  message?: string;
};

type UapiEnvelope = {
  result?: {
    status?: number;
    data?: unknown;
    errors?: string[] | string | null;
    messages?: string[] | string | null;
  };
};

type DomainDetail = {
  documentRoot: string | null;
  phpVersion: string | null;
  domainType: CpanelDomain['domainType'];
};

type Api2Envelope = {
  cpanelresult?: {
    data?: unknown;
    event?: { result?: number };
    error?: string;
    reason?: string;
  };
};

class CpanelAuthenticationError extends Error {}
class CpanelFunctionError extends Error {}

const allowedPorts = new Set(['443', '2083']);

function isPrivateIpv4(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return true;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function normalizeCpanelUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid cPanel URL, for example https://server.example.com:2083.');
  }

  if (url.protocol !== 'https:') throw new Error('The cPanel connection must use HTTPS.');
  if (url.username || url.password) throw new Error('Do not include credentials inside the cPanel URL.');
  if (!url.hostname || url.hostname === 'localhost' || url.hostname === '::1' || isPrivateIpv4(url.hostname)) {
    throw new Error('The cPanel URL must point to a public hosting server.');
  }
  if (url.port && !allowedPorts.has(url.port)) {
    throw new Error('Use the secure cPanel port 2083, or standard HTTPS port 443.');
  }

  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.origin;
}

function validateCredentialPart(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/.test(normalized)) {
    throw new Error(`Enter a valid ${label}.`);
  }
  return normalized;
}

async function uapi(
  baseUrl: string,
  username: string,
  token: string,
  module: string,
  fn: string,
  query: Record<string, string> = {},
) {
  const url = new URL(`${baseUrl}/execute/${module}/${fn}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `cpanel ${username}:${token}`,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      'The cPanel server redirected the API request. Use the direct secure cPanel URL, usually https://server-name:2083.',
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new CpanelAuthenticationError('cPanel rejected the username or API token. Check both and try again.');
  }
  if (!response.ok) {
    throw new Error(`The cPanel server returned ${response.status}. Check the secure URL and hosting access.`);
  }

  const payload = (await response.json()) as UapiEnvelope;
  if (payload.result?.status !== 1) {
    const errors = payload.result?.errors;
    const messages = payload.result?.messages;
    const detail =
      (Array.isArray(errors) ? errors[0] : errors) ||
      (Array.isArray(messages) ? messages[0] : messages);
    throw new CpanelFunctionError(detail || `cPanel could not run ${module}/${fn}.`);
  }
  return payload.result.data;
}

async function api2ListSubdomains(baseUrl: string, username: string, token: string) {
  const url = new URL(`${baseUrl}/json-api/cpanel`);
  url.searchParams.set('cpanel_jsonapi_user', username);
  url.searchParams.set('cpanel_jsonapi_apiversion', '2');
  url.searchParams.set('cpanel_jsonapi_module', 'SubDomain');
  url.searchParams.set('cpanel_jsonapi_func', 'listsubdomains');
  url.searchParams.set('return_https_redirect_status', '1');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `cpanel ${username}:${token}`,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error('The shared-host compatibility endpoint redirected the request.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new CpanelAuthenticationError('cPanel rejected the username or API token. Check both and try again.');
  }
  if (!response.ok) {
    throw new Error(`The shared-host compatibility endpoint returned ${response.status}.`);
  }

  const payload = (await response.json()) as Api2Envelope;
  const result = payload.cpanelresult;
  if (!result || result.event?.result !== 1) {
    throw new CpanelFunctionError(result?.reason || result?.error || 'The shared-host compatibility endpoint was unavailable.');
  }
  return result.data;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function classifyDomainType(record: Record<string, unknown>): CpanelDomain['domainType'] {
  const type = String(record.domain_type ?? record.type ?? record.vhost_type ?? '').toLowerCase();
  if (/main|primary/.test(type) || record.is_main_domain === 1) return 'main';
  if (/sub/.test(type) || typeof record.parentdomain === 'string' || typeof record.rootdomain === 'string') return 'subdomain';
  if (/addon/.test(type)) return 'addon';
  if (/parked|alias/.test(type)) return 'alias';
  return 'unknown';
}

function normalizeDomain(value: unknown) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  if (candidate.length > 253 || !candidate.includes('.')) return null;
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(candidate)) {
    return null;
  }
  return candidate;
}

const domainFields = [
  'domain',
  'domain_name',
  'name',
  'servername',
  'server_name',
  'vhost',
  'vhost_name',
  'hostname',
] as const;

function domainFromDetail(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const domain = domainFields.map((field) => normalizeDomain(record[field])).find(Boolean) ?? null;
  if (!domain) return null;
  return {
    domain,
    documentRoot:
      [record.documentroot, record.document_root, record.dir].find((item): item is string => typeof item === 'string') ?? null,
    phpVersion:
      [record.phpversion, record.php_version].find((item): item is string => typeof item === 'string') ?? null,
    domainType: classifyDomainType(record),
  };
}

function collectDetails(value: unknown, map = new Map<string, DomainDetail>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectDetails(item, map));
    return map;
  }
  const stringDomain = normalizeDomain(value);
  if (stringDomain) {
    map.set(stringDomain, { documentRoot: null, phpVersion: null, domainType: 'unknown' });
    return map;
  }
  if (!value || typeof value !== 'object') return map;
  const detail = domainFromDetail(value);
  if (detail) {
    map.set(detail.domain, detail);
  }
  Object.values(value as Record<string, unknown>).forEach((item) => collectDetails(item, map));
  return map;
}

export async function discoverCpanel(input: {
  baseUrl: string;
  username: string;
  token: string;
}) {
  const baseUrl = normalizeCpanelUrl(input.baseUrl);
  const username = validateCredentialPart(input.username, 'cPanel username', 128);
  const token = validateCredentialPart(input.token, 'cPanel API token', 4096);

  let listData: Record<string, unknown> | null = null;
  let detailData: unknown = null;
  let webVhostData: unknown = null;
  let legacySubdomainData: unknown = null;
  const inventoryAttempts: CpanelInventoryAttempt[] = [];
  let authenticatedResponses = 0;
  let authenticationRejections = 0;

  const recordAttempt = (source: string, data: unknown) => {
    authenticatedResponses += 1;
    const domainCount = collectDetails(data).size;
    inventoryAttempts.push({ source, status: domainCount ? 'complete' : 'empty', domainCount });
    return data;
  };

  const recordFailure = (source: string, error: unknown) => {
    if (error instanceof CpanelFunctionError) authenticatedResponses += 1;
    if (error instanceof CpanelAuthenticationError) authenticationRejections += 1;
    inventoryAttempts.push({
      source,
      status: 'unavailable',
      domainCount: 0,
      message: error instanceof Error ? error.message : 'Inventory source unavailable.',
    });
  };

  await Promise.all([
    uapi(baseUrl, username, token, 'DomainInfo', 'list_domains')
      .then((data) => (listData = recordAttempt('Domain Information', data) as Record<string, unknown>))
      .catch((error) => recordFailure('Domain Information', error)),
    uapi(baseUrl, username, token, 'DomainInfo', 'domains_data', { format: 'list' })
      .then((data) => (detailData = recordAttempt('Domain hosting data', data)))
      .catch((error) => recordFailure('Domain hosting data', error)),
    uapi(baseUrl, username, token, 'WebVhosts', 'list_domains')
      .then((data) => (webVhostData = recordAttempt('Virtual hosts', data)))
      .catch((error) => recordFailure('Virtual hosts', error)),
    api2ListSubdomains(baseUrl, username, token)
      .then((data) => (legacySubdomainData = recordAttempt('Shared-host compatibility scan', data)))
      .catch((error) => recordFailure('Shared-host compatibility scan', error)),
  ]);

  if (!authenticatedResponses) {
    if (authenticationRejections) {
      throw new Error('cPanel rejected the username or API token. Check both and try again.');
    }
    throw new Error('SpyderWeb could not verify this cPanel endpoint. Check the secure cPanel URL and try again.');
  }

  const domainTypes = new Map<string, CpanelDomain['domainType']>();
  const add = (items: string[], type: CpanelDomain['domainType']) =>
    items.forEach((domain) => domainTypes.set(domain.trim().toLowerCase(), type));

  if (listData) {
    if (typeof listData.main_domain === 'string') add([listData.main_domain], 'main');
    add(stringList(listData.sub_domains), 'subdomain');
    add(stringList(listData.addon_domains), 'addon');
    add(stringList(listData.parked_domains), 'alias');
  }

  if (Array.isArray(legacySubdomainData)) {
    legacySubdomainData.forEach((value) => {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      const rootDomain = normalizeDomain(record.rootdomain);
      const subdomain = normalizeDomain(record.domain);
      if (rootDomain) domainTypes.set(rootDomain, 'main');
      if (subdomain) domainTypes.set(subdomain, subdomain === rootDomain ? 'main' : 'subdomain');
    });
  }

  const details = collectDetails(detailData);
  const webVhosts = collectDetails(webVhostData);
  const legacySubdomains = collectDetails(legacySubdomainData);
  for (const [domain, detail] of [...details, ...webVhosts, ...legacySubdomains]) {
    if (!domainTypes.has(domain) || domainTypes.get(domain) === 'unknown') {
      domainTypes.set(domain, detail.domainType);
    }
  }

  let featureData: unknown = null;
  let phpData: unknown = null;
  await Promise.all([
    uapi(baseUrl, username, token, 'Features', 'list_features').then((data) => (featureData = data)).catch(() => undefined),
    uapi(baseUrl, username, token, 'LangPHP', 'php_get_vhost_versions').then((data) => (phpData = data)).catch(() => undefined),
  ]);

  const phpDetails = collectDetails(phpData);
  const domains = [...domainTypes.entries()]
    .map(([domain, domainType]) => {
      const detail = details.get(domain);
      const php = phpDetails.get(domain);
      return {
        domain,
        domainType: domainType === 'unknown' ? detail?.domainType ?? 'unknown' : domainType,
        documentRoot: detail?.documentRoot ?? webVhosts.get(domain)?.documentRoot ?? null,
        phpVersion: php?.phpVersion ?? detail?.phpVersion ?? null,
      } satisfies CpanelDomain;
    })
    .sort((a, b) => a.domain.localeCompare(b.domain));

  const featureText = JSON.stringify(featureData ?? {}).toLowerCase();
  const capabilities: CpanelCapabilities = {
    domainInventory: domainTypes.size > 0,
    featureInventory: featureData !== null,
    phpInventory: phpData !== null,
    wordpressManagement: /wordpress|wp_toolkit|wp-toolkit/.test(featureText),
    userManagement: /ftp|email|mysql|user/.test(featureText),
    writeActions: false,
    destructiveActions: false,
  };

  return {
    baseUrl,
    username,
    domains,
    capabilities,
    scanStatus: domains.length ? 'complete' as const : 'needs_attention' as const,
    inventoryAttempts,
  };
}
