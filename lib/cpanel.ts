export type CpanelDomain = {
  domain: string;
  domainType: 'main' | 'subdomain' | 'addon' | 'alias' | 'unknown';
  documentRoot: string | null;
  phpVersion: string | null;
  wordpressStatus: 'installed' | 'not_installed' | 'not_checked';
  wordpressVersion: string | null;
  wordpressSiteName: string | null;
  wordpressUrl: string | null;
  wordpressInstallationId: string | null;
  wordpressSource: string | null;
};

export type CpanelCapabilities = {
  domainInventory: boolean;
  featureInventory: boolean;
  phpInventory: boolean;
  wordpressInventory: boolean;
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

type WordPressInstallation = {
  domain: string;
  installationId: string | null;
  siteName: string | null;
  url: string | null;
  version: string | null;
  source: string;
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

export async function cpanelUapi(
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

const uapi = cpanelUapi;

const recommendedPhpDirectives = {
  memory_limit: '768M',
  post_max_size: '512M',
  upload_max_filesize: '512M',
  max_execution_time: '900',
  max_input_time: '900',
  max_input_vars: '5000',
} as const;

type RecommendedPhpDirective = keyof typeof recommendedPhpDirectives;

export type CpanelSession = {
  securityToken: string;
  cookies: string;
};

async function cpanelSessionUapi(
  baseUrl: string,
  session: CpanelSession,
  module: string,
  fn: string,
  query: Record<string, string> = {},
) {
  const url = new URL(`${baseUrl}${session.securityToken}/execute/${module}/${fn}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Cookie: session.cookies },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || (response.status >= 300 && response.status < 400)) {
    throw new CpanelFunctionError(`The authenticated cPanel session could not run ${module}/${fn}.`);
  }
  const payload = (await response.json()) as UapiEnvelope;
  if (payload.result?.status !== 1) {
    const errors = payload.result?.errors;
    const messages = payload.result?.messages;
    const detail = (Array.isArray(errors) ? errors[0] : errors)
      || (Array.isArray(messages) ? messages[0] : messages);
    throw new CpanelFunctionError(detail || `cPanel could not run ${module}/${fn}.`);
  }
  return payload.result.data;
}

function directiveValue(value: unknown, name: RecommendedPhpDirective): string | null {
  if (typeof value === 'string') {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value.match(new RegExp(`(?:^|[\\s,;])${escaped}\\s*[:=]\\s*([^\\s,;]+)`, 'i'))?.[1] ?? null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = directiveValue(item, name);
      if (found !== null) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const direct = record[name];
  if (typeof direct === 'string' || typeof direct === 'number') return String(direct);
  const key = String(record.key ?? record.name ?? record.directive ?? '').trim().toLowerCase();
  if (key === name) {
    const candidate = record.value ?? record.setting ?? record.current;
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  }
  for (const item of Object.values(record)) {
    const found = directiveValue(item, name);
    if (found !== null) return found;
  }
  return null;
}

function directiveMatches(name: RecommendedPhpDirective, current: string | null, expected: string) {
  if (current === null) return false;
  const clean = current.trim().toUpperCase();
  if (name === 'memory_limit' || name === 'post_max_size' || name === 'upload_max_filesize') {
    const parseBytes = (input: string) => {
      const match = input.match(/^([0-9.]+)\s*([KMG]?)B?$/i);
      if (!match) return Number.NaN;
      const multiplier = match[2].toUpperCase() === 'G' ? 1024 ** 3 : match[2].toUpperCase() === 'M' ? 1024 ** 2 : match[2].toUpperCase() === 'K' ? 1024 : 1;
      return Number(match[1]) * multiplier;
    };
    return parseBytes(clean) === parseBytes(expected);
  }
  return Number(clean) === Number(expected);
}

async function inspectRecommendedPhpProfile(input: {
  baseUrl: string;
  username: string;
  token: string;
  domain: string;
}) {
  let data: unknown;
  let readMethod: 'basic_directives' | 'php_ini_content' | 'unavailable' = 'basic_directives';
  try {
    data = await cpanelUapi(input.baseUrl, input.username, input.token, 'LangPHP', 'php_ini_get_user_basic_directives', {
      type: 'vhost',
      vhost: input.domain,
    });
  } catch (error) {
    if (!(error instanceof CpanelFunctionError)) throw error;
    try {
      data = await cpanelUapi(input.baseUrl, input.username, input.token, 'LangPHP', 'php_ini_get_user_content', {
        type: 'vhost',
        vhost: input.domain,
      });
      readMethod = 'php_ini_content';
    } catch (fallbackError) {
      if (!(fallbackError instanceof CpanelFunctionError)) throw fallbackError;
      data = null;
      readMethod = 'unavailable';
    }
  }
  const current = Object.fromEntries(
    Object.keys(recommendedPhpDirectives).map((name) => [name, directiveValue(data, name as RecommendedPhpDirective)]),
  ) as Record<RecommendedPhpDirective, string | null>;
  const mismatches = (Object.entries(recommendedPhpDirectives) as [RecommendedPhpDirective, string][])
    .filter(([name, expected]) => !directiveMatches(name, current[name], expected))
    .map(([name]) => name);
  const readable = readMethod !== 'unavailable' && Object.values(current).some((value) => value !== null);
  return { current, mismatches, readable, readMethod };
}

export async function ensureRecommendedPhpProfile(input: {
  baseUrl: string;
  username: string;
  token: string;
  domain: string;
  documentRoot: string | null;
  session?: CpanelSession | null;
}) {
  const before = await inspectRecommendedPhpProfile(input);
  if (before.readable && !before.mismatches.length) return { status: 'already_correct' as const, changed: [] as RecommendedPhpDirective[] };

  const settingsToApply = before.readable
    ? before.mismatches
    : Object.keys(recommendedPhpDirectives) as RecommendedPhpDirective[];
  const directives = Object.fromEntries(settingsToApply.map((name, index) => [
    `directive-${index + 1}`,
    `${name}:${recommendedPhpDirectives[name]}`,
  ]));
  try {
    await cpanelUapi(input.baseUrl, input.username, input.token, 'LangPHP', 'php_ini_set_user_basic_directives', {
      type: 'vhost',
      vhost: input.domain,
      ...directives,
    });
  } catch (error) {
    if (!(error instanceof CpanelFunctionError)) throw error;
    if (!input.documentRoot) {
      throw new Error(`cPanel does not expose PHP editing for ${input.domain}, and its document root is unavailable for the safe .user.ini fallback.`);
    }
    const roots = filemanRootCandidates(input.documentRoot, input.username);
    const callers = [
      ...(input.session ? [(module: string, fn: string, query: Record<string, string>) => cpanelSessionUapi(input.baseUrl, input.session!, module, fn, query)] : []),
      (module: string, fn: string, query: Record<string, string>) => cpanelUapi(input.baseUrl, input.username, input.token, module, fn, query),
    ];
    let lastError: unknown = error;
    for (const root of roots) {
      for (const call of callers) {
        let existing = '';
        try {
          const files = await call('Fileman', 'list_files', {
            dir: root,
            types: 'file',
            show_hidden: '1',
          });
          if (containsNamedFile(files, '.user.ini')) {
            const data = await call('Fileman', 'get_file_content', {
              dir: root,
              file: '.user.ini',
              to_charset: 'UTF-8',
              update_html_document_encoding: '0',
            });
            existing = fileContent(data) ?? '';
          }
        } catch (readError) {
          lastError = readError;
          continue;
        }

        const managed = mergeRecommendedPhpDirectives(existing);
        try {
          await call('Fileman', 'save_file_content', {
            dir: root,
            file: '.user.ini',
            content: managed,
            from_charset: 'UTF-8',
            to_charset: 'UTF-8',
            fallback: '0',
          });
          const saved = await call('Fileman', 'get_file_content', {
            dir: root,
            file: '.user.ini',
            to_charset: 'UTF-8',
            update_html_document_encoding: '0',
          });
          const savedContent = fileContent(saved) ?? '';
          const unverified = (Object.entries(recommendedPhpDirectives) as [RecommendedPhpDirective, string][])
            .filter(([name, expected]) => !directiveMatches(name, directiveValue(savedContent, name), expected))
            .map(([name]) => name);
          if (unverified.length) {
            throw new Error(`cPanel saved .user.ini, but these values did not read back correctly: ${unverified.join(', ')}.`);
          }
          return { status: 'updated_via_user_ini' as const, changed: settingsToApply };
        } catch (writeError) {
          lastError = writeError;
        }
      }
    }
    const detail = lastError instanceof Error ? lastError.message : 'The cPanel file manager did not accept the update.';
    throw new Error(`The host blocks its PHP editor, and SpyderWeb could not safely update .user.ini through File Manager. ${detail}`);
  }

  const after = await inspectRecommendedPhpProfile(input);
  if (after.readable && after.mismatches.length) {
    throw new Error(`cPanel accepted the PHP update, but these settings did not verify: ${after.mismatches.join(', ')}.`);
  }
  return {
    status: after.readable ? 'updated' as const : 'updated_without_readback' as const,
    changed: settingsToApply,
  };
}

function mergeRecommendedPhpDirectives(content: string) {
  const seen = new Set<RecommendedPhpDirective>();
  const names = Object.keys(recommendedPhpDirectives) as RecommendedPhpDirective[];
  const lines = content.replace(/\r\n/g, '\n').split('\n').map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    const name = match?.[1] as RecommendedPhpDirective | undefined;
    if (!name || !names.includes(name)) return line;
    if (seen.has(name)) return `; SpyderWeb replaced duplicate: ${line}`;
    seen.add(name);
    return `${name} = ${recommendedPhpDirectives[name]}`;
  });
  const missing = names.filter((name) => !seen.has(name));
  if (missing.length) {
    if (lines.length && lines[lines.length - 1].trim()) lines.push('');
    lines.push('; Managed by SpyderWeb');
    missing.forEach((name) => lines.push(`${name} = ${recommendedPhpDirectives[name]}`));
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
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

async function softaculousListInstallations(baseUrl: string, username: string, token: string) {
  const url = new URL(`${baseUrl}/frontend/jupiter/softaculous/index.live.php`);
  url.searchParams.set('act', 'installations');
  url.searchParams.set('api', 'json');
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
    throw new CpanelFunctionError('Softaculous requires a browser session on this host.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new CpanelFunctionError('Softaculous did not accept API-token authentication on this host.');
  }
  if (!response.ok) {
    throw new CpanelFunctionError(`Softaculous returned ${response.status}.`);
  }

  const text = await response.text();
  if (/^\s*</.test(text)) {
    throw new CpanelFunctionError('Softaculous returned its sign-in page instead of installation data.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new CpanelFunctionError('Softaculous returned an unreadable installation list.');
  }
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as Record<string, unknown>).error;
    const message = Array.isArray(error) ? error.join(' ') : String(error || 'Softaculous could not list installations.');
    if (message.trim()) throw new CpanelFunctionError(message);
  }
  return payload;
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

function cleanInventoryText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/[\r\n\0]+/g, ' ').trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : cleaned.slice(0, maxLength) || null;
}

function domainFromUrl(value: unknown) {
  const text = cleanInventoryText(value, 2048);
  if (!text) return null;
  const direct = normalizeDomain(text);
  if (direct) return direct;
  try {
    return normalizeDomain(new URL(text.includes('://') ? text : `https://${text}`).hostname);
  } catch {
    return null;
  }
}

function firstInventoryText(record: Record<string, unknown>, fields: string[], maxLength: number) {
  for (const field of fields) {
    const value = cleanInventoryText(record[field], maxLength);
    if (value) return value;
  }
  return null;
}

function wordpressFromRecord(value: unknown, source: string, keyHint?: string): WordPressInstallation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const productText = [record.soft, record.sid, record.script, record.softname, record.script_name, record.type]
    .map((item) => String(item ?? '').toLowerCase())
    .join(' ');
  const hasWordPressMarker = /(^|\s)26($|\s)|wordpress|wp_/.test(productText);
  const hasInstanceShape = ['site_url', 'softurl', 'softdomain', 'blogname', 'wordpress_version', 'instance_id']
    .some((field) => field in record);
  if (!hasWordPressMarker && !hasInstanceShape) return null;

  const url = firstInventoryText(record, ['softurl', 'site_url', 'siteurl', 'url', 'home_url'], 2048);
  const domain = [record.softdomain, record.domain, record.hostname, url]
    .map(domainFromUrl)
    .find(Boolean) ?? null;
  if (!domain) return null;

  let siteName = firstInventoryText(
    record,
    ['site_name', 'site_title', 'blogname', 'blog_name', 'blog_title', 'title'],
    180,
  );
  if (siteName && /^(wordpress|my blog|just another wordpress site)$/i.test(siteName)) siteName = null;

  return {
    domain,
    installationId: firstInventoryText(record, ['insid', 'installation_id', 'instance_id', 'unique_id', 'id'], 180)
      ?? cleanInventoryText(keyHint, 180),
    siteName,
    url,
    version: firstInventoryText(record, ['version', 'ver', 'wordpress_version', 'installed_version'], 80),
    source,
  };
}

function collectWordPressInstallations(
  value: unknown,
  source: string,
  map = new Map<string, WordPressInstallation>(),
  keyHint?: string,
) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectWordPressInstallations(item, source, map));
    return map;
  }
  if (!value || typeof value !== 'object') return map;

  const installation = wordpressFromRecord(value, source, keyHint);
  if (installation) {
    const existing = map.get(installation.domain);
    if (!existing || (!existing.siteName && installation.siteName) || (!existing.version && installation.version)) {
      map.set(installation.domain, installation);
    }
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    collectWordPressInstallations(item, source, map, key);
  });
  return map;
}

