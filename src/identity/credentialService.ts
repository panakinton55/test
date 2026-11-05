export type GatewayProofClaims = {
  tenant_id: string;
  agent_id: string;
  policy_id: string;
  request_id: string;
  issued_at: string;
  expires_at: string;
  allowed_scope: string[];
};

export type IssueGatewayProofInput = {
  tenantId: string;
  agentId: string;
  policyId: string;
  requestId: string;
  allowedScope: string[];
};

const MAX_TTL_MS = 300_000;
const FUTURE_SKEW_MS = 30_000;

export function buildClaims(input: IssueGatewayProofInput, now: Date, ttlSeconds: number): GatewayProofClaims {
  const expires = new Date(now.getTime() + ttlSeconds * 1000);
  return {
    tenant_id: input.tenantId,
    agent_id: input.agentId,
    policy_id: input.policyId,
    request_id: input.requestId,
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
    allowed_scope: [...input.allowedScope],
  };
}

export function assertClaims(value: unknown, now: Date): GatewayProofClaims {
  if (!value || typeof value !== "object") throw new Error("invalid claims");
  const claims = value as Partial<GatewayProofClaims>;
  if (!isId(claims.tenant_id) || !isId(claims.agent_id) || !isId(claims.policy_id) || !isId(claims.request_id)) {
    throw new Error("invalid claims");
  }
  if (!Array.isArray(claims.allowed_scope) || claims.allowed_scope.some((item) => typeof item !== "string")) {
    throw new Error("invalid claims");
  }
  const issued = new Date(claims.issued_at ?? "");
  const expires = new Date(claims.expires_at ?? "");
  if (Number.isNaN(issued.getTime()) || Number.isNaN(expires.getTime())) throw new Error("invalid claims");
  if (expires.getTime() - issued.getTime() > MAX_TTL_MS || expires.getTime() <= issued.getTime()) throw new Error("invalid claims");
  if (issued.getTime() > now.getTime() + FUTURE_SKEW_MS) throw new Error("invalid claims");
  if (expires.getTime() <= now.getTime()) throw new Error("expired claims");
  return {
    tenant_id: claims.tenant_id,
    agent_id: claims.agent_id,
    policy_id: claims.policy_id,
    request_id: claims.request_id,
    issued_at: issued.toISOString(),
    expires_at: expires.toISOString(),
    allowed_scope: claims.allowed_scope,
  };
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}
