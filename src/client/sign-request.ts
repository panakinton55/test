import { base64url, type KeyLike } from 'jose';
import { randomUUID } from 'node:crypto';
import { canonicalRequest, hashBody } from '../lib/canonical.js';
import { sha256Hex, utf8 } from '../lib/encoding.js';
import { signDetached } from '../did/jws.js';
import type { DispatchBody } from '../guard/schema.js';
import { issueZkpToken } from '../zkp/token.js';

export type SigningMaterial = {
  did: string;
  privateKey: KeyLike;
  zkpScalar: bigint;
  attrCommitment: string;
};

export type SignedDispatch = {
  rawBody: string;
  headers: Record<string, string>;
  canonical: string;
  canonicalHash: string;
};

export async function buildSignedDispatch(input: {
  identity: SigningMaterial;
  body: DispatchBody;
  scope: string;
  timestampSec?: number;
  nonce?: string;
  rawBody?: string;
}): Promise<SignedDispatch> {
  const timestampSec = input.timestampSec ?? Math.floor(Date.now() / 1000);
  const nonce = input.nonce ?? randomUUID();
  const rawBody = input.rawBody ?? JSON.stringify({
    requestId: input.body.requestId,
    destination: input.body.destination,
    prompt: input.body.prompt,
    parameters: input.body.parameters,
    ...(input.body.metadata ? { metadata: input.body.metadata } : {}),
  });
  const canonical = canonicalRequest({
    timestamp: String(timestampSec),
    nonce,
    bodyHash: hashBody(rawBody),
  });
  const canonicalHash = sha256Hex(canonical);
  const signature = await signDetached(input.identity.privateKey, input.identity.did, canonical);
  const token = issueZkpToken(
    {
      did: input.identity.did,
      scope: input.scope,
      attrCommitment: input.identity.attrCommitment,
      iat: timestampSec,
      nonce,
      req: canonicalHash,
    },
    input.identity.zkpScalar,
  );
  return {
    rawBody,
    canonical,
    canonicalHash,
    headers: {
      'content-type': 'application/json',
      'x-did': input.identity.did,
      'x-did-signature': signature,
      'x-zkp-token': base64url.encode(utf8(JSON.stringify(token))),
      'x-nonce': nonce,
      'x-timestamp': String(timestampSec),
    },
  };
}
