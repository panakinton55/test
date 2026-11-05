import { AuditAction, Plan, PrismaClient, type Prisma } from "@prisma/client";
import { z } from "zod";
import { SENSITIVE_CATEGORIES, type AuditLogRecord, type IdentityKeyRecord, type PlanName, type PolicyRecord, type SafeDetection, type TenantRecord } from "../domain.js";
import { createId } from "../utils/ids.js";
import { pageAuditLogs, selectPolicies, type DataStore } from "./store.js";

const maskingRuleStored = z.object({
  category: z.enum(SENSITIVE_CATEGORIES),
  action: z.enum(["allow", "mask", "redact", "block"]),
  pattern: z.string().optional(),
  keyword: z.string().optional(),
});

const safeDetectionStored = z.object({
  category: z.string(),
  action: z.enum(["allow", "mask", "redact", "block"]),
  field: z.string(),
  offset: z.number(),
  length: z.number(),
  fingerprint: z.string(),
});

export function createPrismaStore(client: PrismaClient): DataStore {
  return {
    async createTenant(input) {
      const row = await client.tenant.create({
        data: {
          id: input.id,
          companyName: input.companyName,
          adminEmail: input.adminEmail,
          plan: input.plan as Plan,
          createdAt: input.createdAt,
        },
      });
      return mapTenant(row);
    },
    async findTenant(id) {
      const row = await client.tenant.findUnique({ where: { id } });
      return row ? mapTenant(row) : null;
    },
    async createApiKey(input) {
      const row = await client.apiKey.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          name: input.name,
          keyHash: input.keyHash,
          prefix: input.prefix,
          createdAt: input.createdAt,
          revokedAt: input.revokedAt,
        },
      });
      return {
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        keyHash: row.keyHash,
        prefix: row.prefix,
        createdAt: row.createdAt,
        revokedAt: row.revokedAt,
      };
    },
    async findApiKeyByHash(hash) {
      const row = await client.apiKey.findUnique({ where: { keyHash: hash }, include: { tenant: true } });
      if (!row) return null;
      return {
        apiKey: {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          keyHash: row.keyHash,
          prefix: row.prefix,
          createdAt: row.createdAt,
          revokedAt: row.revokedAt,
        },
        tenant: mapTenant(row.tenant),
      };
    },
    async createPolicy(input) {
      return client.$transaction(async (tx) => {
        const latest = await tx.policy.findFirst({
          where: {
            tenantId: input.tenantId,
            policyName: input.policyName,
            agentExternalId: input.agentExternalId,
          },
          orderBy: { version: "desc" },
        });
        const now = new Date();
        const row = await tx.policy.create({
          data: {
            id: input.id,
            tenantId: input.tenantId,
            agentExternalId: input.agentExternalId,
            policyName: input.policyName,
            version: (latest?.version ?? 0) + 1,
            allowedDomains: input.allowedDomains as Prisma.InputJsonValue,
            blockedPatterns: input.blockedPatterns as Prisma.InputJsonValue,
            maskingRules: input.maskingRules as Prisma.InputJsonValue,
            maxRequestBytes: input.maxRequestBytes,
            rateLimit: input.rateLimit,
            rateWindowSeconds: input.rateWindowSeconds,
            createdAt: now,
            updatedAt: now,
          },
        });
        const mapped = mapPolicy(row);
        if (!mapped) throw new Error("policy could not be stored");
        return mapped;
      });
    },
    async findEffectivePolicy(tenantId, agentExternalId) {
      const rows = await client.policy.findMany({
        where: { tenantId, OR: [{ agentExternalId }, { agentExternalId: null }] },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        take: 50,
      });
      const mapped = rows.flatMap((row) => {
        const policy = mapPolicy(row);
        return policy ? [policy] : [];
      });
      return selectPolicies(mapped, tenantId, agentExternalId);
    },
    async createAuditLog(input) {
      const row = await client.auditLog.create({
        data: {
          id: input.id,
          requestId: input.requestId,
          tenantId: input.tenantId,
          agentId: input.agentId,
          policyId: input.policyId,
          timestamp: input.timestamp,
          sourceIpHash: input.sourceIpHash,
          destinationDomain: input.destinationDomain,
          httpMethod: input.httpMethod,
          requestSizeBytes: input.requestSizeBytes,
          detectionResults: input.detectionResults as Prisma.InputJsonValue,
          action: input.action as AuditAction,
          reasonCode: input.reasonCode,
          latencyMs: input.latencyMs,
          policyVersion: input.policyVersion,
          gatewayVersion: input.gatewayVersion,
        },
      });
      return mapAudit(row);
    },
    async listAuditLogs(query) {
      const where: Prisma.AuditLogWhereInput = {
        tenantId: query.tenantId,
        ...(query.action ? { action: query.action as AuditAction } : {}),
        ...(query.reasonCode ? { reasonCode: query.reasonCode } : {}),
        ...(query.from || query.to
          ? { timestamp: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
          : {}),
        ...(query.cursor
          ? {
              OR: [
                { timestamp: { lt: query.cursor.timestamp } },
                { timestamp: query.cursor.timestamp, id: { lt: query.cursor.id } },
              ],
            }
          : {}),
      };
      const rows = await client.auditLog.findMany({
        where,
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        take: query.limit + 1,
      });
      return pageAuditLogs(rows.map(mapAudit), { ...query, cursor: undefined });
    },
    async ensureAgent(tenantId, externalAgentId) {
      const row = await client.agent.upsert({
        where: { tenantId_externalAgentId: { tenantId, externalAgentId } },
        update: {},
        create: { id: createId("agt"), tenantId, externalAgentId },
      });
      return { id: row.id, tenantId: row.tenantId, externalAgentId: row.externalAgentId, createdAt: row.createdAt };
    },
    async findIdentityKey(tenantId, agentExternalId) {
      const row = await client.identityKey.findUnique({
        where: { tenantId_agentExternalId: { tenantId, agentExternalId } },
      });
      return row ? mapIdentity(row) : null;
    },
    async findIdentityKeyBySubject(subjectId) {
      const row = await client.identityKey.findUnique({ where: { subjectId } });
      return row ? mapIdentity(row) : null;
    },
    async insertIdentityKey(input) {
      const row = await client.identityKey.upsert({
        where: { tenantId_agentExternalId: { tenantId: input.tenantId, agentExternalId: input.agentExternalId } },
        update: {},
        create: {
          id: input.id,
          tenantId: input.tenantId,
          agentExternalId: input.agentExternalId,
          subjectId: input.subjectId,
          publicKey: input.publicKey,
          privateKey: input.privateKey,
          createdAt: input.createdAt,
        },
      });
      return mapIdentity(row);
    },
  };
}

