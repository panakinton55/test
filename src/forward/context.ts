import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type ContextClaims = {
  did: string;
  scope: string;
  requestId: string;
  destination: string;
  iat: number;
};

function aadFor(destination: string): Buffer {
  return Buffer.from(`asg-context:${destination}`, 'utf8');
}

export function sealContext(claims: ContextClaims, key: Buffer): string {
  if (key.length !== 32) throw new Error('context_key');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadFor(claims.destination));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(claims), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function openContext(sealed: string, key: Buffer, destination: string): ContextClaims {
  if (key.length !== 32) throw new Error('context_key');
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('context_malformed');
  const iv = parts[1];
  const tag = parts[2];
  const ciphertext = parts[3];
  if (!iv || !tag || !ciphertext) throw new Error('context_malformed');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(aadFor(destination));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('context_claims');
  const claims = parsed as Partial<ContextClaims>;
  if (
    typeof claims.did !== 'string' ||
    typeof claims.scope !== 'string' ||
    typeof claims.requestId !== 'string' ||
    claims.destination !== destination ||
    typeof claims.iat !== 'number'
  ) {
    throw new Error('context_claims');
  }
  return {
    did: claims.did,
    scope: claims.scope,
    requestId: claims.requestId,
    destination: claims.destination,
    iat: claims.iat,
  };
}
