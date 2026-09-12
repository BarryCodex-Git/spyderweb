import { env } from 'cloudflare:workers';
import { POST as runWordPressAction } from '@/app/api/hosting/domains/[domainId]/wordpress/route';

export const dynamic = 'force-dynamic';

type VerificationEnv = { WORDPRESS_VERIFICATION_TOKEN?: string };

const ownerUserId = 'yR3gsfamVje3SLlgSJ1HNb4OXlcSOOUYZ1tvh60BdR0D3yx7vW3MO0';
const testDomainId = 'a31fbdd0e48e3f51d64d10e3611dcc35';
const templateDomain = 'template.testwebsitebuild.com';

// Temporary, narrowly-scoped production verification route. It permits one
// known template clone onto the confirmed-empty dev3 test domain and is removed
// immediately after the live check.
export async function POST(request: Request) {
  const expectedToken = (env as unknown as VerificationEnv).WORDPRESS_VERIFICATION_TOKEN;
  if (!expectedToken || request.headers.get('x-spyderweb-verification-token') !== expectedToken) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  const internalRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(request.url).origin,
      'oai-authenticated-user-id': ownerUserId,
    },
    body: JSON.stringify({
      action: 'clone_template',
      confirmReplacement: true,
      templateDomain,
    }),
  });
  return runWordPressAction(internalRequest, { params: Promise.resolve({ domainId: testDomainId }) });
}
