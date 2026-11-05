import type { Hono } from "hono";
import type { AppDependencies, AppEnv } from "../deps.js";
import { requireApiKey } from "../middleware/auth.js";
import { normalizeRateLimit, policyCreateSchema } from "../openapi/schemas.js";
import { parseBody } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { readJson } from "../utils/readJson.js";

export function registerPolicyRoutes(app: Hono<AppEnv>, deps: AppDependencies): void {
  app.post("/v1/policies", async (c) => {
    const auth = await requireApiKey(c, deps.store);
    const body = parseBody(policyCreateSchema, await readJson(c));
    const rate = normalizeRateLimit(body.rate_limit);
    const policy = await deps.store.createPolicy({
      id: createId("pol"),
      tenantId: auth.tenant.id,
      agentExternalId: body.agent_id ?? null,
      policyName: body.policy_name,
      allowedDomains: body.allowed_domains,
      blockedPatterns: body.blocked_patterns,
      maskingRules: body.masking_rules.map((rule) => ({
        category: rule.category,
        action: rule.action,
        ...(rule.pattern ? { pattern: rule.pattern } : {}),
        ...(rule.keyword ? { keyword: rule.keyword } : {}),
      })),
      maxRequestBytes: body.max_request_bytes,
      rateLimit: rate.limit,
      rateWindowSeconds: rate.windowSeconds,
    });
    return c.json(
      {
        policy_id: policy.id,
        policy_name: policy.policyName,
        allowed_domains: policy.allowedDomains,
        blocked_patterns: policy.blockedPatterns,
        masking_rules: policy.maskingRules,
        max_request_bytes: policy.maxRequestBytes,
        rate_limit: { limit: policy.rateLimit, window_seconds: policy.rateWindowSeconds },
        agent_id: policy.agentExternalId,
        policy_version: policy.version,
        created_at: policy.createdAt.toISOString(),
      },
      201,
    );
  });
}
