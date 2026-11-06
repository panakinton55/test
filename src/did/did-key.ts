import { base58Decode, base58Encode, safeEqualBytes } from '../lib/encoding.js';

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

export function encodeDidKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('did_public_key_length');
  const prefixed = new Uint8Array(ED25519_MULTICODEC.length + publicKey.length);
  prefixed.set(ED25519_MULTICODEC, 0);
  prefixed.set(publicKey, ED25519_MULTICODEC.length);
  return `did:key:z${base58Encode(prefixed)}`;
}

export function decodeDidKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:z') || did.length > 200) throw new Error('did_malformed');
  const decoded = base58Decode(did.slice('did:key:z'.length));
  if (
    decoded.length !== 34 ||
    decoded[0] !== ED25519_MULTICODEC[0] ||
    decoded[1] !== ED25519_MULTICODEC[1]
  ) {
    throw new Error('did_malformed');
  }
  return decoded.slice(2);
}

export function samePublicKey(left: Uint8Array, right: Uint8Array): boolean {
  return safeEqualBytes(left, right);
}
