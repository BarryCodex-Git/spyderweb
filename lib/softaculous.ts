export type OperationalCredential = {
  username: string;
  password?: string;
  token?: string;
  authMode?: 'cpanel_basic' | 'cpanel_token';
};

export type SoftaculousInstall = {
  domain: string;
  id: string | null;
  siteName: string | null;
  url: string | null;
  version: string | null;
};

export type SoftaculousBackup = {
  fileName: string;
  installationId: string | null;
  domain: string | null;
  createdAt: string | null;
  sizeBytes: number | null;
};

function authorization(credential: OperationalCredential) {
  if (credential.authMode === 'cpanel_token' || credential.token) {
    if (!credential.token) throw new Error('The saved cPanel API token is unavailable. Reconnect this hosting account.');
    return `cpanel ${credential.username}:${credential.token}`;
  }
  if (!credential.password) throw new Error('The saved cPanel management credential is unavailable.');
  const bytes = new TextEncoder().encode(`${credential.username}:${credential.password}`);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `Basic ${btoa(binary)}`;
}

async function createCpanelSession(baseUrl: string, credential: OperationalCredential) {
  if (!credential.password) throw new Error('Enter the normal cPanel account password.');
  const response = await fetch(`${baseUrl}/login/?login_only=1`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ user: credential.username, pass: credential.password }).toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(text) as Record<string, unknown>; } catch { /* cPanel may return HTML on a failed login. */ }
  const securityToken = typeof payload.security_token === 'string' ? payload.security_token : '';
  if (Number(payload.status) !== 1 || !/^\/cpsess\d+$/.test(securityToken)) {
    throw new Error('cPanel rejected the account password. Use the same username and password that open this cPanel account in a private browser window.');
  }
  const rawCookie = response.headers.get('set-cookie') || '';
  const cookies = [...rawCookie.matchAll(/(?:^|,)\s*([^=;,\s]+)=([^;,\s]+)/g)]
    .map((match) => `${match[1]}=${match[2]}`)
    .join('; ');
  return { securityToken, cookies };
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

function backupFileName(value: unknown) {
  const text = clean(value, 255);
  if (!text || text.includes('/') || text.includes('\\')) return null;
  return /^[A-Za-z0-9._-]+\.(?:zip|tar|tgz|tar\.gz)$/i.test(text) ? text : null;
}

