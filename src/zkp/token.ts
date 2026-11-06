import { z } from 'zod';
import { canonicalize, sha256Hex, utf8 } from '../lib/encoding.js';
import { schnorrProve, schnorrVerify } from './proof.js';

export const ZKP_TOKEN_TYPE = 'zkp-pok-ed25519-v1';

export const zkpTokenSchema = z
  .object({
    v: z.literal(1),
    typ: z.literal(ZKP_TOKEN_TYPE),
    did: z.string().min(1).max(200),
    scope: z.string().min(1).max(64),
    attrCommitment: z.string().regex(/^[0-9a-f]{64}$/),
    R: z.string().regex(/^[0-9a-f]{64}$/),
    s: z.string().regex(/^[0-9a-f]{64}$/),
    iat: z.number().int(),
    nonce: z.string().uuid(),
    req: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type ZkpToken = z.infer<typeof zkpTokenSchema>;

export type ZkpClaims = {
  did: string;
  scope: string;
  attrCommitment: string;
  iat: number;
  nonce: string;
  req: string;
};

export function proofMessage(claims: ZkpClaims): Uint8Array {
  return utf8(
    canonicalize({
      v: 1,
      typ: ZKP_TOKEN_TYPE,
      did: claims.did,
      scope: claims.scope,
      attrCommitment: claims.attrCommitment,
      iat: claims.iat,
      nonce: claims.nonce,
      req: claims.req,
    }),
  );
}

export function issueZkpToken(claims: ZkpClaims, scalar: bigint): ZkpToken {
  const proof = schnorrProve(scalar, proofMessage(claims));
  return {
    v: 1,
    typ: ZKP_TOKEN_TYPE,
    did: claims.did,
    scope: claims.scope,
    attrCommitment: claims.attrCommitment,
    iat: claims.iat,
    nonce: claims.nonce,
    req: claims.req,
    R: Buffer.from(proof.R).toString('hex'),
    s: Buffer.from(proof.s).toString('hex'),
  };
}

export function verifyZkpToken(token: ZkpToken, publicKey: Uint8Array): boolean {
  return schnorrVerify(publicKey, proofMessage(token), {
    R: Buffer.from(token.R, 'hex'),
    s: Buffer.from(token.s, 'hex'),
  });
}

export function commitAttributes(attributes: Record<string, string>, blinding: Uint8Array): string {
  if (blinding.length !== 32) throw new Error('blinding_length');
  const encoded = utf8(canonicalize(attributes));
  const material = new Uint8Array(encoded.length + blinding.length);
  material.set(encoded, 0);
  material.set(blinding, encoded.length);
  return sha256Hex(material);
}
