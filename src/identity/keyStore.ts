import { createId } from "../utils/ids.js";
import type { DataStore } from "../db/store.js";
import type { IdentityKeyRecord } from "../domain.js";
import { generateEd25519, publicKeyToDidKey } from "./didService.js";

export type KeyStore = {
  getOrCreateTenantKey(tenantId: string): Promise<IdentityKeyRecord>;
  getOrCreateAgentKey(tenantId: string, agentExternalId: string): Promise<IdentityKeyRecord>;
  findBySubjectId(subjectId: string): Promise<IdentityKeyRecord | null>;
};

export function createKeyStore(store: DataStore): KeyStore {
  const inflight = new Map<string, Promise<IdentityKeyRecord>>();

  async function getOrCreate(tenantId: string, agentExternalId: string): Promise<IdentityKeyRecord> {
    const cacheKey = `${tenantId}:${agentExternalId}`;
    const existing = inflight.get(cacheKey);
    if (existing) return existing;
    const pending = createKey(store, tenantId, agentExternalId);
    inflight.set(cacheKey, pending);
    try {
      return await pending;
    } finally {
      inflight.delete(cacheKey);
    }
  }

  return {
    getOrCreateTenantKey: (tenantId) => getOrCreate(tenantId, ""),
    getOrCreateAgentKey: (tenantId, agentExternalId) => getOrCreate(tenantId, agentExternalId),
    findBySubjectId: (subjectId) => store.findIdentityKeyBySubject(subjectId),
  };
}

async function createKey(store: DataStore, tenantId: string, agentExternalId: string): Promise<IdentityKeyRecord> {
  const found = await store.findIdentityKey(tenantId, agentExternalId);
  if (found) return found;
  const pair = generateEd25519();
  return store.insertIdentityKey({
    id: createId("idk"),
    tenantId,
    agentExternalId,
    subjectId: publicKeyToDidKey(pair.publicKey),
    publicKey: pair.publicKey.toString("base64"),
    privateKey: pair.privateKey.toString("base64"),
    createdAt: new Date(),
  });
}