function backupDate(record: Record<string, unknown>, fileName: string) {
  const candidate = clean(record.created_at ?? record.created ?? record.backup_time ?? record.time ?? record.date ?? record.mtime, 120);
  if (candidate) {
    const numeric = Number(candidate);
    const date = Number.isFinite(numeric)
      ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
      : new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const match = fileName.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})[-_.T](\d{2})[-_.](\d{2})(?:[-_.](\d{2}))?/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function backupSize(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = clean(value, 80);
  if (!text) return null;
  const match = text.match(/^([0-9.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return null;
  const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return Number(match[1]) * units[(match[2] || 'B').toUpperCase()];
}

function collectBackups(value: unknown, results = new Map<string, SoftaculousBackup>(), keyHint?: string) {
  if (Array.isArray(value)) { value.forEach((item) => collectBackups(item, results, keyHint)); return results; }
  if (!value || typeof value !== 'object') return results;
  const record = value as Record<string, unknown>;
  const fileName = [record.filename, record.file_name, record.backup_file, record.file, record.name, keyHint]
    .map(backupFileName).find(Boolean) ?? null;
  if (fileName) {
    const installationId = clean(record.insid ?? record.installation_id ?? record.install_id, 180)
      ?? fileName.match(/(?:^|[._-])(\d+_\d+)(?:[._-]|$)/)?.[1]
      ?? null;
    results.set(fileName, {
      fileName,
      installationId,
      domain: domainFrom(record.softdomain ?? record.domain ?? record.softurl ?? record.url),
      createdAt: backupDate(record, fileName),
      sizeBytes: backupSize(record.size ?? record.backup_size ?? record.filesize ?? record.file_size),
    });
  }
  Object.entries(record).forEach(([key, item]) => collectBackups(item, results, key));
  return results;
}

async function request(input: {
  baseUrl: string;
  credential: OperationalCredential;
  query: Record<string, string>;
  form?: Record<string, string>;
}) {
  const perform = (securityToken = '', cookies = '', useAuthorization = true) => {
    const url = new URL(`${input.baseUrl}${securityToken}/frontend/jupiter/softaculous/index.live.php`);
    url.searchParams.set('api', 'json');
    Object.entries(input.query).forEach(([key, value]) => url.searchParams.set(key, value));
    return fetch(url, {
      method: input.form ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        ...(useAuthorization ? { Authorization: authorization(input.credential) } : {}),
        ...(cookies ? { Cookie: cookies } : {}),
        ...(input.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: input.form ? new URLSearchParams(input.form).toString() : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(55_000),
    });
  };
  let response = await perform();
  const tokenMode = input.credential.authMode === 'cpanel_token' || Boolean(input.credential.token);
  const directRejected = response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400);
  if (!tokenMode && directRejected) {
    const session = await createCpanelSession(input.baseUrl, input.credential);
    response = await perform(session.securityToken, session.cookies, false);
  }
  if (response.status >= 300 && response.status < 400) throw new Error(tokenMode
    ? 'This server redirected the Softaculous API request instead of accepting the connected cPanel token.'
    : 'Softaculous redirected the management request. Check the cPanel management username and password.');
  if (response.status === 401 || response.status === 403) throw new Error(tokenMode
    ? 'This cPanel server accepted the API token for cPanel, but does not allow that token to access Softaculous.'
    : 'Softaculous rejected the management username or password.');
  if (!response.ok) throw new Error(`Softaculous returned ${response.status}.`);
  let text = await response.text();
  if (!tokenMode && /^\s*</.test(text)) {
    const session = await createCpanelSession(input.baseUrl, input.credential);
    response = await perform(session.securityToken, session.cookies, false);
    if (!response.ok || (response.status >= 300 && response.status < 400)) {
      throw new Error('Softaculous could not be opened through the authenticated cPanel session.');
    }
    text = await response.text();
  }
  if (/^\s*</.test(text)) throw new Error(tokenMode
    ? 'Softaculous returned its sign-in page instead of accepting the connected cPanel token.'
    : 'Softaculous returned a sign-in page. Check the operational credential and try again.');
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

export async function listSoftaculousBackups(baseUrl: string, credential: OperationalCredential) {
  const payload = await request({ baseUrl, credential, query: { act: 'backups' } });
  return [...collectBackups(payload).values()];
}

export async function softaculousAction(input: {
  baseUrl: string;
  credential: OperationalCredential;
  action: 'install' | 'clone' | 'backup' | 'remove' | 'delete_backup';
  domain: string;
  installationId?: string | null;
  sourceInstallationId?: string | null;
  adminUsername?: string;
  adminPassword?: string;
  adminEmail?: string;
  siteName?: string;
  databaseName?: string;
  backupFileName?: string;
}) {
  if (input.action === 'install') {
    if (!input.databaseName) throw new Error('SpyderWeb could not prepare a fresh WordPress database name.');
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'software', soft: '26' },
      form: {
        softsubmit: '1', softdomain: input.domain, softdirectory: '', softproto: '3', softdb: input.databaseName,
        site_name: input.siteName || 'New Client Website',
        admin_username: input.adminUsername || '', admin_pass: input.adminPassword || '',
        admin_email: input.adminEmail || '',
        language: 'en', disable_wp_cron: '0', auto_upgrade: '0', auto_upgrade_plugins: '0',
        auto_upgrade_themes: '0', noemail: '1', plugins: '',
      },
    });
  }
  if (input.action === 'clone') {
    if (!input.databaseName) throw new Error('SpyderWeb could not prepare a fresh template database name.');
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'sclone', insid: input.sourceInstallationId || '' },
      form: { softsubmit: '1', softdomain: input.domain, softdirectory: '', softproto: '3', softdb: input.databaseName },
    });
  }
  if (input.action === 'backup') {
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'backup', insid: input.installationId || '' },
      form: { backupins: '1', backup_dir: '1', backup_datadir: '1', backup_db: '1', noemail: '1' },
    });
  }
  if (input.action === 'delete_backup') {
    const fileName = backupFileName(input.backupFileName);
    if (!fileName) throw new Error('Softaculous did not provide a safe backup filename to delete.');
    return request({
      baseUrl: input.baseUrl, credential: input.credential,
      query: { act: 'backups', remove: fileName },
    });
  }
  return request({
    baseUrl: input.baseUrl, credential: input.credential,
    query: { act: 'remove', insid: input.installationId || '' },
    form: { removeins: '1', remove_dir: '1', remove_db: '1', remove_dbuser: '1', remove_datadir: '1', noemail: '1' },
  });
}
