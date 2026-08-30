const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let bits = '';
  raw.forEach((byte) => { bits += byte.toString(2).padStart(8, '0'); });
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function codeForCounter(secret: string, counter: number) {
  const key = await crypto.subtle.importKey(
    'raw', decodeBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false);
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
  const offset = hash[hash.length - 1] & 0x0f;
  const value = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1_000_000;
  return value.toString().padStart(6, '0');
}

export async function verifyTotp(secret: string, code: string, lastAcceptedCounter?: number | null) {
  if (!/^\d{6}$/.test(code)) return null;
  const currentCounter = Math.floor(Date.now() / 30_000);
  for (let offset = -1; offset <= 1; offset += 1) {
    const counter = currentCounter + offset;
    if (lastAcceptedCounter !== null && lastAcceptedCounter !== undefined && counter <= lastAcceptedCounter) continue;
    if (await codeForCounter(secret, counter) === code) return counter;
  }
  return null;
}

export function totpUri(secret: string, email: string | null) {
  const label = encodeURIComponent(`SpyderWeb:${email || 'Owner'}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=SpyderWeb&algorithm=SHA1&digits=6&period=30`;
}
