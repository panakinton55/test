import { describe, expect, it } from "vitest";
import { hashApiKey } from "../src/utils/ids.js";
import { ADMIN_KEY, authHeaders, createTestApp, provision } from "./helpers.js";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature12";

describe("gateway API", () => {
  it("creates a tenant, stores only the API key hash, and proxies a masked request", async () => {
    const test = createTestApp();
    const { tenantResponse, keyResponse, tenant, key } = await provision(test.app);
    expect(tenantResponse.status).toBe(201);
    expect(keyResponse.status).toBe(201);
    expect(key.api_key.startsWith("ask_")).toBe(true);

    const stored = await test.store.findApiKeyByHash(hashApiKey(key.api_key));
    expect(stored?.apiKey.keyHash).toBe(hashApiKey(key.api_key));
    expect(JSON.stringify(stored)).not.toContain(key.api_key);

    const policyResponse = await test.app.request("/v1/policies", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({
        policy_name: "default-egress",
        allowed_domains: ["api.example.com"],
        rate_limit: 30,
      }),
    });
    expect(policyResponse.status).toBe(201);

    const proxyResponse = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({
        agent_id: "sales-bot",
        destination: "https://api.example.com/v1/chat",
        method: "POST",
        headers: { Authorization: "Bearer sk-upstream-credential-value-1234" },
        body: { prompt: "連絡先は taro@example.com です" },
      }),
    });
    const payload = await proxyResponse.json() as {
      request_id: string;
      status: string;
      modifications: { type: string; category: string; count: number }[];
      upstream: { body: unknown };
    };
    expect(proxyResponse.status).toBe(200);
    expect(payload.status).toBe("allowed");
    expect(payload.modifications).toEqual([{ type: "mask", category: "email", count: 1 }]);
    expect(JSON.stringify(test.calls[0]?.body)).toContain("ta***@example.com");
    expect(JSON.stringify(test.calls[0]?.body)).not.toContain("taro@example.com");
    expect(test.calls[0]?.headers.Authorization).toBe("Bearer sk-upstream-credential-value-1234");
    const responseText = JSON.stringify(payload);
    expect(responseText).not.toContain("taro@example.com");
    expect(responseText).not.toContain(key.api_key);
    expect(responseText).not.toContain(test.calls[0]?.proof ?? "missing-proof");
    expect(responseText).not.toContain("did:key");

    const claims = await test.identity.verifyGatewayProof(test.calls[0]?.proof ?? "");
    expect(claims.request_id).toBe(payload.request_id);
    expect(claims.tenant_id).toBe(tenant.tenant_id);
    expect(claims.agent_id).toBe("sales-bot");
    expect(claims.allowed_scope).toEqual(["api.example.com"]);

    const auditResponse = await test.app.request("/v1/audit-logs", { headers: authHeaders(key.api_key) });
    const audit = await auditResponse.json() as { data: { action: string; detection_results: { category: string }[] }[] };
    expect(audit.data[0]?.action).toBe("mask");
    expect(audit.data[0]?.detection_results[0]?.category).toBe("email");
    expect(JSON.stringify(audit)).not.toContain("taro@example.com");
  });

  it("blocks a JWT, alerts, and keeps the token out of the audit log", async () => {
    const test = createTestApp();
    const { key } = await provision(test.app);
    await test.app.request("/v1/policies", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({ policy_name: "default-egress", allowed_domains: ["api.example.com"] }),
    });
    const response = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({
        agent_id: "sales-bot",
        destination: "https://api.example.com/v1/chat",
        body: { prompt: JWT },
      }),
    });
    const payload = await response.json() as { status: string; reason_code: string; message: string; details: { category: string; action: string }[] };
    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      status: "blocked",
      reason_code: "SENSITIVE_DATA_DETECTED",
      message: "Request blocked by security policy.",
    });
    expect(payload.details).toEqual(expect.arrayContaining([{ category: "jwt", action: "block" }]));
    expect(JSON.stringify(payload)).not.toContain(JWT);
    expect(test.calls).toHaveLength(0);
    expect(test.alerts).toHaveLength(1);
    expect(test.alerts[0]?.reasonCode).toBe("SENSITIVE_DATA_DETECTED");

    const auditResponse = await test.app.request("/v1/audit-logs?action=block&reason_code=SENSITIVE_DATA_DETECTED", {
      headers: authHeaders(key.api_key),
    });
    const auditText = await auditResponse.text();
    expect(auditText).toContain("SENSITIVE_DATA_DETECTED");
    expect(auditText).not.toContain(JWT);
  });

  it("rejects a bad key, an unapproved domain, oversized calls, and other tenants' logs", async () => {
    const test = createTestApp();
    const first = await provision(test.app);
    const second = await provision(test.app);
    await test.app.request("/v1/policies", {
      method: "POST",
      headers: authHeaders(first.key.api_key),
      body: JSON.stringify({
        policy_name: "tight",
        allowed_domains: ["api.example.com"],
        max_request_bytes: 220,
        blocked_patterns: ["禁止語"],
      }),
    });

    const invalid = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders("ask_not-a-real-key"),
      body: JSON.stringify({ agent_id: "sales-bot", destination: "https://api.example.com" }),
    });
    const invalidText = await invalid.text();
    expect(invalid.status).toBe(401);
    expect(invalidText).not.toContain("ask_not-a-real-key");

    const domain = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders(first.key.api_key),
      body: JSON.stringify({ agent_id: "sales-bot", destination: "https://evil.example/v1", body: { prompt: "hello" } }),
    });
    expect(domain.status).toBe(403);
    expect(await domain.json()).toMatchObject({ reason_code: "DOMAIN_NOT_ALLOWED" });

    const oversized = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders(first.key.api_key),
      body: JSON.stringify({
        agent_id: "sales-bot",
        destination: "https://api.example.com/v1",
        body: { prompt: "x".repeat(400) },
      }),
    });
    expect(oversized.status).toBe(413);

    for (let index = 0; index < 3; index += 1) {
      const blocked = await test.app.request("/v1/gateway/proxy", {
        method: "POST",
        headers: authHeaders(first.key.api_key),
        body: JSON.stringify({
          agent_id: "sales-bot",
          destination: "https://api.example.com/v1",
          body: { prompt: "禁止語" },
        }),
      });
      expect(blocked.status).toBe(403);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await test.app.request(`/v1/audit-logs?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
        headers: authHeaders(first.key.api_key),
      });
      const body = await page.json() as { data: { request_id: string }[]; next_cursor: string | null };
      expect(body.data).toHaveLength(1);
      seen.push(body.data[0]?.request_id ?? "");
      cursor = body.next_cursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThanOrEqual(4);

    const isolated = await test.app.request("/v1/audit-logs", { headers: authHeaders(second.key.api_key) });
    const isolatedBody = await isolated.json() as { data: unknown[] };
    expect(isolatedBody.data).toEqual([]);

    const leaked = await test.app.request("/v1/tenants", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ company_name: "Acme", admin_email: "not-an-email", plan: "starter" }),
    });
    expect(leaked.status).toBe(400);
    expect(await leaked.text()).not.toContain("not-an-email");
  });

  it("enforces the policy rate limit and publishes OpenAPI without internal terms", async () => {
    const test = createTestApp();
    const { key } = await provision(test.app);
    await test.app.request("/v1/policies", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({ policy_name: "slow", allowed_domains: ["api.example.com"], rate_limit: 1 }),
    });
    const first = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({ agent_id: "sales-bot", destination: "https://api.example.com/v1", body: { prompt: "hello" } }),
    });
    const second = await test.app.request("/v1/gateway/proxy", {
      method: "POST",
      headers: authHeaders(key.api_key),
      body: JSON.stringify({ agent_id: "sales-bot", destination: "https://api.example.com/v1", body: { prompt: "hello" } }),
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(test.calls).toHaveLength(1);

    const spec = await test.app.request("/openapi.json");
    const document = await spec.json() as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths).toHaveProperty("/v1/gateway/proxy");
    expect(document.paths).toHaveProperty("/v1/audit-logs");
    expect(JSON.stringify(document)).not.toMatch(/did:key|Verifiable Credential/);

    const health = await test.app.request("/health");
    expect(health.status).toBe(200);
  });
});
