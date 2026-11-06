import { decodeDidKey, samePublicKey } from '../did/did-key.js';
import { assertZkpPublicKey } from '../zkp/proof.js';

export type RegisteredAgent = {
  did: string;
  publicKey: Uint8Array;
  zkpPublic: Uint8Array;
  attrCommitment: string;
  scopes: readonly string[];
};

export class AgentRegistry {
  private readonly agents = new Map<string, RegisteredAgent>();

  add(agent: RegisteredAgent): void {
    if (!/^[0-9a-f]{64}$/.test(agent.attrCommitment)) throw new Error('commitment');
    if (agent.scopes.length === 0 || agent.scopes.some((scope) => !/^[a-z0-9._-]{1,64}$/.test(scope))) {
      throw new Error('scopes');
    }
    const derived = decodeDidKey(agent.did);
    if (!samePublicKey(derived, agent.publicKey)) throw new Error('did_mismatch');
    assertZkpPublicKey(agent.zkpPublic);
    this.agents.set(agent.did, {
      did: agent.did,
      publicKey: new Uint8Array(agent.publicKey),
      zkpPublic: new Uint8Array(agent.zkpPublic),
      attrCommitment: agent.attrCommitment,
      scopes: [...agent.scopes],
    });
  }

  get(did: string): RegisteredAgent | undefined {
    return this.agents.get(did);
  }
}
