import { z } from 'zod';
import { canonicalRequest, hashBody } from '../lib/canonical.js';
import { sha256Hex } from '../lib/encoding.js';
import { decodeDidKey, samePublicKey } from '../did/did-key.js';
import { verifyDetached } from '../did/jws.js';
import type { AgentRegistry, RegisteredAgent } from '../registry/registry.js';
import { NonceStore } from './nonce-store.js';

const uuidSchema = z.string().uuid();

export type AuthenticatedRequest = {
  did: string;
  agent: RegisteredAgent;
  canonical: string;
  canonicalHash: string;
  timestamp: number;
  nonce: string;
  tokenHeader: string;
};

export type AuthFailure = {
  ok: false;
  code: 'header_missing' | 'timestamp_invalid' | 'did_malformed' | 'did_unknown' | 'signature_invalid' | 'nonce_invalid' | 'replay';
  did: string | null;
};

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const value = headers[name];
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

export function readableDid(value: string | undefined): string | null {
  if (!value || value.length > 200) return null;
  try {
    decodeDidKey(value);
    return value;
  } catch {
    return null;
  }
}

export async function authenticateRequest(input: {
  headers: Record<string, string | undefined>;
  rawBody: string;
  nowMs: number;
  clockSkewSec: number;
  nonceTtlMs: number;
  registry: AgentRegistry;
  nonces: NonceStore;
}): Promise<{ ok: true; value: AuthenticatedRequest } | AuthFailure> {
  const contentType = header(input.headers, 'content-type');
  const did = header(input.headers, 'x-did');
  const signature = header(input.headers, 'x-did-signature');
  const tokenHeader = header(input.headers, 'x-zkp-token');
  const nonce = header(input.headers, 'x-nonce');
  const timestampHeader = header(input.headers, 'x-timestamp');
  const knownDid = readableDid(did);

  if (!contentType || !did || !signature || !tokenHeader || !nonce || !timestampHeader) {
    return { ok: false, code: 'header_missing', did: knownDid };
  }
  if (signature.length > 4096 || tokenHeader.length > 8192) {
    return { ok: false, code: 'header_missing', did: knownDid };
  }
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return { ok: false, code: 'header_missing', did: knownDid };
  }
  if (!uuidSchema.safeParse(nonce).success) {
    return { ok: false, code: 'nonce_invalid', did: knownDid };
  }
  if (!/^\d{10}$/.test(timestampHeader)) {
    return { ok: false, code: 'timestamp_invalid', did: knownDid };
  }
  const timestamp = Number(timestampHeader);
  const nowSec = Math.floor(input.nowMs / 1000);
  if (Math.abs(nowSec - timestamp) > input.clockSkewSec) {
    return { ok: false, code: 'timestamp_invalid', did: knownDid };
  }

  let publicKey: Uint8Array;
  try {
    publicKey = decodeDidKey(did);
  } catch {
    return { ok: false, code: 'did_malformed', did: null };
  }
  const agent = input.registry.get(did);
  if (!agent) return { ok: false, code: 'did_unknown', did };

  const canonical = canonicalRequest({
    timestamp: timestampHeader,
    nonce,
    bodyHash: hashBody(input.rawBody),
  });
  const valid = await verifyDetached({
    did,
    publicKey,
    canonical,
    detached: signature,
  });
  if (!valid || !samePublicKey(agent.publicKey, publicKey)) {
    return { ok: false, code: 'signature_invalid', did };
  }

  const accepted = input.nonces.put(`${did}:${nonce}`, input.nowMs + input.nonceTtlMs, input.nowMs);
  if (!accepted) return { ok: false, code: 'replay', did };

  return {
    ok: true,
    value: {
      did,
      agent,
      canonical,
      canonicalHash: sha256Hex(canonical),
      timestamp,
      nonce,
      tokenHeader,
    },
  };
}
