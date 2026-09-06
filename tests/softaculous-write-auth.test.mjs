import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SoftaculousRequestError,
  softaculousActionWithCredentialFallback,
} from '../lib/softaculous.ts';

const passwordCredential = {
  username: 'webbuilder', password: 'correct-password', authMode: 'cpanel_basic',
};
const tokenCredential = {
  username: 'webbuilder', token: 'api-token', authMode: 'cpanel_token',
};

test('install retries once with the cPanel API token after a definite sign-in redirect', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) {
      return new Response('', { status: 302, headers: { Location: '/login/?login_only=1' } });
    }
    return Response.json({ done: 1, __settings: { softurl: 'https://dev4.testwebsitebuild.com' } });
  };
  try {
    await softaculousActionWithCredentialFallback({
      baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
      fallbackCredentials: [tokenCredential], action: 'install',
      domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
      adminUsername: 'admin', adminPassword: 'strong-password', adminEmail: 'admin@example.com',
    });
    assert.equal(calls.length, 2);
    assert.equal(calls.some((call) => call.url.includes('/login/')), false);
    assert.match(calls[0].init.headers.Authorization, /^Basic /);
    assert.equal(calls[1].init.headers.Authorization, 'cpanel webbuilder:api-token');
    assert.equal(new URLSearchParams(calls[1].init.body).get('softdirectory'), '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('install never repeats an ambiguous write response', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('<html><body>Operation processing</body></html>', {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  };
  try {
    await assert.rejects(
      softaculousActionWithCredentialFallback({
        baseUrl: 'https://cpanel.example:2083', credential: passwordCredential,
        fallbackCredentials: [tokenCredential], action: 'install',
        domain: 'dev4.testwebsitebuild.com', databaseName: 'sw123',
      }),
      (error) => error instanceof SoftaculousRequestError && error.responseWasAmbiguous,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
