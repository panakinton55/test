import { createHash, randomBytes } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519';
import { bigintToBytesBE, bytesToBigintBE, utf8 } from '../lib/encoding.js';

const DOMAIN = utf8('ASG-ZKP1');
const ORDER = ed25519.CURVE.n;
const BASE = ed25519.ExtendedPoint.BASE;

export type SchnorrProof = {
  R: Uint8Array;
  s: Uint8Array;
};

function randomScalar(): bigint {
  while (true) {
    const candidate = bytesToBigintBE(randomBytes(32));
    if (candidate !== 0n && candidate < ORDER) return candidate;
  }
}

function hashToScalar(parts: Uint8Array[]): bigint {
  const hash = createHash('sha512');
  hash.update(DOMAIN);
  for (const part of parts) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(part.length);
    hash.update(length);
    hash.update(part);
  }
  return bytesToBigintBE(hash.digest()) % ORDER;
}

export function publicFromScalar(scalar: bigint): Uint8Array {
  if (scalar <= 0n || scalar >= ORDER) throw new Error('zkp_scalar');
  return BASE.multiply(scalar).toRawBytes();
}

export function randomZkpScalar(): bigint {
  return randomScalar();
}

export function schnorrProve(scalar: bigint, message: Uint8Array): SchnorrProof {
  if (scalar <= 0n || scalar >= ORDER) throw new Error('zkp_scalar');
  const nonce = randomScalar();
  const commitment = BASE.multiply(nonce);
  const publicPoint = BASE.multiply(scalar);
  const challenge = hashToScalar([commitment.toRawBytes(), publicPoint.toRawBytes(), message]);
  const response = (nonce + challenge * scalar) % ORDER;
  return {
    R: commitment.toRawBytes(),
    s: bigintToBytesBE(response, 32),
  };
}

function acceptedPoint(bytes: Uint8Array) {
  if (bytes.length !== 32) return null;
  try {
    const point = ed25519.ExtendedPoint.fromBytes(bytes);
    if (point.isSmallOrder() || !point.isTorsionFree() || point.is0()) return null;
    return point;
  } catch {
    return null;
  }
}

export function schnorrVerify(publicKey: Uint8Array, message: Uint8Array, proof: SchnorrProof): boolean {
  if (proof.s.length !== 32) return false;
  const response = bytesToBigintBE(proof.s);
  if (response >= ORDER) return false;
  const publicPoint = acceptedPoint(publicKey);
  const commitment = acceptedPoint(proof.R);
  if (!publicPoint || !commitment) return false;
  const challenge = hashToScalar([proof.R, publicPoint.toRawBytes(), message]);
  const left = BASE.multiply(response);
  const right = commitment.add(publicPoint.multiply(challenge));
  return left.equals(right);
}

export function assertZkpPublicKey(publicKey: Uint8Array): void {
  if (!acceptedPoint(publicKey)) throw new Error('zkp_public_key');
}
