import { z } from "zod";
import { SENSITIVE_CATEGORIES } from "../domain.js";
import { isUnsafeRegex } from "../utils/regexSafety.js";

export const planSchema = z.enum(["starter", "business", "enterprise"]);

export const tenantCreateSchema = z.object({
  company_name: z.string().trim().min(1).max(120),
  admin_email: z.string().trim().email().max(254),
  plan: planSchema,
});

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);

export const maskingRuleSchema = z
  .object({
    category: z.enum(SENSITIVE_CATEGORIES),
    action: z.enum(["allow", "mask", "redact", "block"]),
    pattern: z.string().min(1).max(128).optional(),
    keyword: z.string().min(1).max(128).optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.category === "custom" && !rule.pattern && !rule.keyword) {
      ctx.addIssue({ code: "custom", path: ["pattern"] });
    }
    if (rule.pattern && isUnsafeRegex(rule.pattern)) {
      ctx.addIssue({ code: "custom", path: ["pattern"] });
    }
  });

const rateLimitSchema = z.union([
  z.number().int().positive().max(10_000),
  z.object({
    limit: z.number().int().positive().max(10_000),
    window_seconds: z.number().int().positive().max(3600),
  }),
]);

export const policyCreateSchema = z.object({
  policy_name: z.string().trim().min(1).max(80),
  allowed_domains: z.array(domainSchema).min(1).max(50),
  blocked_patterns: z.array(z.string().trim().min(1).max(128)).max(100).default([]),
  masking_rules: z.array(maskingRuleSchema).max(50).default([]),
  max_request_bytes: z.number().int().positive().max(5 * 1024 * 1024).default(1_048_576),
  rate_limit: rateLimitSchema.default(60),
  agent_id: z
    .string()
    .regex(/^[A-Za-z0-9._:-]{1,128}$/)
    .nullable()
    .optional(),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  tenant_id: z.string().trim().min(1).max(80).optional(),
});

export const proxyRequestSchema = z.object({
  agent_id: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
  destination: z.string().url().max(2048),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z.record(z.string().max(8192)).optional(),
  body: z.unknown().optional(),
}).superRefine((value, ctx) => {
  const headerCount = Object.keys(value.headers ?? {}).length;
  if (headerCount > 40) {
    ctx.addIssue({ code: "custom", path: ["headers"] });
  }
});

const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

export const auditQuerySchema = z.object({
  from: isoTimestamp.optional(),
  to: isoTimestamp.optional(),
  action: z.enum(["allow", "mask", "block"]).optional(),
  reason_code: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

export function normalizeRateLimit(input: z.infer<typeof rateLimitSchema>): { limit: number; windowSeconds: number } {
  if (typeof input === "number") return { limit: input, windowSeconds: 60 };
  return { limit: input.limit, windowSeconds: input.window_seconds };
}
