import { env } from 'cloudflare:workers';
import { POST as runWordPressAction } from '@/app/api/hosting/domains/[domainId]/wordpress/route';

export const dynamic = 'force-dynamic';

type VerificationEnv = { WORDPRESS_VERIFICATION_TOKEN?: string };

const ownerUserId = 'yR3gsfamVje3SLlgSJ1HNb4OXlcSOOUYZ1tvh60BdR0D3yx7vW3MO0';
const testDomainId = '95eeba732c7231b529bb4e88669e21cb';
const templateDomain = 'template.mynewwebsite.co.za';

// Temporary, narrowly-scoped production verification route. It permits one
// known template clone onto the confirmed-empty dev9 test domain and is removed
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
