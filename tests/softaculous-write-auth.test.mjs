import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SoftaculousRequestError,
  isSoftaculousExistingFilesError,
  listSoftaculousInstallations,
  parseSoftaculousPayload,
  readableSoftaculousError,
  softaculousManagedAction,
} from '../lib/softaculous.ts';

test('Softaculous JSON remains readable when the host prepends a PHP notice', () => {
  const payload = parseSoftaculousPayload('PHP Warning: session notice\n{"installations":{"26_1":{"soft":"26"}}}\n');
  assert.equal(payload.installations['26_1'].soft, '26');
});

const passwordCredential = {
  username: 'webbuilder', password: 'correct-password', authMode: 'cpanel_basic',
};
const tokenCredential = {
  username: 'webbuilder', token: 'api-token', authMode: 'cpanel_token',
};

test('install uses the same direct cPanel username/password request as the working host', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ done: 1, __settings: { softurl: 'https://dev4.testwebsitebuild.com' } });
  };
  try {
    await softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'install',
      domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
      adminUsername: 'admin', adminPassword: 'strong-password', adminEmail: 'admin@example.com',
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/frontend\/jupiter\/softaculous\/index\.live\.php/);
    assert.equal(calls[0].init.method, 'POST');
    assert.match(calls[0].init.headers.Authorization, /^Basic /);
    assert.equal(new URLSearchParams(calls[0].init.body).get('softdirectory'), '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('definite direct-auth redirect retries through a real cPanel session, never an API token', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return new Response('', { status: 302, headers: { Location: '/login/?login_only=1' } });
    if (calls.length === 2) return new Response(JSON.stringify({ status: 1, security_token: '/cpsess1234567890' }), {
      status: 200, headers: { 'Set-Cookie': 'cpsession=cp123; Path=/; Secure' },
    });
    return Response.json({ done: 1 });
  };
  try {
    await softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'install', domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
    });
    assert.equal(calls.length, 3);
    assert.match(calls[0].init.headers.Authorization, /^Basic /);
    assert.match(calls[1].url, /\/login\/\?login_only=1$/);
    assert.match(calls[2].url, /\/cpsess1234567890\/frontend\/jupiter\/softaculous\/index\.live\.php/);
    assert.equal(calls[2].init.headers.Cookie, 'cpsession=cp123');
    assert.equal('Authorization' in calls[2].init.headers, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WordPress URL correction uses the authenticated Softaculous manager', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ done: 1 });
  };
  try {
    await softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'wordpress_url', domain: 'dev4.testwebsitebuild.com',
      installationId: '26_12345', siteName: 'Full Template Ready',
    });
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).searchParams.get('act'), 'wordpress');
    const form = new URLSearchParams(calls[0].init.body);
    assert.equal(form.get('insid'), '26_12345');
    assert.equal(form.get('softurl'), 'https://dev4.testwebsitebuild.com');
    assert.equal(form.get('site_name'), 'Full Template Ready');
    assert.equal(form.get('save_info'), '1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('confirmed clone replacement sends Softaculous overwrite protection explicitly', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return Response.json({ done: 1 });
  };
  try {
    await softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'clone', domain: 'dev4.testwebsitebuild.com',
      sourceInstallationId: '26_template', databaseName: 'sw123', overwriteExisting: true,
    });
    const form = new URLSearchParams(request.init.body);
    assert.equal(form.get('softdirectory'), '');
    assert.equal(form.get('overwrite_existing'), '1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cross-account templates use Softaculous remote import into the domain root', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return Response.json({ done: 1 });
  };
  try {
    await softaculousManagedAction({
      baseUrl: 'https://destination.example:2083', credential: passwordCredential,
      action: 'remote_import', domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
      sourceDomain: 'template.mynewwebsite.co.za', sourceServerHost: 'source.example',
      sourceFtpUsername: 'sourceuser', sourceFtpPassword: 'source-password', sourceFtpPath: '/template.mynewwebsite.co.za',
    });
    assert.equal(new URL(request.url).searchParams.get('act'), 'import');
    const form = new URLSearchParams(request.init.body);
    assert.equal(form.get('remote_submit'), '1');
    assert.equal(form.get('domain'), 'template.mynewwebsite.co.za');
    assert.equal(form.get('softdomain'), 'dev4.testwebsitebuild.com');
    assert.equal(form.get('dest_directory'), '');
    assert.equal(form.get('softdb'), 'sw123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('confirmed clean install sends Softaculous overwrite protection explicitly', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return Response.json({ done: 1 });
  };
  try {
    await softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'install', domain: 'dev9.mynewwebsite.co.za', databaseName: 'sw123', overwriteExisting: true,
    });
    const form = new URLSearchParams(request.init.body);
    assert.equal(form.get('overwrite_existing'), '1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Softaculous HTML errors are readable and existing-file conflicts are detectable', () => {
  const raw = 'Installation cannot proceed because the following files already exist:<ul><li>index.php</li><li>wp-config.php</li></ul>Please choose overwrite.';
  const message = readableSoftaculousError(raw);
  assert.equal(message.includes('<li>'), false);
  assert.match(message, /index\.php; wp-config\.php/);
  assert.equal(isSoftaculousExistingFilesError(new Error(message)), true);
});

test('install never uses a cPanel API token as a Softaculous write fallback', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ done: 1 }); };
  try {
    await assert.rejects(softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: tokenCredential,
      action: 'install', domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
    }), /API tokens cannot run Softaculous writes/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('install never repeats an ambiguous non-login response', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('<html><body>Operation processing</body></html>', { status: 200 });
  };
  try {
    await assert.rejects(softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'install', domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
    }), (error) => error instanceof SoftaculousRequestError && error.responseWasAmbiguous);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an unreadable write response is treated as ambiguous and is never repeated', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('operation accepted', { status: 200 });
  };
  try {
    await assert.rejects(softaculousManagedAction({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      action: 'clone', domain: 'dev4.testwebsitebuild.com', sourceInstallationId: '26_template', databaseName: 'sw123',
    }), (error) => error instanceof SoftaculousRequestError && error.responseWasAmbiguous);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an unreadable inventory response retries safely through a cPanel session', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return new Response('temporary proxy response', { status: 200 });
    if (calls.length === 2) return new Response(JSON.stringify({ status: 1, security_token: '/cpsess1234567890' }), {
      status: 200, headers: { 'Set-Cookie': 'cpsession=cp123; Path=/; Secure' },
    });
    return Response.json({ installations: { '26_123': {
      soft: '26', insid: '26_123', softdomain: 'dev2.testwebsitebuild.com',
      softurl: 'https://dev2.testwebsitebuild.com', site_name: 'Client Template',
    } } });
  };
  try {
    const installations = await listSoftaculousInstallations('https://cpanel.example:2083', passwordCredential);
    assert.equal(calls.length, 3);
    assert.match(calls[1].url, /\/login\/\?login_only=1$/);
    assert.match(calls[2].url, /\/cpsess1234567890\/frontend\/jupiter\/softaculous\/index\.live\.php/);
    assert.equal(calls[2].init.method, 'GET');
    assert.equal(installations[0].domain, 'dev2.testwebsitebuild.com');
    assert.equal(installations[0].id, '26_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
