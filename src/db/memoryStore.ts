import { createId } from "../utils/ids.js";
import type {
  AgentRecord,
  ApiKeyRecord,
  AuditLogRecord,
  IdentityKeyRecord,
  PolicyRecord,
  TenantRecord,
} from "../domain.js";
import { pageAuditLogs, selectPolicies, type DataStore } from "./store.js";

export function createMemoryStore(): DataStore {
  const tenants = new Map<string, TenantRecord>();
  const apiKeys = new Map<string, ApiKeyRecord>();
  const policies: PolicyRecord[] = [];
  const audits: AuditLogRecord[] = [];
  const agents: AgentRecord[] = [];
  const identityKeys: IdentityKeyRecord[] = [];

  return {
    async createTenant(input) {
      tenants.set(input.id, input);
      return input;
    },
    async findTenant(id) {
      return tenants.get(id) ?? null;
    },
    async createApiKey(input) {
      apiKeys.set(input.keyHash, input);
      return input;
    },
    async findApiKeyByHash(hash) {
      const apiKey = apiKeys.get(hash);
      if (!apiKey) return null;
      const tenant = tenants.get(apiKey.tenantId);
      if (!tenant) return null;
      return { apiKey, tenant };
    },
    async createPolicy(input) {
      const version = policies
        .filter((policy) => policy.tenantId === input.tenantId && policy.policyName === input.policyName && policy.agentExternalId === input.agentExternalId)
        .reduce((max, policy) => Math.max(max, policy.version), 0) + 1;
      const now = new Date();
      const record: PolicyRecord = { ...input, version, createdAt: now, updatedAt: now };
      policies.push(record);
      return record;
    },
    async findEffectivePolicy(tenantId, agentExternalId) {
      return selectPolicies(policies, tenantId, agentExternalId);
    },
    async createAuditLog(input) {
      audits.push(input);
      return input;
    },
    async listAuditLogs(query) {
      return pageAuditLogs(audits, query);
    },
    async ensureAgent(tenantId, externalAgentId) {
      const found = agents.find((agent) => agent.tenantId === tenantId && agent.externalAgentId === externalAgentId);
      if (found) return found;
      const created: AgentRecord = { id: createId("agt"), tenantId, externalAgentId, createdAt: new Date() };
      agents.push(created);
      return created;
    },
    async findIdentityKey(tenantId, agentExternalId) {
      return identityKeys.find((key) => key.tenantId === tenantId && key.agentExternalId === agentExternalId) ?? null;
    },
    async findIdentityKeyBySubject(subjectId) {
      return identityKeys.find((key) => key.subjectId === subjectId) ?? null;
    },
    async insertIdentityKey(input) {
      const existing = identityKeys.find((key) => key.tenantId === input.tenantId && key.agentExternalId === input.agentExternalId);
      if (existing) return existing;
      identityKeys.push(input);
      return input;
    },
  };
}
