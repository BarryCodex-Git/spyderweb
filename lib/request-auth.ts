export type RequestIdentity = {
  userId: string;
  email: string | null;
};

export function getRequestIdentity(request: Request): RequestIdentity | null {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');

  if (userId) {
    return { userId, email };
  }

  if (process.env.NODE_ENV !== 'production') {
    return { userId: 'local-owner', email: 'local-preview@spyderweb.test' };
  }

  return null;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
