import { env } from 'cloudflare:workers';

type CredentialEnv = {
  HOSTING_CREDENTIAL_KEY?: string;
};

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function credentialKey() {
  const encoded = (env as unknown as CredentialEnv).HOSTING_CREDENTIAL_KEY;
  if (!encoded) throw new Error('Secure credential storage is not configured for this SpyderWeb deployment.');
  const raw = base64UrlToBytes(encoded);
  if (raw.byteLength !== 32) throw new Error('The hosting credential key is invalid.');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function context(ownerUserId: string, scope: string) {
  return new TextEncoder().encode(`spyderweb:secret:${ownerUserId}:${scope}:v1`);
}

function hostingContext(ownerUserId: string, connectionId: string) {
  return new TextEncoder().encode(`spyderweb:cpanel:${ownerUserId}:${connectionId}:v1`);
}

export async function encryptSecret(value: string, ownerUserId: string, scope: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context(ownerUserId, scope) },
    await credentialKey(),
    new TextEncoder().encode(value),
  );
  return { encrypted: bytesToBase64Url(new Uint8Array(encrypted)), iv: bytesToBase64Url(iv) };
}

export async function decryptSecret(encrypted: string, iv: string, ownerUserId: string, scope: string) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(iv), additionalData: context(ownerUserId, scope) },
      await credentialKey(),
      base64UrlToBytes(encrypted),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('The saved secure credential could not be unlocked. Save it again in Settings.');
  }
}

export async function encryptHostingToken(token: string, ownerUserId: string, connectionId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: hostingContext(ownerUserId, connectionId) },
    await credentialKey(),
    new TextEncoder().encode(token),
  );
  return {
    encryptedToken: bytesToBase64Url(new Uint8Array(encrypted)),
    encryptionIv: bytesToBase64Url(iv),
    credentialVersion: 1,
  };
}

export async function decryptHostingToken(
  encryptedToken: string,
  encryptionIv: string,
  ownerUserId: string,
  connectionId: string,
) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(encryptionIv),
        additionalData: hostingContext(ownerUserId, connectionId),
      },
      await credentialKey(),
      base64UrlToBytes(encryptedToken),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('The saved cPanel credential could not be unlocked. Reconnect this account with a new token.');
  }
}
