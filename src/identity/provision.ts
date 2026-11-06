import { generateKeyPair, type KeyLike } from 'jose';
import { randomBytes } from 'node:crypto';
import { encodeDidKey } from '../did/did-key.js';
import { rawEd25519PublicKey } from '../did/jws.js';
import { publicFromScalar, randomZkpScalar } from '../zkp/proof.js';
import { commitAttributes } from '../zkp/token.js';
import type { RegisteredAgent } from '../registry/registry.js';

export type AgentIdentity = {
  did: string;
  privateKey: KeyLike;
  publicKey: Uint8Array;
  zkpScalar: bigint;
  zkpPublic: Uint8Array;
  blinding: Uint8Array;
  hiddenAttributes: Record<string, string>;
  attrCommitment: string;
  scopes: string[];
};

export async function provisionAgent(
  scopes: string[],
  hiddenAttributes: Record<string, string> = { assurance: 'high', region: 'ap-northeast-1' },
): Promise<AgentIdentity> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  const raw = await rawEd25519PublicKey(publicKey);
  const zkpScalar = randomZkpScalar();
  const blinding = randomBytes(32);
  return {
    did: encodeDidKey(raw),
    privateKey,
    publicKey: raw,
    zkpScalar,
    zkpPublic: publicFromScalar(zkpScalar),
    blinding,
    hiddenAttributes,
    attrCommitment: commitAttributes(hiddenAttributes, blinding),
    scopes,
  };
}

export function publicRecord(identity: AgentIdentity): RegisteredAgent {
  return {
    did: identity.did,
    publicKey: identity.publicKey,
    zkpPublic: identity.zkpPublic,
    attrCommitment: identity.attrCommitment,
    scopes: identity.scopes,
  };
}
