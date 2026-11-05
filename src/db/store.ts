import type {
  AgentRecord,
  ApiKeyRecord,
  AuditCursor,
  AuditListQuery,
  AuditLogRecord,
  IdentityKeyRecord,
  PolicyRecord,
  TenantRecord,
} from "../domain.js";

export type DataStore = {
  createTenant(input: TenantRecord): Promise<TenantRecord>;
  findTenant(id: string): Promise<TenantRecord | null>;
  createApiKey(input: ApiKeyRecord): Promise<ApiKeyRecord>;
  findApiKeyByHash(hash: string): Promise<{ apiKey: ApiKeyRecord; tenant: TenantRecord } | null>;
  createPolicy(input: Omit<PolicyRecord, "version" | "createdAt" | "updatedAt">): Promise<PolicyRecord>;
  findEffectivePolicy(tenantId: string, agentExternalId: string): Promise<PolicyRecord | null>;
  createAuditLog(input: AuditLogRecord): Promise<AuditLogRecord>;
  listAuditLogs(query: AuditListQuery): Promise<{ items: AuditLogRecord[]; nextCursor: AuditCursor | null }>;
  ensureAgent(tenantId: string, externalAgentId: string): Promise<AgentRecord>;
  findIdentityKey(tenantId: string, agentExternalId: string): Promise<IdentityKeyRecord | null>;
  findIdentityKeyBySubject(subjectId: string): Promise<IdentityKeyRecord | null>;
  insertIdentityKey(input: IdentityKeyRecord): Promise<IdentityKeyRecord>;
};

export function selectPolicies(policies: PolicyRecord[], tenantId: string, agentExternalId: string): PolicyRecord | null {
  const owned = policies.filter((policy) => policy.tenantId === tenantId);
  const specific = owned.filter((policy) => policy.agentExternalId === agentExternalId);
  const pool = specific.length > 0 ? specific : owned.filter((policy) => policy.agentExternalId === null);
  pool.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.version - left.version);
  return pool[0] ?? null;
}

export function pageAuditLogs(rows: AuditLogRecord[], query: AuditListQuery): { items: AuditLogRecord[]; nextCursor: AuditCursor | null } {
  let filtered = rows.filter((row) => row.tenantId === query.tenantId);
  if (query.action) filtered = filtered.filter((row) => row.action === query.action);
  if (query.reasonCode) filtered = filtered.filter((row) => row.reasonCode === query.reasonCode);
  if (query.from) {
    const from = query.from;
    filtered = filtered.filter((row) => row.timestamp >= from);
  }
  if (query.to) {
    const to = query.to;
    filtered = filtered.filter((row) => row.timestamp <= to);
  }
  filtered.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime() || (left.id < right.id ? 1 : left.id > right.id ? -1 : 0));
  if (query.cursor) {
    const cursor = query.cursor;
    filtered = filtered.filter((row) => row.timestamp < cursor.timestamp || (row.timestamp.getTime() === cursor.timestamp.getTime() && row.id < cursor.id));
  }
  const items = filtered.slice(0, query.limit);
  const last = items.at(-1);
  const nextCursor = filtered.length > query.limit && last ? { timestamp: last.timestamp, id: last.id } : null;
  return { items, nextCursor };
}
