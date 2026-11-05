import { describe, expect, it } from "vitest";
import { evaluateRequest, sanitizeUpstreamBody } from "../src/core/policyEngine.js";
import type { PolicyRecord } from "../src/domain.js";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature12";

function policy(overrides: Partial<PolicyRecord> = {}): PolicyRecord {
  return {
    id: "pol_test",
    tenantId: "ten_test",
    agentExternalId: null,
    policyName: "default",
    version: 1,
    allowedDomains: ["api.example.com"],
    blockedPatterns: [],
    maskingRules: [],
    maxRequestBytes: 100_000,
    rateLimit: 60,
    rateWindowSeconds: 60,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const base = {
  salt: "test-ip-hash-salt-012345",
  tenantId: "ten_test",
  allowInsecureUpstream: false,
};

describe("policy engine", () => {
  it("masks an email and keeps the raw value out of the decision", () => {
    const decision = evaluateRequest({
      ...base,
      policy: policy(),
      destination: "https://api.example.com/v1/chat",
      headers: {},
      body: { prompt: "連絡先は taro@example.com です" },
    });
    expect(decision.blocked).toBe(false);
    expect(decision.auditAction).toBe("mask");
    expect(decision.modifications).toEqual([{ type: "mask", category: "email", count: 1 }]);
    expect(JSON.stringify(decision.sanitized.body)).toContain("ta***@example.com");
    expect(JSON.stringify(decision)).not.toContain("taro@example.com");
  });

  it("blocks a token in the prompt and forwards an upstream authorization header", () => {
    const allowed = evaluateRequest({
      ...base,
      policy: policy(),
      destination: "https://api.example.com/v1/chat",
      headers: { Authorization: "Bearer sk-upstream-credential-value-1234" },
      body: { prompt: "hello" },
    });
    expect(allowed.blocked).toBe(false);
    expect(allowed.sanitized.headers.Authorization).toBe("Bearer sk-upstream-credential-value-1234");

    const blocked = evaluateRequest({
      ...base,
      policy: policy(),
      destination: "https://api.example.com/v1/chat",
      headers: {},
      body: { prompt: JWT },
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.reasonCode).toBe("SENSITIVE_DATA_DETECTED");
    expect(blocked.details).toEqual(expect.arrayContaining([{ category: "jwt", action: "block" }]));
    expect(JSON.stringify(blocked)).not.toContain(JWT);
    expect(blocked.sanitized.body).toBeNull();
  });

  it("honors a custom keyword and an email override", () => {
    const keyword = evaluateRequest({
      ...base,
      policy: policy({ blockedPatterns: ["社外秘"] }),
      destination: "https://api.example.com/v1",
      headers: {},
      body: { prompt: "これは社外秘です" },
    });
    expect(keyword.reasonCode).toBe("SENSITIVE_DATA_DETECTED");
    expect(keyword.details).toEqual(expect.arrayContaining([{ category: "custom", action: "block" }]));

    const override = evaluateRequest({
      ...base,
      policy: policy({ maskingRules: [{ category: "email", action: "block" }] }),
      destination: "https://api.example.com/v1",
      headers: {},
      body: { prompt: "taro@example.com" },
    });
    expect(override.blocked).toBe(true);
  });

  it("rejects destinations outside the allow list and unsafe hosts", () => {
    expect(evaluateRequest({
      ...base,
      policy: policy(),
      destination: "https://evil.example/v1",
      headers: {},
      body: { prompt: "hello" },
    }).reasonCode).toBe("DOMAIN_NOT_ALLOWED");

    expect(evaluateRequest({
      ...base,
      policy: policy({ allowedDomains: ["localhost"] }),
      destination: "https://localhost/admin",
      headers: {},
      body: {},
    }).reasonCode).toBe("DESTINATION_BLOCKED");

    expect(evaluateRequest({
      ...base,
      policy: policy(),
      destination: "http://api.example.com/v1",
      headers: {},
      body: {},
    }).reasonCode).toBe("DESTINATION_BLOCKED");

    expect(evaluateRequest({
      ...base,
      policy: policy({ allowedDomains: ["169.254.169.254"] }),
      destination: "https://169.254.169.254/latest",
      headers: {},
      body: {},
    }).reasonCode).toBe("DESTINATION_BLOCKED");

    const wildcard = evaluateRequest({
      ...base,
      policy: policy({ allowedDomains: ["*.example.com"] }),
      destination: "https://api.example.com/v1",
      headers: {},
      body: { prompt: "hello" },
    });
    expect(wildcard.blocked).toBe(false);
  });

  it("redacts secrets echoed by an upstream response", () => {
    const scanned = sanitizeUpstreamBody(
      JSON.stringify({ note: "taro@example.com", token: JWT }),
      policy(),
      base.salt,
      base.tenantId,
    );
    const serialized = JSON.stringify(scanned.body);
    expect(serialized).toContain("ta***@example.com");
    expect(serialized).toContain("[REDACTED:JWT]");
    expect(serialized).not.toContain("taro@example.com");
    expect(serialized).not.toContain(JWT);
    expect(scanned.auditAction).toBe("mask");
  });
});
