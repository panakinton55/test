export const GATEWAY_VERSION = "0.1.0";

export const SENSITIVE_CATEGORIES = [
  "email",
  "phone_number",
  "credit_card",
  "jwt",
  "bearer_token",
  "aws_access_key",
  "private_key",
  "address",
  "my_number",
  "custom",
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];
export type PolicyAction = "allow" | "mask" | "redact" | "block";
export type AuditAction = "allow" | "mask" | "block";
export type PlanName = "starter" | "business" | "enterprise";

export const DEFAULT_ACTIONS: Record<SensitiveCategory, PolicyAction> = {
  email: "mask",
  phone_number: "mask",
  address: "mask",
  credit_card: "block",
  private_key: "block",
  jwt: "block",
  bearer_token: "block",
  aws_access_key: "block",
  my_number: "block",
  custom: "block",
};

export const PLAN_LIMITS: Record<PlanName, { rateLimit: number; rateWindowSeconds: number; maxRequestBytes: number }> = {
  starter: { rateLimit: 60, rateWindowSeconds: 60, maxRequestBytes: 512 * 1024 },
  business: { rateLimit: 600, rateWindowSeconds: 60, maxRequestBytes: 1024 * 1024 },
  enterprise: { rateLimit: 3000, rateWindowSeconds: 60, maxRequestBytes: 5 * 1024 * 1024 },
};

export const BLOCKED_MESSAGE = "Request blocked by security policy.";

export type MaskingRule = {
  category: SensitiveCategory;
  action: PolicyAction;
  pattern?: string;
  keyword?: string;
};

export type TenantRecord = {
  id: string;
  companyName: string;
  adminEmail: string;
  plan: PlanName;
  createdAt: Date;
};

export type ApiKeyRecord = {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  prefix: string;
  createdAt: Date;
  revokedAt: Date | null;
};

export type AgentRecord = {
  id: string;
  tenantId: string;
  externalAgentId: string;
  createdAt: Date;
};

export type PolicyRecord = {
  id: string;
  tenantId: string;
  agentExternalId: string | null;
  policyName: string;
  version: number;
  allowedDomains: string[];
  blockedPatterns: string[];
  maskingRules: MaskingRule[];
  maxRequestBytes: number;
  rateLimit: number;
  rateWindowSeconds: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeDetection = {
  category: string;
  action: PolicyAction;
  field: string;
  offset: number;
  length: number;
  fingerprint: string;
};

export type AuditLogRecord = {
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
  detectionResults: SafeDetection[];
  action: AuditAction;
  reasonCode: string | null;
  latencyMs: number;
  policyVersion: number | null;
  gatewayVersion: string;
};

export type IdentityKeyRecord = {
  id: string;
  tenantId: string;
  agentExternalId: string;
  subjectId: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
};

export type Modification = {
  type: "mask" | "redact";
  category: string;
  count: number;
};

export type Finding = {
  category: SensitiveCategory;
  start: number;
  end: number;
  value: string;
  ruleId?: string;
};

export type CustomDetectorRule = {
  ruleId: string;
  keyword?: string;
  pattern?: string;
};

export type AuditCursor = {
  timestamp: Date;
  id: string;
};

export type AuditListQuery = {
  tenantId: string;
  from?: Date;
  to?: Date;
  action?: AuditAction;
  reasonCode?: string;
  limit: number;
  cursor?: AuditCursor;
};
