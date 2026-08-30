export type OperationalCredential = {
  username: string;
  password: string;
};

export type SoftaculousInstall = {
  domain: string;
  id: string | null;
  siteName: string | null;
  url: string | null;
  version: string | null;
};

function basicAuth(credential: OperationalCredential) {
  const bytes = new TextEncoder().encode(`${credential.username}:${credential.password}`);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `Basic ${btoa(binary)}`;
}

function clean(value: unknown, max = 2048) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  return String(value).replace(/[\r\n\0]+/g, ' ').trim().slice(0, max) || null;
}

function errorText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(errorText).filter(Boolean).join(' ');
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(errorText).filter(Boolean).join(' ');
  return '';
}

function domainFrom(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  try { return new URL(text.includes('://') ? text : `https://${text}`).hostname.toLowerCase(); }
  catch { return null; }
}

function collect(value: unknown, results = new Map<string, SoftaculousInstall>(), keyHint?: string) {
  if (Array.isArray(value)) { value.forEach((item) => collect(item, results)); return results; }
  if (!value || typeof value !== 'object') return results;
  const record = value as Record<string, unknown>;
  const marker = [record.soft, record.sid, record.script, record.softname].join(' ').toLowerCase();
  const url = clean(record.softurl ?? record.site_url ?? record.url);
  const domain = domainFrom(record.softdomain ?? record.domain ?? url);
  if (domain && (/wordpress|(^|\s)26($|\s)/.test(marker) || 'softurl' in record || 'insid' in record)) {
    results.set(domain, {
      domain,
      id: clean(record.insid ?? record.installation_id ?? record.id ?? keyHint, 180),
      siteName: clean(record.site_name ?? record.blogname ?? record.site_title, 180),
      url,
      version: clean(record.ver ?? record.version ?? record.softversion, 80),
    });
  }
  Object.entries(record).forEach(([key, item]) => collect(item, results, key));
  return results;
}

async function request(input: {
  baseUrl: string;
  credential: OperationalCredential;
  query: Record<string, string>;
  form?: Record<string, string>;
}) {
  const url = new URL(`${input.baseUrl}/frontend/jupiter/softaculous/index.live.php`);
  url.searchParams.set('api', 'json');
  Object.entries(input.query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method: input.form ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth(input.credential),
      ...(input.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: input.form ? new URLSearchParams(input.form).toString() : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(55_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error('Softaculous redirected the management request. Check the cPanel management username and password.');
  if (response.status === 401 || response.status === 403) throw new Error('Softaculous rejected the management username or password.');
  if (!response.ok) throw new Error(`Softaculous returned ${response.status}.`);
  const text = await response.text();
  if (/^\s*</.test(text)) throw new Error('Softaculous returned a sign-in page. Check the operational credential and try again.');
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { throw new Error('Softaculous returned an unreadable response.'); }
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const errors = errorText(record.error ?? record.errors);
  if (errors) throw new Error(errors);
  return payload;
}

export async function listSoftaculousInstallations(baseUrl: string, credential: OperationalCredential) {
  const payload = await request({ baseUrl, credential, query: { act: 'installations' } });
  return [...collect(payload).values()];
}

export async function softaculousAction(input: {
  baseUrl: string;
  credential: OperationalCredential;
  action: 'install' | 'clone' | 'backup' | 'remove';
  domain: string;
  installationId?: string | null;
  sourceInstallationId?: string | null;
  adminUsername?: string;
  adminPassword?: string;
  adminEmail?: string;
  siteName?: string;
}) {
  if (input.action === 'install') {
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'software', soft: '26' },
      form: {
        softsubmit: '1', softdomain: input.domain, softdirectory: '', softproto: '3',
        site_name: input.siteName || 'New Client Website',
        admin_username: input.adminUsername || '', admin_pass: input.adminPassword || '',
        admin_email: input.adminEmail || '',
        language: 'en', disable_wp_cron: '0', auto_upgrade: '0', auto_upgrade_plugins: '0',
        auto_upgrade_themes: '0', noemail: '1', plugins: '',
      },
    });
  }
  if (input.action === 'clone') {
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'sclone', insid: input.sourceInstallationId || '' },
      form: { softsubmit: '1', softdomain: input.domain, softdirectory: '', softproto: '3' },
    });
  }
  if (input.action === 'backup') {
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'backup', insid: input.installationId || '' },
      form: { backupins: '1', backup_dir: '1', backup_datadir: '1', backup_db: '1', noemail: '1' },
    });
  }
  return request({
    baseUrl: input.baseUrl, credential: input.credential,
    query: { act: 'remove', insid: input.installationId || '' },
    form: { removeins: '1', remove_dir: '1', remove_db: '1', remove_dbuser: '1', remove_datadir: '1', noemail: '1' },
  });
}