function mapTenant(row: { id: string; companyName: string; adminEmail: string; plan: Plan; createdAt: Date }): TenantRecord {
  return {
    id: row.id,
    companyName: row.companyName,
    adminEmail: row.adminEmail,
    plan: row.plan as PlanName,
    createdAt: row.createdAt,
  };
}

function mapPolicy(row: {
  id: string;
  tenantId: string;
  agentExternalId: string | null;
  policyName: string;
  version: number;
  allowedDomains: Prisma.JsonValue;
  blockedPatterns: Prisma.JsonValue;
  maskingRules: Prisma.JsonValue;
  maxRequestBytes: number;
  rateLimit: number;
  rateWindowSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}): PolicyRecord | null {
  const allowedDomains = z.array(z.string()).safeParse(row.allowedDomains);
  const blockedPatterns = z.array(z.string()).safeParse(row.blockedPatterns);
  const maskingRules = z.array(maskingRuleStored).safeParse(row.maskingRules);
  if (!allowedDomains.success || !blockedPatterns.success || !maskingRules.success) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    agentExternalId: row.agentExternalId,
    policyName: row.policyName,
    version: row.version,
    allowedDomains: allowedDomains.data,
    blockedPatterns: blockedPatterns.data,
    maskingRules: maskingRules.data,
    maxRequestBytes: row.maxRequestBytes,
    rateLimit: row.rateLimit,
    rateWindowSeconds: row.rateWindowSeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAudit(row: {
  id: string;
  requestId: string;
  tenantId: string;
  agentId: string;
  policyId: string | null;
  timestamp: Date;
  sourceIpHash: string;
  destinationDomain: string;
  httpMethod: string;
  requestSizeBytes: number;
  detectionResults: Prisma.JsonValue;
  action: AuditAction;
  reasonCode: string | null;
  latencyMs: number;
  policyVersion: number | null;
  gatewayVersion: string;
}): AuditLogRecord {
  const detections = z.array(safeDetectionStored).safeParse(row.detectionResults);
  return {
    id: row.id,
    requestId: row.requestId,
    tenantId: row.tenantId,
    agentId: row.agentId,
    policyId: row.policyId,
    timestamp: row.timestamp,
    sourceIpHash: row.sourceIpHash,
    destinationDomain: row.destinationDomain,
    httpMethod: row.httpMethod,
    requestSizeBytes: row.requestSizeBytes,
    detectionResults: detections.success ? (detections.data as SafeDetection[]) : [],
    action: row.action,
    reasonCode: row.reasonCode,
    latencyMs: row.latencyMs,
    policyVersion: row.policyVersion,
    gatewayVersion: row.gatewayVersion,
  };
}

function mapIdentity(row: {
  id: string;
  tenantId: string;
  agentExternalId: string;
  subjectId: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
}): IdentityKeyRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    agentExternalId: row.agentExternalId,
    subjectId: row.subjectId,
    publicKey: row.publicKey,
    privateKey: row.privateKey,
    createdAt: row.createdAt,
  };
}
