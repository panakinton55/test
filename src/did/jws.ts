import { CompactSign, base64url, compactVerify, exportJWK, importJWK, type KeyLike } from 'jose';
import { decodeDidKey, samePublicKey } from './did-key.js';

const TEXT = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export async function rawEd25519PublicKey(publicKey: KeyLike): Promise<Uint8Array> {
  const jwk = await exportJWK(publicKey);
  if (typeof jwk.x !== 'string') throw new Error('public_key');
  const raw = base64url.decode(jwk.x);
  if (raw.length !== 32) throw new Error('public_key');
  return new Uint8Array(raw);
}

export async function signDetached(privateKey: KeyLike, did: string, canonical: string): Promise<string> {
  const jws = await new CompactSign(TEXT.encode(canonical))
    .setProtectedHeader({ alg: 'EdDSA', kid: did, typ: 'asg-did+jws' })
    .sign(privateKey);
  const parts = jws.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[2]) throw new Error('jws_sign');
  return `${parts[0]}..${parts[2]}`;
}

type ProtectedHeader = { alg?: string; kid?: string; typ?: string };

function readProtectedHeader(encoded: string): ProtectedHeader | null {
  try {
    const parsed: unknown = JSON.parse(TEXT_DECODER.decode(base64url.decode(encoded)));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as ProtectedHeader;
  } catch {
    return null;
  }
}

export async function verifyDetached(input: {
  did: string;
  publicKey: Uint8Array;
  canonical: string;
  detached: string;
}): Promise<boolean> {
  if (input.detached.length > 4096) return false;
  const parts = input.detached.split('.');
  if (parts.length !== 3) return false;
  const protectedHeader = parts[0];
  const payload = parts[1];
  const signature = parts[2];
  if (!protectedHeader || payload !== '' || !signature) return false;

  const header = readProtectedHeader(protectedHeader);
  if (!header || header.alg !== 'EdDSA' || header.kid !== input.did || header.typ !== 'asg-did+jws') {
    return false;
  }

  let expected: Uint8Array;
  try {
    expected = decodeDidKey(input.did);
  } catch {
    return false;
  }
  if (!samePublicKey(expected, input.publicKey)) return false;

  const compact = `${protectedHeader}.${base64url.encode(TEXT.encode(input.canonical))}.${signature}`;
  try {
    const key = await importJWK(
      { kty: 'OKP', crv: 'Ed25519', x: base64url.encode(input.publicKey) },
      'EdDSA',
    );
    const verified = await compactVerify(compact, key, { algorithms: ['EdDSA'] });
    if (verified.protectedHeader.alg !== 'EdDSA' || verified.protectedHeader.kid !== input.did) return false;
    return TEXT_DECODER.decode(verified.payload) === input.canonical;
  } catch {
    return false;
  }
}
