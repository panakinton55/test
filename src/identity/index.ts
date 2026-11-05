import type { DataStore } from "../db/store.js";
import type { GatewayProofClaims, IssueGatewayProofInput } from "./credentialService.js";
import { createKeyStore } from "./keyStore.js";
import { createClaims, ProofError, signProof, verifyProof } from "./proofService.js";
import type { ReplayStore } from "./replayStore.js";

export type InternalIdentity = {
  issueGatewayProof(input: IssueGatewayProofInput): Promise<string>;
  verifyGatewayProof(proof: string): Promise<GatewayProofClaims>;
};

export type { GatewayProofClaims, IssueGatewayProofInput };

export function createInternalIdentity(deps: {
  store: DataStore;
  replay: ReplayStore;
  ttlSeconds: number;
  now?: () => Date;
}): InternalIdentity {
  if (deps.ttlSeconds < 1 || deps.ttlSeconds > 300) {
    throw new Error("proof ttl must be between 1 and 300 seconds");
  }
  const keys = createKeyStore(deps.store);
  const now = deps.now ?? (() => new Date());
  return {
    async issueGatewayProof(input) {
      await keys.getOrCreateTenantKey(input.tenantId);
      const agentKey = await keys.getOrCreateAgentKey(input.tenantId, input.agentId);
      const claims = createClaims(input, now(), deps.ttlSeconds);
      const proof = signProof(agentKey, claims);
      try {
        await deps.replay.issue(claims.request_id, deps.ttlSeconds);
      } catch {
        throw new ProofError("replay");
      }
      return proof;
    },
    verifyGatewayProof(proof) {
      return verifyProof(proof, keys, deps.replay, now());
    },
  };
}