function containsNamedFile(value: unknown, filename: string): boolean {
  if (typeof value === 'string') return value.split(/[\\/]/).pop()?.toLowerCase() === filename.toLowerCase();
  if (Array.isArray(value)) return value.some((item) => containsNamedFile(item, filename));
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const candidate = firstInventoryText(record, ['file', 'name', 'filename', 'fullpath', 'path'], 2048);
  if (candidate?.split(/[\\/]/).pop()?.toLowerCase() === filename.toLowerCase()) return true;
  return Object.values(record).some((item) => containsNamedFile(item, filename));
}

function fileContent(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.content === 'string') return record.content;
  for (const item of Object.values(record)) {
    const content = fileContent(item);
    if (content) return content;
  }
  return null;
}

export type PublicWordPressInfo = {
  detected: boolean;
  checked: boolean;
  siteName: string | null;
  url: string;
  version: string | null;
};

export async function publicWordPressInfo(domain: string): Promise<PublicWordPressInfo> {
  const baseUrl = `https://${domain}`;
  let receivedResponse = false;

  try {
    const response = await fetch(`${baseUrl}/wp-json/`, {
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    receivedResponse = true;
    if (response.ok) {
      const payload = (await response.json()) as Record<string, unknown>;
      const namespaces = Array.isArray(payload.namespaces) ? payload.namespaces.map(String) : [];
      const isWordPress = namespaces.some((namespace) => namespace === 'wp/v2' || namespace.startsWith('wp/'))
        || ('routes' in payload && 'name' in payload && 'url' in payload);
      if (isWordPress) {
        return {
          detected: true,
          checked: true,
          siteName: cleanInventoryText(payload.name, 180),
          url: cleanInventoryText(payload.url, 2048) ?? response.url ?? baseUrl,
          version: null,
        };
      }
    }
  } catch {
    // Some sites disable REST or do not yet have a working HTTPS document root.
    // The homepage check below distinguishes an empty domain from an unreachable one.
  }

  try {
    const response = await fetch(`${baseUrl}/`, {
      headers: { Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    receivedResponse = true;
    if (!response.ok && (response.status >= 500 || [401, 403, 429].includes(response.status))) {
      return { detected: false, checked: false, siteName: null, url: response.url || baseUrl, version: null };
    }
    const html = await response.text();
    const generator = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s*([^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']WordPress\s*([^"']*)["'][^>]+name=["']generator["']/i);
    const detected = Boolean(
      generator
      || /\bwp-(?:content|includes)\//i.test(html)
      || /<link[^>]+https?:\/\/api\.w\.org\//i.test(html)
      || /\/xmlrpc\.php(?:[?"'])/i.test(html),
    );
    if (!detected) {
      return { detected: false, checked: true, siteName: null, url: response.url || baseUrl, version: null };
    }
    const match = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)
      ?? html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const siteName = match?.[1]
      ?.replace(/&amp;/gi, '&')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+[|–—-]\s+WordPress\s*$/i, '')
      .trim();
    return {
      detected: true,
      checked: true,
      siteName: cleanInventoryText(siteName, 180),
      url: response.url || baseUrl,
      version: cleanInventoryText(generator?.[1], 80),
    };
  } catch {
    return { detected: false, checked: receivedResponse, siteName: null, url: baseUrl, version: null };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function filemanRootCandidates(documentRoot: string, username: string) {
  const normalized = documentRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const candidates = new Set<string>([normalized]);
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  if (withoutLeadingSlash) candidates.add(withoutLeadingSlash);

  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const homeRelative = normalized.replace(new RegExp(`^/home\\d*/${escapedUsername}/?`, 'i'), '');
  if (homeRelative) candidates.add(homeRelative);

  return [...candidates].filter(Boolean);
}

async function inspectWordPressDocumentRoot(input: {
  baseUrl: string;
  username: string;
  token: string;
  domain: string;
  documentRoot: string;
}) {
  const roots = filemanRootCandidates(input.documentRoot, input.username);

  let selectedRoot = input.documentRoot;
  let files: unknown = null;
  let lastError: unknown = null;
  for (const root of roots) {
    try {
      files = await uapi(input.baseUrl, input.username, input.token, 'Fileman', 'list_files', {
        dir: root,
        types: 'file',
        show_hidden: '1',
      });
      selectedRoot = root;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (files === null && lastError) throw lastError;
  if (!containsNamedFile(files, 'wp-config.php')) return null;

  const [versionData, publicInfo] = await Promise.all([
    uapi(input.baseUrl, input.username, input.token, 'Fileman', 'get_file_content', {
      dir: `${selectedRoot.replace(/\/$/, '')}/wp-includes`,
      file: 'version.php',
      to_charset: 'UTF-8',
      update_html_document_encoding: '0',
    }).catch(() => null),
    publicWordPressInfo(input.domain),
  ]);
  const versionMatch = fileContent(versionData)?.match(/\$wp_version\s*=\s*['\"]([^'\"]+)['\"]/i);
  return {
    domain: input.domain,
    installationId: null,
    siteName: publicInfo.siteName,
    url: publicInfo.url,
    version: cleanInventoryText(versionMatch?.[1], 80),
    source: 'cPanel files',
  } satisfies WordPressInstallation;
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
    if (!map.has(stringDomain)) {
      map.set(stringDomain, { documentRoot: null, phpVersion: null, domainType: 'unknown' });
    }
    return map;
  }
  if (!value || typeof value !== 'object') return map;
  const detail = domainFromDetail(value);
  if (detail) {
    const existing = map.get(detail.domain);
    map.set(detail.domain, {
      documentRoot: detail.documentRoot ?? existing?.documentRoot ?? null,
      phpVersion: detail.phpVersion ?? existing?.phpVersion ?? null,
      domainType: detail.domainType === 'unknown' ? existing?.domainType ?? 'unknown' : detail.domainType,
    });
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

  const resolvedListData = listData as Record<string, unknown> | null;
  if (resolvedListData) {
    if (typeof resolvedListData.main_domain === 'string') add([resolvedListData.main_domain], 'main');
    add(stringList(resolvedListData.sub_domains), 'subdomain');
    add(stringList(resolvedListData.addon_domains), 'addon');
    add(stringList(resolvedListData.parked_domains), 'alias');
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

  const domainsMissingRoots = [...domainTypes.keys()].filter(
    (domain) => !(details.get(domain)?.documentRoot ?? webVhosts.get(domain)?.documentRoot),
  );
  if (domainsMissingRoots.length) {
    let recoveredRoots = 0;
    await Promise.all(
      domainsMissingRoots.map(async (domain) => {
        try {
          const data = await uapi(baseUrl, username, token, 'DomainInfo', 'single_domain_data', { domain });
          const before = details.get(domain)?.documentRoot ?? null;
          collectDetails(data, details);
          if (!before && details.get(domain)?.documentRoot) recoveredRoots += 1;
        } catch {
          // The bulk domain response remains authoritative when a host disables
          // the per-domain compatibility endpoint.
        }
      }),
    );
    inventoryAttempts.push({
      source: 'Per-domain hosting data',
      status: recoveredRoots ? 'complete' : 'unavailable',
      domainCount: recoveredRoots,
      ...(!recoveredRoots ? { message: 'cPanel did not return additional document roots.' } : {}),
    });
  }

  let featureData: unknown = null;
  let phpData: unknown = null;
  let nativeWordPressData: unknown = null;
  let addonWordPressData: unknown = null;
  let softaculousData: unknown = null;
  let wordpressAuthenticatedSources = 0;
  const wordpressAttempts: CpanelInventoryAttempt[] = [];

  const recordWordPressAttempt = (source: string, data: unknown) => {
    wordpressAuthenticatedSources += 1;
    const installationCount = collectWordPressInstallations(data, source).size;
    wordpressAttempts.push({ source, status: installationCount ? 'complete' : 'empty', domainCount: installationCount });
    return data;
  };

  const recordWordPressFailure = (source: string, error: unknown) => {
    wordpressAttempts.push({
      source,
      status: 'unavailable',
      domainCount: 0,
      message: error instanceof Error ? error.message : 'WordPress inventory source unavailable.',
    });
  };

  await Promise.all([
    uapi(baseUrl, username, token, 'Features', 'list_features').then((data) => (featureData = data)).catch(() => undefined),
    uapi(baseUrl, username, token, 'LangPHP', 'php_get_vhost_versions').then((data) => (phpData = data)).catch(() => undefined),
    uapi(baseUrl, username, token, 'WordPressInstanceManager', 'get_instances')
      .then((data) => (nativeWordPressData = recordWordPressAttempt('cPanel WordPress Manager', data)))
      .catch((error) => recordWordPressFailure('cPanel WordPress Manager', error)),
    uapi(baseUrl, username, token, 'cPAddons', 'list_addon_instances')
      .then((data) => (addonWordPressData = recordWordPressAttempt('cPanel application inventory', data)))
      .catch((error) => recordWordPressFailure('cPanel application inventory', error)),
    softaculousListInstallations(baseUrl, username, token)
      .then((data) => (softaculousData = recordWordPressAttempt('Softaculous', data)))
      .catch((error) => recordWordPressFailure('Softaculous', error)),
  ]);

  const phpDetails = collectDetails(phpData);
  const wordpressInstallations = new Map<string, WordPressInstallation>();
  for (const [domain, installation] of [
    ...collectWordPressInstallations(nativeWordPressData, 'cPanel WordPress Manager'),
    ...collectWordPressInstallations(addonWordPressData, 'cPanel application inventory'),
    ...collectWordPressInstallations(softaculousData, 'Softaculous'),
  ]) {
    const existing = wordpressInstallations.get(domain);
    if (!existing) {
      wordpressInstallations.set(domain, installation);
    } else if ((!existing.siteName && installation.siteName) || installation.source === 'Softaculous') {
      wordpressInstallations.set(domain, {
        ...existing,
        ...installation,
        siteName: installation.siteName ?? existing.siteName,
        version: installation.version ?? existing.version,
        url: installation.url ?? existing.url,
        installationId: installation.installationId ?? existing.installationId,
      });
    }
  }

  const publicCheckedDomains = new Set<string>();
  const publicWordPressResults = await mapWithConcurrency(
    [...domainTypes.keys()],
    4,
    async (domain) => {
      const info = await publicWordPressInfo(domain);
      if (info.checked) publicCheckedDomains.add(domain);
      if (!info.detected) return null;
      return {
        domain,
        installationId: null,
        siteName: info.siteName,
        url: info.url,
        version: info.version,
        source: 'Public WordPress endpoint',
      } satisfies WordPressInstallation;
    },
  );
  let publicInstallationCount = 0;
  for (const installation of publicWordPressResults) {
    if (!installation) continue;
    publicInstallationCount += 1;
    const existing = wordpressInstallations.get(installation.domain);
    wordpressInstallations.set(installation.domain, {
      ...installation,
      installationId: existing?.installationId ?? installation.installationId,
      siteName: installation.siteName ?? existing?.siteName ?? null,
      url: installation.url ?? existing?.url ?? null,
      version: existing?.version ?? installation.version,
      source: existing?.source ?? installation.source,
    });
  }
  wordpressAttempts.push({
    source: 'Public WordPress endpoints',
    status: publicInstallationCount ? 'complete' : 'empty',
    domainCount: publicInstallationCount,
    message: `${publicInstallationCount} installations found; ${publicCheckedDomains.size - publicInstallationCount} domains confirmed without WordPress; ${domainTypes.size - publicCheckedDomains.size} domains could not be reached.`,
  });

  const fileCheckedDomains = new Set<string>();
  const fileInspectionResults = await Promise.all(
    [...domainTypes.keys()].map(async (domain) => {
      const documentRoot = details.get(domain)?.documentRoot ?? webVhosts.get(domain)?.documentRoot ?? null;
      if (!documentRoot) return null;
      try {
        const installation = await inspectWordPressDocumentRoot({ baseUrl, username, token, domain, documentRoot });
        fileCheckedDomains.add(domain);
        return installation;
      } catch {
        return null;
      }
    }),
  );
  for (const installation of fileInspectionResults) {
    if (!installation) continue;
    const existing = wordpressInstallations.get(installation.domain);
    wordpressInstallations.set(installation.domain, {
      ...installation,
      installationId: existing?.installationId ?? installation.installationId,
      siteName: existing?.siteName ?? installation.siteName,
      url: existing?.url ?? installation.url,
      version: existing?.version ?? installation.version,
      source: existing?.source ?? installation.source,
    });
  }
  wordpressAttempts.push({
    source: 'cPanel WordPress file check',
    status: fileCheckedDomains.size ? 'complete' : 'unavailable',
    domainCount: wordpressInstallations.size,
    ...(!fileCheckedDomains.size ? { message: 'cPanel did not expose readable document roots for WordPress inspection.' } : {}),
  });

  const managerInventoryComplete = wordpressAuthenticatedSources > 0;
  const domains = [...domainTypes.entries()]
    .map(([domain, domainType]) => {
      const detail = details.get(domain);
      const php = phpDetails.get(domain);
      const wordpress = wordpressInstallations.get(domain);
      return {
        domain,
        domainType: domainType === 'unknown' ? detail?.domainType ?? 'unknown' : domainType,
        documentRoot: detail?.documentRoot ?? webVhosts.get(domain)?.documentRoot ?? null,
        phpVersion: php?.phpVersion ?? detail?.phpVersion ?? null,
        wordpressStatus: wordpress
          ? 'installed'
          : managerInventoryComplete || fileCheckedDomains.has(domain) || publicCheckedDomains.has(domain)
            ? 'not_installed'
            : 'not_checked',
        wordpressVersion: wordpress?.version ?? null,
        wordpressSiteName: wordpress?.siteName ?? null,
        wordpressUrl: wordpress?.url ?? null,
        wordpressInstallationId: wordpress?.installationId ?? null,
        wordpressSource: wordpress?.source ?? null,
      } satisfies CpanelDomain;
    })
    .sort((a, b) => a.domain.localeCompare(b.domain));
  const wordpressInventoryComplete = domains.every((domain) => domain.wordpressStatus !== 'not_checked');

  const featureText = JSON.stringify(featureData ?? {}).toLowerCase();
  const capabilities: CpanelCapabilities = {
    domainInventory: domainTypes.size > 0,
    featureInventory: featureData !== null,
    phpInventory: phpData !== null,
    wordpressInventory: wordpressInventoryComplete,
    wordpressManagement: wordpressAuthenticatedSources > 0 || /wordpress|wp_toolkit|wp-toolkit/.test(featureText),
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
    wordpressScanStatus: wordpressInventoryComplete ? 'complete' as const : 'needs_attention' as const,
    wordpressInstallationCount: wordpressInstallations.size,
    inventoryAttempts: [...inventoryAttempts, ...wordpressAttempts],
  };
}
